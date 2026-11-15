/* v605 📤 팀에게 나가는 일정 글 — 앱 출처 표시 '구글 캘린더에서 가져옴 (@ 제미나이 입력)' 을 빼고, 구글 위치('장소:')를 주소 줄로.
   🔄 구글 캘린더 맞추기는 새 일정 메모에 '장소: …' 와 끝줄 '구글 캘린더에서 가져옴 (@ 제미나이 입력)' 을 적는다(🤖 칩이 이 글로 옛 기록을 알아봐 메모에서 지울 수 없다).
   팀에 나가는 글은 그 메모를 그대로 실어 줄마다 꼬리표가 붙었고, 메모 60자 자르기를 꼬리표가 먹었다. 현장 주소가 없는 일정은 구글 위치가 있어도 '주소:' 줄이 없었다.
   합성 자료(일정 셋은 진짜 맞추기 길 hjCalSyncParse → hjCalSyncPlan → hjCalSyncApply 로 만든다 — 쓰는 글과 빼는 글이 어긋나면 여기서 잡힌다), 시계 2026-11-16(월) 고정, 폰 390, 바깥 쓰기 0.
   ① 📤 공유 글 — 꼬리표 없음 · 현장 없는 일정·주소 없는 현장은 '주소: <장소>' 한 번만(메모에 다시 없음) · 현장 주소가 있으면 그 주소가 먼저(장소는 메모에 남음) ·
      꼬리표·장소가 먹던 60자에 진짜 전달 사항이 다 들어감 · 창 글상자도 같은 글 (SHARE)
   ② .ics·작업자 캘린더 파일·🔔 작업자 문안 같은 규칙 · 📤 하루치 팀 지시 detail 에 꼬리표 없음·주소 없는 현장은 project.addr = 장소(동·호수 뗌)·detail 에 그 줄 다시 없음 ·
      전화번호가 든 장소는 주소로 안 씀 · 스키마·개인정보 검사 통과 · 고객 문안 그대로 (FOLLOW)
   ③ '장소: 공동현관 1234' 처럼 출입 번호면 주소로 안 씀 · 🔒 뺀 수(v577)는 그대로(꼬리표는 세지 않음) (ACCESS)
   ④ 그대로인 것 — 일정 메모·일정표 화면·🤖 칩·내 폰 캘린더(.ics)·저장본 (KEEP)
   ⑤ 꼬리표 없는 손 메모는 글자 그대로 · v577 규칙 그대로 · 여러 날 공정의 이어지는 날·🔨 다음 공정 안내의 주소 · 폰 390 넘침 없음·44px · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0 (REGRESS)
   HJ_V605_BASELINE=<commit> 과 HJ_V605_MUTATION=keep-tag(꼬리표를 안 뺌)·place-twice(주소로 쓴 장소를 메모에도)·place-first(현장 주소보다 장소 먼저)는 ①,
   packet-keep-tag(팀 지시 detail 에 꼬리표)·packet-raw-addr(지시 주소에 동·호수)는 ②, access-as-addr(출입 번호 장소를 주소로)는 ③, scrub-own-ics(내 폰 캘린더까지 거름)는 ④ 에서 실패해야 한다. */
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
  'keep-tag': ['if(HJ_CALSYNC_FROM_RE.test(x))return false;if(skip&&', 'if(skip&&'],
  'place-twice': ['function hjSchMemoOut(s){return hjMemoOut(s&&s.memo,!hjSchProjAddr(s));}', 'function hjSchMemoOut(s){return hjMemoOut(s&&s.memo);}'],
  'place-first': ['function hjSchShareAddr(s){return hjSchProjAddr(s)||hjSchPlaceOf(s);}', 'function hjSchShareAddr(s){return hjSchPlaceOf(s)||hjSchProjAddr(s);}'],
  'packet-keep-tag': ['if(HJ_CALSYNC_FROM_RE.test(t))return true;const m=place?', 'const m=place?'],
  'packet-raw-addr': ['if(placeOk)o.project.addr=placeAddr;', 'if(placeOk)o.project.addr=rawPlace;'],
  'access-as-addr': ['  for(const x of hjMemoParts(s&&s.memo).parts){const m=HJ_SCH_PLACE_RE.exec(x);if(m)return m[1].trim();}', "  for(const x of String(s&&s.memo||'').split('\\n').map(v=>v.trim())){const m=HJ_SCH_PLACE_RE.exec(x);if(m)return m[1].trim();}"],
  'scrub-own-ics': ["scrub(s.memo)].filter(Boolean).join(' / ')};", "hjMemoOut(scrub(s.memo)).text].filter(Boolean).join(' / ')};"]
};
let html = process.env.HJ_V605_BASELINE ? execFileSync('git', ['show', process.env.HJ_V605_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V605_MUTATION) {
  const m = MUT[process.env.HJ_V605_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V605_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
// 구글 캘린더 내보내기 꼴 — 내일(11/17) 일정 셋. 위치·설명은 합성 글
const EV = (uid, lines) => ['BEGIN:VEVENT', 'UID:' + uid].concat(lines, ['END:VEVENT']);
const NOTE = '욕실 문턱 옆 타일 두 장 들뜸 — 같은 무늬 여분은 베란다 창고 선반 위에 있음';
const ICS = ['BEGIN:VCALENDAR'].concat(
  EV('u1@test', ['DTSTART;TZID=Asia/Seoul:20261117T090000', 'DTEND;TZID=Asia/Seoul:20261117T100000', 'SUMMARY:@우수관 1개', 'LOCATION:시험시 새벽로 12 모란아파트 303동 704호']),
  EV('u2@test', ['DTSTART;TZID=Asia/Seoul:20261117T110000', 'DTEND;TZID=Asia/Seoul:20261117T130000', 'SUMMARY:@방수 점검', 'LOCATION:시험시 한밭대로 99 가상빌딩 3층', 'DESCRIPTION:열쇠는 관리실']),
  EV('u3@test', ['DTSTART;TZID=Asia/Seoul:20261117T140000', 'DTEND;TZID=Asia/Seoul:20261117T170000', 'SUMMARY:타일 보수', 'LOCATION:시험시 보람로 7 보람마을 2단지 205동 1101호', 'DESCRIPTION:' + NOTE]),
  ['END:VCALENDAR']).join('\r\n');
const TAG = /구글 캘린더에서 가져옴|제미나이/;
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS teamtext-v605 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
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
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    window.__shared = []; window.__sms = []; window.__clip = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__shared.push(d); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__clip.push(String(t)); } } });
    window.hjSmsGo = u => { window.__sms.push(u); };
  }, BOOT);
  await page.evaluate(mobile => { __mobileMode = mobile; applyMobileMode(); }, width < 600);   // 모바일 모드는 폭이 아니라 설정값 — 명시적으로
  return { context, page };
}
// 합성 자료 — 현장 셋: 주소 있는 곳 하나, 주소 없는 곳 둘. 내일 일정 셋은 진짜 맞추기 길로 넣고(①), 나머지는 맞추기가 적는 꼴 그대로 심는다.
const SEED = async ics => {
  closeModal(true);
  state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = []; state.expenses = []; state.schedule = []; __tabStale = false;
  state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', company: '', team: true }];
  const P = (name, customer) => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: Object.assign({ name: '', phone: '', addr: '' }, customer || {}), archived: false });
  state.projects = [P('가온아파트', { name: '김가상', phone: '010-9999-8888', addr: '시험시 가온로 1' }), P('보람마을 2단지'), P('다솜빌라')];
  const plan = hjCalSyncPlan(hjCalSyncParse(ics)), pick = { 'u1@test': '', 'u2@test': '가온아파트', 'u3@test': '보람마을 2단지' };
  const picks = plan.rows.map((r, i) => ({ i, uid: r.uid, status: r.status })).filter(x => x.status === 'new' && x.uid in pick).map(x => ({ i: x.i, project: pick[x.uid] }));
  const res = await hjCalSyncApply(plan, picks);
  const S = (id, date, time, title, project, x) => Object.assign({ id, date, time, title, project, workers: '', memo: '', hours: 8, report: null }, x || {});
  state.schedule.push(
    S('a2', '2026-11-18', '13:00', '배관 점검', '다솜빌라', { memo: '장소: 다솜빌라 관리실 010-2222-3333\n구글 캘린더에서 가져옴' }),
    S('h1', '2026-11-18', '15:00', '도배', '가온아파트', { crew: '김타일', memo: '벽지 확인 / 주차 B2' }),
    S('m1', '2026-11-19', '08:00', '실리콘', '다솜빌라', { memo: '2026-11-19~2026-11-21 (3일)\n장소: 시험시 달빛로 5 다솜빌라\n실리콘 색 확인\n구글 캘린더에서 가져옴 (@ 제미나이 입력)', icsBy: 'gemini' }),
    S('a1', '2026-11-23', '09:00', '누수 탐지', '보람마을 2단지', { memo: '장소: 공동현관 1234\n구글 캘린더에서 가져옴 (@ 제미나이 입력)', icsBy: 'gemini' }));
  state.activeProject = null; state.tab = 'schedule'; __calSelDate = null; window.__shared = []; window.__sms = []; window.__clip = [];
  render();
  const id = u => (state.schedule.find(s => s.icsUid === u) || {}).id;
  return { added: res.added, ids: { u1: id('u1@test'), u2: id('u2@test'), u3: id('u3@test') }, memos: ['u1@test', 'u2@test', 'u3@test'].map(u => (state.schedule.find(s => s.icsUid === u) || {}).memo) };
};
const stable = () => { const d = serializeData(); delete d.savedAt; return JSON.stringify(d); };

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(390);
    const seed = await page.evaluate(SEED, ICS);
    const before = await page.evaluate(() => JSON.stringify(state.schedule)), beforeAll = await page.evaluate(stable);

    await test('① 📤 공유 글 — 꼬리표 없음 · 주소 없는 일정은 주소: <장소> 한 번만 · 현장 주소가 먼저 · 전달 사항이 안 잘림 · 창 글상자 (SHARE)', async () => {
      // 맞추기가 쓴 메모 꼴(이 글이 바뀌면 빼는 규칙도 같이 바꿔야 한다)
      assert.equal(seed.added, 3, '맞추기로 3건');
      assert.deepEqual(seed.memos, ['장소: 시험시 새벽로 12 모란아파트 303동 704호\n구글 캘린더에서 가져옴 (@ 제미나이 입력)', '장소: 시험시 한밭대로 99 가상빌딩 3층\n열쇠는 관리실\n구글 캘린더에서 가져옴 (@ 제미나이 입력)',
        '장소: 시험시 보람로 7 보람마을 2단지 205동 1101호\n' + NOTE + '\n구글 캘린더에서 가져옴'], '맞추기가 쓴 메모');
      const r = await page.evaluate(() => { const days = hjSchShareDays('2026-11-17', '2026-11-17', ''); return { text: hjSchShareText(days, '내일', ''), cut: hjSchShareCut(days) }; });
      assert.ok(!TAG.test(r.text), '공유 글에 꼬리표: ' + r.text);
      const L = r.text.split('\n'), at = L.indexOf('■ 11/17(화)');
      assert.deepEqual(L.slice(at, at + 7), ['■ 11/17(화)',
        '· 09:00 우수관 1개', '  주소: 시험시 새벽로 12 모란아파트 303동 704호',
        '· 11:00 방수 점검 — 가온아파트', '  주소: 시험시 가온로 1 · 장소: 시험시 한밭대로 99 가상빌딩 3층 · 열쇠는 관리실',
        '· 14:00 타일 보수 — 보람마을 2단지', '  주소: 시험시 보람로 7 보람마을 2단지 205동 1101호 · ' + NOTE], '공유 글\n' + r.text);
      assert.equal(r.text.split('시험시 새벽로 12').length, 2, '장소는 한 번만');
      assert.equal(r.cut, 0, '꼬리표는 🔒 뺀 수에 세지 않는다');
      await page.evaluate(() => hjSchShareView({ kind: 'tomorrow' }));
      await page.waitForSelector('#modalRoot #shText');
      const ui = await page.evaluate(() => ({ area: document.querySelector('#modalRoot #shText').value, cut: !!document.querySelector('#modalRoot [data-sh-cut]') }));
      assert.ok(!TAG.test(ui.area) && ui.area.includes('  주소: 시험시 새벽로 12 모란아파트 303동 704호') && ui.area.includes(NOTE) && !ui.cut, '창 글상자: ' + ui.area);
      await page.click('#modalRoot #shKakao');
      await page.waitForFunction(() => window.__shared.length > 0);
      assert.ok(!TAG.test(await page.evaluate(() => String(window.__shared[0].text || ''))), '카톡 공유 글');
      await page.evaluate(() => closeModal(true));
    });

    await test('② .ics·작업자 캘린더·🔔 작업자 문안 같은 규칙 · 팀 지시 detail·addr · 전화 든 장소는 주소로 안 씀 · 검사 통과 · 고객 문안 그대로 (FOLLOW)', async () => {
      const r = await page.evaluate(ids => {
        const days = hjSchShareDays('2026-11-17', '2026-11-18', ''), send = hjSchCalSendItems([ids.u1, ids.u2, ids.u3, 'a2', 'h1']), nd = notifyDrafts('2026-11-17');
        const b17 = hjWoBuildDay('2026-11-17'), b18 = hjWoBuildDay('2026-11-18'), o = (b, t) => b.packet.orders.find(x => x.title.startsWith(t)) || {};
        return { ics: hjSchShareIcsItems(days).map(x => x.memo), send: send.items.map(x => x.memo), sendCut: send.cut,
          worker: nd.map(x => x.worker), customer: nd.map(x => x.customer),
          n17: b17.packet.orders.length, p2: { addr: o(b17, '방수 점검').project.addr, detail: o(b17, '방수 점검').detail }, p3: { addr: o(b17, '타일 보수').project.addr, detail: o(b17, '타일 보수').detail },
          pa2: { addr: o(b18, '배관 점검').project.addr || '', detail: o(b18, '배관 점검').detail }, ph1: { addr: o(b18, '도배').project.addr, detail: o(b18, '도배').detail },
          valid: hjWoValidate(b17.packet).concat(hjWoValidate(b18.packet)), issues: b17.refs.concat(b18.refs).map(x => x.issues.join()).filter(Boolean), json: JSON.stringify([b17.packet, b18.packet]) };
      }, seed.ids);
      const MEMOS = ['주소: 시험시 새벽로 12 모란아파트 303동 704호', '주소: 시험시 가온로 1 / 장소: 시험시 한밭대로 99 가상빌딩 3층 · 열쇠는 관리실', '주소: 시험시 보람로 7 보람마을 2단지 205동 1101호 / ' + NOTE,
        '주소: 다솜빌라 관리실 010-2222-3333', '주소: 시험시 가온로 1 / 벽지 확인 · 주차 B2'];
      assert.deepEqual(r.ics, MEMOS, '.ics 메모 ' + JSON.stringify(r.ics));
      assert.deepEqual([r.send, r.sendCut], [MEMOS, 0], '작업자 캘린더 파일 ' + JSON.stringify(r.send));
      assert.ok(r.worker.length === 3 && r.worker.every(t => !TAG.test(t)), '작업자 문안에 꼬리표: ' + JSON.stringify(r.worker));
      assert.ok(r.worker[0].includes('· 현장 미지정\n주소: 시험시 새벽로 12 모란아파트 303동 704호\n작업: 우수관 1개\n문의') && !/메모:/.test(r.worker[0]), '현장 없는 일정\n' + r.worker[0]);
      assert.ok(r.worker[1].includes('· 가온아파트\n주소: 시험시 가온로 1\n작업: 방수 점검\n메모: 장소: 시험시 한밭대로 99 가상빌딩 3층 · 열쇠는 관리실\n'), '현장 주소가 먼저\n' + r.worker[1]);
      assert.ok(r.worker[2].includes('· 보람마을 2단지\n주소: 시험시 보람로 7 보람마을 2단지 205동 1101호\n작업: 타일 보수\n메모: ' + NOTE + '\n'), '주소 없는 현장\n' + r.worker[2]);
      assert.ok(r.customer.every(t => !/장소|새벽로|한밭대로|보람로|열쇠|메모|구글/.test(t)) && /방문 예정입니다/.test(r.customer[1]), '고객 문안 그대로: ' + JSON.stringify(r.customer));
      // 📤 하루치 팀 지시 — 현장 없는 일정은 원래 지시가 아니다(2건)
      assert.equal(r.n17, 2);
      assert.deepEqual(r.p2, { addr: '시험시 가온로 1', detail: '장소: 시험시 한밭대로 99 가상빌딩 3층\n열쇠는 관리실' }, '현장 주소가 있는 지시 ' + JSON.stringify(r.p2));
      assert.deepEqual(r.p3, { addr: '시험시 보람로 7 보람마을 2단지', detail: NOTE }, '주소 없는 현장의 지시 — 장소가 주소(동·호수 뗌), detail 에 다시 없음 ' + JSON.stringify(r.p3));
      assert.deepEqual(r.pa2, { addr: '', detail: '장소: 다솜빌라 관리실 (번호 삭제)' }, '전화번호가 든 장소는 주소로 안 씀 ' + JSON.stringify(r.pa2));
      assert.deepEqual(r.ph1, { addr: '시험시 가온로 1', detail: '벽지 확인 / 주차 B2' }, '손 메모 지시는 그대로 ' + JSON.stringify(r.ph1));
      assert.ok(!TAG.test(r.json) && !/205동|1101호|704호|010-2222/.test(r.json), '패킷에 꼬리표·동호수·번호: ' + r.json);
      assert.deepEqual([r.valid, r.issues], [[], []], '스키마·개인정보 검사 ' + JSON.stringify([r.valid, r.issues]));
    });

    await test('③ 출입 번호로 보이는 장소는 주소로 안 씀 · 🔒 뺀 수는 그대로 (ACCESS)', async () => {
      const r = await page.evaluate(() => {
        const a1 = state.schedule.find(s => s.id === 'a1'), days = hjSchShareDays('2026-11-23', '2026-11-23', ''), nd = notifyDrafts('2026-11-23')[0], b = hjWoBuildDay('2026-11-23');
        return { place: hjSchPlaceOf(a1), addr: hjSchShareAddr(a1), text: hjSchShareText(days, '그날', ''), cut: hjSchShareCut(days), ics: hjSchShareIcsItems(days)[0].memo, send: hjSchCalSendItems(['a1']),
          worker: nd.worker, ndCut: nd.cut, packetAddr: b.packet.orders[0].project.addr || '', tagOnly: hjMemoOut('구글 캘린더에서 가져옴 (@ 제미나이 입력)'), mixed: hjMemoOut('현관 1234#\n자재는 문 앞\n구글 캘린더에서 가져옴') };
      });
      assert.deepEqual([r.place, r.addr, r.ics, r.packetAddr], ['', '', '', ''], '출입 번호 장소 ' + JSON.stringify(r));
      const L = r.text.split('\n'), at = L.indexOf('· 09:00 누수 탐지 — 보람마을 2단지');
      assert.ok(at > 0 && L[at + 1] === '' && !/1234|주소:|공동현관/.test(r.text) && !TAG.test(r.text), '공유 글\n' + r.text);
      assert.ok(!/1234|주소:|메모:/.test(r.worker) && !TAG.test(r.worker), '작업자 문안\n' + r.worker);
      assert.deepEqual([r.cut, r.ndCut, r.send.cut, r.send.items[0].memo], [1, 1, 1, ''], '🔒 뺀 수 ' + JSON.stringify([r.cut, r.ndCut, r.send]));
      assert.deepEqual([r.tagOnly, r.mixed], [{ text: '', cut: 0 }, { text: '자재는 문 앞', cut: 1 }], '꼬리표는 세지 않는다 ' + JSON.stringify([r.tagOnly, r.mixed]));
    });

    await test('④ 그대로인 것 — 일정 메모 · 일정표 화면 · 🤖 칩 · 내 폰 캘린더(.ics) · 저장본 (KEEP)', async () => {
      const r = await page.evaluate(ids => {
        state.tab = 'schedule'; render();
        const g = id => state.schedule.find(s => s.id === id), view = document.getElementById('view');
        return { own: hjAlertIcsItems('2026-11-17').map(x => x.memo), ownTitle: hjAlertIcsItems('2026-11-17').map(x => x.title), chips: view.querySelectorAll('[data-schgemini]').length, viewText: view.textContent,
          gem: [g(ids.u1), g(ids.u2), g(ids.u3), g('m1'), g('h1')].map(hjSchGemini) };
      }, seed.ids);
      // 내 폰 캘린더(알림 .ics)는 대표 것 — 준비물 뒤에 일정 메모가 글자 그대로(장소·출처 줄 포함) 실린다
      assert.ok(r.own.length === 3 && r.own.every((m, i) => m.endsWith(seed.memos[i])), '내 폰 캘린더는 메모 그대로 ' + JSON.stringify(r.own));
      assert.deepEqual(r.ownTitle, ['우수관 1개', '[가온아파트] 방수 점검 — 시험시 가온로 1', '[보람마을 2단지] 타일 보수'], '내 폰 캘린더 제목 그대로 ' + JSON.stringify(r.ownTitle));
      assert.deepEqual(r.gem, [true, true, false, true, false], '🤖 판정 ' + JSON.stringify(r.gem));
      assert.ok(r.chips >= 3 && r.viewText.includes('구글 캘린더에서 가져옴 (@ 제미나이 입력)') && r.viewText.includes('장소: 시험시 새벽로 12 모란아파트 303동 704호'), '일정표 화면은 메모 그대로 · 🤖 칩 ' + r.chips);
      assert.equal(await page.evaluate(() => JSON.stringify(state.schedule)), before, '일정 메모는 그대로');
      assert.equal(await page.evaluate(stable), beforeAll, '저장본 불변');
    });

    await test('⑤ 손 메모는 글자 그대로 · v577 규칙 · 이어지는 날·다음 공정 안내의 주소 · 폰 390 · 핀 · 오류 0 · 바깥 쓰기 0 (REGRESS)', async () => {
      const r = await page.evaluate(() => {
        const g = id => state.schedule.find(s => s.id === id), days = hjSchShareDays('2026-11-18', '2026-11-20', '');
        return { h1: hjSchShareMemo(g('h1')), text: hjSchShareText(days, '', '').split('\n'),
          rule: [hjMemoOut('2026-11-05~2026-11-06 (2일)\n현관 1234#\n자재는 문 앞 · 주차 B2'), hjMemoOut('공동현관 폭 1100mm / 도어락 5678* / 보양비 30000원'), hjMemoOut('구글 캘린더에서 가져옴 사진 참고'),
            hjMemoOut('장소: 어디 · 메모'), hjMemoOut('장소: 어디 · 메모 · 장소: 저기', true), hjMemoOut('')],
          hand: hjHandoffText(Object.assign({}, g('a2'), { report: { progress: '완료', issue: '배관 이음 확인' } }), g('m1')) };
      });
      assert.equal(r.h1, '벽지 확인 · 주차 B2');
      const at = r.text.indexOf('■ 11/18(수)');
      assert.deepEqual(r.text.slice(at, at + 11), ['■ 11/18(수)', '· 13:00 배관 점검 — 다솜빌라', '  주소: 다솜빌라 관리실 010-2222-3333', '· 15:00 도배 — 가온아파트', '  주소: 시험시 가온로 1 · 👤 김타일 · 벽지 확인 · 주차 B2', '',
        '■ 11/19(목)', '· 08:00 실리콘 (3일 · ~11/21(토)) — 다솜빌라', '  주소: 시험시 달빛로 5 다솜빌라 · 실리콘 색 확인', '', '■ 11/20(금)'], '손 메모·여러 날\n' + r.text.join('\n'));
      assert.deepEqual(r.text.slice(at + 11, at + 13), ['· 08:00 실리콘 (2/3일째) — 다솜빌라', '  주소: 시험시 달빛로 5 다솜빌라'], '이어지는 날에도 주소\n' + r.text.join('\n'));
      assert.deepEqual(r.rule, [{ text: '자재는 문 앞 · 주차 B2', cut: 1 }, { text: '공동현관 폭 1100mm · 보양비 30000원', cut: 1 }, { text: '구글 캘린더에서 가져옴 사진 참고', cut: 0 },
        { text: '장소: 어디 · 메모', cut: 0 }, { text: '메모 · 장소: 저기', cut: 0 }, { text: '', cut: 0 }], '규칙 ' + JSON.stringify(r.rule));
      assert.ok(r.hand.includes('\n주소: 시험시 달빛로 5 다솜빌라\n전달 사항: 배관 이음 확인\n') && !TAG.test(r.hand), '다음 공정 안내\n' + r.hand);
      // 폰 390 — 공유 창
      await page.evaluate(() => hjSchShareView({ kind: 'tomorrow' }));
      await page.waitForSelector('#modalRoot #shText');
      const m = await page.evaluate(() => { const root = document.getElementById('modalRoot'), modal = root.querySelector('.modal') || root;
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, modalOver: modal.scrollWidth - modal.clientWidth,
          small: [...root.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => [b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44) }; });
      assert.ok(m.over <= 0 && m.modalOver <= 1 && m.small.length === 0, '폰 390 ' + JSON.stringify(m));
      await page.evaluate(() => closeModal(true));
      assert.equal(await page.evaluate(stable), beforeAll, '저장본 불변');
      await context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    console.log(`teamtext-v605: ${passed}/5 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL teamtext-v605 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
