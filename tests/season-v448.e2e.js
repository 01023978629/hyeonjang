/* v448 🌦 계절 캠페인 — 규칙별 대상 추출(동의·6개월·수신거부·90일·중복 제거) · 광고 문자 원고((광고)·수신거부·밤 시간) ·
   보냈음/거부/동의 기록 · 동의 문의 한 줄(기본 꺼짐) · v445 성과. 합성 고객 30명, 외부 쓰기 0, 자동 발송 0.
   HJ_V448_BASELINE=<commit> 은 SEASON_API_PRESENT 에서, HJ_V448_MUTATION=six-month(6개월 규칙을 넓혀 옛 고객도 고를 수 있게)는
   SEASON_SIX_MONTH_RULE 에서 실패해야 한다. */
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
const baseline = process.env.HJ_V448_BASELINE && execFileSync('git', ['show', process.env.HJ_V448_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const ph = i => '010-6100-' + String(1000 + i);
const digits = s => s.replace(/\D/g, '');
/* 합성 현장 — [i, kind, 이름 꼬리, 준공(며칠 전, null=진행 중), 누수 원인, 연락처 mkt, 번호(기본 ph(i), ''=없음), 노트] */
const PLAN = [
  [0, 'leak', '누수', 400, '급수관', { consent: -30 }], [1, 'leak', '누수', 200, '온수관'], [2, 'leak', '누수', 1200, '방수층(욕실·베란다)'],
  [3, 'interior', '욕실 리모델링', 100], [4, 'interior', '베란다 방수', 800], [5, 'interior', '도배·장판', 30], [6, 'interior', '보일러 교체', 60],
  [7, 'interior', '베란다 수전 교체', null], [8, 'interior', '주방 싱크 교체', 900], [9, 'interior', '욕실 실리콘 부분 보수', 10, '', { optOutAt: -5 }],
  [10, 'interior', '거실 도배', 1000, '', null, undefined, '벽 모서리 곰팡이 문의'], [11, 'interior', '방 환풍기 설치', 20], [12, 'interior', '욕실 타일 보수', 500, '', null, ph(3)],
  [13, 'interior', '외벽 방수', 150, '', { lastSentAt: -30 }], [14, 'leak', '누수', 700, '배수관'],
  [15, 'leak', '평화로운아파트 101동 1203호', 50, '외벽·창호'], [16, 'leak', '평화로운아파트 102동 304호', 20, '외벽·창호'],
  [17, 'interior', '욕실 방수', 40, '', null, ''],
  ...Array.from({ length: 12 }, (_, k) => [18 + k, 'interior', ['전기 콘센트 교체', '중문 설치', '조명 교체', '방문 교체'][k % 4], 30 + k * 40]),
];
const OFFICE = '042-555-1234';
const EXPECT = {   // 캠페인 → 번호 → 상태 (검사 쪽 손 계산)
  rainy: { [digits(ph(0))]: 'consent', [digits(ph(3))]: 'sixmonth', [digits(ph(4))]: 'need', [digits(ph(9))]: 'optout', [digits(ph(13))]: 'recent', [digits(ph(14))]: 'need', [digits(OFFICE)]: 'sixmonth' },
  freeze: { [digits(ph(0))]: 'consent', [digits(ph(1))]: 'need', [digits(ph(6))]: 'sixmonth', [digits(ph(7))]: 'sixmonth', [digits(ph(14))]: 'need' },
  condense: { [digits(ph(5))]: 'sixmonth', [digits(ph(10))]: 'need', [digits(ph(11))]: 'sixmonth' },
  holiday: { [digits(ph(3))]: 'sixmonth', [digits(ph(4))]: 'need', [digits(ph(8))]: 'need', [digits(ph(9))]: 'optout', [digits(ph(10))]: 'need' },
};

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
    window.__v448 = { external: [], sms: [], copies: [], toasts: [], deliver: [] };
    window.open = (...args) => { __v448.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjSeasonTargets', 'hjSeasonView', 'hjSeasonSms', 'hjSeasonIssue', 'hjSeasonMarkSent', 'hjSeasonPerf', 'hjMktView'].every(k => typeof window[k] === 'function') && typeof HJ_AD_SMS_RULE === 'object'), true, 'SEASON_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const realToast = toast; toast = m => { __v448.toasts.push(String(m)); return realToast(m); };
    hjSendSms = (phone, text) => { __v448.sms.push({ phone, text }); };
    coworkCopy = (text, label) => { __v448.copies.push({ text: String(text), label }); };
    const realDeliver = hjDocDeliverView; hjDocDeliverView = (...args) => { __v448.deliver.push({ html: args[1] }); return realDeliver(...args); };
  });
  if (process.env.HJ_V448_MUTATION) {
    assert.equal(process.env.HJ_V448_MUTATION, 'six-month');
    await page.evaluate(() => { hjSeasonRecentDeal = () => true; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS season-v448 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async ({ PLAN, OFFICE }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = []; state.adPosts = [];
      const today = localDate(), ago = n => hjAddDays(today, -n), ph = i => '010-6100-' + String(1000 + i);
      state.projects = PLAN.map(([i, kind, tail, doneAgo, cause, mkt, phone, note]) => {
        const p = { name: 'TEST_S' + i + ' ' + tail, kind, stage: doneAgo == null ? 1 : 3, phases: [], customer: { name: '박시즌' + i, phone: phone === undefined ? ph(i) : phone, addr: '대전 중구 대흥동 ' + i + '-1' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } };
        if (doneAgo != null) p.doneAt = ago(doneAgo);
        if (kind === 'leak') p.leak = { intake: { at: ago(doneAgo == null ? 0 : doneAgo + 2) + 'T01:00:00.000Z' }, detect: { cause: cause || '원인 미확정' } };
        if (note) state.notes.push({ id: 'n' + i, date: '2024. 1. 5. 오전 9:00:00', text: '[문의 접수] ' + ago(1100) + ' · 🥕 당근\n' + note, project: p.name });
        if (mkt) { const m = {}; for (const [k, v] of Object.entries(mkt)) m[k] = ago(-v); state.contacts.push({ id: 'c' + i, name: '박시즌' + i, phone: p.customer.phone, company: '', title: '', email: '', memo: '', tag: '고객', mkt: m }); }
        return p;
      });
      state.aptOffices = [{ id: 'off1', complex: '평화로운아파트', manager: '김소장', phone: OFFICE }];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __hjSeasonSel = null;
      for (const k of Object.keys(__v448)) __v448[k] = [];
      localStorage.removeItem('hj_season_custom'); localStorage.removeItem('hj_sms_unit_cost');
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V448_SEED_SAVE_FAILED');
      return today;
    }, { PLAN, OFFICE });
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
    if (!process.env.HJ_V448_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V448_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V448_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const targets = id => page.evaluate(id => { const t = hjSeasonTargets(id); return { map: Object.fromEntries(t.rows.map(r => [r.key, r.status])), rows: t.rows.map(r => ({ key: r.key, name: r.name, selectable: r.selectable, rules: r.rules })), noPhone: t.noPhone, selectable: t.selectable }; }, id);

  let today;
  await test('① 4캠페인 규칙별 명단(30명) · 동의/6개월/거부/90일 · 한 사람 한 줄 · 관리사무소 · 번호 없는 현장 · 읽기 전용', async () => {
    today = await seed(); const before = await snapshot();
    for (const [id, exp] of Object.entries(EXPECT)) {
      const t = await targets(id);
      assert.deepEqual(t.map, exp, 'SEASON_SIX_MONTH_RULE campaign ' + id);
      assert.equal(t.selectable, Object.values(exp).filter(s => s === 'consent' || s === 'sixmonth').length);
    }
    const rainy = await targets('rainy');
    assert.equal(rainy.rows.filter(r => r.key === digits(ph(3))).length, 1, 'same phone listed once');
    assert.deepEqual(rainy.rows.find(r => r.key === digits(ph(3))).rules, ['욕실·베란다·외벽 방수 시공']);
    assert.equal(rainy.rows.find(r => r.key === digits(OFFICE)).name, '평화로운아파트 관리사무소');
    assert.equal(rainy.noPhone, 1, 'project without a phone is counted, not listed');
    assert(rainy.rows.every(r => !/박시즌/.test(r.name)) && rainy.rows.some(r => r.name === '박○○ 님'), 'names are masked (surname + 님)');
    await page.evaluate(() => hjSeasonView('rainy')); await page.locator('#hjSeason').waitFor();
    assert.match(await page.locator('[data-season-rule]').innerText(), /\(광고\) 표기 · 끝에 수신거부 방법 · 밤 9시~아침 8시/);
    assert.deepEqual(await page.locator('[data-season-sel]:checked').evaluateAll(n => n.map(x => x.dataset.seasonSel).sort()), [digits(OFFICE), digits(ph(0)), digits(ph(3))].sort(), 'only consent / six-month are pre-selected');
    assert.equal(await page.locator('[data-season-sel][disabled]').count(), 4, 'need · optout · recent cannot be picked');
    assert.match(await page.locator('[data-season-count]').innerText(), /명단 7명 · 보낼 수 있음 3명 · 고른 3명/);
    await tapOk('#hjSeason button, #hjSeason label:has([data-season-sel]:not([disabled])), #ssCost, #modalRoot .mfoot button'); await noOverflow(); await shot('01-rainy');
    await page.locator('#ssCost').fill('20'); await page.locator('#ssCost').dispatchEvent('change');
    assert.match(await page.locator('[data-season-count]').innerText(), /예상 비용 60원/);
    await page.locator('[data-season-sel="' + digits(ph(3)) + '"]').uncheck(); assert.match(await page.locator('[data-season-count]').innerText(), /고른 2명/);
    await page.locator('#ssCopyNums').click(); assert.deepEqual(await page.evaluate(() => __v448.copies.at(-1)), { text: ['010-6100-1000', '042-555-1234'].sort((a, b) => a.replace(/\D/g, '').localeCompare(b.replace(/\D/g, ''))).join('\n'), label: '번호 2개' });
    await close(); await page.evaluate(() => { localStorage.removeItem('hj_sms_unit_cost'); __hjSeasonSel = null; });
    sameSnapshot(await snapshot(), before, 'extraction and drafts never write');
  });

  await test('② 원고 — (광고)·회사 번호·수신거부, 70자 표시, 인스타·당근 글에 번호 없음, 과장 표현·표기 삭제는 막힘, 밤 9시~아침 8시 경고', async () => {
    const m = await page.evaluate(() => HJ_SEASON_CAMPAIGNS.map(c => { const sms = hjSeasonSms(c), sns = hjSeasonSns(c); return { sms, sns, smsIssue: hjSeasonIssue(sms, 'sms'), snsIssue: hjSeasonIssue(sns, 'sns'), tel: hjAdTextHasTel(sns), ad: hjAdBanned(sms + sns) }; }));
    for (const x of m) {
      assert(x.sms.startsWith('(광고) [만물인테리어] ') && x.sms.includes('010-2397-8629') && x.sms.trim().endsWith("수신거부: 이 번호로 '거부' 회신"), x.sms.slice(0, 40));
      assert.deepEqual([x.smsIssue, x.snsIssue, x.tel, x.ad], ['', '', false, []]);
    }
    const issues = await page.evaluate(() => [hjSeasonIssue("(광고) 최저가 방수\n수신거부: 이 번호로 '거부' 회신", 'sms'), hjSeasonIssue("방수 점검\n수신거부: 이 번호로 '거부' 회신", 'sms'), hjSeasonIssue('(광고) 방수 점검', 'sms'), hjSeasonIssue('방수 점검 010-2397-8629', 'sns')]);
    assert.match(issues[0], /과장 표현/); assert.match(issues[1], /\(광고\) 표기/); assert.match(issues[2], /수신거부/); assert.match(issues[3], /전화번호/);
    assert.deepEqual(await page.evaluate(() => [hjSeasonNight(new Date(2026, 9, 16, 21, 0)), hjSeasonNight(new Date(2026, 9, 16, 7, 59)), hjSeasonNight(new Date(2026, 9, 16, 8, 0)), hjSeasonNight(new Date(2026, 9, 16, 20, 59))]), [true, true, false, false]);
    await page.evaluate(() => { window.__realNight = hjSeasonNight; hjSeasonNight = () => true; hjSeasonView('freeze'); }); await page.locator('#hjSeason').waitFor();
    assert.equal(await page.locator('[data-season-night]').count(), 1);
    assert.match(await page.locator('[data-season-len]').innerText(), /\d+자 · 장문\(LMS\)/);
    await page.locator('#ssCopySms').click(); assert.match(await page.evaluate(() => __v448.copies.at(-1).text), /^\(광고\) \[만물인테리어\] 겨울 동파 예방/); assert.match(await page.evaluate(() => __v448.toasts.at(-1)), /보내면 안 되는 시간/);
    const copied = await page.evaluate(() => __v448.copies.length);
    await page.locator('#ssSms').fill('(광고) 무조건 최저가\n' + "수신거부: 이 번호로 '거부' 회신"); await page.locator('#ssCopySms').click();
    assert.match(await page.locator('#ssIssue').innerText(), /과장 표현/); assert.equal(await page.evaluate(() => __v448.copies.length), copied, 'blocked draft is not copied');
    await page.locator('#ssCopySns').click(); assert(!/010/.test(await page.evaluate(() => __v448.copies.at(-1).text)));
    await close(); await page.evaluate(() => { hjSeasonNight = window.__realNight; });
    assert.equal(await page.evaluate(() => __v448.sms.length), 0, 'nothing is sent');
  });

  await test('③ 보냈음 → 마지막 발송일·adPosts 1건·90일 제외 · 거부 → 영구 제외 · 동의 기록 · 동의 문의 한 줄(기본 꺼짐) · 성과(v445)', async () => {
    await seed();
    await page.evaluate(() => hjSeasonView('rainy')); await page.locator('#hjSeason').waitFor();
    await footer('✅ 보냈음').click(); await page.locator('#hjSeason').waitFor();
    const sent = await page.evaluate(() => ({ posts: state.adPosts.filter(x => x.ch === 'sms-season').map(x => ({ campaign: x.campaign, count: x.count, date: x.date })), contacts: state.contacts.filter(c => c.mkt && c.mkt.lastSentAt).map(c => ({ d: c.phone.replace(/\D/g, ''), at: c.mkt.lastSentAt, sent: c.mkt.sent })) }));
    assert.deepEqual(sent.posts, [{ campaign: 'rainy', count: 3, date: today }]);
    assert.deepEqual(sent.contacts.map(c => c.d).sort(), [digits(OFFICE), digits(ph(0)), digits(ph(3)), digits(ph(13))].sort());
    assert(sent.contacts.filter(c => c.d !== digits(ph(13))).every(c => c.at === today && c.sent.at(-1).c === 'rainy'));
    const again = await targets('rainy');
    assert.deepEqual([again.map[digits(ph(0))], again.map[digits(ph(3))], again.map[digits(OFFICE)], again.selectable], ['recent', 'recent', 'recent', 0]);
    await close(); await page.evaluate(() => hjSeasonView('freeze')); await page.locator('[data-season-optout="' + digits(ph(6)) + '"]').click();
    assert.equal((await targets('freeze')).map[digits(ph(6))], 'optout'); assert.equal((await targets('holiday')).map[digits(ph(6))], undefined);
    await close(); await page.evaluate(() => { state.tab = 'contacts'; render(); });
    await page.locator('#view [data-conmkt]').first().waitFor();
    const cid = await page.evaluate(d => state.contacts.find(c => c.phone.replace(/\D/g, '') === d).id, digits(ph(6)));
    assert.match(await page.locator('#view .contact', { has: page.locator('[data-conmkt="' + cid + '"]') }).locator('[data-mkt-line]').innerText(), /수신거부/);
    await page.locator('[data-conmkt="' + cid + '"]').click(); await page.locator('#hjMkt').waitFor(); await tapOk('#modalRoot .mfoot button');
    await footer('✅ 동의 받음').click();
    assert.equal((await targets('freeze')).map[digits(ph(6))], 'consent', 'consent clears the opt-out');
    await page.evaluate(() => { state.tab = 'dashboard'; render(); payRcptDialog(state.projects[3].name); }); await page.locator('#prcMktAsk').waitFor();
    assert.equal(await page.locator('#prcMktAsk').isChecked(), false, 'consent line is off by default');
    await footer('🧾 영수증 만들기').click(); await page.waitForFunction(() => __v448.deliver.length === 1); assert.doesNotMatch(await page.evaluate(() => __v448.deliver[0].html), /data-mkt-ask/);
    await close(); await page.evaluate(() => payRcptDialog(state.projects[3].name)); await page.locator('#prcMktAsk').check(); await footer('🧾 영수증 만들기').click(); await page.waitForFunction(() => __v448.deliver.length === 2);
    assert.match(await page.evaluate(() => __v448.deliver[1].html), /data-mkt-ask[\s\S]*안내 문자를 받겠습니다/);
    await close(); await page.evaluate(() => msgCenterCompose('done', { project: state.projects[3].name, text: '공사가 끝났습니다' })); await page.locator('#mcMktAsk').waitFor();
    assert.equal(await page.locator('#mcMktAsk').isChecked(), false); await page.locator('#mcMktAsk').check();
    assert.match(await page.locator('#mcBody').inputValue(), /안내 문자를 받으시겠어요\? 원하시면 "동의"라고 답장 주세요/);
    await page.locator('#mcMktAsk').uncheck(); assert.equal(await page.locator('#mcBody').inputValue(), '공사가 끝났습니다');
    await close();
    await page.evaluate(d => { state.projects.push({ name: 'TEST_S99 재문의', kind: 'leak', stage: 2, phases: [], customer: { name: '박시즌0', phone: d, addr: '' }, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, inquiryAt: hjAddDays(localDate(), 3) }); }, ph(0));
    assert.deepEqual(await page.evaluate(() => hjSeasonPerf().map(x => ({ c: x.campaign, count: x.count, inq: x.inq, won: x.won }))), [{ c: 'rainy', count: 3, inq: 1, won: 1 }]);
    await page.evaluate(() => hjInsightView({ period: 'all', kind: 'all' })); await page.locator('[data-insight-season]').waitFor();
    assert.match(await page.locator('[data-insight-season]').innerText(), /장마 전 방수·누수 점검\s+3\s+1\s+1/);
    await close();
  });

  await test('④ 내 캠페인(이 기기) · 첫 화면 시기 줄 · 광고 탭 진입 · 새 최상위 키 없음 · 더보기 126', async () => {
    await seed(); const keys0 = (await snapshot()).keys;
    await page.evaluate(() => hjSeasonView('rainy')); await page.locator('#ssCustom').click(); await page.locator('#hjSeasonCustom').waitFor();
    await page.locator('#scTitle').fill('봄맞이 욕실 점검'); await page.locator('#scFrom').fill('04-01'); await page.locator('#scTo').fill('04-20');
    await page.locator('#scSms').fill('평생 보증 욕실 점검'); await footer('💾 이 기기에 저장').click(); assert.match(await page.locator('#scIssue').innerText(), /과장 표현/);
    await page.locator('#scSms').fill('봄맞이 욕실 실리콘·배수 점검 안내드립니다. 범위에 따라 상담 후 안내드립니다.'); await footer('💾 이 기기에 저장').click(); await page.locator('#hjSeason').waitFor();
    const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('hj_season_custom')));
    assert.equal(custom.length, 1); assert.equal(custom[0].title, '봄맞이 욕실 점검'); assert.deepEqual(custom[0].rules, ['leak13', 'waterproof', 'leakcomplex']); assert(!/박시즌|6100/.test(JSON.stringify(custom)), 'no personal data in the template');
    assert.equal(await page.locator('[data-season-pick]').count(), 5); assert.equal(await page.locator('[data-season-pick][aria-pressed="true"]').innerText(), '🌦 봄맞이 욕실 점검');
    await close();
    const due = await page.evaluate(() => { const real = localDate; const at = d => hjSeasonDue(d).map(c => c.id); return { june: at('2026-06-01'), nov: at('2026-11-20'), mar: at('2026-03-10'), jan: at('2026-01-05'), jul: at('2026-07-10') }; });
    assert.deepEqual(due, { june: ['rainy'], nov: ['freeze'], mar: ['condense'], jan: ['holiday'], jul: [] });
    await page.evaluate(() => { state.tab = 'ads'; render(); }); await page.locator('#view [data-season]').click(); await page.locator('#hjSeason').waitFor(); await tapOk('#view [data-season]');
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; localStorage.removeItem('hj_season_custom'); render(); });
    assert.deepEqual((await snapshot()).keys, keys0, 'no new top-level keys');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v448.external), []); assert.equal(await page.evaluate(() => __v448.sms.length), 0);
  });
  console.log(`season-v448: ${passed}/${passed} PASS; synthetic data; external writes=0; sends=0`);
  await context.close();
})().catch(async error => { console.error('FAIL season-v448', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
