/* v333 staff upload queue: HEIC originals, chunked video, persistent retry. All accounts, files and servers are synthetic. */
'use strict';
const assert = require('assert'), crypto = require('crypto');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const { harness, seed, digest, setBrowser } = require('./company-team-ui.e2e.js');
const MUTANT = process.env.HJ_UPLOAD_MUTATION || '';
const DATE = '2026-09-27', MiB = 1048576, CDN = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF0sAAAAASUVORK5CYII=', 'base64');
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.from('mif1heicTEST_ONLY_NOT_A_REAL_IMAGE')]);
const VIDEO = (() => { const b = Buffer.alloc(2 * MiB + 300 * 1024); for (let i = 0; i < b.length; i++) b[i] = (i * 13 + 5) & 255; b.write('ftypisom', 4, 'latin1'); return b; })();
// Each mutation undoes one promise of the queue; the run must fail.
const MUTATIONS = {
  'no-persist': ["if (!fits) { item.volatile = true; item.warn = 'device-only'; } else await save(item);", 'item.volatile = true;'],
  'new-request-on-retry': ['if (!item.requestId) await stamp(item);', 'await stamp(item);'],
  'resend-from-zero': ["      while (live(e) && !item.cancelled && up && up.state === 'uploading') {", "      if (up && up.state === 'uploading') up.offset = 0;\n      while (live(e) && !item.cancelled && up && up.state === 'uploading') {"],
  'no-online-retry': ["mine().forEach(i => { if (i.state === 'waiting') i.nextAt = 0; }); kick();", '/* mutation: offline items wait forever */'],
  'scope-leak': ["const scope = () => ctx.data()?.me?.id || '';", "const scope = () => ctx.data() ? 'shared-device' : '';"],
  'cancel-noop': ['if (active !== i) await drop(i);', '/* mutation: cancel keeps the copy */'],
  'no-committed-check': ['if (committed(item)) return true;', 'if (c === "duplicate") throw err;'],
  'offline-polling': ["const next = online ? mine()", "const next = true ? mine()"],
  'failed-says-auto-retry': ["state === 'failed' && (i.detail || RETRY.includes(i.error) || i.error === 'upload-not-found')", "state === 'failed' && i.detail"],
  'heic-no-preview': ['const out = await (await loadHeic2any())', 'throw new Error("mutation"); const out = await (await loadHeic2any())']
};
let hit = false;
function mutate(name, content) {
  if (!MUTANT) return content;
  const [from, to] = MUTATIONS[MUTANT] || []; assert(from, 'unknown mutation ' + MUTANT);
  if (!content.includes(from)) return content; hit = true; return content.replace(from, to);
}
function store() {
  const s = seed(); s.members = s.members.filter(m => m.id === 'owner'); s.tasks = [];
  for (const i of [1, 2]) s.members.push({ id: 'tech' + i, userId: 'TEST_TECH_' + i, officeId: 'TEST_OFFICE', name: '모의 기술자 ' + i, role: 'member', active: true, teamIds: ['t1'] });
  s.projects = [{ id: 'p1', name: '모의 아파트 A', active: true, teamIds: ['t1'] }]; s.evidence = []; s.claims = [];
  for (const i of [1, 2]) s.tasks.push({ id: 'work' + i, title: '모의 누수 확인 ' + i, project: '모의 아파트 A', projectId: 'p1', teamId: 't1', assigneeId: 'tech' + i, due: DATE, workDate: DATE, startTime: '09:00', endTime: '12:00', status: 'doing', handoff: '모의 보고', sourceRef: '', updatedAt: DATE + 'T00:00:00Z', updatedBy: 'owner' });
  return s;
}
let browser, count = 0;
async function test(label, fn) { await fn(); count++; console.log('PASS ' + label); }
async function make(role = 'tech1') {
  const h = await harness({ store: store(), role, mutate }); await h.login(); await openProject(h); return h;
}
async function openProject(h) { await h.page.click('#tabProjects'); await h.page.selectOption('#xp-projectSelect', 'p1'); }
async function choose(h, files, task = 'work1') {
  await h.page.getByRole('button', { name: '작업 사진·동영상 올리기', exact: true }).click();
  await h.page.selectOption('#xp-task', task); await h.page.selectOption('#xp-phase', 'cause'); await h.page.fill('#xp-caption', '모의 원인 확인 원본');
  await h.page.locator('#xp-files').setInputFiles(files); await h.page.click('#projectSave');
  await h.page.waitForFunction(() => !document.getElementById('projectEditor').open);
}
const rows = h => h.page.locator('#uploadQueue [data-queue-key]');
async function drained(h, n) { await h.page.waitForFunction(n => document.querySelectorAll('#projectEvidence article').length >= n && !document.querySelector('#uploadQueue [data-queue-key]'), n, { timeout: 15000 }); }
async function idbCount(page) {
  return page.evaluate(() => new Promise((ok, no) => { const r = indexedDB.open('hj-team-upload', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'key' }); r.onerror = () => no(r.error); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').count(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => no(q.error); }; }));
}
async function relogin(h, role) { await h.page.click('#logout'); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden); if (role) h.role = role; await h.login(); await openProject(h); }
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) }); setBrowser(browser);
  await test('HEIC with an empty browser type is kept as the HEIC original; preview converts on this device only', async () => {
    const h = await make(); let cdn = 0;
    await h.page.route(CDN, route => { cdn++; return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.heic2any=async({blob,toType})=>{if(toType!=="image/jpeg")throw Error("type");return new Blob([Uint8Array.from(atob(' + JSON.stringify(PNG.toString('base64')) + '),c=>c.charCodeAt(0))],{type:"image/png"});};' }); });
    await choose(h, { name: 'IMG_0001.HEIC', mimeType: '', buffer: HEIC }); await drained(h, 1);
    const e = h.store.evidence[0]; assert.deepEqual([e.mime, e.kind, e.size, e.sha256], ['image/heic', 'photo', HEIC.length, digest(HEIC)]); assert.equal(h.files[e.id], HEIC.toString('base64'), 'uploaded bytes are the untouched original');
    assert((await h.page.textContent('#projectEvidence')).includes('HEIC 원본'));
    await h.page.getByRole('button', { name: '원본 사진 보기' }).click(); await h.page.waitForFunction(() => document.querySelector('#projectEvidence img')?.naturalWidth > 0);
    assert.equal(cdn, 1); assert((await h.page.textContent('#projectEvidence')).includes('원본(HEIC)은 바뀌지 않았습니다')); assert.equal(h.store.evidence.length, 1); await h.close();
  });
  await test('video goes in 1MiB chunks with visible progress, then one video record; viewing reassembles and verifies the original', async () => {
    const h = await make(); let release; h.mediaCalls = [];
    // Media call 1 = begin, 2 = first chunk, 3 = second chunk: hold call 3 so the in-progress state is observable.
    h.holdMedia = { at: 3, promise: new Promise(r => { release = r; }) };
    await choose(h, { name: 'LEAK_' + 'X'.repeat(90) + '.MOV', mimeType: 'video/mp4', buffer: VIDEO });
    await h.page.waitForFunction(() => { const p = document.querySelector('#uploadQueue progress'); return p && p.value > 0 && document.querySelector('#uploadQueue [data-queue-state=uploading]'); });
    assert((await h.page.textContent('#uploadQueue')).match(/올리는 중 \d+%/));
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '360px: a long file name in the queue does not widen the page');
    assert.deepEqual(await h.page.locator('#uploadQueue button').evaluateAll(bs => bs.filter(b => b.getBoundingClientRect().height < 44).length), 0);
    release(); await drained(h, 1);
    const e = h.store.evidence[0]; assert.deepEqual([e.kind, e.mime, e.size, e.sha256, e.duration], ['video', 'video/mp4', VIDEO.length, digest(VIDEO), '']);
    assert.equal(Buffer.from(h.files[e.id], 'base64').equals(VIDEO), true);
    assert.deepEqual(h.mediaCalls.filter(c => c.action === 'evidenceMediaChunk').map(c => c.offset), [0, MiB, 2 * MiB]);
    assert(!h.writes.some(w => 'base64' in w.payload), 'video never travels as one body');
    const card = await h.page.textContent('#projectEvidence'); assert(card.includes('🎬 동영상')); assert(card.includes('길이 모름'), 'unknown duration stays unknown');
    await h.page.getByRole('button', { name: '원본 동영상 보기' }).click(); await h.page.waitForFunction(() => document.querySelector('#projectEvidence video[src^="blob:"]'));
    assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await h.close();
  });
  await test('response lost mid-video + reload: queue survives in this device, resumes at the server offset, one record', async () => {
    const h = await make(); h.mediaCalls = []; h.failMedia = { at: 3, mode: 'network-after' }; // the server stores chunk 2, its answer is lost
    await choose(h, { name: 'LEAK.mp4', mimeType: 'video/mp4', buffer: VIDEO });
    await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    assert((await h.page.textContent('#uploadQueue')).includes('연결이 끊겼습니다')); assert.equal(await idbCount(h.page), 1);
    await h.page.reload(); await h.login(); await openProject(h); await drained(h, 1);
    const chunks = h.mediaCalls.filter(c => c.action === 'evidenceMediaChunk').map(c => c.offset);
    assert.deepEqual(chunks, [0, MiB, 2 * MiB], 'after reload the queue continued from the server offset, not from zero: ' + chunks);
    assert.equal(h.store.evidence.length, 1); assert.equal(Buffer.from(h.files[h.store.evidence[0].id], 'base64').equals(VIDEO), true); assert.equal(await idbCount(h.page), 0, 'device copy removed after server confirmation'); await h.close();
  });
  await test('photo response lost: automatic retry with the SAME request; reselecting the same file is not a duplicate', async () => {
    const h = await make(); h.failNext = 'network-after-write';
    await choose(h, { name: 'a.png', mimeType: 'image/png', buffer: PNG }); await drained(h, 1);
    assert.equal(h.writes.length, 2); assert.deepEqual(h.writes[1], h.writes[0]); assert.equal(h.store.evidence.length, 1);
    await choose(h, { name: 'again.png', mimeType: 'image/png', buffer: PNG }); await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('같은 원본 1개는 뺐습니다'));
    assert.equal(h.store.evidence.length, 1); assert.equal(h.writes.length, 2); await h.close();
  });
  for (const mode of ['duplicate-after-write', 'conflict-after-write']) await test('server already holds the evidence but answers ' + mode.split('-')[0] + ': the item finishes as done, no failure, one record', async () => {
    const h = await make(); h.failNext = mode;
    await choose(h, { name: mode + '.png', mimeType: 'image/png', buffer: PNG }); await drained(h, 1);
    assert.equal(h.store.evidence.length, 1); assert.equal(h.writes.length, 1, 'already committed: no resend after the refresh'); assert.equal(await idbCount(h.page), 0); await h.close();
  });
  await test('offline with a passed retry deadline: no timer loop until the online event', async () => {
    const h = await make(); h.failNext = 'network-before-write';
    await choose(h, { name: 'loop.png', mimeType: 'image/png', buffer: PNG }); await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    await h.context.setOffline(true);
    // Count every pump timer armed while offline, across the 2 s backoff deadline and one more second.
    await h.page.evaluate(() => { const o = window.setTimeout; window.__pumpTimers = 0; window.__t0 = Date.now(); window.setTimeout = (f, d, ...a) => { if (f && f.name === 'pump') window.__pumpTimers++; return o(f, d, ...a); }; });
    await h.page.waitForFunction(() => Date.now() - window.__t0 > 3200, null, { polling: 200, timeout: 10000 });
    const armed = await h.page.evaluate(() => window.__pumpTimers); assert(armed <= 1, 'offline queue re-armed its timer ' + armed + ' times');
    assert.equal(h.store.evidence.length, 0); await h.context.setOffline(false); await drained(h, 1); await h.close();
  });
  await test('a failed item stored without detail (attempt budget spent) never promises an automatic retry after reload', async () => {
    const h = await make(); h.failNext = 'network-before-write';
    await choose(h, { name: 'budget.png', mimeType: 'image/png', buffer: PNG }); await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    await h.context.setOffline(true);
    // Rewrite the stored row as an older build left it: failed, retryable cause, no detail.
    await h.page.evaluate(() => new Promise((ok, no) => { const r = indexedDB.open('hj-team-upload', 1); r.onsuccess = () => { const t = r.result.transaction('items', 'readwrite'), st = t.objectStore('items'), q = st.getAll(); q.onsuccess = () => { q.result.forEach(row => { row.state = 'failed'; row.error = 'network'; row.attempts = 6; delete row.detail; st.put(row); }); }; t.oncomplete = () => { r.result.close(); ok(); }; t.onerror = () => no(t.error); }; r.onerror = () => no(r.error); }));
    // Leave the page before going online, or the 'online' event would upload the in-memory copy first.
    const url = h.page.url(); await h.page.goto('about:blank'); await h.context.setOffline(false); await h.page.goto(url); await h.login(); await openProject(h);
    await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=failed]'));
    const text = await h.page.textContent('#uploadQueue'); assert(text.includes('여러 번 실패했습니다'), text); assert(!text.includes('자동으로 다시 올립니다'), text);
    h.page.once('dialog', d => d.accept()); await h.page.locator('#uploadQueue').getByRole('button', { name: '취소', exact: true }).click();
    await h.page.waitForFunction(() => !document.querySelector('#uploadQueue [data-queue-key]')); await h.close();
  });
  await test('offline: originals wait; coming back online uploads them without a click', async () => {
    const h = await make(); await h.context.setOffline(true);
    await choose(h, { name: 'offline.png', mimeType: 'image/png', buffer: PNG });
    await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=queued]'));
    assert.equal(h.store.evidence.length, 0); assert.equal(h.writes.length, 0, 'offline: not even an attempt that would burn the retry budget');
    await h.context.setOffline(false); await drained(h, 1); assert.equal(h.store.evidence.length, 1); await h.close();
  });
  await test('another staff member on the same device never sees or sends my queued originals', async () => {
    const h = await make(); h.failNext = 'network-before-write';
    await choose(h, { name: 'mine.png', mimeType: 'image/png', buffer: PNG }); await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    const before = h.writes.length; await relogin(h, 'tech2');
    // tech2 uploads one own photo: the queue runs oldest-first, so a leaked tech1 item would have been sent before it.
    await choose(h, { name: 'theirs.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.from('tech2')]) }, 'work2'); await drained(h, 1);
    assert.deepEqual(h.writes.slice(before).map(w => w.payload.entity.name), ['theirs.png'], 'tech2 session never sends tech1 originals');
    assert.deepEqual(h.store.evidence.map(e => e.uploaderId), ['tech2']); assert(!(await h.page.textContent('body')).includes('mine.png'));
    await relogin(h, 'tech1'); await drained(h, 1); assert.deepEqual(h.store.evidence.map(e => e.uploaderId + ':' + e.name), ['tech2:theirs.png', 'tech1:mine.png'], 'the owner of the queue sends it after logging in again'); await h.close();
  });
  await test('cancel removes the device copy and nothing is sent later', async () => {
    const h = await make(); h.failNext = 'network-before-write';
    await choose(h, { name: 'cancel.png', mimeType: 'image/png', buffer: PNG }); await h.page.waitForFunction(() => document.querySelector('#uploadQueue [data-queue-state=waiting]'));
    const writes = h.writes.length; h.page.once('dialog', d => d.accept()); await h.page.locator('#uploadQueue').getByRole('button', { name: '취소', exact: true }).click();
    await h.page.waitForFunction(() => !document.querySelector('#uploadQueue [data-queue-key]')); assert.equal(await idbCount(h.page), 0);
    // A later upload drains the queue: a cancelled item would have gone first.
    await choose(h, { name: 'kept.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.from('kept')]) }); await drained(h, 1);
    assert.deepEqual(h.writes.slice(writes).map(w => w.payload.entity.name), ['kept.png']); assert.deepEqual(h.store.evidence.map(e => e.name), ['kept.png']); await h.close();
  });
  await test('no room on this device: still uploads now, but says plainly the original is not kept', async () => {
    const h = await make(); await h.page.evaluate(() => { navigator.storage.estimate = async () => ({ quota: 1000, usage: 990 }); });
    h.failNext = 'network-before-write';
    await choose(h, { name: 'full.png', mimeType: 'image/png', buffer: PNG });
    await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('보관하지 못했습니다'));
    assert((await h.page.textContent('#uploadQueue')).includes('이 기기에 원본을 보관하지 못했습니다')); assert.equal(await idbCount(h.page), 0);
    await drained(h, 1); await h.close();
  });
  await test('unsupported formats are refused before anything is queued; picker offers HEIC and video', async () => {
    const h = await make();
    await h.page.getByRole('button', { name: '작업 사진·동영상 올리기', exact: true }).click(); await h.page.selectOption('#xp-task', 'work1');
    await h.page.locator('#xp-files').setInputFiles({ name: 'clip.avi', mimeType: 'video/x-msvideo', buffer: VIDEO.subarray(0, 64) }); await h.page.click('#projectSave');
    await h.page.waitForFunction(() => document.getElementById('projectEditMessage').textContent.includes('MP4·MOV·WebM')); assert.equal(await rows(h).count(), 0); assert.equal(await idbCount(h.page), 0);
    assert.equal(await h.page.locator('#xp-files').evaluate(el => el.accept.includes('image/heic') && el.accept.includes('video/quicktime')), true); await h.close();
  });
  assert(!MUTANT || hit, 'mutation did not apply'); await browser.close(); console.log('team-upload: ' + count + '/' + count + ' PASS');
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('child_process'); let survived = 0;
  for (const mode of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_UPLOAD_MUTATION: mode }, timeout: 230000, encoding: 'utf8' });
    const caught = r.status !== 0 && (r.stdout + r.stderr).includes('FAIL team-upload'); if (!caught) survived++; console.log((caught ? 'DETECTED ' : 'SURVIVED ') + mode);
  }
  process.exitCode = survived ? 1 : 0;
} else run().catch(async e => { console.error('FAIL team-upload:', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });
