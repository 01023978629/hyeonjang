import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputArg = process.argv[2];
if (!outputArg) throw new Error('사용법: node scripts/stage-pages.mjs <새 출력폴더>');

const output = path.resolve(process.cwd(), outputArg);
if (output === root || output === path.parse(output).root) throw new Error('저장소 루트나 드라이브 루트는 출력폴더로 사용할 수 없습니다.');

// Pages에서 실행·열람해도 되는 최소 앱 셸. backup/, tests/, apps-script/는 의도적으로 제외한다.
const publicFiles = ['.nojekyll', 'index.html', 'privacy.html', 'sw.js', 'terms.html'];
await mkdir(output, { recursive: false });
for (const rel of publicFiles) {
  const source = path.join(root, rel);
  const info = await stat(source);
  if (!info.isFile()) throw new Error('공개 파일이 아닙니다: ' + rel);
  await copyFile(source, path.join(output, rel));
}
console.log('Pages artifact:', publicFiles.join(', '));
