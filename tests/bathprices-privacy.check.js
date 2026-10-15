/* 공개 단가표에는 표준 품목과 숫자 집계만 허용한다. 원본 견적 메타데이터는 배포하지 않는다. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {STANDARD_ITEMS}=await import('../scripts/bathroom-defaults-from-quotes.mjs');
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../bathroom-defaults.json'),'utf8'));
 assert.deepEqual(Object.keys(data).sort(),['generatedAt','items','source','vat']);
 assert.match(data.generatedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);assert(Number.isFinite(Date.parse(data.generatedAt)));
 assert.match(data.source,/^과거 견적 \d+건\((?:기간 미확인|\d{4}-\d{2}~\d{4}-\d{2})\)$/);
 assert.equal(data.vat,'exclusive');assert(data.items&&typeof data.items==='object'&&!Array.isArray(data.items));
 for(const [key,value] of Object.entries(data.items)){
  assert(STANDARD_ITEMS.includes(key),'only fixed standard item labels are public');assert(value&&typeof value==='object'&&!Array.isArray(value));
  assert(Object.keys(value).every(k=>['price','n','min','max','weak'].includes(k)),'no free text or source identifiers');
  assert(Number.isInteger(value.n)&&value.n>0);assert(Number.isInteger(value.price)&&value.price>=0&&value.price<=1e8);
  assert(Number.isFinite(value.min)&&value.min>=0);assert(Number.isFinite(value.max)&&value.max>=value.min&&value.max<=1e8);
  assert.equal(value.weak===true,value.n<3);assert(!Object.hasOwn(value,'weak')||typeof value.weak==='boolean');
 }
 console.log('PASS bathroom-defaults public schema: standard labels and numeric aggregates only');
})().catch(e=>{console.error(e);process.exit(1);});
