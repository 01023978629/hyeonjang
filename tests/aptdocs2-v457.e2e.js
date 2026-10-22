/* v457 아파트 서류 — 손으로 적은 기간이 남고, 관리사무소 명단에 바로 적는다(인수인계 §7-4). 합성 자료만, 외부 쓰기 0.
   ① 공사 일정이 없는 아파트 현장: 기간을 손으로 적고 닫았다 다시 열면 그대로(p.aptDocs — 자동값과 다른 것만) · 첫 화면 "서류 4종 만들기 (시공 D-n)" 줄도 그 날짜(MANUAL_PERIOD_KEPT)
      · 일정이 있는 현장에서 기간을 고치면 "📌 손으로 적은 기간 — 일정은 …" + [일정대로] 로 되돌림 · 열고 닫기만 하면 저장본이 안 바뀜
   ② 관리사무소가 명단에 없으면 [+ 관리사무소 등록] → 단지·담당자·번호 → state.aptOffices 에 한 줄 + 이 현장에 연결(officeId) → 문자 초안이 그 번호로(OFFICE_LIST_ADD)
      · 명단에 있는데 이름이 달라 못 찾으면 <select> 로 고른다 · 번호 없는 관리사무소는 [✎ 번호 넣기] 로 명단을 고친다 · 번호 없이 [관리사무소 문자]를 누르면 보내지 않고 칸을 연다
   HJ_V457_BASELINE=<commit> 은 MANUAL_PERIOD_KEPT 에서 실패해야 한다. HJ_V457_MUTATION=no-remember 는 MANUAL_PERIOD_KEPT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const NOSCHED = 'TEST_A1 둔산 크로바아파트 101동 1203호', SCHED = 'TEST_A2 대흥 평화아파트 102동 301호';
const MUT = process.env.HJ_V457_MUTATION || '';
let html = process.env.HJ_V457_BASELINE ? execFileSync('git', ['show', process.env.HJ_V457_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-remember');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(Object.keys(keep).length)p.aptDocs=Object.assign(keep,{at:localDate()});else delete p.aptDocs;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'delete p.aptDocs;');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  async function seed() {
    await page.evaluate(async ({ NOSCHED, SCHED }) => {
      closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __mobileMode = true; applyMobileMode();
      window.__v457 = { sms: [] }; hjSendSms = (phone, text) => { __v457.sms.push({ phone: String(phone || ''), text: String(text || '') }); };
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto); state.aptOffices = []; state.aptOrders = [];
      const today = localDate();
      state.projects = [
        { name: NOSCHED, kind: 'interior', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-5701', addr: '대전 서구 둔산동' } },
        { name: SCHED, kind: 'interior', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김테스트', phone: '010-0000-5702', addr: '대전 중구 대흥동' } }];
      state.schedule.push({ id: 'TEST_S1', project: SCHED, title: '철거 작업', date: hjAddDays(today, 2), time: '09:00', hours: 8 }, { id: 'TEST_S2', project: SCHED, title: '타일 시공', date: hjAddDays(today, 4), time: '09:00', hours: 8 });
      state.activeProject = null; state.tab = 'dashboard'; render();
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V457_SEED_SAVE_FAILED');
    }, { NOSCHED, SCHED });
  }
  const snapshot = () => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')) }; });
  const close = () => page.evaluate(() => closeModal(true));
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  const open = name => page.evaluate(n => hjAptDocsView(n), name).then(() => page.locator('#hjAptDocs').waitFor());
  const setDate = async (sel, iso) => { await page.locator(sel).fill(iso); await page.locator(sel).dispatchEvent('change'); };
  async function test(name, fn) { await fn(); passed++; console.log('PASS aptdocs2-v457 ' + name); }

  await test('① 일정 없는 현장: 손으로 적은 기간이 다시 열어도 남고 첫 화면 D-n 줄에 쓰인다 · 일정 있는 현장은 [일정대로] 되돌림 · 열고 닫기만 하면 저장본 불변(MANUAL_PERIOD_KEPT)', async () => {
    await seed(); const before = await snapshot();
    await open(NOSCHED);
    assert.deepEqual(await page.evaluate(() => [document.getElementById('adFrom').value, document.getElementById('adTo').value, !!document.querySelector('[data-ad-period-empty]'), !!document.querySelector('[data-ad-period-manual]')]), ['', '', true, false], 'MANUAL_PERIOD_KEPT no schedule → empty period + hint');
    await close(); assert.deepEqual(await snapshot(), before, 'open and close stores nothing');
    const d2 = await page.evaluate(() => hjAddDays(localDate(), 2)), d5 = await page.evaluate(() => hjAddDays(localDate(), 5));
    await open(NOSCHED); await setDate('#adFrom', d2); await setDate('#adTo', d5);
    await page.locator('#adHours').fill('08:30~17:30'); await page.locator('#adHours').dispatchEvent('change');
    await close();
    const saved = await page.evaluate(n => { const p = state.projects.find(x => x.name === n); return p.aptDocs ? Object.assign({}, p.aptDocs, { at: p.aptDocs.at === localDate() ? 'today' : p.aptDocs.at }) : null; }, NOSCHED);
    assert.deepEqual(saved, { from: d2, to: d5, hours: '08:30~17:30', at: 'today' }, 'MANUAL_PERIOD_KEPT only the changed fields are kept ' + JSON.stringify(saved));
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const stored = await page.evaluate(async n => (await idbGetStrict('appState')).projects.find(p => p.name === n).aptDocs, NOSCHED);
    assert.equal(stored && stored.from, d2, 'persisted to the device store');
    await open(NOSCHED);
    assert.deepEqual(await page.evaluate(() => [document.getElementById('adFrom').value, document.getElementById('adTo').value, document.getElementById('adHours').value, !!document.querySelector('[data-ad-period-manual]')]), [d2, d5, '08:30~17:30', true], 'MANUAL_PERIOD_KEPT reopen');
    assert.match(await page.locator('[data-ad-period-manual]').innerText(), /손으로 적은 기간 — 이 현장엔 공사 일정이 없어요/);
    const m = await page.evaluate(n => hjAptDocModel(n), NOSCHED); assert.equal(hjPeriod(m), d2 + '~' + d5);
    await page.locator('[data-ad-doc="aptapply"]').click(); await page.locator('#hjDocPdf').waitFor();
    const doc = await page.locator('#modalRoot iframe').evaluate(n => n.getAttribute('srcdoc')); assert.match(doc, new RegExp(d2.slice(0, 4) + '년 ' + Number(d2.slice(5, 7)) + '월 ' + Number(d2.slice(8, 10)) + '일'), 'document uses the manual period');
    await footer('뒤로').click(); await page.locator('#hjAptDocs').waitFor(); await close();
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    await page.locator('#view [data-aptdocs-due]').first().waitFor();
    const due = await page.locator('#view [data-aptdocs-due]').allInnerTexts();
    assert(due.some(t => t.includes(NOSCHED) && /시공 D-2/.test(t)), 'MANUAL_PERIOD_KEPT dashboard D-n from the manual date ' + JSON.stringify(due));
    assert(due.some(t => t.includes(SCHED) && /시공 D-2/.test(t)), 'schedule-based line unchanged');
    // 일정 있는 현장 — 기간을 고치면 📌 + [일정대로]
    await open(SCHED);
    const auto = await page.evaluate(() => [document.getElementById('adFrom').value, document.getElementById('adTo').value]); assert.deepEqual(auto, [d2, await page.evaluate(() => hjAddDays(localDate(), 4))]);
    assert.equal(await page.locator('[data-ad-period-manual]').count(), 0);
    await setDate('#adFrom', await page.evaluate(() => hjAddDays(localDate(), 3))); await close(); await open(SCHED);
    assert.match(await page.locator('[data-ad-period-manual]').innerText(), /손으로 적은 기간 — 일정은 \d+\/\d+\(.\) ~ \d+\/\d+\(.\)/);
    // 시작을 끝(D+4)보다 뒤로 밀면 끝이 따라온다 — 끝이 시작보다 앞선 기간이 서류에 안 나간다
    await setDate('#adFrom', await page.evaluate(() => hjAddDays(localDate(), 6))); await close(); await open(SCHED);
    assert.equal(await page.locator('#adTo').inputValue(), await page.evaluate(() => hjAddDays(localDate(), 6)), 'end follows a later start');
    await page.locator('[data-ad-period-reset]').click(); await page.locator('#hjAptDocs').waitFor();
    assert.deepEqual(await page.evaluate(n => [document.getElementById('adFrom').value, !!document.querySelector('[data-ad-period-manual]'), state.projects.find(x => x.name === n).aptDocs || null], SCHED), [d2, false, null], 'back to the schedule, nothing left in p.aptDocs');
    await close();
    // 일정이 바뀌면 안 고친 칸은 따라간다
    await page.evaluate(n => { const s = state.schedule.find(x => x.id === 'TEST_S2'); s.date = hjAddDays(localDate(), 6); }, SCHED);
    await open(SCHED); assert.equal(await page.locator('#adTo').inputValue(), await page.evaluate(() => hjAddDays(localDate(), 6))); await close();
    function hjPeriod(m) { return m.from + '~' + m.to; }
  });

  await test('② 관리사무소 명단: 없으면 [+ 관리사무소 등록] → 한 줄 추가·현장에 연결·문자 번호 · 이름이 달라도 <select> 로 고르기 · [✎ 번호 넣기] · 번호 없는 문자는 막음(OFFICE_LIST_ADD)', async () => {
    await seed();
    await open(NOSCHED);
    assert.match(await page.locator('[data-ad-office]').innerText(), /크로바아파트 관리사무소[\s\S]*명단에 없음/); assert.equal(await page.locator('#adOffice').count(), 0, 'no select when the list is empty');
    assert.equal(await page.locator('#adOfficeForm').isHidden(), true);
    await footer('관리사무소 문자').click(); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __v457.sms.length), 0, 'no number → no sms draft'); assert.equal(await page.locator('#adOfficeForm').isHidden(), false, 'sms without number opens the office form');
    assert.equal(await page.locator('#adOfComplex').inputValue(), 'TEST_A1 둔산 크로바아파트', 'complex prefilled from the site name');
    await page.locator('#adOfManager').fill('박소장'); await page.locator('#adOfPhone').fill('042-000-5701');
    await page.locator('[data-ad-office-save]').click(); await page.locator('#hjAptDocs').waitFor();
    const list = await page.evaluate(n => ({ offices: state.aptOffices.map(o => [o.complex, o.manager, o.phone]), link: state.projects.find(x => x.name === n).aptDocs, officeId: state.aptOffices[0] && state.aptOffices[0].id }), NOSCHED);
    assert.deepEqual(list.offices, [['TEST_A1 둔산 크로바아파트', '박소장', '042-000-5701']], 'OFFICE_LIST_ADD one row in the list'); assert.equal(list.link && list.link.officeId, list.officeId, 'linked to this site');
    assert.match(await page.locator('[data-ad-office]').innerText(), /TEST_A1 둔산 크로바아파트 관리사무소 · 박소장 · 042-000-5701/);
    await footer('관리사무소 문자').click(); const sms = await page.evaluate(() => __v457.sms[0]);
    assert.equal(sms.phone, '042-000-5701'); assert.match(sms.text, /TEST_A1 둔산 크로바아파트 관리사무소 담당자님, TEST_A1 둔산 크로바아파트 101동 1203호 내부 공사 신청 서류/); assert(!sms.text.includes('정테스트'));
    await close();
    // 같은 단지를 두 번 등록하지 않는다 · 명단에 있는데 현장 이름의 단지와 달라 못 찾으면 고른다
    await page.evaluate(() => { hjAptOfficeUpsert('TEST_A1 둔산 크로바아파트', '', '042-000-9999'); hjAptOfficeUpsert('평화아파트2단지', '최소장', ''); });
    assert.deepEqual(await page.evaluate(() => state.aptOffices.map(o => [o.complex, o.manager, o.phone])), [['TEST_A1 둔산 크로바아파트', '박소장', '042-000-9999'], ['평화아파트2단지', '최소장', '']], 'upsert: same complex → same row (new number wins, blank keeps the old manager)');
    await open(SCHED);
    assert.match(await page.locator('[data-ad-office]').innerText(), /평화아파트 관리사무소[\s\S]*명단에 없음/); assert.equal(await page.locator('#adOffice option').count(), 3);
    await page.locator('#adOffice').selectOption({ label: '평화아파트2단지' }); await page.locator('#hjAptDocs').waitFor(); await page.waitForTimeout(100);
    assert.match(await page.locator('[data-ad-office]').innerText(), /평화아파트2단지 관리사무소 · 최소장[\s\S]*번호 넣기/);
    await page.locator('[data-ad-office-edit]').click(); assert.equal(await page.locator('#adOfficeForm').isHidden(), false);
    await page.locator('#adOfPhone').fill('042-000-5702'); await page.locator('[data-ad-office-save]').click(); await page.locator('#hjAptDocs').waitFor();
    const fixed = await page.evaluate(n => ({ offices: state.aptOffices.map(o => [o.complex, o.manager, o.phone]), link: state.projects.find(x => x.name === n).aptDocs.officeId === state.aptOffices[1].id }), SCHED);
    assert.deepEqual(fixed, { offices: [['TEST_A1 둔산 크로바아파트', '박소장', '042-000-9999'], ['평화아파트2단지', '최소장', '042-000-5702']], link: true }, 'list row fixed in place, no duplicate');
    await footer('관리사무소 문자').click(); assert.equal(await page.evaluate(() => __v457.sms[1].phone), '042-000-5702');
    await close();
    // 폰 390px: 넘침 없음 · 단추 44px
    await open(SCHED);
    const sizes = await page.locator('[data-ad-office] button, #adOfficeForm button, [data-ad-doc], #modalRoot .mfoot button').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => Math.round(n.getBoundingClientRect().height)));
    assert(sizes.length >= 6 && sizes.every(h => h >= 44), 'tap targets ' + JSON.stringify(sizes));
    assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page overflow');
    await close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`aptdocs2-v457: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL aptdocs2-v457', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
