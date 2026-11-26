/* v627 대표 요청(11/26) "동호수가 다르면 사진 분류해줘" — 사진 탭 '현장 방문' 묶음을 동·호수가 다르면 나눈다.
   ① 한 방문(6시간·GPS·현장)에 연결된 동·호수가 둘 이상 → 동·호수마다 묶음(첫 사진 순) + 연결 없는 사진은 맨 뒤 한 묶음
   ② 동·호수가 하나뿐(미지정 섞임 포함)·동·호수를 안 쓰는 현장·끊긴 연결 → 예전 그대로(같은 묶음 객체)
   ③ 새 묶음 칸: first = 첫 사진 시각 · last = 마지막 시각 · 앵커 = 첫 GPS · 표시 좌표·주소 = 마지막 GPS
   ④ 재방문 회차: 나눈 묶음은 한 번 · ⑤ 칩: 나누고 남은 묶음은 '동·호수 미지정 n장', 나누지 않은 묶음은 예전처럼(연결 없으면 빈 칸)
   브라우저 없이 돈다: index.html 에서 clusterPhotos·hjClusterSplitUnits·hjClusterFromItems·groupRevisits·hjClusterUnits·hjClusterUnitHTML·
   aptUnitForPhoto·hjPhotoHasGps·hjPhotoGpsNear 를 떼어 VM 에서 부른다(현장·세대 표는 가짜). 이름·현장은 시험용 가짜.
   변이(HJ_V627_MUTATION): no-split · split-one-unit · rest-into-first · rest-dropped · guess-rest · visit-per-part · no-rest-chip · anchor-last · last-first */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-split': ['  return hjClusterSplitUnits(clusters);\n}', '  return clusters;\n}'],
  'split-one-unit': ['    if(groups.size<2){out.push(c);continue;}', '    if(groups.size<1){out.push(c);continue;}'],
  'rest-into-first': ['    const parts=[...groups.values()];if(rest.length)parts.push(rest);', '    const parts=[...groups.values()];if(rest.length)parts[0].push(...rest);'],
  'rest-dropped': ['    const parts=[...groups.values()];if(rest.length)parts.push(rest);', '    const parts=[...groups.values()];'],
  'guess-rest': ['      if(key){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}else rest.push(f);', '      if(key){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}else if(groups.size)[...groups.values()].pop().push(f);else rest.push(f);'],
  'visit-per-part': ['const k=v._partKey||v;if(!keys.includes(k))keys.push(k);', 'const k=v;if(!keys.includes(k))keys.push(k);'],
  'no-rest-chip': ['    if(!(c&&c._partKey))return \'\';', '    return \'\';'],
  'anchor-last': ['if(c.anchorLat==null){c.anchorLat=p.lat;c.anchorLng=p.lng;}', 'c.anchorLat=p.lat;c.anchorLng=p.lng;'],
  'last-first': ['if(i===0){c.first=p.when;c.last=p.when;}else c.last=p.when||c.last;', 'if(i===0){c.first=p.when;c.last=p.when;}'],
};
if (process.env.HJ_V627_MUTATION) {
  const m = MUT[process.env.HJ_V627_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V627_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V627_MUTATION); html = html.replace(m[0], () => m[1]);
}
function grab(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 이 없다');
  let i = html.indexOf('{', html.indexOf(')', at)), depth = 0;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(at, i + 1);
}
const NAMES = ['hjPhotoHasGps', 'hjPhotoGpsNear', 'aptUnitForPhoto', 'clusterPhotos', 'hjClusterFromItems', 'hjClusterSplitUnits', 'groupRevisits', 'hjClusterUnits', 'hjClusterUnitHTML'];
const PROJECTS = {
  '가상타운': { name: '가상타운', units: [{ id: 'a', type: 'unit', dong: '105', ho: '905' }, { id: 'b', type: 'unit', dong: '106', ho: '806' }, { id: 'c', type: 'unit', dong: '101', ho: '101' }] },
  '가상빌라': { name: '가상빌라', units: null },   // 동·호수를 안 쓰는 현장
};
const ctx = vm.createContext({
  HJ_CLUSTER_UNIT_SHOW: 2,
  aptUnitProject: n => PROJECTS[n] || null,
  aptUnitManaged: p => !!(p && p.units),
  aptUnitList: p => (p && p.units) || [],
  aptUnitLabel: u => u.type === 'unit' ? u.dong + '동 ' + u.ho + '호' : u.name,
  escapeAttr: s => String(s), escapeHtml: s => String(s),
});
vm.runInContext(NAMES.map(grab).join('\n') + '\n' + NAMES.map(n => `this.${n}=${n};`).join(''), ctx);
const { clusterPhotos, groupRevisits, hjClusterUnitHTML } = ctx;

const T0 = Date.parse('2026-11-26T12:00:00+09:00');
let seq = 0;
const ph = (min, unit, extra = {}) => ({
  id: 'p' + (++seq), kind: 'photo', project: '가상타운', when: new Date(T0 + min * 60000),
  lat: 36.353 + min * 1e-6, lng: 127.358, place: 'P' + min, address: 'A' + min,
  ...(unit ? { _aptUnit: { project: '가상타운', unitId: unit } } : {}), ...extra,
});
const ids = c => Array.from(c.items, p => p.id);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', n, name); };

t('① 동·호수 둘 → 동·호수마다 + 미지정 맨 뒤', () => {
  seq = 0;
  const A = [ph(20, 'a'), ph(25, 'a'), ph(30, 'a')], U = [ph(60, null)], B = [ph(201, 'b'), ph(205, 'b')], A2 = [ph(210, 'a')];
  const cs = clusterPhotos([...B, ...U, ...A2, ...A]);
  assert.equal(cs.length, 3, '105동 · 106동 · 미지정');
  assert.deepEqual(ids(cs[0]), ['p1', 'p2', 'p3', 'p7'], '105동 905호 — 처음 사진이 먼저인 동·호수가 앞, 시간 순');
  assert.deepEqual(ids(cs[1]), ['p5', 'p6']);
  assert.deepEqual(ids(cs[2]), ['p4'], '연결 없는 사진은 짐작해 붙이지 않고 따로');
  assert.ok(cs[0]._partKey && cs[0]._partKey === cs[1]._partKey && cs[1]._partKey === cs[2]._partKey);
  assert.equal(cs[0]._partN, 3);
});
t('② 하나뿐·안 쓰는 현장·끊긴 연결은 그대로', () => {
  seq = 0;
  let cs = clusterPhotos([ph(0, 'a'), ph(10, null), ph(20, 'a')]);
  assert.equal(cs.length, 1); assert.equal(cs[0]._partKey, undefined); assert.equal(cs[0].items.length, 3);
  cs = clusterPhotos([ph(0, 'a', { project: '가상빌라', _aptUnit: { project: '가상빌라', unitId: 'a' } }), ph(5, 'b', { project: '가상빌라', _aptUnit: { project: '가상빌라', unitId: 'b' } })]);
  assert.equal(cs.length, 1, '동·호수 관리를 안 하는 현장');
  cs = clusterPhotos([ph(0, 'a'), ph(5, 'zz-gone')]);
  assert.equal(cs.length, 1, '지운 세대(끊긴 연결)는 미지정으로 본다 — 하나뿐');
  cs = clusterPhotos([ph(0, 'a'), ph(5, 'b', { _aptUnit: { project: '다른현장', unitId: 'b' } })]);
  assert.equal(cs.length, 1, '다른 현장 앞으로 된 연결은 안 셈');
  cs = clusterPhotos([ph(0, 'a'), ph(500, 'b')]);
  assert.equal(cs.length, 2, '6시간 넘게 떨어진 것은 원래도 다른 방문');
  assert.equal(cs[0]._partKey, undefined);
});
t('③ 새 묶음 칸', () => {
  seq = 0;
  const a1 = ph(0, 'a'), a2 = ph(10, 'a'), a3 = ph(20, 'a', { address: '가상 마지막' }), b1 = ph(30, 'b');   // GPS 없는 사진은 원래도 GPS 묶음과 따로
  const cs = clusterPhotos([a1, a2, a3, b1]), c = cs[0];
  assert.equal(c.first.getTime(), a1.when.getTime()); assert.equal(c.last.getTime(), a3.when.getTime());
  assert.equal(c.anchorLat, a1.lat, '앵커 = 첫 GPS'); assert.equal(c.lat, a3.lat, '표시 = 마지막 GPS'); assert.equal(c.address, a3.address);
  const noGps = clusterPhotos([ph(0, 'a', { lat: null, lng: null }), ph(5, 'b', { lat: null, lng: null })]);
  assert.equal(noGps.length, 2); assert.equal(noGps[0].lat, null); assert.equal(noGps[0].anchorLat, null);
});
t('④ 재방문 회차는 나눈 묶음을 한 번', () => {
  seq = 0;
  const early = ph(-60 * 24 * 3, 'c'), cs = clusterPhotos([early, ph(0, 'a'), ph(10, 'b'), ph(20, null)]);
  assert.equal(cs.length, 4);
  groupRevisits(cs);
  assert.deepEqual(Array.from(cs, c => [c._visitNo, c._visitTotal]), [[1, 2], [2, 2], [2, 2], [2, 2]]);
});
t('⑤ 칩', () => {
  seq = 0;
  const cs = clusterPhotos([ph(0, 'a'), ph(10, 'b'), ph(20, null), ph(25, null)]);
  assert.match(hjClusterUnitHTML(cs[0]), /105동 905호</);
  assert.match(hjClusterUnitHTML(cs[1]), /106동 806호</);
  assert.match(hjClusterUnitHTML(cs[2]), /동·호수 미지정 2장/);
  const plain = clusterPhotos([ph(100, null)]);
  assert.equal(hjClusterUnitHTML(plain[0]), '', '나누지 않은 묶음은 예전처럼');
});
console.log('unitsplit-v627', n + '/5');
