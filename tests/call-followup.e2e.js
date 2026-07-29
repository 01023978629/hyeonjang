/* call-followup.e2e.js — 통화 후 메모 → 자동 문자 초안 회귀 (Playwright)
   앱에서 건 전화를 기억해 두고, 통화를 마치고 돌아오면 메모를 받아
   ①메모로 저장 ②내용이 채워진 문자창을 연다. 몰래 보내는 발송은 없다(전송은 사장님 손).

   지키는 것:
   ① 전화 걸기(hjPlaceCall)가 누구에게 걸었는지 기억한다 · tel: 로 나간다
   ② 8초 미만 복귀(잘못 누름·부재중)에는 조르지 않는다 · 30분 지나면 잊는다
   ③ 통화 복귀 시 메모 시트가 뜬다 (이름·번호 표시)
   ④ [저장+문자]: 메모가 notes 에 남고(현장 연결 포함), sms: 로 내용이 채워져 나간다
   ⑤ 빈 메모로는 저장되지 않는다 · [건너뛰기]는 아무것도 남기지 않는다
   ⑥ 프로젝트 [📞 전화] 버튼이 이 흐름을 태운다 · 직렬화 왕복에 메모가 남는다
   전제: tests/static-server.js(8299). serviceWorkers:'block'. hjGo 를 가로채 실제 이동 없음. */
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
  // 실제 이동을 막고 기록만 한다
  await page.evaluate(() => { window.__gone = []; window.hjGo = (u) => window.__gone.push(u); });

  await test('① 전화 걸기가 상대를 기억하고 tel: 로 나간다', async () => {
    const r = await page.evaluate(() => {
      window.__gone = [];
      hjPlaceCall('010-1234-5678', '김둔산', '둔산동');
      return { gone: window.__gone, last: { ...__lastCall } };
    });
    assert(r.gone[0] === 'tel:01012345678', 'tel: 로 나가야 함: ' + JSON.stringify(r.gone));
    assert(r.last.name === '김둔산' && r.last.project === '둔산동' && r.last.done === false,
      '상대 기록이 어긋남: ' + JSON.stringify(r.last));
  });

  await test('② 8초 미만 복귀에는 조르지 않고, 30분 지나면 잊는다', async () => {
    const r = await page.evaluate(() => {
      __lastCall = { phone: '01012345678', name: '김둔산', project: null, at: Date.now() - 3000, done: false };
      hjCallReturnCheck();
      const early = { shown: !!document.querySelector('#modalRoot .modal'), done: __lastCall.done };
      __lastCall = { phone: '01012345678', name: '김둔산', project: null, at: Date.now() - 31 * 60000, done: false };
      hjCallReturnCheck();
      const old = { shown: !!document.querySelector('#modalRoot .modal'), cleared: __lastCall === null };
      return { early, old };
    });
    assert(!r.early.shown && !r.early.done, '8초 미만인데 시트가 뜸: ' + JSON.stringify(r.early));
    assert(!r.old.shown && r.old.cleared, '30분 지난 통화를 잊지 않음: ' + JSON.stringify(r.old));
  });

  await test('③ 통화 복귀 시 메모 시트가 뜬다 (이름·번호 표시)', async () => {
    const r = await page.evaluate(() => {
      __lastCall = { phone: '01012345678', name: '김둔산', project: '둔산동', at: Date.now() - 60000, done: false };
      hjCallReturnCheck();
      const m = document.querySelector('#modalRoot .modal');
      return { shown: !!m, done: __lastCall.done,
        text: m ? m.textContent : '', hasTa: !!document.getElementById('cfNote') };
    });
    assert(r.shown && r.hasTa, '메모 시트가 떠야 함');
    assert(r.done === true, '한 번 뜬 통화는 done — 재방문 때 또 뜨면 안 됨');
    assert(r.text.indexOf('김둔산') >= 0 && r.text.indexOf('01012345678') >= 0, '누구와의 통화인지 보여야 함');
    assert(r.text.indexOf('전송은 사장님이') >= 0, '몰래 발송이 아니라는 안내가 있어야 함');
  });

  await test('④ [저장+문자]: 메모가 notes 에 남고 sms: 로 내용이 채워져 나간다', async () => {
    const r = await page.evaluate(() => {
      state.notes = []; window.__gone = [];
      document.getElementById('cfNote').value = '9월 초 착공 희망, 욕실+주방. 실측 토요일 오전.';
      const btn = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /문자/.test(b.textContent));
      btn.click();
      const n = state.notes[0] || {};
      return { noteText: n.text || '', noteProject: n.project, gone: window.__gone,
        modalClosed: !document.querySelector('#modalRoot .modal'), dirty: state.dirty };
    });
    assert(/📞 통화메모 · 김둔산 01012345678/.test(r.noteText), '메모 머리말이 어긋남: ' + r.noteText);
    assert(/9월 초 착공 희망/.test(r.noteText), '메모 본문이 없음');
    assert(r.noteProject === '둔산동', '현장 연결이 안 됨: ' + r.noteProject);
    assert(r.dirty === true, '저장 표시(markDirty)가 안 됨');
    assert(r.modalClosed, '시트가 닫혀야 함');
    const sms = r.gone[0] || '';
    assert(/^sms:01012345678[?&]body=/.test(sms), 'sms: 로 나가야 함: ' + sms.slice(0, 40));
    const body = decodeURIComponent(sms.split('body=')[1] || '');
    assert(body.indexOf('김둔산님') >= 0 && body.indexOf('9월 초 착공 희망') >= 0, '문자 본문에 메모가 실려야 함: ' + body.slice(0, 80));
    assert(body.indexOf('010-2397-8629') >= 0, '대표 번호 서명이 있어야 함');
  });

  await test('⑤ 빈 메모는 저장 안 됨 · [건너뛰기]는 아무것도 안 남긴다', async () => {
    const r = await page.evaluate(() => {
      state.notes = []; window.__gone = [];
      hjCallFollowup({ phone: '01099998888', name: '', project: null });
      const save = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장만');
      save.click();   // 빈 텍스트
      const emptyBlocked = !!document.querySelector('#modalRoot .modal') && state.notes.length === 0;
      const skip = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '건너뛰기');
      skip.click();
      return { emptyBlocked, closed: !document.querySelector('#modalRoot .modal'),
        notes: state.notes.length, gone: window.__gone.length };
    });
    assert(r.emptyBlocked, '빈 메모가 저장되면 안 됨(시트 유지)');
    assert(r.closed && r.notes === 0 && r.gone === 0, '건너뛰기가 흔적을 남김: ' + JSON.stringify(r));
  });

  await test('⑥ 프로젝트 [📞 전화] 버튼이 이 흐름을 태운다 · 직렬화에 메모가 남는다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '유천동주택', stage: 2, received: 0, phases: [], cost: {},
        customer: { name: '박유천', phone: '010-2222-3333' }, archived: false }];
      window.__gone = []; __lastCall = null;
      const view = document.getElementById('view');
      const b = document.createElement('button'); b.setAttribute('data-callcust', '유천동주택');
      view.appendChild(b); b.click(); b.remove();
      const rec = __lastCall ? { ...__lastCall } : null;
      // 저장한 메모가 직렬화 왕복에 남는가
      state.notes = [];
      hjCallSave({ phone: '01022223333', name: '박유천', project: '유천동주택' }, '누수 재점검 요청');
      const round = JSON.parse(JSON.stringify(serializeData()));
      const kept = (round.notes || []).some(n => /통화메모 · 박유천/.test(n.text) && n.project === '유천동주택');
      return { gone: window.__gone, rec, kept };
    });
    assert(r.gone[0] === 'tel:01022223333', '프로젝트 전화가 hjPlaceCall 을 안 탐: ' + JSON.stringify(r.gone));
    assert(r.rec && r.rec.name === '박유천' && r.rec.project === '유천동주택', '상대 기록 어긋남: ' + JSON.stringify(r.rec));
    assert(r.kept, '통화메모가 직렬화 왕복에서 사라짐');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
