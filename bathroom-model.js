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
    scope:scope.map(([id,name,group,unit,qty,note])=>({id,name,group,unit,qty,note,enabled:false,material:null,labor:null,model:''}))};}
  const round=(n,d=2)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
  const ceil=n=>Math.ceil(n-1e-10);
  function number(v,label,min,max,integer=false){if(v===null||v===undefined||String(v).trim()==='')throw Error(label+'을 입력해 주세요.');const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(label+' 범위를 확인해 주세요 ('+min+'~'+max+').');return n;}
  function price(v,label){return v===null||v===undefined||String(v).trim()===''?null:number(v,label+' (원 단위 정수)',0,100000000,true);}
  function text(v,max){if(typeof v!=='string')return '';return v.slice(0,max);}
  function normalize(raw){
    if(!raw||raw.version!==1)throw Error('이 상담 초안의 형식을 읽을 수 없습니다.');
    const d=defaults(),x=clone(d);
    x.style=styles.some(s=>s.id===raw.style)?raw.style:d.style;x.project=text(raw.project,100);x.customer=text(raw.customer,60);x.date=text(raw.date,10);x.request=text(raw.request,1000);x.exclusions=text(raw.exclusions,1000);
    if(!['exclusive','inclusive'].includes(raw.vat))throw Error('부가세 표시를 확인해 주세요.');x.vat=raw.vat;x.priceStatus=raw.priceStatus==='confirmed'?'confirmed':'pending';
    const z=raw.size||{};for(const k of ['width','depth'])x.size[k]=number(z[k],'욕실 '+(k==='width'?'가로':'세로')+'(cm)',50,2000);x.size.height=number(z.height,'벽 높이(cm)',50,600);
    x.size.doorWidth=number(z.doorWidth,'문 너비(cm)',0,500);x.size.doorHeight=number(z.doorHeight,'문 높이(cm)',0,600);x.size.extraOpening=number(z.extraOpening,'추가 공제 면적(㎡)',0,1000);
    for(const k of ['wall','floor']){const s=raw[k]||{},label=k==='wall'?'벽':'바닥';x[k]={width:number(s.width,label+' 타일 가로(mm)',10,3000),height:number(s.height,label+' 타일 세로(mm)',10,3000),pack:number(s.pack,label+' 타일 박스당 장수',1,1000,true),waste:number(s.waste,label+' 여유율(%)',0,50),price:price(s.price,label+' 타일 박스 판매단가'),labor:price(s.labor,label+' 타일 ㎡당 시공비')};}
    x.consumables=d.consumables.map(base=>{const s=Array.isArray(raw.consumables)&&raw.consumables.find(s=>s&&s.id===base.id);if(!s)throw Error('부자재 항목을 확인해 주세요.');return {...base,enabled:s.enabled===true,usage:number(s.usage,base.name+' ㎡당 사용량(kg)',0.01,100),pack:number(s.pack,base.name+' 포장 용량(kg)',0.01,1000),price:price(s.price,base.name+' 포장 판매단가')};});
    x.scope=d.scope.map(base=>{const s=Array.isArray(raw.scope)&&raw.scope.find(s=>s&&s.id===base.id);if(!s)throw Error('공사 항목을 확인해 주세요.');return {...base,enabled:s.enabled===true,qty:number(s.qty,base.name+' 수량',1,100,true),material:price(s.material,base.name+' 자재 판매단가'),labor:price(s.labor,base.name+' 시공 단가'),model:text(s.model,140)};});
    return x;
  }
  function tile(area,t){const each=t.width*t.height/1000000,need=ceil(area*(1+t.waste/100)/each),boxes=ceil(need/t.pack),buy=boxes*t.pack;return {area,each,need,boxes,buy,spare:buy-ceil(area/each),packSurplus:buy-need,buyArea:round(buy*each,4),waste:t.waste,pack:t.pack};}
  function calculate(raw){
    const d=normalize(raw),s=d.size,floorArea=s.width*s.depth/10000,grossWall=2*(s.width+s.depth)*s.height/10000,opening=s.doorWidth*s.doorHeight/10000+s.extraOpening;
    if(s.doorHeight>s.height)throw Error('문 높이가 벽 높이보다 큽니다.');if(s.doorWidth>Math.max(s.width,s.depth))throw Error('문 너비가 욕실의 한 벽보다 큽니다.');if(opening>=grossWall)throw Error('문·창 공제 면적은 전체 벽 면적보다 작아야 합니다.');
    const wallArea=grossWall-opening,wall=tile(wallArea,d.wall),floor=tile(floorArea,d.floor),rows=[];
    function add(id,kind,name,qty,unit,unitPrice,basis){rows.push({id,kind,name,qty,unit,price:unitPrice,amount:unitPrice===null?null:Math.round(qty*unitPrice),basis});}
    for(const [key,label,t] of [['wall','벽',wall],['floor','바닥',floor]]){add(key+'Tile','자재',label+' 타일',t.boxes,'박스',d[key].price,d[key].width+'×'+d[key].height+'mm · '+d[key].pack+'장/박스 · 실구매 '+t.buy+'장');add(key+'Work','시공',label+' 타일 시공',t.area,'㎡',d[key].labor,'순면적 기준 · 여유분/박스 잔량에는 시공비를 붙이지 않습니다.');}
    const consumables=d.consumables.filter(c=>c.enabled).map(c=>{const area=wallArea+floorArea,kg=area*c.usage,packs=ceil(kg/c.pack);add(c.id,'자재',c.name,packs,'포장',c.price,round(area,6)+'㎡ × '+c.usage+'kg/㎡ ÷ '+c.pack+'kg/포장 (올림)');return {...c,area,kg,packs};});
    d.scope.filter(s=>s.enabled).forEach(s=>{const basis=unitPriceLabel(s.unit)+' · '+(s.model?s.model+' · ':'')+s.note;add(s.id+'Mat','자재',s.name,s.qty,s.unit,s.material,basis);add(s.id+'Work','시공',s.name,s.qty,s.unit,s.labor,basis);});
    const missing=rows.filter(r=>r.amount===null),material=rows.filter(r=>r.kind==='자재').reduce((n,r)=>n+(r.amount||0),0),labor=rows.filter(r=>r.kind==='시공').reduce((n,r)=>n+(r.amount||0),0),entered=material+labor;
    if(!Number.isSafeInteger(entered)||entered>1000000000)throw Error('합계가 너무 큽니다. 수량·단가를 다시 확인해 주세요.');
    const supply=d.vat==='inclusive'?Math.round(entered/1.1):entered,vat=d.vat==='inclusive'?entered-supply:Math.round(supply*0.1),total=supply+vat;
    return {data:d,grossWall,opening,wall,floor,consumables,rows,missing,material,labor,supply,vat,total,complete:missing.length===0,excluded:d.scope.filter(s=>!s.enabled).map(s=>s.name)};
  }
  function csvCell(value){let s=String(value==null?'':value);if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function toCSV(r){
    const d=r.data,lines=[['만물인테리어 욕실 상담용 견적·자재 계산서'],['현장',d.project],['고객',d.customer],['작성일',d.date],['상태',!r.complete?'단가 확인 필요':d.priceStatus==='confirmed'?'입력 판매단가 기준 · 실측 후 확정':'판매단가 확인 전 · 실측 후 확정'],['단가 기준',d.vat==='inclusive'?'입력단가 부가세 포함':'입력단가 부가세 별도'],['계산 기준','타일 자재비=구매 박스×박스 판매단가 / 타일 시공비=순면적×㎡당 단가'],['구분','품목','수량','단위','판매단가(원)','금액(원)','근거'],...r.rows.map(x=>[x.kind,x.name,x.qty,x.unit,x.price===null?'확인 필요':x.price,x.amount===null?'확인 필요':x.amount,x.basis]),['자재 합계',r.material],['시공 합계',r.labor],['공급가액',r.complete?r.supply:'미확정'],['부가세',r.complete?r.vat:'미확정'],['총액',r.complete?r.total:'미확정'],[],['타일','순면적(㎡)','여유율(%)','필요 장수','구매 박스','실구매 장수','박스 반올림 여분'],...['wall','floor'].map(k=>{const t=r[k];return [k==='wall'?'벽':'바닥',t.area,t.waste,t.need,t.boxes,t.buy,t.packSurplus];}),['미포함 품목',r.excluded.join(', ')],['별도 협의',d.exclusions],['고객 요청',d.request],['안내','직사각형 욕실의 입력 치수 기준. 줄눈 폭·패턴·기둥·단차·현장 손실은 발주 전 확인합니다. 부자재 사용량은 제품 시방값으로 수정해야 합니다.']];
    return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
  }
  return {styles,defaults,normalize,calculate,toCSV,round,unitPriceLabel};
});
