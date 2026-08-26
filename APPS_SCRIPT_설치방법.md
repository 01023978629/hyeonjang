# Apps Script 설치 방법 (처음 하는 분용, 15~20분)

모바일에서 구글 로그인 팝업 없이 저장·불러오기가 되게 하는 **중계 서버**를
대표님 구글 계정에 만드는 절차입니다. **PC 크롬으로** 진행하세요.

> 준비물: 구글 계정(기존 만물인테리어 폴더가 있는 계정), 만물인테리어 폴더 ID

## 0. 폴더 ID 확인

1. PC에서 https://drive.google.com 접속 → `만물인테리어` 폴더 열기
2. 주소창이 `https://drive.google.com/drive/folders/1VRtT1ACNgMZi...` 형태 →
   `folders/` 뒤의 긴 문자열이 **폴더 ID**입니다. 복사해 두세요.

## 1. 새 프로젝트 만들기

1. https://script.google.com 접속 (만물인테리어 폴더가 있는 그 계정으로 로그인)
2. 왼쪽 위 **새 프로젝트** 클릭
3. 왼쪽 위 "제목 없는 프로젝트" 클릭 → 이름을 `만물인테리어 중계서버` 로 변경

## 2. Code.gs 붙여넣기

1. 편집기에 기본으로 있는 `function myFunction(){}` 내용을 **전부 지우기**
2. 이 저장소의 `apps-script/Code.gs` 파일 내용을 **전체 복사해서 붙여넣기**
3. 💾 저장 (Ctrl+S)

### 2-1. 관리사무소 접수 파일 추가

관리사무소 접수 기능을 사용할 때만 다음 파일도 같은 Apps Script 프로젝트에
추가합니다. 기존 `Code.gs`의 `health`, `load`, `save`, `backup`, `upload`,
`listFiles`, `thumbnail`, `download` 동작은 그대로 둡니다.

1. 왼쪽 파일 목록의 **＋** → **스크립트**로 `OfficeIntakePure`와
   `OfficeIntake` 파일을 각각 추가합니다.
2. 저장소의 `apps-script/OfficeIntakePure.gs`, `apps-script/OfficeIntake.gs`
   내용을 각각 전체 복사해 붙여넣고 저장합니다.
3. 이 단계에서는 공개 접수 flag를 켜지 않습니다. 기존 relay만 먼저 확인합니다.

### 2-2. Watchdog.gs 추가 — 파수꾼(매일 아침 자동 점검)

사장님이 앱을 열지 않아도 **매일 스스로** 미수금·AS·보증만료·방치현장을 살펴 메일로 알려주는 부분입니다.

1. 왼쪽 파일 목록의 **＋** → **스크립트** → 이름을 `Watchdog` 로 입력
2. 이 저장소의 `apps-script/Watchdog.gs` 내용을 **전체 복사해서 붙여넣기** → 저장
3. 설치 실행은 아래 **7-1** 에서 합니다 (권한 승인을 먼저 끝내야 하기 때문)

> 파수꾼은 현장자료를 **읽기만 하고 절대 고치지 않습니다.** 이것 때문에 자료가 상할 일은 없습니다.

## 3. appsscript.json 설정

1. 왼쪽 톱니바퀴(프로젝트 설정) → **"appsscript.json" 매니페스트 파일을 편집기에 표시** 체크
2. 왼쪽 파일 목록에 `appsscript.json`이 생김 → 클릭
3. 내용을 지우고 이 저장소의 `apps-script/appsscript.json` 내용으로 교체 → 저장

## 4. 스크립트 속성 입력 (비밀값은 여기에만!)

1. 톱니바퀴(프로젝트 설정) → 아래로 스크롤 → **스크립트 속성** → "스크립트 속성 추가"
2. 다음 **정확한 키 이름**을 준비합니다. 값은 이 문서·코드·Git·로그·채팅에
   기록하지 말고 Apps Script 프로젝트 설정에만 입력합니다.

| 속성 키 | 용도 |
|---|---|
| `APP_TOKEN` | 기존 현장 relay 및 내부 office action 인증 |
| `DRIVE_FOLDER_ID` | 기존 `만물인테리어` Drive 폴더 ID |
| `DATA_FILE_NAME` | 기존 현장 데이터 파일명(선택) |
| `OFFICE_INTAKE_ENABLED` | 공개 office 접수 feature flag |
| `OFFICE_SESSION_SECRET` | office PIN·세션 HMAC 서명 키 |
| `OFFICE_CONFIG_JSON` | office 목록·PIN hash/salt·활성 상태·sessionVersion |
| `OFFICE_STORE_FILE` | 관리사무소 접수 저장 파일명(선택) |

3. 기존 설치에서 사용하는 `BACKUP_KEEP_COUNT` 등 다른 Watchdog 속성이 있다면
   그대로 보존합니다. 새 기능의 저장 파일 기본 이름은 `관리사무소접수.json`입니다.
4. `OFFICE_CONFIG_JSON`에는 평문 PIN을 넣지 않습니다. office 등록·PIN 발급은
   아래의 내부 `officeAdminUpsert` → `officeRotatePin` 절차로 대표가 수행합니다.
5. 값이 필요한 문서 예시는 모두 `[REDACTED_SECRET]` 같은 자리표시자만 사용합니다.
   **실제 토큰·세션 secret·폴더 ID·PIN을 이 파일에 적지 마세요.**

## 5. 최초 권한 승인

1. 편집기 상단 함수 선택을 `doGet` 으로 → **실행** 클릭
2. "승인 필요" 창 → **권한 검토** → 본인 계정 선택
3. "확인되지 않은 앱" 경고가 나오면 → **고급** → **(프로젝트명)(으)로 이동** → **허용**
   (본인이 방금 만든 스크립트라 안전합니다)
4. 실행 로그에 오류 없이 끝나면 성공. 매니페스트의 시간대는 반드시
   `Asia/Seoul`이어야 하며, 영수증 날짜·보존 기준은 이 설정을 따릅니다.
5. 최초 승인 범위는 Drive(기존 데이터·접수 저장·사진), Calendar(긴급 알림),
   ScriptApp(Watchdog 트리거)입니다. 현황판을 쓰면 Spreadsheet, mail 채널을
   명시적으로 쓰면 Mail, 기본 수신자 조회에는 `userinfo.email`도 승인합니다.

## 6. 웹 앱으로 배포

1. 오른쪽 위 **배포 ▸ 새 배포**
2. 톱니바퀴(유형 선택) → **웹 앱**
3. 설정:
   - 설명: 새 버전 설명(예: `office-intake-relay`)
   - **실행 사용자: 나 (`USER_DEPLOYING`)** ← 대표 Drive 권한으로 실행
   - **액세스 권한: 모든 사용자 (`ANYONE_ANONYMOUS`)** ← 익명 HTTP 접근 허용
     (기존 relay는 `APP_TOKEN`, office 공개 action은 짧은 office 세션으로 보호)
4. **배포** 클릭 → 다시 권한 승인이 나오면 5번과 동일하게 허용
5. **웹 앱 URL** 복사 (`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec` 형태)

## 7. 동작 확인 (브라우저 주소창 — live gate 1)

새 탭에 붙여넣기. 아래 `[REDACTED_SECRET]`는 설명용 자리표시자이며,
실제 값을 문서나 채팅에 남기지 않습니다.

```
https://script.google.com/macros/s/…/exec?action=health&token=[REDACTED_SECRET]
```

`{"ok":true,"version":"relay-v4","folderOk":true,...}` 처럼 **`ok:true` 와 `folderOk:true`** 가 보이면 성공입니다.
- `version` 이 **`relay-v4` 이상**이어야 PC에서 사진 **원본 화질**로 내려받기가 됩니다.
  `relay-v3` 이하로 보이면 Code.gs가 옛날 버전입니다 → 2번을 다시 하고 **9번(새 버전 배포)** 을 하세요.
- `folderOk:false` → DRIVE_FOLDER_ID 오타
- `unauthorized` → 토큰 오타

`ok:true`와 `folderOk:true`가 확인되기 전에는 office 기능을 켜지 않습니다.
HTTP 200만으로는 올바른 배포·속성·Drive 권한을 증명하지 못합니다. 반드시 현재
프로젝트의 `/exec` URL, Script Properties, 배포 버전을 함께 확인합니다.

## 7-1. 관리사무소 office bootstrap (live gate 2)

계정 권한과 health gate가 통과한 뒤 대표가 내부 관리 도구에서 다음 순서로
수행합니다. 이 요청은 `APP_TOKEN`이 필요한 내부 action이며 공개 브라우저에
노출하지 않습니다.

1. `officeAdminUpsert`로 기존 `aptOffices.id`와 단지 slug·단지명을 등록합니다.
2. `officeRotatePin`으로 PIN을 발급받아 안전한 관리 채널에서 해당 관리사무소에
   한 번만 전달합니다. PIN을 Script Properties·로그·문서에 다시 적지 않습니다.
3. 올바른 PIN으로 `officeLogin`한 뒤 `officeList`, `officeCreate`,
   `officeUpload`, `officeUpdate`, `officeCancel`의 office 범위와 8시간 세션을
   확인합니다. 다른 office의 requestId가 `not-found`인지 확인합니다.
4. 내부 action은 토큰 없이 거부되는지, 기존 relay action은 기존 토큰으로 계속
   동작하는지 확인합니다. 긴급 접수는 Calendar 일정 또는 `calendar-failed`
   운영 오류가 남는지 확인합니다.
5. 모든 확인이 끝난 뒤에만 `OFFICE_INTAKE_ENABLED`를 직접 활성화합니다.
   비활성 상태에서는 office 공개 로그인·생성·변경·업로드가 거부되고 기존
   relay에는 영향이 없어야 합니다.

Playwright 브라우저 회귀는 선택 의존성이므로 로컬에서 모듈을 불러오지 못할 수
있습니다. 그 경우 `tests/office-intake-server.unit.js`의 dependency-free 정적
계약 검사와 서버 단위 검사를 먼저 실행하고, 실제 계정·브라우저 live gate는
대표 기기에서 별도로 확인합니다. 정적 검사는 배포 완료를 대신하지 않습니다.

## 7-2. 파수꾼 설치 (매일 아침 자동 점검 켜기)

권한 승인이 끝난 뒤에 합니다. **딱 한 번만** 하면 됩니다.

1. 편집기 위쪽 함수 선택을 **`installDailyWatch`** 로 → **실행**
2. 권한 승인 창이 뜨면 5번과 동일하게 **허용** (캘린더 권한이 추가로 필요합니다)
3. 실행 로그에 `설치 완료: 매일 7시경 · 구글 캘린더 일정(폰 알림)` 이 보이면 성공
4. **바로 확인해보기** — 함수 선택을 **`testWatchNow`** 로 바꾸고 실행 → 폰 캘린더에 바로 뜹니다

### 어떻게 알려주나 — **메일·카톡을 쓰지 않습니다**

기본은 **구글 캘린더 일정**입니다. 매일 아침 폰 기본 캘린더에 `[파수꾼] …` 일정이 꽂히고
**알림이 울립니다.** 메일함을 열 필요도, 앱을 켤 필요도 없습니다.

일정을 열면 이런 내용이 그대로 보입니다:

```
■ 못 받은 돈 — 공사 끝난 지 14일 넘음
  · 괴산현장 : 6,000,000원 (완료 30일 경과) / 김사장 010-1111-2222
  합계 6,000,000원

■ 밀린 AS — 늦을수록 고객 불만이 커집니다
  · 괴산현장 : 2건 (10일 경과) / 화장실 누수
```

전화번호가 그대로 들어가 있어 **일정에서 바로 전화를 걸 수 있습니다.**

하루에 여러 번 돌려도 그날 일정은 하나만 남습니다(중복 자동 정리).

### 알림 방법 바꾸기 (선택 · 스크립트 속성)

| `WATCH_CHANNEL` 값 | 어떻게 알려주나 |
|---|---|
| *(비워둠)* 또는 `calendar` | **구글 캘린더 일정 + 폰 알림** ← 기본 |
| `sheet` | 구글 시트 **`파수꾼 현황판`** 에 날짜별로 쌓기 (만물인테리어 폴더 안에 자동 생성). 링크를 폰 홈화면에 두면 됨 |
| `both` | 캘린더 + 시트 둘 다 |
| `mail` | 메일 (원할 때만 명시적으로 선택) |

| 그 밖의 속성 | 뜻 |
|---|---|
| `WATCH_HOUR` | 실행 시각 0~23 (기본 `7`) — 바꾼 뒤 `installDailyWatch` 를 다시 실행 |
| `WATCH_OFF` | `1` 이면 알림 중단 |
| `WATCH_EMAIL` | `mail` 일 때만 쓰임 (미설정 시 이 계정 메일) |

챙길 게 없는 날은 알리지 않고, **월요일에만** "이상 없음" 확인이 옵니다.

판단 기준(완료 후 며칠 지난 미수금부터 알릴지 등)을 바꾸려면 `Watchdog.gs` 위쪽의 `var W = {...}` 숫자만 고치면 됩니다.
그만 받으려면 함수 **`removeDailyWatch`** 를 실행하세요.

## 8. 웹 앱(현장관리)에 연결

1. 현장관리 웹 열기 → ☁️ **구글드라이브/클라우드 설정** 열기
2. **권장: 서버 연결** 칸에
   - 서버 주소: 6-5의 웹 앱 URL
   - 앱 인증키: APP_TOKEN 값
3. **연결 테스트** → 초록 확인 후
4. 첫 연결 안내에 따라 **서버 자료 / 이 기기 자료** 중 선택 (선택 전 양쪽 자동 백업됨)
5. 이후 저장·불러오기·사진 업로드가 로그인 팝업 없이 동작합니다

## 9. 코드를 고친 뒤 다시 배포할 때 (URL 유지 방법)

- **배포 ▸ 배포 관리** → 기존 배포 옆 ✏️ 연필 → 버전: **새 버전** → 배포
- 이렇게 하면 **URL이 그대로 유지**됩니다. ("새 배포"로 만들면 URL이 바뀌니 주의 —
  바뀐 경우 웹 설정 화면에 새 URL만 다시 입력하면 됩니다)

### 장애 시 롤백

1. 대표가 먼저 `OFFICE_INTAKE_ENABLED`를 비활성화해 공개 접수를 멈춥니다.
2. `health`와 기존 relay `load/save`를 확인합니다.
3. 필요하면 **배포 관리**에서 직전 정상 버전으로 되돌리고, 동일 `/exec` URL의
   health 및 기존 relay 회귀를 다시 확인합니다.
4. 관리자 설정 변경 오류가 `admin-state-unknown`으로 반환되면 property를
   추측해 덮어쓰지 말고 현재 `OFFICE_CONFIG_JSON`을 대표가 확인합니다.
   접수 저장 파일·사진은 삭제하지 않습니다.

## 문제 해결

| 증상 | 원인/조치 |
|---|---|
| 웹에서 "인증키 오류" | 웹에 입력한 키 ≠ 스크립트 속성 APP_TOKEN. 둘을 맞추세요 |
| "서버 미설정" | 스크립트 속성에 APP_TOKEN 또는 DRIVE_FOLDER_ID 누락 |
| health의 folderOk:false | 폴더 ID 오타, 또는 다른 계정의 폴더 |
| 저장 시 conflict 안내 | 다른 기기가 먼저 저장함 — 화면 안내대로 선택(정상 동작) |
| 갑자기 전부 실패 | 배포를 "새 배포"로 해서 URL이 바뀐 경우 — 웹에 새 URL 입력 |
| office 로그인 비활성화 | `OFFICE_INTAKE_ENABLED`가 꺼져 있거나 세션 secret/config가 없음 — 기존 relay와 분리해 확인 |
| office `session-expired` | 8시간 만료, PIN 회전/비활성화로 sessionVersion 폐기, 또는 다른 단지 세션 사용 |
| office 업로드 거부 | JPEG/PNG/WebP만 허용, 이미지별 decoded 2 MiB·접수당 5장 제한 |
| 긴급 알림 실패 | 접수는 유지되고 `calendar-failed`가 운영 오류에 기록됨 — Calendar 권한을 live에서 확인 |

> 보안 참고: APP_TOKEN은 브라우저에 저장되는 값이라 완전한 비밀이 아닙니다.
> 1인 업무용 최소 장치이며, 다중 사용자 운영 시 별도 인증(예: Supabase Auth)이 필요합니다.
> 자세한 계약·한계는 `apps-script/README_APPS_SCRIPT.md` 참고.
