/* ai-tools-count.check.js — 맨 앞 개발자 주석의 AI 도구 수를 실제 배열과 맞춘다.

   주석은 개발자가 기능을 찾는 첫 지도다. 배열이 늘었는데 숫자가 그대로면
   없는 도구로 오해하거나, 반대로 실제보다 많은 기능이 있다고 판단한다. */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const topComment = (html.match(/<!--[\s\S]*?-->/) || [''])[0];
const declared = topComment.match(/AI_TOOLS\s+(\d+)종/);
const block = html.match(/const\s+AI_TOOLS\s*=\s*\[([\s\S]*?)\n\];/);
const actual = block ? (block[1].match(/^\s*\{name:/gm) || []).length : 0;
const fail = [];

if (!declared) fail.push('맨 앞 주석에 "AI_TOOLS N종" 표기가 없다');
if (!block) fail.push('AI_TOOLS 배열을 찾지 못했다');
if (block && actual === 0) fail.push('AI_TOOLS 배열에서 도구를 한 개도 세지 못했다');
if (declared && block && Number(declared[1]) !== actual) {
  fail.push(`맨 앞 주석은 ${declared[1]}종, 실제 AI_TOOLS 배열은 ${actual}종이다`);
}

if (fail.length) {
  fail.forEach((message) => console.error('FAIL  ' + message));
  process.exit(1);
}
console.log(`PASS  맨 앞 주석 AI_TOOLS ${actual}종 == 실제 배열 ${actual}종`);
