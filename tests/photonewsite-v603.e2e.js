/* v603 🧭 추측 배정·🧹 AI 자동 정리 창의 '＋ 새 현장' — 앱에 아직 없는 곳에서 찍은 사진을 그 창에서 새 현장으로.
   대표가 11/12~13 맡긴 일('구글 포토 나머지 사진 위치를 확인해서 프로젝트 생성')에서 두 창은 '이미 있는 현장'만 고를 수 있었다 — 처음 간 곳 사진은
   창을 닫고 현장을 만든 뒤 돌아와 그 묶음을 다시 찾아야 했다. 이름 규칙은 v599 한 곳(hjNewSiteName·hjNewSiteCheck). 합성 이름만, 시계 2026-11-16 고정, 바깥 쓰기 0.
   ① 제안 — 폴더 이름('현장사진/<폴더>/' 한 폴더, 단지 토막만)·사진에 저장된 주소(건물 이름 먼저, 없으면 도로명+번호)로 '＋ 새 현장: 이름' · 진행 현장과 같은 폴더는
      그 현장을 '참고'(미리 고르되 체크 안 함) · 흔한 폴더·날짜 폴더·폴더 섞임·보관/비슷한 현장과 같은 이름은 제안 없이 '이름 입력'만 · 확실한 줄은 그대로 고정 글 ·
      새 현장은 어느 줄에서도 미리 골라지지도 체크되지도 않는다 · 창을 여닫아도 자료 불변 (HINT)
   ② 고르기 — '＋ 새 현장'을 고르면 줄이 체크되고 이름 칸이 열린다(제안 이름, 고칠 수 있음) · 적은 이름으로 무엇이 되는지 바로 아래에:
      새 이름 · 이미 있는 현장(그 현장에 넣음) · 비슷한 현장(그 이름을 알려 줌) · 보관한 같은 이름 · 한 글자 · 다른 현장을 고르면 칸이 닫힌다 · 자료 불변 (PICK)
   ③ 막힘 — 비슷한 현장·보관한 같은 이름·빈 이름인 줄이 체크돼 있으면 다른 줄까지 아무것도 안 바뀐다(안전판도 안 찍음, 그 칸으로 초점) ·
      안전판 실패 · 오래된 창에서도 현장을 만들지도 넣지도 않는다 (BLOCK)
   ④ 배정 — 안전판 1회 뒤 새 현장 2곳만 만들고(단계 0·유형 없음·고객 칸 빈칸) 그 줄 사진만 넣는다 · 같은 이름을 적은 두 줄은 현장 하나 ·
      이미 있는 이름은 만들지 않고 넣기만 · 앞 줄이 만든 현장과 비슷한 이름은 만들지 않고 그대로(알림에 그 현장 이름) · 안 고른 줄은 그대로 ·
      만든 현장은 다음 사진부터 위치로 알아본다(hjPlaceRefs → gps) (APPLY)
   ⑤ 🧹 창 — 하루에 처음 간 두 곳은 두 줄(자리별) · 그 줄에만 '＋ 새 현장'(고르지 않은 채) · 적용: 안전판 1회·그 줄 사진만·다른 자리는 그대로 ·
      자동 실행·AI 도구는 현장을 만들지 않고 일치 묶음만 · 도구 결과에 주소 없음 (ORG)
   ⑥ 폰 390 — 두 창 모두 이름 칸이 열려도 가로 넘침 없음 · 이름 칸 44px·16px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V603_BASELINE=<commit> 과 HJ_V603_MUTATION=preselect-new(새 현장을 미리 고름)·generic-folder(흔한 폴더 이름도 제안)는 ①, no-block(막힌 줄이 있어도 나머지를 배정)은 ③,
   no-recheck(안전판 뒤에 이름을 다시 안 봄)는 ④, day-merge(자리별로 안 나눔)는 ⑤ 에서 실패해야 한다. */
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
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MUT = {
  'preselect-new': ["return (hint&&hint.name?hjNewSiteOptionHtml(hint.name):'')||", "return (hint&&hint.name?hjNewSiteOptionHtml(hint.name,true):'')||"],
  'generic-folder': ['||HJ_PHOTO_DIR_GENERIC.has(n.toLowerCase())', ''],
  'no-block': ["  if(blocked){hjPhotoNewFocus(blocked);toast('새 현장 이름을 확인해 주세요 — 비슷한 현장이 있거나 이름이 짧아 만들지 않았어요(배정도 하지 않음)');return 0;}\n", ''],
  'no-recheck': ["      if(!t.to){late++;t.similar.forEach(x=>{if(!lateSim.includes(x))lateSim.push(x);});return;}\n      to=t.to;\n      if(t.fresh&&ensureProjectExists(to)){made.push(to);names.add(to);}\n", "      if(ensureProjectExists(to)){made.push(to);names.add(to);}\n"],
  'day-merge': [",(j.k==='none'&&j.ll)?spotOf(day,f):''].join('|');", "].join('|');"]
};
let html = process.env.HJ_V603_BASELINE ? execFileSync('git', ['show', process.env.HJ_V603_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V603_MUTATION) {
  const m = MUT[process.env.HJ_V603_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V603_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS photonewsite-v603 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: width < 500 });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.removeItem('hj_auto_org'); });
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
  }, BOOT);
  return { context, page };
}
/* 🧭 시드(합성 이름) — 진행 현장 가온아파트(사진 위치 A)·나래빌라(위치 기록 없음) · 보관 현장 옛상가(E).
   미배정 묶음(날마다 하나, 최신순):
   k1~k3 11/12 처음 간 곳 S1 — 저장된 주소에 건물 이름 '한울빌라'        l1 11/11 처음 간 곳 S2 — 주소에 건물 이름 없음(도로명+번호)
   d1·d2 11/10 폴더 '시험시 중구 달빛로 77 달빛아파트'(위치 없음)        e1·e2 11/09 폴더 '가온 아파트' = 진행 현장(띄어쓰기만 다름)
   h1 11/08 폴더 '카톡'(흔한 이름)   i1 11/07 폴더 '2026-11-07'(날짜)   j1·j2 11/06 폴더 두 곳이 섞임
   m1 11/05 보관 현장 옆 — 주소 건물 이름이 보관 현장과 같음              n1 11/04 주소 건물 이름이 진행 현장과 비슷함('가온 아파트 상가')
   g1·g2 11/03 가온아파트 10m(확실)                                      s1 11/02 위치 없음 · 그날 일정은 나래빌라뿐(참고) */
const SEED = px => {
  closeModal(true); __tabStale = false; state._demo = false;
  const M = 111320, LAT = 36.35, COS = Math.cos(LAT * Math.PI / 180);
  const at = (base, north, east) => [base[0] + north / M, base[1] + east / (M * COS)];
  const A = [36.35, 127.38], S1 = at(A, 5000, 0), S2 = at(A, 0, 8000), E = at(A, -5000, 0), S3 = at(A, 6000, 6000);
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }, extra || {});
  let n = 0;
  const ph = (id, project, when, ll, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: new Date(when + '+09:00'), lat: ll ? ll[0] : null, lng: ll ? ll[1] : null, size: 1000 + (++n) * 7, thumb: px }, extra || {});
  const dir = name => ({ prefix: '현장사진/' + name + '/' });
  state.projects = [P('가온아파트'), P('나래빌라'), P('옛상가', { archived: true, stage: 3 })];
  state.schedule = [{ id: 'sc1', date: '2026-11-02', time: '09:00', title: '도배', project: '나래빌라' }];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.dirHandle = null;
  state.files = [
    ph('ra1', '가온아파트', '2026-10-20T10:00:00', A), ph('ra2', '가온아파트', '2026-10-20T10:05:00', at(A, 0, 5)),
    ph('re1', '옛상가', '2026-10-23T10:00:00', E),
    ph('k1', '', '2026-11-12T10:00:00', S1, { address: '시험시 서구 새벽로 12 · 한울빌라' }), ph('k2', '', '2026-11-12T10:05:00', at(S1, 5, 0), { address: '시험시 서구 새벽로 12 · 한울빌라' }), ph('k3', '', '2026-11-12T10:10:00', at(S1, 0, 5), { address: '시험시 서구 새벽로 12 · 한울빌라' }),
    ph('l1', '', '2026-11-11T10:00:00', S2, { address: '시험시 중구 돌다리로 19번길 9' }),
    ph('d1', '', '2026-11-10T10:00:00', null, dir('시험시 중구 달빛로 77 달빛아파트')), ph('d2', '', '2026-11-10T10:05:00', null, dir('시험시 중구 달빛로 77 달빛아파트')),
    ph('e1', '', '2026-11-09T10:00:00', null, dir('가온 아파트')), ph('e2', '', '2026-11-09T10:05:00', null, { prefix: '현장사진/가온 아파트/욕실/' }),
    ph('h1', '', '2026-11-08T10:00:00', null, dir('카톡')),
    ph('i1', '', '2026-11-07T10:00:00', null, dir('2026-11-07')),
    ph('j1', '', '2026-11-06T10:00:00', null, dir('한빛상가')), ph('j2', '', '2026-11-06T10:05:00', null, dir('두리빌라')),
    ph('m1', '', '2026-11-05T10:00:00', at(E, 10, 0), { address: '시험시 유성구 옛길 5 · 옛상가' }),
    ph('n1', '', '2026-11-04T10:00:00', S3, { address: '시험시 대덕구 가온로 3 · 가온 아파트 상가' }),
    ph('g1', '', '2026-11-03T10:00:00', at(A, 10, 0)), ph('g2', '', '2026-11-03T10:05:00', at(A, 10, 3)),
    ph('s1', '', '2026-11-02T10:00:00', null),
  ];
  state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const UN0 = { k1: '', k2: '', k3: '', l1: '', d1: '', d2: '', e1: '', e2: '', h1: '', i1: '', j1: '', j2: '', m1: '', n1: '', g1: '', g2: '', s1: '' };
const proj = page => page.evaluate(() => Object.fromEntries(state.files.filter(f => !/^r/.test(f.id)).map(f => [f.id, f.project || ''])));
const names = page => page.evaluate(() => state.projects.map(p => p.name));
const snap = page => page.evaluate(() => JSON.stringify(serializeData()));
// 🧭 창의 줄 — 묶음의 사진 id 로 찾는다(줄 순서 = hjPhotoSuggestReviewData 순서)
const view = page => page.evaluate(() => {
  const data = hjPhotoSuggestReviewData(), root = document.getElementById('modalRoot'), out = {};
  [...root.querySelectorAll('.psr-row')].forEach((el, i) => {
    const sel = el.querySelector('.psrSel'), box = el.querySelector('.hjPnBox'), inp = el.querySelector('.hjPnName'), msg = el.querySelector('.hjPnMsg');
    out[data[i].open.map(p => p.id).join(',')] = { i, checked: el.querySelector('.psrChk').checked, select: !!sel, sel: sel ? sel.value : null,
      news: sel ? [...sel.options].filter(o => o.value.indexOf('__new__:') === 0).map(o => o.value + ' | ' + o.textContent) : [],
      newAt: sel ? [...sel.options].findIndex(o => o.value.indexOf('__new__:') === 0) : -1,
      box: box ? !box.hidden : null, name: inp ? inp.value : null, state: msg ? (msg.dataset.state || '') : null, msg: msg ? msg.textContent : '', invalid: inp ? inp.getAttribute('aria-invalid') : null,
      text: el.querySelector('.psr-txt').textContent.replace(/\s+/g, ' ').trim(), folder: (el.querySelector('[data-psr-folder]') || {}).textContent || '',
      hint: el.querySelector('[data-psr-newhint]') ? el.querySelector('[data-psr-newhint]').getAttribute('data-psr-newhint') + ':' + el.querySelector('[data-psr-newhint]').textContent : '' };
  });
  return out;
});
const openPsr = async page => { await page.evaluate(() => { hjPhotoSuggestReview({ from: 'test' }); }); await page.waitForSelector('#modalRoot .psr-row'); };
const rowLoc = (page, v, key) => page.locator('#modalRoot .psr-row >> nth=' + v[key].i);
const pick = async (page, v, key, value, name) => {
  await rowLoc(page, v, key).locator('.psrSel').selectOption(value);
  if (name != null) await rowLoc(page, v, key).locator('.hjPnName').fill(name);
};
const applyBtn = page => page.locator('#modalRoot .mfoot button', { hasText: '체크한 묶음 배정' });
const snapLabels = page => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(x => x.label).filter(l => l !== '작업 중' && l !== '자동'));
const GEN = '__new__: | ＋ 새 현장 (이름 입력)';
/* 🧹 시드 — 11/12 하루에 처음 간 두 곳(S1 건물 이름 있음 · S2 14km 떨어진 곳, 도로명만) + 위치 없는 사진 1장, 11/11 은 가온아파트 일정·위치 일치 1장 */
const SEED_ORG = px => {
  closeModal(true); __tabStale = false; state._demo = false;
  const M = 111320, LAT = 36.35, COS = Math.cos(LAT * Math.PI / 180);
  const at = (base, north, east) => [base[0] + north / M, base[1] + east / (M * COS)];
  const A = [36.35, 127.38], S1 = at(A, 5000, 0), S2 = at(A, -9000, 0);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  let n = 0;
  const ph = (id, project, when, ll, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: new Date(when + '+09:00'), lat: ll ? ll[0] : null, lng: ll ? ll[1] : null, size: 2000 + (++n) * 7, thumb: px }, extra || {});
  state.projects = [P('가온아파트')];
  state.schedule = [{ id: 'sc1', date: '2026-11-11', time: '09:00', title: '타일', project: '가온아파트' }];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.dirHandle = null;
  state.files = [
    ph('ra1', '가온아파트', '2026-10-20T10:00:00', A), ph('ra2', '가온아파트', '2026-10-20T10:05:00', at(A, 0, 5)),
    ph('a1', '', '2026-11-11T10:00:00', at(A, 10, 0)),
    ph('u1', '', '2026-11-12T09:00:00', S1, { address: '시험시 서구 새벽로 12 · 한울빌라' }), ph('u3', '', '2026-11-12T13:00:00', S2, { address: '시험시 중구 돌다리로 19번길 9' }),
    ph('u2', '', '2026-11-12T09:05:00', at(S1, 20, 0), { address: '시험시 서구 새벽로 12 · 한울빌라' }), ph('u4', '', '2026-11-12T13:05:00', at(S2, 0, 30), { address: '시험시 중구 돌다리로 19번길 9' }),
    ph('u5', '', '2026-11-12T15:00:00', null),
  ];
  state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const orgRows = page => page.evaluate(() => {
  const root = document.getElementById('modalRoot');
  return [...root.querySelectorAll('.hjorg-row')].map(el => {
    const sel = el.querySelector('.orgSel'), box = el.querySelector('.hjPnBox'), inp = el.querySelector('.hjPnName');
    return { k: el.dataset.orgK, ids: [...el.querySelectorAll('[data-org-photo]')].map(b => b.getAttribute('data-org-photo')).filter((x, i, a) => a.indexOf(x) === i).join(','), checked: el.querySelector('.orgChk').checked, sel: sel.value,
      news: [...sel.options].filter(o => o.value.indexOf('__new__:') === 0).map(o => o.value + ' | ' + o.textContent), box: box ? !box.hidden : null, name: inp ? inp.value : null,
      where: (el.querySelector('[data-org-where]') || {}).textContent || '' };
  });
});

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    let { context, page } = await open(1280);
    await page.evaluate(SEED, PX);

    await test('① 제안 — 폴더·주소로 새 현장 이름 · 같은 이름 폴더는 참고 · 흔한 폴더·보관/비슷한 이름은 이름 입력만 · 미리 고르지도 체크하지도 않음 · 자료 불변 (HINT)', async () => {
      const before = await snap(page);
      const data = await page.evaluate(() => Object.fromEntries(hjPhotoSuggestReviewData().map(r => [r.open.map(p => p.id).join(','), { why: r.sg ? r.sg.why : null, to: r.sg ? r.sg.name : '', sure: r.sure, nw: r.nw || null }])));
      const nw = k => data[k] && data[k].nw ? [data[k].nw.folder, data[k].nw.exist, data[k].nw.name, data[k].nw.src] : null;
      assert.deepEqual(nw('k1,k2,k3'), ['', '', '한울빌라', 'addr'], '주소의 건물 이름 ' + JSON.stringify(data['k1,k2,k3']));
      assert.deepEqual(nw('l1'), ['', '', '돌다리로 19번길 9', 'addr'], '건물 이름이 없으면 도로명+번호 ' + JSON.stringify(data.l1));
      assert.deepEqual(nw('d1,d2'), ['시험시 중구 달빛로 77 달빛아파트', '', '달빛아파트', 'folder'], '폴더 이름에서 단지 토막만 ' + JSON.stringify(data['d1,d2']));
      assert.deepEqual([nw('e1,e2'), data['e1,e2'].why, data['e1,e2'].to, data['e1,e2'].sure], [['가온 아파트', '가온아파트', '', ''], 'folder', '가온아파트', false], '진행 현장과 같은 폴더(하위 폴더 포함)는 그 현장을 참고로 — 확실 아님 ' + JSON.stringify(data['e1,e2']));
      for (const k of ['h1', 'i1', 'j1,j2']) assert.deepEqual([nw(k), data[k].why], [['', '', '', ''], null], '흔한 폴더·날짜 폴더·폴더 섞임은 단서 아님 ' + k + ' ' + JSON.stringify(data[k]));
      assert.deepEqual([nw('m1'), data.m1.why], [['', '', '', ''], null], '보관 현장과 같은 건물 이름은 제안 안 함 ' + JSON.stringify(data.m1));
      assert.deepEqual(nw('n1'), ['', '', '', ''], '진행 현장과 비슷한 건물 이름은 제안 안 함 ' + JSON.stringify(data.n1));
      assert.deepEqual([data['g1,g2'].why, data['g1,g2'].sure, data['g1,g2'].nw], ['gps', true, null], '확실한 줄은 새 현장 단서를 보지 않는다 ' + JSON.stringify(data['g1,g2']));
      assert.deepEqual([data.s1.why, data.s1.to, nw('s1')], ['schedule', '나래빌라', ['', '', '', '']], '그날 일정 참고는 그대로 ' + JSON.stringify(data.s1));
      assert.deepEqual(await page.evaluate(() => PHOTO_SUGGEST_SURE.slice()), ['gps', 'revisit', 'partial'], '폴더 참고는 일괄 배정(확실)에 안 들어간다');
      await openPsr(page);
      const v = await view(page);
      assert.equal(Object.keys(v).length, 11, '묶음 11 ' + JSON.stringify(Object.keys(v)));
      assert.deepEqual([v['k1,k2,k3'].news, v['k1,k2,k3'].newAt, v['k1,k2,k3'].hint], [['__new__:한울빌라 | ＋ 새 현장: 한울빌라'], 1, 'addr:＋ 새 현장 제안: 한울빌라 · 📍 사진에 저장된 주소에서'], '주소 제안 선택지(맨 위) ' + JSON.stringify(v['k1,k2,k3']));
      assert.deepEqual(v.l1.news, ['__new__:돌다리로 19번길 9 | ＋ 새 현장: 돌다리로 19번길 9'], JSON.stringify(v.l1));
      assert.deepEqual([v['d1,d2'].news, v['d1,d2'].folder, v['d1,d2'].hint], [['__new__:달빛아파트 | ＋ 새 현장: 달빛아파트'], '📁 시험시 중구 달빛로 77 달빛아파트', 'folder:＋ 새 현장 제안: 달빛아파트 · 📁 폴더 이름에서'], '폴더 제안 ' + JSON.stringify(v['d1,d2']));
      assert.deepEqual([v['e1,e2'].sel, v['e1,e2'].checked, v['e1,e2'].news, /참고: 📁 사진 폴더 이름이 이 현장과 같아요/.test(v['e1,e2'].text)], ['가온아파트', false, [GEN], true], '같은 이름 폴더 = 그 현장을 미리 고르되 체크 안 함 ' + JSON.stringify(v['e1,e2']));
      for (const k of ['h1', 'i1', 'j1,j2', 'm1', 'n1']) assert.deepEqual([v[k].sel, v[k].checked, v[k].news, v[k].hint], ['', false, [GEN], ''], '제안 없는 줄은 이름 입력 선택지만 ' + k + ' ' + JSON.stringify(v[k]));
      assert.deepEqual([v['g1,g2'].select, v['g1,g2'].checked, /→ "가온아파트"/.test(v['g1,g2'].text), v['g1,g2'].name], [false, true, true, null], '확실한 줄은 고정 글·체크 그대로 ' + JSON.stringify(v['g1,g2']));
      assert.deepEqual([v.s1.sel, v.s1.checked, v.s1.news, /참고: 그날 일정표/.test(v.s1.text)], ['나래빌라', false, [GEN], true], '일정 참고 줄도 고르기 칸(미리 고름·체크 안 함) ' + JSON.stringify(v.s1));
      const all = Object.values(v);
      assert.ok(all.every(r => !r.select || r.sel.indexOf('__new__:') !== 0), '새 현장은 어느 줄에서도 미리 골라지지 않는다 ' + JSON.stringify(all.map(r => r.sel)));
      assert.ok(all.every(r => !r.select || (r.box === false && !r.checked)), '고르기 칸이 있는 줄은 체크 안 됨 · 이름 칸은 닫혀 있음 ' + JSON.stringify(all.map(r => [r.checked, r.box])));
      await page.evaluate(() => closeModal(true));
      assert.equal(await snap(page), before, '창을 여닫아도 저장본 불변');
      assert.deepEqual(await names(page), ['가온아파트', '나래빌라', '옛상가']);
    });

    await test('② 고르기 — 줄 체크·이름 칸 열림 · 적은 이름으로 무엇이 되는지(새 이름·이미 있음·비슷함·보관·짧음) · 다른 현장을 고르면 닫힘 · 자료 불변 (PICK)', async () => {
      const before = await snap(page);
      await openPsr(page);
      let v = await view(page);
      await pick(page, v, 'd1,d2', '__new__:달빛아파트');
      let r = (await view(page))['d1,d2'];
      assert.deepEqual([r.checked, r.box, r.name, r.state, r.invalid], [true, true, '달빛아파트', 'new', 'false'], '제안을 고르면 체크·이름 칸(제안 이름) ' + JSON.stringify(r));
      assert.match(r.msg, /새 현장을 만들어 이 묶음 사진을 넣습니다 · 이름은 고칠 수 있어요/, r.msg);
      const tries = [['가온 아파트', 'similar', /비슷한 현장: 가온아파트 — 위에서 그 현장을 고르거나 이름을 바꿔 주세요/, 'true'], ['나래빌라', 'exists', /이미 있는 현장이에요 — 새로 만들지 않고 그 현장에 넣습니다/, 'false'],
        ['옛상가', 'archived', /보관한 현장과 이름이 같아요: 옛상가\(보관\)/, 'true'], ['달', 'short', /현장 이름을 두 글자 이상 적어 주세요/, 'true'], ['달빛아파트 상가동', 'new', /새 현장을 만들어/, 'false']];
      for (const [name, state, msg, invalid] of tries) {
        await rowLoc(page, v, 'd1,d2').locator('.hjPnName').fill(name);
        r = (await view(page))['d1,d2'];
        assert.deepEqual([r.state, r.invalid, msg.test(r.msg)], [state, invalid, true], '‘' + name + '’ → ' + JSON.stringify(r));
      }
      await pick(page, v, 'd1,d2', '가온아파트');
      r = (await view(page))['d1,d2'];
      assert.deepEqual([r.checked, r.box, r.sel], [true, false, '가온아파트'], '다른 현장을 고르면 이름 칸이 닫힌다 ' + JSON.stringify(r));
      await pick(page, v, 'd1,d2', '');
      r = (await view(page))['d1,d2'];
      assert.deepEqual([r.checked, r.box], [false, false], '고르기를 비우면 체크도 풀린다 ' + JSON.stringify(r));
      await pick(page, v, 'h1', '__new__:');
      r = (await view(page)).h1;
      assert.deepEqual([r.checked, r.box, r.name, r.state, r.invalid], [true, true, '', 'short', 'true'], '이름 입력 선택지 = 빈 이름 칸 ' + JSON.stringify(r));
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('hjPnName')), true, '빈 이름 칸으로 초점');
      await page.evaluate(() => closeModal(true));
      assert.equal(await snap(page), before, '고르고 적기만 해서는 저장본 불변');
      assert.deepEqual(await names(page), ['가온아파트', '나래빌라', '옛상가']);
    });

    await test('③ 막힘 — 비슷한 현장·보관한 같은 이름·빈 이름 줄이 체크돼 있으면 아무것도 안 바뀜(안전판도 없음) · 안전판 실패 · 오래된 창 (BLOCK)', async () => {
      const before = await snap(page), snaps0 = await snapLabels(page);
      await openPsr(page);
      const v = await view(page);
      await pick(page, v, 'k1,k2,k3', '__new__:한울빌라');            // 멀쩡한 새 현장 줄 — 막힌 줄 때문에 이것도 넣지 않는다
      for (const [name, state] of [['가온 아파트', 'similar'], ['옛상가', 'archived'], ['', 'short']]) {
        await pick(page, v, 'd1,d2', '__new__:달빛아파트', name);
        await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
        await applyBtn(page).click();
        await page.waitForFunction(() => !!document.getElementById('toast').textContent);
        assert.match(await page.evaluate(() => document.getElementById('toast').textContent), /새 현장 이름을 확인해 주세요/, '막힌 줄이 있으면 배정하지 않고 알린다 ‘' + name + '’');
        assert.equal(await page.evaluate(() => !!document.querySelector('#modalRoot .psr-row')), true, '창은 그대로 ‘' + name + '’');
        const r = (await view(page))['d1,d2'];
        assert.deepEqual([r.state, r.box, r.checked], [state, true, true], '막힌 줄에 까닭이 보인다 ‘' + name + '’ ' + JSON.stringify(r));
        assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('hjPnName') && !!document.querySelector('#modalRoot .psr-row')), true, '창은 그대로 · 그 이름 칸으로 초점');
        assert.deepEqual([await proj(page), await names(page), await snapLabels(page)], [UN0, ['가온아파트', '나래빌라', '옛상가'], snaps0], '막힌 줄이 있으면 현장·사진·안전판 그대로 ‘' + name + '’');
      }
      // 이름을 바로잡아도 안전판을 못 만들면 만들지도 넣지도 않는다
      await rowLoc(page, v, 'd1,d2').locator('.hjPnName').fill('달빛아파트');
      const fail = await page.evaluate(async () => {
        window.__realSnap = hjSnapshot; let calls = 0; hjSnapshot = async () => { calls++; return false; };
        [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 300));
        hjSnapshot = window.__realSnap;
        return { calls, toast: document.getElementById('toast').textContent, disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.disabled) };
      });
      assert.ok(fail.calls === 1 && /안전판을 만들지 못해 배정하지 않았습니다/.test(fail.toast) && fail.disabled.every(x => !x), '안전판 실패 ' + JSON.stringify(fail));
      assert.deepEqual([await proj(page), await names(page)], [UN0, ['가온아파트', '나래빌라', '옛상가']], '안전판 실패 → 그대로');
      // 오래된 창(다른 창이 더 최근에 저장) — 여기서 만든 현장은 저장되지 않는다
      const stale = await page.evaluate(async () => {
        __tabStale = true; let calls = 0; const real = hjSnapshot; hjSnapshot = async (...a) => { calls++; return real(...a); };
        [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /체크한 묶음 배정/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 300));
        hjSnapshot = real; __tabStale = false;
        return { calls, toast: document.getElementById('toast').textContent, open: !!document.querySelector('#modalRoot .psr-row') };
      });
      assert.ok(stale.calls === 0 && /오래된 창이에요/.test(stale.toast) && stale.open, '오래된 창 ' + JSON.stringify(stale));
      assert.deepEqual([await proj(page), await names(page), await snapLabels(page)], [UN0, ['가온아파트', '나래빌라', '옛상가'], snaps0], '오래된 창 → 그대로');
      await page.evaluate(() => closeModal(true));
      assert.equal(await snap(page), before, '저장본 불변');
    });

    await test('④ 배정 — 안전판 1회 · 새 현장 2곳만(단계 0·유형 없음·고객 칸 빈칸) · 그 줄 사진만 · 같은 이름은 현장 하나 · 뒤늦게 비슷해진 이름은 그대로 · 다음 사진은 위치로 (APPLY)', async () => {
      const snaps0 = await snapLabels(page);
      await openPsr(page);
      const v = await view(page);
      await pick(page, v, 'k1,k2,k3', '__new__:한울빌라');              // 주소 제안 그대로
      await pick(page, v, 'd1,d2', '__new__:달빛아파트');               // 폴더 제안 그대로
      await pick(page, v, 'h1', '__new__:', '달빛아파트');              // 같은 이름을 손으로 — 현장은 하나만
      await pick(page, v, 'i1', '__new__:', '달빛 아파트');             // 지금은 새 이름이지만 d1·d2 줄이 만든 뒤에는 비슷한 현장
      await pick(page, v, 's1', '__new__:', '나래빌라');                // 이미 있는 현장 — 만들지 않고 넣기만
      await rowLoc(page, v, 'e1,e2').locator('.psrChk').check();        // 폴더 참고(가온아파트) 그대로 체크
      const pre = await view(page);
      assert.deepEqual([pre.i1.state, pre.s1.state, pre.h1.state], ['new', 'exists', 'new'], '배정 전 이름 칸 ' + JSON.stringify([pre.i1, pre.s1, pre.h1].map(x => x.msg)));
      await page.evaluate(() => { window.__dirty = 0; const od = markDirty; window.__od = od; markDirty = (...a) => { window.__dirty++; return od(...a); }; });
      await applyBtn(page).click();
      await page.waitForFunction(() => !document.querySelector('#modalRoot .psr-row'));
      const res = await page.evaluate(() => { markDirty = window.__od; return { toast: document.getElementById('toast').textContent, dirty: window.__dirty, projects: state.projects.map(p => JSON.stringify(p)) }; });
      assert.deepEqual(await names(page), ['가온아파트', '나래빌라', '옛상가', '한울빌라', '달빛아파트'], '새 현장은 두 곳만(같은 이름 한 번 · 비슷한 이름·이미 있는 이름은 안 만듦) ' + JSON.stringify(await names(page)));
      const fresh = { stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } };
      assert.deepEqual(res.projects.slice(3).map(x => JSON.parse(x)), [Object.assign({ name: '한울빌라' }, fresh), Object.assign({ name: '달빛아파트' }, fresh)], '단계 0 · 유형(kind) 없음 · 고객 주소에 조회한 주소를 적지 않는다 ' + res.projects.slice(3).join(' '));
      assert.deepEqual(await proj(page), Object.assign({}, UN0, { k1: '한울빌라', k2: '한울빌라', k3: '한울빌라', d1: '달빛아파트', d2: '달빛아파트', h1: '달빛아파트', s1: '나래빌라', e1: '가온아파트', e2: '가온아파트', g1: '가온아파트', g2: '가온아파트' }),
        '그 줄 사진만 — 안 고른 줄(l1·j·m1·n1)과 비슷한 이름 줄(i1)은 그대로 ' + JSON.stringify(await proj(page)));
      assert.deepEqual((await snapLabels(page)).slice(snaps0.length), ['추측 배정 전'], '안전판 1회');
      assert.match(res.toast, /6묶음 11장을 배정했습니다 · 새 현장 2곳\(한울빌라, 달빛아파트\)을 만들었어요 · 새 현장을 못 만든 1묶음은 그대로\(비슷한 현장: 달빛아파트\)/, res.toast);
      assert.ok(res.dirty >= 1, '저장 표시');
      // 만든 현장은 배정된 사진의 위치(중앙값)로 다음 사진을 알아본다 — v571 '처음 가는 현장' 빈칸이 메워진다
      const next = await page.evaluate(() => {
        const k1 = state.files.find(f => f.id === 'k1');
        const f = { id: 'k9', name: 'k9.jpg', ext: 'jpg', kind: 'photo', project: '', when: new Date('2026-11-14T10:00:00+09:00'), lat: k1.lat + 0.0001, lng: k1.lng, size: 999, thumb: k1.thumb };
        state.files.push(f); if (typeof __photoCache !== 'undefined') __photoCache.key = null;
        const j = hjPlaceJudge(f, hjPlaceSchedNames('2026-11-14'), hjPlaceRefs());
        const row = hjPhotoSuggestReviewData().find(r => r.open.some(p => p.id === 'k9'));
        state.files.pop(); if (typeof __photoCache !== 'undefined') __photoCache.key = null;
        return { ref: (hjPlaceRefs().find(r => r.name === '한울빌라') || {}).src, k: j.k, site: j.site, why: row && row.sg ? row.sg.why : null, to: row && row.sg ? row.sg.name : '', sure: row && row.sure };
      });
      assert.deepEqual(next, { ref: 'photos', k: 'gps', site: '한울빌라', why: 'gps', to: '한울빌라', sure: true }, '다음 사진은 위치로 ' + JSON.stringify(next));
      // 안전판으로 되돌리면 새 현장도 사진 배정도 없던 일
      const undo = await page.evaluate(async () => { const s = ((await idbGet('hj_snaps')) || []).filter(x => x.label === '추측 배정 전').pop(); return hjRestoreSnapshot(s); });
      assert.equal(undo, true);
      assert.deepEqual([await names(page), Object.values(await proj(page)).filter(Boolean).length], [['가온아파트', '나래빌라', '옛상가'], 0], '되돌리기 ' + JSON.stringify(await names(page)));
    });

    await test('⑤ 🧹 창 — 처음 간 두 곳은 두 줄 · 그 줄에만 ＋ 새 현장 · 적용은 그 줄 사진만·안전판 1회 · 자동 실행·AI 도구는 현장을 만들지 않음 (ORG)', async () => {
      await page.evaluate(SEED_ORG, PX);
      const before = await snap(page);
      const plan = await page.evaluate(() => hjPhotoOrgPlan().groups.map(g => [g.day, g.k, g.ok, g.ids.join(','), !!g.ll]));
      assert.deepEqual(plan, [['2026-11-12', 'none', false, 'u1,u2', true], ['2026-11-12', 'none', false, 'u3,u4', true], ['2026-11-12', 'none', false, 'u5', false], ['2026-11-11', 'agree', true, 'a1', true]], '자리별 묶음 ' + JSON.stringify(plan));
      const tool = await page.evaluate(async () => JSON.stringify(await aiToolRun('suggest_photo_organization', {})));
      assert.ok(!/한울빌라|새벽로|돌다리로/.test(tool) && JSON.parse(tool).제안.filter(x => x.실행힌트).length === 1, 'AI 도구 결과에 주소·새 현장 이름 없음 · 실행힌트는 일치 묶음만 ' + tool.slice(0, 300));
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
      await page.waitForSelector('#modalRoot .hjorg-row');
      let rows = await orgRows(page);
      assert.deepEqual(rows.map(r => [r.k, r.ids, r.checked, r.sel, r.news, r.box]), [
        ['agree', 'a1', true, '가온아파트', [], null],
        ['none', 'u1,u2', false, '', ['__new__:한울빌라 | ＋ 새 현장: 한울빌라'], false],
        ['none', 'u3,u4', false, '', ['__new__:돌다리로 19번길 9 | ＋ 새 현장: 돌다리로 19번길 9'], false],
        ['none', 'u5', false, '', [], null],
      ], '🧹 줄 ' + JSON.stringify(rows));
      assert.match(rows[1].where, /📍 한울빌라 · ＋ 새 현장 제안: 한울빌라/, rows[1].where);
      assert.equal(await snap(page), before, '창을 열기만 해서는 저장본 불변');
      const snaps0 = await snapLabels(page);
      await page.locator('#modalRoot .hjorg-row >> nth=1 >> .orgSel').selectOption('__new__:한울빌라');
      rows = await orgRows(page);
      assert.deepEqual([rows[1].checked, rows[1].box, rows[1].name], [true, true, '한울빌라'], '고르면 체크·이름 칸 ' + JSON.stringify(rows[1]));
      await page.locator('#modalRoot .mfoot button', { hasText: '선택 적용' }).click();
      await page.waitForFunction(() => /정리 완료/.test((document.querySelector('#modalRoot .mbody') || {}).textContent || ''));
      const sum = await page.evaluate(() => document.querySelector('#modalRoot .mbody').textContent);
      assert.deepEqual(await names(page), ['가온아파트', '한울빌라']);
      assert.deepEqual(await proj(page), { a1: '가온아파트', u1: '한울빌라', u3: '', u2: '한울빌라', u4: '', u5: '' }, '그 줄 사진만 — 같은 날 다른 자리(u3·u4)·위치 없는 사진(u5)은 그대로 ' + JSON.stringify(await proj(page)));
      assert.deepEqual((await snapLabels(page)).slice(snaps0.length), ['AI 자동 정리 전'], '안전판 1회');
      assert.ok(/현장 배정: 3장/.test(sum) && /새 현장: 1곳 \(한울빌라\)/.test(sum), '요약 ' + sum);
      await page.evaluate(() => closeModal(true));
      // 자동 실행(가져오기 뒤 자동·AI 비서)은 위치·일정이 일치한 묶음만 넣고 현장을 만들지 않는다
      await page.evaluate(SEED_ORG, PX);
      const auto = await page.evaluate(async () => aiAutoOrganize({ auto: true, from: 'agent' }));
      assert.ok(auto.배정 === 1 && auto.확인필요 === 5 && auto.확인필요묶음 === 3, '자동 실행 결과 ' + JSON.stringify(auto));
      assert.deepEqual([await names(page), await proj(page)], [['가온아파트'], { a1: '가온아파트', u1: '', u3: '', u2: '', u4: '', u5: '' }], '자동 실행은 현장을 만들지 않는다');
    });
    await context.close();

    await test('⑥ 폰 390 — 두 창 모두 이름 칸이 열려도 넘침 없음 · 이름 칸 44px·16px · 핀 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      ({ context, page } = await open(390));
      const measure = (rowSel, selSel) => page.evaluate(([rowSel, selSel]) => {
        const root = document.getElementById('modalRoot'), m = root.querySelector('.modal');
        const vis = [...root.querySelectorAll('.hjPnName')].filter(x => x.getClientRects().length).map(x => ({ h: Math.round(x.getBoundingClientRect().height), font: parseFloat(getComputedStyle(x).fontSize), right: Math.round(x.getBoundingClientRect().right) }));
        return { over: document.documentElement.scrollWidth - innerWidth, modalOver: m.scrollWidth - m.clientWidth, rowOver: [...root.querySelectorAll(rowSel + ',' + selSel + ',.hjPnBox,.hjPnMsg')].filter(x => x.getClientRects().length && x.getBoundingClientRect().right > innerWidth + 0.5).length,
          sel: Math.min(...[...root.querySelectorAll(selSel)].map(x => Math.round(x.getBoundingClientRect().height))), vis, msgs: [...root.querySelectorAll('.hjPnMsg')].filter(x => x.getClientRects().length).map(x => x.textContent) };
      }, [rowSel, selSel]);
      await page.evaluate(SEED, PX);
      await openPsr(page);
      const v = await view(page);
      await pick(page, v, 'd1,d2', '__new__:달빛아파트', '가온 아파트');
      await pick(page, v, 'h1', '__new__:');
      await pick(page, v, 'k1,k2,k3', '__new__:한울빌라');
      let r = await measure('.psr-row', '.psrSel');
      assert.ok(r.over <= 1 && r.modalOver <= 1 && r.rowOver === 0, 'PHONE 🧭 넘침 없음 ' + JSON.stringify(r));
      assert.ok(r.vis.length === 3 && r.vis.every(x => x.h >= 44 && x.font >= 16) && r.sel >= 44 && r.msgs.length === 3 && r.msgs.every(Boolean), 'PHONE 🧭 이름 칸 44px·16px · 까닭 글 보임 ' + JSON.stringify(r));
      await page.evaluate(() => closeModal(true));
      await page.evaluate(SEED_ORG, PX);
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
      await page.waitForSelector('#modalRoot .hjorg-row');
      await page.locator('#modalRoot .hjorg-row >> nth=1 >> .orgSel').selectOption('__new__:한울빌라');
      await page.locator('#modalRoot .hjorg-row >> nth=2 >> .orgSel').selectOption('__new__:돌다리로 19번길 9');
      r = await measure('.hjorg-row', '.orgSel');
      assert.ok(r.over <= 1 && r.modalOver <= 1 && r.rowOver === 0, 'PHONE 🧹 넘침 없음 ' + JSON.stringify(r));
      assert.ok(r.vis.length === 2 && r.vis.every(x => x.h >= 44 && x.font >= 16) && r.sel >= 44, 'PHONE 🧹 이름 칸 44px·16px ' + JSON.stringify(r));
      await page.evaluate(() => closeModal(true));
      await context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally { await browser.close(); }
  console.log('photonewsite-v603: ' + passed + '/6');
  if (passed !== 6) process.exit(1);
})().catch(e => { console.error('FAIL photonewsite-v603', e && e.stack || e); process.exit(1); });
