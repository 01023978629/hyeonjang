#!/usr/bin/env node
/* tools/photo-audit-offline.mjs — 현장데이터.json 을 앱 없이 점검·수정한다

   쓰는 때: 대표가 앱(더보기 → 데이터 → 내보내기)이나 드라이브 만물인테리어▸데이터 에서 꺼낸
   현장데이터.json 을 주면, 앱 v251 「📍 사진 배정 점검」과 같은 규칙으로
     ① GPS 가 배정 현장과 어긋난 사진 → 가까운 현장이 있으면 재배정, 없으면 '확인 필요'
     ② 같은 크기·촬영시각(2초) 중복 → 보고(제거는 앱에서 — 앱만 '다시 불러와도 안 들어오게' 기록한다)
   을 하고, 수정본 JSON + 보고서 md 를 만든다. 원본은 절대 덮어쓰지 않는다.

   사용:  node tools/photo-audit-offline.mjs <현장데이터.json> [--out DIR] [--apply] [--drop-dups]
     --apply      재배정 제안을 수정본에 실제로 반영한다(없으면 보고서만)
     --drop-dups  중복 사진 기록을 수정본에서 뺀다(주의: 드라이브 재스캔 때 다시 들어올 수 있어 기본은 보고만)
   산출:  DIR/현장데이터_수정본_YYYYMMDD_HHMM.json, DIR/사진배정점검_YYYYMMDD_HHMM.md, 원본 사본(_백업_클로드_)

   규칙(앱과 같은 숫자): 기준 좌표 = 현장 lat/lng, 없으면 그 현장 사진의 가장 큰 GPS 묶음(0.0045도) 중심.
   1km 넘게 떨어졌고 다른 현장이 0.5km 안이면 재배정, 아니면 확인 필요. 보관(archived) 현장 제외. */
import fs from 'node:fs';
import path from 'node:path';

export const FAR_KM = 1.0, NEAR_KM = 0.5, CLUSTER_DEG = 0.0045, DUP_BUCKET_MS = 2000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n !== 0 ? n : 0; };
export function geoDist(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const whenMs = (w) => { const t = w instanceof Date ? w.getTime() : Date.parse(String(w || '')); return Number.isFinite(t) ? t : null; };

export function projectCoord(projName, projects, photos) {
  const p = projects.find((x) => x.name === projName);
  if (p && num(p.lat) && num(p.lng)) return { lat: num(p.lat), lng: num(p.lng), src: 'project' };
  const pts = photos.filter((f) => f.project === projName && num(f.lat) && num(f.lng));
  if (!pts.length) return null;
  const groups = [];
  for (const f of pts) {
    let g = groups.find((x) => Math.abs(x.lat - num(f.lat)) < CLUSTER_DEG && Math.abs(x.lng - num(f.lng)) < CLUSTER_DEG);
    if (!g) { g = { lat: num(f.lat), lng: num(f.lng), n: 0, sumLat: 0, sumLng: 0 }; groups.push(g); }
    g.n += 1; g.sumLat += num(f.lat); g.sumLng += num(f.lng);
  }
  groups.sort((a, b) => b.n - a.n);
  const g = groups[0];
  return { lat: g.sumLat / g.n, lng: g.sumLng / g.n, src: 'photos', n: g.n, groups: groups.length };
}

/* 같은 크기 + 촬영시각 2초 버킷 (앱 markDuplicates 와 같은 키). 첫 장이 대표. */
export function findDuplicates(photos) {
  const groups = new Map();
  photos.forEach((p, index) => {
    const t = whenMs(p.when);
    const key = (num(p.size) || 0) + '_' + (t == null ? 'na' : Math.round(t / DUP_BUCKET_MS));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ p, index });
  });
  const sets = [];
  for (const g of groups.values()) if (g.length > 1) sets.push(g);
  return sets;
}

export function audit(data) {
  const projects = (Array.isArray(data.projects) ? data.projects : []).filter((p) => p && p.name && !p.archived);
  const photos = (Array.isArray(data.files) ? data.files : []).filter((f) => f && f.kind === 'photo');
  const coords = {};
  for (const p of projects) coords[p.name] = projectCoord(p.name, projects, photos);
  const mismatches = [], unsure = [];
  let checked = 0, noGps = 0, noRef = 0, unassigned = 0;
  photos.forEach((f, index) => {
    if (!f.project) { unassigned += 1; return; }
    if (!(num(f.lat) && num(f.lng))) { noGps += 1; return; }
    const ref = coords[f.project];
    if (!ref) { noRef += 1; return; }
    checked += 1;
    const km = geoDist(num(f.lat), num(f.lng), ref.lat, ref.lng);
    if (km <= FAR_KM) return;
    let best = null;
    for (const p of projects) {
      if (p.name === f.project) continue;
      const c = coords[p.name]; if (!c) continue;
      const d = geoDist(num(f.lat), num(f.lng), c.lat, c.lng);
      if (d <= NEAR_KM && (!best || d < best.km)) best = { to: p.name, km: d };
    }
    const row = { index, key: f.key || '', name: f.name || '', from: f.project, km: Math.round(km * 10) / 10, when: f.when || null, address: f.address || '' };
    if (best) { row.to = best.to; row.toKm = Math.round(best.km * 100) / 100; mismatches.push(row); } else unsure.push(row);
  });
  const dupSets = findDuplicates(photos).map((g) => ({ keep: g[0].p.name, drop: g.slice(1).map((x) => ({ name: x.p.name, key: x.p.key || '', project: x.p.project || '', driveId: x.p.driveId || '' })) }));
  const dups = dupSets.reduce((n, g) => n + g.drop.length, 0);
  return { photos: photos.length, projects: projects.length, checked, noGps, noRef, unassigned, mismatches, unsure, dupSets, dups, coords };
}

/* 수정본 만들기 — 원본 객체는 건드리지 않고 깊은 복사본을 돌려준다. 모르는 필드는 그대로 보존. */
export function applyFixes(data, result, options = {}) {
  const next = JSON.parse(JSON.stringify(data));
  const files = Array.isArray(next.files) ? next.files : [];
  const photoIndexes = []; files.forEach((f, i) => { if (f && f.kind === 'photo') photoIndexes.push(i); });
  let reassigned = 0, dropped = 0;
  if (options.apply) {
    for (const m of result.mismatches) {
      const f = files[photoIndexes[m.index]];
      if (!f || f.project !== m.from) continue;
      f.project = m.to; f.phase = null; reassigned += 1;
    }
  }
  if (options.dropDups) {
    const dropKeys = new Set();
    for (const g of result.dupSets) for (const d of g.drop) dropKeys.add(d.key + '|' + d.name);
    next.files = files.filter((f) => !(f && f.kind === 'photo' && dropKeys.has((f.key || '') + '|' + (f.name || ''))));
    dropped = files.length - next.files.length;
    if (typeof next._savedFileCount === 'number') next._savedFileCount = next.files.length;
  }
  return { data: next, reassigned, dropped };
}

export function report(result, options = {}) {
  const fmt = (w) => { const t = whenMs(w); return t == null ? '' : new Date(t).toISOString().slice(0, 10); };
  const L = [];
  L.push('# 사진 배정 점검 ' + (options.stamp || ''));
  L.push('');
  L.push(`- 사진 ${result.photos}장 · 현장 ${result.projects}곳 · GPS 대조 ${result.checked}장 · GPS 없음 ${result.noGps}장 · 미배정 ${result.unassigned}장`);
  L.push(`- 재배정 제안 **${result.mismatches.length}장** · 확인 필요 **${result.unsure.length}장** · 중복 **${result.dups}장**(${result.dupSets.length}묶음)`);
  L.push(`- 수정본 반영: 재배정 ${options.reassigned || 0}장${options.dropped ? ' · 중복 제거 ' + options.dropped + '장' : ''}`);
  L.push('');
  L.push('## 재배정 제안 (배정 현장에서 1km 넘게 떨어졌고 다른 현장이 500m 안)');
  L.push('');
  L.push('| 사진 | 촬영일 | 배정 | 떨어진 거리 | → 제안 현장 | 제안 현장까지 |');
  L.push('|---|---|---|---|---|---|');
  for (const m of result.mismatches) L.push(`| ${m.name} | ${fmt(m.when)} | ${m.from} | ${m.km}km | **${m.to}** | ${m.toKm}km |`);
  if (!result.mismatches.length) L.push('| (없음) | | | | | |');
  L.push('');
  L.push('## 확인 필요 (멀지만 가까운 현장이 없음 — 자동으로 옮기지 않음)');
  L.push('');
  L.push('| 사진 | 촬영일 | 배정 | 떨어진 거리 | 주소 |');
  L.push('|---|---|---|---|---|');
  for (const u of result.unsure) L.push(`| ${u.name} | ${fmt(u.when)} | ${u.from} | ${u.km}km | ${u.address} |`);
  if (!result.unsure.length) L.push('| (없음) | | | | |');
  L.push('');
  L.push('## 중복 (같은 크기·촬영시각 — 대표 1장 유지, 나머지는 앱 「중복 제거」로)');
  L.push('');
  for (const g of result.dupSets) L.push(`- 유지 \`${g.keep}\` ← 제거 대상 ${g.drop.map((d) => '`' + d.name + '`' + (d.project ? '(' + d.project + ')' : '')).join(', ')}`);
  if (!result.dupSets.length) L.push('- (없음)');
  L.push('');
  L.push('## 현장 기준 좌표');
  L.push('');
  for (const [name, c] of Object.entries(result.coords)) L.push(`- ${name}: ${c ? (c.src === 'project' ? '현장 좌표' : `사진 묶음 ${c.n}장 중심(묶음 ${c.groups}개)`) : '기준 없음(GPS 사진·좌표 없음)'}`);
  L.push('');
  L.push('반영 방법: 수정본 JSON 을 앱 → 더보기 → 데이터 → **불러오기** 로 여세요(앱이 먼저 백업을 묻습니다). 중복 제거는 앱 사진 탭 → 도구 → 📍 사진 배정 점검 → 「중복 N장 제거」.');
  return L.join('\n') + '\n';
}

function stampNow() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16).replace('T', '_').replace(/[-:]/g, '');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  if (!input) { console.error('사용: node tools/photo-audit-offline.mjs <현장데이터.json> [--out DIR] [--apply] [--drop-dups]'); process.exit(2); }
  const outIndex = args.indexOf('--out');
  const outDir = outIndex >= 0 ? args[outIndex + 1] : path.dirname(path.resolve(input));
  const apply = args.includes('--apply'), dropDups = args.includes('--drop-dups');
  const raw = fs.readFileSync(input, 'utf8');
  const data = JSON.parse(raw);
  const stamp = stampNow();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `현장데이터_백업_클로드_${stamp}.json`), raw);
  const result = audit(data);
  const fixed = applyFixes(data, result, { apply, dropDups });
  const md = report(result, { stamp, reassigned: fixed.reassigned, dropped: fixed.dropped });
  fs.writeFileSync(path.join(outDir, `사진배정점검_${stamp}.md`), md);
  if (apply || dropDups) fs.writeFileSync(path.join(outDir, `현장데이터_수정본_${stamp}.json`), JSON.stringify(fixed.data, null, 1));
  console.log(md);
  console.log(`산출: ${outDir} (백업·보고서${apply || dropDups ? '·수정본' : ''})`);
}
