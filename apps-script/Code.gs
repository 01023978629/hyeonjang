/** ============================================================
 * 만물인테리어 현장관리 — Apps Script 클라우드 중계 서버 (relay-v3)
 * ------------------------------------------------------------
 * 목적: 모바일(사파리·카톡/네이버 인앱)에서 Google OAuth 팝업 없이
 *       기존 Google Drive '만물인테리어' 폴더에 저장/불러오기/업로드.
 * 구조: 웹(fetch, text/plain POST) → 이 웹앱(배포자 권한으로 실행)
 *       → DriveApp → 기존 폴더/현장데이터.json (데이터 이전 없음)
 *
 * 설정(코드에 하드코딩 금지 — 프로젝트 설정 ▸ 스크립트 속성):
 *   APP_TOKEN         필수. 웹과 서버가 공유하는 인증키(긴 무작위 문자열)
 *   DRIVE_FOLDER_ID   필수. 기존 '만물인테리어' 폴더 ID
 *   DATA_FILE_NAME    선택. 기본 '현장데이터.json'
 *   BACKUP_KEEP_COUNT 선택. 기본 14 (날짜별 백업 보관 개수)
 *
 * 보안 한계(정직 고지): APP_TOKEN은 브라우저에 저장되므로 완전한
 * 비밀이 아닙니다. 기기를 아는 사람이면 추출할 수 있습니다.
 * 1인 내부 업무용 전제의 최소 인증이며, 다중 사용자 운영 시에는
 * Supabase Auth 등 계정 기반 인증 서버로 교체해야 합니다.
 * ============================================================ */

var RELAY_VERSION = 'relay-v4';
var ALLOWED_ACTIONS = ['health', 'load', 'save', 'backup', 'upload', 'listFiles', 'thumbnail', 'download'];
var TS_WINDOW_MS = 10 * 60 * 1000;          // 요청 시간 검사(±10분)
var MAX_BODY = 15 * 1024 * 1024;            // 요청 전체 상한
var MAX_SAVE = 10 * 1024 * 1024;            // 현장데이터 JSON 상한
var MAX_UPLOAD_B64 = 12 * 1024 * 1024;      // 업로드 base64 상한(≈9MB 파일)
var MAX_PREVIEW_BYTES = 4 * 1024 * 1024;    // 썸네일 미생성 직후 원본 폴백 상한
var MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;  // PC 정리용 원본 내려받기 상한
var PHOTO_FOLDER = '현장사진';
var DOC_FOLDER = '견적서';
var ALLOWED_MIME = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  doc: ['application/pdf', 'image/jpeg', 'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel']
};

/* ---------- 공통 ---------- */
function props_() { return PropertiesService.getScriptProperties(); }
function cfg_(k, d) { var v = props_().getProperty(k); return (v == null || v === '') ? d : v; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, msg) { return out_({ ok: false, error: code, message: msg || code }); }
// 오류 원문 과다 노출 방지: 메시지를 짧게 자르고 스택은 보내지 않음
function safeMsg_(err) { return String((err && err.message) || err).slice(0, 140); }
function checkToken_(t) {
  var want = cfg_('APP_TOKEN', '');
  if (!want) return 'not-configured';
  if (!t || String(t) !== want) return 'unauthorized';
  return '';
}

/* ---------- 진입점 ---------- */
// GET: 주소창으로 간단 확인용(health만). 실제 앱은 전부 POST를 씁니다.
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if ((p.action || 'health') !== 'health') return fail_('bad-request', 'GET은 health만 지원합니다');
    var tk = checkToken_(p.token);
    if (tk) return fail_(tk, tk === 'not-configured' ? '서버에 APP_TOKEN이 설정되지 않았습니다' : '인증키가 일치하지 않습니다');
    return out_(health_());
  } catch (err) { return fail_('server-error', safeMsg_(err)); }
}

// POST: Content-Type text/plain(사전 OPTIONS 요청 회피), 본문 = JSON 문자열
// { token, action, deviceId, ts, payload }
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return fail_('bad-request', '요청 본문이 없습니다');
    if (raw.length > MAX_BODY) return fail_('too-large', '요청이 너무 큽니다');
    var req; try { req = JSON.parse(raw); } catch (_) { return fail_('bad-request', 'JSON 형식이 아닙니다'); }

    var tk = checkToken_(req.token);
    if (tk) return fail_(tk, tk === 'not-configured' ? '서버에 APP_TOKEN이 설정되지 않았습니다' : '인증키가 일치하지 않습니다');

    var action = String(req.action || '');
    if (ALLOWED_ACTIONS.indexOf(action) < 0) return fail_('bad-request', '허용되지 않은 action');

    var ts = Number(req.ts || 0);
    if (!ts || Math.abs(Date.now() - ts) > TS_WINDOW_MS) return fail_('bad-request', '요청 시간이 유효하지 않습니다(기기 시계를 확인하세요)');

    var deviceId = String(req.deviceId || 'unknown').slice(0, 64);
    var payload = req.payload || {};

    switch (action) {
      case 'health':   return out_(health_());
      case 'load':     return out_(loadData_());
      case 'save':     return out_(saveData_(payload, deviceId));
      case 'backup':   return out_(makeBackup_(deviceId));
      case 'upload':   return out_(uploadFile_(payload));
      case 'listFiles':return out_(listAppFiles_(payload));
      case 'thumbnail':return out_(thumbnailFile_(payload));
      case 'download': return out_(downloadFile_(payload));
    }
    return fail_('bad-request', 'unreachable');
  } catch (err) { return fail_('server-error', safeMsg_(err)); }
}

/* ---------- Drive 헬퍼 ---------- */
function rootFolder_() {
  var id = cfg_('DRIVE_FOLDER_ID', '');
  if (!id) throw new Error('DRIVE_FOLDER_ID가 설정되지 않았습니다');
  return DriveApp.getFolderById(id);
}
function dataFileName_() { return cfg_('DATA_FILE_NAME', '현장데이터.json'); }
function findDataFile_(root) {
  var it = root.getFilesByName(dataFileName_());
  return it.hasNext() ? it.next() : null;
}
// revision 메타는 파일 설명(description)에 JSON으로 보관
// 기존 파일(설명 없음)은 revision 0으로 간주 → 기존 데이터 그대로 사용 가능
function readMeta_(file) {
  try { var m = JSON.parse(file.getDescription() || ''); if (m && typeof m === 'object') return m; } catch (_) {}
  return { revision: 0, savedBy: '', savedAt: '' };
}
function writeMeta_(file, m) { try { file.setDescription(JSON.stringify(m)); } catch (_) {} }
function subFolder_(root, name) {
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function sanitizeName_(name, mime) {
  var n = String(name || '').replace(/[\\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!n) {
    var ext = mime === 'application/pdf' ? '.pdf' : (mime && mime.indexOf('image/') === 0 ? '.jpg' : '.bin');
    n = 'file_' + Date.now() + ext;
  }
  return n;
}
// 전달받은 fileId가 설정된 앱 루트 폴더 안에 있는지 확인한다.
// 하위 현장 폴더도 지원하되, 부모 탐색 깊이와 방문 수를 제한한다.
function isInsideRoot_(file, root) {
  var rootId = root.getId(), queue = [], seen = {}, depth = 0, visited = 0;
  var parents = file.getParents();
  while (parents.hasNext()) queue.push(parents.next());
  while (queue.length && depth < 8 && visited < 80) {
    var next = [];
    for (var i = 0; i < queue.length && visited < 80; i++) {
      var folder = queue[i], id = folder.getId(); visited++;
      if (id === rootId) return true;
      if (seen[id]) continue;
      seen[id] = true;
      var pp = folder.getParents();
      while (pp.hasNext()) next.push(pp.next());
    }
    queue = next; depth++;
  }
  return false;
}

/* ---------- A. health ---------- */
function health_() {
  var folderOk = false, exists = false, revision = 0;
  try {
    var root = rootFolder_(); folderOk = true;
    var f = findDataFile_(root);
    if (f) { exists = true; revision = readMeta_(f).revision || 0; }
  } catch (_) {}
  return { ok: true, version: RELAY_VERSION, folderOk: folderOk, dataFileExists: exists, revision: revision,
           caps: ALLOWED_ACTIONS };
}

/* ---------- B. load ---------- */
function loadData_() {
  var root = rootFolder_();
  var f = findDataFile_(root);
  if (!f) return { ok: true, exists: false, data: null, revision: 0, modifiedAt: '', savedBy: '' };
  var text = f.getBlob().getDataAsString('UTF-8');
  var data; try { data = JSON.parse(text); } catch (_) { return fail0_('server-error', '서버의 데이터 파일이 손상되었습니다'); }
  var m = readMeta_(f);
  return { ok: true, exists: true, data: data, revision: m.revision || 0,
           modifiedAt: f.getLastUpdated().toISOString(), savedBy: m.savedBy || '' };
}
function fail0_(code, msg) { return { ok: false, error: code, message: msg }; }

/* ---------- C. save (LockService + revision 충돌 감지) ---------- */
function saveData_(payload, deviceId) {
  var data = payload && payload.data;
  // 저장 데이터 구조 검사: serializeData() 산출물(app:'현장' 또는 version 숫자)만 허용
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail0_('bad-request', '데이터 형식이 올바르지 않습니다');
  if (data.app !== '현장' && typeof data.version !== 'number') return fail0_('bad-request', '알 수 없는 데이터 구조입니다');
  var content = JSON.stringify(data);
  if (content.length > MAX_SAVE) return fail0_('too-large', '데이터가 너무 큽니다(' + Math.round(content.length / 1048576) + 'MB)');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return fail0_('server-error', '다른 저장이 진행 중입니다. 잠시 후 다시 시도하세요');
  try {
    var root = rootFolder_();
    var f = findDataFile_(root);
    var serverRev = f ? (readMeta_(f).revision || 0) : 0;
    var baseRev = Number(payload.baseRevision);
    if (isNaN(baseRev)) baseRev = -1;

    // 충돌 감지: 파일이 있고 요청 기준 revision이 서버와 다르면 덮어쓰지 않음
    if (f && baseRev !== serverRev) {
      var m0 = readMeta_(f);
      return { ok: false, error: 'conflict', serverRevision: serverRev,
               serverModifiedAt: f.getLastUpdated().toISOString(), serverSavedBy: m0.savedBy || '' };
    }

    var now = new Date().toISOString();
    if (f) { f.setContent(content); }
    else { f = root.createFile(dataFileName_(), content, 'application/json'); }
    var newRev = serverRev + 1;
    writeMeta_(f, { revision: newRev, savedBy: deviceId, savedAt: now });
    return { ok: true, revision: newRev, savedAt: now };
  } finally { lock.releaseLock(); }
}

/* ---------- D. backup (하루 1개, 보관 개수 제한) ---------- */
function makeBackup_(deviceId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return fail0_('server-error', '다른 작업이 진행 중입니다');
  try {
    var root = rootFolder_();
    var src = findDataFile_(root);
    if (!src) return fail0_('bad-request', '백업할 데이터 파일이 없습니다');
    var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var name = '현장데이터_백업_' + today + '.json';
    var it = root.getFilesByName(name);
    if (it.hasNext()) return { ok: true, created: false, name: name }; // 오늘 이미 백업됨

    root.createFile(name, src.getBlob().getDataAsString('UTF-8'), 'application/json');
    pruneBackups_(root);
    return { ok: true, created: true, name: name };
  } finally { lock.releaseLock(); }
}
function pruneBackups_(root) {
  try {
    var keep = parseInt(cfg_('BACKUP_KEEP_COUNT', '14'), 10) || 14;
    var list = [];
    var it = root.getFiles();
    while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf('현장데이터_백업_') === 0) list.push(f); }
    list.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; }); // 이름 내림차순 = 최신 먼저
    for (var i = keep; i < list.length; i++) { try { list[i].setTrashed(true); } catch (_) {} }
  } catch (_) {}
}

/* ---------- E. upload (사진/문서 → 하위 폴더) ---------- */
function uploadFile_(payload) {
  var kind = String(payload.kind || '');
  if (kind !== 'photo' && kind !== 'doc') return fail0_('bad-request', 'kind는 photo 또는 doc만 허용');
  var mime = String(payload.mimeType || '');
  if ((ALLOWED_MIME[kind] || []).indexOf(mime) < 0) return fail0_('bad-request', '허용되지 않는 파일 형식: ' + mime.slice(0, 60));
  var b64 = String(payload.dataB64 || '');
  if (!b64) return fail0_('bad-request', '파일 내용이 없습니다');
  if (b64.length > MAX_UPLOAD_B64) return fail0_('too-large', '파일이 너무 큽니다. 사진은 앱이 자동 압축하지만, 원본 영상·대용량 파일은 지원하지 않습니다');

  var root = rootFolder_();
  var folderName = kind === 'photo' ? PHOTO_FOLDER : DOC_FOLDER;
  var folder = subFolder_(root, folderName);
  var name = sanitizeName_(payload.name, mime);
  var bytes; try { bytes = Utilities.base64Decode(b64); } catch (_) { return fail0_('bad-request', '파일 인코딩이 올바르지 않습니다'); }
  var file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  return { ok: true, fileId: file.getId(), name: file.getName(), folder: folderName };
}

/* ---------- F. listFiles ---------- */
function listAppFiles_(payload) {
  var kind = payload && payload.kind ? String(payload.kind) : '';
  var root = rootFolder_();
  var files = [], seenFolder = {}, seenFile = {}, maxFiles = 2000, maxFolders = 600, folderCount = 0;
  function addFile(f, k, recoverOnly) {
    if (files.length >= maxFiles) return;
    var id = f.getId(); if (seenFile[id]) return; seenFile[id] = true;
    var mime = String(f.getMimeType() || '');
    if (k === 'photo' && mime.indexOf('image/') !== 0) return;
    files.push({ id: id, name: f.getName(), mimeType: mime,
                 modifiedAt: f.getLastUpdated().toISOString(), size: f.getSize(), kind: k,
                 recoverOnly: !!recoverOnly });
  }
  function collectTree(start, k, recoverOnly) {
    if (!start) return;
    var queue = [{ folder: start, depth: 0, recoverOnly: !!recoverOnly }];
    while (queue.length && files.length < maxFiles && folderCount < maxFolders) {
      var cur = queue.shift(), folder = cur.folder, fid = folder.getId();
      if (seenFolder[fid]) continue; seenFolder[fid] = true; folderCount++;
      var fit = folder.getFiles();
      while (fit.hasNext() && files.length < maxFiles) addFile(fit.next(), k, cur.recoverOnly);
      if (cur.depth >= 8) continue;
      var dit = folder.getFolders();
      while (dit.hasNext() && queue.length < maxFolders) queue.push({ folder: dit.next(), depth: cur.depth + 1, recoverOnly: cur.recoverOnly });
    }
  }
  function firstFolder(name) { var it = root.getFoldersByName(name); return it.hasNext() ? it.next() : null; }

  if (!kind || kind === 'photo') {
    var photoRoot = firstFolder(PHOTO_FOLDER);
    if (photoRoot) collectTree(photoRoot, 'photo', false);
    // 과거에 현장별 하위 폴더로 이동된 사진도 기존 빈 기록과 다시 연결할 수 있게 찾는다.
    // 이 범위의 미매칭 이미지는 앱에 새 사진으로 추가하지 않고 복구용으로만 반환한다.
    if (kind === 'photo' && payload && payload.deep) collectTree(root, 'photo', true);
  }
  if (!kind || kind === 'doc') collectTree(firstFolder(DOC_FOLDER), 'doc', false);
  return { ok: true, files: files, truncated: files.length >= maxFiles || folderCount >= maxFolders };
}

/* ---------- G. thumbnail (모바일 relay 전용 미리보기) ---------- */
function thumbnailFile_(payload) {
  var id = String(payload && payload.fileId || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return fail0_('bad-request', '파일 ID가 올바르지 않습니다');

  var root = rootFolder_(), file;
  try { file = DriveApp.getFileById(id); }
  catch (_) { return fail0_('not-found', '사진 파일을 찾지 못했습니다'); }
  if (!isInsideRoot_(file, root)) return fail0_('forbidden', '앱 폴더 밖의 파일은 미리볼 수 없습니다');

  var mime = String(file.getMimeType() || '');
  if (mime.indexOf('image/') !== 0) return fail0_('bad-request', '이미지 파일만 미리볼 수 있습니다');

  var blob = null, source = 'thumbnail';
  try { blob = file.getThumbnail(); } catch (_) {}
  if (!blob) {
    if (file.getSize() > MAX_PREVIEW_BYTES) return fail0_('not-ready', '미리보기를 준비 중입니다. 잠시 후 다시 열어 주세요');
    try { blob = file.getBlob(); source = 'original'; }
    catch (_) { return fail0_('not-ready', '미리보기를 아직 만들지 못했습니다'); }
  }
  var bytes = blob.getBytes();
  if (bytes.length > MAX_PREVIEW_BYTES) return fail0_('too-large', '미리보기 파일이 너무 큽니다');
  return { ok: true, fileId: id, name: file.getName(),
           mimeType: blob.getContentType() || 'image/jpeg', source: source,
           dataB64: Utilities.base64Encode(bytes) };
}

/* ---------- H. download (PC 정리용 — 원본 파일 그대로 내려받기) ---------- */
// 썸네일이 아니라 저장된 원본 파일(사진 압축본·PDF 등)을 base64로 반환한다.
// 앱 루트('만물인테리어') 폴더 안의 파일만 허용(썸네일과 동일한 경계 검사).
function downloadFile_(payload) {
  var id = String(payload && payload.fileId || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return fail0_('bad-request', '파일 ID가 올바르지 않습니다');

  var root = rootFolder_(), file;
  try { file = DriveApp.getFileById(id); }
  catch (_) { return fail0_('not-found', '파일을 찾지 못했습니다'); }
  if (!isInsideRoot_(file, root)) return fail0_('forbidden', '앱 폴더 밖의 파일은 내려받을 수 없습니다');
  if (file.getSize() > MAX_DOWNLOAD_BYTES) return fail0_('too-large', '파일이 너무 커서 내려받을 수 없습니다(20MB 초과)');

  var blob;
  try { blob = file.getBlob(); }
  catch (_) { return fail0_('server-error', '파일을 읽지 못했습니다'); }
  return { ok: true, fileId: id, name: file.getName(),
           mimeType: blob.getContentType() || 'application/octet-stream',
           size: file.getSize(), dataB64: Utilities.base64Encode(blob.getBytes()) };
}
