/* v529 🧰 클로드 명령어 모음 — 10/31 대표 "이렇게 클로드가 개입할 수 있도록 명령어 모음집을 추가해줘". 합성 상태만, 바깥 쓰기 0.
   옛 🖥 Cowork 작업 지휘부(명령 5개)를 분류·준비물·찾기가 있는 명령어 모음으로. 10/31 클로드가 손으로 한 일 10가지를 기본 명령으로 더했다.
   ① 기본 명령 15개: 새 10개 + 옛 5개 · 모두 분류·준비물 · 자료를 만지는 명령엔 지킬 것(삭제 금지·보관 폴더·백업·계좌 비움·병합 안 함) ·
      이미 쓰던 목록에는 빠진 것만 뒤에 붙고 고친 명령·내 명령은 그대로 (DEFAULTS)
   ② 화면: 더보기 '🧰 클로드 명령어'(찾기 '명령어') → 분류 순서 사진·견적·정산·저장·내 명령 · 분류 안 순서는 정해진 순서(옛 명령이 앞에 저장돼 있어도) ·
      준비물 줄 · 내 명령 표시 · 내가 쓴 이름·아이콘은 글자로만 (UI)
   ③ 복사: 스킬 줄 + 명령 · {오늘} → 오늘 날짜(저장된 명령은 그대로) · '클로드에 붙여넣으세요' · 전체 보기의 준비물·복사 (COPY)
   ④ 찾기: 이름·준비물 · 여러 낱말은 모두 들어간 것 · 없으면 안내 · 지우면 다시 전부 (FILTER)
   ⑤ 스킬 명령문 카탈로그·도움말·AI 도구 이름 (CATALOG)
   ⑥ 폰 390: 가로 넘침 없음 · 단추 44px · 찾기 칸 16px (PHONE)
   ⑦ 핀 3곳(v529 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V529_BASELINE=<commit> 은 ① 에서, HJ_V529_MUTATION=no-fill({오늘} 안 바꿈) 은 ③ 에서 실패해야 한다. */
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
let html = process.env.HJ_V529_BASELINE ? execFileSync('git', ['show', process.env.HJ_V529_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V529_MUTATION === 'no-fill') {
  const from = "  return cwSkillLine(t)+'\\n\\n'+cwFill(t.prompt);\n";
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, "  return cwSkillLine(t)+'\\n\\n'+t.prompt;\n");
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  // 복사는 가로채서 본다(실제 클립보드 권한 없이)
  await page.evaluate(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(String(t)); return Promise.resolve(); } } }); } catch (e) { window.__clipErr = String(e); } });
  return { context, page };
}
const NEW_IDS = ['cw_photoin', 'cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_stmt', 'cw_salescheck', 'cw_pay', 'cw_unbilled', 'cw_save', 'cw_dev'];
const OLD_IDS = ['cw_card', 'cw_tax', 'cw_photo', 'cw_bugtest', 'cw_month'];
// 이미 쓰던 목록: 옛 기본 5개(카드 명령은 대표가 고침) + 내 명령 1개(이름·아이콘에 꺾쇠)
const SEED_OLD = () => {
  const olds = coworkDefaults().filter(t => ['cw_card', 'cw_tax', 'cw_photo', 'cw_bugtest', 'cw_month'].includes(t.id)).map(t => Object.assign({}, t));
  olds[0].prompt = '고친 카드 명령 {오늘}';
  state.coworkTasks = olds.concat([{ id: 'cw_mine1', icon: '<b', title: '통장 정리 <img src=x onerror=window.__cwx=1>', prompt: '내 명령 본문', builtin: false }]);
  state._coworkInit = true;
};
// 페이지 안에서 SEED_OLD 를 쓰는 함수 실행
const withSeed = fn => '(() => { const SEED_OLD = ' + SEED_OLD.toString() + '; return (' + fn.toString() + ')(); })()';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS claudecmds-v529 ' + name); }
  const { context, page } = await openPage(1280);

  await test('① 기본 명령 15개 · 분류·준비물 · 지킬 것 · 쓰던 목록엔 빠진 것만 (DEFAULTS)', async () => {
    const r = await page.evaluate(({ NEW_IDS, OLD_IDS }) => {
      const d = coworkDefaults(), ids = d.map(t => t.id);
      const by = id => d.find(t => t.id === id) || {};
      const cats = CW_CATS.map(c => c.id);
      return {
        n: d.length, uniq: new Set(ids).size, has: NEW_IDS.concat(OLD_IDS).every(id => ids.includes(id)), builtin: d.every(t => t.builtin === true && t.title && t.icon && t.prompt.length > 80),
        meta: d.every(t => CW_META[t.id] && cats.includes(CW_META[t.id].cat) && CW_META[t.id].prep), shape: d.every(t => Object.keys(t).sort().join() === 'builtin,icon,id,prompt,title'),
        safe: ['cw_photoin', 'cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_stmt'].every(id => /지우지 않는다/.test(by(id).prompt) && /_중복정리_보관_\{오늘\}/.test(by(id).prompt) && /_현장_백업_클로드_\{오늘\}/.test(by(id).prompt)),
        acct: /입금 계좌는 비워 둔다/.test(by('cw_stmt').prompt), pay: /\[입금\]/.test(by('cw_pay').prompt) && /로그인은 하지 않는다/.test(by('cw_pay').prompt) && /애매하면 기록하지 말고 묻는다/.test(by('cw_pay').prompt),
        dev: /병합은 하지 않는다/.test(by('cw_dev').prompt) && /공개 저장소/.test(by('cw_dev').prompt), kakao: /로그인은 하지 않는다/.test(by('cw_chatphoto').prompt) && /저장하지 않는다/.test(by('cw_chatphoto').prompt),
        noCowork: d.filter(t => NEW_IDS.includes(t.id)).every(t => !/Cowork/i.test(t.prompt + t.title)),
      };
    }, { NEW_IDS, OLD_IDS });
    assert.deepEqual(r, { n: 15, uniq: 15, has: true, builtin: true, meta: true, shape: true, safe: true, acct: true, pay: true, dev: true, kakao: true, noCowork: true }, 'DEFAULTS ' + JSON.stringify(r));
    const m = await page.evaluate(withSeed(() => {
      SEED_OLD();
      const t = coworkTasksEnsure();
      return { n: t.length, head: t.slice(0, 6).map(x => x.id), tail: t.slice(6).map(x => x.id), card: t[0].prompt, mine: t[5].title };
    }));
    assert.deepEqual(m.head, ['cw_card', 'cw_tax', 'cw_photo', 'cw_bugtest', 'cw_month', 'cw_mine1'], 'MERGE keeps the saved order ' + JSON.stringify(m));
    assert(m.n === 16 && m.tail.length === 10 && NEW_IDS.every(id => m.tail.includes(id)) && m.card === '고친 카드 명령 {오늘}' && /^통장 정리/.test(m.mine), 'MERGE appends only missing defaults ' + JSON.stringify(m));
  });

  await test('② 화면 — 더보기 이름·찾기 · 분류 순서 · 분류 안 순서 · 준비물 · 내 명령 · 글자로만 (UI)', async () => {
    const more = await page.evaluate(() => ({ label: (MORE_CATS.flatMap(c => c.items).find(i => i[0] === 'cowork') || [])[2], found: moreSearchItems('명령어').map(x => x.id), help: MORE_HELP.cowork }));
    assert(more.label === '클로드 명령어' && more.found.includes('cowork') && /명령어 모음/.test(more.help), 'UI More entry ' + JSON.stringify(more));
    await page.evaluate(withSeed(() => { SEED_OLD(); coworkTasksEnsure(); moreActionHandler('cowork'); }));
    await page.waitForSelector('#modalRoot .cw-cat');
    const ui = await page.evaluate(() => {
      const root = document.getElementById('modalRoot');
      return {
        title: (root.querySelector('#modalTitle') || {}).textContent || '',
        cats: [...root.querySelectorAll('.cw-cat')].map(c => c.dataset.cwCat), counts: [...root.querySelectorAll('.cw-cat')].map(c => c.querySelectorAll('.cw-row').length),
        photo: [...root.querySelectorAll('.cw-cat[data-cw-cat="photo"] .cw-row')].map(r => r.dataset.cwRow), money: [...root.querySelectorAll('.cw-cat[data-cw-cat="money"] .cw-row')].map(r => r.dataset.cwRow),
        prep: [...root.querySelectorAll('.cw-row')].filter(r => r.dataset.cwRow !== 'cw_mine1').every(r => /^준비: /.test(r.querySelector('.cw-prep').textContent)),
        mine: (root.querySelector('.cw-row[data-cw-row="cw_mine1"]') || {}).textContent || '', imgs: root.querySelectorAll('img').length, xss: window.__cwx === 1, how: (root.querySelector('#cwHow') || {}).textContent || '',
        btns: root.querySelectorAll('.cw-row .cwCopy').length,
      };
    });
    assert(/🧰 클로드 명령어 모음/.test(ui.title), 'UI title ' + ui.title);
    assert.deepEqual(ui.cats, ['photo', 'money', 'tax', 'app', 'mine'], 'UI category order');
    assert.deepEqual(ui.counts, [5, 4, 3, 3, 1], 'UI rows per category ' + JSON.stringify(ui.counts));
    assert.deepEqual(ui.photo, ['cw_photoin', 'cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_photo'], 'UI fixed order inside a category even though cw_photo is saved first');
    assert.deepEqual(ui.money, ['cw_stmt', 'cw_salescheck', 'cw_pay', 'cw_unbilled']);
    assert(ui.prep && ui.btns === 16 && /내 명령/.test(ui.mine) && /통장 정리 <img src=x/.test(ui.mine) && ui.imgs === 0 && !ui.xss, 'UI prep lines, my command badge, text only ' + JSON.stringify(ui));
    assert(/클로드 대화창/.test(ui.how) && /로그인은 직접/.test(ui.how) && !/Cowork/.test(ui.how), 'UI how-to ' + ui.how);
  });

  await test('③ 복사 — 스킬 줄 + 명령 · {오늘} → 오늘 · 저장된 명령은 그대로 · 전체 보기 (COPY)', async () => {
    const r = await page.evaluate(async () => {
      window.__copied = [];
      document.querySelector('#modalRoot .cw-row[data-cw-row="cw_dupe"] .cwCopy').click();
      await new Promise(r => setTimeout(r, 200));
      const d = new Date(), today = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      const saved = state.coworkTasks.find(t => t.id === 'cw_dupe').prompt;
      return { text: window.__copied[0] || '', today, toast: document.getElementById('toast').textContent, saved };
    });
    assert(r.text.startsWith('🧰 사용할 스킬: manmul-hyeonjang') && r.text.includes('_중복정리_보관_' + r.today) && r.text.includes('_현장_백업_클로드_' + r.today) && !r.text.includes('{오늘}'), 'COPY filled date ' + r.text.slice(0, 160));
    assert(/중복 사진·파일 정리 복사됨 — 클로드에 붙여넣으세요/.test(r.toast) && /\{오늘\}/.test(r.saved), 'COPY toast + stored prompt untouched ' + JSON.stringify({ toast: r.toast }));
    const v = await page.evaluate(async () => {
      coworkTaskView('cw_pay');
      await new Promise(r => setTimeout(r, 50));
      const root = document.getElementById('modalRoot');
      window.__copied = []; root.querySelector('#cwvCopy').click(); await new Promise(r => setTimeout(r, 200));
      return { prep: (root.querySelector('#cwvPrep') || {}).textContent || '', body: root.textContent, copied: window.__copied[0] || '' };
    });
    assert(/^준비: 명령의 \[입금\] 칸/.test(v.prep) && /\[입금\]/.test(v.copied) && /클로드 명령/.test(v.body) && !/Cowork 명령/.test(v.body), 'COPY detail view ' + JSON.stringify({ prep: v.prep }));
    await page.evaluate(() => closeModal());
  });

  await test('④ 찾기 — 이름·준비물 · 여러 낱말 · 없으면 안내 · 지우면 전부 (FILTER)', async () => {
    await page.evaluate(() => moreActionHandler('cowork'));
    await page.waitForSelector('#modalRoot #cwFilter');
    const look = q => page.evaluate(q => {
      const root = document.getElementById('modalRoot'), fi = root.querySelector('#cwFilter');
      fi.value = q; fi.dispatchEvent(new Event('input', { bubbles: true }));
      const vis = el => !!el && el.getClientRects().length > 0;
      return { rows: [...root.querySelectorAll('.cw-row')].filter(vis).map(r => r.dataset.cwRow), cats: [...root.querySelectorAll('.cw-cat')].filter(vis).map(c => c.dataset.cwCat), none: vis(root.querySelector('#cwNone')) };
    }, q);
    assert.deepEqual(await look('입금'), { rows: ['cw_pay'], cats: ['money'], none: false }, 'FILTER 입금');
    assert.deepEqual((await look('사진')).rows, ['cw_photoin', 'cw_chatphoto', 'cw_photoassign', 'cw_dupe', 'cw_photo'], 'FILTER 사진');
    assert.deepEqual((await look('카톡  사진')).rows, ['cw_photoin', 'cw_chatphoto'], 'FILTER every word');
    assert.deepEqual(await look('저장'), { rows: ['cw_save'], cats: ['app'], none: false }, 'FILTER 저장');
    assert.deepEqual(await look('없는말zzz'), { rows: [], cats: [], none: true }, 'FILTER nothing → hint');
    assert.equal((await look('')).rows.length, 16, 'FILTER cleared → all');
    await page.evaluate(() => closeModal());
  });

  await test('⑤ 스킬 명령문 카탈로그 · 도움말 · AI 도구 이름 (CATALOG)', async () => {
    const r = await page.evaluate(() => ({ cat: coworkSkillCatalogText(), label: (typeof aiToolLabel === 'function' ? aiToolLabel('cowork_tasks') : '') }));
    assert(/# 만물인테리어 — 클로드 스킬 명령문 카탈로그/.test(r.cat) && /카톡 대화로 누락 사진 찾아줘/.test(r.cat) && /manmul-as/.test(r.cat) && /manmul-contract/.test(r.cat) && /manmul-tax/.test(r.cat) && !/Cowork/.test(r.cat), 'CATALOG ' + r.cat.slice(0, 200));
    assert.match(SRC, /case 'cowork_tasks':return '클로드 명령어 모음';/);
    assert.match(SRC, /\{결과:'클로드 명령어 모음을 열었습니다'\}/);
    assert.match(SRC, /\{k:'클로드 명령어 모음',d:'더보기 \[🧰 클로드 명령어\]/);
  });

  await test('⑥ 폰 390 — 가로 넘침 없음 · 단추 44px · 찾기 칸 16px (PHONE)', async () => {
    const phone = await openPage(390);
    await phone.page.evaluate(withSeed(() => { SEED_OLD(); coworkTasksEnsure(); moreActionHandler('cowork'); }));
    await phone.page.waitForSelector('#modalRoot .cw-cat');
    const r = await phone.page.evaluate(() => {
      const root = document.getElementById('modalRoot'), modal = root.querySelector('.modal') || root;
      const small = [...root.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => [b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)]).filter(x => x[1] < 44);
      const fi = root.querySelector('#cwFilter');
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, modalOver: modal.scrollWidth - modal.clientWidth, small, font: parseFloat(getComputedStyle(fi).fontSize), fiH: Math.round(fi.getBoundingClientRect().height) };
    });
    assert(r.over <= 0 && r.modalOver <= 1 && r.small.length === 0 && r.font >= 16 && r.fiH >= 44, 'PHONE ' + JSON.stringify(r));
    await phone.context.close();
  });

  await test('⑦ 소스·핀 3곳(v529 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /\['cowork','🧰','클로드 명령어'\]/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 529, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`claudecmds-v529: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL claudecmds-v529', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
