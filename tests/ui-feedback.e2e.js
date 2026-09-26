/* ui-feedback.e2e.js — 폰에서 '무슨 일이 일어났는지 모르는' 곳 네 가지 (Playwright)

   2026-09-26: 화면이 반응은 하는데 사람이 알아채지 못하는 자리들을 막는다.
     ① AI 운영 비서 시트(#aiSheet, display 토글)는 dialog 의미·✕ 접근 이름·뒤 화면 스크롤 잠금을 갖고,
        Esc·뒤로가기로 닫히면 연 버튼으로 초점이 돌아온다. 이미 열린 채 다시 불러도 뒤로가기 항목은 하나다.
     ② 자료가 없으면 숫자를 그리지 않는다 — funnelView 는 '0%·견적 0건 중 0건' 대신 빈 안내,
        cashFlow 는 '안정적' 단정 대신 '예측할 자료가 없습니다'. 자료가 있으면 원래 숫자가 나온다.
     ③ 검증 오류는 그 칸에 붙는다(hjFieldIssue) — 초점 이동·aria-invalid·칸 아래 role=alert·입력하면 풀림.
        AS 증상 · 아파트 오더(동/호·작업·금액) · 거래처 이름 · 자재 이름(단가표·재고) · 수금(입금액·미래 입금일) · 노하우.
        토스트도 그대로 뜨고, 거부된 입력은 장부를 바꾸지 않는다(recv-entry 불변식).
     ④ #toast 는 role=status·aria-live=polite, 띄우는 시간은 2400ms + 글자당 40ms, 상한 6000ms.

   전제: tests/static-server.js(8299) 실행 중 */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {}
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone].filter(Boolean));
    // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다
    try { taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false; } catch (e) {}
    const P = (name, extra = {}) => ({ name, archived: false, stage: 2, received: 0, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, ...extra });
    state.projects = [P('가상점검현장 A'), P('가상점검현장 B', { stage: 1 })];
    state.files = []; state.quotes = []; state.schedule = []; state.payLog = []; state.asLog = [];
    state.activeProject = null; state.tab = 'dashboard';
    __mobileMode = true; applyMobileMode(); render();
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const noSheetHistory = () => page.waitForFunction(() => !__mobileSheetHistoryRetire && !(history.state && history.state.__hjMobileSheet));

  // ─────────────────────────── ①
  await test('① AI 비서 시트 — dialog·✕ 이름·잠금, Esc 로 닫고 연 버튼으로 초점', async () => {
    await noSheetHistory();
    const opener = page.locator('.ai-dashrow button[onclick="aiAgent()"]').first();
    await opener.focus(); await opener.click();
    await page.waitForFunction(() => { const el = document.getElementById('aiSheet'); return el && el.style.display !== 'none'; });
    const o = await page.evaluate(() => {
      const el = document.getElementById('aiSheet');
      return { role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), lb: el.getAttribute('aria-labelledby'),
        title: (document.getElementById(el.getAttribute('aria-labelledby') || '-') || {}).textContent || '',
        x: document.getElementById('aiCloseBtn').getAttribute('aria-label') || '',
        lock: getComputedStyle(document.body).overflow };
    });
    assert(o.role === 'dialog' && o.modal === 'true' && /AI 운영 비서/.test(o.title), 'dialog 의미가 없다: ' + JSON.stringify(o));
    assert(/닫기/.test(o.x), '✕ 에 접근 이름이 없다');
    assert(o.lock === 'hidden', '뒤 화면이 스크롤된다: overflow=' + o.lock);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('aiSheet').style.display === 'none');
    await page.waitForFunction(() => document.activeElement && document.activeElement.matches('.ai-dashrow button[onclick="aiAgent()"]'));
    const lock = await page.evaluate(() => getComputedStyle(document.body).overflow);
    assert(lock !== 'hidden', '닫은 뒤에도 스크롤이 잠겨 있다');
  });

  await test('① 열린 채 다시 불러도 뒤로가기 한 번이면 닫힌다(앱을 떠나지 않는다)', async () => {
    await noSheetHistory();
    const len0 = await page.evaluate(() => history.length);
    await page.locator('.ai-dashrow button[onclick="aiAgent()"]').first().click();
    await page.waitForFunction(() => history.state && history.state.__hjMobileSheet);
    await page.evaluate(() => { aiAgent(); aiAgent('오늘 브리핑'); });
    const len1 = await page.evaluate(() => history.length);
    assert(len1 - len0 <= 1, '다시 열 때마다 뒤로가기 항목이 쌓인다: ' + (len1 - len0));
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => document.getElementById('aiSheet').style.display === 'none');
    assert(/index\.html/.test(page.url()), '뒤로가기로 앱을 떠났다: ' + page.url());
    await noSheetHistory();
    // 열린 채 다시 불러도(초점은 시트 안 입력칸) 처음 연 버튼을 기억한다
    await page.locator('.ai-dashrow button[onclick="aiAgent()"]').first().focus();
    await page.locator('.ai-dashrow button[onclick="aiAgent()"]').first().click();
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'aiInput');
    await page.evaluate(() => aiAgent());
    await page.click('#aiCloseBtn');
    await page.waitForFunction(() => document.activeElement && document.activeElement.matches('.ai-dashrow button[onclick="aiAgent()"]'));
    await noSheetHistory();
  });

  // ─────────────────────────── ②
  await test('② 전환율 퍼널 — 자료가 없으면 0% 대신 빈 안내, 있으면 숫자', async () => {
    const empty = await page.evaluate(() => {
      const keep = state.projects; state.projects = []; state.quotes = [];
      funnelView();
      const root = document.getElementById('modalRoot'); const t = root.textContent || '';
      const r = { t, empties: root.querySelectorAll('.empty').length }; closeModal(); state.projects = keep; return r;
    });
    assert(/현장을 등록하면 단계별 전환율이 여기 생깁니다/.test(empty.t), '현장 0 인데 빈 안내가 없다');
    assert(!/0%/.test(empty.t) && !/견적 0건 중 0건/.test(empty.t) && !/0곳/.test(empty.t), '자료 0 인데 0% ·0건·0곳을 그린다: ' + empty.t.slice(0, 200));
    assert(empty.empties >= 1, '.empty 안내 톤이 아니다');
    const full = await page.evaluate(() => {
      state.quotes = [{ id: 'q1', no: 'Q-1', title: '가상 견적', project: '가상점검현장 A', items: [] }, { id: 'q2', no: 'Q-2', title: '가상 견적2', items: [] }];
      funnelView();
      const t = document.getElementById('modalRoot').textContent || ''; closeModal(); state.quotes = []; return t;
    });
    assert(/50%/.test(full) && /견적 2건 중 1건 계약/.test(full) && /2곳/.test(full), '자료가 있는데 숫자가 안 나온다: ' + full.slice(0, 200));
    assert(!/현장을 등록하면/.test(full), '자료가 있는데 빈 안내가 뜬다');
  });

  await test('② 현금 흐름 — 자료 0 이면 "예측할 자료가 없습니다", 안정 단정 금지', async () => {
    const empty = await page.evaluate(() => {
      const r = cashFlow(); const t = document.getElementById('modalRoot').textContent || ''; closeModal(); return { t, r };
    });
    assert(/예측할 자료가 없습니다/.test(empty.t), '자료 0 인데 빈 안내가 없다');
    assert(!/안정/.test(empty.t), '자료 0 인데 안정적이라고 단정한다');
    assert(!/이번 주/.test(empty.t), '자료 0 인데 0원 주간 줄을 그린다');
    // 나갈 돈만(일정 인원) — 누적이 마이너스라 경고가 뜬다
    const out = await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() + 1);
      state.schedule = [{ id: 'sc-ui-1', date: localDate(d), title: '가상 작업', project: '가상점검현장 A', workers: 2 }];
      const r = cashFlow(); const t = document.getElementById('modalRoot').textContent || ''; closeModal(); state.schedule = []; return { t, r };
    });
    assert(out.r.나갈돈 > 0 && /이번 주/.test(out.t) && !/예측할 자료가 없습니다/.test(out.t), '자료가 있는데 주간 줄이 없다: ' + JSON.stringify(out.r));
    // 들어올 돈(견적 파일 + 완료 단계) — 마이너스가 아니어도 '안정적으로 예상' 이라고 단정하지 않는다
    const inn = await page.evaluate(() => {
      const p = state.projects[0]; const keepStage = p.stage; p.stage = 3;
      state.files = [{ id: 'f-ui-1', name: '가상견적.xlsx', path: '가상견적.xlsx', project: p.name, kind: 'estimate', est: { amount: 1000000 } }];
      const r = cashFlow(); const t = document.getElementById('modalRoot').textContent || ''; closeModal();
      p.stage = keepStage; state.files = []; return { t, r };
    });
    assert(inn.r.들어올돈 > 0, '시드가 들어올 돈을 만들지 못했다 — 검사가 아무것도 지키지 않는다: ' + JSON.stringify(inn.r));
    assert(/이번 주/.test(inn.t) && !/안정적으로 예상됩니다/.test(inn.t) && /마이너스로 내려가지 않습니다/.test(inn.t), '자료가 있을 때 문구가 다르다: ' + inn.t.slice(0, 300));
  });

  // ─────────────────────────── ③
  // 칸 검사: 초점·aria-invalid·describedby 로 이어진 role=alert(칸 아래)·입력하면 풀림
  async function fieldCheck(label, sel, msgRe, fix) {
    const r = await page.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return { missing: true };
      const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/);
      const sp = ids.map(id => document.getElementById(id)).find(x => x && x.classList.contains('field-issue'));
      const er = el.getBoundingClientRect(), sr = sp && sp.getBoundingClientRect();
      return { focused: document.activeElement === el, invalid: el.getAttribute('aria-invalid'),
        alert: sp && sp.getAttribute('role'), text: sp && sp.textContent, visible: !!(sr && sr.height > 0),
        below: !!(sr && sr.top >= er.bottom - 1) };
    }, sel);
    assert(!r.missing, label + ': 칸이 없다 ' + sel);
    assert(r.focused, label + ': 초점이 그 칸으로 가지 않았다');
    assert(r.invalid === 'true', label + ': aria-invalid 가 없다');
    assert(r.alert === 'alert' && msgRe.test(r.text || '') && r.visible && r.below, label + ': 칸 아래 안내가 없다 ' + JSON.stringify(r));
    await page.locator(sel).focus();
    if (fix === 'date') await page.evaluate((sel) => { const el = document.querySelector(sel); el.value = localDate(); el.dispatchEvent(new Event('change', { bubbles: true })); }, sel);
    else await page.keyboard.type(fix);
    const cleared = await page.evaluate((sel) => { const el = document.querySelector(sel); return { inv: el.getAttribute('aria-invalid'), left: document.querySelectorAll('#modalRoot .field-issue').length, db: el.getAttribute('aria-describedby') }; }, sel);
    assert(cleared.inv !== 'true' && cleared.left === 0 && !cleared.db, label + ': 입력해도 오류 표시가 안 풀린다 ' + JSON.stringify(cleared));
  }
  const clickFoot = (re) => page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => re.test(x.textContent || '')); if (!b) throw new Error('버튼 없음 ' + src); b.click(); }, re.source);

  await test('③ AS 접수 — 증상 칸', async () => {
    await page.evaluate(() => asManage());
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('modal')); // 모달이 여는 순간 거는 초점이 끝난 뒤 누른다
    await page.evaluate(() => document.getElementById('asmAdd').click());
    assert(/증상/.test(await lastToast()), '토스트가 사라졌다');
    await fieldCheck('AS 증상', '#asmText', /증상을 입력/, '가상 문 처짐');
    assert((await page.evaluate(() => (state.asLog || []).length)) === 0, '거부했는데 AS 가 접수됐다');
    await page.evaluate(() => closeModal());
  });

  await test('③ 아파트 오더 — 동/호·작업·금액 칸', async () => {
    await page.evaluate(() => {
      state.aptOffices = []; state.aptOrders = [];
      const answers = ['가상신흥마을아파트', '가상소장', '010-0000-1234'];
      const keep = window.prompt; window.prompt = () => answers.shift() || '';
      aptOrderManage(); document.getElementById('apoOffAdd').onclick(); window.prompt = keep;
    });
    await page.evaluate(() => document.getElementById('apoAdd').onclick());
    await fieldCheck('오더 동/호', '#apoUnit', /동\/호를 입력/, '103동 1204호');
    await page.evaluate(() => document.getElementById('apoAdd').onclick());
    await fieldCheck('오더 작업', '#apoText', /작업 내용을 입력/, '가상 실리콘 교체');
    await page.evaluate(() => document.getElementById('apoAdd').onclick());
    await fieldCheck('오더 금액', '#apoAmt', /1원 이상/, '80000');
    assert((await page.evaluate(() => (state.aptOrders || []).length)) === 0, '거부했는데 오더가 생겼다');
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 거래처 이름 칸', async () => {
    await page.evaluate(() => supplierEditDialog());
    await clickFoot(/^저장$/);
    assert(/거래처 이름/.test(await lastToast()), '토스트가 사라졌다');
    await fieldCheck('거래처 이름', '#supName', /거래처 이름을 입력/, '가상한밭철물');
    await page.evaluate(() => closeModal());
  });

  await test('③ 자재 이름 칸 — 단가표·재고 두 곳', async () => {
    await page.evaluate(() => materialEditDialog());
    await clickFoot(/^저장$/);
    await fieldCheck('자재(단가표) 이름', '#matName', /자재 이름을 입력/, '가상 실크 벽지');
    await page.evaluate(() => closeModal());
    await page.evaluate(() => inventoryAdd());
    await clickFoot(/^추가$/);
    await fieldCheck('자재(재고) 이름', '#invName', /자재 이름을 입력/, '가상 타일 본드');
    await page.evaluate(() => closeModal());
  });

  await test('③ 수금 입력 — 입금액·미래 입금일 칸, 거부하면 장부 그대로', async () => {
    await page.evaluate(() => recvQuickView('가상점검현장 A'));
    await page.waitForSelector('#rqAmt');
    await clickFoot(/입금 저장/);
    assert(/입금액/.test(await lastToast()), '토스트가 사라졌다');
    await fieldCheck('입금액', '#rqAmt', /입금액을 입력/, '500,000');
    await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); document.getElementById('rqDate').value = localDate(d); });
    await clickFoot(/입금 저장/);
    assert(/미래/.test(await lastToast()), '미래 입금일 토스트가 사라졌다');
    await fieldCheck('입금일', '#rqDate', /미래/, 'date');
    const led = await page.evaluate(() => ({ recv: state.projects[0].received, logs: (state.payLog || []).length }));
    assert(led.recv === 0 && led.logs === 0, '거부했는데 장부가 바뀌었다 ' + JSON.stringify(led));
    await page.evaluate(() => closeModal());
  });

  await test('③ 노하우 내용 칸', async () => {
    await page.evaluate(() => knowhowManage());
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('modal'));
    await page.evaluate(() => document.getElementById('khSave').click());
    await fieldCheck('노하우', '#khText', /노하우 내용을 입력/, '가상 배관 주의');
    await page.evaluate(() => closeModal());
  });

  // ─────────────────────────── ④
  await test('④ 토스트 — 읽어 주는 영역, 글자 수에 비례한 표시 시간(상한 6초)', async () => {
    const r = await page.evaluate(() => {
      const t = document.getElementById('toast');
      const delays = []; const st = window.setTimeout;
      window.setTimeout = function (fn, ms) { delays.push(ms); return st.apply(this, arguments); };
      try { toast(''); toast('가'.repeat(10)); toast('가'.repeat(50)); toast('가'.repeat(300)); } finally { window.setTimeout = st; }
      return { role: t.getAttribute('role'), live: t.getAttribute('aria-live'), delays };
    });
    assert(r.role === 'status' && r.live === 'polite', '토스트가 읽히지 않는다: ' + JSON.stringify(r));
    assert(JSON.stringify(r.delays) === JSON.stringify([2400, 2800, 4400, 6000]), '표시 시간이 글자 수를 안 따른다: ' + JSON.stringify(r.delays));
  });

  await test('★ pageerror 0', async () => { assert(errs.length === 0, 'pageerror: ' + errs.join(' | ')); });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
