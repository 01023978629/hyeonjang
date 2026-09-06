/* snapshot-policy.e2e.js — 안전판 12칸 정리 규칙: 강제 스냅샷은 '작업 중'에 밀려 나가지 않는다 (Playwright)

   2026-09-06 v261 (업그레이드 조사 [27]): 예전엔 오래된 순으로만 버려서 '작업 중'(3분마다) 36분이면
   '사진 3장 삭제 전'·'복구 직전' 같은 강제 스냅샷이 전부 사라졌다 — 모달은 '복구 후에도 되돌릴 수 있다' 고 약속하는데.
     ① 11개 '작업 중' + 가장 오래된 '사진 3장 삭제 전' 에 '작업 중' 을 더하면: 12개, 강제 항목 생존, 가장 오래된 '작업 중' 이 빠진다
     ② 강제 스냅샷만 12개일 때 '작업 중' 을 더하면: 방금 넣은 것은 남고 가장 오래된 강제 항목이 빠진다
     ③ 강제 13개째는 가장 오래된 강제 항목이 빠진다(총 12 유지) · 항목 모양(키 집합)은 그대로
     ④ 안전판 목록에서 강제 스냅샷 라벨은 굵게, '작업 중' 은 보통 굵기
     ⑤ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof hjSnapshot === 'function' && typeof hjSnapRoutine === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  const r = await page.evaluate(async () => {
    state.projects = [{ name: '검사현장', stage: 2, received: 0, phases: [], customer: {} }];
    const fake = (label, i) => ({ at: new Date(Date.now() - (100 - i) * 60000).toISOString(), label, np: 1, nf: 0, nq: 0, data: { projects: [], files: [] } });
    const labels = async () => ((await idbGet('hj_snaps')) || []).map(s => s.label);
    // ① 가장 오래된 강제 + '작업 중' 11개
    const seed1 = [fake('사진 3장 삭제 전', 0)].concat(Array.from({ length: 11 }, (_, i) => fake('작업 중', i + 1)));
    await idbSet('hj_snaps', seed1); __snapLastAt = 0;
    const ok1 = await hjSnapshot('작업 중', true, true);
    const after1 = await labels();
    // ② 강제만 12개 + '작업 중'
    const seed2 = Array.from({ length: 12 }, (_, i) => fake('강제 ' + i, i));
    await idbSet('hj_snaps', seed2); __snapLastAt = 0;
    const ok2 = await hjSnapshot('작업 중', true, true);
    const after2 = await labels();
    // ③ 강제 13개째
    await idbSet('hj_snaps', seed2); __snapLastAt = 0;
    const ok3 = await hjSnapshot('복구 직전', true, true);
    const raw3 = (await idbGet('hj_snaps')) || [];
    const after3 = raw3.map(s => s.label);
    const keys = [...new Set(raw3.map(s => Object.keys(s).sort().join(',')))];
    // ④ 목록 표시
    await idbSet('hj_snaps', [fake('작업 중', 0), fake('사진 3장 삭제 전', 1)]);
    await backupHistory();
    const spans = [...document.querySelectorAll('#modalRoot span')].filter(s => /작업 중|사진 3장 삭제 전/.test(s.textContent)).map(s => [s.textContent.trim(), getComputedStyle(s).fontWeight]);
    closeModal();
    await idbSet('hj_snaps', []);
    return { ok1, after1, ok2, after2, ok3, after3, keys, spans };
  });
  assert(r.ok1 && r.after1.length === 12 && r.after1[0] === '사진 3장 삭제 전' && r.after1.filter(l => l === '작업 중').length === 11, '① 강제 항목이 살고 가장 오래된 작업 중이 빠진다: ' + JSON.stringify(r.after1));
  assert(r.ok2 && r.after2.length === 12 && r.after2[11] === '작업 중' && r.after2[0] === '강제 1' && !r.after2.includes('강제 0'), '② 강제만 있을 때는 가장 오래된 강제가 빠지고 방금 것은 남는다: ' + JSON.stringify(r.after2));
  assert(r.ok3 && r.after3.length === 12 && r.after3[0] === '강제 1' && r.after3[11] === '복구 직전' && r.keys.length === 1 && r.keys[0] === 'at,data,label,nf,np,nq', '③ 강제 13개째·항목 모양 유지: ' + JSON.stringify([r.after3, r.keys]));
  const bold = r.spans.find(s => /사진 3장/.test(s[0])), plain = r.spans.find(s => /작업 중/.test(s[0]));
  assert(bold && plain && +bold[1] >= 700 && +plain[1] < 700, '④ 강제 라벨은 굵게, 작업 중은 보통: ' + JSON.stringify(r.spans));
  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));
  console.log('PASS  snapshot-policy: 강제 스냅샷 보존 · routine 우선 정리 · 방금 것 보존 · 모양 유지 · 목록 굵기');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });
