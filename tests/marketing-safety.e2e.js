/* marketing-safety.e2e.js — 홍보·사례 결함 다섯 (Playwright)

   2026-09-26 2차 발굴에서 두 반박자가 모두 인정한 것. 지키는 것:
     ① Before/After 갤러리와 공유용 '시공 사례' 페이지 칸이 사진(<img>)으로 그려진다 — 예전에는 f.thumb(data: URL
        문자열)를 그대로 이어 붙여 'data:image/jpeg;base64,…' 글자가 찍혔다. 썸네일이 없으면 📷 자리표시.
     ② 홍보 원고 '기간' 은 공사하는 날만 센다 — 상담·💰 수금·세금 자동·AS 방문 일정은 빼고, 여러 날 공정은
        memo 의 끝날까지(계약서 공사기간 contractPeriodProposal 과 같은 한 곳)
     ③ 홍보 원고 '공사' 줄·제목에 사진 분류명(시공전·완료·시공 전)이 공정으로 실리지 않는다(계약 범위와 같은 거름)
     ④ 사례 ZIP·📤 사진 묶음은 원본을 못 읽어 480px 미리보기만 얻은 사진을 담지 않고 몇 장 뺐는지 알린다,
        전부 미리보기뿐이면 ZIP 을 만들지 않고 sentAt 도 찍지 않는다
     ⑤ 사례 '동네+단지' 자동 채움이 '107-1302'·'107동 1302'·'1302호 욕실' 꼴을 떼고, hjCasePii 가 그 꼴을
        잡되 '보양비 30000원'·'107동 앞'·'타일 300-600' 같은 현장 메모는 막지 않는다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__hjRestoreDone && typeof window.hjCaseZip === 'function' && typeof window.adProjFacts === 'function' && typeof window.beforeAfterGallery === 'function');
  await page.evaluate(() => Promise.resolve(window.__hjRestoreDone).catch(() => {}));   // 부팅 복원이 시드를 덮지 않게 끝을 기다린다
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); }; });

  // 시드 — 원본 2400×1200 두 장(전·후) + 원본 없이 480×360 미리보기(data:)만 있는 사진 한 장
  await page.evaluate(async () => {
    const canvasOf = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); return c; };
    const fileOf = async (w, h, color, name) => { const b = await new Promise(r => canvasOf(w, h, color).toBlob(r, 'image/jpeg', 0.8)); return new File([b], name, { type: 'image/jpeg' }); };
    window.__thumb = canvasOf(480, 360, '#447').toDataURL('image/jpeg', 0.7);
    const fb = await fileOf(2400, 1200, '#864', 'b.jpg'), fa = await fileOf(2400, 1200, '#486', 'a.jpg');
    const P = '둔산동 크로바아파트';
    state.projects = [
      { name: P, stage: 5, received: 0, phases: ['시공전', '철거', '완료', '시공 전', '타일'], cost: {} },
      { name: '월평동 사진분류만', stage: 5, received: 0, phases: ['시공전', '완료'], cost: {} },
      { name: '한신아파트 107-1302', stage: 5, received: 0, phases: [], cost: {} }
    ];
    state.files = [
      { id: 'f-before', kind: 'photo', name: '전.jpg', project: P, _phase: '시공 전', _file: fb, thumb: window.__thumb, when: new Date('2026-08-03') },
      { id: 'f-after', kind: 'photo', name: '후.jpg', project: P, _phase: '완료', _file: fa, thumb: window.__thumb, when: new Date('2026-08-24') },
      { id: 'f-low', kind: 'photo', name: '후2.jpg', project: P, _phase: '완료', thumb: window.__thumb, when: new Date('2026-08-24T12:00') }
    ];
    state.schedule = [
      { id: 's1', date: '2026-06-01', title: '상담: 크로바', project: P },
      { id: 's2', date: '2026-06-05', title: '실측 방문', project: P },
      { id: 's3', date: '2026-08-03', title: '욕실 철거', project: P },
      { id: 's4', date: '2026-08-10', title: '목공', project: P, memo: '2026-08-10~2026-08-24 (15일)' },
      { id: 's5', date: '2026-10-30', title: '💰 수금: ' + P, project: P },
      { id: 's6', date: '2026-11-25', title: '부가세 신고', project: P, _taxAuto: true },
      { id: 's7', date: '2027-08-20', title: '🔧 AS 방문: 실리콘', project: P, asId: 'as1' }
    ];
    state.notes = [];
    state.activeProject = P; state.dirty = false;
  });

  // ① 갤러리·공유 페이지 — 그림이지 글자가 아니다
  const g = await page.evaluate(() => {
    beforeAfterGallery('둔산동 크로바아파트');
    const root = document.querySelector('#modalRoot');
    const imgs = [...root.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
    const out = { text: root.textContent, imgs };
    let html = '';
    window.open = () => ({ document: { write(h) { html += h; }, close() {} } });
    document.getElementById('baShare').click();
    out.html = html;
    return out;
  });
  assert(g.imgs.length >= 2 && g.imgs.every(s => s.indexOf('data:image/jpeg') === 0), '① 갤러리 칸이 <img src=data:…> 로 그려진다: ' + g.imgs.length);
  assert(g.text.indexOf('data:image') < 0 && g.text.indexOf('base64') < 0, '① 갤러리 글자에 base64 가 찍히지 않는다');
  assert(/<img src="data:image\/jpeg/.test(g.html), '① 공유 페이지도 <img> 로 그린다');
  assert(!/>\s*data:image/.test(g.html), '① 공유 페이지 본문에 data: URL 글자가 없다');
  const noThumb = await page.evaluate(() => {
    state.files.forEach(f => { f._thumbSave = f.thumb; delete f.thumb; });
    beforeAfterGallery('둔산동 크로바아파트');
    const root = document.querySelector('#modalRoot');
    const r = { imgs: root.querySelectorAll('img').length, text: root.textContent };
    state.files.forEach(f => { f.thumb = f._thumbSave; delete f._thumbSave; });
    closeModal();
    return r;
  });
  assert(noThumb.imgs === 0 && noThumb.text.indexOf('📷') >= 0, '① 썸네일이 없으면 📷 자리표시');

  // ② 기간 — 철거 8/3 ~ 목공 끝날 8/24 = 21일 → 약 3주 (상담 6/1·수금 10/30·세금·AS 를 넣으면 약 22주 이상)
  const f1 = await page.evaluate(() => { const f = adProjFacts('둔산동 크로바아파트'); const d = adDraftText('blog', f); return { f, d }; });
  assert(f1.f.period === '약 3주', '② 공사 일정만 센다(memo 끝날 포함): ' + f1.f.period);
  assert(/· 기간: 약 3주/.test(f1.d.body), '② 원고 본문 기간 줄');
  const f1b = await page.evaluate(() => { const keep = state.schedule; state.schedule = keep.filter(s => s.id === 's1' || s.id === 's5'); const r = adProjFacts('둔산동 크로바아파트').period; state.schedule = keep; return r; });
  assert(f1b === '', '② 상담·수금 일정만 있으면 기간을 짓지 않는다: ' + f1b);

  // ③ 공사 줄 — 사진 분류명 없이
  assert(f1.f.works === '철거, 타일', '③ 사진 분류명을 뺀 공정만: ' + f1.f.works);
  assert(!/시공\s?전|완료/.test(f1.d.title) && !/시공\s?전|완료/.test(f1.d.body.split('[시공 전 사진]').join('').split('[시공 후 사진]').join('')), '③ 제목·본문에 사진 분류명이 공정으로 없다: ' + f1.d.title);
  const f2 = await page.evaluate(() => { state.notes = [{ id: 'n1', project: '월평동 사진분류만', text: '[홈페이지 상담 리드]\n희망공사: 욕실 타일' }]; const r = adProjFacts('월평동 사진분류만'); state.notes = []; return r; });
  assert(f2.works === '타일, 욕실', '③ 분류명뿐이면 리드 노트 폴백으로: ' + f2.works);

  // ④ 미리보기만 있는 사진
  const lo = await page.evaluate(async () => {
    const low = state.files.find(f => f.id === 'f-low'), real = state.files.find(f => f.id === 'f-before');
    const a = await loadPhotoForExport(low), b = await loadPhotoForExport(real);
    const r = { lowFlag: !!(a && a.low), realFlag: !!(b && b.low) };
    const j = await hjCaseJpeg(low); r.jpegLow = !!(j && j.low && !j.bytes);
    const bundle = await filesForBundle([real, low], { start: 0, count: 2 });
    r.bundleFiles = bundle.files.length; r.bundleFailed = bundle.failed;
    // 원본을 못 얻은 동영상 — 미리보기 그림을 '영상_01.mp4' 로 싣지 않는다
    const vid = await filesForBundle([{ id: 'v1', kind: 'photo', name: 'clip.mp4', ext: 'mp4', project: '둔산동 크로바아파트', thumb: window.__thumb }], { start: 0, count: 1, video: true });
    r.vidFiles = vid.files.length; r.vidFailed = vid.failed;
    return r;
  });
  assert(lo.lowFlag && !lo.realFlag, '④ loadPhotoForExport 가 미리보기 폴백만 low 로 표시한다');
  assert(lo.jpegLow, '④ hjCaseJpeg 는 미리보기를 굽지 않는다');
  assert(lo.bundleFiles === 1 && lo.bundleFailed === 1, '④ 사진 묶음은 미리보기를 빼고 센다: ' + JSON.stringify(lo));
  assert(lo.vidFiles === 0 && lo.vidFailed === 1, '④ 동영상 자리에 미리보기 그림을 싣지 않는다: ' + JSON.stringify(lo));

  const zipRun = (ids) => page.evaluate(async (ids) => {
    const files = {}, clicked = [];
    window.ensureJSZip = async () => {};
    window.JSZip = function () { return { file(p, b) { files[p] = b; }, generateAsync: async () => new Blob(['zip']) }; };
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag) { const el = origCreate(tag); if (tag === 'a') el.click = () => clicked.push(el.download); return el; };
    const p = state.projects.find(x => x.name === '둔산동 크로바아파트');
    p.casePack = { place: '둔산동 크로바아파트', problem: '욕실 노후', cause: '세대 전유', work: '철거 → 타일', duration: '3주', symptom: '타일 들뜸', consent: true,
      photos: ids.map(id => hjFileRef(state.files.find(f => f.id === id))) };
    HJ_CASE_FIELDS.forEach(f => { if (!p.casePack[f[0]]) p.casePack[f[0]] = '테스트 값'; });
    window.__toasts = [];
    let ok; try { ok = await hjCaseZip(p); } finally { document.createElement = origCreate; }
    const live = state.projects.find(x => x.name === '둔산동 크로바아파트');
    const r = { ok, names: Object.keys(files), clicked, sentAt: live.casePack.sentAt || '', toasts: window.__toasts.slice() };
    delete live.casePack;
    return r;
  }, ids);
  const z1 = await zipRun(['f-before', 'f-after', 'f-low']);
  assert(z1.ok === true, '④ 원본이 있는 사진으로 ZIP 이 만들어진다');
  assert(z1.names.filter(n => /\.jpg$/.test(n)).length === 2, '④ 미리보기뿐인 사진은 ZIP 에 담기지 않는다: ' + z1.names.join(','));
  assert(z1.toasts.some(t => /원본을 못 읽어 뺀 사진 1장/.test(t)), '④ 뺀 장수를 알린다: ' + z1.toasts.join(' | '));
  const z2 = await zipRun(['f-low']);
  assert(z2.ok === false && z2.clicked.length === 0 && !z2.sentAt, '④ 전부 미리보기면 ZIP 을 만들지 않고 sentAt 도 없다: ' + JSON.stringify(z2));
  assert(z2.toasts.some(t => /미리보기만 있음 1장/.test(t)), '④ 왜 못 만들었는지 말한다: ' + z2.toasts.join(' | '));

  // ⑤ 자동 채움과 PII
  const pl = await page.evaluate(() => ({
    a: hjCasePlaceOf('한신아파트 107-1302'), b: hjCasePlaceOf('한신아파트 107동 1302'), c: hjCasePlaceOf('크로바 1302호 욕실'),
    d: hjCasePlaceOf('평화로운아파트 107동 1302호'), e: hjCasePlaceOf('107동 앞'), f: hjCasePlaceOf('e편한세상 2-1단지'), g: hjCasePlaceOf('월평1동 크로바'),
    h: hjCasePlaceOf('한신아파트 107동'), i: hjCasePlaceOf('크로바 도어락 1234'), j: hjCasePlaceOf('대전 1호선 크로바')
  }));
  assert(pl.a === '한신아파트' && pl.b === '한신아파트' && pl.c === '크로바' && pl.d === '평화로운아파트' && pl.h === '한신아파트', '⑤ 자동 채움이 세대 번호를 뗀다: ' + JSON.stringify(pl));
  assert(pl.e === '', '⑤ 떼고 남는 게 없으면 비운다: ' + pl.e);
  assert(pl.i === '', '⑤ 자르고도 hjCasePii 에 걸리면(출입 번호) 비운다: ' + pl.i);
  assert(pl.j === '대전 1호선 크로바', '⑤ 호선은 세대 번호가 아니다: ' + pl.j);
  assert(pl.f === 'e편한세상 2-1단지' && pl.g === '월평1동 크로바', '⑤ 단지 번호·행정동 숫자는 자르지 않는다: ' + JSON.stringify(pl));
  const pii = await page.evaluate(() => {
    const yes = ['한신아파트 107-1302', '한신아파트 107동 1302', '크로바 1302호 욕실', '107-1302호', '107동 1302호'];
    const no = ['보양비 30000원', '107동 앞', '타일 300-600 규격', '3호선 역 근처', '예치금 300000원', '3동 2000원', '공동현관 폭 1100mm', '5동 1500세대', '당일 09:30~15:40', '2026-09-26'];
    return { missed: yes.filter(t => hjCasePii(t).indexOf('동·호수') < 0), wrong: no.filter(t => hjCasePii(t).length) };
  });
  assert(!pii.missed.length, '⑤ 동·호수 꼴을 잡는다 — 놓친 것: ' + pii.missed.join(' / '));
  assert(!pii.wrong.length, '⑤ 현장 메모를 막지 않는다 — 잘못 막은 것: ' + pii.wrong.join(' / '));
  const ui = await page.evaluate(() => { state.activeProject = '한신아파트 107-1302'; casePackView(); const el = document.querySelector('#modalRoot .cpIn[data-k="place"]'); const v = el ? el.value : null; closeModal(); return v; });
  assert(ui === '한신아파트', '⑤ 사례 화면의 동네+단지 칸도 세대 번호 없이 채워진다: ' + ui);

  assert(!errors.length, 'pageerror 0: ' + errors.join(' | '));
  console.log('marketing-safety OK — ①갤러리 그림 ②공사 기간 ③공사 줄 ④미리보기 제외 ⑤세대 번호');
  await browser.close();
})().catch(async e => { console.error('FAIL', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });
