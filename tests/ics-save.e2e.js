/* ics-save.e2e.js — 일정표 「📲 폰 기본 캘린더에 저장」 회귀 (Playwright)
   예전에는 .ics 를 '다운로드'만 했다. 폰에서는 그 파일이 다운로드 폴더에 떨어질 뿐
   기본 캘린더로 넘어가지 않아, 사장님이 파일을 직접 찾아 열어야 했다(사실상 저장 실패).
   이제 공유 시트로 넘겨 목록에서 '캘린더'를 고르면 그 자리에서 저장된다.

   지키는 것:
   ① 전체 저장이 .ics 파일을 공유로 넘긴다(다운로드로 끝나지 않는다)
   ② 개별 일정 저장도 같은 경로를 탄다
   ③ 공유가 없는 PC 브라우저에서는 예전대로 다운로드 폴백이 동작한다
   ④ 사용자가 공유창을 닫으면(AbortError) 다운로드로 새지 않는다 — 파일이 몰래 쌓이지 않게
   ⑤ 일정이 없으면 빈 파일을 만들지 않고 안내만 한다
   ⑥ 왕복 검증: 저장한 파일을 다시 가져오면 날짜·제목이 그대로다(종일 일정 하루 밀림 방지)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 네트워크 없음. */
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

  // 공유/다운로드를 가로채는 계측기 — 실제 파일 저장·공유는 일어나지 않는다
  await page.evaluate(() => {
    window.__cap = { shared: [], downloaded: [] };
    window.__installShare = (ok, abort) => {
      navigator.canShare = () => !!ok;
      navigator.share = async (d) => {
        if (abort) { const e = new Error('user abort'); e.name = 'AbortError'; throw e; }
        const f = (d.files || [])[0];
        window.__cap.shared.push({ name: f ? f.name : '', type: f ? f.type : '', text: f ? await f.text() : '' });
      };
    };
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreate(tag);
      if (String(tag).toLowerCase() === 'a') {
        const origClick = el.click.bind(el);
        el.click = function () { if (el.download) window.__cap.downloaded.push(el.download); else origClick(); };
      }
      return el;
    };
    state.projects = [{ name: '유천동주택', stage: 2, received: 0, phases: [], cost: {}, customer: {}, archived: false }];
    state.schedule = [
      { id: 's1', date: '2026-09-01', time: '', title: '타일기능사 실기시험', project: '', workers: '', memo: '장소: 대전도시과학고', hours: 0, report: null },
      { id: 's2', date: '2026-09-03', time: '08:00', title: '타일 시공', project: '유천동주택', workers: '2', memo: '', hours: 8, report: null }
    ];
    state.tab = 'schedule'; state.dirty = false; render();
  });

  await test('① 전체 저장이 .ics 파일을 공유로 넘긴다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      window.__installShare(true, false);
      const out = await exportAllICS();
      return { out, shared: window.__cap.shared, dl: window.__cap.downloaded };
    });
    assert(r.shared.length === 1, '공유가 1회 일어나야 함(다운로드로 끝나면 폰에서 저장 안 됨): ' + JSON.stringify(r.dl));
    assert(/\.ics$/.test(r.shared[0].name), '파일명이 .ics 여야 함: ' + r.shared[0].name);
    assert(/text\/calendar/.test(r.shared[0].type), 'MIME 이 text/calendar 여야 캘린더가 받는다: ' + r.shared[0].type);
    assert(/BEGIN:VCALENDAR/.test(r.shared[0].text) && /타일기능사/.test(r.shared[0].text), '내용에 일정이 담겨야 함');
    assert(r.dl.length === 0, '공유했으면 다운로드는 하지 않아야 함: ' + JSON.stringify(r.dl));
  });

  await test('② 개별 일정 저장도 같은 경로를 탄다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      window.__installShare(true, false);
      await exportScheduleICS('s2');
      return window.__cap;
    });
    assert(r.shared.length === 1, '개별 저장도 공유되어야 함');
    assert(/타일 시공/.test(r.shared[0].text), '해당 일정만 담겨야 함');
    assert(!/타일기능사/.test(r.shared[0].text), '다른 일정이 섞이면 안 됨');
  });

  await test('③ 공유가 없는 PC 브라우저는 예전대로 다운로드된다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      navigator.canShare = undefined; navigator.share = undefined;
      await exportAllICS();
      return window.__cap;
    });
    assert(r.downloaded.length === 1, 'PC에서는 다운로드 폴백이 동작해야 함');
    assert(/\.ics$/.test(r.downloaded[0]), '다운로드 파일명: ' + r.downloaded[0]);
  });

  await test('④ 공유창을 닫으면 다운로드로 새지 않는다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      window.__installShare(true, true);   // 사용자가 취소
      const out = await exportAllICS();
      return { out, cap: window.__cap };
    });
    assert(r.out && r.out.취소 === true, '취소로 보고해야 함: ' + JSON.stringify(r.out));
    assert(r.cap.downloaded.length === 0, '취소했는데 파일이 다운로드되면 안 됨: ' + JSON.stringify(r.cap.downloaded));
  });

  await test('⑤ 일정이 없으면 빈 파일을 만들지 않는다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      window.__installShare(true, false);
      const keep = state.schedule; state.schedule = [];
      const out = await saveICSToPhone([], '빈.ics');
      state.schedule = keep;
      return { out, cap: window.__cap };
    });
    assert(r.out && r.out.오류, '오류로 알려야 함: ' + JSON.stringify(r.out));
    assert(r.cap.shared.length === 0 && r.cap.downloaded.length === 0, '아무 파일도 만들면 안 됨');
  });

  await test('⑥ 왕복: 저장한 파일을 다시 가져오면 날짜·제목이 그대로다', async () => {
    const r = await page.evaluate(async () => {
      window.__cap = { shared: [], downloaded: [] };
      window.__installShare(true, false);
      await exportAllICS();
      const evs = parseICS(window.__cap.shared[0].text);
      return evs.map(e => ({ d: e.date, t: e.time, s: e.title }));
    });
    const exam = r.find(x => /타일기능사/.test(x.s));
    const work = r.find(x => /타일 시공/.test(x.s));
    assert(exam && exam.d === '2026-09-01', '종일 시험 일정 날짜 보존(하루 밀리면 시험을 놓친다): ' + JSON.stringify(exam));
    assert(exam && exam.t === '', '종일 일정은 시간이 없어야 함: ' + JSON.stringify(exam));
    assert(work && work.d === '2026-09-03' && work.t === '08:00', '시각 일정도 보존: ' + JSON.stringify(work));
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();
