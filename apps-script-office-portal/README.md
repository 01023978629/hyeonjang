# 관리사무소 포털 Apps Script 백엔드

현장 웹·만물 공개 사이트와 분리해 배포하는 개인 계정 기반 포털 API입니다. 정적 GitHub Pages 프런트는 신뢰 경계가 아니며, 단지 범위·사용자 상태·역할·권한·세션 버전은 모든 보호 action에서 서버가 다시 확인합니다.

이 폴더는 기존 `apps-script/` Drive relay와 **별도 Apps Script 프로젝트**로 배포해야 합니다. 기존 relay의 Script Properties, 스프레드시트, 배포 URL과 섞지 마세요.

## 보안 모델

- 로그인: 관리자가 사용자별로 발급한 6자리 인증번호
- 인증번호: 사용자별 무작위 소금값과 HMAC 해시만 Sheets에 저장하며 원문은 저장하지 않음
- 실패 제한: 5회 연속 오류 시 해당 사용자를 15분간 잠금
- 공개 요청 보호: 10분 단위 Script Cache 전역 best-effort 한도 적용
- 입력 안전: Sheets에 저장되는 외부 문자열이 `=`, `+`, `-`, `@`, 탭 또는 줄바꿈으로 시작하면 `invalid-input`으로 거부해 수식 주입을 차단
- 세션: 8시간 유효한 opaque token. 원문은 로그인 성공 응답에서 한 번만 반환하고 서버에는 HMAC 해시만 저장
- 보호 action: 매 호출마다 현재 `Users.enabled`, 역할, `sessionVersion`, `permissionVersion`, 단지 활성 상태와 버전을 재검증
- 인증번호 변경: 같은 잠금 안에서 사용자별 해시를 교체하고 `sessionVersion`을 올려 기존 세션을 무효화
- 단지 격리: 일반 사용자의 `officeId`는 요청값을 사용하지 않고 세션에서 강제
- 쓰기 멱등성: 상태·일지·작업지시·공지·비용·사용자·권한 저장은 클라이언트 UUID `requestId`와 `PortalOperations` 기록으로 중복 실행을 차단
- 응답 최소화: 인증번호 해시·소금값·토큰 해시·내부 저장 키는 어떤 API 응답에도 포함하지 않음
- 감사 로그: action, 대상 ID, 결과 같은 메타데이터만 기록. 이메일·인증번호·세션 원문·상태/일지 본문은 기록하지 않음

로그인 없이 호출 가능한 action은 `portalHealth`, `portalLogin`뿐입니다.

## 역할과 기본 권한

| 역할 | 기본 범위 |
|---|---|
| `system_admin` | 단지/사용자 부트스트랩, 권한, 감사. 상태·일지·대시보드 콘텐츠 권한 없음 |
| `manager_chief` | 자기 단지의 상태·일지·작업지시·공지·비용 승인·보고서·사용자·권한·감사 전체 |
| `facility_manager` | 상태·일지·작업지시·공지 초안·비용 초안/제출·보고서. 담당자 배정·공지 발행·비용 승인은 제외 |
| `resident_rep` | `board`, `public` 상태·일지·발행 공지와 비금액 집계 보고서 |
| `resident` | `public` 상태·일지·유효기간 안의 발행 공지 |

사용자별 `permissions`는 역할 ceiling 안에서만 저장할 수 있습니다. `system_admin`과 `manager_chief`의 마지막 활성 계정 제거를 막고, 로그인 중인 관리자가 자기 역할·활성 상태·로그인 이메일·권한을 바꿔 스스로 잠기는 것도 막습니다.

프런트와 서버가 공유하는 capability allowlist는 다음과 같습니다.

```text
dashboard.view
status.view
status.manage
logs.view
logs.manage
requests.view
reports.view
notices.view
notices.manage
notices.publish
costs.view
costs.manage
costs.approve
workorders.view
workorders.manage
workorders.assign
admin.users.view
admin.users.manage
admin.permissions.manage
admin.audit.view
```

## 최초 설치

1. 포털 전용 Google Spreadsheet를 새로 만듭니다. 다른 현장 데이터 스프레드시트를 재사용하지 마세요.
2. 독립된 Apps Script 프로젝트를 만들고 이 폴더의 `Code.gs`, `PortalPure.gs`, `appsscript.json`을 같은 프로젝트에 추가합니다.
3. Apps Script의 **프로젝트 설정 → 스크립트 속성**에 아래 영구 속성을 등록합니다.
   - `OFFICE_PORTAL_ENABLED`: 운영 활성화 시 `1`
   - `OFFICE_PORTAL_SHEET_ID`: 1단계 스프레드시트 ID
   - `OFFICE_PORTAL_SESSION_SECRET`: 암호학적으로 생성한 32자 이상의 서로 다른 비밀값
   - `OFFICE_PORTAL_OTP_PEPPER`: 이메일 식별자 해시용 32자 이상의 비밀값
   - `OFFICE_PORTAL_LOGIN_PEPPER`: 위 두 비밀과 다른, 인증번호 해시용 32자 이상의 비밀값
4. 편집기에서 `portalSetupSheets_()`를 직접 한 번 실행하고 Sheets 권한을 승인합니다. 다음 탭과 고정 헤더가 생성됩니다.
   - `Offices`, `Users`, `OtpChallenges`, `Sessions`, `PortalOperations`, `RolePermissions`, `ManagementStatus`, `ManagementLogs`, `WorkOrders`, `Notices`, `CostItems`, `PortalAudit`
5. 최초 관리자 생성을 위해 아래 임시 스크립트 속성을 등록합니다.
   - `OFFICE_PORTAL_BOOTSTRAP_OFFICE_ID`
   - `OFFICE_PORTAL_BOOTSTRAP_SLUG`
   - `OFFICE_PORTAL_BOOTSTRAP_COMPLEX_NAME`
   - `OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL`
   - `OFFICE_PORTAL_BOOTSTRAP_ADMIN_NAME`
   - `OFFICE_PORTAL_BOOTSTRAP_LOGIN_CODE`: 관리자가 정한 6자리 숫자
6. 편집기에서 `portalBootstrapFromProperties_()`를 직접 한 번 실행합니다. 첫 단지와 첫 `system_admin`이 생성되며, 성공하면 5단계 임시 속성은 자동 삭제됩니다. 활성 `system_admin`이 이미 있으면 재실행은 거부됩니다.
7. **배포 → 새 배포 → 웹 앱**에서 실행 사용자를 배포 소유자로, 액세스 사용자를 누구나로 설정해 배포합니다. 익명 액세스는 로그인 action을 호출하기 위한 전송 경로일 뿐이며, 보호 action은 서버 세션 없이는 실행되지 않습니다.
8. 배포된 `/exec` URL에 POST `{"action":"portalHealth"}`를 보내 `ok`, `service`, `enabled`를 확인합니다.
9. 프런트의 포털 API URL을 이 독립 배포의 `/exec` URL로 설정합니다. 기존 Drive relay URL을 덮어쓰지 마세요.

비밀값은 소스, README, 채팅, Git, 브라우저 코드에 넣지 않습니다. Apps Script Script Properties에만 보관하고 운영 인계 시에도 실제 값을 문서화하지 않습니다.

## 로그인 API 계약

성공은 `{ "ok": true, ... }`, 실패는 `{ "ok": false, "error": "code" }` 형태입니다.

- `portalLogin`: `{action, payload:{officeCode,email,loginCode}}`
- 보호 action: 최상위에 `sessionToken`을 넣고 필요 입력은 `payload`에 둡니다.
- `portalStatusSave`, `portalLogSave`, `portalWorkOrderSave`, `portalNoticeSave`, `portalCostSave`, `portalCostApprove`, `portalUserSave`, `portalPermissionSave`의 payload에는 브라우저 `crypto.randomUUID()`로 만든 v4 UUID `requestId`가 필수입니다. 신규 사용자의 `portalUserSave`에는 `loginCode`가 필수이고, 기존 사용자에서는 인증번호를 바꿀 때만 보냅니다. 한 번의 사용자 저장 동작과 네트워크 재시도는 같은 `requestId`를 유지하고, 다음 저장 동작에는 새 UUID를 사용하세요.
- 같은 `requestId`와 같은 정규화 입력을 재전송하면 기존 entity와 revision을 그대로 반환하며 `replayed:true`가 표시됩니다. 같은 `requestId`에 다른 입력을 보내면 `invalid-input`입니다.
- `portalLogout` 성공 후 같은 token은 재사용할 수 없습니다.

### 운영 API

- `portalWorkOrderList` → `{workOrders, assignees?}`. 작업지시의 담당자 표시는 최소 필드 `assigneeUserId`, `assigneeName`만 사용하고, 배정 후보 `assignees`는 `workorders.assign` 보유자에게만 `{id,name,role}`로 반환합니다. 이메일과 동·호 정보는 포함하지 않습니다.
- `portalWorkOrderSave` → `{workOrder,replayed,auditPending}`. 신규 상태는 `received|planned`; `received→planned|cancelled`, `planned→working|blocked|cancelled`, `working→blocked|completed|cancelled`, `blocked→planned|working|cancelled`만 허용합니다. `completed|cancelled`은 종료 상태입니다.
- `portalNoticeList` → `{notices}`. 입주민·동대표에게는 visibility, `published`, 발행일·만료일 조건을 모두 통과한 행만 반환합니다.
- `portalNoticeSave` → `{notice,replayed,auditPending}`. `published` 전환과 발행 후 변경에는 `notices.publish`가 필요합니다.
- `portalCostList` → `{costs}`. `costs.view`가 없으면 호출 자체를 거부합니다.
- `portalCostSave` → `{cost,replayed,auditPending}`. 신규 행은 `draft|submitted`로 만들 수 있고 기존 행은 `draft` 상태에서만 수정·제출할 수 있습니다. 제출 뒤 정정은 관리소장이 취소한 후 새 비용으로 다시 등록합니다.
- `portalCostApprove` payload는 `{requestId,costId,targetState,revision}`이며 `submitted→approved|cancelled`, `approved→paid|cancelled`만 허용합니다.
- `portalReportSummary` payload는 `{startDate,endDate}`이며 최대 366일입니다. 날짜는 현장 운영 기준인 한국시간으로 집계합니다. 응답은 `{report:{startDate,endDate,counts,statusByState,workOrdersByStatus,noticesByState}}`이고, `reports.view` 사용자는 공개 범위를 통과한 작업지시의 집계만 받습니다. `costs.view`가 있을 때만 `counts.costs`와 부가세를 반영한 `totalAmountKrw`(취소 제외 등록액), `pendingAmountKrw`(초안·승인 요청), `approvedUnpaidAmountKrw`, `paidAmountKrw`, `amountKrwByStatus`가 추가됩니다. `taxMode=excluded`는 10% 부가세를 더하고 `included|exempt`는 입력 금액을 그대로 사용합니다.

`requests.view`는 기존 관리사무소 PIN 접수 화면/링크를 위한 capability입니다. 이 포털은 접수 원본이나 사진을 복제하지 않으며 기존 `apps-script/OfficeIntake.gs` relay의 `APP_TOKEN`, PIN 세션, Drive 파일에 직접 접근하지 않습니다.

공개 오류 코드는 `not-configured`, `invalid-input`, `invalid-credentials`, `rate-limited`, `session-expired`, `forbidden`, `last-admin`, `not-found`, `bad-request`, `server-error` 중 하나입니다. 잘못된 단지·이메일·인증번호는 `invalid-credentials`로 통일하고, 5회 실패 잠금과 전역 제한은 `rate-limited`로 응답합니다.

## 운영 및 배포 경계

- `.gs` 소스의 GitHub 배포는 Apps Script 운영 배포를 갱신하지 않습니다. Apps Script에서 새 버전을 배포한 뒤 실제 `/exec` 응답을 별도로 확인해야 합니다.
- `portalSetupSheets_`, `portalBootstrapFromProperties_`, `portalSetLoginCodeFromProperties_`는 웹 action allowlist에 없으므로 편집기 소유자만 실행할 수 있습니다.
- Sheets 헤더가 예상 스키마와 다르면 쓰기를 계속하지 않고 `not-configured`로 중단합니다.
- v2 배포를 v3로 업그레이드할 때는 새 버전 배포 전에 편집기에서 `portalSetupSheets_()`를 실행해 `Users` 뒤에 인증번호 보안 열을 추가합니다. 기존 열과 행은 삭제하거나 이동하지 않습니다. 이어 임시 `OFFICE_PORTAL_BOOTSTRAP_SLUG`, `OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL`, `OFFICE_PORTAL_BOOTSTRAP_LOGIN_CODE`를 설정하고 `portalSetLoginCodeFromProperties_()`를 실행합니다. 성공 시 임시 속성은 즉시 삭제됩니다.
- 비밀 교체 시 기존 세션은 즉시 무효화됩니다. 사용자 권한·역할 변경도 버전 불일치로 기존 세션을 무효화합니다.

### 인증 행 보관 정리

`portalPruneExpiredAuthRows_()`는 웹 action이 아닌 편집기/트리거 전용 함수입니다. 만료·사용·폐기된 OTP challenge는 마지막 종료 시점 7일 후, 만료·폐기된 session은 마지막 종료 시점 30일 후 뒤에서부터 삭제합니다. `PortalOperations`는 `complete` 상태로 90일이 지난 행만 삭제하며 `started`, `primary_committed`, `audit_pending`은 기간과 관계없이 보존합니다. 반환값은 종류별 삭제 건수와 실행 시각뿐이며 이메일·사용자 ID·토큰 같은 식별자를 포함하지 않습니다. 운영 상태·일지·작업지시·공지·비용·감사 행은 이 함수가 삭제하지 않습니다.

Apps Script 왼쪽의 **트리거 → 트리거 추가**에서 실행 함수 `portalPruneExpiredAuthRows_`, 이벤트 소스 **시간 기반**, 주기 **일일**로 등록하는 것을 권장합니다. 최초 등록과 권한 승인은 프로젝트 소유자가 직접 수행하세요.

### 쓰기 재시도와 감사 복구

Sheets는 트랜잭션을 제공하지 않으므로 포털은 권한·revision·상태 전이·연결 대상을 먼저 검증한 뒤, primary row를 쓰기 전에 `PortalOperations`에 `requestId`, 클라이언트 정규화 입력 해시, 미리 확정한 entity ID를 기록합니다. 거부된 입력은 `started` 행을 만들지 않습니다. primary row 이후 감사 append가 실패해도 API는 저장 결과와 `auditPending:true`를 반환하며, 같은 `requestId` 재전송은 새 행을 만들지 않고 deterministic audit ID로 누락 감사를 보완합니다. 담당자를 생략한 작업지시 수정은 현재 담당자가 바뀌어도 같은 요청 해시를 유지합니다. 운영 중 남은 `audit_pending`은 웹 action이 아닌 `portalRepairPendingOperationAudits_()`를 편집기에서 실행해 복구할 수 있습니다.

`portalRepairPendingOperationAudits_()`도 일일 시간 기반 트리거로 등록하는 것을 권장합니다. 반환값은 복구·잔여 건수와 실행 시각뿐입니다. `PortalOperations`에는 이메일·본문·입력 원문을 저장하지 않고 해시와 내부 ID만 저장합니다.

## 로컬 검증

저장소 루트에서 실행합니다.

```powershell
node tests/office-portal-pure.unit.js
node tests/office-portal-server.unit.js
node tests/run-all.js office-portal
```

Node VM 테스트는 Apps Script API를 메모리 mock으로 바꿔 인증번호 평문 비저장, 5회 실패 잠금, 세션 해시 저장, 권한 ceiling, 단지 격리, 가시성 redaction, 마지막 관리자 보호와 logout을 확인합니다. 실제 계정 로그인·Google 권한 동의·Apps Script 새 버전 배포 여부는 Google 계정에서 별도로 확인해야 합니다.
