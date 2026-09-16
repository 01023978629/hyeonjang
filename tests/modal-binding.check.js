/* modal-binding.check.js — 모달 안에 그려 놓고 위임에만 기대는 버튼 검사

   click-delegation.check.js 는 "핸들러는 있는데 셀렉터 목록에 없는 버튼" 을 잡는다.
   이 검사는 그 검사가 절대 못 잡는 반대쪽 사고를 잡는다.

     <div id="view"></div>        ← 클릭 위임은 여기 하나에만 걸려 있다
     <div id="modalRoot"></div>   ← 모달은 여기 그려진다. #view 의 자식이 아니라 형제다

   그래서 모달 안 버튼은 셀렉터 목록에 이름이 있어도, 핸들러가 멀쩡해도,
   위임이 통째로 닿지 않는다. e.target.closest() 는 위로만 올라가는데
   #modalRoot 위에는 #view 가 없다.

   v300 의 [반영](data-ledgercost) 이 정확히 이 상태였다 — 셀렉터에도 있고
   핸들러도 있어서 코드만 읽으면 다 배선돼 있는 것처럼 보이는데, 눌러도 조용했다.
   앞 검사는 이걸 통과시킨다(셀렉터에 있으니까). 그래서 이 검사가 따로 필요하다.

   판정: openModal() 로 가는 마크업에 data-xxx 가 있고, 그 xxx 가 #view 위임
   셀렉터 목록에도 있는데, 같은 함수 안에 직접 바인딩(#modalRoot [data-xxx] 을
   querySelector 해서 onclick 을 거는 것)이 없으면 죽은 버튼이다.
   id 버튼(t.id==='xxx' 핸들러)도 같은 방식으로 본다.

   고치는 법은 둘 중 하나다.
     · 모달에 계속 그릴 거면 → openModal 직후 #modalRoot 에서 직접 onclick 을 건다
       (그리고 위임 셀렉터에서는 그 이름을 뺀다 — 닿지도 않으면서 배선된 척한다)
     · 화면(#view)에 그릴 거면 → 모달에서 빼고 위임에 맡긴다

   브라우저 없이 도는 정적 검사다(syntax·version-sync·click-delegation 과 같은 성격). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const fail = [];

/* ── 1. 소스에서 필요한 세 가지를 뽑는 순수 함수들 ───────────────────────── */

// 줄머리(들여쓰기 0) function 선언 ~ 다음 줄머리 '}' 를 함수 한 개로 본다.
// 이 저장소의 최상위 함수는 전부 이 모양이라 중괄호를 세는 것보다 정확하다
// (문자열 안의 { } 에 속지 않는다).
function topLevelFunctions(src) {
  const out = [];
  let cur = null;
  src.split('\n').forEach((ln, i) => {
    if (/^(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/.test(ln)) {
      if (cur) out.push(cur);
      cur = { name: ln.match(/function\s+([A-Za-z0-9_$]+)/)[1], line: i + 1, lines: [ln] };
    } else if (cur) {
      cur.lines.push(ln);
      if (/^\}/.test(ln)) { out.push(cur); cur = null; }
    }
  });
  if (cur) out.push(cur);
  return out.map(f => ({ name: f.name, line: f.line, body: f.lines.join('\n') }));
}

// #view 위임이 받아 주는 이름들 — closest('…') + if(!t)return 짝만 본다
function delegationTargets(src) {
  const data = new Set(), ids = new Set();
  const re = /const\s+t\s*=\s*e\.target\.closest\('([^']+)'\)\s*;?\s*\n\s*if\s*\(\s*!t\s*\)\s*return\s*;?/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    (m[1].match(/\[data-([a-z0-9-]+)\]/g) || []).forEach(s => data.add(s.replace(/^\[data-|\]$/g, '')));
    (m[1].match(/#([A-Za-z0-9_-]+)/g) || []).forEach(s => ids.add(s.slice(1)));
  }
  return { data, ids };
}

// 모달 함수 안에서 죽어 있는 버튼 찾기
function deadModalButtons(src) {
  const deleg = delegationTargets(src);
  const dead = [];
  for (const f of topLevelFunctions(src)) {
    if (!/\bopenModal\s*\(/.test(f.body)) continue;

    for (const raw of (f.body.match(/data-([a-z0-9-]+)\s*=\s*["'`]/g) || [])) {
      const a = raw.replace(/^data-/, '').replace(/\s*=\s*["'`]$/, '');
      if (!deleg.data.has(a)) continue;                       // 위임에 없으면 이 검사 밖 (앞 검사 담당)
      // 직접 바인딩이 있으면 살아 있다
      if (new RegExp('querySelector(?:All)?\\([^)]*\\[data-' + a + '\\]').test(f.body)) continue;
      dead.push({ fn: f.name, line: f.line, what: '[data-' + a + ']' });
    }

    for (const raw of (f.body.match(/\bid\s*=\s*\\?["'](?:\+?)([A-Za-z][A-Za-z0-9_-]*)\\?["']/g) || [])) {
      const id = raw.replace(/.*["']([A-Za-z][A-Za-z0-9_-]*)\\?["']$/, '$1');
      if (!deleg.ids.has(id)) continue;
      if (new RegExp('getElementById\\(\\s*["\'`]' + id + '["\'`]').test(f.body)) continue;
      if (new RegExp('querySelector(?:All)?\\([^)]*#' + id + '\\b').test(f.body)) continue;
      dead.push({ fn: f.name, line: f.line, what: '#' + id });
    }
  }
  // 같은 함수에서 같은 이름이 여러 번 나와도 한 번만 보고한다
  const seen = new Set();
  return dead.filter(d => { const k = d.fn + d.what; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ── 2. 자기 검사 — 이 검사가 v300 버그를 실제로 잡는지 먼저 증명한다 ────────
   검사가 0건을 보고할 때 그게 "깨끗해서" 인지 "눈이 멀어서" 인지 구별이 안 되면
   검사가 아니라 장식이다. 그래서 v300 을 그대로 재현한 가짜 소스를 먼저 먹인다. */
const FIXTURE_BAD = [
  'function fakeLedgerModal(){',
  "  const body='<button data-ledgercost=\"x\">반영</button>';",
  "  openModal('제목',body,[{label:'닫기'}]);",
  '}',
  'function setupDelegation(){',
  "  view.addEventListener('click',e=>{",
  "    const t=e.target.closest('[data-ledgercost],[data-other]');",
  '    if(!t)return;',
  '    const d=t.dataset;',
  '    if(d.ledgercost!==undefined)return apply(d.ledgercost);',
  '  });',
  '}'
].join('\n');

const FIXTURE_GOOD = FIXTURE_BAD.replace(
  "  openModal('제목',body,[{label:'닫기'}]);",
  "  openModal('제목',body,[{label:'닫기'}]);\n" +
  "  document.querySelectorAll('#modalRoot [data-ledgercost]').forEach(b=>{b.onclick=()=>apply(b.dataset.ledgercost);});"
);

const selfBad = deadModalButtons(FIXTURE_BAD);
const selfGood = deadModalButtons(FIXTURE_GOOD);
if (!selfBad.some(d => d.what === '[data-ledgercost]')) {
  fail.push('자기 검사 실패 — v300 버그를 재현한 가짜 소스에서 죽은 버튼을 못 찾았다. 이 검사는 지금 아무것도 못 본다');
}
if (selfGood.length) {
  fail.push('자기 검사 실패 — 직접 바인딩까지 해 둔 가짜 소스를 죽었다고 했다(헛경보): ' +
    selfGood.map(d => d.what).join(', '));
}

/* ── 3. 진짜 검사 ─────────────────────────────────────────────────────── */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dead = deadModalButtons(html);
for (const d of dead) {
  fail.push(
    d.fn + '() (index.html ' + d.line + '행) 이 모달에 ' + d.what + ' 을 그려 놓고 #view 위임에 맡겼다 — ' +
    '#modalRoot 는 #view 의 형제라 그 위임은 닿지 않는다. 눌러도 아무 일도 안 일어난다.\n' +
    '  → openModal 직후 document.querySelectorAll(\'#modalRoot ' + d.what + '\') 로 직접 onclick 을 걸고, ' +
    '위임 셀렉터에서는 그 이름을 빼라 (v300 [data-ledgercost] 와 같은 사고다)'
  );
}

// 실제로 사고가 났던 이름은 못을 박아 둔다 — 위임 목록에 다시 들어가면 바로 잡는다
const deleg = delegationTargets(html);
if (deleg.data.has('ledgercost')) {
  fail.push('[data-ledgercost] 가 다시 #view 위임 셀렉터에 들어갔다 — 그 버튼은 모달에 그려져서 위임이 닿지 않는다(v300). ' +
    'hjLoadCostFromLedger() 가 openModal 직후 직접 거는 것이 맞다');
}

// 모달 버튼을 직접 거는 관용구가 코드에 실제로 남아 있는지 — 통째로 사라졌으면 이 검사의 전제가 무너진 것이다
const directBinds = (html.match(/#modalRoot\s+\[data-[a-z0-9-]+\]/g) || []).length;
if (directBinds < 1) {
  fail.push("'#modalRoot [data-…]' 직접 바인딩이 한 곳도 없다 — 모달 구조가 바뀌었으면 이 검사부터 고쳐라");
}

if (fail.length) {
  fail.forEach(f => console.error('FAIL  ' + f));
  process.exit(1);
}
const modalFns = topLevelFunctions(html).filter(f => /\bopenModal\s*\(/.test(f.body)).length;
console.log('PASS  자기 검사 — v300 재현본은 잡고, 직접 바인딩한 것은 안 잡는다');
console.log('PASS  openModal 을 쓰는 함수 ' + modalFns + '곳 — 위임에만 기댄 죽은 모달 버튼 없음');
console.log('PASS  [data-ledgercost] 는 위임 셀렉터 밖 (직접 바인딩 담당)');
console.log('PASS  모달 직접 바인딩 관용구 ' + directBinds + '곳 확인');
console.log('\n전부 통과 (4건)');
