/* apt-side-badge.e2e.js — 현장 목록(PC 사이드바 · 폰 현장 선택 시트)의 아파트 동·호수 표시 회귀
   대표 요청: "여기 프로젝트에 아파트 동호수 있는 것은 표시해줘"

   여기서 지키는 것 — 틀리면 화면이 거짓말을 하게 되는 것들:
     · 등록해 둔 동·호수만 센다. 이름에서 읽어낸 동·호수(aptNameParse)는 새어 나오지 않는다.
     · 공용부는 세대가 아니다. 합산하면 '지하주차장'이 한 세대가 된다.
     · 손상된 등록(중복 id·501곳 초과)을 '미등록'이나 '0곳'으로 조용히 감추지 않는다.
     · 배지가 활성 줄의 파란 배경 위로 올라가지 않는다(저대비).
     · 현장 하나 그릴 때마다 state.files·state.projects 를 다시 훑지 않는다.
     · 사이드바와 폰 시트가 같은 말을 한다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });

  /* 여덟 가지 상태를 한 번에 세운다. 이름은 화면에서 그대로 찾을 수 있게 지었다. */
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    const u = (id, dong, ho) => ({ id, type: 'unit', dong: String(dong), ho: String(ho), name: '', note: '' });
    const c = (id, name) => ({ id, type: 'common', dong: '', ho: '', name, note: '' });
    const base = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: ['도배'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '고객' }, archived: false }, extra || {});
    const many = []; for (let i = 1; i <= 501; i++) many.push(u('m' + i, 101, i));
    state.projects = [
      base('가상관리안함'),                                                   // aptUnits 키 자체가 없다
      base('가상세대셋', { aptUnits: [u('a1', 101, 201), u('a2', 101, 202), u('a3', 102, 301), c('a4', '지하주차장')] }),
      base('가상빈배열', { aptUnits: [] }),
      base('가상공용부만', { aptUnits: [c('b1', '경비실')] }),
      base('가상손상', { aptUnits: [u('d1', 101, 501), u('d1', 101, 502)] }),   // 같은 id 둘 — 전부 걸러진다
      base('가상초과', { aptUnits: many }),                                   // 500곳 상한 초과 — 통째로 버려진다
      base('가상동명', { aptUnits: [u('e1', 103, 101)] }),
      base('가상동명', { aptUnits: [u('e2', 103, 102)] }),                     // 같은 이름 둘
      base('가상보관', { archived: true, aptUnits: [u('f1', 104, 101), u('f1x', 104, 102)] }),
      base('가상이름에동호수 105동 602호'),                                    // 이름에만 있고 등록은 없다
    ];
    state.files = []; state.quotes = []; state.activeProject = null; state.dirty = false;
    render();
  });

  /* 현장 이름 -> 그 줄의 배지 정보. wrap 은 .proj-item 과 .stage-row 의 부모다. */
  const badges = () => page.evaluate(() => {
    const out = {};
    [...document.querySelectorAll('#projList .proj-item')].forEach(el => {
      const name = (el.textContent || '').replace(/\s+/g, ' ').replace(/^\s*📦\s*/, '').trim().replace(/\s+\d+$/, '');
      const wrap = el.parentElement;
      const b = wrap ? wrap.querySelector('.apt-badge') : null;
      out[name] = {
        text: b ? b.textContent : null,
        warn: !!(b && b.classList.contains('warn')),
        insideItem: !!el.querySelector('.apt-badge'),
        ariaHidden: b ? b.getAttribute('aria-hidden') : null,
        label: el.getAttribute('aria-label') || '',
        buttons: el.querySelectorAll('button,[tabindex]').length + (wrap ? wrap.querySelectorAll('button').length : 0),
      };
    });
    return out;
  });

  await test('동·호수를 안 쓰는 현장에는 아무것도 표시하지 않는다', async () => {
    await seed();
    const b = await badges();
    assert(b['가상관리안함'] && b['가상관리안함'].text === null, '관리 안 하는 현장에 배지가 붙었다: ' + JSON.stringify(b['가상관리안함']));
  });

  await test('★ 이름에만 동·호수가 있는 현장에는 표시하지 않는다 — 앱이 지어낸 값이 새어 나오면 안 된다', async () => {
    const b = await badges();
    const k = Object.keys(b).find(x => /가상이름에동호수/.test(x));
    assert(k, '그 현장이 목록에 없다: ' + Object.keys(b).join(','));
    assert(b[k].text === null, '이름에서 읽은 동·호수가 등록값처럼 표시됐다: ' + b[k].text);
  });

  await test('★ 공용부는 세대로 세지 않는다 — 세대 3 + 공용부 1', async () => {
    const b = await badges();
    assert(b['가상세대셋'].text === '🏢 동·호수 3곳 · 공용부 1곳', '실제: ' + JSON.stringify(b['가상세대셋'].text));
    assert(!b['가상세대셋'].warn, '정상인데 확인 필요로 표시됐다');
  });

  await test('★ 공용부만 있는 현장을 "동·호수 1곳"이라 말하지 않는다', async () => {
    const b = await badges();
    assert(b['가상공용부만'].text === '🏢 공용부 1곳', '실제: ' + JSON.stringify(b['가상공용부만'].text));
    assert(!/동·호수\s*1곳/.test(b['가상공용부만'].text), '공용부가 동·호수로 둔갑했다');
  });

  await test('관리를 켰지만 아직 등록이 없으면 "미등록"이라 말한다 — 배지가 사라지면 안 된다', async () => {
    const b = await badges();
    assert(b['가상빈배열'].text === '🏢 동·호수 미등록', '실제: ' + JSON.stringify(b['가상빈배열'].text));
  });

  await test('★ 손상된 등록을 "미등록"이나 "0곳"으로 감추지 않는다', async () => {
    const b = await badges();
    for (const n of ['가상손상', '가상초과']) {
      assert(b[n].text === '🏢 동·호수 확인 필요', n + ' 실제: ' + JSON.stringify(b[n].text));
      assert(b[n].warn, n + ' 는 굵게(확인 필요) 표시되어야 한다');
      assert(!/미등록|0곳/.test(b[n].text), n + ' 가 없는 것처럼 표시됐다');
    }
  });

  await test('이름이 겹쳐 관리 화면을 열 수 없는 현장은 그 사실을 말한다', async () => {
    const b = await badges();
    assert(b['가상동명'].text === '🏢 이름 중복 · 확인 필요', '실제: ' + JSON.stringify(b['가상동명'].text));
    assert(b['가상동명'].warn, '굵게 표시되어야 한다');
  });

  await test('★ 배지는 .proj-item 밖(.stage-row)에 있어 활성 줄의 파란 배경을 타지 않는다', async () => {
    const r = await page.evaluate(() => {
      const pick = () => [...document.querySelectorAll('#projList .proj-item')].find(el => /가상세대셋/.test(el.textContent));
      const colorOf = () => { const w = pick().parentElement; const b = w.querySelector('.apt-badge'); return getComputedStyle(b).color; };
      const off = colorOf(), inside0 = !!pick().querySelector('.apt-badge');
      state.activeProject = '가상세대셋'; render();
      const el = pick();
      return { off, on: colorOf(), inside0, inside1: !!el.querySelector('.apt-badge'), active: el.classList.contains('active') };
    });
    assert(r.active, '활성 줄이 만들어지지 않았다');
    assert(!r.inside0 && !r.inside1, '배지가 .proj-item 안에 들어갔다 — 활성 줄에서 파란 배경 위에 얹힌다');
    assert(r.off === r.on, '활성 여부에 따라 배지 색이 달라진다: ' + r.off + ' vs ' + r.on);
  });

  await test('★ 스크린리더가 읽는 이름에도 동·호수가 들어간다 (배지 자체는 aria-hidden)', async () => {
    const b = await badges();
    assert(/현장 열기 · 동·호수 3곳 · 공용부 1곳$/.test(b['가상세대셋'].label), 'aria-label 실제: ' + b['가상세대셋'].label);
    assert(b['가상세대셋'].ariaHidden === 'true', '배지 span 이 aria-hidden 이어야 중복 낭독이 없다');
    assert(!/🏢/.test(b['가상세대셋'].label), 'aria-label 에 이모지를 넣으면 "office building"으로 읽힌다');
    assert(b['가상관리안함'].label === '가상관리안함 현장 열기', '배지 없는 줄의 라벨이 바뀌었다: ' + b['가상관리안함'].label);
  });

  await test('★ 배지를 버튼으로 만들지 않는다 — 줄 전체가 이미 버튼이다', async () => {
    const b = await badges();
    assert(b['가상세대셋'].buttons === 0, '줄 안에 버튼·탭 정지점이 생겼다: ' + b['가상세대셋'].buttons);
  });

  await test('★ 현장 하나 그릴 때마다 목록을 다시 훑지 않는다', async () => {
    const r = await page.evaluate(() => {
      const n = { dupe: 0, groups: 0, photos: 0 };
      const o1 = window.aptDupeNames, o2 = window.aptUnitPhotoGroups, o3 = window.aptUnitPhotos;
      window.aptDupeNames = function () { n.dupe++; return o1.apply(this, arguments); };
      window.aptUnitPhotoGroups = function () { n.groups++; return o2.apply(this, arguments); };
      window.aptUnitPhotos = function () { n.photos++; return o3.apply(this, arguments); };
      try { render(); } finally { window.aptDupeNames = o1; window.aptUnitPhotoGroups = o2; window.aptUnitPhotos = o3; }
      return { n, projects: state.projects.filter(p => !p.archived).length };
    });
    assert(r.projects >= 8, '시드가 모자라 이 검사가 헛돈다: ' + r.projects);
    assert(r.n.dupe === 1, 'render() 1회에 aptDupeNames 가 ' + r.n.dupe + '번 불렸다 (현장 수만큼 부르면 현장²)');
    assert(r.n.groups === 0 && r.n.photos === 0, '사진 전수 스캔이 목록 그리기에 섞였다: ' + JSON.stringify(r.n));
  });

  await test('보관 현장을 펼쳐도 배지가 정상이다', async () => {
    const r = await page.evaluate(() => {
      __showArchived = true; render();
      const el = [...document.querySelectorAll('#projList .proj-item')].find(x => /가상보관/.test(x.textContent));
      const b = el && el.parentElement.querySelector('.apt-badge');
      return { has: !!el, text: b ? b.textContent : null, dim: el ? el.style.opacity : '' };
    });
    assert(r.has && r.text === '🏢 동·호수 2곳', '보관 현장 배지: ' + JSON.stringify(r));
    assert(r.dim === '0.55', '보관 현장은 흐리게 그대로여야 한다: ' + r.dim);
  });

  await test('★ 사이드바와 폰 현장 선택 시트가 같은 말을 한다', async () => {
    const r = await page.evaluate(() => {
      const out = {};
      ['가상세대셋', '가상공용부만', '가상빈배열', '가상손상'].forEach(n => {
        const p = state.projects.find(x => x.name === n);
        out[n] = aptUnitBadge(p, aptDupeNames()).text;
      });
      const side = {};
      [...document.querySelectorAll('#projList .proj-item')].forEach(el => {
        const b = el.parentElement.querySelector('.apt-badge');
        if (b) side[(el.textContent || '').replace(/\s+/g, ' ').replace(/^\s*📦\s*/, '').trim().replace(/\s+\d+$/, '')] = b.textContent.replace('🏢 ', '');
      });
      return { fn: out, side };
    });
    for (const n of Object.keys(r.fn)) assert(r.side[n] === r.fn[n], n + ' 사이드바="' + r.side[n] + '" 함수="' + r.fn[n] + '"');
    // 폰 시트가 같은 함수를 쓰는지 소스로 확인한다 — 한쪽만 고치면 기기마다 표기가 갈린다
    const usesShared = await page.evaluate(() => /badge\s*=\s*aptUnitBadge\(p,__dupeSheet\)/.test(String(openProjectSheet)));
    assert(usesShared, '폰 현장 선택 시트가 공용 함수를 쓰지 않는다 — 기기마다 표기가 갈린다');
  });

  await test('폰 시트에서 현장 이름 칸은 그대로 두고 아래 줄 맨 뒤에만 붙는다', async () => {
    const r = await page.evaluate(() => {
      const src = String(openProjectSheet);
      const m = src.match(/class="ps-meta">([^<]*)</);
      const nameOk = /class="ps-name">\$\{escapeHtml\(p\.name\)\}<\/span>/.test(src);
      return { meta: m ? m[1] : '', nameOk };
    });
    assert(r.nameOk, '현장 이름 칸에 무언가 끼어들었다 — mobile-friendly-ui 가 정확일치로 본다');
    assert(/자료 \$\{n\}개\$\{badge\?/.test(r.meta), "배지는 '자료 N개' 뒤에만 붙어야 한다: " + r.meta);
  });

  await test('★ 사이드바가 가로로 넘치지 않는다 (500곳짜리 긴 배지에서도)', async () => {
    const r = await page.evaluate(() => {
      const u = (id, dong, ho) => ({ id, type: 'unit', dong: String(dong), ho: String(ho), name: '', note: '' });
      const c = (id, name) => ({ id, type: 'common', dong: '', ho: '', name, note: '' });
      const big = []; for (let i = 1; i <= 400; i++) big.push(u('g' + i, 101, i));
      for (let i = 1; i <= 100; i++) big.push(c('h' + i, '공용부' + i));
      state.projects.push({ name: '가상아주긴배지현장이름도제법길게', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false, aptUnits: big });
      render();
      const el = [...document.querySelectorAll('#projList .proj-item')].find(x => /가상아주긴배지/.test(x.textContent));
      const b = el.parentElement.querySelector('.apt-badge');
      // ★ #projList 가 overflow-y:auto 라 가로 넘침을 **스스로 삼킨다** — 문서·aside 만 보면
      //   배지가 안 줄어도 0 으로 나온다(min-width:0 을 빼는 변이를 이 검사가 놓쳤다).
      //   실제로 가로 스크롤바가 생기는 그 요소를 직접 재고, 배지 폭도 함께 본다.
      const pl = document.getElementById('projList');
      return { text: b ? b.textContent : null,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sideOver: (() => { const a = document.querySelector('aside'); return a ? a.scrollWidth - a.clientWidth : 0; })(),
        listOver: pl.scrollWidth - pl.clientWidth,
        badgeW: b ? Math.round(b.getBoundingClientRect().width) : 0,
        listW: pl.clientWidth };
    });
    assert(r.text === '🏢 동·호수 400곳 · 공용부 100곳', '긴 배지 실제: ' + JSON.stringify(r.text));
    assert(r.over <= 1, '문서에 가로 스크롤이 생겼다: ' + r.over);
    assert(r.sideOver <= 1, '사이드바가 가로로 넘쳤다: ' + r.sideOver);
    assert(r.listOver <= 1, '현장 목록이 가로로 넘쳤다(배지가 안 줄어든다): ' + r.listOver + 'px · 배지 ' + r.badgeW + 'px / 목록 ' + r.listW + 'px');
    // 지금 폭(목록 약 229px)에서는 가장 긴 배지도 약 150px 라 줄어들 일이 없다 —
    // 이 단정만으로는 '좁아지면 배지가 먼저 줄어든다'는 방어가 검사되지 않는다. 그건 아래에서 따로 본다.
  });

  await test('★ 목록이 좁아지면 배지가 먼저 줄어든다 — 줄이 밀려 나가지 않는다', async () => {
    // 지금 사이드바 폭에서는 가장 긴 배지도 남는다. 그래서 '좁아졌을 때'를 직접 만들어
    // 배지의 줄어드는 방어(min-width:0 · overflow:hidden · ellipsis)가 살아 있는지 본다.
    // 이 방어가 없으면 글자 크기를 키운 기기나 더 좁은 화면에서 현장 목록이 가로로 새어 나간다.
    const r = await page.evaluate(() => {
      const pl = document.getElementById('projList');
      const el = [...pl.querySelectorAll('.proj-item')].find(x => /가상아주긴배지/.test(x.textContent));
      const sr = el.parentElement.querySelector('.stage-row');
      const b = sr.querySelector('.apt-badge');
      const orig = pl.style.width;
      pl.style.width = '120px';
      const rowW = Math.round(sr.getBoundingClientRect().width);
      const badgeW = Math.round(b.getBoundingClientRect().width);
      const listW = pl.clientWidth;
      const clipped = b.scrollWidth > b.clientWidth + 1;   // 잘려서 … 로 끝나고 있는가
      // ★ .stage-row 는 블록 레벨이라 getBoundingClientRect().width 가 늘 부모 폭이다 —
      //   안쪽 내용이 삐져나가도 그 값은 꿈쩍하지 않는다. 넘침은 scrollWidth 로만 보인다.
      const over = sr.scrollWidth - sr.clientWidth;
      pl.style.width = orig;
      return { rowW, badgeW, listW, clipped, over };
    });
    assert(r.over <= 1, '좁아졌는데 줄 안 내용이 밖으로 삐져나갔다: ' + r.over + 'px (목록 ' + r.listW + 'px · 배지 ' + r.badgeW + 'px)');
    assert(r.clipped, '배지가 줄어들지 않고 그대로다 — 잘림(…) 방어가 빠졌다');
  });

  await test('여러 번 다시 그려도 자료가 바뀌지 않는다', async () => {
    // '뭔가 달라졌다'만 말하는 검사는 고칠 수가 없다 — 어느 칸이 움직였는지 이름을 말하게 한다
    const r = await page.evaluate(() => {
      const snap = () => JSON.parse(JSON.stringify(serializeData()));
      const a = snap();
      for (let i = 0; i < 8; i++) render();
      const b = snap();
      const changed = [];
      // savedAt 은 내려받는 그 순간을 찍는 값이라 state 가 아니다 — 두 번 부르면 당연히 다르다
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => k !== 'savedAt');
      keys.forEach(k => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k); });
      const detail = changed.map(k => {
        const x = JSON.stringify(a[k] === undefined ? null : a[k]), y = JSON.stringify(b[k] === undefined ? null : b[k]);
        return k + ': ' + String(x).slice(0, 180) + '  ->  ' + String(y).slice(0, 180);
      });
      return { changed, detail };
    });
    assert(r.changed.length === 0, '목록을 다시 그렸을 뿐인데 자료가 달라졌다:\n      ' + r.detail.join('\n      '));
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
