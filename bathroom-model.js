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
    ['finish','실리콘·마감 청소','기구·마감','식',1,'실리콘 마감과 공사 범위 내 정리 기준입니다.'],
    ['bathtubRemove','욕조 철거','추가 선택','식',1,'기존 욕조 철거 범위와 반출 동선을 확인합니다.'],
    ['bathtubInstall','욕조 설치','추가 선택','개',1,'욕조 제품·크기와 급배수 연결 범위를 확인합니다.'],
    ['bidet','비데','추가 선택','개',1,'제품 모델과 전원·급수 연결 상태를 확인합니다.'],
    ['shelf','젠다이·선반','추가 선택','식',1,'길이·마감 재료와 설치 위치를 확인합니다.'],
    ['door','욕실 문·문틀 교체','추가 선택','개',1,'문과 문틀의 재료·치수·교체 범위를 확인합니다.'],
    ['drain','유가(바닥 배수구) 교체','추가 선택','개',1,'배수구 규격과 배수 구배·연결 상태를 확인합니다.'],
    ['accessories','수건걸이·액세서리 세트','추가 선택','식',1,'세트에 포함할 제품과 설치 위치를 확인합니다.']
  ];
  const unitPriceLabel=unit=>unit==='식'?'1식(일괄) 가격':unit+'당 가격';
  const clone=v=>JSON.parse(JSON.stringify(v));
  function defaults(){return {version:2,style:'warm',project:'',customer:'',place:'',date:'',request:'',exclusions:'배관 위치 변경, 숨은 누수·바탕 추가 보수, 양중·주차 비용은 현장 확인 후 별도 협의합니다.',vat:'exclusive',priceStatus:'pending',method:'full',days:{work:null,unusable:null,start:''},
    size:{width:180,depth:210,height:230,doorWidth:80,doorHeight:210,extraOpening:0},
    wall:{width:300,height:600,pack:8,waste:10,price:null,labor:null},
    floor:{width:300,height:300,pack:16,waste:10,price:null,labor:null},
    consumables:[{id:'adhesive',name:'타일 접착제',enabled:false,usage:4,pack:20,price:null},{id:'grout',name:'줄눈재',enabled:false,usage:0.3,pack:2,price:null}],
    scope:scope.map(([id,name,group,unit,qty,note])=>({id,name,group,unit,qty,note,enabled:false,material:null,labor:null,model:''}))};}
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
    if(!raw||![1,2].includes(raw.version))throw Error('이 상담 초안의 형식을 읽을 수 없습니다.');
    const d=defaults(),x=clone(d);
    x.style=styles.some(s=>s.id===raw.style)?raw.style:d.style;x.project=text(raw.project,100);x.customer=text(raw.customer,60);x.date=text(raw.date,10);x.request=text(raw.request,1000);x.exclusions=text(raw.exclusions,1000);
    /* v411 이전 초안의 선택·수량·단가를 유지하며 새 안내 필드만 보탠다. */
    x.place=text(raw.place,240);
    if(raw.version===2){
      if(!['full','overlay'].includes(raw.method))throw Error('시공 방식을 확인해 주세요.');
      const days=raw.days;if(!days||typeof days!=='object'||Array.isArray(days))throw Error('공사 기간을 확인해 주세요.');
      x.method=raw.method;
      for(const key of ['work','unusable']){const v=days[key];hjBathNumericInput(v,'공사 기간');x.days[key]=v==null||String(v).trim()===''?null:number(v,'공사 기간(일)',0,60,true);}
      x.days.start=text(days.start,120);
    }
    if(!['exclusive','inclusive'].includes(raw.vat))throw Error('부가세 표시를 확인해 주세요.');x.vat=raw.vat;x.priceStatus=raw.priceStatus==='confirmed'?'confirmed':'pending';
    const z=raw.size||{};for(const k of ['width','depth'])x.size[k]=number(z[k],'욕실 '+(k==='width'?'가로':'세로')+'(cm)',50,2000);x.size.height=number(z.height,'벽 높이(cm)',50,600);
    x.size.doorWidth=number(z.doorWidth,'문 너비(cm)',0,500);x.size.doorHeight=number(z.doorHeight,'문 높이(cm)',0,600);x.size.extraOpening=number(z.extraOpening,'추가 공제 면적(㎡)',0,1000);
    for(const k of ['wall','floor']){const s=raw[k]||{},label=k==='wall'?'벽':'바닥';x[k]={width:number(s.width,label+' 타일 가로(mm)',10,3000),height:number(s.height,label+' 타일 세로(mm)',10,3000),pack:number(s.pack,label+' 타일 박스당 장수',1,1000,true),waste:number(s.waste,label+' 여유율(%)',0,50),price:price(s.price,label+' 타일 박스 판매단가'),labor:price(s.labor,label+' 타일 ㎡당 시공비')};}
    x.consumables=d.consumables.map(base=>{const s=Array.isArray(raw.consumables)&&raw.consumables.find(s=>s&&s.id===base.id);if(!s)throw Error('부자재 항목을 확인해 주세요.');const enabled=s.enabled===true;return {...base,enabled,usage:hjBathOptionalNumber(s.usage,base.name+' ㎡당 사용량(kg)',0.01,100,false,enabled),pack:hjBathOptionalNumber(s.pack,base.name+' 포장 용량(kg)',0.01,1000,false,enabled),price:hjBathOptionalPrice(s.price,base.name+' 포장 판매단가',enabled)};});
    x.scope=d.scope.map((base,index)=>{const s=Array.isArray(raw.scope)&&raw.scope.find(s=>s&&s.id===base.id);if(!s){if(raw.version===1&&index>=13)return {...base};throw Error('공사 항목을 확인해 주세요.');}return {...base,enabled:s.enabled===true,...hjBathScopeValues(s,base.name,s.enabled===true),model:text(s.model,140)};});
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
    const missing=rows.filter(r=>r.amount===null),material=rows.filter(r=>r.kind==='자재').reduce((n,r)=>n+(r.amount||0),0),labor=rows.filter(r=>r.kind==='시공').reduce((n,r)=>n+(r.amount||0),0),entered=material+labor;
    if(!Number.isSafeInteger(entered)||entered>1000000000)throw Error('합계가 너무 큽니다. 수량·단가를 다시 확인해 주세요.');
    const supply=d.vat==='inclusive'?Math.round(entered/1.1):entered,vat=d.vat==='inclusive'?entered-supply:Math.round(supply*0.1),total=supply+vat;
    return {data:d,grossWall,opening,wall,floor,consumables,rows,missing,material,labor,supply,vat,total,complete:missing.length===0,excluded:d.scope.filter(s=>!s.enabled).map(s=>s.name).concat(d.consumables.filter(c=>!c.enabled).map(c=>c.name))};
  }
  /* v411 표준 품목명을 양방향 연결에서 공유한다. 단가장은 공급가이며 읽기만 한다. */
  const appPriceNames=Object.freeze(['욕실 벽 타일(박스)','욕실 벽 타일 시공(㎡)','욕실 바닥 타일(박스)','욕실 바닥 타일 시공(㎡)','타일 접착제','줄눈재',...scope.flatMap(s=>[s[1],s[1]+' 시공'])]);
  const HJ_BATH_TRANSFER_AT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  function hjBathMethodLabel(method){return method==='overlay'?'덧방(기존 타일 위 시공)':'전체 철거 후 시공';}
  function hjBathDayText(value){return value===null?'상담 시 안내':value+'일';}
  function hjBathDaysText(days){return '예상 공사 '+hjBathDayText(days.work)+' · 욕실 사용 불가 '+hjBathDayText(days.unusable)+' · 시작 가능 시기 '+(days.start||'상담 시 안내');}
  function hjBathAppPriceFields(d){return [
    ['욕실 벽 타일(박스)',d.wall,'price'],['욕실 벽 타일 시공(㎡)',d.wall,'labor'],
    ['욕실 바닥 타일(박스)',d.floor,'price'],['욕실 바닥 타일 시공(㎡)',d.floor,'labor'],
    ...d.consumables.map(c=>[c.name,c,'price']),...d.scope.flatMap(s=>[[s.name,s,'material'],[s.name+' 시공',s,'labor']])
  ];}
  function hjBathApplyPrefill(raw,payload,now=Date.now()){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.at!=='string'||!HJ_BATH_TRANSFER_AT.test(payload.at))return null;
    const at=Date.parse(payload.at),age=now-at;
    if(!Number.isFinite(now)||!Number.isFinite(at)||age<0||age>600000)return null;
    const customer=payload.customer,prices=payload.prices;
    if(typeof payload.project!=='string'||!customer||typeof customer!=='object'||Array.isArray(customer)||typeof customer.name!=='string'||typeof customer.addr!=='string'||!prices||typeof prices!=='object'||Array.isArray(prices))return null;
    const d=normalize(raw);let count=0;
    if(!d.project.trim())d.project=text(payload.project,100);
    if(!d.customer.trim())d.customer=text(customer.name,60);
    if(!d.place.trim())d.place=text(customer.addr,240);
    hjBathAppPriceFields(d).forEach(([name,target,key])=>{
      if(target[key]!==null&&String(target[key]).trim()!=='')return;
      if(!Object.prototype.hasOwnProperty.call(prices,name))return;
      const value=prices[name];if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>100000000)return;
      const converted=d.vat==='inclusive'?Math.round(value*1.1):value;
      if(!Number.isSafeInteger(converted)||converted>100000000)return;
      target[key]=converted;count++;
    });
    return {data:d,count,project:text(payload.project,100)};
  }
  /* v411 원래 VAT 기준 가격과 지정 수량을 그대로 전한다. 환산 오차를 숨기는 조정행은 만들지 않는다. */
  function hjBathToAppItems(result,data){
    const r=calculate(data||result&&result.data),d=r.data,items=[];
    const add=(name,spec,qty,value)=>items.push({name,spec:spec+(value===null?' · 단가 확인 필요':''),qty,price:value===null?0:value,pending:value===null});
    for(const [key,label] of [['wall','벽'],['floor','바닥']]){
      const t=r[key],p=d[key];
      add('욕실 '+label+' 타일(박스)',p.width+'×'+p.height+' · '+p.pack+'장/박스 · '+t.boxes+'박스 '+t.buy+'장(필요 '+t.need+'장)',t.boxes,p.price);
      add('욕실 '+label+' 타일 시공(㎡)','순면적 '+round(t.area,2)+'㎡',round(t.area,2),p.labor);
    }
    r.consumables.forEach(c=>add(c.name,c.packs+'포',c.packs,c.price));
    d.scope.filter(s=>s.enabled).forEach(s=>{
      if(s.material===null&&s.labor===null){add(s.name,'자재+시공'+(s.model?' · '+s.model:''),s.qty,null);return;}
      add(s.name,s.model||'자재',s.qty,s.material);
      add(s.name+' 시공',s.unit==='식'?'1식':'개당',s.qty,s.labor);
    });
    return items;
  }
  function hjBathHandoff(raw,now=Date.now()){
    const r=calculate(raw),d=r.data,items=hjBathToAppItems(r,d),pending=items.filter(i=>i.pending).length;
    if(items.some(item=>item.qty<=0))throw Error('앱 견적 수량이 0으로 반올림됩니다. 실측 면적을 확인해 주세요.');
    const short=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,240);
    const memo=[
      '치수 '+d.size.width+'×'+d.size.depth+'cm · 높이 '+d.size.height+'cm · 벽 '+round(r.wall.area,6)+'㎡ / 바닥 '+round(r.floor.area,6)+'㎡',
      '타일 벽 '+r.wall.need+'장 필요 → '+r.wall.boxes+'박스 '+r.wall.buy+'장 / 바닥 '+r.floor.need+'장 필요 → '+r.floor.boxes+'박스 '+r.floor.buy+'장',
      '시공 방식: '+hjBathMethodLabel(d.method),
      hjBathDaysText(d.days),
      '미포함: '+(r.excluded.join(', ')||'없음')+' · 별도 협의: '+(short(d.exclusions)||'상담 시 안내'),
      '고객 요청: '+(short(d.request)||'상담 시 안내')+' · 단가 확인 필요 '+pending+'건'
    ].join('\n');
    return {at:new Date(now).toISOString(),version:1,project:d.project,customer:{name:d.customer,addr:d.place},place:d.place,vat:d.vat,method:d.method,days:clone(d.days),items,memo,total:r.total};
  }
  function csvCell(value){let s=String(value==null?'':value);if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function toCSV(r){
    const d=r.data,lines=[['만물인테리어 욕실 상담용 견적·자재 계산서'],['현장',d.project],['고객',d.customer],['작성일',d.date],['상태',!r.complete?'단가 확인 필요':d.priceStatus==='confirmed'?'입력 판매단가 기준 · 실측 후 확정':'판매단가 확인 전 · 실측 후 확정'],['단가 기준',d.vat==='inclusive'?'입력단가 부가세 포함':'입력단가 부가세 별도'],['계산 기준','타일 자재비=구매 박스×박스 판매단가 / 타일 시공비=순면적×㎡당 단가'],['구분','품목','수량','단위','판매단가(원)','금액(원)','근거'],...r.rows.map(x=>[x.kind,x.name,x.qty,x.unit,x.price===null?'확인 필요':x.price,x.amount===null?'확인 필요':x.amount,x.basis]),['자재 합계',r.material],['시공 합계',r.labor],['공급가액',r.complete?r.supply:'미확정'],['부가세',r.complete?r.vat:'미확정'],['총액',r.complete?r.total:'미확정'],[],['타일','순면적(㎡)','여유율(%)','필요 장수','구매 박스','실구매 장수','박스 반올림 여분'],...['wall','floor'].map(k=>{const t=r[k];return [k==='wall'?'벽':'바닥',t.area,t.waste,t.need,t.boxes,t.buy,t.packSurplus];}),['미포함 품목',r.excluded.join(', ')||'없음'],['별도 협의',d.exclusions],['고객 요청',d.request],['안내','직사각형 욕실의 입력 치수 기준. 줄눈 폭·패턴·기둥·단차·현장 손실은 발주 전 확인합니다. 부자재 사용량은 제품 시방값으로 수정해야 합니다.']];
    /* v411 새 상담 조건도 고객용 CSV에 같은 값으로 남긴다. */
    lines.splice(4,0,['주소',d.place],['시공 방식',hjBathMethodLabel(d.method)],['예상 공사 기간',hjBathDayText(d.days.work)],['욕실 사용 불가 기간',hjBathDayText(d.days.unusable)],['시작 가능 시기',d.days.start||'상담 시 안내']);
    return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  return {styles,defaults,normalize,calculate,toCSV,round,unitPriceLabel,hjBathScopeAmount,appPriceNames,toAppItems:hjBathToAppItems,hjBathApplyPrefill,hjBathHandoff,hjBathMethodLabel,hjBathDaysText};
});
