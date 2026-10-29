/* v451 리허설 R6(관리·사후·안전) 고침 — 합성 자료만. 외주팀 일당이 인건비 장부 기본값 · 띄어쓴 이름 유령 토글 없음 ·
   보존 정리가 최근 현장과 이어진 연락처는 남김 · 백업 공유 창을 닫으면 '백업함'이 아님 · 지급 명세·외주 요청서(PDF) 문자는 외주팀에게 ·
   보관한 현장의 문자도 그 현장으로 · 아파트 D-n·서류 기간에서 상담·AS 일정 빼기 · 새벽(UTC 날짜가 어제) 같은 서류 두 번 발행 없음 ·
   변경 기록 CSV 한국 시각 · 새로 넣은 사진의 문서용 미리보기(data:) · 보증 안부에 보관 현장 · 무상 판정 문자 · 첫 답장 30일 · 외주 요청 품목·기록 중복 없음.
   HJ_V451_BASELINE=<commit> 은 REHEARSALFIX_API_PRESENT 에서, HJ_V451_MUTATION=crew-rate 는 CREW_RATE_FROM_SUBTEAM 에서,
   HJ_V451_MUTATION=sms-to 는 SMS_TO_SUBTEAM 에서, HJ_V451_MUTATION=ret-live 는 RETENTION_KEEPS_LIVE_CONTACT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_Z1 둔산 욕실', APT = 'TEST_Z2 둔산자이아파트 102동 1203호', OLD = 'TEST_Z3 지난 현장', NEWP = 'TEST_Z4 다시 문의', ARCH = 'TEST_Z5 보관 현장';
const SUB = 'TEST_외주 설비팀', SUB_TEL = '010-0000-4601', CUST_TEL = '010-0000-4602';
let html = null;
if (process.env.HJ_V451_BASELINE) html = execFileSync('git', ['show', process.env.HJ_V451_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
else if (process.env.HJ_V451_MUTATION) {
  const needle = { 'crew-rate': "return r&&r.type==='day'&&num(r.amount)>0?Math.round(num(r.amount)):0;}", 'sms-to': 'to:sm.to||null,', 'ret-live': 'if(live){n.contactsKept=(n.contactsKept||0)+1;return;}' }[process.env.HJ_V451_MUTATION];
  assert(needle, 'unknown mutation ' + process.env.HJ_V451_MUTATION);
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(src.split(needle).length, 2, 'mutation needle must appear once');
  html = src.replace(needle, { 'crew-rate': 'return 0;}', 'sms-to': '', 'ret-live': '' }[process.env.HJ_V451_MUTATION]);
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
    window.__v451 = { toasts: [], sms: [], copies: [], shares: [], external: [] };
    window.open = (...args) => { __v451.external.push(args); return null; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v451.copies.push(String(t)); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; if (window.__hjOutboxUiBootDone) await __hjOutboxUiBootDone.catch(() => {}); }, BOOT);
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const realToast = toast; toast = m => { __v451.toasts.push(String(m)); return realToast(m); };
    hjSendSms = (phone, text) => { __v451.sms.push({ phone: String(phone || ''), text: String(text || '') }); };
    if (!document.body.classList.contains('mobile-mode')) { __mobileMode = true; applyMobileMode(); }
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS rehearsalfix-v451 ' + name); }
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
    D = await page.evaluate(async ({ P, APT, OLD, NEWP, ARCH, SUB, SUB_TEL, CUST_TEL }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = []; state.adPosts = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), ym = today.slice(0, 7), ago = n => hjAddDays(today, -n);
      const proj = (name, x) => Object.assign({ name, kind: 'interior', stage: 2, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: CUST_TEL, addr: '대전 서구 둔산동 1-1' } }, x || {});
      state.projects = [
        proj(P),
        proj(APT, { stage: 1, customer: { name: '아파트고객', phone: '010-0000-4603', addr: '대전 서구 둔산동 둔산자이아파트 102동 1203호' } }),
        proj(OLD, { stage: 3, doneAt: ago(365 * 4), customer: { name: '홍길동', phone: '010-0000-4604', addr: '대전 중구 대흥동 33-1 2층' } }),
        proj(NEWP, { stage: 0, customer: { name: '홍길동', phone: '010-0000-4604', addr: '대전 중구 대흥동' } }),
        proj(ARCH, { stage: 3, doneAt: ago(365 * 3 - 25), archived: true, customer: { name: '보관고객', phone: '010-0000-4605', addr: '대전 서구 탄방동' } })];
      state.suppliers = [{ id: 'TEST_SUP1', name: SUB, category: '외주', phone: SUB_TEL, trade: '설비', rate: { type: 'day', amount: 230000 } }];
      state.contacts = [{ id: 'TEST_C_OLD', name: '홍길동', phone: '010-0000-4604', tag: '고객', memo: '대흥동 홍길동 고객님' }];
      state.notes = [{ id: 'TEST_N_NEW', date: new Date(Date.now() - 6 * 86400000).toLocaleString('ko-KR'), text: '[문의 접수] ' + ago(6) + ' · 📞 전화\n다시 문의', project: NEWP }];
      state.payLog = [{ d: ago(365 * 4), project: OLD, amt: 1000000 }];
      state.schedule.push({ id: 'TEST_S_WORK', project: P, title: '설비 배관', date: today, time: '09:00', hours: 8 },
        { id: 'TEST_S_CONSULT', project: APT, title: '상담·실측: ' + APT, date: ago(10), time: '10:00', hours: 1 },
        { id: 'TEST_S_APTWORK', project: APT, title: '욕실 타일 시공', date: hjAddDays(today, 2), time: '09:00', hours: 8 });
      state.quotes = [{ id: 'TEST_QA', project: P, title: '욕실 기본', no: 'A', date: today, vatIncluded: true, tier: 'basic', items: [{ name: '철거', spec: '', qty: 1, price: 300000 }, { name: '방수', spec: '', qty: 1, price: 400000 }] },
        { id: 'TEST_QB', project: P, title: '욕실 고급', no: 'B', date: today, vatIncluded: true, tier: 'premium', items: [{ name: '철거', spec: '', qty: 1, price: 300000 }, { name: '방수', spec: '', qty: 1, price: 500000 }] }];
      state.quotes.forEach(q => syncQuoteToProject(q));
      return { today, ym };
    }, { P, APT, OLD, NEWP, ARCH, SUB, SUB_TEL, CUST_TEL });
  }

  await test('① REHEARSALFIX_API_PRESENT', async () => {
    assert.equal(await page.evaluate(() => ['hjIsoLocalDay', 'hjIsoLocalStamp', 'hjRetContactLive', 'hjDocThumbLater'].every(k => typeof window[k] === 'function') && HJ_APT_NONWORK_RE instanceof RegExp && HJ_FIRST_REPLY_DAYS === 30), true, 'REHEARSALFIX_API_PRESENT');
  });

  await test('② 외주팀 일당이 👷 인건비 장부 기본값(CREW_RATE_FROM_SUBTEAM) · 띄어쓴 이름이 낱말마다 토글로 쪼개지지 않음', async () => {
    await seed();
    const by = await page.evaluate(sub => hjLaborSetPerson('TEST_S_WORK', sub, 0.5), SUB);
    assert.deepEqual(by[SUB], { days: 0.5, rate: 230000 }, 'CREW_RATE_FROM_SUBTEAM ' + JSON.stringify(by));
    assert.equal(await page.evaluate(() => state.schedule.find(s => s.id === 'TEST_S_WORK').labor.amount), 115000);
    await page.evaluate(ym => laborLedger(ym), D.ym); await page.locator('#modalRoot .llDay').first().waitFor();
    const names = await page.evaluate(() => [...new Set([...document.querySelectorAll('#modalRoot .llDay')].map(b => b.dataset.name))]);
    assert.deepEqual(names, [SUB], 'no ghost toggles for words of a spaced name: ' + JSON.stringify(names));
    await tapOk('#modalRoot .llDay'); await noOverflow(); await close();
    const settle = await page.evaluate(([sub, ym]) => { const d = hjCrewSettleData(ym); const p = d.people.find(x => x.name === sub); return { amount: p.amount, rate: p.rate }; }, [SUB, D.ym]);
    assert.deepEqual(settle, { amount: 115000, rate: 230000 });
    assert.deepEqual(errors, []);
  });

  await test('③ 지급 명세·외주 요청서(PDF)의 💬 문자 초안은 외주팀에게(SMS_TO_SUBTEAM) · 보관 현장의 문자는 그 현장으로', async () => {
    await seed();
    await page.evaluate(sub => hjLaborSetPerson('TEST_S_WORK', sub, 1), SUB);
    await page.evaluate(([sub, ym]) => hjCrewPayslipView(sub, ym), [SUB, D.ym]); await page.locator('#hjDocSms').click();
    await page.locator('#mcBody').waitFor();
    assert.match(await page.locator('[data-mc-to]').innerText({ timeout: 3000 }).catch(() => ''), /TEST_외주 설비팀.*\*\*\*-4601/, 'SMS_TO_SUBTEAM (recipient line)');
    assert.equal(await page.locator('#mcProj').isVisible(), false, 'no project picker for a non-customer recipient');
    assert.match(await page.locator('#mcBody').inputValue(), /지급 명세/);
    await page.locator('#mcSend').click();
    assert.deepEqual(await page.evaluate(() => __v451.sms.map(x => x.phone)), [SUB_TEL], 'SMS_TO_SUBTEAM (payslip)');
    await close();
    await page.evaluate(n => hjSubQuoteView(n), P); await page.locator('#sqSup').fill(SUB);
    const items = await page.evaluate(() => [...document.querySelectorAll('#hjSubQuote [data-sq-item]')].map(el => el.dataset.sqItem));
    assert.deepEqual(items, ['철거', '방수'], 'two-tier quote items are not listed twice');
    await footer('💬 문자 초안').click();
    await page.evaluate(n => hjSubQuoteView(n), P); await page.locator('#sqSup').fill(SUB); await footer('요청서(PDF)').click();
    await page.locator('#hjDocSms').click(); await page.locator('#mcBody').waitFor(); await page.locator('#mcSend').click();
    const sms = await page.evaluate(() => __v451.sms.slice(1).map(x => x.phone));
    assert.deepEqual(sms, [SUB_TEL, SUB_TEL], 'SMS_TO_SUBTEAM (request text + PDF draft), never the customer ' + CUST_TEL);
    assert.equal(await page.evaluate(n => hjSubQuotes(state.projects.find(p => p.name === n)).length, P), 1, 'same request pressed twice → one record');
    await close();
    await page.evaluate(n => msgCenterCompose('review', { project: n, text: 'TEST 안부 문자' }), ARCH);
    assert.equal(await page.locator('#mcBody').inputValue(), 'TEST 안부 문자');
    await page.locator('#mcSend').click();
    assert.equal(await page.evaluate(() => __v451.sms.at(-1).phone), '010-0000-4605', 'archived project keeps its own customer');
    await close(); assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await test('④ 보존 정리: 같은 번호로 최근 다시 문의한 고객의 연락처는 남김(RETENTION_KEEPS_LIVE_CONTACT) · "고객 고객" 없음', async () => {
    await seed();
    const prev = await page.evaluate(n => hjRetPreview(n), OLD);
    assert.equal(prev.remove.contacts, 0); assert.equal(prev.keep.contactsLive, 1);
    const r = await page.evaluate(n => { const r = hjRetAnonProject(n, 'retention'); const c = state.contacts.find(x => x.id === 'TEST_C_OLD'); return { r, c: { name: c.name, phone: c.phone, anon: !!c.anon } }; }, OLD);
    assert.deepEqual(r.c, { name: '홍길동', phone: '010-0000-4604', anon: false }, 'RETENTION_KEEPS_LIVE_CONTACT ' + JSON.stringify(r));
    assert.equal(r.r.contactsKept, 1); assert.equal(r.r.contacts, 0);
    // 최근 현장이 없으면 예전처럼 익명화
    await seed();
    const gone = await page.evaluate(([o, n]) => { state.projects = state.projects.filter(p => p.name !== n); state.notes = []; hjRetAnonProject(o, 'retention'); const c = state.contacts.find(x => x.id === 'TEST_C_OLD'); return { name: c.name, phone: c.phone, memo: c.memo }; }, [OLD, NEWP]);
    assert.deepEqual(gone, { name: '고객', phone: '', memo: '대흥동 고객님' });
    assert.equal(await page.evaluate(() => hjRetScrub('고객 홍길동 집', '홍길동')), '고객 집');
    assert.deepEqual(errors, []);
  });

  await test('⑤ 💾 지금 백업: 공유 창을 닫으면 백업 기록 없음 · 보내기가 끝나야 기록', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      let mode = 'abort';
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { if (mode === 'abort') { const e = new Error('cancel'); e.name = 'AbortError'; throw e; } } });
      localStorage.removeItem('hj_last_backup');
      backupNow(); await new Promise(res => setTimeout(res, 150)); const afterAbort = localStorage.getItem('hj_last_backup');
      mode = 'ok'; backupNow(); await new Promise(res => setTimeout(res, 150)); const afterOk = localStorage.getItem('hj_last_backup');
      delete navigator.share; delete navigator.canShare; return { afterAbort, afterOk: !!afterOk };
    });
    assert.deepEqual(r, { afterAbort: null, afterOk: true });
    assert.deepEqual(errors, []);
  });

  await test('⑥ 아파트: 지난 상담 일정은 공사가 아님 → D-2 줄·서류 시작일 · 새벽(UTC 날짜가 어제)에도 오늘 낸 서류는 다시 안 냄 · 변경 기록 CSV 한국 시각', async () => {
    await seed();
    const due = await page.evaluate(() => ({ rows: hjAptDocsDue().map(r => [r.name, r.start]), start: hjAddDays(localDate(), 2) }));
    assert.deepEqual(due.rows, [[APT, due.start]], 'apartment D-2 line');
    assert.equal(await page.evaluate(n => hjAptDocModel(n).from, APT), await page.evaluate(() => hjAddDays(localDate(), 2)));
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.match(await page.locator('[data-aptdocs-due]').innerText(), /D-2/);
    assert.equal(await page.evaluate(() => hjIsoLocalDay('2026-10-16T23:30:00.000Z')), '2026-10-17');
    const issue = await page.evaluate(async n => {
      const p = state.projects.find(x => x.name === n), day = localDate(), at = new Date(day + 'T01:00:00').toISOString();
      p.docs = [{ type: 'aptapply', no: 'AA-' + day.replace(/-/g, '') + '-01', at, purpose: 'apt', name: '공사 신청서' }];
      const r = await hjAptDocsIssue(n, ['aptapply', 'aptnotice']);
      return { utcDay: at.slice(0, 10), day, added: r.added, types: state.projects.find(x => x.name === n).docs.map(d => d.type) };
    }, APT);
    assert.notEqual(issue.utcDay, issue.day, 'seed is before 09:00 KST');
    assert.equal(issue.added, 1); assert.deepEqual(issue.types, ['aptapply', 'aptnotice']);
    assert.match(await page.evaluate(() => hjAuditCsv([{ at: '2026-10-16T23:30:00.000Z', kind: 'anon', target: '보존 기간', count: 1, by: 'owner', device: 'PC' }])), /2026-10-17 08:30,개인정보 정리/);
    assert.deepEqual(errors, []);
  });

  await test('⑦ 새로 넣은 사진은 문서 사진 고르기에 바로(data: 미리보기 · 이 기기 캐시) · 보증 안부에 보관 현장 · 무상 판정 문자 · 첫 답장 30일', async () => {
    await seed();
    const thumb = await page.evaluate(async n => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d'); g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.fillText('v451', 20, 40);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'TEST_v451_photo.png', { type: 'image/png', lastModified: Date.now() });
      const out = await runPhotoIntake([file], { project: n, workLabel: '방수 작업' });
      await __hjDocThumbQ;
      const rec = state.files.find(f => f.name === 'TEST_v451_photo.png');
      return { ok: !!rec, data: hjDocThumbOk(rec), head: String(rec && rec.thumb || '').slice(0, 23), cached: String(await idbGet('thumb-local:' + fileKey(rec)) || '').slice(0, 15), pool: hjInsDamagePool(state.projects.find(p => p.name === n)).length };
    }, P);
    assert.deepEqual(thumb, { ok: true, data: true, head: 'data:image/jpeg;base64,', cached: 'data:image/jpeg', pool: 1 }, 'DOC_THUMB_AFTER_INTAKE ' + JSON.stringify(thumb));
    await close();
    const care = await page.evaluate(() => hjWarrantyCareRows().map(r => r.name));
    assert(care.includes(ARCH), 'archived (📦 보관) project gets the warranty reminder: ' + JSON.stringify(care));
    assert.match(await page.evaluate(() => hjAsVerdictText({ text: '욕실 누수', verdict: { result: 'free' } })), /무상 보수 대상으로 보여요\. 방문해서 원인을 확인한 뒤 확정해/);
    const fr = await page.evaluate(([newp]) => { const n = state.notes.find(x => x.id === 'TEST_N_NEW'); const recent = hjInquiryNoReply([newp]); n.date = new Date(Date.now() - 40 * 86400000).toLocaleString('ko-KR'); n.text = n.text.replace(/\d{4}-\d{2}-\d{2}/, hjAddDays(localDate(), -40)); const old = hjInquiryNoReply([newp]); return { recent, old }; }, [NEWP]);
    assert.deepEqual(fr, { recent: [NEWP], old: [] });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`rehearsalfix-v451: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL rehearsalfix-v451', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
