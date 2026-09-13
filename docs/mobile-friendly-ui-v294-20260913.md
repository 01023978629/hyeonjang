# v294 사용 편의 UI 개선 및 검증

작업일: 2026-09-13. 브랜치: `codex/galaxy-android-20260913`.
기준 커밋: `06598ad`(v293). 이번 후보: `hyeonjang-v294-friendlyui`.

## 변경한 사용 흐름

- 현장 선택창의 이름 말줄임을 없애고 긴 아파트명·동·호수를 줄바꿈한다. 단계 점과 숫자 대신 `시공 · 자료 2개`처럼 뜻을 표시한다.
- 현재 현장을 맨 위에 한 번만 표시하고 `현재 현장` 배지를 붙인다. 보관된 현재 현장도 보관 상태를 바꾸지 않고 찾을 수 있다.
- 나머지 현장은 이름·숫자 순으로 표시한다. 표시용 배열 복사본만 정렬하므로 원본 프로젝트 순서는 바꾸지 않는다.
- 검색 중에는 검색어와 맞는 결과만 보여준다. 현재 현장을 무관한 검색 결과에 억지로 끼워 넣지 않는다.
- 현장 목록만 스크롤하고 검색창·닫기는 화면 안에 유지한다. 상단 현장 버튼의 접근성 이름과 도움말에는 전체 현장명을 담는다.
- 모바일 사진 화면의 핵심 동작을 `사진 추가 / 드라이브 불러오기 / 사진 선택 / 도구 더보기`의 2×2 버튼으로 정돈한다. 작은 버튼은 최소 44px, 앱 큰 글씨에서는 주요 버튼 16px이다.
- 보조 사진 도구는 접어서 표시한다. 도구 열림·선택 모드 상태를 `aria-expanded`/`aria-pressed`에 반영하고 Enter 조작 뒤 초점을 유지한다. 펼친 뒤 Tab으로 첫 보조 도구에 도달한다.
- PC의 확장된 사진 도구·드래그 입력은 유지한다. 모바일 모드의 가로 화면에서도 간결한 도구 구성을 쓴다.

원본 사진·계정·공사 금액·저장 스키마·실제 자료·Apps Script·Android 제품 코드·APK는 변경하지 않았다. 별도 v292 후보는 병합하지 않았다. 공개 업로드·PR/main 병합·배포 및 PC 종료는 이번 요청 범위로 수행하지 않는다.

## 확인 방법

사전 읽기 전용 UI 검토 후 제품을 수정했으며, 독립 에이전트가 새 테스트를 작성했다. 이후 최종 코드 읽기 검토에서 지적한 버튼 초점 손실을 보완했다.

`tests/mobile-friendly-ui.e2e.js`는 격리된 Playwright Chromium에 가상 프로젝트·사진·서류·견적·입금 기록만 주입한다. 외부 요청·서비스워커를 차단하고 파일 선택·Drive·AI·팝업·다운로드가 발생하지 않는지 확인한다. 실제 브라우저 프로필과 사용자 자료를 사용하지 않는다.

검사 조건은 360×640, 412×915, 740×360, 앱 큰 글씨 360×640, PC 1280×900의 5가지다. 동·호수 끝부분이 다른 긴 이름, 현재 보관 현장, 40개 이상의 목록, 검색·해제·취소·선택, 헤더 위치, 터치 영역, 가로 넘침, PC hover 대비, 도구 상태 및 키보드 초점을 검사한다. 자료 직렬화 스냅샷과 프로젝트 원본 순서를 전후 비교한다.

실제 갤럭시 터치·가상 키보드·시스템 글꼴 확대·사진 업로드·Google 로그인은 이 모의검사로 검증한 것이 아니다.

## 결과

- 기존 관련 검사 6/6 통과: field-search-recovery, photo-first-screen, mobile-field-flow, mobile-screen-layout, mobile-shell-a11y, mobile-list. 이는 최종 초점 보완 이전의 중간 검사이며 최종 전체 회귀로 다시 포함한다.
- 신규 화면 모의검사 5/5 통과. 코드 변경 후 실제 캡처도 확인했다.
- 오류 주입 3종 모두 예상 assertion에서 종료 코드 1로 검출했다: `name-clip`은 긴 이름 잘림, `current-hidden`은 보관된 현재 현장 누락, `toolbar-state`는 선택 모드와 `aria-pressed` 불일치다. 제품 파일은 바꾸지 않고 격리 브라우저에만 오류를 주입했다.
- 최종 전체 회귀 **145/145 통과, 실패 0, 재시도 0, 종료 코드 0**. 제품·테스트 최종 변경 후 Playwright 번들 Chromium에서 동시 2개로 13.0분에 완료했다. 파일당 180초 제한이나 기존 assertion을 완화하지 않았다.

초기 검사 이력은 보존한다. 1차는 테스트 fixture를 `serializeData`에 직접 넘겨 선택 필드가 없는 TypeError가 발생했다. 실제 앱과 같은 `serializeData()` 호출로 고쳤다. 2차는 기본 버튼 hover의 `translateY(-1px)`를 grid 배치 오류로 오인했다. 실제 영역의 터치 크기·잘림 검사는 유지하고, 행·열 정렬만 layout offset으로 검증해 장식 변형과 분리했다. 제품의 현재 현장 hover 글자 대비 문제는 별도로 CSS에서 수정하고 대비 4.5 이상을 검사한다.

## 재현 및 로컬 증거

Node.js, Playwright 번들 Chromium, 로컬 `node tests/static-server.js`를 사용한다.

```powershell
node tests/mobile-friendly-ui.e2e.js
$env:HJ_FRIENDLY_UI_MUTATION='name-clip' # current-hidden, toolbar-state도 각각 실행
node tests/mobile-friendly-ui.e2e.js    # 해당 assertion으로 실패해야 함
Remove-Item Env:HJ_FRIENDLY_UI_MUTATION
$env:HJ_TEST_JOBS='2'
node tests/run-all.js
```

증거 폴더: `C:\Users\1dncj\.cache\hyeonjang-friendly-ui-20260913`.

- `before/`, `after/`: 가상 현장으로 만든 작은 화면·가로·큰 글씨·PC 캡처 각 12장.
- `screenshots/`: 신규 자동 검사의 가상 화면 캡처.
- `focused-1.log`, `focused-2.log`: 초기 테스트 오류 이력.
- `focused-3.log`: 최종 신규 화면 5/5 결과.
- `related.log`: 관련 기존 6/6 중간 결과.
- `mutation-name-clip.log`, `mutation-current-hidden.log`, `mutation-toolbar-state.log`: 오류 주입 3종의 예상 assertion 실패.
- `web-final.log`: 최종 전체 회귀 145/145 결과.

별도 설치 앱은 이미 준비된 APK 1.0.0 그대로다. 이번 UI는 웹 후보이므로 공개 배포되기 전까지 운영 웹이나 설치 앱에 자동 반영됐다고 안내하지 않는다.

2026-09-13 읽기 전용 HTTP 확인에서 운영 `https://01023978629.github.io/hyeonjang/sw.js`는 200과 `hyeonjang-v291-teamwork`를 반환했다. 로컬 v294와 운영 버전은 다르다.
