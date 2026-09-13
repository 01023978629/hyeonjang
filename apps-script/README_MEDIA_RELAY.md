# 미디어 원본 중계 v1 — 로컬 개발 후보

2026-09-13. 사진·동영상 원본의 재개 업로드, 기존 Drive 원본 확인, 인증된 부분 읽기를 추가한 개발 후보다. 실제 Google 계정·Drive 자료·운영 배포는 변경하지 않았다. 기존 relay actions, SharedTodo, OfficeIntake는 보존하며 `Code.gs` 인증 뒤 guarded dispatch 한 줄로만 연결한다.

## 요청과 응답

기존 `/exec`에 `Content-Type: text/plain` POST, JSON `{action,token,ts,deviceId,payload}`. 인증키는 기존 `APP_TOKEN`, `ts`는 현재 밀리초(±10분), `deviceId`는 1~64자 `[A-Za-z0-9._:-]`다. deviceId는 직원 신원 인증이 아닌 기록용 표식이다. 사용자별 권한 모델을 새로 도입하지 않는다. 모든 요청에서 인증 후 script lock을 잡고 인증·시간을 다시 확인한다.

성공 `version`은 `media-relay-v1`. 실패는 `{ok:false,error}`이며 외부 오류 원문·OAuth 토큰·세션 URI를 응답하거나 로그에 기록하지 않는다. `mediaHealth` 자체가 실제 Drive API metadata 읽기에 성공해야 기능을 사용할 수 있다. 구 서버가 새 action을 모르면 클라이언트는 기능 미지원으로 처리한다.

| action | payload | 성공 응답의 추가 필드 |
| --- | --- | --- |
| `mediaHealth` | `{}` | `maxFileBytes:104857600`, `chunkBytes:1048576`, `alignmentBytes:262144`, `mimeTypes` |
| `mediaUploadBegin` | `{uploadId,name,mimeType,size,sha256}` | 아래 업로드 상태 |
| `mediaUploadStatus` | `{uploadId}` | 아래 업로드 상태 |
| `mediaUploadChunk` | `{uploadId,offset,dataB64}` | 아래 업로드 상태 |
| `mediaInspect` | `{fileId}` | `file` |
| `mediaReadChunk` | `{fileId,offset,length,sha256}` | `fileId,offset,nextOffset,size,mimeType,sha256,dataB64,eof` |

`uploadId`는 소문자 UUID이며 첫 요청 전에 클라이언트가 지속 저장해야 한다. 같은 작업의 모든 재시도는 같은 ID를 사용한다. `name`은 1~160자이며 경로 문자·제어 문자·앞뒤 공백을 받지 않는다. `sha256`은 원본 전체 바이트의 소문자 64자리 SHA-256이다. 파일 크기는 1바이트~100MiB다. 서버는 caller folder, URL, fileId를 업로드 입력으로 받지 않는다.

업로드 상태는 `{ok:true,version,uploadId,state,offset,size,chunkBytes,file?}`. `state`는 `uploading` 또는 `complete`. `offset`은 서버가 확인한 다음 바이트 위치이며, 최종 크기와 MIME·SHA-256을 실제 Drive metadata와 대조한 뒤에만 `complete`와 `file`을 반환한다. 상태 조회는 원격 진행도 복구를 위해 journal을 갱신할 수 있으며, 만료 세션은 같은 사전 발급 파일 ID로 재개 세션을 다시 만든다. 그 경우 offset이 0으로 돌아가므로 클라이언트는 새 응답 위치를 따른다.

`file`은 `{fileId,name,mimeType,size,sha256,md5Checksum,verified:true}`. 업로드 완료의 `verified:true`는 요청한 원본 SHA-256·크기 일치를 뜻한다. 반면 기존 `mediaInspect`의 `verified:true`는 **현재 Drive 파일 metadata의 검증 가능한 크기·checksum 조회 성공**이다. 로컬 원본 일치는 클라이언트가 로컬 SHA-256 및 크기와 직접 비교해야 한다. 이름/크기만으로 원본 일치를 확정하면 안 된다. SHA-256이 없는 기존 파일은 `checksum-unavailable`로 종료하며 MD5만으로 성공을 대신하지 않는다.

중간 업로드 청크는 256KiB 배수, 최대 1MiB이며 마지막 청크만 나머지 길이를 허용한다. base64는 정규 인코딩만 받는다. 서버는 저장된 위치 대신 Drive가 회신한 위치를 매번 확인하고 `offset-conflict`에는 확인된 `offset`을 추가한다. 원격 서버가 이미 완료했다면 중복 청크를 보내지 않고 완료 metadata를 반환한다. 취소 action은 없다. 클라이언트 일시정지는 새 요청을 멈추며 기존 원본·청크·작업 기록을 삭제하지 않는다.

256KiB 조건은 청크의 **길이**에만 적용한다. 중단된 요청에서 Drive가 `Range: bytes=0-42`를 회신하면 43바이트가 저장된 정상 상태이므로 다음 시작 위치는 43이다. 요청 offset, 지속 journal offset, Drive 응답 offset 모두 정수·파일 범위만 검증한다. 클라이언트는 확인된 위치부터 최대 1MiB를 잘라 보내며, 마지막 청크를 제외한 길이 제한과 최종 전체 SHA-256·크기 대조는 그대로 적용한다. [Google의 중단 업로드 재개 규약](https://developers.google.com/workspace/drive/api/guides/manage-uploads#resume-upload).

세션의 HTTP 400/401/404/410은 기존 사전발급 ID의 metadata를 다시 확인한 뒤, 파일이 없을 때만 **요청당 최대 한 번** 같은 ID로 세션을 새로 만든다. 기존 완료 원본이 있으면 크기·SHA-256을 검사해 재사용하며, 불일치는 그대로 보존하고 중단한다. metadata 자체의 OAuth/접근 검사가 실패하면 세션을 바꾸지 않는다. 새 세션 생성도 실패하면 재귀 재시작하지 않고 오류를 돌려준다.

429와 403의 `rateLimitExceeded`/`userRateLimitExceeded` 계열은 `drive-rate-limited`로 세션을 유지한다. 클라이언트는 기다린 뒤 같은 uploadId로 명시적으로 재시도한다. 403 저장공간/일일 용량 제한은 `drive-quota-exceeded`, 권한·정책·뜻이 불분명한 403은 `drive-forbidden`으로 보존하고 계정 설정 확인이 필요하다. 불명확한 403을 만료로 추정해 자동 재생성을 반복하지 않는다. 새 세션 생성의 401은 `drive-auth-required`, 그 밖 지원하지 않는 4xx는 `drive-request-rejected`다. [Google 업로드 오류 처리](https://developers.google.com/workspace/drive/api/guides/manage-uploads#handle_media_upload_errors) 및 [Drive API 오류 원인 구분](https://developers.google.com/workspace/drive/api/guides/handle-errors).

읽기 길이는 1바이트~1MiB, 끝 범위는 파일 끝으로 줄인다. 각 요청은 예상 전체 SHA-256을 전달한다. 서버는 원본 `Range`/`Content-Range`, 응답 바이트 수, 읽기 전후 metadata·앱 루트 소속을 확인한다. 전체가 1MiB 이하인 경우를 제외하고 Range를 무시한 HTTP 200은 거부한다. 공개 공유·권한 변경·공개 동영상 URL은 만들지 않는다. 클라이언트는 모두 받은 바이트의 SHA-256을 다시 검증한 뒤 기기 내 Blob URL을 재생한다. 이 API 자체는 브라우저의 직접 스트리밍 URL이 아니다.

지원 MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `image/gif`, `image/avif`, `video/mp4`, `video/quicktime`, `video/webm`, `video/x-msvideo`, `video/x-matroska`, `video/3gpp`, `video/3gpp2`. 보관 형식 지원과 실제 기기의 재생 코덱 지원은 별개다.

대표 오류: 입력 `bad-request`, `bad-range`; 인증 `unauthorized`, `not-configured`; 재시도 `busy`, `drive-unavailable`, `verification-pending`, `journal-write-failed`; 보존·확인필요 `upload-conflict`, `connection-changed`, `integrity-mismatch`, `checksum-unavailable`, `content-changed`, `journal-invalid`, `journal-full`; 접근 `not-found`, `forbidden`, `unsupported-media`, `too-large`. 원본 손상·불일치 오류를 자동 새 uploadId 발급으로 우회하지 않는다.

## 내구성과 용량

신규 원본은 기존 앱 루트의 `현장사진` 폴더에 저장한다. 폴더가 여러 개면 `folder-ambiguous`로 멈춘다. 새 Drive ID를 먼저 발급받고 `MEDIA_RELAY_JOB_<uploadId>` Script Property에 영구 기록한 뒤 세션을 생성한다. 해당 URI 저장과 readback 확인이 끝나기 전에는 원본 바이트를 보내지 않는다. 원격 성공 이후 응답 또는 journal 쓰기가 실패해도 같은 파일 ID의 metadata를 조회해 완료를 복구한다. 재개 때 파일 생성 충돌은 metadata로 대조하며 기존 파일을 덮어쓰지 않는다.

초기 후보의 journal은 최대 256건이며, 전체 Script Properties UTF-8 키+값 합계 400KiB 및 값 한 개 8,000바이트의 보수적인 상한을 둔다. 완료 영수증도 건수에 포함한다. 오래된 작업·완료 영수증을 자동 제거하지 않는다. 작업 수 한계에서는 신규 시작만 막히고 기존 작업은 계속 재개할 수 있다. 전체 속성 용량 한계는 기존 작업의 journal 갱신도 막을 수 있으며, 이 경우 전송 성공을 오보고하지 않는다. 원본과 기존 journal은 보존된다.

**256건은 장기 운영 용량이 아니다.** 지속 운영 전에 별도 Drive journal 폴더에 작업별 영수증을 두는 구조 또는 영구 저장 서버로 확장할 필요가 있다. 확장 시 기존 uploadId→사전발급 fileId 기록을 모두 이관·읽기 검증하고, 예전 클라이언트 재시도도 같은 ID로 찾아야 한다. 단순 상한 인상, 완료 속성 일괄 삭제, 날짜가 지난 uploadId 재사용은 중복 파일을 만들 수 있으므로 이번 구현에 포함하지 않는다. 승인된 별도 작업으로 백업·복구 절차와 확장안을 검증한 뒤 진행한다.

각 청크는 metadata·업로드 상태·청크 요청 및 journal 갱신을 사용한다. 대용량 전송은 Apps Script/Drive 호출 한도와 실행 시간·모바일 메모리 한도에 영향을 받는다. 100MiB는 코드 상한이며 실제 기기에서 성공한 용량 보장이 아니다.

## 검증과 배포 경계

`node tests/media-relay-server.unit.js`: 가상 Google 서비스에서 38/38 시나리오와 안전 보호 변이 14/14 검출. 인증·허용 입력·루트 경계·원본 보존·lost start/chunk/final 응답·journal 실패(before/after/silent)·세션 만료·해시/크기 불일치·부분 읽기·읽기 도중 변경을 검사한다. 2026-09-14 배포 전 감사에서 부분 수신 offset까지 256KiB 배수를 강제한 결함을 발견했다. `bytes=0-42`에서 같은 작업이 반복 실패하는 것을 먼저 재현하고, 43·262143·262145바이트 부분 수신에서 정확히 이어 올리는 검사를 추가했다. 옛 offset 제한을 입력·journal·응답에 각각 되살린 변이 3종을 검출한다. 이어 400/401 세션 오류 복구, 403 원인별 구분, 429 보존, 완료 원본 우선 확인, 새 세션 실패의 단일 시도, OAuth/접근 실패 보존을 검증하고 복구·한도·권한 분류 변이 3종을 추가했다. 초회 검사에서 같은 base64 길이를 갖는 1MiB+1바이트 입력의 예상 오류를 실제 decoded 범위 검증과 일치하도록 보정한 이력과, 반복 구조 정규식을 단순화한 이력도 보존한다.

운영 배포는 별도 검토·승인 대상이다. 운영 원본을 보존하고 새 `MediaRelay.gs`, 인증 뒤 guarded dispatch, manifest의 `https://www.googleapis.com/auth/script.external_request` scope 추가만 검토한다. 폴더 전체 `clasp push`는 하지 않는다. 실제 운영 Watchdog 등 다른 모듈은 로컬과 다를 수 있다. 기존 Drive scope를 유지하고 scope 추가가 요구하는 배포자 승인·Google Drive API 사용 설정을 계정에서 확인해야 한다. 새 권한·API 설정은 로컬 검사로 확인되지 않는다.

배포 후 승인된 테스트 원본으로 사진·영상 각각 업로드 중단/재시도, 최종 Drive 크기/SHA-256 대조, 다른 인증된 기기의 원본 조회·다운로드·실제 코덱 재생을 확인해야 운영 완료다. 이번 코드 검사만으로 실제 Galaxy 재생·원본 보관 완료를 선언하지 않는다.

근거: [Drive resumable uploads와 pre-generated IDs](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Drive 원본 부분 다운로드](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [파일 checksum metadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).
