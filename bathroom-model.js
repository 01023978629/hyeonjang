/* v410 고객이 수량과 판매가격의 근거를 확인하도록 계산을 화면·출력에서 공유한다.
   기존 현장 앱 데이터와 원가는 읽지 않는다. 단가 null은 무료(0원)와 다르다. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HJBath=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const styles=[
    {id:'warm',name:'웜 베이지',sub:'따뜻한 돌의 질감과 우드 포인트',image:'bathroom-warm.webp'},
    {id:'white',name:'클린 화이트',sub:'밝고 단정한, 오래 보아도 편안한 욕실',image:'bathroom-white.webp'},
    {id:'gray',name:'모던 그레이',sub:'차분한 회색으로 정돈한 공간',image:'bathroom-gray.webp'}
  ];
  const scope=[
    ['demolition','기존 욕실 철거','철거·바탕','식',1,'기존 타일·기구 철거. 폐기물 운반은 별도 행입니다.'],
    ['waste','폐기물 운반·처리','철거·바탕','식',1,'반출 동선과 폐기물 양을 현장에서 확인합니다.'],
    ['waterproof','방수·바탕 보수','설비·방수','식',1,'방수 범위·제품·시공 방식은 실측 후 확정합니다.'],
    ['plumbing','급배수 배관 보수','설비·방수','식',1,'배관 이동·숨은 누수는 현장 확인 후 별도 협의합니다.'],
    ['toilet','양변기','기구·마감','개',1,'제품 모델과 배수 위치를 확인합니다.'],
    ['basin','세면대·하부장','기구·마감','개',1,'세면대와 하부장 포함 범위를 적어 주세요.'],
    ['faucet','세면 수전','기구·마감','개',1,'수전 모델과 기존 연결 규격을 확인합니다.'],
    ['shower','샤워 수전','기구·마감','개',1,'샤워 수전·헤드 포함 여부를 확인합니다.'],
    ['mirror','거울·수납장','기구·마감','개',1,'거울 또는 수납장 중 선택한 제품 기준입니다.'],
    ['ceiling','천장 마감','기구·마감','식',1,'천장 재료와 점검구 포함 범위를 확인합니다.'],
    ['fan','환풍기','기구·마감','개',1,'제품 교체 기준. 배선·덕트 변경은 별도 협의합니다.'],
    ['screen','샤워 파티션','기구·마감','개',1,'크기·유리·고정 방식에 따라 금액이 달라집니다.'],
    ['finish','실리콘·마감 청소','기구·마감','식',1,'실리콘 마감과 공사 범위 내 정리 기준입니다.']
  ];
  const unitPriceLabel=unit=>unit==='식'?'1식(일괄) 가격':unit+'당 가격';
  const clone=v=>JSON.parse(JSON.stringify(v));
  function defaults(){return {version:1,style:'warm',project:'',customer:'',date:'',request:'',exclusions:'배관 위치 변경, 숨은 누수·바탕 추가 보수, 문·문틀 교체, 양중·주차 비용은 현장 확인 후 별도 협의합니다.',vat:'exclusive',priceStatus:'pending',
    size:{width:180,depth:210,height:230,doorWidth:80,doorHeight:210,extraOpening:0},
    wall:{width:300,height:600,pack:8,waste:10,price:null,labor:null},
    floor:{width:300,height:300,pack:16,waste:10,price:null,labor:null},
    consumables:[{id:'adhesive',name:'타일 접착제',enabled:false,usage:4,pack:20,price:null},{id:'grout',name:'줄눈재',enabled:false,usage:0.3,pack:2,price:null}],
    scope:scope.map(([id,name,group,unit,qty,note])=>({id,name,group,unit,qty,note,enabled:false,material:null,labor:null,model:''})),priceSources:{}};}
  /* 표준명은 앱의 저장 단가와 공개 집계가 같은 가격 칸을 가리키는 계약이다. */
  function priceTargets(d){
    return [{name:'욕실 벽 타일(박스)',path:'wall.price',rowId:'wallTile'},{name:'욕실 벽 타일 시공(㎡)',path:'wall.labor',rowId:'wallWork'},
      {name:'욕실 바닥 타일(박스)',path:'floor.price',rowId:'floorTile'},{name:'욕실 바닥 타일 시공(㎡)',path:'floor.labor',rowId:'floorWork'},
      ...d.consumables.map((c,i)=>({name:c.name,path:'consumables.'+i+'.price',rowId:c.id})),
      ...d.scope.flatMap((s,i)=>[{name:s.name,path:'scope.'+i+'.material',rowId:s.id+'Mat'},{name:s.name+' 시공',path:'scope.'+i+'.labor',rowId:s.id+'Work'}])];
  }
  const priceAt=(d,path)=>path.split('.').reduce((o,k)=>o[k],d);
  const validUnitPrice=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=100000000;
  function sourcePrice(s,vat){return vat==='inclusive'?Math.round(s.supplyPrice*1.1):s.supplyPrice;}
  function estimateApplicable(d,path){
    const base=defaults(),parts=path.split('.');
    if(parts[0]==='wall'||parts[0]==='floor'){const k=parts[0];return Number(d[k].width)===base[k].width&&Number(d[k].height)===base[k].height&&(parts[1]!=='price'||Number(d[k].pack)===base[k].pack);}
    if(parts[0]==='consumables')return Number(d.consumables[parts[1]].pack)===base.consumables[parts[1]].pack;
    return true;
  }
  function sourceLabel(s){return s.kind==='estimate'?'추정(과거 '+s.n+'건)'+(s.weak?' · 근거 적음':''):'앱 저장 단가';}
  function sourceDescription(s){return sourceLabel(s)+' · 원천 공급가 '+s.supplyPrice.toLocaleString('ko-KR')+'원'+(s.kind==='estimate'?' · 과거 범위 '+s.min.toLocaleString('ko-KR')+'~'+s.max.toLocaleString('ko-KR')+'원':'');}
  function normalizedSources(raw,d){
    const out={};if(raw===undefined)return out;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('단가 출처를 확인해 주세요.');
    for(const t of priceTargets(d)){
      if(!Object.prototype.hasOwnProperty.call(raw,t.name))continue;
      const s=raw[t.name];
      if(!s||typeof s!=='object'||Array.isArray(s)||!['app','estimate'].includes(s.kind)||!validUnitPrice(s.supplyPrice))throw Error('단가 출처를 확인해 주세요.');
      const meta={kind:s.kind,supplyPrice:s.supplyPrice};
      if(s.kind==='estimate'){
        if(!Number.isSafeInteger(s.n)||s.n<1||!validUnitPrice(s.min)||!validUnitPrice(s.max)||s.min>s.max||!estimateApplicable(d,t.path))throw Error('추정 단가 근거와 규격을 확인해 주세요.');
        Object.assign(meta,{n:s.n,min:s.min,max:s.max,weak:s.n<3||s.weak===true,generatedAt:typeof s.generatedAt==='string'&&Number.isFinite(Date.parse(s.generatedAt))?s.generatedAt.slice(0,40):''});
      }
      const value=priceAt(d,t.path);
      if(value===null||value===undefined||String(value).trim()===''||Number(value)!==sourcePrice(meta,d.vat)||!validUnitPrice(sourcePrice(meta,d.vat)))throw Error('단가와 저장된 출처가 달라 초안을 읽을 수 없습니다.');
      out[t.name]=meta;
    }
    return out;
  }
  const round=(n,d=2)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
  /* v410 소수 치수의 이진 오차로 반 원을 버리거나 필요한 타일 한 장을 빼지 않는다.
     입력 소수는 계산 중에만 정수 분수로 유지하고 저장/표시 결과는 기존 Number 형식이다. */
  function hjBathFraction(value){
    const [coefficient,exponent='0']=String(value).split('e'),scale=(coefficient.split('.')[1]||'').length-Number(exponent),n=BigInt(coefficient.replace('.',''));
    return scale<0?[n*10n**BigInt(-scale),1n]:[n,10n**BigInt(scale)];
  }
  const hjBathAdd=(a,b)=>[a[0]*b[1]+b[0]*a[1],a[1]*b[1]];
  const hjBathSub=(a,b)=>[a[0]*b[1]-b[0]*a[1],a[1]*b[1]];
  const hjBathMul=(a,b)=>[a[0]*b[0],a[1]*b[1]];
  const hjBathDiv=(a,b)=>[a[0]*b[1],a[1]*b[0]];
  const hjBathCeil=([n,d])=>Number((n+d-1n)/d);
  const hjBathWon=([n,d])=>Number((n*2n+d)/(d*2n));
  function hjBathValue([n,d]){
    if(n<0n)return -hjBathValue([-n,d]);
    // 큰 분모도 Infinity로 바꾸지 않고, 표시 정밀도보다 충분히 긴 소수로 돌려준다.
    return Number(String(n/d)+'.'+((n%d)*10n**30n/d).toString().padStart(30,'0'));
  }
  /* v410 숫자가 아닌 저장값을 0원/1원으로 바꾸지 않고, 미선택 입력은 재선택할 때 검증한다. */
  function hjBathNumericInput(v,label){if(v!==null&&v!==undefined&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error(label+'은 숫자로 입력해 주세요.');if(typeof v==='string'&&v.trim()!==''&&!Number.isFinite(Number(v)))throw Error(label+'은 숫자로 입력해 주세요.');}
  function number(v,label,min,max,integer=false){hjBathNumericInput(v,label);if(v===null||v===undefined||String(v).trim()==='')throw Error(label+'을 입력해 주세요.');const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(label+' 범위를 확인해 주세요 ('+min+'~'+max+').');return n;}
  function price(v,label){hjBathNumericInput(v,label);return v===null||v===undefined||String(v).trim()===''?null:number(v,label+' (원 단위 정수)',0,100000000,true);}
  function hjBathOptionalNumber(v,label,min,max,integer,enabled){hjBathNumericInput(v,label);return enabled?number(v,label,min,max,integer):v===undefined?null:v;}
  function hjBathOptionalPrice(v,label,enabled){hjBathNumericInput(v,label);return enabled?price(v,label):v===undefined?null:v;}
  function hjBathScopeValues(s,label,enabled){return {qty:hjBathOptionalNumber(s.qty,label+' 수량',1,100,true,enabled),material:hjBathOptionalPrice(s.material,label+' 자재 판매단가',enabled),labor:hjBathOptionalPrice(s.labor,label+' 시공 단가',enabled)};}
  function hjBathScopeAmount(s){const v=hjBathScopeValues(s,s.name,true);return v.material===null||v.labor===null?null:v.qty*(v.material+v.labor);}
  function text(v,max){if(typeof v!=='string')return '';return v.slice(0,max);}
  function normalize(raw){
    if(!raw||raw.version!==1)throw Error('이 상담 초안의 형식을 읽을 수 없습니다.');
    const d=defaults(),x=clone(d);
    x.style=styles.some(s=>s.id===raw.style)?raw.style:d.style;x.project=text(raw.project,100);x.customer=text(raw.customer,60);x.date=text(raw.date,10);x.request=text(raw.request,1000);x.exclusions=text(raw.exclusions,1000);
    if(!['exclusive','inclusive'].includes(raw.vat))throw Error('부가세 표시를 확인해 주세요.');x.vat=raw.vat;x.priceStatus=raw.priceStatus==='confirmed'?'confirmed':'pending';
    const z=raw.size||{};for(const k of ['width','depth'])x.size[k]=number(z[k],'욕실 '+(k==='width'?'가로':'세로')+'(cm)',50,2000);x.size.height=number(z.height,'벽 높이(cm)',50,600);
    x.size.doorWidth=number(z.doorWidth,'문 너비(cm)',0,500);x.size.doorHeight=number(z.doorHeight,'문 높이(cm)',0,600);x.size.extraOpening=number(z.extraOpening,'추가 공제 면적(㎡)',0,1000);
    for(const k of ['wall','floor']){const s=raw[k]||{},label=k==='wall'?'벽':'바닥';x[k]={width:number(s.width,label+' 타일 가로(mm)',10,3000),height:number(s.height,label+' 타일 세로(mm)',10,3000),pack:number(s.pack,label+' 타일 박스당 장수',1,1000,true),waste:number(s.waste,label+' 여유율(%)',0,50),price:price(s.price,label+' 타일 박스 판매단가'),labor:price(s.labor,label+' 타일 ㎡당 시공비')};}
    x.consumables=d.consumables.map(base=>{const s=Array.isArray(raw.consumables)&&raw.consumables.find(s=>s&&s.id===base.id);if(!s)throw Error('부자재 항목을 확인해 주세요.');const enabled=s.enabled===true;return {...base,enabled,usage:hjBathOptionalNumber(s.usage,base.name+' ㎡당 사용량(kg)',0.01,100,false,enabled),pack:hjBathOptionalNumber(s.pack,base.name+' 포장 용량(kg)',0.01,1000,false,enabled),price:hjBathOptionalPrice(s.price,base.name+' 포장 판매단가',enabled)};});
    x.scope=d.scope.map(base=>{const s=Array.isArray(raw.scope)&&raw.scope.find(s=>s&&s.id===base.id);if(!s)throw Error('공사 항목을 확인해 주세요.');return {...base,enabled:s.enabled===true,...hjBathScopeValues(s,base.name,s.enabled===true),model:text(s.model,140)};});
    x.priceSources=normalizedSources(raw.priceSources,x);
    return x;
  }
  function tile(areaFraction,t){
    const eachFraction=hjBathDiv(hjBathMul(hjBathFraction(t.width),hjBathFraction(t.height)),hjBathFraction(1000000)),base=hjBathDiv(areaFraction,eachFraction),withWaste=hjBathMul(base,hjBathDiv(hjBathAdd(hjBathFraction(100),hjBathFraction(t.waste)),hjBathFraction(100)));
    const need=hjBathCeil(withWaste),boxes=hjBathCeil(hjBathDiv(hjBathFraction(need),hjBathFraction(t.pack))),buy=boxes*t.pack;
    return {area:hjBathValue(areaFraction),each:hjBathValue(eachFraction),need,boxes,buy,spare:buy-hjBathCeil(base),packSurplus:buy-need,buyArea:round(hjBathValue(hjBathMul(hjBathFraction(buy),eachFraction)),4),waste:t.waste,pack:t.pack};
  }
  function calculate(raw){
    const d=normalize(raw),s=d.size,floorFraction=hjBathDiv(hjBathMul(hjBathFraction(s.width),hjBathFraction(s.depth)),hjBathFraction(10000));
    const grossFraction=hjBathDiv(hjBathMul(hjBathMul(hjBathFraction(2),hjBathAdd(hjBathFraction(s.width),hjBathFraction(s.depth))),hjBathFraction(s.height)),hjBathFraction(10000));
    const openingFraction=hjBathAdd(hjBathDiv(hjBathMul(hjBathFraction(s.doorWidth),hjBathFraction(s.doorHeight)),hjBathFraction(10000)),hjBathFraction(s.extraOpening)),wallFraction=hjBathSub(grossFraction,openingFraction),grossWall=hjBathValue(grossFraction),opening=hjBathValue(openingFraction);
    if(s.doorHeight>s.height)throw Error('문 높이가 벽 높이보다 큽니다.');if(s.doorWidth>Math.max(s.width,s.depth))throw Error('문 너비가 욕실의 한 벽보다 큽니다.');if(wallFraction[0]<=0n)throw Error('문·창 공제 면적은 전체 벽 면적보다 작아야 합니다.');
    const wall=tile(wallFraction,d.wall),floor=tile(floorFraction,d.floor),rows=[];
    function add(id,kind,name,qty,unit,unitPrice,basis,exactQty=hjBathFraction(qty)){rows.push({id,kind,name,qty,unit,price:unitPrice,amount:unitPrice===null?null:hjBathWon(hjBathMul(exactQty,hjBathFraction(unitPrice))),basis});}
    for(const [key,label,t] of [['wall','벽',wall],['floor','바닥',floor]]){add(key+'Tile','자재',label+' 타일',t.boxes,'박스',d[key].price,d[key].width+'×'+d[key].height+'mm · '+d[key].pack+'장/박스 · 실구매 '+t.buy+'장');add(key+'Work','시공',label+' 타일 시공',t.area,'㎡',d[key].labor,'순면적 기준 · 여유분/박스 잔량에는 시공비를 붙이지 않습니다.',key==='wall'?wallFraction:floorFraction);}
    const consumables=d.consumables.filter(c=>c.enabled).map(c=>{const areaFraction=hjBathAdd(wallFraction,floorFraction),kgFraction=hjBathMul(areaFraction,hjBathFraction(c.usage)),area=hjBathValue(areaFraction),kg=hjBathValue(kgFraction),packs=hjBathCeil(hjBathDiv(kgFraction,hjBathFraction(c.pack)));add(c.id,'자재',c.name,packs,'포장',c.price,round(area,6)+'㎡ × '+c.usage+'kg/㎡ ÷ '+c.pack+'kg/포장 (올림)');return {...c,area,kg,packs};});
    d.scope.filter(s=>s.enabled).forEach(s=>{const basis=unitPriceLabel(s.unit)+' · '+(s.model?s.model+' · ':'')+s.note;add(s.id+'Mat','자재',s.name,s.qty,s.unit,s.material,basis);add(s.id+'Work','시공',s.name,s.qty,s.unit,s.labor,basis);});
    for(const t of priceTargets(d)){const row=rows.find(r=>r.id===t.rowId),source=d.priceSources[t.name];if(row&&source)row.priceSource=source;}
    const estimatedRows=rows.filter(r=>r.priceSource?.kind==='estimate'),missing=rows.filter(r=>r.amount===null),material=rows.filter(r=>r.kind==='자재').reduce((n,r)=>n+(r.amount||0),0),labor=rows.filter(r=>r.kind==='시공').reduce((n,r)=>n+(r.amount||0),0),entered=material+labor;
    if(!Number.isSafeInteger(entered)||entered>1000000000)throw Error('합계가 너무 큽니다. 수량·단가를 다시 확인해 주세요.');
    const supply=d.vat==='inclusive'?Math.round(entered/1.1):entered,vat=d.vat==='inclusive'?entered-supply:Math.round(supply*0.1),total=supply+vat;
    return {data:d,grossWall,opening,wall,floor,consumables,rows,missing,estimatedRows,hasEstimates:estimatedRows.length>0,material,labor,supply,vat,total,complete:missing.length===0,excluded:d.scope.filter(s=>!s.enabled).map(s=>s.name).concat(d.consumables.filter(c=>!c.enabled).map(c=>c.name))};
  }
  function csvCell(value){let s=String(value==null?'':value);if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function toCSV(r){
    const d=r.data,lines=[['만물인테리어 욕실 상담용 견적·자재 계산서'],['현장',d.project],['고객',d.customer],['작성일',d.date],['상태',!r.complete?'단가 확인 필요':d.priceStatus==='confirmed'?'입력 판매단가 기준 · 실측 후 확정':'판매단가 확인 전 · 실측 후 확정'],['단가 기준',d.vat==='inclusive'?'입력단가 부가세 포함':'입력단가 부가세 별도'],['계산 기준','타일 자재비=구매 박스×박스 판매단가 / 타일 시공비=순면적×㎡당 단가'],['구분','품목','수량','단위','판매단가(원)','금액(원)','근거'],...r.rows.map(x=>[x.kind,x.name,x.qty,x.unit,x.price===null?'확인 필요':x.price,x.amount===null?'확인 필요':x.amount,x.basis]),['자재 합계',r.material],['시공 합계',r.labor],['공급가액',r.complete?r.supply:'미확정'],['부가세',r.complete?r.vat:'미확정'],['총액',r.complete?r.total:'미확정'],[],['타일','순면적(㎡)','여유율(%)','필요 장수','구매 박스','실구매 장수','박스 반올림 여분'],...['wall','floor'].map(k=>{const t=r[k];return [k==='wall'?'벽':'바닥',t.area,t.waste,t.need,t.boxes,t.buy,t.packSurplus];}),['미포함 품목',r.excluded.join(', ')||'없음'],['별도 협의',d.exclusions],['고객 요청',d.request],['안내','직사각형 욕실의 입력 치수 기준. 줄눈 폭·패턴·기둥·단차·현장 손실은 발주 전 확인합니다. 부자재 사용량은 제품 시방값으로 수정해야 합니다.']];
    if(r.rows.some(row=>row.priceSource)){const at=lines.findIndex(row=>row[0]==='구분');lines[at].push('단가 출처');r.rows.forEach((row,i)=>lines[at+i+1].push(row.priceSource?sourceDescription(row.priceSource):'직접 입력'));}
    if(r.hasEstimates){lines.find(row=>row[0]==='상태')[1]='추정 단가 포함 · 확정 금액 아님';lines.find(row=>row[0]==='총액')[0]='총액 (추정 단가 포함)';lines.push(['추정 단가 안내','단가는 과거 견적에서 추정한 값입니다. 고객에게 확정 금액으로 안내하지 마세요.']);}
    return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  return {styles,defaults,normalize,calculate,toCSV,round,unitPriceLabel,hjBathScopeAmount,priceTargets,validUnitPrice,sourcePrice,estimateApplicable,sourceLabel,sourceDescription};
});
