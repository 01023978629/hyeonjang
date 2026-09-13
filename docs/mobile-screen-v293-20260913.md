# v293 모바일 화면 모의검사 및 개선 기록

검사일: 2026-09-13. 로컬 후보 브랜치: `codex/galaxy-android-20260913`.

## 반영 범위

- 작업시간 목록을 모바일 카드로 표시하고 수정·삭제 버튼을 44px 이상으로 유지한다. 긴 현장명은 줄바꿈한다.
- 작업시간 삭제 전에 현장·날짜와 선택한 기록 1건을 확인한다. 취소 시 기록을 바꾸지 않는다.
- 작업시간 및 사진 추가 확인 창은 모바일에서 본문만 스크롤한다. 제목·닫기·하단 버튼은 본문과 분리하여 가로/낮은 화면에서 가림을 줄인다.
- 모바일 저장 알림을 하단 메뉴 위에 표시하고 긴 안내문은 화면 폭 안에서 줄바꿈한다.
- 웹 버전과 캐시·검사 핀을 `hyeonjang-v293-mobilescreen`으로 맞춘다. 별도 작업 중인 v292 후보는 합치지 않았다.

공사 금액 계산·직원 권한·계정·Apps Script·실제 현장/사진·서버 자료는 이번 작업에서 변경하지 않았다. PC의 모달 배치는 유지하며, 스크롤 개선은 모바일의 두 창에만 적용한다.

## 웹 화면 모의검사

`tests/mobile-screen-layout.e2e.js`는 격리된 Playwright Chromium에서 합성 프로젝트와 작업시간 기록만 사용한다. 원격 요청과 서비스워커를 차단하고 사용자 브라우저 프로필은 사용하지 않는다. 사진 입력도 합성 File을 선택하고 취소하며 실제 업로드는 하지 않는다.

| 화면 | 크기 | 확인 범위 |
|---|---|---|
| 작은 세로 화면 | 360×640 | 하단 메뉴 이동, 더보기 사진 검색, 작업시간, 사진 입력·취소 |
| 큰 세로 화면 | 412×915 | 동일 흐름 |
| 가로 화면 | 740×360 | 본문 스크롤, 버튼 가림, 닫기 도달 |
| 앱 큰 글씨 | 360×640 | 앱의 `a11y-big2` 설정으로 버튼·현장명 확인 |
| 낮은 화면 | 360×360 | 제한된 높이에서 입력칸·하단 버튼 도달 |

낮은 화면은 **처음부터 작은 viewport로 시작하는 모의 조건**이다. 실제 갤럭시 키보드 열림/닫힘, visualViewport 변화, 브라우저 주소줄 변화, One UI 동작을 검증한 것이 아니다. 웹 큰 글씨도 Android 시스템 200% 확대와 동일하다고 주장하지 않는다.

실제 버튼 경계·hit-test·가로 넘침, 삭제 취소 후 2건 유지/승인 후 선택 1건만 제거, 토스트와 하단 메뉴의 간격, 사진 입력칸의 본문 내 경계·hit-test 및 미저장을 검사한다. 가로로 스크롤하는 기존 견적/정산 표는 의도된 별도 동작이므로 변경하지 않았다.

## 오류 주입 검사

| 변이 | 기대한 검출 |
|---|---|
| `work-grid` | 기존 62px 작업 버튼 열로 복원하면 가로 넘침 검출 |
| `work-scroll` | 작업시간 창의 예전 sticky footer로 복원하면 가로 화면 버튼 hit-test 실패 |
| `toast` | bottom 20px 복원 시 토스트가 하단 메뉴를 가리는 경계값 실패 |
| `delete-confirm` | 즉시 삭제로 복원하면 확인창 누락 실패 |

최종 4종 모두 해당 assertion에서 종료 코드 1로 검출했다. 제품 파일은 변이하지 않고 테스트 브라우저에서만 주입한다.

초기 `work-grid` 변이에서는 오류를 검출하지 못했다. 먼저 기존 왼쪽 정렬을 완전히 복원하지 않은 문제가 있었고, 이를 고친 뒤에도 Playwright의 scrollIntoView가 `overflow:hidden` 부모까지 프로그램으로 스크롤하여 실제 사용자에게 가려진 버튼을 노출했다. 기존 스타일을 정확히 복원하고 **도우미 스크롤 전 행 가로 넘침 검사**를 추가하여 검사를 강화했다. 과거 실패 로그는 삭제하지 않았다.

## Android 연결앱 화면 측정

`android-galaxy/app/src/test/java/kr/manmool/hyeonjang/MainActivityTest.java`에 5개 검사를 추가했다. 기존 5개와 합쳐 **10/10 통과**, 실패·오류·건너뜀 0이다. Robolectric native graphics의 JVM `View.measure/layout` 결과이며 실제 Android 에뮬레이터 화면 캡처가 아니다.

- 320×568 기본/200% 글씨, 360×800 xhdpi·130% 글씨, 640×320 가로 기본/200% 글씨.
- 시스템 바/화면 잘림 영역의 여백, 한글 본문 줄바꿈·잘림·말줄임, 카드 겹침, 48dp 터치 영역, 끝의 버튼·버전까지 스크롤 도달.
- 측정·스크롤 중 자동 브라우저 실행 없음.
- Android 제품 코드·APK 버전은 변경하지 않았다. 기존 로컬 APK 1.0.0을 새 빌드로 바꾼 작업이 아니다.

초기 실행은 기존 `app/build` 생성물의 ReadOnly 속성 때문에 테스트 실행 전 IOException으로 종료했다. 정확한 생성물 경로와 reparse point 0을 확인하고 속성만 해제했다. 파일 삭제는 없었다. 다음 실행의 9/10 실패는 Android 15의 비선형 글꼴 확대를 고려하지 않은 테스트 전제 때문이었다. 130%에서 30sp 제목은 유지되는 실제 runtime 표를 확인하고, 작은 본문의 실제 확대를 검증하도록 수정하여 최종 10/10을 얻었다.

## 재현 명령 및 증거

Node.js와 Playwright를 사용할 수 있는 환경에서 로컬 서버 `node tests/static-server.js`를 실행한다.

```powershell
node tests/mobile-screen-layout.e2e.js
$env:HJ_MOBILE_SCREEN_MUTATION='work-grid' # work-scroll, toast, delete-confirm도 각각 검사
node tests/mobile-screen-layout.e2e.js   # 각 변이는 예상 assertion으로 실패해야 함
Remove-Item Env:HJ_MOBILE_SCREEN_MUTATION
$env:HJ_TEST_JOBS='2'
node tests/run-all.js
```

전체 회귀: **144/144 통과, 0 실패, 재시도 0, 종료 코드 0**. Playwright 번들 Chromium에서 동시 2개, 13.3분으로 완료했다. 최종 제품·검사 코드 변경 후 수행했으며 신규 모바일 화면 검사도 포함한다. 파일당 제한 180초 및 기존 assertion은 완화하지 않았다.

로컬 증거 폴더: `C:\Users\1dncj\.cache\hyeonjang-mobile-20260913`.

- `before/`: 최초 30개 화면과 재현 화면. 수정 전 작업시간 잘림 확인.
- `after/`: 5개 조건별 6개 화면(30장). 작업시간·토스트·사진 입력 화면을 육안 재확인.
- `mobile-focused.log`: 가로 작업시간 footer 가림의 최초 실패.
- `mobile-focused-final-2.log`: 5/5 화면 흐름 통과(추가 가로 넘침 assertion의 최종 결과는 전체 회귀에 포함).
- `mutation-verified-*.log`: 최종 변이 4종의 예상 실패.
- `web-final.log`: 최종 전체 회귀 출력.
- Android XML: `android-galaxy/app/build/test-results/testDebugUnitTest/TEST-kr.manmool.hyeonjang.MainActivityTest.xml`.

## 배포·실기기 경계

현재 변경은 로컬 후보이며 공개 배포가 아니다. 작업 마무리 중 공개 `sw.js`를 다시 확인해 HTTP 200과 `hyeonjang-v291-teamwork`를 확인했다. 기존 연결 APK는 운영 웹을 여므로, APK를 실행한다고 미배포 v293 화면이 나타나지 않는다. 사용자 프로필에 테스트 자료를 넣어 미리보기를 만들지도 않았다.

PR·main 병합·Pages 업로드·공개 APK·루트 assetlinks·스토어 등록은 진행하지 않았다. 실제 갤럭시에서 설치, 키보드, 카메라/갤러리 선택, Drive 인증 및 원본 백업 결과 확인은 남아 있다. 기존 [갤럭시 설치·검증 안내](galaxy-android-20260913.md)의 실기기 6개 항목을 사용한다.
