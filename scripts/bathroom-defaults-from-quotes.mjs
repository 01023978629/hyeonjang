#!/usr/bin/env node
/* Generates an anonymized draft, never a confirmed price list. Inputs must be local copies.
   JSON whitelist: quotes[].items.{name,spec,qty,price}, priceBook name->price.
   XLSX whitelist: item-table name/spec/qty/price/amount + a VAT-included boolean.
   No customer/project/date/filename is retained in defaults, reports, or log messages. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readXlsxTables } from './bathroom-xlsx-reader.mjs';

const SCOPES = ['기존 욕실 철거', '폐기물 운반·처리', '방수·바탕 보수', '급배수 배관 보수', '양변기', '세면대·하부장', '세면 수전', '샤워 수전', '거울·수납장', '천장 마감', '환풍기', '샤워 파티션', '실리콘·마감 청소', '욕조 철거', '욕조 설치', '비데', '젠다이·선반', '욕실 문·문틀 교체', '유가(바닥 배수구) 교체', '수건걸이·액세서리 세트'];
export const STANDARD_ITEMS = Object.freeze(['욕실 벽 타일(박스)', '욕실 벽 타일 시공(㎡)', '욕실 바닥 타일(박스)', '욕실 바닥 타일 시공(㎡)', '타일 접착제', '줄눈재', ...SCOPES.flatMap(name => [name, name + ' 시공'])]);
const normalize = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[\s()[\]（）·.,_-]/g, '').replace(/[×＊*]/g, 'x') : '';
const exactKeys = new Map(STANDARD_ITEMS.map(name => [normalize(name), name]));
const aliases = new Map([
  ['기존 욕실 철거', ['욕실 철거', '기존 욕실 철거']], ['폐기물 운반·처리', ['폐기물 운반처리']],
  ['방수·바탕 보수', ['방수 바탕 보수']], ['급배수 배관 보수', ['급배수 배관 보수']],
  ['양변기', ['양변기', '변기']], ['세면대·하부장', ['세면대 하부장', '세면기 하부장']],
  ['세면 수전', ['세면 수전', '세면대 수전', '세면기 수전']], ['샤워 수전', ['샤워 수전', '샤워기 수전']],
  ['거울·수납장', ['거울 수납장']], ['천장 마감', ['욕실 천장 마감', '천장 마감']], ['환풍기', ['환풍기']],
  ['샤워 파티션', ['샤워 파티션', '샤워 칸막이']], ['실리콘·마감 청소', ['실리콘 마감 청소']],
  ...SCOPES.slice(13).map(name => [name, [name]])
].flatMap(([key, names]) => names.map(name => [normalize(name), key])));
const eachScopes = new Set(['양변기', '세면대·하부장', '세면 수전', '샤워 수전', '거울·수납장', '환풍기', '샤워 파티션', '욕조 설치', '비데', '욕실 문·문틀 교체', '유가(바닥 배수구) 교체']);
const REASONS = Object.freeze({ unknown: '표준 품목 불명', role: '자재·시공 구분 불명', combined: '자재·시공 합산', unit: '단위 불명 또는 불일치', pack: '기본 규격·포장 불일치 또는 미확인', pending: '단가 확인 필요', value: '유효 단가·수량 없음', vat: '부가세 표기 상충' });
const safeVocabulary = ['욕실', '타일', '철거', '폐기물', '방수', '배관', '변기', '세면', '수전', '거울', '천장', '환풍기', '파티션', '실리콘', '청소', '욕조', '비데', '선반', '문틀', '배수구', '액세서리', '미장', '인건비', '노무', '재료', '자재', '부자재', '도배', '도장', '장판', '마루', '목공', '설치'];
function safeCategory(row) {
  const n = normalize(row.name) + ' ' + normalize(row.spec);
  return safeVocabulary.filter(word => n.includes(word)).slice(0, 3).join('·') || '공사항목 미분류';
}
function pickItem(row, includeAmount = false) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const result = {};
  for (const key of includeAmount ? ['name', 'spec', 'qty', 'price', 'amount'] : ['name', 'spec', 'qty', 'price']) if (Object.hasOwn(row, key)) result[key] = row[key];
  return result;
}
function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*$/.test(value)) return null;
  const n = Number(value.replace(/,/g, '')); return Number.isFinite(n) ? n : null;
}
function qtyValue(value) {
  if (typeof value === 'string') value = value.replace(/\s*(?:개|식|박스|포|m²|m2|㎡|제곱미터)\s*$/i, '');
  return numeric(value);
}
export function mapStandardItem(input, { priceBook = false } = {}) {
  const row = pickItem(input), n = normalize(row.name), s = normalize(row.spec), q = typeof row.qty === 'string' ? normalize(row.qty) : '';
  if (!n || n.length > 300 || s.length > 1000) return { reason: 'unknown' };
  if (/단가확인필요|미정|금액미정|추후협의/.test(n + s)) return { reason: 'pending' };
  if (priceBook && exactKeys.has(n)) return { key: exactKeys.get(n) };
  if (/자재\+시공|자재시공포함|자재및시공|재료시공포함|설치포함|시공포함/.test(n + s)) return { reason: 'combined' };
  const units = n + s + q;
  const tile = /(?:욕실)?(?:벽|벽체|바닥)타일/.test(n);
  if (tile) {
    if (/(벽|벽체)/.test(n) && /바닥/.test(n)) return { reason: 'unknown' };
    const wall = /벽/.test(n), label = wall ? '벽' : '바닥', labor = /시공|인건|노무/.test(n + s);
    if (labor) {
      if (!/m2|헤베|제곱미터/.test(units) || /(?:1식|식당|박스당)/.test(s + q)) return { reason: 'unit' };
      return { key: '욕실 ' + label + ' 타일 시공(㎡)' };
    }
    if (!/박스|box/.test(units) || /m2당|헤베당|장당/.test(s)) return { reason: 'unit' };
    const specification = String(row.spec || '').normalize('NFKC').toLowerCase().replace(/[×＊*]/g, 'x');
    const dimension = /(\d{2,4})\s*x\s*(\d{2,4})/.exec(specification), pack = /(\d{1,3})\s*장\s*(?:\/\s*박스|입|박스)/.exec(specification);
    const wanted = wall ? [300, 600, 8] : [300, 300, 16];
    if (!dimension || !pack || ![[wanted[0], wanted[1]], [wanted[1], wanted[0]]].some(([a, b]) => +dimension[1] === a && +dimension[2] === b) || +pack[1] !== wanted[2]) return { reason: 'pack' };
    return { key: '욕실 ' + label + ' 타일(박스)' };
  }
  if (/^(?:타일)?접착제(?:자재|자재비)?$/.test(n) || /^줄눈재(?:자재|자재비)?$/.test(n)) {
    const adhesive = n.includes('접착제'), kg = /(\d+(?:\.\d+)?)kg/.exec(String(row.spec || '').normalize('NFKC').toLowerCase());
    if (/시공|인건|노무|m2당/.test(s) || !/포|포장|봉/.test(s + q)) return { reason: 'unit' };
    if (!kg || Number(kg[1]) !== (adhesive ? 20 : 2)) return { reason: 'pack' };
    return { key: adhesive ? '타일 접착제' : '줄눈재' };
  }
  let baseName = n, role = '';
  for (const [ending, value] of [['시공비', 'labor'], ['설치비', 'labor'], ['인건비', 'labor'], ['시공', 'labor'], ['설치', 'labor'], ['자재비', 'material'], ['재료비', 'material'], ['자재', 'material']]) {
    if (n.endsWith(ending) && aliases.has(n.slice(0, -ending.length))) { baseName = n.slice(0, -ending.length); role = value; break; }
  }
  if (n === '수전' && /세면/.test(s) !== /샤워/.test(s)) baseName = /세면/.test(s) ? '세면수전' : '샤워수전';
  if ((n === '세면기' || n === '세면대') && /하부장/.test(s)) baseName = '세면대하부장';
  const base = aliases.get(baseName); if (!base) return { reason: 'unknown' };
  const material = /자재|재료|제품/.test(s), labor = /시공|설치|인건|노무/.test(s);
  if ((material && labor) || (role === 'labor' && material) || (role === 'material' && labor)) return { reason: 'combined' };
  if (!role) role = labor ? 'labor' : material || /[a-z]{1,8}[- ]?\d{2,}/i.test(String(row.spec || '')) ? 'material' : '';
  if (!role) return { reason: 'role' };
  if (eachScopes.has(base)) {
    if (/m2|헤베|제곱미터|식당/.test(units) || !Number.isInteger(qtyValue(row.qty))) return { reason: 'unit' };
  } else if (!/(?:1?식|식당)/.test(s + q)) return { reason: 'unit' };
  return { key: base + (role === 'labor' ? ' 시공' : '') };
}
export function extractDefaults(data, workbooks = [], { generatedAt = new Date().toISOString() } = {}) {
  if (typeof generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) throw Error('GENERATED_AT_INVALID');
  const buckets = new Map(), rejected = new Map(), counters = { appQuotes: 0, xlsxWorkbooks: 0, priceBookFallbacks: 0, acceptedRows: 0, unmatchedRows: 0 };
  const middleValue = values => { const sorted = values.slice().sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
  const finishDocument = samples => { for (const [key, values] of samples) { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(middleValue(values)); } };
  const reject = (row, reason) => {
    counters.unmatchedRows++;
    const category = safeCategory(row), id = category + '|' + reason;
    if (!rejected.has(id)) rejected.set(id, { category, reason: REASONS[reason] || REASONS.unknown, n: 0 });
    rejected.get(id).n++;
  };
  const collect = (raw, origin, inclusive = false, priceBook = false, samples = buckets) => {
    const row = pickItem(raw, origin === 'xlsx'), match = mapStandardItem(row, { priceBook });
    if (!match.key) { reject(row, match.reason); return; }
    const qty = qtyValue(row.qty), price = numeric(row.price), amount = numeric(row.amount);
    const value = price !== null ? price : origin === 'xlsx' && amount !== null && qty > 0 ? amount / qty : null;
    if (!(qty > 0) || qty > 1000000 || value === null || value < 0 || value > 100000000) { reject(row, 'value'); return; }
    const divisor = origin === 'xlsx' && inclusive ? 1.1 : 1;
    const supply = value / divisor;
    if (!samples.has(match.key)) samples.set(match.key, []);
    samples.get(match.key).push(supply); counters.acceptedRows++;
  };
  // Do not inspect quote/customer/project metadata. App item prices already exclude VAT.
  const quotes = data && typeof data === 'object' && Array.isArray(data.quotes) ? data.quotes : [];
  for (const quote of quotes) {
    if (!quote || !Array.isArray(quote.items)) continue;
    counters.appQuotes++;
    const samples = new Map();
    for (const item of quote.items) collect(item, 'app', false, false, samples);
    finishDocument(samples);
  }
  for (const workbook of workbooks) {
    if (!Array.isArray(workbook)) continue;
    if (workbook.length) counters.xlsxWorkbooks++;
    const samples = new Map();
    for (const table of workbook) {
      if (!table || !Array.isArray(table.rows)) continue;
      for (const raw of table.rows) {
        if (table.vat === 'ambiguous') reject(pickItem(raw), 'vat');
        else collect(raw, 'xlsx', table.vat === 'inclusive', false, samples);
      }
    }
    finishDocument(samples);
  }
  const book = data && typeof data === 'object' ? data.priceBook : null;
  if (book && typeof book === 'object' && !Array.isArray(book)) for (const name of Object.keys(book)) {
    const match = mapStandardItem({ name }, { priceBook: true });
    // priceBook mirrors the latest quote; never count that same source again as evidence.
    if (match.key && !buckets.has(match.key)) {
      const before = counters.acceptedRows;
      collect({ name, qty: 1, price: book[name] }, 'app', false, true);
      if (counters.acceptedRows > before) counters.priceBookFallbacks++;
    } else if (!match.key) reject({ name }, match.reason || 'unknown');
  }
  const items = {};
  for (const key of STANDARD_ITEMS) {
    const values = buckets.get(key); if (!values?.length) continue;
    values.sort((a, b) => a - b);
    const n = values.length, middle = Math.floor(n / 2), median = n % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    items[key] = { price: Math.round(median / 1000) * 1000, n, min: Math.round(values[0]), max: Math.round(values[n - 1]) };
    if (n < 3) items[key].weak = true;
  }
  const sourceCount = counters.appQuotes + counters.xlsxWorkbooks;
  const source = sourceCount ? '과거 견적 ' + sourceCount + '건(기간 미확인)' : Object.keys(items).length ? '과거 견적 단가표(기간 미확인)' : '자료 없음';
  return { defaults: { generatedAt, source, vat: 'exclusive', items }, report: { counts: counters, unmatched: [...rejected.values()].sort((a, b) => b.n - a.n || a.category.localeCompare(b.category, 'ko')).slice(0, 20), notes: ['원문 품명·고객·현장·파일명은 기록하지 않음', '날짜 필드는 읽지 않아 기간은 미확인', '기본 타일 규격·포장과 다른 단가는 제외', 'n은 문서 수: 한 견적·엑셀 파일 안 같은 품목은 중앙값 한 건으로 집계', 'min/max도 문서별 대표 공급단가 기준', 'priceBook은 해당 품목 견적 표본이 없을 때만 사용', 'JSON 견적과 엑셀의 동일 견적 여부는 추정하지 않음'] } };
}

export async function runCli(argv) {
  const positional = [], options = {};
  for (let i = 0; i < argv.length; i++) {
    if (['--out', '--report'].includes(argv[i])) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('ARGUMENTS'); options[argv[i].slice(2)] = argv[++i]; }
    else if (argv[i].startsWith('--')) throw Error('ARGUMENTS'); else positional.push(argv[i]);
  }
  if (!positional.length || positional.length > 2) throw Error('ARGUMENTS');
  const output = path.resolve(options.out || 'bathroom-defaults.json'), reportPath = options.report ? path.resolve(options.report) : null;
  if (output === path.resolve(positional[0]) || reportPath === path.resolve(positional[0]) || output === reportPath) throw Error('OUTPUT_OVERLAPS_INPUT');
  let data = {}, missingJson = 0, badWorkbooks = 0, missingFolder = 0, duplicateWorkbookCount = 0;
  try { const stat = await fs.stat(positional[0]); if (!stat.isFile() || stat.size > 128 * 1024 * 1024) throw Error('INPUT_SIZE'); data = JSON.parse(await fs.readFile(positional[0], 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') missingJson++; else throw Error('JSON_INPUT_INVALID'); }
  const workbooks = [], workbookHashes = new Set();
  if (positional[1]) {
    let files = [];
    try { files = await fs.readdir(positional[1], { withFileTypes: true }); } catch { missingFolder++; }
    for (const file of files.filter(f => f.isFile() && /\.xlsx$/i.test(f.name) && !f.name.startsWith('~$'))) {
      try {
        const target = path.join(positional[1], file.name), stat = await fs.stat(target);
        if (stat.size > 32 * 1024 * 1024) throw Error('INPUT_SIZE');
        const bytes = await fs.readFile(target), hash = createHash('sha256').update(bytes).digest('hex');
        if (workbookHashes.has(hash)) { duplicateWorkbookCount++; continue; }
        workbookHashes.add(hash); workbooks.push(readXlsxTables(bytes));
      } catch { badWorkbooks++; }
    }
  }
  const result = extractDefaults(data, workbooks);
  result.report.inputStatus = { missingJson, missingFolder, unreadableWorkbooks: badWorkbooks, duplicateWorkbookCount };
  await fs.writeFile(output, JSON.stringify(result.defaults, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  if (reportPath) await fs.writeFile(reportPath, JSON.stringify(result.report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return { items: Object.keys(result.defaults.items).length, unmatched: result.report.counts.unmatchedRows, unreadableWorkbooks: badWorkbooks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli(process.argv.slice(2)).then(result => console.log('단가표 초안 생성: 품목 ' + result.items + '개, 미매칭 ' + result.unmatched + '건, 읽지 못한 엑셀 ' + result.unreadableWorkbooks + '건.'))
    .catch(() => { console.error('단가표 생성 실패: 입력 형식·읽기 권한·출력 파일 존재 여부를 확인하세요. 원문·경로는 기록하지 않습니다.'); process.exitCode = 1; });
}
