/* Saved-file identity: path/name/size is not an ID. Synthetic data only; all external requests are blocked. */
'use strict';
const assert = require('assert');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs'), path = require('path');
const mutant = process.env.HJ_FILE_IDENTITY_MUTATION || '';
const mutations = {
  'ignore-drive': ["if(a&&b&&a!==b)return false;", '/* mutation: different originals may match */'],
  'last-key': ["const matches=hjSavedFileMatches(state.files,data.files,__revert);", "const matches=new Map(state.files.map(f=>[f,{record:data.files.filter(s=>s.key===fileKey(f)).slice(-1)[0],exact:true}]).filter(x=>x[1].record));"],
  'collapse-drive': ["if(s.driveId&&state.files.some(f=>f._driveId===s.driveId&&hjFileIdentityCompatible(f,s)&&!equalSizeScanPhotoPair(f,s)))return;", "if(state.files.some(f=>fileKey(f)===s.key))return;"],
  'ignore-hash': ["if(HJ_FILE_SHA_RE.test(x)&&HJ_FILE_SHA_RE.test(y)&&x!==y)return false;", '/* mutation: verified original hashes ignored */'],
  'skip-exact-priority': ['if(s)remember(f,s);\n  });\n  ordered.forEach', '/* mutation: exact Drive/path reservation removed */\n  });\n  ordered.forEach'],
  'select-key': ["const matches=hjSavedFileMatches(live,src,true);", "const matches=new Map(live.map(f=>[f,{record:src.find(s=>fileKey(s)===fileKey(f))}]).filter(x=>x[1].record));"]
};
let browser, passed = 0, failed = 0, mutationHit = false;
async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', r => r.abort());
  if (mutant) {
    const [from, to] = mutations[mutant] || [];
    assert(from, 'unknown mutation');
    let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert(html.includes(from), 'mutation anchor missing');
    html = html.replace(from, to); mutationHit = true;
    await page.route('http://127.0.0.1:8299/index.html', r => r.fulfill({ body: html, contentType: 'text/html' }));
  }
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayBootDone, __hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    window.__scanFresh = false;
    window.__identitySeed = () => {
      state.projects = ['가상 A아파트', '가상 B아파트'].map(name => ({ name, stage: 0, received: 0, phases: [], cost: {} }));
      state.files = []; state.quotes = []; state.schedule = []; state.notes = []; state.contacts = [];
      const f = (id, drive, project, prefix = '현장사진/') => ({ id, name: 'image.jpg', size: 2000, prefix, ext: 'jpg', kind: 'photo', project,
        _driveId: drive, _driveMimeType: 'image/jpeg', _driveSize: 2000, _phase: project ? '완료' : null, _worklabel: project ? '가상 작업' : null,
        when: new Date('2026-09-28T00:00:00Z'), text: '', ocr: 'na', _file: null, handle: null });
      return f;
    };
    window.__identityBrief = () => state.files.map(f => ({ drive: f._driveId || '', project: f.project || '', unit: f._aptUnit?.unitId || '', phase: f._phase || '', work: f._worklabel || '', prefix: f.prefix, id: f.id }));
  });
  await check('empty-device restore preserves two different Drive originals with the same path/name/size', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트'), f('b', 'TEST_DRIVE_B', '가상 B아파트')];
      const saved = serializeData(); state.files = []; applyData(saved); return __identityBrief();
    });
    assert.equal(r.length, 2, JSON.stringify(r));
    assert.deepEqual(r.map(x => [x.drive, x.project]).sort(), [['TEST_DRIVE_A', '가상 A아파트'], ['TEST_DRIVE_B', '가상 B아파트']]);
  });
  await check('merge matches by Drive identity, not the last colliding key; order does not matter', async () => {
    for (const reverse of [false, true]) {
      const r = await page.evaluate(reverse => {
        const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트'), f('b', 'TEST_DRIVE_B', '가상 B아파트')];
        state.files[0]._aptUnit = { project: '가상 A아파트', unitId: 'TEST_UNIT_A' };
        state.files[1]._aptUnit = { project: '가상 B아파트', unitId: 'TEST_UNIT_B' };
        const saved = serializeData(); if (reverse) saved.files.reverse();
        state.files = [f('local-b', 'TEST_DRIVE_B', null), f('local-a', 'TEST_DRIVE_A', null)];
        applyData(saved); return __identityBrief();
      }, reverse);
      assert.equal(r.length, 2, JSON.stringify(r));
      assert.deepEqual(r.map(x => [x.drive, x.project, x.unit]).sort(), [['TEST_DRIVE_A', '가상 A아파트', 'TEST_UNIT_A'], ['TEST_DRIVE_B', '가상 B아파트', 'TEST_UNIT_B']]);
    }
  });
  await check('same Drive original remains linked after the local path changes', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트')]; const saved = serializeData();
      state.files = [f('moved', 'TEST_DRIVE_A', null, '_정리완료/가상 A아파트/사진/')];
      applyData(saved); return __identityBrief();
    });
    assert.equal(r.length, 1, JSON.stringify(r)); assert.equal(r[0].project, '가상 A아파트'); assert.equal(r[0].work, '가상 작업');
  });
  await check('an earlier raw alias cannot consume a later exact Drive-and-path match', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(), prefix = '_정리완료/가상 B아파트/현장사진/';
      state.files = [f('saved-org', 'TEST_DRIVE_SHARED', '가상 B아파트', prefix)]; const saved = serializeData();
      state.files = [f('raw', 'TEST_DRIVE_SHARED', '가상 A아파트'), f('exact-org', 'TEST_DRIVE_SHARED', null, prefix)];
      applyData(saved); return __identityBrief();
    });
    assert.equal(r.find(x => x.id === 'raw').project, '가상 A아파트', JSON.stringify(r));
    assert.equal(r.find(x => x.id === 'exact-org').project, '가상 B아파트', JSON.stringify(r));
  });
  await check('a different Drive original never inherits project or unit from a matching key', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트')]; const saved = serializeData();
      state.files = [f('new-b', 'TEST_DRIVE_B', '가상 B아파트')]; applyData(saved); return __identityBrief();
    });
    assert.equal(r.length, 2, JSON.stringify(r));
    assert.equal(r.find(x => x.drive === 'TEST_DRIVE_B').project, '가상 B아파트');
  });
  await check('ambiguous path-only photo is not assigned by guess and both saved originals remain available', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트'), f('b', 'TEST_DRIVE_B', '가상 B아파트')]; const saved = serializeData();
      state.files = [f('unknown', null, null)]; applyData(saved); const first = __identityBrief(); applyData(saved); return { first, second: __identityBrief() };
    });
    assert.equal(r.first.find(x => x.id === 'unknown').project, '', JSON.stringify(r));
    assert.equal(r.first.length, 3); assert.equal(r.second.length, 3, 'repeat restore must not multiply records');
    assert.equal(r.first.filter(x => x.drive).length, 2);
  });
  await check('revert uses Drive identity and snapshot unit fields for both colliding originals', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트'), f('b', 'TEST_DRIVE_B', '가상 B아파트')]; const saved = serializeData();
      state.files = [f('b-now', 'TEST_DRIVE_B', '가상 A아파트'), f('a-now', 'TEST_DRIVE_A', '가상 B아파트')];
      applyData(saved, { revert: true }); return __identityBrief();
    });
    assert.deepEqual(r.map(x => [x.drive, x.project]).sort(), [['TEST_DRIVE_A', '가상 A아파트'], ['TEST_DRIVE_B', '가상 B아파트']]);
  });
  await check('selective restore cannot cross two Drive originals with the same key', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', 'TEST_DRIVE_A', '가상 A아파트')]; const saved = serializeData();
      state.files = [f('b', 'TEST_DRIVE_B', '가상 B아파트')]; const n = restoreSelectFiles(saved.files, new Set(['가상 A아파트']));
      return { n, files: __identityBrief() };
    });
    assert.equal(r.n, 0, JSON.stringify(r)); assert.equal(r.files[0].project, '가상 B아파트');
  });
  await check('different verified original hashes remain distinct even if their path and size match', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', null, '가상 A아파트')]; state.files[0]._originalSha256 = 'a'.repeat(64); const saved = serializeData();
      state.files = [f('b', null, '가상 B아파트')]; state.files[0]._originalSha256 = 'b'.repeat(64); applyData(saved); return __identityBrief();
    });
    assert.equal(r.length, 2, JSON.stringify(r)); assert.equal(r.find(x => x.id === 'b').project, '가상 B아파트');
  });
  await check('known unique local key still restores ordinary metadata', async () => {
    const r = await page.evaluate(() => {
      const f = __identitySeed(); state.files = [f('a', null, '가상 A아파트')]; const saved = serializeData();
      state.files = [f('rescanned', null, null)]; applyData(saved); return __identityBrief();
    });
    assert.equal(r.length, 1); assert.equal(r[0].project, '가상 A아파트');
  });
  await check('no page errors', () => assert.deepEqual(errors, []));
  assert(!mutant || mutationHit);
  await browser.close(); browser = null;
  console.log('file-identity: ' + passed + '/' + (passed + failed) + ' PASS');
  process.exitCode = failed ? 1 : 0;
})().catch(async e => { console.error('FAIL file-identity: ' + e.stack); if (browser) await browser.close(); process.exitCode = 1; });
