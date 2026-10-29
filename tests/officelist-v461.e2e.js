/* v461 📇 관리사무소 명단 — 🏢 아파트 관리 탭 위쪽 카드(개발_백로그 2번). 합성 자료만, 외부 쓰기 0.
   ① 등록된 관리사무소 전체가 단지·담당자·번호(전화 링크)·현장 수와 함께 보이고, [✎] 가 인라인 폼을 채워 열며 저장하면 그 줄이 제자리에서 고쳐진다(중복 없음)(OFFICE_LIST)
   ② [+ 등록] → 폼 → 저장이 새 줄을 만들고, 같은 단지를 또 적으면 줄이 늘지 않고 빈 칸만 채운다 · 단지 카드의 [🏢 관리사무소 등록]은 prompt 없이 폼을 단지 이름 채운 채 연다
   ③ [📋 복사]는 '단지 관리사무소 · 담당자 · 번호' 글줄(고객 정보 없음) · 390px 넘침 없음 · 단추 44px · 읽기 함수는 자료를 바꾸지 않는다
   HJ_V461_BASELINE=<commit> 은 OFFICE_LIST 에서 실패해야 한다. HJ_V461_MUTATION=list-off 도 OFFICE_LIST 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A1 = 'TEST_L1 크로바아파트 101동 1203호', A2 = 'TEST_L1 크로바아파트 102동 301호', B1 = 'TEST_L2 평화아파트 103동 502호', C1 = 'TEST_L3 샘머리아파트 1동 101호';
const MUT = process.env.HJ_V461_MUTATION || '';
let html = process.env.HJ_V461_BASELINE ? execFileSync('git', ['show', process.env.HJ_V461_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'list-off');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'html+=aptOfficeListHtml(groups);';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });   // prompt() 가 뜨면 실패로 센다
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
  await page.evaluate(async ({ A1, A2, B1, C1 }) => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    window.__v461 = { clip: [] }; navigator.clipboard.writeText = async t => { __v461.clip.push(String(t)); };
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.aptOrders = [];
    const p = (name, extra) => Object.assign({ name, kind: 'interior', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6101', addr: '대전' } }, extra || {});
    state.projects = [p(A1), p(A2), p(B1), p(C1)];
    state.aptOffices = [{ id: 'TEST_OF1', complex: 'TEST_L1 크로바아파트', manager: '박소장', phone: '042-000-6101' }, { id: 'TEST_OF2', complex: 'TEST_L2 평화아파트', manager: '', phone: '' }];
    state.aptOrders = [{ id: 'TEST_X1', officeId: 'TEST_OF1', unit: '101동 1203호', text: 'a', status: 'recv', date: localDate() }];
    state.activeProject = null; state.tab = 'aptmgmt'; render();
  }, { A1, A2, B1, C1 });
  async function test(name, fn) { await fn(); passed++; console.log('PASS officelist-v461 ' + name); }
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#view [data-aptoff-row]')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  const offices = () => page.evaluate(() => state.aptOffices.map(o => [o.id, o.complex, o.manager, o.phone]));
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① 명단 카드: 단지·담당자·번호(전화 링크)·현장 수 · [✎] 폼 채움 · 저장하면 제자리 수정, 중복 없음(OFFICE_LIST)', async () => {
    assert.equal(await page.locator('#view #aptOfficeList').count(), 1, 'OFFICE_LIST card present in the 아파트 관리 tab');
    const before = await serialized();
    const r = await rows();
    assert.equal(r.length, 2, 'OFFICE_LIST two offices ' + JSON.stringify(r));
    assert.match(r[0], /TEST_L1 크로바아파트 박소장 📞 042-000-6101 현장 2곳 · 오더 1건/); assert.match(r[1], /TEST_L2 평화아파트 번호 없음 현장 1곳/);
    assert.equal(await page.locator('#view [data-aptoff-row="TEST_OF1"] a[href="tel:0420006101"]').count(), 1, 'tel link');
    assert.equal(await serialized(), before, 'rendering the list changes nothing');
    await page.locator('#view [data-aptoff-edit="TEST_OF2"]').click(); await page.locator('#view #aptOfficeForm:not([hidden])').waitFor();
    assert.deepEqual(await page.evaluate(() => [document.getElementById('aofId').value, document.getElementById('aofComplex').value, document.getElementById('aofManager').value, document.getElementById('aofPhone').value, document.querySelector('[data-aptoff-form-title]').textContent]), ['TEST_OF2', 'TEST_L2 평화아파트', '', '', '관리사무소 고치기 — TEST_L2 평화아파트']);
    await page.locator('#view #aofManager').fill('최소장'); await page.locator('#view #aofPhone').fill('042-000-6102'); await page.locator('#view [data-aptoff-save]').click();
    await page.locator('#view #aptOfficeList').waitFor();
    assert.deepEqual(await offices(), [['TEST_OF1', 'TEST_L1 크로바아파트', '박소장', '042-000-6101'], ['TEST_OF2', 'TEST_L2 평화아파트', '최소장', '042-000-6102']], 'edited in place');
    assert.match((await rows())[1], /최소장 📞 042-000-6102/);
    // 고치기에서 담당자를 비우면 비워진다(새로 적기와 달리)
    await page.locator('#view [data-aptoff-edit="TEST_OF2"]').click(); await page.locator('#view #aofManager').fill(''); await page.locator('#view [data-aptoff-save]').click(); await page.locator('#view #aptOfficeList').waitFor();
    assert.equal(await page.evaluate(() => state.aptOffices[1].manager), '', 'cleared on edit');
  });

  await test('② [+ 등록] → 새 줄 · 같은 단지 다시 적으면 줄이 늘지 않음 · 단지 카드 [🏢 관리사무소 등록]은 prompt 없이 폼(단지 채움)', async () => {
    await page.locator('#view [data-aptoff-new]').click(); await page.locator('#view #aptOfficeForm:not([hidden])').waitFor();
    assert.equal(await page.locator('#view #aofComplex').inputValue(), '');
    await page.locator('#view [data-aptoff-save]').click(); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => state.aptOffices.length), 2, 'empty complex is refused');
    await page.locator('#view #aofComplex').fill('TEST_L9 새단지'); await page.locator('#view #aofPhone').fill('042-000-6109'); await page.locator('#view [data-aptoff-save]').click(); await page.locator('#view #aptOfficeList').waitFor();
    assert.equal(await page.evaluate(() => state.aptOffices.length), 3); assert.equal((await rows()).length, 3);
    await page.locator('#view [data-aptoff-new]').click(); await page.locator('#view #aofComplex').fill('TEST_L9 새단지'); await page.locator('#view #aofManager').fill('새소장'); await page.locator('#view [data-aptoff-save]').click(); await page.locator('#view #aptOfficeList').waitFor();
    const dup = await page.evaluate(() => ({ n: state.aptOffices.length, o: state.aptOffices.find(x => x.complex === 'TEST_L9 새단지') }));
    assert.equal(dup.n, 3, 'same complex merges'); assert.equal(dup.o.manager, '새소장'); assert.equal(dup.o.phone, '042-000-6109', 'kept the number');
    // 단지 카드 — 샘머리는 미등록
    const card = page.locator('#view .cust-card:not(#aptOthers):not(#aptOfficeList)').filter({ hasText: 'TEST_L3 샘머리아파트' });
    assert.match(await card.innerText(), /관리사무소 미등록/);
    await card.locator('[data-aptoffadd]').click(); await page.locator('#view #aptOfficeForm:not([hidden])').waitFor();
    assert.equal(await page.locator('#view #aofComplex').inputValue(), 'TEST_L3 샘머리아파트', 'complex prefilled, no prompt');
    await page.locator('#view #aofPhone').fill('042-000-6103'); await page.locator('#view [data-aptoff-save]').click(); await page.locator('#view #aptOfficeList').waitFor();
    assert.equal(await page.evaluate(() => state.aptOffices.length), 4);
    assert.match(await page.locator('#view .cust-card:not(#aptOthers):not(#aptOfficeList)').filter({ hasText: 'TEST_L3 샘머리아파트' }).innerText(), /관리사무소 등록됨/);
    await page.locator('#view [data-aptoff-cancel]').click().catch(() => {});
  });

  await test('③ [📋 복사] 글줄 · 390px 넘침 없음 · 44px · 오류 0', async () => {
    await page.locator('#view [data-aptoff-copy]').click(); await page.waitForFunction(() => __v461.clip.length === 1);
    const text = await page.evaluate(() => __v461.clip[0]);
    const lines = text.split('\n'); assert.equal(lines.length, 4, text);
    assert.match(lines[0], /^TEST_L1 크로바아파트 관리사무소 · 박소장 · 042-000-6101$/); assert(!text.includes('정테스트') && !text.includes('010-0000-6101'), 'no customer data');
    const sizes = await page.locator('#view #aptOfficeList button, #view #aptOfficeList a').evaluateAll(ns => ns.filter(n => n.getClientRects().length).map(n => Math.round(n.getBoundingClientRect().height)));
    assert(sizes.length >= 6 && sizes.every(h => h >= 44), 'tap targets ' + JSON.stringify(sizes));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow');
    assert.equal(await page.evaluate(() => (document.querySelector('#view #aptOfficeList').scrollWidth <= document.querySelector('#view #aptOfficeList').clientWidth + 1)), true, 'card overflow');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`officelist-v461: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL officelist-v461', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
