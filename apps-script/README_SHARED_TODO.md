# 현장별 회사 공유 할일 서버 v1

`SharedTodo.gs`는 기존 사진 중계 Apps Script 프로젝트에 추가하는 **내부 공유 할일 전용 모듈**이다.
기존 `Code.gs`에는 `checkToken_` 성공 후의 조건부 dispatch 한 줄만 추가한다.
기존 relay action, OfficeIntake, `DATA_FILE_NAME`, 사진·견적·장부 파일은 바꾸지 않는다.
웹 GitHub Pages 배포와 Apps Script 운영 배포는 서로 별개다.

## 권한과 범위

- 기존 `APP_TOKEN`과 `DRIVE_FOLDER_ID`를 그대로 사용한다. 새 스크립트 속성이나 계정은 만들지 않는다.
- 같은 회사 토큰을 가진 기기는 모든 공유 할일을 읽고 입력·수정·완료·삭제할 수 있다.
- `deviceId`는 변경 기기 표시이지 검증된 직원 계정이 아니다. 직원별 읽기 전용·관리자 역할 기능은 아니다.
- 기기별 토큰 해제나 교체는 기존 서버 연결 관리 방식에 따른다. 토큰·실제 고객 자료를 공개 저장소, 문서, 테스트 로그에 넣지 않는다.
- 기존 개인 할일/메모를 자동 이전하거나 회사 전체에 자동 공개하지 않는다.

## POST 계약

기존 중계와 같은 `text/plain` JSON 요청 본문을 사용한다.
아래 값은 형식 설명이다. 운영 토큰을 URL query 또는 로그에 넣지 않는다.

```js
{
  action: 'sharedTodoSave',
  token: '<기기에 저장된 기존 회사 인증키>',
  deviceId: 'device-example',
  ts: Date.now(),
  payload: {
    requestId: '<새 UUID>',
    expectedRevision: 0,
    task: { id: '<새 UUID>', project: '현장명', text: '할일', done: false }
  }
}
```

`doPost`의 기존 ±10분 요청 시각 검사와 `checkToken_` 검사를 모두 통과해야 한다.
잠금 대기 중 인증키가 폐기되는 경우도 막도록 ScriptLock 획득 직후 인증을 다시 확인한다.
`deviceId`는 영문·숫자·`.`·`_`·`:`·`-` 1–64자, UUID는 소문자 정규 UUID 문자열이다.
프로젝트는 1–160자, 내용은 1–500자이며 공백만 있는 글이나 제어문자는 거절한다.
모르는 필드, caller 지정 Drive 폴더/파일 ID, 고객 연락처 등 자동 확장 필드는 받지 않는다.

| action | payload | 성공 반환 |
|---|---|---|
| `sharedTodoHealth` | `{}` | `{ok:true, version:'shared-todo-v1'}` |
| `sharedTodoList` | `{}` | `{ok:true, version, storeRevision, tasks}` |
| `sharedTodoSave` | `{requestId, expectedRevision, task:{id,project,text,done}}` | `{ok:true, version, storeRevision, task}` |
| `sharedTodoDelete` | `{requestId, expectedRevision, id}` | `{ok:true, version, storeRevision, task}`; `task.deleted:true` |
| `sharedTodoBackupList` | `{cursor?}` | `{ok:true, version, storeRevision, backups, nextCursor}` |
| `sharedTodoBackupCreate` | `{requestId, expectedStoreRevision}` | `{ok:true, version, storeRevision, backup}` |
| `sharedTodoRestore` | `{requestId, expectedStoreRevision, backupId}` | `{ok:true, version, storeRevision, restoredCount, safetyBackupId}` |

새 할일은 `expectedRevision:0`, 수정·완료·삭제는 조회한 해당 할일의 revision을 보낸다.
할일 결과는 `{id,project,text,done,revision,createdAt,updatedAt,updatedBy}`이다.
시간은 서버 UTC ISO 형식이며, revision은 1부터 시작한다. 삭제 결과에만 `deleted:true`가 붙는다.
목록은 삭제된 할일을 제외하고 모든 현장의 현재 할일을 반환한다. 정렬·현장 필터는 웹에서 한다.

## 동시 변경과 재시도

현장/할일 단위 revision을 확인하므로 A 기기와 B 기기가 서로 다른 할일을 바꿔도 저장할 수 있다.
같은 할일의 오래된 버전을 쓰면 `{ok:false,error:'conflict',current:<최신 할일 또는 null>}`로 거절한다.
클라이언트는 입력 중인 글을 보존하고 최신본을 보여 줘야 하며 자동 덮어쓰기를 해서는 안 된다.

모든 변경은 **하나의 ScriptLock 안에서 읽기 → revision 검사 → 변경 후보 검증 → 변경 전 전체 백업·읽기 검증 → 성공 영수증을 포함한 단일 파일 쓰기·읽기 검증**으로 진행한다.
쓰기 후 별도 description에 revision이나 receipt를 쓰지 않는다. 파일 내용과 메타데이터가 어긋나는 경로를 만들지 않는다.
응답을 못 받은 재시도는 같은 `requestId`, 같은 작업/action/payload, 같은 deviceId를 사용하되 `ts`는 새로 보낸다.
최근 성공 요청의 경우 저장된 성공 응답을 그대로 반환하므로 중복 생성·재완료·재삭제하지 않는다.
같은 requestId에 다른 내용이나 다른 deviceId를 보내면 `request-conflict`다.

영수증은 최근 **2,048개 성공 변경**을 보관한다. 이 범위를 지난 재시도의 원래 응답은 보장하지 않는다.
그러나 이전 revision과 삭제표식을 유지하므로 오래된 동일 변경이 다시 적용되는 대신 충돌로 중단된다.
오래된 요청을 임의의 새 requestId/revision으로 다시 써서 충돌을 우회하지 않는다.

## 전용 저장과 한계

설정된 Drive 루트 하위의 고정 경로:

`_현장_공유할일/현장_공유할일_v1.json`

기본 내용은 `{schema:1,revision,tasks,receipts}`이다. 전체 복원을 실행한 저장소는
`{schema:2,revision,tasks,receipts,restoreCount,restores}`로 확장한다. 기존 메인 JSON과 독립이며 사진 업로드 목록에도 포함하지 않는다.
`health`·`list`는 저장 파일/폴더를 만들지 않는다. 첫 성공 변경 때만 전용 저장소를 생성한다.
동일 이름의 폴더나 파일이 여러 개면 임의 선택하지 않고 `store-ambiguous`로 중단한다.
JSON 손상·잘못된 schema·중복 ID·잘못된 revision/receipt는 `store-corrupt`로 중단한다. 자동 초기화하지 않는다.
Drive 저장 장애로 내용 자체가 손상된 경우에도 재시도로 초기화하지 않는다. 관리자가 안전 백업을 확인해 복구해야 한다.

- tasks 최대 5,000건이며 삭제표식도 포함한다. ID 재사용을 막기 위해 삭제표식을 자동 제거하지 않는다.
- JSON은 최대 `6 * 1024 * 1024` **문자**다(UTF-8 바이트 또는 Drive 용량 제한과 같지 않다).
- 상한 도달 시 `store-full`로 변경을 거절한다. 기존 자료를 잘라 내거나 오래된 할일을 자동 삭제하지 않는다.
- 기존 파일이 읽기 상한을 넘으면 `store-too-large`로 중단한다.
- 잠금 대기 20초 초과는 `busy`, 기타 Drive/서버 오류는 내용 노출 없는 `server-error`다.
- 별도의 실시간 Push 서버는 없다. 웹의 주기적 조회/수동 새로고침이 타 기기 변경을 반영한다.
- 기존 장부 백업·복구와 독립된 공유 할일 전용 백업 경로를 사용한다.

## 공유 할일 자동 백업과 전체 복원

공유 할일 변경이 실제 적용되는 `Save`/`Delete`마다 전용 하위 폴더
`_현장_공유할일/_공유할일_백업/`에 변경 전 상태를 생성한다. 최초 생성 전의 빈 상태도 포함한다.
파일명은 `r{revision}_{reason}_{requestId}.json`이다. reason은 `manual`, `before-save`,
`before-delete`, `before-restore` 중 하나이며 파일 내용에 서버 UTC `createdAt`을 기록한다.
백업에는 현재 저장소의 **모든 tasks(삭제표식 포함), 모든 보관 receipts, 복원 기록**과 SHA-256
검증값을 함께 담는다. 백업 내용은 생성 후 수정·자동 정리·휴지통 이동·삭제하지 않는다.
동일 요청 재시도는 기존 파일을 검증해 재사용한다. 생성 확인 응답뿐 아니라 실제 저장된 내용을
다시 읽어 일치해야 본 파일을 쓴다. 백업 생성/읽기/일치 검사에 실패하면 본 파일 변경을 중단한다.
본 파일도 쓰기 후 내용을 다시 확인하므로 `setContent`의 거짓 성공을 완료로 보고하지 않는다.

`backups` 항목은 `{id,createdAt,storeRevision,taskCount,reason}`이다. taskCount는 삭제표식을 제외한
전체 공유 할일 수다. `id`는 위 전용 백업 파일명이며 caller 지정 Drive fileId를 받지 않는다.
목록은 한 번에 최대 100개 파일을 확인하며 `nextCursor`가 있으면 같은 action에 `cursor`로 전달한다.
각 페이지 안에서 날짜 내림차순으로 정렬한다. Drive iterator 전체가 최신순이라는 보장은 없으며
클라이언트는 여러 페이지를 합쳐 정렬한다. 커서는 만료될 수 있고 다른 폴더의 커서로 해당 폴더
자료를 노출하지 않는다. 손상된 백업은 복원 가능한 목록에서 제외하지만 파일은 보존한다.

수동 백업과 복원에는 목록에서 확인한 `expectedStoreRevision`이 필요하다. 잠금을 잡은 뒤 값이
달라졌으면 `{ok:false,error:'conflict',storeRevision}`로 중단한다. 재확인 없이 revision을 바꿔 자동
재전송하지 않는다. 수동 백업은 본 파일의 revision이나 task 내용을 변경하지 않는다.

복원은 **모든 현장의 현재 활성 할일 목록을 선택 백업의 활성 할일 목록으로 교체**한다.
현재 활성 할일은 삭제표식으로 유지하고 선택 백업의 활성 할일은 **새 ID로 등록**한다.
내용·현장·완료 여부를 복원하며 새 항목의 생성/변경 시각은 복원 시각이다. 과거의 ID·revision을
되살리지 않아 오래된 기기의 대기 중 수정/삭제가 복원 자료에 적용되지 않는다. 기존 삭제표식은
그대로 유지한다. 복원 직전 전체 상태를 다시 안전 백업으로 만든 후에만 최종 저장한다.
되돌린 복원을 취소하려면 목록의 `복원 직전 안전 백업`을 선택해 다시 복원한다.

복원 중 각 삭제표식·새 항목은 일반 작업과 같은 내부 영수증을 만들고 마지막에 복원 단위 revision을
1 올린다. 빈 목록을 빈 목록으로 복원해도 revision은 오른다. schema2에서는
`revision = task revision 합계 + restoreCount`이며 최근 128개의 전체 복원 응답을 별도 보관한다.
기존 2,048개 작업 영수증 정책은 유지한다. 복원 영수증은 이후 일반 저장·삭제에도 유지되며
동일 requestId/action/payload/deviceId 재시도에 같은 응답을 반환한다. 보관 범위를 지난 복원
재시도는 오래된 expectedStoreRevision으로 충돌한다. 복원으로 전체 task/문자 상한을 넘으면
자료를 버리지 않고 `store-full`로 중단한다.

웹의 `shared-todo-backup.js`는 전송 전에 일반 할일과 같은 연결별 IDB pending 슬롯을 CAS로 예약한다.
다른 탭의 공유 요청이 먼저 있으면 백업/복원을 보내지 않는다. 백업/복원 요청은 `schema:2`,
`source:'backup'`이며 사진·업무 자료·토큰을 넣지 않는다. 네트워크 실패나 응답 미확인 시 보관된
같은 요청으로 결과를 확인한다. UI 복원은 전체 범위 안내와 두 번째 확인을 거치며 사진 입력·모달
저장 중에는 열지 않는다. 기존 공유 화면은 백업 요청을 일반 작업으로 전송하지 않고 입력을 차단하며,
백업·복원 화면에서 재시도할 수 있다.

`backup-failed`, `backup-corrupt`, `backup-not-found`, `backup-ambiguous`, `backup-expired-cursor`는
내용을 노출하지 않는 전용 오류다. 현재 본 파일 자체가 손상되었으면 목록·복원도 `store-corrupt`로
중단한다. 손상된 파일에서 잃은 ID·revision을 임의 추정해 덮지 않으며, Drive에 보존된 백업으로
별도 복구 진단이 필요하다. 이 복원 기능은 정상적으로 읽히는 저장소의 잘못된 변경을 되돌리는 경로다.
첫 schema2 복원 이후 구 v1 서버로 롤백하면 schema2를 읽지 못해 공유 기능이 중단되므로,
롤백 시에도 schema2를 지원하는 서버 버전을 선택한다. 자료 파일을 지워 schema1로 초기화하지 않는다.

## 운영 배포 순서

1. 수정 대상이 **실제 현장 웹이 사용하는 중계 프로젝트 및 기존 `/exec` 배포**인지 확인한다. 직원 포털 전용 프로젝트와 혼동하지 않는다.
2. 현재 프로젝트 원본·기존 배포 버전을 저장소 밖 안전 경로에 보관한다. 토큰이나 속성값을 보고서에 출력하지 않는다.
3. `SharedTodo.gs`를 새 파일로 추가한다. 운영 Code가 로컬과 다르면 통째로 덮지 않고, 인증 성공 직후 아래 한 줄만 병합한다.

   ```js
   if (typeof sharedTodoIsAction_ === 'function' && typeof sharedTodoHandle_ === 'function' && sharedTodoIsAction_(action)) return out_(sharedTodoHandle_(action, req));
   ```

4. 기존 OfficeIntake·사진 중계·권한·Script Properties를 보존한다. 기존 배포를 새 버전으로 업데이트하여 URL을 유지한다.
5. 같은 기존 인증 흐름으로 legacy `health`(relay-v4)와 shared `sharedTodoHealth`를 **read-only** 확인한다.
6. `sharedTodoList`가 읽히고 목록 확인만으로 파일이 생기지 않는지 확인한다. 이 단계에서 실제 업무내용을 테스트용으로 만들지 않는다.
7. 웹은 서버 준비가 확인된 연결에서만 공유 입력을 열고, 구 서버/인증 실패/오프라인 상태를 명확히 구분한다.
8. 이후 사용자 실제 기기 두 대에서 현장 선택 → 할일 작성 → 다른 기기 조회 → 완료/수정 → 갱신을 검증한다.
   같은 할일 동시 수정, 응답 유실 뒤 재시도, 오프라인 입력 보존도 실제 운영 확인 항목이다.

롤백은 기존 Apps Script 배포 버전으로 되돌린다. 전용 JSON은 지우지 않는다.
서버가 구 버전이면 웹은 공유 기능을 사용할 수 없다고 안내하며 기존 개인 할일과 사진·장부 기능은 유지해야 한다.
조건부 dispatch는 모듈 누락으로 기존 relay 전체가 실패하지 않게 하지만, 두 파일이 모두 있어야 공유 기능이 동작한다.

## 검증

```bash
node tests/shared-todo-server.unit.js
node tests/shared-todo-server.unit.js --mutations
node tests/shared-todo-backup.unit.js --mutations
node tests/shared-todo-backup.e2e.js
node tests/run-all.js
```

서버 단위 검사는 실제 `Code.gs` + `SharedTodo.gs`를 모의 Drive/ScriptLock에서 실행한다.
인증·timestamp·입력 제한, 기기 간 생성/조회, 다른 할일 동시 저장, 같은 할일 충돌,
성공 응답 유실 복구, requestId 재사용 차단, 삭제표식, 잠금/저장 장애, 손상/중복 저장소,
상한, 모듈 미설치와 기존 load/save 보존을 검사한다.
`--mutations`는 원본 파일을 고치지 않고 메모리상 auth/revision/receipt/tombstone/write/lock 보호를 제거해 테스트 실패를 확인한다.
모의 검사 통과는 운영 Apps Script 배포·Drive 권한·실제 직원 기기 검증 완료와 다르다.

백업 단위 검사는 실제 서버 모듈로 백업 생성 실패/거짓 성공/부분 손상/응답 유실,
현재본 거짓 저장, 안전 백업 실패, 복원 경쟁·멱등 응답·삭제표식·schema2 후속 저장과 용량을 검사한다.
브라우저 검사는 가상 서버에서 전체 복원 2차 확인, 기기 재시작 후 동일 요청 재시도,
다른 탭 pending CAS, 사진/모달 보호, 로컬 자료 보존, 연결 변경 뒤 늦은 응답 차단을 검사한다.
`HJ_SHARED_BACKUP_MUTATION=confirm|pending|photo|backup-routing`는 브라우저 보호 변이이며 원본 파일을 바꾸지 않는다.
일반 공유 화면에서도 백업·복원 대기를 저장 공간 손상으로 표시하지 않고 백업 화면의 동일 요청
결과 확인으로 안내하는지, 일반 쓰기와 새로고침이 그 대기 기록을 훼손하지 않는지도 검사한다.
