'use strict';
/** ============================================================
 * 만물인테리어 관리사무소 접수 — 독립 Apps Script 프로젝트 (office-intake-v1)
 * ------------------------------------------------------------
 * 만물웹 office-request.html 이 부르는 공개 관리사무소 action 만 받는다:
 *   officeLogin · officeList · officeGet · officeCreate · officeUpdate · officeCancel · officeUpload · officePhoto
 * 현장 자료 저장·사진 중계·원본 내려받기·현장웹 내부 action 코드는 이 프로젝트에 없다 — 잠금·실행 시간을 현장 중계와 따로 쓴다.
 *
 * 같은 프로젝트에 넣는 파일(모두 이 폴더에 있다):
 *   IntakeMain.gs(이 파일) · OfficeIntake.gs · OfficeIntakePure.gs · appsscript.json
 *   OfficeIntake.gs·OfficeIntakePure.gs 는 apps-script/ 의 같은 이름 파일과 글자 하나까지 같아야 한다
 *   (tests/office-intake-split.unit.js 가 지킨다 — 고칠 때는 apps-script/ 쪽을 고치고 그대로 복사).
 *   중계 프로젝트(Code.gs)에 이 파일을 넣지 않는다. 넣으면 doPost 가 겹친다.
 *
 * 스크립트 속성(값은 프로젝트 설정에만 — 코드·Git·문서·채팅에 적지 않는다):
 *   OFFICE_INTAKE_ENABLED   정확히 '1' 일 때만 공개 로그인·접수·사진 올리기를 받는다.
 *   OFFICE_SESSION_SECRET   현장 중계 프로젝트의 같은 이름 값과 똑같이(32자 이상). 중계가 PIN 을 바꿀 때 만든
 *                           PIN 해시를 여기서 확인하고, 관리사무소 로그인 세션도 이 키로 서명한다.
 *   DRIVE_FOLDER_ID         현장 중계와 같은 '만물인테리어' 폴더 ID. setupOfficeIntake 가 그 안에
 *                           '관리사무소접수_분리' 폴더를 만들 때만 쓴다(현장 자료 파일은 읽지 않는다).
 *   OFFICE_INTAKE_STORE_ID  setupOfficeIntake 가 직접 적는다(접수 저장 파일 ID). 이 값을 중계의 같은 이름 속성에 넣는다.
 *
 * 설치·되돌리기 순서: docs/office-intake-split-20261119.md
 * ============================================================ */

var OI_INTAKE_PROJECT = true;
var OI_INTAKE_VERSION = 'office-intake-v1';
var OI_INTAKE_TS_WINDOW_MS = 10 * 60 * 1000;      // 요청 시간 검사(±10분) — 중계와 같다
var OI_INTAKE_MAX_BODY = 4 * 1024 * 1024;         // 사진 한 장 2MB(base64 약 2.7MB) + 나머지

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, msg) { return out_({ ok: false, error: code, message: msg || code }); }
function safeMsg_(err) { return String((err && err.message) || err).slice(0, 140); }
function subFolder_(root, name) {
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// 중계 코드가 같은 프로젝트에 들어와 있으면(잘못 붙여넣음) 아무것도 받지 않는다 — 이 프로젝트에는 접수 코드만 둔다.
function oiIntakeRelayCodePresent_() {
  return typeof loadData_ === 'function' || typeof saveData_ === 'function' ||
    typeof downloadFile_ === 'function' || typeof checkToken_ === 'function';
}
function oiIntakeReady_() {
  if (oiIntakeRelayCodePresent_()) return false;
  return /^[A-Za-z0-9_-]{10,}$/.test(String(PropertiesService.getScriptProperties().getProperty('OFFICE_INTAKE_STORE_ID') || '').trim());
}

/* ---------- 진입점 ---------- */
// GET: 배포 확인용. 접수 자료는 돌려주지 않는다.
function doGet(e) {
  try {
    return out_({ ok: true, service: 'office-intake', version: OI_INTAKE_VERSION, ready: oiIntakeReady_() });
  } catch (err) { return fail_('server-error', safeMsg_(err)); }
}

// POST: Content-Type text/plain, 본문 = JSON 문자열 { action, ts, payload, sessionToken? } (중계와 같은 형식)
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return fail_('bad-request', '요청 본문이 없습니다');
    if (raw.length > OI_INTAKE_MAX_BODY) return fail_('too-large', '요청이 너무 큽니다');
    var req; try { req = JSON.parse(raw); } catch (_) { return fail_('bad-request', 'JSON 형식이 아닙니다'); }
    if (!req || typeof req !== 'object' || Array.isArray(req)) return fail_('bad-request', '요청 형식이 올바르지 않습니다');

    var action = String(req.action || '');
    var ts = Number(req.ts || 0);
    if (!ts || Math.abs(Date.now() - ts) > OI_INTAKE_TS_WINDOW_MS) return fail_('bad-request', '요청 시간이 유효하지 않습니다(기기 시계를 확인하세요)');
    // 공개 관리사무소 action 만. 현장웹 내부 action(officeInbox 등)과 현장 자료 action 은 여기 없다.
    if (!oiIsPublicAction_(action)) return fail_('bad-request', '이 주소는 관리사무소 접수만 받습니다');
    if (!oiIntakeReady_()) return fail_('not-configured', '관리사무소 접수 서비스가 아직 설정되지 않았습니다');
    return out_(oiHandlePublicAction_(action, req));
  } catch (err) { return fail_('server-error', safeMsg_(err)); }
}

/* ---------- 처음 한 번: 편집기에서 실행 ---------- */
// 1) '만물인테리어/관리사무소접수_분리/' 폴더와 접수 저장 파일을 만들고(이미 있으면 그대로)
// 2) 저장 파일 ID 를 이 프로젝트 속성 OFFICE_INTAKE_STORE_ID 에 적고 실행 기록에 보여 준다.
// 이 함수를 처음 실행할 때 구글이 권한 승인을 묻는다 — 대표가 직접 승인한다.
function setupOfficeIntake() {
  if (oiIntakeRelayCodePresent_()) throw new Error('이 프로젝트에 현장 중계(Code.gs) 코드가 같이 있어요. 새 프로젝트에는 apps-script-office-intake 폴더의 파일만 넣어 주세요.');
  var props = PropertiesService.getScriptProperties();
  var storeId = String(props.getProperty('OFFICE_INTAKE_STORE_ID') || '').trim();
  var file;
  if (storeId) {
    // 이미 만든 저장 파일이 있으면 새로 만들지 않는다(접수가 두 파일로 갈라지지 않게).
    try { file = DriveApp.getFileById(storeId); }
    catch (_) { throw new Error('OFFICE_INTAKE_STORE_ID 의 파일을 찾지 못했어요. 값을 지우지 말고 Claude 에게 알려 주세요.'); }
  } else {
    var rootId = String(props.getProperty('DRIVE_FOLDER_ID') || '').trim();
    if (!rootId) throw new Error('DRIVE_FOLDER_ID 속성이 없어요. 현장 중계 프로젝트와 같은 만물인테리어 폴더 ID 를 넣어 주세요.');
    var folder = subFolder_(DriveApp.getFolderById(rootId), OI_SPLIT_FOLDER);
    var existing = folder.getFilesByName(OI_SPLIT_OFFICE_FILE);
    file = existing.hasNext() ? existing.next()
      : folder.createFile(OI_SPLIT_OFFICE_FILE, JSON.stringify(oiSplitEmptyDoc_('office')), 'application/json');
    props.setProperty('OFFICE_INTAKE_STORE_ID', file.getId());
  }
  var secretOk = String(props.getProperty('OFFICE_SESSION_SECRET') || '').length >= 32;
  var enabled = props.getProperty('OFFICE_INTAKE_ENABLED') === '1';
  Logger.log('준비됐어요. 접수 저장 파일 ID (현장 중계의 OFFICE_INTAKE_STORE_ID 에 넣을 값): ' + file.getId());
  Logger.log('OFFICE_SESSION_SECRET: ' + (secretOk ? '있음' : '없거나 너무 짧음 — 현장 중계와 같은 값을 넣어 주세요'));
  Logger.log('OFFICE_INTAKE_ENABLED: ' + (enabled ? '켜짐(1)' : '꺼짐 — 받을 준비가 되면 1'));
  return { ok: true, storeFileId: file.getId(), secretOk: secretOk, enabled: enabled };
}
