'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {harness,seed,clone,setBrowser}=require('./company-team-ui.e2e.js');
const API='https://script.google.com/macros/s/AKfyTEST_COMPANY/exec';
const us=[{id:'u1',type:'unit',dong:'101',ho:'501',name:''},{id:'u2',type:'unit',dong:'102',ho:'601',name:''}];
function store(){const s=seed();s.projects=[{id:'p1',name:'TEST_APARTMENT',teamIds:['t1','t2'],active:true,sourceKey:crypto.randomUUID(),units:clone(us)}];s.tasks[0].projectId='p1';s.tasks[0].unitId='u1';s.tasks[0].project='TEST_APARTMENT';s.tasks[0].assignmentVersion=0;s.tasks[1].projectId='p1';s.tasks[1].unitId='u2';s.tasks[1].project='TEST_APARTMENT';s.evidence=s.tasks.map((t,i)=>({id:'e'+i,projectId:'p1',taskId:t.id,kind:'photo',phase:'after',caption:'TEST_PHOTO_U'+(i+1),capturedDate:'2026-10-01',name:'test-'+i+'.jpg',mime:'image/jpeg',size:10,sha256:'a'.repeat(64),uploaderId:t.assigneeId,uploadedAt:'2026-10-01T00:00:00Z',fileId:'TEST_ORIGINAL_'+i}));return s;}
let browser,count=0;
const mutation=process.env.HJ_LINKS_UI_MUTATION||'';
const pairs={
 'ui-autosign':['team-ui.js',"$('editor').showModal();","$('editor').showModal(); if(kind==='ack'){$('edit-ackConfirm').checked=true;save({preventDefault(){}});}"],
 'ui-new-retry':['team-ui.js','const r = await api(edit.pending.action, edit.pending.payload);','edit.pending.payload.requestId=crypto.randomUUID(); const r = await api(edit.pending.action, edit.pending.payload);'],
 'ui-stale-accept':['team-ui.js',"if (e.kind === 'ack') { const current", "if (false) { const current"],
 'ui-unit-leak':['team-projects.js',"if (d.me.role !== 'owner' && !ps.every(p => (p.units || []).every(u => d.tasks.some(t => t.projectId === p.id && t.unitId === u.id)))) return false;",''],
 'ui-changed-import':['team-projects.js',"e.linkRaw !== value('linkJson') || e.linkTargetName !== value('name').trim() ||",''],
 'ui-unit-filter':['team-projects.js',"const unitAll = '', unitMissing = '@unassigned';","const unitAll = 'all', unitMissing = 'unassigned';"]
};
function mutate(file,text){if(pairs[mutation]?.[0]===file){const [,a,b]=pairs[mutation];assert(text.includes(a),'mutation anchor missing');return text.replace(a,b);}return text;}
async function make(options={}){return harness({store:store(),mutate,...options});}
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
async function closed(h){await h.page.waitForFunction(()=>!document.getElementById('editor').open);}
async function ack(h){await h.page.getByRole('button',{name:'업무 확인·수락',exact:true}).click();assert.equal(await h.page.isChecked('#edit-ackConfirm'),false,'opening cannot pre-approve acceptance');assert.equal(h.writes.length,0,'opening confirmation must not write');await h.page.locator('#edit-ackConfirm').check();}
async function run(){
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});setBrowser(browser);
 await test('two users: explicit acceptance, owner sees receipt after refresh, assignment changes require new acceptance',async()=>{
  const shared={store:store()},worker=await make({role:'member',shared}),owner=await make({shared});await worker.login();await owner.login();await owner.page.click('#tabTeams');await owner.page.locator('[data-team-id=t1] button').click();
  assert.match(await worker.page.textContent('#assignmentNotice'),/1건/);assert.match(await worker.page.textContent('#taskList'),/101동 501호/);assert.doesNotMatch(await worker.page.textContent('#taskList'),/102동 601호/);
  await ack(worker);await worker.page.click('#save');await closed(worker);assert.equal(shared.store.tasks[0].acknowledgements.length,1);
  await owner.page.click('#refresh');await owner.page.waitForFunction(()=>document.getElementById('taskList').textContent.includes('담당자 수락 확인'));
  shared.store.revision++;shared.store.tasks[0].title='변경된 모의 업무';shared.store.tasks[0].assignmentVersion=shared.store.revision;
  await worker.page.click('#refresh');await worker.page.waitForFunction(()=>document.getElementById('assignmentNotice').textContent.includes('1건'));
  await worker.page.click('#logout');assert.equal(await worker.page.textContent('#assignmentNotice'),'');assert.equal(await worker.page.locator('#taskList article').count(),0);
  await worker.close();await owner.close();
 });
 await test('lost acceptance response reuses request id; no duplicate receipts',async()=>{
  const h=await make({role:'member'});await h.login();await ack(h);h.failNext='network-after-write';await h.page.click('#save');await h.page.waitForFunction(()=>document.getElementById('save').textContent.includes('재확인'));await h.page.click('#save');await closed(h);
  assert.equal(h.writes.length,2);assert.equal(h.writes[0].payload.requestId,h.writes[1].payload.requestId);assert.equal(h.store.tasks[0].acknowledgements.length,1);await h.close();
 });
 await test('stale confirmation is replaced with latest task and unchecked consent before retry',async()=>{
  const h=await make({role:'member'});await h.login();await ack(h);h.store.revision++;h.store.tasks[0].title='변경 후 다시 읽어야 하는 작업';h.store.tasks[0].assignmentVersion=h.store.revision;
  await h.page.click('#save');await h.page.waitForFunction(()=>!document.getElementById('compare').hidden);await h.page.click('#compare');await h.page.waitForFunction(()=>!document.getElementById('rebase').hidden);await h.page.click('#rebase');
  assert.match(await h.page.textContent('#editorFields'),/변경 후 다시 읽어야/);assert.equal(await h.page.isChecked('#edit-ackConfirm'),false);await h.page.locator('#edit-ackConfirm').check();await h.page.click('#save');await closed(h);assert.equal(h.store.tasks[0].acknowledgements[0].assignmentVersion,1);await h.close();
 });
 await test('explicit project preview/import; source and units retained in owner project edits',async()=>{
  const h=await make();await h.login();await h.page.click('#tabProjects');await h.page.selectOption('#xp-projectSelect','p1');await h.page.getByRole('button',{name:'프로젝트 수정',exact:true}).click();
  const p=h.store.projects[0],packet={format:'company-project-links-v1',apiUrl:API,sourceKey:p.sourceKey,name:p.name,units:us};
  await h.page.fill('#xp-linkJson',JSON.stringify(packet));await h.page.getByRole('button',{name:'연결 자료 미리보기',exact:true}).click();assert.match(await h.page.textContent('#projectLinkPreview'),/101동 501호/);assert.equal(h.writes.length,0);
  await h.page.locator('input[name=linkConfirm]').check();await h.page.click('#projectSave');await h.page.waitForFunction(()=>!document.getElementById('projectEditor').open);assert.equal(h.store.projects[0].sourceKey,p.sourceKey);assert.deepEqual(h.store.projects[0].units,us);
  assert.equal(await h.page.locator('#projectEvidence article').count(),2);await h.page.selectOption('#xp-unitFilter','u1');assert.match(await h.page.textContent('#projectsPanel'),/101동 501호/);assert.doesNotMatch(await h.page.textContent('#projectsPanel'),/마감 모의 업무|TEST_PHOTO_U2/);assert.equal(await h.page.locator('#projectEvidence article').count(),1);assert.match(await h.page.textContent('#projectEvidence'),/TEST_PHOTO_U1/);await h.page.selectOption('#xp-unitFilter','u2');assert.match(await h.page.textContent('#projectEvidence'),/TEST_PHOTO_U2/);assert.doesNotMatch(await h.page.textContent('#projectEvidence'),/TEST_PHOTO_U1/);await h.close();
 });
 await test('changed target name or cleared JSON needs a new preview; no silent old import',async()=>{
  const h=await make();await h.login();await h.page.click('#tabProjects');await h.page.selectOption('#xp-projectSelect','p1');await h.page.getByRole('button',{name:'프로젝트 수정',exact:true}).click();
  const p=h.store.projects[0],raw=JSON.stringify({format:'company-project-links-v1',apiUrl:API,sourceKey:p.sourceKey,name:p.name,units:us});
  await h.page.fill('#xp-linkJson',raw);await h.page.getByRole('button',{name:'연결 자료 미리보기',exact:true}).click();await h.page.locator('input[name=linkConfirm]').check();
  await h.page.fill('#xp-name','TEST_CHANGED_TARGET');await h.page.click('#projectSave');assert.equal(h.writes.length,0);assert(await h.page.locator('#projectEditor').evaluate(el=>el.open));
  await h.page.fill('#xp-name',p.name);await h.page.fill('#xp-linkJson','');await h.page.click('#projectSave');assert.equal(h.writes.length,0);await h.close();
 });
 await test('all/unassigned are valid opaque IDs, never special filter aliases',async()=>{
  const s=store();s.projects[0].units.push(...['all','unassigned'].map((id,i)=>({id,type:'common',dong:'',ho:'',name:'TEST_COMMON_'+i})));
  for(const [i,unitId] of ['all','unassigned',''].entries()){const t={...s.tasks[0],id:'task-extra-'+i,title:'TEST_LOCATION_'+i,unitId};s.tasks.push(t);s.evidence.push({...s.evidence[0],id:'extra-'+i,taskId:t.id,caption:'TEST_LOCATION_PHOTO_'+i});}
  const h=await make({store:s});await h.login();await h.page.click('#tabProjects');await h.page.selectOption('#xp-projectSelect','p1');assert.equal(await h.page.locator('#projectEvidence article').count(),5);
  for(const [i,filter] of ['all','unassigned','@unassigned'].entries()){await h.page.selectOption('#xp-unitFilter',filter);assert.equal(await h.page.locator('#projectEvidence article').count(),1);assert.match(await h.page.textContent('#projectEvidence'),new RegExp('TEST_LOCATION_PHOTO_'+i));}
  await h.page.selectOption('#xp-unitFilter','');assert.equal(await h.page.locator('#projectEvidence article').count(),5);await h.close();
 });
 await test('same-name foreign-server JSON cannot be previewed or saved',async()=>{
  const h=await make();await h.login();await h.page.click('#tabProjects');await h.page.selectOption('#xp-projectSelect','p1');await h.page.getByRole('button',{name:'프로젝트 수정',exact:true}).click();
  await h.page.fill('#xp-linkJson',JSON.stringify({format:'company-project-links-v1',apiUrl:API.replace('AKfyTEST_COMPANY','TEST_FOREIGN'),sourceKey:h.store.projects[0].sourceKey,name:'TEST_APARTMENT',units:us}));await h.page.getByRole('button',{name:'연결 자료 미리보기',exact:true}).click();assert.match(await h.page.textContent('#projectLinkPreview'),/확인하세요/);await h.page.click('#projectSave');assert.equal(h.writes.length,0);await h.close();
 });
 await test('old v3 server without capabilities keeps original task editing; no new API action',async()=>{
  const h=await harness({mutate});await h.page.route(API,async route=>{if(JSON.parse(route.request().postData()).action!=='list')return route.fallback();const s=seed();return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{revision:0,me:{id:'owner',name:'대표 모의',role:'owner',teamIds:['t1','t2']},teams:s.teams,members:s.members,tasks:s.tasks,audit:[],projects:[],evidence:[],claims:[]}})});});
  await h.login();assert.match(await h.page.textContent('#assignmentNotice'),/지원하지/);assert.equal(await h.page.getByRole('button',{name:'업무 확인·수락',exact:true}).count(),0);await h.page.click('#tabTeams');await h.page.locator('[data-team-id=t1] button').click();
  await h.page.locator('[data-task-id=task1]').getByRole('button',{name:'업무 확인·수정',exact:true}).click();assert(await h.page.isDisabled('#edit-unitId'));await h.page.click('#editorClose');assert.equal(h.writes.length,0);await h.close();
 });
 await test('client rejects accidental location leak in server projection',async()=>{
  const h=await make({role:'member'});await h.page.route(API,async route=>{const action=JSON.parse(route.request().postData()).action;if(action!=='list')return route.fallback();const {engine}=require('./company-team-ui.e2e.js');const d=clone(engine.teamPresent_(h.store,{userId:'TEST_MEMBER_USER',officeId:'TEST_OFFICE'}));d.projects[0].units=us;return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:d})});});
  await h.page.waitForFunction(()=>!document.getElementById('loginButton').disabled);await h.page.fill('#officeCode','test-office');await h.page.fill('#email','staff@example.invalid');await h.page.fill('#loginCode','TEST_PASSWORD');await h.page.click('#loginButton');await h.page.waitForFunction(()=>document.getElementById('connection').classList.contains('error'));assert(await h.page.isHidden('#workspace'));assert.equal(await h.page.locator('#taskList article').count(),0);await h.close();
 });
 await test('320/360 mobile: linked task controls are reachable, 44px targets and no overflow',async()=>{
  for(const width of [320,360]){const h=await make({role:'member'});await h.page.setViewportSize({width,height:740});await h.login();await ack(h);assert.equal(await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert((await h.page.locator('#save').boundingBox()).height>=44);await h.page.click('#editorClose');await h.close();}
 });
 await browser.close();console.log('company-links-ack-ui: '+count+'/'+count+' PASS');
}
run().catch(async e=>{console.error('FAIL company-links-ack-ui:',e.stack);if(browser)await browser.close();process.exitCode=1;});
