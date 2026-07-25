/** ============================================================
 * 만물인테리어 — 파수꾼(Watchdog) watch-v2
 * ------------------------------------------------------------
 * 목적: 사장님이 앱을 열지 않아도 **매일 스스로 깨어나** 현장데이터를 훑고
 *       돈이 새거나 기회를 놓치는 것을 찾아 알려준다.
 *       구글 서버에서 도므로 폰·PC가 꺼져 있어도 동작한다.
 *
 * ★ 절대 규칙 — 이 파일은 현장데이터.json을 **읽기만** 한다.
 *   쓰기(setContent/createFile/setTrashed)를 절대 하지 않는다.
 *   사장님 데이터를 건드리지 않으므로 파수꾼 때문에 자료가 상할 일이 없다.
 *
 * 알리는 방법(WATCH_CHANNEL) — 메일·카톡을 쓰지 않는 것이 기본이다.
 *   'calendar' (기본) 구글 캘린더에 일정으로 꽂는다. 폰 기본 캘린더 알림이 울리므로
 *                     메일함을 열 필요도, 앱을 켤 필요도 없다.
 *   'sheet'           구글 시트 '파수꾼 현황판'에 날짜별로 쌓는다. 링크만 즐겨찾기 해두면 됨.
 *   'both'            캘린더 + 시트 둘 다
 *   'mail'            메일(옛 방식). 원할 때만 명시적으로 선택.
 *
 * 설치(딱 한 번):
 *   1) 편집기에서 함수 선택 → installDailyWatch → 실행 → 권한 승인
 *   2) 끝. 이후 매일 아침 자동 실행된다.
 *   미리 보려면 testWatchNow 를 실행하면 지금 즉시 반영된다.
 *
 * 설정(선택 · 프로젝트 설정 ▸ 스크립트 속성):
 *   WATCH_CHANNEL 'calendar'(기본) | 'sheet' | 'both' | 'mail'
 *   WATCH_HOUR    실행 시각(0~23). 기본 7 (오전 7시)
 *   WATCH_OFF     '1' 이면 알림 중단(트리거는 그대로)
 *   WATCH_EMAIL   'mail' 일 때 받는 사람. 미설정 시 이 스크립트 소유자 계정
 * ============================================================ */

var WATCH_VERSION = 'watch-v2';
var WATCH_FN = 'dailyWatch';
var WATCH_SHEET_NAME = '파수꾼 현황판';
var WATCH_TAG = '[파수꾼]';        // 캘린더 일정 제목 접두 — 중복 정리에 사용

// 판단 기준 — 1인 시공사 기준으로 잡은 값. 필요하면 여기 숫자만 바꾸면 된다.
var W = {
  dueAfterDone: 14,     // 공사 끝난 지 N일 넘었는데 돈이 안 들어옴 → 독촉
  dueMin: 100000,       // 이 금액 미만 잔액은 무시(반올림 잔돈 노이즈 방지)
  warrantySoon: 60,     // 보증 만료 D-N 이내 → 무상점검 제안 = 재수주 기회
  asStale: 3,           // AS 접수 후 N일 넘게 미처리
  projStale: 21,        // 진행 중인데 N일 넘게 아무 움직임 없음
  quoteSilent: 7        // 견적 낸 지 N일 지났는데 계약도 취소도 아님
};

/* ---------- 설치 / 제거 ---------- */

function installDailyWatch() {
  removeDailyWatch();
  var hour = parseInt(cfgW_('WATCH_HOUR', '7'), 10);
  if (isNaN(hour) || hour < 0 || hour > 23) hour = 7;
  ScriptApp.newTrigger(WATCH_FN).timeBased().atHour(hour).everyDays(1).create();
  var ch = String(cfgW_('WATCH_CHANNEL', 'calendar')).toLowerCase();
  var how = { calendar: '구글 캘린더 일정(폰 알림)', sheet: '구글 시트 현황판',
              both: '캘린더 + 시트', mail: '메일' }[ch] || ch;
  var extra = (ch === 'mail') ? (' → ' + watchRecipient_()) : '';
  Logger.log('파수꾼 설치 완료 — 매일 ' + hour + '시경, 알림 방법: ' + how + extra);
  return '설치 완료: 매일 ' + hour + '시경 · ' + how + extra;
}

function removeDailyWatch() {
  var all = ScriptApp.getProjectTriggers(), n = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === WATCH_FN) { ScriptApp.deleteTrigger(all[i]); n++; }
  }
  Logger.log('기존 파수꾼 트리거 ' + n + '개 제거');
  return n;
}

// 지금 즉시 한 번 돌려 메일을 받아본다(설치 확인용). 조용한 날에도 강제 발송.
function testWatchNow() { return dailyWatch(true); }

/* ---------- 매일 실행되는 본체 ---------- */

function dailyWatch(force) {
  if (!force && cfgW_('WATCH_OFF', '') === '1') { Logger.log('WATCH_OFF=1 — 건너뜀'); return 'off'; }

  var data;
  try { data = watchLoadData_(); }
  catch (err) {
    watchDeliver_('⚠️ 파수꾼: 현장자료를 읽지 못했습니다',
      '오늘 현장데이터를 읽지 못했습니다.\n중계서버 설정(DRIVE_FOLDER_ID·파일명)을 확인해 주세요.\n\n사유: ' +
      String(err && err.message || err).slice(0, 200), null);
    return 'load-failed';
  }
  if (!data) {
    Logger.log('현장데이터 파일 없음 — 건너뜀');
    return 'no-data';
  }

  var r = watchScan_(data);
  var quiet = (r.total === 0);
  // 조용한 날은 매일 알리지 않는다(알림 피로 방지). 월요일에만 "이상 없음" 확인.
  if (quiet && !force && new Date().getDay() !== 1) { Logger.log('이상 없음 — 알림 생략'); return 'quiet'; }

  watchDeliver_(watchSubject_(r), watchText_(r), r);
  return 'sent:' + r.total;
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
    sh.appendRow(['날짜', '요약', '못받은돈(원)', '미수건', 'AS', '보증임박', '방치', '상세']);
    sh.setFrozenRows(1);
  }
  var detail = r ? watchText_(r) : '';
  sh.appendRow([
    watchYmd_(new Date()), subject,
    r ? r.cash : 0, r ? r.due.length : 0, r ? r.as.length : 0,
    r ? r.warranty.length : 0, r ? r.stale.length : 0, detail
  ]);
  // 최신이 위로 오게 정렬하지 않고 append 유지 — 이력 추적이 목적
  return ss.getUrl();
}

// 현황판 스프레드시트를 만물인테리어 폴더 안에서 찾거나 새로 만든다.
// ※ 현장데이터.json 은 절대 건드리지 않는다. 별도 파일만 만든다.
function watchSheetFile_() {
  var root = rootFolder_();
  var it = root.getFilesByName(WATCH_SHEET_NAME);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  var ss = SpreadsheetApp.create(WATCH_SHEET_NAME);
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
   · 미수금 = 견적합계(부가세 포함) - 수금액
   · 보증 = project.warranty.items 우선, 없으면 doneAt + 1년             */

function watchScan_(data) {
  var today = watchToday0_();
  var projects = watchArr_(data.projects), files = watchArr_(data.files);
  var asLog = watchArr_(data.asLog), schedule = watchArr_(data.schedule);

  var estByProj = watchEstimateTotals_(files);
  var lastTouch = watchLastTouch_(files, schedule);

  var r = { due: [], warranty: [], as: [], stale: [], today: [], total: 0, cash: 0 };

  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    if (!p || !p.name || p.archived) continue;
    var name = String(p.name);
    var est = estByProj[name] || 0;
    var recv = watchNum_(p.received);
    var owed = Math.max(est - recv, 0);
    var doneAt = p.doneAt ? String(p.doneAt) : '';

    // ① 미수금 — 공사 끝났는데 돈이 안 들어온 것
    if (owed >= W.dueMin && doneAt) {
      var sinceDone = watchDaysSince_(doneAt, today);
      if (sinceDone !== null && sinceDone >= W.dueAfterDone) {
        r.due.push({ name: name, owed: owed, est: est, recv: recv, days: sinceDone,
                     phone: watchPhone_(p), customer: watchCustName_(p) });
        r.cash += owed;
      }
    }

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
        r.stale.push({ name: name, days: idle, last: touched, est: est, recv: recv });
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
    if (!asMap[pn]) asMap[pn] = { name: pn, count: 0, days: null, latest: '' };
    var m = asMap[pn];
    m.count++;
    if (d !== null && (m.days === null || d > m.days)) m.days = d;
    if (!m.latest && it2.text) m.latest = String(it2.text);
  }
  for (var k in asMap) {
    if (!asMap.hasOwnProperty(k)) continue;
    var m2 = asMap[k];
    if (m2.days === null || m2.days >= W.asStale) r.as.push(m2);
  }

  // ⑤ 오늘·내일 일정 — 오늘 뭐 하는지 아침에 알려준다
  var todayStr = watchYmd_(today);
  var tmr = new Date(today.getTime() + 86400000), tmrStr = watchYmd_(tmr);
  for (var s = 0; s < schedule.length; s++) {
    var sc = schedule[s];
    if (!sc || !sc.date) continue;
    var ds = String(sc.date);
    if (ds === todayStr || ds === tmrStr) {
      r.today.push({ when: ds === todayStr ? '오늘' : '내일', date: ds,
                     time: String(sc.time || ''), title: String(sc.title || ''),
                     project: String(sc.project || '') });
    }
  }

  r.due.sort(function (x, y) { return y.owed - x.owed; });
  r.warranty.sort(function (x, y) { return x.dday - y.dday; });
  r.as.sort(function (x, y) { return (y.days || 0) - (x.days || 0); });
  r.stale.sort(function (x, y) { return y.days - x.days; });
  r.today.sort(function (x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });

  // '오늘 일정'은 경보가 아니라 안내 — total(경보 수)에 넣지 않는다
  r.total = r.due.length + r.warranty.length + r.as.length + r.stale.length;
  return r;
}

/* 견적 합계(현장별) — 앱의 estimateGroups 중복제거 규칙을 옮김 */
function watchEstimateTotals_(files) {
  var byProj = {};
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!f || f.kind !== 'estimate' || f.exSum) continue;
    var pn = String(f.project || '');
    if (!pn) continue;
    (byProj[pn] = byProj[pn] || []).push(f);
  }
  var out = {};
  for (var p in byProj) {
    if (!byProj.hasOwnProperty(p)) continue;
    out[p] = watchDedupeSum_(byProj[p]);
  }
  return out;
}

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

/* 현장별 마지막 움직임(사진·파일·일정 중 가장 최근) */
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

/* ---------- 메일 만들기 ---------- */

function watchSubject_(r) {
  if (r.total === 0) return '✅ 만물인테리어 — 오늘 챙길 것 없음';
  var bits = [];
  if (r.due.length) bits.push('미수금 ' + r.due.length);
  if (r.as.length) bits.push('AS ' + r.as.length);
  if (r.warranty.length) bits.push('보증만료 ' + r.warranty.length);
  if (r.stale.length) bits.push('방치 ' + r.stale.length);
  var head = r.cash > 0 ? ('💰 못 받은 돈 ' + watchWon_(r.cash) + ' · ') : '';
  return '🔔 ' + head + bits.join(' · ');
}

/* 캘린더 설명·시트용 순수 텍스트 — HTML 태그 없이 폰에서 바로 읽힌다 */
function watchText_(r) {
  if (!r) return '';
  var L = [];
  L.push(watchYmd_(new Date()) + ' 아침 · 파수꾼이 자동으로 살펴봤습니다');
  L.push('');

  if (r.total === 0) {
    L.push('챙길 게 없습니다. 미수금·AS·보증만료·방치 현장 모두 이상 없습니다.');
  }

  if (r.due.length) {
    L.push('■ 못 받은 돈 — 공사 끝난 지 ' + W.dueAfterDone + '일 넘음');
    for (var i = 0; i < r.due.length; i++) {
      var d = r.due[i];
      L.push('  · ' + d.name + ' : ' + watchWon_(d.owed) + ' (완료 ' + d.days + '일 경과)' +
             (d.customer ? ' / ' + d.customer : '') + (d.phone ? ' ' + d.phone : ''));
    }
    L.push('  합계 ' + watchWon_(r.cash));
    L.push('');
  }

  if (r.as.length) {
    L.push('■ 밀린 AS — 늦을수록 고객 불만이 커집니다');
    for (var j = 0; j < r.as.length; j++) {
      var a = r.as[j];
      L.push('  · ' + a.name + ' : ' + a.count + '건' +
             (a.days !== null ? ' (' + a.days + '일 경과)' : '') +
             (a.latest ? ' / ' + String(a.latest).slice(0, 40) : ''));
    }
    L.push('');
  }

  if (r.warranty.length) {
    L.push('■ 보증 만료 임박 — 무상점검 제안 = 재수주 기회');
    for (var k = 0; k < r.warranty.length; k++) {
      var v = r.warranty[k];
      L.push('  · ' + v.name + ' : D-' + v.dday + ' (' + v.end + ' 만료)' + (v.phone ? ' / ' + v.phone : ''));
    }
    L.push('');
  }

  if (r.stale.length) {
    L.push('■ 멈춰 있는 현장 — ' + W.projStale + '일 넘게 사진도 일정도 없음');
    for (var s = 0; s < r.stale.length; s++) {
      L.push('  · ' + r.stale[s].name + ' : ' + r.stale[s].days + '일째 조용' +
             (r.stale[s].last ? ' (마지막 ' + r.stale[s].last + ')' : ''));
    }
    L.push('');
  }

  if (r.today.length) {
    L.push('■ 오늘·내일 일정');
    for (var t = 0; t < r.today.length; t++) {
      var tt = r.today[t];
      L.push('  · ' + tt.when + ' ' + tt.time + ' ' + tt.title + (tt.project ? ' / ' + tt.project : ''));
    }
    L.push('');
  }

  L.push('— 파수꾼 ' + WATCH_VERSION + ' · 현장자료를 읽기만 하며 고치지 않습니다');
  return L.join('\n');
}

function watchHtml_(r, data) {
  var css = 'font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif;';
  var h = '<div style="' + css + 'max-width:600px;margin:0 auto;color:#222;line-height:1.6">';
  h += '<div style="background:#0b4ea2;color:#fff;padding:16px 18px;border-radius:12px 12px 0 0">' +
       '<div style="font-size:17px;font-weight:700">만물인테리어 · 오늘의 확인</div>' +
       '<div style="font-size:12px;opacity:.85;margin-top:2px">' + watchYmd_(new Date()) + ' 아침 · 파수꾼이 자동으로 살펴봤습니다</div></div>';
  h += '<div style="border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:16px 18px">';

  if (r.total === 0) {
    h += '<p style="font-size:15px"><b>챙길 게 없습니다.</b> 미수금·AS·보증만료·방치 현장 모두 이상 없습니다. 👍</p>';
  }

  if (r.due.length) {
    h += watchSec_('💰 못 받은 돈', '공사가 끝난 지 ' + W.dueAfterDone + '일이 지났는데 잔금이 안 들어왔습니다');
    h += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    for (var i = 0; i < r.due.length; i++) {
      var d = r.due[i];
      h += '<tr style="border-bottom:1px solid #eee">' +
           '<td style="padding:8px 4px"><b>' + watchEsc_(d.name) + '</b>' +
           (d.customer ? '<br><span style="color:#888;font-size:11px">' + watchEsc_(d.customer) + (d.phone ? ' · ' + watchEsc_(d.phone) : '') + '</span>' : '') + '</td>' +
           '<td style="padding:8px 4px;text-align:right;white-space:nowrap"><b style="color:#c0392b">' + watchWon_(d.owed) + '</b>' +
           '<br><span style="color:#888;font-size:11px">완료 ' + d.days + '일 경과</span></td></tr>';
    }
    h += '</table><p style="margin:8px 0 0;font-size:13px">합계 <b style="color:#c0392b">' + watchWon_(r.cash) + '</b></p>';
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

  if (r.warranty.length) {
    h += watchSec_('🛡 보증 만료 임박 = 재수주 기회', '만료 전에 "무상 점검 가겠습니다" 연락하면 재공사로 이어지는 자리입니다');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var w2 = 0; w2 < r.warranty.length; w2++) {
      var v = r.warranty[w2];
      h += '<li style="margin-bottom:4px"><b>' + watchEsc_(v.name) + '</b> · <b style="color:#b8860b">D-' + v.dday + '</b> (' + watchEsc_(v.end) + ' 만료)' +
           (v.phone ? ' · ' + watchEsc_(v.phone) : '') + '</li>';
    }
    h += '</ul>';
  }

  if (r.stale.length) {
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
    h += watchSec_('📅 오늘·내일 일정', '');
    h += '<ul style="margin:0;padding-left:18px;font-size:13px">';
    for (var t = 0; t < r.today.length; t++) {
      var tt = r.today[t];
      h += '<li style="margin-bottom:3px"><b>' + watchEsc_(tt.when) + '</b> ' + watchEsc_(tt.time) + ' ' +
           watchEsc_(tt.title) + (tt.project ? ' <span style="color:#888">· ' + watchEsc_(tt.project) + '</span>' : '') + '</li>';
    }
    h += '</ul>';
  }

  h += '<p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#999">' +
       '파수꾼 ' + WATCH_VERSION + ' · 현장자료를 읽기만 하며 절대 고치지 않습니다.<br>' +
       '기준: 완료 후 ' + W.dueAfterDone + '일 미수 · AS ' + W.asStale + '일 · 보증 D-' + W.warrantySoon + ' · 방치 ' + W.projStale + '일<br>' +
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
