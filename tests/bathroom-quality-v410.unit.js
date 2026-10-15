/* 독립된 정수 분수 계산으로 수량 올림과 원 단위 반올림을 대조한다. */
'use strict';
const assert=require('node:assert/strict'),M=require('../bathroom-model.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const ceil=(n,d)=>Number((n+d-1n)/d),won=(n,d)=>Number((n*2n+d)/(d*2n));
function priced(){const d=M.defaults();Object.assign(d.wall,{price:28000,labor:38000});Object.assign(d.floor,{price:26000,labor:45000});return d;}
test('정확히 반 원인 시공비를 1원 적게 계산하지 않음',()=>{
 for(const [width,depth,price,expected] of [[52.2,162.5,38000,32234],[55,64.6,45000,15989],[55,91,45000,22523],[56.4,52.5,45000,13325]]){
  const d=priced();Object.assign(d.size,{width,depth,doorWidth:0,doorHeight:0});d.floor.labor=price;
  assert.equal(M.calculate(d).rows.find(x=>x.id==='floorWork').amount,expected,'바닥 '+width+'×'+depth);
 }
});
test('올림 경계 바로 위의 면적은 작은 차이도 필요한 한 장으로 계산',()=>{
 const d=priced();Object.assign(d.size,{width:100.0000000001,depth:100,doorWidth:0,doorHeight:0});Object.assign(d.floor,{width:1000,height:1000,pack:1,waste:0});
 assert.equal(M.calculate(d).floor.need,2);
 Object.assign(d.size,{width:100,depth:100});assert.equal(M.calculate(d).floor.need,1);
});
test('벽·바닥·부자재·선택 공사·부가세 2500조합을 독립 정수 계산과 대조',()=>{
 for(let i=0;i<2500;i++){
  const d=priced(),w=1200+i*37%2800,h=1300+i*53%2700,z=2200+i*11%800,dw=600+i%300,dh=1900+i%200,opening=i%51;
  Object.assign(d.size,{width:w/10,depth:h/10,height:z/10,doorWidth:dw/10,doorHeight:dh/10,extraOpening:opening/100});
  const area={floor:BigInt(w*h),wall:BigInt(2*(w+h)*z-dw*dh-opening*10000)};
  const expected={material:0,labor:0};
  for(const [j,k] of ['wall','floor'].entries()){
   Object.assign(d[k],{width:[300,600,251,400][(i+j)%4],height:[600,300,1000,250][(i*3+j)%4],pack:1+(i+j)%16,waste:(i*7+j)%501/10,price:20000+i*17,labor:30000+i*13});
   const t=d[k],need=ceil(area[k]*BigInt(1000+Math.round(t.waste*10)),BigInt(t.width*t.height)*1000n),boxes=ceil(BigInt(need),BigInt(t.pack));
   expected[k]={need,boxes,buy:boxes*t.pack};expected.material+=boxes*t.price;expected.labor+=won(area[k]*BigInt(t.labor),1000000n);
  }
  const usage=10+i%491,pack=100+i%1901,c=d.consumables[0];Object.assign(c,{enabled:true,usage:usage/100,pack:pack/100,price:15000+i});
  const packs=ceil((area.wall+area.floor)*BigInt(usage),1000000n*BigInt(pack));expected.material+=packs*c.price;
  const s=d.scope[4];Object.assign(s,{enabled:true,qty:1+i%3,material:120000+i,labor:50000+i});expected.material+=s.qty*s.material;expected.labor+=s.qty*s.labor;
  d.vat=i%2?'inclusive':'exclusive';const before=JSON.stringify(d),r=M.calculate(d),entered=expected.material+expected.labor;
  for(const k of ['wall','floor'])for(const key of ['need','boxes','buy'])assert.equal(r[k][key],expected[k][key],i+' '+k+'.'+key);
  assert.equal(r.consumables[0].packs,packs,i+' consumables');assert.equal(r.material,expected.material,i+' material');assert.equal(r.labor,expected.labor,i+' labor');
  assert.equal(r.total,d.vat==='inclusive'?entered:entered+won(BigInt(entered),10n),i+' total');
  assert.equal(r.supply,d.vat==='inclusive'?won(BigInt(entered)*10n,11n):entered,i+' supply');
  assert.equal(r.supply+r.vat,r.total);assert.equal(JSON.stringify(d),before,'계산은 입력을 바꾸지 않음');assert.doesNotThrow(()=>JSON.stringify(r),'계산 결과에 BigInt를 저장하지 않음');
 }
});
test('지수 표기·극소 공제·최대 입력도 유한한 숫자로 반환',()=>{
 const d=priced();d.size.extraOpening=Number.MIN_VALUE;d.floor.waste=1e-7;
 const r=M.calculate(d);for(const value of [r.wall.area,r.floor.area,r.total,r.material,r.labor,r.floor.each])assert(Number.isFinite(value));
 Object.assign(d.size,{width:2000,depth:2000,height:600,extraOpening:0,doorWidth:0,doorHeight:0});d.wall.price=0;d.wall.labor=0;d.floor.price=0;d.floor.labor=0;
 Object.assign(d.floor,{width:10,height:10,pack:1,waste:50});const max=M.calculate(d);assert.equal(max.floor.need,6000000);assert.equal(max.total,0);assert.doesNotThrow(()=>JSON.stringify(max));
});
console.log('bathroom-quality unit '+passed+'/'+passed+' (2500 independent calculation fixtures)');
