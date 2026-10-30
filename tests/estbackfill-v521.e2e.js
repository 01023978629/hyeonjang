/* v521 안 읽은 견적서 — 견적서 폴더의 xlsx·pdf 는 [일괄 글자 읽기] 전까지 est 가 비어 매출에서 빠졌다(개발_구상_20261030 §2-2).
   스캔 뒤 견적서만 배경에서 자동 읽기(엑셀 먼저) + 견적 탭·첫 화면 점검 줄에 '읽지 않은 견적서 n건 → [지금 읽기]'.
   합성 자료만(이 기기 File 객체), 엑셀 라이브러리는 가짜(XLSX.read 가 JSON 격자를 돌려줌), PDF 글자 읽기는 대역, 바깥 쓰기 0.
   ① 읽기 전: 읽지 않은 4건(원본 없는 1건 포함) · 손으로 고친 금액(_edited)은 제외 · 견적 탭 줄·첫 화면 점검 줄 표시 · 매출 0 (UNREAD)
   ② 라이브러리를 못 받으면(오프라인) 'done' 으로 찍지 않고 pending 으로 남음 — 읽음 0 (OFFLINE)
   ③ [지금 읽기] 클릭 → 엑셀 2 + PDF 1 읽음, 금액·품목 채워짐, 같은 현장의 xlsx·pdf 사본은 매출 1건만, 남은 1건은 원본 없음 안내, 다시 눌러도 중복 없음 (READ)
   ④ 스캔 끝·파일 선택 끝에 자동 읽기가 걸려 있음(소스 확인) · 오류 0
   HJ_V521_BASELINE=<commit> 은 UNREAD 에서(함수 없음) 실패해야 한다. HJ_V521_MUTATION=mark-done(못 읽어도 done) 은 OFFLINE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V521_MUTATION || '';
let html = process.env.HJ_V521_BASELINE ? execFileSync('git', ['show', process.env.HJ_V521_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (MUT) {
  assert.equal(MUT, 'mark-done');
  html = html || SRC;
  const needle = "if(unavailable){f._readFail=(f._readFail||0)+1;return {moved:false,unavailable:true};}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'if(unavailable){f.ocr="done";return {moved:false,unavailable:true};}');
}
const P1 = 'TEST_가아파트 302호', P2 = 'TEST_나아파트 상가';

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' }));
    // 가짜 엑셀 라이브러리: 파일 내용(JSON 격자)을 그대로 시트로 돌려준다 — 앱의 격자 → 견적 변환은 진짜 코드가 한다
    window.__fakeXLSX = { read: u8 => ({ SheetNames: ['S'], Sheets: { S: JSON.parse(new TextDecoder().decode(u8)) } }), utils: { sheet_to_json: ws => ws } };
    window.XLSX = window.__fakeXLSX;
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async ({ P1, P2 }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; } catch (_) {}
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.quotes = []; state.payLog = []; state.expenses = []; state.notes = [];
    state.projects = [P1, P2].map(name => ({ name, kind: 'interior', stage: 1, received: 0, phases: [], archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }));
    // PDF 글자 읽기 대역 — 라이브러리 없이 글자만 돌려준다
    ensurePdfjs = async () => {}; pdfText = async () => '견 적 서\n합계금액 1,000,000원\n공급가액 1,000,000원';
    const grid = (title, items) => [['견 적 서'], ['견적일자', '2026-10-20'], ['품명', '규격', '수량', '단가', '공급가액'], ...items, ['합계', '', '', '', items.reduce((a, r) => a + r[2] * r[3], 0)]];
    const mk = async (name, g, patch) => { const f = new File([JSON.stringify(g)], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const rec = await ingestFile(f); Object.assign(rec, patch); return rec; };
    await mk('2026-10-20 ' + P1 + ' 욕실 견적.xlsx', grid('A', [['타일 철거', '바닥', 1, 400000, 400000], ['벽 타일', '300x600', 1, 600000, 600000]]), { kind: 'estimate', project: P1 });
    await mk('2026-10-20 ' + P1 + ' 욕실 견적.pdf', [['pdf']], { kind: 'estimate', project: P1 });
    await mk(P2 + ' 견적 2026-10-21.xlsx', grid('C', [['상가 도배', '전체', 1, 2000000, 2000000]]), { project: P2 });   // kind 'other' — 이름의 '견적'으로 잡힌다
    await mk('2026-10-22 ' + P2 + ' 추가 견적.xlsx', grid('D', [['전기', '', 1, 300000, 300000]]), { kind: 'estimate', project: P2, est: { amount: 330000, _edited: true } });   // 손으로 고친 금액 — 다시 읽지 않는다
    state.files.push({ id: 'TEST_E_DRIVE', name: '2026-10-23 ' + P2 + ' 견적(드라이브).xlsx', ext: 'xlsx', size: 1234, kind: 'estimate', project: P2, when: new Date('2026-10-23T09:00:00+09:00'), text: '', ocr: 'pending', est: null, quote: null, contact: null, _virtual: true, _driveId: 'TEST_DRIVE_1' });   // 원본이 이 기기에 없음
    state.activeProject = null; state.tab = 'estimates'; render();
  }, { P1, P2 });
  async function test(name, fn) { await fn(); passed++; console.log('PASS estbackfill-v521 ' + name); }
  const salesOf = pj => page.evaluate(p => salesEstimateFiles().filter(f => f.project === p).map(f => ({ name: f.name, amount: f.est && f.est.amount })), pj);

  await test('① 읽기 전: 읽지 않은 4건 · _edited 제외 · 견적 탭 줄 · 첫 화면 점검 줄 · 매출 0 (UNREAD)', async () => {
    const r = await page.evaluate(() => ({ unread: hjUnreadEstimates().map(f => f.name), readable: hjUnreadEstimates().filter(hjEstimateReadable).length,
      bar: (document.querySelector('[data-unread-est]') || {}).textContent || '', btn: document.querySelector('[data-est-read]') ? Math.round(document.querySelector('[data-est-read]').getBoundingClientRect().height) : 0,
      daily: dailyCheckData().map(i => i.t).filter(t => /읽지 않은 견적서/.test(t)) }));
    assert.equal(r.unread.length, 4, 'UNREAD four pending estimate docs ' + JSON.stringify(r.unread));
    assert(!r.unread.some(n => /추가 견적/.test(n)), 'edited amount is not unread');
    assert.equal(r.readable, 3, 'three readable on this device');
    assert.match(r.bar, /읽지 않은 견적서 4건/, 'UNREAD estimates tab bar ' + r.bar); assert.match(r.bar, /원본이 이 기기에 없는 1건/, 'unreadable note ' + r.bar);
    assert(r.btn >= 44, 'read button 44px ' + r.btn);
    assert.deepEqual(r.daily, ['읽지 않은 견적서 4건 — 읽어야 매출에 들어갑니다'], 'daily check item ' + JSON.stringify(r.daily));
    assert.deepEqual(await salesOf(P1), [], 'no revenue before reading');
  });

  await test('② 오프라인(라이브러리 없음): done 으로 찍지 않고 pending 으로 남음 (OFFLINE)', async () => {
    const r = await page.evaluate(async () => {
      const keep = window.XLSX; delete window.XLSX; Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      try { const res = await hjEstimateAutoRead({ silent: true }); return { res, pending: hjUnreadEstimates().length, done: state.files.filter(f => f.ocr === 'done' && /견적/.test(f.name)).length, est: state.files.filter(f => f.est && f.est.amount && !f.est._edited).length }; }
      finally { window.XLSX = keep; Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); }
    });
    assert.equal(r.res.읽음, 0, 'nothing read offline ' + JSON.stringify(r));
    assert.equal(r.pending, 4, 'OFFLINE still pending ' + JSON.stringify(r)); assert.equal(r.done, 0, 'OFFLINE none marked done ' + JSON.stringify(r)); assert.equal(r.est, 0);
  });

  await test('③ [지금 읽기] → 엑셀 2 + PDF 1 읽음 · 금액·품목 · 사본은 매출 1건 · 남은 1건 안내 · 다시 눌러도 중복 없음 (READ)', async () => {
    const nFiles = await page.evaluate(() => state.files.length);
    await page.locator('[data-est-read]').click();
    await page.waitForFunction(() => hjUnreadEstimates().length === 1, null, { timeout: 15000 });
    await page.waitForFunction(() => !!document.querySelector('[data-unread-est="1"]'));
    const r = await page.evaluate(({ P1, P2 }) => { const by = n => state.files.find(f => f.name.includes(n));
      const a = by('욕실 견적.xlsx'), b = by('욕실 견적.pdf'), c = by('견적 2026-10-21'), d = by('추가 견적'), e = by('드라이브');
      return { a: { ocr: a.ocr, amount: a.est && a.est.amount, items: a.quote && quoteRealItems(a.quote).length, kind: a.kind }, b: { ocr: b.ocr, amount: b.est && b.est.amount }, c: { ocr: c.ocr, kind: c.kind, amount: c.est && c.est.amount },
        d: { ocr: d.ocr, amount: d.est.amount }, e: { ocr: e.ocr, est: e.est }, bar: (document.querySelector('[data-unread-est]') || {}).textContent || '', btn: !!document.querySelector('[data-est-read]'), files: state.files.length,
        daily: dailyCheckData().map(i => i.t).filter(t => /읽지 않은 견적서/.test(t)) }; }, { P1, P2 });
    assert.deepEqual(r.a, { ocr: 'done', amount: 1000000, items: 2, kind: 'estimate' }, 'READ xlsx A (부가세 별도 시트 → 공급가가 견적금액) ' + JSON.stringify(r.a));
    assert.deepEqual(r.b, { ocr: 'done', amount: 1000000 }, 'READ pdf B ' + JSON.stringify(r.b));
    assert.deepEqual(r.c, { ocr: 'done', kind: 'estimate', amount: 2000000 }, 'READ xlsx C classified by content ' + JSON.stringify(r.c));
    assert.deepEqual(r.d, { ocr: 'pending', amount: 330000 }, 'edited amount untouched ' + JSON.stringify(r.d));
    assert.deepEqual(r.e, { ocr: 'pending', est: null }, 'unreadable stays pending ' + JSON.stringify(r.e));
    assert.match(r.bar, /읽지 않은 견적서 1건/); assert.match(r.bar, /원본이 이 기기에 없는 1건/); assert.equal(r.btn, false, 'no read button when nothing is readable');
    assert.deepEqual(r.daily, ['읽지 않은 견적서 1건 — 읽어야 매출에 들어갑니다']);
    assert.equal(r.files, nFiles, 'no records added');
    const s1 = await salesOf(P1); assert.equal(s1.length, 1, 'xlsx·pdf copies count once ' + JSON.stringify(s1)); assert.equal(s1[0].amount, 1000000); assert.match(s1[0].name, /\.xlsx$/, 'xlsx is the representative');
    const s2 = await salesOf(P2); assert.deepEqual(s2.map(x => x.amount).sort(), [2000000, 330000].sort(), 'P2 revenue ' + JSON.stringify(s2));
    const again = await page.evaluate(() => hjEstimateAutoRead({ silent: true }));
    assert.equal(again.읽음, 0, 'second run reads nothing ' + JSON.stringify(again)); assert.equal(again.남음, 1);
  });

  await test('④ 스캔 끝·파일 선택 끝에 자동 읽기가 걸려 있음 · 오류 0', async () => {
    assert.match(SRC, /aiAutoOrgOffer\('scan'\),600\);setTimeout\(\(\)=>\{try\{quoteAutoAssignOffer\(\);\}catch\(e\)\{\}\},1400\);setTimeout\(\(\)=>\{try\{hjEstimateAutoRead\(\{silent:true,from:'scan'\}\)/, 'scan hook');
    assert.match(SRC, /aiAutoOrgOffer\('pick'\),600\);setTimeout\(\(\)=>\{try\{hjEstimateAutoRead\(\{silent:true,from:'pick'\}\)/, 'pick hook');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`estbackfill-v521: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL estbackfill-v521', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
