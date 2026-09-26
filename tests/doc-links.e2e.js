/* doc-links.e2e.js — 링크로 나가는 문서 두 가지의 빈틈 (v328 범위 밖으로 남은 결함)
   ① 하자보증서 서명 링크(warrantyLinkSend)의 멱등 키(idem)
      서버는 같은 idem 이면 처음 결과를 그대로 돌려준다. 예전 키는 '현장:세대:분' 뿐이라, 같은 분 안에 확인자 번호를
      잘못 넣었다가 고쳐 다시 만들면 **틀린 번호로 만든 링크**가 돌아왔다. 이제 보낼 내용 전체(이름·휴대폰·조항)의
      지문(FNV-1a, contractIdemHash)을 넣는다 — 같은 내용 재시도는 여전히 같은 키(두 건이 생기지 않게).
      전화번호 원문은 idem 에도, 현장 자료(warrantyLinks)에도 남지 않는다.
   ② 카톡 카드(hjKakaoCard)·공사 스토리(hjStoryData/hjStoryText)의 계약 줄
      contractLog 에 남은 vatIncluded·period 를 **기록 값 그대로 한 번** 보여 준다. 기록에 없으면(옛 계약) 적지 않는다 —
      서버가 그때 '(부가세 별도)'로 찍었어도 앱이 그걸 안다고 말하지 않는다. */
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

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });

  const N = '가상문서링크현장';
  const PHONE_A = '010-0000-1234', PHONE_B = '010-0000-5678';
  const seed = () => page.evaluate((N) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: N, stage: 4, received: 0, doneAt: '2026-09-01', phases: ['방수'], cost: { material: 0, labor: 0, outsource: 0 },
      customer: { name: '가상 고객', addr: '대전 중구 가상로 1' }, archived: false }];
    state.files = []; state.quotes = []; state.payLog = []; state.asLog = []; state.activeProject = N; state.dirty = false;
    __contract.url = 'https://script.google.com/macros/s/TEST/exec';
    __contract.token = 'SUPER-SECRET-ADMIN-TOKEN';
    __contract.selfTestOk = true;
    window.__calls = [];
    // 서버 흉내: 같은 idem 이면 처음 결과를 그대로 돌려준다 — 진짜 서버와 같은 규칙이어야 결함이 드러난다
    const seen = {};
    let n = 0;
    window.contractCall = async function (action, payload, opts) {
      const idem = (opts && opts.idem) || '';
      window.__calls.push({ action, idem, phone: payload && payload.customer && payload.customer.phone });
      if (idem && seen[idem]) return seen[idem];
      n++;
      const r = { ok: true, contractId: 'ct_' + n, contractNo: 'MM-TEST-' + n, docKind: 'warranty', phoneUsed: payload.customer.phone,
        signUrl: 'https://script.google.com/macros/s/TEST/exec?page=sign&t=tok' + n, notify: { sent: false, reason: 'MOCK_OFF' } };
      if (idem) seen[idem] = r;
      return r;
    };
    // 같은 분 안이어야 옛 결함이 드러난다 — 시계를 고정한다(분 경계에서 흔들리지 않게)
    const T = Date.UTC(2026, 8, 26, 1, 2, 3);
    window.__realNow = window.__realNow || Date.now;
    Date.now = () => T;
  }, N);
  const send = (name, phone, c) => page.evaluate(async ({ N, name, phone, c }) => {
    const before = window.__calls.length;
    warrantyLinkSend(N, c || {});
    document.getElementById('wlName').value = name;
    document.getElementById('wlPhone').value = phone;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('링크 만들기')).click();
    for (let i = 0; i < 100 && window.__calls.length === before; i++) await new Promise(r => setTimeout(r, 20));
    for (let i = 0; i < 100 && !/서명 링크/.test((document.querySelector('#modalRoot') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 20));
    const call = window.__calls[window.__calls.length - 1];
    const link = (document.getElementById('wlLink') || {}).value || '';
    try { closeModal(true); } catch (e) {}
    return { idem: call && call.idem, link, n: window.__calls.length - before };
  }, { N, name, phone, c });

  await test('① 같은 분 안에 확인자 번호를 고쳐 다시 만들면 새 링크가 나온다(옛 링크가 돌아오지 않는다)', async () => {
    await seed();
    const a = await send('가상 소장', PHONE_A);
    const b = await send('가상 소장', PHONE_B);
    assert(a.n === 1 && b.n === 1, '서버를 한 번씩 불러야 한다: ' + JSON.stringify([a.n, b.n]));
    assert(a.idem !== b.idem, '번호가 다른데 idem 이 같다: ' + a.idem);
    assert(a.link && b.link && a.link !== b.link, '고친 번호로 새 링크가 나와야 한다: ' + a.link + ' / ' + b.link);
    const used = await page.evaluate(() => window.__calls.map(c => c.phone));
    assert(used[1] === PHONE_B, '두 번째 요청이 고친 번호를 보내야 한다: ' + JSON.stringify(used));
  });

  await test('① 확인자 이름·조항이 달라도 다른 요청 · 같은 내용 재시도는 같은 idem(두 건이 생기지 않게)', async () => {
    await seed();
    const a = await send('가상 소장', PHONE_A);
    const again = await send('가상 소장', PHONE_A);
    assert(a.idem === again.idem && a.link === again.link, '같은 내용 재시도는 같은 idem·같은 링크여야 한다: ' + a.idem + ' / ' + again.idem);
    const nm = await send('가상 과장', PHONE_A);
    assert(nm.idem !== a.idem, '이름이 다른데 idem 이 같다');
    const wk = await send('가상 소장', PHONE_A, { work: '욕실 방수' });
    assert(wk.idem !== a.idem, '공사 내용이 다른데 idem 이 같다');
    // 조항 본문이 바뀐 경우 — 정본 함수를 잠깐 바꿔 본다
    await page.evaluate(() => { window.__origClauses = hjWarrantyClauses; hjWarrantyClauses = function (t) { const c = window.__origClauses(t); c[0] = [c[0][0], c[0][1] + ' (가상 변경)']; return c; }; });
    const cl = await send('가상 소장', PHONE_A);
    await page.evaluate(() => { hjWarrantyClauses = window.__origClauses; });
    assert(cl.idem !== a.idem, '조항이 다른데 idem 이 같다');
    assert(/^wr:가상문서링크현장::[0-9a-z]+:\d+$/.test(a.idem), 'idem 꼴(현장·세대·지문·분): ' + a.idem);
  });

  await test('① 전화번호 원문은 idem·현장 자료 어디에도 남지 않는다', async () => {
    const r = await page.evaluate(() => ({ idems: window.__calls.map(c => c.idem), dump: JSON.stringify(serializeData()),
      links: state.projects[0].warrantyLinks || [] }));
    const raw = ['010-0000-1234', '01000001234', '0000-1234', '00001234', '010-0000-5678', '01000005678'];
    r.idems.forEach(i => raw.forEach(x => assert(i.indexOf(x) < 0, 'idem 에 번호 원문: ' + i)));
    raw.forEach(x => assert(r.dump.indexOf(x) < 0, '앱 자료에 번호 원문이 남았다: ' + x));
    assert(r.links.length > 0 && r.links.every(L => !('phone' in L)), 'warrantyLinks 에 phone 칸이 있으면 안 된다');
  });

  const seedCt = () => page.evaluate((N) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: N, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
      customer: { name: '가상 고객' }, archived: false,
      contractLog: [
        { at: '2026-09-02T09:00:00.000Z', amount: 1100000, contractNo: 'MM-OLD-1', contractId: 'ct_o', status: 'SENT' },
        { at: '2026-09-03T09:00:00.000Z', amount: 2200000, contractNo: 'MM-VIN-2', contractId: 'ct_i', status: 'LINK_CREATED',
          vatIncluded: true, period: '2026-10-05 ~ 2026-10-09', serverStatus: 'COMPLETED', completedAt: '2026-09-04T09:00:00.000Z' },
        { at: '2026-09-05T09:00:00.000Z', amount: 3300000, contractNo: 'MM-VEX-3', contractId: 'ct_e', status: 'SENT', vatIncluded: false }
      ] }];
    state.files = []; state.payLog = []; state.asLog = []; state.activeProject = N;
  }, N);

  await test('② 공사 스토리 계약 줄: 부가세·공사기간을 기록 값 그대로 한 번, 없으면 안 적는다', async () => {
    await seedCt();
    const r = await page.evaluate((N) => ({ t: hjStoryData(N).map(e => e.t), text: hjStoryText(N) }), N);
    const old = r.t.find(x => /MM-OLD-1/.test(x) && /전자계약/.test(x)) || '';
    const inc = r.t.find(x => /MM-VIN-2/.test(x) && /전자계약/.test(x)) || '';
    const exc = r.t.find(x => /MM-VEX-3/.test(x) && /전자계약/.test(x)) || '';
    const done = r.t.find(x => /고객 서명 완료 MM-VIN-2/.test(x)) || '';
    assert(old === '전자계약 MM-OLD-1 1,100,000원 발송', '옛 계약 줄(값 없음)은 그대로: ' + old);
    assert(inc === '전자계약 MM-VIN-2 2,200,000원 (부가세 포함) — 서명 완료 · 공사기간 2026-10-05 ~ 2026-10-09', '포함·기간: ' + inc);
    assert(exc === '전자계약 MM-VEX-3 3,300,000원 (부가세 별도) 발송', '별도·기간 없음: ' + exc);
    assert(done && !/부가세|공사기간/.test(done), '서명 완료 줄에는 다시 적지 않는다: ' + done);
    assert((r.text.match(/부가세 포함/g) || []).length === 1 && (r.text.match(/공사기간/g) || []).length === 1, '카톡 글에 한 번씩: ' + r.text);
  });

  await test('② 카톡 카드 서명 내역: 부가세·공사기간을 기록 값 그대로, 없으면 안 적는다', async () => {
    const rows = await page.evaluate((N) => {
      const box = document.createElement('div'); box.innerHTML = hjKakaoCard(state.projects.find(p => p.name === N));
      return [...box.querySelectorAll('[data-ctrow]')].map(d => d.textContent.replace(/\s+/g, ' ').trim());
    }, N);
    const old = rows.find(x => /MM-OLD-1/.test(x)) || '', inc = rows.find(x => /MM-VIN-2/.test(x)) || '', exc = rows.find(x => /MM-VEX-3/.test(x)) || '';
    assert(rows.length === 3, '계약 줄 3개: ' + JSON.stringify(rows));
    assert(!/부가세|공사기간/.test(old), '옛 계약 줄에 지어낸 값: ' + old);
    assert(/2,200,000원 \(부가세 포함\)/.test(inc) && /공사기간 2026-10-05 ~ 2026-10-09/.test(inc), '포함·기간: ' + inc);
    assert(/3,300,000원 \(부가세 별도\)/.test(exc) && !/공사기간/.test(exc), '별도·기간 없음: ' + exc);
    // 기록 값은 escape 된다(수입 자료에 꺾쇠가 섞여도 카드가 깨지지 않게)
    const x = await page.evaluate((N) => { const p = state.projects.find(q => q.name === N); p.contractLog[2].period = '<b>x</b>'; return hjKakaoCard(p); }, N);
    assert(x.indexOf('<b>x</b>') < 0 && x.indexOf('&lt;b&gt;x&lt;/b&gt;') >= 0, '공사기간 escape');
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
