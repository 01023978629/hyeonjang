/* morningboot-v592 두 검사(morningboot-v592·morningboot2-v592)가 같이 쓰는 틀 — 시드·콜드 스타트·가짜 서버(relay)·변이 표.
   검사 파일이 아니다(run-all 은 *.check/unit/e2e.js 만 돈다). 포트는 부르는 쪽이 APP 으로 넘긴다(hjtest.sh 가 검사 파일만 고친다).
   자료는 첫 페이지(자동화 브라우저 그대로 — 하루 창 없음)에서 앱의 저장 길로 IDB 에 넣고, 같은 컨텍스트의 새 페이지로 콜드 스타트한다.
   콜드 스타트 페이지는 navigator.webdriver 를 false 로 바꿔 진짜 브라우저처럼 돈다(앱은 자동화 브라우저에 하루 창을 띄우지 않는다). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const RELAY_HOST = 'relay.v592.test', RELAY_URL = 'https://' + RELAY_HOST + '/exec';
const THU = '2026-11-12', MON = '2026-11-16';
// 변이 — 앞 검사(morningboot-v592) ①~⑤, 뒤 검사(morningboot2-v592) ⑥~⑧ 가운데 [ ] 의 시나리오에서 실패해야 한다.
const MUT = {
  // [①] 복원·서버 부팅을 안 기다리고 정함(예전 부팅 줄처럼 빈 state)
  'pre-restore': [['let restored=null;try{restored=await Promise.resolve(window.__hjRestoreDone);}catch(e){}', 'let restored=null;'],
    ["  let relayDone=false;\n", "  let relayDone=true;\n"],
    ['  try{await Promise.race([Promise.resolve(window.__hjRelayFreshDone', '  if(0)try{await Promise.race([Promise.resolve(window.__hjRelayFreshDone']],
  // [①] 창 두 개
  'stack': [['for(const f of list){let p=null;try{p=f();}catch(e){}if(p&&typeof p.open===\'function\')return p;}\n  return null;',
    'let first=null;for(const f of list){let p=null;try{p=f();}catch(e){}if(p&&typeof p.open===\'function\'){if(!first)first=p;else if(!window.__v592stack){window.__v592stack=1;setTimeout(()=>{try{p.open();}catch(e){}},2200);}}}\n  return first;']],
  // [① · ⑧] 🤖 가 🌅 표시를 안 봄(오늘 브리핑 두 번)
  'no-sibling': [['    if(hjTodayBriefSeen())return null;   // 🌅 든 🤖 든', "    if(localStorage.getItem('hj_active_brief')===localDate())return null;   // 🌅 든 🤖 든"]],
  // [⑧] 손으로 연 🤖 가 오늘 본 것으로 안 남음
  'no-active-mark': [["  try{localStorage.setItem('hj_active_brief',localDate());}catch(e){}   // v592 손으로 열어도", '  // v592 손으로 열어도']],
  // [③] 들어온 길 무시 · [③] 지워지기 전에 읽은 #hjreq= 표시 무시 · [③] 떠 있는 창 무시
  'no-entry': [["  if(entered){notify();return {k:'',why:'entry'};}\n", '']],
  'no-link': [['link:__hjBootLinkEntry,', 'link:false,']],
  'no-busy': [["  if(hjDailyAutoBusy()){notify();return {k:plan.k,shown:false,why:'busy'};}", '']],
  // [④] 복원된 자료를 안 봄 · [④] 들어온 길로 연 새 기기에 첫 안내
  'onboard-empty': [["localStorage.getItem('hj_onboard_done')!=='1'&&!hjBootHasUserData()){", "localStorage.getItem('hj_onboard_done')!=='1'){"]],
  'onboard-entry': [["if(ok&&!entered&&localStorage.getItem('hj_onboard_done')", "if(ok&&localStorage.getItem('hj_onboard_done')"]],
  // [⑥] 서버 부팅 확인을 안 기다림(v530 자동 반영이 배너로)
  'no-relay-wait': [["  let relayDone=false;\n", "  let relayDone=true;\n"],
    ['  try{await Promise.race([Promise.resolve(window.__hjRelayFreshDone', '  if(0)try{await Promise.race([Promise.resolve(window.__hjRelayFreshDone']],
  // [⑥] 서버 자료가 같을 때도 느린 사진 목록 맞추기까지 기다림(상한에 걸려 건너뜀)
  'no-fresh': [['        relayFreshComplete();   // v592 자료는 최신', '        // v592 자료는 최신']],
  // [⑥] 서버 최신 자료 띠 위에 띄움
  'no-relaybar-busy': [["||document.getElementById('relayNewBar')", '']],
  // [⑦] 한눈 보기 위에 띄움 · [⑦] 오늘 창이 남은 부팅에도 한눈 보기
  'no-glance-busy': [["||document.getElementById('hjGlance')", '']],
  'glance-always': [['    }else if(!opts.noGlance){', '    }else{']],
  // [⑦] 🌅 가 뜬 부팅에도 🔔 시스템 알림
  'no-notify-skip': [["  if(notifyOn&&(now.k==='morning'||now.k==='active')){try{localStorage.setItem('hj_notify_fired',localDate());}catch(e){}}else notify();", '  notify();']],
  // [⑧] 입력칸 포커스·누름·숨겨진 화면을 안 봄
  'no-touch': [["    ||(typeof relayEditingNow==='function'&&relayEditingNow())||document.visibilityState==='hidden'||__hjBootTouched);", '    );']],
  // [⑧] 열기 전에 표시(오류로 죽으면 그날 브리핑을 잃음)
  'mark-first': [['  try{r=plan.open();}catch(e){undo();return false;}', "  Object.keys(plan.marks||{}).forEach(k=>{try{localStorage.setItem(k,plan.marks[k]);}catch(e){}});\n  try{r=plan.open();}catch(e){return false;}"]],
  // [⑧] 시험·세금 일정만 있는 기기에도 · [⑧] 새벽에도
  'no-nodata': [["  if(!hjDailyAutoHasData()){notify();return {k:'',why:'nodata'};}", '']],
  'no-night': [["  if(new Date().getHours()<HJ_DAILY_AUTO_FROM_HOUR)return {k:'',why:'night'};", '']]
};
function loadHtml(ROOT, SRC, env) {
  let html = env.HJ_V592_BASELINE ? execFileSync('git', ['show', env.HJ_V592_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
  if (env.HJ_V592_MUTATION) {
    const list = MUT[env.HJ_V592_MUTATION]; assert.ok(list, 'unknown mutation ' + env.HJ_V592_MUTATION);
    html = SRC;
    for (const [from, to] of list) { assert.equal(html.split(from).length, 2, 'mutation anchor ' + from.slice(0, 60)); html = html.replace(from, to); }
  }
  return html;
}
const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
const isOnboard = id => /운영을 한곳에서/.test(id || '');
const kst = (day, hm) => new Date(day + 'T' + (hm || '08:30') + ':00+09:00');

function createKit({ APP, html, browser }) {
  const ORIGIN = new URL(APP).origin;
  const errors = [], network = { writes: 0 };
  // 가짜 서버(Apps Script relay) — 요청마다 delay, hang 이면 아무것도·hangActions 의 요청은 답하지 않는다(상한 시험). 요청은 세어 둔다.
  async function relayRoute(route, relay) {
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    relay.calls.push(String(body.action || ''));
    if (relay.hang || relay.hangActions.includes(body.action)) return;
    if (relay.delay) await new Promise(r => setTimeout(r, relay.delay));
    const reply = obj => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) }).catch(() => {});
    if (body.action === 'health') return reply({ ok: true, version: 'relay-v592-test', folderOk: true, dataFileExists: true, revision: relay.rev });
    if (body.action === 'load') return reply({ ok: true, exists: true, data: relay.data, revision: relay.rev, modifiedAt: relay.data.savedAt, savedBy: 'pc-v592' });
    if (body.action === 'listFiles') return reply({ ok: true, files: [] });
    return reply({ ok: false, error: 'bad-request', message: 'v592 test relay' });
  }
  async function newContext(onboarded, opts) {
    opts = opts || {};
    const context = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const relay = context.__relay = { delay: 0, hang: false, hangActions: [], rev: 2, data: null, calls: [] };
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.host === RELAY_HOST) return relayRoute(route, relay);
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(o => {
      if (o.onb) localStorage.setItem('hj_onboard_done', '1');
      localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
      localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' }));
      if (o.notify) {   // 🔔 시스템 알림 — 허용된 기기처럼, 보낸 알림은 __notes 에
        window.__notes = [];
        const N = function (title, x) { window.__notes.push(String(title) + '|' + String(x && x.body || '')); };
        N.prototype.close = function () {}; N.permission = 'granted'; N.requestPermission = () => Promise.resolve('granted');
        try { Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true }); } catch (e) { window.Notification = N; }
        localStorage.setItem('hj_notify_on', '1');
      }
      if (o.standalone) {   // 설치 앱(홈 화면) — 한눈 보기가 기본으로 켜지는 곳
        const mm = window.matchMedia.bind(window);
        window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : mm(q);
      }
      // 한눈 보기 캐시 — once: 처음 한 번(뒤로는 앱이 쓴 것) · u0: 매번 '지난번엔 사용자 자료 없음'(복원 전 짐작이 틀린 경우)
      if (o.glance === 'u0' || (o.glance === 'once' && !localStorage.getItem('hj_glance')))
        localStorage.setItem('hj_glance', JSON.stringify({ at: o.glanceAt, d: '', sch: [], schN: 0, check: 0, u: o.glance === 'u0' ? 0 : 1 }));
    }, { onb: !!onboarded, notify: !!opts.notify, standalone: !!opts.standalone, glance: opts.glance || '', glanceAt: opts.glanceAt || 0 });
    return context;
  }
  function watchPage(page) {
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  }
  // 자료 넣기 — 자동화 브라우저 그대로(하루 창 없음)인 페이지에서 앱의 저장 길로 IDB 에 쓴다.
  // paid: 유상 저장본(durableLocalMutation) · relay: 서버 설정을 이 기기 IDB 에(rev 1, 안 올린 변경 unsynced) — 이 기기 저장본(서버 자료를 만들 바탕)을 돌려준다
  // manual: 'morning'|'active' — 손으로 그 브리핑을 연다(AI 도구·더보기와 같은 함수)
  async function seed(context, day, opts) {
    opts = opts || {};
    const page = await context.newPage(); watchPage(page);
    await page.clock.setFixedTime(kst(day, '08:00'));
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    const out = await page.evaluate(async ({ keys, day, opts, p1, p2, relayUrl }) => {
      await Promise.all(keys.map(key => window[key])); await window.__hjBootAutoDone; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      closeModal(true);
      const sch = { id: 's592a', date: day, time: '09:00', title: '타일 시공', project: '가온아파트' };
      let saved;
      // 유상 시드 전에 aiOps 기본값을 채운다 — 대시보드 그리기가 채우면 시드 커밋 직후 '저장본 == 지금 상태' 확인에 걸린다(시드 문제, 앱과 무관)
      if (opts.paid) { aiOpsEnsureState(); await durableLocalMutation({ snapshotLabel: 'v592 시드', mutateDraft: next => { next.projects = [p1, p2]; next.schedule = (next.schedule || []).concat([sch]); return true; } }); saved = true; }
      else { state.projects = [p1, p2]; state.schedule = (state.schedule || []).concat([sch]); saved = await guardedPersistCurrentState(); }
      if (opts.manual === 'morning') { hjMorningBrief(); closeModal(true); }
      if (opts.manual === 'active') { await aiActiveBrief(); closeModal(true); }
      let data = null;
      if (opts.relay) {
        await idbSet('relay_url', relayUrl); await idbSet('relay_token', 'test-token-v592'); await idbSet('relay_device', 'mobile-v592');
        await idbSet('relay_rev', 1); await idbSet('relay_syncAt', new Date().toISOString());
        localStorage.setItem('hj_relay_unsynced', opts.relay.unsynced ? String(Date.now()) : '0');
        data = JSON.parse(JSON.stringify(serializeData()));
      }
      localStorage.removeItem('hj_notify_fired');   // 시드 페이지(자동화 브라우저)가 보낸 🔔 은 시험 밖
      return { saved, data };
    }, { keys: BOOT, day, opts: { paid: !!opts.paid, manual: opts.manual || '', relay: opts.relay || null }, p1: P('가온아파트'), p2: P('나래아파트'), relayUrl: RELAY_URL });
    assert.ok(out.saved, '시드 저장');
    await page.close();
    return out.data;
  }
  // 콜드 스타트 — navigator.webdriver 를 false 로(진짜 브라우저처럼) · 자동 창 기록(__modalLog)·한눈 보기 기록(__glanceSeen)
  // opts: time('HH:MM') · realWebdriver · userModal(복원 전에 연 창) · typing(복원 직후 검색칸에 친 글자) · prep(복원 직후 페이지에서 돌릴 함수)
  //       noRelayWait(서버 부팅 끝을 안 기다림 — hang 시험) · settle(결과 뒤 더 지켜볼 ms, 두 번째 자동 창)
  async function cold(context, day, suffix, opts) {
    opts = opts || {};
    const page = await context.newPage(); watchPage(page);
    await page.addInitScript(real => {
      if (!real) { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (e) {} }
      window.__modalLog = []; window.__glanceSeen = false; let last = null;
      const look = () => {
        if (document.getElementById('hjGlance')) window.__glanceSeen = true;
        const m = document.querySelector('#modalRoot .modal'); let id = null;
        if (m) { const h = m.querySelector('h3'); id = (h && h.textContent.trim()) || ('(제목 없음) ' + (m.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)); }
        if (id !== last) { last = id; if (id) window.__modalLog.push(id); }
      };
      new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
    }, !!opts.realWebdriver);
    await page.clock.setFixedTime(kst(day, opts.time));
    await page.goto(APP + (suffix || ''), { waitUntil: 'domcontentloaded' });
    if (opts.userModal) {
      // 사용자가 먼저 연 창 — 복원 전에 연다(하루 창은 복원 뒤 0.7초 넘어서야 고른다)
      await page.waitForFunction(() => typeof openModal === 'function' && !!document.getElementById('modalRoot'));
      await page.evaluate(() => openModal('📝 사용자 창', '<p>먼저 연 창</p>'));
    }
    const keys = opts.noRelayWait ? BOOT.filter(k => k !== '__hjRelayBootDone') : BOOT;
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), keys);
    await page.evaluate(() => window.__hjRestoreDone);
    if (opts.typing) { await page.focus('#globalSearch'); await page.keyboard.type(opts.typing, { delay: 60 }); }
    if (opts.prep) await page.evaluate(opts.prep);
    const snap = await page.evaluate(async keys => {
      taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0; aiOpsBootCheck = () => 0; aiQueueSanitize = () => 0;
      __gdToken = null; window.__geminiKey = '';
      const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject;
      await Promise.all(keys.map(key => window[key]));
      return JSON.stringify(o);
    }, keys);
    const result = await page.evaluate(async () => { try { return await window.__hjBootAutoDone; } catch (e) { return { err: String(e) }; } });
    await page.waitForTimeout(opts.settle == null ? 800 : opts.settle);
    const after = await page.evaluate(() => {
      const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject;
      const m = document.querySelector('#modalRoot .modal'), s = document.getElementById('globalSearch'), a = document.activeElement;
      return { log: window.__modalLog.slice(), open: m ? ((m.querySelector('h3') || {}).textContent || '').trim() || '(제목 없음)' : null,
        modalText: m ? (m.textContent || '').replace(/\s+/g, ' ') : '', glance: window.__glanceSeen, glanceNow: !!document.getElementById('hjGlance'),
        notes: Array.isArray(window.__notes) ? window.__notes.slice() : null, relayBar: !!document.getElementById('relayNewBar'),
        projects: (state.projects || []).map(p => p.name), schedN: (state.schedule || []).length, search: s ? s.value : null, active: a ? (a.id || a.tagName) : null,
        snapAfter: JSON.stringify(o), tab: state.tab, src: window.__hjRestoreSource,
        ls: Object.fromEntries(['hj_morning_shown', 'hj_active_brief', 'hj_weekbrief_shown', 'hj_onboard_done', 'hj_notify_fired'].map(k => [k, localStorage.getItem(k)])),
        over: document.documentElement.scrollWidth > innerWidth + 1 || (m ? m.scrollWidth - m.clientWidth > 1 : false),
        smallBtns: m ? [...m.querySelectorAll('.mfoot button,.modal-close')].filter(b => b.getBoundingClientRect().height < 44).length : 0 };
    });
    return Object.assign({ page, snap, result }, after);
  }
  return { newContext, seed, cold, errors, network };
}
module.exports = { MUT, loadHtml, createKit, isOnboard, P, kst, THU, MON, BOOT, RELAY_URL };
