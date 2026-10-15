/* v411 상담 원본을 보존하며 앱 품목·이관 정보·미리 채우기를 만든다. */
'use strict';
const assert=require('node:assert/strict'),M=require('../bathroom-model.js');
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
const clone=value=>JSON.parse(JSON.stringify(value));
const NOW=Date.parse('2026-10-16T03:00:00.000Z');
function priced(){const d=M.defaults();Object.assign(d.wall,{price:28000,labor:38000});Object.assign(d.floor,{price:26000,labor:45000});return d;}
function prefill(prices={}){return {at:new Date(NOW).toISOString(),project:'합성 욕실 현장',customer:{name:'합성 고객',addr:'합성 주소'},prices};}
function appTotal(items,inclusive){const supply=Math.round(items.reduce((sum,i)=>sum+i.qty*(inclusive?Math.round(i.price/1.1):i.price),0));return supply+Math.round(supply*0.1);}

test('v1 초안의 기존 선택·수량·단가를 보존하고 신규 7개만 추가',()=>{
 const old=priced();old.version=1;delete old.method;delete old.days;delete old.place;old.scope=old.scope.slice(0,13);
 old.scope[0].enabled=true;old.scope[0].material=0;old.scope[0].labor=80000;old.scope[4].qty=2;old.scope[4].model='기존 모델';
 const before=clone(old),upgraded=M.normalize(old);
 assert.equal(upgraded.version,2);assert.equal(upgraded.method,'full');assert.deepEqual(upgraded.days,{work:null,unusable:null,start:''});
 assert.deepEqual(upgraded.scope.slice(0,13),old.scope);assert.deepEqual(upgraded.wall,old.wall);assert.deepEqual(old,before);
 assert.equal(upgraded.scope.length,20);assert(upgraded.scope.slice(13).every(s=>!s.enabled&&s.material===null&&s.labor===null));
 assert.equal(upgraded.scope.find(s=>s.id==='waste').enabled,false,'이전 선택을 방식 기본값으로 덮지 않음');
});

test('신규 기본 항목·가격명·식과 개 표기',()=>{
 const d=M.defaults();assert.equal(d.version,2);assert.equal(d.method,'full');
 assert.deepEqual(d.scope.slice(13).map(s=>s.name),['욕조 철거','욕조 설치','비데','젠다이·선반','욕실 문·문틀 교체','유가(바닥 배수구) 교체','수건걸이·액세서리 세트']);
 assert(d.scope.slice(13).every(s=>!s.enabled));assert.equal(M.appPriceNames.length,46);assert.equal(new Set(M.appPriceNames).size,46);
 assert.equal(M.unitPriceLabel('식'),'1식(일괄) 가격');assert.equal(M.unitPriceLabel('개'),'개당 가격');
 assert.deepEqual(M.normalize(d),d);const broken=clone(d);broken.scope.pop();assert.throws(()=>M.normalize(broken),/공사 항목/);
});

test('기간은 비움 또는 정수 0~60이며 손상 값·잘못된 방식은 거부',()=>{
 for(const value of [null,'',' ',0,60,'3']){const d=priced();d.days.work=value;d.days.unusable=value;const n=M.normalize(d);assert.equal(n.days.work,value===null||String(value).trim()===''?null:Number(value));}
 for(const value of [-1,61,1.5,true,false,[],{},Infinity,NaN,'1일']){const d=priced();d.days.work=value;assert.throws(()=>M.calculate(d),/공사 기간/);}
 for(const days of [null,[],false]){const d=priced();d.days=days;assert.throws(()=>M.normalize(d),/공사 기간/);}
 const invalid=priced();invalid.method='unknown';assert.throws(()=>M.normalize(invalid),/시공 방식/);
 const d=priced();d.days={work:0,unusable:60,start:'제품 도착 후'};assert.equal(M.hjBathDaysText(M.normalize(d).days),'예상 공사 0일 · 욕실 사용 불가 60일 · 시작 가능 시기 제품 도착 후');
});

test('타일·부자재·추가공사 표준 품목과 계산 근거 매핑',()=>{
 const d=priced();Object.assign(d.consumables[0],{enabled:true,price:15000});Object.assign(d.scope[4],{enabled:true,qty:2,material:180000,labor:60000,model:'합성 모델'});
 const r=M.calculate(d),items=M.toAppItems(r,d);
 assert.deepEqual(items[0],{name:'욕실 벽 타일(박스)',spec:'300×600 · 8장/박스 · 13박스 104장(필요 100장)',qty:13,price:28000,pending:false});
 assert.deepEqual(items[1],{name:'욕실 벽 타일 시공(㎡)',spec:'순면적 16.26㎡',qty:16.26,price:38000,pending:false});
 assert.equal(items[2].name,'욕실 바닥 타일(박스)');assert.equal(items[3].qty,3.78);
 assert.deepEqual(items.find(i=>i.name==='타일 접착제'),{name:'타일 접착제',spec:'5포',qty:5,price:15000,pending:false});
 assert.deepEqual(items.find(i=>i.name==='양변기'),{name:'양변기',spec:'합성 모델',qty:2,price:180000,pending:false});
 assert.deepEqual(items.find(i=>i.name==='양변기 시공'),{name:'양변기 시공',spec:'개당',qty:2,price:60000,pending:false});
 assert(items.every(i=>M.appPriceNames.includes(i.name)));assert.equal(items.length,7);
});

test('미정 쌍은 한 행으로 합치되 무료 0원과 부분 미정을 구분',()=>{
 const d=priced();Object.assign(d.scope[4],{enabled:true,material:null,labor:null});Object.assign(d.scope[5],{enabled:true,material:0,labor:0});Object.assign(d.scope[6],{enabled:true,material:40000,labor:null});
 const items=M.toAppItems(M.calculate(d),d),unknown=items.find(i=>i.name==='양변기');
 assert.equal(unknown.price,0);assert.equal(unknown.pending,true);assert.equal(unknown.spec,'자재+시공 · 단가 확인 필요');
 assert(!items.some(i=>i.name==='양변기 시공'));assert.equal(items.length,9);
 assert(items.filter(i=>i.name.startsWith('세면대·하부장')).every(i=>i.price===0&&!i.pending&&!i.spec.includes('단가 확인 필요')));
 assert.equal(items.find(i=>i.name==='세면 수전 시공').pending,true);assert.equal(items.filter(i=>i.pending).length,2);
});

test('앱 미리 채우기는 빈칸만, 0원·기존 입력과 원본 상태 보존',()=>{
 const d=M.defaults();d.project='기존 현장';d.customer='기존 고객';d.place='기존 주소';d.wall.price=0;d.wall.labor='1250';d.scope[0].material=-1;
 const payload=prefill({'욕실 벽 타일(박스)':90000,'욕실 벽 타일 시공(㎡)':30000,'욕실 바닥 타일(박스)':200,'줄눈재':0,'기존 욕실 철거':50000});
 const before=clone(d),payloadBefore=clone(payload),filled=M.hjBathApplyPrefill(d,payload,NOW);
 assert.equal(filled.count,2);assert.equal(filled.data.wall.price,0);assert.equal(filled.data.wall.labor,1250);
 assert.equal(filled.data.project,'기존 현장');assert.equal(filled.data.customer,'기존 고객');assert.equal(filled.data.place,'기존 주소');assert.equal(filled.data.scope[0].material,-1);
 assert.equal(filled.data.floor.price,200);assert.equal(filled.data.consumables[1].price,0);assert.deepEqual(d,before);assert.deepEqual(payload,payloadBefore);
});

test('미리 채운 공급가는 기존 VAT 기준에 맞추며 잘못된 단가와 비표준명 차단',()=>{
 const d=M.defaults();d.vat='inclusive';
 const payload=prefill({'욕실 벽 타일(박스)':200,'욕실 벽 타일 시공(㎡)':true,'욕실 바닥 타일(박스) ':900,'욕실 바닥 타일 시공(㎡)':'300','타일 접착제':100000000,'줄눈재':-1,'양변기':1.5});
 const filled=M.hjBathApplyPrefill(d,payload,NOW);assert.equal(filled.count,1);assert.equal(filled.data.wall.price,220);assert.equal(filled.data.vat,'inclusive');
 assert.equal(filled.data.floor.price,null);assert.equal(filled.data.wall.labor,null);assert.equal(filled.data.consumables[0].price,null);
 assert.equal(filled.data.project,payload.project);assert.equal(filled.data.customer,payload.customer.name);assert.equal(filled.data.place,payload.customer.addr);
 const inherited=prefill(Object.create({'욕실 벽 타일(박스)':123}));assert.equal(M.hjBathApplyPrefill(M.defaults(),inherited,NOW).count,0);
});

test('미리 채우기 10분 경계·미래·잘못된 형식 검증',()=>{
 const d=M.defaults(),p=prefill();assert(M.hjBathApplyPrefill(d,p,NOW+600000));
 assert.equal(M.hjBathApplyPrefill(d,p,NOW+600001),null);assert.equal(M.hjBathApplyPrefill(d,p,NOW-1),null);
 for(const at of ['',null,0,'2026-10-16','invalid'])assert.equal(M.hjBathApplyPrefill(d,{...p,at},NOW),null);
 for(const partial of [{customer:null},{customer:[]},{customer:{name:true,addr:''}},{prices:[]},{project:4}])assert.equal(M.hjBathApplyPrefill(d,{...p,...partial},NOW),null);
 assert.equal(M.hjBathApplyPrefill(d,p,NaN),null);
});

test('핸드오프는 6줄 메모·조건·알려진 합계를 복사하고 상담/결과 불변',()=>{
 const d=priced();Object.assign(d,{project:'합성 현장',customer:'합성 고객',place:'합성 주소',method:'overlay',days:{work:4,unusable:3,start:'다음 달 협의'}});d.scope[4].enabled=true;
 const r=M.calculate(d),before=clone(d),resultBefore=clone(r),payload=M.hjBathHandoff(d,NOW);
 assert.equal(payload.version,1);assert.equal(payload.at,new Date(NOW).toISOString());assert.deepEqual(payload.customer,{name:'합성 고객',addr:'합성 주소'});
 assert.equal(payload.place,'합성 주소');assert.equal(payload.total,r.total);assert.equal(payload.method,'overlay');assert.deepEqual(payload.days,d.days);
 assert.equal(payload.memo.split('\n').length,6);assert.match(payload.memo,/단가 확인 필요 1건/);assert.match(payload.memo,/덧방/);assert.match(payload.memo,/욕실 사용 불가 3일/);
 M.toAppItems(r,d);assert.deepEqual(d,before);assert.deepEqual(r,resultBefore);payload.days.work=60;assert.equal(d.days.work,4);
});

test('고객 CSV에 주소·방식·기간을 넣고 수식 주입 방어 유지',()=>{
 const d=priced();d.place='=합성주소';d.method='overlay';d.days={work:0,unusable:null,start:'=합성시기'};
 const csv=M.toCSV(M.calculate(d));assert(csv.includes('"주소","\'=합성주소"'));assert(csv.includes('"시공 방식","덧방(기존 타일 위 시공)"'));
 assert(csv.includes('"예상 공사 기간","0일"'));assert(csv.includes('"욕실 사용 불가 기간","상담 시 안내"'));assert(csv.includes('"시작 가능 시기","\'=합성시기"'));
});

test('포함 단가 정수 환산 차이를 조정행으로 감추지 않고 원래 합계를 전달',()=>{
 const d=priced();d.vat='inclusive';for(const k of ['wall','floor'])Object.assign(d[k],{price:0,labor:0});Object.assign(d.scope[4],{enabled:true,qty:100,material:100,labor:0});
 const payload=M.hjBathHandoff(d,NOW),item=payload.items.find(i=>i.name==='양변기');
 assert.equal(item.qty,100);assert.equal(item.price,100);assert.equal(payload.total,10000);assert.equal(appTotal(payload.items,true),10010);assert.equal(payload.items.length,6);
});

test('면적 소수2자리 매핑도 차이를 보존하고 수량0 반올림은 전송 보류',()=>{
 const d=priced();for(const k of ['wall','floor'])Object.assign(d[k],{price:0,labor:0});d.size.width=180.1;d.wall.labor=10000;
 const payload=M.hjBathHandoff(d,NOW),wall=payload.items.find(i=>i.name==='욕실 벽 타일 시공(㎡)');
 assert.equal(wall.qty,16.26);assert.equal(wall.price,10000);assert.equal(payload.total,178911);assert.equal(appTotal(payload.items,false),178860);
 const tiny=priced();tiny.size.extraOpening=16.259;assert.equal(M.toAppItems(M.calculate(tiny),tiny)[1].qty,0);assert.throws(()=>M.hjBathHandoff(tiny,NOW),/수량이 0/);
});

console.log('PASS bathlink-v411 unit '+passed+'/12');
