/* asclose-v366.e2e.js — v366 AS 방문 보고 → AS 기록 마무리 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·복사는 가로챔).
   · AS 방문 일정(asId, 또는 옛 일정이면 AS 기록의 visitSchedId)에 작업 보고를 저장하면 그 AS 가 완료 전일 때 '🔧 AS 기록 마무리' 창.
   · 처리 내용 = 이미 적힌 처리 내용, 없으면 보고 글. 그날 현장 사진 N장 연결(체크, 이미 연결된 사진은 빼고 센다).
   · [✅ AS 완료로 저장] → 상태 완료·처리 내용·사진 → '✅ AS 완료 — 고객 안내'(고친 글로 문자, 연락처 없으면 복사) · [처리중으로 저장] · [나중에](아무것도 안 바꿈).
   · 일반 일정·이미 완료된 AS 는 묻지 않는다. 내 업무 ✅ 완료 보고에서도 같은 창, 끝나면 내 업무로 돌아간다. 오늘은 2026-11-05(목) 고정. */
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
    window.__sms = []; window.__copied = [];
    window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
    window.coworkCopy = (t, label) => { window.__copied.push({ t, label }); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 5, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '' } },
      { name: '가상현장B', stage: 5, received: 0, phases: [], cost: {}, customer: { name: '이가상', phone: '', addr: '' } }
    ];
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const F = (id, name, d) => ({ id, kind: 'photo', project: '가상현장A', name, size: 100, prefix: '가상현장A/', thumb: px, when: d });
    state.files = [F('f1', 'a.jpg', new Date(2026, 10, 6, 11, 0)), F('f2', 'b.jpg', new Date(2026, 10, 6, 11, 30)), F('f3', 'c.jpg', new Date(2026, 10, 4, 9, 0))];
    state.asLog = [
      { id: 'as1', project: '가상현장A', date: '2026-11-03', text: '욕실 실리콘 들뜸', status: 'open', visitAt: '2026-11-06', visitSchedId: 'v1' },
      { id: 'as2', project: '가상현장B', date: '2026-11-04', text: '현관 문틀 벌어짐', status: 'open', visitAt: '2026-11-12', visitSchedId: 'v2', fix: '문틀 나사 조임 예정' }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '10:00', title, project: '가상현장A', workers: '', memo: '', hours: 2, report: null }, x || {});
    state.schedule = [
      S('v1', '2026-11-06', '🔧 AS 방문: 욕실 실리콘 들뜸', { asId: 'as1', crew: '김타일' }),
      S('v2', '2026-11-12', '🔧 AS 방문: 현관 문틀 벌어짐', { project: '가상현장B', hours: 0, time: '' }),
      S('w1', '2026-11-06', '도배', { time: '09:00', hours: 8 })
    ];
    window.__sms = []; window.__copied = []; __calSelDate = null;
    state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const report = (id, done, prog) => page.evaluate(({ id, done, prog }) => {
    openReportEdit(id); document.getElementById('rDone').value = done; document.getElementById('rProgress').value = prog;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
    const m = document.querySelector('#modalRoot .modal');
    return { h3: m ? m.querySelector('h3').textContent : '', fix: (document.getElementById('acFix') || {}).value, photos: !!document.getElementById('acPhotos'), body: m ? m.textContent : '',
      btns: m ? [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) : [] };
  }, { id, done, prog });
  const click = re => page.evaluate(src => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re);
  const snap = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① AS 방문 일정 보고 저장 → 🔧 AS 기록 마무리(보고 글·그날 사진 2장) → [✅ AS 완료로 저장] → 고객 완료 안내 문자 → AS 관리', async () => {
    await seed();
    const r = await report('v1', '욕실 실리콘 재시공', '완료');
    assert(r.h3 === '🔧 AS 기록 마무리' && r.fix === '욕실 실리콘 재시공' && r.photos && /사진 2장/.test(r.body) && /욕실 실리콘 들뜸/.test(r.body), '창: ' + JSON.stringify(r).slice(0, 300));
    assert(JSON.stringify(r.btns) === JSON.stringify(['✅ AS 완료로 저장', '처리중으로 저장', '나중에']), '버튼: ' + JSON.stringify(r.btns));
    assert(await click('AS 완료로 저장'), '완료 버튼');
    const d = await page.evaluate(() => {
      const a = state.asLog.find(x => x.id === 'as1'), m = document.querySelector('#modalRoot .modal');
      return { status: a.status, fix: a.fix, photos: a.photos, h3: m.querySelector('h3').textContent, text: document.getElementById('adText').value, btns: [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) };
    });
    assert(d.status === 'done' && d.fix === '욕실 실리콘 재시공' && JSON.stringify(d.photos) === JSON.stringify(['k:가상현장A/a.jpg|100', 'k:가상현장A/b.jpg|100']), 'AS 기록: ' + JSON.stringify(d).slice(0, 300));
    assert(d.h3 === '✅ AS 완료 — 고객 안내' && /김가상님/.test(d.text) && /"욕실 실리콘 들뜸" 건을 11\/6\(금\)에 방문해 처리했습니다/.test(d.text) && /처리 내용: 욕실 실리콘 재시공/.test(d.text), '완료 안내: ' + d.text);
    assert(JSON.stringify(d.btns) === JSON.stringify(['✉️ 고객에게 완료 안내', '🔧 AS 관리', '닫기']), '완료 버튼: ' + JSON.stringify(d.btns));
    const s = await page.evaluate(() => {
      document.getElementById('adText').value += '\n가상 덧붙임';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /고객에게 완료 안내/.test(b.textContent)).click();
      const sms = window.__sms.slice();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /AS 관리/.test(b.textContent)).click();
      const sum = document.querySelector('#modalRoot .asmSum[data-id="as1"]'), st = document.querySelector('#modalRoot .asmStat[data-id="as1"]');
      return { sms, h3: document.querySelector('#modalRoot h3').textContent, sum: sum && sum.textContent, st: st && st.value };
    });
    assert(s.sms.length === 1 && s.sms[0].to === '010-9999-8888' && /가상 덧붙임$/.test(s.sms[0].t), '문자: ' + JSON.stringify(s.sms));
    assert(s.h3 === '🔧 AS·하자보수 관리' && /처리: 욕실 실리콘 재시공/.test(s.sum || '') && s.st === 'done', 'AS 관리: ' + JSON.stringify(s));
  });

  await test('② 옛 방문 일정(visitSchedId 만) — 이미 적힌 처리 내용을 채우고, [처리중으로 저장] → 처리중·처리 내용만, 다시 보고하면 또 묻는다', async () => {
    await seed();
    const r = await report('v2', '문틀 보강, 부품 주문', '보류');
    assert(r.h3 === '🔧 AS 기록 마무리' && r.fix === '문틀 나사 조임 예정' && !r.photos && /접수/.test(r.body), '창: ' + JSON.stringify(r).slice(0, 300));
    await page.evaluate(() => { document.getElementById('acFix').value = '문틀 보강 — 부품 오면 재방문'; });
    assert(await click('처리중으로 저장'), '처리중 버튼');
    const d = await page.evaluate(() => { const a = state.asLog.find(x => x.id === 'as2'); return { status: a.status, fix: a.fix, photos: a.photos, open: !!document.querySelector('#modalRoot .modal') }; });
    assert(d.status === 'doing' && d.fix === '문틀 보강 — 부품 오면 재방문' && d.photos === undefined && !d.open, '처리중: ' + JSON.stringify(d));
    const again = await report('v2', '부품 교체 완료', '완료');
    assert(again.h3 === '🔧 AS 기록 마무리' && again.fix === '문틀 보강 — 부품 오면 재방문' && /처리중/.test(again.body), '다시: ' + JSON.stringify(again).slice(0, 200));
  });

  await test('③ 일반 일정·이미 완료된 AS 는 묻지 않는다, [나중에]는 아무것도 바꾸지 않는다', async () => {
    await seed();
    const plain = await report('w1', '도배 완료', '완료');
    assert(plain.h3 === '', '일반 일정인데 창: ' + plain.h3);
    const offer = await report('v1', '실리콘 재시공', '완료');
    assert(offer.h3 === '🔧 AS 기록 마무리', 'AS 방문 보고인데 창 없음: ' + offer.h3);
    const b0 = await snap();
    assert(await click('나중에'), '나중에 버튼');
    const after = await page.evaluate(() => ({ open: !!document.querySelector('#modalRoot .modal'), a: state.asLog.find(x => x.id === 'as1') }));
    assert(!after.open && after.a.status === 'open' && after.a.fix === undefined && after.a.photos === undefined && (await snap()) === b0, '나중에: ' + JSON.stringify(after));
    await page.evaluate(() => { state.asLog.find(x => x.id === 'as1').status = 'done'; });
    const done = await report('v1', '재확인', '완료');
    assert(done.h3 === '', '완료된 AS 인데 창: ' + done.h3);
  });

  await test('④ 내 업무 ✅ 완료 보고 → 같은 창 — 사진 체크를 풀면 사진은 연결하지 않고, 끝나면 내 업무로 돌아간다 · 연락처 없으면 복사', async () => {
    await seed();
    const done = (id, text) => page.evaluate(({ id, text }) => {
      myWorkReport(id); document.getElementById('mwDoneText').value = text;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /완료 보고 저장/.test(b.textContent)).click();
      return document.querySelector('#modalRoot h3').textContent;
    }, { id, text });
    const h = await done('v1', '실리콘 재시공');
    assert(h === '🔧 AS 기록 마무리', '내 업무 보고 뒤: ' + h);
    const r = await page.evaluate(() => {
      document.getElementById('acPhotos').click();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /AS 완료로 저장/.test(b.textContent)).click();
      const h1 = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '닫기').click();
      const a = state.asLog.find(x => x.id === 'as1');
      return { h1, h2: document.querySelector('#modalRoot h3').textContent, status: a.status, fix: a.fix, photos: a.photos, rep: state.schedule.find(x => x.id === 'v1').report.progress };
    });
    assert(r.h1 === '✅ AS 완료 — 고객 안내' && /^📋 내 업무/.test(r.h2) && r.status === 'done' && r.fix === '실리콘 재시공' && r.photos === undefined && r.rep === '완료', '완료: ' + JSON.stringify(r));
    const h2 = await done('v2', '부품 교체');
    const r2 = await page.evaluate(() => {
      const fix = document.getElementById('acFix').value;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /AS 완료로 저장/.test(b.textContent)).click();
      const btn = [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent);
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /완료 안내 글 복사/.test(b.textContent)).click();
      return { fix, btn, copied: window.__copied.slice(), sms: window.__sms.length };
    });
    assert(h2 === '🔧 AS 기록 마무리' && r2.fix === '문틀 나사 조임 예정' && r2.btn[0] === '📋 완료 안내 글 복사' && r2.copied.length === 1 && /이가상님/.test(r2.copied[0].t) && /처리 내용: 문틀 나사 조임 예정/.test(r2.copied[0].t) && r2.sms === 0, '연락처 없음: ' + JSON.stringify({ h2, r2 }).slice(0, 300));
  });

  await test('⑤ 390px 가로 넘침 없음 — 마무리 창·완료 안내 창', async () => {
    await seed();
    const o = await report('v1', '욕실 실리콘 재시공 — 아주 긴 처리 내용 '.repeat(4), '완료');
    const w1 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(o.h3 === '🔧 AS 기록 마무리' && await click('AS 완료로 저장'), '마무리 창');
    const w2 = await page.evaluate(() => ({ w: document.documentElement.scrollWidth - document.documentElement.clientWidth, h3: document.querySelector('#modalRoot h3').textContent }));
    assert(w2.h3 === '✅ AS 완료 — 고객 안내' && w1 <= 0 && w2.w <= 0, '가로 넘침: ' + JSON.stringify({ w1, w2 }));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== asclose-v366: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
