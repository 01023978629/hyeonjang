/* sync-merge.e2e.js — v333 저장 충돌 때 바뀐 항목만 비교·선택 (Playwright + mock-relay)

   대표 요청(사진 배정·동기화 안정화): '충돌 시 바뀐 항목만 비교·선택'. 예전에는 자료 전체를 통째로 고르는 3지선다뿐이라
   다른 기기에서 일정 하나 고친 것 때문에 이 기기에서 한 시간 고친 배정을 버리거나 그 반대가 됐다.
   지키는 것:
     ① 저장이 받아들여지면 보낸 자료가 base(마지막으로 서버와 맞춘 자료)로 이 기기 IDB 'relay_base' 에만 남는다(서버로 안 감)
     ② 충돌 → 서버본·내 것·base 3-way: 한쪽만 바뀐 것은 자동, 양쪽이 다르게 바꾼 것만 목록(항목마다 서버/내 것),
        다른 기기가 지운 것·이 기기에서 지운 것도 목록으로 보인다. 다 고르기 전에는 저장하지 않는다
     ③ 🛡 안전판이 실패하면 아무것도 바꾸지 않고 멈춘다
     ④ 고른 대로 합친 자료가 새 revision 으로 저장되고 이 기기 상태도 같다(사진은 fid 단위)
     ⑤ 다른 기기가 같은 자료를 다시 저장했을 뿐이면(서버 쪽 변경 없음) 묻지 않고 내 것으로 이어 저장한다
     ⑥ base 가 없으면(첫 연결·옛 기기·다른 revision·다른 서버 주소) 예전 3지선다 화면, 그 화면은 '전체로 고르기' 로도 열린다
     ⑦ 고르는 사이 이 기기 자료가 바뀌면 다시 비교한다
     ⑧ 360px — 넘침 없음, 고르는 버튼 44px · pageerror 0
     ⑨ 옛 기기(fid 없음)의 서버본·base — 같은 경로 기록의 fid 를 빌려 같은 사진끼리 비교(지움+만듦으로 갈리지 않는다)
   전제: tests/static-server.js(8299) + tests/mock-relay.js(8398) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const MOCK = 'http://127.0.0.1:8398';
const TOKEN = 'test-token-123';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const mockState = () => fetch(MOCK + '/__state').then(r => r.json());
// 다른 기기의 저장 — 서버 계약 그대로(baseRevision 이 맞아야 받아 준다)
async function otherDeviceSave(mutate) {
  const st = await mockState();
  const data = JSON.parse(JSON.stringify(st.data));
  mutate(data);
  data.savedAt = new Date().toISOString();
  const r = await fetch(MOCK, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: TOKEN, action: 'save', deviceId: 'other-device', ts: Date.now(), payload: { data, baseRevision: st.revision } }) }).then(x => x.json());
  assert(r.ok, '다른 기기 저장(시드) 실패: ' + JSON.stringify(r));
  return r.revision;
}

(async () => {
  await fetch(MOCK + '/__reset');
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjSyncMerge3 === 'function');
  await page.evaluate(async ({ url, token }) => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    // 부팅 시더·자동 저장(3초 디바운스)을 재운다 — 저장 시점은 검사가 정한다
    for (const k of ['taxCalendarEnsure', 'coworkSchedEnsure', 'backupBootCheck', 'kakaoCheckNew', 'cloudAutoSave', 'relayDailyBackup', 'officeIntakeFlush']) if (typeof window[k] === 'function') window[k] = async () => 0;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
    __relay.url = url; __relay.token = token; __relay.device = 'pc-merge-test'; __relay.rev = 0; __relay.syncAt = '';
    await idbDel('relay_base');
    state._demo = false; state.quotes = [];
    const pj = (name, extra) => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, ...(extra || {}) });
    state.projects = [pj('가상현장A'), pj('가상현장B')];
    state.schedule = [{ id: 's1', date: '2026-10-01', title: '철거', project: '가상현장A' }, { id: 's2', date: '2026-10-02', title: '타일', project: '가상현장A' },
      { id: 's3', date: '2026-10-03', title: '도배', project: '가상현장B' }];
    state.notes = [{ id: 'n1', date: '2026-10-01', text: '자재 확인', project: '가상현장A' }];
    const ph = (fid, name, project, label) => ({ id: uid(), fid, name, prefix: '', ext: 'jpg', size: 100, kind: 'photo', project, _worklabel: label, when: new Date('2026-09-30T09:00:00') });
    state.files = [ph('merge-fid-0001', 'image.jpg', '가상현장A', '방수'), ph('merge-fid-0002', 'image.jpg', '가상현장B', '도배'), ph('merge-fid-0003', 'image.jpg', '가상현장B', '버릴 사진')];
  }, { url: MOCK, token: TOKEN });

  // ── ① 첫 저장 → base ────────────────────────────────────────────────────────────────
  assert(await page.evaluate(() => relaySaveNow(true)) === true, '① 첫 저장 성공');
  const base = await page.evaluate(async () => { const b = await idbGet('relay_base'); return b ? { rev: b.rev, srv: b.srv === relayBaseSrv(), data: JSON.parse(b.json) } : null; });
  let st = await mockState();
  assert(base && base.rev === 1 && base.srv && st.revision === 1, '① base 가 revision 1 로 남는다: ' + JSON.stringify(base && { rev: base.rev, srv: base.srv }));
  assert(JSON.stringify({ ...base.data, savedAt: 0 }) === JSON.stringify({ ...st.data, savedAt: 0 }), '① base = 서버로 보낸 자료 그대로');
  assert(!JSON.stringify(st.data).includes('relay_base') && !('relayBase' in st.data), '① base 는 서버 자료에 실리지 않는다');
  console.log('PASS  ① 저장 성공 → 이 기기 base(revision 1)');

  // ── ② 충돌 → 바뀐 항목만 ─────────────────────────────────────────────────────────────
  await otherDeviceSave(d => {
    d.projects.find(p => p.name === '가상현장A').received = 500000;            // 서버만: 현장A 받은 돈
    d.schedule = d.schedule.filter(s => s.id !== 's1');                        // 서버만: 일정 s1 지움
    d.schedule.find(s => s.id === 's2').title = '타일(서버)';                    // 양쪽: s2 제목
    d.schedule.push({ id: 's4', date: '2026-10-04', title: '마감 점검', project: '가상현장B' });   // 서버만: 새 일정
    d.notes.find(n => n.id === 'n1').text = '자재 확인(서버)';                    // 서버 고침 ↔ 내가 지움
    d.files.find(f => f.fid === 'merge-fid-0001').worklabel = '방수(서버)';      // 서버만: 사진1 작업명
    d.files = d.files.filter(f => f.fid !== 'merge-fid-0003');                  // 서버만: 사진3 지움(같은 이름·크기 — fid 로만 가른다)
  });
  await page.evaluate(() => {
    state.projects.find(p => p.name === '가상현장B').stage = 3;                 // 나만: 현장B 단계
    state.schedule.find(s => s.id === 's2').title = '타일(내 것)';
    state.schedule = state.schedule.filter(s => s.id !== 's3');                 // 나만: 일정 s3 지움
    state.notes = state.notes.filter(n => n.id !== 'n1');                       // 내가 지움(서버는 고침)
    state.files.find(f => f.fid === 'merge-fid-0002')._worklabel = '도배(내 것)';  // 나만: 사진2 작업명(같은 이름·크기 사진1과 섞이지 않아야)
  });
  const saved2 = await page.evaluate(() => relaySaveNow(true));
  assert(saved2 === false, '② 충돌한 저장은 성공으로 치지 않는다');
  await page.waitForSelector('#ryMergeBox');
  const box = await page.evaluate(() => {
    const root = document.getElementById('modalRoot');
    return { rows: [...root.querySelectorAll('.ry-mrow')].map(r => r.querySelector('.ry-mlbl').textContent.replace(/\s+/g, ' ').trim()),
      diff: [...root.querySelectorAll('.ry-mrow .ry-mdiff')].map(d => d.textContent.replace(/\s+/g, ' ').trim()),
      dels: [...root.querySelectorAll('details.ry-mdel')].map(d => d.textContent.replace(/\s+/g, ' ').trim()),
      text: root.textContent.replace(/\s+/g, ' '), legacy: !!document.getElementById('ryConflictBox'),
      foot: [...root.querySelectorAll('.mfoot button')].map(b => b.textContent) };
  });
  assert(!box.legacy && box.rows.length === 2, '② 양쪽에서 다르게 바꾼 것만 2건: ' + JSON.stringify(box.rows));
  assert(/일정 · 타일\(서버\)/.test(box.rows[0]) && /양쪽에서 다르게 고침/.test(box.rows[0]) && /제목 — 서버: 타일\(서버\) · 내 것: 타일\(내 것\)/.test(box.diff[0]),
    '② 일정 s2 — 바뀐 칸만(제목) 서버/내 것: ' + JSON.stringify([box.rows[0], box.diff[0]]));
  assert(/메모·할일 · 자재 확인\(서버\)/.test(box.rows[1]) && /이 기기에서 지움 · 다른 기기가 고침/.test(box.rows[1]) && /내 것: \(지움\)/.test(box.diff[1]),
    '② 메모 n1 — 서버 고침 ↔ 내가 지움: ' + JSON.stringify([box.rows[1], box.diff[1]]));
  assert(box.dels.some(t => /다른 기기가 지운 것 2건/.test(t) && /철거/.test(t) && /image\.jpg · 가상현장B · 버릴 사진/.test(t)) && box.dels.some(t => /이 기기에서 지운 것 1건/.test(t) && /도배/.test(t)),
    '② 지운 것 — 다른 기기(s1 철거·사진3)·이 기기(s3 도배): ' + JSON.stringify(box.dels));
  assert(/다른 기기에서 바뀐 것 3건/.test(box.text) && /이 기기에서 바뀐 것 2건/.test(box.text), '② 자동으로 합칠 건수: ' + box.text.slice(0, 300));
  assert(JSON.stringify(box.foot) === JSON.stringify(['나중에', '전체로 고르기', '합쳐서 저장']), '② 버튼 — 나중에·전체로 고르기(탈출구)·합쳐서 저장: ' + JSON.stringify(box.foot));
  // 고르기 전에는 저장하지 않는다
  await page.click('#modalRoot .mfoot button:has-text("합쳐서 저장")');
  assert(/아직 고르지 않은 항목이 2건/.test(await page.textContent('#ryMergeIssue')) && (await mockState()).revision === 2, '② 다 고르기 전에는 저장하지 않는다');
  console.log('PASS  ② 바뀐 항목만 — 양쪽 변경 2건·지운 것 표시·고르기 전 저장 안 함');

  // ── ⑧ 360px 모양 ────────────────────────────────────────────────────────────────────
  const lay = await page.evaluate(() => {
    const m = document.querySelector('#modalRoot .modal'), body = document.querySelector('#modalRoot .mbody');
    const btns = [...document.querySelectorAll('#modalRoot [data-rypick], #modalRoot [data-ryall], #modalRoot .mfoot button, #modalRoot details.ry-mdel summary')];
    return { over: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, m.scrollWidth - m.clientWidth, body.scrollWidth - body.clientWidth),
      small: btns.filter(b => b.getBoundingClientRect().height < 44).map(b => b.textContent.trim()), n: btns.length };
  });
  assert(lay.over <= 0 && lay.small.length === 0 && lay.n >= 9, '⑧ 360px — 넘침 없음·누르는 것 44px: ' + JSON.stringify(lay));
  console.log('PASS  ⑧ 360px 넘침 0 · 버튼 44px');

  // ── ③ 안전판 실패 → 멈춤 ────────────────────────────────────────────────────────────
  await page.click('#modalRoot [data-rypick="0"][data-side="m"]');
  await page.click('#modalRoot [data-rypick="1"][data-side="s"]');
  const pressed = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-rypick][aria-pressed="true"]')].map(b => b.dataset.rypick + b.dataset.side));
  assert(JSON.stringify(pressed) === JSON.stringify(['0m', '1s']), '③ 고른 쪽이 눌림으로 보인다: ' + JSON.stringify(pressed));
  const beforeFail = await page.evaluate(() => { window.__origSnap = hjSnapshot; hjSnapshot = async () => false; return JSON.stringify({ ...serializeData(), savedAt: 0 }); });
  await page.click('#modalRoot .mfoot button:has-text("합쳐서 저장")');
  await page.waitForFunction(() => window.__toasts.some(t => /안전판 백업 실패/.test(t)));
  const afterFail = await page.evaluate(() => JSON.stringify({ ...serializeData(), savedAt: 0 }));
  assert(afterFail === beforeFail && (await mockState()).revision === 2 && await page.$('#ryMergeBox'), '③ 안전판 실패 — 이 기기 자료·서버 그대로, 창은 남는다');
  await page.evaluate(() => { hjSnapshot = window.__origSnap; });
  console.log('PASS  ③ 안전판 실패 → 아무것도 바꾸지 않고 멈춤');

  // ── ④ 합쳐서 저장 ──────────────────────────────────────────────────────────────────
  await page.click('#modalRoot .mfoot button:has-text("합쳐서 저장")');
  await page.waitForFunction(() => window.__toasts.some(t => /바뀐 항목을 합쳐 저장했습니다/.test(t)));
  st = await mockState();
  const view = d => ({ recvA: d.projects.find(p => p.name === '가상현장A').received, stageB: d.projects.find(p => p.name === '가상현장B').stage,
    sched: d.schedule.filter(s => /^s\d$/.test(s.id)).map(s => s.id + ':' + s.title).sort(), notes: (d.notes || []).filter(n => n.id === 'n1').map(n => n.text),
    photos: d.files.filter(f => f.name === 'image.jpg').map(f => f.fid + ':' + f.worklabel + ':' + f.project) });
  const want = { recvA: 500000, stageB: 3, sched: ['s2:타일(내 것)', 's4:마감 점검'], notes: ['자재 확인(서버)'],
    photos: ['merge-fid-0001:방수(서버):가상현장A', 'merge-fid-0002:도배(내 것):가상현장B'] };
  const local = await page.evaluate(() => JSON.parse(JSON.stringify(serializeData())));
  assert(st.revision === 3 && st.saves[st.saves.length - 1].baseRevision === 2, '④ 서버 revision 2 위에 새 revision 3: ' + JSON.stringify(st.saves.slice(-1)));
  assert(JSON.stringify(view(st.data)) === JSON.stringify(want), '④ 서버 자료 = 고른 대로 합친 것: ' + JSON.stringify(view(st.data)));
  assert(JSON.stringify(view(local)) === JSON.stringify(want), '④ 이 기기 상태도 같다: ' + JSON.stringify(view(local)));
  const after4 = await page.evaluate(async () => ({ rev: __relay.rev, base: ((await idbGet('relay_base')) || {}).rev, snaps: ((await idbGet('hj_snaps')) || []).map(s => s.label) }));
  assert(after4.rev === 3 && after4.base === 3 && after4.snaps.includes('충돌-항목 합치기 전'), '④ 기준 revision·base 3, 안전판 남음: ' + JSON.stringify(after4));
  console.log('PASS  ④ 고른 대로 합쳐 새 revision 저장 — 사진은 fid 단위로 섞이지 않는다');

  // ── ⑤ 서버 쪽 변경 없음 → 묻지 않고 이어 저장 ─────────────────────────────────────
  await otherDeviceSave(() => {});   // 같은 자료를 다시 저장(revision 만 오른다)
  await page.evaluate(() => { state.projects.find(p => p.name === '가상현장A').received = 600000; });
  await page.evaluate(() => relaySaveNow(true));
  await page.waitForFunction(() => window.__toasts.some(t => /바뀐 내용이 없어 이 기기 자료로 이어 저장/.test(t)));
  st = await mockState();
  assert(st.revision === 5 && st.data.projects.find(p => p.name === '가상현장A').received === 600000 && !(await page.$('#ryMergeBox')) && !(await page.$('#ryConflictBox')),
    '⑤ 서버가 바뀐 게 없으면 창 없이 내 것으로 이어 저장(revision 5): ' + st.revision);
  console.log('PASS  ⑤ 서버 쪽 변경이 없으면 묻지 않고 이어 저장');

  // ── ⑦ 고르는 사이 이 기기 자료가 바뀌면 다시 비교 ───────────────────────────────────
  await otherDeviceSave(d => { d.schedule.find(s => s.id === 's2').title = '타일(서버2)'; });
  await page.evaluate(() => { state.schedule.find(s => s.id === 's2').title = '타일(내 것2)'; });
  await page.evaluate(() => relaySaveNow(true));
  await page.waitForSelector('#ryMergeBox');
  await page.click('#modalRoot [data-ryall="m"]');
  await page.evaluate(() => { window.__toasts = []; state.schedule.find(s => s.id === 's4').title = '마감 점검(새로 고침)'; });
  await page.click('#modalRoot .mfoot button:has-text("합쳐서 저장")');
  await page.waitForFunction(() => window.__toasts.some(t => /다시 비교합니다/.test(t)));
  await page.waitForSelector('#ryMergeBox');
  assert((await mockState()).revision === 6, '⑦ 바뀐 채로는 저장하지 않는다');
  await page.click('#modalRoot [data-ryall="m"]');
  await page.click('#modalRoot .mfoot button:has-text("합쳐서 저장")');
  await page.waitForFunction(() => window.__toasts.some(t => /바뀐 항목을 합쳐 저장했습니다/.test(t)));
  st = await mockState();
  assert(st.revision === 7 && st.data.schedule.find(s => s.id === 's4').title === '마감 점검(새로 고침)' && st.data.schedule.find(s => s.id === 's2').title === '타일(내 것2)',
    '⑦ 다시 비교한 뒤 새 변경까지 합쳐 저장: ' + JSON.stringify(st.data.schedule));
  console.log('PASS  ⑦ 고르는 사이 바뀌면 다시 비교');

  // ── ⑥ base 없음 → 예전 화면, '전체로 고르기' ───────────────────────────────────────
  // 남아 있는 base 가 지금 기준 revision 의 것이 아니면(다른 길로 rev 가 바뀐 기기) 쓰지 않는다 — 없을 때(relay.e2e 4·19)와 같은 예전 화면
  await page.evaluate(async () => { const b = await idbGet('relay_base'); b.rev = b.rev - 1; await idbSet('relay_base', b); });
  await otherDeviceSave(d => { d.schedule.find(s => s.id === 's2').title = '타일(서버3)'; });
  await page.evaluate(() => { state.schedule.find(s => s.id === 's2').title = '타일(내 것3)'; });
  await page.evaluate(() => relaySaveNow(true));
  await page.waitForSelector('#ryConflictBox');
  assert(!(await page.$('#ryMergeBox')) && (await page.$$('#modalRoot .mfoot button')).length === 3, '⑥ 쓸 수 있는 base 가 없으면(지금 revision 과 다름) 예전 3지선다');
  await page.evaluate(() => closeModal(true));
  // base 가 있어도 [전체로 고르기]로 같은 화면
  await page.evaluate(async () => { const s = await relayCall('load'); await relayBaseRemember(s.revision, s.data); __relay.rev = s.revision; state.schedule.find(x => x.id === 's2').title = '타일(내 것4)'; });
  await otherDeviceSave(d => { d.schedule.find(s => s.id === 's2').title = '타일(서버4)'; });
  await page.evaluate(() => relaySaveNow(true));
  await page.waitForSelector('#ryMergeBox');
  await page.click('#modalRoot .mfoot button:has-text("전체로 고르기")');
  await page.waitForSelector('#ryConflictBox');
  // 다른 서버 주소에서 남긴 base 는 revision 이 같아도 쓰지 않는다(서버를 바꾼 기기가 남의 자료를 base 로 합치지 않게)
  await page.evaluate(() => closeModal(true));
  await page.evaluate(async () => { const s = await relayCall('load'); await relayBaseRemember(s.revision, s.data); __relay.rev = s.revision;
    const b = await idbGet('relay_base'); b.srv = hjFidHash('https://other-relay.invalid/exec'); await idbSet('relay_base', b);
    state.schedule.find(x => x.id === 's2').title = '타일(내 것5)'; });
  await otherDeviceSave(d => { d.schedule.find(s => s.id === 's2').title = '타일(서버5)'; });
  await page.evaluate(() => relaySaveNow(true));
  await page.waitForSelector('#ryConflictBox');
  assert(!(await page.$('#ryMergeBox')), '⑥ 다른 서버 주소의 base 는 쓰지 않는다 — 예전 3지선다');
  console.log('PASS  ⑥ 쓸 base 없음(revision·서버 주소) → 예전 3지선다 · [전체로 고르기] 탈출구');

  // ── 불러오기도 base 를 남긴다 ─────────────────────────────────────────────────────
  await page.evaluate(() => closeModal(true));
  const loaded = await page.evaluate(async () => { const ok = await relayLoadApply(true); const b = await idbGet('relay_base'); return { ok, rev: b && b.rev, rel: __relay.rev, json: b && b.json }; });
  st = await mockState();
  assert(loaded.ok && loaded.rev === st.revision && loaded.rel === st.revision && JSON.stringify(JSON.parse(loaded.json)) === JSON.stringify(st.data), '서버에서 불러오면 받은 자료가 base: ' + JSON.stringify({ rev: loaded.rev, rel: loaded.rel, srv: st.revision }));
  console.log('PASS  불러오기 → 받은 서버 자료가 base');

  // ── 순수 비교 규칙 ──────────────────────────────────────────────────────────────────
  const pure = await page.evaluate(() => {
    const b = { schedule: [{ id: 'a', t: 1 }, { id: 'b', t: 1 }], goals: { x: 1 } };
    const m = { schedule: [{ id: 'a', t: 2 }, { id: 'b', t: 1 }], goals: { x: 1 } };
    const s = { schedule: [{ id: 'a', t: 2 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }], goals: { x: 2 } };
    const p = hjSyncMerge3(b, m, s);
    const out = hjSyncResolve(p, s, []);
    return { conflicts: p.conflicts.length, sched: out.schedule.map(x => x.id + x.t).join(','), goals: out.goals.x, auto: p.auto.serverChanged.length + p.auto.serverAdded.length };
  });
  assert(pure.conflicts === 0 && pure.sched === 'a2,b1,c1' && pure.goals === 2 && pure.auto === 2, '순수 — 양쪽이 같게 바꾼 것은 충돌이 아니고, 배열 아닌 키도 비교한다: ' + JSON.stringify(pure));
  console.log('PASS  비교 규칙 — 같게 바꾼 것은 충돌 아님 · 설정 키도 비교');

  // ── ⑨ 옛 기기(fid 없음)가 저장한 서버본·base ─────────────────────────────────────
  // 정해지는 값을 그대로 붙이면 이 기기(UUID)와 짝이 안 맞아 같은 사진이 '다른 기기가 지움' + '다른 기기가 만듦' 으로 갈리고,
  // [내 것]을 고르면 같은 사진이 두 기록이 된다. 같은 경로 기록에서 fid 를 빌려 같은 사진으로 비교해야 한다.
  const nine = await page.evaluate(() => {
    const F = (fid, project, extra) => Object.assign({ key: 'a.jpg|100', name: 'a.jpg', prefix: '', kind: 'photo', size: 100, project }, fid ? { fid } : {}, extra || {});
    const base = { files: [F('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'), F('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'A', { driveId: 'DRIVE-FAKE-2' })], schedule: [] };
    const mine = { files: [F('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'B'), F('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'A', { driveId: 'DRIVE-FAKE-2' })], schedule: [] };
    const server = { files: [F(null, 'A', { driveId: 'DRIVE-FAKE-2', worklabel: '서버 작업명' }), F(null, 'A')], schedule: [{ id: 'x', title: 'x' }] };
    const p = hjSyncMerge3(base, mine, server);
    const out = p.conflicts.length ? { files: [] } : hjSyncResolve(p, server, []);   // 충돌이 남으면 아래 단정이 이름으로 말한다
    // base 도 옛 기기 것(fid 없음)
    const base2 = { files: [F(null, 'A')] }, mine2 = { files: [F('33333333-cccc-4ccc-8ccc-cccccccccccc', 'B')] }, server2 = { files: [F(null, 'A', { worklabel: '서버' })] };
    const p2 = hjSyncMerge3(base2, mine2, server2);
    const out2 = p2.conflicts.length ? null : hjSyncResolve(p2, server2, []);
    return { conflicts: p.conflicts.map(c => c.kind), auto: p.auto, files: out.files.map(f => f.fid + ':' + f.project + ':' + (f.worklabel || '')),
      c2: p2.conflicts.map(c => c.kind), files2: out2 && out2.files.map(f => f.fid + ':' + f.project + ':' + (f.worklabel || '')) };
  });
  assert(nine.conflicts.length === 0 && nine.auto.serverDeleted.length === 0 && nine.auto.mineDeleted.length === 0 && JSON.stringify(nine.auto.serverAdded) === JSON.stringify(['일정 · x']),
    '⑨ fid 없는 서버본 — 같은 사진을 지움·만듦으로 가르지 않는다: ' + JSON.stringify(nine));
  assert(JSON.stringify(nine.files) === JSON.stringify(['22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb:A:서버 작업명', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa:B:']),
    '⑨ 합친 사진은 두 장 그대로·제 fid(Drive ID 가 같은 것끼리 먼저)·이 기기 현장 변경 유지: ' + JSON.stringify(nine.files));
  assert(nine.c2.length === 1 && nine.c2[0] === 'bothChanged', '⑨ base 도 fid 없을 때 — 같은 사진의 양쪽 변경 한 건(지움+만듦 아님): ' + JSON.stringify(nine));
  console.log('PASS  ⑨ 옛 기기(fid 없음) 서버본·base — 같은 경로 기록의 fid 로 같은 사진끼리 비교');

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));
  console.log('sync-merge.e2e OK');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });
