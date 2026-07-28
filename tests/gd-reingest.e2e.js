/* gd-reingest.e2e.js — 드라이브에서 파일을 다시 받을 때 사장님이 손으로 넣은 값이 살아남는가 (Playwright)
   폰·새 기기에서 복원하면 모든 파일이 '가상(_virtual)'이다. 그 뒤 부팅 동기화·[불러오기]·
   [내 드라이브 전체 통합] 이 실제 바이트를 받아 가상분을 교체하는데(__gdIngestOne),
   이때 승계 목록이 저장 스키마(serializeData)보다 짧으면 손으로 넣은 값이 조용히 사라진다.

   지키는 것:
   ① Σ 매출 집계 제외(exSum) — 풀리면 초안 견적이 매출에 다시 더해져 숫자가 부풀고 부가세까지 어긋난다
   ② 건물명(address) — 네이버지도로 확인해 적은 값. 사람이 손으로 넣은 것이라 자동 복구가 없다
   ③ 작업명(_worklabel) · 견적 품목(quote) · 장부(ledger) · 정리 폴더(_gdFolder) · OCR 결과(text/ocr)
   ④ 승계 목록이 serializeData 가 저장하는 목록과 갈라지지 않는다
   전제: tests/static-server.js(8299). serviceWorkers:'block'. 네트워크는 fetch 스텁으로 대체. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
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

  // 드라이브 다운로드만 가로채는 스텁을 심는다(그 외 fetch 는 그대로).
  const stub = () => {
    window.__realFetch = window.__realFetch || window.fetch;
    window.fetch = function (u, o) {
      const s = String(u);
      if (s.indexOf('googleapis.com/drive/v3/files/') >= 0 && s.indexOf('alt=media') >= 0) {
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'application/octet-stream' })) });
      }
      return window.__realFetch(u, o);
    };
  };

  await test('① 초안 견적의 Σ 집계 제외가 유지된다 (매출이 부풀지 않는다)', async () => {
    const r = await page.evaluate(async (src) => {
      eval('(' + src + ')()');
      state.projects = [{ name: '둔산동', stage: 2, received: 0, phases: [], cost: {}, customer: {}, archived: false }];
      state.quotes = []; state.schedule = [];
      state.files = [
        { id: 'v1', name: '둔산동 초안.xlsx', ext: 'xlsx', kind: 'estimate', _virtual: true, _driveId: 'DRV1',
          project: '둔산동', est: { amount: 30000000, supply: 27272727, vat: 2727273, customer: '김둔산' },
          exSum: true, quote: { items: [{ name: '도배', price: 1000000 }] }, ledger: { note: '현금' },
          address: '대전 서구 둔산로 1 · 크로바아파트', _worklabel: '도배 1차', _gdFolder: '견적서',
          text: 'OCR 로 읽은 본문', ocr: 'done', when: new Date('2026-05-01T09:00:00') },
        { id: 'v2', name: '둔산동 확정.xlsx', ext: 'xlsx', kind: 'estimate', project: '둔산동',
          est: { amount: 40000000, supply: 36363636, vat: 3636364, customer: '김둔산' }, when: new Date('2026-06-01T09:00:00') }
      ];
      const before = salesEstimateFiles().reduce((a, f) => a + (f.est ? f.est.amount : 0), 0);
      const ret = await __gdIngestOne('DRV1', '둔산동 초안.xlsx', 'application/vnd.ms-excel', 'TOK', undefined, 'estimate');
      const after = salesEstimateFiles().reduce((a, f) => a + (f.est ? f.est.amount : 0), 0);
      const now = state.files.find(f => f._driveId === 'DRV1') || {};
      return { ret, before, after, exSum: now.exSum === true };
    }, stub.toString());
    assert(r.ret === 1, '재인입이 실제로 일어나야 함(전제): ' + r.ret);
    assert(r.exSum, 'Σ 집계 제외(exSum)가 풀렸다 — 초안 견적이 매출에 다시 더해진다');
    assert(r.after === r.before, '매출 합계가 바뀌었다: ' + r.before + ' → ' + r.after);
  });

  await test('② 손으로 적은 건물명이 살아남는다', async () => {
    const r = await page.evaluate(async (src) => {
      eval('(' + src + ')()');
      state.files = [{ id: 'p1', name: '현장1.jpg', ext: 'jpg', kind: 'photo', _virtual: true, _driveId: 'DRV2',
        project: '둔산동', _phase: '도배', address: '대전 서구 둔산로 1 · 한빛빌라 나동',
        _worklabel: '도배 1차', lat: 36.35, lng: 127.38, when: new Date('2026-05-02T10:00:00') }];
      const beforeAddr = state.files[0].address;
      const ret = await __gdIngestOne('DRV2', '현장1.jpg', 'image/jpeg', 'TOK');
      const now = state.files.find(f => f._driveId === 'DRV2') || {};
      return { ret, beforeAddr, afterAddr: now.address, worklabel: now._worklabel, phase: now._phase, project: now.project };
    }, stub.toString());
    assert(r.ret === 1, '재인입이 일어나야 함(전제): ' + r.ret);
    assert(r.afterAddr === r.beforeAddr, '건물명이 사라졌다: ' + JSON.stringify(r.beforeAddr) + ' → ' + JSON.stringify(r.afterAddr));
    assert(r.worklabel === '도배 1차', '작업명이 사라졌다: ' + r.worklabel);
    assert(r.phase === '도배' && r.project === '둔산동', '기존에 살아있던 값까지 깨지면 안 됨');
  });

  await test('③ 견적 품목·장부·정리폴더·OCR 결과가 살아남는다', async () => {
    const r = await page.evaluate(async (src) => {
      eval('(' + src + ')()');
      state.files = [{ id: 'q1', name: '견적.xlsx', ext: 'xlsx', kind: 'estimate', _virtual: true, _driveId: 'DRV3',
        project: '둔산동', quote: { items: [{ name: '타일', price: 2000000 }] }, ledger: { note: '카드' },
        _gdFolder: '견적서', text: '읽어 둔 본문', ocr: 'done', when: new Date('2026-05-03T10:00:00') }];
      const ret = await __gdIngestOne('DRV3', '견적.xlsx', 'application/vnd.ms-excel', 'TOK');
      const n = state.files.find(f => f._driveId === 'DRV3') || {};
      return { ret, quote: !!(n.quote && n.quote.items && n.quote.items.length), ledger: !!n.ledger,
        gdFolder: n._gdFolder, text: n.text, ocr: n.ocr };
    }, stub.toString());
    assert(r.ret === 1, '재인입이 일어나야 함(전제)');
    assert(r.quote, '견적 품목(quote)이 사라졌다');
    assert(r.ledger, '장부(ledger)가 사라졌다');
    assert(r.gdFolder === '견적서', '정리 폴더(_gdFolder)가 사라졌다: ' + r.gdFolder);
    assert(r.text === '읽어 둔 본문' && r.ocr === 'done', 'OCR 결과가 사라졌다: ' + JSON.stringify({ t: r.text, o: r.ocr }));
  });

  await test('④ 승계 목록이 저장 스키마와 갈라지지 않는다', async () => {
    // serializeData 가 저장하는 파일 필드는 재인입에서도 전부 살아남아야 한다.
    // 하나라도 빠지면 '드라이브에서 다시 받으면 사라지는 값'이 생긴다.
    const r = await page.evaluate(async (src) => {
      eval('(' + src + ')()');
      const full = { id: 'f1', name: '전부.xlsx', ext: 'xlsx', kind: 'estimate', _virtual: true, _driveId: 'DRV4',
        prefix: 'PFX', project: '둔산동', text: 'T', ocr: 'done', est: { amount: 1000 }, exSum: true,
        ledger: { a: 1 }, quote: { items: [1] }, contact: { name: '홍' }, address: 'A · B',
        _phase: '도배', _worklabel: 'W', _gdFolder: 'G', lat: 1, lng: 2, when: new Date('2026-05-04T10:00:00') };
      state.files = [full];
      const before = serializeData().files[0];
      await __gdIngestOne('DRV4', '전부.xlsx', 'application/vnd.ms-excel', 'TOK');
      const after = serializeData().files[0];
      const lost = [];
      Object.keys(before).forEach((k) => {
        if (k === 'key' || k === 'size' || k === 'driveId' || k === 'when' || k === 'prefix') return;
        const a = JSON.stringify(before[k]), b = JSON.stringify(after[k]);
        if (a !== b && before[k] !== null && before[k] !== '' && before[k] !== false) lost.push(k + ': ' + a + ' → ' + b);
      });
      return { lost };
    }, stub.toString());
    assert(r.lost.length === 0, '재인입에서 사라지는 저장 필드가 있다:\n      ' + r.lost.join('\n      '));
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
