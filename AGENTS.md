# 코덱스 인수인계서 — hyeonjang (현장 앱)

> 이 저장소에서 작업하는 모든 AI 에이전트(Codex·Claude)가 시작 전에 읽는 문서.
> 2026-08-05 기준. 낡은 내용을 발견하면 **이 문서부터 고쳐라.**

## 이 저장소가 무엇인가

만물인테리어(대전, 1인 시공업체, 대표 전병덕)의 **현장 운영 앱**.
`index.html` 단일 파일 PWA(약 23,000줄) + `sw.js`. **main 에 병합되는 순간
GitHub Pages 로 실제 운영 배포된다** — 사장님 폰에 바로 나간다.
현재 배포 버전: `sw.js` 의 캐시 이름(`hyeonjang-v181-clinbox` 형태)이 곧 버전이다.

자매 저장소 `01023978629/manmool`: 공개 홈페이지 + 전자계약 Apps Script 서버 소스.

## 🔴 절대 금지 — 어기면 실제 사고가 난다

1. **`apps-script/` 폴더를 수정하지 마라.** 운영 중인 사진 중계 서버의 소스다.
   전자계약 서버는 저기가 아니라 manmool 저장소 `apps-script-contract/` 다.
2. **비밀값(토큰·API 키·전화번호 원문)을 코드·커밋·로그에 넣지 마라.**
   키는 기기 IndexedDB 에만 산다. 테스트 픽스처는 자기서술형 가짜값만
   (`AKfyTEST`, `SUPER-SECRET-ADMIN-TOKEN` 류).
3. **고객 발송을 켜지 마라.** 문자·알림톡은 이중으로 꺼져 있고, 그게 정상이다.
   `notify.sent === true` 가 아니면 "보냈다"로 기록하지 않는다.
4. **종료된 Fly 주소(`manmool-contract.fly.dev`)를 되살리지 마라.**
   `tests/dead-endpoint.check.js` 가 지킨다.
5. **main 에 직접 push 하지 마라.** 브랜치 → PR → 검증 → 병합.
   병합·배포·발송·삭제·과금은 대표 승인이 필요하다.
6. **검증하지 않은 것을 완료라고 보고하지 마라.**

## ✅ 모든 변경의 필수 절차

```bash
# 1) 테스트 서버 (한 번만)
node tests/static-server.js &          # 8299
node tests/mock-relay.js &             # 8398 (relay.e2e.js 가 요구)

# 2) 정적 검사
node tests/syntax.check.js             # 문법
node tests/dead-endpoint.check.js      # 죽은 주소·옛 규약
node tests/cost-honesty.check.js       # 요금 단정 문구 금지

# 3) 전체 회귀 — 46개 파일, 종료코드로 판정 (출력 마지막 줄로 판정하지 마라)
for f in tests/*.check.js tests/*.e2e.js tests/*.unit.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

- **새 기능 = 새 테스트.** 그리고 반드시 **변이 검증**: 보호하는 동작을 일부러
  되돌려 테스트가 실패하는 것까지 확인하라. 안 잡히면 그 테스트는 장식이다.
- **`index.html` 을 고쳤으면 `sw.js` 캐시 버전을 올려라** (`hyeonjang-v{N+1}-{짧은이름}`).
  안 올리면 사장님 폰이 옛 버전을 계속 쓴다.
- 커밋 메시지는 "무엇을" 이 아니라 **"왜"** 를 적는 것이 이 저장소의 관례다.

## 지켜야 할 불변식 (각각 테스트가 못박고 있다)

| 불변식 | 지키는 테스트 |
|---|---|
| 직렬화 최상위 키는 허용목록에만 추가 (두 곳 동시 갱신) | `health-board`, `marketing-draft` |
| 키 입력칸: 빈 값 저장 = "안 바꿈", 삭제는 [지우기]+확인만 | `key-persist` |
| 요금은 조건형으로만 ("결제계정이 없을 때만 무료") | `cost-honesty.check` |
| 전자계약 버튼은 서버 자가진단 통과 전까지 잠김, 잠긴 동안 요청 0 | `contract` |
| AI 도구 추가는 5곳(AI_TOOLS·aiToolRun·aiActionLabel·aiResultBrief·AI_WRITE) | `apt-ai` + ai-automation-auditor 감사 |
| 쓰기 도구는 AI_WRITE(승인 게이트), SAFE_AUTO 확대는 대표 승인 | `apt-ai` |
| 아파트 오더: 통계·정산은 완료월(doneAt) 기준, 입금완료 금액 수정 금지, 입금은 정산서에서만(payLog 1회) | `apt-orders`, `apt-stats`, `apt-amount` |
| 수금 입력은 미수 알림에서 한 번에 닿는다(얼마·언제), 미래 입금일 금지, 일부 입금은 독촉을 닫지 않는다 | `recv-entry` |
| 설정 화면은 탭 구조, 키는 아코디언 1겹까지 | `settings-tabs`, `key-persist` |
| AI 중계: 서버 키 없으면 기기 키 폴백, 한도 초과는 우회 금지 | `ai-relay` |
| 서버 날짜별 백업은 성패를 기록하고 화면에 띄운다 — 실패를 삼키지 않는다 | `backup-visible` |
| 아파트 오더 전/후 카드는 그 동/호 사진만 대상(파일명 매칭), 2장 이상일 때만 | `apt-ba` |
| 클로드 요청은 승인해야 적용, 같은 id 두 번 적용 금지, 모르는 도구 실행 금지 | `claude-inbox` |

## 구조 지도 (함수명으로 찾아라 — 줄번호는 금방 낡는다)

- 데이터: `state` + `serializeData()/applyData()` (드라이브 백업 왕복)
- 설정 화면: `openGdriveSetup()` — 4탭(저장·백업/전자계약/AI·지도 키/기타)
- 전자계약 연결: `contractCall()`, `contractSelfTest()`, `contractFeatureAvailable()`
- AI: `geminiCall()`(서버 중계 우선), `aiFC()`(도구 호출), `AI_TOOLS`/`aiToolRun()`
- 아파트 오더: `aptOrderManage()`, `aptSettle()`, `aptStats()`, `aptPhotoCount()`
- 주간·운영 보고: `weekBriefData/Text()`, `opsReportData/Text()`
- 전체 장부 엑셀: `exportFullXlsx()` (10시트)

## 서브에이전트

`.codex/agents/` 에 10종 정의됨(`.claude/agents/` 와 동일). 원칙:
같은 파일은 쓰기 에이전트 1명만(single-writer), 쓰기 전에 관련 리뷰어 근거 확보,
PII 원문 금지(전화 뒷 4자리만), 검증 없는 완료 보고 금지.

## 작업 분류 — 누가 할 수 있는 일인가 (2026-08-05)

에이전트(Claude·Codex)가 "못 하는 일"은 **전부 코덱스로 넘길 수 있는 게 아니다.**
대부분은 사람 손이 필요하고, 코덱스에 맡겨 두면 영영 안 끝난다. 세 칸으로 나눈다.

### 🅰 에이전트가 한다 (Claude·Codex 아무나 — 저장소 안에서 끝나는 일)

코드·테스트·문서. 위 절차(테스트 → 변이 검증 → sw 버전)만 지키면 된다.
남은 후보: 실환경 체크리스트 문서 갱신, 데모 데이터에 아파트 오더 표본 추가.

*(해결됨 — 백업 0건)* `relayDailyBackup` 의 코드 경로도 서버 `makeBackup_` 도
멀쩡했다. 원인은 **모든 실패를 `catch(e){}` 로 삼켜** 매일 조용히 실패해도
알려 줄 화면이 없었던 것. v179 에서 성패를 기록해 백업 센터에 띄운다
(`backup-visible.e2e.js`). 이제 대표가 화면 색만 보고 알려 주면 된다.

### 🅱 사장님만 할 수 있다 (브라우저·본인 계정·결제 — 에이전트는 대신 못 누른다)

코덱스로 분류하면 **안 된다.** 코덱스도 똑같이 못 한다.

| 일 | 어디서 | 지금 상태 |
|---|---|---|
| Gemini API 키 발급 | `aistudio.google.com/api-keys`, 프로젝트 `Manmool Gemini No Billing` | **막힘** — "The request is suspicious" 재시도 필요 |
| 전자계약 Apps Script 배포 | 본인 구글 계정 | 대기 (manmool `apps-script-contract/SETUP.md`) |
| 배포 후 앱 ⚙️설정 자가진단 | 앱 | 위가 끝나야 가능 |
| 네이버·구글 소유확인 코드 | 서치어드바이저·서치콘솔 | manmool `index.html` 11~14행이 주석 처리된 자리표시자 |
| Threads 토큰 재발급 | Meta | 2026-06-19 만료 |
| 실제 문자·알림톡 발송 승인 | — | 계속 OFF 가 정상 |

### 🅲 사장님이 자료를 줘야 에이전트가 한다

실제 고객 후기(지어내기 금지), 현장 사진, 아파트 단지·관리사무소 정보.

## 지금 상태와 남은 일 (2026-08-05)

- 테스트 46개 파일 전부 통과. 앱 v181 배포.
- v178: 미수금 알림·운영 큐에서 **[💰 수금 입력] 직행**(얼마·언제) — 이전에는
  독촉 문자만 가능해 돈을 받아도 알림이 안 꺼졌다. `recv-entry.e2e.js` 가 지킨다.
- v179: 서버 날짜별 백업 성패를 백업 센터에 표시(`backup-visible.e2e.js`).
- v180: 아파트 오더에서 시공 전/후 비교 카드 — 전에는 현장 배정 사진만 대상이라
  관리사무소 일은 아예 못 만들었다(`apt-ba.e2e.js`).
- v181: **클로드 요청함** — 대화(클로드)가 드라이브 문서 폴더에 둔
  `클로드_요청함.json` 을 앱이 읽어 **승인 후** `aiToolRun` 으로 적용한다.
  클로드가 `현장데이터.json` 을 직접 고치면 revision 충돌 방지를 우회해
  한쪽이 덮어써지므로, 데이터 파일은 건드리지 않는 구조로 만들었다.
  릴레이 서버(`apps-script/`)는 손대지 않는다 — 기존 listFiles/download 만 쓴다.
- 막힌 것은 전부 🅱 — 에이전트가 더 밀어붙일 수 있는 게 없다.
  대표 몫 인계는 manmool `CODEX-인수인계.md` 에 항목별로 정리돼 있다.
