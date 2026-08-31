/* sw-cache.check.js — 서비스워커 캐시 보안 경계 행동 검사

   보호하는 사고: 외부 URL, Authorization 요청, 쿼리형 문서/민감 링크가
   Cache Storage에 남아 고객정보·토큰이 같은 기기의 장기 캐시로 보존되는 것. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodeAssert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const EXPECTED_SHELL_PATHS = ['./','./index.html','./privacy.html','./terms.html'];
const FORBIDDEN_SHELL_DATA = /officeOps|office_ops|commercialApproval|commercial_approval|token|cache|response|https?:\/\//i;
const handlers = {};
const puts = [];
const fetches = [];
let nextResponse = null;

const cache = {
  match: async () => null,
  put: async (request, response) => { puts.push({ request, response }); }
};
const context = {
  URL, Promise,
  self: {
    location: { origin: 'https://example.test', href: 'https://example.test/hyeonjang/sw.js' },
    skipWaiting() {},
    addEventListener(type, fn) { handlers[type] = fn; }
  },
  clients: { claim: async () => {} },
  caches: {
    keys: async () => [], delete: async () => true,
    open: async () => cache,
    match: async () => null
  },
  fetch: async request => {
    fetches.push(request);
    const r = nextResponse || { ok: true, type: 'basic', clone() { return this; } };
    nextResponse = null;
    return r;
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'sw.js' });

if (typeof handlers.fetch !== 'function') throw new Error('FAIL  서비스워커 fetch 핸들러가 없다');

function request(url, options = {}) {
  return {
    url,
    method: options.method || 'GET',
    mode: options.mode || 'cors',
    destination: options.destination || 'script',
    headers: new Headers(options.headers || {})
  };
}
async function dispatch(req, response) {
  puts.length = 0; fetches.length = 0; nextResponse = response || null;
  let responsePromise = null;
  handlers.fetch({
    request: req,
    respondWith(value) { responsePromise = Promise.resolve(value); }
  });
  if (responsePromise) await responsePromise;
  await new Promise(resolve => setImmediate(resolve));
  return { intercepted: !!responsePromise, puts: puts.length, fetches: fetches.length };
}
function assert(value, message) { if (!value) throw new Error('FAIL  ' + message); }
function assertShellPathsSafe(paths, label) {
  assert(Array.isArray(paths), label + ': SHELL_PATHS is not an array');
  assert(JSON.stringify(paths) === JSON.stringify(EXPECTED_SHELL_PATHS), label + ': SHELL_PATHS must be the exact ordered app shell');
  assert(!FORBIDDEN_SHELL_DATA.test(paths.join('\n')), label + ': SHELL_PATHS contains isolated or external data');
}

(async () => {
  for (const extra of [
    'https://office.invalid/ops', './office_ops_token.txt', './office_ops_cache.json', './commercial_approval.json'
  ]) {
    nodeAssert.throws(() => assertShellPathsSafe([...EXPECTED_SHELL_PATHS, extra], 'mutant'), /exact ordered app shell/, 'extra isolated shell fixture must be rejected');
  }
  const evaluatedShell = JSON.parse(vm.runInContext('JSON.stringify({scope:SCOPE_PATH,paths:Array.from(SHELL_PATHS)})', context));
  const actualShellPaths = evaluatedShell.paths.map(shellPath => {
    assert(shellPath === evaluatedShell.scope || shellPath.startsWith(evaluatedShell.scope), 'actual service worker: shell path escapes its scope');
    return shellPath === evaluatedShell.scope ? './' : './' + shellPath.slice(evaluatedShell.scope.length);
  });
  assertShellPathsSafe(actualShellPaths, 'actual service worker');

  for (const url of [
    'https://example.test/hyeonjang/',
    'https://example.test/hyeonjang/index.html',
    'https://example.test/hyeonjang/privacy.html',
    'https://example.test/hyeonjang/terms.html'
  ]) {
    const r = await dispatch(request(url, { mode: 'navigate', destination: 'document' }));
    assert(r.intercepted && r.puts === 1, '허용된 앱 셸 문서를 캐시하지 않는다: ' + url);
  }

  let r;

  for (const [label, req] of [
    ['외부 출처', request('https://cdn.example.net/app.js')],
    ['Authorization', request('https://example.test/hyeonjang/index.html', { headers: { Authorization: 'Bearer TEST_ONLY' }, mode: 'navigate', destination: 'document' })],
    ['쿼리 문서', request('https://example.test/hyeonjang/index.html?view=glance', { mode: 'navigate', destination: 'document' })],
    ['hjreq 민감 쿼리', request('https://example.test/hyeonjang/index.html?hjreq=TEST_ONLY', { mode: 'navigate', destination: 'document' })],
    ['lead 민감 쿼리', request('https://example.test/hyeonjang/index.html?lead=TEST_ONLY', { mode: 'navigate', destination: 'document' })],
    ['알 수 없는 HTML', request('https://example.test/hyeonjang/unknown.html', { mode: 'navigate', destination: 'document' })],
    ['공개 백업 HTML', request('https://example.test/hyeonjang/backup/index_v104_original.html', { mode: 'navigate', destination: 'document' })],
    ['테스트 스크립트', request('https://example.test/hyeonjang/tests/x.js')],
    ['Apps Script 소스', request('https://example.test/hyeonjang/apps-script/Code.gs')],
    ['임의 정적 파일', request('https://example.test/hyeonjang/app.js')],
    ['POST', request('https://example.test/hyeonjang/index.html', { method: 'POST', mode: 'navigate', destination: 'document' })]
  ]) {
    r = await dispatch(req);
    assert(!r.intercepted && r.puts === 0, label + ' 요청을 서비스워커가 가로채거나 캐시한다');
  }

  r = await dispatch(request('https://example.test/hyeonjang/index.html', { mode: 'navigate', destination: 'document' }), { ok: false, type: 'basic', clone() { return this; } });
  assert(r.puts === 0, '실패 응답을 캐시한다');
  r = await dispatch(request('https://example.test/hyeonjang/index.html', { mode: 'navigate', destination: 'document' }), { ok: true, type: 'opaque', clone() { return this; } });
  assert(r.puts === 0, 'opaque 응답을 캐시한다');

  console.log('PASS  같은 출처·쿼리 없는 앱 셸 허용목록만 캐시');
  console.log('PASS  SHELL_PATHS 는 정확한 4개 앱 셸이며 격리 데이터 경로 변이를 거부');
  console.log('PASS  외부·Authorization·쿼리 navigation·민감 쿼리·POST 캐시 차단');
  console.log('PASS  실패·opaque 응답 캐시 차단');
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
