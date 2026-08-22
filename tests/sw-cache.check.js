'use strict';
const fs = require('fs');
const path = require('path');

const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const fail = msg => { console.error('FAIL  ' + msg); process.exit(1); };

if (!/if\(res\.ok\)\{const cp=res\.clone\(\);caches\.open\(C\)\.then\(c=>c\.put\(e\.request,cp\)\);\}/.test(sw)) {
  fail('문서 응답은 성공(2xx)일 때만 캐시해야 한다');
}
if (!/if\(res\.ok&&res\.type!=='opaque'\)\{try\{cache\.put\(e\.request,res\.clone\(\)\);\}/.test(sw)) {
  fail('사진·정적 응답은 성공이며 opaque가 아닐 때만 캐시해야 한다');
}
console.log('PASS  Google 403·opaque 응답을 서비스워커 캐시에 저장하지 않음');
