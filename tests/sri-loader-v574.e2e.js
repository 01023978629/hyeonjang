/* sri-loader-v574.e2e.js — 외부 라이브러리 무결성(SRI)이 브라우저에서 실제로 걸리는지 (v574)

   tests/sri.check.js 는 글자(표·태그·주소 꼴)만 본다. 이 검사는 실제 브라우저로
     · head 의 exif-js <script integrity> 가 진짜 바이트(tests/fixtures/vendor — npm exif-js@2.3.0 exif.js 그대로)는 통과시키고
       한 줄 덧붙인 바이트는 실행하지 않는지
     · 지연 로더(loadExtLib·ensureHeic2any·ensureExifr)가 integrity+crossorigin 을 붙이고, 바이트가 해시와 다르면 실행하지 않고
       '무결성 확인 실패 — 네트워크·버전 확인' 토스트와 같은 글의 오류로 끝나는지, 조용히 다시 받지 않는지(요청 1번)
     · 해시가 그 바이트와 맞으면(검사가 표의 해시를 가짜 바이트의 해시로 바꿔 줌) 그대로 실행되는지 — '늘 실패'가 아니라 '해시 대조'임을 확인
     · pdf.js: getDocument 두 곳(pdfText·미리보기와 같은 옵션)이 isEvalSupported:false, worker 주소는 표(_CDN.pdfworker)
   를 본다. CDN 요청은 전부 가로챈다(바깥으로 나가는 요청 0 — 이 컨테이너는 DNS 가 막혀 있다).
   변이 2종을 서버가 주는 index.html 을 바꿔치기해 실제로 실행한다: integrity 를 안 붙이면 ② 가, eval 옵션을 빼면 ④ 가 뚫린다.
   전제: tests/static-server.js(8299) */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const APP = 'http://localhost:8299/index.html', ORIGIN = new URL(APP).origin;
const assert = (v, m) => { if (!v) throw new Error(m); };
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const EXIF_REAL = fs.readFileSync(path.join(__dirname, 'fixtures', 'vendor', 'exif-js-2.3.0.js'));
const sri = (buf) => 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
const CDN = (p) => 'https://cdn.jsdelivr.net/npm/' + p;
const URLS = {
  exifjs: CDN('exif-js@2.3.0/exif.js'), jszip: CDN('jszip@3.10.1/dist/jszip.min.js'),
  heic2any: CDN('heic2any@0.0.4/dist/heic2any.min.js'), exifr: CDN('exifr@7.1.3/dist/full.umd.js'),
  pdfworker: CDN('pdfjs-dist@3.11.174/build/pdf.worker.min.js'),
};
// 가짜 라이브러리 — 실행되면 흔적을 남긴다(표의 해시와는 당연히 다르다)
const FAKE = {
  jszip: 'window.JSZip=function(){};window.__ran=(window.__ran||{});window.__ran.jszip=(window.__ran.jszip||0)+1;',
  heic2any: 'window.heic2any=async function(){return new Blob()};window.__ran=(window.__ran||{});window.__ran.heic2any=(window.__ran.heic2any||0)+1;',
  exifr: 'window.exifr={parse:async function(){return null}};window.__ran=(window.__ran||{});window.__ran.exifr=(window.__ran.exifr||0)+1;',
};
const MUT = {
  'no-integrity': ["if(lib&&lib.sri){s.integrity=lib.sri;s.crossOrigin='anonymous';}", ''],
  'eval-on': ["getDocument({data:buf,isEvalSupported:false}).promise;   // v574 CVE-2024-4367 완화 — ", "getDocument({data:buf}).promise;   // "],
};
for (const [k, [from]] of Object.entries(MUT)) assert(SRC.split(from).length === 2, '변이 앵커가 소스에 정확히 한 번 있어야 한다: ' + k);
const mutated = (k) => SRC.replace(MUT[k][0], MUT[k][1]);
let browser;

async function open(opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  const hits = {}, outside = [];
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) {
      if (opts.html && new URL(url).pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: opts.html });
      return route.continue();
    }
    const js = (body) => route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body });
    if (url === URLS.exifjs) { hits.exifjs = (hits.exifjs || 0) + 1; return js(opts.exifTamper ? Buffer.concat([EXIF_REAL, Buffer.from('\n// tampered')]) : EXIF_REAL); }
    for (const k of Object.keys(FAKE)) if (url === URLS[k]) { hits[k] = (hits[k] || 0) + 1; return js(FAKE[k]); }
    outside.push(url);
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone].map(p => Promise.resolve(p).catch(() => 0))));
  // head.appendChild 로 붙는 <script> 의 속성을 기록한다
  await page.evaluate(() => { window.__scripts = []; const o = document.head.appendChild.bind(document.head); document.head.appendChild = (el) => { if (el && el.tagName === 'SCRIPT') window.__scripts.push({ src: el.src, integrity: el.integrity, cross: el.crossOrigin }); return o(el); }; });
  return { ctx, page, hits, outside, errors };
}
// 바이트가 표의 해시와 다를 때 지연 로더가 하는 일
const tryLoad = (page, fn) => page.evaluate(async (fn) => {
  document.querySelector('#toast').textContent = '';
  let msg = 'RESOLVED';
  try { await window[fn](); } catch (e) { msg = String(e && e.message); }
  return { msg, toast: document.querySelector('#toast').textContent, ran: (window.__ran || {}), scripts: window.__scripts.slice() };
}, fn);

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  // ① head 정적 태그 — 진짜 바이트는 통과, 한 줄 덧붙이면 실행 안 됨
  { const a = await open();
    const ok = await a.page.evaluate((u) => { const s = [...document.scripts].find(x => x.src === u); return { exif: typeof EXIF, integ: s && s.integrity, cross: s && s.crossOrigin, table: _CDN.exifjs.sri }; }, URLS.exifjs);
    assert(ok.exif === 'function', '① 진짜 exif-js 바이트(npm exif.js)가 head 태그의 integrity 를 통과하지 못했다 — 표의 해시가 그 파일과 다르다: ' + JSON.stringify(ok));
    assert(ok.integ === ok.table && ok.integ === sri(EXIF_REAL) && ok.cross === 'anonymous', '① head 태그의 integrity/crossorigin 이 표·실제 바이트와 다르다: ' + JSON.stringify(ok));
    await a.ctx.close();
    const b = await open({ exifTamper: true });
    const bad = await b.page.evaluate(() => ({ exif: typeof EXIF, app: typeof serializeData }));
    assert(b.hits.exifjs === 1 && bad.exif === 'undefined', '① 한 줄 덧붙인 exif-js 가 실행됐다: ' + JSON.stringify(bad));
    assert(bad.app === 'function', '① exif-js 가 막혀도 앱은 떠야 한다');
    await b.ctx.close();
    console.log('PASS ① head exif-js: 진짜 바이트 통과 · 바뀐 바이트 실행 안 됨 · integrity = 표 = 실제 파일 해시'); }

  // ② 지연 로더 세 갈래 — 다른 바이트는 실행 안 됨 + 토스트 + 다시 받지 않음, 해시가 맞으면 실행
  { const a = await open();
    const table = await a.page.evaluate(() => ({ jszip: _CDN.jszip, heic2any: _CDN.heic2any, exifr: _CDN.exifr, msg: CDN_SRI_FAIL_MSG, plain: _cdnScriptEl('https://apis.google.com/js/api.js').integrity }));
    assert(table.msg === '무결성 확인 실패 — 네트워크·버전 확인', '② 실패 문구가 다르다: ' + table.msg);
    assert(table.plain === '', '② 표 밖 주소(문자열)에는 integrity 를 붙이지 않는다');
    for (const [k, fn] of [['jszip', 'ensureJSZip'], ['heic2any', 'ensureHeic2any'], ['exifr', 'ensureExifr']]) {
      assert(table[k].src === URLS[k], '② 표의 ' + k + ' 주소가 검사와 다르다: ' + table[k].src);
      const r = await tryLoad(a.page, fn);
      const el = r.scripts.find(s => s.src === URLS[k]);
      assert(el && el.integrity === table[k].sri && el.cross === 'anonymous', '② ' + k + ' 로더가 integrity·crossorigin 을 붙이지 않았다: ' + JSON.stringify(el));
      assert(!r.ran[k], '② 해시와 다른 ' + k + ' 가 실행됐다');
      assert(r.msg === table.msg && r.toast === table.msg, '② ' + k + ' 실패가 무결성 문구로 알려지지 않았다: ' + JSON.stringify({ msg: r.msg, toast: r.toast }));
      assert(a.hits[k] === 1, '② ' + k + ' 를 조용히 다시 받았다(요청 ' + a.hits[k] + '번)');
    }
    // 해시를 그 바이트의 것으로 바꾸면 실행된다 — 로더가 '늘 실패'하는 것이 아니다
    await a.page.evaluate((h) => { for (const k of Object.keys(h)) _CDN[k].sri = h[k]; }, { jszip: sri(Buffer.from(FAKE.jszip)), heic2any: sri(Buffer.from(FAKE.heic2any)), exifr: sri(Buffer.from(FAKE.exifr)) });
    for (const [k, fn] of [['jszip', 'ensureJSZip'], ['heic2any', 'ensureHeic2any'], ['exifr', 'ensureExifr']]) {
      const r = await tryLoad(a.page, fn);
      assert(r.msg === 'RESOLVED' && r.ran[k] === 1 && r.toast === '', '② 해시가 맞는 ' + k + ' 가 실행되지 않았다: ' + JSON.stringify({ msg: r.msg, ran: r.ran, toast: r.toast }));
    }
    assert(a.errors.length === 0, '② pageerror: ' + a.errors.join(' | '));
    assert(a.outside.every(u => !/cdnjs\.cloudflare\.com/.test(u)), '② cdnjs 요청이 나갔다: ' + a.outside.join(' '));
    await a.ctx.close();
    console.log('PASS ② 지연 로더(JSZip·heic2any·exifr): integrity+crossorigin · 다른 바이트 실행 안 됨 · 토스트 · 재요청 없음 · 해시 맞으면 실행'); }

  // ③ 오프라인이면 무결성이 아니라 오프라인이라고 말한다(예전 문구 그대로)
  { const a = await open();
    const r = await a.page.evaluate(async () => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); try { await ensureJSZip(); return 'RESOLVED'; } catch (e) { return String(e.message); } });
    assert(/오프라인/.test(r), '③ 오프라인 안내가 바뀌었다: ' + r);
    assert(!a.hits.jszip, '③ 오프라인인데 요청을 보냈다');
    await a.ctx.close();
    console.log('PASS ③ 오프라인은 오프라인 문구(요청 0)'); }

  // ④ pdf.js — getDocument 옵션·worker 주소 (pdf.js 자체는 대역: 옵션만 기록)
  const pdfProbe = async (html) => {
    const a = await open({ html });
    const r = await a.page.evaluate(async () => {
      window.__gd = [];
      window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: (o) => { window.__gd.push(Object.assign({}, o, { data: undefined })); return { promise: Promise.reject(new Error('STUB_PDF')) }; } };
      const rec = { id: 'pdf-probe', name: 'probe.pdf', ext: 'pdf', _file: new File([new Uint8Array([37, 80, 68, 70])], 'probe.pdf', { type: 'application/pdf' }) };
      let err = ''; try { await pdfText(rec); } catch (e) { err = String(e.message); }
      return { err, gd: window.__gd, worker: pdfjsLib.GlobalWorkerOptions.workerSrc };
    });
    await a.ctx.close();
    return r;
  };
  { const r = await pdfProbe(null);
    assert(r.err === 'STUB_PDF' && r.gd.length === 1, '④ pdfText 가 getDocument 를 부르지 않았다: ' + JSON.stringify(r));
    assert(r.gd[0].isEvalSupported === false, '④ pdfText 의 getDocument 에 isEvalSupported:false 가 없다');
    assert(r.worker === URLS.pdfworker, '④ pdf.js worker 주소가 표(_CDN.pdfworker)가 아니다: ' + r.worker);
    const calls = SRC.match(/getDocument\(\{[^)]*\}\)/g) || [];
    assert(calls.length === 2 && calls.every(c => /isEvalSupported:false/.test(c)), '④ getDocument 두 곳(pdfText·미리보기) 모두 isEvalSupported:false 여야 한다: ' + calls.join(' / '));
    console.log('PASS ④ pdf.js getDocument isEvalSupported:false(두 곳) · worker 주소 = 표'); }

  // ⑤ 변이 — 실제로 실행해서 잡는다
  { const a = await open({ html: mutated('no-integrity') });
    const r = await tryLoad(a.page, 'ensureJSZip');
    await a.ctx.close();
    assert(r.msg === 'RESOLVED' && r.ran.jszip === 1, '변이 no-integrity 가 잡히지 않았다 — ② 가 integrity 없이도 통과한다: ' + JSON.stringify(r));
    const p = await pdfProbe(mutated('eval-on'));
    assert(p.gd.length === 1 && p.gd[0].isEvalSupported !== false, '변이 eval-on 이 잡히지 않았다 — ④ 가 옵션 없이도 통과한다');
    console.log('PASS ⑤ 변이 2종(no-integrity·eval-on) 검출'); }

  console.log('PASS  sri-loader-v574 — head·지연 로더·오프라인·pdf.js·변이 2');
})().catch((e) => { console.error('FAIL ', e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
