/* v604 🧰 클로드 명령어 '🗂 톡방·구글 포토 사진 → 현장사진·현장 정리' — 대표가 11/12·11/13 두 번 맡긴 일을 기본 명령으로.
   '현장 웹 캘린더를 보고 톡서랍 톡방·구글 포토 사진을 현장사진에 저장하고 현장별로 정리, 위치 정보가 없는 것은 주소로' — 그때마다 손으로 쓴 명령을 건넸다.
   복사할 때 앱이 최근 일정표({최근일정})·현장 목록({현장목록})을 채워 준다(읽기만 — 저장된 명령은 그대로). 합성 자료, 시계 2026-11-16(월) 고정, 바깥 쓰기 0.
   ① 기본 명령 17개 — cw_sitesort: 사진 분류 맨 앞(o:0 이 화면에서도 맨 앞 — v569 cw_calsync 도) · 준비물 · 스킬 줄 · 할 일(일정표·톡서랍·구글 포토·현장사진/<현장 이름>/·
      위치 없으면 톡방 주소·확인필요)·지킬 것(옮기기만·_현장.json 으로 현장을 만들지 않음·'＋ 새 현장' 화면 셋·자동 로그인 안 함·백업·앱 파일) ·
      쓰던 목록에는 빠진 것만 뒤에 붙음 (DEFAULT)
   ② 채우기 — {최근일정}: 14일 전 ~ 3일 뒤(경계 포함) · 날짜·시각 순 · 여러 날 공정의 이어지는 날 · 💰·세금 자동·개인 일정 빠짐 · 제목의 출입 번호 토막·전화번호 가림 ·
      장소(출입 번호면 없음·전화 가림) · 현장 없으면 '현장 없음' · 메모는 안 실림 · 없으면 '(일정 없음)' · 60줄 넘으면 앞쪽을 줄임 /
      {현장목록}: 보관 현장 빠짐 · 80곳 넘으면 '외 n곳' / 자리가 없는 명령은 {오늘} 말고 글자 그대로 · 제목의 '$&'·'{현장목록}' 은 글자 그대로 ·
      일정표를 못 읽으면 빈칸 대신 '직접 읽어 달라'는 글 (FILL)
   ③ 복사 — 🧰 창 [📋 명령 복사]·전체 보기 [복사]에 채운 글 · 고치는 창은 저장된 글 + 자리 안내 · 저장된 명령·저장본은 그대로 (COPY)
   ④ 폰 390 — 가로 넘침 없음 · 단추 44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V604_BASELINE=<commit> 와 HJ_V604_MUTATION=order-zero(o:0 을 '없음'으로)는 ①, title-raw(제목을 거르지 않음)·no-mask(장소 전화 안 가림)·include-personal(개인 일정 실음)·
   window-wide(기간을 넓힘)·include-archived(보관 현장 실음)는 ②, fill-saved(저장된 명령을 채운 글로 덮음)는 ③ 에서 실패해야 한다.
   통합 검토(11/15) — 6번 단계에 '현장 없음'으로 이미 들어온 일정의 길(맞추기에는 그 줄이 다시 안 나온다) · 폴더 이름은 목록 이름 그대로(새로 지을 때만 고객 이름 금지) ·
   {현장목록} 80곳 넘으면 최근 일정의 현장·나중에 만든 현장을 남김 · ⏰ 지시서 파일에도 자리를 채움. 변이 sites-oldest(앞 80곳을 남김)·no-recent-site(최근 일정 현장을
   안 챙김)는 ②, order-raw(지시서에 자리 글자 그대로)는 ③ 에서 실패해야 한다. */
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
  'order-zero': ["function cwOrderOf(t){const m=t&&CW_META[t.id];return m&&typeof m.o==='number'?m.o:99;}", "function cwOrderOf(t){const m=t&&CW_META[t.id];return (m&&m.o)||99;}"],
  'title-raw': ["clean=t=>hjAiMaskText(hjMemoOut(t).text),L=[];", "clean=t=>String(t||''),L=[];"],
  'no-mask': ['    const place=hjAiMaskText(hjSchPlaceOf(s));\n', '    const place=hjSchPlaceOf(s);\n'],
  'include-personal': ['    if(s.sourceUid)return;', '    if(false)return;'],
  'window-wide': ['const CW_SCHED_BACK=14,CW_SCHED_AHEAD=3,', 'const CW_SCHED_BACK=30,CW_SCHED_AHEAD=30,'],
  'include-archived': ["const names=(state.projects||[]).filter(p=>p&&!p.archived&&String(p.name||'').trim())", "const names=(state.projects||[]).filter(p=>p&&String(p.name||'').trim())"],
  'fill-saved': ["  return cwSkillLine(t)+'\\n\\n'+cwFill(t.prompt);\n", "  t.prompt=cwFill(t.prompt);return cwSkillLine(t)+'\\n\\n'+t.prompt;\n"],
  'sites-oldest': ['  for(let i=names.length-1;i>=0&&keep.size<CW_SITES_MAX;i--)keep.add(names[i]);', '  for(let i=0;i<names.length&&keep.size<CW_SITES_MAX;i++)keep.add(names[i]);'],
  'no-recent-site': ["  (state.schedule||[]).forEach(s=>{const n=s&&String(s.project||'').trim();if(n&&keep.size<CW_SITES_MAX&&s.date>=lo&&s.date<=hi&&names.includes(n))keep.add(n);});\n", ''],
  'order-raw': ["    md+=cwFill(x.task.prompt)+'\\n\\n';", "    md+=x.task.prompt+'\\n\\n';"]
};
let html = process.env.HJ_V604_BASELINE ? execFileSync('git', ['show', process.env.HJ_V604_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V604_MUTATION) {
  const m = MUT[process.env.HJ_V604_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V604_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS sitecmd-v604 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    // 복사는 가로채서 본다(실제 클립보드 권한 없이)
    window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(String(t)); return Promise.resolve(); } } });
  }, BOOT);
  await page.evaluate(mobile => { __mobileMode = mobile; applyMobileMode(); }, width < 600);   // 모바일 모드는 폭이 아니라 설정값 — 명시적으로
  return { context, page };
}
// 합성 자료 — 현장 셋(하나는 보관), 일정은 기간 안팎·빼야 할 것·가려야 할 것
const SEED = () => {
  closeModal(true);
  state._demo = false; state.files = []; state.notes = []; state.quotes = []; state.payLog = []; __tabStale = false;
  state.projects = [{ name: '가온아파트', stage: 2, customer: { name: '김가상', phone: '010-9999-8888', addr: '시험시 가온로 1 101동 202호' } }, { name: '보람마을 2단지', stage: 1 }, { name: '옛빌라', stage: 3, archived: true }];
  const S = (id, date, time, title, project, x) => Object.assign({ id, date, time, title, project, workers: '', memo: '', hours: 8, report: null }, x || {});
  state.schedule = [
    S('a3', '2026-11-20', '09:00', '창밖 뒤', '가온아파트'),
    S('a2', '2026-11-19', '18:00', '경계 끝날', '옛빌라'),
    S('w1', '2026-11-16', '09:00', 'A$&B {현장목록} {오늘}', ''),
    S('t1', '2026-11-12', '08:00', '타일 (3일차 시작)', '가온아파트', { memo: '2026-11-12~2026-11-14 (3일)\n자재는 문 앞 비번 7777' }),
    S('g3', '2026-11-11', '', '방수 점검', '가온아파트', { memo: '장소: 가상빌딩 3층 010-2222-3333 / 열쇠는 관리실' }),
    S('g2', '2026-11-11', '15:00', '누수 탐지 · 도어락 4321', '보람마을 2단지', { memo: '장소: 공동현관 1234' }),
    S('g1', '2026-11-11', '13:00', '우수관 1개 010-1234-5678', '', { memo: '장소: 시험시 새벽로 12 모란아파트 303동 704호\n현관 1234#\n구글 캘린더에서 가져옴 (@ 제미나이 입력)' }),
    S('p1', '2026-11-11', '09:00', '자격 시험', '', { sourceUid: 'exam-1' }),
    S('x1', '2026-11-10', '', '부가세 예정 신고', '', { _taxAuto: true }),
    S('m1', '2026-11-10', '10:00', '💰 잔금 받기', '가온아파트'),
    S('a1', '2026-11-02', '09:00', '경계 첫날', '가온아파트'),
    S('a0', '2026-11-01', '09:00', '창밖 앞', '가온아파트')
  ];
  state.coworkTasks = undefined; state._coworkInit = false;
};
const LINES = [
  '11/2(월) 09:00 경계 첫날 — 가온아파트',
  '11/11(수) 13:00 우수관 1개 ···5678 — 현장 없음 · 시험시 새벽로 12 모란아파트 303동 704호',
  '11/11(수) 15:00 누수 탐지 — 보람마을 2단지',
  '11/11(수) 방수 점검 — 가온아파트 · 가상빌딩 3층 ···3333',
  '11/12(목) 08:00 타일 (3일 · ~11/14(토)) — 가온아파트',
  '11/13(금) 08:00 타일 (2/3일째) — 가온아파트',
  '11/14(토) 08:00 타일 (3/3일째) — 가온아파트',
  '11/16(월) 09:00 A$&B {현장목록} {오늘} — 현장 없음',
  '11/19(목) 18:00 경계 끝날 — 옛빌라'
];
const SITES = '- 가온아파트\n- 보람마을 2단지';
const stable = () => { const d = serializeData(); delete d.savedAt; return JSON.stringify(d); };

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);

    await test('① 기본 명령 17개 — cw_sitesort 사진 분류 맨 앞 · 준비물 · 스킬 줄 · 할 일·지킬 것 · 쓰던 목록엔 빠진 것만 (DEFAULT)', async () => {
      const r = await page.evaluate(() => {
        const d = coworkDefaults(), t = d.find(x => x.id === 'cw_sitesort') || {}, P = String(t.prompt || '');
        return {
          n: d.length, uniq: new Set(d.map(x => x.id)).size, title: t.title, icon: t.icon, builtin: t.builtin, keys: Object.keys(t).sort().join(),
          meta: typeof CW_META !== 'undefined' && CW_META.cw_sitesort ? [CW_META.cw_sitesort.cat, CW_META.cw_sitesort.o, /톡서랍/.test(CW_META.cw_sitesort.prep) && /구글 포토/.test(CW_META.cw_sitesort.prep) && /만물 폴더/.test(CW_META.cw_sitesort.prep)] : null,
          skill: t.id ? cwSkillLine(t) : '',
          body: { cal: /현장웹 일정표를 보고/.test(P), slots: P.includes('{최근일정}') && P.includes('{현장목록}'), talk: /톡방\(카카오 톡서랍\)/.test(P), gphoto: /구글 포토/.test(P), folder: P.includes('현장사진/<현장 이름>/'),
            order: /위치\(GPS\)[\s\S]*그날 일정[\s\S]*보고 글/.test(P), noloc: /위치 정보가 없는 사진은 톡방에 적힌 주소/.test(P), ask: P.includes("'확인필요' 표") && /내 답을 기다린다/.test(P) },
          rules: { move: /옮기기만 한다/.test(P), nojson: /_현장\.json 을 고치지 않는다/.test(P), login: /자동으로 로그인하지 않는다/.test(P), noname: /고객 이름·전화번호를 쓰지 않는다/.test(P),
            noSite: /'현장 없음'으로 이미 들어와 있는 일정: 맞추기에는 그 줄이 다시 나오지 않는다/.test(P) && /일정을 열어\(✏️\) 현장 칸에서 그 현장을 고른다/.test(P),
            keepName: /목록 이름은 바꾸지 않는다/.test(P) && /폴더 이름을 새로 지을 때는 고객 이름·전화번호를 쓰지 않는다/.test(P),
            screens: ['[🔄 구글 캘린더 맞추기]의 \'＋ 새 현장\'', '[💬 카톡 보고 대조·사진 배정]의 \'＋ 새 현장\'', '[🧭 추측 배정 보기]의 \'＋ 새 현장\''].every(x => P.includes(x)), okFirst: /내가 좋다고 한 줄만/.test(P),
            safe: /지우지 않는다/.test(P) && /_중복정리_보관_\{오늘\}/.test(P) && /_현장_백업_클로드_\{오늘\}/.test(P) && /앱 파일\(/.test(P) && /표로 보여 주고 멈춰서 묻는다/.test(P) },
          cat: /톡방·구글 포토 사진 현장별 정리/.test(coworkSkillCatalogText())
        };
      });
      assert.deepEqual([r.n, r.uniq], [17, 17], '기본 명령 수 ' + JSON.stringify([r.n, r.uniq]));
      assert.deepEqual([r.title, r.icon, r.builtin, r.keys], ['톡방·구글 포토 사진 → 현장사진·현장 정리', '🗂', true, 'builtin,icon,id,prompt,title'], '명령 꼴 ' + JSON.stringify(r));
      assert.deepEqual(r.meta, ['photo', 0, true], '분류·준비물 ' + JSON.stringify(r.meta));
      assert.ok(/^🧰 사용할 스킬: manmul-hyeonjang — /.test(r.skill) && /새 현장은 현장웹 화면에서/.test(r.skill), '스킬 줄 ' + r.skill);
      assert.deepEqual(r.body, { cal: true, slots: true, talk: true, gphoto: true, folder: true, order: true, noloc: true, ask: true }, '할 일 ' + JSON.stringify(r.body));
      assert.deepEqual(r.rules, { move: true, nojson: true, login: true, noname: true, noSite: true, keepName: true, screens: true, okFirst: true, safe: true }, '지킬 것 ' + JSON.stringify(r.rules));
      assert.equal(r.cat, true, '스킬 명령문 카탈로그');
      // 이미 쓰던 목록(옛 기본 5개 — 하나는 대표가 고침 — + 내 명령) → 빠진 기본 명령만 뒤에
      const m = await page.evaluate(() => {
        const olds = coworkDefaults().filter(t => ['cw_card', 'cw_tax', 'cw_photo', 'cw_bugtest', 'cw_month'].includes(t.id)).map(t => Object.assign({}, t));
        olds[0].prompt = '고친 카드 명령 {오늘}';
        state.coworkTasks = olds.concat([{ id: 'cw_mine1', icon: '✏️', title: '내 통장 정리', prompt: '내 명령 본문 {최근일정}', builtin: false }]); state._coworkInit = true;
        const t = coworkTasksEnsure();
        return { n: t.length, head: t.slice(0, 6).map(x => x.id), added: t.slice(6).map(x => x.id).includes('cw_sitesort'), card: t[0].prompt, mine: t[5].prompt, slot: (t.find(x => x.id === 'cw_sitesort') || {}).prompt || '' };
      });
      assert.deepEqual([m.n, m.head, m.added, m.card, m.mine], [18, ['cw_card', 'cw_tax', 'cw_photo', 'cw_bugtest', 'cw_month', 'cw_mine1'], true, '고친 카드 명령 {오늘}', '내 명령 본문 {최근일정}'], '쓰던 목록 ' + JSON.stringify(m));
      assert.ok(m.slot.includes('{최근일정}') && m.slot.includes('{현장목록}'), '붙은 명령은 자리 글자 그대로 저장');
      // 화면 — 분류 안 순서(o:0 이 맨 앞)
      await page.evaluate(() => coworkTasksManage());
      await page.waitForSelector('#modalRoot .cw-cat');
      const ui = await page.evaluate(() => { const root = document.getElementById('modalRoot'), ids = c => [...root.querySelectorAll('.cw-cat[data-cw-cat="' + c + '"] .cw-row')].map(x => x.dataset.cwRow);
        const row = root.querySelector('.cw-row[data-cw-row="cw_sitesort"]'); return { photo: ids('photo'), app: ids('app'), prep: row ? row.querySelector('.cw-prep').textContent : '', btn: row ? Math.round(row.querySelector('.cwCopy').getBoundingClientRect().height) : 0 }; });
      assert.deepEqual(ui.photo, ['cw_sitesort', 'cw_photoin', 'cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_photo'], '사진 분류 순서 ' + JSON.stringify(ui.photo));
      assert.equal(ui.app[0], 'cw_calsync', '현장웹 분류 맨 앞(v569 의도) ' + JSON.stringify(ui.app));
      assert.ok(/^준비: PC 크롬에 톡서랍/.test(ui.prep) && ui.btn >= 44, '준비물 줄·단추 ' + JSON.stringify(ui));
      await page.evaluate(() => closeModal(true));
    });

    await test('② 채우기 — {최근일정} 기간·순서·빼는 것·가리는 것 · {현장목록} 보관 빠짐 · 자리가 없으면 글자 그대로 (FILL)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(() => {
        const before = JSON.stringify(state.schedule) + JSON.stringify(state.projects);
        const out = { sched: cwFill('{최근일정}'), sites: cwFill('{현장목록}'), both: cwFill('가\n{최근일정}\n나\n{현장목록}\n다 {오늘}'), plain: cwFill('자리 없는 명령 {오늘} $& {일정}'),
          dupe: cwFill(coworkDefaults().find(t => t.id === 'cw_dupe').prompt) === coworkDefaults().find(t => t.id === 'cw_dupe').prompt.replace(/\{오늘\}/g, '20261116') };
        out.same = before === JSON.stringify(state.schedule) + JSON.stringify(state.projects);
        return out;
      });
      assert.deepEqual(r.sched.split('\n'), LINES, '{최근일정}\n' + r.sched);
      assert.ok(!/1234|4321|7777|2222|도어락|공동현관|자재는 문 앞|열쇠는 관리실|잔금|부가세|자격 시험|창밖|김가상|9999|가온로|제미나이/.test(r.sched), '실리면 안 되는 글: ' + r.sched);
      assert.equal(r.sites, SITES, '{현장목록} ' + r.sites);
      assert.equal(r.both, '가\n' + LINES.join('\n') + '\n나\n' + SITES + '\n다 20261116', '둘 다 든 명령');
      assert.equal(r.plain, '자리 없는 명령 20261116 $& {일정}', '자리가 없는 명령 ' + r.plain);
      assert.equal(r.dupe, true, '옛 명령은 {오늘} 만 바뀜');
      assert.equal(r.same, true, '읽기만');
      // 빈 일정표·빈 현장 목록 · 60줄·80곳 넘침
      const e = await page.evaluate(() => {
        const keepS = state.schedule, keepP = state.projects, S = (i, d) => ({ id: 'n' + i, date: d, time: '09:00', title: '작업' + String(i).padStart(2, '0'), project: '', memo: '', hours: 8, report: null });
        state.schedule = []; state.projects = [];
        const empty = [cwFill('{최근일정}'), cwFill('{현장목록}')];
        state.schedule = Array.from({ length: 70 }, (_, i) => S(i, i < 35 ? '2026-11-05' : '2026-11-06'));
        state.projects = Array.from({ length: 85 }, (_, i) => ({ name: '합성현장' + String(i + 1).padStart(2, '0'), stage: 1 })).concat([{ name: '보관한 곳', archived: true }]);
        const many = cwFill('{최근일정}').split('\n');
        state.schedule = state.schedule.concat([Object.assign(S(99, '2026-11-10'), { project: '합성현장02' })]);   // 오래된 현장이라도 최근 일정에 나오면 남는다
        const sites = cwFill('{현장목록}').split('\n');
        state.schedule = keepS; state.projects = keepP;
        // 일정표를 못 읽어도 복사는 된다 — 빈칸 대신 '직접 읽어 달라'는 글(현장 목록은 그대로 채움)
        const keepFn = hjSchShareDays; hjSchShareDays = () => { throw new Error('합성 오류'); };
        let broken = ''; try { broken = cwFill('가 {최근일정} 나 {현장목록}'); } finally { hjSchShareDays = keepFn; }
        return { empty, n: many.length, head: many[0], first: many[1], last: many[many.length - 1], sn: sites.length, s0: sites[0], s1: sites[1], s79: sites[79], tail: sites[80], broken };
      });
      assert.equal(e.broken, '가 (일정표를 읽지 못했습니다 — 현장웹에서 직접 읽어 주세요) 나 - 가온아파트\n- 보람마을 2단지', '못 읽을 때 ' + e.broken);
      assert.deepEqual(e.empty, ['(일정 없음)', '(현장 없음)'], '빈 자료 ' + JSON.stringify(e.empty));
      assert.deepEqual([e.n, e.head, e.first, e.last], [61, '(앞선 10건은 줄였습니다)', '11/5(목) 09:00 작업10 — 현장 없음', '11/6(금) 09:00 작업69 — 현장 없음'], '60줄 넘침 ' + JSON.stringify(e));
      assert.deepEqual([e.sn, e.s0, e.s1, e.s79, e.tail], [81, '- 합성현장02', '- 합성현장07', '- 합성현장85', '외 5곳'], '80곳 넘침 — 최근 일정의 현장 + 나중에 만든 현장을 남김(차례는 그대로) ' + JSON.stringify(e));
    });

    await test('③ 복사 — 🧰 창·전체 보기에 채운 글 · 저장된 명령·저장본은 그대로 (COPY)', async () => {
      await page.evaluate(SEED);
      await page.evaluate(() => { coworkTasksEnsure(); coworkTasksManage(); });
      await page.waitForSelector('#modalRoot .cw-row[data-cw-row="cw_sitesort"] .cwCopy');
      const before = await page.evaluate(stable);
      await page.evaluate(() => { window.__copied = []; });
      await page.click('#modalRoot .cw-row[data-cw-row="cw_sitesort"] .cwCopy');
      await page.waitForFunction(() => window.__copied.length === 1);
      const c = await page.evaluate(() => ({ text: window.__copied[0], toast: document.getElementById('toast').textContent, saved: state.coworkTasks.find(t => t.id === 'cw_sitesort').prompt }));
      assert.ok(c.text.startsWith('🧰 사용할 스킬: manmul-hyeonjang'), '스킬 줄 먼저: ' + c.text.slice(0, 80));
      assert.ok(c.text.includes('[현장웹 최근 일정]  ← 복사할 때 현장웹이 채운다(2주 전 ~ 3일 뒤)\n' + LINES.join('\n') + '\n\n[현장웹 현장 목록]  ← 보관한 현장은 빠져 있다\n' + SITES + '\n\n[할 일]'), '채운 글:\n' + c.text.slice(0, 1400));
      assert.ok(!c.text.includes('{최근일정}') && !c.text.includes('\n{현장목록}\n') && c.text.includes('_중복정리_보관_20261116') && c.text.includes('A$&B {현장목록} {오늘} — 현장 없음'), '자리 줄은 채워지고 일정 제목에 든 같은 글자는 그대로');
      assert.ok(/톡방·구글 포토 사진 → 현장사진·현장 정리 복사됨 — 클로드에 붙여넣으세요/.test(c.toast), '알림 ' + c.toast);
      assert.ok(c.saved.includes('{최근일정}') && c.saved.includes('{현장목록}') && c.saved.includes('{오늘}') && !c.saved.includes('경계 첫날'), '저장된 명령은 자리 글자 그대로');
      // 전체 보기 — 화면에 채운 글, [📋 이 명령 복사]도 같은 글
      await page.evaluate(() => coworkTaskView('cw_sitesort'));
      await page.waitForSelector('#modalRoot #cwvCopy');
      const v = await page.evaluate(async () => { const root = document.getElementById('modalRoot'); window.__copied = []; root.querySelector('#cwvCopy').click(); await new Promise(r => setTimeout(r, 50));
        return { prep: (root.querySelector('#cwvPrep') || {}).textContent || '', body: root.textContent, copied: window.__copied[0] || '' }; });
      assert.ok(/^준비: PC 크롬에 톡서랍/.test(v.prep) && v.body.includes('11/13(금) 08:00 타일 (2/3일째) — 가온아파트') && v.body.includes('현장사진/<현장 이름>/'), '전체 보기 ' + v.prep);
      assert.equal(v.copied, c.text, '전체 보기 복사도 같은 글');
      // 고치는 창 — 저장된 글(자리 글자 그대로)과 '복사할 때 바뀐다'는 안내
      await page.evaluate(() => coworkTaskEdit('cw_sitesort'));
      await page.waitForSelector('#modalRoot #cwPrompt');
      const ed = await page.evaluate(() => { const root = document.getElementById('modalRoot'); return { raw: root.querySelector('#cwPrompt').value, hint: (root.querySelector('#cwSlotHint') || {}).textContent || '' }; });
      assert.ok(ed.raw.includes('{최근일정}') && ed.raw.includes('{현장목록}') && !ed.raw.includes('경계 첫날'), '고치는 창은 저장된 글');
      assert.ok(/\{오늘\} · \{최근일정\} · \{현장목록\}/.test(ed.hint) && /복사할 때/.test(ed.hint), '자리 안내 ' + ed.hint);
      // ⏰ Cowork 예약의 지시서 파일(_코워크_오늘업무.md)도 채운 글 — 예전엔 자리 글자가 그대로 들어갔다
      const md = await page.evaluate(() => coworkOrderText([{ task: state.coworkTasks.find(t => t.id === 'cw_sitesort'), sched: { freq: 'daily' } }]));
      assert.ok(!md.includes('{최근일정}') && !md.includes('\n{현장목록}\n') && md.includes('_중복정리_보관_20261116') && md.includes(LINES[0]) && md.includes(SITES), '지시서 파일도 채움:\n' + md.slice(0, 600));
      assert.equal(await page.evaluate(stable), before, '저장본 불변');
      assert.ok((await page.evaluate(() => state.coworkTasks.find(t => t.id === 'cw_sitesort').prompt)).includes('{최근일정}'), '두 번 복사한 뒤에도 저장된 명령 그대로');
      await page.evaluate(() => closeModal(true));
      await context.close();
    });

    await test('④ 폰 390 — 가로 넘침 없음 · 단추 44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      const phone = await open(390);
      await phone.page.evaluate(SEED);
      await phone.page.evaluate(() => { coworkTasksEnsure(); coworkTasksManage(); });
      await phone.page.waitForSelector('#modalRoot .cw-row[data-cw-row="cw_sitesort"]');
      const measure = () => phone.page.evaluate(() => { const root = document.getElementById('modalRoot'), modal = root.querySelector('.modal') || root;
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, modalOver: modal.scrollWidth - modal.clientWidth,
          small: [...root.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => [b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44) }; });
      const list = await measure();
      assert.ok(list.over <= 0 && list.modalOver <= 1 && list.small.length === 0, '목록 ' + JSON.stringify(list));
      await phone.page.evaluate(() => coworkTaskView('cw_sitesort'));
      await phone.page.waitForSelector('#modalRoot #cwvCopy');
      const view = await measure();
      assert.ok(view.over <= 0 && view.modalOver <= 1 && view.small.length === 0, '전체 보기 ' + JSON.stringify(view));
      await phone.page.evaluate(() => coworkTaskEdit('cw_sitesort'));
      await phone.page.waitForSelector('#modalRoot #cwSlotHint');
      const edit = await measure();
      assert.ok(edit.over <= 0 && edit.modalOver <= 1 && edit.small.length === 0, '고치는 창 ' + JSON.stringify(edit));
      await phone.context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    console.log(`sitecmd-v604: ${passed}/4 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL sitecmd-v604 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
