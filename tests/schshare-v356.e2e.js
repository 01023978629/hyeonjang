/* schshare-v356.e2e.js — v356 📤 일정 공유: 팀원에게 카톡·문자·캘린더 파일로 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음 —
   navigator.share·canShare 와 문자 앱 열기(hjSmsGo)를 가로채 무엇을 넘기는지만 본다.
   · 범위: 오늘·내일·이번 주·다음 주(월~일)·그날·일정 하나. 현장 하나로 좁히기. 💰·세금 자동 일정 제외.
   · 여러 날 공정은 이어지는 날에도 'N/M일째'(v354). 글에 주소·인원·메모는 넣고 고객 이름·전화번호는 넣지 않는다.
   · 카톡 = 공유 시트에 (고친) 글, 문자 = 받는 번호(여러 명 쉼표) sms: 링크, 캘린더 = .ics(여러 날 공정은 날마다 하나).
   · 입구: 일정 탭 [📤 일정 공유] · 일정 ⋯ [팀에 공유] · 🔔 알림 문자 창 [📤 팀 공유](‹ 뒤로).
   · 자동 발송 없음, 저장본 그대로. 오늘은 2026-11-05(목)로 고정(localDate 를 가로챔). */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
    window.__shared = []; window.__sms = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    window.hjSmsGo = (u) => { window.__sms.push(u); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.contacts = [{ id: 'c1', name: '가상 타일팀', phone: '010-1111-2222', company: '' }];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '이가상', phone: '010-7777-6666', addr: '' } }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('ml', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)', workers: '2' }),
      S('td', '2026-11-05', '조명', { time: '13:00', memo: '거실 매입등 6개' }),
      S('bb', '2026-11-05', '도배', { time: '09:30', project: '가상현장B' }),
      S('pay', '2026-11-05', '💰 중도금', { hours: 0 }),
      S('tax', '2026-11-06', '부가세 신고 준비', { project: '', _taxAuto: true }),
      S('nw', '2026-11-10', '마감·청소')
    ];
    window.__toasts = []; window.__shared = []; window.__sms = [];
    __calSelDate = null;
  });

  await test('① 범위·글: 오늘은 시작 일정 + 이어지는 공정, 주소·인원·메모는 넣고 고객 이름·전화·💰·세금 일정은 뺀다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const rg = k => { const x = hjSchShareRange(k); return x.from + '~' + x.to; };
      const days = hjSchShareDays('2026-11-05', '2026-11-05', '');
      return {
        ranges: [rg('today'), rg('tomorrow'), rg('week'), rg('nextweek'), hjSchShareRange('day', '2026-11-20').from],
        ids: days.map(d => d.rows.map(x => x.s.id + (x.c ? ':' + x.c.day : ''))),
        text: hjSchShareText(days, '오늘', '11/5(목)'),
        weekA: hjSchShareDays('2026-11-02', '2026-11-08', '가상현장A').map(d => d.date + ':' + d.rows.map(x => x.s.id).join(','))
      };
    });
    assert(JSON.stringify(r.ranges) === JSON.stringify(['2026-11-05~2026-11-05', '2026-11-06~2026-11-06', '2026-11-02~2026-11-08', '2026-11-09~2026-11-15', '2026-11-20']), '범위: ' + JSON.stringify(r.ranges));
    assert(JSON.stringify(r.ids) === JSON.stringify([['bb', 'td', 'ml:2']]), '오늘 목록: ' + JSON.stringify(r.ids));
    const t = r.text;
    assert(/작업 일정 — 오늘 11\/5\(목\)/.test(t) && /■ 11\/5\(목\)/.test(t), '머리: ' + t);
    assert(/· 09:30 도배 — 가상현장B/.test(t) && /· 13:00 조명 — 가상현장A\n  주소: 대전 서구 둔산동 1 · 거실 매입등 6개/.test(t) && /· 09:00 타일 \(2\/3일째\) — 가상현장A\n  주소: 대전 서구 둔산동 1 · 👷 2명/.test(t), '줄: ' + t);
    assert(!/김가상|이가상|9999|7777|중도금|부가세/.test(t), '넣지 말아야 할 것: ' + t);
    assert(JSON.stringify(r.weekA) === JSON.stringify(['2026-11-04:ml', '2026-11-05:td,ml', '2026-11-06:ml']), '이번 주 A 현장: ' + JSON.stringify(r.weekA));
  });

  await test('② 일정 탭 [📤 일정 공유] → 범위 칩·현장 고르기 → 카톡 공유 시트에 (고친) 글', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.tab = 'schedule'; render(); await new Promise(r => setTimeout(r, 60));
      document.getElementById('schShare').click();
      const m = () => document.querySelector('#modalRoot .modal');
      const first = { title: m().querySelector('h3').textContent, chips: [...m().querySelectorAll('.shRange')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), count: m().querySelector('#shCount').textContent, chipH: Math.min(...[...m().querySelectorAll('.shRange,#shKakao,#shCal,#shCopy,#shSms')].map(b => b.getBoundingClientRect().height)) };
      [...m().querySelectorAll('.shRange')].find(b => b.textContent === '이번 주').click();
      const week = { count: m().querySelector('#shCount').textContent, opts: [...m().querySelectorAll('#shProj option')].map(o => o.textContent) };
      const sel = m().querySelector('#shProj'); sel.value = '가상현장A'; sel.dispatchEvent(new Event('change'));
      const onlyA = m().querySelector('#shText').value;
      m().querySelector('#shText').value = onlyA + '\n내일 자재 7시 도착';
      m().querySelector('#shKakao').click(); await new Promise(r => setTimeout(r, 30));
      return { first, week, onlyA, shared: window.__shared.map(s => ({ title: s.title, text: s.text })), wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(r.first.title === '📤 일정 공유' && JSON.stringify(r.first.chips) === JSON.stringify(['오늘*', '내일', '이번 주', '다음 주']) && /일정 3건/.test(r.first.count), '처음: ' + JSON.stringify(r.first));
    assert(r.first.chipH >= 44, '누르는 곳 높이: ' + r.first.chipH);
    assert(/일정 5건/.test(r.week.count) && JSON.stringify(r.week.opts) === JSON.stringify(['전체 현장', '가상현장A', '가상현장B']), '이번 주: ' + JSON.stringify(r.week));
    assert(/작업 일정 — 이번 주 · 가상현장A 11\/2\(월\)~11\/8\(일\)/.test(r.onlyA) && !/가상현장B/.test(r.onlyA) && /타일 \(3일 · ~11\/6\(금\)\)/.test(r.onlyA), '현장 좁히기: ' + r.onlyA);
    assert(r.shared.length === 1 && /작업 일정/.test(r.shared[0].title) && /내일 자재 7시 도착$/.test(r.shared[0].text), '카톡 공유: ' + JSON.stringify(r.shared));
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('③ 문자: 번호 없으면 막고, 한 명·여러 명(쉼표) sms 링크, 아이폰은 addresses 꼴', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjSchShareView({ kind: 'today' });
      const m = document.querySelector('#modalRoot .modal');
      m.querySelector('#shSms').click();
      const empty = { sms: window.__sms.length, toast: window.__toasts.slice(-1)[0], inv: m.querySelector('#shPhone').getAttribute('aria-invalid') };
      m.querySelector('#shPhone').value = '010-1111-2222'; m.querySelector('#shSms').click();
      m.querySelector('#shPhone').value = '010-1111-2222, 010 3333 4444'; m.querySelector('#shSms').click();
      const dl = [...m.querySelectorAll('#shContacts option')].map(o => o.value);
      const body = encodeURIComponent(m.querySelector('#shText').value.trim());
      Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
      const ios = [hjSmsUrl(['010-1111-2222'], 'a b'), hjSmsUrl(['010-1111-2222', '010-3333-4444'], 'a b')];
      delete navigator.userAgent;
      return { empty, sms: window.__sms, body, dl, ios, short: hjSmsUrl(['1234'], 'x') };
    });
    assert(r.empty.sms === 0 && /받는 번호/.test(r.empty.toast) && r.empty.inv === 'true', '빈 번호: ' + JSON.stringify(r.empty));
    assert(r.sms.length === 2 && r.sms[0] === 'sms:01011112222?body=' + r.body && r.sms[1] === 'sms:01011112222,01033334444?body=' + r.body, '문자 링크: ' + JSON.stringify(r.sms).slice(0, 200));
    assert(JSON.stringify(r.dl) === '["010-1111-2222"]', '연락처 목록: ' + JSON.stringify(r.dl));
    assert(r.ios[0] === 'sms:01011112222&body=a%20b' && r.ios[1] === 'sms:/open?addresses=01011112222,01033334444&body=a%20b' && r.short === '', '아이폰·짧은 번호: ' + JSON.stringify(r));
  });

  await test('④ 일정 ⋯ [팀에 공유] → 그 일정만, 캘린더 파일은 여러 날 공정을 날마다 하나씩(고객 정보·보고 없음)', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.schedule.find(s => s.id === 'ml').report = { done: '', issue: '가상 내부 메모', progress: '' };
      schMoreView('ml');
      const items = [...document.querySelectorAll('#modalRoot .smBtn')].map(b => b.dataset.act);
      document.querySelector('#modalRoot .smBtn[data-act="share"]').click();
      await new Promise(r => setTimeout(r, 160));
      const m = document.querySelector('#modalRoot .modal');
      const one = { title: m.querySelector('h3').textContent, chips: m.querySelectorAll('.shRange').length, count: m.querySelector('#shCount').textContent, text: m.querySelector('#shText').value };
      m.querySelector('#shCal').click(); await new Promise(r => setTimeout(r, 60));
      const f = window.__shared[0] && window.__shared[0].files && window.__shared[0].files[0];
      return { items, one, file: f ? { name: f.name, type: f.type, text: await f.text() } : null };
    });
    assert(JSON.stringify(r.items) === JSON.stringify(['workorder', 'share', 'copy', 'gcal', 'ics'])   /* v361 📄 일정 복사 추가 */, '⋯ 메뉴: ' + JSON.stringify(r.items));
    assert(/일정 공유 — 타일/.test(r.one.title) && r.one.chips === 0 && /일정 3건/.test(r.one.count) && /■ 11\/4\(수\)[\s\S]*■ 11\/5\(목\)[\s\S]*타일 \(2\/3일째\)[\s\S]*■ 11\/6\(금\)[\s\S]*타일 \(3\/3일째\)/.test(r.one.text), '일정 하나: ' + JSON.stringify(r.one));
    assert(r.file && /\.ics$/.test(r.file.name) && r.file.type === 'text/calendar', '파일: ' + JSON.stringify(r.file && { name: r.file.name, type: r.file.type }));
    const ics = r.file.text;
    const uids = (ics.match(/^UID:.*$/gm) || []).map(x => x.trim());
    assert(JSON.stringify(uids) === JSON.stringify(['UID:ml@manmul', 'UID:ml-d2@manmul', 'UID:ml-d3@manmul']), 'UID: ' + JSON.stringify(uids));
    assert(/DTSTART:20261105T090000/.test(ics) && /SUMMARY:\[가상현장A\] 타일 \(2\/3일째\)/.test(ics) && /주소: 대전 서구 둔산동 1/.test(ics), '내용: ' + ics.slice(0, 600));
    assert(!/김가상|9999|가상 내부 메모/.test(ics), '고객 정보·작업 보고가 들어갔다');
  });

  await test('⑤ 🔔 알림 문자 창 [📤 팀 공유] → 그날 공유 · ‹ 뒤로, 일정 없는 범위는 보내지 않는다', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      scheduleNotify('2026-11-06');
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /팀 공유/.test(b.textContent)).click();
      const m = () => document.querySelector('#modalRoot .modal');
      const day = { chips: [...m().querySelectorAll('.shRange')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), count: m().querySelector('#shCount').textContent };
      [...m().querySelectorAll('.mfoot button')].find(b => /뒤로/.test(b.textContent)).click();
      const back = m().querySelector('h3').textContent;
      hjSchShareView({ kind: 'day', date: '2026-11-20' });
      const none = { count: m().querySelector('#shCount').textContent, text: m().querySelector('#shText').value };
      m().querySelector('#shKakao').click(); m().querySelector('#shCal').click(); m().querySelector('#shCopy').click();
      m().querySelector('#shPhone').value = '010-1111-2222'; m().querySelector('#shSms').click();
      await new Promise(r => setTimeout(r, 30));
      return { day, back, none, shared: window.__shared.length, sms: window.__sms.length, toast: window.__toasts.slice(-1)[0] };
    });
    assert(JSON.stringify(r.day.chips) === JSON.stringify(['오늘', '내일', '이번 주', '다음 주', '11/6(금)*']) && /일정 1건/.test(r.day.count), '그날: ' + JSON.stringify(r.day));
    assert(/일정 알림 문자/.test(r.back), '뒤로: ' + r.back);
    assert(/일정 0건/.test(r.none.count) && /잡힌 일정이 없습니다/.test(r.none.text) && r.shared === 0 && r.sms === 0 && /공유할 일정이 없습니다/.test(r.toast), '빈 범위: ' + JSON.stringify(r));
  });

  await test('⑥ 공유 창은 저장본을 바꾸지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      ['today', 'tomorrow', 'week', 'nextweek'].forEach(k => { hjSchShareView({ kind: k }); });
      hjSchShareView({ ids: ['ml'] }); hjSchShareIcsItems(hjSchShareDays('2026-11-02', '2026-11-08', '')); closeModal(true);
      return { same: snap() === b0, dirty: !!state.dirty };
    });
    assert(r.same, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== schshare-v356: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
