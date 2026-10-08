/* vatproof-v349.e2e.js — v349 부가세 준비 ↔ 입금 증빙 연결 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음(XLSX 는 스텁).
   · 부가세 준비 창에 신고 기간 입금의 증빙 종류별 건수·금액(현금영수증·세금계산서·카드·기타·미기록)이 보이고,
     [🧾 입금 증빙 기록 열기] → 증빙 창 → [‹ 뒤로] 가 부가세 창으로 돌아온다. 요약 복사 글과 엑셀 '입금증빙' 시트에도 같은 값.
   · 입금일 기준 집계라 매출(견적 기준)과 다를 수 있다는 안내가 있고, 저장본은 바뀌지 않는다. */
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
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {}
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText(t) { window.__copied = t; return Promise.resolve(); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await page.evaluate(() => {
    state._demo = false; state.expenses = []; state.quotes = []; state.notes = []; state.schedule = []; state.files = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, x || {});
    state.projects = [P('대전'), P('둔산')];
    // 올해 1기(1~6월) 기간에 넷, 기간 밖에 하나
    const y = new Date().getFullYear();
    state.payLog = [
      { d: y + '-02-10', project: '대전', amt: 1000000, proof: 'cash', proofAt: y + '-02-11' },
      { d: y + '-03-05', project: '대전', amt: 2200000, proof: 'tax', proofAt: y + '-03-05' },
      { d: y + '-04-01', project: '둔산', amt: 300000, proof: 'card' },
      { d: y + '-05-20', project: '둔산', amt: 500000 },                 // 미기록
      { d: y + '-08-01', project: '둔산', amt: 900000 }                  // 2기 — 1기 집계에서 제외
    ];
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('부가세 준비 창에 기간 입금의 증빙 집계가 보이고, 증빙 창으로 갔다가 뒤로 돌아온다 (요약 복사 글 포함)', async () => {
    const r = await page.evaluate(async () => {
      const y = new Date().getFullYear(), pd = vatPeriods().find(x => x.key === y + '-1');
      const ps = hjProofSummary(pd.from, pd.to);
      vatReport(pd.key); await new Promise(r => setTimeout(r, 120));
      const root = document.getElementById('modalRoot');
      const sec = [...root.querySelectorAll('div')].find(x => /^🧾 입금 증빙/.test(x.textContent || ''));
      const secText = sec ? sec.textContent : '';
      const chips = [...root.querySelectorAll('span')].filter(x => /건/.test(x.textContent) && x.style.borderRadius === '999px').map(x => x.textContent.replace(/\s+/g, ' ').trim());
      const hint = /입금일 기준이라 위 매출\(견적 기준\)과 다를 수 있어요/.test(root.textContent) && /미기록 1건/.test(root.textContent);
      root.querySelector('#vatCopy').click(); await new Promise(r => setTimeout(r, 50));
      const copied = window.__copied || '';
      const pb = root.querySelector('#vatProof'); const h = pb.getBoundingClientRect().height; pb.click(); await new Promise(r => setTimeout(r, 100));
      const t1 = document.querySelector('#modalRoot .modal h3').textContent, rows = document.querySelectorAll('#modalRoot .prRow').length;
      const back = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)); back.click(); await new Promise(r => setTimeout(r, 100));
      const t2 = document.querySelector('#modalRoot .modal h3').textContent;
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      closeModal();
      return { ps, secText, chips, hint, copied, h, t1, rows, t2, wide };
    });
    assert(r.ps.total.n === 4 && r.ps.total.sum === 4000000 && r.ps.cash.n === 1 && r.ps.tax.sum === 2200000 && r.ps.card.n === 1 && r.ps.none.n === 1 && r.ps.none.sum === 500000, '집계: ' + JSON.stringify(r.ps));
    assert(/🧾 입금 증빙 \(4건 · 400만/.test(r.secText), '제목 줄: ' + r.secText.slice(0, 60));
    // 부가세 창은 다른 숫자처럼 '원' 없이 적는다(won=hjNum 지역 변수)
    assert(r.chips.some(c => /현금영수증 1건 1,000,000$/.test(c)) && r.chips.some(c => /세금계산서 1건 2,200,000$/.test(c)) && r.chips.some(c => /카드 1건 300,000$/.test(c)) && r.chips.some(c => /미기록 1건 500,000$/.test(c)) && !r.chips.some(c => /기타/.test(c)), '칩: ' + JSON.stringify(r.chips));
    assert(r.hint, '입금일 기준 안내·미기록 안내가 있어야 한다');
    assert(/입금 증빙\(입금일 기준\): 현금영수증 1건 1,000,000원 · 세금계산서 1건 2,200,000원 · 카드 1건 300,000원 · 미기록 1건 500,000원/.test(r.copied), '복사 글: ' + r.copied);
    assert(r.h >= 44 && /입금 증빙 기록/.test(r.t1) && r.rows === 5 && /부가세 신고 준비/.test(r.t2), '증빙 창 왕복: ' + JSON.stringify([r.h, r.t1, r.rows, r.t2]));
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('신고 자료 엑셀에 입금증빙 시트가 붙는다 (입금일·현장·금액·증빙·기록일, 기간 밖 제외)', async () => {
    const r = await page.evaluate(async () => {
      const y = new Date().getFullYear();
      const oX = window.XLSX, oE = window.ensureXLSX; let wb = null, fname = '';
      window.ensureXLSX = async () => {};
      window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: a => a, book_append_sheet: (w, sh, n) => w.sheets.push([n, sh]) }, writeFile: (w, f) => { wb = w; fname = f; } };
      let res; try { res = await vatExportXlsx(y + '-1'); } finally { window.XLSX = oX; window.ensureXLSX = oE; }
      const sh = wb.sheets.find(x => x[0] === '입금증빙');
      return { names: wb.sheets.map(x => x[0]), rows: sh ? sh[1] : null, res };
    });
    assert(JSON.stringify(r.names) === JSON.stringify(['요약', '매출', '매입', '입금증빙']) && r.res && r.res.시트 === 4, '시트: ' + JSON.stringify(r.names));
    assert(r.rows && r.rows.length === 5 && JSON.stringify(r.rows[0]) === JSON.stringify(['입금일', '현장', '금액', '증빙', '기록일']), '머리·행 수: ' + JSON.stringify(r.rows && r.rows.slice(0, 2)));
    assert(r.rows[1][3] === '현금영수증' && r.rows[2][3] === '세금계산서' && r.rows[3][3] === '카드결제' && r.rows[4][3] === '미기록' && r.rows[4][2] === 500000 && !r.rows.some(x => x[2] === 900000), '행 내용: ' + JSON.stringify(r.rows));
  });

  await test('읽기 경로(집계·부가세 창)는 저장본을 바꾸지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const before = snap(); const y = new Date().getFullYear();
      hjProofSummary(y + '-01', y + '-06'); vatReport(y + '-1'); await new Promise(r => setTimeout(r, 80)); closeModal();
      return { same: before === snap(), keys: Object.keys(serializeData()).length };
    });
    assert(r.same && r.keys === 41, '저장본 불변·키 41: ' + JSON.stringify(r));
  });

  await test('공정 진행률은 시공 현장에만 보이고(상담·완료 현장의 옛 사진 공정 ×), 긴 공정 이름은 24자에서 자른다 — 실데이터 확인 후속', async () => {
    const r = await page.evaluate(() => {
      const P = (n, stage) => ({ name: n, stage, received: 0, phases: ['지하실 배관 교체 및 1동 807호 806호 계량기 밸브 교체', '마감'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
      state.projects = [P('상담', 1), P('시공', 2), P('완료', 3)];
      state.files = ['상담', '시공', '완료'].map((n, i) => ({ id: 'f' + i, name: 'f' + i + '.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '', project: n, when: new Date(), handle: null, _file: null, _virtual: true, text: '', ocr: 'na', _phase: '지하실 배관 교체 및 1동 807호 806호 계량기 밸브 교체' }));
      const b = hjDailyBrief();
      const prog = Object.fromEntries(b.doing.map(x => [x.name, x.prog]));
      const txt = Object.fromEntries(['상담', '시공', '완료'].map(n => [n, customerProgressText(customerProgressData(n))]));
      const line = hjPhaseProgressLine(hjPhaseProgress(state.projects[1]));
      return { prog, txt, line };
    });
    assert(r.prog['시공'] === '0/2' && r.prog['상담'] === null && !r.prog['완료'], '브리핑 칩은 시공 현장만: ' + JSON.stringify(r.prog));
    assert(/공정 2개 중 0개 완료/.test(r.txt['시공']) && !/공정 2개/.test(r.txt['상담']) && !/공정 2개/.test(r.txt['완료']), '진행 보고 문안도 시공 현장만: ' + JSON.stringify(r.txt));
    assert(/진행 중: 지하실 배관 교체 및 1동 807호 806… · 다음: 마감/.test(r.line) && !/계량기/.test(r.line), '긴 공정 이름 자름(24자): ' + r.line);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== vatproof-v349: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
