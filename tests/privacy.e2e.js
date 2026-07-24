/* privacy.e2e.js — 프라이버시/XSS 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   대상: 외부 LLM 전송 전화 마스킹(aiToolRun)·리드 프래그먼트 파싱·escapeHtml 정확성.
   실제 고객번호 미사용 — 합성 번호(010-1234-5678). */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

const RAW = '010-1234-5678';   // 합성 원문 — LLM 출력/화면에 그대로 나오면 안 됨
const RAW_DIGITS = '01012345678';

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 1) list_projects — 외부 LLM 전송 결과에 전화 원문 없음(뒷4자리 마스킹만)
  await test('list_projects — 전화 원문 미노출(뒷4자리 마스킹)', async () => {
    const out = await page.evaluate(async (raw) => {
      state.projects = [{ name: '테스트현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: raw, addr: '' }, archived: false }];
      state.files = [];
      const r = await aiToolRun('list_projects', {});
      return JSON.stringify(r);
    }, RAW);
    assert(out.indexOf(RAW) < 0, '원문(하이픈형) 노출: ' + out);
    assert(out.indexOf(RAW_DIGITS) < 0, '원문(숫자형) 노출');
    assert(out.indexOf('1234') < 0, '가운데 자리(1234) 노출');
    assert(out.indexOf('5678') >= 0, '뒷4자리 식별자는 유지되어야(운영자 식별용): ' + out);
  });

  // 2) list_contacts — 동일 정책
  await test('list_contacts — 전화 원문 미노출(뒷4자리 마스킹)', async () => {
    const out = await page.evaluate(async (raw) => {
      state.contacts = [{ name: '이거래처', phone: raw, company: '자재상', memo: '' }];
      const r = await aiToolRun('list_contacts', {});
      return JSON.stringify(r);
    }, RAW);
    assert(out.indexOf(RAW) < 0 && out.indexOf(RAW_DIGITS) < 0 && out.indexOf('1234') < 0, '연락처 전화 원문 노출: ' + out);
    assert(out.indexOf('5678') >= 0, '뒷4자리 유지');
  });

  // 3) 리드 파싱 — 프래그먼트(#lead=)를 읽는다(홈페이지 발급부와 정합, Referer 미유출 경로)
  await test('hjLeadParse — 프래그먼트(#lead=) 페이로드 파싱', async () => {
    const r = await page.evaluate(() => {
      const payload = { name: '프래그', phone: '010-0000-5678', leadId: 'INQ-1' };
      // UTF-8 안전 base64url(홈페이지 발급부와 동일 규약) — hjB64ToUtf8 가 역으로 디코딩
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // 해시만 설정(쿼리 없음) — 재로드 없이 hash 갱신 후 순수 파서만 호출(인테이크 모달 미트리거)
      location.hash = 'lead=' + b64;
      const d = hjLeadParse();
      location.hash = '';
      return d;
    });
    assert(r && r.name === '프래그' && r.leadId === 'INQ-1', '프래그먼트 리드 파싱 실패: ' + JSON.stringify(r));
  });

  // 4) escapeHtml — 5개 메타문자 모두 이스케이프(XSS 싱크 방어의 근간)
  await test('escapeHtml — & < > " \' 전부 이스케이프', async () => {
    const r = await page.evaluate(() => escapeHtml(`<img src=x onerror=alert(1)>&"'`));
    assert(r.indexOf('<img') < 0 && r.indexOf('&lt;img') >= 0, '< 미이스케이프: ' + r);
    assert(r.indexOf('&amp;') >= 0 && r.indexOf('&quot;') >= 0 && (r.indexOf('&#39;') >= 0 || r.indexOf('&#039;') >= 0), '따옴표/앰퍼샌드 미이스케이프: ' + r);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== privacy: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
