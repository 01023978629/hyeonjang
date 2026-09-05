# 코덱스 인수인계서 — hyeonjang (현장 앱)

> 이 저장소에서 작업하는 모든 AI 에이전트(Codex·Claude)가 시작 전에 읽는 문서.
> 2026-09-01 기준. 낡은 내용을 발견하면 **이 문서부터 고쳐라.**

## 이 저장소가 무엇인가

만물인테리어(대전, 1인 시공업체, 대표 전병덕)의 **현장 운영 앱**.
`index.html` 단일 파일 PWA(약 28,000줄) + `sw.js`. **main 에 병합되는 순간
GitHub Pages 로 실제 운영 배포된다** — 사장님 폰에 바로 나간다.
운영 기준선은 main 의 최신 버전(2026-09-05 현재 `hyeonjang-v258-materials`)이며 전체 회귀는
`tests/run-all.js`가 집계하는 111개다(파일 수는 늘어난다 — 러너 마지막 줄의 집계를 믿어라). 사진 동기화 로컬 후보
`hyeonjang-v201-photosyncp0`는 서버 선행 게이트 전에는 계속 병합·배포하지 않는다.
`sw.js`의 캐시 이름이 곧 버전이다.

자매 저장소 `01023978629/manmool`: 공개 홈페이지 + 전자계약 Apps Script 서버 소스.

## 🔴 절대 금지 — 어기면 실제 사고가 난다

1. **`apps-script/` 폴더는 검토된 `OfficeIntake` 모듈과 후속 `Code.gs` dispatch split만 수정할 수 있다.** 기존 사진 중계 서버의 모든 relay action과 동작은 보존한다. 배포는 수동으로만 한다.
   전자계약 서버는 저기가 아니라 manmool 저장소 `apps-script-contract/` 다.
2. **비밀값(토큰·API 키·전화번호 원문)을 코드·커밋·로그에 넣지 마라.**
   키는 기기 IndexedDB 에만 산다. 테스트 픽스처는 자기서술형 가짜값만
   (`AKfyTEST`, `SUPER-SECRET-ADMIN-TOKEN` 류).
3. **고객 발송을 켜지 마라.** 문자·알림톡은 이중으로 꺼져 있고, 그게 정상이다.
   `notify.sent === true` 가 아니면 "보냈다"로 기록하지 않는다.
4. **종료된 Fly 주소(`manmool-contract.fly.dev`)를 되살리지 마라.**
   `tests/dead-endpoint.check.js` 가 지킨다.
5. **main 에 직접 push 하지 마라.** 브랜치 → PR → 검증 → 병합.
   병합·배포·발송·삭제·과금은 대표 승인이 필요하다.
6. **검증하지 않은 것을 완료라고 보고하지 마라.**

## ✅ 모든 변경의 필수 절차

```bash
# 1) 테스트 서버 (한 번만)
node tests/static-server.js &          # 8299
node tests/mock-relay.js &             # 8398 (relay.e2e.js 가 요구)

# 2) 정적 검사
node tests/syntax.check.js             # 문법
node tests/dead-endpoint.check.js      # 죽은 주소·옛 규약
node tests/cost-honesty.check.js       # 요금 단정 문구 금지
node tests/version-sync.check.js       # 화면 버전 == sw.js 캐시 버전
node tests/serialized-keys.check.js    # 직렬화 최상위 키 목록 네 곳 일치(키를 더했으면 반드시)

# 3) 전체 회귀 — 권위 있는 집계는 tests/run-all.js 가 찍는 'N개 중 N 통과' (2026-09-05 기준 111개)
#    종료코드로 판정한다(출력 마지막 줄만 보고 성공으로 판정하지 마라).
#    러너의 파일당 180초 제한을 제거하지 마라 — 한 파일이 멈춰도 실패로 끝나야 한다.
node tests/run-all.js
#    (2026-09-04) 브라우저 검사는 min(3, CPU-1)개씩 동시에 돈다(약 9분 → 4분). HJ_TEST_JOBS=1 이면 예전처럼 순서대로.
#    병렬에서 떨어진 파일은 끝에 단독으로 한 번 더 돌고 로그에 '재시도'로 남는다 — 재시도로만 통과한 파일이
#    반복되면 그 검사의 대기 조건을 고쳐라(러너의 재시도 횟수를 늘리지 마라).

# 4) 이번 OfficeOps source-only 인수인계 브랜치에서만 실행 (일반 PWA 변경은 제외)
node tests/commercial-approval-isolation.check.js
node tests/office-ops-server-isolation.check.js
node scripts/verify-office-ops-branch-scope.mjs
```

- **새 기능 = 새 테스트.** 그리고 반드시 **변이 검증**: 보호하는 동작을 일부러
  되돌려 테스트가 실패하는 것까지 확인하라. 안 잡히면 그 테스트는 장식이다.
- **`index.html` 을 고쳤으면 `sw.js` 캐시 버전을 올려라** (`hyeonjang-v{N+1}-{짧은이름}`).
  안 올리면 사장님 폰이 옛 버전을 계속 쓴다.
  **그리고 `index.html` 의 `APP_BUILD` 도 같은 값으로 맞춰라** — 그게 설정 화면과
  푸터에 찍혀 "지금 몇 번이세요?" 의 답이 된다. 예전에는 이 상수가 규칙 밖이라
  아무도 안 고쳤고, v183 폰이 화면에 '2026-07-30' 을 띄웠다. 틀린 번호는 없는
  번호보다 나쁘다 — 그 답을 믿고 엉뚱한 데를 판다. `version-sync.check.js` 가 막는다.
- 커밋 메시지는 "무엇을" 이 아니라 **"왜"** 를 적는 것이 이 저장소의 관례다.
- **브라우저 검사의 대기는 '끝 신호'로.** 고정 `waitForTimeout` 은 느린 러너에서 경쟁 조건이 된다(2026-09-05, manmool 배포가
  이걸로 한 번 떨어졌다). 부팅 IDB 읽기 뒤에 모의값을 넣을 때는 `__hjRestoreDone`·`__hjRelayConfigDone`·`__hjOfficeOpsBootDone` 을
  기다리고, IDB 왕복 뒤에 바뀌는 상태는 값이 바뀔 때까지 폴링하고, 시트를 닫은 뒤 다음 시트를 열 때는 `__mobileSheetHistoryRetire`
  가 비기를 기다려라. **`page.waitForFunction` 에 async 함수를 주지 마라** — Promise 자체가 참으로 잡혀 기다리지 않고 바로
  통과한다(실험으로 확인). IDB 를 읽어야 하면 `page.evaluate(async () => { for (...) { ... await idbGet(...) } throw ... })` 로
  페이지 안에서 폴링하라(relay·storage-durability 가 그 예).

## 지켜야 할 불변식 (각각 테스트가 못박고 있다)

| 불변식 | 지키는 테스트 |
|---|---|
| 직렬화 최상위 키는 허용목록에만 추가 — 키 하나에 **여섯 곳**(serializeData·applyData·PAID_SERIALIZED_STATE_KEYS·유상 배열 목록·검사 허용목록 2곳) | `serialized-keys.check`(정적 대조), `health-board`, `marketing-draft`, `restore-parity`, `office-ops-conversion` |
| 키 입력칸: 빈 값 저장 = "안 바꿈", 삭제는 [지우기]+확인만 | `key-persist` |
| 요금은 조건형으로만 ("결제계정이 없을 때만 무료") | `cost-honesty.check` |
| 전자계약 버튼은 서버 자가진단 통과 전까지 잠김, 잠긴 동안 요청 0 | `contract` |
| AI 도구 추가는 5곳(AI_TOOLS·aiToolRun·aiActionLabel·aiResultBrief·AI_WRITE), 맨 앞 주석 수는 실제 배열 길이와 일치 | `apt-ai`, `ai-tools-count.check` + ai-automation-auditor 감사 |
| 쓰기 도구는 AI_WRITE(승인 게이트), SAFE_AUTO 확대는 대표 승인 | `apt-ai` |
| 아파트 오더: 통계·정산은 완료월(doneAt) 기준, 입금완료 금액 수정 금지, 입금은 정산서에서만(payLog 1회) | `apt-orders`, `apt-stats`, `apt-amount` |
| 수금 입력은 미수 알림에서 한 번에 닿는다(얼마·언제), 미래 입금일 금지, 일부 입금은 독촉을 닫지 않는다 | `recv-entry` |
| 설정 화면은 탭 구조, 키는 아코디언 1겹까지 | `settings-tabs`, `key-persist` |
| AI 중계: 서버 키 없으면 기기 키 폴백, 한도 초과는 우회 금지 | `ai-relay` |
| 서버 날짜별 백업은 성패를 기록하고 화면에 띄운다 — 실패를 삼키지 않는다 | `backup-visible` |
| 아파트 오더 전/후 카드는 그 동/호 사진만 대상(파일명 매칭), 2장 이상일 때만 | `apt-ba` |
| 클로드 요청은 승인해야 적용, 같은 id 두 번 적용 금지, 모르는 도구 실행 금지 | `claude-inbox` |
| 링크는 `#hjreq=`(쿼리 금지 — 로그·SW캐시 누수), 승인 전 안전판, 삭제·발송·반출 도구 차단 | `claude-link` |
| 수금은 **누적**이지 덮어쓰기가 아니다 — 일괄 완납도 현장마다 payLog 1건 | `due-settle-all` |
| 하자보증 기본값은 법정기간(방수 36·설비 24·마감 12) 이상 | `warranty-review` |

## 구조 지도 (함수명으로 찾아라 — 줄번호는 금방 낡는다)

- 데이터: `state` + `serializeData()/applyData()` (드라이브 백업 왕복)
- 설정 화면: `openGdriveSetup()` — 5탭(저장·백업/전자계약/OfficeOps/AI·지도 키/기타)
- 전자계약 연결: `contractCall()`, `contractSelfTest()`, `contractFeatureAvailable()`
- AI: `geminiCall()`(서버 중계 우선), `aiFC()`(도구 호출), `AI_TOOLS`/`aiToolRun()`
- 아파트 오더: `aptOrderManage()`, `aptSettle()`, `aptStats()`, `aptPhotoCount()`
- 주간·운영 보고: `weekBriefData/Text()`, `opsReportData/Text()`
- 전체 장부 엑셀: `exportFullXlsx()` (10시트)
- `apps-script-commercial/`: separate Apps Script project인 source-only 프로젝트.
  자체 Script Properties와 수동 deployment가 필요하고 `APP_TOKEN`을 공유하지 않으며,
  Pages merge로 배포되지 않는다.
- `apps-script-office-ops/`: separate Apps Script project인 source-only 프로젝트.
  자체 Script Properties와 수동 deployment가 필요하고 `APP_TOKEN`을 공유하지 않으며,
  Pages merge로 배포되지 않는다.

## 서브에이전트

`.codex/agents/` 에 10종 정의됨(`.claude/agents/` 와 동일). 원칙:
같은 파일은 쓰기 에이전트 1명만(single-writer), 쓰기 전에 관련 리뷰어 근거 확보,
PII 원문 금지(전화 뒷 4자리만), 검증 없는 완료 보고 금지.

## 작업 분류 — 누가 할 수 있는 일인가 (2026-08-05)

에이전트(Claude·Codex)가 "못 하는 일"은 **전부 코덱스로 넘길 수 있는 게 아니다.**
대부분은 사람 손이 필요하고, 코덱스에 맡겨 두면 영영 안 끝난다. 세 칸으로 나눈다.

### 🅰 에이전트가 한다 (Claude·Codex 아무나 — 저장소 안에서 끝나는 일)

코드·테스트·문서. 위 절차(테스트 → 변이 검증 → sw 버전)만 지키면 된다.
실환경 체크리스트는 `apps-script/README_APPS_SCRIPT.md`의 배포 전 9개 gate로
정리됐다. 저장소 밖 Google 계정·실기기 확인은 아래 🅱 경계로 남는다.

*(해결됨 — 백업 0건)* `relayDailyBackup` 의 코드 경로도 서버 `makeBackup_` 도
멀쩡했다. 원인은 **모든 실패를 `catch(e){}` 로 삼켜** 매일 조용히 실패해도
알려 줄 화면이 없었던 것. v179 에서 성패를 기록해 백업 센터에 띄운다
(`backup-visible.e2e.js`). 이제 대표가 화면 색만 보고 알려 주면 된다.

### 🅱 사장님만 할 수 있다 (브라우저·본인 계정·결제 — 에이전트는 대신 못 누른다)

코덱스로 분류하면 **안 된다.** 코덱스도 똑같이 못 한다.

| 일 | 어디서 | 지금 상태 |
|---|---|---|
| Gemini API 키 발급 | `aistudio.google.com/api-keys`, 프로젝트 `Manmool Gemini No Billing` | **막힘** — "The request is suspicious" 재시도 필요 |
| 전자계약 Apps Script 배포 | 본인 구글 계정 | 배포 URL·스크립트 속성 설정됨 — 앱 자가진단과 실기기 계약 흐름 확인 필요 |
| 앱 ⚙️설정 자가진단·실기기 서명 확인 | 앱 | 대표 폰에서 최종 확인 필요 |
| 네이버·구글 소유확인 코드 | 서치어드바이저·서치콘솔 | manmool `index.html` 11~14행이 주석 처리된 자리표시자 |
| Threads 토큰 재발급 | Meta | 2026-06-19 만료 |
| 실제 문자·알림톡 발송 승인 | — | 계속 OFF 가 정상 |

### 🅲 사장님이 자료를 줘야 에이전트가 한다

실제 고객 후기(지어내기 금지), 현장 사진, 아파트 단지·관리사무소 정보.

## 지금 상태와 남은 일 (2026-09-01)

- (2026-09-04) 운영 기준선은 main 최신 `hyeonjang-v254-suggestbar`. v249~v254: 접수함 접수번호 읽기(v249)·접수함 링크(v250)·📍 사진 배정 점검(v251)·부팅 설정 읽기 완료 신호 `__hjOfficeOpsBootDone`(v252, 검사가 `__commercialApproval` 모의값을 넣기 전에 기다려야 한다)·👉 추천 배정(v253)·추천 버튼을 상단 요약 줄로(v254, 폰 첫 화면 규칙). 아래는 2026-09-01 기록: 소스 브랜치 기준선은 `hyeonjang-v243-photofirst`였다. 232~236 이력에서 v232는 관리사무소 접수의 공개 보고 수정·철회, 명시 프로젝트 사진 소유권, revision·충돌 복구를 포함했고, v233은 관리사무소 포털 선언 사진 슬롯, 승인 전 사진 attach gate, pre-accept revision 승계, semantic outbox 차단과 admin fail-closed를 추가했다. v234는 신규 접수의 사진 슬롯 선언을 필수화하고, 오프라인 승인 뒤 `photos-pending` 복구와 완료 사진 오류의 strict FIFO·상위 revision 교체 계약을 추가했다. v235는 완료 보고 수정의 합법적인 상태 전이 체인과 승인 payload 입력 오류 차단을 추가했다. 해당 범위의 마지막 버전은 승인 오더·outbox 선저장과 단일 FIFO 발송, request 단위 projection revision 재기준화, 익명 로그인 선행 캐시 제한, canonical slug·PNG 8-byte·slash 전화 마스킹 계약을 추가했다.
- OfficeOps·paid gate 작업은 이 소스 브랜치에만 있다. Task 6 최종 버전 마커·검토와 이후 대표의 명시적 병합·배포 승인이 모두 끝나기 전에는 운영 배포 상태로 보지 않는다. `apps-script-office-ops/conversion-promotion.json`의 `enabled`는 현재 `false`라 운영 OfficeOps 전환 승격도 꺼져 있다.
- 로컬 v201 사진 동기화 후보는 운영 서버 v1 멱등 계약과 대표 iPhone 실기기 확인 전까지 병합하지 않는다. v219에도 포함하지 않았다.
- 현재 전체 회귀 기준은 `tests/run-all.js`가 집계하는 파일 전부(2026-09-05 현재 111개)다. 과거의 브라우저·정적 60개 집계는
  OfficeIntake 서버·회귀 검사를 추가하기 전 기록이므로 완료 기준으로 쓰지 않는다.
- `AI_TOOLS` 실제 배열은 170종. 맨 앞 개발자 주석도 170종으로 맞췄고,
  `tests/ai-tools-count.check.js` 가 숫자가 어긋나면 실패한다.
- 전자계약 Apps Script는 배포 URL과 속성이 설정돼 있다. 완료로 확정하려면 대표 폰에서
  앱 자가진단, 계약 생성→서명→완료 PDF 실기기 확인이 필요하다. 실제 문자·알림톡은 계속 OFF.
- 고객 사례 글 재료는 `aptReviewMaterialText()` 6항목 형식으로 복사한다. 동·호수와
  고객 연락처를 공개 글에 넣지 않는다; manmool `scripts/new-case-post.mjs` 로 넘긴다.
- 네이버·구글 소유확인 코드, Threads 토큰 갱신, Gemini 키 상태 확인은 대표 계정 작업이다.
