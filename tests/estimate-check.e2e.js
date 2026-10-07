/* estimate-check.e2e.js — v333 견적 인식값 검증 (Playwright, 가짜 자료만)
   지키는 것:
   ① parseEstimate 가 금액을 어디서 잡았는지(amountFrom) 남기고, hjEstCheck 가
      공급가+부가세≠합계(±10원 허용)·부가세 10% 아님·본문 최대 숫자 폴백·범위 밖·전화/사업자번호/날짜 오인을 사람 말로 잡는다
   ② 견적 목록에 '⚠ 원본 확인 필요' 배지·이유·머리 한 줄, 공급가·부가세 칸(앱 견적은 읽기 전용), 확인 필요만 보기
   ③ 첫 화면 한 줄 + 바로가기
   ④ 원본 보기 모달에서 고치고 [✓ 원본과 맞음 — 확정] → verifiedAt(localStamp)·verifiedBy, 확정 뒤 값을 바꾸면 확정 해제
   ⑤ 돈 계산은 그대로 — 확인 필요 견적도 매출(hjSalesEntries)에 같은 금액으로 들어간다
   ⑥ 재인식(runBatchOCR)·엑셀 자동 보정(fixXlsxEstVat)이 확정값을 덮지 않는다
   실발신·네트워크 없음. 사업자번호·전화는 자기서술형이 아닌 숫자 형식이 필요해 000/010-0000 류 가짜만 쓴다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e).slice(0, 900)); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => new URL(r.request().url()).origin === ORIGIN ? r.continue() : r.abort());
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다(AGENTS 검사 도구 함정)
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
  });

  // ---------- ① 순수 판정 ----------
  const codes = (text, est) => page.evaluate(([t, e]) => {
    const est = e || parseEstimate(t, '가상 견적.pdf');
    return { est, codes: hjEstCheck(est, t).issues.map(x => x.code), msgs: hjEstCheck(est, t).issues.map(x => x.msg) };
  }, [text, est]);

  await test('① 공급가+부가세≠합계 → sum (이유에 차이 금액)', async () => {
    const r = await codes('공급가액 1,000,000\n부가세 100,000\n합계 1,200,000');
    assert.equal(r.est.amount, 1200000); assert.equal(r.est.amountFrom, 'sum');
    assert.ok(r.codes.includes('sum'), JSON.stringify(r.codes));
    assert.ok(r.msgs.some(m => /100,000원 차이/.test(m)), JSON.stringify(r.msgs));
  });
  await test('① 맞는 견적은 문제 없음, 원 단위 반올림(±10원)은 허용', async () => {
    let r = await codes('공급가액 1,000,000\n부가세 100,000\n합계 1,100,000');
    assert.deepEqual(r.codes, []);
    r = await codes('', { amount: 1100000, supply: 1000003, vat: 100000 });
    assert.deepEqual(r.codes, []);
    r = await codes('', { amount: 1100000, supply: 999989, vat: 100000 });   // 11원 차이는 잡는다
    assert.ok(r.codes.includes('sum'), JSON.stringify(r.codes));
  });
  await test('① 부가세가 공급가의 10% 가 아니면 vat10 (합계는 맞아도)', async () => {
    const r = await codes('공급가액 1,000,000\n부가세 150,000\n합계 1,150,000');
    assert.deepEqual(r.codes, ['vat10']);
    assert.ok(/15%/.test(r.msgs[0]), r.msgs[0]);
    const r2 = await codes('', { amount: 1100000, vat: 300000 });   // 공급가 없음: 포함·별도 어느 쪽도 아님
    assert.deepEqual(r2.codes, ['vat10']);
    const r3 = await codes('', { amount: 1100000, vat: 100000 });
    assert.deepEqual(r3.codes, []);
  });
  await test('① 합계 줄이 없으면 본문 최대 숫자 폴백 → fallback', async () => {
    const r = await codes('견적서\n도배 공사 3,500,000\n장판 1,200,000');
    assert.equal(r.est.amount, 3500000); assert.equal(r.est.amountFrom, 'max');
    assert.deepEqual(r.codes, ['fallback']);
    const r2 = await codes('견적서 내용 없음', null);
    assert.ok(r2.codes.includes('noamount'), JSON.stringify(r2.codes));
  });
  await test('① 전화·사업자번호·날짜를 금액으로 읽은 꼴(본문에 그 번호가 있을 때만), 범위 밖', async () => {
    let r = await codes('대표 010-1234-5678', { amount: 1000000000 + 12345678 });   // 010-1234-5678 의 앞 0 이 빠진 꼴
    assert.ok(r.codes.includes('misread') && r.codes.includes('range'), JSON.stringify(r.codes));
    assert.ok(r.msgs.some(m => /전화번호\(…5678\)/.test(m)), JSON.stringify(r.msgs));
    r = await codes('TEL 042-000-1234\n합계 420001234', { amount: 420001234, amountFrom: 'sum' });
    assert.deepEqual(r.codes, ['misread']); assert.ok(/전화번호\(…1234\)/.test(r.msgs[0]), r.msgs[0]);
    r = await codes('견적일 2026.03.16', { amount: 20260316 });
    assert.deepEqual(r.codes, ['misread']); assert.ok(/날짜\(2026-03-16\)/.test(r.msgs[0]), r.msgs[0]);
    r = await codes('', { amount: 1230000000, bizno: '123-00-00000' });   // 가짜 사업자번호의 숫자 = 금액
    assert.ok(r.codes.includes('misread'), JSON.stringify(r.codes));
    r = await codes('', { amount: 5000 });
    assert.deepEqual(r.codes, ['range']);
  });
  await test('① 숫자 모양만으로는 오인이라 하지 않는다 — 1억·1.1억·1.8억·20,250,520원(검토 v333)', async () => {
    for (const e of [{ amount: 110000000, supply: 100000000, vat: 10000000 }, { amount: 100000000, supply: 90909091, vat: 9090909 },
      { amount: 180000000, supply: 0, vat: 0 }, { amount: 20250520 }]) {
      const r = await codes('공급가액 ' + e.supply + '\n합계 ' + e.amount + '\n견적일 2025-06-01', Object.assign({ amountFrom: 'sum' }, e));
      assert.deepEqual(r.codes, [], JSON.stringify([e, r.msgs]));
    }
  });

  // ---------- 화면 시드 ----------
  const seed = () => page.evaluate(() => {
    const P = '가상 현장';
    state.projects = [{ name: P, stage: 2, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false }];
    state.quotes = []; state.schedule = []; state.payLog = []; state.expenses = [];
    const t1 = '공급가액 1,000,000\n부가세 100,000\n합계 1,200,000';
    const t2 = '견적서\n도배 공사 3,500,000\n장판 1,200,000';
    const mk = (id, name, text, extra) => Object.assign({ id, name, ext: 'pdf', kind: 'estimate', prefix: '가상/', project: P, text, ocr: 'done',
      est: parseEstimate(text, name), when: new Date('2026-09-01T00:00:00') }, extra || {});
    state.files = [
      mk('bad-sum', '가상 합계틀림 견적.pdf', t1),
      mk('bad-max', '가상 폴백 견적.png', t2, { ext: 'png' }),
      mk('good', '가상 정상 견적.pdf', '공급가액 2,000,000\n부가세 200,000\n합계 2,200,000'),
      mk('excl', '가상 제외 견적.pdf', t1, { exSum: true }),
      // 같은 견적의 엑셀(대표, 맞음) + PDF 사본(인식 틀림) — 사본은 매출에 안 들어가므로 '합계에 그대로'라고 세지 않는다
      { id: 'copy-x', name: '가상 욕실 견적.xlsx', ext: 'xlsx', kind: 'estimate', prefix: '가상/', project: P, when: new Date('2026-09-02T00:00:00'),
        est: { amount: 3300000, supply: 3000000, vat: 300000, amountFrom: 'sum' } },
      mk('copy-pdf', '가상 욕실 견적서.pdf', t1),
      // 앱 견적(가상 파일): 값이 어긋나 보여도 검사하지 않고 칸은 읽기 전용
      { id: 'quote_q1', name: '가상 앱 견적.pdf', ext: 'pdf', kind: 'estimate', project: P, _fromQuote: true, _virtual: true,
        est: { amount: 999, supply: 5, vat: 7, customer: '가상', date: '2026-09-01' } },
    ];
    state.files.forEach(f => { if (f.est) f.est.date = f.est.date || '2026-09-01'; });
    __estimateListUI = { search: '', status: 'all', sort: 'original' };
    state.tab = 'estimates'; render();
  });
  await seed();

  await test('② 목록: 확인 필요 배지·이유·머리 한 줄(집계 제외·앱 견적은 안 셈)', async () => {
    const r = await page.evaluate(() => ({
      head: document.getElementById('estCheckHead')?.textContent || '',
      flagged: [...document.querySelectorAll('tr[data-needcheck]')].map(e => e.dataset.id),
      badge: document.querySelector('tr[data-id="bad-sum"] .est-check-warn')?.textContent || '',
      issue: document.querySelector('tr[data-id="bad-sum"] .est-issues')?.textContent || '',
      issueMax: document.querySelector('tr[data-id="bad-max"] .est-issues')?.textContent || '',
      goodBadge: !!document.querySelector('tr[data-id="good"] .est-check-warn'),
      quoteBadge: !!document.querySelector('tr[data-id="quote_q1"] .est-check-warn'),
    }));
    assert.ok(/원본 확인 필요\s*2건/.test(r.head), r.head);
    assert.ok(/매출·청구 합계에 그대로/.test(r.head), r.head);
    assert.ok(/합계 밖 1건/.test(r.head), r.head);   // 사본(copy-pdf)은 따로 센다
    assert.deepEqual(r.flagged.sort(), ['bad-max', 'bad-sum', 'copy-pdf', 'excl'].sort());   // 집계 제외·사본도 행 배지는 단다(매출 반영으로 세는 건 2건)
    const sp = await page.evaluate(() => { const x = hjEstNeedsCheckSplit(); return { s: x.sales.map(f => f.id).sort(), o: x.other.map(f => f.id) }; });
    assert.deepEqual(sp, { s: ['bad-max', 'bad-sum'], o: ['copy-pdf'] });
    assert.ok(/원본 확인 필요/.test(r.badge));
    assert.ok(/100,000원 차이/.test(r.issue), r.issue);
    assert.ok(/가장 큰 숫자/.test(r.issueMax), r.issueMax);
    assert.equal(r.goodBadge, false); assert.equal(r.quoteBadge, false);
  });

  await test('② 공급가·부가세 칸이 있고 앱 견적은 읽기 전용', async () => {
    const r = await page.evaluate(() => ({
      sup: !!document.querySelector('input[data-ef="supply"][data-id="bad-sum"]'),
      vat: !!document.querySelector('input[data-ef="vat"][data-id="bad-sum"]'),
      supRo: document.querySelector('input[data-ef="supply"][data-id="quote_q1"]')?.readOnly,
      vatRo: document.querySelector('input[data-ef="vat"][data-id="quote_q1"]')?.readOnly,
    }));
    assert.ok(r.sup && r.vat, JSON.stringify(r)); assert.equal(r.supRo, true); assert.equal(r.vatRo, true);
  });

  await test('⑤ 확인 필요 견적도 매출엔 그대로(돈 계산 불변)', async () => {
    const r = await page.evaluate(() => ({ est: projStats('가상 현장').est, sales: hjSalesEntries().filter(x => x.file && !x.file._fromQuote).map(x => x.amount).sort() }));
    assert.ok(r.sales.includes(1200000) && r.sales.includes(3500000), JSON.stringify(r));
  });

  await test('② 확인 필요만 보기 필터', async () => {
    await page.selectOption('#estimateListStatus', 'needcheck');
    await page.waitForFunction(() => document.querySelectorAll('.estimates-list tbody tr[data-id]').length === 4);
    const ids = await page.evaluate(() => [...document.querySelectorAll('.estimates-list tbody tr[data-id]')].map(e => e.dataset.id).sort());
    assert.deepEqual(ids, ['bad-max', 'bad-sum', 'copy-pdf', 'excl']);
    await page.selectOption('#estimateListStatus', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.estimates-list tbody tr[data-id]').length === 7);
  });

  await test('③ 첫 화면 한 줄과 바로가기', async () => {
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    const line = page.locator('#dashboardEstCheck');
    await line.waitFor();
    const lt = await line.textContent();
    assert.ok(/원본 확인 필요\s*2건/.test(lt) && /합계 밖 1건/.test(lt), lt);
    const h = await page.locator('#dashboardEstCheckGo').evaluate(el => el.getBoundingClientRect().height);
    assert.ok(h >= 44, '버튼 높이 ' + h);
    await page.click('#dashboardEstCheckGo');
    await page.waitForFunction(() => state.tab === 'estimates' && __estimateListUI.status === 'needcheck');
    await page.waitForFunction(() => document.querySelectorAll('.estimates-list tbody tr[data-id]').length === 4);
    await page.evaluate(() => { __estimateListUI.status = 'all'; render(); });
  });

  await test('② 사본만 남으면 \'합계에는 들어가지 않는다\'고 말한다', async () => {
    const r = await page.evaluate(() => {
      const keep = state.files; state.files = keep.filter(f => !['bad-sum', 'bad-max'].includes(f.id));
      const head = (render(), document.getElementById('estCheckHead')?.textContent || '');
      const dash = dashboardEstCheckHTML();
      state.files = keep; render(); return { head, dash };
    });
    assert.ok(/1건\s*— 사본 등이라 매출·청구 합계에는 들어가지 않습니다/.test(r.head), r.head);
    assert.ok(!/그대로 들어가/.test(r.head) && !/그대로 들어가/.test(r.dash), r.dash);
    // 이 뒤 시나리오는 사본 없이 — 0건 머리 줄 사라짐을 본다
    await page.evaluate(() => { state.files = state.files.filter(f => !['copy-x', 'copy-pdf'].includes(f.id)); render(); });
  });

  await test('② 원본을 볼 수 없는 견적(드라이브 ID 없는 가상 파일)은 [원본 보기 · 확정] 대신 안내', async () => {
    const r = await page.evaluate(() => {
      state.files.push({ id: 'virt', name: '가상 원본없음 견적.pdf', ext: 'pdf', kind: 'estimate', project: '가상 현장', _virtual: true, text: '',
        est: { amount: 3000000, supply: 1000000, vat: 100000, date: '2026-09-01' } });
      render();
      const out = { btn: !!document.querySelector('tr[data-id="virt"] [data-estcheck]'), note: document.querySelector('tr[data-id="virt"] .est-noorig')?.textContent || '',
        badBtn: !!document.querySelector('tr[data-id="bad-sum"] [data-estcheck]') };
      state.files = state.files.filter(f => f.id !== 'virt'); render(); return out;
    });
    assert.equal(r.btn, false); assert.ok(/원본 파일 없음/.test(r.note), r.note); assert.equal(r.badBtn, true);
  });

  await test('② 목록에서 합계를 고치면 확인 필요가 풀린다(✎ 수정됨)', async () => {
    await page.evaluate(() => { document.querySelector('details[data-estimate-details="bad-sum"]').open = true; });
    const inp = page.locator('input[data-ef="amount"][data-id="bad-sum"]');
    await inp.fill('1,100,000'); await inp.dispatchEvent('change');
    await page.waitForFunction(() => !document.querySelector('tr[data-id="bad-sum"][data-needcheck]'));
    const r = await page.evaluate(() => ({ e: state.files.find(f => f.id === 'bad-sum').est, head: document.getElementById('estCheckHead')?.textContent || '' }));
    assert.equal(r.e.amount, 1100000); assert.equal(r.e._edited, true);
    assert.ok(/1건/.test(r.head), r.head);
  });

  // 원본 그림: 1×1 PNG 를 원본 파일로 돌려준다(가짜 — 실제 파일 없음)
  await page.evaluate(() => {
    const b = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0));
    window.__pvOrigGet = getFileOf;
    getFileOf = async f => (f && f.id === 'bad-max') ? new File([b], 'x.png', { type: 'image/png' }) : null;
  });

  await test('④ 원본을 못 띄우면 [원본 없이 확정…] — 묻고, 취소하면 확정 안 함(검토 v333)', async () => {
    await page.evaluate(() => previewEstimate('bad-sum'));   // 원본(가짜 파일) 없음 — getFileOf 가 null
    await page.locator('#modalRoot .modal').waitFor();
    const btn = page.locator('#modalRoot .pv-est-confirm');
    await page.waitForFunction(() => /원본 없이 확정/.test(document.querySelector('#modalRoot .pv-est-confirm')?.textContent || ''));
    assert.ok(/원본 파일을 찾을 수 없습니다/.test(await page.locator('#pvCanvas').textContent()));
    let asked = '';
    page.once('dialog', d => { asked = d.message(); d.dismiss(); });
    await btn.click();
    assert.ok(/원본 없이 확정할까요/.test(asked), asked);
    assert.equal(await page.evaluate(() => !!state.files.find(f => f.id === 'bad-sum').est.verifiedAt), false);
    assert.ok(await page.locator('#modalRoot .modal').count() === 1, '취소하면 창은 그대로');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
  });

  await test('④ 원본 보기 모달 → 고치고 확정 → verifiedAt/By, 배지 ✓', async () => {
    await page.click('tr[data-id="bad-max"] [data-estcheck]');
    await page.locator('#modalRoot .modal').waitFor();
    await page.waitForFunction(() => (document.querySelector('#modalRoot .pv-est-confirm')?.textContent || '') === '✓ 원본과 맞음 — 확정');
    assert.ok(await page.locator('#pvCanvas img.pv-img').count() === 1);
    const warn = await page.locator('#pvEstCheck').textContent();
    assert.ok(/원본 확인 필요/.test(warn) && /가장 큰 숫자/.test(warn), warn);
    // 공급가 칸을 고쳐도 change 가 안 난 채(키보드 '완료'·자동완성 등) 확정 버튼이 반영한다 — 값만 넣고 이벤트는 쏘지 않는다
    await page.evaluate(() => { document.getElementById('pvEst_supply').value = '3,181,818'; });
    await page.getByRole('button', { name: '✓ 원본과 맞음 — 확정' }).click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    const r = await page.evaluate(() => ({ e: state.files.find(f => f.id === 'bad-max').est, ok: hjEstFileCheck(state.files.find(f => f.id === 'bad-max')),
      badge: document.querySelector('tr[data-id="bad-max"] .est-check-ok')?.textContent || '', flagged: !!document.querySelector('tr[data-id="bad-max"][data-needcheck]'),
      head: !!document.getElementById('estCheckHead') }));
    assert.equal(r.e.supply, 3181818);
    assert.match(r.e.verifiedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.ok(typeof r.e.verifiedBy === 'string' && r.e.verifiedBy.length > 0, r.e.verifiedBy);
    assert.equal(r.ok.verified, true); assert.equal(r.ok.needsCheck, false);
    assert.ok(/원본 확인됨/.test(r.badge), r.badge); assert.equal(r.flagged, false);
    assert.equal(r.head, false, '확인 필요 0건이면 머리 줄이 사라진다');
    const d = await page.evaluate(() => { state.tab = 'dashboard'; render(); return !!document.getElementById('dashboardEstCheck'); });
    assert.equal(d, false, '0건이면 첫 화면 줄도 없다');
    await page.evaluate(() => { state.tab = 'estimates'; render(); });
  });

  await test('④ 확정 뒤 값을 바꾸면 확정 해제', async () => {
    await page.evaluate(() => { document.querySelector('details[data-estimate-details="bad-max"]').open = true; });
    const inp = page.locator('input[data-ef="vat"][data-id="bad-max"]');
    await inp.fill('1'); await inp.dispatchEvent('change');
    await page.waitForFunction(() => !!document.querySelector('tr[data-id="bad-max"][data-needcheck]'));
    const e = await page.evaluate(() => state.files.find(f => f.id === 'bad-max').est);
    assert.equal(e.verifiedAt, undefined); assert.equal(e.verifiedBy, undefined);
    // 다른 경로(AI 등)로 금액만 바뀌어도 서명(verifiedSig)이 어긋나 확정으로 보지 않는다
    const v = await page.evaluate(() => { const e = { amount: 1100000, supply: 1000000, vat: 100000, amountFrom: 'max' }; hjEstVerify(e, '가상'); const a = hjEstCheck(e).verified; e.amount = 1200000; return [a, hjEstCheck(e).verified]; });
    assert.deepEqual(v, [true, false]);
    // 사람이 금액을 적으면 '가장 큰 숫자로 잡았다'는 이유는 사라진다(amountFrom='hand')
    const amt = page.locator('input[data-ef="amount"][data-id="bad-max"]');
    await amt.fill('3,500,000'); await amt.dispatchEvent('change');
    await page.waitForFunction(() => state.files.find(f => f.id === 'bad-max').est.amountFrom === 'hand');
    const c = await page.evaluate(() => hjEstFileCheck(state.files.find(f => f.id === 'bad-max')).issues.map(x => x.code));
    assert.ok(!c.includes('fallback'), JSON.stringify(c));
  });

  await test('④ 모달에서 친 값은 Esc 로 닫아도 반영되고 목록이 다시 그려진다', async () => {
    await page.evaluate(() => { state.files.find(f => f.id === 'bad-max').est.amountFrom = 'max'; previewEstimate('bad-max'); });
    await page.locator('#pvEst_vat').waitFor();
    // input 이벤트만 — 칸에 초점이 없어 닫힐 때 change(blur) 도 안 난다(Safari 처럼). 닫힘 훅만이 반영할 수 있다
    await page.evaluate(() => { for (const [id, v] of [['pvEst_vat', '318,182'], ['pvEst_amount', '3,500,001']]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); } document.querySelector('#modalRoot .modal').focus(); });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    const r = await page.evaluate(() => state.files.find(f => f.id === 'bad-max').est);
    assert.equal(r.vat, 318182); assert.equal(r.amount, 3500001);
    assert.equal(r.amountFrom, 'hand', '모달에서 적은 금액도 사람이 적은 값');
    await page.waitForFunction(() => document.querySelector('input[data-ef="vat"][data-id="bad-max"]')?.value === '318,182');
    await page.evaluate(() => { const e = state.files.find(f => f.id === 'bad-max').est; e.amount = 3500000; render(); });
  });

  await test('④ 모달에서 확정된 값을 고쳐도 확정 해제', async () => {
    await page.evaluate(() => { const f = state.files.find(x => x.id === 'good'); hjEstVerify(f.est, '가상'); render(); });
    await page.evaluate(() => previewEstimate('good'));
    await page.locator('#pvEstCheck .pv-check-ok').waitFor();
    await page.fill('#pvEst_vat', '210,000'); await page.locator('#pvEst_vat').dispatchEvent('change');
    await page.waitForFunction(() => !state.files.find(f => f.id === 'good').est.verifiedAt);
    const r = await page.evaluate(() => ({ e: state.files.find(f => f.id === 'good').est, warn: document.querySelector('#pvEstCheck')?.textContent || '' }));
    assert.equal(r.e.vat, 210000); assert.equal(r.e._edited, true); assert.ok(/원본 확인 필요/.test(r.warn), r.warn);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    await page.waitForFunction(() => !!document.querySelector('tr[data-id="good"][data-needcheck]'));   // 닫으면 목록 배지도 갱신
  });

  await test('⑥ 재인식(runBatchOCR)은 확정값·수기값을 덮지 않고, 그 밖은 다시 읽는다', async () => {
    const r = await page.evaluate(async () => {
      const P = '가상 현장';
      const mk = (id, est) => ({ id, name: id + '.pdf', ext: 'pdf', kind: 'estimate', prefix: '가상/', project: P, ocr: 'pending', text: '', est });
      const ver = { amount: 1100000, supply: 1000000, vat: 100000, amountFrom: 'max' }; hjEstVerify(ver, '가상');
      state.files = [mk('ver', ver), mk('edit', { amount: 777777, _edited: true }), mk('plain', { amount: 5555555 })];
      pdfText = async () => '공급가액 3,000,000\n부가세 300,000\n합계 3,300,000';
      await runBatchOCR();
      const g = id => state.files.find(f => f.id === id).est;
      return { ver: g('ver'), edit: g('edit').amount, plain: g('plain').amount, verOk: hjEstCheck(g('ver')).verified };
    });
    assert.equal(r.ver.amount, 1100000); assert.equal(r.verOk, true);
    assert.equal(r.edit, 777777);
    assert.equal(r.plain, 3300000, '확정 안 한 자동 값은 다시 읽어야 한다');
  });

  await test('⑥ 엑셀 자동 보정(fixXlsxEstVat)도 확정값은 건드리지 않는다', async () => {
    const r = await page.evaluate(() => {
      const mk = (id, verified) => {
        const q = { vatIncluded: true, items: [{ name: '도배', qty: 1, price: 1000000 }, { name: '', qty: 1, price: 1100000 }] };
        const est = { amount: 2310000, supply: 2100000, vat: 210000, _fromXlsx: true };
        if (verified) hjEstVerify(est, '가상');
        return { id, name: id + '.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상 현장', quote: q, est };
      };
      state.files = [mk('xv', true), mk('xn', false)];
      const n = fixXlsxEstVat();
      return { n, xv: state.files[0].est.amount, xn: state.files[1].est.amount };
    });
    assert.equal(r.n, 1); assert.equal(r.xv, 2310000); assert.notEqual(r.xn, 2310000);
  });

  await test('페이지 오류 없음', async () => { assert.deepEqual(errs, []); });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length}개 중 ${results.length - bad.length} 통과`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
