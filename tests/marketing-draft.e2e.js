/* marketing-draft.e2e.js — ✍️ 홍보 원고 생성기 회귀 테스트 (Playwright)
   대상: 완공 우선 정렬/완공 배지/__adDoneOnly 토글(증분1) + 저장 후기 → PII-free 별점 신호 adReviewSignal(증분2 재설계).
   핵심 불변식: "어떤 satisfaction.comment 원문도 공개 초안에 절대 나오지 않는다"(구조적 안전 — comment는 읽지도 않음).
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

// 공개 초안에 절대 새어나가면 안 되는 PII 원문(후기 comment·고객명·전화·동호수)
const RAW_NAME = '홍길동';
const RAW_PHONE = '010-1234-5678';
const RAW_PHONE_DIGITS = '1012345678';
// 후기 comment 안에 심는 극도로 독특한 문자열 — 초안 어디에도 이 조각이 나오면 원문 경로 잔존을 의미
const UNIQUE_COMMENT = 'ZZTESTUNIQUE박준호010-1234-5678302동';
const UNIQUE_NAME = '박준호';
const UNIQUE_DONG = '302동';

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

  // 완공현장(둔산동 32평, 별점5·독특 comment) + 무후기 완공현장 + 미완공현장 시드
  async function seed() {
    await page.evaluate(({ nm, uc }) => {
      state.notes = [];
      state.files = [];
      state.adPosts = [];
      state.projects = [
        { name: '둔산동리모델링', stage: 3, phases: ['욕실', '주방'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: nm, phone: '01099998888', addr: '대전 서구 둔산동 32평아파트' }, doneAt: '2026-07-01', archived: false },
        { name: '노은동주방', stage: 3, phases: ['주방'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '무후기', phone: '', addr: '대전 유성구 노은동 24평' }, doneAt: '2026-07-10', archived: false },
        { name: '진행현장', stage: 1, phases: ['도배'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이진행', phone: '', addr: '대전 중구 태평동 18평' }, archived: false }
      ];
      // 별점5 + comment에 PII 지뢰(실명·전화·동호수)를 잔뜩 심음 — 구조적으로 comment는 읽히지 않아야 함
      state.satisfaction = [
        { id: 'r1', project: '둔산동리모델링', customer: nm, stars: 5, comment: uc + ' 사장님이 꼼꼼하게 시공해주셔서 만족합니다', at: '2026-07-05T00:00:00.000Z' }
      ];
      state.activeProject = null; state.tab = 'ads'; render();
    }, { nm: RAW_NAME, uc: UNIQUE_COMMENT });
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

  // 2) 새 최상위 키 금지 + project 오염 금지(_review/_signal 등)
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
    assert(!/adDoneOnly|_review|_signal|_done|reviewQuote|_adReview|_draft/i.test(r.projJson), 'project 객체에 파생값 오염됨: ' + r.projJson.slice(0, 200));
    await clearModal();
  });

  // 3) 읽기전용 — adProjFacts·adReviewSignal·adDraftText 호출 전후 satisfaction/projects deepEqual
  await test('읽기전용: 파생 헬퍼 호출 전후 satisfaction·projects 불변', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = JSON.stringify({ sat: state.satisfaction, proj: state.projects });
      adProjFacts('둔산동리모델링');
      adReviewSignal('둔산동리모델링');
      adReviewSignal('진행현장');
      adDraftText('blog', adProjFacts('둔산동리모델링'));
      const after = JSON.stringify({ sat: state.satisfaction, proj: state.projects });
      return { same: snap === after };
    });
    assert(r.same, '파생 호출이 원본 state를 변경하면 안 됨');
  });

  // 4) 핵심 불변식 — 후기 comment 원문(독특 문자열·실명·전화·동호수)이 어떤 채널 초안에도 절대 없음.
  //    동시에 PII-free 별점 신호 줄(★·만족도)은 나온다(기능 동작). 구조적 안전: comment는 읽히지 않음.
  await test('★핵심: comment 원문(독특문자열/실명/전화/동호수) 전 채널 부재 + 별점 신호 노출', async () => {
    await seed();
    for (const ch of ['blog', 'threads', 'instagram']) {
      await openDraft(ch, '둔산동리모델링');
      const txt = await draftText();
      // (1) comment 원문 경로 완전 부재 — 어떤 조각도 초안에 없어야 함
      assert(txt.indexOf(UNIQUE_COMMENT) < 0, ch + ' 초안에 독특 comment 원문 잔존: ' + UNIQUE_COMMENT);
      assert(txt.indexOf(UNIQUE_NAME) < 0, ch + ' 초안에 comment 속 실명(박준호) 잔존');
      assert(txt.indexOf(RAW_PHONE_DIGITS) < 0, ch + ' 초안에 comment 속 전화 숫자열 잔존');
      assert(txt.indexOf(RAW_PHONE) < 0, ch + ' 초안에 comment 속 전화 원문 잔존');
      assert(txt.indexOf(UNIQUE_DONG) < 0, ch + ' 초안에 comment 속 동호수(302동) 잔존');
      assert(txt.indexOf(RAW_NAME) < 0, ch + ' 초안에 등록 고객 실명 잔존');
      // (2) 별점 신호 줄은 노출(기능 동작) — 별점5 → avg 5.0 → ★·만족도 노출
      assert(/★/.test(txt), ch + ' 초안에 별점 신호(★) 미노출');
      assert(/만족도/.test(txt), ch + ' 초안에 별점 신호(만족도) 미노출');
      assert(/★5(\.0)?/.test(txt), ch + ' 초안에 평균 별점 5.0 미노출');
      // (3) 지역·평형은 여전히 노출
      assert(/둔산동|서구/.test(txt), ch + ' 초안에 지역 미노출');
      assert(/32평/.test(txt), ch + ' 초안에 평형 미노출');
      await clearModal();
    }
  });

  // 5) adReviewSignal 순수성 — comment는 읽지도 반환하지도 않고 {avg,count}만
  await test('adReviewSignal: comment 미참조, {avg,count}만 반환 + 평균 계산 정확', async () => {
    await page.evaluate(() => {
      state.satisfaction = [
        { id: 'a', project: '둔산동리모델링', customer: '', stars: 5, comment: 'SECRET_A박준호', at: '2026-07-02T00:00:00Z' },
        { id: 'b', project: '둔산동리모델링', customer: '', stars: 4, comment: 'SECRET_B010-1234-5678', at: '2026-07-03T00:00:00Z' }
      ];
    });
    const r = await page.evaluate(() => adReviewSignal('둔산동리모델링'));
    const json = JSON.stringify(r);
    assert(r && r.count === 2, 'count 2건이어야 함: ' + json);
    assert(r.avg === 4.5, '평균 (5+4)/2=4.5: ' + json);
    assert(Object.keys(r).sort().join(',') === 'avg,count', '반환 키는 avg,count 뿐: ' + Object.keys(r).join(','));
    assert(json.indexOf('SECRET') < 0 && json.indexOf('박준호') < 0, '반환값에 comment 원문 잔존: ' + json);
  });

  // 6) avg<4.0 → 별점 신호 줄 생략(품질 게이트)
  await test('avg<4.0: 별점 신호 줄 생략, [대괄호] 폴백 유지', async () => {
    await page.evaluate(() => {
      state.satisfaction = [
        { id: 'a', project: '둔산동리모델링', customer: '', stars: 3, comment: 'x', at: '2026-07-02T00:00:00Z' },
        { id: 'b', project: '둔산동리모델링', customer: '', stars: 4, comment: 'y', at: '2026-07-03T00:00:00Z' }
      ];   // 평균 3.5 < 4.0
    });
    const r = await page.evaluate(() => {
      const sig = adReviewSignal('둔산동리모델링');
      const d = adDraftText('blog', adProjFacts('둔산동리모델링'));
      return { sig, body: d.body };
    });
    assert(r.sig && r.sig.avg === 3.5, 'signal avg 3.5: ' + JSON.stringify(r.sig));
    assert(!/★/.test(r.body) && !/만족도/.test(r.body), 'avg<4 → 별점 신호 줄 생략되어야 함');
    assert(/\[품질·하자 관련 디테일/.test(r.body), 'avg<4 → 기존 [대괄호] 폴백 유지');
  });

  // 7) 별점 없는/무후기 현장 — 크래시 없이 null, [대괄호] 유지
  await test('별점 결측: 무후기·별점0 현장 크래시 없음, signal null, [대괄호] 유지', async () => {
    await seed();
    const r = await page.evaluate(() => {
      // 별점이 없거나 0인 후기(comment만 있음)도 집계 제외 → null
      state.satisfaction = [{ id: 'z', project: '노은동주방', customer: '', stars: 0, comment: '별점없는후기SECRET', at: '2026-07-11T00:00:00Z' }];
      const noneSig = adReviewSignal('노은동주방');      // stars 0 → 제외 → null
      const missSig = adReviewSignal('없는현장이름');     // 후기 자체 없음 → null
      const d = adDraftText('blog', adProjFacts('노은동주방'));
      return { noneSig, missSig, body: d.body };
    });
    assert(r.noneSig === null, '별점0뿐인 현장 signal은 null');
    assert(r.missSig === null, '후기 없는 현장 signal은 null');
    assert(!/★/.test(r.body) && !/만족도/.test(r.body), '별점 결측 → 신호 줄 생략');
    assert(/\[품질·하자 관련 디테일/.test(r.body), '별점 결측 → 기존 [대괄호] 유지');
    assert(r.body.indexOf('SECRET') < 0, '별점 결측이어도 comment 원문 미노출');
  });

  // 8) 완공 필터 — 첫 선택=최근 doneAt, 배지는 완공에만, __adDoneOnly=true면 미완공 숨김
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
    await page.click('#adDoneOnly'); await page.waitForTimeout(100);
    const filtered = await page.evaluate(() => ({
      vals: [...document.querySelectorAll('#adDraftProj option')].map(o => o.value),
      mem: document.getElementById('adDoneOnly').checked
    }));
    assert(filtered.mem === true, '완공만 보기 토글 켜짐(__adDoneOnly=true)');
    assert(filtered.vals.indexOf('진행현장') < 0, '완공만 보기에서 미완공(진행현장) 숨김');
    assert(filtered.vals.indexOf('둔산동리모델링') >= 0, '완공 현장은 유지');
    await clearModal();
  });

  // 9) 적대적 comment — comment에 무엇을 심든(전화/주소/실명/전각) 초안 전 채널에 원문 조각 0.
  //    별점만 신호로 나온다(구조적 안전: comment는 코드 경로상 읽히지 않음).
  await test('적대적 comment 전량: 전화/주소/실명/전각 심어도 전 채널 원문 0, 별점 신호만', async () => {
    await seed();
    const genAll = async (proj) => page.evaluate((p) => {
      const f = adProjFacts(p);
      const mk = (c) => { const d = adDraftText(c, f); return d.title + '\n' + d.body; };
      return { signal: adReviewSignal(p), blog: mk('blog'), threads: mk('threads'), insta: mk('instagram') };
    }, proj);
    const setSat = async (proj, comment) => page.evaluate(({ p, c }) => {
      state.satisfaction = [{ id: 'x', project: p, customer: '', stars: 5, comment: c, at: '2026-07-05T00:00:00Z' }];
    }, { p: proj, c: comment });

    const HOSTILE = [
      ['전화 하이픈', 'MARK1 010-1234-5678 좋아요'],
      ['전화 연속', 'MARK2 01012345678 문의'],
      ['전화 전각', 'MARK3 ０１０－１２３４－５６７８ 연락'],
      ['미등록 실명', 'MARK4 박영수님 정말 최고예요'],
      ['동호수', 'MARK5 302동 1503호 만족'],
      ['도로명', 'MARK6 둔산로 123 감사합니다'],
      ['지번', 'MARK7 둔산동 123-4 시공감사'],
    ];
    for (const [label, comment] of HOSTILE) {
      await setSat('둔산동리모델링', comment);
      const g = await genAll('둔산동리모델링');
      const all = g.blog + '\n' + g.threads + '\n' + g.insta;
      // comment 표식(MARKn)과 심어둔 PII 조각이 전 채널에 절대 없음
      const mark = comment.split(' ')[0];
      assert(all.indexOf(mark) < 0, label + ': comment 표식(' + mark + ') 전 채널 잔존');
      assert(all.indexOf('박영수') < 0, label + ': comment 속 실명 잔존');
      assert(all.indexOf('둔산로') < 0 || label !== '도로명', label + ': comment 속 도로명 잔존');
      assert(!/302\s*동\s*1503\s*호/.test(all), label + ': comment 속 동호수 잔존');
      // 그러나 별점 신호(★5.0)는 정상 노출 — 기능 동작
      assert(g.signal && g.signal.avg === 5, label + ': 별점 signal 정상 계산');
      assert(/★/.test(all) && /만족도/.test(all), label + ': 별점 신호 줄 노출되어야 함');
    }
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
