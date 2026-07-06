# 현장. — 개발자 유지보수 가이드 (v11 · 2026-07-05)

단일 파일 PWA(`index.html` + `sw.js`)로 동작하는 1인 인테리어 운영 앱.
이 문서는 **다음 개발자(또는 미래의 AI)** 가 안전하게 고치고 확장하기 위한 지도다.

---

## 1. 아키텍처 한 장

```
index.html (≈700KB, 스크립트 1개)
├─ <style>            앱 전체 CSS (다크모드: body.dark)
├─ <body> 정적 골격    header(.brand) / #view / 하단탭 / #modalRoot / #aiSheet
└─ <script> 단일 스크립트
   ├─ CONFIG/헬퍼      COMPANY 상수(693행 부근), localDate/won/num/escapeHtml/uid …
   ├─ 저장 계층        state(메모리) ⇄ serializeData()/applyData()
   │                   ├ PC: 폴더핸들 → _현장.json 자동저장 (FS Access API)
   │                   ├ 폰: 구글드라이브 gdSave/gdLoadDriveFiles
   │                   └ 공통: 🛡 hjSnapshot → IndexedDB 'hj_snaps' 롤링 12개
   ├─ 렌더 계층        render() → view*() 탭별 HTML 문자열 → #view.innerHTML
   ├─ 이벤트 계층      setupDelegation(): #view에 click/change/input 위임 (§4 필독)
   ├─ AI 계층          AI_TOOLS 선언(42종) → aiFC(Gemini functionCalling)
   │                   → aiAgentSend 루프 → AI_WRITE는 aiConfirm 승인카드
   └─ 기능 모듈        /* ═══ 배너 ═══ */ 로 구획된 v1~v11 이식 블록
```

**불변 규칙**
- 외부 번들러/프레임워크 없음. 라이브러리는 `ensureXLSX/ensureLeaflet/ensureJsPDF/loadExtLib` 로 **필요할 때만 CDN 로드**.
- 화면 그리기는 전부 "HTML 문자열 → innerHTML". DOM 직접 조작은 모달 내부 핸들러에서만.
- 새 데이터 필드는 **serializeData와 applyData 양쪽에** 반드시 추가(§3).

## 2. 기능 → 함수 지도 (버전순)

| 버전 | 기능 | 진입점(UI) | 핵심 함수 |
|---|---|---|---|
| v1 | AI 비서(승인/자동) | 대시 [🤖], 칩 11 | `aiAgent, aiAgentSend, aiToolRun, aiConfirm, aiSys` |
| v1 | 아침 브리핑 | 대시 [🌅] | `aiBriefing` |
| v2 | 사진 자동정리 | 가져오기 훅 4곳 | `aiAutoOrgOffer, aiAutoOrganize, aiVisionPhaseAll` |
| v2 | 주간 리포트 | 대시 [📊] | `weeklyReportData/Text/ImageBlob, hjWeekRange` |
| v2 | 수금 이력 | (자동) | `hjPayLog` ← setReceived 훅 2곳 |
| v3 | 견적 AI 검토 | 견적 [🧾] | `quoteRuleReview, reviewQuote, HJ_QUOTE_KB` |
| v3 | 월말 결산 | 대시 [🗓] | `monthlyClosingData/Text/ImageBlob, collectQuotesByMonth` |
| v4 | 미수금 팔로업 | 대시 [💰] | `overdueFollowupData, overdueRuleDrafts, overdueDraftModal, hjSendSms` |
| v4 | 거래처 장부 | 대시 [📈] | `customerLedgerData/Text/ImageBlob` |
| v5 | 현장 파일철 | 현장탭 [🧠]×2 | `projectResolve, projectHistoryData/Text, projectHistory` |
| v5 | 오늘 자동 점검 | 대시 상단 카드 | `dailyCheckData, dailyCheckCardHTML, dismissDailyCheck` |
| v6 | 단가장 관리 | 견적 [📦] | `priceBookManage` (학습/자동채움은 원본에 이미 존재) |
| v6 | 포트폴리오 | 파일철 [🏷] | `portfolioPick/ImageBlob/RuleText, portfolioCard` |
| v6 | 고객 진행 보고 | 파일철 [📨] | `customerProgressData/Text, customerProgress` (+원본 makeProgressReport) |
| v6 | 일정 알림 문자 | 일정 [🔔] | `notifyDrafts, scheduleNotify, hjKD` |
| v7 | 안전판 스냅샷 | 더보기/좌패널 | `hjSnapshot, backupHistory` + 훅 3곳(§5) |
| v7 | 수익 분석 | 대시 [📊수익] | `HJ_TYPE_KB, hjProjType, profitAnalysisData/Text, profitAnalysis` |
| v7 | PWA 글랜스/뱃지 | 부팅 | `hjGlanceCache/Show, hjBadgeUpdate, hjBootExtras` + manifest.shortcuts |
| v8 | AS 관리 | 더보기 [🔧] | `AS_STAT, hjWarranty, asOpenList, asManage` |
| v8 | 자재 발주서 | 견적 [🚚] | `materialOrder(+Result/Text), state.suppliers/supplierMap` |
| v8 | 인건비 장부 | 일정 [👷] | `laborLedgerData, laborLedger, applyLaborToProject` (s.labor) |
| v8 | 만능 검색 | (도구) | `universalSearch` — 8소스(f.text=OCR 포함) |
| v9 | 사용설명서 | 더보기 [📖] | `HJ_HELP, helpSearch, helpGuide` |
| v9 | 현장 지도 | 더보기/대시 [🗺] | `allProjectsMap, HJ_STAGE_COLOR` (+원본 ensureLeaflet/ensureProjGeo) |
| v9 | 전체 장부 엑셀 | 더보기 [📤] | `exportFullXlsx` (9시트) |
| v10 | 브랜드 테마 | 더보기 [🎨] | `hjShade, hjBrandColor/Grad, hjBrandLogoImg/ApplyUI, brandSettings` |
| v10 | 고객 진행 페이지 | 진행보고 [🔗] | `customerPageHTML, customerPage` |
| v10 | 캘린더 자동 | 일정 [📅] | `hjGcalUrl, hjGcalMaybeOpen, toggleGcalAuto` + 훅 2곳 |
| v11 | 데이터 이사 | 더보기 [📥] | `importWizard, __iw*` (매핑 3종+전체장부 자동) |
| v12 | 첫 사용 온보딩 | 부팅(빈 데이터) | `hjOnboardShow, hjSetupChecklist` |
| v13 | 오프라인/자동저장 강건 | 부팅/저장 | `hjNetWatch/hjNetBanner`, `saveProject(__saving/__saveQueued)` |
| v14 | AI 복합작업 자율처리 | ⚡자동 모드 | `aiSys(모드분기)`, `aiAgentSend(루프 10)` |
| v14 | 경영 대시보드 | 대시 [📊 경영 현황] | `bizDashData, bizDashboard` |
| v15 | 선제적 아침 비서 | 부팅(하루 1회) | `hjMorningBrief, hjMorningMaybe` (dailyCheck act로 실행 버튼) |
| v15 | 매출 추이 차트 | 경영대시 [📉 추이] | `revenueTrendData, revenueTrendSVG, revenueTrend` (외부 라이브러리 없이 SVG) |
| v16 | 정산 문서 3종 | 파일철/더보기 [📄 정산 문서] | `settleDocData, statementHTML, invoiceHTML, warrantyHTML, settleDocs, settleDocShare` (AI 발송: send_settle_doc) |
| v17 | AI 삭제·메모 권한 | 비서 명령 | `aiDeleteProject, aiDeleteSchedule, aiAddNote, aiListNotes` (스냅샷 후 삭제) |
| v17 | 수금 영수증 | 정산화면 [💵 영수증] | `receiptHTML, cashReceiptSMS(현금영수증 문자), receiptDialog, receiptShare` (AI 발송: send_receipt) |
| v18 | 부가세 신고 준비 | 경영대시 [📊 부가세] | `vatPeriods, vatReportData(매출세액-매입세액공제→납부), vatReport, vatExportXlsx` |
| v18 | AI 수금 대송 | 비서 명령 | `batchReceive` (일괄 입금 기록 + 영수증 + 현금영수증 문자, batch_receive) |
| v19 | 스마트 알림 | 더보기 [🔔] | `hjNotifyItems, hjNotifyFire, notifySettings` (오늘 일정·장기 미수·A/S 만료, 하루 1회) |
| v19 | 세금계산서 정보 | 더보기 [📇] | `taxInvoiceData, taxInvoiceInfo` (공급자·고객 bizno 저장·전체 복사) |
| v19 | AI 사진 작업일지 | 더보기 [📷] | `photoReportData, photoReport, photoReportAISummary` (날짜·공정별 집계 + AI 요약) |
| v20 | AI 주간 브리핑 | 대시 [🤖 주간]·월요일 자동 | `weekBriefData, weekBrief, weekBriefMaybe` (지난주 성과+이번주 계획+AI 코멘트) |
| v20 | 간편 지출 장부 | 대시 [💳 지출]·더보기 | `expenseAdd, expenseData, expenseLedger, expenseExportXlsx` (state.expenses, 현금/카드·분류별) |
| v21 | 월별 실손익 | 대시 [💰 손익]·더보기 | `pnlData, pnl, pnlTrend, pnlTrendSVG` (수금−지출 현금흐름, 6개월 추이 SVG) |
| v22 | 일정 충돌 감지 | 대시 [📅 점검] | `scheduleConflicts, scheduleCheck` (시간 겹침 + 과부하 3건↑/10h↑) |
| v22 | 거래처 관리 | 대시 [📇 거래처]·더보기 | `supplierList, supplierStats, supplierAdd, suppliers` (state.suppliers 확장: category·items·memo) |
| v22 | 연간 결산 | 대시 [📊 연간]·더보기 | `annualData, annualReport, annualExportXlsx` (12개월 pnlData 집계·완료현장·엑셀 3시트) |
| v23 | 메뉴 정리 + AI 우선 | 경영 대시보드·더보기 | 대시보드를 💰돈/📊리포트/🗂현장 3카테고리로 재구성 + AI 비서 바로가기 배너(대시·더보기 상단). 라우팅 100%(70문항) 재검증 |
| v24 | AI 먼저 제안 + 빠른명령 | 비서 첫 화면 | `aiSuggestions, aiWelcomeRich, AI_QUICK_CMDS` (상황 감지→제안 카드 + 자주 쓰는 명령 6버튼) |
| v24 | 통합 검색 | 더보기 [🔍]·비서 | `hjGlobalSearch` (현장·사진·메모·거래처·견적·연락처, 실시간 필터, global_search 도구) |
| v25 | 매출 목표 관리 | 대시 [🎯 목표]·더보기 | `goalGet, goalSet, goalProgress, goalManage` (월·연 목표+수금 기준 달성률·페이스, state.goals) |
| v25 | 제안 알림 | 스마트 알림에 통합 | `hjSuggestNotifyItems` (aiSuggestions·목표 소식을 hjNotifyItems에 연결) |
| v26 | 음성 현장일지 | 더보기 [📝]·비서 | `voiceWorkLog, workLogSave, aiAddWorkLog` (STT로 작업 기록→일정 report, add_worklog 도구) |
| v26 | AI 경영 분석 | 대시 [📈 분석]·비서 | `bizAnalysisData, bizAnalysisSummary, bizAnalysis` (6개월 추이→규칙 인사이트+AI 조언) |
| v26 | 현장 예산 관리 | 대시 [📅 예산]·더보기 | `budgetSet, budgetSpent, budgetData, budgetManage` (예산 대비 지출·초과 경고, projects.budget) |
| v26 | **버그수정** | applyData | projects 병합 시 spread 추가 — budget 등 추가 필드 유실 방지 |
| v27 | 일정 브리핑 강화 | 더보기 [📅]·비서 | `todayScheduleBrief, scheduleBrief` (시간순+주소·준비물 추정·연락처, AI 동선 조언) |
| v27 | AI 견적 자동작성 | 더보기 [💸]·비서 | `aiQuoteFromText, aiQuoteDialog, priceHint` (설명→JSON 항목 구성, ai_quote 도구) |
| v27 | 사진 AI 하자분석 | 더보기 [📷]·비서 | `photoDefectCheck, photoDefectDialog` (geminiVision으로 공정·하자 판단) |
| v28 | 종합 사용 가이드 | 더보기 [📚]·비서 | `hjGuideHome, hjGuideCategory, HJ_GUIDE_CATS` (7개 분야·말하는 예시·바로실행, guide 도구) + 실기기 체크리스트 최신화 |
| v29 | OpenAI(ChatGPT) 지원 | ☁️ 설정 | `openaiAsk, aiAsk, aiKeyReady, aiProviderName` (Gemini/OpenAI 선택, 둘 다면 ChatGPT 우선+Gemini 폴백, idb openai_key) |
| v29 | AI 능동 브리핑 | 부팅 자동·더보기 [🤖] | `aiActiveBriefData, aiActiveBrief, aiActiveBriefMaybe` (앱 켜면 오늘 일정·미수·챙길일 먼저 요약+바로처리, active_brief 도구) |
| v30 | 무료 Gemini 우선 | `aiAsk` | 두 키가 다 있어도 무료 Gemini 우선 사용(비용 절감), OpenAI는 명시 선택('openai') 또는 Gemini 실패 시만 |
| v30 | AI 자동 실행 | `SAFE_AUTO, aiAutoAllowed` | 안전 작업(사진정리·메모·작업일지·공정태그)은 승인 없이 자동 실행. 삭제·발송·수금은 항상 확인 |
| v30 | 주·월 운영 리포트 | 대시 [📊 운영]·더보기 | `opsReportData, opsReport` (수금·지출·손익·완료·견적·일정·사진·챙길일 종합 + AI 총평, ops_report 도구) |
| v31 | AI 자동 모드 설정 | 더보기 [⚙️]·비서 | `AUTO_ACTIONS, autoDisabledSet, aiSafeAutoOn, aiAutoModeManage` (안전작업 5종 항목별 켜고끄기 + 전체 자동 토글, auto_mode 도구) |
| v31 | 운영 리포트 자동 알림 | 부팅 자동·알림 | `opsReportDue, opsReportNotifyItems, opsReportMaybe` (일요일=주간/월말=월간, hjNotifyItems 연결) |
| v32 | 고객 응대 AI | 더보기 [💬]·비서 | `CS_TEMPLATES, customerReplyDialog` (견적/일정/진행/결제/완공/감사 6종 문자 초안 + AI 다듬기 + SMS 발송, customer_reply 도구) |
| v32 | AI 매출 예측 | 대시 [📈 예측]·비서 | `salesForecastData, salesForecast` (최근 3개월 가중평균+6개월 보정, 추세·신뢰도·현금흐름, sales_forecast 도구) |
| v33 | 계약서 AI | 견적 [📜 계약] 내 버튼 | `contractScopeText, CONTRACT_STANDARD_TERMS, contractAiTerms, contractAiButtonInit` (기존 간이 계약서에 공사범위·표준특약 AI 자동작성, ai_contract 도구) |
| v34 | 세금계산서 AI | 세금계산서 화면 내 버튼 | `taxItemSummary, taxInvoiceAiFill` (견적 항목을 세금계산서 품목으로 AI 정리) |
| v34 | PC↔폰 동기화 안내 | 더보기 [🔄]·비서 | `syncGuide` (구글 드라이브로 PC 작업→폰 확인 단계 안내, sync_guide 도구) + 실기기 체크리스트 v29~v34 반영 |
| v35 | ♿ 접근성(큰 글씨·고대비) | 더보기 [♿]·상단 가⁺·비서 | `a11yGet, a11ySave, a11yApply, a11yManage` (글씨 3단계 body 클래스 확대 + 고대비 CSS 변수 오버라이드, localStorage 저장, accessibility 도구) |
| v35 | 대시보드 정리 | 더보기 시트 | 더보기에 기능 검색 필터 추가 — 43개 기능을 타이핑으로 즉시 찾기 |
| v35 | AI 자율 재점검 | test_v28_autonomy | 89도구 환경에서 17 시나리오 재검증 통과 |
| v36 | AI 비서 음성 입력 | 비서 입력창 [🎙] | `aiVoiceToggle` (SpeechRecognition으로 말→입력→자동전송, 토글) |
| v36 | AI 두뇌 선택 | 더보기 [🔑]·비서 | `aiProviderLoad, aiProviderSet, aiProviderManage` (Gemini 무료/ChatGPT 유료 선택 + localStorage 저장, ai_provider 도구) |
| v37 | 🦙 Llama·커스텀 모델 | 더보기 [🦙]·제공자 화면·비서 | `llamaAsk, llamaConfig, llamaConfigLoad/Save, llamaReady, llamaSetup, LLAMA_PRESETS` (Ollama·LM Studio·Groq·Together 등 OpenAI 호환 엔드포인트 등록, 연결 테스트, aiAsk 라우터 통합+폴백, llama_setup 도구) |
| v38 | 🤖 OpenAI·Llama 스스로 도구 실행 | `aiFC` provider 분기 | `aiFC_openaiCompat, aiHistToOpenAI, aiToolsToOpenAI` (Gemini 전용이던 function calling을 OpenAI·Llama로 확장 — 세 두뇌 모두 89개 도구를 자율 실행. aiAgentSend의 키 체크도 aiKeyReady로 변경) |
| v39 | 📊 AI 사용량·비용 대시보드 | 더보기 [📊]·비서 | `aiUsageTrack, aiUsageDashboard, AI_PRICING` (제공자별 호출 수·토큰 집계 + 예상 비용(₩), 6개월 추이. geminiAsk·openaiAsk·llamaAsk에 추적 심음, ai_usage 도구) |

### 🤖 AI 자율 운영 검증 (v28 종합 점검)

AI 도구 78종 환경에서 자율 운영 시나리오 15종을 전수 검증(`test_v28_autonomy.js`, 15/15):
1. 아침 루틴(브리핑+일정) 2. 현장등록→견적(자율 2단계) 3. 수금→영수증 4. 지출→손익 5. 완공→청구서 6. 목표+예산 설정 7. 안전 삭제(사진 보존) 8. 조회 도구 10종 무오류 9. 잘못된 지시 방어 10. 자연어→도구 실행 관통(5/5).

**전체 테스트 현황**: 통합 스모크 69/69 · 라우팅 70/70(100%) · AI 자율 종합 10/10 · AI 복합 6/6 · 리허설 20/20 · 장애복구 10/10 · 자동저장 6/6 · v25~v27 신기능 40/40. **총 171개 항목 전건 통과, 콘솔 에러 0.**

기능 블록은 전부 마커 `/* ----- 사진 묶음 발송 … ----- */` **바로 앞**에 버전 순서대로 쌓여 있다.

## 3. 데이터 스키마 (serializeData 기준)

```js
{
  projects:[{ name, stage:0~3(STAGES), received, phases:[], doneAt?, dueDate?, geo?,
              cost:{material,labor,outsource}, customer:{name,phone,addr}, archived? }],
  files:[{ id, name, kind:'photo|estimate|doc', project|null, when:Date, _phase?,
           lat/lng?, text?(OCR), est:{amount,supply?,vat?,customer,date}?, _import? }],
  quotes:[{ id,no,title,date,project,vatIncluded,accountIdx,items:[{name,spec,qty,price}] }],
  schedule:[{ id,date,time,title,project,workers,memo,hours, report?:{done,actualWorkers,issue…},
              labor?:{names,amount} }],           // 통짜 직렬화 → 새 필드 자동 보존
  contacts:[{ id,name,phone,company,title,email,memo }],
  payLog:[{ d,project,amt }](최근 400),           // v2. setReceived가 증분 기록
  priceBook:{ 품목명: 단가 },                      // 원본 학습 + v6 관리 UI
  suppliers:[{name,phone}], supplierMap:{품목→거래처},  // v8
  asLog:[{ id,project,date,text,status:'open|doing|done' }],
  brand:{ color?, logo?(200px dataURL) } | null,   // v10
  learn:{…}, geocode:{…}                           // 원본
}
```
- IndexedDB: `hj_snaps`(스냅샷 12), `brand`아님(brand는 위 JSON), 키/설정류(`vision_key` 등).
- localStorage 플래그: `hj_ai_auto, hj_auto_org, hj_daily_dismiss, hj_glance(_on), hj_gcal_auto`.

## 4. 이벤트 위임 규약 ⚠️ (버그 3건의 원인이었음)

`setupDelegation()` 안에 리스너가 **종류별로 따로** 있다:
- `click`: `e.target.closest('거대한 셀렉터 문자열')` → `if(t.id==='…')` / `if(d.xxx!==undefined)` 체인
- `change` / `input`: 각각 별도 체인

**새 버튼 추가 시 반드시 두 곳을 함께 수정**: ① click 셀렉터 문자열에 `#내버튼`(또는 `[data-내속성]`) 추가, ② 같은 click 체인에 핸들러 추가. *change 체인에 click 핸들러를 넣으면 영원히 안 탄다*(v9에서 원본의 `#btnMoreClusters`·`[data-phasebtn]`이 정확히 이 상태로 죽어 있었고, `#btnOrganizeAll`은 셀렉터 누락으로 죽어 있었다 — 모두 복구됨).
정합성 검사는 `/home/claude/test_v9.js`의 "누락 전수 점검" 스니펫 참고(셀렉터 원문 vs `t.id===` 참조 diff).

## 5. 스냅샷·되돌리기 (v7)

- `hjSnapshot(label, force)` — 3분 스로틀. `🤖` 라벨은 **직전 스냅샷도 🤖일 때만** 45초 묶음(연속 AI작업 폭주 방지, 사람 작업 뒤엔 항상 남음).
- 훅 3곳: `markDirty()`(작업 중) / `saveProject` 성공(자동·수동 저장) / **에이전트 루프에서 AI_WRITE 실행 직전(force)**.
- 복구는 `backupHistory()` UI에서만. 복구 직전 상태도 `'복구 직전'`으로 자동 보관 → 복구의 복구 가능.
- v11 이사 마법사도 커밋 직전 `'이사 직전'` 스냅샷.

## 6. AI 도구 계약 (42종)

- 선언: `AI_TOOLS` 배열(name/description/parameters) — 설명에 *언제 호출할지* 트리거 문구를 적는 것이 품질 핵심.
- 실행: `aiToolRun(name,args)` switch. **조회 도구는 결과 객체 + `setTimeout(모달 열기,60)`** 패턴(모달 실패가 도구 실패가 되지 않게 try 격리).
- 변경 도구는 `AI_WRITE` Set 등록 → 루프가 `aiConfirm` 승인카드(⚡자동이면 통과) + 실행 직전 스냅샷.
- 다중 후보(현장명 등)는 오류 대신 `{여러곳/여러건:[…], 안내:'사용자에게 확인'}` 반환 → 모델이 되묻게.
- 카드용 요약: `aiActionLabel`(실행 전 라벨) / `aiResultBrief`(실행 후 한 줄).
- **도구 추가 절차(5곳)**: AI_TOOLS + aiToolRun case + aiActionLabel + aiResultBrief + (변경이면) AI_WRITE.

## 7. 이식(splice) 방법론 — 이 코드베이스를 고치는 법

1. `must(anchor, n)` 로 **고유 앵커 개수 검증 후** 치환(`rep`). 실패 시 즉시 exit → 파일 무변경.
2. ⚠️ **CRLF 혼재**: 원본 구간은 `\r\n`, 이식 구간은 `\n`. 여러 줄 앵커에 `\n}` 를 포함하면 자주 깨진다 → **짧은 한 줄 substring** 앵커 사용(v7·v10에서 각 1회 실패 경험).
3. 이식 후 파이프라인: `<script>` 추출 → `node --check` → puppeteer 헤드리스 기능테스트 → 통합 회귀(`test_all.js`, 도구 전수) → zip을 **다시 풀어** 재검증.
4. 캔버스 카드 검증: view 도구의 이미지 표시가 불안정하므로 **PIL 픽셀 검사**(색상 수 + 브랜드색 근접 매칭)로 대체.
5. 사진이 필요한 테스트는 `loadPhotoForExport`/`photoToB64` 스텁, AI는 `geminiAsk/geminiVision/aiFC` 스텁, 부작용은 `hjSendSms/window.open/clipboard/XLSX.writeFile/navigator.share` 캡처 스텁.

## 8. 수술 기록 (원본 잠복 버그)

| # | 증상 | 원인 | 수리 |
|---|---|---|---|
| 1 | 사진 12묶음 초과분 "더 보기" 무반응 → 뒷사진 열람 불가 | 핸들러가 change 리스너에 위치 + 셀렉터 누락 | click 체인 이동 + `#btnMoreClusters` 등록 (v9) |
| 2 | [📦 전체 정리완료] 무반응 | click 셀렉터 누락 | `#btnOrganizeAll` 등록 (v9) |
| 3 | 사진별 "공정 ▾" 무반응 → 개별 공정 지정 불가 | phasebtn 블록이 change 리스너에 | 블록을 click 체인으로 이식 + `[data-phasebtn]` 등록, select 교체→적용 전 플로우 검증 (v9) |
| 4 | 드라이브/백업 재불러오기마다 견적 파일이 무한 증식 | applyData 병합 중복판정이 name+prefix+size만 봐서 견적 가상파일(size 동일)이 매번 재-push | 안정 식별자 `key` 기준 중복 판정 추가 + kind 비교 보강. 반복 병합 멱등성 확보 (v12 감사) |
| 5 | 손상된 백업(JSON) 열면 앱 크래시 | applyData가 배열이어야 할 필드의 타입을 검사 안 함 → `.map`/`.filter` 예외 | 진입부 타입 정규화 가드(배열 아니면 무시, 항목 필터). 손상 백업도 안전하게 부분 복원 (v13 감사) |

## 8.5 품질 지표 (v13 감사 기준)

- **AI 도구 라우팅 정확도 100%** (실사용 질문 50개, `test_airoute.js`) — 도구 설명문의 트리거·구분 문구가 올바른 도구를 유도. "정리" 같은 애매어는 대상 명시("사진 정리"/"매출 정리")로 충돌 제거.
- **AI 자율운영 스트레스 0 발견** (`test_stress.js`) — 악성입력 방어·연쇄작업·대량 조회(≤45ms)·특수문자·XSS·병합 멱등.
- **장애 복구 10/10** (`test_resilience.js`) — 손상 백업·IDB 실패·CDN 실패·오프라인·연타·중첩 모달.
- **자동저장 6/6** (`test_autosave.js`) — 5000사진 108ms 완주, 재진입 방지(`__saving`/`__saveQueued`)로 동시 저장 경합 0.

## 9. 테스트 자산 (/home/claude, 컨테이너 기준)

- `test_v2~v11.js` 라운드별 · `test_all.js` 통합(도구 42 전수 스모크+실효 검증) · `test_rehearsal.js` **실사용 20 시나리오**(다크모드 스윕 포함).
- 실행: `cd work && python3 -m http.server 8899` 후 `node test_*.js`. 전 스위트 기준: 콘솔 에러 0.

## 10. 릴리스 노트(요약)

v1 AI비서/브리핑 → v2 사진정리·주간·수금이력 → v3 견적검토·월말 → v4 팔로업·거래처 → v5 파일철·오늘점검 → v6 단가장·포트폴리오·진행보고·알림 → v7 안전판·수익분석·PWA → v8 AS·발주·인건비·검색 → v9 설명서·지도·전체엑셀·⚡(+버그3 수술) → v10 브랜드·고객페이지·캘린더·리허설20 → v11 데이터 이사 마법사 → v12 온보딩 → v13 오프라인·자동저장 강건 → v14 AI 복합작업 자율처리 + 경영 대시보드 → v15 선제적 아침 비서 + 매출 추이 차트 → v16 정산 문서 AI 발송 → v17 AI 삭제·메모 권한 + 수금 영수증 → v18 부가세 신고 준비 + AI 수금 대송 → v19 스마트 알림 + 세금계산서 + AI 사진 작업일지 → v20 AI 주간 브리핑 + 간편 지출 장부 → v21 월별 실손익 → v22 일정 충돌 감지 + 거래처 관리 + 연간 결산 → v23 메뉴 카테고리 정리 + AI 비서 우선 배치 → v24 AI 먼저 제안 + 빠른 명령 카드 + 통합 검색 → v25 매출 목표 관리 + 제안 알림 → v26 음성 현장일지 + AI 경영 분석 + 현장 예산 → v27 일정 브리핑 강화 + AI 견적 자동작성 + 사진 AI 하자분석 → v28 종합 사용 가이드 + 실기기 체크리스트 최신화 → v29 OpenAI(ChatGPT) 지원 + AI 능동 브리핑 → v30 무료 Gemini 우선 + AI 자동 실행 + 주·월 운영 리포트 → v31 AI 자동 모드 설정 + 운영 리포트 자동 알림 → v32 고객 응대 AI(문자 초안) + AI 매출 예측 → v33 계약서 AI + AI 자율 운영 재점검 → v34 세금계산서 AI + PC↔폰 동기화 안내 → v35 ♿ 접근성 + 대시보드 검색 → v36 AI 비서 음성 입력 + AI 두뇌 선택 → v37 🦙 Llama·커스텀 모델 등록 → v38 🤖 OpenAI·Llama도 스스로 도구 실행 → **v39 📊 AI 사용량·비용 대시보드**.

*작성: Claude (Anthropic) — 2026-07-05, 리허설 20/20 · 도구 42종 전수 통과 시점 기준.*
