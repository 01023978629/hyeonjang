/* web-work-bridge.e2e.js — 공개 웹 3종 이메일을 원문/URL 없이 대표 승인 뒤에만 현장으로 바꾼다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = source.indexOf('/* ═══ 웹 업무 연결 센터');
const end = source.indexOf('/* ═══ /웹 업무 연결 센터 ═══ */');
assert.ok(start > 0 && end > start, 'web-work bridge source region exists');
const bridge = source.slice(start, end);

assert.match(source, /\['webbridge','📥','웹 업무 연결'\]/, 'more menu exposes the bridge');
assert.match(source, /a==='webbridge'\)webWorkCenterOpen\(\)/, 'more action routes to the bridge');
assert.match(bridge, /const LEAD_INBOX_URL='https:\/\/01023978629\.github\.io\/manmool\/lead-inbox\.html';/, 'bridge links to the public inquiry inbox page');
assert.match(bridge, /<a href="'\+LEAD_INBOX_URL\+'" target="_blank" rel="noopener noreferrer"/, 'inbox link opens a new tab with noopener and never reads the inbox automatically');
for (const forbidden of ['location', 'navigator.clipboard', 'clipboard.read', 'fetch(', 'localStorage', 'sessionStorage', 'idbSet(', 'idbGet(', 'officeIntakeAccept(', 'officeIntakeOrderFromRequest(', 'state.aptOrders']) {
  assert.equal(bridge.includes(forbidden), false, 'bridge must not use forbidden automatic ingress/storage/action: ' + forbidden);
}
assert.ok(bridge.indexOf("await hjSnapshot('웹 업무 연결 등록 전'") < bridge.indexOf('state.projects=priorProjects.concat'), 'snapshot precedes state mutation');
assert.ok(bridge.indexOf('await guardedPersistCurrentState()') > bridge.indexOf('state.projects=priorProjects.concat'), 'registration awaits durable local persistence after mutation');
assert.match(bridge, /crypto\.subtle\.digest\('SHA-256'/, 'deterministic cryptographic inquiry id');
assert.match(bridge, /sourceInquiryId:draft\.id/, 'project preserves additive dedupe id');
assert.match(bridge, /sourceService:draft\.service/, 'project preserves service classification');
assert.match(bridge, /sourceInquiryOrigin:draft\.sourceOrigin/, 'project preserves validated public source');
assert.match(bridge, /officeIntakeSync\(\{source:'manual'\}\)/, 'office inbox refresh is explicit');
assert.match(bridge, /officeIntakeOpen\(\)/, 'office staff intake reuses the review inbox');

const FIXTURES = {
  interior: `[만물인테리어 상담 신청]
이름: A&B 고객
연락처: 042-123-4567
공간: 주거 · 34평 · 대전 유성구
범위: 전체 리모델링 · 욕실,주방
예산/시기: 5천만원대 · 2026년 10월
관심 디자인: 따뜻한 우드
접수 경로: website
유입 페이지: https://example.invalid/index.html
신청 진입점: hero-consult
UTM Source: local-test
개인정보 수집·이용 동의: 동의
메모: 실측 상담을 원합니다.`,
  leak: `[만물인테리어 상담 신청]
연락처: 02-1234-5678
공간: 누수 · 대전 서구 아파트
증상: 아랫집 천장에 물자국, 계량기 움직임
신청 목적: 유상 장비진단·방문 일정 상담
희망 일정: 2026-09-03 · 오전
예약 상태: inquiry-only
참고 사례: 천장 누수 원인 점검
접수 경로: leak-page
유입 페이지: https://example.invalid/leak.html
개인정보 수집·이용 동의: 동의
메모: 이름은 선택 입력이라 비워 두었습니다.`,
  office: `[만물인테리어 상담 신청]
연락처: 070-1234-5678
단지명: 테스트 한빛아파트
관리사무소 담당자: 시설 담당자
지역: 대전 중구
관심 업무: 누수·배관, 공용부 보수, 예방점검
도입 희망 시점: 2026년 9월 협의
공간: 관리사무소 30일 시험운영
접수 경로: office-pilot
유입 페이지: https://example.invalid/office.html
신청 진입점: office-pilot-submit
UTM Source: local-test
UTM Medium: referral
UTM Campaign: office-pilot
개인정보 수집·이용 동의: 동의
문의 내용: 입주민 정보 없이 시험 운영 상담을 원합니다.`
};
FIXTURES.inbox = FIXTURES.leak + '\n접수번호: LD-20260903-0007';

let browser;
(async () => {
  const launchOpts = process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {};
  if (!launchOpts.executablePath && process.platform !== 'win32') launchOpts.executablePath = '/opt/pw-browsers/chromium';
  browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^http:\/\/(?:localhost|127\.0\.0\.1):8299\//.test(url)) return route.continue();
    return route.abort();
  });
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof webWorkParse === 'function' && typeof officeIntakeData === 'function');

  const parsed = await page.evaluate(async fixtures => {
    const pick = value => ({
      service:value.service, phone:value.fields.phone, name:value.fields.name || '',
      officeContactName:value.fields.officeContactName || '', complexName:value.fields.complexName || '',
      region:value.region, intakeSource:value.fields.intakeSource,
      hasDiscardedUrl:Object.keys(value.fields).some(key => key.startsWith('discard')) || JSON.stringify(value.fields).includes('example.invalid')
    });
    const a=webWorkParse(fixtures.interior), b=webWorkParse(fixtures.leak), c=webWorkParse(fixtures.office);
    const d1=await webWorkDraftFromText(fixtures.office),d2=await webWorkDraftFromText(fixtures.office);
    const baseCanonical=webWorkCanonical(c);
    const canonicalFields=WEB_WORK_FIELD_ORDER.map(key => {
      const changed={...c,fields:{...c.fields,[key]:(c.fields[key]||'')+' changed '+key}};
      return {key,changed:webWorkCanonical(changed)!==baseCanonical};
    });
    const linked=webWorkParse(fixtures.interior.replace('\uC2E4\uCE21 \uC0C1\uB2F4\uC744 \uC6D0\uD569\uB2C8\uB2E4.','ftp://evil.invalid file://local/secret mailto:test@evil.invalid x://localhost/private bare.example/path 만물.한국/secret 홍길동@예시.한국 \uC81C\uC678'));
    return {
      interior:pick(a), leak:pick(b), office:pick(c), sameId:d1.id===d2.id, id:d1.id, customerName:d1.customerName,
      canonicalFields,linkedFields:JSON.stringify(linked.fields)
    };
  }, FIXTURES);
  assert.deepEqual(parsed.interior, {service:'interior',phone:'042-123-4567',name:'A&B 고객',officeContactName:'',complexName:'',region:'대전 유성구',intakeSource:'website',hasDiscardedUrl:false});
  assert.deepEqual(parsed.leak, {service:'leak-pipe',phone:'02-1234-5678',name:'',officeContactName:'',complexName:'',region:'대전 서구 아파트',intakeSource:'leak-page',hasDiscardedUrl:false});
  assert.deepEqual(parsed.office, {service:'office-sales',phone:'070-1234-5678',name:'',officeContactName:'시설 담당자',complexName:'테스트 한빛아파트',region:'대전 중구',intakeSource:'office-pilot',hasDiscardedUrl:false});
  assert.equal(parsed.sameId, true, 'same sanitized inquiry yields same id');
  assert.match(parsed.id, /^webmail-[a-f0-9]{64}$/);
  assert.equal(parsed.customerName, '시설 담당자', 'office contact is the customer display name');

  assert.equal(parsed.canonicalFields.length, 22, 'canonical field contract covers every declared field');
  assert.equal(parsed.canonicalFields.every(item => item.changed), true, 'every canonical field changes the dedupe id input');
  assert.doesNotMatch(parsed.linkedFields, /evil\.invalid|file:\/\/|mailto:|x:\/\/|bare\.example|만물\.한국|예시\.한국/i, 'all URI schemes, email links and internationalized bare domains are removed before persistence');

  const rejection = await page.evaluate(fixtures => {
    const mutate = (base, from, to) => base.replace(from, to);
    const cases = {
      unknown:mutate(fixtures.interior, '메모:', '비밀라벨:'),
      duplicate:fixtures.interior+'\n이름: 중복',
      html:mutate(fixtures.interior, 'A&B 고객', '<img src=x>'),
      oversize:fixtures.interior+'\n'.padEnd(8100, 'x'),
      noConsent:fixtures.interior.replace('\n개인정보 수집·이용 동의: 동의',''),
      declined:mutate(fixtures.leak, '개인정보 수집·이용 동의: 동의', '개인정보 수집·이용 동의: 미동의'),
      sourceMismatch:mutate(fixtures.office, '접수 경로: office-pilot', '접수 경로: website'),
      officeMissing:fixtures.office.replace('\n단지명: 테스트 한빛아파트',''),
      badReceipt:fixtures.interior+'\n접수번호: 7'
    };
    return Object.fromEntries(Object.entries(cases).map(([key,text]) => {
      try { webWorkParse(text); return [key,'accepted']; }
      catch (error) { return [key,error && error.code]; }
    }));
  }, FIXTURES);
  assert.deepEqual(rejection, {unknown:'web-work-invalid',duplicate:'web-work-invalid',html:'web-work-invalid',oversize:'web-work-invalid',noConsent:'web-work-invalid',declined:'web-work-invalid',sourceMismatch:'web-work-invalid',officeMissing:'web-work-invalid',badReceipt:'web-work-invalid'}, 'strict parser rejects malformed, non-consented and mismatched-source mail');

  const before = await page.evaluate(() => {
    state.projects=[];state.notes=[];state.aptOrders=[];
    state.officeIntake={inbox:[{requestId:'waiting-1',status:'pending_review',createdAt:'2026-08-01T00:00:00Z'}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    webWorkCenterOpen();
    return {projects:state.projects.length,notes:state.notes.length,orders:state.aptOrders.length,cards:document.querySelectorAll('[data-web-work-service]').length,maxlength:document.getElementById('webWorkPaste').maxLength,office:document.getElementById('webWorkOfficeSummary').textContent};
  });
  assert.deepEqual({projects:before.projects,notes:before.notes,orders:before.orders,cards:before.cards,maxlength:before.maxlength},{projects:0,notes:0,orders:0,cards:3,maxlength:8000});
  assert.match(before.office, /대기 1건/);

  await page.locator('#webWorkPaste').fill(FIXTURES.interior);
  await page.locator('#webWorkParse').click();
  await page.waitForSelector('[data-web-work-preview]');
  const preview = await page.evaluate(() => ({
    projects:state.projects.length,notes:state.notes.length,orders:state.aptOrders.length,
    rawTextarea:!!document.getElementById('webWorkPaste') && document.getElementById('webWorkPaste').value,
    html:document.querySelector('[data-web-work-preview]').innerHTML,
    text:document.querySelector('[data-web-work-preview]').textContent
  }));
  assert.deepEqual({projects:preview.projects,notes:preview.notes,orders:preview.orders},{projects:0,notes:0,orders:0},'preview causes no business-state mutation');
  assert.notEqual(preview.rawTextarea, FIXTURES.interior, 'raw textarea is cleared/removed before preview');
  assert.match(preview.html, /A&amp;B 고객/, 'preview escapes structured values');
  assert.match(preview.text, /A&B 고객/);

  const closedPreview = await page.evaluate(() => {
    document.querySelector('#modalRoot .modal-close').click();
    return {draft:__webWorkDraft,modal:!!document.querySelector('#modalRoot .modal')};
  });
  assert.deepEqual(closedPreview,{draft:null,modal:false},'every preview close path clears the PII draft');

  const cancelledParse = await page.evaluate(async fixture => {
    webWorkCenterOpen();
    const paste=document.getElementById('webWorkPaste'),parse=document.getElementById('webWorkParse');
    paste.value=fixture;
    const originalHash=webWorkSha256Hex;
    let releaseHash,markStarted;
    const started=new Promise(resolve => { markStarted=resolve; });
    const blocked=new Promise(resolve => { releaseHash=resolve; });
    webWorkSha256Hex=async () => { markStarted(); return blocked; };
    parse.click();await started;
    document.querySelector('#modalRoot .modal-close').click();
    releaseHash('0'.repeat(64));await new Promise(resolve => setTimeout(resolve,0));
    webWorkSha256Hex=originalHash;
    return {draft:__webWorkDraft,modal:!!document.querySelector('#modalRoot .modal'),pasteConnected:paste.isConnected};
  }, FIXTURES.leak);
  assert.deepEqual(cancelledParse,{draft:null,modal:false,pasteConnected:false},'closing during async hashing invalidates the parse and cannot reopen PII preview');

  await page.evaluate(() => webWorkCenterOpen());
  await page.locator('#webWorkPaste').fill(FIXTURES.interior);
  await page.locator('#webWorkParse').click();
  await page.waitForSelector('[data-web-work-preview]');

  const registered = await page.evaluate(async () => {
    const events=[];
    hjSnapshot=async () => { events.push('snapshot'); return true; };
    guardedPersistCurrentState=async () => { events.push('persist'); return true; };
    webWorkMarkDirtyAfterPersist=() => events.push('post-persist');render=() => events.push('render');
    const draft=__webWorkDraft,ok=await webWorkRegister(draft.id);
    return {ok,events,projects:state.projects,notes:state.notes,serialized:JSON.stringify({projects:state.projects,notes:state.notes})};
  });
  assert.equal(registered.ok, true);
  assert.deepEqual(registered.events, ['snapshot','persist','post-persist','render'], 'explicit registration snapshots, durably persists, then triggers background sync and render');
  assert.equal(registered.projects.length, 1);
  assert.equal(registered.projects[0].stage, 0);
  assert.equal(registered.projects[0].source, 'web3forms-email');
  assert.equal(registered.projects[0].sourceService, 'interior');
  assert.equal(registered.projects[0].sourceInquiryOrigin, 'website');
  assert.match(registered.notes[0].text, /개인정보 동의: 동의/);
  assert.doesNotMatch(registered.serialized, /\[만물인테리어 상담 신청\]|example\.invalid/, 'raw email/header and external URL are not persisted');

  // 접수함(lead-inbox)이 붙인 접수번호: 현장에 남고, 같은 번호는 본문이 달라도 두 번 등록되지 않는다.
  const receipt = await page.evaluate(async fixtures => {
    const parsed=webWorkParse(fixtures.inbox);
    const plain=webWorkParse(fixtures.leak);
    __webWorkDraft=await webWorkDraftFromText(fixtures.inbox);
    const firstId=__webWorkDraft.id,ok=await webWorkRegister(firstId);
    const projects=state.projects.length,project=state.projects[state.projects.length-1],note=state.notes[state.notes.length-1].text;
    __webWorkDraft=await webWorkDraftFromText(fixtures.inbox.replace('이름은 선택 입력이라 비워 두었습니다.','다른 메모입니다.'));
    const secondId=__webWorkDraft.id,again=await webWorkRegister(secondId),projectsAfter=state.projects.length;
    state.projects=state.projects.slice(0,1);state.notes=state.notes.slice(0,1);
    return {receiptNo:parsed.fields.receiptNo,plainReceipt:plain.fields.receiptNo||'',sameIdAsPlain:firstId===(await webWorkDraftFromText(fixtures.leak)).id,ok,projects,projectReceipt:project.sourceReceiptNo,noteHasReceipt:/^접수번호: LD-20260903-0007$/m.test(note),idsDiffer:firstId!==secondId,again,projectsAfter};
  }, FIXTURES);
  assert.deepEqual(receipt,{receiptNo:'LD-20260903-0007',plainReceipt:'',sameIdAsPlain:true,ok:true,projects:2,projectReceipt:'LD-20260903-0007',noteHasReceipt:true,idsDiffer:true,again:false,projectsAfter:2},'receipt number is kept on the project and note, does not change the dedupe id, and blocks a second registration of the same inbox lead');

  const guards = await page.evaluate(async fixtures => {
    let snapshots=0,persists=0,postPersists=0;
    render=()=>{};webWorkMarkDirtyAfterPersist=()=>{postPersists++;};
    hjSnapshot=async () => { snapshots++; return true; };
    guardedPersistCurrentState=async()=>{persists++;return true;};
    __webWorkDraft=await webWorkDraftFromText(fixtures.interior);
    const beforeDupe=state.projects.length,dupe=await webWorkRegister(__webWorkDraft.id),afterDupe=state.projects.length;
    __webWorkDraft=await webWorkDraftFromText(fixtures.leak);
    hjSnapshot=async () => { snapshots++; return false; };
    const beforeFail=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    const snapshotFail=await webWorkRegister(__webWorkDraft.id);
    const afterFail=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    __webWorkDraft=await webWorkDraftFromText(fixtures.office);
    hjSnapshot=async () => { snapshots++; return true; };guardedPersistCurrentState=async()=>{persists++;return false;};
    const beforePersistFalse=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    const persistFalse=await webWorkRegister(__webWorkDraft.id);
    const afterPersistFalse=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    __webWorkDraft=await webWorkDraftFromText(fixtures.office.replace('\uC2DC\uC124 \uB2F4\uB2F9\uC790','\uC2DC\uC124 \uB2F4\uB2F9\uC790 2'));
    guardedPersistCurrentState=async()=>{persists++;throw new Error('persist-break');};
    const beforePersistThrow=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    const persistThrow=await webWorkRegister(__webWorkDraft.id);
    const afterPersistThrow=JSON.stringify({projects:state.projects,notes:state.notes,active:state.activeProject});
    __webWorkDraft=await webWorkDraftFromText(fixtures.office.replace('\uC2DC\uC124 \uB2F4\uB2F9\uC790','\uC2DC\uC124 \uB2F4\uB2F9\uC790 3'));
    guardedPersistCurrentState=async()=>{persists++;return true;};render=()=>{throw new Error('render-break');};
    const beforeRender=state.projects.length,renderResult=await webWorkRegister(__webWorkDraft.id),afterRender=state.projects.length;
    render=()=>{};
    __webWorkDraft=await webWorkDraftFromText(fixtures.leak.replace('2026-09-03','2026-09-04'));
    const raceId=__webWorkDraft.id,raceBefore=state.projects.length;
    hjSnapshot=async()=>{snapshots++;state.projects=state.projects.concat([{name:'race insert',sourceInquiryId:raceId}]);return true;};
    guardedPersistCurrentState=async()=>{persists++;return true;};
    const raceResult=await webWorkRegister(raceId),raceAfter=state.projects.length;
    return {
      beforeDupe,dupe,afterDupe,snapshotFail,sameAfterSnapshot:beforeFail===afterFail,
      persistFalse,sameAfterPersistFalse:beforePersistFalse===afterPersistFalse,
      persistThrow,sameAfterPersistThrow:beforePersistThrow===afterPersistThrow,
      renderResult,renderAdded:afterRender===beforeRender+1,raceResult,raceAddedOnlyCompeting:raceAfter===raceBefore+1,
      snapshots,persists,postPersists
    };
  }, FIXTURES);
  assert.deepEqual(guards,{
    beforeDupe:1,dupe:false,afterDupe:1,snapshotFail:false,sameAfterSnapshot:true,
    persistFalse:false,sameAfterPersistFalse:true,persistThrow:false,sameAfterPersistThrow:true,
    renderResult:true,renderAdded:true,raceResult:false,raceAddedOnlyCompeting:true,
    snapshots:5,persists:3,postPersists:1
  },'Break caught: dedupe races, failed snapshot/persistence, and post-persist UI failure preserve atomic outcomes');
  assert.equal(errors.length, 0, 'no page errors: ' + errors.join(' | '));
  await browser.close();
  console.log('PASS  웹 업무 연결: 3종 실메일·국내전화·동의/출처·미리보기 승인·안전판·중복·rollback·OfficeIntake 분리');
})().catch(async error => { console.error(error); try { if(browser) await browser.close(); } catch (_) {} process.exitCode=1; });
