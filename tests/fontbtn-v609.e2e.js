/* v609 가⁺(글자 크기) 단추 — 눌러도 글씨가 거의 안 커지던 것.
   문제(기준선): 가⁺ 는 루트 글자 크기(--fs 112%·125%)만 바꿨는데 화면 글씨 대부분이 px 라 PC 1366 첫 화면에서 보이는 글씨 84개 중 5개만 커졌다.
   글씨를 실제로 키우는 것은 '♿ 화면 편하게 보기'의 글씨 크기(보통·크게·아주 크게, hj_a11y.big)인데 가⁺ 와 따로 놀았고,
   그 창의 안내는 폰에서 숨겨진 가⁺ 를 가리켰다. 합성 자료(이름은 지어낸 것), 시계 2026-11-17 10:00 고정, 바깥 쓰기 0.
   ① 가⁺ 를 누를 때마다 보통 → 크게 → 아주 크게 → 보통 · 그때마다 토스트에 이름 · 보이는 글씨의 1/4 넘게 커짐 · 한 바퀴 돌면 글씨 크기가 처음과 똑같음 ·
      --fs 는 건드리지 않음 (BTN)
   ② 설정 창과 한 값 — 가⁺ 로 바꾼 값이 창에 켜져 있고, 창에서 바꾼 값에서 가⁺ 가 이어 감 · 고대비 값은 그대로 · PC 창에는 가⁺ 안내가 있음 (SYNC)
   ③ 예전 값이 남은 기기(pref_font=2) — 부팅은 예전처럼 --fs 125% · 가⁺ 첫 누름에 --fs·pref_font 를 지우고 '크게' (LEGACY)
   ④ 폰 390 — 가⁺ 는 숨김 · 아래 메뉴 설정 → ♿ 화면 편하게 → 창 · 안내에 가⁺ 말 없음 · '아주 크게' 가 먹음 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V609_BASELINE=<commit> 은 ① 에서, HJ_V609_MUTATION=btn-old(예전 단추 줄)는 ①, drop-contrast(고대비 값을 잃음)는 ②,
   keep-fs(예전 --fs 를 안 지움)는 ③, tip-always(폰에도 가⁺ 안내)는 ④ 에서 실패해야 한다. */
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
const MUT = {
  'btn-old': ["$('#btnFont').onclick=hjFontBtnNext;",
    "$('#btnFont').onclick=()=>{__fontStep=(__fontStep+1)%FONT_SCALES.length;document.documentElement.style.setProperty('--fs',FONT_SCALES[__fontStep]);try{idbSet('pref_font',__fontStep);}catch(e){}};"],
  'drop-contrast': ['  const o=a11yGet();o.big=(Math.min(2,', '  const o={big:a11yGet().big,contrast:0};o.big=(Math.min(2,'],
  'keep-fs': ["  if(__fontStep){__fontStep=0;document.documentElement.style.removeProperty('--fs');", "  if(false){__fontStep=0;document.documentElement.style.removeProperty('--fs');"],
  'tip-always': ["(document.body.classList.contains('mobile-mode')?'':' <span data-a11y-fontbtn-tip>", "(false?'':' <span data-a11y-fontbtn-tip>"]
};
let html = process.env.HJ_V609_BASELINE ? execFileSync('git', ['show', process.env.HJ_V609_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V609_MUTATION) {
  const m = MUT[process.env.HJ_V609_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V609_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS fontbtn-v609 ' + name); }
async function booted(page, mobile) {
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
  }, BOOT);
  await page.evaluate(m => { __mobileMode = !!m; applyMobileMode(); }, mobile);   // 폰·PC 화면은 검사가 정한다(다른 검사와 같은 방식)
}
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_morning_shown', '2026-11-17');
    localStorage.setItem('hj_active_brief', '2026-11-17');
  });
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await booted(page, mobile);
  return { context, page };
}
// 합성 현장 여섯 + 일정 넷 — 첫 화면에 글씨가 넉넉히 보이게
const SEED = () => {
  closeModal(true);
  const P = (name, stage) => ({ name, stage, received: 300000, phases: [], cost: { material: 120000, labor: 200000, outsource: 0 }, customer: { name: '김가상', phone: '', addr: '시험시 가온로 1' }, archived: false });
  state.projects = [P('가온아파트 101동 1203호', 2), P('나래빌라 302호', 1), P('다솜상가 2층', 3), P('라온주택', 2), P('마루오피스텔 805호', 0), P('바다아파트 5동 201호', 2)];
  state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.asLog = []; state.workLogs = []; state.quotes = []; state._demo = false; state.dirHandle = null;
  const S = (id, date, time, title, project) => ({ id, date, time, title, project, workers: '', hours: 8, memo: '', report: null });
  state.schedule = [S('A', '2026-11-17', '09:00', '타일 시공', '가온아파트 101동 1203호'), S('B', '2026-11-17', '13:00', '실리콘 보수', '나래빌라 302호'), S('C', '2026-11-18', '09:00', '줄눈', '다솜상가 2층'), S('D', '2026-11-16', '09:00', '도배', '라온주택')];
  state.activeProject = null; state.tab = 'dashboard'; state.search = ''; render();
};
// 보이는 글씨(잎 요소)를 잡아 가⁺ 를 세 번 누르며 글씨 크기를 잰다 — 한 번의 동기 실행이라 그 사이 화면이 다시 그려지지 않는다
// (첫 화면은 날씨 등을 받은 뒤 스스로 다시 그려져, 나눠 재면 잡아 둔 요소가 떨어져 나간다)
const CYCLE = () => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const els = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && (e.innerText || '').trim() && vis(e) && !e.closest('#toast'));
  const sizes = () => els.map(e => parseFloat(getComputedStyle(e).fontSize)), btn = document.getElementById('btnFont'), out = [sizes()];
  for (let i = 0; i < 3; i++) { btn.click(); out.push(sizes()); }
  return out;
};
const STATE = () => ({
  big: document.body.classList.contains('a11y-big2') ? 2 : document.body.classList.contains('a11y-big1') ? 1 : 0,
  contrast: document.body.classList.contains('a11y-contrast'), saved: JSON.parse(localStorage.getItem('hj_a11y') || '{}'),
  fs: document.documentElement.style.getPropertyValue('--fs'), toast: document.getElementById('toast').textContent,
  toastOn: document.getElementById('toast').classList.contains('show')
});
const grown = (a, b) => a.filter((v, i) => b[i] > v + 0.01).length;
const sum = a => a.reduce((x, y) => x + y, 0);

(async () => {
  browser = await chromium.launch();
  try {
    await test('① BTN 가⁺ 가 글씨 크기를 차례로 바꾼다', async () => {
      const { context, page } = await open(1366, false);
      await page.evaluate(SEED);
      assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-mode')), false, 'PC 화면');
      await page.click('#btnFont');
      let st = await page.evaluate(STATE);
      assert.equal(st.big, 1, "한 번 누르면 '크게'(a11y-big1)");
      assert.equal(st.saved.big, 1, '설정 창과 같은 저장 값(hj_a11y.big)');
      assert.equal(st.toast, '글씨 크기: 크게'); assert.equal(st.toastOn, true, '토스트가 뜸');
      assert.equal(st.fs, '', '--fs 는 건드리지 않음');
      await page.click('#btnFont');
      st = await page.evaluate(STATE);
      assert.equal(st.big, 2, "두 번 누르면 '아주 크게'(a11y-big2)"); assert.equal(st.saved.big, 2); assert.equal(st.toast, '글씨 크기: 아주 크게');
      await page.click('#btnFont');
      st = await page.evaluate(STATE);
      assert.equal(st.big, 0, "세 번 누르면 '보통'"); assert.equal(st.saved.big, 0); assert.equal(st.toast, '글씨 크기: 보통'); assert.equal(st.fs, '');
      const [base, one, two, back] = await page.evaluate(CYCLE);
      assert.ok(base.length >= 40 && base.every(v => v > 0), '보이는 글씨가 넉넉함 ' + base.length);
      const g1 = grown(base, one);
      assert.ok(g1 >= base.length / 4, "'크게' — 보이는 글씨의 1/4 넘게 커짐 " + g1 + '/' + base.length);
      assert.equal(one.filter((v, i) => v < base[i] - 0.01).length, 0, '작아진 글씨 없음');
      assert.ok(grown(base, two) >= g1 && sum(two) > sum(one), "'아주 크게'가 '크게'보다 큼 " + [g1, grown(base, two), sum(one), sum(two)]);
      assert.deepEqual(back, base, '한 바퀴 돌면 글씨 크기가 처음과 똑같음');
      await context.close();
    });
    await test('② SYNC 설정 창과 한 값', async () => {
      const { context, page } = await open(1366, false);
      await page.evaluate(SEED);
      await page.evaluate(() => { a11ySave({ big: 0, contrast: 1 }); a11yApply(); });
      await page.click('#btnFont');
      let st = await page.evaluate(STATE);
      assert.equal(st.big, 1); assert.equal(st.saved.contrast, 1, '고대비 저장 값은 그대로'); assert.equal(st.contrast, true, '고대비 화면도 그대로');
      await page.evaluate(() => a11yManage());
      await page.waitForSelector('#modalRoot .a11yBig[data-n="1"]');
      const view = await page.evaluate(() => ({
        on: [...document.querySelectorAll('#modalRoot .a11yBig')].filter(b => b.classList.contains('clay')).map(b => b.dataset.n + ':' + b.textContent),
        tip: (document.querySelector('#modalRoot [data-a11y-fontbtn-tip]') || {}).textContent || ''
      }));
      assert.deepEqual(view.on, ['1:크게'], '가⁺ 로 바꾼 값이 창에 켜져 있음');
      assert.ok(/가⁺/.test(view.tip), 'PC 창에는 가⁺ 안내가 있음: ' + view.tip);
      await page.click('#modalRoot .a11yBig[data-n="2"]');
      await page.waitForFunction(() => document.body.classList.contains('a11y-big2'));
      await page.evaluate(() => closeModal(true));
      await page.click('#btnFont');
      st = await page.evaluate(STATE);
      assert.equal(st.big, 0, "창에서 고른 '아주 크게' 다음은 '보통'"); assert.equal(st.saved.big, 0); assert.equal(st.saved.contrast, 1, '고대비 값은 끝까지 그대로');
      await context.close();
    });
    await test('③ LEGACY 예전 --fs 값이 남은 기기', async () => {
      const { context, page } = await open(1366, false);
      await page.evaluate(async () => { await idbSet('pref_font', 2); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; state.dirty = false; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await booted(page, false);
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--fs') === '125%');   // 부팅은 예전 그대로
      await page.evaluate(SEED);
      const before = await page.evaluate(STATE);
      assert.equal(before.big, 0, '예전 값이 큰 글씨로 바뀌어 켜지지 않음(부팅은 그대로)');
      await page.click('#btnFont');
      const st = await page.evaluate(STATE);
      assert.equal(st.fs, '', '첫 누름에 예전 --fs 를 지움(두 겹으로 커지지 않게)');
      assert.equal(st.big, 1, "그리고 '크게'"); assert.equal(st.toast, '글씨 크기: 크게');
      await page.waitForFunction(async () => (await idbGet('pref_font')) === 0);
      await context.close();
    });
    await test('④ PHONE 폰에는 가⁺ 가 없고 설정에서 바꾼다', async () => {
      const { context, page } = await open(390, true);
      await page.evaluate(SEED);
      assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-mode')), true, '폰 화면');
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('btnFont')).display), 'none', '폰에서 가⁺ 는 숨김');
      await page.click('#mobileNav button:has-text("설정")');
      // 더보기 창의 묶음(접혀 있으면 펼친다) 안에 '♿ 화면 편하게' 가 있다
      const cat = page.locator('#moreSheet details.more-cat-block:has([data-moreaction="a11y"])');
      assert.equal(await cat.count(), 1, "더보기에 '화면 편하게' 묶음 하나");
      if (!(await cat.evaluate(d => d.open))) await cat.locator('summary').click();
      await page.click('#moreSheet [data-moreaction="a11y"]');
      await page.waitForSelector('#modalRoot .a11yBig[data-n="2"]');
      const view = await page.evaluate(() => ({ text: document.getElementById('modalRoot').textContent, tip: !!document.querySelector('#modalRoot [data-a11y-fontbtn-tip]') }));
      assert.ok(/글씨 크기/.test(view.text) && /화면 대비/.test(view.text), '♿ 화면 편하게 보기 창');
      assert.equal(view.tip, false, '폰 창에는 가⁺ 안내가 없음'); assert.ok(!/가⁺/.test(view.text), '폰 창 글에 가⁺ 말이 없음');
      await page.click('#modalRoot .a11yBig[data-n="2"]');
      await page.waitForFunction(() => document.body.classList.contains('a11y-big2'));
      const st = await page.evaluate(STATE);
      assert.equal(st.saved.big, 2, "폰에서 '아주 크게' 저장");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '폰 390 가로 넘침 없음');
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
      await context.close();
    });
  } finally { await browser.close(); }
  console.log('fontbtn-v609: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL fontbtn-v609', e && e.stack || e); process.exit(1); });
