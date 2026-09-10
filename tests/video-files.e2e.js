/* video-files.e2e.js — 현장 동영상 인식 (Playwright)

   2026-09-09 v262 (대표 요청: "현장 사진 웹 동영상도 인식되게"):
     ① 확장자·마임 인식: .MOV·.mp4·"clip.mp4의 사본"·video/quicktime 이 동영상 확장자로 잡히고 분류는 'photo'(사진 묶음)
     ② 파일을 넣으면(ingestFile) 썸네일을 만들지 않고(v276: 파일 형식만 — 폰에서 첫 장면 캡처가 비거나 느렸다) 글자 인식도 안 한다(ocr 'na')
     ③ 사진 탭 칸은 그림 대신 🎬 + 파일 형식(WEBM) 타일이고(img 없음), 누르면 크게 보기가 재생기(<video controls>)로 열리며 원본이 연결된다;
        옛 v275 썸네일이 남아 있어도 그림을 쓰지 않는다
     ④ 서버 중계(사진 전용)에는 동영상을 보내지 않는다 — 사진만 올리고 동영상 개수를 한 번 안내
     ⑤ 사진 고르기·촬영 입력이 동영상도 받는다(accept 에 video/*) · 전후 비교 합성은 동영상을 뺀다(정적)
     ⑦ (검토 반영) 동영상은 '빈 사진' 복구 대상이 아니다 · 크게 보기 기본 목록에 들어간다 · 옛 v275 썸네일 캐시는 hydrateThumbs 가 지운다 ·
        makeThumbDataUrl 은 동영상에 즉시 null · 파일 카드 형식 상자도 누르면 재생 · 전후 비교·AI 사진 도구는 동영상 제외 · 공정 셀 가벼운 갱신이 타일에도 먹는다
     ⑧ 원본이 없는 동영상(폰 새로고침 뒤)은 재생기를 숨기고 형식·안내 문구를 보여 준다
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
const state0Id = (id) => id;
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
  await page.waitForFunction(() => typeof ingestFile === 'function' && typeof videoTile === 'function');
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
    const t0 = performance.now(); return { size: file.size, ext: r.ext, kind: r.kind, ocr: r.ocr, thumb: r.thumb, id: r.id, cached: await idbGet('thumb-local:' + fileKey(r)) };
  });
  assert(ing.size > 0 && ing.ext === 'webm' && ing.kind === 'photo' && ing.ocr === 'na' && !ing.thumb && !ing.cached, '② 동영상 넣기: 사진 묶음·썸네일 없음(캐시도 없음)·OCR 없음: ' + JSON.stringify(ing));

  // ③ 칸 ▶ 배지 → 크게 보기 재생기
  await page.evaluate(() => { state.files[0].thumb = 'data:image/jpeg;base64,/9j/4AAQ'; state.tab = 'photos'; state.activeProject = null; __photoCache.key = null; render(); });   // 옛 썸네일이 남아 있어도
  await page.waitForSelector('#view .ph .ph-vid');
  const cell = await page.evaluate(() => { const ph = document.querySelector('#view .ph'); const t = ph.querySelector('.ph-vid'); return { ext: (t.querySelector('.ph-vid-ext') || {}).textContent, play: (t.querySelector('.ph-vid-play') || {}).textContent, img: ph.querySelectorAll('img').length, light: t.getAttribute('data-light'), aria: t.getAttribute('aria-label'), h: Math.round(t.getBoundingClientRect().height) }; });
  assert(cell.ext === 'WEBM' && /재생/.test(cell.play) && cell.img === 0 && cell.light && cell.aria === '동영상 WEBM 재생' && cell.h >= 44, '③ 칸은 그림 없이 🎬 + 파일 형식 타일(버튼 역할): ' + JSON.stringify(cell));
  const role = await page.evaluate(() => { const t = document.querySelector('#view .ph .ph-vid'); return [t.getAttribute('role'), t.getAttribute('tabindex')]; });
  assert(role[0] === 'button' && role[1] === '0', '③ 타일은 버튼 역할·키보드 초점: ' + JSON.stringify(role));
  await page.click('#view .ph .ph-vid[data-light]');
  await page.waitForSelector('#lightbox video#lbVideo');
  await page.waitForFunction(() => { const v = document.getElementById('lbVideo'); return v && /^blob:/.test(v.currentSrc || v.src || ''); });
  const lb = await page.evaluate(() => { const v = document.getElementById('lbVideo'); return { controls: v.hasAttribute('controls'), poster: v.hasAttribute('poster'), src: (v.src || '').slice(0, 5), meta: document.querySelector('#lightbox .lb-meta').textContent }; });
  assert(lb.controls && !lb.poster && lb.src === 'blob:' && /site_clip\.webm/.test(lb.meta), '③ 크게 보기는 재생기(원본 연결·포스터 없음): ' + JSON.stringify(lb));
  const srcGuard = await page.evaluate(() => photoSrc(state.files[0], 480));   // 옛 썸네일이 있어도 다른 호출자에게 그림을 주지 않는다
  assert(srcGuard === '', '③ photoSrc 는 동영상에 빈 값: ' + JSON.stringify(srcGuard));
  await page.evaluate(() => { closeLightbox(); state.files[0].thumb = null; });
  // 파일 카드(문서 보기)도 그림 대신 .WEBM 형식 상자
  const card = await page.evaluate(() => { const html = cardHtml(state.files[0]); return { ext: /class="ext" data-light="[^"]+"[^>]*>\.WEBM</.test(html), img: /<img/.test(html) }; });
  assert(card.ext && !card.img, '③ 파일 카드는 .WEBM 형식 상자(누르면 재생): ' + JSON.stringify(card));

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
  assert(up.msgs.some(m => /동영상 1개/.test(m) && /사진만 올림/.test(m) && /폰 사진첩/.test(m)) && up.drive[0] === 'drv_1' && up.drive[1] === null, '④ 동영상 개수 안내(폰: 사진첩에 원본) + 사진 쪽만 driveId: ' + JSON.stringify(up));

  // ⑦ 검토 반영 항목들
  const rv = await page.evaluate(async () => {
    const v = state.files[0];
    const photo = { id: 'ph1', name: 'still.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: new Date(), size: 5, thumb: 'data:image/jpeg;base64,/9j/4AAQ', _file: null, _phase: '철거' };
    state.files.push(photo); v.project = '둔산현장';
    const out = {};
    out.missing = missingPhotoPreviews().map(f => f.id); out.repairBtn = clusterRepairButton([v]);
    openLightbox('ph1'); out.lbList = __lightboxList.slice(); closeLightbox();
    await idbSet('thumb-local:' + fileKey(v), 'data:image/jpeg;base64,/9j/4AAQ'); v.thumb = 'data:image/jpeg;base64,/9j/4AAQ';
    await hydrateThumbs(); out.thumbAfterHydrate = v.thumb; out.cacheAfterHydrate = await idbGet('thumb-local:' + fileKey(v));
    const t0 = performance.now(); out.thumbGen = await makeThumbDataUrl(window.__vidFile, 480); out.thumbGenMs = Math.round(performance.now() - t0);
    out.ba = beforeAfterPairs('둔산현장').total; out.baProj = baProjectsWithPhotos().map(x => [x.name, x.count]);
    const origLoad = window.loadPhotoForExport; window.__loadCalls = 0; window.loadPhotoForExport = async (...a) => { window.__loadCalls++; return origLoad(...a); };
    out.b64 = await photoToB64(v, 512); out.b64Loads = window.__loadCalls; window.loadPhotoForExport = origLoad;
    state.tab = 'photos'; __photoCache.key = null; render();
    updatePhaseCell(v.id, '방수'); const cell = document.querySelector('#view .ph-vid[data-light="' + v.id + '"]').closest('.ph'); out.tag = (cell.querySelector('.ph-tag.phase') || {}).textContent || '';
    state.files = state.files.filter(f => f.id !== 'ph1');
    return out;
  });
  assert(rv.missing.length === 0 && rv.repairBtn === '', '⑦ 동영상은 빈 사진 복구 대상이 아니다: ' + JSON.stringify([rv.missing, rv.repairBtn]));
  assert(rv.lbList.includes(state0Id(ing.id)) && rv.lbList.includes('ph1'), '⑦ 크게 보기 기본 목록에 동영상 포함: ' + JSON.stringify(rv.lbList));
  assert(rv.thumbAfterHydrate === null && !rv.cacheAfterHydrate, '⑦ 옛 썸네일 캐시를 지우고 그림을 쓰지 않는다: ' + JSON.stringify([rv.thumbAfterHydrate, rv.cacheAfterHydrate]));
  assert(rv.thumbGen === null && rv.thumbGenMs < 1000, '⑦ makeThumbDataUrl 은 동영상에 즉시 null: ' + JSON.stringify([rv.thumbGen, rv.thumbGenMs]));
  assert(rv.ba === 1 && JSON.stringify(rv.baProj) === JSON.stringify([['둔산현장', 1]]) && rv.b64 === null && rv.b64Loads === 0, '⑦ 전후 비교·AI 사진 도구는 동영상 제외(원본 로드 시도 0): ' + JSON.stringify([rv.ba, rv.baProj, rv.b64, rv.b64Loads]));
  assert(rv.tag === '방수', '⑦ 공정 셀 가벼운 갱신이 동영상 타일에도 먹는다: ' + JSON.stringify(rv.tag));

  // ⑧ 원본 없는 동영상(폰에서 새로고침한 뒤)
  const none = await page.evaluate(async () => {
    const v = state.files[0]; v._file = null; v.handle = null;
    openLightbox(v.id); await new Promise(r => setTimeout(r, 200));
    const vd = document.getElementById('lbVideo'), msg = document.getElementById('lbVideoNone');
    const out = { hidden: !!(vd && vd.hidden), msg: msg ? msg.textContent : '', inStage: !!(msg && msg.closest('.lb-stage')) };
    closeLightbox(); v._file = window.__vidFile; return out;
  });
  assert(none.hidden && none.inStage && /WEBM 동영상/.test(none.msg) && /폰 사진첩/.test(none.msg), '⑧ 원본 없으면 재생기 숨기고 안내: ' + JSON.stringify(none));

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));
  console.log('PASS  video-files: 동영상 확장자·마임 인식 · 사진 묶음 분류 · 썸네일 없음 · 🎬 형식 타일(버튼) · 재생기 · 서버 중계 제외 · 입력 accept · 복구 대상 제외 · 옛 캐시 정리 · 전후/AI 제외 · 원본 없음 안내');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });
