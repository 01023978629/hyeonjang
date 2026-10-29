/* v431 공개 누수 접수 페이지 — 서버 없음. 고객 폰의 문자 앱(sms: 본문)·전화·카카오 채널 링크로만 넘어간다.
   이 페이지는 아무것도 저장·업로드하지 않는다(사진도 문자 답장으로). 증상 여섯 항목은 앱 v419 접수 체크리스트
   HJ_LEAK_INTAKE_CHOICES 와 같은 항목·같은 값이어야 한다 — 앱이 문자 한 줄을 그대로 접수로 읽기 때문이다
   (tests/leakintakeweb-v431 이 index.html 의 상수와 대조한다). */
(function(){
  'use strict';
  var PHONE='01023978629';
  var KAKAO_URL='';   // 카카오톡 채널 주소가 정해지면 넣는다 — 비어 있으면 버튼을 숨긴다(가짜 링크를 두지 않는다)
  var CHOICES={
    where:['욕실','주방','베란다','보일러실','천장','벽','외벽','모름'],
    since:['오늘','2~3일','일주일 이상','모름'],
    amount:['얼룩만','똑똑 떨어짐','흐름','고임'],
    neighbor:['우리 집 안','아랫집에서 연락 옴','윗집이 원인 추정','모름'],
    office:['했음','안 함','해당 없음(단독·상가)'],
    insurance:['일상배상책임 있음','없음','모름']
  };
  var TIMES=['오전','오후','저녁','아무 때나'];
  var LABELS={where:'어디서',since:'언제',amount:'물양',neighbor:'이웃',office:'관리사무소',insurance:'보험'};
  var REQUIRED=['where','since','amount'];
  var DONGS=['유천동','태평동','문화동','산성동','대흥동','선화동','은행동','목동','중촌동','용두동','오류동','부사동','석교동','옥계동','사정동','안영동','침산동','대사동',
    '둔산동','갈마동','월평동','탄방동','괴정동','도마동','정림동','복수동','변동','가장동','내동','용문동','만년동','관저동','가수원동','도안동','봉명동','궁동','어은동','노은동','지족동','전민동','관평동',
    '오정동','송촌동','법동','중리동','비래동','석봉동','신탄진동','가양동','용전동','성남동','홍도동','삼성동','판암동','대동','자양동'];
  var state={where:[],since:'',amount:'',neighbor:'',office:'',insurance:'',time:'',dong:'',name:''};
  var $=function(s){return document.querySelector(s);};
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function toast(msg){var el=$('#status');if(!el)return;el.textContent=msg;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){el.hidden=true;},2600);}
  function chips(key,values,multi){
    var box=document.getElementById(key+'Chips');if(!box)return;
    box.setAttribute('role',multi?'group':'radiogroup');
    box.innerHTML=values.map(function(v){return '<button type="button" class="chip" data-key="'+key+'" data-value="'+esc(v)+'" role="'+(multi?'button':'radio')+'" '+(multi?'aria-pressed':'aria-checked')+'="false">'+esc(v)+'</button>';}).join('');
  }
  function paint(){
    document.querySelectorAll('.chip').forEach(function(b){
      var key=b.dataset.key,v=b.dataset.value,on=key==='where'?state.where.indexOf(v)>=0:state[key]===v;
      b.setAttribute(key==='where'?'aria-pressed':'aria-checked',on?'true':'false');
    });
    $('#smsText').value=buildMessage(state);
    $('#smsLink').setAttribute('href',smsHref(buildMessage(state)));
  }
  function buildLine(s){
    var parts=[];
    if(s.where.length)parts.push(LABELS.where+'='+s.where.join('·'));
    ['since','amount','neighbor','office','insurance'].forEach(function(k){if(s[k])parts.push(LABELS[k]+'='+s[k]);});
    if(s.dong)parts.push('동='+String(s.dong).trim());
    if(s.time)parts.push('시간='+s.time);
    if(s.name)parts.push('이름='+String(s.name).trim());
    return '[누수접수] '+parts.join(';');
  }
  function buildMessage(s){return buildLine(s)+'\n사진 2장(젖은 곳 넓게 1장, 가까이 1장)을 이 문자에 답장으로 보내 주세요.';}
  function smsHref(body){return 'sms:'+PHONE+'?body='+encodeURIComponent(body);}
  function validate(){
    var missing=[];
    REQUIRED.forEach(function(k){var fs=document.querySelector('fieldset[data-key="'+k+'"]'),ok=k==='where'?state.where.length>0:!!state[k];if(fs)fs.classList.toggle('invalid',!ok);if(!ok)missing.push(k==='where'?'어디서 새는지':k==='since'?'언제부터인지':'물 양');});
    var dong=$('#dong');state.dong=dong.value.trim();dong.classList.toggle('invalid',!state.dong);if(!state.dong)missing.push('동네(동 이름)');
    var err=$('#formError');
    if(missing.length){err.hidden=false;err.textContent=missing.join(', ')+'을(를) 골라 주세요.';return false;}
    err.hidden=true;err.textContent='';return true;
  }
  function init(){
    chips('where',CHOICES.where,true);['since','amount','neighbor','office','insurance'].forEach(function(k){chips(k,CHOICES[k],false);});chips('time',TIMES,false);
    $('#dongList').innerHTML=DONGS.map(function(d){return '<option value="'+esc(d)+'"></option>';}).join('');
    document.addEventListener('click',function(e){
      var b=e.target.closest('.chip');if(!b)return;
      var key=b.dataset.key,v=b.dataset.value;
      if(key==='where'){var i=state.where.indexOf(v);if(i>=0)state.where.splice(i,1);else state.where.push(v);}
      else state[key]=state[key]===v?'':v;
      var fs=b.closest('fieldset');if(fs)fs.classList.remove('invalid');
      paint();
    });
    $('#dong').addEventListener('input',function(e){state.dong=e.target.value.trim();e.target.classList.remove('invalid');paint();});
    $('#name').addEventListener('input',function(e){state.name=e.target.value.trim();paint();});
    $('#smsLink').addEventListener('click',function(e){
      if(!validate()){e.preventDefault();toast('필수 항목을 먼저 골라 주세요');return;}
      $('#smsLink').setAttribute('href',smsHref(buildMessage(state)));
      toast('문자 앱이 열립니다 — 보낸 뒤 사진 2장을 답장으로');
    });
    $('#copyText').addEventListener('click',function(){
      if(!validate()){toast('필수 항목을 먼저 골라 주세요');return;}
      var t=buildMessage(state),ta=$('#smsText');ta.value=t;
      var done=function(){toast('복사했어요 — 문자 앱에 붙여 넣고 '+PHONE.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3')+'로 보내 주세요');};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,function(){ta.select();toast('길게 눌러 복사해 주세요');});
      else{ta.select();toast('길게 눌러 복사해 주세요');}
    });
    var kakao=$('#kakaoLink');if(KAKAO_URL){kakao.href=KAKAO_URL;kakao.hidden=false;kakao.target='_blank';}
    paint();
  }
  window.LeakIntake={CHOICES:CHOICES,TIMES:TIMES,LABELS:LABELS,REQUIRED:REQUIRED,PHONE:PHONE,buildLine:buildLine,buildMessage:buildMessage,smsHref:smsHref,state:state,validate:validate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
