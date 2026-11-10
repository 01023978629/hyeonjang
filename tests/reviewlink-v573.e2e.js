/* reviewlink-v573.e2e.js — 리뷰 요청 문자·QR 의 후기 링크 규칙 한 곳(PR #190 v426 을 v564 위에 다시 얹은 v573)
   설정 ⭐ 리뷰 링크(https:// 만, 이 기기 IDB) → 없으면 홈페이지 후기 페이지(REVIEW_FALLBACK_URL). 입구가 어디든 같다:
   ① hjReviewLink() 한 곳 — 빈 설정·설정 링크·https 아닌 옛 값
   ② 세 입구(현장 상세 ⭐ 리뷰 요청 hjReviewSms · 더보기 🗣/AI 운영 큐 reviewRequestSms · 문자 센터 msgTemplate review) — 빈 설정이면 기본 링크 한 줄
   ③ 설정 링크를 저장하면 세 입구 모두 그 링크만(기본 링크 없음) · 직렬화에 링크가 섞이지 않는다
   ④ 설정 화면 — 어느 주소가 쓰이는지 한 줄, 기본 주소와 '열려 있어야 합니다' 힌트, https 아닌 값은 저장 거부(칸 아래 알림), 비우면 기본으로
   ⑤ 준공 관리 카드 힌트(v456) — 설정 링크 없으면 'ⓘ 홈페이지 후기 링크 — 설정'(없음이라 하지 않음), 있으면 사라짐
   ⑥ QR — 기본 주소로도 카드·토글·📎 서류 줄이 된다, 설정 링크가 QR 한 장을 넘을 때만 칸이 사라진다
   ⑦ AI 운영 큐 — 리뷰 항목의 action.fn 이 reviewRequestSms 이고 window[fn] 으로 실행돼 같은 링크가 붙는다
   실발신 없음 — hjSendSms·hjDocDeliverView·toast 를 후킹해 의도만 잡는다. 변이(기본 링크 제거·설정 무시·입구 하나 누락)는 index.html 을 고쳐 돌린다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }

const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const FALLBACK = 'https://01023978629.github.io/manmool/review.html';   // manmool PR #223 이 만드는 홈페이지 후기 페이지
const LINK = 'https://naver.me/REVIEWTEST569';
const RAW_PHONE = '01033338888';
const DONE = 'TEST_V569 준공현장', LIVE = 'TEST_V569 진행현장';
const oneLink = t => (String(t).match(/https?:\/\//g) || []).length;
const COMPANY_SIGN_START = '만물인테리어 ';   // msgTemplate 의 sign = '\n'+COMPANY.name+' '+COMPANY.owner+' 드림 (…)'

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {}
    window.__v573 = { sms: [], deliver: [], toasts: [] };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
  await page.evaluate(() => {
    aiOpsEnsureState().enabled = false;
    window.hjSendSms = (phone, text) => { __v573.sms.push({ phone: String(phone || ''), text: String(text || '') }); };
    const realToast = toast; toast = m => { __v573.toasts.push(String(m)); return realToast(m); };
    hjDocDeliverView = (...a) => { __v573.deliver.push({ name: a[0], html: a[1], base: a[2], label: a[3] }); closeModal(true); };
  });
  let passed = 0;
  async function test(name, fn) { await fn(); passed++; console.log('PASS reviewlink-v573 ' + name); }
  const close = () => page.evaluate(() => { closeModal(true); const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };   // 검사 쪽 날짜(UTC 자정 기준으로 충분 — 90일 창 안이면 된다)
  async function seed() {
    await close();
    await page.evaluate(({ done, live, ph, doneAt }) => {
      __v573.sms = []; __v573.deliver = []; __v573.toasts = [];
      state.notes = []; state.files = []; state.payLog = []; state.schedule = [];
      state.projects = [
        { name: done, stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박준공', phone: ph, addr: '대전 중구' }, doneAt, archived: false },
        { name: live, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이진행', phone: '01011112222', addr: '대전 서구' }, archived: false }
      ];
      state.activeProject = null; state.tab = 'dashboard'; render();
    }, { done: DONE, live: LIVE, ph: RAW_PHONE, doneAt: daysAgo(10) });
  }
  const openDetail = async name => { await close(); await page.evaluate(n => { state.activeProject = n; state.tab = 'project'; window.__projView = null; render(); }, name); await page.locator('[data-donecard]').first().waitFor(); };
  // 설정 UI 로 저장 — __reviewUrl 은 let 이라 실제 저장 경로(idb 포함)를 지난다
  async function saveViaSettings(v) {
    await close();
    await page.evaluate(() => openGdriveSetup()); await page.locator('#modalRoot #setTab-etc').click(); await page.locator('#rvUrl').waitFor();
    await page.locator('#rvUrl').fill(v); await page.locator('#rvSave').click(); await page.waitForTimeout(150);
    const r = await page.evaluate(async () => ({ mem: __reviewUrl, idb: await idbGet('review_url'), state: (document.querySelector('#rvState') || {}).textContent || '', invalid: (document.querySelector('#rvUrl') || {}).getAttribute && document.querySelector('#rvUrl').getAttribute('aria-invalid'), alert: [...document.querySelectorAll('#modalRoot .field-issue[role="alert"]')].map(e => e.textContent).join(' | '), hint: (document.querySelector('[data-review-link-default]') || {}).textContent || '' }));
    return r;
  }

  await test('① hjReviewLink() 한 곳 — 빈 설정이면 홈페이지 후기 페이지, 설정 링크(https)면 그것, https 아닌 옛 값은 쓰지 않고 기본으로', async () => {
    await seed();
    const r = await page.evaluate(L => {
      const out = {};
      __reviewUrl = ''; out.blank = { link: hjReviewLink(), custom: hjReviewLinkCustom(), state: hjReviewLinkStateText() };
      __reviewUrl = L; out.custom = { link: hjReviewLink(), custom: hjReviewLinkCustom(), state: hjReviewLinkStateText() };
      __reviewUrl = 'naver.me/REVIEWTEST569'; out.raw = { link: hjReviewLink(), custom: hjReviewLinkCustom(), state: hjReviewLinkStateText() };
      __reviewUrl = ''; out.const = REVIEW_FALLBACK_URL;
      return out;
    }, LINK);
    assert.equal(r.const, FALLBACK, 'REVIEW_FALLBACK_URL');
    assert.deepEqual(r.blank, { link: FALLBACK, custom: '', state: '기본: 홈페이지 후기 페이지' }, 'blank ' + JSON.stringify(r.blank));
    assert.deepEqual(r.custom, { link: LINK, custom: LINK, state: '✅ 저장됨 — 문자·QR 에 이 링크' }, 'custom ' + JSON.stringify(r.custom));
    assert.equal(r.raw.link, FALLBACK, 'non-https value is not used'); assert.equal(r.raw.custom, ''); assert.match(r.raw.state, /https:\/\/ 로 시작하지 않아[\s\S]*홈페이지 후기 페이지/);
  });

  await test('② 세 입구 — 빈 설정: 현장 상세 ⭐ 리뷰 요청·더보기/AI 큐 reviewRequestSms·문자 센터 review 문안에 홈페이지 후기 링크가 한 줄씩', async () => {
    await seed(); await openDetail(DONE);
    await page.locator('[data-reviewreqp]').click(); await page.waitForFunction(() => __v573.sms.length === 1);
    const a = await page.evaluate(() => ({ sms: __v573.sms[0], toast: __v573.toasts[__v573.toasts.length - 1] || '', p: state.projects[0].reviewRequestedAt, note: (state.notes || []).map(n => n.text).join('\n') }));
    assert.equal(a.sms.phone, RAW_PHONE, 'deep link gets the raw phone only'); assert(a.sms.text.includes(DONE) && a.sms.text.includes(FALLBACK), 'detail card SMS carries the homepage link: ' + JSON.stringify(a.sms.text));
    assert.equal(oneLink(a.sms.text), 1, 'exactly one link line'); assert.equal(a.sms.text.split('\n').pop(), FALLBACK, 'link is the last line');
    assert.match(a.toast, /홈페이지 후기 페이지 링크 포함/, 'toast says which link: ' + a.toast); assert(a.p, 'reviewRequestedAt recorded'); assert(!a.note.includes(RAW_PHONE) && !a.note.includes(FALLBACK), 'note keeps neither the phone nor the link');
    const ret = await page.evaluate(n => { state.projects[0].reviewRequestedAt = null; return hjReviewSms(n); }, DONE);
    assert.deepEqual(ret, { 요청: DONE, 링크포함: true, 링크: 'homepage' }, 'return value names the link kind ' + JSON.stringify(ret));
    const b = await page.evaluate(n => { __v573.sms = []; const r = reviewRequestSms(n); return { r, sms: __v573.sms[0], tpl: msgTemplate('review', state.projects[0]) }; }, DONE);
    assert.deepEqual(b.r, { 발송: DONE }); assert.equal(b.sms.phone, RAW_PHONE);
    assert(b.sms.text.includes(FALLBACK) && oneLink(b.sms.text) === 1 && /후기를 남겨주시면/.test(b.sms.text), '더보기/AI 큐 문안 + 링크 한 줄: ' + JSON.stringify(b.sms.text));
    assert(b.tpl.includes('후기 한 줄: ' + FALLBACK) && oneLink(b.tpl) === 1 && /공사는 만족스러우셨나요/.test(b.tpl), '문자 센터 review 문안 + 링크 한 줄: ' + JSON.stringify(b.tpl));
    assert(b.tpl.includes('후기 한 줄: ' + FALLBACK + '\n' + COMPANY_SIGN_START), 'link line sits right before the signature: ' + JSON.stringify(b.tpl));
  });

  await test('③ 설정 링크를 저장하면 세 입구 모두 그 링크만 — 기본 링크 없음, 직렬화(serializeData)에 링크가 섞이지 않는다', async () => {
    await seed();
    const s = await saveViaSettings(LINK);
    assert.equal(s.mem, LINK); assert.equal(s.idb, LINK, 'idb round trip'); assert.equal(s.state, '✅ 저장됨 — 문자·QR 에 이 링크'); assert.equal(s.invalid, null, 'no field issue for a good link');
    await openDetail(DONE); await page.locator('[data-reviewreqp]').click(); await page.waitForFunction(() => __v573.sms.length === 1);
    const r = await page.evaluate(n => { const sms1 = __v573.sms[0]; __v573.sms = []; reviewRequestSms(n); return { a: sms1.text, b: __v573.sms[0].text, c: msgTemplate('review', state.projects[0]), ser: JSON.stringify(serializeData()), ret: (state.projects[0].reviewRequestedAt = null, hjReviewSms(n)) }; }, DONE);
    for (const [k, t] of [['detail', r.a], ['more/ai', r.b], ['msgcenter', r.c]]) {
      assert(t.includes(LINK), k + ' carries the custom link: ' + JSON.stringify(t)); assert(!t.includes(FALLBACK), k + ' drops the default link'); assert.equal(oneLink(t), 1, k + ' one link line');
    }
    assert.deepEqual(r.ret, { 요청: DONE, 링크포함: true, 링크: 'custom' });
    assert(!r.ser.includes(LINK) && !r.ser.includes('review_url'), 'the review link lives in this device only (not in serializeData)');
  });

  await test('④ 설정 화면 — 기본 주소와 "열려 있어야 합니다" 힌트, https 아닌 값은 저장하지 않고 칸 아래 알림(기존 값 유지), 비우면 기본으로', async () => {
    await seed();
    let s = await saveViaSettings(LINK);
    assert(s.hint.includes(FALLBACK) && /홈페이지 후기 페이지가 열려 있어야 합니다/.test(s.hint), 'default address + hint: ' + s.hint);
    s = await saveViaSettings('naver.me/REVIEWTEST569');
    assert.equal(s.mem, LINK, 'bad value is not saved (memory)'); assert.equal(s.idb, LINK, 'bad value is not saved (idb)'); assert.equal(s.invalid, 'true', 'aria-invalid on the field');
    assert.match(s.alert, /https:\/\/ 로 시작하는 주소를 넣어 주세요/, 'field issue text: ' + s.alert); assert.equal(s.state, '✅ 저장됨 — 문자·QR 에 이 링크', 'state line unchanged on refusal');
    const t1 = await page.evaluate(() => __v573.toasts.filter(t => /저장됨/.test(t)).length); assert.equal(t1, 1, 'no "saved" toast for the refused value');
    s = await saveViaSettings('');
    assert.equal(s.mem, ''); assert.equal(s.idb, ''); assert.equal(s.state, '기본: 홈페이지 후기 페이지'); assert.equal(s.invalid, null);
    assert.match(await page.evaluate(() => __v573.toasts[__v573.toasts.length - 1]), /홈페이지 후기 페이지 링크로 돌아갑니다/);
    const desc = await page.evaluate(() => document.querySelector('#modalRoot #rvUrl').closest('div').textContent);
    assert(/더보기 🗣 리뷰·소개 요청/.test(desc) && /문자 센터/.test(desc) && /비워두면 홈페이지 후기 페이지/.test(desc), 'settings copy names the three entries and the default: ' + desc.slice(0, 200));
  });

  await test('⑤ 준공 관리 카드 힌트(v456) — 설정 링크 없으면 "ⓘ 홈페이지 후기 링크 — 설정"(없음이라 하지 않음), 있으면 사라짐, 비준공 카드엔 없음', async () => {
    await seed(); await page.evaluate(() => { __reviewUrl = ''; }); await openDetail(DONE);
    const h = await page.evaluate(() => { const b = document.querySelector('[data-donecard="1"] [data-review-link-missing]'); return { has: !!b, text: b && b.textContent.trim(), title: b && b.getAttribute('title'), h: b && b.getBoundingClientRect().height }; });
    assert(h.has, 'hint present'); assert.match(h.text, /홈페이지 후기 링크/); assert.doesNotMatch(h.text, /없음/); assert.match(h.title, /설정 › 기타 › 리뷰 링크/); assert(h.h >= 32, 'tap height ' + h.h);
    await page.locator('[data-donecard="1"] [data-review-link-missing]').click(); await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => ({ tab: document.querySelector('#modalRoot #setTab-etc').getAttribute('aria-selected'), focused: document.activeElement && document.activeElement.id })), { tab: 'true', focused: 'rvUrl' });
    await page.evaluate(L => { __reviewUrl = L; }, LINK); await openDetail(DONE);
    assert.equal(await page.evaluate(() => !!document.querySelector('[data-review-link-missing]')), false, 'hint gone with a custom link');
    await page.evaluate(() => { __reviewUrl = ''; }); await openDetail(LIVE);
    assert.deepEqual(await page.evaluate(() => ({ dim: !!document.querySelector('[data-donecard="0"]'), hint: !!document.querySelector('[data-review-link-missing]') })), { dim: true, hint: false });
  });

  await test('⑥ QR — 기본 주소로도 ⭐ 카드·끝 QR 토글·📎 서류 줄이 된다, 설정 링크가 QR 한 장을 넘을 때만 칸이 사라진다', async () => {
    await seed();
    const q = await page.evaluate(L => {
      const out = {};
      __reviewUrl = ''; out.blank = { ok: hjReviewQrOk(), toggle: hjQrToggleHtml('rcpt', 'tQr'), card: hjReviewQrCardView() };
      __reviewUrl = L; out.custom = { ok: hjReviewQrOk(), toggle: hjQrToggleHtml('rcpt', 'tQr2') };
      __reviewUrl = 'https://example.com/' + 'q'.repeat(200); out.long = { ok: hjReviewQrOk(), toggle: hjQrToggleHtml('rcpt', 'tQr3'), card: hjReviewQrCardView(), empty: (document.querySelector('[data-review-qr-empty]') || {}).textContent || '' };
      __reviewUrl = '';
      return Object.assign(out, { deliver: __v573.deliver.map(d => ({ label: d.label, imgs: (d.html.match(/<img data-qr /g) || []).length })) });
    }, LINK);
    assert.equal(q.blank.ok, true, 'QR ok with the default address'); assert.match(q.blank.toggle, /data-qr-toggle="rcpt"[\s\S]*홈페이지 후기 페이지/, 'toggle names the default address'); assert.equal(q.blank.card, true);
    assert.equal(q.custom.ok, true); assert.match(q.custom.toggle, /설정의 리뷰 링크/);
    assert.deepEqual([q.long.ok, q.long.toggle, q.long.card], [false, '', false], 'too-long custom link → no QR anywhere'); assert.match(q.long.empty, /너무 깁니다/);
    assert.deepEqual(q.deliver, [{ label: '⭐ 리뷰 QR 카드', imgs: 2 }], 'one card (A6 × 2) delivered for the blank setting, none for the too-long link');
    await close(); await page.evaluate(n => docHubView(n), DONE); await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').innerText(), /홈페이지 후기 링크\(기본\)/);
    await close(); await page.evaluate(L => { __reviewUrl = L; }, LINK); await page.evaluate(n => docHubView(n), DONE); await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="reviewqr"]').innerText(), /설정 리뷰 링크/); await page.evaluate(() => { __reviewUrl = ''; });
  });

  await test('⑦ AI 운영 큐 — 리뷰 항목의 action.fn 은 reviewRequestSms(승인 필요), window[fn] 으로 돌리면 같은 링크 규칙', async () => {
    await seed();
    const r = await page.evaluate(n => {
      const t = aiPlannerScan('daily').find(x => x.type === 'review' && x.project === n);
      if (!t) return { none: true };
      __v573.sms = []; const fn = window[t.action.fn]; const ret = typeof fn === 'function' ? fn(t.action.arg) : null;
      return { kind: t.action.kind, fn: t.action.fn, arg: t.action.arg, approval: t.requiresApproval, ret, text: (__v573.sms[0] || {}).text || '' };
    }, DONE);
    assert(!r.none, 'planner lists the done project for a review request');
    assert.deepEqual([r.kind, r.fn, r.arg, r.approval], ['sms', 'reviewRequestSms', DONE, true], JSON.stringify(r));
    assert.deepEqual(r.ret, { 발송: DONE }); assert(r.text.includes(FALLBACK) && oneLink(r.text) === 1, 'queue path SMS carries the default link once: ' + JSON.stringify(r.text));
  });

  const bad = errs.filter(e => !/ResizeObserver/.test(e));
  assert.deepEqual(bad, [], 'no page errors');
  await browser.close();
  console.log('reviewlink-v573: ' + passed + '/7 passed');
})().catch(e => { console.error('FAIL reviewlink-v573', e && e.stack || e); process.exit(1); });
