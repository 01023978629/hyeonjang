/* sensitive-query.e2e.js — 주소 쿼리의 상담·작업요청 PII 실행 차단

   보호하는 사고:
     · ?hjreq / ?lead 값은 주소에서 즉시 제거하고 해독·모달 표시·장부 반영하지 않는다.
     · 안전 안내에는 서버 로그에 덜 남는 #hjreq / #lead 형식을 명시한다.
     · 기존 프래그먼트 링크는 계속 사용 가능하다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const b64 = value => Buffer.from(JSON.stringify(value), 'utf8')
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let browser;

(async () => {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const errors = [];

  const req = b64({ requests: [{ id: 'TEST-Q1', tool: 'add_note', args: { text: 'TEST_QUERY_REQUEST' }, why: 'TEST_ONLY' }] });
  const p1 = await ctx.newPage();
  p1.on('pageerror', e => errors.push('hjreq: ' + String(e)));
  await p1.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await p1.goto(APP + '?hjreq=' + req, { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(1700);
  const hjreq = await p1.evaluate(() => ({
    url: location.href,
    modal: (document.getElementById('modalRoot') || {}).textContent || '',
    approvals: document.querySelectorAll('#modalRoot .clai').length,
    toast: (document.getElementById('toast') || {}).textContent || '',
    note: (state.notes || []).some(n => /TEST_QUERY_REQUEST/.test(String(n && n.text || '')))
  }));
  assert(!/[?&]hjreq=/.test(hjreq.url), '?hjreq 민감값이 주소에 남아 있다: ' + hjreq.url);
  assert(hjreq.approvals === 0 && !/링크로 받은 요청|TEST_QUERY_REQUEST/.test(hjreq.modal) && !hjreq.note,
    '?hjreq가 해독되거나 승인 화면으로 전달됐다');
  assert(/실행하지/.test(hjreq.toast) && /#hjreq/.test(hjreq.toast), '?hjreq 차단 안전 안내가 없다: ' + hjreq.toast);

  const leadPayload = b64({ leadId: 'TEST-LEAD-Q1', name: 'TEST_QUERY_LEAD', phone: '000-0000-0000', region: 'TEST_REGION' });
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('lead: ' + String(e)));
  await p2.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await p2.goto(APP + '?lead=' + leadPayload, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1300);
  const lead = await p2.evaluate(() => ({
    url: location.href,
    modal: (document.getElementById('modalRoot') || {}).textContent || '',
    toast: (document.getElementById('toast') || {}).textContent || '',
    project: (state.projects || []).some(p => /TEST_QUERY_LEAD|TEST_REGION/.test(String(p && p.name || '')))
  }));
  assert(!/[?&]lead=/.test(lead.url), '?lead 민감값이 주소에 남아 있다: ' + lead.url);
  assert(!/TEST_QUERY_LEAD/.test(lead.modal) && !lead.project, '?lead가 해독되거나 실행됐다');
  assert(/실행하지/.test(lead.toast) && /#lead/.test(lead.toast), '?lead 차단 안전 안내가 없다: ' + lead.toast);

  const p3 = await ctx.newPage();
  p3.on('pageerror', e => errors.push('fragment: ' + String(e)));
  await p3.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await p3.goto(APP + '#hjreq=' + req, { waitUntil: 'domcontentloaded' });
  await p3.waitForTimeout(1500);
  const fragment = await p3.evaluate(() => ({
    text: (document.getElementById('modalRoot') || {}).textContent || '',
    approvals: document.querySelectorAll('#modalRoot .clai').length
  }));
  assert(fragment.approvals === 1 && /링크로 받은|메모 기록/.test(fragment.text), '#hjreq 프래그먼트 요청까지 막혔다');

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('PASS  ?hjreq 주소 제거 + 해독·실행 차단 + #hjreq 안내');
  console.log('PASS  ?lead 주소 제거 + 해독·실행 차단 + #lead 안내');
  console.log('PASS  #hjreq 프래그먼트 경로 유지');
  await ctx.close();
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});
