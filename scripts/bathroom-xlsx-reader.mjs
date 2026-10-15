// Local-only XLSX item-table reader. No formulas, links, XML entities or macros execute.
import { inflateRawSync } from 'node:zlib';

const MAX_ZIP = 32 * 1024 * 1024;
const MAX_XML = 16 * 1024 * 1024;
const MAX_TOTAL_XML = 64 * 1024 * 1024;
const fail = () => { throw new Error('XLSX_UNSUPPORTED_OR_INVALID'); };
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipEntries(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ZIP) fail();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) fail();
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16);
  if (!count || count > 4096 || count !== bytes.readUInt16LE(end + 8) || offset + size > end) fail();
  const entries = new Map(); let cursor = offset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > offset + size || bytes.readUInt32LE(cursor) !== 0x02014b50) fail();
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16), packed = bytes.readUInt32LE(cursor + 20), unpacked = bytes.readUInt32LE(cursor + 24);
    const length = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42), next = cursor + 46 + length + extra + comment;
    if (next > offset + size || local + 30 > offset || flags & 1 || packed === 0xffffffff || unpacked === 0xffffffff || bytes.readUInt16LE(cursor + 34)) fail();
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + length);
    if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..') || entries.has(name)) fail();
    entries.set(name, { flags, method, crc, packed, unpacked, local }); cursor = next;
  }
  if (cursor !== offset + size) fail();
  let total = 0;
  return {
    names: [...entries.keys()],
    read(name) {
      const e = entries.get(name); if (!e) return '';
      if (e.unpacked > MAX_XML || (total += e.unpacked) > MAX_TOTAL_XML || ![0, 8].includes(e.method)) fail();
      if (bytes.readUInt32LE(e.local) !== 0x04034b50 || bytes.readUInt16LE(e.local + 6) !== e.flags || bytes.readUInt16LE(e.local + 8) !== e.method) fail();
      const nl = bytes.readUInt16LE(e.local + 26), el = bytes.readUInt16LE(e.local + 28), start = e.local + 30 + nl + el;
      if (start + e.packed > offset || bytes.toString('utf8', e.local + 30, e.local + 30 + nl) !== name) fail();
      const packed = bytes.subarray(start, start + e.packed);
      const data = e.method === 8 ? inflateRawSync(packed, { maxOutputLength: MAX_XML }) : packed;
      if (data.length !== e.unpacked || crc32(data) !== e.crc) fail();
      const xml = data.toString('utf8');
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail();
      return xml;
    }
  };
}
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, value) => {
  if (value[0] !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[value.toLowerCase()];
  const n = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1));
  return n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
});
function attr(text, name) {
  const match = new RegExp('(?:^|\\s)' + name + '=(?:"([^"]*)"|\'([^\']*)\')').exec(text);
  return match ? decode(match[1] ?? match[2]) : '';
}
function textNodes(xml) { return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join(''); }
const compact = s => String(s).normalize('NFKC').replace(/\s|[()（）·]/g, '').toLowerCase();
const HEADERS = Object.freeze({
  name: ['품명', '품목', '품목명', '공사항목', '품명및규격', '품명규격', '항목명', '공사내용', '내역'],
  spec: ['규격', '사양', '모델', '규격및사양'], qty: ['수량'], price: ['단가', '단가원', '판매단가', '판매단가원'], amount: ['금액', '금액원', '공급가액', '합계금액']
});
function cellValue(body, attrs, strings) {
  const type = attr(attrs, 't');
  if (type === 'inlineStr') return textNodes(body);
  const value = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
  if (type === 's') { const n = Number(value); return Number.isInteger(n) && n >= 0 ? strings[n] ?? '' : ''; }
  if (type === 'b' || type === 'e') return '';
  return decode(value);
}

export function readXlsxTables(bytes) {
  const zip = zipEntries(bytes);
  const sharedXml = zip.read('xl/sharedStrings.xml');
  const strings = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => textNodes(m[1]));
  if (strings.length > 200000) fail();
  const tables = [];
  for (const name of zip.names.filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n))) {
    const xml = zip.read(name); let header = null, sawHeader = false, rows = [], includes = false, excludes = false, unclearVat = false, rowCount = 0;
    for (const match of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
      if (++rowCount > 100000) fail();
      const cells = new Map();
      for (const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cell[1], 'r'); if (!/^[A-Z]{1,3}[1-9]\d*$/.test(ref)) continue;
        const column = ref.replace(/\d+$/, ''); if (cells.has(column)) fail();
        cells.set(column, cellValue(cell[2] || '', cell[1], strings));
      }
      // Only keep the VAT boolean; no sheet titles, metadata or free text leave this parser.
      for (const value of cells.values()) {
        const v = compact(value);
        const related = /부가세|부가가치세|vat/.test(v);
        if (related && /여부|미정|추후|확인필요|포함[\/|]별도|별도[\/|]포함/.test(v)) unclearVat = true;
        if (/(?:부가세|부가가치세|vat)(?:10%|는|가|금액은)?포함/.test(v)) includes = true;
        if (/(?:부가세|부가가치세|vat)(?:10%|는|가|금액은)?(?:별도|제외|미포함|불포함)/.test(v)) excludes = true;
      }
      const columns = {}; let duplicateHeader = false;
      for (const [column, value] of cells) for (const [field, aliases] of Object.entries(HEADERS)) {
        if (aliases.includes(compact(value))) { if (columns[field]) duplicateHeader = true; else columns[field] = column; }
      }
      // Ordinary descriptions/titles may repeat words such as "내역". A table header also
      // needs quantity and price/amount columns. Ambiguous tables are skipped, not the workbook.
      if (columns.name && columns.qty && (columns.price || columns.amount)) {
        header = duplicateHeader ? null : columns;
        if (header) sawHeader = true;
        continue;
      }
      if (!header) continue;
      const row = {};
      for (const field of ['name', 'spec', 'qty', 'price', 'amount']) if (header[field]) row[field] = cells.get(header[field]) ?? '';
      if (typeof row.name === 'string' && row.name.trim()) rows.push(row);
    }
    if (sawHeader) tables.push({ rows, vat: unclearVat || (includes && excludes) ? 'ambiguous' : includes ? 'inclusive' : 'exclusive' });
  }
  return tables;
}
