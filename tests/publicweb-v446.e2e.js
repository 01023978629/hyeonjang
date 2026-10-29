/* v446 공개 웹 — 리뷰 QR(앱 안 인코더) · ⭐ 리뷰 QR 카드 · 완료보고서·간이영수증 끝 QR 토글 · 사례 ZIP case.json · 홈페이지 초안 도구 계약.
   합성 레코드만, 외부 쓰기 0. QR 은 두 갈래로 확인한다 — ① 공개 참조 구현(Nayuki QR Code generator, python qrcodegen 1.8)이
   같은 글자로 낸 그림의 지문(sha256) ② 이 파일의 디코더(형식 정보 BCH·RS 신드롬·바이트 모드)로 그림을 다시 읽어 링크가 그대로 나오는지.
   HJ_V446_BASELINE=<commit> 은 PUBLICWEB_API_PRESENT 에서, HJ_V446_MUTATION=qr-format(형식 정보 한 칸 뒤집기)은 QR_REFERENCE_MATCH 에서,
   HJ_V446_MUTATION=case-labels(재료 글 줄 이름을 화면 이름으로 되돌림)는 SITE_PARSER_CONTRACT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_PW_LEAK 평화로운아파트 107동 1302호', CUST = '테스트고객', PHONE = '010-1234-5678';
const LINK = 'https://naver.me/5Abc12Xy';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const baseline = process.env.HJ_V446_BASELINE && execFileSync('git', ['show', process.env.HJ_V446_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

/* 참조 구현이 낸 지문 — python: QrCode.encode_segments([QrSegment.make_bytes(t.encode('utf-8'))], Ecc.MEDIUM, 1, 10, -1, False),
   행마다 '1'/'0' 을 잇고 줄바꿈으로 묶은 글의 sha256. 2026-10-16 생성. */
const GOLDEN = [
  { text: 'https://naver.me/5Abc12Xy', version: 2, mask: 6, sha256: 'ab206ac74a3c5a6580e0e879a7a1acd8d48e3c8dea04e0deac38eacb87e615c0' },
  { text: 'https://m.place.naver.com/place/1234567890/review/visitor', version: 4, mask: 2, sha256: '526475969ceccd0a25e77ce3c973b18961c4d5fa7de35724bdf3a4b7ee6941ad' },
  { text: 'https://place.map.kakao.com/123456789#review', version: 4, mask: 2, sha256: '44d72c11de812f058e387ccd16f6f0a6abd1bcecbf3e640b35803732b329bab9' },
  { text: '만물인테리어 리뷰 남기기 https://naver.me/xYz', version: 4, mask: 3, sha256: '402f38b0c8c4a3dc0f22243e9676f6cf7c9a11a772e00fc5bb291f8eb7dd4597' },
  { text: 'https://example.com/r/' + 'a1b2c3d4e5'.repeat(12), version: 8, mask: 2, sha256: 'eee5160fc8c3a9c7688f0d70f0158c06f805fb1ef8ae79fc82e08d6ad5db102b' },
  { text: 'https://example.com/r/' + 'z9y8x7w6v5'.repeat(18) + 'abcd', version: 10, mask: 2, sha256: 'e1e4ab88aabe02d2b1b7c850a25af40cf1b7f7602d23e15624e95261bfe952bf' },
];

/* 검사 쪽 QR 디코더 — 앱 코드를 쓰지 않는다. 표는 ISO/IEC 18004 표 그대로(정렬 패턴 위치·총 코드워드·M 블록). */
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
const TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };
const ECC_M = { 1: [10, 1], 2: [16, 1], 3: [26, 1], 4: [18, 2], 5: [24, 2], 6: [16, 4], 7: [18, 4], 8: [22, 4], 9: [22, 5], 10: [26, 5] };
const EXP = new Array(512), LOG = new Array(256);
{ let v = 1; for (let i = 0; i < 255; i++) { EXP[i] = v; LOG[v] = i; v <<= 1; if (v & 0x100) v ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const gmul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
function qrDecode(rows) {
  const size = rows.length, ver = (size - 17) / 4, get = (x, y) => rows[y][x] === '1';
  assert(Number.isInteger(ver) && ver >= 1 && ver <= 10 && rows.every(r => r.length === size), 'QR grid ' + size);
  let f1 = 0, f2 = 0;
  for (let i = 0; i <= 5; i++) if (get(8, i)) f1 |= 1 << i;
  if (get(8, 7)) f1 |= 1 << 6; if (get(8, 8)) f1 |= 1 << 7; if (get(7, 8)) f1 |= 1 << 8;
  for (let i = 9; i < 15; i++) if (get(14 - i, 8)) f1 |= 1 << i;
  for (let i = 0; i < 8; i++) if (get(size - 1 - i, 8)) f2 |= 1 << i;
  for (let i = 8; i < 15; i++) if (get(8, size - 15 + i)) f2 |= 1 << i;
  assert.equal(f1, f2, 'QR two format copies agree');
  const data = (f1 ^ 0x5412) >>> 10; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(((data << 10) | rem) ^ 0x5412, f1, 'QR format BCH');
  assert.equal(data >>> 3, 0, 'QR error correction level M'); const mask = data & 7;
  const fn = rows.map(() => new Array(size).fill(false)), mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) fn[y][x] = true; };
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) mark(x, y);
  for (let y = 0; y < 9; y++) for (let x = size - 8; x < size; x++) mark(x, y);
  for (let y = size - 8; y < size; y++) for (let x = 0; x < 9; x++) mark(x, y);
  const al = ALIGN[ver];
  al.forEach((a, i) => al.forEach((b, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(a + dx, b + dy); }));
  if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { mark(size - 11 + j, i); mark(i, size - 11 + j); }
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v; if (!fn[y][x]) bits.push(get(x, y) !== MASKS[mask](x, y)); }
  }
  const T = TOTAL[ver], [ecLen, nb] = ECC_M[ver], words = [];
  for (let i = 0; i < T; i++) { let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | (bits[i * 8 + k] ? 1 : 0); words.push(b); }
  const shortLen = Math.floor(T / nb), nShort = nb - T % nb, dlen = j => shortLen - ecLen + (j < nShort ? 0 : 1);
  const blocks = Array.from({ length: nb }, () => ({ d: [], e: [] })); let k = 0;
  for (let i = 0; i < shortLen - ecLen + 1; i++) for (let j = 0; j < nb; j++) if (i < dlen(j)) blocks[j].d.push(words[k++]);
  for (let i = 0; i < ecLen; i++) for (let j = 0; j < nb; j++) blocks[j].e.push(words[k++]);
  assert.equal(k, T, 'QR codeword count');
  blocks.forEach((b, j) => { const cw = b.d.concat(b.e); for (let i = 0; i < ecLen; i++) { let s = 0; for (const c of cw) s = gmul(s, EXP[i]) ^ c; assert.equal(s, 0, 'QR RS syndrome block ' + j + ' #' + i); } });
  const db = []; blocks.forEach(b => b.d.forEach(w => { for (let i = 7; i >= 0; i--) db.push((w >>> i) & 1); }));
  let p = 0; const read = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | db[p++]; return v; };
  assert.equal(read(4), 4, 'QR byte mode'); const len = read(ver < 10 ? 8 : 16), out = [];
  for (let i = 0; i < len; i++) out.push(read(8));
  return { text: Buffer.from(out).toString('utf8'), version: ver, mask };
}
/* manmool 저장소 scripts/new-case-post.mjs parseMaterial 의 정규식 그대로(2026-10-16 main 53a6bef). 그쪽이 바뀌면 여기도 같이. */
const SITE_PARSE = [
  ['place', /^(?:1\.\s*)?동네\+단지\s*:\s*(.+)$/m],
  ['symptom', /^(?:2\.\s*)?(?:어떤 연락|증상)\s*:\s*(.+)$/m],
  ['method', /^(?:3\.\s*)?탐지 방법\s*:\s*(.+)$/m],
  ['cause', /^(?:4\.\s*)?원인\+전유\/공용\s*:\s*(.+)$/m],
  ['work', /^(?:5\.\s*)?공사 내용\s*:\s*(.+)$/m],
  ['duration', /^(?:6\.\s*)?걸린 시간\s*:\s*(.+)$/m],
];
const siteParse = text => { const out = {}; for (const [key, re] of SITE_PARSE) { const m = String(text || '').match(re); if (m) out[key] = m[1].replace(/\s*←.*$/, '').trim(); } return out; };
const FIELDS = { place: '대흥동 평화로운아파트', symptom: '아랫집 천장 물자국', method: '청음·가스 탐지로 배관 위치 확인', cause: '욕실 바닥 온수 배관 이음부 — 세대 전유', work: '바닥 부분 개방 → 배관 교체 → 압력 확인', duration: '당일 09:30~15:40' };

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
    window.__v446 = { external: [], print: [], deliver: [], pdf: [], toasts: [] };
    window.open = (...args) => { __v446.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjQrMatrix', 'hjQrPngDataUrl', 'hjReviewQrCardView', 'hjQrToggleHtml', 'hjCaseJson', 'hjAdBanned'].every(k => typeof window[k] === 'function') && typeof HJ_CASE_SITE_LABEL === 'object'), true, 'PUBLICWEB_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const realToast = toast; toast = m => { __v446.toasts.push(String(m)); return realToast(m); };
    hjDocPrint = html => { __v446.print.push(html); return true; };
    const realDeliver = hjDocDeliverView; hjDocDeliverView = (...args) => { __v446.deliver.push({ name: args[0], html: args[1], base: args[2], label: args[3] }); return realDeliver(...args); };
    window.jspdf = { jsPDF: function () { const rec = { pages: [], saved: null }; __v446.pdf.push(rec); return { addPage() {}, addImage(src) { rec.pages.push(src); }, save(n) { rec.saved = n; } }; } };
    ensureJsPDF = async () => {};
    // 이미지 한 장을 다시 읽는다 — m(칸 픽셀)을 모르면 왼쪽 위 파인더가 시작하는 자리(여백 4칸)로 잰다
    window.__qrSample = async (src, box) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
      const dark = (x, y) => { const i = (Math.floor(y) * c.width + Math.floor(x)) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 128; };
      let { x, y, m, n } = box || {};
      if (!m) { let kk = 0; while (kk < c.width && !dark(kk, kk)) kk++; m = kk / 4; n = Math.round(c.width / m); x = 0; y = 0; }
      const size = n - 8, rows = [];
      for (let r = 0; r < size; r++) { let row = ''; for (let col = 0; col < size; col++) row += dark(x + (col + 4) * m + m / 2, y + (r + 4) * m + m / 2) ? '1' : '0'; rows.push(row); }
      return rows;
    };
  });
  const MUT = process.env.HJ_V446_MUTATION;
  if (MUT) {
    assert(['qr-format', 'case-labels'].includes(MUT), 'unknown mutation ' + MUT);
    if (MUT === 'qr-format') await page.evaluate(() => { const real = hjQrMatrix; hjQrMatrix = (t, m) => { const q = real(t, m); if (q) q.modules[8][0] = !q.modules[8][0]; return q; }; });
    if (MUT === 'case-labels') await page.evaluate(() => { hjCaseText = p => { const d = hjCaseData(p); return HJ_CASE_FIELDS.map(f => f[1] + ': ' + hjCaseVal(p, d, f[0])).join('\n'); }; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS publicweb-v446 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed(opts = {}) {
    await close();
    return page.evaluate(async ({ leak, cust, phone, fields, link }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = []; state.adPosts = [];
      const p = { name: leak, kind: 'leak', stage: 3, doneAt: '2026-09-10', phases: [], customer: { name: cust, phone, addr: '대전 중구 대흥동 101동 1203호' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } };
      state.projects = [p];
      const ph = (id, phase, when) => ({ id, kind: 'photo', name: id + '.jpg', project: leak, _phase: phase, when: new Date(when), size: 1000 + id.length });
      state.files = [ph('pb', '시공 전', '2026-09-09T09:00'), ph('pm1', '배관 교체', '2026-09-09T12:00'), ph('pm2', '107동 1302호 욕실', '2026-09-09T13:00'), ph('pm3', '최저가 배관 보수', '2026-09-09T14:00'), ph('pa', '완료', '2026-09-10T10:00')];
      p.casePack = Object.assign({}, fields, { consent: true, photos: state.files.map(f => hjFileRef(f)) });
      state.payLog = [{ id: 'pay1', project: leak, d: '2026-09-10', amt: 300000, method: '계좌이체' }];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __reviewUrl = link || '';
      for (const k of Object.keys(__v446)) __v446[k] = [];
      localStorage.removeItem('hj_qr_on'); window.__rptQr = null;
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V446_SEED_SAVE_FAILED');
      return true;
    }, { leak: LEAK, cust: CUST, phone: PHONE, fields: FIELDS, link: opts.link || '' });
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
    if (!process.env.HJ_V446_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V446_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V446_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const imgSrcs = html => [...String(html).matchAll(/<img data-qr src="(data:image\/png;base64,[^"]+)"/g)].map(m => m[1]);
  const lastToast = () => page.evaluate(() => __v446.toasts[__v446.toasts.length - 1] || '');

  await test('① QR 인코더 — 참조 구현 지문 6가지 · 마스크 8가지 디코드 왕복 · 213바이트까지(214는 null)', async () => {
    const got = await page.evaluate(golden => golden.map(g => { const q = hjQrMatrix(g.text); return q && { version: q.version, mask: q.mask, rows: q.modules.map(r => r.map(c => c ? '1' : '0').join('')) }; }), GOLDEN);
    got.forEach((q, i) => {
      const g = GOLDEN[i]; assert(q, 'matrix for ' + g.text.slice(0, 30));
      assert.deepEqual({ version: q.version, mask: q.mask, sha256: crypto.createHash('sha256').update(q.rows.join('\n')).digest('hex') }, { version: g.version, mask: g.mask, sha256: g.sha256 }, 'QR_REFERENCE_MATCH ' + g.text.slice(0, 40));
      const back = qrDecode(q.rows); assert.equal(back.text, g.text, 'QR_ROUNDTRIP'); assert.equal(back.mask, g.mask);
    });
    const forced = await page.evaluate(texts => texts.flatMap(t => [0, 1, 2, 3, 4, 5, 6, 7].map(m => ({ t, m, rows: hjQrMatrix(t, m).modules.map(r => r.map(c => c ? '1' : '0').join('')) }))), [GOLDEN[0].text, GOLDEN[3].text, GOLDEN[4].text]);
    for (const f of forced) { const back = qrDecode(f.rows); assert.deepEqual([back.text, back.mask], [f.t, f.m], 'forced mask round trip'); }
    const limits = await page.evaluate(() => ({ max: hjQrMatrix('x'.repeat(213)).version, over: hjQrMatrix('x'.repeat(214)), empty: hjQrSvg('  ') }));
    assert.deepEqual(limits, { max: 10, over: null, empty: '' });
    const png = await page.evaluate(t => __qrSample(hjQrPngDataUrl(t, 8)), LINK);
    assert.equal(qrDecode(png).text, LINK, 'PNG pixels decode back to the link');
  });

  await test('② ⭐ 리뷰 QR 카드 — 링크 없음·https 아님 안내 → 설정 칸, 저장 안 한 칸도 먼저 저장, A6 두 장·PNG 다시 읽기, PDF', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => hjReviewQrCardView()); await page.locator('[data-review-qr-empty]').waitFor();
    assert.match(await page.locator('[data-review-qr-empty]').innerText(), /설정에서 리뷰 링크를 넣으세요[\s\S]*비어 있습니다/);
    await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('01-empty');
    await footer('⚙️ 설정 열기').click(); await page.locator('#setTab-etc[aria-selected="true"]').waitFor();
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'rvUrl'); // focus lands on the review link box
    await close(); await page.evaluate(() => { __reviewUrl = 'naver.me/5Abc12Xy'; hjReviewQrCardView(); });
    assert.match(await page.locator('[data-review-qr-empty]').innerText(), /https:\/\/ 로 시작하지 않습니다/); assert.equal(await page.evaluate(() => __v446.deliver.length), 0);
    await close(); await page.evaluate(() => { __reviewUrl = ''; openGdriveSetup(); }); await page.locator('#setTab-etc').click();
    await page.locator('#rvUrl').fill(LINK); await tapOk('#rvQrCard'); await page.locator('#rvQrCard').click();
    await page.waitForFunction(() => __v446.deliver.length === 1);
    assert.equal(await page.evaluate(() => __reviewUrl), LINK, 'typed link is saved before the card is made');
    assert.equal(await page.evaluate(async () => idbGet('review_url')), LINK);
    const card = await page.evaluate(() => __v446.deliver[0]);
    assert.equal(card.label, '⭐ 리뷰 QR 카드'); assert.match(card.base, /^리뷰QR카드_\d{8}$/);
    assert.equal((card.html.match(/class="card"/g) || []).length, 2, 'two A6 cards per page'); assert.match(card.html, /@page\{size:210mm 148mm/); assert.match(card.html, /시공 만족하셨다면<br>리뷰 한 줄 부탁드립니다/);
    const srcs = imgSrcs(card.html); assert.equal(srcs.length, 2);
    assert.equal(qrDecode(await page.evaluate(src => __qrSample(src), srcs[0])).text, LINK, 'card QR reads back the link');
    await tapOk('#modalRoot .mfoot button, #hjDocPdf, #hjDocImage'); await noOverflow(); await shot('02-card');
    await page.locator('#hjDocPdf').click(); assert.equal(await page.evaluate(() => __v446.print.length), 1); assert.equal(await page.evaluate(() => __v446.print[0]), card.html);
    await footer('← 뒤로').click(); await page.locator('#setTab-etc[aria-selected="true"]').waitFor();
    sameSnapshot(await snapshot(), before, 'the review card never touches saved data');
    await close(); await page.evaluate(() => { __reviewUrl = 'https://example.com/' + 'q'.repeat(200); hjReviewQrCardView(); });
    assert.match(await page.locator('[data-review-qr-empty]').innerText(), /너무 깁니다/);
    await close(); await page.evaluate(name => { __reviewUrl = ''; docHubView(name); }, LEAK);
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').innerText(), /리뷰 링크 없음/);
    await close(); await page.evaluate(name => { __reviewUrl = 'https://naver.me/5Abc12Xy'; docHubView(name); }, LEAK);
    await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').click(); await page.waitForFunction(() => __v446.deliver.length === 2);
    await footer('← 뒤로').click(); await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').waitFor();
  });

  await test('③ 완료보고서·간이영수증 끝 QR — 링크 있으면 기본 켬·다시 읽으면 링크, 끄면 이 기기에 기억·QR 없음, 링크 없으면 칸 없음', async () => {
    await seed({ link: LINK }); const before = await snapshot();
    await page.evaluate(name => payRcptDialog(name), LEAK); await page.locator('#prcQr').waitFor();
    assert.equal(await page.locator('#prcQr').isChecked(), true, 'receipt QR is on by default'); await tapOk('label:has(#prcQr)'); await noOverflow(); await shot('03-receipt-toggle');
    await footer('🧾 영수증 만들기').click(); await page.waitForFunction(() => __v446.deliver.length === 1);
    let html = await page.evaluate(() => __v446.deliver[0].html);
    assert.match(html, /data-review-qr/); assert.match(html, /시공 만족하셨다면 리뷰 한 줄 부탁드립니다/);
    const rs = imgSrcs(html); assert.equal(rs.length, 1); assert.equal(qrDecode(await page.evaluate(src => __qrSample(src), rs[0])).text, LINK, 'receipt QR reads back the link');
    await close(); await page.evaluate(name => payRcptDialog(name), LEAK); await page.locator('#prcQr').uncheck(); await footer('🧾 영수증 만들기').click(); await page.waitForFunction(() => __v446.deliver.length === 2);
    html = await page.evaluate(() => __v446.deliver[1].html); assert.doesNotMatch(html, /data-review-qr|data-qr/);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hj_qr_on'))), { rcpt: false });
    await close(); await page.evaluate(name => payRcptDialog(name), LEAK); assert.equal(await page.locator('#prcQr').isChecked(), false, 'the choice is remembered on this device');
    await close(); await page.evaluate(name => aptReportView(name), LEAK); await page.locator('#rpQr').waitFor(); assert.equal(await page.locator('#rpQr').isChecked(), true, 'report QR is on by default');
    await footer('📄 PDF 만들기').click(); await page.waitForFunction(() => __v446.pdf.length === 1 && __v446.pdf[0].saved);
    const rep = await page.evaluate(() => ({ pages: __v446.pdf[0].pages.length, qr: window.__rptQr, texts: window.__rptTexts.slice() }));
    assert.equal(rep.qr && rep.qr.url, LINK); assert(rep.texts.some(t => /시공 만족하셨다면 리뷰 한 줄 부탁드립니다/.test(t)), 'report caption');
    const rows = await page.evaluate(box => __qrSample(__v446.pdf[0].pages[__v446.pdf[0].pages.length - 1], box), rep.qr);
    assert.equal(qrDecode(rows).text, LINK, 'report last page QR (JPEG) reads back the link');
    await page.evaluate(name => aptReportView(name), LEAK); await page.locator('#rpQr').uncheck(); await footer('📄 PDF 만들기').click(); await page.waitForFunction(() => __v446.pdf.length === 2 && __v446.pdf[1].saved);
    assert.deepEqual(await page.evaluate(() => [window.__rptQr, window.__rptTexts.some(t => /리뷰 한 줄/.test(t)), JSON.parse(localStorage.getItem('hj_qr_on'))]), [null, false, { rcpt: false, report: false }]);
    await page.evaluate(() => { __reviewUrl = ''; localStorage.removeItem('hj_qr_on'); });
    await page.evaluate(name => payRcptDialog(name), LEAK); await page.locator('#prcAmt').waitFor(); assert.equal(await page.locator('#prcQr').count(), 0, 'no link → no toggle');
    await footer('🧾 영수증 만들기').click(); await page.waitForFunction(() => __v446.deliver.length === 3); assert.doesNotMatch(await page.evaluate(() => __v446.deliver[2].html), /data-qr/);
    await close(); await page.evaluate(name => aptReportView(name), LEAK); assert.equal(await page.locator('#rpQr').count(), 0);
    sameSnapshot(await snapshot(), before, 'QR toggles live outside the saved data');
  });

  await test('④ 사례 ZIP — case.json 규격·사진 설명 거름·재료 글이 홈페이지 parseMaterial 로 6칸 다 읽힘 · 동의 없음/동·호수/과장 표현은 막힘', async () => {
    await seed();
    const zip = () => page.evaluate(async name => {
      const files = {}; let made = 0;
      window.JSZip = function () { made++; return { file(p, b) { files[p] = b; }, generateAsync: async () => new Blob(['zip']) }; };
      hjCaseJpeg = async () => ({ bytes: new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]), w: 1800, h: 900 });
      const clicked = [], origCreate = document.createElement.bind(document);
      document.createElement = function (tag) { const el = origCreate(tag); if (tag === 'a') el.click = () => clicked.push(el.download); return el; };
      let ok; try { ok = await hjCaseZip(state.projects.find(p => p.name === name)); } finally { document.createElement = origCreate; }
      const text = {}; for (const [k, v] of Object.entries(files)) text[k] = typeof v === 'string' ? v : '[bytes ' + v.length + ']';
      return { ok, made, files: text, clicked, sentAt: (state.projects.find(p => p.name === name).casePack || {}).sentAt || '' };
    }, LEAK);
    const out = await zip();
    assert.equal(out.ok, true, 'zip made: ' + JSON.stringify(out).slice(0, 300));
    assert.deepEqual(Object.keys(out.files).sort(), ['01-전.jpg', '02-중.jpg', '03-중.jpg', '04-중.jpg', '05-후.jpg', 'case.json', '사례재료.txt']);
    const cj = JSON.parse(out.files['case.json']);
    assert.deepEqual(Object.keys(cj).sort(), ['app', 'area', 'consent', 'date', 'format', 'kind', 'photos', 'summary', 'tags', 'title']);
    assert.deepEqual({ format: cj.format, title: cj.title, area: cj.area, kind: cj.kind, tags: cj.tags, date: cj.date, consent: cj.consent }, { format: 'manmool-case/1', title: '대흥동 평화로운아파트 아랫집 천장 물자국', area: '대흥동', kind: '누수', tags: ['누수', '대흥동'], date: '2026-09-10', consent: true });
    assert.deepEqual(cj.summary, FIELDS); assert.match(cj.app, /^hyeonjang-v\d+/);
    assert.deepEqual(cj.photos, [{ file: '01-전.jpg', phase: 'before', caption: '시공 전' }, { file: '02-중.jpg', phase: 'mid', caption: '배관 교체' }, { file: '03-중.jpg', phase: 'mid', caption: '작업 중' }, { file: '04-중.jpg', phase: 'mid', caption: '작업 중' }, { file: '05-후.jpg', phase: 'after', caption: '완료' }]);
    const all = out.files['case.json'] + out.files['사례재료.txt'];
    assert(!/1302|1203|김|테스트고객|010|최저가/.test(all.replace(/09:30~15:40/g, '')), 'no unit numbers, customer, phone or ad words in the pack');
    assert.deepEqual(siteParse(out.files['사례재료.txt']), FIELDS, 'SITE_PARSER_CONTRACT — manmool parseMaterial reads all six lines');
    assert.match(out.files['사례재료.txt'], /^03-중\.jpg — 작업 중$/m); assert.equal(out.clicked.length, 1); assert.match(out.sentAt, /^\d{4}-\d{2}-\d{2}$/);
    const block = async (mutate, expect, label) => {
      await seed(); await page.evaluate(mutate);
      const r = await zip(); assert.equal(r.ok, false, label); assert.equal(r.made, 0, label + ' — nothing is zipped'); assert.equal(r.sentAt, '', label + ' — not marked sent');
      assert.match(await lastToast(), expect, label);
    };
    await block(() => { state.projects[0].casePack.consent = false; }, /동의/, 'no consent');
    await block(() => { state.projects[0].casePack.symptom = '107동 1302호 천장 물자국'; }, /동·호수/, 'unit number');
    await block(() => { state.projects[0].casePack.work = '최저가로 배관 교체'; }, /과장 표현은 공개 글에 못 씁니다: 최저가/, 'ad word');
    await seed(); await page.evaluate(name => casePackView(name), LEAK); await page.locator('#modalRoot .cpIn[data-k="work"]').fill('평생 보증 시공');
    await page.locator('#modalRoot .cpWarn[data-k="work"]:not([hidden])').waitFor(); assert.match(await page.locator('#modalRoot .cpWarn[data-k="work"]').innerText(), /과장 표현\(평생 보증\)/);
    await noOverflow(); await shot('04-casepack');
    await footer('📋 재료 복사').click(); assert.match(await lastToast(), /과장 표현/);
  });

  await test('⑤ 새 최상위 키 없음 · 더보기 126 · sw 앱 셸 목록 그대로 · 오류 0 · 외부 쓰기 0', async () => {
    await seed({ link: LINK }); const before = await snapshot();
    await page.evaluate(() => hjReviewQrCardView()); await close();
    sameSnapshot(await snapshot(), before); assert.deepEqual((await snapshot()).keys, before.keys);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    const swNow = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), swBase = execFileSync('git', ['show', '3c7db67:sw.js'], { cwd: ROOT, encoding: 'utf8' });
    const shell = t => (t.match(/SHELL_PATHS\s*=\s*(?:new Set\()?\[[^\]]*\]/) || [''])[0]; assert(shell(swNow)); assert.equal(shell(swNow), shell(swBase));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v446.external), []);
  });
  console.log(`publicweb-v446: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL publicweb-v446', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
