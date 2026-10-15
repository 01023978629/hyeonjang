'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/bathroom-defaults-from-quotes.mjs');
const reader = path.join(root, 'scripts/bathroom-xlsx-reader.mjs');
const stamp = '2026-10-16T00:00:00.000Z';
const row = (price, extra = {}) => ({ name: '변기 자재', spec: '제품 TEST-MODEL100 · 개당', qty: 1, price, ...extra });
const app = prices => ({ quotes: prices.map(price => ({ items: [row(price)] })), priceBook: {} });
const run = (api, data, books = []) => api.extractDefaults(data, books, { generatedAt: stamp });
function crc(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function zip(files, compressed = true) {
  const local = [], central = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), bytes = Buffer.from(text), packed = compressed ? zlib.deflateRawSync(bytes) : bytes;
    const a = Buffer.alloc(30), b = Buffer.alloc(46), sum = crc(bytes);
    a.writeUInt32LE(0x04034b50); a.writeUInt16LE(20, 4); a.writeUInt16LE(compressed ? 8 : 0, 8); a.writeUInt32LE(sum, 14); a.writeUInt32LE(packed.length, 18); a.writeUInt32LE(bytes.length, 22); a.writeUInt16LE(nameBytes.length, 26);
    b.writeUInt32LE(0x02014b50); b.writeUInt16LE(20, 4); b.writeUInt16LE(20, 6); b.writeUInt16LE(compressed ? 8 : 0, 10); b.writeUInt32LE(sum, 16); b.writeUInt32LE(packed.length, 20); b.writeUInt32LE(bytes.length, 24); b.writeUInt16LE(nameBytes.length, 28); b.writeUInt32LE(offset, 42);
    local.push(a, nameBytes, packed); central.push(b, nameBytes); offset += a.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function workbook(records, { vat = '부가세 포함', shared = false, pii = 'SYNTHETIC-CUSTOMER-PRIVATE', before = [], after = [] } = {}) {
  const strings = [], xmlRows = [];
  function cell(column, number, value) {
    if (typeof value === 'number') return '<c r="' + column + number + '"><v>' + value + '</v></c>';
    if (shared) { const i = strings.push(String(value)) - 1; return '<c r="' + column + number + '" t="s"><v>' + i + '</v></c>'; }
    return '<c r="' + column + number + '" t="inlineStr"><is><t>' + escape(value) + '</t></is></c>';
  }
  const rows = [[pii, vat], ...before, ['품명', '규격', '수량', '단가', '금액', '고객명'], ...records.map(x => [x.name, x.spec || '', x.qty ?? '', x.price ?? '', x.amount ?? '', pii]), ...after];
  rows.forEach((values, i) => xmlRows.push('<row r="' + (i + 1) + '">' + values.map((v, k) => cell(String.fromCharCode(65 + k), i + 1, v)).join('') + '</row>'));
  const files = { 'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' + xmlRows.join('') + '</sheetData></worksheet>' };
  if (shared) files['xl/sharedStrings.xml'] = '<sst>' + strings.map(s => '<si><t>' + escape(s) + '</t></si>').join('') + '</sst>';
  return zip(files);
}
const cases = {
  median(api) {
    const r = run(api, app([21000, 35000, 90000]));
    assert.deepEqual(r.defaults.items['양변기'], { price: 35000, n: 3, min: 21000, max: 90000 });
    assert.equal(run(api, app([20500, 32500])).defaults.items['양변기'].price, 27000);
  },
  weak(api) {
    assert.equal(run(api, app([21000, 35000])).defaults.items['양변기'].weak, true);
    assert.equal(Object.hasOwn(run(api, app([21000, 35000, 90000])).defaults.items['양변기'], 'weak'), false);
  },
  vat(api) {
    const data = app([110000]); data.quotes[0].vatIncluded = true;
    assert.equal(run(api, data).defaults.items['양변기'].price, 110000, 'app prices are already supply prices');
    assert.equal(run(api, {}, [[{ rows: [row(110000)], vat: 'inclusive' }]]).defaults.items['양변기'].price, 100000);
    assert.equal(run(api, {}, [[{ rows: [row(110000)], vat: 'exclusive' }]]).defaults.items['양변기'].price, 110000);
    const amount = row(undefined, { qty: 2, amount: 220000 });
    assert.equal(run(api, {}, [[{ rows: [amount], vat: 'inclusive' }]]).defaults.items['양변기'].price, 100000);
    assert.deepEqual(run(api, {}, [[{ rows: [row(110000)], vat: 'ambiguous' }]]).defaults.items, {});
  },
  privacy(api) {
    const secrets = ['SYNTHETIC-CUSTOMER-PRIVATE', 'SYNTHETIC-ADDRESS-PRIVATE', 'SYNTHETIC-PROJECT-PRIVATE', '010-0000-0000', '999동 999호'];
    const data = { quotes: [{ customer: secrets[0], project: secrets[2], address: secrets[1], phone: secrets[3], items: [row(230000), row(20000, { name: secrets.join(' ') + ' 욕실 타일' })] }], priceBook: { [secrets.join(' ')]: 30000 } };
    const result = run(api, data), text = JSON.stringify(result);
    for (const secret of secrets) assert(!text.includes(secret), 'no raw personal data in defaults/report');
    assert(!/01[016789][ -]?\d{3,4}[ -]?\d{4}|\d{2,4}동\s*\d{2,4}호/.test(text));
    assert(result.report.unmatched.some(item => item.category.startsWith('욕실·타일')));
    for (const k of Object.keys(result.defaults.items)) assert(api.STANDARD_ITEMS.includes(k));
  },
  whitelist(api) {
    const never = () => { throw Error('NON_WHITELIST_FIELD_ACCESSED'); };
    const item = row(22000); Object.defineProperty(item, 'amount', { enumerable: true, get: never }); Object.defineProperty(item, 'customer', { enumerable: true, get: never });
    const quote = { items: [item] }; for (const field of ['customer', 'project', 'date', 'vatIncluded']) Object.defineProperty(quote, field, { enumerable: true, get: never });
    const data = { quotes: [quote], priceBook: {} }; for (const field of ['customers', 'projects', 'files', 'phone', 'savedAt']) Object.defineProperty(data, field, { enumerable: true, get: never });
    assert.equal(run(api, data).defaults.items['양변기'].price, 22000);
  },
  bookFallback(api) {
    const data = app([21000, 35000]); data.priceBook = { '양변기': 90000, '양변기 시공': 44000 };
    const r = run(api, data);
    assert.equal(r.defaults.items['양변기'].n, 2);
    assert.equal(r.defaults.items['양변기'].price, 28000);
    assert.deepEqual(r.defaults.items['양변기 시공'], { price: 44000, n: 1, min: 44000, max: 44000, weak: true });
    assert.equal(r.report.counts.priceBookFallbacks, 1);
  },
  documentCount(api) {
    const r = run(api, { quotes: [{ items: [row(10000), row(30000), row(30000)] }, { items: [row(50000)] }], priceBook: {} });
    assert.deepEqual(r.defaults.items['양변기'], { price: 40000, n: 2, min: 30000, max: 50000, weak: true });
    assert.equal(r.report.counts.acceptedRows, 4);
    const r2 = run(api, {}, [[{ rows: [row(10000)], vat: 'exclusive' }, { rows: [row(30000)], vat: 'exclusive' }]]);
    assert.equal(r2.defaults.items['양변기'].n, 1); assert.equal(r2.defaults.items['양변기'].price, 20000);
  },
  mapping(api) {
    const maps = [
      [{ name: '욕실 벽 타일(박스)', spec: '300×600 · 8장/박스', qty: 5 }, '욕실 벽 타일(박스)'],
      [{ name: '욕실 바닥 타일 자재', spec: '300*300 · 16장/박스', qty: 5 }, '욕실 바닥 타일(박스)'],
      [{ name: '벽 타일 시공', spec: '순면적 16.26㎡', qty: 16.26 }, '욕실 벽 타일 시공(㎡)'],
      [{ name: '타일 접착제', spec: '20kg/포', qty: 3 }, '타일 접착제'],
      [{ name: '줄눈재', spec: '2kg/포', qty: 3 }, '줄눈재'],
      [{ name: '변기 설치', spec: '개당', qty: 1 }, '양변기 시공'],
      [{ name: '수전', spec: '세면 제품 TEST100', qty: 1 }, '세면 수전'],
      [{ name: '수전', spec: '샤워 자재', qty: 1 }, '샤워 수전'],
      [{ name: '세면기', spec: '하부장 포함 자재', qty: 1 }, '세면대·하부장'],
      [{ name: '욕실 철거 시공', spec: '1식', qty: 1 }, '기존 욕실 철거 시공'],
      [{ name: '욕조 설치', spec: '자재 TEST100', qty: 1 }, '욕조 설치']
    ];
    for (const [input, key] of maps) assert.equal(api.mapStandardItem(input).key, key, JSON.stringify(input));
    const skips = [
      { name: '수전', spec: '자재', qty: 1 }, { name: '세면기', spec: '제품', qty: 1 },
      { name: '양변기', spec: '', qty: 1 }, { name: '양변기', spec: '자재+시공', qty: 1 },
      { name: '양변기 자재', spec: '설치 포함', qty: 1 },
      { name: '욕실 벽 타일(박스)', spec: '600×600 4장/박스', qty: 3 },
      { name: '욕실 벽 타일(박스)', spec: '', qty: 3 },
      { name: '벽 타일 시공', spec: '1식', qty: 1 }, { name: '타일 접착제', spec: '25kg/포', qty: 2 }
    ];
    for (const input of skips) assert.equal(api.mapStandardItem(input).key, undefined, 'ambiguous rows must stay unmatched');
  },
  pending(api) {
    const r = run(api, { quotes: [{ items: [row(0, { spec: '자재 · 단가 확인 필요' })] }] });
    assert.deepEqual(r.defaults.items, {});
    assert.equal(run(api, app([0])).defaults.items['양변기'].price, 0, 'explicit free price is not missing');
  },
  numericSafety(api) {
    for (const value of [null, undefined, '', false, [], {}, NaN, Infinity, -1, 100000001, '010-0000-0000', '10만원', '2026-10-16']) assert.deepEqual(run(api, app([value])).defaults.items, {});
    assert.equal(run(api, app(['123,500'])).defaults.items['양변기'].price, 124000);
    assert.deepEqual(run(api, { quotes: [{ items: [row(50000, { qty: 0 })] }] }).defaults.items, {});
    assert.equal(run(api, {}).defaults.source, '자료 없음');
    assert.throws(() => api.extractDefaults({}, [], { generatedAt: 'SYNTHETIC-PRIVATE' }), /GENERATED_AT_INVALID/);
  }
};
(async () => {
  const started = Date.now(), api = await import(pathToFileURL(script)), { readXlsxTables } = await import(pathToFileURL(reader));
  let passed = 0;
  for (const [name, fn] of Object.entries(cases)) { fn(api); passed++; console.log('PASS bathprices ' + name); }
  for (const shared of [false, true]) {
    const tables = readXlsxTables(workbook([row(110000)], { shared }));
    assert.equal(tables[0].vat, 'inclusive'); assert.equal(run(api, {}, [tables]).defaults.items['양변기'].price, 100000);
    assert.deepEqual(Object.keys(tables[0].rows[0]), ['name', 'spec', 'qty', 'price', 'amount']);
    assert(!JSON.stringify(tables).includes('SYNTHETIC-CUSTOMER-PRIVATE'));
  }
  passed++; console.log('PASS bathprices XLSX inline/shared strings and column whitelist');
  for (const label of ['※ 부가세 포함', '비고: 부가세 포함', '총액은 부가세 10% 포함입니다.', 'VAT 포함 가격']) {
    const tables = readXlsxTables(workbook([row(110000)], { vat: label }));
    assert.equal(tables[0].vat, 'inclusive'); assert.equal(run(api, {}, [tables]).defaults.items['양변기'].price, 100000);
  }
  for (const label of ['※ 부가세 별도', '부가세 미포함', 'VAT 불포함']) assert.equal(readXlsxTables(workbook([row(110000)], { vat: label }))[0].vat, 'exclusive');
  for (const label of ['부가세 포함/별도 확인 필요', '부가세 포함 여부 미정', '부가세 포함, 부가세 별도']) {
    const tables = readXlsxTables(workbook([row(110000)], { vat: label }));
    assert.equal(tables[0].vat, 'ambiguous'); assert.deepEqual(run(api, {}, [tables]).defaults.items, {});
  }
  passed++; console.log('PASS bathprices XLSX VAT notes and ambiguity');
  const headers = readXlsxTables(workbook([row(110000), row(22000, { name: '내역', spec: '내역' })], {
    before: [['품명', '내역'], ['품명', '규격', '수량', '단가', '단가'], ['변기 자재', '제품', 1, 990000, 990000]],
    after: [['품명', '규격', '수량', '단가', '단가'], ['변기 자재', '제품', 1, 990000, 990000]]
  }));
  assert.equal(headers[0].rows.length, 2, 'ambiguous tables excluded; valid table and repeated body words preserved');
  assert.equal(run(api, {}, [headers]).defaults.items['양변기'].price, 100000);
  passed++; console.log('PASS bathprices duplicate header words only exclude genuinely ambiguous tables');
  for (const bytes of [Buffer.from('not zip'), zip({ '../escape.xml': 'bad' }), zip({ 'xl/worksheets/sheet1.xml': '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///private">]><worksheet/>' })]) assert.throws(() => readXlsxTables(bytes), /XLSX_UNSUPPORTED_OR_INVALID/);
  const damaged = workbook([row(10000)]); damaged[50] ^= 0x80; assert.throws(() => readXlsxTables(damaged));
  passed++; console.log('PASS bathprices XLSX unsafe XML/path/corruption rejected');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hj-bathprices-v418-'));
  try {
    const input = path.join(temp, 'SYNTHETIC-PRIVATE.json'), xlsx = path.join(temp, 'xlsx'); fs.mkdirSync(xlsx);
    fs.writeFileSync(input, JSON.stringify({ quotes: [], priceBook: {}, customer: 'SYNTHETIC-PRIVATE' }));
    const bytes = workbook([row(110000)]); fs.writeFileSync(path.join(xlsx, 'SYNTHETIC-PRIVATE.xlsx'), bytes); fs.writeFileSync(path.join(xlsx, 'SYNTHETIC-PRIVATE-COPY.xlsx'), bytes);
    const out = path.join(temp, 'out.json'), report = path.join(temp, 'report.json');
    const log = execFileSync(process.execPath, [script, input, xlsx, '--out', out, '--report', report], { encoding: 'utf8' });
    const a = JSON.parse(fs.readFileSync(out)), b = JSON.parse(fs.readFileSync(report));
    assert.equal(a.items['양변기'].price, 100000); assert.equal(a.items['양변기'].n, 1); assert.equal(b.inputStatus.duplicateWorkbookCount, 1);
    assert(!log.includes('SYNTHETIC')); assert(!JSON.stringify(a).includes('SYNTHETIC')); assert(!JSON.stringify(b).includes('SYNTHETIC'));
    const before = fs.readFileSync(out, 'utf8'), failure = spawnSync(process.execPath, [script, input, '--out', out], { encoding: 'utf8' });
    assert.equal(failure.status, 1); assert.equal(fs.readFileSync(out, 'utf8'), before); assert(!failure.stderr.includes(temp)); assert(!failure.stderr.includes('SYNTHETIC'));
    const same = spawnSync(process.execPath, [script, input, '--out', input], { encoding: 'utf8' }); assert.equal(same.status, 1); assert(JSON.parse(fs.readFileSync(input)).customer === 'SYNTHETIC-PRIVATE');
    passed++; console.log('PASS bathprices CLI exact-copy dedup, no overwrite and private error redaction');
  } finally {
    const safe = path.resolve(temp); assert.equal(path.dirname(safe), path.resolve(os.tmpdir())); assert(path.basename(safe).startsWith('hj-bathprices-v418-')); fs.rmSync(safe, { recursive: true, force: true });
  }
  const source = fs.readFileSync(script, 'utf8').replace("'./bathroom-xlsx-reader.mjs'", JSON.stringify(pathToFileURL(reader).href));
  const mutants = [
    ['median', 'Math.round(median / 1000) * 1000', 'Math.round((values.reduce((a,b)=>a+b,0)/n) / 1000) * 1000'],
    ['weak', 'if (n < 3)', 'if (n < 2)'],
    ['vat', "origin === 'xlsx' && inclusive ? 1.1 : 1", '1'],
    ['bookFallback', 'match.key && !buckets.has(match.key)', 'match.key'],
    ['documentCount', 'buckets.get(key).push(middleValue(values));', 'buckets.get(key).push(...values);'],
    ['privacy', 'const category = safeCategory(row),', 'const category = String(row.name),'],
    ['pending', "return { reason: 'pending' };", "return { key: '양변기' };"],
    ['mapping', 'if (!role) return { reason: \'role\' };', "if (!role) role = 'material';"]
  ];
  let detected = 0;
  for (const [probe, before, after] of mutants) {
    assert(source.includes(before), 'mutation anchor exists');
    const modified = source.replace(before, after), module = await import('data:text/javascript;base64,' + Buffer.from(modified).toString('base64'));
    assert.throws(() => cases[probe](module), undefined, 'mutation must break behavioral assertion: ' + probe); detected++;
    console.log('PASS bathprices mutation detected: ' + probe);
  }
  const readerSource = fs.readFileSync(reader, 'utf8');
  const vatNeedle = 'if (/(?:부가세|부가가치세|vat)(?:10%|는|가|금액은)?포함/.test(v)) includes = true;';
  assert(readerSource.includes(vatNeedle));
  const vatReader = await import('data:text/javascript;base64,' + Buffer.from(readerSource.replace(vatNeedle, 'if (v === "부가세포함") includes = true;')).toString('base64'));
  assert.throws(() => assert.equal(vatReader.readXlsxTables(workbook([row(110000)], { vat: '※ 부가세 포함' }))[0].vat, 'inclusive'));
  detected++; console.log('PASS bathprices mutation detected: XLSX VAT-note recognition');
  const xmlNeedle = 'if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail();'; assert(readerSource.includes(xmlNeedle));
  const xmlReader = await import('data:text/javascript;base64,' + Buffer.from(readerSource.replace(xmlNeedle, '')).toString('base64'));
  assert.throws(() => assert.throws(() => xmlReader.readXlsxTables(zip({ 'xl/worksheets/sheet1.xml': '<!DOCTYPE x><worksheet/>' })), /XLSX_UNSUPPORTED_OR_INVALID/));
  detected++; console.log('PASS bathprices mutation detected: XML entity guard');
  const headerNeedle = 'header = duplicateHeader ? null : columns;'; assert(readerSource.includes(headerNeedle));
  const headerReader = await import('data:text/javascript;base64,' + Buffer.from(readerSource.replace(headerNeedle, 'header = columns;')).toString('base64'));
  assert.throws(() => assert.equal(headerReader.readXlsxTables(workbook([row(110000)], { after: [['품명', '규격', '수량', '단가', '단가'], ['변기 자재', '제품', 1, 990000, 990000]] }))[0].rows.length, 1));
  detected++; console.log('PASS bathprices mutation detected: ambiguous header guard');
  console.log('bathprices-v418: ' + passed + '/' + passed + ' checks, ' + detected + '/' + (mutants.length + 3) + ' mutations detected, ' + ((Date.now() - started) / 1000).toFixed(2) + 's; start=' + new Date(started).toISOString() + '; end=' + new Date().toISOString());
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
