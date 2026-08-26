/* mock-relay.js — Apps Script 중계 서버(relay-v2) 계약 mock (node http, 포트 8398)
   Apps Script 계약 구현: health/load/save(revision·conflict)/backup/upload/listFiles/thumbnail + unauthorized.
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
           saves: [], uploads: [], backups: 0, backupDates: {}, fileSeq: 0, loads: 0,
           officeRequests: [{
             requestId: 'req-1', receiptNo: 'MM-20260826-0001', officeId: 'of1', unit: '103동 1204호',
             location: '욕실 천장', issueType: '누수', pipeType: '미확정', urgency: 'normal',
             description: '천장에서 물이 떨어집니다.', officeContact: { name: '김소장', phone: '010-1111-2222' },
             residentContact: null, preferredVisitDate: '2026-08-27', photos: [], status: 'pending_review',
             updatedAt: '2026-08-26T09:00:00+09:00'
           }], officeAccepts: [], officeStatuses: [], officeStatusCalls: 0 };
}
let store = freshStore();

function send(res, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(b);
}
const fail = (code, msg) => ({ ok: false, error: code, message: msg || code });
const health = () => ({ ok: true, version: 'relay-v2-mock', folderOk: true, dataFileExists: store.exists, revision: store.revision });

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (req.method === 'GET') {
    if (u.pathname === '/__state') {
      return send(res, {
        revision: store.revision, exists: store.exists, savedAt: store.savedAt, savedBy: store.savedBy,
        saves: store.saves,
        uploads: store.uploads.map(x => ({ name: x.name, kind: x.kind, mimeType: x.mimeType, b64len: x.dataB64.length })),
        backups: store.backups, loads: store.loads, data: store.data,
        officeRequests: store.officeRequests, officeAccepts: store.officeAccepts, officeStatuses: store.officeStatuses, officeStatusCalls: store.officeStatusCalls
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
          store.uploads.push({ id, name: String(p.name || ''), mimeType: mime, kind, dataB64: b64, size: Math.floor(b64.length * 0.75), modifiedAt: new Date().toISOString() });
          return send(res, { ok: true, fileId: id, name: String(p.name || ''), folder: kind === 'photo' ? '현장사진' : '견적서' });
        }
        case 'listFiles': {
          const kind = p && p.kind ? String(p.kind) : '';
          const files = store.uploads.filter(f => !kind || f.kind === kind)
            .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedAt: f.modifiedAt, size: f.size, kind: f.kind }));
          return send(res, { ok: true, files });
        }
        case 'thumbnail': {
          const id = String(p.fileId || '');
          const f = store.uploads.find(x => x.id === id);
          if (!f) return send(res, fail('not-found', '사진 파일을 찾지 못했습니다'));
          if (f.kind !== 'photo' || !/^image\//.test(f.mimeType)) return send(res, fail('bad-request', '이미지 파일만 미리볼 수 있습니다'));
          return send(res, { ok: true, fileId: id, name: f.name, mimeType: f.mimeType, source: 'thumbnail', dataB64: f.dataB64 });
        }
        case 'officeInbox': {
          const cursor = String(p.updatedAfter || '');
          const requests = store.officeRequests.filter(x => !cursor || String(x.updatedAt || '') > cursor)
            .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
          const nextCursor = requests.length ? String(requests[requests.length - 1].updatedAt || cursor) : cursor;
          return send(res, { ok: true, requests, cursor: nextCursor, operationalErrors: [] });
        }
        case 'officeAccept': {
          const requestId = String(p.requestId || ''), orderId = String(p.hyeonjangOrderId || '');
          const request = store.officeRequests.find(x => x.requestId === requestId);
          if (!request) return send(res, fail('not-found'));
          if (!orderId) return send(res, fail('invalid-input'));
          if (request.hyeonjangOrderId && request.hyeonjangOrderId !== orderId) return send(res, fail('already-linked'));
          if (!request.hyeonjangOrderId) {
            if (request.status !== 'pending_review' && request.status !== 'on_hold') return send(res, fail('invalid-transition'));
            request.hyeonjangOrderId = orderId; request.status = 'accepted'; request.updatedAt = new Date().toISOString();
            store.officeAccepts.push({ requestId, hyeonjangOrderId: orderId });
          }
          return send(res, { ok: true, requestId, hyeonjangOrderId: request.hyeonjangOrderId, status: request.status });
        }
        case 'officeSetStatus': {
          const requestId = String(p.requestId || ''), status = String(p.status || '');
          store.officeStatusCalls++;
          const request = store.officeRequests.find(x => x.requestId === requestId);
          const transitions = {
            pending_review: ['needs_info', 'accepted', 'on_hold', 'cancelled'], needs_info: ['pending_review', 'on_hold', 'cancelled'],
            accepted: ['visit_scheduled', 'on_hold'], visit_scheduled: ['in_progress', 'on_hold'], in_progress: ['completed', 'on_hold'],
            completed: ['billed'], billed: ['paid'], paid: [], on_hold: ['pending_review', 'accepted', 'visit_scheduled', 'in_progress', 'cancelled'], cancelled: []
          };
          if (!request) return send(res, fail('not-found'));
          // Retrying the same delivered payload is idempotent, matching the internal action's observable result.
          if (request.status !== status) {
            if (!(transitions[request.status] || []).includes(status)) return send(res, fail('invalid-transition'));
            request.status = status; request.updatedAt = new Date().toISOString();
            store.officeStatuses.push({ requestId, status, visitAt: p.visitAt || null, publicAmount: p.publicAmount == null ? null : Number(p.publicAmount), completionReport: p.completionReport || null });
          }
          return send(res, { ok: true, requestId, status: request.status, updatedAt: request.updatedAt });
        }
        default: return send(res, fail('bad-request', '허용되지 않은 action'));
      }
    } catch (err) { return send(res, fail('server-error', String(err && err.message || err).slice(0, 140))); }
  });
});
server.listen(PORT, () => console.log('[mock-relay] listening on http://localhost:' + PORT + ' token=' + TOKEN));
