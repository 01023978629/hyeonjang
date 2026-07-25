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
{ "token": "APP_TOKEN", "action": "save", "deviceId": "phone-01", "ts": 1789000000000, "payload": { } }
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
사장님이 앱을 열지 않아도 구글 서버에서 매일 깨어나 현장자료를 훑고 메일로 알립니다.

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

### 발송 정책

- 챙길 게 있는 날에만 보냅니다(알림 피로 방지).
- 조용한 날은 **월요일에만** "이상 없음" 확인 메일을 보냅니다.
- `WATCH_OFF=1` 이면 전면 중단(트리거는 유지).

### 추가 권한

`appsscript.json` 에 아래 범위가 필요합니다. 없으면 `installDailyWatch` 가 실패합니다.

- `script.scriptapp` — 시간 트리거 생성
- `script.send_mail` — 메일 발송
- `userinfo.email` — 받는 사람 기본값(내 계정) 조회
