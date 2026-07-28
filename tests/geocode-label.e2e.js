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
    // 「주소 조회」와 「모든 위치 확인」이 각자 주소를 조립하면 버튼에 따라 표기가 달라진다.
    // 둘 다 hjLookupPlace 한 곳만 거쳐야 한다(카카오·OSM 선택도 그 안에서 끝난다).
    const r = await page.evaluate(() => ({
      one: String(geocodeCluster), all: String(geocodeAllClusters)
    }));
    assert(/hjLookupPlace/.test(r.one), '한 묶음 조회가 공용 함수를 안 씀');
    assert(/hjLookupPlace/.test(r.all), '전체 조회가 공용 함수를 안 씀');
    assert(!/hjGeoUrl|hjPlaceLabel|hjKakaoLabel/.test(r.one + r.all),
      '조회 함수 안에서 직접 주소를 조립한다 — 두 경로가 갈라질 자리를 남기면 안 됨');
  });

  /* ===== 카카오 로컬(선택) ===== */
  // 실제 카카오 coord2Address 가 돌려주는 모양
  const 카카오_아파트 = {
    road_address: { address_name: '대전 중구 돌다리로19번길 9', building_name: '햇살아파트' },
    address: { address_name: '대전 중구 석교동 123-4' }
  };
  const 카카오_단독 = {
    road_address: { address_name: '대전 중구 계룡로 12', building_name: '' },
    address: { address_name: '대전 중구 태평동 45-6' }
  };
  const 카카오_지번만 = { road_address: null, address: { address_name: '충남 금산군 남이면 산 12-3' } };

  await test('⑨ 카카오: 건물명이 있으면 도로명 뒤에 붙는다', async () => {
    const s = await page.evaluate((x) => hjKakaoLabel(x), 카카오_아파트);
    assert(s === '대전 중구 돌다리로19번길 9 · 햇살아파트', '어긋남: ' + s);
  });

  await test('⑩ 카카오: 건물명이 없으면 지번을 괄호로 덧붙인다', async () => {
    // 단독주택·신축은 건물명이 비어 있고, 그때는 지번이 현장을 특정하는 유일한 단서다
    const s = await page.evaluate((x) => hjKakaoLabel(x), 카카오_단독);
    assert(s === '대전 중구 계룡로 12 (태평동 45-6)', '어긋남: ' + s);
  });

  await test('⑩-2 카카오: 도로명이 없으면 지번만으로 적는다', async () => {
    const s = await page.evaluate((x) => hjKakaoLabel(x), 카카오_지번만);
    assert(s === '충남 금산군 남이면 산 12-3', '어긋남: ' + s);
    const e = await page.evaluate(() => hjKakaoLabel(null));
    assert(e === '', 'null 이면 빈 문자열: ' + JSON.stringify(e));
  });

  await test('⑪ 키가 없으면 OpenStreetMap 으로 조회한다', async () => {
    const r = await page.evaluate(async () => {
      window.__kakaoKey = null;
      let hit = null;
      const realFetch = window.fetch;
      window.fetch = (u) => { hit = String(u); return Promise.resolve({ json: () => Promise.resolve({
        address: { city: '대전광역시', city_district: '중구', suburb: '유천동', road: '유천로', house_number: '3' } }) }); };
      const got = await hjLookupPlace(36.31, 127.42);
      window.fetch = realFetch;
      return { got, hit };
    });
    assert(r.got.src === 'osm', 'osm 으로 표시돼야 함: ' + r.got.src);
    assert(/nominatim/.test(r.hit), 'OSM 을 부르지 않았음: ' + r.hit);
    assert(r.got.addr === '대전광역시 중구 유천동 유천로 3', '주소가 어긋남: ' + r.got.addr);
  });

  await test('⑫ 키가 있으면 카카오로 조회한다 (OSM 은 부르지 않는다)', async () => {
    const r = await page.evaluate(async () => {
      window.__kakaoKey = 'TEST_JS_KEY';
      // SDK 가 이미 붙어 있는 상태를 흉내낸다 — 실제 스크립트를 받지 않는다
      window.kakao = { maps: { services: {
        Status: { OK: 'OK' },
        Geocoder: function () {
          this.coord2Address = function (lng, lat, cb) {
            cb([{ road_address: { address_name: '대전 중구 돌다리로19번길 9', building_name: '햇살아파트' },
                  address: { address_name: '대전 중구 석교동 123-4' } }], 'OK');
          };
        }
      } } };
      let osmCalled = false;
      const realFetch = window.fetch;
      window.fetch = (u) => { osmCalled = true; return Promise.resolve({ json: () => Promise.resolve({}) }); };
      const got = await hjLookupPlace(36.31, 127.42);
      window.fetch = realFetch; window.__kakaoKey = null; delete window.kakao;
      return { got, osmCalled };
    });
    assert(r.got.src === 'kakao', 'kakao 로 표시돼야 함: ' + r.got.src);
    assert(r.got.addr === '대전 중구 돌다리로19번길 9 · 햇살아파트', '주소가 어긋남: ' + r.got.addr);
    assert(!r.osmCalled, '카카오로 됐는데 OSM 도 불렀음(할당량 낭비)');
  });

  await test('⑬ 카카오가 실패하면 조용히 OpenStreetMap 으로 되돌아간다', async () => {
    // 키를 잘못 넣었거나 도메인 등록을 안 했을 때 위치 조회 자체가 죽으면 안 된다
    const r = await page.evaluate(async () => {
      window.__kakaoKey = 'BAD_KEY';
      window.__kakaoSdk = Promise.reject(new Error('KAKAO_SDK_LOAD'));
      window.__kakaoSdk.catch(() => {});
      let osmCalled = false;
      const realFetch = window.fetch;
      window.fetch = () => { osmCalled = true; return Promise.resolve({ json: () => Promise.resolve({
        address: { city: '대전광역시', suburb: '석교동', road: '돌다리로19번길' } }) }); };
      let threw = false, got = null;
      try { got = await hjLookupPlace(36.31, 127.42); } catch (e) { threw = true; }
      window.fetch = realFetch; window.__kakaoKey = null; window.__kakaoSdk = null;
      return { got, osmCalled, threw };
    });
    assert(!r.threw, '카카오 실패가 통째로 터지면 안 됨');
    assert(r.osmCalled, 'OSM 으로 되돌아가지 않았음');
    assert(r.got && r.got.src === 'osm', 'osm 으로 표시돼야 함: ' + JSON.stringify(r.got));
    assert(r.got.addr === '대전광역시 석교동 돌다리로19번길', '되돌아간 주소가 어긋남: ' + r.got.addr);
  });

  await test('⑭ 키는 저장 데이터에 섞이지 않는다 (백업 파일로 새면 안 됨)', async () => {
    const r = await page.evaluate(() => {
      window.__kakaoKey = 'SECRET_JS_KEY';
      const dump = JSON.stringify(serializeData());
      window.__kakaoKey = null;
      return { leaked: dump.indexOf('SECRET_JS_KEY') >= 0, keys: Object.keys(JSON.parse(dump)).length };
    });
    assert(!r.leaked, '카카오 키가 serializeData 에 들어갔다 — 백업·동기화로 새어나간다');
    assert(r.keys > 0, '직렬화가 비어 있음');
  });

  await test('⑮ 설정 화면에 카카오 키 칸과 저장 버튼이 있다', async () => {
    const r = await page.evaluate(() => {
      const s = String(openGdriveSetup);
      return { input: /id="gdKakao"/.test(s), save: /id="gdKakaoSave"/.test(s),
        js: /JavaScript 키/.test(s), domain: /01023978629\.github\.io/.test(s) };
    });
    assert(r.input && r.save, '입력칸 또는 저장 버튼이 없음: ' + JSON.stringify(r));
    assert(r.js, 'REST 키와 헷갈리지 않게 "JavaScript 키" 라고 적어야 함');
    assert(r.domain, '등록할 도메인을 알려주지 않으면 키를 넣어도 동작하지 않는다');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
