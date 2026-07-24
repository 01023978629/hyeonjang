/* marketing-draft.e2e.js — ✍️ 홍보 원고 생성기 자동발행 확장 회귀 테스트 (Playwright)
   대상: 완공 우선 정렬/완공 배지/__adDoneOnly 토글(증분1) + 저장 후기 자동 인용 adReviewQuote(증분2).
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   불변 규칙 검증: serializeData 왕복 바이트 불변, 새 최상위 키/새 project 필드 0, 원본 데이터 불변, PII 미노출. */
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

// 공개 초안에 절대 새어나가면 안 되는 PII 원문(후기·고객명·전화)
const RAW_NAME = '홍길동';
const RAW_PHONE = '010-1234-5678';
const RAW_PHONE_DIGITS = '1012345678';

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const clearModal = async () => page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });

  // 후기 있는 완공현장(둔산동 32평) + 무후기 완공현장 + 미완공현장 시드
  async function seed() {
    await page.evaluate(({ nm, ph }) => {
      state.notes = [];
      state.files = [];
      state.adPosts = [];
      state.projects = [
        { name: '둔산동리모델링', stage: 3, phases: ['욕실', '주방'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: nm, phone: '01099998888', addr: '대전 서구 둔산동 32평아파트' }, doneAt: '2026-07-01', archived: false },
        { name: '노은동주방', stage: 3, phases: ['주방'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '무후기', phone: '', addr: '대전 유성구 노은동 24평' }, doneAt: '2026-07-10', archived: false },
        { name: '진행현장', stage: 1, phases: ['도배'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이진행', phone: '', addr: '대전 중구 태평동 18평' }, archived: false }
      ];
      state.satisfaction = [
        { id: 'r1', project: '둔산동리모델링', customer: nm, stars: 5, comment: nm + ' ' + ph + ' 감사합니다', at: '2026-07-05T00:00:00.000Z' }
      ];
      state.activeProject = null; state.tab = 'ads'; render();
    }, { nm: RAW_NAME, ph: RAW_PHONE });
  }

  // __adDoneOnly는 모듈 스코프 let(메모리 전용) — evaluate로 직접 못 건드리므로 UI(체크박스)로만 리셋/조작
  const openDraft = async (ch, projName) => {
    await clearModal();
    await page.evaluate((c) => { adDraftOpen(c); }, ch || 'blog');
    await page.waitForTimeout(120);
    const checked = await page.evaluate(() => { const c = document.getElementById('adDoneOnly'); return !!(c && c.checked); });
    if (checked) { await page.click('#adDoneOnly'); await page.waitForTimeout(60); }   // 이전 테스트 잔여 필터 리셋
    if (projName) { await page.evaluate((n) => { const s = document.getElementById('adDraftProj'); s.value = n; s.onchange(); }, projName); await page.waitForTimeout(60); }
  };
  const draftText = async () => page.evaluate(() => {
    const t = document.getElementById('adDraftTitle'); const b = document.getElementById('adDraftTa');
    return (t ? t.value : '') + '\n\n' + (b ? b.value : '');
  });

  // 1) 직렬화 왕복 불변 — 열기·채널전환·__adDoneOnly 토글 후 serializeData 바이트 동일
  await test('직렬화 왕복 바이트 불변(채널전환·완공만보기 토글 후)', async () => {
    await seed();
    // savedAt(호출마다 갱신)·aiOps(별개 자율 스케줄러가 타이머로 자체 초기화)는 이 기능과 무관한 앱 휘발 필드 —
    // 정규화 후 나머지 전 키(projects·satisfaction·adPosts 등)가 바이트 동일한지로 '내 변경분 미영속' 검증
    const ser = () => page.evaluate(() => { const s = serializeData(); s.savedAt = ''; s.aiOps = null; return JSON.stringify(s); });
    const before = await ser();
    await openDraft('blog');
    await page.click('[data-draftch="threads"]'); await page.waitForTimeout(80);
    await page.click('[data-draftch="instagram"]'); await page.waitForTimeout(80);
    await page.click('#adDoneOnly'); await page.waitForTimeout(80);   // __adDoneOnly=true
    await page.click('#adDoneOnly'); await page.waitForTimeout(80);   // 다시 false
    await page.click('[data-draftch="blog"]'); await page.waitForTimeout(80);
    const after = await ser();
    assert(before === after, 'serializeData 출력이 열기 전과 바이트 동일해야 함');
    await clearModal();
  });

  // 2) 새 최상위 키 금지 + project 오염 금지(_review/_done 등)
  await test('새 최상위 직렬화 키 없음 + project 파생값 오염 없음', async () => {
    await seed(); await openDraft('blog');
    await page.click('[data-draftch="threads"]'); await page.waitForTimeout(80);
    await page.click('#adDoneOnly'); await page.waitForTimeout(80);
    const r = await page.evaluate(() => {
      const s = serializeData();
      const topKeys = Object.keys(s);
      const projJson = JSON.stringify(s.projects || []);
      return { topKeys, projJson };
    });
    const allowed = new Set(['version','app','savedAt','learn','quotes','schedule','notes','priceBook','asLog','satisfaction','adPosts','portalCfg','_savedFileCount','kakaoLastAt','coworkTasks','coworkSched','_cwSchedInit','_coworkInit','payLog','expenses','goals','aiOps','suppliers','supplierMap','inventory','brand','contacts','projects','files']);
    const extra = r.topKeys.filter(k => !allowed.has(k));
    assert(extra.length === 0, '허용되지 않은 최상위 키: ' + extra.join(','));
    assert(!/adDoneOnly|_review|_done|reviewQuote|_adReview|_draft/i.test(r.projJson), 'project 객체에 파생값(_review/_done 등) 오염됨: ' + r.projJson.slice(0, 200));
    await clearModal();
  });

  // 3) 읽기전용 — adProjFacts·adReviewQuote·완공정렬 호출 전후 state(satisfaction/projects) deepEqual
  await test('읽기전용: 파생 헬퍼 호출 전후 satisfaction·projects 불변', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = JSON.stringify({ sat: state.satisfaction, proj: state.projects });
      adProjFacts('둔산동리모델링');
      adReviewQuote('둔산동리모델링');
      adReviewQuote('진행현장');
      adDraftText('blog', adProjFacts('둔산동리모델링'));
      const after = JSON.stringify({ sat: state.satisfaction, proj: state.projects });
      return { same: snap === after };
    });
    assert(r.same, '파생 호출이 원본 state를 변경하면 안 됨');
  });

  // 4) PII 미노출(핵심) — 실명·전화·숫자열 배제, 지역/평형만 노출
  await test('PII 미노출: blog·threads 초안에 실명/전화/숫자열 없음, 지역·평형만', async () => {
    await seed();
    for (const ch of ['blog', 'threads']) {
      await openDraft(ch, '둔산동리모델링');   // 후기 있는 완공현장 명시 선택
      const txt = await draftText();
      assert(txt.indexOf(RAW_NAME) < 0, ch + ' 초안에 고객 실명 노출: ' + RAW_NAME);
      assert(txt.indexOf(RAW_PHONE) < 0, ch + ' 초안에 전화 원문 노출: ' + RAW_PHONE);
      assert(txt.indexOf(RAW_PHONE_DIGITS) < 0, ch + ' 초안에 전화 숫자열 노출: ' + RAW_PHONE_DIGITS);
      assert(/둔산동|서구/.test(txt), ch + ' 초안에 지역 미노출');
      assert(/32평/.test(txt), ch + ' 초안에 평형 미노출');
      assert(/고객님/.test(txt), ch + ' 초안에 스크럽된 후기(고객님) 인용 확인');
      await clearModal();
    }
  });

  // 5) 완공 필터 — 첫 선택=최근 doneAt, 배지는 완공에만, __adDoneOnly=true면 미완공 숨김
  await test('완공 우선: 첫 선택=최근 완공, ✅완공 배지 완공에만, 토글 시 미완공 숨김', async () => {
    await seed(); await openDraft('blog');
    const info = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('#adDraftProj option')].map(o => ({ v: o.value, t: o.textContent, sel: o.selected }));
      return { opts, selVal: document.getElementById('adDraftProj').value };
    });
    assert(info.selVal === '노은동주방', '첫 선택이 최근 완공(2026-07-10 노은동주방)이어야 함: ' + info.selVal);
    const doneOpt = info.opts.find(o => o.v === '둔산동리모델링');
    const doneOpt2 = info.opts.find(o => o.v === '노은동주방');
    const undoneOpt = info.opts.find(o => o.v === '진행현장');
    assert(/✅ 완공/.test(doneOpt.t) && /✅ 완공/.test(doneOpt2.t), '완공 현장 옵션에 ✅완공 배지');
    assert(!/✅/.test(undoneOpt.t), '미완공 현장 옵션엔 배지 없어야 함: ' + undoneOpt.t);
    // __adDoneOnly 토글
    await page.click('#adDoneOnly'); await page.waitForTimeout(100);
    const filtered = await page.evaluate(() => ({
      vals: [...document.querySelectorAll('#adDraftProj option')].map(o => o.value),
      mem: document.getElementById('adDoneOnly').checked   // 체크박스가 __adDoneOnly(메모리 let) 반영
    }));
    assert(filtered.mem === true, '완공만 보기 토글 켜짐(__adDoneOnly=true)');
    assert(filtered.vals.indexOf('진행현장') < 0, '완공만 보기에서 미완공(진행현장) 숨김');
    assert(filtered.vals.indexOf('둔산동리모델링') >= 0, '완공 현장은 유지');
    await clearModal();
  });

  // 6) 후기 결측 폴백 — satisfaction 없는 현장 → 크래시 없이 기존 [대괄호] 유지
  await test('후기 결측 폴백: 무후기 완공현장은 [대괄호] 유지, 크래시 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const q = adReviewQuote('노은동주방');
      const d = adDraftText('blog', adProjFacts('노은동주방'));
      return { q, body: d.body };
    });
    assert(r.q === null, '무후기 현장 adReviewQuote는 null');
    assert(/\[품질·하자 관련 디테일/.test(r.body), '무후기 → 기존 [대괄호] 유지');
    assert(!/실제 고객 후기/.test(r.body), '무후기 → 인용문 미삽입');
  });

  // 7) 다중 후기 — 같은 현장 별점 3·5·4 → 최댓값(5)만 인용
  await test('다중 후기: 별점 3·5·4 중 최댓값(5) 후기만 인용', async () => {
    await page.evaluate(() => {
      state.satisfaction = [
        { id: 'a', project: '둔산동리모델링', customer: '', stars: 3, comment: '삼점후기내용', at: '2026-07-02T00:00:00Z' },
        { id: 'b', project: '둔산동리모델링', customer: '', stars: 5, comment: '오점후기내용', at: '2026-07-03T00:00:00Z' },
        { id: 'c', project: '둔산동리모델링', customer: '', stars: 4, comment: '사점후기내용', at: '2026-07-04T00:00:00Z' }
      ];
    });
    const r = await page.evaluate(() => adReviewQuote('둔산동리모델링'));
    assert(r && r.stars === 5, '최댓값 별점 5 선택: ' + JSON.stringify(r));
    assert(r.text === '오점후기내용', '5점 후기 텍스트만 인용: ' + r.text);
    const d = await page.evaluate(() => adDraftText('blog', adProjFacts('둔산동리모델링')).body);
    assert(d.indexOf('오점후기내용') >= 0, '초안에 5점 후기 인용');
    assert(d.indexOf('삼점후기내용') < 0 && d.indexOf('사점후기내용') < 0, '나머지 후기는 미인용');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();
