/* mobile-more-sweep.e2e.js — 더보기 121개 화면을 갤럭시 폭(360×740)으로 전부 실제로 연다 (v329)

   mobile-more-tools 는 121개 메뉴가 '맞는 함수를 부르는지'만 본다(대상 함수를 스텁한다). 그래서 화면 자체가
   폰에서 어떤지는 아무도 안 봤다 — 입력칸 글자 11.5px(iOS 는 16 미만이면 누를 때 화면을 확대한다), 20px 체크박스,
   40px 탭, 옆으로 2px 흔들리는 모달이 그대로 있었다. 이 검사는 대상 함수를 스텁하지 않고 실제로 연다.

   화면마다 지키는 것
     ① 문서 가로 넘침 0, 모달(#modalRoot .modal) scrollWidth-clientWidth ≤ 1
     ② 보이는 button / a[href] / [role=button] / [onclick] / summary(접는 머리) 은 44×44 이상
     ③ 체크박스·라디오는 보이는 네모가 22px 이상이고, 그 자체가 44 이거나 감싼 label 이 44×44 이상
     ④ 보이는 입력칸(input·select·textarea — 체크박스·라디오·range 제외) 글자 16px 이상
     ⑤ Esc 로 닫히고 초점이 연 자리(폰 모드는 하단 [더보기], PC 모드는 검사가 만든 여는 버튼)로 돌아온다
   실행 확인이 필요한 5개(MORE_RUN_CONFIRM)는 확인 모달까지만 연다 — 반출·일괄 변경을 실제로 하지 않는다.
   두 번째 판: 같은 폭에서 폰 모드를 끄고(PC 모드로 폰을 쓰는 경우) 다시 연다 — 전역 규칙의 @media(max-width:640px)
   쪽을 지킨다(설정 기반 body.mobile-mode 만 있으면 이 판에서 떨어진다). 세 번째 판: 폭 768 + 폰 모드 — 반대로
   body.mobile-mode 쪽만 지킨다(360 에서는 두 규칙이 겹쳐 한쪽을 지워도 안 보인다).
   끝으로 보조 글자 색(--muted·.footnote)의 흰 바탕·옅은 바탕 대비가 4.5:1 이상인지 계산한다(WCAG 상대 휘도식).

   외부로 나가는 것(window.open·클립보드·공유·위치·마이크·음성·중계 서버·파일 선택)은 전부 막고 부르면 기록한다 —
   부른 것은 허용목록(ALLOW_EXTERNAL)에 있어야 한다. 가짜 자료만 쓴다(전화 010-0000-1234).
   판정은 종료코드. HJ_SWEEP_ONLY=calc,todo 로 몇 개만 돌릴 수 있다(디버깅용 — 게이트는 전부 돈다).
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const assert=require('node:assert/strict');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const ONLY=(process.env.HJ_SWEEP_ONLY||'').split(',').filter(Boolean);

/* 화면을 띄우지 않는 메뉴 — 고칠 수 없는 예외라 이유를 적는다. 이 둘이 나중에 화면을 띄우면 검사가 떨어진다
   (허용목록이 낡으면 알려 준다). 20개를 넘기면 보고할 것.
   (v330) addproject(브라우저 prompt 한 줄)는 빠졌다 — PROMPT_FLOW 가 prompt 를 스텁해 끝까지 탄다(현장이 실제로 생기고
   그 현장 화면(#view)을 같은 자로 잰다, 취소하면 아무것도 안 생긴다). */
const NO_SCREEN={
  opendrive:'구글 드라이브 만물 폴더를 새 창(window.open)으로 연다 — 앱 밖이다',
  restore:'PC 편집 모드·폴더 연결 전용 — 폰 모드에서는 안내 토스트만 뜬다'
};
/* 모달이 아닌 화면 — 탭을 바꿔 #view 에 그리거나(회계·광고) 전체 화면 시트(AI 비서)를 연다. */
const VIEW_TAB={ledgertab:'ledger',adstab:'ads'};
const SHEET={ai:'#aiSheet'};
/* 더보기 밖에서 여는 모달 [이름, 여는 식, 꼭 그려져야 할 것, 탭 선택자?] — 품목이 그려지는지는 검사 안에서 따로 확인한다.
   네 번째 칸(탭 선택자)이 있으면 그 탭을 하나씩 눌러 탭마다 잰다 — 설정은 첫 탭만 보여 나머지 탭의 접는 머리(summary)를
   아무도 안 쟀다(v330). 고객 페이지는 ⚙ 서버 설정 접는 머리가 12px 글자에 높이 지정이 없었다. */
const EXTRA_MODALS=[['자재 발주서','materialOrder("fake-q1")','.moChk'],
  ['설정 전 탭','openGdriveSetup()','summary','.setTab'],
  ['고객 페이지','portalView("가상 가아파트 101동 1001호")','summary']];
/* 브라우저 prompt 로 받는 메뉴 — [prompt 에 돌려줄 값, 끝난 뒤 확인하는 식(참이어야 함)] */
const PROMPT_FLOW={addproject:['가상 새 현장 스윕','state.projects.some(p=>p.name==="가상 새 현장 스윕")&&state.activeProject==="가상 새 현장 스윕"']};
/* 막아 둔 외부 호출 중 불려도 되는 것 */
const ALLOW_EXTERNAL={opendrive:['window.open']};

/* 화면 한 벌을 재는 함수 — 페이지 안에서 돈다. 반환: 위반 문자열 목록 */
function auditInPage(scopeSel){
  const out=[];const de=document.documentElement;
  const scope=document.querySelector(scopeSel);
  if(!scope)return ['재는 자리가 없다 '+scopeSel];
  function nm(el){return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/).join('.'):'')+' "'+String(el.getAttribute('aria-label')||el.textContent||el.value||'').trim().replace(/\s+/g,' ').slice(0,24)+'"';}
  const docOver=Math.max(de.scrollWidth,document.body.scrollWidth)-de.clientWidth;if(docOver>0)out.push('문서 가로 넘침 '+docOver+'px');
  const modal=document.querySelector('#modalRoot .modal');
  if(modal){const o=modal.scrollWidth-modal.clientWidth;if(o>1){const mr=modal.getBoundingClientRect();const w=[...modal.querySelectorAll('*')].map(e=>[e.getBoundingClientRect().right-mr.right,e]).sort((a,b)=>b[0]-a[0])[0];out.push('모달 가로 넘침 '+o+'px (가장 삐져나간 것: '+(w?nm(w[1]):'?')+')');}}
  const vis=el=>{if(!el.getClientRects().length)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none';};
  for(const el of scope.querySelectorAll('button,a[href],[role=button],[onclick],summary')){
    if(el.matches('input,select,textarea,label'))continue;if(!vis(el))continue;
    const r=el.getBoundingClientRect();if(r.width<43.5||r.height<43.5)out.push('누르는 곳 '+Math.round(r.width)+'×'+Math.round(r.height)+' '+nm(el));
  }
  for(const el of scope.querySelectorAll('input[type=checkbox],input[type=radio]')){
    if(!vis(el))continue;const r=el.getBoundingClientRect();
    // 보이는 네모는 22px 이상(투명하게 겹쳐 누르는 곳만 넓힌 input — 사진 칸 선택 — 은 그림이 따로 있다)
    if(getComputedStyle(el).opacity!=='0'&&(r.width<21.5||r.height<21.5))out.push('체크 네모 '+Math.round(r.width)+'×'+Math.round(r.height)+' (<22) '+nm(el));
    if(r.width>=43.5&&r.height>=43.5)continue;
    const lb=el.closest('label');const lr=lb&&lb.getBoundingClientRect();if(lr&&lr.height>=43.5&&lr.width>=43.5)continue;
    out.push('체크 '+Math.round(r.width)+'×'+Math.round(r.height)+' 감싼 label '+(lr?Math.round(lr.width)+'×'+Math.round(lr.height):'없음')+' '+nm(el));
  }
  for(const el of scope.querySelectorAll('input,select,textarea')){
    if(el.matches('[type=checkbox],[type=radio],[type=range],[type=hidden],[type=file],[type=color],[type=button],[type=submit],[type=reset],[type=image]'))continue;if(!vis(el))continue;
    const fs=parseFloat(getComputedStyle(el).fontSize);if(fs<15.95)out.push('입력 글자 '+fs+'px '+nm(el));
  }
  return out;
}

let browser;const failures=[];
async function boot(mobile,width=360){
  const context=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(mobile=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));localStorage.setItem('pref_mobile',mobile?'1':'0');},mobile);
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
  await page.evaluate(async({mobile,audit})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);
    window.__sweepAudit=(0,eval)('('+audit+')');
    aiOpsEnsureState().enabled=false;
    // 부팅 시더를 재운다 — 한복판에 일정을 심어 화면이 바뀌면 같은 메뉴가 판마다 다르게 보인다(AGENTS.md 검사 함정).
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;
    if(typeof backupBootCheck==='function')backupBootCheck=()=>0;if(typeof kakaoCheckNew==='function')kakaoCheckNew=()=>0;
    const P='가상 가아파트 101동 1001호',Q='가상 나아파트',TEL='010-0000-1234';
    const p=name=>({name,stage:2,received:12345,phases:['방수'],cost:{material:100,labor:200,outsource:0},customer:{name:'가상 고객',phone:TEL,addr:'대전 가상동 1'},archived:false});
    state.projects=[p(P),p(Q)];
    state.files=Array.from({length:6},(_,i)=>({id:'fake-photo-'+i,name:'가상 사진 '+i+'.jpg',kind:'photo',ext:'jpg',size:101+i,project:i<4?P:'',when:new Date('2026-09-01T00:00:00Z'),_virtual:true,_phase:i===0?'시공 전':i===1?'완료':''}));
    // 견적이 있어야 협상·유사 견적·계약 검토·공정표가 '견적 고르기' 화면을 띄운다(없으면 토스트만).
    state.quotes=[1,2].map(i=>({id:'fake-q'+i,title:'가상 견적 '+i,no:'FAKE-'+i,date:'2026-09-0'+i,createdAt:'2026-09-01T00:00:00.000Z',project:P,customer:{name:'가상 고객',phone:TEL,addr:''},items:[{cat:'욕실',name:'가상 방수',qty:1,unit:'식',price:100000}],memo:''}));
    // 거래처 📞·일정 전화·할일 체크박스가 실제로 그려지게(비어 있으면 재는 것이 없다).
    state.suppliers=[{name:'가상 철물',phone:TEL,category:'자재',items:'피스'}];
    const today=new Date().toISOString().slice(0,10);
    state.schedule=[{id:'fake-sch',date:today,time:'09:00',title:'가상 실측',project:P,memo:''}];
    state.notes=[{id:'fake-todo-1',date:today,day:today,text:'가상 할일',project:P,todo:true,done:false},{id:'fake-todo-2',date:today,day:today,text:'가상 끝낸 일',project:P,todo:true,done:true,doneAt:today}];
    state.payLog=[{id:'fake-pay',project:P,date:'2026-09-01',amount:12345}];
    state.activeProject=P;state.tab='photos';
    __gdToken=null;relayReady=()=>false;__mobileMode=mobile;applyMobileMode();
    window.__sweepExternal=[];
    const reject=name=>function(){window.__sweepExternal.push(name);throw new Error('blocked external '+name);};
    window.open=function(){window.__sweepExternal.push('window.open');return null;};   // 던지면 앱이 location.href 로 넘어가 페이지가 사라진다 — 막힌 팝업처럼 null
    window.showOpenFilePicker=reject('filePicker');window.showDirectoryPicker=reject('directoryPicker');window.showSaveFilePicker=reject('savePicker');
    if(navigator.share)navigator.share=reject('share');if(navigator.clipboard){navigator.clipboard.writeText=reject('clipboard');navigator.clipboard.write=reject('clipboard');}
    if(navigator.geolocation){navigator.geolocation.getCurrentPosition=reject('geolocation');navigator.geolocation.watchPosition=reject('geolocation');}
    if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=reject('microphone');
    window.SpeechRecognition=reject('speech');window.webkitSpeechRecognition=reject('speech');
    if(window.speechSynthesis)window.speechSynthesis.speak=reject('tts');
    relayCall=reject('relay');portalAutoSync=reject('portalSync');getFileOf=reject('originalFile');
    window.prompt=()=>null;window.confirm=()=>false;window.alert=()=>{};
    const nativeClick=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){window.__sweepExternal.push('fileInput');return;}return nativeClick.call(this);};
    render();
  },{mobile,audit:auditInPage.toString()});
  return {context,page,errors};
}

async function sweep(page,errors,mobile,width=360){
  const tag=(mobile?'폰 모드':'PC 모드')+' 폭 '+width;
  const actions=await page.evaluate(()=>MORE_CATS.flatMap(c=>c.items.map(i=>i[0])));
  assert.equal(actions.length,121,'더보기 기능 수(행동 계약 121)');
  const confirmSet=await page.evaluate(()=>Object.keys(MORE_RUN_CONFIRM));
  assert.equal(confirmSet.length,5);
  const before=failures.length;let opened=0;
  // 더보기 시트 자체(검색칸·즐겨찾기·분류 칩)도 같은 자로 잰다 — 모든 분류를 펼친 채로.
  if(!ONLY.length){
    const v=await page.evaluate(async()=>{openMoreSheetV2(document.querySelector('[data-mnav="__more"]'));const until=Date.now()+5000;while(!document.getElementById('moreSheet')){if(Date.now()>until)return ['더보기 시트가 안 열린다'];await new Promise(r=>setTimeout(r,16));}
      document.querySelectorAll('#moreSheet details').forEach(d=>d.open=true);const r=__sweepAudit('#moreSheet');document.getElementById('moreSheetClose').click();return r;});
    for(const x of v){failures.push('['+tag+'] 더보기 시트: '+x);console.error('  ✗ ['+tag+'] 더보기 시트: '+x);}
    await page.waitForFunction(()=>!document.getElementById('moreSheet')&&!window.__mobileSheetHistoryRetire);
  }
  // 바로가기 탭(#view 에 그리는 첫 화면들)도 같은 자로 잰다 — 더보기 화면은 모달이라 여기 규칙(사진 칸 선택 네모·연락처 📞)은 안 지나간다.
  if(!ONLY.length)for(const tab of ['photos','docs','estimates','quotemaker','contacts','project','aptmgmt']){
    const got=await page.evaluate(tab=>{state.tab=tab;render();return state.tab;},tab);
    if(got!==tab){failures.push('['+tag+'] 탭 '+tab+': 안 열린다');continue;}
    for(const x of await page.evaluate(s=>__sweepAudit(s),'#view')){failures.push('['+tag+'] 탭 '+tab+': '+x);console.error('  ✗ ['+tag+'] 탭 '+tab+': '+x);}
  }
  /* 더보기 첫 화면이 아닌 모달 — 다른 화면의 버튼(견적 #qmOrder·재고·명령 목록)으로만 열려 위 순회가 닿지 않는다.
     📦 자재 발주서의 품목 체크(.moChk)가 label 없이 맨 input 이었던 것을 이 자리가 잡는다(v329 검토). */
  if(!ONLY.length)for(const [name,open,must,tabs] of EXTRA_MODALS){
    const v=await page.evaluate(async ({open,must,tabs})=>{(0,eval)(open);const until=Date.now()+5000;while(!document.querySelector('#modalRoot .modal')){if(Date.now()>until)return ['안 열린다'];await new Promise(r=>setTimeout(r,16));}
      const r=__sweepAudit('#modalRoot');if(!document.querySelector('#modalRoot '+must))r.push('잴 것('+must+')이 안 그려졌다 — 시드를 확인');
      if(tabs){const ts=[...document.querySelectorAll('#modalRoot '+tabs)];if(ts.length<2)r.push('탭('+tabs+')이 둘 이상 없다');
        for(const t of ts){t.click();await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));for(const x of __sweepAudit('#modalRoot'))r.push('['+(t.textContent||'').trim()+' 탭] '+x);}}
      closeModal(true);return [...new Set(r)];},{open,must,tabs});
    for(const x of v){failures.push('['+tag+'] '+name+': '+x);console.error('  ✗ ['+tag+'] '+name+': '+x);}
    await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);
  }
  for(const action of actions){
    if(ONLY.length&&!ONLY.includes(action))continue;
    await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire&&!window.__mobileSheetHistoryDeferredOpen&&!document.querySelector('#modalRoot .modal'));
    const res=await page.evaluate(async action=>{
      const wait=async(test,ms=6000)=>{const until=Date.now()+ms;while(!test()){if(Date.now()>until)return false;await new Promise(r=>setTimeout(r,16));}return true;};
      if(state.tab!=='photos'){state.tab='photos';render();}
      state.activeProject='가상 가아파트 101동 1001호';
      window.__sweepExternal.length=0;
      // 폰 모드는 하단 [더보기]가 연다. PC 모드(폭 360)에는 하단 메뉴가 없어 검사가 만든 여는 버튼으로 같은 길(moreOpenFeature)을 탄다.
      let nav=document.querySelector('[data-mnav="__more"]');
      if(!nav.getClientRects().length){nav=document.getElementById('sweepOpener');if(!nav){nav=document.createElement('button');nav.id='sweepOpener';nav.type='button';nav.textContent='여는 자리';nav.style.cssText='position:fixed;left:0;bottom:0;z-index:1';document.body.appendChild(nav);}}
      nav.focus();
      const nativeDispatch=moreDispatch;let pending=null;moreDispatch=function(a){pending=Promise.resolve(nativeDispatch(a));return pending;};
      try{
        if(nav.id==='sweepOpener'){if(!moreItemInfo(action))return {missing:true};moreOpenFeature(action,nav);}
        else{
          openMoreSheetV2(nav);await wait(()=>!!document.getElementById('moreSheet'));
          const chip=document.querySelector('.more-cat-block [data-moreaction="'+action+'"]');if(!chip)return {missing:true};
          chip.closest('details').open=true;chip.click();
        }
        await wait(()=>!!pending||!!document.getElementById('moreRunConfirm'));
        const confirmOnly=!!document.getElementById('moreRunConfirm');
        if(pending)await Promise.race([pending,new Promise(r=>setTimeout(r,5000))]);
        // 비동기 그리기(모달 안 목록 채우기 등)가 끝날 틈 — 두 프레임 + 한 틱. 끝 신호가 화면마다 달라 공통 대기로 둔다.
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,50));
        const modal=!!document.querySelector('#modalRoot .modal');
        const sheet=[...document.querySelectorAll('#aiSheet')].some(e=>e.getClientRects().length);
        return {confirmOnly,modal,sheet,tab:state.tab,external:[...window.__sweepExternal]};
      }finally{moreDispatch=nativeDispatch;}
    },action);
    const fail=m=>{failures.push('['+tag+'] '+action+': '+m);console.error('  ✗ ['+tag+'] '+action+': '+m);};
    if(process.env.HJ_SWEEP_VERBOSE)console.log('  · '+tag+' '+action+' '+JSON.stringify(res));
    if(res.missing){fail('더보기에 칩이 없다');continue;}
    const allowedExt=ALLOW_EXTERNAL[action]||[];
    for(const x of res.external)if(!allowedExt.includes(x))fail('막아 둔 외부 호출 '+x);
    if(res.confirmOnly!==confirmSet.includes(action))fail('실행 확인 모달 여부가 MORE_RUN_CONFIRM 과 다르다');
    let scope=null;
    if(res.modal)scope='#modalRoot';
    else if(SHEET[action]&&res.sheet)scope=SHEET[action];
    else if(VIEW_TAB[action]&&res.tab===VIEW_TAB[action])scope='#view';
    if(PROMPT_FLOW[action]){
      // prompt 를 스텁해 한 번은 취소(아무것도 안 생김), 한 번은 값을 넣는다. 그다음 그려진 #view 를 같은 자로 잰다.
      // 위에서 [더보기] 칩으로 한 번 이미 눌렀다(전역 prompt 스텁은 null = 취소) — 그때 무엇이든 생겼으면 취소가 안 먹은 것이다.
      const pr=await page.evaluate(async ({action,val,ok})=>{const leaked=state.projects.some(p=>p.name===val);state.projects=state.projects.filter(p=>p.name!==val);
        const n0=state.projects.length;const keep=window.prompt;let asked=0;
        const run=async(ret)=>{window.prompt=(m)=>{asked++;return ret;};try{await Promise.resolve(moreActionHandler(action));}finally{window.prompt=keep;}};
        await run(null);const cancelKept=state.projects.length===n0;
        await run(val);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const done=!!(0,eval)(ok);const audit=__sweepAudit('#view');
        state.projects=state.projects.filter(p=>p.name!==val);state.activeProject='가상 가아파트 101동 1001호';render();
        return {asked,cancelKept:cancelKept&&!leaked,done,audit};},{action,val:PROMPT_FLOW[action][0],ok:PROMPT_FLOW[action][1]});
      if(pr.asked!==2)fail('prompt 가 '+pr.asked+'번 불렸다(2 기대)');
      if(!pr.cancelKept)fail('prompt 를 취소했는데 현장이 생겼다');
      if(!pr.done)fail('prompt 에 넣은 값으로 끝나지 않았다');
      for(const x of pr.audit)fail('(추가 뒤 화면) '+x);
      opened++;continue;
    }
    if(NO_SCREEN[action]){
      if(scope)fail('허용목록(화면 없음)에 있는데 화면이 열렸다 — 허용목록을 지우고 이 화면을 재라');
      for(const x of (await page.evaluate(s=>__sweepAudit(s),'#view')).filter(x=>x.startsWith('문서')))fail(x);
      continue;
    }
    if(!scope){fail('화면이 안 열렸다(모달·시트·탭 어느 것도) — tab='+res.tab);continue;}
    opened++;
    for(const x of await page.evaluate(s=>__sweepAudit(s),scope))fail(x);
    // ⑤ 닫기와 초점 — 탭 화면(#view)은 닫을 것이 없다
    const closeSel=res.modal?'#modalRoot .modal':scope===SHEET[action]?SHEET[action]:null;
    if(closeSel){
      await page.keyboard.press('Escape');
      const closed=await page.waitForFunction(sel=>{const e=document.querySelector(sel);return (!e||!e.getClientRects().length)&&!window.__mobileSheetHistoryRetire;},closeSel,{timeout:3000}).then(()=>true,()=>false);
      if(!closed){fail('Esc 로 안 닫힌다');await page.evaluate(()=>{try{closeModal(true);}catch(e){}try{aiHide();}catch(e){}});}
      else{
        const back=await page.waitForFunction(()=>document.activeElement&&document.activeElement.matches('[data-mnav="__more"],#sweepOpener'),null,{timeout:2000}).then(()=>true,()=>false);
        if(!back)fail('닫은 뒤 초점이 [더보기]로 안 돌아온다: '+await page.evaluate(()=>{const a=document.activeElement;return a?a.tagName+'#'+a.id:'없음';}));
      }
    }
  }
  if(errors.length)failures.push('['+tag+'] pageerror: '+errors.slice(0,5).join(' | '));
  const expectOpened=(ONLY.length?ONLY:actions).filter(a=>!NO_SCREEN[a]).length;   // PROMPT_FLOW 도 '연 화면'으로 센다
  if(opened!==expectOpened)failures.push('['+tag+'] 연 화면 '+opened+' ≠ 기대 '+expectOpened);
  console.log((failures.length===before?'PASS ':'FAIL ')+tag+': 화면 '+opened+'개 열어 잼(화면 없음 허용 '+Object.keys(NO_SCREEN).length+'개)');
}

async function fontRules(page,tag){
    // 전역 규칙이 인라인 글자 크기를 이기는지(113곳이 인라인 10~15px)
    const inline=await page.evaluate(()=>{openModal('인라인','<input id="pi2" type="text" style="font-size:11px"><select id="ps2" style="font-size:10px"><option>x</option></select><textarea id="pt2" style="font-size:12px"></textarea>');const r=['pi2','ps2','pt2'].map(id=>getComputedStyle(document.getElementById(id)).fontSize);closeModal(true);return r;});
    assert.deepEqual(inline,['16px','16px','16px'],tag+': 전역 규칙이 인라인 font-size 를 16px 로 올린다');
    // 큰 글씨 단계에서는 16 이 바닥이지 천장이 아니다 — 원래 비율(1.06em·1.12em)이 살아 있어야 한다.
    const big=await page.evaluate(()=>{const out={};for(const k of ['a11y-big1','a11y-big2']){document.body.classList.add(k);openModal('큰 글씨','<div id="bw"><input id="bi" type="text" style="font-size:11px"></div>');const parent=parseFloat(getComputedStyle(document.getElementById('bw')).fontSize);out[k]={input:parseFloat(getComputedStyle(document.getElementById('bi')).fontSize),parent};closeModal(true);document.body.classList.remove(k);}return out;});
    for(const [k,f] of [['a11y-big1',1.06],['a11y-big2',1.12]])assert(Math.abs(big[k].input-Math.max(16,big[k].parent*f))<0.6,tag+' 큰 글씨 '+k+': 입력 글자 '+big[k].input+'px ≠ max(16, '+f+'em='+(big[k].parent*f).toFixed(1)+')');
  await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire);
}

/* 보조 글자 대비 — WCAG 2.x 상대 휘도: 채널을 감마 풀고 L=0.2126R+0.7152G+0.0722B, 대비=(밝은L+0.05)/(어두운L+0.05) */
function lum(rgb){const c=rgb.map(v=>v/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
const parseRgb=s=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);if(!m)throw new Error('색을 못 읽음 '+s);return [1,2,3].map(i=>Number(m[i]));};

(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  const t0=Date.now();
  // 계산식 자가진단 — 흰 바탕 검정 21:1, 같은 색 1:1
  assert.equal(ratio([0,0,0],[255,255,255]).toFixed(1),'21.0');assert.equal(ratio([90,90,90],[90,90,90]),1);
  {const {context,page,errors}=await boot(true);
    // 재는 함수 자가진단 — 작은 버튼·작은 체크·(!important 로 규칙을 이긴) 작은 입력칸을 그려 셋 다 잡히는지.
    const probe=await page.evaluate(()=>{openModal('자가진단','<button id="pb" style="min-width:0!important;min-height:0!important;width:20px!important;height:20px!important;padding:0!important">x</button><input id="pi" type="text" style="font-size:11px!important"><span><input id="pc" type="checkbox" style="min-width:0!important;min-height:0!important;width:13px!important;height:13px!important"></span><p style="width:600px">넘침</p>');const r=__sweepAudit('#modalRoot');closeModal(true);return r;});
    for(const k of ['누르는 곳 20×20','입력 글자 11px','체크 13×13','체크 네모 13×13','모달 가로 넘침'])assert(probe.some(x=>x.startsWith(k)),'자가진단: '+k+' 를 못 잡는다 '+JSON.stringify(probe));
    await fontRules(page,'폰 모드 폭 360');
    await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire);
    // 대비 — 실제로 계산된 색으로
    const cs=await page.evaluate(()=>{const f=document.createElement('div');f.className='footnote';f.textContent='x';const m=document.createElement('span');m.style.color='var(--muted)';m.textContent='x';document.body.append(f,m);const r={foot:getComputedStyle(f).color,muted:getComputedStyle(m).color,paper:getComputedStyle(document.body).backgroundColor,paper2:getComputedStyle(document.documentElement).getPropertyValue('--paper-2').trim()};f.remove();m.remove();return r;});
    const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
    for(const [name,col] of [['--muted',cs.muted],['.footnote',cs.foot]])for(const [bg,val] of [['흰 바탕',parseRgb(cs.paper)],['옅은 바탕 --paper-2',hex(cs.paper2)]]){
      const r=ratio(parseRgb(col),val);if(r<4.5)failures.push('대비 '+name+' '+col+' / '+bg+' = '+r.toFixed(2)+':1 (<4.5)');
    }
    console.log('대비: --muted '+cs.muted+' 흰 바탕 '+ratio(parseRgb(cs.muted),parseRgb(cs.paper)).toFixed(2)+':1 · 옅은 바탕 '+ratio(parseRgb(cs.muted),hex(cs.paper2)).toFixed(2)+':1, .footnote '+cs.foot);
    await sweep(page,errors,true);await context.close();}
  {const {context,page,errors}=await boot(false);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('mobile-mode')),false,'두 번째 판은 폰 모드가 꺼져 있어야 @media 규칙을 잰다');
    await fontRules(page,'PC 모드 폭 360');await sweep(page,errors,false);await context.close();}
  // 세 번째 판: 폭 768 에서 폰 모드(태블릿·접는 폰을 폰 모드로 쓰는 경우). 360 에서는 @media 규칙이 같이 걸려
  // body.mobile-mode 쪽 규칙을 지워도 아무 판도 안 떨어진다 — 이 판이 그쪽을 따로 지킨다.
  {const {context,page,errors}=await boot(true,768);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('mobile-mode')&&!matchMedia('(max-width:640px)').matches),true,'세 번째 판은 폰 모드 + 640 초과 폭');
    await fontRules(page,'폰 모드 폭 768');await sweep(page,errors,true,768);await context.close();}
  await browser.close();
  if(failures.length){console.error('FAIL mobile-more-sweep — 위반 '+failures.length+'건');for(const f of failures)console.error('  '+f);process.exitCode=1;return;}
  console.log('== mobile-more-sweep: 폰 모드 360·PC 모드 360·폰 모드 768 각 121개 메뉴 — 위반 0 · 화면 없음 허용 '+Object.keys(NO_SCREEN).length+'개 · '+Math.round((Date.now()-t0)/1000)+'초 ==');
})().catch(async e=>{console.error('FAIL mobile-more-sweep',e);if(browser)await browser.close();process.exitCode=1;});
