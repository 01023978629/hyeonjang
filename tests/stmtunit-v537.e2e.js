/* v537 🏢 내역서 동·호수 → 세대 등록(확인 뒤) — 10/31 대표 "최고의 개발자로 개발 진행".
   v331 규칙: 아파트 이름은 현장, 동·호수는 그 현장의 세대(aptUnits). v526 내역서 반영은 위치에서 동·호수를 떼어 아파트 현장으로 넣지만
   세대로 등록하지는 않았다. 읽은 값은 제안까지만 — 미리보기에서 체크하고 [등록]을 눌러야 들어간다.
   합성 자료만(실제 단지·동·호수 아님), 바깥 요청 0, 바깥 쓰기 0.
   ① 읽기·후보: '동·호' 꼴은 확실, '101-1001' 꼴은 확인 필요 · 같은 세대는 한 줄(줄 수·작업) · 이미 있는 세대·이름이 겹치는 현장·보관 현장 빠짐 ·
      기본 체크 = 확실 + 아파트 이름 · 한 현장만 보기 · 읽기만으로 자료 그대로 (PLAN)
   ② 화면(390px): 📑 장부 '🏢 … 5곳' → 미리보기(체크 3·확인 2) → [🏢 체크한 세대 등록] → 3곳 등록 · 🛡 안전판 · 사진·견적·입금 그대로 · 남은 2곳 (UI)
   ③ 현장 동·호수 카드 '📑 내역서 동·호수 1곳 등록' → 그 현장만 · 그사이 다른 곳에서 세대가 바뀌면 등록하지 않고 알림 · 다시 열어 등록 → 카드 단추 사라짐 (CARD)
   ④ 소스·핀 3곳(v537 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V537_BASELINE=<commit> 과 HJ_V537_MUTATION=check-all(전부 미리 체크) 은 ① 에서, no-before(그사이 바뀜 확인 끔) 는 ③ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V537_BASELINE ? execFileSync('git', ['show', process.env.HJ_V537_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'check-all': ["    plan.push(Object.assign(c,{apt,check:c.sure&&apt}));", "    plan.push(Object.assign(c,{apt,check:true}));"],
  'no-before': ["      if(!seen.has(x.project)){if(JSON.stringify(p.aptUnits||null)!==before[x.project])throw new Error(", "      if(!seen.has(x.project)){if(false)throw new Error("]
}[process.env.HJ_V537_MUTATION || ''];
if (process.env.HJ_V537_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V537_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS stmtunit-v537 ' + name); }
  const { context, page } = await openPage();
  // 합성 현장: 가온아파트(새 세대 3) · 나래빌딩(아파트 이름 아님) · 다솜아파트(101동 1001호는 이미 세대) · 라온아파트 둘(이름 겹침) · 마루아파트(보관)
  const SEED = () => page.evaluate(() => {
    const P = (name, o) => Object.assign({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }, o || {});
    state.projects = [P('가온아파트'), P('나래빌딩'), P('다솜아파트', { aptUnits: [{ id: 'unit_seed1', type: 'unit', dong: '101', ho: '1001', name: '', note: '' }] }), P('라온아파트'), P('라온아파트'), P('마루아파트', { archived: true })];
    state.files = [{ id: 'ph1', name: 'ph1.jpg', ext: 'jpg', kind: 'photo', project: '가온아파트', size: 10, when: new Date('2026-10-20T01:00:00Z'), _driveId: 'DRV_PH1' }];
    state.quotes = []; state.expenses = []; state.payLog = []; state.aptOrders = []; state.aptOffices = [];
    const L = (loc, work, amt, d) => ({ d: d || '2026-10-20', loc, work, amt });
    const mk = (src, project, lines) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date: '2026-10-20', vat: 'included', project, lines }); state.quotes.push(q); syncQuoteToProject(q); };
    mk('A.xlsx', '가온아파트', [L('가온아파트 101동 1001호', '욕실 누수', 100000), L('가온아파트 101동 1001호', '배관 교체', 50000, '2026-10-21'), L('가온아파트 102동 503호', '배관 교체', 70000), L('가온아파트 103-704', '실리콘', 30000), L('가온아파트 관리동 지하', '점검', 20000)]);
    mk('A.xlsx', '나래빌딩', [L('나래빌딩 1동 201호', '방수', 90000)]);
    mk('A.xlsx', '다솜아파트', [L('다솜아파트 101동 1001호', '누수 탐지', 80000), L('다솜아파트 101동 1002호', '누수 탐지', 80000)]);
    mk('A.xlsx', '라온아파트', [L('라온아파트 1동 1호', '점검', 10000)]);
    mk('A.xlsx', '마루아파트', [L('마루아파트 5동 505호', '점검', 10000)]);
    hjStmtPayApply('A.xlsx', { amt: 10000, d: localDate(), method: '계좌이체' });
    try { closeModal(); } catch (e) {}
  });
  const fp = () => page.evaluate(() => JSON.stringify({ files: state.files.map(f => [f.id, f.project, f._aptUnit || null]), quotes: state.quotes.map(q => [q.id, q.project, quoteCalc(q).total]), pay: state.payLog.map(x => [x.project, x.amt]) }));

  await test('① 읽기·후보 — 확실/확인 · 같은 세대 한 줄 · 이미 있음·이름 겹침·보관 빠짐 · 기본 체크 · 한 현장만 · 읽기만 (PLAN)', async () => {
    await SEED();
    const before = await fp();
    const r = await page.evaluate(() => ({
      of: ['가온아파트 101동 1001호', '가온아파트 103-704', '가온아파트 101호 1001호', '가온아파트 관리동 지하', ''].map(x => { const u = hjStmtUnitOf(x); return u && [u.dong, u.ho, u.sure]; }),
      plan: hjStmtUnitPlan().map(x => [x.project, x.dong, x.ho, x.sure, x.apt, x.check, x.lines, x.works.join('|')]),
      only: hjStmtUnitPlan('다솜아파트').map(x => [x.project, x.dong, x.ho]),
      units: aptUnitList(aptUnitProject('가온아파트')).length
    }));
    assert.deepEqual(r.of, [['101', '1001', true], ['103', '704', false], ['101', '1001', false], null, null], 'unit reading ' + JSON.stringify(r.of));
    assert.deepEqual(r.plan, [
      ['가온아파트', '101', '1001', true, true, true, 2, '욕실 누수|배관 교체'],
      ['가온아파트', '102', '503', true, true, true, 1, '배관 교체'],
      ['가온아파트', '103', '704', false, true, false, 1, '실리콘'],
      ['나래빌딩', '1', '201', true, false, false, 1, '방수'],
      ['다솜아파트', '101', '1002', true, true, true, 1, '누수 탐지']], 'plan ' + JSON.stringify(r.plan));
    assert.deepEqual(r.only, [['다솜아파트', '101', '1002']]);
    assert.equal(r.units, 0);
    assert.equal(await fp(), before, 'reading the plan changes nothing');
  });

  await test('② 화면 390px — 장부 줄 → 미리보기(체크 3·확인 2) → 등록 3곳 · 🛡 안전판 · 사진·견적·입금 그대로 · 남은 2곳 (UI)', async () => {
    const before = await fp();
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    await page.waitForSelector('[data-stmt-unitline]');
    const line = await page.evaluate(() => { const el = document.querySelector('[data-stmt-unitline]'); return { t: el.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(el.querySelector('[data-stmtunit]').getBoundingClientRect().height) }; });
    assert(/🏢 내역서에 나온 동·호수 5곳이 아직 그 현장 세대로 등록되지 않았어요/.test(line.t) && line.h >= 44, 'ledger line ' + JSON.stringify(line));
    await page.click('[data-stmt-unitline] [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    const m = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('[data-stmtunit-row]')].map(r => [r.querySelector('.suChk').checked, r.textContent.replace(/\s+/g, ' ').trim()]),
      h: Math.min(...[...document.querySelectorAll('[data-stmtunit-row]')].map(r => Math.round(r.getBoundingClientRect().height))),
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim())
    }));
    assert.deepEqual(m.rows.map(x => x[0]), [true, true, false, false, true], 'default checks ' + JSON.stringify(m.rows));
    assert(/‘101-1001’ 꼴로 적힌 위치 — 확인/.test(m.rows[2][1]) && /현장 이름이 아파트로 보이지 않아요 — 확인/.test(m.rows[3][1]) && /내역서 2줄 · 욕실 누수, 배관 교체/.test(m.rows[0][1]), 'row texts ' + JSON.stringify(m.rows));
    assert(m.h >= 44 && m.wide <= 0, '44px rows · no overflow ' + JSON.stringify([m.h, m.wide]));
    assert.deepEqual(m.btns, ['취소', '🏢 체크한 세대 등록']);
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => !document.getElementById('stmtUnitPanel'));
    const after = await page.evaluate(async () => ({
      ga: aptUnitList(aptUnitProject('가온아파트')).map(u => u.dong + '-' + u.ho).sort(), da: aptUnitList(aptUnitProject('다솜아파트')).map(u => u.dong + '-' + u.ho).sort(),
      na: aptUnitList(aptUnitProject('나래빌딩')).length, toast: document.getElementById('toast').textContent,
      snap: ((await idbGet('hj_snaps')) || []).some(s => s.label === '내역서 동·호수 등록 전'),
      stored: ((await idbGet('appState')) || {}).projects, line: (document.querySelector('[data-stmt-unitline]') || {}).textContent || ''
    }));
    assert.deepEqual(after.ga, ['101-1001', '102-503']); assert.deepEqual(after.da, ['101-1001', '101-1002']); assert.equal(after.na, 0);
    assert(/🏢 3곳의 동·호수를 세대로 등록했어요/.test(after.toast) && after.snap, 'toast & snapshot ' + JSON.stringify([after.toast, after.snap]));
    assert(Array.isArray(after.stored) && after.stored.find(p => p.name === '가온아파트').aptUnits.length === 2, 'committed to the device store');
    assert(/동·호수 2곳이/.test(after.line.replace(/\s+/g, ' ')), 'two left (unchecked ones) ' + after.line);
    assert.equal(await fp(), before, 'photos, quotes and payments untouched');
  });

  await test('③ 현장 동·호수 카드 → 그 현장만 · 그사이 바뀌면 등록 안 함 · 다시 열어 등록 → 단추 사라짐 (CARD)', async () => {
    const card = () => page.evaluate(() => { const v = document.getElementById('view'); const old = document.getElementById('t537card'); if (old) old.remove(); v.insertAdjacentHTML('afterbegin', '<div id="t537card">' + aptUnitProjectCard(aptUnitProject('가온아파트')) + '</div>'); const b = document.querySelector('#t537card [data-stmtunit]'); return b ? b.textContent.trim() : ''; });
    assert.equal(await card(), '📑 내역서 동·호수 1곳 등록');
    await page.click('#t537card [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-stmtunit-row]')].map(r => [r.querySelector('.suChk').checked, r.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)]));
    assert(rows.length === 1 && rows[0][0] === false && /가온아파트 · 103동 704호/.test(rows[0][1]), 'only this site, unchecked hyphen form ' + JSON.stringify(rows));
    // 창이 떠 있는 사이 다른 곳(다른 창·관리 화면)에서 이 현장 세대가 바뀌었다 — 옛 미리보기로 쓰지 않는다
    await page.evaluate(async () => { await aptUnitSave('가온아파트', { type: 'unit', dong: '109', ho: '909' }); document.querySelector('#stmtUnitPanel .suChk').checked = true; });
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => /그사이 바뀌었습니다/.test((document.getElementById('aptUnitIssue') || {}).textContent || ''));
    assert.deepEqual(await page.evaluate(() => aptUnitList(aptUnitProject('가온아파트')).map(u => u.dong + '-' + u.ho).sort()), ['101-1001', '102-503', '109-909'], 'stale preview did not register');
    await page.evaluate(() => closeModal());
    assert.equal(await card(), '📑 내역서 동·호수 1곳 등록', 'still offered after the refused stale save');   // 저장(aptUnitSave)이 화면을 다시 그려 카드를 다시 넣는다
    await page.click('#t537card [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    await page.evaluate(() => { document.querySelector('#stmtUnitPanel .suChk').checked = true; });
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => !document.getElementById('stmtUnitPanel'));
    assert.deepEqual(await page.evaluate(() => aptUnitList(aptUnitProject('가온아파트')).map(u => u.dong + '-' + u.ho).sort()), ['101-1001', '102-503', '103-704', '109-909']);
    assert.equal(await card(), '', 'card button gone once every statement unit is registered');
  });

  await test('④ 소스·핀 3곳(v537 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(d\.stmtunit!==undefined\)return hjStmtUnitView\(d\.stmtunit\);/);
    assert.match(SRC, /\[data-stmtdun\],\[data-stmtunit\]/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 537, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`stmtunit-v537: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL stmtunit-v537', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
