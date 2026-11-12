/* v597 견적 비고의 '[금액 수정]' 기록 — 앱 안 기록은 남기고, 밖으로 나가는 견적서에서는 뺀다.
   v583 hjStmtApply 가 고친 작업내역서를 다시 반영하면 견적 비고(q.memo)에 '[금액 수정] 날짜 · 작업 옛→새원 · 원본 ‘수정본 파일’' 줄을 덧붙인다(내부 기록).
   그 비고가 견적서 PDF(보내기·드라이브 저장)·인쇄·엑셀의 '비고' 칸에 그대로 찍혀 거래처·고객에게 옛 금액·수정본 파일 이름이 나갔다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-12 고정, 바깥 쓰기 0. 비고 기록은 진짜 v583 길(hjStmtApply → hjStmtApplySafe)로 만든다.
   ① 밖으로 나가는 견적서 — 견적서 HTML·인쇄 창·PDF(보내기/드라이브 저장이 쓰는 quotePdfBlob)·엑셀 '비고' 에 사용자 메모·v526 줄은 있고
      '[금액 수정]'·옛→새 금액·수정본 파일 이름은 없다 · 저장된 견적은 그대로 (OUT)
   ② 앱 안 — 견적 작성 화면 비고 칸·세무사용 증빙 '비고(내부)' 는 기록을 그대로 보인다 · 저장된 비고 한 글자도 안 바뀜 (INSIDE)
   ③ 비고 칸을 고쳐 줄바꿈이 사라진 비고(기록이 앞 글에 붙음)도 [📄 PDF 출력]·엑셀에서 빠진다 · 두 번 고친 기록 · 손으로 적은 '[금액 수정]' 줄 ·
      ’ 가 든 파일 이름 · 다른 줄은 그대로 (GLUED)
   ④ 폰 390 견적 작성 화면 넘침 없음 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V597_BASELINE=<commit> 와 HJ_V597_MUTATION=no-html(견적서 HTML 이 비고를 그대로)·no-xlsx(엑셀이 비고를 그대로)·drop-all(비고를 통째로 뺌)은 ①,
   line-only(줄 머리만 봄)·no-line(기록 꼴만 봄)은 ③ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-html': ['<td>${escapeHtml(hjQuoteMemoOut(q.memo))}</td>', "<td>${escapeHtml(q.memo||'')}</td>"],
  'no-xlsx': ["aoa.push(['비고',hjQuoteMemoOut(q.memo)]);", "aoa.push(['비고',q.memo||'']);"],
  'drop-all': ['function hjQuoteMemoOut(memo){\n', "function hjQuoteMemoOut(memo){return '';\n"],
  'line-only': ["    const t=l.replace(HJ_REVMEMO_ENTRY_RE,'');\n", '    const t=l;\n'],
  'no-line': ['    if(HJ_REVMEMO_LINE_RE.test(l))return;\n', '']
};
let html = process.env.HJ_V597_BASELINE ? execFileSync('git', ['show', process.env.HJ_V597_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V597_MUTATION) {
  const m = MUT[process.env.HJ_V597_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V597_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS revmemo-v597 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-12T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    // 바깥 라이브러리 대역 — 엑셀은 시트에 넣는 줄(aoa)을, PDF 는 html2canvas 가 그리는 견적서 글을 남긴다(라이브러리 주소는 막혀 있다)
    window.XLSX = { utils: { aoa_to_sheet: aoa => { window.__aoa = aoa; return {}; }, book_new: () => ({}), book_append_sheet() {} }, writeFile(_wb, name) { window.__xlsxName = name; } };
    window.html2canvas = async host => { window.__pdfText = host.textContent; return { width: 760, height: 1000, toDataURL: () => 'data:image/jpeg;base64,' }; };
    window.jspdf = { jsPDF: function () { return { internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } }, addImage() {}, addPage() {}, output: () => new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }) }; } };
  }, BOOT);
  return { context, page };
}
// 내역서 격자(v579 초안을 채운 꼴) — 머리 + 줄 + 합계
const G = lines => [['작업내역서'], ['받는 분', '가상협력'], ['작성일', '2026-11-10'], ['작업 날짜', '위치', '작업명', '작업비용'], ...lines, ['합계', '', '', lines.reduce((a, l) => a + l[3], 0)]];
const A = '작업내역서_20261110_가상협력.xlsx', A2 = '작업내역서_20261111_가상협력_수정본.xlsx';
const L1 = [['2026-11-03', '가온아파트 101-1101', '우수관 교체', 220000], ['2026-11-04', '가온아파트 101-1101', '육가 교체', 50000]];
const L2 = [['2026-11-03', '가온아파트 101-1101', '우수관 교체', 330000], ['2026-11-04', '가온아파트 101-1101', '육가 교체', 50000]];
const NOTE = '계약금 50만원 선입금';
const SEED = async ({ l1, l2, A, A2, NOTE }) => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트')];
  state.quotes = []; state.files = []; state.notes = []; state.payLog = []; state.expenses = []; state.schedule = []; state.dirHandle = null; state.goals = {}; state.editingQuote = null;
  state.activeProject = null; state.tab = 'estimates'; state.search = '';
  const plan = (file, grid) => {
    const r = hjStmtParse([{ name: '작업내역서', grid }], file);
    return { src: r.file, file: r.file, doc: '작업내역서', to: r.to, date: r.date, vat: 'included', groups: hjStmtGroups(r).map(g => ({ loc: g.loc, lines: g.lines, choice: '가온아파트' })), exclude: [] };
  };
  // 앱 함수로 처음 반영(손으로 견적을 짓지 않는다) → 사용자가 비고 맨 앞에 메모를 적었다
  hjStmtApply(plan(A, l1));
  const q0 = state.quotes.find(q => q.stmt && q.project === '가온아파트');
  q0.memo = NOTE + '\n' + q0.memo;
  // 이름이 다른 수정본을 다시 반영 — 미리보기 기본값(짝 하나 → 새 금액으로 바꾸기) 그대로. 안전판을 찍고 비고에 '[금액 수정]' 줄을 남긴다(v583)
  const p2 = plan(A2, l2), all = []; p2.groups.forEach(g => all.push(...g.lines));
  const rv = hjStmtRevisions(all, p2.src, { projectOf: () => '가온아파트', to: p2.to }), by = new Map(rv.rows.map(x => [x.line, x]));
  p2.groups.forEach(g => { g.lines = g.lines.map(l => { const x = by.get(l); const c = x && x.def ? x.cands[0] : null; return c ? Object.assign({}, l, { revise: 'replace', reviseTo: { qid: c.qid, li: c.li, amt: c.amt } }) : l; }); });
  const res = await hjStmtApplySafe(p2);
  render();
  return { qid: q0.id, replaced: res.replaced.map(x => [x.work, x.from, x.to]) };
};
const QUOTES = () => JSON.stringify(serializeData().quotes);
const norm = t => String(t || '').replace(/\s+/g, ' ').trim();

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    const seeded = await page.evaluate(SEED, { l1: G(L1), l2: G(L2), A, A2, NOTE });
    const QID = seeded.qid;
    const REV = '[금액 수정] 2026-11-12 · 우수관 교체 220,000→330,000원 · 원본 ‘' + A2 + '’';

    await test('① 밖으로 나가는 견적서 — HTML·인쇄·PDF·엑셀 비고에 [금액 수정] 기록이 없다 · 사용자 메모·v526 줄은 그대로 (OUT)', async () => {
      assert.deepEqual(seeded.replaced, [['우수관 교체', 220000, 330000]], 'v583 바꾸기 ' + JSON.stringify(seeded.replaced));
      const memo = await page.evaluate(id => state.quotes.find(q => q.id === id).memo, QID);
      assert.ok(memo.split('\n').includes(REV), 'v583 이 쓴 기록이 저장된 비고에 있다 ' + JSON.stringify(memo));
      assert.ok(memo.split('\n')[0] === NOTE && memo.includes('원본: ' + A), '비고 = 사용자 메모 + v526 줄 + 기록 ' + JSON.stringify(memo));
      const before = await page.evaluate(QUOTES);
      const r = await page.evaluate(async id => {
        const q = state.quotes.find(x => x.id === id), memoCell = h => { const d = document.createElement('div'); d.innerHTML = h; const tr = [...d.querySelectorAll('.qcond tr')].find(t => /비고/.test(t.textContent)); return tr ? tr.lastElementChild.textContent : null; };
        const htmlCell = memoCell(quoteHTML(q));
        // 🖨 인쇄 — 숨은 iframe 에 쓰인 견적서(창을 띄우는 print 는 대역)
        printQuote(id);
        const fr = document.getElementById('printFrame'); fr.contentWindow.print = () => { window.__printed = (window.__printed || 0) + 1; };
        const printText = fr.contentDocument.body.textContent;
        // 📤 보내기·☁️ 드라이브 저장이 쓰는 PDF
        window.__pdfText = null; const pdf = await quotePdfBlob(q);
        // ⬇ 엑셀로 저장(편집 중인 견적)
        editQuote(id); window.__aoa = null; await exportQuoteXlsx();
        const row = (window.__aoa || []).find(x => x && x[0] === '비고');
        state.editingQuote = null;
        return { htmlCell, printText, pdfText: window.__pdfText, pdfName: pdf && pdf.name, xlsx: row ? row[1] : null };
      }, QID);
      for (const [k, t] of [['HTML', r.htmlCell], ['인쇄', r.printText], ['PDF', r.pdfText], ['엑셀', r.xlsx]]) {
        assert.ok(typeof t === 'string', k + ' 견적서를 만들지 못함');
        assert.ok(!t.includes('[금액 수정]') && !t.includes('220,000→330,000') && !t.includes(A2), k + ' 비고에 내부 기록이 나간다 ' + JSON.stringify(norm(t).slice(-300)));
        assert.ok(t.includes(NOTE) && t.includes('원본: ' + A), k + ' 사용자 메모·v526 줄은 그대로 ' + JSON.stringify(norm(t).slice(-300)));
      }
      assert.equal(r.xlsx, memo.split('\n').filter(l => l !== REV).join('\n'), '엑셀 비고 = 기록 줄만 뺀 비고(줄 순서 그대로)');
      assert.ok(/^견적서_.*\.pdf$/.test(r.pdfName), 'PDF 이름 ' + r.pdfName);
      assert.equal(await page.evaluate(QUOTES), before, '내보내기만 했으니 저장된 견적 그대로');
    });

    await test('② 앱 안 — 견적 작성 화면 비고 칸·세무사용 증빙에는 기록이 그대로 · 저장된 비고 불변 (INSIDE)', async () => {
      const memo = await page.evaluate(id => state.quotes.find(q => q.id === id).memo, QID);
      await page.evaluate(id => { state.tab = 'quotemaker'; editQuote(id); }, QID);
      await page.waitForSelector('#qmMemo');
      const v = await page.inputValue('#qmMemo');
      assert.ok(v.includes(NOTE) && v.includes('[금액 수정] 2026-11-12 · 우수관 교체 220,000→330,000원') && v.includes(A2), '견적 작성 화면 비고 칸은 기록까지 보인다 ' + JSON.stringify(v));
      const ev = await page.evaluate(id => { const q = state.quotes.find(x => x.id === id); return { tax: hjEvidenceQuoteText(q, { internal: true, hideAmount: false }), cust: hjEvidenceQuoteText(q, { internal: false, hideAmount: false }) }; }, QID);
      assert.ok(ev.tax.includes('비고(내부): ') && ev.tax.includes(REV), '세무사용 증빙은 내부 기록 그대로 ' + JSON.stringify(ev.tax.slice(-200)));
      assert.ok(!ev.cust.includes('[금액 수정]') && !ev.cust.includes(NOTE), '고객용 증빙은 원래 비고를 싣지 않는다');
      await page.evaluate(() => { state.editingQuote = null; state.tab = 'estimates'; render(); });
      assert.equal(await page.evaluate(id => state.quotes.find(q => q.id === id).memo, QID), memo, '저장된 비고 한 글자도 안 바뀜');
    });

    await test('③ 줄바꿈이 사라진 비고·두 번 고친 기록·손으로 적은 줄·’ 든 파일 이름도 빠진다 · 다른 줄은 그대로 (GLUED)', async () => {
      // 견적 작성 화면 비고 칸은 한 줄 입력 — 칸을 고치면 줄바꿈이 사라져 기록이 앞 글에 붙은 채 저장된다
      await page.evaluate(id => { state.tab = 'quotemaker'; editQuote(id); }, QID);
      await page.waitForSelector('#qmMemo');
      await page.click('#qmMemo'); await page.keyboard.press('End'); await page.keyboard.type(' 확인함');
      await page.click('#qmTitle');   // change → setQuoteField('memo')
      const glued = await page.evaluate(() => state.editingQuote.memo);
      assert.ok(!glued.includes('\n') && glued.includes('[금액 수정]') && glued.endsWith('확인함'), '칸을 고치면 한 줄로 붙는다(기존 동작) ' + JSON.stringify(glued));
      // [📄 PDF 출력] — 자동 저장 뒤 숨은 iframe 에 견적서를 쓴다
      await page.click('#qmPdf');
      await page.waitForFunction(() => { const f = document.getElementById('printFrame'); return f && f.contentDocument && /견 적 서|견적서/.test(f.contentDocument.body.textContent); });
      const out = await page.evaluate(id => {
        const fr = document.getElementById('printFrame'); fr.contentWindow.print = () => {};
        const tr = [...fr.contentDocument.querySelectorAll('.qcond tr')].find(t => /비고/.test(t.textContent));
        return { saved: state.quotes.find(q => q.id === id).memo, print: tr ? tr.lastElementChild.textContent : null };
      }, QID);
      assert.equal(out.saved, glued, '[PDF 출력]은 고친 비고를 저장한다(기존 동작)');
      assert.ok(typeof out.print === 'string' && !out.print.includes('[금액 수정]') && !out.print.includes('→') && !out.print.includes(A2), '붙은 기록도 인쇄에서 빠진다 ' + JSON.stringify(out.print));
      assert.ok(out.print.startsWith(NOTE) && out.print.includes('원본: ' + A) && out.print.endsWith('확인함'), '앞뒤 글은 그대로 ' + JSON.stringify(out.print));
      await page.click('#qmXlsx');
      await page.waitForFunction(() => Array.isArray(window.__aoa) && window.__aoa.some(x => x && x[0] === '비고' && /확인함/.test(String(x[1]))));
      const xl = await page.evaluate(() => window.__aoa.find(x => x[0] === '비고')[1]);
      assert.ok(!xl.includes('[금액 수정]') && !xl.includes(A2) && xl.startsWith(NOTE) && xl.endsWith('확인함'), '붙은 기록도 엑셀에서 빠진다 ' + JSON.stringify(xl));
      await page.evaluate(() => { state.editingQuote = null; state.tab = 'estimates'; render(); });
      // 줄 단위 규칙(같은 hjQuoteMemoOut — 화면 두 곳이 쓰는 한 곳)
      const u = await page.evaluate(() => {
        const R = (d, w, f, t, file) => '[금액 수정] ' + d + ' · ' + w + ' ' + hjNum(f) + '→' + hjNum(t) + '원 · 원본 ‘' + file + '’';
        const two = ['메모', '원본: a.xlsx', R('2026-11-12', '타일', 100000, 120000, 'b.xlsx'), R('2026-11-13', '타일', 120000, 90000, 'c.xlsx')].join('\n');
        const glued2 = '메모' + R('2026-11-12', '타일', 100000, 120000, 'b.xlsx') + R('2026-11-13', '실리콘 마감', 30000, 35000, 'c.xlsx') + ' 끝';
        return {
          two: hjQuoteMemoOut(two), glued2: hjQuoteMemoOut(glued2),
          hand: hjQuoteMemoOut('메모\n[금액 수정] 손으로 적은 메모\n  [금액 수정] 들여 쓴 줄'),
          apos: hjQuoteMemoOut('메모\n' + R('2026-11-12', '타일', 1, 2, 'Kim’s 수정.xlsx')),
          keep: hjQuoteMemoOut('금액 수정 요청 있음\n추가 금액 [협의]\n· 원본 ‘a.xlsx’ 그대로'),
          crlf: hjQuoteMemoOut('메모\r\n' + R('2026-11-12', '타일', 1, 2, 'b.xlsx') + '\r\n뒤'),
          empty: [hjQuoteMemoOut(''), hjQuoteMemoOut(undefined), hjQuoteMemoOut(null), hjQuoteMemoOut(R('2026-11-12', '타일', 1, 2, 'b.xlsx'))]
        };
      });
      assert.equal(u.two, '메모\n원본: a.xlsx', '두 번 고친 기록 ' + JSON.stringify(u.two));
      assert.equal(u.glued2, '메모 끝', '한 줄에 붙은 기록 둘 ' + JSON.stringify(u.glued2));
      assert.equal(u.hand, '메모', "'[금액 수정]' 로 시작하는 줄은 꼴이 달라도 뺀다 " + JSON.stringify(u.hand));
      assert.equal(u.apos, '메모', "’ 든 파일 이름의 기록 줄도 통째로 " + JSON.stringify(u.apos));
      assert.equal(u.keep, '금액 수정 요청 있음\n추가 금액 [협의]\n· 원본 ‘a.xlsx’ 그대로', '다른 줄은 그대로 ' + JSON.stringify(u.keep));
      assert.equal(u.crlf, '메모\r\n뒤', 'CRLF 비고 ' + JSON.stringify(u.crlf));
      assert.deepEqual(u.empty, ['', '', '', ''], '빈 비고·기록만 있는 비고 ' + JSON.stringify(u.empty));
    });

    await test('④ 폰 390 견적 작성 화면 넘침 없음 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(id => { state.tab = 'quotemaker'; editQuote(id); }, QID);
      await page.waitForSelector('#qmMemo');
      const over = await page.evaluate(() => (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0));
      assert.equal(over, 0, '넘침 없음');
      await page.evaluate(() => { state.editingQuote = null; state.tab = 'estimates'; render(); });
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('revmemo-v597: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL revmemo-v597', e && e.stack || e); process.exit(1); });
