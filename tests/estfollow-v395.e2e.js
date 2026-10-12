/* v395 파일 견적의 팔로업·종결·수주 단계·방치·오늘 마감. 가상 자료와 실제 오늘 기준. */
'use strict';
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const assert=require('node:assert/strict'),results=[];
async function test(n,fn){try{await fn();results.push(true);console.log('PASS '+n);}catch(e){results.push(false);console.log('FAIL '+n+' '+e.stack);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined}),ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:780}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_gcal_auto','0');});
 await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__hjOfficeOpsBootDone);
 await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);window.taxCalendarEnsure=()=>0;window.coworkSchedEnsure=()=>0;window.portalAutoSync=()=>0;window.__snap=()=>{const d=serializeData();d.savedAt='';return paidStableJson(d);};window.__ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return localDate(d);};});
 const seed=()=>page.evaluate(()=>{
  closeModal(true);state._demo=false;state.schedule=[];state.notes=[];state.payLog=[];state.asLog=[];state.contacts=[];state.adPosts=[];state.satisfaction=[];
  const p=(name,x)=>Object.assign({name,stage:0,received:0,phases:[],cost:{},customer:{name:'가상고객',phone:'010-0000-0000',addr:''}},x||{});
  state.projects=[p('날짜'),p('이름'),p('파일시각'),p('오래됨'),p('수주대상',{stage:1,checklists:{start:{_ok:true}}}),p('가상파일'),p('시공',{stage:2}),p('보관',{archived:true}),p('앱견적'),p('종결',{estClosed:{at:__ago(1),reason:'기타'}}),p('막작성'),p('일년밖'),p('잘못된날짜')];
  const f=(project,n,x)=>Object.assign({id:'f-'+project,name:project+'.xlsx',kind:'estimate',project,when:__ago(80)+'T12:00:00',est:{date:__ago(n),amount:1200000}},x||{});
  state.files=[f('날짜',10),f('날짜',20,{id:'old',name:'이전.pdf',est:{date:__ago(20),amount:999}}),f('이름',12,{name:'★'+__ago(12).replace(/-/g,'')+' 아주긴가상현장견적서파일이름'.repeat(5)+'.pdf',est:{date:'2026-02-30'}}),f('파일시각',15,{est:{},when:__ago(15)+'T12:00:00'}),f('오래됨',40),f('수주대상',6),f('가상파일',7,{_fromQuote:true}),f('시공',8),f('보관',8),f('앱견적',8),f('종결',8),f('막작성',1),f('일년밖',366),f('잘못된날짜',20,{name:'★20260230 오류.pdf',est:{date:'wrong'},when:__ago(20)+'T12:00:00'})];
  state.quotes=[{id:'q-open',project:'앱견적',title:'앱 견적',date:__ago(5),items:[{name:'가상공정',qty:1,price:1000000}]}];state.editingQuote=null;state.tab='dashboard';state.activeProject=null;render();
 });
 const row=n=>page.locator('.efRow').filter({has:page.locator('b',{hasText:new RegExp('^'+n+'$')})});
 await test('① 날짜 우선순위·최신 파일·대상·기간·조회 불변',async()=>{
  await seed();const r=await page.evaluate(()=>{const before=__snap(),rows=hjEstFileFollowData();return {rows,same:before===__snap(),expected:[__ago(6),__ago(10),__ago(12),__ago(15),__ago(20),__ago(40),__ago(366)]};});
  assert.deepEqual(r.rows.map(r=>r.project),['수주대상','날짜','이름','파일시각','잘못된날짜','오래됨','일년밖']);assert.deepEqual(r.rows.map(r=>r.date),r.expected);assert.deepEqual(r.rows.map(r=>r.days),[6,10,12,15,20,40,366]);assert.equal(r.rows[1].amount,1200000);assert.equal(r.rows[3].amount,0);assert(r.rows.every(r=>!('phone'in r)));assert(r.same);
 });
 await test('실제 Date 객체와 저장·복원 뒤 파일 날짜',async()=>{
  await seed();const r=await page.evaluate(()=>{const f=state.files.find(f=>f.project==='파일시각');f.when=new Date(__ago(15)+'T12:00:00');const first=hjEstFileFollowData().find(r=>r.project==='파일시각').date;const saved=serializeData();applyData(saved);const restored=state.files.find(f=>f.project==='파일시각');return {first,after:hjEstFileFollowData().find(r=>r.project==='파일시각').date,isDate:restored.when instanceof Date,expected:__ago(15)};});assert.equal(r.first,r.expected);assert.equal(r.after,r.expected);assert(r.isDate);
 });
 await test('② 파일 묶음·문자·종결·수주 단계·44px',async()=>{
  await seed();const r=await page.evaluate(async()=>{window.__quotesBefore=JSON.stringify(state.quotes);window.__sms=[];window.hjSendSms=(phone,text)=>__sms.push({phone,text});const result=await quoteFollowup();return {result,text:document.querySelector('.modal').textContent,heights:[...document.querySelectorAll('#estFileFollow button:not(.efReason)')].map(b=>b.getBoundingClientRect().height),w:document.querySelector('.modal').scrollWidth-document.querySelector('.modal').clientWidth};});
  assert.equal(r.result.팔로업,6);assert.equal(r.result.종결대상,2);assert(r.text.includes('📄 견적서 파일'));assert(r.text.includes('팔로업 대기 6건'));assert(r.text.includes('30일 지난 파일 2건'));assert(r.heights.length===21&&r.heights.every(h=>h>=44));assert(r.w<=0);
  await row('날짜').locator('.efSms').click();const sms=await page.evaluate(()=>__sms);assert.equal(sms[0].phone,'010-0000-0000');assert(sms[0].text.includes('날짜 견적'));
  await row('날짜').locator('.efClose').click();assert((await row('날짜').locator('.efReason').first().boundingBox()).height>=44);await row('날짜').locator('.efReason').filter({hasText:'가격'}).click();assert.equal(await row('날짜').count(),0);assert(await page.evaluate(()=>state.projects[0].estClosed.at===localDate()&&state.projects[0].estClosed.reason==='가격'&&JSON.stringify(state.quotes)===__quotesBefore));
  await row('수주대상').locator('.efWon').click();assert.equal(await page.locator('#modalRoot h3').textContent(),'🎉 수주 — 수주대상');assert(!(await page.locator('#quoteWonNext').textContent()).includes('수주로 표시했어요'));
  await page.getByRole('button',{name:'그대로 두기',exact:true}).click();assert.equal(await page.evaluate(()=>state.projects.find(p=>p.name==='수주대상').stage),1);await row('수주대상').locator('.efWon').click();await page.getByRole('button',{name:'🔨 시공으로 올리기',exact:true}).click();assert.equal(await page.evaluate(()=>state.projects.find(p=>p.name==='수주대상').stage),2);assert(await page.evaluate(()=>JSON.stringify(state.quotes)===__quotesBefore));
 });
 await test('③ 20일·1일 파일은 방치 제외, 종결 후 다시 대상',async()=>{
  await seed();const r=await page.evaluate(()=>{state.files.find(f=>f.project==='날짜').est.date=__ago(20);const before=__snap(),names=staleProjectData().map(p=>p.name),same=before===__snap();state.projects[0].estClosed={at:localDate(),reason:'기타'};return {names,same,after:staleProjectData().map(p=>p.name)};});assert(!r.names.includes('날짜'));assert(!r.names.includes('막작성'));assert(r.after.includes('날짜'));assert(r.same);
 });
 await test('④ 오늘 마감 합계·파일만/지난 파일만/빈 화면',async()=>{
  await seed();const r=await page.evaluate(()=>{hjDayCloseView();return {follow:hjDayCloseData().sales.follow,text:document.getElementById('dcSales').textContent};});assert.equal(r.follow,6);assert(r.text.includes('답 기다리는 견적 6건'));
  const a=await page.evaluate(async()=>{closeModal(true);state.quotes=[];state.files=state.files.filter(f=>f.project==='날짜');const ret=await quoteFollowup();return {ret,rows:document.querySelectorAll('.efRow').length,text:document.querySelector('.modal').textContent};});assert.equal(a.ret.팔로업,1);assert.equal(a.rows,1);assert(a.text.includes('팔로업 대기 1건'));
  const b=await page.evaluate(async()=>{state.files.forEach(f=>{f.est.date=__ago(40);});const ret=await quoteFollowup();return {ret,text:document.querySelector('.modal').textContent};});assert.equal(b.ret.팔로업,0);assert.equal(b.ret.종결대상,1);assert(b.text.includes('30일 지난 파일 1건'));assert(!b.text.includes('팔로업할 견적이 없어요'));
  await row('날짜').locator('.efClose').click();await row('날짜').locator('.efReason').filter({hasText:'기타'}).click();assert((await page.locator('.modal').textContent()).includes('팔로업할 견적이 없어요'));
 });
 await browser.close();console.log('estfollow-v395: '+results.filter(Boolean).length+'/'+results.length+' passed, pageerrors='+errors.length);process.exit(results.every(Boolean)&&!errors.length?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
