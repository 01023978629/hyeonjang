/* case-pack.e2e.js — 📰 사례 내보내기 (Playwright)

   2026-09-24: 현장 사진을 홈페이지 사례로 넘길 길이 앱에 없었다. 폰에서 사진을 고르고 6항목을 적어
   zip 하나로 내보낸다. 지키는 것:
     ① 더보기 그룹·옛 시트·핸들러에 casepack 이 있다(정적)
     ② 활성 현장으로 열리고, 동네+단지 칸은 현장 이름에서 동·호수를 뺀 값으로 미리 채워진다,
        사진은 전 → 중 → 후 순서로 나온다
     ③ 사진 체크는 p.casePack.photos 에 남고 개수 글이 바로 바뀐다
     ④ 6항목에 동·호수·전화번호가 들어가면 칸 아래 경고가 켜지고, 재료 복사·ZIP 은 만들어지지 않는다
        (적은 글은 지우지 않는다) — 동의 없음·사진 없음도 막는다
     ⑤ ZIP: 사진은 canvas 로 다시 구워 EXIF(촬영 위치)가 없고 긴 변 1800 이하, 파일 이름은 번호+전/중/후만,
        사례재료.txt 는 '1. 동네+단지:' 형식 — 보낸 날짜(sentAt)가 현장에 남는다
     ⑥ 값은 현장 객체에 붙어 저장 왕복을 지나고 serializeData 최상위 키는 늘지 않는다, pageerror 0

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

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(/\['casepack','📰','사례 내보내기'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="casepack"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='casepack'\)\{return casePackView\(\);\}/.test(source), '① 핸들러가 casePackView 로 간다');
assert(/casepack:'[^']+'/.test(source), '① MORE_HELP 설명이 있다(검색에 잡힌다)');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.casePackView === 'function' && typeof window.hjCaseZip === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const toasts = [];
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); }; });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');

  // 시드 — 실제 JPEG 에 EXIF(APP1) 조각을 끼워 넣은 원본 세 장. 2400×1200 이라 1800 으로 줄어야 한다.
  await page.evaluate(async () => {
    const mk = async (label) => {
      const c = document.createElement('canvas'); c.width = 2400; c.height = 1200;
      const g = c.getContext('2d'); g.fillStyle = '#8a6239'; g.fillRect(0, 0, 2400, 1200); g.fillStyle = '#fff'; g.font = '200px sans-serif'; g.fillText(label, 100, 700);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
      const raw = new Uint8Array(await blob.arrayBuffer());
      const payload = new TextEncoder().encode('Exif\0\0II*\0\x08\0\0\0\0\0GPSLatitude-fake');
      const seg = new Uint8Array(4 + payload.length); seg[0] = 0xFF; seg[1] = 0xE1; const len = payload.length + 2; seg[2] = len >> 8; seg[3] = len & 255; seg.set(payload, 4);
      const out = new Uint8Array(raw.length + seg.length); out.set(raw.subarray(0, 2), 0); out.set(seg, 2); out.set(raw.subarray(2), 2 + seg.length);
      return new File([out], label + '.jpg', { type: 'image/jpeg' });
    };
    const fa = await mk('A'), fb = await mk('B'), fc = await mk('C');
    window.__srcHasExif = new TextDecoder('latin1').decode(new Uint8Array(await fa.arrayBuffer())).indexOf('Exif') >= 0;
    state.projects = [
      { name: '평화로운아파트 107동 1302호', stage: 3, received: 0, phases: ['시공전', '완료'], cost: {} },
      { name: '유성빌라', stage: 2, received: 0, phases: [], cost: {} }
    ];
    state.files = [
      { id: 'p-after', kind: 'photo', name: '김철수 1302호 완료.jpg', project: '평화로운아파트 107동 1302호', _phase: '완료', _file: fc, when: new Date('2026-09-10') },
      { id: 'p-before', kind: 'photo', name: '거실 벽면.jpg', project: '평화로운아파트 107동 1302호', _phase: '시공 전', _file: fa, when: new Date('2026-09-09') },
      { id: 'p-mid', kind: 'photo', name: '배관 교체 중.jpg', project: '평화로운아파트 107동 1302호', _file: fb, when: new Date('2026-09-09T12:00') },
      { id: 'p-video', kind: 'photo', name: 'clip.mp4', ext: 'mp4', project: '평화로운아파트 107동 1302호', when: new Date('2026-09-09') },
      { id: 'p-other', kind: 'photo', name: '딴집.jpg', project: '유성빌라', _file: fb, when: new Date('2026-09-09') }
    ];
    state.activeProject = '평화로운아파트 107동 1302호'; state.dirty = false;
    moreActionHandler('casepack');
  });
  assert(await page.evaluate(() => window.__srcHasExif), '시드 원본에 Exif 조각이 실제로 들어 있다(아니면 ⑤가 헛돈다)');

  // ② 열림·미리 채움·순서
  let t = await modalText();
  assert(/사례 내보내기 — 평화로운아파트 107동 1302호/.test(t), '② 활성 현장으로 열린다: ' + t.slice(0, 80));
  assert(await page.inputValue('#modalRoot .cpIn[data-k="place"]') === '평화로운아파트', '② 동네+단지 칸은 동·호수를 뺀 값으로 미리 채워진다');
  const order = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .cpChk')].map(e => e.dataset.id));
  assert(JSON.stringify(order) === JSON.stringify(['p-before', 'p-mid', 'p-after']), '② 전→중→후 순서, 동영상·딴 현장 제외: ' + order.join(','));
  assert(/고른 사진이 없습니다/.test(t), '② 처음엔 고른 사진 없음');

  // ③ 체크는 현장 객체에 남는다
  for (const id of ['p-before', 'p-mid', 'p-after']) await page.check('#modalRoot .cpChk[data-id="' + id + '"]');
  const stored = await page.evaluate(() => (state.projects[0].casePack || {}).photos);
  assert(JSON.stringify(stored) === JSON.stringify(['p-before', 'p-mid', 'p-after']) && await page.evaluate(() => state.dirty === true), '③ p.casePack.photos + dirty: ' + JSON.stringify(stored));
  assert(/고른 사진 3장 \(시공 전 1 · 작업 중 1 · 완료 1\)/.test(await page.evaluate(() => document.querySelector('#cpCount').textContent)), '③ 개수 글이 바로 바뀐다');
  await page.uncheck('#modalRoot .cpChk[data-id="p-mid"]');
  assert(JSON.stringify(await page.evaluate(() => state.projects[0].casePack.photos)) === JSON.stringify(['p-before', 'p-after']), '③ 체크 해제도 남는다');
  await page.check('#modalRoot .cpChk[data-id="p-mid"]');

  // ④ 개인정보·동의·빈 칸 차단
  const fill = async (k, v) => { await page.fill('#modalRoot .cpIn[data-k="' + k + '"]', v); };
  await fill('symptom', '아랫집 천장 물자국'); await fill('method', '내시경으로 벽 속 배관 확인'); await fill('work', '함 둘레 개방 후 PB 배관 교체'); await fill('duration', '당일 09:30~15:40');
  await fill('cause', '107동 1302호 계량기함 뒤 매립 배관');
  assert(await page.evaluate(() => { const w = document.querySelector('#modalRoot .cpWarn[data-k="cause"]'); return !w.hidden && /동·호수/.test(w.textContent); }), '④ 동·호수 경고가 칸 아래 켜진다');
  await page.click('#modalRoot .mfoot button:has-text("📋 재료 복사")');
  assert(/동·호수/.test(await lastToast()), '④ 재료 복사 거부: ' + await lastToast());
  await page.click('#modalRoot .mfoot button:has-text("📦 ZIP 만들기")');
  assert(/동·호수/.test(await lastToast()) && await page.inputValue('#modalRoot .cpIn[data-k="cause"]') === '107동 1302호 계량기함 뒤 매립 배관', '④ ZIP 거부 + 적은 글은 지우지 않는다');
  await fill('cause', '연락은 010-1234-5678 로 — 계량기함 뒤 매립 배관');
  assert(await page.evaluate(() => /전화번호/.test(document.querySelector('#modalRoot .cpWarn[data-k="cause"]').textContent)), '④ 전화번호도 잡는다');
  await fill('cause', '계량기함 뒤 매립 배관 이음부 — 세대 전유');
  assert(await page.evaluate(() => document.querySelector('#modalRoot .cpWarn[data-k="cause"]').hidden), '④ 지우면 경고가 꺼진다');
  await page.click('#modalRoot .mfoot button:has-text("📦 ZIP 만들기")');
  assert(/동의/.test(await lastToast()), '④ 동의 없이는 못 만든다: ' + await lastToast());
  await page.check('#cpConsent');
  assert(await page.evaluate(() => state.projects[0].casePack.consent === true), '④ 동의가 현장에 남는다');

  // ⑤ ZIP — JSZip 스텁으로 담긴 파일을 잡는다, 다운로드 앵커는 가로챈다
  const out = await page.evaluate(async () => {
    const files = {};
    window.JSZip = function () { return { file(p, b) { files[p] = b; }, generateAsync: async () => new Blob(['zip']) }; };
    const clicked = []; const origCreate = document.createElement.bind(document);
    document.createElement = function (tag) { const el = origCreate(tag); if (tag === 'a') el.click = () => clicked.push(el.download); return el; };
    const ok = await hjCaseZip(state.projects[0]);
    document.createElement = origCreate;
    const rep = {};
    for (const [name, b] of Object.entries(files)) {
      if (typeof b === 'string') { rep[name] = { text: b }; continue; }
      const latin = new TextDecoder('latin1').decode(b);
      const bmp = await createImageBitmap(new Blob([b], { type: 'image/jpeg' }));
      rep[name] = { soi: b[0] === 0xFF && b[1] === 0xD8, hasExif: latin.indexOf('Exif') >= 0 || latin.indexOf('GPSLatitude') >= 0, w: bmp.width, h: bmp.height };
    }
    return { ok, clicked, rep, sentAt: state.projects[0].casePack.sentAt };
  });
  assert(out.ok === true, '⑤ ZIP 이 만들어진다: ' + JSON.stringify(out).slice(0, 300));
  const names = Object.keys(out.rep).sort();
  assert(JSON.stringify(names) === JSON.stringify(['01-전.jpg', '02-중.jpg', '03-후.jpg', '사례재료.txt']), '⑤ 파일 이름은 번호+전/중/후만(원본 이름의 사람·호수가 새지 않는다): ' + names.join(','));
  for (const n of names.filter(x => x.endsWith('.jpg'))) {
    const r = out.rep[n];
    assert(r.soi && !r.hasExif, '⑤ ' + n + ' 은 JPEG 이고 Exif·GPS 가 없다: ' + JSON.stringify(r));
    assert(r.w === 1800 && r.h === 900, '⑤ ' + n + ' 긴 변 1800 으로 줄었다: ' + r.w + '×' + r.h);
  }
  const txt = out.rep['사례재료.txt'].text;
  assert(/^1\. 동네\+단지: 평화로운아파트$/m.test(txt) && /^4\. 원인 \(전유\/공용\): 계량기함 뒤 매립 배관 이음부 — 세대 전유$/m.test(txt), '⑤ 6항목 형식(manmool new-case-post 가 읽는 줄): ' + txt.slice(0, 200));
  assert(/사진: 3장 \(시공 전 1 · 작업 중 1 · 완료 1\)/.test(txt) && /01-전\.jpg — 시공 전/.test(txt) && /공개 동의: 받음/.test(txt), '⑤ 사진 목록·동의 줄: ' + txt);
  assert(!/1302|김철수|107동/.test(txt), '⑤ 재료 글에 동·호수·이름이 없다');
  assert(out.clicked.length === 1 && /^사례_평화로운아파트_\d{8}\.zip$/.test(out.clicked[0]), '⑤ 내려받기 이름: ' + out.clicked.join(','));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(out.sentAt), '⑤ 보낸 날짜가 현장에 남는다: ' + out.sentAt);

  // ⑥ 저장 왕복·최상위 키
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /case/i.test(k)), '⑥ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const back = await page.evaluate(() => { const snap = JSON.parse(JSON.stringify(serializeData())); applyData(snap); const p = state.projects.find(x => x.name === '평화로운아파트 107동 1302호'); return p && p.casePack; });
  assert(back && back.consent === true && back.cause === '계량기함 뒤 매립 배관 이음부 — 세대 전유' && JSON.stringify([...back.photos].sort()) === JSON.stringify(['p-after', 'p-before', 'p-mid']) && back.sentAt, '⑥ 왕복 뒤에도 남는다: ' + JSON.stringify(back));
  await page.evaluate(() => casePackView('평화로운아파트 107동 1302호'));
  assert(/✓ \d{4}-\d{2}-\d{2}/.test(await page.evaluate(() => document.querySelector('#cpProj option:checked').textContent)), '⑥ 현장 목록에 보낸 표시');
  // 현장 전환 — 딴 현장 사진만 보인다
  await page.selectOption('#cpProj', '유성빌라');
  const other = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .cpChk')].map(e => e.dataset.id));
  assert(JSON.stringify(other) === JSON.stringify(['p-other']) && await page.inputValue('#modalRoot .cpIn[data-k="place"]') === '유성빌라', '⑥ 현장을 바꾸면 그 현장 것: ' + other.join(','));

  assert(errors.length === 0, 'pageerror 0: ' + errors.join(' | '));
  console.log('case-pack.e2e OK (① 메뉴 ② 열림·미리 채움·순서 ③ 체크 저장 ④ 개인정보·동의 차단 ⑤ ZIP·EXIF 제거·1800·이름·재료 글 ⑥ 왕복·전환)');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { await browser.close(); } catch (_) {} process.exit(1); });
