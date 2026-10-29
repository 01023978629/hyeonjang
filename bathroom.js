/* v410 선택한 항목만 고객용 계산서에 더한다. 저장·파일 만들기는 사용자가 누를 때만 한다. */
(function(){
  'use strict';
  const M=window.HJBath,$=id=>document.getElementById(id),KEY='hj_bathroom_consult_v1';
  const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const won=n=>n===null?'단가 확인 필요':Math.round(n).toLocaleString('ko-KR')+'원',fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:6});
  let data=M.defaults(),result=null,photo='',toastTimer=0,photoToken=0,photoPending=false,htmlExporting=false;
  let defaultsEpoch=0;
  const touchedPrices=new Set(),priceNotice='단가는 과거 견적에서 추정한 값입니다. 고객에게 확정 금액으로 안내하지 마세요.';
  data.date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  function get(path){return path.split('.').reduce((o,k)=>o[k],data);}
  function set(path,value){const parts=path.split('.'),key=parts.pop();parts.reduce((o,k)=>o[k],data)[key]=value;}
  const blankPrice=v=>v===null||v===undefined||typeof v==='string'&&v.trim()==='';
  function hjBathForgetPrice(path,clear=false){
    const target=M.priceTargets(data).find(t=>t.path===path);if(!target)return;
    touchedPrices.add(path);if(data.priceSources)delete data.priceSources[target.name];
    if(clear){set(path,null);const el=document.querySelector('[data-path="'+path+'"]');if(el)el.value='';}
  }
  function hjBathSourceHTML(source,path){
    return '<small class="price-source" data-price-source="'+source.kind+'"'+(path?' data-source-path="'+escape(path)+'"':'')+'>'+escape(M.sourceDescription(source))+'</small>';
  }
  function hjBathPriceBadges(){
    document.querySelectorAll('[data-source-path]').forEach(el=>el.remove());
    document.querySelectorAll('.has-price-source').forEach(el=>el.classList.remove('has-price-source'));
    for(const t of M.priceTargets(data)){const source=data.priceSources?.[t.name],el=document.querySelector('[data-path="'+t.path+'"]');if(source&&el){el.parentElement.classList.add('has-price-source');el.insertAdjacentHTML('afterend',hjBathSourceHTML(source,t.path));}}
  }
  function hjBathApplySource(t,source){
    if(!blankPrice(get(t.path))||touchedPrices.has(t.path))return false;
    const value=M.sourcePrice(source,data.vat);if(!M.validUnitPrice(value))return false;
    set(t.path,value);data.priceSources[t.name]=source;const el=document.querySelector('[data-path="'+t.path+'"]');if(el)el.value=value;return true;
  }
  async function hjBathLoadDefaults(){
    const owner=data,epoch=defaultsEpoch,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('bathroom-defaults.json',{credentials:'omit',signal:controller.signal});if(!response.ok)return;
      const table=await response.json();
      if(owner!==data||epoch!==defaultsEpoch||!table||table.vat!=='exclusive'||!table.items||typeof table.items!=='object'||Array.isArray(table.items))return;
      let count=0;
      for(const t of M.priceTargets(data)){
        const row=Object.prototype.hasOwnProperty.call(table.items,t.name)?table.items[t.name]:null;
        if(!row||typeof row!=='object'||Array.isArray(row)||!M.validUnitPrice(row.price)||!Number.isSafeInteger(row.n)||row.n<1||!M.validUnitPrice(row.min)||!M.validUnitPrice(row.max)||row.min>row.max||!M.estimateApplicable(data,t.path))continue;
        const source={kind:'estimate',supplyPrice:row.price,n:row.n,min:row.min,max:row.max,weak:row.n<3||row.weak===true,generatedAt:typeof table.generatedAt==='string'&&Number.isFinite(Date.parse(table.generatedAt))?table.generatedAt.slice(0,40):''};
        if(hjBathApplySource(t,source))count++;
      }
      if(count)update();
    }catch(_){}finally{clearTimeout(timer);document.documentElement.dataset.bathPricesReady='true';}
  }
  function hjBathRebaseSourcePrices(){
    for(const t of M.priceTargets(data)){const source=data.priceSources?.[t.name];if(!source)continue;const value=M.sourcePrice(source,data.vat);if(!M.validUnitPrice(value)){hjBathForgetPrice(t.path,true);continue;}set(t.path,value);const el=document.querySelector('[data-path="'+t.path+'"]');if(el)el.value=value;}
  }
  function hjBathClearProductSources(path){
    const tile=/^(wall|floor)\.(width|height|pack)$/.exec(path),consumable=/^consumables\.(\d+)\.pack$/.exec(path);
    if(tile){const k=tile[1];hjBathForgetPrice(k+'.price',true);if(tile[2]!=='pack'){const t=M.priceTargets(data).find(t=>t.path===k+'.labor');if(data.priceSources?.[t.name])hjBathForgetPrice(k+'.labor',true);else touchedPrices.add(k+'.labor');}}
    if(consumable){const p='consumables.'+consumable[1]+'.price',t=M.priceTargets(data).find(t=>t.path===p);if(data.priceSources?.[t.name])hjBathForgetPrice(p,true);else touchedPrices.add(p);}
  }
  function notify(message){clearTimeout(toastTimer);$('status').textContent=message;$('status').hidden=false;toastTimer=setTimeout(()=>$('status').hidden=true,5000);}
  /* v411 앱이 명시적으로 보낸 일회성 상담 정보만 읽는다. 기존 초안은 자동 복원하지 않는다. */
  function hjBathReadPrefill(){
    let raw;
    try{raw=localStorage.getItem('hj_bath_prefill');if(!raw)return;localStorage.removeItem('hj_bath_prefill');}catch(_){return;}
    try{
      const applied=M.hjBathApplyPrefill(data,JSON.parse(raw));if(!applied)return;
      data=applied.data;$('appPrefillNotice').textContent='앱에서 가져옴: '+(applied.project||'현장 미지정')+' · 단가 '+applied.count+'개';$('appPrefillNotice').hidden=false;
      if(applied.count){$('pricePrefillNotice').textContent='앱에서 가져온 저장 단가 '+applied.count+'개를 우선 적용했습니다. 추정 단가는 남은 빈칸에만 채웁니다.';$('pricePrefillNotice').hidden=false;}
    }catch(_){}
  }
  function hjBathSendToApp(){
    if(!result){notify('입력 오류를 먼저 확인해 주세요.');return;}
    try{const payload=M.hjBathHandoff(data);localStorage.setItem('hj_bath_handoff',JSON.stringify(payload));$('appHandoffNotice').hidden=false;$('openAppLink').hidden=false;notify("앱 탭으로 돌아가면 '욕실 견적 불러오기' 창이 뜹니다.");}
    catch(error){if(error.code==='BATH_ESTIMATE_PENDING'){$('appHandoffBlocked').hidden=false;$('appHandoffNotice').hidden=true;$('openAppLink').hidden=true;notify(error.message);}else notify('앱으로 넘기지 못했습니다. 입력값과 기기 저장 권한을 확인해 주세요.');}
  }
  function input(path,label,unit,attrs=''){return '<label>'+label+'<input type="number" data-path="'+path+'" '+attrs+'>'+ (unit?'<span>'+unit+'</span>':'')+'</label>';}
  /* v410 직접 바꾼 규격도 제품 선택과 같은 가격 확인 절차를 거친다. */
  function hjBathSyncTilePreset(k){const el=document.querySelector('[data-tile-preset="'+k+'"]'),t=data[k],v=[t.width,t.height,t.pack].map(Number).join(',');el.value=[...el.options].some(o=>o.value===v)?v:'';}
  /* v410 선택한 사진을 읽는 동안 이전 사진으로 고객 파일을 만들지 않는다. */
  function hjBathPhotoControls(){$('sitePhotoStatus').hidden=!photoPending;$('clearPhoto').hidden=!photo&&!photoPending;if(photoPending){$('exportHTML').disabled=true;$('printQuote').disabled=true;}}
  /* v410 보관한 숫자 문자열도 실제로 계산될 숫자를 입력칸에 보여 준다. */
  function hjBathInputValue(v){return typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):v==null?'':v;}
  /* v410 선택 전에도 비용 구성을 확인하고, 빈 단가를 무료로 오해하지 않게 한다. */
  function hjBathScopeBreakdown(s){
    try{
      M.hjBathScopeAmount({...s});
      return [['material','labor','자재'],['labor','material','시공']].map(([key,other,label])=>{
        const amount=M.hjBathScopeAmount({...s,[other]:0}),unit=amount===null?'확인 필요':won(Number(s[key]));
        const source=data.priceSources?.[s.name+(key==='labor'?' 시공':'')];
        return '<div>'+label+' '+fmt(s.qty)+s.unit+' × '+unit+' = '+(amount===null?'확인 필요':won(amount))+(source?' <small>'+escape(M.sourceLabel(source))+'</small>':'')+'</div>';
      }).join('')+'<small>품목 금액 · 부가세 '+(data.vat==='inclusive'?'포함':'별도')+'</small>';
    }catch(_){return '<div>수량·단가를 확인해 주세요.</div>';}
  }
  /* v410 선택한 항목의 빈 단가를 안내하고 접힌 설정을 열어 해당 입력칸으로 돌아간다. */
  function hjBathPriceTarget(row){
    const tiles={wallTile:['wall.price','벽 타일 박스 판매단가'],wallWork:['wall.labor','벽 타일 ㎡당 시공비'],floorTile:['floor.price','바닥 타일 박스 판매단가'],floorWork:['floor.labor','바닥 타일 ㎡당 시공비']};
    if(tiles[row.id])return tiles[row.id];
    const c=data.consumables.findIndex(c=>c.id===row.id);
    if(c!==-1)return ['consumables.'+c+'.price',row.name+' 포장 판매단가'];
    const s=data.scope.findIndex(s=>s.id+'Mat'===row.id||s.id+'Work'===row.id),key=row.kind==='자재'?'material':'labor';
    return ['scope.'+s+'.'+key,row.name+' '+(key==='material'?'자재 판매단가':'시공 단가')];
  }
  function hjBathPriceChecklist(r){
    $('priceChecklist').innerHTML=r.missing.length?'<h3>확인할 단가 '+r.missing.length+'개</h3><p class="help">아래 항목을 누르면 입력칸으로 이동합니다. 선택한 항목의 빈 단가만 표시하며, 비용이 없으면 0을 입력해 주세요.</p><div class="price-check-actions">'+r.missing.map(row=>{const [path,label]=hjBathPriceTarget(row);return '<button type="button" class="button outline" data-price-path="'+path+'">'+escape(label)+' 입력 ↗</button>';}).join('')+'</div>':'<h3>선택한 항목의 단가를 모두 입력했습니다.</h3><p class="help">입력 완료는 견적 확정과 다릅니다. 판매 단가·제품·실측 수량을 함께 확인해 주세요.</p>';
  }
  function renderFields(){
    $('styleCards').innerHTML=M.styles.map(s=>'<button type="button" class="style-card" data-style="'+s.id+'" aria-pressed="'+(data.style===s.id)+'"><img src="'+s.image+'" alt="'+s.name+' 욕실 참고 이미지" loading="lazy" width="1200" height="800"><span class="style-check" aria-hidden="true">✓</span><div class="style-copy"><strong>'+s.name+'</strong><small>'+s.sub+'</small></div></button>').join('');
    $('tileFields').innerHTML=['wall','floor'].map(k=>'<div class="tile-card"><div class="tile-head"><span class="tile-swatch" aria-hidden="true"></span><div><h3>'+(k==='wall'?'벽 타일':'바닥 타일')+'</h3><small>타일은 박스 단위로 구매 · 시공비는 순면적 기준</small></div></div><div class="tile-body"><label class="stack">자주 쓰는 규격<select data-tile-preset="'+k+'"><option value="">직접 입력</option><option value="300,600,8">300 × 600mm · 8장/박스 (입수 확인)</option><option value="600,600,4">600 × 600mm · 4장/박스 (입수 확인)</option><option value="300,300,16">300 × 300mm · 16장/박스 (입수 확인)</option></select></label><div class="field-grid three">'+input(k+'.width','타일 가로','mm','min="10" max="3000" step="1"')+input(k+'.height','타일 세로','mm','min="10" max="3000" step="1"')+input(k+'.pack','박스당 장수','장','min="1" max="1000" step="1"')+'</div><div class="field-grid three">'+input(k+'.waste','재단·파손 여유','%','min="0" max="50" step="1"')+input(k+'.price','박스 판매단가','원','min="0" max="100000000" step="1" placeholder="단가 입력"')+input(k+'.labor','㎡당 시공비','원','min="0" max="100000000" step="1" placeholder="단가 입력"')+'</div><div class="tile-result" id="'+k+'Result"></div></div></div>').join('');
    $('consumableFields').innerHTML=data.consumables.map((c,i)=>'<div class="consumable"><label class="check-label"><input type="checkbox" data-path="consumables.'+i+'.enabled">'+c.name+' 포함</label><div class="field-grid three">'+input('consumables.'+i+'.usage','㎡당 사용량','kg','min="0.01" max="100" step="0.01"')+input('consumables.'+i+'.pack','포장 용량','kg','min="0.01" max="1000" step="0.01"')+input('consumables.'+i+'.price','포장 판매단가','원','min="0" max="100000000" step="1" placeholder="단가 입력"')+'</div><p class="help" id="'+c.id+'Result"></p></div>').join('');
    $('scopeFields').innerHTML='<div class="scope-grid">'+data.scope.map((s,i)=>'<div class="option-card" id="scope-'+s.id+'"><label class="option-select"><input type="checkbox" data-path="scope.'+i+'.enabled" aria-label="'+s.name+' 포함"><span><strong>'+s.name+'</strong><small>'+s.group+' · '+M.unitPriceLabel(s.unit)+'</small><small class="option-price" id="price-'+s.id+'"></small></span></label><div class="option-breakdown" id="breakdown-'+s.id+'"></div><div class="option-description" id="description-'+s.id+'"></div><details><summary>판매단가·수량·제품 설정</summary><div class="field-grid two">'+input('scope.'+i+'.material','자재 판매단가','원','min="0" max="100000000" step="1" placeholder="단가 입력"')+input('scope.'+i+'.labor','시공 단가','원','min="0" max="100000000" step="1" placeholder="단가 입력"')+'</div><div class="field-grid two">'+input('scope.'+i+'.qty','수량',s.unit,'min="1" max="100" step="1"')+'</div><label class="stack">제품명·포함 범위<input data-path="scope.'+i+'.model" maxlength="140" placeholder="제품·브랜드·포함 내용을 입력"></label><p class="help">'+s.note+'</p></details></div>').join('')+'</div>';
    document.querySelectorAll('[data-path]').forEach(el=>{const v=get(el.dataset.path);if(el.type==='checkbox')el.checked=v===true;else el.value=el.type==='number'?hjBathInputValue(v):v===null?'':v;});
    ['wall','floor'].forEach(hjBathSyncTilePreset);
  }
  function quantityRows(r){return ['wall','floor'].map(k=>{const t=r[k];return '<tr><td>'+(k==='wall'?'벽':'바닥')+'</td><td class="numeric">'+fmt(t.area)+'㎡</td><td class="numeric">'+fmt(t.waste)+'%</td><td class="numeric">'+t.need+'장</td><td class="numeric">'+t.boxes+'박스</td><td class="numeric">'+t.buy+'장</td><td class="numeric">'+t.packSurplus+'장</td></tr>';}).join('');}
  function renderReport(r){
    const d=r.data,style=M.styles.find(s=>s.id===d.style),status=r.hasEstimates?'추정 단가 포함 · 확정 금액 아님':!r.complete?'단가 확인 필요':d.priceStatus==='confirmed'?'판매단가 확인 · 실측 전 상담용':'판매단가 확인 전 · 상담용';
    $('report').innerHTML='<div class="report-top"><div><span class="report-badge">'+status+'</span><h2>욕실 인테리어 견적서</h2><small>'+escape(d.project||'현장 이름 미입력')+' · '+escape(d.date)+'</small></div><span class="report-brand">만물인테리어</span></div><div class="report-info"><figure class="report-visual"><img loading="lazy" width="1200" height="800" src="'+style.image+'" alt="'+style.name+' 참고 이미지"><figcaption>'+style.name+' · AI로 만든 참고 이미지이며 실제 시공 사례가 아닙니다.</figcaption></figure><div><h3>이번 상담에서 정한 내용</h3><dl><dt>고객</dt><dd>'+escape(d.customer||'미입력')+'</dd><dt>공간 크기</dt><dd>'+fmt(d.size.width)+' × '+fmt(d.size.depth)+'cm / 높이 '+fmt(d.size.height)+'cm</dd><dt>벽 면적</dt><dd>'+fmt(r.grossWall)+' − 공제 '+fmt(r.opening)+' = '+fmt(r.wall.area)+'㎡</dd><dt>바닥 면적</dt><dd>'+fmt(r.floor.area)+'㎡</dd><dt>선택 공사</dt><dd>'+d.scope.filter(s=>s.enabled).length+'개 항목 + 타일</dd><dt>단가 기준</dt><dd>'+(d.vat==='inclusive'?'입력단가에 부가세 포함':'입력단가는 부가세 별도')+'</dd></dl></div></div><h3>01. 타일은 얼마나 필요한가요?</h3><div class="table-wrap"><table class="quantity-table"><thead><tr><th>구분</th><th class="numeric">순면적</th><th class="numeric">여유율</th><th class="numeric">필요 장수</th><th class="numeric">구매 박스</th><th class="numeric">실구매</th><th class="numeric">박스 여분</th></tr></thead><tbody>'+quantityRows(r)+'</tbody></table></div><p class="help">필요 장수 = 순면적 × (1 + 여유율) ÷ 타일 1장 면적을 올림. 구매 박스는 포장 단위로 한 번 더 올립니다. ‘박스 여분’은 이 마지막 올림으로 남는 수량입니다.</p><h3>02. 선택한 항목은 얼마인가요?</h3><p class="help">타일 자재비는 구매 박스 × 박스 판매단가, 타일 시공비는 순면적 × ㎡당 단가입니다. 각 행 금액을 원 단위로 반올림한 뒤 합산합니다.</p><div class="table-wrap"><table class="price-table" role="table" aria-label="자재·시공 금액 내역"><thead role="rowgroup"><tr role="row"><th>구분</th><th>항목·계산 근거</th><th class="numeric">수량</th><th class="numeric">판매단가</th><th class="numeric">금액</th></tr></thead><tbody role="rowgroup">'+r.rows.map(x=>'<tr role="row" data-row-id="'+x.id+'"><td role="cell" data-label="구분"><span class="kind">'+x.kind+'</span></td><td role="cell" data-label="항목·계산 근거">'+escape(x.name)+'<small>'+escape(x.basis)+'</small></td><td role="cell" data-label="수량" class="numeric">'+fmt(x.qty)+x.unit+'</td><td role="cell" data-label="판매단가" class="numeric '+(x.price===null?'missing':'')+'">'+(x.price===null?'확인 필요':won(x.price))+'</td><td role="cell" data-label="금액" class="numeric '+(x.amount===null?'missing':'')+'">'+(x.amount===null?'미정':won(x.amount))+'</td></tr>').join('')+'</tbody></table></div><div class="report-total"><div class="total-line"><span>자재비'+(!r.complete?' (입력분)':'')+'</span><strong>'+won(r.material)+'</strong></div><div class="total-line"><span>시공비'+(!r.complete?' (입력분)':'')+'</span><strong>'+won(r.labor)+'</strong></div><div class="total-line"><span>공급가액</span><span>'+(r.complete?won(r.supply):'미확정')+'</span></div><div class="total-line"><span>부가세 10%</span><span>'+(r.complete?won(r.vat):'미확정')+'</span></div><div class="total-line grand"><span>합계</span><span>'+(r.complete?won(r.total):'단가 확인 중')+'</span></div><small>'+(r.complete?'부가세를 포함한 합계입니다. 실측·제품 확정 후 최종 견적을 안내합니다.':'아직 '+r.missing.length+'개 단가가 비어 있습니다. 입력된 금액만으로 총 공사비를 확정하지 않습니다.')+'</small></div><h3>03. 포함하지 않은 내용도 함께 확인해요.</h3><div class="report-note"><strong>미선택 품목</strong>\n'+escape(r.excluded.length?r.excluded.join(' · '):'없음')+'\n\n<strong>추가 확인·별도 협의</strong>\n'+escape(d.exclusions||'상담 시 확인')+'\n\n<strong>고객 요청·정한 제품</strong>\n'+escape(d.request||'상담 시 함께 작성합니다.')+'</div>'+(photo?'<h3>현재 욕실 사진</h3><img class="report-photo" loading="lazy" src="'+photo+'" alt="고객이 추가한 현재 욕실 사진">':'')+'<div class="report-foot">입력 치수에 따른 상담용 계산서입니다. 줄눈 폭·패턴·기둥·단차·현장 손실은 발주 전 확인합니다. 접착제·줄눈재 사용량은 선택한 제품의 시방값을 적용해야 합니다. 공사 범위와 제품, 실측 수량을 함께 확인한 뒤 최종 견적을 정합니다.</div><footer class="report-contact"><strong>만물인테리어 · 010-2397-8629</strong><div class="contact-actions"><a class="button primary" href="tel:01023978629">📞 전화 상담</a><a class="button outline" href="sms:01023978629">💬 문자 문의</a></div></footer>';
    for(const row of r.rows){if(!row.priceSource)continue;const tr=$('report').querySelector('[data-row-id="'+row.id+'"]');tr.querySelector('[data-label="판매단가"]').insertAdjacentHTML('beforeend',hjBathSourceHTML(row.priceSource));if(row.priceSource.kind==='estimate')tr.dataset.estimated='true';}
    if(r.hasEstimates){$('report').querySelector('.report-top').insertAdjacentHTML('afterend','<p class="notice estimate-total">'+escape(priceNotice)+'<br><strong>추정 단가 포함 · '+r.estimatedRows.length+'개 항목</strong></p>');$('report').querySelector('.report-total').insertAdjacentHTML('afterbegin','<p class="estimate-total">추정 단가 포함 · 확정 금액 아님</p>');}
  }
  function update(){
    $('methodNotice').hidden=data.method!=='overlay';
    {const ms=$('methodScopeNotice');if(ms)ms.hidden=!(data.method==='full'&&data.scope.some(s=>(s.id==='demolition'||s.id==='waste')&&!s.enabled));}   // v450 전체 철거인데 철거·폐기물이 빠진 경우
    hjBathPriceBadges();
    $('appHandoffBlocked').hidden=true;
    data.scope.forEach(s=>{$('scope-'+s.id).classList.toggle('selected',s.enabled);let message;try{const amount=M.hjBathScopeAmount(s);message=(s.enabled?'선택됨 · ':'선택하면 ')+(amount===null?'단가 확인 필요':'+ '+won(amount)+' (부가세 '+(data.vat==='inclusive'?'포함':'별도')+')');}catch(_){message=(s.enabled?'선택됨 · ':'선택 시 ')+'수량·단가 확인 필요';}$('price-'+s.id).textContent=message;$('breakdown-'+s.id).innerHTML=hjBathScopeBreakdown(s);$('description-'+s.id).textContent=(s.model?s.model+' · ':'')+s.note;});
    try{
      result=M.calculate(data);$('formErrors').hidden=true;const r=result;hjBathPriceChecklist(r);
      $('planWidth').textContent=fmt(data.size.width)+'cm';$('planDepth').textContent=fmt(data.size.depth)+'cm';
      $('areaSummary').innerHTML='<div><small>바닥 순면적</small><strong>'+fmt(r.floor.area)+'㎡</strong></div><div><small>벽 순면적</small><strong>'+fmt(r.wall.area)+'㎡</strong></div><div><small>문·창 공제</small><strong>'+fmt(r.opening)+'㎡</strong></div>';
      ['wall','floor'].forEach(k=>{const t=r[k];$(k+'Result').innerHTML='순면적 '+fmt(t.area)+'㎡ + 여유 '+fmt(t.waste)+'% → 필요 <strong>'+t.need+'장</strong><br>구매 <strong>'+t.boxes+'박스 · '+t.buy+'장</strong> <small>(박스 반올림 여분 '+t.packSurplus+'장)</small><br>자재 '+t.boxes+'박스 × '+won(r.data[k].price)+' = '+won(r.rows.find(x=>x.id===k+'Tile').amount)+'<br>시공 '+fmt(t.area)+'㎡ × '+won(r.data[k].labor)+' = '+won(r.rows.find(x=>x.id===k+'Work').amount)+'<br><small>품목 금액 · 부가세 '+(data.vat==='inclusive'?'포함':'별도')+'</small>';});
      data.consumables.forEach(c=>{const hit=r.consumables.find(x=>x.id===c.id);$(c.id+'Result').textContent=hit?fmt(hit.area)+'㎡ × '+fmt(hit.usage)+'kg/㎡ = '+fmt(hit.kg)+'kg → '+hit.packs+'포장 (포장 단위 올림) · '+hit.packs+'포장 × '+won(hit.price)+' = '+won(r.rows.find(x=>x.id===c.id).amount)+' (부가세 '+(data.vat==='inclusive'?'포함':'별도')+')':'포함을 선택하면 수량과 금액이 더해집니다.';});
      $('liveSummary').innerHTML='<div class="summary-total"><small>부가세 포함 예상 합계</small><strong>'+(r.complete?won(r.total):'단가 확인 중')+'</strong><p>'+(r.complete?(data.priceStatus==='confirmed'?'등록한 판매 단가 기준':'판매 단가 확인 전'):'비어 있는 단가 '+r.missing.length+'개를 입력하면 합계가 나옵니다.')+'</p></div><dl><dt>자재비'+(!r.complete?' (입력분)':'')+'</dt><dd>'+won(r.material)+'</dd><dt>시공비'+(!r.complete?' (입력분)':'')+'</dt><dd>'+won(r.labor)+'</dd><dt>부가세</dt><dd>'+(r.complete?won(r.vat):'미확정')+'</dd><dt>선택한 추가 공사</dt><dd>'+data.scope.filter(s=>s.enabled).length+'개</dd></dl>';
      if(r.hasEstimates)$('liveSummary').insertAdjacentHTML('afterbegin','<p class="estimate-total">추정 단가 포함 · '+r.estimatedRows.length+'개 항목<br>확정 금액이 아닙니다.</p>');
      $('priceEstimateNotice').hidden=!r.hasEstimates;   // v450 추정 단가가 들어간 때만 — 단가를 손으로 정했으면 이 내부 안내를 숨긴다(고객용 보기에서는 늘 숨김)
      $('mobileAmount').textContent=r.complete?won(r.total):'단가 확인 중';$('mobileStatus').textContent=(r.hasEstimates?'추정 단가 포함 · ':'')+(r.complete?'부가세 포함 합계':'빈 단가 '+r.missing.length+'개 · 추가 공사 '+data.scope.filter(s=>s.enabled).length+'개 선택');
      renderReport(r);
      /* v411 고객 HTML과 인쇄도 이 보고서를 복사하므로 새 상담 조건을 한 번만 그린다. */
      $('report').querySelector('.report-info dl').insertAdjacentHTML('beforeend','<dt>주소</dt><dd>'+escape(r.data.place||'상담 시 확인')+'</dd><dt>시공 방식</dt><dd>'+escape(M.hjBathMethodLabel(r.data.method))+'</dd><dt>공사 기간</dt><dd>'+escape(M.hjBathDaysText(r.data.days))+'</dd>');
      document.querySelectorAll('.export-buttons button').forEach(b=>b.disabled=htmlExporting&&b.id==='exportHTML');
      $('sendToApp').disabled=r.hasEstimates;$('appHandoffBlocked').hidden=!r.hasEstimates;
    }catch(e){result=null;$('priceChecklist').textContent='입력 오류를 먼저 확인해 주세요.';$('formErrors').textContent=e.message;$('formErrors').hidden=false;$('liveSummary').innerHTML='<div class="error">'+escape(e.message)+'</div>';$('report').innerHTML='<p class="error">계산할 수 없습니다. '+escape(e.message)+'</p>';$('areaSummary').innerHTML='';$('mobileAmount').textContent='입력 확인 필요';$('mobileStatus').textContent='치수·수량·단가를 확인해 주세요';['wall','floor'].forEach(k=>$(k+'Result').textContent='치수를 확인해 주세요.');data.consumables.forEach(c=>$(c.id+'Result').textContent='입력 오류를 확인하면 수량과 금액을 다시 계산합니다.');document.querySelectorAll('.export-buttons button').forEach(b=>b.disabled=true);}hjBathPhotoControls();
  }
  $('priceChecklist').addEventListener('click',e=>{
    const button=e.target.closest('[data-price-path]');if(!button)return;
    const el=document.querySelector('[data-path="'+button.dataset.pricePath+'"]');if(!el)return;
    for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    el.focus({preventScroll:true});el.scrollIntoView({block:'center',behavior:'auto'});
  });
  $('bathForm').addEventListener('submit',e=>e.preventDefault());
  $('bathForm').addEventListener('input',e=>{
    const el=e.target,path=el.dataset.path;if(!path)return;
    const tileField=/^(wall|floor)\.(width|height|pack)$/.exec(path),productField=tileField||/^consumables\.\d+\.pack$/.test(path),changed=productField&&Number(get(path))!==Number(el.value);
    if(path==='method'&&get(path)!==el.value){data.scope.forEach((s,i)=>{if(s.id==='demolition'||s.id==='waste'){s.enabled=el.value==='full';document.querySelector('[data-path="scope.'+i+'.enabled"]').checked=s.enabled;}});}
    hjBathForgetPrice(path);set(path,el.type==='checkbox'?el.checked:el.value);
    if(changed){hjBathClearProductSources(path);notify('규격·포장 용량을 바꿨습니다. 선택한 제품의 판매단가를 다시 확인해 주세요.');}
    if(tileField)hjBathSyncTilePreset(tileField[1]);
    if(path==='vat')hjBathRebaseSourcePrices();update();
  });
  $('bathForm').addEventListener('change',e=>{const el=e.target;if(el.dataset.tilePreset&&el.value){
    const k=el.dataset.tilePreset,[width,height,pack]=el.value.split(',').map(Number),dimensionsChanged=Number(data[k].width)!==width||Number(data[k].height)!==height;
    Object.assign(data[k],{width,height,pack});hjBathClearProductSources(k+'.'+(dimensionsChanged?'width':'pack'));
    for(const n of ['width','height','pack','price','labor']){const input=document.querySelector('[data-path="'+k+'.'+n+'"]');input.value=data[k][n]===null?'':data[k][n];}
    notify('규격을 바꿨습니다. 선택한 제품의 박스 입수와 판매단가를 확인해 주세요.');update();
  }});
  $('styleCards').addEventListener('click',e=>{const b=e.target.closest('[data-style]');if(!b)return;data.style=b.dataset.style;document.querySelectorAll('[data-style]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));update();});
  $('customerMode').addEventListener('click',()=>{if(!result){$('measure').scrollIntoView();notify('입력 오류를 먼저 확인해 주세요.');return;}const active=document.body.classList.toggle('customer-mode');$('customerMode').textContent=active?'계속 선택하기 ←':'고객용 보기 ↗';$('customerMode').setAttribute('aria-pressed',String(active));(active?$('quote'):$('measure')).scrollIntoView({behavior:'auto'});});
  $('saveDraft').addEventListener('click',()=>{if(!result){notify('입력 오류를 먼저 확인해 주세요.');return;}try{localStorage.setItem(KEY,JSON.stringify(result.data));notify('이 기기에 초안을 저장했습니다. 추가한 사진은 저장하지 않습니다.');}catch(_){notify('기기 저장 공간 또는 브라우저 권한을 확인해 주세요.');}});
  $('loadDraft').addEventListener('click',()=>{try{const saved=localStorage.getItem(KEY);if(!saved){notify('저장한 초안이 없습니다.');return;}const checked=M.calculate(JSON.parse(saved));if(!window.confirm('현재 입력 대신 이 기기에 저장한 상담 초안을 불러올까요? 현재 탭에 추가한 사진은 함께 비웁니다.'))return;defaultsEpoch++;data=checked.data;touchedPrices.clear();$('pricePrefillNotice').hidden=true;$('appPrefillNotice').hidden=true;photoToken++;photoPending=false;photo='';$('sitePhoto').value='';$('sitePhotoPreview').removeAttribute('src');$('sitePhotoPreview').hidden=true;$('clearPhoto').hidden=true;renderFields();update();notify('저장한 초안을 불러왔습니다.');}catch(_){notify('저장한 초안을 읽을 수 없습니다. 현재 입력은 그대로 두었습니다.');}});
  $('clearDraft').addEventListener('click',()=>{if(!window.confirm('이 페이지에서 저장한 상담 초안만 지울까요? 현재 화면의 입력은 남습니다.'))return;try{localStorage.removeItem(KEY);notify('이 페이지의 저장 초안을 지웠습니다.');}catch(_){notify('기기 저장 권한을 확인해 주세요.');}});
  $('sitePhoto').addEventListener('change',async e=>{const token=++photoToken,file=e.target.files[0];photoPending=false;if(!file){update();return;}if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){e.target.value='';update();notify('10MB 이하의 JPG·PNG·WebP 사진을 선택해 주세요.');return;}photoPending=true;update();const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(token!==photoToken)return;const ratio=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);photo=canvas.toDataURL('image/jpeg',0.82);$('sitePhotoPreview').src=photo;$('sitePhotoPreview').hidden=false;$('clearPhoto').hidden=false;update();notify('사진을 추가했습니다. 서버로 보내지 않았습니다.');}catch(_){if(token===photoToken){e.target.value='';notify('사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.');}}finally{URL.revokeObjectURL(url);if(token===photoToken){photoPending=false;update();}}});
  $('clearPhoto').addEventListener('click',()=>{photoToken++;photoPending=false;photo='';$('sitePhoto').value='';$('sitePhotoPreview').removeAttribute('src');$('sitePhotoPreview').hidden=true;$('clearPhoto').hidden=true;update();});
  function download(text,type,filename){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function filename(ext){return (data.date||'상담')+' 욕실 '+(data.project||'견적').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,65)+'.'+ext;}
  $('exportCSV').addEventListener('click',()=>{if(result)download(M.toCSV(result),'text/csv;charset=utf-8',filename('csv'));});
  $('sendToApp').addEventListener('click',hjBathSendToApp);
  function summaryText(){const r=result,d=r.data,lines=['[만물인테리어 욕실 상담]',d.project||'현장 미입력','스타일: '+M.styles.find(s=>s.id===d.style).name,'치수: '+d.size.width+'×'+d.size.depth+'cm, 높이 '+d.size.height+'cm','벽 타일: '+r.wall.need+'장 필요 → '+r.wall.boxes+'박스('+r.wall.buy+'장)','바닥 타일: '+r.floor.need+'장 필요 → '+r.floor.boxes+'박스('+r.floor.buy+'장)','자재비'+(!r.complete?'(입력분)':'')+': '+won(r.material),'시공비'+(!r.complete?'(입력분)':'')+': '+won(r.labor),'부가세 포함 합계'+(r.hasEstimates?' (추정 단가 포함)':'')+': '+(r.complete?won(r.total):'단가 '+r.missing.length+'개 확인 필요'),'선택 공사: '+(d.scope.filter(s=>s.enabled).map(s=>s.name+' × '+s.qty+s.unit+(s.model?' · '+s.model:'')).join('\n')||'추가 선택 없음'),'미포함: '+(r.excluded.join(', ')||'없음'),'별도 협의: '+d.exclusions,'요청: '+d.request,'타일 자재는 구매 박스, 시공은 순면적 기준입니다. 실측·제품·판매단가 확인 후 확정합니다.'];if(r.hasEstimates)lines.push(priceNotice,...r.estimatedRows.map(row=>row.name+' ('+row.kind+'): '+M.sourceDescription(row.priceSource)));return lines.join('\n');}
  $('copyQuote').addEventListener('click',async()=>{if(!result)return;const d=result.data,text=summaryText()+'\n주소: '+(d.place||'상담 시 확인')+'\n시공 방식: '+M.hjBathMethodLabel(d.method)+'\n'+M.hjBathDaysText(d.days);try{await navigator.clipboard.writeText(text);notify('상담 내용을 복사했습니다. 고객에게 보낼 곳에 직접 붙여 넣어 주세요.');}catch(_){$('copyText').value=text;$('copyDialog').showModal();$('copyText').select();}});
  $('printQuote').addEventListener('click',()=>{if(result&&!photoPending)window.print();});
  async function asDataURL(url){const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw Error('image');const blob=await response.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
  $('exportHTML').addEventListener('click',async()=>{if(!result||htmlExporting||photoPending)return;const button=$('exportHTML'),copy=$('report').cloneNode(true),name=filename('html');htmlExporting=true;button.disabled=true;try{const response=await fetch('bathroom.css',{credentials:'omit'});if(!response.ok)throw Error('css');const css=await response.text();for(const img of copy.querySelectorAll('img'))if(!img.src.startsWith('data:'))img.src=await asDataURL(img.src);const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>욕실 상담용 견적서</title><style>'+css+'</style><body><main><div class="report-toolbar"><p>상담용 견적·자재 계산서 · 인쇄 메뉴에서 PDF로 저장할 수 있습니다.</p></div>'+copy.outerHTML+'</main></body></html>';download(html,'text/html;charset=utf-8',name);notify('고객용 파일을 저장했습니다. 선택 내용과 이미지만 담은 읽기용 파일입니다.');}catch(_){notify('파일을 만들지 못했습니다. 연결을 확인하거나 인쇄 / PDF를 사용해 주세요.');}finally{htmlExporting=false;button.disabled=!result||photoPending;}});
  hjBathReadPrefill();renderFields();update();document.documentElement.dataset.bathReady='true';document.documentElement.dataset.bathPricesReady='false';window.__hjBathPricesDone=hjBathLoadDefaults();
})();
