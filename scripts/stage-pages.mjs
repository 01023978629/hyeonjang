import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputArg = process.argv[2];
if (!outputArg) throw new Error('사용법: node scripts/stage-pages.mjs <새 출력폴더>');

const output = path.resolve(process.cwd(), outputArg);
if (output === root || output === path.parse(output).root) throw new Error('저장소 루트나 드라이브 루트는 출력폴더로 사용할 수 없습니다.');

// Pages에서 실행·열람해도 되는 최소 앱 셸. backup/, tests/, apps-script/는 의도적으로 제외한다.
// 아이콘을 여기 안 넣으면 저장소에는 있는데 Pages 에 안 올라간다 — 폰에서 설치할 때만 드러난다.
const publicFiles = ['.nojekyll', 'index.html', 'media-safety.js', 'shared-todo-backup.js', 'privacy.html', 'sw.js', 'terms.html',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'manifest.webmanifest', 'operations-review.js', 'team.html', 'team-ui.js', 'team-projects.js', 'team-packet.js', 'team-config.js', 'team-upload.js',
  'bathroom-defaults.json', 'bathroom.html', 'bathroom.css', 'bathroom-model.js', 'bathroom.js', 'bathroom-warm.webp', 'bathroom-white.webp', 'bathroom-gray.webp',
  'leak.html'];   // v431 공개 누수 접수 — sw.js 셸 목록에는 넣지 않는다(앱 셸 아님)
// v612 손님용 누수 접수는 만물웹 leak.html 하나 — 현장 앱 leak.html 은 '홈페이지로 옮겼어요' 안내(noindex, 스크립트·스타일 파일 없음)만 남았다.
//      옛 접수 화면 leak.js·leak.css 는 저장소에 남겨 두되(지우지 않음) 더는 공개하지 않는다. 다시 공개하려면 이 목록과 pages-artifact 검사를 함께 고쳐라.
await mkdir(output, { recursive: false });
for (const rel of publicFiles) {
  const source = path.join(root, rel);
  const info = await stat(source);
  if (!info.isFile()) throw new Error('공개 파일이 아닙니다: ' + rel);
  await copyFile(source, path.join(output, rel));
}
console.log('Pages artifact:', publicFiles.join(', '));
