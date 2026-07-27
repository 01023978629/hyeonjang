/* kakao-project.e2e.js — 프로젝트 창 「📲 고객 카톡 관리」 회귀 (Playwright)
   지키는 것:
   ① 카드가 프로젝트 창에 뜨고 4개 버튼(진행안내·스토리·완료보증서·서명확인)이 위임에 연결된다
   ② 진행 안내 텍스트 — 현장·단계·다음 일정·연락처 포함, 공유 불가 환경에선 복사로 폴백
   ③ 공사 스토리 — 계약·사진·입금·완료가 날짜순 타임라인으로 정리된다
   ④ 서명 내역 — 전자계약 서버 응답(COMPLETED)이 현장 contractLog 에 반영돼 "서명 완료 ✅"로 보인다
   ⑤ 완료보증서 — 발급하면 사본(p.warrantyDoc)이 현장에 남고, 직렬화 왕복에도 보존되며,
      보관본 보기 모달이 열린다. 미완료 현장에선 발급이 거부된다.
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신/실네트워크 없음(전부 목). */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 시드: 완료 현장(계약 발송 이력 + 사진 + 입금) — 프로젝트 창 열기
  await page.evaluate(() => {
    state.projects = [{ name: '석교동주택', stage: 3, doneAt: '2026-07-20', received: 5000000, phases: ['철거', '타일'],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '대전 중구' }, archived: false,
      contractLog: [{ at: '2026-07-01T09:00:00.000Z', amount: 5500000, contractNo: 'MM-20260701-001', contractId: 'ct_test1', status: 'SENT' }] }];
    state.files = [
      { id: 'q1', name: '석교동 견적.pdf', ext: 'pdf', kind: 'estimate', project: '석교동주택', est: { amount: 5500000, date: '2026-06-28' } },
      { id: 'p1', name: 'a.jpg', ext: 'jpg', kind: 'photo', project: '석교동주택', when: new Date('2026-07-05T10:00:00.000Z') },
      { id: 'p2', name: 'b.jpg', ext: 'jpg', kind: 'photo', project: '석교동주택', when: new Date('2026-07-05T11:00:00.000Z') }
    ];
    state.payLog = [{ project: '석교동주택', d: '2026-07-10', amt: 5000000 }];
    state.schedule = [{ id: 's1', date: '2099-01-05', time: '09:00', title: 'A/S 점검', project: '석교동주택' }];
    state.activeProject = '석교동주택'; state.tab = 'project'; state.dirty = false; render();
  });
  await page.waitForTimeout(300);

  await test('① 카드가 뜨고 버튼 4개가 모두 위임 셀렉터에 연결된다', async () => {
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-kkcard]');
      const btns = ['data-kkprog', 'data-kkstory', 'data-kkwarr', 'data-ctrefresh'].map(a => !!document.querySelector('[' + a + ']'));
      return { card: !!card, btns };
    });
    assert(r.card, '📲 고객 카톡 카드가 렌더돼야 함');
    assert(r.btns.every(Boolean), '버튼 4개가 있어야 함: ' + JSON.stringify(r.btns));
  });

  await test('② 진행 안내 텍스트 — 현장·단계·다음 일정·연락처 포함, 공유 없으면 복사 폴백', async () => {
    const r = await page.evaluate(async () => {
      const txt = hjProgressText('석교동주택');
      let copied = '';
      const orig = window.coworkCopy;
      window.coworkCopy = (t) => { copied = t; };
      const share = navigator.share;
      try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}
      document.querySelector('[data-kkprog]').click();
      await new Promise(r2 => setTimeout(r2, 200));
      window.coworkCopy = orig;
      try { Object.defineProperty(navigator, 'share', { value: share, configurable: true }); } catch (e) {}
      return { txt, copied };
    });
    assert(r.txt.includes('석교동주택') && r.txt.includes('만물인테리어'), '현장·상호 포함: ' + r.txt.slice(0, 60));
    assert(/완료|마무리/.test(r.txt), '완료 단계 안내 포함');
    assert(r.txt.includes('2099-01-05') && r.txt.includes('A/S 점검'), '다음 일정 포함');
    assert(r.txt.includes('010-2397-8629'), '대표 연락처 포함');
    assert(r.copied === r.txt, '공유 불가 시 같은 내용이 복사돼야 함');
  });

  await test('③ 공사 스토리 — 계약·사진·입금·완료가 날짜순으로 정리된다', async () => {
    const r = await page.evaluate(() => {
      const ev = hjStoryData('석교동주택');
      const dates = ev.map(e => e.d);
      const sorted = dates.slice().sort().join('|') === dates.join('|');
      const kinds = ev.map(e => e.ic).join('');
      document.querySelector('[data-kkstory]').click();
      const modal = (document.getElementById('modalRoot') || {}).textContent || '';
      closeModal();
      return { n: ev.length, sorted, kinds, modal: modal.slice(0, 400) };
    });
    assert(r.n >= 5, '이벤트 5개 이상(계약·견적·사진·입금·완료): ' + r.n);
    assert(r.sorted, '날짜 오름차순이어야 함');
    assert(r.kinds.includes('✍️') && r.kinds.includes('📷') && r.kinds.includes('💰') && r.kinds.includes('🎉'), '계약·사진·입금·완료 아이콘: ' + r.kinds);
    assert(r.modal.includes('공사 스토리'), '스토리 모달이 열려야 함');
  });

  await test('④ 서명 확인 — 서버 COMPLETED 가 반영돼 "서명 완료 ✅"로 보인다', async () => {
    const r = await page.evaluate(async () => {
      window.__contract = { url: 'https://contract.test', token: 'tk' };
      const origReady = window.contractReady, origFetch = window.fetch;
      window.contractReady = () => true;
      window.fetch = async (u) => {
        if (String(u).includes('/api/contracts')) return { ok: true, status: 200, json: async () => ({ contracts: [{ contractId: 'ct_test1', contractNo: 'MM-20260701-001', status: 'COMPLETED', completedAt: '2026-07-03T12:00:00.000Z' }] }) };
        throw new Error('unexpected fetch ' + u);
      };
      await contractStatusRefresh('석교동주택');
      window.fetch = origFetch; window.contractReady = origReady;
      const L = state.projects[0].contractLog[0];
      await new Promise(r2 => setTimeout(r2, 250));
      const cardTxt = (document.querySelector('[data-kkcard]') || {}).textContent || '';
      return { st: L.serverStatus, done: L.completedAt, cardTxt: cardTxt.slice(0, 300) };
    });
    assert(r.st === 'COMPLETED', '서버 상태가 저장돼야 함: ' + r.st);
    assert(String(r.done).startsWith('2026-07-03'), '서명 완료일 저장: ' + r.done);
    assert(r.cardTxt.includes('서명 완료 ✅'), '카드에 "서명 완료 ✅" 표시: ' + r.cardTxt);
  });

  await test('⑤ 완료보증서 — 발급 사본이 현장에 남고 직렬화 왕복에도 보존된다', async () => {
    const r = await page.evaluate(async () => {
      const origShare = window.hjWarrantyShareHtml;
      let sharedName = '';
      window.hjWarrantyShareHtml = async (n, html, f) => { sharedName = f; return true; };
      await warrantyIssueSend('석교동주택');
      window.hjWarrantyShareHtml = origShare;
      const p = state.projects[0];
      const w = p.warrantyDoc || {};
      const round = JSON.parse(JSON.stringify(serializeData()));
      const kept = ((round.projects || []).find(x => x.name === '석교동주택') || {}).warrantyDoc || {};
      warrantyDocView('석교동주택');
      const modal = (document.getElementById('modalRoot') || {}).textContent || '';
      closeModal();
      const cardTxt = (document.querySelector('[data-kkcard]') || {}).textContent || '';
      return { at: w.at, sent: w.sentAt, htmlOk: (w.html || '').includes('김고객') && (w.html || '').includes('무상 A/S'), sharedName,
        keptOk: (kept.html || '').length > 0 && kept.at === w.at, modal: modal.slice(0, 200), cardTxt: cardTxt.slice(0, 400) };
    });
    assert(r.at, '발급일이 기록돼야 함');
    assert(r.sent, '송부 시각이 기록돼야 함');
    assert(r.htmlOk, '보관본 HTML에 고객명·보증 문구가 있어야 함');
    assert(r.sharedName.includes('완료보증서'), '공유 파일명에 완료보증서 포함: ' + r.sharedName);
    assert(r.keptOk, '직렬화 왕복 후에도 보관본이 남아야 함');
    assert(r.modal.includes('보관본'), '보관본 보기 모달이 열려야 함');
    assert(r.cardTxt.includes('발급'), '카드에 발급 상태 표시');
  });

  await test('⑤-2 미완료 현장에선 보증서 발급이 거부된다', async () => {
    const r = await page.evaluate(async () => {
      state.projects.push({ name: '진행중현장', stage: 1, received: 0, phases: [], cost: {}, customer: {}, archived: false });
      const out = await warrantyIssueSend('진행중현장');
      const w = state.projects.find(x => x.name === '진행중현장').warrantyDoc;
      state.projects = state.projects.filter(x => x.name !== '진행중현장');
      return { out, w: !!w };
    });
    assert(r.out && r.out.오류 === '미완료', '미완료 거부: ' + JSON.stringify(r.out));
    assert(!r.w, '사본이 만들어지면 안 됨');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
