/* restore-delete-safety.e2e.js — 복원·삭제 안전 (v330 발굴 생존 3건 + 3차 묶음 검토 low 3건, Playwright)

   ① 데이터 이사 마법사 [📄 백업(JSON) 복원] 은 JSON 파일을 고르게 한다(importData). 예전엔 PC 폴더의 _백업 목록(openRestore)을
      열어 폰에서는 '모바일은 PC에서' 토스트만 뜨고 마법사가 닫혔다(막다른 길). PC 폴더 목록은 PC 에서만 [🗂 폴더 백업 목록] 으로.
   ② JSON 불러오기(importData)는 덮어쓰기 전에 🛡 안전판('불러오기 전')을 찍고, 못 찍으면 불러오지 않는다(v274 규칙).
      빈 새 기기에서도 불러오기가 된다(안전판을 allowEmpty 로 찍는다 — v331).
   ③ 현장 상세 AS 카드 🗑(data-asdel)는 AS 관리 화면 ✕ 와 같은 길(hjAsDelete): 확인 → 안전판(실패하면 멈춤) → 삭제.
      연결된 AS 방문 일정(visitSchedId)은 따로 묻는다(취소하면 남긴다).
   ④ 하자보증서 링크(warrantyLinkSend)를 같은 분·같은 내용으로 다시 만들면 서버가 같은 contractId 를 돌려준다 —
      p.warrantyLinks 에 같은 줄을 또 달지 않고 그 줄을 다시 보여 준다.
   ⑤ 현장 삭제 확인 창의 수금 알림 줄은 실제로 남기는 이유(메모·작업자·시간·작업일지·인건비)를 그대로 말한다
      (예전엔 작업자·시간만 적어도 '적어 둔 메모가 있어').
   ⑥ '「선택 복원」하면 다시 이어집니다' 는 조건을 밝힌다 — 같은 이름 현장을 새로 만들기 전에만, 그리고 이 이름으로 지운
      기록이 이미 있으면 '자동으로 잇지 않습니다'. 실제 선택 복원 동작과 맞는지도 확인한다.
      v331: 같은 이름 현장이 이미 있어도 이 백업과 같은 기록이 든 '(삭제됨)' 한 벌이면 잇고 수금 알림도 되살린다, 근거가 없으면
      잇지 않고 조건을 밝힌 토스트.
   가짜 자료만 쓴다(전화 010-0000-1234, 토큰 SUPER-SECRET-ADMIN-TOKEN). 판정은 종료코드.
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
const N = '가상안전현장';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());   // confirm 은 아래에서 window.confirm 으로 대신한다 — 남은 대화상자가 검사를 멈추지 않게
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    relayReady = () => false; try { aiOpsEnsureState().enabled = false; } catch (e) {}
    window.__nativeSnapshot = hjSnapshot;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
    window.__confirms = []; window.__confirmAnswers = [];
    window.confirm = (m) => { window.__confirms.push(String(m)); return window.__confirmAnswers.length ? window.__confirmAnswers.shift() : true; };
    backupGuard = (name, fn) => fn();   // 백업 권유 창은 이 검사의 대상이 아니다 — 곧장 파일 고르기로
    __mobileMode = true; applyMobileMode();
  });
  const modalReady = () => page.waitForFunction(() => document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire);
  const closeAll = async () => { await page.evaluate(() => { try { closeModal(true); } catch (e) {} }); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire); };
  const toastSeen = (re) => page.waitForFunction(r => window.__toasts.some(t => new RegExp(r).test(t)), re.source);
  const seedBase = () => page.evaluate((N) => {
    try { closeModal(true); } catch (e) {}
    hjSnapshot = window.__nativeSnapshot;
    state.projects = [{ name: N, stage: STAGES.length - 1, received: 0, doneAt: '2026-09-01', phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객', phone: '010-0000-1234', addr: '' }, archived: false }];
    state.files = []; state.quotes = []; state.notes = []; state.payLog = []; state.asLog = []; state.schedule = []; state.aptOrders = [];
    state.editingQuote = null; state.activeProject = N; state.tab = 'dashboard';
    window.__toasts = []; window.__confirms = []; window.__confirmAnswers = [];
    render();
  }, N);
  // 불러올 백업 파일(다른 기기에서 내보낸 것처럼)
  const backupJson = await page.evaluate(() => JSON.stringify({ app: '현장', savedAt: '2026-09-20T00:00:00.000Z', files: [], projects: [{ name: '가상백업현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 백업 고객', phone: '010-0000-1234', addr: '' } }], quotes: [], schedule: [], notes: [], payLog: [] }));
  const snapLabels = () => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(s => ({ label: s.label, names: (s.data.projects || []).map(p => p.name) })));
  const pickJsonVia = async (clickFn) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), clickFn()]);
    assert(/json/.test(await fc.element().getAttribute('accept') || ''), '파일 선택기가 JSON 을 받지 않는다');
    await fc.setFiles({ name: '_현장.json', mimeType: 'application/json', buffer: Buffer.from(backupJson, 'utf8') });
  };

  await test('① 폰 이사 마법사 [📄 백업(JSON) 복원] → JSON 파일 고르기(모바일 막힘 토스트 없음) · 폴더 목록 버튼은 폰에 없음', async () => {
    await seedBase();
    await page.evaluate(() => importWizard()); await modalReady();
    await page.click('#modalRoot [data-iw="device"]');
    await page.waitForSelector('#iwJson');
    assert(!(await page.$('#iwFolder')), '폰인데 PC 폴더 백업 목록 버튼이 있다');
    await pickJsonVia(() => page.click('#iwJson'));
    await toastSeen(/불러오기 완료/);
    const r = await page.evaluate(() => ({ names: state.projects.map(p => p.name), toasts: window.__toasts }));
    assert(r.names.includes('가상백업현장'), '고른 JSON 이 불러와지지 않았다 ' + JSON.stringify(r.names));
    assert(!r.toasts.some(t => /모바일은/.test(t)), '폰 막힘 토스트가 떴다 ' + JSON.stringify(r.toasts));
  });

  await test('② 불러오기 직전 상태가 🛡 안전판에 「불러오기 전」으로 남는다', async () => {
    const snaps = await snapLabels();
    const s = snaps.filter(x => x.label === '불러오기 전').pop();
    assert(s, '「불러오기 전」 안전판이 없다 ' + JSON.stringify(snaps.map(x => x.label)));
    assert(s.names.includes(N) && !s.names.includes('가상백업현장'), '안전판이 불러오기 직전 상태가 아니다 ' + JSON.stringify(s.names));
  });

  await test('② 안전판을 못 찍으면 불러오지 않는다(자료 그대로)', async () => {
    await seedBase();
    await page.evaluate(() => { hjSnapshot = async () => false; });
    await pickJsonVia(() => page.evaluate(() => importData()));
    await toastSeen(/안전 스냅샷 저장 실패/);
    const r = await page.evaluate(() => ({ names: state.projects.map(p => p.name), done: window.__toasts.some(t => /불러오기 완료/.test(t)) }));
    assert(JSON.stringify(r.names) === JSON.stringify([N]) && !r.done, '안전판 실패인데 불러왔다 ' + JSON.stringify(r));
    await page.evaluate(() => { hjSnapshot = window.__nativeSnapshot; });
  });

  await test('② 빈 새 기기에서도 불러오기가 된다(안전판은 빈 상태로라도 찍는다 — allowEmpty)', async () => {
    // 빈 기기(현장·파일·견적·메모 0)는 hjSnapshot 이 allowEmpty 없이는 '지킬 것 없음'으로 false 를 돌려준다 —
    // 그 인자가 빠지면 새 폰으로 이사할 때 JSON 불러오기가 '안전 스냅샷 저장 실패' 로 영영 막힌다.
    await seedBase();
    await page.evaluate(() => { state.projects = []; state.files = []; state.quotes = []; state.notes = []; state.activeProject = null; window.__toasts = []; render(); });
    const before = (await snapLabels()).filter(x => x.label === '불러오기 전').length;
    await pickJsonVia(() => page.evaluate(() => importData()));
    await page.waitForFunction(() => window.__toasts.some(t => /불러오기 완료|안전 스냅샷 저장 실패/.test(t)));
    const r = await page.evaluate(() => ({ names: state.projects.map(p => p.name), toasts: window.__toasts.slice() }));
    assert(r.names.includes('가상백업현장') && !r.toasts.some(t => /안전 스냅샷 저장 실패/.test(t)), '빈 기기에서 불러오기가 막혔다 ' + JSON.stringify(r));
    const after = (await snapLabels()).filter(x => x.label === '불러오기 전');
    assert(after.length === before + 1 && after[after.length - 1].names.length === 0, '빈 기기 안전판(현장 0개)이 찍히지 않았다 ' + JSON.stringify(after));
  });

  await test('② 엑셀 이사도 「이사 직전」 안전판을 못 찍으면 옮기지 않는다(전체장부·열 매핑 두 길)', async () => {
    await seedBase();
    await page.evaluate(() => {
      window.__fullCalls = 0; window.__origRead = __iwReadFile; window.__origFull = __iwFullImport;
      __iwReadFile = async () => ({ SheetNames: ['현장', '단가장'], Sheets: {} });
      __iwFullImport = () => { window.__fullCalls++; return {}; };
      hjSnapshot = async () => false; window.__toasts = [];
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => __iwPickFile('full'))]);
    await fc.setFiles({ name: '가상장부.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('fake') });
    await toastSeen(/옮기지 않았습니다/);
    assert(await page.evaluate(() => window.__fullCalls === 0), '안전판 실패인데 전체장부를 옮겼다');
    // 열 매핑 길 — XLSX 는 흉내만(네트워크 없이)
    await page.evaluate(() => { window.__origXLSX = window.XLSX; window.XLSX = { utils: { sheet_to_json: () => [['이름', '전화'], ['가상 거래처', '010-0000-1234']] } };
      window.__nContacts = (state.contacts || []).length; window.__toasts = [];
      __iwMapStep('contact', { SheetNames: ['S'], Sheets: { S: {} } }, '가상.xlsx', 'S'); });
    await modalReady();
    await page.click('#iwGo');
    await toastSeen(/옮기지 않았습니다/);
    assert(await page.evaluate(() => (state.contacts || []).length === window.__nContacts), '안전판 실패인데 연락처를 옮겼다');
    // 안전판이 되면 옮긴다(검사가 눈멀지 않았는지)
    await page.evaluate(() => { hjSnapshot = window.__nativeSnapshot; window.__toasts = []; });
    await page.evaluate(() => __iwMapStep('contact', { SheetNames: ['S'], Sheets: { S: {} } }, '가상.xlsx', 'S')); await modalReady();
    await page.click('#iwGo');
    await page.waitForFunction(() => (state.contacts || []).length === window.__nContacts + 1);
    await page.evaluate(() => { __iwReadFile = window.__origRead; __iwFullImport = window.__origFull; window.XLSX = window.__origXLSX; });
    await closeAll();
  });

  await test('① PC 이사 마법사 — [🗂 폴더 백업 목록] 이 PC 폴더 목록(openRestore)을, [📄 백업(JSON) 복원] 은 JSON 고르기', async () => {
    await seedBase();
    await page.evaluate(() => { __mobileMode = false; applyMobileMode(); window.__restoreCalls = 0; window.__origOpenRestore = openRestore; openRestore = async () => { window.__restoreCalls++; }; importWizard(); });
    await modalReady();
    await page.click('#modalRoot [data-iw="device"]');
    await page.waitForSelector('#iwFolder');
    const tap = await page.evaluate(() => document.getElementById('iwFolder').getBoundingClientRect().height);
    assert(tap >= 44, '폴더 목록 버튼 높이 ' + tap);
    await page.click('#iwFolder');
    await page.waitForFunction(() => window.__restoreCalls === 1);
    await page.evaluate(() => importWizard()); await modalReady();
    await page.click('#modalRoot [data-iw="device"]'); await page.waitForSelector('#iwJson');
    await pickJsonVia(() => page.click('#iwJson'));
    await toastSeen(/불러오기 완료/);
    assert(await page.evaluate(() => window.__restoreCalls === 1), '[📄 백업(JSON) 복원] 이 폴더 목록을 열었다');
    await page.evaluate(() => { openRestore = window.__origOpenRestore; __mobileMode = true; applyMobileMode(); });
  });

  const seedAs = () => page.evaluate((N) => {
    state.asLog = [{ id: 'as-fake-1', project: N, date: '2026-09-10', text: '가상 욕실 누수', status: 'doing', visitAt: '2026-09-30', visitSchedId: 'sc-as-visit', fix: '가상 방수 보수', fee: 50000 }];
    state.schedule = [{ id: 'sc-as-visit', date: '2026-09-30', time: '', title: '🔧 AS 방문: 가상 욕실 누수', project: N, asId: 'as-fake-1' }];
    state.tab = 'project'; state.activeProject = N; window.__toasts = []; window.__confirms = []; render();
  }, N);

  await test('③ 현장 카드 🗑 — 취소하면 그대로(확인을 묻는다)', async () => {
    await seedBase(); await closeAll(); await seedAs();
    await page.evaluate(() => { window.__confirmAnswers = [false]; });
    await page.click('[data-asdel="as-fake-1"]');
    await page.waitForFunction(() => window.__confirms.length >= 1);
    const r = await page.evaluate(() => ({ n: state.asLog.length, c: window.__confirms }));
    assert(r.n === 1 && /AS 기록을 삭제할까요/.test(r.c[0]), '확인 없이 지웠거나 취소가 안 먹는다 ' + JSON.stringify(r));
  });

  await test('③ 현장 카드 🗑 — 안전판을 못 찍으면 지우지 않는다', async () => {
    await page.evaluate(() => { hjSnapshot = async () => false; window.__confirms = []; window.__confirmAnswers = [true]; window.__toasts = []; });
    await page.click('[data-asdel="as-fake-1"]');
    await toastSeen(/안전 스냅샷 저장 실패/);
    assert(await page.evaluate(() => state.asLog.length === 1 && state.schedule.length === 1), '안전판 실패인데 지웠다');
    await page.evaluate(() => { hjSnapshot = window.__nativeSnapshot; });
  });

  await test('③ 현장 카드 🗑 — 확인하면 안전판에 남기고 지운다, 방문 일정은 [취소]면 남긴다', async () => {
    await page.evaluate(() => { window.__confirms = []; window.__confirmAnswers = [true, false]; window.__toasts = []; });
    await page.click('[data-asdel="as-fake-1"]');
    await page.waitForFunction(() => state.asLog.length === 0);
    const r = await page.evaluate(async () => ({ sch: state.schedule.map(s => s.id), c: window.__confirms, snap: (((await idbGet('hj_snaps')) || []).filter(s => s.label === 'AS 기록 삭제 전').pop() || {}).data }));
    assert(r.snap && (r.snap.asLog || []).some(a => a.id === 'as-fake-1'), '안전판에 지우기 전 AS 기록이 없다');
    assert(r.c.length === 2 && /방문 일정\(2026-09-30\)/.test(r.c[1]), '방문 일정을 묻지 않았다 ' + JSON.stringify(r.c));
    assert(JSON.stringify(r.sch) === JSON.stringify(['sc-as-visit']), '[취소] 했는데 방문 일정이 사라졌다 ' + JSON.stringify(r.sch));
    assert(!(await page.$('[data-asdel="as-fake-1"]')), '지운 뒤 카드가 다시 그려지지 않았다');
  });

  await test('③ 현장 카드 🗑 — 방문 일정도 지우겠다고 하면 같이 지운다(다른 일정은 그대로)', async () => {
    await seedAs();
    await page.evaluate(() => { state.schedule.push({ id: 'sc-other', date: '2026-10-01', time: '', title: '가상 도배', project: state.activeProject }); window.__confirmAnswers = [true, true]; });
    await page.click('[data-asdel="as-fake-1"]');
    await page.waitForFunction(() => state.asLog.length === 0);
    const sch = await page.evaluate(() => state.schedule.map(s => s.id));
    assert(JSON.stringify(sch) === JSON.stringify(['sc-other']), '방문 일정 정리가 틀렸다 ' + JSON.stringify(sch));
  });

  await test('③ AS 관리 화면 ✕ 도 같은 길 — 안전판을 못 찍으면 지우지 않는다', async () => {
    await seedAs();
    await page.evaluate(() => { hjSnapshot = async () => false; window.__confirmAnswers = [true]; window.__toasts = []; asManage(); });
    await modalReady();
    await page.click('#modalRoot .asmDel');
    await toastSeen(/안전 스냅샷 저장 실패/);
    assert(await page.evaluate(() => state.asLog.length === 1), 'AS 관리 ✕ 가 안전판 실패에도 지웠다');
    await page.evaluate(() => { hjSnapshot = window.__nativeSnapshot; });
    await closeAll();
  });

  await test('④ 하자보증서 링크 — 같은 분·같은 내용 재시도는 같은 줄을 다시 보여 준다(줄이 두 개가 되지 않는다)', async () => {
    await seedBase(); await closeAll();
    await page.evaluate(() => {
      __contract.url = 'https://script.google.com/macros/s/TEST/exec'; __contract.token = 'SUPER-SECRET-ADMIN-TOKEN'; __contract.selfTestOk = true;
      const seen = {}; let n = 0;
      window.contractCall = async (action, payload, opts) => {   // 진짜 서버처럼 같은 idem 이면 처음 결과를 그대로
        const idem = (opts && opts.idem) || ''; if (idem && seen[idem]) return seen[idem];
        n++; const r = { ok: true, contractId: 'ct_fake_' + n, contractNo: 'MM-FAKE-' + n, signUrl: 'https://script.google.com/macros/s/TEST/exec?page=sign&t=faketok' + n, notify: { sent: false } };
        if (idem) seen[idem] = r; return r; };
      const T = Date.UTC(2026, 8, 26, 1, 2, 3); window.__realNow = window.__realNow || Date.now; Date.now = () => T;
    });
    const send = () => page.evaluate(async (N) => {
      warrantyLinkSend(N, {});
      document.getElementById('wlName').value = '가상 소장'; document.getElementById('wlPhone').value = '010-0000-1234';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('링크 만들기')).click();
      for (let i = 0; i < 200 && !document.getElementById('wlLink'); i++) await new Promise(r => setTimeout(r, 20));
      const link = (document.getElementById('wlLink') || {}).value || '';
      const head = (document.querySelector('#modalRoot') || {}).textContent || '';
      try { closeModal(true); } catch (e) {}
      return { link, head };
    }, N);
    const a = await send(), b = await send();
    await page.evaluate(() => { Date.now = window.__realNow; });
    const rows = await page.evaluate((N) => (state.projects.find(p => p.name === N).warrantyLinks || []).map(L => L.contractId), N);
    assert(JSON.stringify(rows) === JSON.stringify(['ct_fake_1']), '같은 보증서가 두 줄 ' + JSON.stringify(rows));
    assert(a.link && a.link === b.link && /MM-FAKE-1/.test(b.head), '재시도 때 그 줄(같은 링크)을 다시 보여 주지 않았다 ' + JSON.stringify([a.link, b.link]));
    assert(!JSON.stringify(await page.evaluate((N) => state.projects.find(p => p.name === N).warrantyLinks, N)).includes('0000-1234'), '확인자 번호가 현장 자료에 남았다');
  });

  // ⑤⑥ 현장 삭제 확인 창의 수금 알림 줄
  const seedDue = (fields, extraTomb) => page.evaluate(({ N, fields, extraTomb }) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: N, stage: 3, received: 0, phases: [], cost: {}, dueDate: '2026-10-01' }];
    state.files = []; state.quotes = []; state.notes = []; state.asLog = []; state.aptOrders = []; state.editingQuote = null; state.activeProject = null;
    state.schedule = []; state.payLog = [{ d: '2026-09-20', project: N, amt: 300000 }];
    if (extraTomb) state.payLog.push({ d: '2026-01-10', project: '(삭제됨) ' + N + ' · 2026-01-15', amt: 100000 });
    upsertDueSchedule(state.projects[0]);
    Object.assign(state.schedule.find(s => s.id === 'due_' + N), fields || {});
    window.__backups = [{ name: '현장_20260925120000.json', handle: null, data: JSON.parse(JSON.stringify(serializeData())) }];
    window.__toasts = []; deleteProject(N);
  }, { N, fields, extraTomb });
  const dueLine = async () => { await page.waitForSelector('#delProjDue'); return page.locator('#delProjDue').innerText(); };
  const clickDelete = async () => { await page.locator('#modalRoot .mfoot button', { hasText: '삭제' }).click(); await page.waitForFunction(N => !state.projects.some(p => p.name === N), N); };
  const clickRestore = async () => {
    await page.evaluate(() => { window.__toasts = []; restoreSelect(0); });
    await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click());
    await toastSeen(/현장을 복원했습니다/);
  };

  await test('⑤ 작업자만 적은 수금 알림 — "메모" 가 아니라 "작업자가 있어"', async () => {
    await seedDue({ workers: '가상 작업자' });
    const t = await dueLine();
    assert(/적어 둔 작업자가 있어 지우지 않고/.test(t) && !/메모/.test(t), '남기는 이유가 틀렸다: ' + t);
  });
  await test('⑤ 시간·인건비 — "시간·인건비가 있어", 시간 — "시간이 있어", 메모·작업일지 — "메모·작업일지가 있어"', async () => {
    await seedDue({ time: '10:00', labor: { amt: 1 } });
    const t = await dueLine();
    assert(/적어 둔 시간·인건비가 있어/.test(t) && !/메모/.test(t), '시간·인건비: ' + t);
    await seedDue({ time: '10:00' });   // 받침 있는 말로 끝나면 '이' — 조사를 고정하면 '시간가' 가 된다
    const t1 = await dueLine();
    assert(/적어 둔 시간이 있어/.test(t1), '시간(조사): ' + t1);
    await seedDue({ memo: '가상 메모', report: '가상 일지' });
    const t2 = await dueLine();
    assert(/적어 둔 메모·작업일지가 있어/.test(t2), '메모·작업일지: ' + t2);
  });

  await test('⑥ 손대지 않은 알림 — 조건(같은 이름 새 현장 전)을 밝히고, 실제로 그 조건에서 복원이 알림을 되살린다', async () => {
    await seedDue({});
    const t = await dueLine();
    assert(/일정표에서 뺍니다/.test(t) && /같은 이름의 현장을 새로 만들기 전에/.test(t) && /선택 복원/.test(t), '조건 없는 약속: ' + t);
    await clickDelete();
    await clickRestore();
    const due = await page.evaluate(N => state.schedule.filter(s => s.id === 'due_' + N).map(s => s.date), N);
    assert(JSON.stringify(due) === JSON.stringify(['2026-10-01']), '조건을 지켰는데 알림이 안 돌아왔다 ' + JSON.stringify(due));
  });

  // v331 새 계약: 같은 이름 새 현장이 먼저 생겨도, 이 백업의 기록과 같은 기록(여기선 수금 30만 원)이 든 '(삭제됨)' 묶음이 딱 하나면
  // 잇고 수금 알림도 되살린다(예전엔 덮어쓰기만 하고 둘 다 버려 두었다). 확인 창의 '새로 만들기 전에 … 다시 올라옵니다' 는
  // 충분조건이라 여전히 참이다. 근거가 없으면 잇지 않고 조건을 밝혀 알린다 — 아래 검사.
  await test('⑥ 같은 이름 새 현장이 먼저 생겨도 이 백업의 기록이 든 「(삭제됨)」 한 벌이면 다시 잇고 알림도 되살린다', async () => {
    await seedDue({});
    await dueLine(); await clickDelete();
    await page.evaluate(N => { state.projects.push({ name: N, stage: 0, received: 0, phases: [], cost: {} }); }, N);
    await clickRestore();
    const r = await page.evaluate(N => ({ due: state.schedule.filter(s => s.id === 'due_' + N).map(s => s.date), pay: state.payLog.map(x => x.project), toast: window.__toasts.join(' ') }), N);
    assert(JSON.stringify(r.due) === JSON.stringify(['2026-10-01']) && JSON.stringify(r.pay) === JSON.stringify([N]) && /다시 이었습니다/.test(r.toast),
      '같은 이름 현장이 있을 때 근거 있는 (삭제됨) 기록·수금 알림을 잇지 않았다 ' + JSON.stringify(r));
  });

  await test('⑥ 같은 이름 새 현장 + 이 백업과 같은 기록이 없는 「(삭제됨)」 — 잇지 않고 조건을 밝혀 알린다', async () => {
    await seedDue({});
    await dueLine(); await clickDelete();
    // 더 옛날에 지운 다른 현장 기록인 것처럼 — 백업(수금 30만 원 9/20)과 같은 기록이 없다
    await page.evaluate(N => {
      state.projects.push({ name: N, stage: 0, received: 0, phases: [], cost: {} });
      state.payLog.forEach(x => { if (x.project.startsWith('(삭제됨) ' + N)) { x.amt = 7000; x.d = '2025-01-02'; } });
    }, N);
    await clickRestore();
    const r = await page.evaluate(N => ({ pay: state.payLog.map(x => x.project), toast: window.__toasts.join(' ') }), N);
    assert(r.pay.length === 1 && r.pay[0].startsWith('(삭제됨) ' + N) && /같은 이름 현장이 이미 있어/.test(r.toast) && /확인되지 않아/.test(r.toast),
      '근거 없는 (삭제됨) 기록을 이었거나 조용히 두었다 ' + JSON.stringify(r));
  });

  await test('⑥ 이 이름으로 지운 기록이 이미 있으면 "알림은 다시, 적어 둔 내용은 자동으로 잇지 않습니다" — 실제 복원과 같다', async () => {
    await seedDue({ memo: '가상 메모' }, true);
    const t = await dueLine();
    assert(/알림은 다시 올라오지만/.test(t) && /적어 둔 내용은 자동으로 잇지 않습니다/.test(t) && !/다시 이어집니다/.test(t), '거짓 약속: ' + t);
    await clickDelete();
    await clickRestore();
    const r = await page.evaluate(N => ({ due: state.schedule.filter(s => s.id === 'due_' + N).map(s => s.memo || ''),
      tomb: state.schedule.filter(s => /^due_\(삭제됨\)/.test(s.id)).map(s => s.memo), toast: window.__toasts.join(' ') }), N);
    assert(JSON.stringify(r.due) === JSON.stringify(['']) && JSON.stringify(r.tomb) === JSON.stringify(['가상 메모']) && /여러 벌/.test(r.toast),
      '문구와 실제 복원이 다르다(알림은 새로, 메모는 (삭제됨) 쪽에 남아야) ' + JSON.stringify(r));
  });

  await test('⑥ 메모 알림 + 지운 기록 없음 — "새로 만들기 전에 … 다시 이어집니다"', async () => {
    await seedDue({ memo: '가상 메모' });
    const t = await dueLine();
    assert(/같은 이름의 현장을 새로 만들기 전에 이 현장을 「선택 복원」하면 다시 이어집니다/.test(t), t);
    await closeAll();
  });

  await test('★ pageerror 0', async () => { assert(errs.length === 0, 'pageerror: ' + errs.join(' | ')); });
  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
