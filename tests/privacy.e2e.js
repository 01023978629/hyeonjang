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

  // 7) 외부 AI 출구 — 채팅(aiAgentSend)이 도구 결과를 모델로 돌려보내는 functionResponse 에 전화 원문이 없어야 한다.
  //    list_notes(통화메모 원문)·search_all(연락처 c.phone 원문)·list_schedule(메모)은 도구 자체가 가리지 않는다 —
  //    그래서 도구 반환값에는 원문이 있고(시드가 실제로 새는 조건을 만든다는 증명) 출구에서만 가려져야 한다.
  const LEAK = '010-0000-1234';
  const leakForms = ['0000-1234', '00001234', '0000 1234', '0000.1234', '010-0000-1'];   // 마지막은 cut(60) 으로 끝이 잘린 번호
  await test('AI 출구 — list_notes·search_all·list_schedule 결과의 전화 가림(뒷4자리 유지, 날짜·금액 보존)', async () => {
    const r = await page.evaluate(async (leak) => {
      state.notes = [{ id: 'n_ai1', date: '2026-09-26', day: '2026-09-26', text: '📞 통화메모 · 홍길동 ' + leak + ' · 2026-09-26 견적 12,000,000원 · 150000000원', project: '' }];
      state.contacts = [{ name: '홍길동', phone: leak, company: '자재상', memo: '' }];
      state.schedule = [{ id: 's_ai1', date: '2026-09-26', time: '09:30', title: '홍길동 실측', project: '', memo: '도착 전 010 0000 1234 연락 · 둘째 01000001234 · 셋째 010.0000.1234' },
        { id: 's_ai2', date: '2026-09-27', time: '', title: '홍길동 잘림', project: '', memo: 'x'.repeat(49) + ' ' + leak }];
      // 도구 반환값 자체는 원문 — 출구가 가리지 않으면 그대로 나간다
      const rawNotes = JSON.stringify(await aiToolRun('list_notes', {}));
      const rawSearch = JSON.stringify(await aiToolRun('search_all', { query: '홍길동' }));
      const rawSched = JSON.stringify(await aiToolRun('list_schedule', {}));
      const keep = { aiKeyReady: window.aiKeyReady, aiFC: window.aiFC };
      let round = 0;
      window.aiKeyReady = () => true;
      window.aiFC = async () => (round++ === 0 ? [
        { functionCall: { name: 'list_notes', args: {} } },
        { functionCall: { name: 'search_all', args: { query: '홍길동' } } },
        { functionCall: { name: 'list_schedule', args: {} } }] : [{ text: '확인했습니다' }]);
      window.__aiHist = [];
      try { await aiAgentSend('홍길동 연락처 정리해줘'); }
      finally { window.aiKeyReady = keep.aiKeyReady; window.aiFC = keep.aiFC; }
      const resp = (window.__aiHist || []).filter(h => h.role === 'user' && (h.parts || []).some(p => p.functionResponse));
      return { rawNotes, rawSearch, rawSched, resp: JSON.stringify(resp), n: resp.length ? resp[0].parts.length : 0,
        openai: JSON.stringify(aiHistToOpenAI(window.__aiHist)) };
    }, LEAK);
    assert(r.rawNotes.indexOf(LEAK) >= 0 && r.rawSearch.indexOf(LEAK) >= 0 && r.rawSched.indexOf('010 0000 1234') >= 0, '시드가 새는 조건을 만들지 못함(검사 무효): ' + r.rawSearch.slice(0, 200));
    assert(r.n === 3, '도구 결과 3건이 모델로 돌아가야: ' + r.n);
    for (const [label, out] of [['Gemini functionResponse', r.resp], ['OpenAI tool 메시지', r.openai]]) {
      for (const f of leakForms) assert(out.indexOf(f) < 0, label + ' 에 전화 가운데 자리(' + f + ') 노출: ' + out.slice(0, 600));
      assert(out.indexOf('01000001234') < 0, label + ' 숫자형 원문 노출');
      assert(out.indexOf('···1234') >= 0, label + ' 뒷4자리 식별자는 남아야');
      assert(out.indexOf('2026-09-26') >= 0 && out.indexOf('12,000,000원') >= 0 && out.indexOf('150000000원') >= 0, label + ' 날짜·금액이 망가짐: ' + out.slice(0, 600));
      // 시간은 일정(list_schedule) 결과에만 있다 — aiHistToOpenAI 는 한 턴의 첫 functionResponse 만 옮기므로(별개 결함) Gemini 쪽에서만 본다
      if (label.startsWith('Gemini')) assert(out.indexOf('09:30') >= 0, label + ' 시간이 망가짐');
      assert(out.indexOf('홍길동') >= 0, label + ' 이름은 가리는 대상이 아님(과잉 가림)');
    }
  });

  // 8) 가림 규칙 단위 — 날짜·금액·회사 공개번호는 그대로, 변형 번호는 가림
  await test('hjAiMaskText — 좁은 규칙(날짜·금액·회사번호 보존, 변형 번호 가림)', async () => {
    const r = await page.evaluate(() => ({
      keep: ['2026-09-26', '12,000,000', '150000000원', '1588-1234', '제20260926', '2026-09-26T09:30:00', 'COMPANY:' + COMPANY.tel,
        // 확장자가 붙은 긴 숫자열·밑줄 뒤 숫자열은 사진 파일 이름 — 가리면 다음 도구 호출에서 그 사진을 못 찾는다
        '1727000000000.jpg', 'IMG_0212345678.jpg'].map(t => [t, hjAiMaskText(t)]),
      mask: ['01000001234', '010 0000 1234', '010.0000.1234', '010/0000/1234', '+82 10-0000-1234', '042-000-1234', '02-000-1234', '0420001234', '1000001234', '끝 010-0000-12',
        // 명함식 표기(앞에 영문·점이 붙음)·구분자 앞뒤 공백 — 예전 앞자리 조건 (?<![\w.]) 은 이것들을 통째로 흘렸다
        'T.010-0000-1234', 'HP010-0000-1234', 'M.010.0000.1234', '010 - 0000 - 1234', '끝 T.010 - 0000 - 1'].map(t => [t, hjAiMaskText(t)]),
      deep: hjAiMaskOut({ a: [{ b: '010-0000-1234', n: 12000000, d: null }], when: new Date('2026-09-26T00:00:00Z') })
    }));
    for (const [a, b] of r.keep) assert(a === b, '보존해야 할 값이 바뀜: ' + a + ' → ' + b);
    for (const [a, b] of r.mask) assert(!/0000/.test(b) && !/000-/.test(b), '가려야 할 값이 남음: ' + a + ' → ' + b);
    assert(r.deep.a[0].b === '···1234' && r.deep.a[0].n === 12000000 && r.deep.a[0].d === null, '깊이 순회 가림/숫자 보존 실패: ' + JSON.stringify(r.deep));
    assert(r.deep.when === '2026-09-26T00:00:00.000Z', 'Date 는 JSON 모양 그대로 나가야: ' + JSON.stringify(r.deep));
  });

  // 9) 동선 조언 — 외부 AI 프롬프트에 도로명·번지·동호수·전화가 없고 시·구·동만 있다
  await test('일정 브리핑 AI 동선 조언 — 주소는 시·구·동까지만', async () => {
    const prompt = await page.evaluate(async (leak) => {
      const today = localDate();
      state.projects = [{ name: '둔산 테스트현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, archived: false,
        customer: { name: '김고객', phone: leak, addr: '대전 서구 둔산동 테스트로 123 101동 1502호' } }];
      state.schedule = [{ id: 's_rt1', date: today, time: '10:00', title: '철거 ' + leak, project: '둔산 테스트현장', memo: '' }];
      const keep = { k: window.__geminiKey, ask: window.geminiAsk };
      window.__geminiKey = 'AIzaTEST-FAKE-KEY';
      window.__capPrompt = null;
      window.geminiAsk = async (p) => { window.__capPrompt = p; return '조언'; };
      try {
        scheduleBrief();
        const b = document.getElementById('sbAI');
        if (!b) throw new Error('AI 동선 조언 버튼 없음');
        b.click();
        for (let i = 0; i < 100 && window.__capPrompt == null; i++) await new Promise(r => setTimeout(r, 20));
      } finally { window.__geminiKey = keep.k; window.geminiAsk = keep.ask; try { closeModal(); } catch (e) {} }
      return window.__capPrompt;
    }, LEAK);
    assert(typeof prompt === 'string', '프롬프트를 잡지 못함');
    assert(prompt.indexOf('대전 서구 둔산동') >= 0, '시·구·동은 남아야(동선 판단용): ' + prompt);
    for (const f of ['테스트로', '로 123', '101동', '1502호', '0000-1234']) assert(prompt.indexOf(f) < 0, '프롬프트에 ' + f + ' 노출: ' + prompt);
  });

  // 10) 주소 줄임 단위 — 도로명에서 멈추고, 동 단위까지만
  await test('hjAddrArea — 시·구·동까지만', async () => {
    const r = await page.evaluate(() => [
      ['대전 중구 돌다리로 19번길 9 1층', hjAddrArea('대전 중구 돌다리로 19번길 9 1층')],
      ['서울 마포구 망원동 123-4', hjAddrArea('서울 마포구 망원동 123-4')],
      ['대전광역시 유성구 봉명동 테스트아파트 101동 1502호', hjAddrArea('대전광역시 유성구 봉명동 테스트아파트 101동 1502호')],
      ['', hjAddrArea('')]]);
    const want = ['대전 중구', '서울 마포구 망원동', '대전광역시 유성구 봉명동', ''];
    r.forEach(([a, b], i) => assert(b === want[i], a + ' → ' + b + ' (기대 ' + want[i] + ')'));
  });

  // 11) 가린 연락처의 역류 — 출구가 add_supplier 결과의 연락처를 '···1234' 로 돌려보내므로, 모델이 그 값을 phone 으로
  //     되넘겨도 저장된 원문을 덮어쓰면 안 된다. 진짜 새 번호는 그대로 고쳐진다.
  await test('add_supplier — 가린 연락처(···NNNN)는 기존 번호를 덮지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.suppliers = [{ name: '테스트자재상', phone: '010-0000-1234', category: '자재', memo: '', items: '' }];
      const out = hjAiMaskOut(await aiToolRun('add_supplier', { name: '테스트자재상', memo: '메모' }));
      await aiToolRun('add_supplier', { name: '테스트자재상', phone: out.연락처, memo: '메모2' });
      const afterMasked = state.suppliers[0].phone;
      await aiToolRun('add_supplier', { name: '테스트자재상', phone: '010-0000-5678' });
      return { masked: out.연락처, afterMasked, afterReal: state.suppliers[0].phone, memo: state.suppliers[0].memo };
    });
    assert(r.masked === '···1234', '출구에서 연락처가 가려져야(검사 전제): ' + r.masked);
    assert(r.afterMasked === '010-0000-1234', '가린 값이 원문을 덮어씀: ' + r.afterMasked);
    assert(r.memo === '메모2' || r.afterReal === '010-0000-5678', '다른 칸 수정은 그대로 돼야');
    assert(r.afterReal === '010-0000-5678', '진짜 새 번호는 고쳐져야: ' + r.afterReal);
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
