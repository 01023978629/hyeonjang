/* contract-qr-link-v572.e2e.js — 설치 QR 링크(#hjcontract=) 강화 (v572)

   왜: 전엔 링크 한 번 + [확인] 한 번으로 전자계약 서버 주소·관리자 토큰이 덮였다. 누가 보낸 QR 을 무심코 열면
   고객 계약이 남의 서버로 나간다(계약 문자·서명 링크가 그 서버에서 만들어진다). 그래서
     ⓐ 이 기기에 이미 **다른** 계약 서버 주소가 있으면 링크로는 바꾸지 않는다 — 안내 토스트뿐, 저장된 값 그대로, 확인 창도 없다
     ⓑ 처음 설치(저장된 주소 없음)·같은 주소면 확인 창(prompt)에 배포 ID 앞 6·뒤 4자리와 '이 주소로 고객 계약이 나갑니다' 를 보여 주고
        뒤 4자리를 쳐야 저장한다 — 틀리면 저장 안 함, 취소도 저장 안 함
     ⓒ 바뀐 때(contract_changed {at,via}) 를 IDB 에 남기고 설정 › 전자계약 탭에 '연결값 마지막 변경 …' 으로 보여 준다(설정 화면 저장도 같은 키)
   비밀값은 전과 같이 IDB 에만(serializeData 밖). 검사 값은 전부 자기서술형 가짜(AKfy…TEST, …-ADMIN-TOKEN-…).

   ① 다른 서버 저장돼 있음 → 거부: 확인 창 0 · 토스트 '설정 › 전자계약에서 직접' · IDB(주소·토큰·자가진단) 그대로 · # 조각 제거
   ② 처음 설치, 취소 → 저장 안 함. 확인 창 문구에 앞 6·뒤 4·경고 문장, 전체 배포 ID·토큰은 없음
   ③ 뒤 4자리 틀림 → 저장 안 함 · 토스트
   ④ 뒤 4자리 맞음 → 저장 · 자가진단 기록 비움 · contract_changed{via:'link'} · 새로 연 페이지가 부팅에서 읽어 설정 탭에 '설치 QR 링크' 로 표시
   ⑤ 같은 주소의 토큰 교체는 ⓑ 로 허용(확인 창 1) · changed 갱신
   ⑥ 설정 화면 [저장] 도 changed{via:'settings'} 를 남기고 탭 글이 바뀐다
   ⑦ 변이: 거부 분기 제거 → ① 이 뚫린다 / 뒤 4자리 비교 제거 → ③ 이 저장된다 — 둘 다 실제로 실행해 잡는다(서버가 주는 index.html 을 변이본으로 바꿔치기)
   전제: tests/static-server.js(8299) */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const enc = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
const DEP = 'AKfyLINKTEST0001';   // 앞 6 'AKfyLI' · 뒤 4 '0001'
const NEW = { v: 1, url: 'https://script.google.com/macros/s/' + DEP + '/exec', token: 'LINK-TEST-ADMIN-TOKEN-'.padEnd(64, 'Y') };
const ROTATED = { v: 1, url: NEW.url, token: 'LINK-TEST-ROTATED-TOKEN-'.padEnd(64, 'R') };
const OTHER_URL = 'https://script.google.com/macros/s/AKfyOTHERSERVER9999/exec', OTHER_TOKEN = 'OTHER-ADMIN-TOKEN-'.padEnd(64, 'Z');
const MUT = {
  'no-reject': ['if(prev&&prev!==contractBaseUrl(data.url)){', 'if(false){'],
  'no-4digit': ["if(String(typed).trim()!==depId.slice(-4)){", 'if(false){'],
};
for (const [k, [from]] of Object.entries(MUT)) assert(SRC.includes(from), '변이 앵커가 소스에 없다: ' + k);
const mutated = (k) => SRC.replace(MUT[k][0], MUT[k][1]);
let browser;

async function newCtx(html) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  if (html) await ctx.route(u => u.pathname === new URL(APP).pathname, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  return ctx;
}
// 저장된 계약 서버를 흉내낸다(이 기기에 이미 다른 서버가 있는 상황)
async function seedOther(ctx) {
  const p = await ctx.newPage();
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => window.__hjRestoreDone);
  await p.evaluate(async ([u, t]) => { await idbSet('contract_url', u); await idbSet('contract_token', t); await idbSet('contract_selftest', '2026-01-01T00:00:00.000Z'); }, [OTHER_URL, OTHER_TOKEN]);
  await p.close();
}
// answer: undefined → 취소(dismiss) · 문자열 → 그 값으로 확인
async function openWithLink(ctx, payload, answer) {
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push({ type: d.type(), message: d.message() }); if (answer === undefined) await d.dismiss(); else await d.accept(answer); });
  await page.goto(APP + '#hjcontract=' + payload, { waitUntil: 'domcontentloaded' });
  return { page, dialogs };
}
const idbGet = (page) => page.evaluate(() => idbGet('contract_url'));
const idb = (page) => page.evaluate(async () => ({ hash: location.hash, url: await idbGet('contract_url'), token: await idbGet('contract_token'), self: await idbGet('contract_selftest'), changed: await idbGet('contract_changed') }));
// 토스트는 결정 뒤 300ms 에 뜬다 — 글이 올 때까지 페이지 안에서 폴링(끝 신호가 따로 없다)
const waitToast = (page, subs) => page.evaluate(async (subs) => { for (let i = 0; i < 50; i++) { const t = document.querySelector('#toast'); if (t && subs.some(s => t.textContent.includes(s))) return t.textContent; await new Promise(r => setTimeout(r, 100)); } return 'TOAST_TIMEOUT:' + ((document.querySelector('#toast') || {}).textContent || ''); }, [].concat(subs));
const waitSaved = (page, url) => page.evaluate(async (url) => { for (let i = 0; i < 50; i++) { if ((await idbGet('contract_url')) === url) return true; await new Promise(r => setTimeout(r, 100)); } return false; }, url);
const settled = (page) => page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone].map(p => Promise.resolve(p).catch(() => 0))));

// ① 를 함수로 — 원본에서는 거부, no-reject 변이에서는 뚫려야 한다
async function scenarioReject(html) {
  const ctx = await newCtx(html);
  await seedOther(ctx);
  const { page, dialogs } = await openWithLink(ctx, enc(NEW), DEP.slice(-4));
  const toast = await waitToast(page, ['전자계약']);
  await settled(page);
  const s = await idb(page);
  await ctx.close();
  return { dialogs, toast, s };
}
// ③ 를 함수로 — 원본에서는 저장 안 함, no-4digit 변이에서는 저장된다
async function scenarioWrongDigits(html) {
  const ctx = await newCtx(html);
  const { page, dialogs } = await openWithLink(ctx, enc(NEW), '9999');
  const toast = await waitToast(page, ['뒤 4자리가 다릅니다', '저장 완료']);   // 원본은 오입력 안내, no-4digit 변이본은 저장 완료
  const saved = toast.includes('저장 완료') ? await waitSaved(page, NEW.url) : (await idbGet(page)) === NEW.url;
  const s = await idb(page);
  await ctx.close();
  return { dialogs, toast, saved, s };
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  // ① 다른 서버가 있으면 링크로는 바꾸지 않는다
  { const r = await scenarioReject(null);
    assert(r.dialogs.length === 0, '① 다른 서버가 저장돼 있는데 확인 창이 떴다: ' + JSON.stringify(r.dialogs));
    assert(r.toast.includes('설정 › 전자계약에서 직접 바꾸세요'), '① 거부 안내 토스트가 없다: ' + r.toast);
    assert(r.s.url === OTHER_URL && r.s.token === OTHER_TOKEN, '① 저장된 주소·토큰이 바뀌었다');
    assert(r.s.self === '2026-01-01T00:00:00.000Z', '① 거부인데 자가진단 기록을 지웠다');
    assert(!r.s.changed, '① 거부인데 변경 기록을 남겼다');
    assert(r.s.hash === '', '① # 조각이 주소창에 남았다');
    console.log('PASS ① 다른 서버 저장돼 있음 → 링크 거부(확인 창 0·값 그대로·안내)'); }

  // ② 처음 설치: 확인 창 문구, 취소하면 저장 안 함
  { const ctx = await newCtx(null);
    const { page, dialogs } = await openWithLink(ctx, enc(NEW), undefined);
    await settled(page);
    assert(dialogs.length === 1 && dialogs[0].type === 'prompt', '② 확인 창(prompt)이 한 번 떠야 한다: ' + JSON.stringify(dialogs));
    const msg = dialogs[0].message;
    assert(msg.includes(DEP.slice(0, 6)) && msg.includes(DEP.slice(-4)), '② 확인 창에 배포 ID 앞 6·뒤 4자리가 없다: ' + msg);
    assert(msg.includes('이 주소로 고객 계약이 나갑니다'), '② 확인 창에 경고 문장이 없다: ' + msg);
    assert(!msg.includes(DEP) && !msg.includes(NEW.token.slice(0, 12)), '② 확인 창에 배포 ID 전체나 토큰이 보인다');
    const s = await idb(page);
    assert(!s.url && !s.token && !s.changed, '② 취소했는데 저장됐다');
    await ctx.close();
    console.log('PASS ② 처음 설치 확인 창(앞 6·뒤 4·경고) · 취소 = 저장 안 함'); }

  // ③ 뒤 4자리 틀림
  { const r = await scenarioWrongDigits(null);
    assert(r.dialogs.length === 1, '③ 확인 창이 한 번이어야 한다');
    assert(!r.saved && !r.s.url && !r.s.token && !r.s.changed, '③ 뒤 4자리가 틀렸는데 저장됐다');
    assert(r.toast.includes('배포 ID 뒤 4자리가 다릅니다'), '③ 오입력 안내 토스트가 없다: ' + r.toast);
    console.log('PASS ③ 뒤 4자리 틀림 → 저장 안 함 · 안내'); }

  // ④ 맞으면 저장 + changed + 설정 탭 표시
  { const ctx = await newCtx(null);
    const { page, dialogs } = await openWithLink(ctx, enc(NEW), DEP.slice(-4));
    assert(await waitSaved(page, NEW.url), '④ 뒤 4자리가 맞는데 저장되지 않았다');
    const t = await waitToast(page, ['저장 완료']);
    assert(t.includes('자가진단'), '④ 저장 토스트가 자가진단을 안내하지 않는다: ' + t);
    const s = await idb(page);
    assert(dialogs.length === 1 && s.token === NEW.token && s.self === '', '④ 토큰·자가진단 초기화가 틀렸다');
    assert(s.changed && s.changed.via === 'link' && Math.abs(Date.now() - new Date(s.changed.at).getTime()) < 120000, '④ contract_changed{at,via:link} 가 없다: ' + JSON.stringify(s.changed));
    // 새 페이지: 부팅이 읽어 __contract.changed 에 두고, 설정 › 전자계약 탭이 보여 준다
    const p2 = await ctx.newPage();
    await p2.goto(APP, { waitUntil: 'domcontentloaded' });
    await settled(p2);
    const shown = await p2.evaluate(() => {
      const c = __contract.changed;
      openGdriveSetup();
      document.getElementById('setTab-ct').click();
      const panel = document.getElementById('setPanel-ct'), el = document.getElementById('ctChanged');
      return { via: c && c.via, url: __contract.url, hidden: panel.hidden, text: el ? el.textContent : '', expect: c ? localStamp(new Date(c.at)) : '' };
    });
    assert(shown.via === 'link' && shown.url === NEW.url, '④ 부팅이 contract_changed 를 읽지 않았다: ' + JSON.stringify(shown));
    assert(!shown.hidden && shown.text.includes('연결값 마지막 변경') && shown.text.includes(shown.expect) && shown.text.includes('설치 QR 링크'), '④ 설정 탭 변경 날짜 표시가 틀렸다: ' + JSON.stringify(shown));
    // ⑥ 설정 화면 저장도 같은 기록
    await p2.evaluate(() => { const r = document.getElementById('modalRoot'); r.querySelector('#ctTok').value = 'SETTINGS-SAVED-TOKEN-'.padEnd(48, 'S'); r.querySelector('#ctSave').click(); });
    const after = await p2.evaluate(async () => { for (let i = 0; i < 50; i++) { const c = await idbGet('contract_changed'); if (c && c.via === 'settings') return { c, text: document.getElementById('ctChanged').textContent }; await new Promise(r => setTimeout(r, 100)); } return null; });
    assert(after && after.text.includes('설정 화면') && after.text.includes('연결값 마지막 변경'), '⑥ 설정 화면 저장이 changed{via:settings} 를 남기지 않았다: ' + JSON.stringify(after));
    await p2.close();
    // ⑤ 같은 주소 토큰 교체는 확인 창을 거쳐 허용
    const { page: p3, dialogs: d3 } = await openWithLink(ctx, enc(ROTATED), DEP.slice(-4));
    const rotated = await p3.evaluate(async (tok) => { for (let i = 0; i < 50; i++) { if ((await idbGet('contract_token')) === tok) return await idbGet('contract_changed'); await new Promise(r => setTimeout(r, 100)); } return null; }, ROTATED.token);
    assert(d3.length === 1 && rotated && rotated.via === 'link' && new Date(rotated.at).getTime() >= new Date(after.c.at).getTime(), '⑤ 같은 주소의 토큰 교체가 막히거나 changed 가 갱신되지 않았다: ' + JSON.stringify({ d3, rotated }));
    await ctx.close();
    console.log('PASS ④ 뒤 4자리 맞음 → 저장·자가진단 비움·changed · ⑥ 설정 저장 기록 · ⑤ 같은 주소 토큰 교체 허용 · 설정 탭 표시'); }

  // ⑦ 변이 — 실제로 실행해서 잡는다
  { const r = await scenarioReject(mutated('no-reject'));
    assert(r.dialogs.length > 0 || r.s.url !== OTHER_URL, '변이 no-reject 가 잡히지 않았다 — ① 이 거부 분기 없이도 통과한다');
    const w = await scenarioWrongDigits(mutated('no-4digit'));
    assert(w.saved && w.s.url === NEW.url, '변이 no-4digit 가 잡히지 않았다 — ③ 이 4자리 비교 없이도 통과한다');
    console.log('PASS ⑦ 변이 2종(no-reject·no-4digit) 검출'); }

  console.log('PASS  contract-qr-link-v572 — 거부·확인 창·오입력·저장·changedAt·변이 2');
})().catch((e) => { console.error('FAIL ', e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
