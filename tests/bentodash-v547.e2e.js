/* v547 PC 첫 화면 두 칸(벤토) — 왼쪽 '✅ 오늘 현장 업무' | 오른쪽 '🏗 진행 현장'(대표 PDF 7번 '최종 UI 2'). 합성 자료만, 외부 쓰기 0.
   ① PC 1280: 두 칸이 나란히 · 진행 현장 = 보관 안 된 실측·시공 최대 3곳(오늘 일정 현장 먼저 → 최근 작업시간·사진 순) · 칩 눌림 표시 · 누를 곳 44px · 그리기만으로 자료 불변 (BENTO)
   ② 칩: 내리면 바로(시공 중 → 시공 전) · 올리면 기존 착공 전 체크 창(setStage 규칙 그대로, 단계는 그대로) (STAGE)
   ③ '오늘 한 일' [기록]: 빈칸은 안내만 · 적으면 오늘 그 현장 일정의 작업 보고에 덧붙음(workLogSave) · 오늘 일정 없는 현장은 Enter 로 '작업일지' 일정 새로 · 칸 비움 (MEMO)
   ④ 좁은 PC 1024 는 한 칸(차례대로) · 폰(모바일 모드 390)은 진행 현장 칸 없음 · 모드 바꾸면 바로 숨김 · 넘침 없음 · 어두운 화면 대비 4.5↑ (FIT)
   ⑤ 데모: [기록]이 영어 오류 없이 화면에서만 적힘 · 입금 기록도 데모에서 화면에서만(v543 보강, 'demo mode — not saved' 없음) (DEMO)
   ⑥ 소스·핀 3곳(v547 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V547_BASELINE=<commit> 은 ① 에서, HJ_V547_MUTATION=one-col(넓은 PC 두 칸 규칙 삭제)도 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V547_MUTATION || '';
let html = process.env.HJ_V547_BASELINE ? execFileSync('git', ['show', process.env.HJ_V547_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'one-col');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '@media(min-width:1180px){body:not(.mobile-mode) .hj-bento{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const GA = 'TEST_V547 가 빌라', NA = 'TEST_V547 나 상가', DA = 'TEST_V547 다 주택', RA = 'TEST_V547 라 오피스텔';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, demo }) {
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
  await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, demo, names }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();   // 부팅 타이머가 저장 도중 상태를 만들지 않게 미리
    window.__toasts = []; const o = window.toast; window.toast = m => { __toasts.push(String(m)); return o(m); };
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    if (demo) { await loadDemo(); state.tab = 'dashboard'; render(); return; }
    const t = localDate(), pj = (name, stage, extra) => Object.assign({ name, stage, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, extra || {});
    const [ga, na, da, ra] = names;
    state.projects.push(pj(ga, 1), pj(na, 2), pj(da, 2), pj(ra, 2), pj('TEST_V547 마 보관', 2, { archived: true }), pj('TEST_V547 바 완료', 3), pj('TEST_V547 사 상담', 0));
    state.schedule = Array.isArray(state.schedule) ? state.schedule : [];
    state.schedule.push({ id: 'v547_s1', date: t, time: '09:00', title: '타일 시공', project: ga, workers: '', hours: 0 }, { id: 'v547_s2', date: t, time: '10:00', title: '철거', project: 'TEST_V547 마 보관', workers: '', hours: 0 });
    state.workLogs = Array.isArray(state.workLogs) ? state.workLogs : [];
    state.workLogs.push({ id: 'v547_w1', project: na, date: hjAddDays(t, -1), in: '08:00', out: '17:00' }, { id: 'v547_w2', project: 'TEST_V547 바 완료', date: t, in: '08:00', out: '12:00' });
    state.files.push({ id: 'v547_ph', name: 'v547.jpg', ext: 'jpg', kind: 'photo', project: da, prefix: '현장사진/', size: 2048, when: new Date(Date.parse(hjAddDays(t, -3) + 'T12:00:00+09:00')), handle: null, _file: null, _virtual: true, thumb: null, text: '', ocr: 'na', lat: null, lng: null, _phase: '철거', _worklabel: '철거' });
    __photoCache.key = null; state.tab = 'dashboard'; render();
  }, { keys: BOOT, mobile: !!mobile, demo: !!demo, names: [GA, NA, DA, RA] });
  return { context, page };
}
const bento = page => page.evaluate(() => {
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const box = document.querySelector('#view .hj-bento'), prog = document.getElementById('hjBentoProgress');
  const shown = !!prog && getComputedStyle(prog).display !== 'none';
  const rows = prog ? [...prog.querySelectorAll('[data-bento-pj]')] : [];
  return {
    box: !!box, kids: box ? [...box.children].map(k => k.id) : [], todo: R(document.getElementById('dashboardTodo')), prog: shown ? R(prog) : null, inDom: !!prog,
    names: rows.map(r => r.dataset.bentoPj), on: rows.map(r => [...r.querySelectorAll('.hj-st-chip.on')].map(c => c.textContent + ':' + c.getAttribute('aria-pressed')).join(',')),
    taps: rows.flatMap(r => [...r.querySelectorAll('.hj-st-chip,.hj-bento-memo,[data-bento-save]')].map(e => Math.round(e.getBoundingClientRect().height))),
    over: document.documentElement.scrollWidth - innerWidth
  };
});
const data = page => page.evaluate(() => JSON.stringify({ p: state.projects, s: state.schedule, w: state.workLogs, pay: state.payLog || [] }));
async function test(name, fn) { await fn(); passed++; console.log('PASS bentodash-v547 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 1280 });

  await test('① PC 1280 — 두 칸 나란히 · 진행 현장 3곳(오늘 일정 → 최근 순) · 칩 눌림 · 44px · 그리기만으로 자료 불변 (BENTO)', async () => {
    const r = await bento(page);
    assert.equal(r.box, true, 'bento wrapper'); assert(r.prog, 'progress card shown on PC ' + JSON.stringify(r));
    assert.deepEqual(r.kids, ['dashboardTodo', 'hjBentoProgress'], 'todo left, progress right');
    assert(Math.abs(r.prog.top - r.todo.top) <= 2 && r.prog.left >= r.todo.right, 'side by side at 1280 ' + JSON.stringify([r.todo, r.prog]));
    assert(r.todo.w > r.prog.w, 'todo column is the wider one');
    assert.deepEqual(r.names, [GA, NA, DA], 'stage 1–2, not archived, max 3, today first then recent');
    assert.deepEqual(r.on, ['시공 전:true', '시공 중:true', '시공 중:true']);
    assert(r.taps.length === 15 && r.taps.every(h => h >= 44), 'tap targets ' + JSON.stringify(r.taps));
    assert(r.over <= 0, 'no horizontal overflow');
    const same = await page.evaluate(() => { const a = JSON.stringify({ p: state.projects, s: state.schedule, w: state.workLogs }), d = state.dirty; render(); render(); return a === JSON.stringify({ p: state.projects, s: state.schedule, w: state.workLogs }) && d === state.dirty; });
    assert.equal(same, true, 'rendering does not change data');
    await shot(page, 'v547-pc-bento');
  });

  await test('② 칩 — 내리면 바로 · 올리면 착공 전 체크 창(단계 그대로) (STAGE)', async () => {
    await page.locator(`#hjBentoProgress [data-bento-pj="${NA}"] [data-stage="1"]`).click();
    await page.waitForFunction(n => state.projects.find(p => p.name === n).stage === 1, NA);
    let r = await bento(page);
    assert.equal(r.on[r.names.indexOf(NA)], '시공 전:true', 'chip follows the new stage');
    await page.locator(`#hjBentoProgress [data-bento-pj="${GA}"] [data-stage="2"]`).click();
    await page.locator('#modalRoot .clChk').first().waitFor();
    const m = await page.evaluate(n => ({ title: document.getElementById('modalRoot').innerText, stage: state.projects.find(p => p.name === n).stage }), GA);
    assert.match(m.title, /착공 전 체크/); assert(m.title.includes(GA)); assert.equal(m.stage, 1, 'stage waits for the checklist');
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 오늘 한 일 — 빈칸 안내 · 오늘 일정 작업 보고에 덧붙음 · Enter 로 일지 일정 새로 · 칸 비움 (MEMO)', async () => {
    const before = await data(page);
    await page.locator(`#hjBentoProgress [data-bento-save="${GA}"]`).click();
    assert.equal(await page.evaluate(() => __toasts.at(-1)), '오늘 한 일을 적어 주세요'); assert.equal(await data(page), before, 'empty memo changes nothing');
    await page.locator(`#hjBentoProgress [data-bento-memo="${GA}"]`).fill('  욕실   방수 1차 ');
    await page.locator(`#hjBentoProgress [data-bento-save="${GA}"]`).click();
    await page.waitForFunction(() => { const s = state.schedule.find(x => x.id === 'v547_s1'); return s && s.report && s.report.done; });
    let r = await page.evaluate(n => ({ s: state.schedule.find(x => x.id === 'v547_s1').report, n: state.schedule.filter(x => x.project === n).length, v: document.querySelector(`#hjBentoProgress [data-bento-memo="${n}"]`).value, toast: __toasts.at(-1) }), GA);
    assert.equal(r.s.done, '욕실 방수 1차', 'appended to today\'s schedule report (spaces folded)'); assert.equal(r.s.progress, '진행'); assert.equal(r.n, 1, 'no extra schedule');
    assert.equal(r.v, '', 'input cleared'); assert.match(r.toast, /오늘 작업일지에 적었어요/);
    const memo = page.locator(`#hjBentoProgress [data-bento-memo="${DA}"]`);
    await memo.fill('현관 타일 줄눈'); await memo.press('Enter');
    await page.waitForFunction(n => state.schedule.some(x => x.project === n), DA);
    r = await page.evaluate(n => state.schedule.filter(x => x.project === n).map(x => [x.date === localDate(), x.title, x.report.done]), DA);
    assert.deepEqual(r, [[true, '작업일지', '현관 타일 줄눈']], 'log-only schedule for a site with no plan today');
    assert.equal(await page.evaluate(() => state._demo), false);
  });

  await test('④ 1024 한 칸 · 폰 진행 현장 없음 · 모드 바꾸면 바로 숨김 · 넘침 없음 · 어두운 화면 대비 (FIT)', async () => {
    const { page: p1024 } = await open({ width: 1024 });
    let r = await bento(p1024);
    assert(r.prog && r.prog.top >= r.todo.bottom, 'one column on a narrow PC ' + JSON.stringify([r.todo, r.prog])); assert(r.over <= 0, '1024 no overflow');
    await shot(p1024, 'v547-pc-1024');
    const { page: pm } = await open({ width: 390, mobile: true });
    r = await bento(pm);
    assert.equal(r.inDom, false, 'phone does not draw the progress card'); assert.deepEqual(r.kids, ['dashboardTodo']); assert(r.over <= 0, 'phone no overflow');
    await shot(pm, 'v547-phone');
    r = await page.evaluate(() => { __mobileMode = true; applyMobileMode(); const shown = getComputedStyle(document.getElementById('hjBentoProgress')).display !== 'none'; render(); const gone = !document.getElementById('hjBentoProgress'); __mobileMode = false; applyMobileMode(); render(); return { shown, gone, back: !!document.getElementById('hjBentoProgress') }; });
    assert.deepEqual(r, { shown: false, gone: true, back: true }, 'mode toggle hides at once, PC brings it back');
    await page.evaluate(() => { document.body.classList.add('dark'); render(); });
    await page.waitForTimeout(700);   // 단추 글자색 전환(transition)이 끝난 뒤 잰다
    const c = await page.evaluate(() => {
      const card = document.getElementById('hjBentoProgress'), bg = getComputedStyle(card).backgroundColor, cs = e => getComputedStyle(e);
      const on = card.querySelector('.hj-st-chip.on'), off = card.querySelector('.hj-st-chip:not(.on)'), name = card.querySelector('.hj-bento-open'), memo = card.querySelector('.hj-bento-memo');
      return { bg, name: cs(name).color, on: [cs(on).color, cs(on).backgroundColor], off: [cs(off).color, cs(off).backgroundColor], memo: [cs(memo).color, cs(memo).backgroundColor] };
    });
    assert(ratio(c.name, c.bg) >= 4.5 && ratio(...c.on) >= 4.5 && ratio(...c.off) >= 4.5 && ratio(...c.memo) >= 4.5, 'dark contrast ' + JSON.stringify(c));
    await shot(page, 'v547-pc-dark');
    await page.evaluate(() => { document.body.classList.remove('dark'); render(); });
  });

  await test('⑤ 데모 — [기록]·입금 기록이 영어 오류 없이 화면에서만 (DEMO)', async () => {
    const { page: pd } = await open({ width: 1280, demo: true });
    const name = (await bento(pd)).names[0];
    assert(name, 'demo has sites in progress');
    await pd.locator(`#hjBentoProgress [data-bento-memo="${name}"]`).fill('데모 메모 한 줄');
    await pd.locator(`#hjBentoProgress [data-bento-save="${name}"]`).click();
    let r = await pd.evaluate(n => ({ demo: state._demo, toast: __toasts.at(-1), done: state.schedule.filter(x => x.project === n && x.date === localDate()).map(x => x.report && x.report.done || '').join('|') }), name);
    assert.equal(r.demo, true); assert.match(r.toast, /데모/); assert.match(r.done, /데모 메모 한 줄/);
    r = await pd.evaluate(async n => {
      const before = (state.payLog || []).length; recvQuickView(n);
      document.getElementById('rqAmt').value = '100,000';
      [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.includes('입금 저장')).click();
      for (let i = 0; i < 50 && (state.payLog || []).length === before; i++) await new Promise(x => setTimeout(x, 100));
      try { closeModal(true); } catch (e) {}
      return { added: (state.payLog || []).length - before, demo: state._demo, toasts: __toasts.join('\n') };
    }, name);
    assert.equal(r.added, 1, 'demo receive recorded in memory'); assert.equal(r.demo, true);
    assert.doesNotMatch(r.toasts, /demo mode|not saved/, 'no English error toast');
  });

  await test('⑥ 소스·핀 3곳(v547 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes("if(state.tab==='dashboard')hjKpiFit(v);"), 'render fits KPI numbers on one line');
    assert(src.includes("if(d.bentoSave!==undefined){e.stopPropagation();return hjBentoMemoSave(d.bentoSave);}"), 'click delegation');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 547, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('bentodash-v547: ' + passed + '/6 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL bentodash-v547', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });
