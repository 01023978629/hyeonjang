/* v595 시각 있는 여러 날 일정의 기간 — AGENTS v580·v588 '안 한 것: 시각 있는 여러 날 일정의 기간'.
   종일 여러 날은 to(끝 날짜)를 읽어 메모 머리 '시작~끝 (N일)'로 넣는데(v576·v580·v588), 시각이 있는 일정은 끝 날짜가 뒤여도 시작일 하루로 읽었다
   — 구글 바로 읽기(hjCalApiEvent)·.ics(hjCalSyncParseIcs)·화면 글(hjCalSyncParseText) 모두. 제미나이가 '11/16 오전 9시 ~ 11/18 오후 6시'로 넣은 사흘 공정이
   앱에서는 하루라 둘째·셋째 날이 대시보드·내 업무·달력에서 사라졌다. 규칙(hjCalSyncTimedRange): 끝이 한국 날짜로 뒤이고 24시간 이상이면 여러 날 —
   to = 끝 날짜(끝이 정확히 0시면 그 전날), 60일 상한, 시작 시각 그대로, 하루 시간 수는 끝 시각이 시작 시각보다 늦을 때만 그 차이(아니면 예전 1).
   24시간이 안 되는 밤샘(22시~새벽 2시)은 예전처럼 하루. 계획·반영은 종일 여러 날과 같은 길(같은 날 짝·⏳ 기간 다름·날짜 옮김 메모 머리·이어지는 날).
   합성 자료(이름은 지어낸 것) · 시계 2026-11-10 10:00 KST 고정 · 구글 로그인(GIS)은 가짜 토큰 클라이언트 · googleapis 응답은 가짜 JSON · 바깥 쓰기 0.
   ① 구글 바로 읽기 — 사흘(+09:00)·이틀(…Z → 한국 시각)·4시간 밤샘 → 읽은 꼴 · 단추로 읽기 → 미리보기 줄 글 → 반영(안전판 1회) → 일정(날짜·시각·시간 수·메모 머리·hjSchSpan·이어지는 날)
      · 밤샘은 하루 · 다시 읽으면 모두 이미 같음(이어지는 날이 새 일정으로 겹치지 않음)
      · v595 검토: 한 시간 뒤 구글에는 앱이 올린 사본(apps-script/Watchdog.gs 를 그대로 돌려 만든 '[현장] 철야 방수 (3일 · ~11/18(수))'·'(2/3일째)'…)도 있다 — 같이 읽어도 줄 0 (API)
   ② .ics — …Z·TZID·떠 있는 시각 · 예전 맞추기가 하루로 넣은 같은 일정(uid)은 ⏳ 기간 다름 · 앱 사흘 공정은 날짜 옮김의 새 끝 · 제미나이 하루짜리는 이어지는 날
      · 밤샘 짝은 이미 같음 · 반영 → 메모 머리 · 다시 견주면 줄 0
      · v595 검토: 예전 맞추기가 1시간으로 넣은 기록은 기간을 늘릴 때 하루 시간 수도 구글대로(줄 글에 보임) · 사람이 고친 시간·미리보기 뒤 고친 시간은 그대로 (ICS)
   ③ 화면 글 — '2026년 11월 16일 오전 9:00~2026년 11월 18일 오후 6:00, …' · 밤샘 · 끝 연도 빠진 꼴('~12월 2일 오전 7:00') · 끝 날짜 없는 꼴은 하루 · 종일·같은 날 시각 줄은 그대로
      · v595 검토: 줄 끝 두 날짜 꼴('오전 9시~오후 6시, …, 2026년 11월 26일~2026년 11월 28일')도 같은 규칙 · '–'(대시)로 이은 시각도 끝 시각을 읽음
        · 화면 글 맞추기가 1시간으로 넣은 기록('gcal:날짜|열쇠')도 하루 시간 수를 구글대로
      · 붙여 넣기 → [읽기] → [반영] → 일정 (TEXT)
   ④ 경계 — 정확히 24시간 · 23시간 30분 · 끝이 0시 · 0시~이튿날 0시 · 60일/61일 · 끝 시각이 시작보다 이름 — 세 읽기가 같은 답 (EDGE)
   ⑤ 폰 390 — 미리보기 넘침 없음·44px · 미리보기는 읽기만 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   ⑥ v595 검토 — 앱이 올린 사본(Watchdog): 24시간짜리 하루 일정(현장 있음·없음)·공정표 공정('도배 (2일차 시작)')의 사본을 구글 바로 읽기·.ics·화면 글로 읽어도
      여러 날로 읽지 않고 맞추기 줄 0 (COPY)
   HJ_V595_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V595_MUTATION —
     no-api-span(구글 바로 읽기에서 규칙을 안 씀)·no-24h(24시간 검사 없앰 — 밤샘이 이틀)·hours-one(하루 시간 수를 늘 1)·no-copy-tail(사본 꼬리를 안 뗌) 은 ①,
     no-ics-span·no-hfix(반영에서 하루 시간 수를 안 고침)·hfix-any(사람이 고친 시간도 고친다고 함)·no-hfix-guard(미리보기 뒤 고친 시간을 덮음) 은 ②,
     no-text-span·no-text-tail(줄 끝 두 날짜 꼴은 하루)·no-dash('–' 를 안 자름) 은 ③, no-midnight(끝 0시도 그날까지)·no-cap(60일 상한 없앰) 은 ④,
     no-plan-tail(공정표 꼬리를 안 뗌)·no-copy-tag(태그 hjKey 를 안 봄)·no-copy-mark(제목 머리 '[현장]'을 안 봄)·no-copy-note(설명 끝줄을 안 봄) 은 ⑥ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-api-span': ['  const tr=s.time&&!hjCalSyncAppCopy(ev.summary,ev.extendedProperties,ev.description)?hjCalSyncTimedRange(s,e):null;', '  const tr=null;'],
  'no-ics-span': ['    const tr=s.time&&!hjCalSyncAppCopy(raw,null,memo)?hjCalSyncTimedRange(s,e):null;', '    const tr=null;'],
  'no-text-span': ['const tr=te&&te.end&&te.date===date&&!hjCalSyncAppCopy(raw)?hjCalSyncTimedRange(', 'const tr=false&&te&&te.end&&te.date===date&&!hjCalSyncAppCopy(raw)?hjCalSyncTimedRange('],
  'no-text-tail': ['te=tm?hjCalSyncRangeOf(tm):(!dateStart&&!allDay&&rg&&end?{date,end}:null);', 'te=tm?hjCalSyncRangeOf(tm):null;'],
  'no-dash': ["times=head.replace(DATE,'').split(HJ_CALSYNC_DASH_RE)", "times=head.replace(DATE,'').split('~')"],
  'no-copy-tail': ["const u=t.replace(HJ_CALSYNC_COPY_TAIL_RE,'').replace(HJ_PLAN_SUFFIX_RE,'').trim();", "const u=t.replace(HJ_PLAN_SUFFIX_RE,'').trim();"],
  'no-plan-tail': ["const u=t.replace(HJ_CALSYNC_COPY_TAIL_RE,'').replace(HJ_PLAN_SUFFIX_RE,'').trim();", "const u=t.replace(HJ_CALSYNC_COPY_TAIL_RE,'').trim();"],
  'no-copy-tag': ['function hjCalSyncAppCopy(raw,xp,memo){return !!(xp&&xp.private&&xp.private.hjKey)||', 'function hjCalSyncAppCopy(raw,xp,memo){return '],
  'no-copy-mark': ["||hjCalSyncTitle(raw).mark==='app'||String(memo||'')", "||String(memo||'')"],
  'no-copy-note': ["||String(memo||'').includes(HJ_CALSYNC_COPY_NOTE);}", ';}'],
  'no-hfix': ['    if(r.hfix>1&&Number(s.hours)===1&&hjSchSpan(s).days>1)s.hours=r.hfix;', ''],
  'hfix-any': ['return ge&&ge.to===to&&Number(a.s.hours)===1&&', 'return ge&&ge.to===to&&'],
  'no-hfix-guard': ['    if(r.hfix>1&&Number(s.hours)===1&&hjSchSpan(s).days>1)s.hours=r.hfix;', '    if(r.hfix>1&&hjSchSpan(s).days>1)s.hours=r.hfix;'],
  'no-24h': ['  if(hjDaysBetween(s.date,e.date)*1440+b-a<1440)return null;', ''],
  'hours-one': ['  return {to,hours:b>a?hjCalSyncHours(s.time,e.time):1};', '  return {to,hours:1};'],
  'no-midnight': ['  const to=b===0?hjAddDays(e.date,-1):e.date;', '  const to=e.date;'],
  'no-cap': ['  if(!(to>s.date)||hjDaysBetween(s.date,to)>60)return null;', '  if(!(to>s.date))return null;']
};
let html = process.env.HJ_V595_BASELINE ? execFileSync('git', ['show', process.env.HJ_V595_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V595_MUTATION) {
  const m = MUT[process.env.HJ_V595_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V595_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V595_MUTATION); html = SRC.replace(m[0], m[1]);
}
// 구글 캘린더 API 일정 모양(합성) — 시각 있는 일정
const T = (id, summary, start, end, extra) => Object.assign({ kind: 'calendar#event', id, iCalUID: id + '@google.com', status: 'confirmed', summary, start: { dateTime: start, timeZone: 'Asia/Seoul' }, end: { dateTime: end, timeZone: 'Asia/Seoul' }, eventType: 'default' }, extra || {});
const API = [
  T('a1', '철야 방수', '2026-11-16T09:00:00+09:00', '2026-11-18T18:00:00+09:00', { location: '가온아파트 3동' }),   // 사흘, 하루 9시간
  T('a2', '야간 배관', '2026-11-19T13:00:00Z', '2026-11-19T17:00:00Z'),                                            // 한국 22:00 → 이튿날 02:00 (4시간 밤샘)
  T('a3', '이틀 타설', '2026-11-20T00:00:00Z', '2026-11-21T08:00:00Z')                                             // 한국 11/20 09:00 → 11/21 17:00 (32시간)
];
const ICS = ['BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:i1@test', 'DTSTART:20261116T000000Z', 'DTEND:20261118T090000Z', 'SUMMARY:철야 방수', 'END:VEVENT',                                   // 한국 09:00 ~ 11/18 18:00
  'BEGIN:VEVENT', 'UID:i2@test', 'DTSTART;TZID=Asia/Seoul:20261119T220000', 'DTEND;TZID=Asia/Seoul:20261120T020000', 'SUMMARY:야간 배관', 'END:VEVENT',   // 밤샘 4시간
  'BEGIN:VEVENT', 'UID:i3@test', 'DTSTART:20261113T090000', 'DTEND:20261116T170000', 'SUMMARY:타일', 'END:VEVENT',                                          // 떠 있는 시각 11/13 ~ 11/16
  'BEGIN:VEVENT', 'UID:i4@test', 'DTSTART;VALUE=DATE:20261117', 'DTEND;VALUE=DATE:20261118', 'SUMMARY:@철야 방수', 'END:VEVENT',                           // 제미나이가 날마다 따로 만든 하루짜리
  'BEGIN:VEVENT', 'UID:i5@test', 'DTSTART;TZID=Asia/Seoul:20261124T090000', 'DTEND;TZID=Asia/Seoul:20261125T170000', 'SUMMARY:이틀 미장', 'END:VEVENT',   // 이틀 · 하루 8시간
  'BEGIN:VEVENT', 'UID:i6@test', 'DTSTART;TZID=Asia/Seoul:20261124T130000', 'DTEND;TZID=Asia/Seoul:20261126T180000', 'SUMMARY:사흘 도장', 'END:VEVENT',   // 사흘 · 하루 5시간
  'END:VCALENDAR'].join('\r\n');
const TEXT = [
  '일정 6개, 11월 16일 (월요일)',
  '2026년 11월 16일 오전 9:00~2026년 11월 18일 오후 6:00, 철야 방수, 홍길동, 위치: 가온아파트 3동,',
  '2026년 11월 19일 오후 10:00~2026년 11월 20일 오전 2:00, 야간 배관, 홍길동, 위치 없음,',
  '2026년 11월 30일 오후 8:00~12월 2일 오전 7:00, 달넘이 야간, 홍길동, 위치 없음,',
  '2026년 11월 21일 오후 7:20~오후 9:30, 저녁 점검, 홍길동, 위치 없음,',
  '종일, 바닥 양생, 홍길동, 위치 없음, 2026년 11월 24일~2026년 11월 25일',
  '오후 2시~오후 4시, 오후 점검, 홍길동, 위치 없음, 2026년 11월 24일',
  // v595 검토 — 줄 끝 두 날짜 꼴(시각 있음) · 그 꼴의 밤샘 · '–' 로 이은 두 날짜 시각 · '–' 로 이은 같은 날 시각 · 화면 글 맞추기가 1시간으로 넣은 기록의 같은 일정
  '오전 9시~오후 6시, 타일 시공, 홍길동, 위치 없음, 2026년 11월 26일~2026년 11월 28일',
  '오후 10시~오전 2시, 밤 보수, 홍길동, 위치 없음, 2026년 11월 26일~2026년 11월 27일',
  '2026년 12월 1일 오전 9:00–2026년 12월 3일 오후 6:00, 대시 철야, 홍길동, 위치 없음,',
  '오후 2시–오후 4시, 대시 점검, 홍길동, 위치 없음, 2026년 11월 25일',
  '2026년 12월 7일 오전 9:00~2026년 12월 9일 오후 5:00, 현관 도장, 홍길동, 위치 없음,'
].join('\n');
// ④ 경계 — [이름, 시작(한국), 끝(한국), 기대 to, 기대 시간 수]
const EDGE = [
  ['정확히 하루', '2026-11-16 10:00', '2026-11-17 10:00', '2026-11-17', 1],
  ['하루 못 미침', '2026-11-16 10:00', '2026-11-17 09:30', '', 1],
  ['끝이 0시', '2026-11-16 09:00', '2026-11-19 00:00', '2026-11-18', 1],
  ['0시부터 0시', '2026-11-16 00:00', '2026-11-17 00:00', '', 1],
  ['60일', '2026-11-16 09:00', '2027-01-15 18:00', '2027-01-15', 9],
  ['61일', '2026-11-16 09:00', '2027-01-16 18:00', '', 1],
  ['끝 시각이 이름', '2026-11-16 09:00', '2026-11-18 08:00', '2026-11-18', 1]
];
const EDGE_API = EDGE.map((x, i) => T('e' + i, x[0], x[1].replace(' ', 'T') + ':00+09:00', x[2].replace(' ', 'T') + ':00+09:00'));
const EDGE_ICS = ['BEGIN:VCALENDAR'].concat(...EDGE.map((x, i) => ['BEGIN:VEVENT', 'UID:e' + i + '@test', 'DTSTART;TZID=Asia/Seoul:' + x[1].replace(/[-:]/g, '').replace(' ', 'T') + '00',
  'DTEND;TZID=Asia/Seoul:' + x[2].replace(/[-:]/g, '').replace(' ', 'T') + '00', 'SUMMARY:' + x[0], 'END:VEVENT']), ['END:VCALENDAR']).join('\r\n');
const kTime = s => { const [d, t] = s.split(' '), [y, mo, da] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
  return y + '년 ' + mo + '월 ' + da + '일 ' + (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + String(mi).padStart(2, '0'); };
const EDGE_TEXT = EDGE.map(x => kTime(x[1]) + '~' + kTime(x[2]) + ', ' + x[0] + ', 홍길동, 위치 없음,').join('\n');
/* v595 검토 — 앱이 구글에 올린 사본. apps-script/Watchdog.gs(watch-v6 매시간 맞추기)의 watchCalItems_ 를 그대로 돌려 만든다 — 사본 꼴(제목 꼬리·설명 끝줄)이
   바뀌면 이 검사가 안다. 구글 바로 읽기 꼴(태그 hjKey 가 extendedProperties.private 에 — CalendarApp setTag)·.ics 꼴(태그 없음)·화면 글 꼴(설명 없음) 셋. */
function copies(data) {
  const sb = { Logger: { log() {} }, console }; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Watchdog.gs'), 'utf8'), sb);
  return JSON.parse(JSON.stringify(sb.watchCalItems_(data, new Date(2026, 10, 10, 12)).items));
}
const p2 = n => String(n).padStart(2, '0');
const kstOf = ms => { const k = new Date(ms + 9 * 3600000); return { date: k.getUTCFullYear() + '-' + p2(k.getUTCMonth() + 1) + '-' + p2(k.getUTCDate()), time: p2(k.getUTCHours()) + ':' + p2(k.getUTCMinutes()) }; };
const copyEnd = it => kstOf(Date.parse(it.date + 'T' + it.time + ':00+09:00') + it.hours * 3600000);
const nextDay = d => kstOf(Date.parse(d + 'T00:00:00+09:00') + 86400000).date;
const COPY_API = items => items.map((it, i) => {
  const xp = { description: it.desc, extendedProperties: { private: { hjKey: it.key, hjSig: 'sig-' + i } } };
  if (!it.time) return Object.assign(T('c' + i, it.title, '', ''), xp, { start: { date: it.date }, end: { date: nextDay(it.date) } });
  const e = copyEnd(it); return T('c' + i, it.title, it.date + 'T' + it.time + ':00+09:00', e.date + 'T' + e.time + ':00+09:00', xp);
});
const icsEsc = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const COPY_ICS = items => ['BEGIN:VCALENDAR'].concat(...items.map((it, i) => {
  const d = x => x.replace(/-/g, ''), e = it.time ? copyEnd(it) : null;
  return ['BEGIN:VEVENT', 'UID:c' + i + '@google.com',
    it.time ? 'DTSTART;TZID=Asia/Seoul:' + d(it.date) + 'T' + it.time.replace(':', '') + '00' : 'DTSTART;VALUE=DATE:' + d(it.date),
    it.time ? 'DTEND;TZID=Asia/Seoul:' + d(e.date) + 'T' + e.time.replace(':', '') + '00' : 'DTEND;VALUE=DATE:' + d(nextDay(it.date)),
    'SUMMARY:' + icsEsc(it.title), 'DESCRIPTION:' + icsEsc(it.desc), 'END:VEVENT'];
}), ['END:VCALENDAR']).join('\r\n');
const kDay = d => { const [y, m, da] = d.split('-').map(Number); return y + '년 ' + m + '월 ' + da + '일'; };
const COPY_TEXT = items => items.map(it => {
  if (!it.time) return '종일, ' + it.title + ', 홍길동, 위치 없음, ' + kDay(it.date);
  const e = copyEnd(it);
  if (e.date === it.date) return kTime(it.date + ' ' + it.time).replace(/^\S+ \S+ \S+ /, '') + '~' + kTime(e.date + ' ' + e.time).replace(/^\S+ \S+ \S+ /, '') + ', ' + it.title + ', 홍길동, 위치 없음, ' + kDay(it.date);
  return kTime(it.date + ' ' + it.time) + '~' + kTime(e.date + ' ' + e.time) + ', ' + it.title + ', 홍길동, 위치 없음,';
}).join('\n');

let browser, passed = 0;
const errors = [], network = { writes: 0, gWrites: 0, gCalls: 0 };
const api = { pages: [[]] };
async function test(name, fn) { await fn(); passed++; console.log('PASS timedspan-v595 ' + name); }
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
      network.gCalls++;
      const i = url.searchParams.get('pageToken') ? +url.searchParams.get('pageToken').slice(5) : 0, pg = api.pages[i] || [];
      return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(Object.assign({ kind: 'calendar#events', items: pg }, i + 1 < api.pages.length ? { nextPageToken: 'PAGE-' + (i + 1) } : {})) });
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
    // 가짜 구글 로그인(GIS) — 캘린더 권한 클라이언트에만 자기서술형 가짜 토큰. 드라이브 쪽 클라이언트는 기록만.
    window.__gis = { reqs: [], n: 0 };
    window.google = { accounts: { oauth2: { initTokenClient(cfg) {
      if (!/calendar/.test(String(cfg.scope || ''))) return { callback: cfg.callback, requestAccessToken() {} };
      const c = { callback: cfg.callback, requestAccessToken(o) { __gis.reqs.push((o && o.prompt) || ''); setTimeout(() => c.callback({ access_token: 'FAKE-CAL-TOKEN-' + (++__gis.n), expires_in: 3600 }), 0); } };
      return c; } } } };
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
// 일정표를 심는다 — sched: [id, date, time, title, memo, extra]
const SEED = sched => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래마을아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  state.schedule = (sched || []).map(x => Object.assign({ id: x[0], date: x[1], time: x[2], title: x[3], project: '가온아파트', workers: '', hours: 8, memo: x[4], report: null }, x[5] || {}));
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
// 일정 → [날짜, 시각, 시간 수, 메모 첫 줄, hjSchSpan 끝, hjSchSpan 날 수]
const SCHED = () => Object.fromEntries(state.schedule.map(s => { const sp = hjSchSpan(s); return [s.title, [s.date, s.time || '', s.hours, String(s.memo || '').split('\n')[0], sp.to, sp.days]]; }));

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);

    await test('① 구글 바로 읽기 — 사흘·이틀(Z)은 여러 날 · 4시간 밤샘은 하루 · 단추 → 미리보기 → 반영 → 일정 · 다시 읽으면 이미 같음 (API)', async () => {
      await page.evaluate(SEED, []);
      const ev = await page.evaluate(items => hjCalApiEvents(items).map(e => [e.uid, e.date, e.time, e.to || '', e.hours, e.raw]), API);
      assert.deepEqual(ev, [
        ['a1@google.com', '2026-11-16', '09:00', '2026-11-18', 9, '철야 방수'],
        ['a2@google.com', '2026-11-19', '22:00', '', 1, '야간 배관'],
        ['a3@google.com', '2026-11-20', '09:00', '2026-11-21', 8, '이틀 타설']], '읽은 꼴 — ' + JSON.stringify(ev));
      // [📅 구글 캘린더에서 바로 읽기] → 미리보기
      api.pages = [API]; network.gCalls = 0;
      await page.evaluate(() => { window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { window.__snaps.push(a[0]); return o(...a); }; hjCalSyncView(); document.getElementById('csGoogle').click(); });
      await page.waitForSelector('#csBody [data-cs-row="new"]');
      const pv = await page.evaluate(() => ({ rows: window.__hjCalSyncPlan.rows.map(r => [r.status, r.date, r.time, r.to || '', r.hours, r.title, r.check]),
        text: [...document.querySelectorAll('#csBody [data-cs-row]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()) }));
      assert.deepEqual(pv.rows, [
        ['new', '2026-11-16', '09:00', '2026-11-18', 9, '철야 방수', true],
        ['new', '2026-11-19', '22:00', '', 1, '야간 배관', true],
        ['new', '2026-11-20', '09:00', '2026-11-21', 8, '이틀 타설', true]], JSON.stringify(pv.rows));
      assert.ok(pv.text[0].includes('11/16(월) 09:00 ~ 11/18(수) 철야 방수') && pv.text[1].includes('11/19(목) 22:00 야간 배관') && !pv.text[1].includes('~'), '미리보기 줄 글 — ' + JSON.stringify(pv.text));
      await page.click('#csApply');
      await page.waitForSelector('#hjCalSyncDone');
      const a = await page.evaluate(sched => { const out = { s: eval(sched)(), snaps: window.__snaps.filter(x => x === '구글 캘린더 맞추기 전').length,
        done: [...document.querySelectorAll('#hjCalSyncDone [data-csd-row]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()),
        cont17: (hjSchContOn(state.schedule.find(s => s.title === '철야 방수'), '2026-11-17') || {}).day || 0,
        cont18: hjSchContinuing('2026-11-18').map(x => x.s.title), cont20: hjSchContinuing('2026-11-20').map(x => x.s.title) };
        closeModal(true); return out; }, '(' + SCHED.toString() + ')');
      assert.deepEqual(a.s, {
        '철야 방수': ['2026-11-16', '09:00', 9, '2026-11-16~2026-11-18 (3일)', '2026-11-18', 3],
        '야간 배관': ['2026-11-19', '22:00', 1, '구글 캘린더에서 가져옴', '2026-11-19', 1],
        '이틀 타설': ['2026-11-20', '09:00', 8, '2026-11-20~2026-11-21 (2일)', '2026-11-21', 2]}, '반영된 일정 — ' + JSON.stringify(a.s));
      assert.equal(a.snaps, 1, '안전판 1회(기존 반영 경로)');
      assert.ok(a.done.some(t => t.includes('11/16(월)~11/18(수) 09:00')) && a.done.some(t => t.includes('11/19(목) 22:00') && !t.includes('~11/20')), '바뀐 일정 알리기 창 — ' + JSON.stringify(a.done));
      assert.deepEqual([a.cont17, a.cont18, a.cont20], [2, ['철야 방수'], []], '이어지는 날 — 둘째·셋째 날은 보이고 밤샘 이튿날은 아님(이틀 타설은 시작일이라 이어지는 날 아님) — ' + JSON.stringify([a.cont17, a.cont18, a.cont20]));
      // 다시 읽기 — 여러 날·밤샘 모두 이미 같음(이어지는 날을 새 일정으로 겹쳐 넣지 않음)
      await page.evaluate(() => { hjCalSyncView(); document.getElementById('csGoogle').click(); });
      await page.waitForSelector('#csBody [data-cs-clean], #csBody [data-cs-row]');   // 줄이 남으면 아래 단언이 무엇이 남았는지 말한다
      const again = await page.evaluate(() => { const p = window.__hjCalSyncPlan; const o = { rows: p.rows.length, same: p.stats.same }; closeModal(true); return o; });
      assert.deepEqual(again, { rows: 0, same: 3 }, '다시 읽으면 줄 0 — ' + JSON.stringify(again));
      // v595 검토 — 한 시간 뒤 구글에는 Watchdog 이 올린 앱 일정 사본도 있다(여러 날 공정은 날마다 '(3일 · ~끝)'·'(2/3일째)'). 같이 읽어도 줄 0 이어야 한다
      // (예전에는 꼬리 때문에 열쇠가 달라 사본마다 체크된 '새 일정' — 반영하면 같은 공정이 겹치고 그 사본이 또 올라간다)
      const items = copies(await page.evaluate(() => JSON.parse(JSON.stringify(serializeData()))));
      assert.ok(items.some(x => /^(\[[^\]]+\] )?철야 방수 \(3일 · ~11\/18\(수\)\)$/.test(x.title)) && items.some(x => /철야 방수 \(2\/3일째\)$/.test(x.title)) && items.some(x => /이틀 타설 \(2\/2일째\)$/.test(x.title)),
        'Watchdog 사본 꼴 — ' + JSON.stringify(items.map(x => [x.date, x.time, x.hours, x.title])));
      api.pages = [API.concat(COPY_API(items))];
      await page.evaluate(() => { hjCalSyncView(); document.getElementById('csGoogle').click(); });
      await page.waitForSelector('#csBody [data-cs-clean], #csBody [data-cs-row]');   // 줄이 남으면 아래 단언이 무엇이 남았는지 말한다
      const withCopies = await page.evaluate(() => { const p = window.__hjCalSyncPlan; const o = { rows: p.rows.map(r => [r.status, r.date, r.title]), cont: p.stats.cont, gdup: p.stats.gdup }; closeModal(true); return o; });
      assert.deepEqual(withCopies, { rows: [], cont: 3, gdup: 3 }, '사본과 같이 읽어도 줄 0 — 첫날 사본은 원래 일정과 한 줄, 이어지는 날 사본은 이어지는 날 — ' + JSON.stringify(withCopies));
      assert.equal(network.gWrites, 0, '구글에 쓰는 요청 0');
      assert.ok(network.gCalls >= 3, '세 번 읽음(가짜 API) — ' + network.gCalls);
    });

    await test('② .ics — 예전에 하루로 넣은 같은 일정은 ⏳ 기간 다름(1시간이면 하루 시간 수도 구글대로) · 앱 사흘 공정은 날짜 옮김의 새 끝 · 제미나이 하루짜리는 이어지는 날 · 밤샘은 이미 같음 (ICS)', async () => {
      await page.evaluate(SEED, [
        ['P1', '2026-11-16', '09:00', '철야 방수', '구글 캘린더에서 가져옴', { icsUid: 'i1@test', hours: 1 }],   // v595 전 맞추기가 시작일 하루로 넣은 그 일정
        ['P2', '2026-11-12', '', '타일', '2026-11-12~2026-11-14 (3일)'],
        ['P3', '2026-11-19', '22:00', '야간 배관', '구글 캘린더에서 가져옴', { icsUid: 'i2@test', hours: 1 }],
        ['P4', '2026-11-24', '09:00', '이틀 미장', '구글 캘린더에서 가져옴', { icsUid: 'i5@test', hours: 2 }],   // 사람이 하루 2시간으로 고친 것 — 그대로
        ['P5', '2026-11-24', '13:00', '사흘 도장', '구글 캘린더에서 가져옴', { icsUid: 'i6@test', hours: 1 }]]);  // 미리보기 뒤 사람이 4시간으로 고침 — 그대로
      const r = await page.evaluate(ics => { const before = JSON.stringify(serializeData().schedule), ev = hjCalSyncParse(ics), P = hjCalSyncPlan(ev); window.__p2 = P;
        return { ev: ev.map(e => [e.uid, e.date, e.time, e.to || '', e.hours, e.raw]), rows: P.rows.map(x => [x.status, x.app ? x.app.id : '', x.date, x.time, x.to || '', x.app ? x.app.to || '' : '', x.check, x.hfix || 0]),
          text: P.rows.map(hjCalSyncRowText), same: P.stats.same, cont: P.stats.cont, unchanged: before === JSON.stringify(serializeData().schedule) }; }, ICS);
      assert.deepEqual(r.ev, [
        ['i1@test', '2026-11-16', '09:00', '2026-11-18', 9, '철야 방수'],
        ['i2@test', '2026-11-19', '22:00', '', 1, '야간 배관'],
        ['i3@test', '2026-11-13', '09:00', '2026-11-16', 8, '타일'],
        ['i4@test', '2026-11-17', '', '', 8, '@철야 방수'],
        ['i5@test', '2026-11-24', '09:00', '2026-11-25', 8, '이틀 미장'],
        ['i6@test', '2026-11-24', '13:00', '2026-11-26', 5, '사흘 도장']], '읽은 꼴 — …Z·TZID·떠 있는 시각 — ' + JSON.stringify(r.ev));
      // v595 검토 — 예전 맞추기가 1시간으로 넣은 기록(P1·P5)은 기간을 늘리면서 하루 시간 수도 구글대로(hfix), 사람이 고친 2시간(P4)은 그대로
      assert.deepEqual(r.rows, [
        ['span', 'P1', '2026-11-16', '09:00', '2026-11-18', '', true, 9],
        ['span', 'P4', '2026-11-24', '09:00', '2026-11-25', '', true, 0],
        ['span', 'P5', '2026-11-24', '13:00', '2026-11-26', '', true, 5],
        ['move', 'P2', '2026-11-13', '09:00', '2026-11-16', '2026-11-14', true, 0]], '계획 — ' + JSON.stringify(r.rows));
      assert.deepEqual([r.same, r.cont, r.unchanged], [2, 1, true], '밤샘 짝·제미나이 하루짜리(이어지는 날)는 이미 같음 · 계획은 읽기만 — ' + JSON.stringify([r.same, r.cont, r.unchanged]));
      assert.match(r.text[0], /^11\/16\(월\) 09:00 철야 방수 — 기간 하루 → ~11\/18\(수\) · 하루 1시간 → 9시간$/, r.text[0]);
      assert.match(r.text[1], /^11\/24\(화\) 09:00 이틀 미장 — 기간 하루 → ~11\/25\(수\)$/, r.text[1]);
      assert.match(r.text[2], /^11\/24\(화\) 13:00 사흘 도장 — 기간 하루 → ~11\/26\(목\) · 하루 1시간 → 5시간$/, r.text[2]);
      assert.match(r.text[3], /^11\/13\(금\) 09:00 타일 — 날짜 11\/12\(목\) → 11\/13\(금\) ~ 11\/16\(월\)$/, r.text[3]);
      // 미리보기 뒤 사람이 P5 를 4시간으로 고침(일정표 지문 hjCalSyncStamp 에는 시간 수가 없다) — 반영이 덮지 않는다
      const s = await page.evaluate(async sched => { const P = window.__p2; state.schedule.find(x => x.id === 'P5').hours = 4;
        await hjCalSyncApply(P, P.rows.map((x, i) => ({ i, project: '' }))); closeModal(true); return eval(sched)(); }, '(' + SCHED.toString() + ')');
      assert.deepEqual(s, {
        '철야 방수': ['2026-11-16', '09:00', 9, '2026-11-16~2026-11-18 (3일)', '2026-11-18', 3],
        '타일': ['2026-11-13', '09:00', 8, '2026-11-13~2026-11-16 (3일)', '2026-11-16', 3],   // 11/15 일요일은 작업일이 아님
        '야간 배관': ['2026-11-19', '22:00', 1, '구글 캘린더에서 가져옴', '2026-11-19', 1],
        '이틀 미장': ['2026-11-24', '09:00', 2, '2026-11-24~2026-11-25 (2일)', '2026-11-25', 2],
        '사흘 도장': ['2026-11-24', '13:00', 4, '2026-11-24~2026-11-26 (3일)', '2026-11-26', 3]}, '반영 — ' + JSON.stringify(s));
      const again = await page.evaluate(ics => { const P = hjCalSyncPlan(hjCalSyncParse(ics)); return { rows: P.rows.map(x => [x.status, x.title]), same: P.stats.same, cont: P.stats.cont }; }, ICS);
      assert.deepEqual(again, { rows: [], same: 6, cont: 1 }, '다시 견주면 줄 0 — ' + JSON.stringify(again));
    });

    await test('③ 화면 글 — 시각 있는 두 날짜 줄 · 밤샘 · 끝 연도 빠진 꼴 · 끝 날짜 없는 꼴은 하루 · 줄 끝 두 날짜 꼴 · 대시 · 붙여 넣기 → 읽기 → 반영 (TEXT)', async () => {
      await page.evaluate(SEED, [['G1', '2026-12-07', '09:00', '현관 도장', '구글 캘린더에서 가져옴', { icsUid: 'gcal:2026-12-07|현관도장', hours: 1 }]]);   // v595 전 화면 글 맞추기가 하루·1시간으로 넣은 것
      const ev = await page.evaluate(t => { const v = hjCalSyncParse(t); return { ev: v.map(e => [e.date, e.time, e.to || '', e.hours, e.raw, e.location]), unread: v.unread }; }, TEXT);
      assert.deepEqual(ev.ev, [
        ['2026-11-16', '09:00', '2026-11-18', 9, '철야 방수', '가온아파트 3동'],
        ['2026-11-19', '22:00', '', 1, '야간 배관', ''],
        ['2026-11-30', '20:00', '2026-12-02', 1, '달넘이 야간', ''],
        ['2026-11-21', '19:20', '', 1, '저녁 점검', ''],
        ['2026-11-24', '', '2026-11-25', 8, '바닥 양생', ''],
        ['2026-11-24', '14:00', '', 2, '오후 점검', ''],
        ['2026-11-26', '09:00', '2026-11-28', 9, '타일 시공', ''],
        ['2026-11-26', '22:00', '', 1, '밤 보수', ''],
        ['2026-12-01', '09:00', '2026-12-03', 9, '대시 철야', ''],
        ['2026-11-25', '14:00', '', 2, '대시 점검', ''],
        ['2026-12-07', '09:00', '2026-12-09', 8, '현관 도장', '']], '읽은 꼴 — ' + JSON.stringify(ev.ev));
      assert.equal(ev.unread, 0, '못 읽은 줄 없음');
      await page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await page.waitForSelector('#csBody [data-cs-row="new"]');
      const pv = await page.evaluate(() => [...document.querySelectorAll('#csBody [data-cs-row]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
      assert.ok(pv.some(t => t.includes('11/16(월) 09:00 ~ 11/18(수) 철야 방수')) && pv.some(t => t.includes('11/30(월) 20:00 ~ 12/2(수) 달넘이 야간')) && pv.some(t => /11\/19\(목\) 22:00 야간 배관(?! ~)/.test(t))
        && pv.some(t => t.includes('11/26(목) 09:00 ~ 11/28(토) 타일 시공')) && pv.some(t => t.includes('12/7(월) 09:00 현관 도장 — 기간 하루 → ~12/9(수) · 하루 1시간 → 8시간')), '미리보기 — ' + JSON.stringify(pv));
      await page.click('#csApply');
      await page.waitForSelector('#hjCalSyncDone');
      const s = await page.evaluate(sched => { const o = eval(sched)(); closeModal(true); return o; }, '(' + SCHED.toString() + ')');
      assert.deepEqual(s, {
        '철야 방수': ['2026-11-16', '09:00', 9, '2026-11-16~2026-11-18 (3일)', '2026-11-18', 3],
        '야간 배관': ['2026-11-19', '22:00', 1, '구글 캘린더에서 가져옴', '2026-11-19', 1],
        '달넘이 야간': ['2026-11-30', '20:00', 1, '2026-11-30~2026-12-02 (3일)', '2026-12-02', 3],
        '저녁 점검': ['2026-11-21', '19:20', 1, '구글 캘린더에서 가져옴', '2026-11-21', 1],
        '바닥 양생': ['2026-11-24', '', 8, '2026-11-24~2026-11-25 (2일)', '2026-11-25', 2],
        '오후 점검': ['2026-11-24', '14:00', 2, '구글 캘린더에서 가져옴', '2026-11-24', 1],
        '타일 시공': ['2026-11-26', '09:00', 9, '2026-11-26~2026-11-28 (3일)', '2026-11-28', 3],
        '밤 보수': ['2026-11-26', '22:00', 1, '구글 캘린더에서 가져옴', '2026-11-26', 1],
        '대시 철야': ['2026-12-01', '09:00', 9, '2026-12-01~2026-12-03 (3일)', '2026-12-03', 3],
        '대시 점검': ['2026-11-25', '14:00', 2, '구글 캘린더에서 가져옴', '2026-11-25', 1],
        '현관 도장': ['2026-12-07', '09:00', 8, '2026-12-07~2026-12-09 (3일)', '2026-12-09', 3]}, '반영 — ' + JSON.stringify(s));
    });

    await test('④ 경계 — 24시간 · 23시간 30분 · 끝 0시 · 0시~0시 · 60일/61일 · 끝 시각이 이름 — 세 읽기가 같은 답 (EDGE)', async () => {
      const r = await page.evaluate(({ a, i, t }) => {
        const f = v => v.map(e => [e.raw, e.date, e.time, e.to || '', e.hours]);
        return { api: f(hjCalApiEvents(a)), ics: f(hjCalSyncParseIcs(i)), text: f(hjCalSyncParseText(t)) };
      }, { a: EDGE_API, i: EDGE_ICS, t: EDGE_TEXT });
      const want = EDGE.map(x => [x[0], x[1].slice(0, 10), x[1].slice(11), x[3], x[4]]);
      assert.deepEqual(r.api, want, '구글 바로 읽기 — ' + JSON.stringify(r.api));
      assert.deepEqual(r.ics, want, '.ics — ' + JSON.stringify(r.ics));
      assert.deepEqual(r.text, want, '화면 글 — ' + JSON.stringify(r.text));
    });

    await test('⑤ 폰 390 — 미리보기 넘침 없음·44px · 미리보기는 읽기만 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED, []);
      const before = await m.page.evaluate(() => JSON.stringify(serializeData().schedule));
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await m.page.waitForSelector('#csBody [data-cs-row="new"]');
      const ui = await m.page.evaluate(() => ({ over: [...document.querySelectorAll('#modalRoot [data-cs-row], #modalRoot [data-cs-row] span')].filter(e => e.scrollWidth - e.clientWidth > 1).length + (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0),
        apply: document.getElementById('csApply').getBoundingClientRect().height, chk: Math.min(...[...document.querySelectorAll('#csBody [data-cs-row] label')].map(l => l.getBoundingClientRect().height)),
        row: [...document.querySelectorAll('#csBody [data-cs-row]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()).find(t => t.includes('철야 방수')) || '' }));
      assert.equal(ui.over, 0, '넘침 없음');
      assert.ok(ui.apply >= 44 && ui.chk >= 44, '44px — ' + JSON.stringify(ui));
      assert.ok(ui.row.includes('11/16(월) 09:00 ~ 11/18(수)'), '폰에서도 기간이 보인다 — ' + ui.row);
      assert.equal(await m.page.evaluate(() => JSON.stringify(serializeData().schedule)), before, '미리보기는 읽기만');
      await m.page.evaluate(() => closeModal(true));
      await m.context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
      assert.equal(network.gWrites, 0, '구글 쓰기 0');
    });

    await test('⑥ 앱이 올린 사본(Watchdog) — 24시간 하루 일정(현장 있음·없음)·공정표 공정 사본은 여러 날로 읽지 않음 · 구글 바로 읽기·.ics 줄 0 · 화면 글은 현장 없는 24시간 사본만 알려진 한계 (COPY)', async () => {
      await page.evaluate(SEED, [
        ['W1', '2026-11-16', '09:00', '양생', '', { hours: 24 }],                                  // 하루 24시간 — 사본은 09:00 ~ 이튿날 09:00
        ['W2', '2026-11-18', '10:00', '실리콘 경화', '', { hours: 24, project: '' }],                 // 현장 없음 — 사본 제목에 '[현장]' 이 없다(태그·설명 끝줄로만 알아봄)
        ['PL', '2026-11-19', '', '도배 (2일차 시작)', '2026-11-19~2026-11-20 (2일)']]);              // 🗓 공정표 공정 — 사본은 꼬리를 떼고 날마다
      const items = copies(await page.evaluate(() => JSON.parse(JSON.stringify(serializeData()))));
      assert.deepEqual(items.map(x => [x.date, x.time, x.hours, x.title]), [
        ['2026-11-16', '09:00', 24, '[가온아파트] 양생'],
        ['2026-11-18', '10:00', 24, '실리콘 경화'],
        ['2026-11-19', '', 0, '[가온아파트] 도배 (2일 · ~11/20(금))'],
        ['2026-11-20', '', 0, '[가온아파트] 도배 (2/2일째)']], 'Watchdog 사본 — ' + JSON.stringify(items.map(x => [x.date, x.time, x.hours, x.title])));
      const r = await page.evaluate(({ a, i, t }) => {
        const f = v => v.map(e => [e.date, e.time, e.to || '']), plan = v => { const P = hjCalSyncPlan(v); return { rows: P.rows.map(x => [x.status, x.date, x.title, x.to || '']), same: P.stats.same, cont: P.stats.cont }; };
        const A = hjCalApiEvents(a), I = hjCalSyncParseIcs(i), X = hjCalSyncParseText(t);
        // 사장님이 구글에서 사본 설명을 지웠어도 태그 hjKey 로 사본인 줄 안다(현장 없는 사본은 제목 머리도 없다)
        const A2 = hjCalApiEvents(a.map(e => Object.assign({}, e, { description: '' })));
        return { api: f(A), api2: f(A2), ics: f(I), text: f(X), pa: plan(A), pi: plan(I), pt: plan(X) };
      }, { a: COPY_API(items), i: COPY_ICS(items), t: COPY_TEXT(items) });
      const one = [['2026-11-16', '09:00', ''], ['2026-11-18', '10:00', ''], ['2026-11-19', '', ''], ['2026-11-20', '', '']];
      assert.deepEqual(r.api, one, '구글 바로 읽기 — 사본은 하루 — ' + JSON.stringify(r.api));
      assert.deepEqual(r.api2, one, '구글 바로 읽기 — 설명을 지운 사본도 태그 hjKey 로 하루 — ' + JSON.stringify(r.api2));
      assert.deepEqual(r.ics, one, '.ics — 사본은 하루(제목 머리·설명 끝줄) — ' + JSON.stringify(r.ics));
      assert.deepEqual(r.text, [one[0], ['2026-11-18', '10:00', '2026-11-19'], one[2], one[3]],
        '화면 글 — 현장 없는 24시간 사본은 알아볼 수 없다(설명이 없음 — AGENTS v595 남은 것), 나머지는 하루 — ' + JSON.stringify(r.text));
      const same = { rows: [], same: 4, cont: 1 };   // same 은 이어지는 날도 센다
      assert.deepEqual(r.pa, same, '구글 바로 읽기 맞추기 줄 0(공정표 공정 둘째 날 사본은 이어지는 날) — ' + JSON.stringify(r.pa));
      assert.deepEqual(r.pi, same, '.ics 맞추기 줄 0 — ' + JSON.stringify(r.pi));
      assert.deepEqual(r.pt.rows, [['span', '2026-11-18', '실리콘 경화', '2026-11-19']], '화면 글 — 현장 없는 24시간 사본만 기간 다름(알려진 한계) — ' + JSON.stringify(r.pt));
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes + network.gWrites, 0, '바깥·구글 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('timedspan-v595: ' + passed + '/6');
  if (passed !== 6) process.exit(1);
})().catch(e => { console.error('FAIL timedspan-v595', e && e.stack || e); process.exit(1); });
