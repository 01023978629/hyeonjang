/* settings-safety.e2e.js — 설정 두 결함(v331 2차 발굴) (Playwright)

   A. 🧪 데모 데이터로 둘러보기
      예전: 사이드바 버튼이 묻지도 않고 실제 현장·파일을 데모로 바꿨고, 그 화면에서 사진 한 장을 올리면(ingestFile 이
      데모를 조용히 풀었다) 가상 현장이 이 기기·서버 자료를 덮었다. 새로고침해도 실제 현장이 돌아오지 않았다.
      ① 실제 자료가 있으면 먼저 묻는다 — [취소]면 아무것도 안 바뀐다
      ② 들어가기 전에 안전판('데모 보기 전')을 찍고, 안전판이 실패하면 데모를 열지 않는다
      ③ 데모 중: 파일을 받지 않고(데모가 풀리지 않는다), 안전판·유상 저장·서버 대기열·백업 파일이 돌지 않는다
      ④ 데모 표시 띠 + [데모 끝내기] → 내 자료가 그대로 돌아온다(데모 중 사진을 올리려 했어도)
      ⑤ 빈 기기의 첫 안내(loadDemoPrompt)는 묻지 않고 열리고, 없는 기능('설정에서 지우고')을 약속하지 않는다
      ⑩ 폴더를 연결한 PC 에서 데모 중 [🔄 재스캔]·[폴더 연결]·파일 고르기는 입구에서 멈춘다 — 예전에는 파일을 하나도
         못 읽은 채 _현장.json 을 불러와 데모를 풀고, 폴더에 없는 것으로 보인 저장 색인(현장·공정)을 지워 이 기기에 저장했다.
         읽는 도중 데모에 들어가도 반쪽 결과로 색인을 정리·복원하지 않는다. 폴더를 연결한 기기는 끝낼 때 다시 연결한다고 말한다.
   B. AI 두뇌 선택
      예전: 🦙 Llama 를 골라 저장해도 새로고침하면 선택이 사라지고, OpenAI 키가 있으면 쓴 만큼 과금되는 ChatGPT 로 불렸다.
      ⑥ 'llama' 선택이 새로고침 뒤에도 남고 Llama 로 불린다(ChatGPT 요청 0)
      ⑦ Llama 가 실패해도·Gemini 를 골라 두었어도 ChatGPT 로 몰래 넘어가지 않는다(aiAsk·aiFC 둘 다)
      ⑧ Llama 설정이 아직 안 올라왔을 때 부른 요청도 기본 순서(ChatGPT)로 새지 않는다
      ⑨ ChatGPT 를 고른 사람·아무것도 고르지 않은 사람은 예전처럼 ChatGPT 를 쓴다(기존 동작 보존)

   전제: tests/static-server.js(8299) 실행 중. 키는 자기서술형 가짜값만 쓴다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;
const FAKE_OPENAI = 'sk-TEST-FAKE-OPENAI-KEY';
const LLAMA_URL = 'https://llama.test.invalid/v1/chat/completions';

async function boot(page, navigate = true) {
  if (navigate) await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone && typeof window.loadDemo === 'function');
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]));
  // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다
  await page.evaluate(() => { for (const n of ['taxCalendarEnsure', 'coworkSchedEnsure', 'backupBootCheck', 'kakaoCheckNew', 'aiOpsBootCheck', 'aiQueueSanitize']) if (typeof window[n] === 'function') window[n] = () => 0; });
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];

  /* ───────── A. 데모 ───────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://**/*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
    await boot(page);

    // 실제 자료 시드 → 이 기기에 저장
    const seeded = await page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); __idbSaveTimer = null; state._demo = false; __tabStale = false;
      state.projects = [{ name: '실제 현장 TEST', stage: 2, received: 1000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 } }];
      state.quotes = [{ id: 'q-real-1', project: '실제 현장 TEST', title: '실제 견적', total: 5000000, items: [] }];
      state.payLog = [{ id: 'pl-real-1', project: '실제 현장 TEST', amount: 1000000, date: '2026-09-01' }];
      state.files = []; state.dirty = false; state.dirHandle = null;
      const ok = await guardedPersistCurrentState();
      window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
      return ok;
    });
    assert(seeded === true, 'A 시드 저장 실패');
    const projNames = () => page.evaluate(() => state.projects.map(p => p.name).join('|'));

    // ① 물어본다 — 취소면 그대로
    const dialogs = [];
    page.once('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await page.click('#btnDemo');
    await page.waitForFunction(() => true);
    for (let i = 0; i < 50 && !dialogs.length; i++) await page.waitForTimeout(20);
    assert(dialogs.length === 1 && /실제 자료/.test(dialogs[0]) && /현장 1곳/.test(dialogs[0]), '① 실제 자료가 있으면 먼저 묻는다: ' + JSON.stringify(dialogs));
    assert(/저장하지 않/.test(dialogs[0]) && /데모 끝내기/.test(dialogs[0]), '① 확인 글이 저장 안 함·빠져나오는 길을 말한다');
    assert((await projNames()) === '실제 현장 TEST' && !(await page.evaluate(() => state._demo)), '① 취소하면 아무것도 안 바뀐다');

    // ② 안전판이 실패하면 열지 않는다
    const snapFail = await page.evaluate(async () => {
      const orig = window.hjSnapshot; window.hjSnapshot = async () => false;
      const oc = window.confirm; window.confirm = () => true;
      let r; try { r = await loadDemo(); } finally { window.hjSnapshot = orig; window.confirm = oc; }
      return { r, demo: !!state._demo, names: state.projects.map(p => p.name).join('|'), toast: window.__toasts[window.__toasts.length - 1] || '' };
    });
    assert(snapFail.r === false && !snapFail.demo && snapFail.names === '실제 현장 TEST' && /안전 스냅샷/.test(snapFail.toast), '② 안전판 실패면 데모를 열지 않는다: ' + JSON.stringify(snapFail));

    // ② 수락 → 안전판 '데모 보기 전' 이 실제 자료로 찍히고 데모가 열린다.
    //    방금 고친 것(800ms 저장 예약이 아직 안 돈 것)도 데모 전에 이 기기에 저장돼야 [데모 끝내기] 뒤에 남는다.
    await page.evaluate(() => { state.projects.push({ name: '방금 추가 TEST', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 } }); markDirty(); });
    page.once('dialog', d => d.accept());
    await page.click('#btnDemo');
    await page.waitForFunction(() => state._demo === true && state.projects.length === 3);
    const snap = await page.evaluate(async () => {
      const s = (await idbGet('hj_snaps')) || [];
      const d = s.filter(x => x.label === '데모 보기 전').pop();
      return d ? (d.data.projects || []).map(p => p.name).join('|') + '#' + (d.data.quotes || []).length : '';
    });
    assert(snap === '실제 현장 TEST|방금 추가 TEST#1', '② 들어가기 전 안전판이 실제 자료로 찍힌다: ' + snap);

    // ④ 데모 표시
    const bar = await page.evaluate(() => {
      const b = document.getElementById('hjDemoBar'), x = document.getElementById('hjDemoExit');
      const r = x && x.getBoundingClientRect();
      return { shown: !!(b && b.offsetParent !== null || (b && getComputedStyle(b).display !== 'none')), text: b ? b.textContent : '', h: r ? Math.round(r.height) : 0, side: (document.getElementById('btnDemo') || {}).textContent || '' };
    });
    assert(bar.shown && /데모 보는 중/.test(bar.text) && /저장되지 않/.test(bar.text), '④ 데모 표시 띠가 뜬다: ' + JSON.stringify(bar));
    assert(bar.h >= 44, '④ [데모 끝내기] 44px: ' + bar.h);
    assert(/데모 끝내기/.test(bar.side), '④ 사이드바 버튼이 [데모 끝내기]로 바뀐다: ' + bar.side);

    // ③ 데모 중에는 아무 데도 쓰지 않는다
    const inDemo = await page.evaluate(async () => {
      const out = {};
      const snapsBefore = ((await idbGet('hj_snaps')) || []).length;
      // 사진을 올려 본다 — 예전에는 여기서 데모가 풀리고 다음 markDirty 가 데모를 저장했다
      const f = new File([new Uint8Array([1, 2, 3, 4])], 'real-photo.jpg', { type: 'image/jpeg' });
      try { await ingestFile(f); out.ingest = 'accepted'; } catch (e) { out.ingest = 'refused'; }
      out.demoAfterIngest = !!state._demo;
      out.filesAfterIngest = state.files.some(x => x.name === 'real-photo.jpg');
      markDirty();
      out.forcedSnap = await hjSnapshot('데모 중 강제', true, true);
      out.snapsSame = ((await idbGet('hj_snaps')) || []).length === snapsBefore;
      try { await durableLocalMutation({ snapshotLabel: 't', mutateDraft: d => d }); out.durable = 'ran'; } catch (e) { out.durable = String(e.message || e); }
      // 서버 대기열 — 보내는 순간 serializeData() 로 채워지는 save 가 데모를 싣고 나가면 안 된다
      const calls = []; const oCall = window.relayCall, oQ = window.relayQueueReadStrict, oUrl = __relay.url, oTok = __relay.token;
      window.relayCall = async (a, b) => { calls.push(a); return { ok: true, revision: 1 }; };
      window.relayQueueReadStrict = async () => [{ action: 'save', ts: Date.now() }];
      __relay.url = 'https://relay.test.invalid/exec'; __relay.token = 'TEST-FAKE-TOKEN';
      try { await cloudFlushQueue(true); await relaySaveNow(true); } catch (e) {}
      window.relayCall = oCall; window.relayQueueReadStrict = oQ; __relay.url = oUrl; __relay.token = oTok;
      out.relayCalls = calls.length;
      // 백업 파일로 내보내기도 막는다(나중에 불러오면 실제 자료를 덮는다)
      const oBlob = URL.createObjectURL; let blobs = 0; URL.createObjectURL = (...a) => { blobs++; return oBlob.apply(URL, a); };
      try { exportData(); } catch (e) {}
      URL.createObjectURL = oBlob; out.exportBlobs = blobs;
      // 폴더(💾 저장·일괄 작업 체크포인트)·구글드라이브(자동 저장·날짜별 백업)에도 쓰지 않는다
      const folderCalls = []; const fakeDir = { name: '만물 TEST', getFileHandle: async (n) => { folderCalls.push(n); throw new Error('stop'); }, getDirectoryHandle: async (n) => { folderCalls.push(n); throw new Error('stop'); } };
      const oDir = state.dirHandle; state.dirHandle = fakeDir;
      try { await saveProject(true); } catch (e) {} try { await saveProject(false); } catch (e) {} try { await makeCheckpoint('t'); } catch (e) {}
      state.dirHandle = oDir; out.folderCalls = folderCalls.length;
      const oFetch = window.fetch; let gd = 0; window.fetch = async (...a) => { gd++; throw new Error('stop'); };
      const oGdTok = __gdToken, oExp = __gdTokenExp, oFold = __gdFolderId, oCfg = __gdCfg, oFile = __gdFileId;
      __gdToken = 'TEST-FAKE-GD-TOKEN'; __gdTokenExp = Date.now() + 3600000; __gdFolderId = 'TEST-FOLDER'; __gdCfg = { clientId: 'TEST-CLIENT' }; __gdFileId = 'TEST-FILE';
      try { await idbSet('gd_lastbackup', ''); await gdBackup(); } catch (e) {} try { await gdSave(true); } catch (e) {}
      window.fetch = oFetch; __gdToken = oGdTok; __gdTokenExp = oExp; __gdFolderId = oFold; __gdCfg = oCfg; __gdFileId = oFile; out.gdFetch = gd;
      return out;
    });
    assert(inDemo.ingest === 'refused' && inDemo.demoAfterIngest && !inDemo.filesAfterIngest, '③ 데모 중에는 파일을 받지 않고 데모가 풀리지 않는다: ' + JSON.stringify(inDemo));
    assert(inDemo.forcedSnap === false && inDemo.snapsSame, '③ 데모 화면을 안전판으로 찍지 않는다: ' + JSON.stringify(inDemo));
    assert(/demo/.test(inDemo.durable), '③ 유상 저장(durableLocalMutation)이 돌지 않는다: ' + inDemo.durable);
    assert(inDemo.relayCalls === 0, '③ 서버 대기열·저장이 데모를 보내지 않는다: ' + inDemo.relayCalls);
    assert(inDemo.exportBlobs === 0, '③ 데모 자료를 백업 파일로 내보내지 않는다');
    assert(inDemo.folderCalls === 0, '③ 연결 폴더(_현장.json·_백업)에 쓰지 않는다: ' + inDemo.folderCalls);
    assert(inDemo.gdFetch === 0, '③ 구글드라이브 저장·백업을 보내지 않는다: ' + inDemo.gdFetch);
    await page.waitForTimeout(1200); // 부정 증명: 800ms 디바운스 저장이 돌 시간을 준다

    // ④ [데모 끝내기] → 내 자료
    // 사이드바 버튼도 데모 중에는 [데모 끝내기]다(띠의 버튼은 ⑤에서 누른다)
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#btnDemo')]);
    await boot(page, false);
    await page.waitForFunction(() => Array.isArray(state.projects) && state.projects.length > 0);
    const back = await page.evaluate(() => ({ names: state.projects.map(p => p.name).join('|'), q: (state.quotes || []).map(q => q.id).join('|'), pl: (state.payLog || []).length, files: state.files.map(f => f.name).join('|'), demo: !!state._demo, bar: !!document.getElementById('hjDemoBar') }));
    assert(back.names === '실제 현장 TEST|방금 추가 TEST' && back.q === 'q-real-1' && back.pl === 1 && !back.demo && !back.bar, '④ 데모를 끝내면 내 자료가 그대로 돌아온다: ' + JSON.stringify(back));
    assert(!/real-photo|demo/.test(back.files), '④ 데모 중 올리려던 파일·데모 파일이 남지 않는다: ' + back.files);
    await ctx.close();
  }

  /* ───────── A⑤. 빈 기기의 첫 안내 ───────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://**/*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
    await boot(page);
    const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await page.evaluate(() => { state.projects = []; state.files = []; state.quotes = []; state.payLog = []; state.notes = []; state.schedule = []; loadDemoPrompt(); });
    const txt = await page.evaluate(() => document.getElementById('modalRoot').textContent);
    assert(!/설정에서 지우고/.test(txt) && /저장되지 않/.test(txt) && /데모 끝내기/.test(txt), '⑤ 첫 안내가 실제 빠져나오는 길을 말한다: ' + txt.slice(0, 200));
    await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot button')].find(x => x.textContent.trim() === '예시 넣기'); b.click(); });
    await page.waitForFunction(() => state._demo === true && state.projects.length === 3);
    assert(dialogs.length === 0, '⑤ 빈 기기는 묻지 않는다: ' + JSON.stringify(dialogs));
    assert(await page.evaluate(() => !!document.getElementById('hjDemoBar')), '⑤ 첫 안내로 연 데모에도 표시 띠가 뜬다');
    const ov = await page.evaluate(() => { const b = document.getElementById('hjDemoBar'); return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, bar: b.scrollWidth - b.clientWidth }; });
    assert(ov.doc <= 0 && ov.bar <= 0, '⑤ 폰 폭에서 데모 띠가 넘치지 않는다: ' + JSON.stringify(ov));
    // 띠의 [데모 끝내기] → 빈 기기로 돌아간다(데모는 어디에도 저장되지 않았다)
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#hjDemoExit')]);
    await boot(page, false);
    const after = await page.evaluate(() => ({ n: state.projects.length, f: state.files.length, demo: !!state._demo, bar: !!document.getElementById('hjDemoBar') }));
    assert(after.n === 0 && after.f === 0 && !after.demo && !after.bar, '⑤ 띠의 [데모 끝내기] → 빈 기기 그대로: ' + JSON.stringify(after));
    // 데모 중에 실제 자료가 들어오면(불러오기·서버 받기 = applyData) 데모 표시가 사라진다 — 표시가 남으면 실제 자료를 데모로 착각한다
    await page.evaluate(() => loadDemo());
    await page.waitForFunction(() => state._demo === true && !!document.getElementById('hjDemoBar'));
    const applied = await page.evaluate(() => { applyData({ version: 1, files: [], projects: [{ name: '불러온 현장 TEST' }] }); return { demo: !!state._demo, bar: !!document.getElementById('hjDemoBar'), side: document.getElementById('btnDemo').textContent, names: state.projects.map(p => p.name).join('|') }; });
    assert(!applied.demo && !applied.bar && /둘러보기/.test(applied.side) && applied.names === '불러온 현장 TEST', '⑤ 실제 자료가 들어오면 데모 표시가 사라진다: ' + JSON.stringify(applied));
    await ctx.close();
  }

  /* ───────── A⑩. 폴더 연결 PC 의 데모 중 재스캔 ───────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://**/*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
    await boot(page);
    // 가짜 폴더: 사진 a.jpg + _현장.json(그 사진이 '실제현장 TEST' 에 배정된 저장본). 읽힌 이름·열린 파일을 센다.
    const seed = await page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); __idbSaveTimer = null; state._demo = false; __tabStale = false;
      window.__fs = { entries: 0, json: 0, midDemo: false };
      const jpg = () => new File([new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg', lastModified: 1767225600000 });
      const photo = { kind: 'file', name: 'a.jpg', getFile: async () => jpg() };
      window.__fakeDir = {
        kind: 'directory', name: '만물 TEST',
        entries: async function* () { window.__fs.entries++; if (window.__fs.midDemo) state._demo = true; yield ['a.jpg', photo]; },
        getFileHandle: async (n) => { if (n !== '_현장.json') throw new DOMException('nf', 'NotFoundError'); window.__fs.json++; return { getFile: async () => new File([JSON.stringify(window.__saved)], '_현장.json') }; },
        getDirectoryHandle: async () => { throw new DOMException('nf', 'NotFoundError'); },
        queryPermission: async () => 'granted', requestPermission: async () => 'granted'
      };
      state.projects = [{ name: '실제현장 TEST', stage: 2, received: 0, phases: ['타일'], cost: { material: 0, labor: 0, outsource: 0 } }];
      state.files = [];
      const f = await ingestFile(jpg(), photo, '');
      f.project = '실제현장 TEST'; f._phase = '타일';
      state.dirty = false; state.dirHandle = window.__fakeDir;
      window.__saved = JSON.parse(JSON.stringify(serializeData()));
      window.__saved.savedAt = new Date().toISOString();
      const ok = await guardedPersistCurrentState();
      window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
      return { ok, files: state.files.map(x => x.name + ':' + x.project).join('|') };
    });
    assert(seed.ok === true && seed.files === 'a.jpg:실제현장 TEST', 'A⑩ 시드 실패: ' + JSON.stringify(seed));
    // 폴더를 연결한 기기에서는 확인 글이 '폴더는 다시 연결해야 한다'고 말한다
    const dlg = [];
    page.once('dialog', d => { dlg.push(d.message()); d.accept(); });
    await page.click('#btnDemo');
    await page.waitForFunction(() => state._demo === true && state.projects.length === 3);
    assert(/폴더/.test(dlg[0] || '') && /다시 연결/.test(dlg[0] || ''), 'A⑩ 폴더를 연결한 기기는 끝낼 때 다시 연결해야 한다고 묻는 글에 적는다: ' + dlg[0]);
    const barTxt = await page.evaluate(() => (document.getElementById('hjDemoBar') || {}).textContent || '');
    assert(/폴더는 다시 연결/.test(barTxt), 'A⑩ 데모 띠도 폴더 재연결을 말한다: ' + barTxt);
    // 데모 중 [🔄 재스캔]·[폴더 연결]·파일 고르기
    const r = await page.evaluate(async () => {
      let pick = 0; const oPick = window.showDirectoryPicker; window.showDirectoryPicker = async () => { pick++; return window.__fakeDir; };
      const oCE = document.createElement.bind(document); let inputs = 0;
      document.createElement = (t, ...a) => { const el = oCE(t, ...a); if (String(t).toLowerCase() === 'input') { inputs++; el.click = () => {}; } return el; };
      try {
        await scanDir();
        document.getElementById('btnScan').disabled = false; document.getElementById('btnScan').click();
        await document.getElementById('btnMount').onclick();
        pickFilesFallback();
        await new Promise(res => setTimeout(res, 50));
      } finally { window.showDirectoryPicker = oPick; document.createElement = oCE; }
      const st = await idbGet('appState');
      return { demo: !!state._demo, names: state.projects.map(p => p.name).join('|'), entries: window.__fs.entries, json: window.__fs.json, pick, inputs,
        saved: ((st && st.files) || []).map(x => x.name + ':' + x.project).join('|'), toast: window.__toasts.filter(t => /폴더를 읽지 않/.test(t)).length };
    });
    assert(r.entries === 0 && r.json === 0, 'A⑩ 데모 중 재스캔은 폴더를 읽지 않는다: ' + JSON.stringify(r));
    assert(r.demo && /망원동/.test(r.names), 'A⑩ 재스캔이 데모를 풀지 않는다: ' + JSON.stringify(r));
    assert(r.pick === 0, 'A⑩ 데모 중 [폴더 연결]은 폴더 고르기를 열지 않는다: ' + JSON.stringify(r));
    assert(r.inputs === 0, 'A⑩ 데모 중 파일 고르기를 열지 않는다: ' + JSON.stringify(r));
    assert(r.toast >= 1, 'A⑩ 왜 멈췄는지 말한다: ' + JSON.stringify(r));
    assert(r.saved === 'a.jpg:실제현장 TEST', 'A⑩ 이 기기에 저장된 사진 색인이 그대로다: ' + JSON.stringify(r));
    // [데모 끝내기] → 새로 열린 뒤에도 사진 배정이 남아 있다
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#hjDemoExit')]);
    await boot(page, false);
    const back = await page.evaluate(() => ({ files: state.files.map(x => x.name + ':' + x.project + ':' + (x._phase || '')).join('|'), demo: !!state._demo }));
    assert(back.files === 'a.jpg:실제현장 TEST:타일' && !back.demo, 'A⑩ 데모를 끝내면 사진 색인(현장·공정)이 그대로다: ' + JSON.stringify(back));
    // 읽는 도중 데모에 들어간 경우 — 반쪽 결과로 _현장.json 을 불러와 색인을 정리하지 않는다
    // 새로 열린 페이지에는 가짜 폴더가 없다 — 다시 만든다
    const mid2 = await page.evaluate(async () => {
      window.__fs = { entries: 0, json: 0, midDemo: true };
      window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
      const photo = { kind: 'file', name: 'a.jpg', getFile: async () => new File([new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg' }) };
      state.dirHandle = {
        kind: 'directory', name: '만물 TEST',
        entries: async function* () { window.__fs.entries++; state._demo = true; yield ['a.jpg', photo]; },
        getFileHandle: async (n) => { window.__fs.json++; throw new DOMException('nf', 'NotFoundError'); },
        getDirectoryHandle: async () => { throw new DOMException('nf', 'NotFoundError'); }
      };
      await scanDir();
      return { entries: window.__fs.entries, json: window.__fs.json, demo: !!state._demo, stop: window.__toasts.some(t => /폴더 읽기를 멈췄/.test(t)) };
    });
    assert(mid2.entries === 1 && mid2.json === 0 && mid2.demo && mid2.stop, 'A⑩ 읽는 도중 데모에 들어가면 저장본을 불러오지 않고 멈춘다: ' + JSON.stringify(mid2));
    await ctx.close();
  }

  /* ───────── B. AI 두뇌 ───────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', e => errors.push(String(e)));
    const hits = { openai: 0, llama: 0 };
    let llamaStatus = 200;
    await page.route('https://**/*', r => {
      const u = r.request().url();
      if (u.startsWith('https://api.openai.com/')) { hits.openai++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'openai-said' } }] }) }); }
      if (u.startsWith(LLAMA_URL)) { hits.llama++; return r.fulfill({ status: llamaStatus, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'llama-said' } }] }) }); }
      return r.abort();
    });
    await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
    await boot(page);
    // 🦙 설정 → [💾 저장] 과 같은 결과(llamaConfigSave + aiProviderSet('llama')) + OpenAI 키
    await page.evaluate(async ({ k, u }) => {
      await idbSet('openai_key', k); window.__openaiKey = k;
      await llamaConfigSave({ url: u, model: 'llama-3.3-70b-versatile', key: '' });
      aiProviderSet('llama');
    }, { k: FAKE_OPENAI, u: LLAMA_URL });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await boot(page, false);
    await page.waitForFunction(() => !!window.__openaiKey && typeof llamaReady === 'function' && llamaReady());
    // ⑥ 새로고침 뒤에도 선택이 남는다
    const st = await page.evaluate(() => ({ prov: window.__aiProvider, name: aiProviderName(), ls: localStorage.getItem('hj_ai_provider'), gem: !!window.__geminiKey }));
    assert(st.prov === 'llama' && /^Llama/.test(st.name) && !st.gem, '⑥ 🦙 선택이 새로고침 뒤에도 남는다: ' + JSON.stringify(st));
    const ask = () => page.evaluate(async () => { try { return await aiAsk('hi'); } catch (e) { return 'ERR:' + (e.message || e); } });
    const r1 = await ask();
    assert(r1 === 'llama-said' && hits.openai === 0, '⑥ Llama 로 불린다(ChatGPT 0): ' + r1 + ' ' + JSON.stringify(hits));

    // ⑧ Llama 설정이 아직 안 올라온 순간의 요청도 ChatGPT 로 새지 않는다
    await page.evaluate(() => { window.__llamaConfig = null; });
    const r8 = await ask();
    assert(r8 === 'llama-said' && hits.openai === 0, '⑧ 설정을 먼저 읽고 Llama 로 부른다: ' + r8 + ' ' + JSON.stringify(hits));
    await page.evaluate(() => { window.__llamaConfig = null; });
    const f8 = await page.evaluate(async () => { try { await aiFC([{ role: 'user', parts: [{ text: 'hi' }] }]); return 'ok'; } catch (e) { return 'ERR:' + (e.message || e); } });
    assert(hits.openai === 0 && hits.llama >= 3, '⑧ aiFC 도 설정을 먼저 읽고 Llama 로 간다(ChatGPT 0): ' + f8 + ' ' + JSON.stringify(hits));

    // ⑦ Llama 가 실패해도 ChatGPT 로 넘어가지 않는다
    llamaStatus = 500;
    const r7 = await ask();
    assert(/^ERR:/.test(r7) && hits.openai === 0, '⑦ Llama 실패 → ChatGPT 로 몰래 넘기지 않는다: ' + r7 + ' ' + JSON.stringify(hits));
    const f7 = await page.evaluate(async () => { try { await aiFC([{ role: 'user', parts: [{ text: 'hi' }] }]); return 'ok'; } catch (e) { return 'ERR:' + (e.message || e); } });
    assert(/^ERR:/.test(f7) && hits.openai === 0, '⑦ aiFC 도 ChatGPT 로 넘기지 않는다: ' + f7 + ' ' + JSON.stringify(hits));
    // ⑦ Llama 설정을 지운 뒤에도(선택은 llama) ChatGPT 로 가지 않는다
    await page.evaluate(async () => { await llamaConfigSave(null); });
    const r7b = await ask();
    assert(r7b === 'ERR:NO_LLAMA_CONFIG' && hits.openai === 0, '⑦ Llama 설정이 없어도 ChatGPT 로 가지 않고, 무엇이 없는지 말한다: ' + r7b);
    const f7b = await page.evaluate(async () => { try { await aiFC([{ role: 'user', parts: [{ text: 'hi' }] }]); return 'ok'; } catch (e) { return 'ERR:' + (e.message || e); } });
    assert(f7b === 'ERR:NO_LLAMA_CONFIG' && hits.openai === 0, '⑦ aiFC 도 Gemini 키가 아니라 Llama 설정이 없다고 말한다: ' + f7b);
    assert((await page.evaluate(() => aiKeyReady())) === false, '⑦ 고른 두뇌(Llama)가 준비 안 됐으면 OpenAI 키가 있어도 준비됨으로 보이지 않는다');
    const nm7 = await page.evaluate(() => aiProviderName());
    assert(!/ChatGPT/.test(nm7) && /Llama/.test(nm7), '⑦ 이름표도 ChatGPT 라고 하지 않고 Llama 설정을 가리킨다: ' + nm7);
    // ⑦ Gemini 를 골라 두었는데 Gemini 키가 없다 → ChatGPT 로 가지 않는다
    await page.evaluate(() => aiProviderSet('gemini'));
    assert((await page.evaluate(() => aiKeyReady())) === false, '⑦ Gemini 선택·Gemini 키 없음 → OpenAI 키만으로 준비됨이라 하지 않는다');
    const r7c = await ask();
    assert(/^ERR:/.test(r7c) && hits.openai === 0, '⑦ Gemini 선택 → ChatGPT 로 가지 않는다: ' + r7c);
    const f7c = await page.evaluate(async () => { try { await aiFC([{ role: 'user', parts: [{ text: 'hi' }] }]); return 'ok'; } catch (e) { return 'ERR:' + (e.message || e); } });
    assert(/^ERR:/.test(f7c) && hits.openai === 0, '⑦ aiFC: Gemini 선택 → ChatGPT 로 가지 않는다: ' + f7c);
    // ⑦ Gemini 를 골라 두었고 Gemini 가 실패한다 → ChatGPT 로 넘기지 않는다
    await page.evaluate(() => { window.__geminiKey = 'TEST-FAKE-GEMINI-KEY'; });
    const r7d = await ask();
    assert(/^ERR:/.test(r7d) && hits.openai === 0, '⑦ Gemini 실패 → ChatGPT 로 몰래 넘기지 않는다: ' + r7d + ' ' + JSON.stringify(hits));
    await page.evaluate(() => { window.__geminiKey = null; });
    // 새로고침 왕복: gemini·openai 도 남는다(목록 한 벌)
    for (const v of ['gemini', 'openai']) {
      await page.evaluate(v => aiProviderSet(v), v);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await boot(page, false);
      await page.waitForFunction(() => !!window.__openaiKey);
      assert((await page.evaluate(() => window.__aiProvider)) === v, '⑥ ' + v + ' 선택도 새로고침 뒤에 남는다');
    }
    // ⑨ ChatGPT 를 고른 사람은 ChatGPT
    assert((await page.evaluate(() => aiKeyReady())) === true, '⑨ ChatGPT 를 고른 사람은 OpenAI 키로 준비됨');
    const r9 = await ask();
    assert(r9 === 'openai-said' && hits.openai === 1, '⑨ ChatGPT 선택은 ChatGPT: ' + r9 + ' ' + JSON.stringify(hits));
    // ⑨ 아무것도 고르지 않은 사람(예전 기본 순서): Gemini 가 없으면 ChatGPT
    await page.evaluate(() => { localStorage.removeItem('hj_ai_provider'); window.__aiProvider = undefined; });
    const r9b = await ask();
    assert(r9b === 'openai-said' && hits.openai === 2, '⑨ 고르지 않았으면 예전 기본 순서: ' + r9b + ' ' + JSON.stringify(hits));
    await ctx.close();
  }

  const real = errors.filter(e => !/aborted|net::|Failed to fetch/i.test(e));
  assert(real.length === 0, 'pageerror 0: ' + real.join(' / '));
  console.log('settings-safety: 전부 통과');
  await browser.close();
  process.exit(0);
})().catch(async e => { console.error('FAIL', e.stack || e.message); try { await browser.close(); } catch (_) {} process.exit(1); });
