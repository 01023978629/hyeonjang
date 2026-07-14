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
| v40 | 🌤 날씨 연동 스마트 공정 | 더보기 [🌤]·비서 | `weatherFetch(무료 Open-Meteo), WEATHER_SENSITIVE, weatherRisksForDate, weatherSmart` (5일 예보 + 도장·방수·미장·도배 등 비/습기 민감 공정 경고·AI 재배치, weather 도구) |
| v40 | 🏷 명함·영수증 사진 스캔 | 더보기 [🏷][🧾]·비서 | `cardReceiptScan, cardScanConfirm, receiptScanConfirm` (geminiVision으로 명함→거래처·영수증→지출 자동 등록, scan_card·scan_receipt 도구) |
| v41 | 📸 Before/After 갤러리 | 더보기 [📸]·비서 | `beforeAfterPairs, beforeAfterGallery, beforeAfterShare` (사진 공정으로 전후 짝짓기·홍보용 공유 페이지, before_after 도구) |
| v41 | 📱 고객 진행 공유 | 더보기 [📱]·비서 | `customerProgressV2, customerProgressPage` (진행 단계 바·안내 문자·공유 페이지. 기존 customer_progress 도구와 별도 함수로 분리) |
| v42 | 🎙 현장 대화 → 할일 | 더보기 [🎙]·비서 | `siteConversation, convMicToggle, convExtractTodos` (SpeechRecognition 녹음→AI 할일 추출→메모 저장, site_conversation 도구) |
| v42 | 📈 수주 성공 분석 | 더보기 [📈]·비서 | `winRateData, winRateCoach` (수주=견적의 현장 연결로 집계, 금액대별 수주율·AI 영업 코칭, win_rate 도구) |
| v43 | 🗓 공정표 자동 생성 | 더보기 [🗓]·비서 | `PLAN_RULES, planFromItems, planAssignDates, schedulePlanDialog` (견적→AI/규칙 공정 순서·기간→일요일 스킵 날짜 배정→일정표 일괄 등록, schedule_plan 도구) |
| v43 | 🤝 AI 견적 협상 도우미 | 더보기 [🤝]·비서 | `negotiateCalc, negotiateDialog` (희망가→할인율·마진(원가 70% 가정)·손해 판정 + AI 조정항목·마지노선·협상 멘트, negotiate 도구) |
| v44 | 🛡 AS 보증 만료 추적 | 더보기 [🛡]·비서 | `warrantyList, warrantyDue, warrantyManage, warrantySms` (완공일+보증개월로 만료일 계산·60일 임박 알림·무상점검 문자, warranty_manage 도구) |
| v44 | 📚 시공 노하우 축적 | 더보기 [📚]·비서 | `knowhowSave, knowhowList, knowhowRelevant, knowhowManage, knowhowRemind` ([노하우] 태그 메모·단지/평형 키워드 매칭 리마인드, knowhow·knowhow_remind 도구) |
| v45 | 🔨 현장 안전 체크리스트 | 더보기 [🔨]·비서 | `SAFETY_RULES, safetyChecklist, safetyAI` (철거·전기·고소작업 등 6종 안전수칙+공통, AI 현장맞춤, safety_check 도구) |
| v45 | 📅 계절별 영업 달력 | 더보기 [📅]·비서 | `SEASON_CALENDAR, seasonCalendar` (12개월 인테리어 수요·성수기·홍보 타이밍+AI 홍보문구, season_calendar 도구) |
| v46 | 🗺 AI 현장 동선 최적화 | 더보기 [🗺]·비서 | `geoDist, projCoord, routeOptimize, routeToday` (하버사인 거리+최근접이웃 경로+카카오맵 길찾기, route_today 도구) |
| v46 | 📊 AI 월간 경영 보고서 | 더보기 [📊]·비서 | `monthlyReportData, monthlyReport, monthlyReportPage` (매출·지출·순이익·수주율·미수금 종합+AI 총평+공유 페이지, monthly_report 도구) |
| v47 | 🔔 알림 센터 | 더보기 [🔔]·비서 | `briefExtraItems, alertCenter` (기존 능동브리핑 확장 — 일정·미수금·보증만료·AS·목표를 한 화면에, 항목 클릭→처리 이동, alert_center 도구) |
| v47 | 📸 견적 사진 자동 분석 | 더보기 [📸]·비서 | `photoQuoteScan, photoQuoteResult` (geminiVision으로 방 사진→면적·자재·개략견적 추정→견적서 초안 자동, photo_quote 도구) |
| v48 | 💬 고객 셀프 견적 링크 | 더보기 [💬]·비서 | `SELF_QUOTE_WORKS, selfQuoteCalc, selfQuoteDialog, selfQuotePage` (평형·공사 선택→개략 견적 페이지, self_quote 도구) |
| v48 | 🎯 AI 영업 타깃 추천 | 더보기 [🎯]·비서 | `salesTargetData, salesTarget` (완공시기·관계·규모 점수화→재수주 우선순위+안부 문자, sales_target 도구) |
| v49 | 🗣 AI 음성 브리핑(TTS) | 더보기 [🗣]·비서 | `ttsBriefText, ttsSpeak, ttsStop, voiceBrief` (SpeechSynthesis로 오늘 일정·미수금·보증·AS를 음성 재생, voice_brief 도구) |
| v50 | 💸 예산 초과 실시간 경고 | 더보기 [💸]·비서 | `budgetAlertData, budgetAlert` (지출 vs 예산/견적70% 초과율, 80%↑ 경고·게이지, budget_alert 도구) |
| v50 | 📉 적자 현장 조기 경보 | 더보기 [📉]·비서 | `lossAlertData, lossAlert` (진행 현장 마진율<15% 경보·적자 표시+AI 조언, loss_alert 도구) |
| v51 | 📊 현금 흐름 예측 캘린더 | 더보기 [📊]·비서 | `cashFlowData, cashFlow` (4주 수금 예정·인건비 지출 예측·누적 잔고·자금부족 경고, cash_flow 도구) |
| v51 | 🧾 자동 경비 분류 | 더보기 [🧾]·비서 | `EXPENSE_KEYWORDS, guessExpenseCategory, expenseAutoClassify` (거래처·메모 키워드로 자재·인건비·유류 자동 분류, expense_classify 도구) |
| v52 | 📝 계약서 위험 조항 검토 | 더보기 [📝]·비서 | `CONTRACT_CHECKLIST, contractReview` (대금·범위·추가공사 등 7개 보호조항 누락 점검+AI 문구, contract_review 도구) |
| v52 | 🔄 반복 고객 자동 인식 | 더보기 [🔄]·비서 | `repeatCustomerData, findExistingCustomer, repeatCustomers` (전화·이름으로 단골 2회↑ 자동 묶음·누적거래액, repeat_customers 도구) |
| v53 | 🦙 Ollama 선택·사용 강화 | 두뇌 선택·비서 | `LLAMA_PRESETS(Ollama 첫 항목), llamaSetup(설치 3단계 안내), aiProviderManage(Llama 카드)` — Ollama는 이미 완전 지원. llama_setup·ai_provider 도구 설명에 '올라마/무료 AI/내 PC AI' 키워드 추가로 자연어 라우팅 강화. 신규 도구 없음(116 유지) |
| v54 | 🦙 Llama 모델 선택 UI | llamaSetup 개선 | `llamaFetchModels(Ollama /api/tags·OpenAI /v1/models 조회), LLAMA_PRESETS+models/needKey/keyUrl/keyGuide` — 모델 칩 선택(제공자별 인기모델)·[설치된 모델 불러오기] 자동감지·API키 배지(로컬 불필요/온라인 필요)·키 발급 링크·저장 시 두뇌 자동 llama 전환 |
| v55 | 🤖 AI 운영 모드 화면 | 더보기 [🤖 AI 운영 모드]·auto_mode 도구 | `aiOperateMode, aiProviderStatus` — ON/OFF 큰 토글(hj_ai_auto 저장·비서 체크박스 동기화)+설정에서 AI 두뇌 선택(Gemini/ChatGPT/Ollama 카드, 미등록은 등록화면 유도)+세부 자동화 링크. 비서에 말 안 해도 설정에서 직접 켜고 AI 고름 |
| v56 | ⏰ 견적 골든타임 팔로업 | 더보기 [⏰]·비서 | `quoteFollowupData, quoteFollowup, quoteFollowupSmsText` (작성 3~30일 미수주 견적 감지·7일내 🔥표시·팔로업 문자 초안, quote_followup 도구) |
| v56 | 🔍 유사 현장 견적 참고 | 더보기 [🔍]·비서 | `QUOTE_WORK_KEYS, quoteWorkSet, similarQuotes, similarQuoteDialog` (공정 키워드 유사도+금액대 근접+수주 가산 점수, 총액 차이% 비교, similar_quotes 도구) |
| v57 | 🗣 완공 후 리뷰·소개 요청 | 더보기 [🗣]·알림센터·비서 | `reviewRequestData, reviewRequest, reviewRequestSms, reviewRequested` (완공 90일 내·연락처·미요청 감지, 14일내 🔥, [리뷰요청:현장] 노트로 중복 방지, 알림센터 연동, review_request 도구) |
| v57 | 🏆 연말 결산 리포트 | 더보기 [🏆]·비서 | `yearReportData, yearReport` (연 매출·지출·순이익·전년 대비 성장률·완공 수·베스트 현장 TOP3+AI 총평, year_report 도구 year 지정 가능) |
| v57 | 🎓 AI 기능 코치 | 더보기 [🎓]·비서 | `coachPool, featureCoach` (HJ_HELP의 say 항목 풀에서 안 본 것 우선 3개 추천·▶해보기→비서 자동실행·hj_coach_seen 기록, feature_coach 도구) |
| v58 | 🧯 데이터 건강 검진 | 더보기 [🧯]·비서 | `dataHealthData, dataHealth` (연락처·고객명·완공일·견적 누락 점검·건강 점수 100점 만점, data_health 도구) |
| v58 | 💤 방치 현장 알림 | 더보기 [💤]·알림센터·비서 | `projLastActivity, staleProjectData, staleProjects` (파일 when·일정 date 최근활동 기준 14일↑ 무활동 진행현장 감지+안부 문자, 알림센터 연동, stale_projects 도구) |
| v59 | 🎯 주간 계획 AI | 더보기 [🎯]·비서 | `weekPlanData, weekPlan` (다음 7일 요일별 일정+챙길 일(briefExtra·팔로업 연동)+AI 우선순위 조언, week_plan 도구) |
| v59 | 🪪 디지털 회사 소개 페이지 | 더보기 [🪪]·비서 | `companyIntro, companyIntroPage` (COMPANY 정보+실적 배지+강점+전화 걸기 원페이지, hjDocShell HTML, company_intro 도구) |
| v60 | 🤖 AI 자율 운영 루프 (Planner→Queue→Approval→Executor→Log→NextCheck) | 더보기 [🤖 AI 운영 센터]·ai_ops 도구·부팅 자동 | **6단계 파이프라인 코드 연결.** `state.aiOps={queue,log,lastPlan,nextCheck,intervalHours}` (직렬화 serializeData/applyData 양쪽 반영). ①`aiPlannerScan` 기존 탐지함수(warrantyDue·reviewRequestData·staleProjectData·quoteFollowupData·budgetAlertData·lossAlertData)로 task 생성·우선순위 정렬 ②`aiQueueEnqueue` source 기준 중복제거+최근7일 done 스킵 ③`aiQueueApprove`/`aiQueueReject`/`aiQueueAutoApprove`(자동모드 safe만) ④`aiExecuteTask`/`aiExecuteApproved` action.kind별(sms→발송 함수, open→화면, tool→aiToolRun) 실행 ⑤`aiOpsLog` 최근200건 ⑥`aiScheduleNextCheck`+`aiRunPlanner`+`aiOpsBootCheck`(부팅 시 예약 지났으면 자동 Planner, 최초엔 실행 안 함). `staleProjectSms` 헬퍼 추가. UI `aiOpsCenter`(Planner 버튼·큐 승인/실행·로그·다음점검·주기칩). **문자 발송은 항상 승인→실행. 자동 실행은 큐 생성까지만.** ai_ops 도구(무승인=화면). |
| v61 | 🤖 AI 운영 루프 Daily/Weekly/Monthly 완성 | 더보기 [🔁 AI 운영 센터]·ops_loop_* 도구 15종·부팅/visibility/interval 자동 | **Daily/Weekly/Monthly Scan → Planner → Queue → Approval → Executor → Log → Next Check 전체 코드 연결.** state.aiOps 확장(enabled·lastDaily/Weekly/MonthlyKey·settings{dailyRunHour,weeklyRunDay,monthlyRunDay,autoReadOnly,requireApprovalForWrites,maxActionsPerRun,stalePendingDays}·stats{totalCreated,totalDone,totalFailed,lastRunSource}), v60 데이터 `aiOpsEnsureState`/`aiOpsMigrateTask` 마이그레이션(숫자 priority→urgent/high/normal/low 등급). 직렬화는 state.aiOps 전체 저장이라 자동 반영. **Planner**(`aiPlannerScan(scope)`) A~I 9개 루프: 미수금(예정일 지남=urgent)·오늘/내일 브리핑·일정충돌·작업일지 누락(projLastActivity)·미배정 사진·견적 팔로업·예산/적자·A/S(보증·리뷰·방치)·주간리포트·월말결산. **Queue**(`aiQueueEnqueue`/`aiQueueFindDuplicate` source+type/project/dueDate/title 중복방지·done은 24h 재생성막기, `aiQueueMarkStale` stalePendingDays, `aiQueueEnqueueMany` maxActionsPerRun 제한+autoReadOnly 자동승인). **Approval**(`aiQueueApprove`/`Dismiss`/`Postpone`/`Retry`). **Executor**(`aiExecuteTask` hjSnapshot→sms/open/tool(aiToolRun suggestedTool)→done/failed·stats·saveProject·render, write는 requiresApproval 없이 실행금지). **Log**(`aiOpsLog` 300건). **Loops**(`aiRunDailyLoop`/`Weekly`/`Monthly`/`aiRunManualCheck`/`aiRunLightCheck`, `aiOpsShouldRunDaily/Weekly/Monthly` 키+시간/요일/월말윈도우 판정). **Reports 5종**(`aiOpsDailyBrief`/`WeeklyReport`/`MonthlyReport`/`ReceivableReport`/`RiskReport` read-only, `aiOpsReportView`). **UI**(`aiOpsCenter`+`aiOpsQueueView`카테고리필터+`aiOpsLogView`+`aiOpsSettings`). **트리거**: 부팅 aiOpsBootCheck, visibilitychange visible시 aiOpsVisibilityCheck, setInterval 1h aiOpsIntervalCheck(모두 due 루프만·중복 폭발 방지). **도구 15종**: ops_loop_run/daily/weekly/monthly/queue/approve/dismiss/logs/settings/summary/report_daily/weekly/monthly/receivable/risk (기존 ai_ops 유지). **시스템 프롬프트**(aiSys) opsRule 추가. v60 호환 별칭 aiOpsState/aiScheduleNextCheck/aiRunPlanner/aiQueueReject 유지. |
| v62 | 🔁 운영 루프 대시보드 통합 + 알림 연동 + 배치 승인 | 대시보드 홈 카드·알림 센터·운영 센터 [배치]·ops_loop_batch 도구 | **①대시보드 카드**: `aiOpsCardHTML()`(dailyCheckCardHTML 뒤 홈 삽입, 루프 ON·작업 있을 때만 표시, top3+승인분 실행 버튼)+`aiOpsExecuteApprovedFromCard`. **②알림↔큐 양방향**: `aiOpsEnqueueFromAlerts`(briefExtraItems→큐, warranty/review/stale/goal 매핑)·`aiOpsUrgentForAlert`(큐 긴급/높음→알림 [운영] 태그, alertCenter의 all 조합 앞에 concat, 클릭 시 act='ops'→aiOpsCenter). **③배치 승인**: `aiQueueApproveBatch(mode,value)`(all/category/priority/readonly 일괄 승인)·`aiExecuteBatch(scope)`(approved/category/safe 일괄 실행→{done,failed,items})·`aiOpsBatchResultView`(실행 결과 요약 화면)·`aiOpsBatchApprove`(카테고리별·긴급·조회전체 일괄 승인 UI). 운영 센터에 [✅배치] 버튼. ops_loop_batch 도구(무승인). |
| v63 | 📦 자재 재고·발주 관리 | 더보기 [📦]·inventory 도구 | **state.inventory=[{id,name,unit,qty,minQty,supplier,updatedAt}]** (직렬화 양쪽 반영). `inventoryEnsure/inventoryLowStock/inventoryManage/inventoryAdd` — 수량 +/− 관리·qty≤minQty 재주문 알림·materialOrder 발주 연결. |
| v63 | 🏆 현장별 수익성 랭킹 | 더보기 [🏆]·profit_rank 도구 | `profitRankData/profitRank` — projStats의 매출(max(est,recv))-원가(material+labor+outsource) 이익 순위·마진율·메달·평균마진, 15% 미만 경고. |
| v64 | 👥 고객 타임라인(CRM) | 더보기 [👥]·customer_crm 도구 | `customerKey`(phone 우선) `customerListData`(고객별 현장·거래액 그룹핑·단골 표시) `customerTimeline`(완공·미수·수금payLog·리뷰노트 시간순) `crmDialog`(목록/상세·요약·전화/문자). 참고: 체크리스트·Before/After·음성메모·매출예측·세금계산서는 기존 기능 활용(중복 개발 안 함). |
| v65 | 📊 견적 전환율 퍼널 | 더보기 [📊]·sales_funnel 도구 | `funnelData/funnelView` — STAGES 단계별 현장 누적 수(stage 이상 도달)+전 단계 대비 전환율+견적→계약(quotes project 유무) 비율, 최저 전환 단계 병목 진단. |
| v66 | 🧠 Loop Engineering — 닫힌 루프(closed loop) | 더보기 [🧠 AI 브레인]·[🔁 루프 성숙도]·운영센터 버튼·ops_loop_brain/status 도구 | **규칙 기반 one-shot → AI 추론 + 자가 순환.** ②후속 체이닝 `aiOpsChainNext(doneTask)`: task 완료 시 결과 확인 후속 task 자동 생성(미수금→3일후 입금확인, 보증→5일후 방문확인, 리뷰→5일후 후기확인, 방치→7일후 재확인). aiExecuteTask 완료 직후 훅. 후속은 readOnly·승인불필요·source 'chain:...'. ④성과추적 `aiOpsOutcomeStats`→{executed,done,failed,chained,successRate}. ③자가진단 `aiOpsSelfCheck`→{score 0~100,grade,factors[4]:루프활성·성공률·큐관리·체이닝,stats}. `aiOpsLoopStatus` UI(점수·등급·성숙도단계·진단항목·누적성과). ①AI브레인 `aiOpsBrain`(async): aiAsk에 현재 상태(진행현장·일정·미수금·큐) 주고 "오늘 먼저 할 일 3가지+이유" 추론, aiKeyReady 필요. |
| v67 | 🤖 완전 자율 운영(오토파일럿) | 더보기 [🤖 AI 자율 운영]·운영센터 대표 버튼·auto_operate 도구 | **안전 작업 자동 실행 + 알림 넛지 + 원탭 통합.** `aiOpsIsAutoRunnable(t)`: readOnly && action.kind==='tool'만 자동 실행 대상(open/sms/write 제외). `aiOpsAutoExecuteSafe()`: 조회·리포트 도구 task를 승인 없이 자동 실행·로그. `aiOpsNotifyPending()`: 알림 권한 granted 시 긴급/높음 승인 대기를 Notification으로 알림(클릭→운영센터), visibilitychange 훅에 연결. `aiAutoOperate(source)`: 전체스캔→안전작업 자동실행→자가진단→승인 대기(write) 분리. `aiAutoOperateView()`: "AI가 자동 처리한 일 + 사장님 승인 필요한 일" 통합 리포트, 개별/전체 승인. **문자·수금 등 write는 항상 승인 유지.** |
| | **v67 테스트** | test_v67_autopilot.js 11/11 Pass | 자율실행 판별(tool=O,sms/open=X)·안전작업 자동실행·write 자동실행 차단·원탭 자율운영·리포트 화면·승인버튼·알림넛지(권한없음 스킵/granted 발송/긴급없음 스킵)·도구/진입점·라우팅. 회귀: 스모크129·v66 13·v65 15·v63 10·v62 15·v61운영루프26·자율17·라우팅70·리허설20·장애복구10 전건 Pass, 콘솔에러 0. |
| | **E2E 통합 검증** | test_e2e_loop.js 12/12 Pass | 실제 하루 시나리오 관통: 아침 부팅→루프 자동점검→Planner 6종 감지→긴급 정렬→오토파일럿(안전작업 자동실행+문자 승인대기 미발송)→승인 후 문자 실행→후속 체이닝→로그 전과정→자가진단→다음점검 예약→저장복원→재부팅 중복방지→빈데이터 무오류. **전체 닫힌 루프가 하나의 시스템으로 작동함을 증명.** 별도 산출물: AI자율운영_검증보고서.md |
| v68 | 🎛 더보기 UX 개선(카테고리·바로가기·검색) | openMoreSheet → openMoreSheetV2 위임 | **91개 기능을 6개 카테고리로 정리.** MORE_CATS[{id,name,ic,items:[[action,ic,label]]}] 6그룹(🤖AI·자율운영/💰경영·돈/👥고객·영업/🏗현장·시공/📊분석·리포트/⚙️도구·설정). 기존 else-if 핸들러 체인을 `moreActionHandler(a)`로 추출해 재사용(91개 분기 그대로). `openMoreSheetV2`: 검색·AI힌트·📌바로가기(하단탭)·🕘최근사용(localStorage hj_more_recent, moreTrackUse/moreGetRecent 최근 6개)·카테고리 그리드. 검색은 라벨/카테고리명 실시간 필터. **⚠️ 더보기 항목 추가 시 MORE_CATS에도 [action,ic,label] 추가 필수**(안 하면 카테고리에 안 보임, moreActionHandler 분기는 별도). openMoreSheet은 V2 위임 실패 시 구버전 폴백. |
| | **v68 테스트** | test_v68_moreux.js 11/11 Pass | 6카테고리(91개)·렌더·항목클릭 실행+시트닫힘·최근사용 추적/노출·검색 필터/결과클릭/없음안내·바로가기 탭전환·핸들러 연결(91개 누락0)·AI힌트. 회귀: 스모크129·E2E12·자율운영11·퍼널15·라우팅70·리허설20·장애복구10·자율17 전건 Pass, 콘솔에러 0. |
| v69 | 🖥 Cowork 작업 지휘부 | 더보기 [🖥 Cowork 지휘부](MORE_CATS AI 카테고리 맨앞)·cowork_tasks 도구 | **PC의 Claude Cowork에게 시킬 명령서를 앱에 보관·복사·수정·추가.** state.coworkTasks=[{id,icon,title,prompt,builtin}] + state._coworkInit(직렬화 양쪽). `coworkDefaults()` 기본 4종(회사정보 자동 반영): 카드내역 정리·세금계산서 매출매입 대조(사업자번호+홈택스 자동접속 금지 주의)·현장사진 담당자별 정리 전송준비·월간 종합. `coworkTasksEnsure`(최초 1회 기본 채움, _coworkInit 플래그로 전체 삭제 상태 유지)·`coworkCopy`(navigator.clipboard+execCommand 폴백)·`coworkTasksManage`(목록·복사/전체/수정)·`coworkTaskView`(전체보기+복사)·`coworkTaskEdit`(id null=신규, 내 작업만 삭제, 기본작업 삭제버튼 없음)·기본값 복원(내 작업 유지). **홈택스 자동 로그인/카톡 자동 발송은 반자동(사람이 로그인·전송)** 방침을 프롬프트에 명시. |
| | **v69 테스트** | test_v69_cowork.js 12/12 Pass | 기본4종(회사정보)·세금계산서 주의문구·목록화면·복사(클립보드)·전체보기+복사·추가·수정·삭제(기본작업 보호)·직렬화·기본값복원(내작업유지)·도구/MORE_CATS/더보기·라우팅. 회귀: 스모크·v68 11·E2E12·자율11·퍼널15·라우팅70·리허설20·장애복구10 전건 Pass, 콘솔에러 0. |
| v70 | 🔧 기능 보완(보안 감사 후속) | briefExtraItems·coworkDefaults 수정 | 보안 감사 결과 코드 기본기는 양호(XSS escape 처리·API키 IndexedDB·시크릿 미노출 확인). 실질 보완 2건: ① **자재 재고 부족 → 홈 브리핑·알림 센터 연동**(briefExtraItems에 inventoryLowStock 항목 추가, action:'inventory'로 클릭 시 자재 화면. 기존엔 자재 화면 직접 열어야만 부족 확인 가능했음). ② **Cowork 사진 프롬프트에 진행 현장 자동 삽입**(coworkDefaults에서 stage<3 현장 목록을 siteList로 생성해 담당자 명단 슬롯에 자동 채움, 완공 현장 제외, 현장 없으면 예시 폴백). |
| | **v70 테스트** | test_v70_polish.js 7/7 Pass | 재고 부족 브리핑 표시/충분 시 미표시/알림 클릭 매핑 · Cowork 현장 자동삽입(완공제외)/폴백/기본값복원 반영 · 브리핑 기존항목 회귀. 회귀: 스모크130·v69 12·v68 11·v63 10·E2E12·운영루프26·라우팅70·리허설20·장애복구10 전건 Pass, 콘솔에러 0. |
| v71 | ⭐ 데이터 안심 3종(개인도구 별5개) | 홈 백업카드·부팅체크·markDirty훅·backup_center 도구·더보기 [💾 백업 센터] | **폰 한 대 의존 → 잊지 않고 챙기는 백업.** ① **자동 백업 알림**: `backupNeeded`(데이터 있고 7일+ 미백업), `backupCardHTML`(홈 노란 카드, 인라인 onclick→backupNow), `backupMarkDone`/`backupLastInfo`/`backupDaysSince`(localStorage hj_last_backup). exportData 성공 시 자동 기록. ② **드라이브 자동 백업 강화**: `backupDriveAuto`(markDirty 훅, 4초 디바운스→기존 gdBackup 호출, 토큰 없으면 스킵), `backupBootCheck`(부팅 시 gdBackup 시도+30일+ 토스트). ③ **실수 방지**: `backupGuard(name,fn)`(위험 작업 전 "백업하고 진행/없이 진행/취소", 2일 내 백업이면 게이트 생략), importData(복원=덮어쓰기)에 __bkGuardPass 재귀방지 게이트. `backupCenter` UI(마지막 백업·클라우드 상태·지금 백업·드라이브 연결·복원). |
| | **v71 테스트** | test_v71_backup.js 12/12 Pass | 백업필요 판단/데이터없음/경과일/홈카드 표시·숨김 · 드라이브 자동(디바운스)/미연결 스킵/부팅 시도 · 게이트(확인 후 실행)/최근백업 생략 · 센터화면 · 도구/MORE_CATS/더보기. 회귀: 스모크131·자동저장6(게이트 영향없음)·v70 7·v69 12·v68 11·E2E12·라우팅70·리허설20·장애복구10 전건 Pass, 콘솔에러 0. |
| | **v66 테스트** | test_v66_loopeng.js 13/13 Pass | 후속체이닝(미수금/보증/리뷰→후속·로그·승인불필요)·성과통계(성공률)·자가진단(점수/등급/4항목/상태반영)·성숙도화면·AI브레인(조언표시/미설정안내)·도구·통합(실행→체이닝→자가진단). 회귀: 스모크129·v65 15·v64 8·v63 10·v62 15·v61운영루프26·자율17·라우팅70·리허설20 전건 Pass, 콘솔에러 0. |
| v65 | 📅 정기 입금·분할납 알림 | 더보기 [📅]·pay_plan 도구 | `payPlanDialog` — 계약금·중도금·잔금 비율 슬라이더(합계 100% 체크)+예약일→schedule에 💰 일정 등록(미수금/알림 연계)+입금 안내 문자. projStats.est로 금액 계산. |
| v65 | 📩 AS 셀프 접수 링크 | 더보기 [📩]·as_intake 도구 | `asIntakePage/asIntake` — hjDocShell 고객 대면 A/S 신청 페이지(전화·문자 신청 버튼·현장/증상/사진 요청 안내), 링크·캡처 공유. |
| v65 | ⭐ 고객 만족도 별점 수집 | 더보기 [⭐]·satisfaction 도구 | **state.satisfaction=[{id,project,customer,stars,comment,at}]**(직렬화 양쪽). `satisfactionEnsure/Stats/Manage/Add/Request` — 별점 기록·평균·5단계 분포 막대·후기·완공 고객 별점 요청 문자. |
| | **v65 테스트** | test_v65.js 15/15 Pass | 퍼널(데이터/화면/도구)·분할납(화면/예약3건/문자/도구)·AS접수(페이지/내용/도구)·만족도(통계/화면/직렬화/요청/도구). 회귀: 스모크128·v64 8·v63 10·v61운영루프26·자율17·라우팅70·리허설20 전건 Pass, 콘솔에러 0. |
| | **v63~v64 테스트** | test_v63.js 10/10·test_v64.js 8/8 Pass | 재고 추가/부족감지/증감/직렬화/도구 · 수익성 계산/정렬/화면/방어/도구 · CRM 그룹핑/타임라인/상세/문자/방어/도구. 회귀: 스모크125·v62 15·v61운영루프26·자율17·라우팅70·리허설20·장애복구10 전건 Pass, 콘솔에러 0. |
| | **v62 테스트 결과** | test_v62.js 15/15 Pass | 대시보드 카드(작업 있을 때 표시·없으면 숨김·OFF 숨김·홈 노출)·알림 연동(큐 긴급→[운영] 태그·알림 센터 표시·알림→큐 적재)·배치 승인(카테고리·우선순위·readonly 일괄)·배치 실행(결과 요약·화면)·배치 UI·도구. 회귀: 스모크122·v61운영루프26·v61라우팅8·자율17·라우팅70·리허설20·장애복구10·자동저장6 전건 Pass, 콘솔에러 0. |
| | **v61 테스트 결과** | test_v61_opsloop.js 26/26 Pass | 마이그레이션·빈데이터·미수금/일정/작업일지/사진/견적/예산/주간/월말 액션생성·큐중복방지·maxActions제한·stale·승인전write차단·승인후실행·tool실행·실패/재시도·저장복원·루프키·리포트5종·트리거·interval폭발방지·도구13연결·UI. 회귀: 스모크121·자율17·라우팅70·운영모드9·Llama8·리허설20·장애복구10·자동저장6·v61라우팅8 전건 Pass, 콘솔에러 0. |

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

v1 AI비서/브리핑 → v2 사진정리·주간·수금이력 → v3 견적검토·월말 → v4 팔로업·거래처 → v5 파일철·오늘점검 → v6 단가장·포트폴리오·진행보고·알림 → v7 안전판·수익분석·PWA → v8 AS·발주·인건비·검색 → v9 설명서·지도·전체엑셀·⚡(+버그3 수술) → v10 브랜드·고객페이지·캘린더·리허설20 → v11 데이터 이사 마법사 → v12 온보딩 → v13 오프라인·자동저장 강건 → v14 AI 복합작업 자율처리 + 경영 대시보드 → v15 선제적 아침 비서 + 매출 추이 차트 → v16 정산 문서 AI 발송 → v17 AI 삭제·메모 권한 + 수금 영수증 → v18 부가세 신고 준비 + AI 수금 대송 → v19 스마트 알림 + 세금계산서 + AI 사진 작업일지 → v20 AI 주간 브리핑 + 간편 지출 장부 → v21 월별 실손익 → v22 일정 충돌 감지 + 거래처 관리 + 연간 결산 → v23 메뉴 카테고리 정리 + AI 비서 우선 배치 → v24 AI 먼저 제안 + 빠른 명령 카드 + 통합 검색 → v25 매출 목표 관리 + 제안 알림 → v26 음성 현장일지 + AI 경영 분석 + 현장 예산 → v27 일정 브리핑 강화 + AI 견적 자동작성 + 사진 AI 하자분석 → v28 종합 사용 가이드 + 실기기 체크리스트 최신화 → v29 OpenAI(ChatGPT) 지원 + AI 능동 브리핑 → v30 무료 Gemini 우선 + AI 자동 실행 + 주·월 운영 리포트 → v31 AI 자동 모드 설정 + 운영 리포트 자동 알림 → v32 고객 응대 AI(문자 초안) + AI 매출 예측 → v33 계약서 AI + AI 자율 운영 재점검 → v34 세금계산서 AI + PC↔폰 동기화 안내 → v35 ♿ 접근성 + 대시보드 검색 → v36 AI 비서 음성 입력 + AI 두뇌 선택 → v37 🦙 Llama·커스텀 모델 등록 → v38 🤖 OpenAI·Llama도 스스로 도구 실행 → v39 📊 AI 사용량·비용 대시보드 → v40~v42 🎨 창의 기능 6종 → v43 🗓 공정표 + 🤝 협상 → v44~v46 🎨 창의 6종 → v47~v49 🎨 창의 5종 → **v50~v52 💰 재무 안전 6종(예산 경고·적자 경보·현금흐름 예측·경비 분류·계약 검토·반복 고객)**.

## 11. 외부 연동 — 홈페이지 상담 리드 인입 (manmool)

공개 홍보·상담 사이트(`manmool`)의 상담 폼 → **`?lead=<base64url(JSON)>` 딥링크**로 현장 앱에 유입.

- 진입점: 앱 부팅 시 `location.search`/`hash`의 `lead` 파라미터 감지 (`__hjLead`).
- 핵심 함수: `hjLeadParse`(디코드) → `hjLeadIntake`(확인 모달) → `hjLeadCreate`(등록).
- 동작: 스냅샷(`hjSnapshot`) 후 `state.projects`에 새 현장 + `customer`(name/phone/addr) + `state.notes`에 상담 상세 메모. `markDirty→render→toast`. 처리 후 URL 파라미터 제거(새로고침 재발동 방지).
- **신규 직렬화 필드 없음** — 기존 `projects/customer/notes`만 사용하므로 §3(serialize/applyData) 변경 불필요.
- 안전: 되돌리기 위험작업 아님(사용자가 링크를 직접 클릭). 그래도 등록 전 스냅샷 + 확인 모달로 승인 후 생성.
- 리드 JSON 키: `name, phone, region(addr), type, area, scope, works[], budget, movein, estimateHint, memo`.

*작성: Claude (Anthropic) — 2026-07-05, 리허설 20/20 · 도구 42종 전수 통과 시점 기준. (2026-07-14 v103: manmool 리드 연동 추가)*
