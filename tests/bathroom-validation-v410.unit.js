/* 미선택 입력 보존과 숫자 자료형 보호는 계산·초안·선택 카드에서 같은 계약을 쓴다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),M=require('../bathroom-model.js');
let passed=0,optionalCases=0,typeCases=0,coercionCases=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function priced(){const d=M.defaults();Object.assign(d.wall,{price:28000,labor:38000});Object.assign(d.floor,{price:26000,labor:45000});return d;}
const copy=d=>JSON.parse(JSON.stringify(d));
function at(d,key){return key.split('.').reduce((o,k)=>o[k],d);}
function put(d,key,value){const keys=key.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],d)[last]=value;}
function totals(r){return {material:r.material,labor:r.labor,supply:r.supply,vat:r.vat,total:r.total,complete:r.complete,missing:r.missing,rows:r.rows};}
const blank=[null,undefined,'',' ','\t'];
const badPrice=[-1,0.5,100000001];
const invalidStrings=['abc','1,000','NaN','Infinity','1e999'];

function optionalCheck(key,enabledKey,value,isPrice){
 const d=priced(),base=M.calculate(d);put(d,key,value);
 const before=JSON.stringify(d);let r;
 assert.doesNotThrow(()=>{r=M.calculate(d);},'INACTIVE_SCOPE_PRESERVED '+key);
 assert.equal(at(r.data,key),value===undefined?null:value,'원입력 보존 '+key);
 assert.equal(JSON.stringify(d),before,'원본 불변 '+key);
 assert.deepEqual(totals(r),totals(base),'미선택 입력은 합계·행·단가 누락에 영향 없음 '+key);
 const restored=M.calculate(copy(r.data));
 assert.deepEqual(restored.data,r.data,'JSON 초안 왕복 '+key);
 assert.deepEqual(totals(restored),totals(base),'초안 복원 후 합계 보존 '+key);
 const selected=copy(restored.data);put(selected,enabledKey,true);
 if(isPrice&&blank.includes(value)){
  const missing=M.calculate(selected);assert.equal(at(missing.data,key),null);
  assert.equal(missing.complete,false,'빈 단가는 무료로 확정하지 않음 '+key);
 }else assert.throws(()=>M.calculate(selected),/입력|범위/,'재선택 시 기존 검증 '+key);
 put(selected,enabledKey,false);assert.deepEqual(totals(M.calculate(selected)),totals(base),'다시 해제하면 합계 복구 '+key);
 optionalCases++;
}

test('13개 미선택 공사의 빈값·범위 오류를 보존하고 재선택할 때 검증',()=>{
 for(let i=0;i<M.defaults().scope.length;i++){
  const prefix='scope.'+i;
  for(const value of ['',null,undefined,' ',-1,0,1.5,101])optionalCheck(prefix+'.qty',prefix+'.enabled',value,false);
  for(const key of ['material','labor'])for(const value of [...blank,...badPrice])optionalCheck(prefix+'.'+key,prefix+'.enabled',value,true);
 }
});

test('두 미선택 부자재의 사용량·포장·가격 오류도 저장 왕복과 선택 검증을 유지',()=>{
 for(let i=0;i<M.defaults().consumables.length;i++){
  const prefix='consumables.'+i;
  for(const key of ['usage','pack'])for(const value of [...blank,-1,0,0.001,key==='usage'?100.001:1000.001])optionalCheck(prefix+'.'+key,prefix+'.enabled',value,false);
  for(const value of [...blank,...badPrice])optionalCheck(prefix+'.price',prefix+'.enabled',value,true);
 }
});

test('필수 치수는 계속 엄격하며 정상 숫자 문자열·빈 단가·0원과 두 VAT 모드를 구분',()=>{
 const required=['size.width','size.depth','size.height','size.doorWidth','size.doorHeight','size.extraOpening',...['wall','floor'].flatMap(k=>['width','height','pack','waste'].map(n=>k+'.'+n))];
 for(const key of required)for(const value of blank){const d=priced();put(d,key,value);assert.throws(()=>M.calculate(d),/입력/,'필수 입력 '+key);}
 for(const key of ['wall.price','wall.labor','floor.price','floor.labor'])for(const value of blank){const d=priced();put(d,key,value);const r=M.calculate(d);assert.equal(at(r.data,key),null);assert.equal(r.missing.length,1);assert.equal(r.complete,false);}
 for(const vat of ['exclusive','inclusive'])for(const qty of [2,'2','2.00',' 2 ','+2','0x2','2e0']){
  const d=priced();d.vat=vat;Object.assign(d.scope[4],{enabled:true,qty,material:' 100 ',labor:'5e1'});
  const r=M.calculate(d);assert.equal(r.data.scope[4].qty,2);assert.equal(r.data.scope[4].material,100);assert.equal(r.data.scope[4].labor,50);
  assert.equal(r.total,vat==='exclusive'?1353308:1230280);assert(r.complete);
 }
 for(const zero of [0,'0']){
  const d=priced();Object.assign(d.scope[4],{enabled:true,qty:'2',material:zero,labor:zero});
  for(const c of d.consumables)Object.assign(c,{enabled:true,usage:'0.25',pack:'1.5',price:zero});
  const r=M.calculate(d);assert(r.complete);assert.equal(r.total,1352978);assert(r.rows.filter(x=>['toiletMat','toiletWork','adhesive','grout'].includes(x.id)).every(x=>x.amount===0));
 }
 const d=priced();d.scope[4].qty=' 2 ';d.scope[4].material='+100';d.scope[4].labor='0x32';d.consumables[0].usage='4e0';d.consumables[0].pack='20.00';
 const restored=M.calculate(copy(M.calculate(d).data));
 assert.equal(restored.data.scope[4].qty,' 2 ');assert.equal(restored.data.scope[4].material,'+100');assert.equal(restored.data.scope[4].labor,'0x32');
 assert.equal(restored.data.consumables[0].usage,'4e0');assert.equal(restored.data.consumables[0].pack,'20.00');
});

function numericFields(){
 const fields=['width','depth','height','doorWidth','doorHeight','extraOpening'].map(k=>({key:'size.'+k}));
 for(const group of ['wall','floor'])for(const key of ['width','height','pack','waste','price','labor'])fields.push({key:group+'.'+key});
 M.defaults().scope.forEach((s,i)=>{for(const key of ['qty','material','labor'])fields.push({key:'scope.'+i+'.'+key,enabled:'scope.'+i+'.enabled'});});
 M.defaults().consumables.forEach((c,i)=>{for(const key of ['usage','pack','price'])fields.push({key:'consumables.'+i+'.'+key,enabled:'consumables.'+i+'.enabled'});});
 return fields;
}

test('모든 숫자 필드에서 손상 타입·비유한 수·잘못된 숫자 문자열을 거부하고 강제변환 함수를 호출하지 않음',()=>{
 const invalid=[true,false,[],[2],{},new Number(2),2n,Symbol('TEST_NUMBER'),function TEST_NUMBER(){return 2;},NaN,Infinity,-Infinity,...invalidStrings];
 for(const field of numericFields())for(const enabled of field.enabled?[false,true]:[true]){
  for(const value of invalid){const d=priced();if(field.enabled)put(d,field.enabled,enabled);put(d,field.key,value);assert.throws(()=>M.calculate(d),/숫자로 입력/,'손상 타입 거부 '+field.key+' '+enabled);typeCases++;}
  let calls=0;const value={valueOf(){calls++;return 2;},toString(){calls++;return '2';}},d=priced();
  if(field.enabled)put(d,field.enabled,enabled);put(d,field.key,value);assert.throws(()=>M.calculate(d),/숫자로 입력/);assert.equal(calls,0,'원시형 검사 전 강제변환 없음 '+field.key);coercionCases++;
 }
});

test('공사 카드 예상 금액도 활성 항목과 같은 검증으로 미정·무료·유효 금액을 구분',()=>{
 const s={name:'시험 공사',enabled:false,qty:'2',material:'100',labor:'50'};
 assert.equal(M.hjBathScopeAmount(s),300);assert.equal(s.qty,'2');
 for(const value of blank){assert.equal(M.hjBathScopeAmount({...s,material:value}),null);assert.equal(M.hjBathScopeAmount({...s,labor:value}),null);}
 assert.equal(M.hjBathScopeAmount({...s,material:0,labor:'0'}),0);
 for(const [key,values] of [['qty',[...blank,-1,0,1.5,101,...invalidStrings,true,[2]]],['material',[...badPrice,...invalidStrings,true,[],NaN]],['labor',[...badPrice,...invalidStrings,false,{},Infinity]]])for(const value of values)assert.throws(()=>M.hjBathScopeAmount({...s,[key]:value}),/시험 공사/,'잘못된 카드 금액을 표시하지 않음 '+key);
});

const source=fs.readFileSync(path.join(__dirname,'../bathroom-model.js'),'utf8');
const mutations=[
 ['미선택 수량도 필수 검증','return enabled?number(v,label,min,max,integer):v===undefined?null:v;','return number(v,label,min,max,integer);',model=>{const d=priced();d.scope[4].qty='';assert.doesNotThrow(()=>model.calculate(d),'INACTIVE_SCOPE_PRESERVED');}],
 ['미선택 원입력 대신 0 저장','return enabled?number(v,label,min,max,integer):v===undefined?null:v;','return enabled?number(v,label,min,max,integer):0;',model=>{const d=priced();d.scope[4].qty='';assert.equal(model.calculate(d).data.scope[4].qty,'','INACTIVE_RAW_PRESERVED');}],
 ['숫자 타입 보호 제거',"if(v!==null&&v!==undefined&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error(label+'은 숫자로 입력해 주세요.');",'',model=>{const d=priced();d.wall.price=true;assert.throws(()=>model.calculate(d),/숫자로 입력/,'STRICT_NUMERIC_TYPE');}],
 ['미선택 숫자 문자열 형식 보호 제거',"if(typeof v==='string'&&v.trim()!==''&&!Number.isFinite(Number(v)))throw Error(label+'은 숫자로 입력해 주세요.');",'',model=>{const d=priced();d.scope[4].qty='abc';assert.throws(()=>model.calculate(d),/숫자로 입력/,'STRICT_INACTIVE_NUMERIC_STRING');}],
 ['빈 배열 가격을 미정으로 강제변환','function price(v,label){hjBathNumericInput(v,label);return','function price(v,label){return',model=>{const d=priced();d.wall.price=[];assert.throws(()=>model.calculate(d),/숫자로 입력/,'STRICT_BLANK_PRICE_TYPE');}],
 ['미선택 가격 타입 보호 제거','function hjBathOptionalPrice(v,label,enabled){hjBathNumericInput(v,label);return','function hjBathOptionalPrice(v,label,enabled){return',model=>{const d=priced();d.scope[4].material=true;assert.throws(()=>model.calculate(d),/숫자로 입력/,'STRICT_INACTIVE_TYPE');}],
 ['카드 금액의 활성 검증 생략','const v=hjBathScopeValues(s,s.name,true);','const v=hjBathScopeValues(s,s.name,false);',model=>{assert.throws(()=>model.hjBathScopeAmount({name:'시험 공사',qty:'',material:100,labor:50}),/입력/,'PREVIEW_REQUIRES_VALID_INPUT');}]
];
for(const [name,from,to,check] of mutations){
 assert.equal(source.split(from).length-1,1,'정확한 변이 대상 '+name);check(M);
 const sandbox={module:{exports:{}}};vm.runInNewContext(source.replace(from,to),sandbox);
 let detected=false;try{check(sandbox.module.exports);}catch(e){assert.equal(e.code,'ERR_ASSERTION','의도한 단언으로 실패 '+name);detected=true;}
 assert(detected,'NOT DETECTED '+name);console.log('DETECTED '+name);
}
console.log('bathroom-validation unit '+passed+'/'+passed+'; mutation '+mutations.length+'/'+mutations.length+'; optional '+optionalCases+'; strict types '+typeCases+'; coercion hooks '+coercionCases);
