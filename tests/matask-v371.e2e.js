/* matask-v371.e2e.js — v371 늦은 납품 → 거래처 확인 문자·전화 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·전화는 가로챔).
   · 상황별 문안(지남·오늘·예정·미정) — 거래처·현장·주소·품목, 고객 이름·전화 없음.
   · 🚚 납품 확인 창 줄 [📞](입고된 것은 없음) → '📞 거래처 확인' 창: 📇 거래처 번호 채움, 고친 글로 문자, askedAt = 오늘, 줄에 '📨 11/5(목) 문의'.
     번호가 없던 거래처는 적은 번호를 📇 거래처에 기억. [📞 전화]는 번호가 있어야.
   · 현장 '🚚 자재 납품' 칸은 지남·오늘 줄에만 [📞]. 그리는 것만으로는 저장본이 바뀌지 않는다. 오늘은 2026-11-05(목) 고정. */
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
    window.__sms = []; window.__tel = [];
    window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
    window.hjTelGo = t => { window.__tel.push(t); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = []; state.asLog = []; state.schedule = [];
    state.suppliers = [{ name: '가상타일상사', phone: '010-5555-6666' }]; state.materials = [];
    const I = (name, qty, unit) => ({ name, spec: '', qty, unit });
    const O = (id, sup, items, due, x) => Object.assign({ id, sup, items, due, at: '2026-11-01', recvAt: '', memo: '' }, x || {});
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' }, matOrders: [
      O('m1', '가상타일상사', [I('타일 600각', 42, '장')], '2026-11-04'),
      O('m2', '가상설비', [I('변기', 1, '대'), I('세면대', 1, '대')], '2026-11-05'),
      O('m3', '가상목재', [I('합판', 10, '장')], '2026-11-09'),
      O('m4', '가상도배', [I('벽지', 8, '롤')], '2026-11-03', { recvAt: '2026-11-03' }),
      O('m5', '가상창호', [I('방충망', 2, '틀')], '')] }];
    window.__sms = []; window.__tel = []; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 상황별 확인 문안 — 지남·오늘·예정·미정, 현장·주소·품목, 고객 이름·전화 없음', async () => {
    await seed();
    const t = await page.evaluate(() => { const p = state.projects[0]; return ['m1', 'm2', 'm3', 'm5'].map(id => hjMatAskText(p, p.matOrders.find(o => o.id === id))); });
    assert(/^\[만물인테리어\] 가상타일상사님, 자재 납품 확인 부탁드립니다\.\n■ 현장: 가상현장A \(대전 서구 둔산동 1\)\n■ 품목: 타일 600각 × 42장\n■ 11\/4\(수\) 납품 예정이었는데 아직 도착 전입니다\. 도착 예정 시간을 알려 주세요\.\n- 전병덕 010-2397-8629$/.test(t[0]), '지남: ' + t[0]);
    assert(/■ 오늘 11\/5\(목\) 납품 예정입니다\. 도착 시간을 알려 주세요\./.test(t[1]) && /변기 × 1대, 세면대 × 1대/.test(t[1]), '오늘: ' + t[1]);
    assert(/■ 11\/9\(월\) 납품 예정 맞는지 확인 부탁드립니다\./.test(t[2]) && /■ 납품 가능한 날짜를 알려 주세요\./.test(t[3]), '예정·미정: ' + JSON.stringify(t.slice(2)));
    assert(!t.some(x => /김가상|9999-8888/.test(x)), '고객 정보가 들어갔다');
  });

  await test('② 🚚 납품 확인 창 [📞] → 번호 채움 · 고친 글로 문자 · 문의일 기록 · 뒤로 = 납품 확인 창, 입고된 줄에는 [📞] 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjMatView(); const asks = [...document.querySelectorAll('#matView .mdAsk')].map(b => b.dataset.id);
      document.querySelector('#matView .mdAsk[data-id="m1"]').click();
      const form = { h3: document.querySelector('#modalRoot h3').textContent, phone: document.getElementById('maPhone').value, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent) };
      document.getElementById('maText').value += '\n가상 덧붙임';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /확인 문자/.test(b.textContent)).click();
      const back = document.querySelector('#modalRoot h3').textContent;
      const asked = (document.querySelector('#matView .mdRow[data-id="m1"] .mdAsked') || {}).textContent;
      return { asks, form, back, asked, sms: window.__sms, at: state.projects[0].matOrders[0].askedAt };
    });
    assert(JSON.stringify(r.asks) === JSON.stringify(['m1', 'm2', 'm3', 'm5']), '[📞] 줄: ' + JSON.stringify(r.asks));
    assert(r.form.h3 === '📞 거래처 확인 — 가상타일상사' && r.form.phone === '010-5555-6666' && JSON.stringify(r.form.btns) === JSON.stringify(['✉️ 확인 문자', '📞 전화', '← 뒤로']), '창: ' + JSON.stringify(r.form));
    assert(r.sms.length === 1 && r.sms[0].to === '010-5555-6666' && /가상 덧붙임$/.test(r.sms[0].t) && r.at === '2026-11-05', '문자: ' + JSON.stringify(r));
    assert(r.back === '🚚 자재 납품 확인' && r.asked === '📨 11/5(목) 문의', '뒤로·문의 표시: ' + JSON.stringify(r));
  });

  await test('③ 번호 없는 거래처 — 번호 없이 [📞 전화]는 막고, 적은 번호로 전화하면 📇 거래처에 기억, 다음엔 채움', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjMatAsk('m2'); const empty = document.getElementById('maPhone').value;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /전화/.test(b.textContent)).click();
      const blocked = { tel: window.__tel.length, still: document.querySelector('#modalRoot h3').textContent, at: state.projects[0].matOrders[1].askedAt };
      document.getElementById('maPhone').value = '010-7777-8888';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /전화/.test(b.textContent)).click();
      const sup = state.suppliers.find(s => s.name === '가상설비');
      hjMatAsk('m2'); const again = document.getElementById('maPhone').value; closeModal(true);
      return { empty, blocked, tel: window.__tel, sup, again, at: state.projects[0].matOrders[1].askedAt };
    });
    assert(r.empty === '' && r.blocked.tel === 0 && /거래처 확인/.test(r.blocked.still) && !r.blocked.at, '번호 없으면 막음: ' + JSON.stringify(r.blocked));
    assert(JSON.stringify(r.tel) === JSON.stringify(['01077778888']) && r.sup && r.sup.phone === '010-7777-8888' && r.again === '010-7777-8888' && r.at === '2026-11-05', '전화·기억: ' + JSON.stringify(r));
  });

  await test('④ 현장 \'🚚 자재 납품\' 칸 — 지남·오늘 줄에만 [📞], 누르면 거래처 확인 창 · 저장본 불변 · 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const asks = [...document.querySelectorAll('#view [data-matask]')].map(b => b.dataset.matask);
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      document.querySelector('#view [data-matask="m2"]').click();
      const h3 = document.querySelector('#modalRoot h3').textContent; const w2 = document.documentElement.scrollWidth - document.documentElement.clientWidth; closeModal(true);
      hjMatView(); closeModal(true);
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { asks, h3, w, w2, same: snap() === b0 };
    });
    assert(JSON.stringify(r.asks) === JSON.stringify(['m1', 'm2']) && r.h3 === '📞 거래처 확인 — 가상설비', '칸: ' + JSON.stringify(r));
    assert(r.same && r.w <= 0 && r.w2 <= 0, '저장본·넘침: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== matask-v371: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
