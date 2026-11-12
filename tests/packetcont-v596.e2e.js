/* v596 📤 팀에 업무 보내기(v432 한 건 보내기) — 여러 날 공정의 이어지는 날도 지시 후보에
   문제(기준선): hjWoCandidates 가 '앞으로의 일정'을 date>=오늘만 골라, 어제 시작한 3일짜리 타일은 오늘(2/3일째)·내일(3/3일째)이 후보에 아예 없었다
   (AGENTS v587 '안 한 것'). 보낸 기록의 일정 항목도 {kind,ref,text} 뿐이라 [📤 내일 일정 팀에 보내기](v587 — 일정 id + 몇째 날로 이미 보낸 지시를 찾음)가
   이어지는 날을 시작일(1)로 읽었다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-11(수) 10:00 고정, 다운로드·복사·공유는 기록용 스텁, 바깥 쓰기 0.
   ① 후보 = 기준일 전에 시작한 공정의 오늘·뒤 이어지는 날('타일 (2/3일째)'·'(3/3일째)', due·day·n) + 예전 시작일 후보(n 1) ·
      완료 보고·💰·세금 자동·끝난 공정·일요일 제외 · 기준일 뒤 시작 공정은 시작일 한 줄 그대로 · 창에 그대로 보이고 기본 체크 · 읽기만 (CANDS)
   ② 보내기 → 기록 items 가 v587 꼴 {kind:'sched',ref,day,n,text}(준비물 항목은 예전 꼴) · 저장본에도 · 보낸 패킷은 hjWoValidate 통과·개인정보 없음 ·
      제목에 고객 이름이 든 이어지는 날은 개인정보 검사에 걸려 보내지 않음 (SEND)
   ③ 같은 이어지는 날을 [📤 내일 일정 팀에 보내기]로 보내면 v432 지시 번호를 다시 씀(새 지시 없음 — 팀 앱에 두 번 생기지 않음) ·
      기록 날짜 따라가기는 몇째 날(n)까지 맞는 항목만(같은 지시 안 둘째 날 항목의 날짜는 그대로) (CROSS)
   ④ 폰 390 넘침 없음 · 후보 줄 44px · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V596_BASELINE=<commit> 과 HJ_V596_MUTATION=no-cont(이어지는 날을 안 더함)·no-filter-cont(이어지는 날에 💰·세금 거르기를 뺌)는 ①,
   no-n(기록에 day·n 을 안 남김)은 ②, ref-only(기록 날짜 따라가기를 일정 id 로만 맞춤)는 ③ 에서 실패해야 한다. */
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
  'no-cont': ["  (state.schedule||[]).filter(s=>hjWoSchOk(s,name)&&s.date<from).forEach(", "  (state.schedule||[]).filter(s=>false).forEach("],
  'no-filter-cont': ["  (state.schedule||[]).filter(s=>hjWoSchOk(s,name)&&s.date<from).forEach(", "  (state.schedule||[]).filter(s=>s&&s.project===name&&s.date<from).forEach("],
  'no-n': ["if(r.kind==='sched'){if(isRealIsoDate(String(x.day||'')))r.day=x.day;const n=Number(x.n);if(Number.isSafeInteger(n)&&n>0)r.n=n;}", ''],
  'ref-only': ["(r.items||[]).find(y=>String(y.ref)===String(x.ref)&&(Number(y.n)||1)===(Number(x.n)||1));", "(r.items||[]).find(y=>String(y.ref)===String(x.ref));"]
};
let html = process.env.HJ_V596_BASELINE ? execFileSync('git', ['show', process.env.HJ_V596_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V596_MUTATION) {
  const m = MUT[process.env.HJ_V596_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V596_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const CUST = { name: 'TEST김손님', phone: '010-5555-7777', addr: '대전 서구 가온로 1 101동 702호' };
const GAON = '가온아파트 욕실', NARA = '나래빌라 주방', DASOM = '다솜상가';
const D11 = '2026-11-11', D12 = '2026-11-12', D13 = '2026-11-13';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS packetcont-v596 ' + name); }
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
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_morning_shown', '2026-11-11');
    window.__v596 = { downloads: [], copies: [], shares: [], snapshots: [] };
  });
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    hjWoDownload = (text, name) => { __v596.downloads.push({ name, text }); };
    hjWoShare = async (text, name) => { __v596.shares.push({ name, text }); return true; };
    coworkCopy = text => { __v596.copies.push(String(text)); };
    const realSnap = hjSnapshot; hjSnapshot = async (label, force, allowEmpty) => { __v596.snapshots.push(String(label)); return realSnap(label, force, allowEmpty); };
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
async function seed(page) {
  await page.evaluate(async ({ CUST, GAON, NARA, DASOM }) => {
    closeModal(true); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false;
    const P = (name, kind) => ({ name, kind, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: CUST.name, phone: CUST.phone, addr: CUST.addr }, archived: false });
    state.projects = [P(GAON, 'interior'), P(NARA, 'interior'), P(DASOM, 'interior')];
    state.projects[0].checklist = [{ id: 'CK1', text: '실리콘 투명 2개', done: false }];
    state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.quotes = []; state.asLog = []; state.workLogs = []; state.contacts = [];
    state._demo = false; state.dirHandle = null; state.editingQuote = null;
    const S = (id, date, time, title, project, extra) => Object.assign({ id, date, time, title, project, workers: '', hours: 8, memo: '', report: null }, extra || {});
    state.schedule = [
      // 어제(11/10, 화) 시작한 3일짜리 타일 — 오늘 2/3일째 · 내일 3/3일째
      S('MULTI', '2026-11-10', '09:00', '타일 (3일차 시작)', GAON, { crew: '김타일', workers: 2, memo: '2026-11-10~2026-11-12 (3일)' }),
      // 거르는 것 — 완료 보고된 공정 · 💰 수금 여러 날 · 세금 자동 · 이미 끝난 공정
      S('DONEM', '2026-11-10', '08:00', '도배 (3일차 시작)', GAON, { memo: '2026-11-10~2026-11-12 (3일)', report: { progress: '완료', done: '도배 끝' } }),
      S('MONM', '2026-11-10', '', '💰 수금: 가온아파트 욕실 (3일차 시작)', GAON, { memo: '2026-11-10~2026-11-12 (3일)' }),
      S('TAXM', '2026-11-10', '', '부가세 준비 (3일차 시작)', GAON, { _taxAuto: true, memo: '2026-11-10~2026-11-12 (3일)' }),
      S('OLD', '2026-11-06', '09:00', '철거 (2일차 시작)', GAON, { memo: '2026-11-06~2026-11-07 (2일)' }),
      // 기준일 뒤에 시작하는 여러 날 공정 — 예전처럼 시작일 한 줄
      S('PAINT', '2026-11-13', '09:00', '도장 (2일차 시작)', GAON, { memo: '2026-11-13~2026-11-14 (2일)' }),
      // 제목에 고객 이름 — 개인정보 검사에 걸린다(오늘이 2/2일째)
      S('PRIV', '2026-11-10', '09:00', '도배 ' + CUST.name + ' 댁 (2일차 시작)', NARA, { memo: '2026-11-10~2026-11-11 (2일)' }),
      // 일요일(11/15) 낀 6일짜리 목공 — 이어지는 날 11·12·13·14·16
      S('SUNM', '2026-11-10', '09:00', '목공 (6일차 시작)', DASOM, { memo: '2026-11-10~2026-11-16 (6일)' })];
    state.activeProject = GAON; state.tab = 'project'; state.search = ''; for (const k of Object.keys(__v596)) __v596[k] = [];
    render(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V596_SEED_SAVE_FAILED');
  }, { CUST, GAON, NARA, DASOM });
}
const snap = page => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')) }; });
const close = page => page.evaluate(() => closeModal(true));
const footer = (page, text) => page.locator('#modalRoot .mfoot button', { hasText: text });

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390, true);
    await seed(page);
    const before = await snap(page);

    await test('① 후보 = 기준일 전 시작 공정의 이어지는 날 + 시작일 · 거르기 · 창에 그대로 · 읽기만 (CANDS)', async () => {
      const c = await page.evaluate(({ GAON, DASOM }) => {
        const pick = x => ({ key: x.key, text: x.text, due: x.due, day: x.day, n: x.n, crew: x.crew });
        return { gaon: hjWoCandidates(GAON).map(pick), dasom: hjWoCandidates(DASOM).filter(x => x.kind === 'sched').map(x => [x.due, x.n, x.text]),
          from12: hjWoCandidates(GAON, '2026-11-12').filter(x => x.kind === 'sched').map(x => x.key) };
      }, { GAON, DASOM });
      const sched = c.gaon.filter(x => /^sch:/.test(x.key));
      assert.deepEqual(sched.map(x => x.key), ['sch:MULTI:2', 'sch:MULTI:3', 'sch:PAINT'],
        '이어지는 날 2줄 + 시작일 후보 · 완료 보고·💰·세금 자동·끝난 공정 제외 — CONT_CANDS ' + JSON.stringify(sched.map(x => x.key)));
      assert.deepEqual(sched.map(x => x.text), ['타일 (2/3일째) (2026-11-11 09:00 · 👷 2명)', '타일 (3/3일째) (2026-11-12 09:00 · 👷 2명)', '도장 (2일차 시작) (2026-11-13 09:00)'],
        "이어지는 날은 '제목 (2/3일째)' — 공정표 꼬리 '(N일차 시작)' 는 뗀다 · 기준일 뒤 시작 공정은 시작일 한 줄 그대로");
      assert.deepEqual(sched.map(x => [x.due, x.day, x.n]), [[D11, D11, 2], [D12, D12, 3], [D13, D13, 1]], 'due·day 는 그날 · n 은 몇째 날(시작일 1)');
      assert.deepEqual(sched[0].crew, ['김타일'], '담당 그대로');
      assert.deepEqual(c.gaon.filter(x => !/^sch:/.test(x.key)).map(x => x.key), ['prep:CK1'], '준비물 후보 그대로');
      assert.deepEqual(c.dasom, [[D11, 2, '목공 (2/6일째) (2026-11-11 09:00)'], [D12, 3, '목공 (3/6일째) (2026-11-12 09:00)'], [D13, 4, '목공 (4/6일째) (2026-11-13 09:00)'],
        ['2026-11-14', 5, '목공 (5/6일째) (2026-11-14 09:00)'], ['2026-11-16', 6, '목공 (6/6일째) (2026-11-16 09:00)']], '일요일(11/15)은 이어지는 날이 아님 ' + JSON.stringify(c.dasom));
      assert.deepEqual(c.from12, ['sch:MULTI:3', 'sch:PAINT'], '기준일을 넘기면 그날부터 — 지난 이어지는 날은 빠짐');
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const ui = await page.evaluate(() => ({ keys: [...document.querySelectorAll('[data-wo-item]')].map(x => [x.dataset.woItem, x.checked]),
        labels: [...document.querySelectorAll('[data-wo-item]')].map(x => x.closest('label').textContent.trim()), detail: document.getElementById('woDetail').value,
        priv: document.querySelector('[data-wo-privacy]') && document.querySelector('[data-wo-privacy]').dataset.woPrivacy }));
      assert.deepEqual(ui.keys, [['prep:CK1', true], ['sch:MULTI:2', true], ['sch:MULTI:3', true], ['sch:PAINT', true]], '창에 그대로 · 기본 체크 ' + JSON.stringify(ui.keys));
      assert.ok(ui.labels.some(t => /^🗓 타일 \(2\/3일째\)/.test(t)) && ui.labels.some(t => /^🗓 타일 \(3\/3일째\)/.test(t)), JSON.stringify(ui.labels));
      assert.match(ui.detail, /· 타일 \(2\/3일째\)[\s\S]*· 타일 \(3\/3일째\)/, '내용 칸도 이어지는 날');
      assert.equal(ui.priv, 'ok', '개인정보 검사 통과');
      await close(page);
      assert.deepEqual(await snap(page), before, '후보를 만들고 창을 여는 것은 읽기만');
    });

    await test('② 보내기 → items {kind,ref,day,n,text} · 저장본 · 형식·개인정보 · 고객 이름 든 이어지는 날은 막힘 (SEND)', async () => {
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const id = JSON.parse(await page.locator('#woPreview').evaluate(n => n.textContent)).orders[0].id;
      await footer(page, 'JSON 저장').click();
      await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, GAON);
      const r = await page.evaluate(async ({ GAON, CUST }) => {
        clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
        const w = hjWoOrders(state.projects.find(p => p.name === GAON))[0], st = await idbGetStrict('appState'), pk = JSON.parse(__v596.downloads[0].text);
        return { id: w.packetId, due: w.due, items: w.items, stored: st.projects.find(p => p.name === GAON).workOrders[0].items, schema: hjWoValidate(pk), issues: hjWoPrivacyIssues(pk, state.projects[0]),
          json: JSON.stringify(pk), snaps: __v596.snapshots.slice(), dl: __v596.downloads.map(d => d.name), note: state.notes.filter(n => /^\[팀 지시\]/.test(n.text)).map(n => n.text) };
      }, { GAON, CUST });
      assert.equal(r.id, id); assert.equal(r.due, D12, '기한은 예전처럼 내일');
      assert.deepEqual(r.items, [
        { kind: 'prep', ref: 'CK1', text: '준비물: 실리콘 투명 2개' },
        { kind: 'sched', ref: 'MULTI', day: D11, n: 2, text: '타일 (2/3일째) (2026-11-11 09:00 · 👷 2명)' },
        { kind: 'sched', ref: 'MULTI', day: D12, n: 3, text: '타일 (3/3일째) (2026-11-12 09:00 · 👷 2명)' },
        { kind: 'sched', ref: 'PAINT', day: D13, n: 1, text: '도장 (2일차 시작) (2026-11-13 09:00)' }], '일정 항목은 v587 꼴(그날·몇째 날) — WO_ITEMS_N ' + JSON.stringify(r.items));
      assert.deepEqual(r.stored, r.items, '저장본에도 그대로');
      assert.deepEqual(r.schema, [], 'work-order.json 형식 그대로'); assert.deepEqual(r.issues, [], '개인정보 검사 통과');
      assert.ok(!r.json.includes(CUST.name) && !r.json.replace(/\D/g, '').includes(CUST.phone.replace(/\D/g, '')), '고객 이름·전화 없음');
      assert.match(r.json, /타일 \(2\/3일째\)[\s\S]*타일 \(3\/3일째\)/, '패킷 내용에 이어지는 날');
      assert.deepEqual(r.snaps, ['팀 지시 기록 전'], '안전판 1개'); assert.deepEqual(r.dl, ['work-order_' + id + '.json']);
      assert.ok(r.note.length === 1 && r.note[0].endsWith('4건 → 김타일 · ' + id), '담당은 공정의 담당(김타일) · ' + JSON.stringify(r.note));
      await close(page);
      // 개인정보 검사는 그대로 — 제목에 고객 이름이 든 이어지는 날(오늘 2/2일째)은 보내지 않는다
      await page.evaluate(name => hjTeamPacketSendView(name), NARA); await page.locator('#hjTeamPacket').waitFor();
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-wo-item]')].map(x => x.dataset.woItem)), ['sch:PRIV:2'], '고객 이름이 든 이어지는 날도 후보');
      assert.equal(await page.locator('[data-wo-privacy="fail"]').count(), 1, '개인정보 검사에 걸림 — WO_PRIVACY_CONT');
      await footer(page, 'JSON 저장').click(); await page.waitForTimeout(300);
      assert.deepEqual(await page.evaluate(name => [hjWoOrders(state.projects.find(p => p.name === name)).length, __v596.downloads.length], NARA), [0, 1], '보내지도 기록하지도 않음');
      await close(page);
    });

    await test('③ 같은 이어지는 날을 [📤 내일 일정 팀에 보내기]로 — 같은 번호 · 몇째 날까지 맞는 항목만 날짜 따라감 (CROSS)', async () => {
      const id = await page.evaluate(name => hjWoOrders(state.projects.find(p => p.name === name))[0].packetId, GAON);
      const built = await page.evaluate(() => ({ d12: hjWoBuildDay('2026-11-12').refs.map(x => [x.name, x.items[0].ref, x.items[0].n, x.order.id, x.again]),
        d11: hjWoBuildDay('2026-11-11').refs.filter(x => x.items[0].ref === 'MULTI').map(x => [x.order.id, x.again]) }));
      assert.deepEqual(built.d12.filter(x => x[0] === GAON), [[GAON, 'MULTI', 3, id, true]], '내일(3/3일째)은 v432 지시 번호를 다시 씀 — CROSS_SAME_ID ' + JSON.stringify(built.d12));
      assert.deepEqual(built.d11, [[id, true]], '오늘(2/3일째)도 같은 번호');
      assert.deepEqual(built.d12.filter(x => x[0] === DASOM).map(x => [x[2], x[4]]), [[3, false]], '보낸 적 없는 공정은 새 번호');
      await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
      assert.equal(await page.locator('[data-wo-day-resend]').count(), 1, "가온 줄은 '↻ 다시 보냄(같은 번호)'");
      await footer(page, '💾 JSON 저장').click();
      await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, DASOM);
      const r = await page.evaluate(async ({ GAON }) => {
        clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
        const ws = hjWoOrders(state.projects.find(p => p.name === GAON)), st = await idbGetStrict('appState');
        return { n: ws.length, resent: Number(ws[0].resent) || 0, items: ws[0].items.map(x => x.kind + ':' + x.ref + '@' + (x.day || '') + '#' + (x.n || '')),
          stored: st.projects.find(p => p.name === GAON).workOrders[0].items.map(x => x.ref + '@' + (x.day || '') + '#' + (x.n || '')) };
      }, { GAON });
      assert.equal(r.n, 1, '가온은 새 지시가 생기지 않음(팀 앱에 같은 이어지는 날 지시가 둘 생기지 않게)'); assert.equal(r.resent, 1);
      assert.deepEqual(r.items, ['prep:CK1@#', 'sched:MULTI@2026-11-11#2', 'sched:MULTI@2026-11-12#3', 'sched:PAINT@2026-11-13#1'],
        '둘째 날 항목의 날짜는 그대로 — 몇째 날까지 맞는 항목만 따라감 — CROSS_DAY_BY_N ' + JSON.stringify(r.items));
      assert.deepEqual(r.stored, ['CK1@#', 'MULTI@2026-11-11#2', 'MULTI@2026-11-12#3', 'PAINT@2026-11-13#1'], '저장본에도');
      await close(page);
    });

    await test('④ 폰 390 넘침 없음 · 후보 줄 44px · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const w = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-wo-item]')].map(x => x.closest('label').getBoundingClientRect().height);
        const btns = [...document.querySelectorAll('#modalRoot .mfoot button')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().height);
        const modal = document.querySelector('#modalRoot .modal');
        return { rows, btns, over: modal.scrollWidth - modal.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
      });
      assert.ok(w.rows.length === 4 && w.rows.every(h => h >= 44), '후보 줄 44px — ' + JSON.stringify(w.rows));
      assert.ok(w.btns.length && w.btns.every(h => h >= 44), '아래 단추 44px — ' + JSON.stringify(w.btns));
      assert.ok(w.over <= 1 && w.page <= 1, '폰 가로 넘침 없음 — ' + JSON.stringify(w));
      await close(page);
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
  } catch (error) {
    console.error('FAIL packetcont-v596 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  console.log('packetcont-v596: ' + passed + '/4');
  if (passed !== 4) process.exitCode = 1;
})();
