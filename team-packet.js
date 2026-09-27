/* Insurance preparation only: checked original bytes, no upload or claim-state writes. */
(function (root) {
  'use strict';
  const MAX_BYTES = 50 * 1024 * 1024, MAX_FILES = 50;
  const EXT = Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'});
  const PHASE = Object.freeze({before:'작업 전',cause:'원인 확인',during:'작업 중',after:'작업 후'});
  const COST = Object.freeze({cause:'원인 교정',restore:'피해 복구',other:'기타'});
  const STATUS = Object.freeze({todo:'대기',doing:'작업 중',blocked:'보류',review:'검수 요청',done:'완료 승인'});
  const WARNING = '보험사 제출 준비 자료 · 실제 제출 아님';
  const encoder = new TextEncoder();
  function fail(code) { throw new Error('packet-' + code); }
  function text(value, limit, required) {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) fail('invalid-input');
    return value;
  }
  function id(value) { const v = text(value, 128, true); if (!/^[a-zA-Z0-9_-]+$/.test(v)) fail('invalid-id'); return v; }
  function digest(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('invalid-hash'); return value; }
  function sourceFingerprint(value) { if (typeof value !== 'string' || !/^(?:[a-f0-9]{64}|[a-zA-Z0-9_-]{43})$/.test(value)) fail('invalid-fingerprint'); return value; }
  function list(value, max) { if (!Array.isArray(value) || value.length > max) fail('invalid-list'); return value; }
  function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function lines(value) { return esc(value).replace(/\r?\n/g, '<br>'); }
  function csv(value) {
    let out = String(value);
    // Quoting alone does not stop a spreadsheet from executing a formula.
    if (/^[\s\uFEFF]*[=+\-@]/.test(out) || /^[\t\r\n]/.test(out)) out = "'" + out;
    return '"' + out.replace(/"/g, '""') + '"';
  }
  function projectTasks(tasks, projectId) {
    const seen = new Set();
    return list(tasks, 2000).map(t => {
      if (!t || id(t.projectId) !== projectId) fail('project-mismatch');
      const taskId = id(t.id); if (seen.has(taskId)) fail('duplicate-id'); seen.add(taskId);
      const history = list(t.history || [], 100).map(h => ({at:text(h.at,64),status:text(h.status,30),handoff:text(h.handoff,4000),actorId:text(h.actorId,128)}));
      return {id:taskId,title:text(t.title,300,true),status:text(t.status,30),handoff:text(t.handoff,4000),
        workDate:text(t.workDate,32),startTime:text(t.startTime,16),endTime:text(t.endTime,16),assigneeId:text(t.assigneeId,128),history};
    });
  }
  function normalize(bundle, files) {
    if (!bundle || bundle.reviewCurrent !== true) fail('review-required');
    const fingerprint = sourceFingerprint(bundle.fingerprint);
    const p = bundle.project, c = bundle.claim;
    if (!p || !c) fail('invalid-input');
    const project = {id:id(p.id),name:text(p.name,300,true)};
    if (id(c.projectId) !== project.id) fail('project-mismatch');
    const chosen = list(c.selectedEvidenceIds, MAX_FILES).map(id);
    if (!chosen.length || new Set(chosen).size !== chosen.length) fail('selection-mismatch');
    const tasks = projectTasks(bundle.tasks || [], project.id), taskIds = new Set(tasks.map(t => t.id));
    const metadata = new Map();
    for (const e of list(bundle.evidence, 5000)) {
      if (!e || metadata.has(id(e.id))) fail('duplicate-id');
      metadata.set(e.id, e);
    }
    const inputFiles = list(files, MAX_FILES), inputIds = new Set();
    if (inputFiles.length !== chosen.length) fail('selection-mismatch');
    const total = inputFiles.reduce((sum, f) => {
      if (!f || !Number.isSafeInteger(f.size) || f.size < 1) fail('invalid-size');
      return sum + f.size;
    }, 0);
    if (!Number.isSafeInteger(total) || total > MAX_BYTES) fail('size-limit');
    const prepared = inputFiles.map(f => {
      const fileId = id(f.id);
      if (inputIds.has(fileId) || !chosen.includes(fileId)) fail('selection-mismatch');
      inputIds.add(fileId);
      const e = metadata.get(fileId);
      if (!e || id(e.projectId) !== project.id) fail('project-mismatch');
      if (!Object.prototype.hasOwnProperty.call(EXT,f.mime) || e.mime !== f.mime) fail('invalid-mime');
      if (!Number.isSafeInteger(e.size) || f.size !== e.size || !(f.bytes instanceof Uint8Array) || f.bytes.byteLength !== f.size) fail('size-mismatch');
      if (digest(f.sha256) !== digest(e.sha256)) fail('hash-mismatch');
      if (e.kind !== 'photo' && e.kind !== 'document') fail('invalid-kind');
      if (e.kind === 'photo' && (f.mime === 'application/pdf' || !taskIds.has(id(e.taskId)))) fail('task-mismatch');
      if (e.kind === 'document' && e.taskId && !taskIds.has(id(e.taskId))) fail('task-mismatch');
      if (e.kind === 'photo' && !Object.prototype.hasOwnProperty.call(PHASE,e.phase)) fail('invalid-phase');
      return {id:fileId,mime:f.mime,size:f.size,sha256:f.sha256,kind:e.kind,taskId:text(e.taskId,128),
        phase:text(e.phase,40),caption:text(e.caption,2000),capturedDate:text(e.capturedDate,64),bytes:new Uint8Array(f.bytes)};
    });
    let amount = 0;
    const items = list(c.items || [],500).map(item => {
      if (!item || !Object.prototype.hasOwnProperty.call(COST,item.kind) || !Number.isSafeInteger(item.amount) || item.amount < 0) fail('invalid-amount');
      amount += item.amount; if (!Number.isSafeInteger(amount)) fail('invalid-amount');
      return {kind:item.kind,description:text(item.description,2000,true),amount:item.amount};
    });
    const claim = {id:id(c.id),projectId:project.id,mode:text(c.mode,40),insurerName:text(c.insurerName,300),referenceNo:text(c.referenceNo,200),
      accidentDate:text(c.accidentDate,64),incident:text(c.incident,8000),cause:text(c.cause,8000),repair:text(c.repair,8000),items,amount};
    const submissions = list(bundle.submissions || [],100).map(s => ({date:text(s.submittedDate,64),channel:text(s.channel,200),reference:text(s.referenceNo,200),fingerprint:sourceFingerprint(s.fingerprint)}));
    return {project,claim,tasks,files:chosen.map(fileId => prepared.find(f => f.id === fileId)),fingerprint,submissions};
  }
  function magic(f) {
    const b = f.bytes;
    const ascii = (a,z) => String.fromCharCode(...b.slice(a,z));
    const ok = f.mime === 'image/jpeg' ? b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255 :
      f.mime === 'image/png' ? b.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => b[i] === n) :
      f.mime === 'image/webp' ? b.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP' :
      f.mime === 'application/pdf' && b.length >= 5 && ascii(0,5) === '%PDF-';
    if (!ok) fail('invalid-file');
  }
  const crcTable = Uint32Array.from({length:256}, (_,n) => { let c = n; for (let k=0;k<8;k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(entries) {
    const chunks = [], central = []; let offset = 0, centralSize = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name), bytes = entry.bytes, crc = crc32(bytes);
      const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
      l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(6,0x0800,true);
      l.setUint16(12,33,true); l.setUint32(14,crc,true); l.setUint32(18,bytes.length,true); l.setUint32(22,bytes.length,true); l.setUint16(26,name.length,true); local.set(name,30);
      const header = new Uint8Array(46 + name.length), h = new DataView(header.buffer);
      h.setUint32(0,0x02014b50,true); h.setUint16(4,20,true); h.setUint16(6,20,true); h.setUint16(8,0x0800,true); h.setUint16(14,33,true);
      h.setUint32(16,crc,true); h.setUint32(20,bytes.length,true); h.setUint32(24,bytes.length,true); h.setUint16(28,name.length,true); h.setUint32(42,offset,true); header.set(name,46);
      chunks.push(local,bytes); central.push(header); offset += local.length + bytes.length; centralSize += header.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true); e.setUint16(8,entries.length,true); e.setUint16(10,entries.length,true); e.setUint32(12,centralSize,true); e.setUint32(16,offset,true);
    return new Blob([...chunks,...central,end], {type:'application/zip'});
  }
  function report(n) {
    const rows = n.claim.items.map(i => '<tr><td>'+esc(COST[i.kind])+'</td><td>'+lines(i.description)+'</td><td class="money">'+i.amount.toLocaleString('ko-KR')+'원</td></tr>').join('');
    const mode = {'customer-support':'고객 보험 청구 자료 지원','contractor-billing':'의뢰 공사비 청구 자료',undecided:'청구 방식 미확정'}[n.claim.mode] || '청구 방식 미확정';
    const tasks = n.tasks.map(t => '<article><h3>'+esc(t.title)+'</h3><p>'+esc(STATUS[t.status] || t.status)+' · '+esc([t.workDate,t.startTime,t.endTime ? '~ '+t.endTime : ''].filter(Boolean).join(' '))+'</p><p>담당자 내부 식별번호: '+esc(t.assigneeId || '미지정')+'</p><p>'+lines(t.handoff || '현재 작업 보고 없음')+'</p>'+(t.history.length ? '<details open><summary>기록된 작업 보고 이력</summary><ol>'+t.history.map(h => '<li><strong>'+esc(h.at)+' · '+esc(STATUS[h.status] || h.status)+'</strong><p>'+lines(h.handoff || '보고 내용 없음')+'</p></li>').join('')+'</ol></details>' : '<p>과거 보고 이력이 없는 작업입니다.</p>')+'</article>').join('');
    const photos = n.files.map(f => '<figure><figcaption>'+esc(f.kind === 'photo' ? PHASE[f.phase] : '참고 서류')+' · '+lines(f.caption || '설명 미입력')+'</figcaption>'+(f.kind === 'photo' ? '<img src="'+f.path+'" alt="'+esc(f.caption || PHASE[f.phase])+'">' : '<p><a href="'+f.path+'" download>첨부 원본 서류 열기</a></p>')+(f.capturedDate ? '<p>입력된 촬영일: '+esc(f.capturedDate)+' (EXIF 자동 확인 아님)</p>' : '')+'<p class="small">원본 '+esc(f.path)+' · SHA-256 '+f.sha256+'</p></figure>').join('');
    const submissions = n.submissions.length ? '<h2>사용자가 입력한 제출 기록</h2><p>수기 기록이며 보험사 실제 수신·접수 확인을 뜻하지 않습니다.</p><ul>'+n.submissions.map(s => {
      const current = s.fingerprint === n.fingerprint;
      return '<li><strong>'+(current ? '이 자료 기준 수동 기록' : '이전 자료 기준 수동 기록')+'</strong><p>'+esc([s.date,s.channel,s.reference].filter(Boolean).join(' · '))+'</p><p class="small">기록 당시 자료 지문: '+s.fingerprint+'</p>'+(current ? '' : '<p>현재 자료와 지문이 다릅니다. 위 접수번호는 현재 자료를 제출했다는 기록이 아닙니다.</p>')+'</li>';
    }).join('')+'</ul>' : '<p>이 자료를 내려받아도 제출 기록은 생성되지 않습니다.</p>';
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' file:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>보험 제출 준비 자료</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#17263a;margin:24px auto;padding:0 18px;max-width:900px;overflow-wrap:anywhere}h1{font-size:26px}h2{margin-top:32px;border-bottom:2px solid #b9c9db}h3{font-size:19px}.notice{border:2px solid #ab6c00;padding:16px;background:#fff8df}table{width:100%;border-collapse:collapse}td,th{padding:9px;border:1px solid #b9c9db;text-align:left}.money{white-space:nowrap;text-align:right}figure{margin:24px 0;padding:12px;border:1px solid #b9c9db;break-inside:avoid}figcaption{font-weight:700;margin-bottom:10px}img{max-width:100%;max-height:700px;object-fit:contain}.small{font-size:12px}article{padding:12px 0;border-bottom:1px solid #ddd}@media print{body{margin:0;max-width:none}a{color:inherit}h2,h3{break-after:avoid}img{max-height:200mm}.notice{background:none}details>summary{list-style:none}}</style></head><body><h1>'+esc(WARNING)+'</h1><div class="notice"><strong>확인된 원본과 입력 내용만 묶은 초안입니다.</strong><p>보험금 지급, 보장 범위, 지급 금액 또는 정식 접수를 보증하지 않습니다. 보험사·담당자에게 사고별 필요서류와 제출 경로를 확인한 뒤 사용하세요.</p><p>원본 사진에는 GPS, 차량 번호판, 고객·세대 정보가 포함될 수 있습니다. 외부 제출 권한과 개인정보 포함 범위를 확인하세요. 원본은 이 자료에서 보정·편집하지 않았습니다.</p></div><h2>프로젝트와 사고 내용</h2><p><strong>'+esc(n.project.name)+'</strong> · '+esc(mode)+'</p><p>보험사: '+esc(n.claim.insurerName || '미입력')+'<br>참고 번호: '+esc(n.claim.referenceNo || '미입력')+'<br>사고일: '+esc(n.claim.accidentDate || '미입력')+'</p><h3>접수·사고 내용</h3><p>'+lines(n.claim.incident || '미입력')+'</p><h3>확인한 원인</h3><p>'+lines(n.claim.cause || '미입력')+'</p><h3>보수 내용</h3><p>'+lines(n.claim.repair || '미입력')+'</p><h2>공사비 항목</h2><p>입력한 정수 원화 금액의 합계입니다. 세금·공제·지급액을 자동 추정하지 않습니다.</p><table><thead><tr><th>구분</th><th>세부 내용</th><th>입력 금액</th></tr></thead><tbody>'+rows+'<tr><th colspan="2">입력 합계</th><td class="money">'+n.claim.amount.toLocaleString('ko-KR')+'원</td></tr></tbody></table><h2>작업 진행과 보고</h2>'+tasks+'<h2>선택한 사진과 서류</h2>'+photos+submissions+'<hr><p class="small">검토 대상 자료 지문: '+n.fingerprint+'<br>압축을 모두 푼 뒤 report.html을 열어 사진과 내용을 확인하고 필요한 경우 브라우저에서 인쇄하세요. 이 파일에는 외부 전송 기능이 없습니다.</p></body></html>';
  }
  async function build(bundle, files) {
    // Capture allowed metadata and original bytes before the first asynchronous hash.
    const n = normalize(bundle, files);
    if (!root.crypto || !root.crypto.subtle) fail('hash-unavailable');
    for (let i=0;i<n.files.length;i++) {
      const f = n.files[i]; magic(f);
      const bytes = new Uint8Array(await root.crypto.subtle.digest('SHA-256',f.bytes));
      const actual = Array.from(bytes,b => b.toString(16).padStart(2,'0')).join('');
      if (actual !== f.sha256) fail('hash-mismatch');
      f.path = 'originals/'+String(i+1).padStart(3,'0')+'.'+EXT[f.mime];
    }
    const manifest = {schema:1,purpose:'insurance-preparation-not-submission',fingerprint:n.fingerprint,project:{id:n.project.id,name:n.project.name},claimId:n.claim.id,
      originals:n.files.map(f => ({id:f.id,path:f.path,mime:f.mime,size:f.size,sha256:f.sha256,kind:f.kind,taskId:f.taskId,phase:f.phase,caption:f.caption}))};
    const costCsv = '\uFEFF'+[['구분','세부 내용','입력 금액(원)'],...n.claim.items.map(i => [COST[i.kind],i.description,i.amount]),['합계','',n.claim.amount]].map(r => r.map(csv).join(',')).join('\r\n')+'\r\n';
    const entries = n.files.map(f => ({name:f.path,bytes:f.bytes}));
    for (const [name,body] of [['report.html',report(n)],['cost-items.csv',costCsv],['manifest.json',JSON.stringify(manifest,null,2)],['제출전-확인.txt',WARNING+'\n압축을 모두 푼 뒤 report.html을 열어 확인하세요.\n보험사 요구서류와 제출 권한을 별도로 확인하세요.\n원본 사진에 위치·개인정보가 포함될 수 있습니다.\n다운로드는 실제 제출이 아니며 자동 전송하지 않습니다.\n']]) entries.push({name,bytes:encoder.encode(body)});
    return zip(entries);
  }
  root.HJTeamPacket = Object.freeze({build});
})(typeof window !== 'undefined' ? window : globalThis);
