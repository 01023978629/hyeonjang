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

  // 5) 관리사무소 접수 고지 — 모든 필수 고지는 privacy.html 자체에 있어야 한다.
  await test('관리사무소 접수 — 개인정보 고지에 필수 항목 포함', async () => {
    const pages = await page.evaluate(async () => Promise.all(['privacy.html', 'terms.html'].map(async name => (await fetch(name)).text())));
    const [privacy, terms] = pages;
    const text = privacy.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const [label, pattern] of [
      ['관리사무소 연락처', /관리사무소[^.]{0,120}(?:담당자|성명)[^.]{0,80}(?:연락처|전화)/],
      ['선택적 입주민 연락처', /입주민[^.]{0,100}(?:연락처|성명)[^.]{0,100}(?:선택|필요한 경우에만)/],
      ['처리 목적', /수집 목적[^.]{0,160}(?:문의 접수|방문 일정|공사 진행)/],
      ['처리 경로', /관리사무소 웹 문의\s*→\s*보안 연결\s*→\s*운영자 (?:현장 )?접수함\s*→\s*담당자 검토/],
      ['취소 90일 후보', /취소[^.]{0,180}(?:90일[^.]{0,100}(?:후보|분류)|(?:후보|분류)[^.]{0,120}90일)/],
      ['완료일부터 1년', /완료일(?:로부터|부터)\s*1년/],
      ['계약·세금 법정 보관', /계약서[^.]{0,120}세금계산서[^.]{0,120}(?:법정|법령)/],
      ['사람 검토 후 파기', /자동[^.]{0,120}(?:삭제|파기)/],
      ['담당자 검토 후 파기', /담당자[^.]{0,120}검토[^.]{0,120}(?:삭제|파기)/],
      ['권리와 연락처', /열람[^.]{0,120}정정[^.]{0,120}삭제[^.]{0,120}처리정지/],
      ['문의 연락처', /010-2397-8629[^.]{0,100}3dncjf@gmail\.com/]
    ]) assert(pattern.test(text), 'privacy.html ' + label + ' 고지가 없습니다');
    for (const pattern of [
      /Google Apps Script/i, /\bApps Script\b/i, /(?:script\.google\.com|\/exec\b)/i,
      /\b(?:APP_TOKEN|OFFICE_[A-Z_]+|DRIVE_FOLDER_ID|DATA_FILE_NAME)\b/,
      /(?:OAuth|access token|액세스 토큰|\btoken\b)/i, /(?:일회용\s*)?PIN\b/i,
      /(?:배포 URL|스크립트 속성|내부 서버|endpoint)/i
    ]) assert(!pattern.test(privacy) && !pattern.test(terms), '공개 법률 문서에 내부 식별자/비밀 용어가 남아 있음: ' + pattern);
  });

  // 6) 완료 보고 PII — 알려진 이름은 토큰/‘님’ 경계만, 전화 구분자는 제한된 문자만 허용한다.
  await test('officeIntakeCompletionPayload — 이름·전화 경계 마스킹', async () => {
    const summary = await page.evaluate(() => officeIntakeCompletionPayload({
      completionSummary: '홍길동 홍길동님 홍길동식당 Alice Alice님 AliceCo 010-1234-5678 010/1234/5678 042.1234.5678',
      customerName: 'Alice',
      phone: '0421234567',
      residentContact: { name: '홍길동', phone: '01012345678' },
      officeContactPhone: '0421234567'
    }).summary);
    assert(summary.indexOf('[고객명] [고객명] 홍길동식당 [고객명] [고객명] AliceCo') >= 0, '한글/영문 이름 토큰·님 경계를 지키지 않음: ' + summary);
    assert(summary.indexOf('010-1234-5678') < 0 && summary.indexOf('042.1234.5678') < 0, '사무소·입주민 전화의 허용 구분자가 마스킹되지 않음: ' + summary);
    assert(summary.indexOf('010/1234/5678') < 0, 'slash-separated mobile number leaked from the public completion summary: ' + summary);
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
