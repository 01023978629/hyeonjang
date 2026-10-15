/* 선택하지 않은 부자재도 공통 미포함 목록에 남아 고객 출력에서 숨지 않는다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),M=require('../bathroom-model.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function priced(){const d=M.defaults();Object.assign(d.wall,{price:28000,labor:38000});Object.assign(d.floor,{price:26000,labor:45000});return d;}
function allScope(d){for(const s of d.scope)Object.assign(s,{enabled:true,material:0,labor:0});return d;}

test('기본 미포함 목록은 기존 공사 순서 뒤에 접착제와 줄눈재를 표시',()=>{
 const d=priced(),before=JSON.stringify(d),r=M.calculate(d);
 assert.deepEqual(r.excluded,[...d.scope.map(s=>s.name),'타일 접착제','줄눈재']);
 assert.equal(JSON.stringify(d),before,'계산은 원본 입력을 바꾸지 않음');
 assert.equal(r.material,442000);assert.equal(r.labor,787980);assert.equal(r.total,1352978);
 assert.deepEqual(r.rows.map(x=>x.id),['wallTile','wallWork','floorTile','floorWork']);
});

test('모든 공사를 선택해도 미선택 부자재는 CSV 미포함 행에 남음',()=>{
 const d=allScope(priced()),r=M.calculate(d);
 assert.deepEqual(r.excluded,['타일 접착제','줄눈재']);
 assert.equal(r.rows.length,44,'v411 타일 네 행과 선택한 공사 20개의 자재·시공 행만 합산');
 assert.equal(r.total,1352978);assert(r.complete);
 assert(M.toCSV(r).includes('"미포함 품목","타일 접착제, 줄눈재"'));
});

test('부자재 하나 또는 둘의 선택은 해당 제외명만 빼고 수량·금액을 한 번 반영',()=>{
 const d=allScope(priced()),base=M.calculate(d);
 Object.assign(d.consumables[0],{enabled:true,usage:4,pack:20,price:20000});
 const one=M.calculate(d);
 assert.deepEqual(one.excluded,['줄눈재']);assert.equal(one.consumables[0].packs,5);
 assert.equal(one.rows.filter(x=>x.id==='adhesive').length,1);
 assert.equal(one.material-base.material,100000);assert.equal(one.labor,base.labor);
 assert.equal(one.total-base.total,110000);
 Object.assign(d.consumables[1],{enabled:true,usage:0.3,pack:2,price:10000});
 const both=M.calculate(d);
 assert.deepEqual(both.excluded,[]);assert.equal(both.consumables[1].packs,4);
 assert.equal(both.rows.filter(x=>x.id==='grout').length,1);
 assert.equal(both.material-one.material,40000);assert.equal(both.labor,base.labor);
 assert.equal(both.total-one.total,44000);
 d.consumables[0].enabled=false;
 const groutOnly=M.calculate(d);
 assert.deepEqual(groutOnly.excluded,['타일 접착제']);
 assert.equal(groutOnly.material-base.material,40000);assert.equal(groutOnly.total-base.total,44000);
 assert(!groutOnly.rows.some(x=>x.id==='adhesive'));
});

test('초안의 임의 항목명은 표시하지 않고 정본 이름과 저장 형식을 유지',()=>{
 const d=priced();d.scope[0].name='UNTRUSTED_SCOPE';d.consumables[0].name='UNTRUSTED_CONSUMABLE';
 d.consumables[0].enabled=false;d.consumables[0].price=10000;
 const before=JSON.stringify(d),r=M.calculate(d);
 assert.equal(JSON.stringify(d),before);
 assert.equal(r.excluded[0],'기존 욕실 철거');assert.equal(r.excluded.at(-2),'타일 접착제');
 assert(!M.toCSV(r).includes('UNTRUSTED'));
 assert(!Object.hasOwn(r.data,'excluded'),'파생 목록을 저장 초안에 넣지 않음');
 assert.equal(r.data.consumables[0].price,10000,'미선택 값은 보존');
 assert.equal(r.total,1352978,'미선택 단가를 합산하지 않음');
 d.consumables[0].usage='';assert.equal(M.calculate(d).data.consumables[0].usage,'','미선택 입력은 그대로 보존');
 d.consumables[0].enabled=true;assert.throws(()=>M.calculate(d),/타일 접착제/,'재선택하면 입력 검증 적용');
});

const source=fs.readFileSync(path.join(__dirname,'../bathroom-model.js'),'utf8');
const guard='.concat(d.consumables.filter(c=>!c.enabled).map(c=>c.name))';
assert.equal(source.split(guard).length-1,1,'부자재 제외 목록 변이 대상은 정확히 한 곳');
const sandbox={module:{exports:{}}};vm.runInNewContext(source.replace(guard,''),sandbox);
const mutant=sandbox.module.exports,mutated=mutant.calculate(allScope(priced()));
assert.throws(()=>assert.deepEqual(Array.from(mutated.excluded),['타일 접착제','줄눈재']),/AssertionError/,'부자재 제외 목록을 빼면 보호 검사가 실패');
console.log('bathroom-exclusions unit '+passed+'/'+passed+'; mutation 1/1 detected');
