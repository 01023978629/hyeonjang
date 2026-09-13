# v295 하단 오늘 할일 바로가기

작업일: 2026-09-13. 기준: `08ba1c4`(v294). 로컬 브랜치: `codex/galaxy-android-20260913`.
후보 버전: `hyeonjang-v295-todonav`.

## 사용자 요청과 반영 범위

하단의 견적 자리에서 오늘 할 작업으로 들어갈 수 있게 해 달라는 요청이다.

- 하단 메뉴 6개는 유지하고 다섯 번째 `견적`을 `✅ 오늘 할일`로 교체했다.
- 접근성 이름은 `오늘 할일, 오늘 할 작업 열기`, 도움말은 `오늘 할 작업`이다. 모달을 여는 버튼임을 `aria-haspopup="dialog"`로 표시한다.
- `__todo`를 일반 탭 이동 전에 분기하여 기존 `todoView()`를 연다. 오늘 할 일·밀린 할 일·완료 항목은 기존 자료를 그대로 사용한다. 새 저장 구조나 별도 작업 목록을 만들지 않는다.
- 배경 탭은 바꾸지 않고 기존 모달의 닫기·Esc·뒤로가기 및 초점 복귀를 재사용한다. 열기 전에 호출 버튼으로 초점을 맞춘다.
- 견적 작성 기능은 제거하지 않는다. 신·구 더보기의 바로가기에 `견적 작성`을 넣고, 검색에서도 찾을 수 있게 했다. `새 견적서`를 자동 생성하지 않아 작성 중 견적을 유지한다.
- 바로가기 개수는 배열 길이로 표시한다(현재 5개). 더보기의 업무 기능 117개 계약과 기존 견적·정산은 유지한다.

원본 사진·실제 작업 기록·계정·서버·Apps Script·금액 계산·Android 제품 코드·APK는 변경하지 않았다. 공개 업로드·PR/main 병합·배포·PC 종료는 이번 요청 범위로 수행하지 않는다.

## 검증

읽기 전용 사전/최종 UI 검토를 수행했다. 사전 확인에서 실제 진입 함수가 `todoView()`임을 확인하고, 일반 탭으로 보내지 않도록 했다.

기존 `mobile-screen-layout`의 견적 검사를 삭제하지 않고 `더보기 → 견적 작성` 실제 경로로 옮겼다. `mobile-more-tools`에도 견적 작성 검색 및 바로가기 진입을 추가했다.

- 관련 기존 검사 3/3 통과: mobile-screen-layout, mobile-more-tools, todo-list.
- 신규 `tests/mobile-todo-nav.e2e.js`: 격리 브라우저의 가상 자료만 사용하여 작은 화면·가로·큰 글씨에서 하단 위치, 목록, 닫기, 추가·체크, 견적 초안 보존을 검사한다. 실제 외부 요청·파일 선택·계정·업로드는 차단한다.
- 신규 4/4 통과(360×640, 320×568, 740×360, 앱 큰 글씨 360×640). 닫기·Esc·뒤로가기 각각 배경 탭, 스크롤 위치(1px 이내), 호출 버튼 초점이 유지됐다. 기존 가상 할일 추가·완료 체크/해제·빈 목록 및 견적 초안 보존을 확인했다.
- 오류 주입 2종을 각각 예상 assertion에서 종료 코드 1로 검출했다. `route`는 오늘 할일 클릭 연결 누락, `quote-shortcut`은 더보기 견적 작성 누락이다. 제품 파일을 변경하지 않고 격리된 테스트 브라우저에서만 주입했다.
- 최종 전체 회귀 **146/146 통과, 실패 0, 재시도 0, 종료 코드 0**. 제품·테스트 최종 변경 후 Playwright 번들 Chromium에서 동시 2개로 11.6분에 완료했다. 파일당 180초 제한과 기존 assertion은 완화하지 않았다.

모의 화면 검사는 실제 갤럭시 터치·가상 키보드·시스템 글씨 확대·운영 계정 확인과 다르다.

## 재현과 증거

Playwright 번들 Chromium과 `node tests/static-server.js`의 8299 서버를 사용한다.

```powershell
node tests/mobile-todo-nav.e2e.js
$env:HJ_TODO_NAV_MUTATION='route' # quote-shortcut도 각각 실행
node tests/mobile-todo-nav.e2e.js # 보호 assertion에서 실패해야 함
Remove-Item Env:HJ_TODO_NAV_MUTATION
$env:HJ_TEST_JOBS='2'
node tests/run-all.js
```

로컬 증거 폴더: `C:\Users\1dncj\.cache\hyeonjang-todo-nav-20260913`.
`related.log`는 관련 검사, `web-final.log`는 최종 전체 회귀 기록이다.
`focused-1.log`는 신규 4/4 결과, `mutation-route.log` 및 `mutation-quote-shortcut.log`는 예상 assertion 실패 기록이다. 신규 검사는 첫 실행에 통과했다.
`screenshots/`에는 네 화면 조건별 하단 메뉴·목록·빈 목록 모의 캡처 총 12장이 있다. 가로 화면은 기존 모달 안을 스크롤해 목록과 닫기에 도달한다.

이 변경은 로컬 웹 후보이며 운영 웹이나 설치 APK에 이미 반영됐다고 안내하지 않는다.
