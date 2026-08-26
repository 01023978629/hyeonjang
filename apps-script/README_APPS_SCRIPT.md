# Apps Script 중계 서버 — API 계약 (relay-v4)

모바일 브라우저가 Google Drive API를 직접 호출하지 않도록,
웹 → **이 Apps Script 웹앱** → 기존 Drive `만물인테리어` 폴더 로 중계합니다.
설치 절차는 저장소 루트의 `APPS_SCRIPT_설치방법.md`를 보세요.

## 요청 형식 (CORS·리디렉션 대응)

- **POST**, `Content-Type: text/plain;charset=utf-8`
  → 브라우저의 사전 OPTIONS 요청(preflight)이 발생하지 않는 "단순 요청"으로 설계.
    Apps Script는 OPTIONS를 처리하지 못하므로 이 형식이 필수입니다.
- 본문 = JSON 문자열:

```json
{ "token": "[REDACTED_SECRET]", "action": "save", "deviceId": "phone-01", "ts": 1789000000000, "payload": { } }
```

- `ts`: `Date.now()` 값. 서버가 ±10분 이내만 허용(재전송 시 새로 발급할 것).
- GET은 주소창 확인용 `?action=health&token=...` 만 지원.
- Apps Script는 `script.google.com` → `googleusercontent.com` 으로 302 리디렉션함
  → `fetch(url, {redirect:'follow'})` 기본값으로 동작하며 최종 응답에 CORS 허용 헤더가 붙음.

## 액션별 계약

| action | payload | 성공 응답 |
|---|---|---|
| `health` | — | `{ok, version, folderOk, dataFileExists, revision}` |
| `load` | — | `{ok, exists, data, revision, modifiedAt, savedBy}` (없으면 `exists:false, data:null, revision:0`) |
| `save` | `{data, baseRevision}` | `{ok, revision, savedAt}` |
| `backup` | — | `{ok, created, name}` (`created:false` = 오늘 이미 백업됨) |
| `upload` | `{name, mimeType, kind:'photo'|'doc', dataB64}` | `{ok, fileId, name, folder}` |
| `listFiles` | `{kind?}` | `{ok, files:[{id,name,mimeType,modifiedAt,kind}]}` |
| `thumbnail` | `{fileId}` | `{ok, fileId, mimeType, dataB64, source}` — 앱 폴더 안 이미지의 미리보기(썸네일 우선, 없으면 4MB 이하 원본). Google 로그인 없이 사진 표시용 (relay-v3+) |
| `download` | `{fileId}` | `{ok, fileId, name, mimeType, size, dataB64}` — 앱 폴더 안 **원본 파일 그대로**(20MB 이하). PC 정리용 ZIP 내려받기에 사용 (relay-v4+) |

오류 응답: `{ok:false, error, message}` — error 코드:
`unauthorized`(인증키 불일치) · `not-configured`(서버 미설정) · `bad-request` ·
`too-large` · `conflict` · `not-found` · `forbidden` · `not-ready` · `server-error`

> **버전 표기**: `health`의 `version` 값(예: `relay-v4`)은 서버 개선에 따라 올라갑니다.
> 앱은 이 값을 **비교하지 않고 표시만** 하므로, 서버·앱 버전이 달라도 동작합니다.
> 성공 판정은 `ok:true` + `folderOk:true` 로 하세요(버전 숫자가 아니라).

## 관리사무소 접수 API — 인증·권한 경계

Task 1–4에서 구현한 관리사무소 접수 기능은 기존 현장 relay와 같은
`text/plain;charset=utf-8` POST 진입점을 사용하지만 인증 경로가 분리됩니다.

### 공개(public)와 내부(internal) action

| 구분 | action | 인증 | 반환 범위 |
|---|---|---|---|
| 공개 | `officeLogin`, `officeList`, `officeGet`, `officeCreate`, `officeUpdate`, `officeCancel`, `officeUpload` | `officeLogin`은 단지 slug+6자리 PIN, 나머지는 8시간 만료 HMAC 세션 | 해당 office의 접수·상태·허용된 완료 보고만 |
| 내부 | `officeInbox`, `officeAccept`, `officeSetStatus`, `officeAdminUpsert`, `officeRotatePin`, `officeDisable`, `officeRetentionList` | 기존 `APP_TOKEN` 필수 | 현장 앱 연동·관리·보존 검토용. 외부 공개 금지 |

공개 action에는 내부 `APP_TOKEN`을 보내거나 반환하지 않습니다. 내부 action은
`checkToken_(req.token)` 검사를 통과한 경우에만 실행됩니다. 관리사무소 세션에는
`officeId`, `sessionVersion`, `issuedAt`, `expiresAt`만 서명해 넣고 PIN·토큰·사진
바이트·내부 메모를 넣지 않습니다. `OFFICE_INTAKE_ENABLED`가 꺼져 있으면 공개
로그인·접수 변경·사진 업로드를 거부하며 기존 relay action은 계속 동작합니다.

### Public response codes

공개 action의 응답은 `{ok:false,error,message}` 형식입니다. 아래 코드는
관리사무소 브라우저에 반환될 수 있는 값입니다.

`office-disabled`(feature flag가 exact string `1`이 아님) ·
`invalid-credentials`(없는/중지된 단지나 잘못된 PIN 포함) ·
`rate-limited`(10분 동안 로그인 실패 5회) · `session-expired`(만료·폐기·서명
오류 세션) · `invalid-input` · `consent-required` · `invalid-status` ·
`invalid-completion-photos` · `unsupported-type` · `invalid-file` · `too-large` ·
`too-many-files` · `not-found` · `bad-request` · `server-error`.

### Internal response codes

내부 action은 기존 `APP_TOKEN` 검증 뒤에만 호출되며, 결과는 현장 운영 도구가
처리합니다. `already-linked`(다른 현장 order가 이미 연결됨) ·
`slug-conflict`(다른 office가 같은 slug 사용) · `invalid-transition`(허용되지
않은 상태 전이) · `admin-state-unknown`(관리자 설정과 복구 상태를 판정할 수
없음) · `invalid-input` · `not-found` · `bad-request` · `server-error`.

### Operational records

`calendar-failed` · `already-linked` · `accept-invalid-transition` ·
`invalid-transition`은 운영 오류/재시도 기록에 저장될 수 있습니다. 긴급 접수의
Calendar 생성이 실패해도 성공한 접수·영수증은 보존되며, `calendar-failed`는
정제된 operational error로만 기록됩니다. 따라서 `calendar-failed`를 공개
`officeCreate` 실패로 표시하거나 접수를 롤백하지 않습니다. 운영 기록에는
`code`, `requestId`, `at`만 저장하며 PIN·토큰·전체 전화번호·사진 바이트는 없습니다.

로그인 실패나 동기화 실패 기록에는 전체 전화번호·PIN·세션 토큰·사진 바이트를
남기지 않습니다. 사진은 JPEG/PNG/WebP만 허용하고 이미지별 decoded bytes 2 MiB,
접수당 5장까지입니다. 영구 삭제 action은 이 단계에 없습니다.

## 배포 전 Script Properties 계약

아래 이름은 **Google Apps Script 프로젝트 설정 ▸ 스크립트 속성**에만 둡니다.
값을 코드·Git·문서·로그·채팅에 복사하지 마세요. 이 문서에는 값 예시를 싣지
않으며, 비밀값을 가리킬 때는 `[REDACTED_SECRET]`만 사용합니다.

| 키 | 용도 | 필수 시점 |
|---|---|---|
| `APP_TOKEN` | 기존 현장 relay와 내부 office action의 인증키 | 기존 relay 사용 전 |
| `DRIVE_FOLDER_ID` | 대표 Drive 루트 폴더 ID | relay/office 저장 전 |
| `DATA_FILE_NAME` | 기존 현장 데이터 파일명 | 선택(기본값 사용 가능) |
| `OFFICE_INTAKE_ENABLED` | 공개 office 로그인·접수 기능 on/off feature flag | 배포 전 설정 |
| `OFFICE_SESSION_SECRET` | office 세션·PIN HMAC 서명 키(충분히 긴 무작위 값) | office 기능 on 전 |
| `OFFICE_CONFIG_JSON` | office 목록·slug·활성 상태·PIN hash/salt·sessionVersion | office 기능 on 전 |
| `OFFICE_STORE_FILE` | 루트 Drive에 둘 접수 저장 파일명 | 선택(기본 `관리사무소접수.json`) |

`OFFICE_CONFIG_JSON`에는 평문 PIN을 저장하지 않습니다. 최초 office는 내부
`officeAdminUpsert`로 등록하고, `officeRotatePin`이 반환하는 PIN을 안전한
관리 채널에서 한 번만 전달합니다. 응답·로그·저장소에 PIN을 다시 기록하지
마세요. `OFFICE_INTAKE_ENABLED`는 검증 중 `0` 또는 누락 상태로 두고, 이 상태에서
기존 relay의 배포·health·read-only gate를 먼저 통과합니다. 그 뒤 통제된 공개
office 흐름 시험 시간에만 정확한 문자열 `1`을 설정하며, 모든 gate를 통과한
경우에만 `1`을 유지합니다. 어느 gate라도 실패하면 즉시 `0`으로 설정하거나
property를 삭제합니다.

## 계정 측 설치·재배포 순서와 live gate

이 저장소의 정적 검사 통과는 Google 계정 권한이나 실제 `/exec` 배포를 증명하지
않습니다. 다음 단계는 대표가 해당 Apps Script 프로젝트에서 직접 수행해야
합니다.

1. 기존 relay 프로젝트를 확인하고 `Code.gs`, `OfficeIntakePure.gs`,
   `OfficeIntake.gs`, `Watchdog.gs`, `appsscript.json`을 같은 프로젝트에 반영합니다.
2. 위 Script Properties를 값 노출 없이 입력합니다. 최초 설정은
   `OFFICE_INTAKE_ENABLED=0`으로 하거나 해당 property를 **아예 두지 않습니다**.
   오직 정확한 문자열 `1`만 office 공개 기능을 켜며, `0`·빈 값·누락·그 밖의
   값은 모두 끕니다. `OFFICE_SESSION_SECRET`은 새로 생성해 보관합니다.
3. `appsscript.json`의 `timeZone`이 `Asia/Seoul`인지 확인합니다. 영수증 번호의
   날짜와 `createdAt` 기반 보존 판정은 이 스크립트 시간대를 따릅니다.
4. 최초 권한 승인(Drive, Calendar, ScriptApp 및 필요한 Spreadsheet/Mail 범위)을
   대표 계정으로 완료합니다. 승인·OAuth 동의는 에이전트가 대신하지 않습니다.
5. 웹앱을 `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`로 **새 버전**
   배포합니다. 이 첫 배포는 flag가 `0` 또는 누락인 상태에서 진행합니다. 앱
   URL은 기존 배포의 `/exec`를 유지하고, 새 배포를 만들었다면 프론트 설정의
   URL만 대표가 직접 교체합니다.
6. 대표 계정에서 `health`를 확인해 `ok:true`, `folderOk:true`, 올바른
   `version`/`revision`을 확인하고, 기존 relay의 `load` 등 read-only 읽기 동작이
   정상인지 확인합니다. `not-configured`, `unauthorized`, `folderOk:false`이면
   다음 gate로 진행하지 않습니다. 이 단계에서 office 공개 login/create/upload는
   비활성 상태여야 합니다.
7. `APP_TOKEN`을 사용하는 내부 관리 도구로 office를 upsert하고 PIN을 rotate한
   뒤, 내부 `officeInbox`가 토큰 없이 거부되고 올바른 토큰으로만 동작하는지
   확인합니다. 생성·연결·상태 변경·긴급 Calendar 실패 기록은 테스트 데이터로
   확인합니다.
8. 대표가 통제된 시험 시간에만 property를 정확히
   `OFFICE_INTAKE_ENABLED=1`로 설정하고, 공개 office login → create → upload →
   list/get → status/완료 보고와 다른 office 차단을 확인합니다. Calendar 실패는
   성공한 접수·영수증을 보존하고 운영 오류로 기록하는지, 관리자 설정 실패는
   rollback/`admin-state-unknown` 계약을 지키는지 확인합니다.
9. 어느 gate 하나라도 실패하면 즉시 `OFFICE_INTAKE_ENABLED=0`으로 설정하거나
   property를 삭제하고, 기존 relay health/read-only 동작을 재확인합니다. 모든
   gate가 통과한 경우에만 `1`을 유지합니다. 로컬 Node 결과만으로 live gate를
   대체하지 않습니다.

### 롤백

문제 발생 시 대표가 먼저 `OFFICE_INTAKE_ENABLED`를 꺼 공개 접수를 멈추고,
기존 내부 relay의 health를 확인합니다. 필요한 경우 배포 관리에서 직전 정상
버전으로 되돌린 뒤 동일 URL의 health와 기존 relay 회귀를 재확인합니다.
관리자 설정 변경 실패 시 서버는 이전 `OFFICE_CONFIG_JSON` 복원을 시도하고,
복원 상태를 확인할 수 없으면 `admin-state-unknown`을 반환합니다. 이때 PIN을
추측하거나 수동으로 덮어쓰지 말고 현재 property 값을 대표가 확인한 후 복구합니다.
접수 저장 파일과 사진을 지우는 롤백은 하지 않으며, 법적 보존 대상은 별도 보존
검토로 남깁니다.

### Drive·Calendar 권한

`appsscript.json`의 Drive 범위는 기존 `현장데이터.json`, 백업, 관리사무소 접수
저장 파일과 접수별 사진 폴더를 배포 실행자 권한으로 읽고 쓰는 데 사용합니다.
Calendar 범위는 긴급 접수 알림과 Watchdog 일정 생성에만 사용하며, Calendar 생성
실패는 접수 성공을 취소하지 않고 `calendar-failed` 운영 오류로 기록합니다.
`script.scriptapp`는 Watchdog 시간 트리거, `spreadsheets`는 선택한 현황판,
`script.send_mail`은 명시적으로 mail 채널을 선택한 경우, `userinfo.email`은
기본 수신자 조회에만 필요합니다. 범위를 승인했다고 공개 office 인증이 끝난
것은 아니며, 실제 계정 승인과 배포는 별도 gate입니다.

## 충돌(revision) 규칙

- revision은 `현장데이터.json` 파일의 **설명(description)** 에 JSON으로 보관:
  `{revision, savedBy, savedAt}`
- 기존 파일(설명 없음)은 revision **0**으로 간주 → 기존 데이터 무이전 사용.
- `save`는 `baseRevision === 서버 revision`일 때만 덮어쓰고 revision+1.
  다르면 `{ok:false, error:'conflict', serverRevision, serverModifiedAt, serverSavedBy}` 반환 —
  **서버는 절대 무조건 덮어쓰지 않습니다.** 선택은 클라이언트(사용자)가 합니다.
- `LockService`로 동시 저장 직렬화.

## 크기·형식 제한

- save 데이터 ≤ 10MB · 업로드 base64 ≤ 12MB(≈9MB 파일) · 요청 전체 ≤ 15MB
- 사진: jpeg/png/webp/heic — **프론트가 업로드 전 압축(장변 1600px, JPEG)하는 전제**
- 문서: pdf/xlsx/xls/jpeg/png
- 대용량 영상·원본 파일은 지원하지 않음(Apps Script 실행 한계) — UI에도 표기됨

## 보안 한계 (반드시 읽을 것)

- `APP_TOKEN`은 **브라우저(IndexedDB)에 저장되므로 완전한 비밀이 아닙니다.**
  기기에 접근 가능한 사람은 추출할 수 있습니다. 무단 호출을 줄이는 최소 장치입니다.
- 현재 구현은 **1인 내부 업무용** 전제입니다. 직원 여러 명이 각자 계정으로 쓰는
  다중 사용자 운영으로 가면 Supabase Auth 또는 별도 인증 서버(계정·세션 기반)가 필요합니다.
- 적용된 방어: APP_TOKEN 비교 · 요청 시간(±10분) 검사 · action 화이트리스트 ·
  크기 상한 · 저장 데이터 구조 검사(app:'현장'/version) · 오류 원문 140자 절단.
- 토큰 유출이 의심되면: 스크립트 속성에서 `APP_TOKEN` 값을 바꾸고, 웹 설정 화면에서 새 키 입력.

---

## 파수꾼(Watchdog.gs) — 매일 아침 자동 점검

중계 서버와 **같은 프로젝트 안의 별도 파일**이며, 웹앱 API와는 무관하게 시간 트리거로만 동작합니다.
사장님이 앱을 열지 않아도 구글 서버에서 매일 깨어나 현장자료를 훑고 알립니다.
**메일·카톡을 쓰지 않는 것이 기본**이며, 기본 경로는 구글 캘린더 일정(폰 알림)입니다.

### 안전 계약 (반드시 지킬 것)

- **읽기 전용.** `현장데이터.json` 에 대해 `setContent`·`createFile`·`setTrashed` 를 **절대 하지 않는다.**
  파수꾼 때문에 사장님 자료가 바뀌거나 사라지는 일은 구조적으로 불가능해야 한다.
- 계산부(`watchScan_` 계열)는 GAS API를 쓰지 않는 **순수 함수**로 유지한다.
  → Node에서 그대로 검증 가능하며 `tests/watchdog.unit.js` 가 이를 회귀 테스트한다.
- 금액 파생 규칙은 앱(index.html)과 **같은 결론**을 내야 한다.
  견적 중복제거(`estimateGroups`)·미수금(견적합계−수금)·보증(`hjWarranty`) 규칙을 옮겨 놓았으므로,
  앱에서 그 규칙이 바뀌면 파수꾼도 함께 고치고 테스트를 갱신할 것.

### 함수

| 함수 | 용도 |
|---|---|
| `installDailyWatch` | 매일 트리거 설치(1회). 기존 트리거는 먼저 제거하므로 중복 생성되지 않음 |
| `removeDailyWatch` | 트리거 제거(발송 중단) |
| `testWatchNow` | 지금 즉시 1회 실행 — 조용한 날에도 강제 발송(설치 확인용) |
| `dailyWatch` | 트리거가 부르는 본체. 직접 실행할 일은 없음 |

### 감시 항목과 기본 기준 (`var W`)

| 항목 | 기본값 | 뜻 |
|---|---|---|
| `dueAfterDone` | 14일 | 공사 완료 후 N일 넘게 잔금 미입금 → 경보 |
| `dueMin` | 100,000원 | 이 미만 잔액은 반올림 노이즈로 보고 무시 |
| `warrantySoon` | 60일 | 보증 만료 D-N 이내 → 무상점검 제안(재수주 기회) |
| `asStale` | 3일 | AS 접수 후 N일 넘게 미처리 |
| `projStale` | 21일 | 진행 중인데 N일 넘게 사진·일정 없음 |

### 알리는 방법 (`WATCH_CHANNEL`)

| 값 | 동작 |
|---|---|
| `calendar` *(기본)* | 구글 캘린더에 `[파수꾼] …` 일정 생성 + 즉시 팝업 알림 → 폰이 울림. 같은 날 기존 파수꾼 일정은 지우고 다시 만들어 중복되지 않음 |
| `sheet` | 만물인테리어 폴더 안 `파수꾼 현황판` 스프레드시트에 날짜별 append(이력 추적) |
| `both` | 캘린더 + 시트 |
| `mail` | 메일. 기본 아님 — 명시적으로 선택할 때만 |

전달 본문은 `watchText_` 가 만드는 **순수 텍스트**입니다(캘린더 설명·시트 셀에서 그대로 읽히게).
연락처를 그대로 실어 일정에서 바로 전화를 걸 수 있게 합니다.

한 경로가 실패해도 **예외를 밖으로 던지지 않고** 로그에 남깁니다 — 알림 하나 때문에 파수꾼 전체가 죽으면 안 되기 때문.
다만 모든 경로가 실패하면 `⚠️ 알림 전달 실패` 를 로그로 남겨 조용히 사라지지 않게 합니다.

### 발송 정책

- 챙길 게 있는 날에만 알립니다(알림 피로 방지).
- 조용한 날은 **월요일에만** "이상 없음" 확인을 보냅니다.
- `WATCH_OFF=1` 이면 전면 중단(트리거는 유지).

### 추가 권한

`appsscript.json` 에 아래 범위가 필요합니다. 없으면 `installDailyWatch` 또는 알림 전달이 실패합니다.

- `script.scriptapp` — 시간 트리거 생성
- `calendar` — 캘린더 일정 생성(기본 경로)
- `spreadsheets` — 현황판 시트 기록(`sheet`/`both` 일 때)
- `script.send_mail` — 메일 발송(`mail` 일 때만)
- `userinfo.email` — 받는 사람 기본값(내 계정) 조회
