# Commercial approval relay 운영 체크리스트

이 문서는 `apps-script-commercial/`을 별도 Apps Script 웹 앱으로 검증하고 대표자 승인 후에만 commercial relay를 활성화하는 절차다. 저장소 검증과 대표자 계정·Script Property·Drive evidence·Apps Script deployment·activation은 분리한다.

## 정확한 7개 게이트 순서

### Gate 1 — 브랜치 검증
브랜치에서 `commercial-approval.unit.js`, `commercial-approval-server.unit.js`, `commercial-approval-isolation.check.js` 세 commercial test를 모두 실행하고 GREEN을 기록한다.

### Gate 2 — 새 프로젝트
대표자가 **new standalone Apps Script project**를 만들고 `apps-script-commercial/`만 복사한다. 기존 운영 프로젝트나 relay 파일은 재사용하지 않는다.

### Gate 3 — 분리된 properties
대표자가 새 프로젝트에 `COMMERCIAL_APPROVAL_ENABLED`, `COMMERCIAL_APPROVAL_TOKEN`, `COMMERCIAL_APPROVAL_RECEIPT_KEY`를 각각 별도 property로 만든다. 값은 repository 파일에 붙여넣지 않으며 token과 receipt HMAC key는 서로 다른 값이어야 한다.

### Gate 4 — disabled deployment과 `commercialNow`
대표자가 `COMMERCIAL_APPROVAL_ENABLED=0`으로 둔 채 new web-app version을 배포하고 redacted test client로 `commercialNow`를 확인한다. 비밀값을 출력하거나 저장하지 않는다.

### Gate 5 — non-production evidence 검증
대표자가 paid-work client path를 활성화하지 않은 상태에서 deliberately created non-production PDF로 issue/verify를 확인한다. 실제 고객 자료를 쓰지 않는 이유는 격리된 테스트를 보장하기 위해서이며 production validator 자체는 PDF/JPEG/PNG 파일을 **20 MiB** 이하로 허용한다.

### Gate 6 — 서면 승인 후 activation
별도의 **separate written representative approval**을 받은 뒤에만 flag to `1`로 바꾼다. 기록에는 deployment version, test date, pass/fail만 남긴다.

### Gate 7 — rollback/disable
비활성화할 때는 flag to `0`으로 되돌리거나 prior Apps Script deployment를 선택한다. disabled 상태에서 `commercialApprovalIssue`와 `commercialApprovalVerify`만 fail-closed이며, `commercialNow`는 Gate 4 health/time 확인용으로 계속 가능하다.

## 이 Task가 승인하지 않는 외부 작업
이 repository task는 Drive evidence selection, Script Property creation, Apps Script deployment, browser token storage, Pages publication, paid-work activation, push, merge, PR, customer contact, paid-service configuration을 승인하지 않는다. 실제 token, key, file ID, customer data는 문서·커밋·로그에 쓰지 않는다.

## Shape-only fake response examples (not executable)

아래 JSON은 필드 모양을 설명하기 위한 **test-only/redacted** 예시이며 **not executable**이다. 고정된 fake token, HMAC, receipt, file ID는 실제 property 값, **server-issued receipt**, **runtime Drive file ID**가 아니므로 production failure trigger로 사용하지 않는다.

## 공통 POST envelope와 실패 응답
각 요청은 아래 공통 envelope를 완전히 포함한다. `token`은 Script Property 인증용이고 `timestamp`는 신선도 검증용이다.

```json
{
  "token": "fake-commercial-token-for-docs-only",
  "action": "<one action below>",
  "timestamp": "<runtimeNowKst>",
  "payload": "<action payload below>"
}
```

문서 예시의 `<runtimeNowKst>`는 아래 helper로 요청 직전에 생성한 현재 KST timestamp이며, `validUntil`도 helper 결과의 오늘 또는 이후 날짜를 사용한다. 모든 실패는 action별 complete response `{ "ok": false, "error": "<actual-code>" }`이며, disabled는 `commercial-disabled`, 재사용 nonce는 `nonce replay` 오류로 fail-closed 처리한다.

```js
const now = new Date();
const runtimeNowKst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(now).replace(' ', 'T') + '+09:00';
const validUntil = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short' }).format(now).replaceAll('/', '-');
```

### `commercialNow` complete envelope
```json
{
  "token": "fake-commercial-token-for-docs-only",
  "action": "commercialNow",
  "timestamp": "<runtimeNowKst>",
  "payload": { "nonce": "fake-commercialNow-nonce-0001" }
}
```
성공 response:
```json
{
  "ok": true,
  "serverNowKst": "<runtimeNowKst>",
  "receivedAtKst": "<runtimeNowKst>",
  "nonce": "fake-commercialNow-nonce-0001"
}
```

commercialNow failure response:
```json
{ "ok": false, "error": "invalid-nonce" }
```

### `commercialApprovalIssue` complete envelope
```json
{
  "token": "fake-commercial-token-for-docs-only",
  "action": "commercialApprovalIssue",
  "timestamp": "<runtimeNowKst>",
  "payload": {
    "subjectType": "aptOrder", "subjectId": "fake-apt-order-0001",
    "commercialTerms": {
      "workKind": "dispatch", "scope": "fake non-production scope",
      "exclusions": ["fake exclusion"], "vatMode": "included", "quotedAmount": 1000,
      "validUntil": "<validUntil>", "scheduleWindow": "fake test window"
    },
    "approvalEvidenceType": "quote-file", "approvalEvidenceFileId": "fake-evidence-file-0001",
    "approvedAt": "<runtimeNowKst>", "approvedByRole": "customer"
  }
}
```
성공 response:
```json
{
  "ok": true,
  "commercialApproval": {
    "receiptId": "receipt_fake-0001", "subjectType": "aptOrder", "subjectId": "fake-apt-order-0001",
    "approvedTermsSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "approvalEvidenceType": "quote-file",
    "approvalEvidenceFileId": "fake-evidence-file-0001", "approvalEvidenceSha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    "approvedAt": "<runtimeNowKst>", "approvedByRole": "customer",
    "issuedAt": "<runtimeNowKst>", "receiptHmac": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
  }
}
```

commercialApprovalIssue failure response:
```json
{ "ok": false, "error": "forbidden-evidence" }
```

### `commercialApprovalVerify` complete envelope
```json
{
  "token": "fake-commercial-token-for-docs-only",
  "action": "commercialApprovalVerify",
  "timestamp": "<runtimeNowKst>",
  "payload": {
    "subjectType": "aptOrder", "subjectId": "fake-apt-order-0001",
    "commercialTerms": {
      "workKind": "dispatch", "scope": "fake non-production scope",
      "exclusions": ["fake exclusion"], "vatMode": "included", "quotedAmount": 1000,
      "validUntil": "<validUntil>", "scheduleWindow": "fake test window"
    },
    "commercialApproval": {
      "receiptId": "receipt_fake-0001", "subjectType": "aptOrder", "subjectId": "fake-apt-order-0001",
      "approvedTermsSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "approvalEvidenceType": "quote-file",
      "approvalEvidenceFileId": "fake-evidence-file-0001", "approvalEvidenceSha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "approvedAt": "<runtimeNowKst>", "approvedByRole": "customer",
      "issuedAt": "<runtimeNowKst>", "receiptHmac": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    },
    "nonce": "fake-commercialVerify-nonce-0001"
  }
}
```
성공 response (ACK):
```json
{
  "ok": true, "receiptId": "receipt_fake-0001",
  "serverNowKst": "<runtimeNowKst>",
  "nonce": "fake-commercialVerify-nonce-0001",
  "verifyExpiresAtKst": "2026-08-31T12:01:00+09:00"
}
```

commercialApprovalVerify failure response:
```json
{ "ok": false, "error": "nonce-replay" }
```

## Executable controlled failure procedures

이 절차는 대표자가 승인한 격리 deployment에서만 수행한다. 모든 입력은 **test-only/redacted**이고 **real token/key/file/customer data 금지**다. runtime token과 Drive ID는 repository 파일·커밋·공유 로그가 아닌 **repository-external variable**에만 둔다. 이 repository task에서는 파일 생성, property 변경, 요청 전송 또는 cleanup을 실제로 수행하지 않는다.

### Executable: `commercialNow` invalid-nonce

Precondition: 새 test project의 **`COMMERCIAL_APPROVAL_TOKEN` test property**와 repository 밖의 **`TEST_COMMERCIAL_APPROVAL_TOKEN`** 값이 **exactly matches**여야 한다. 그렇지 않으면 production은 nonce를 보기 전에 `unauthorized`를 반환한다. 그 상태에서 아래 **complete request**의 **invalid nonce**를 보내야 `invalid-nonce`가 된다.

```js
const commercialNowFailureRequest = {
  token: TEST_COMMERCIAL_APPROVAL_TOKEN,
  action: 'commercialNow',
  timestamp: runtimeNowKst,
  payload: { nonce: 'bad nonce' }
};
```

commercialNow failure response:
```json
{ "ok": false, "error": "invalid-nonce" }
```

### Executable: `commercialApprovalIssue` forbidden-evidence

Precondition: 대표자가 접근 가능한 **existing deliberately-created non-production** **`application/json`** test file을 Drive에 준비한다. 그 파일의 **runtime exact Drive file ID**를 repository 밖의 **`TEST_FORBIDDEN_EVIDENCE_FILE_ID`** **repository-external variable**에 넣고, 실제 ID를 문서·커밋·로그에 넣지 않는다. 또한 격리 test project의 token이 위 변수와 일치하고 `COMMERCIAL_APPROVAL_ENABLED=1`이어야 한다. `0`이면 evidence 조회 전에 `commercial-disabled`가 반환된다.

그 다음 현재 KST와 test-only terms를 사용해 아래 **complete issue request**를 보낸다.

```js
const commercialApprovalIssueFailureRequest = {
  token: TEST_COMMERCIAL_APPROVAL_TOKEN,
  action: 'commercialApprovalIssue',
  timestamp: runtimeNowKst,
  payload: {
    subjectType: 'aptOrder',
    subjectId: 'test_only_apt_order_0001',
    commercialTerms: {
      workKind: 'dispatch',
      scope: 'test-only non-production scope',
      exclusions: ['test-only exclusion'],
      vatMode: 'included',
      quotedAmount: 1000,
      validUntil,
      scheduleWindow: 'test-only window'
    },
    approvalEvidenceType: 'quote-file',
    approvalEvidenceFileId: TEST_FORBIDDEN_EVIDENCE_FILE_ID,
    approvedAt: runtimeNowKst,
    approvedByRole: 'customer'
  }
};
```

Production은 먼저 **`DriveApp.getFileById`**로 ID를 조회한다. 존재하지 않거나 접근 불가능한 fake ID는 여기서 **`evidence-not-found`**가 되며 MIME 검증에 도달하지 않는다. 조회된 test file의 `application/json` MIME이 허용 목록 밖이므로 그 다음에만 **`forbidden-evidence`**가 된다.

commercialApprovalIssue failure response:
```json
{ "ok": false, "error": "forbidden-evidence" }
```

확인 후 대표자가 test file을 제거하고 `TEST_FORBIDDEN_EVIDENCE_FILE_ID`를 지우는 **cleanup**을 수행한다. cleanup 전후 어느 단계에서도 runtime ID를 repository나 공유 로그에 복사하지 않는다.

### Executable: `commercialApprovalVerify` nonce-replay

Precondition: 허용된 non-production PDF/JPEG/PNG에 대한 **successful issue response**에서 받은 **actual server-signed `commercialApproval`**을 그대로 사용하고, 그 receipt가 가리키는 **same evidence**가 접근 가능하고 바뀌지 않은 상태여야 한다. 한 개의 **same complete verify request**를 만들고 16–80자 형식의 **same nonce**를 유지한다.

**first verify**를 보내고 먼저 **`{ "ok": true, "receiptId": "<runtime receiptId>", "serverNowKst": "<runtime KST>", "nonce": "<same nonce>", "verifyExpiresAtKst": "<runtime KST>" }`** 성공을 확인한다. 어떠한 필드도 바꾸지 않은 **identical second request**를 즉시 다시 보낸다. 이 **second verify**만 **`{ "ok": false, "error": "nonce-replay" }`**가 되어야 한다.

```js
const completeVerifyRequest = {
  token: TEST_COMMERCIAL_APPROVAL_TOKEN,
  action: 'commercialApprovalVerify',
  timestamp: runtimeNowKst,
  payload: {
    subjectType: 'aptOrder',
    subjectId: testSubjectId,
    commercialTerms: issuedCommercialTerms,
    commercialApproval: issueResponse.commercialApproval,
    nonce: TEST_VERIFY_NONCE
  }
};
const firstVerifyResponse = postCommercialApproval(completeVerifyRequest);
if (firstVerifyResponse.ok !== true) throw new Error('first verify did not succeed');
const secondVerifyResponse = postCommercialApproval(completeVerifyRequest);
if (secondVerifyResponse.ok !== false || secondVerifyResponse.error !== 'nonce-replay') throw new Error('second verify did not detect replay');
```

Production 순서는 valid nonce → receipt 형식/HMAC → terms/subject/window → evidence 재조회/hash → nonce claim이다. 따라서 **shape-only fake receipt**나 고정 fake HMAC은 첫 성공 전에 `invalid-receipt`가 되어 replay trigger가 아니다. 확인 후 `TEST_VERIFY_NONCE` 등 runtime 변수를 지우고 flag를 `0`으로 되돌리는 **cleanup**을 수행한다.

승인 evidence는 `application/pdf`, `image/jpeg`, `image/png`만 허용하며 **20 MiB** 이하이어야 한다. verify nonce cache는 **60 seconds** 동안 유지되고 같은 receipt+nonce 재사용(nonce replay)은 거절된다. `COMMERCIAL_APPROVAL_TOKEN`은 요청 인증 전용, `COMMERCIAL_APPROVAL_RECEIPT_KEY`는 receipt HMAC 전용으로 분리한다.

## 롤백과 기록
이상 시 Gate 7을 수행하고 `commercial-disabled` fail-closed 응답을 확인한다. 승인 기록에는 deployment version·test date·pass/fail만 남기며 실제 비밀값·evidence 식별자·고객 정보·browser token은 기록·커밋·공유하지 않는다.
