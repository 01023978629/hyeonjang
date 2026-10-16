/* v437 📊 견적 비교표 · 견적 비교 제안서 · 고객 폰으로 보내기(파일 공유·문자 초안). 합성 레코드만, 외부 쓰기 0.
   HJ_V437_BASELINE=<commit> 은 PROPOSAL_API_PRESENT 에서, HJ_V437_MUTATION=no-diff(차이 표시 제거)는 QC_DIFF_MARKED 에서,
   HJ_V437_MUTATION=case-filter(사례 묶음 거름 해제)는 PROPOSAL_CASE_FILTER 에서 실패해야 한다. */
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
const baseline = process.env.HJ_V437_BASELINE && execFileSync('git', ['show', process.env.HJ_V437_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const P = 'TEST_PROP 평화로운아파트 107동 1302호', CUST = '김제안', PHONE = '010-7777-1234';
const ITEMS = {
  Q1: [['철거', 1, 300000], ['방수', 1, 400000], ['타일', 1, 900000], ['양변기', 1, 250000]],
  Q2: [['철거', 1, 300000], ['방수', 1, 400000], ['타일', 1, 1200000], ['양변기', 1, 350000], ['수전', 2, 80000]],
  Q3: [['철거', 1, 300000], ['방수', 1, 500000], ['타일', 1, 1500000], ['양변기', 1, 450000], ['수전', 2, 120000], ['젠다이', 1, 300000], ['타일', 1, 100000, '추가']],
};
const VAT = { Q1: true, Q2: false, Q3: true };
const TIER = { Q1: 'basic', Q2: 'standard', Q3: 'premium' };
// 검사 쪽 계산 — 품목 이름 합집합(처음 나온 순서), 칸 = 수량×단가 합, 차이 = 칸 값(없음 포함)이 하나라도 다름
function expectCompare(ids) {
  const order = [], cols = ids.map(id => { const m = new Map(); let supply = 0; for (const [n, q, p] of ITEMS[id]) { const a = q * p; supply += a; if (!order.includes(n)) order.push(n); m.set(n, (m.get(n) || 0) + a); } const vat = Math.round(supply * 0.1); return { m, supply, vat, gross: supply + vat, shown: VAT[id] ? supply + vat : supply }; });
  const rows = order.map(n => { const cells = cols.map(c => c.m.has(n) ? c.m.get(n) : null); return { name: n, cells, diff: new Set(cells.map(v => v == null ? '-' : String(v))).size > 1 }; });
  return { rows, cols: cols.map(({ supply, vat, gross, shown }) => ({ supply, vat, gross, shown })), diffCount: rows.filter(r => r.diff).length };
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v437 = { external: [], deliver: [], print: [], share: [], sms: [], toasts: [] };
    window.open = (...args) => { __v437.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjQuoteCompare', 'hjQuoteCompareView', 'hjProposalHtml', 'hjProposalCasePhotos', 'hjProposalIssue', 'hjQuoteTierConfirm'].every(k => typeof window[k] === 'function') && typeof HJ_QUOTE_TIERS === 'object'), true, 'PROPOSAL_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const realToast = toast; toast = m => { __v437.toasts.push(String(m)); return realToast(m); };
    hjSendSms = (phone, text) => { __v437.sms.push({ phone, text }); };
    hjDocPrint = html => { __v437.print.push(String(html)); return true; };
    hjWarrantyShareHtml = async (name, html, fname, label) => { __v437.share.push({ name, html: String(html), fname, label }); return true; };
    const realDeliver = hjDocDeliverView; hjDocDeliverView = (...args) => { __v437.deliver.push({ name: args[0], html: args[1], base: args[2], label: args[3] }); return realDeliver(...args); };
  });
  const MUT = process.env.HJ_V437_MUTATION;
  if (MUT) {
    assert(['no-diff', 'case-filter'].includes(MUT), 'unknown mutation ' + MUT);
    if (MUT === 'no-diff') await page.evaluate(() => { const real = hjQuoteCompare; hjQuoteCompare = qs => { const c = real(qs); c.rows.forEach(r => { r.diff = false; }); c.diffCount = 0; return c; }; });
    if (MUT === 'case-filter') await page.evaluate(() => { hjCaseBlock = () => ''; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS proposal-v437 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async ({ P, CUST, PHONE, ITEMS, VAT, TIER }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = []; state.adPosts = [];
      const thumb = (() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#7a5230'; g.fillRect(0, 0, 40, 30); return c.toDataURL('image/jpeg', 0.6); })();
      const proj = (name, kind, extra) => Object.assign({ name, kind, stage: 1, phases: [], customer: { name: '사례고객', phone: '010-2222-3333', addr: '' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }, extra || {});
      const fields = { place: '유천동 행복아파트', symptom: '욕실 타일 들뜸', method: '타일 두드림 확인', cause: '바탕 들뜸 — 세대 전유', work: '욕실 전체 타일 재시공', duration: '3일' };
      const photo = (id, project, phase) => ({ id, kind: 'photo', name: id + '.jpg', project, _phase: phase, thumb, _driveId: 'drv_' + id, when: new Date('2026-09-0' + (id.length % 9 + 1) + 'T10:00:00'), size: 900 + id.length });   // 드라이브 사진 — 원자 저장 뒤에도 썸네일이 남는다(실제 사진처럼)
      state.projects = [
        proj(P, 'interior', { customer: { name: CUST, phone: PHONE, addr: '대전 중구 대흥동 평화로운아파트 107동 1302호' }, inquiryAt: '2026-10-01' }),
        proj('TEST_CASE1 유천동 욕실 리모델링', 'interior', { stage: 3, doneAt: '2026-09-20' }),
        proj('TEST_CASE2 욕실 동의 없음', 'interior', { stage: 3, doneAt: '2026-09-25' }),
        proj('TEST_CASE3 욕실 개인정보', 'interior', { stage: 3, doneAt: '2026-09-26' }),
        proj('TEST_CASE4 둔산동 욕실', 'interior', { stage: 3, doneAt: '2026-09-10' }),
        proj('TEST_CASE5 누수 욕실', 'leak', { stage: 3, doneAt: '2026-09-27' })];
      state.files = [photo('c1b', 'TEST_CASE1 유천동 욕실 리모델링', '시공 전'), photo('c1a', 'TEST_CASE1 유천동 욕실 리모델링', '완료'),
        photo('c2b', 'TEST_CASE2 욕실 동의 없음', '시공 전'), photo('c3b', 'TEST_CASE3 욕실 개인정보', '시공 전'),
        photo('c4b', 'TEST_CASE4 둔산동 욕실', '시공 전'), photo('c4pii', 'TEST_CASE4 둔산동 욕실', '1203호 욕실 완료'), photo('c5b', 'TEST_CASE5 누수 욕실', '시공 전')];
      const pack = (name, over) => { const p = state.projects.find(x => x.name === name); p.casePack = Object.assign({}, fields, { consent: true, photos: state.files.filter(f => f.project === name).map(f => hjFileRef(f)) }, over || {}); };
      pack('TEST_CASE1 유천동 욕실 리모델링'); pack('TEST_CASE2 욕실 동의 없음', { consent: false }); pack('TEST_CASE3 욕실 개인정보', { symptom: '107동 1302호 욕실 타일 들뜸' });
      pack('TEST_CASE4 둔산동 욕실', { place: '둔산동 한빛아파트' }); pack('TEST_CASE5 누수 욕실');
      state.notes = [{ id: 'inq', date: '2026. 10. 1. 오전 9:00:00', text: '[문의 접수] 2026-10-01 · 🥕 당근\n욕실 전체 리모델링 원해요 ' + PHONE + ' ' + CUST + '\n107동 1302호 욕실 방수가 걱정됩니다', project: P }];
      const q = (id, extra) => Object.assign({ id, no: id, title: '욕실 ' + id, date: '2026-10-0' + id.slice(1), place: '', vatIncluded: VAT[id] !== false, accountIdx: 0, memo: '', project: P,
        items: (ITEMS[id] || [['추가 견적', 1, 50000]]).map(([name, qty, price, spec]) => ({ name, spec: spec || '', qty, price })) }, extra || {});
      state.quotes = [q('Q1', { tier: TIER.Q1 }), q('Q2', { tier: TIER.Q2 }), q('Q3', { tier: TIER.Q3 }), q('Q4', { title: '추가 견적' })];
      state.quotes.forEach(x => syncQuoteToProject(x));
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null;
      for (const k of Object.keys(__v437)) __v437[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V437_SEED_SAVE_FAILED');
      return true;
    }, { P, CUST, PHONE, ITEMS, VAT, TIER });
  }
  async function snapshot() {
    return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() }; });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function shot(name) {
    if (!process.env.HJ_V437_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V437_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V437_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  await test('① 비교 계산 2안·3안(합집합·같은 이름 합산·차이·부가세 혼합) · 폰 카드 3장 세로 · 넓은 화면 표 · 3개 제한 · 읽기 전용', async () => {
    await seed(); const before = await snapshot();
    for (const ids of [['Q1', 'Q2'], ['Q1', 'Q2', 'Q3']]) {
      const got = await page.evaluate(ids => { const c = hjQuoteCompare(ids.map(id => state.quotes.find(q => q.id === id))); return { rows: c.rows.map(r => ({ name: r.name, cells: r.cells, diff: r.diff })), cols: c.cols.map(x => ({ supply: x.supply, vat: x.vat, gross: x.gross, shown: x.shown })), diffCount: c.diffCount, mixed: c.mixed, labels: c.cols.map(x => x.label) }; }, ids);
      const exp = expectCompare(ids);
      assert.deepEqual(got.rows, exp.rows, 'QC_DIFF_MARKED rows ' + ids.join('+')); assert.deepEqual(got.cols, exp.cols, 'totals ' + ids.join('+'));
      assert.equal(got.diffCount, exp.diffCount, 'QC_DIFF_MARKED'); assert.equal(got.mixed, true, 'VAT included + excluded is flagged');
      assert.deepEqual(got.labels, ids.map(id => ({ basic: '기본안', standard: '표준안', premium: '고급안' })[TIER[id]]));
    }
    assert.equal(expectCompare(['Q1', 'Q2', 'Q3']).diffCount, 5);
    await page.evaluate(name => hjQuoteCompareView(name), P); await page.locator('#hjQuoteCompare').waitFor();
    assert.deepEqual(await page.locator('[data-qc-card]').evaluateAll(n => n.map(x => x.dataset.qcCard)), ['Q1', 'Q2', 'Q3'], 'default = the three tiered quotes');
    const boxes = await page.locator('[data-qc-card]').evaluateAll(n => n.map(x => { const r = x.getBoundingClientRect(); return { x: Math.round(r.x), y: r.y, h: r.height, w: r.width }; }));
    assert(boxes.every(b => b.x === boxes[0].x) && boxes[1].y >= boxes[0].y + boxes[0].h - 1 && boxes[2].y >= boxes[1].y + boxes[1].h - 1, 'cards stack vertically on a phone: ' + JSON.stringify(boxes));
    assert.equal(await page.locator('[data-qc-card="Q3"] [data-qc-diff]').count(), 5, 'QC_DIFF_MARKED');
    await tapOk('#hjQuoteCompare [data-qc-choose], #hjQuoteCompare summary, #hjQuoteCompare label:has(#qcHide), #modalRoot .mfoot button'); await noOverflow(); await shot('01-cards');
    await page.locator('#hjQuoteCompare details').evaluate(d => { d.open = true; });
    await tapOk('#hjQuoteCompare label:has([data-qc-pick])');
    await page.locator('[data-qc-pick="Q4"]').click(); assert.match(await page.evaluate(() => __v437.toasts.at(-1)), /3개까지/); assert.equal(await page.locator('[data-qc-pick="Q4"]').isChecked(), false);
    await page.locator('[data-qc-pick="Q3"]').uncheck(); await page.waitForFunction(() => document.querySelectorAll('[data-qc-card]').length === 2);
    await close(); await page.setViewportSize({ width: 1024, height: 780 });
    await page.evaluate(name => hjQuoteCompareView(name), P); await page.locator('[data-qc-table]').waitFor();
    assert.equal(await page.locator('[data-qc-table] tr[data-qc-diff]').count(), 5, 'QC_DIFF_MARKED'); assert.equal(await page.locator('[data-qc-mixed]').count(), 1);
    assert.deepEqual(await page.locator('[data-qc-table] [data-qc-total="gross"] td').allInnerTexts(), ['부가세 포함 합계', ...expectCompare(['Q1', 'Q2', 'Q3']).cols.map(c => c.gross.toLocaleString('ko-KR') + '원')]);
    await shot('02-table'); await close(); await page.setViewportSize({ width: 390, height: 780 });
    sameSnapshot(await snapshot(), before, 'comparing never writes');
  });

  await test('② 제안서 — 고객 요청(번호·이름·동호수 지움)·비교표·사례 사진(동의·개인정보 거름, 같은 공종, 동+공정 설명)·조건 · 이름 가리기 · 가져간 때 한 번 기록', async () => {
    await seed();
    const photos = await page.evaluate(name => hjProposalCasePhotos(state.projects.find(p => p.name === name), 4).map(x => ({ id: x.id, label: x.label })), P);
    assert.deepEqual(photos, [{ id: 'c1b', label: '유천동 · 시공 전' }, { id: 'c1a', label: '유천동 · 완료' }, { id: 'c4b', label: '둔산동 · 시공 전' }], 'PROPOSAL_CASE_FILTER');
    await page.evaluate(name => hjQuoteCompareView(name), P); await page.locator('#hjQuoteCompare').waitFor();
    await footer('📄 제안서 만들기').click(); await page.waitForFunction(() => __v437.deliver.length === 1);
    const doc = await page.evaluate(() => __v437.deliver[0]);
    assert.equal(doc.label, '📊 견적 비교 제안서'); assert.match(doc.base, /_견적비교제안서_\d{8}$/);
    assert.match(doc.html, /견 적 비 교 제 안 서/); assert.match(doc.html, /김제안 님/); assert.match(doc.html, /data-qc-table/);
    assert.equal((doc.html.match(/data-qc-diff/g) || []).length, 5, 'QC_DIFF_MARKED');
    const req = doc.html.slice(doc.html.indexOf('1. 요청하신 내용'), doc.html.indexOf('2. 안별 비교'));
    assert.match(req, /욕실 전체 리모델링 원해요 \(번호 삭제\) 고객/); assert.match(req, /\(동·호수 삭제\) 욕실 방수가 걱정됩니다/); assert(!/7777|김제안|1302/.test(req), 'request is scrubbed');
    assert.deepEqual([...doc.html.matchAll(/data-photo="([^"]+)"/g)].map(m => m[1]), ['c1b', 'c1a', 'c4b'], 'PROPOSAL_CASE_FILTER');
    assert(!/TEST_CASE|사례고객|1203/.test(doc.html), 'case photos carry only 동 + 공정');
    assert.match(doc.html, /계약금 \d+% · 중도금 \d+% · 잔금 \d+%/); assert.match(doc.html, /방수 3년/);
    await tapOk('#hjDocPdf, #hjDocHtml, #hjDocSms, #hjDocImage'); await noOverflow(); await shot('03-deliver');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(name => (state.projects.find(p => p.name === name).proposals || []).length === 1, P);
    await page.locator('#hjDocHtml').click(); await page.waitForFunction(() => __v437.share.length === 1);
    await page.waitForTimeout(300);
    const rec = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name), stored = await idbGetStrict('appState'); return { list: p.proposals, stored: stored.projects.find(x => x.name === name).proposals, notes: state.notes.filter(n => /^\[제안서\]/.test(n.text)).map(n => n.text) }; }, P);
    assert.equal(rec.list.length, 1, 'PDF then share logs once'); assert.deepEqual(rec.list[0].quoteIds, ['Q1', 'Q2', 'Q3']); assert.equal(rec.list[0].pdfName, doc.base + '.pdf'); assert.equal(rec.list[0].via, 'pdf');
    assert.deepEqual(rec.stored, rec.list, 'durable'); assert.equal(rec.notes.length, 1); assert.match(rec.notes[0], /^\[제안서\] 견적 비교 3안 · /);
    const share = await page.evaluate(() => __v437.share[0]); assert.equal(share.label, '📊 견적 비교 제안서'); assert.equal(share.html, doc.html); assert.equal(share.fname, doc.base + '.html');
    await close(); await page.evaluate(name => hjQuoteCompareView(name), P); await page.locator('#qcHide').check(); await footer('📄 제안서 만들기').click(); await page.waitForFunction(() => __v437.deliver.length === 2);
    const hidden = await page.evaluate(() => __v437.deliver[1].html);
    assert(!/김제안|7777|1302|평화로운아파트/.test(hidden), 'hidden-name proposal has no customer name, phone, unit or complex'); assert.match(hidden, /대흥동 공사 제안/); assert.match(hidden, /고객님/); assert.equal((hidden.match(/data-photo=/g) || []).length, 3, 'case photos stay after the durable record');
  });

  await test('③ 고객 폰 — 파일 공유 경로(보증서와 같은 방식)·문자 초안만(자동 발송 없음)', async () => {
    await seed(); await page.evaluate(name => hjQuoteCompareView(name), P); await footer('📄 제안서 만들기').click(); await page.waitForFunction(() => __v437.deliver.length === 1);
    await page.locator('#hjDocSms').click(); await page.locator('#mcBody').waitFor();
    assert.match(await page.locator('#mcBody').inputValue(), /요청하신 견적 비교안입니다 — 안별 포함 품목과 금액을 파일로 보내드립니다/);
    assert.equal(await page.evaluate(() => __v437.sms.length), 0, 'draft only — nothing is sent');
  });

  await test('④ 견적 편집기 [안] 칸 · 안 여러 개 매출 경고 · [이 안으로 확정] → 나머지 안 매출 Σ 제외 · 문서 센터 항목 · 더보기 126', async () => {
    await seed(); const keys0 = (await snapshot()).keys;
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = JSON.parse(JSON.stringify(state.quotes.find(q => q.id === 'Q4'))); render(); });
    await page.locator('#qmTier').selectOption('premium'); assert.equal(await page.evaluate(() => state.editingQuote.tier), 'premium');
    await page.locator('#qmTier').selectOption(''); assert.equal(await page.evaluate(() => 'tier' in state.editingQuote), false, 'no empty tier field');
    await page.locator('#qmTier').selectOption('standard'); await page.locator('#qmSave').click();
    assert.match(await page.evaluate(() => __v437.toasts.at(-1)), /이 현장 견적 4개가 매출에 모두 더해집니다/);
    assert.equal(await page.evaluate(() => state.quotes.find(q => q.id === 'Q4').tier), 'standard');
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    assert.equal(await page.locator('#view [data-qtier]').count(), 4); await page.locator('#qmCompare').click(); await page.locator('#hjQuoteCompare').waitFor();
    await close(); await page.evaluate(name => hjQuoteCompareView(name, ['Q1', 'Q2', 'Q3']), P);
    await page.locator('[data-qc-card="Q2"] [data-qc-choose]').click();
    const after = await page.evaluate(name => ({ ex: ['Q1', 'Q2', 'Q3', 'Q4'].map(id => !!state.files.find(f => f.id === 'quote_' + id).exSum), supply: projStats(name).supply, note: state.notes.filter(n => /^\[견적 안 확정\]/.test(n.text)).map(n => n.text) }), P);
    assert.deepEqual(after.ex, [true, false, true, false]);
    assert.equal(after.supply, expectCompare(['Q2']).cols[0].supply + 50000, 'revenue = chosen standard + the unrelated extra quote');
    assert.deepEqual(after.note, ['[견적 안 확정] 표준안 — 나머지 2안은 매출 Σ 에서 뺌']);
    await close(); await page.evaluate(name => docHubView(name), P);
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="compare"]').innerText(), /앱 견적 4개/); assert.equal(await page.locator('#modalRoot .docHubBtn[data-act="todo:compare"]').count(), 0);
    await page.locator('#modalRoot .docHubBtn[data-act="compare"]').click(); await page.locator('#hjQuoteCompare').waitFor();
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.deepEqual((await snapshot()).keys, keys0, 'no new top-level keys');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v437.external), []);
  });
  console.log(`proposal-v437: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL proposal-v437', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
