/** ============================================================
 * 만물인테리어 — 일정 알림(Watchdog) watch-v6 · 구글 캘린더 일정 맞추기 + 매일 9시 내일 일정 알림
 * ------------------------------------------------------------
 * 목적: 사장님이 앱을 열지 않아도 **스스로 깨어나** 현장데이터를 훑고
 *       ① 앱 일정표의 실제 작업 일정을 구글 캘린더에 일정 하나씩 그대로 넣고(watch-v5)
 *       ② 매일 오전 9시에 '[일정 알림] 내일 … 일정 n건'으로 다음날 일정을 요약해 알린다(watch-v6).
 *       구글 서버에서 도므로 폰·PC가 꺼져 있어도 동작한다.
 *
 * watch-v6 (2026-11-12 대표 요청 "[파수꾼] 이름을 '일정 알림'으로. 매일 오전 9시에 다음날 일정을 요약해서 알려 주고,
 *           다음날 일정이 없으면 알림을 보내지 않게"):
 *   · 내일 일정 = 앱 일정표의 작업 일정(여러 날 공정의 이어지는 날 'N/M일째' 포함) + 기본 캘린더의 내일 일정(제미나이 '@' 일정 등).
 *     같은 일정이 두 쪽에 있으면 한 줄로(이 스크립트가 맞춘 태그 일정은 앱 일정으로 이미 센다, 제목 핵심이 겹치고 시각이 같거나 없으면 같은 일정).
 *   · 빼는 것: 💰 수금·입금·잔금·계약금·중도금·미수, 세금 자동, 앱이 넣은 개인 일정, 생일·근무지·부재중·집중 시간, 거절한 초대,
 *     '[일정 알림]'·'[파수꾼]' 일정 자신. 금액·고객 이름·전화·메모·설명 칸은 쓰지 않는다(제목·시각·현장·담당·장소만).
 *   · 알림은 기본 캘린더에 30분짜리 '[일정 알림] …' 일정 + 시작 시각 팝업. 8시대에 돌면 9:00 시작으로 미리 꽂아 9시에 정확히 울리고,
 *     9시가 지나서 돌면 5분 뒤 시작(지난 시각 일정은 폰이 울리지 않는다). 8시~11시대 안에서 하루 한 번만(스크립트 속성 ALERT_SENT + 오늘 캘린더).
 *     그 사이 내일 일정이 없으면 보내지 않는다 — 10시에 내일 일정이 생기면 그때 보낸다.
 *   · 예전 '[파수꾼]' 요약(WATCH_SUMMARY=1)은 그대로 선택 사항. 앱 캘린더 맞추기·v588 바로 읽기는 '[일정 알림]' 일정을 앱 일정으로 들이지 않는다.
 *
 * watch-v5 (2026-11-04 현장 요청 "파수꾼을 보내지 말고 실제 일정만 구글 캘린더에 보내게"):
 *   · 매일 아침 꽂던 '[파수꾼] 📅 오늘 작업 …' 요약 일정은 더 만들지 않는다.
 *     (예전 요약이 다시 필요하면 스크립트 속성 WATCH_SUMMARY=1 — 하루 한 번 WATCH_HOUR 시에만)
 *   · 대신 앱 일정 하나 = 캘린더 일정 하나. 시각이 있으면 그 시각(앱 '작업 시간', 없으면 8시간), 없으면 종일.
 *     여러 날 공정은 날마다 하나(앱 📤 작업자 캘린더 .ics 와 같은 꼴 — 일요일·완료 보고 뒤는 없음).
 *     앱에서 일정을 고치면 그 일정을 고치고, 지우면 지운다(매시간 맞춘다).
 *   · 넣지 않는 것(watch-v4 와 같다): 💰 수금·입금·잔금 일정, 세금 자동, 앱이 넣은 개인 일정(sourceUid).
 *     금액·고객 이름·전화 칸은 쓰지 않고, 메모는 출입 번호처럼 보이는 토막과 금액 토막을 뺀다.
 *   · 이 스크립트가 만든 일정(일정 태그 hjKey)만 고치고 지운다. 사장님이 직접 넣은 일정·예전 [파수꾼] 일정은 건드리지 않고,
 *     같은 날 같은 작업을 사장님이 이미 넣어 두었으면 하나 더 만들지 않는다.
 *   · 맞추는 범위: 오늘 기준 31일 전 ~ 180일 뒤. 그보다 지난 일정은 기록으로 그대로 둔다.
 *     원하는 일정이 하나도 없는데 지울 것이 넷 이상이면(자료가 비어 읽힌 경우 등) 지우지 않고 기다린다.
 *
 * watch-v4 (2026-11-03 현장 요청 "구글 캘린더에 금액·수금 내용은 안 오게, 작업 일정 관련으로"):
 *   · 캘린더 내용 = 작업 일정 — 오늘·내일 작업(여러 날 공정은 'N/M일째'), 다가오는 7일 작업, 밀린 AS.
 *   · 💰 수금·입금·잔금 일정, 세금 자동 일정, 앱이 넣은 개인 일정(sourceUid)은 어디에도 넣지 않는다. 금액도 쓰지 않는다.
 *   · 보증 만료·방치 현장 알림은 기본에서 뺐다(방치 목록이 길어 작업 일정이 묻혔다) — WATCH_SECTIONS='all' 이면 예전처럼 붙는다.
 *
 * ★ 절대 규칙 — 이 파일은 현장데이터.json을 **읽기만** 한다.
 *   쓰기(setContent/createFile/setTrashed)를 절대 하지 않는다.
 *   사장님 데이터를 건드리지 않으므로 파수꾼 때문에 자료가 상할 일이 없다.
 *
 * 예전 요약 알림(WATCH_SUMMARY=1 일 때만)의 전달 방법(WATCH_CHANNEL):
 *   'calendar' (기본) 구글 캘린더에 '[파수꾼] …' 일정으로 꽂는다.
 *   'sheet'           구글 시트 '파수꾼 현황판'에 날짜별로 쌓는다.
 *   'both'            캘린더 + 시트 둘 다
 *   'mail'            메일(옛 방식). 원할 때만 명시적으로 선택.
 *
 * 설치(딱 한 번):
 *   1) 편집기에서 함수 선택 → installDailyWatch → 실행 → 권한 승인
 *   2) 끝. 이후 매시간 앱 일정과 캘린더를 맞추고, 8~11시대에 내일 일정 알림을 하루 한 번 보낸다.
 *   지금 바로 맞추고 알림도 다시 보내 보려면 testWatchNow 를 실행한다(내일 일정이 없으면 알림은 만들지 않는다).
 *
 * 설정(선택 · 프로젝트 설정 ▸ 스크립트 속성):
 *   WATCH_OFF     '1' 이면 멈춤(트리거는 그대로)
 *   ALERT_OFF     '1' 이면 매일 9시 '[일정 알림]'만 멈춤(캘린더 맞추기는 그대로)
 *   ALERT_HOUR    일정 알림 시각(0~23). 기본 9 (오전 9시)
 *   WATCH_CALSYNC '0' 이면 앱 일정 → 구글 캘린더 맞추기를 멈춤(이미 넣은 일정은 그대로 둔다)
 *   WATCH_CAL_ID  일정을 넣을 캘린더 ID. 미설정 시 이 계정의 기본 캘린더
 *   WATCH_SUMMARY '1' 이면 예전 '[파수꾼]' 요약도 하루 한 번 보낸다(기본 끔)
 *   WATCH_CHANNEL 일정 알림·요약을 보낼 곳 'calendar'(기본) | 'sheet' | 'both' | 'mail'
 *   WATCH_HOUR    요약을 보낼 시각(0~23). 기본 7 (오전 7시)
 *   WATCH_EMAIL   'mail' 일 때 받는 사람. 미설정 시 이 스크립트 소유자 계정
 *   WATCH_SECTIONS 'work'(기본: 작업 일정 + 밀린 AS) | 'all'(+ 보증 만료·방치 현장)
 * ============================================================ */

var WATCH_VERSION = 'watch-v6';
var WATCH_FN = 'dailyWatch';
var WATCH_SHEET_NAME = '파수꾼 현황판';
var WATCH_TAG = '[파수꾼]';        // 예전 요약 일정 제목 접두 — 중복 정리에 사용
// watch-v6 매일 9시 내일 일정 알림 — 제목 접두(앱 맞추기 hjCalSyncSkip 이 이 접두를 건너뛴다 — 바꾸면 앱도 같이)
var ALERT_TAG = '[일정 알림]';
var ALERT_SHEET_NAME = '일정 알림 현황판';
var ALERT = { hour: 9, leadHours: 1, windowHours: 3, maxLines: 30, minutes: 30, lateStartMin: 5 };
// watch-v5 캘린더 일정 맞추기 — 이 스크립트가 만든 일정에 붙이는 태그(사장님 일정과 구분)
var WATCH_KEY_TAG = 'hjKey';       // 앱 일정 id(여러 날 공정의 이어지는 날은 id-dN)
var WATCH_SIG_TAG = 'hjSig';       // 넣은 내용의 지문 — 앱에서 바뀐 일정만 고친다
var WATCH_SYNC = { backDays: 31, aheadDays: 180, defaultHours: 8, maxHours: 24, holdDeletes: 3 };

// 판단 기준 — 1인 시공사 기준으로 잡은 값. 필요하면 여기 숫자만 바꾸면 된다.
var W = {
  warrantySoon: 60,     // 보증 만료 D-N 이내 → 무상점검 제안 = 재수주 기회
  asStale: 3,           // AS 접수 후 N일 넘게 미처리
  projStale: 21,        // 진행 중인데 N일 넘게 아무 움직임 없음
  aheadDays: 7          // '다가오는 작업' — 모레부터 N일 안
};
// 작업 일정이 아닌 것 — 💰 수금·입금·잔금 일정(앱이 만든 것은 모두 💰 로 시작). 세금 자동(_taxAuto)·앱이 넣은 개인 일정(sourceUid)도 뺀다.
var WATCH_MONEY_RE = /^\s*💰|수금|입금|잔금|계약금|중도금|미수/;
var WATCH_PLAN_SUFFIX_RE = /\s*\(\d+일차 시작\)\s*$/;   // 앱 🗓 공정표가 붙이는 꼬리
var WATCH_RANGE_MEMO_RE = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/;   // 공정표 메모 '시작~끝 (N일)'
function watchSections_() { return String(cfgW_('WATCH_SECTIONS', 'work')).toLowerCase() === 'all' ? 'all' : 'work'; }
// ※ '견적 무응답' 감시는 아직 없다. 현장데이터의 quotes 를 읽어야 하는데 watchScan_ 은
//   projects·files·asLog·schedule 만 본다. 넣을 때 이 주석을 지울 것.
//   (기준값만 선언해 두면 '되고 있다'는 오해를 부르므로 선언하지 않는다)

/* ---------- 설치 / 제거 ---------- */

// watch-v5: 매시간 돈다 — 앱에서 넣은 일정이 늦어도 한 시간 안에 캘린더에 뜬다(예전 매일 트리거는 지우고 다시 만든다).
// watch-v6: 같은 트리거가 8~11시대에 내일 일정 알림도 하루 한 번 보낸다(트리거를 따로 만들지 않는다).
function installDailyWatch() {
  removeDailyWatch();
  ScriptApp.newTrigger(WATCH_FN).timeBased().everyHours(1).create();
  var extra = (watchAlertOn_() ? ' · 매일 ' + watchAlertHour_() + '시 내일 일정 알림' : '') +
              (watchSummaryOn_() ? ' · 예전 요약도 매일 ' + watchSummaryHour_() + '시경' : '');
  Logger.log('일정 알림 설치 완료 — 매시간 앱 작업 일정을 구글 캘린더에 맞춤' + extra);
  return '설치 완료: 매시간 · 구글 캘린더 일정 맞추기' + extra;
}

function removeDailyWatch() {
  var all = ScriptApp.getProjectTriggers(), n = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WATCH_FN) { ScriptApp.deleteTrigger(all[i]); n++; }
  }
  Logger.log('기존 일정 알림(dailyWatch) 트리거 ' + n + '개 제거');
  return n;
}

// 지금 즉시 한 번 돌려 캘린더를 맞춘다(설치 확인용). 내일 일정 알림도 시각과 무관하게 다시 만든다(내일 일정이 없으면 안 만든다).
// 요약을 켰으면(WATCH_SUMMARY=1) 요약도 시각과 무관하게 보낸다.
function testWatchNow() { return dailyWatch(true); }

/* ---------- 매시간 실행되는 본체 ---------- */

function dailyWatch(force) {
  if (!force && cfgW_('WATCH_OFF', '') === '1') { Logger.log('WATCH_OFF=1 — 건너뜀'); return 'off'; }

  var data;
  try { data = watchLoadData_(); }
  catch (err) {
    var why = String(err && err.message || err).slice(0, 200);
    Logger.log('⚠️ 현장자료를 읽지 못했습니다 — 캘린더는 그대로 둡니다: ' + why);
    if (watchSummaryOn_()) {
      watchDeliver_('⚠️ 파수꾼: 현장자료를 읽지 못했습니다',
        '오늘 현장데이터를 읽지 못했습니다.\n중계서버 설정(DRIVE_FOLDER_ID·파일명)을 확인해 주세요.\n\n사유: ' + why, null);
    }
    return 'load-failed';
  }
  if (!data) {
    Logger.log('현장데이터 파일 없음 — 건너뜀');
    return 'no-data';
  }

  var out = [];
  if (cfgW_('WATCH_CALSYNC', '') === '0') out.push('sync-off');
  else {
    try {
      var s = watchCalSync_(data, watchCalendar_(), new Date());
      out.push('sync +' + s.created + ' ~' + s.updated + ' -' + s.deleted + ' =' + s.kept +
               (s.skipped ? ' 이미있음 ' + s.skipped : '') + (s.held ? ' 지우기보류 ' + s.held : ''));
    } catch (e) {
      Logger.log('⚠️ 캘린더 일정 맞추기 실패: ' + e);
      out.push('sync-failed');
    }
  }
  // 맞추기가 실패해도 알림은 따로 — 알림이 맞추기 실패에 묻히지 않게
  try { out.push(watchAlertRun_(data, CalendarApp.getDefaultCalendar(), new Date(), force)); }
  catch (e2) { Logger.log('⚠️ 일정 알림 실패: ' + e2); out.push('alert-failed'); }
  if (watchSummaryOn_()) out.push(watchSummaryRun_(data, force));
  Logger.log('일정 알림 ' + WATCH_VERSION + ' — ' + out.join(' · '));
  return out.join(' · ');
}

/* ---------- 매일 9시 내일 일정 알림 (watch-v6) ---------- */

function watchAlertOn_() { return cfgW_('ALERT_OFF', '') !== '1'; }
function watchAlertHour_() {
  var hour = parseInt(cfgW_('ALERT_HOUR', String(ALERT.hour)), 10);
  return (isNaN(hour) || hour < 0 || hour > 23) ? ALERT.hour : hour;
}
// 8~11시대(알림 시각 한 시간 전 ~ 세 시간 뒤)에 하루 한 번. 내일 일정이 없으면 보내지 않고, 창 안에서 다시 볼 때 생겼으면 그때 보낸다.
function watchAlertRun_(data, cal, now, force) {
  if (!force && !watchAlertOn_()) return 'alert-off';
  if (!cal) throw new Error('기본 캘린더를 찾지 못했습니다');
  var hour = watchAlertHour_(), h = now.getHours();
  if (!force && (h < hour - ALERT.leadHours || h >= hour + ALERT.windowHours)) return 'alert-later';
  var today0 = new Date(now.getTime()); today0.setHours(0, 0, 0, 0);
  var todayYmd = watchYmd_(today0), tmr = watchYmdAdd_(todayYmd, 1);
  var sent = watchAlertSentToday_(cal, today0);
  if (!force && (sent.length || cfgW_('ALERT_SENT', '') === todayYmd)) return 'alert-done';
  var events = [];
  try { events = cal.getEvents(watchDate_(tmr), watchDate_(watchYmdAdd_(tmr, 1))); }
  catch (e) { Logger.log('내일 캘린더 일정을 읽지 못했습니다 — 앱 일정만 봅니다: ' + e); }
  var items = watchAlertItems_(data, events, tmr);
  if (!items.length) { Logger.log('내일(' + tmr + ') 일정 없음 — 일정 알림을 보내지 않습니다'); return 'alert-none'; }
  for (var i = 0; i < sent.length; i++) watchDel_(sent[i]);   // testWatchNow 로 다시 보낼 때 — 오늘 알림은 하나만
  var start = new Date(today0.getTime()); start.setHours(hour, 0, 0, 0);
  if (start.getTime() < now.getTime() + 60000) start = new Date(now.getTime() + ALERT.lateStartMin * 60000);
  var subject = watchAlertSubject_(items, tmr), text = watchAlertText_(items, tmr);
  var done = watchAlertDeliver_(cal, subject, text, start, items, tmr);
  if (done.length) {
    try { PropertiesService.getScriptProperties().setProperty('ALERT_SENT', todayYmd); } catch (_) {}
  }
  return done.length ? 'alert-sent:' + items.length : 'alert-failed';
}
// 오늘 이미 꽂아 둔 '[일정 알림]' 일정
function watchAlertSentToday_(cal, today0) {
  var out = [];
  try {
    var evs = cal.getEvents(today0, new Date(today0.getTime() + 86400000));
    for (var i = 0; i < evs.length; i++) { if (String(evs[i].getTitle() || '').indexOf(ALERT_TAG) === 0) out.push(evs[i]); }
  } catch (_) {}
  return out;
}
// 내일 일정 목록(순수 계산 — 캘린더 일정 배열을 받는다). [{time, title, project, crew, loc, cont, days, to, src}]
function watchAlertItems_(data, events, tmr) {
  var items = [], schedule = watchArr_(data && data.schedule);
  for (var s = 0; s < schedule.length; s++) {
    var sc = schedule[s];
    if (!watchWorkOk_(sc)) continue;
    var ds = String(sc.date), cont = tmr === ds ? null : watchContOn_(sc, tmr);
    if (tmr !== ds && !cont) continue;
    var it = watchWorkItem_(sc, '내일', tmr, cont, watchSpan_(sc));
    it.src = 'app'; it.key = watchAlertKey_(it.title);
    items.push(it);
  }
  var evs = watchArr_(events);
  for (var e = 0; e < evs.length; e++) {
    var c = watchAlertCalItem_(evs[e], tmr);
    if (!c || !c.key) continue;
    var dup = false;
    for (var k = 0; k < items.length && !dup; k++) dup = watchAlertSame_(items[k], c);
    if (!dup) items.push(c);
  }
  items.sort(function (a, b) {
    var x = (a.time || '') + '\u0001' + a.title, y = (b.time || '') + '\u0001' + b.title;
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  return items;
}
var ALERT_SKIP_TYPES = { BIRTHDAY: 1, FOCUS_TIME: 1, OUT_OF_OFFICE: 1, WORKING_LOCATION: 1, FROM_GMAIL: 1 };
// 캘린더 일정 하나 → 알림 줄(빼는 것은 null). 이 스크립트가 맞춘 태그 일정은 앱 일정으로 이미 세므로 뺀다.
function watchAlertCalItem_(ev, tmr) {
  var title, allDay, start;
  try {
    if (ev.getTag(WATCH_KEY_TAG)) return null;
    title = String(ev.getTitle() || '').replace(/\s+/g, ' ').trim();
    allDay = ev.isAllDayEvent();
    start = allDay ? ev.getAllDayStartDate() : ev.getStartTime();
  } catch (_) { return null; }
  if (!title || title.indexOf(ALERT_TAG) === 0 || title.indexOf(WATCH_TAG) === 0 || WATCH_MONEY_RE.test(title)) return null;
  try { var ty = ev.getEventType && ev.getEventType(); if (ty && ALERT_SKIP_TYPES[String(ty)]) return null; } catch (_) {}
  try { if (String(ev.getMyStatus && ev.getMyStatus()) === 'NO') return null; } catch (_) {}   // 거절한 초대
  if (/happy birthday|^생일|생일$/i.test(title)) return null;
  var before = !allDay && start && watchYmd_(start) < tmr;   // 오늘 시작해 자정을 넘기는 일정
  var time = (!allDay && start && !before) ? ('0' + start.getHours()).slice(-2) + ':' + ('0' + start.getMinutes()).slice(-2) : '';
  var shown = title.replace(/^@\s*/, '') + (before ? ' (이어서)' : '');
  var tagM = shown.match(/^\[([^\]]+)\]/);
  var loc = ''; try { loc = String(ev.getLocation() || '').replace(/\s+/g, ' ').trim(); } catch (_) {}
  if (watchLooksLikeAccess_(loc) || WATCH_MONEY_FRAG_RE.test(loc)) loc = '';
  return { src: 'cal', time: time, title: shown, project: '', tagProj: tagM ? tagM[1] : '', crew: '', loc: loc.slice(0, 60), cont: null, days: 1, to: tmr,
           key: watchAlertKey_(shown.replace(/\s*\(이어서\)$/, '')) };
}
// 같은 일정인지 볼 열쇠 — '@'·'[현장명]'·공정표 꼬리·'(N/M일째)'·'(N일 · ~M/D)' 를 떼고 글자·숫자만
function watchAlertKey_(t) {
  return watchNorm_(String(t || '').replace(/^\s*@\s*/, '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(WATCH_PLAN_SUFFIX_RE, '')
    .replace(/\s*\((?:\d+\/\d+일째|\d+일 · ~[^)]*)\)\s*$/, ''));
}
// 앱 일정과 캘린더 일정이 같은 일정 — 제목 핵심이 같거나 한쪽이 다른 쪽을 품고(두 글자 이상), 시각이 같거나 한쪽이 종일,
// 캘린더 제목에 '[현장명]' 이 있으면 그 현장이 앱 일정의 현장과 맞아야 한다(다른 현장의 같은 '철거'를 한 줄로 합치지 않게)
function watchAlertSame_(a, b) {
  var x = a.key, y = b.key;
  if (!x || !y || x.length < 2 || y.length < 2) return false;
  if (!(x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0)) return false;
  var pa = watchNorm_(a.project), pb = watchNorm_(b.tagProj);
  if (pa && pb && pa.indexOf(pb) < 0 && pb.indexOf(pa) < 0) return false;
  return !a.time || !b.time || a.time === b.time;
}
function watchAlertSubject_(items, tmr) { return '내일 ' + watchMdDow_(tmr) + ' 일정 ' + items.length + '건'; }
// 본문 — 줄마다 시각(없으면 종일)·제목·여러 날·현장·담당·장소. 금액·고객 이름·전화·메모는 쓰지 않는다.
function watchAlertText_(items, tmr) {
  var L = ['내일 ' + watchMdDow_(tmr) + ' 일정 ' + items.length + '건', ''];
  for (var i = 0; i < items.length && i < ALERT.maxLines; i++) {
    var it = items[i];
    L.push('· ' + (it.src === 'app' ? watchWorkLine_(it, false) : (it.time || '종일') + ' ' + it.title + (it.loc ? ' / 📍 ' + it.loc : '')));
  }
  if (items.length > ALERT.maxLines) L.push('· …외 ' + (items.length - ALERT.maxLines) + '건');
  L.push('', '— 만물인테리어 일정 알림(자동). 현장 앱 일정표와 구글 캘린더에서 모았어요. 내일 일정이 없는 날은 오지 않습니다.');
  return L.join('\n');
}
function watchAlertDeliver_(cal, subject, text, start, items, tmr) {
  var ch = String(cfgW_('WATCH_CHANNEL', 'calendar')).toLowerCase();
  var done = [];
  if (ch === 'calendar' || ch === 'both' || (ch !== 'sheet' && ch !== 'mail')) {
    try {
      var ev = cal.createEvent(ALERT_TAG + ' ' + subject, start, new Date(start.getTime() + ALERT.minutes * 60000), { description: text });
      try { ev.addPopupReminder(0); } catch (_) {}
      done.push('calendar');
    } catch (e) { Logger.log('일정 알림 캘린더 실패: ' + e); }
  }
  if (ch === 'sheet' || ch === 'both') {
    try {
      var ss = watchSheetFileNamed_(ALERT_SHEET_NAME), sh = ss.getSheets()[0];
      if (sh.getLastRow() === 0) { sh.appendRow(['보낸 날', '내일', '건수', '내용']); sh.setFrozenRows(1); }
      sh.appendRow([watchYmd_(new Date()), tmr, items.length, text]);
      done.push('sheet');
    } catch (e) { Logger.log('일정 알림 시트 실패: ' + e); }
  }
  if (ch === 'mail') {
    try {
      var to = watchRecipient_();
      if (!to) throw new Error('받는 사람을 알 수 없습니다');
      MailApp.sendEmail({ to: to, subject: ALERT_TAG + ' ' + subject, body: text, name: '만물인테리어 일정 알림' });
      done.push('mail');
    } catch (e) { Logger.log('일정 알림 메일 실패: ' + e); }
  }
  if (!done.length) Logger.log('⚠️ 일정 알림 전달 실패 — WATCH_CHANNEL=' + ch);
  else Logger.log('일정 알림 전달: ' + done.join('+') + ' / ' + subject);
  return done;
}

// 예전 '[파수꾼]' 요약 — 기본 끔(2026-11-04 요청). WATCH_SUMMARY=1 일 때만, 매시간 돌아도 하루 한 번 WATCH_HOUR 시에만 보낸다.
function watchSummaryOn_() { return cfgW_('WATCH_SUMMARY', '') === '1'; }
function watchSummaryHour_() {
  var hour = parseInt(cfgW_('WATCH_HOUR', '7'), 10);
  return (isNaN(hour) || hour < 0 || hour > 23) ? 7 : hour;
}
function watchSummaryRun_(data, force) {
  var now = new Date();
  if (!force && now.getHours() !== watchSummaryHour_()) return 'summary-later';
  var r = watchScan_(data);
  // 오늘·내일 작업이나 밀린 AS 가 있으면 보낸다('all' 이면 보증·방치 경보도 센다).
  // 조용한 날은 매일 알리지 않는다(알림 피로 방지). 월요일에만 "이상 없음" 확인.
  if (watchQuiet_(r) && !force && now.getDay() !== 1) { Logger.log('이상 없음 — 요약 생략'); return 'summary-quiet'; }
  watchDeliver_(watchSubject_(r), watchText_(r), r);
  return 'summary-sent:' + r.total;
}

/* ---------- 알리는 방법 — 메일·카톡을 쓰지 않는 것이 기본 ---------- */

function watchDeliver_(subject, text, r) {
  var ch = String(cfgW_('WATCH_CHANNEL', 'calendar')).toLowerCase();
  var done = [];
  if (ch === 'calendar' || ch === 'both') {
    try { watchToCalendar_(subject, text); done.push('calendar'); }
    catch (e) { Logger.log('캘린더 실패: ' + e); }
  }
  if (ch === 'sheet' || ch === 'both') {
    try { watchToSheet_(subject, r); done.push('sheet'); }
    catch (e) { Logger.log('시트 실패: ' + e); }
  }
  if (ch === 'mail') {
    try { watchToMail_(subject, text); done.push('mail'); }
    catch (e) { Logger.log('메일 실패: ' + e); }
  }
  // 어느 방법도 성공하지 못하면 조용히 사라지지 않게 로그로 남긴다.
  if (!done.length) Logger.log('⚠️ 알림 전달 실패 — WATCH_CHANNEL=' + ch);
  else Logger.log('알림 전달: ' + done.join('+') + ' / ' + subject);
  return done;
}

/* ① 구글 캘린더 — 폰 기본 캘린더 알림이 울린다(메일함·앱 불필요) */
function watchToCalendar_(subject, text) {
  var cal = CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('기본 캘린더를 찾지 못했습니다');
  var now = new Date();

  // 같은 날 이미 꽂아둔 파수꾼 일정은 지운다(하루 여러 번 돌아도 중복되지 않게)
  try {
    var todays = cal.getEventsForDay(now);
    for (var i = 0; i < todays.length; i++) {
      if (String(todays[i].getTitle() || '').indexOf(WATCH_TAG) === 0) todays[i].deleteEvent();
    }
  } catch (_) {}

  // 30분짜리 일정 + 즉시 팝업 알림 → 폰이 바로 울린다
  var end = new Date(now.getTime() + 30 * 60000);
  var ev = cal.createEvent(WATCH_TAG + ' ' + subject, now, end, { description: text });
  try { ev.addPopupReminder(0); } catch (_) {}
  return ev.getId();
}

/* ② 구글 시트 현황판 — 만물인테리어 폴더 안에 날짜별로 쌓는다 */
function watchToSheet_(subject, r) {
  var ss = watchSheetFile_();
  var sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(['날짜', '요약', 'AS', '보증임박', '방치', '상세']);
    sh.setFrozenRows(1);
  }
  var detail = r ? watchText_(r) : '';
  sh.appendRow([
    watchYmd_(new Date()), subject,
    r ? r.as.length : 0,
    r ? r.warranty.length : 0, r ? r.stale.length : 0, detail
  ]);
  // 최신이 위로 오게 정렬하지 않고 append 유지 — 이력 추적이 목적
  return ss.getUrl();
}

// 현황판 스프레드시트를 만물인테리어 폴더 안에서 찾거나 새로 만든다.
// ※ 현장데이터.json 은 절대 건드리지 않는다. 별도 파일만 만든다.
function watchSheetFile_() { return watchSheetFileNamed_(WATCH_SHEET_NAME); }
function watchSheetFileNamed_(name) {
  var root = rootFolder_();
  var it = root.getFilesByName(name);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  var ss = SpreadsheetApp.create(name);
  var f = DriveApp.getFileById(ss.getId());
  try { root.addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (_) {}
  return ss;
}

/* ③ 메일 — 기본 아님. WATCH_CHANNEL='mail' 일 때만. */
function watchToMail_(subject, text) {
  var to = watchRecipient_();
  if (!to) throw new Error('받는 사람을 알 수 없습니다');
  MailApp.sendEmail({ to: to, subject: subject, body: text, name: '만물인테리어 파수꾼' });
}

/* ---------- 자료 읽기 (읽기 전용) ---------- */

function watchLoadData_() {
  var root = rootFolder_();                       // Code.gs 의 헬퍼 재사용
  var it = root.getFilesByName(dataFileName_());
  if (!it.hasNext()) return null;
  var text = it.next().getBlob().getDataAsString('UTF-8');
  var data = JSON.parse(text);
  if (!data || typeof data !== 'object') return null;
  return data;
}

/* ---------- 순수 계산 — state 변형 없음, 테스트 가능 ----------
   앱(index.html)의 파생 규칙을 그대로 옮긴 것:
   · 견적 중복 제거(estimateGroups) → 같은 현장에서 같은 견적을 두 번 세지 않음
   · 보증 = project.warranty.items 우선, 없으면 doneAt + 1년             */

function watchScan_(data) {
  var today = watchToday0_();
  var projects = watchArr_(data.projects), files = watchArr_(data.files);
  var asLog = watchArr_(data.asLog), schedule = watchArr_(data.schedule);

  var lastTouch = watchLastTouch_(files, schedule);

  var r = { warranty: [], as: [], stale: [], today: [], total: 0 };

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    if (!p || !p.name || p.archived) continue;
    var name = String(p.name);
    var doneAt = p.doneAt ? String(p.doneAt) : '';

    // ② 보증 만료 임박 — 무상점검 제안 = 재수주 기회
    var wr = watchWarranty_(p, today);
    if (wr && wr.dday >= 0 && wr.dday <= W.warrantySoon) {
      r.warranty.push({ name: name, dday: wr.dday, end: wr.end,
                        phone: watchPhone_(p), customer: watchCustName_(p) });
    }

    // ④ 방치 현장 — 진행 중(완료 전)인데 오래 아무 움직임이 없음
    if (!doneAt) {
      var touched = lastTouch[name] || null;
      var idle = touched ? watchDaysSince_(touched, today) : null;
      if (idle !== null && idle >= W.projStale) {
        // est·recv 는 아무 데서도 쓰지 않아 함께 뺐다(미수금 제거 2026-08-13).
        r.stale.push({ name: name, days: idle, last: touched });
      }
    }
  }

  // ③ AS 미처리 — 접수됐는데 안 끝난 것
  var asMap = {};
  for (var a = 0; a < asLog.length; a++) {
    var it2 = asLog[a];
    if (!it2 || it2.status === 'done') continue;
    var pn = String(it2.project || '');
    if (!pn) continue;
    var d = it2.date ? watchDaysSince_(String(it2.date), today) : null;
    if (!asMap[pn]) asMap[pn] = { name: pn, count: 0, days: null, latest: '', phone: '' };
    var m = asMap[pn];
    m.count++;
    if (d !== null && (m.days === null || d > m.days)) m.days = d;
    if (!m.latest && it2.text) m.latest = String(it2.text);
  }
  var projByName = {};
  for (var pi = 0; pi < projects.length; pi++) { if (projects[pi] && projects[pi].name) projByName[String(projects[pi].name)] = projects[pi]; }
  for (var k in asMap) {
    if (!asMap.hasOwnProperty(k)) continue;
    var m2 = asMap[k];
    m2.phone = watchPhone_(projByName[m2.name]);   // 알림에서 바로 전화 걸 수 있게
    if (m2.days === null || m2.days >= W.asStale) r.as.push(m2);
  }

  // ⑤ 오늘·내일 작업 — 오늘 뭐 하는지 아침에 알려준다(watch-v4: 작업 일정만 — 💰·세금·개인 일정 제외).
  //    여러 날 공정은 이어지는 날에도 'N/M일째' 로 넣는다(앱 v354 와 같은 셈: 일요일 제외, 완료 보고면 끝).
  var todayStr = watchYmd_(today);
  var tmr = new Date(today.getTime() + 86400000), tmrStr = watchYmd_(tmr);
  var aheadEnd = watchYmd_(new Date(today.getTime() + W.aheadDays * 86400000));
  r.ahead = [];
  for (var s = 0; s < schedule.length; s++) {
    var sc = schedule[s];
    if (!watchWorkOk_(sc)) continue;
    var ds = String(sc.date), sp = watchSpan_(sc);
    var days = [[todayStr, '오늘'], [tmrStr, '내일']];
    for (var q = 0; q < days.length; q++) {
      var ymd = days[q][0], cont = ymd === ds ? null : watchContOn_(sc, ymd);
      if (ymd === ds || cont) r.today.push(watchWorkItem_(sc, days[q][1], ymd, cont, sp));
    }
    if (ds > tmrStr && ds <= aheadEnd) r.ahead.push(watchWorkItem_(sc, '', ds, null, sp));
  }

  r.warranty.sort(function (x, y) { return x.dday - y.dday; });
  r.as.sort(function (x, y) { return (y.days || 0) - (x.days || 0); });
  r.stale.sort(function (x, y) { return y.days - x.days; });
  r.today.sort(function (x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
  r.ahead.sort(function (x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });

  // '오늘 일정'은 경보가 아니라 안내 — total(경보 수)에 넣지 않는다
  r.total = r.warranty.length + r.as.length + r.stale.length;
  return r;
}

/* 견적 합계(현장별) — 앱의 estimateGroups 중복제거 규칙을 옮김 */
function watchDedupeSum_(list) {
  function norm(nm) {
    return String(nm || '').toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s*[-_]?\s*견적(서)?.*$/, '')
      .replace(/\s*의?\s*사본.*$/, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .replace(/[\d,]{5,}\s*$/, '').replace(/\s*-\s*\d+\s*$/, '')
      .replace(/[\s,]/g, '').trim();
  }
  function isX(f) { return /\.xlsx?$/i.test(String(f.name || '')); }
  function amtOf(f) { return watchNum_(f.est && f.est.amount); }

  var groups = {};
  for (var i = 0; i < list.length; i++) {
    var f = list[i], amt = amtOf(f);
    var key = norm(f.name);
    if (!key || key.length < 2) key = 'amt:' + amt;
    var when = f.when ? new Date(f.when).getTime() : 0;
    if (!groups[key]) { groups[key] = { rep: f, amt: amt, when: when }; continue; }
    var g = groups[key];
    // 대표 선정: 엑셀(원본) 우선 → 금액 큰 것 → 최신
    var better = (isX(f) && !isX(g.rep)) ||
                 (isX(f) === isX(g.rep) && (amt > g.amt || (amt === g.amt && when > g.when)));
    if (better) { g.rep = f; g.amt = amt; g.when = when; }
  }
  // 2차 병합: 이름이 달라도 같은 금액이면 같은 견적으로 본다(앱과 동일 규칙)
  var seenAmt = {}, sum = 0;
  for (var k in groups) {
    if (!groups.hasOwnProperty(k)) continue;
    var a = groups[k].amt;
    if (!a) continue;
    if (seenAmt[a]) continue;
    seenAmt[a] = true;
    sum += a;
  }
  return sum;
}

/* ---------- 작업 일정 (watch-v4) — 순수 계산 ---------- */

// 작업 일정인가 — 💰 수금·입금 일정, 세금 자동, 앱이 넣은 개인 일정은 아니다
function watchWorkOk_(sc) {
  if (!sc || !sc.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(sc.date))) return false;
  if (sc._taxAuto || sc.sourceUid) return false;
  return !WATCH_MONEY_RE.test(String(sc.title || ''));
}
// 앱 hjSchSpan 과 같은 셈 — 기간은 공정표 메모 '시작~끝' 에서만(첫 날이 그 일정 날짜일 때, 60일 이하)
function watchSpan_(sc) {
  var from = String((sc && sc.date) || ''), m = String((sc && sc.memo) || '').match(WATCH_RANGE_MEMO_RE);
  if (!m || m[1] !== from || !(m[2] > m[1]) || watchDaysBetween_(m[1], m[2]) > 60) return { from: from, to: from, days: 1 };
  return { from: from, to: m[2], days: watchWorkDays_(m[1], m[2]) + 1 };
}
function watchReported_(sc) {
  var rp = sc && sc.report;
  return !!(rp && (rp.progress === '완료' || String(rp.done || '').replace(/\s+/g, '')));
}
// 그날이 그 일정의 '이어지는 날'이면 {day, days, to} — 일요일·완료 보고·기간 밖은 null
function watchContOn_(sc, ymd) {
  if (!sc || !sc.date || !(ymd > String(sc.date)) || watchReported_(sc)) return null;
  var sp = watchSpan_(sc);
  if (sp.days < 2 || ymd > sp.to) return null;
  var d = new Date(ymd + 'T00:00:00');
  if (isNaN(d.getTime()) || d.getDay() === 0) return null;
  return { day: watchWorkDays_(sp.from, ymd) + 1, days: sp.days, to: sp.to };
}
function watchDaysBetween_(a, b) {
  var x = new Date(String(a) + 'T00:00:00'), y = new Date(String(b) + 'T00:00:00');
  if (isNaN(x.getTime()) || isNaN(y.getTime())) return 0;
  return Math.round((y - x) / 86400000);
}
// from 다음 날부터 to 까지 일요일을 뺀 날 수(앱 hjWorkDaysBetween 의 앞 방향)
function watchWorkDays_(from, to) {
  var a = new Date(String(from) + 'T00:00:00'), b = new Date(String(to) + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a || (b - a) > 3660 * 86400000) return 0;
  var end = watchYmd_(b), d = new Date(a.getTime()), n = 0, guard = 0;
  while (watchYmd_(d) !== end && guard++ < 4000) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n++; }
  return n;
}
function watchWorkItem_(sc, when, ymd, cont, sp) {
  return { when: when, date: ymd, time: String(sc.time || ''),
           title: String(sc.title || '작업').replace(WATCH_PLAN_SUFFIX_RE, '') || '작업',
           project: String(sc.project || ''), crew: String(sc.crew || '').replace(/\s+/g, ' ').trim(),
           cont: cont || null, days: sp ? sp.days : 1, to: sp ? sp.to : ymd };
}
// 한 줄 — 시각(없으면 종일) · 작업 · 여러 날이면 'N/M일째' 또는 'N일 · ~M/D' · 현장 · 담당. 금액은 쓰지 않는다.
function watchWorkLine_(it, withDate) {
  return (withDate ? watchMdDow_(it.date) + ' ' : '') + (it.time || '종일') + ' ' + it.title +
    (it.cont ? ' (' + it.cont.day + '/' + it.cont.days + '일째)' : (it.days > 1 ? ' (' + it.days + '일 · ~' + watchMdDow_(it.to) + ')' : '')) +
    (it.project ? ' / ' + it.project : '') + (it.crew ? ' / 👤 ' + it.crew : '');
}
function watchMdDow_(ymd) {
  var d = new Date(String(ymd) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(ymd || '');
  return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + ')';
}
function watchOfDay_(r, when) { var out = []; for (var i = 0; i < r.today.length; i++) if (r.today[i].when === when) out.push(r.today[i]); return out; }
// 조용한 날 — 오늘·내일 작업도, 밀린 AS 도 없다('all' 이면 보증·방치 경보까지 없을 때)
function watchQuiet_(r) {
  if (r.today.length || r.as.length) return false;
  return watchSections_() === 'all' ? r.total === 0 : true;
}

/* 현장별 마지막 손댄 날 — '방치 현장' 판정 근거 */
function watchLastTouch_(files, schedule) {
  var out = {};
  function bump(pn, ymd) {
    if (!pn || !ymd) return;
    if (!out[pn] || ymd > out[pn]) out[pn] = ymd;
  }
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!f || !f.project || !f.when) continue;
    bump(String(f.project), String(f.when).slice(0, 10));
  }
  for (var s = 0; s < schedule.length; s++) {
    var sc = schedule[s];
    if (!sc || !sc.project || !sc.date) continue;
    bump(String(sc.project), String(sc.date).slice(0, 10));
  }
  return out;
}

/* 보증 — project.warranty.items 우선, 없으면 doneAt + 1년 (앱 hjWarranty 규칙) */
function watchWarranty_(p, today) {
  var w = p && p.warranty;
  if (w && typeof w === 'object' && w.items && w.items.length) {
    var latest = '';
    for (var i = 0; i < w.items.length; i++) {
      var it = w.items[i];
      if (it && it.expiresAt && String(it.expiresAt) > latest) latest = String(it.expiresAt);
    }
    if (latest) {
      var end = new Date(latest + 'T00:00:00');
      return { end: latest, dday: Math.ceil((end - today) / 86400000) };
    }
  }
  if (!p.doneAt) return null;
  var e = new Date(String(p.doneAt) + 'T00:00:00');
  if (isNaN(e.getTime())) return null;
  e.setFullYear(e.getFullYear() + 1);
  return { end: watchYmd_(e), dday: Math.ceil((e - today) / 86400000) };
}

/* ---------- 구글 캘린더 일정 맞추기 (watch-v5) ---------- */

// 일정을 넣을 캘린더 — WATCH_CAL_ID 가 있으면 그 캘린더, 없으면 이 계정의 기본 캘린더(예전 [파수꾼] 일정이 뜨던 곳)
function watchCalendar_() {
  var id = cfgW_('WATCH_CAL_ID', '');
  var cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('캘린더를 찾지 못했습니다' + (id ? ' — WATCH_CAL_ID 를 확인하세요' : ''));
  return cal;
}

// 앱 일정 → 캘린더. 이 스크립트가 만든 일정(태그 hjKey)만 만들고·고치고·지운다. 사장님 일정은 읽기만 한다(같은 일정이 있나 볼 때).
function watchCalSync_(data, cal, now) {
  if (!data || Object.prototype.toString.call(data.schedule) !== '[object Array]') {
    throw new Error('일정표가 없는 자료 — 캘린더를 그대로 둡니다');
  }
  var today = new Date(now.getTime()); today.setHours(0, 0, 0, 0);
  var want = watchCalItems_(data, today);
  var events = cal.getEvents(watchDate_(want.from), watchDate_(watchYmdAdd_(want.to, 1)));
  var mine = {}, others = [];
  for (var i = 0; i < events.length; i++) {
    var key = null;
    try { key = events[i].getTag(WATCH_KEY_TAG); } catch (_) { key = null; }
    if (key) (mine[key] = mine[key] || []).push(events[i]);
    else others.push(events[i]);
  }
  var r = { created: 0, updated: 0, deleted: 0, kept: 0, skipped: 0, held: 0, wanted: want.items.length };
  var wanted = {};
  for (var j = 0; j < want.items.length; j++) {
    var it = want.items[j], sig = watchSig_(it), have = mine[it.key] || [];
    wanted[it.key] = true;
    for (var x = 1; x < have.length; x++) { if (watchDel_(have[x])) r.deleted++; }   // 같은 일정이 둘 이상이면 하나만 남긴다
    if (have.length) {
      var cur = null;
      try { cur = have[0].getTag(WATCH_SIG_TAG); } catch (_) { cur = null; }
      if (cur === sig) { r.kept++; continue; }
      watchCalApply_(have[0], it);
      have[0].setTag(WATCH_SIG_TAG, sig);
      r.updated++;
      continue;
    }
    if (watchCalHasManual_(others, it)) { r.skipped++; continue; }   // 사장님이 이미 넣어 둔 같은 일정 — 하나 더 만들지 않는다
    var ev = watchCalCreate_(cal, it);
    ev.setTag(WATCH_KEY_TAG, it.key);
    ev.setTag(WATCH_SIG_TAG, sig);
    r.created++;
  }
  // 앱에서 지워졌거나 💰·범위 밖으로 바뀐 일정 — 이 스크립트가 만든 것만 지운다.
  var stale = [];
  for (var k in mine) { if (mine.hasOwnProperty(k) && !wanted[k]) stale = stale.concat(mine[k]); }
  if (!want.items.length && stale.length > WATCH_SYNC.holdDeletes) {
    r.held = stale.length;   // 자료가 비어 읽혔을 수 있다 — 한꺼번에 지우지 않고 기다린다
    Logger.log('⚠️ 넣을 일정이 하나도 없는데 지울 일정이 ' + stale.length + '개 — 자료를 확인할 때까지 지우지 않습니다');
  } else {
    for (var s = 0; s < stale.length; s++) { if (watchDel_(stale[s])) r.deleted++; }
  }
  return r;
}

function watchCalCreate_(cal, it) {
  var opt = { description: it.desc };
  if (it.loc) opt.location = it.loc;
  if (it.time) {
    var st = watchDateTime_(it.date, it.time);
    return cal.createEvent(it.title, st, new Date(st.getTime() + it.hours * 3600000), opt);
  }
  return cal.createAllDayEvent(it.title, watchDate_(it.date), opt);
}
function watchCalApply_(ev, it) {
  ev.setTitle(it.title);
  ev.setDescription(it.desc);
  ev.setLocation(it.loc || '');
  if (it.time) {
    var st = watchDateTime_(it.date, it.time);
    ev.setTime(st, new Date(st.getTime() + it.hours * 3600000));   // 종일 일정이었으면 시각 일정으로 바뀐다
  } else {
    ev.setAllDayDate(watchDate_(it.date));                          // 시각 일정이었으면 종일로 바뀐다
  }
}
function watchDel_(ev) {
  try { ev.deleteEvent(); return true; }
  catch (e) { Logger.log('캘린더 일정 지우기 실패: ' + e); return false; }
}
// 사장님이 직접(또는 앱 '📅 구글 캘린더에 추가'로) 넣어 둔 같은 일정 — 같은 날이고 제목에 작업 이름과 현장 이름이 다 들어 있으면 같은 일정으로 본다.
function watchCalHasManual_(others, it) {
  var base = watchNorm_(it.base), proj = watchNorm_(it.project);
  if (base.length < 2 || (!proj && base.length < 4)) return false;
  for (var i = 0; i < others.length; i++) {
    var t, day;
    try {
      t = String(others[i].getTitle() || '');
      day = watchYmd_(others[i].isAllDayEvent() ? others[i].getAllDayStartDate() : others[i].getStartTime());
    } catch (_) { continue; }
    if (t.indexOf(WATCH_TAG) === 0 || t.indexOf(ALERT_TAG) === 0 || day !== it.date) continue;   // 예전 [파수꾼] 요약·[일정 알림]은 같은 일정이 아니다
    var nt = watchNorm_(t);
    if (nt.indexOf(base) >= 0 && (!proj || nt.indexOf(proj) >= 0)) return true;
  }
  return false;
}

// 맞출 범위 안의 앱 작업 일정 → 캘린더에 넣을 일정 목록(순수 계산 — GAS API 없음)
function watchCalItems_(data, today) {
  var t0 = watchYmd_(today);
  var from = watchYmdAdd_(t0, -WATCH_SYNC.backDays), to = watchYmdAdd_(t0, WATCH_SYNC.aheadDays);
  var projects = watchArr_(data && data.projects), schedule = watchArr_(data && data.schedule), byName = {};
  for (var i = 0; i < projects.length; i++) { if (projects[i] && projects[i].name) byName[String(projects[i].name)] = projects[i]; }
  var items = [], seen = {};
  for (var s = 0; s < schedule.length; s++) {
    var sc = schedule[s];
    if (!watchWorkOk_(sc)) continue;
    var sp = watchSpan_(sc), id = watchSchId_(sc), p = byName[String(sc.project || '')] || null;
    var days = [[String(sc.date), null]], more = watchContDates_(sc);
    for (var m = 0; m < more.length; m++) days.push([more[m], watchContOn_(sc, more[m])]);
    for (var d = 0; d < days.length; d++) {
      var ymd = days[d][0], c = days[d][1];
      if (ymd < from || ymd > to || (d > 0 && !c)) continue;
      var key = id + (c ? '-d' + c.day : '');
      if (seen[key]) continue;   // id 가 겹친 일정은 처음 것만
      seen[key] = true;
      items.push(watchCalItem_(sc, ymd, c, sp, p, key));
    }
  }
  items.sort(function (a, b) {
    var x = a.date + (a.time || '99:99') + a.key, y = b.date + (b.time || '99:99') + b.key;
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  return { from: from, to: to, items: items };
}
// 그 일정이 이어지는 날(시작일 다음 날 ~ 끝, 일요일 제외, 완료 보고면 없음) — 앱 hjSchContDates 와 같은 셈
function watchContDates_(sc) {
  if (!sc || !sc.date || watchReported_(sc)) return [];
  var sp = watchSpan_(sc);
  if (sp.days < 2) return [];
  var dt = new Date(String(sp.from) + 'T00:00:00');
  if (isNaN(dt.getTime())) return [];
  var out = [];
  for (var i = 0; i < 62; i++) {
    dt.setDate(dt.getDate() + 1);
    var ds = watchYmd_(dt);
    if (ds > sp.to) break;
    if (dt.getDay() !== 0) out.push(ds);
  }
  return out;
}
function watchSchId_(sc) {
  var id = String((sc && sc.id) || '').trim();
  return id ? id.slice(0, 120) : 'n' + watchHash_([sc.date, sc.time, sc.title, sc.project].join('|'));
}
// 일정 하나 — 제목 '[현장] 작업'(작업 이름에 현장이 이미 있으면 그대로), 시각 있으면 그 시각부터 작업 시간(없으면 8시간), 없으면 종일.
// 설명은 현장·담당·인원·주소·메모(출입 번호·금액 토막 뺌)만. 금액·고객 이름·전화 칸은 쓰지 않는다.
function watchCalItem_(sc, ymd, c, sp, p, key) {
  var base = String(sc.title || '작업').replace(WATCH_PLAN_SUFFIX_RE, '').trim() || '작업';
  var project = String(sc.project || '').trim();
  var title = c ? base + ' (' + c.day + '/' + c.days + '일째)'
                : (sp.days > 1 ? base + ' (' + sp.days + '일 · ~' + watchMdDow_(sp.to) + ')' : base);
  if (project && watchNorm_(base).indexOf(watchNorm_(project)) < 0) title = '[' + project + '] ' + title;
  var time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(sc.time || '')) ? String(sc.time) : '';
  var hours = Number(sc.hours);
  if (!(hours > 0)) hours = WATCH_SYNC.defaultHours;
  if (hours > WATCH_SYNC.maxHours) hours = WATCH_SYNC.maxHours;
  var addr = p && p.customer ? String(p.customer.addr || '').replace(/\s+/g, ' ').trim() : '';
  if (watchLooksLikeAccess_(addr)) addr = '';
  var crew = String(sc.crew || '').replace(/\s+/g, ' ').trim();
  var workers = String(sc.workers == null ? '' : sc.workers).trim();
  var memo = watchMemoSafe_(sc.memo), L = [];
  if (project) L.push('현장: ' + project);
  if (crew) L.push('담당: ' + crew);
  if (/^\d+(\.\d+)?$/.test(workers) && Number(workers) > 0) L.push('예정 인원 ' + workers + '명');
  if (addr) L.push('주소: ' + addr);
  if (memo) L.push('메모: ' + memo);
  L.push('— 만물인테리어 현장 앱 일정(자동). 앱에서 고치거나 지우면 한 시간 안에 여기도 바뀝니다.');
  return { key: key, date: ymd, time: time, hours: time ? hours : 0, title: title, base: base, project: project,
           desc: L.join('\n'), loc: addr };
}
// 출입 번호처럼 보이는 것(앱 hjLooksLikeAccessCode 와 같은 규칙) — 캘린더로 퍼지지 않게
var WATCH_ACCESS_UNIT = 'mm|cm|kg|㎡|m|평|원|층|호|동|년|월|일|대|명|개|건|칸|번|시|분|%|만|천';
var WATCH_ACCESS_CODE_RE = new RegExp('(비밀\\s*번호|비번|도어\\s*락|도어\\s*록|도어키|번호키|마스터\\s*키|공동\\s*현관|현관|출입)' +
  '[^0-9\\n]{0,4}\\d{1,8}(?![0-9])(?!\\s*(?:' + WATCH_ACCESS_UNIT + '))');
var WATCH_ONLY_CODE_RE = /^[\s#*]*\d[\d\s#*]*$/;
// 금액 토막 — 메모에 적힌 '잔금 300만'·'150,000원' 같은 것도 캘린더에는 넣지 않는다(11/3 요청 '금액은 안 오게')
var WATCH_MONEY_FRAG_RE = /수금|입금|잔금|계약금|중도금|미수|금액|견적가|₩|\d[\d,.]*\s*(?:만\s*)?원|\d[\d,.]*\s*만(?![가-힣])/;
function watchLooksLikeAccess_(v) {
  var t = String(v == null ? '' : v);
  if (!t.trim()) return false;
  return WATCH_ONLY_CODE_RE.test(t) || WATCH_ACCESS_CODE_RE.test(t);
}
// 메모를 줄·' / '·' · ' 토막으로 나눠 출입 번호·금액 토막을 빼고 ' · ' 로 잇는다(첫 토막의 공정표 기간 '시작~끝 (N일)' 은 뗀다)
function watchMemoSafe_(memo) {
  var parts = String(memo || '').split(/\n|\s+\/\s+|\s+·\s+/), keep = [];
  for (var i = 0; i < parts.length; i++) {
    var x = String(parts[i] || '').trim();
    if (i === 0) x = x.replace(WATCH_RANGE_MEMO_RE, '').replace(/^\s*\(\d+일\)\s*/, '');
    x = x.replace(/\s+/g, ' ').trim();
    if (!x || watchLooksLikeAccess_(x) || WATCH_MONEY_FRAG_RE.test(x)) continue;
    keep.push(x);
  }
  var out = keep.join(' · ');
  return out.length > 600 ? out.slice(0, 600) + '…' : out;
}
// 넣은 내용의 지문 — 바뀐 일정만 고친다(보안용이 아니라 '바뀌었나' 확인용, FNV-1a 32비트 + 길이)
function watchSig_(it) { return watchHash_([it.title, it.date, it.time, it.hours, it.desc, it.loc].join('\u0001')); }
function watchHash_(s) {
  var str = String(s), h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8) + str.length.toString(36);
}
function watchNorm_(s) { return String(s || '').toLowerCase().replace(/[\s\[\]()@·,.\-_\/#:~—–]+/g, ''); }

/* ---------- 메일 만들기 ---------- */

function watchSubject_(r) {
  var all = watchSections_() === 'all', ahead = r.ahead || [];
  var nT = watchOfDay_(r, '오늘').length, nM = watchOfDay_(r, '내일').length, bits = [];
  if (nT || nM) bits.push('📅 오늘 작업 ' + nT + (nM ? ' · 내일 ' + nM : ''));
  else if (ahead.length) bits.push('📅 다음 작업 ' + watchMdDow_(ahead[0].date));
  if (r.as.length) bits.push('🔧 AS ' + r.as.length);
  if (all && r.warranty.length) bits.push('보증만료 ' + r.warranty.length);
  if (all && r.stale.length) bits.push('방치 ' + r.stale.length);
  return bits.length ? bits.join(' · ') : '✅ 만물인테리어 — 잡힌 작업 없음';
}

/* 캘린더 설명·시트용 순수 텍스트 — HTML 태그 없이 폰에서 바로 읽힌다 */
function watchText_(r) {
  if (!r) return '';
  var L = [];
  var all = watchSections_() === 'all', ahead = r.ahead || [];
  var tday = watchToday0_(), tmr = new Date(tday.getTime() + 86400000);
  L.push(watchYmd_(new Date()) + ' 아침 · 파수꾼이 작업 일정을 살펴봤습니다');
  L.push('');

  var todays = [['오늘', tday], ['내일', tmr]];
  for (var w = 0; w < todays.length; w++) {
    var list = watchOfDay_(r, todays[w][0]);
    L.push('■ ' + todays[w][0] + ' 작업 — ' + watchMdDow_(watchYmd_(todays[w][1])));
    if (!list.length) L.push('  · 잡힌 작업 없음');
    for (var x = 0; x < list.length; x++) L.push('  · ' + watchWorkLine_(list[x], false));
    L.push('');
  }
  if (ahead.length) {
    L.push('■ 다가오는 작업 (' + W.aheadDays + '일 안)');
    for (var y = 0; y < ahead.length && y < 12; y++) L.push('  · ' + watchWorkLine_(ahead[y], true));
    if (ahead.length > 12) L.push('  · 외 ' + (ahead.length - 12) + '건');
    L.push('');
  }

  if (r.as.length) {
    L.push('■ 밀린 AS — 늦을수록 고객 불만이 커집니다');
    for (var j = 0; j < r.as.length; j++) {
      var a = r.as[j];
      L.push('  · ' + a.name + ' : ' + a.count + '건' +
             (a.days !== null ? ' (' + a.days + '일 경과)' : '') +
             (a.phone ? ' / ' + a.phone : '') +
             (a.latest ? ' / ' + String(a.latest).slice(0, 40) : ''));
    }
    L.push('');
  }

  if (all && r.warranty.length) {
    L.push('■ 보증 만료 임박 — 무상점검 제안 = 재수주 기회');
    for (var k = 0; k < r.warranty.length; k++) {
      var v = r.warranty[k];
      L.push('  · ' + v.name + ' : D-' + v.dday + ' (' + v.end + ' 만료)' + (v.phone ? ' / ' + v.phone : ''));
    }
    L.push('');
  }

  if (all && r.stale.length) {
    L.push('■ 멈춰 있는 현장 — ' + W.projStale + '일 넘게 사진도 일정도 없음');
    for (var s = 0; s < r.stale.length; s++) {
      L.push('  · ' + r.stale[s].name + ' : ' + r.stale[s].days + '일째 조용' +
             (r.stale[s].last ? ' (마지막 ' + r.stale[s].last + ')' : ''));
    }
    L.push('');
  }

  L.push('— 파수꾼 ' + WATCH_VERSION + ' · 작업 일정만 알립니다(💰 수금·세금 일정과 금액은 넣지 않음) · 현장자료는 읽기만 합니다');
  return L.join('\n');
}

function watchHtml_(r, data) {
  var css = 'font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif;';
  var h = '<div style="' + css + 'max-width:600px;margin:0 auto;color:#222;line-height:1.6">';
  h += '<div style="background:#0b4ea2;color:#fff;padding:16px 18px;border-radius:12px 12px 0 0">' +
       '<div style="font-size:17px;font-weight:700">만물인테리어 · 오늘의 확인</div>' +
       '<div style="font-size:12px;opacity:.85;margin-top:2px">' + watchYmd_(new Date()) + ' 아침 · 파수꾼이 자동으로 살펴봤습니다</div></div>';
  h += '<div style="border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:16px 18px">';

  if (watchQuiet_(r)) {
    h += '<p style="font-size:15px"><b>오늘·내일 잡힌 작업이 없습니다.</b></p>';
  }

  if (r.as.length) {
    h += watchSec_('🔧 밀린 AS', '접수됐는데 아직 안 끝난 건입니다. 늦을수록 고객 불만이 커집니다');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var j = 0; j < r.as.length; j++) {
      var a = r.as[j];
      h += '<li style="margin-bottom:4px"><b>' + watchEsc_(a.name) + '</b> · ' + a.count + '건' +
           (a.days !== null ? ' · <span style="color:#c0392b">' + a.days + '일 경과</span>' : '') +
           (a.latest ? '<br><span style="color:#888;font-size:12px">' + watchEsc_(a.latest).slice(0, 60) + '</span>' : '') + '</li>';
    }
    h += '</ul>';
  }

  if (watchSections_() === 'all' && r.warranty.length) {
    h += watchSec_('🛡 보증 만료 임박 = 재수주 기회', '만료 전에 "무상 점검 가겠습니다" 연락하면 재공사로 이어지는 자리입니다');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var w2 = 0; w2 < r.warranty.length; w2++) {
      var v = r.warranty[w2];
      h += '<li style="margin-bottom:4px"><b>' + watchEsc_(v.name) + '</b> · <b style="color:#b8860b">D-' + v.dday + '</b> (' + watchEsc_(v.end) + ' 만료)' +
           (v.phone ? ' · ' + watchEsc_(v.phone) : '') + '</li>';
    }
    h += '</ul>';
  }

  if (watchSections_() === 'all' && r.stale.length) {
    h += watchSec_('💤 멈춰 있는 현장', W.projStale + '일 넘게 사진도 일정도 없습니다. 잊고 있는 건 아닌지 확인하세요');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var s2 = 0; s2 < r.stale.length; s2++) {
      var st = r.stale[s2];
      h += '<li style="margin-bottom:4px"><b>' + watchEsc_(st.name) + '</b> · ' + st.days + '일째 조용' +
           (st.last ? ' <span style="color:#888;font-size:12px">(마지막 ' + watchEsc_(st.last) + ')</span>' : '') + '</li>';
    }
    h += '</ul>';
  }

  if (r.today.length) {
    h += watchSec_('📅 오늘·내일 작업', '');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var t = 0; t < r.today.length; t++) {
      var tt = r.today[t];
      h += '<li style="margin-bottom:3px"><b>' + watchEsc_(tt.when) + '</b> ' + watchEsc_(watchWorkLine_(tt, false)) + '</li>';
    }
    h += '</ul>';
  }
  if (r.ahead && r.ahead.length) {
    h += watchSec_('🗓 다가오는 작업 (' + W.aheadDays + '일 안)', '');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var u = 0; u < r.ahead.length && u < 12; u++) h += '<li style="margin-bottom:3px">' + watchEsc_(watchWorkLine_(r.ahead[u], true)) + '</li>';
    h += '</ul>';
  }

  h += '<p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#999">' +
       '파수꾼 ' + WATCH_VERSION + ' · 작업 일정만 알립니다(💰 수금·세금 일정과 금액 제외) · 현장자료를 읽기만 하며 절대 고치지 않습니다.<br>' +
       '기준: AS ' + W.asStale + '일 · 보증 D-' + W.warrantySoon + ' · 방치 ' + W.projStale + '일<br>' +
       '그만 받으시려면 스크립트 속성에 WATCH_OFF=1 을 넣으세요.</p>';
  h += '</div></div>';
  return h;
}

function watchSec_(title, desc) {
  return '<div style="margin:18px 0 8px"><div style="font-size:15px;font-weight:700">' + title + '</div>' +
         (desc ? '<div style="font-size:12px;color:#888">' + desc + '</div>' : '') + '</div>';
}

function watchRecipient_() {
  var e = cfgW_('WATCH_EMAIL', '');
  if (e) return e;
  try { return Session.getEffectiveUser().getEmail(); } catch (_) { return ''; }
}

/* ---------- 잡 헬퍼 ---------- */

function cfgW_(k, d) {
  try { var v = PropertiesService.getScriptProperties().getProperty(k); return (v == null || v === '') ? d : v; }
  catch (_) { return d; }
}
function watchArr_(x) { return Object.prototype.toString.call(x) === '[object Array]' ? x : []; }
function watchNum_(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
function watchToday0_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function watchYmd_(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// 'YYYY-MM-DD' → 그날 0시(스크립트 시간대 — appsscript.json Asia/Seoul), 'HH:MM' 이 있으면 그 시각
function watchDate_(ymd) { return new Date(String(ymd) + 'T00:00:00'); }
function watchDateTime_(ymd, hm) { return new Date(String(ymd) + 'T' + String(hm) + ':00'); }
function watchYmdAdd_(ymd, n) { var d = watchDate_(ymd); d.setDate(d.getDate() + n); return watchYmd_(d); }
function watchDaysSince_(ymd, today) {
  var d = new Date(String(ymd).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((today - d) / 86400000);
}
function watchWon_(n) {
  var s = String(Math.round(watchNum_(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
}
function watchPhone_(p) {
  var c = p && p.customer;
  return (c && c.phone) ? String(c.phone) : '';
}
function watchCustName_(p) {
  var c = p && p.customer;
  return (c && c.name) ? String(c.name) : '';
}
function watchEsc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
