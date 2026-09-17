/* warranty-v313.e2e.js — v312 보증서 네 항목 회귀
   ⑤ 보증서 격자의 전/후 선택을 사진 공정(_phase)에 저장 — 공정 없는 사진만, 덮지 않고, 지우지 않고, 폴더 정리 사진은 건너뜀,
      강제 안전판 실패면 쓰지 않음, 체크박스로 끌 수 있음, 이름은 hjPhaseHit 가 자기 쪽으로만 읽는 상수
   ⑥ 발급 이력(p.warrantyLog) — PDF·워드·HTML 을 실제로 가져간 시점에만, html 없이, 거래명세서는 제외, 직렬화 왕복
   ⑦ 완료보증서(카톡) — 전2·후2 자동, 빈 쪽 숨김, blob:·초과 썸네일 제외, 종이(무옵션)는 빈 칸 그대로
   ⑧ 세대별(동·호수) 보증서 — 라벨이 작업장소·작업명·소속칸에, 사진은 그 세대에 명시 연결된 것만(같은 id 의 다른 아파트 제외),
      없는 id 는 null(fail closed), 세대 select 로 바꿔도 입력값 유지, 동·호수 모달에 입구
   전제: tests/static-server.js(8299). serviceWorkers:'block'. 자료는 전부 자기서술형 가짜값. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    // 4초 뒤 깨는 시더를 재운다(document-estimate-ui 가 배포를 막았던 그 함정)
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__origSnap = hjSnapshot; window.__origShare = hjWarrantyShareHtml;
  });

  // 매 테스트가 같은 출발점에서 시작한다 — 스텁 원복, 모달 닫기, 자료 새로 심기
  const seed = (files, projects, extra) => page.evaluate(({ files, projects, extra, PNG }) => {
    hjSnapshot = window.__origSnap; hjWarrantyShareHtml = window.__origShare;
    try { closeModal(true); } catch (e) {}
    window.__snapCalls = []; window.__phaseCalls = 0;
    const origSnap = window.__origSnap;
    hjSnapshot = async function (l, f, a) { window.__snapCalls.push([l, f, a]); return origSnap(l, f, a); };
    const origSet = setPhase, origBulk = applyBulkPhase;
    setPhase = function () { window.__phaseCalls++; return origSet.apply(this, arguments); };
    applyBulkPhase = function () { window.__phaseCalls++; return origBulk.apply(this, arguments); };
    state.projects = projects.map(p => ({ stage: 4, received: 0, archived: false, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객' }, ...p }));
    state.files = files.map(f => ({ name: '가상_' + f.id + '.png', prefix: '', kind: 'photo', ext: 'png', size: 10, thumb: 'data:image/png;base64,' + PNG, ...f, when: f.when ? new Date(f.when + 'T09:00:00') : null }));
    state.quotes = []; state.aptOffices = (extra && extra.offices) || []; state.activeProject = projects[0].name; state.dirty = false;
    window.__wrPick = null;
  }, { files, projects, extra: extra || null, PNG });
  const ph = id => page.evaluate(id => { const f = state.files.find(x => x.id === id); return f ? (f._phase === undefined ? null : f._phase) : 'NOFILE'; }, id);
  const clickMake = () => page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('보증서 만들기')); if (!b) throw new Error('[보증서 만들기] 없음'); b.click(); });
  const waitDoc = () => page.waitForFunction(() => !!document.querySelector('#modalRoot #hjDocPdf'), null, { timeout: 8000 });
  const settle = ms => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);

  const N = '가상보증현장';
  const basePhotos = [
    { id: 'e1', project: N, when: '2026-09-01' }, { id: 'e2', project: N, when: '2026-09-02' }, { id: 'e3', project: N, when: '2026-09-08' },
    { id: 'd1', project: N, when: '2026-09-03', _phase: '철거' }, { id: 't1', project: N, when: '2026-09-04', _phase: '타일' },
    { id: 'org1', project: N, when: '2026-09-05', prefix: '_정리완료/' + N + '/타일/' },
  ];
  const baseProject = { name: N, doneAt: '2026-09-01', phases: ['타일'] };

  // ── ⑤ ─────────────────────────────────────────────────────────────────────────
  await test('⑤ 만들기 = 저장: 공정 없는 사진만 채우고, 있는 것은 덮지 않고, 폴더 정리 사진은 건너뛴다', async () => {
    await seed(basePhotos, [baseProject]);
    const keysBefore = await page.evaluate(() => Object.keys(serializeData()).sort().join(','));
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['e1', 'd1', 't1', 'org1'], after: ['e3'] }; }, N);
    assert(await page.evaluate(() => !!document.getElementById('wrTag') && document.getElementById('wrTag').checked), '체크박스가 기본 켜짐이어야 한다');
    await clickMake(); await waitDoc();
    await page.waitForFunction(() => state.files.find(f => f.id === 'e1')._phase === '시공 전', null, { timeout: 8000 });
    assert((await ph('e3')) === '완료', 'e3 는 완료: ' + await ph('e3'));
    assert((await ph('e2')) === null, '안 고른 e2 는 그대로 비어 있어야 한다');
    assert((await ph('d1')) === '철거', "이미 '철거' 인 d1 을 덮었다");
    assert((await ph('t1')) === '타일', "다른 공정 '타일' 인 t1 을 덮었다");
    assert((await ph('org1')) === null, '폴더로 정리된 org1 은 건너뛰어야 한다(다시 읽으면 폴더가 이긴다)');
    const r = await page.evaluate(() => ({ snaps: window.__snapCalls, phaseCalls: window.__phaseCalls,
      ser: serializeData().files.find(f => f.key === 'e1' || f.name === '가상_e1.png'), phases: state.projects[0].phases, keys: Object.keys(serializeData()).sort().join(',') }));
    // markDirty() 가 뒤따라 부르는 일상 안전판('작업 중', 비강제)은 세지 않는다 — 여기서 보는 건 쓰기 직전의 강제 안전판 하나뿐
    const forced = r.snaps.filter(c => c[0] === '보증서 전/후 공정 저장 전');
    assert(forced.length === 1 && forced[0][1] === true && forced[0][2] === true, '강제 안전판(label,true,true) 한 번: ' + JSON.stringify(r.snaps));
    assert(r.phaseCalls === 0, 'setPhase/applyBulkPhase 를 부르면 즉시이동 모드에서 PC 파일이 옮겨진다: ' + r.phaseCalls);
    assert(r.ser && r.ser.phase === '시공 전', '직렬화(phase) 에 반영되어야 백업에 남는다: ' + JSON.stringify(r.ser && r.ser.phase));
    assert(eq(r.phases, ['타일']), 'p.phases 에 등록하면 계약서 범위·카톡 카드에 새어 나간다: ' + JSON.stringify(r.phases));
    assert(r.keys === keysBefore, '직렬화 최상위 키가 바뀌면 안 된다');
  });

  await test('⑤ 체크박스를 끄면 아무것도 쓰지 않는다 · 대상 0장이면 안전판도 안 찍는다', async () => {
    await seed(basePhotos, [baseProject]);
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['e1'], after: ['e3'] }; document.getElementById('wrTag').checked = false; }, N);
    await clickMake(); await waitDoc(); await settle(400);
    assert((await ph('e1')) === null && (await ph('e3')) === null, '체크를 껐는데 공정이 적혔다');
    assert((await page.evaluate(() => window.__snapCalls.filter(c => c[1] === true).length)) === 0, '체크를 껐는데 강제 안전판을 찍었다');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['d1'], after: ['t1'] }; }, N);   // 둘 다 공정 있음 → 대상 0
    await clickMake(); await waitDoc(); await settle(400);
    assert((await page.evaluate(() => window.__snapCalls.filter(c => c[1] === true).length)) === 0, '대상이 0장인데 강제 안전판을 찍었다(12칸 낭비)');
    assert((await ph('d1')) === '철거' && (await ph('t1')) === '타일', '대상 0장인데 무언가 바뀌었다');
  });

  await test('⑤ 안전판 실패 → 아무것도 쓰지 않고, 문서는 그대로 나가고, 토스트가 안전판을 말한다', async () => {
    await seed(basePhotos, [baseProject]);
    await page.evaluate(n => { hjSnapshot = async () => false; warrantyView(n); window.__wrPick = { before: ['e1'], after: ['e3'] }; }, N);
    await clickMake(); await waitDoc();
    await page.waitForFunction(() => (document.getElementById('toast') || {}).textContent.includes('안전판'), null, { timeout: 5000 });
    assert((await ph('e1')) === null && (await ph('e3')) === null, '안전판이 실패했는데 공정을 적었다');
    assert(await page.evaluate(() => !!document.querySelector('#modalRoot #hjDocPdf')), '문서(PDF·워드·HTML 화면)는 그대로 나가야 한다');
  });

  await test('⑤ 현장에 같은 표기가 있으면 그 표기를 쓴다 · p.phases 는 늘지 않는다', async () => {
    await seed(basePhotos, [{ ...baseProject, phases: ['시공전', '완료', '타일'] }]);
    await page.evaluate(n => { warrantyView(n); window.__wrPick = { before: ['e1'], after: ['e3'] }; }, N);
    await clickMake(); await waitDoc();
    await page.waitForFunction(() => state.files.find(f => f.id === 'e1')._phase === '시공전', null, { timeout: 8000 });
    assert((await ph('e3')) === '완료', 'e3: ' + await ph('e3'));
    assert(eq(await page.evaluate(() => state.projects[0].phases), ['시공전', '완료', '타일']), 'p.phases 가 바뀌었다');
    // 표기를 재사용했으니 전후 갤러리·보증서 풀이 같은 쪽으로 본다
    const pools = await page.evaluate(n => ({ b: hjWarrantyPhotoPools(n).before.map(f => f.id), a: hjWarrantyPhotoPools(n).after.map(f => f.id) }), N);
    assert(pools.b.includes('e1') && pools.a.includes('e3'), '저장한 사진을 풀이 못 본다: ' + JSON.stringify(pools));
  });

  await test('⑤ 상수 자가검증 — 저장하는 이름을 hjPhaseHit 가 자기 쪽으로만 읽는다', async () => {
    const r = await page.evaluate(() => ({
      bb: hjPhaseHit({ _phase: PHASE_SIDE_NAME.before }, PHASE_BEFORE), ba: hjPhaseHit({ _phase: PHASE_SIDE_NAME.before }, PHASE_AFTER),
      ab: hjPhaseHit({ _phase: PHASE_SIDE_NAME.after }, PHASE_BEFORE), aa: hjPhaseHit({ _phase: PHASE_SIDE_NAME.after }, PHASE_AFTER),
      side: [hjPhaseSideOf({ _phase: PHASE_SIDE_NAME.before }), hjPhaseSideOf({ _phase: PHASE_SIDE_NAME.after }), hjPhaseSideOf({ _phase: '타일' })] }));
    assert(r.bb && !r.ba && r.ab === false && r.aa, "이름이 자기 쪽으로만 읽혀야 한다: " + JSON.stringify(r));
    assert(eq(r.side, ['before', 'after', null]), 'hjPhaseSideOf: ' + JSON.stringify(r.side));
  });

  // ── ⑥ ─────────────────────────────────────────────────────────────────────────
  await test('⑥ 발급 이력 — PDF·워드·HTML 을 실제로 누른 시점에만, html 없이, 직렬화 왕복', async () => {
    await seed(basePhotos, [baseProject]);
    await page.evaluate(n => { warrantyView(n); document.getElementById('wrWork').value = 'TEST 도배 공사'; window.__wrPick = { before: ['e1', 'e2'], after: ['e3'] }; }, N);
    await clickMake(); await waitDoc();
    assert((await page.evaluate(() => (state.projects[0].warrantyLog || []).length)) === 0, '미리보기만 열었는데 발급으로 적혔다');
    await page.evaluate(() => { document.querySelector('#modalRoot #hjDocPdf').click(); const f = document.getElementById('hjDocPrintFrame'); if (f && f.contentWindow) f.contentWindow.print = () => {}; });
    await page.waitForFunction(() => (state.projects[0].warrantyLog || []).length === 1, null, { timeout: 5000 });
    await page.evaluate(() => document.querySelector('#modalRoot #hjDocWord').click());
    await page.waitForFunction(() => (state.projects[0].warrantyLog || []).length === 2, null, { timeout: 5000 });
    await page.evaluate(() => { hjWarrantyShareHtml = async () => false; document.querySelector('#modalRoot #hjDocHtml').click(); });
    await settle(300);
    assert((await page.evaluate(() => state.projects[0].warrantyLog.length)) === 2, '공유를 취소했는데 발급으로 적혔다');
    await page.evaluate(() => { hjWarrantyShareHtml = async () => true; document.querySelector('#modalRoot #hjDocHtml').click(); });
    await page.waitForFunction(() => (state.projects[0].warrantyLog || []).length === 3, null, { timeout: 5000 });
    const r = await page.evaluate(n => {
      const log = state.projects[0].warrantyLog;
      const rt = JSON.parse(JSON.stringify(serializeData())).projects[0].warrantyLog;
      const story = hjStoryData(n).filter(e => e.ic === '🛡');
      return { vias: log.map(x => x.via), kinds: log.map(x => x.kind), first: log[0], keys: Object.keys(log[0]), rt: rt.length,
        story: story.map(e => e.t), card: typeof hjKakaoCard === 'function' ? hjKakaoCard(state.projects[0]) : '' };
    }, N);
    assert(eq(r.vias, ['pdf', 'word', 'html']) && r.kinds.every(k => k === '하자보증서'), JSON.stringify({ vias: r.vias, kinds: r.kinds }));
    assert(r.first.work === 'TEST 도배 공사' && r.first.before === 2 && r.first.after === 1, '입력값·장수가 이력에: ' + JSON.stringify(r.first));
    assert(!r.keys.includes('html') && !r.keys.includes('unitId'), 'html 은 절대 이력에 넣지 않는다(안전판 12칸이 부푼다): ' + r.keys);
    assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r.first.at), 'at 은 로컬 YYYY-MM-DD HH:MM: ' + r.first.at);
    assert(r.rt === 3, '직렬화 왕복에 이력이 남아야 한다');
    assert(r.story.length === 3 && r.story.some(t => t.includes('(PDF)')) && r.story.some(t => t.includes('(워드)')), '이야기에 종류별로: ' + JSON.stringify(r.story));
    assert(r.card.includes('발급 이력 3건'), '카톡 카드에 이력 건수: ' + r.card.slice(0, 80));
  });

  await test('⑥ 거래명세서 PDF 는 보증서 이력에 남지 않는다', async () => {
    await seed(basePhotos, [{ ...baseProject, received: 1000 }]);
    await page.evaluate(n => { state.files.push({ id: 'est9', kind: 'estimate', project: n, name: '견적', est: { amount: 5000000, supply: 5000000, vat: 500000, date: '2026-05-10' }, when: new Date('2026-05-10') }); settleDocs(n); }, N);
    await page.evaluate(() => document.querySelector('#modalRoot .sdCard[data-k="statement"]').click());
    await waitDoc();
    await page.evaluate(() => { document.querySelector('#modalRoot #hjDocPdf').click(); const f = document.getElementById('hjDocPrintFrame'); if (f && f.contentWindow) f.contentWindow.print = () => {}; });
    await settle(500);
    assert((await page.evaluate(() => (state.projects[0].warrantyLog || []).length)) === 0, '거래명세서가 보증서 이력에 섞였다');
  });

  // ── ⑦ ─────────────────────────────────────────────────────────────────────────
  await test('⑦ 완료보증서 — 전2·후2 자동(전 오래된 순·후 최근 순), 빈 칸 없음, 이력 1건+sentAt, 이야기에 한 줄', async () => {
    await seed([
      { id: 'b1', project: N, when: '2026-09-01', _phase: '시공 전' }, { id: 'b2', project: N, when: '2026-09-02', _phase: '시공 전' }, { id: 'b3', project: N, when: '2026-09-03', _phase: '시공 전' },
      { id: 'a1', project: N, when: '2026-09-05', _phase: '완료' }, { id: 'a2', project: N, when: '2026-09-06', _phase: '완료' }, { id: 'a3', project: N, when: '2026-09-07', _phase: '완료' },
    ], [{ ...baseProject, customer: { name: '김고객' } }]);
    const r = await page.evaluate(async n => {
      hjWarrantyShareHtml = async (nm, html) => { window.__sentHtml = html; return true; };
      const res = await warrantyIssueSend(n);
      const w = state.projects[0].warrantyDoc, h = window.__sentHtml;
      const ids = [...h.matchAll(/<img data-photo="([^"]+)"[^>]*alt="([^"]+)"/g)].map(m => [m[1], m[2]]);
      const storedPhotos = (w.html.match(/data-photo=/g) || []).length;
      // 보관본 보기·다시 보내기는 id 로 같은 사진을 다시 합성한다
      const regen = hjWarrantyDocHtml(state.projects[0]);
      const regenIds = (regen.match(/data-photo="([^"]+)"/g) || []).map(x => x.slice(12, -1));
      const plain = warrantyHTML(n);
      return { res, ids, blank: (h.match(/사진 부착 \/ 삽입/g) || []).length, plainBlank: (plain.match(/사진 부착 \/ 삽입/g) || []).length,
        log: state.projects[0].warrantyLog, story: hjStoryData(n).filter(e => e.ic === '🛡').map(e => e.t), card: hjKakaoCard(state.projects[0]), at: w.at, sentAt: w.sentAt,
        storedPhotos, photoIds: w.photoIds, regenIds, storedLen: w.html.length };
    }, N);
    assert(r.storedPhotos === 0 && eq(r.photoIds, { before: ['b1', 'b2'], after: ['a3', 'a2'] }), '보관본에는 사진 base64 대신 id 만(안전판·릴레이 부풀림 방지): ' + JSON.stringify([r.storedPhotos, r.photoIds]));
    assert(eq(r.regenIds, ['b1', 'b2', 'a3', 'a2']), '보관본 보기는 id 로 같은 사진을 다시 합성해야 한다: ' + JSON.stringify(r.regenIds));
    assert(r.storedLen < 60000, '보관본이 사진 없이도 6만 자를 넘는다: ' + r.storedLen);
    assert(r.ids.length === 4, '사진 4장(전2·후2): ' + JSON.stringify(r.ids));
    assert(eq(r.ids.filter(x => x[1] === '작업 전').map(x => x[0]), ['b1', 'b2']), '전은 오래된 둘: ' + JSON.stringify(r.ids));
    assert(eq(r.ids.filter(x => x[1] === '작업 후').map(x => x[0]), ['a3', 'a2']), '후는 최근 둘(최근순): ' + JSON.stringify(r.ids));
    assert(r.blank === 0, "카톡 문서에 '사진 부착 / 삽입' 빈 칸이 남았다");
    assert(r.plainBlank === 2, '종이(무옵션 warrantyHTML)는 빈 칸 2개 그대로여야 한다: ' + r.plainBlank);
    assert(r.log.length === 1 && r.log[0].kind === '완료보증서' && r.log[0].via === 'share' && r.log[0].before === 2 && r.log[0].after === 2 && r.log[0].sentAt && r.log[0].doneAt === '2026-09-01' && r.log[0].until, '완료보증서 이력(완료일·보증 종료일 포함): ' + JSON.stringify(r.log));
    assert(r.story.length === 1 && r.story[0] === '완료보증서 발급', '이야기에 완료보증서 한 줄(warrantyDoc 와 중복 없이): ' + JSON.stringify(r.story));
    assert(r.card.includes('발급') && r.at && r.sentAt, 'kakao ⑤ 계약(at·sentAt·카드 발급) 유지');
  });

  await test('⑦ 공정 태그가 없는 현장 — 사진 구역 자체가 빠지고 조항은 그대로, 사진 없이 발급 안내', async () => {
    await seed([{ id: 'n1', project: N, when: '2026-09-01' }, { id: 'n2', project: N, when: '2026-09-02' }], [{ ...baseProject, customer: { name: '김고객' } }]);
    const r = await page.evaluate(async n => { hjWarrantyShareHtml = async (nm, html) => { window.__sentHtml = html; return true; }; await warrantyIssueSend(n); const h = window.__sentHtml;
      return { section: h.includes('작업 사진'), blank: h.includes('사진 부착 / 삽입'), as: h.includes('무상 A/S'), cust: h.includes('김고객'), toast: (document.getElementById('toast') || {}).textContent, log: state.projects[0].warrantyLog[0] }; }, N);
    assert(!r.section && !r.blank, '사진이 0장이면 구역을 통째로 숨겨야 한다');
    assert(r.as && r.cust, 'kakao ⑤ 문구(무상 A/S·고객명) 유지');
    assert(r.log.before === 0 && r.log.after === 0, '이력 장수 0/0: ' + JSON.stringify(r.log));
  });

  await test('⑦ 카톡 공유를 취소하면 이력은 남지 않고 보관본만 남는다', async () => {
    await seed([{ id: 'b1', project: N, when: '2026-09-01', _phase: '시공 전' }], [baseProject]);
    const r = await page.evaluate(async n => { hjWarrantyShareHtml = async () => false; await warrantyIssueSend(n);
      return { log: (state.projects[0].warrantyLog || []).length, doc: !!state.projects[0].warrantyDoc, sent: state.projects[0].warrantyDoc.sentAt || null, story: hjStoryData(n).filter(e => e.ic === '🛡').length }; }, N);
    assert(r.log === 0 && r.doc && !r.sent, '취소했는데 발급 이력이 쌓였다: ' + JSON.stringify(r));
    assert(r.story === 1, '이력이 없을 땐 예전처럼 warrantyDoc 한 줄로 이야기에: ' + r.story);
  });

  await test('⑦ blob:·20만 자 초과 썸네일은 문서에 싣지 않는다(파일에서 깨지거나 보관본을 부풀린다)', async () => {
    await seed([
      { id: 'x1', project: N, when: '2026-09-01', _phase: '시공 전', thumb: 'blob:http://127.0.0.1/fake-heic' },
      { id: 'x2', project: N, when: '2026-09-02', _phase: '시공 전', thumb: 'data:image/jpeg;base64,' + 'A'.repeat(210000) },
      { id: 'ok1', project: N, when: '2026-09-03', _phase: '시공 전' },
    ], [baseProject]);
    const r = await page.evaluate(n => ({ before: hjWarrantyPhotoPools(n).before.map(f => f.id), ok: state.files.map(f => hjDocThumbOk(f)),
      byId: (warrantyHTML(n, { beforeIds: ['x1', 'x2', 'ok1'] }).match(/data-photo="([^"]+)"/g) || []) }), N);
    assert(eq(r.before, ['ok1']), '풀: ' + JSON.stringify(r.before));
    assert(eq(r.ok, [false, false, true]), 'hjDocThumbOk: ' + JSON.stringify(r.ok));
    assert(eq(r.byId, ['data-photo="ok1"']), '직접 고른 경로도 같은 기준: ' + JSON.stringify(r.byId));
  });

  // ── ⑧ ─────────────────────────────────────────────────────────────────────────
  const A = '가상아파트', B = '가상다른아파트';
  const unit = (id, dong, ho) => ({ id, type: 'unit', dong, ho, name: '', note: '' });
  const aptProjects = [
    { name: A, doneAt: '2026-09-01', customer: { name: '관리사무소', addr: '대전 가상구' }, aptUnits: [unit('u1', '103', '1204'), { id: 'c1', type: 'common', dong: '', ho: '', name: '지하주차장', note: '' }] },
    { name: B, doneAt: '2026-09-01', aptUnits: [unit('u1', '103', '1204')] },
  ];
  const aptPhotos = [
    { id: 'a-own', project: A, when: '2026-09-01', _phase: '시공 전', _aptUnit: { project: A, unitId: 'u1' } },
    { id: 'a-other', project: A, when: '2026-09-02', _phase: '시공 전' },
    { id: 'a-c', project: A, when: '2026-09-03', _phase: '완료', _aptUnit: { project: A, unitId: 'c1' } },
    { id: 'b-own', project: B, when: '2026-09-01', _phase: '시공 전', _aptUnit: { project: B, unitId: 'u1' } },
  ];

  await test('⑧ warrantyHTML(unitId) — 세대 라벨은 작업장소·작업명에만(확인자 칸은 비움), 사진은 그 세대 것만, 없는 id 는 null', async () => {
    await seed(aptPhotos, aptProjects, { offices: [{ complex: A, name: '가상 관리사무소' }] });
    const r = await page.evaluate(({ A }) => {
      const h = warrantyHTML(A, { unitId: 'u1', beforeIds: ['a-own', 'a-other', 'b-own'] });
      const cell = k => { const m = h.match(new RegExp(k + '</td><td>([^<]*)')); return m ? m[1] : null; };
      return { place: cell('작업장소'), work: cell('작업명'), photos: (h.match(/data-photo="([^"]+)"/g) || []), submit: cell('제출처'),
        who: (h.match(/소속 \/ 동·호수 : ([^<]*)</) || [])[1], nope: warrantyHTML(A, { unitId: 'nope' }), plainHas: warrantyHTML(A).includes('103동'),
        common: (warrantyHTML(A, { unitId: 'c1' }).match(/작업장소<\/td><td>([^<]*)/) || [])[1], commonWho: /소속 \/ 동·호수 : <span/.test(warrantyHTML(A, { unitId: 'c1' })) };
    }, { A });
    assert(r.place === '대전 가상구 103동 1204호', '작업장소: ' + r.place);
    assert(r.work === '가상아파트 103동 1204호', '작업명: ' + r.work);
    assert(eq(r.photos, ['data-photo="a-own"']), '세대에 명시 연결된 사진만(같은 unit id 의 다른 아파트 b-own 제외): ' + JSON.stringify(r.photos));
    assert(r.submit && r.submit.includes('가상아파트'), '다세대 현장은 이름 자체로 관리사무소를 찾는다: ' + r.submit);
    assert(r.who === undefined || /^<span/.test(String(r.who)) || r.who === '', '확인자 소속칸은 세대 보증서라도 비워야 한다(앱이 지어내는 칸이 아니다): ' + JSON.stringify(r.who));
    assert(r.nope === null, '없는 세대 id 는 null(fail closed) 이어야 한다');
    assert(!r.plainHas, 'unitId 없이 부르면 예전 그대로(세대 라벨 없음)');
    assert(r.common === '대전 가상구 지하주차장' && r.commonWho, '공용부: 작업장소에 이름, 소속칸은 빈칸: ' + JSON.stringify([r.common, r.commonWho]));
  });

  await test('⑧ 현장 이름이 이미 그 세대면 라벨을 두 번 쓰지 않는다', async () => {
    const M = '금호 한사랑아파트 107동 1302호';
    await seed([{ id: 'm1', project: M, when: '2026-09-01', _phase: '시공 전', _aptUnit: { project: M, unitId: 'u9' } }],
      [{ name: M, doneAt: '2026-09-01', aptUnits: [unit('u9', '107', '1302')] }]);
    const r = await page.evaluate(M => { const h = warrantyHTML(M, { unitId: 'u9' }); return { dup: h.includes('107동 1302호 107동 1302호'), place: (h.match(/작업장소<\/td><td>([^<]*)/) || [])[1], who: (h.match(/소속 \/ 동·호수 : ([^<]*)/) || [])[1] }; }, M);
    assert(!r.dup && r.place === M, '중복 표기: ' + JSON.stringify(r));
    assert(!String(r.who || '').includes('107동'), '소속칸은 비워야 한다: ' + JSON.stringify(r.who));
  });

  await test('⑧ warrantyView 세대 select — 세대 사진만 격자에, 바꿔도 입력값 유지, 동·호수 모달에 입구, 이력에 세대', async () => {
    await seed(aptPhotos, aptProjects);
    await page.evaluate(A => warrantyView(A, { unitId: 'u1' }), A);
    let r = await page.evaluate(() => ({ title: document.getElementById('modalTitle').textContent, sel: document.getElementById('wrUnit') && document.getElementById('wrUnit').value,
      tiles: [...document.querySelectorAll('#modalRoot .wrPh')].map(e => e.dataset.id) }));
    assert(r.title.includes('103동 1204호') && r.sel === 'u1', '제목·select: ' + JSON.stringify(r));
    assert(eq(r.tiles, ['a-own']), '격자에 세대 사진만: ' + JSON.stringify(r.tiles));
    await page.evaluate(() => { document.getElementById('wrWork').value = 'TEST 세대 공사'; const s = document.getElementById('wrUnit'); s.value = ''; s.dispatchEvent(new Event('change')); });
    await page.waitForFunction(() => document.querySelectorAll('#modalRoot .wrPh').length === 3, null, { timeout: 5000 });
    r = await page.evaluate(() => ({ work: document.getElementById('wrWork').value, sel: document.getElementById('wrUnit').value, title: document.getElementById('modalTitle').textContent }));
    assert(r.work === 'TEST 세대 공사' && r.sel === '' && !r.title.includes('103동'), '세대를 바꾸면 입력값은 남고 제목은 현장 전체: ' + JSON.stringify(r));
    // 동·호수 관리 모달의 입구
    await page.evaluate(A => { closeModal(true); aptUnitView(A, 'u1'); }, A);
    r = await page.evaluate(() => { const b = document.getElementById('aptUnitWarranty'); return { has: !!b, wired: !!b && typeof b.onclick === 'function' }; });
    assert(r.has && r.wired, '동·호수 모달에 [이 세대 하자보증서] 가 직접 배선되어야 한다(모달은 위임 밖): ' + JSON.stringify(r));
    await page.evaluate(() => document.getElementById('aptUnitWarranty').click());
    await page.waitForFunction(() => document.getElementById('wrUnit') && document.getElementById('wrUnit').value === 'u1', null, { timeout: 5000 });
    // 세대로 만들고 PDF 를 누르면 이력에 세대가 남는다
    await page.evaluate(() => { window.__wrPick = { before: ['a-own'], after: [] }; });
    await clickMake(); await waitDoc();
    await page.evaluate(() => { document.querySelector('#modalRoot #hjDocPdf').click(); const f = document.getElementById('hjDocPrintFrame'); if (f && f.contentWindow) f.contentWindow.print = () => {}; });
    await page.waitForFunction(A => (state.projects.find(p => p.name === A).warrantyLog || []).length === 1, A, { timeout: 5000 });
    const log = await page.evaluate(A => state.projects.find(p => p.name === A).warrantyLog[0], A);
    assert(log.unitId === 'u1' && log.unitLabel === '103동 1204호', '이력에 세대: ' + JSON.stringify(log));
    // 비아파트 현장에는 select 가 없다
    await page.evaluate(n => { closeModal(true); state.projects.push({ name: n, doneAt: '2026-09-01', stage: 4, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }); warrantyView(n); }, N);
    assert(!(await page.evaluate(() => !!document.getElementById('wrUnit'))), '동·호수 관리를 안 쓰는 현장에 세대 select 가 나오면 settle-docs 격자 검사가 깨진다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== warranty-v313: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
