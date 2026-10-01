/* office-completion-check.e2e.js — [v333] 관리사무소 완료 보고: 보내기 전 점검과 '준비 · 전송 대기 · 접수 확인' 구분.
   ① 빠진 사진(시공 전·후)이 있으면 완료로 바꾸기 전에 이유와 함께 보여 준다 — [취소]면 아무것도 안 바뀐다
   ② [그래도 보내기]는 확인(confirm) 뒤에만 — 확인을 거절하면 완료도 대기열도 없다
   ③ 완료 = 📝 준비됨 + ⏳ 전송 대기. sentAt 은 아직 없다(대기열에 넣은 것은 '보냈다'가 아니다)
   ④ 서버가 사진을 막으면(invalid-completion-photos) 빨간 줄 + 서버 운영 오류와 같은 문구, sentAt 없음
   ⑤ 다 갖춘 오더는 점검 창 없이 완료되고, 네트워크 실패·ok:false 응답에는 sentAt 이 없다
   ⑥ 서버가 ok:true 로 답한 때에만 ✅ 관리사무소 접수 확인 hh:mm · 접수번호 기록, 다시 고치면 다시 전송 대기
   ⑦ 공개 금액 0원·사라진 공개 사진은 점검표에 서버 문구로 뜬다
   ⑧ 기록은 오더 안 필드(officeReport) — 직렬화 최상위 키를 늘리지 않고 저장 왕복에 남는다
   ⑨ 고치면 그 자리에서(목록 다시 그리기 없이) ✅ 가 꺼지고 점검표도 바뀐다 · 전송 확인 뒤에도 제자리 갱신
   ⑩ 대기열이 비어도 queuedRevision > sentRevision 이면 접수 확인이 아니다 · 대기열에서 빠진 실패는 기록으로 남아 보인다
   ⑪ 이 버전 전에 완료한 오더(officeReport 없음)는 '확인 전'이 아니라 '기록 없음'
   모든 자료는 가짜다. relayCall 은 페이지 안에서 바꿔 끼워 실제 서버를 부르지 않는다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__hjRestoreDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone));
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]));

  await page.evaluate(() => {
    // 부팅 시더가 시나리오 중간에 자료를 심지 않게 재운다
    try { taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0; } catch (_) {}
    __relay.url = 'https://relay.test/exec'; __relay.token = 'TEST-RELAY-TOKEN'; __relay.device = 'test-completion-check';
    window.__relayCalls = []; window.__relayNext = [];
    relayCall = async (action, payload) => {
      window.__relayCalls.push({ action, payload: JSON.parse(JSON.stringify(payload)) });
      const next = window.__relayNext.shift();
      if (!next) throw new Error('TEST no relay response queued');
      if (next === 'network') throw new TypeError('Failed to fetch');
      return typeof next === 'function' ? next(payload) : next;
    };
    state.officeIntake = { inbox: [], outbox: [], operationalErrors: [], cursor: '', lastSyncAt: '', lastError: '' };
    state.aptOffices = [{ id: 'of1', complex: '모의 아파트', manager: '', phone: '' }];
    const pid = 'office-project-abc1234', pname = '모의 아파트 현장';
    state.projects = (state.projects || []).filter(p => p.name !== pname);
    state.projects.push({ name: pname, stage: 3, officeIntakeProjectId: pid });
    const f = (id, name, phase, extra) => Object.assign({ id: 'f-' + id, name, kind: 'photo', project: pname, prefix: '', ext: 'jpg', size: 1000, when: null, _phase: phase, _worklabel: '', _driveId: 'DRIVE_' + id, _driveMimeType: 'image/jpeg', _driveSize: 1000, _virtual: true }, extra || {});
    state.files = (state.files || []).filter(x => !String(x.id || '').startsWith('f-'));
    // 101동 1001호: 공정 표식 없는 사진 하나뿐 → 시공 전·후 둘 다 빠짐
    state.files.push(f('a0', '101동1001호_현장.jpg', null));
    // 102동 1002호: 시공 전·완료 사진이 다 있다
    state.files.push(f('b1', '102동1002호_전.jpg', '시공 전'), f('b2', '102동1002호_후.jpg', '완료'));
    const base = { officeId: 'of1', amount: 150000, pipeType: '기타/미지정', date: localDate(), status: 'work', doneAt: '', source: 'office-intake', project: pname, projectIdentity: pid, intakePhotoIds: [], officeProjectionRevision: 3 };
    state.aptOrders = [
      Object.assign({}, base, { id: 'ocA', unit: '101동 1001호', text: '욕실 누수 보수', sourceRequestId: 'req-ocA', receiptNo: 'R-A' }),
      Object.assign({}, base, { id: 'ocB', unit: '102동 1002호', text: '주방 배관 교체', sourceRequestId: 'req-ocB', receiptNo: 'R-B', publicPhotoIds: ['DRIVE_b2'] })
    ];
    // 화면을 한 번 그려 render 가 채우는 기본값(aiOps 등)을 먼저 채운다 — 안 그러면 완료 저장 뒤 '살아 있는 상태 일치' 검증이
    // 이 검사의 가짜 상태 때문에 떨어진다(제품 결함이 아니라 시드 문제).
    render();
  });

  const changeStatus = (id, value) => page.evaluate(async ({ id, value }) => {
    const sel = document.getElementById('modalRoot').querySelector('.apoStat[data-id="' + id + '"]');
    sel.value = value; await sel.onchange();
  }, { id, value });
  const order = id => page.evaluate(id => JSON.parse(JSON.stringify(state.aptOrders.find(o => o.id === id))), id);
  const outbox = () => page.evaluate(() => JSON.parse(JSON.stringify(officeIntakeData().outbox)));
  const footBtn = label => page.locator('#modalRoot .mfoot button', { hasText: label });

  // ① 빠진 것 보여 주기 → 취소
  await page.evaluate(() => aptOrderManage('of1'));
  const preview = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-office-checklist="ocA"] [data-check-key]')].map(el => el.dataset.checkKey + ':' + el.dataset.ok));
  assert(preview.includes('before:0') && preview.includes('after:0') && preview.includes('summary:1'), '① 오더 줄의 보내기 전 점검이 빠진 시공 전·후를 보여 주지 않음: ' + preview);
  await changeStatus('ocA', 'done');
  const dialog = await page.evaluate(() => ({ title: document.getElementById('modalRoot').textContent.includes('보내기 전 점검'), keys: [...document.querySelectorAll('#modalRoot [data-missing-key]')].map(el => el.dataset.missingKey), text: document.getElementById('modalRoot').textContent }));
  assert(dialog.title, '① 빠진 것이 있는데 점검 창 없이 완료됨');
  assert(JSON.stringify(dialog.keys) === JSON.stringify(['before', 'after']), '① 빠진 항목이 틀림: ' + dialog.keys);
  assert(/사진 탭에서 공정을 붙이세요/.test(dialog.text), '① 빠진 이유(공정 표식)가 안내되지 않음');
  assert((await order('ocA')).status === 'work', '① 점검 창만 떴는데 완료로 바뀜');
  await footBtn('취소').click();
  await page.waitForFunction(() => !!document.querySelector('#modalRoot .apoStat[data-id="ocA"]'));
  assert((await order('ocA')).status === 'work' && (await outbox()).length === 0, '① [취소]인데 상태·대기열이 바뀜');

  // ② [그래도 보내기] — 확인 거절이면 아무 일 없음
  await changeStatus('ocA', 'done');
  await page.evaluate(() => { window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return false; }; });
  await footBtn('그래도 보내기').click();
  assert((await page.evaluate(() => window.__confirms.length)) === 1, '② [그래도 보내기]가 확인을 묻지 않음');
  assert((await order('ocA')).status === 'work' && (await outbox()).length === 0, '② 확인을 거절했는데 완료·전송 대기가 생김');
  await page.evaluate(() => { window.confirm = m => { window.__confirms.push(m); return true; }; });
  await footBtn('그래도 보내기').click();
  await page.waitForFunction(() => state.aptOrders.find(o => o.id === 'ocA').status === 'done' && state.aptOrders.find(o => o.id === 'ocA').officeReport && state.aptOrders.find(o => o.id === 'ocA').officeReport.preparedAt);

  // ③ 준비됨 + 전송 대기, sentAt 없음
  let a = await order('ocA');
  assert(a.officeReport.checklist.forced === true && JSON.stringify(a.officeReport.checklist.missing) === '["before","after"]', '③ 빠진 채 보낸 사실이 기록되지 않음: ' + JSON.stringify(a.officeReport));
  assert(a.officeReport.queuedAt && !a.officeReport.sentAt, '③ 대기열에 넣었을 뿐인데 sentAt 이 있음(서버 확인 전 \'보냈다\')');
  let box = await outbox();
  assert(box.length === 1 && box[0].action === 'officeSetStatus' && box[0].payload.status === 'completed' && a.officeReport.queuedRevision === box[0].payload.projectionRevision, '③ 완료 보고가 대기열에 한 번 들어가지 않음');
  await page.waitForFunction(() => !!document.querySelector('#modalRoot [data-office-report="ocA"]'));
  let badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocA"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on + '|' + el.textContent])));
  assert(badges.prepared.startsWith('1|📝 준비됨') && badges.queued.startsWith('1|⏳ 전송 대기') && badges.sent === '0|○ 관리사무소 접수 확인 전', '③ 세 단계 배지가 틀림: ' + JSON.stringify(badges));
  assert(!(await page.evaluate(() => document.querySelector('#modalRoot [data-office-report="ocA"]').textContent)).includes('보냄'), '③ 서버 확인 없이 \'보냄\' 표기');

  // ④ 서버가 사진을 막음 → 빨간 줄, 서버 운영 오류와 같은 문구, sentAt 없음
  await page.evaluate(() => { window.__relayNext.push({ ok: false, error: 'invalid-completion-photos' }); });
  await page.evaluate(() => officeIntakeFlush());
  a = await order('ocA');
  assert(!a.officeReport.sentAt && a.officeReport.failCode === 'invalid-completion-photos', '④ 서버가 막았는데 sentAt 이 있거나 실패가 기록되지 않음: ' + JSON.stringify(a.officeReport));
  await page.evaluate(() => aptOrderManage('of1'));
  const blockedView = await page.evaluate(() => ({ fail: (document.querySelector('#modalRoot [data-office-report="ocA"] [data-office-report-fail]') || {}).textContent || '', ops: officeIntakeOperationalErrorHtml(), sent: document.querySelector('#modalRoot [data-office-report="ocA"] [data-office-report-stage="sent"]').dataset.on }));
  assert(blockedView.fail.includes('완료 사진 선택 또는 manifest 수정 필요') && blockedView.ops.includes('완료 사진 선택 또는 manifest 수정 필요'), '④ 막힘 줄이 서버 운영 오류와 같은 말이 아님: ' + JSON.stringify(blockedView));
  assert(blockedView.sent === '0', '④ 막혔는데 접수 확인 배지가 켜짐');

  // ⑤ 다 갖춘 오더: 점검 창 없이 완료, 네트워크 실패·ok:false 에는 sentAt 없음
  await changeStatus('ocB', 'done');
  await page.waitForFunction(() => state.aptOrders.find(o => o.id === 'ocB').status === 'done');
  let b = await order('ocB');
  assert(b.officeReport.checklist.ok === true && b.officeReport.checklist.forced === false && !b.officeReport.sentAt, '⑤ 다 갖춘 오더의 준비 기록이 틀림: ' + JSON.stringify(b.officeReport));
  // ocA 의 막힌 항목이 대기열 맨 앞이면 flush 가 멈춘다 — 막힘을 사람이 고친 것으로 치고 ocA 항목을 치운다(이 검사는 ocB 만 본다)
  await page.evaluate(() => { const d = officeIntakeData(); d.outbox = d.outbox.filter(i => i.payload.requestId !== 'req-ocA'); });
  await page.evaluate(() => { window.__relayNext.push('network'); });
  await page.evaluate(() => officeIntakeFlush());
  b = await order('ocB');
  assert(!b.officeReport.sentAt && b.officeReport.failCode === 'network', '⑤ 네트워크 실패에 sentAt 이 생기거나 실패가 기록되지 않음: ' + JSON.stringify(b.officeReport));
  await page.evaluate(() => { window.__relayNext.push({ ok: false, error: 'not-found' }); });
  await page.evaluate(() => officeIntakeFlush());
  b = await order('ocB');
  assert(!b.officeReport.sentAt && (await outbox()).length === 1, '⑤ ok:false 응답에 sentAt 이 생기거나 대기열이 비었음');
  await page.evaluate(() => { window.__relayNext.push({ ok: 'yes', requestId: 'req-ocB' }); });
  await page.evaluate(() => officeIntakeFlush());
  b = await order('ocB');
  assert(!b.officeReport.sentAt, '⑤ ok 가 정확히 true 가 아닌 응답을 접수 확인으로 봄');
  await page.evaluate(() => aptOrderManage('of1'));
  const failLine = await page.evaluate(() => (document.querySelector('#modalRoot [data-office-report="ocB"] [data-office-report-fail]') || {}).textContent || '');
  assert(failLine.includes('전송 실패'), '⑤ 전송 실패가 빨간 줄로 보이지 않음: ' + failLine);

  // ⑥ ok:true 일 때만 접수 확인
  await page.evaluate(() => { window.__relayNext.push(p => ({ ok: true, requestId: p.requestId, receiptNo: 'TEST-RECEIPT-B', status: p.status, projectionRevision: p.projectionRevision, updatedAt: '2026-10-01T01:02:03.000Z' })); });
  const sentCount = await page.evaluate(() => officeIntakeFlush());
  b = await order('ocB');
  assert(sentCount === 1 && b.officeReport.sentAt && b.officeReport.serverReceipt.receiptNo === 'TEST-RECEIPT-B' && b.officeReport.sentRevision === b.officeReport.queuedRevision && !b.officeReport.failCode, '⑥ 서버 ok 뒤 접수 확인 기록이 틀림: ' + JSON.stringify(b.officeReport));
  await page.evaluate(() => aptOrderManage('of1'));
  badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on + '|' + el.textContent])));
  assert(/^1\|✅ 관리사무소 접수 확인 \d{2}:\d{2}$/.test(badges.sent) && badges.queued.startsWith('0|'), '⑥ 접수 확인 배지가 hh:mm 으로 켜지지 않음: ' + JSON.stringify(badges));
  // 공개 메모를 고치면 새 revision → 다시 전송 대기, 접수 확인 배지는 꺼진다
  await page.evaluate(() => { const ta = document.querySelector('#modalRoot .apoCompletionSummary[data-id="ocB"]'); ta.value = '주방 배관 교체 완료 — 누수 없음'; ta.onchange(); aptOrderManage('of1'); }); // 다시 그린 뒤의 판정(⑨ 는 다시 그리지 않고 본다)
  badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on])));
  assert(badges.queued === '1' && badges.sent === '0', '⑥ 고친 보고가 다시 전송 대기로 보이지 않음: ' + JSON.stringify(badges));
  // 서버 정정 체인(completed→billed→paid 재구성)처럼 기록(queuedRevision)을 거치지 않고 대기열에 생긴 항목도 '전송 대기'다 — 접수 확인으로 보이면 안 된다
  await page.evaluate(() => { window.__relayNext = [p => ({ ok: true, requestId: p.requestId, receiptNo: 'TEST-RECEIPT-B2', status: p.status, projectionRevision: p.projectionRevision })]; return officeIntakeFlush(); });
  await page.evaluate(() => { officeIntakeData().outbox.push({ id: 'test-chain', action: 'officeSetStatus', payload: { requestId: 'req-ocB', status: 'billed', projectionRevision: 99 }, createdAt: new Date().toISOString(), attempts: 0, lastError: '' }); aptOrderManage('of1'); });
  badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on])));
  assert(badges.queued === '1' && badges.sent === '0', '⑥ 정정 체인이 대기 중인데 접수 확인으로 보임: ' + JSON.stringify(badges));
  await page.evaluate(() => { const d = officeIntakeData(); d.outbox = d.outbox.filter(i => i.id !== 'test-chain'); });

  // ⑦ 공개 금액 0원·사라진 공개 사진
  const chk = await page.evaluate(() => {
    const o = state.aptOrders.find(x => x.id === 'ocB'); o.publicAmount = 0; o.publicPhotoIds = ['DRIVE_b2', 'DRIVE_GONE'];
    const r = officeCompletionChecklist(o); o.publicAmount = null; o.publicPhotoIds = ['DRIVE_b2'];
    return r.items.map(x => ({ key: x.key, ok: x.ok, detail: x.detail }));
  });
  const amt = chk.find(x => x.key === 'amount'), pub = chk.find(x => x.key === 'publicPhotos');
  assert(amt && !amt.ok, '⑦ 공개 금액 0원이 점검에 걸리지 않음');
  assert(pub && !pub.ok && pub.detail.startsWith('완료 사진 선택 또는 manifest 수정 필요'), '⑦ 사라진 공개 사진이 서버 문구로 걸리지 않음: ' + JSON.stringify(pub));

  // ⑨ 제자리 갱신: (접수 확인 상태로 그린 화면에서) 메모 고침 — 다시 그리지 않음 → 배지 sent 0·queued 1, 점검표도 바로 바뀜,
  //    그 뒤 서버 확인(flush)도 다시 그리지 않고 ✅ 로 바뀐다
  await page.evaluate(() => aptOrderManage('of1'));
  badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on])));
  assert(badges.sent === '1' && badges.queued === '0' && (await outbox()).length === 0, '⑨ 시작 조건(접수 확인됨)이 아님: ' + JSON.stringify(badges));
  const inPlace = await page.evaluate(() => {
    const ta = document.querySelector('#modalRoot .apoCompletionSummary[data-id="ocB"]'); ta.focus(); ta.value = '주방 배관 교체 완료 — 누수 없음, 마감 확인'; ta.onchange();
    const st = Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on]));
    const amt = document.querySelector('#modalRoot .apoPublicAmount[data-id="ocB"]'); amt.value = '0'; amt.onchange();
    const amountOk = document.querySelector('#modalRoot [data-office-checklist="ocB"] [data-check-key="amount"]').dataset.ok;
    amt.value = ''; amt.onchange();
    const amountBack = document.querySelector('#modalRoot [data-office-checklist="ocB"] [data-check-key="amount"]') ? 'still' : 'gone'; // 비우면 비공개 — 점검 항목 자체가 없다
    return { st, amountOk, amountBack, sameTa: document.querySelector('#modalRoot .apoCompletionSummary[data-id="ocB"]') === ta };
  });
  assert(inPlace.st.sent === '0' && inPlace.st.queued === '1', '⑨ 고쳤는데 다시 그리기 전까지 ✅ 접수 확인이 남음: ' + JSON.stringify(inPlace.st));
  assert(inPlace.amountOk === '0' && inPlace.amountBack === 'gone', '⑨ 공개 금액을 고쳐도 점검표가 제자리에서 바뀌지 않음: ' + JSON.stringify(inPlace));
  assert(inPlace.sameTa, '⑨ 제자리 갱신이 입력칸까지 갈아 끼움(초점 잃음)');
  await page.evaluate(() => { window.__relayNext = [1, 2, 3, 4].map(() => p => ({ ok: true, requestId: p.requestId, receiptNo: 'TEST-RECEIPT-B4', status: p.status, projectionRevision: p.projectionRevision })); return officeIntakeFlush(); });
  badges = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-office-report="ocB"] [data-office-report-stage]')].map(el => [el.dataset.officeReportStage, el.dataset.on])));
  assert(badges.sent === '1' && badges.queued === '0' && (await outbox()).length === 0, '⑨ 서버 확인 뒤 배지가 제자리에서 갱신되지 않음: ' + JSON.stringify(badges));

  // ⑩ revision 가드 · 대기열에서 빠진 실패 기록
  const guard = await page.evaluate(() => {
    const o = state.aptOrders.find(x => x.id === 'ocB'), keep = JSON.parse(JSON.stringify(o.officeReport));
    const d = officeIntakeData(); d.outbox = d.outbox.filter(i => i.payload.requestId !== 'req-ocB');
    o.officeReport = Object.assign({}, keep, { sentAt: new Date().toISOString(), sentRevision: 3, queuedRevision: 4 });
    const v1 = officeReportView(o);
    o.officeReport = Object.assign({}, keep, { sentAt: '', sentRevision: 0, queuedRevision: 4, failedAt: new Date().toISOString(), failCode: 'network' });
    delete o.officeReport.sentAt;
    const v2 = officeReportView(o);
    o.officeReport = keep;
    return { sent1: v1.sent, fail2: v2.fail, sent2: v2.sent };
  });
  assert(guard.sent1 === false, '⑩ 새 revision 이 서버 확인 없이 대기열에서 빠졌는데 접수 확인으로 봄');
  assert(guard.sent2 === false && /마지막 전송 실패/.test(guard.fail2) && guard.fail2.includes('[network]'), '⑩ 대기열에서 빠진 실패가 화면에서 사라짐: ' + JSON.stringify(guard));

  // ⑪ 이 버전 전에 완료한 오더
  const legacy = await page.evaluate(() => {
    state.aptOrders.push({ id: 'ocOld', officeId: 'of1', unit: '103동 303호', text: '옛 보수', amount: 1, pipeType: '기타/미지정', date: localDate(), status: 'billed', doneAt: localDate(), source: 'office-intake', sourceRequestId: 'req-old', receiptNo: 'R-OLD', officeProjectionRevision: 2 });
    const html = officeReportBadgesHtml(state.aptOrders.find(x => x.id === 'ocOld'));
    state.aptOrders = state.aptOrders.filter(x => x.id !== 'ocOld');
    return html;
  });
  assert(legacy.includes('기록 없음') && !legacy.includes('✅') && !legacy.includes('접수 확인 전'), '⑪ 옛 완료 오더를 \'접수 확인 전\'·✅ 로 표시: ' + legacy);

  // ⑧ 직렬화 왕복
  const round = await page.evaluate(() => {
    const ser = JSON.parse(JSON.stringify(serializeData()));
    const o = ser.aptOrders.find(x => x.id === 'ocB');
    return { keys: Object.keys(ser).length, report: !!(o && o.officeReport && o.officeReport.sentAt && o.officeReport.preparedAt), top: Object.prototype.hasOwnProperty.call(ser, 'officeReport') };
  });
  assert(round.report && !round.top, '⑧ 기록이 오더 안에 저장되지 않거나 최상위 키가 생김: ' + JSON.stringify(round));

  assert(errors.length === 0, '페이지 오류: ' + errors.join(' | '));
  console.log('PASS office-completion-check ①~⑪');
  await browser.close();
})().catch(async e => { console.error('FAIL office-completion-check:', e && e.stack || e); if (browser) await browser.close().catch(() => {}); process.exit(1); });
