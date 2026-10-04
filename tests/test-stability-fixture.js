/* Test-only probes and in-memory protection removal. Never writes index.html,
   changes real data, or sends requests to the configured production server. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const APP = 'http://127.0.0.1:8299/index.html';
const mutation = process.env.HJ_TEST_STABILITY_MUTATION || '';
const modes = ['', 'portal-apply-notify', 'portal-idb-reject', 'warranty-stale-photo', 'online-flush', 'boot-wait', 'field-focus', 'small-touch'];
assert(modes.includes(mutation), 'unknown stability mutation');

function replaceOnce(source, from, to) {
  assert(source.includes(from) && source.indexOf(from) === source.lastIndexOf(from), 'mutation anchor missing or ambiguous');
  return source.replace(from, to);
}
function testAppSource(mode = mutation) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  if (mode === 'portal-apply-notify') {
    source = replaceOnce(source, '.catch(portalKeyAdoptFailed)', '.catch(function(){})');
  } else if (mode === 'portal-idb-reject') {
    source = replaceOnce(source, '}catch(e){try{r.result.close();}catch(_){}rej(e);}', '}catch(e){try{r.result.close();}catch(_){}res();}');
  } else if (mode === 'warranty-stale-photo') {
    source = replaceOnce(source, 'targets.push({id:id,side:side});', 'targets.push({id:id,side:side,old:f});');
    source = replaceOnce(source, "const f=(state.files||[]).find(function(x){return x&&x.id===t.id&&x.kind==='photo'&&x.project===pjName;});", 'const f=t.old;');
  } else if (mode === 'online-flush') {
    source = replaceOnce(source, "window.addEventListener('online',function(){try{cloudFlushQueue();}catch(e){}", "window.addEventListener('online',function(){");
  } else if (mode === 'field-focus') {
    const start = source.indexOf('function hjFieldIssue(el,msg){');
    const end = source.indexOf('function hjFieldIssueClear(el){', start);
    assert(start >= 0 && end > start, 'mutation anchor missing: field issue');
    const body = source.slice(start, end);
    source = replaceOnce(source, body, replaceOnce(body, 'try{el.focus();}catch(e){}', '/* synthetic removal of error-field focus */'));
  } else if (mode === 'small-touch') {
    source = replaceOnce(source, 'style="min-height:44px;white-space:normal">🧰 <span data-dashboard-prep=', 'style="min-height:43px!important;height:43px!important;max-height:43px!important;white-space:normal">🧰 <span data-dashboard-prep=');
  } else {
    assert(mode === '' || mode === 'boot-wait', 'unknown source mutation');
  }
  return source;
}
async function installTestMutation(page) {
  if (!mutation || mutation === 'boot-wait') return;
  const body = testAppSource();
  await page.route(APP, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
}

// CSS translate 전환 중 DOMRect 높이가 43.99997로 반올림될 수 있다.
// 실제 전환/예약 렌더가 끝난 뒤 측정한다. 크기값이나 44px 단언은 보정하지 않는다.
async function waitForTouchLayout(page, selector) {
  await page.waitForFunction(selector => {
    if (typeof __renderScheduled !== 'undefined' && __renderScheduled) return false;
    const targets = [...document.querySelectorAll(selector)];
    if (!targets.length) return false;
    const related = new Set();
    for (const target of targets) {
      for (let node = target; node; node = node.parentElement) related.add(node);
    }
    return [...related].every(node => node.getAnimations().every(animation =>
      !animation.pending && (animation.playState === 'finished' || animation.playState === 'idle')));
  }, selector);
}

// Playwright와 결정적 VM 재현이 같은 측정 함수를 쓴다. 다른 부팅 게이트 검사는 변경하지 않는다.
async function eventTriggerProbe(waitForBoot = true) {
  await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone]);
  if (waitForBoot) await window.__hjRelayBootDone;
  let calls = 0;
  const flushStacks = [];
  window.cloudOfficeInbox = async () => {
    calls += 1;
    return { ok: true, requests: [], cursor: '', operationalErrors: [] };
  };
  window.cloudFlushQueue = () => { flushStacks.push(new Error('synthetic queue flush').stack); };
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  __relay.url = 'https://relay.test/exec';
  __relay.token = 'TEST-STABILITY-SYNTHETIC-TOKEN';
  __officeIntakeAutoLastStartedAt = 0;
  __officeIntakeSyncPromise = null;
  window.dispatchEvent(new Event('online'));
  await new Promise(resolve => setTimeout(resolve, 0));
  const afterOnline = calls;
  __officeIntakeAutoLastStartedAt = 0;
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setTimeout(resolve, 0));
  return { calls, afterOnline, queueFlushes: flushStacks.length, flushStacks };
}
module.exports = { mutation, testAppSource, installTestMutation, eventTriggerProbe, waitForTouchLayout };
