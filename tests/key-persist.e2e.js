/* key-persist.e2e.js — 저장한 키가 실수로 지워지지 않는지 못박는다

   사장님이 "왜 자꾸 AI 인증 키와 구글 드라이브 키를 지우는 거야" 라고 하셨다.
   코드를 보니 사장님 실수가 아니라 **화면이 지우고 있었다.**

   원인 두 가지
     ① 저장된 키를 입력칸에 그대로 되비추고, 저장할 때 그 칸의 값을 그대로 썼다.
        칸이 어떤 이유로든 비면(부팅 복원이 아직 안 끝남 · 비밀번호 관리자가
        password 칸을 비움 · 손이 스침) 저장을 누르는 순간 키가 지워졌다.
     ② 드라이브(릴레이) 키는 더 나빴다. saveRy() 가 [저장]뿐 아니라
        **[연결 테스트]·[불러오기]·[저장하기]** 에서도 불린다.
        즉 인증키 칸이 비어 있을 때 연결 테스트를 누르는 것만으로 키가 날아갔다.

   고친 뒤 규칙 — 빈 칸은 '안 바꿈'이다. 절대 '지움'이 아니다.
   지우려면 [지우기]를 눌러 확인까지 거쳐야 한다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String((e && e.message) || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }

// 화면이 쓰는 것과 같은 idb 창고를 직접 읽는다 — "화면에 보이는 것"이 아니라
// "실제로 저장된 것"을 봐야 한다.
const readIdb = (page, k) => page.evaluate((key) => idbGet(key), k);

/* browser 를 IIFE 밖에 둔다 — 안에 두면 예외가 났을 때 catch 가 닿지 못해
   브라우저가 살아남고, node 프로세스가 끝나지 않아 **그대로 멈춘다.**
   회귀 실행이 한 파일에서 멈추면 뒤 파일은 아예 돌지 않고 화면엔 아무 표시도 없다 —
   "전부 통과"라는 보고 자체가 성립하지 않게 된다. */
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('dialog', (d) => d.accept());        // [지우기] 확인창은 승낙
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const KEYS = [
    { input: 'gdGemini', save: 'gdGeminiSave', del: 'gdGeminiDel', idb: 'gemini_key', win: '__geminiKey', val: 'AIzaGEMINI-TEST-0001', label: 'Gemini' },
    { input: 'gdOpenai', save: 'gdOpenaiSave', del: 'gdOpenaiDel', idb: 'openai_key', win: '__openaiKey', val: 'sk-OPENAI-TEST-0002', label: 'OpenAI' },
    { input: 'gdKakao', save: 'gdKakaoSave', del: 'gdKakaoDel', idb: 'kakao_key', win: '__kakaoKey', val: 'KAKAOJSKEY-TEST-0003', label: '카카오' },
    { input: 'gdVision', save: 'gdVisionSave', del: 'gdVisionDel', idb: 'vision_key', win: '__visionKey', val: 'AIzaVISION-TEST-0004', label: 'Vision' }
  ];

  /* 설정 화면이 탭으로 나뉘어 있다(💾저장·백업 / 📨전자계약 / 🔑AI·지도 키 / ⭐기타).
     한 화면에 다 이어 붙이면 1,510px 이라 폰에서 두 화면 반을 굴려야 했다.
     탭은 <div> 라 <details> 겹을 늘리지 않는다 — ⑪ 의 '한 겹까지' 규칙은 그대로 유효하다.
     테스트는 해당 탭을 누른 뒤 details 를 펼친다. */
  const openPanel = async (tab) => {
    await page.evaluate(() => { try { closeModal(); } catch (e) {} });
    await page.evaluate(() => openGdriveSetup());
    await page.waitForSelector('#modalRoot .setTab', { state: 'visible', timeout: 5000 });
    await page.click('#setTab-' + (tab || 'keys'));
    const probe = (tab === 'save') ? '#ryTok' : '#gdOpenai';
    // 키 칸들은 각자 접힌 <details> 안에 있다. '붙을 때까지' 기다린 뒤 전부 펼친다.
    await page.waitForSelector(probe, { state: 'attached', timeout: 5000 });
    await page.evaluate(() => document.querySelectorAll('#modalRoot details').forEach((d) => { d.open = true; }));
    await page.waitForSelector(probe, { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(120);
  };

  await test('① 키를 저장하면 실제로 저장된다', async () => {
    await openPanel();
    for (const k of KEYS) {
      await page.fill('#' + k.input, k.val);
      await page.click('#' + k.save);
      await page.waitForTimeout(150);
      const got = await readIdb(page, k.idb);
      assert(got === k.val, k.label + ' 키가 저장되지 않았다: ' + JSON.stringify(got));
    }
  });

  await test('② 저장된 키를 입력칸에 되비추지 않는다 — 화면·스크린샷으로 새지 않는다', async () => {
    await openPanel();
    for (const k of KEYS) {
      const r = await page.evaluate((id) => {
        const el = document.getElementById(id);
        return { value: el.value, type: el.type, ph: el.placeholder };
      }, k.input);
      assert(r.value === '', k.label + ' 키가 입력칸에 그대로 보인다: ' + r.value);
      assert(r.type === 'password', k.label + ' 키 칸이 password 가 아니다: ' + r.type);
      assert(/저장됨/.test(r.ph), k.label + ' 키가 저장됐는데 그 사실을 알려주지 않는다: ' + r.ph);
      assert(r.ph.indexOf(k.val) < 0, k.label + ' 안내문에 키 원문이 들어 있다: ' + r.ph);
    }
  });

  await test('③ ★빈 칸으로 저장을 눌러도 키가 지워지지 않는다', async () => {
    await openPanel();
    for (const k of KEYS) {
      await page.evaluate((id) => { document.getElementById(id).value = ''; }, k.input);
      await page.click('#' + k.save);
      await page.waitForTimeout(150);
      const got = await readIdb(page, k.idb);
      assert(got === k.val, k.label + ' 키가 빈 칸 저장으로 지워졌다 — 사장님이 겪은 그 사고다: ' + JSON.stringify(got));
      const mem = await page.evaluate((w) => window[w], k.win);
      assert(mem === k.val, k.label + ' 키가 메모리에서 사라졌다: ' + JSON.stringify(mem));
    }
  });

  await test('④ 새 키를 넣으면 제대로 바뀐다', async () => {
    await openPanel();
    const k = KEYS[0];
    await page.fill('#' + k.input, 'AIzaGEMINI-CHANGED-9999');
    await page.click('#' + k.save);
    await page.waitForTimeout(150);
    const got = await readIdb(page, k.idb);
    assert(got === 'AIzaGEMINI-CHANGED-9999', '새 키로 안 바뀐다: ' + JSON.stringify(got));
    k.val = 'AIzaGEMINI-CHANGED-9999';
  });

  await test('⑤ [지우기]를 눌러야만 지워진다', async () => {
    await openPanel();
    const k = KEYS[3];   // Vision
    await page.click('#' + k.del);
    await page.waitForTimeout(200);
    const got = await readIdb(page, k.idb);
    assert(!got, '[지우기]를 눌렀는데 안 지워진다: ' + JSON.stringify(got));
    // 나머지는 그대로여야 한다 — 하나 지웠다고 다 날아가면 안 된다.
    for (const o of KEYS.slice(0, 3)) {
      const g = await readIdb(page, o.idb);
      assert(g === o.val, o.label + ' 키가 함께 지워졌다: ' + JSON.stringify(g));
    }
  });

  await test('⑥ ★드라이브 인증키가 [연결 테스트]만으로 지워지지 않는다', async () => {
    const RY_URL = 'https://script.google.com/macros/s/RELAYTEST/exec';
    const RY_TOK = 'RELAY-TOKEN-TEST-5555';
    await openPanel('save');
    await page.fill('#ryUrl', RY_URL);
    await page.fill('#ryTok', RY_TOK);
    // 연결 테스트는 네트워크를 타므로 응답을 흉내낸다.
    await page.route('**/RELAYTEST/exec*', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, revision: 0, dataFileExists: false })
    }));
    await page.click('#ryTest');
    await page.waitForTimeout(600);
    let tok = await readIdb(page, 'relay_token');
    assert(tok === RY_TOK, '연결 테스트 뒤 인증키가 사라졌다: ' + JSON.stringify(tok));

    // 이제 칸을 비우고 다시 연결 테스트 — 예전에는 이것만으로 키가 날아갔다.
    await openPanel('save');
    await page.evaluate(() => { document.getElementById('ryTok').value = ''; });
    await page.click('#ryTest');
    await page.waitForTimeout(600);
    tok = await readIdb(page, 'relay_token');
    assert(tok === RY_TOK,
      '빈 칸으로 연결 테스트를 눌렀더니 드라이브 인증키가 지워졌다 — 사장님이 겪은 그 사고다: ' + JSON.stringify(tok));
    const url = await readIdb(page, 'relay_url');
    assert(url === RY_URL, '드라이브 주소도 지워졌다: ' + JSON.stringify(url));
  });

  await test('⑦ 드라이브 인증키도 입력칸에 되비추지 않는다', async () => {
    await openPanel('save');
    const r = await page.evaluate(() => {
      const el = document.getElementById('ryTok');
      return { value: el.value, type: el.type, ph: el.placeholder };
    });
    assert(r.value === '', '드라이브 인증키가 입력칸에 그대로 보인다');
    assert(r.type === 'password', '인증키 칸이 password 가 아니다');
    assert(/저장됨/.test(r.ph), '저장됐는데 그 사실을 알려주지 않는다: ' + r.ph);
    assert(r.ph.indexOf('5555') < 0 || /\*{4}/.test(r.ph), '안내문이 마스킹되지 않았다: ' + r.ph);
  });

  await test('⑧ [연결 끊기]를 눌러야만 드라이브 연결이 끊긴다', async () => {
    await openPanel('save');
    await page.click('#ryDrop');
    await page.waitForTimeout(250);
    const tok = await readIdb(page, 'relay_token');
    assert(!tok, '[연결 끊기]를 눌렀는데 인증키가 남아 있다: ' + JSON.stringify(tok));
  });

  await test('⑨ 키는 클라우드 백업(직렬화)에 실리지 않는다 — 기기 밖으로 안 나간다', async () => {
    const dump = await page.evaluate(() => JSON.stringify(serializeData()));
    for (const k of KEYS) {
      assert(dump.indexOf(k.val) < 0, k.label + ' 키가 클라우드 백업에 실린다: 기기 밖으로 나간다');
    }
    assert(dump.indexOf('RELAY-TOKEN-TEST-5555') < 0, '드라이브 인증키가 클라우드 백업에 실린다');
  });

  await test('⑪ 키를 찾기 쉬운 자리에 둔다 — "비상용" 문 뒤에 숨기지 않는다', async () => {
    await openPanel();
    const r = await page.evaluate(() => {
      const modal = document.querySelector('#modalRoot .modal');
      const depthOf = (id) => {
        const el = document.getElementById(id);
        if (!el) return { found: false };
        let n = 0; const labels = []; let cur = el.parentElement;
        while (cur && cur !== modal) {
          if (cur.tagName === 'DETAILS') { n++; const sm = cur.querySelector('summary'); labels.unshift((sm && sm.textContent || '').trim()); }
          cur = cur.parentElement;
        }
        return { found: true, depth: n, labels };
      };
      return {
        gemini: depthOf('gdGemini'), openai: depthOf('gdOpenai'), kakao: depthOf('gdKakao'), vision: depthOf('gdVision'),
        title: (modal.querySelector('h3') || {}).textContent || ''
      };
    });
    for (const [name, d] of Object.entries(r)) {
      if (name === 'title') continue;
      assert(d.found, name + ' 키 칸이 없다');
      // 아코디언 한 겹까지는 괜찮다(항목이 많아 접어 두는 것). 두 겹부터는 못 찾는다.
      assert(d.depth <= 1, name + ' 키가 아코디언 ' + d.depth + '겹 안에 있다 — 사장님이 못 찾는다: ' + d.labels.join(' > '));
      // '비상용'·'로그인 필요' 같은 말 뒤에 두면, 찾아도 열지 않는다.
      const behind = d.labels.join(' ');
      assert(!/비상용|응급|고급 설정|건드리지/.test(behind),
        name + ' 키가 "' + behind + '" 뒤에 숨어 있다 — 그 문구는 열지 말라는 뜻으로 읽힌다');
    }
    // 열지 않아도 지금 상태가 보여야 한다.
    const badges = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('#modalRoot summary').forEach((sm) => {
        const t = sm.textContent || '';
        if (/Gemini|ChatGPT|카카오|Cloud Vision/.test(t)) out[t.slice(0, 20)] = /설정됨|없음/.test(t);
      });
      return out;
    });
    const vals = Object.values(badges);
    assert(vals.length >= 4 && vals.every(Boolean),
      '키 줄에 설정됨/없음 배지가 없다 — 열어 봐야만 알 수 있다: ' + JSON.stringify(badges));
  });

  await test('⑩ 화면 오류 0', async () => {
    assert(errs.length === 0, errs.slice(0, 3).join(' | '));
  });

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log('\n' + (bad.length ? bad.length + '건 실패' : '전부 통과 (' + results.length + '건)'));
  if (bad.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error('FAIL', (e && e.stack) || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});   // 안 닫으면 멈춘다
});
