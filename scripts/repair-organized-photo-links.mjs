import fs from 'node:fs';
import path from 'node:path';

const [dataPath, rootPath] = process.argv.slice(2);
if (!dataPath || !rootPath) {
  throw new Error('usage: node repair-organized-photo-links.mjs <_현장.json> <만물 폴더>');
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
if (!Array.isArray(data.files)) throw new Error('files 배열이 없습니다.');

const byName = new Map();
for (let i = 0; i < data.files.length; i++) {
  const f = data.files[i];
  if (!f || f.kind !== 'photo' || !f.name) continue;
  const key = String(f.name).trim().toLowerCase();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push({ f, i });
}

const drop = new Set();
let merged = 0;
let linked = 0;
let alreadyLinked = 0;
const projectCounts = new Map();

for (const group of byName.values()) {
  if (group.length !== 2) continue;
  const organized = group.filter(x => String(x.f.prefix || '').startsWith('_정리완료/'));
  const original = group.filter(x => !String(x.f.prefix || '').startsWith('_정리완료/'));
  if (organized.length !== 1 || original.length !== 1) continue;
  const keep = organized[0].f;
  const old = original[0].f;
  if (keep.project && old.project && keep.project !== old.project) continue;
  const localPath = path.join(rootPath, ...String(keep.prefix || '').split('/').filter(Boolean), keep.name);
  if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) continue;

  if (!keep.driveId && old.driveId) {
    keep.driveId = old.driveId;
    linked++;
  } else if (keep.driveId) {
    alreadyLinked++;
  }
  for (const key of ['text', 'ocr', 'est', 'ledger', 'quote', 'contact', 'address', 'gdFolder', 'lat', 'lng', 'when']) {
    if ((keep[key] === undefined || keep[key] === null || keep[key] === '') && old[key] !== undefined && old[key] !== null && old[key] !== '') {
      keep[key] = old[key];
    }
  }
  if (!keep.exSum && old.exSum) keep.exSum = true;
  keep.key = `${keep.prefix || ''}${keep.name}|${keep.size || 0}`;
  drop.add(original[0].i);
  merged++;
  const project = keep.project || '(미배정)';
  projectCounts.set(project, (projectCounts.get(project) || 0) + 1);
}

data.files = data.files.filter((_, i) => !drop.has(i));

const driveGroups = new Map();
for (let i = 0; i < data.files.length; i++) {
  const f = data.files[i];
  if (!f || f.kind !== 'photo' || !f.driveId) continue;
  if (!driveGroups.has(f.driveId)) driveGroups.set(f.driveId, []);
  driveGroups.get(f.driveId).push({ f, i });
}
const driveDrop = new Set();
let driveDeduped = 0;
for (const group of driveGroups.values()) {
  if (group.length !== 2 || String(group[0].f.name || '').toLowerCase() !== String(group[1].f.name || '').toLowerCase()) continue;
  group.sort((a, b) => {
    const aExists = fs.existsSync(path.join(rootPath, ...String(a.f.prefix || '').split('/').filter(Boolean), a.f.name));
    const bExists = fs.existsSync(path.join(rootPath, ...String(b.f.prefix || '').split('/').filter(Boolean), b.f.name));
    return Number(bExists) - Number(aExists)
      || Number(String(b.f.prefix || '').startsWith('_정리완료/')) - Number(String(a.f.prefix || '').startsWith('_정리완료/'))
      || (Number(b.f.size) || 0) - (Number(a.f.size) || 0);
  });
  const keep = group[0].f;
  const old = group[1].f;
  for (const key of ['text', 'ocr', 'est', 'ledger', 'quote', 'contact', 'address', 'gdFolder', 'lat', 'lng', 'when', 'project', 'phase', 'worklabel']) {
    if ((keep[key] === undefined || keep[key] === null || keep[key] === '') && old[key] !== undefined && old[key] !== null && old[key] !== '') keep[key] = old[key];
  }
  if (!keep.exSum && old.exSum) keep.exSum = true;
  keep.key = `${keep.prefix || ''}${keep.name}|${keep.size || 0}`;
  driveDrop.add(group[1].i);
  driveDeduped++;
}
data.files = data.files.filter((_, i) => !driveDrop.has(i));
data._savedFileCount = data.files.length;
data.savedAt = new Date().toISOString();
fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const result = {
  merged,
  newlyLinked: linked,
  alreadyLinked,
  driveDeduped,
  remainingRecords: data.files.length,
  remainingPhotos: data.files.filter(f => f && f.kind === 'photo').length,
  byProject: Object.fromEntries([...projectCounts].sort((a, b) => a[0].localeCompare(b[0], 'ko')))
};
console.log(JSON.stringify(result, null, 2));
