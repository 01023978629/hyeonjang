/* click-delegation.check.js — 위임 목록에 없는 버튼(눌러도 아무 일도 안 일어나는 버튼) 검사

   앱의 클릭은 거의 전부 위임 한 곳에서 받는다.

     const t = e.target.closest('[data-a],[data-b],#btnC, …');   // ← 셀렉터 목록
     if (!t) return;                                              // ← 목록에 없으면 여기서 끝
     const d = t.dataset;
     if (d.a !== undefined) return doA(d.a);                      // ← 핸들러

   버튼을 새로 그리고 핸들러까지 멀쩡히 써 놓고 **셀렉터 목록에 이름을 안 넣으면**
   closest() 가 null 을 돌려주고 if(!t)return 에서 끝난다. 화면에는 버튼이 멀쩡히
   보이는데 눌러도 아무 일도 안 일어나고, 오류도 안 난다. 콘솔도 조용하다.
   사장님은 "버튼이 안 눌려요" 라고만 말할 수 있고, 핸들러 코드는 정상이라
   그쪽만 들여다보면 영원히 못 찾는다.

   실제로 v297 의 [동·호수 관리](data-aptunits) 가 이 상태였다 — 핸들러도
   aptUnitView() 도 다 있는데 셀렉터 목록에만 빠져서 죽은 코드였다.
   같은 사고가 전에도 있었다(#btnAddCard, [data-editc]).

   그래서 이 검사는 **핸들러가 있는데 셀렉터 목록에 없는 것**을 잡는다.
   그 방향만이 "보이는데 안 눌리는 버튼" 을 만든다.

   브라우저 없이 도는 정적 검사다(syntax·version-sync 와 같은 성격). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fail = [];

// dataset 의 camelCase 를 실제 속성 이름으로 되돌린다 (d.myThing → data-my-thing)
const toAttr = (camel) => camel.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());

// 위임 지점 = closest('…셀렉터…') 바로 다음이 if(!t)return; 인 곳
const blocks = [];
const re = /const\s+t\s*=\s*e\.target\.closest\('([^']+)'\)\s*;?\s*\n\s*if\s*\(\s*!t\s*\)\s*return\s*;?/g;
let m;
while ((m = re.exec(html)) !== null) {
  const selector = m[1];
  const bodyStart = m.index + m[0].length;
  // 이 위임 블록의 끝 = 다음 addEventListener( 직전 (없으면 넉넉히 뒤까지)
  const next = html.indexOf('addEventListener(', bodyStart);
  const body = html.slice(bodyStart, next === -1 ? bodyStart + 200000 : next);
  const line = html.slice(0, m.index).split('\n').length;
  blocks.push({ selector, body, line });
}

if (!blocks.length) {
  fail.push("위임 지점(closest(…) + if(!t)return)을 하나도 못 찾았다 — 구조가 바뀌었으면 이 검사부터 고쳐라");
}

let checkedHandlers = 0;
for (const b of blocks) {
  const dataSel = new Set((b.selector.match(/\[data-([a-z0-9-]+)\]/g) || [])
    .map(s => s.replace(/^\[data-|\]$/g, '')));
  const idSel = new Set((b.selector.match(/#([A-Za-z0-9_-]+)/g) || []).map(s => s.slice(1)));
  // 클래스로 받는 목록도 있으므로(.apoDel 등) 존재만 기록해 둔다
  const classSel = new Set((b.selector.match(/\.([A-Za-z][A-Za-z0-9_-]*)/g) || []).map(s => s.slice(1)));

  // 무엇이 "이 버튼을 누른 것"인지 판정하는 관용구만 센다 — d.xxx!==undefined 와 t.id==='xxx'.
  // t.dataset.xxx 를 그냥 읽는 곳은 세지 않는다. 그건 트리거가 아니라 같은 요소에 얹어둔
  // 동반 속성이다(예: data-stage 로 눌리고 data-proj 로 어느 현장인지 읽는다).
  // 그것까지 트리거로 치면 [data-proj] 이 셀렉터에 없다고 헛경보가 난다.
  const dataHandlers = new Set(
    (b.body.match(/\bd\.([a-zA-Z0-9_]+)\s*!==\s*undefined/g) || [])
      .map(s => s.replace(/^\bd\./, '').replace(/\s*!==\s*undefined$/, ''))
  );
  const idHandlers = new Set((b.body.match(/t\.id\s*===\s*['"]([A-Za-z0-9_-]+)['"]/g) || [])
    .map(s => s.replace(/.*['"]([A-Za-z0-9_-]+)['"]$/, '$1')));

  for (const h of dataHandlers) {
    checkedHandlers++;
    const attr = toAttr(h);
    if (!dataSel.has(attr)) {
      fail.push(
        '위임 셀렉터에 [data-' + attr + '] 이 없는데 핸들러(d.' + h + ')만 있다 ' +
        '(index.html 약 ' + b.line + '행 위임) — 그 버튼은 화면에 보여도 눌리지 않는다. ' +
        'closest() 목록에 [data-' + attr + '] 을 넣어라'
      );
    }
  }
  for (const h of idHandlers) {
    checkedHandlers++;
    if (!idSel.has(h) && !classSel.has(h)) {
      fail.push(
        '위임 셀렉터에 #' + h + ' 가 없는데 핸들러(t.id===\'' + h + '\')만 있다 ' +
        '(index.html 약 ' + b.line + '행 위임) — 그 버튼은 눌리지 않는다'
      );
    }
  }
}

// 이 버그로 실제 사고가 났던 버튼들은 이름으로 못을 박아 둔다 — 리팩터링으로 다시 빠지면 바로 잡는다
for (const attr of ['aptunits']) {
  if (!blocks.some(b => b.selector.includes('[data-' + attr + ']'))) {
    fail.push('[data-' + attr + '] 이 어느 위임 셀렉터에도 없다 — 전에 이걸로 사고가 났다(눌러도 무반응)');
  }
}

if (fail.length) {
  fail.forEach(f => console.error('FAIL  ' + f));
  process.exit(1);
}
console.log('PASS  위임 지점 ' + blocks.length + '곳, 핸들러 ' + checkedHandlers + '건 — 셀렉터 목록에서 빠진 것 없음');
console.log('PASS  [data-aptunits] 위임 등록 확인');
console.log('\n전부 통과 (2건)');
