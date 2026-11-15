/* v592 아침 자동 창 콜드 스타트 — 첫 안내·하루 자동 창(🌅 아침 브리핑·🤖 오늘의 브리핑·📅 주간 브리핑·📊 운영 리포트)을 기기 자료 복원 뒤에 정한다.
   예전 부팅 줄은 복원(__hjRestoreDone)보다 먼저 돌아 늘 빈 state 를 봤다 — 자료가 IDB 에만 있는 콜드 스타트에서 아침 창이 한 번도 안 떴고(v586 기록),
   hj_onboard_done 이 없는 기존 사용자에게는 첫 안내가 떴다. 합성 자료(이름은 지어낸 것), 시계 고정, 바깥 쓰기 0.
   틀(시드·콜드 스타트·변이 표)은 morningboot-v592.lib.js — 서버 자동 반영·한눈 보기·쓰는 중·새벽·빈 기기는 morningboot2-v592(파일당 180초 상한 때문에 나눴다).
   ① 목요일 콜드 스타트 — 🌅 가 한 번만 뜨고 3초 안에 다른 자동 창 없음 · 저장본 불변 · 폰 390 넘침 없음 · 같은 날 다시 열면 아무것도(🤖 도) 안 뜸 (COLD)
   ② 월요일 — 첫 부팅은 🌅 만(주간 브리핑은 표시하지 않고 미룸) · 두 번째 부팅에 📅 주간 브리핑 · 세 번째는 없음 (WEEK)
   ③ 들어온 길·이미 떠 있는 창 — ?view=schedule 바로가기(🔔 알림은 그대로 한 번)·#hjreq= 작업 요청·#lead= 리드 첫 화면에는 하루 창 없음 ·
      사용자가 먼저 연 창 위에는 안 띄우고 표시도 안 남김 → 다음에 열면 뜸 (ENTRY)
   ④ 첫 안내 — 바로가기(?view=ai)로 연 새 기기는 첫 안내를 다음으로 미룸 · 빈 새 기기는 첫 안내(하루 창 없음) ·
      hj_onboard_done 이 없어도 IDB 자료가 복원되는 기존 사용자에게는 첫 안내 없이 🌅 (ONBOARD)
   ⑤ 자동화 브라우저(webdriver)는 하루 창 없음 · 유상 저장본(paid-generation)으로 복원된 기기도 🌅 — 띄워도 저장본 == 지금 상태 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (GUARD)
   HJ_V592_BASELINE=<commit> 는 ① 에서 실패해야 한다. HJ_V592_MUTATION=pre-restore·stack·no-sibling 은 ①, no-entry·no-link·no-busy 는 ③,
   onboard-empty·onboard-entry 는 ④ 에서 실패해야 한다(변이 표는 lib). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const { loadHtml, createKit, isOnboard, THU, MON } = require('./morningboot-v592.lib.js');
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const html = loadHtml(ROOT, SRC, process.env);
let browser, passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS morningboot-v592 ' + name); }

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const { newContext, seed, cold, errors, network } = createKit({ APP, html, browser });
  try {
    await test('① 목요일 콜드 스타트 — 🌅 한 번만 · 3초 안에 다른 자동 창 없음 · 저장본 불변 · 같은 날 다시 열면 없음 (COLD)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const a = await cold(ctx, THU, '', { settle: 3000 });   // 3초 더 — 두 번째 자동 창이 뜨는지 본다
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], '복원된 자료로 아침 브리핑이 한 번만 뜬다(3초 안에 다른 자동 창 없음) ' + JSON.stringify(a.log));
      assert.equal(a.open, '🌅 오늘의 브리핑', '아침 브리핑이 떠 있다');
      assert.deepEqual(a.result, { k: 'morning', shown: true }, '부팅 자동 창 결과 ' + JSON.stringify(a.result));
      assert.equal(a.ls.hj_morning_shown, THU, '🌅 오늘 본 것으로');
      assert.equal(a.ls.hj_weekbrief_shown, null, '주간 브리핑 표시는 건드리지 않는다');
      assert.equal(a.src, 'legacy-appState', '복원 출처 ' + a.src);
      assert.equal(a.snapAfter, a.snap, '자동 창은 localStorage 표시만 — 앱 저장본(serializeData)은 그대로');
      assert.equal(a.over, false, '폰 390 넘침 없음');
      assert.equal(a.smallBtns, 0, '창 버튼 44px');
      await a.page.close();
      const b = await cold(ctx, THU);
      assert.deepEqual(b.log, [], '같은 날 다시 열면 자동 창 없음 — 🤖 오늘의 브리핑도 두 번째 브리핑이라 안 뜬다 ' + JSON.stringify(b.log));
      assert.deepEqual(b.result, { k: '' }, '고를 창 없음 ' + JSON.stringify(b.result));
      await b.page.close();
      await ctx.close();
    });

    await test('② 월요일 — 첫 부팅 🌅 만(주간 브리핑은 표시 없이 미룸) · 두 번째 📅 주간 브리핑 · 세 번째 없음 (WEEK)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, MON);
      const a = await cold(ctx, MON);
      assert.deepEqual(a.log, ['🌅 오늘의 브리핑'], '첫 부팅은 아침 브리핑 하나 ' + JSON.stringify(a.log));
      assert.equal(a.ls.hj_weekbrief_shown, null, '밀린 주간 브리핑은 본 것으로 적지 않는다');
      await a.page.close();
      const b = await cold(ctx, MON);
      assert.deepEqual(b.log, ['🤖 주간 브리핑'], '두 번째 부팅에 주간 브리핑 ' + JSON.stringify(b.log));
      assert.deepEqual(b.result, { k: 'week', shown: true });
      assert.equal(b.ls.hj_weekbrief_shown, MON);
      await b.page.close();
      const c = await cold(ctx, MON);
      assert.deepEqual(c.log, [], '세 번째는 없음 ' + JSON.stringify(c.log));
      await c.page.close();
      await ctx.close();
    });

    await test('③ 바로가기·작업 요청·리드로 들어온 첫 화면엔 하루 창 없음(🔔 알림은 보냄) · 먼저 연 창 위엔 안 띄우고 표시도 안 남김 → 다음에 뜸 (ENTRY)', async () => {
      const ctx = await newContext(true, { notify: true });
      await seed(ctx, THU);
      const v = await cold(ctx, THU, '?view=schedule');
      assert.deepEqual(v.log, [], '바로가기(오늘 일정)로 들어오면 하루 창 없음 ' + JSON.stringify(v.log));
      assert.equal(v.tab, 'schedule', '바로가기 화면은 그대로');
      assert.deepEqual(v.result, { k: '', why: 'entry' });
      assert.equal(v.ls.hj_morning_shown, null, '표시를 남기지 않는다');
      assert.equal((v.notes || []).length, 1, '🔔 오늘의 알림은 창이 아니라 들어온 길과 상관없이 한 번 ' + JSON.stringify(v.notes));
      assert.equal(v.ls.hj_notify_fired, THU);
      await v.page.close();
      // #hjreq=(작업 요청 링크) — 주소는 부팅 초기에 지워지므로 그 전에 읽어 둔 표시로 판단한다(읽지 못한 요청은 알림만)
      const r = await cold(ctx, THU, '#hjreq=v592-bad');
      assert.deepEqual(r.log, [], '작업 요청 링크로 들어온 첫 화면에도 하루 창 없음 ' + JSON.stringify(r.log));
      assert.deepEqual(r.result, { k: '', why: 'entry' });
      assert.deepEqual(r.notes, [], '🔔 은 하루 한 번');
      await r.page.close();
      const lead = encodeURIComponent(JSON.stringify({ name: '시험고객', region: '가상동', type: '욕실', leadId: 'T592LEAD' }));
      const l = await cold(ctx, THU, '#lead=' + lead);
      assert.deepEqual(l.log, ['📥 새 상담 리드'], '리드 첫 화면 위에 하루 창 없음 ' + JSON.stringify(l.log));
      assert.equal(l.open, '📥 새 상담 리드', '리드 창이 그대로');
      assert.equal(l.ls.hj_morning_shown, null);
      await l.page.close();
      const u = await cold(ctx, THU, '', { userModal: true });
      assert.deepEqual(u.log, ['📝 사용자 창'], '먼저 연 창 위에 하루 창을 띄우지 않는다(갈아 끼우지 않음) ' + JSON.stringify(u.log));
      assert.deepEqual(u.result, { k: 'morning', shown: false, why: 'busy' });
      assert.equal(u.ls.hj_morning_shown, null, '건너뛴 날은 표시하지 않는다');
      await u.page.close();
      const w = await cold(ctx, THU);
      assert.deepEqual(w.log, ['🌅 오늘의 브리핑'], '다음에 열면 뜬다 ' + JSON.stringify(w.log));
      await w.page.close();
      await ctx.close();
    });

    await test('④ 첫 안내 — 바로가기로 연 새 기기는 미룸 · 빈 새 기기는 첫 안내만 · 플래그 없어도 복원 자료가 있으면 첫 안내 없이 🌅 (ONBOARD)', async () => {
      const ctx = await newContext(false);
      const n = await cold(ctx, THU, '?view=ai');
      assert.ok(!n.log.some(isOnboard), '바로가기(AI 비서)로 연 새 기기에 첫 안내를 겹쳐 띄우지 않는다 ' + JSON.stringify(n.log));
      assert.deepEqual(n.result, { k: '', why: 'entry' }, JSON.stringify(n.result));
      assert.equal(n.ls.hj_onboard_done, null, '첫 안내는 다음에 평범하게 열 때로');
      await n.page.close();
      const e = await cold(ctx, THU);
      assert.equal(e.log.length, 1, '빈 기기는 자동 창 하나 ' + JSON.stringify(e.log));
      assert.ok(isOnboard(e.log[0]), '빈 새 기기는 첫 안내 ' + JSON.stringify(e.log));
      assert.deepEqual(e.result, { k: 'onboard', shown: true });
      assert.equal(e.ls.hj_morning_shown, null, '첫 안내 날엔 하루 창 없음');
      await e.page.close();
      await seed(ctx, THU);
      const d = await cold(ctx, THU);
      assert.ok(!d.log.some(isOnboard), '자료가 IDB 에 있는 기존 사용자에게 첫 안내 없음 ' + JSON.stringify(d.log));
      assert.deepEqual(d.log, ['🌅 오늘의 브리핑'], '대신 아침 브리핑 하나 ' + JSON.stringify(d.log));
      assert.equal(d.ls.hj_onboard_done, null, '첫 안내 플래그는 건드리지 않는다');
      await d.page.close();
      await ctx.close();
    });

    await test('⑤ 자동화 브라우저는 하루 창 없음 · 유상 저장본 기기도 🌅·저장본 == 지금 상태 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (GUARD)', async () => {
      const ctx = await newContext(true);
      await seed(ctx, THU);
      const r = await cold(ctx, THU, '', { realWebdriver: true });
      assert.deepEqual(r.log, [], '자동화 브라우저(기존 검사들)에는 하루 창을 띄우지 않는다 ' + JSON.stringify(r.log));
      assert.deepEqual(r.result, { k: '', why: 'webdriver' });
      assert.equal(r.ls.hj_morning_shown, null);
      await r.page.close();
      await ctx.close();
      // 유상 저장본(paid-generation)으로 복원된 기기 — 아침 브리핑을 띄워도 복원된 바이트 그대로(빈 배열·객체를 붙이지 않는다)
      const pctx = await newContext(true);
      await seed(pctx, THU, { paid: true });
      const s = await cold(pctx, THU);
      assert.equal(s.src, 'paid-generation', '유상 저장본으로 복원 ' + s.src);
      assert.deepEqual(s.log, ['🌅 오늘의 브리핑'], '유상 저장본 기기에도 아침 브리핑 ' + JSON.stringify(s.log));
      assert.equal(s.snapAfter, s.snap, '하루 창을 띄워도 유상 저장본 그대로');
      const exact = await s.page.evaluate(async () => { try { const r = await resolvePaidCommitState(); assertPaidLiveStateExact(r.data); return 'ok'; } catch (e) { return String(e && e.message || e); } });
      assert.equal(exact, 'ok', '저장본 == 지금 상태(유상 정확 일치) ' + exact);
      await s.page.close();
      await pctx.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally { await browser.close(); }
  console.log('morningboot-v592: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL morningboot-v592', e && e.stack || e); process.exit(1); });
