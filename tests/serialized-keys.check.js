/* serialized-keys.check.js — 직렬화 최상위 키 목록이 네 곳에서 같은지 (정적 검사)

   2026-09-04 v258 에서 겪은 일: serializeData 에 materials 를 넣고 applyData·허용목록 검사 두 곳까지 맞췄는데,
   유상 작업 저장 경로의 정확 키 목록(PAID_SERIALIZED_STATE_KEYS)과 배열 검사 목록을 빼먹어
   'invalid paid serialized state' 가 났다(office-ops-conversion 이 병렬에서 잡고 재시도로 지나감).
   키를 하나 더할 때 손대야 하는 곳:
     ① serializeData 의 반환 객체     ② applyData 의 복원 대입
     ③ PAID_SERIALIZED_STATE_KEYS      ④ validatePaidSerializedState 의 배열 키 목록(배열이면)
     ⑤ tests/health-board.e2e.js ALLOWED  ⑥ tests/marketing-draft.e2e.js allowed
   이 검사는 ①③⑤⑥ 이 같은 집합인지 본다(②④ 는 restore-parity·office-ops-conversion 이 동작으로 본다). */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fail = (m) => { console.error('FAIL  ' + m); process.exit(1); };

// ① serializeData 반환 객체의 키 (return { ... }; 블록 안의 "키:" 만)
const fnStart = src.indexOf('function serializeData(');
if (fnStart < 0) fail('serializeData 를 찾을 수 없다');
const retStart = src.indexOf('return {', fnStart);
const retEnd = src.indexOf('\n  };', retStart);
const body = src.slice(retStart + 8, retEnd);
// 최상위 깊이(0)에서 '식별자:' 만 키로 본다 — 중첩 객체(files 매핑 등)의 키는 건너뛴다. 문자열·템플릿 안은 무시.
const serialKeys = [];
{
  let depth = 0, quote = '', i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (quote) { if (ch === '\\') { i += 2; continue; } if (ch === quote) quote = ''; i++; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; i++; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; i++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; i++; continue; }
    if (depth === 0) {
      const m = body.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m && (i === 0 || /[\s,]/.test(body[i - 1]))) { serialKeys.push(m[1]); i += m[0].length; continue; }
    }
    i++;
  }
}
// ③ PAID_SERIALIZED_STATE_KEYS
const paidM = src.match(/const PAID_SERIALIZED_STATE_KEYS=\[([^\]]*)\]/);
if (!paidM) fail('PAID_SERIALIZED_STATE_KEYS 를 찾을 수 없다');
const paidKeys = paidM[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
// ⑤⑥ 검사 파일의 허용목록
const hb = fs.readFileSync(path.join(root, 'tests', 'health-board.e2e.js'), 'utf8').match(/const ALLOWED = \[([^\]]*)\]/);
const md = fs.readFileSync(path.join(root, 'tests', 'marketing-draft.e2e.js'), 'utf8').match(/const allowed = new Set\(\[([^\]]*)\]\)/);
if (!hb || !md) fail('health-board / marketing-draft 의 허용목록을 찾을 수 없다');
const listOf = (s) => s.split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
const hbKeys = listOf(hb[1]), mdKeys = listOf(md[1]);

const sets = { serializeData: serialKeys, PAID_SERIALIZED_STATE_KEYS: paidKeys, 'health-board ALLOWED': hbKeys, 'marketing-draft allowed': mdKeys };
const ref = new Set(serialKeys);
let bad = false;
for (const [name, keys] of Object.entries(sets)) {
  const missing = [...ref].filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !ref.has(k));
  if (missing.length || extra.length) { bad = true; console.error('  · ' + name + ' — 빠짐: ' + (missing.join(',') || '없음') + ' / 남음: ' + (extra.join(',') || '없음')); }
}
if (serialKeys.length < 20) fail('serializeData 키를 제대로 읽지 못했다(' + serialKeys.length + '개)');
if (bad) fail('직렬화 최상위 키 목록이 네 곳에서 다르다 — 키를 더했으면 serializeData·applyData·PAID_SERIALIZED_STATE_KEYS(+배열 목록)·검사 허용목록 2곳을 같이 고쳐라');
if (paidKeys.join() !== serialKeys.join()) fail('PAID_SERIALIZED_STATE_KEYS 순서가 serializeData 와 다르다(유상 저장은 키 순서까지 대조한다)');
console.log('✓ 직렬화 최상위 키 ' + serialKeys.length + '개 — serializeData·PAID 목록·검사 허용목록 2곳 일치');
