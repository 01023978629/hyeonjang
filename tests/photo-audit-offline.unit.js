/* photo-audit-offline.unit.js — tools/photo-audit-offline.mjs 가 앱 v251 「사진 배정 점검」과 같은 규칙으로
   현장데이터.json 을 점검하고, 원본을 건드리지 않은 수정본을 만드는지. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

(async () => {
  const mod = await import(path.join(__dirname, '..', 'tools', 'photo-audit-offline.mjs'));
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], customer: {} }, extra || {});
  const data = {
    version: 2, app: '현장', savedAt: '2026-09-03T00:00:00.000Z', _savedFileCount: 10, unknownTopLevel: { keep: true },
    projects: [P('둔산현장', { lat: 36.35, lng: 127.38 }), P('은행현장'), P('유성현장'), P('보관현장', { archived: true, lat: 36.33, lng: 127.43 })],
    files: [
      { key: 'k-est', name: '견적.xlsx', kind: 'estimate', project: '둔산현장', est: { amount: 100 } },
      { key: 'k-ok1', name: 'ok1.jpg', kind: 'photo', project: '둔산현장', when: '2026-08-01T00:00:00.000Z', lat: 36.3505, lng: 127.3806, size: 100, phase: '철거', custom: 'keep-me' },
      { key: 'k-wrong1', name: 'wrong1.jpg', kind: 'photo', project: '둔산현장', when: '2026-08-02T00:00:00.000Z', lat: 36.3302, lng: 127.4301, size: 101, phase: '철거', address: '대전 동구 은행동' },
      { key: 'k-bankfar', name: 'bankfar.jpg', kind: 'photo', project: '은행현장', when: '2026-08-04T00:00:00.000Z', lat: 36.60, lng: 127.10, size: 104 },
      { key: 'k-bank1', name: 'bank1.jpg', kind: 'photo', project: '은행현장', when: '2026-08-03T00:00:00.000Z', lat: 36.3301, lng: 127.4302, size: 102 },
      { key: 'k-bank2', name: 'bank2.jpg', kind: 'photo', project: '은행현장', when: '2026-08-03T00:10:00.000Z', lat: 36.3299, lng: 127.4299, size: 103 },
      { key: 'k-nogps', name: 'nogps.jpg', kind: 'photo', project: '둔산현장', when: '2026-08-05T00:00:00.000Z', size: 105 },
      { key: 'k-noref', name: 'noref.jpg', kind: 'photo', project: '유성현장', when: '2026-08-06T00:00:00.000Z', lat: 36.36, lng: 127.35, size: 106 },
      { key: 'k-un', name: 'unassigned.jpg', kind: 'photo', project: null, when: '2026-08-07T00:00:00.000Z', lat: 36.60, lng: 127.10, size: 107 },
      { key: 'k-dupA', name: 'dupA.jpg', kind: 'photo', project: '둔산현장', when: '2026-08-08T00:00:00.000Z', lat: 36.3501, lng: 127.3801, size: 5000, driveId: 'dA' },
      { key: 'k-dupB', name: 'dupB.jpg', kind: 'photo', project: '둔산현장', when: '2026-08-08T00:00:00.000Z', lat: 36.3501, lng: 127.3801, size: 5000, driveId: 'dB' },
    ],
  };
  const frozen = JSON.stringify(data);

  const r = mod.audit(data);
  assert.deepEqual(r.mismatches.map((m) => [m.name, m.from, m.to]), [['wrong1.jpg', '둔산현장', '은행현장']], '재배정 제안');
  assert.equal(r.mismatches[0].km > 1 && r.mismatches[0].toKm <= 0.5, true);
  assert.deepEqual(r.unsure.map((u) => u.name), ['bankfar.jpg'], '확인 필요');
  assert.deepEqual([r.photos, r.projects, r.checked, r.noGps, r.noRef, r.unassigned], [10, 3, 8, 1, 0, 1]);
  assert.equal(r.coords['은행현장'].src, 'photos'); assert.equal(r.coords['은행현장'].n, 2, '가장 큰 묶음(먼 사진 1장 제외)');
  assert.equal(r.coords['둔산현장'].src, 'project');
  assert.equal('보관현장' in r.coords, false, '보관 현장 제외');
  assert.deepEqual(r.dupSets, [{ keep: 'dupA.jpg', drop: [{ name: 'dupB.jpg', key: 'k-dupB', project: '둔산현장', driveId: 'dB' }] }]);
  assert.equal(r.dups, 1);
  assert.equal(JSON.stringify(data), frozen, 'audit 는 원본을 바꾸지 않는다');

  // 보고서만(기본): 수정본에 아무것도 반영하지 않는다
  const none = mod.applyFixes(data, r, {});
  assert.deepEqual([none.reassigned, none.dropped], [0, 0]);
  assert.equal(JSON.stringify(none.data), frozen);

  // --apply: 재배정만, 공정 초기화, 다른 필드·다른 파일·모르는 필드 보존, 원본 불변
  const applied = mod.applyFixes(data, r, { apply: true });
  assert.equal(applied.reassigned, 1);
  const w = applied.data.files.find((f) => f.key === 'k-wrong1');
  assert.equal(w.project, '은행현장'); assert.equal(w.phase, null); assert.equal(w.address, '대전 동구 은행동');
  assert.equal(applied.data.files.find((f) => f.key === 'k-ok1').custom, 'keep-me');
  assert.equal(applied.data.files.find((f) => f.key === 'k-est').est.amount, 100);
  assert.deepEqual(applied.data.unknownTopLevel, { keep: true });
  assert.equal(applied.data.files.length, 11);
  assert.equal(JSON.stringify(data), frozen, 'applyFixes 는 원본을 바꾸지 않는다');
  assert.deepEqual(mod.audit(applied.data).mismatches, [], '재배정 뒤 재점검에 제안이 남지 않는다');

  // --drop-dups: 대표는 남고 나머지만 빠진다, _savedFileCount 갱신
  const dropped = mod.applyFixes(data, r, { apply: true, dropDups: true });
  assert.equal(dropped.dropped, 1);
  assert.equal(dropped.data.files.some((f) => f.key === 'k-dupB'), false);
  assert.equal(dropped.data.files.some((f) => f.key === 'k-dupA'), true);
  assert.equal(dropped.data._savedFileCount, 10);

  // 보고서 내용
  const md = mod.report(r, { stamp: 'T', reassigned: 1 });
  assert.match(md, /wrong1\.jpg \| 2026-08-02 \| 둔산현장 \| [0-9.]+km \| \*\*은행현장\*\*/);
  assert.match(md, /bankfar\.jpg/); assert.match(md, /유지 `dupA\.jpg` ← 제거 대상 `dupB\.jpg`\(둔산현장\)/);
  assert.match(md, /은행현장: 사진 묶음 2장 중심/);

  // 빈·깨진 입력에도 죽지 않는다
  assert.deepEqual(mod.audit({}).mismatches, []);
  assert.equal(mod.audit({ files: 'x', projects: null }).photos, 0);

  // CLI: 백업·보고서·수정본을 만들고 원본은 그대로
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-audit-'));
  const input = path.join(dir, '현장데이터.json');
  fs.writeFileSync(input, frozen);
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'photo-audit-offline.mjs'), input, '--out', path.join(dir, 'out'), '--apply'], { encoding: 'utf8' });
  assert.match(out, /재배정 제안 \*\*1장\*\*/);
  const made = fs.readdirSync(path.join(dir, 'out'));
  assert.equal(made.some((n) => /^현장데이터_백업_클로드_\d{8}_\d{4}\.json$/.test(n)), true, made.join());
  assert.equal(made.some((n) => /^사진배정점검_\d{8}_\d{4}\.md$/.test(n)), true);
  assert.equal(made.some((n) => /^현장데이터_수정본_\d{8}_\d{4}\.json$/.test(n)), true);
  assert.equal(fs.readFileSync(input, 'utf8'), frozen, '원본 파일 불변');
  const fixedFile = JSON.parse(fs.readFileSync(path.join(dir, 'out', made.find((n) => n.startsWith('현장데이터_수정본_'))), 'utf8'));
  assert.equal(fixedFile.files.find((f) => f.key === 'k-wrong1').project, '은행현장');
  const reportOnly = execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'photo-audit-offline.mjs'), input, '--out', path.join(dir, 'out2')], { encoding: 'utf8' });
  assert.match(reportOnly, /수정본 반영: 재배정 0장/);
  assert.equal(fs.readdirSync(path.join(dir, 'out2')).some((n) => n.startsWith('현장데이터_수정본_')), false, '보고서만일 때는 수정본을 만들지 않는다');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS  오프라인 사진 배정 점검: 앱과 같은 규칙·원본 불변·수정본·보고서·CLI');
})().catch((e) => { console.error(e); process.exitCode = 1; });
