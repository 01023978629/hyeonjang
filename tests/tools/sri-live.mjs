/* tests/tools/sri-live.mjs — _CDN 표의 주소를 실제로 받아 sha384·바이트를 대조하는 도구 (v572)

   run-all 이 돌리지 않는다(tests/ 바로 아래 *.check.js·*.unit.js·*.e2e.js 만 집계한다 — 이 파일은 tests/tools/ 의 .mjs).
   네트워크가 필요해서다: 개발 컨테이너는 바깥 DNS 가 막혀 있어 게이트에 넣으면 늘 건너뛰기만 하고 '통과'로 읽힌다.
   형식(표·태그·주소 꼴·해시 꼴)은 네트워크 없는 tests/sri.check.js 가 게이트에서 지킨다.

   언제 돌리나: _CDN 표의 버전·해시를 바꿨을 때, 그리고 병합 전에 네트워크 되는 곳(대표 PC·GitHub Actions 수동 단계)에서 한 번.
     node tests/tools/sri-live.mjs            ← 못 받은 항목은 SKIP, 종료 0 (해시 불일치만 종료 1)
     node tests/tools/sri-live.mjs --strict   ← 하나라도 못 받으면 종료 2 (네트워크가 된다고 믿는 곳에서)
   해시는 `npm pack <패키지>@<버전>` tarball 의 파일에서 계산했고 jsDelivr /npm/ 이 그 바이트를 그대로 준다는 전제다.
   전제가 틀리면(버전이 사라지거나 CDN 이 파일을 손대면) 브라우저가 그 라이브러리를 아예 실행하지 않는다 —
   엑셀·PDF·지도·OCR·HEIC·EXIF 가 그 자리에서 멈춘다. 이 도구가 OK 를 찍기 전에는 그 전제가 확인된 것이 아니다. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STRICT = process.argv.includes('--strict');
const ROW_RE = /^\s*(\w+)\s*:\s*\{src:'([^']+)',sri:'([^']*)'(,worker:true)?\},\s*\/\/\s*(\S+@\S+)\s+(\S+),\s*([\d,]+)바이트/gm;
const tm = html.match(/\nconst _CDN=\{\n([\s\S]*?)\n\};\n/);
if (!tm) { console.error('FAIL  sri-live — _CDN 표를 찾지 못했다'); process.exit(1); }
const rows = [...tm[1].matchAll(ROW_RE)].map(r => ({ key: r[1], url: r[2], sri: r[3], pkg: r[5], file: r[6], bytes: Number(r[7].replace(/,/g, '')) }));
if (!rows.length) { console.error('FAIL  sri-live — 표 줄을 읽지 못했다(형식은 tests/sri.check.js 가 본다)'); process.exit(1); }
const TIMEOUT_MS = 15000;

async function probe(r) {
  let res;
  try {
    res = await fetch(r.url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'hyeonjang-sri-live/1 (+tests/tools/sri-live.mjs)' } });
  } catch (e) {
    return { r, skip: '받지 못함 ' + ((e && e.cause && e.cause.code) || (e && e.name) || String(e)) };   // 오프라인·DNS·timeout — 네트워크 문제
  }
  if (res.status === 403 || res.status === 407 || res.status >= 500) return { r, skip: 'HTTP ' + res.status + '(프록시·CDN 쪽)' };
  if (!res.ok) return { r, fail: 'HTTP ' + res.status + ' — 그 버전·경로가 CDN 에 없다(배포하면 라이브러리를 못 받는다)' };
  const buf = Buffer.from(await res.arrayBuffer());
  const got = 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
  if (got !== r.sri) return { r, fail: '해시 불일치 — 표 ' + r.sri.slice(0, 19) + '… / CDN ' + got.slice(0, 19) + '… (' + buf.length + '바이트)' };
  if (buf.length !== r.bytes) return { r, fail: '바이트 수 불일치 — 표 ' + r.bytes + ' / CDN ' + buf.length + '(해시는 같다 — 주석을 고쳐라)' };
  return { r, ok: buf.length };
}

const results = await Promise.all(rows.map(probe));
let ok = 0, skip = 0, fail = 0;
for (const x of results) {
  if (x.ok) { ok++; console.log('OK    ' + x.r.pkg + ' ' + x.r.file + ' — ' + x.ok + '바이트, sha384 일치'); }
  else if (x.skip) { skip++; console.log('SKIP(네트워크 없음) ' + x.r.url + ' — ' + x.skip); }
  else { fail++; console.error('FAIL  ' + x.r.pkg + ' ' + x.r.file + ' — ' + x.fail); }
}
if (fail) { console.error('FAIL  sri-live — ' + fail + '건 불일치: 그 라이브러리는 브라우저가 실행하지 않는다. 해시·버전·경로를 다시 계산하라'); process.exit(1); }
if (skip && STRICT) { console.error('FAIL  sri-live --strict — ' + skip + '개를 받지 못했다(대조 안 됨)'); process.exit(2); }
if (!ok) console.log('⚠ sri-live — ' + skip + '개 전부 SKIP(네트워크 없음): 실제 대조는 하지 못했다. 네트워크 되는 곳에서 다시 돌려라');
console.log((skip ? 'DONE  ' : 'PASS  ') + 'sri-live — OK ' + ok + ' · SKIP ' + skip + ' · FAIL 0 (표 ' + rows.length + '항목)');
