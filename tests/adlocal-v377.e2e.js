/* adlocal-v377.e2e.js — v377 📣 지역 채널(당근·네이버 지도·카카오맵·만물 웹) 원고 + 🏁 최근 완공 현장 홍보 현황 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실게시·실발신 없음(채널 열기 window.open 가로챔).
   · 광고 탭 채널 칩 8개(스레드·인스타·메타·블로그 + 당근·네이버 지도·카카오맵·만물 웹). 지역 채널 원고는 짧은 '소식' — 회사 전화, 가격·보증 기간·고객 정보 없음.
   · 🏁 최근 완공 현장 홍보: 60일 안 완공(doneAt, 보관 제외) 현장마다 다섯 채널(인스타·당근·네이버 지도·카카오맵·만물 웹) 중 올린 곳 ✓ · 남은 칩.
     남은 칩 → 그 현장·채널 원고, [게시 기록에 추가] → 기록에 project → ✓. [＋ 게시 기록]도 현장을 고를 수 있다.
   · 원고 창 사진 수는 '정리·청소'로 분류된 사진을 뺀다. 그리는 것만으로는 저장본이 바뀌지 않는다. 오늘은 2026-11-05(목) 고정. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.open = () => null;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = [];
    const P = (name, x) => Object.assign({ name, stage: 3, received: 0, phases: ['우수관 교체'], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '' } }, x || {});
    state.projects = [
      P('가상아파트A', { doneAt: '2026-11-01' }),
      P('가상아파트B', { doneAt: '2026-10-20', phases: ['욕실 방수'] }),
      P('가상아파트C', { doneAt: '2026-08-01' }),
      P('가상아파트D', { doneAt: '2026-11-02', archived: true }),
      P('가상아파트E', { stage: 2 })
    ];
    state.adPosts = [
      { id: 'a1', ch: 'instagram', date: '2026-11-02', title: 'A 인스타', url: '', memo: '', project: '가상아파트A' },
      { id: 'a2', ch: 'daangn', date: '2026-11-02', title: 'A 당근', url: '', memo: '', project: '가상아파트A' },
      { id: 'a3', ch: 'threads', date: '2026-11-02', title: 'A 스레드', url: '', memo: '', project: '가상아파트A' },
      { id: 'a4', ch: 'naverplace', date: '2026-11-02', title: '현장 없는 기록', url: '', memo: '' }
    ];
    const F = (name, wl) => ({ key: name, name, prefix: '현장사진/', kind: 'photo', project: '가상아파트A', _worklabel: wl, _phase: wl });
    state.files = [F('a.jpg', '작업 전'), F('b.jpg', '작업 후 바닥 정리'), F('c.jpg', '청소 완료')];
    window.__adCh = 'threads'; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 지역 채널 원고 — 당근·네이버 지도·카카오맵·만물 웹: 회사 전화, 소식 형식, 고객 정보·가격·보증 기간 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const f = adProjFacts('가상아파트A');
      const out = {}; ['daangn', 'naverplace', 'kakaomap', 'web'].forEach(c => { const d = adDraftText(c, f); out[c] = d.title + '\n' + d.body; });
      return { out, chips: AD_CH.map(c => c.id) };
    });
    assert(JSON.stringify(r.chips) === JSON.stringify(['threads', 'instagram', 'meta', 'blog', 'daangn', 'naverplace', 'kakaomap', 'web']), '채널: ' + JSON.stringify(r.chips));
    assert(/^.*작업 사례 공유해요\n안녕하세요, 대전 중구 만물인테리어입니다\./.test(r.out.daangn) && /· 한 일: 우수관 교체/.test(r.out.daangn) && /문의 010-2397-8629 \/ 당근 채팅$/.test(r.out.daangn), '당근: ' + r.out.daangn);
    assert(/\[시공 사례\]/.test(r.out.naverplace) && /■ 작업: 우수관 교체/.test(r.out.naverplace) && /만물인테리어 010-2397-8629$/.test(r.out.naverplace), '네이버: ' + r.out.naverplace);
    assert(/카카오톡 채널 문의$/.test(r.out.kakaomap) && /010-2397-8629/.test(r.out.kakaomap), '카카오: ' + r.out.kakaomap);
    assert(/\[만물 웹 사례 재료\]/.test(r.out.web) && /정리·청소 사진 빼기/.test(r.out.web), '웹: ' + r.out.web);
    const all = Object.values(r.out).join('\n');
    assert(!/김가상|9999-8888|최저가|무조건|100%|평생|1위|보증/.test(all), '금지 내용: ' + all);
  });

  await test('② 🏁 완공 현장 홍보 현황 — 60일 안 완공·보관 제외, 다섯 채널 중 올린 곳/남은 곳(현장 없는 기록·스레드는 안 셈)', async () => {
    await seed();
    const r = await page.evaluate(() => hjAdCaseRows().map(x => [x.name, x.posted.join(','), x.missing.join(',')]));
    assert(JSON.stringify(r) === JSON.stringify([
      ['가상아파트A', 'instagram,daangn', 'naverplace,kakaomap,web'],
      ['가상아파트B', '', 'instagram,daangn,naverplace,kakaomap,web']
    ]), '행: ' + JSON.stringify(r));
  });

  await test('③ 광고 탭 — 현황 칸·✓ 표시, 남은 칩 → 그 현장·채널 원고(정리 사진 뺀 수), [게시 기록에 추가] → ✓, 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.tab = 'ads'; render();
      const box = document.querySelector('.adCase');
      const head = box ? box.firstElementChild.textContent : '';
      const rowA = document.querySelector('.adCaseRow[data-proj="가상아파트A"]');
      const done = (rowA.querySelector('.adCaseDone') || {}).textContent;
      const chipsA = [...rowA.querySelectorAll('[data-adcase]')].map(b => b.dataset.adcase);
      const chipN = document.querySelectorAll('[data-adch]').length;
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      rowA.querySelector('[data-adcase="kakaomap"]').click();
      const draft = { h3: document.querySelector('#modalRoot h3').textContent, proj: document.getElementById('adDraftProj').value,
        ch: (document.querySelector('#adDraftChs .blue') || {}).dataset.draftch, body: document.getElementById('adDraftTa').value,
        ph: (document.querySelector('#adDraftPhotos .adPhN') || {}).textContent };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /게시 기록에 추가/.test(b.textContent)).click();
      const last = state.adPosts[state.adPosts.length - 1];
      const after = [...document.querySelectorAll('.adCaseRow[data-proj="가상아파트A"] [data-adcase]')].map(b => b.dataset.adcase);
      const doneAfter = (document.querySelector('.adCaseRow[data-proj="가상아파트A"] .adCaseDone') || {}).textContent;
      state.tab = 'dashboard'; render();
      return { head, done, chipsA, chipN, w, draft, last: { ch: last.ch, project: last.project }, after, doneAfter };
    });
    assert(/🏁 최근 완공 현장 홍보/.test(r.head) && /아직 안 올린 곳 8개/.test(r.head) && r.done === '✓ 인스타·당근' && r.chipN === 8, '현황: ' + JSON.stringify(r));
    assert(JSON.stringify(r.chipsA) === JSON.stringify(['naverplace', 'kakaomap', 'web']) && r.w <= 0, '칩·넘침: ' + JSON.stringify(r));
    assert(r.draft.h3 === '✍️ 홍보 원고 만들기' && r.draft.proj === '가상아파트A' && r.draft.ch === 'kakaomap' && /카카오톡 채널 문의/.test(r.draft.body), '원고 창: ' + JSON.stringify(r.draft));
    assert(/사진 1장/.test(r.draft.ph || '') && /정리 사진 2장 뺌/.test(r.draft.ph || ''), '사진 수: ' + r.draft.ph);
    assert(r.last.ch === 'kakaomap' && r.last.project === '가상아파트A' && JSON.stringify(r.after) === JSON.stringify(['naverplace', 'web']) && r.doneAfter === '✓ 인스타·당근·카카오맵', '기록 후: ' + JSON.stringify(r));
  });

  await test('④ [＋ 게시 기록] 현장 고르기 — 고르면 project, 안 고르면 project 없음 · 그리는 것만으로는 저장본 불변', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      state.tab = 'ads'; render(); hjAdCaseHtml(); hjAdCaseRows();
      adDraftOpen('daangn'); const defProj = document.getElementById('adDraftProj').value; closeModal(true);
      state.tab = 'dashboard'; render();
      const same = snap() === b0;
      const save = (proj) => {
        adPostAdd('web', proj); const sel = document.getElementById('adProj').value;
        document.getElementById('adTitle').value = '가상 웹 사례';
        [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
        const last = state.adPosts[state.adPosts.length - 1]; return { sel, has: 'project' in last, project: last.project };
      };
      const withP = save('가상아파트B'); const noP = save();
      return { same, defProj, withP, noP, rowB: hjAdCaseRows().find(x => x.name === '가상아파트B').posted };
    });
    assert(r.same && r.defProj === '가상아파트A', '불변·기본 현장: ' + JSON.stringify(r));
    assert(r.withP.sel === '가상아파트B' && r.withP.project === '가상아파트B' && r.noP.sel === '' && !r.noP.has && JSON.stringify(r.rowB) === JSON.stringify(['web']), '기록: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== adlocal-v377: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
