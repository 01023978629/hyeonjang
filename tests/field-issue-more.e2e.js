/* field-issue-more.e2e.js — 폰에서 자주 쓰는 입력 화면의 검증 오류를 칸에 붙인다 (v330, Playwright)

   v329 는 hjFieldIssue(el,msg)(aria-invalid · 칸 아래 role=alert · 입력하면 풀림 · 초점 이동)를 AS·아파트 오더·거래처·
   자재·수금·노하우 7화면에만 붙였다(ui-feedback ③). 나머지는 토스트 한 줄만 2~6초 떴다 사라져, 폰에서 어느 칸이
   틀렸는지 모르고 키보드가 올라온 채 토스트를 놓치면 '저장이 안 눌린다'로 보였다. 여기서 옮긴 곳:
     현장 추가(사이드바 칸 — 칸이 보일 때만) · 현장명 수정(빈 이름·중복) · 일정 추가/수정(제목) · 지출 추가(금액) ·
     단가표 품목(이름·단가) · 오늘 할일 · 통화 메모(저장+문자·저장만) · 실측 노트(🧮 가로/세로) ·
     자재 계산기(값 없이 📋 결과 복사 → 첫 빈 칸) · 음성 현장일지(작업 내용) · 연락처(이름) · 운행 기록(거리) ·
     작업시간 수정(날짜·시작) · 명함 거래처(상호) · 고객 셀프 견적(평형) · 협상 도우미(희망가) · AI 견적(현장 설명)
   화면마다 지키는 것: 토스트는 그대로 뜬다(기존 검사 호환) · 초점이 그 칸 · aria-invalid=true · aria-describedby 로 이어진
   role=alert 안내가 칸 아래에 보인다 · 고치면(입력) 표시가 풀린다 · 거부된 입력은 자료를 바꾸지 않는다.
   가짜 자료만 쓴다(전화 010-0000-1234). 판정은 종료코드.
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
const P1 = '가상칸검사현장 A', P2 = '가상칸검사현장 B';

async function boot(browser, mobile, viewport) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript((m) => {
    try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', m ? '1' : '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {}
  }, mobile);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(async ({ mobile, P1, P2 }) => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]);
    // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다(AGENTS.md 검사 함정)
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false;
    if (typeof backupBootCheck === 'function') backupBootCheck = () => 0; if (typeof kakaoCheckNew === 'function') kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const P = (name) => ({ name, archived: false, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객', phone: '010-0000-1234', addr: '' } });
    state.projects = [P(P1), P(P2)];
    state.files = []; state.schedule = []; state.payLog = []; state.expenses = []; state.contacts = []; state.notes = []; state.priceBook = {};
    state.quotes = [{ id: 'fake-nego-q', title: '가상 협상 견적', no: 'FAKE-N', date: '2026-09-01', project: P1, customer: { name: '가상 고객', phone: '010-0000-1234', addr: '' }, items: [{ cat: '욕실', name: '가상 방수', qty: 1, unit: '식', price: 1000000 }], memo: '' }];
    state.activeProject = P1; state.tab = 'dashboard';
    __gdToken = null; relayReady = () => false; relayCall = () => { throw new Error('검사: 중계 서버 호출 금지'); };
    window.open = () => null;
    __mobileMode = mobile; applyMobileMode(); render();
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  }, { mobile, P1, P2 });
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  let { ctx, page, errs } = await boot(browser, true, { width: 390, height: 844 });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const modalReady = () => page.waitForFunction(() => document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire);
  const closeAll = async () => { await page.evaluate(() => { try { closeModal(true); } catch (e) {} }); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire); };

  // 칸 검사 — ui-feedback ③ 과 같은 자: 초점·aria-invalid·describedby 로 이어진 role=alert(칸 아래)·입력하면 풀림
  async function fieldCheck(label, sel, msgRe, fix, scope = '#modalRoot') {
    const r = await page.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return { missing: true };
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/);
      const sp = ids.map(id => document.getElementById(id)).find(x => x && x.classList.contains('field-issue'));
      const er = el.getBoundingClientRect(), sr = sp && sp.getBoundingClientRect();
      return { focused: document.activeElement === el, invalid: el.getAttribute('aria-invalid'),
        alert: sp && sp.getAttribute('role'), text: sp && sp.textContent, visible: !!(sr && sr.height > 0),
        below: !!(sr && sr.top >= er.bottom - 1) };
    }, sel);
    assert(!r.missing, label + ': 칸이 없다 ' + sel);
    assert(r.invalid === 'true', label + ': aria-invalid 가 없다 ' + JSON.stringify(r));
    assert(r.focused, label + ': 초점이 그 칸으로 가지 않았다');
    assert(r.alert === 'alert' && msgRe.test(r.text || '') && r.visible && r.below, label + ': 칸 아래 안내가 없다 ' + JSON.stringify(r));
    await page.locator(sel).focus();
    if (fix === 'date' || fix === 'time') await page.evaluate(({ sel, fix }) => { const el = document.querySelector(sel); el.value = fix === 'date' ? localDate() : '08:30'; el.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, fix });
    else await page.keyboard.type(fix);
    const cleared = await page.evaluate(({ sel, scope }) => { const el = document.querySelector(sel); return { inv: el.getAttribute('aria-invalid'), left: document.querySelectorAll(scope + ' .field-issue').length, db: el.getAttribute('aria-describedby') }; }, { sel, scope });
    assert(cleared.inv !== 'true' && cleared.left === 0 && !cleared.db, label + ': 입력해도 오류 표시가 안 풀린다 ' + JSON.stringify(cleared));
  }
  const clickFoot = (re) => page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => re.test((x.textContent || '').trim())); if (!b) throw new Error('버튼 없음 ' + src); b.click(); }, re.source);
  const clickId = (id) => page.evaluate((id) => { const b = document.getElementById(id); if (!b) throw new Error('버튼 없음 #' + id); b.click(); }, id);
  const toastIs = async (re, label) => { const t = await lastToast(); assert(re.test(t), label + ': 토스트가 사라졌다 — 마지막 토스트 "' + t + '"'); };

  await test('현장명 수정 — 빈 이름·중복 이름 칸, 거부하면 이름 그대로', async () => {
    await page.evaluate((n) => renameProject(n), P1); await modalReady();
    await page.fill('#renProjInput', '');
    await clickFoot(/^저장$/);
    await toastIs(/이름을 입력/, '빈 이름');
    await fieldCheck('현장명(빈)', '#renProjInput', /이름을 입력/, '가상');
    await page.fill('#renProjInput', P2);
    await clickFoot(/^저장$/);
    await page.waitForFunction(() => /이미 있는 현장 이름/.test(window.__toasts[window.__toasts.length - 1] || ''));
    await fieldCheck('현장명(중복)', '#renProjInput', /이미 있는 현장 이름/, 'x');
    const names = await page.evaluate(() => state.projects.map(p => p.name).join('|'));
    assert(names === P1 + '|' + P2, '거부했는데 이름이 바뀌었다 ' + names);
    await closeAll();
  });

  await test('일정 추가 — 제목 칸, 거부하면 일정 그대로', async () => {
    await page.evaluate(() => openScheduleEdit()); await modalReady();
    await clickFoot(/^저장$/);
    await toastIs(/제목을 입력/, '일정');
    await fieldCheck('일정 제목', '#schTitle', /제목을 입력/, '가상 실측');
    assert((await page.evaluate(() => state.schedule.length)) === 0, '거부했는데 일정이 생겼다');
    await closeAll();
  });

  await test('지출 추가 — 금액 칸, 거부하면 장부 그대로', async () => {
    await page.evaluate(() => expenseAddDialog()); await modalReady();
    await clickFoot(/^저장$/);
    await toastIs(/금액을 입력/, '지출');
    await fieldCheck('지출 금액', '#exAmt', /금액을 입력/, '30000');
    assert((await page.evaluate(() => (state.expenses || []).length)) === 0, '거부했는데 지출이 생겼다');
    await closeAll();
  });

  await test('단가표 품목 — 이름 없으면 이름 칸, 이름만 있으면 단가 칸', async () => {
    await page.evaluate(() => priceBookManage()); await modalReady();
    await clickId('pbAdd');
    await toastIs(/품목명과 단가/, '단가표');
    await fieldCheck('단가표 품목명', '#pbNewName', /품목명을 입력/, '가상 실리콘');
    await clickId('pbAdd');
    await fieldCheck('단가표 단가', '#pbNewPrice', /단가를 입력/, '8000');
    await closeAll();
    assert((await page.evaluate(() => Object.keys(state.priceBook || {}).length)) === 0, '거부했는데 단가표가 바뀌었다');
  });

  await test('오늘 할일 — 한 줄 칸, 거부하면 할일 그대로', async () => {
    await page.evaluate(() => todoLocalView()); await modalReady();
    await clickId('todoAdd');
    await toastIs(/할 일을 한 줄/, '할일');
    await fieldCheck('할일', '#todoText', /할 일을 한 줄/, '가상 실리콘 사기');
    assert((await page.evaluate(() => (state.notes || []).length)) === 0, '거부했는데 할일이 생겼다');
    await closeAll();
  });

  await test('통화 메모 — 저장+문자·저장만 두 버튼 모두 메모 칸, 거부하면 메모 그대로', async () => {
    for (const btn of [/^💾 저장 \+ 💬 문자 보내기$/, /^저장만$/]) {
      await page.evaluate(() => hjCallFollowup({ name: '가상 고객', phone: '010-0000-1234', project: '가상칸검사현장 A' })); await modalReady();
      await clickFoot(btn);
      await toastIs(/통화 내용을 먼저/, '통화 메모');
      await fieldCheck('통화 메모 ' + btn.source, '#cfNote', /통화 내용을 먼저/, '가상 통화');
      await closeAll();
    }
    assert((await page.evaluate(() => (state.notes || []).length)) === 0, '거부했는데 메모가 생겼다');
  });

  await test('실측 노트 — 🧮 를 가로 없이 누르면 가로 칸, 가로만 있으면 세로 칸', async () => {
    await page.evaluate((n) => { state.projects[0].measure = [{ id: 'fake-mn', room: '가상 안방', w: '', h: '', hgt: '', open: '', note: '' }]; measureNote(n); }, P1);
    await modalReady();
    await page.evaluate(() => document.querySelector('#modalRoot .mnCalc').click());
    await toastIs(/가로·세로를 먼저/, '실측');
    await fieldCheck('실측 가로', '#modalRoot .mnIn[data-k="w"]', /가로·세로를 먼저/, '3.2');
    await page.evaluate(() => document.querySelector('#modalRoot .mnCalc').click());
    await fieldCheck('실측 세로', '#modalRoot .mnIn[data-k="h"]', /가로·세로를 먼저/, '4');
    await closeAll();
  });

  await test('자재 계산기 — 값 없이 📋 결과 복사를 누르면 첫 빈 칸', async () => {
    await page.evaluate(() => { window.__hjCalcMem = {}; materialCalc('tile'); }); await modalReady();
    const first = await page.evaluate(() => { const ins = [...document.querySelectorAll('#modalRoot input.calcIn')].filter(i => i.getClientRects().length); const e = ins.find(i => !(hjCalcNum(i.value) > 0)); if (!e) return null; e.setAttribute('data-fi-first', '1'); return e.dataset.k; });
    assert(first, '빈 칸이 없다 — 시드를 확인(타일 계산기의 면적 칸은 처음에 비어 있어야 한다)');
    await clickFoot(/결과 복사/);
    await toastIs(/먼저 값을 넣어/, '계산기');
    await fieldCheck('계산기 ' + first, '#modalRoot input[data-fi-first]', /먼저 값을 넣어/, '12');
    await closeAll();
  });

  await test('음성 현장일지 — 작업 내용 칸', async () => {
    await page.evaluate(() => voiceWorkLog()); await modalReady();
    await clickFoot(/일지 저장/);
    await toastIs(/작업 내용을 입력/, '현장일지');
    await fieldCheck('현장일지', '#wlText', /작업 내용을 입력/, '가상 도배 완료');
    assert((await page.evaluate(() => (state.workLogs || []).length)) === 0, '거부했는데 일지가 생겼다');
    await closeAll();
    // 현장이 하나도 없으면 현장 칸이 '현장 없음' 하나뿐 — 그때는 현장 칸에 붙는다
    await page.evaluate(() => { window.__keepProjects = state.projects; state.projects = []; voiceWorkLog(); });
    await modalReady();
    await clickFoot(/일지 저장/);
    await toastIs(/현장을 선택/, '현장일지(현장 없음)');
    const r = await page.evaluate(() => { const el = document.getElementById('wlProj'); return { inv: el.getAttribute('aria-invalid'), focused: document.activeElement === el, alert: !!document.querySelector('#modalRoot .field-issue[role=alert]') }; });
    await page.evaluate(() => { state.projects = window.__keepProjects; });
    assert(r.inv === 'true' && r.focused && r.alert, '현장 칸에 표시가 없다 ' + JSON.stringify(r));
    await closeAll();
  });

  await test('연락처 추가 — 이름 칸', async () => {
    await page.evaluate(() => openContactEdit()); await modalReady();
    await clickFoot(/^저장$/);
    await toastIs(/이름이나 전화/, '연락처');
    await fieldCheck('연락처 이름', '#cName', /이름이나 전화/, '가상 반장');
    assert((await page.evaluate(() => state.contacts.length)) === 0, '거부했는데 연락처가 생겼다');
    await closeAll();
  });

  await test('운행 기록 — 주행 거리 칸', async () => {
    await page.evaluate(() => tripAddView()); await modalReady();
    const n0 = await page.evaluate(() => tripData().length);
    await clickFoot(/^저장$/);
    await toastIs(/주행 거리/, '운행');
    await fieldCheck('주행 거리', '#trKm', /주행 거리를 입력/, '24');
    assert((await page.evaluate(() => tripData().length)) === n0, '거부했는데 운행 기록이 생겼다');
    await closeAll();
  });

  await test('작업시간 수정 — 날짜 없으면 날짜 칸, 시작 없으면 시작 칸', async () => {
    await page.evaluate(() => { workData().push({ id: 'fake-wk', date: '2026-09-01', in: '09:00', out: '18:00', memo: '', project: '가상칸검사현장 A' }); workEditView('fake-wk'); });
    await modalReady();
    await page.evaluate(() => { document.getElementById('wkDate').value = ''; document.getElementById('wkIn').value = ''; });
    await clickId('wkSave');
    await toastIs(/날짜와 시작 시간/, '작업시간');
    await fieldCheck('작업 날짜', '#wkDate', /날짜를 입력/, 'date');
    await clickId('wkSave');
    await fieldCheck('작업 시작', '#wkIn', /시작 시간을 입력/, 'time');
    const w = await page.evaluate(() => workData().find(x => x.id === 'fake-wk'));
    assert(w.date === '2026-09-01' && w.in === '09:00', '거부했는데 기록이 바뀌었다 ' + JSON.stringify(w));
    await closeAll();
  });

  await test('명함 거래처 등록 — 상호 칸', async () => {
    await page.evaluate(() => cardScanConfirm({ name: '', phone: '010-0000-1234', item: '' })); await modalReady();
    await clickFoot(/거래처 등록/);
    await toastIs(/상호를 입력/, '명함');
    await fieldCheck('명함 상호', '#csvName', /상호를 입력/, '가상 철물');
    await closeAll();
  });

  await test('고객 셀프 견적 — 평형 칸', async () => {
    await page.evaluate(() => selfQuoteDialog()); await modalReady();
    await page.evaluate(() => { document.getElementById('sqPyeong').value = ''; });
    await clickId('sqCalc');
    await toastIs(/평형을 입력/, '셀프 견적');
    await fieldCheck('셀프 견적 평형', '#sqPyeong', /평형을 입력/, '24');
    await closeAll();
  });

  await test('협상 도우미 — 희망가 칸', async () => {
    await page.evaluate(() => negotiateDialog('fake-nego-q')); await modalReady();
    await page.waitForSelector('#negoCalc');
    await clickId('negoCalc');
    await toastIs(/희망가를 숫자로/, '협상');
    await fieldCheck('협상 희망가', '#negoTarget', /희망가를 숫자로/, '900000');
    await closeAll();
  });

  await test('AI 견적 — 현장 설명 칸(키·서버 호출 없이 멈춘다)', async () => {
    await page.evaluate(() => aiQuoteDialog()); await modalReady();
    await clickFoot(/견적 만들기/);
    await toastIs(/현장 설명을 입력/, 'AI 견적');
    await fieldCheck('AI 견적 설명', '#aqDesc', /현장 설명을 입력/, '가상 욕실 타일');
    await closeAll();
  });

  await test('현장 추가(폰 더보기 prompt 경로) — 숨은 사이드바 칸에 표시를 달지 않는다', async () => {
    const r = await page.evaluate((dup) => { const keep = window.prompt; window.prompt = () => dup; try { moreActionHandler('addproject'); } finally { window.prompt = keep; }
      const el = document.getElementById('newProj'); return { hidden: !el.getClientRects().length, inv: el.getAttribute('aria-invalid'), n: state.projects.length }; }, P1);
    assert(r.hidden, '폰 모드인데 사이드바 칸이 보인다 — 이 검사의 전제가 무너졌다');
    await toastIs(/이미 있는 현장/, '현장 추가(prompt)');
    assert(r.inv !== 'true' && r.n === 2, '숨은 칸에 오류 표시를 달았거나 중복 현장이 생겼다 ' + JSON.stringify(r));
  });

  await test('★ pageerror 0 (폰)', async () => { assert(errs.length === 0, 'pageerror: ' + errs.join(' | ')); });
  await ctx.close();

  // PC 화면 — 사이드바 「현장 추가」 칸이 보이는 자리
  ({ ctx, page, errs } = await boot(browser, false, { width: 1280, height: 900 }));
  await test('현장 추가(PC 사이드바) — 빈 이름·중복 이름 칸, 거부하면 현장 그대로', async () => {
    assert(await page.evaluate(() => !!document.getElementById('newProj').getClientRects().length), 'PC 인데 사이드바 칸이 안 보인다');
    await page.fill('#newProj', '');
    await page.click('#btnAddProj');
    await fieldCheck('현장 추가(빈)', '#newProj', /현장 이름을 입력/, '가', 'body');
    await page.fill('#newProj', P1);
    await page.click('#btnAddProj');
    await toastIs(/이미 있는 현장/, '현장 추가(중복)');
    await fieldCheck('현장 추가(중복)', '#newProj', /이미 있는 현장/, 'x', 'body');
    assert((await page.evaluate(() => state.projects.length)) === 2, '거부했는데 현장이 생겼다');
    await page.fill('#newProj', '가상칸검사현장 C');
    await page.click('#btnAddProj');
    assert((await page.evaluate(() => state.projects.length)) === 3, '맞는 이름인데 현장이 안 생겼다');
    assert((await page.evaluate(() => document.querySelectorAll('.field-issue').length)) === 0, '성공한 뒤에도 오류 표시가 남았다');
  });
  await test('★ pageerror 0 (PC)', async () => { assert(errs.length === 0, 'pageerror: ' + errs.join(' | ')); });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
