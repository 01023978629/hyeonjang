/* geocode-label.e2e.js — 현장 사진 위치 표기 회귀 (Playwright)
   사진의 GPS 를 주소로 바꿔 보여주는 부분. 사장님이 몇 달 뒤 사진을 다시 볼 때
   "이게 어느 현장이었지"를 이걸로 판단한다.

   지키는 것:
   ① 도로명에서 끝나지 않는다 — 건물번호까지 나온다(같은 길에 현장이 둘이면 구분이 안 됨)
   ② 건물·아파트 이름이 있으면 붙는다 — 현장을 부르는 실제 이름
   ③ 옛 응답(건물번호·이름 없음)도 그대로 동작한다 — 이미 저장된 사진이 깨지면 안 됨
   ④ 같은 값이 두 칸에 걸쳐 와도 두 번 적지 않는다
   ⑤ 주소를 못 만들면 display_name 으로라도 뭔가 보여준다(빈칸 금지)
   ⑥ 한 줄 요약의 짧은 위치가 '· 이름' 처럼 깨지지 않는다
   ⑦ 조회 URL 에 건물 단위 조회 옵션이 실제로 들어간다
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 네트워크 없음(순수 함수만 검사). */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

// 실제 Nominatim 이 한국 주소에 대해 돌려주는 모양
const 아파트 = {
  display_name: '햇살아파트, 9, 돌다리로19번길, 석교동, 중구, 대전광역시, 대한민국',
  namedetails: { name: '햇살아파트', 'name:ko': '햇살아파트' },
  address: { city: '대전광역시', city_district: '중구', suburb: '석교동',
    road: '돌다리로19번길', house_number: '9', apartments: '햇살아파트' }
};
const 이름없는건물 = {
  display_name: '12, 계룡로, 태평동, 중구, 대전광역시, 대한민국',
  address: { city: '대전광역시', borough: '중구', neighbourhood: '태평동', road: '계룡로', house_number: '12' }
};
const 옛응답 = {   // zoom/namedetails 없이 받던 시절의 모양
  display_name: '유천동, 중구, 대전광역시, 대한민국',
  address: { city: '대전광역시', city_district: '중구', suburb: '유천동', road: '유천로' }
};
const 겹치는이름 = {
  display_name: '세종특별자치시',
  address: { city: '세종특별자치시', city_district: '세종특별자치시', suburb: '조치원읍', road: '으뜸길' }
};
const 주소없음 = { display_name: '어딘가 바다 한가운데', address: {} };

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const label = (j) => page.evaluate((x) => hjPlaceLabel(x), j);

  await test('① 건물번호까지 나온다 (도로명에서 끝나지 않음)', async () => {
    const s = await label(이름없는건물);
    assert(/계룡로 12/.test(s), '"계룡로 12" 가 있어야 함: ' + s);
    assert(s === '대전광역시 중구 태평동 계룡로 12', '전체가 어긋남: ' + s);
  });

  await test('② 아파트 이름이 붙는다', async () => {
    const s = await label(아파트);
    assert(s.indexOf('햇살아파트') >= 0, '건물 이름이 빠짐: ' + s);
    assert(s.indexOf('돌다리로19번길 9') >= 0, '도로명+건물번호가 빠짐: ' + s);
    assert(s === '대전광역시 중구 석교동 돌다리로19번길 9 · 햇살아파트', '전체가 어긋남: ' + s);
  });

  await test('②-2 이름을 두 번 적지 않는다', async () => {
    // apartments 와 namedetails.name 이 같은 값이므로 한 번만 나와야 한다
    const s = await label(아파트);
    assert(s.split('햇살아파트').length - 1 === 1, '이름이 두 번 나옴: ' + s);
  });

  await test('③ 옛 응답도 그대로 동작한다 (이미 저장된 사진 보호)', async () => {
    const s = await label(옛응답);
    assert(s === '대전광역시 중구 유천동 유천로', '옛 형식이 깨짐: ' + s);
  });

  await test('④ 같은 값이 두 칸에 와도 한 번만 적는다', async () => {
    const s = await label(겹치는이름);
    assert(s.split('세종특별자치시').length - 1 === 1, '중복해서 적음: ' + s);
    assert(s === '세종특별자치시 조치원읍 으뜸길', '전체가 어긋남: ' + s);
  });

  await test('⑤ 주소를 못 만들면 display_name 이라도 보여준다', async () => {
    const s = await label(주소없음);
    assert(s === '어딘가 바다 한가운데', '빈칸이 되면 안 됨: ' + JSON.stringify(s));
    const s2 = await page.evaluate(() => hjPlaceLabel(null));
    assert(s2 === '', 'null 이면 빈 문자열: ' + JSON.stringify(s2));
  });

  await test('⑥ 한 줄 요약의 짧은 위치가 깨지지 않는다', async () => {
    const r = await page.evaluate((args) => ({
      apt: hjPlaceShort(args.a),
      plain: hjPlaceShort(args.b),
      empty: hjPlaceShort('')
    }), { a: '대전광역시 중구 석교동 돌다리로19번길 9 · 햇살아파트', b: '대전광역시 중구 유천동 유천로' });
    assert(r.apt === '햇살아파트', '건물 이름이 있으면 그것만: ' + r.apt);
    assert(r.apt.indexOf('·') < 0, '가운뎃점이 남으면 안 됨: ' + r.apt);
    assert(r.plain === '유천동 유천로', '이름이 없으면 뒤 두 마디: ' + r.plain);
    assert(r.empty === '', '빈 값은 빈 값');
  });

  await test('⑦ 조회 URL 에 건물 단위 옵션이 들어간다', async () => {
    const u = await page.evaluate(() => hjGeoUrl(36.31, 127.42));
    assert(/zoom=18/.test(u), 'zoom=18 이 없으면 동네 단위로만 나온다: ' + u);
    assert(/namedetails=1/.test(u), 'namedetails 가 없으면 건물 이름을 못 받는다: ' + u);
    assert(/accept-language=ko/.test(u), '한국어 지정 누락: ' + u);
    assert(/lat=36\.31&lon=127\.42/.test(u), '좌표가 어긋남: ' + u);
  });

  await test('⑧ 두 조회 경로가 같은 함수를 쓴다 (표기가 갈라지지 않게)', async () => {
    const r = await page.evaluate(() => ({
      one: String(geocodeCluster), all: String(geocodeAllClusters)
    }));
    assert(/hjPlaceLabel/.test(r.one) && /hjGeoUrl/.test(r.one), '한 묶음 조회가 공용 함수를 안 씀');
    assert(/hjPlaceLabel/.test(r.all) && /hjGeoUrl/.test(r.all), '전체 조회가 공용 함수를 안 씀');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
