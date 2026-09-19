/* app-icons.check.js — 앱 아이콘 네 장이 제자리에 있고 실제로 배포되는지 검사

   v320 이전에는 저장소에 이미지가 **한 장도 없었다**. 아이콘은 전부 index.html 안의
   data:image/svg+xml 이었고, 그 결과가 셋이었다.
     · 아이폰에서 '홈 화면에 추가' 하면 아이콘 대신 그 페이지 스크린샷이 박혔다
       (apple-touch-icon 에 실제 파일이 없으면 iOS 가 그렇게 한다).
     · 안드로이드 maskable 은 원·스퀘어클로 잘리는데 글리프가 안전원을 넘어 있었다
       — 실측으로 중심에서 241px(512 기준), 안전원은 171px 였다.
     · text-anchor="middle" 은 글자의 '진행폭'을 가운데 맞추지 잉크를 맞추지 않아
       실제 그림이 13px 어긋나 있었다.

   여기서 막는 것은 그 셋이 되돌아오는 것과, **파일은 있는데 배포에 안 실리는 것**이다.
   scripts/stage-pages.mjs 의 허용목록에 이름이 없으면 Pages 에 안 올라가는데
   저장소에는 멀쩡히 있어서, 폰에서 설치할 때에만 드러난다.

   브라우저 없이 도는 정적 검사다. PNG 는 직접 풀어 본다(이 저장소에는 이미지 라이브러리가 없다). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const fail = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const check = (ok, msg) => { if (!ok) fail.push(msg); };

/* 아이콘 이름 → [선언 크기, 최소바이트, 최대바이트] */
const ICONS = {
  'icon-192.png': [192, 1500, 40000],
  'icon-512.png': [512, 5000, 120000],
  'icon-maskable-512.png': [512, 3000, 120000],
  'apple-touch-icon.png': [180, 1200, 40000],
};

function pngInfo(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { buf, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], ctype: buf[25] };
}

/* PNG 를 RGBA 로 푼다 — 8비트·논인터레이스만(우리가 굽는 것이 그것이다). */
function decodeRgba(info) {
  const { buf, w, h, depth, ctype } = info;
  if (depth !== 8) throw new Error('8비트가 아니다: ' + depth);
  const CH = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!CH) throw new Error('색유형 미지원: ' + ctype);
  const idat = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0, b = prev ? prev[i] : 0, c = prev && i >= CH ? prev[i - CH] : 0, x = line[i];
      let v;
      if (ft === 0) v = x; else if (ft === 1) v = x + a; else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 0xff;
    }
  }
  return { w, h, CH, ctype, out };
}

/* 바탕색과 다른 픽셀(= 글리프)이 중심에서 얼마나 멀리까지 뻗는가 */
function glyphMaxRadius(rel, bgHex) {
  const info = pngInfo(rel);
  const img = decodeRgba(info);
  const bg = [parseInt(bgHex.slice(1, 3), 16), parseInt(bgHex.slice(3, 5), 16), parseInt(bgHex.slice(5, 7), 16)];
  const { w, h, CH, ctype, out } = img;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  let far = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * CH;
    let r, g, b, al = 255;
    if (ctype === 6) { r = out[i]; g = out[i + 1]; b = out[i + 2]; al = out[i + 3]; }
    else if (ctype === 2) { r = out[i]; g = out[i + 1]; b = out[i + 2]; }
    else { r = g = b = out[i]; if (ctype === 4) al = out[i + 1]; }
    if (al < 128) continue;
    if (Math.abs(r - bg[0]) <= 40 && Math.abs(g - bg[1]) <= 40 && Math.abs(b - bg[2]) <= 40) continue;
    n++;
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    if (d2 > far) far = d2;
  }
  return { radius: Math.sqrt(far), pixels: n, size: w };
}

/* ① 파일이 있고, 선언한 크기와 실제 크기가 같은가 */
for (const [name, [size, min, max]] of Object.entries(ICONS)) {
  const abs = path.join(ROOT, name);
  if (!fs.existsSync(abs)) { fail.push(`아이콘 파일이 없다: ${name}`); continue; }
  const bytes = fs.statSync(abs).size;
  check(bytes >= min && bytes <= max, `${name} 용량이 이상하다 (${bytes}B, 기대 ${min}~${max}B)`);
  const info = pngInfo(name);
  if (!info) { fail.push(`${name} 이 PNG 가 아니다`); continue; }
  check(info.w === size && info.h === size, `${name} 크기가 ${info.w}x${info.h} 다 — ${size}x${size} 여야 한다`);
}

/* ② maskable 은 안드로이드가 잘라 낸다 — 안전원(가운데 지름 2/3) 안에 들어와야 한다 */
if (fs.existsSync(path.join(ROOT, 'icon-maskable-512.png'))) {
  try {
    const m = glyphMaxRadius('icon-maskable-512.png', '#0b4ea2');
    const safe = m.size / 3;   // 108dp 중 보장되는 72dp = 지름 2/3
    check(m.pixels > 1000, 'icon-maskable-512.png 에 글리프가 안 보인다 — 바탕만 있는 그림이다');
    check(m.radius <= safe,
      `icon-maskable-512.png 의 글리프가 안전원을 넘는다 (중심에서 ${Math.round(m.radius)}px, 한계 ${Math.round(safe)}px) — 안드로이드 홈 화면에서 잘린다`);
  } catch (e) { fail.push('icon-maskable-512.png 을 풀지 못했다: ' + e.message); }
}

/* ③ 일반 아이콘은 가장자리까지 꽉 차면 안 된다(모서리가 깎이면 글자가 잘린다) */
if (fs.existsSync(path.join(ROOT, 'icon-512.png'))) {
  try {
    const a = glyphMaxRadius('icon-512.png', '#0b4ea2');
    check(a.radius <= a.size * 0.47,
      `icon-512.png 의 글리프가 너무 가장자리까지 간다 (${Math.round(a.radius)}px / ${a.size}) — 둥근 모서리에 잘린다`);
  } catch (e) { fail.push('icon-512.png 을 풀지 못했다: ' + e.message); }
}

const html = read('index.html');
const sw = read('sw.js');
const stage = read('scripts/stage-pages.mjs');

/* ④ head 가 파일을 가리키는가 (data: 로 되돌아가면 구글도 iOS 도 못 가져간다) */
check(/<link rel="apple-touch-icon" href="apple-touch-icon\.png">/.test(html),
  'index.html 의 apple-touch-icon 이 apple-touch-icon.png 를 가리키지 않는다 — 없으면 아이폰 홈 화면에 스크린샷이 박힌다');
check(/<link rel="icon"[^>]*href="icon-192\.png">/.test(html), 'index.html 의 rel="icon" 이 icon-192.png 를 가리키지 않는다');
check(!/<link rel="(?:icon|apple-touch-icon)"[^>]*href="data:/.test(html),
  'index.html 이 아직 인라인 data: 아이콘을 쓴다 — 가져갈 주소가 없다');

/* ⑤ manifest — blob: 로 붙기 때문에 **절대주소**여야 한다.
      상대주소를 넣으면 new URL('icon-192.png', blobHref) 가 던진다(브라우저에서 확인함). */
const mfBlock = html.match(/manifest를 동적으로 주입[\s\S]*?\n\}\)\(\);/);
if (!mfBlock) fail.push('index.html 에서 manifest 주입 블록을 못 찾았다 — 형식이 바뀌었으면 이 검사부터 고쳐라');
else {
  const blk = mfBlock[0];
  check(/const abs\s*=\s*\(p\)\s*=>\s*new URL\(p,\s*location\.href\)\.href/.test(blk),
    'manifest 의 주소를 절대주소로 바꾸는 abs() 가 없다 — blob: manifest 에서는 상대주소가 풀리지 않는다');
  for (const [name, varName] of [['icon-192.png', 'icon192'], ['icon-512.png', 'icon512'], ['icon-maskable-512.png', 'iconMask']]) {
    check(new RegExp(`${varName}\\s*=\\s*abs\\('${name.replace(/\./g, '\\.')}'\\)`).test(blk),
      `manifest 의 ${varName} 가 abs('${name}') 가 아니다`);
  }
  check(/purpose:'maskable'/.test(blk), "manifest 에 purpose:'maskable' 아이콘이 없다 — 안드로이드가 흰 테두리를 두른다");
  check(/purpose:'any'/.test(blk), "manifest 에 purpose:'any' 아이콘이 없다");
  check(!/type:'image\/svg\+xml'/.test(blk), 'manifest 가 아직 SVG 아이콘을 쓴다 — 크롬은 설치 아이콘으로 쓰지 않는다');
  check(/start_url:abs\('\.'\)/.test(blk), "manifest 의 start_url 도 절대주소여야 한다");
}

/* ⑥ 오프라인 캐시와 배포 허용목록 — 빠뜨리면 폰에서만 드러난다 */
for (const name of Object.keys(ICONS)) {
  check(sw.includes(`SCOPE_PATH+'${name}'`), `sw.js 의 오프라인 셸 목록에 ${name} 가 없다 — 비행기모드에서 아이콘이 깨진다`);
  check(stage.includes(`'${name}'`), `scripts/stage-pages.mjs 의 공개 허용목록에 ${name} 가 없다 — 저장소에는 있는데 Pages 에 안 올라간다`);
}

if (fail.length) {
  console.error(`✗ 앱 아이콘 ${fail.length}건`);
  fail.forEach((x) => console.error('  - ' + x));
  process.exit(1);
}
console.log(`✓ 앱 아이콘 ${Object.keys(ICONS).length}장 — 크기·maskable 안전원·head·manifest 절대주소·오프라인 캐시·배포 허용목록`);
