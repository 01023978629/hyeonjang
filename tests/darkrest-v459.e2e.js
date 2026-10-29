/* v459 어두운 화면 남은 것(리허설 R7 v458 판 8건) + 밝은 화면 '미연결' — 합성 자료만, 외부 쓰기 0.
   어두운 화면에서 🦙 Llama 코드 칩·키 배지 · 🌦 계절 캠페인 규칙 상자 · 🌐 팀 웹 연결 안내 · 📍 사진 배정 점검 안내 · 🤖 AI 비서 내 말풍선 · 📖 안내 카드 제목 —
   글자/배경 4.5:1 이상(DARK_REST_READABLE). 밝은 화면 💾 백업 센터 '미연결'·승인 대기 칩도 4.5:1. 비활성(disabled) 단추는 세지 않는다.
   HJ_V459_BASELINE=<commit> 은 DARK_REST_READABLE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_K1 둔산 욕실';
const html = process.env.HJ_V459_BASELINE ? execFileSync('git', ['show', process.env.HJ_V459_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c); if (!m) return null; if (m[4] !== undefined && Number(m[4]) === 0) return null; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return 21; const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + 0.05) / (l + 0.05); };

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async P => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = false; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    state.projects = [{ name: P, kind: 'interior', stage: 2, phases: ['타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-5901', addr: '대전 서구 둔산동 1-1' } }];
    state.contacts = [{ id: 'TEST_C1', name: '박고객', phone: '010-0000-5902', consent: true, lastAt: hjAddDays(localDate(), -40) }];
    state.activeProject = P; state.tab = 'dashboard'; render();
  }, P);
  async function test(name, fn) { await fn(); passed++; console.log('PASS darkrest-v459 ' + name); }
  const close = () => page.evaluate(() => { closeModal(true); const s = document.getElementById('aiSheet'); if (s && typeof aiAgentClose === 'function') try { aiAgentClose(); } catch (_) {} });
  const sample = (sel, max) => page.evaluate(([sel, max]) => {
    const bgOf = el => { let e = el; while (e && e !== document.documentElement) { const cs = getComputedStyle(e), bg = cs.backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'image'; e = e.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const roots = [...document.querySelectorAll(sel)]; let node;
    while ((node = walker.nextNode()) && out.length < max) {
      const t = (node.nodeValue || '').trim(); if (t.length < 2) continue; const el = node.parentElement; if (!el || !roots.some(r => r.contains(el))) continue;
      if (el.closest('button:disabled,[disabled]')) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      out.push({ t: t.slice(0, 24), c: cs.color, bg: bgOf(el), el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(/\s+/).join('.') : '') });
    }
    return out;
  }, [sel, max || 400]);
  const low = rows => rows.filter(r => r.bg !== 'image' && !/^[\s\W\d]+$/.test(r.t) && contrast(r.c, r.bg) < 4.5).map(r => r.el + ' "' + r.t + '" ' + r.c + ' on ' + r.bg + ' ' + contrast(r.c, r.bg).toFixed(2));
  const dark = on => page.evaluate(on => { if (document.body.classList.contains('dark') !== on) document.getElementById('btnDark').click(); return document.body.classList.contains('dark'); }, on);

  await test('① 어두운 화면: Llama 코드 칩·키 배지 · 계절 규칙 상자 · 팀 웹 연결 안내 · 사진 배정 점검 · 안내 카드 제목 (DARK_REST_READABLE)', async () => {
    assert.equal(await dark(true), true);
    const screens = [['llamaSetup', '#modalRoot .mbody', /ollama run/], ['hjSeasonView', '#modalRoot [data-season-rule]', /광고 문자 규칙/], ['webWorkCenterOpen', '#modalRoot .mbody', /자동으로 읽지 않습니다/], ['photoAssignmentAudit', '#modalRoot .mbody', /어긋난 사진이 없습니다|사진/], ['hjGuideHome', '#modalRoot .guideCard', /안전·설정/]];
    for (const [fn, sel, must] of screens) {
      await close(); await page.evaluate(f => window[f](), fn); await page.locator('#modalRoot .modal').waitFor(); await page.waitForTimeout(150);
      const rows = await sample(sel, 600);
      assert(rows.some(r => must.test(r.t)) || rows.length > 3, fn + ' rendered text ' + rows.length);
      assert.deepEqual(low(rows), [], 'DARK_REST_READABLE ' + fn);
    }
    await close();
  });

  await test('② 어두운 화면: 🤖 AI 비서 내 말풍선 흰 글씨가 읽힌다', async () => {
    assert.equal(await dark(true), true);
    await page.evaluate(() => { aiHelper(); }); await page.locator('#aiMsgs').waitFor();
    await page.evaluate(() => aiMsg('u', '이번달 얼마 남았어'));
    const rows = await sample('#aiMsgs .ai-b.u', 20);
    assert(rows.length >= 1, 'user bubble rendered'); assert.deepEqual(low(rows), [], 'DARK_REST_READABLE ai bubble');
    const bubble = await page.evaluate(() => { const b = document.querySelector('#aiMsgs .ai-b.u'); const cs = getComputedStyle(b); return { bg: cs.backgroundColor, c: cs.color }; });
    assert(contrast(bubble.c, bubble.bg) >= 4.5, JSON.stringify(bubble));
    await close();
  });

  await test('③ 밝은 화면: 💾 백업 센터 "미연결" · 승인 대기 칩 4.5:1 · 밝은 화면 규칙은 그대로', async () => {
    assert.equal(await dark(false), false);
    await page.evaluate(() => backupCenter()); await page.locator('#modalRoot .modal').waitFor(); await page.waitForTimeout(150);
    const rows = await sample('#modalRoot .mbody', 500);
    assert(rows.some(r => /미연결/.test(r.t)), '미연결 rendered'); assert.deepEqual(low(rows), [], 'LIGHT backup center');
    await close();
    const light = await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('style', 'background:#dbeafe;color:#166534'); document.body.appendChild(d); const cs = getComputedStyle(d); const r = { bg: cs.backgroundColor, c: cs.color }; d.remove(); return r; });
    assert.deepEqual(light, { bg: 'rgb(219, 234, 254)', c: 'rgb(22, 101, 52)' }, 'light mode keeps inline colors');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`darkrest-v459: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL darkrest-v459', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
