/* v602 💬 카톡 보고 대조 — 앱에 없는 현장을 가리키는 보고를 '적은 글'과 함께 보이고 '＋ 새 현장'으로 그 자리에서 만들기.
   대표가 11/12~13 두 번 맡긴 일(톡방 내용·사진을 현장사진에 저장하고 프로젝트 정리)에서 v528 창은 앱에 없는 현장의 보고를 '사진 N장'으로만 남겨
   어디 사진인지 알 수 없었고, 창을 닫고 현장을 따로 만든 뒤 대화 파일을 다시 읽어야 했다. 합성 대화·합성 이름만, 바깥 쓰기 0, 시계 고정.
   ① 보고 — 현장을 못 찾은 보고에 같은 사람이 적은 글(hint)과 새 현장 이름(suggest) · 인사말보다 장소 글 먼저 · 여러 줄 글의 장소 줄 ·
      장소가 아닌 글은 이름 없음 · 상대가 쓴 글은 내 보고에 쓰지 않음 · 아는 현장 보고는 v528 그대로 (REPORT)
   ② 합치기 — 30분 안의 앱에 없는 두 현장은 따로 · 같은 현장 '사진 30장'+'사진 22장'은 한 보고 · 이름 없는 것끼리는 예전처럼 · 대조 상태는 그대로 (MERGE)
   ③ 화면(폰 390) — 못 찾은 보고 줄에 적은 글 · '＋ 새 현장'은 고르지 않은 채·묶음 체크 안 됨 · 고르면 체크+이름 칸 · 이름 칸의 까닭 글(비슷·있음·보관·짧음) ·
      비슷한 현장이 있으면 선택지 대신 그 현장 이름 · 넘침 없음·44px·16px · 여기까지 자료 불변 (UI)
   ④ 배정 — 안전판 실패 → 현장도 배정도 없음 · 비슷한 이름 → 그 묶음 아래 까닭, 안전판도 안 찍음 · 성공 → 안전판 1회, 고친 이름으로 생성(0단계·유형 없음·고객 빈칸),
      같은 이름 두 묶음은 현장 하나, 있는 이름은 넣기만, 안 고른 묶음은 그대로 · 대화 글은 저장본에 없음 · 다시 열면 그 보고는 현장을 찾음 (APPLY)
   ⑤ 넣을 사진이 없으면 현장을 만들지 않음 · 오래된 창은 만들지도 넣지도 않음 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)
   HJ_V602_BASELINE=<commit> 은 ①, HJ_V602_MUTATION=any-sender(상대 글도 씀)는 ①, merge-ignores-suggest 는 ②, preselect-new(새 현장을 미리 고름)·
   no-similar-guard(비슷한 이름도 새 이름으로 침)는 ③, no-precheck(막힌 묶음을 말없이 건너뛰고 나머지를 배정)·create-before-snapshot(안전판 전에 만듦)는 ④,
   empty-site(사진 없이 현장만 만듦)·no-stale(오래된 창 가드 없음)는 ⑤ 에서 실패해야 한다. */
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
  'any-sender': ["        if(x.who!==m.who||HJ_CHAT_PHOTO_RE.test(String(x.text||'').trim()))return;\n", "        if(HJ_CHAT_PHOTO_RE.test(String(x.text||'').trim()))return;\n"],
  'merge-ignores-suggest': ["&&l.project===e.project&&(l.suggest||'')===(e.suggest||'')&&e.t-l.t<=30*60000", '&&l.project===e.project&&e.t-l.t<=30*60000'],
  'preselect-new': ["newOpt=nw?hjNewSiteOptionHtml(e.suggest):'';", "newOpt=nw?hjNewSiteOptionHtml(e.suggest,true):'';"],
  'no-similar-guard': ["  if(c.ok)return {to:c.name,fresh:true,why:'',similar:[]};\n", "  if(c.ok||c.why==='similar')return {to:c.name,fresh:true,why:'',similar:[]};\n"],
  'no-precheck': ['      if(!t.to){if(!blocked)blocked=el.dataset.i;return;}\n', '      if(!t.to)return;\n'],
  'create-before-snapshot': ["  try{snapped=await hjSnapshot('카톡 보고 배정 전',true,true);}catch(e){snapped=false;}\n", "  picks.forEach(pk=>{if(pk.fresh)ensureProjectExists(pk.to);});\n  try{snapped=await hjSnapshot('카톡 보고 배정 전',true,true);}catch(e){snapped=false;}\n"],
  'empty-site': ['    if(!todo.length)return;   // 넣을 사진이 없으면 현장도 만들지 않는다(빈 현장 방지)\n', ''],
  'no-stale': [["  if(typeof __tabStale!=='undefined'&&__tabStale){toast('오래된 창이에요 — 새로고침한 뒤 다시 눌러 주세요');return 0;}\n  const picks=[];let noTarget=0,blocked=null;\n", '  const picks=[];let noTarget=0,blocked=null;\n'],
    ["  if(typeof __tabStale!=='undefined'&&__tabStale){btns.forEach(b=>{if(b.isConnected)b.disabled=false;});toast('오래된 창이에요 — 새로고침한 뒤 다시 눌러 주세요');return 0;}\n  const names=new Set(", '  const names=new Set(']]
};
let html = process.env.HJ_V602_BASELINE ? execFileSync('git', ['show', process.env.HJ_V602_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V602_MUTATION) {
  const m = MUT[process.env.HJ_V602_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V602_MUTATION);
  html = SRC;
  (typeof m[0] === 'string' ? [m] : m).forEach(([from, to]) => { assert.equal(html.split(from).length, 2, 'mutation anchor'); html = html.replace(from, () => to); });
}
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// 합성 대화(PC 내보내기) — '나' = 박기사(사진 보고가 가장 많다), 상대 = 김반장. 앱에 있는 현장은 가온아파트뿐.
const CHAT = [
  '김반장 님과 카카오톡 대화', '저장한 날짜 : 2026-11-13 08:00:00', '',
  '--------------- 2026년 11월 12일 목요일 ---------------',
  '[박기사] [오전 9:00] 사진 2장',
  '[박기사] [오전 9:01] 수고하셨습니다',
  '[박기사] [오전 9:03] 모란아파트 303동 704호 욕실 누수 탐지 완료했습니다',
  '[박기사] [오전 10:00] 사진 3장',
  '[박기사] [오전 10:01] 가온아파트 3동 105호 배수관 교체',
  '[박기사] [오전 11:00] 사진',
  '[김반장] [오전 11:01] 은하수빌라 201호 확인 부탁드립니다',
  '[박기사] [오전 11:02] 작업 사진 공유드립니다',
  '[김반장] [오전 11:30] 사진 2장',
  '[박기사] [오후 1:00] 사진 30장',
  '[박기사] [오후 1:01] 사진 22장',
  '[박기사] [오후 1:02] 한빛빌라 201호 배관 누수',
  '[박기사] [오후 1:10] 사진 4장',
  '[박기사] [오후 1:11] 월요일 작업',
  '시험시 달빛동 55-3 옥상 방수',
  '[박기사] [오후 3:00] 사진 2장',
  '[박기사] [오후 3:01] 보람마을 누수 확인했습니다',
  '[박기사] [오후 4:00] 사진 5장',
  '[박기사] [오후 4:10] 사진 6장',
  '[박기사] [오후 5:00] 사진 2장',
  '[박기사] [오후 5:01] 모란아파트 303동 704호 재방문'
].join('\n');
const MORAN = '모란아파트 303동 704호 욕실 누수 탐지 완료했습니다';
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS chatnewsite-v602 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-13T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
  }, BOOT);
  return { context, page };
}
(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    // 현장 4곳(사진이 있어야 후보 감점이 없다): 가온·나래·보람마을 2단지 + 보관한 옛빌라. 현장 없는 사진 11장 = 보고 묶음 여섯.
    const SEED = () => page.evaluate(px => {
      const P = (name, more) => Object.assign({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, more || {});
      state._demo = false;
      state.projects = [P('가온아파트'), P('나래아파트'), P('보람마을 2단지'), P('옛빌라', { archived: true })];
      state.files = []; state.quotes = []; state.notes = []; state.schedule = [];
      let k = 0; const ph = (hms, project, day) => state.files.push({ id: 'p' + (++k), name: '2026' + (day || '1112') + '_' + hms + '.jpg', ext: 'jpg', kind: 'photo', project, when: new Date('2026-11-12T' + hms.slice(0, 2) + ':' + hms.slice(2, 4) + ':00+09:00'), size: 1000 + k, thumb: px });
      ph('095000', '가온아파트'); ph('095100', '가온아파트'); ph('095200', '가온아파트');   // 가온 10:00 보고(3장) ✓
      ph('070000', '나래아파트'); ph('070100', '보람마을 2단지');
      ph('083000', ''); ph('083100', '');   // 모란 9:00 보고 앞 2장
      ph('105000', '');   // 11:00 '작업 사진 공유드립니다' 보고 앞 1장 — 이름이 안 읽힘
      ph('123000', ''); ph('123100', ''); ph('123200', '');   // 한빛빌라 1:00·1:01 보고 앞 3장
      ph('130500', ''); ph('130600', '');   // 달빛동 1:10 보고 앞 2장
      ph('145000', '');   // 보람마을 3:00 보고 앞 1장 — 비슷한 현장(보람마을 2단지)이 있다
      ph('165000', ''); ph('165100', '');   // 모란 5:00 보고(재방문) 앞 2장
      state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
      render();
    }, PX);
    const review = () => page.evaluate(async chat => hjChatReview(await hjChatReadFiles([new File([chat], 'KakaoTalk_20261113_0800_00_000_김반장.txt')])), CHAT);
    const snap = () => page.evaluate(() => ({ projects: state.projects.map(p => p.name), photos: state.files.filter(f => f.kind === 'photo').map(f => f.name.slice(9, 15) + '=' + f.project).join(' ') }));
    const snapCount = () => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).filter(x => x.label === '카톡 보고 배정 전').length);
    const row = i => '#modalRoot [data-chat-row="' + i + '"] ';
    const applyBtn = '#modalRoot .mfoot button:has-text("체크한 묶음 배정")';

    await test('① 보고 — 못 찾은 보고의 적은 글·새 현장 이름 · 장소 글 먼저 · 상대 글 안 씀 · 아는 현장 그대로 (REPORT)', async () => {
      await SEED();
      const r = await page.evaluate(chat => {
        const t = d => d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
        return hjChatReports([hjChatParse(chat, 'a.txt')]).map(e => [t(e.t), e.who, e.n, e.project, e.text, e.hint, e.suggest]);
      }, CHAT);
      const by = k => r.find(x => x[0] === k);
      assert.deepEqual(by('9:00'), ['9:00', '박기사', 2, '', '사진 2장', MORAN, '모란아파트'], '앱에 없는 현장 — 인사말(9:01)보다 장소 글(9:03) ' + JSON.stringify(by('9:00')));
      assert.deepEqual(by('10:00'), ['10:00', '박기사', 3, '가온아파트', '가온아파트 3동 105호 배수관 교체', '', ''], '아는 현장은 v528 그대로 ' + JSON.stringify(by('10:00')));
      assert.deepEqual(by('11:00'), ['11:00', '박기사', 1, '', '사진', '작업 사진 공유드립니다', ''], '장소가 아닌 글은 보여 주기만 · 상대(김반장 11:01)의 장소 글은 쓰지 않는다 ' + JSON.stringify(by('11:00')));
      assert.deepEqual(by('11:30'), ['11:30', '김반장', 2, '', '사진 2장', '', ''], '상대 사진 보고에 내 글을 붙이지 않는다 ' + JSON.stringify(by('11:30')));
      assert.deepEqual([by('13:00')[5], by('13:00')[6], by('13:01')[6]], ['한빛빌라 201호 배관 누수', '한빛빌라', '한빛빌라'], '연달아 보낸 사진은 같은 글 ' + JSON.stringify([by('13:00'), by('13:01')]));
      assert.deepEqual(by('13:10').slice(3), ['', '사진 4장', '시험시 달빛동 55-3 옥상 방수', '달빛동 55-3'], '여러 줄 글의 장소 줄 · 주소 꼴 이름 ' + JSON.stringify(by('13:10')));
      assert.deepEqual(by('15:00').slice(3), ['', '사진 2장', '보람마을 누수 확인했습니다', '보람마을'], JSON.stringify(by('15:00')));
      assert.deepEqual([by('16:00').slice(3), by('16:10').slice(3)], [['', '사진 5장', '', ''], ['', '사진 6장', '', '']], '글이 없는 보고는 예전 그대로');
      assert.deepEqual(by('17:00').slice(5), ['모란아파트 303동 704호 재방문', '모란아파트']);
      assert.equal(r.length, 11, '사진 메시지 11개');
    });

    await test('② 합치기 — 앱에 없는 두 현장은 따로 · 같은 현장 30장+22장은 하나 · 이름 없는 것끼리는 예전처럼 · 대조 상태 그대로 (MERGE)', async () => {
      const r = await page.evaluate(chat => {
        const t = d => d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'), reps = hjChatReports([hjChatParse(chat, 'a.txt')]);
        const me = hjChatMe(reps), plan = hjChatPhotoPlan(reps, state.files.filter(f => f.kind === 'photo' && !f.project));
        return { me, merged: hjChatMerge(reps.filter(e => e.who === me)).map(e => [t(e.t), e.n, e.project || e.suggest]),
          audit: hjChatAudit(reps).map(a => [t(a.ev.t), a.ev.n, a.status]),
          plan: plan.map(g => [t(g.ev.t), g.ev.suggest, g.photos.length, g.sure]) };
      }, CHAT);
      assert.equal(r.me, '박기사');
      assert.deepEqual(r.merged, [['9:00', 2, '모란아파트'], ['10:00', 3, '가온아파트'], ['11:00', 1, ''], ['13:01', 52, '한빛빌라'], ['13:10', 4, '달빛동 55-3'], ['15:00', 2, '보람마을'], ['16:10', 11, ''], ['17:00', 2, '모란아파트']], 'MERGE ' + JSON.stringify(r.merged));
      assert.deepEqual(r.audit, [['9:00', 2, 'nosite'], ['10:00', 3, 'ok'], ['11:00', 1, 'nosite'], ['13:01', 52, 'nosite'], ['13:10', 4, 'nosite'], ['15:00', 2, 'nosite'], ['16:10', 11, 'nosite'], ['17:00', 2, 'nosite']], 'AUDIT ' + JSON.stringify(r.audit));
      assert.deepEqual(r.plan, [['9:00', '모란아파트', 2, false], ['11:00', '', 1, false], ['13:01', '한빛빌라', 3, false], ['13:10', '달빛동 55-3', 2, false], ['15:00', '보람마을', 1, false], ['17:00', '모란아파트', 2, false]], 'PLAN — 한빛 사진 3장이 달빛동 묶음으로 넘어가지 않는다 ' + JSON.stringify(r.plan));
    });

    await test('③ 화면(폰 390) — 적은 글 · ＋ 새 현장은 고르지 않은 채 · 고르면 체크+이름 칸 · 까닭 글 · 비슷한 현장 안내 · 자료 불변 (UI)', async () => {
      const before = await page.evaluate(() => JSON.stringify(serializeData()));
      assert.equal(await review(), 8, '내 보고 8건');
      const ui = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#modalRoot [data-chat-row]')];
        return { rows: rows.map(r => ({ chk: r.querySelector('.chatChk').checked, val: r.querySelector('.chatSel').value, opts: [...r.querySelectorAll('.chatSel option')].slice(0, 2).map(o => o.value + '|' + o.textContent),
            nNew: [...r.querySelectorAll('.chatSel option')].filter(o => o.value.indexOf('__new__:') === 0).length, box: r.querySelector('.chatNewBox') ? r.querySelector('.chatNewBox').hidden : null,
            sim: (r.querySelector('[data-chat-sim]') || {}).textContent || '', text: r.querySelector('.psr-txt').textContent })),
          nosite: [...document.querySelectorAll('#modalRoot [data-chat-audit="nosite"]')].map(x => x.textContent), summary: document.querySelector('#chatSummary').textContent };
      });
      assert.equal(ui.rows.length, 6, '묶음 여섯 ' + JSON.stringify(ui.rows.map(x => x.text.slice(0, 40))));
      assert.ok(ui.rows[0].text.includes('“' + MORAN + '”') && !/“사진 2장”/.test(ui.rows[0].text), '못 찾은 보고 줄에 적은 글 ' + ui.rows[0].text);
      assert.deepEqual(ui.rows[0].opts, ['|현장 고르기 — 보고 글에서 못 찾음', '__new__:모란아파트|＋ 새 현장: 모란아파트'], '새 현장 선택지는 맨 위 ' + JSON.stringify(ui.rows[0].opts));
      assert.deepEqual(ui.rows.map(x => [x.val, x.chk, x.nNew, x.box]), [['', false, 1, true], ['', false, 0, null], ['', false, 1, true], ['', false, 1, true], ['', false, 0, null], ['', false, 1, true]], '고르지 않은 채 · 체크 안 됨 · 이름 칸 숨김 ' + JSON.stringify(ui.rows.map(x => [x.val, x.chk, x.nNew, x.box])));
      assert.ok(ui.rows[1].text.includes('“작업 사진 공유드립니다”') && !ui.rows[1].sim, '이름이 안 읽힌 묶음은 선택지도 안내도 없음 ' + JSON.stringify(ui.rows[1]));
      assert.ok(/비슷한 현장: 보람마을 2단지 — 같은 곳이면 위에서 그 현장을 고르세요/.test(ui.rows[4].sim), '비슷한 현장이 있으면 선택지 대신 그 이름 ' + JSON.stringify(ui.rows[4]));
      assert.equal(ui.nosite.length, 7, '모든 보고 보기의 못 찾은 보고 7건');
      assert.equal(ui.nosite.filter(t => /“사진/.test(t)).length, 1, '글이 없는 보고(4:00·4:10)만 사진 N장 ' + JSON.stringify(ui.nosite));
      assert.ok(ui.nosite.some(t => t.includes('“' + MORAN + '”')), '대조 줄에도 적은 글');
      assert.ok(/내 사진 보고 8건\(현장 찾음 1건\)/.test(ui.summary.replace(/\s+/g, ' ')), ui.summary);
      // 고르면 그 묶음이 체크되고 이름 칸이 보인다 — 폰 폭에서 넘치지 않고 누를 수 있다
      await page.selectOption(row(0) + '.chatSel', '__new__:모란아파트');
      const picked = await page.evaluate(() => {
        const r = document.querySelector('#modalRoot [data-chat-row="0"]'), inp = r.querySelector('.chatNew'), sel = r.querySelector('.chatSel'), chk = r.querySelector('.psr-chk'), modal = document.querySelector('#modalRoot .modal');
        const h = el => Math.round(el.getBoundingClientRect().height), right = el => el.getBoundingClientRect().right;
        return { chk: r.querySelector('.chatChk').checked, hidden: r.querySelector('.chatNewBox').hidden, val: inp.value, state: r.querySelector('.chatNewMsg').dataset.state, msg: r.querySelector('.chatNewMsg').textContent,
          inpH: h(inp), selH: h(sel), chkH: h(chk), chkW: Math.round(chk.getBoundingClientRect().width), font: [getComputedStyle(inp).fontSize, getComputedStyle(sel).fontSize],
          over: [document.documentElement.scrollWidth, ...[...modal.querySelectorAll('*')].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && el.clientWidth > 0).map(el => el.className || el.tagName)],
          inside: right(inp) <= window.innerWidth && right(sel) <= window.innerWidth, inpW: Math.round(inp.getBoundingClientRect().width) };
      });
      assert.deepEqual([picked.chk, picked.hidden, picked.val, picked.state], [true, false, '모란아파트', 'new'], '고르면 체크 + 이름 칸 ' + JSON.stringify(picked));
      assert.ok(/새 현장을 만들어 이 묶음 사진을 넣습니다/.test(picked.msg), picked.msg);
      assert.ok(picked.inpH >= 44 && picked.selH >= 44 && picked.chkH >= 44 && picked.chkW >= 44, '누르는 곳 44px ' + JSON.stringify(picked));
      assert.deepEqual(picked.font, ['16px', '16px'], '입력 16px');
      assert.deepEqual(picked.over, [390], '가로 넘침 없음 ' + JSON.stringify(picked.over));
      assert.ok(picked.inside && picked.inpW >= 150, '이름 칸이 폰에서 쓸 만한 폭 ' + picked.inpW);
      const say = async name => { await page.fill(row(0) + '.chatNew', name); return page.evaluate(() => { const r = document.querySelector('#modalRoot [data-chat-row="0"]'); return [r.querySelector('.chatNewMsg').dataset.state, r.querySelector('.chatNewMsg').textContent, r.querySelector('.chatNew').getAttribute('aria-invalid')]; }); };
      let m = await say('가온 아파트'); assert.ok(m[0] === 'similar' && /비슷한 현장: 가온아파트 — 위에서 그 현장을 고르거나 이름을 바꿔 주세요/.test(m[1]) && m[2] === 'true', '비슷한 이름 ' + JSON.stringify(m));
      m = await say('나래아파트'); assert.ok(m[0] === 'exists' && /이미 있는 현장이에요 — 새로 만들지 않고 그 현장에 넣습니다/.test(m[1]) && m[2] === 'false', '있는 이름 ' + JSON.stringify(m));
      m = await say('옛빌라'); assert.ok(m[0] === 'archived' && /옛빌라\(보관\)/.test(m[1]) && m[2] === 'true', '보관한 같은 이름 ' + JSON.stringify(m));
      m = await say('가'); assert.ok(m[0] === 'short' && m[2] === 'true', '짧은 이름 ' + JSON.stringify(m));
      m = await say('모란아파트'); assert.equal(m[0], 'new');
      await page.selectOption(row(0) + '.chatSel', '');
      assert.deepEqual(await page.evaluate(() => { const r = document.querySelector('#modalRoot [data-chat-row="0"]'); return [r.querySelector('.chatChk').checked, r.querySelector('.chatNewBox').hidden]; }), [false, true], '고르기를 풀면 체크도 이름 칸도 풀린다');
      assert.equal(await page.evaluate(() => JSON.stringify(serializeData())), before, '보기·고르기만으로는 자료가 바뀌지 않는다');
    });

    await test('④ 배정 — 안전판 실패·비슷한 이름은 무변경 · 성공: 안전판 1회·고친 이름·현장 하나·있는 이름은 넣기만 · 대화 글 저장 안 함 (APPLY)', async () => {
      const base = await snap();
      // (가) 안전판을 못 만들면 현장도 만들지 않는다
      await page.selectOption(row(0) + '.chatSel', '__new__:모란아파트');
      const fail = await page.evaluate(async () => {
        const real = hjSnapshot; window.__calls = [];
        hjSnapshot = async label => { window.__calls.push(label); return false; };
        [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 300));
        hjSnapshot = real;
        return { toast: document.getElementById('toast').textContent, calls: window.__calls.filter(l => l === '카톡 보고 배정 전').length, modal: !!document.querySelector('#modalRoot .modal'), disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].some(b => b.disabled) };
      });
      assert.deepEqual(await snap(), base, '안전판 실패 → 현장도 배정도 없음');
      assert.ok(fail.calls === 1 && /안전판을 만들지 못해/.test(fail.toast) && fail.modal && !fail.disabled, JSON.stringify(fail));
      // (나) 고쳐 적은 이름이 있는 현장과 비슷하면 그 묶음 아래 까닭을 적고 멈춘다 — 안전판도 찍지 않는다
      await page.selectOption(row(2) + '.chatSel', '__new__:한빛빌라');
      await page.fill(row(2) + '.chatNew', '가온 아파트');
      const snaps0 = await snapCount();
      await page.click(applyBtn);
      await page.waitForFunction(() => /새 현장 이름을 확인해 주세요|배정했습니다/.test(document.getElementById('toast').textContent));
      assert.deepEqual(await snap(), base, '비슷한 이름 → 아무 묶음도 만들거나 넣지 않는다(막힌 묶음만 건너뛰고 나머지를 넣지도 않는다)');
      const blocked = await page.evaluate(() => { const r = document.querySelector('#modalRoot [data-chat-row="2"]'); return { state: r.querySelector('.chatNewMsg').dataset.state, msg: r.querySelector('.chatNewMsg').textContent, modal: !!document.querySelector('#modalRoot .modal'), disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].some(b => b.disabled) }; });
      assert.ok(/새 현장 이름을 확인해 주세요/.test(await page.evaluate(() => document.getElementById('toast').textContent)), '막힌 까닭을 알린다');
      assert.ok(blocked.state === 'similar' && /가온아파트/.test(blocked.msg) && blocked.modal && !blocked.disabled, JSON.stringify(blocked));
      assert.equal(await snapCount(), snaps0, '막힌 배정은 안전판을 찍지 않는다');
      // (다) 성공 — 0번 모란(제안 그대로) · 2번 이름을 있는 현장으로(넣기만) · 3번 이름을 고쳐 새로 · 5번 모란(같은 이름 두 번째) · 1·4번은 안 고름
      await page.fill(row(2) + '.chatNew', '나래아파트');
      await page.selectOption(row(3) + '.chatSel', '__new__:달빛동 55-3');
      await page.fill(row(3) + '.chatNew', '달빛동 주택');
      await page.selectOption(row(5) + '.chatSel', '__new__:모란아파트');
      await page.click(applyBtn);
      await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
      const done = await snap(), toast = await page.evaluate(() => document.getElementById('toast').textContent);
      assert.equal(await snapCount(), snaps0 + 1, '안전판은 한 번');
      assert.deepEqual(done.projects, ['가온아파트', '나래아파트', '보람마을 2단지', '옛빌라', '모란아파트', '달빛동 주택'], '새 현장 둘(같은 이름은 하나, 있는 이름은 안 만듦) ' + JSON.stringify(done.projects));
      assert.equal(done.photos, '095000=가온아파트 095100=가온아파트 095200=가온아파트 070000=나래아파트 070100=보람마을 2단지 083000=모란아파트 083100=모란아파트 105000= 123000=나래아파트 123100=나래아파트 123200=나래아파트 130500=달빛동 주택 130600=달빛동 주택 145000= 165000=모란아파트 165100=모란아파트', '고른 묶음 사진만 ' + done.photos);
      assert.ok(/4묶음 9장을 배정했습니다 · 새 현장 2곳\(모란아파트, 달빛동 주택\)을 만들었어요/.test(toast) && /안전판\("카톡 보고 배정 전"\)/.test(toast), toast);
      const rec = await page.evaluate(() => { const p = state.projects.find(x => x.name === '모란아파트'); return { p: JSON.parse(JSON.stringify(p)), dirty: !!state.dirty, saved: JSON.stringify(serializeData()) }; });
      assert.deepEqual(rec.p, { name: '모란아파트', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, '0단계 · 유형·고객은 짓지 않는다 ' + JSON.stringify(rec.p));
      assert.equal(rec.dirty, true);
      ['탐지 완료했습니다', '303동', '재방문', '작업 사진 공유드립니다', '옥상 방수', '배관 누수', '은하수빌라'].forEach(w => assert.ok(!rec.saved.includes(w), '대화 글은 저장본에 없다: ' + w));
      // (라) 다시 읽으면 모란 보고는 현장을 찾고(✓), 남은 묶음은 안 고른 둘뿐 — 새 현장 선택지는 더 없다
      assert.equal(await review(), 8);
      const again = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#modalRoot [data-chat-row]')].map(r => r.querySelector('.psr-txt').textContent.replace(/\s+/g, ' ')), nNew: document.querySelectorAll('#modalRoot .chatSel option[value^="__new__:"]').length,
        ok: [...document.querySelectorAll('#modalRoot details [data-chat-audit="ok"]')].map(x => x.textContent), summary: document.querySelector('#chatSummary').textContent.replace(/\s+/g, ' ') }));
      assert.ok(again.rows.length === 2 && /작업 사진 공유드립니다/.test(again.rows[0]) && /보람마을 누수 확인했습니다/.test(again.rows[1]) && again.nNew === 0, JSON.stringify(again));
      assert.ok(/내 사진 보고 8건\(현장 찾음 3건\)/.test(again.summary) && again.ok.filter(t => t.includes('모란아파트')).length === 2, '모란 보고 둘이 ✓ ' + JSON.stringify(again));
      await page.evaluate(() => closeModal());
    });

    await test('⑤ 넣을 사진이 없으면 현장도 없음 · 오래된 창은 무변경 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)', async () => {
      await SEED();
      // 창을 연 뒤 그 묶음 사진이 다른 길로 먼저 배정됐다 — 빈 '모란아파트'를 만들지 않는다
      await review();
      await page.selectOption(row(0) + '.chatSel', '__new__:모란아파트');
      await page.evaluate(() => { state.files.filter(f => /_0830|_0831/.test(f.name)).forEach(f => { f.project = '가온아파트'; }); });
      const mid = await snap();
      await page.click(applyBtn);
      await page.waitForFunction(() => /배정할 사진이 없습니다/.test(document.getElementById('toast').textContent));
      assert.deepEqual(await snap(), mid, '넣을 사진이 없으면 현장을 만들지 않는다');
      await page.evaluate(() => closeModal());
      // 오래된 창 — 여기서 만든 현장은 저장되지 않는다. 만들지도, 넣지도, 안전판을 찍지도 않는다
      await SEED(); await review();
      await page.selectOption(row(0) + '.chatSel', '__new__:모란아파트');
      const base = await snap(), snaps0 = await snapCount();
      await page.evaluate(() => { __tabStale = true; });
      await page.click(applyBtn);
      await page.waitForFunction(() => /오래된 창이에요|배정했습니다/.test(document.getElementById('toast').textContent));
      const stale = await page.evaluate(() => { __tabStale = false; return { toast: document.getElementById('toast').textContent, modal: !!document.querySelector('#modalRoot .modal') }; });
      assert.deepEqual(await snap(), base, '오래된 창 → 현장도 배정도 없음');
      assert.ok(/오래된 창이에요/.test(stale.toast) && stale.modal, JSON.stringify(stale));
      assert.equal(await snapCount(), snaps0, '오래된 창은 안전판도 찍지 않는다');
      await page.evaluate(() => closeModal());
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('chatnewsite-v602: ' + passed + '/5 PASS; synthetic data; external writes=' + network.writes);
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL chatnewsite-v602', e && e.stack || e); process.exit(1); });
