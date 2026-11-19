# 관리사무소 접수 — 독립 Apps Script 프로젝트 (office-intake-v1)

만물웹 `office-request.html`(관리사무소 접수 화면)이 부르는 **공개 관리사무소 action 만** 받는
별도 Apps Script 프로젝트입니다. 2026-11-19 항목 32로 만들었습니다.

- 지금까지는 공개 접수(토큰 없이 부르는 `officeLogin` 등 8개)가 현장 전체 자료(`load`·`save`·`download`)를
  가진 현장 중계(`apps-script/`)와 **같은 배포·같은 스크립트 잠금·같은 실행 시간** 안에서 돌았습니다.
- 이 프로젝트에는 현장 자료·사진 중계·원본 내려받기·현장웹 내부 action 코드가 없습니다. 이 주소가 아무리
  많이 불려도 현장 중계의 저장 잠금을 붙잡지 않습니다.
- 대표가 하는 설치·되돌리기 순서는 `docs/office-intake-split-20261119.md` 에 쉬운 말로 있습니다.
- 이 폴더는 **separate Apps Script project** 인 source-only 프로젝트입니다. 자체 Script Properties 와 수동
  deployment 가 필요하고 `APP_TOKEN` 을 공유하지 않으며, Pages merge 로 배포되지 않습니다
  (`scripts/stage-pages.mjs` 허용 목록 밖).

## 붙여넣을 파일 (네 개)

| 파일 | 내용 |
|---|---|
| `appsscript.json` | 시간대 `Asia/Seoul`, 권한은 Drive(접수 파일·사진)와 Calendar(긴급 접수 알림) 둘뿐, 웹 앱 `USER_DEPLOYING` · `ANYONE_ANONYMOUS` |
| `IntakeMain.gs` | `doGet`(배포 확인) · `doPost`(공개 action 만) · `setupOfficeIntake`(처음 한 번) |
| `OfficeIntake.gs` | `apps-script/OfficeIntake.gs` 와 **글자 하나까지 같다** |
| `OfficeIntakePure.gs` | `apps-script/OfficeIntakePure.gs` 와 **글자 하나까지 같다** |

`OfficeIntake.gs`·`OfficeIntakePure.gs` 를 고칠 때는 `apps-script/` 쪽을 고치고 이 폴더로 그대로 복사합니다
(`tests/office-intake-split.unit.js` 가 두 벌이 같은지 지킵니다). 같은 파일이 두 프로젝트에서 역할(`oiRole_`)만
다르게 돕니다. **중계 프로젝트에 `IntakeMain.gs` 를 넣지 마세요** — `doPost` 가 겹칩니다. 반대로 이 프로젝트에
중계 `Code.gs` 가 같이 들어오면 `IntakeMain.gs` 가 알아채고 아무 요청도 받지 않습니다(`not-configured`).

## 스크립트 속성

값은 Apps Script 프로젝트 설정에만 넣습니다. 코드·Git·문서·로그·채팅에 적지 않습니다.

| 프로젝트 | 키 | 용도 |
|---|---|---|
| 접수 프로젝트 | `OFFICE_INTAKE_ENABLED` | 정확한 문자열 `1` 일 때만 공개 로그인·접수·사진 올리기를 받는다(그 밖의 값·누락 = 꺼짐) |
| 접수 프로젝트 | `OFFICE_SESSION_SECRET` | 현장 중계의 같은 이름 값과 **똑같이**(32자 이상). 중계가 PIN 을 바꿀 때 만든 PIN 해시를 여기서 확인하고, 관리사무소 세션도 이 키로 서명한다 |
| 접수 프로젝트 | `DRIVE_FOLDER_ID` | 현장 중계와 같은 '만물인테리어' 폴더 ID. `setupOfficeIntake` 가 그 안에 `관리사무소접수_분리/` 를 만들 때만 쓴다 |
| 접수 프로젝트 | `OFFICE_INTAKE_STORE_ID` | `setupOfficeIntake` 가 직접 적는다(공개 저장 파일 ID) |
| 접수 프로젝트 | `OFFICE_RECEIPT_yyyyMMdd` | 접수 번호 날짜별 일련번호(코드가 직접 씀) |
| 현장 중계 | `OFFICE_INTAKE_MODE` | 정확한 문자열 `external` 일 때만 스위치 켜짐. 없거나 다른 값이면 예전 그대로 |
| 현장 중계 | `OFFICE_INTAKE_STORE_ID` | 위 접수 프로젝트의 같은 이름 값(공개 저장 파일 ID) |

단지 목록(`OFFICE_CONFIG_JSON` — slug·PIN 해시/소금값·활성·sessionVersion)은 지금처럼 **중계 속성에만** 둡니다.
접수 프로젝트는 그 사본을 내부 파일에서 읽습니다(아래).

## 저장 — 파일마다 쓰는 쪽은 하나

두 Apps Script 프로젝트는 스크립트 잠금(`LockService`)을 나눌 수 없습니다. 한 JSON 을 둘이 읽고 고쳐 쓰면
관리사무소 접수가 말없이 사라질 수 있어서, 같은 폴더(`만물인테리어/관리사무소접수_분리/`)에 파일을 둘 두고
**각자 자기 파일만 자기 잠금 안에서** 씁니다.

| 파일 | 쓰는 쪽 | 담는 것 |
|---|---|---|
| `관리사무소접수_공개.json` (`OFFICE_INTAKE_STORE_ID`) | 접수 프로젝트만 | 관리사무소가 적은 칸·사진 목록·`expectedUploadIds`·관리사무소 쪽 상태 결정(`status`·`statusAt`·`statusBasis`)·감사·운영 오류(`calendar-failed`) |
| `관리사무소접수_내부.json` (같은 폴더에서 이름으로 찾음) | 현장 중계만 | 현장 쪽 칸(`hyeonjangOrderId`·`publicAmount`·`visitAt`·`completionReport`·`completionPhotos`·`projectionRevision`·`needsInfoReason`·`completedAt`·`legalRetention`)·현장 쪽 상태 결정·감사·운영 오류(`invalid-transition` 등)·단지 목록 사본 `config` |

읽을 때 두 파일을 합쳐(`oiSplitMerge_`) 예전 한 파일(`관리사무소접수.json`)과 **같은 모양**의 저장소를 만들고,
쓸 때 자기 칸만 떼어 씁니다(`oiSplitWrite_`). 그래서 `OfficeIntake.gs` 의 처리 함수(로그인·접수·수정·취소·
사진·접수함·접수 승인·상태·단지 관리·보존 목록)는 그대로입니다. 현장웹(`index.html`)의 동기화 코드도 그대로입니다.

- **상태 합치기**: 현장 쪽이 상태를 정한 적이 있고(`statusAt`), 관리사무소 쪽 결정이 바로 그 현장 쪽 결정을
  보고 내린 것(`statusBasis` 가 같음)이 아니면 현장 쪽 상태를 씁니다. 옛 화면끼리 동시에 부딪히면 현장 쪽
  (대표의 결정)이 이깁니다. 두 파일 모두 남으므로 어느 쪽 기록도 지워지지 않습니다.
- 관리사무소가 '정보 요청'에 보완해 '검토 대기'로 돌린 것이 이기면 요청 사유를 지웁니다(예전 `officeUpdate` 와 같음).
- **단지 목록 사본**: 중계는 내부 파일을 쓸 때마다 `config` 에 `OFFICE_CONFIG_JSON` 을 그대로 적습니다. 스위치를
  켠 뒤 현장웹의 첫 접수함 동기화(`officeInbox`)가 내부 파일을 만들고, 그 뒤 단지 등록·PIN 바꾸기·중지가 같은
  쓰기에 사본을 고칩니다. 접수 프로젝트는 사본을 **30초**(`OI_SPLIT_CONFIG_CACHE_SECONDS`) 기억합니다 —
  단지 중지·PIN 바꾸기는 30초 안에 접수 쪽에 닿습니다. 평문 PIN 은 어디에도 저장하지 않습니다.
- **사진 폴더**: 관리사무소가 올린 사진은 `관리사무소접수_분리/관리사무소접수/<slug>/<접수번호>/` 에 저장됩니다.
  '만물인테리어' 안이어야 현장웹이 중계(`thumbnail`·`download`)로 볼 수 있어서 `DRIVE_FOLDER_ID` 안에 만듭니다.
  공개 완료 사진(`officePhoto`)은 중계가 확인한 `completionPhotos` 의 파일 ID 를 같은 구글 계정으로 읽습니다.

## action

| 구분 | action | 어디서 |
|---|---|---|
| 공개 | `officeLogin`, `officeList`, `officeGet`, `officeCreate`, `officeUpdate`, `officeCancel`, `officeUpload`, `officePhoto` | 스위치를 켜면 **이 프로젝트만**. 중계는 잠금·Drive 전에 `office-intake-moved` 로 거절 |
| 내부 | `officeInbox`, `officeAccept`, `officeSetStatus`, `officeAdminUpsert`, `officeRotatePin`, `officeDisable`, `officeRetentionList` | 언제나 **중계만**(`APP_TOKEN`). 이 프로젝트는 `bad-request` |

요청 형식은 중계와 같습니다(`text/plain` POST, 본문 JSON `{action, ts, payload, sessionToken?}`, `ts` ±10분).
이 프로젝트만의 응답: `not-configured`(설정 전이거나 중계 코드가 섞임) · `bad-request`(내부·현장 자료 action,
시간 초과, 형식 오류) · `too-large`(본문 4MB 초과). 나머지 응답 코드는 `apps-script/README_APPS_SCRIPT.md` 의
Public response codes 와 같습니다. `doGet` 은 `{ok, service:'office-intake', version, ready}` 만 돌려줍니다.

실패 제한은 그대로입니다: 로그인 실패 10분 동안 단지별 5회 · 없는 단지 이름 전체 12회 · 전체 실패 50회
(CacheService 가 잠금·Drive 보다 먼저). 잠긴 뒤 반복 시도는 Drive 를 읽지도 쓰지도 않습니다(단지 목록 30초 기억).

## 되돌리기

현장 중계의 `OFFICE_INTAKE_MODE` 를 지우면(또는 `external` 이 아닌 값) 중계가 예전처럼 공개 접수를 받고 예전
파일 `관리사무소접수.json` 을 씁니다. 만물웹 `office-api.json` 주소도 중계 주소로 돌립니다. 새 두 파일은
지우지 않습니다 — 켜져 있던 동안 들어온 접수는 거기 남으므로, 되돌리기 전에 현장웹 접수함에서 처리하거나
Claude 에게 옮겨 달라고 합니다.

## 검사

`tests/office-intake-split.unit.js` — 두 vm 샌드박스(중계·접수 프로젝트)가 가짜 Drive 하나를 나눠 쓴다:
① 두 벌 같음·권한 둘·현장 자료 코드 없음 ② 스위치 없음 = 예전 그대로(정확히 `external` 만 켬)
③ setup(폴더·파일 하나, ID 는 실행 기록에, 비밀값 없음)·내부 action 거절·중계 코드 섞임 차단
④ 공개 8개 `office-intake-moved`(잠금·Drive 0)·ID 없이 켜면 동기화 멈춤·첫 동기화가 단지 목록 사본을 만든다
⑤ 같은 비밀키로 PIN 확인·실패 잠금 그대로·잠긴 뒤 Drive 0 ⑥ 접수함 한 줄의 칸이 예전과 같음·사진은 중계로 보임
⑦ 접수·정보 요청·보완·다시 접수 ⑧ 옛 화면끼리 부딪힘(두 기록 남고 현장 쪽이 이김) ⑨ 완료 보고·공개 사진
⑩ PIN 바꾸기·중지(30초 기억) ⑪ 파일마다 쓰는 쪽 하나 ⑫ 되돌리기 ⑬ 문서.
`tests/office-intake-server.unit.js`(예전 1 프로젝트 계약)는 스위치 없는 상태 그대로 통과해야 합니다.
