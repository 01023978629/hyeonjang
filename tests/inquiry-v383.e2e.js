/* inquiry-v383.e2e.js — v383 📞 새 문의 받기 + 카카오 챗봇 문의의 문의 경로 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음.
   · 더보기 '고객·영업' 맨 앞 [📞 새 문의 받기] — 고객 이름·연락처·지역(단지)·문의 내용·문의 경로 → 현장(상담)·📇 연락처·메모 한 번에,
     이어서 [🗓 상담·실측 일정](다음 작업일 10:00)·[📂 현장 열기]. 이름·연락처 둘 다 비면/번호가 짧으면 막음.
   · 같은 번호의 현장이 있으면 한 번 알려 주고, 다시 누르면 새로 등록(연락처는 겹치게 안 만듦). 같은 이름 현장이 있으면 ' 2'.
   · 카카오 챗봇 문의로 만든 현장의 문의 경로 = 💬 카카오톡 채널. 오늘은 2026-11-05(목) 고정. */
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

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.portalAutoSync = () => 0;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = []; state.files = []; state.adPosts = [];
    state.contacts = [{ id: 'k1', name: '박기존', phone: '010-1111-2222', tag: '고객' }];
    state.projects = [{ name: '가상동 기존아파트', stage: 3, received: 0, phases: [], cost: {}, customer: { name: '박기존', phone: '010-1111-2222', addr: '' }, doneAt: '2026-05-01' }];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const fill = (v) => page.evaluate((v) => {
    const g = id => document.getElementById(id);
    g('inqName').value = v.name || ''; g('inqPhone').value = v.phone || ''; g('inqArea').value = v.area || ''; g('inqText').value = v.text || ''; g('inqSrc').value = v.src || '';
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /등록/.test(b.textContent)).click();
    return { h3: (document.querySelector('#modalRoot h3') || {}).textContent, dup: (g('inqDup') || {}).hidden === false ? g('inqDup').textContent : '' };
  }, v);

  await test('① 더보기 [📞 새 문의 받기] → 현장(상담)·연락처·메모 한 번에 → [🗓 상담·실측 일정] 다음 작업일 10:00', async () => {
    await seed();
    const menu = await page.evaluate(() => { const c = MORE_CATS.find(x => x.id === 'customer'); moreActionHandler('inquiry'); return { first: c.items[0][0], h3: document.querySelector('#modalRoot h3').textContent }; });
    assert(menu.first === 'inquiry' && menu.h3 === '📞 새 문의 받기', '메뉴: ' + JSON.stringify(menu));
    const a = await fill({ name: '김가상', phone: '010-3333-4444', area: '법동 가상아파트', text: '베란다 우수관 아래로 물이 샘', src: 'daangn' });
    const r = await page.evaluate(() => {
      const p = state.projects.find(x => x.name === '법동 가상아파트');
      const note = (state.notes.find(n => n.project === '법동 가상아파트') || {}).text;
      const c = state.contacts.find(x => x.phone === '010-3333-4444');
      const btns = [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent);
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /상담·실측 일정/.test(b.textContent)).click();
      const sch = { h3: document.querySelector('#modalRoot h3').textContent, title: document.getElementById('schTitle').value, date: document.getElementById('schDate').value };
      closeModal(true);
      return { p: p && { stage: p.stage, cu: p.customer, src: p.leadSrc }, note, c: c && { name: c.name, tag: c.tag, company: c.company }, btns, sch };
    });
    assert(a.h3 === '✅ 문의 등록 — 법동 가상아파트', '다음 창: ' + JSON.stringify(a));
    assert(r.p && r.p.stage === 0 && r.p.cu.name === '김가상' && r.p.cu.phone === '010-3333-4444' && r.p.cu.addr === '법동 가상아파트' && r.p.src === 'daangn', '현장: ' + JSON.stringify(r.p));
    assert(r.note === '[문의 접수] 2026-11-05 · 🥕 당근\n베란다 우수관 아래로 물이 샘' && r.c && r.c.name === '김가상' && r.c.tag === '고객', '메모·연락처: ' + JSON.stringify(r));
    assert(JSON.stringify(r.btns) === JSON.stringify(['닫기', '📂 현장 열기', '🗓 상담·실측 일정']) && r.sch.title === '상담·실측: 법동 가상아파트' && r.sch.date === '2026-11-06', '일정: ' + JSON.stringify(r));
  });

  await test('② 이름·연락처 둘 다 비거나 번호가 짧으면 막는다 · 취소는 저장본을 바꾸지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      hjInquiryView(); [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '취소').click();
      const same = snap() === b0;
      return { same, n: state.projects.length };
    });
    const e1 = await (async () => { await page.evaluate(() => hjInquiryView()); return fill({ area: '가상동', text: '문의' }); })();
    const e2 = await fill({ name: '김가상', phone: '0101', area: '가상동' });
    const n = await page.evaluate(() => { const n = state.projects.length; closeModal(true); return n; });
    assert(r.same && r.n === 1 && e1.h3 === '📞 새 문의 받기' && e2.h3 === '📞 새 문의 받기' && n === 1, '막음: ' + JSON.stringify({ r, e1, e2, n }));
  });

  await test('③ 같은 번호 현장 → 한 번 알림, 다시 누르면 새로 등록(연락처 안 겹침) · 같은 이름 현장이면 \' 2\'', async () => {
    await seed();
    await page.evaluate(() => hjInquiryView());
    const d1 = await fill({ name: '박기존', phone: '010-1111-2222', area: '가상동 기존아파트', text: '욕실 추가 공사', src: 'repeat' });
    const before = await page.evaluate(() => state.projects.length);
    const d2 = await page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /등록/.test(b.textContent)).click(); return document.querySelector('#modalRoot h3').textContent; });
    const r = await page.evaluate(() => { closeModal(true); return { names: state.projects.map(p => p.name), src: state.projects[1].leadSrc, contacts: state.contacts.filter(c => c.phone === '010-1111-2222').length }; });
    assert(/같은 번호의 현장이 있어요: 가상동 기존아파트/.test(d1.dup) && d1.h3 === '📞 새 문의 받기' && before === 1, '알림: ' + JSON.stringify(d1));
    assert(d2 === '✅ 문의 등록 — 가상동 기존아파트 2' && JSON.stringify(r.names) === JSON.stringify(['가상동 기존아파트', '가상동 기존아파트 2']) && r.src === 'repeat' && r.contacts === 1, '등록: ' + JSON.stringify({ d2, r }));
  });

  await test('④ 카카오 챗봇 문의로 만든 현장의 문의 경로 = 💬 카카오톡 채널, 광고 탭 문의 경로에 잡힌다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      kakaoLeadApply({ name: '최가상', phone: '010-5555-6666', area: '가상동', workType: '욕실', work: '욕실 리모델링', at: '2026-11-05 10:00', type: '견적문의', leadId: 'kk1' }, { contact: false, project: true, schedule: false });
      const p = state.projects.find(x => x.name === '가상동 욕실');
      return { src: p && p.leadSrc, label: hjLeadSrcLabel('kakaoch'), stat: hjLeadSrcStats().rows.map(x => x.id + ':' + x.n) };
    });
    assert(r.src === 'kakaoch' && r.label === '💬 카카오톡 채널' && JSON.stringify(r.stat) === JSON.stringify(['kakaoch:1']), '카카오: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== inquiry-v383: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
