/* v596 📤 팀에 업무 보내기(v432 한 건 보내기) — 여러 날 공정의 이어지는 날도 지시 후보에
   문제(기준선): hjWoCandidates 가 '앞으로의 일정'을 date>=오늘만 골라, 어제 시작한 3일짜리 타일은 오늘(2/3일째)·내일(3/3일째)이 후보에 아예 없었다
   (AGENTS v587 '안 한 것'). 보낸 기록의 일정 항목도 {kind,ref,text} 뿐이라 [📤 내일 일정 팀에 보내기](v587 — 일정 id + 몇째 날로 이미 보낸 지시를 찾음)가
   이어지는 날을 시작일(1)로 읽었다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-11(수) 10:00 고정, 다운로드·복사·공유는 기록용 스텁, 바깥 쓰기 0.
   ① 후보 = 기준일·다음 작업일의 이어지는 날('타일 (2/3일째)'·'(3/3일째)', due·day·n — 어제 시작한 공정도, 오늘 시작한 공정의 내일도) + 예전 시작일 후보(n 1) ·
      완료 보고·💰·세금 자동·끝난 공정·일요일 제외 · 긴 공정은 오늘·다음 작업일 두 줄만(토요일이면 월요일까지) · 시작일 후보 10개는 이어지는 날에 밀리지 않음 ·
      창에 그대로 보이고 기본 체크 · 팀원이 섞이면 담당 비우고 알림 · 읽기만 (CANDS)
   ② 보내기 → 기록 items 가 v587 꼴 {kind:'sched',ref,day,n,text}(준비물 항목은 예전 꼴) · 저장본에도 · 보낸 패킷은 hjWoValidate 통과·개인정보 없음 ·
      팀원이 섞인 묶음은 담당 없이 · 제목에 고객 이름이 든 이어지는 날은 개인정보 검사에 걸려 보내지 않음 (SEND)
   ③ [📤 내일 일정 팀에 보내기](v587)와 번호 — 이어지는 날 하나만 보낸 v432 지시는 같은 번호로 다시 보냄(새 지시 없음) · 여러 항목을 묶은 v432 지시의 날은
      새 번호(둘째·셋째 날이 같은 번호로 겹치지 않고, 한 패킷에 같은 번호 둘 없고, 묶음의 기한·다시 보낸 수 그대로, 하루치 완료 보고가 묶음 준비물을 완료로
      만들지 않음) · 한 패킷 안 같은 번호 막기(옛 자료 충돌·형식 검사) (CROSS)
   ④ 폰 390 넘침 없음 · 후보 줄 44px · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V596_BASELINE=<commit> 과 HJ_V596_MUTATION=no-cont(이어지는 날을 안 더함)·no-filter-cont(이어지는 날에 💰·세금 거르기를 뺌)·no-window(기간 전체를 늘어놓음)·
   joint-slice(이어지는 날과 시작일을 함께 10개로 자름)·start-before(오늘 시작한 공정의 내일을 뺌)·crew-first(첫 일정의 팀원을 담당으로)는 ①,
   no-n(기록에 day·n 을 안 남김)은 ②, bundle-reuse(묶음 지시 번호를 하루치로 다시 씀)·no-used(한 패킷 안 같은 번호를 막지 않음)·no-dup-check(형식 검사가 같은 번호를
   안 봄)는 ③ 에서 실패해야 한다. */
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
const CONT = "  (state.schedule||[]).filter(s=>hjWoSchOk(s,name)&&s.date<=from).forEach(s=>hjSchContDates(s).filter(d=>d>=from&&d<=to).forEach(";
const MUT = {
  'no-cont': [[CONT, "  (state.schedule||[]).filter(s=>false).forEach(s=>hjSchContDates(s).filter(d=>d>=from&&d<=to).forEach("]],
  'no-filter-cont': [[CONT, "  (state.schedule||[]).filter(s=>s&&s.project===name&&s.date<=from).forEach(s=>hjSchContDates(s).filter(d=>d>=from&&d<=to).forEach("]],
  'no-window': [[CONT, CONT.replace('d>=from&&d<=to', 'd>=from')]],
  'start-before': [[CONT, CONT.replace('s.date<=from', 's.date<from')]],
  'joint-slice': [['.map(s=>({s,day:s.date,c:null})).sort(byDay).slice(0,10),to=', '.map(s=>({s,day:s.date,c:null})),to='], ['  rows.sort(byDay)\n    .forEach(', '  rows.sort(byDay).slice(0,10)\n    .forEach(']],
  'no-n': [["if(r.kind==='sched'){if(isRealIsoDate(String(x.day||'')))r.day=x.day;const n=Number(x.n);if(Number.isSafeInteger(n)&&n>0)r.n=n;}", '']],
  'crew-first': [["s.assignee=a?a.assignee:(crews.length===1?crews[0]:'');", "s.assignee=a?a.assignee:(crews.length?crews[0]:'');"]],
  'bundle-reuse': [["Array.isArray(w.items)&&w.items.length===1&&w.items.some(", "Array.isArray(w.items)&&w.items.some("]],
  'no-used': [["&&!used.has(w.packetId)&&", "&&"]],
  'no-dup-check': [["else if(ids.has(o.id))e.push('orders['+i+'].id 중복');else ids.add(o.id);", '']]
};
let html = process.env.HJ_V596_BASELINE ? execFileSync('git', ['show', process.env.HJ_V596_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V596_MUTATION) {
  const m = MUT[process.env.HJ_V596_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V596_MUTATION);
  html = SRC; for (const [a, b] of m) { assert.equal(html.split(a).length, 2, 'mutation anchor ' + a.slice(0, 60)); html = html.replace(a, b); }
}
const CUST = { name: 'TEST김손님', phone: '010-5555-7777', addr: '대전 서구 가온로 1 101동 702호' };
const GAON = '가온아파트 욕실', NARA = '나래빌라 주방', DASOM = '다솜상가', LAON = '라온주택';
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
  await page.evaluate(async ({ CUST, GAON, NARA, DASOM, LAON }) => {
    closeModal(true); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false;
    const P = (name, kind) => ({ name, kind, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: CUST.name, phone: CUST.phone, addr: CUST.addr }, archived: false });
    state.projects = [P(GAON, 'interior'), P(NARA, 'interior'), P(DASOM, 'interior'), P(LAON, 'interior')];
    state.projects[0].checklist = [{ id: 'CK1', text: '실리콘 투명 2개', done: false }];
    state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.quotes = []; state.asLog = []; state.workLogs = []; state.contacts = [];
    state._demo = false; state.dirHandle = null; state.editingQuote = null;
    const S = (id, date, time, title, project, extra) => Object.assign({ id, date, time, title, project, workers: '', hours: 8, memo: '', report: null }, extra || {});
    state.schedule = [
      // 어제(11/10, 화) 시작한 3일짜리 타일 — 오늘 2/3일째 · 내일 3/3일째 · 같은 기간 다른 팀원의 전기(같은 날 둘 — 묶음 번호·담당 섞임)
      S('MULTI', '2026-11-10', '09:00', '타일 (3일차 시작)', GAON, { crew: '김타일', workers: 2, memo: '2026-11-10~2026-11-12 (3일)' }),
      S('ELEC', '2026-11-10', '13:00', '전기 (3일차 시작)', GAON, { crew: '박전기', memo: '2026-11-10~2026-11-12 (3일)' }),
      // 거르는 것 — 완료 보고된 공정 · 💰 수금 여러 날 · 세금 자동 · 이미 끝난 공정
      S('DONEM', '2026-11-10', '08:00', '도배 (3일차 시작)', GAON, { memo: '2026-11-10~2026-11-12 (3일)', report: { progress: '완료', done: '도배 끝' } }),
      S('MONM', '2026-11-10', '', '💰 수금: 가온아파트 욕실 (3일차 시작)', GAON, { memo: '2026-11-10~2026-11-12 (3일)' }),
      S('TAXM', '2026-11-10', '', '부가세 준비 (3일차 시작)', GAON, { _taxAuto: true, memo: '2026-11-10~2026-11-12 (3일)' }),
      S('OLD', '2026-11-06', '09:00', '철거 (2일차 시작)', GAON, { memo: '2026-11-06~2026-11-07 (2일)' }),
      // 기준일 뒤에 시작하는 여러 날 공정 — 예전처럼 시작일 한 줄
      S('PAINT', '2026-11-13', '09:00', '도장 (2일차 시작)', GAON, { memo: '2026-11-13~2026-11-14 (2일)' }),
      // 제목에 고객 이름 — 개인정보 검사에 걸린다(오늘이 2/2일째)
      S('PRIV', '2026-11-10', '09:00', '도배 ' + CUST.name + ' 댁 (2일차 시작)', NARA, { memo: '2026-11-10~2026-11-11 (2일)' }),
      // 일요일(11/15) 낀 6일짜리 목공 — 이어지는 날 11·12·13·14·16, 후보는 오늘·다음 작업일만
      S('SUNM', '2026-11-10', '09:00', '목공 (6일차 시작)', DASOM, { crew: '이목수', memo: '2026-11-10~2026-11-16 (6일)' }),
      // 두 주짜리 목공(이어지는 날이 시작일 후보 10개를 밀어내면 안 됨) · 오늘 시작한 2일짜리 마루(내일이 2/2일째) · 시작일 후보 9개(마루 포함 10개)
      S('LONG', '2026-11-10', '09:00', '목공 (12일차 시작)', LAON, { memo: '2026-11-10~2026-11-23 (12일)' }),
      S('FLOOR', '2026-11-11', '08:00', '마루 (2일차 시작)', LAON, { memo: '2026-11-11~2026-11-12 (2일)' }),
      ...Array.from({ length: 9 }, (_, i) => S('CL' + (i + 1), '2026-11-' + (12 + i), '10:00', '마감 점검 ' + (i + 1), LAON))];
    state.activeProject = GAON; state.tab = 'project'; state.search = ''; for (const k of Object.keys(__v596)) __v596[k] = [];
    render(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V596_SEED_SAVE_FAILED');
  }, { CUST, GAON, NARA, DASOM, LAON });
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

    await test('① 후보 = 오늘·다음 작업일의 이어지는 날 + 시작일 · 거르기 · 긴 공정 두 줄 · 시작일 10개 그대로 · 창에 그대로 · 담당 섞임 · 읽기만 (CANDS)', async () => {
      const c = await page.evaluate(({ GAON, DASOM, LAON }) => {
        const pick = x => ({ key: x.key, text: x.text, due: x.due, day: x.day, n: x.n, crew: x.crew });
        return { gaon: hjWoCandidates(GAON).map(pick), dasom: hjWoCandidates(DASOM).filter(x => x.kind === 'sched').map(x => [x.due, x.n, x.text]),
          from12: hjWoCandidates(GAON, '2026-11-12').filter(x => x.kind === 'sched').map(x => x.key),
          sat: hjWoCandidates(DASOM, '2026-11-14').filter(x => x.kind === 'sched').map(x => [x.key, x.due]),
          laon: hjWoCandidates(LAON).filter(x => x.kind === 'sched').map(x => [x.key, x.text]) };
      }, { GAON, DASOM, LAON });
      const sched = c.gaon.filter(x => /^sch:/.test(x.key));
      assert.deepEqual(sched.map(x => x.key), ['sch:MULTI:2', 'sch:ELEC:2', 'sch:MULTI:3', 'sch:ELEC:3', 'sch:PAINT'],
        '이어지는 날(오늘·내일) + 시작일 후보 · 완료 보고·💰·세금 자동·끝난 공정 제외 — CONT_CANDS ' + JSON.stringify(sched.map(x => x.key)));
      assert.deepEqual(sched.map(x => x.text), ['타일 (2/3일째) (2026-11-11 09:00 · 👷 2명)', '전기 (2/3일째) (2026-11-11 13:00)', '타일 (3/3일째) (2026-11-12 09:00 · 👷 2명)',
        '전기 (3/3일째) (2026-11-12 13:00)', '도장 (2일차 시작) (2026-11-13 09:00)'],
        "이어지는 날은 '제목 (2/3일째)' — 공정표 꼬리 '(N일차 시작)' 는 뗀다 · 기준일 뒤 시작 공정은 시작일 한 줄 그대로");
      assert.deepEqual(sched.map(x => [x.due, x.day, x.n]), [[D11, D11, 2], [D11, D11, 2], [D12, D12, 3], [D12, D12, 3], [D13, D13, 1]], 'due·day 는 그날 · n 은 몇째 날(시작일 1)');
      assert.deepEqual([sched[0].crew, sched[1].crew], [['김타일'], ['박전기']], '담당 그대로');
      assert.deepEqual(c.gaon.filter(x => !/^sch:/.test(x.key)).map(x => x.key), ['prep:CK1'], '준비물 후보 그대로');
      assert.deepEqual(c.dasom, [[D11, 2, '목공 (2/6일째) (2026-11-11 09:00)'], [D12, 3, '목공 (3/6일째) (2026-11-12 09:00)']],
        '긴 공정은 오늘·다음 작업일 두 줄만(11/13·14·16 은 그날그날) — CONT_WINDOW ' + JSON.stringify(c.dasom));
      assert.deepEqual(c.sat, [['sch:SUNM:5', '2026-11-14'], ['sch:SUNM:6', '2026-11-16']], '토요일이면 다음 작업일은 월요일 — 일요일(11/15)은 이어지는 날이 아님 ' + JSON.stringify(c.sat));
      assert.deepEqual(c.from12, ['sch:MULTI:3', 'sch:ELEC:3', 'sch:PAINT'], '기준일을 넘기면 그날부터 — 지난 이어지는 날은 빠짐');
      assert.deepEqual(c.laon.map(x => x[0]), ['sch:FLOOR', 'sch:LONG:2', 'sch:FLOOR:2', 'sch:LONG:3', 'sch:CL1', 'sch:CL2', 'sch:CL3', 'sch:CL4', 'sch:CL5', 'sch:CL6', 'sch:CL7', 'sch:CL8', 'sch:CL9'],
        '두 주짜리 목공은 두 줄만 · 시작일 후보 10개(마루 + 마감 점검 9개)는 이어지는 날에 밀리지 않음 · 오늘 시작한 마루의 내일(2/2일째)도 — CONT_SLOTS ' + JSON.stringify(c.laon.map(x => x[0])));
      assert.deepEqual(c.laon.slice(0, 4).map(x => x[1]), ['마루 (2일차 시작) (2026-11-11 08:00)', '목공 (2/12일째) (2026-11-11 09:00)', '마루 (2/2일째) (2026-11-12 08:00)', '목공 (3/12일째) (2026-11-12 09:00)']);
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const ui = await page.evaluate(() => ({ keys: [...document.querySelectorAll('[data-wo-item]')].map(x => [x.dataset.woItem, x.checked]),
        labels: [...document.querySelectorAll('[data-wo-item]')].map(x => x.closest('label').textContent.trim()), detail: document.getElementById('woDetail').value,
        assignee: document.getElementById('woAssignee').value, mixed: (document.querySelector('[data-wo-crew-mixed]') || {}).textContent || '',
        priv: document.querySelector('[data-wo-privacy]') && document.querySelector('[data-wo-privacy]').dataset.woPrivacy }));
      assert.deepEqual(ui.keys, [['prep:CK1', true], ['sch:MULTI:2', true], ['sch:ELEC:2', true], ['sch:MULTI:3', true], ['sch:ELEC:3', true], ['sch:PAINT', true]], '창에 그대로 · 기본 체크 ' + JSON.stringify(ui.keys));
      assert.ok(ui.labels.some(t => /^🗓 타일 \(2\/3일째\)/.test(t)) && ui.labels.some(t => /^🗓 타일 \(3\/3일째\)/.test(t)), JSON.stringify(ui.labels));
      assert.match(ui.detail, /· 타일 \(2\/3일째\)[\s\S]*· 타일 \(3\/3일째\)/, '내용 칸도 이어지는 날');
      assert.equal(ui.assignee, '', '팀원이 섞인 묶음은 담당을 비움(첫 일정의 김타일에게 전기 지시까지 가지 않게) — WO_CREW_MIXED');
      assert.match(ui.mixed, /여러 팀원\(김타일·박전기\)/, '담당을 비운 까닭을 알림');
      assert.equal(ui.priv, 'ok', '개인정보 검사 통과');
      await close(page);
      // 팀원이 한 사람이면 예전처럼 그 사람이 담당
      await page.evaluate(name => hjTeamPacketSendView(name), DASOM); await page.locator('#hjTeamPacket').waitFor();
      assert.deepEqual(await page.evaluate(() => [document.getElementById('woAssignee').value, document.querySelectorAll('[data-wo-crew-mixed]').length]), ['이목수', 0]);
      await close(page);
      assert.deepEqual(await snap(page), before, '후보를 만들고 창을 여는 것은 읽기만');
    });

    let bundle = '';
    await test('② 보내기 → items {kind,ref,day,n,text} · 저장본 · 형식·개인정보 · 섞인 묶음은 담당 없이 · 고객 이름 든 이어지는 날은 막힘 (SEND)', async () => {
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const id = JSON.parse(await page.locator('#woPreview').evaluate(n => n.textContent)).orders[0].id;
      await footer(page, 'JSON 저장').click();
      await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, GAON);
      const r = await page.evaluate(async ({ GAON }) => {
        clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
        const w = hjWoOrders(state.projects.find(p => p.name === GAON))[0], st = await idbGetStrict('appState'), pk = JSON.parse(__v596.downloads[0].text);
        return { id: w.packetId, due: w.due, assignee: w.assignee, items: w.items, stored: st.projects.find(p => p.name === GAON).workOrders[0].items, schema: hjWoValidate(pk), issues: hjWoPrivacyIssues(pk, state.projects[0]),
          json: JSON.stringify(pk), pkAssignee: pk.orders[0].assignee, snaps: __v596.snapshots.slice(), dl: __v596.downloads.map(d => d.name), note: state.notes.filter(n => /^\[팀 지시\]/.test(n.text)).map(n => n.text) };
      }, { GAON });
      assert.equal(r.id, id); assert.equal(r.due, D12, '기한은 예전처럼 내일');
      assert.deepEqual(r.items, [
        { kind: 'prep', ref: 'CK1', text: '준비물: 실리콘 투명 2개' },
        { kind: 'sched', ref: 'MULTI', day: D11, n: 2, text: '타일 (2/3일째) (2026-11-11 09:00 · 👷 2명)' },
        { kind: 'sched', ref: 'ELEC', day: D11, n: 2, text: '전기 (2/3일째) (2026-11-11 13:00)' },
        { kind: 'sched', ref: 'MULTI', day: D12, n: 3, text: '타일 (3/3일째) (2026-11-12 09:00 · 👷 2명)' },
        { kind: 'sched', ref: 'ELEC', day: D12, n: 3, text: '전기 (3/3일째) (2026-11-12 13:00)' },
        { kind: 'sched', ref: 'PAINT', day: D13, n: 1, text: '도장 (2일차 시작) (2026-11-13 09:00)' }], '일정 항목은 v587 꼴(그날·몇째 날) — WO_ITEMS_N ' + JSON.stringify(r.items));
      assert.deepEqual(r.stored, r.items, '저장본에도 그대로');
      assert.deepEqual(r.schema, [], 'work-order.json 형식 그대로'); assert.deepEqual(r.issues, [], '개인정보 검사 통과');
      assert.ok(!r.json.includes(CUST.name) && !r.json.replace(/\D/g, '').includes(CUST.phone.replace(/\D/g, '')), '고객 이름·전화 없음');
      assert.match(r.json, /타일 \(2\/3일째\)[\s\S]*타일 \(3\/3일째\)/, '패킷 내용에 이어지는 날');
      assert.deepEqual(r.snaps, ['팀 지시 기록 전'], '안전판 1개'); assert.deepEqual(r.dl, ['work-order_' + id + '.json']);
      assert.deepEqual([r.assignee, r.pkAssignee], ['', ''], '팀원이 섞인 묶음은 담당 없이 — WO_CREW_MIXED');
      assert.deepEqual(r.note, ['[팀 지시] 11/12(목) 6건 · ' + id], '담당 없이 6건 · ' + JSON.stringify(r.note));
      bundle = id;
      await close(page);
      // 개인정보 검사는 그대로 — 제목에 고객 이름이 든 이어지는 날(오늘 2/2일째)은 보내지 않는다
      await page.evaluate(name => hjTeamPacketSendView(name), NARA); await page.locator('#hjTeamPacket').waitFor();
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-wo-item]')].map(x => x.dataset.woItem)), ['sch:PRIV:2'], '고객 이름이 든 이어지는 날도 후보');
      assert.equal(await page.locator('[data-wo-privacy="fail"]').count(), 1, '개인정보 검사에 걸림 — WO_PRIVACY_CONT');
      await footer(page, 'JSON 저장').click(); await page.waitForTimeout(300);
      assert.deepEqual(await page.evaluate(name => [hjWoOrders(state.projects.find(p => p.name === name)).length, __v596.downloads.length], NARA), [0, 1], '보내지도 기록하지도 않음');
      await close(page);
    });

    await test('③ [📤 내일 일정 팀에 보내기]와 번호 — 하나만 보낸 이어지는 날은 같은 번호 · 묶음의 날은 새 번호(겹침·중복·기한·완료 보고) · 같은 번호 막기 (CROSS)', async () => {
      // 이어지는 날 하나만 v432 로 보냄(다솜 셋째 날) — 같은 날 v587 이 같은 번호로 다시 보내야 팀 앱에 두 번 생기지 않는다
      await page.evaluate(name => hjTeamPacketSendView(name), DASOM); await page.locator('#hjTeamPacket').waitFor();
      await page.locator('[data-wo-item="sch:SUNM:2"]').uncheck();
      await footer(page, 'JSON 저장').click();
      await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, DASOM);
      const single = await page.evaluate(name => { const w = hjWoOrders(state.projects.find(p => p.name === name))[0]; return { id: w.packetId, items: w.items, assignee: w.assignee }; }, DASOM);
      assert.deepEqual(single.items, [{ kind: 'sched', ref: 'SUNM', day: D12, n: 3, text: '목공 (3/6일째) (2026-11-12 09:00)' }]); assert.equal(single.assignee, '이목수');
      await close(page);
      const r = await page.evaluate(async ({ GAON, DASOM, bundle }) => {
        const rows = b => b.refs.map(x => [x.name, x.items[0].ref, x.items[0].n, x.order.id, x.again]);
        const gaonW = () => hjWoOrders(state.projects.find(p => p.name === GAON)), bw = () => gaonW().find(w => w.packetId === bundle);
        const b11 = hjWoBuildDay('2026-11-11'), out = { d11: rows(b11), d11ids: b11.packet.orders.map(o => o.id), d11schema: hjWoValidate(b11.packet) };
        await hjWoRecordMany(b11.refs, 'file');
        out.afterD11 = { due: bw().due, date: bw().date, resent: Number(bw().resent) || 0, days: bw().items.map(x => x.ref + '@' + (x.day || '') + '#' + (x.n || '')) };
        // 둘째 날 지시(타일)에 팀 앱이 완료 보고 — 묶음의 준비물(CK1)을 완료로 만들면 안 된다(그 지시엔 준비물이 없었다)
        const m2 = b11.refs.find(x => x.name === GAON && x.items[0].ref === 'MULTI').order.id;
        const parsed = hjWrParse({ type: 'hj-work-report', version: 1, reporter: '김타일', reports: [{ id: 'TEST_R_M2', orderId: m2, project: { name: GAON }, status: 'done', workDate: '2026-11-11', hours: 8, done: '타일 둘째 날 끝' }] });
        const rep = parsed.reports[0], match = hjWrMatch(rep); await hjWrApply(rep, match);
        out.report = { order: match && match.order, ck1: state.projects.find(p => p.name === GAON).checklist[0].done };
        const b12 = hjWoBuildDay('2026-11-12'); out.d12 = rows(b12); out.d12ids = b12.packet.orders.map(o => o.id); out.d12schema = hjWoValidate(b12.packet);
        // 같은 번호 막기 — 옛 자료가 섞여 두 현장의 하루치 지시 번호가 같아도 한 패킷에 같은 번호는 한 번만(used), 형식 검사도 같은 번호를 잡는다
        const dw = hjWoOrders(state.projects.find(p => p.name === DASOM))[0], fake = Object.assign({}, dw, { items: [{ kind: 'sched', ref: 'MULTI', day: '2026-11-12', n: 3, text: '타일' }] });
        const gp = state.projects.find(p => p.name === GAON); gp.workOrders.unshift(fake);
        try { const bx = hjWoBuildDay('2026-11-12'); out.clash = { ids: bx.packet.orders.map(o => o.id), schema: hjWoValidate(bx.packet) }; } finally { gp.workOrders.shift(); }
        const o0 = b12.packet.orders[0]; out.dupSchema = hjWoValidate(Object.assign({}, b12.packet, { orders: [o0, o0] }));
        return out;
      }, { GAON, DASOM, bundle });
      const uniq = a => new Set(a).size === a.length;
      const g11 = r.d11.filter(x => x[0] === GAON), g12 = r.d12.filter(x => x[0] === GAON);
      assert.deepEqual(g11.map(x => [x[1], x[2], x[4]]), [['MULTI', 2, false], ['ELEC', 2, false]], '묶음 지시(여러 항목)에 든 날은 새 번호 — CROSS_BUNDLE_NEW ' + JSON.stringify(r.d11));
      assert.ok(g11.every(x => x[3] !== bundle) && uniq(r.d11ids), '오늘 지시는 묶음 번호를 쓰지 않고 한 패킷에 같은 번호 없음 — CROSS_UNIQUE ' + JSON.stringify(r.d11ids));
      assert.deepEqual(r.d11schema, []);
      assert.deepEqual(r.afterD11, { due: D12, date: D12, resent: 0, days: ['CK1@#', 'MULTI@2026-11-11#2', 'ELEC@2026-11-11#2', 'MULTI@2026-11-12#3', 'ELEC@2026-11-12#3', 'PAINT@2026-11-13#1'] },
        '묶음 기록은 그대로(기한·다시 보낸 수·항목 날짜) ' + JSON.stringify(r.afterD11));
      assert.deepEqual(r.report, { order: g11[0][3], ck1: false }, '하루치 완료 보고는 그 지시에만 — 묶음 준비물은 그대로 — CROSS_REPORT ' + JSON.stringify(r.report));
      assert.deepEqual(g12.map(x => [x[1], x[2], x[4]]), [['MULTI', 3, false], ['ELEC', 3, false]], '셋째 날도 새 번호');
      const old = new Set([bundle, ...g11.map(x => x[3])]);
      assert.ok(g12.every(x => !old.has(x[3])), '셋째 날은 둘째 날·묶음과 다른 번호(팀 앱에서 둘째 날을 덮지 않음) — CROSS_NEXT_DAY ' + JSON.stringify([...old, ...g12.map(x => x[3])]));
      assert.ok(uniq(r.d12ids), '한 패킷에 같은 번호 없음 ' + JSON.stringify(r.d12ids)); assert.deepEqual(r.d12schema, []);
      assert.deepEqual(r.d12.filter(x => x[0] === DASOM).map(x => [x[2], x[3], x[4]]), [[3, single.id, true]], 'v432 로 하나만 보낸 이어지는 날은 같은 번호 — CROSS_SAME_ID ' + JSON.stringify(r.d12));
      assert.ok(uniq(r.clash.ids) && !r.clash.schema.length, '옛 자료로 번호가 겹쳐도 한 패킷엔 한 번만 — CROSS_USED ' + JSON.stringify(r.clash));
      assert.ok(r.dupSchema.includes('orders[1].id 중복'), '형식 검사가 같은 번호를 잡음 — WO_DUP_ID ' + JSON.stringify(r.dupSchema));
      // 창에서 보내기 — 다솜만 '↻ 다시 보냄', 가온 묶음 기록은 그대로, 다솜은 새 지시 없이 다시 보낸 수만
      await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
      assert.equal(await page.locator('[data-wo-day-resend]').count(), 1, "다솜 줄만 '↻ 다시 보냄(같은 번호)'");
      await footer(page, '💾 JSON 저장').click();
      await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 5, GAON);
      const w = await page.evaluate(async ({ GAON, DASOM, bundle }) => {
        clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
        const st = await idbGetStrict('appState'), b = hjWoOrders(state.projects.find(p => p.name === GAON)).find(x => x.packetId === bundle), d = hjWoOrders(state.projects.find(p => p.name === DASOM));
        return { bundle: [b.due, Number(b.resent) || 0, b.items.length], dasom: d.map(x => [x.packetId, Number(x.resent) || 0, x.due, x.items.map(i => i.day + '#' + i.n).join()]),
          stored: [st.projects.find(p => p.name === GAON).workOrders.length, st.projects.find(p => p.name === DASOM).workOrders.length] };
      }, { GAON, DASOM, bundle });
      assert.deepEqual(w.bundle, [D12, 0, 6], '묶음 기록은 다시 보낸 것으로 치지 않음');
      const s11 = r.d11.find(x => x[0] === DASOM);
      assert.deepEqual(w.dasom, [[single.id, 1, D12, D12 + '#3'], [s11[3], 0, D11, D11 + '#2']], '다솜 셋째 날은 새 지시 없이 같은 번호로 다시 보냄(둘째 날은 어제 보낸 따로 지시) ' + JSON.stringify(w.dasom));
      assert.deepEqual(w.stored, [5, 2], '저장본에도');
      await close(page);
    });

    await test('④ 폰 390 넘침 없음 · 후보 줄 44px · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(name => hjTeamPacketSendView(name), GAON); await page.locator('#hjTeamPacket').waitFor();
      const w = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-wo-item]')].map(x => x.closest('label').getBoundingClientRect().height);
        const btns = [...document.querySelectorAll('#modalRoot .mfoot button')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().height);
        const modal = document.querySelector('#modalRoot .modal'), hint = document.querySelector('[data-wo-crew-mixed]');
        return { rows, btns, over: modal.scrollWidth - modal.clientWidth, page: document.documentElement.scrollWidth - innerWidth, hint: hint ? hint.scrollWidth - hint.clientWidth : -1 };
      });
      assert.ok(w.rows.length === 6 && w.rows.every(h => h >= 44), '후보 줄 44px — ' + JSON.stringify(w.rows));
      assert.ok(w.btns.length && w.btns.every(h => h >= 44), '아래 단추 44px — ' + JSON.stringify(w.btns));
      assert.ok(w.over <= 1 && w.page <= 1 && w.hint >= 0 && w.hint <= 1, '폰 가로 넘침 없음(담당 섞임 안내 포함) — ' + JSON.stringify(w));
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
