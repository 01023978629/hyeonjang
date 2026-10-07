/* my-work.e2e.js — v333 📋 내 업무: 하단 [오늘 할일]이 여는 한 화면.
   ① 오늘 일정만(💰 수금·내일 제외, 시간순) ② 세 출처(이 기기 할일·팀 업무판·팀 공유) 한 목록, 같은 현장·글은 한 줄
   ③ [▶ 작업 시작] → 일정 레코드 안 startedAt, 다른 칸은 그대로 ④ [📷 사진 등록] → 그 현장·작업 이름으로 사진 추가 확인 창
   ⑤ [✅ 완료 보고] → 그 일정(같은 날 같은 현장 다른 일정 아님)의 작업일지·진행률 '완료', 현장 단계는 그대로,
      사진 0장이면 '사진 없이 완료할까요?' — 아니오면 저장 안 함, 사진이 있으면 묻지 않음
   ⑥ 할일 체크(이 기기)·팀 업무 완료(기록자 이름 필수) ⑦ 직원 작업실 링크(설정됐을 때만) ⑧ 빈 화면 + 내일 미리보기
   ⑨ 360px 넘침 0 · 누르는 것 44 · 입력 16 · Esc/뒤로가기 닫으면 하단 버튼으로 초점
   ⑩ 팀 업무판 담당자 칩(대표 결정 2026-10-01) — 눌러서 고르고 이 기기에 기억, 기록자 칸 미리 채움
   가짜 자료만 쓴다(공유 서버는 tests/shared-todo-mock 의 메모리 모의 서버). */
'use strict';
const assert=require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const {createSharedTodoMock,URL:MOCK,TOKEN}=require('./shared-todo-mock');
const ORIGIN='http://127.0.0.1:8299';
const NAV='.mobile-nav [data-mnav="__todo"]';
const P1='가상 내업무 아파트 101동',P2='가상 내업무 빌라';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function closed(page){await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet)&&document.activeElement?.dataset.mnav==='__todo');}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  const mock=createSharedTodoMock();
  const sharedDup=mock.create(P1,'실리콘 사기'),sharedOnly=mock.create(P2,'공용부 자재 확인'),sharedDone=mock.update(mock.create(P2,'끝난 공유 일'),{done:true});
  const errors=[],dialogs=[];let dialogAnswer=true;
  async function boot({teamConfigured,relay,width=360}){
    const context=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url===MOCK)return mock.handle(route);
      if(/\/team-config\.js(\?|$)/.test(url)&&teamConfigured)return route.fulfill({status:200,contentType:'text/javascript',body:"window.HJ_TEAM_CONFIG = Object.freeze({ apiUrl: 'https://script.google.com/macros/s/AKfyTEST_TEAM/exec' });"});
      if(new URL(url).origin===ORIGIN)return route.continue();
      return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(9000);
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('dialog',d=>{dialogs.push(d.message());return dialogAnswer?d.accept():d.dismiss();});
    await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
    await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjRelayBootDone&&window.__hjOfficeOpsBootDone);
    await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjRelayBootDone,__hjOfficeOpsBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
    await page.evaluate(({P1,P2,relay,MOCK,TOKEN})=>{
      taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};officeIntakeSync=async()=>false;
      const today=localDate(),d=new Date();d.setDate(d.getDate()-1);const yesterday=localDate(d);d.setDate(d.getDate()+2);const tomorrow=localDate(d);
      window.__mw={today,yesterday,tomorrow};
      state.projects=[P1,P2].map(name=>({name,stage:2,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{}}));
      state.activeProject=P2;state.files=[];state.quotes=[];state.expenses=[];state.payLog=[];state.aptOrders=[];
      state.schedule=[
        {id:'s-tile',date:today,time:'13:00',title:'거실 타일',project:P1,workers:'2',memo:'가상 메모 유지',hours:8,report:null,prep:{'타일 커터':true},labor:{x:1}},
        {id:'s-bath',date:today,time:'09:00',title:'욕실 방수',project:P1,workers:'1',memo:'',hours:4,report:null},
        {id:'s-pay',date:today,time:'',title:'💰 잔금 입금 확인',project:P1,report:null},
        {id:'s-next',date:tomorrow,time:'10:00',title:'내일 도배',project:P2,report:null}
      ];
      const team=(id,title,project,status,due)=>({id,date:'가상',day:today,text:'[팀 업무]',todo:true,done:status==='done',project,teamTask:{schema:1,title,assignee:'가상담당',due,status,handoff:'',recorder:'가상기록',updatedAt:new Date().toISOString(),revision:1}});
      state.notes=[
        {id:'memo-1',text:'가상 회의 메모',project:P1,date:today},
        {id:'loc-today',text:'실리콘 사기',project:P1,date:today,day:today,todo:true,done:false},
        {id:'loc-late',text:'가상 밀린 일',project:P2,date:yesterday,day:yesterday,todo:true,done:false},
        {id:'loc-done',text:'가상 끝낸 일',project:P1,date:today,day:today,todo:true,done:true},
        team('team-now','배관 점검',P2,'doing',today),team('team-later','다음 주 점검',P2,'todo',tomorrow),team('team-done','끝난 팀 업무',P2,'done','')
      ];
      state.tab='photos';state.search='';state.dirHandle=null;state._demo=false;state.dirty=false;state.editingQuote=null;
      __relay=relay?{url:MOCK,token:TOKEN,device:'test-mywork',rev:5,syncAt:'TEST'}:{url:'',token:'',device:'',rev:0,syncAt:''};
      __mobileMode=true;applyMobileMode();__gdToken=null;aiOpsEnsureState().enabled=false;
      window.__mwUnexpected=[];const reject=n=>()=>{__mwUnexpected.push(n);throw new Error('unexpected '+n);};
      relayCall=reject('legacy relay');geminiAsk=reject('AI');window.open=reject('popup');
      render();syncMobileNav();clearTimeout(__idbSaveTimer);document.getElementById('toast').classList.remove('show');
    },{P1,P2,relay,MOCK,TOKEN});
    await settle(page);
    return {context,page};
  }
  try{
    // ── 연결된 기기: 세 출처·직원 작업실 설정됨
    const {context,page}=await boot({teamConfigured:true,relay:true});
    await page.locator(NAV).click();
    await page.locator('#myWork').waitFor();
    await page.waitForFunction(()=>/확인 \d\d:\d\d/.test(document.getElementById('mwSharedState')?.textContent||''));
    await page.waitForFunction(()=>!!document.getElementById('mwTeamOpen'));
    if(process.env.HJ_MYWORK_SHOT){await page.screenshot({path:process.env.HJ_MYWORK_SHOT,fullPage:false});await page.locator('#myWork').screenshot({path:process.env.HJ_MYWORK_SHOT.replace(/\.png$/,'-full.png')});}
    // ① 오늘 일정 — 시간순, 💰·내일 없음
    assert.deepEqual(await page.locator('#myWork [data-mw-sch]').evaluateAll(es=>es.map(e=>e.dataset.mwSch)),['s-bath','s-tile'],'① 오늘 작업 일정만 시간순');
    // ② 세 출처 한 목록 — 밀린 것 먼저, 같은 현장·글은 한 줄에 배지 둘
    const rows=await page.locator('#myWork [data-mw-todo]').evaluateAll(es=>es.map(e=>({key:e.dataset.mwTodo,text:e.querySelector('.mwTitle').textContent,badges:[...e.querySelectorAll('.mwBadge')].map(b=>b.textContent)})));
    assert.deepEqual(rows.map(r=>r.text),['가상 밀린 일','실리콘 사기','배관 점검','공용부 자재 확인'],'② 밀린·오늘 할일 한 목록(끝난 것·다음 기한 제외): '+JSON.stringify(rows));
    assert.equal(rows.filter(r=>r.text==='실리콘 사기').length,1,'② 이 기기 할일과 같은 공유 할일은 한 줄');
    assert.deepEqual(rows.find(r=>r.text==='실리콘 사기').badges,['이 기기 할일','팀 공유'],'② 한 줄에 두 출처 배지');
    assert.deepEqual(rows.find(r=>r.text==='배관 점검').badges,['팀 업무판']);assert.deepEqual(rows.find(r=>r.text==='공용부 자재 확인').badges,['팀 공유']);
    assert.equal(mock.count('sharedTodoSave'),0,'② 읽기만 — 화면에서 서버 쓰기 없음');
    // ⑦ 직원 작업실 링크
    assert.equal(await page.locator('#mwTeamOpen').getAttribute('href'),'./team.html#mine');
    assert.match(await page.locator('#mwTeamOpen').getAttribute('rel'),/noopener/);
    // ⑨ 폰 규칙
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'⑨ 360px 가로 넘침 없음');
    const small=await page.locator('#myWork button:visible, #myWork a.btn:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {t:e.textContent.trim().slice(0,20),w:r.width,h:r.height,right:r.right};}).filter(x=>x.w<43.5||x.h<43.5||x.right>innerWidth+1));
    assert.deepEqual(small,[],'⑨ 누르는 것 44px·화면 안');
    const chk=await page.locator('#myWork .mwChk').first().evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=43.5&&r.height>=43.5;});assert(chk,'⑨ 체크 칸 44px');

    // ③ 작업 시작
    const beforeTile=await page.evaluate(()=>JSON.stringify(state.schedule.find(s=>s.id==='s-tile')));
    await page.locator('[data-mw-start="s-tile"]').click();
    await page.waitForFunction(()=>/진행 중 · \d\d:\d\d 부터/.test(document.querySelector('[data-mw-state="s-tile"]')?.textContent||''));
    const tile=await page.evaluate(()=>state.schedule.find(s=>s.id==='s-tile'));
    assert.match(tile.startedAt,/^\d{4}-\d\d-\d\d \d\d:\d\d$/,'③ startedAt 로컬 시각');
    assert.equal(tile.startedAt.slice(0,10),await page.evaluate(()=>__mw.today));
    const {startedAt,...restTile}=tile;assert.deepEqual(restTile,JSON.parse(beforeTile),'③ 다른 칸(prep·labor·memo)은 그대로');
    assert.equal(await page.locator('[data-mw-start="s-tile"]').count(),0,'③ 시작 뒤 버튼 대신 진행 중 표시');
    assert.equal(await page.evaluate(()=>state.dirty),true,'③ 저장 대기');

    // ④ 사진 등록 — 그 현장·작업 이름으로 사진 추가 확인 창
    const chooser=page.waitForEvent('filechooser');
    await page.locator('[data-mw-photo="s-bath"]').click();
    await (await chooser).setFiles({name:'가상.png',mimeType:'image/png',buffer:PNG});
    await page.locator('#photoIntakeProject').waitFor();
    assert.equal(await page.locator('#photoIntakeProject').evaluate(s=>s.options[s.selectedIndex].textContent),P1,'④ 미리 고른 현장 = 일정 현장(지금 보는 현장 아님)');
    assert.equal(await page.locator('#photoIntakeWork').inputValue(),'욕실 방수','④ 작업 내용에 일정 이름');
    await page.locator('#photoIntakeCancel').click();await closed(page);
    assert.equal(await page.evaluate(()=>state.files.length),0,'④ 취소하면 아무것도 안 들어간다');

    // ⑤ 완료 보고 — 사진 0장: 아니오면 저장 안 함
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    await page.locator('[data-mw-done="s-tile"]').click();await page.locator('#mwDoneText').waitFor();
    assert.match(await page.locator('#mwPhotoCount').innerText(),/0장/);
    await page.locator('#modalRoot .mfoot button').filter({hasText:'완료 보고 저장'}).click();
    assert.equal(await page.evaluate(()=>state.schedule.find(s=>s.id==='s-tile').report),null,'⑤ 빈 글은 저장 안 함');
    await page.locator('#mwDoneText').fill('거실 타일 붙임 완료');
    dialogAnswer=false;const d0=dialogs.length;
    await page.locator('#modalRoot .mfoot button').filter({hasText:'완료 보고 저장'}).click();
    assert.equal(dialogs.length,d0+1,'⑤ 사진 0장이면 묻는다');assert.match(dialogs.at(-1),/사진 없이 완료할까요\?/);
    assert.equal(await page.evaluate(()=>state.schedule.find(s=>s.id==='s-tile').report),null,'⑤ 아니오 → 저장 안 함');
    dialogAnswer=true;
    await page.locator('#modalRoot .mfoot button').filter({hasText:'완료 보고 저장'}).click();
    await page.locator('#myWork').waitFor();
    const after=await page.evaluate(()=>({tile:state.schedule.find(s=>s.id==='s-tile'),bath:state.schedule.find(s=>s.id==='s-bath'),n:state.schedule.length,stage:state.projects[0].stage,doneAt:state.projects[0].doneAt||''}));
    assert.equal(after.tile.report.done,'거실 타일 붙임 완료','⑤ 그 일정 작업일지');assert.equal(after.tile.report.progress,'완료');
    assert.equal(after.bath.report,null,'⑤ 같은 날 같은 현장의 다른 일정(09:00 욕실)에 붙지 않는다');
    assert.equal(after.n,4,'⑤ 일지 전용 일정을 새로 만들지 않는다');
    assert.equal(after.stage,2,'⑤ 현장 단계는 자동으로 안 바뀐다');assert.equal(after.doneAt,'');
    assert.equal(await page.locator('[data-mw-sch="s-tile"]').evaluate(e=>e.classList.contains('mwDone')&&/완료 보고됨/.test(e.textContent)),true,'⑤ 카드가 완료로');
    assert.equal(await page.locator('[data-mw-done="s-tile"]').count(),0);
    // ⑤ 사진이 있으면 묻지 않는다
    await page.evaluate(({P1})=>{state.files.push({id:'f-bath',name:'가상 욕실.jpg',kind:'photo',ext:'jpg',size:10,project:P1,when:new Date(),thumb:'data:image/png;base64,iVBORw0KGgo=',_virtual:true});},{P1});
    await page.locator('[data-mw-done="s-bath"]').click();await page.locator('#mwDoneText').waitFor();
    assert.match(await page.locator('#mwPhotoCount').innerText(),/1장/,'⑤ 그날 그 현장 사진 수');
    await page.locator('#mwDoneText').fill('욕실 방수 2차');const d1=dialogs.length;
    await page.locator('#modalRoot .mfoot button').filter({hasText:'완료 보고 저장'}).click();await page.locator('#myWork').waitFor();
    assert.equal(dialogs.length,d1,'⑤ 사진이 있으면 묻지 않는다');
    assert.equal(await page.evaluate(()=>state.schedule.find(s=>s.id==='s-bath').report.progress),'완료');

    // ⑥ 이 기기 할일 체크 — 공유 쪽은 남는다(공유 체크는 공유 화면에서)
    await page.locator('[data-mw-local="loc-today"]').click();
    await page.waitForFunction(()=>state.notes.find(n=>n.id==='loc-today').done===true);
    await page.locator('#myWork').waitFor();
    const r2=await page.locator('#myWork [data-mw-todo]').evaluateAll(es=>es.map(e=>({text:e.querySelector('.mwTitle').textContent,badges:[...e.querySelectorAll('.mwBadge')].map(b=>b.textContent)})));
    assert.deepEqual(r2.find(r=>r.text==='실리콘 사기').badges,['팀 공유'],'⑥ 이 기기 쪽만 끝남, 공유 할일은 그대로');
    assert.equal(mock.active().find(t=>t.id===sharedDup.id).done,false,'⑥ 서버 공유 할일은 건드리지 않는다');
    // ⑥ 팀 업무 완료 — 기록자 이름 필수
    await page.locator('[data-mw-teamdone="team-now"]').click();
    await page.locator('[data-mw-teamsave="team-now"]').click();
    assert.equal(await page.evaluate(()=>state.notes.find(n=>n.id==='team-now').teamTask.status),'doing','⑥ 기록자 없이 저장 안 함');
    await page.locator('[data-mw-rec="team-now"]').fill('가상기록자');
    await page.locator('[data-mw-teamsave="team-now"]').click();
    await page.waitForFunction(()=>state.notes.find(n=>n.id==='team-now').teamTask.status==='done');
    const tn=await page.evaluate(()=>state.notes.find(n=>n.id==='team-now'));
    assert.equal(tn.teamTask.recorder,'가상기록자');assert.equal(tn.teamTask.revision,2);assert.equal(tn.done,true);assert.equal(tn.teamTask.title,'배관 점검');
    await page.waitForFunction(()=>!document.querySelector('[data-mw-teamdone="team-now"]'));
    assert.equal(await page.evaluate(()=>state.notes.find(n=>n.id==='memo-1').text),'가상 회의 메모','⑥ 일반 메모는 그대로');

    // ⑩ 대표 결정 2026-10-01 — 팀 업무판 업무는 '내가 누구인지'를 눌러서 고른다(로그인 없음). 칩 = 담당자들 + 전체, 이 기기(hj_mywork_who)에 기억,
    //    기록자 칸은 고른 사람으로 미리 채운다(바꿀 수 있다).
    await page.keyboard.press('Escape');await closed(page);
    await page.evaluate(({P1})=>{const today=localDate();state.notes.push({id:'team-peer',date:'가상',day:today,text:'[팀 업무]',todo:true,done:false,project:P1,teamTask:{schema:1,title:'동료 배관 사진 정리',assignee:'가상동료',due:today,status:'todo',handoff:'',recorder:'가상기록',updatedAt:new Date().toISOString(),revision:1}});},{P1});
    const chips=()=>page.locator('#myWork [data-mw-who]').evaluateAll(es=>es.map(e=>({v:e.dataset.mwWho,t:e.textContent,on:e.getAttribute('aria-pressed'),h:e.getBoundingClientRect().height})));
    const titles=()=>page.locator('#myWork [data-mw-todo]').evaluateAll(es=>es.map(e=>e.querySelector('.mwTitle').textContent));
    // 기억한 이름이 지금 열린 팀 업무의 담당자에 없어도(퇴사·이름 바꿈) 칩으로 보인다 — 왜 팀 할일이 비었는지 보이게. 팀 업무만 빈다.
    await page.evaluate(()=>localStorage.setItem('hj_mywork_who','가상퇴사'));
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    let c=await chips();
    assert.deepEqual(c.map(x=>x.v+':'+x.on),[':false','가상담당:false','가상동료:false','가상퇴사:true'],'⑩ 기억한 이름이 담당자에 없어도 눌린 칩으로 보인다: '+JSON.stringify(c));
    const teamRows=await page.locator('#myWork [data-mw-todo]').evaluateAll(es=>es.filter(e=>[...e.querySelectorAll('.mwBadge')].some(b=>b.textContent==='팀 업무판')).map(e=>e.querySelector('.mwTitle').textContent));
    assert.deepEqual(teamRows,[],'⑩ 그 사람 팀 업무는 없다 — 팀 업무판 줄이 빈다: '+JSON.stringify(teamRows));
    assert((await titles()).includes('실리콘 사기'),'⑩ 이 기기 할일은 그대로');
    await page.keyboard.press('Escape');await closed(page);
    await page.evaluate(()=>localStorage.removeItem('hj_mywork_who'));
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    c=await chips();
    assert.deepEqual(c.map(x=>x.v+':'+x.t+':'+x.on),[':전체:true','가상담당:가상담당:false','가상동료:가상동료:false'],'⑩ 칩 = 전체 + 담당자들(기한이 내일인 업무의 담당자도), 기억 없으면 전체: '+JSON.stringify(c));
    assert(c.every(x=>x.h>=43.5),'⑩ 칩 44px');
    assert((await titles()).includes('동료 배관 사진 정리'),'⑩ 전체면 모두 보인다');
    await page.locator('[data-mw-who="가상담당"]').click();
    await page.waitForFunction(()=>document.querySelector('#myWork [data-mw-who="가상담당"]')?.getAttribute('aria-pressed')==='true');
    assert(!(await titles()).includes('동료 배관 사진 정리'),'⑩ 가상담당을 고르면 동료 업무는 안 보인다: '+JSON.stringify(await titles()));
    assert.equal(await page.evaluate(()=>localStorage.getItem('hj_mywork_who')),'가상담당','⑩ 이 기기에 기억');
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.mwWho),'가상담당','⑩ 다시 그려도 초점은 누른 칩');
    assert((await titles()).includes('실리콘 사기'),'⑩ 이 기기 할일·팀 공유는 담당자 필터와 무관');
    await page.locator('[data-mw-who="가상동료"]').click();
    await page.waitForFunction(()=>document.querySelector('#myWork [data-mw-who="가상동료"]')?.getAttribute('aria-pressed')==='true');
    assert((await titles()).includes('동료 배관 사진 정리'),'⑩ 가상동료 업무가 보인다');
    await page.locator('[data-mw-teamdone="team-peer"]').click();
    assert.equal(await page.locator('[data-mw-rec="team-peer"]').inputValue(),'가상동료','⑩ 기록자 칸은 고른 사람으로 미리 채운다');
    await page.locator('[data-mw-rec="team-peer"]').fill('가상동료2');assert.equal(await page.locator('[data-mw-rec="team-peer"]').inputValue(),'가상동료2','⑩ 바꿀 수 있다');
    // 닫고 다시 열어도 그대로
    await page.keyboard.press('Escape');await closed(page);
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    c=await chips();assert.equal(c.find(x=>x.on==='true')?.v,'가상동료','⑩ 다음에 열면 기억한 사람: '+JSON.stringify(c));
    assert(!(await titles()).includes('다음 주 점검')&&(await titles()).includes('동료 배관 사진 정리'),'⑩ 기억한 필터가 적용된 채 열린다');
    await page.locator('[data-mw-who=""]').click();
    await page.waitForFunction(()=>document.querySelector('#myWork [data-mw-who=""]')?.getAttribute('aria-pressed')==='true');
    assert.equal(await page.evaluate(()=>localStorage.getItem('hj_mywork_who')),null,'⑩ 전체를 고르면 기억을 지운다');
    assert.equal(await page.locator('[data-mw-rec="team-peer"]').inputValue(),'','⑩ 전체면 기록자 칸은 비어 있다');
    assert.equal(mock.count('sharedTodoSave'),0,'⑩ 서버 쓰기 없음');
    // ⑨ Esc·뒤로가기로 닫으면 하단 버튼으로
    await page.keyboard.press('Escape');await closed(page);
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    await page.evaluate(()=>history.back());await closed(page);
    // 기존 화면으로 가는 길
    await page.locator(NAV).click();await page.locator('#myWork').waitFor();
    await page.locator('#mwLocal').click();await page.locator('#todoText').waitFor();
    await page.keyboard.press('Escape');await closed(page);
    assert.deepEqual(await page.evaluate(()=>__mwUnexpected),[]);
    await context.close();

    // ── 연결 안 된 기기·직원 작업실 미설정: 링크 없음, 공유 버튼 없음
    {const {context,page}=await boot({teamConfigured:false,relay:false});
      const calls=mock.calls.length;
      await page.locator(NAV).click();await page.locator('#myWork').waitFor();
      await page.waitForFunction(()=>/설정 전/.test(document.getElementById('mwTeam')?.textContent||''));
      assert.equal(await page.locator('#mwTeamOpen').count(),0,'⑦ 직원 작업실 미설정이면 링크 없음');
      assert.equal(await page.locator('#mwShared').count(),0);assert.equal(mock.calls.length,calls,'연결 안 되면 서버 호출 없음');
      // ⑧ 빈 화면 + 내일 미리보기
      await page.keyboard.press('Escape');await closed(page);
      await page.evaluate(()=>{state.schedule=state.schedule.filter(s=>s.date!==__mw.today);state.notes=state.notes.filter(n=>!n.todo);});
      await page.locator(NAV).click();await page.locator('#myWork').waitFor();
      const empty=await page.locator('#mwEmpty').innerText();
      assert.match(empty,/오늘은 할 일이 없습니다/);assert.match(empty,/내일 도배/,'⑧ 내일 일정 미리보기');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
      await page.keyboard.press('Escape');await closed(page);
      await context.close();}
    assert.deepEqual(errors,[],'page errors: '+errors.join('\n'));
    console.log('PASS my-work ①~⑩');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
