/* photo-bundle-privacy.e2e.js — 📤 사진 묶음 보내기가 원본 바이트·원본 파일명을 공유창에 싣지 않는다 (Playwright)

   2026-09-26: 사진 묶음 보내기(카톡 30장·문자 10장)는 원본 파일을 그대로 navigator.share 에 넣고 있었다.
   원본 JPEG 의 EXIF 에는 촬영 GPS(고객 집 좌표)·기기 정보가, 파일명에는 '김철수 1302호 완료' 같은 고객 정보가 들어 있다.
   사례 내보내기(hjCaseJpeg)와 같은 방식으로 다시 굽고 번호 이름으로 보낸다. 지키는 것:
     (가) 공유된 사진 바이트에 Exif·GPS 조각이 없다 — canvas 로 다시 구운 JPEG(긴 변 1800)
     (나) 공유된 이름은 '사진_01.jpg' 처럼 번호만 — 원본 이름·호수·고객 이름·현장명이 없다
     (다) 동영상은 다시 구울 수 없다 — 기본은 빼고 그 사실을 알린다, 「동영상도 넣기」를 고르면 원본 그대로(이름만 번호)
     (라) 굽기에 실패한 사진은 원본으로 새지 않는다 — 빼고 몇 장 뺐는지 화면에 남긴다
     (마) 직접 선택(파일 창) 경로도 같은 규칙 — 섞여 들어온 동영상은 뺀다
     (바) 굽는 사이 '사용자 활성'이 끝나 공유창이 거절(NotAllowedError)되면 구운 것을 버리지 않고,
          한 번 더 누르면 다시 굽지 않고 바로 공유창을 연다
     (사) filesForBundle 계약 — 동영상 허용 없이는 동영상을 싣지 않는다, 번호는 앞 묶음 다음부터 이어진다
     (아) 굽는 사이 이 창을 닫고 다른 창을 열었으면 굽기가 끝나도 발송 창을 다시 띄우지 않는다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const PJ = '평화아파트 107동 1302호';
const LEAK_RE = /테스트고객|1302|107동|평화아파트|완료|시공전|깨짐|선택|clip/;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {}
    // 실제 공유창을 열지 않는다 — 넘어간 내용을 그대로 잡는다. __shareMode='deny-once' 면 한 번 NotAllowedError(활성 만료 흉내).
    window.__shares = []; window.__shareMode = '';
    Object.defineProperty(navigator, 'canShare', { configurable: true, writable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: async (d) => {
      if (window.__shareMode === 'deny-once') { window.__shareMode = ''; throw Object.assign(new Error('activation expired'), { name: 'NotAllowedError' }); }
      window.__shares.push(d);
    } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.sendPhotoBundles === 'function' && typeof window.filesForBundle === 'function');
  // 부팅 복원·릴레이 설정이 끝난 뒤에 시드를 넣는다(늦은 applyData 가 시드를 덮지 않게)
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]); });
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); }; });
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const toastsHave = (re) => page.evaluate((src) => window.__toasts.some(t => new RegExp(src).test(t)), re.source);

  // 시드 — 실제 JPEG 에 EXIF(APP1: 'Exif' + 'GPSLatitude') 조각을 끼워 넣은 원본. 2400×1200 이라 다시 구우면 1800×900 이 된다.
  await page.evaluate(async (PJ) => {
    const withExif = async (label, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#3a6b8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = Math.round(h / 6) + 'px sans-serif'; g.fillText(label, 20, h / 2);
      const raw = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))).arrayBuffer());
      const payload = new TextEncoder().encode('Exif\0\0II*\0\x08\0\0\0\0\0GPSLatitude-36.3504N-GPSLongitude-127.3845E-Model-TESTPHONE');
      const seg = new Uint8Array(4 + payload.length); seg[0] = 0xFF; seg[1] = 0xE1; const len = payload.length + 2; seg[2] = len >> 8; seg[3] = len & 255; seg.set(payload, 4);
      const out = new Uint8Array(raw.length + seg.length); out.set(raw.subarray(0, 2), 0); out.set(seg, 2); out.set(raw.subarray(2), 2 + seg.length);
      return out;
    };
    window.__withExif = withExif;
    const f1 = new File([await withExif('B', 2400, 1200)], '테스트고객 1302호 시공전.jpg', { type: 'image/jpeg' });
    const f3 = new File([await withExif('A', 2400, 1200)], '테스트고객 1302호 완료.jpg', { type: 'image/jpeg' });
    // 굽기 실패 — SOI + EXIF 조각 뒤에 그림이 아닌 바이트. 디코드가 안 되니 다시 구울 수 없다. 이게 원본으로 새면 안 된다.
    const brokenBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x20, ...new TextEncoder().encode('Exif\0\0GPSLatitude-BROKEN-ORIG'), 1, 2, 3, 4, 5, 6, 7, 8]);
    const f2 = new File([brokenBytes], '테스트고객 1302호 깨짐.jpg', { type: 'image/jpeg' });
    const vid = new File([new TextEncoder().encode('\0\0\0\x18ftypmp42VIDEO-ORIGINAL-BYTES ©xyz+36.3504+127.3845/')], '테스트고객 1302호 clip.mp4', { type: 'video/mp4' });
    window.__vidSize = vid.size;
    state.projects = [{ name: PJ, stage: 3, received: 0, phases: [], cost: {} }, { name: '유성빌라', stage: 2, received: 0, phases: [], cost: {} }];
    state.files = [
      { id: 'b-3', kind: 'photo', name: f3.name, ext: 'jpg', project: PJ, _phase: '완료', _file: f3, when: new Date('2026-09-10T10:00') },
      { id: 'b-1', kind: 'photo', name: f1.name, ext: 'jpg', project: PJ, _phase: '시공전', _file: f1, when: new Date('2026-09-09T09:00') },
      { id: 'b-2', kind: 'photo', name: f2.name, ext: 'jpg', project: PJ, _file: f2, when: new Date('2026-09-09T12:00') },
      { id: 'b-v', kind: 'photo', name: vid.name, ext: 'mp4', project: PJ, _file: vid, when: new Date('2026-09-11T10:00') },
      { id: 'o-1', kind: 'photo', name: '딴집.jpg', ext: 'jpg', project: '유성빌라', _file: f1, when: new Date('2026-09-09') }
    ];
    state.activeProject = PJ; state.search = '';
    const srcHas = new TextDecoder('latin1').decode(new Uint8Array(await f3.arrayBuffer()));
    window.__srcHasExif = srcHas.indexOf('Exif') >= 0 && srcHas.indexOf('GPSLatitude') >= 0;
    const probe = await createImageBitmap(f3); window.__srcDecodes = probe.width === 2400;
  }, PJ);
  assert(await page.evaluate(() => window.__srcHasExif && window.__srcDecodes), '시드 원본에 Exif·GPS 조각이 실제로 들어 있고 그림으로 읽힌다(아니면 (가)가 헛돈다)');

  // 공유된 File 들을 바이트까지 풀어 본다
  const inspect = (i) => page.evaluate(async (i) => {
    const d = window.__shares[i];
    const files = [];
    for (const f of d.files) {
      const b = new Uint8Array(await f.arrayBuffer()), latin = new TextDecoder('latin1').decode(b);
      const r = { name: f.name, type: f.type, size: f.size, exif: latin.indexOf('Exif') >= 0 || latin.indexOf('GPSLatitude') >= 0 || latin.indexOf('TESTPHONE') >= 0, broken: latin.indexOf('BROKEN-ORIG') >= 0, video: latin.indexOf('VIDEO-ORIGINAL') >= 0, soi: b[0] === 0xFF && b[1] === 0xD8 };
      if (/^image\//.test(f.type)) { try { const bm = await createImageBitmap(f); r.w = bm.width; r.h = bm.height; } catch (e) { r.w = -1; } }
      files.push(r);
    }
    return { title: d.title, text: d.text, files };
  }, i);

  // ── 첫 화면: 알림 문구·동영상 선택(기본 꺼짐)·장수 표시
  await page.evaluate(() => moreActionHandler('photobundle'));
  let t = await modalText();
  assert(/촬영 위치 정보\(EXIF\)를 빼고 다시 저장해 사진_01\.jpg처럼 번호 이름으로 보냅니다/.test(t), '첫 화면에 위치 정보를 빼고 번호 이름으로 보낸다는 안내: ' + t.slice(0, 300));
  assert(await page.evaluate(() => { const c = document.querySelector('#pbVideo'); return !!c && c.checked === false; }), '(다) 「동영상도 넣기」가 있고 기본은 꺼져 있다');
  assert(/동영상도 넣기 — 동영상은 다시 저장할 수 없어 원본 그대로 갑니다\(촬영 위치 정보가 들어 있을 수 있음\)/.test(t), '(다) 동영상 선택 칸이 원본 그대로임을 밝힌다');
  const opt = await page.evaluate((PJ) => [...document.querySelectorAll('#pbProject option')].find(o => o.value === PJ).textContent, PJ);
  assert(opt === PJ + ' (3장 · 동영상 1개)', '현장 목록은 사진과 동영상을 따로 센다: ' + opt);
  assert(await page.evaluate(() => document.querySelector('#pbProject').value) === PJ, '보고 있는 현장이 골라져 있다');

  // ── (가)(나)(다)(라) 카톡 묶음 — 동영상 기본 제외
  await page.click('#pbKakao');
  t = await modalText();
  assert(await page.evaluate(() => { const n = document.querySelector('#pbVideoNote'); return !!n && /동영상 1개는 원본 그대로라\(위치 정보가 들어 있을 수 있음\) 뺐습니다\./.test(n.textContent); }), '(다) 동영상을 뺐다고 알린다: ' + t.slice(0, 300));
  assert(/총 3장 → 1묶음/.test(t) && /\(3장\)/.test(t), '(다) 묶음 장수에 동영상이 들어가지 않는다: ' + t.slice(0, 300));
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__shares.length === 1);
  let s1 = await inspect(0);
  console.log('  (보고용) 공유 제목: ' + JSON.stringify(s1.title) + ' / 본문: ' + JSON.stringify(s1.text));
  assert(s1.files.every(f => !f.exif && !f.broken), '(가) 공유된 바이트에 Exif·GPS·원본 조각이 없다: ' + JSON.stringify(s1.files));
  assert(s1.files.every(f => f.soi && f.type === 'image/jpeg' && f.w === 1800 && f.h === 900), '(가) 다시 구운 JPEG(긴 변 1800): ' + JSON.stringify(s1.files));
  assert(JSON.stringify(s1.files.map(f => f.name)) === JSON.stringify(['사진_01.jpg', '사진_03.jpg']), '(나)(라) 이름은 번호만, 굽지 못한 2번은 빠진다: ' + s1.files.map(f => f.name).join(','));
  assert(s1.files.every(f => !LEAK_RE.test(f.name)), '(나) 이름에 원본 이름·호수·현장명이 없다');
  assert(!s1.files.some(f => f.video || /^video\//.test(f.type) || /영상_/.test(f.name)), '(다) 동영상은 기본으로 실리지 않는다');
  await page.waitForFunction(() => /✅/.test((document.querySelector('#modalRoot [data-pbsend="0"]') || {}).textContent || ''));
  const row = await page.evaluate(() => document.querySelector('#modalRoot [data-pbsend="0"]').textContent);
  assert(/2장 보냄/.test(row) && /빠진 사진 1장\(다시 저장 실패 — 원본은 보내지 않음\)/.test(row), '(라) 뺀 장수가 화면에 남는다: ' + row);
  assert(await toastsHave(/사진 1장은 다시 저장하지 못해 뺐습니다 — 원본은 보내지 않습니다/), '(라) 보내기 전에 뺀 장수를 알린다');

  // ── (다) 「동영상도 넣기」를 고르면 원본 그대로 — 이름만 번호
  await page.evaluate(() => { closeModal(true); moreActionHandler('photobundle'); });
  await page.check('#pbVideo');
  await page.click('#pbKakao');
  t = await modalText();
  assert(await page.evaluate(() => !document.querySelector('#pbVideoNote')) && /동영상 1개는 원본 그대로 갑니다\(촬영 위치 정보가 들어 있을 수 있음\)/.test(t) && /총 4장 → 1묶음/.test(t), '(다) 고르면 뺐다는 말 대신 원본 그대로 간다고 말한다: ' + t.slice(0, 300));
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__shares.length === 2);
  const s2 = await inspect(1);
  const v = s2.files.find(f => /^video\//.test(f.type));
  assert(v && v.name === '영상_04.mp4' && v.type === 'video/mp4' && v.video && v.size === await page.evaluate(() => window.__vidSize), '(다) 고른 동영상은 원본 바이트 그대로, 이름만 번호: ' + JSON.stringify(s2.files));
  assert(JSON.stringify(s2.files.map(f => f.name)) === JSON.stringify(['사진_01.jpg', '사진_03.jpg', '영상_04.mp4']) && s2.files.filter(f => f.type === 'image/jpeg').every(f => !f.exif && f.w === 1800), '(다) 동영상을 넣어도 사진은 여전히 다시 굽는다: ' + JSON.stringify(s2.files));

  // ── (바) 활성 만료로 공유창이 거절되면 구운 것을 두고, 한 번 더 누르면 다시 굽지 않고 바로 연다
  await page.evaluate(() => {
    closeModal(true);
    window.__bakes = 0; const o = window.hjCaseJpeg; window.__origBake = o; window.hjCaseJpeg = async (f) => { window.__bakes++; return o(f); };
    window.__shareMode = 'deny-once'; window.__toasts = [];
    moreActionHandler('photobundle');
  });
  await page.click('#pbSms');
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__toasts.some(t => /준비됐습니다 — 같은 묶음을 한 번 더 누르면 공유창이 열립니다/.test(t)));
  const bakes1 = await page.evaluate(() => window.__bakes);
  assert(bakes1 === 3 && await page.evaluate(() => window.__shares.length) === 2, '(바) 첫 누름: 세 장 굽고 공유는 거절됨: ' + bakes1);
  assert(/준비됨 — 누르면 공유창이 열립니다/.test(await page.evaluate(() => document.querySelector('#modalRoot [data-pbsend="0"]').textContent)), '(바) 준비됨 표시');
  // 준비해 둔 것으로 연 공유창까지 거절되면 활성 탓이 아니다 — '한 번 더' 로 돌리지 않고 실패를 말한다(끝없는 되풀이 방지)
  await page.evaluate(() => { window.__shareMode = 'deny-once'; });
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__toasts.some(t => /^보내기 실패: activation expired/.test(t)));
  assert(await page.evaluate(() => window.__toasts.filter(t => /한 번 더 누르면/.test(t)).length) === 1, '(바) 준비된 것으로도 거절되면 다시 \'한 번 더\' 라고 하지 않는다');
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__shares.length === 3);
  assert(await page.evaluate(() => window.__bakes) === bakes1, '(바) 두 번째 누름은 다시 굽지 않는다');
  const s3 = await inspect(2);
  assert(JSON.stringify(s3.files.map(f => f.name)) === JSON.stringify(['사진_01.jpg', '사진_03.jpg']) && s3.files.every(f => !f.exif), '(바) 준비해 둔 것도 다시 구운 사진: ' + JSON.stringify(s3.files));
  await page.evaluate(() => { window.hjCaseJpeg = window.__origBake; });

  // ── (사) filesForBundle 계약
  const direct = await page.evaluate(async () => {
    const v = state.files.find(f => f.id === 'b-v'), p = state.files.find(f => f.id === 'b-1');
    const noVideo = await filesForBundle([v, p], {});
    const offset = await filesForBundle([p], { start: 30, count: 45 });
    const wide = await filesForBundle([p], { start: 99, count: 120 });
    return { noVideo: { names: noVideo.files.map(f => f.name), types: noVideo.files.map(f => f.type), failed: noVideo.failed }, offset: offset.files.map(f => f.name), wide: wide.files.map(f => f.name) };
  });
  assert(JSON.stringify(direct.noVideo.names) === JSON.stringify(['사진_02.jpg']) && direct.noVideo.failed === 1 && !direct.noVideo.types.some(x => /^video\//.test(x)), '(사) 동영상 허용 없이는 동영상을 싣지 않는다: ' + JSON.stringify(direct.noVideo));
  assert(JSON.stringify(direct.offset) === JSON.stringify(['사진_31.jpg']) && JSON.stringify(direct.wide) === JSON.stringify(['사진_100.jpg']), '(사) 번호는 앞 묶음 다음부터, 자릿수는 전체 장수에 맞춘다: ' + JSON.stringify(direct));

  // ── (마) 직접 선택 경로 — 파일 창에서 고른 원본도 다시 굽고, 섞여 든 동영상은 뺀다
  const pickedB64 = await page.evaluate(async () => { const b = await window.__withExif('P', 1200, 2400); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); });
  await page.evaluate(() => { closeModal(true); moreActionHandler('photobundle'); });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#pbPick')]);
  await chooser.setFiles([
    { name: '테스트고객 1302호 선택.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(pickedB64, 'base64') },
    { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('\0\0\0\x18ftypmp42VIDEO-ORIGINAL-PICKED') }
  ]);
  await page.waitForFunction(() => /직접 선택/.test((document.querySelector('#modalRoot') || {}).textContent || ''));
  assert(/총 1장 → 1묶음/.test(await modalText()), '(마) 섞여 든 동영상은 묶음 장수에서도 빠진다: ' + (await modalText()).slice(0, 200));
  assert(await page.evaluate(() => { const n = document.querySelector('#pbVideoNote'); return !!n && /동영상 1개는 원본 그대로라/.test(n.textContent); }), '(마) 섞여 든 동영상은 뺐다고 알린다');
  await page.click('#modalRoot [data-pbsend="0"]');
  await page.waitForFunction(() => window.__shares.length === 4);
  const s4 = await inspect(3);
  assert(s4.files.length === 1 && s4.files[0].name === '사진_01.jpg' && !s4.files[0].exif && s4.files[0].w === 900 && s4.files[0].h === 1800 && !s4.files.some(f => f.video), '(마) 직접 고른 사진도 다시 굽고 번호 이름, 동영상 없음: ' + JSON.stringify(s4.files));

  // ── (아) 굽는 사이 사용자가 이 창을 닫고 다른 창을 열었으면, 굽기가 끝나도 발송 창이 다시 튀어나와 그 창을 덮지 않는다
  //      (성공·실패 두 경로 모두 — 옛 코드는 실패 경로마다 무조건 draw() 로 openModal 을 다시 불렀다)
  for (const mode of ['ok', 'deny-once', 'err', 'nobake']) {
    await page.evaluate((mode) => {
      closeModal(true); window.__toasts = []; window.__shareMode = mode === 'ok' ? '' : mode;
      const o = window.__origBake;
      const gate = new Promise(r => { window.__releaseBake = r; });
      window.hjCaseJpeg = async (f) => { await gate; return mode === 'nobake' ? null : o(f); };
      // err: 공유창이 활성 탓이 아닌 오류로 실패(catch 끝 경로) / nobake: 한 장도 못 구움(빈 묶음 경로)
      if (mode === 'err') { const sh = navigator.share; navigator.share = async () => { navigator.share = sh; throw new TypeError('share broke'); }; }
      moreActionHandler('photobundle');
    }, mode);
    const before = await page.evaluate(() => window.__shares.length);
    await page.click('#pbSms');
    await page.click('#modalRoot [data-pbsend="0"]');
    await page.evaluate(() => { closeModal(true); openModal('다른 창', '<p id="otherModal">다른 화면</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }]); window.__releaseBake(); });
    if (mode === 'ok') await page.waitForFunction((n) => window.__shares.length === n + 1, before);
    else if (mode === 'deny-once') await page.waitForFunction(() => window.__toasts.some(t => /공유창을 열지 못했습니다 — 발송 창을 다시 열어 보내세요/.test(t)));
    else if (mode === 'err') await page.waitForFunction(() => window.__toasts.some(t => /^보내기 실패: share broke/.test(t)));
    else await page.waitForFunction(() => window.__toasts.some(t => /보낼 수 있는 사진 파일을 준비하지 못했습니다/.test(t)));
    assert(await page.evaluate(() => !!document.querySelector('#modalRoot #otherModal') && !document.querySelector('#modalRoot [data-pbsend]')), '(아) ' + mode + ': 굽기 뒤에 발송 창이 다른 창을 덮지 않는다');
    if (mode === 'deny-once') assert(await page.evaluate(() => !window.__toasts.some(t => /한 번 더 누르면/.test(t))), '(아) 창이 없는데 \'한 번 더 누르라\' 고 하지 않는다');
  }
  await page.evaluate(() => { window.hjCaseJpeg = window.__origBake; closeModal(true); });

  assert(errors.length === 0, 'pageerror 0: ' + errors.join(' | '));
  console.log('photo-bundle-privacy.e2e OK ((가) EXIF 제거 (나) 번호 이름 (다) 동영상 기본 제외·선택 포함 (라) 굽기 실패 비유출 (마) 직접 선택 (바) 활성 만료 재시도 (사) filesForBundle 계약 (아) 닫힌 창 다시 안 띄움)');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { await browser.close(); } catch (_) {} process.exit(1); });
