/* warranty-link.e2e.js — ⑩ 하자보증서 확인자 서명을 '링크'로 받는 길 (대표 결정 2026-09-17 "둘 다")
   서명판(warranty-sign.e2e.js)은 현장에서 폰을 건네는 길이고, 이것은 확인자가 자리에 없을 때의 길이다.
   서명은 전자계약 서버(manmool, docKind:'warranty')가 받고, 완성본은 사진이 들어가므로 앱이 만든다.

   여기서 보는 것 — 갈라지면 분쟁에서만 드러나는 것들:
     · 링크 본문의 보증 조항이 종이 보증서와 **같은 곳**(hjWarrantyClauses)에서 나온다
     · 서버에 보내는 것이 docKind:'warranty' 이고 대금이 붙지 않는다
     · 확인자 전화번호가 앱에 **저장되지 않는다**(PII — 서버도 마스킹본과 해시만 남긴다)
     · 서명 전에는 빈 서명을 문서에 붙이지 않는다
     · 가져온 서명이 480×135 로 줄어 영구 보관되고 문서에 들어간다
     · 직렬화 왕복에서 살아남는다 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });

  const N = '가상링크현장';
  /* 서버를 흉내 낸다. 진짜 서버를 부르지 않되, **실패해야 할 때 실패하는** 가짜여야 한다 —
     서명 전에는 BAD_STATE 를 던지고, 그때 앱이 빈 서명을 만들어 내면 검사가 잡는다. */
  const seed = (opts) => page.evaluate(({ N, PNG, o }) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: N, stage: 4, received: 0, doneAt: '2026-09-01', phases: ['방수'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객', addr: '대전 중구 가상로 1' }, archived: false }];
    state.files = [{ id: 's1', name: '가상_s1.png', prefix: '', kind: 'photo', ext: 'png', size: 10, project: N, when: new Date('2026-09-01T09:00:00'), thumb: 'data:image/png;base64,' + PNG, _phase: '시공 전' }];
    state.quotes = []; state.activeProject = N; state.dirty = false; window.__wrPick = null;
    __contract.url = 'https://script.google.com/macros/s/TEST/exec';
    __contract.token = 'SUPER-SECRET-ADMIN-TOKEN';
    __contract.selfTestOk = true;
    // 가짜 서버 — 주고받은 것을 그대로 들고 있다가 검사가 들여다본다
    window.__srv = { calls: [], signed: !!(o && o.signed), bigPng: null };
    // 640×180 짜리 서명 그림(줄이기 전). 앱이 480×135 로 줄이는지 보려면 큰 것이 필요하다
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 180;
    const g = cv.getContext('2d'); g.fillStyle = '#16233b'; g.fillRect(40, 40, 400, 60);
    window.__srv.bigPng = cv.toDataURL('image/png');
    window.contractCall = async function (action, payload) {
      window.__srv.calls.push({ action, payload: JSON.parse(JSON.stringify(payload || {})) });
      if (action === 'quickSend') {
        return { ok: true, contractId: 'ct_test1', contractNo: 'MM-2026-0999', docKind: 'warranty',
          signUrl: 'https://script.google.com/macros/s/TEST/exec?page=sign&t=tok', notify: { sent: false, reason: 'MOCK_OFF' } };
      }
      if (action === 'contract.signature') {
        if (!window.__srv.signed) { const e = new Error('아직 서명이 끝나지 않았습니다(현재 SENT)'); e.__code = 'BAD_STATE'; throw e; }
        return { ok: true, id: 'ct_test1', contractNo: 'MM-2026-0999', docKind: 'warranty', status: 'COMPLETED',
          signerName: '홍길동 소장', signedAt: '2026-09-18T04:05:06.000Z',
          signatureSha256: 'a'.repeat(64), signatureImage: window.__srv.bigPng };
      }
      const e = new Error('모르는 동작'); e.__code = 'BAD_REQUEST'; throw e;
    };
  }, { N, PNG, o: opts || {} });

  const clickMake = () => page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('보증서 만들기')).click(); });
  const waitDoc = () => page.waitForFunction(() => !!document.querySelector('#modalRoot #hjDocPdf'), null, { timeout: 8000 });
  const openDoc = async () => { await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['s1'], after: [] }; }, N); await clickMake(); await waitDoc(); };
  const fill = (name, phone, org) => page.evaluate(({ name, phone, org }) => {
    document.getElementById('wlName').value = name;
    document.getElementById('wlPhone').value = phone;
    if (org != null) document.getElementById('wlOrg').value = org;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('링크 만들기')).click();
  }, { name, phone, org });

  await test('[🔗 링크로 서명받기]는 하자보증서 화면에만 있고 직접 배선되어 있다 · 거래명세서에는 없다', async () => {
    await seed(); await openDoc();
    const r = await page.evaluate(() => { const b = document.querySelector('#modalRoot #hjDocSignLink'); return { has: !!b, wired: !!b && typeof b.onclick === 'function' }; });
    assert(r.has && r.wired, '링크 버튼이 직접 배선되어야 한다(모달은 위임 밖): ' + JSON.stringify(r));
    await page.evaluate(n => { closeModal(true); state.files.push({ id: 'e9', kind: 'estimate', project: n, name: '견적', est: { amount: 100, supply: 100, vat: 10, date: '2026-05-10' }, when: new Date('2026-05-10') }); settleDocs(n); }, N);
    await page.evaluate(() => document.querySelector('#modalRoot .sdCard[data-k="statement"]').click()); await waitDoc();
    assert(!(await page.evaluate(() => !!document.querySelector('#modalRoot #hjDocSignLink'))), '거래명세서에 링크 서명 버튼이 있으면 안 된다');
  });

  await test('빈 성명·틀린 휴대폰 번호로는 링크를 만들지 않는다', async () => {
    await seed(); await openDoc();
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocSignLink').click());
    await page.waitForSelector('#wlPhone');
    await fill('', '01012345678', '');
    let r = await page.evaluate(() => ({ calls: window.__srv.calls.length, still: !!document.getElementById('wlPhone'), toast: (document.getElementById('toast') || {}).textContent }));
    assert(r.calls === 0 && r.still && /성명/.test(r.toast), '빈 성명인데 서버를 불렀다: ' + JSON.stringify(r));
    await fill('홍길동 소장', '0212345678', '');
    r = await page.evaluate(() => ({ calls: window.__srv.calls.length, still: !!document.getElementById('wlPhone'), toast: (document.getElementById('toast') || {}).textContent }));
    assert(r.calls === 0 && r.still && /휴대폰/.test(r.toast), '휴대폰이 아닌 번호인데 서버를 불렀다: ' + JSON.stringify(r));
  });

  await test('★ 서버에 보내는 것: docKind=warranty · 대금 없음 · 조항은 종이 보증서와 같은 곳에서', async () => {
    await seed(); await openDoc();
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocSignLink').click());
    await page.waitForSelector('#wlPhone');
    await fill('홍길동 소장', '010-1234-5678', '가상아파트 관리사무소');
    await page.waitForFunction(() => window.__srv.calls.length > 0, null, { timeout: 5000 });
    const r = await page.evaluate(() => {
      const c = window.__srv.calls[0];
      const mine = hjWarrantyClauses('3년').map(x => x[1]);
      return { action: c.action, kind: c.payload.docKind, amount: c.payload.amount,
        hasPayment: !!(c.payload.body && c.payload.body.payment),
        clauses: (c.payload.body && c.payload.body.clauses) || [], mine: mine,
        cust: c.payload.customer, title: c.payload.title };
    });
    assert(r.action === 'quickSend', 'quickSend 로 보내야 한다: ' + r.action);
    assert(r.kind === 'warranty', "docKind 가 'warranty' 여야 한다: " + r.kind);
    assert(r.amount === undefined, '보증서에 금액을 붙이면 안 된다: ' + JSON.stringify(r.amount));
    assert(!r.hasPayment, '보증서 본문에 대금 지급 조건을 넣으면 안 된다');
    assert(r.clauses.length === r.mine.length && r.clauses.length >= 5, '조항 수가 다르다: ' + r.clauses.length + ' vs ' + r.mine.length);
    // ★ 여기가 핵심이다. 서버는 보증 문구를 지어내지 않으므로, 앱이 보낸 것이 곧 고객이 읽는 것이다.
    //   종이 보증서와 문구가 갈라지면 '받은 보증서'와 '서명한 보증서'가 달라진다.
    const same = r.clauses.every((c, i) => String(c.text) === String(r.mine[i]));
    assert(same, '링크 본문 조항이 종이 보증서와 다르다:\n' + JSON.stringify(r.clauses.map(c => c.text), null, 1));
    assert(r.cust && r.cust.name === '홍길동 소장' && r.cust.phone === '010-1234-5678', '확인자 정보가 서버로 가야 한다');
    assert(/하자보증서/.test(r.title), '제목에 하자보증서가 들어가야 한다: ' + r.title);
  });

  await test('★ 확인자 전화번호가 앱에 저장되지 않는다 (PII)', async () => {
    const dump = await page.evaluate(() => JSON.stringify(serializeData()));
    assert(dump.indexOf('010-1234-5678') < 0 && dump.indexOf('01012345678') < 0, '전화번호가 앱 자료에 남았습니다');
    const req = await page.evaluate(() => (state.projects[0].warrantyLinks || [])[0] || null);
    assert(req && req.contractId === 'ct_test1' && req.name === '홍길동 소장' && req.role === 'office', '서명 요청이 보관되어야 한다: ' + JSON.stringify(req));
    assert(!('phone' in req), '요청에 전화번호 칸이 있으면 안 된다: ' + JSON.stringify(Object.keys(req)));
  });

  await test('★ 서명 전에는 빈 서명을 문서에 붙이지 않는다', async () => {
    await page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('서명 확인')).click(); });
    await page.waitForFunction(() => /서명하지 않았/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 5000 });
    const n = await page.evaluate(() => (state.projects[0].warrantySigs || []).length);
    assert(n === 0, '서명 전인데 서명이 보관되었다: ' + n);
  });

  await test('서명이 끝나면 가져와 보관하고, 480×135 로 줄여 문서에 넣는다', async () => {
    await page.evaluate(() => { window.__srv.signed = true;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('서명 확인')).click(); });
    await page.waitForFunction(() => (state.projects[0].warrantySigs || []).length === 1, null, { timeout: 8000 });
    const sig = await page.evaluate(() => state.projects[0].warrantySigs[0]);
    assert(sig.via === 'link', "링크로 받은 서명이라고 적혀야 한다: " + sig.via);
    assert(sig.name === '홍길동 소장', '서버가 준 확인자 이름을 써야 한다: ' + sig.name);
    assert(sig.role === 'office' && sig.org === '가상아파트 관리사무소', '구분·소속이 요청에서 이어져야 한다: ' + JSON.stringify(sig));
    assert(/^data:image\/png;base64,/.test(sig.png), 'PNG 여야 한다');
    const size = await page.evaluate(png => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.src = png; }), sig.png);
    assert(size.w === 480 && size.h === 135, '480×135 로 줄여 보관해야 한다: ' + JSON.stringify(size));
    const req = await page.evaluate(() => state.projects[0].warrantyLinks[0]);
    assert(!!req.signedAt, '요청에 서명 시각이 찍혀야 한다');
    // 서명이 든 보증서가 다시 열리고, 그 문서에 서명 이미지가 들어 있다
    await waitDoc();
    const doc = await page.evaluate(() => document.querySelector('#modalRoot iframe').getAttribute('srcdoc'));
    assert(doc.indexOf(sig.png.slice(0, 80)) >= 0, '서명 이미지가 문서에 들어가야 한다');
    assert(/홍길동 소장/.test(doc), '확인자 이름이 문서에 들어가야 한다');
  });

  await test('★ 서명 대기 중인 요청이 카톡 카드에 뜨고, 그 버튼이 실제로 눌린다', async () => {
    await seed(); await openDoc();
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocSignLink').click());
    await page.waitForSelector('#wlPhone');
    await fill('김대기 소장', '010-2222-3333', '가상아파트 관리사무소');
    await page.waitForFunction(() => window.__srv.calls.length > 0, null, { timeout: 5000 });
    const r = await page.evaluate(() => {
      const html = hjKakaoCard(state.projects[0]);
      const m = html.match(/data-wlpull="([^"]+)"/);
      return { has: !!m, val: m ? m[1] : '', pending: warrantyLinkPending(state.projects[0]).length };
    });
    assert(r.has && r.pending === 1, '서명 대기 줄이 카드에 떠야 한다: ' + JSON.stringify(r));
    // 카드는 모달이 아니라 #view 안이라 **위임**으로 돈다. 셀렉터에 빠져 있으면
    // 버튼은 보이는데 눌러도 아무 일도 일어나지 않는다 — 그래서 진짜로 눌러 본다.
    await page.evaluate(() => { closeModal(true);
      document.getElementById('view').innerHTML = hjKakaoCard(state.projects[0]); });
    await page.evaluate(() => { document.querySelector('#view [data-wlpull]').click(); });
    // 아직 서명 전(window.__srv.signed=false)이므로 서버가 거절하고 그 말이 화면에 떠야 한다.
    await page.waitForFunction(() => /서명하지 않았/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 5000 })
      .catch(() => { throw new Error('위임 버튼을 눌렀는데 아무 일도 일어나지 않았습니다 — 위임 셀렉터를 확인하세요'); });
    const calls = await page.evaluate(() => window.__srv.calls.map(c => c.action));
    assert(calls.indexOf('contract.signature') >= 0, '서명 확인을 서버에 묻지 않았다: ' + JSON.stringify(calls));
  });

  await test('직렬화 왕복에서 서명과 요청이 그대로 살아남는다', async () => {
    const before = await page.evaluate(() => {
      const p = state.projects[0];
      return JSON.stringify({ links: p.warrantyLinks || [], sigs: (p.warrantySigs || []).map(s => ({ name: s.name, via: s.via, len: s.png.length })) });
    });
    const after = await page.evaluate(() => {
      const snap = JSON.parse(JSON.stringify(serializeData()));
      applyData(snap);
      const p = state.projects.find(x => x.name === '가상링크현장');
      return JSON.stringify({ links: p.warrantyLinks || [], sigs: (p.warrantySigs || []).map(s => ({ name: s.name, via: s.via, len: s.png.length })) });
    });
    assert(before === after, '왕복에서 달라졌다:\n  전 ' + before + '\n  후 ' + after);
  });

  await test('페이지 오류가 없다', async () => {
    const real = errs.filter(e => !/ResizeObserver|favicon/i.test(e));
    assert(real.length === 0, '오류: ' + real.join(' / '));
  });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (bad.length ? bad.length + '건 실패' : '전부 통과 (' + results.length + '건)'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
