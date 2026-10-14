/* 보호 제거 변이가 실제 계산 검사를 실패시키는지 확인한다. 원본 파일은 바꾸지 않는다. */
'use strict';const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');const source=fs.readFileSync(path.join(__dirname,'../bathroom-model.js'),'utf8'),suite=fs.readFileSync(path.join(__dirname,'bathroom-v410.unit.js'),'utf8');
function run(text){const c={module:{exports:{}},console:{log(){}},require};vm.runInNewContext(text,c);vm.runInNewContext(suite,{require:n=>n==='../bathroom-model.js'?c.module.exports:require(n),console:{log(){}}});}
run(source);const mutations=[
 ['장수 올림 제거','const ceil=n=>Math.ceil(n-1e-10);','const ceil=n=>Math.floor(n);'],
 ['단가 미정을 무료로 처리',"?null:number(v,label+' (원 단위 정수)'","?0:number(v,label+' (원 단위 정수)'"],
 ['미선택 공사까지 합산','d.scope.filter(s=>s.enabled).forEach','d.scope.forEach'],
 ['박스 대신 필요한 장수에 가격 적용',"label+' 타일',t.boxes,","label+' 타일',t.need,"],
 ['부가세 제거','Math.round(supply*0.1)','Math.round(supply*0)'],
 ['면적을 먼저 반올림','floorArea=s.width*s.depth/10000','floorArea=round(s.width*s.depth/10000,4)'],
 ['소수 판매단가 허용',"100000000,true);}","100000000);}"]
];for(const [name,a,b] of mutations){assert(source.includes(a),'mutation target '+name);let caught=false;try{run(source.replace(a,b));}catch(_){caught=true;}assert(caught,'NOT DETECTED '+name);console.log('DETECTED '+name);}console.log('bathroom mutations '+mutations.length+'/'+mutations.length);
