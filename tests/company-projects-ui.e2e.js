/* Synthetic ten-person company. All network is intercepted; no real accounts, Drive or insurer. */
'use strict';
const assert = require('assert'), crypto = require('crypto'), fs = require('fs');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const { harness, seed, engine, digest, clone, setBrowser } = require('./company-team-ui.e2e.js');
const MUTANT = process.env.HJ_PROJECT_UI_MUTATION || '';
const DATE = '2026-09-27', PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF0sAAAAASUVORK5CYII=', 'base64');
let browser, count = 0, hit = false;
function seedTen() {
  const s = seed(); s.members = s.members.filter(m => m.id === 'owner'); s.tasks = [];
  for (let i = 1; i <= 10; i++) s.members.push({ id: 'tech' + i, userId: 'TEST_TECH_' + i, officeId: 'TEST_OFFICE', name: '모의 기술자 ' + i, role: 'member', active: true, teamIds: [i <= 5 ? 't1' : 't2'] });
  s.projects = [{ id: 'p1', name: '모의 아파트 A', active: true, teamIds: ['t1', 't2'] }, { id: 'p2', name: '모의 아파트 B', active: true, teamIds: ['t1', 't2'] }]; s.evidence = []; s.claims = []; return s;
}
function task(id = 'work1', assigneeId = 'tech1', projectId = 'p1') { return { id, title: '모의 배관 보수', project: '모의 아파트 A', projectId, teamId: assigneeId === 'tech6' ? 't2' : 't1', assigneeId, due: DATE, workDate: DATE, startTime: '09:00', endTime: '12:00', status: 'doing', handoff: '모의 작업 보고', sourceRef: '', updatedAt: DATE + 'T00:00:00Z', updatedBy: 'owner' }; }
function mutate(name, content) {
  // v333: uploads moved into team-upload.js (persistent queue), so the retry-id mutation targets that file.
  const file = MUTANT === 'retry-new-id' ? 'team-upload.js' : 'team-projects.js';
  if (name !== file || !MUTANT) return content;
  const mutations = {
    'batch-auto-save': ["addRow();\n  }", "addRow(); ctx.api('taskBatch',{requestId:crypto.randomUUID(),revision:data().revision,entity:{tasks:[]}});\n  }"],
    'retry-new-id': ["const r = await ctx.api('evidenceUpload', payload);", "payload.requestId = crypto.randomUUID(); const r = await ctx.api('evidenceUpload', payload);"],
    'claim-auto-submit': ["download(zip, '보험-제출준비.zip');", "ctx.api('claimSubmitRecord',{requestId:crypto.randomUUID(),revision:data().revision,entity:{id:c.id,submittedDate:localDay(),channel:'MUTANT',referenceNo:'MUTANT'}}); download(zip, '보험-제출준비.zip');"],
    'claim-no-recheck': ["if (!latest.reviewCurrent || latest.fingerprint !== bundle.fingerprint)", 'if (false)'],
    'ignore-hash': ['bytes.length !== e.size || await sha(bytes) !== e.sha256', 'false'],
    // [v333] 준비(검토 고정)와 제출 기록·무효 표시·단계 경고가 화면에서 사라지면 잡는다.
    'stale-as-draft': ["c.reviewStale ? n('p', '✖ 준비 상태 무효", "false ? n('p', '✖ 준비 상태 무효"],
    'no-stage-warning': ["if (r.warnings.length) { const w", "if (false) { const w"],
    'zip-note-gone': ["row.append(b('내용·금액·사진 선택', () => claimEditor(c)), b('자료 검토 확인', () => reviewEditor(c)), zip, zipNote,", "row.append(b('내용·금액·사진 선택', () => claimEditor(c)), b('자료 검토 확인', () => reviewEditor(c)), zip,"],
    'submission-as-ready': ["'claim-line claim-submitted'", "'claim-line claim-ready'"]
  };
  const pair = mutations[MUTANT]; assert(pair && content.includes(pair[0]), 'mutation anchor missing ' + MUTANT); hit = true;
  content = content.replace(pair[0], pair[1]);
  if (MUTANT === 'claim-no-recheck') content = content.replace("if (!(final.bundle || final).reviewCurrent || (final.bundle || final).fingerprint !== bundle.fingerprint)", 'if (false)');
  return content;
}
async function make(options = {}) { return harness({ store: seedTen(), mutate, ...options }); }
async function test(label, fn) { await fn(); count++; console.log('PASS ' + label); }
async function settle(h) { await h.page.waitForFunction(() => !document.getElementById('projectEditor').open); }
async function selectProject(h) { await h.page.click('#tabProjects'); await h.page.selectOption('#xp-projectSelect', 'p1'); }
// v333: [저장] queues the original and closes the dialog; the queue uploads in the background. Wait for the card, not a timer.
async function drained(h, n) { await h.page.waitForFunction(n => document.querySelectorAll('#projectEvidence article').length >= n && !document.querySelector('#uploadQueue [data-queue-key]'), n); }
async function upload(h, buffer = PNG) {
  await selectProject(h); await h.page.getByRole('button', { name: '작업 사진·동영상 올리기', exact: true }).click();
  await h.page.selectOption('#xp-task', 'work1'); await h.page.selectOption('#xp-phase', 'after'); await h.page.fill('#xp-caption', '모의 마무리 원본');
  await h.page.locator('#xp-files').setInputFiles({ name: 'PRIVATE_TEST_NAME.png', mimeType: 'image/png', buffer });
}
async function claimReady(h) {
  await upload(h); await h.page.click('#projectSave'); await settle(h); await drained(h, 1);
  await h.page.click('#tabClaims'); await h.page.getByRole('button', { name: '청구 준비 건 만들기' }).click();
  await h.page.selectOption('#xp-projectId', 'p1'); await h.page.selectOption('#xp-mode', 'customer-support'); await h.page.fill('#xp-insurerName', '모의 보험사'); await h.page.fill('#xp-accidentDate', DATE);
  for (const key of ['incident', 'cause', 'repair']) await h.page.fill('#xp-' + key, '모의로 확인한 ' + key);
  await h.page.fill('#xp-desc0', '원인 교정 모의 보수'); await h.page.fill('#xp-amount0', '120000');
  await h.page.locator('#claimEvidence input').check(); await h.page.locator('input[name=insurerConfirmed]').check(); await h.page.locator('input[name=consentConfirmed]').check();
  await h.page.click('#projectSave'); await settle(h); await h.page.getByRole('button', { name: '자료 검토 확인', exact: true }).click(); await h.page.locator('input[name=reviewConfirm]').check(); await h.page.click('#projectSave'); await settle(h);
  assert.equal(engine.teamPresent_(h.store, { userId: 'TEST_OWNER_USER', officeId: 'TEST_OFFICE' }).claims[0].reviewCurrent, true);
}
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) }); setBrowser(browser);
  await test('10 technicians; batch opens without writes, ten rows stored atomically, mobile no overflow', async () => {
    const h = await make(); await h.login(); await h.page.click('#tabPlanner');
    assert.equal(await h.page.locator('#technicianBoard > article').count(), 11); // owner plus ten technicians
    await h.page.getByRole('button', { name: '최대 10건 일괄 배정' }).click(); assert.equal(h.writes.length, 0);
    for (let i = 0; i < 10; i++) { if (i) await h.page.getByRole('button', { name: '배정 칸 추가' }).click(); await h.page.selectOption('#xp-p' + i, i % 2 ? 'p2' : 'p1'); await h.page.selectOption('#xp-t' + i, i < 5 ? 't1' : 't2'); await h.page.selectOption('#xp-m' + i, 'tech' + (i + 1)); await h.page.fill('#xp-title' + i, '모의 기술자 작업 ' + i); }
    assert(await h.page.getByRole('button', { name: '배정 칸 추가' }).isDisabled());
    await h.page.click('#projectSave'); await settle(h); assert.equal(h.store.tasks.length, 10); assert.equal(h.store.revision, 1); assert.equal(h.writes.length, 1);
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.HJ_PROJECT_PREVIEW) await h.page.screenshot({ path: process.env.HJ_PROJECT_PREVIEW, fullPage: true });
    await h.close();
  });
  await test('project CRUD, explicit task linkage, employee schedule preserved on report', async () => {
    const s = seedTen(); s.tasks = [task()]; const shared = { store: s }; const h = await make({ shared }); await h.login();
    await h.page.click('#tabProjects'); await h.page.getByRole('button', { name: '프로젝트 등록', exact: true }).click(); await h.page.fill('#xp-name', '<img src=x onerror=alert(1)> 모의 현장'); await h.page.locator('input[name=teams][value=t1]').check(); await h.page.click('#projectSave'); await settle(h);
    assert.equal(h.store.projects.length, 3); assert.equal(await h.page.locator('img[src=x]').count(), 0); await h.close();
    const member = await make({ role: 'tech1', shared }); await member.login(); await member.page.getByRole('button', { name: '업무 확인·수정', exact: true }).click(); assert(await member.page.isDisabled('#edit-projectId')); await member.page.fill('#edit-handoff', '새 모의 작업 보고'); await member.page.click('#save'); await member.page.waitForFunction(() => !document.getElementById('editor').open);
    assert.equal(shared.store.tasks[0].projectId, 'p1'); assert.equal(shared.store.tasks[0].startTime, '09:00'); assert.equal(shared.store.tasks[0].handoff, '새 모의 작업 보고'); await member.close();
  });
  await test('upload response loss: queue retries automatically with the exact same request, one evidence record', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s, role: 'tech1' }); await h.login(); await upload(h); h.failNext = 'network-after-write';
    await h.page.click('#projectSave'); await settle(h);
    await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]')); // lost response: waiting with backoff, not 'done'
    const first = clone(h.writes[0]); assert.equal(h.store.evidence.length, 1);
    await drained(h, 1); assert.deepEqual(h.writes[1], first); assert.equal(h.store.evidence.length, 1); assert.equal(h.store.evidence[0].sha256, digest(PNG)); assert.equal(h.files[h.store.evidence[0].id], PNG.toString('base64'));
    assert.equal(await h.page.locator('#projectEvidence article').count(), 1); await h.close();
  });
  await test('employee cannot view peer photos, insurance documents or claims, including hash navigation', async () => {
    const s = seedTen(); s.tasks = [task(), task('work2', 'tech2')]; s.evidence = [{ id: crypto.randomUUID(), projectId: 'p1', taskId: 'work2', kind: 'photo', phase: 'before', caption: '모의 타인 사진', mime: 'image/png', size: PNG.length, sha256: digest(PNG) }, { id: crypto.randomUUID(), projectId: 'p1', taskId: '', kind: 'document', phase: 'document', caption: '모의 금융 서류', mime: 'application/pdf', size: 12, sha256: 'a'.repeat(64) }];
    const h = await make({ store: s, role: 'tech1', hash: '#claims' }); await h.login(); assert.equal(await h.page.locator('#tabClaims').isVisible(), false); assert.equal(new URL(h.page.url()).hash, '#mine'); await selectProject(h);
    assert.equal(await h.page.locator('#projectEvidence article').count(), 0); assert(!(await h.page.textContent('body')).includes('모의 금융 서류')); await h.close();
  });
  await test('upload revision conflict is rebased (same original UUID and bytes, new request); invalid input stops for a person', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await upload(h); h.failNext = 'network-before-write';
    await h.page.click('#projectSave'); await settle(h); await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    const original = clone(h.writes[0]); h.store.revision++; await h.page.getByRole('button', { name: '다시 올리기', exact: true }).click(); await drained(h, 1);
    assert.equal(h.writes.at(-1).payload.entity.id, original.payload.entity.id); assert.equal(h.writes.at(-1).payload.base64, original.payload.base64); assert.notEqual(h.writes.at(-1).payload.requestId, original.payload.requestId); assert.equal(Object.keys(h.files).length, 1);
    const second = Buffer.concat([PNG, Buffer.from('second original')]); // a different original: the queue skips an exact re-upload of the same file for the same task
    await upload(h, second); await h.page.locator('#xp-caption').evaluate(el => { el.value = 'x'.repeat(1001); }); await h.page.click('#projectSave'); await settle(h);
    await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=failed]')); assert.equal(h.store.evidence.length, 1, 'invalid input is not retried into the server');
    h.page.once('dialog', d => d.accept()); await h.page.locator('#uploadQueue').getByRole('button', { name: '취소', exact: true }).click(); await h.page.waitForFunction(() => !document.querySelector('#uploadQueue [data-queue-key]'));
    await upload(h, second); await h.page.fill('#xp-caption', '수정된 모의 설명'); await h.page.click('#projectSave'); await settle(h); await drained(h, 2); assert.equal(h.store.evidence.at(-1).caption, '수정된 모의 설명'); await h.close();
  });
  await test('hash-mismatched original is never displayed and logout clears delayed evidence', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await upload(h); await h.page.click('#projectSave'); await settle(h); await drained(h, 1);
    const e = h.store.evidence[0]; h.files[e.id] = Buffer.alloc(PNG.length).toString('base64'); await h.page.getByRole('button', { name: '원본 사진 보기' }).click(); await h.page.waitForFunction(() => document.getElementById('projectEvidence').textContent.includes('확인하지 못했습니다'));
    assert.equal(await h.page.locator('#projectEvidence img').count(), 0);
    h.files[e.id] = PNG.toString('base64'); let release; h.holdEvidence = { promise: new Promise(r => { release = r; }) }; await h.page.getByRole('button', { name: '원본 사진 보기' }).click(); await h.page.waitForFunction(() => document.getElementById('projectEvidence').textContent.includes('확인 중'));
    await h.page.click('#logout'); release(); await h.page.waitForFunction(() => document.getElementById('workspace').hidden); assert.equal(await h.page.locator('#projectEvidence img').count(), 0); assert.deepEqual(await h.page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]); await h.close();
  });
  await test('reviewed ZIP has real bytes; download never marks submitted; explicit manual record only', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await claimReady(h);
    const before = h.store.revision, downloaded = h.page.waitForEvent('download'); await h.page.getByRole('button', { name: '제출 준비 ZIP 받기' }).click(); const d = await downloaded; const bytes = fs.readFileSync(await d.path()); assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('ZIP을 만들었습니다'));
    assert.equal(h.store.revision, before); assert.equal(h.store.claims[0].submissions.length, 0); assert(!h.writes.some(w => w.action === 'claimSubmitRecord'));
    await h.page.getByRole('button', { name: '직접 제출한 사실 기록' }).click(); await h.page.fill('#xp-channel', '모의 직접 제출 경로'); await h.page.fill('#xp-referenceNo', 'TEST_RECEIPT'); await h.page.click('#projectSave'); await settle(h); assert.equal(h.store.claims[0].submissions.length, 1); assert(h.store.claims[0].submissions[0].snapshot);
    await h.close();
  });
  await test('[v333] stage warnings, preparation vs manual submission are separate lines; changed data invalidates preparation', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await claimReady(h);
    const card = h.page.locator('#claimList article').first();
    const warn = await card.locator('[data-claim-warnings]').getAttribute('data-claim-warnings');
    assert.equal(warn, 'missing-before missing-cause missing-document', 'only an after photo was selected: before/cause/PDF are warned, review still allowed');
    assert((await card.locator('[data-claim-warnings]').textContent()).includes('선택 사항 — 없어도 제출 준비·기록을 막지 않습니다'), '대표 결정 2026-10-01: 단계 경고는 선택 사항이라고 말해야 한다');
    assert.equal(await card.locator('[data-claim-prep]').getAttribute('data-claim-prep'), 'ready'); assert((await card.locator('[data-claim-prep]').textContent()).includes('제출 준비 완료(검토 고정)'));
    assert.equal(await card.locator('[data-claim-submission]').getAttribute('data-claim-submission'), 'none');
    assert.equal(await card.locator('[data-zip-note]').textContent(), '다운로드는 제출 기록이 아닙니다'); assert(await card.locator('[data-zip-note]').isVisible());
    const colors = await card.evaluate(el => [getComputedStyle(el.querySelector('[data-claim-prep]')).backgroundColor, getComputedStyle(el.querySelector('[data-claim-submission]')).backgroundColor]); assert.notEqual(colors[0], colors[1], 'preparation and submission lines use different colors');
    await h.page.getByRole('button', { name: '직접 제출한 사실 기록' }).click(); await h.page.fill('#xp-channel', '모의 직접 제출 경로'); await h.page.fill('#xp-referenceNo', 'TEST_RECEIPT_V333'); await h.page.click('#projectSave'); await settle(h);
    const rec = h.page.locator('#claimList article').first().locator('[data-claim-submission="record"]'); assert.equal(await rec.count(), 1); assert((await rec.textContent()).includes('TEST_RECEIPT_V333')); assert(await rec.evaluate(el => el.classList.contains('claim-submitted') && !el.classList.contains('claim-ready')));
    h.store.tasks[0].handoff = '검토 뒤 바뀐 모의 보고'; h.store.revision++; await h.page.click('#refresh'); await h.page.waitForFunction(() => document.querySelector('#claimList [data-claim-prep]')?.dataset.claimPrep === 'stale');
    assert((await h.page.textContent('#claimList [data-claim-prep]')).includes('준비 상태 무효 — 검토 뒤 자료가 바뀌었습니다'));
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '360px no overflow with new lines');
    await h.close();
  });
  await test('report change while original download in flight prevents stale ZIP', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await claimReady(h); let downloads = 0, release;
    h.page.on('download', () => downloads++); h.holdEvidence = { promise: new Promise(r => { release = r; }) }; await h.page.getByRole('button', { name: '제출 준비 ZIP 받기' }).click();
    await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('검증하고'));
    // Wait for evidenceRead without sleeps, then invalidate the server source before the re-check.
    for (let i = 0; i < 100 && h.holdEvidence; i++) await h.page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(h.holdEvidence, null); h.store.tasks[0].handoff = '자료 생성 중 변경 모의'; release();
    await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('다시 검토')); assert.equal(downloads, 0); await h.close();
  });
  await test('review conflict must reopen latest details, reset confirmation and pin new fingerprint', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await claimReady(h);
    await h.page.getByRole('button', { name: '자료 검토 확인', exact: true }).click(); await h.page.locator('input[name=reviewConfirm]').check();
    h.store.claims[0].items[0].amount = 222222; h.store.revision++; await h.page.click('#projectSave'); await h.page.getByRole('button', { name: '최신 내용 확인', exact: true }).click();
    await h.page.getByRole('button', { name: '비교한 초안 다시 검토' }).waitFor({ state: 'visible' });
    assert((await h.page.textContent('#projectFields')).includes('222222')); await h.page.getByRole('button', { name: '비교한 초안 다시 검토' }).click(); await h.page.locator('input[name=reviewConfirm]').waitFor();
    assert.equal(await h.page.locator('input[name=reviewConfirm]').isChecked(), false); assert((await h.page.textContent('#projectFields')).includes('222222')); await h.page.locator('input[name=reviewConfirm]').check(); await h.page.click('#projectSave'); await settle(h);
    const writes = h.writes.filter(w => w.action === 'claimReview'); assert.notEqual(writes.at(-1).payload.entity.expectedFingerprint, writes.at(-2).payload.entity.expectedFingerprint); await h.close();
  });
  await test('editing other claim fields preserves all fifty supported cost items', async () => {
    const s = seedTen(); s.tasks = [task()]; const h = await make({ store: s }); await h.login(); await claimReady(h);
    h.store.claims[0].items = Array.from({ length: 50 }, (_, i) => ({ kind: 'cause', description: '모의 내역 ' + i, amount: 1000 + i })); h.store.revision++;
    await h.page.click('#refresh'); await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('서버 자료를 확인'));
    await h.page.getByRole('button', { name: '내용·금액·사진 선택' }).click(); assert.equal(await h.page.locator('#claimItems > fieldset').count(), 50); assert(await h.page.getByRole('button', { name: '금액 항목 추가' }).isDisabled());
    await h.page.fill('#xp-insurerName', '모의 수정 보험사'); await h.page.click('#projectSave'); await settle(h); assert.equal(h.store.claims[0].items.length, 50); assert.equal(h.store.claims[0].items.at(-1).amount, 1049); await h.close();
  });
  assert(!MUTANT || hit, 'mutation did not apply'); await browser.close(); console.log('company-projects-ui: ' + count + '/' + count + ' PASS');
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('child_process'); for (const mode of ['batch-auto-save', 'retry-new-id', 'claim-auto-submit', 'claim-no-recheck', 'ignore-hash', 'stale-as-draft', 'no-stage-warning', 'zip-note-gone', 'submission-as-ready']) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_PROJECT_UI_MUTATION: mode }, timeout: 170000, encoding: 'utf8' }); assert(!r.error, String(r.error)); assert.notEqual(r.status, 0, mode + ' survived'); assert((r.stdout + r.stderr).includes('FAIL company-projects-ui'), mode + ' no assertion reached'); console.log('DETECTED ' + mode);
  }
} else run().catch(async e => { console.error('FAIL company-projects-ui:', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });
