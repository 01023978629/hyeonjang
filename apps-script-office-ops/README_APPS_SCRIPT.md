# OfficeOps 대표자 전용 운영 런북

이 디렉터리는 현장 relay 및 commercial approval 프로젝트와 분리된
OfficeOps Apps Script 소스입니다. 저장소의 문서·코드·커밋은 Script
Property, Drive 파일, Apps Script 프로젝트나 배포를 만들거나 변경할
권한이 아닙니다. 아래 절차도 각 외부 단계에 대한 별도 서면
representative approval 없이는 실행 권한을 부여하지 않습니다.

## 1. 사전 검증

1. 로컬 소스 체크아웃에서 OfficeOps pure/server/isolation 테스트와 전체
   hyeonjang 회귀 테스트를 실행합니다.
2. 정확한 검토 커밋, 테스트 명령, 결과, 실행 시각을 redacted checklist에
   기록합니다. 시각은 실제 달력에 존재하고 다시 파싱되는
   `YYYY-MM-DDTHH:mm:ss+09:00` 형식의 real strict KST여야 합니다.
3. 이 체크리스트는 준비 증거일 뿐이며 프로젝트 생성, 파일 생성, property
   설정, 계정 설정, 배포 또는 활성화를 승인하지 않습니다.
4. 아래 절차의 외부 단계마다 대표자의 별도 서면 승인을 확인하고, 승인
   범위와 승인 시각을 따로 기록합니다.

## 2. 새 프로젝트 초기화

별도 서면 승인 후 대표자가 직접 `apps-script-office-ops/` 소스로 **새
standalone Apps Script 프로젝트**를 만듭니다. 현장 relay 또는 commercial
approval 프로젝트에 이 소스를 복사하거나 합치지 않습니다.

대표자는 새 프로젝트용으로 정확히 하나의 non-trashed
`application/json` UTF-8 파일 `관리사무소영업운영.json`을 새로 만듭니다.
초기 문서는 정확히 `schemaVersion: 1`, `revision: 0`, 실제 생성 시각의
strict KST `updatedAt`, 그리고 빈 `pilots`, `consents`, `inspections`,
`opportunities`, `audit`만 포함합니다. 다음 값은 모양을 보여 주는
템플릿이므로 `<ACTUAL_CREATION_KST>`를 실제 생성 시각으로 바꾸기 전에는
저장하면 안 됩니다.

```json
{
  "schemaVersion": 1,
  "revision": 0,
  "updatedAt": "<ACTUAL_CREATION_KST>",
  "pilots": [],
  "consents": [],
  "inspections": [],
  "opportunities": [],
  "audit": []
}
```

새 파일 ID와 기존 현장 데이터 파일 ID 및 기존 OfficeIntake 파일 ID를
redacted checklist에 각각 기록합니다. 새 ID가 두 기존 ID와 모두 다름을
두 번의 명시적 비교로 확인합니다. 새 프로젝트의
`OFFICE_OPS_FILE_ID`에는 새 파일의 정확한 ID만 입력합니다.

허용되는 Script Property 이름은 다음 네 개뿐입니다.

<!-- OFFICE_OPS_PROPERTIES_START -->
- `OFFICE_OPS_FILE_ID`
- `OFFICE_OPS_ENABLED`
- `OFFICE_OPS_RECOVERY_REQUIRED`
- `OFFICE_OPS_TOKEN`
<!-- OFFICE_OPS_PROPERTIES_END -->

- `OFFICE_OPS_FILE_ID`: 위에서 만든 새 JSON 파일의 정확한 ID
- `OFFICE_OPS_ENABLED`: 초기값 `0`
- `OFFICE_OPS_RECOVERY_REQUIRED`: 초기값 `0`
- `OFFICE_OPS_TOKEN`: 다른 프로젝트에서 재사용하지 않는 별도 내부 token

Token, 실제 파일 ID, 원문 데이터, PII는 저장소·공개 페이지·브라우저
공용 저장소·채팅·외부 체크리스트에 넣지 않습니다.

## 3. 비활성 배포

배포 자체에 대한 별도 서면 승인 후 대표자가 새 Apps Script web-app
version을 만들되 `OFFICE_OPS_ENABLED=0`,
`OFFICE_OPS_RECOVERY_REQUIRED=0`을 유지합니다. 공개 Office UI는 만들거나
연결하지 않습니다.

정확한 내부 token을 사용한 authenticated `officeOpsList`와 대표
non-conversion mutation 한 건이 모두 `office-disabled`로 실패함을
확인합니다. Drive read/write, backup, audit, revision 변화가 없어야 합니다.
배포 version, 실제 strict KST 검증 시각, 두 결과와 redacted pass/fail만
기록합니다. 비활성 배포는 활성화 승인이 아닙니다.

## 4. 별도 승인 후 OfficeOps 활성화

OfficeOps 자체 활성화에 대한 별도 서면 승인을 받은 뒤 대표자가 **오직**
`OFFICE_OPS_ENABLED`를 `1`로 바꿉니다. `OFFICE_OPS_RECOVERY_REQUIRED=0`
및 정확한 token을 확인하고 redacted list success path만 시험한 뒤 version,
실제 strict KST 시각, 결과를 기록합니다.

이 단계는 conversion을 활성화하지 않습니다. 배포, 복구 성공, 코드 merge,
일반 OfficeOps 활성화 어느 것도 conversion promotion 승인을 대신하지
않습니다.

## 5. 수동 복구

`manual-recovery-required`가 나오면 ordinary access를 즉시 중단합니다.
절대로 latch를 먼저 지우지 않습니다. `OFFICE_OPS_RECOVERY_REQUIRED=1`,
`OFFICE_OPS_ENABLED=0`을 그대로 유지하며, 허용 가능한 유일한 사용자
경로는 device-local cached read-only export입니다. 이 경로는 생성·수정·
연락·전환·전송을 해서는 안 됩니다.

대표자는 incident source의 **정확한 단일 parent** 안의 모든 파일을
열거합니다. 파일명 검색만 사용하지 않습니다. 각 후보에 대해 다음을
전부 재검증하여 complete pair만 남깁니다.

- source, backup, manifest ID가 모두 서로 다르고 각 handle의 실제 ID와
  일치하는지 확인합니다.
- backup과 manifest가 같은 정확한 parent의 non-trashed
  `application/json` 파일이고 두 이름이 정확한 한 쌍인지 확인합니다.
- manifest가 exact-key 문서이며 `sourceFileId`가 incident source ID,
  `backupFileId`가 그 backup의 ID인지 확인합니다.
- manifest의 `createdAt`이 real strict KST이고, `schemaVersion`,
  `preMutationRevision`, `byteLength`, lowercase SHA-256이 유효한지
  확인합니다.
- backup raw bytes를 다시 읽어 strict UTF-8/JSON, exact store schema,
  audit 연속성, revision 일치, byte length 일치, lowercase SHA-256 일치를
  모두 확인합니다. orphan, cross-parent, cross-source, forged, malformed,
  duplicate-ID 또는 일부만 맞는 후보는 제외합니다.

모든 complete pair를 다음 exact key의 **내림차순**으로 정렬합니다.

`preMutationRevision → createdAt → backupFileId → manifestFileId`

첫 행이 필수 latest complete verified pair입니다. 정렬된 redacted candidate
table을 기록하고 더 최신의 complete pair가 없음을 입증합니다. 정상 쓰기
보존 정책은 latest ten verified backup pairs이지만, 복구 때는 남아 있는
모든 후보를 다시 열거·검증해야 합니다.

`point-in-time restore requires separate written approval`. 더 오래된 유효
pair를 선택하려면 요청 revision, 이유, 선택한 exact pair를 명시한 별도
서면 승인이 필요하며 정상 최신 복구 승인을 상속하지 않습니다.

선택한 backup raw bytes를 **새** JSON 파일에 복원합니다. incident source는
보존하고 덮어쓰거나 삭제하지 않습니다: do not delete the incident source file.
대표자가 새 파일을 가리키도록 `OFFICE_OPS_FILE_ID`를 수동 변경한
뒤에도 `OFFICE_OPS_ENABLED=0`, `OFFICE_OPS_RECOVERY_REQUIRED=1`을
유지합니다.

Apps Script editor에서 zero-argument editor-only
`ooRecoveryValidateSource_()`를 실행합니다. 이 함수는 action allowlist에
없으며 파일/property를 쓰지 않습니다. throw 또는 아래 비교 하나라도
불일치하면 즉시 중단합니다.

| Required comparison | Required exact equality |
| --- | --- |
| Manifest `sourceFileId` | incident old source ID |
| Manifest `backupFileId` | selected verified backup ID |
| Validator `sourceFileId` | new restored file ID and current `OFFICE_OPS_FILE_ID` |
| Validator `schemaVersion` | manifest `schemaVersion` |
| Validator `revision` | manifest `preMutationRevision` |
| Validator `byteLength` | manifest `byteLength` and re-read backup byte length |
| Validator `sha256Hex` | manifest and re-read backup lowercase SHA-256 |

The internal sanitized success tuple includes the exact `sourceFileId`.
The internal sanitized success tuple contains the exact `sourceFileId` and no
token, source bytes, or PII. The sanitized validator log is editor-only evidence.
External checklists and reports use redacted IDs only.

모든 비교를 기록한 다음에만 latch 해제에 대한 **새로운 별도 서면 승인**을
받아 `OFFICE_OPS_RECOVERY_REQUIRED`를 `0`으로 바꿉니다. 이후
`OFFICE_OPS_ENABLED`를 `1`로 바꾸려면 또 다른 별도 승인이 필요합니다.
복구 성공은 두 변경 중 어느 것도 자동 승인하지 않습니다.

## 6. 전환 promotion

서버의 전체 허용 action 목록은 다음 21개뿐입니다.

<!-- OFFICE_OPS_ACTIONS_START -->
- `officeOpsList`
- `officePilotCreate`
- `officePilotUpdate`
- `officePilotArchive`
- `officeConsentRecord`
- `officeConsentWithdraw`
- `officeInspectionCreate`
- `officeInspectionUpdate`
- `officeInspectionArchive`
- `officeInspectionBeginConversion`
- `officeInspectionArmLocalCommit`
- `officeInspectionRecordLocalCommit`
- `officeInspectionFinalizeConversion`
- `officeInspectionCancelConversion`
- `officeOpportunityCreate`
- `officeOpportunityUpdate`
- `officeOpportunityArchive`
- `officePilotRestore`
- `officeInspectionRestore`
- `officeOpportunityRestore`
- `officeOpsRetentionList`
<!-- OFFICE_OPS_ACTIONS_END -->

초기 `conversion-promotion.json`은 `schemaVersion=1`, `enabled=false`이며
`approvalEvidenceSha256`, `commercialRelayCommit`,
`commercialRelayVerifiedAtKst`, `browserConversionE2eCommit`,
`approvedAtKst`가 모두 `null`입니다. production
`function ooConversionOperationallyEnabled_(){return false;}`와 marker는
항상 일치해야 합니다.

이 상태에서는 다섯 conversion action이 모두 `conversion-disabled`이며
Drive read/write, backup, audit, revision 변화가 없습니다. 올바르게 활성화된
일반 OfficeOps의 read와 non-conversion mutation은 계속 시험할 수 있습니다.

Promotion은 actual commercial relay verification과 browser conversion/resume E2E가
모두 통과하고, conversion에 대한 별도 서면 승인이 있을 때만 가능합니다.
미래 promotion commit은 exactly two production artifacts만 함께 바꿉니다.

1. `ooConversionOperationallyEnabled_(){return false;}`의 literal을
   `true`로 변경합니다.
2. `conversion-promotion.json`을 `enabled:true`로 바꾸고, 별도로
   보관된 서면 승인 원문의 lowercase 64-hex `approvalEvidenceSha256`,
   실제 검토된 lowercase 40-hex `commercialRelayCommit`, 실제 commercial
   검증 시각 `commercialRelayVerifiedAtKst`, 실제 검토된 lowercase
   40-hex `browserConversionE2eCommit`, 실제 승인 시각 `approvedAtKst`를
   기록합니다. 두 시각은 real strict KST이고 승인 시각은 검증 시각보다
   빠를 수 없습니다.

Promotion changes no test, Script Property, action allowlist, or other source.
승인 원문·token·secret·PII·evidence bytes는 저장소에 넣지 않고 승인 원문의
SHA-256만 기록합니다. 변경되지 않은 static/server/browser suite가
marker/literal parity 및 disabled/enabled 경로를 모두 통과한 다음, 검토된
promotion commit과 별도 승인된 deployment version을 기록합니다.

## 7. rollback

Conversion rollback도 exactly two production artifacts만 반대로 바꿉니다.

1. gate literal을 `false`로 되돌립니다.
2. `conversion-promotion.json`을 `enabled:false`로 되돌리고 다섯 evidence
   필드를 모두 `null`로 되돌립니다.

Rollback은 test, Script Property, action allowlist 또는 다른 source를
바꾸지 않으며 token/latch/enabled gate를 약화하지 않습니다. 이전 web-app
version으로 돌아가는 code rollback 또는 새 version 재배포는 각각 별도
외부 승인이 필요합니다. incident source와 verified pair를 덮어쓰거나
삭제하지 않습니다.

## 8. 금지 작업

이 런북, marker, 테스트, 저장소 변경은 다음 어느 것도 승인하지 않습니다.

- Script Property 조회·생성·수정·삭제
- Drive 파일 조회·생성·수정·이동·삭제·복원
- Apps Script 프로젝트·계정 설정·OAuth·deployment 생성 또는 변경
- Git push, merge, static-site/Pages 배포 또는 외부 network fetch
- 자동 email/calendar 작업, 고객·입주민·관리사무소 notification/message
- order 또는 `aptOrder` 생성, 유료 서비스 설정
- 공개 Office UI 연결, production conversion 실행

외부 실행은 매 단계의 정확한 대상·범위·시각을 적은 별도 서면 대표자
승인 뒤에만 수동으로 진행합니다.
