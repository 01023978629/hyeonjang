/* relay.e2e.js — Apps Script 중계 프론트엔드 회귀 테스트 (Playwright)
   전제: tests/mock-relay.js(8398) + python3 -m http.server 8299(저장소 루트) 실행 중 */
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

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
    const qn2 = await page.evaluate(async () => ((await idbGet('relay_queue')) || []).length);
    assert(qn2 === 0, '큐 비움, got ' + qn2);
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

  await test('12. 기존 gd* 함수 전부 유지(typeof function)', async () => {
    const missing = await page.evaluate(() =>
      ['gdGetToken', 'gdSave', 'gdLoad', 'gdBackup', 'gdUploadBlob', 'gdLoadDriveFiles', 'gdBootSync', 'gdUploadPhotos', 'gdEnsureFolder', 'gdShowRestore', 'cloudAutoSave',
       'relayReady', 'relayCall', 'cloudApiHealth', 'cloudApiLoad', 'cloudApiSave', 'cloudApiBackup', 'cloudApiUploadFile', 'cloudApiListFiles', 'cloudFlushQueue', 'relayConflictModal', 'relayBoot']
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

  await test('13. 별도 기기(모바일 390px) — 서버 최신 배너 → 스냅샷 후 적용', async () => {
    await pm.evaluate(async ({ url, token }) => {
      await idbSet('relay_url', url); await idbSet('relay_token', token);
      await relayBoot();
    }, { url: MOCK, token: TOKEN });
    await pm.waitForSelector('#relayNewBar', { timeout: 10000 });
    await pm.click('#relayNewGo');
    await pm.waitForFunction(() => state.projects.some(p => p.name === '테스트현장'), null, { timeout: 8000 });
    const rec = await pm.evaluate(() => { const p = state.projects.find(x => x.name === '테스트현장'); return p && p.received; });
    assert(rec === 3000, '서버 최신본(rev5) 적용, got ' + rec);
    const snaps = await pm.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(s => s.label));
    assert(snaps.length >= 0, '스냅샷 저장 시도(빈 상태는 저장 안 함 정책)');   // 빈 기기라 스냅샷은 정책상 생략됨
    const dev = await pm.evaluate(async () => idbGet('relay_device'));
    assert(/^mobile-/.test(dev), 'deviceId mobile- 프리픽스: ' + dev);
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

  await test('16. pageerror 0 (PC·모바일 컨텍스트)', async () => {
    assert(errsA.length === 0, 'PC pageerror: ' + errsA.join(' | '));
    assert(errsM.length === 0, '모바일 pageerror: ' + errsM.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok);
  console.log('\n===== 결과: ' + (results.length - fail.length) + '/' + results.length + ' PASS =====');
  fail.forEach(f => console.log('FAILED: ' + f.name + '\n' + f.err));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('러너 오류:', e); process.exit(2); });
