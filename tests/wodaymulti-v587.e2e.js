/* v587 📤 내일 일정 팀에 보내기 — 여러 날 공정의 이어지는 날도 지시에
   문제(기준선): hjWoDaySchedules 가 date===그날만 골라, 3일짜리 공정 둘째·셋째 날은 [📤 내일 일정 팀에 보내기](hjWoTomorrowView)에서 빠졌다
   (📤 일정 공유는 v354 부터 넣음). 이미 보냈는지(sentId)는 일정 id 만 대조해, 이어지는 날을 넣으면 둘째 날 지시가 첫날 번호를 다시 쓰게 된다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-10(화) 10:00 고정, 다운로드·복사는 기록용 스텁, 바깥 쓰기 0.
   ① 하루치 = 그날 시작 + 이어지는 날(완료 보고·일요일·💰 제외) · 시간순 · 제목 '(2/3일째)' · due 그날 · items.day · 형식·개인정보 검사 그대로 (BUILD)
   ② 창 → 저장(원자 저장 1번·안전판 1개) → 같은 날 다시 열면 같은 번호(다시 보냄) → 다음 날은 새 번호·기록 2개 (RESEND)
   ③ 옛 기록(items.day 없음)은 그 일정 시작일로 읽는다 — 시작일 지시는 같은 번호(v444 그대로) · 이어지는 날은 새 번호 · 폰 390 넘침 없음 ·
      44px · 열기만으로 저장 자료 그대로 · 페이지 오류 0 · 외부 쓰기 0 (LEGACY)
   HJ_V587_BASELINE=<commit> 은 ① 에서, HJ_V587_MUTATION=start-only(이어지는 날을 안 더함)는 ①, no-day-key(그날 대조를 뺌)는 ② 에서 실패해야 한다. */
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
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'start-only': ['.filter(s=>s&&s.date===day&&hjWoDayOk(s)).concat(hjSchContinuing(day,hjWoDayOk).map(x=>x.s))', '.filter(s=>s&&s.date===day&&hjWoDayOk(s))'],
  'no-day-key': ["String(x.ref)===String(s.id)&&String(x.day||s.date)===day));return w?w.packetId:'';};", "String(x.ref)===String(s.id)));return w?w.packetId:'';};"]
};
let html = process.env.HJ_V587_BASELINE ? execFileSync('git', ['show', process.env.HJ_V587_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V587_MUTATION) {
  const m = MUT[process.env.HJ_V587_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V587_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const CUST = { name: 'TEST김손님', phone: '010-5555-7777', addr: '대전 서구 가온로 1 101동 702호' };
const D10 = '2026-11-10', D11 = '2026-11-11', D12 = '2026-11-12';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS wodaymulti-v587 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 820 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile, isMobile: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_morning_shown', '2026-11-10');
    window.__v587 = { downloads: [], copies: [], snapshots: [] };
  });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    hjWoDownload = (text, name) => { __v587.downloads.push({ name, text }); };
    coworkCopy = text => { __v587.copies.push(String(text)); };
    const realSnap = hjSnapshot; hjSnapshot = async (label, force, allowEmpty) => { __v587.snapshots.push(String(label)); return realSnap(label, force, allowEmpty); };
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
async function seed(page, legacy) {
  await page.evaluate(async ({ CUST, legacy }) => {
    closeModal(true); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; window.__tabStale = false;
    const P = (name, kind) => ({ name, kind, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: CUST.name, phone: CUST.phone, addr: CUST.addr }, archived: false });
    state.projects = [P('가온아파트 욕실', 'interior'), P('나래빌라 주방', 'interior'), P('다솜상가', 'interior')];
    state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.quotes = []; state.asLog = []; state.workLogs = []; state.contacts = [];
    state._demo = false; state.dirHandle = null; state.editingQuote = null;
    const S = (id, date, time, title, project, extra) => Object.assign({ id, date, time, title, project, workers: '', hours: 8, memo: '', report: null }, extra || {});
    state.schedule = [
      S('MULTI', '2026-11-10', '09:00', '타일 (3일차 시작)', '가온아파트 욕실', { crew: '김타일', memo: '2026-11-10~2026-11-12 (3일)\n고객 ' + CUST.name + ' ' + CUST.phone + ' 확인\n잔금 30만원' }),
      S('DONEM', '2026-11-10', '08:00', '도배 (3일차 시작)', '나래빌라 주방', { memo: '2026-11-10~2026-11-12 (3일)', report: { progress: '완료', done: '도배 끝' } }),
      S('START', '2026-11-11', '13:00', '설비 점검', '나래빌라 주방', { crew: '박설비' }),
      S('MONEY', '2026-11-11', '', '💰 수금: 나래빌라 주방', '나래빌라 주방'),
      S('NOPJ', '2026-11-11', '10:00', '현장 없는 일정', ''),
      S('SUNM', '2026-11-14', '09:00', '목공 (4일차 시작)', '다솜상가', { memo: '2026-11-14~2026-11-18 (4일)' })];
    if (legacy) {   // v444 이 남긴 옛 기록 — items[].day 없음
      const rec = (packetId, ref, due) => ({ at: '2026-11-09T01:00:00.000Z', packetId, sentAt: '2026-11-09T01:00:00.000Z', via: 'file', worker: '', title: ref, date: due, assignee: '', due, priority: 'normal', checklist: ['완료 사진'], photosWanted: ['before'], guideKey: 'finish', items: [{ kind: 'sched', ref, text: ref }], reports: [] });
      state.projects[1].workOrders = [rec('wo_20261109_001', 'START', '2026-11-11')];
      state.projects[0].workOrders = [rec('wo_20261109_002', 'MULTI', '2026-11-10')];
    }
    state.activeProject = null; state.tab = 'schedule'; state.search = ''; for (const k of Object.keys(__v587)) __v587[k] = [];
    render(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V587_SEED_SAVE_FAILED');
  }, { CUST, legacy: !!legacy });
}
const snap = page => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')) }; });
const close = page => page.evaluate(() => closeModal(true));
const footer = (page, text) => page.locator('#modalRoot .mfoot button', { hasText: text });

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await seed(page);
    await test('① 하루치 = 그날 시작 + 이어지는 날 · 시간순 · (2/3일째) · due·items.day · 형식·개인정보 그대로 (BUILD)', async () => {
      const r = await page.evaluate(({ D11, CUST }) => {
        const b = hjWoBuildDay(D11), o = b.packet.orders, json = JSON.stringify(b.packet);
        return { ids: o.map(x => x.id), titles: o.map(x => x.title), due: o.map(x => x.due), time: o.map(x => x.startTime || ''), who: o.map(x => x.assignee), guide: o.map(x => x.guideKey), check: o[0].checklist.join('|'),
          items: b.refs.map(r => r.items), again: b.refs.map(r => r.again), issues: b.refs.map(r => r.issues), schema: hjWoValidate(b.packet), detail: o[0].detail,
          priv: json.includes(CUST.name) || json.replace(/\D/g, '').includes(CUST.phone.replace(/\D/g, '')) || /\d[\d,]*\s*(?:만\s*)?원/.test(json), tile: HJ_WO_CHECKLIST_BY['타일'].join('|') };
      }, { D11, CUST });
      assert.deepEqual(r.titles, ['타일 (타일) (2/3일째)', '설비 점검 (설비)'], '이어지는 날 포함 · 완료 보고·💰·현장 없는 일정 제외 · 공정표 꼬리 뗌 — ' + JSON.stringify(r.titles));
      assert.deepEqual(r.ids, ['wo_20261110_001', 'wo_20261110_002'], '번호는 보내는 날 기준 다음 번호');
      assert.deepEqual(r.due, [D11, D11], 'due 는 그날'); assert.deepEqual(r.time, ['09:00', '13:00'], '시간순');
      assert.deepEqual(r.who, ['김타일', '박설비']); assert.deepEqual(r.guide, ['tile', 'finish']); assert.equal(r.check, r.tile, '공종 체크리스트 그대로');
      assert.deepEqual(r.items, [[{ kind: 'sched', ref: 'MULTI', day: D11, text: '타일 (2/3일째)' }], [{ kind: 'sched', ref: 'START', day: D11, text: '설비 점검' }]]);
      assert.deepEqual(r.again, [false, false]); assert.deepEqual(r.issues, [[], []], '개인정보 검사 통과'); assert.deepEqual(r.schema, [], 'work-order.json 형식 그대로');
      assert.equal(r.priv, false, '고객 이름·전화·금액 없음'); assert.doesNotMatch(r.detail, /잔금|30만원/);
      const d = await page.evaluate(() => ({
        start: hjWoBuildDay('2026-11-10').packet.orders.map(o => [o.title, o.due]),
        d12: hjWoBuildDay('2026-11-12').packet.orders.map(o => o.title),
        d13: hjWoBuildDay('2026-11-13'),
        sun: hjWoBuildDay('2026-11-15'),
        mon: hjWoBuildDay('2026-11-16').packet.orders.map(o => o.title)
      }));
      assert.deepEqual(d.start, [['도배 (3일차 시작) (도배)', D10], ['타일 (3일차 시작) (타일)', D10]], '시작일 지시는 예전 모양 그대로 — ' + JSON.stringify(d.start));
      assert.deepEqual(d.d12, ['타일 (타일) (3/3일째)']); assert.equal(d.d13, null, '끝난 다음 날은 없음');
      assert.equal(d.sun, null, '일요일은 이어지는 날이 아님'); assert.deepEqual(d.mon, ['목공 (2/4일째)']);
    });
    await test('② 창 → 저장 → 같은 날 다시 = 같은 번호 → 다음 날 = 새 번호 (RESEND)', async () => {
      const before = await snap(page);
      await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
      assert.deepEqual(await page.locator('[data-wo-day-order]').evaluateAll(n => n.map(x => x.dataset.woDayOrder)), ['wo_20261110_001', 'wo_20261110_002']);
      assert.equal(await page.locator('[data-wo-day-resend]').count(), 0);
      assert.equal(await page.locator('#woDayStatus [data-wo-day-privacy="ok"]').count(), 1);
      assert.match(await page.locator('#hjWoDay').textContent(), /타일 \(타일\) \(2\/3일째\)/);
      assert.deepEqual(await snap(page), before, '창을 여는 것은 읽기만');
      await footer(page, '💾 JSON 저장').click();
      await page.waitForFunction(() => hjWoOrders(state.projects[0]).length === 1 && hjWoOrders(state.projects[1]).length === 1);
      const r1 = await page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const st = await idbGetStrict('appState');
        const w = hjWoOrders(state.projects[0])[0];
        return { w: [w.packetId, w.due, w.items.map(x => x.ref + '@' + x.day).join()], stored: (st.projects[0].workOrders || []).map(x => x.items.map(i => i.day).join()), snaps: __v587.snapshots.slice(), dl: __v587.downloads.map(d => d.name), notes: state.notes.filter(n => /^\[팀 지시\]/.test(n.text)).map(n => n.text) }; });
      assert.deepEqual(r1.w, ['wo_20261110_001', D11, 'MULTI@' + D11]); assert.deepEqual(r1.stored, [D11], '저장본에도 그날');
      assert.deepEqual(r1.snaps, ['팀 지시(하루치) 기록 전'], '안전판 1개'); assert.deepEqual(r1.dl, ['work-order_20261111_2건.json']);
      assert.ok(r1.notes.some(t => /^\[팀 지시\] 11\/11\(수\) 타일 \(타일\) \(2\/3일째\)/.test(t)), JSON.stringify(r1.notes));
      const sent = JSON.parse(await page.evaluate(() => __v587.downloads[0].text));
      assert.deepEqual(await page.evaluate(p => hjWoValidate(p), sent), []);
      await close(page);
      // 같은 날 다시 — 같은 번호, 기록은 resent 만
      await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
      assert.equal(await page.locator('[data-wo-day-resend]').count(), 2, '같은 날 다시 열면 둘 다 다시 보냄');
      assert.deepEqual(await page.locator('[data-wo-day-order]').evaluateAll(n => n.map(x => x.dataset.woDayOrder)), ['wo_20261110_001', 'wo_20261110_002']);
      await footer(page, '📋 복사').click();
      await page.waitForFunction(() => hjWoOrders(state.projects[0])[0].resent === 1);
      assert.deepEqual(await page.evaluate(() => [hjWoOrders(state.projects[0]).length, hjWoOrders(state.projects[1]).length]), [1, 1]);
      await close(page);
      // 다음 날(셋째 날) — 같은 공정이어도 새 지시·새 번호
      await page.evaluate(() => hjWoTomorrowView('2026-11-12')); await page.locator('#hjWoDay').waitFor();
      assert.equal(await page.locator('[data-wo-day-resend]').count(), 0, '다음 날은 다시 보냄이 아님 — WO_DAY_NEW_ID');
      assert.deepEqual(await page.locator('[data-wo-day-order]').evaluateAll(n => n.map(x => x.dataset.woDayOrder)), ['wo_20261110_003']);
      await footer(page, '💾 JSON 저장').click();
      await page.waitForFunction(() => hjWoOrders(state.projects[0]).length === 2);
      const r2 = await page.evaluate(() => hjWoOrders(state.projects[0]).map(w => [w.packetId, w.due, w.title, w.items.map(x => x.day).join()]));
      assert.deepEqual(r2, [['wo_20261110_001', D11, '타일 (타일) (2/3일째)', D11], ['wo_20261110_003', D12, '타일 (타일) (3/3일째)', D12]]);
      await close(page);
      // 다시 둘째 날을 열어도 첫 기록 번호(셋째 날 기록과 섞이지 않음)
      const again = await page.evaluate(() => hjWoBuildDay('2026-11-11').packet.orders.map(o => o.id));
      assert.deepEqual(again, ['wo_20261110_001', 'wo_20261110_002']);
    });
    await test('③ 옛 기록(day 없음)은 시작일로 · 폰 390 넘침 없음·44px · 오류 0 · 외부 쓰기 0 (LEGACY)', async () => {
      await seed(page, true);
      const r = await page.evaluate(() => { const b = hjWoBuildDay('2026-11-11'); return b.refs.map(x => [x.items[0].ref, x.order.id, x.again]); });
      assert.deepEqual(r, [['MULTI', 'wo_20261110_001', false], ['START', 'wo_20261109_001', true]], '옛 기록: 시작일(START 11/11)은 같은 번호 · 첫날(11/10)에 보낸 MULTI 는 둘째 날 새 번호 — ' + JSON.stringify(r));
      const d10 = await page.evaluate(() => hjWoBuildDay('2026-11-10').refs.filter(x => x.items[0].ref === 'MULTI').map(x => [x.order.id, x.again]));
      assert.deepEqual(d10, [['wo_20261109_002', true]], '옛 기록의 시작일엔 같은 번호(v444 그대로)');
      await context.close();
      const m = await open(390, true); await seed(m.page);
      await m.page.evaluate(() => { state.tab = 'schedule'; render(); });
      await m.page.locator('#schTeamTomorrow').click(); await m.page.locator('#hjWoDay').waitFor();
      const w = await m.page.evaluate(() => {
        const btns = [...document.querySelectorAll('#modalRoot .mfoot button')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().height);
        const modal = document.querySelector('#modalRoot .modal');
        return { n: document.querySelectorAll('[data-wo-day-order]').length, btns, over: modal.scrollWidth - modal.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
      });
      assert.equal(w.n, 2); assert.ok(w.btns.length && w.btns.every(h => h >= 44), '아래 단추 44px — ' + JSON.stringify(w.btns));
      assert.ok(w.over <= 1 && w.page <= 1, '폰 가로 넘침 없음 — ' + JSON.stringify(w));
      await m.context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`wodaymulti-v587: ${passed}/3 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL wodaymulti-v587 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
