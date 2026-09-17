/* warranty-sign.e2e.js — ⑨ 하자보증서 확인자 전자서명(앱 서명판) 회귀
   결정(2026-09-17 대표): 현장은 서명판, 영구 보관. 전자계약 링크는 서버가 보증서 양식을 알아야 해서 다음 단계.
   여기서 보는 것: [✍ 확인자 서명 받기]가 하자보증서 화면에만 직접 배선되어 있고, 빈 성명·빈 서명은 거부하며,
   서명하면 p.warrantySigs 에 PNG(480×135)로 영구 보관되고, 서명 든 문서에 구분·소속·성명·서명 이미지가 들어가며,
   서명 없는 문서는 예전 그대로 빈칸, 이야기에 서명 이벤트, 직렬화 왕복 보존. 전화번호는 받지 않는다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });
  const N = '가상서명현장';
  const seed = () => page.evaluate(({ N, PNG }) => { try { closeModal(true); } catch (e) {}
    state.projects = [{ name: N, stage: 4, received: 0, doneAt: '2026-09-01', phases: ['도배'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객' }, archived: false }];
    state.files = [{ id: 's1', name: '가상_s1.png', prefix: '', kind: 'photo', ext: 'png', size: 10, project: N, when: new Date('2026-09-01T09:00:00'), thumb: 'data:image/png;base64,' + PNG, _phase: '시공 전' }];
    state.quotes = []; state.activeProject = N; state.dirty = false; window.__wrPick = null; }, { N, PNG });
  const clickMake = () => page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('보증서 만들기')).click(); });
  const waitDoc = () => page.waitForFunction(() => !!document.querySelector('#modalRoot #hjDocPdf'), null, { timeout: 8000 });
  // 서명판에 실제로 선을 긋는다(pointer 이벤트) — 빈 서명판과 구별되어야 한다
  const draw = async () => { const box = await page.locator('#wsPad').boundingBox();
    await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 40, { steps: 6 }); await page.mouse.move(box.x + 200, box.y + 80, { steps: 6 }); await page.mouse.up(); };

  await test('[✍ 확인자 서명 받기]는 하자보증서 화면에만 있고 직접 배선되어 있다 · 거래명세서에는 없다', async () => {
    await seed();
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['s1'], after: [] }; }, N); await clickMake(); await waitDoc();
    const r = await page.evaluate(() => { const b = document.querySelector('#modalRoot #hjDocSign'); return { has: !!b, wired: !!b && typeof b.onclick === 'function' }; });
    assert(r.has && r.wired, '서명 버튼이 직접 배선되어야 한다(모달은 위임 밖): ' + JSON.stringify(r));
    await page.evaluate(n => { closeModal(true); state.files.push({ id: 'e9', kind: 'estimate', project: n, name: '견적', est: { amount: 100, supply: 100, vat: 10, date: '2026-05-10' }, when: new Date('2026-05-10') }); settleDocs(n); }, N);
    await page.evaluate(() => document.querySelector('#modalRoot .sdCard[data-k="statement"]').click()); await waitDoc();
    assert(!(await page.evaluate(() => !!document.querySelector('#modalRoot #hjDocSign'))), '거래명세서에 확인자 서명 버튼이 있으면 안 된다');
  });

  await test('빈 성명·빈 서명판은 저장하지 않는다', async () => {
    await seed();
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['s1'], after: [] }; }, N); await clickMake(); await waitDoc();
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocSign').click());
    await page.waitForSelector('#wsPad');
    const save = () => page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('서명 저장')).click(); });
    await save();
    let r = await page.evaluate(() => ({ sigs: (state.projects[0].warrantySigs || []).length, still: !!document.getElementById('wsPad'), toast: (document.getElementById('toast') || {}).textContent }));
    assert(r.sigs === 0 && r.still && /성명/.test(r.toast), '빈 성명인데 저장했다: ' + JSON.stringify(r));
    await page.fill('#wsName', '가상 소장'); await save();
    r = await page.evaluate(() => ({ sigs: (state.projects[0].warrantySigs || []).length, still: !!document.getElementById('wsPad'), toast: (document.getElementById('toast') || {}).textContent }));
    assert(r.sigs === 0 && r.still && /서명/.test(r.toast), '빈 서명판인데 저장했다: ' + JSON.stringify(r));
  });

  await test('서명하면 PNG 로 영구 보관되고, 서명 든 문서에 구분·소속·성명·서명 이미지가 들어간다 · 서명 없는 문서는 그대로 빈칸', async () => {
    await seed();
    const plain = await page.evaluate(n => warrantyHTML(n), N);
    assert(plain.includes('□ 관리사무소　□ 의뢰인(세대)') && !plain.includes('alt="확인자 서명"'), '서명 없는 문서는 예전 그대로 빈칸');
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['s1'], after: [] }; }, N); await clickMake(); await waitDoc();
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocSign').click()); await page.waitForSelector('#wsPad');
    await page.fill('#wsOrg', '가상아파트 관리사무소'); await page.fill('#wsName', '가상 소장'); await draw();
    await page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('서명 저장')).click(); });
    await page.waitForFunction(() => (document.getElementById('modalTitle') || {}).textContent.includes('(서명)'), null, { timeout: 8000 });
    const r = await page.evaluate(n => { const S = state.projects[0].warrantySigs; const doc = document.querySelector('#modalRoot iframe').getAttribute('srcdoc');
      return { n: S.length, sig: S[0], pngOk: /^data:image\/png;base64,/.test(S[0].png), pngLen: S[0].png.length,
        docHas: { role: doc.includes('☑ 관리사무소　□ 의뢰인(세대)'), org: doc.includes('가상아파트 관리사무소'), name: doc.includes('가상 소장'), img: doc.includes('alt="확인자 서명"'), at: doc.includes('전자서명(앱 서명판)') },
        rt: JSON.parse(JSON.stringify(serializeData())).projects[0].warrantySigs.length, story: hjStoryData(n).filter(e => e.ic === '✍️').map(e => e.t), keys: Object.keys(S[0]) }; }, N);
    assert(r.n === 1 && r.pngOk && r.pngLen > 500 && r.pngLen < 60000, '서명 PNG 보관: ' + JSON.stringify([r.n, r.pngOk, r.pngLen]));
    assert(r.sig.name === '가상 소장' && r.sig.role === 'office' && r.sig.org === '가상아파트 관리사무소' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r.sig.at), '서명 기록: ' + JSON.stringify(r.sig));
    assert(!r.keys.includes('phone') && !r.keys.includes('tel'), '전화번호는 받지 않는다');
    assert(Object.values(r.docHas).every(Boolean), '서명 든 문서 내용: ' + JSON.stringify(r.docHas));
    assert(r.rt === 1, '직렬화 왕복에 서명이 남아야 한다(영구 보관)');
    assert(r.story.length === 1 && r.story[0].includes('관리사무소 가상 소장'), '이야기에 서명 이벤트: ' + JSON.stringify(r.story));
    // 서명 든 화면에서 PDF 를 누르면 이력에 signed 가 남는다
    await page.evaluate(() => { document.querySelector('#modalRoot #hjDocPdf').click(); const f = document.getElementById('hjDocPrintFrame'); if (f && f.contentWindow) f.contentWindow.print = () => {}; });
    await page.waitForFunction(() => (state.projects[0].warrantyLog || []).length === 1, null, { timeout: 5000 });
    const log = await page.evaluate(() => state.projects[0].warrantyLog[0]);
    assert(log.signed === true && log.signer === '가상 소장 / 가상아파트 관리사무소', '이력에 서명자: ' + JSON.stringify(log));
  });

  await test('앱이 만든 PNG 가 아니면 문서에 넣지 않는다(sig 위조 방어) · 의뢰인 구분', async () => {
    await seed();
    const r = await page.evaluate(n => ({ bad: warrantyHTML(n, { sig: { name: 'x', role: 'client', png: 'javascript:alert(1)' } }).includes('alt="확인자 서명"'),
      client: warrantyHTML(n, { sig: { name: '가상 세대주', role: 'client', org: '103동 1204호', png: 'data:image/png;base64,iVBORw0KGgo=' } }) }), N);
    assert(!r.bad, 'data:image/png 이 아닌 값을 서명으로 넣었다');
    assert(r.client.includes('□ 관리사무소　☑ 의뢰인(세대)') && r.client.includes('103동 1204호') && r.client.includes('가상 세대주'), '의뢰인 서명 표기');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length, failed = results.filter(r => !r.ok);
  console.log('\n== warranty-sign: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
