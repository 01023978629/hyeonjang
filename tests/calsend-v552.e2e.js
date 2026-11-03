/* v552 📅 작업자 캘린더로 보내기 — 한 달 일정을 골라서·전체로 .ics 한 파일(카톡으로 보내 삼성·아이폰 캘린더에). 합성 자료만, 외부 쓰기 0.
   ① 일정표 [📤 12월 일정 작업자 캘린더로] → 창: 그달에 걸친 팀 일정만(💰·세금 자동·앱이 넣은 개인 일정 빼고, 지난달에서 이어지는 공정 포함) · 날짜·시각 순 · 처음엔 전부 체크 (OPEN)
   ② 고르기: 체크 해제 → '선택한 N건' · [👤 담당] 칩 → 그 사람 일정만 · 모두 해제 → 선택 보내기 잠김 · 모두 선택 (PICK)
   ③ 선택 보내기(내려받기 길): 여러 날 공정은 날마다 하나 · 출입 번호처럼 보이는 메모 토막은 빠지고 나머지는 ' · ' 로 · 고객 이름·전화 없음, 주소는 있음 ·
      파일 이름 · 작업자용 안내(내 캘린더 안내 아님) · 뺀 곳 알림 / 공유 길(폰): text/calendar 파일 하나 + 카카오톡 안내 (SEND)
   ④ [전체 보내기]는 체크와 무관하게 전부 · ‹ › 달 옮기기(빈 달 안내) · [💬 받는 법 안내 글] — 삼성·아이폰 순서·달·건수·문의, 고객 정보 없음 (ALL)
   ⑤ 📤 일정 공유 창의 [📅 한 달 일정 골라서…] → 그 범위의 달로 열리고 [‹ 뒤로]는 공유 창 · 예전 내 캘린더 저장 안내 글은 그대로 (SHARE)
   ⑥ 폰 390: 창 가로 넘침 0 · 줄·단추 44px · 줄 누르면 체크 바뀜 (PHONE)
   ⑦ 소스·핀 3곳(v552 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V552_BASELINE=<commit> 은 ① 에서, HJ_V552_MUTATION=no-scrub(출입 번호 토막 빼기 삭제)은 ③ 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V552_MUTATION || '';
let html = process.env.HJ_V552_BASELINE ? execFileSync('git', ['show', process.env.HJ_V552_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-scrub');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'keep=parts.filter(p=>!hjLooksLikeAccessCode(p));';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'keep=parts;');
}
const GA = 'T552 빌라';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, ga }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false;
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;
    try { closeModal(true); } catch (e) {}
    const orig = window.localDate; window.localDate = d => d ? orig(d) : '2026-12-02';   // 실제 날짜와 무관
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    state.projects.push({ name: ga, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김가상', phone: '010-0000-1111', addr: '대전 가상구 가상로 1' } });
    const S = (id, date, title, x) => Object.assign({ id: 'v552_' + id, date, time: '', title, project: '', workers: '', memo: '', hours: 0, report: null }, x || {});
    state.schedule = [
      S('a', '2026-12-03', '욕조방수 1칸', { project: ga, memo: '거실 욕실\n현관 1234*\n자재는 전날 반입' }),
      S('b', '2026-12-10', '도배 (3일차 시작)', { time: '09:00', crew: '김도배', memo: '2026-12-10~2026-12-12 (3일)', hours: 8 }),
      S('c', '2026-12-15', '타일', { time: '08:00', crew: '박타일', hours: 8 }),
      S('d', '2026-11-30', '철거 (3일차 시작)', { time: '09:00', crew: '김도배', memo: '2026-11-30~2026-12-02 (3일)', hours: 8 }),   // 지난달에서 이어짐
      S('n', '2026-11-13', '욕조방수(욕조 신설)'),
      S('t', '2026-12-25', '부가세 납부', { _taxAuto: true }),
      S('m', '2026-12-26', '💰 잔금 수금'),
      S('q', '2026-12-28', '개인 일정', { sourceUid: 'v552-own@test' })
    ];
    window.__v552 = { dl: [], shared: [], toasts: [], kakao: [] };
    window.downloadICS = (items, name, opts) => { __v552.dl.push({ name, ics: buildICS(items, opts), saveMsg: opts && opts.saveMsg || '' }); };
    const t0 = window.toast; window.toast = m => { __v552.toasts.push(String(m)); try { t0(m); } catch (e) {} };
    window.kakaoShareText = async (text, title) => { __v552.kakao.push({ text, title }); return { 완료: '공유' }; };
    __calYM = '2026-12'; __calSelDate = null; state.tab = 'schedule'; render(); if (mobile) syncMobileNav();
  }, { keys: BOOT, mobile: !!mobile, ga: GA });
  return { context, page };
}
const modal = page => page.evaluate(() => {
  const m = document.getElementById('calSend'); if (!m) return null;
  const sel = document.querySelector('#csSendSel');
  return {
    month: (document.querySelector('#csMonth') || {}).textContent,
    rows: [...m.querySelectorAll('.csRow')].map(e => [e.dataset.id.replace('v552_', ''), e.querySelector('.csChk').checked, e.innerText.replace(/\s+/g, ' ').trim()]),   // <br> 은 innerText 에서 줄바꿈
    count: (document.querySelector('#csCount') || {}).textContent, sel: sel ? sel.textContent : null, selOff: sel ? sel.disabled : null,
    all: (document.querySelector('#csSendAll') || {}).textContent, crews: [...m.querySelectorAll('.csCrew')].map(b => b.dataset.name),
    empty: (m.querySelector('.empty') || {}).textContent || ''
  };
});
const ev = ics => ics.split('\r\n').reduce((a, l) => { if (l === 'BEGIN:VEVENT') a.push({}); else if (a.length && /^[A-Z;=]+:/.test(l)) { const k = l.slice(0, l.indexOf(':')).split(';')[0]; a[a.length - 1][k] = l.slice(l.indexOf(':') + 1); } return a; }, []);
async function test(name, fn) { await fn(); passed++; console.log('PASS calsend-v552 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), fullPage: false }); }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 1280 });

  await test('① 일정표 단추 → 창: 그달 팀 일정만·지난달에서 이어지는 공정 포함·날짜순·전부 체크 (OPEN)', async () => {
    assert.equal(((await page.locator('#schCalSend').textContent()) || '').trim(), '📤 12월 일정 작업자 캘린더로', 'button names the month being viewed');
    await page.locator('#schCalSend').click();
    const m = await modal(page);
    assert(m, 'modal opens');
    assert.equal(m.month, '2026년 12월');
    assert.deepEqual(m.rows.map(r => r[0]), ['d', 'a', 'b', 'c'], 'team rows only, by date/time (tax·💰·own entries out, Nov carry-over in) ' + JSON.stringify(m.rows));
    assert(m.rows.every(r => r[1]), 'all checked at first');
    assert.match(m.rows[0][2], /^11\/30\(월\) 09:00 ~12\/2\(수\) · 3일 철거 · 👤 김도배$/, 'multi-day line ' + m.rows[0][2]);
    assert.match(m.rows[1][2], /^12\/3\(목\) 종일 욕조방수 1칸 · 🏗 T552 빌라$/, 'all-day line ' + m.rows[1][2]);
    assert.equal(m.count, '4 / 4건 선택'); assert.equal(m.sel, '📅 선택한 4건 보내기'); assert.equal(m.all, '📅 전체 4건 보내기');
    assert.deepEqual(m.crews, ['김도배', '박타일'], 'crew chips');
    await shot(page, 'v552-pc-modal');
  });

  await test('② 고르기 — 해제·담당 칩·모두 해제(선택 보내기 잠김)·모두 선택 (PICK)', async () => {
    await page.locator('.csRow[data-id="v552_c"]').click();
    let m = await modal(page); assert.equal(m.count, '3 / 4건 선택'); assert.equal(m.sel, '📅 선택한 3건 보내기');
    await page.locator('.csCrew[data-name="김도배"]').click();
    m = await modal(page); assert.deepEqual(m.rows.filter(r => r[1]).map(r => r[0]), ['d', 'b'], 'crew chip picks only that person'); assert.equal(m.sel, '📅 선택한 2건 보내기');
    await page.locator('#csNone').click();
    m = await modal(page); assert.equal(m.selOff, true, 'nothing picked → send-selected locked'); assert.equal(m.count, '0 / 4건 선택');
    await page.locator('#csAll').click();
    m = await modal(page); assert(m.rows.every(r => r[1]) && m.selOff === false, 'all picked again');
  });

  await test('③ 선택 보내기 — 날마다 하나·출입 번호 토막 빠짐·고객 이름/전화 없음·파일 이름·작업자용 안내 / 공유 길 (SEND)', async () => {
    await page.locator('.csCrew[data-name="김도배"]').click();
    await page.locator('.csRow[data-id="v552_a"]').click();   // 김도배 둘 + 욕조방수
    await page.locator('#csSendSel').click();
    await page.waitForFunction(() => __v552.dl.length === 1);
    const d = await page.evaluate(() => __v552.dl[0]);
    assert.equal(d.name, '만물인테리어_2026년12월_작업일정_3건.ics', 'file name');
    assert.equal(d.saveMsg, '📥 만물인테리어_2026년12월_작업일정_3건.ics 내려받음 — 카톡 대화방에 파일로 올리세요', 'worker-facing save message');
    const e = ev(d.ics);
    assert.deepEqual(e.map(x => [x.DTSTART, x.SUMMARY]), [
      ['20261130T090000', '철거 (3일 · ~12/2(수))'], ['20261201T090000', '철거 (2/3일째)'], ['20261202T090000', '철거 (3/3일째)'],
      ['20261203', '[T552 빌라] 욕조방수 1칸'],
      ['20261210T090000', '도배 (3일 · ~12/12(토))'], ['20261211T090000', '도배 (2/3일째)'], ['20261212T090000', '도배 (3/3일째)']], 'one event per working day ' + JSON.stringify(e.map(x => [x.DTSTART, x.SUMMARY])));
    const bath = e.find(x => x.DTSTART === '20261203');
    assert.equal(bath.DESCRIPTION, '현장: T552 빌라 / 주소: 대전 가상구 가상로 1 / 거실 욕실 · 자재는 전날 반입', 'door-code piece dropped, rest joined ' + bath.DESCRIPTION);
    assert(!/1234|김가상|010-0000-1111/.test(d.ics), 'no door code, customer name or phone in the file');
    assert(e.every(x => x.UID && /@manmul$/.test(x.UID)) && new Set(e.map(x => x.UID)).size === e.length, 'unique UIDs');
    await page.waitForFunction(() => __v552.toasts.some(t => /출입 번호처럼 보이는 메모 1곳은 빼고 만들었어요/.test(t)), null, { timeout: 5000 });
    // 공유 길(파일 공유가 되는 폰): text/calendar 파일 하나 + 카톡 안내
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { const f = data.files[0]; __v552.shared.push({ n: data.files.length, name: f.name, type: f.type, text: await f.text() }); } });
    });
    await page.locator('#csSendSel').click();
    await page.waitForFunction(() => __v552.shared.length === 1);
    const s = await page.evaluate(() => __v552.shared[0]);
    assert.equal(s.n, 1); assert.equal(s.type, 'text/calendar'); assert.equal(s.name, '만물인테리어_2026년12월_작업일정_3건.ics');
    assert.equal(ev(s.text).length, 7, 'same events through the share sheet');
    await page.waitForFunction(() => __v552.toasts.includes('📤 공유 목록에서 카카오톡을 골라 보내세요'));
    await page.evaluate(() => { delete navigator.canShare; delete navigator.share; });
  });

  await test('④ 전체 보내기는 체크와 무관 · ‹ › 달 옮기기 · 받는 법 안내 글 (ALL)', async () => {
    await page.locator('#csNone').click();
    await page.locator('#csSendAll').click();
    await page.waitForFunction(() => __v552.dl.length === 2);
    const d = await page.evaluate(() => __v552.dl[1]);
    assert.equal(d.name, '만물인테리어_2026년12월_작업일정_4건.ics'); assert.equal(ev(d.ics).length, 8, 'all four rows → 8 day events');
    await page.locator('#csAll').click();
    await page.locator('#csGuide').click();
    const k = await page.evaluate(() => __v552.kakao[0]);
    assert.equal(k.title, '만물인테리어 캘린더 받는 법');
    assert.match(k.text, /^\[만물인테리어\] 2026년 12월 작업 일정 4건 — 캘린더 파일/, 'guide head ' + k.text.split('\n')[0]);
    assert(/삼성\(갤럭시\): 파일 받기 → 열기 → \[캘린더\] 앱 → 저장/.test(k.text) && /아이폰: 파일 누르기 → 오른쪽 위 공유\(↑\) → \[캘린더\] → 모두 추가/.test(k.text), 'both phones explained');
    assert(/문의 /.test(k.text) && !/김가상|010-0000-1111|T552/.test(k.text), 'contact line, no customer or site data');
    await page.locator('#csNext').click();
    let m = await modal(page); assert.equal(m.month, '2027년 1월'); assert.equal(m.rows.length, 0); assert.match(m.empty, /1월에 보낼 일정이 없어요/);
    await page.locator('#csPrev').click(); await page.locator('#csPrev').click();
    m = await modal(page); assert.equal(m.month, '2026년 11월'); assert.deepEqual(m.rows.map(r => r[0]), ['n', 'd'], 'November rows');
    await page.evaluate(() => closeModal(true));
  });

  await test('⑤ 📤 일정 공유 창에서 한 달 고르기로 · ‹ 뒤로 · 예전 내 캘린더 안내 그대로 (SHARE)', async () => {
    await page.evaluate(() => hjSchShareView({ kind: 'day', date: '2026-12-10' }));
    await page.locator('#shMonth').click();
    let m = await modal(page); assert.equal(m.month, '2026년 12월', 'opens on the share range month');
    await page.getByRole('button', { name: '‹ 뒤로' }).click();
    assert.equal(await page.locator('#modalRoot #shText').count(), 1, 'back to the share window');
    await page.evaluate(() => closeModal(true));
    const before = await page.evaluate(() => __v552.dl.length);
    await page.evaluate(() => saveICSToPhone([{ id: 'x', date: '2026-12-01', time: '', title: '내 일정' }], '내일정.ics'));
    const d = await page.evaluate(n => __v552.dl[n], before);
    assert.equal(d.saveMsg, '', 'own-calendar save keeps the old message (no override)');
  });

  await test('⑥ 폰 390 — 창 넘침 0 · 줄·단추 44px · 줄 누르면 체크 (PHONE)', async () => {
    const { page: ph } = await open({ width: 390, mobile: true });
    await ph.locator('#schCalSend').click();
    const r = await ph.evaluate(() => {
      const m = document.getElementById('calSend'), box = m.closest('.modal') || m;
      const small = [...m.querySelectorAll('.csRow, button')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 44).map(e => (e.id || e.className) + ':' + Math.round(e.getBoundingClientRect().height));
      return { over: document.documentElement.scrollWidth - innerWidth, box: box.scrollWidth - box.clientWidth, small, rows: m.querySelectorAll('.csRow').length };
    });
    assert(r.over <= 0 && r.box <= 1, 'no horizontal overflow ' + JSON.stringify(r));
    assert.deepEqual(r.small, [], 'tap targets 44px');
    assert.equal(r.rows, 4);
    await ph.locator('.csRow[data-id="v552_b"]').click();
    assert.equal((await modal(ph)).count, '3 / 4건 선택', 'tapping the row toggles its box');
    await shot(ph, 'v552-phone-modal');
  });

  await test('⑦ 소스·핀 3곳(v552 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('function hjSchCalSendView(opts){') && src.includes("if(t.id==='schCalSend')return hjSchCalSendView({ym:calMonth()});"), 'wired');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 552, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('calsend-v552: ' + passed + '/7 PASS; synthetic data; downloads/shares stubbed; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL calsend-v552', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });
