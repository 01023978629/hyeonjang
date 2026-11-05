/* v555 🗂 증빙 묶음 — 간이영수증 문서 포함 · [지금 생성] 새 번호 안내 (11/4 리허설 r1-11 관찰 2건). 합성 자료만, JSZip/XLSX/PDF 는 기록용 스텁, 외부 쓰기 0.
   ① 세무사용 계획: 발행 기록(p.docs payrcpt, ref=입금 줄)으로 '03_영수증/간이영수증_MM-….html' 이 담기고(번호·금액·수령일·결제방법·수령구분이 입금 줄과 같음), 참고 줄에 '다시 만들어 담았습니다', 빠진 것에는 없음 (RCPT)
   ② 입금 줄이 없는 기록은 기록 이름의 금액으로 · 금액 숨김(보험용)이면 종전대로 넣지 않고 빠진 것에 번호 · ZIP(스텁)에 실제로 들어감 · 묶음 기록은 종전대로 (EDGE)
   ③ 누수 보고서: 발행한 LR 이 있을 때 [지금 생성] 체크 옆 안내와 계획 참고 줄에 '새 번호 LR-…-02'·'이미 발행한 LR-…-01' 이 보이고, 끄면 빠진 것 줄에 발행 번호·새 번호가 적힘 · 발행이 없으면 다음 번호만 (LRNO)
   ④ 소스·핀 3곳(v555 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0 · 계획은 읽기 전용(저장 상태 불변)
   HJ_V555_BASELINE=<commit> 은 ① 에서, HJ_V555_MUTATION=no-rcpt(간이영수증 담기 삭제)는 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V555_MUTATION || '';
let html = process.env.HJ_V555_BASELINE ? execFileSync('git', ['show', process.env.HJ_V555_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-rcpt');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "    put.forEach(x=>add('03_영수증/간이영수증_'+safeName(x.r.no)+'.html','html',x.h));";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const LEAK = 'T555 누수 빌라', PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let browser, passed = 0, page;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS evidencefix-v555 ' + name); }
async function seed(opts) {
  await page.evaluate(() => { try { closeModal(true); } catch (_) {} });
  await page.evaluate(async ({ leak, png, opts }) => {
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.expenses = [];
    const day = localDate(), at = day + 'T03:00:00.000Z';
    const p = { name: leak, kind: 'leak', stage: 3, phases: [], customer: { name: '가상 고객', phone: '010-0000-1234', addr: '대전 가상동 1' }, received: 352000, archived: false, doneAt: day, cost: { material: 20000, labor: 30000, outsource: 0 } };
    p.leak = { intake: { where: ['욕실'], since: '오늘', amount: '똑똑 떨어짐', at }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', place: '세면대 하부', at } };
    if (opts.reports) p.leak.reports = opts.reports.map((no, i) => ({ no, at: day + 'T0' + (4 + i) + ':00:00.000Z', purpose: 'insurance', pdfName: no + '_보험사 제출용_누수보고서.pdf' }));
    p.warranty = { startedAt: day, items: [{ name: '배관 수리', months: 24, expiresAt: hjAddDays(day, 730) }] };
    p.docs = [{ type: 'payrcpt', no: 'MM-20261016-01', at, purpose: '잔금', name: '간이영수증 352,000원', ref: 'T555_PAY_1' }];
    if (opts.orphan) p.docs.push({ type: 'payrcpt', no: 'MM-20261016-02', at, purpose: '추가공사비', name: '간이영수증 77,000원', ref: 'T555_PAY_GONE' });
    if (opts.blank) p.docs.push({ type: 'payrcpt', no: 'MM-20261016-03', at, purpose: '', name: '간이영수증', ref: '' });
    state.projects = [p];
    state.quotes = [{ id: 'T555_Q', project: leak, title: 'T555 누수 견적', date: day, leak: { from: 'template', cause: '온수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 320000 }], vatIncluded: true, memo: '' }];
    state.payLog = [{ id: 'T555_PAY_1', d: day, project: leak, amt: 352000, method: '계좌이체', quoteId: 'T555_Q' }];
    state.files = [{ id: 'T555_PH1', kind: 'photo', project: leak, name: 'before.jpg', ext: 'jpg', when: day + 'T00:30:00.000Z', thumb: png, _leaktag: 'before' }];
    if (opts.receiptPhoto) state.files.push({ id: 'T555_RC', kind: 'receipt', project: leak, name: '영수증_가상.jpg', ext: 'jpg', when: day + 'T06:00:00.000Z', thumb: png });
    state.quotes.forEach(x => syncQuoteToProject(x));   // 저장본 복원은 견적마다 가상 견적 파일을 기대한다(없으면 발행 기록 저장이 'saved file count conflict') — files 를 다 채운 뒤에
    state.activeProject = leak; state.tab = 'project'; state.search = '';
    __relay.url = ''; __relay.token = ''; __gdToken = null; __t555.zips.length = 0; __t555.downloads.length = 0;
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw Error('T555_SEED_SAVE_FAILED');
  }, { leak: LEAK, png: PNG, opts: opts || {} });
}
const plan = (input) => page.evaluate(({ name, input }) => { const pl = hjEvidencePlan(name, input); return { paths: pl.entries.map(e => e.path), notes: pl.notes, infos: pl.infos || [], html: Object.fromEntries(pl.entries.filter(e => e.kind === 'html').map(e => [e.path, String(e.payload)])), list: pl.entries[0].payload, count: pl.entries.length }; }, { name: LEAK, input });
const stored = () => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return paidStableJson(live) + '|' + paidStableJson(await idbGetStrict('appState')); });

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__t555 = { zips: [], downloads: [] }; window.open = () => null;
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    window.ensureJSZip = async () => {}; window.ensureXLSX = async () => {};
    window.JSZip = function () { const files = {}; __t555.zips.push(files); const make = prefix => ({ file(p, b) { files[prefix + p] = typeof b === 'string' ? b : 'BLOB'; return this; }, folder(n) { return make(prefix + n + '/'); } }); const api = make(''); api.generateAsync = async () => new Blob([JSON.stringify(Object.keys(files))], { type: 'application/zip' }); return api; };
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => rows, book_append_sheet: (wb, ws, name) => { wb.sheets.push({ name, rows: ws }); } }, write: wb => JSON.stringify(wb.sheets), writeFile: () => {} };
    hjEvidenceDownload = (blob, name) => { __t555.downloads.push(name); };
    hjEvidenceDrive = async () => { throw new Error('T555_NO_DRIVE'); };
    __docExport = async () => new Blob(['%PDF-TEST'], { type: 'application/pdf' });
  }, BOOT);

  await test('① 세무사용 계획에 발행한 간이영수증 문서가 담긴다 — 번호·금액·수령일·결제방법·수령구분 = 입금 줄 (RCPT)', async () => {
    await seed({}); const before = await stored();
    const r = await plan({ purpose: 'tax' });
    const key = '03_영수증/간이영수증_MM-20261016-01.html';
    assert(r.paths.includes(key), 'receipt document in plan: ' + r.paths.join(', '));
    const h = r.html[key]; const day = await page.evaluate(() => localDate());
    for (const needle of ['MM-20261016-01', '352,000', day.replace(/-/g, '.'), '계좌이체', '잔금', LEAK]) assert(h.includes(needle), 'receipt html has ' + needle);
    assert(r.infos.some(n => /간이영수증 1건\(MM-20261016-01\)은 발행 기록으로 다시 만들어 담았습니다/.test(n)), 'info line: ' + JSON.stringify(r.infos));
    assert(!r.notes.some(n => /간이영수증/.test(n)), 'not listed as missing: ' + JSON.stringify(r.notes));
    assert(/\[참고\]\n· 간이영수증 1건/.test(r.list) && /· 03_영수증\/간이영수증_MM-20261016-01\.html/.test(r.list), '00_목록 lists the document and the note');
    assert.equal(await stored(), before, 'plan is read only');
  });

  await test('② 입금 줄 없는 기록은 이름의 금액으로 · 금액 숨김이면 안 담고 빠진 것에 · ZIP 에 실제로 들어감 (EDGE)', async () => {
    await seed({ orphan: true, blank: true, receiptPhoto: true });
    let r = await plan({ purpose: 'tax' });
    assert(r.paths.includes('03_영수증/간이영수증_MM-20261016-02.html') && r.html['03_영수증/간이영수증_MM-20261016-02.html'].includes('77,000'), 'orphan record rebuilt from its name amount');
    assert(!r.paths.includes('03_영수증/간이영수증_MM-20261016-03.html'), 'record without pay row or amount is not fabricated');
    assert(r.notes.some(n => /간이영수증 1건\(MM-20261016-03\) — 입금 기록을 찾지 못해/.test(n)), 'blank record named as missing: ' + JSON.stringify(r.notes));
    assert(r.paths.includes('03_영수증/영수증_가상.jpg') && !r.notes.some(n => /영수증 사진 없음/.test(n)), 'receipt photo still first');
    r = await plan({ purpose: 'insurance', hideAmount: true });
    assert(!r.paths.some(p => /간이영수증_/.test(p)) && r.notes.some(n => /간이영수증 3건\(MM-20261016-01, MM-20261016-02, MM-20261016-03\) — 금액 숨김이라 넣지 않았어요/.test(n)), 'hidden amounts: ' + JSON.stringify(r.notes));
    r = await plan({ purpose: 'insurance' });
    assert(r.paths.includes('03_영수증/간이영수증_MM-20261016-01.html') && !r.list.includes('010-0000-1234'), 'insurance bundle (amounts shown): receipt included, phone only inside the document like 명세서·보증서, not in 00_목록');
    const b = await page.evaluate(name => hjEvidenceBundle(name, { purpose: 'tax' }, 'download'), LEAK);
    const zip = await page.evaluate(() => __t555.zips.at(-1));
    const inZip = Object.keys(zip).filter(k => /03_영수증\/간이영수증_/.test(k));
    assert.deepEqual(inZip, [LEAK + '/03_영수증/간이영수증_MM-20261016-01.html', LEAK + '/03_영수증/간이영수증_MM-20261016-02.html'], 'receipt documents inside the zip');
    assert(zip[inZip[0]].includes('MM-20261016-01') && b.skipped === 0 && b.added === Object.keys(zip).length, 'zip build ' + JSON.stringify(b));
    const docs = await page.evaluate(name => state.projects.find(p => p.name === name).docs.map(d => d.type), LEAK);
    assert.deepEqual(docs, ['payrcpt', 'payrcpt', 'payrcpt', 'evidence'], 'bundle record as before');
  });

  await test('③ [지금 생성] 안내 — 발행한 LR 이 있으면 새 번호·기존 번호를 체크 옆·참고·빠진 것에 적는다 (LRNO)', async () => {
    const day = (await page.evaluate(() => localDate())).replace(/-/g, '');
    await seed({ reports: ['LR-' + day + '-01'] });
    let r = await plan({ purpose: 'insurance' });
    assert(r.notes.some(n => n.includes('누수 보고서 발행 1건(LR-' + day + '-01)') && n.includes('새 번호 LR-' + day + '-02')), 'off: ' + JSON.stringify(r.notes));
    r = await plan({ purpose: 'insurance', genLeakReport: true });
    assert(r.paths.includes('04_보고서/누수보고서_LR-' + day + '-02_(지금 생성).pdf'), 'planned path carries the new number: ' + r.paths.join(', '));
    assert(r.infos.some(n => n.includes('새 번호 LR-' + day + '-02') && n.includes('이미 발행한 LR-' + day + '-01') && /하나만 보내세요/.test(n)), 'info: ' + JSON.stringify(r.infos));
    await page.evaluate(name => hjEvidenceView(name), LEAK);
    const label = await page.locator('#hjEvidenceForm label:has(#evGenLeak)').innerText();
    assert(label.includes('새 번호 LR-' + day + '-02') && label.includes('이미 발행한 LR-' + day + '-01'), 'checkbox label: ' + label);
    await page.locator('#evGenLeak').check();
    assert.match(await page.locator('[data-evidence-info]').innerText(), /새 번호 LR-\d{8}-02/, 'preview info after checking');
    await page.evaluate(() => closeModal(true));
    await seed({});
    r = await plan({ purpose: 'insurance' });
    assert(r.notes.some(n => n.includes('누수 보고서 없음 — [지금 생성]을 켜면 LR-' + day + '-01 로 발행해서 담습니다')) && r.infos.every(n => !/새 번호/.test(n)), 'no issued report: next number only ' + JSON.stringify(r.notes));
    await page.evaluate(name => hjEvidenceView(name), LEAK);
    assert.match(await page.locator('#hjEvidenceForm label:has(#evGenLeak)').innerText(), new RegExp('LR-' + day + '-01 로 발행됩니다'), 'label without issued reports');
    await page.evaluate(() => closeModal(true));
  });

  await test('④ 소스·핀 3곳(v555 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('function hjEvidencePayRcptHtml(p,r){') && src.includes('function hjEvidenceLeakNoHint(p){'), 'v555 source markers');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 555, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('evidencefix-v555: ' + passed + '/4 PASS; synthetic data; zip/xlsx/pdf stubbed; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL evidencefix-v555', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });
