/* v592 아침 자동 창 콜드 스타트 — 첫 안내·하루 자동 창(🌅 아침 브리핑·🤖 오늘의 브리핑·📅 주간 브리핑·📊 운영 리포트)을 기기 자료 복원 뒤에 정한다.
   예전 부팅 줄은 복원(__hjRestoreDone)보다 먼저 돌아 늘 빈 state 를 봤다 — 자료가 IDB 에만 있는 콜드 스타트에서 아침 창이 한 번도 안 떴고(v586 기록),
   hj_onboard_done 이 없는 기존 사용자에게는 첫 안내가 떴다. 합성 자료(이름은 지어낸 것), 시계 고정, 바깥 쓰기 0.
   자료는 첫 페이지에서 앱의 저장 길(guardedPersistCurrentState)로 IDB 에 넣고, 같은 컨텍스트의 새 페이지로 콜드 스타트한다.
   자동화 브라우저는 하루 창을 띄우지 않으므로(⑤) 콜드 스타트 페이지는 navigator.webdriver 를 false 로 바꾼다.
   ① 목요일 콜드 스타트 — 🌅 가 한 번만 뜨고 3초 안에 다른 자동 창 없음 · 🌅·🤖 둘 다 오늘 본 것으로 · 저장본 불변 · 폰 390 넘침 없음 · 같은 날 다시 열면 아무것도 안 뜸 (COLD)
   ② 월요일 — 첫 부팅은 🌅 만(주간 브리핑은 표시하지 않고 미룸) · 두 번째 부팅에 📅 주간 브리핑 · 세 번째는 없음 (WEEK)
   ③ 들어온 길·이미 떠 있는 창 — ?view=schedule 바로가기·#hjreq= 작업 요청·#lead= 리드 첫 화면에는 하루 창 없음 · 사용자가 먼저 연 창 위에는 안 띄우고 표시도 안 남김 → 다음에 열면 뜸 (ENTRY)
   ④ 첫 안내 — 빈 새 기기는 첫 안내(하루 창 없음) · hj_onboard_done 이 없어도 IDB 자료가 복원되는 기존 사용자에게는 첫 안내 없이 🌅 (ONBOARD)
   ⑤ 자동화 브라우저(webdriver)는 하루 창 없음 · 유상 저장본(paid-generation)으로 복원된 기기도 🌅 — 띄워도 저장본 == 지금 상태 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (GUARD)
   HJ_V592_BASELINE=<commit> 는 ① 에서 실패해야 한다. HJ_V592_MUTATION=pre-restore(복원 전에 정함)·stack(두 창)·no-sibling(🤖 를 오늘 본 것으로 안 적음)은 ①,
   no-entry(들어온 길 무시)·no-link(지워지기 전에 읽은 #hjreq= 표시 무시)·no-busy(떠 있는 창 무시)는 ③, onboard-empty(복원된 자료를 안 봄)는 ④ 에서 실패해야 한다. */
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
  'pre-restore': ['let restored=null;try{restored=await Promise.resolve(window.__hjRestoreDone);}catch(e){}', 'let restored=null;'],
  'stack': ['for(const f of list){let p=null;try{p=f();}catch(e){}if(p&&typeof p.open===\'function\')return p;}\n  return null;',
    'let first=null;for(const f of list){let p=null;try{p=f();}catch(e){}if(p&&typeof p.open===\'function\'){if(!first)first=p;else if(!window.__v592stack){window.__v592stack=1;setTimeout(()=>{try{p.open();}catch(e){}},2200);}}}\n  return first;'],
  'no-sibling': ['marks:{hj_morning_shown:localDate(),hj_active_brief:localDate()},open:()=>hjMorningBrief()', 'marks:{hj_morning_shown:localDate()},open:()=>hjMorningBrief()'],
  'no-entry': ["  if(entry.lead||entry.bath||entry.share||entry.link||entry.view)return {k:'',why:'entry'};\n", ''],
  'no-link': ['link:__hjBootLinkEntry,', 'link:false,'],
  'no-busy': ["  if(hjDailyAutoBusy())return {k:plan.k,shown:false,why:'busy'};", ''],
  'onboard-empty': ['!hjBootHasUserData()&&!entry.lead', '!entry.lead']
};
let html = process.env.HJ_V592_BASELINE ? execFileSync('git', ['show', process.env.HJ_V592_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V592_MUTATION) {
  const m = MUT[process.env.HJ_V592_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V592_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
const THU = '2026-11-12', MON = '2026-11-16';
async function test(name, fn) { await fn(); passed++; console.log('PASS morningboot-v592 ' + name); }
async function newContext(onboarded) {
  const context = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(onb => {
    if (onb) localStorage.setItem('hj_onboard_done', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' }));
  }, !!onboarded);
  return context;
}
function watchPage(page) {
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
}
// 자료 넣기 — 자동화 브라우저 그대로(하루 창 없음)인 페이지에서 앱의 저장 길로 IDB 에 쓴다(paid 면 유상 저장본 — durableLocalMutation)
async function seed(context, day, paid) {
  const page = await context.newPage(); watchPage(page);
  await page.clock.setFixedTime(new Date(day + 'T08:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  const saved = await page.evaluate(async ({ keys, day, paid }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    closeModal(true);
    const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
    const sch = { id: 's592a', date: day, time: '09:00', title: '타일 시공', project: '가온아파트' };
    // 유상 시드 전에 aiOps 기본값을 채운다 — 대시보드 그리기가 채우면 시드 커밋 직후 '저장본 == 지금 상태' 확인에 걸린다(시드 문제, 앱과 무관)
    if (paid) { aiOpsEnsureState(); await durableLocalMutation({ snapshotLabel: 'v592 시드', mutateDraft: next => { next.projects = [P('가온아파트'), P('나래아파트')]; next.schedule = (next.schedule || []).concat([sch]); return true; } }); return true; }
    state.projects = [P('가온아파트'), P('나래아파트')];
    state.schedule = (state.schedule || []).concat([sch]);
    return await guardedPersistCurrentState();
  }, { keys: BOOT, day, paid: !!paid });
  assert.ok(saved, '시드 저장');
  await page.close();
}
// 콜드 스타트 — navigator.webdriver 를 false 로(진짜 브라우저처럼) · 자동 창 기록(__modalLog)
async function cold(context, day, suffix, opts) {
  opts = opts || {};
  const page = await context.newPage(); watchPage(page);
  await page.addInitScript(real => {
    if (!real) { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) {} }
    window.__modalLog = []; let last = null;
    const look = () => {
      const m = document.querySelector('#modalRoot .modal'); let id = null;
      if (m) { const h = m.querySelector('h3'); id = (h && h.textContent.trim()) || ('(제목 없음) ' + (m.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)); }
      if (id !== last) { last = id; if (id) window.__modalLog.push(id); }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
  }, !!opts.realWebdriver);
  await page.clock.setFixedTime(new Date(day + 'T08:30:00+09:00'));
  await page.goto(APP + (suffix || ''), { waitUntil: 'domcontentloaded' });
  if (opts.userModal) {
    // 사용자가 먼저 연 창 — 복원 전에 연다(하루 창은 복원 뒤 0.7초 넘어서야 고른다)
    await page.waitForFunction(() => typeof openModal === 'function' && !!document.getElementById('modalRoot'));
    await page.evaluate(() => openModal('📝 사용자 창', '<p>먼저 연 창</p>'));
  }
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  const snap = await page.evaluate(async keys => {
    await window.__hjRestoreDone;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0; aiOpsBootCheck = () => 0; aiQueueSanitize = () => 0;
    __gdToken = null; window.__geminiKey = '';
    const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject;
    await Promise.all(keys.map(key => window[key]));
    return JSON.stringify(o);
  }, BOOT);
  const result = await page.evaluate(async () => { try { return await window.__hjBootAutoDone; } catch (e) { return { err: String(e) }; } });
  await page.waitForTimeout(3000);   // 3초 더 — 두 번째 자동 창이 뜨는지 본다
  const after = await page.evaluate(() => {
    const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject;
    const m = document.querySelector('#modalRoot .modal');
    return { log: window.__modalLog.slice(), open: m ? ((m.querySelector('h3') || {}).textContent || '').trim() || '(제목 없음)' : null,
      snapAfter: JSON.stringify(o), tab: state.tab, src: window.__hjRestoreSource,
      ls: Object.fromEntries(['hj_morning_shown', 'hj_active_brief', 'hj_weekbrief_shown', 'hj_onboard_done'].map(k => [k, localStorage.getItem(k)])),
      over: document.documentElement.scrollWidth > innerWidth + 1 || (m ? m.scrollWidth - m.clientWidth > 1 : false),
      smallBtns: m ? [...m.querySelectorAll('.mfoot button,.modal-close')].filter(b => b.getBoundingClientRect().height < 44).length : 0 };
  });
  return Object.assign({ page, snap, result }, after);
}
const isOnboard = id => /운영을 한곳에서/.test(id || '');

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    await test('① 목요일 콜드 스타트 — 🌅 한 번만 · 3초 안에 다른 자동 창 없음 · 🌅·🤖 오늘 본 것으로 · 저장본 불변 · 같은 날 다시 열면 없음 (COLD)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const a = await cold(ctx, THU);
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], '복원된 자료로 아침 브리핑이 한 번만 뜬다(3초 안에 다른 자동 창 없음) ' + JSON.stringify(a.log));
      assert.equal(a.open, '🌅 오늘의 브리핑', '아침 브리핑이 떠 있다');
      assert.deepEqual(a.result, { k: 'morning', shown: true }, '부팅 자동 창 결과 ' + JSON.stringify(a.result));
      assert.equal(a.ls.hj_morning_shown, THU, '🌅 오늘 본 것으로');
      assert.equal(a.ls.hj_active_brief, THU, '🤖 오늘의 브리핑도 오늘 본 것으로(하루 브리핑 두 번 금지)');
      assert.equal(a.ls.hj_weekbrief_shown, null, '주간 브리핑 표시는 건드리지 않는다');
      assert.equal(a.src, 'legacy-appState', '복원 출처 ' + a.src);
      assert.equal(a.snapAfter, a.snap, '자동 창은 localStorage 표시만 — 앱 저장본(serializeData)은 그대로');
      assert.equal(a.over, false, '폰 390 넘침 없음');
      assert.equal(a.smallBtns, 0, '창 버튼 44px');
      await a.page.close();
      const b = await cold(ctx, THU);
      assert.deepEqual(b.log, [], '같은 날 다시 열면 자동 창 없음 ' + JSON.stringify(b.log));
      assert.deepEqual(b.result, { k: '' }, '고를 창 없음 ' + JSON.stringify(b.result));
      await b.page.close();
      await ctx.close();
    });

    await test('② 월요일 — 첫 부팅 🌅 만(주간 브리핑은 표시 없이 미룸) · 두 번째 📅 주간 브리핑 · 세 번째 없음 (WEEK)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, MON);
      const a = await cold(ctx, MON);
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], '첫 부팅은 아침 브리핑 하나 ' + JSON.stringify(a.log));
      assert.equal(a.ls.hj_weekbrief_shown, null, '밀린 주간 브리핑은 본 것으로 적지 않는다');
      await a.page.close();
      const b = await cold(ctx, MON);
      assert.deepEqual(b.log, ['🤖 주간 브리핑'], '두 번째 부팅에 주간 브리핑 ' + JSON.stringify(b.log));
      assert.deepEqual(b.result, { k: 'week', shown: true });
      assert.equal(b.ls.hj_weekbrief_shown, MON);
      await b.page.close();
      const c = await cold(ctx, MON);
      assert.deepEqual(c.log, [], '세 번째는 없음 ' + JSON.stringify(c.log));
      await c.page.close();
      await ctx.close();
    });

    await test('③ 바로가기·작업 요청·리드로 들어온 첫 화면엔 하루 창 없음 · 먼저 연 창 위엔 안 띄우고 표시도 안 남김 → 다음에 뜸 (ENTRY)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const v = await cold(ctx, THU, '?view=schedule');
      assert.deepEqual(v.log, [], '바로가기(오늘 일정)로 들어오면 하루 창 없음 ' + JSON.stringify(v.log));
      assert.equal(v.tab, 'schedule', '바로가기 화면은 그대로');
      assert.deepEqual(v.result, { k: '', why: 'entry' });
      assert.equal(v.ls.hj_morning_shown, null, '표시를 남기지 않는다');
      await v.page.close();
      // #hjreq=(작업 요청 링크) — 주소는 부팅 초기에 지워지므로 그 전에 읽어 둔 표시로 판단한다(읽지 못한 요청은 알림만)
      const r = await cold(ctx, THU, '#hjreq=v592-bad');
      assert.deepEqual(r.log, [], '작업 요청 링크로 들어온 첫 화면에도 하루 창 없음 ' + JSON.stringify(r.log));
      assert.deepEqual(r.result, { k: '', why: 'entry' });
      await r.page.close();
      const lead = encodeURIComponent(JSON.stringify({ name: '시험고객', region: '가상동', type: '욕실', leadId: 'T592LEAD' }));
      const l = await cold(ctx, THU, '#lead=' + lead);
      assert.deepEqual(l.log, ['📥 새 상담 리드'], '리드 첫 화면 위에 하루 창 없음 ' + JSON.stringify(l.log));
      assert.equal(l.open, '📥 새 상담 리드', '리드 창이 그대로');
      assert.equal(l.ls.hj_morning_shown, null);
      await l.page.close();
      const u = await cold(ctx, THU, '', { userModal: true });
      assert.deepEqual(u.log, ['📝 사용자 창'], '먼저 연 창 위에 하루 창을 띄우지 않는다(갈아 끼우지 않음) ' + JSON.stringify(u.log));
      assert.deepEqual(u.result, { k: 'morning', shown: false, why: 'busy' });
      assert.equal(u.ls.hj_morning_shown, null, '건너뛴 날은 표시하지 않는다');
      await u.page.close();
      const w = await cold(ctx, THU);
      assert.deepEqual(w.log, ['🌅 오늘의 브리핑'], '다음에 열면 뜬다 ' + JSON.stringify(w.log));
      await w.page.close();
      await ctx.close();
    });

    await test('④ 첫 안내 — 빈 새 기기는 첫 안내만 · 플래그 없어도 복원 자료가 있으면 첫 안내 없이 🌅 (ONBOARD)', async () => {
      const ctx = await newContext(false);
      const e = await cold(ctx, THU);
      assert.equal(e.log.length, 1, '빈 기기는 자동 창 하나 ' + JSON.stringify(e.log));
      assert.ok(isOnboard(e.log[0]), '빈 새 기기는 첫 안내 ' + JSON.stringify(e.log));
      assert.equal(e.ls.hj_morning_shown, null, '첫 안내 날엔 하루 창 없음');
      await e.page.close();
      await seed(ctx, THU);
      const d = await cold(ctx, THU);
      assert.ok(!d.log.some(isOnboard), '자료가 IDB 에 있는 기존 사용자에게 첫 안내 없음 ' + JSON.stringify(d.log));
      assert.deepEqual(d.log, ['🌅 오늘의 브리핑'], '대신 아침 브리핑 하나 ' + JSON.stringify(d.log));
      assert.equal(d.ls.hj_onboard_done, null, '첫 안내 플래그는 건드리지 않는다');
      await d.page.close();
      await ctx.close();
    });

    await test('⑤ 자동화 브라우저는 하루 창 없음 · 유상 저장본 기기도 🌅·저장본 == 지금 상태 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (GUARD)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const r = await cold(ctx, THU, '', { realWebdriver: true });
      assert.deepEqual(r.log, [], '자동화 브라우저(기존 검사들)에는 하루 창을 띄우지 않는다 ' + JSON.stringify(r.log));
      assert.deepEqual(r.result, { k: '', why: 'webdriver' });
      assert.equal(r.ls.hj_morning_shown, null);
      await r.page.close();
      await ctx.close();
      // 유상 저장본(paid-generation)으로 복원된 기기 — 아침 브리핑을 띄워도 복원된 바이트 그대로(빈 배열·객체를 붙이지 않는다)
      const pctx = await newContext(true);
      await seed(pctx, THU, true);
      const s = await cold(pctx, THU);
      assert.equal(s.src, 'paid-generation', '유상 저장본으로 복원 ' + s.src);
      assert.deepEqual(s.log, ['🌅 오늘의 브리핑'], '유상 저장본 기기에도 아침 브리핑 ' + JSON.stringify(s.log));
      assert.equal(s.snapAfter, s.snap, '하루 창을 띄워도 유상 저장본 그대로');
      const exact = await s.page.evaluate(async () => { try { const r = await resolvePaidCommitState(); assertPaidLiveStateExact(r.data); return 'ok'; } catch (e) { return String(e && e.message || e); } });
      assert.equal(exact, 'ok', '저장본 == 지금 상태(유상 정확 일치) ' + exact);
      await s.page.close();
      await pctx.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally { await browser.close(); }
  console.log('morningboot-v592: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL morningboot-v592', e && e.stack || e); process.exit(1); });
