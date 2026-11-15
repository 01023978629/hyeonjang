/* v599 새 현장 이름 제안 — 캘린더 일정·카톡 보고·사진 주소에서 '앱에 아직 없는 현장'의 이름을 뽑는 한 곳(hjNewSiteName·hjNewSiteCheck).
   대표가 두 번 맡긴 일(캘린더·톡방·사진을 보고 현장을 만들어 정리)에서 앱은 이미 있는 현장만 고를 수 있었다. 여러 창(🔄 맞추기·💬 카톡 보고·🧭 추측 배정)이
   같은 규칙으로 '＋ 새 현장'을 내도록 이름 뽑기와 '만들어도 되는가'를 한 곳에 둔다. 합성 이름만, 바깥 쓰기 0.
   ① 이름 — 단지·건물 낱말로 끝나는 토막만(동·호수·도시·조사 뗌, N단지 붙임, 낱말만 있으면 앞 토막과 이음) · 없으면 주소 꼴(도로명+번호·동+번지) ·
      자유 글은 행정구역이 앞에 있거나 번지에 '-' 가 있을 때만 · 작업 글·사람 이름·'단지내'·'욕실로 2번'·'출동 3건'은 '' (NAME)
   ② 만들어도 되는가 — 같은 이름·비슷한 이름·보관 현장과 같은 이름이면 ok=false + 그 현장 이름 · 선택지 글은 글자로(꺾쇠) · 고른 값 읽기 (CHECK)
   ③ 읽기만 — 자료 한 글자도 안 바뀜 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (READONLY)
   HJ_V599_BASELINE=<commit> 와 HJ_V599_MUTATION=whole-line(문장을 통째로)·no-josa(조사를 안 뗌)·mid-word(낱말이 토막 가운데여도 이름)·
   road-as-complex(길 이름을 단지로)·free-road(자유 글의 도로명을 그냥 주소로)는 ①, no-similar(비슷한 현장을 안 봄)·no-archived(보관 현장을 안 봄)는 ② 에서 실패해야 한다. */
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
  'whole-line': ['    if(t.length>=3)return t.slice(0,40);\n', "    if(t.length>=3)return toks.join(' ').slice(0,40);\n"],
  'no-josa': ['    if(cut!==t&&cut&&hjNewSiteWordEnd(cut)===cut.length)t=cut;\n', ''],
  'mid-word': ['    if(hjNewSiteWordEnd(t)!==t.length)continue;\n', ''],
  'road-as-complex': ['    if(HJ_NEWSITE_ROAD_RE.test(t)&&toks[i+1]&&(HJ_NEWSITE_NUM_RE.test(toks[i+1])||HJ_NEWSITE_ROADN_RE.test(toks[i+1])))continue;\n', ''],
  'free-road': ["      if(m&&(!free||areaBefore))return road+' '+m[1];", "      if(m)return road+' '+m[1];"],
  'no-similar': ["  hjSimilarProjects(n).forEach(x=>{if(!sim.includes(x))sim.push(x);});\n  hjStmtMatch(n).forEach(c=>{if(c.score>=0.6&&!sim.includes(c.name))sim.push(c.name);});\n", ''],
  'no-archived': ['  all.forEach(p=>{if(p.archived&&key&&hjNormName(p.name)===key)sim.push(p.name);});\n', '']
};
let html = process.env.HJ_V599_BASELINE ? execFileSync('git', ['show', process.env.HJ_V599_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V599_MUTATION) {
  const m = MUT[process.env.HJ_V599_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V599_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS newsite-v599 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
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
    // 합성 현장: 사진 있는 두 곳 + 보관한 한 곳
    state.projects = [{ name: '가온아파트', stage: 2 }, { name: '보람마을 2단지', stage: 1 }, { name: '옛빌라', stage: 3, archived: true }];
    state.files = [{ id: 'f1', project: '가온아파트', kind: 'photo', name: 'a.jpg', size: 10 }, { id: 'f2', project: '보람마을 2단지', kind: 'photo', name: 'b.jpg', size: 11 }];
  }, BOOT);
  return { context, page };
}
// [글, 옵션, 기대 이름]
const NAMES = [
  ['모란아파트 303동 704호 욕실 누수 탐지 완료했습니다', null, '모란아파트'],
  ['다솜아파트에서 작업 중', null, '다솜아파트'],
  ['모란아파트로 이동', null, '모란아파트'],
  ['새벽동 모란아파트 303-704', null, '모란아파트'],
  ['모란아파트(303-704) 방수', null, '모란아파트'],
  ['한빛마을 3단지 301동 1203호 누수', null, '한빛마을 3단지'],
  ['한빛 아파트 1단지 누수', null, '한빛 아파트 1단지'],
  ['둔산 더샵 방문', null, '둔산 더샵'],
  ['더샵 방문', null, ''],
  ['[나래타워] 배관', null, '나래타워'],
  ['(주)가상 한빛프라자 2층', null, '한빛프라자'],
  ['중앙상가 누수', null, '중앙상가'],
  ['욕실 누수 탐지 완료', null, ''],
  ['김가상 고객님 댁 방수', null, ''],
  ['단지내 배관 점검', null, ''],
  ['@우수관 1개', null, ''],
  ['', null, ''],
  // 주소 칸(구글 위치·사진 주소) — 단지 이름이 먼저, 없으면 도로명+번호·동+번지
  ['시험시 새벽로 12 모란아파트 303동 704호', { addr: true }, '모란아파트'],
  ['시험시 달빛동 55-3', { addr: true }, '달빛동 55-3'],
  ['시험시 중구 돌다리로 19번길 9', { addr: true }, '돌다리로 19번길 9'],
  ['선비마을로 12', { addr: true }, '선비마을로 12'],
  // 자유 글 — 행정구역이 앞에 있거나 번지에 '-' 가 있을 때만 주소로 읽는다
  ['중구 새벽로 12 누수', null, '새벽로 12'],
  ['시험시 달빛동 55-3 누수 확인', null, '달빛동 55-3'],
  ['새벽로 12 누수', null, ''],
  ['달빛동 12 누수', null, ''],
  ['욕실로 2번 옮김', null, ''],
  ['바닥으로 3장', null, ''],
  ['출동 3건 완료', null, '']
];
(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    await test('① 이름 — 단지·건물 낱말 토막 · 주소 꼴 · 자유 글은 조심 · 작업 글은 빈 값 (NAME)', async () => {
      const got = await page.evaluate(rows => rows.map(r => hjNewSiteName(r[0], r[1] || undefined)), NAMES);
      NAMES.forEach((r, i) => assert.equal(got[i], r[2], '‘' + r[0] + '’' + (r[1] ? ' (주소 칸)' : '') + ' → ' + JSON.stringify(got[i])));
    });

    await test('② 만들어도 되는가 — 같은·비슷한·보관 현장이면 그 현장을 알려 줌 · 선택지 글 · 고른 값 (CHECK)', async () => {
      const r = await page.evaluate(() => ({
        same: hjNewSiteCheck('가온아파트'), gap: hjNewSiteCheck('가온 아파트'), part: hjNewSiteCheck('보람마을'), arch: hjNewSiteCheck('옛 빌라'), archSame: hjNewSiteCheck('옛빌라'),
        fresh: hjNewSiteCheck('모란아파트'), addr: hjNewSiteCheck('달빛동 55-3'), short: hjNewSiteCheck('x'),
        opt: hjNewSiteOptionHtml('모란<b>아파트'), optSel: hjNewSiteOptionHtml('모란아파트', true), optNo: hjNewSiteOptionHtml('가온 아파트'),
        choice: [hjNewSiteChoice('__new__: 모란아파트 '), hjNewSiteChoice('가온아파트'), hjNewSiteChoice('')]
      }));
      assert.deepEqual([r.same.ok, r.same.why, r.same.similar], [false, 'exists', ['가온아파트']], '같은 이름 ' + JSON.stringify(r.same));
      assert.deepEqual([r.gap.ok, r.gap.why, r.gap.similar], [false, 'similar', ['가온아파트']], '띄어쓰기만 다른 이름 ' + JSON.stringify(r.gap));
      assert.deepEqual([r.part.ok, r.part.why, r.part.similar], [false, 'similar', ['보람마을 2단지']], '단지 이름이 겹침 ' + JSON.stringify(r.part));
      assert.deepEqual([r.arch.ok, r.arch.why, r.arch.similar], [false, 'similar', ['옛빌라']], '보관 현장과 같은 이름 ' + JSON.stringify(r.arch));
      assert.deepEqual([r.archSame.ok, r.archSame.why], [false, 'exists'], '보관 현장 이름 그대로 ' + JSON.stringify(r.archSame));
      assert.deepEqual(r.fresh, { name: '모란아파트', ok: true, why: '', similar: [] }, '새 이름 ' + JSON.stringify(r.fresh));
      assert.equal(r.addr.ok, true, '주소 이름 ' + JSON.stringify(r.addr));
      assert.deepEqual([r.short.ok, r.short.why], [false, 'short'], '한 글자 ' + JSON.stringify(r.short));
      assert.equal(r.opt, '<option value="__new__:모란&lt;b&gt;아파트">＋ 새 현장: 모란&lt;b&gt;아파트</option>', '선택지는 글자로 ' + r.opt);
      assert.ok(/ selected>/.test(r.optSel), '고른 채로 ' + r.optSel);
      assert.equal(r.optNo, '', '비슷한 현장이 있으면 선택지 없음');
      assert.deepEqual(r.choice, ['모란아파트', '', ''], '고른 값 ' + JSON.stringify(r.choice));
    });

    await test('③ 읽기만 — 자료 불변 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (READONLY)', async () => {
      const same = await page.evaluate(rows => {
        const before = JSON.stringify(serializeData());
        rows.forEach(r => { hjNewSiteName(r[0], r[1] || undefined); hjNewSiteCheck(hjNewSiteName(r[0], r[1] || undefined)); hjNewSiteOptionHtml(r[0]); });
        return before === JSON.stringify(serializeData()) && state.projects.length === 3;
      }, NAMES);
      assert.equal(same, true, '이름 뽑기·확인은 자료를 바꾸지 않는다');
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
  console.log('newsite-v599: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error('FAIL newsite-v599', e && e.stack || e); process.exit(1); });
