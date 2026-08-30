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
      "approvedTermsSha256": "fake-sha256-terms-0001", "approvalEvidenceType": "quote-file",
      "approvalEvidenceFileId": "fake-evidence-file-0001", "approvalEvidenceSha256": "fake-sha256-evidence-0001",
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
  "verifyExpiresAtKst": "<runtimeNowKst-plus-60-seconds>"
}
```

commercialApprovalVerify failure response:
```json
{ "ok": false, "error": "nonce-replay" }
```

승인 evidence는 `application/pdf`, `image/jpeg`, `image/png`만 허용하며 **20 MiB** 이하이어야 한다. verify nonce cache는 **60 seconds** 동안 유지되고 같은 receipt+nonce 재사용(nonce replay)은 거절된다. `COMMERCIAL_APPROVAL_TOKEN`은 요청 인증 전용, `COMMERCIAL_APPROVAL_RECEIPT_KEY`는 receipt HMAC 전용으로 분리한다.

## 롤백과 기록
이상 시 Gate 7을 수행하고 `commercial-disabled` fail-closed 응답을 확인한다. 승인 기록에는 deployment version·test date·pass/fail만 남기며 실제 비밀값·evidence 식별자·고객 정보·browser token은 기록·커밋·공유하지 않는다.
