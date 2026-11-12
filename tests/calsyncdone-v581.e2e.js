/* v581 🔄 맞추기 반영 뒤 '바뀐 일정 알리기' — 반영하고 나면 토스트만 떠서, 팀·고객에게 알리려면 📤 일정 공유에서 범위를 다시 골라야 했다
   (v353 뒤 일정 같이 옮기기에는 알림 창이 있는데 맞추기엔 없었다). 📤 일정 공유는 ids 를 받아도 ids[0] 하나만 썼다.
   합성 자료(이름·번호는 지어낸 것), 시계 2026-11-10 고정, 문자 앱·복사·캘린더 파일은 가로채 기록만, 바깥 쓰기 0.
   ① 반영 → 결과 창 — 바뀐·새 일정 id(지운 것 빼고) · 현장별 옛 → 새 줄 · 고객 단추는 현장 있을 때만(번호 없으면 '글 복사') · 지운 것만이면 창 없음 (DONE)
   ② [📤 바뀐 일정 팀에 공유] — 공유 창에 바뀐 일정 전부(여러 날은 날마다) · 제목 '바뀐 일정 n건' · 범위 칩 없음 · 출입 번호 뺌 · .ics 도 같은 일정 · ‹ 뒤로 = 결과 창
      · 담당 없는 일정이 섞이면 번호를 미리 채우지 않고 '👥 팀원별로 보내기'(그 사람 일정만) · 모두 같은 한 사람 담당이면 번호
      · 일정 하나 공유는 예전 그대로 · 담당 둘이면 번호 비움 · 없는 일정만이면 안 열림 (SHARE)
   ③ 현장마다 [✉️ 고객 일정 안내] — 번호 있으면 문자 앱(그 현장 줄만·시각·여러 날·새 일정), 없으면 글 복사 · v353 안내 글은 그대로 (CUSTOMER)
   ④ 창·공유·안내 단추를 다 눌러도 저장본 불변 · 자동 발송 없음 · 지운 일정이 다시 나오지 않음 (NOSAVE)
   ⑤ 보관한 현장은 고객 단추 없음 · 예전 맞추기가 끝 날짜로 넣은 일정의 '바로잡기' 줄은 고객 글에서 빠짐 · 구글 제목의 꺾쇠·& 는 글자로 (FIXROWS)
   ⑥ 폰 390 — 결과 창·공유 창 넘침 없음·44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V581_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V581_MUTATION — no-done(결과 창 없음)은 ①, first-only(공유가 ids[0] 만)·any-crew(담당 있는 일정만 보고 번호)는 ②,
   no-escape(제목 그대로 HTML)·cust-archived(보관 현장에도 고객 단추)·fix-cust(바로잡기 줄도 고객 글에)는 ⑤ 에서 실패해야 한다.
   결과 창은 시간 초과가 아니라 '반영 끝(맞추기 창 닫힘) 뒤 창이 있는가'를 단언해 떨어진다. */
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
  'no-done': ['\n        if(r.list.length)hjCalSyncDone(r);}', '}'],
  'any-crew': ["const fixedOne=crewSets.length&&crewSets.every(l=>l.length===1&&l[0]===crewSets[0][0])?crewSets[0][0]:'';", "const fixedOne=(u=>u.length===1?u[0]:'')([...new Set(crewSets.flat())]);"],
  'no-escape': ["'+icon(x)+' '+escapeHtml(nm(x))+' · '+", "'+icon(x)+' '+nm(x)+' · '+"],
  'cust-archived': ["(p&&!arch&&cust?'<button", "(p&&cust?'<button"],
  'fix-cust': ['const custRows=g=>g.rows.filter(x=>!x.fix);', 'const custRows=g=>g.rows;'],
  'first-only': ['const picked=ids.map(id=>(state.schedule||[]).find(s=>s&&s.id===id)).filter(Boolean);', 'const picked=ids.slice(0,1).map(id=>(state.schedule||[]).find(s=>s&&s.id===id)).filter(Boolean);']
};
let html = process.env.HJ_V581_BASELINE ? execFileSync('git', ['show', process.env.HJ_V581_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V581_MUTATION) {
  const m = MUT[process.env.HJ_V581_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V581_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const TEXT = [
  '종일, 타일, 홍길동, 위치 없음, 2026년 11월 13일~2026년 11월 16일',           // A 옮김(여러 날)
  '오후 2시~오후 3시, 실리콘, 홍길동, 위치 없음, 2026년 11월 17일',               // B 시간 다름
  '오전 9시~오전 10시, @욕실 점검, 홍길동, 위치 없음, 2026년 11월 16일',          // 새 일정 → 가온아파트
  '종일, 벌곡 방문, 홍길동, 위치 없음, 2026년 11월 16일',                          // 새 일정 → 현장 없이
  '종일, 청소, 홍길동, 위치 없음, 2026년 11월 20일',                               // D 옮김(나래, 고객 번호 없음)
  '종일, 도배, 홍길동, 위치 없음, 2026년 11월 18일'                                // C 이미 같음
].join('\n');

let browser, passed = 0;
const errors = [], confirms = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calsyncdone-v581 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); if (dialog.type() === 'confirm' && /앱에만 있는 일정 1건/.test(dialog.message())) { confirms.push(dialog.message()); return dialog.accept(); } errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
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
    window.__sms = []; window.__copied = []; window.__ics = []; window.__kakao = [];
    window.hjSmsGo = u => { window.__sms.push(u); };
    window.coworkCopy = (t, l) => { window.__copied.push([l, t]); };
    window.saveICSToPhone = async (items, name) => { window.__ics.push({ name, items: JSON.parse(JSON.stringify(items)) }); return { 완료: '저장' }; };
    window.kakaoShareText = (t, title) => { window.__kakao.push([title, t]); };
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const P = (name, customer) => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: Object.assign({ name: '', phone: '', addr: '' }, customer || {}), archived: false });
  state.projects = [P('가온아파트', { name: '김가온', phone: '010-1111-2222', addr: '시험시 가온로 1' }), P('나래마을아파트', { name: '이나래' }), P('다솜아파트')];
  state.contacts = [{ id: 'k1', name: '김타일', phone: '010-3333-4444', team: true }, { id: 'k2', name: '박도배', phone: '010-5555-6666', team: true }];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  const S = (id, date, time, title, project, extra) => Object.assign({ id, date, time, title, project, workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [
    S('A', '2026-11-12', '', '타일', '가온아파트', { crew: '김타일', memo: '2026-11-12~2026-11-14 (3일)\n현관 1234#\n자재는 문 앞' }),
    S('B', '2026-11-17', '10:00', '실리콘', '가온아파트', { crew: '김타일', hours: 1 }),
    S('C', '2026-11-18', '', '도배', '나래마을아파트', { crew: '박도배' }),
    S('D', '2026-11-19', '', '청소', '나래마을아파트'),
    S('X', '2026-11-15', '09:00', '앱에만 있는 일정', '다솜아파트')];
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
// 반영 단추 → 맞추기 창이 닫힐 때까지(실패면 오류 토스트) → 결과 창이 있는지 단언(창이 안 뜨는 회귀가 시간 초과가 아니라 단언 실패로)
async function applyAndDone(page) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.click('#csApply');
  await page.waitForFunction(() => !document.querySelector('#hjCalSync') || /안전판을 만들지 못해|바뀌었어요|체크하세요|오래된 창/.test(document.getElementById('toast').textContent));
  const st = await page.evaluate(() => ({ open: !!document.querySelector('#hjCalSync'), toast: document.getElementById('toast').textContent, done: !!document.querySelector('#modalRoot #hjCalSyncDone') }));
  assert.equal(st.open, false, '반영이 끝나 맞추기 창이 닫혀야 함 — ' + st.toast);
  assert.ok(st.done, '반영 뒤 「바뀐 일정 알리기」 창이 떠야 함 — 토스트: ' + st.toast);
}
const SNAP = () => { const d = JSON.parse(JSON.stringify(serializeData())); delete d.savedAt; return JSON.stringify(d); };

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    let after = '';
    await test('① 반영 → 결과 창 — 바뀐·새 일정(지운 것 빼고) · 현장별 옛 → 새 · 고객 단추 · 지운 것만이면 창 없음 (DONE)', async () => {
      await page.evaluate(() => { const o = hjCalSyncApply; window.hjCalSyncApply = async (...a) => { const r = await o(...a); window.__applyRes = r; return r; }; });
      await page.click('#view #schCalSync');
      await page.fill('#csText', TEXT); await page.click('#csRead');
      await page.waitForSelector('#csBody [data-cs-row]');   // 앱에만 있음 줄은 아래 단언이 본다(기준선은 읽는 꼴이 달라 그 줄이 없을 수 있다 — 결과 창 단언까지 가게)
      await page.evaluate(() => { const rows = window.__hjCalSyncPlan.rows, root = document.getElementById('hjCalSync');
        rows.forEach((r, i) => { if (r.status === 'new') root.querySelector('.csSel[data-i="' + i + '"]').value = /욕실/.test(r.title) ? '가온아파트' : ''; if (r.status === 'apponly') root.querySelector('.csChk[data-i="' + i + '"]').checked = true; }); });
      await applyAndDone(page);
      const r = await page.evaluate(() => {
        const box = document.getElementById('hjCalSyncDone'), res = window.__applyRes, byTitle = t => (state.schedule.find(s => s.title === t) || {}).id;
        return { X: state.schedule.some(s => s.id === 'X'), title: document.querySelector('#modalRoot .modal').innerText.split('\n')[0],
          res: [res.added, res.changed, res.removed], ids: res.ids.slice().sort(), want: ['타일', '실리콘', '욕실 점검', '벌곡 방문', '청소'].map(byTitle).sort(),
          shown: [...box.querySelectorAll('[data-csd-row]')].map(x => x.dataset.id).sort(),
          groups: [...box.querySelectorAll('[data-csd-group]')].map(g => [g.dataset.csdGroup, [...g.querySelectorAll('[data-csd-row]')].map(x => [x.dataset.csdRow, x.innerText.replace(/\s+/g, ' ').trim()]), (g.querySelector('.csdCust') || {}).innerText || '']),
          foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.innerText.trim()) };
      });
      assert.equal(r.X, false, '앱에만 있던 일정은 지움(확인 뒤)'); assert.equal(confirms.length, 1);
      assert.match(r.title, /바뀐 일정 알리기/, r.title);
      assert.deepEqual(r.res, [2, 3, 1], '추가 2 · 바꿈 3 · 지움 1');
      assert.deepEqual(r.ids, r.want, '바뀐·새 일정 id 5개(지운 X 없음) — ' + JSON.stringify(r));
      assert.deepEqual(r.shown, r.want, '결과 창 줄 = 그 id');
      assert.deepEqual(r.groups, [
        ['가온아파트', [['move', '📆 타일 · 11/12(목)~11/14(토) 종일 → 11/13(금)~11/16(월) 종일'], ['new', '🆕 욕실 점검 · 새 일정 11/16(월) 09:00'], ['time', '⏰ 실리콘 · 11/17(화) 10:00 → 11/17(화) 14:00']], '✉️ 고객 일정 안내'],
        ['나래마을아파트', [['move', '📆 청소 · 11/19(목) 종일 → 11/20(금) 종일']], '✉️ 고객 일정 안내 (번호 없음 — 글 복사)'],
        ['', [['new', '🆕 벌곡 방문 · 새 일정 11/16(월) 종일']], '']], JSON.stringify(r.groups));
      assert.deepEqual(r.foot, ['📤 바뀐 일정 팀에 공유', '닫기']);
      after = await page.evaluate(SNAP);
      await page.evaluate(() => { window.__mainRes = window.__applyRes; });
      // 지운 것만 반영하면 결과 창 없이 토스트만 · 알릴 일정이 모두 지워졌으면 창을 열지 않음
      const only = await page.evaluate(async () => {
        closeModal(true);
        state.schedule.push(Object.assign(newSchedule(), { id: 'Y', date: '2026-11-21', time: '', title: '혼자 남은 일정', project: '' }));
        const plan = hjCalSyncPlan(hjCalSyncParse('종일, 다른 일정, 홍길동, 위치 없음, 2026년 11월 21일'));
        const i = plan.rows.findIndex(x => x.status === 'apponly'), res = await hjCalSyncApply(plan, [{ i }]);
        return { res: [res.added, res.changed, res.removed, res.ids.length, res.list.length], modal: !!document.querySelector('#modalRoot .modal'),
          none: hjCalSyncDone({ list: [{ id: 'Y', kind: 'move', title: '없음', project: '', from: null, to: { date: '2026-11-21', time: '', to: '' } }], removed: 1 }) };
      });
      assert.deepEqual(only, { res: [0, 0, 1, 0, 0], modal: false, none: null }, '지운 것은 알릴 목록에 없음 — ' + JSON.stringify(only));
    });
    await test('② 팀 공유 — 바뀐 일정 전부 · 제목 · 범위 칩 없음 · 담당 번호 · 출입 번호 뺌 · .ics · ‹ 뒤로 · 하나·담당 둘·없는 일정 (SHARE)', async () => {
      await page.evaluate(() => hjCalSyncDone(window.__mainRes));
      await page.waitForSelector('#modalRoot #hjCalSyncDone');
      await page.click('#modalRoot .mfoot button:has-text("바뀐 일정 팀에 공유")');
      await page.waitForSelector('#modalRoot #shText');
      const r = await page.evaluate(() => { const cut = document.querySelector('[data-sh-cut]');
        return { title: document.querySelector('#modalRoot .modal').innerText.split('\n')[0], text: document.getElementById('shText').value, chips: document.querySelectorAll('#modalRoot .shRange').length,
          phone: document.getElementById('shPhone').value, cut: cut ? cut.dataset.shCut : '', count: document.getElementById('shCount').innerText,
          month: !!document.getElementById('shMonth'), perCrew: [...document.querySelectorAll('#shPerCrew > div:not(:first-child)')].map(x => x.innerText.replace(/\s+/g, ' ').replace(/ ✉️ 문자 💬 카톡$/, '').trim()), foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.innerText.trim()) }; });
      assert.match(r.title, /📤 일정 공유 — 바뀐 일정 5건/, r.title);
      for (const t of ['타일', '실리콘', '욕실 점검', '벌곡 방문', '청소']) assert.ok(r.text.includes(t), t + ' 가 공유 글에 — ' + r.text);
      assert.ok(r.text.includes('타일 (2/3일째)') && r.text.includes('타일 (3/3일째)'), '여러 날은 날마다 — ' + r.text);
      assert.ok(!r.text.includes('도배') && !r.text.includes('앱에만'), '바뀌지 않은·지운 일정은 없음');
      assert.ok(!/1234/.test(r.text) && r.text.includes('자재는 문 앞') && r.cut === '1', '출입 번호 뺌(v577) — ' + r.cut);
      assert.deepEqual([r.chips, r.month, r.phone], [0, false, ''], '범위 칩 없음 · 담당 없는 일정(욕실 점검·벌곡 방문·청소)이 섞여 번호는 비움');
      assert.deepEqual(r.perCrew, ['👤 김타일 · 4건', '담당 없는 일정 3건은 팀원별 글에 들어가지 않아요.'], '팀원별로 보내기 — 김타일 담당만(타일 3일 + 실리콘) — ' + JSON.stringify(r.perCrew));
      await page.click('#modalRoot #shPerCrew .shPcSms');
      const pc = await page.evaluate(() => { const u = window.__sms.pop(); return [u.split('?')[0], decodeURIComponent(u.split('body=')[1] || '')]; });
      assert.equal(pc[0], 'sms:01033334444');
      assert.ok(pc[1].includes('바뀐 일정 5건 · 김타일') && pc[1].includes('타일') && pc[1].includes('실리콘') && !/욕실|벌곡|청소|1234/.test(pc[1]), '김타일 글에는 김타일 일정만 — ' + pc[1]);
      assert.ok(/일정 7건/.test(r.count), '타일 3일 + 4건 — ' + r.count);
      assert.deepEqual(r.foot, ['‹ 뒤로', '닫기']);
      await page.click('#modalRoot #shCal');
      const ics = await page.evaluate(() => window.__ics.pop());
      assert.ok(/바뀐 일정 5건/.test(ics.name), ics.name);
      assert.equal(ics.items.length, 7); assert.ok(!ics.items.some(x => /1234/.test(x.memo)), '.ics 메모에도 출입 번호 없음');
      await page.click('#modalRoot .mfoot button:has-text("뒤로")');
      await page.waitForSelector('#modalRoot #hjCalSyncDone');
      const more = await page.evaluate(() => {
        const g = t => state.schedule.find(s => s.title === t).id, out = {};
        hjSchShareView({ ids: [g('타일')] });
        out.one = [document.querySelector('#modalRoot .modal').innerText.split('\n')[0], document.getElementById('shPhone').value, document.querySelectorAll('#modalRoot .shRange').length];
        hjSchShareView({ ids: [g('타일'), g('도배')] });
        out.two = [document.getElementById('shPhone').value, /도배/.test(document.getElementById('shText').value), document.querySelector('#modalRoot .modal').innerText.split('\n')[0]];
        hjSchShareView({ ids: [g('타일'), g('실리콘')] });
        out.same = [document.getElementById('shPhone').value, !!document.getElementById('shPerCrew')];
        closeModal(true);
        out.none = [hjSchShareView({ ids: ['없는일정'] }), !!document.querySelector('#modalRoot .modal')];
        return out;
      });
      assert.deepEqual(more.one, ['📤 일정 공유 — 타일', '010-3333-4444', 0], '일정 하나는 예전 그대로 — ' + JSON.stringify(more.one));
      assert.deepEqual(more.two, ['', true, '📤 일정 공유 — 고른 일정 2건'], '담당 둘(김타일·박도배)이면 번호 비움 — ' + JSON.stringify(more.two));
      assert.deepEqual(more.same, ['010-3333-4444', false], '모두 같은 한 사람(김타일) 담당이면 그 번호 · 팀원별 줄 없음 — ' + JSON.stringify(more.same));
      assert.deepEqual(more.none, [undefined, false], '없는 일정만이면 안 열림');
    });
    await test('③ 고객 일정 안내 — 번호 있으면 문자 앱(그 현장 줄만·시각·여러 날·새 일정) · 없으면 복사 · v353 글 그대로 (CUSTOMER)', async () => {
      await page.evaluate(() => hjCalSyncDone(window.__mainRes));
      await page.waitForSelector('#modalRoot #hjCalSyncDone');
      await page.click('#hjCalSyncDone [data-csd-group="가온아파트"] .csdCust');
      await page.click('#hjCalSyncDone [data-csd-group="나래마을아파트"] .csdCust');
      const r = await page.evaluate(() => ({ sms: window.__sms.slice(), copied: window.__copied.slice(), open: !!document.getElementById('hjCalSyncDone'),
        v353: hjScheduleChangeText(state.projects[0], [{ title: '도배 (2일차 시작)', from: '2026-11-12', to: '2026-11-13' }]) }));
      assert.equal(r.sms.length, 1); assert.ok(r.sms[0].startsWith('sms:01011112222?body='), r.sms[0]);
      const body = decodeURIComponent(r.sms[0].split('body=')[1]);
      assert.ok(body.includes('가온아파트 공사 일정 변경 안내') && body.includes('김가온님'), body);
      assert.ok(body.includes('\n· 타일: 11/12(목)~11/14(토) → 11/13(금)~11/16(월)\n'), '여러 날 끝까지 — ' + body);
      assert.ok(body.includes('\n· 실리콘: 11/17(화) 10:00 → 11/17(화) 14:00\n'), '시각 — ' + body);
      assert.ok(body.includes('\n· 욕실 점검: 11/16(월) 09:00 (새 일정)\n'), '새 일정 — ' + body);
      assert.ok(!/청소|벌곡|1234/.test(body), '다른 현장·현장 없는 줄·메모는 안 들어감');
      assert.equal(r.copied.length, 1); assert.equal(r.copied[0][0], '일정 변경 안내 글');
      assert.ok(r.copied[0][1].includes('이나래님') && r.copied[0][1].includes('\n· 청소: 11/19(목) → 11/20(금)\n'), r.copied[0][1]);
      assert.ok(r.open, '단추를 눌러도 결과 창은 그대로');
      assert.ok(r.v353.includes('\n· 도배: 11/12(목) → 11/13(금)\n'), 'v353 글은 그대로 — ' + r.v353);
      await page.evaluate(() => closeModal(true));
    });
    await test('④ 창·공유·안내를 다 눌러도 저장본 불변 · 자동 발송 없음 (NOSAVE)', async () => {
      const now = await page.evaluate(SNAP);
      assert.equal(now, after, '결과 창·공유 창·고객 안내 단추는 아무것도 저장하지 않음(Y 는 넣었다 지움)');
      const r = await page.evaluate(() => ({ sms: window.__sms.length, kakao: window.__kakao.length, removed: state.schedule.some(s => s.id === 'X' || s.id === 'Y') }));
      assert.deepEqual(r, { sms: 1, kakao: 0, removed: false }, '문자 앱은 누른 한 번만 · 카톡 0 · 지운 일정은 그대로 없음 — ' + JSON.stringify(r));
    });
    await test('⑤ 보관 현장 · 예전 읽기 바로잡기 · 제목의 꺾쇠 (FIXROWS)', async () => {
      const r = await page.evaluate(async () => {
        closeModal(true);
        state.projects.push({ name: '보관현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정보관', phone: '010-7777-8888', addr: '' }, archived: true });
        state.schedule = [
          Object.assign(newSchedule(), { id: 'Q', date: '2026-11-12', time: '', title: '점검', project: '보관현장' }),
          Object.assign(newSchedule(), { id: 'G', date: '2026-11-09', time: '', title: '퍼티', project: '가온아파트', memo: '구글 캘린더에서 가져옴', icsUid: 'gcal:2026-11-09|퍼티' }),
          Object.assign(newSchedule(), { id: 'M', date: '2026-11-17', time: '', title: '몰딩', project: '가온아파트' })];
        const plan = hjCalSyncPlan(hjCalSyncParse(['종일, 점검, 홍길동, 위치 없음, 2026년 11월 13일', '종일, 퍼티, 홍길동, 위치 없음, 2026년 11월 6일~2026년 11월 9일',
          '종일, 몰딩, 홍길동, 위치 없음, 2026년 11월 18일', '종일, <b>욕실</b> & 창호, 홍길동, 위치 없음, 2026년 11월 21일'].join('\n')));
        const res = await hjCalSyncApply(plan, plan.rows.map((x, i) => ({ i })).filter(p => plan.rows[p.i].check));
        hjCalSyncDone(res);
        const box = document.getElementById('hjCalSyncDone'), grp = k => box.querySelector('[data-csd-group="' + k + '"]');
        const out = { rows: plan.rows.map(x => [x.status, x.fix ? 'fix' : '', x.app ? x.app.id : '']),
          arch: [!!grp('보관현장').querySelector('[data-csd-archived]'), !!grp('보관현장').querySelector('.csdCust'), grp('보관현장').querySelectorAll('[data-csd-row]').length],
          fixRow: grp('가온아파트').querySelector('[data-csd-fix]') ? grp('가온아파트').querySelector('[data-csd-fix]').innerText.replace(/\s+/g, ' ').trim() : '',
          esc: [grp('').querySelector('[data-csd-row]').innerText.replace(/\s+/g, ' ').trim(), [...grp('').querySelectorAll('[data-csd-row] b')].map(b => b.innerText)] };
        window.__sms.length = 0; window.__copied.length = 0;
        grp('가온아파트').querySelector('.csdCust').click();
        out.sms = window.__sms.map(u => decodeURIComponent(u.split('body=')[1] || ''));
        // 바로잡기 줄만 남은 현장은 고객 단추 없이 안내 한 줄
        closeModal(true);
        hjCalSyncDone({ list: res.list.filter(x => x.fix), removed: 0 });
        out.onlyFix = [!!document.querySelector('#hjCalSyncDone [data-csd-group="가온아파트"] .csdCust'), !!document.querySelector('#hjCalSyncDone [data-csd-nocust]')];
        closeModal(true);
        return out;
      });
      assert.deepEqual(r.rows, [['new', '', ''], ['move', 'fix', 'G'], ['move', '', 'Q'], ['move', '', 'M']], JSON.stringify(r.rows));
      assert.deepEqual(r.arch, [true, false, 1], '보관한 현장은 줄은 보이고 고객 단추는 없음 — ' + JSON.stringify(r.arch));
      assert.ok(r.fixRow.startsWith('🛠 퍼티 · 11/9(월) 종일 → 11/6(금)~11/9(월) 종일') && r.fixRow.includes('고객 안내 글에서 뺌'), r.fixRow);
      assert.equal(r.sms.length, 1);
      assert.ok(r.sms[0].includes('· 몰딩: 11/17(화) → 11/18(수)') && !r.sms[0].includes('퍼티'), '바로잡기 줄은 고객 글에서 빠짐 — ' + r.sms[0]);
      assert.ok(r.esc[0].startsWith('🆕 <b>욕실</b> & 창호 · 새 일정'), '구글 제목의 꺾쇠·& 는 글자로 — ' + r.esc[0]);
      assert.deepEqual(r.esc[1], ['11/21(토) 종일'], '줄 안 굵은 글씨는 날짜 하나뿐(제목이 태그로 바뀌지 않음) — ' + JSON.stringify(r.esc[1]));
      assert.deepEqual(r.onlyFix, [false, true], '바로잡기 줄만이면 고객 단추 없이 안내 — ' + JSON.stringify(r.onlyFix));
    });
    await context.close();
    await test('⑥ 폰 390 — 결과 창·공유 창 넘침 없음 · 44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED);
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await m.page.waitForSelector('#csBody [data-cs-row]');
      await applyAndDone(m.page);
      const measure = () => m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal');
        const small = [...root.querySelectorAll('button,select,input')].filter(b => b.getClientRects().length).map(b => [b.tagName, b.innerText || b.id, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[2] < 43.9);
        const wide = [...root.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).length;
        const font = [...root.querySelectorAll('input,textarea,select')].filter(x => x.getClientRects().length).map(x => parseFloat(getComputedStyle(x).fontSize)).filter(f => f < 16);
        return { small, wide, font, over: document.documentElement.scrollWidth - innerWidth }; });
      const a = await measure();
      assert.ok(a.wide === 0 && a.over <= 1, '결과 창 넘침 없음 — ' + JSON.stringify(a));
      assert.deepEqual(a.small, [], '결과 창 44px 미만 — ' + JSON.stringify(a.small));
      await m.page.click('#modalRoot .mfoot button:has-text("바뀐 일정 팀에 공유")');
      await m.page.waitForSelector('#modalRoot #shText');
      const b = await measure();
      assert.ok(b.wide === 0 && b.over <= 1 && !b.font.length, '공유 창 넘침·글자 — ' + JSON.stringify(b));
      await m.context.close();
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const x = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], y = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], z = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(x && x === y && y === z, '핀 3곳 같음 ' + [x, y, z].join(' / '));
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`calsyncdone-v581: ${passed}/6 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calsyncdone-v581 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
