# Apps Script 중계 서버 — API 계약 (relay-v1)

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
| `download` | `{fileId}` | `{ok, fileId, name, mimeType, dataB64}` — 만물인테리어 폴더(루트/현장사진/견적서) 안의 파일만, 8MB 이하 (사진 미리보기용, relay-v1.1) |

오류 응답: `{ok:false, error, message}` — error 코드:
`unauthorized`(인증키 불일치) · `not-configured`(서버 미설정) · `bad-request` ·
`too-large` · `conflict` · `server-error`

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
