/* ledger-roundtrip.e2e.js — 📤 전체 장부 엑셀 → 📥 데이터 이사 왕복 (Playwright)

   2026-09-26: v193(2026-08-14)에서 전체 장부 ① 현장 시트의 '수금' 뒤 칸 하나를 빼며 뒤 칸이 한 칸씩 당겨졌는데,
   이사 마법사의 가져오기는 옛 자리(8·9·10·13)를 그대로 읽었다. 기기를 옮긴 뒤 모든 현장의 자재비 자리에 인건비,
   인건비 자리에 외주비, 외주비 자리에 마진, 완료일 자리에 무상만료(미래 날짜)가 조용히 들어갔다 — 마진·완료월 통계·
   보증 기산이 다 틀린다. '(보관)' 표시는 벗기기만 해서 끝난 현장이 전부 진행 목록으로 돌아왔다. 지키는 것:
     ① 내보낸 파일을 빈 기기로 가져오면 현장이 그대로 온다 — 원가 셋·완료일·단계·보관·고객·수금·견적 합계, 그리고
        projStats(자재·인건·외주·유효마진·견적·수금)와 무상만료가 내보내기 전과 같다(원가가 지출 장부에서 온 현장 포함)
     ② 연락처·단가장·거래처(+담당 품목)·수금이력·AS이력도 그대로 — 같은 날 같은 금액 두 번 입금·음수 정정·
        같은 증상의 재접수(다른 날)가 한 건으로 뭉개지거나 부호가 뒤집히지 않는다
     ③ 같은 파일을 한 번 더 가져오면 아무것도 늘지 않고 요약에 '중복 건너뜀' 이 뜬다
     ④ 열은 제목으로 찾는다 — v193 이전(칸이 하나 더 있던) 파일·순서를 뒤섞은 파일이 맞게 들어오고, 제목을 전부 바꾼
        파일은 지금 자리로 읽고, 제목을 일부만 찾으면 못 찾은 칸을 옆 칸 값으로 채우지 않는다. 글자로 적힌 음수 금액도 산다.
        AS 는 접수일까지 같아야 중복이다(재접수만 먼저 적어 둔 기기에서 첫 접수가 빠지지 않는다)
     ⑤ 꼭 있어야 할 칸이 빈 줄은 요약에 '읽을 수 없어 건너뜀 N' 으로 보이고, 옮기지 않은 시트 이름을 밝힌다
     ⑥ 카드 문구의 시트 수 = 실제로 내보내는 시트 수, pageerror 0
     ⑦ (v328) 추가공사 시트 — 확인받은 추가공사가 잔금(due)에 더해지므로 이사 뒤 extra·due 가 같다. 확인 전·'50만' 같은
        금액 확인 필요 건도 그대로, 견적에 담긴 건은 견적 합계에 이미 있어 옮기지 않고 요약에 밝힌다. 두 번 가져와도 두 벌이 안 된다
     ⑧ (v330) AS 기록 칸(v329: 방문일·처리내용·유상금액·공종)도 왕복 — 유상 금액·'무상'(금액 칸을 다룸)·빈칸(옛 완료 건 —
        무상을 지어내지 않는다)이 그대로 돌아오고, 사진은 옮기지 않되 몇 장인지 요약에 밝힌다. 옛 4칸 파일은 새 칸을 짓지 않는다
     ⑨ (v330) 현장 규칙(부대사항 siteRules) 시트 — 칸 내용과 칸별 확인일(atMap)이 돌아오고, 출입번호로 보이는 칸은 내보내지도
        들이지도 않는다. 이 기기에 이미 적힌 칸은 덮지 않는다

   XLSX 는 CDN 라이브러리라 검사에서는 스텁이다(apt-integrate 와 같은 방식). writeFile 이 workbook 을 JSON 글자로
   굳혀 두고(숫자는 숫자, 글자는 글자 — 엑셀 파일 왕복과 같은 성질), read 가 그 글자를 다시 푼다. 가져오기는 실제
   화면 길(이사 마법사 카드 → 파일 고르기 → __iwReadFile → __iwFullImport → 요약 창)로 돈다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const A = '둔산동 가상현장', B = '유성 가상보관현장', C = '서구 가상실측현장';

/* 어느 칸이 어떻게 달라졌는지 이름으로 말한다 — '뭔가 틀렸다'만 말하는 단정은 고칠 수 없다 */
function diffSnap(before, after) {
  const out = [];
  const bp = Object.fromEntries(before.projects.map(p => [p.name, p]));
  const ap = Object.fromEntries(after.projects.map(p => [p.name, p]));
  Object.keys(bp).forEach(n => {
    if (!ap[n]) { out.push('현장 ' + n + ' 없음'); return; }
    Object.keys(bp[n]).forEach(k => {
      if (JSON.stringify(bp[n][k]) !== JSON.stringify(ap[n][k])) out.push(n + '.' + k + ': ' + JSON.stringify(bp[n][k]) + ' → ' + JSON.stringify(ap[n][k]));
    });
  });
  Object.keys(ap).forEach(n => { if (!bp[n]) out.push('없던 현장 ' + n); });
  Object.keys(before).filter(k => k !== 'projects').forEach(k => {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.push(k + ': ' + JSON.stringify(before[k]) + ' → ' + JSON.stringify(after[k]));
  });
  return out;
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone, __hjRelayBootDone]);
    // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    const clone = v => JSON.parse(JSON.stringify(v));
    window.XLSX = {
      utils: {
        book_new: () => ({ SheetNames: [], Sheets: {} }),
        aoa_to_sheet: aoa => ({ __aoa: clone(aoa) }),
        book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
        sheet_to_json: (ws, opt) => {
          const rows = clone(ws.__aoa || []);
          const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
          if (!opt || opt.defval === undefined) return rows;
          return rows.map(r => { const o = r.slice(); for (let i = 0; i < w; i++) if (o[i] == null) o[i] = opt.defval; return o; });
        }
      },
      writeFile: (wb, name) => { window.__xlWritten = { name, json: JSON.stringify(wb) }; },
      read: () => JSON.parse(window.__xlFileJson)
    };
    window.__snap = () => {
      const byName = (a, b) => a.name.localeCompare(b.name);
      return {
        projects: state.projects.slice().sort(byName).map(p => {
          const s = projStats(p.name), w = hjWarranty(p), c = p.customer || {};
          return { name: p.name, stage: p.stage || 0, archived: !!p.archived, doneAt: p.doneAt || '', received: p.received || 0,
            cust: [c.name || '', c.phone || '', c.addr || ''], material: s.material, labor: s.labor, outsource: s.outsource,
            est: s.est, recv: s.recv, marginEff: s.marginEff, warrantyEnd: w ? w.end : '',
            // v328: 확인받은 추가공사는 잔금(due)에 더해진다 — 이사에서 빠지면 잔금이 조용히 준다(⑦)
            extra: s.extra, due: s.due,
            // 견적에 담긴 것은 견적 합계(이관 견적)로 옮겨 가므로 목록 비교에서 뺀다 — 금액은 est·due 로 비교된다
            extras: (Array.isArray(p.extras) ? p.extras : []).filter(x => !hjExtrasBill(p).quoted.includes(x) && (String(x.text || '').trim() || String(x.amount || '').trim())).map(x => [x.date || '', x.text || '', String(x.amount == null ? '' : x.amount), !!x.agreed, x.agreedAt || '', String(x.days || '')].join('|')).sort() };
        }),
        contacts: (state.contacts || []).map(c => [c.name, c.phone, c.company, c.memo].join('|')).sort(),
        priceBook: Object.entries(state.priceBook || {}).map(e => e.join('|')).sort(),
        suppliers: (state.suppliers || []).map(s => s.name + '|' + (s.phone || '')).sort(),
        supplierMap: Object.entries(state.supplierMap || {}).map(e => e.join('|')).sort(),
        payLog: (state.payLog || []).map(x => [x.d, x.project, x.amt].join('|')).sort(),
        // ⑧ v329 AS 기록 칸 — fee 는 키가 있는지('' = 무상 표시)까지 비교한다(빈칸을 무상으로 들이면 지어낸 사실이다)
        asLog: (state.asLog || []).map(a => [a.project, a.date, a.text, a.status, a.visitAt || '', a.fix || '', 'fee' in a ? JSON.stringify(a.fee) : '-', a.warrantyItem || ''].join('|')).sort(),
        // ⑨ 현장 규칙 — 칸 값과 칸별 확인일(atMap). 출입번호가 섞인 칸은 비교에서 뺀다(내보내지 않는 것이 약속이다 — 따로 단정)
        siteRules: state.projects.map(p => { const r = hjSiteRulesSafe(hjSiteRules(p)) || {}, am = r.atMap || {};
          return p.name + '=' + HJ_SITE_FIELDS.filter(f => String(r[f.k] || '').trim()).map(f => f.k + ':' + r[f.k] + '@' + (am[f.k] || r.at || '')).join(','); }).sort()
      };
    };
    window.__wipe = () => {
      state.projects = []; state.files = []; state.expenses = []; state.contacts = []; state.priceBook = {};
      state.suppliers = []; state.supplierMap = {}; state.payLog = []; state.asLog = []; state.activeProject = null; state.quotes = [];
    };
  });
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');

  // 시드 — 원가는 셋 다 다른 값(100/200/300)이라 한 칸 밀리면 바로 드러난다. 완료일은 과거, 무상만료는 미래.
  await page.evaluate(({ A, B, C }) => {
    state.projects = [
      { name: A, stage: 3, received: 6500000, phases: [], cost: { material: 100, labor: 200, outsource: 300 }, doneAt: '2026-03-15',
        customer: { name: '가상고객 갑', phone: '010-0000-1234', addr: '대전 가상구 가상로 1' } },
      { name: B, stage: 3, archived: true, received: 1000000, phases: [], cost: { material: 400, labor: 0, outsource: 0 }, doneAt: '2025-11-02',
        customer: { name: '가상고객 을', phone: '010-0000-5678', addr: '' } },
      { name: C, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }
    ];
    state.files = [
      { id: 'e1', name: '가상 견적 갑.xlsx', ext: 'xlsx', kind: 'estimate', project: A, est: { amount: 9000000, date: '2026-02-01' }, when: new Date('2026-02-01') },
      { id: 'e2', name: '가상 견적 을.xlsx', ext: 'xlsx', kind: 'estimate', project: B, est: { amount: 2500000, date: '2025-10-01' }, when: new Date('2025-10-01') }
    ];
    // C 의 자재비는 수기가 아니라 지출 장부에서 온다 — 장부는 이사하지 않으므로 현장 시트의 값이 원가로 들어와야 한다
    state.expenses = [{ id: 'x1', date: '2026-05-01', project: C, category: '자재비', amount: 4000, method: '카드', memo: '가상 자재' }];
    state.contacts = [
      { id: 'c1', name: '가상 타일반장', phone: '010-0000-1111', company: '가상타일', title: '', email: '', memo: '욕실 전문' },
      { id: 'c2', name: '가상 설비기사', phone: '010-0000-2222', company: '', title: '', email: '', memo: '주말 가능' }
    ];
    state.priceBook = { '가상 타일 시공': 35000, '가상 도배': 12000 };
    state.suppliers = [{ name: '가상자재상', phone: '010-0000-3333' }];
    state.supplierMap = { '가상 타일': '가상자재상', '가상 레미탈': '가상자재상' };
    state.payLog = [
      { d: '2026-02-10', project: A, amt: 3000000 },
      { d: '2026-03-10', project: A, amt: 2000000 },
      { d: '2026-03-10', project: A, amt: 2000000 },   // 같은 날 같은 금액 두 번 — 두 건이다
      { d: '2026-03-12', project: A, amt: -500000 },   // 정정(음수)
      { d: '2025-10-20', project: B, amt: 1000000 }
    ];
    state.asLog = [
      { id: 'a1', project: A, date: '2026-04-01', text: '욕실 실리콘 들뜸', status: 'done' },
      { id: 'a2', project: A, date: '2026-06-01', text: '욕실 실리콘 들뜸', status: 'open' },   // 같은 증상 재접수
      { id: 'a3', project: B, date: '2026-01-05', text: '도배 이음새 벌어짐', status: 'doing' }
    ];
    // ⑧ v329 기록 칸 — a1 유상(사진 2장), a2 무상(금액 칸을 비워 다룸), a3 는 옛 기록(새 칸 없음 — 무상이 지어지면 안 된다)
    Object.assign(state.asLog[0], { visitAt: '2026-04-03', fix: '실리콘 재시공', fee: 50000, warrantyItem: '욕실 방수', photos: ['k:가상1|1', 'k:가상2|2'] });
    Object.assign(state.asLog[1], { visitAt: '2026-06-02', fix: '', fee: '' });
    // ⑨ 현장 규칙 — 칸별 확인일이 다르고(atMap), 한 칸은 출입번호(옛 버전에서 섞여 들어온 값 — 내보내면 안 된다)
    state.projects[0].siteRules = { park: '지하 2층 가상구역', waste: '만물 자가 반출', etc: '공동현관 1234', at: '2026-05-01', atMap: { park: '2026-03-01', waste: '2026-05-01' } };
    state.projects[1].siteRules = { elev: '사용 전날 예약', at: '2025-10-10' };   // atMap 없는 옛 기록 — at 이 그 칸의 확인일
    state.aptOrders = []; state.quotes = [];
    // ⑦ 추가공사 — 확인받음(청구에 더함)·확인 전·금액 확인 필요('50만')·견적에 담김(C 의 앱 견적 품목 extraId)
    state.projects[0].extras = [
      { id: 'xa1', date: '2026-03-01', text: '거실 선반 설치', amount: '500000', days: '1', photo: '', agreed: true, agreedAt: '2026-03-02' },
      { id: 'xa2', date: '2026-03-05', text: '현관 중문', amount: '300000', days: '', photo: '', agreed: false },
      { id: 'xa3', date: '2026-03-06', text: '콘센트 추가', amount: '50만', days: '', photo: '', agreed: true, agreedAt: '2026-03-06' },
      { id: 'xa4', date: '2026-03-07', text: '', amount: '', days: '', photo: '', agreed: false }   // 막 추가한 빈 칸 — 옮기지 않는다
    ];
    state.projects[2].extras = [{ id: 'xc1', date: '2026-05-02', text: '문틀 교체', amount: '200000', days: '', photo: '', agreed: true, agreedAt: '2026-05-02' }];
    const qc = { id: 'qc1', no: 'Q-C', title: '가상실측', date: '2026-05-01', place: '', vatIncluded: false, accountIdx: 0, memo: '', project: C,
      items: [{ name: '도배', spec: '', qty: 1, price: 1000000 }, { name: '[추가] 문틀 교체', spec: '', qty: 1, price: 200000, extraId: 'xc1' }] };
    state.quotes.push(qc); syncQuoteToProject(qc);
  }, { A, B, C });

  const before = await page.evaluate(() => window.__snap());
  // 시드가 사고 조건을 실제로 만든다 — 아니면 ①이 통과해도 아무것도 안 지킨다
  const pA = before.projects.find(p => p.name === A), pC = before.projects.find(p => p.name === C);
  assert(pA.material === 100 && pA.labor === 200 && pA.outsource === 300 && pA.warrantyEnd > '2027', '시드: A 원가 셋이 다르고 무상만료가 미래다: ' + JSON.stringify(pA));
  assert(pC.material === 4000, '시드: C 자재비는 지출 장부에서 온다: ' + JSON.stringify(pC));
  assert(pA.extra === 500000 && pA.due === pA.est + 500000 - pA.recv && pC.est === 1200000 && pC.extra === 0, '시드: A 는 추가공사 50만이 잔금에, C 는 견적에 담김: ' + JSON.stringify({ pA, pC }));

  // 내보내기
  const exp = await page.evaluate(async () => {
    const r = await exportFullXlsx();
    window.__xlFileJson = window.__xlWritten.json;
    const wb = JSON.parse(window.__xlWritten.json);
    return { ret: r, sheets: wb.SheetNames, head: wb.Sheets['현장'].__aoa[0] };
  });
  // v328: ⑪ 추가공사 시트가 붙어 11 (v328 통합 검토 — 없으면 이사한 기기의 잔금이 추가공사만큼 준다)
  // v330: ⑫ 현장규칙 시트가 붙어 12 (부대사항이 이사 경로에 없던 v284 남은 한계)
  assert(exp.sheets.length === 12 && exp.sheets[10] === '추가공사' && exp.sheets[11] === '현장규칙' && exp.ret && exp.ret.시트 === exp.sheets.length, '내보내기 시트 수: ' + JSON.stringify(exp.sheets) + ' / ' + JSON.stringify(exp.ret));
  // ⑨ 출입번호 칸은 파일에 아예 없다 — 가져올 때 거르는 것만으로는 세무사·외주팀에게 나간 파일에서 샌다
  const srSheet = await page.evaluate(() => JSON.parse(window.__xlWritten.json).Sheets['현장규칙'].__aoa);
  assert(!/1234/.test(JSON.stringify(srSheet)) && srSheet.length === 4, '⑨ 현장규칙 시트에 출입번호가 없고 세 칸만: ' + JSON.stringify(srSheet));
  // ⑧ AS 시트 — 유상 50000, 무상 표시, 옛 기록은 빈칸(지어내지 않는다), 사진은 장 수만
  const asSheet = await page.evaluate(() => JSON.parse(window.__xlWritten.json).Sheets['AS이력'].__aoa);
  const asRow = t => asSheet.find(r => r[0] === t) || [];
  assert(asRow('2026-04-01')[6] === 50000 && asRow('2026-06-01')[6] === '무상' && asRow('2026-01-05')[6] === '' && asRow('2026-04-01')[8] === 2,
    '⑧ AS 시트 유상금액·사진 칸: ' + JSON.stringify(asSheet));

  // 화면 길로 가져오기 — 이사 마법사 → '우리 앱 전체장부 엑셀' 카드 → 파일 고르기
  const importViaWizard = async () => {
    await page.evaluate(() => { closeModal(); importWizard(); });
    const chooser = page.waitForEvent('filechooser');
    await page.click('#modalRoot .iwCard[data-iw="full"]');
    const fc = await chooser;
    await fc.setFiles({ name: '가상_전체장부.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('stub') });
    await page.waitForFunction(() => /전체장부 이사 완료/.test((document.querySelector('#modalRoot') || {}).textContent || ''));
    return modalText();
  };

  // ⑥ 카드 문구의 시트 수
  await page.evaluate(() => importWizard());
  const card = await page.evaluate(() => (document.querySelector('#modalRoot .iwCard[data-iw="full"]') || {}).textContent || '');
  assert(card.indexOf(exp.sheets.length + '시트') >= 0, '⑥ 카드가 실제 시트 수(' + exp.sheets.length + ')를 말한다: ' + card);

  // ① ② 빈 기기로 이사
  await page.evaluate(() => window.__wipe());
  const sum1 = await importViaWizard();
  const after = await page.evaluate(() => window.__snap());
  const d1 = diffSnap(before, after);
  assert(d1.length === 0, '①② 왕복 뒤 값이 달라졌다:\n  ' + d1.join('\n  '));
  const raw = await page.evaluate(({ A, B, C }) => {
    const g = n => state.projects.find(p => p.name === n) || {};
    return { a: g(A), b: g(B), c: g(C), files: state.files.filter(f => f.kind === 'estimate').length };
  }, { A, B, C });
  assert(raw.a.cost && raw.a.cost.material === 100 && raw.a.cost.labor === 200 && raw.a.cost.outsource === 300, '① A 원가가 제자리: ' + JSON.stringify(raw.a.cost));
  assert(raw.a.doneAt === '2026-03-15', '① A 완료일이 무상만료가 아니라 완료일: ' + raw.a.doneAt);
  assert(raw.b.archived === true && raw.b.stage === 3, '① B 는 보관 현장으로 돌아온다: ' + JSON.stringify({ archived: raw.b.archived, stage: raw.b.stage }));
  assert(!raw.a.archived && !raw.c.archived, '① 보관 아닌 현장은 보관되지 않는다');
  assert(raw.c.stage === 1 && !raw.c.doneAt && raw.c.cost.material === 4000, '① C: 실측·완료일 없음·장부 자재비가 원가로: ' + JSON.stringify(raw.c));
  assert(/현장: 추가 3/.test(sum1) && /수금이력: 추가 5/.test(sum1) && /AS이력: 추가 3/.test(sum1) && /연락처: 추가 2/.test(sum1) && /단가장: 추가 2/.test(sum1) && /거래처: 추가 1/.test(sum1),
    '② 요약 건수: ' + sum1);
  assert(!/읽을 수 없어/.test(sum1), '⑤ 못 읽은 줄이 없는데 경고가 뜬다: ' + sum1);
  // ⑦ 추가공사 — 세 건 옮기고(빈 칸은 안 내보냄), 견적에 담긴 C 의 한 건은 견적 합계에 이미 있어 옮기지 않았다고 밝힌다
  assert(/추가공사: 추가 3/.test(sum1) && /견적에 담긴 1건은 견적 합계에 이미 들어 있어 옮기지 않음/.test(sum1), '⑦ 추가공사 요약: ' + sum1);
  assert(/AS 사진 2장 연결은 옮기지 않음/.test(sum1), '⑧ AS 사진은 옮기지 않았다고 밝힌다: ' + sum1);
  assert(/현장규칙: 추가 3/.test(sum1), '⑨ 현장규칙 요약: ' + sum1);
  const vs = await page.evaluate(() => (state.asLog || []).map(a => !!a.visitSchedId || Array.isArray(a.photos)));
  assert(vs.every(x => !x), '⑧ 옮기지 않은 일정·사진 연결을 지어내지 않는다: ' + JSON.stringify(vs));
  // ⑤ 옮기지 않은 시트를 밝힌다
  const left = exp.sheets.filter(n => !['현장', '연락처', '단가장', '거래처', '수금이력', 'AS이력', '추가공사', '현장규칙'].includes(n));
  const note = await page.evaluate(() => (document.querySelector('#modalRoot .iwNote') || {}).textContent || '');
  assert(left.length === 4 && left.every(n => note.indexOf(n) >= 0) && note.indexOf('현장 시트') >= 0, '⑤ 옮기지 않은 시트(' + left.join('·') + ')를 밝힌다: ' + note);
  assert(['수금이력', 'AS이력', '연락처', '단가장', '거래처', '추가공사', '현장규칙'].every(n => note.indexOf(n) < 0), '⑤ 옮긴 시트를 안 옮겼다고 하지 않는다: ' + note);

  // ③ 같은 파일을 한 번 더 — 아무것도 늘지 않는다
  const nFiles = raw.files;
  const sum2 = await importViaWizard();
  const again = await page.evaluate(() => window.__snap());
  const d2 = diffSnap(before, again);
  assert(d2.length === 0, '③ 두 번째 가져오기에서 값이 늘거나 바뀌었다:\n  ' + d2.join('\n  '));
  assert(await page.evaluate(() => state.files.filter(f => f.kind === 'estimate').length) === nFiles, '③ 이관 견적 파일이 늘었다');
  assert(/추가공사: 추가 0 · 중복 건너뜀 3/.test(sum2), '③⑦ 추가공사도 두 번 가져와 두 벌이 되지 않는다: ' + sum2);
  assert(/현장규칙: 추가 0 · 중복 건너뜀 3/.test(sum2), '③⑨ 현장규칙도 두 번 가져와 늘지 않는다: ' + sum2);
  assert(/현장: 추가 0 · 중복 건너뜀 3/.test(sum2) && /수금이력: 추가 0 · 중복 건너뜀 5/.test(sum2) && /AS이력: 추가 0 · 중복 건너뜀 3/.test(sum2)
    && /연락처: 추가 0 · 중복 건너뜀 2/.test(sum2) && /거래처: 추가 0 · 중복 건너뜀 1/.test(sum2), '③ 요약에 중복 건너뜀: ' + sum2);

  // ④ 열 순서·제목이 다른 파일
  const layouts = await page.evaluate(({ A }) => {
    const OLD = ['현장', '단계', '고객', '연락처', '주소', '견적합계', '수금', '미수', '자재비', '인건비', '외주비', '마진', '마진율%', '완료일', '무상만료'];
    const oldRow = [A, '완료(보관)', '가상고객 갑', '010-0000-1234', '', 9000000, 6500000, 2500000, 100, 200, 300, 8999400, 99, '2026-03-15', '2029-03-15'];
    const book = (sheets) => ({ SheetNames: Object.keys(sheets), Sheets: Object.fromEntries(Object.entries(sheets).map(([k, v]) => [k, { __aoa: v }])) });
    const run = (wb) => { window.__wipe(); const R = __iwFullImport(wb); const p = state.projects[0] || {}; return { R, cost: p.cost, doneAt: p.doneAt || '', archived: !!p.archived, stage: p.stage, received: p.received, est: projStats(p.name).est, pay: (state.payLog || []).map(x => x.amt) }; };
    // a. v193 이전 파일 — '수금' 뒤에 칸이 하나 더 있다
    const a = run(book({ '현장': [OLD, oldRow] }));
    // b. 순서를 거꾸로 뒤집은 파일
    const idx = OLD.map((_, i) => i).reverse();
    const b = run(book({ '현장': [idx.map(i => OLD[i]), idx.map(i => oldRow[i])] }));
    // c. 제목을 전부 바꾼 파일(지금 내보내기의 자리) — 지금 자리로 읽는다. 단계를 손으로 고쳐 쓴 글('시공중')도 단계로 읽는다
    const NOW = ['site', 'stage', 'cust', 'tel', 'addr', 'est', 'recv', 'mat', 'lab', 'out', 'margin', 'rate', 'done', 'free'];
    const nowRow = [A, '시공중', '가상고객 갑', '010-0000-1234', '', 9000000, 6500000, 100, 200, 300, 8999400, 99, '2026-03-15', '2029-03-15'];
    const c = run(book({ '현장': [NOW, nowRow] }));
    // d. 옛 파일인데 '자재비' 제목만 바뀜 — 옆 칸(2,500,000)으로 채우지 않는다
    const OLD2 = OLD.slice(); OLD2[8] = '자재';
    const d = run(book({ '현장': [OLD2, oldRow] }));
    // e. 수금 이력 금액을 글자로 적은 파일(엑셀에서 손본 경우) — '-500,000원' 은 음수다. 숫자 칸의 소수점은 반올림(글자처럼
    //    숫자만 뽑으면 12345.6 이 123456 이 된다)
    const e = run(book({ '현장': [OLD, oldRow], '수금이력': [['일자', '현장', '금액'], ['2026.03.12', A, '-500,000원'], ['2026-03-10', A, '2,000,000']],
      '단가장': [['품목', '단가'], ['가상 소수 단가', 12345.6]] }));
    e.price = state.priceBook['가상 소수 단가'];
    // f. 06-01 재접수만 먼저 적어 둔 기기로 가져오기 — 같은 증상이라도 접수일이 다르면 다른 건이다.
    //    증상만 보고 짝을 지으면 04-01 건이 '중복'으로 빠지고 06-01 건이 두 벌이 된다
    window.__wipe();
    state.asLog = [{ id: 'pre', project: A, date: '2026-06-01', text: '욕실 실리콘 들뜸', status: 'open' }];
    const full = JSON.parse(window.__xlWritten.json);
    const f = { R: __iwFullImport({ SheetNames: ['AS이력'], Sheets: { 'AS이력': full.Sheets['AS이력'] } })['AS이력'],
      as: state.asLog.map(x => x.project + '|' + x.date + '|' + x.text).sort() };
    // g. 접수일이 빈 AS 줄 — 가져올 때 오늘 날짜가 붙으니, 다시 가져오면 증상으로 짝을 짓는다(두 벌 금지)
    window.__wipe();
    const gwb = book({ 'AS이력': [['접수일', '현장', '증상', '상태'], ['', A, '가상 날짜 없는 접수', '접수']] });
    const g1 = __iwFullImport(gwb)['AS이력'], g2 = __iwFullImport(gwb)['AS이력'];
    const g = { g1, g2, n: state.asLog.length };
    // h. v328 이전(AS 네 칸) 파일 — 새 칸을 짓지 않는다(무상 표시 포함). 손으로 고친 파일의 '0원'·알 수 없는 글자
    window.__wipe();
    __iwFullImport(book({ 'AS이력': [['접수일', '현장', '증상', '상태'], ['2026-04-01', A, '가상 옛 접수', '완료']] }));
    const h = { old: JSON.parse(JSON.stringify(state.asLog.map(({ id, ...x }) => x))) };
    window.__wipe();
    __iwFullImport(book({ 'AS이력': [['상태', '현장', '공종', '증상', '유상금액', '접수일'], ['완료', A, '가상 공종', '가상 0원 표기', '0원', '2026-04-02'], ['완료', A, '', '가상 확인필요', '확인 필요', '2026-04-03']] }));
    h.edited = state.asLog.map(x => [x.text, 'fee' in x ? JSON.stringify(x.fee) : '-', x.warrantyItem || '']);
    // i. 현장규칙 — 이 기기에 이미 적힌 칸은 덮지 않고, 손으로 넣은 출입번호는 들이지 않는다
    window.__wipe();
    state.projects = [{ name: A, stage: 1, received: 0, phases: [], cost: {}, siteRules: { park: '이 기기 값', at: '2026-09-01', atMap: { park: '2026-09-01' } } }];
    const iR = __iwFullImport(book({ '현장규칙': [['현장', '항목', '내용', '확인일'], [A, '주차', '옛 파일 값', '2026-01-01'], [A, '그 밖에 알아둘 것', '비번 5678', '2026-01-01'], [A, '엘리베이터·보양', '보양 필수', '2026-02-02'], ['없는 현장', '주차', 'x', '']] }))['현장규칙'];
    const i = { R: iR, rules: JSON.parse(JSON.stringify(state.projects[0].siteRules)) };
    return { a, b, c, d, e, f, g, h, i };
  }, { A });
  const okCost = x => x.cost && x.cost.material === 100 && x.cost.labor === 200 && x.cost.outsource === 300 && x.doneAt === '2026-03-15';
  assert(okCost(layouts.a) && layouts.a.archived && layouts.a.stage === 3 && layouts.a.received === 6500000 && layouts.a.est === 9000000, '④a v193 이전 파일: ' + JSON.stringify(layouts.a));
  assert(okCost(layouts.b) && layouts.b.archived && layouts.b.received === 6500000, '④b 순서를 뒤섞은 파일: ' + JSON.stringify(layouts.b));
  assert(okCost(layouts.c) && !layouts.c.archived && layouts.c.stage === 2 && layouts.c.received === 6500000 && layouts.c.est === 9000000, '④c 제목을 바꾼 파일은 지금 자리로: ' + JSON.stringify(layouts.c));
  assert(layouts.d.cost && layouts.d.cost.material === 0 && layouts.d.cost.labor === 200 && layouts.d.doneAt === '2026-03-15', '④d 못 찾은 칸을 옆 칸 값으로 채우지 않는다: ' + JSON.stringify(layouts.d));
  assert(JSON.stringify(layouts.e.pay.slice().sort((x, y) => x - y)) === JSON.stringify([-500000, 2000000]), '④e 글자로 적힌 음수 금액: ' + JSON.stringify(layouts.e.pay));
  assert(layouts.e.price === 12346, '④e 숫자 칸 소수점은 반올림: ' + layouts.e.price);
  assert(JSON.stringify(layouts.f.as) === JSON.stringify([B + '|2026-01-05|도배 이음새 벌어짐', A + '|2026-04-01|욕실 실리콘 들뜸', A + '|2026-06-01|욕실 실리콘 들뜸'].sort())
    && layouts.f.R.add === 2 && layouts.f.R.skip === 1, '④f 같은 증상 다른 접수일은 다른 건: ' + JSON.stringify(layouts.f));
  assert(layouts.g.n === 1 && layouts.g.g1.add === 1 && layouts.g.g2.skip === 1, '④g 접수일 없는 AS 를 두 번 가져와도 한 건: ' + JSON.stringify(layouts.g));
  assert(JSON.stringify(layouts.h.old) === JSON.stringify([{ project: A, date: '2026-04-01', text: '가상 옛 접수', status: 'done' }]), '⑧h 옛 네 칸 파일은 새 칸을 짓지 않는다: ' + JSON.stringify(layouts.h.old));
  assert(JSON.stringify(layouts.h.edited) === JSON.stringify([['가상 0원 표기', '""', '가상 공종'], ['가상 확인필요', '-', '']]), '⑧h 제목으로 찾고, 0원은 무상·알 수 없는 글자는 짓지 않는다: ' + JSON.stringify(layouts.h.edited));
  const ir = layouts.i.rules;
  assert(ir.park === '이 기기 값' && ir.atMap.park === '2026-09-01' && !ir.etc && ir.elev === '보양 필수' && ir.atMap.elev === '2026-02-02' && ir.at === '2026-09-01'
    && layouts.i.R.add === 1 && layouts.i.R.skip === 1 && layouts.i.R.bad === 1 && /출입번호로 보이는 1칸/.test(layouts.i.R.note || ''),
    '⑨i 있는 칸은 덮지 않고 출입번호는 안 들인다: ' + JSON.stringify(layouts.i));

  // ⑤ 꼭 있어야 할 칸이 빈 줄 — 요약에 보인다
  await page.evaluate(({ A }) => {
    const wb = JSON.parse(window.__xlWritten.json);
    wb.Sheets['현장'].__aoa.push(['', '상담', '이름 없는 현장', '', '', 0, 0, 0, 0, 0, 0, 0, '', '']);
    wb.Sheets['수금이력'].__aoa.push(['2026-03-01', A, ''], ['', A, 1000]);
    wb.Sheets['연락처'].__aoa.push(['', '010-0000-9999', '', '']);
    wb.Sheets['단가장'].__aoa.push(['가상 단가 없음', 0]);
    window.__xlFileJson = JSON.stringify(wb);
    window.__wipe();
  }, { A });
  const sum3 = await importViaWizard();
  assert(/현장: 추가 3 · 읽을 수 없어 건너뜀 1/.test(sum3) && /수금이력: 추가 5 · 읽을 수 없어 건너뜀 2/.test(sum3)
    && /연락처: 추가 2 · 읽을 수 없어 건너뜀 1/.test(sum3) && /단가장: 추가 2 · 읽을 수 없어 건너뜀 1/.test(sum3), '⑤ 못 읽은 줄 수: ' + sum3);
  assert(/꼭 있어야 할 칸/.test(sum3), '⑤ 못 읽은 줄이 무엇인지 설명한다: ' + sum3);
  const d3 = diffSnap(before, await page.evaluate(() => window.__snap()));
  assert(d3.length === 0, '⑤ 못 읽은 줄을 빼면 나머지는 그대로다:\n  ' + d3.join('\n  '));

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 현장 왕복 — 원가 셋·완료일·보관·단계·고객·수금·견적 합계·무상만료 그대로(장부 원가 포함)');
  console.log('PASS  ② 연락처·단가장·거래처·수금이력(두 번 입금·음수 정정)·AS이력(재접수) 그대로');
  console.log('PASS  ③ 같은 파일 두 번 — 늘지 않고 중복 건너뜀');
  console.log('PASS  ④ 열은 제목으로 — v193 이전·뒤섞은·제목 바꾼·일부 제목·글자 음수');
  console.log('PASS  ⑤ 못 읽은 줄 수·옮기지 않은 시트를 요약에 밝힘');
  console.log('PASS  ⑥ 카드 시트 수 = 실제 시트 수 · pageerror 0');
  console.log('PASS  ⑦ 추가공사 — 이사 뒤 extra·due 그대로, 견적에 담긴 것은 다시 안 더함');
  console.log('PASS  ⑧ AS 기록 칸(방문일·처리·유상/무상·공종) 왕복 — 옛 파일·빈칸에 무상을 짓지 않음, 사진은 장 수만 안내');
  console.log('PASS  ⑨ 현장 규칙 시트 — 칸별 확인일 왕복, 출입번호는 안 내보내고 안 들임, 있는 칸은 안 덮음');
  await browser.close();
})().catch(async e => { console.error('FAIL ', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });
