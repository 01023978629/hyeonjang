# Commercial approval relay 운영 체크리스트

이 문서는 `apps-script-commercial/`을 별도 Apps Script 웹 앱으로 검증하고, 대표자 승인 후에만 commercial relay를 활성화하기 위한 운영 절차다. 이 저장소의 Task 4는 문서와 정적 assertion만 다루며, 아래의 대표자 통제 단계는 실행하지 않는다.

## 정확한 7개 게이트 순서

순서를 건너뛰거나 합치지 않는다. 저장소 검증과 대표자 계정·Script Property·Drive evidence·Apps Script deployment·activation 작업은 서로 다른 책임으로 기록한다.

1. **브랜치에서 세 commercial test 모두 실행한다.** `commercial-approval.unit.js`, `commercial-approval-server.unit.js`, `commercial-approval-isolation.check.js`가 모두 GREEN인지 저장소 검증 기록으로 남긴다.
2. **대표자가 new standalone Apps Script project를 만들고 `apps-script-commercial/`만 복사한다.** 기존 운영 프로젝트나 기존 relay 파일을 재사용하지 않는다.
3. **대표자가 새 프로젝트에 서로 구별되는 property 값을 만든다.** `COMMERCIAL_APPROVAL_ENABLED`, `COMMERCIAL_APPROVAL_TOKEN`, `COMMERCIAL_APPROVAL_RECEIPT_KEY`를 각각 별도 property로 만들며, 값은 repository 파일에 붙여넣지 않는다. 토큰과 receipt 서명 key도 서로 다른 값이어야 한다.
4. **대표자가 `COMMERCIAL_APPROVAL_ENABLED=0`으로 둔 채 새 web-app version을 배포하고, redacted test client로 `commercialNow`를 확인한다.** 응답의 시간·nonce 동작만 확인하고 비밀값을 출력하거나 저장하지 않는다.
5. **대표자가 유료 작업 client path를 활성화하지 않은 상태에서 의도적으로 만든 non-production PDF로 issue/verify를 확인한다.** 실제 고객 파일, 실제 승인 자료, 실제 Drive evidence를 선택하지 않는다.
6. **별도의 서면 representative approval을 받은 뒤에만 flag를 `1`로 바꾼다.** 기록에는 deployment version, test date, pass/fail만 남기며 property 값·토큰·key·파일 ID·고객 데이터는 남기지 않는다.
7. **비활성화할 때는 flag를 다시 `0`으로 돌리거나 prior Apps Script deployment를 선택한다.** 비활성화 후 commercial action은 fail-closed 응답이어야 한다.

## 이 Task가 승인하지 않는 외부 작업

이 repository task는 Drive evidence 선택, Script Property 생성, Apps Script deployment, browser token storage, Pages publication, paid-work activation, push, merge, PR, customer contact, paid-service configuration을 승인하지 않는다. 대표자의 계정·동의·배포·활성화는 별도 통제 아래에서만 수행한다. 이 파일에는 실제 token, key, file ID, customer data 또는 비밀값 예시를 쓰지 않는다.

## 세 action 계약

모든 POST는 다음 envelope만 사용한다. `token`은 새 프로젝트의 별도 Script Property와 대조되고, `timestamp`는 허용된 신선도 창 안이어야 한다.

```json
{
  "token": "[redacted]",
  "action": "commercialNow | commercialApprovalIssue | commercialApprovalVerify",
  "timestamp": "YYYY-MM-DDTHH:mm:ss+09:00",
  "payload": {}
}
```

`commercialNow` payload는 `{ "nonce": "[redacted-test-nonce]" }`이며 성공 응답은 `{ "ok": true, "serverNowKst": "...", "receivedAtKst": "...", "nonce": "..." }` 형태다.

`commercialApprovalIssue` payload의 정확한 필드는 `subjectType`, `subjectId`, `commercialTerms`, `approvalEvidenceType`, `approvalEvidenceFileId`, `approvedAt`, `approvedByRole`다. `commercialTerms`는 `workKind`, `scope`, `exclusions`, `vatMode`, `quotedAmount`, `validUntil`, `scheduleWindow`를 포함해야 한다. 성공 시 응답은 `{ "ok": true, "commercialApproval": { "receiptId": "...", "approvedTermsSha256": "...", "approvalEvidenceSha256": "...", "receiptHmac": "...", "...": "..." } }` 형태다.

`commercialApprovalVerify` payload의 정확한 필드는 `subjectType`, `subjectId`, `commercialTerms`, `commercialApproval`, `nonce`다. 성공 시 `{ "ok": true, "receiptId": "...", "serverNowKst": "...", "nonce": "...", "verifyExpiresAtKst": "..." }`를 반환한다. 실패·비활성화·재사용 nonce·불일치 evidence는 `{ "ok": false, "error": "..." }`로 반환되며, 승인 relay는 fail-closed다.

승인 evidence는 `application/pdf`, `image/jpeg`, `image/png`만 허용하고 파일 크기는 **20 MiB** 이하이어야 한다. verify nonce cache는 **60 seconds** 동안 유지되며 같은 receipt와 nonce의 재사용은 거절된다. `COMMERCIAL_APPROVAL_TOKEN`은 요청 인증 전용, `COMMERCIAL_APPROVAL_RECEIPT_KEY`는 receipt HMAC 전용으로 분리한다.

## 롤백과 기록

활성화 뒤 이상이 있으면 즉시 7번을 수행한다. 즉, flag를 `0`으로 되돌리거나 prior deployment를 선택하고, commercial action이 `commercial-disabled`로 닫히는지 대표자가 확인한다. 승인 기록에는 deployment version·test date·pass/fail만 기록한다. 실제 비밀값, evidence 식별자, 고객 정보, 브라우저 저장 token은 기록·커밋·공유하지 않는다.
