/* v415: 인스타 기본 원고에는 회사 번호를 넣지 않고, 수동 추가는 기록을 막지 않고 알린다.
   합성 자료/격리 프로필만 사용한다. HJ_V415_BASELINE=<ref>는 이전 index.html 응답으로
   INSTA_DEFAULT_HAS_NO_COMPANY_TEL 단언에서 실패해야 하는 회귀 증거용 모드다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const BASE = 'http://127.0.0.1:8299';
const APP = BASE + '/index.html';
const PROJECT = 'TEST_INSTA_PROJECT';
const NOTICE = '인스타에는 전화번호를 넣지 않습니다 — 문의는 DM·프로필 링크';
const WARNING = '인스타 원고에 전화번호가 있어요 — 대표 지시: 인스타에는 미기재';
const CONTACT = '상담은 DM 또는 프로필 링크로 주세요.';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage(), errors = [], network = { blocked: 0, nonRead: 0 };
  let passed = 0;
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.dismiss());
  await ctx.route('**/*', route => {
    const request = route.request(), read = ['GET', 'HEAD'].includes(request.method());
    if (read && new URL(request.url()).origin === BASE) return route.continue();
    network.blocked++; if (!read) network.nonRead++;
    return route.abort('blockedbyclient');
  });
  if (process.env.HJ_V415_BASELINE) {
    const source = execFileSync('git', ['show', process.env.HJ_V415_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    await page.route(APP, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: source }));
  }
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0');
    window.__v415SideEffects = { opened: 0, copied: 0, shared: 0 };
    window.open = () => { window.__v415SideEffects.opened++; return null; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { window.__v415SideEffects.copied++; } } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__v415SideEffects.shared++; } });
  });

  async function seed() {
    await page.evaluate(name => {
      closeModal(true);
      state._demo = false; state.projects = [{ name, stage: 3, doneAt: localDate(), received: 0, phases: ['욕실'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: 'TEST_PRIVATE_CUSTOMER', phone: '010-0000-0000', addr: '' } }];
      state.files = []; state.quotes = []; state.notes = []; state.schedule = []; state.satisfaction = [];
      state.adPosts = []; state.payLog = []; state.asLog = []; state.contacts = [];
      state.activeProject = null; state.tab = 'ads'; render(); window.__v415Toasts.length = 0;
    }, PROJECT);
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  async function open(ch = 'instagram') {
    await page.evaluate(({ ch, name }) => adDraftOpen(ch, name), { ch, name: PROJECT });
    await page.locator('#adDraftTa').waitFor({ state: 'visible' });
  }
  async function screenshot(name) {
    if (!process.env.HJ_V415_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V415_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V415_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  async function record() {
    const before = await page.evaluate(() => state.adPosts.length);
    await page.locator('#modalRoot .mfoot button').filter({ hasText: /^게시 기록에 추가$/ }).click();
    await page.waitForFunction(before => state.adPosts.length === before + 1, before);
    return page.evaluate(() => ({ record: state.adPosts[state.adPosts.length - 1], toast: document.getElementById('toast').textContent, toasts: window.__v415Toasts.slice() }));
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

  try {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof adDraftText === 'function' && ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'].every(key => !!window[key]));
    await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]); });
    await page.evaluate(() => {
      const original = window.toast; window.__v415Toasts = [];
      window.toast = function (message) { window.__v415Toasts.push(String(message)); return original.apply(this, arguments); };
    });

    await test('① 인스타 본문·제목·해시태그에서 회사 번호 제외, DM·프로필 링크 안내', async () => {
      await seed();
      const r = await page.evaluate(name => {
        const f = adProjFacts(name), d = adDraftText('instagram', f);
        return { draft: d.title + '\n' + d.body, tags: adHashtags(f), digits: COMPANY.tel.replace(/\D/g, '') };
      }, PROJECT);
      assert(!r.draft.replace(/\D/g, '').includes(r.digits), 'INSTA_DEFAULT_HAS_NO_COMPANY_TEL');
      assert(!r.tags.replace(/\D/g, '').includes(r.digits), 'INSTA_HASHTAGS_HAS_NO_COMPANY_TEL');
      assert(r.draft.includes(CONTACT), 'INSTA_DM_PROFILE_CONTACT');
      assert(!r.draft.includes('TEST_PRIVATE_CUSTOMER') && !r.draft.includes('010-0000-0000'), 'INSTA_PRIVATE_FIXTURE_NOT_EXPOSED');
    });
    await test('② 다른 채널의 회사 전화 안내와 웹 사례 재료 유지', async () => {
      const r = await page.evaluate(name => {
        const f = adProjFacts(name), channels = ['threads', 'blog', 'meta', 'daangn', 'naverplace', 'kakaomap'];
        return { drafts: channels.map(ch => ({ ch, draft: adDraftText(ch, f).body })), web: adDraftText('web', f).body, digits: COMPANY.tel.replace(/\D/g, '') };
      }, PROJECT);
      for (const d of r.drafts) { assert(d.draft.replace(/\D/g, '').includes(r.digits), 'OTHER_CHANNEL_KEEPS_TEL_' + d.ch); assert(!d.draft.includes(CONTACT), 'OTHER_CHANNEL_KEEPS_CONTACT_COPY_' + d.ch); }
      assert(r.web.includes('[만물 웹 사례 재료]') && r.web.includes('정리·청소 사진 빼기'), 'WEB_CASE_MATERIAL_UNCHANGED');
    });
    await test('③ 전화 판독은 하이픈·공백·괄호·숫자전용, 무관 번호는 제외', async () => {
      const r = await page.evaluate(() => {
        const digits = COMPANY.tel.replace(/\D/g, ''), a = digits.slice(0, 3), b = digits.slice(3, -4), c = digits.slice(-4);
        const variants = [COMPANY.tel, digits, [a, b, c].join(' '), '(' + a + ') ' + b + '-' + c];
        const other = digits.slice(0, -1) + ((Number(digits.slice(-1)) + 1) % 10);
        return { enabled: HJ_INSTA_NO_TEL, variants: variants.map(value => hjAdTextHasTel('문의 ' + value)), safe: [null, undefined, '', 'DM 또는 프로필 링크', other].map(value => hjAdTextHasTel(value)) };
      });
      assert.equal(r.enabled, true, 'INSTA_RULE_ENABLED'); assert(r.variants.every(Boolean), 'COMPANY_TEL_FORMATS_RECOGNIZED'); assert(r.safe.every(value => !value), 'UNRELATED_TEXT_HAS_NO_COMPANY_TEL');
    });
    await test('④ 원고 창 안내·채널 전환·읽기 전용·390px', async () => {
      await seed();
      const before = await page.evaluate(() => JSON.stringify({ projects: state.projects, files: state.files, quotes: state.quotes, adPosts: state.adPosts }));
      await open();
      const notice = page.locator('#adDraftInstaNotice');
      assert(await notice.isVisible(), 'INSTA_NOTICE_VISIBLE'); assert.equal((await notice.textContent()).trim(), NOTICE);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'INSTA_390_NO_OVERFLOW');
      if(process.env.HJ_V415_SHOTS){await notice.scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));}
      await screenshot('v415-instagram-390');
      await page.locator('[data-draftch="threads"]').click(); assert(await notice.isHidden(), 'THREADS_NOTICE_HIDDEN');
      await page.locator('[data-draftch="instagram"]').click(); assert(await notice.isVisible(), 'INSTA_NOTICE_RESTORED');
      for (const button of await page.locator('[data-draftch]').all()) assert((await button.boundingBox()).height >= 44, 'CHANNEL_TOUCH_HEIGHT_44');
      const after = await page.evaluate(() => JSON.stringify({ projects: state.projects, files: state.files, quotes: state.quotes, adPosts: state.adPosts }));
      assert.equal(after, before, 'OPEN_SWITCH_DOES_NOT_WRITE_BUSINESS_DATA');
    });
    await test('⑤ 본문에 번호를 추가해도 기록은 저장하고 경고를 한 번 최종 표시', async () => {
      const body = await page.locator('#adDraftTa').inputValue(), tel = await page.evaluate(() => COMPANY.tel);
      await page.locator('#adDraftTitle').fill('TEST_INSTA_RECORD'); await page.locator('#adDraftTa').fill(body + '\n문의 ' + tel);
      const r = await record();
      assert.equal(r.record.ch, 'instagram'); assert.equal(r.record.project, PROJECT); assert.equal(r.record.title, 'TEST_INSTA_RECORD'); assert.equal(r.record.url, ''); assert.equal(r.record.memo, '원고 작성');
      assert.equal(r.toast, WARNING, 'INSTA_WARNING_IS_FINAL_TOAST'); assert.equal(r.toasts.filter(value => value === WARNING).length, 1, 'INSTA_WARNING_ONCE_PER_RECORD');
      await screenshot('v415-manual-tel-warning-390');
    });
    await test('⑥ 제목의 숫자전용 회사 번호도 알리며 게시 기록은 남김', async () => {
      await seed(); await open();
      await page.locator('#adDraftTitle').fill('TEST_TITLE ' + await page.evaluate(() => COMPANY.tel.replace(/\D/g, '')));
      const r = await record(); assert.equal(r.record.ch, 'instagram'); assert.equal(r.toast, WARNING); assert.equal(r.toasts.filter(value => value === WARNING).length, 1);
    });
    await test('⑦ 전화 없는 인스타 및 전화 있는 스레드 기록에는 경고 없음', async () => {
      for (const ch of ['instagram', 'threads']) {
        await seed(); await open(ch); const r = await record();
        assert.equal(r.record.ch, ch); assert(!r.toasts.includes(WARNING), 'NO_UNNECESSARY_WARNING_' + ch);
        assert.equal(r.toast, '기록 저장됨 — 게시 후 링크를 채워두면 좋아요');
      }
    });
    await test('⑧ 외부 열기·복사·공유·서버 쓰기 없이 합성 기록만 검사', async () => {
      assert.deepEqual(await page.evaluate(() => window.__v415SideEffects), { opened: 0, copied: 0, shared: 0 });
      assert.equal(network.nonRead, 0, 'NO_NON_READ_NETWORK_ATTEMPT'); assert.deepEqual(errors, [], 'NO_PAGE_ERRORS');
    });
    console.log('instanotel-v415: ' + passed + '/' + passed + ' passed, pageerrors=' + errors.length);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
