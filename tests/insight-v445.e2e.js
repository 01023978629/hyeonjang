/* v445 📈 분석 — 채널별 문의→수주 전환 · 공종×동 마진·수요 · 누수 반복 단지. 합성 현장 40곳, 외부 쓰기 0.
   기대값은 이 파일이 합성 계획(채널·단계·답장 분)과 현장별 v429 마진(hjProjectMargin)으로 따로 계산해 대조한다.
   HJ_V445_BASELINE=<commit> 은 INSIGHT_API_PRESENT 에서, HJ_V445_MUTATION=hide-unknown('기타·모름' 비율 줄 숨김)은 INSIGHT_UNKNOWN_SHOWN 에서 실패해야 한다. */
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
const baseline = process.env.HJ_V445_BASELINE && execFileSync('git', ['show', process.env.HJ_V445_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const DONGS = ['유천동', '대흥동', '둔산동', '월평1동', '봉명동', '대동'];
const LEAK_IDX = [0, 1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 30, 31, 35, 36];
/* 합성 계획 — 채널 5줄(당근·네이버 지도·인스타·소개·기타·모름), 공종 2, 동 6, 반복 단지 2곳 */
function plan(i) {
  const ch = i < 10 ? 'daangn' : i < 18 ? 'naverplace' : i < 24 ? 'instagram' : i < 30 ? 'referral' : i < 36 ? '' : 'etc';
  const viaNote = (i >= 5 && i < 10) || (i >= 14 && i < 18);   // 경로를 [문의 접수] 노트 글로만 남긴 현장
  const leak = LEAK_IDX.includes(i);
  const won = i % 3 === 0, quoted = won || i % 3 === 1, consult = quoted || (i % 3 === 2 && i % 2 === 0);
  const reply = { 5: 10, 6: 25, 7: 40, 8: 5, 9: 120, 14: 30, 15: 60 }[i];
  let addr = '대전 서구 ' + DONGS[i % 6] + ' 45-' + i, name = 'TEST_INS_' + i + ' ' + ['욕실 리모델링', '도배·장판', '주방 싱크 교체', '타일 줄눈'][i % 4], complex = '', unit = '', cause = '원인 미확정';
  if (leak) {
    const L = { 0: ['평화로운아파트', '대흥동', '101동 1203호', '온수관'], 1: ['평화로운아파트', '대흥동', '101동 1203호', '온수관'], 5: ['평화로운아파트', '대흥동', '102동 301호', '방수층(욕실·베란다)'], 6: ['한빛아파트', '둔산동', '201동 501호', '외벽·창호'], 10: ['한빛아파트', '둔산동', '202동 702호', '외벽·창호'] }[i];
    if (L) { [complex, , unit, cause] = L; name = 'TEST_INS_' + i + ' ' + complex + ' ' + unit; addr = '대전 중구 ' + L[1] + ' ' + complex + ' ' + unit; }
    else { name = 'TEST_INS_' + i + ' 누수'; addr = ''; cause = ['급수관', '결로', '배수관', '윗세대'][i % 4]; }
  }
  return { i, ch, viaNote, leak, won, quoted, consult, reply, addr, name, cause, phone: i === 2 || i === 3 ? '010-7319-0002' : '010-7319-' + String(1000 + i) };
}
const PLANS = Array.from({ length: 40 }, (_, i) => plan(i));
const DONG_CASES = [
  ['대전 중구 유천동 123-4', '유천동'], ['대전 서구 대덕대로 150 (둔산동, 크로바아파트)', '둔산동'], ['대전 서구 월평1동 무궁화아파트 3동 201호', '월평1동'],
  ['대전 동구 대동 12', '대동'], ['동아아파트 103동 1201호', ''], ['삼성동아아파트 5동', ''], ['긴급 출동 누수', ''], ['', ''], ['유성구 봉명동/궁동 일대', '봉명동'], ['대전 중구 대흥동 101동 1203호', '대흥동'],
];
const median = a => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return null; const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : Math.round((s[h - 1] + s[h]) / 2); };

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
    window.__v445 = { external: [], xlsx: [], png: [], biz: 0 };
    window.open = (...args) => { __v445.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjInsightData', 'hjInsightView', 'hjDongOf', 'hjInsightLeak', 'hjInsightXlsx', 'hjInsightUnknownHtml'].every(k => typeof window[k] === 'function')), true, 'INSIGHT_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: aoa => aoa, book_append_sheet: (wb, ws, name) => wb.sheets.push({ name, ws }) }, writeFile: (wb, fname) => __v445.xlsx.push({ wb, fname }) };
    ensureXLSX = async () => {};
    hjDocHtmlToPng = async (html, base) => { __v445.png.push({ html, base }); return true; };
    shareBizCard = async () => { __v445.biz++; };
  });
  if (process.env.HJ_V445_MUTATION) {
    assert.equal(process.env.HJ_V445_MUTATION, 'hide-unknown');
    await page.evaluate(() => { hjInsightUnknownHtml = () => ''; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS insight-v445 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async plans => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = []; state.adPosts = [];
      const base = localDate(), out = [];
      state.projects = plans.map(x => {
        const date = hjAddDays(base, -(x.i * 7));
        const p = { name: x.name, kind: x.leak ? 'leak' : 'interior', stage: x.won ? 2 : (x.consult && x.i % 3 === 2 ? 0 : 1), phases: [], customer: { name: '김테스트' + x.i, phone: x.phone, addr: x.addr }, received: 0, archived: x.i === 39, cost: { material: 0, labor: 0, outsource: 0 } };
        if (!x.quoted && !x.won) p.stage = 0;
        if (!x.viaNote) p.inquiryAt = date;
        if (x.ch && !x.viaNote) p.leadSrc = x.ch;
        if (x.leak) p.leak = { intake: { at: date + 'T01:00:00.000Z' }, detect: { cause: x.cause } };
        if (x.won && x.i % 2 === 0) p.cost = { material: 300000, labor: 200000, outsource: 0 };
        if (x.won && x.i % 4 === 0) p.doneAt = hjAddDays(date, 3);
        if (x.viaNote) {
          const at = new Date(date + 'T09:00:00'), note = { id: 'n' + x.i, date: at.toLocaleString('ko-KR'), text: '[문의 접수] ' + date + ' · ' + hjLeadSrcLabel(x.ch) + '\n천장에서 물이 샙니다 ' + x.phone, project: x.name };
          if (x.reply != null) { note.replyAt = new Date(at.getTime() + x.reply * 60000).toISOString(); if (x.i % 2) note.at = at.toISOString(); }
          state.notes.push(note);
        }
        if (x.quoted) state.files.push({ id: 'e' + x.i, kind: 'estimate', name: '견적_' + x.i + '.xlsx', project: x.name, when: new Date(date + 'T10:00:00'), est: { amount: Math.round((1000000 + x.i * 10000) * 1.1), supply: 1000000 + x.i * 10000, date } });
        if (x.consult && !x.quoted) state.schedule.push({ id: 's' + x.i, date: hjAddDays(date, 1), time: '10:00', title: '상담·실측', project: x.name });
        out.push({ i: x.i, date });
        return p;
      });
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __hjInsight = { period: '12m', kind: 'all' };
      for (const k of Object.keys(__v445)) __v445[k] = k === 'biz' ? 0 : [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V445_SEED_SAVE_FAILED');
      const margins = {}; plans.forEach(x => { const m = hjProjectMargin(x.name, false); margins[x.i] = m && { revenue: m.revenue, cost: m.cost, margin: m.margin, missing: m.missing, noRevenue: m.noRevenue }; });
      return { dates: out, margins, today: base };
    }, PLANS);
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
    if (!process.env.HJ_V445_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V445_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V445_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  let seeded;
  await test('① 채널 전환 — 5줄(기타·모름 포함) 문의·상담·견적·수주·전환율·매출·건당 매출·첫 답장 중앙값을 따로 계산한 값과 대조', async () => {
    seeded = await seed();
    const d = await page.evaluate(() => hjInsightData({ period: '12m', kind: 'all' }));
    const chKey = x => x.ch && x.ch !== 'etc' ? x.ch : 'other';
    const expect = {};
    for (const x of PLANS) {
      const k = chKey(x), e = expect[k] || (expect[k] = { inq: 0, consult: 0, quoted: 0, won: 0, revenue: 0, revN: 0, replies: [] }), m = seeded.margins[x.i];
      e.inq++; if (x.consult) e.consult++; if (x.quoted) e.quoted++; if (x.won) { e.won++; if (m && m.revenue > 0) { e.revenue += m.revenue; e.revN++; } }
      if (x.reply != null) e.replies.push(x.reply);
    }
    assert.deepEqual(d.channels.rows.map(r => r.id), ['daangn', 'naverplace', 'instagram', 'referral', 'other'], 'channel order: most inquiries first, 기타·모름 last');
    for (const r of d.channels.rows) {
      const e = expect[r.id];
      assert.deepEqual({ inq: r.inq, consult: r.consult, quoted: r.quoted, won: r.won, rate: r.rate, revenue: r.revenue, perWon: r.perWon, replyMed: r.replyMed },
        { inq: e.inq, consult: e.consult, quoted: e.quoted, won: e.won, rate: Math.round(e.won / e.inq * 100), revenue: e.revenue, perWon: e.revN ? Math.round(e.revenue / e.revN) : null, replyMed: median(e.replies) }, 'channel ' + r.id);
    }
    assert.equal(d.channels.rows.find(r => r.id === 'daangn').replyMed, 25); assert.equal(d.channels.rows.find(r => r.id === 'naverplace').replyMed, 45);
    assert.deepEqual([d.channels.total.inq, d.channels.unknown, d.channels.etc, d.channels.otherShare], [40, 6, 4, 25]);
    const leakOnly = await page.evaluate(() => hjInsightData({ period: '12m', kind: 'leak' }));
    assert.equal(leakOnly.channels.total.inq, LEAK_IDX.length);
    const q0 = await page.evaluate(() => { const r = hjInsightRange('q0', localDate()); return { r, n: hjInsightData({ period: 'q0', kind: 'all' }).n }; });
    assert.equal(q0.n, seeded.dates.filter(x => x.date >= q0.r.from && x.date <= q0.r.to).length, 'quarter filter by inquiry date');
  });

  await test('② 동 추출 10가지 · 공종×동 집계(평균 공사비·마진율·재문의율) · 규칙 요약', async () => {
    const got = await page.evaluate(cases => cases.map(([t]) => hjDongOf(t)), DONG_CASES);
    assert.deepEqual(got, DONG_CASES.map(c => c[1]));
    const d = await page.evaluate(() => hjInsightData({ period: '12m', kind: 'all' }));
    const trade = x => x.leak ? '누수·' + ({ 온수관: '배관', 급수관: '배관', 배수관: '배관', '방수층(욕실·베란다)': '방수', '외벽·창호': '외벽' }[x.cause] || '기타') : ['욕실', '도배', '주방', '타일'][x.i % 4];
    const dong = x => x.leak ? ({ 0: '대흥동', 1: '대흥동', 5: '대흥동', 6: '둔산동', 10: '둔산동' }[x.i] || '') : DONGS[x.i % 6];
    const groups = new Map();
    for (const x of PLANS) { const k = trade(x) + '|' + (dong(x) || '동 모름'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    assert.equal(d.cross.length, groups.size);
    for (const r of d.cross) {
      const list = groups.get(r.trade + '|' + r.dong); assert(list, 'group ' + r.trade + '|' + r.dong);
      const won = list.filter(x => x.won), rev = won.filter(x => seeded.margins[x.i].revenue > 0), costed = rev.filter(x => seeded.margins[x.i].cost != null);
      const revC = costed.reduce((a, x) => a + seeded.margins[x.i].revenue, 0), mar = costed.reduce((a, x) => a + seeded.margins[x.i].margin, 0);
      const repeat = list.filter(x => x.i === 2).length;   // 같은 번호(010-7319-0002)의 더 늦은 문의는 i=2 하나
      assert.deepEqual({ inq: r.inq, won: r.won, perWon: r.perWon, marginRate: r.marginRate, repeatRate: r.repeatRate },
        { inq: list.length, won: won.length, perWon: rev.length ? Math.round(rev.reduce((a, x) => a + seeded.margins[x.i].revenue, 0) / rev.length) : null, marginRate: revC > 0 ? Math.round(mar / revC * 100) : null, repeatRate: Math.round(repeat / list.length * 100) }, 'cross ' + r.trade + '|' + r.dong);
    }
    // 요약 — 공종별 마진율 순위(원가 있는 수주만), 남는 3 · 안 남는 3(겹치지 않게), 수주율이 전체보다 낮은 동(문의 2+)
    const byTrade = new Map(); for (const x of PLANS) { const t = trade(x); if (!byTrade.has(t)) byTrade.set(t, []); byTrade.get(t).push(x); }
    const ranked = [...byTrade].map(([t, l]) => { const c = l.filter(x => x.won && seeded.margins[x.i].revenue > 0 && seeded.margins[x.i].cost != null); const rv = c.reduce((a, x) => a + seeded.margins[x.i].revenue, 0); return { t, rate: rv > 0 ? Math.round(c.reduce((a, x) => a + seeded.margins[x.i].margin, 0) / rv * 100) : null, won: l.filter(x => x.won).length }; })
      .filter(x => x.rate != null).sort((a, b) => b.rate - a.rate || b.won - a.won || a.t.localeCompare(b.t));
    assert.deepEqual(d.summary.best.map(x => x.trade), ranked.slice(0, 3).map(x => x.t));
    assert.deepEqual(d.summary.worst.map(x => x.trade), ranked.slice(3).reverse().slice(0, 3).map(x => x.t));
    const overall = Math.round(PLANS.filter(x => x.won).length / 40 * 100);
    const coldExp = DONGS.map(g => { const l = PLANS.filter(x => dong(x) === g); return { g, inq: l.length, rate: Math.round(l.filter(x => x.won).length / l.length * 100) }; })
      .filter(x => x.inq >= 2 && x.rate < overall).sort((a, b) => a.rate - b.rate || b.inq - a.inq || a.g.localeCompare(b.g)).slice(0, 3).map(x => x.g);
    assert.deepEqual(d.summary.cold.map(x => x.dong), coldExp);
    assert.match(d.summary.text, /^최근 12개월 — 가장 남는 공종: /);
  });

  await test('③ 누수 반복 단지 — 2곳(평화로운아파트 3건·한빛아파트 2건) · 원인 분포 · 같은 세대 재발 · 지도 링크 · 관리사무소 제안 연결', async () => {
    const leak = await page.evaluate(() => hjInsightLeak());
    assert.deepEqual(leak.map(x => ({ label: x.label, dong: x.dong, n: x.n, causes: x.causes, repeatUnits: x.repeatUnits, top: x.top })), [
      { label: '평화로운아파트', dong: '대흥동', n: 3, causes: { 배관: 2, 방수: 1, 외벽: 0, 기타: 0 }, repeatUnits: 1, top: { cause: '배관', n: 2 } },
      { label: '한빛아파트', dong: '둔산동', n: 2, causes: { 배관: 0, 방수: 0, 외벽: 2, 기타: 0 }, repeatUnits: 0, top: { cause: '외벽', n: 2 } }]);
    assert.equal(leak[0].last, seeded.dates[0].date, 'last = newest intake day');
    await page.evaluate(() => hjInsightView({ period: '12m', kind: 'all' })); await page.locator('#hjInsight').waitFor();
    assert.equal(await page.locator('[data-insight-leak]').count(), 2);
    await page.locator('[data-insight-map="0"]').click();
    assert.deepEqual(await page.evaluate(() => __v445.external.map(a => a[0])), ['https://map.naver.com/p/search/' + encodeURIComponent('대흥동 평화로운아파트')]);
    assert.equal(await page.locator('[data-insight-pitch]').count(), 2); assert.match(await page.locator('[data-insight-pitch]').first().innerText(), /평화로운아파트은\(는\) 배관 원인이 2번/);
    await page.locator('[data-insight-pitch-go]').first().click(); assert.equal(await page.evaluate(() => __v445.biz), 1);
  });

  await test('④ 읽기 전용 · 개인정보 0(화면·엑셀·이미지) · 엑셀 시트 3 · 44px · 390px(표만 가로 스크롤) · 진입 2곳 · 더보기 126', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => { state.tab = 'ledger'; render(); }); await page.locator('#view [data-insight]').click(); await page.locator('#hjInsight').waitFor();
    assert.equal(await page.locator('#hjInsight [data-insight-unknown]').count(), 1, 'INSIGHT_UNKNOWN_SHOWN');
    assert.match(await page.locator('#hjInsight [data-insight-unknown]').innerText(), /경로 모름 6건 · 기타 4건 — 전체 문의 40건 중 25%/, 'INSIGHT_UNKNOWN_SHOWN');
    await tapOk('#hjInsight button, #insPeriod, #modalRoot .mfoot button'); await noOverflow(); await shot('01-insight');
    assert(await page.locator('[data-insight-table="channel"]').evaluate(t => t.parentElement.scrollWidth > t.parentElement.clientWidth), 'channel table scrolls inside its box');
    await page.selectOption('#insPeriod', 'q0'); await page.locator('#hjInsight').waitFor(); assert.equal(await page.evaluate(() => __hjInsight.period), 'q0');
    await page.locator('[data-insight-kind="leak"]').click(); await page.locator('[data-insight-kind="leak"][aria-pressed="true"]').waitFor();
    await page.selectOption('#insPeriod', '12m'); await page.locator('[data-insight-kind="all"]').click(); await page.locator('[data-insight-kind="all"][aria-pressed="true"]').waitFor();
    const text = await page.locator('#modalRoot').innerText();
    await footer('📥 엑셀').click(); await page.waitForFunction(() => __v445.xlsx.length === 1);
    await footer('🖼 이미지').click(); await page.waitForFunction(() => __v445.png.length === 1);
    const x = await page.evaluate(() => __v445.xlsx[0]), png = await page.evaluate(() => __v445.png[0]);
    assert.deepEqual(x.wb.sheets.map(s => s.name), ['채널 전환', '공종·동', '누수 반복 단지']); assert.match(x.fname, /_분석_최근12개월_\d{8}\.xlsx$/);
    assert.equal(x.wb.sheets[2].ws.length, 3, 'two leak rows + header');
    for (const [label, blob] of [['screen', text], ['xlsx', JSON.stringify(x.wb)], ['png', png.html]]) {
      assert(!/김테스트|7319|TEST_INS|\d+\s*동\s*\d+\s*호|45-\d/.test(blob), 'no personal data in ' + label + ': ' + (blob.match(/김테스트|7319|TEST_INS|\d+\s*동\s*\d+\s*호|45-\d/) || [''])[0]);
    }
    assert.match(png.html, /분 석 요 약/); assert.match(png.html, /data-insight-unknown/);
    await close(); await page.evaluate(() => { state.tab = 'ads'; render(); }); await page.locator('#view .adLeadSrc [data-insight]').click(); await page.locator('#hjInsight').waitFor(); await tapOk('#view .adLeadSrc [data-insight]');
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; render(); }); sameSnapshot(await snapshot(), before, 'the analysis never writes');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });
  console.log(`insight-v445: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL insight-v445', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
