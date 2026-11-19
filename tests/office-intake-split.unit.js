'use strict';
/* office-intake-split.unit.js — 관리사무소 접수 분리(2026-11-19, 항목 32)

   보호하는 사고:
   · 공개 관리사무소 접수(토큰 없는 officeLogin 등)가 현장 전체 자료(load·save·download)를 가진 중계와
     같은 스크립트·잠금·실행 시간 안에서 돈다 → 새 독립 프로젝트(apps-script-office-intake/)로 옮긴다.
   · 스위치(OFFICE_INTAKE_MODE)가 없으면 중계는 지금과 한 글자도 다르지 않게 동작해야 한다(배포 전 병합 안전).
   · 두 Apps Script 프로젝트는 잠금을 나눌 수 없다 — 한 JSON 을 둘이 쓰면 접수가 말없이 사라진다.
     그래서 파일마다 쓰는 쪽이 하나(공개 파일 = 접수 프로젝트, 내부 파일 = 중계)인지, 동시에 부딪혀도
     두 쪽 기록이 남고 현장 쪽 결정이 이기는지 본다.
   · 현장웹 접수함 동기화(officeInbox)는 예전과 같은 모양을 돌려받아야 한다(앱 코드 무변경).

   두 vm 샌드박스(중계 · 접수 프로젝트)가 가짜 Drive 하나를 나눠 쓴다. 의존성 없음(Playwright 불필요). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const RELAY_DIR = path.join(ROOT, 'apps-script');
const INTAKE_DIR = path.join(ROOT, 'apps-script-office-intake');
const read = file => fs.readFileSync(file, 'utf8');
const lf = text => text.replace(/\r\n/g, '\n');

/* ---------- 0. 파일 구성 ---------- */
for (const name of ['OfficeIntake.gs', 'OfficeIntakePure.gs']) {
  assert.equal(lf(read(path.join(INTAKE_DIR, name))), lf(read(path.join(RELAY_DIR, name))),
    'apps-script-office-intake/' + name + ' 는 apps-script/' + name + ' 와 같아야 한다(고칠 때는 apps-script 쪽을 고치고 복사)');
}
const intakeFiles = fs.readdirSync(INTAKE_DIR).sort();
assert.deepEqual(intakeFiles, ['IntakeMain.gs', 'OfficeIntake.gs', 'OfficeIntakePure.gs', 'README.md', 'appsscript.json'],
  '접수 프로젝트 폴더는 붙여넣을 파일 넷과 안내 하나뿐');
const intakeMain = read(path.join(INTAKE_DIR, 'IntakeMain.gs'));
for (const forbidden of [/function\s+(loadData_|saveData_|makeBackup_|uploadFile_|listAppFiles_|thumbnailFile_|downloadFile_|checkToken_)\b/, /UrlFetchApp|MailApp|SpreadsheetApp|GmailApp/, /getProperty\('APP_TOKEN'\)/]) {
  assert.doesNotMatch(intakeMain, forbidden, '접수 프로젝트에 현장 자료·바깥 전송·APP_TOKEN 코드가 들어오면 안 된다: ' + forbidden);
}
const intakeManifest = JSON.parse(read(path.join(INTAKE_DIR, 'appsscript.json')));
assert.deepEqual(intakeManifest.oauthScopes, ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/calendar'],
  '접수 프로젝트 권한은 Drive(접수 파일·사진)와 Calendar(긴급 접수 알림)뿐');
assert.deepEqual(intakeManifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
assert.equal(intakeManifest.timeZone, 'Asia/Seoul');
assert.equal(intakeManifest.runtimeVersion, 'V8');
console.log('PASS  0 FILES — 같은 OfficeIntake 두 벌·권한 둘·현장 자료 코드 없음');

/* ---------- 가짜 Drive(두 프로젝트가 같은 구글 계정 Drive 를 본다) ---------- */
const clock = { now: Date.parse('2026-11-19T01:00:00.000Z') };
const tick = (ms = 1000) => { clock.now += ms; return clock.now; };
let actor = 'test';
const drive = { seq: 0, files: [], folders: [], log: [] };
const nextId = prefix => prefix + String(++drive.seq).padStart(8, '0');
const iterator = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
const bytesOf = text => Array.from(Buffer.from(String(text), 'utf8'));
function makeFile(parent, name, bytes, mimeType) {
  const file = {
    id: nextId('file'), parent, name, bytes: Array.from(bytes), mimeType, trashed: false,
    getId() { return this.id; },
    getName() { return this.name; },
    getMimeType() { return this.mimeType; },
    getSize() { return this.bytes.length; },
    getParents() { return iterator(this.parent ? [this.parent] : []); },
    getThumbnail() { return null; },
    getLastUpdated() { return new Date(clock.now); },
    getBlob() {
      drive.log.push({ actor, op: 'read', id: this.id, name: this.name });
      const data = this.bytes.slice(), type = this.mimeType;
      return { getDataAsString: () => Buffer.from(data).toString('utf8'), getBytes: () => data.slice(), getContentType: () => type };
    },
    setContent(text) { drive.log.push({ actor, op: 'set', id: this.id, name: this.name }); this.bytes = bytesOf(text); },
    setTrashed(value) { drive.log.push({ actor, op: 'trash', id: this.id, name: this.name }); this.trashed = value === true; },
  };
  drive.files.push(file);
  drive.log.push({ actor, op: 'create', id: file.id, name });
  return file;
}
function makeFolder(name, parent) {
  const folder = {
    id: nextId('fold'), name, parent,
    getId() { return this.id; },
    getName() { return this.name; },
    getParents() { return iterator(this.parent ? [this.parent] : []); },
    getFilesByName(fileName) { return iterator(drive.files.filter(f => !f.trashed && f.parent === this && f.name === fileName)); },
    getFoldersByName(folderName) { return iterator(drive.folders.filter(f => f.parent === this && f.name === folderName)); },
    createFolder(folderName) { drive.log.push({ actor, op: 'mkdir', name: folderName }); const child = makeFolder(folderName, this); drive.folders.push(child); return child; },
    createFile(arg, content, mimeType) {
      if (typeof arg === 'string') return makeFile(this, arg, bytesOf(content), mimeType);
      return makeFile(this, arg.name, arg.bytes, arg.mimeType);
    },
  };
  return folder;
}
const myDrive = makeFolder('내 드라이브', null);
const hjRoot = makeFolder('만물인테리어', myDrive);
drive.folders.push(myDrive, hjRoot);
const fileById = id => drive.files.find(f => f.id === id && !f.trashed);
const fileByName = (name, parent) => drive.files.find(f => !f.trashed && f.name === name && (!parent || f.parent === parent));
const jsonOf = file => JSON.parse(Buffer.from(file.bytes).toString('utf8'));
const pathOf = file => { const parts = [file.name]; for (let f = file.parent; f && f.parent; f = f.parent) parts.unshift(f.name); return parts.join('/'); };

/* ---------- 샌드박스(프로젝트마다 자기 속성·캐시·잠금) ---------- */
let uuidSeq = 0;
function formatDate(date, timezone, pattern) {
  assert.equal(timezone, 'Asia/Seoul');
  assert.equal(pattern, 'yyyyMMdd');
  const p = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).reduce((o, x) => { o[x.type] = x.value; return o; }, {});
  return p.year + p.month + p.day;
}
function makeSandbox(label, dir, names, properties) {
  const cache = new Map();
  const lockEvents = [];
  const logs = [];
  const calendar = { fail: false, events: [] };
  const SandboxDate = class extends Date { static now() { return clock.now; } };
  const sandbox = {
    JSON, Math, String, Number, Array, Object, Error, RegExp, Boolean, isFinite, console,
    Date: SandboxDate,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => Object.prototype.hasOwnProperty.call(properties, k) ? properties[k] : null,
      setProperty: (k, v) => { properties[k] = String(v); },
      deleteProperty: k => { delete properties[k]; },
    }) },
    CacheService: { getScriptCache: () => ({
      get: k => cache.has(k) ? cache.get(k) : null,
      put: (k, v) => { cache.set(k, String(v)); },
      remove: k => { cache.delete(k); },
    }) },
    LockService: { getScriptLock: () => ({
      tryLock: () => { lockEvents.push('try'); return true; },
      waitLock: t => { lockEvents.push('wait:' + t); },
      releaseLock: () => { lockEvents.push('release'); },
    }) },
    Utilities: {
      computeHmacSha256Signature: (text, key) => bytesOf('test-hmac:' + String(key) + ':' + String(text)),
      // Apps Script 처럼 문자열(UTF-8)과 바이트 배열을 둘 다 받는다.
      base64EncodeWebSafe: value => (typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(Array.from(value))).toString('base64url'),
      base64DecodeWebSafe: value => Array.from(Buffer.from(String(value), 'base64url')),
      base64Decode: value => Array.from(Buffer.from(String(value), 'base64')),
      base64Encode: value => (typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(Array.from(value || []))).toString('base64'),
      formatDate,
      newBlob: (bytes, mimeType, name) => {
        const data = typeof bytes === 'string' ? bytesOf(bytes) : Array.from(bytes);
        return { bytes: data, mimeType, name, getDataAsString: () => Buffer.from(data).toString('utf8'), getBytes: () => data.slice() };
      },
      getUuid: () => 'uuid-' + label + '-' + (++uuidSeq),
    },
    DriveApp: {
      getFolderById: id => { const f = drive.folders.find(x => x.id === id); if (!f) throw new Error('not-found'); return f; },
      getFileById: id => { const f = fileById(id); if (!f) throw new Error('not-found'); return f; },
      createFolder: name => myDrive.createFolder(name),
    },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    CalendarApp: { getDefaultCalendar: () => ({ createEvent: (title) => { if (calendar.fail) throw new Error('calendar-down'); calendar.events.push(title); } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; }, getContent() { return this.text; } }) },
    Logger: { log: msg => logs.push(String(msg)) },
  };
  vm.createContext(sandbox);
  for (const name of names) vm.runInContext(read(path.join(dir, name)), sandbox, { filename: label + '/' + name });
  return { label, sandbox, properties, cache, lockEvents, logs, calendar };
}
function as(who, run) { const saved = actor; actor = who; try { return run(); } finally { actor = saved; } }
function post(sb, body) {
  return as(sb.label, () => JSON.parse(sb.sandbox.doPost({ postData: { contents: JSON.stringify(Object.assign({ ts: clock.now }, body)) } }).getContent()));
}

const TOKEN = 'TEST_ONLY_RELAY_TOKEN';
const SECRET = 'TEST_ONLY_SHARED_SESSION_SECRET_0123456789';
const relayProps = { APP_TOKEN: TOKEN, DRIVE_FOLDER_ID: hjRoot.id, OFFICE_INTAKE_ENABLED: '1', OFFICE_SESSION_SECRET: SECRET };
const relay = makeSandbox('relay', RELAY_DIR, ['OfficeIntakePure.gs', 'Code.gs', 'OfficeIntake.gs'], relayProps);
const intakeProps = { OFFICE_INTAKE_ENABLED: '1', OFFICE_SESSION_SECRET: SECRET, DRIVE_FOLDER_ID: hjRoot.id };
const intake = makeSandbox('intake', INTAKE_DIR, ['OfficeIntakePure.gs', 'OfficeIntake.gs', 'IntakeMain.gs'], intakeProps);
const internalCall = (action, payload) => post(relay, { action, token: TOKEN, payload: payload || {} });
const officeCall = (sb, action, payload, sessionToken) => post(sb, Object.assign({ action, payload: payload || {} }, sessionToken ? { sessionToken } : {}));
const PUBLIC_ACTIONS = ['officeLogin', 'officeList', 'officeGet', 'officeCreate', 'officeUpdate', 'officeCancel', 'officeUpload', 'officePhoto'];

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const uuid = n => '0000000' + n + '-0000-4000-8000-00000000000' + n;
function createPayload(key, extra) {
  return Object.assign({
    idempotencyKey: key, unit: '101동 1001호', location: '욕실 천장', issueType: '누수', pipeType: '미확정', urgency: 'normal',
    description: '아랫집 천장에서 물이 떨어져요', officeContact: { name: '관리소 담당', phone: '01000000001' }, residentContact: null,
    preferredVisitDate: '', privacyConsent: true, expectedUploadIds: [],
  }, extra || {});
}

/* ---------- 1. 스위치 없음 = 지금과 같다 ---------- */
assert.equal(relay.sandbox.oiRole_(), 'local');
for (const value of ['', 'External', ' external', 'external ', '1', 'true', 'on']) {
  relayProps.OFFICE_INTAKE_MODE = value;
  assert.equal(relay.sandbox.oiRole_(), 'local', '정확히 external 이 아니면 지금처럼(local): ' + JSON.stringify(value));
}
delete relayProps.OFFICE_INTAKE_MODE;
// 현장웹 관리 화면이 하는 그대로: 단지 등록 → PIN 발급(중계, APP_TOKEN)
let r = internalCall('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: true });
assert.equal(r.ok, true, 'local admin upsert');
r = internalCall('officeRotatePin', { officeId: 'of1' });
assert.equal(r.ok, true, 'local pin rotate');
let pin = r.pin;
assert.match(pin, /^\d{6}$/);
tick();
let login = officeCall(relay, 'officeLogin', { slug: 'sample-apt', pin });
assert.equal(login.ok, true, '스위치 없음: 중계가 공개 로그인을 그대로 받는다');
tick();
r = officeCall(relay, 'officeCreate', createPayload('local-1'), login.sessionToken);
assert.equal(r.ok, true, '스위치 없음: 중계가 접수를 그대로 받는다');
const localFile = fileByName('관리사무소접수.json', hjRoot);
assert.ok(localFile, '스위치 없음: 예전 자리(만물인테리어/관리사무소접수.json)에 쓴다');
const localKeys = Object.keys(jsonOf(localFile).requests[0]).sort();
const localBytes = localFile.bytes.slice();
tick();
r = internalCall('officeInbox', {});
assert.equal(r.ok, true);
assert.deepEqual(r.requests.map(x => x.idempotencyKey), ['local-1']);
assert.equal(fileByName('관리사무소접수_공개.json'), undefined, '스위치 없음: 새 저장 파일을 만들지 않는다');
assert.equal(fileByName('관리사무소접수_내부.json'), undefined);
console.log('PASS  1 LOCAL — 속성이 없거나 정확히 external 이 아니면 예전 그대로');

/* ---------- 2. 접수 프로젝트 준비 ---------- */
let got = JSON.parse(intake.sandbox.doGet({}).getContent());
assert.deepEqual(got, { ok: true, service: 'office-intake', version: 'office-intake-v1', ready: false });
assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin }).error, 'not-configured', '준비 전에는 받지 않는다');
for (const action of ['officeInbox', 'officeAccept', 'officeSetStatus', 'officeAdminUpsert', 'officeRotatePin', 'officeDisable', 'officeRetentionList', 'load', 'save', 'download', 'health']) {
  const res = post(intake, { action, token: TOKEN, payload: {} });
  assert.equal(res.error, 'bad-request', '접수 프로젝트는 내부·현장 자료 action 을 받지 않는다: ' + action);
}
assert.equal(post(intake, { action: 'officeLogin', ts: clock.now - 11 * 60 * 1000, payload: {} }).error, 'bad-request', '요청 시간 ±10분');
assert.deepEqual(JSON.parse(JSON.stringify(intake.sandbox.oiHandleInternalAction_('officeInbox', { payload: {} }))), { ok: false, error: 'bad-request' }, '안쪽에서도 내부 action 거절');
const beforeSetup = drive.log.length;
const setup = as('intake', () => intake.sandbox.setupOfficeIntake());
assert.equal(setup.ok, true);
assert.equal(setup.secretOk, true);
assert.equal(setup.enabled, true);
const officeFile = fileById(setup.storeFileId);
assert.equal(pathOf(officeFile), '만물인테리어/관리사무소접수_분리/관리사무소접수_공개.json', '접수 폴더는 만물인테리어 안(현장웹이 중계로 사진을 볼 수 있게)');
assert.equal(intakeProps.OFFICE_INTAKE_STORE_ID, officeFile.id, 'setup 이 자기 속성에 저장 파일 ID 를 적는다');
assert.deepEqual(jsonOf(officeFile), { version: 1, kind: 'office', requests: [], audit: [], operationalErrors: [] });
assert.ok(intake.logs.some(line => line.includes(officeFile.id)), '실행 기록에 중계에 넣을 ID 를 보여 준다');
assert.equal(intake.logs.join('\n').includes(SECRET), false, '실행 기록에 비밀값을 쓰지 않는다');
assert.deepEqual(drive.log.slice(beforeSetup).filter(e => e.op !== 'read').map(e => e.actor + ':' + e.op + ':' + e.name),
  ['intake:mkdir:관리사무소접수_분리', 'intake:create:관리사무소접수_공개.json'], 'setup 은 폴더 하나·파일 하나만 만든다(현장 자료를 읽지 않음)');
assert.equal(drive.log.slice(beforeSetup).some(e => e.op === 'read'), false);
const again = as('intake', () => intake.sandbox.setupOfficeIntake());
assert.equal(again.storeFileId, officeFile.id, '다시 실행해도 같은 파일(갈라지지 않음)');
assert.equal(drive.files.filter(f => f.name === '관리사무소접수_공개.json').length, 1);
got = JSON.parse(intake.sandbox.doGet({}).getContent());
assert.equal(got.ready, true);
// 잘못 붙여넣음: 중계 Code.gs 가 같은 프로젝트에 있으면 아무것도 받지 않는다.
const mixed = makeSandbox('mixed', INTAKE_DIR, ['OfficeIntakePure.gs', 'OfficeIntake.gs', 'IntakeMain.gs'], { OFFICE_INTAKE_STORE_ID: officeFile.id, OFFICE_INTAKE_ENABLED: '1', OFFICE_SESSION_SECRET: SECRET, DRIVE_FOLDER_ID: hjRoot.id });
vm.runInContext(read(path.join(RELAY_DIR, 'Code.gs')).replace(/function doPost\(e\)/, 'function relayDoPost_(e)').replace(/function doGet\(e\)/, 'function relayDoGet_(e)'), mixed.sandbox, { filename: 'mixed/Code.gs' });
assert.equal(JSON.parse(mixed.sandbox.doGet({}).getContent()).ready, false);
assert.equal(officeCall(mixed, 'officeLogin', { slug: 'sample-apt', pin }).error, 'not-configured');
assert.throws(() => mixed.sandbox.setupOfficeIntake(), /현장 중계/);
console.log('PASS  2 SETUP — 폴더·파일 하나, ID 는 기록에, 비밀값 없음, 내부 action 거절, 잘못 붙여넣으면 멈춤');

/* ---------- 3. 중계 스위치 켜기 ---------- */
relayProps.OFFICE_INTAKE_MODE = 'external';
assert.equal(relay.sandbox.oiRole_(), 'relay-external');
r = internalCall('officeInbox', {});
assert.equal(r.ok, false, '저장 파일 ID 없이 켜면 동기화가 멈춘다(예전 파일로 슬쩍 돌아가지 않음)');
assert.match(r.message, /office-intake-store-not-configured/);
relayProps.OFFICE_INTAKE_STORE_ID = officeFile.id;
for (const action of PUBLIC_ACTIONS) {
  const logAt = drive.log.length, lockAt = relay.lockEvents.length;
  const res = officeCall(relay, action, { slug: 'sample-apt', pin, requestId: 'x', photoId: 'y' }, login.sessionToken);
  assert.equal(res.error, 'office-intake-moved', '스위치 켜짐: 중계는 공개 action 을 받지 않는다: ' + action);
  assert.match(res.message, /옮겨졌어요/);
  assert.equal(drive.log.length, logAt, 'moved 는 Drive 를 건드리지 않는다: ' + action);
  assert.equal(relay.lockEvents.length, lockAt, 'moved 는 잠금을 잡지 않는다: ' + action);
}
assert.equal(post(relay, { action: 'officeInbox', payload: {} }).error, 'unauthorized', '내부 action 은 여전히 APP_TOKEN 필요');
tick();
r = internalCall('officeInbox', {});
assert.equal(r.ok, true, '스위치 켜짐: 접수함 동기화');
assert.deepEqual(r.requests, [], '바깥 저장소에는 아직 접수 없음(예전 파일의 접수는 섞이지 않는다)');
const internalFile = fileByName('관리사무소접수_내부.json', officeFile.parent);
assert.ok(internalFile, '첫 동기화가 내부 파일(단지 목록 사본)을 공개 파일 옆에 만든다');
assert.deepEqual(jsonOf(internalFile).config, JSON.parse(relayProps.OFFICE_CONFIG_JSON), '단지 목록 사본 = 중계 속성 그대로');
assert.doesNotMatch(Buffer.from(internalFile.bytes).toString('utf8'), /"pin"\s*:/, '평문 PIN 칸은 어디에도 없다');
assert.deepEqual(localFile.bytes, localBytes, '예전 접수 파일은 그대로(되돌리기용)');
const publishedAt = drive.log.length;
r = internalCall('officeInbox', {});
assert.equal(drive.log.slice(publishedAt).some(e => e.op === 'set' || e.op === 'create'), false, '단지 목록이 같으면 동기화는 읽기만');
console.log('PASS  3 SWITCH — 공개 8개 moved(잠금·Drive 0) · ID 없으면 멈춤 · 첫 동기화가 단지 목록 사본을 만든다');

/* ---------- 4. 새 주소로 로그인 · 실패 잠금 ---------- */
tick();
login = officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin });
assert.equal(login.ok, true, '새 접수 프로젝트: 중계가 만든 PIN 해시로 로그인');
assert.deepEqual(Object.keys(login).sort(), ['expiresAt', 'office', 'ok', 'sessionToken']);
assert.equal(intake.sandbox.oiVerifySession_(login.sessionToken, clock.now).officeId, 'of1');
const otherSecret = makeSandbox('intake-other-secret', INTAKE_DIR, ['OfficeIntakePure.gs', 'OfficeIntake.gs', 'IntakeMain.gs'], { OFFICE_INTAKE_ENABLED: '1', OFFICE_SESSION_SECRET: 'TEST_ONLY_DIFFERENT_SECRET_000000000000', OFFICE_INTAKE_STORE_ID: officeFile.id });
assert.equal(officeCall(otherSecret, 'officeLogin', { slug: 'sample-apt', pin }).error, 'invalid-credentials', 'OFFICE_SESSION_SECRET 가 중계와 다르면 로그인 안 됨(문서의 "같은 값" 이유)');
intake.cache.clear();
const wrong = String((Number(pin) + 1) % 1000000).padStart(6, '0');
for (let i = 0; i < 5; i++) { tick(); assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin: wrong }).error, 'invalid-credentials'); }
tick();
assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin }).error, 'rate-limited', 'PIN 실패 잠금(10분 5회)은 새 프로젝트에서도 그대로');
for (let i = 0; i < 12; i++) assert.equal(officeCall(intake, 'officeLogin', { slug: 'unknown-' + String(i).padStart(3, '0'), pin: wrong }).error, 'invalid-credentials');
assert.equal(officeCall(intake, 'officeLogin', { slug: 'unknown-edge', pin: wrong }).error, 'rate-limited', '없는 단지 이름 돌려 막기(12회)도 그대로');
const limitedAt = drive.log.length, limitedLocks = intake.lockEvents.length;
for (let i = 0; i < 20; i++) assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin }).error, 'rate-limited');
for (let i = 0; i < 20; i++) assert.equal(officeCall(intake, 'officeLogin', { slug: 'rotate-' + String(i).padStart(3, '0'), pin: wrong }).error, 'rate-limited');
assert.equal(drive.log.length, limitedAt, '잠긴 뒤 반복 시도는 Drive 를 읽지도 쓰지도 않는다(단지 목록은 30초 기억)');
assert.equal(intake.lockEvents.length, limitedLocks, '잠긴 뒤 반복 시도는 잠금을 잡지 않는다');
intake.cache.clear();
tick();
login = officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin });
assert.equal(login.ok, true);
const S = login.sessionToken;
console.log('PASS  4 LOGIN — 같은 비밀키로 PIN 확인 · 실패 잠금 그대로 · 잠긴 뒤 Drive 읽기 0');

/* ---------- 5. 접수 → 현장웹 동기화 모양 ---------- */
tick();
intake.calendar.fail = true;
r = officeCall(intake, 'officeCreate', createPayload('ext-1', { urgency: 'urgent', expectedUploadIds: [uuid(1), uuid(2)] }), S);
assert.equal(r.ok, true, '새 프로젝트가 접수를 받는다');
assert.equal(r.status, 'pending_review');
const req1 = r.requestId;
for (const n of [1, 2]) {
  tick();
  const up = officeCall(intake, 'officeUpload', { requestId: req1, uploadId: uuid(n), mimeType: 'image/jpeg', dataB64: Buffer.from(JPEG.concat([n])).toString('base64') }, S);
  assert.equal(up.ok, true, '사진 올리기 ' + n);
  assert.match(pathOf(fileById(up.fileId)), /^만물인테리어\/관리사무소접수_분리\/관리사무소접수\/sample-apt\/MM-\d{8}-\d{4}\/MM-/);
}
tick();
r = internalCall('officeInbox', {});
assert.equal(r.ok, true);
assert.equal(r.requests.length, 1);
const inboxed = r.requests[0];
assert.deepEqual(Object.keys(inboxed).filter(k => k !== 'overdue').sort(), localKeys, '현장웹이 받는 접수 한 줄의 칸이 예전(한 파일)과 같다');
assert.equal(inboxed.status, 'pending_review');
assert.equal(inboxed.photos.length, 2);
assert.deepEqual(inboxed.expectedUploadIds, [uuid(1), uuid(2)]);
assert.deepEqual([inboxed.hyeonjangOrderId, inboxed.publicAmount, inboxed.visitAt, inboxed.completionReport, inboxed.projectionRevision, inboxed.needsInfoReason], [null, null, null, null, 0, null]);
assert.deepEqual(inboxed.completionPhotos, []);
assert.equal(inboxed.officeContact.phone, '010-0000-0001');
assert.ok(r.operationalErrors.some(e => e.code === 'calendar-failed' && e.requestId === req1), '접수 쪽 운영 오류(긴급 알림 실패)도 동기화에 보인다');
assert.equal(typeof r.cursor, 'string');
// 현장웹은 관리사무소 사진을 중계로 본다 — 접수 폴더가 만물인테리어 안이라 thumbnail 이 막히지 않는다.
const thumb = internalCall('thumbnail', { fileId: inboxed.photos[0].fileId });
assert.equal(thumb.ok, true, '현장웹이 관리사무소 사진을 중계로 볼 수 있다');
r = internalCall('officeInbox', { updatedAfter: r.cursor });
assert.deepEqual(r.requests, [], '커서 뒤에는 새 것 없음');
console.log('PASS  5 INBOX — 같은 칸·사진·운영 오류·커서 · 관리사무소 사진도 중계로 보임');

/* ---------- 6. 현장 쪽 결정 · 관리사무소 쪽 결정 ---------- */
tick();
r = internalCall('officeAccept', { requestId: req1, hyeonjangOrderId: 'order-1', attachedUploadIds: [uuid(1), uuid(2)] });
assert.equal(r.ok, true, '중계 접수(accept)');
assert.equal(r.status, 'accepted');
tick();
r = officeCall(intake, 'officeGet', { requestId: req1 }, S);
assert.equal(r.request.status, 'accepted', '관리사무소 화면에 현장 쪽 결정이 보인다');
assert.equal(Object.hasOwn(r.request, 'hyeonjangOrderId'), false, '공개 응답에 현장 order 는 없다(예전과 같음)');
assert.equal(officeCall(intake, 'officeCancel', { requestId: req1 }, S).error, 'invalid-status', '접수된 뒤에는 관리사무소가 취소 못 함');
// 정보 요청 → 관리사무소 보완 → 다시 검토 대기(관리사무소 쪽이 이김) → 접수(현장 쪽이 이김)
tick();
r = officeCall(intake, 'officeCreate', createPayload('ext-2'), S);
const req2 = r.requestId;
tick();
r = internalCall('officeSetStatus', { requestId: req2, status: 'needs_info', reason: '사진을 더 보내 주세요' });
assert.equal(r.ok, true);
assert.equal(r.status, 'needs_info');
tick();
r = officeCall(intake, 'officeGet', { requestId: req2 }, S);
assert.equal(r.request.status, 'needs_info');
assert.equal(r.request.needsInfoReason, '사진을 더 보내 주세요');
tick();
r = officeCall(intake, 'officeUpdate', { requestId: req2, description: '세대 안 욕실 천장 점검구에서 물이 샙니다' }, S);
assert.equal(r.ok, true);
assert.equal(r.status, 'pending_review', '관리사무소 보완 → 검토 대기');
tick();
r = internalCall('officeInbox', {});
let row = r.requests.find(x => x.requestId === req2);
assert.equal(row.status, 'pending_review', '현장웹도 보완된 접수를 다시 받는다');
assert.equal(row.needsInfoReason, null, '보완하면 요청 사유가 지워진다(예전과 같음)');
assert.equal(row.description, '세대 안 욕실 천장 점검구에서 물이 샙니다');
tick();
assert.equal(internalCall('officeAccept', { requestId: req2, hyeonjangOrderId: 'order-2', attachedUploadIds: [] }).status, 'accepted');
tick();
assert.equal(officeCall(intake, 'officeGet', { requestId: req2 }, S).request.status, 'accepted');
console.log('PASS  6 DECISIONS — 접수·정보 요청·보완·다시 접수가 두 프로젝트 사이에서 이어진다');

/* ---------- 7. 동시에 부딪힘 — 두 기록 모두 남고 현장 쪽이 이긴다 ---------- */
function hideInternalFile(run) { const saved = internalFile.name; internalFile.name = 'hidden-for-test'; try { return run(); } finally { internalFile.name = saved; } }
// (가) 중계가 먼저 접수했는데 접수 프로젝트가 그걸 못 본 채 취소
tick();
const req3 = officeCall(intake, 'officeCreate', createPayload('ext-3'), S).requestId;
tick();
assert.equal(internalCall('officeAccept', { requestId: req3, hyeonjangOrderId: 'order-3', attachedUploadIds: [] }).ok, true);
tick();
r = hideInternalFile(() => officeCall(intake, 'officeCancel', { requestId: req3 }, S));
assert.equal(r.ok, true, '옛 화면을 본 취소는 일단 받아 적힌다');
let officeRecord = jsonOf(officeFile).requests.find(x => x.requestId === req3);
assert.equal(officeRecord.status, 'cancelled', '관리사무소 쪽 기록은 남는다');
assert.equal(jsonOf(internalFile).projections[req3].status, 'accepted', '현장 쪽 기록도 남는다');
assert.equal(officeCall(intake, 'officeGet', { requestId: req3 }, S).request.status, 'accepted', '합치면 현장 쪽 결정(접수)이 이긴다');
assert.equal(as('relay', () => relay.sandbox.oiReadStore_()).requests.find(x => x.requestId === req3).status, 'accepted');
// (나) 관리사무소가 먼저 취소했는데 중계가 그걸 못 본 채 접수
tick();
const req4 = officeCall(intake, 'officeCreate', createPayload('ext-4'), S).requestId;
const staleOffice = officeFile.bytes.slice();
tick();
assert.equal(officeCall(intake, 'officeCancel', { requestId: req4 }, S).status, 'cancelled');
const freshOffice = officeFile.bytes.slice();
officeFile.bytes = staleOffice;
tick();
r = internalCall('officeAccept', { requestId: req4, hyeonjangOrderId: 'order-4', attachedUploadIds: [] });
assert.deepEqual(officeFile.bytes, staleOffice, '중계는 공개 파일을 쓰지 않는다');
officeFile.bytes = freshOffice;
assert.equal(r.ok, true);
assert.equal(jsonOf(officeFile).requests.find(x => x.requestId === req4).status, 'cancelled');
assert.equal(officeCall(intake, 'officeGet', { requestId: req4 }, S).request.status, 'accepted', '부딪히면 현장 쪽 결정이 이긴다');
// (다) 최신 화면을 보고 내린 관리사무소 결정은 이긴다 — 그 뒤 중계의 맞지 않는 전이는 거절
tick();
const req5 = officeCall(intake, 'officeCreate', createPayload('ext-5'), S).requestId;
tick();
internalCall('officeSetStatus', { requestId: req5, status: 'needs_info', reason: '세대 연락처가 필요해요' });
tick();
assert.equal(officeCall(intake, 'officeCancel', { requestId: req5 }, S).status, 'cancelled');
officeRecord = jsonOf(officeFile).requests.find(x => x.requestId === req5);
assert.equal(officeRecord.statusBasis, jsonOf(internalFile).projections[req5].statusAt, '관리사무소 결정은 본 현장 결정을 기억한다');
r = officeCall(intake, 'officeGet', { requestId: req5 }, S);
assert.equal(r.request.status, 'cancelled', '최신 화면을 본 관리사무소 취소가 이긴다');
assert.equal(r.request.needsInfoReason, '세대 연락처가 필요해요', '취소는 요청 사유를 남긴다(예전과 같음)');
tick();
r = internalCall('officeSetStatus', { requestId: req5, status: 'accepted' });
assert.equal(r.error, 'invalid-transition', '취소된 접수는 현장 쪽에서도 바꿀 수 없다');
assert.ok(jsonOf(internalFile).operationalErrors.some(e => e.code === 'invalid-transition' && e.requestId === req5), '현장 쪽 운영 오류는 내부 파일에');
assert.equal(jsonOf(officeFile).operationalErrors.some(e => e.code === 'invalid-transition'), false, '공개 파일에는 섞이지 않는다');
console.log('PASS  7 RACE — 옛 화면끼리 부딪혀도 두 기록 모두 남고 현장 쪽 결정이 이긴다');

/* ---------- 8. 완료 보고와 공개 사진 ---------- */
const workFolder = hjRoot.createFolder('현장사진');
const donePhoto = as('relay', () => workFolder.createFile({ name: 'done.jpg', bytes: JPEG.concat([9, 9]), mimeType: 'image/jpeg' }));
for (const status of ['visit_scheduled', 'in_progress']) {
  tick();
  r = internalCall('officeSetStatus', { requestId: req1, status, visitAt: '2026-11-21T01:00:00.000Z' });
  assert.equal(r.ok, true, status);
}
tick();
r = internalCall('officeSetStatus', { requestId: req1, status: 'completed', completionPhotoIds: [donePhoto.id], completionReport: { summary: '배관 이음부 교체', photoIds: [donePhoto.id], publicPhotoIds: [donePhoto.id] } });
assert.equal(r.ok, true, '완료 보고(현장사진 안 파일 확인은 중계가)');
assert.equal(r.status, 'completed');
tick();
r = officeCall(intake, 'officeList', {}, S);
row = r.requests.find(x => x.requestId === req1);
assert.equal(row.status, 'completed');
assert.equal(row.visitAt, '2026-11-21T01:00:00.000Z');
assert.deepEqual(row.completionReport, { summary: '배관 이음부 교체', publicPhotoIds: [donePhoto.id] });
r = officeCall(intake, 'officePhoto', { requestId: req1, photoId: donePhoto.id }, S);
assert.equal(r.ok, true, '관리사무소가 공개된 완료 사진을 새 주소로 본다');
assert.deepEqual(Array.from(Buffer.from(r.dataB64, 'base64')), JPEG.concat([9, 9]));
assert.equal(officeCall(intake, 'officePhoto', { requestId: req2, photoId: donePhoto.id }, S).error, 'not-found', '다른 접수로는 못 본다');
console.log('PASS  8 COMPLETION — 완료 보고·방문일·공개 사진이 새 주소로 보인다');

/* ---------- 9. 단지 관리(중지·PIN 바꾸기)는 중계에서, 접수 쪽은 30초 안에 따른다 ---------- */
tick();
r = internalCall('officeRotatePin', { officeId: 'of1' });
assert.equal(r.ok, true);
const newPin = r.pin;
assert.equal(jsonOf(internalFile).config.offices[0].pinHash, JSON.parse(relayProps.OFFICE_CONFIG_JSON).offices[0].pinHash, 'PIN 바꾸기와 같은 쓰기에 단지 목록 사본도 바뀐다');
intake.cache.clear();
tick();
assert.equal(officeCall(intake, 'officeGet', { requestId: req1 }, S).error, 'session-expired', 'PIN 을 바꾸면 이전 세션은 끝난다');
assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin: newPin }).ok, true, '새 PIN 으로 로그인');
tick();
const S2 = officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin: newPin }).sessionToken;
tick();
assert.equal(internalCall('officeDisable', { officeId: 'of1' }).ok, true);
assert.equal(officeCall(intake, 'officeList', {}, S2).ok, true, '중지는 접수 쪽 기억(30초)이 지나야 닿는다 — 문서에 적은 그대로');
intake.cache.clear();
assert.equal(officeCall(intake, 'officeList', {}, S2).error, 'session-expired', '기억이 지나면 중지된 단지는 못 쓴다');
assert.equal(officeCall(intake, 'officeLogin', { slug: 'sample-apt', pin: newPin }).error, 'invalid-credentials');
console.log('PASS  9 ADMIN — PIN 바꾸기·중지가 단지 목록 사본으로 접수 쪽에 닿는다');

/* ---------- 10. 파일마다 쓰는 쪽은 하나 ---------- */
const writes = drive.log.filter(e => e.op === 'set' || e.op === 'create' || e.op === 'trash');
for (const e of writes.filter(x => x.id === officeFile.id)) assert.equal(e.actor, 'intake', '공개 파일은 접수 프로젝트만 쓴다');
for (const e of writes.filter(x => x.id === internalFile.id)) assert.equal(e.actor, 'relay', '내부 파일은 중계만 쓴다');
assert.ok(writes.filter(x => x.id === officeFile.id).length >= 10 && writes.filter(x => x.id === internalFile.id).length >= 8);
assert.equal(writes.some(e => e.actor === 'intake' && e.id !== officeFile.id && !/^MM-\d{8}-\d{4}_0\d\.jpg$/.test(e.name)), false, '접수 프로젝트는 공개 파일과 관리사무소 사진만 만든다');
const intakeReads = new Set(drive.log.filter(e => e.actor === 'intake' && e.op === 'read').map(e => e.id));
assert.equal(intakeReads.has(localFile.id), false, '접수 프로젝트는 예전 접수 파일을 읽지 않는다');
assert.deepEqual([...intakeReads].map(id => fileById(id).name).filter(name => !/^관리사무소접수_(공개|내부)\.json$/.test(name)).sort(), ['done.jpg'],
  '접수 프로젝트가 읽는 것은 두 접수 파일과 공개된 완료 사진뿐');
assert.deepEqual(localFile.bytes, localBytes, '켜져 있는 동안 예전 접수 파일은 그대로');
assert.deepEqual([...new Set(jsonOf(officeFile).operationalErrors.map(e => e.code))], ['calendar-failed'], '공개 파일에는 접수 쪽 운영 오류만');
assert.deepEqual([...new Set(jsonOf(internalFile).operationalErrors.map(e => e.code))], ['invalid-transition'], '내부 파일에는 현장 쪽 운영 오류만');
assert.ok(jsonOf(officeFile).audit.length > 0 && jsonOf(internalFile).audit.length > 0 && jsonOf(internalFile).audit.every(a => a.action !== 'create' && a.action !== 'login'),
  '감사 기록도 쓴 쪽 파일에만(접수·로그인은 공개 파일, 접수 승인·상태·단지 관리는 내부 파일)');
console.log('PASS  10 SINGLE-WRITER — 공개 파일=접수 프로젝트, 내부 파일=중계, 예전 파일 손대지 않음');

/* ---------- 11. 되돌리기 ---------- */
const officeBefore = officeFile.bytes.slice(), internalBefore = internalFile.bytes.slice();
delete relayProps.OFFICE_INTAKE_MODE;
assert.equal(relay.sandbox.oiRole_(), 'local');
tick();
r = internalCall('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: true });
assert.equal(r.ok, true);
tick();
assert.equal(officeCall(relay, 'officeLogin', { slug: 'sample-apt', pin: newPin }).ok, true, '되돌리면 중계가 다시 공개 로그인을 받는다');
r = internalCall('officeInbox', {});
assert.deepEqual(r.requests.map(x => x.idempotencyKey), ['local-1'], '되돌리면 예전 접수 파일을 다시 쓴다');
assert.deepEqual(officeFile.bytes, officeBefore, '되돌려도 새 접수 기록은 지우지 않는다');
assert.deepEqual(internalFile.bytes, internalBefore);
console.log('PASS  11 ROLLBACK — 속성만 지우면 예전 그대로, 새 기록은 남는다');

/* ---------- 12. 문서 ---------- */
const guide = read(path.join(ROOT, 'docs', 'office-intake-split-20261119.md'));
const order = ['새 프로젝트', 'IntakeMain.gs', 'OFFICE_SESSION_SECRET', 'setupOfficeIntake', '웹 앱', '모든 사용자', 'Claude', 'office-api.json', 'OFFICE_INTAKE_MODE', 'OFFICE_INTAKE_STORE_ID', '되돌리'];
let at = -1;
for (const word of order) {
  const next = guide.indexOf(word, at + 1);
  assert.ok(next > at, '배포 안내 순서: ' + word);
  at = next;
}
assert.doesNotMatch(guide, /AKfy|script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,}/, '안내에 실제 주소를 적지 않는다');
assert.doesNotMatch(guide, /[A-Za-z0-9_-]{33,}/, '안내에 Drive ID·키처럼 긴 값을 적지 않는다');
const intakeReadme = read(path.join(INTAKE_DIR, 'README.md'));
for (const key of ['OFFICE_INTAKE_ENABLED', 'OFFICE_SESSION_SECRET', 'DRIVE_FOLDER_ID', 'OFFICE_INTAKE_STORE_ID', 'OFFICE_INTAKE_MODE', 'office-intake-moved', '관리사무소접수_공개.json', '관리사무소접수_내부.json', 'docs/office-intake-split-20261119.md']) {
  assert.ok(intakeReadme.includes(key), '접수 프로젝트 README: ' + key);
}
const usedKeys = new Set([...(intakeMain + read(path.join(RELAY_DIR, 'OfficeIntake.gs'))).matchAll(/getProperty\('([A-Z][A-Z0-9_]*)'\)/g)].map(m => m[1]));
for (const key of usedKeys) if (key !== 'OFFICE_CONFIG_JSON' && key !== 'OFFICE_STORE_FILE') assert.ok(intakeReadme.includes(key), 'README 가 코드가 읽는 속성을 빠뜨리지 않는다: ' + key);
const portalReadme = read(path.join(ROOT, 'apps-script-office-portal', 'README.md'));
// 11/19 바뀜: 만물웹 저장소로 옮기는 일은 보안 검토가 끝날 때까지 미뤘다 — 지금 정본은 대표 PC 의 외부 작업본이다.
// 맨 위 몇 줄이 '옛 판·고치지 마세요'와 지금 정본·미룬 날을 말하는지, 아직 옮기지 않은 만물웹을 정본이라 하지 않는지 본다.
const portalTop = portalReadme.split('\n').slice(0, 6).join('\n');
assert.match(portalTop, /옛 판[\s\S]*고치지 마세요/, '현장웹의 포털 소스는 옛 판 표시');
assert.match(portalTop, /정본은[\s\S]*외부 작업본[\s\S]*manmool-sites-portal[\\\/]apps-script-office-portal/, '지금 정본 = 대표 PC 외부 작업본');
assert.match(portalTop, /보안 검토[\s\S]*미뤘[\s\S]*2026-11-19/, '만물웹으로 옮기기는 보안 검토 뒤로 미룸(11/19)');
assert.doesNotMatch(portalTop, /정본은 manmool\//, '아직 옮기지 않은 만물웹 저장소를 정본이라 하지 않는다');
for (const name of ['Code.gs', 'PortalPure.gs', 'appsscript.json']) assert.ok(fs.existsSync(path.join(ROOT, 'apps-script-office-portal', name)), '옛 판 파일은 지우지 않는다: ' + name);
console.log('PASS  12 DOCS — 배포 안내 순서·값 없음 · README 속성 · 포털 옛 판 표시');

console.log('PASS  office intake split (relay switch + separate intake project)');
