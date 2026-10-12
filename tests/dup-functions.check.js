/* v397 최상위 선언만 AST로 검사해 중첩 함수·주석·문자열을 오인하지 않는다. Node 22/24 내장 Acorn 사용. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const native=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
assert.equal(typeof native,'string','Node 내장 JavaScript 파서가 필요합니다');
const parser={exports:{},module:{}};vm.runInNewContext(native,parser);
function names(source){return Array.from(parser.exports.parse(source,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true}).body.filter(n=>n.type==='FunctionDeclaration').map(n=>n.id.name));}
assert.deepEqual(names('function one(){function nested(){}}; async function two(){}; const s="function fake(){}"; /* function fake(){} */'),['one','two']);
assert.deepEqual(names('function same(){}; async function same(){}'),['same','same']);
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),seen=new Set(),duplicates=[];
for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))for(const name of names(m[1])){if(seen.has(name))duplicates.push(name);seen.add(name);}
assert.deepEqual(duplicates,[],'중복 최상위 함수: '+duplicates.join(', '));
console.log('dup-functions.check: PASS ('+seen.size+' top-level functions)');
