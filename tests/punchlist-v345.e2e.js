/* punchlist-v345.e2e.js — v345 준공 하자점검표(punch list) 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   다른 회사 앱(Buildertrend·Procore punch list, 도배르만 체크리스트) 비교에서 이 앱에 없던 기능.
   · 공간별 기본 항목 넣기 → 양호/보수 필요/보수 완료/해당 없음, 보수 메모, 사진 연결(안정 참조)
   · 현장 안(p.punch)에 저장되고 최상위 저장 키는 41개 그대로
   · 준공 전 체크 줄에 상태가 보이고, 대시보드 '오늘의 체크'에 보수 필요 남은 현장·오늘 사진 찍은 현장 버튼
   · 고객 확인 글은 보수 예정/완료를 나눠 적는다(자동 발송 없음) */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await page.evaluate(() => {
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = [];
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [P('대전'), P('한신교회', { stage: 1 })];
    state.files = [{ id: 'ph1', name: 'IMG_1.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '', project: '대전', when: new Date(), handle: null, _file: null, _virtual: true, text: '', ocr: 'na' }];
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('공간 기본 항목 넣기·상태·메모·사진 연결이 현장 안에 저장되고 저장 키는 늘지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const keysBefore = Object.keys(serializeData()).length;
      punchListView('대전'); await new Promise(r => setTimeout(r, 80));
      document.querySelectorAll('.plArea').forEach(c => { if (['거실', '욕실1'].includes(c.value)) c.checked = true; });
      document.getElementById('plSeed').click(); await new Promise(r => setTimeout(r, 80));
      const root = document.getElementById('modalRoot');
      root.querySelector('.plStat[data-i="0"][data-s="ok"]').click(); await new Promise(r => setTimeout(r, 60));
      root.querySelector('.plStat[data-i="1"][data-s="fix"]').click(); await new Promise(r => setTimeout(r, 60));
      const note = root.querySelector('.plIn[data-k="note"][data-i="1"]'); note.value = '실리콘 재시공'; note.dispatchEvent(new Event('input'));
      const sel = root.querySelector('.plIn[data-k="photo"][data-i="1"]'); sel.value = 'ph1'; sel.dispatchEvent(new Event('change'));
      root.querySelector('.plStat[data-i="2"][data-s="done"]').click(); await new Promise(r => setTimeout(r, 60));
      const p = state.projects.find(x => x.name === '대전');
      const d = serializeData();
      closeModal();
      return { n: p.punch.length, st: hjPunchStats(p.punch), item: p.punch[1], saved: d.projects.find(x => x.name === '대전').punch.length, keysAfter: Object.keys(d).length, keysBefore };
    });
    assert(r.n === 10 && r.saved === 10, '항목 수: ' + JSON.stringify([r.n, r.saved]));
    assert(r.st.ok === 1 && r.st.fix === 1 && r.st.done === 1 && r.st.unchecked === 7, '상태 집계: ' + JSON.stringify(r.st));
    assert(r.item.status === 'fix' && r.item.note === '실리콘 재시공' && /IMG_1\.jpg/.test(r.item.photo) && r.item.at, '보수 항목: ' + JSON.stringify(r.item));
    assert(r.keysAfter === r.keysBefore, '최상위 저장 키가 늘었다: ' + r.keysBefore + ' → ' + r.keysAfter);
  });

  await test('준공 전 체크 줄과 대시보드 알림에 상태가 보이고, 버튼이 점검표·진행 보고를 연다', async () => {
    const r = await page.evaluate(async () => {
      const p = state.projects.find(x => x.name === '대전');
      const row = stageChecklistItems(p, 3).find(it => it[1] === 'punch');
      const go = STAGE_CHECK_GO.punch ? STAGE_CHECK_GO.punch.l : '';
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      const btns = [...document.querySelectorAll('[data-punchquick],[data-progressquick]')].map(b => b.textContent);
      document.querySelector('[data-punchquick="대전"]').click(); await new Promise(r => setTimeout(r, 80));
      const t1 = document.querySelector('#modalRoot .modal h3').textContent; closeModal();
      document.querySelector('[data-progressquick="대전"]').click(); await new Promise(r => setTimeout(r, 80));
      const t2 = document.querySelector('#modalRoot .modal h3').textContent; closeModal();
      return { row, go, btns, t1, t2 };
    });
    assert(r.row && /보수 필요 1곳 남음/.test(r.row[2]), '준공 전 체크 줄: ' + JSON.stringify(r.row));
    assert(r.go === '🧾 점검표', 'GO 버튼: ' + r.go);
    assert(r.btns.includes('🧾 대전') && r.btns.includes('📨 대전'), '대시보드 버튼: ' + JSON.stringify(r.btns));
    assert(/하자점검표/.test(r.t1) && /진행 보고/.test(r.t2), '열린 창: ' + r.t1 + ' / ' + r.t2);
  });

  await test('고객 확인 글은 보수 예정·완료를 나눠 적고, 항목 추가·삭제가 된다 (390px, 더보기에서 열림)', async () => {
    const r = await page.evaluate(async () => {
      const p = state.projects.find(x => x.name === '대전');
      const text = hjPunchText(p);
      moreActionHandler('punchlist'); await new Promise(r => setTimeout(r, 80));
      const title = document.querySelector('#modalRoot .modal h3').textContent;
      document.getElementById('plNewArea').value = '현관'; document.getElementById('plAdd').click(); await new Promise(r => setTimeout(r, 80));
      const n1 = p.punch.length;
      const dels = document.querySelectorAll('#modalRoot .plDel'); dels[dels.length - 1].click(); await new Promise(r => setTimeout(r, 80));
      const n2 = p.punch.length;
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      closeModal();
      return { text, title, n1, n2, wide };
    });
    assert(/보수 예정:/.test(r.text) && /거실 — 바닥 긁힘·소음 \(실리콘 재시공\)/.test(r.text) && /보수 완료:/.test(r.text), '확인 글: ' + r.text.slice(0, 200));
    assert(/하자점검표/.test(r.title), '더보기에서 열림: ' + r.title);
    assert(r.n1 === 11 && r.n2 === 10, '추가·삭제: ' + r.n1 + ' / ' + r.n2);
    assert(r.wide <= 0, '390px 에서 가로 넘침: ' + r.wide);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== punchlist-v345: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
