/* v599 새 현장 이름 제안 — 캘린더 일정·카톡 보고·사진 주소에서 '앱에 아직 없는 현장'의 이름을 뽑는 한 곳(hjNewSiteName·hjNewSiteCheck).
   대표가 두 번 맡긴 일(캘린더·톡방·사진을 보고 현장을 만들어 정리)에서 앱은 이미 있는 현장만 고를 수 있었다. 여러 창(🔄 맞추기·💬 카톡 보고·🧭 추측 배정)이
   같은 규칙으로 '＋ 새 현장'을 내도록 이름 뽑기와 '만들어도 되는가'를 한 곳에 둔다. 합성 이름만, 바깥 쓰기 0.
   ① 이름 — 단지·건물 낱말로 끝나는 토막만(동·호수·도시·조사 뗌, N단지 붙임, 낱말만 있으면 앞 토막과 이음) · 없으면 주소 꼴(도로명+번호·동+번지) ·
      자유 글은 행정구역이 앞에 있거나 번지에 '-' 가 있을 때만 · 작업 글·사람 이름·'단지내'·'욕실로 2번'·'출동 3건'은 '' (NAME)
   ② 만들어도 되는가 — 같은 이름·비슷한 이름·보관 현장과 같은 이름이면 ok=false + 그 현장 이름 · 선택지 글은 글자로(꺾쇠) · 고른 값 읽기 ·
      어디에 넣는가(hjNewSiteTarget: 새로·진행 현장에 잇기·보관/비슷함/짧음은 막음) (CHECK)
   ③ 읽기만 — 자료 한 글자도 안 바뀜 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (READONLY)
   ④ 통합 검토(11/15) 주소 이름 현장('달빛동 55-3'·'새벽로 12') — 같은 주소일 때만 같은 곳(같은 동·같은 길의 다른 글·번지는 후보도, 비슷한 현장도 아님) ·
      주소가 다른 단지 현장은 다른 곳 (ADDR)
   통합 검토 변이: prev-any(사람 이름·전화 끝자리·때 말과 잇기)·sub-alone('N단지' 홀로)·lot-any('추가·수리·단가'+숫자를 주소로)·bad-chars(꺾쇠·따옴표 토막)는 ①,
   addr-blind(주소 이름을 글자 비슷함으로)·addr-neighbor(다른 번지를 비슷한 현장으로)는 ④ 에서 실패해야 한다.
   HJ_V599_BASELINE=<commit> 와 HJ_V599_MUTATION=whole-line(문장을 통째로)·no-josa(조사를 안 뗌)·mid-word(낱말이 토막 가운데여도 이름)·
   road-as-complex(길 이름을 단지로)·free-road(자유 글의 도로명을 그냥 주소로)는 ①, no-similar(비슷한 현장을 안 봄)·no-archived(보관 현장을 안 봄)·link-archived(보관한 같은 이름에 그대로 이음)는 ② 에서 실패해야 한다. */
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
  'mid-word': ['    if(hjNewSiteWordEnd(t)!==t.length||HJ_NEWSITE_GENERIC.includes(t.toLowerCase()))continue;\n', '    if(HJ_NEWSITE_GENERIC.includes(t.toLowerCase()))continue;\n'],
  'road-as-complex': ['    if(HJ_NEWSITE_ROAD_RE.test(t)&&toks[i+1]&&(HJ_NEWSITE_NUM_RE.test(toks[i+1])||HJ_NEWSITE_ROADN_RE.test(toks[i+1])))continue;\n', ''],
  'free-road': ["if(m&&!HJ_NEWSITE_UNITNUM_RE.test(m[1])&&(!free||areaBefore))return {text:road", "if(m&&!HJ_NEWSITE_UNITNUM_RE.test(m[1]))return {text:road"],
  'no-similar': ["  hjSimilarProjects(n).forEach(x=>{if(!sim.includes(x)&&!otherAddr(x))sim.push(x);});\n  hjStmtMatch(n).forEach(c=>{if(c.score>=0.6&&!sim.includes(c.name))sim.push(c.name);});\n", ''],
  'link-archived': ["(state.projects||[]).some(p=>p&&p.name===c.name&&!p.archived))return {to:c.name,fresh:false,why:'exists',similar:[]};", "(state.projects||[]).some(p=>p&&p.name===c.name))return {to:c.name,fresh:false,why:'exists',similar:[]};"],
  'no-archived': ['  all.forEach(p=>{if(p.archived&&key&&hjNormName(p.name)===key)sim.push(p.name);});\n', ''],
  'prev-any': ['  if(p.length<2||HJ_NEWSITE_DIGIT_RE.test(p)||HJ_NEWSITE_HONOR_RE.test(p)||HJ_NEWSITE_AREA_RE.test(p)||HJ_NEWSITE_BAD_RE.test(p))return false;\n  return !HJ_NEWSITE_PREV_STOP.includes(p);\n', '  return p.length>=2;\n'],
  'sub-alone': ["    }else if(HJ_NEWSITE_SUB_RE.test(t)){const prev=toks[i-1]||'';if(!hjNewSitePrevOk(prev))continue;t=prev+' '+t;}\n", '    }\n'],
  'lot-any': ['function hjNewSiteLotOk(t,prev){\n', 'function hjNewSiteLotOk(t,prev){\n  return true;\n'],
  'bad-chars': ['    if(hjNewSiteWordEnd(t)<0||HJ_NEWSITE_BAD_RE.test(t))continue;\n', '    if(hjNewSiteWordEnd(t)<0)continue;\n'],
  'addr-blind': ['    if((pa&&pa.led)||(la&&la.led)){\n', '    if(false){\n'],
  'addr-neighbor': ['if(!sim.includes(x)&&!otherAddr(x))sim.push(x);', 'if(!sim.includes(x))sim.push(x);']
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
  ['출동 3건 완료', null, ''],
  // 통합 검토(11/15) — 사람 이름·전화 끝자리·때·가리킴 말은 단지 낱말과 잇지 않는다 · 붙여 쓴 흔한 말 · 'N단지' 홀로 · 브랜드가 앞 · 토막 앞뒤 기호
  ['고객 010-1234-5678 빌라 301호 누수', null, ''],
  ['김가상 고객님 아파트 화장실 방수', null, ''],
  ['박가상님 상가 2층 천장 누수', null, ''],
  ['어제 아파트 건은 내일 갑니다', null, ''],
  ['같은 단지 다른 동입니다', null, ''],
  ['주차타워 누수', null, ''],
  ['전단지 배포했습니다', null, ''],
  ['저희 2단지 누수', null, ''],
  ['주공 4단지 401동 누수', null, '주공 4단지'],
  ['e편한세상 둔산 2단지 203동', null, 'e편한세상 둔산 2단지'],
  ['힐스테이트 도안 3차 205동 1001호 욕실', null, '힐스테이트 도안 3차'],
  ['#모란아파트', null, '모란아파트'],
  ['작업 현장은 한빛빌라입니다.', null, '한빛빌라'],
  ['<img src=x onerror=alert(1)>타워', null, ''],
  ['x="한빛빌라" 보수', null, ''],
  // '가·리' 낱말 + 숫자는 진짜 동 이름 꼴(숫자 뒤 '가' · 읍·면 뒤 '리')만 주소 · 세 자리-세 자리는 동·호수
  ['평당 단가 30-40 정도입니다', null, ''],
  ['누수 수리 1-2 세대 완료', null, ''],
  ['서구 추가 3 건', null, ''],
  ['시험군 금남면 대평리 123', null, '대평리 123'],
  ['새벽동 303-704 누수', null, '']
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
        choice: [hjNewSiteChoice('__new__: 모란아파트 '), hjNewSiteChoice('가온아파트'), hjNewSiteChoice('')],
        // 적용 직전에 다시 보는 한 곳(v602·v603·v601 창이 같이 쓴다)
        target: [hjNewSiteTarget('모란아파트'), hjNewSiteTarget('가온아파트'), hjNewSiteTarget('옛빌라'), hjNewSiteTarget('가온 아파트'), hjNewSiteTarget('x')],
        simText: hjNewSiteSimText(['가온아파트', '옛빌라'])
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
      assert.deepEqual(r.target.map(x => [x.to, x.fresh, x.why]), [['모란아파트', true, ''], ['가온아파트', false, 'exists'], ['', false, 'archived'], ['', false, 'similar'], ['', false, 'short']], '어디에 넣는가 ' + JSON.stringify(r.target));
      assert.deepEqual(r.target[3].similar, ['가온아파트'], '막을 때는 비슷한 현장을 알려 준다');
      assert.equal(r.simText, '가온아파트 · 옛빌라(보관)', '안내 글 ' + r.simText);
    });

    await test('④ 주소 이름 현장 — 같은 주소일 때만 같은 곳 · 같은 동·같은 길의 다른 번지는 새로 만들 수 있음 (ADDR)', async () => {
      const r = await page.evaluate(() => {
        const keep = state.projects;
        state.projects = keep.concat([{ name: '달빛동 55-3', stage: 0 }, { name: '새벽로 12', stage: 0 }, { name: '시험구 은하로 15 은하빌라', stage: 1 }]);
        const m = t => hjStmtMatch(t).filter(c => c.score >= 0.34).map(c => c.name);
        const out = { other: m('달빛동 한솔빌라 201호 욕실 누수 탐지 완료했습니다'), same: m('시험시 달빛동 55-3 2층'), road123: m('새벽로 123 상가 2층'), road12: m('새벽로 12 다세대 201호'),
          complexOther: m('은하로 17 은하빌라'), complexSame: m('은하빌라 201호'),
          chk: ['달빛동 12-7', '새벽로 13', '새벽로 123', '새벽로 14 주택', '달빛동 12-7 박가상 다가구', '새벽로 12', '달빛동 55-3 주택'].map(n => { const c = hjNewSiteCheck(n); return [n, c.ok, c.why]; }) };
        state.projects = keep; return out;
      });
      assert.deepEqual(r.other, [], '같은 동의 다른 현장 글은 주소 이름 현장 후보가 아니다 ' + JSON.stringify(r.other));
      assert.deepEqual(r.same, ['달빛동 55-3'], '같은 주소면 그 현장 ' + JSON.stringify(r.same));
      assert.deepEqual(r.road123, [], '새벽로 123 은 새벽로 12 가 아니다 ' + JSON.stringify(r.road123));
      assert.deepEqual(r.road12, ['새벽로 12'], '같은 도로명+번호 ' + JSON.stringify(r.road12));
      assert.ok(!r.complexOther.includes('시험구 은하로 15 은하빌라') && r.complexSame.includes('시험구 은하로 15 은하빌라'), '주소가 다르면 다른 곳 · 주소 없는 글은 이름으로 ' + JSON.stringify([r.complexOther, r.complexSame]));
      assert.deepEqual(r.chk, [['달빛동 12-7', true, ''], ['새벽로 13', true, ''], ['새벽로 123', true, ''], ['새벽로 14 주택', true, ''], ['달빛동 12-7 박가상 다가구', true, ''], ['새벽로 12', false, 'exists'], ['달빛동 55-3 주택', false, 'similar']], '주소 이웃은 새로 만들 수 있음 · 같은 주소는 막음 ' + JSON.stringify(r.chk));
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
  console.log('newsite-v599: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL newsite-v599', e && e.stack || e); process.exit(1); });
