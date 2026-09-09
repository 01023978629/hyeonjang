/* video-files.e2e.js — 현장 동영상 인식 (Playwright)

   2026-09-09 v262 (대표 요청: "현장 사진 웹 동영상도 인식되게"):
     ① 확장자·마임 인식: .MOV·.mp4·"clip.mp4의 사본"·video/quicktime 이 동영상 확장자로 잡히고 분류는 'photo'(사진 묶음)
     ② 파일을 넣으면(ingestFile) 첫 장면 썸네일(data:image/jpeg)이 생기고 글자 인식은 안 한다(ocr 'na')
     ③ 사진 탭 칸에 ▶ 배지가 뜨고, 누르면 크게 보기가 재생기(<video controls>)로 열리며 원본이 연결된다
     ④ 서버 중계(사진 전용)에는 동영상을 보내지 않는다 — 사진만 올리고 동영상 개수를 한 번 안내
     ⑤ 사진 고르기·촬영 입력이 동영상도 받는다(accept 에 video/*) · 전후 비교 합성은 동영상을 뺀다(정적)
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert((src.match(/inp\.accept='image\/\*,video\/\*'/g) || []).length >= 2, '⑤ 사진 고르기·촬영 입력이 video/* 를 받는다');
  assert(/IMG\.includes\(f\.ext\)&&!isVideoExt\(f\.ext\)&&\(f\.thumb/.test(src), '⑤ 전후 비교 합성 목록은 동영상을 뺀다');

  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof ingestFile === 'function' && typeof makeVideoThumbDataUrl === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  // ① 확장자·분류
  const cls = await page.evaluate(() => ({
    mov: bestExt('IMG_0012.MOV', ''), mp4copy: bestExt('clip.mp4의 사본', ''), qt: bestExt('x', 'video/quicktime'), mkv: bestExt('y', 'video/x-matroska'), webm: bestExt('z.webm', ''),
    kind: classify({ ext: 'mp4', text: '', name: 'a.mp4' }), stillJpg: bestExt('IMG_1.jpg', ''), stillKind: classify({ ext: 'jpg', text: '', name: 'a.jpg' }),
  }));
  assert(cls.mov === 'mov' && cls.mp4copy === 'mp4' && cls.qt === 'mov' && cls.mkv === 'mkv' && cls.webm === 'webm', '① 동영상 확장자 인식: ' + JSON.stringify(cls));
  assert(cls.kind === 'photo' && cls.stillJpg === 'jpg' && cls.stillKind === 'photo', '① 동영상은 사진 묶음(photo)으로 분류: ' + JSON.stringify(cls));

  // ② 실제 동영상(캔버스 → MediaRecorder webm) 넣기
  const ing = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const cx = cv.getContext('2d');
    const stream = cv.captureStream(15); const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }); const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    let t = 0; const timer = setInterval(() => { cx.fillStyle = t % 2 ? '#c33' : '#38c'; cx.fillRect(0, 0, 320, 180); cx.fillStyle = '#fff'; cx.fillText('frame ' + t, 20, 90); t++; }, 60);
    rec.start(100); await new Promise(r => setTimeout(r, 1300)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(timer);
    const blob = new Blob(chunks, { type: 'video/webm' }); const file = new File([blob], 'site_clip.webm', { type: 'video/webm', lastModified: Date.now() });
    window.__vidFile = file;
    state.projects = [{ name: '둔산현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    state.files = [];
    const r = await ingestFile(file);
    const img = new File([new Uint8Array([137, 80, 78, 71])], 'still.png', { type: 'image/png' });
    window.__imgFile = img;
    return { size: file.size, ext: r.ext, kind: r.kind, ocr: r.ocr, thumb: String(r.thumb || '').slice(0, 22), id: r.id };
  });
  assert(ing.size > 0 && ing.ext === 'webm' && ing.kind === 'photo' && ing.ocr === 'na' && ing.thumb === 'data:image/jpeg;base64', '② 동영상 넣기: 사진 묶음·첫 장면 썸네일·OCR 없음: ' + JSON.stringify(ing));

  // ③ 칸 ▶ 배지 → 크게 보기 재생기
  await page.evaluate(() => { state.tab = 'photos'; state.activeProject = null; __photoCache.key = null; render(); });
  await page.waitForSelector('#view .ph .vidbadge');
  const cell = await page.evaluate(() => { const ph = document.querySelector('#view .ph'); return { badge: !!ph.querySelector('.vidbadge'), img: !!ph.querySelector('img[data-light]'), src: (ph.querySelector('img') || {}).src || '' }; });
  assert(cell.badge && cell.img && /^data:image\/jpeg/.test(cell.src), '③ 사진 칸에 ▶ 배지 + 썸네일: ' + JSON.stringify(cell));
  await page.click('#view .ph img[data-light]');
  await page.waitForSelector('#lightbox video#lbVideo');
  await page.waitForFunction(() => { const v = document.getElementById('lbVideo'); return v && /^blob:/.test(v.currentSrc || v.src || ''); });
  const lb = await page.evaluate(() => { const v = document.getElementById('lbVideo'); return { controls: v.hasAttribute('controls'), poster: (v.getAttribute('poster') || '').slice(0, 15), src: (v.src || '').slice(0, 5), meta: document.querySelector('#lightbox .lb-meta').textContent }; });
  assert(lb.controls && lb.poster === 'data:image/jpeg' && lb.src === 'blob:' && /site_clip\.webm/.test(lb.meta), '③ 크게 보기는 재생기(원본 연결·포스터): ' + JSON.stringify(lb));
  await page.evaluate(() => closeLightbox());

  // ④ 서버 중계에는 동영상을 보내지 않는다
  const up = await page.evaluate(async () => {
    const calls = []; const origCall = window.relayCall, origReady = window.relayReady, origComp = window.relayCompressPhoto;
    window.relayReady = () => true; window.relayCompressPhoto = async (b) => b;
    window.relayCall = async (a, p) => { calls.push([a, p && p.name]); return { ok: true, fileId: 'drv_' + calls.length, mimeType: 'image/jpeg', size: 4 }; };
    let msgs = []; const t = window.toast; window.toast = m => { msgs.push(String(m)); };
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __relay.token = 'T';
    const targets = [{ id: 'a' }, { id: 'b' }];
    const ok = await relayUploadFiles([window.__imgFile, window.__vidFile], 'photo', targets);
    window.relayCall = origCall; window.relayReady = origReady; window.relayCompressPhoto = origComp; window.toast = t; __relay.url = ''; __relay.token = '';
    return { ok, calls, msgs, drive: targets.map(x => x._driveId || null) };
  });
  assert(up.ok === 1 && up.calls.length === 1 && up.calls[0][0] === 'upload' && up.calls[0][1] === 'still.png', '④ 사진만 서버로: ' + JSON.stringify(up));
  assert(up.msgs.some(m => /동영상 1개/.test(m) && /사진 전용/.test(m)) && up.drive[0] === 'drv_1' && up.drive[1] === null, '④ 동영상 개수 안내 + 사진 쪽만 driveId: ' + JSON.stringify(up));

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));
  console.log('PASS  video-files: 동영상 확장자·마임 인식 · 사진 묶음 분류 · 첫 장면 썸네일 · ▶ 배지 · 재생기 · 서버 중계 제외 · 입력 accept');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });
