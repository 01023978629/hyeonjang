/* v450 리허설 R2·R3 고침 — 합성 자료만. 견적 안 확정이 앱을 다시 켜도 남는다(q.exSum·q.tierLost) · 고르지 않은 안 = 종결(다른 안 확정, 수주율에서 뺌) ·
   다른 안을 🎉 수주로 바꾸면 그 안으로 다시 확정 · Σ 단추·편집기 저장과 같이 간다 · 견적 번호 같은 날 -2 · 입금 기록 결제 방법(간이영수증까지) ·
   방문은 잡았는데 답장 안 한 문의 줄 · 폰 첫 화면 앱 설치 줄 · 대기함 '올리는 중' 토스트(올릴 곳 없으면 안 띄움, 한 번만) ·
   창 닫기 경고(폴더 저장 전·기기 저장 전·사진 넣는 중만) · 욕실 상담 안내(전체 철거인데 철거·폐기물 빠짐 / 추정 단가 안내는 추정 단가 있을 때만·고객용 보기에서 숨김).
   HJ_V450_BASELINE=<commit> 은 REHEARSALFIX_API_PRESENT 에서, HJ_V450_MUTATION=tier-persist(syncQuoteToProject 가 견적 레코드의 exSum 을 따르지 않게)는
   TIER_PERSISTS_AFTER_RELOAD 에서, HJ_V450_MUTATION=tier-exact(저장본을 정확히 되살리는 길 paidExactQuoteRuntimeFiles 가 안 따르게)는
   TIER_PERSISTS_AFTER_EXACT_RESTORE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin, BATH = new URL('bathroom.html', APP).href;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_Y1 둔산 욕실', P2 = 'TEST_Y5 다른 현장', INQ = 'TEST_Y2 당근 문의', OLD = 'TEST_Y3 지난 문의', NEW = 'TEST_Y4 일정 없는 문의';
let html = null;
if (process.env.HJ_V450_BASELINE) html = execFileSync('git', ['show', process.env.HJ_V450_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
else if (process.env.HJ_V450_MUTATION) {
  const needle = { 'tier-persist': 'f.exSum=!!q.exSum;', 'tier-exact': 'runtime.exSum=!!quote.exSum;' }[process.env.HJ_V450_MUTATION];
  assert(needle, 'unknown mutation ' + process.env.HJ_V450_MUTATION);
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(src.split(needle).length, 2, 'mutation needle must appear once');
  html = src.replace(needle, '');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v450 = { toasts: [], copies: [], external: [], flush: [], prompted: 0 };
    window.open = (...args) => { __v450.external.push(args); return null; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v450.copies.push(String(t)); } } });
  });
  async function boot() {
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; if (window.__hjOutboxUiBootDone) await __hjOutboxUiBootDone.catch(() => {}); }, BOOT);
    await page.evaluate(async () => {
      aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const realToast = toast; toast = m => { __v450.toasts.push(String(m)); return realToast(m); };
      hjSendSms = () => {};
      if (!document.body.classList.contains('mobile-mode')) { __mobileMode = true; applyMobileMode(); }
    });
  }
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await boot();
  async function test(name, fn) { await fn(); passed++; console.log('PASS rehearsalfix-v450 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no horizontal overflow at 390px');
  let D;
  async function seed() {
    await close();
    D = await page.evaluate(async ({ P, P2, INQ, OLD, NEW }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null; window.__qtHist = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = []; state.adPosts = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), tmr = hjAddDays(today, 1);
      const proj = (name, x) => Object.assign({ name, kind: 'interior', stage: 2, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정리허설', phone: '010-0000-4501', addr: '대전 서구 둔산동 1-1' } }, x || {});
      state.projects = [proj(P), proj(P2), proj(INQ, { stage: 0, customer: { name: '당근고객', phone: '010-0000-4502', addr: '' } }), proj(OLD, { stage: 0, customer: { name: '지난고객', phone: '010-0000-4503', addr: '' } }), proj(NEW, { stage: 0, customer: { name: '새고객', phone: '010-0000-4504', addr: '' } })];
      const item = (name, qty, price) => ({ name, spec: '', qty, price });
      const q = (id, project, tier, items) => ({ id, project, title: '욕실 ' + tier, no: '제' + today.replace(/-/g, '') + '-' + id, date: today, place: '', vatIncluded: true, accountIdx: 0, memo: '', tier, items });
      state.quotes = [q('TEST_QB', P, 'basic', [item('타일', 10, 100000), item('도기', 1, 300000)]), q('TEST_QP', P, 'premium', [item('타일', 10, 150000), item('도기', 1, 600000)]), q('TEST_QX', P2, 'basic', [item('도배', 1, 500000)])];
      state.quotes.forEach(x => syncQuoteToProject(x));
      const at = h => { const d = new Date(Date.now() - h * 3600000); return { date: d.toLocaleString('ko-KR'), day: localDate(d) }; };
      const inq = (project, h) => { const t = at(h); return { id: 'TEST_N_' + project, date: t.date, text: '[문의 접수] ' + t.day + ' · 🥕 당근\n욕실 문의 (v450 테스트)', project }; };
      state.notes = [inq(INQ, 1), inq(OLD, 24 * 5), inq(NEW, 2)];
      state.schedule.push({ id: 'TEST_S_INQ', project: INQ, title: '상담·실측: ' + INQ, date: tmr, time: '10:00', hours: 1 }, { id: 'TEST_S_OLD', project: OLD, title: '상담·실측: ' + OLD, date: tmr, time: '14:00', hours: 1 });
      const total = id => quoteCalc(state.quotes.find(x => x.id === id)).total;
      return { today, B: total('TEST_QB'), PR: total('TEST_QP'), X: total('TEST_QX') };
    }, { P, P2, INQ, OLD, NEW });
  }
  const unloadBlocked = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });

  await test('① REHEARSALFIX_API_PRESENT', async () => {
    assert.equal(await page.evaluate(() => ['hjQuoteTierApply', 'hjQuoteTierAlt', 'hjQuoteTierChosenIn', 'hjQuoteNextNo', 'hjOutboxBackendReady', 'hjInquiryBookedNoReply', 'hjInquiryBookedNoReplyHtml', 'hjInstallLineHtml', 'hjInstallLineOff']
      .every(k => typeof window[k] === 'function') && typeof __hjLocalSavePending === 'boolean'), true, 'REHEARSALFIX_API_PRESENT');
  });

  await test('② [이 안으로 확정] → 고르지 않은 안은 종결(다른 안 확정)·매출 Σ 제외·수주율에서 뺌 → 저장하고 다시 켜도 그대로(TIER_PERSISTS_AFTER_RELOAD)', async () => {
    await seed();
    assert.equal(await page.evaluate(n => projStats(n).est, P), D.B + D.PR, 'before confirm both tiers are summed');
    await page.evaluate(n => hjQuoteCompareView(n, ['TEST_QB', 'TEST_QP']), P); await page.locator('#hjQuoteCompare').waitFor();
    await page.locator('[data-qc-card="TEST_QP"] [data-qc-choose]').click();
    await page.waitForFunction(() => !!document.querySelector('#hjQuoteCompare [data-qc-confirmed]'));
    const r = await page.evaluate(n => {
      const qb = state.quotes.find(q => q.id === 'TEST_QB'), qp = state.quotes.find(q => q.id === 'TEST_QP');
      return { qb: { exSum: qb.exSum, tierLost: qb.tierLost }, qp: ['exSum', 'tierLost'].filter(k => k in qp), st: [quoteStatus(qb), quoteStatus(qp)], reason: hjQuoteLostReason(qb), alt: hjQuoteTierAlt(qb),
        est: projStats(n).est, confirmed: document.querySelector('#hjQuoteCompare [data-qc-confirmed]').textContent,
        pressed: document.querySelector('[data-qc-card="TEST_QP"] [data-qc-choose]').getAttribute('aria-pressed'), other: document.querySelector('[data-qc-card="TEST_QB"] [data-qc-choose]').getAttribute('aria-pressed'),
        win: (({ total, won, lost }) => ({ total, won, lost }))(winRateData()), funnel: funnelData().quoteTotal, saved: serializeData().quotes.find(q => q.id === 'TEST_QB') };
    }, P);
    assert.deepEqual(r.qb, { exSum: true, tierLost: 'TEST_QP' }); assert.deepEqual(r.qp, []);
    assert.deepEqual(r.st, ['lost', 'won']); assert.equal(r.reason, '다른 안 확정'); assert.equal(r.alt, true);
    assert.equal(r.est, D.PR, 'revenue = chosen premium only');
    assert.match(r.confirmed, /확정: 고급안/); assert.deepEqual([r.pressed, r.other], ['true', 'false']);
    assert.deepEqual(r.win, { total: 2, won: 2, lost: 0 }, 'the other tier is not a lost deal in the win rate'); assert.equal(r.funnel, 2);
    assert.equal(r.saved.exSum, true); assert.equal(r.saved.tierLost, 'TEST_QP');
    await tapOk('#hjQuoteCompare [data-qc-choose]'); await noOverflow();
    await close(); await page.evaluate(() => quoteHistoryView(true));
    const hist = await page.evaluate(() => ({ text: document.getElementById('modalRoot').innerText, alt: document.querySelectorAll('#modalRoot [data-qh-tieralt]').length }));
    assert.equal(hist.alt, 1); assert.match(hist.text, /2\/2 결정/); assert.match(hist.text, /다른 안으로 확정/);
    await close();
    // 기기에 저장하고 앱을 다시 연다 — 가상 견적 파일은 저장되지 않으므로 견적 레코드에서 되살아나야 한다
    assert.equal(await page.evaluate(async () => { clearTimeout(__idbSaveTimer); return await guardedPersistCurrentState(); }), true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await boot();
    const look = () => page.evaluate(n => ({ est: projStats(n).est, vf: !!(state.files.find(f => f.id === 'quote_TEST_QB') || {}).exSum, vp: !!(state.files.find(f => f.id === 'quote_TEST_QP') || {}).exSum,
      st: quoteStatus(state.quotes.find(q => q.id === 'TEST_QB')), src: window.__hjRestoreSource }), P);
    const after = await look();
    assert.deepEqual(after, { est: D.PR, vf: true, vp: false, st: 'lost', src: 'legacy-appState' }, 'TIER_PERSISTS_AFTER_RELOAD ' + JSON.stringify(after));
    // 기기 저장본을 정확히 되살리는 길(applyPaidCommittedState — 문서 발행 같은 확정 저장 뒤·공유로 다시 열 때 리허설 R3 가 탄 길)
    const durable = await page.evaluate(async n => { await durableLocalMutation({ snapshotLabel: 'v450 테스트 확정 저장', mutateDraft: d => { d.notes.push({ id: 'TEST_V450_DURABLE', date: new Date().toLocaleString('ko-KR'), text: 'v450 확정 저장 테스트', project: n }); return true; } }); return projStats(n).est; }, P);
    assert.equal(durable, D.PR, 'TIER_PERSISTS_AFTER_EXACT_RESTORE (in session) ' + durable);
    await page.reload({ waitUntil: 'domcontentloaded' }); await boot();
    const exact = await look();
    assert.deepEqual(exact, { est: D.PR, vf: true, vp: false, st: 'lost', src: 'paid-generation' }, 'TIER_PERSISTS_AFTER_EXACT_RESTORE ' + JSON.stringify(exact));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await test('③ 다른 안을 🎉 수주로 → 그 안으로 다시 확정(손으로 넣은 수주 표시는 풀림) · Σ 단추로 다시 넣으면 다른 안 표시도 풀림 · 편집기 [저장]은 확정을 안 되돌림 · 현장을 바꾸면 풂', async () => {
    await seed();
    await page.evaluate(n => { hjQuoteTierConfirm(n, 'TEST_QP', ['TEST_QB', 'TEST_QP']); state.quotes.find(q => q.id === 'TEST_QP').result = 'won'; }, P);
    await close(); await page.evaluate(() => quoteMark('TEST_QB', 'won')); await close();
    const flip = await page.evaluate(n => { const qb = state.quotes.find(q => q.id === 'TEST_QB'), qp = state.quotes.find(q => q.id === 'TEST_QP');
      return { qb: [qb.result, 'tierLost' in qb, 'exSum' in qb], qp: [qp.result, qp.tierLost, qp.exSum], st: [quoteStatus(qb), quoteStatus(qp)], est: projStats(n).est }; }, P);
    assert.deepEqual(flip, { qb: ['won', false, false], qp: ['', 'TEST_QB', true], st: ['won', 'lost'], est: D.B });
    // 편집기를 확정 전에 열어 둔 사본(안 확정 필드 없음)으로 저장해도 확정이 남는다
    const kept = await page.evaluate(() => { const c = JSON.parse(JSON.stringify(state.quotes.find(q => q.id === 'TEST_QP'))); delete c.tierLost; delete c.exSum; c.title = '욕실 고급 (고침)';
      quoteCommitEditing(c); const qp = state.quotes.find(q => q.id === 'TEST_QP'); return [qp.title, qp.tierLost, qp.exSum, !!state.files.find(f => f.id === 'quote_TEST_QP').exSum]; });
    assert.deepEqual(kept, ['욕실 고급 (고침)', 'TEST_QB', true, true]);
    // Σ 단추(견적·정산 목록과 같은 위임 클릭)로 다시 넣는다
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.exsum = 'quote_TEST_QP'; b.id = 'TEST_EXSUM_BTN'; document.getElementById('view').appendChild(b); });
    await page.locator('#TEST_EXSUM_BTN').click();
    const back = await page.evaluate(n => { const qp = state.quotes.find(q => q.id === 'TEST_QP'); return { f: ['exSum', 'tierLost'].filter(k => k in qp), st: quoteStatus(qp), est: projStats(n).est }; }, P);
    assert.deepEqual(back, { f: [], st: 'won', est: D.B + D.PR });
    // 확정 뒤 현장을 바꾸면 확정 필드를 푼다(다른 현장의 비교와 무관)
    const moved = await page.evaluate(({ P, P2 }) => { hjQuoteTierConfirm(P, 'TEST_QB', ['TEST_QB', 'TEST_QP']); const c = JSON.parse(JSON.stringify(state.quotes.find(q => q.id === 'TEST_QP'))); c.project = P2; quoteCommitEditing(c);
      const qp = state.quotes.find(q => q.id === 'TEST_QP'); return [['exSum', 'tierLost'].filter(k => k in qp), !!state.files.find(f => f.id === 'quote_TEST_QP').exSum, projStats(P2).est]; }, { P, P2 });
    assert.deepEqual(moved, [[], false, D.X + D.PR]);
    await close(); assert.deepEqual(errors, []);
  });

  await test('④ 견적 번호 같은 날 -2·-3 · 💰 입금 기록 결제 방법 → payLog·간이영수증', async () => {
    await seed();
    const nos = await page.evaluate(() => { const base = '제' + localDate().replace(/-/g, ''); state.quotes = [{ id: 'A', no: base, items: [] }]; const n1 = newQuote().no; state.quotes.push({ id: 'B', no: n1, items: [] }); const n2 = newQuote().no;
      state.editingQuote = { id: 'C', no: n2, items: [] }; const n3 = hjQuoteNextNo(); state.editingQuote = null; return [base, n1, n2, n3]; });
    assert.deepEqual(nos.slice(1), [nos[0] + '-2', nos[0] + '-3', nos[0] + '-4']);
    await seed();
    await page.evaluate(n => recvQuickView(n), P); await page.locator('#rqMethod').waitFor();
    assert.deepEqual(await page.evaluate(() => { const s = document.getElementById('rqMethod'); return [s.value, [...s.options].map(o => o.value)]; }), ['계좌이체', ['계좌이체', '현금', '카드', '기타', '']]);
    await tapOk('#rqMethod'); await noOverflow();
    await page.locator('#rqAmt').fill('550,000'); await page.locator('#rqMethod').selectOption('현금'); await footer('입금 저장').click();
    await page.waitForFunction(() => /입금 확인증/.test((document.querySelector('#modalRoot h3') || {}).textContent || ''));
    const rec = await page.evaluate(() => { const x = state.payLog[state.payLog.length - 1]; return { amt: x.amt, method: x.method, project: x.project }; });
    assert.deepEqual(rec, { amt: 550000, method: '현금', project: P });
    await close(); await page.evaluate(n => payRcptDialog(n), P);
    assert.equal(await page.locator('#modalRoot .prcRow[data-m="현금"]').count(), 1, 'receipt picks the recorded method');
    await page.locator('#modalRoot .prcRow[data-m="현금"]').click();
    assert.equal(await page.locator('#prcMethod').inputValue(), '현금');
    await close();
    // 모름(비워 두기)이면 method 를 남기지 않는다
    await page.evaluate(n => recvQuickView(n), P); await page.locator('#rqAmt').fill('10,000'); await page.locator('#rqMethod').selectOption(''); await footer('입금 저장').click();
    await page.waitForFunction(() => /입금 확인증/.test((document.querySelector('#modalRoot h3') || {}).textContent || ''));
    assert.equal(await page.evaluate(() => 'method' in state.payLog[state.payLog.length - 1]), false);
    await close(); assert.deepEqual(errors, []);
  });

  await test('⑤ 방문은 잡았는데 답장 안 한 문의 줄(3일 안) → 💬 첫 답장 · v386 문의 줄 계약 유지 · 답장하면 사라짐', async () => {
    await seed();
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    const r = await page.evaluate(() => ({ booked: hjInquiryBookedNoReply(), pending: hjInquiryPending(), line: (document.getElementById('dashboardInquiryBookedNoReply') || {}).textContent || '',
      contract: (document.querySelector('#dashboardInquiryPending + div button') || {}).id }));
    assert.deepEqual(r.booked, [INQ], 'booked & not replied, fresh only (old inquiry skipped)'); assert.deepEqual(r.pending, [NEW]);
    assert.match(r.line, /방문은 잡았는데 답장 안 한 문의 1곳/); assert.equal(r.contract, 'dashboardInquiryOpen', 'v386 layout kept');
    await tapOk('#view [data-firstreply-booked]'); await noOverflow();
    await page.locator('#view [data-firstreply-booked]').click(); await page.locator('#hjFirstReply').waitFor();
    assert.match(await page.locator('#hjFirstReply').innerText(), /방문|10시|10:00/);
    await close();
    await page.evaluate(n => { hjFirstReplyRecord(n, 'daangn'); render(); }, INQ);
    assert.equal(await page.locator('#dashboardInquiryBookedNoReply').count(), 0);
    assert.deepEqual(errors, []);
  });

  await test('⑥ 폰 첫 화면 📲 앱 설치 줄(설치할 수 있을 때만) → [설치]·[✕] · PC 화면에선 숨김', async () => {
    await seed(); await page.evaluate(() => { try { localStorage.removeItem('hj_install_chip_off'); } catch (e) {} state.tab = 'dashboard'; render(); });
    assert.equal(await page.locator('#dashboardInstall').count(), 0, 'no prompt yet → no line');
    const fire = () => page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { __v450.prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); return e.defaultPrevented; });
    assert.equal(await fire(), true);
    await page.locator('#dashboardInstall').waitFor(); assert.equal(await page.locator('#dashboardInstall').isVisible(), true);
    await tapOk('#dashboardInstall button'); await noOverflow();
    await page.locator('#dashboardInstall [data-install-go]').click();
    await page.waitForFunction(() => !document.getElementById('dashboardInstall'));
    assert.equal(await page.evaluate(() => __v450.prompted), 1);
    await fire(); await page.locator('#dashboardInstall').waitFor();
    await page.locator('#dashboardInstall [data-install-off]').click();
    assert.equal(await page.evaluate(() => { render(); return [!!document.getElementById('dashboardInstall'), localStorage.getItem('hj_install_chip_off')]; }).then(x => JSON.stringify(x)), JSON.stringify([false, '1']));
    const pc = await page.evaluate(() => { localStorage.removeItem('hj_install_chip_off'); __mobileMode = false; applyMobileMode(); render(); const el = document.getElementById('dashboardInstall'); const r = [!!el, el ? getComputedStyle(el).display : '']; __mobileMode = true; applyMobileMode(); render(); return r; });
    assert.deepEqual(pc, [true, 'none'], 'PC layout keeps the sidebar button instead');
    await page.evaluate(() => { __deferredPrompt = null; render(); }); assert.deepEqual(errors, []);
  });

  await test('⑦ 대기함: 서버·드라이브 연결 전이면 "올리는 중" 안 띄움(손으로 누르면 기기 보관 안내) · 연결돼 있으면 한 번만 · 아래 띠 문구', async () => {
    await seed();
    await page.evaluate(() => {
      window.__v450orig = { read: hjOutboxRead, flush: hjOutboxFlush, guard: hjOutboxGuard, rec: hjOutboxReconcile, claim: hjOutboxClaim };
      window.__v450Rows = [{ id: 'TEST_OB1', kind: 'file', ref: 'TEST_REF', at: new Date().toISOString(), status: 'ready', tries: 0 }];
      hjOutboxRead = async () => __v450Rows.map(r => Object.assign({}, r));
      hjOutboxFlush = async o => { __v450.flush.push(Object.assign({}, o)); return { sent: 0, remaining: 1 }; };
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v450.toasts.length = 0;
    });
    const off = await page.evaluate(async () => { await hjOutboxOnline(false); const auto = __v450.toasts.slice(); await hjOutboxOnline(true); hjNetBanner(true);
      return { auto, manual: __v450.toasts.slice(auto.length), quiet: __v450.flush.map(o => o.quiet), bar: document.getElementById('hjNetBar').textContent }; });
    assert.equal(off.auto.filter(t => /올리는 중/.test(t)).length, 0, 'nothing uploads without a backend'); assert.deepEqual(off.quiet, [true, true]);
    assert.match(off.manual.join('|'), /서버·드라이브 연결 전이라 사진 1장은 이 기기에 보관합니다/); assert.match(off.bar, /서버·드라이브 연결 전 — 사진 1장 이 기기에 보관/);
    const on = await page.evaluate(async origin => { __relay.url = origin + '/__v450_relay'; __relay.token = 'TEST_V450_TOKEN'; __v450.toasts.length = 0; await hjOutboxOnline(false); const t = __v450.toasts.slice(); hjNetBanner(true);
      return { t, bar: document.getElementById('hjNetBar').textContent }; }, ORIGIN);
    assert.equal(on.t.filter(t => /올리는 중/.test(t)).length, 1, 'one upload toast'); assert.match(on.bar, /☁ 백업 대기 — 사진 1장 대기/);
    // hjOutboxFlush 자신의 토스트: 올릴 곳이 있을 때만, quiet 면 안 띄움
    const real = await page.evaluate(async () => {
      hjOutboxFlush = __v450orig.flush; hjOutboxGuard = () => {}; hjOutboxReconcile = async () => {}; hjOutboxClaim = async () => null;
      const run = async o => { __v450.toasts.length = 0; await hjOutboxFlush(o); return __v450.toasts.filter(t => /올리는 중/.test(t)).length; };
      const a = await run({}), b = await run({ quiet: true }); __relay.url = ''; __relay.token = ''; const c = await run({});
      return [a, b, c];
    });
    assert.deepEqual(real, [1, 0, 0]);
    await page.evaluate(() => { const o = __v450orig; hjOutboxRead = o.read; hjOutboxFlush = o.flush; hjOutboxGuard = o.guard; hjOutboxReconcile = o.rec; hjOutboxClaim = o.claim; hjNetBanner(false); });
    assert.equal(network.writes, 0); assert.deepEqual(errors, []);
  });

  await test('⑧ 창 닫기 경고는 폴더 저장 전·기기 저장 전·사진 넣는 중일 때만(폰에서 다시 열 때 헛경고 없음)', async () => {
    await seed();
    await page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __hjLocalSavePending = false; state.dirty = true; state.dirHandle = null; });
    assert.equal(await unloadBlocked(), false, 'saved on this device, no folder → no false alarm');
    await page.evaluate(() => { state.dirHandle = { kind: 'directory', name: 'TEST' }; }); assert.equal(await unloadBlocked(), true, 'folder connected and not saved');
    await page.evaluate(() => { state.dirHandle = null; state.dirty = false; __hjLocalSavePending = true; }); assert.equal(await unloadBlocked(), true, 'device save pending');
    await page.evaluate(() => { __hjLocalSavePending = false; __photoIntakeBusy = true; }); assert.equal(await unloadBlocked(), true, 'photo intake running');
    await page.evaluate(() => { __photoIntakeBusy = false; markDirty(); }); assert.equal(await unloadBlocked(), true, 'right after a change');
    await page.waitForFunction(() => __hjLocalSavePending === false, null, { timeout: 8000 });
    assert.equal(await unloadBlocked(), false, 'after the device save finished');
    assert.deepEqual(errors, []);
  });

  await test('⑨ 욕실 상담: 전체 철거인데 철거·폐기물이 빠지면 안내 · 추정 단가 안내는 추정 단가가 있을 때만 · 고객용 보기에서는 둘 다 숨김', async () => {
    const bath = await context.newPage(); const bathErrors = []; bath.on('pageerror', e => bathErrors.push(String(e)));
    try {
      await bath.goto(BATH, { waitUntil: 'domcontentloaded' }); await bath.waitForFunction(() => document.documentElement.dataset.bathReady === 'true');
      await bath.evaluate(async () => { if (window.__hjBathPricesDone) await window.__hjBathPricesDone; });
      const vis = id => bath.locator('#' + id).isVisible();
      assert.equal(await bath.locator('#workMethod').inputValue(), 'full');
      assert.equal(await vis('methodScopeNotice'), true, 'full method but demolition/waste off');
      const est = await bath.evaluate(() => document.querySelectorAll('.estimate-total').length > 0);
      assert.equal(await vis('priceEstimateNotice'), est, 'estimate notice follows estimated prices');
      for (const id of ['demolition', 'waste']) await bath.locator('#scope-' + id + ' input[type=checkbox]').check();
      assert.equal(await vis('methodScopeNotice'), false, 'both added → notice gone');
      await bath.locator('#scope-waste input[type=checkbox]').uncheck(); assert.equal(await vis('methodScopeNotice'), true);
      await bath.locator('#workMethod').selectOption('overlay'); assert.equal(await vis('methodScopeNotice'), false, 'overlay method needs no demolition');
      await bath.locator('#workMethod').selectOption('full');
      // 고객용 보기 — 내부 안내는 안 보인다
      await bath.locator('#customerMode').click(); await bath.waitForFunction(() => document.body.classList.contains('customer-mode'));
      assert.deepEqual([await vis('methodScopeNotice'), await vis('priceEstimateNotice')], [false, false]);
      await bath.locator('#customerMode').click();
      // 추정 단가가 없으면(기본 단가표 없음) 추정 안내도 없다
      await bath.route('**/bathroom-defaults.json*', r => r.fulfill({ status: 404, body: '' }));
      await bath.evaluate(() => localStorage.clear()); await bath.reload({ waitUntil: 'domcontentloaded' }); await bath.waitForFunction(() => document.documentElement.dataset.bathReady === 'true');
      await bath.evaluate(async () => { if (window.__hjBathPricesDone) await window.__hjBathPricesDone; });
      assert.equal(await bath.evaluate(() => document.querySelectorAll('.estimate-total').length), 0);
      assert.equal(await vis('priceEstimateNotice'), false, 'no estimated prices → no estimate notice');
      assert.equal(await bath.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(bathErrors, []);
    } finally { await bath.close(); }
  });

  await test('⑩ 📤 견적서 보내기(공유 창) → 보낸 날짜 자동(편집 사본·저장본 같이, 취소·파일 저장은 그대로) · 사진 공정 [모두 추가]는 시공 순서', async () => {
    await seed();
    const sent = await page.evaluate(async () => {
      quotePdfBlob = async q => ({ blob: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), name: '견적서_' + q.id + '.pdf' });
      let mode = 'ok'; Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => mode !== 'nofile' });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { if (mode === 'abort') { const e = new Error('cancel'); e.name = 'AbortError'; throw e; } } });
      const realClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
      const open = id => { state.editingQuote = JSON.parse(JSON.stringify(state.quotes.find(q => q.id === id))); state.tab = 'quotemaker'; };
      const out = {};
      try {
        open('TEST_QB'); await sendQuote(); out.ok = [state.editingQuote.sentAt, state.quotes.find(q => q.id === 'TEST_QB').sentAt, quoteEditDirty()];
        mode = 'abort'; open('TEST_QP'); await sendQuote(); out.abort = [state.editingQuote.sentAt || '', state.quotes.find(q => q.id === 'TEST_QP').sentAt || ''];
        mode = 'nofile'; await sendQuote(); out.file = [state.editingQuote.sentAt || '', state.quotes.find(q => q.id === 'TEST_QP').sentAt || ''];
      } finally { HTMLAnchorElement.prototype.click = realClick; state.editingQuote = null; state.tab = 'dashboard'; delete navigator.share; delete navigator.canShare; }
      return out;
    });
    assert.deepEqual(sent, { ok: [D.today, D.today, false], abort: ['', ''], file: ['', ''] });
    const phases = await page.evaluate(async n => {
      const ph = (id, label) => ({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', size: 10, project: n, when: null, _worklabel: label });
      state.files.push(ph('TEST_PH1', '시공 중 — 타일 붙임'), ph('TEST_PH2', '완료 — 타일 줄눈'), ph('TEST_PH3', '타일 마감'), ph('TEST_PH4', '방수 1차'), ph('TEST_PH5', '방수 2차'), ph('TEST_PH6', '시공 전 — 기존 욕실 철거'));
      const hints = hjPhasesFromPhotos(n).map(r => r.phase); await hjPhaseHintAdd(n); return { hints, phases: state.projects.find(p => p.name === n).phases.slice() };
    }, P);
    assert.deepEqual(phases.hints, ['타일', '방수', '철거'], 'hint chips stay by photo count');
    assert.deepEqual(phases.phases, ['철거', '방수', '타일'], 'add-all follows the construction order');
    await close(); assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`rehearsalfix-v450: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL rehearsalfix-v450', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
