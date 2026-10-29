/* v454 인테리어 사진 시공 전/중/후 칸 · 완료보고서 공정 줄 중복(리허설 R2 남은 것). 합성 자료만, 외부 쓰기 0.
   ① 사진 추가 확인 창: 인테리어 현장이면 [시공 전][시공 중][완료 (시공 후)] 칩, 누수 현장이면 누수 태그만 ② 고른 단계가 공정 칸(_phase → 저장 phase)으로 들어가
   전/후 갤러리(beforeAfterPairs)·하자보증서 풀이 읽는다(STAGE_TAG_SAVED) · 공정이 이미 있으면 덮지 않음 ③ 완료보고서 작업 줄: '철거' 공정과 '시공 전 — 기존 욕실 철거 (2장)' 묶음이 한 줄(REPORT_NO_DUP_LINES).
   HJ_V454_BASELINE=<commit> 은 PHOTOTAGS_API_PRESENT 에서, HJ_V454_MUTATION=report-dup(묶음 맞추기 되돌림)은 REPORT_NO_DUP_LINES 에서 실패해야 한다. */
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
const P = 'TEST_V1 둔산 욕실', LEAK = 'TEST_V2 누수 현장';
let html = null;
if (process.env.HJ_V454_BASELINE) html = execFileSync('git', ['show', process.env.HJ_V454_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
else if (process.env.HJ_V454_MUTATION) {
  assert.equal(process.env.HJ_V454_MUTATION, 'report-dup');
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), needle = 'groupKeys(g).has(key)';
  assert.equal(src.split(needle).length, 2, 'mutation needle must appear once');
  html = src.replace(needle, 'hjPhaseHintKey(g.label)===key');
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
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async ({ P, LEAK }) => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    if (!document.body.classList.contains('mobile-mode')) { __mobileMode = true; applyMobileMode(); }
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    state.projects = [{ name: P, kind: 'interior', stage: 2, phases: ['철거', '방수', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-4901', addr: '대전 서구 둔산동 1-1' } },
      { name: LEAK, kind: 'leak', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '누수고객', phone: '010-0000-4902', addr: '대전 서구 월평동' }, leak: { intake: { where: ['욕실'], at: new Date().toISOString() } } }];
    state.tab = 'photos'; render();
  }, { P, LEAK });
  async function test(name, fn) { await fn(); passed++; console.log('PASS phototags-v454 ' + name); }
  const close = () => page.evaluate(() => closeModal(true));
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const makeFiles = names => page.evaluate(async names => { const out = []; for (const n of names) { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#334155'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#fff'; g.fillText(n, 10, 30); const blob = await new Promise(r => c.toBlob(r, 'image/png')); out.push(new File([blob], n, { type: 'image/png', lastModified: Date.now() })); } window.__v454Files = out; return out.length; }, names);

  await test('① PHOTOTAGS_API_PRESENT', async () => {
    assert.equal(await page.evaluate(() => typeof hjPhotoStageButtons === 'function' && typeof HJ_PHOTO_STAGE_PHASE === 'object' && HJ_PHOTO_STAGE_PHASE.before === '시공 전' && HJ_PHOTO_STAGE_PHASE.after === '완료'), true, 'PHOTOTAGS_API_PRESENT');
  });

  await test('② 사진 추가 확인 창: 인테리어 현장이면 시공 단계 칩(44px), 누수 현장이면 누수 태그만', async () => {
    await makeFiles(['TEST_v454_a.png']);
    await page.evaluate(() => openPhotoIntake(window.__v454Files, { source: 'gallery' }));
    await page.locator('#photoIntakeProject').waitFor();
    await page.locator('#photoIntakeProject').selectOption({ label: P });
    const interior = await page.evaluate(() => ({ stage: !document.getElementById('photoIntakeStageTags').hidden, leak: !document.getElementById('photoIntakeLeakTags').hidden, labels: [...document.querySelectorAll('[data-intake-stagetag]')].map(b => b.textContent.trim()) }));
    assert.deepEqual(interior, { stage: true, leak: false, labels: ['시공 전', '시공 중', '완료 (시공 후)'] });
    await tapOk('[data-intake-stagetag]');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no overflow at 390px');
    await page.locator('#photoIntakeProject').selectOption({ label: LEAK });
    const leak = await page.evaluate(() => ({ stage: !document.getElementById('photoIntakeStageTags').hidden, leak: !document.getElementById('photoIntakeLeakTags').hidden }));
    assert.deepEqual(leak, { stage: false, leak: true });
    await page.locator('#photoIntakeCancel').click(); await page.waitForFunction(() => !document.getElementById('photoIntakeProject'));
  });

  await test('③ 고른 단계가 공정 칸으로 저장되고 전/후 갤러리·보증서 풀이 읽는다(STAGE_TAG_SAVED) · 공정이 이미 있으면 덮지 않음', async () => {
    await makeFiles(['TEST_v454_before.png']);
    await page.evaluate(() => openPhotoIntake(window.__v454Files, { source: 'gallery' }));
    await page.locator('#photoIntakeProject').waitFor(); await page.locator('#photoIntakeProject').selectOption({ label: P });
    await page.locator('[data-intake-stagetag="before"]').click(); await page.locator('#photoIntakeWork').fill('기존 욕실 철거');
    await page.locator('#photoIntakeConfirm').click(); await page.locator('#photoIntakeResult').waitFor(); await page.waitForFunction(() => !__photoIntakeBusy); await close();
    const r = await page.evaluate(n => { const f = state.files.find(x => x.name === 'TEST_v454_before.png'); const pairs = beforeAfterPairs(n); return { phase: f._phase, work: f._worklabel, saved: serializeData().files.find(x => x.name === 'TEST_v454_before.png').phase, before: pairs.before.map(x => x.name), side: hjPhaseSideOf(f) }; }, P);
    assert.deepEqual(r, { phase: '시공 전', work: '기존 욕실 철거', saved: '시공 전', before: ['TEST_v454_before.png'], side: 'before' }, 'STAGE_TAG_SAVED ' + JSON.stringify(r));
    await makeFiles(['TEST_v454_after.png']);
    await page.evaluate(() => openPhotoIntake(window.__v454Files, { source: 'gallery', onRecord: (_f, rec) => { rec._phase = '타일'; } }));
    await page.locator('#photoIntakeProject').waitFor(); await page.locator('#photoIntakeProject').selectOption({ label: P });
    await page.locator('[data-intake-stagetag="after"]').click(); await page.locator('#photoIntakeConfirm').click(); await page.locator('#photoIntakeResult').waitFor(); await page.waitForFunction(() => !__photoIntakeBusy); await close();
    assert.equal(await page.evaluate(() => state.files.find(x => x.name === 'TEST_v454_after.png')._phase), '타일', 'a phase set by the caller hook (공정 붙이기 등) wins over the stage chip');
    const nostage = await page.evaluate(async n => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'TEST_v454_plain.png', { type: 'image/png', lastModified: Date.now() }); await runPhotoIntake([file], { project: n, workLabel: '자재 반입' }); const f = state.files.find(x => x.name === 'TEST_v454_plain.png'); return { phase: f._phase || null, keys: Object.keys(serializeData().files.find(x => x.name === 'TEST_v454_plain.png')).includes('stageTag') }; }, P);
    await close(); assert.deepEqual(nostage, { phase: null, keys: false }, 'no stage → no phase, and no new serialized key');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await test('④ 완료보고서 작업 줄: 공정 "철거"와 사진 묶음 "시공 전 — 기존 욕실 철거"가 한 줄 · 사진 공정 칸으로도 맞춤(REPORT_NO_DUP_LINES)', async () => {
    const r = await page.evaluate(n => {
      state.files = state.files.filter(f => !/^TEST_v454_/.test(f.name));
      const ph = (id, label, phase) => ({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', size: 10, project: n, when: new Date('2026-10-16T09:00:00+09:00'), _worklabel: label, _phase: phase || null });
      state.files.push(ph('TEST_V454_P1', '시공 전 — 기존 욕실 철거', null), ph('TEST_V454_P2', '시공 전 — 기존 욕실 철거', null), ph('TEST_V454_P3', '시공 중 — 방수 1차', '방수'), ph('TEST_V454_P4', '완료 — 벽 타일 마감', '타일'), ph('TEST_V454_P5', '자재 반입', null));
      return hjReportDraft(n).works;
    }, P);
    assert.deepEqual(r, ['시공 전 — 기존 욕실 철거 (10-16, 2장)', '시공 중 — 방수 1차 (10-16, 1장)', '완료 — 벽 타일 마감 (10-16, 1장)', '자재 반입 (10-16, 1장)'], 'REPORT_NO_DUP_LINES ' + JSON.stringify(r));
    const same = await page.evaluate(n => { const a = JSON.stringify(hjReportDraft(n).works); return a === JSON.stringify(hjReportDraft(n).works); }, P);
    assert.equal(same, true);
    assert.deepEqual(errors, []);
  });

  console.log(`phototags-v454: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL phototags-v454', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 500))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
