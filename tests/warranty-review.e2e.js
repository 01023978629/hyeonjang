/* warranty-review.e2e.js — 🎉 준공 관리(⭐ 리뷰 요청 + 🛡 보증 등록) 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   실발신 없음 — hjSendSms 후킹으로 딥링크 의도(phone·text)만 캡처(location 미이동). */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

const RAW_PHONE = '01033338888';   // 준공 현장 고객 전화 원문 — 딥링크 외 화면·이력 노출 금지
const REVIEW_URL = 'https://naver.me/REVIEWTEST';
const DONE_AT = '2026-07-01';

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // hjSendSms 후킹: 실발신 대신 {phone,text} 캡처(전화 원문이 딥링크 빌더에만 도달하는지 검증)
  await page.evaluate(() => {
    window.__sms = [];
    window.hjSendSms = function (phone, text) { window.__sms.push({ phone: String(phone || ''), text: String(text || '') }); };
  });

  // 공통 시드: 준공(stage=3, doneAt) 현장 + 비준공(stage=1) 현장
  async function seed() {
    await page.evaluate(({ ph, done }) => {
      window.__sms = [];
      state.notes = [];
      state.projects = [
        { name: '준공현장 A', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박준공', phone: ph, addr: '대전 중구' }, doneAt: done, archived: false },
        { name: '진행현장 B', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이진행', phone: '01011112222', addr: '대전 서구' }, archived: false }
      ];
      state.files = [];
      state.activeProject = null; state.tab = 'dashboard'; render();
    }, { ph: RAW_PHONE, done: DONE_AT });
  }
  const clearModal = async () => page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  const openDetail = async (name) => { await clearModal(); await page.evaluate((n) => { state.activeProject = n; state.tab = 'project'; window.__projView = null; render(); }, name); };

  // 1) 준공 현장엔 버튼 노출, 비준공 현장엔 미노출/흐리게
  await test('준공 현장 상세에 [⭐ 리뷰 요청]·[🛡 보증 시작] 노출', async () => {
    await seed(); await openDetail('준공현장 A'); await page.waitForTimeout(200);
    const has = await page.evaluate(() => ({
      card: !!document.querySelector('[data-donecard="1"]'),
      review: !!document.querySelector('[data-reviewreqp]'),
      warranty: !!document.querySelector('[data-warrantystart]')
    }));
    assert(has.card, '준공관리 카드(active) 존재');
    assert(has.review, '리뷰 요청 버튼 존재');
    assert(has.warranty, '보증 시작 버튼 존재');
  });
  await test('비준공 현장엔 버튼 미노출 + 카드 흐리게', async () => {
    await openDetail('진행현장 B'); await page.waitForTimeout(200);
    const st = await page.evaluate(() => {
      const dim = document.querySelector('[data-donecard="0"]');
      return { dim: !!dim, opacity: dim ? dim.getAttribute('style') : '', review: !!document.querySelector('[data-reviewreqp]'), warranty: !!document.querySelector('[data-warrantystart]') };
    });
    assert(st.dim, '비준공 카드(dim) 존재');
    assert(/opacity/.test(st.opacity), '흐리게(opacity) 적용');
    assert(!st.review && !st.warranty, '비준공엔 버튼 미노출');
  });

  // 2) 리뷰 요청 — 링크 설정 시 딥링크에 현장·링크 포함, 전화 원문은 딥링크에만, reviewRequestedAt 기록·마스킹
  await test('리뷰 링크 설정 → idb 왕복 저장', async () => {
    await page.evaluate(async (u) => { openGdriveSetup(); const el = document.querySelector('#rvUrl'); el.value = u; document.querySelector('#rvSave').click(); }, REVIEW_URL);
    await page.waitForTimeout(250);
    const rt = await page.evaluate(async () => ({ mem: __reviewUrl, idb: await idbGet('review_url') }));
    await clearModal();
    assert(rt.mem === REVIEW_URL, 'mem 저장: ' + rt.mem);
    assert(rt.idb === REVIEW_URL, 'idb 왕복: ' + rt.idb);
  });
  await test('[⭐ 리뷰 요청] → 딥링크에 현장·리뷰링크 포함, 전화 원문은 딥링크에만', async () => {
    await seed(); await openDetail('준공현장 A'); await page.waitForTimeout(150);
    await page.click('[data-reviewreqp]'); await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({
      sms: window.__sms[0],
      reqAt: (state.projects.find(p => p.name === '준공현장 A') || {}).reviewRequestedAt,
      cardHtml: (document.querySelector('[data-donecard]') || {}).outerHTML || '',
      noteText: (state.notes || []).map(n => n.text).join('\n')
    }));
    assert(r.sms, 'hjSendSms 호출됨');
    assert(r.sms.phone === RAW_PHONE, '딥링크 phone=원문: ' + r.sms.phone);
    assert(r.sms.text.includes('준공현장 A'), '문안에 현장명 포함');
    assert(r.sms.text.includes(REVIEW_URL), '문안에 리뷰 링크 포함');
    assert(typeof r.reqAt === 'string' && /\d{4}-\d\d-\d\dT/.test(r.reqAt), 'reviewRequestedAt(ISO) 기록: ' + r.reqAt);
    assert(!r.cardHtml.includes(RAW_PHONE), '준공관리 카드에 전화 원문 미노출');
    assert(!r.noteText.includes(RAW_PHONE), '이력(노트)에 전화 원문 미노출');
    // 재진입 시 "요청함" 표시(중복 방지)
    const reqd = await page.evaluate(() => (document.querySelector('[data-donecard]') || {}).outerHTML.includes('요청함'));
    assert(reqd, '리뷰 요청 후 "요청함" 표시');
  });
  await test('리뷰 링크 미설정 시 문안에서 링크 줄 생략', async () => {
    // 설정 UI로 리뷰 링크 비우기(실제 저장 경로 — __reviewUrl은 let이라 UI 통해서만 갱신)
    await page.evaluate(() => { openGdriveSetup(); const el = document.querySelector('#rvUrl'); el.value = ''; document.querySelector('#rvSave').click(); });
    await page.waitForTimeout(200); await clearModal();
    const cleared = await page.evaluate(() => __reviewUrl);
    assert(cleared === '', '리뷰 링크 비워짐: ' + JSON.stringify(cleared));
    await seed(); await openDetail('준공현장 A'); await page.waitForTimeout(150);
    await page.click('[data-reviewreqp]'); await page.waitForTimeout(200);
    const t = await page.evaluate(() => window.__sms[0].text);
    assert(t.includes('준공현장 A'), '현장명은 여전히 포함');
    assert(!/https?:\/\//.test(t), '링크 미설정 시 링크 줄 생략: ' + JSON.stringify(t));
  });

  // 3) 보증 시작 — 방수 2년 등 만료일 계산 + serializeData 왕복 유지
  await test('[🛡 보증 시작] → warranty 항목·만료일 계산(방수 2년) + 직렬화 왕복', async () => {
    // 리뷰 링크 복구(무관하지만 상태 정리)
    await seed(); await openDetail('준공현장 A'); await page.waitForTimeout(150);
    await page.click('[data-warrantystart]'); await page.waitForTimeout(250);
    // 모달 기본값(방수 24·마감 12·전기설비 12, 시작=doneAt) 그대로 확정
    await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('보증 시작')); b.click(); });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const p = state.projects.find(x => x.name === '준공현장 A');
      const s = serializeData();
      const round = JSON.parse(JSON.stringify(s));
      const rp = round.projects.find(x => x.name === '준공현장 A');
      return {
        warranty: p.warranty,
        startedAt: p.warranty && p.warranty.startedAt,
        wp: rp && rp.warranty,
        topReview: 'review_url' in s,
        topWarranty: 'warranty' in s
      };
    });
    assert(r.warranty && Array.isArray(r.warranty.items) && r.warranty.items.length >= 1, 'warranty.items 생성');
    assert(r.startedAt === DONE_AT, 'startedAt=준공일: ' + r.startedAt);
    const wp = r.warranty.items.find(i => i.name === '방수');
    assert(wp && wp.months === 24, '방수 24개월');
    assert(wp.expiresAt === '2028-07-01', '방수 만료 = 준공+2년(2028-07-01): ' + wp.expiresAt);
    const fin = r.warranty.items.find(i => /마감/.test(i.name));
    assert(fin && fin.expiresAt === '2027-07-01', '마감 1년 만료(2027-07-01): ' + (fin && fin.expiresAt));
    // serializeData 왕복 유지
    assert(r.wp && Array.isArray(r.wp.items) && r.wp.items.find(i => i.name === '방수' && i.expiresAt === '2028-07-01'), 'serialize 왕복에 warranty 보존');
    // 최상위 키 금지
    assert(!r.topReview, 'serialize에 review_url 최상위 키 없음');
    assert(!r.topWarranty, 'serialize에 warranty 최상위 키 없음');
  });
  await test('보증 상태(진행중 D-day) 준공관리 카드에 표시 + hjWarranty 연동', async () => {
    const r = await page.evaluate(() => {
      const p = state.projects.find(x => x.name === '준공현장 A');
      const w = hjWarranty(p);
      return { end: w.end, dday: w.dday, cardHas: (document.querySelector('[data-donecard]') || {}).outerHTML.includes('보증') };
    });
    assert(r.end === '2028-07-01', 'hjWarranty가 항목형 만료일(가장 늦은 항목) 반영: ' + r.end);
    assert(r.cardHas, '카드에 보증 상태 표시');
  });

  // 4) 회귀: 구형 숫자형 warranty·doneAt만 있는 현장도 hjWarranty 정상
  await test('회귀 — warranty 미설정 완공 현장은 완료+1년 기본 유지', async () => {
    const r = await page.evaluate(() => {
      const p = { name: 'x', stage: 3, doneAt: '2026-01-10', customer: {} };
      const w = hjWarranty(p);
      return w;
    });
    assert(r.end === '2027-01-10', '완료+1년 기본: ' + r.end);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
