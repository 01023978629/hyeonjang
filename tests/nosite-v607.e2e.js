/* v607 이미 들어온 '현장 없는 일정'을 한 창에서 현장에 잇기·새로 만들기 (AGENTS v601·v599~v606 '남은 것' ①)
   🔄 맞추기는 '현장 없이'로 들어온 일정을 다시 보여 주지 않고, 현장 없는 일정은 📤 내일 팀 지시(hjWoDayOk)에서 말없이 빠졌다 —
   일정마다 ✏️ 를 열어 현장 칸을 고르고, 앱에 없는 현장이면 현장을 먼저 만든 뒤 돌아와야 했다. 합성 자료, 시계 고정(11/16 월), 폰 390, 바깥 쓰기 0.
   ① 대상·차례 — 현장 칸이 빈 일정만(💰 수금·세금 자동·개인 일정·운영 루틴·60일 넘은 지난 일정 제외) · 오늘부터 앞으로(가까운 날 먼저) 뒤에 지난 일정(최근 먼저) ·
      제안 이름(제목 → 장소) · 진행 현장과 같은 이름 · 그날(이어지는 날 포함) 현장 없는 일정 · 읽기만 (ROWS)
   ② 창 — 일정표 단추 건수 · 줄마다 '＋ 새 현장: 이름'·'이름 입력' · 미리 고르지 않음(같은 이름 진행 현장만 골라 둠 · 체크는 안 함) · 보관한 같은 이름 안내 ·
      고르면 체크 + 이름 칸 · 비슷한 이름은 막힘 안내 · 16px·44px·넘침 없음 · 창을 열고 골라도 자료 불변 (VIEW)
   ③ 반영 — 같은 새 이름 두 줄 = 현장 하나 · 있는 현장 잇기 · 안 고른 줄 그대로 · 안전판 1회 · 새 현장 꼴(단계 0·유형 없음·고객 빈칸·주소 빈칸) ·
      일정의 날짜·시각·제목·메모 그대로 · 이은 일정이 하루치 팀 지시에 들어감 · 단추 건수 줄어듦 (APPLY)
   ④ 가드 — 막힌 이름(비슷한 현장)이 하나라도 있으면 안전판 전에 통째로 멈춤 · 안전판 실패 · 오래된 창 · 창을 연 뒤 다른 곳에서 현장이 붙은 일정은 덮지 않음(새 현장도 안 만듦) ·
      앞 줄이 만든 이름과 비슷해진 줄은 그대로 · 직원 모드 (GUARD)
   ⑤ 입구 — 📤 하루치 팀 지시가 빠지는 건수를 알리고 [🔗 현장 잇기] → 이은 뒤 그 창으로 돌아와 다시 짬 · 일정이 하나도 없는 날도 안내 · 🧰 명령 6번 ·
      핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0 (ENTRY)
   HJ_V607_BASELINE=<commit> 은 ① 에서, HJ_V607_MUTATION=include-money·no-continuing 은 ①, preselect-new 는 ②, no-block·no-stale-first·no-recheck 는 ④,
   no-wo-note 는 ⑤ 에서 실패해야 한다. */
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
  'include-money': ['&&hjPrepOtherOk(s)&&!s.sourceUid&&!s.routine);}', '&&!s.sourceUid&&!s.routine);}'],
  'no-continuing': ['hjSchNoSiteOk(s)).concat(hjSchContinuing(day,hjSchNoSiteOk).map(x=>x.s));}', 'hjSchNoSiteOk(s));}'],
  'preselect-new': ["opt('','현장 고르기',!r.exact)+(c&&c.ok?hjNewSiteOptionHtml(r.suggest):'')", "opt('','현장 고르기',false)+(c&&c.ok?hjNewSiteOptionHtml(r.suggest,true):'')"],
  'no-block': ["  if(blocked){hjPhotoNewFocus(blocked);toast('새 현장 이름을 확인해 주세요 — 비슷한 현장이 있거나 이름이 짧아 아무 일정도 잇지 않았어요');return 0;}", ''],
  'no-stale-first': ["  if(stale()){toast('오래된 창이에요 — 새로고침한 뒤 다시 눌러 주세요');return 0;}\n  if(!picks.length){toast(noTarget?'체크한 일정의", "  if(!picks.length){toast(noTarget?'체크한 일정의"],
  'no-recheck': ['    if(!s||!hjSchNoSiteOk(s)){changed++;return;}', '    if(!s){changed++;return;}'],
  'no-wo-note': ["메모의 돈 이야기 줄은 뺐습니다.</div>'+\n    hjWoNoSiteHtml(d)+", "메모의 돈 이야기 줄은 뺐습니다.</div>'+"]
};
let html = process.env.HJ_V607_BASELINE ? execFileSync('git', ['show', process.env.HJ_V607_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V607_MUTATION) {
  const m = MUT[process.env.HJ_V607_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V607_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS nosite-v607 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const t0 = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return t0(m, ...a); };
  }, BOOT);
  return { context, page };
}
// 합성 자료 — 매 칸 처음부터. 오늘 = 11/16(월)
async function seed(page) {
  await page.evaluate(() => {
    try { closeModal(); } catch (e) {}
    __tabStale = false; window.__toasts = [];
    state.projects = [
      { name: '가온아파트', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '시험시 가온로 1' } },
      { name: '나래빌라', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } },
      { name: '달빛타워', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } },
      { name: '모란아파트', stage: 3, archived: true, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }
    ];
    state.files = []; state.quotes = [];
    state.schedule = [
      { id: 'n1', date: '2026-11-17', time: '09:00', title: '우수관 교체', project: '', hours: 4, memo: '장소: 시험시 새벽로 12 별빛아파트 101동 1203호\n구글 캘린더에서 가져옴 (@ 제미나이 입력)', report: null },
      { id: 'n2', date: '2026-11-17', time: '14:00', title: '별빛아파트 누수 탐지', project: '', hours: 2, memo: '', report: null },
      { id: 'n3', date: '2026-11-20', time: '', title: '타일 보수', project: '', hours: 8, memo: '장소: 시험시 가온로 1 가온아파트', report: null },
      { id: 'n4', date: '2026-11-18', time: '', title: '점검', project: '', hours: 1, memo: '', report: null },
      { id: 'n5', date: '2026-11-10', time: '', title: '모란아파트 실리콘', project: '', hours: 2, memo: '', report: null },
      { id: 'n6', date: '2026-09-01', time: '', title: '오래된 일', project: '', hours: 2, memo: '', report: null },
      { id: 'n7', date: '2026-11-14', time: '', title: '나래빌라 방수', project: '', hours: 8, memo: '2026-11-14~2026-11-17 (3일)', report: null },
      { id: 'm1', date: '2026-11-17', time: '', title: '💰 잔금 받기', project: '', hours: 0, memo: '', report: null },
      { id: 't1', date: '2026-11-25', time: '', title: '부가세 예정 신고', project: '', hours: 0, memo: '', _taxAuto: true, report: null },
      { id: 'p1', date: '2026-11-19', time: '', title: '타일기능사 시험', project: '', hours: 8, memo: '', sourceUid: 'qnet-test@manmool', report: null },
      { id: 'r1', date: '2026-11-17', time: '', title: '📒 장부 정리', project: '', hours: 0, memo: '', routine: true, report: null },
      { id: 'w1', date: '2026-11-17', time: '08:00', title: '도배', project: '가온아파트', hours: 8, memo: '', report: null }
    ];
    try { localStorage.removeItem('hj_role'); } catch (e) {}
  });
}
const snapSig = page => page.evaluate(() => { const d = JSON.parse(JSON.stringify(serializeData())); delete d.savedAt; return JSON.stringify(d); });
const snapCount = page => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).filter(x => x.label === '현장 없는 일정 잇기 전').length);
const sch = (page, id) => page.evaluate(i => { const s = state.schedule.find(x => x.id === i); return s ? { project: s.project, date: s.date, time: s.time, title: s.title, memo: s.memo } : null; }, id);
const rowIndex = (page, id) => page.evaluate(i => [...document.querySelectorAll('#hjSchNoSite [data-nosite-row]')].findIndex(x => x.dataset.nositeRow === i), id);
async function pick(page, id, value) { const i = await rowIndex(page, id); assert.ok(i >= 0, '줄 ' + id); await page.selectOption('#hjSchNoSite .snsSel[data-i="' + i + '"]', value); return i; }
async function applyBtn(page) { await page.click('#modalRoot .mfoot button:has-text("체크한 일정 잇기")'); }
async function openView(page) { await page.evaluate(() => { state.tab = 'schedule'; render(); }); await page.click('#schNoSite'); await page.waitForSelector('#hjSchNoSite'); }

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();

    await test('① 대상·차례·제안 — 현장 칸이 빈 일정만 · 읽기만 (ROWS)', async () => {
      await seed(page);
      const before = await snapSig(page);
      const r = await page.evaluate(() => {
        const rows = hjSchNoSiteRows();
        return { count: hjSchNoSiteCount(), ids: rows.map(x => x.id), sug: rows.map(x => [x.id, x.suggest, x.exact, x.past]),
          on17: hjSchNoSiteOn('2026-11-17').map(s => s.id).sort(), on18: hjSchNoSiteOn('2026-11-18').map(s => s.id) };
      });
      assert.equal(r.count, 6, '현장 없는 일정 6건(💰·세금·개인·루틴·60일 넘은 것·현장 있는 일정 제외) ' + r.count);
      assert.deepEqual(r.ids, ['n1', 'n2', 'n4', 'n3', 'n7', 'n5'], '오늘부터 앞으로 가까운 날 먼저, 뒤에 지난 일정 최근 먼저 ' + JSON.stringify(r.ids));
      assert.deepEqual(r.sug, [['n1', '별빛아파트', '', false], ['n2', '별빛아파트', '', false], ['n4', '', '', false], ['n3', '가온아파트', '가온아파트', false], ['n7', '나래빌라', '나래빌라', true], ['n5', '모란아파트', '', true]],
        '제안(제목 → 장소) · 진행 현장과 같은 이름만 exact(보관 현장은 아님) ' + JSON.stringify(r.sug));
      assert.deepEqual(r.on17, ['n1', 'n2', 'n7'], '11/17 현장 없는 일정 = 그날 시작 둘 + 여러 날 공정의 이어지는 날(💰·루틴 제외) ' + JSON.stringify(r.on17));
      assert.deepEqual(r.on18, ['n4'], '11/18 ' + JSON.stringify(r.on18));
      assert.equal(await snapSig(page), before, '읽기만 — 자료 불변');
    });

    await test('② 창 — 건수 · 새 현장 선택지 · 미리 안 고름 · 안내 · 16px·44px·넘침 없음 · 자료 불변 (VIEW)', async () => {
      await seed(page);
      const before = await snapSig(page);
      await page.evaluate(() => { state.tab = 'schedule'; render(); });
      const btn = await page.evaluate(() => { const b = document.getElementById('schNoSite'); return b ? { text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), n: b.dataset.nositeCount } : null; });
      assert.deepEqual(btn, { text: '🔗 현장 없는 일정 6건', h: btn && btn.h >= 44 ? btn.h : -1, n: '6' }, '일정표 단추 ' + JSON.stringify(btn));
      await page.click('#schNoSite'); await page.waitForSelector('#hjSchNoSite');
      const v = await page.evaluate(() => {
        const root = document.getElementById('hjSchNoSite'), row = id => root.querySelector('[data-nosite-row="' + id + '"]');
        const info = id => { const r = row(id), s = r.querySelector('.snsSel'); return { value: s.value, opts: [...s.options].slice(0, 3).map(o => [o.value, o.textContent]), chk: r.querySelector('.snsChk').checked,
          sim: (r.querySelector('[data-nosite-sim]') || {}).textContent || '', exact: !!r.querySelector('[data-nosite-exact]'), past: !!r.querySelector('[data-nosite-past]'), box: r.querySelector('.hjPnBox').hidden }; };
        const m = root.closest('.modal') || document.querySelector('#modalRoot .modal');
        const fs16 = [...root.querySelectorAll('.snsSel,.hjPnName')].every(x => parseFloat(getComputedStyle(x).fontSize) >= 16);
        const tall = [...root.querySelectorAll('.snsSel'), ...document.querySelectorAll('#modalRoot .mfoot button')].every(x => x.getBoundingClientRect().height >= 43.5);
        return { rows: root.querySelectorAll('[data-nosite-row]').length, n: root.querySelector('[data-nosite-n]').textContent, n1: info('n1'), n3: info('n3'), n4: info('n4'), n5: info('n5'), n7: info('n7'),
          fs16, tall, over: document.documentElement.scrollWidth > innerWidth + 1 || (m ? m.scrollWidth > m.clientWidth + 1 : false), checked: root.querySelectorAll('.snsChk:checked').length };
      });
      assert.deepEqual([v.rows, v.n], [6, '6건'], '줄 6 ' + JSON.stringify([v.rows, v.n]));
      assert.deepEqual(v.n1.opts, [['', '현장 고르기'], ['__new__:별빛아파트', '＋ 새 현장: 별빛아파트'], ['__new__:', '＋ 새 현장 (이름 입력)']], '새 현장 선택지가 맨 위 ' + JSON.stringify(v.n1.opts));
      assert.deepEqual([v.n1.value, v.n1.chk, v.n1.box], ['', false, true], '미리 고르지 않음·체크 안 함·이름 칸 숨김 ' + JSON.stringify(v.n1));
      assert.deepEqual([v.n3.value, v.n3.chk, v.n3.exact], ['가온아파트', false, true], '같은 이름의 진행 현장만 골라 둠(체크는 안 함) ' + JSON.stringify(v.n3));
      assert.deepEqual([v.n7.value, v.n7.chk, v.n7.past], ['나래빌라', false, true], '지난 일정 표시 ' + JSON.stringify(v.n7));
      assert.deepEqual(v.n4.opts.slice(0, 2), [['', '현장 고르기'], ['__new__:', '＋ 새 현장 (이름 입력)']], '제안 없으면 이름 입력만 ' + JSON.stringify(v.n4.opts));
      assert.ok(!v.n5.opts.some(o => o[0] === '__new__:모란아파트') && /모란아파트\(보관\)/.test(v.n5.sim) && /보관을 푼 뒤/.test(v.n5.sim), '보관한 같은 이름 — 선택지 대신 안내 ' + JSON.stringify(v.n5));
      assert.deepEqual([v.fs16, v.tall, v.over, v.checked], [true, true, false, 0], '16px·44px·넘침 없음·체크 0 ' + JSON.stringify([v.fs16, v.tall, v.over, v.checked]));
      // 고르면 체크 + 이름 칸, 적은 이름으로 무엇이 되는지
      await pick(page, 'n1', '__new__:별빛아파트');
      const p1 = await page.evaluate(() => { const r = document.querySelector('#hjSchNoSite [data-nosite-row="n1"]'); return { chk: r.querySelector('.snsChk').checked, box: r.querySelector('.hjPnBox').hidden, name: r.querySelector('.hjPnName').value, st: r.querySelector('.hjPnMsg').dataset.state, msg: r.querySelector('.hjPnMsg').textContent }; });
      assert.deepEqual([p1.chk, p1.box, p1.name, p1.st], [true, false, '별빛아파트', 'new'], '고르면 체크·이름 칸 ' + JSON.stringify(p1));
      assert.match(p1.msg, /새 현장을 만들어 이 일정을 잇습니다/, p1.msg);
      const i4 = await pick(page, 'n4', '__new__:');
      const focused = await page.evaluate(i => document.activeElement === document.querySelector('#hjSchNoSite [data-nosite-row="n4"] .hjPnName') && +document.querySelector('#hjSchNoSite .snsSel[data-i="' + i + '"]').dataset.i === i, i4);
      assert.ok(focused, '이름 입력 — 빈 이름 칸으로 초점');
      await page.keyboard.type('달빛 타워');
      const p4 = await page.evaluate(() => { const r = document.querySelector('#hjSchNoSite [data-nosite-row="n4"]'); return { st: r.querySelector('.hjPnMsg').dataset.state, msg: r.querySelector('.hjPnMsg').textContent, inv: r.querySelector('.hjPnName').getAttribute('aria-invalid') }; });
      assert.deepEqual([p4.st, p4.inv], ['similar', 'true'], '비슷한 현장 막힘 ' + JSON.stringify(p4));
      assert.match(p4.msg, /달빛타워/, p4.msg);
      await pick(page, 'n4', '');
      assert.equal(await page.evaluate(() => document.querySelector('#hjSchNoSite [data-nosite-row="n4"] .snsChk').checked), false, '현장 고르기로 돌리면 체크 풀림');
      assert.equal(await snapSig(page), before, '창을 열고 골라도 자료 불변');
      await page.evaluate(() => closeModal());
    });

    await test('③ 반영 — 같은 새 이름 = 현장 하나 · 있는 현장 잇기 · 안전판 1회 · 새 현장 꼴 · 팀 지시에 들어감 (APPLY)', async () => {
      await seed(page);
      const snaps0 = await snapCount(page), keep = {};
      for (const id of ['n1', 'n2', 'n3', 'n4', 'n5', 'n7']) keep[id] = await sch(page, id);
      await openView(page);
      await pick(page, 'n1', '__new__:별빛아파트');
      await pick(page, 'n2', '__new__:별빛아파트');
      await pick(page, 'n4', '나래빌라');
      await page.check('#hjSchNoSite [data-nosite-row="n3"] .snsChk');
      await page.check('#hjSchNoSite [data-nosite-row="n7"] .snsChk');
      await applyBtn(page);
      await page.waitForSelector('#hjSchNoSite', { state: 'detached' });
      const r = await page.evaluate(() => {
        const p = state.projects.filter(x => x.name === '별빛아파트');
        return { proj: Object.fromEntries(['n1', 'n2', 'n3', 'n4', 'n5', 'n7'].map(id => [id, state.schedule.find(s => s.id === id).project])), made: p.length,
          shape: p[0] ? { stage: p[0].stage, kind: p[0].kind === undefined, customer: p[0].customer, phases: p[0].phases } : null,
          wo17: hjWoDaySchedules('2026-11-17').map(s => s.id).sort(), toast: window.__toasts.slice(-1)[0] || '' };
      });
      assert.deepEqual(r.proj, { n1: '별빛아파트', n2: '별빛아파트', n3: '가온아파트', n4: '나래빌라', n5: '', n7: '나래빌라' }, '이은 현장 ' + JSON.stringify(r.proj));
      assert.equal(r.made, 1, '같은 새 이름 두 줄 = 현장 하나');
      assert.deepEqual(r.shape, { stage: 0, kind: true, customer: { name: '', phone: '', addr: '' }, phases: [] }, '새 현장 꼴(단계 0·유형 없음·고객·주소 빈칸) ' + JSON.stringify(r.shape));
      for (const id of ['n1', 'n2', 'n3', 'n4', 'n5', 'n7']) { const s = await sch(page, id); assert.deepEqual([s.date, s.time, s.title, s.memo], [keep[id].date, keep[id].time, keep[id].title, keep[id].memo], '일정의 다른 칸 그대로 ' + id); }
      assert.deepEqual(r.wo17, ['n1', 'n2', 'n7', 'w1'], '이은 일정이 하루치 팀 지시에 들어감 ' + JSON.stringify(r.wo17));
      assert.match(r.toast, /일정 5건을 현장에 이었어요/, r.toast);
      assert.match(r.toast, /새 현장 1곳\(별빛아파트\)/, r.toast);
      assert.equal(await snapCount(page) - snaps0, 1, '안전판 1회');
      const btn = await page.evaluate(() => { state.tab = 'schedule'; render(); const b = document.getElementById('schNoSite'); return b ? b.textContent.trim() : ''; });
      assert.equal(btn, '🔗 현장 없는 일정 1건', '단추 건수 줄어듦 ' + btn);
    });

    await test('④ 가드 — 막힌 이름 · 안전판 실패 · 오래된 창 · 그 사이 바뀐 일정 · 비슷해진 이름 · 직원 모드 (GUARD)', async () => {
      // 막힌 이름이 하나라도 있으면 안전판 전에 통째로 멈춘다
      await seed(page);
      let before = await snapSig(page);
      await page.evaluate(() => { window.__snapCalls = 0; window.__realSnap = window.__realSnap || hjSnapshot; hjSnapshot = async (...a) => { window.__snapCalls++; return window.__realSnap(...a); }; });
      await openView(page);
      await pick(page, 'n1', '__new__:별빛아파트');
      await pick(page, 'n4', '__new__:'); await page.keyboard.type('달빛 타워');
      await applyBtn(page);
      const b = await page.evaluate(() => ({ calls: window.__snapCalls, open: !!document.getElementById('hjSchNoSite'), focus: document.activeElement === document.querySelector('#hjSchNoSite [data-nosite-row="n4"] .hjPnName'), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([b.calls, b.open, b.focus], [0, true, true], '안전판 전에 멈춤·창 그대로·그 이름 칸으로 ' + JSON.stringify(b));
      assert.match(b.toast, /아무 일정도 잇지 않았어요/, b.toast);
      assert.equal(await snapSig(page), before, '막히면 아무것도 안 바뀜');
      // 안전판 실패
      await page.evaluate(() => { hjSnapshot = async () => { window.__snapCalls++; return false; }; });
      await pick(page, 'n4', '가온아파트');
      await applyBtn(page);
      const f = await page.evaluate(() => ({ open: !!document.getElementById('hjSchNoSite'), dis: [...document.querySelectorAll('#modalRoot .mfoot button')].some(x => x.disabled), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([f.open, f.dis], [true, false], '안전판 실패 — 창 그대로·단추 다시 눌림 ' + JSON.stringify(f));
      assert.match(f.toast, /안전판을 만들지 못해/, f.toast);
      assert.equal(await snapSig(page), before, '안전판 실패 — 자료 불변');
      // 오래된 창 — 안전판도 안 만든다
      await page.evaluate(() => { window.__snapCalls = 0; hjSnapshot = async (...a) => { window.__snapCalls++; return window.__realSnap(...a); }; __tabStale = true; });
      await applyBtn(page);
      const s = await page.evaluate(() => ({ calls: window.__snapCalls, toast: window.__toasts.slice(-1)[0] || '' }));
      await page.evaluate(() => { __tabStale = false; });
      assert.equal(s.calls, 0, '오래된 창 — 안전판 전에 멈춤');
      assert.match(s.toast, /오래된 창/, s.toast);
      assert.equal(await snapSig(page), before, '오래된 창 — 자료 불변');
      await page.evaluate(() => closeModal());
      // 창을 연 뒤 다른 곳에서 현장이 붙은 일정은 덮지 않는다(새 현장도 만들지 않는다)
      await seed(page);
      await openView(page);
      await pick(page, 'n1', '__new__:별빛아파트');
      await pick(page, 'n4', '가온아파트');
      await page.evaluate(() => { state.schedule.find(x => x.id === 'n1').project = '나래빌라'; });
      await applyBtn(page);
      await page.waitForSelector('#hjSchNoSite', { state: 'detached' });
      const c = await page.evaluate(() => ({ n1: state.schedule.find(x => x.id === 'n1').project, n4: state.schedule.find(x => x.id === 'n4').project, made: state.projects.some(p => p.name === '별빛아파트'), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([c.n1, c.n4, c.made], ['나래빌라', '가온아파트', false], '그 사이 바뀐 일정은 그대로·새 현장도 안 만듦 ' + JSON.stringify(c));
      assert.match(c.toast, /그 사이 바뀐 일정 1건은 그대로/, c.toast);
      // 앞 줄이 만든 이름과 띄어쓰기만 다른 이름 — 그 줄은 그대로
      await seed(page);
      await openView(page);
      await pick(page, 'n1', '__new__:별빛아파트');
      await pick(page, 'n2', '__new__:');
      await page.fill('#hjSchNoSite [data-nosite-row="n2"] .hjPnName', '별빛 아파트');
      await page.dispatchEvent('#hjSchNoSite [data-nosite-row="n2"] .hjPnName', 'input');
      await applyBtn(page);
      await page.waitForSelector('#hjSchNoSite', { state: 'detached' });
      const l = await page.evaluate(() => ({ n1: state.schedule.find(x => x.id === 'n1').project, n2: state.schedule.find(x => x.id === 'n2').project, names: state.projects.map(p => p.name).filter(n => /별빛/.test(n)), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([l.n1, l.n2, l.names], ['별빛아파트', '', ['별빛아파트']], '비슷해진 줄은 그대로 ' + JSON.stringify(l));
      assert.match(l.toast, /새 현장을 못 만든 1건은 그대로\(비슷한 현장: 별빛아파트\)/, l.toast);
      // 직원 모드 — 창도 단추도 없다
      await seed(page);
      before = await snapSig(page);
      const st = await page.evaluate(() => { localStorage.setItem('hj_role', 'staff'); const r = hjSchNoSiteView(); const btn = hjSchNoSiteBtnHtml(); localStorage.removeItem('hj_role'); return { r, open: !!document.getElementById('hjSchNoSite'), btn }; });
      assert.deepEqual(st, { r: false, open: false, btn: '' }, '직원 모드 ' + JSON.stringify(st));
      assert.equal(await snapSig(page), before, '직원 모드 — 자료 불변');
      await page.evaluate(() => { hjSnapshot = window.__realSnap; });
    });

    await test('⑤ 입구 — 하루치 팀 지시 안내·돌아오기 · 일정 없는 날 · 명령 6번 · 핀 · 오류 0 · 바깥 쓰기 0 (ENTRY)', async () => {
      await seed(page);
      await page.evaluate(() => { hjWoTomorrowView('2026-11-17'); });
      await page.waitForSelector('#hjWoDay');
      const w = await page.evaluate(() => { const n = document.querySelector('#hjWoDay [data-wo-day-nosite]'); return n ? { n: n.dataset.woDayNosite, text: n.textContent, h: Math.round(n.querySelector('button').getBoundingClientRect().height), orders: document.querySelectorAll('#hjWoDay [data-wo-day-order]').length } : null; });
      assert.ok(w && w.n === '3' && /현장 없는 일정 3건은 지시에서 빠져요/.test(w.text) && w.h >= 44 && w.orders === 1, '하루치 지시 — 빠지는 건수 ' + JSON.stringify(w));
      await page.click('#modalRoot [data-wo-day-nosite-open]');
      await page.waitForSelector('#hjSchNoSite');
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].some(b => /뒤로/.test(b.textContent))), '‹ 뒤로 단추');
      await pick(page, 'n1', '가온아파트');
      await applyBtn(page);
      await page.waitForSelector('#hjWoDay');
      const w2 = await page.evaluate(() => ({ n: (document.querySelector('#hjWoDay [data-wo-day-nosite]') || {}).dataset?.woDayNosite || '', orders: document.querySelectorAll('#hjWoDay [data-wo-day-order]').length, proj: state.schedule.find(x => x.id === 'n1').project }));
      assert.deepEqual(w2, { n: '2', orders: 2, proj: '가온아파트' }, '이은 뒤 그 창으로 돌아와 다시 짬 ' + JSON.stringify(w2));
      await page.evaluate(() => closeModal());
      await page.evaluate(() => { hjWoTomorrowView('2026-11-18'); });
      await page.waitForSelector('#modalRoot [data-wo-day-empty]');
      const e = await page.evaluate(() => { const n = document.querySelector('#modalRoot [data-wo-day-nosite]'); return n ? n.dataset.woDayNosite : ''; });
      assert.equal(e, '1', '현장 일정이 하나도 없는 날도 안내 ' + e);
      await page.evaluate(() => closeModal());
      const cmd = await page.evaluate(() => (cwDefaultsV529().find(t => t.id === 'cw_sitesort') || {}).prompt || '');
      assert.ok(cmd.includes('[🔗 현장 없는 일정]'), '🧰 명령 6번이 이 창을 가리킴');
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 607, '핀 3곳 같음(v607 이상) ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('nosite-v607: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL nosite-v607', e && e.stack || e); process.exit(1); });
