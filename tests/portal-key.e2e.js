/* portal-key.e2e.js — 고객 페이지·카카오 접수 서버 비밀키는 이 기기 IndexedDB 에만 산다 (Playwright)

   예전에는 이 키만 state.portalCfg.key 로 들어가 serializeData 를 타고 드라이브·서버 백업·안전판·
   [내보내기] 공유 파일(카톡·드라이브로 보내는 .json)에까지 실렸다. 이 키 하나면 /leads 로 고객 이름·전화·
   주소가 든 접수함을 통째로 읽는다. 다른 키(contract_token·kakao_key·relay_token·office_ops_token)는
   이미 IDB 에만 있었다 — AGENTS 🔴2 '키는 기기 IndexedDB 에만'.

   지키는 것
     ① 키를 저장하면 IDB('portal_key')에 들어가고, 상태·serializeData().portalCfg 에는 key 가 없다(주소는 남는다).
        입력칸은 password, 저장 뒤 칸은 비고 끝 4자리만 보인다. 서버로 보낼 때는 저장된 키를 쓴다.
     ② [내보내기] 공유 파일 내용에 키 문자열이 없다.
     ③ 빈 칸으로 [만들기] = 안 바꿈(key-persist 규칙).
     ④ 접수 가져오기(kakaoFetch2)가 메모리 키로 요청한다.
     ⑤ [지우기]는 확인을 거쳐야만 지운다(취소하면 그대로).
     ⑥ 옛 백업(key 포함) 가져오기: 상태에는 안 들어가고, 이 기기에 키가 없을 때만 IDB 로 옮긴다
        (있으면 옛 키로 덮지 않는다).
     ⑦ 새로고침 뒤에도 IDB 에서 읽어 쓴다(IDB 왕복).
     ⑧ 부팅 이전(보통 저장본): 이 기기 appState 에 key 가 남아 있으면 IDB 로 옮기고 상태에서 지우고 저장본을 다시 쓴다.
     ⑨ 부팅 이전(유상 generation): key 가 든 generation 도 복원이 멈추지 않는다(바이트 대조 round-trip) —
        키는 IDB 로, generation 은 key 없이 다시 쓰인다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const BASE = 'https://portal.test.invalid';
const KEY1 = 'PORTAL-KEY-TEST-SECRET-0001';
const KEY2 = 'PORTAL-KEY-OLD-BACKUP-0002';
const KEY3 = 'PORTAL-KEY-OLD-BACKUP-0003';
const KEY4 = 'PORTAL-KEY-LEGACY-APPSTATE-0004';
const KEY5 = 'PORTAL-KEY-PAID-GENERATION-0005';

let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String((e && e.message) || e)); }
}

async function newPage(requests) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(String(e)));
  await ctx.route('https://**/*', route => {
    const url = route.request().url();
    if (url.startsWith(BASE)) {
      requests.push({ url, body: route.request().postData() || '' });
      if (url.includes('/portal/save')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'tok-test', url: BASE + '/p/tok-test' }) });
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    }
    return route.abort();
  });
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  return { ctx, page };
}
async function boot(page, reload) {
  if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
  else await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__hjRestoreDone && !!window.__hjPortalKeyDone && typeof window.portalView === 'function');
  const r = await page.evaluate(async () => { const res = await window.__hjRestoreDone; await window.__hjPortalKeyDone; return res; });
  // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다(AGENTS 검사 함정)
  await page.evaluate(() => { try { taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; kakaoCheckNew = async () => 0; backupBootCheck = () => 0; } catch (e) {} });
  return r;
}
// 페이지 안에서 폴링 — IDB 왕복 뒤에 바뀌는 값
const pollIdb = (page, key, pred, label) => page.evaluate(async ({ key, pred, label }) => {
  const test = new Function('v', 'return (' + pred + ')(v)');
  let v;
  for (let i = 0; i < 60; i++) { v = await idbGet(key); if (test(v)) return v; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(label + ' — 마지막 값: ' + JSON.stringify(v).slice(0, 300));
}, { key, pred: String(pred), label });

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  /* ── A. 설정 화면·내보내기·가져오기 ─────────────────────────────── */
  const reqA = [];
  const { page } = await newPage(reqA);
  await boot(page);
  await page.evaluate(() => {
    state.projects.push({ name: '시험현장 101동 1001호', stage: 2 });
    render();
  });
  let dialogAnswer = true;
  page.on('dialog', d => (dialogAnswer ? d.accept() : d.dismiss()));

  const openPortal = async () => {
    await page.evaluate(() => { try { closeModal(); } catch (e) {} portalView('시험현장 101동 1001호'); });
    await page.waitForSelector('#modalRoot #ptKey', { state: 'attached' });
    await page.evaluate(() => document.querySelectorAll('#modalRoot details').forEach(d => { d.open = true; }));
  };
  const clickMake = async () => {
    const btn = page.locator('#modalRoot button', { hasText: /만들기|갱신/ }).first();
    await btn.click();
  };

  await step('① 저장하면 IDB 에만 — 상태·직렬화에는 key 없음, 입력칸은 password', async () => {
    await openPortal();
    const type = await page.getAttribute('#modalRoot #ptKey', 'type');
    assert(type === 'password', '입력칸이 password 가 아니다: ' + type);
    await page.fill('#modalRoot #ptBase', BASE);
    await page.fill('#modalRoot #ptKey', KEY1);
    await clickMake();
    await pollIdb(page, 'portal_key', `v=>v===${JSON.stringify(KEY1)}`, 'IDB portal_key 에 저장되지 않았다');
    const save = await (async () => { for (let i = 0; i < 50; i++) { const r = reqA.find(x => x.url.includes('/portal/save')); if (r) return r; await page.waitForTimeout(100); } return null; })();
    assert(save, '서버 저장 요청이 없다');
    assert(JSON.parse(save.body).key === KEY1, '서버로 보낸 키가 저장된 키가 아니다');
    const st = await page.evaluate(() => ({ cfg: state.portalCfg, ser: serializeData().portalCfg, all: JSON.stringify(serializeData()), mem: portalKeyGet() }));
    assert(st.mem === KEY1, '메모리 키가 없다');
    assert(!('key' in (st.cfg || {})), 'state.portalCfg 에 key 가 있다: ' + JSON.stringify(st.cfg));
    assert(st.ser && st.ser.base === BASE && !('key' in st.ser), 'serializeData().portalCfg 가 틀렸다: ' + JSON.stringify(st.ser));
    assert(!st.all.includes(KEY1), '직렬화 어딘가에 키 문자열이 있다');
    // 어느 경로로든 상태에 key 가 끼어들어도(옛 코드·외부 자료) 직렬화는 싣지 않는다 — 넘겨받은 원본(supplied)도 같다
    const leak = await page.evaluate(() => {
      const keep = state.portalCfg; state.portalCfg = { base: keep.base, key: 'PORTAL-KEY-STRAY-9999' };
      try { return { live: JSON.stringify(serializeData()), sup: JSON.stringify(serializeData({ ...serializeData(), portalCfg: { base: 'x', key: 'PORTAL-KEY-STRAY-9999' } })) }; }
      finally { state.portalCfg = keep; }
    });
    assert(!leak.live.includes('PORTAL-KEY-STRAY-9999') && !leak.sup.includes('PORTAL-KEY-STRAY-9999'), '상태에 끼어든 key 를 직렬화가 실었다');
    await page.waitForSelector('#modalRoot #ptKey', { state: 'attached' });
    const f = await page.evaluate(() => { const el = document.querySelector('#modalRoot #ptKey'); return { v: el.value, ph: el.placeholder, type: el.type }; });
    assert(f.v === '' && f.ph.includes('0001') && !f.ph.includes(KEY1) && f.type === 'password', '저장 뒤 입력칸: ' + JSON.stringify(f));
  });

  await step('② [내보내기] 공유 파일 내용에 키가 없다', async () => {
    const text = await page.evaluate(async () => {
      let shared = null;
      navigator.canShare = () => true;
      navigator.share = (d) => { shared = d.files[0]; return Promise.resolve(); };
      exportData();
      if (!shared) throw new Error('공유 파일이 만들어지지 않았다');
      return await shared.text();
    });
    assert(text.includes(BASE), '내보낸 파일에 서버 주소가 없다(파일 자체가 이상하다)');
    assert(!text.includes(KEY1), '내보낸 파일에 비밀키가 들어 있다');
  });

  await step('③ 빈 칸으로 [만들기] = 안 바꿈', async () => {
    reqA.length = 0;
    await openPortal();
    await page.fill('#modalRoot #ptKey', '');
    await clickMake();
    const save = await (async () => { for (let i = 0; i < 50; i++) { const r = reqA.find(x => x.url.includes('/portal/save')); if (r) return r; await page.waitForTimeout(100); } return null; })();
    assert(save && JSON.parse(save.body).key === KEY1, '빈 칸 저장 뒤 서버 요청 키: ' + (save && save.body));
    const v = await page.evaluate(async () => ({ idb: await idbGet('portal_key'), mem: portalKeyGet() }));
    assert(v.idb === KEY1 && v.mem === KEY1, '빈 칸 저장이 키를 바꿨다: ' + JSON.stringify(v));
  });

  await step('④ 접수 가져오기는 메모리 키로 요청한다', async () => {
    reqA.length = 0;
    await page.evaluate(() => kakaoFetch2());
    const r = reqA.find(x => x.url.includes('/leads'));
    assert(r && r.url.includes('key=' + encodeURIComponent(KEY1)), '/leads 요청 키: ' + (r && r.url));
  });

  await step('⑤ [지우기] — 취소하면 그대로, 확인하면 지운다', async () => {
    await openPortal();
    assert(await page.isVisible('#modalRoot #ptKeyDel'), '[지우기] 버튼이 안 보인다');
    dialogAnswer = false;
    await page.click('#modalRoot #ptKeyDel');
    await page.waitForTimeout(300);   // 부정 증명 — 취소 뒤 아무것도 안 바뀌어야 한다
    let v = await page.evaluate(async () => ({ idb: await idbGet('portal_key'), mem: portalKeyGet() }));
    assert(v.idb === KEY1 && v.mem === KEY1, '확인 취소인데 지웠다: ' + JSON.stringify(v));
    dialogAnswer = true;
    await page.click('#modalRoot #ptKeyDel');
    await pollIdb(page, 'portal_key', 'v=>!v', '확인 뒤에도 IDB 키가 남았다');
    v = await page.evaluate(async () => ({ mem: portalKeyGet(), hidden: document.querySelector('#modalRoot #ptKeyDel').hidden }));
    assert(v.mem === '' && v.hidden === true, '지운 뒤 상태: ' + JSON.stringify(v));
    reqA.length = 0;
    const r = await page.evaluate(() => portalPush('시험현장 101동 1001호'));
    assert(r === null && !reqA.length, '키가 없는데 서버로 보냈다');
  });

  await step('⑥ 옛 백업(key 포함) — 상태엔 안 넣고, 키 없는 기기에만 옮긴다', async () => {
    await page.evaluate(({ BASE, KEY2 }) => {
      const d = serializeData(); d.portalCfg = { base: BASE, key: KEY2 };
      applyData(d);
    }, { BASE, KEY2 });
    await pollIdb(page, 'portal_key', `v=>v===${JSON.stringify(KEY2)}`, '키 없는 기기인데 옛 백업 키를 옮기지 않았다');
    let st = await page.evaluate(() => ({ cfg: state.portalCfg, mem: portalKeyGet(), ser: JSON.stringify(serializeData()) }));
    assert(st.mem === KEY2 && st.cfg.base === BASE && !('key' in st.cfg), '가져온 뒤 상태: ' + JSON.stringify(st.cfg));
    assert(!st.ser.includes(KEY2), '가져온 뒤 직렬화에 키가 있다');
    // portalCfg 가 없는 자료면 지금 상태를 이어 쓰는데, 거기 key 가 끼어 있어도 떼어 낸다
    await page.evaluate(({ BASE, KEY2 }) => {
      state.portalCfg = { base: BASE, key: KEY2 };
      const d = serializeData(); delete d.portalCfg;
      applyData(d);
    }, { BASE, KEY2 });
    st = await page.evaluate(() => ({ cfg: state.portalCfg }));
    assert(st.cfg.base === BASE && !('key' in st.cfg), 'portalCfg 없는 자료 뒤 상태에 key 가 남았다: ' + JSON.stringify(st.cfg));
    // 이미 키가 있는 기기 — 옛 백업의 다른 키로 덮지 않는다
    await page.evaluate(({ BASE, KEY3 }) => {
      const d = serializeData(); d.portalCfg = { base: BASE, key: KEY3 };
      applyData(d);
    }, { BASE, KEY3 });
    await page.waitForTimeout(400);   // 부정 증명 — 덮이지 않아야 한다
    st = await page.evaluate(async () => ({ idb: await idbGet('portal_key'), mem: portalKeyGet(), cfg: state.portalCfg }));
    assert(st.idb === KEY2 && st.mem === KEY2 && !('key' in st.cfg), '있는 키를 옛 백업 키로 덮었다: ' + JSON.stringify(st));
  });

  await step('⑦ 새로고침 뒤에도 IDB 에서 읽어 쓴다', async () => {
    await page.evaluate(async () => { clearTimeout(__idbSaveTimer); await guardedPersistCurrentState(); });
    reqA.length = 0;
    await boot(page, true);
    const mem = await page.evaluate(() => portalKeyGet());
    assert(mem === KEY2, '새로고침 뒤 메모리 키: ' + mem);
    await page.evaluate(() => kakaoFetch2());
    const r = reqA.find(x => x.url.includes('/leads'));
    assert(r && r.url.includes('key=' + encodeURIComponent(KEY2)), '새로고침 뒤 /leads 요청 키: ' + (r && r.url));
  });
  assert(!page.__errors.length, 'pageerror: ' + page.__errors.join(' | '));

  /* ── B. 부팅 이전 — 보통 저장본(appState)에 key 가 남아 있던 기기 ────────── */
  await step('⑧ 부팅 이전(appState): IDB 로 옮기고 상태에서 지우고 저장본을 다시 쓴다', async () => {
    const reqB = [];
    const { page: pb, ctx } = await newPage(reqB);
    await boot(pb);
    await pb.evaluate(async ({ BASE, KEY4 }) => {
      state.projects.push({ name: '이전현장', stage: 1 });
      clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw new Error('fixture persist failed');
      await __appStateWriteQueue;
      __tabStale = true;   // 이 탭이 더 쓰지 않게(아래에서 직접 쓴 옛 저장본을 덮지 않게)
      const data = await idbGet('appState');
      data.portalCfg = { base: BASE, key: KEY4 };
      await new Promise((res, rej) => { const o = indexedDB.open('hyeonjang-db', 1); o.onsuccess = () => { const tx = o.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(data, 'appState'); tx.oncomplete = () => { o.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; o.onerror = () => rej(o.error); });
      if (await idbGet('portal_key')) throw new Error('시작 전 portal_key 가 이미 있다');
    }, { BASE, KEY4 });
    const r = await boot(pb, true);
    assert(r && r.ok === true, '복원 실패: ' + JSON.stringify(r));
    await pollIdb(pb, 'portal_key', `v=>v===${JSON.stringify(KEY4)}`, '부팅 때 옛 키를 IDB 로 옮기지 않았다');
    const st = await pb.evaluate(() => ({ cfg: state.portalCfg, mem: portalKeyGet(), n: state.projects.length }));
    assert(st.mem === KEY4 && st.cfg.base === BASE && !('key' in st.cfg) && st.n >= 1, '부팅 뒤 상태: ' + JSON.stringify(st));
    await pollIdb(pb, 'appState', `v=>!!v&&!JSON.stringify(v).includes(${JSON.stringify(KEY4)})&&v.portalCfg&&v.portalCfg.base===${JSON.stringify(BASE)}`, '저장본(appState)에 옛 키가 남아 있다');
    assert(!pb.__errors.length, 'pageerror: ' + pb.__errors.join(' | '));
    await ctx.close();
  });

  /* ── C. 부팅 이전 — 유상 generation 에 key 가 든 기기 ─────────────────── */
  await step('⑨ 부팅 이전(유상 generation): 복원이 멈추지 않고 generation 도 key 없이 다시 쓰인다', async () => {
    const reqC = [];
    const { page: pc, ctx } = await newPage(reqC);
    await boot(pc);
    await pc.evaluate(async ({ BASE, KEY5 }) => {
      state.projects.push({ name: '유상현장', stage: 1 });
      clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw new Error('fixture persist failed');
      await __appStateWriteQueue;
      // 옛 버전이 쓴 generation 을 흉내 낸다 — 초안에 key 를 넣어 커밋한다.
      // 지금 코드는 적용 뒤 재직렬화에서 key 를 빼므로 이 탭은 '정확일치 실패'로 멈추지만, 기록은 이미 IDB 에 있다.
      try { await durableLocalMutation({ snapshotLabel: '시험', mutateDraft: d => { d.portalCfg = { base: BASE, key: KEY5 }; return 1; } }); } catch (e) {}
      __tabStale = true;
      const ptr = await idbGet('paid_commit_pointer');
      if (!ptr) throw new Error('유상 generation 이 만들어지지 않았다');
      const gen = await idbGet(ptr);
      if (!gen || !gen.portalCfg || gen.portalCfg.key !== KEY5) throw new Error('generation 에 key 가 없다(시드 실패)');
      if (await idbGet('portal_key')) throw new Error('시작 전 portal_key 가 이미 있다');
    }, { BASE, KEY5 });
    const r = await boot(pc, true);
    const src = await pc.evaluate(() => window.__hjRestoreSource);
    assert(r && r.ok === true && src === 'paid-generation', '유상 generation 복원 실패: ' + JSON.stringify(r) + ' source=' + src);
    await pollIdb(pc, 'portal_key', `v=>v===${JSON.stringify(KEY5)}`, '부팅 때 generation 의 키를 IDB 로 옮기지 않았다');
    const st = await pc.evaluate(() => ({ cfg: state.portalCfg, n: state.projects.filter(p => p.name === '유상현장').length, stale: __tabStale }));
    assert(st.n === 1 && !('key' in st.cfg) && st.cfg.base === BASE && st.stale === false, '부팅 뒤 상태: ' + JSON.stringify(st));
    await pc.evaluate(async (KEY5) => {
      for (let i = 0; i < 60; i++) {
        const ptr = await idbGet('paid_commit_pointer'), gen = ptr ? await idbGet(ptr) : null, app = await idbGet('appState');
        if (gen && app && !JSON.stringify(gen).includes(KEY5) && !JSON.stringify(app).includes(KEY5)) return;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('generation/appState 에 옛 키가 남아 있다');
    }, KEY5);
    assert(!pc.__errors.length, 'pageerror: ' + pc.__errors.join(' | '));
    await ctx.close();
  });

  await browser.close();
  if (failed) { console.log('\n' + failed + '건 실패'); process.exit(1); }
  console.log('\n전부 통과 (9건)');
})().catch(async e => { console.log('FAIL  ' + String((e && e.stack) || e)); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });
