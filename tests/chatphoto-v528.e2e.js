/* v528 💬 카톡 보고 대조·사진 배정 — 10/31 대표 "개발 계속 진행". 협력사 톡방 대화 내보내기(.txt)의 '사진 N장 + 현장 이름' 보고로
   ① 보고했는데 앱 사진이 모자란 곳(누락 의심)을 찾고 ② 현장 없는 사진의 현장을 제안한다. 합성 자료만(실제 대화·고객 아님), 바깥 쓰기 0.
   ① 읽기: PC 내보내기(날짜 줄·[이름] [오후 h:mm]·여러 줄 글)·폰 내보내기(2026년 8월 4일 오후 4:12, 이름 : …·2026. 8. 4. 오전 12:05, …) · 톡방 이름 (PARSE)
   ② 보고: 사진 뒤(30분 안)·앞(10분 안) 같은 사람 글에서 현장 · 상대 글 무시 · 현장 못 찾은 보고 · 연달아 보낸 사진 메시지(카톡 30장 묶음)는 한 보고 · '나' = 사진 보고가 가장 많은 사람 (REPORTS)
   ③ 대조: 앱 사진이 보낸 장수 이상 ✓ / 모자람 ⚠ / 14일 안 앞선 보고와 같은 사진 다시 보냄 / 서류 사진(합치지 않음) / 글에 적힌 날짜 기준 / 이름의 촬영 시각 (AUDIT)
   ④ 제안: 이름의 촬영 시각 우선 · 카톡 저장 사진·화면 캡처 제외 · 72시간 · 장수 같고 12시간 안일 때만 체크 · 상대 보고 무시 (PLAN)
   ⑤ 화면: 사진 도구 메뉴·🧭 창의 입구 · 누락 목록 · 체크·현장 기본값 · 안전판 실패 → 무변경 · [체크한 묶음 배정] → 안전판 1회 → 배정 · 다시 열면 누락 1건 (UI)
   ⑥ 소스·핀 3곳(v528 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V528_BASELINE=<commit> 은 ① 에서, HJ_V528_MUTATION=no-me 는 ④ 에서, merge-doc(서류 사진을 사진 보고와 합침) 은 ③ 에서 실패해야 한다. */
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
let html = process.env.HJ_V528_BASELINE ? execFileSync('git', ['show', process.env.HJ_V528_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V528_MUTATION === 'no-me') {
  const from = "  const evs=hjChatMerge((reports||[]).filter(e=>(!me||e.who===me)&&!HJ_CHAT_DOC_RE.test(String(e.text||''))));\n";
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, "  const evs=hjChatMerge((reports||[]).filter(e=>!HJ_CHAT_DOC_RE.test(String(e.text||''))));\n");
}
if (process.env.HJ_V528_MUTATION === 'merge-doc') {
  const from = "  const evs=hjChatMerge(mine.filter(e=>!isDoc(e))).concat(mine.filter(isDoc).map(e=>Object.assign({},e))).sort((a,b)=>a.t-b.t);\n";
  assert(SRC.includes(from), 'mutation anchor merge-doc');
  html = SRC.replace(from, "  const evs=hjChatMerge(mine);\n");
}

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}
// 합성 대화(PC 내보내기) — '나' = 박기사. 상대(김반장)도 사진을 보낸다.
const CHAT_PC = [
  '김반장 님과 카카오톡 대화', '저장한 날짜 : 2026-10-31 05:08:10', '',
  '--------------- 2026년 8월 4일 화요일 ---------------',
  '[박기사] [오전 9:37] 사진 3장',
  '[박기사] [오전 9:39] 가온아파트 3동 105호 지하실',
  '배수관 교체 완료했습니다',
  '[박기사] [오후 2:37] 사진 2장',
  '[박기사] [오후 2:39] 월요일 작업',
  '나래아파트 812동 1203호',
  '[김반장] [오후 3:00] 사진 5장',
  '[김반장] [오후 3:01] 다솜아파트 확인 부탁',
  '--------------- 2026년 8월 13일 목요일 ---------------',
  '[박기사] [오후 4:25] 사진 4장',
  '[박기사] [오후 4:25] 시험로 123 다솜아파트 1동 902호',
  '[박기사] [오후 5:00] 사진',
  '[박기사] [오후 5:01] 다솜아파트 견적서 송부드립니다',
  '--------------- 2026년 9월 29일 화요일 ---------------',
  '[박기사] [오전 10:35] 사진 2장',
  '[박기사] [오전 10:36] 9월 23일 가온아파트 3-105',
  '-방수 완료',
  '[박기사] [오후 1:00] 사진 30장',
  '[박기사] [오후 1:01] 사진 22장',
  '[박기사] [오후 1:02] 작업 사진 공유드립니다',
].join('\n');
const CHAT_ANDROID = ['2026년 8월 20일 오전 9:00, 박기사 : 사진 2장', '2026년 8월 20일 오전 9:05, 박기사 : 가온아파트 3동 105호 2차', '2026. 8. 21. 오전 12:05, 박기사 : 사진', '2026. 8. 21. 오후 12:10, 박기사 : 늦은 메모'].join('\n');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS chatphoto-v528 ' + name); }
  const { context, page } = await openPage();
  // 현장 3곳(사진이 있어야 후보 감점이 없다) · 앱 사진: 가온 8/4 아침 3장(✓) · 나래 8/3 1장(모자람) · 다솜 8/13 오후 4장 중 2장 '현장 없음' · 9/23 가온 2장
  const SEED = () => page.evaluate(px => {
    const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
    state._demo = false;
    state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
    let k = 0; const ph = (name, project, when) => state.files.push({ id: 'p' + (++k), name, ext: 'jpg', kind: 'photo', project, when: new Date(when), size: 1000 + k, thumb: px });
    state.files = []; state.quotes = [];
    ph('20260804_080000.jpg', '가온아파트', '2026-08-04T08:00:00+09:00'); ph('20260804_080100.jpg', '가온아파트', '2026-08-04T08:01:00+09:00'); ph('20260804_080200.jpg', '가온아파트', '2026-08-04T08:02:00+09:00');
    ph('20260803_150000.jpg', '나래아파트', '2026-08-03T15:00:00+09:00');
    ph('20260813_150000.jpg', '다솜아파트', '2026-08-13T15:00:00+09:00'); ph('20260813_150100.jpg', '다솜아파트', '2026-08-13T15:01:00+09:00');
    ph('20260813_150200.jpg', '', '2026-08-13T15:02:00+09:00'); ph('20260813_150300.jpg', '', '2026-08-13T15:03:00+09:00');   // 다솜 보고(4장) 앞의 현장 없는 사진 2장 + 이미 2장 → 장수 같음
    ph('20260923_100000.jpg', '가온아파트', '2026-10-15T10:00:00+09:00'); ph('20260923_100100.jpg', '가온아파트', '2026-10-15T10:01:00+09:00');   // when 이 올린 날 — 이름 시각(9/23)이 먼저
    ph('IMG_0001.jpg', '', '2026-08-04T13:00:00+09:00');   // 나래 보고(2시 37분) 전 1장 — 장수 다름(2장) → 참고
    ph('KakaoTalk_20260804_133000123.jpg', '', '2026-08-04T13:30:00+09:00');   // 카톡 저장 — 제외
    ph('codex-clipboard-1.png', '', '2026-08-04T13:40:00+09:00');   // 화면 캡처 — 제외
    ph('IMG_0002.jpg', '', '2026-08-04T14:55:00+09:00');   // 상대(김반장 3:00) 보고 직전 — '나' 보고만 쓰면 다음 내 보고(8/13)까지 72시간 넘어 제안 없음
    ph('IMG_0003.jpg', '', '2026-07-01T10:00:00+09:00');   // 보고 없음
    state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
  }, PX);

  await test('① 읽기 — PC·폰 내보내기, 여러 줄 글, 오전 12시 (PARSE)', async () => {
    const r = await page.evaluate(({ pc, an }) => {
      const a = hjChatParse(pc, 'KakaoTalk_20261031_0508_12_888_김반장.txt'), b = hjChatParse(an, 'KakaoTalk_20261031_0510_33_101_현장톡.txt');
      const t = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
      return { room: a.room, n: a.msgs.length, m1: [t(a.msgs[1].t), a.msgs[1].who, a.msgs[1].text], m3: a.msgs[3].text, broom: b.room, b: b.msgs.map(m => [t(m.t), m.who, m.text]) };
    }, { pc: CHAT_PC, an: CHAT_ANDROID });
    assert(r.room === '김반장' && r.n === 15, 'PARSE room/count ' + JSON.stringify(r));
    assert.deepEqual(r.m1, ['2026-8-4 9:39', '박기사', '가온아파트 3동 105호 지하실\n배수관 교체 완료했습니다']);
    assert.equal(r.m3, '월요일 작업\n나래아파트 812동 1203호');
    assert.equal(r.broom, '현장톡');
    assert.deepEqual(r.b, [['2026-8-20 9:0', '박기사', '사진 2장'], ['2026-8-20 9:5', '박기사', '가온아파트 3동 105호 2차'], ['2026-8-21 0:5', '박기사', '사진'], ['2026-8-21 12:10', '박기사', '늦은 메모']]);
  });

  await test('② 보고 — 사진 앞뒤 같은 사람 글 · 상대 무시 · 현장 못 찾음 · 연달아 보낸 사진 · 나 (REPORTS)', async () => {
    await SEED();
    const r = await page.evaluate(({ pc }) => {
      const reps = hjChatReports([hjChatParse(pc, 'a.txt')]);
      const t = d => (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
      return { me: hjChatMe(reps), reps: reps.map(e => [t(e.t), e.who, e.n, e.project]), merged: hjChatMerge(reps).map(e => [t(e.t), e.n, e.project]) };
    }, { pc: CHAT_PC });
    assert.equal(r.me, '박기사');
    assert.deepEqual(r.reps, [['8/4 9:37', '박기사', 3, '가온아파트'], ['8/4 14:37', '박기사', 2, '나래아파트'], ['8/4 15:0', '김반장', 5, '다솜아파트'], ['8/13 16:25', '박기사', 4, '다솜아파트'], ['8/13 17:0', '박기사', 1, '다솜아파트'], ['9/29 10:35', '박기사', 2, '가온아파트'], ['9/29 13:0', '박기사', 30, ''], ['9/29 13:1', '박기사', 22, '']], 'REPORTS ' + JSON.stringify(r.reps));
    assert.deepEqual(r.merged.slice(-1), [['9/29 13:1', 52, '']], 'REPORTS consecutive photo messages merged ' + JSON.stringify(r.merged));
  });

  await test('③ 대조 — ✓ · 누락 의심 · 앞서 보낸 사진 · 서류 사진 · 글의 날짜 기준 (AUDIT)', async () => {
    const r = await page.evaluate(({ pc }) => {
      const reps = hjChatReports([hjChatParse(pc, 'a.txt')]);
      // 8/15 에 가온 3장을 다시 보냄(11일 앞선 8/4 보고 ✓) — 모자라도 '앞서 보낸 사진'
      reps.push({ t: new Date('2026-08-15T10:00:00+09:00'), n: 3, room: 'b', who: '박기사', text: '가온아파트 3동 105호 다시', project: '가온아파트', why: '' });
      // 9/29 가온 보고(2장 ✓) 10분 뒤 같은 톡방에 견적서 사진 — 사진 보고와 합치면 3장이 되어 '누락 의심'으로 잘못 잡힌다
      reps.push({ t: new Date('2026-09-29T10:45:00+09:00'), n: 1, room: '김반장', who: '박기사', text: '가온아파트 견적서 송부드립니다', project: '가온아파트', why: '' });
      return hjChatAudit(reps).map(a => [a.ev.project || '-', a.ev.n, a.m, a.status]);
    }, { pc: CHAT_PC });
    assert.deepEqual(r, [['가온아파트', 3, 3, 'ok'], ['나래아파트', 2, 1, 'missing'], ['다솜아파트', 4, 2, 'missing'], ['다솜아파트', 1, 0, 'doc'], ['가온아파트', 3, 0, 'resent'], ['가온아파트', 2, 2, 'ok'], ['가온아파트', 1, 0, 'doc'], ['-', 52, 0, 'nosite']], 'AUDIT ' + JSON.stringify(r));
  });

  await test('④ 제안 — 이름 시각·카톡 저장·캡처 제외·72시간·장수 같고 12시간 안만 체크·상대 보고 무시 (PLAN)', async () => {
    const r = await page.evaluate(({ pc }) => {
      const reps = hjChatReports([hjChatParse(pc, 'a.txt')]);
      const plan = hjChatPhotoPlan(reps, state.files.filter(f => f.kind === 'photo' && !f.project));
      return plan.map(g => [g.ev.project, g.ev.n, g.photos.map(p => p.name), g.sure]);
    }, { pc: CHAT_PC });
    assert.deepEqual(r, [['나래아파트', 2, ['IMG_0001.jpg'], false], ['다솜아파트', 4, ['20260813_150200.jpg', '20260813_150300.jpg'], false]], 'PLAN ' + JSON.stringify(r));
    // 다솜: 보고 4장 = 앱에 이미 있는 2장 + 현장 없는 2장 — 묶음 장수(2)가 보낸 장수(4)와 달라 참고.
    // 72시간 경계: 8/7 14:00 보고 → IMG_0002(8/4 14:55, 71시간) 는 들고 IMG_0001(8/4 13:00, 73시간) 은 빠진다
    const plan1 = (t, n, only) => page.evaluate(({ t, n, only }) => {
      const ev = { t: new Date(t), n, room: 'a', who: '박기사', text: '다솜아파트', project: '다솜아파트', why: '' };
      const ps = state.files.filter(f => f.kind === 'photo' && !f.project && (!only || new RegExp(only).test(f.name)));
      return hjChatPhotoPlan([ev], ps).map(g => [g.photos.map(p => p.name), g.sure]);
    }, { t, n, only });
    assert.deepEqual(await plan1('2026-08-07T14:00:00+09:00', 2), [[['IMG_0002.jpg'], false]], 'PLAN 72h window');
    assert.deepEqual(await plan1('2026-08-13T16:25:00+09:00', 2, '^20260813_'), [[['20260813_150200.jpg', '20260813_150300.jpg'], true]], 'PLAN same count within 12h → checked');
    assert.deepEqual(await plan1('2026-08-14T10:00:00+09:00', 2, '^20260813_'), [[['20260813_150200.jpg', '20260813_150300.jpg'], false]], 'PLAN same count but 19h later → 참고');
  });

  await test('⑤ 화면 — 입구 · 누락 목록 · 체크·현장 기본값 · 안전판 실패 → 무변경 · 배정 → 안전판 1회 · 다시 열면 누락 1건 (UI)', async () => {
    await SEED();
    await page.evaluate(() => { render(); photoToolsView(); });
    await page.waitForSelector('#modalRoot .ptBtn[data-fn="hjChatPick"]');
    await page.evaluate(() => closeModal());
    await page.evaluate(() => hjPhotoSuggestReview({ from: 'test' }));
    await page.waitForSelector('#psrChat');
    await page.evaluate(() => closeModal());
    const n = await page.evaluate(async ({ pc }) => hjChatReview(await hjChatReadFiles([new File([pc], 'KakaoTalk_20261031_0508_12_888_김반장.txt')])), { pc: CHAT_PC });
    assert.equal(n, 6, 'UI audit rows (김반장 excluded, 30+22 merged)');
    const ui = await page.evaluate(() => ({ summary: document.querySelector('#chatSummary').textContent.replace(/\s+/g, ' '), miss: document.querySelectorAll('#modalRoot [data-chat-audit="missing"]').length,
      rows: [...document.querySelectorAll('#modalRoot [data-chat-row]')].map(r => [r.querySelector('.chatChk').checked, r.querySelector('.chatSel').value]) }));
    assert(/내 사진 보고 6건\(현장 찾음 4건\)/.test(ui.summary) && /앱 사진이 모자란 보고 2건/.test(ui.summary) && /현장 없는 사진 제안 3장/.test(ui.summary), 'UI summary ' + ui.summary);
    assert.equal(ui.miss, 4, 'UI missing rows listed (section + all-reports list) ' + JSON.stringify(ui));
    assert.deepEqual(ui.rows, [[false, '나래아파트'], [false, '다솜아파트']], 'UI rows default unchecked (참고) with project preselected ' + JSON.stringify(ui.rows));
    const proj = () => page.evaluate(() => state.files.filter(f => f.kind === 'photo').map(f => f.project).join(','));
    const before = await proj();
    // 안전판을 못 만들면 아무것도 바꾸지 않는다
    const g = await page.evaluate(async () => {
      const root = document.getElementById('modalRoot');
      root.querySelectorAll('.chatChk')[1].checked = true;
      window.__realSnap = hjSnapshot; window.__snapCalls = [];
      hjSnapshot = async label => { window.__snapCalls.push(label); return false; };
      [...root.querySelectorAll('.mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 300));
      hjSnapshot = window.__realSnap;
      return { toast: document.getElementById('toast').textContent, calls: window.__snapCalls.filter(l => l !== '작업 중' && l !== '자동'), modal: !!document.querySelector('#modalRoot .modal'), disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.disabled) };
    });
    assert.equal(await proj(), before, 'UI snapshot failure → nothing changed');
    assert(g.calls.length === 1 && g.calls[0] === '카톡 보고 배정 전' && /안전판을 만들지 못해/.test(g.toast) && g.modal && g.disabled.every(x => !x), 'UI snapshot gate ' + JSON.stringify(g));
    // 다솜 묶음(체크된 채로) 배정 — 진짜 안전판
    const r = await page.evaluate(async () => {
      const root = document.getElementById('modalRoot');
      const before = ((await idbGet('hj_snaps')) || []).length;
      [...root.querySelectorAll('.mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
      for (let i = 0; i < 50 && document.querySelector('#modalRoot .modal'); i++) await new Promise(r => setTimeout(r, 100));
      const snaps = (await idbGet('hj_snaps')) || [];
      return { toast: document.getElementById('toast').textContent, added: snaps.slice(before).map(x => x.label), proj: state.files.filter(f => /^20260813_15/.test(f.name)).map(f => f.project), other: state.files.filter(f => /^IMG_/.test(f.name)).map(f => f.project), modal: !!document.querySelector('#modalRoot .modal') };
    });
    assert(r.added.filter(l => l === '카톡 보고 배정 전').length === 1, 'UI one forced snapshot ' + JSON.stringify(r));
    assert(r.proj.every(p => p === '다솜아파트') && r.other.every(p => p === '') && !r.modal && /1묶음 2장을 배정했습니다/.test(r.toast), 'UI applied only the checked group ' + JSON.stringify(r));
    const again = await page.evaluate(async ({ pc }) => { hjChatReview(await hjChatReadFiles([new File([pc], 'a.txt')])); return { rows: document.querySelectorAll('#modalRoot [data-chat-row]').length, summary: document.querySelector('#chatSummary').textContent.replace(/\s+/g, ' ') }; }, { pc: CHAT_PC });
    assert(again.rows === 1 && /앱 사진이 모자란 보고 1건/.test(again.summary), 'UI after assignment: 다솜 no longer missing ' + JSON.stringify(again));
    await page.evaluate(() => closeModal());
    const empty = await page.evaluate(async () => { hjChatReview(await hjChatReadFiles([new File(['아무 글'], 'x.txt')])); return document.querySelector('#modalRoot').textContent; });
    assert.match(empty, /읽지 못했습니다/);
    await page.evaluate(() => closeModal());
    const none = await page.evaluate(async () => { hjChatReview(await hjChatReadFiles([new File(['--------------- 2026년 8월 4일 화요일 ---------------\n[박기사] [오전 9:37] 안녕하세요'], 'y.txt')])); return document.querySelector('#modalRoot').textContent; });
    assert.match(none, /사진 보고\('사진 N장'\)를 찾지 못했습니다/);
    await page.evaluate(() => closeModal());
  });

  await test('⑥ 소스·핀 3곳(v528 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /it\('💬','카톡 보고 대조·사진 배정'/);
    assert.match(SRC, /if\(cb\)cb\.onclick=\(\)=>hjChatPick\(\);/);
    // 핀은 판마다 바뀐다 — v528 이상이고 세 곳이 같은지만 본다(다음 판에서 떨어지지 않게)
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 528, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`chatphoto-v528: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL chatphoto-v528', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
