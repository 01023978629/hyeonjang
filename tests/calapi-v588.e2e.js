/* v588 📅 구글 캘린더에서 바로 읽기 · 구글 우선 — 대표(11/12) "구글 캘린더와 연동해서 사용할 거야".
   맞추기 창(v567)은 .ics 파일이나 화면 글 붙여 넣기로만 읽었다. 이제 [📅 구글 캘린더에서 바로 읽기] 가 기본 캘린더를 GET 으로만 읽어 같은 미리보기·반영으로 넘긴다.
   대표의 실제 구글 캘린더(11/12 사진): 제미나이('@')가 여러 날 작업을 날마다 따로 만든다 · 앱이 올린 '[현장명] 제목' · 개인 일정(항공 2일 막대·생일) · '[파수꾼]'.
   합성 자료(이름은 지어낸 것) · 시계 2026-11-10 10:00 KST 고정 · 구글 로그인(GIS)은 가짜 토큰 클라이언트 · googleapis 응답은 page.route 가짜 JSON · 바깥 쓰기 0.
   ① 구글 일정 → 읽은 일정 꼴 — 종일 끝(다음 날 → 하루 빼기)·60일 상한 · 시각 +09:00·Z·다른 오프셋 → 한국 시각 · eventType 거르기 · 취소 · 설명 HTML · uid · 반복 회차 · .ics 와 같은 결과 (CONVERT)
   ② 바로 읽기 — 누른 그 순간 권한 창(아이폰) · calendar.readonly · 기간·쿼리 · 쪽 넘기기 · Bearer 토큰 · 미리보기 → 반영(기존 경로, 안전판 1회) · 결과 창
      · 토큰이 IDB·localStorage·sessionStorage·저장본 어디에도 없음 · googleapis 로 GET 외 요청 0 (READ)
   ③ 실패 — 403 Calendar API 꺼짐 안내 · 401 한 번만 다시 · 계속 401 · 권한 거부·창 닫음 · 오프라인 · 네트워크 끊김 · 8쪽 상한 · 창을 닫은 뒤 늦은 응답 — 모두 자료 불변 (FAIL)
   ④ 구글 우선 — 짧아진 기간도 체크된 채 · 이어지는 날은 이미 같음(앱 일정 used 그대로 — 시작이 옮겨진 구글 일정이 여전히 짝) · 같은 날 짝이 이어지는 날보다 먼저
      · 구글 여러 날 vs 앱의 따로 된 하루짜리 둘 → 늘리지 않음 · 같은 uid 짝(21일 넘게 옮김·제목 바뀜·완료 보고는 안 바꿈·합성 uid 는 안 봄·반복 회차는 같은 날만)
      · 반영 → 결과 창 ✏️ 제목 바뀜 줄·고객 글에서 뺌 (GOOGLE-FIRST)
   ⑤ 폰 390 — 넘침 없음 · 44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V588_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V588_MUTATION —
     no-exclusive-end·no-kst·no-type-filter 는 ①, no-page·token-persist·no-gesture 는 ②, no-401-retry·no-api-off-msg 는 ③,
     shorter-unchecked·no-cont-dedupe·cont-marks-used·cont-first·no-cover·no-uid-pair·rename-reported·series-move 는 ④ 에서 실패해야 한다. */
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
  'no-exclusive-end': ["const last=!s.time&&e&&!e.time&&e.date>s.date?hjAddDays(e.date,-1):'',to=last>s.date&&hjDaysBetween(s.date,last)<=60?last:'';\n  return {uid:String(ev.iCalUID",
    "const last=!s.time&&e&&!e.time&&e.date>s.date?e.date:'',to=last>s.date&&hjDaysBetween(s.date,last)<=60?last:'';\n  return {uid:String(ev.iCalUID"],
  'no-kst': ['const k=new Date(t+9*3600000),p2=n=>String(n).padStart(2,\'0\');\n  return {date:k.getUTCFullYear()', 'const k=new Date(t),p2=n=>String(n).padStart(2,\'0\');\n  return {date:k.getUTCFullYear()'],
  'no-type-filter': ['list.forEach(ev=>{if(ev&&HJ_CALAPI_SKIP_TYPES.includes(ev.eventType)){skipped++;return;}', 'list.forEach(ev=>{'],
  'no-page': ['  }while(page&&n<HJ_CALAPI_PAGES);', '  }while(false);'],
  'token-persist': ['if(resp&&resp.access_token){__calTok=resp.access_token;', "if(resp&&resp.access_token){__calTok=resp.access_token;try{localStorage.setItem('hj_cal_token',__calTok);}catch(_){}"],
  'no-gesture': ['  const tokP=getCalToken(true);   // await 전에', '  const tokP=Promise.resolve().then(()=>getCalToken(true));   // await 전에'],
  'no-401-retry': ['catch(e){if(!(e&&e.status===401))throw e;', 'catch(e){throw e;'],
  'no-api-off-msg': ['if(st===403&&HJ_CALAPI_OFF_RE.test(', 'if(false&&HJ_CALAPI_OFF_RE.test('],
  'shorter-unchecked': ["rows.push(Object.assign({},base,{status:'span',check:true,span,shorter,app}));", "rows.push(Object.assign({},base,{status:'span',check:!shorter,span,shorter,app}));"],
  'no-cont-dedupe': ["    if(!base.to&&apps.some(x=>x.key===g.key&&x.s.date<g.date&&g.date<=hjSchSpan(x.s).to)){g._base=null;stats.same++;stats.cont++;return;}\n", ''],
  'cont-marks-used': ['if(!base.to&&apps.some(x=>x.key===g.key&&x.s.date<g.date&&g.date<=hjSchSpan(x.s).to)){', 'if(!base.to&&apps.some(x=>x.key===g.key&&x.s.date<g.date&&g.date<=hjSchSpan(x.s).to&&(x.used=true))){'],
  'cont-first': ["    const same=apps.find(x=>!x.used&&x.s.date===g.date&&x.key===g.key);\n    if(same){g._base=null;return sameDay(g,base,rep,same);}\n",
    "    if(!base.to&&apps.some(x=>x.key===g.key&&x.s.date<g.date&&g.date<=hjSchSpan(x.s).to)){g._base=null;stats.same++;stats.cont++;return;}\n    const same=apps.find(x=>!x.used&&x.s.date===g.date&&x.key===g.key);\n    if(same){g._base=null;return sameDay(g,base,rep,same);}\n"],
  'no-cover': ['    if(base.to>g.date)apps.forEach(o=>{if(!o.used&&o.key===g.key&&o.s.date>g.date&&o.s.date<=base.to){o.used=true;covered=true;stats.same++;}});\n', ''],
  'no-uid-pair': ['const byUid=apps.filter(a=>a.uid);', 'const byUid=[];'],
  'rename-reported': ['      if(hjSchReported(a.s)){stats.same++;return;}   // 완료 보고한 일정은 날짜·제목을 바꾸지 않는다\n', ''],
  'series-move': ['const g=gs.filter(x=>!x._pair&&x._uidsOne.has(a.uid)).sort(', 'const g=gs.filter(x=>!x._pair&&x._uids.has(a.uid)).sort(']
};
let html = process.env.HJ_V588_BASELINE ? execFileSync('git', ['show', process.env.HJ_V588_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V588_MUTATION) {
  const m = MUT[process.env.HJ_V588_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V588_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V588_MUTATION); html = SRC.replace(m[0], m[1]);
}
const TOKEN_RE = /FAKE-CAL-TOKEN/;
// 구글 캘린더 API 일정 모양(합성)
const D = (id, summary, start, end, extra) => Object.assign({ kind: 'calendar#event', id, iCalUID: id + '@google.com', status: 'confirmed', summary, start: { date: start }, end: { date: end }, eventType: 'default' }, extra || {});
const T = (id, summary, start, end, extra) => Object.assign({ kind: 'calendar#event', id, iCalUID: id + '@google.com', status: 'confirmed', summary, start: { dateTime: start, timeZone: 'Asia/Seoul' }, end: { dateTime: end, timeZone: 'Asia/Seoul' }, eventType: 'default' }, extra || {});
// ① 변환용
const CONV = [
  D('c1', '@가온아파트 타일', '2026-11-13', '2026-11-14'),                                     // 종일 하루 — 끝 없음
  D('c2', '나래마을 욕실 방수', '2026-11-16', '2026-11-19', { location: '나래마을 3동' }),    // 종일 3일 — 끝 11/18
  D('c3', '끝이 먼 일정', '2026-11-20', '2027-02-02'),                                       // 60일 넘음 — 하루짜리
  T('c4', '[가온아파트] 도배', '2026-11-17T09:00:00+09:00', '2026-11-17T17:30:00+09:00', { description: '<b>벽지</b><br>실크 &amp; 합지 &lt;확인&gt;' }),
  T('c5', '자정 넘긴 일', '2026-11-13T23:30:00Z', '2026-11-14T00:30:00Z'),                   // Z → 11/14 08:30, 같은 날 끝 → 1시간
  T('c6', '다른 나라 시각', '2026-11-13T20:00:00-05:00', '2026-11-13T22:00:00-05:00'),       // → 11/14 10:00, 2시간
  T('c7', '밤샘 작업', '2026-11-18T22:00:00+09:00', '2026-11-19T02:00:00+09:00'),            // 날을 넘김 → 1시간
  D('c8', '취소된 일정', '2026-11-21', '2026-11-22', { status: 'cancelled' }),
  D('c9', '김가온 생일', '2026-11-22', '2026-11-23', { eventType: 'birthday' }),
  D('c10', '집', '2026-11-23', '2026-11-24', { eventType: 'workingLocation' }),
  T('c11', '휴가', '2026-11-24T09:00:00+09:00', '2026-11-24T18:00:00+09:00', { eventType: 'outOfOffice' }),
  T('c12', '집중', '2026-11-25T09:00:00+09:00', '2026-11-25T11:00:00+09:00', { eventType: 'focusTime' }),
  D('c13', '항공편 시험공항 → 시험섬', '2026-11-26', '2026-11-28', { eventType: 'fromGmail' }),
  Object.assign(T('c14', '주간 회의', '2026-11-16T10:00:00+09:00', '2026-11-16T11:00:00+09:00', { recurringEventId: 'c14base' }), { iCalUID: undefined }),   // uid 없으면 id
  { kind: 'calendar#event', id: 'c15', summary: '날짜 없음', start: {}, end: {} }
];
const CONV_ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:c1@google.com', 'DTSTART;VALUE=DATE:20261113', 'DTEND;VALUE=DATE:20261114', 'SUMMARY:@가온아파트 타일', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c2@google.com', 'DTSTART;VALUE=DATE:20261116', 'DTEND;VALUE=DATE:20261119', 'SUMMARY:나래마을 욕실 방수', 'LOCATION:나래마을 3동', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c5@google.com', 'DTSTART:20261113T233000Z', 'DTEND:20261114T003000Z', 'SUMMARY:자정 넘긴 일', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
// ② 바로 읽기용 — 두 쪽
const READ_P1 = [D('r1', '창호 교체', '2026-11-12', '2026-11-13'), D('r2', '[가온아파트] 욕실 방수', '2026-11-16', '2026-11-19', { location: '가온아파트 2동' })];
const READ_P2 = [T('r3', '@도배', '2026-11-19T09:00:00+09:00', '2026-11-19T17:00:00+09:00')];
// ④ 구글 우선용
const PLAN_ITEMS = [
  D('g-t13', '@타일', '2026-11-13', '2026-11-14'), D('g-t14', '@타일', '2026-11-14', '2026-11-15'),                 // 앱 S 11/13~11/14 — 14 는 이어지는 날
  D('g-m16', '방수', '2026-11-16', '2026-11-17'), D('g-m18', '방수', '2026-11-18', '2026-11-19'),                   // 앱 M 11/17~11/19 — 18 이어지는 날, 16 은 시작을 앞당긴 것(M 과 짝)
  D('g-d20', '도배', '2026-11-20', '2026-11-21'), D('g-d21', '도배', '2026-11-21', '2026-11-22'), D('g-d23', '도배', '2026-11-23', '2026-11-24'),   // 앱 D1 20~23 + D2 21
  D('g-p', '미장', '2026-11-24', '2026-11-26'),                                                                    // 구글 24~25 vs 앱 P1 24 · P2 25
  D('g-k', '목공', '2026-12-01', '2026-12-03'),                                                                    // 앱 K 12/1~12/4 → 구글 12/1~12/2 (짧아짐)
  Object.assign(D('u1', '줄눈', '2026-12-15', '2026-12-16'), { iCalUID: 'evt-u1@google.com' }),                    // 앱 U1 11/12 — 같은 uid, 33일 뒤
  Object.assign(D('u2', '@실리콘 마감', '2026-11-26', '2026-11-27'), { iCalUID: 'evt-u2@google.com' }),            // 앱 U2 '실리콘' — 같은 날·제목만 바뀜
  Object.assign(D('u3', '도장 2차', '2026-11-30', '2026-12-01'), { iCalUID: 'evt-u3@google.com' }),                // 앱 U3 완료 보고 — 바꾸지 않음
  Object.assign(D('u5', '[가온아파트] 필름 시공', '2026-11-23', '2026-11-24'), { iCalUID: 'evt-u5@google.com' }),   // 앱 U5 '필름' 11/19 — 날짜·제목 둘 다
  Object.assign(D('u6', '마감 청소', '2026-11-29', '2026-11-30'), { iCalUID: 'gcal:2026-11-28|청소' }),            // 합성 uid — 짝 안 지음
  Object.assign(T('w13', '주간 회의', '2026-11-13T10:00:00+09:00', '2026-11-13T11:00:00+09:00'), { iCalUID: 'evt-weekly@google.com', recurringEventId: 'wk' }),
  Object.assign(T('w20', '주간 회의', '2026-11-20T10:00:00+09:00', '2026-11-20T11:00:00+09:00'), { iCalUID: 'evt-weekly@google.com', recurringEventId: 'wk' }),
  D('b1', '김가온 생일', '2026-11-22', '2026-11-23', { eventType: 'birthday' }),
  D('f1', '항공편 시험공항 → 시험섬', '2026-11-26', '2026-11-28', { eventType: 'fromGmail' }),
  D('x1', '취소된 일정', '2026-11-27', '2026-11-28', { status: 'cancelled' })
];

let browser, passed = 0;
const errors = [], network = { writes: 0, gWrites: 0, gCalls: [] };
// googleapis 가짜 — mode: ok(pages) · 403off · 403scope · 401once · 401always · abort · endless · slow
const api = { mode: 'ok', pages: [[]], n401: 0, slow: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calapi-v588 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method(), read = ['GET', 'HEAD'].includes(method);
    if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/calendar/v3/')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET' };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (method !== 'GET') { network.gWrites++; return route.abort('blockedbyclient'); }
      network.gCalls.push({ path: url.pathname, q: Object.fromEntries(url.searchParams), auth: request.headers().authorization || '' });
      const json = (status, body) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(body) });
      if (api.mode === 'abort') return route.abort('internetdisconnected');
      if (api.mode === '403off') return json(403, { error: { code: 403, message: 'Google Calendar API has not been used in project 000 before or it is disabled.', errors: [{ reason: 'accessNotConfigured', domain: 'usageLimits' }], status: 'PERMISSION_DENIED' } });
      if (api.mode === '403scope') return json(403, { error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }], status: 'PERMISSION_DENIED' } });
      if (api.mode === '401always' || (api.mode === '401once' && api.n401++ === 0)) return json(401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
      if (api.mode === 'endless') { const k = +(url.searchParams.get('pageToken') || 'P0').slice(1); return json(200, { items: [D('e' + k, '끝없는 쪽 ' + k, '2026-11-20', '2026-11-21')], nextPageToken: 'P' + (k + 1) }); }
      if (api.mode === 'slow') await new Promise(r => setTimeout(r, api.slow));
      const i = url.searchParams.get('pageToken') ? +url.searchParams.get('pageToken').slice(5) : 0, pg = api.pages[i] || [];
      return json(200, Object.assign({ kind: 'calendar#events', items: pg }, i + 1 < api.pages.length ? { nextPageToken: 'PAGE-' + (i + 1) } : {}));
    }
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
    // 가짜 구글 로그인(GIS) — mode: ok · deny(권한 거부) · close(창 닫음). 토큰은 자기서술형 가짜값.
    // 부팅 타이머가 드라이브 쪽 클라이언트(drive.file)를 만들 수 있다 — 캘린더 권한이 아닌 클라이언트는 기록만 하고 토큰을 주지 않는다(경합 없이 캘린더만 센다).
    window.__gis = { inits: [], reqs: [], other: [], mode: 'ok', n: 0 };
    window.google = { accounts: { oauth2: { initTokenClient(cfg) {
      const cal = /calendar/.test(String(cfg.scope || ''));
      __gis.inits.push({ client_id: cfg.client_id, scope: cfg.scope });
      if (!cal) return { callback: cfg.callback, requestAccessToken(o) { __gis.other.push(cfg.scope); } };
      const c = { callback: cfg.callback, requestAccessToken(o) { __gis.reqs.push((o && o.prompt) || ''); const m = __gis.mode;
        setTimeout(() => { if (m === 'deny') c.callback({ error: 'access_denied' }); else if (m === 'close') { if (c.error_callback) c.error_callback({ type: 'popup_closed' }); } else c.callback({ access_token: 'FAKE-CAL-TOKEN-' + (++__gis.n), expires_in: 3600 }); }, 0); } };
      return c; } } } };
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED_READ = () => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래마을아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  state.schedule = []; state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
const SEED_PLAN = () => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래마을아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  const S = (id, date, title, memo, extra) => Object.assign({ id, date, time: '', title, project: '가온아파트', workers: '', hours: 8, memo, report: null }, extra || {});
  state.schedule = [
    S('S', '2026-11-13', '타일', '2026-11-13~2026-11-14 (2일)'),
    S('M', '2026-11-17', '방수', '2026-11-17~2026-11-19 (3일)\n방수 2회'),
    S('D1', '2026-11-20', '도배', '2026-11-20~2026-11-23 (3일)'),
    S('D2', '2026-11-21', '도배', '', { project: '나래마을아파트' }),
    S('P1', '2026-11-24', '미장', ''), S('P2', '2026-11-25', '미장', ''),
    S('K', '2026-12-01', '목공', '2026-12-01~2026-12-04 (4일)'),
    S('U1', '2026-11-12', '줄눈', '', { icsUid: 'evt-u1@google.com' }),
    S('U2', '2026-11-26', '실리콘', '', { icsUid: 'evt-u2@google.com' }),
    S('U3', '2026-11-27', '도장', '', { icsUid: 'evt-u3@google.com', report: { progress: '완료' } }),
    S('U5', '2026-11-19', '필름', '', { icsUid: 'evt-u5@google.com' }),
    S('C1', '2026-11-28', '청소', '', { icsUid: 'gcal:2026-11-28|청소' }),
    S('W1', '2026-11-06', '회의', '', { icsUid: 'evt-weekly@google.com', project: '' })];
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
const sched = page => page.evaluate(() => JSON.stringify(serializeData().schedule));
async function readVia(page) {   // [📅 구글 캘린더에서 바로 읽기] 를 누르고 끝날 때까지
  await page.evaluate(() => { if (!document.getElementById('hjCalSync')) hjCalSyncView(); document.getElementById('csGoogle').click(); });
  await page.waitForFunction(() => { const b = document.getElementById('csGoogle'), m = document.getElementById('csGoogleMsg'); return b && !b.disabled && m && m.dataset.state && m.dataset.state !== 'busy'; });
  return page.evaluate(() => ({ msg: document.getElementById('csGoogleMsg').textContent, state: document.getElementById('csGoogleMsg').dataset.state, body: document.getElementById('csBody').innerText.replace(/\s+/g, ' ').trim(), plan: !!window.__hjCalSyncPlan }));
}

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED_READ);
    await test('① 구글 일정 → 읽은 일정 — 종일 끝·60일 · 한국 시각 · eventType · 취소 · 설명 · uid · 반복 · .ics 와 같음 (CONVERT)', async () => {
      const r = await page.evaluate(({ items, ics }) => { const ev = hjCalApiEvents(items);
        return { ev: ev.map(e => [e.uid, e.date, e.time || '종일', e.to || '', e.hours, e.raw, e.location, e.memo, e.cancelled, e.series]), skipped: ev.skipped, api: ev.api,
          ics: hjCalSyncParseIcs(ics).map(e => [e.uid, e.date, e.time || '종일', e.to || '', e.hours, e.raw, e.location]),
          range: hjCalApiRange() }; }, { items: CONV, ics: CONV_ICS });
      assert.deepEqual(r.ev, [
        ['c1@google.com', '2026-11-13', '종일', '', 8, '@가온아파트 타일', '', '', false, false],
        ['c2@google.com', '2026-11-16', '종일', '2026-11-18', 8, '나래마을 욕실 방수', '나래마을 3동', '', false, false],
        ['c3@google.com', '2026-11-20', '종일', '', 8, '끝이 먼 일정', '', '', false, false],
        ['c4@google.com', '2026-11-17', '09:00', '', 8.5, '[가온아파트] 도배', '', '벽지\n실크 & 합지 <확인>', false, false],
        ['c5@google.com', '2026-11-14', '08:30', '', 1, '자정 넘긴 일', '', '', false, false],
        ['c6@google.com', '2026-11-14', '10:00', '', 2, '다른 나라 시각', '', '', false, false],
        ['c7@google.com', '2026-11-18', '22:00', '', 1, '밤샘 작업', '', '', false, false],
        ['c8@google.com', '2026-11-21', '종일', '', 8, '취소된 일정', '', '', true, false],
        ['c14', '2026-11-16', '10:00', '', 1, '주간 회의', '', '', false, true]], JSON.stringify(r.ev));
      assert.deepEqual([r.skipped, r.api], [6, 15], '생일·근무지·부재중·집중·메일 예약 5 + 날짜 없음 1 = 건너뜀 6 · 받은 15 — ' + JSON.stringify([r.skipped, r.api]));
      assert.deepEqual(r.ics, r.ev.filter(x => ['c1@google.com', 'c2@google.com', 'c5@google.com'].includes(x[0])).map(x => x.slice(0, 7)), '같은 일정은 .ics 와 같은 날짜·시각·끝 — ' + JSON.stringify(r.ics));
      assert.deepEqual(r.range, { timeMin: '2026-11-03T00:00:00+09:00', timeMax: '2027-01-09T23:59:59+09:00' }, '지난 7일 ~ 앞으로 60일 — ' + JSON.stringify(r.range));
      // 계획에 넘기면 건너뛴 자동 일정도 '읽은 일정'·'건너뜀'에 센다
      const st = await page.evaluate(items => hjCalSyncPlan(hjCalApiEvents(items)).stats, CONV);
      assert.deepEqual([st.api, st.read, st.skipped], [15, 15, 7], '건너뜀 = 자동 6 + 취소 1 — ' + JSON.stringify(st));
    });
    await test('② 바로 읽기 — 권한 창(클릭 안) · readonly · 기간·쿼리·쪽 넘기기 · 미리보기 → 반영 · 토큰은 메모리만 · GET 만 (READ)', async () => {
      api.mode = 'ok'; api.pages = [READ_P1, READ_P2]; network.gCalls.length = 0;
      await page.evaluate(() => { window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { window.__snaps.push(a[0]); return o(...a); }; hjCalSyncView(); });
      const ui = await page.evaluate(() => { const b = document.getElementById('csGoogle'), h = b.getBoundingClientRect().height;
        const n0 = __gis.reqs.length; b.click(); return { sync: __gis.reqs.length - n0, h, hint: b.parentElement.innerText.replace(/\s+/g, ' ') }; });
      assert.equal(ui.sync, 1, '누른 그 순간(await 전) 권한 창을 띄운다 — 아이폰 팝업 막힘 방지 — ' + ui.sync);
      assert.ok(ui.h >= 44 && /지난 7일 ~ 앞으로 60일/.test(ui.hint) && /읽기만/.test(ui.hint) && /확인되지 않은 앱/.test(ui.hint) && /고급 → 계속/.test(ui.hint), JSON.stringify(ui));
      await page.waitForSelector('#csBody [data-cs-row="new"]');
      const r = await page.evaluate(() => ({ inits: __gis.inits, reqs: __gis.reqs, gd: GD_CLIENT_ID, msg: document.getElementById('csGoogleMsg').textContent,
        sum: document.querySelector('[data-cs-sum]').innerText.replace(/\s+/g, ' '), rows: window.__hjCalSyncPlan.rows.map(x => [x.status, x.date, x.to || '', x.time || '종일', x.title, x.uid, x.check]) }));
      assert.deepEqual(r.inits.filter(x => /calendar/.test(String(x.scope))), [{ client_id: r.gd, scope: 'https://www.googleapis.com/auth/calendar.readonly' }], '같은 OAuth 클라이언트 · 캘린더는 읽기 권한만, 클라이언트 하나 — ' + JSON.stringify(r.inits));
      assert.deepEqual(r.reqs, ['consent'], '처음 한 번 권한 창');
      assert.equal(network.gCalls.length, 2, '두 쪽 — ' + network.gCalls.length);
      const q0 = network.gCalls[0].q, q1 = network.gCalls[1].q;
      assert.equal(network.gCalls[0].path, '/calendar/v3/calendars/primary/events');
      assert.deepEqual([q0.timeMin, q0.timeMax, q0.singleEvents, q0.orderBy, q0.maxResults, q0.pageToken || ''], ['2026-11-03T00:00:00+09:00', '2027-01-09T23:59:59+09:00', 'true', 'startTime', '250', ''], JSON.stringify(q0));
      assert.equal(q1.pageToken, 'PAGE-1', '둘째 쪽은 nextPageToken 으로');
      assert.ok(network.gCalls.every(c => c.auth === 'Bearer FAKE-CAL-TOKEN-1'), '토큰은 Authorization 머리에만 — ' + JSON.stringify(network.gCalls.map(c => c.auth)));
      assert.deepEqual(r.rows, [
        ['new', '2026-11-12', '', '종일', '창호 교체', 'r1@google.com', true],
        ['new', '2026-11-16', '2026-11-18', '종일', '욕실 방수', 'r2@google.com', true],
        ['new', '2026-11-19', '', '09:00', '도배', 'r3@google.com', true]], JSON.stringify(r.rows));
      assert.ok(/구글 캘린더에서 3개 읽었어요/.test(r.msg) && r.sum.includes('📅 구글 캘린더에서 3개 읽음') && r.sum.includes('새 일정 3'), r.msg + ' / ' + r.sum);
      await page.click('#csApply');
      await page.waitForSelector('#hjCalSyncDone');
      const a = await page.evaluate(() => { const g = t => state.schedule.find(s => s.title === t) || {};
        const out = { n: state.schedule.length, snaps: window.__snaps, bath: [g('욕실 방수').date, g('욕실 방수').project, g('욕실 방수').icsUid, hjSchSpan(g('욕실 방수')).to],
          wall: [g('도배').time, g('도배').hours, g('도배').icsUid, g('도배').icsBy || ''], done: document.querySelectorAll('#hjCalSyncDone [data-csd-row="new"]').length };
        closeModal(true); return out; });
      assert.equal(a.n, 3);
      assert.deepEqual(a.snaps.filter(x => x === '구글 캘린더 맞추기 전'), ['구글 캘린더 맞추기 전'], '안전판 1회(기존 반영 경로)');
      assert.deepEqual(a.bath, ['2026-11-16', '가온아파트', 'r2@google.com', '2026-11-18'], '현장 표시·uid·여러 날 — ' + JSON.stringify(a.bath));
      assert.deepEqual(a.wall, ['09:00', 8, 'r3@google.com', 'gemini'], '시각·시간 수·@ 제미나이 — ' + JSON.stringify(a.wall));
      assert.equal(a.done, 3, '반영 뒤 바뀐 일정 알리기 창(v581)');
      // 토큰은 이 창 메모리에만 — 기기 저장(IDB) 뒤에 IDB·localStorage·sessionStorage·저장본 전부 훑는다(훑기가 실제로 자료를 보는지도 확인)
      const scan = await page.evaluate(async () => {
        await new Promise(r => setTimeout(r, 1200)); await __appStateWriteQueue;
        const dump = []; const dbs = await indexedDB.databases();
        for (const d of dbs) { const db = await new Promise((res, rej) => { const q = indexedDB.open(d.name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
          for (const st of [...db.objectStoreNames]) { const tx = db.transaction(st, 'readonly'), os = tx.objectStore(st);
            const [ks, vs] = await Promise.all([new Promise(r => { const q = os.getAllKeys(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); }), new Promise(r => { const q = os.getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); })]);
            dump.push(JSON.stringify(ks), JSON.stringify(vs)); }
          db.close(); }
        const ls = Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)).join('\n'), ss = Object.keys(sessionStorage).map(k => k + '=' + sessionStorage.getItem(k)).join('\n');
        const idb = dump.join('\n');
        return { idbHasData: idb.includes('욕실 방수'), idbTok: /FAKE-CAL-TOKEN/.test(idb), lsTok: /FAKE-CAL-TOKEN/.test(ls), ssTok: /FAKE-CAL-TOKEN/.test(ss), serTok: /FAKE-CAL-TOKEN/.test(JSON.stringify(serializeData())), mem: typeof __calTok === 'string' && /FAKE-CAL-TOKEN/.test(__calTok) };
      });
      assert.ok(scan.idbHasData, '훑기가 기기 저장본을 실제로 읽음 — ' + JSON.stringify(scan));
      assert.deepEqual([scan.idbTok, scan.lsTok, scan.ssTok, scan.serTok], [false, false, false, false], '토큰이 저장소에 없음 — ' + JSON.stringify(scan));
      assert.ok(scan.mem, '메모리에는 있다(다시 누르면 권한 창 없이)');
      assert.equal(network.gWrites, 0, '구글에 쓰는 요청 0');
    });
    await test('③ 실패 — API 꺼짐 · 401 한 번 다시 · 계속 401 · 거부·닫음 · 오프라인 · 끊김 · 8쪽 상한 · 늦은 응답 — 자료 불변 (FAIL)', async () => {
      await page.evaluate(SEED_READ);
      const before = await sched(page);
      const fresh = async () => { await page.evaluate(() => { closeModal(true); hjCalApiDropToken(); __gis.mode = 'ok'; hjCalSyncView(); }); network.gCalls.length = 0; };
      // 403 Calendar API 꺼짐
      await fresh(); api.mode = '403off';
      let r = await readVia(page);
      assert.ok(r.state === 'error' && /Google Calendar API/.test(r.msg) && /사용 설정/.test(r.msg) && /\.ics 파일·붙여 넣기/.test(r.msg) && !r.plan && r.body === '', 'API 꺼짐 안내 — ' + JSON.stringify(r));
      assert.equal(await page.evaluate(() => typeof __calTok === 'string'), true, 'API 꺼짐은 토큰 탓이 아니라 그대로 둔다');
      // 403 권한 부족 — 다른 안내, 토큰 버림
      api.mode = '403scope'; r = await readVia(page);
      assert.ok(r.state === 'error' && /허용되지 않았/.test(r.msg) && !/Google Calendar API/.test(r.msg), r.msg);
      assert.equal(await page.evaluate(() => __calTok), null, '권한 부족이면 토큰을 버린다');
      // 401 한 번 → 토큰 버리고 한 번만 다시(권한 창은 prompt 없이)
      await fresh(); api.mode = '401once'; api.n401 = 0; api.pages = [READ_P1];
      const reqs0 = await page.evaluate(() => __gis.reqs.length);
      r = await readVia(page);
      const reqs = await page.evaluate(n => __gis.reqs.slice(n), reqs0);
      assert.ok(r.state === 'ok' && r.plan && /2개 읽었어요/.test(r.msg), '401 뒤 다시 읽음 — ' + JSON.stringify(r));
      assert.deepEqual(reqs, ['consent', ''], '두 번째 토큰은 다시 묻지 않는 쪽 — ' + JSON.stringify(reqs));
      assert.equal(network.gCalls.length, 2);
      assert.notEqual(network.gCalls[0].auth, network.gCalls[1].auth, '새 토큰으로 다시');
      // 계속 401 — 딱 한 번만 다시
      await fresh(); api.mode = '401always';
      r = await readVia(page);
      assert.ok(r.state === 'error' && /만료/.test(r.msg) && !r.plan, r.msg);
      assert.equal(network.gCalls.length, 2, '한 번만 다시 — ' + network.gCalls.length);
      // 권한 거부·창 닫음 — 요청 0
      await fresh(); api.mode = 'ok'; await page.evaluate(() => { __gis.mode = 'deny'; });
      r = await readVia(page);
      assert.ok(r.state === 'error' && /로그인이 취소되었습니다/.test(r.msg) && !r.plan, r.msg);
      await page.evaluate(() => { __gis.mode = 'close'; }); r = await readVia(page);
      assert.ok(r.state === 'error' && /로그인이 취소되었습니다/.test(r.msg), r.msg);
      assert.equal(network.gCalls.length, 0, '권한이 없으면 요청 없음');
      // 오프라인 — 권한 창도 안 띄움
      await fresh(); await context.setOffline(true);
      const n0 = await page.evaluate(() => __gis.reqs.length);
      r = await page.evaluate(() => { document.getElementById('csGoogle').click(); const m = document.getElementById('csGoogleMsg'); return { msg: m.textContent, state: m.dataset.state }; });
      assert.ok(r.state === 'error' && /인터넷에 연결되지 않아/.test(r.msg), r.msg);
      assert.equal(await page.evaluate(() => __gis.reqs.length), n0, '오프라인이면 권한 창 없음');
      await context.setOffline(false);
      // 네트워크 끊김(요청 실패)
      api.mode = 'abort'; r = await readVia(page);
      assert.ok(r.state === 'error' && /인터넷에 연결되지 않아/.test(r.msg), r.msg);
      // 8쪽 상한
      await fresh(); api.mode = 'endless'; r = await readVia(page);
      assert.equal(network.gCalls.length, 8, '최대 8쪽 — ' + network.gCalls.length);
      assert.ok(r.state === 'ok' && /앞쪽 8개만/.test(r.msg), r.msg);
      // 창을 닫은 뒤 늦은 응답은 버린다
      await fresh(); api.mode = 'slow'; api.slow = 600; api.pages = [READ_P1];
      await page.evaluate(() => { document.getElementById('csGoogle').click(); });
      await page.waitForFunction(() => /읽는 중/.test((document.getElementById('csGoogleMsg') || {}).textContent || ''));
      await page.evaluate(() => closeModal(true));
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => !!window.__hjCalSyncPlan || !!document.getElementById('hjCalSync')), false, '닫은 창에 늦게 그리지 않음');
      assert.equal(await sched(page), before, '실패해도 일정표 그대로');
      assert.equal(network.gWrites, 0);
      api.mode = 'ok';
      await page.evaluate(() => closeModal(true));
    });
    await test('④ 구글 우선 — 짧아짐 체크 · 이어지는 날 · 같은 날 짝 먼저 · 따로 된 하루짜리 · uid 짝 · 반영·결과 창 (GOOGLE-FIRST)', async () => {
      await page.evaluate(SEED_PLAN);
      const p = await page.evaluate(items => { const before = JSON.stringify(serializeData().schedule); const P = hjCalSyncPlan(hjCalApiEvents(items));
        return { rows: P.rows.map(x => [x.status, x.app ? x.app.id : '', x.date, x.to || '', x.title, x.check, !!x.rename, !!x.shorter]), text: Object.fromEntries(P.rows.map(x => [(x.app ? x.app.id : x.title), hjCalSyncRowText(x)])),
          st: P.stats, unchanged: before === JSON.stringify(serializeData().schedule) }; }, PLAN_ITEMS);
      assert.deepEqual(p.rows, [
        ['new', '', '2026-11-13', '', '주간 회의', true, false, false],
        ['new', '', '2026-11-20', '', '주간 회의', true, false, false],      // 반복 회차는 같은 날만 uid 짝 — 지난 회의(W1 11/6)를 옮기지 않음
        ['new', '', '2026-11-29', '', '마감 청소', true, false, false],      // 합성 uid 'gcal:…' 은 짝을 짓지 않음
        ['span', 'K', '2026-12-01', '2026-12-02', '목공', true, false, true],   // 구글이 앱보다 짧아도 체크된 채
        ['rename', 'U2', '2026-11-26', '', '실리콘 마감', true, false, false],
        ['move', 'M', '2026-11-16', '', '방수', true, false, false],          // 시작을 앞당긴 구글 일정이 M 과 짝 — 18 일(이어지는 날)이 M 을 써 버리지 않았다
        ['move', 'U5', '2026-11-23', '', '필름 시공', true, true, false],     // 같은 uid — 날짜·제목 둘 다
        ['move', 'U1', '2026-12-15', '', '줄눈', true, false, false],         // 같은 uid — 33일(±21일 넘음)
        ['apponly', 'C1', '2026-11-28', '', '청소', false, false, false]], JSON.stringify(p.rows));
      assert.deepEqual([p.st.same, p.st.cont, p.st.api, p.st.read, p.st.skipped], [9, 3, 19, 19, 3],
        '이미 같음 9(S·14 이어짐·18 이어짐·D1·D2·23 이어짐·P1·P2·U3) · 이어지는 날 3 · 받은 19 · 건너뜀(생일·메일 예약·취소) 3 — ' + JSON.stringify(p.st));
      assert.match(p.text.K, /^12\/1\(화\) 종일 목공 — 기간 ~12\/4\(금\) → ~12\/2\(수\) \(구글 기간대로 줄여요\)$/, p.text.K);
      assert.match(p.text.U2, /^11\/26\(목\) 종일 실리콘 마감 — 제목 ‘실리콘’ → ‘실리콘 마감’$/, p.text.U2);
      assert.match(p.text.U5, /^11\/23\(월\) 종일 필름 시공 — 날짜 11\/19\(목\) → 11\/23\(월\) · 제목 ‘필름’ → ‘필름 시공’$/, p.text.U5);
      assert.match(p.text.U1, /^12\/15\(화\) 종일 줄눈 — 날짜 11\/12\(목\) → 12\/15\(화\)$/, p.text.U1);
      assert.ok(p.unchanged, '계획은 읽기만');
      // 같은 날 짝이 이어지는 날보다 먼저 — D2(11/21 하루짜리)가 D1(20~23)의 이어지는 날에 묻히지 않는다(앱에만 줄 없음)
      assert.ok(!p.rows.some(x => x[1] === 'D2' || x[1] === 'P2' || x[1] === 'S' || x[1] === 'U3'), 'D2·P2·S·U3 는 이미 같음');
      // 시간 바뀐 이름 줄 글(시각·기간을 같이 싣는 경우)
      const t2 = await page.evaluate(() => hjCalSyncRowText({ status: 'rename', date: '2026-11-26', time: '09:00', to: '', title: '실리콘 마감', timeChg: true, app: { id: 'U2', date: '2026-11-26', time: '', to: '', title: '실리콘' } }));
      assert.equal(t2, '11/26(목) 09:00 실리콘 마감 — 제목 ‘실리콘’ → ‘실리콘 마감’ · 시간 종일 → 09:00');
      // 창으로 읽고 반영(기본 체크 그대로 — 앱에만 줄은 체크 해제라 지우는 확인 창 없음)
      api.mode = 'ok'; api.pages = [PLAN_ITEMS];
      await page.evaluate(() => { hjCalApiDropToken(); hjCalSyncView(); });
      const rr = await readVia(page);
      assert.ok(rr.state === 'ok' && /19개 읽었어요/.test(rr.msg), rr.msg);
      const v = await page.evaluate(() => ({ sum: document.querySelector('[data-cs-sum]').innerText.replace(/\s+/g, ' '), checks: [...document.querySelectorAll('#csBody .csChk')].map(c => c.checked),
        rename: (document.querySelector('#csBody [data-cs-row="rename"]') || {}).innerText || '' }));
      assert.ok(v.sum.includes('제목 바뀜 1') && v.sum.includes('날짜 옮김 3') && v.sum.includes('이미 같음 9') && v.sum.includes('이어지는 날 3건 포함') && v.sum.includes('기간 다름 1'), v.sum);
      assert.deepEqual(v.checks, [true, true, true, true, true, true, true, true, false], JSON.stringify(v.checks));
      assert.ok(v.rename.replace(/\s+/g, ' ').trim().startsWith('✏️ 제목 바뀜'), v.rename);
      await page.click('#csApply');
      await page.waitForSelector('#hjCalSyncDone');
      const a = await page.evaluate(() => { const g = id => state.schedule.find(s => s.id === id), sp = id => { const x = hjSchSpan(g(id)); return [x.from, x.to, x.days]; };
        const out = { n: state.schedule.length,
          S: [g('S').date, g('S').memo], M: [g('M').date, g('M').memo, sp('M')], K: [g('K').memo, sp('K')], D: [g('D1').date, g('D2').date, g('P1').memo, g('P2').date],
          U1: [g('U1').date, g('U1').title], U2: [g('U2').date, g('U2').title, g('U2').time], U3: [g('U3').date, g('U3').title], U5: [g('U5').date, g('U5').title], C1: [g('C1').date, g('C1').title],
          news: state.schedule.filter(s => !['S', 'M', 'D1', 'D2', 'P1', 'P2', 'K', 'U1', 'U2', 'U3', 'U5', 'C1', 'W1'].includes(s.id)).map(s => [s.date, s.title, s.icsUid]).sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1])),
          tile14: state.schedule.filter(s => s.date === '2026-11-14').length,
          done: [...document.querySelectorAll('#hjCalSyncDone [data-csd-row]')].map(x => [x.dataset.csdRow, x.dataset.id]),
          ren: (document.querySelector('#hjCalSyncDone [data-csd-row="rename"]') || {}).innerHTML || '',
          titleOnly: !!document.querySelector('#hjCalSyncDone [data-csd-row="rename"] [data-csd-titleonly]') };
        return out; });
      assert.equal(a.n, 16, '새 일정 3(회의 2·마감 청소)만 늘었다 — ' + a.n);
      assert.deepEqual(a.S, ['2026-11-13', '2026-11-13~2026-11-14 (2일)'], '이어지는 날 — 타일 그대로');
      assert.equal(a.tile14, 0, '11/14 에 새 타일 일정이 생기지 않음');
      assert.deepEqual(a.M, ['2026-11-16', '2026-11-16~2026-11-18 (3일)\n방수 2회', ['2026-11-16', '2026-11-18', 3]], JSON.stringify(a.M));
      assert.deepEqual(a.K, ['2026-12-01~2026-12-02 (2일)', ['2026-12-01', '2026-12-02', 2]], '구글 기간대로 줄임 — ' + JSON.stringify(a.K));
      assert.deepEqual(a.D, ['2026-11-20', '2026-11-21', '', '2026-11-25'], '따로 된 미장 둘은 늘리지 않음 — ' + JSON.stringify(a.D));
      assert.deepEqual([a.U1, a.U2, a.U3, a.U5, a.C1], [['2026-12-15', '줄눈'], ['2026-11-26', '실리콘 마감', ''], ['2026-11-27', '도장'], ['2026-11-23', '필름 시공'], ['2026-11-28', '청소']], JSON.stringify([a.U1, a.U2, a.U3, a.U5, a.C1]));
      assert.deepEqual(a.news, [['2026-11-13', '주간 회의', 'evt-weekly@google.com'], ['2026-11-20', '주간 회의', 'evt-weekly@google.com'], ['2026-11-29', '마감 청소', 'gcal:2026-11-28|청소']], JSON.stringify(a.news));
      assert.ok(a.done.some(x => x[0] === 'rename' && x[1] === 'U2') && /<s>실리콘<\/s>/.test(a.ren) && a.titleOnly, '결과 창 ✏️ 줄 · 옛 제목 · 고객 글에서 뺌 — ' + a.ren);
      await page.evaluate(() => closeModal(true));
      // 다시 읽으면 바꿀 것 없음(앱에만 C1 만 남음)
      const again = await page.evaluate(items => hjCalSyncPlan(hjCalApiEvents(items)).rows.map(x => [x.status, x.app ? x.app.id : x.title]), PLAN_ITEMS);
      assert.deepEqual(again, [['apponly', 'C1']], '다시 읽으면 앱에만 C1 만 — ' + JSON.stringify(again));
    });
    await context.close();
    await test('⑤ 폰 390 — 넘침 없음 · 44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED_PLAN);
      api.mode = 'ok'; api.pages = [PLAN_ITEMS];
      await m.page.evaluate(() => hjCalSyncView());
      const rr = await readVia(m.page);
      assert.equal(rr.state, 'ok', rr.msg);
      const r = await m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal');
        const small = [...root.querySelectorAll('#hjCalSync button,#hjCalSync select,#hjCalSync label,.mfoot button')].filter(b => b.getClientRects().length).map(b => [b.tagName, b.id || b.className, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[2] < 43.9);
        const wide = [...root.querySelectorAll('#hjCalSync *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => el.tagName + '#' + el.id).slice(0, 5);
        return { rows: root.querySelectorAll('[data-cs-row]').length, small, wide, over: document.documentElement.scrollWidth - innerWidth, g: document.getElementById('csGoogle').getBoundingClientRect().height }; });
      assert.ok(r.rows === 9 && r.wide.length === 0 && r.over <= 1 && r.g >= 44, '넘침 없음 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px 미만 — ' + JSON.stringify(r.small));
      await m.context.close();
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
      assert.equal(network.gWrites, 0, '구글에 쓰는 요청 0');
      assert.ok(!TOKEN_RE.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), '앱 소스에 가짜 토큰 글자 없음');
    });
    console.log(`calapi-v588: ${passed}/5 PASS; synthetic data · fixed clock · fake GIS/googleapis; external writes=${network.writes}; google writes=${network.gWrites}`);
  } catch (error) {
    console.error('FAIL calapi-v588 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
