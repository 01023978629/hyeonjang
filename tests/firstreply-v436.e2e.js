/* v436 💬 첫 답장 60초 — 채널 6 × 유형 2 초안(가능 시간 2개·인스타 번호 없음) · 복사/문자 앱 → 문의 노트 [첫 답장]·replyAt ·
   대시보드 '그중 답장 안 한 곳' · 🌙 오늘 마감 '오늘 들어와서 답장 안 한 문의' · 새 문의 다음 창. 합성 문의만, 자동 발송 0(문자 앱은 스텁).
   HJ_V436_BASELINE=<commit> 은 FIRSTREPLY_API_PRESENT 에서, HJ_V436_MUTATION=insta-tel(인스타 번호 규칙 해제)는 INSTA_NO_TEL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const A = 'TEST_F1 대흥동 욕실', B = 'TEST_F2 누수 문의', C = 'TEST_F3 답장함', K = 'TEST_F4 카카오 리드';
const baseline = process.env.HJ_V436_BASELINE && execFileSync('git', ['show', process.env.HJ_V436_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

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
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v436 = { copies: [], sms: [], external: [], toasts: [] };
    window.open = (...args) => { __v436.external.push(args); return null; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v436.copies.push(String(t)); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjFirstReplyView', 'hjFirstReplyDraft', 'hjFirstReplySlots', 'hjFirstReplyRecord', 'hjInquiryReplied', 'hjInquiryNoReply'].every(k => typeof window[k] === 'function') && typeof HJ_FIRST_REPLY === 'object'), true, 'FIRSTREPLY_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __v436.sms.push({ phone, text }); };
    const realToast = toast; toast = m => { __v436.toasts.push(String(m)); return realToast(m); };
  });
  if (process.env.HJ_V436_MUTATION) {
    assert.equal(process.env.HJ_V436_MUTATION, 'insta-tel');
    await page.evaluate(() => { hjFirstReplyTelOk = () => true; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS firstreply-v436 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async ({ A, B, C, K }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), y = hjAddDays(today, -1);
      const P = (name, x) => Object.assign({ name, kind: 'interior', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김민수', phone: '010-7000-2222', addr: '' }, archived: false }, x || {});
      state.projects = [P(A, { leadSrc: 'daangn', inquiryAt: today }), P(B, { kind: 'leak', leadSrc: 'naverplace', inquiryAt: y, customer: { name: '이수진', phone: '010-7000-3333', addr: '' } }), P(C, { leadSrc: 'instagram', inquiryAt: today }), P(K, { kakaoLead: { at: today, type: '견적문의', work: '욕실' }, inquiryAt: today })];
      const at = d => new Date(d + 'T09:05:00').toLocaleString('ko-KR');
      state.notes = [{ id: 'nA', date: at(y), text: '[문의 접수] ' + today + ' · 🥕 당근\n욕실 전체 리모델링 문의', project: A },   // 노트 시각은 어제 — 언제 돌려도 답장이 뒤
        { id: 'nB', date: at(y), text: '[문의 접수] ' + y + ' · 📍 네이버 지도\n천장에서 물이 떨어짐', project: B },
        { id: 'nC', date: at(today), text: '[문의 접수] ' + today + ' · 📷 인스타\n주방 견적\n[첫 답장] 9:30 인스타 DM', project: C, replyAt: new Date(today + 'T09:30:00').toISOString() }];
      // 오늘 일정 — 09:00~12:00 공사(앞뒤 30분 이동 여유)
      state.schedule.push({ id: 'TEST_SCH_DAY', date: today, time: '09:00', endTime: '12:00', title: '타일 시공', project: '', workers: '', memo: '', hours: 3, report: null });
      state.tab = 'dashboard'; state.activeProject = null; state.search = ''; __photoCache.key = null;
      for (const k of Object.keys(__v436)) __v436[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V436_SEED_SAVE_FAILED');
      return { today, y };
    }, { A, B, C, K });
  }
  async function snapshot() {
    return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() }; });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function shot(name) {
    if (!process.env.HJ_V436_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V436_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V436_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  let D;
  await test('① 채널 6 × 유형 2 초안 — 인사·가능 시간 2개·필요한 정보·마무리 · 인스타는 번호 없이 DM · 누수는 사진 2장·아랫집 · 빈 시간 계산', async () => {
    D = await seed();
    const r = await page.evaluate(today => {
      const tel = COMPANY.tel.replace(/\D/g, ''), morning = hjFirstReplySlots(new Date(today + 'T08:00:00')), night = hjFirstReplySlots(new Date(today + 'T20:00:00'));
      const drafts = [];
      for (const c of HJ_FIRST_REPLY.channels) for (const [k] of HJ_FIRST_REPLY.kinds) { const t = hjFirstReplyDraft({ ch: c.id, kind: k, slots: morning }); drafts.push({ ch: c.id, k, t, tel: t.replace(/\D/g, '').includes(tel), len: t.replace(/\s/g, '').length }); }
      return { morning: morning.map(x => x.label), night: night.map(x => [x.day, x.time]), next: hjShiftWorkDays(today, 1), drafts, channels: HJ_FIRST_REPLY.channels.map(c => c.id) };
    }, D.today);
    assert.deepEqual(r.channels, ['daangn', 'naver', 'instagram', 'kakao', 'sms', 'referral']); assert.equal(r.drafts.length, 12);
    assert.deepEqual(r.morning, ['오늘 오후 1시', '오늘 오후 2시'], 'free hours after the 09–12 job (+30 min travel)');
    assert.deepEqual(r.night, [[r.next, '09:00'], [r.next, '10:00']], 'late — next work day');
    for (const d of r.drafts) {
      assert(d.t.includes('오늘 오후 1시 또는 오늘 오후 2시'), d.ch + '/' + d.k + ' two slots'); assert(d.len <= 200, d.ch + '/' + d.k + ' short (' + d.len + ')');
      assert.match(d.t, /^안녕하세요\. 만물인테리어/);
      if (d.ch === 'instagram') { assert.equal(d.tel, false, 'INSTA_NO_TEL ' + d.k); assert.match(d.t, /DM 으로 답 주세요/); }
      else assert.equal(d.tel, true, d.ch + ' carries the company number');
      if (d.k === 'leak') { assert.match(d.t, /사진 2장/); assert.match(d.t, /아랫집/); } else assert.match(d.t, /평수/);
    }
    assert.match(r.drafts.find(d => d.ch === 'daangn').t, /당근에서 문의 주셔서/); assert.match(r.drafts.find(d => d.ch === 'referral').t, /소개받고/);
  });

  await test('② 대시보드 그중 답장 안 한 곳 → [💬 첫 답장] → 당근·인테리어 초안 · 열기만으로 저장 불변 · 복사 → 문의 노트 [첫 답장]·replyAt · 줄에서 빠짐 · v445 첫 답장 분', async () => {
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    const line = await page.locator('#dashboardInquiryPending').innerText();
    assert.match(line, /다음 일정 안 잡힌 문의 4곳/); assert.match(line, /그중 답장 안 한 곳 3곳 — TEST_F1 대흥동 욕실 · TEST_F2 누수 문의 · TEST_F4 카카오 리드/);
    assert.equal(await page.evaluate(() => (document.querySelector('#dashboardInquiryPending + div button') || {}).id), 'dashboardInquiryOpen', 'v386 layout kept');
    await tapOk('#view [data-firstreply]');
    // 🌙 오늘 마감 — 오늘 들어와서 답장 안 한 문의(어제 문의 B 는 빠짐) · 영업 칸 단추는 그대로
    await page.evaluate(() => hjDayCloseView()); await page.locator('#dcFirstReply').waitFor();
    assert.match(await page.locator('#dcFirstReply').innerText(), /오늘 들어와서 답장 안 한 문의 2곳[\s\S]*TEST_F1 대흥동 욕실 · TEST_F4 카카오 리드/);
    assert.equal(await page.locator('#dcSales [data-dc-firstreply]').count(), 0); await tapOk('#dcFirstReply [data-dc-firstreply]'); await close();
    const before = await snapshot();
    await page.locator('#view [data-firstreply]').click(); await page.locator('#hjFirstReply').waitFor();
    const v = await page.evaluate(() => ({ ch: document.querySelector('[data-fr-ch][aria-pressed="true"]').dataset.frCh, kind: document.querySelector('[data-fr-kind][aria-pressed="true"]').dataset.frKind, text: frText.value, slots: document.querySelector('[data-fr-slots]').innerText, ok: !!document.querySelector('[data-fr-ok]'), sms: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent) }));
    assert.deepEqual([v.ch, v.kind, v.ok], ['daangn', 'interior', true]); assert.match(v.text, /당근에서 문의 주셔서/); assert.match(v.slots, /가능 시간: (오늘|내일|\d+\/\d+\(.\)) 오[전후] \d+시 · (오늘|내일|\d+\/\d+\(.\)) 오[전후] \d+시/);
    assert.deepEqual(v.sms, ['📋 복사', '💬 문자 앱', '닫기']);
    await tapOk('#hjFirstReply [data-fr-ch], #hjFirstReply [data-fr-kind], #modalRoot .mfoot button'); await noOverflow(); await shot('01-first-reply');
    sameSnapshot(await snapshot(), before, 'opening and switching drafts is read only');
    await footer('📋 복사').click();
    await page.waitForFunction(name => hjInquiryReplied(name), A);
    const r = await page.evaluate(name => { const n = state.notes.find(x => x.id === 'nA'); return { text: n.text, replyAt: n.replyAt, copies: __v436.copies.slice(), min: hjInsightReplyMin([n]), line: (document.getElementById('dashboardInquiryPending') || {}).innerText || '' }; }, A);
    assert.match(r.text, /^\[문의 접수\][\s\S]*\n\[첫 답장\] \d{1,2}\/\d{1,2} \d{2}:\d{2} 당근$/); assert(Date.parse(r.replyAt) > 0);
    assert.equal(r.copies.length, 1); assert.match(r.copies[0], /당근에서 문의 주셔서/);
    assert(Number.isFinite(r.min) && r.min >= 0, 'v445 first-reply minutes ' + r.min);
    assert.match(r.line, /그중 답장 안 한 곳 2곳 — TEST_F2 누수 문의 · TEST_F4 카카오 리드/);
    // 두 번째 복사는 첫 답장 시각을 바꾸지 않는다
    await page.evaluate(name => hjFirstReplyView(name), A); await page.locator('[data-fr-replied]').waitFor(); await footer('📋 복사').click();
    await page.waitForFunction(() => /\[다시 답장\]/.test(state.notes.find(x => x.id === 'nA').text));
    assert.equal(await page.evaluate(() => state.notes.find(x => x.id === 'nA').replyAt), r.replyAt);
  });

  await test('③ 누수 문의 — 누수 초안(사진 2장·아랫집) · 인스타로 바꾸면 번호 빠짐 · 고친 글에 번호 넣으면 경고 · 문자 앱(스텁) · 카카오 리드는 노트를 새로', async () => {
    await page.evaluate(name => hjFirstReplyView(name), B); await page.locator('#hjFirstReply').waitFor();
    const v = await page.evaluate(() => ({ ch: document.querySelector('[data-fr-ch][aria-pressed="true"]').dataset.frCh, kind: document.querySelector('[data-fr-kind][aria-pressed="true"]').dataset.frKind, text: frText.value }));
    assert.deepEqual([v.ch, v.kind], ['naver', 'leak']); assert.match(v.text, /사진 2장/); assert.match(v.text, /아랫집/);
    await page.locator('[data-fr-ch="instagram"]').click();
    const t = await page.inputValue('#frText'), tel = await page.evaluate(() => COMPANY.tel.replace(/\D/g, ''));
    assert(!t.replace(/\D/g, '').includes(tel), 'INSTA_NO_TEL view'); assert.equal(await page.locator('[data-fr-ok]').count(), 1);
    await page.locator('#frText').fill(t + '\n010-9999-8888'); assert.equal(await page.locator('[data-fr-tel]').count(), 1, 'warns, does not block');
    await page.locator('#frText').fill(t);
    await footer('💬 문자 앱').click();
    await page.waitForFunction(name => hjInquiryReplied(name), B);
    const r = await page.evaluate(() => ({ sms: __v436.sms.slice(), text: state.notes.find(x => x.id === 'nB').text }));
    assert.equal(r.sms.length, 1); assert.equal(r.sms[0].phone, '010-7000-3333'); assert.match(r.sms[0].text, /DM 으로 답 주세요/);
    assert.match(r.text, /\[첫 답장\] .* 인스타 DM$/);
    // 문의 노트가 없는 카카오 리드 — '[첫 답장] …' 노트를 새로(replyAt), v445 계산에는 안 들어간다
    await page.evaluate(name => { hjFirstReplyView(name); }, K); await page.locator('#hjFirstReply').waitFor(); await footer('📋 복사').click();
    await page.waitForFunction(name => hjInquiryReplied(name), K);
    const k = await page.evaluate(name => { const n = state.notes.filter(x => x.project === name); return { n: n.length, text: n[0].text, min: hjInsightReplyMin(n) }; }, K);
    assert.equal(k.n, 1); assert.match(k.text, /^\[첫 답장\] /); assert.equal(k.min, null);
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.equal(await page.locator('#view [data-inq-noreply]').count(), 0, 'everyone answered');
  });

  await test('④ 새 문의 받기 다음 창 [💬 첫 답장 보내기](아래 단추 3개 그대로) · 계약 — 새 최상위 키 없음 · 더보기 126 · 390px · 오류·외부 쓰기 0 · 자동 발송 0', async () => {
    const keys0 = (await snapshot()).keys;
    await page.evaluate(() => hjInquiryNext('TEST_F1 대흥동 욕실')); await page.locator('#inqFirstReply').waitFor();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent)), ['닫기', '📂 현장 열기', '🗓 상담·실측 일정']);
    await tapOk('#inqFirstReply'); await page.locator('#inqFirstReply').click(); await page.locator('#hjFirstReply').waitFor(); await close();
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.deepEqual((await snapshot()).keys, keys0, 'no new top-level keys');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390px');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v436.external), []);
    assert.equal(await page.evaluate(() => __v436.sms.length), 1, 'only the one SMS app opening the test pressed');
  });
  console.log(`firstreply-v436: ${passed}/${passed} PASS; synthetic inquiries; clipboard/SMS stubbed; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL firstreply-v436', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
