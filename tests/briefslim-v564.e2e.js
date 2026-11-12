/* v564 ☀️ 오늘의 브리핑 줄이기 — 대표 지시(2026-11-08): "2,3,4,5,6은 브리핑에서 빼고 7번은 내역서로 월 매출로 표시해줘".
   브리핑 = 🌤 날씨 · 📅 오늘·내일 일정 · 💰 이번 달 매출(작업내역서) · 📋 복사. 뺀 것: ✅ 오늘의 체크 · 🏥 현장 보드 · 🔥 진행 중 현장 · 📞 챙길 연락 ·
   ⏰ 견적 팔로업 · 대금 현황(수금·견적). 💰 칸은 매출 기준 설정과 상관없이 📑 반영한 작업내역서만 센다(hjStmtMonthSales — 매출 한 벌에서
   _stmt·q.stmt 만, 집계 제외 빠짐). 영수증 미발행 안내는 💰 칸 아래 남긴다. 복사 글·🌅 오늘 브리핑도 같은 구성. 합성 자료·가짜 예보, 바깥 쓰기 0.
   ① 브리핑 카드 — 펼침: 일정 → 💰 매출(작업내역서) · 뺀 칸·단추 없음 / 접힘: 날씨·칩(일정·매출)만 (SLIM)
   ② 💰 = 이번 달 작업내역서만 1,320,000 · 2건 — 견적서·수주 앱 견적·집계 제외 내역서·지난달 빠짐 · 지난달 330,000 · 매출 기준을 켜도 같음 (SALES)
   ③ 복사 글·🌅 오늘 브리핑 — 날씨·일정·💰 줄 · 뺀 칸 글 없음 · AI 자료에 시공중현장·미배정사진 없음 (TEXT)
   ④ 영수증 미발행 안내는 💰 칸에 남음 · 이번 달 내역서가 없으면 안내 · 390px 넘침 없음 (KEEP)
   ⑤ 소스·핀 3곳(v564 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V564_BASELINE=<commit> 은 ① 에서(뺀 단추가 남음), HJ_V564_MUTATION=no-stmt-filter(내역서 거르기 삭제) 는 ① 요약 칩 금액에서 실패해야 한다. */
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
const FILTER = 'if(!((r.file&&r.file._stmt)||(r.quote&&r.quote.stmt&&r.quote.stmt.key)))return;';
let html = process.env.HJ_V564_BASELINE ? execFileSync('git', ['show', process.env.HJ_V564_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V564_MUTATION) {
  assert.equal(process.env.HJ_V564_MUTATION, 'no-stmt-filter', 'unknown mutation ' + process.env.HJ_V564_MUTATION);
  assert.equal(SRC.split(FILTER).length, 2, 'mutation anchor');
  html = SRC.replace(FILTER, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS briefslim-v564 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    weatherFetch = async () => JSON.parse(JSON.stringify(window.__WX));
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const today = localDate(), [y, m, d] = today.split('-').map(Number), YM = today.slice(0, 7), tmr = localDate(new Date(y, m - 1, d + 1));
  const pv = new Date(y, m - 2, 1), PYM = pv.getFullYear() + '-' + String(pv.getMonth() + 1).padStart(2, '0');
  window.__WX = { daily: { time: [today, tmr], weather_code: [3, 61], temperature_2m_max: [12, 9], temperature_2m_min: [3, 4], precipitation_probability_max: [10, 70], relative_humidity_2m_max: [60, 75] } };
  try { localStorage.removeItem('hj_brief_weather'); } catch (_) {}
  __hjBriefWxErrAt = 0; __hjBriefWx = null; __briefOpen = true;
  const P = (name, stage, extra) => Object.assign({ name, stage, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }, extra || {});
  state.projects = [P('가온', 2, { phases: ['방수'] }), P('나래', 1, { customer: { name: '이대표', phone: '01055557777', addr: '' } }), P('다솜', 2)];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null;
  state.goals = { salesBasis: 'all' };   // v589 설정이 비면 내역서가 있는 자료는 저절로 내역서 기준 — '매출 기준이 견적 포함이어도 💰 칸은 내역서만'을 지키려고 끈 상태로 시작
  state.notes = [{ id: 'leadA', date: YM + '-01 10:00', project: '', text: '[홈페이지 상담 리드]\n공사: 욕실\n연락처 01098765432' }];
  const est = (id, name, project, amount, date) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, prefix: project ? '_정리완료/' + project + '/견적서/' : '', size: 900 + amount % 991,
    est: { customer: name.replace(/\.xlsx$/, ''), amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date }, when: new Date(date + 'T09:00:00+09:00') });
  state.files = [est('E_A', '가온_견적서.xlsx', '가온', 3300000, YM + '-01'), { id: 'PH1', name: 'IMG_1.jpg', ext: 'jpg', kind: 'photo', project: '', prefix: '현장사진/', size: 10, when: new Date() }];
  const stmt = (src, project, amt, date) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines: [{ d: date, loc: project + ' 101-1', work: '누수', amt }] }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  stmt('S1.xlsx', '가온', 220000, YM + '-01'); stmt('S2.xlsx', '다솜', 1100000, YM + '-01'); stmt('S0.xlsx', '가온', 330000, PYM + '-15');
  const ex = stmt('SX.xlsx', '다솜', 500000, YM + '-01'); ex.exSum = true; syncQuoteToProject(ex);   // 집계 제외 내역서 — 빠져야 함
  state.quotes.push({ id: 'WQ', title: '수주 견적', no: '제1', date: YM + '-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '', items: [{ name: '도배', spec: '', qty: 1, price: 700000 }], result: 'won' });
  state.quotes.push({ id: 'FQ', title: '팔로업 견적', no: '제2', date: localDate(new Date(Date.now() - 10 * 86400000)), place: '대전', vatIncluded: false, accountIdx: null, memo: '', items: [{ name: '타일', qty: 1, price: 2000000 }] });
  state.quotes.push({ id: 'RQ', title: '영수증 대기', no: '제3', date: YM + '-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '가온', items: [{ name: '수리', qty: 1, price: 100000 }], paid: { amount: 110000, receipt: { type: '현금영수증', issued: false } } });
  state.schedule = [{ id: 'S1', date: today, time: '09:00', title: '옥상 방수', project: '가온', workers: '2', hours: 8 }, { id: 'S2', date: tmr, time: '10:00', title: '도배', project: '다솜', workers: '', hours: 8 }];
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
  return { YM, PYM, mm: +YM.slice(5, 7), pmm: +PYM.slice(5, 7) };
};
const GONE = ['[data-workorderp]', '[data-callcust]', '[data-smscust]', '[data-briefleadcall]', '[data-briefleadsms]', '[data-qfollow]', '[data-boardtoggle]', '[data-boardreason]', '[data-recvquick]', '[data-custquick]'];
const GONE_TXT = /✅ 오늘의 체크|🏥 현장 보드|🔥 진행 중 현장|📞 챙길 연락|⏰ 견적 팔로업|대금 현황|진행 현장 \d|챙길 연락 \d|체크 \d/;

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    const D = await page.evaluate(SEED);
    await page.waitForSelector('.brief-card [data-brief-weather="ok"]', { timeout: 8000 });
    await test('① 브리핑 카드 — 펼침: 일정 → 💰 매출(작업내역서) · 뺀 칸·단추 없음 / 접힘: 날씨·칩만 (SLIM)', async () => {
      const r = await page.evaluate(gone => {
        const card = () => document.querySelector('.brief-card');
        const heads = [...card().querySelectorAll('div')].filter(d => !d.children.length && /^(📅|💰)/.test(d.textContent.trim())).map(d => d.textContent.trim());
        const open = { text: card().innerText, heads, gone: gone.filter(sel => card().querySelector(sel)), chips: (card().querySelector('[data-brief-sales-chip]') || {}).textContent || '' };
        __briefOpen = false; render();
        const folded = { text: card().innerText, sales: !!card().querySelector('[data-brief-sales]'), weather: !!card().querySelector('[data-brief-weather]'), gone: gone.filter(sel => card().querySelector(sel)) };
        __briefOpen = true; render();
        return { open, folded };
      }, GONE);
      assert.deepEqual(r.open.gone, [], '펼침 — 뺀 단추가 남음 ' + r.open.gone);
      assert.ok(!GONE_TXT.test(r.open.text), '펼침 — 뺀 칸 글이 남음: ' + (r.open.text.match(GONE_TXT) || [])[0]);
      assert.deepEqual(r.open.heads, ['📅 오늘·내일 일정', '💰 ' + D.mm + '월 매출(작업내역서)'], '칸은 일정 → 💰 매출 둘 — ' + JSON.stringify(r.open.heads));
      assert.ok(r.open.chips.includes('💰 ' + D.mm + '월 매출(내역서) 132만원'), '요약 칩 — ' + r.open.chips);
      assert.deepEqual(r.folded.gone, [], '접힘 — 뺀 단추(현장 보드 등)가 남음 ' + r.folded.gone);
      assert.ok(r.folded.weather && !r.folded.sales && !GONE_TXT.test(r.folded.text) && r.folded.text.includes('오늘 일정 1'), '접힘 — 날씨·칩만 — ' + r.folded.text.slice(0, 200));
    });
    await test('② 💰 = 이번 달 작업내역서만 1,320,000 · 2건 · 지난달 330,000 · 매출 기준을 켜도 같음 (SALES)', async () => {
      const r = await page.evaluate(() => {
        const b = hjDailyBrief(), el = document.querySelector('.brief-card [data-brief-sales]');
        const a = [b.stmtNow.total, b.stmtNow.n, b.stmtPrev.total, b.stmtPrev.n];
        hjSalesBasisSet(true); const b2 = hjDailyBrief(); const on = [b2.stmtNow.total, b2.stmtNow.n]; hjSalesBasisSet(false);
        return { a, on, text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '', won: won(1320000) };
      });
      assert.deepEqual(r.a, [1320000, 2, 330000, 1], '내역서만(견적서 3,300,000·수주 앱 견적 770,000·집계 제외 500,000 빠짐) — ' + JSON.stringify(r.a));
      assert.deepEqual(r.on, [1320000, 2], '매출 기준을 켜도 같음');
      assert.ok(r.text.startsWith(r.won + ' · 내역서 2건') && r.text.includes('지난달(' + D.pmm + '월) 33만원'), '💰 칸 글 — ' + r.text);
    });
    await test('③ 복사 글·🌅 오늘 브리핑 — 날씨·일정·💰 줄 · 뺀 칸 글 없음 · AI 자료에 시공중현장·미배정사진 없음 (TEXT)', async () => {
      const r = await page.evaluate(async () => {
        const text = hjDailyBriefText(), d = aiBriefData(); await aiBriefing();
        const box = (document.getElementById('briefBox') || {}).innerText || ''; closeModal(true);
        return { text, keys: Object.keys(d), sales: d.이번달매출_작업내역서, box };
      });
      assert.ok(r.text.split('\n')[1].startsWith('🌤 대전 오늘'), '복사 글 둘째 줄 날씨');
      assert.ok(r.text.includes('💰 ' + D.mm + '월 매출(작업내역서) 1,320,000원 · 내역서 2건 (지난달 ' + D.pmm + '월 330,000원)'), '복사 글 💰 줄 — ' + r.text);
      assert.ok(!GONE_TXT.test(r.text) && !/수금 /.test(r.text), '복사 글에 뺀 칸 — ' + (r.text.match(GONE_TXT) || [])[0]);
      assert.ok(!r.keys.includes('시공중현장') && !r.keys.includes('미배정사진'), 'AI 자료 키 — ' + r.keys);
      assert.deepEqual(r.sales, { 월: D.mm + '월', 금액원: 1320000, 건수: 2 }, 'AI 자료 매출');
      assert.ok(r.box.startsWith('🌤 대전') && r.box.includes('💰 ' + D.mm + '월 매출(작업내역서) 1,320,000원 · 내역서 2건') && !/챙길 것|시공 중|미배정 사진/.test(r.box), '🌅 브리핑 글 — ' + r.box);
    });
    await test('④ 영수증 미발행 안내는 💰 칸에 남음 · 이번 달 내역서가 없으면 안내 · 390px 넘침 없음 (KEEP)', async () => {
      const r = await page.evaluate(() => {
        const card = document.querySelector('.brief-card'), rc = card.querySelector('[data-leak-receipts]');
        const keep = rc ? rc.textContent : '';
        const saved = state.quotes.slice(); state.quotes = state.quotes.filter(q => !(q.stmt && q.date.slice(0, 7) === localDate().slice(0, 7)));
        state.files = state.files.filter(f => !(f._stmt && f.est && String(f.est.date).slice(0, 7) === localDate().slice(0, 7)));
        render(); const empty = document.querySelector('.brief-card').innerText;
        state.quotes = saved; render();
        return { keep, empty };
      });
      assert.ok(/영수증 미발행 1건/.test(r.keep), '영수증 미발행 안내 — ' + r.keep);
      assert.ok(r.empty.includes('이번 달 작업내역서가 아직 없습니다') && r.empty.includes('[📑 작업내역서 반영]'), '내역서 없을 때 안내');
      const m = await open(390);
      await m.page.evaluate(SEED);
      await m.page.waitForSelector('.brief-card [data-brief-weather="ok"]', { timeout: 8000 });
      const g = await m.page.evaluate(() => { const card = document.querySelector('.brief-card'), cr = card.getBoundingClientRect(); return { over: card.scrollWidth - card.clientWidth, right: Math.round(cr.right), vw: innerWidth, doc: document.documentElement.scrollWidth - innerWidth }; });
      assert.ok(g.over <= 1 && g.right <= g.vw && g.doc <= 1, '390px 넘침 없음 — ' + JSON.stringify(g));
      await m.context.close();
    });
    await test('⑤ 소스·핀 3곳(v564 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 564, '핀 v564 이상 ' + a);
      assert.ok(src.includes(FILTER), '작업내역서 거르기가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
    console.log(`briefslim-v564: ${passed}/5 PASS; synthetic data · fake forecast; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL briefslim-v564 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
