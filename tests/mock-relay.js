/* mock-relay.js — Apps Script 중계 서버(relay-v1) 계약 mock (node http, 포트 8398)
   README_APPS_SCRIPT.md 계약 구현: health/load/save(revision·conflict)/backup/upload/listFiles + unauthorized.
   상태는 메모리. 테스트 제어용 훅: GET /__state /__reset /__bump */
'use strict';
const http = require('http');
const PORT = Number(process.env.PORT || 8398);
const TOKEN = process.env.APP_TOKEN || 'test-token-123';
const TS_WINDOW = 10 * 60 * 1000;
const MAX_SAVE = 10 * 1024 * 1024, MAX_UPLOAD_B64 = 12 * 1024 * 1024, MAX_BODY = 15 * 1024 * 1024;
const ALLOWED_MIME = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  doc: ['application/pdf', 'image/jpeg', 'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
};

function freshStore() {
  return { revision: 0, exists: false, data: null, savedAt: '', savedBy: '',
           saves: [], uploads: [], backups: 0, backupDates: {}, fileSeq: 0, loads: 0 };
}
let store = freshStore();

function send(res, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(b);
}
const fail = (code, msg) => ({ ok: false, error: code, message: msg || code });
const health = () => ({ ok: true, version: 'relay-v1-mock', folderOk: true, dataFileExists: store.exists, revision: store.revision });

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (req.method === 'GET') {
    if (u.pathname === '/__state') {
      return send(res, {
        revision: store.revision, exists: store.exists, savedAt: store.savedAt, savedBy: store.savedBy,
        saves: store.saves,
        uploads: store.uploads.map(x => ({ name: x.name, kind: x.kind, mimeType: x.mimeType, b64len: x.dataB64.length })),
        backups: store.backups, loads: store.loads, data: store.data
      });
    }
    if (u.pathname === '/__reset') { store = freshStore(); return send(res, { ok: true }); }
    if (u.pathname === '/__bump') { // 다른 기기가 저장한 상황을 흉내(충돌 유발)
      store.revision++; store.exists = true; store.savedBy = 'other-device'; store.savedAt = new Date().toISOString();
      if (store.data) store.data = Object.assign({}, store.data, { savedAt: store.savedAt });
      else store.data = { app: '현장', version: 2, savedAt: store.savedAt, projects: [{ name: '서버쪽현장' }], files: [], quotes: [] };
      return send(res, { ok: true, revision: store.revision });
    }
    // 주소창 확인용 health
    if ((u.searchParams.get('action') || 'health') !== 'health') return send(res, fail('bad-request', 'GET은 health만 지원합니다'));
    if (u.searchParams.get('token') !== TOKEN) return send(res, fail('unauthorized', '인증키가 일치하지 않습니다'));
    return send(res, health());
  }
  if (req.method !== 'POST') return send(res, fail('bad-request', 'POST만 지원'));
  let body = '';
  req.on('data', c => { body += c; if (body.length > MAX_BODY) req.destroy(); });
  req.on('end', () => {
    try {
      let r; try { r = JSON.parse(body); } catch (_) { return send(res, fail('bad-request', 'JSON 형식이 아닙니다')); }
      if (String(r.token || '') !== TOKEN) return send(res, fail('unauthorized', '인증키가 일치하지 않습니다'));
      const action = String(r.action || '');
      const ts = Number(r.ts || 0);
      if (!ts || Math.abs(Date.now() - ts) > TS_WINDOW) return send(res, fail('bad-request', '요청 시간이 유효하지 않습니다'));
      const deviceId = String(r.deviceId || 'unknown').slice(0, 64);
      const p = r.payload || {};
      switch (action) {
        case 'health': return send(res, health());
        case 'load':
          store.loads++;
          if (!store.exists) return send(res, { ok: true, exists: false, data: null, revision: 0, modifiedAt: '', savedBy: '' });
          return send(res, { ok: true, exists: true, data: store.data, revision: store.revision, modifiedAt: store.savedAt, savedBy: store.savedBy });
        case 'save': {
          const data = p.data;
          if (!data || typeof data !== 'object' || Array.isArray(data)) return send(res, fail('bad-request', '데이터 형식이 올바르지 않습니다'));
          if (data.app !== '현장' && typeof data.version !== 'number') return send(res, fail('bad-request', '알 수 없는 데이터 구조입니다'));
          if (JSON.stringify(data).length > MAX_SAVE) return send(res, fail('too-large', '데이터가 너무 큽니다'));
          let base = Number(p.baseRevision); if (isNaN(base)) base = -1;
          if (store.exists && base !== store.revision) {
            return send(res, { ok: false, error: 'conflict', serverRevision: store.revision, serverModifiedAt: store.savedAt, serverSavedBy: store.savedBy });
          }
          store.revision++; store.exists = true; store.data = data;
          store.savedAt = new Date().toISOString(); store.savedBy = deviceId;
          store.saves.push({ baseRevision: base, deviceId, ts, at: store.savedAt });
          return send(res, { ok: true, revision: store.revision, savedAt: store.savedAt });
        }
        case 'backup': {
          if (!store.exists) return send(res, fail('bad-request', '백업할 데이터 파일이 없습니다'));
          const today = new Date().toISOString().slice(0, 10);
          const name = '현장데이터_백업_' + today + '.json';
          if (store.backupDates[today]) return send(res, { ok: true, created: false, name });
          store.backupDates[today] = true; store.backups++;
          return send(res, { ok: true, created: true, name });
        }
        case 'upload': {
          const kind = String(p.kind || '');
          if (kind !== 'photo' && kind !== 'doc') return send(res, fail('bad-request', 'kind는 photo 또는 doc만 허용'));
          const mime = String(p.mimeType || '');
          if ((ALLOWED_MIME[kind] || []).indexOf(mime) < 0) return send(res, fail('bad-request', '허용되지 않는 파일 형식: ' + mime.slice(0, 60)));
          const b64 = String(p.dataB64 || '');
          if (!b64) return send(res, fail('bad-request', '파일 내용이 없습니다'));
          if (b64.length > MAX_UPLOAD_B64) return send(res, fail('too-large', '파일이 너무 큽니다'));
          const id = 'mockfile_' + (++store.fileSeq);
          store.uploads.push({ id, name: String(p.name || ''), mimeType: mime, kind, dataB64: b64, modifiedAt: new Date().toISOString() });
          return send(res, { ok: true, fileId: id, name: String(p.name || ''), folder: kind === 'photo' ? '현장사진' : '견적서' });
        }
        case 'download': {   // relay-v1.1: 만물인테리어 폴더 안(=이 mock에 업로드된) 파일만, 8MB 상한
          const fid = String(p.fileId || '');
          if (!fid) return send(res, fail('bad-request', 'fileId가 없습니다'));
          const f = store.uploads.find(x => x.id === fid);
          if (!f) return send(res, fail('unauthorized', '만물인테리어 폴더 밖의 파일은 내려받을 수 없습니다'));
          if (f.dataB64.length > Math.ceil(8 * 1024 * 1024 * 4 / 3)) return send(res, fail('too-large', '미리보기용으로는 파일이 너무 큽니다(8MB 초과)'));
          return send(res, { ok: true, fileId: fid, name: f.name, mimeType: f.mimeType, dataB64: f.dataB64 });
        }
        case 'listFiles': {
          const kind = p && p.kind ? String(p.kind) : '';
          const files = store.uploads.filter(f => !kind || f.kind === kind)
            .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedAt: f.modifiedAt, kind: f.kind }));
          return send(res, { ok: true, files });
        }
        default: return send(res, fail('bad-request', '허용되지 않은 action'));
      }
    } catch (err) { return send(res, fail('server-error', String(err && err.message || err).slice(0, 140))); }
  });
});
server.listen(PORT, () => console.log('[mock-relay] listening on http://localhost:' + PORT + ' token=' + TOKEN));
