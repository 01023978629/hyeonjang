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
      // 등록 실명만 든 후기(전화·주소 없음) — 화이트리스트로 nm→"고객님" 치환 후 정상 인용됨
      state.satisfaction = [
        { id: 'r1', project: '둔산동리모델링', customer: nm, stars: 5, comment: nm + ' 사장님이 꼼꼼하게 시공해주셔서 만족합니다', at: '2026-07-05T00:00:00.000Z' }
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

  // 8) 적대적 PII 스크럽(fail-closed) — 전화 5형식+비표준+전각·존칭결합·공백변형·이름만·
  //    자유입력 현장·주소(동호수/도로명/지번). 위험 후기는 인용 자체가 제외되어 [대괄호] 유지.
  //    등록 실명 변형은 "고객님"으로 치환되어 인용, 깨끗한 후기 1건은 정상 인용(회귀 방지).
  await test('적대적 PII: 전화/주소/실명 위험 후기 전량 인용 제외 + 등록실명 치환 + 깨끗후기 인용', async () => {
    await seed();
    const COMP = await page.evaluate(() => ({ tel: COMPANY.tel, digits: COMPANY.tel.replace(/\D/g, '') }));
    // 대상 현장 초안(blog/threads/instagram) 전체 + adReviewQuote 결과를 한 번에 뽑는 파생 헬퍼
    const genAll = async (proj) => page.evaluate((p) => {
      const f = adProjFacts(p);
      const mk = (c) => { const d = adDraftText(c, f); return d.title + '\n' + d.body; };
      return { quote: adReviewQuote(p), blog: mk('blog'), threads: mk('threads'), insta: mk('instagram') };
    }, proj);
    // 초안 전체 문자열에 대한 강한 "일반 패턴 부재" 단언 — 회사 공개 전화(COMPANY.tel)만 제거 후 검사
    const assertNoPII = (all, label) => {
      let s = all.split(COMP.tel).join(' ');
      const stripped = s.replace(/[\s.\-\/()·・_+]/g, '').split(COMP.digits).join('');
      assert(!/\d{2,4}[\s.\-\/]\d{3,4}[\s.\-\/]\d{4}/.test(s), label + ' 전화형(3-4-4·구분자) 패턴 잔존');
      assert(!/\d{10,}/.test(stripped), label + ' 연속 10자리+ 전화형 숫자열 잔존');
      assert(s.indexOf(RAW_NAME) < 0, label + ' 등록 실명(' + RAW_NAME + ') 잔존');
      assert(s.indexOf('박영수') < 0 && s.indexOf('김철수') < 0, label + ' 미등록 실명 잔존');
      assert(!/\d+\s*동\s*\d+\s*호/.test(s) && !/\d{2,}\s*호/.test(s), label + ' N동 N호 잔존');
      assert(!/[가-힣]{2,}(?:로|길)\s*\d/.test(s), label + ' 도로명+번지 잔존');
    };
    const setSat = async (proj, comment, customer) => page.evaluate(({ p, c, cu }) => {
      state.satisfaction = [{ id: 'x', project: p, customer: cu || '', stars: 5, comment: c, at: '2026-07-05T00:00:00Z' }];
    }, { p: proj, c: comment, cu: customer });

    // ── (A) 위험 후기 = 인용 제외(null) + 초안 전체 PII 패턴 부재 ──
    const RISKY = [
      ['전화 010-1234-5678', '이렇게 좋아요 010-1234-5678 연락주세요'],
      ['전화 01012345678', '문의는 01012345678 로 주세요'],
      ['전화 010.1234.5678', '연락처 010.1234.5678 입니다'],
      ['전화 010 1234 5678(공백)', '전화 010 1234 5678 주세요'],
      ['전화 +82 10-1234-5678', '해외에서 +82 10-1234-5678 로 연락'],
      ['전화 비표준 010/1234/5678', '번호 010/1234/5678 남깁니다'],
      ['전화 전각 ０１０－１２３４－５６７８', '전화 ０１０－１２３４－５６７８ 로 연락주세요'],
      ['전화+등록실명 혼합', '홍길동 010-1234-5678 감사합니다'],
      ['미등록 실명+존칭(박영수님)', '박영수님 정말 감사합니다 최고예요'],
      ['미등록 실명+씨(김철수씨)', '김철수씨 덕분에 잘 마쳤어요 만족합니다'],
      ['주소 동호수(302동 1503호)', '302동 1503호 시공 잘 받았어요'],
      ['주소 도로명(둔산로 123)', '둔산로 123 현장 만족합니다'],
      ['주소 지번(둔산동 123-4)', '둔산동 123-4 시공 감사합니다'],
    ];
    for (const [label, comment] of RISKY) {
      await setSat('둔산동리모델링', comment, RAW_NAME);
      const g = await genAll('둔산동리모델링');
      assert(g.quote === null, label + ': 위험 후기는 adReviewQuote null 이어야 함');
      const all = g.blog + '\n' + g.threads + '\n' + g.insta;
      assert(g.blog.indexOf('[품질·하자') >= 0, label + ': blog은 인용 제외 → [대괄호] 폴백 유지');
      assert(all.indexOf('실제 고객 후기') < 0, label + ': 어떤 채널에도 후기 인용문 미삽입');
      assertNoPII(all, label);
    }

    // ── (B) 등록 실명 변형 = "고객님" 치환 후 정상 인용(존칭결합·내부공백·이름만) ──
    const CLEAN_NAME = [
      ['존칭결합(홍길동님)', '홍길동님 시공 꼼꼼해서 만족합니다'],
      ['내부공백(홍 길동)', '홍 길동 반장님 친절하셨어요 만족'],
      ['존칭 씨 결합(홍길동씨)', '홍길동씨 마감 깔끔합니다 추천해요'],
      ['이름만(홍길동)', '홍길동 마감까지 깔끔하게 잘 끝냈어요'],
    ];
    for (const [label, comment] of CLEAN_NAME) {
      await setSat('둔산동리모델링', comment, RAW_NAME);
      const g = await genAll('둔산동리모델링');
      assert(g.quote && g.quote.text, label + ': 등록 실명 변형은 스크럽 후 정상 인용되어야 함');
      assert(g.quote.text.indexOf(RAW_NAME) < 0, label + ': 인용문에 원본 실명 잔존');
      assert(/고객님/.test(g.quote.text), label + ': 실명이 "고객님"으로 치환되어야 함');
      const all = g.blog + '\n' + g.threads + '\n' + g.insta;
      assert(all.indexOf('실제 고객 후기') >= 0, label + ': 깨끗화된 후기 인용 확인');
      assertNoPII(all, label);
    }

    // ── (C) 자유입력 현장(매칭 project 없음) — 전체 화이트리스트로 등록 실명 치환/전화 제외 ──
    await page.evaluate(() => {
      state.satisfaction = [
        { id: 'f1', project: '자유입력현장A', customer: '', stars: 5, comment: '홍길동 덕분에 만족스러웠습니다', at: '2026-07-05T00:00:00Z' },
        { id: 'f2', project: '자유입력현장B', customer: '', stars: 5, comment: '연락은 010-1234-5678 로 주세요', at: '2026-07-05T00:00:00Z' }
      ];
    });
    const fA = await page.evaluate(() => adReviewQuote('자유입력현장A'));
    const fB = await page.evaluate(() => adReviewQuote('자유입력현장B'));
    assert(fA && fA.text.indexOf(RAW_NAME) < 0 && /고객님/.test(fA.text), '자유입력 현장에서도 전체 화이트리스트로 등록 실명 치환');
    assert(fB === null, '자유입력 현장의 전화 포함 후기는 인용 제외');

    // ── (D) 깨끗한 후기 1건 = 정상 인용(기능 회귀 방지) ──
    await setSat('둔산동리모델링', '사장님이 처음부터 끝까지 꼼꼼하게 챙겨주셔서 정말 만족합니다', '');
    const gc = await genAll('둔산동리모델링');
    assert(gc.quote && /만족합니다/.test(gc.quote.text), '깨끗한 후기는 정상 인용되어야 함');
    assert(gc.blog.indexOf('실제 고객 후기') >= 0, '깨끗한 후기 blog 초안 인용 확인');
    assertNoPII(gc.blog + '\n' + gc.threads + '\n' + gc.insta, '깨끗후기');
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
