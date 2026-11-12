/* v577 🔒 팀에게 나가는 일정 메모에서 출입 번호 빼기 — v552 '작업자 캘린더로 보내기'만 거르던 것을 나머지 길에도 (AGENTS v552 '후속 후보').
   📤 일정 공유 글·.ics·팀원별 글 · 🔔 작업자 문안 · 🔨 다음 공정 안내(전달 사항)는 메모를 줄·' / '·' · ' 토막으로 나눠 출입 번호처럼 보이는
   토막(hjLooksLikeAccessCode)을 빼고 ' · ' 로 잇는다(hjMemoOut 한 곳). 일정 메모 자체·대표 화면·내 폰 캘린더(알림 .ics)는 그대로.
   합성 자료, 시계 2026-11-05 고정, 바깥 쓰기 0.
   ① 규칙 — 번호 토막만 빠지고 '공동현관 폭 1100mm'·'주차 B2'·'보양비 30000원'은 남음 · 공정표 기간 뗌 · 뺀 수 (RULE)
   ② 📤 공유 글·.ics·팀원별 글에 번호 없음 · 창에 '🔒 … 1곳은 뺐어요' · 카톡 공유 글에도 없음 · 일정 메모는 그대로 (SHARE)
   ③ 🔔 작업자 문안(한 건·전체 묶음)에 번호 없음 · 카드 표시 · 고객 문안 그대로 (NOTIFY)
   ④ 🔨 다음 공정 안내 '전달 사항'에 번호 없음 · 남은 글은 그대로 (HANDOFF)
   ⑤ 작업자 캘린더 보내기(v552) 같은 글 · 내 폰 캘린더(알림 .ics)는 메모 그대로 · 저장본 불변 · 페이지 오류 0 · 외부 쓰기 0 (KEEP)
   HJ_V577_BASELINE=<commit> 은 ①, HJ_V577_MUTATION=no-scrub(공유 메모를 거르지 않음)은 ② 에서 실패해야 한다. */
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
  'no-scrub': ['function hjSchShareMemo(s){return hjMemoOut(s&&s.memo).text;}', "function hjSchShareMemo(s){return String(s&&s.memo||'').replace(/\\s+/g,' ').trim();}"]
};
let html = process.env.HJ_V577_BASELINE ? execFileSync('git', ['show', process.env.HJ_V577_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V577_MUTATION) {
  const m = MUT[process.env.HJ_V577_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V577_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const CODES = /1234|5678|0909|4321/;
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS memoscrub-v577 ' + name); }
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
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    window.__shared = []; window.__sms = []; window.__clip = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__shared.push(d); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__clip.push(String(t)); } } });
    window.hjSmsGo = u => { window.__sms.push(u); };
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = []; state.expenses = []; __tabStale = false;
  state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', company: '', team: true }];
  state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } }];
  const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
  state.schedule = [
    S('t1', '2026-11-05', '타일 (2일차 시작)', { crew: '김타일', memo: '2026-11-05~2026-11-06 (2일)\n현관 1234#\n자재는 문 앞 · 주차 B2' }),
    S('t2', '2026-11-05', '조명', { time: '13:00', memo: '공동현관 폭 1100mm / 도어락 5678* / 보양비 30000원' }),
    S('t3', '2026-11-09', '도배', { crew: '김타일', memo: '벽지 확인' })
  ];
  state.activeProject = null; state.tab = 'schedule'; __calSelDate = null; window.__shared = []; window.__sms = []; window.__clip = [];
  render();
};

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);
    const before = await page.evaluate(() => JSON.stringify(state.schedule));
    await test('① 규칙 — 번호 토막만 빠지고 단위 붙은 숫자는 남음 · 공정표 기간 뗌 · 뺀 수 (RULE)', async () => {
      const r = await page.evaluate(() => [
        hjMemoOut('2026-11-05~2026-11-06 (2일)\n현관 1234#\n자재는 문 앞 · 주차 B2'),
        hjMemoOut('공동현관 폭 1100mm / 도어락 5678* / 보양비 30000원'),
        hjMemoOut('0909'), hjMemoOut(''), hjMemoOut('거실 매입등 6개')]);
      assert.deepEqual(r, [{ text: '자재는 문 앞 · 주차 B2', cut: 1 }, { text: '공동현관 폭 1100mm · 보양비 30000원', cut: 1 }, { text: '', cut: 1 }, { text: '', cut: 0 }, { text: '거실 매입등 6개', cut: 0 }]);
    });
    await test('② 📤 공유 글·.ics·팀원별 글에 번호 없음 · 창 안내 · 카톡 공유 글 · 일정 메모 그대로 (SHARE)', async () => {
      const r = await page.evaluate(() => {
        const days = hjSchShareDays('2026-11-02', '2026-11-08', '');
        return { text: hjSchShareText(days, '이번 주', ''), ics: hjSchShareIcsItems(days).map(x => x.memo), cut: hjSchShareCut(days) };
      });
      assert.ok(!CODES.test(r.text), '공유 글에 번호: ' + r.text);
      assert.ok(/자재는 문 앞 · 주차 B2/.test(r.text) && /공동현관 폭 1100mm · 보양비 30000원/.test(r.text), '남은 메모: ' + r.text);
      assert.ok(r.ics.every(m => !CODES.test(m)) && r.ics.some(m => /주차 B2/.test(m)), '.ics 메모: ' + JSON.stringify(r.ics));
      assert.equal(r.cut, 2);
      await page.evaluate(() => hjSchShareView({ kind: 'week' }));
      const ui = await page.evaluate(() => { const h = document.querySelector('#modalRoot [data-sh-cut]'), pc = document.querySelector('#modalRoot .shPcKakao');
        return { cut: h && h.getAttribute('data-sh-cut'), txt: h && h.textContent, area: document.querySelector('#modalRoot #shText').value, pc: !!pc }; });
      assert.equal(ui.cut, '2', '창 안내: ' + JSON.stringify(ui));
      assert.ok(/출입 번호처럼 보이는 메모 2곳/.test(ui.txt) && !CODES.test(ui.area), '글상자: ' + ui.area);
      await page.click('#modalRoot #shKakao');
      await page.waitForFunction(() => window.__shared.length > 0);
      assert.ok(ui.pc, '팀원별 줄'); await page.click('#modalRoot .shPcKakao');
      await page.waitForFunction(() => window.__shared.length > 1);
      const shared = await page.evaluate(() => window.__shared.map(d => String(d.text || '')));
      assert.ok(shared.length === 2 && shared.every(t => t && !CODES.test(t)), '카톡 공유 글: ' + JSON.stringify(shared));
      assert.equal(await page.evaluate(() => JSON.stringify(state.schedule)), before, '일정 메모는 그대로');
      await page.evaluate(() => closeModal(true));
    });
    await test('③ 🔔 작업자 문안에 번호 없음 · 카드 표시 · 고객 문안 그대로 (NOTIFY)', async () => {
      const r = await page.evaluate(() => notifyDrafts('2026-11-05').map(x => ({ id: x.id, worker: x.worker, customer: x.customer, cut: x.cut })));
      assert.deepEqual(r.map(x => [x.id, x.cut]), [['t1', 1], ['t2', 1]]);
      assert.ok(r.every(x => !CODES.test(x.worker)), JSON.stringify(r.map(x => x.worker)));
      assert.ok(/메모: 자재는 문 앞 · 주차 B2/.test(r[0].worker) && /메모: 공동현관 폭 1100mm · 보양비 30000원/.test(r[1].worker), r[0].worker + '\n' + r[1].worker);
      assert.ok(/방문 예정입니다/.test(r[0].customer) && !/메모/.test(r[0].customer), '고객 문안 그대로');
      await page.evaluate(() => scheduleNotify('2026-11-05'));
      assert.equal(await page.locator('#modalRoot [data-sn-cut]').count(), 2);
      await page.click('#modalRoot #snAll');
      await page.waitForFunction(() => window.__clip.length > 0);
      const all = await page.evaluate(() => window.__clip[window.__clip.length - 1]);
      assert.ok(!CODES.test(all) && /주차 B2/.test(all), '전체 묶음: ' + all);
      await page.evaluate(() => closeModal(true));
    });
    await test('④ 🔨 다음 공정 안내 전달 사항에 번호 없음 (HANDOFF)', async () => {
      const t = await page.evaluate(() => { const s = state.schedule.find(x => x.id === 't1'), n = state.schedule.find(x => x.id === 't3');
        return hjHandoffText(Object.assign({}, s, { report: { progress: '완료', issue: '타일 줄눈 마감 확인\n비번 4321\n폐기물은 1층' } }), n); });
      assert.ok(!CODES.test(t), t);
      assert.ok(/전달 사항: 타일 줄눈 마감 확인 · 폐기물은 1층/.test(t), t);
      const t2 = await page.evaluate(() => hjHandoffText(Object.assign({}, state.schedule[0], { report: { progress: '완료', issue: '비번 4321' } }), state.schedule[2]));
      assert.ok(!/전달 사항/.test(t2) && !CODES.test(t2), '모두 빠지면 줄이 없음: ' + t2);
    });
    await test('⑤ 작업자 캘린더(v552) 같은 글 · 내 폰 캘린더는 메모 그대로 · 저장본 불변 · 오류 0 · 외부 쓰기 0 (KEEP)', async () => {
      const r = await page.evaluate(() => ({ send: hjSchCalSendItems(['t1', 't2']), alert: hjAlertIcsItems('2026-11-05').map(x => x.memo).join(' | ') }));
      assert.equal(r.send.cut, 2);
      assert.ok(r.send.items.every(x => !CODES.test(x.memo)), JSON.stringify(r.send.items));
      assert.ok(/1234/.test(r.alert) && /5678/.test(r.alert), '내 폰 캘린더(알림 .ics)는 대표 것이라 메모 그대로: ' + r.alert);
      assert.equal(await page.evaluate(() => JSON.stringify(state.schedule)), before, '저장본 불변');
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`memoscrub-v577: ${passed}/5 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL memoscrub-v577 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
