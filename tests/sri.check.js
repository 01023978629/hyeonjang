/* sri.check.js — 외부 라이브러리 주소·무결성(SRI) 정적 검사 (v572)

   왜: index.html 은 엑셀·PDF·지도·OCR·HEIC·EXIF 라이브러리를 CDN 에서 받는다. 2026-11 까지는
     · exifr 이 버전 없는 주소(https://cdn.jsdelivr.net/npm/exifr/dist/full.umd.js)라 jsDelivr 가 그때그때 최신판을 줬고
     · 어느 스크립트에도 integrity 가 없어 CDN 이 바뀌거나 중간에서 바꿔치기해도 브라우저가 그대로 실행했다.
   이제 주소·sha384 해시는 _CDN 표 한 곳에만 있고, 모든 외부 스크립트는 고정 버전 + integrity + crossorigin 으로 받는다.
   이 검사는 네트워크 없이 **형식**을 지킨다(실제 CDN 바이트 대조는 tests/tools/sri-live.mjs — run-all 이 돌리지 않는 도구, 네트워크 되는 곳에서 손으로 `node tests/tools/sri-live.mjs`).

   지키는 것
     ① _CDN 표: 줄마다 {src,sri} + '// 패키지@버전 경로, N바이트' 주석, 주소는 jsDelivr /npm/<패키지>@<x.y.z>/<경로> 꼴, 해시는 sha384 꼴,
        주석의 패키지@버전·경로가 주소와 같다
     ② index.html 의 CDN 주소(jsdelivr·cdnjs·unpkg…)는 표 안 아니면 head 의 정적 <script>/<link> 뿐 — 그 태그는 표와 같은 주소·integrity 에 crossorigin="anonymous"
     ③ cdnjs 주소 0 · 버전 없는 jsDelivr 주소 0
     ④ loadExtLib·_cdnScriptEl 호출의 첫 인자는 _CDN 항목(버전이 없어 SRI 가 불가능한 Google 로더 apis.google.com 한 곳만 예외, 이유를 적어 둔다)
     ⑤ pdf.js worker 주소도 표에서(_CDN.pdfworker.src) · getDocument 는 전부 isEvalSupported:false (CVE-2024-4367 완화)
     ⑥ 실패 토스트 문구 한 곳(CDN_SRI_FAIL_MSG) · exifr 은 7.x 고정
     ⑦ 검사 스텁 tests/fixtures/vendor/exif-js-2.3.0.js 의 sha384 == 표의 exifjs — scandup-v557 이 내주는 바이트가 head 태그의 integrity 를 통과해야 한다
   변이 9종을 같은 함수로 돌려 전부 잡히는지 확인한다(안 잡히면 이 검사는 장식이다). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FIXTURE = path.join(__dirname, 'fixtures', 'vendor', 'exif-js-2.3.0.js');

const JSDELIVR_RE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^@/]+)@(\d+\.\d+\.\d+)\/(.+)$/;
const ROW_RE = /^\s*(\w+)\s*:\s*\{src:'([^']+)',sri:'([^']*)'(,worker:true)?\},\s*\/\/\s*(\S+@\S+)\s+(\S+),\s*([\d,]+)바이트/gm;
const CDN_HOST_RE = /https?:\/\/(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|cdn\.skypack\.dev|esm\.sh)\/[^\s'"<>)]+/g;
const PLAIN_ALLOW = { "'https://apis.google.com/js/api.js'": 'Google API 로더 — 버전 없는 주소라 SRI 불가(Google 이 바꾼다)' };

function parseTable(src) {
  const tm = src.match(/\nconst _CDN=\{\n([\s\S]*?)\n\};\n/);
  if (!tm) return null;
  const rows = {};
  for (const r of tm[1].matchAll(ROW_RE)) {
    rows[r[1]] = { url: r[2], sri: r[3], worker: !!r[4], pkg: r[5], file: r[6], bytes: Number(r[7].replace(/,/g, '')) };
  }
  return { rows, lines: tm[1].split('\n').filter(l => l.trim()).length, start: tm.index, end: tm.index + tm[0].length };
}

function check(src, opts) {
  opts = opts || {};
  const p = [];
  const t = parseTable(src);
  if (!t) return ['_CDN 표(const _CDN={ … };)를 찾지 못했다'];
  const keys = Object.keys(t.rows);
  if (keys.length !== t.lines) p.push('표 줄 ' + t.lines + '개 중 ' + keys.length + '개만 형식에 맞다 — 키:{src,sri} + // 패키지@버전 경로, N바이트');
  for (const k of keys) {
    const r = t.rows[k], m = r.url.match(JSDELIVR_RE);
    if (!m) p.push(k + ': jsDelivr /npm/<패키지>@<x.y.z>/<경로> 꼴이 아니다 — ' + r.url);
    else {
      if (m[1] + '@' + m[2] !== r.pkg) p.push(k + ': 주석 패키지@버전(' + r.pkg + ')이 주소(' + m[1] + '@' + m[2] + ')와 다르다');
      if (m[3] !== r.file) p.push(k + ': 주석 경로(' + r.file + ')가 주소(' + m[3] + ')와 다르다');
    }
    if (!/^sha384-[A-Za-z0-9+/]{64}$/.test(r.sri)) p.push(k + ': sha384 해시 꼴이 아니다 — ' + r.sri);
    if (!(r.bytes > 0)) p.push(k + ': 바이트 수 주석이 없다');
  }
  // ② 표 밖 CDN 주소는 head 정적 태그뿐 — 표와 같은 주소·integrity, crossorigin
  const byUrl = {}; keys.forEach(k => { byUrl[t.rows[k].url] = k; });
  let headTags = 0, m;
  CDN_HOST_RE.lastIndex = 0;
  while ((m = CDN_HOST_RE.exec(src))) {
    const url = m[0];
    if (m.index >= t.start && m.index < t.end) continue;
    const ls = src.lastIndexOf('\n', m.index) + 1, le = src.indexOf('\n', m.index);
    const line = src.slice(ls, le < 0 ? src.length : le);
    const tag = line.match(/<(script|link)\b[^>]*>/);
    if (!tag) { p.push('표 밖 CDN 주소: ' + url + ' (줄: ' + line.trim().slice(0, 90) + ')'); continue; }
    headTags++;
    const k = byUrl[url];
    if (!k) { p.push('head 태그 주소가 표에 없다: ' + url); continue; }
    const integ = tag[0].match(/integrity="([^"]+)"/);
    if (!integ || integ[1] !== t.rows[k].sri) p.push('head 태그 integrity 가 표(_CDN.' + k + ')와 다르거나 없다: ' + url);
    if (!/crossorigin="anonymous"/.test(tag[0])) p.push('head 태그에 crossorigin="anonymous" 가 없다: ' + url);
  }
  if (headTags < 2) p.push('head 정적 CDN 태그(exif-js <script>·leaflet <link>)가 ' + headTags + '개뿐이다');
  // ③
  if (/cdnjs\.cloudflare\.com/.test(src)) p.push('cdnjs.cloudflare.com 주소가 남았다 — 전부 jsDelivr /npm/ 경로로(파일이 달라 npm 해시가 안 맞는다)');
  for (const u of src.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/(?:@[^/'"\s]+\/)?[^@/'"\s]+\/[^'"\s<>)]*/g) || []) p.push('버전 없는 jsDelivr 주소: ' + u);
  // ④ 로더 호출
  for (const c of src.matchAll(/(?<!function )\b(loadExtLib|_cdnScriptEl)\(([^,)]+)[,)]/g)) {
    const a = c[2].trim();
    if (a === 'lib') continue;   // loadExtLib 안에서 _cdnScriptEl(lib)
    if (/^_CDN\.\w+$/.test(a)) { if (!t.rows[a.slice(5)]) p.push(c[1] + ' 가 표에 없는 키를 쓴다: ' + a); continue; }
    if (PLAIN_ALLOW[a]) continue;
    p.push(c[1] + ' 첫 인자가 _CDN 항목이 아니다: ' + a);
  }
  // ⑤ pdf.js
  if (!src.includes('pdfjsLib.GlobalWorkerOptions.workerSrc=_CDN.pdfworker.src')) p.push('pdf.js worker 주소가 _CDN.pdfworker.src 에서 오지 않는다');
  if (!t.rows.pdfworker || !t.rows.pdfworker.worker) p.push('_CDN.pdfworker 에 worker:true 표식이 없다(integrity 속성을 못 붙이는 이유를 표가 말해야 한다)');
  const gd = (src.match(/getDocument\(\{/g) || []).length, gdSafe = (src.match(/getDocument\(\{[^)]*isEvalSupported:false/g) || []).length;
  if (gd < 2) p.push('pdfjsLib.getDocument 호출이 ' + gd + '곳뿐이다(미리보기·pdfText 둘이어야 한다)');
  if (gd !== gdSafe) p.push('getDocument ' + gd + '곳 중 ' + gdSafe + '곳만 isEvalSupported:false — CVE-2024-4367 완화가 빠진 호출이 있다');
  // ⑥
  if (!src.includes("const CDN_SRI_FAIL_MSG='무결성 확인 실패 — 네트워크·버전 확인';")) p.push('무결성 실패 토스트 문구(CDN_SRI_FAIL_MSG)가 바뀌었거나 없다');
  if (!t.rows.exifr || !/^exifr@7\./.test(t.rows.exifr.pkg)) p.push('exifr 이 7.x 고정이 아니다: ' + (t.rows.exifr && t.rows.exifr.pkg));
  for (const need of ['exifjs', 'leafletcss', 'leaflet', 'tesseract', 'pdfjs', 'pdfworker', 'jspdf', 'jszip', 'xlsx', 'html2canvas', 'exceljs', 'heic2any', 'exifr']) if (!t.rows[need]) p.push('표에 ' + need + ' 항목이 없다');
  // ⑦ 검사 스텁 바이트 == 표
  if (!opts.skipFixture && t.rows.exifjs) {
    const h = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(FIXTURE)).digest('base64');
    if (h !== t.rows.exifjs.sri) p.push('tests/fixtures/vendor/exif-js-2.3.0.js 의 sha384(' + h.slice(0, 20) + '…)가 표의 exifjs 와 다르다 — scandup-v557 스텁이 integrity 에 막힌다');
  }
  return p;
}

const problems = check(html);
if (problems.length) {
  console.error('FAIL  sri.check — ' + problems.length + '건');
  problems.forEach(x => console.error('  · ' + x));
  process.exit(1);
}
// 변이: 각각 최소 1건을 잡아야 한다
const mut = (from, to) => { if (!html.includes(from)) throw new Error('변이 앵커 없음: ' + from.slice(0, 60)); return html.replace(from, to); };
const t = parseTable(html);
const MUTATIONS = {
  'head integrity 삭제': mut(' integrity="' + t.rows.exifjs.sri + '" crossorigin="anonymous"></script>', '></script>'),
  'head crossorigin 삭제': mut(' integrity="' + t.rows.leafletcss.sri + '" crossorigin="anonymous"/>', ' integrity="' + t.rows.leafletcss.sri + '"/>'),
  'exifr 버전 없는 주소': mut(t.rows.exifr.url, 'https://cdn.jsdelivr.net/npm/exifr/dist/full.umd.js'),
  '표 해시 sha256': mut("sri:'" + t.rows.xlsx.sri + "'", "sri:'sha256-" + t.rows.xlsx.sri.slice(7, 51) + "'"),
  'loadExtLib 글자 주소': mut('loadExtLib(_CDN.exceljs,', "loadExtLib('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',"),
  '표 밖 jsDelivr 주소': mut("const s=_cdnScriptEl(_CDN.exifr);", "const s=document.createElement('script');s.src='" + t.rows.exifr.url + "';"),
  'getDocument eval 허용': mut('getDocument({data:buf,isEvalSupported:false}).promise;   // v572 CVE-2024-4367 완화(pdfText 와 같은 옵션)', 'getDocument({data:buf}).promise;'),
  'worker 주소 표 밖': mut('workerSrc=_CDN.pdfworker.src;', "workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';"),
  '실패 문구 변경': mut("const CDN_SRI_FAIL_MSG='무결성 확인 실패 — 네트워크·버전 확인';", "const CDN_SRI_FAIL_MSG='모듈 로드 실패';"),
};
const missed = Object.entries(MUTATIONS).filter(([, src]) => check(src, { skipFixture: true }).length === 0).map(([n]) => n);
if (missed.length) { console.error('FAIL  sri.check 변이 미검출: ' + missed.join(', ')); process.exit(1); }
console.log('PASS  sri.check — 표 ' + Object.keys(t.rows).length + '항목 · head 태그 2 · cdnjs 0 · 버전 없는 주소 0 · getDocument isEvalSupported:false · 변이 ' + Object.keys(MUTATIONS).length + '/' + Object.keys(MUTATIONS).length);
