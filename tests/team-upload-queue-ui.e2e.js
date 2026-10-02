/* Device queue UI: project labels, scoped filters, explicit retry and original retention. Synthetic data only. */
'use strict';
const assert = require('node:assert/strict');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const { harness, seed, setBrowser } = require('./company-team-ui.e2e.js');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF0sAAAAASUVORK5CYII=', 'base64');
const mutation = process.env.HJ_QUEUE_UI_MUTATION || '';
let hit = false, browser;
function mutate(name, source) {
  if (!mutation || name !== 'team-projects.js') return source;
  const pairs = {
    'ignore-project-filter': ["r.canRetry && (!queueProject || r.projectId === queueProject) && queueFilter !== 'active'", "r.canRetry && queueFilter !== 'active'"],
    'recreate-controls': ["if (!box.querySelector('#queueSummary')) {", 'if (true) { box.replaceChildren();'],
    'hide-labels': ["p?.name || '현장 접근 권한 확인 필요'", "'현장명 생략'"],
    'hide-legacy-warning': ["legacy.hidden = !summary.held;", 'legacy.hidden = true;']
  };
  const pair = pairs[mutation]; assert(pair, 'unknown mutation'); assert.equal(source.split(pair[0]).length - 1, 1, 'unique mutation anchor'); hit = true;
  return source.replace(...pair);
}
function store() {
  const s = seed(); s.projects = [1, 2].map(i => ({ id: 'p' + i, name: '모의 현장 ' + (i === 1 ? 'A' : 'B'), active: true, teamIds: ['t1'] }));
  s.tasks = [1, 2].map(i => ({ id: 'work' + i, title: '모의 배관 보수 ' + i, project: s.projects[i - 1].name, projectId: 'p' + i, teamId: 't1', assigneeId: 'member',
    due: '2026-10-02', status: 'doing', handoff: '모의 작업 중', sourceRef: '', updatedAt: '2026-10-02T00:00:00Z', updatedBy: 'owner' }));
  s.evidence = []; s.claims = []; return s;
}
async function seedQueue(page) {
  await page.evaluate(async bytes => {
    const endpoint = id => 'https://script.google.com/macros/s/AKfyTEST_' + id + '/exec';
    const scope = member => 'v2:' + JSON.stringify([endpoint('COMPANY'), endpoint('PORTAL'), 'TEST_OFFICE', member === 'member' ? 'TEST_MEMBER_USER' : 'TEST_OWNER_USER', member]);
    const rows = [];
    for (const [index, member, project, error, legacy] of [[1, 'member', 1, 'network', false], [2, 'member', 2, 'network', false], [3, 'member', 1, 'forbidden', false], [4, 'owner', 1, 'network', false], [5, 'member', 1, 'network', true]]) {
      const name = 'TEST_ORIGINAL_' + index + '.png', file = new File([new Uint8Array([...bytes, index])], name, { type: 'image/png' });
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join('');
      rows.push({ key: crypto.randomUUID(), scope: legacy ? member : scope(member), createdAt: Date.now() + index, file,
        entity: { id: crypto.randomUUID(), projectId: 'p' + project, taskId: 'work' + project, kind: 'photo', phase: 'after', caption: 'TEST_ONLY', capturedDate: '2026-10-02', name, mime: 'image/png', size: file.size, sha256: hash },
        requestId: crypto.randomUUID(), revision: 0, state: 'failed', error, detail: error === 'network' ? 'too-many-attempts' : '', attempts: 6 });
    }
    await new Promise((resolve, reject) => { const r = indexedDB.open('hj-team-upload', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'key' }); r.onerror = () => reject(r.error);
      r.onsuccess = () => { const db = r.result, tx = db.transaction('items', 'readwrite'); rows.forEach(row => tx.objectStore('items').put(row));
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
    window.TEST_QUEUE_ROWS = rows.map(r => ({ key: r.key, name: r.entity.name, requestId: r.requestId, evidenceId: r.entity.id, hash: r.entity.sha256 }));
  }, [...PNG]);
}
async function dbNames(page) {
  return page.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open('hj-team-upload', 1); r.onerror = () => reject(r.error);
    r.onsuccess = () => { const db = r.result, tx = db.transaction('items'), all = tx.objectStore('items').getAll(); tx.oncomplete = () => { db.close(); resolve(all.result.map(r => r.entity.name).sort()); }; tx.onerror = () => reject(tx.error); }; }));
}
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) }); setBrowser(browser);
  const h = await harness({ store: store(), role: 'member', mutate });
  try {
    await seedQueue(h.page); await h.login(); await h.page.click('#tabProjects');
    await h.page.waitForFunction(() => document.getElementById('queueSummary')?.textContent.includes('실패 3'));
    const text = await h.page.textContent('#uploadQueue'); assert(text.includes('등록'));
    assert.deepEqual((await h.page.locator('#uploadQueue [data-queue-key] .page-context').allTextContents()).sort(), ['모의 현장 A · 모의 배관 보수 1', '모의 현장 A · 모의 배관 보수 1', '모의 현장 B · 모의 배관 보수 2']);
    assert.equal(await h.page.locator('#uploadQueue [data-queue-key]').count(), 3);
    assert(!text.includes('TEST_ORIGINAL_4.png')); assert(!text.includes('TEST_ORIGINAL_5.png'));
    assert(await h.page.isVisible('#uploadQueueHeld')); assert((await h.page.textContent('#uploadQueueHeld')).includes('원본 1개'));
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '360px queue fits the phone');
    assert.deepEqual(await h.page.locator('#uploadQueue button,#uploadQueue select').evaluateAll(ns => ns.filter(n => n.getBoundingClientRect().height < 44 || parseFloat(getComputedStyle(n).fontSize) < 16).map(n => n.id)), []);
    console.log('PASS queue shows verified project/task labels and a held-original warning without other staff originals');
    await h.page.selectOption('#queueStateFilter', 'failed'); await h.page.selectOption('#queueProjectFilter', 'p1');
    assert.equal(await h.page.locator('#uploadQueue [data-queue-key]').count(), 2); assert((await h.page.textContent('#queueRetryBatch')).includes('(1개)'));
    await h.page.evaluate(() => { window.TEST_QUEUE_FILTER = document.getElementById('queueProjectFilter'); });
    await h.page.selectOption('#queueStateFilter', 'all'); await h.page.selectOption('#queueStateFilter', 'failed');
    // Individual cancel cancelled at confirmation: keep all originals. It must not alter the filter or transmit anything.
    h.page.once('dialog', d => d.dismiss()); await h.page.locator('#uploadQueue [data-queue-key]').first().getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(h.writes.length, 0); assert.equal((await dbNames(h.page)).length, 5);
    assert.equal(await h.page.evaluate(() => window.TEST_QUEUE_FILTER === document.getElementById('queueProjectFilter')), true);
    h.page.once('dialog', d => d.accept()); await h.page.click('#queueRetryBatch');
    await h.page.waitForFunction(() => /^전체 (1|2)개 · 대기 0 · 올리는 중 0/.test(document.getElementById('queueSummary').textContent));
    assert((await h.page.textContent('#queueSummary')).includes('실패 2')); assert.equal(await h.page.locator('#uploadQueue [data-queue-key]').count(), 1);
    assert.equal(h.writes.length, 1, 'only the visible retryable failure is sent');
    const original = (await h.page.evaluate(() => window.TEST_QUEUE_ROWS)).find(r => r.name === 'TEST_ORIGINAL_1.png');
    assert.equal(h.writes[0].payload.requestId, original.requestId); assert.equal(h.writes[0].payload.entity.id, original.evidenceId); assert.equal(h.writes[0].payload.entity.sha256, original.hash);
    assert.deepEqual(await dbNames(h.page), ['TEST_ORIGINAL_2.png', 'TEST_ORIGINAL_3.png', 'TEST_ORIGINAL_4.png', 'TEST_ORIGINAL_5.png']);
    assert.equal(await h.page.inputValue('#queueProjectFilter'), 'p1'); assert.equal(await h.page.inputValue('#queueStateFilter'), 'failed');
    assert(await h.page.isDisabled('#queueRetryBatch'), 'forbidden failures cannot enter a transient-error batch');
    await h.page.selectOption('#queueStateFilter', 'active'); assert.equal(await h.page.locator('#uploadQueue [data-queue-key]').count(), 0); assert(await h.page.isDisabled('#queueRetryBatch'));
    await h.page.click('#logout'); await h.login(); await h.page.click('#tabProjects');
    assert.equal(await h.page.inputValue('#queueProjectFilter'), ''); assert.equal(await h.page.inputValue('#queueStateFilter'), 'all');
    console.log('PASS manual retry respects visible project, keeps registration IDs and retains excluded originals');
    if (mutation) assert(hit, 'mutation anchor not reached');
  } finally { await h.close(); await browser.close(); }
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('node:child_process'); let caught = 0;
  for (const mode of ['ignore-project-filter', 'recreate-controls', 'hide-labels', 'hide-legacy-warning']) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_QUEUE_UI_MUTATION: mode }, timeout: 180000, encoding: 'utf8' });
    const detected = r.status === 1 && /AssertionError/.test(r.stdout + r.stderr) && !/unique mutation anchor/.test(r.stdout + r.stderr);
    console.log((detected ? 'DETECTED ' : 'SURVIVED ') + mode); if (detected) caught++;
  }
  console.log(caught + '/4 queue UI mutations detected'); process.exitCode = caught === 4 ? 0 : 1;
} else run().catch(async e => { console.error(e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });
