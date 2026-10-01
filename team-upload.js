/* Staff evidence upload queue (v333). Originals wait in THIS device's IndexedDB until the company server confirms them.
 * Same requestId/evidence id on every retry, so a resend can never make a second record. Videos go in 1 MiB chunks
 * and resume from the server's offset. No sending happens without a logged-in session; nothing goes to insurers. */
(function (root) {
  'use strict';
  const MiB = 1048576, PHOTO_MAX = 12 * MiB, VIDEO_MAX = 100 * MiB, CHUNK = MiB, MAX_ATTEMPTS = 6, MAX_DELAY = 60000;
  const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
  const EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', qt: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf' };
  // Retrying these can succeed later without anyone changing the input.
  const RETRY = ['network', 'busy', 'rate-limited', 'server-error', 'storage-failed', 'auth-unavailable', 'bad-response'];
  const REASONS = {
    network: '연결이 끊겼습니다. 온라인이 되면 자동으로 다시 올립니다.', busy: '서버가 바쁩니다. 잠시 뒤 자동으로 다시 올립니다.', 'rate-limited': '요청이 많아 잠시 기다립니다.',
    'server-error': '서버가 처리하지 못했습니다. 잠시 뒤 다시 올립니다.', 'storage-failed': '서버 저장 결과를 확인하지 못했습니다. 같은 원본으로 다시 확인합니다.', 'auth-unavailable': '인증 서버에 연결하지 못했습니다.',
    'bad-response': '서버 응답을 확인하지 못했습니다. 같은 원본으로 다시 확인합니다.', forbidden: '이 업무에 올릴 권한이 없거나 업무가 완료되었습니다. 팀장에게 확인하세요.',
    'invalid-file': '파일 형식·크기가 서버 기준과 맞지 않습니다. 회사 서버가 아직 동영상·HEIC를 받지 않는다면 대표가 서버를 갱신해야 합니다.',
    'invalid-action': '회사 서버가 아직 동영상 올리기를 지원하지 않습니다. 대표가 서버를 갱신한 뒤 다시 올려 주세요.',
    'invalid-input': '입력 내용을 서버가 받지 않았습니다. 취소한 뒤 다시 선택해 주세요.', 'invalid-project': '프로젝트가 보관되었거나 담당 팀이 바뀌었습니다.',
    capacity: '서버 보관 한도에 도달했습니다. 대표에게 확인하세요.', 'hash-mismatch': '원본 해시가 서버와 다릅니다. 취소한 뒤 원본을 다시 선택하세요.',
    duplicate: '같은 번호의 자료가 다른 내용으로 이미 있습니다. 대표 확인이 필요합니다.', 'not-found': '프로젝트나 업무를 찾을 수 없습니다.', 'evidence-bound': '업무 연결이 바뀌었습니다.',
    'too-many-attempts': '여러 번 실패했습니다. [다시 올리기]를 눌러 주세요.', 'device-only': ''
  };
  // Last cause after the attempt budget: a short label, not REASONS (those promise an automatic retry that a failed item never gets).
  const CAUSES = { network: '연결 끊김', busy: '서버 바쁨', 'rate-limited': '요청 많음', 'server-error': '서버 처리 실패', 'storage-failed': '저장 확인 실패', 'auth-unavailable': '인증 서버 연결 실패', 'bad-response': '응답 확인 실패', 'upload-not-found': '서버의 올리기 기록 없음' };
  function code(e) { return String(e?.code || 'network').replace(/_/g, '-'); }
  function mimeOf(file) {
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name || '') || [])[1]?.toLowerCase() || '';
    // Windows/Android often report HEIC or MOV with an empty or generic type: trust only a known extension then.
    if (file.type && file.type !== 'application/octet-stream') return file.type === 'video/x-m4v' ? 'video/mp4' : file.type;
    return EXT[ext] || '';
  }
  function kindOf(mime, documents) {
    if (VIDEO_MIMES.includes(mime)) return documents ? '' : 'video';
    if (PHOTO_MIMES.includes(mime)) return documents ? (mime.startsWith('image/hei') ? '' : 'document') : 'photo';
    return documents && mime === 'application/pdf' ? 'document' : '';
  }
  function limitOf(kind) { return kind === 'video' ? VIDEO_MAX : PHOTO_MAX; }
  async function sha(buffer) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(v => v.toString(16).padStart(2, '0')).join(''); }
  function encode(bytes) { let out = ''; for (let i = 0; i < bytes.length; i += 32768) out += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(out); }
  function videoDuration(file) {
    // What the phone reports, or nothing. Never a guess.
    return new Promise(done => {
      let url = ''; const v = document.createElement('video'), finish = d => { clearTimeout(t); v.removeAttribute('src'); if (url) URL.revokeObjectURL(url); done(Number.isFinite(d) && d > 0 && d <= 86400 ? Math.round(d * 10) / 10 : ''); };
      const t = setTimeout(() => finish(NaN), 4000); v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => finish(v.duration); v.onerror = () => finish(NaN);
      try { url = URL.createObjectURL(file); v.src = url; } catch (_) { finish(NaN); }
    });
  }
  /* ---------- IndexedDB (wrapped: private mode, quota and blocked storage fall back to memory with a warning) ---------- */
  let dbPromise = null;
  function db() {
    if (!dbPromise) dbPromise = new Promise((ok, no) => { try { const r = indexedDB.open('hj-team-upload', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'key' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(new Error('blocked')); } catch (e) { no(e); } }).catch(e => { dbPromise = null; throw e; });
    return dbPromise;
  }
  async function tx(mode, fn) { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('items', mode), s = t.objectStore('items'), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error || new Error('abort')); }); }
  const idbPut = item => tx('readwrite', s => s.put(item)), idbDel = key => tx('readwrite', s => s.delete(key)), idbAll = () => tx('readonly', s => s.getAll());
  const persisted = item => { const out = {}; ['key', 'scope', 'createdAt', 'file', 'entity', 'requestId', 'revision', 'uploadId', 'state', 'error', 'detail', 'attempts'].forEach(k => { if (item[k] !== undefined) out[k] = item[k]; }); return out; };

  function create(ctx) {
    const items = new Map(); let loadedScope = '', running = false, timer = 0, active = null, notifyTimer = 0;
    const scope = () => ctx.data()?.me?.id || '';
    const mine = () => [...items.values()].filter(i => i.scope === scope()).sort((a, b) => a.createdAt - b.createdAt);
    function changed() { clearTimeout(notifyTimer); notifyTimer = setTimeout(() => ctx.onChange(), 60); }
    async function save(item) {
      if (item.volatile) return;
      try { await idbPut(persisted(item)); } catch (_) { item.volatile = true; item.warn = 'device-only'; }
    }
    async function drop(item) { items.delete(item.key); if (!item.volatile) { try { await idbDel(item.key); } catch (_) { /* stays until next successful open */ } } changed(); }
    async function load() {
      const s = scope(); if (!s || loadedScope === s) return; loadedScope = s;
      let rows = []; try { rows = await idbAll(); } catch (_) { return; }
      if (scope() !== s) return;
      rows.forEach(r => { if (r && r.file instanceof Blob && !items.has(r.key)) items.set(r.key, { ...r, state: r.state === 'failed' ? 'failed' : 'queued', progress: 0, nextAt: 0 }); });
      changed();
    }
    async function room(bytes) {
      try { const est = await navigator.storage?.estimate?.(); if (est && Number.isFinite(est.quota) && Number.isFinite(est.usage) && est.quota - est.usage < bytes * 1.1) return false; } catch (_) { /* unknown: try to store */ }
      return true;
    }
    // entities: prepared by the caller (validated kind/mime/size/hash). Returns {added, skipped, deviceOnly}.
    async function add(entries) {
      const s = scope(); if (!s) return { added: 0, skipped: 0, deviceOnly: 0 };
      const known = new Set([...(ctx.data()?.evidence || []).map(e => e.taskId + ':' + e.sha256), ...mine().map(i => i.entity.taskId + ':' + i.entity.sha256)]);
      const total = entries.reduce((n, e) => n + e.file.size, 0), fits = await room(total);
      let added = 0, skipped = 0, deviceOnly = 0;
      for (const { file, entity } of entries) {
        const dupe = entity.taskId + ':' + entity.sha256; if (known.has(dupe)) { skipped++; continue; } known.add(dupe);
        const item = { key: crypto.randomUUID(), scope: s, createdAt: Date.now() + added, file, entity, state: 'queued', attempts: 0, progress: 0, nextAt: 0 };
        if (!fits) { item.volatile = true; item.warn = 'device-only'; } else await save(item);
        if (item.volatile) deviceOnly++; items.set(item.key, item); added++;
      }
      changed(); kick(); return { added, skipped, deviceOnly };
    }
    function retry(key) { const i = items.get(key); if (!i || i.scope !== scope() || active === i) return; i.state = 'queued'; i.attempts = 0; i.nextAt = 0; i.error = ''; i.detail = ''; save(i); changed(); kick(); }
    async function cancel(key) { const i = items.get(key); if (!i || i.scope !== scope()) return; i.cancelled = true; if (active !== i) await drop(i); }
    function stop() {
      // Logout or permission loss: forget the view and every in-memory (device-only) original; stored items wait for the same staff member.
      clearTimeout(timer); timer = 0; loadedScope = '';
      [...items.values()].forEach(i => { i.cancelled = i.cancelled || i.volatile; }); items.clear(); changed();
    }
    function kick() { if (!ctx.data() || !scope()) return; load().then(pump); }
    function schedule() {
      clearTimeout(timer); timer = 0; if (!ctx.data() || !scope()) return;
      const online = typeof navigator === 'undefined' || navigator.onLine !== false; // Offline: the 'online' event wakes the queue, no polling.
      // Offline, a passed 'waiting' deadline would re-arm a 50 ms timer forever (pump breaks on onLine=false): arm nothing.
      const next = online ? mine().filter(i => !i.cancelled && (i.state === 'waiting' || i.state === 'queued')).reduce((m, i) => Math.min(m, i.state === 'queued' ? Date.now() : i.nextAt), Infinity) : Infinity;
      if (Number.isFinite(next)) timer = setTimeout(pump, Math.max(50, next - Date.now()));
    }
    async function pump() {
      if (running || !ctx.data() || !scope()) return; running = true; const myEpoch = ctx.epoch();
      try {
        for (;;) {
          if (myEpoch !== ctx.epoch() || !ctx.data()) return;
          if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
          const item = mine().find(i => (i.state === 'queued' || i.state === 'waiting' && i.nextAt <= Date.now()) && !i.cancelled); if (!item) break;
          active = item; await run(item, myEpoch); active = null;
          if (item.cancelled) await drop(item);
        }
      } finally { running = false; active = null; schedule(); }
    }
    const live = e => e === ctx.epoch() && !!ctx.data();
    async function refresh() { const r = await ctx.api('list'); ctx.accept(r.data); }
    const committed = item => (ctx.data()?.evidence || []).some(e => e.id === item.entity.id && e.sha256 === item.entity.sha256);
    async function stamp(item) { item.requestId = crypto.randomUUID(); item.revision = ctx.data().revision; await save(item); } // Durable BEFORE sending: a restart replays the same request.
    async function commit(item, e) {
      if (!item.requestId) await stamp(item);
      for (let rebase = 0; ; rebase++) {
        try {
          const payload = { requestId: item.requestId, revision: item.revision, entity: item.entity };
          if (item.entity.kind === 'video') payload.uploadId = item.uploadId; else payload.base64 = encode(new Uint8Array(await item.file.arrayBuffer()));
          const r = await ctx.api('evidenceUpload', payload); if (!live(e)) return; ctx.accept(r.data); return true;
        } catch (err) {
          const c = code(err); if (!live(e) || c === 'stale') return;
          // Append-only evidence: a revision conflict is rebased like the editor does (same evidence UUID and bytes, new request).
          if (['conflict', 'request-conflict', 'duplicate'].includes(c) && rebase < 3) { await refresh(); if (!live(e)) return; if (committed(item)) return true; if (c === 'duplicate') throw err; await stamp(item); continue; }
          throw err;
        }
      }
    }
    async function sendVideo(item, e) {
      if (!item.uploadId) { item.uploadId = crypto.randomUUID(); await save(item); }
      let up;
      try { up = (await ctx.api('evidenceMediaBegin', { uploadId: item.uploadId, entity: item.entity })).upload; }
      catch (err) { if (code(err) === 'upload-not-found') { item.uploadId = ''; } throw err; }
      while (live(e) && !item.cancelled && up && up.state === 'uploading') {
        if (!Number.isSafeInteger(up.offset) || up.offset < 0 || up.offset >= item.file.size || up.size !== item.file.size) throw Object.assign(new Error('bad-response'), { code: 'bad-response' });
        item.progress = up.offset / item.file.size; changed();
        const bytes = new Uint8Array(await item.file.slice(up.offset, up.offset + CHUNK).arrayBuffer()), before = up.offset;
        up = (await ctx.api('evidenceMediaChunk', { uploadId: item.uploadId, offset: up.offset, base64: encode(bytes) })).upload;
        if (up && up.offset > before) item.attempts = 0; // Progress resets the backoff budget: long videos meet the rate limit, not a dead end.
      }
      if (!live(e) || item.cancelled) return;
      if (!up || !['complete', 'committed'].includes(up.state)) throw Object.assign(new Error('bad-response'), { code: 'bad-response' });
      item.progress = 1; changed();
      if (up.state === 'committed') { await refresh(); return live(e) && committed(item); }
      return commit(item, e);
    }
    async function run(item, e) {
      item.state = 'uploading'; item.error = ''; changed();
      try {
        if (item.entity.kind !== 'video' && item.file.size !== item.entity.size) throw Object.assign(new Error('hash-mismatch'), { code: 'hash-mismatch' });
        const ok = item.entity.kind === 'video' ? await sendVideo(item, e) : await commit(item, e);
        if (!live(e)) { item.state = 'queued'; return; }
        if (item.cancelled) return;
        if (ok) { item.state = 'done'; await drop(item); ctx.onDone(item); return; }
        throw Object.assign(new Error('bad-response'), { code: 'bad-response' });
      } catch (err) {
        const c = code(err); if (!live(e) || c === 'stale') { item.state = 'queued'; return; }
        if (c === 'session-expired') { item.state = 'queued'; ctx.onError(err); return; }
        item.attempts = (item.attempts || 0) + 1;
        if (RETRY.includes(c) || c === 'upload-not-found') {
          if (item.attempts >= MAX_ATTEMPTS) { item.state = 'failed'; item.error = c; item.detail = 'too-many-attempts'; }
          else { item.state = 'waiting'; item.error = c; item.nextAt = Date.now() + Math.min(MAX_DELAY, 1000 * 2 ** item.attempts); }
        } else { item.state = 'failed'; item.error = c; item.detail = ''; }
        await save(item);
      } finally { changed(); }
    }
    if (typeof window !== 'undefined') window.addEventListener('online', () => { mine().forEach(i => { if (i.state === 'waiting') i.nextAt = 0; }); kick(); });
    function view() {
      return mine().map(i => ({ key: i.key, name: i.entity.name, kind: i.entity.kind, size: i.entity.size, projectId: i.entity.projectId, state: i.state, progress: i.progress || 0, attempts: i.attempts || 0, nextAt: i.nextAt || 0,
        // A failed item with a retryable cause stopped only because of the attempt budget (older rows kept no detail): never say "will retry automatically".
        reason: i.state === 'failed' && (i.detail || RETRY.includes(i.error) || i.error === 'upload-not-found') ? REASONS[i.detail || 'too-many-attempts'] + (i.error ? ' (마지막 원인: ' + (CAUSES[i.error] || i.error) + ')' : '') : REASONS[i.error] || (i.error ? '처리하지 못했습니다(' + i.error + ').' : ''), deviceOnly: !!i.volatile }));
    }
    return Object.freeze({ add, retry, cancel, stop, kick, view, busy: () => running });
  }
  async function prepare(fileList, documents, meta) {
    // Reject the whole selection before anything is queued: a half-queued batch is harder to reason about than a clear error.
    const files = [...fileList]; if (!files.length || files.length > 10) return { error: '한 번에 1~10개를 고르세요.' };
    const out = [];
    for (const file of files) {
      const mime = mimeOf(file), kind = kindOf(mime, documents);
      if (!kind) return { error: (file.name || '파일') + ': ' + (documents ? 'JPG·PNG·WebP 사진 또는 PDF만 올릴 수 있습니다.' : 'JPG·PNG·WebP·HEIC 사진 또는 MP4·MOV·WebM 동영상만 올릴 수 있습니다.') };
      if (!file.size || file.size > limitOf(kind)) return { error: (file.name || '파일') + ': ' + (kind === 'video' ? '동영상은 100MB' : '사진·서류는 12MiB') + ' 이하만 올릴 수 있습니다.' };
      const name = (String(file.name || 'original').replace(/[\\/\x00-\x1f]/g, '_').trim() || 'original').slice(-160);
      const entity = { ...meta, id: crypto.randomUUID(), kind, mime, name, size: file.size, sha256: await sha(await file.arrayBuffer()) };
      if (kind === 'video') entity.duration = await videoDuration(file); else if (kind === 'document') entity.taskId = '';
      out.push({ file, entity });
    }
    return { entries: out };
  }
  root.HJTeamUpload = Object.freeze({ create, prepare, mimeOf, kindOf, PHOTO_MAX, VIDEO_MAX, CHUNK, MAX_ATTEMPTS });
})(typeof window !== 'undefined' ? window : globalThis);
