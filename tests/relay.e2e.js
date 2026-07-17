/* relay.e2e.js — Apps Script 중계 프론트엔드 회귀 테스트 (Playwright)
   전제: tests/mock-relay.js(8398) + tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398';
const TOKEN = 'test-token-123';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
async function mockState() { const r = await fetch(MOCK + '/__state'); return r.json(); }
async function pollMock(pred, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 10000)) {
    const st = await mockState();
    if (pred(st)) return st;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('pollMock timeout: ' + label + ' — state=' + JSON.stringify(await mockState()).slice(0, 400));
}

(async () => {
  await fetch(MOCK + '/__reset');
  const launchOpts = {};
  if (process.env.PLAYWRIGHT_EXECUTABLE) launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE;
  else if (process.platform !== 'win32') launchOpts.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launchOpts);

  // ── PC 컨텍스트 ──
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errsA = [];
  page.on('pageerror', e => errsA.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await test('1. 설정 모달 — relay URL+토큰 입력 → 연결 테스트 성공', async () => {
    await page.click('#btnGdrive');
    await page.waitForSelector('#ryUrl', { timeout: 5000 });
    await page.fill('#ryUrl', MOCK);
    await page.fill('#ryTok', TOKEN);
    await page.click('#ryTest');
    await page.waitForFunction(() => { const el = document.getElementById('ryOut'); return el && el.textContent.indexOf('✅ 연결됨') >= 0; }, null, { timeout: 8000 });
    const out = await page.$eval('#ryOut', el => el.textContent);
    assert(/revision 0/.test(out), '초기 revision 0 표시: ' + out);
    // 비상용(기존) UI가 details로 그대로 보존되는지
    assert(await page.$('#gdLegacy #gdCid'), '기존 클라이언트ID 입력칸 보존');
    assert(await page.$('#gdLegacy #gdLogin'), '기존 구글 로그인 버튼 보존');
    await page.evaluate(() => closeModal());
  });

  await test('2. markDirty → 3초 디바운스 relay 저장 → revision 1 · 상태 저장 완료', async () => {
    await page.evaluate(() => {
      state.projects.push({ name: '테스트현장', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
      markDirty();
    });
    const st = await pollMock(s => s.revision === 1, 12000, 'revision 1');
    assert(st.saves[0].baseRevision === 0, 'baseRevision 0 전달, got ' + st.saves[0].baseRevision);
    assert(/^pc-/.test(st.saves[0].deviceId), 'deviceId pc- 프리픽스: ' + st.saves[0].deviceId);
    await page.waitForFunction(() => { const el = document.getElementById('relayStat'); return el && el.textContent.indexOf('클라우드 저장 완료') >= 0; }, null, { timeout: 8000 });
    assert(st.data && st.data.app === '현장', 'serializeData 구조(app:현장) 전송');
  });

  await test('2-1. 저장 후 하루 1회 백업 병행', async () => {
    const st = await pollMock(s => s.backups >= 1, 8000, 'backup 1회');
    assert(st.backups === 1, 'backup 1회, got ' + st.backups);
  });

  await test('3. 재수정 저장 → revision 2 (baseRevision=1 전달)', async () => {
    await page.evaluate(() => { state.projects[0].received = 1000; markDirty(); });
    const st = await pollMock(s => s.revision === 2, 12000, 'revision 2');
    assert(st.saves[1].baseRevision === 1, 'baseRevision 1, got ' + st.saves[1].baseRevision);
  });

  await test('4. 충돌 → 모달 3택 → ② 내 기기 데이터로 덮어쓰기 → 재저장 성공', async () => {
    await fetch(MOCK + '/__bump');   // 다른 기기가 저장(서버 rev 3)
    await page.evaluate(() => { state.projects[0].received = 2000; markDirty(); });
    await page.waitForSelector('#ryConflictBox', { timeout: 12000 });
    const n = await page.$$eval('#modalRoot .mfoot button', b => b.length);
    assert(n === 3, '충돌 모달 버튼 3개, got ' + n);
    await page.click('#modalRoot .mfoot button:nth-child(2)');   // ② 내 기기 데이터로 덮어쓰기
    const st = await pollMock(s => s.revision === 4, 12000, 'revision 4(강제 재저장)');
    const last = st.saves[st.saves.length - 1];
    assert(last.baseRevision === 3, '재저장 baseRevision=serverRevision(3), got ' + last.baseRevision);
    assert(st.data.projects[0].received === 2000, '내 기기 자료로 덮어씀');
  });

  await test('5. 오프라인 → 큐 1건·대기 상태 → online 이벤트 → 자동 재전송 → 큐 0', async () => {
    const mockMatcher = u => String(u).indexOf(MOCK) === 0;
    await page.route(mockMatcher, r => r.abort());
    await page.evaluate(() => { state.projects[0].received = 3000; markDirty(); });
    await page.waitForFunction(() => { const el = document.getElementById('relayStat'); return el && /전송 대기/.test(el.textContent); }, null, { timeout: 12000 });
    const qn = await page.evaluate(async () => ((await idbGet('relay_queue')) || []).length);
    assert(qn === 1, '큐 1건, got ' + qn);
    await page.unroute(mockMatcher);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const st = await pollMock(s => s.revision === 5, 12000, 'revision 5(큐 재전송)');
    assert(st.data.projects[0].received === 3000, '최신 데이터로 재전송');
    // flush가 전송 후 큐 정리를 마칠 때까지 폴링(전송 도착≠정리 완료)
    await page.waitForFunction(async () => ((await idbGet('relay_queue')) || []).length === 0, null, { timeout: 8000 });
    await page.waitForFunction(() => { const el = document.getElementById('relayStat'); return el && el.textContent.indexOf('클라우드 저장 완료') >= 0; }, null, { timeout: 8000 });
  });

  await test('6. 토큰 틀림 → 인증키 오류 상태(큐 미증가)', async () => {
    await page.evaluate(() => { __relay.token = 'wrong-token'; __relayAuthToasted = false; });
    await page.evaluate(() => { state.projects[0].received = 4000; markDirty(); });
    await page.waitForFunction(() => { const el = document.getElementById('relayStat'); return el && el.textContent.indexOf('인증키 오류') >= 0; }, null, { timeout: 12000 });
    const qn = await page.evaluate(async () => ((await idbGet('relay_queue')) || []).length);
    assert(qn === 0, '인증 오류는 큐에 안 쌓임, got ' + qn);
    await page.evaluate(t => { __relay.token = t; }, TOKEN);
  });

  await test('7. URL 비움 → 기존처럼 로컬 저장만(오류 없음)', async () => {
    const before = errsA.length;
    await page.evaluate(() => { __relay.url = ''; });
    await page.evaluate(() => { state.projects[0].received = 5000; markDirty(); });
    await page.waitForFunction(() => { const el = document.getElementById('relayStat'); return el && el.textContent.indexOf('기기에만 저장됨') >= 0; }, null, { timeout: 10000 });
    await page.waitForTimeout(1200);
    const saved = await page.evaluate(async () => { const s = await idbGet('appState'); return s && s.projects && s.projects[0].received; });
    assert(saved === 5000, '로컬(idb appState) 저장 유지, got ' + saved);
    assert(errsA.length === before, 'pageerror 없음');
    await page.evaluate(u => { __relay.url = u; }, MOCK);
  });

  await test('8. 사진 업로드(relay) — 압축(수신<원본)·여러 장 순차·mime jpeg', async () => {
    const r = await page.evaluate(async () => {
      function makePhoto(name) {
        return new Promise(res => {
          const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2400;
          const g = cv.getContext('2d');
          for (let i = 0; i < 80; i++) { g.fillStyle = 'rgb(' + ((i * 37) % 255) + ',' + ((i * 91) % 255) + ',' + ((i * 13) % 255) + ')'; g.fillRect((i % 10) * 320, Math.floor(i / 10) * 300, 320, 300); }
          const img = g.getImageData(0, 0, 3200, 2400);
          for (let i = 0; i < img.data.length; i += 41) img.data[i] = Math.floor(Math.random() * 255);
          g.putImageData(img, 0, 0);
          cv.toBlob(b => res(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.98);
        });
      }
      const f1 = await makePhoto('현장A.jpg'), f2 = await makePhoto('현장B.jpg'), f3 = await makePhoto('현장C.jpg');
      const ok = await relayUploadFiles([f1, f2, f3], 'photo');
      return { ok, origSize: f1.size };
    });
    assert(r.ok === 3, '3장 업로드 성공, got ' + r.ok);
    const st = await mockState();
    const ph = st.uploads.filter(u => u.kind === 'photo');
    assert(ph.length === 3, '서버 수신 3건, got ' + ph.length);
    assert(ph.map(u => u.name).join(',') === '현장A.jpg,현장B.jpg,현장C.jpg', '순차·원본 파일명 유지: ' + ph.map(u => u.name).join(','));
    const recvBytes = Math.round(ph[0].b64len * 0.75);
    assert(recvBytes < r.origSize, '압축됨(수신 ' + recvBytes + ' < 원본 ' + r.origSize + ')');
    assert(ph.every(u => u.mimeType === 'image/jpeg'), 'jpeg 변환');
  });

  await test('9. PDF 문서 업로드(kind=doc)', async () => {
    const ok = await page.evaluate(async () => {
      const f = new File(['%PDF-1.4\n' + 'x'.repeat(5000)], '견적서_테스트.pdf', { type: 'application/pdf' });
      const r = await cloudApiUploadFile(f, 'doc');
      return r && r.ok && r.folder;
    });
    assert(ok === '견적서', '문서는 견적서 폴더, got ' + ok);
    const st = await mockState();
    const doc = st.uploads.find(u => u.kind === 'doc');
    assert(doc && doc.mimeType === 'application/pdf' && doc.name === '견적서_테스트.pdf', 'doc 수신 확인');
  });

  await test('10. 큰 파일 차단 문구 (12MB b64 초과)', async () => {
    const msg = await page.evaluate(async () => {
      const big = new Uint8Array(10 * 1024 * 1024);   // 10MB → b64 약 13.9MB
      const f = new File([big], 'big.pdf', { type: 'application/pdf' });
      try { await cloudApiUploadFile(f, 'doc'); return 'no-error'; } catch (e) { return String(e.message || e); }
    });
    assert(/너무 큽니다/.test(msg) && /지원하지 않습니다/.test(msg), '차단 문구: ' + msg);
  });

  await test('11. listFiles 조회(photo 3건)', async () => {
    const n = await page.evaluate(async () => { const r = await cloudApiListFiles('photo'); return r.files.length; });
    assert(n === 3, 'photo 3건, got ' + n);
  });

  await test('11-1. relay 사진 미리보기 — Google 로그인 없이 썸네일 수신·캐시', async () => {
    const r = await page.evaluate(async () => {
      const lr = await cloudApiListFiles('photo');
      const src = lr.files[0];
      const rec = { id: 'relay-preview-test', name: src.name, ext: 'jpg', kind: 'photo', _driveId: src.id, thumb: null, _virtual: true };
      state.files.push(rec);
      __gdToken = null; __roTok = null;
      const img = document.createElement('img'); document.body.appendChild(img);
      await __driveThumbRescue(src.id, img);
      const cached = await idbGet('thumb:' + src.id);
      const out = { thumb: rec.thumb || '', imgSrc: img.src || '', cached: cached || '' };
      img.remove(); state.files = state.files.filter(f => f !== rec);
      return out;
    });
    assert(/^data:image\//.test(r.thumb), '레코드 썸네일 data URL 생성');
    assert(/^data:image\//.test(r.imgSrc), '화면 img에 relay 썸네일 적용');
    assert(r.cached === r.thumb, 'IndexedDB 캐시 저장');
  });

  await test('11-2. 과거 relay 업로드 사진 — Drive ID 가상 항목으로 자동 복구', async () => {
    const r = await page.evaluate(async () => {
      const before = state.files.slice();
      const beforeStored = await idbGet('appState');
      const origDirty = window.markDirty; window.markDirty = function() {};
      state.files = state.files.filter(f => !f._driveId);
      state.files.push(
        { id: 'old-mobile-a', name: '현장A.jpg', ext: 'jpg', kind: 'photo', _driveId: null, _virtual: true, size: 0 },
        { id: 'old-mobile-b', name: '현장B.jpg의 사본', ext: 'jpg', kind: 'photo', _driveId: null, _virtual: true, size: 0 },
        { id: 'v1061-duplicate', name: '현장A.jpg', ext: 'jpg', kind: 'photo', _driveId: 'mockfile_1', _virtual: true, size: 10 }
      );
      const countBefore = state.files.length;
      const n = await relayLoadDriveFiles(true);
      const recovered = state.files.filter(f => /^mockfile_/.test(f._driveId || ''));
      const added = state.files.length - countBefore;
      const duplicateA = state.files.filter(f => f.name === '현장A.jpg').length;
      window.markDirty = origDirty; state.files = before; await idbSet('appState', beforeStored);
      return { n, count: recovered.length, added,
        linked: recovered.filter(f => /^old-mobile-/.test(f.id)).length,
        duplicateA,
        virtual: recovered.every(f => f._virtual && f.kind === 'photo'), hasSize: recovered.every(f => f.size > 0) };
    });
    assert(r.n === 3 && r.count === 3, '과거 업로드 3장 복구, got n=' + r.n + ' count=' + r.count);
    assert(r.linked === 2 && r.added === 0, '기존 2장 연결 + 새 1장 추가 + v106.1 중복 1장 제거');
    assert(r.duplicateA === 1, 'v106.1 임시 복구 항목을 기존 기록으로 병합');
    assert(r.virtual, '복구 항목은 photo 가상 파일');
    assert(r.hasSize, '서버 파일 크기 메타 포함');
  });

  await test('11-3. 빈 사진 카드 — 복구 버튼·재선택 썸네일 캐시', async () => {
    const r = await page.evaluate(async () => {
      const before = state.files.slice();
      const origDirty = window.markDirty, origRender = window.render, origRelayReady = window.relayReady;
      window.markDirty = function () {}; window.render = function () {}; window.relayReady = function () { return false; };
      const rec = { id: 'missing-preview-test', name: '복구사진.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo',
        _driveId: null, thumb: null, _virtual: true, size: 0, when: new Date('2026-07-06T10:00:00') };
      state.files.push(rec);
      const markup = photoImg(rec, 800, rec.id);

      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
      const cx = cv.getContext('2d'); cx.fillStyle = '#1677ff'; cx.fillRect(0, 0, 8, 8);
      const blob = await new Promise(resolve => cv.toBlob(resolve, 'image/jpeg', .8));
      const file = new File([blob], rec.name, { type: 'image/jpeg' });
      const linked = await relinkSelectedPhotos([file], rec.id);
      const cacheKey = 'thumb-local:' + fileKey(rec);
      const cached = await idbGet(cacheKey);
      const out = { markup, linked, thumb: rec.thumb || '', cached: cached || '', virtual: rec._virtual };
      await idbDel(cacheKey);
      state.files = before; window.markDirty = origDirty; window.render = origRender; window.relayReady = origRelayReady;
      return out;
    });
    assert(/data-repair="missing-preview-test"/.test(r.markup) && /사진 연결/.test(r.markup), '빈 카드 복구 버튼 렌더');
    assert(r.linked === 1 && r.virtual === false, '기존 빈 기록에 원본 연결');
    assert(/^data:image\//.test(r.thumb) && r.cached === r.thumb, '재접속용 로컬 썸네일 캐시 저장');
  });

  await test('12. 기존 gd* 함수 전부 유지(typeof function)', async () => {
    const missing = await page.evaluate(() =>
      ['gdGetToken', 'gdSave', 'gdLoad', 'gdBackup', 'gdUploadBlob', 'gdLoadDriveFiles', 'gdBootSync', 'gdUploadPhotos', 'gdEnsureFolder', 'gdShowRestore', 'cloudAutoSave',
       'relayReady', 'relayCall', 'cloudApiHealth', 'cloudApiLoad', 'cloudApiSave', 'cloudApiBackup', 'cloudApiUploadFile', 'cloudApiListFiles', 'cloudApiThumbnail', 'relayGetThumbnail', 'relayLoadDriveFiles', 'cloudFlushQueue', 'relayConflictModal', 'relayBoot']
        .filter(n => typeof window[n] !== 'function'));
    assert(missing.length === 0, '누락: ' + missing.join(','));
  });

  // ── 모바일 컨텍스트(390px) — 서버 최신 배너 → 불러오기 ──
  const ctxM = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const pm = await ctxM.newPage();
  const errsM = [];
  pm.on('pageerror', e => errsM.push(String(e)));
  await pm.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await pm.goto(APP, { waitUntil: 'domcontentloaded' });
  await pm.waitForTimeout(2000);

  await test('13. 별도 기기(모바일 390px) — 서버 최신 배너 → 클릭 시점 재조회(load) 후 적용', async () => {
    await pm.evaluate(async ({ url, token }) => {
      await idbSet('relay_url', url); await idbSet('relay_token', token);
      await relayBoot();
    }, { url: MOCK, token: TOKEN });
    await pm.waitForSelector('#relayNewBar', { timeout: 10000 });
    // (c) 검증: 배너 표시 '후' 서버가 또 갱신(rev6)돼도, 클릭 시 부팅 때 데이터가 아닌 '재조회' 결과를 적용해야 함
    const l0 = (await mockState()).loads;
    await fetch(MOCK + '/__bump');   // 서버 rev 5 → 6
    await pm.click('#relayNewGo');
    await pm.waitForFunction(() => state.projects.some(p => p.name === '테스트현장'), null, { timeout: 8000 });
    const l1 = (await mockState()).loads;
    assert(l1 > l0, '클릭 시 load 재요청 도착(loads ' + l0 + '→' + l1 + ')');
    const rev = await pm.evaluate(() => __relay.rev);
    assert(rev === 6, '클릭 시점 최신 rev6 적용(부팅 클로저 rev5 아님), got ' + rev);
    const rec = await pm.evaluate(() => { const p = state.projects.find(x => x.name === '테스트현장'); return p && p.received; });
    assert(rec === 3000, '서버 최신본 적용, got ' + rec);
    const dev = await pm.evaluate(async () => idbGet('relay_device'));
    assert(/^mobile-/.test(dev), 'deviceId mobile- 프리픽스: ' + dev);
  });

  await test('13-1. 모바일 390px — 재접속 가상 사진의 relay 썸네일 실제 렌더', async () => {
    const r = await pm.evaluate(async () => {
      const lr = await cloudApiListFiles('photo');
      const src = lr.files[0];
      const rec = { id: 'mobile-relay-preview', name: src.name, ext: 'jpg', kind: 'photo', _driveId: src.id, thumb: null, _virtual: true };
      state.files.push(rec); __gdToken = null; __roTok = null;
      const img = document.createElement('img'); img.style.width = '180px'; document.body.appendChild(img);
      await __driveThumbRescue(src.id, img);
      await new Promise(resolve => { if (img.complete) resolve(); else { img.onload = resolve; img.onerror = resolve; } });
      const out = { src: img.src || '', naturalWidth: img.naturalWidth || 0, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
      img.remove(); state.files = state.files.filter(f => f !== rec);
      return out;
    });
    assert(/^data:image\//.test(r.src), '모바일 img에 data URL 적용');
    assert(r.naturalWidth > 0, '모바일 이미지 디코딩 성공(naturalWidth=' + r.naturalWidth + ')');
    assert(r.scrollWidth <= r.viewport + 2, '미리보기 후 가로 넘침 없음');
  });

  await test('14. 390px 설정 모달 레이아웃(가로 넘침 없음)', async () => {
    await pm.evaluate(() => openGdriveSetup());
    await pm.waitForSelector('#ryUrl', { timeout: 5000 });
    const m = await pm.evaluate(() => {
      const el = document.querySelector('#modalRoot .modal');
      return { mw: el ? Math.round(el.getBoundingClientRect().width) : 0, iw: window.innerWidth, sw: document.documentElement.scrollWidth };
    });
    assert(m.mw > 0 && m.mw <= m.iw, '모달 폭 ' + m.mw + ' ≤ 화면 ' + m.iw);
    assert(m.sw <= m.iw + 2, '문서 가로 스크롤 없음(sw=' + m.sw + ')');
    assert(await pm.$('#gdLegacy'), '비상용 details 렌더');
    await pm.evaluate(() => closeModal());
  });

  await test('15. 430px 설정 모달 레이아웃', async () => {
    await pm.setViewportSize({ width: 430, height: 932 });
    await pm.evaluate(() => openGdriveSetup());
    await pm.waitForSelector('#ryUrl', { timeout: 5000 });
    const m = await pm.evaluate(() => {
      const el = document.querySelector('#modalRoot .modal');
      return { mw: el ? Math.round(el.getBoundingClientRect().width) : 0, iw: window.innerWidth, sw: document.documentElement.scrollWidth };
    });
    assert(m.mw > 0 && m.mw <= m.iw, '모달 폭 ' + m.mw + ' ≤ 화면 ' + m.iw);
    assert(m.sw <= m.iw + 2, '문서 가로 스크롤 없음(sw=' + m.sw + ')');
    await pm.evaluate(() => closeModal());
  });

  // ── 재검증 추가분(가디언 이슈 A~I) — PC 컨텍스트에서 계속 ──
  await test('17.(A) 스냅샷 실패 시 서버 자료 적용 중단(로컬 보존)', async () => {
    const r = await page.evaluate(async () => {
      window.__origSnap = window.hjSnapshot;
      window.hjSnapshot = async function () { return false; };   // 스냅샷 실패 모의
      const before = state.projects[0].received;
      const ok = await relayLoadApply(true);
      window.hjSnapshot = window.__origSnap;
      return { ok, same: state.projects[0].received === before, before };
    });
    assert(r.ok === false, '적용 중단(false 반환)');
    assert(r.same, '로컬 데이터 무변경(received=' + r.before + ' 유지)');
  });

  await test('18.(B) flush 도중 push된 큐 항목 생존(통째 덮어쓰기 아님)', async () => {
    const names = await page.evaluate(async () => {
      await relayQueueSet([]);
      await relayQueuePush('upload', { name: 'first.jpg', mimeType: 'image/jpeg', kind: 'photo', dataB64: 'aGVsbG8=' });
      const orig = window.relayCall; let pushed = false;
      window.relayCall = async function (a, p) {   // 전송 도중(첫 항목 처리 중) 새 항목이 push되는 상황 모의
        if (!pushed) { pushed = true; await relayQueuePush('upload', { name: 'mid.jpg', mimeType: 'image/jpeg', kind: 'photo', dataB64: 'aGVsbG8=' }); }
        return orig(a, p);
      };
      await cloudFlushQueue(true);
      window.relayCall = orig;
      const q = await relayQueueGet();
      const names = q.map(it => it.payload && it.payload.name);
      await cloudFlushQueue(true);   // 정리: 남은 항목 전송
      return names;
    });
    assert(names.length === 1 && names[0] === 'mid.jpg', 'flush 중 push된 mid.jpg 생존(first.jpg는 전송·제거), got [' + names.join(',') + ']');
    const qn = await page.evaluate(async () => ((await idbGet('relay_queue')) || []).length);
    assert(qn === 0, '정리 후 큐 0, got ' + qn);
  });

  await test('19.(C+A) 충돌 ③ — 내 자료 스냅샷 성공 확인 후 서버 자료 적용', async () => {
    // 서버 rev6(모바일 테스트의 bump) vs PC rev5 → 충돌
    await page.evaluate(() => { state.projects[0].received = 7777; markDirty(); });
    await page.waitForSelector('#ryConflictBox', { timeout: 12000 });
    const label3 = await page.$eval('#modalRoot .mfoot button:nth-child(3)', b => b.textContent);
    assert(/안전판|스냅샷/.test(label3), '③ 라벨이 로컬 백업(스냅샷)임을 명시: ' + label3);
    await page.click('#modalRoot .mfoot button:nth-child(3)');
    await page.waitForFunction(() => __relay.rev === 6, null, { timeout: 12000 });
    const rec = await page.evaluate(() => state.projects[0].received);
    assert(rec === 3000, '서버 자료 적용(7777→3000), got ' + rec);
    const labels = await page.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(s => s.label));
    assert(labels.indexOf('충돌-내자료 백업') >= 0, '스냅샷 "충돌-내자료 백업" 생성: ' + labels.join(','));
  });

  await test('20.(G) relay 업로드 성공 fileId를 레거시처럼 _driveId로 주입', async () => {
    const inj = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 150; cv.getContext('2d').fillRect(0, 0, 200, 150);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      const f = new File([blob], 'inj.jpg', { type: 'image/jpeg' });
      const target = { name: 'inj.jpg' };
      await relayUploadFiles([f], 'photo', [target]);
      return target._driveId || '';
    });
    assert(/^mockfile_/.test(inj), '_driveId 주입됨: ' + inj);
    await pollMock(s => s.revision === 7, 12000, '주입 markDirty 자동저장(rev7)');   // 이후 테스트와 경합 방지
  });

  await test('21.(E) 첫연결 "기기 자료 올리기" — 서버 백업 실패 시 확인 모달(취소 기본)', async () => {
    await page.evaluate(() => { window.__origBk = window.cloudApiBackup; window.cloudApiBackup = async function () { return { ok: false, error: 'server-error' }; }; });
    const revBefore = (await mockState()).revision;
    await page.evaluate(async () => { await relayFirstConnectFlow({ ok: true, dataFileExists: true, revision: 999 }); });
    await page.waitForSelector('#modalRoot .modal', { timeout: 5000 });
    await page.click('#modalRoot .mfoot button:nth-child(2)');   // 이 기기 자료를 서버에 올리기
    await page.waitForFunction(() => { const h3 = document.querySelector('#modalRoot .modal h3'); return h3 && h3.textContent.indexOf('백업 실패') >= 0; }, null, { timeout: 8000 });
    const b1 = await page.$eval('#modalRoot .mfoot button:nth-child(1)', b => b.textContent);
    assert(/취소/.test(b1), '취소가 첫 버튼(기본): ' + b1);
    await page.click('#modalRoot .mfoot button:nth-child(1)');   // 취소
    await new Promise(r => setTimeout(r, 1500));
    const revAfter = (await mockState()).revision;
    assert(revAfter === revBefore, '취소 시 서버 무변경(rev ' + revBefore + '→' + revAfter + ')');
    await page.evaluate(() => { window.cloudApiBackup = window.__origBk; });
  });

  await test('22.(F) 업로드 대기열 15건 상한 + push 거부', async () => {
    const cap = await page.evaluate(async () => {
      await relayQueueSet([]);
      let lastRet = true;
      for (let i = 0; i < 17; i++) lastRet = await relayQueuePush('upload', { name: 'q' + i + '.jpg', mimeType: 'image/jpeg', kind: 'photo', dataB64: 'aGk=' });
      const q = await relayQueueGet();
      const n = q.filter(it => it.action === 'upload').length;
      await relayQueueSet([]);   // 정리
      return { n, lastRet };
    });
    assert(cap.n === 15, '큐 상한 15건, got ' + cap.n);
    assert(cap.lastRet === false, '초과 push는 false 반환');
    assert(await page.evaluate(() => { openGdriveSetup(); const b = !!document.getElementById('ryClearFail'); closeModal(); return b; }), '설정 모달 [실패 항목 비우기] 버튼 존재');
  });

  await test('23.(H) revision 누락 응답에도 rev 유지(리셋 금지)', async () => {
    const rev = await page.evaluate(async () => {
      const orig = window.relayCall;
      __relay.rev = 42;
      window.relayCall = async function (a, p) {   // revision 필드가 빠진 load 응답 모의
        if (a === 'load') return { ok: true, exists: true, data: serializeData(), modifiedAt: new Date().toISOString() };
        return orig(a, p);
      };
      await relayLoadApply(true);
      window.relayCall = orig;
      const r = __relay.rev;
      __relay.rev = 7; await idbSet('relay_rev', 7);   // 실제 서버 rev로 원복
      return r;
    });
    assert(rev === 42, 'rev 42 유지(0 리셋 아님), got ' + rev);
  });

  await test('24. pageerror 0 (PC·모바일 컨텍스트)', async () => {
    assert(errsA.length === 0, 'PC pageerror: ' + errsA.join(' | '));
    assert(errsM.length === 0, '모바일 pageerror: ' + errsM.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok);
  console.log('\n===== 결과: ' + (results.length - fail.length) + '/' + results.length + ' PASS =====');
  fail.forEach(f => console.log('FAILED: ' + f.name + '\n' + f.err));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('러너 오류:', e); process.exit(2); });
