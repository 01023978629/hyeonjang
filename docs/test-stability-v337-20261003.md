# v336 인수인계 정정 및 v337 테스트 안정화 적용 안내

## 결론과 승인 범위

2026-10-03 대표의 "수정해여 배포" 승인으로, 최신 `origin/main`의 PR #167
(`df5d8e3`, `hyeonjang-v337-customermessages`) 위에서 테스트와 검증 문서를 보완한다.
원본 PDF·메일 패치·적용안내 파일은 Downloads에 그대로 보존한다.

첨부의 v336은 테스트 패치의 이름이다. 이미 배포된 v336 선택 첨부/v337 고객 문구와는
별개의 작업이므로, 기존 기능을 덮거나 v335로 되돌리지 않는다.
`index.html`, `sw.js`, `tests/version-sync.check.js`, 공개 18파일은 변경하지 않는다.
계정·Drive·현장·사진·금액·Apps Script·고객 발송·PC 종료는 이번 변경 범위 밖이다.

## 원본 안내의 정정

| 원본 내용 | 최신 적용 기준 |
| --- | --- |
| 기준 main `bea9902`, 병합 뒤 v335 유지 | 기준 main `df5d8e3`, 제품 빌드 v337 유지 |
| `git am`으로 네 커밋 적용 | AGENTS 충돌과 중복 버전명을 고려해 최신 main에 최소 변경 재작성 |
| auto-sync 부팅 경합 가설 기각 | 실제 IDB 경계를 지연하면 부팅/online 두 호출이 재현됨 |
| 전체 실패 뒤 해당 파일 단독 통과면 진행 | 단독 통과는 진단 기록이며 전체 게이트 종료코드 0을 대체하지 않음 |
| Chromium 동일 문자열이 항상 DOM 변화를 만들지 않음 | 환경 일반화 대신 이번 알림 호출을 직접 관찰하는 검사 방식으로 설명 |
| 보증서 상태 대기 실패를 catch로 무시 | 정확한 공정값을 기다리고 대기 실패를 그대로 보고 |

## 수정 내용

1. `portal-key.e2e.js` ⑪: 메모리 배열을 비운 뒤 이번 `toast()` 호출을 기록한다.
   원래 toast와 DOM 감시는 유지한다. 비밀키 쓰기 실패 경고·직렬화 제외 단언은 그대로다.
2. `warranty-v313.e2e.js` ⑤(⑦): 직전 알림을 비운 뒤 새 알림 및
   e1=`시공 전`, e3=`완료`를 기다린다. id로 새 사진 객체를 찾는 최종 단언은 그대로다.
3. `office-intake-auto-sync.e2e.js`의 eventTrigger만 실제 `__hjRelayBootDone`을 기다린다.
   다른 부팅 게이트 시나리오를 일괄 대기시키지 않는다. 기대 전송 횟수는 늘리지 않는다.
4. `test-stability-fixture.js`: E2E와 VM이 같은 eventTrigger 측정 함수를 사용한다.
   보호 제거는 합성 브라우저에 공급하는 HTML에서만 수행하고 앱 파일은 수정하지 않는다.
5. `test-stability.unit.js`: 실제 relayBoot/queue badge/online·visible listener를 추출한다.
   IDB 대기열 읽기와 inbox coordinator만 합성으로 둔다.
6. `test-stability.mutations.js`: 보호 제거 5종이 의도한 동작 단언으로 실패하는지 확인한다.
   서버가 다른 체크아웃을 제공하면 중단하며, 자신이 시작한 서버만 종료한다.
7. PR 검증 워크플로: 기존 필터 없는 전체 검사 뒤 안정화 변이 검사를 추가한다.
   테스트·문서·서버 소스는 공개 Pages 허용목록에 넣지 않는다.

## auto-sync 강제 재현 근거

relayBoot는 `__hjRelayConfigDone`을 resolve한 **후에도** `relayUpdateQueueBadge()`의
IDB 응답을 기다린다. 테스트가 이 틈에 가짜 주소·토큰과 전송 spy를 넣으면,
online listener 1회 외에 남아 있던 boot도 `relayReady()`를 만족해 1회 호출한다.

수정 전 경계: IDB 읽기를 붙듦 → 설정 완료 → spy/합성 키 주입 → online → IDB 응답.
결과는 queueFlushes=2이며 두 번째 호출 스택에 실제 `relayBoot`가 있다.

수정 후 경계: IDB 읽기를 붙듦 → 설정 완료 → probe가 키·spy를 넣지 않고 대기 →
IDB 응답 → BootDone → spy/합성 키 주입 → online.
결과는 queueFlushes=1이며 boot 호출이 측정 창에 없다.

이는 테스트 시작 시점의 격리 결함을 입증한 것이다. 실제 서버에 같은 요청을 중복 전송했다거나
사진·접수가 중복 저장됐다고 주장하는 근거는 아니다. 앱의 정상 online 전송은 유지한다.

## 검증 절차

모듈은 저장소 밖에 설치하고, Linux에서는 `LANG=C.UTF-8`, `LC_ALL=C.UTF-8`을 사용한다.
브랜치는 `codex/test-stability-20261003`이며 main 직접 push 금지다.

```bash
node tests/syntax.check.js
node tests/dead-endpoint.check.js
node tests/cost-honesty.check.js
node tests/version-sync.check.js
node tests/serialized-keys.check.js
node tests/office-ops-server-isolation.check.js
node tests/test-stability.unit.js
node tests/test-stability.mutations.js
node tests/run-all.js
```

변이: applyData 실패 알림 삭제 / idbSet 동기 예외 거절 삼킴 / 오래된 사진 객체에 쓰기 /
online 전송 제거 / BootDone 대기 제거. baseline 종료 0 및 각 변이 종료 1과 의도한 실패
메시지를 확인한다. 실행 실패·브라우저 미설치·서버 오류는 변이 탐지로 세지 않는다.

전체 집계는 실제 `run-all.js`가 출력한 수와 종료코드로 기록한다. 새 unit 검사도 포함된다.
러너의 재시도·동시 수·180초 제한은 그대로다. 재시도 이력은 숨기지 않는다.
최종 전체 실패를 개별 파일 재검사 통과로 덮지 않는다.

## 완료 조건과 검증 경계

- 읽기 전용 사전 검토 → 최소 수정 → 정적/단독/변이 → PR 전체 검사 → main 병합.
- main Pages 전체 검사와 배포가 성공한 뒤 공개 18파일을 기존 v337과 대조한다.
- 테스트만 바꿨으므로 화면·버전·모든 공개 파일이 종전 v337과 같은 것이 정상이다.
- 공개 버전 유지와 테스트 보완 커밋/워크플로 성공을 각각 확인한다.
- 실제 직원 로그인·2기기·휴대폰·운영 Drive 전송은 이 합성 검사로 검증했다고 보고하지 않는다.

## 로컬 검증 기록

2026-10-03 Windows, 저장소 밖 Codex 번들 Node/Playwright, 격리된 합성 브라우저 기준:

- 정적 5종, OfficeOps 서버 격리, 강제 경합 VM: 모두 종료 0.
- 변이 실행 전 baseline 4파일: 포털 11/11, 보증서 19/19, auto-sync contract, VM 모두 종료 0.
- 보호 제거 5/5가 의도한 동작 실패로 각각 종료 1. 변이 러너 전체 종료 0.
- origin/main 대비 제품 18파일 및 빌드 3곳 변경 없음. `git diff --check` 통과.

필터 없는 전체 225파일의 최종 결과·재시도 이력·PR/Pages 실행·공개 반영 증거는
이 변경 PR의 검증 기록을 따른다. 검사 전 결과를 미리 통과로 적지 않는다.

## 첫 Pages 실패 및 추가 UI 측정 경계 보완

PR #168은 전체 225/225·변이 5/5로 `ae69c6b`에 병합됐다.
그러나 main Pages `37130082023`의 전체 검사는 223/225로 실패했다.
`mobile-operations.e2e.js`의 44px과 `ui-feedback.e2e.js`의 오류 칸 초점 검사이며,
기존 단독 재시도도 실패했다. stage/upload/deploy는 실행되지 않았다.
해당 실패를 개별 재실행 성공으로 덮거나 게이트를 생략하지 않는다.

읽기 전용 재현 및 후속 브랜치 `codex/ui-test-settle-20261003`의 최소 수정:

- 실제 `openModal`의 예약 초점 콜백을 붙잡으면 공란 제출 뒤 오류 칸 초점을
  초기 모달 초점이 덮는다. 거래처/재고는 초기 모달 초점 완료 후 제출한다.
  단가표에는 추가 50ms `matName` 초점이 있어 그 마지막 목표를 기다린다.
  오류 제출 뒤 초점을 강제로 주거나 원래 즉시 초점 단언을 늦추지 않는다.
- 실제 스타일의 80ms translate 전환 17/41/77ms에서 CSS/offsetHeight는 44이고
  DOMRect는 43.999969가 재현됐다. 완료 시 44다. CI 로그에는 해당 버튼의 실측이
  없었으므로 동일 메커니즘의 재현과 CI 버튼 식별은 구분한다.
  원래 버튼 초점 복귀와 실제 예약 렌더/대상·상위 요소 전환 완료 뒤 측정하며
  기존 `>=44`는 그대로다. 허용 오차/반올림/크기를 기다리는 검사는 넣지 않는다.
- 실제 CSS를 쓰는 정지 전환 회귀는 완료 전 대기가 끝나지 않는지와 완료 후
  44를 확인한다. 실제 43px은 44로 보정하지 않는 것도 확인한다.
  오류 칸 초점 제거 및 준비물 버튼 43px 축소 변이도 기존 행동 단언으로 실패해야 한다.
- 카메라 종료 상태는 `window` 속성이 아닌 실제 lexical 변수를 읽는다.
  지연 생성된 첫 목록 버튼 표시 뒤 기존 exact 정렬/데이터 불변 단언을 비교한다.

전체 파일 수는 225를 유지하며 변이는 7종이다. timeout/실행 오류는 변이 탐지로 세지 않는다.
제품 18파일/빌드 3곳/사진·현장·계정·서버 설정은 변경하지 않는다.
후속 전체 검사·재시도·Pages/공개 확인 결과는 실제 후속 PR 실행 기록을 따른다.

## 후속 로컬 검증 기록 (2026-10-04 KST)

- 관련 7파일을 기존 runner로 3회 반복: 매회 7/7, 종료 0, 단독 재시도 없음.
- 실제 CSS 정지 전환: 중간 DOMRect 43.999969482421875, 완료 후 44, 실제 축소 43.
- 변이 runner: baseline 6파일 종료 0, 보호 제거 7/7가 의도한 단언으로 종료 1,
  runner 최종 종료 0. 실행 오류·timeout을 성공으로 계산하지 않았다.
- 카메라 정렬 보호 제거 2종도 원래 exact 정렬 단언으로 실패하는 것을 확인했다.
- 정적 5종·OfficeOps 서버 격리·문법·diff 검사 통과. 제품 18파일·빌드·서버 변경 없음.
- 이는 로컬 관련 검사 결과다. 필터 없는 전체 225파일·후속 PR·main Pages·공개 확인은
  아직 완료로 간주하지 않으며 실제 워크플로 결과를 별도로 기록한다.
