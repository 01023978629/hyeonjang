/* mobile-modal-tap.e2e.js — 폰(갤럭시 360×740)에서 모달 버튼이 손가락 크기인가 · 동·호수 관리에 사진이 보이는가
   대표 요청: "폰 기능강화". 실측(2026-09-19)에서 나온 것 둘:
     · 모든 모달의 아래 버튼줄이 42px 였다(모바일 미디어쿼리). 이 저장소의 자체 규칙은 44px 인데
       특정 모달(.apt-unit-modal)만 따로 44 를 붙여 두고 있었다 — 새 모달마다 잊는다. 전역으로 맞춘다.
     · 동·호수 관리에서 사진 30장을 배정할 때 파일명만 보였다(카톡사진_29.jpg). 어느 호수 사진인지
       알 수 없어 한 장씩 [보기]를 눌러야 했다. 줄마다 썸네일을 넣는다.
   여기서 지키는 것: 버튼·× 가 44px 이상 · 썸네일이 있고 lazy 로 그린다 · 썸네일 없는 사진은 깨진 그림
   대신 자리표시 · 체크박스는 여전히 줄의 첫 input(기존 검사 apartment-units 가 first.check() 로 잡는다) */
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

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });

  const N = '가상탭현장';
  await page.evaluate(({ N, PNG }) => {
    try { closeModal(true); } catch (e) {}
    const u = (id, d, h) => ({ id, type: 'unit', dong: String(d), ho: String(h), name: '', note: '' });
    state.projects = [{ name: N, stage: 4, received: 3800000, doneAt: '2026-09-16', phases: ['방수'], cost: { material: 0, labor: 0, outsource: 0 },
      customer: { name: '홍길동', phone: '010-1111-2222', addr: '대전 서구' }, archived: false, aptUnits: [u('a1', 107, 1302), u('a2', 108, 501)] }];
    state.files = [];
    for (let i = 0; i < 12; i++) state.files.push({ id: 'p' + i, name: '카톡사진_' + i + '.jpg', prefix: '', kind: 'photo', ext: 'jpg', size: 10, project: N,
      when: new Date('2026-09-10T09:' + String(i).padStart(2, '0') + ':00'), thumb: i === 5 ? '' : 'data:image/png;base64,' + PNG, _phase: '' });   // p5 는 썸네일 없음
    state.payLog = [{ project: N, d: '2026-09-18', amt: 1000000 }];
    state.quotes = []; state.activeProject = N; state.dirty = false;
    __contract.url = 'https://script.google.com/macros/s/TEST/exec'; __contract.token = 'SUPER-SECRET-ADMIN-TOKEN'; __contract.selfTestOk = true;
    render();
  }, { N, PNG });
  // 모바일 모드는 화면 폭이 아니라 대표가 고른 설정(pref_mobile, IDB 에서 부팅 때 복원)이다.
  // 부팅 직후 그 복원과 경쟁하면 어떤 때는 켜져 있고 어떤 때는 꺼져 있다(실제로 1/8 로 흔들렸다).
  // 이 검사의 주제는 '폰 화면'이므로 앱의 길(applyMobileMode)로 명시적으로 켠다 — 우연에 기대지 않는다.
  await page.evaluate(() => { __mobileMode = true; applyMobileMode(); });
  await page.waitForFunction(() => document.body.classList.contains('mobile-mode'));

  const tapSizes = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#modalRoot .mfoot button, #modalRoot .modal-close').forEach(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') return;
      out.push({ txt: (el.textContent || '').trim().slice(0, 16) || el.className, w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  });
  const closeAll = () => page.evaluate(() => { try { closeModal(true); } catch (e) {} });
  const expect44 = async (label) => {
    const s = await tapSizes();
    assert(s.length >= 2, label + ': 버튼줄·×를 못 찾았다: ' + JSON.stringify(s));
    const bad = s.filter(x => x.w < 44 || x.h < 44);
    assert(bad.length === 0, label + ': 44px 미만 — ' + JSON.stringify(bad));
  };

  await test('서류 만들기 모달 — 아래 버튼과 × 가 44px 이상', async () => {
    await page.evaluate(n => docHubView(n), N); await page.waitForSelector('#modalRoot .docHubBtn'); await expect44('서류 만들기'); await closeAll();
  });
  await test('간이영수증 입력 모달 — 44px 이상', async () => {
    await page.evaluate(n => payRcptDialog(n), N); await page.waitForSelector('#prcAmt'); await expect44('간이영수증'); await closeAll();
  });
  await test('하자보증서 만들기 모달 — 44px 이상', async () => {
    await page.evaluate(n => warrantyView(n), N); await page.waitForSelector('#modalRoot #wrWork'); await expect44('하자보증서'); await closeAll();
  });
  await test('링크 서명 모달 — 44px 이상', async () => {
    await page.evaluate(n => warrantyLinkSend(n, {}), N); await page.waitForSelector('#wlPhone'); await expect44('링크 서명'); await closeAll();
  });
  await test('★ 이 규칙은 특정 모달이 아니라 전역이다 — 아무 꾸밈 없는 openModal 도 44px', async () => {
    await page.evaluate(() => openModal('가상 모달', '<p>본문</p>', [{ label: '하나', cls: 'ghost', fn: closeModal }, { label: '둘', cls: 'clay', fn: closeModal }, { label: '셋', cls: 'ghost', fn: closeModal }, { label: '넷', cls: 'ghost', fn: closeModal }]));
    await page.waitForSelector('#modalRoot .mfoot button');
    await expect44('맨몸 모달(버튼 4개)');
    // 버튼 4개가 줄바꿈해도 화면 밖으로 밀리지 않는다
    const r = await page.evaluate(() => { const f = document.querySelector('#modalRoot .mfoot').getBoundingClientRect(); return { bottom: Math.round(f.bottom), vh: innerHeight, over: document.documentElement.scrollWidth - innerWidth }; });
    assert(r.bottom <= r.vh + 1 && r.over <= 1, '버튼줄이 화면 밖: ' + JSON.stringify(r));
    await closeAll();
  });

  await test('★ 동·호수 관리 — 사진 줄마다 썸네일이 있고 lazy 로 그린다', async () => {
    await page.evaluate(n => aptUnitView(n), N); await page.waitForSelector('#modalRoot .apt-unit-row');
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#modalRoot .apt-unit-row')];
      return rows.map(row => { const img = row.querySelector('img.apt-unit-thumb'); const ph = row.querySelector('.apt-unit-thumb-none');
        const first = row.querySelector('input'); const box = img ? img.getBoundingClientRect() : (ph ? ph.getBoundingClientRect() : null);
        return { id: (first || {}).value, hasImg: !!img, hasPh: !!ph, lazy: img ? img.getAttribute('loading') : null, decoding: img ? img.getAttribute('decoding') : null,
          alt: img ? img.getAttribute('alt') : null, w: box ? Math.round(box.width) : 0, h: box ? Math.round(box.height) : 0,
          firstIsCheckbox: !!first && first.type === 'checkbox' }; });
    });
    assert(r.length === 12, '사진 12줄이어야 한다: ' + r.length);
    const withThumb = r.filter(x => x.id !== 'p5');
    assert(withThumb.every(x => x.hasImg), '썸네일이 빠진 줄: ' + JSON.stringify(withThumb.filter(x => !x.hasImg).map(x => x.id)));
    assert(withThumb.every(x => x.lazy === 'lazy' && x.decoding === 'async'), '썸네일 80장을 한꺼번에 디코딩하면 폰이 멈춘다 — lazy/async 가 빠졌다: ' + JSON.stringify(withThumb[0]));
    assert(withThumb.every(x => x.w >= 48 && x.h >= 48), '썸네일이 알아볼 크기(48px+)여야 한다: ' + JSON.stringify(withThumb[0]));
    assert(withThumb.every(x => x.alt === ''), '체크박스 aria-label 이 이미 파일명을 읽는다 — img alt 는 비워 두 번 읽지 않게: ' + JSON.stringify(withThumb[0].alt));
    assert(r.every(x => x.firstIsCheckbox), '줄의 첫 input 은 체크박스여야 한다(기존 검사 apartment-units 가 first.check() 로 잡는다)');
  });
  await test('★ 썸네일 없는 사진은 깨진 그림 대신 자리표시', async () => {
    const r = await page.evaluate(() => {
      const row = [...document.querySelectorAll('#modalRoot .apt-unit-row')].find(x => x.querySelector('input').value === 'p5');
      return { hasImg: !!row.querySelector('img'), hasPh: !!row.querySelector('.apt-unit-thumb-none'), name: row.textContent.includes('카톡사진_5') };
    });
    assert(!r.hasImg && r.hasPh && r.name, '썸네일 없는 줄: ' + JSON.stringify(r));
  });
  await test('★ 썸네일이 곧 [크게 보기] 버튼 — 누르면 크게 보기가 열리고 체크는 안 바뀐다, 글자 [보기]는 없다', async () => {
    const r = await page.evaluate(() => {
      window.__lbCount = 0; const o = window.openLightbox; window.openLightbox = function () { window.__lbCount++; };
      const row = document.querySelector('#modalRoot .apt-unit-row'); const btn = row.querySelector('button.apt-unit-thumb-btn'); const cb = row.querySelector('input');
      const rect = btn.getBoundingClientRect(); const before = cb.checked;
      btn.click();
      const out = { w: Math.round(rect.width), h: Math.round(rect.height), label: btn.getAttribute('aria-label') || '', opened: window.__lbCount, toggled: cb.checked !== before,
        textView: [...document.querySelectorAll('#modalRoot .apt-unit-row button')].filter(b => /^보기$/.test((b.textContent || '').trim())).length,
        hasThumbInside: !!btn.querySelector('img.apt-unit-thumb, .apt-unit-thumb-none') };
      window.openLightbox = o; return out;
    });
    assert(r.w >= 44 && r.h >= 44, '썸네일 버튼이 44px 미만: ' + JSON.stringify(r));
    assert(/크게 보기/.test(r.label) && /카톡사진_/.test(r.label), '접근 이름에 파일명과 "크게 보기"가 있어야 한다: ' + r.label);
    assert(r.opened === 1, '누르면 크게 보기가 열려야 한다: ' + r.opened);
    assert(!r.toggled, '그림을 눌렀는데 체크가 바뀌었다 — 라벨 활성화가 새어 들어왔다');
    assert(r.textView === 0, '글자 [보기] 버튼이 남아 있다(줄마다 버튼 둘)');
    assert(r.hasThumbInside, '버튼 안에 썸네일/자리표시가 있어야 한다');
  });
  await test('★ 배정 위치 select 와 오류 줄은 sticky 버튼줄 안 — 목록 맨 위에서도 보인다', async () => {
    const r = await page.evaluate(() => {
      const modal = document.querySelector('#modalRoot .modal'); modal.scrollTop = 0;
      const foot = document.querySelector('#modalRoot .mfoot'); const sel = document.getElementById('aptUnitAssignTarget'); const issue = document.getElementById('aptUnitIssue');
      const inFoot = (el) => !!el && foot.contains(el);
      const rs = sel.getBoundingClientRect(), rf = foot.getBoundingClientRect();
      const lab = sel.labels && sel.labels.length ? sel.labels[0].textContent : '';
      return { selInFoot: inFoot(sel), issueInFoot: inFoot(issue), visible: rs.top >= 0 && rs.bottom <= innerHeight + 1, footBottom: Math.round(rf.bottom), vh: innerHeight,
        selW: Math.round(rs.width), footW: Math.round(rf.width), label: lab, scrollTop: modal.scrollTop, listLong: modal.scrollHeight > modal.clientHeight + 200 };
    });
    assert(r.listLong, '시드가 목록을 길게 만들지 못했다 — 이 검사가 헛돈다');
    assert(r.selInFoot && r.issueInFoot, 'select·오류 줄이 버튼줄 안에 있어야 한다: ' + JSON.stringify(r));
    assert(r.visible && r.scrollTop === 0, '목록 맨 위에서 select 가 화면에 보여야 한다(스크롤 없이): ' + JSON.stringify(r));
    assert(r.selW >= r.footW * 0.8, 'select 가 한 줄을 통째로 써야 버튼과 섞이지 않는다: ' + JSON.stringify(r));
    assert(/배정할 위치/.test(r.label), 'select 에 라벨이 붙어 있어야 한다(apartment-units controls 가 접근 이름을 본다): ' + r.label);
    // PC 폭에서는 모바일 미디어쿼리의 flex-wrap 이 없다 — 이 모달 자체가 wrap 을 켜지 않으면 select 가 버튼과 한 줄에 끼어 찌그러진다
    await page.setViewportSize({ width: 1280, height: 860 });
    const d = await page.evaluate(() => { const sel = document.getElementById('aptUnitAssignTarget').getBoundingClientRect();
      const btn = document.getElementById('aptUnitAssignSave').getBoundingClientRect(); return { selBottom: Math.round(sel.bottom), btnTop: Math.round(btn.top), selW: Math.round(sel.width) }; });
    await page.setViewportSize({ width: 360, height: 740 });
    assert(d.btnTop >= d.selBottom - 1, 'PC 폭에서 select 와 버튼이 같은 줄에 끼었다: ' + JSON.stringify(d));
  });
  await test('작업명 칸에 초점이 가면 두 줄짜리 버튼줄 위로 올라온다', async () => {
    const r = await page.evaluate(() => { const w = document.getElementById('aptUnitWork'); w.focus(); w.dispatchEvent(new Event('focus'));
      const rw = w.getBoundingClientRect(), rf = document.querySelector('#modalRoot .mfoot').getBoundingClientRect();
      return { wBottom: Math.round(rw.bottom), footTop: Math.round(rf.top), wired: typeof w.onfocus === 'function' }; });
    assert(r.wired, 'onfocus 가 배선되지 않았다');
    assert(r.wBottom <= r.footTop + 1, '작업명 칸이 버튼줄 뒤에 숨는다: ' + JSON.stringify(r));
  });
  await test('동·호수 관리 — 줄 전체가 탭 대상이고 44px 이상, 가로 넘침 없음', async () => {
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#modalRoot .apt-unit-row')].map(x => Math.round(x.getBoundingClientRect().height));
      const m = document.querySelector('#modalRoot .modal');
      return { minH: Math.min(...rows), over: m.scrollWidth - m.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth };
    });
    assert(r.minH >= 44 && r.over <= 1 && r.docOver <= 1, JSON.stringify(r));
    await closeAll();
  });
  await test('★ 미지정 화면에서 [전체 선택] 뒤 위치를 안 고르고 저장하면 — 쓰지 않고, 이유가 보이는 곳에 뜬다', async () => {
    // 그동안은 같은 자리로 30장을 다시 배정하는 유상 커밋이 돌고 "30장 배정 저장" 토스트가 떴다 — 아무것도 안 바뀐 가짜 성공.
    await page.evaluate(n => aptUnitView(n), N); await page.waitForSelector('#aptUnitSelectAll');
    const before = await page.evaluate(() => JSON.stringify(serializeData().files || serializeData()));
    let writes = 0;
    await page.evaluate(() => { window.__mutCount = 0; const o = window.aptUnitMutation; window.aptUnitMutation = function () { window.__mutCount++; return o.apply(this, arguments); }; });
    await page.evaluate(() => { document.getElementById('aptUnitSelectAll').click(); document.getElementById('aptUnitAssignSave').click(); });
    await page.waitForFunction(() => /같습니다/.test((document.getElementById('aptUnitIssue') || {}).textContent || ''), null, { timeout: 5000 })
      .catch(() => { throw new Error('같은 위치 재배정을 막지 않았다 — 오류 문구가 안 떴다: ' + JSON.stringify(document.getElementById && '')); });
    const r = await page.evaluate(() => {
      const issue = document.getElementById('aptUnitIssue'); const rect = issue.getBoundingClientRect();
      const modal = document.querySelector('#modalRoot .modal'); const mrect = modal.getBoundingClientRect();
      return { writes: window.__mutCount, toast: (document.getElementById('toast') || {}).textContent || '',
        visible: rect.top >= mrect.top - 1 && rect.bottom <= mrect.bottom + 1, stillOpen: !!document.getElementById('aptUnitSelectAll') };
    });
    writes = r.writes;
    assert(writes === 0, '막았어야 하는데 유상 커밋이 돌았다: ' + writes + '회');
    assert(!/장 동·호수 배정 저장/.test(r.toast), '가짜 성공 토스트가 떴다: ' + r.toast);
    assert(/같습니다/.test(r.toast), '이유가 토스트로도 보여야 한다(오류 줄은 목록 아래라 화면 밖일 수 있다): ' + r.toast);
    assert(r.visible, '오류 줄이 모달 보이는 영역 밖에 있다 — scrollIntoView 가 빠졌다');
    assert(r.stillOpen, '화면이 닫히거나 바뀌면 안 된다');
    const after = await page.evaluate(() => JSON.stringify(serializeData().files || serializeData()));
    assert(before === after, '쓰지 않았어야 하는데 자료가 달라졌다');
    await page.evaluate(() => { window.aptUnitMutation = window.aptUnitMutation; });
  });
  await test('위치를 고르면 예전처럼 저장된다 (4-1 이 정상 경로를 막지 않는다)', async () => {
    await page.evaluate(() => { document.getElementById('aptUnitAssignTarget').value = 'a1'; document.getElementById('aptUnitAssignSave').click(); });
    await page.waitForFunction(() => /배정 저장/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 8000 });
    const r = await page.evaluate(() => ({ n: state.files.filter(f => f._aptUnit && f._aptUnit.unitId === 'a1').length,
      toast: (document.getElementById('toast') || {}).textContent || '', title: (document.querySelector('#aptUnitPanel h3') || {}).textContent || '' }));
    assert(r.n === 12, '12장이 a1 에 배정돼야 한다: ' + r.n);
    // ★ 저장 뒤 그 호수 화면으로 튀지 않고 보던 미지정 목록에 머문다 — 다음 묶음을 바로 이어서 고를 수 있다
    assert(/미지정/.test(r.title), '저장 뒤 미지정 목록에 머물러야 한다: ' + r.title);
    assert(/12장 → 107동 1302호/.test(r.toast), '토스트가 어디로 갔는지 말해야 한다: ' + r.toast);
    await closeAll();
  });
  await test('★ 폰에서 PC 모드로 써도(모바일 모드 꺼짐) 버튼·× 는 44px — 화면 폭 규칙이지 설정 규칙이 아니다', async () => {
    await page.evaluate(() => { __mobileMode = false; applyMobileMode(); });
    await page.waitForFunction(() => !document.body.classList.contains('mobile-mode'));
    await page.evaluate(() => openModal('가상 PC모드', '<p>본문</p>', [{ label: '하나', cls: 'ghost', fn: closeModal }, { label: '둘', cls: 'clay', fn: closeModal }], true));
    await page.waitForSelector('#modalRoot .mfoot button');
    const s = await tapSizes();
    assert(s.some(x => /modal-close/.test(x.txt) || x.txt === '×' || x.txt === '✕'), '× 를 못 찾았다: ' + JSON.stringify(s));
    const bad = s.filter(x => x.w < 44 || x.h < 44);
    assert(bad.length === 0, 'PC 모드(폰 폭)에서 44px 미만 — ' + JSON.stringify(bad));
    await closeAll();
    await page.evaluate(() => { __mobileMode = true; applyMobileMode(); });
  });

  await test('썸네일을 넣어도 자료는 바뀌지 않는다', async () => {
    const r = await page.evaluate(n => {
      const a = JSON.parse(JSON.stringify(serializeData())); aptUnitView(n); closeModal(true);
      const b = JSON.parse(JSON.stringify(serializeData()));
      return Object.keys(a).filter(k => k !== 'savedAt' && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    }, N);
    assert(r.length === 0, '화면을 열었을 뿐인데 달라진 키: ' + r.join(', '));
  });
  await test('페이지 오류가 없다', async () => {
    const real = errs.filter(e => !/ResizeObserver|favicon/i.test(e));
    assert(real.length === 0, '오류: ' + real.join(' / '));
  });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (bad.length ? bad.length + '건 실패' : '전부 통과 (' + results.length + '건)'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
