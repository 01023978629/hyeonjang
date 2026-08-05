/* backup-visible.e2e.js — 서버 날짜별 백업의 성패가 보이는가

   배경: 드라이브에 백업 파일이 0건인 것을 몇 달 뒤에야 발견했다.
   코드 경로(relaySaveNow → relayDailyBackup → cloudApiBackup)와 서버쪽
   makeBackup_ 은 멀쩡했다. 진짜 문제는 **relayDailyBackup 이 모든 실패를
   catch(e){} 로 삼켜서**, 매일 조용히 실패해도 알려 줄 화면이 하나도
   없었다는 것이다. 백업 센터는 로컬 스냅샷만 보여 준다.

     ① 백업 성공 → 마지막 성공 날짜가 기록된다
     ② 백업 실패 → 사유가 기록된다 (조용히 삼키지 않는다)
     ③ 백업 센터에 성공 상태가 보인다
     ④ 백업 센터에 실패 사유와 다음 할 일이 보인다
     ⑤ 기록이 없으면 "아직 없음"으로 안내한다 (실패로 겁주지 않는다)
     ⑥ 중계 미연결이면 이 칸 자체를 띄우지 않는다 (쓸 수 없는 경고 금지)
     ⑦ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  // ⑥ 중계 미연결 상태에서는 칸이 없다
  const off = await page.evaluate(() => {
    __relay.url = ''; __relay.token = ''; __relayBackupStat = null;
    backupCenter();
    const t = document.getElementById('modalRoot').textContent || '';
    closeModal();
    return /서버 날짜별 백업/.test(t);
  });
  assert(!off, '⑥ 중계도 안 붙었는데 서버 백업 경고가 뜬다 — 손쓸 수 없는 경고는 노이즈다');

  // 중계 연결 상태로 전환 (가짜 값 — 실제 통신 없음)
  await page.evaluate(() => { __relay.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __relay.token = 'TEST-RELAY-TOKEN'; });

  // ⑤ 기록 없음
  const none = await page.evaluate(() => {
    __relayBackupStat = null;
    backupCenter();
    const t = document.getElementById('modalRoot').textContent || '';
    closeModal();
    return { hasRow: /서버 날짜별 백업 기록이 아직 없어요/.test(t), noAlarm: !/실패/.test(t) };
  });
  assert(none.hasRow, '⑤ 기록이 없을 때 안내가 없다');
  assert(none.noAlarm, '⑤ 기록만 없는데 "실패"로 겁을 준다');

  // ① 성공 기록
  const okRec = await page.evaluate(async () => {
    window.cloudApiBackup = async () => ({ ok: true, created: true, name: 'x.json' });
    await idbSet('relay_lastbackup', '');
    await relayDailyBackup();
    return { stat: __relayBackupStat, today: localDate() };
  });
  assert(okRec.stat && okRec.stat.ok === true && okRec.stat.d === okRec.today,
    '① 성공이 기록되지 않는다: ' + JSON.stringify(okRec.stat));

  // ③ 백업 센터에 성공 표시
  const okView = await page.evaluate(() => {
    backupCenter();
    const t = document.getElementById('modalRoot').textContent || '';
    closeModal();
    return { ok: /서버 날짜별 백업/.test(t) && /마지막 성공/.test(t), day: new RegExp(localDate()).test(t) };
  });
  assert(okView.ok && okView.day, '③ 백업 센터에 성공 상태가 안 보인다');

  // ② 실패 기록 — 삼키지 않는다
  const failRec = await page.evaluate(async () => {
    window.cloudApiBackup = async () => ({ ok: false, error: 'bad-request', message: '백업할 데이터 파일이 없습니다' });
    await idbSet('relay_lastbackup', '');
    await relayDailyBackup();
    return __relayBackupStat;
  });
  assert(failRec && failRec.ok === false, '② 실패가 기록되지 않는다 — 매일 조용히 실패해도 아무도 모른다');
  assert(/데이터 파일이 없습니다/.test(failRec.msg || ''), '② 실패 사유가 안 남는다: ' + JSON.stringify(failRec));

  // 예외(throw)도 삼키지 않는다
  const throwRec = await page.evaluate(async () => {
    window.cloudApiBackup = async () => { throw new Error('네트워크 끊김'); };
    await idbSet('relay_lastbackup', '');
    await relayDailyBackup();
    return __relayBackupStat;
  });
  assert(throwRec && throwRec.ok === false && /네트워크 끊김/.test(throwRec.msg || ''),
    '② 예외로 실패하면 기록이 사라진다: ' + JSON.stringify(throwRec));

  // ④ 백업 센터에 실패 사유 + 다음 할 일
  const failView = await page.evaluate(() => {
    __relayBackupStat = { d: '2026-08-01', ok: false, msg: '백업할 데이터 파일이 없습니다' };
    backupCenter();
    const t = document.getElementById('modalRoot').textContent || '';
    closeModal();
    return { fail: /서버 날짜별 백업 실패/.test(t), why: /데이터 파일이 없습니다/.test(t), next: /서버에 저장하기/.test(t) };
  });
  assert(failView.fail && failView.why, '④ 백업 센터에 실패와 사유가 안 보인다');
  assert(failView.next, '④ 실패만 알리고 뭘 해야 하는지 안 알려 준다');

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 성공 기록');
  console.log('PASS  ② 실패·예외 기록 (삼키지 않음)');
  console.log('PASS  ③ 백업 센터 성공 표시');
  console.log('PASS  ④ 백업 센터 실패 사유 + 다음 할 일');
  console.log('PASS  ⑤ 기록 없음 안내 (겁주지 않음)');
  console.log('PASS  ⑥ 중계 미연결이면 칸 없음');
  console.log('PASS  ⑦ pageerror 0');
  console.log('\n전부 통과 (7건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});
