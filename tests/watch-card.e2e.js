/* watch-card.e2e.js — 첫 화면 🛡 파수꾼 카드 + 일정표 .ics 내려받기 회귀
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   중점: ① 읽기전용(직렬화 왕복 불변) ② 캘린더 알림과 같은 기준 ③ .ics 생성 ④ XSS */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 700) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 공통 시드: 미수금·AS·보증임박·방치 각 1건씩 걸리게
  const seed = () => page.evaluate(() => {
    const ymd = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    state.projects = [
      { name: '괴산현장', stage: 3, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '김사장', phone: '010-1111-2222' }, received: 5000000, doneAt: ymd(30), archived: false },
      { name: '보증임박', stage: 3, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: {}, received: 0, doneAt: ymd(365 - 20), archived: false },
      { name: '멈춘현장', stage: 2, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: {}, received: 0, archived: false },
    ];
    state.files = [
      { id: 'e1', kind: 'estimate', project: '괴산현장', name: '괴산 견적.xlsx', est: { amount: 11000000 }, when: new Date(ymd(60)) },
      { id: 'p1', kind: 'photo', project: '멈춘현장', name: 'old.jpg', when: new Date(ymd(40)) },
    ];
    state.asLog = [{ id: 'a1', project: '괴산현장', date: ymd(9), text: '화장실 누수', status: 'open' }];
    state.schedule = [{ id: 's1', date: ymd(0), time: '09:00', title: '철거', project: '괴산현장', workers: '2', hours: 8 }];
    state.tab = 'dashboard'; state.activeProject = null;
    render();
  });

  await test('첫 화면에 파수꾼 카드 — 미수금·AS·보증·방치 요약이 보인다', async () => {
    await seed();
    const t = await page.evaluate(() => {
      const v = document.querySelector('#view');
      return v ? v.textContent : '';
    });
    assert(/🛡 파수꾼/.test(t), '카드 제목 노출');
    assert(/못 받은 돈/.test(t), '미수금 칩: ' + t.slice(0, 200));
    assert(/6,000,000원/.test(t), '금액(1100만-500만): ' + t.slice(0, 300));
    assert(/밀린 AS/.test(t), 'AS 칩');
    assert(/보증만료/.test(t), '보증 칩');
    assert(/멈춘 현장/.test(t), '방치 칩');
  });

  await test('파수꾼 카드가 브리핑보다 먼저 — 첫 화면 최상단', async () => {
    const first = await page.evaluate(() => {
      // 파수꾼 카드가 브리핑 카드보다 앞에 그려지는지 — 두 클래스를 함께 훑어 순서를 본다
      const cards = [...document.querySelectorAll('#view .watch-card, #view .brief-card')];
      return cards.length ? cards[0].textContent.slice(0, 30) : '';
    });
    assert(/파수꾼/.test(first), '첫 카드가 파수꾼이어야 함: ' + first);
  });

  await test('펼치기 — 현장명·경과일·전화걸기 링크가 나온다', async () => {
    await page.evaluate(() => { const b = document.querySelector('[data-watchtoggle]'); if (b) b.click(); });
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => {
      const v = document.querySelector('#view');
      return { text: v ? v.textContent : '', tel: !!document.querySelector('#view a[href^="tel:"]') };
    });
    assert(/괴산현장/.test(o.text), '현장명');
    assert(/완료 30일 경과/.test(o.text), '경과일: ' + o.text.slice(0, 400));
    assert(o.tel, '전화 걸기 링크(현장에서 바로 통화)');
  });

  await test('★읽기 전용 — 카드를 그려도 직렬화 결과가 1바이트도 안 바뀐다', async () => {
    const same = await page.evaluate(() => {
      const norm = (d) => { const c = JSON.parse(JSON.stringify(d)); c.savedAt = ''; if (c.aiOps) c.aiOps = null; return JSON.stringify(c); };
      const before = norm(serializeData());
      hjWatchScan(); hjWatchCardHTML(); hjWatchCardHTML();
      const after = norm(serializeData());
      return before === after;
    });
    assert(same, '파수꾼 계산·렌더가 state를 변형하면 안 됨');
  });

  await test('★새 최상위 직렬화 키 없음 (접힘 상태는 메모리에만)', async () => {
    const r = await page.evaluate(() => {
      const k = Object.keys(serializeData());
      return { hasWatch: k.some(x => /watch/i.test(x)), keys: k.length };
    });
    assert(!r.hasWatch, 'watch 관련 키가 직렬화에 새로 들어가면 안 됨');
  });

  await test('일정표 폰에 받기 — .ics 파일이 만들어진다(캘린더 호환)', async () => {
    const o = await page.evaluate(() => {
      let captured = null, name = null;
      const origCreate = document.createElement.bind(document);
      const origURL = URL.createObjectURL;
      URL.createObjectURL = (b) => { captured = b; return 'blob:stub'; };
      document.createElement = function (t) { const el = origCreate(t); if (t === 'a') { el.click = function () { name = el.download; }; } return el; };
      exportAllICS();
      document.createElement = origCreate; URL.createObjectURL = origURL;
      return { type: captured ? captured.type : '', name, size: captured ? captured.size : 0 };
    });
    assert(/text\/calendar/.test(o.type), 'MIME이 text/calendar여야 폰이 캘린더로 엶: ' + o.type);
    assert(/\.ics$/.test(o.name || ''), '파일명 .ics: ' + o.name);
    assert(o.size > 0, '내용이 비어있지 않음');
  });

  await test('.ics 내용 — VCALENDAR/VEVENT 구조와 현장명이 들어간다', async () => {
    const ics = await page.evaluate(() => buildICS(state.schedule || []));
    assert(/^BEGIN:VCALENDAR/.test(ics), 'VCALENDAR 시작');
    assert(/BEGIN:VEVENT/.test(ics) && /END:VCALENDAR/.test(ics), 'VEVENT 포함·정상 종료');
    assert(/SUMMARY:\[괴산현장\] 철거/.test(ics), '제목에 현장명: ' + ics.slice(0, 300));
  });

  await test('시간 없는 일정(종일)도 .ics 생성 시 죽지 않는다', async () => {
    const ok = await page.evaluate(() => {
      try {
        const ics = buildICS([{ id: 'x1', date: new Date().toISOString().slice(0, 10), time: '', title: '종일작업', project: 'A' }]);
        return /DTSTART;VALUE=DATE:/.test(ics) && /DTEND;VALUE=DATE:/.test(ics);
      } catch (e) { return false; }
    });
    assert(ok, '종일 일정 분기(nextDayYmd)가 정상 동작해야 함');
  });

  await test('XSS — 현장명에 태그를 넣어도 카드에 실행 가능한 태그가 안 들어간다', async () => {
    await page.evaluate(() => {
      state.projects.push({ name: '<img src=x onerror=alert(1)>', stage: 2, phases: [],
        cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, received: 0, archived: false });
      state.files.push({ id: 'p9', kind: 'photo', project: '<img src=x onerror=alert(1)>', name: 'z.jpg',
        when: new Date(Date.now() - 40 * 86400000) });
      render();
    });
    await page.waitForTimeout(250);
    const bad = await page.evaluate(() => {
      const v = document.querySelector('#view');
      return v ? v.querySelectorAll('img[onerror]').length : -1;
    });
    assert(bad === 0, '주입된 img 태그가 살아나면 안 됨: ' + bad);
  });

  await test('이상 없을 때 — "챙길 게 없습니다"로 조용히 표시', async () => {
    // 현장이 0개면 앱이 대시보드 대신 '아직 현장이 없습니다' 안내를 띄운다(기존 동작).
    // 따라서 '현장은 있고 경보만 없는' 상태로 확인한다: 완납·완료 직후·AS 없음·최근 활동.
    const t = await page.evaluate(() => {
      const ymd = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      state.projects = [{ name: '깨끗한현장', stage: 3, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: {}, received: 11000000, doneAt: ymd(2), archived: false }];   // 완납 + 완료 2일(14일 미만)
      state.files = [{ id: 'e9', kind: 'estimate', project: '깨끗한현장', name: 'q.xlsx',
        est: { amount: 11000000 }, when: new Date(ymd(20)) }];
      state.asLog = []; state.schedule = [];
      render();
      const v = document.querySelector('#view');
      return v ? v.textContent : '';
    });
    assert(/챙길 게 없습니다/.test(t), '이상 없음 문구: ' + t.slice(0, 250));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== watch-card: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
