/* v571 📍📅 사진 위치 + 그날 일정으로 현장 판단 — 🧹 AI 자동 정리 · 🧭/👉 추천의 위치 확인. 합성 자료만, 바깥 쓰기 0.
   11/11 실측: 🧹 AI 자동 정리가 날짜마다 '그날 일정 하나'로 그날 미배정 사진 전부를 한 현장으로 제안(다른 동네 15장·세 현장 36장).
   규칙: 위치와 그날 일정이 같은 현장을 가리킬 때만 추천(체크·자동 실행) — 나머지는 '확인필요'(체크 해제). 배정은 묶음의 사진 id 로만.
   ① 판단 묶음(hjPhotoOrgPlan): 일치 3(여러 날 공정 이어지는 날·일정 두 곳 중 위치로 고름·보관 현장 옆) · 위치만 · 처음 가는 현장 · 엇갈림 · 근처 현장 둘 · 일정 현장과 먼 곳 ·
      위치 없음(일정 한 곳/여러 곳/없음) · 💰 일정은 일정 아님 · 먼 곳 — 묶음·미리 고른 현장·근거 글 (PLAN)
   ② AI 비서 도구 suggest_photo_organization: 실행힌트는 일치 묶음에만(사진 id), assign_photos 는 ids 의 사진만 (TOOL)
   ③ 🧹 창(1280): 일치 묶음만 체크 · 확인필요는 체크 해제 · 고르면 체크 → 적용: 안전판 1회 · 체크한 묶음의 사진만(같은 날 엇갈림 묶음은 그대로) · 현장 안 고른 묶음은 그대로 (APPLY)
   ④ 자동 실행(가져오기 뒤 자동 켬): 일치 묶음만 넣고 요약 창 [🔎 확인필요 n장 보기] → 확인필요 창 · AI 비서 auto_organize_photos 도 일치만 (AUTO)
   ⑤ 🧭/👉 추천(photoSuggestFor): 위치로 고른 현장이 그날 일정과 다름·근처 현장 둘·150m 밖이면 '참고'(gpsck, 체크·일괄 안 함), 아니면 그대로 확실 ·
      🧭 창의 참고 줄은 현장 고르기 칸(제안 현장 미리 고름) — 바꿔 고르면 그 현장으로 배정 (SUGGEST)
   ⑥ 폰 390: 창 가로 넘침 없음 · 체크칸·현장 고르기·발 단추·자동 실행 줄 44px (PHONE)
   ⑦ 핀 · 오류 0 · 바깥 쓰기 0
   HJ_V571_BASELINE=<commit> 은 ① 에서, HJ_V571_MUTATION=sched-first 는 ①, date-hint 는 ③, no-caution 은 ⑤ 에서 실패해야 한다. */
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
let html = process.env.HJ_V571_BASELINE ? execFileSync('git', ['show', process.env.HJ_V571_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = process.env.HJ_V571_MUTATION || '';
const mutate = (from, to) => { assert(SRC.includes(from), 'mutation anchor: ' + from.slice(0, 60)); html = SRC.replace(from, to); };
if (MUT === 'sched-first') mutate("return {k:'conflict',site:'',gps:d1.name,m:d1.m,ll:1};", "return {k:'agree',site:sch[0],m:d1.m,ll:1};");
if (MUT === 'date-hint') mutate("out.push({to_project:to,unassigned:true,ids:g.ids.slice(i,i+500)});", "out.push({to_project:to,unassigned:true,date_from:g.day,date_to:g.day});");
if (MUT === 'no-caution') mutate("function hjPlaceSuggestCaution(name,m,lat,lng,ctx,ymd){", "function hjPlaceSuggestCaution(name,m,lat,lng,ctx,ymd){return '';");
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); localStorage.removeItem('hj_auto_org'); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
  // 부팅 뒤 늦게 도는 자료 씨앗(세금 일정·협업 예약)이 검사 도중 끼어들지 않게 미리 돌린다(v507 과 같은 방법)
  await page.evaluate(() => { try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (e) {} });
  return { context, page };
}
/* 시드(합성 이름) — 가나(사진 기준) · 라온(가나 북쪽 200m, 사진 기준) · 나래(1.7km, 사진 기준) · 다솜(처음 가는 현장 — 위치 기록 없음) · 바다(현장 좌표) · 마루(보관, 가나 옆 20m).
   일정: 11/2 가나 · 11/3 다솜 · 11/5 가나+나래 · 11/6 라온 · 11/7 나래 · 11/8 가나 · 11/10 '💰 잔금'(가나) · 11/12~13 바다(여러 날). 11/4·11/9·11/14 일정 없음. */
const SEED = px => {
  const M = 111320, LAT = 36.35, COS = Math.cos(LAT * Math.PI / 180);
  const at = (base, north, east) => [base[0] + north / M, base[1] + east / (M * COS)];
  const A = [36.35, 127.38], D = at(A, 200, 0), B = [36.36, 127.395], C = [36.34, 127.37], E = at(A, 0, 20), F = [36.37, 127.36];
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
  let n = 0;
  const ph = (id, project, when, ll) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: new Date(when + '+09:00'), lat: ll ? ll[0] : null, lng: ll ? ll[1] : null, size: 1000 + (++n) * 7, thumb: px });
  state.projects = [P('가나아파트'), P('라온아파트'), P('나래아파트'), P('다솜빌라'), P('바다아파트', { lat: F[0], lng: F[1] }), P('마루상가', { archived: true })];
  state.schedule = [
    { id: 'sc1', date: '2026-11-02', time: '09:00', title: '욕실 철거', project: '가나아파트' },
    { id: 'sc2', date: '2026-11-03', time: '09:00', title: '누수 점검', project: '다솜빌라' },
    { id: 'sc3', date: '2026-11-05', time: '09:00', title: '타일', project: '가나아파트' }, { id: 'sc4', date: '2026-11-05', time: '13:00', title: '실측', project: '나래아파트' },
    { id: 'sc5', date: '2026-11-06', time: '09:00', title: '방수', project: '라온아파트' },
    { id: 'sc6', date: '2026-11-07', time: '09:00', title: '도배', project: '나래아파트' },
    { id: 'sc7', date: '2026-11-08', time: '09:00', title: '마감', project: '가나아파트' },
    { id: 'sc8', date: '2026-11-10', time: '10:00', title: '💰 잔금', project: '가나아파트' },
    { id: 'sc9', date: '2026-11-12', time: '09:00', title: '철거', project: '바다아파트', memo: '2026-11-12~2026-11-13 (2일)' },
  ];
  state.files = [
    ph('ra1', '가나아파트', '2026-10-20T10:00:00', A), ph('ra2', '가나아파트', '2026-10-20T10:05:00', at(A, 0, 5)), ph('ra3', '가나아파트', '2026-10-20T10:10:00', at(A, 0, -5)),
    ph('rd1', '라온아파트', '2026-10-21T10:00:00', D), ph('rd2', '라온아파트', '2026-10-21T10:05:00', D),
    ph('rb1', '나래아파트', '2026-10-22T10:00:00', B), ph('rb2', '나래아파트', '2026-10-22T10:05:00', B),
    ph('re1', '마루상가', '2026-10-23T10:00:00', E),
    ph('ag1', '', '2026-11-02T09:00:00', at(A, -10, 0)), ph('ag2', '', '2026-11-02T09:10:00', at(A, 0, 30)),
    ph('nw1', '', '2026-11-03T09:00:00', at(C, 10, 0)), ph('nw2', '', '2026-11-03T09:10:00', at(C, -10, 0)),
    ph('cf1', '', '2026-11-03T16:00:00', at(A, -20, 0)), ph('cf2', '', '2026-11-03T16:05:00', at(A, -20, 5)),
    ph('gp1', '', '2026-11-04T10:00:00', at(B, 15, 0)),
    ph('m1', '', '2026-11-05T09:00:00', null), ph('b5', '', '2026-11-05T14:00:00', at(B, 0, 20)),
    ph('nr1', '', '2026-11-06T10:00:00', at(A, 100, 0)),
    ph('far1', '', '2026-11-07T10:00:00', at(B, -2500, 0)),
    ph('s1', '', '2026-11-08T10:00:00', null),
    ph('n1', '', '2026-11-09T10:00:00', null),
    ph('z1', '', '2026-11-10T10:00:00', null),
    ph('fc1', '', '2026-11-13T10:00:00', at(F, 10, 0)),
    ph('fa1', '', '2026-11-14T10:00:00', at(A, -300, 0)),
  ];
  state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const proj = page => page.evaluate(() => Object.fromEntries(state.files.filter(f => !/^r/.test(f.id)).map(f => [f.id, f.project || ''])));
const UNASSIGNED0 = { ag1: '', ag2: '', nw1: '', nw2: '', cf1: '', cf2: '', gp1: '', m1: '', b5: '', nr1: '', far1: '', s1: '', n1: '', z1: '', fc1: '', fa1: '' };
const modalRows = page => page.evaluate(() => {
  const root = document.getElementById('modalRoot');
  return {
    title: (root.querySelector('#modalTitle') || {}).textContent || '',
    secs: [...root.querySelectorAll('.hjorg-sec')].map(s => s.dataset.orgSec + ':' + s.textContent.replace(/\s+/g, ' ').trim()),
    rows: [...root.querySelectorAll('.hjorg-row')].map(r => ({ i: +r.dataset.org, k: r.dataset.orgK, checked: r.querySelector('.orgChk').checked, sel: r.querySelector('.orgSel').value,
      text: r.querySelector('.hjorg-txt').textContent.replace(/\s+/g, ' ').trim(), imgs: r.querySelectorAll('.hjorg-th img').length })),
    foot: [...root.querySelectorAll('.mfoot button')].map(b => b.textContent),
  };
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS placejudge-v571 ' + name); }
  let { context, page } = await openPage(1280, 900);
  await page.evaluate(SEED, PX);

  await test('① 판단 묶음 — 일치 3 · 확인필요 10 · 미리 고른 현장 · 근거 글 (PLAN)', async () => {
    const r = await page.evaluate(() => {
      const plan = hjPhotoOrgPlan();
      return { un: plan.un, refs: plan.refs, g: plan.groups.map(g => ({ day: g.day, k: g.k, ok: g.ok, pre: g.pre, ids: g.ids.join(','), why: g.why, top: g.top })) };
    });
    assert.equal(r.un, 16, 'unassigned photos ' + r.un);
    assert.equal(r.refs, 4, 'refs: 가나·라온·나래(사진) + 바다(현장 좌표) — 다솜 없음·보관 마루 제외 ' + r.refs);
    const sig = r.g.map(g => [g.day, g.k, g.ok, g.pre, g.ids]);
    assert.deepEqual(sig, [
      ['2026-11-14', 'none', false, '', 'fa1'],
      ['2026-11-13', 'agree', true, '바다아파트', 'fc1'],
      ['2026-11-10', 'none', false, '', 'z1'],
      ['2026-11-09', 'none', false, '', 'n1'],
      ['2026-11-08', 'sched', false, '가나아파트', 's1'],
      ['2026-11-07', 'far', false, '', 'far1'],
      ['2026-11-06', 'near2', false, '라온아파트', 'nr1'],
      ['2026-11-05', 'agree', true, '나래아파트', 'b5'],
      ['2026-11-05', 'multi', false, '', 'm1'],
      ['2026-11-04', 'gps', false, '나래아파트', 'gp1'],
      ['2026-11-03', 'new', false, '다솜빌라', 'nw1,nw2'],
      ['2026-11-03', 'conflict', false, '', 'cf1,cf2'],
      ['2026-11-02', 'agree', true, '가나아파트', 'ag1,ag2'],
    ], 'PLAN groups ' + JSON.stringify(sig));
    const by = Object.fromEntries(r.g.map(g => [g.day + ':' + g.k, g]));
    assert.match(by['2026-11-02:agree'].why, /사진 위치가 "가나아파트"에서 \d+m · 그날 일정도 "가나아파트"/, by['2026-11-02:agree'].why);
    assert.match(by['2026-11-03:conflict'].why, /위치는 "가나아파트" 근처\(\d+m\)인데 그날 일정은 "다솜빌라"/, by['2026-11-03:conflict'].why);
    assert.deepEqual(by['2026-11-03:conflict'].top, ['가나아파트', '다솜빌라'], 'conflict offers both at the top');
    assert.match(by['2026-11-03:new'].why, /그날 일정은 "다솜빌라" — 이 현장은 위치 있는 사진이 아직 없어/, by['2026-11-03:new'].why);
    assert.match(by['2026-11-06:near2'].why, /"(가나|라온)아파트" 100m · "(가나|라온)아파트" 100m — 위치로는 못 가려요 · 그날 일정은 "라온아파트"/, by['2026-11-06:near2'].why);
    assert.match(by['2026-11-07:far'].why, /그날 일정은 "나래아파트"인데 사진은 그 현장에서 2\.5km 떨어진 곳/, by['2026-11-07:far'].why);
    assert.match(by['2026-11-05:multi'].why, /그날 일정: "가나아파트" · "나래아파트" — 사진에 위치가 없어요/, by['2026-11-05:multi'].why);
    assert.match(by['2026-11-08:sched'].why, /사진에 위치 정보가 없어 그날 일정\("가나아파트"\)으로만/, by['2026-11-08:sched'].why);
    assert.match(by['2026-11-14:none'].why, /그날 일정 없음 · 알려진 현장과 먼 곳\(가장 가까운 "가나아파트" 300m\)/, by['2026-11-14:none'].why);
    assert.match(by['2026-11-10:none'].why, /그날 일정 없음 · 사진에 위치 없음/, '💰 schedule is not a work schedule ' + by['2026-11-10:none'].why);
    assert.match(by['2026-11-04:gps'].why, /그날 일정이 없어 확인 후 체크/, by['2026-11-04:gps'].why);
  });

  await test('② AI 비서 도구 — 실행힌트는 일치 묶음에만(사진 id) · assign_photos 는 ids 만 (TOOL)', async () => {
    const r = await page.evaluate(async () => {
      const out = await aiToolRun('suggest_photo_organization', {});
      return { un: out.미배정, rows: out.제안.map(x => ({ d: x.날짜, n: x.장수, ck: x.확인필요, to: x.추정현장, hint: x.실행힌트 })), guide: out.안내 };
    });
    assert.equal(r.un, 16);
    const hinted = r.rows.filter(x => x.hint);
    assert.deepEqual(hinted.map(x => [x.d, x.hint.to_project, x.hint.unassigned, x.hint.ids.join(','), x.ck]), [
      ['2026-11-13', '바다아파트', true, 'fc1', false], ['2026-11-05', '나래아파트', true, 'b5', false], ['2026-11-02', '가나아파트', true, 'ag1,ag2', false],
    ], 'TOOL hints only for agreeing groups ' + JSON.stringify(hinted));
    assert(r.rows.filter(x => !x.hint).every(x => x.ck === true), 'TOOL other groups are 확인필요');
    assert(r.rows.some(x => x.to === '다솜빌라 (확인필요)') && r.rows.some(x => x.to === '(모름)'), 'TOOL guess labels ' + JSON.stringify(r.rows.map(x => x.to)));
    assert.match(r.guide, /추측으로 배정 금지/, r.guide);
    const before = await proj(page);
    const a = await page.evaluate(async () => aiToolRun('assign_photos', { to_project: '가나아파트', unassigned: true, ids: ['ag1'] }));
    assert.equal(a.배정, 1, JSON.stringify(a));
    const after = await proj(page);
    assert.deepEqual(after, Object.assign({}, before, { ag1: '가나아파트' }), 'TOOL ids only ' + JSON.stringify(after));
    await page.evaluate(() => { state.files.find(f => f.id === 'ag1').project = ''; if (typeof __photoCache !== 'undefined') __photoCache.key = null; });
  });

  await test('③ 🧹 창 — 일치만 체크 · 고르면 체크 · 적용은 체크한 묶음의 사진만 · 안전판 1회 (APPLY)', async () => {
    await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
    await page.waitForSelector('#modalRoot .hjorg-row');
    const m = await modalRows(page);
    assert.match(m.title, /🧹 AI 자동 정리 — 미배정 16장/, m.title);
    assert.deepEqual(m.secs.map(s => s.split(':')[0]), ['ok', 'check'], JSON.stringify(m.secs));
    assert.match(m.secs[0], /위치·일정 일치 — 체크해 두었어요 · 3묶음 4장/, m.secs[0]);
    assert.match(m.secs[1], /확인필요 — 현장을 확인하고 체크하세요 · 10묶음 12장/, m.secs[1]);
    assert.deepEqual(m.rows.map(x => [x.k, x.checked, x.sel]), [
      ['agree', true, '바다아파트'], ['agree', true, '나래아파트'], ['agree', true, '가나아파트'],
      ['none', false, ''], ['none', false, ''], ['none', false, ''], ['sched', false, '가나아파트'], ['far', false, ''], ['near2', false, '라온아파트'],
      ['multi', false, ''], ['gps', false, '나래아파트'], ['new', false, '다솜빌라'], ['conflict', false, ''],
    ], 'APPLY rows ' + JSON.stringify(m.rows.map(x => [x.k, x.checked, x.sel])));
    assert(m.rows[2].imgs === 2 && /11\/2\(월\) · 2장 · 📍📅 위치·일정 일치/.test(m.rows[2].text), JSON.stringify(m.rows[2]));
    assert(/⚠ 위치·일정 엇갈림/.test(m.rows[12].text) && /현장 고르기/.test(await page.evaluate(() => document.querySelectorAll('#modalRoot .orgSel')[12].options[0].textContent)), JSON.stringify(m.rows[12]));
    assert.deepEqual(m.foot, ['✅ 선택 적용 + 공정 태깅', '나중에']);
    const r = await page.evaluate(async () => {
      const root = document.getElementById('modalRoot');
      const rowOf = k => [...root.querySelectorAll('.hjorg-row')].find(x => x.dataset.orgK === k);
      rowOf('new').querySelector('.orgChk').checked = true;                  // 11/3 다솜(처음 가는 현장) — 같은 날 엇갈림 묶음은 그대로 둔다
      rowOf('gps').querySelector('.orgChk').checked = true;                  // 11/4 위치만 → 나래
      const sel = rowOf('multi').querySelector('.orgSel'); sel.value = '가나아파트'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const multiChecked = rowOf('multi').querySelector('.orgChk').checked;
      [...root.querySelectorAll('.hjorg-row')].filter(x => x.dataset.orgK === 'none')[1].querySelector('.orgChk').checked = true;   // 11/9 — 현장 안 고름
      const before = ((await idbGet('hj_snaps')) || []).length;
      [...root.querySelectorAll('.mfoot button')].find(x => /선택 적용/.test(x.textContent)).click();
      for (let i = 0; i < 60 && !/정리 완료/.test((document.querySelector('#modalRoot .mbody') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 100));
      const snaps = (await idbGet('hj_snaps')) || [];
      return { multiChecked, added: snaps.slice(before).map(x => x.label), summary: (document.querySelector('#modalRoot .mbody') || {}).textContent || '' };
    });
    assert(r.multiChecked, 'choosing a project checks the row');
    const after = await proj(page);
    assert.deepEqual(after, Object.assign({}, UNASSIGNED0, { ag1: '가나아파트', ag2: '가나아파트', b5: '나래아파트', fc1: '바다아파트', nw1: '다솜빌라', nw2: '다솜빌라', gp1: '나래아파트', m1: '가나아파트' }),
      'APPLY only the checked groups\' photos (11/3 conflict photos stay) ' + JSON.stringify(after));
    assert.equal(r.added.filter(l => l === 'AI 자동 정리 전').length, 1, 'one forced snapshot ' + JSON.stringify(r.added));
    assert(/현장 배정: 8장/.test(r.summary) && /현장을 안 고른 1묶음은 그대로/.test(r.summary) && /남은 미배정: 8장/.test(r.summary), 'APPLY summary ' + r.summary);
    await page.evaluate(() => closeModal());
  });

  await test('④ 자동 실행 — 일치 묶음만 · 요약 [🔎 확인필요 n장 보기] · AI 비서 auto_organize_photos 도 일치만 (AUTO)', async () => {
    await page.evaluate(SEED, PX);
    await page.evaluate(() => { localStorage.setItem('hj_auto_org', '1'); aiAutoOrgOffer('scan'); });
    await page.waitForFunction(() => /자동 정리 완료/.test((document.querySelector('#modalRoot .mbody') || {}).textContent || ''));
    const s = await page.evaluate(() => ({ body: document.querySelector('#modalRoot .mbody').textContent, foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent) }));
    assert.deepEqual(await proj(page), Object.assign({}, UNASSIGNED0, { ag1: '가나아파트', ag2: '가나아파트', b5: '나래아파트', fc1: '바다아파트' }), 'AUTO only agreeing groups');
    assert(/현장 배정: 4장 \(위치·일정이 같은 현장을 가리킨 묶음만\)/.test(s.body) && /확인필요: 10묶음 12장 — 위치·일정이 엇갈리거나 단서가 부족해 자동으로 넣지 않았어요/.test(s.body), 'AUTO summary ' + s.body);
    assert.deepEqual(s.foot, ['🔎 확인필요 12장 보기', '닫기'], JSON.stringify(s.foot));
    await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /확인필요/.test(b.textContent)).click());
    await page.waitForSelector('#modalRoot .hjorg-row');
    const m = await modalRows(page);
    assert.deepEqual(m.secs.map(x => x.split(':')[0]), ['check'], 'AUTO review shows only 확인필요 ' + JSON.stringify(m.secs));
    assert(m.rows.length === 10 && m.rows.every(x => !x.checked), 'AUTO review rows unchecked ' + JSON.stringify(m.rows.map(x => [x.k, x.checked])));
    await page.evaluate(() => { closeModal(); localStorage.removeItem('hj_auto_org'); });
    await page.evaluate(SEED, PX);
    const res = await page.evaluate(async () => aiToolRun('auto_organize_photos', {}));
    assert(res.배정 === 4 && res.확인필요 === 12 && res.확인필요묶음 === 10 && /사용자에게 현장을 물어볼 것/.test(res.안내), 'AUTO agent result ' + JSON.stringify(res));
  });

  await test('⑤ 🧭/👉 추천 — 일정과 다름·근처 현장 둘·150m 밖은 참고(gpsck), 나머지는 확실 그대로 (SUGGEST)', async () => {
    await page.evaluate(SEED, PX);
    const r = await page.evaluate(() => {
      const rows = hjPhotoSuggestReviewData();
      const out = {};
      rows.forEach(x => { out[x.open.map(p => p.id).join(',')] = { why: x.sg ? x.sg.why : null, name: x.sg ? x.sg.name : '', sure: x.sure, label: x.sg ? photoSuggestLabel(x.sg) : '' }; });
      return { out, bulk: (document.getElementById('btnSuggestAll') || {}).textContent || '' };
    });
    const o = r.out;
    assert(o['cf1,cf2'] && o['cf1,cf2'].why === 'gpsck' && !o['cf1,cf2'].sure && /참고: 위치는 "가나아파트" 근처인데 그날 일정은 "다솜빌라"/.test(o['cf1,cf2'].label), 'SUGGEST schedule mismatch ' + JSON.stringify(o['cf1,cf2']));
    assert(o.nr1 && o.nr1.why === 'gpsck' && /참고: 근처 현장 여럿/.test(o.nr1.label), 'SUGGEST two sites near ' + JSON.stringify(o.nr1));
    assert(o.fa1 && o.fa1.why === 'gpsck' && /참고: "가나아파트"에서 300m — 조금 멀어요/.test(o.fa1.label), 'SUGGEST farther than 150m ' + JSON.stringify(o.fa1));
    for (const k of ['ag1,ag2', 'b5', 'gp1', 'fc1']) assert(o[k] && o[k].why === 'gps' && o[k].sure, 'SUGGEST stays sure ' + k + ' ' + JSON.stringify(o[k]));
    assert.match(r.bulk, /추천대로 4묶음 배정/, 'bulk button counts only sure clusters ' + r.bulk);
    // 🧭 창: 참고(gpsck) 줄은 고르기 칸(제안 현장을 미리 골라 둠)·체크 해제 → 바꿔 고르면 체크 → 배정은 고른 현장으로
    const m = await page.evaluate(async () => {
      hjPhotoSuggestReview({ from: 'test' });
      await new Promise(r => setTimeout(r, 200));
      const root = document.getElementById('modalRoot');
      const rows = [...root.querySelectorAll('.psr-row')];
      const rowCf = rows.find(x => /2026\.11\.03/.test(x.textContent) && /참고: 위치는/.test(x.textContent));
      const sel = rowCf && rowCf.querySelector('.psrSel');
      const out = { found: !!rowCf, sel: sel ? sel.value : null, checked: rowCf ? rowCf.querySelector('.psrChk').checked : null };
      if (sel) { sel.value = '다솜빌라'; sel.dispatchEvent(new Event('change', { bubbles: true })); out.after = rowCf.querySelector('.psrChk').checked; }
      rows.forEach(x => { if (x !== rowCf) x.querySelector('.psrChk').checked = false; });
      [...root.querySelectorAll('.mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
      for (let i = 0; i < 40 && document.querySelector('#modalRoot .psr-row'); i++) await new Promise(r => setTimeout(r, 100));
      return out;
    });
    assert(m.found && m.sel === '가나아파트' && m.checked === false && m.after === true, 'SUGGEST 🧭 gpsck row has a preselected picker ' + JSON.stringify(m));
    const after = await proj(page);
    assert.deepEqual(after, Object.assign({}, UNASSIGNED0, { cf1: '다솜빌라', cf2: '다솜빌라' }), 'SUGGEST 🧭 apply uses the chosen project ' + JSON.stringify(after));
  });

  await test('⑥ 폰 390 — 가로 넘침 없음 · 44px (PHONE)', async () => {
    await context.close();
    ({ context, page } = await openPage(390, 844));
    await page.evaluate(SEED, PX);
    await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
    await page.waitForSelector('#modalRoot .hjorg-row');
    const r = await page.evaluate(() => {
      const root = document.getElementById('modalRoot');
      const h = sel => Math.min(...[...root.querySelectorAll(sel)].map(x => Math.round(x.getBoundingClientRect().height)));
      return { scrollW: document.documentElement.scrollWidth, modalW: Math.round(root.querySelector('.modal').getBoundingClientRect().width),
        over: [...root.querySelectorAll('.hjorg-row, .orgSel')].filter(x => x.getBoundingClientRect().right > 390.5).length,
        chk: h('.hjorg-chk'), sel: h('.orgSel'), foot: h('.mfoot button'), auto: Math.round(root.querySelector('#orgAutoChk').closest('label').getBoundingClientRect().height),
        selFont: parseFloat(getComputedStyle(root.querySelector('.orgSel')).fontSize) };
    });
    assert(r.scrollW <= 390 && r.modalW <= 390 && r.over === 0, 'PHONE no overflow ' + JSON.stringify(r));
    assert(r.chk >= 44 && r.sel >= 44 && r.foot >= 44 && r.auto >= 44 && r.selFont >= 16, 'PHONE 44px targets ' + JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });

  await test('⑦ 핀 · 오류 0 · 바깥 쓰기 0', async () => {
    const build = (SRC.match(/const APP_BUILD='hyeonjang-v(\d+)-[^']+'/) || [])[1];
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='(hyeonjang-v\d+-[^']+)'/)[1];
    const pin = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '(hyeonjang-v\d+-[^']+)'/)[1];
    assert(+build >= 571, 'build ' + build);
    assert(sw === pin && SRC.includes("const APP_BUILD='" + sw + "'"), 'pins equal ' + [sw, pin].join(' / '));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await context.close();
  console.log(`placejudge-v571: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL placejudge-v571', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
