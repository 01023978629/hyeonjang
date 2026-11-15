/* v608 🗂📥 사진 명령에 대표 규칙 — '현장 작업 사진만' (대표 11/16)
   "구글 포토와 카카오서랍은 내가 현장에서 작업한 사진만 분류해서 받아서 저장하고 프로젝트에 넣어줘야해 —
    현장웹은 정리 및 관리 용이고 만물웹은 홍보용이야".
   규칙(CW_PHOTO_OWN)은 저장된 명령 글이 아니라 복사할 때 끝에 붙는다(cwRuleTail) — 기본 명령은 처음 들어온 날의 글로
   저장되고(coworkTasksEnsure) 새 문구로 바뀌지 않으니, 글만 고치면 이미 쓰던 기기·대표가 고친 명령에는 안 들어간다.
   ① COPY  🗂 cw_sitesort · 📥 cw_photoin 복사·전체 보기에 규칙이 끝에 한 번 · 앞부분은 예전 복사 글 그대로 · 다른 명령엔 없음 · 저장본 불변
   ② OLD   대표가 고친 명령에도 붙음 · 이미 규칙을 적어 둔 명령엔 두 번 안 붙음 · ⏰ 지시서 파일(coworkOrderText)에도
   ③ RULE  규칙 내용(현장 작업 사진만·뺄 것·애매하면 묻기·현장웹=정리·관리·만물웹=홍보·받지 않은 장수) · 고치는 창 안내
   ④ PHONE 폰 390 — 복사·넘침 없음·단추 44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0
   변이(HJ_V608_MUTATION): no-tail ① · all-cmds ① · dup-head ② · no-order ② · no-hint ③. 기준선(HJ_V608_BASELINE=2da3942)은 ① 실패. */
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
  'no-tail': ['function cwWithSkill(t){return cwWithSkillBody(t)+cwRuleTail(t);}', 'function cwWithSkill(t){return cwWithSkillBody(t);}'],
  'all-cmds': ["return t&&CW_PHOTO_OWN_IDS.includes(t.id)&&!String(t.prompt||'').includes(CW_PHOTO_OWN_HEAD)?", "return t&&!String(t.prompt||'').includes(CW_PHOTO_OWN_HEAD)?"],
  'dup-head': ["&&!String(t.prompt||'').includes(CW_PHOTO_OWN_HEAD)?'\\n\\n'+CW_PHOTO_OWN:'';", "?'\\n\\n'+CW_PHOTO_OWN:'';"],
  'no-order': ["    const own=cwRuleTail(x.task);if(own)md+=own.trim()+'\\n\\n';   // v608 사진 명령엔 대표 규칙\n", ''],
  'no-hint': ["(t&&CW_PHOTO_OWN_IDS.includes(t.id)?'<div id=\"cwOwnHint\"", "(false?'<div id=\"cwOwnHint\""]
};
let html = process.env.HJ_V608_BASELINE ? execFileSync('git', ['show', process.env.HJ_V608_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V608_MUTATION) {
  const m = MUT[process.env.HJ_V608_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V608_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS photorule-v608 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    // 복사는 가로채서 본다(실제 클립보드 권한 없이)
    window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(String(t)); return Promise.resolve(); } } });
  }, BOOT);
  await page.evaluate(mobile => { __mobileMode = mobile; applyMobileMode(); }, width < 600);   // 모바일 모드는 폭이 아니라 설정값 — 명시적으로
  return { context, page };
}
// 합성 자료 — 현장 둘, 일정 둘(복사할 때 {최근일정}·{현장목록}이 채워지는 것까지 같이 본다)
const SEED = () => {
  closeModal(true);
  state._demo = false; state.files = []; state.notes = []; state.quotes = []; state.payLog = []; __tabStale = false;
  state.projects = [{ name: '가온아파트', stage: 2 }, { name: '보람마을 2단지', stage: 1 }];
  state.schedule = [
    { id: 's1', date: '2026-11-13', time: '09:00', title: '욕실 타일', project: '가온아파트', workers: '', memo: '', hours: 8, report: null },
    { id: 's2', date: '2026-11-16', time: '13:00', title: '누수 탐지', project: '', workers: '', memo: '', hours: 2, report: null }
  ];
  state.coworkTasks = undefined; state._coworkInit = false;
};
const stable = () => { const d = serializeData(); delete d.savedAt; return JSON.stringify(d); };
const RULE = () => (typeof CW_PHOTO_OWN !== 'undefined' ? CW_PHOTO_OWN : '');
const HEAD = '[대표 규칙 — 현장 작업 사진만 · 위 할 일보다 먼저 지킨다]';
const count = (s, x) => String(s).split(x).length - 1;
const ROW_COPY = id => '#modalRoot .cw-row[data-cw-row="' + id + '"] .cwCopy';

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);

    await test('① 🗂·📥 복사·전체 보기에 대표 규칙이 끝에 한 번 · 앞부분은 예전 복사 글 그대로 · 다른 명령엔 없음 · 저장본 불변 (COPY)', async () => {
      const rule = await page.evaluate(RULE);
      assert.ok(rule.startsWith(HEAD), '규칙 상수 ' + JSON.stringify(rule.slice(0, 60)));
      await page.evaluate(() => { coworkTasksEnsure(); coworkTasksManage(); });
      await page.waitForSelector(ROW_COPY('cw_sitesort'));
      const before = await page.evaluate(stable);
      const copyOf = async id => {
        await page.evaluate(() => { window.__copied = []; });
        await page.click(ROW_COPY(id));
        await page.waitForFunction(() => window.__copied.length === 1);
        return page.evaluate(id => ({ text: window.__copied[0], body: typeof cwWithSkillBody === 'function' ? cwWithSkillBody(state.coworkTasks.find(t => t.id === id)) : '', saved: state.coworkTasks.find(t => t.id === id).prompt }), id);
      };
      for (const id of ['cw_sitesort', 'cw_photoin']) {
        const c = await copyOf(id);
        assert.equal(count(c.text, HEAD), 1, id + ' 규칙 한 번:\n' + c.text.slice(-700));
        assert.ok(c.text.endsWith('\n\n' + rule), id + ' 규칙은 맨 끝:\n' + c.text.slice(-400));
        assert.equal(c.text, c.body + '\n\n' + rule, id + ' 앞부분은 예전 복사 글(스킬 줄 + 채운 명령) 그대로');
        assert.ok(c.text.startsWith('🧰 사용할 스킬: manmul-hyeonjang') && !c.text.includes('{최근일정}') && !c.saved.includes(HEAD), id + ' 스킬 줄·자리 채움·저장된 글엔 규칙 없음');
      }
      const site = await copyOf('cw_sitesort');
      assert.ok(site.text.includes('09:00 욕실 타일 — 가온아파트') && site.text.includes('- 보람마을 2단지'), '일정·현장 목록은 예전처럼 채워짐');
      // 다른 명령(사진 분류 셋 + 다른 분류)에는 붙지 않는다
      for (const id of ['cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_calsync', 'cw_stmt']) {
        const c = await copyOf(id);
        assert.equal(count(c.text, HEAD), 0, id + ' 에는 규칙 없음');
        assert.equal(c.text, c.body, id + ' 복사 글 그대로');
      }
      // 전체 보기 — 화면 글·[📋 이 명령 복사]에도
      await page.evaluate(() => coworkTaskView('cw_sitesort'));
      await page.waitForSelector('#modalRoot #cwvCopy');
      const v = await page.evaluate(async () => { const root = document.getElementById('modalRoot'); window.__copied = []; root.querySelector('#cwvCopy').click(); await new Promise(r => setTimeout(r, 50));
        return { body: root.textContent, copied: window.__copied[0] || '' }; });
      assert.ok(v.body.includes(HEAD) && v.body.includes('만물웹(홈페이지)은 홍보용이다'), '전체 보기 화면에 규칙');
      assert.equal(v.copied, site.text, '전체 보기 복사도 같은 글');
      assert.equal(await page.evaluate(stable), before, '저장본 불변(규칙은 복사할 때만 붙음)');
      await page.evaluate(() => closeModal(true));
    });

    await test('② 대표가 고친 명령에도 붙음 · 이미 적어 둔 명령엔 두 번 안 붙음 · ⏰ 지시서 파일에도 (OLD)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(head => {
        coworkTasksEnsure();
        const site = state.coworkTasks.find(t => t.id === 'cw_sitesort'), inn = state.coworkTasks.find(t => t.id === 'cw_photoin');
        site.prompt = '대표가 고친 사진 정리 명령 {오늘}';   // 이미 쓰던 기기 — 저장된 글은 새 문구로 안 바뀐다
        inn.prompt = '받은 사진 옮기기\n\n' + head + '\n- 대표가 직접 적어 둔 규칙';   // 규칙을 이미 손으로 적어 둔 경우
        const a = cwWithSkill(site), b = cwWithSkill(inn), dupe = cwWithSkill(state.coworkTasks.find(t => t.id === 'cw_dupe'));
        const md = coworkOrderText([{ task: state.coworkTasks.find(t => t.id === 'cw_sitesort'), sched: { freq: 'daily' } }, { task: state.coworkTasks.find(t => t.id === 'cw_dupe'), sched: { freq: 'weekly' } }]);
        const md2 = coworkOrderText([{ task: inn, sched: { freq: 'daily' } }]);
        return { a, b, dupe, md, md2, rule: CW_PHOTO_OWN };
      }, HEAD);
      assert.ok(r.a.includes('대표가 고친 사진 정리 명령 20261116') && r.a.endsWith('\n\n' + r.rule), '고친 명령 + 규칙:\n' + r.a);
      assert.equal(count(r.b, HEAD), 1, '이미 적어 둔 규칙은 두 번 안 붙음:\n' + r.b);
      assert.ok(r.b.endsWith('- 대표가 직접 적어 둔 규칙'), '손으로 적은 글 그대로');
      assert.equal(count(r.dupe, HEAD), 0, '다른 명령엔 없음');
      assert.equal(count(r.md, HEAD), 1, '지시서 파일 — 사진 명령에 규칙 한 번(중복 정리 명령엔 없음):\n' + r.md.slice(0, 900));
      const i1 = r.md.indexOf('대표가 고친 사진 정리 명령 20261116'), iRule = r.md.indexOf(HEAD), i2 = r.md.indexOf('## 2.');
      assert.ok(i1 > 0 && iRule > i1 && i2 > iRule, '규칙은 그 명령 바로 뒤(다음 명령 앞) ' + JSON.stringify([i1, iRule, i2]));
      assert.equal(count(r.md2, HEAD), 1, '지시서 파일도 이미 적어 둔 규칙은 두 번 안 붙음');
    });

    await test('③ 규칙 내용 — 현장 작업 사진만·뺄 것·애매하면 묻기·현장웹=정리·관리·만물웹=홍보 · 고치는 창 안내 (RULE)', async () => {
      const rule = await page.evaluate(RULE);
      const want = {
        own: /구글 포토·톡서랍·다운로드 폴더에서 내가 현장에서 작업하며 찍은 사진·동영상만 받아 현장사진에 넣는다/,
        skip: /개인 사진\(가족·여행·음식 등\)·화면 캡처·남이 보낸 사진\(협력사·고객이 올린 것\)·광고·문서 이미지는 받지도 옮기지도 않는다/,
        ask: /애매하면 넣지 말고 '확인필요' 표에 날짜·장수·어디서\(톡방 이름·구글 포토\)만 적어 나에게 묻는다/,
        manage: /현장웹은 정리·관리용이다 — 사진은 만물 폴더 현장사진\/<현장 이름>\/ 에 두고, 현장\(프로젝트\)은 현장웹 화면에서 만들고 넣는다\(_현장\.json 을 고쳐 만들지 않는다\)/,
        promo: /만물웹\(홈페이지\)은 홍보용이다 — 이 일에서는 홈페이지에 아무것도 올리지 않는다/,
        tally: /받지 않은 장수도 알려 준다/
      };
      const got = Object.fromEntries(Object.entries(want).map(([k, re]) => [k, re.test(rule)]));
      assert.deepEqual(got, Object.fromEntries(Object.keys(want).map(k => [k, true])), '규칙 내용 ' + JSON.stringify(got) + '\n' + rule);
      // 고치는 창 — 사진 명령엔 '복사할 때 붙는다' 안내, 다른 명령엔 없음
      await page.evaluate(SEED);
      await page.evaluate(() => { coworkTasksEnsure(); coworkTaskEdit('cw_sitesort'); });
      await page.waitForSelector('#modalRoot #cwPrompt');
      const e1 = await page.evaluate(() => { const root = document.getElementById('modalRoot'); return { hint: (root.querySelector('#cwOwnHint') || {}).textContent || '', raw: root.querySelector('#cwPrompt').value }; });
      assert.ok(/복사할 때 끝에 「대표 규칙 — 현장 작업 사진만」이 붙어요/.test(e1.hint) && /현장웹은 정리·관리용 · 만물웹은 홍보용/.test(e1.hint), '고치는 창 안내 ' + e1.hint);
      assert.ok(!e1.raw.includes(HEAD), '고치는 창은 저장된 글(규칙 없음)');
      await page.evaluate(() => coworkTaskEdit('cw_dupe'));
      await page.waitForSelector('#modalRoot #cwPrompt');
      assert.equal(await page.evaluate(() => !!document.querySelector('#modalRoot #cwOwnHint')), false, '다른 명령엔 안내 없음');
      await page.evaluate(() => closeModal(true));
      await context.close();
    });

    await test('④ 폰 390 — 복사에 규칙 · 가로 넘침 없음 · 단추 44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      const phone = await open(390);
      await phone.page.evaluate(SEED);
      await phone.page.evaluate(() => { coworkTasksEnsure(); coworkTasksManage(); });
      await phone.page.waitForSelector(ROW_COPY('cw_photoin'));
      await phone.page.evaluate(() => { window.__copied = []; });
      await phone.page.click(ROW_COPY('cw_photoin'));
      await phone.page.waitForFunction(() => window.__copied.length === 1);
      assert.equal(count(await phone.page.evaluate(() => window.__copied[0]), HEAD), 1, '폰 복사에도 규칙 한 번');
      const measure = () => phone.page.evaluate(() => { const root = document.getElementById('modalRoot'), modal = root.querySelector('.modal') || root;
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, modalOver: modal.scrollWidth - modal.clientWidth,
          small: [...root.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => [b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44) }; });
      await phone.page.evaluate(() => coworkTaskView('cw_photoin'));
      await phone.page.waitForSelector('#modalRoot #cwvCopy');
      const view = await measure();
      assert.ok(view.over <= 0 && view.modalOver <= 1 && view.small.length === 0, '전체 보기 ' + JSON.stringify(view));
      await phone.page.evaluate(() => coworkTaskEdit('cw_photoin'));
      await phone.page.waitForSelector('#modalRoot #cwOwnHint');
      const edit = await measure();
      assert.ok(edit.over <= 0 && edit.modalOver <= 1 && edit.small.length === 0, '고치는 창 ' + JSON.stringify(edit));
      const shown = await phone.page.evaluate(() => typeof APP_BUILD === 'string' ? APP_BUILD : '');
      const sw = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1];
      const target = (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1];
      if (!html) assert.deepEqual([shown, sw], [target, target], '핀 3곳 ' + JSON.stringify([shown, sw, target]));
      assert.ok(/^hyeonjang-v(\d+)-/.test(target) && Number(target.match(/^hyeonjang-v(\d+)-/)[1]) >= 608, '핀은 v608 이상 ' + target);
      await phone.context.close();
      assert.deepEqual(errors, [], '페이지 오류 ' + JSON.stringify(errors));
      assert.equal(network.writes, 0, '바깥 쓰기 요청 0');
    });

    console.log(`photorule-v608: ${passed}/4 통과`);
  } catch (error) {
    console.error('FAIL photorule-v608', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
