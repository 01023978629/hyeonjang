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

새 할일은 `expectedRevision:0`, 수정·완료·삭제는 조회한 해당 할일의 revision을 보낸다.
할일 결과는 `{id,project,text,done,revision,createdAt,updatedAt,updatedBy}`이다.
시간은 서버 UTC ISO 형식이며, revision은 1부터 시작한다. 삭제 결과에만 `deleted:true`가 붙는다.
목록은 삭제된 할일을 제외하고 모든 현장의 현재 할일을 반환한다. 정렬·현장 필터는 웹에서 한다.

## 동시 변경과 재시도

현장/할일 단위 revision을 확인하므로 A 기기와 B 기기가 서로 다른 할일을 바꿔도 저장할 수 있다.
같은 할일의 오래된 버전을 쓰면 `{ok:false,error:'conflict',current:<최신 할일 또는 null>}`로 거절한다.
클라이언트는 입력 중인 글을 보존하고 최신본을 보여 줘야 하며 자동 덮어쓰기를 해서는 안 된다.

모든 변경은 **하나의 ScriptLock 안에서 읽기 → revision 검사 → 변경 → 성공 영수증 기록 → 단일 파일 내용 쓰기**로 진행한다.
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

내용은 `{schema:1,revision,tasks,receipts}`이다. 기존 메인 JSON과 독립이며 사진 업로드 목록에도 포함하지 않는다.
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
- 기존 장부 백업·복구 대상에 이 전용 파일을 몰래 추가하지 않는다. 관리자가 전용 파일을 별도로 백업해야 한다.

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
node tests/run-all.js
```

서버 단위 검사는 실제 `Code.gs` + `SharedTodo.gs`를 모의 Drive/ScriptLock에서 실행한다.
인증·timestamp·입력 제한, 기기 간 생성/조회, 다른 할일 동시 저장, 같은 할일 충돌,
성공 응답 유실 복구, requestId 재사용 차단, 삭제표식, 잠금/저장 장애, 손상/중복 저장소,
상한, 모듈 미설치와 기존 load/save 보존을 검사한다.
`--mutations`는 원본 파일을 고치지 않고 메모리상 auth/revision/receipt/tombstone/write/lock 보호를 제거해 테스트 실패를 확인한다.
모의 검사 통과는 운영 Apps Script 배포·Drive 권한·실제 직원 기기 검증 완료와 다르다.
