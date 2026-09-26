/* office-worklist.e2e.js — 🏢 관리사무소 작업 안내 (Playwright)

   2026-09-25: 관리사무소에 가서 "무엇을 할 수 있나"를 폰으로 보여 줄 화면이 없었다. 지키는 것:
     ① 더보기 그룹·옛 시트·핸들러에 officework 가 있다(정적)
     ② 네 묶음이 공개 홈페이지 office.html 의 「관리사무소에서 자주 필요한 보수 업무」와 같은 말이다(제목 4개·설명 4개 글자 일치)
        — 앱과 홈페이지가 다른 말을 하면 담당자가 헷갈린다. 세부 항목은 실제로 한 작업이라 지어낸 공정이 없다
     ③ 줄을 고치면 이 폰(localStorage hj_office_works)에만 남고, 다시 열어도 그대로, ↺ 기본값은 물어보고 되돌린다.
        serializeData 최상위 키는 늘지 않고 state 에도 아무것도 쓰지 않는다
     ④ 공유 글·문서에 회사 전화·법정 보증(방수 3년·설비 2년·마감 1년)·진행 순서가 있고, '무료' 라는 말이 없다
     ⑤ 📺 크게 보기는 새 창에 큰 글씨 문서를 쓴다, 📄 문서는 hjDocDeliverView(PDF·워드·HTML)로 간다, 뒤로 가면 이 화면
     ⑥ 아래 버튼 44px, 폰 폭(360)에서 가로 넘침 0, pageerror 0

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
assert(/\['officework','📋','관리사무소 작업 안내'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="officework"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='officework'\)return officeWorkListView\(\);/.test(source), '① 핸들러가 officeWorkListView 로 간다');
assert(/officework:'[^']+'/.test(source), '① MORE_HELP 설명이 있다');

// ② 공개 홈페이지 정본과 같은 말인가 — manmool 저장소가 옆에 있으면 글자 단위로 대조한다(없으면 건너뛰고 말한다)
const OFFICE_HTML = ['/home/user/manmool/office.html', path.join(__dirname, '..', '..', 'manmool', 'office.html')].find(p => fs.existsSync(p));
const SITE_GROUPS = [
  ['누수·배관 원인 확인·보수', '물이 번지는 위치와 배관 구간을 확인하고, 탐지·철거·교체·복구가 필요한 범위를 구분해 안내합니다.'],
  ['공용부 시설 보수', '지하·옥상·복도 등 공용 구간의 배관, 방수, 타일, 도장 상태를 확인하고 공사 순서를 제안합니다.'],
  ['세대 민원 보수·복구', '욕실과 생활 공간의 누수 보수부터 철거한 자리의 방수·미장·타일·마감 복구까지 연결합니다.'],
  ['인테리어 공사 행정지원', '입주민 공사 전 관리사무소 확인 절차와 안내문, 소음 양해문, 작업 일정 협의에 필요한 내용을 준비합니다.'],
];
if (OFFICE_HTML) {
  const office = fs.readFileSync(OFFICE_HTML, 'utf8');
  for (const [t, d] of SITE_GROUPS) assert(office.includes('<h3>' + t + '</h3>') && office.includes(d), '② 홈페이지 office.html 에 같은 묶음이 있다: ' + t);
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true, asked = [];
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.officeWorkListView === 'function' && typeof window.hjOfficeWorksText === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); }; });

  // ② 앱의 네 묶음 = 홈페이지 네 묶음
  const groups = await page.evaluate(() => HJ_OFFICE_WORKS.map(g => [g.t, g.d, g.items.length]));
  assert(JSON.stringify(groups.map(g => [g[0], g[1]])) === JSON.stringify(SITE_GROUPS), '② 앱 네 묶음의 제목·설명이 홈페이지와 글자까지 같다: ' + JSON.stringify(groups.map(g => g[0])));
  assert(groups.every(g => g[2] >= 4), '② 묶음마다 세부 항목 4개 이상');
  const keysBefore = await page.evaluate(() => Object.keys(serializeData()).length);

  await page.evaluate(() => { state.dirty = false; moreActionHandler('officework'); });
  let t = await modalText();
  assert(/관리사무소 작업 안내/.test(t) && /누수·배관 원인 확인·보수/.test(t) && /인테리어 공사 행정지원/.test(t), '② 열린다: ' + t.slice(0, 80));
  assert(await page.evaluate(() => document.querySelectorAll('#modalRoot textarea.owIn').length) === 5, '② 묶음 4 + 안내 문구 1 = 5 칸');

  // ③ 고치면 이 폰에 남고, 다시 열어도 그대로, state 에는 안 쓴다
  await page.fill('#modalRoot textarea.owIn[data-k="common"]', '옥상 방수 2차 도막\n지하 주철관 슬리브 보수');
  await page.evaluate(() => { closeModal(true); officeWorkListView(); });
  const kept = await page.inputValue('#modalRoot textarea.owIn[data-k="common"]');
  assert(kept === '옥상 방수 2차 도막\n지하 주철관 슬리브 보수', '③ 다시 열어도 고친 줄이 남는다: ' + kept);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hj_office_works') || '{}'));
  assert(stored.items && stored.items.common.length === 2 && stored.note === null, '③ localStorage 에 세부 항목만(안내 문구는 안 고쳤으니 null): ' + JSON.stringify(stored).slice(0, 120));
  const keysAfter = await page.evaluate(() => Object.keys(serializeData()).length);
  assert(keysAfter === keysBefore && await page.evaluate(() => state.dirty === false), '③ serializeData 최상위 키 그대로, dirty 아님');
  assert(/옥상 방수 2차 도막/.test(await page.evaluate(() => hjOfficeWorksText())) && !/출입구 트렌치/.test(await page.evaluate(() => hjOfficeWorksText())), '③ 공유 글은 고친 줄을 쓴다');
  sayYes = false; await page.click('#owReset');
  assert(await page.inputValue('#modalRoot textarea.owIn[data-k="common"]') === '옥상 방수 2차 도막\n지하 주철관 슬리브 보수' && asked.length === 1, '③ 기본값은 물어보고, 취소하면 그대로');
  sayYes = true; await page.click('#owReset');
  await page.waitForFunction(() => /출입구 트렌치/.test((document.querySelector('#modalRoot textarea.owIn[data-k="common"]') || {}).value || ''));
  assert(await page.evaluate(() => localStorage.getItem('hj_office_works') === null), '③ 기본값으로 되돌리면 이 폰의 수정이 지워진다');

  // ④ 글·문서의 내용
  const text = await page.evaluate(() => hjOfficeWorksText());
  assert(text.includes('010-2397-8629') && /방수 3년 · 급배수 등 설비 2년 · 마감 1년/.test(text) && /접수 → 현장 확인/.test(text) && /office\.html/.test(text), '④ 공유 글에 전화·법정 보증·진행 순서·홈페이지 주소: ' + text.slice(0, 200));
  assert(!/무료/.test(text) && !/무료/.test(await page.evaluate(() => hjOfficeWorksDoc(false))), '④ "무료" 라는 말이 없다');
  const doc = await page.evaluate(() => hjOfficeWorksDoc(true));
  assert(/<h1[^>]*>만물인테리어 관리사무소 작업 안내<\/h1>/.test(doc) && /<li>세대·공용 누수 원인 확인/.test(doc) && /tel:010-2397-8629/.test(doc), '④ 문서 HTML 에 제목·항목·전화');
  await page.fill('#modalRoot textarea.owIn[data-k="__note"]', '하자보증 방수 3년 · 급배수 등 설비 2년 · 마감 1년 (건설산업기본법 시행령 별표4 기준)');
  assert(!/500만/.test(await page.evaluate(() => hjOfficeWorksText())), '④ 금액 줄을 지우면 글에서도 빠진다');

  // ⑤ 크게 보기 → 새 창에 큰 글씨 문서, 📄 문서 → hjDocDeliverView
  await page.evaluate(() => { window.__opened = []; window.open = () => ({ document: { write: (h) => window.__opened.push(h), close: () => {} } }); });
  await page.click('#modalRoot .mfoot button:has-text("📺 크게 보기")');
  const opened = await page.evaluate(() => window.__opened);
  assert(opened.length === 1 && /font-size:30px/.test(opened[0]) && /관리사무소 작업 안내/.test(opened[0]), '⑤ 크게 보기 = 새 창에 1.25배 글씨(제목 30px): ' + (opened[0] || '').slice(0, 80));
  await page.click('#modalRoot .mfoot button:has-text("📄 문서")');
  t = await modalText();
  assert(/🏢 작업 안내 — 관리사무소/.test(t) && /PDF로 저장/.test(t) && /워드/.test(t), '⑤ 문서 화면(PDF·워드·HTML): ' + t.slice(0, 80));
  await page.click('#modalRoot .mfoot button:has-text("← 뒤로")');
  assert(/관리사무소 작업 안내/.test(await modalText()) && await page.evaluate(() => document.querySelectorAll('#modalRoot textarea.owIn').length === 5), '⑤ 뒤로 가면 이 화면');

  // ⑥ 폰
  const m = await page.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => Math.round(b.getBoundingClientRect().height)), reset: Math.round(document.querySelector('#owReset').getBoundingClientRect().height) }));
  assert(m.ov === 0 && m.btns.length === 4 && m.btns.every(h => h >= 44) && m.reset >= 44, '⑥ 넘침 0·버튼 44: ' + JSON.stringify(m));
  assert(errors.length === 0, 'pageerror 0: ' + errors.join(' | '));
  console.log('office-worklist.e2e OK (① 메뉴 ② 홈페이지와 같은 말 ③ 이 폰 저장·기본값 ④ 글·문서 내용 ⑤ 크게 보기·문서·뒤로 ⑥ 폰)' + (OFFICE_HTML ? '' : ' — manmool office.html 이 옆에 없어 홈페이지 대조는 건너뜀'));
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { await browser.close(); } catch (_) {} process.exit(1); });
