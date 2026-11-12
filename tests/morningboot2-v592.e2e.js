/* v592 하루 자동 창 — 실제 대표 기기 조건(검토에서 나온 것). morningboot-v592 의 뒤편, 틀은 morningboot-v592.lib.js.
   ⑥ 서버(relay) — PC 가 밤에 올린 rev 2 · 폰 콜드 스타트(요청마다 1.5초 지연): v530 자동 반영이 먼저 끝나고 🌅 는 새 자료(PC 에서 넣은 일정)로 · 배너 없음 ·
      안 올린 변경이 있는 기기는 '서버 최신 자료' 띠 → 그 위엔 안 띄움(표시 없음) · 서버 자료가 같으면 느린 사진 목록 맞추기는 안 기다림 ·
      서버가 답하지 않으면 상한(12초) 뒤 이번 부팅은 건너뜀(표시 없음) (RELAY)
   ⑦ 설치 앱(standalone) 한눈 보기 — 오늘 브리핑이 남은 부팅엔 한눈 보기를 건너뛰고 🌅 하나 · 🔔 시스템 알림은 같은 요약이라 안 보내고 보낸 것으로 ·
      다음 부팅은 한눈 보기만 · 복원 전 짐작이 틀려 한눈 보기가 떠 있으면 그 위엔 안 띄움(표시 없음) (GLANCE)
   ⑧ 쓰는 중·두 브리핑·오류·새벽·빈 기기 — 새벽 0:40 은 창 없음(표시 없음) · 복원 직후 검색칸에 치는 중이면 안 띄우고 친 글자는 그대로 ·
      🌅 가 오류로 죽으면 표시를 되돌림 → 아침 7:10 에 🌅 · 손으로 연 🌅/🤖 뒤엔 다른 브리핑 없음 · 시험·세금 일정만 있는 기기엔 매일 빈 🌅 없음 (USER)
   HJ_V592_BASELINE=<commit> 는 ⑥ 에서, HJ_V592_MUTATION=no-relay-wait·no-relaybar-busy·no-fresh 는 ⑥, no-glance-busy·glance-always·no-notify-skip 은 ⑦,
   no-night·no-touch·mark-first·no-sibling·no-active-mark·no-nodata 는 ⑧ 에서 실패해야 한다(변이 표는 lib). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const { loadHtml, createKit, P, kst, THU } = require('./morningboot-v592.lib.js');
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const html = loadHtml(ROOT, SRC, process.env);
let browser, passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS morningboot2-v592 ' + name); }
// PC 에서 밤에 올린 서버 자료 — 이 기기 저장본에 현장 하나·오늘 일정 하나를 더한 것(rev 2)
function pcData(base) {
  const d = JSON.parse(JSON.stringify(base));
  d.projects.push(P('다온아파트'));
  d.schedule.push({ id: 's592pc', date: THU, time: '10:00', title: 'PC에서 넣은 실측', project: '다온아파트' });
  d.savedAt = kst(THU, '08:10').toISOString();
  return d;
}

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const { newContext, seed, cold, errors, network } = createKit({ APP, html, browser });
  try {
    await test('⑥ 서버 자동 반영이 먼저 · 🌅 는 새 자료로 · 띠 위엔 안 띄움 · 서버가 답 없으면 이번 부팅 건너뜀 (RELAY)', async () => {
      const ctx = await newContext(true);
      ctx.__relay.data = pcData(await seed(ctx, THU, { relay: {} }));
      ctx.__relay.delay = 1500;   // Apps Script 지연 — 예전 판은 창이 먼저 떠 자동 반영이 '손대는 중' 으로 막혔다
      const a = await cold(ctx, THU);
      assert.ok(a.projects.includes('다온아파트'), 'v530 자동 반영 — PC 에서 올린 현장이 들어왔다 ' + JSON.stringify(a.projects));
      assert.equal(a.relayBar, false, '서버 최신 자료 띠 없음(자동으로 받았다)');
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], '그 뒤 아침 브리핑 하나 ' + JSON.stringify(a.log));
      assert.ok(a.modalText.includes('PC에서 넣은 실측'), '브리핑이 새 자료(PC 에서 넣은 일정)로 만들어졌다');
      assert.deepEqual(a.result, { k: 'morning', shown: true }, JSON.stringify(a.result));
      assert.ok(!ctx.__relay.calls.includes('save'), '서버에 쓰지 않는다 ' + JSON.stringify(ctx.__relay.calls));
      await a.page.close();
      await ctx.close();
      // 안 올린 변경이 있는 기기 — 자동 반영 대신 '서버에 더 최신 자료' 띠(사람이 고른다). 그 위엔 하루 창을 띄우지 않는다
      const bctx = await newContext(true);
      bctx.__relay.data = pcData(await seed(bctx, THU, { relay: { unsynced: true } }));
      bctx.__relay.delay = 200;
      const b = await cold(bctx, THU);
      assert.equal(b.relayBar, true, '안 올린 변경이 있으면 띠(예전 그대로)');
      assert.deepEqual(b.log, [], '띠 위엔 하루 창 없음 ' + JSON.stringify(b.log));
      assert.deepEqual(b.result, { k: 'morning', shown: false, why: 'busy' }, JSON.stringify(b.result));
      assert.equal(b.ls.hj_morning_shown, null, '표시 없음 — 다음에 열 때');
      await b.page.close();
      await bctx.close();
      // 서버 자료가 같은 기기 — 서버 사진 목록(Drive 목록이라 느리다)이 끝나지 않아도 자료 확인(health)만 끝나면 🌅
      const fctx = await newContext(true);
      fctx.__relay.data = pcData(await seed(fctx, THU, { relay: {} }));
      fctx.__relay.rev = 1; fctx.__relay.hangActions = ['listFiles'];
      const f = await cold(fctx, THU, '', { noRelayWait: true });
      assert.deepEqual(f.log, ['🌅 오늘의 브리핑'], '사진 목록 맞추기는 기다리지 않는다 ' + JSON.stringify(f.log) + JSON.stringify(f.result));
      assert.ok(fctx.__relay.calls.includes('listFiles'), '사진 목록 요청은 나갔다(답만 없음) ' + JSON.stringify(fctx.__relay.calls));
      await f.page.close();
      await fctx.close();
      // 서버가 답하지 않음 — 상한(12초) 뒤 이번 부팅은 건너뜀(낡은 자료로 띄우거나 늦게 불쑥 띄우지 않는다)
      const cctx = await newContext(true);
      cctx.__relay.data = pcData(await seed(cctx, THU, { relay: {} }));
      cctx.__relay.hang = true;
      const c = await cold(cctx, THU, '', { noRelayWait: true });
      assert.deepEqual(c.result, { k: '', why: 'relay' }, JSON.stringify(c.result));
      assert.deepEqual(c.log, [], '창 없음 ' + JSON.stringify(c.log));
      assert.equal(c.ls.hj_morning_shown, null, '표시 없음');
      await c.page.close();
      await cctx.close();
    });

    await test('⑦ 설치 앱 한눈 보기 — 브리핑이 남은 부팅엔 한눈 보기 대신 🌅 하나 · 🔔 생략 · 다음은 한눈 보기만 · 한눈 보기 위엔 안 띄움 (GLANCE)', async () => {
      const glanceAt = kst(THU, '08:00').getTime();
      const ctx = await newContext(true, { standalone: true, notify: true, glance: 'once', glanceAt });
      await seed(ctx, THU);
      const a = await cold(ctx, THU);
      assert.equal(a.glance, false, '오늘 브리핑이 남은 부팅엔 한눈 보기를 건너뛴다(같은 요약 두 번 금지)');
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], JSON.stringify(a.log));
      assert.deepEqual(a.notes, [], '🌅 가 뜬 부팅엔 🔔 같은 요약 알림을 보내지 않는다 ' + JSON.stringify(a.notes));
      assert.equal(a.ls.hj_notify_fired, THU, '🔔 은 오늘 보낸 것으로(브리핑이 대신)');
      await a.page.close();
      const b = await cold(ctx, THU);
      assert.equal(b.glance, true, '다음 부팅은 한눈 보기(예전 그대로)');
      assert.deepEqual(b.log, [], '하루 창 없음 ' + JSON.stringify(b.log));
      await b.page.close();
      await ctx.close();
      // 복원 전 짐작이 틀린 기기(지난번 캐시에 '사용자 자료 없음') — 한눈 보기가 떠 있으면 그 위엔 띄우지 않고 표시도 안 남긴다
      const gctx = await newContext(true, { standalone: true, glance: 'u0', glanceAt });
      await seed(gctx, THU);
      const g = await cold(gctx, THU);
      assert.equal(g.glanceNow, true, '한눈 보기가 떠 있다');
      assert.deepEqual(g.log, [], '한눈 보기 위에 하루 창 없음 ' + JSON.stringify(g.log));
      assert.deepEqual(g.result, { k: 'morning', shown: false, why: 'busy' }, JSON.stringify(g.result));
      assert.equal(g.ls.hj_morning_shown, null);
      await g.page.close();
      await gctx.close();
    });

    await test('⑧ 새벽·쓰는 중·오류·손으로 연 브리핑·빈 기기 (USER)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const n = await cold(ctx, THU, '', { time: '00:40' });
      assert.deepEqual(n.result, { k: '', why: 'night' }, '자정 넘은 밤엔 그날 아침 몫을 쓰지 않는다 ' + JSON.stringify(n.result));
      assert.deepEqual(n.log, []);
      assert.equal(n.ls.hj_morning_shown, null);
      await n.page.close();
      const t = await cold(ctx, THU, '', { typing: '가온' });
      await t.page.keyboard.type('아파트');
      const tt = await t.page.evaluate(() => ({ modal: !!document.querySelector('#modalRoot .modal'), search: document.getElementById('globalSearch').value, active: document.activeElement && document.activeElement.id }));
      assert.deepEqual(t.result, { k: 'morning', shown: false, why: 'busy' }, '검색칸에 치는 중 — 그 위에 띄우지 않는다 ' + JSON.stringify(t.result));
      assert.deepEqual(t.log, []);
      assert.deepEqual(tt, { modal: false, search: '가온아파트', active: 'globalSearch' }, '친 글자는 검색칸에 그대로 ' + JSON.stringify(tt));
      assert.equal(t.ls.hj_morning_shown, null, '표시 없음');
      await t.page.close();
      // 🌅 가 열다가 죽음(v564→v586 처럼) — 스스로 적은 표시까지 되돌려, 그날 🌅·🤖 를 말없이 잃지 않는다
      const e = await cold(ctx, THU, '', { prep: () => { hjMorningBrief = () => { localStorage.setItem('hj_morning_shown', localDate()); throw new Error('v592 시험 오류'); }; } });
      assert.deepEqual(e.result, { k: 'morning', shown: false, why: 'error' }, JSON.stringify(e.result));
      assert.equal(e.ls.hj_morning_shown, null, '열다 죽은 브리핑의 표시는 되돌린다');
      assert.equal(e.ls.hj_active_brief, null);
      await e.page.close();
      const m = await cold(ctx, THU, '', { time: '07:10' });
      assert.deepEqual(m.log, ['🌅 오늘의 브리핑'], '아침에 열면 뜬다 ' + JSON.stringify(m.log));
      await m.page.close();
      await ctx.close();
      // 손으로 연 🌅(AI 도구·더보기) 뒤엔 🤖 자동 창 없음, 손으로 연 🤖 뒤엔 🌅 없음 — 하루 브리핑 두 번 금지
      for (const manual of ['morning', 'active']) {
        const mctx = await newContext(true);
        await seed(mctx, THU, { manual });
        const x = await cold(mctx, THU);
        assert.deepEqual(x.log, [], '손으로 연 ' + manual + ' 브리핑 뒤 다른 오늘 브리핑 없음 ' + JSON.stringify(x.log));
        assert.deepEqual(x.result, { k: '' }, JSON.stringify(x.result));
        await x.page.close();
        await mctx.close();
      }
      // 첫 안내를 끝낸 빈 기기 — 부팅이 넣는 시험·세금 일정만 있다. 매일 빈 🌅 를 띄우지 않는다
      const ectx = await newContext(true);
      const e1 = await cold(ectx, THU);
      assert.deepEqual(e1.log, [], '첫 부팅도 빈 브리핑 없음 ' + JSON.stringify(e1.log));
      assert.deepEqual(e1.result, { k: '', why: 'nodata' }, JSON.stringify(e1.result));
      await e1.page.close();
      const e2 = await cold(ectx, THU);
      assert.ok(e2.schedN > 0 && e2.projects.length === 0, '부팅이 넣은 일정만 있는 기기 ' + e2.schedN);
      assert.deepEqual(e2.log, [], '빈 브리핑 없음 ' + JSON.stringify(e2.log));
      assert.deepEqual(e2.result, { k: '', why: 'nodata' }, JSON.stringify(e2.result));
      await e2.page.close();
      await ectx.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally { await browser.close(); }
  console.log('morningboot2-v592: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error('FAIL morningboot2-v592', e && e.stack || e); process.exit(1); });
