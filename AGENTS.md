# 코덱스 인수인계서 — hyeonjang (현장 앱)

> 이 저장소에서 작업하는 모든 AI 에이전트(Codex·Claude)가 시작 전에 읽는 문서.
> 2026-09-07 기준. 낡은 내용을 발견하면 **이 문서부터 고쳐라.**

## 2026-10-24 v489 🧪 데모 팀 보고 3건 — 노트 창 칩 시연 (개발_백로그)

- `loadDemo`: 망원동 카페 `cafe.teamReports=[{key:'wr_demo_blocked',status:'blocked',workDate:이번 날짜-3,reporter:'김 기사',issue:'베란다 배수구 부속 미도착 — 내일 오전 입고 예정',…}]`(지시 없는 '보고만'). 보고 3건·보고자 2명이라 데모 노트 창에 칩(v475)이 뜨고, 첫 화면에 '⛔ 막힘 1건' 줄 '· 3일째'(v481). 데모는 여전히 어디에도 저장되지 않는다(_demo).
- 데모 알림의 팀 보고 수는 세어서(`hjTeamReportsOf` 합) — 예전엔 '팀 보고 2건' 글자 그대로였다.
- tests/demo-v462 기대값 손질: 알림 '팀 보고 3건', 보고 목록에 ['blocked', 사흘 전, 0, '김 기사'], pending 에 막힘 1건.
- 핀3곳 hyeonjang-v489-demo3(v488 위). 신규 tests/demo3-v489.e2e.js 2/2(390px), 기준선(75c6983)·변이 no-blocked 실패 확인. 데모를 쓰는 검사 17개(demo-v462·demotour-v467·demotour2-v470·tour2col-v474·teamage-v481·settings-safety·teamack-v465·teamnote-v466·notefilter-v475·notecopy-v483·mobile-screen-layout·action-search·amount-sign·aptdocs-v441·demo-banner·mobile-tap-table·trip-expense-overlap) 통과, 정적 19개 통과.

## 2026-10-24 v488 ⏱ 작업시간 창 — '📅 이번 달' 칩 (개발_백로그)

- `workView`: `isMonth`(date 앞 7자 = localDate 앞 7자). 이번 달 기록이 일부(0 < monthN < 전부)일 때만 `[data-wl-filter="month"]` '📅 이번 달 n'. 칩 줄은 팀 보고 줄이 있거나 이번 달 칩이 있을 때. `opts.monthOnly` 는 칩이 보일 때만 켜진다.
- 줄 고르기: `shown`(팀 보고만, v480 줄 문자열 그대로 — wlchip-v480 변이가 그대로 문다) → `view = monthOnly ? shown.filter(isMonth) : shown`. 더 보기·남은 줄·합계 줄은 `view` 기준. 합계 줄 '👷 팀 보고 · 📅 이번 달 n줄 · 합계 …'(켠 것만).
- 칩 누르기: [전부] = 둘 다 끔, 팀·이번 달은 따로 켜고 끈다(다른 쪽은 그대로). 더 보기·삭제·[✏️ 수정](v487) 모두 monthOnly 를 넘긴다. 화면만, 저장 없음.
- 기존 검사 손질: wlchip-v480 은 칩 앞 둘만 비교(셋째 '📅 이번 달'은 오늘 날짜에 따라 있음/없음), 마지막 팀 줄 삭제 뒤엔 칩 줄 대신 팀 칩이 없어지기를 기다린다. wleditkeep-v487 변이 문자열에 monthOnly 반영.
- 핀3곳 hyeonjang-v488-wlmonth(v487 위). 신규 tests/wlmonth-v488.e2e.js 2/2(390px, 이번 달 1일·지난달 말일 경계), 기준선(9a59702)·변이 no-month 실패 확인. 관련 11개 통과, wlchip-v480·wleditkeep-v487 변이 여전히 실패 확인, 정적 19개 통과.

## 2026-10-24 v487 ⏱ 작업시간 [✏️ 수정] — 돌아올 때 칩·펼친 줄 수·스크롤 그대로 (개발_백로그)

- `workView` 의 [✏️ 수정] 은 떠나기 전에 `#modalRoot .modal,.mbody` scrollTop 을 재서 `workEditView(id,pjName,{teamOnly,limit,scrollTops})` 로 넘긴다. `workView` 는 `opts.scrollTops`(배열)가 있으면 그 값으로, 없고 `keepScroll` 이면 지금 값으로 되돌린다(v482).
- `workEditView(id,pjName,back)`: 아래 단추 [← 작업시간](저장 없이 `workView(pjName,back)`) · [닫기](다 닫음). 저장은 `markDirty(); closeModal(); workView(pjName,back)`. 현장 창에서 열었으면 그 현장 창으로 돌아간다. 저장 내용은 예전 그대로(날짜·시작·종료·메모).
- 핀3곳 hyeonjang-v487-wleditkeep(v486 위). 신규 tests/wleditkeep-v487.e2e.js 2/2(390px, 스크롤 자리 확인 포함), 기준선(add0450)·변이 no-keep 실패 확인. 관련 10개(wlchip-v480·wlmore-v482·wlpick-v485·wlteam-v476·doccenter-v433·mobile-more-tools·mobile-screen-layout·teampacket-v432·v219-operations·team3-v458) 통과, 정적 19개 통과.

## 2026-10-24 v486 📄 완료보고서 — 팀 보고 사진 묶음 썸네일 → 크게 보기 (개발_백로그)

- `hjTeamReportPhotosHtml`: 묶음 줄 썸네일(썸네일 있는 사진 4장까지)을 `<button data-rp-team-photo=file.id>`(44×44, img 꽉 채움)로, 넘치면 `[data-rp-team-more]` '+n'. 줄(label)은 `flex-wrap` + 글 `flex:1 1 160px` — 390px 에선 썸네일 줄이 아래로 내려간다.
- `aptReportView`: `[data-rp-team-photo]` onclick → preventDefault·stopPropagation 후 `openLightbox(id, 그 묶음의 썸네일 있는 사진 ids)`(보고서 창 위에 겹쳐 열림). label 안의 단추라 눌러도 체크(빼기/넣기, v463)는 안 바뀐다 — 체크 칸을 누르면 여전히 빼기/넣기. 화면만, 저장 없음.
- 핀3곳 hyeonjang-v486-rpphoto(v485 위). 신규 tests/rpphoto-v486.e2e.js 2/2(390px), 기준선(0503fa9)·변이 no-view 실패 확인. 관련 14개(team4-v463·teampdf-v468·demo-v462·demotour-v467·doccenter-v433·doneall-v478·doneview-v471·leakreport-v422·publicweb-v446·reportfill-v408·team3-v458·teamnote2-v469·notephotos-v479·mobile-screen-layout) 통과, 정적 19개 통과.

## 2026-10-24 v485 ⏱ 작업시간 창 — 현장 고르기 (개발_백로그 '작업시간 전체 창에서 현장 고르기')

- `workView`: workData 전체에서 기록이 있는 현장(이름 빈 줄 제외)을 최근 기록 날짜 순으로 모아, 둘 이상이면 맨 위 `<label data-wl-pick>` + `<select data-wl-project>`('전체 · n줄' + '현장 · m줄', 44px). 기록 없는 현장 창에서 열면 그 현장을 '· 0줄'로 맨 앞에 넣어 골라 둔다. onchange → `workView(sel.value||'')`(전체면 ''), 칩·더 보기는 새로 시작. 화면만, 저장 없음.
- `.mbody > div` 첫 div 는 여전히 위 칸(작업 일수…) — 고르기 칸은 label 이라 wlchip-v480 검사의 tiles 선택자에 안 걸린다.
- 핀3곳 hyeonjang-v485-wlpick(v484 위). 신규 tests/wlpick-v485.e2e.js 2/2(390px), 기준선(0a76b51)·변이 no-pick 실패 확인. 관련 9개(wlchip-v480·wlmore-v482·wlteam-v476·doccenter-v433·mobile-more-tools·mobile-screen-layout·teampacket-v432·v219-operations·team3-v458) 통과, 정적 19개 통과.

## 2026-10-24 v484 👷 팀 보고 노트 줄 — '지시 wo_…' → 사람이 읽는 지시 이름 (개발_백로그)

- `hjTeamReportOrderTitle(p,orderId)`: `hjWoOrders(p)` 에서 packetId 가 같은 지시의 title(hjWoText 40자) + '(M/D)'(지시 date, 없으면 due; 진짜 날짜일 때만). title 이 없으면 ''. `hjTeamReportOrderHtml` → `<span data-team-note-order title="wo_…">지시: 제목(M/D)</span>`(escapeHtml — 제목의 <b>·& 는 글자로), 없으면 예전처럼 '지시 wo_…'. 지시 없는 보고는 '보고만' 그대로.
- [📋 글로 복사](v483) 줄 괄호 끝에 '지시: 제목(M/D)' — 번호만 있는 지시는 복사에서 뺀다(단톡방에 번호는 쓸모없다). 읽기만, 저장 없음.
- 핀3곳 hyeonjang-v484-ordername(v483 위). 신규 tests/ordername-v484.e2e.js 2/2(390px), 기준선(ae81de3)·변이 no-title 실패 확인. 관련 14개(teamnote-v466·teamnote2-v469·notefilter-v475·notecopy-v483·notephotos-v479·unack-v472·importnote-v473·doneview-v471·pendingall-v477·doneall-v478·wlteam-v476·demo-v462·teampacket-v432·team3-v458) 통과, 정적 19개 통과.

## 2026-10-24 v483 👷 팀 보고 노트 창 — [📋 보이는 보고 n건 글로 복사] (개발_백로그)

- `hjTeamReportNoteRows(p,filter)`: v475 칩 필터 줄을 함수로 뺐다(그 줄 문자열은 여전히 한 곳 — notefilter-v475 변이 no-filter 가 그대로 문다). `hjTeamReportNoteHtml` 과 복사가 같은 줄을 쓴다 = 보이는 것만 복사된다.
- `hjTeamReportNoteText(p,filter)`: 머리줄 '[현장] 팀 작업 보고 n건( · 상태 칩)( · 👤 보고자)' + 줄마다 '- M/D(요일) 상태 — 한 일 / 이슈: … (보고자 · n시간 · 사진 n장)', 확인한 검수·막힘은 ' [확인함]'. 현장 이름만, 고객 이름·전화 없음.
- `hjTeamReportNoteCopyHtml` → 칩 아래·목록 위 `[data-team-note-copy-row]` + `[data-team-note-copy]` '📋 보이는 보고 n건 글로 복사'(44px, 보이는 줄이 0이면 없음). `hjTeamReportNoteCopy(name,filter)`: navigator.clipboard.writeText, 실패하면 `coworkCopyFallback`(execCommand) — v461 관리사무소 명단 복사와 같은 방식. 알림 '보고 n건을 글로 복사했어요'. 보내기·저장 없음.
- 핀3곳 hyeonjang-v483-notecopy(v482 위). 신규 tests/notecopy-v483.e2e.js 2/2(390px, 클립보드·대체 경로), 기준선(2424ab6)·변이 no-filter-copy 실패 확인. 관련 12개(notefilter-v475·teamnote-v466·teamnote2-v469·unack-v472·notephotos-v479·importnote-v473·doneview-v471·pendingall-v477·doneall-v478·wlteam-v476·teamage-v481·mobile-screen-layout) 통과, notefilter-v475 변이 여전히 실패 확인, 정적 19개 통과.

## 2026-10-24 v482 ⏱ 작업시간 창 — 30줄 넘으면 [더 보기] (개발_백로그)

- `workView(pjName,opts)`: `opts.limit`(기본 30, 30 이상) 만큼만 그리고, 남으면 표 아래 `[data-wl-more]` + `[data-wl-more-btn]` '외 n줄 — min(30,n)줄 더 보기'(44px) → `workView(pjName,{teamOnly,limit:limit+30,keepScroll:true})`. 예전엔 31줄째부터 말없이 숨었다(v478 과 같은 문제).
- `opts.keepScroll`: openModal 전에 `#modalRoot .modal,.mbody` 의 scrollTop 을 재고, 다시 그린 뒤(모바일 스크롤 class 를 붙인 다음) 같은 순서로 되돌린다 — [더 보기]·[🗑 삭제] 뒤 맨 위로 튀지 않는다. 삭제는 펼친 만큼(limit)·칩 유지, 칩을 바꾸거나 바깥에서 새로 열면 30줄부터. 화면만, 저장 없음.
- 핀3곳 hyeonjang-v482-wlmore(v481 위). 신규 tests/wlmore-v482.e2e.js 2/2(390px, 스크롤 자리 확인 포함), 기준선(6afa3c9)·변이 no-more 실패 확인. 관련 8개(wlchip-v480·wlteam-v476·doccenter-v433·mobile-more-tools·mobile-screen-layout·teampacket-v432·v219-operations·team3-v458) 통과, 정적 19개 통과.

## 2026-10-24 v481 🔎⛔ 검수 요청·막힘 줄 — '· n일째' (개발_백로그 '검수 요청·막힘 줄 n일째 표시')

- `hjTeamReportAgeDays(workDate)`: `isRealIsoDate` 이고 `hjDaysBetween(작업일, localDate())` 가 2 이상일 때만 그 날 수, 아니면 0(오늘·어제·미래·빈·잘못된 날짜). `hjTeamReportAgeHtml(workDate,prefix)` → `<span data-team-days=n>· n일째</span>`(주황, nowrap).
- 첫 화면 `hjTeamReportPendingHtml` 줄 글 끝(이슈 뒤)에 붙는다. v477 목록 창은 현장마다 가장 오래 묵은 미확인 보고로 '· 가장 오래된 것 n일째'(g.oldest/g.oldestDate). 읽기만.
- 데모(v462): 검수 요청 보고 `wr_demo_20250312` 의 workDate·at 을 이틀 전(상대 날짜)으로 — 2025-03-12 그대로면 첫 화면에 '590일째'로 보였다. 완료 보고(2025-03-10, 사진 묶음 날짜)는 그대로. tests/demo-v462 의 기대값을 `hjAddDays(localDate(),-2)` 로 바꿨다.
- tests/teamack-v465 줄 글 정규식에 `( · \d+일째)?` 허용(2일 전 보고라 붙는다).
- 핀3곳 hyeonjang-v481-teamage(v480 위). 신규 tests/teamage-v481.e2e.js 2/2(390px, 날짜 경계 단위 확인 포함), 기준선(d2578c3)·변이 no-age 실패 확인. 관련 12개(teamack-v465·pendingall-v477·demo-v462·demotour-v467·demotour2-v470·tour2col-v474·team3-v458·teamnote-v466·teampacket-v432·doneall-v478·mobile-screen-layout·settings-safety) 통과, 정적 19개 통과.

## 2026-10-24 v480 ⏱ 작업시간 창 — '👷 팀 보고만' 칩 (개발_백로그)

- `workView(pjName,opts)`: 팀 보고 줄(`w.teamReport.key`, v476)이 하나라도 있으면 표 위에 `[data-wl-chips]` — `[data-wl-filter=""]` '전부 n' · `[data-wl-filter="team"]` '👷 팀 보고만 m'(44px, aria-pressed, 눌린 칩은 blueprint). 칩 → `workView(pjName,{teamOnly})` 로 다시 그림. `opts.teamOnly` 인데 팀 보고 줄이 0이면 전부로.
- 팀 보고만일 때 `shown`(팀 보고 줄)에서 최근 30줄 — 예전 30줄 밖에 있던 팀 보고 줄도 보인다. `[data-wl-team-sum]` '👷 팀 보고 m줄 · 합계 h — 위 칸은 전부 기준이에요'. 위 칸(작업 일수·누적·이번 달)은 전부 기준 그대로. [🗑 삭제] 뒤 다시 그릴 때 칩 유지, 바깥에서 새로 열면 전부(기존 호출은 인자 하나 그대로). 화면만, 저장 없음.
- 핀3곳 hyeonjang-v480-wlchip(v479 위). 신규 tests/wlchip-v480.e2e.js 2/2(390px), 기준선(a6b1111)·변이 no-filter 실패 확인. 관련 9개(wlteam-v476·doccenter-v433·mobile-more-tools·mobile-screen-layout·teampacket-v432·v219-operations·team3-v458·importnote-v473·notephotos-v479) 통과, 정적 19개 통과.

## 2026-10-24 v479 👷 팀 보고 노트 줄 — 📷 사진 펼쳐 보기 (개발_백로그 '노트 줄 사진 n장 → 사진 펼쳐 보기')

- `hjTeamNotePhotoMap(p)`: 보고 열쇠 → 이 기기 사진(썸네일 있는 photo, 동영상 제외, when 순). 완료·검수 요청은 `hjTeamReportPhotos`(v463) 결과 그대로(완료보고서와 같은 묶음), 막힘은 남은 사진에서 `_teamReport` 열쇠 → 없으면 보고 사진 수>0 일 때만 작업일 일치. 읽기만.
- 노트 줄: 사진이 있으면 단추 맨 앞 `[data-team-note-photos=key][data-n]` '📷 사진 n장 보기'(aria-expanded, 44px) ↔ '📷 사진 접기'. 펼치면 줄 끝에 `[data-team-note-photo-grid=key]`(64px 칸 격자) + 썸네일 단추 `[data-team-note-photo=file.id]` → `openLightbox(id, 그 보고 사진 ids)`(창 위에 겹쳐 열림, 닫으면 창·격자 그대로). 메타 줄 '사진 n장'(보고가 적은 수)은 그대로.
- 펼침 상태는 모듈 `__hjNotePhotoOpen`(Set) — `hjTeamReportNoteView` 가 비우고, [확인함]·칩 다시 그리기에선 유지. 토글은 그 줄만 DOM 으로(스크롤 안 튐), 썸네일 클릭은 `#hjTeamNote` root.onclick 위임(격자를 나중에 끼우므로). 화면만, 저장 없음.
- 주의: 사진 when 은 Date 다(복원 `when:s.when?new Date(s.when):null`, fmtDate 가 getFullYear 를 부른다) — 검사에서 ISO 문자열로 심으면 사진 크게 보기가 TypeError. `#lightbox` 자체는 크기 0(안쪽 fixed)이라 Playwright 는 `#lightbox #lbClose` 를 기다린다.
- 핀3곳 hyeonjang-v479-notephotos(v478 위). 신규 tests/notephotos-v479.e2e.js 2/2(390px), 기준선(1fc340e)·변이 no-grid 실패 확인. 관련 13개(team4-v463·teampdf-v468·teamnote-v466·teamnote2-v469·unack-v472·notefilter-v475·importnote-v473·doneview-v471·pendingall-v477·doneall-v478·wlteam-v476·demo-v462·mobile-screen-layout) 통과, 정적 19개 통과.

## 2026-10-24 v478 📄 첫 화면 '팀 보고 n건 들어옴' 줄 — 3곳 초과 [외 n곳 — 모두 보기] (개발_백로그)

- `hjTeamDoneDocHtml`: `hjTeamDoneDoc()` 이 4곳 이상이면 줄 3개 뒤에 `<p data-team-done-more>` + `[data-team-done-all]` 단추 '외 n곳 — 모두 보기'(44px). 예전엔 넷째 현장부터 말없이 숨었다. #view 위임 closest 목록 + `d.teamDoneAll` → `hjTeamDoneAllView()`.
- `hjTeamDoneAllView()`: 창 `#hjTeamDoneAll` — 줄 `[data-team-done-all-row=현장]`('✅ 완료 보고 n건 · 사진 m장 · 최근 MM/DD', hjTeamDoneDoc 순서 = 최근 작업일 순), `[data-team-done-all-open]` [완료보고서 초안](v469 처럼 closeModal → setTimeout aptReportView), `[data-team-done-all-note][data-key]` [👷 노트 보기] → `hjTeamReportNoteView(현장,key,{filter:{status:'done'}})`(칩이 없으면 전부, v477). [넘기기]는 목록에 두지 않는다(첫 화면 줄에만). 읽기만, 저장 없음.
- 핀3곳 hyeonjang-v478-doneall(v477 위). 신규 tests/doneall-v478.e2e.js 2/2(390px), 기준선(b74ec62)·변이 no-more 실패 확인. 관련 9개(demo-v462·demotour-v467·doneview-v471·team3-v458·teamack-v465·pendingall-v477·teamnote2-v469·notefilter-v475·mobile-screen-layout) 통과, 정적 19개 통과.

## 2026-10-24 v477 🔎⛔ 첫 화면 검수 요청·막힘 줄 '외 n건' → [모두 보기] (개발_백로그 '검수 요청·막힘 줄 외 n건 → 모두 보기')

- `hjTeamReportPendingHtml`: 검수 요청·막힘이 각각 3건을 넘으면 '외 n건' 힌트 대신 `[data-team-pending-all=review|blocked]` 단추 '외 n건 — 모두 보기'(44px). #view 위임 `d.teamPendingAll`(closest 목록에도 추가 — 빠뜨리면 단추가 죽는다) → `hjTeamPendingAllView(status)`.
- `hjTeamPendingAllView(status)`: `hjTeamReportPending()` 중 그 상태만 현장별로 묶은 창 `#hjTeamPendingAll` — 줄 `[data-team-pending-all-row=현장]`(🔎/⛔ 건수 + '최근 날짜 한 일/이슈'), 최근 보고 순. `[data-team-pending-all-note=현장][data-key=가장 최근 보고]` → `hjTeamReportNoteView(현장,key,{filter:{status}})`. 읽기만 — 확인함은 노트 창 줄(v469)에서. 저장 없음(검사 ① serializeData 동일).
- `hjTeamReportNoteView(name,focusKey,opts)` 가 `opts.filter` 를 받는다 — 단 칩이 보일 때만(`hjTeamReportNoteChipsHtml(p,{})` 이 비면 전부). 보고 1~2건·보고자 1명 현장에서 칩 없이 줄이 숨는 일을 막는다.
- 핀3곳 hyeonjang-v477-pendingall(v476 위). 신규 tests/pendingall-v477.e2e.js 2/2(390px), 기준선(3d9d261)·변이 no-filter 실패 확인. 관련 10개(teamack-v465·teamnote-v466·teamnote2-v469·doneview-v471·unack-v472·importnote-v473·notefilter-v475·wlteam-v476·demo-v462·mobile-screen-layout) 통과, 정적 19개 통과.

## 2026-10-24 v476 ⏱ 작업시간 줄 — 👷 팀 보고 표시 + [👷 노트] (개발_백로그 '작업일지 줄 팀 보고 표시 + 노트 열기')

- `workView` 줄: `w.teamReport`(객체, key 있음 — 📥 팀 작업 가져오기가 만든 줄)이면 `[data-wl-team=key]` 와 현장 이름 아래 초록 작은 글 '👷 팀 보고 · 보고자', 단추 맨 앞에 `.wkNote`(data-project·data-key, 44px) → `hjTeamReportNoteView(project,key)` 로 그 보고 줄에 초점. 보통 줄(teamReport 없음)은 배지·단추 없이 그대로. 읽기만 — 자료·저장 없음(검사 ① serializeData 동일).
- 핀3곳 hyeonjang-v476-wlteam(v475 위). 신규 tests/wlteam-v476.e2e.js 2/2(390px), 기준선(494f2ed)·변이 no-note 실패 확인. 관련 8개(doccenter-v433·mobile-more-tools·mobile-screen-layout·teampacket-v432·v219-operations·team3-v458·teamnote-v466·notefilter-v475) 통과, 정적 19개 통과.

## 2026-10-24 v475 👷 팀 보고 노트 창 — 상태·보고자 칩 (개발_백로그 '팀 보고 노트 창 상태 필터')

- `hjTeamReportNoteChipsHtml(p,filter)`: 보고 3건 이상이거나 보고자 2명 이상일 때만 `[data-note-filter]` — 상태 칩 `[data-note-filter-status=''|review|blocked|done]`(건수 붙임, 0건 상태는 생략)과 보고자 칩 `[data-note-filter-reporter=''|이름]`(둘 이상일 때만, '👤 모두' 포함). 44px, `aria-pressed`, 눌린 칩은 blueprint 배경.
- `hjTeamReportNoteRender(name,focusKey,filter)` 가 힌트 아래에 칩 + `[data-team-note-list]` 를 다시 그리고 `hjTeamReportNoteBind(name,focusKey,filter)` 로 묶는다 — [확인함]·[확인 취소] 뒤에도 같은 filter 로 다시 그려 칩이 유지된다. `hjTeamReportNoteHtml(p,focusKey,filter)` 는 status·reporter 둘 다 맞는 줄만, 없으면 `[data-team-note-empty]` 힌트. 화면만, 저장 없음(검사 ① serializeData 동일). hjTeamReportNoteView 는 빈 껍데기를 열고 Render 를 부른다.
- 핀3곳 hyeonjang-v475-notefilter(v474 위). 신규 tests/notefilter-v475.e2e.js 2/2(390px), 기준선(cd8a8e7)·변이 no-filter 실패 확인. 관련 7개(teamnote-v466·teamnote2-v469·unack-v472·importnote-v473·doneview-v471·teamack-v465·demo-v462) 통과, 정적 19개 통과.

## 2026-10-24 v474 🧭 데모 둘러보기 카드 — PC 두 칸 (개발_백로그)

- `@media(min-width:900px)` + `body:not(.mobile-mode)` 에서 `#view [data-demo-tour] ol{grid-template-columns:1fr 1fr}`, 마지막 단계(끝내기)는 `grid-column:1/-1`. 폰·모바일 모드는 한 칸 그대로. 글·단추·저장 방식은 v467·v470 그대로.
- 핀3곳 hyeonjang-v474-tour2col(v473 위). 신규 tests/tour2col-v474.e2e.js 2/2(1280·390), 기준선(64644cd)·변이 one-col 실패 확인. 관련 6개(demotour-v467·demotour2-v470·demo-v462·pcdark-v452·settings-safety·dash-cards) 통과, 정적 19개 통과.

## 2026-10-24 v473 📥 팀 작업 가져오기 — 반영 결과 창 [👷 노트 보기] (개발_백로그)

- `hjTeamReportImportView.apply` 가 방금 반영한 보고를 `done[]{project,key,status}` 로 모아, **사진이 없을 때만** `hjWrResultView(done,{applied,dup,failed})` 를 연다(현장별 n건·상태 글, `[data-wr-note=현장][data-key=마지막 반영 보고]` [👷 노트 보기] → hjTeamReportNoteView 초점). 사진이 있으면 사진 넣기 결과 창이 마지막 화면이라 그대로(첫 화면 줄 [보기]). 반영 0건(전부 중복)이면 안 연다. 반영 로직·토스트는 그대로.
- 핀3곳 hyeonjang-v473-importnote(v472 위). 신규 tests/importnote-v473.e2e.js 2/2(390px), 기준선(bb2b147)·변이 no-result 실패 확인. 관련 8개(teampacket-v432·team2-v444·company-team-ui·teamnote-v466·teamnote2-v469·unack-v472·team3-v458·teamack-v465) 통과, 정적 19개 통과.

## 2026-10-24 v472 ↩ 팀 보고 확인 취소 (개발_백로그 '팀 보고 확인 취소')

- `hjTeamReportUnack(name,key)`: review·blocked 이고 `ack` 인 보고의 `ack`·`ackAt` 키를 지운다(v465 와 같은 방식, markDirty → 저장). 노트 창(hjTeamReportNoteHtml) 줄에 `[data-team-note-unack=key]` [확인 취소](44px) — 미확인 줄의 [확인함]과 서로 바뀐다. `hjTeamReportNoteBind` 가 처리(창 안 목록 다시 그림 + render() → 첫 화면 '🔎 검수 요청' 줄이 다시 올라옴 + 토스트).
- 핀3곳 hyeonjang-v472-unack(v471 위). 신규 tests/unack-v472.e2e.js 2/2(390px, IDB 에서 키가 지워짐·그 밖 불변), 기준선(eaec8bc)·변이 no-clear 실패 확인. 관련 6개(teamnote2-v469·teamnote-v466·teamack-v465·doneview-v471·team3-v458·demo-v462) 통과, 정적 19개 통과.

## 2026-10-24 v471 📄 첫 화면 '팀 보고 n건 들어옴' 줄에 [보기] (개발_백로그)

- `hjTeamDoneDoc()` 행에 `key`(완료보고서 안 만든 완료 보고 중 가장 최근 것) 추가(읽기만). `hjTeamDoneDocHtml` 줄 단추가 [완료보고서 초안]·**[보기]**(`[data-team-note=key][data-project]`, 기존 v466 위임 → 노트 창, 그 보고에 초점)·[넘기기] 셋(44px).
- 핀3곳 hyeonjang-v471-doneview(v470 위). 신규 tests/doneview-v471.e2e.js 2/2(390px), 기준선(fe48d2c)·변이 no-key 실패 확인. 관련 9개(team3-v458·teamnote-v466·teamnote2-v469·teamack-v465·demo-v462·demotour-v467·dash-cards·inqpending-v386·mobile-more-sweep) 통과, 정적 19개 통과.

## 2026-10-24 v470 🧭 데모 둘러보기 — 본 단계 ✓ (개발_백로그 '데모 둘러보기 — 단계 완료 표시')

- 이 기기 localStorage `hj_demo_tour_done`(열쇠 배열: pending·report·aptdocs·ledger) — `hjDemoTourDone/MarkDone/Clear`. `hjDemoTourGo` 가 단계 단추마다 MarkDone(카드 `[data-demo-tour]` 만 outerHTML 로 다시 그림), 줄은 `data-done` + '✓' + 단추 글 '다시', 요약 `[data-demo-tour-seen]` '봤어요 n/4 · 5단계 · 2분'. 끝내기는 표식에 안 센다.
- 지우는 때: loadDemo 들어갈 때(`state._demo=true` 바로 뒤)와 hjDemoExit·[끝내기] — 지난 데모의 ✓ 가 새 데모에 안 남는다. 앱 자료 변경 없음(검사 ① serializeData 동일).
- 핀3곳 hyeonjang-v470-demotour2(v469 위). 신규 tests/demotour2-v470.e2e.js 2/2(390px), 기준선(480af26)·변이 no-mark 실패 확인. 관련 7개(demotour-v467·demo-v462·settings-safety·demo-banner·mobile-tap-table·aptdocs-v441·dash-cards) 통과, 정적 19개 통과.

## 2026-10-24 v469 👷 팀 보고 노트 창의 줄 단추 — [확인함] · [완료보고서 초안] (개발_백로그 '팀 보고 노트에서 바로 [확인함]·[완료보고서]')

- `hjTeamReportNoteHtml` 줄 끝에 단추(44px): 검수 요청·막힘이고 `!ack` 면 `[data-team-note-ack=key]` [확인함], 완료(done)면 `[data-team-note-report]` [완료보고서 초안](docAt 있으면 '완료보고서 다시'). 그 밖의 줄은 단추 없음 — 창은 여전히 그 두 동작 외엔 읽기만.
- `hjTeamReportNoteBind(name,focusKey)`: [확인함] → `hjTeamReportAck`(v465, 저장) → `#hjTeamNote` 안 목록만 다시 그리고(힌트 유지, 다시 bind) 뒤 화면 `render()`(첫 화면 줄도 내려감) + 토스트 · [완료보고서 초안] → closeModal 뒤 aptReportView(name). openModal 뒤 호출.
- 핀3곳 hyeonjang-v469-teamnote2(v468 위). 신규 tests/teamnote2-v469.e2e.js 2/2(390px, IDB 저장·그 밖의 자료 불변 — 정렬된 키라 `"ack":true,` 가 객체 맨 앞), 기준선(211ad92)·변이 no-save 실패 확인. 관련 8개(teamnote-v466·teamack-v465·team3-v458·team4-v463·demo-v462·demotour-v467·teampdf-v468·doccenter-v433) 통과, 정적 19개 통과.
- 같은 날 PC 에서 `apply-stack-v427-v468.cmd` 를 실제로 돌려 보니 `git cat-file -e %BASE%^{commit}` 의 `^` 를 cmd 가 먹어 "base commit not in repo" 로 멈췄다 → cmd 는 `git cat-file -e %BASE%` 로(CRLF). 고친 cmd 로 브랜치 `claude/stack-v427-v468` 이 올라갔다(트리 동일 확인). 이후 판의 cmd 는 고친 것을 복사한다.

## 2026-10-24 v468 📄 완료보고서 PDF 사진 대장 — '팀 보고 · 한 일' 머리글 먼저 (개발_백로그 '완료보고서 팀 보고 사진 묶음 — PDF 사진 대장 머리글')

- `hjReportPhotoGroups(photos, teamBundles)` 두 번째 인자(선택): v463 묶음(`{key,workDate,status,done,files}`)이 오면 그 사진은 작업일 순 `{label:'팀 보고 · '+한 일(40자), team:true, teamKey}` 그룹으로 **맨 앞**, 나머지 사진만 예전처럼 작업명(누수 태그) 그룹 + rank 정렬. 인자가 없으면 결과는 예전과 같다(hjReportDraft 는 그대로 인자 없이 → 작업 내용 줄 불변). 읽기만.
- aptReportView 가 PDF `o` 에 `teamBundles`(빼기 `__rpExcluded` 반영, 빈 묶음 제외)를 넣고 buildAptReportPDF 가 `hjReportPhotoGroups(o.photos,o.teamBundles)` 로 머리글(`■ 팀 보고 · … — MM/DD (n장)`)을 만든다. 6장/페이지 계산·사진 수는 그대로.
- 핀3곳 hyeonjang-v468-teampdf(v467 위). 신규 tests/teampdf-v468.e2e.js 3/3(진짜 buildAptReportPDF 본문에 `o.teamBundles` 가 있는지 확인한 뒤 그룹 결과만 기록하는 대역 — jsPDF 는 바깥 스크립트라 막힘), 기준선(ecdd7e6)·변이 no-pass 실패 확인. 관련 10개(team4-v463·team3-v458·reportfill-v408·phototags-v454·leakreport-v422·demo-v462·demotour-v467·doccenter-v433·publicweb-v446·rehearsalfix-v449) 통과, 정적 19개 통과.

## 2026-10-24 v467 🧭 데모 둘러보기 — 데모 첫 화면 맨 위 '이렇게 보세요' 5단계 (개발_백로그 '데모 둘러보기 순서 안내')

- `hjDemoTourHtml()`(데모가 아니면 '') 을 viewDashboard 맨 앞에 — `<details data-demo-tour ontoggle="hjDemoTourToggle(this)">`, 열림 기본, 접힘은 이 기기 localStorage `hj_demo_tour`('0' 접힘; `hjDemoTourOpen()`) — 앱 자료 변경 없음(검사 ① serializeData 동일). 5단계 `HJ_DEMO_TOUR`(상수: 검수 요청 줄 찾기 → 완료보고서 초안 → 아파트 서류 4종 → 월말 장부 🧾 → 데모 끝내기), 줄마다 `[data-demo-tour-go=pending|report|aptdocs|ledger|exit]`(44px). `hjDemoTourGo`: pending 은 `[data-team-report-pending]` 테두리 1.8초(없으면 토스트), report → aptReportView(HJ_DEMO_CAFE), aptdocs → hjAptDocsView(HJ_DEMO_APT), ledger → expenseLedger(이번 달), exit → hjDemoExit. 데모 현장 이름 상수 `HJ_DEMO_CAFE`·`HJ_DEMO_APT`(loadDemo 의 이름과 같아야 한다 — 바꾸면 둘 다).
- toggle 이벤트는 다음 틱에 오므로 검사는 localStorage 값을 기다린다. 핀3곳 hyeonjang-v467-demotour(v466 위). 신규 tests/demotour-v467.e2e.js 3/3(390px, 끝내기 → reload 뒤 저장본에 데모 없음), 기준선(9675715)·변이 no-remember 실패 확인. 관련 13개(demo-v462·settings-safety·demo-banner·mobile-tap-table·action-search·amount-sign·trip-expense-overlap·aptdocs-v441·dash-cards·inqpending-v386·mobile-screen-layout·custfill-v394·teamnote-v466) 통과, 정적 19개 통과.

## 2026-10-24 v466 👷 팀 보고 노트 보기 — 보고 전문 읽기 전용 창 (개발_백로그 '팀 보고 노트 보기')

- `hjTeamReportNoteHtml(p,focusKey)`·`hjTeamReportNoteView(name,focusKey,{back})`: 현장의 팀 작업 보고 전부(hjTeamReportsOf, 최근 것부터) — 날짜(hjMdDow)·상태(HJ_WR_STATUS_LABEL)·👤 보고자·시간·사진 수·지시 번호(없으면 '보고만')·한 일·이슈·체크리스트(✓/○)·표식(확인함 날짜·완료보고서 날짜/넘김). 단추는 닫기(와 `back` 일 때 [← 서류 만들기])뿐 — **읽기만, 저장·변경 없음**(검사 ① serializeData 동일). `[data-team-note=key]`, focusKey 는 `data-focus` + clay 테두리 + scrollIntoView. 보고 없으면 `.empty` 안내.
- 들어가는 길: 첫 화면 검수 요청·막힘 줄 `[data-team-note=key][data-project]` [보기](확인함 앞, 44px; #view 위임 `d.teamNote`) · 📎 서류 만들기 '시공 중' 그룹 `data-act="teamnote"`('보고 n건 · 검수·막힘 k건', 막힘·검수가 있으면 warn) → `{back:true}`. docHubView 에 teamRows/teamAll/teamPend(읽기만).
- teamack-v465 ① 줄 글 정규식에 `(보기 )?` 허용. 핀3곳 hyeonjang-v466-teamnote(v465 위). 신규 tests/teamnote-v466.e2e.js 2/2(390px), 기준선(a04b72b)·변이 no-entry 실패 확인. 관련 13개(teamack-v465·team3-v458·team4-v463·demo-v462·doccenter-v433·pcdark-v452·teampacket-v432·team2-v444·dash-cards·evidence-v427·insurance-v442·proposal-v437·aptdocs-v441) 통과, 정적 19개 통과.

## 2026-10-23 v465 🔎 첫 화면 '검수 요청 · 막힘' 줄 — [확인함]으로 내리기 (v432 이후 내릴 길이 없던 줄)

- v432 의 `hjTeamReportPending()` 은 `!r.ack` 만 걸렀는데 ack 를 적는 곳이 없어 검수 요청·막힘 줄이 영영 남았다. `hjTeamReportAck(name,key)` 가 보고 레코드(wo.reports[]·p.teamReports[]) 안에 `ack:true, ackAt`(v458 docAck 와 같은 방식 — 새 저장 키 없음, markDirty → 이 기기 저장)을 적는다. review·blocked 만, 이미 ack 면 0.
- `hjTeamReportPendingHtml` 은 줄마다 `[data-team-report-row=key][data-project]` — '🔎/⛔ 현장 — MM/DD 한 일/이슈(60자)' + `[data-team-ack=key][data-project]` [확인함](44px, aria-label). 보고자 이름은 안 넣는다. 3줄 넘으면 '외 n건'. `hjTeamReportPending()` 행에 `key` 추가. #view 위임 `d.teamAck` → hjTeamReportAck + render + 토스트.
- demo-v462 ① 의 검수 줄 정규식을 `[\s\S]*` 로 느슨하게(줄이 둘로 나뉨). 핀3곳 hyeonjang-v465-teamack(v464 위). 신규 tests/teamack-v465.e2e.js 2/2(390px, IDB 저장 확인), 기준선(192a19d)·변이 no-ack 실패 확인. 관련 10개(company-team-ui·demo-v462·team2-v444·team4-v463·teampacket-v432·team3-v458·dash-cards·inqpending-v386·custfill-v394·ownertodo-v460) 통과, 정적 19개 통과.

## 2026-10-23 v464 📊 첫 화면 '현장별 지출 · 마진' 표 — PC 1280 맞춤 (개발_백로그 5번)

- 1280px(옆 메뉴 포함 본문 ≈962px)에서 표 자연 폭이 1379px 이라 늘 옆으로 밀렸다. 고친 것(≥900px·PC 모드만): 열 제목·마진 칸은 줄바꿈 허용(`word-break:keep-all`, 낱말은 안 쪼갬), 마진 칸은 `projectMarginCellHtml` — `.mg-wrap > b.mg-amt(금액, nowrap·PC 에선 block) + .mg-sep(' · ', PC 에선 숨김) + .mg-note('30% (입력 원가 기준)', PC 에선 아래 줄)`; 글(innerText)은 projectMarginLabel 과 같은 뜻. 칸 여백 `8px 6px`, 원가 입력칸 `input.mg-in` 84px(border-box, 12px) — 예전 인라인 `width:96px` 는 기본 규칙 `#dashboardMarginTable input.mg-in{width:96px}` 로 옮김(폰은 .dash-cards 의 `width:auto!important` 가 그대로 이김). `min-width` 1180 → 900.
- 결과: 1280 자연 폭 949px → 안 밀림, 1024(706px)는 그대로 스크롤, 금액은 안 꺾임(pcdark-v452 ⑦ 계약 유지, 이름 칸 150px 유지). 폰 카드형은 `.mg-wrap` 한 덩어리라 예전과 같은 한 줄 글.
- 핀3곳 hyeonjang-v464-margin1280(v463 위). 신규 tests/margin1280-v464.e2e.js 3/3(1280·1024·1440·390), 기준선(1c80132: 1379px)·변이 wide(84px 규칙 제거 → 985px) 실패 확인. 관련 16개(pcdark-v452·mobile-tap-table·dash-cards·photo-safety-ui·margin·margin-v429·darkcards-v453·polish-v456·rehearsalfix-v449·board-v351·extras-settle·insight-v445·quote-vat·ledger-roundtrip·trip-expense-overlap·mobile-screen-layout) 통과, 정적 19개 통과.

## 2026-10-23 v463 👷 팀 앱 연동 4차 — 완료보고서의 '팀 보고 사진' 묶음 빼기/넣기 (개발_백로그 4번)

- `hjTeamReportPhotos(p,photos)`(읽기만): 완료·검수 요청 보고마다 사진 묶음 — 이 세션에 `_teamReport===key` 가 남은 사진이 있으면 그것만(key), 없으면 보고 workDate 와 사진 한국 날짜(hjPhotoKoreanDay)가 같고 아직 다른 보고에 안 묶인 현장 사진(day; 같은 날 보고 둘이면 먼저 온 보고가 가져간다). `_teamReport` 는 직렬화되지 않아 새로 열면 day 로 떨어진다 — 그래서 묶음 줄에 '(보고 n장 · 이 기기 m장)' 을 같이 쓴다. 막힘·대기 보고, 사진 0장 + 못 찾은 보고는 줄이 없다.
- `aptReportView` 입력칸 **위**에 `[data-rp-teamphotos]`: 줄마다 `[data-rp-team-bundle=key]`(label 44px, 체크 `[data-rp-team-include]`, 썸네일 4장까지; 이 기기에 0장이면 disabled). 체크를 풀면 그 사진이 `__rpExcluded`(창 안 변수)에 들어가 PDF `photos` 에서만 빠지고(`photos:ph.filter(f=>!__rpExcluded.has(f))`), 작업 내용 줄·저장 자료는 그대로. `[data-rp-photo-count]` 가 따라 바뀐다. 저장 키 없음, 빼기는 저장하지 않는다(창을 닫으면 원래대로).
- 핀3곳 hyeonjang-v463-teamphotos(v462 위). 신규 tests/team4-v463.e2e.js 3/3(390px), 기준선(355625f)·변이 no-exclude 실패 확인. 관련 10개(team3-v458·demo-v462·doccenter-v433·leakreport-v422·phototags-v454·publicweb-v446·reportfill-v408·v219-operations·contract-terms·mobile-more-sweep) 통과, 정적 검사 통과.

## 2026-10-23 v462 🧪 데모 자료 보강 — 팀 보고 2건 · 아파트 서류 발행 1건 · 영수증 지출 2건 (개발_백로그 3번)

- loadDemo 가 기존 저장 자리만 채운다(새 키·새 현장 없음, 현장 4곳 그대로 — settings-safety 의 `projects.length === 4` 계약 유지): 망원동 카페 `p.workOrders[0]`(wo_20250309_001) `.reports` 완료 1(03/10, 사진 3)·검수 요청 1(03/12) → 첫 화면 '🔎 검수 요청 1건'·'📄 팀 보고 1건 들어옴 · 사진 3장' 줄, 📎 서류 만들기 '👷 팀 보고 1건', [완료보고서 초안] 작업 내용에 '03/10 …' 줄(v458 hjReportDraft).
- 은행동 한빛아파트 `p.docs` 에 **이웃 동의서(AC-)만** 3일 전 발행 — 신청서(aptapply)는 일부러 안 넣는다(aptdocs-v441 ③ 의 시공 D-2 '서류 4종 만들기' 할 일이 데모의 핵심). 📎 서류 만들기엔 '발행 1/4'.
- 영수증 지출 2건: `state.expenses=[]` 로 비운 뒤 src:'receipt' 2줄(3일 전 한밭철물 38,500 현금 @망원동 카페 · 어제 SK주유소 55,000 카드 공통) + kind:'receipt' 가상 파일 2개(이름은 hjReceiptFileName 꼴 `영수증_YYYYMMDD_상호_금액원.jpg`, `_file` 에 SVG File 을 넣어 🧾 보기(hjReceiptPreview → getFileOf)가 그림을 연다). 실제 지출은 데모 화면에서만 안 보이고 저장본은 그대로([데모 끝내기]=reload 로 복귀, demo-v462 ③).
- 토스트·mountHint 는 세어서 쓴다('현장 4곳 · 파일 17개 · 팀 보고 2건 · 영수증 2장'). 데모 숫자를 바꾸면 demo-v462 ① 의 토스트 단언도 같이.
- 핀3곳 hyeonjang-v462-demo(v461 위). 신규 tests/demo-v462.e2e.js 3/3(390px 씨앗·화면, 1280px 저장 안 됨), 기준선(3606800)·변이 no-reports 모두 ① 에서 실패 확인. 관련 15개(settings-safety·demo-banner·aptdocs-v441·mobile-tap-table·action-search·amount-sign·trip-expense-overlap·team3-v458·dash-cards·mobile-more-sweep·inqpending-v386·expenseocr-v435·receipt-project·ledger-roundtrip·custfill-v394) 통과. 정적 19개 통과.

## 2026-10-22 v461 📇 관리사무소 명단 — 아파트 관리 탭 카드 · prompt() 대신 인라인 폼 (개발_백로그 2번)

- 🏢 아파트 관리 탭 KPI 아래 `#aptOfficeList`(data-aptoff-list): state.aptOffices 전체 — 단지·담당자·📞 전화 링크·현장 수(aptMgmtGroups 단지 키 일치)·오더 수, 현장 많은 순. aptOfficeListRows/Text/Html 은 읽기만. [📋 복사](aptOfficeListCopy → clipboard, 실패 시 coworkCopyFallback) 글줄은 '단지 관리사무소 · 담당자 · 번호' — 고객 정보 없음.
- 인라인 폼 `#aptOfficeForm`(aofId·aofComplex·aofManager·aofPhone, `[data-aptoff-save]`·`[data-aptoff-cancel]`): [+ 등록](data-aptoff-new)·줄의 [✎](data-aptoff-edit=id)·단지 카드의 [🏢 관리사무소 등록](data-aptoffadd → aptMgmtOfficeAdd 가 폼이 화면에 있으면 prompt 대신 aptOfficeFormOpen) 모두 같은 폼. 저장은 v457 hjAptOfficeUpsert(같은 단지 = 한 줄, 새 값이 덮음) + 고치기(id)일 땐 빈 값으로 지우기도 허용. #view 위임.
- tests/apartment-manage 는 dialog 두 번 대신 폼을 채우고, 단지 카드 선택자를 `.cust-card:not(#aptOthers):not(#aptOfficeList)` 로.
- 핀3곳 hyeonjang-v461-officelist(v460 위). 신규 tests/officelist-v461.e2e.js 3/3(390px, prompt 가 뜨면 실패로 셈), 기준선·변이 list-off(OFFICE_LIST) 실패 확인. 관련 10개 통과. 정적 19개 통과.

## 2026-10-22 v460 📋 대표 할 일 — Claude 인수인계 (앱 안에서 보는 '대표가 할 일' 표)

- `HJ_OWNER_TODO`(상수 9건: 묶음 병합·PR #189·리뷰 링크·결정 3건·카카오 채널 주소·원고 게시·병합 뒤 폰 확인; 판마다 갱신)와 체크 저장 `localStorage hj_owner_todo_done`({id:날짜}) — **앱 자료는 바뀌지 않는다**(새 저장 키 없음, 기기별). 항목 `auto()` 가 참이면 '자동 확인'(리뷰 링크가 들어감 / github.io 에서 실행 중 = 병합됨).
- 팀 업무·인수인계 보드(hjTeamBoard) 맨 위 `[data-owner-todo-card]`(남은 것 n건·체크박스 44px·[설정 열기] hjOpenSettingsTab(tab,focus)·[열기 ↗] 링크·[끝난 것 n건 보기] — `filters.ownerDone` 으로 재그림) · 첫 화면 오늘 현장 업무 `[data-owner-todo-line]` "📋 대표 할 일 n건 — 첫 항목" + [보기](`data-owner-todo-open` → hjTeamBoard, #view 위임). 직원 모드(hjStaffOn/body.hj-staff)에선 둘 다 없음.
- 핀3곳 hyeonjang-v460-ownertodo(v459 위). 신규 tests/ownertodo-v460.e2e.js 3/3(390·1280, 저장본 불변·새로고침 유지·자동 확인·설정 탭·직원 모드), 기준선(OWNER_TODO_LINE)·변이 no-persist(OWNER_TODO_PERSIST) 실패 확인. 관련 12개 통과. 정적 19개 통과. 체크박스는 바뀌면 카드를 다시 그리므로 검사에서 `check()` 대신 `click()`.

## 2026-10-22 v459 어두운 화면 남은 8건 + 밝은 화면 '미연결' (리허설 R7 를 v458 판에서 다시 돌려 찾음)

- R7 PC 스윕(514화면, 6.5분) v458 판: 밝은 화면 저대비 42→4(남은 4는 disabled 단추·이모지), 어두운 화면 15→8(모두 1노드). 고친 것 — v453 속성 선택자 목록에 배경 `#dbeafe`(코드 칩)·`#fef9c3`(키 배지)·`#f3f4f6`(승인 칩) 추가, 글자색 `#9a3412`→warn-fg·`#166534`→ok-fg·`#475569`→ink 추가 · `body.dark .ai-b.u{background:#1d6fe0;color:#fff}`(어두운 blueprint #6ab0ff 위 흰 글씨 2.3:1) · 💾 백업 센터 '미연결'·공개 페이지 '승인 대기' 칩 `#9ca3af`→var(--muted).
- 남긴 것: `button:disabled{opacity:.4}` 글자(📨 전자계약 준비중·🏢 동·호수 일괄 등록) — 비활성 요소는 대비 예외. 이모지 아이콘. 'tabs-wrap'(PC 탭 줄 2줄, 511화면)은 v451 부터 같은 값 — 탭 14개가 한 줄에 안 들어가는 설계값이라 두었다.
- 핀3곳 hyeonjang-v459-darkrest(v458 위). 신규 tests/darkrest-v459.e2e.js 3/3(1280 어두운/밝은, disabled 제외 4.5:1 샘플러), 기준선(DARK_REST_READABLE llamaSetup) 실패 확인. 관련 10개 통과. 정적 19개 통과. 리허설 결과 `리허설\r7-result.json`(v458 판, 이전 판은 r7-result-v452.json).

## 2026-10-22 v458 팀 앱 연동 3차 — 팀 작업 보고 → 📄 완료보고서 · 시기 줄 0명 숨김 · 묵은 검사 2개 고침

- 보고는 v432 자리(wo.reports[]·p.teamReports[]) 그대로 읽는다 — hjTeamReportsOf(p)(order 붙여 날짜순), hjTeamDoneLines(p)(done 보고의 한 일 → 'MM/DD 한 일' 줄, 보고자 이름·이슈·검수(review) 보고는 안 넣음 — 관리사무소·고객에게 가는 문서). hjReportDraft 가 공정 줄 뒤에 이 줄을 날짜순으로 붙이고(같은 글은 한 번) 기간(days)에 보고 작업일을 넣는다 · 돌려주는 값에 team·teamPhotos. aptReportView 에 `[data-rp-team]` 안내.
- 첫 화면 `[data-team-done-doc]` "📄 팀 보고 n건 들어옴 · 사진 m장 — 현장 [완료보고서 초안][넘기기]"(hjTeamDoneDocHtml, 팀 검수 줄 바로 뒤·v386 문의 줄 계약 유지, 3현장까지). [완료보고서 초안] → aptReportView · [넘기기] → hjTeamDoneMark(name,'skip') 보고 레코드 docAck · PDF 를 만들면 hjTeamDoneMark(name,'doc') docAt=오늘 → 줄이 내려간다. 새 저장 키 없음(보고 레코드 안 표식). 📎 서류 만들기 완료보고서 줄에 '👷 팀 보고 n건'.
- HJ_WO_PHASE_LABEL.during '작업 중' → '시공 중'(v454 단계 이름과 같게 — 보고서 묶음이 합쳐진다).
- hjSeasonDueHtml: 보낼 수 있는 고객이 0명이면 첫 화면 줄을 띄우지 않는다(시기 내내 '0명' 줄이 남았고 custfill-v394 의 줄 순서 계약도 깼다 — 10/22 환절기 결로 시기에 드러남). 원고는 더보기 › 계절 캠페인에서.
- 묵은 검사(전체 333개를 한 번 돌려 찾음): geocode-label ⑮ 는 String(openGdriveSetup) 을 봤는데 v444 직원 모드 감싸기 뒤로는 감싼 함수라 늘 실패 → 실제로 열어 `#setTab-keys` 의 DOM 을 본다 · pages-artifact 허용목록 기대값에 v431 의 leak.css/html/js 가 빠져 있었다 · mobile-screen-layout 큰 글자 모드는 v454 단계 칸 때문에 .mbody 가 스크롤돼 scrollIntoView 가 0.2px 걸친다 → 1px 여유(닿는지는 elementFromPoint 가 본다). crew-v440 ③ 의 44px 단언은 4병렬에서만 43.99998 로 흔들린다(혼자 돌리면 통과). 환경 전용 실패: apartment-projects·bathroom-quality-v410·document-select/upload·team-workboard(다운로드 파일 이름), offlinequeue-v425·offlinequeue-cache-v425.unit(PR #189 캐시 이름), relay·office-intake-sync 는 mock-relay(8398)를 띄우면 통과.
- 핀3곳 hyeonjang-v458-team3(v457 위). 신규 tests/team3-v458.e2e.js 3/3(390px, PDF 스텁), 기준선·변이 team-lines(TEAM_LINES_IN_REPORT) 실패 확인. 관련 13개 통과(teampacket-v432·team2-v444·photo-report·photo-report-output·reportfill-v408·inqpending-v386·dash-cards·doccenter-v433·app-version·phototags-v454·season-v448·custfill-v394·geocode-label). 정적 19개 통과. 이번엔 전체 묶음(333개)도 한 번 돌렸다 — 아래 v457 항목의 '묵은 검사' 참고.

## 2026-10-22 v457 아파트 서류 2 — 손으로 적은 기간이 남음 · 관리사무소 명단에 바로 적기 · 낡은 탭 창 닫기 경고

- 🏢 아파트 서류 화면에서 고친 값은 현장 안 `p.aptDocs` 에 **자동값과 다른 것만**(complex·dong·ho·from·to·hours·noisyHours·works·elevator·route·waste, officeId, at) 남긴다 — hjAptDocsRemember(이름,s): 칸 change·단추 누름·창 닫힘(__modalOnClose) 때. 바뀐 게 없으면 저장하지 않는다(aptdocs-v441 "열고 닫기만 하면 저장본 불변" 유지). hjAptDocModel 은 저장값 위에 화면값을 얹고(`{__auto:true}` 면 자동값만), 끝이 시작보다 앞서면 시작일로. 기간을 손으로 고치면 `[data-ad-period-manual]` "📌 손으로 적은 기간 — 일정은 …" + [일정대로](저장값에서 from·to 삭제), 일정이 없으면 `[data-ad-period-empty]` 안내.
- 첫 화면 "🏢 관리사무소 서류 4종 만들기 (시공 D-n)"(hjAptDocsDue)은 hjAptDocsStart — 손으로 적은 from 이 있으면 그것, 없으면 일정 첫날. 동·호수도 저장값을 본다.
- 관리사무소 명단(state.aptOffices): 서류 화면 `[data-ad-office]` 줄에서 바로 — 없으면 [+ 관리사무소 등록](단지 미리 채움, 담당자·번호 → hjAptOfficeUpsert: 같은 단지 키면 그 줄, 빈 칸만 채움·새 번호는 덮음), 명단에 있는데 이름이 달라 못 찾으면 `#adOffice` <select> 로 골라 `officeId` 연결, 있는 줄은 [✎ 고치기/번호 넣기]. 번호 없이 [💬 관리사무소 문자]를 누르면 보내지 않고 칸을 연다. prompt() 창은 쓰지 않는다.
- 낡은 탭(__tabStale): persistLocal 이 저장을 건너뛰면 `__hjLocalSavePending` 도 내린다 · beforeunload 는 `pending&&!__tabStale` 일 때만 — '새로고침하세요' 띠를 띄워 놓고 창 닫기 경고로 막던 것(settings-safety ⑤가 v450 부터 깨져 있었다).
- tests/mobile-tap-table "PC에서 불필요한 안내": v452 부터 PC 마진 표(10열·금액 줄바꿈 금지, 자연 폭 1369px)는 1280px 에서도 일부러 옆으로 민다 → 안내는 **넘치지 않는 표에 붙은 것만** 불필요한 것으로 센다(v452 부터 깨져 있던 단언).
- 핀3곳 hyeonjang-v457-aptdocs2(v456 위). 신규 tests/aptdocs2-v457.e2e.js 2/2(390px), 기준선·변이 no-remember(MANUAL_PERIOD_KEPT) 실패 확인. 관련 21개 통과(aptdocs-v441·rehearsalfix-v451·apartment-manage/units·apt-orders/edit·doccenter-v433·mobile-tap-table·settings-safety·multi-tab-guard·rehearsalfix-v450·demo-banner·dash-cards·polish-v456·insurance-v442·evidence-v427·action-search). 정적 19개 통과.

## 2026-10-22 v456 다듬기 (R2·R7 남은 것) — 리뷰 링크 힌트 · 밝은 화면 작은 글자 · PC 영수증 확인 두 칸 · 키 없는 AI 두뇌 카드

- 🎉 준공 관리 카드: `__reviewUrl` 이 비면 [⚠ 리뷰 링크 없음 — 설정](`[data-review-link-missing]`, hjOpenSettingsTab('etc','rvUrl')) — 링크 없이 리뷰 요청을 보내기 전에 보이게(R2). 링크를 넣으면 사라진다.
- 밝은 화면 작은 글자(R7 42건): `.st-tab small`·`.st-prog` #9fb3c6→#6b7f95 · `.ph-hint` 는 뒤쪽 규칙(571행 부근)이 v453 의 앞쪽 규칙을 덮어 효과가 없었다 → 그 규칙 자체를 고침 · `.ph-chk` 배경 .4→.62 · 글자색 `#e8912d` 12곳→`var(--hj-warn-fg)`(그래프 선·점은 그대로) · 글자색 `#94a3b8`/`#9ca3af`→`var(--muted)`/#6b7280(원가 출처 '없음', 비교표 '—', 시즌 상태, 수요·등급·위험 낮음, 고객 페이지) · 비준공 준공 카드 opacity .5→.8+본문 ink(warranty-review 가 style 의 opacity 를 확인하므로 opacity 는 남김) · 문서 센터 예정 줄·시즌 비선택 줄·보존 비대상 줄은 opacity 대신 `background:var(--paper-2)`.
- AI 두뇌 선택(.provPick)·AI 운영 모드(.opProvPick): 키 없는 카드가 `disabled`+흐림이라 '눌러서 등록'이 눌리지 않았다 → disabled 제거, 점선 테두리(`data-available`/`data-ready`), 누르면 hjOpenSettingsTab('keys')(llama 는 llamaSetup). 키 있는 카드 동작은 그대로.
- PC(≥900px, 비모바일) 🧾 영수증 확인 `#hjRcConfirm`: grid 두 칸 — 사진 `[data-rc-photo]` 1칸 sticky(60vh), 나머지 자식은 모두 2칸(`>:not([data-rc-photo]){grid-column:2}` — 12행 span 만 주면 13번째부터 사진 아래로 흘렀다). 폰은 그대로 한 줄.
- 핀3곳 hyeonjang-v456-polish(v455 위). 신규 tests/polish-v456.e2e.js 4/4(1280·390 두 컨텍스트, 조상 opacity 를 섞은 4.5:1 대비 샘플러), 기준선(REVIEW_LINK_HINT)·변이 rc-grid(RECEIPT_TWO_COL) 실패 확인. 관련 15개 통과. 정적 19개 통과.
- 알아둘 것: 부팅 토스트 '📅 전우철 시험 일정 2건…'(BUILTIN_CALENDAR_IMPORTS, 9/1·9/14 — 이미 지난 날짜)은 새 기기마다 한 번 뜬다 — 지울지는 대표 결정(수험번호가 공개 소스에 있다).

## 2026-10-22 v455 자재 뒷정리 (R6·R7 남은 것) — 입고 취소 뒤 재고 되돌림 · 단가 이력 중복 · 1024px 견적서 내역 표

- hjMatReceive(id,false) 가 hjMatLeftFromInventory 로 📦 재고에 옮긴 남은 자재(o.items[].left·movedToInv)를 그 수량만큼 뺀다(0 아래 없음, 표식 지움) — 예전엔 입고 취소 뒤에도 재고에 남아 재입고 때 또 더해졌다.
- hjSupPriceAdd: 같은 품목·규격·단가·날짜·출처 기록은 한 번만 — 입고 취소→재입고→원가 반영을 반복하면 '단가 6개'로 불었다.
- PC 첫 화면 견적서 내역 표 `#dashboardQuoteTable`(.dash-margin-scroll 안, 900px 이상 min-width 900px) — 1024px 에서 이름 칸이 71px·4줄이었다. 폰 카드(dash-cards)는 그대로.
- 핀3곳 hyeonjang-v455-material2(v454 위). 신규 tests/material2-v455.e2e.js 3/3, 기준선(LEFTOVER_REVERTED) 실패 확인. 관련 8개 통과. 정적 19개 통과.

## 2026-10-22 v454 인테리어 사진 시공 전/중/후 칸 · 완료보고서 공정 줄 중복 (R2 남은 것)

- 사진 추가 확인 창(openPhotoIntake) — 인테리어(누수 아님) 현장을 고르면 `#photoIntakeStageTags` 칩 [시공 전][시공 중][완료 (시공 후)](HJ_PHOTO_STAGE_LABELS, 누수 태그 단추와 같은 모양·44px). approved.stageTag → runPhotoIntake 가 새 기록의 공정 칸 `_phase`(저장 phase, 새 키 없음)에 HJ_PHOTO_STAGE_PHASE('시공 전'·'시공 중'·'완료') 를 넣는다 — PHASE_SIDE_NAME 과 같은 이름이라 전/후 갤러리(beforeAfterPairs)·하자보증서 풀(hjPhaseHit)이 그대로 읽는다. 재사용 기록·누수 현장·호출자 훅(onRecord)이 정한 공정은 건드리지 않는다. '시공 중'은 전/후 어느 쪽도 아니다(의도).
- 완료보고서 초안(hjReportDraft) 작업 줄: 공정 줄과 사진 묶음을 **묶음 이름의 공종 낱말(HJ_PHASE_MAP)·묶음 사진의 공정 칸**으로도 맞춘다(groupKeys) — 예전엔 이름이 똑같을 때만 맞춰 '철거'와 '시공 전 — 기존 욕실 철거 (2장)'이 둘 다 들어갔다. 한 묶음은 한 번만.
- 핀3곳 hyeonjang-v454-phototags(v453 위). 신규 tests/phototags-v454.e2e.js 4/4(실제 사진 추가 창·runPhotoIntake), 변이 report-dup(REPORT_NO_DUP_LINES)·기준선(PHOTOTAGS_API_PRESENT) 실패 확인. 관련 20개 통과(leakdetect-v420 은 4개 동시일 때 '실패한 저장은 appState 를 안 바꾼다' 단언이 800ms 자동 저장과 겹쳐 흔들림 — 혼자 10/10 두 번). 정적 19개 통과.

## 2026-10-22 v453 어두운 화면 — 인라인 파스텔 카드·진한 글자색 (R7 남은 48화면)

- 인라인 style 로 박힌 밝은 배경(#eff6ff·#eef6ff·#f0fdf4·#fffbeb·#fff5f5·#fef2f2·#fff7ed·#f4f7fb·#f8fafc·#fee2e2·#fecaca·#dcfce7·#f7fafd)은 `body.dark [style*="#…"]{background:var(--paper-2)!important}` 로, 진한 글자색(#0b4ea2·#1d4ed8·#2563eb → --blueprint, #b91c1c·#c2410c·#991b1b → --hj-danger-fg, #0a7f43·#15803d → --hj-ok-fg, #b45309 → --hj-warn-fg, #64748b·#94a3b8 → --muted)은 `[style^="color:#…"],[style*=";color:#…"],[style*=" color:#…"]` 로만(배경·테두리에 쓴 같은 색은 그대로 — darkcards-v453 ④ 가 지킨다). 밝은 화면은 손대지 않는다.
- 그 밖 어두운 화면: 달력 토요일(.cal-dow.sat·.cal-cell.sat .cal-d) · .ph-hint 알약(밝은 화면도 9px 글자 #6b7f95 로) · 아바타·현장 단계 탭·탭 배지 글자 #06111c · class 없는 링크 --blueprint · 첫 화면 백업 카드(--hj-danger-bg) · ghost 단추 글자 · 모달 안 색 단추의 부제 span · 비교표 차이 줄 --hj-diff-bg 는 불투명 #3a2a20(반투명이면 대비를 잴 수 없다).
- R7 PC 점검 다시: 어두운 화면 3:1 미만 48화면 → 15화면(남은 건 ✨ 아이콘·'26개월 남음' 알약처럼 아이콘·배지), 밝은 화면 42(9~11px 보조 글자 2.5~2.9:1 — 다음).
- 핀3곳 hyeonjang-v453-darkcards(v452 위). 신규 tests/darkcards-v453.e2e.js 4/4(글자/배경 대비 측정), 기준선(DARK_CARDS_READABLE) 실패 확인. 관련 12개 통과(proposal-v437 은 부팅 2.5초 뒤 백업 토스트와 겹치면 '마지막 토스트' 단언이 흔들린다 — 혼자 4/4). 정적 19개 통과.

## 2026-10-22 v452 PC 화면·어두운 화면 고침 (리허설 R7 — 1280·1024·다크 514화면 점검 → 찾은 것)

- 점검 대본 /mnt/user-data/outputs/리허설/sweep-r7-pc.js(결과 r7-result.json): PC 1280·1024·다크 1280 에서 탭·현장·견적 편집기·설정·새 화면 35·더보기 115 를 열어 가로 넘침·가림·대비·죽은 단추를 쟀다. 넘침 0·페이지 오류 0·죽은 단추 0, 아래를 고쳤다.
- **견적 편집기 합계 칸 잘림(1024px)**: `.qm-wrap{grid-template-columns:minmax(0,1fr) 260px}` — 1fr 은 품목표 최소 폭 아래로 못 줄어 `.qm-side` 가 `#view{overflow-x:clip}` 밖으로 나갔다(공급가·부가세·총액이 안 보임). 761~1100px PC 는 한 칸으로 쌓고 합계를 위로.
- **PC 더보기**: 126개 기능 목록이 폰 하단 메뉴에만 있었다 → 탭 줄 끝 `#btnMorePc`(⋯ 더보기, `.tab-more`, 폰 모드는 숨김) 가 같은 openMoreSheet() 를 열고 PC 에선 가운데 창(`body:not(.mobile-mode) .more-sheet`). 검색창 바로가기(hjCmdRender)도 HJ_ACTIONS 30개 뒤에 더보기 기능(hjMoreCmdHits → moreOpenFeature)을 붙인다(같은 이름 한 번, 8개까지). `.tab` 이 아니라 탭 키보드 순환·roving 계약(uiux) 그대로.
- **🤖 비서 창 z-index 9998 → 66**(모달 70·토스트 80 아래): 비서가 연 손익·설정 창이 폰에서는 통째로, PC 에선 닫기 단추가 비서 창 뒤에 숨었다. 키 없을 때는 hjOpenSettingsTab('keys') 로 🔑 탭을 바로 연다.
- **officeOpsCall 주소·토큰 문**(commercialCall 과 같은 것, code 'office-setup'): 빈 주소로 postIsolated → fetch('') 가 앱 페이지 자신에게 POST 를 보냈다.
- **어두운 화면**: `--card`(설정 탭 배경, 정의가 없어 흰색)·`--hj-soft-bg`·`--hj-diff-bg` 변수 + `body.dark` 값; 비교표 차이/합계 줄(`#hjQuoteCompare [data-qc-diff|data-qc-total]`); 단추 hover(`button:hover` 가 `--ink`=#e8eef5 바탕에 흰 글자라 글자가 사라짐) → 어두운 바탕; `.blue/.clay/.moss` 단추 글자 #06111c(#6ab0ff·#3fb89e 위 흰 글자 2.3:1); 선택된 설정 탭 글자; 계절 캠페인 '· 지금 시기'(`[data-season-now]`, 인라인 색 → CSS). 밝은 화면 선택 칩도 #bbf7d0.
- **PC 배치**: 첫 화면 '현장별 지출·마진' 표 `#dashboardMarginTable`(td.nm 150px·금액 nowrap·min-width 1180·`.dash-margin-scroll` 가로 스크롤 — @media(min-width:900px) 안에서만, dash-cards 폰 카드 계약 유지); 인건비 장부 `#llRows`·사용설명서 `#hgBody` 의 안쪽 스크롤 상자는 PC 에서 max-height 없음(모달이 스크롤); 📎 서류 만들기는 PC 두 칸(`.mbody:has(.docHubBtn)`), '예정 · v437' 내부 표기 → '준비 중'; 문서 미리보기 `.doc-preview-frame` PC 60vh; PC 토스트도 위; `input[type=password]` 기본 상자 스타일; 백업 안내 토스트가 홈 카드와 같은 말('아직 백업한 적이 없어요').
- 🧾 영수증 넣기(hjReceiptAdd)는 폰에서도 먼저 창을 연다(바로 고르려면 {pick:true}) — 더보기에서 바로 파일 선택창이 뜨는 건 mobile-more-sweep 의 '화면 없는 기능' 위반이었다(v435 부터 떨어져 있던 검사). 리허설 r4r5 대본도 맞춤.
- 남은 것(다음): 다크 파스텔 인라인 배경(#eff6ff·#f0fdf4·#fffbeb·#fef2f2 27화면)·하드코딩 글자색(#0b4ea2·#b91c1c·#1d4ed8)·주 탭 11개 두 줄·외주 요청 범위 두 번(v451 에서 중복 제거함)·영수증 확인 PC 두 칸.
- 핀3곳 hyeonjang-v452-pcdark(v451 위). 신규 tests/pcdark-v452.e2e.js 7/7(1280·1024·390 세 창), 변이 qm-grid(QM_SIDE_VISIBLE_1024)·기준선(PCDARK_API_PRESENT) 실패 확인. 관련 23개 통과(dash-cards 는 PC 표 규칙을 900px 이상으로 묶어 고침, mobile-more-sweep 126/126). 리허설 R4·R5 다시 12/12. 정적 19개 통과.

## 2026-10-22 v451 리허설 R6 고침 (관리·사후·안전 — 아파트 서류·보험·보증/AS·자재·외주·데이터 안전·공개 웹 → 찾은 것)

- 리허설: /mnt/user-data/outputs/리허설/rehearsal-r6.js(8단계, 390px·합성·외부 쓰기 0) 결과 r6-result.json — 8/8 되지만 11가지 문제를 찾았고 그중 돈·개인정보·흐름 9가지를 여기서 고쳤다.
- **외주팀 일당(hjCrewRate)**: 팀원 연락처(c.dayRate)에 없으면 📇 거래처 외주(s.rate{type:'day',amount})도 본다 — 👷 인건비 장부 [1][½] 에서 외주팀 공수가 0원으로 들어가 정산표·지급 명세·현장 인건비가 줄었다. 장부 이름 토글은 사람별 공수(labor.by)가 있으면 그 이름만(띄어쓴 외주팀 이름이 낱말마다 유령 토글이 됐다).
- **보존 정리(v447)**: hjRetContactLive — 같은 번호의 다른 현장이 아직 살아 있으면(최근 활동 3년 안·활동일 없는 진행 중) 📇 연락처는 익명화하지 않고 contactsKept 로 센다(미리보기 data-ret-contact-live, 완료 토스트 '… 연락처 n명은 남김'). hjRetScrub 은 '고객 고객' 을 '고객' 으로.
- **백업(backupNow)**: 백업 기록(backupMarkDone)은 exportData 의 공유가 끝났을 때(then)만 — 공유 창을 닫아도 '0일 전 백업'이 되고 3·7일 경고가 꺼졌다.
- **문자 받는 사람**: msgCenterCompose(kind,{to:{name,phone}}) — 고객이 아닌 받는 사람(외주팀·작업자)이면 현장 고르기 칸을 감추고(data-mc-to) 그 번호로만 보낸다(번호 없으면 복사). hjDocDeliverView 의 sms.to 가 넘긴다 — 지급 명세(hjCrewPayslipView)·외주 요청서 PDF(hjSubQuoteView) 의 💬 문자 초안이 현장 고객에게 가던 것. 보관(archived) 현장이 preset.project 면 목록에 넣는다(안부·AS 문자가 첫 현장 고객에게 가던 것). 아래 '편집으로' 라벨은 leakquote-v421·leakreport-v422 가 누르므로 그대로.
- **아파트 서류(v441)**: hjAptSchedRows 가 상담·실측·견적·현장 확인·AS 방문 일정(HJ_APT_NONWORK_RE·hjIsAsVisitSched)을 뺀다 — 지난 상담 일정 때문에 D-n 줄이 안 뜨고 공사 시작일이 상담일이 됐다.
- **한국 날짜**: hjIsoLocalDay/hjIsoLocalStamp(ISO Z → 이 기기 날짜·시각) — hjAptDocsIssue 의 '오늘 이미 발행' 비교(새벽 0~9시에 같은 서류가 -02 로 또 발행), 외주 요청 기록 날짜, 변경 기록 보기·CSV 시각. 다른 `.at.slice(0,10)` 자리(보증서 서명·세대 발행 이력·만족도·카카오 리드)는 표시용이라 두었다 — 같은 도우미로 바꾸면 된다.
- **문서용 사진 미리보기**: hjDocThumbLater — 사진 넣기(runPhotoIntake)가 끝난 뒤 새 사진의 480px JPEG data: 를 만들어 thumb 과 thumb-local: 캐시에 둔다. 화면용 blob: 만 있어 하자보증서·피해 확인서·누수 보고서·외주 요청서의 사진 고르기(hjDocThumbOk)에 방금 찍은 사진이 안 나왔다(드라이브 재수신 사진만 됐다). thumb 은 직렬화하지 않는다(파일 화이트리스트 그대로).
- 그 밖: 보증 만료 안부(hjWarrantyCareRows)는 📦 보관 현장도(끝낸 현장을 보관하는 게 정상 흐름) · 무상 판정 문자는 '무상 보수 대상으로 보여요 … 방문해서 확인한 뒤 확정'(방문 전 확정 약속 없음) · 첫 답장(hjInquiryNoReply)은 문의 30일 안만(HJ_FIRST_REPLY_DAYS, 시각 모르면 그대로) · 외주 요청 범위 품목 중복 제거 + 같은 날 같은 요청은 기록 1건.
- 안 고친 것(대표 결정·다음): 삭제 요청 뒤 안전판 12칸에 정리 전 개인정보가 남음(안내문에 적을지·지울지) · 입고 취소 뒤 재고에 남은 자재 · 재입고 단가 이력 중복 · 인테리어 사진 전/중/후 칸 · 완료보고서 공정 줄 중복 · 사례 내보내기 누수 문구.
- 핀3곳 hyeonjang-v451-rehearsal3(v450 위). 신규 tests/rehearsalfix-v451.e2e.js 7/7, 변이 crew-rate·sms-to·ret-live·기준선(REHEARSALFIX_API_PRESENT) 실패 확인. 관련 40여 개 통과(leakdetect-v420 은 4개 동시일 때 한 번 시간 차 — 혼자 10/10, offlinequeue-v425 는 #189 전 버전 문자열 문제 그대로). 정적 19개 통과.

## 2026-10-17 v450 리허설 R2·R3 고침 (인테리어 하루·폰 갤러리/설치/오프라인 → 찾은 것)

- 리허설: /mnt/user-data/outputs/리허설/rehearsal-r2r3.js(R2 인테리어 하루 10단계 — 욕실 상담 페이지 연결 포함, R3 폰 5단계 — 공유·촬영·오프라인·설치·알림) — 390px·합성·외부 쓰기 0.
- **견적 안 확정이 다시 켜면 풀리던 돈 문제(v437 내 코드)**: 가상 견적 파일(_fromQuote)은 직렬화되지 않아 f.exSum 이 앱을 다시 열면 사라지고 두 안이 다 매출에 더해졌다. 이제 견적 레코드가 주인 — 고르지 않은 안 q.exSum=true + q.tierLost=<고른 안 id>, 고른 안은 둘 다 지움(hjQuoteTierApply), 가상 파일을 만드는 두 곳 — syncQuoteToProject(옛 appState 복원·견적 저장)와 paidExactQuoteRuntimeFiles(확정 저장 durableLocalMutation 직후·paid-generation 복원 — 리허설 R3 가 탄 길) — 이 다 f.exSum=!!q.exSum. 견적·정산 Σ 단추도 앱 견적이면 q 에 같이 쓰고(다시 넣으면 tierLost 도 지움), quoteCommitEditing 은 저장된 견적의 exSum·tierLost 를 지킨다(현장을 바꾸면 푼다). estFinalCandidates 는 앱 견적을 뺀다(이름 '제YYYYMMDD' 로 ★ 최종본 묶음에 걸렸다).
- 고르지 않은 안 = quoteStatus 'lost'(사유 '다른 안 확정', hjQuoteLostReason) — 수동 '수주' 표시는 풀고 수동 '종결'은 그대로. 수주율(winRateData·funnelData·견적 이력 '결정')에서는 뺀다(hjQuoteTierAlt — 한 공사의 다른 구성). 견적 이력 줄 data-qh-tieralt, 비교표 data-qc-confirmed·확정된 안 단추 aria-pressed. 다른 안을 🎉 수주로 누르면 그 안으로 다시 확정(quoteMark).
- 견적 번호 hjQuoteNextNo: 같은 날 두 번째부터 '제YYYYMMDD-2'… (newQuote). 💰 입금 기록 #rqMethod(계좌이체 기본·현금·카드·기타·모름) → payLog.method → 간이영수증·세무 자료(rqAmt·rqDate 그대로, 미수 자동 채움 없음 — receivable-removed 계약).
- 💬 방문은 잡았는데 답장 안 한 문의(문의 3일 안, hjInquiryBookedNoReply) — 대시보드 #dashboardInquiryBookedNoReply [data-firstreply-booked], v386 줄 바로 위(#dashboardInquiryPending + div 계약 유지).
- 📲 폰 첫 화면 앱 설치 줄 #dashboardInstall(beforeinstallprompt 있을 때만, ✕ = localStorage hj_install_chip_off, PC 화면은 CSS 로 숨김 — 사이드바 ⤓ 단추). 모바일 모드에선 aside 가 숨겨져 설치 안내가 아무 데도 없었다.
- 대기함(v425): hjOutboxBackendReady()(relayReady()||__gdToken) 없으면 '☁ 대기 사진 n장 올리는 중' 안 띄움, 손으로 누르면 '서버·드라이브 연결 전이라 … 이 기기에 보관', 아래 띠 '💾 서버·드라이브 연결 전 — … 이 기기에 보관'. hjOutboxOnline 은 flush 를 quiet 로 불러 토스트 한 번만.
- 창 닫기 경고: (state.dirty&&state.dirHandle)||__hjLocalSavePending(persistLocal 의 기기 저장이 안 끝남)||photoIntakePending() — 폴더 없는 폰은 dirty 가 풀릴 길이 없어 공유로 다시 열 때마다 '나가시겠습니까?'가 떴다.
- 📤 견적서 보내기(sendQuote) 공유 창이 끝나면 sentAt(비어 있을 때만, 편집 사본·저장본 같이 — hjQuoteMarkSentShared). 사진 공정 [모두 추가]는 시공 순서(HJ_PHASE_SEQ 철거·설비·방수·미장·타일·넥산·처마·도장·실리콘).
- 욕실 상담(bathroom.html/js): #priceEstimateNotice 를 editor-only + 추정 단가 있을 때만, #methodScopeNotice(전체 철거인데 철거·폐기물이 빠짐 — 견적서 '미포함'으로 나감) editor-only.
- 안 고친 것: 리뷰 링크 없이 ⭐ 리뷰 요청(토스트 안내만 — completion-links·warranty-review 가 지금 흐름을 지킴) · 인테리어 사진 추가 창 전/중/후 칸 · 완료보고서 공정 줄 중복.
- 핀3곳 hyeonjang-v450-rehearsal2(v449 위). 신규 tests/rehearsalfix-v450.e2e.js 10/10(다시 켜기 두 길 — legacy-appState·paid-generation), 변이 tier-persist(TIER_PERSISTS_AFTER_RELOAD)·tier-exact(TIER_PERSISTS_AFTER_EXACT_RESTORE)·기준선(REHEARSALFIX_API_PRESENT) 실패 확인. 리허설 R2·R3 다시 15/15(관찰 21→10). 관련 80여 개 통과(bathroom-quality-v410·team-workboard·document-select·document-upload 의 다운로드 파일 이름 'download' 는 v449 에서도 같은 환경 문제). 정적 19개 통과.

## 2026-10-16 v449 리허설 R1·R4·R5 고침 (스택 끝에서 합성 리허설 → 찾은 것)

- 리허설: /mnt/user-data/outputs/리허설/rehearsal-r1.js(누수 하루 12단계)·rehearsal-r4r5.js(월말 8 + 팀 4) — 390px·합성·외부 쓰기 0, HJ_REHEARSAL_APP 로 대상 주소. v436 끝에서 24/24 통과하며 찾은 문제를 고쳤고, v449 에서 다시 24/24.
- 월말 마감 2단계 잔금 줄(mcData.due): 위 주석대로 진행/완료(단계≥2·준공·받은 돈 있음) 현장만 — 상담·실측 단계 견적에 '잔금 안내' 문자가 나갈 수 있었다. **'미수금 정리' 단계 자체는 그대로**(extras-settle·revenue-basis 가 지키는 기존 기능 — 2026-08-13 결정과 맞는지는 v434 결정 때 대표에게 묻는다).
- 👷 직원 모드(v444) 구멍: 현장 고객 카드의 이름·번호·주소 입력칸(.cust-card .cust-grid)·고객 문자/페이지/전자계약/일정 안내·연락처 수정·고객 빠른 입력·일정 탭 👷 인건비(#schLabor)를 숨기고, 돈·고객 창 함수(laborLedger·expenseLedger·pnl·monthCloseView·recvQuickView·payHistoryView·hjProofView·settleDocs·hjTaxPackView·hjInsightView·hjMarginBoardView·hjCrewSettleView·hjCustQuickView·hjSeasonView)는 직원 모드면 토스트만 띄우고 false — 더보기·음성·AI 길로도 안 열린다. 통화·길찾기는 그대로. 변이 staff-cust 가 STAFF_CUSTOMER_HIDDEN 에서 잡는다.
- 💰 마진 보드(v429): 수주 전(단계<2·준공 없음·받은 돈 없음 — hjMarginWon, 📈 분석의 '수주'와 같은 기준) 견적은 매출에서 빼고 요약에 '수주 전 견적 n곳은 뺐어요'(data-margin-pending).
- 👷 인건비 장부: 달 목록에서 세금 자동 일정·💰 수금 일정을 빼고(내년 세금 일정 때문에 1년 뒤 빈 달이 열렸다) 기본은 이번 달, 다른 해는 'YY년 M월'. 작업자별 합계는 v440 사람별 공수·일당(labor.by)이 있으면 그 값(사람별 정산표와 같은 값). 일당 합계 칸 390px 안(min-width:0).
- 💬 첫 답장(v436): 이 현장에 다가오는 일정이 있으면(hjFirstReplyBooked) 새 시간을 묻지 않고 '{오늘/내일 …} 방문으로 잡아 두었습니다' + 화면 data-fr-booked. 누수 문자 '접수 확인'·'출동 안내'를 보냈음 체크했으면 답장한 것(hjInquiryReplied) — 📈 분석 첫 답장 분(hjInsightReplyMin(notes,p))에도 그 시각.
- 누수 단계 체크: 누수 현장은 STAGE_CHECK_LEAK(📋 수리 전 체크: 물 잠금·전기 차단/아랫집·관리사무소 알림/보양/원인 사진, 📋 수리 마무리 체크: 재확인/복구·청소/추가공사/잔금 청구/보증 안내/완료 문자(💬 단추)/사진 정리) — 저장 키(start/done)는 같다(hjStageCheckDef). 인테리어는 그대로.
- 누수 문자(v424): 완료 문자는 일반 일정 완료 보고가 없고 끝난 현장이면 출동 일정 완료 보고를 수리 내용으로 쓴다. 🌙 오늘 마감 '탐지 결과 문자 안 보낸 현장'에서 완료(3단계)·완료 문자 보낸 현장은 뺀다.
- 그 밖: coworkCopy 토스트는 Cowork 명령(라벨 없음 또는 {cowork:true})만 'Cowork에 붙여넣으세요', 나머지는 '복사됨 — 붙여 넣어 쓰세요' · 📎 서류 만들기 견적 수에서 앱 견적의 가상 파일 빼기 + 카드 글자색 var(--ink)(button:hover 의 흰 글자) · 증빙 묶음 기간 시작은 누수 접수일/문의일(hjEvidenceStartOf), 간이영수증 n건 줄 · 사진 찍는 법 leakRepair 카드 + '누수 수리' 지시 guideKey(인터페이스 문서에도) · 지시 메모 '고객 고객' 한 번으로 · 계절 캠페인 기본은 지금 시기(이미 보냈어도) · 증빙 묶음·세무 자료에서 [← 월말 마감] · 폰에서 창이 열려 있으면 토스트는 위(:has).
- 안 고친 것(다음): 사진 넣을 때 '☁ 대기 사진 올리는 중' 토스트 두 번(v425, 서버 없어도) — offlinequeue 검사가 #189 전에는 버전 문자열 때문에 깨져 있어 그 뒤에.
- 핀3곳 hyeonjang-v449-rehearsal(v443-fix 위). 신규 tests/rehearsalfix-v449.e2e.js 6/6, 변이 staff-cust·기준선(REHEARSALFIX_API_PRESENT) 실패 확인. 관련 29개 통과(leakdetect-v420 은 브라우저 4개 동시일 때 한 번 시간 차로 실패 — 혼자 다시 10/10, v436 끝에서도 10/10), team2-v444 는 사진 찍는 법 카드 5장으로 고침. 정적 19개 통과.

## 2026-10-16 v436 💬 첫 답장 60초 — 채널별 템플릿 · 문의함 연결

- 자동 발송 없음 — hjFirstReplyView(pj) 초안을 [📋 복사](navigator.clipboard → 실패 시 coworkCopyFallback)하거나 [💬 문자 앱](hjSendSms, 고객 번호가 있을 때만). 채널·유형 고르기·초안 보기는 읽기 전용(검사가 저장본 비교).
- HJ_FIRST_REPLY: 채널 6(당근·네이버·인스타 DM·카카오 채널·문자·소개 — 기본값은 p.leadSrc 에서 HJ_FIRST_REPLY_SRC, 모르면 문자) × 유형 2(인테리어·누수, 기본은 현장 kind). 문구 = 인사(회사·대표·채널 인사) → 가능 시간 2개 → 필요한 정보(인테리어: 공사할 곳·평수 / 누수: 사진 2장 넓게·가까이 + 아랫집 연락 여부) → 마무리(회사 번호, 인스타는 'DM 으로 답 주세요'). 200자(공백 빼고) 안.
- 가능 시간 hjFirstReplySlots(now): 오늘 시각 있는 일정(💰·세금 자동 일정 빼고, 끝 시각 없으면 hours·없으면 2시간)의 앞뒤 30분을 이동 여유로 막고, 지금부터 1시간 뒤 정시~18시의 1시간 칸 2개. 모자라면 다음 작업일(hjShiftWorkDays) 9시부터. 이름은 '오늘/내일/M/D(요일) 오전·오후 N시'.
- 인스타 규칙 hjFirstReplyTelOk(ch) — 인스타 DM 이면 번호 줄을 빼고 혹시 남은 번호 모양도 지운다(v415). 사람이 고친 글에 번호가 들어가면 data-fr-tel 경고만(막지 않음, v415 수동 원고와 같은 태도). 변이 insta-tel 이 INSTA_NO_TEL 에서 잡는다.
- 기록 hjFirstReplyRecord: 그 현장의 가장 최근 문의 노트(HJ_INQ_NOTE_RE)에 '[첫 답장] M/D HH:MM 채널' 한 줄 + replyAt(ISO, 처음 한 번만 — 두 번째부터 '[다시 답장]'이고 replyAt 그대로). 문의 노트가 없는 현장(카카오 리드 등)은 '[첫 답장] …' 노트를 새로(replyAt) — v445 첫 답장 시간 계산(hjInsightReplyMin)은 문의 노트만 보므로 거기엔 안 들어간다. hjInquiryReplied = 그 현장 노트 중 replyAt 이 있나.
- 자리: 대시보드 #dashboardInquiryPending 안(v386 줄·다음 형제 div 구조 그대로) '💬 그중 답장 안 한 곳 n곳'(data-inq-noreply) + [💬 첫 답장](data-firstreply, 인라인 onclick) · 🌙 오늘 마감 영업 칸(#dcSales — 단추 목록 그대로) 밑 #dcFirstReply '오늘 들어와서 답장 안 한 문의'(inquiryAt 오늘) · 📞 새 문의 받기 다음 창 본문 #inqFirstReply(아래 단추 3개 그대로).
- 핀3곳 hyeonjang-v436-firstreply(v435 위). 신규 tests/firstreply-v436.e2e.js 4/4, 변이 insta-tel·기준선(FIRSTREPLY_API_PRESENT) 실패 확인. 관련 9개(inqpending-v386·dcsales-v391·instanotel-v415·inquiry-v383·insight-v445·estfollow-v395·darkfix-v399·leadsrc-v379·expenseocr-v435)·정적 19개 통과.

## 2026-10-16 v435 🧾 영수증 → 경비(기기 안 글자 읽기) · 월별 세무사 전달 자료

- 넣는 곳: 사진 탭 도구 #btnReceiptAdd(빈 사진 탭 #btnReceiptAddEmpty) · 💳 간편 장부 #expReceipt · 월말 마감 3단계 · 더보기 [🧾 영수증 스캔](cardReceiptScan('receipt') 가 hjReceiptAdd 로 감 — 옛 Gemini 영수증 길은 안 탄다, 명함 스캔은 그대로). 폰은 바로 카메라/갤러리, PC 는 끌어놓기 칸(#rcDrop)+고르기. 여러 장이면 한 장씩.
- 글자 읽기 hjReceiptOcrText = 기기 안 Tesseract(getWorker, kor+eng)만 — Vision·Gemini 키가 있어도 영수증 사진을 바깥으로 보내지 않는다(HEIC 는 heic2any 로 JPG 바꿔 읽음). [✍ 직접 입력]으로 기다리지 않고 넘어갈 수 있다. 풀이 hjReceiptParse(날짜 여러 형식·400일 안, 합계/결제금액 줄 우선·없으면 전화·사업자 줄 뺀 가장 큰 금액, 상호/가맹점 줄·없으면 첫 이름 줄, 카드/현금, 분류 HJ_EXP_CAT_DICT — 상호 먼저·글자는 가장 많이 걸린 분류). 실제 Tesseract(5.1, kor+eng)로 합성 영수증 3장을 읽혀 날짜·금액·상호·분류가 다 맞는 것을 확인했다(검사는 스텁).
- 확인 화면 hjReceiptConfirmView(큰 입력칸 52px): 날짜·금액·상호·결제·분류 7종(HJ_EXP_CAT7 자재/공구/유류/식대/주차·통행/외주/기타)·현장(공통=없음)·[이 현장 원가에 넣기](기본 켬)·메모. 같은 날짜·금액(상호가 둘 다 있으면 상호까지 — hjReceiptDups, 카드 월 합계 제외) 지출이 있으면 data-rc-dup 경고 + 단추 '⚠️ 그래도 저장'(변이 dup-off 가 RECEIPT_DUP_WARNS 에서 잡는다).
- 저장 hjReceiptSave = durableLocalMutation 한 번: 원본은 서류 길 그대로 IDB 'document_blob:<uuid>'(beforeCommit 에서 보관·확인), 파일 레코드 kind 'receipt'·documentMeta role 'receipt'(DOCUMENT_ROLES·KIND·documentRoleKind·documentMovable·서류 탭 목록에 receipt 추가)·이름 '영수증_YYYYMMDD_상호_금액원.ext'·text=읽은 글자, 지출 {src:'receipt', fileId:'k:'+fileKey, cat, category=HJ_EXP_CAT_LEDGER(공구→장비, 주차·통행→기타), ocr{raw≤800,guess}}. 새 최상위 키 없음.
- 원가 반영 = 지출을 그 현장에 단다(projStats 유효원가가 수기 0 이면 장부 합으로 읽음: 자재→material·외주→outsource·그 밖→기타 경비). 끄면 영수증 파일만 현장에 두고 지출 project 는 ''. 수기 p.cost 는 건드리지 않는다 — 수기 자재비가 있으면 화면에 '이중 계산 방지' 안내. v439 입고 원가 반영 창의 중복 경고는 영수증 지출(같은 날짜·금액)을 본다.
- 📤 세무사 전달 자료 hjTaxPackView(월 ‹ ›, 💳 장부 #expTaxPack · 세금 캘린더 #txPack · 월말 마감 3단계): xlsx 시트 3개 — 매출(그 달 수금·세금계산서/현금영수증 발행 상태·간이영수증 번호·이 달 준공 현장) / 지출(분류·장부 분류·상호·금액·결제·현장·영수증 파일 이름 또는 '없음'·출처) / 요약 + 영수증 사진(getFileOf, 없으면 썸네일, 그래도 없으면 00_읽어주세요.txt 에 빠진 이름) → '만물_세무자료_YYYY-MM.zip'(다운로드 또는 hjEvidenceDrive). **지시서의 ③ 미수 시트는 넣지 않았다**(2026-08-13 대표 결정·receivable-removed 검사) — 대신 요약 시트. 만든 뒤 hjTaxPackRecord: 노트 '[세무 자료] YYYY-MM 만듦'(taxPack{ym,at,exp,photos,via,again}) + 그 반기 부가세 일정(1~6월→tax_YYYY-07-25_vat1, 7~12월→tax_(Y+1)-01-25_vat2)의 taxPacks[ym] — 세금 캘린더 줄에 '✅ 세무 자료 n월 만듦'(hjTaxPackDoneHtml). 같은 달 두 번째는 '(다시 만듦)'.
- 장부 줄에 상호·[🧾](data-rc-view → hjReceiptPreview, 기기 원본 보기 · ← 장부). v427 증빙 묶음 03_영수증 이 이 영수증을 담는다.
- 핀3곳 hyeonjang-v435-expenseocr(v444 위). 신규 tests/expenseocr-v435.e2e.js 4/4(합성 영수증 PNG·글자 읽기/zip/xlsx 스텁), 변이 dup-off·기준선(EXPENSEOCR_API_PRESENT) 실패 확인. 관련 14개(document-select·document-upload·evidence-v427·extras-settle·mobile-friendly-ui·mobile-more-tools·mobile-photo-upload·photo-first-screen·revenue-basis·material-v439·ledger-cost-apply·amount-sign·margin-v429·team2-v444)·정적 19개 — document-select/document-upload 의 '다운로드 파일 이름' 한 칸은 main(3c7db67)에서도 똑같이 실패하는 이 컨테이너 환경 문제(통과 수 20·12 로 main 과 같음).

## 2026-10-16 v444 👷 팀 앱 연동 2 — 내일 일정 한 번에 지시 · 공종별 체크리스트 · 사진 찍는 법 · 직원 모드

- 서버 없이 되는 부분만(서버 API·직원 로그인·푸시는 팀 앱 서버 설계 뒤). 팀 앱 코드는 안 건드림 — work-order.json(v432 hjWoBuild/hjWoValidate) 그대로에 **선택 필드 guideKey 하나**(HJ_PHOTO_GUIDE 의 leakDetect/tile/wallpaper/finish, 없으면 통과·모르는 값이면 orders[i].guideKey 오류)를 더했고 지시서/팀앱_연동_인터페이스.md 에도 한 줄 적었다. v432 단건 보내기도 guideKey 를 싣는다.
- [📤 내일 일정 팀에 보내기](일정 탭 #schTeamTomorrow → hjWoTomorrowView(day)): 그날 현장 일정(💰 수금·세금 자동 일정 제외)마다 지시 1개, 시간순 번호 wo_YYYYMMDD_nnn(hjWoNextId 다음부터), **이미 보낸 일정은 같은 번호로 다시 보냄**(items kind 'sched' ref 로 찾음 — 팀 앱에 같은 지시가 두 번 생기지 않게, 화면 data-wo-day-resend). 체크리스트는 공종 틀 HJ_WO_CHECKLIST_BY(철거·타일·도배·설비·누수 탐지·누수 수리 — hjWoTradeOf 가 일정 제목·메모·현장 이름으로 고름), 제목·메모는 hjRetScrub(고객 이름→'고객', 번호·메일·동호수 지움) + 돈 이야기 줄 통째로 뺌(hjWoMemoSafe). 그래도 hjWoPrivacyIssues 에 걸리면 ⛔ 표시하고 저장·복사·공유 모두 막는다. 기록은 hjWoRecordMany — 현장마다 p.workOrders(v432 와 같은 꼴 + guideKey) + '[팀 지시]' 노트, durableLocalMutation 한 번(스냅샷 '팀 지시(하루치) 기록 전' 1개).
- 📷 사진 찍는 법 hjPhotoGuideView(사진 탭 도구 #btnPhotoGuide · 빈 사진 탭 #btnPhotoGuideEmpty): 공정 4종 카드(data-guide) + 공통 4줄(data-guide-tips) + [🖨 A4 한 장](hjDocShell → hjDocDeliverView). 읽기 전용.
- 👷 직원 모드(설정 기타 #hjStaffOpen → hjStaffView, PIN 4자리 — localStorage hj_role='staff', hj_staff_pin=SHA-256(기기 소금 hj_staff_salt|PIN)): **기기 화면 제한이지 보안 권한이 아니다**(도움말 data-staff-help 에 그대로). 화면 글자만 가린다 — 텍스트 노드의 '…원' → (금액 숨김), 전화번호 → (번호 숨김), 숫자와 단위가 다른 조각(150<small>만원</small>)도 가림, 입력칸·글상자 값은 안 건드림(가린 글자가 저장되면 안 됨), MutationObserver 로 새로 그린 화면·모달도. 통화 단추(tel: 링크)는 그대로. CSS(#hjStaffCss)로 견적·정산·회계 탭, 삭제·대량 변경·복원·돈 화면 단추(data 속성 목록 + .kpis/.ratewrap/.amt), 글자로 고른 삭제·정리·되돌리기 단추(hjStaffHideNode → data-staff-hide)를 숨긴다. render 감싸기로 막힌 탭은 대시보드로(토스트), openGdriveSetup 감싸기로 설정 대신 직원 모드 창. 위쪽 띠 #hjStaffBar(z 65 — 머리줄 위·모달 아래, 모바일 머리줄 top 44px)·[끄기]는 PIN 맞아야.
- 직원 모드에서 생긴 기록: workPunch 작업시간·saveReport 작업 보고에 by:'staff'(레코드 안 — 통째 직렬화), 사진은 ingestFile 감싸기(원래 promise 그대로 돌려줌 — async 로 감싸면 사진 추가 흐름 타이밍이 바뀐다)로 모아 2초 묶음마다 '[직원 사진] 현장 n장' 노트(by:'staff', 사진 참조 hjFileRef, 앱 목록에 남은 사진만). 파일 직렬화 칸은 안 늘렸다. 대표 첫 화면 '👷 직원이 남긴 기록 n건'(data-staff-records, 직원 모드에서는 안 보임) → [확인] hjStaffReviewView → [✅ 모두 확인함](노트 done · workLog.seenAt · report.seenAt).
- 핀3곳 hyeonjang-v444-team2(v448 위). 신규 tests/team2-v444.e2e.js 5/5(① 하루치 지시·개인정보 막힘·원자 저장·같은 번호 다시 보냄 ② 작업 보고 가져오기 v432 길 ③ 직원 모드 ④ 사진 찍는 법·guideKey ⑤ 계약), 변이 mask-off(금액 가림 끔)는 STAFF_MONEY_MASKED·기준선은 TEAM2_API_PRESENT 에서 실패 확인. 관련 12개(teampacket-v432·photo-first-screen·mobile-photo-upload·settings-tabs·settings-safety·key-persist·dash-cards·dash-reports·reportfill-v408·mobile-more-tools·handoff-v374·mobilealert-v443)·정적 19개 통과. teampacket-v432 는 사진 결과창이 늦게 뜨는 경합(v448 판에서도 3번 중 1번 실패)이 있어 결과창(#photoIntakeResult)·__photoIntakeBusy 를 기다린 뒤 닫도록 검사만 고쳤다.

## 2026-10-16 v448 🌦 계절 캠페인 — 장마 전 방수 점검 · 겨울 동파 · 환절기 결로 · 명절·새학기 전 도배 (대상 추출 + 원고)

- 자동 발송 없음 — 명단(번호 줄바꿈)·문자 원고·인스타/당근 글을 복사해 대표가 문자 앱에서 보낸다. 기록은 연락처 안 c.mkt{consent,optOutAt,lastSentAt,sent[{c,at}]≤12}와 기존 state.adPosts(ch:'sms-season', campaign, count) 뿐 — 새 최상위 키 없음. 추출·원고는 읽기 전용(검사가 저장본 비교).
- 광고 문자 규칙 HJ_AD_SMS_RULE(화면에 그대로): (광고) 머리 · 끝 "수신거부: 이 번호로 '거부' 회신" · 밤 9시~아침 8시 경고(hjSeasonNight — 복사할 때도 토스트) · 받는 사람은 ① 동의(c.mkt.consent) ② 거래 중 또는 거래 끝난 지 183일 안(hjSeasonRecentDeal — 그 번호의 모든 현장의 준공일·입금일, 진행 중이면 거래 중; 변이 six-month 가 SEASON_SIX_MONTH_RULE 에서 잡는다). 그 밖은 '동의 필요'로 회색·선택 불가, 수신거부 영구 제외, 90일 안 발송 제외, 한 번호 한 줄, 번호 없는 현장은 개수만.
- 캠페인 4종 HJ_SEASON_CAMPAIGNS(시기 창·규칙·문자·SNS 문구) + 규칙 HJ_SEASON_RULES(leak13 누수 1~3년 전 · waterproof 방수/욕실/베란다/외벽 준공 · leakcomplex v445 반복 누수 단지의 관리사무소(state.aptOffices 번호) · outdoorpipe 보일러·동파·계량기·외부/베란다 수전 · leakpipe 누수 배관 원인 · condense 도배·단열·환풍기·결로·곰팡이(노트 포함) · old2y 준공 2년+ 인테리어 · partial 부분·실리콘·보수). 판정 텍스트는 현장 이름·공정·앱 견적 품목. 이름은 성+○○ 님, 관리사무소는 '단지 관리사무소'.
- 화면 hjSeasonView(📣 광고 탭 [🌦 계절 캠페인] data-season · 첫 화면 시기 줄 hjSeasonDueHtml data-season-open — 시기 창 안이고 60일 안 발송 없을 때): 규칙 안내·밤 경고·캠페인 고르기·명단(체크, 기본은 보낼 수 있는 사람 전부)·건당 단가(localStorage hj_sms_unit_cost)·예상 비용·원고(글자 수, 70자 넘으면 장문)·복사 3종·[✅ 보냈음](확인 → lastSentAt·sent·adPosts 1건)·행마다 [🚫 거부]. 원고 복사는 hjSeasonIssue 통과해야 — 과장 표현(HJ_AD_BANNED)·(광고)/수신거부 지움·SNS 전화번호면 막는다.
- 내 캠페인: [✏ 이 틀로 내 캠페인] → 이 기기 localStorage hj_season_custom(제목·기간·규칙·문구만, 과장 표현·개인정보 검사). 연락처 카드 [📣](data-conmkt → hjMktView): 동의 받음(오늘 — 수신거부 지움)·수신거부 처리, 카드에 상태 줄. 연락처가 없던 현장 고객·관리사무소는 보냈음/거부/동의 때 최소 연락처(이름·번호·꼬리표)를 만든다.
- 동의 문의 한 줄(기본 꺼짐): 간이영수증 입력 #prcMktAsk → 문서 끝 □ 줄(HJ_MKT_ASK_LINE), 문자 센터 '준공 인사' #mcMktAsk → 본문 끝 질문(HJ_MKT_ASK_SMS) 넣고 빼기만. 고객이 동의하면 대표가 연락처 📣 에서 기록.
- 성과 hjSeasonPerf(읽기): 보낸 날(adPosts) 뒤 30일 안에 그 캠페인을 받은 번호(c.mkt.sent)의 문의·수주 → v445 분석 화면 '🌦 계절 캠페인 성과' 표(엑셀 시트는 3개 그대로).
- 핀3곳 hyeonjang-v448-season(v437 위). 신규 tests/season-v448.e2e.js 4/4(합성 30명·관리사무소 1, 캠페인별 기대 명단은 검사 쪽 손 계산), 변이 six-month·기준선 실패 확인, 관련 14개(instanotel-v415/leadsrc-v379/pay-receipt/insight-v445/contactimport-v397/contactpick-v393/dash-cards/marketing-draft/marketing-safety/inqpending-v386/doccenter-v433/publicweb-v446/proposal-v437/mobile-more-tools)·정적 통과. instanotel-v415 의 CHANNEL_TOUCH_HEIGHT_44 는 모달 열림 애니메이션 중 boundingBox 를 재서 가끔 실패한다(v437 판에서도 3번 중 1번) — 이번 변경과 무관.

## 2026-10-16 v437 📊 견적 비교표 · 견적 비교 제안서 · 고객 폰으로 보내기

- 안 이름 q.tier('basic'|'standard'|'premium', 없으면 칸 없음) — 견적 편집기 [안 (비교표)] 칸(#qmTier), 견적 목록 카드에 '기본안' 배지(data-qtier). 새 최상위 키 없음.
- hjQuoteCompare(quotes): 품목 이름(공백 정리) 합집합 × 안 열, 칸 = 수량×단가(공급가, quoteCalc 계약)·같은 이름 합산·규격 표시, 차이(값 다름 또는 한쪽만) data-qc-diff(변이 no-diff 가 QC_DIFF_MARKED 에서 잡는다). 합계는 공급가·부가세 10%·부가세 포함 + '견적서 표기'(원래 포함/별도) — 표기가 섞이면 data-qc-mixed 안내.
- hjQuoteCompareView(현장[,ids]): 폰(<560px)은 안마다 카드 세로(data-qc-card), 넓으면 표(가로 스크롤 상자). 2~3개 고르기(3개 넘으면 거절), 기본 선택은 안 이름 붙은 견적 먼저. 진입: 📎 서류 만들기의 '견적 비교표 · 제안서'(예정 줄 todo:compare → 실제 compare — doccenter-v433 예정 줄 단언 ≥4→≥3·클릭 대상 todo:prep 으로 고침) · 견적서 탭 목록 [📊 비교표](#qmCompare, 활성 현장 또는 견적 2개+ 현장 고르기).
- [✅ 이 안으로 확정](hjQuoteTierConfirm): 비교한 안 중 고르지 않은 앱 견적의 가상 견적 파일(quote_<id>)에 exSum — 매출 Σ 에서만 빠지고(견적·정산 Σ 로 되돌림) 견적은 그대로 + 노트 '[견적 안 확정]'. 안 여러 개가 현장 매출에 다 더해져 마진·대시보드가 부풀던 문제를 막는다. 견적 저장 토스트에 '이 현장 견적 n개가 매출에 모두 더해집니다' 안내(hjQuoteTierNote).
- 제안서(hjProposalModel/Html → 기존 hjDocDeliverView): 제목·받는 분·현장 → 고객 요청(문의 노트 본문, hjRetScrub 로 이름·번호·메일·동호수 지움) → 비교표 → 사례 사진 4장(hjProposalCasePhotos: 다른 현장 사례 묶음 중 hjCaseBlock 통과 — 동의·개인정보·과장 표현 — 같은 공종(hjInsightTrade) 먼저·최근 순, 현장마다 전·후 1장씩, 공정 이름에 개인정보·과장 있으면 그 사진 제외, 설명은 동+공정만; 변이 case-filter 가 PROPOSAL_CASE_FILTER 에서 잡는다) → 공사 기간(contractPeriodProposal)·하자 보수(기본 보증 목록)·결제(HJ_PAY_RATIO) → 연락처. [이름 가리기]면 '고객님'·동 단위 제목·현장.
- 발행 기록 p.proposals[{id,at,quoteIds,pdfName,via}] + 노트 '[제안서] 견적 비교 n안 · 파일명' — 실제로 가져간 때(PDF·워드·HTML·이미지) 만들기 한 번에 한 줄(durableLocalMutation, 같은 id 는 dup). 검사 씨앗 사진은 _driveId 를 줘야 원자 저장 뒤에도 썸네일이 남는다(실제 사진은 핸들·드라이브 id 가 있다).
- 고객 폰: 서버 저장 없이 되는 범위 — 보증서와 같은 파일 공유(🔗 공유 · HTML 파일 = hjWarrantyShareHtml, Web Share 파일 → 카톡·문자 첨부)와 💬 문자 초안(HJ_PROPOSAL_SMS, msgCenterCompose 'doc433' — 자동 발송 없음). 열람 링크·읽음 확인은 서버가 필요해 다음 단계(지시서대로). v413 욕실 3안은 main 에 없어 연결하지 않았다.
- 핀3곳 hyeonjang-v437-proposal(v445 위). 신규 tests/proposal-v437.e2e.js 4/4, 변이 no-diff·case-filter·기준선 실패 확인, 관련 13개(quotewon-v390/caseweb-v385/warranty-link/doccenter-v433/quote-edit-safety/quote-flow/quote-vat/estimate-dedupe/consultquote-v384/stalequote-v392/leakquote-v421/mobile-more-tools)·정적 통과.

## 2026-10-16 v445 📈 분석 — 채널별 문의→수주 전환 · 공종×동 마진·수요 · 누수 반복 단지

- 진입: 💼 회계 탭 툴바 [📈 분석](data-insight 위임) · 📣 광고 탭 📞 문의 경로 상자 [📈 채널별 전환]. hjInsightView/hjInsightData — 읽기 전용(기간·공종 선택은 메모리 __hjInsight, 저장 자료 그대로 — 검사가 저장본 비교).
- 문의 1건 = 현장 1곳. 문의 날짜 hjInsightInqDate: p.inquiryAt → [문의 접수] 노트 → [홈페이지 상담 리드] 노트 날짜 → 가장 이른 활동(일정·앱 견적·견적 파일·입금·준공). 날짜 없는 현장은 기간 밖(개수만 표시). 보관 현장도 센다(지난 실적).
- 채널 hjInsightChannel: p.leadSrc → p.kakaoLead → '[문의 접수] 날짜 · 경로' 노트 글(HJ_LEAD_SRC 라벨) → 홈페이지 리드 → 모름. '기타'(직접 고른 etc)와 '모름'은 한 줄 '기타·모름', 그 비율 줄(hjInsightUnknownHtml, data-insight-unknown)은 늘 보인다 — 20% 이상이면 주황 + 문의 경로 채우기 안내(변이 hide-unknown 이 INSIGHT_UNKNOWN_SHOWN 에서 잡는다).
- 단계는 누적: 상담(일정 — 💰·세금 자동·AS 방문 제외 — 또는 실측 이상·견적·수주) ⊇ 견적(앱 견적·견적 파일·수주) ⊇ 수주(시공 이상·준공·입금). 매출 = 수주 현장의 v429 hjProjectMargin 공급가, 건당 매출은 매출 있는 수주만. 첫 답장 중앙값 = 문의 노트의 replyAt(v436 이 남길 칸) − 노트 시각(at, 없으면 ko-KR 날짜 글 hjKoDateTime), 기록 없으면 '—'.
- 공종 hjInsightTrade: 누수 현장은 탐지 원인 묶음(누수·배관/방수/외벽/기타), 인테리어는 현장 이름·공정·앱 견적 품목 낱말(HJ_INSIGHT_TRADES 순서 첫 일치, 없으면 '인테리어 기타'). 동 hjDongOf(HJ_DONG_RE): 주소 → 현장 이름의 '한글1~5자(+숫자1)동' 낱말, 숫자 동(101동)·단지 낱말·출동/이동 같은 일반 낱말(HJ_DONG_STOP) 제외. 공종×동 표: 문의·수주·수주율·평균 공사비·평균 마진율(원가 있는 수주만, Σ마진/Σ매출)·재문의율(경로 '다시 맡긴 고객' 또는 같은 고객 번호의 더 이른 문의). 규칙 요약: 마진율 상위 3 / 그 나머지 하위 3 / 문의 2+ 이고 수주율이 전체보다 낮은 동 3.
- 누수 반복 hjInsightLeak(전체 기간): 단지명은 hjAptUnitOf 결과 중 단지 낱말(HJ_APT_COMPLEX_RE)이 든 한 낱말만(현장 이름 앞의 사람 이름이 나오지 않게), 없으면 동 단위. 2건 이상만, 원인 4묶음·같은 세대 재발 수·마지막(접수일)·[🗺](네이버 지도 검색 링크 열기만)·원인 2번 이상이면 "관리사무소에 협력 제안" → 기존 📇 사업자·명함 보내기('관리사무소 업체 등록' 문구).
- 내보내기: 엑셀 시트 3(채널 전환·공종·동·누수 반복 단지, 기존 ensureXLSX) · 이미지(hjDocShell 문서 → 기존 hjDocHtmlToPng). 화면·엑셀·이미지 모두 고객 이름·전화·호수·현장 이름 없음(검사가 세 군데를 다 훑는다). 표는 가로 스크롤 상자 안에서만 넘친다.
- 핀3곳 hyeonjang-v445-insight(v446 위 — 번호는 지시서 번호, 배포 순서는 패치 순서). 신규 tests/insight-v445.e2e.js 4/4(합성 40곳: 채널 5·공종 2·동 6·반복 단지 2, 기대값은 검사 쪽 계산), 변이 hide-unknown·기준선 실패 확인, 관련 10개(margin-v429/inqpending-v386/leakdetect-v420/leadsrc-v379/leakwarranty-v423/ledger-cost-apply/ledger-roundtrip/margin/mobile-more-tools/publicweb-v446)·정적 통과.

## 2026-10-16 v446 공개 웹 — 리뷰 QR(앱 안 인코더) · ⭐ 리뷰 QR 카드 · 보고서·영수증 끝 QR · 사례 ZIP case.json

- QR 인코더(hjQrMatrix/hjQrDraw/hjQrPngDataUrl/hjQrSvg): 외부 라이브러리 없음, 바이트 모드(UTF-8)·오류정정 M·버전 1~10(213바이트까지, 넘으면 null). 공개 참조 구현(Nayuki QR Code generator)과 표·배치·벌점(N1~N4)이 같아 같은 그림이 나온다 — 2026-10-16 버전 1~10×마스크 8×한글 275가지를 한 칸씩 대조, zxing 으로 전부 읽힘(OpenCV 고전 검출기는 일부 마스크에서 위치를 못 찾지만 Aruco 검출기·zxing 은 다 읽는다 — 인코딩 문제 아님). 문서에는 PNG(<img data-qr>, 칸 8px) — 워드(.doc)가 SVG 를 못 그려서다.
- 리뷰 링크: 설정 ⭐ 기타의 기존 __reviewUrl(이 기기 IndexedDB review_url)만 쓴다. hjReviewLink 는 http(s) 로 시작하는 것만(앞이 빠진 'naver.me/…' 는 폰 카메라가 글자로만 읽는다). 비었거나 아니거나 너무 길면 카드 대신 "설정에서 리뷰 링크를 넣으세요" + [⚙️ 설정 열기](hjOpenSettingsTab('etc','rvUrl') — openModal 의 setTimeout 포커스 뒤에 칸으로).
- ⭐ 리뷰 QR 카드(hjReviewQrCardView/hjReviewQrCardHtml): A6(105×148mm) 두 장이 한 쪽(@page 210×148mm, 가운데 점선), 회사명·"시공 만족하셨다면 리뷰 한 줄 부탁드립니다"·QR·대표 번호. 기존 hjDocDeliverView(PDF·워드·HTML·이미지). 진입: 설정 리뷰 링크 옆 [⭐ 리뷰 QR 카드](칸에 적고 저장 안 했으면 먼저 저장), 📎 서류 만들기 AS·보증 그룹 reviewqr. 저장 자료 변화 없음.
- 끝 QR 토글(hjQrToggleHtml/Read, localStorage hj_qr_on {report,rcpt}, 기본 켬, 링크 없으면 칸 자체가 없다): 완료보고서(aptReportView #rpQr → buildAptReportPDF 마지막 장 확인란 아래 왼쪽 330px, window.__rptQr 에 자리 기록 — 검사가 그 JPEG 을 다시 읽는다)·간이영수증(payRcptDialog #prcQr → payRcptHTML o.qr, 맨 끝 상자 data-review-qr). 보고서는 관리사무소에도 가니 대표가 끄면 그 기기에서 계속 꺼진다.
- 사례 ZIP: 재료 글 줄 이름을 manmool scripts/new-case-post.mjs parseMaterial 정규식 그대로(HJ_CASE_SITE_LABEL '2. 증상'·'3. 탐지 방법'·'4. 원인+전유/공용')로 — 예전 화면 이름 줄 3개를 그쪽이 못 읽어 초안이 '필수 항목 누락'으로 멈췄다(case-pack.e2e 의 옛 단언도 고침). ZIP 에 case.json(format 'manmool-case/1': title·area(동 단위, 장소 낱말 → 없으면 고객 주소의 동·읍·면)·kind 누수|인테리어·tags·summary 6·photos[{file,phase before|mid|after,caption}]·date(준공일)·consent·app). 사진 설명은 공정 이름 — 동·호수·과장 표현이 섞이거나 분류명뿐이면 '시공 전·작업 중·완료'(재료 글 사진 줄도 같은 hjCaseCaption). 긴 변은 기존 1800 그대로(사이트 assets/cases 규격 — 지시서의 1600 대신).
- 과장 표현 HJ_AD_BANNED(최저가·무조건·100%·평생 보증·업계 1위·지어낸 만족 후기 — manmool 사례 검사 정규식과 같은 축): 6항목에 있으면 ZIP·재료 복사를 막고(hjCaseBlock) 칸 아래 경고.
- 홈페이지 쪽은 별도 패치(manmool 저장소): scripts/import-case-zip.mjs + Import-CaseZip.ps1 — ZIP 을 풀어 case.json 을 검사(동의·개인정보·과장·JPEG/EXIF)하고 .private/case-drafts 에 비공개 초안+사진을 만든다. 게시(site.json·posts·assets/cases)는 지금처럼 사람이 확인한 뒤. 지시서 F1 의 cases/ 갤러리·F2 랜딩 통합은 사이트에 이미 사례 체계(blog·case-finder·leak.html·검사 다수)가 있어 겹치므로 미룸.
- 핀3곳 hyeonjang-v446-publicweb(v443 위). 신규 tests/publicweb-v446.e2e.js 5/5(참조 구현 지문 6·검사 쪽 디코더 왕복 — 형식 BCH·RS 신드롬·바이트 모드), 변이 qr-format·case-labels·기준선 실패 확인, 관련 16개(case-pack/marketing-safety/photo-refs/mobile-more-tools/pay-receipt/reportfill-v408/doccenter-v433/contract-terms/settings-tabs/warranty-review/mobile-modal-tap/key-persist/settings-safety/evidence-v427/aptdocs-v441/retention-v447)·정적 통과. offlinequeue-v425 e2e·cache unit 은 main 에 캐시 이름 'hyeonjang-v425-offlinequeue' 가 박혀 있어 핀을 올린 모든 판에서 실패한다 — PR #189(v428)이 현재 빌드를 읽게 고쳤고, 그 판으로 이 브랜치에서 13/13·8/8 통과. **#189 를 먼저 병합할 것.**

## 2026-10-16 v443 모바일 — 일정·출동 N분 전 알림 · 폰 캘린더 알람 · 음성 메모

- 알림 ①(앱이 떠 있을 때): hjAlertDue(now) — 오늘 시각 있는 일정 중 N분(hj_alert_cfg min 10/30/60, 기본 30) 안, 출동만 옵션(s.urgent). 1분 타이머(hjAlertRun)가 hjAlertTick → 상단 빨간 띠(#hjAlertBar, [열기]로 그 현장) + 진동 + 권한 허용 시 알림(서비스워커 showNotification → 안 되면 new Notification). 한 번 울린 일정은 이 기기 localStorage hj_alerted('id|날짜 시각', 최근 200개)로 다시 안 울린다 — 지시서의 s.alerted(일정 레코드) 대신 기기 기록으로 바꿨다(알림은 기기마다 따로, 저장 자료·클라우드 저장을 매번 건드리지 않게; 변이 alert-dup 이 ALERT_ONCE 에서 잡는다). 시각을 바꾸면 다시 울린다. 자동화 브라우저(navigator.webdriver)에서는 1분 타이머를 켜지 않는다 — 검사는 hjAlertTick(시각)을 직접 부른다.
- 알림 ②(확실한 알림): buildICS(items,{alarmMin}) 에 VALARM(TRIGGER:-PTNM, 시각 있는 일정만)·LOCATION(s.location). 옵션 없이 부르는 기존 내보내기는 그대로(알람 없음). hjAlertIcsItems(날짜): 제목 "[현장] 일정 — 주소", 설명 "준비물: …"(hjPrepFor) + 메모에서 고객 이름·전화 지움. 첫 화면 [📅 오늘 일정 n건 폰 캘린더에 넣기](data-ics-today 위임), 일정 카드 개별 .ics(exportScheduleICS)도 알람·같은 제목.
- 설정: ⚙️ 설정 › ⭐ 기타 [🔔 일정·출동 알림] — 켜기, 분, 소리·진동, 출동만, 권한 버튼(누를 때만 Notification.requestPermission), 첫 사용 도움말 1장("앱이 꺼져 있으면 폰 캘린더 알림이 확실합니다", hj_alert_help_seen).
- 음성: hjMicAttach(root, 칸) — 일일 작업 보고(#rDone)·내 업무 완료 보고(#mwDoneText)·누수 탐지 메모(#hjLeakNote) 옆 [🎤 누르고 말하기](pointerdown~up 동안 SpeechRecognition ko-KR, 글은 칸에만 — 저장은 원래 저장 버튼). 미지원이면 [🎙 녹음] → MediaRecorder 최대 60초·2MB → 기존 파일(기타, '음성_YYYYMMDD_HHMM.webm', 그 현장)로 넣고 칸에 [음성 MM/DD HH:MM]. 지시서의 kind 'voice' 대신 기타(서류 목록에 보이게). 탐지 메모 [🧩 말한 내용으로 칸 채우기]: hjVoiceFields 가 "방법/원인/위치" 다음 칸 이름까지를 값으로 나눠 방법 버튼·원인·위치를 제안(압력은 급수/온수/난방 말한 것만, 안 하면 급수).
- sw.js SHELL_PATHS 그대로(테스트가 main 과 비교). 핀3곳 hyeonjang-v443-mobilealert(v441 위). 신규 tests/mobilealert-v443.e2e.js 5/5, 변이·기준선 실패 확인, 관련 12개(ics-save/leakdetect-v420/crew-v357/dash-cards/reportfill-v408/leakintake-v419/my-work/mobile-operations/dayclose-v359/handoff-v374/delay-v347/asclose-v366)·sw-cache·정적 21개 통과. 실기기(갤럭시) 알림 1건·받아쓰기 1건 손검사는 아직 — 대표님 폰 또는 에뮬레이터 확인 필요.

## 2026-10-16 v441 아파트 서류 4종 (공사 신청서 · 입주민 안내문 · 현관 게시문 · 이웃 동의서)

- hjAptUnitOf: 단지·동·호수는 현장 이름(aptNameParse) → 고객 주소의 "○동 ○호"(단지는 그 앞 낱말 중 아파트·파크·자이 … 가 든 것) 순, 못 찾으면 빈칸. 관리사무소는 state.aptOffices(aptComplexKey 같음), 공사 기간은 그 현장 일정(hjSchSpan 여러 날 포함) 처음~끝, 소음 작업일은 일정 제목·메모의 철거·타공·코어·할석 …, 공종은 최근 견적 품목 위 5개. 화면(hjAptDocsView)에서 모두 고칠 수 있다. 작업 시간 기본 09:00~18:00, 소음 작업 10:00~17:00.
- 4종 HTML(hjAptApplyHtml/NoticeHtml/PostHtml/ConsentHtml, hjDocShell)은 고객 이름·전화를 싣지 않고 연락처는 회사 번호. 동의서는 세대·서명·날짜 6칸 모두 빈칸(이름 자필), 게시문은 1쪽에 2개. 발행 기록은 v433 자리 p.docs(type aptapply/aptnotice/aptpost/aptconsent, AA/AN/AP/AC-날짜-순번) — 문서 하나는 실제로 가져갈 때, [📦 4종 ZIP]은 ZIP을 만든 뒤 4건을 원자 저장(durableLocalMutation) + 노트 "[아파트 서류] MM/DD 4종 발행". 같은 날 같은 종류는 두 번 남기지 않는다. ZIP 에는 보관한 관리사무소 양식도 들어간다.
- 관리사무소 자체 양식은 [📎 관리사무소 양식 넣기] → 기존 파일(기타, 그 현장)로 넣고 현장 안 p.aptForm{fileRef,name,at} 로만 가리킨다(p.docs 에 섞지 않음, 자동 채움 없음). [💬 관리사무소 문자]는 등록된 관리사무소 번호로 초안만.
- 첫 화면 "오늘 현장 업무"에 아파트 현장(동·호수 앎) 시공 시작 오늘~3일 뒤 + 신청서 미발행이면 "🏢 관리사무소 서류 4종 만들기 — 현장 (시공 D-n)"(data-aptdocs-open 위임). 🏢 아파트 관리 단지 카드 현장 줄에 [📄 서류 4종]. 📎 서류 만들기의 예정 줄(todo:apt)을 실제 항목 aptdocs 로 바꿨다(doccenter-v433 예정 줄 단언 5→4).
- 데모(loadDemo)에 '은행동 한빛아파트 101동 702호'(시공 D-2·D-3 일정) 추가 — settings-safety 의 데모 현장 수 단언 3→4.
- 핀3곳 hyeonjang-v441-aptdocs(v438 위). 신규 tests/aptdocs-v441.e2e.js 3/3, 변이 no-unit·기준선 실패 확인, 관련 10개(doccenter-v433/apartment-manage/apartment-units/action-search/amount-sign/mobile-tap-table/settings-safety/trip-expense-overlap/evidence-v427/insurance-v442)·정적 21개 통과. apartment-projects 는 이 컨테이너에서만 실패하는 환경 문제(PC·CI 확인).

## 2026-10-16 v438 보증 만료 전 안부 · AS 무상/유상 판정 도움

- 보증 만료 안부(hjWarrantyCareRows): 현장 보증 항목(hjWarranty items — 기본 방수 3년·설비 2년·마감·전기 1년, 사용자 보증은 저장된 expiresAt)마다 오늘 이후 가장 이른 만료가 60일 안이면 대상, 30일 안이면 30 단계. 첫 화면 "오늘 현장 업무"(dashboardTodoHTML)에 "🛡 보증 만료 앞둔 현장 n곳"(data-wcare, [안부 문자] data-wcare-open 클릭 위임). 문자는 초안만(msgCenterCompose kind warrantycare) — "준공 후 N년이 되어 갑니다 … 보증이 MM/DD까지예요 … 점검 방문 가능 시간 ① ② "(이틀 뒤부터 평일 둘, 오전 10시·오후 2시). [✅ 보냈음] → 현장 노트 [보증 안부] + 현장 안 p.warrantyCare{at,item,stage}, 30일 숨김(29일째 숨김·30일째 다시).
- AS 판정 도움(hjAsJudge·hjAsJudgeView, 🔧 AS 관리 기록 펼침의 [⚖ 무상·유상 판정 도움]): 5질문(보증 기간·같은 부위·과실/외부 요인·소모품·시공 범위, 예/아니요/모름) → 과실·외부 요인 → 유상, 범위 밖 → 유상, 기간 지남 → 유상, 소모품 → 현장 확인, 다른 부위 → 현장 확인, 모름 남음 → 현장 확인, 모두 맞으면 무상. 보증 기간 답은 AS 기록의 공종(hjAsWarrantyVerdict)에서 먼저 채운다. 최종 판정은 사람이 바꿀 수 있고(suggested 와 함께 저장), 저장은 AS 레코드 안 a.verdict{result,reasons,answers,suggested,at} + 노트 [AS 판정]. 고객 안내 문자 초안은 금액 없음, 기존 [💬 고객 안내 문자](hjAsCustomerMsg)도 판정이 있으면 판정 문구를 쓴다. 변이 ignore-misuse 가 AS_MISUSE_PAID 에서 잡는다.
- 핀3곳 hyeonjang-v438-warrantycare(v447 위). 신규 tests/warrantycare-v438.e2e.js 3/3, 변이·기준선 실패 확인, 관련 10개(as-record/asclose-v366/asview-v367/asvisit-v365/inqpending-v386/stalequote-v392/warranty-v313/leakwarranty-v423/dates-warranty-office/warranty-review)·정적 21개 통과.

## 2026-10-16 v447 데이터 안전 (개인정보 보존 3년·정리 · 삭제 요청 · 백업 점검·복원 리허설 · 변경 기록)

- HJ_RETENTION{years 3(대표 결정), inquiryYears 1, ledgerYears 5, backupWarnDays 3, backupAlertDays 7, auditDays 90}. 기준일 = 마지막 활동일(준공 doneAt·수금 payLog.d·AS asLog date/visitAt/doneAt·노트 date — ko-KR 날짜 문자열도 hjRetYmd 가 읽는다). 정확히 3년 전 날도 대상(±1일 테스트). 기준일 없는 현장은 목록에 넣지 않고 개수만.
- 예외(정리 안 함): 보증 남음(hjWarranty end ≥ 오늘 — 기본 보증이 36개월이라 준공 기준이면 사실상 3년 하루 뒤부터 대상), 대금 정리 전(projStats.due>0 — 숫자는 보여 주지 않는다, 2026-08-13 미수 표시 없앰 결정과 receivable-removed.check 를 지킨다; 변이 ignore-due 가 RET_EXCEPTION_DUE 에서 잡는다), 진행 중 AS, 분쟁 메모. 연락처는 tag 고객 + 같은 번호 현장에 거래(stage≥2·수금·견적)가 없을 때만 1년 규칙, 관리사무소·팀원·거래처는 제외.
- 정리(hjRetApply)는 자동 실행 없음 — 🔒 목록에서 고르고 "정리" 를 직접 쳐야 하고, 바꾸기 전에 hjSnapshot('개인정보 정리 전',강제)을 찍고 못 찍으면 아무것도 안 바꾼다(변이 skip-snapshot 이 RET_SNAPSHOT_FIRST 에서 잡는다). 지우는 것: 고객 이름→'고객'·전화·메일·카카오, 주소는 행정동까지(hjRetAddrDong), 하자보증 서명·보관본 html·피해 확인서 서명/링크 이름, 그 현장 노트·일정·견적 제목/메모/주소·AS 글·파일(가상 견적서 이름·OCR 글자·est.customer·명함 인식)의 이름·번호·동호수, 같은 번호 연락처, 현장 이름에 든 고객 이름(hjRenameProjectRefs 로 모든 참조 함께). 남기는 것: 견적 금액·품목, 수금·지출, 발행 문서 기록, 파일. 기록 p.anon{at,by,reason retention|request}·c.anon.
- 삭제 요청(현장 상세 [🔒 개인정보], data-retreq 위임): 그 현장만 같은 익명화(reason request) + 고객 안내 문자 초안(세법 5년 보관 설명, 금액 없음, hjSendSms 초안만). 현장 통째 삭제는 기존 deleteProject(안전판 이미 있음)에 변경 기록만 더했다.
- 백업 점검: backupMarkDone 을 드라이브 백업 성공에도 붙였다(이전엔 파일 내보내기만). 첫 화면 hjSafetyDashHtml — 3~6일 노랑 한 줄(data-backup-nudge), 7일+ 는 기존 백업 카드를 빨강으로(data-backup-card=alert), 보존 정리 대상 월 1회 알림(hj_ret_seen 달 기준), 복원 리허설 30일 알림. 복원 리허설(hjRestoreRehearsal)은 최근 안전판을 읽어 레코드 수·최상위 키를 지금과 비교만 한다(복원 안 함).
- 변경 기록: IndexedDB 'hyeonjang-audit'(직렬화 자료 밖) {at,kind,target,count,by,device} — 대상은 종류 이름만(' — ' 뒤 현장 이름은 잘라냄, 번호·메일 제거). 강제 안전판(hjSnapshot force=true — durableLocalMutation 포함)·현장 삭제·정리·안전판/드라이브 복원·거래처 명단 가져오기·리허설을 남긴다. 직원 모드(v444)·설정 변경 훅은 아직 없음. 🧾 변경 기록 화면: 종류·날짜 필터, 200건, CSV(BOM), 열 때 90일 지난 것 정리.
- 진입: ⚙️ 설정 › ⭐ 기타 [🔒 데이터 안전] → 백업 상태·리허설·보존 정리·변경 기록. 더보기 126 유지. 핀3곳 hyeonjang-v447-retention(v442 위). 신규 tests/retention-v447.e2e.js 4/4, 변이 2종·기준선 실패 확인, 관련 12개(snapshot-guard/snapshot-policy/snapshot-restore-guard/snapshot-revert/delete-guard/restore-safety/settings-tabs/settings-safety/key-persist/project-rename/storage-durability/dash-reports)·정적 21개 통과. 운영 자료로 실행하지 않았다(합성 자료만).

## 2026-10-16 v442 누수 보험 청구 도우미 (피해 확인서 · 보험 서류 체크리스트 · 제출 이력)

- 데이터는 현장 레코드 안 p.leak.claim 한 덩어리(insurer·claimNo·dueAt·checklist{key:{done,at,skip,fileRef,fileName}}·extra[]·submitted[{at,via,keys,memo}]·memo·closedAt·tplSeen·damage{…}). 고객 쪽 서류(청구서·등본·신분증·통장 …)는 체크만 — [첨부]는 우리가 만든 6가지에만 있고, 보험증권 번호·주민번호·계좌 칸은 없다. 메모·접수번호·보완 메모·추가 서류 이름에 주민번호 꼴(6자리-7자리)이 들어오면 저장하지 않는다.
- HJ_INS_CHECKLIST 12항목(저희 6: 소견서→v422 보고서, 견적→v421, 영수증→v433 간이영수증, 사진→v427 증빙 묶음 보험용, 경위서→v433, 피해 확인서→F1 / 고객 6)은 2026-10 인터넷 자료(비즈워치 2021-07 일배책 누수 기사·뱅크샐러드 2026-09 누수 보험 정리·보험 정리 블로그) 기준이고 화면에 "보험사마다 다름"을 적는다. 앱 기록(보고서 보험용 발행·저장된 누수 견적·간이영수증·증빙 묶음·경위서·피해 확인서 발행)이 있으면 자동으로 준비됨. [해당 없음]은 분모에서 뺀다(진행 n/12 → n/11).
- 보험사별로 고친 목록(해당 없음·추가 서류)은 이 기기 localStorage hj_ins_tpl(보험사 이름·항목 키·서류 이름만)에 남고, 같은 보험사를 고른 다음 현장에서 배너로 "제안"만 한다 — [적용]을 눌러야 들어간다(테스트 ③). 보험사 칸을 바꾸면 배너 칸만 다시 그린다(전체를 다시 그리면 다음 칸으로 옮겨 누른 입력이 사라졌다).
- 피해 확인서(hjInsDamageView, 📎 서류 만들기·체크리스트에서): 동·호수는 고객 주소의 ○동 ○호에서 아랫집 = 한 층 아래(접수 '윗집이 원인 추정'이면 거꾸로) 자동, 이름은 서명란 자필(빈칸), 피해 부위 체크·내용, 사진은 조치 전·"아랫집" 사진을 먼저 골라 두고 6장까지, 탐지 결과는 v420 기록 자동. 서명은 현장 서명판(claim.damage.sigs — p.warrantySigs 와 섞지 않음) 또는 링크(전자계약 서버 quickSend docKind 'leak-damage' → contract.signature, 피해 세대 휴대폰은 서버로만). 문서에 고객 이름·전화·현장 이름·금액을 싣지 않는다. 발행은 v433 엔진 p.docs type damage(DC-번호)·노트. ※ 전자계약 서버가 아직 'leak-damage' 를 모르면 BAD_REQUEST → 현장 서명으로 안내한다(서버 쪽 템플릿 추가가 남은 일).
- 고객 안내문(문자 초안·PDF 1장): 저희 준비/고객님 준비/알아둘 것, 금액 없음 — 상태 글(견적 금액 포함)·추가 서류 이름은 hjInsNoAmount 로 금액을 지운다(변이 amount-unmask 가 INS_GUIDE_NO_AMOUNT 에서 잡는다). 대표용 자기부담금 참고(2020-04 이후 누수 50만 원이 많음)는 앱 화면에만.
- [📤 제출했음] 날짜·방법(보험사 앱/팩스/이메일/방문/우편)·보낸 서류 → claim.submitted + 노트 [보험 제출], 행마다 보완 요청 메모. 대시보드 누수 줄(hjLeakTodayHtml)에 "🧾 보험 서류 진행 중 n곳 (미완 m)", 🌙 오늘 마감에 "오늘 보험 서류 제출 예정"(dueAt=오늘이고 오늘 제출 기록 없음). [청구 끝남]이면 집계에서 빠진다. 누수 카드에 [🧾 보험 서류](data-insclaim, 클릭 위임 등록).
- doccenter-v433 의 예정 줄 수 단언을 6→5 로 고쳤다(피해 확인서가 실제 항목이 됨). 핀3곳 hyeonjang-v442-insurance(v440 위에 쌓은 브랜치). 신규 tests/insurance-v442.e2e.js 4/4, 변이·기준선 실패 확인, 관련 10개(leakreport-v422/doccenter-v433/warranty-link/evidence-v427/leakintake-v419/dayclose-v359/leakquote-v421/leakdetect-v420/leakwarranty-v423/leaksms-v424)·정적 21개 통과.

## 2026-10-16 v440 외주팀·작업자 명단 · 일당·공수 정산표 · 외주 견적 요청서 · 지급 명세

- 명단은 앱에서 직접 추가(대표 결정 10/16, 초기 파일 없음): 작업자는 👷 팀원 연락처(c.team) 안 c.trade/dayRate/halfDay(팀원 체크를 풀면 같이 지운다), 외주팀은 📇 거래처 category 외주 안 s.trade/lead/rate{type day|pyeong|job,amount}/taxInvoice. [➕ 외주팀 추가]·[📥 외주팀 명단](CSV·엑셀 이름·전화·공종·단가 4열, v439 와 같은 경로·같은 이름은 빈 칸만 보완). 삭제는 기록(발주·단가·지출·외주 견적 요청·지급)이 있으면 숨김. 👷 팀원 주간 현황에 공종·일당(data-crew-info).
- 사람별 공수는 일정 s.labor.by={이름:{days 1|0.5,rate}} — 👷 인건비 장부 일정 줄의 이름별 [1][½][-] 토글(.llDay)과 일당 칸(.llRate, 기본은 명단 일당). 합계는 기존 s.labor.amount 에 같이 써서 laborLedgerData·laborProjectTotal·[지출 반영]이 손대지 않고 같은 값을 본다(테스트가 정산표 현장별 합계 = laborProjectTotal 을 확인). 장부 핸들러는 다시 그리기 전에 적던 칸을 먼저 저장하고 한 번만 그린다 — iOS 처럼 입력 포커스가 남은 채 버튼을 누르면 늦게 오는 change 로 겹쳐 그려 NotFoundError 가 났다(LEDGER_NO_NESTED_REDRAW).
- 👤 사람별 정산표(hjCrewSettleView, 장부 [👤 사람별 정산표]): 사람×날짜 격자·공수·일당 합·선지급 차감(지출 장부 src crewpay 같은 달)·지급할 금액, 📥 엑셀(요약+사람별 시트)·📄 PDF 1장. 💸 지급 명세(hjCrewPayslipView): 날짜·현장·공수·금액·차감·지급액 + "입금 후 문자로 알려 드립니다. 계좌: 전화로 확인"(계좌번호는 저장하지 않는다), 문자 초안·PDF, [💸 지급했음] → state.expenses 1건(category 인건비|외주, src crewpay, who, ym, final, sourceKey crewpay|이름|월 로 두 번 안 넣음 — 변이 pay-dup 이 CREW_PAY_ONCE 에서 잡는다). 현장 배분은 기존 [지출 반영]이 맡는다(자동으로 p.cost 를 건드리지 않는다). 🌙 오늘 마감은 25일부터 "이번 달 지급 명세 안 만든 사람 n명"(data-dc-crewpay).
- 🔧 외주 견적 요청(현장 카드 [data-subquote], 클릭 위임 등록): 외주팀·공종·견적 품목 체크·주소(동·호수까지)·희망 일정·사진 4장 → 문자 초안(hjSendSms)·요청서 PDF. 고객 이름·전화가 문구에 있으면 보내지도 기록하지도 않는다(hjSubQuotePrivacyOk — 변이 phone-unmask 가 SUBQUOTE_NO_CUSTOMER_PHONE 에서 잡는다). 기록 p.subQuotes[]{id,sup,trade,at,items,when,status asked|got|picked,amount}, 받은 금액 → 선택, hjSubQuotePicked 가 외주 원가 참고(v437 비교표가 읽을 자리). 모르는 외주팀 이름은 📇 거래처(외주)에 추가.
- 핀3곳 hyeonjang-v440-crew(v439 위에 쌓은 브랜치). 신규 tests/crew-v440.e2e.js 4/4, 변이 2종·기준선(3c7db67 CREW_API_PRESENT)·겹쳐 그리기 탐침 실패 확인, 관련 10개(crew-v357/crewweek-v375/contactpick-v393/dayclose-v359/material-v439/schedule-safety/field-issue-more/percrew-v360/ui-feedback/settle-docs)·정적 21개 통과. 새 최상위 키 없음, 더보기 126 유지.

## 2026-10-16 v439 자재상 명단 · 발주→입고→원가 · 자재 단가표 · 남은 자재

- 📇 거래처: 자재 분류에 주소·영업시간·결제(현금/월말 외상/카드)·배송 칸(같은 레코드 s.addr/hours/pay/delivery), [➕ 자재상 추가]·[📥 명단 불러오기](CSV·엑셀 4열 이름·전화·주소·품목, 같은 이름은 빈 칸만 보완)·📇 주소록 번호 채우기. 삭제는 거래 기록(단가·발주·지출)이 있으면 s.hidden 숨김 → [숨긴 거래처]에서 되살림. 대표 결정대로 초기 명단 파일은 없고 데모에만 3곳.
- 발주 품목 줄 끝 `@12,000` 이 단가(공급가, 빈 값은 0 으로 치지 않음) → o.items[].price·o.total. 발주 문자 화면에서 납품 확인에 올릴 때 견적 판매단가는 쓰지 않고 단가표 제안만. [✅ 입고 확인] 뒤 hjMatCostAsk 가 "자재비 ○○원을 원가(자재)에 더할까요"를 묻고(금액 고치기 가능) 한 번만 더한다(o.costApplied 가드 — 변이 cost-guard 가 잡는다) + 노트 `[자재비] …` + 단가표 기록(src recv). [↩ 입고 취소]는 뺀다(음수 방지). 미룬 건은 [💰 원가 반영] 버튼과 🌙 오늘 마감 줄(data-dc-matcost).
- 단가표는 거래처 레코드 안 s.prices[]{name,spec,unit,price,at,src} 품목당 최근 5개, 더보기 항목을 늘리지 않고 📇 거래처 [📋 자재 단가표]에서 연다(최저가 표시·직접 기록). 견적 편집기 품목 위에 "자재 원가 참고" 한 줄만(견적 단가 불변). 남은 자재는 입고 건 [📦 남음] → o.items[].left → [재고로 옮기기]로 기존 state.inventory 에 수량 합산(movedToInv 로 두 번 안 옮김). state.supplierMap/state.materials 는 건드리지 않았다.
- 핀3곳 hyeonjang-v439-material(v432 위에 쌓은 브랜치). 신규 tests/material-v439.e2e.js 4/4, 변이·기준선 실패 확인, 관련 9개(matdue-v368/matsched-v369/matissue-v372/matplan-v373/materials/order-materials/quote-materials/margin/margin-v429/demo-banner)·정적 19개 통과.

## 2026-10-16 v432 팀 패킷 연동 1차 (📤 팀에 업무 보내기 / 📥 팀 작업 가져오기)

- 규격은 지시서/팀앱_연동_인터페이스.md 의 work-order.json(type hj-work-order, version 1)·work-report.json(hj-work-report) 그대로(hjWoValidate 가 필드 추가·개명을 막는다). 패킷에 고객 이름·전체 전화·금액을 넣지 않는다 — hjWoPrivacyIssues 가 걸리면 저장·복사·공유 자체를 하지 않는다(변이 privacy-off 가 잡는다). 주소는 호수를 뺀 값, 동·호수는 인터페이스의 unit 칸, 연락처는 대표 번호 마스킹만.
- 보내기(hjTeamPacketSendView — 현장 카드 [📤 팀에 업무 보내기]): 후보는 현장의 할 일(개인 todo·팀 업무)·준비물·앞으로의 일정(💰·세금 자동 제외), 담당은 팀원 연락처/팀 업무 담당 이름. id 는 `wo_YYYYMMDD_nnn`(전체 현장의 기록으로 다음 번호, 같은 화면에서 다시 보내면 같은 id·같은 기록에 sentAt·resent 만 갱신). 기록은 p.workOrders[] 기존 자리에 {packetId,sentAt,via,assignee,due,priority,checklist,items,reports} + 노트 `[팀 지시] …` 원자 저장. QR 은 인코더가 없어 뺐다(v446). "미완료 업무 JSON 초안 내보내기(v328)" 는 저장소에 없어 맞출 대상이 없었다.
- 가져오기(hjTeamReportImportView — 팀 업무·인수인계 [📥 팀 작업 가져오기]): JSON 붙여넣기/파일 + 사진 zip(JSZip). 매칭은 orderId → 현장 이름 유일 일치 → 사람이 고름. 반영은 보고마다 durableLocalMutation(묶음 전 hjSnapshot 1회): done → 지시에 묶인 할 일·팀 업무·준비물 완료 + 작업시간(state.workLogs) 1건(09:00 + 보고 시간 기준, memo 에 보고자·내용·이슈), review/blocked → 대시보드 줄(hjTeamReportPendingHtml), 보고는 wo.reports[] 또는 지시 없는 현장은 p.teamReports[]. 같은 reportId(없으면 orderId|workDate)는 두 번 반영하지 않는다. 사진은 기존 openPhotoIntake(사진 추가 확인)로, phase 는 패킷 값 우선(누수 현장 _leaktag before/cause/after, 그 밖에 _phase).
- 핀3곳 hyeonjang-v432-teampacket(v431 위에 쌓은 브랜치). 신규 tests/teampacket-v432.e2e.js 4/4, 변이·기준선 실패 확인, 관련(team-packet.unit/photo-intake-safety/team-connect)·정적 19개 통과. team-workboard.e2e 는 이 컨테이너에서 main 에서도 같은 자리(다운로드 파일명)에서 실패한다 — CI 가 판정.

## 2026-10-16 v431 공개 누수 접수 페이지 + 앱 문의함 연결

- `leak.html/leak.css/leak.js` 는 서버 없는 공개 페이지(stage-pages 등록, sw.js 셸 목록에는 넣지 않음). 증상 6항목은 앱 v419 `HJ_LEAK_INTAKE_CHOICES` 와 같은 항목·같은 값이어야 하며 검사가 두 상수를 대조한다. 페이지는 저장·업로드·외부 요청이 없고(사진은 문자 답장), 가격·과장 문구 없음, 회사 번호 010-2397-8629 표시. [📨 문자로 보내기]는 `sms:01023978629?body=[누수접수] 어디서=…;언제=…;물양=…;이웃=…;관리사무소=…;보험=…;동=…;시간=…;이름=…` 한 줄 + 사진 2장 안내. 카카오 채널 버튼은 주소가 비어 있으면 숨긴다(가짜 링크 금지, 대표가 주소를 주면 leak.js KAKAO_URL).
- 앱: 📞 새 문의 받기 › [📋 접수 문자 붙여넣기](hjLeakWebIntakeView) → hjLeakWebParse 가 같은 값만 받아들이고 모르는 값은 메모(확인 필요)로만. 문의는 기존 hjInquiryCreate(leadSrc web, 현장명 '동네 누수 이름')로 만들고, 접수 체크리스트는 기존 누수 접수 화면을 채운 채 연다(저장·🚨 출동은 그 화면이 — 두 번 저장하지 않음). 표식이 없거나 읽지 못하면 메모만 가진 문의로 등록. 사진과 함께 공유 받은 문자(v416 수신함)에 표식이 있으면 같은 파서로 가는 버튼을 보여 준다(문자만 공유하는 것은 공유 대상이 사진을 요구해 받지 못함 — 붙여넣기로).
- 📣 광고 탭 [🔗 누수 접수 링크]: URL·소개글(번호 없음) 복사. QR 은 v446 에서.
- 핀3곳 hyeonjang-v431-leakintakeweb(v427 위에 쌓은 브랜치). 신규 tests/leakintakeweb-v431.e2e.js 6/6, 변이 keymap·기준선 3c7db67 실패 확인, 관련(leakintake-v419/inqpending-v386/shareinbox-v416/sharetarget-v416/bathroom-v410)·정적 19개 통과.

## 2026-10-16 v427 건별 증빙 묶음 · 월말 묶음

- 📎 서류 만들기 › [🗂 증빙 묶음](hjEvidenceView): 견적(파일+앱 견적 txt)·사진 전→중→후(`01_전_욕실.jpg`, 태그/공정 순·시각순)·영수증(kind 'receipt')·수리확인서/경위서 HTML(발행된 것)·거래명세서/청구서 HTML·하자보증서 HTML(준공 후)·수금·발행 기록 xlsx(세금계산서/현금영수증 상태 + 간이영수증 번호, p.docs ref 로 입금 기록과 연결)·00_목록.txt 를 기존 JSZip 으로 한 ZIP. 계획(hjEvidencePlan)은 읽기 전용이고 빠진 것은 '빠진 것' 으로 적는다.
- 용도 3종은 v422 규칙: 세무사용 이름 가림·연락처 제외·금액 전부·내부 원가 포함 / 보험·관리사무소용 이름 가림(해제 가능)·금액 숨김 선택(명세서·청구서·xlsx 제외) / 고객용 이름 전체·내부 원가·견적 메모 제외(변이 customer-internal 이 잡는다). 누수 보고서 PDF 는 기기에 없으므로 [지금 생성]을 켠 경우에만 v422 발행 경로(모델→캔버스→PDF→발행 기록)로 만들어 담는다.
- 묶음이 실제로 만들어진 뒤에만 p.docs 에 type 'evidence'(EV-날짜-nn) + 노트. Drive 는 기존 중계/Drive 업로드 경로(폴더 '증빙'). 월말 묶음(📆 월말 마감 1단계 [🗂 이번 달 증빙 전부])은 그 달 완료·수금 현장을 세무사용으로 현장별 폴더 + 00_요약 xlsx(현장·매출·수금·발행 — 미수 칸 없음, 2026-08-13 규칙 유지)이며 기록은 남기지 않는다.
- 핀3곳 hyeonjang-v427-evidence(v429 위에 쌓은 브랜치). 신규 tests/evidence-v427.e2e.js 5/5, 변이·기준선 실패 확인, 관련 6개(doccenter-v433/leakreport-v422/extras-settle/case-pack/site-zip/settle-docs)·정적 19개 통과.

## 2026-10-16 v429 건별 마진 · 월 마진 보드 · 누수 원가 템플릿

- 건별 마진(hjProjectMargin)은 projStats 를 읽기만 한다 — 매출은 수주 견적 합계(기본 공급가, 토글로 부가세 포함), 원가는 유효원가(수기>0 우선, 아니면 장부). 원가가 비면 margin/rate 가 null 이고 '원가 미입력' 으로만 보인다 — 0 으로 계산하지 않는다(변이 zero-cost 가 이를 잡는다). 색 밴드 HJ_MARGIN_BANDS(30↑/15~30/15 미만/적자).
- 현장 카드 💰 칸 아래 📈 건별 마진 줄 + [✏ 원가 입력](hjCostInputView — 정산 탭의 p.cost 와 같은 칸, 저장은 setCost 와 같은 뜻). 누수 현장은 탐지 원인별 HJ_LEAK_COST_TPL 로 빈 칸에만 제안 금액(일당은 일정 인건비 중앙값, 없으면 25만 상수)을 넣고 기존 값은 덮지 않는다.
- 💼 회계 › [📊 마진 보드](hjMarginBoardView): 월 배정은 준공월 → 집계 견적의 견적일 → 마지막 수금일(없으면 '월 미정' 수만), 인테리어/누수 2그룹 합계·마진율 순 CSS 막대·원가 미입력 경고·지난 3개월 추이·규칙 요약 한 줄·엑셀(ensureXLSX, 내부용). 보드·토글·월 이동·엑셀은 저장본을 바꾸지 않는다. v428 토글 함수는 이 기준선에 없어 자체 토글을 썼다.
- 핀3곳 hyeonjang-v429-margin(v433 위에 쌓은 브랜치). 신규 tests/margin-v429.e2e.js 4/4, 변이 zero-cost·기준선 3c7db67 실패 확인, 관련 6개(ledger-cost-apply/ledger-roundtrip/dcsales-v391/extras-settle/settle-docs/mobile-modal-tap)·정적 19개 통과. 결과는 비커밋 보고/v429.md.

## 2026-10-16 v433 문서 센터 (수리·작업 확인서 · 누수 사고 경위서 · 간이영수증 바로 보내기)

- 📎 서류 만들기(docHubView)를 영업·계약/시공 중/준공·돈/AS·보증/누수·보험/아파트·행정/보관 7그룹으로 재배열하고 항목마다 "자동으로 채워지는 것/비어 있는 자료" 한 줄을 붙였다. 기존 8개 진입점은 같은 함수로 그대로 열고, 예정 항목(v427·v432·v437·v438·v441·v442)은 회색 안내만 한다. 더보기 메뉴는 126 그대로.
- 새 문서는 기존 hjDocShell/hjDocPrint/hjDocWordMhtml/hjDocDownload 세 갈래 위에 이미지(PNG, 견적서 PDF 와 같은 html2canvas 로더)와 문자 초안만 더했다. 수리·작업 확인서(WC-)는 금액 숨김·의뢰인 이름 가림이 기본이고 고객 서명은 warrantySigCapture 를 재사용한다. 누수 사고 경위서(LN-)는 접수·탐지·조치를 사실 순서로 적고 없는 기록은 '기록 없음'으로 남기며 금액을 싣지 않는다. 간이영수증(MM-)은 번호 자동, 받은 돈 저장 직후 hjPayRcptOffer 로 바로 연다.
- 발행 기록은 현장 레코드 안 `p.docs[{type,no,at,purpose,name}]` + 현장 노트 `[문서] …` 한 줄을 durableLocalMutation 으로 원자 저장한다(번호 기준 한 번, 새 최상위 직렬화 키 없음). 모델·미리보기는 읽기 전용이며 실제로 PDF·워드·HTML·이미지를 가져간 시점에만 기록한다. 간이영수증 발행 수는 대시보드에서 세금계산서·현금영수증 미발행과 별개로 구분 표시한다.
- 핀3곳 hyeonjang-v433-doccenter. 신규 tests/doccenter-v433.e2e.js 5/5, 변이 amount-default·unmask-default 와 기준선 3c7db67 이 의도한 단언에서 실패, 관련 12개(settle/warranty/pay-receipt/leak v421~v424/action-search/mobile-modal-tap)·정적 19개 통과. 로컬 전체 회귀 금지, 결과는 비커밋 보고/v433.md.

## 2026-10-16 v425 기기 안 오프라인 대기함

- 사진 원본과 현장 기록을 기기에 보존하고 서버 동기화만 hyeonjang-share/outbox에서 순서 처리한다. 기존 공유 inbox·릴레이 대기열을 보존하며 대기 목록 제거로 사진을 지우지 않는다. 새 최상위 직렬화 키와 셸 경로를 추가하지 않는다.
- 핀3곳 hyeonjang-v425-offlinequeue. 구현·새 검사·관련 검사·정적 검사 결과는 비커밋 보고/v425.md에 기록한다. 로컬 전체 검사 금지, 동시1/15분.
- 신규13시나리오와 캐시 설치 단위8시나리오 통과. 온라인 자동 저장 경합은 실제 기기 저장 성공 뒤 이어 보내며, 사진 원본만 먼저 복원된 경우도 보고서에 포함한다. 첫 설치는 공개 셸 응답 본문을 순서대로 읽어 검증한 뒤 캐시에 쓰고 실패 시 기존 워커를 유지한다.

## 2026-10-16 · v423 누수 보증·재발 추적

- 누수 신규 보증은 기존 앱 기준을 줄이지 않는 배관24/방수36/실리콘·줄눈12개월을 원인별로 제안한다. 제조사 기간은 확인 전 미선택·빈칸이며 기존 custom 약정과 만료일은 자동으로 바꾸지 않는다. 보증서 원인·수리 범위와 v422 보고서는 실제 등록값만 읽고 미등록은 확인 안내한다.
- 재발은 aptComplexKey와 명시 동·호수로 판정하며 보관 이력을 포함한다. 다세대·상충 주소·모호한 참조는 추정하지 않고, 같은 세대 고유 개수와 관련 공종/접수일 기준의 보증만 표시한다. 새 사건명 별칭은 유일 prevId와 양쪽 명시 주소·단일 동호 일치 근거가 있어야 한다. 읽기 함수는 저장본을 바꾸지 않는다.
- AS는 두 기존 입구에서 같은 원인 질문을 거친다. 같은 원인은 기존 asLog에 원자 저장하고 다른 원인은 명시 확인 뒤 기존 새 현장·아파트 경로에서 prevId만 연결한다. 접수 초안·선택 사진은 모달 왕복에서 보존하며 실패·저장 대기 중 변경을 재검증한다.
- 핀3곳 hyeonjang-v423-leakwarranty, 직렬화 최상위키/더보기126 유지. 새 검사·변이·관련3~8개·정적 검사를 격리 복사본에서 수행하며 로컬 전체 회귀는 금지한다. 실제 검사·CI·P1 결과와 기본값 결정은 비커밋 보고/v423.md에 기록한다.

## 2026-10-16 v424 누수 문자 세트

- 명시적 누수 현장의 접수·출동·탐지·견적·완료·입금·제3자 안내 초안을 기존 문자 센터/현장 카드/오늘 마감에서 연다. 초안 조회는 저장본을 바꾸지 않으며 복사·문자 앱 열기를 발송 성공으로 기록하지 않는다.
- 보냈음 체크만 현장 내부 leak.sms와 문자 노트를 원자 저장한다. 제3자 안내는 별도 동의·수신자 입력을 요구하고 고객·원인 세대 정보는 자동 포함하지 않는다. 미확인 금액·시간·계좌·보증을 추정하지 않는다.
- 핀3곳 hyeonjang-v424-leaksms. 신규9/9·관련7개·정적19개 최종 통과(로컬 약6.2분/동시1). 이전e62c43e API 부재와 제3자 가림 제거 변이가 의도한 단언에서 실패했다. 390px/44px·실발송0·읽기 불변·저장 실패 보존·재출동 체크를 검증했으며 전체회귀는 PR/배포CI에 맡긴다. 상세 결과와 기본값은 비커밋 보고/v424.md에 기록한다.

## 2026-10-16 · v422 누수 보고서 PDF

- 보험사/관리사무소/아랫집 용도별 공개 범위를 모델 단계에서 적용한다. 이름은 가림 기본, 관리사무소 금액 숨김, 아랫집은 조치/재발 방지 위주로 연락처/금액/고객식별 제외. 원본 입력·사진은 바꾸지 않는다.
- 기존 __docExport의 A4/pageBreaks 렌더를 그대로 쓰며 사진 행을 자르지 않는다. 생성 성공 후 reports/노트만 원자 저장하며 미리보기는 기록하지 않는다. 동일 발행본의 PDF/이미지/Drive 재출력은 번호를 중복 생성하지 않는다. 문자 초안은 기존 문자 센터 경로이며 발송하지 않는다.
- 핀3곳 hyeonjang-v422-leakreport, 직렬화 최상위키/더보기126 유지. 새 검사/변이/관련/정적 및 실제 합성PDF3종 검증 결과는 비커밋 보고/v422.md. 로컬 전체 검사 금지, 동시1·15분 예산.

## 2026-10-16 · v421 누수 견적·받은 돈 기록

- 원인별 고정9품목과 기존 priceBook만 사용한다. 미등록 단가는 빈칸이며 확정0원과 구별한다. 간이 견적은 기존 quoteCommitEditing·단가 학습·이력·팔로업을 사용하고 다른 미저장 견적을 보호한다. 고객 보기와 문자 초안은 저장·발송하지 않는다.
- q.paid.payLogId로 수금1건을 재사용하고 수정 차액만 p.received에 반영한다. 안전판 후 현장/견적/기존 수금/탭 상태를 재확인하고 원자 저장 뒤 표시한다. 읽기 함수·더보기126·기존 직렬화 최상위 키 유지.
- 핀3곳 hyeonjang-v421-leakquote. 새 검사·변이·관련 검사·정적 검사는 격리 복사본8499에서 동시1로 수행하며 로컬 전체 검사는 금지한다. 결과는 비커밋 보고/v421.md에 기록한다.

## 2026-10-16 v420 누수 탐지 기록과 사진 태그

- 명시적인 kind:leak 현장에만 탐지 방법·원인·책임 구역·위치·측정값·재방문 기록을 p.leak.detect에 저장하고 현장 노트와 출동→수리 확인으로 잇는다. 기존 유형이 없는 현장을 누수로 추정하거나 일괄 변경하지 않는다.
- hjLeakSummary는 접수·탐지 자료를 읽기만 하며 미확정 원인을 단정하지 않는다. 현장 카드와 완료보고서 초안에 연결한다. 사진의 _leaktag/저장 leaktag는 원인·조치 전·후·장비를 구분하고 작업명·공정 및 원본 연결을 유지한다.
- 같은 이름 현장·저장 상태 변화·잘못된 수치 보호, 사진 태그의 저장/복원/중복 메타데이터 보존을 검증한다. 새 최상위 직렬화 키와 더보기 메뉴는 추가하지 않는다. 핀3곳 hyeonjang-v420-leakdetect. 새 검사10/10·관련8개·정적19개 통과(누적 약1.5분/동시1), 이전3d6bf16의 API 부재와 leaktag 읽기 제거 변이가 의도한 단언에서 실패함을 확인했다. 공유 저장 재시도·탐지 저장실패·오래된 탭 단계변경을 검증했고 로컬 전체 미실행, 최종 CI 결과는 비커밋 보고/v420.md에 기록한다.

## 2026-10-16 · v419 누수 접수·출동

- v411 P1 배포·운영 확인 뒤 main `62696fa`에서 시작한다. 현장 안 `kind`/`leak.intake`와 일정 안 `urgent`만 추가한다. 유형 없는 현장은 읽을 때만 인테리어로 취급하며 STAGES 숫자·색·직렬화 최상위 키·더보기126을 유지한다.
- 신규 현장·문의 유형 선택과 leak-pipe 자동 분류, 아파트 미리보기/확인 경로의 유형 보존, 원자 접수/노트 저장과 성공 뒤 저장·동기화 표시를 연결한다. 최대2장 사진은 기존 확인/추가 경로를 사용하며 원본을 바꾸지 않는다.
- 출동은 기존 일정 편집기에서 확인 후 저장한다. 18:00 허용·초과 시 다음 작업일09:00, 작업일은 일요일만 제외한다. 긴급 일정 목록/달력, 오늘 출동·길찾기, 완료 보고는 있으나 단계3 미만인 누수 현장의 마감 집계는 읽기 전용이다.
- 빌드 3곳 `hyeonjang-v419-leakintake`. 신규7시나리오(사진 공유/누수 콜백 결합 포함)·보호 제거2변이·이전버전 실패·관련8파일·정적19파일을 단일 worker의 격리 복사본으로 검증한다. 로컬 전체 검사는 하지 않는다. CI·P1 배포·운영 결과 및 기본값은 비커밋 `보고/v419.md`에 기록한다.

## 2026-10-16 v416 설치 앱으로 사진 공유받기

- 실제 manifest.webmanifest에 기존 설치 정보·PNG 아이콘·세 단축키를 보존하고 사진 촬영 단축키·이미지/동영상 공유 대상을 추가한다. 같은 origin·scope의 정확한 POST만 별도 IndexedDB에 원본을 먼저 저장하고 저장 완료 뒤 303으로 이동한다. 30개·300MiB 제한과 제외 개수 안내, 다른 POST/GET 캐시 규칙을 유지한다.
- 수신함에서 현장 선택 후 기존 사진 넣기·작업명·날짜 추정 경로를 쓴다. 나중에·취소·부분 실패는 원본을 보관하며, 저장한 사진도 이 기기에서 다시 열 수 있게 Blob과 사진 내부의 무작위 수신 식별자를 보존한다. 앱 데이터 최상위 키는 늘리지 않는다.
- capture 진입은 기존 현장 선택 안전 동선과 44px 촬영 버튼을 쓰고 처리한 query만 지운다. 더보기 설치 안내만 추가해 기능 메뉴126개를 유지한다. 새 검사·관련8개·정적 검사는 격리8599/8698에서 동시1로 실행하고 전체 회귀는 CI가 맡는다. SW14/14·변이4/4, 새 화면10/10·관련8개·정적19개 통과. 이전1531627에서 새 SW/화면 단언의 의도한 실패를 확인했다. 실제 갤럭시 공유 메뉴는 미검증이며 상세 결과는 비커밋 보고/v416.md에 기록한다. 핀3곳 hyeonjang-v416-sharetarget.

## 2026-10-16 · v411 + v418 main 통합

- v418 main `d44a95c`를 merge로 포함한다. 추정 단가 출처·공개 익명 집계·VAT 재환산과 v411 고객/현장/기간 전달을 함께 유지한다. prefill은 한 번만 소비하고 기존 값·0원 → 앱 저장 단가 → 추정 단가 순서를 지킨다.
- 선택 품목에 추정값이 남은 상담은 앱 전달을 보류한다. 추정 단가가 앱의 확정 단가장에 학습되지 않도록 하는 기본값이며 원본 입력과 기존 전달 키를 보존한다. 가격 확인 후 사용자가 직접 입력한 값으로 전송한다.

## 2026-10-16 · v411 욕실 상담 ↔ 앱 견적 연결

- #174 병합 뒤 main `a1c026a`에서 시작한다. `hj_bath_prefill`은 10분 이내 빈 입력만 채우고, `hj_bath_handoff`는 24시간 이내 확인을 거쳐 새 견적 초안으로 옮긴다. 기존 모달·작성 중 견적·다중 탭 보호를 유지하고 성공 전 전달 키를 소비하지 않는다. 직렬화 최상위 키는 추가하지 않는다.
- 표준 품목명 46개로 기존 단가장을 재사용한다. 미정 가격은 0원+명시 표시로 옮기며 실제 0원과 구별한다. 정수 공급가/소수 두 자리 수량으로 환산한 합계 차이가 1원을 넘으면 이관을 보류하여 입력을 보존한다. 별도 금액 보정 품목을 만들지 않는다.
- v1 상담 초안의 선택·단가를 보존하며 v2의 공사 방식·기간·추가 7항목을 보탠다. 방식 전환 시에만 철거/폐기물 선택을 바꾼다. 화면·CSV·고객 HTML·인쇄·앱 메모에 같은 조건을 표시한다.
- 빌드 3곳 `hyeonjang-v411-bathlink`. 새 단위/브라우저 검사와 이전 버전 실패 검증, 관련 8파일 및 `*.check.js`를 격리 복사본에서 실행한다. 로컬 전체 검사는 하지 않으며 전체 회귀는 PR CI와 P1 배포 게이트로 확인한다. 결과·기본값은 비커밋 `보고/v411.md`에 기록한다.

## 2026-10-16 v415 인스타그램 전화번호 미기재

- adDraftText의 인스타그램 분기를 분리해 DM·프로필 링크로 안내한다. 다른 채널·사례 내보내기는 유지한다. HJ_INSTA_NO_TEL·hjAdTextHasTel은 회사 번호 형식 차이를 정규화한다.
- adDraftOpen에 채널별 안내를 표시하고, 사람이 전화번호를 넣어 게시 기록을 저장해도 막지 않고 최종 토스트 한 번으로 알린다. 채널 버튼 높이 44px을 확보한다. 자동 발송·외부 게시 없음.
- 새 검사 8/8·이전 d44a95c의 의도한 실패·관련 6개와 정적19개 포함26/26 통과(0.6분), 390px 안내·경고 확인. 로컬 전체 미실행이며 CI·배포 결과는 비커밋 보고/v415.md에 남긴다. 핀 3곳은 hyeonjang-v415-instanotel.

## 2026-10-16 v418 과거 견적 단가를 추정으로 구별

- 욕실 상담의 빈 단가를 공개 익명 집계 bathroom-defaults.json으로만 보충한다. scripts/bathroom-defaults-from-quotes.mjs는 로컬 복사본의 품목 허용 필드만 읽고 표준 품목별 문서 단가 중앙값·표본 수를 만든다. 실제 고객·현장·주소·전화·원본 파일명은 공개 결과/보고에 넣지 않는다. 애매한 규격·역할은 제외하고 같은 엑셀 bytes는 중복 계산하지 않는다.
- HJBath.priceTargets/priceSources와 hjBathLoadDefaults는 유효한 hj_bath_prefill prices, 기존 값·0원, 사용자 입력·삭제·규격 변경·초안 복원을 추정보다 우선한다. 자동 단가의 공급가 출처를 보존해 부가세를 바꿀 때 다시 환산하며, 수정한 칸의 추정 배지를 제거한다. 고객 HTML·인쇄·CSV·복사·합계에도 추정 표시를 남긴다.
- v411은 선행되지 않았으므로 현장·고객 연결/앱 보내기는 추가하지 않는다. 익명 단가표만 Pages/SW 허용목록에 추가하고 빌드 3곳은 hyeonjang-v418-bathprices로 맞춘다.
- 합성 추출/개인정보/변이 검사와 브라우저 우선순위·비동기·고객출력 검사를 추가한다. 로컬 전체는 실행하지 않고 지정·정적 검사만 15분 예산으로 수행한다. 수치·실패 이력·CI·배포 결과는 비커밋 보고/v418.md에서 확인한다. 실제 자료 수정·고객 발송·PC 종료 없음.

## 2026-10-16 · v417 갤럭시 연결앱 1.1.0

- 앱 versionCode 2 / versionName 1.1.0. 첫 실행은 항상 안내를 보이고 앱 전용 SharedPreferences의 자동 열기는 기본 꺼짐이다. 사용자가 체크한 뒤 다음 신규 실행에서만 기존 TWA/Custom Tab 경로를 호출하며 회전·복귀는 재호출하지 않는다. 브라우저별 자료 분리·고정 URL·외부 Intent 무시를 유지한다.
- JVM 16/16·lint·release·기존 키 서명/정렬 검증 통과. 새 검사 1건은 이전 a57e09a에서 컴파일 성공 후 의도한 단언 실패를 확인했다. 정적 18파일·관련 6파일·Android 안전 변이 8건 통과, 로컬 전체 회귀 미실행. 새 머리의 전체 회귀 결과는 PR #174 CI와 비커밋 보고/v417.md에서 확인한다.
- 루트 사이트 PR #1은 P2 위임으로 병합했고 Pages 38792549054 성공 후 2026-10-16 04:18 KST 공개 assetlinks 200·릴리스 인증서 일치를 확인했다. APK는 저장소 밖에 보관한다. 실기기 미검증·에뮬레이터 없음, 실제 자료와 고객 발송은 건드리지 않았다.

## 2026-10-16 · P1 욕실 main 재동기화

- PR #177을 `fe7c734`로 병합·배포한 뒤 PR #174의 충돌을 해소하기 위해 P1 위임 절차로 main을 다시 merge한다. AGENTS.md의 양쪽 기록과 견적 작성 화면의 욕실 진입 링크를 보존하고 빌드 3곳만 `hyeonjang-v414-bathroom`으로 맞춘다.
- 정적 18파일·관련 6파일·Android 안전 변이 8건 통과. 로컬 전체 회귀는 실행하지 않았으며 최종 전체 검증은 새 머리 커밋의 PR CI가 담당한다. 이 동기화 커밋과 Android v417 기능 커밋을 분리한다.

## 2026-10-16 · v414 운영 main 동기화 (PR #174 병합 후보)

- PR 브랜치 v409 `3680ae2`에 운영 main `003703f`를 merge로 합친다. 공개 이력은 유지하며 main에 push하거나 운영 배포하지 않는다.
- 중복 정리의 다음 묶음·Drive 빈 기록·현장 간 비교와 복구 보관 없는 삭제를 함께 유지한다. 사진 위치 분리와 main의 계획/응답 재검증 경로로 v409 GPS 없는 사진 주소 보존을 유지한다.
- APP_BUILD/SW/TARGET_BUILD는 `hyeonjang-v414-mainsync`. 격리 검사 복사본만 8599/8698 포트를 사용한다. Windows Node v24.19.0에서 지정·정적 47/47, 최종 전체 296/296(46.3분·동시 2·exit 0), 390px 밝은/다크·사진 동작 확인을 통과했다. 전체의 media-safety/mobile-back/mobile-field-flow는 기존 단독 재시도로 통과했다. 첫 검사 복사본의 포트 전체 치환이 합성 해시를 바꾼 오류는 원본 테스트를 유지한 채 독립 포트 토큰만 치환하도록 교정했다. 초기 실패·교정·CI 결과는 미커밋 보고/v414.md에 남긴다.

## 2026-10-16 v410 선택 견적 설명·단가 입력 동선 개선

- 고객이 선택 비용을 이해하도록 hjBathScopeBreakdown이 수량 × 자재 단가와 수량 × 시공 단가를 나눠 표시한다. 기존 모델 검증으로 빈 단가·무료·잘못된 수량을 구분하고 VAT 기준·제품명·포함 범위도 카드에서 읽는다. 타일·부자재에도 계산 근거를 표시하며 치수 오류 때 이전 부자재 금액을 지운다.
- hjBathPriceTarget·hjBathPriceChecklist는 선택한 항목의 빈 단가만 안내한다. 버튼은 접힌 설정을 열고 실제 입력칸으로 초점을 옮기며 선택 해제·오류·복원에 갱신한다. 단가 입력 완료를 견적 확정으로 표현하지 않는다.
- 모바일 견적은 같은 표를 항목별 카드로 표시하고 긴 제품명을 줄바꿈한다. 고객 HTML에도 반영하되 인쇄는 기존 표이며 계산 모델·저장 구조는 유지한다.
- 신규 브라우저 7/7·변이 5/5, 이전 9f7ac89의 의도한 존재 단언 실패, 욕실 관련 13개 파일·정적 17개 통과. 320/390/1280px와 고객 HTML·인쇄 확인. 최종 전체 회귀·CI는 비커밋 보고서 v410-선택견적개선.md에 기록한다.
- 첫 전체 회귀는 242/243으로 업무 전환 검사가 병렬·단독 모두 시간 초과했다. office-ops-conversion에서 로컬 앱과 명시한 Office/commercial mock을 제외한 외부 HTTP(S) 요청을 검사 환경에서 격리하고 실제 새로고침·단언·180초 기한은 유지했다. 보완 후 단독 통과했으며 첫 실패와 최종 전체 결과를 보고서에 구분한다.
- 두 번째 전체는 243/243이지만 기존 검사 2개가 재시도로만 통과했다. legacy-commercial-gate는 부팅 예약 저장과 buffer CAS fixture의 경합을 제어 재현하여 BOOT_QUIET에서 예약을 취소한 뒤 실제 writer 완료를 기다린다. 수정본은 재현·전체 파일 통과, 취소줄 제거는 의도한 CAS 단언 실패다. OfficeOps는 계측에서 실제 앱 50회 열기·22회 새로고침 누적이 확인되어 동일 43개 브라우저 시나리오를 conversion 16개·recovery 27개로 분할했다. VM 2종은 첫 entry에서 한 번 실행하며 완료 목록·개수·중복 검사와 pages-artifact 필수 목록으로 누락을 막는다. runner·제품·단언·기한·재시도 정책은 유지하고 최종 전체 집계는 244개다.
- hyeonjang-v410-bathroom 고정값과 main 미병합을 유지한다. 운영 배포·고객 발송·PC 종료는 하지 않는다.

## 2026-10-15 v410 미선택 입력·손상 초안 검증 개선

- 대표가 v410-출력보강.md의 질문 2건 개선을 요청했다. 미선택 공사·부자재의 빈값과 범위 밖 숫자는 원값으로 보관하되 계산·미정 단가 수에서 제외한다. 다시 선택하면 기존 필수값·범위·정수 검증을 적용한다. 기존 exclusions 검사도 이 승인된 정책으로 갱신했다.
- hjBathNumericInput은 모든 숫자 필드에서 Boolean·배열·객체·비유한 수와 숫자로 바꿀 수 없는 문자열을 선택 여부와 관계없이 거부한다. 정상 숫자 문자열·빈 단가·0원의 의미는 유지한다. 검증 실패한 초안은 확인창 전에 거부하여 현재 입력·사진·저장 원문을 보존한다.
- hjBathScopeAmount는 카드 예상 금액에도 동일한 검증을 적용한다. 잘못된 수량을 0원으로 보이지 않게 하고, hjBathInputValue는 복원한 정상 숫자 문자열을 실제 계산값으로 표시한다. 저장 키·필드 구조·계산식은 유지한다.
- 신규 단위 5/5(미선택 364건, 손상 값 1,836건, 강제변환 미호출 108건), 브라우저 6/6(손상 초안 29건), 변이 12/12 확인. 기준 efa902c에서는 새 검사 2개가 의도한 단언에서 실패한다. 전체 회귀·CI 결과는 비커밋 보고서 v410-입력검증개선.md에 기록한다.
- hyeonjang-v410-bathroom 고정값 유지. main 병합·운영 배포·PC 종료는 하지 않는다.

## 2026-10-15 v410 고객 전달 내용·사진 준비 순서 보강

- 상담 내용 복사에서 선택 품목의 수량·단위·제품명·포함 범위를 보존한다. 접착제·줄눈재 미선택도 공통 excluded 목록에 포함하고, 모두 선택하면 HTML·CSV·복사에 미포함 `없음`을 표시한다. 저장 필드 구조·계산은 유지하며, 미선택 입력 검증은 위의 후속 개선을 따른다.
- 사진을 준비하는 동안 hjBathPhotoControls가 고객 HTML·인쇄를 잠그고 준비 상태와 사진 빼기 버튼을 표시한다. 새 선택·복원·취소 뒤 늦은 사진 성공/실패는 이전 화면이나 알림을 덮지 않는다. 기존 HTML 생성이 끝나도 현재 사진의 준비 잠금은 유지한다.
- bathroom-exclusions-v410.unit.js, bathroom-output-v410.e2e.js, bathroom-photo-v410.e2e.js로 제품 세부 내용·제외 목록·비동기 순서를 검증한다. e25e00a에서는 새 검사 3개가 각각 의도한 단언에서 실패한다. 독립 20,000개 소수 계산 조합에서도 기존 계산과 일치함을 확인했다.
- 빌드 고정값 hyeonjang-v410-bathroom 유지. 최종 검사·변이·CI와 정책 질문은 비커밋 보고서 v410-출력보강.md에 기록한다. main 병합·운영 배포·PC 종료는 하지 않는다.

## 2026-10-15 v410 욕실 견적 정확도·전체 검사 안정성 보강

- 일부 소수 치수에서 시공비가 1원 적게 반올림되거나 올림 경계 직후의 타일 한 장이 빠졌다. bathroom-model.js는 계산 중에만 정수 분수를 사용하고 기존 저장·출력 자료형은 유지한다. 독립 정수 계산식으로 벽·바닥·부자재·선택 항목·VAT 2,500조합을 대조한다.
- 타일 규격·박스 입수를 직접 바꾸면 이전 제품 단가를 비우고 규격 선택 표시를 맞춘다. 같은 규격, 여유율과 고객 메모 변경은 단가를 보존한다. 고객 HTML 생성 중 입력을 수정해도 중복 생성을 막고 생성 시작 시점 내용과 파일 이름을 유지한다.
- photo-location은 긴 첫 묶음 뒤의 실제 지연 표시를 기다린다. legacy-commercial-gate는 빈 DB 시험 전에 남은 저장 시각도 비운다. office-ops-conversion은 시험용 페이지의 AI 부팅/정리 작업을 분리하고 기존 저장 보호 기대값과 실제 새로고침 검사는 유지한다. 세 문제는 원인을 되돌린 검사에서 실패하도록 고정 재현한다.
- APP_BUILD/SW/TARGET_BUILD는 hyeonjang-v410-bathroom 유지. 전체 회귀·변이 검증·CI 결과는 PR #177과 비커밋 보고서 v410-품질보강.md에 기록한다. main 병합·운영 배포·PC 종료는 하지 않는다.

## 2026-10-15 v410 욕실 고객 상담·선택 견적 (운영 main 기반 후보)

- PR #177 리뷰 수정: 일괄 공사 단위를 `1식(일괄) 가격`으로 화면·HTML·CSV·인쇄에 공통 표기하며 기존 단위/수량/금액은 보존한다. 참고 이미지는 1200×800 WebP 3장, 합계 173,418바이트로 교체하고 hero 외에는 지연 로딩한다. 원본 PNG는 사용자 지정 `hyeonjang_deploy/_원본이미지/v410/`에 해시 대조 후 보관했다. 견적서 안의 전화/문자 버튼과 인쇄 바닥글은 사용자 지정 영업번호 010-2397-8629를 쓴다. 빌드 고정값은 그대로이며 이번 지시는 main 병합·운영 배포·PC 종료를 금지한다.
- 욕실 공사 범위와 자재비·시공비를 고객이 함께 고르도록 bathroom.html 독립 상담 페이지와 견적 작성 화면의 새 탭 링크를 추가했다. PR #174 미병합 기능은 포함하지 않고 운영 main 003703f를 기준으로 한다.
- bathroom-model.js는 입력 치수로 타일 필요 장수·구매 박스·실구매 장수와 부자재 포장을 계산한다. 선택한 항목의 자재 판매단가·시공비만 합산하며 빈 단가(null)와 무료(0원)를 구분한다. 실제 단가가 제공되지 않아 기본 가격은 미입력이다.
- 부가세 포함/별도 기준을 화면·고객용 HTML·CSV·인쇄에 표시한다. 면적은 계산 전에 반올림하지 않고 단가는 원 단위 정수로 검증한다. 기기 초안은 명시적 저장이며 기존 앱 데이터·원가·백업에 접근하지 않는다. 사진은 메모리에서 재인코딩하며 초안 복원 시 이전 사진을 제거한다.
- 리뷰 수정 후 단위10/10, 기존 브라우저9/9, 리뷰 브라우저3/3, 보호 제거 변이12/12 탐지, 관련6/6 파일 통과. 320/390px 연락 버튼·선택 증감·입력 오류·HTML/CSV 보호·인쇄·기존 견적 초안 보존 검사와 읽기 전용 리뷰 완료. 전체 회귀 결과는 PR CI와 비커밋 보고서에서 확인한다. 이미지3장은 AI 참고 이미지로 실제 사례와 구분한다.
- 공개 산출물 허용목록에 새 상담 셸·참고 이미지만 추가했다. SW 캐시와 기존 직렬화 키는 확장하지 않는다. main 병합·고객 발송·운영 배포는 별도 승인 대상이다.

## 2026-10-14 v343-duplicatediscard 복구 보관 없는 중복 정리 (배포 전 후보)

- 사용자가 복구함 128MB 제한 해결을 위해 보관 없는 삭제 선택 기능을 요청했다. 운영 main v342에서 분기했으며 다른 개발 브랜치는 포함하지 않는다.
- 기존 복구 보관 삭제를 유지하고 별도 버튼과 최종 확인창을 추가한다. 명시적 recovery:false일 때만 새 복구 원본/기록과 용량 검사를 생략한다. 기존 복구함, PC/Drive 원본, removed_ids는 그대로 둔다.
- SHA-256 재검증, 작업 정보 일치, ID 보호, 목록 안전판, appState 원자 저장/CAS는 양쪽 경로에서 유지한다. 실패 후 보관 없는 삭제로 자동 전환하지 않는다. 재스캔으로 다시 나타날 수 있으며 복구함에서 이번 삭제를 되돌릴 수 없음을 알린다.
- photo-no-recovery.e2e.js와 5종 변이 검사가 용량/횟수, 기존 복구함, 원본 변경, 저장 실패/충돌, 확인/취소, 새로고침을 검증한다. 실제 사용자 사진 삭제와 운영 배포는 이 기능 구현에 포함하지 않는다.

## 2026-10-13 · v409 GPS 주소를 GPS 사진에만 저장

- `geocodeCluster`·`geocodeAllClusters`·`geocodeUpgradeClusters`는 주소를 사진 시간 묶음 전체에 쓰지 않고, 유효한 GPS 좌표가 있는 사진 레코드에만 저장한다. GPS 없는 사진의 기존 주소·빈 값은 보존한다.
- 버전 핀 `hyeonjang-v409-geoscope`. `geocode-label` 회귀 검사와 정적 검사 18개 통과(19/19).

## 2026-10-13 v342-photolocation 사진 위치 혼합 방지 (배포 승인)

- 사용자가 검증 결과 안내 후 "반영해줘"로 이 수정본의 브랜치 업로드·PR 검사·main 병합·GitHub Pages 배포를 승인했다. 실제 배포 완료는 해당 커밋의 PR/Pages 성공 및 공개 파일·화면 확인으로 별도 검증한다.

- 운영 main `ce3b80e`(v341) 기반의 독립 브랜치다. 기존 v342~v408 개발 브랜치를 포함하거나 병합하지 않았다.
- GPS 유무가 다르거나 알려진 현장 배정이 다르면 방문 묶음을 분리한다. GPS 없는 사진은 시간 기준 묶음으로 표시하고 확실한 위치·나머지 현장 추천에서 제외한다.
- 자동 주소 조회 3경로는 개별 GPS·거리·수동 건물명과 응답 시점의 현재 객체/좌표/주소/배정을 확인한다. 과거 주소는 삭제하지 않으며 사진 상세에 위치 미확인 저장 주소로 표시한다.
- 원본 파일·현장 배정·촬영일·공정·작업명·Drive ID·직렬화 구조는 변경하지 않는다. 파일명으로 실제 현장이나 촬영일을 자동 확정하지 않는다.
- 검증과 초기 검사 실패 이력은 `docs/photo-location-v342.md` 참조. 운영 데이터 수정·main 병합·배포는 수행하지 않았다.
## 2026-10-12 · v408 완료보고서 자동 채움

- 기간·작업 내용이 비고 사진 설명에 자동 파일명 숫자가 나오던 완료보고서를 hjReportDraft/hjReportPhotoGroups/rptPhotoCap으로 보완한다. 작업 사진의 한국 날짜·작업명별 장수·기존 공정과 기간을 읽기만 하며 폼의 수동 수정값을 유지한다.
- 사용자 결정에 따라 예시 기간 끝은 작업 사진의 08-25다. 정리 사진은 작업 내용과 대장에 남긴다. 작업명 정규화로 띄어쓰기 변형의 장수·날짜를 합치며 _worklabel이 빈 사진은 _phase 유무와 무관하게 채우기 안내에 포함한다.
- 신규8/8, v407변이1/8(기존 수동 폼 보존만 통과), 관련·정적25/25, pageerrors0, 읽기 전용 리뷰 통과. 실제 PDF는 만들지 않고 창·함수·전달 인수를 검사했다. 표지·확인란·파일명·6장 페이지 계산 유지. CI는 PR에서 확인.

## 2026-10-12 · v407 검토 고침 4

- 일괄 완료가 안전판 대기 중 바뀐 현장을 완료하던 문제를 hjStaleDonePlan과 hjProjectActionValid 재검증으로 차단한다. 객체·단계·유일 이름·준공일 근거·닫힌 창·연타를 확인한다.
- hjPhotoWorkPhases로 실제 공정 라벨만 추천과 파일 팔로업 제외의 증거로 사용한다. hjQuoteFollowDay는 실제 날짜를 검사하고 quoteFollowup은 무날짜 견적을 먼저 보여 편집기로 연결한다.
- hjNormName은 중간 아파트/apt도 지우고 단지 번호는 보존한다. 사진 기록의 날짜·현장 변경은 saveScheduleEdit에서 원래 출처를 메모에 남긴다. 아파트 등록 절차는 유지한다.
- 신규8/8, v406변이0/8, 관련·정적28/28 통과, 읽기 전용 리뷰 완료. 기존 검사 시드는 명확한 배관 작업으로, 무날짜 안내 기대는 새 문구로 갱신했다. CI는 PR에서 확인.

## 2026-10-12 v406 사진에서 공정 제안

- HJ_PHASE_MAP/hjPhasesFromPhotos는 작업 사진 수를 세고 탐사·정리·보양 및 기존 공정을 제외한다. hjPhaseHintHtml/행동 위임은 선택한 공정만 hjPhaseHintAdd→기존 addPhase로 추가한다. 모두 추가는 안전판·연타 차단·객체 재검증 후 순차 실행한다.
- 신규3/3, v405변이0/3, 관련·정적25/25 통과. 읽기 전용 최종·누적 리뷰 통과. 기존 객체형 phases 정규화·사진당 중복 집계 방지·기존 공정 유지도 검증. CI는 PR에서 확인.

## 2026-10-12 v405 사진 작업명 제안·빈 라벨 채우기

- hjWorkLabelOptions는 현장 최근→전체 빈도→HJ_WORK_DICT 순으로 제안한다. 사진 묶음 공유 datalist는 초점 이동 때 현장별 갱신, 아파트 작업명도 재사용한다. hjLabelGaps는 한국 날짜로 빈 사진 후보를 읽고 hjLabelGapView는 강제 안전판 뒤 여전히 빈 사진만 setWorkLabel로 채운다. 20장부터 오늘 챙길 일에 안내한다.
- 신규5/5, v404변이0/5, 관련·정적 최종28/28 파일 통과. 기존 apt-unit-assign의 현장만 제안 기대는 새 지시서의 전체 빈도·사전 확장에 맞춰 갱신했고 나머지 보호는 유지(7/7). 읽기 리뷰 통과. CI는 PR에서 확인.

## 2026-10-12 v404 현장 이름 자동완성·유사 경고

- hjProjNameList/hjNormName/hjSimilarProjects로 세 입력칸 후보와 유사 현장 선택을 추가했다. hjSimilarView에서 기존 열기·명시적 새로 생성, hjInquirySubmit/Create로 기존 현장 빈 고객 칸·문의 기록만 채운다. 더보기 prompt는 datalist가 있는 창으로 바꾸었다.
- 신규6/6, v403변이0/6, 관련·정적25/25(아파트 검사 포함) 통과, 읽기 리뷰 완료. 중간 아파트 단어 정규화 예시 충돌과 아파트 즉시 생성은 보고서 질문으로 보류하고 기존 동호수 안전 절차를 유지한다. CI는 PR에서 확인.

## 2026-10-12 v403 오늘 사진 작업 기록

- hjPhotoDayGroups/hjPhotoLogDraft로 사진을 현장별 일정·완료 보고 초안으로 읽는다. 오늘 마감 개별 편집과 hjPhotoLogAll 확인·안전판 저장을 연결했다. saveScheduleEdit는 명시적인 새 초안 report를 markDirty 전에 보존한다. AS 방문·수금·세금은 기존 작업 일정으로 치지 않는다.
- 신규4/4, v402변이0/4, 관련·정적27/27 파일 통과. 검토에서 제목형 AS 일정 제외를 추가하고 새 검사·문법을 재확인했다. 사진·workLogs 불변, 취소·안전판 실패·대기 중 중복 보호 검증. CI는 PR에서 확인.

## 2026-10-12 v402 검토 고침 3

- importData 권고 재진입을 hjImportDataPick으로 분리하고 적용 직전 안전판을 유지했다. hjCustFillView는 객체별 행과 저장 대기 후 값 비교로 중복 이름·동시 변경을 보호한다. hjEstFileLatest는 rows/future를 분리하고 매입·집계 제외, 종결 범위, 같은 날 대표 순위를 적용한다. 실제 노출 견적만 중복 제외하고 파일 뒤 작업 사진은 방치 추천을 막지 않는다.
- 미래 활동은 연락처 조회에서만 제외하며 U7/U8 배치·대비를 보완했다. custfill-v394 부팅·시더·저장 큐 대기를 적용. 신규13/13, v401변이0/13, 관련·정적32/32, 동시3×10회30/30, 읽기 리뷰 통과. F19 안전판 순서와 F15의 낡은 366일 조건은 보고서 질문으로 남긴다. CI는 PR에서 확인.

## 2026-10-12 v401 사진 작업명 메모리 필드 고침

- 저장 필드 이름을 읽던 hjAdPhotoUsable·staleProjectData doneHint·hjStaleWorkPhotos를 hjPhotoLabel로 통일했다. 추천 집계는 정리·청소 사진도 제외한다. 저장/복원 변환은 유지하고 실제 메모리 시드 5개를 교정했다.
- 신규 labelfield-v401 3/3, v400 변이 0/3(정리 제외·완료 힌트·작업 장수 모두 실패), 관련·정적 30/30 파일 통과. 읽기 전용 리뷰·diff 검사 완료. CI는 PR에서 확인.

## 2026-10-12 v400 불안정 검사 대기 조건 보완

- followup-v343·snapshot-restore-guard는 부팅 promise와 저장 큐 뒤 시더를 중립화한다. multi-tab-guard ③은 탭2 IDB 저장 전진·스탬프 일치 후 탭1 stale을 기다린다. 기존 가드/단언은 유지하고 실패 진단만 추가했다. 앱은 버전핀만 변경.
- Windows 동시3개 ×10회 총30/30, 정적18/18 통과. 복구 보호 변이5개·방송 제거 변이1개 모두 탐지. 검사만 변경하여 v399 앱에도 새 검사3개는 통과하며 기능 회귀 변이 대신 기존 보호 탐지력을 확인했다. 읽기 전용 리뷰와 diff 검사 통과. CI는 PR에서 확인.

## 2026-10-12 v399 다크모드 안내 대비 고침

- U1~U6의 고정 경고·정보·완료색과 카드 배경·테두리를 테마 변수로 바꾸었다. 기본 링크는 대시보드/광고만 어두운 모드 색을 보완하고 textarea도 기존 입력칸 배경과 맞췄다. 밝은 색은 유지한다.
- darkfix-v399 밝은/어두운 모드 12/12, v398 변이 밝은 6통과·어두운6실패. 실제 부모 배경 합성·요소 존재·opacity/gradient 검증, 모든 대상 대비4.5 이상. 관련·정적28/28와 읽기 전용 리뷰 통과. CI는 PR에서 확인.

## 2026-10-12 v398 검토 F1~F9·N1 고침

- quoteEditDirty 기본값 비교, hjQuoteFollowDay 한국 날짜 공유, hjQuoteHasContent 빈 견적 제외, 기간 상한 제거, quoteStatus 종결 우선, hjProjectActionValid 현장 객체 재검증을 추가했다. 수주율 분모·문의 문구·홍보 전체 집계·주소록 빈 이름 보존도 고쳤다.
- 신규 reviewfix-v398 10/10, v397 변이 0/10. 관련 20개·정적 18개 통과. F3의 365일 상한 제거에 맞춰 quote-flow·estfollow-v395의 건수/목록/버튼 기대를, F9에 맞춰 inqpending-v386 문구 기대를 변경했다. 날짜 기준 변경에 맞춰 행 표기도 작성·보냄으로 수정. 리뷰와 diff 검사 통과. CI는 PR에서 확인.

## 2026-10-12 v397 주소록 불러오기 중복 선언 정리

- 뒤 선언에 가려진 importPhoneContacts 앞 정의를 제거하고 contactsPickerSupported로 지원 판정을 공유한다. 실제 뒤 정의의 토스트·중복·취소 동작은 유지했다.
- 삭제 전후 contactimport-v397 3/3 동일 통과, dup-functions 정적 검사는 v396에서 importPhoneContacts 중복으로 실패하고 정리 후 통과. 관련·정적 23/23 파일과 읽기 전용 리뷰 통과. CI는 PR에서 확인.

## 2026-10-12 v396 방치 현장 추천 고르기

- 작업 사진이 있는 오래된 상담·실측 현장을 사람이 쉽게 고르도록 hjStaleWorkPhotos와 추천 체크 버튼을 추가했다. 사진 날짜가 견적일 이상이면 hjEstFileFollowData에서 제외한다. 완료 확인·안전판·준공일 흐름은 유지한다.
- 신규 stalepick-v396 4/4, v395 변이 0/4, 관련·정적 총 25/25 파일 통과. 읽기 전용 리뷰와 diff 검사 통과. CI는 PR에서 확인.

## 2026-10-12 v395 견적서 파일도 견적 팔로업에

- hjEstFileDay/hjEstFileLatest/hjEstFileFollowData로 현장별 최신 실제 파일 견적을 조회한다. hjEstFileFollowHtml/Wire와 quoteFollowup에 파일 묶음·문자·수주 단계·현장 estClosed 종결을 연결하고 hjProjOpenQuoteDay·hjDayCloseSales에 파일 기준을 반영했다. 견적 이력·수주 분석·회계 집계는 유지한다.
- 신규 estfollow-v395 5/5, v394 변이 0/5, 관련 10개·정적 17개 통과. 실제 f.when Date 객체 누락을 검토에서 찾아 수정하고 저장·복원 왕복 검사도 통과. 최종 리뷰·diff 검사 통과, CI는 PR에서 확인.

## 2026-10-12 v394 연락처 빈 최근 현장 모아 채우기

- hjCustMissing은 최근 활동/준공일로 연락처가 빈 현장 이름을 읽고, hjCustFillView는 번호 전체 검증 및 강제 안전판 성공 뒤 변경된 이름·연락처만 setCustomer로 저장한다. 빈칸은 유지한다. 대시보드 견적 대기 위와 데이터 검진에 진입 버튼을 추가했다.
- 신규 custfill-v394 6/6, v393 변이 0/6, 관련 7개·정적 17개 통과. 검토에서 발견한 오늘 시각 제외 문제는 현지 날짜 단위 비교로 수정하고 오늘/미래/90일 경계 검사를 통과했다. CI는 PR에서 확인.

## 2026-10-12 v393 주소록에서 고객 한 사람 고르기

- 현장 고객 번호를 손으로 옮기던 불편을 줄이기 위해 hjPickOneContact와 hjContactPickWire를 추가. 새 문의·고객 정보 창에 지원 기기 전용 버튼을 표시하고 선택 결과는 입력칸에만 채운다. 닫힌 창의 늦은 응답은 무시한다.
- 신규 contactpick-v393 4/4, v392 변이 1/4(새 동작 3개 실패), 관련 8개·정적 17개 통과. 복사본 Git 이력 미연결로 실패한 격리 검사는 읽기 전용 GIT_DIR/GIT_WORK_TREE 설정 후 통과. CI는 PR에서 확인.

## 2026-10-12 v392 답 기다리는 견적이 있는 현장은 '💤 방치'가 아니다 (Claude Cowork, v391 위 — PR 대기)

- v388 로 상담·실측 현장 견적이 팔로업 대상이 됐는데, 그 현장이 사진·일정이 14일 없으면 💤 방치 목록·대시보드 브리핑·AI '방치 현장 안부' 문자 제안·위험 리포트에도 같이 걸려 [✅ 완료로]·안부 문자를 권했다. 버전 핀 `hyeonjang-v392-stalequote`.
- `hjProjOpenQuoteDay(name)` — 이 현장에 붙은 진행 중 견적(`hjQuoteOpenForFollow` — 수주·종결 아님)의 작성일·보낸 날 중 가장 늦은 날. `staleProjectData` 가 그 날이 30일 안이면 그 현장을 뺀다(⏰ 견적 팔로업이 맡음), 넘었으면 행에 `openQuote`.
- 💤 방치 현장 창 줄에 `.stpQf` [⏰ 답 없는 견적 MM-DD](44px) → `quoteFollowup()`(30일 지난 견적은 거기서 종결). `projLastActivity` 는 그대로(준공일 제안에 쓰이므로 견적 날짜를 섞지 않음).
- 새 `tests/stalequote-v392.e2e.js` 2/2(v391 에서는 0/2). 관련 donemany-v381·donedate-v380·health-board·board-v351·brief-actions·quotelink-v388·reviewfix-v387·operations-review·mobile-more-tools·정적 검사 통과.

## 2026-10-12 v391 🌙 오늘 마감의 📞 영업 (Claude Cowork, v390 위 — PR 대기)

- 문의(v383·v386) → 견적(v389) → 팔로업(v388) 을 하루 끝에 한 번 더 보게. 버전 핀 `hyeonjang-v391-dcsales`.
- `hjDayCloseData().sales = hjDayCloseSales(today)` 순수 읽기 — inqToday(보관 아님·`inquiryAt === today`)·noSched(`hjInquiryPending`)·wait(`hjQuoteWaiting`)·follow(`quoteFollowupData().length`).
- `hjDayCloseView` 홍보 칸 뒤 `#dcSales` — h4 '📞 영업 — 오늘 받은 문의 N곳', 오늘 문의 이름, 📥 줄 + `[data-dc-inqsched]`, 🧾 줄 + `[data-dc-qwait]`(closeModal 뒤 `hjQuoteStartFor`), ⏰ 줄 + `[data-dc-qfollow]`(`quoteFollowup`). 넷 다 없으면 칸 없음. 앞 3곳 + '외 N곳'.
- `hjInquirySchedOpen(pj)` — v386 대시보드 `[data-inqsched]` 와 같이 씀(다음 작업일 10:00 '상담·실측: 현장').
- 새 `tests/dcsales-v391.e2e.js` 3/3(v390 에서는 1/3 — ③ '없으면 칸 없음'만 통과). 관련 dayclose-v359·inqpending-v386·quotewait-v389·quotelink-v388·adcase-v378·reviewfix-v387·matdue-v368·matplan-v373·crewclash-v362·정적 검사 통과.

## 2026-10-12 v390 🎉 수주 → 현장 단계 (Claude Cowork, v389 위 — PR 대기)

- 견적을 수주로 표시해도 붙은 현장이 상담·실측에 남아 📥 문의·💤 방치 목록에 계속 걸렸고 착공 전 체크도 안 열렸다. 버전 핀 `hyeonjang-v390-quotewon`.
- ⏰ 견적 팔로업 줄마다 `.qfWon` [🎉 수주](44px) → `hjQuoteWin(id,back)` — result 'won'·lost 지움·markDirty. `hjQuoteStageOffer(q,back)`: 붙은 현장이 보관 아님·stage ≤ 1 이면 '🎉 수주 — 현장' 창 [그대로 두기](back = 팔로업 창) / [🔨 시공으로 올리기](보통 `setStage(name,2)` — 착공 전 체크가 안 끝났으면 체크리스트 창). 현장 없는·시공 이상 현장 견적은 묻지 않고 back.
- 📄 견적 이력 `quoteMark(id,'won')` 도 수주로 켤 때만 같은 물음(back = 견적 이력). 풀 때는 안 묻는다.
- 새 `tests/quotewon-v390.e2e.js` 3/3(v389 에서는 0/3). 관련 quotelink-v388·quotewait-v389·quote-flow·quote-edit-safety·consultquote-v384·brief-actions·정적 검사 통과.

## 2026-10-12 v389 대시보드 '🧾 실측 끝, 견적 안 쓴 현장' + [🧾 견적 쓰기] (Claude Cowork, v388 위 — PR 대기)

- v384 '📐 상담·실측 끝' 창에서 [나중에]를 누르면 견적을 다시 떠올릴 곳이 없었다. 문의(v386 📥) → 견적(v389 🧾) → 팔로업(v388 ⏰) 으로 이어지게. 버전 핀 `hyeonjang-v389-quotewait`.
- `hjQuoteWaiting()` 순수 읽기 — 보관 아님·stage ≤ 1·이 현장 견적(state.quotes)·견적 파일(kind 'estimate') 없음, 그리고 (상담·실측 일정 `HJ_CONSULT_RE` 를 '완료'로 보고 또는 stage 1). 💰(`HJ_INQ_MONEY_RE`)·세금 자동·AS 방문 일정은 안 셈. 오늘 이후로 잡힌 안 끝난 상담·실측 일정이 있으면 아직 견적 차례가 아니다.
- 대시보드 '✅ 오늘 현장 업무' `#dashboardQuoteWaiting` — '🧾 실측 끝, 견적 안 쓴 현장 N곳 — 앞 3곳 (외)' + `[data-qwait]` [🧾 ○○ 견적 쓰기](44px). v386 문의 줄보다 위(문의 줄 바로 뒤가 버튼 줄 — inqpending-v386 의 '+ div button' 계약).
- `hjQuoteStartFor(name)` 로 v384 창 [🧾 견적서 쓰기] 를 뽑아 둘이 같이 씀 — 상담이면 실측으로, 현장·주소 채운 새 견적, v387 미저장 견적 보호 창 그대로. 클릭 위임 `closest(...)` 에 `[data-qwait]` 등록.
- 새 `tests/quotewait-v389.e2e.js` 3/3(v388 에서는 0/3). 관련 consultquote-v384·reviewfix-v387·inqpending-v386·inquiry-v383·quotelink-v388·quote-flow·quote-edit-safety·mobile-operations·dash-reports·health-board·board-v351·schcopy-v361·정적 검사 통과.

## 2026-10-12 v388 상담·실측 현장에 붙은 견적은 아직 '수주'가 아니다 (Claude Cowork, v387 위 — PR 대기)

- `quoteStatus` 는 '현장 연결 = 수주'였다. v383 새 문의·v384 상담 끝 → 견적 은 현장(상담·실측)을 먼저 만들고 견적을 붙이므로, 붙이자마자 수주로 세어 ⏰ 견적 팔로업에서 빠지고 수주 분석·퍼널 수주율이 부풀었다. 버전 핀 `hyeonjang-v388-quotelink`.
- `hjQuoteProjectEarly(q)` — 붙은 현장이 있고 보관이 아니며 stage ≤ 1(상담·실측)이면 true → `quoteStatus` 는 보냄/작성(진행 중). 현장을 못 찾거나(지운·옛 이름) 보관 현장이면 예전대로 수주. 현장이 시공(2) 이상이 되면 수주.
- 같은 판정 한 곳으로: `funnelData().quoteWon`(전엔 `q.project` 직접)·`similarQuotes` 가산(+5)도 `quoteStatus(q)==='won'`.
- ⏰ 견적 팔로업: 줄에 `.qfProj` '📂 현장 (단계)', `quoteFollowupData`/`quoteStaleData` 행에 `project`(이름만 — 번호는 싣지 않음). [📩 팔로업 문자 보내기]는 `hjQuoteFollowPhone(q)`(붙은 현장 고객 번호)로 받는 분을 채워 문자 앱을 연다(보내기는 휴대폰에서 직접). 버튼 높이 44px. 안내 문구 '시공 단계로 넘어가면(수주)'.
- 매출 집계(`hjSalesEntries`·현장 견적 = 매출 예정)는 그대로 — 회계 판정은 바꾸지 않았다.
- `tests/quote-flow.e2e.js` 시드에 '시공현장'(stage 2)을 더하고 q3 '수주 견적'을 거기 붙임(실측 현장 연결은 이제 진행 중). 새 `tests/quotelink-v388.e2e.js` 3/3(v387 에서는 0/3). 관련 brief-actions·quote-edit-safety·ui-feedback·dash-reports·consultquote-v384·reviewfix-v387·inquiry-v383·inqpending-v386·mobile-more-tools·정적 검사 통과.

## 2026-10-12 v387 GPT 코드 검토(v377~v386) 고침 — R1~R11 (Claude Cowork, v386 위 — PR 대기)

- Codex 가 `hyeonjang_deploy\review-v377-v386.md` 로 v377~v386 을 검토(Windows 전체 271/271·CI 271/271)하고 R1~R11 을 재현했다. 버전 핀 `hyeonjang-v387-reviewfix`.
- R1(P1) `hjConsultNextOffer` [🧾 견적서 쓰기] — `quoteEditDirty()` 면 '저장하지 않은 견적' 창(계속 편집 = 그 견적·단계 그대로 / 저장 안 하고 새 견적 / 저장하고 새 견적). 전에는 미저장 견적을 그대로 덮었다.
- R2 `hjDayCloseData().promo` = `hjAdCaseRows(14,999)` 에서 남은 곳을 먼저 거르고, 화면에서 4곳 + '외 N곳'. 전에는 4곳을 먼저 잘라 다섯 번째 남은 곳이 빠졌다.
- R3 새 문의 중복 알림을 번호(`dupFor` = 숫자만)에 묶음, `#inqPhone` input 이면 옛 알림을 지움.
- R4 문의 접수일 `p.inquiryAt`(새 문의·홈페이지 리드·카카오 문의) + 메모 첫 줄 '[문의 접수] YYYY-MM-DD'(`HJ_INQ_DATE_RE`)를 `projLastActivity` 에 — 방금 받은 문의가 바로 방치 현장에 들지 않음. toLocaleString 날짜는 파싱하지 않음.
- R5 일괄 완료 확인 창 '아래 준공일로' + 날짜마다 (이전 준공일/마지막 활동일/오늘), 토스트 '확인 창의 날짜'. R6 정리 사진만 있으면 '모두 정리·청소 사진이라 뺐어요' + [📂 사진 보기]. R7 홍보 도움말에 만물 웹(사례 내보내기·웹 게시 표시) 따로. R8 '문의 경로 입력 N곳 · 미입력 M곳'. R9 카카오맵 원고의 보양·정리 단정 → 대괄호 자리.
- R10 `hjInquiryPending` — 💰(`HJ_INQ_MONEY_RE`)·세금 자동·AS 방문 일정은 상담 일정으로 안 침. R11 `setStage` 가 현장을 못 찾으면 `__clPass` 를 지우고, `hjDoneDateView` 는 저장 때 현장을 다시 확인(없으면 멈춤).
- leadsrc-v379(문구)·donemany-v381(확인 창 문구) 검사 갱신. 새 `tests/reviewfix-v387.e2e.js` 7/7(v386 에서는 0/7). v377~v386 새 검사 10개·관련 16개·정적 검사 통과.
- 참고: Windows 전체 실행에서 multi-tab-guard·snapshot-restore-guard 가 동시 3 부하에서 한 번 실패 후 단독 재실행 통과(이번 변경과 무관한 파일, 대기 시간 경합 추정 — 아직 고치지 않음).

## 2026-10-12 v386 대시보드 [📞 새 문의 받기] · 상담 일정 안 잡힌 문의 (Claude Cowork, v385 위 — PR 대기)

- v383 새 문의 창은 더보기 안에만 있어 통화 중에 찾기 어려웠고, 문의를 받아 놓고 상담 일정을 안 잡은 곳이 보이지 않았다. 버전 핀 `hyeonjang-v386-inqpending`.
- 대시보드 '✅ 오늘 현장 업무' 버튼 줄 맨 앞 `#dashboardInquiryOpen` [📞 새 문의 받기]. 그 위 `hjInquiryPendingHtml()` — `hjInquiryPending()`: 상담 단계·보관 아님·고객 번호 있음·[문의 접수]/[홈페이지 상담 리드] 메모 또는 kakaoLead, 오늘 이후 일정 없음 → '📥 상담 일정 안 잡힌 문의 N곳' + 첫 곳 `[data-inqsched]` [🗓 일정 잡기](#view 클릭 위임 → 다음 작업일 10:00 상담·실측).
- `openScheduleEdit(id,draft,link)` 의 `link.title` — 미리 채운 새 일정이 '📄 일정 복사'로 보이지 않게(v383 문의 다음·v386 일정 잡기는 '🗓 상담·실측 일정'). inquiry-v383 검사에 제목 확인 추가.
- 새 `tests/inqpending-v386.e2e.js` 2/2(v385 에서는 0/2). 관련 mobile-operations·schcopy-v361·asvisit-v365·case-pack·dash-reports·consultquote-v384·inquiry-v383·정적 검사 통과.

## 2026-10-12 v385 '만물 웹' 홍보 칩 → 📰 사례 내보내기 · 웹 게시 표시 (Claude Cowork, v384 위 — PR 대기)

- v377 의 만물 웹 칩은 '사례 재료' 원고 창을 열었지만, 홈페이지 사례의 실제 길은 v321 📰 사례 내보내기(사진 선택·6항목·EXIF 제거 ZIP)다. 웹에 올린 뒤 ✓ 를 남길 곳도 없었다. 버전 핀 `hyeonjang-v385-casewebmark`.
- 클릭 위임 `data-adcase==='web'` → `casePackView(현장)`(광고 탭 🏁·현장 준공 관리 둘 다). 다른 채널은 그대로 원고 창.
- 사례 내보내기 바닥 버튼 `[🏠 웹 게시 표시]` → adPosts 에 {ch:'web', project, title:'사례: 동네+단지', memo:'사례 내보내기'} 한 번(`hjCaseWebPosted` — 이미 있으면 '🏠 웹 게시됨 ✓', 더 안 적음) → 🏁 홍보 현황 ✓.
- `tests/adcase-v378.e2e.js` ① 원고 칩을 web → naverplace 로(동작 바뀜). 새 `tests/caseweb-v385.e2e.js` 2/2(v384 에서는 0/2). 관련 case-pack·marketing-safety·photo-refs·adlocal-v377·mobile-more-tools·정적 검사 통과.

## 2026-10-12 v384 상담·실측 끝 → 견적 (Claude Cowork, v383 위 — PR 대기)

- 상담·실측을 다녀와 보고해도 견적은 견적 작성 탭에서 새로 시작해 현장을 다시 골라야 했고, 현장 단계는 '상담'에 그대로 남았다. 버전 핀 `hyeonjang-v384-consultquote`.
- `hjConsultNextOffer(s,back)` — 제목에 상담·실측(`HJ_CONSULT_RE`)이 든 일정을 진행률 '완료'로 보고(일정표 saveReport · 📋 내 업무 myWorkReport — v366 AS 마무리·v374 다음 공정 창 다음 순서)하고 현장이 상담·실측 단계면 '📐 상담·실측 끝' 창. [🧾 견적서 쓰기] = 상담이면 setStage(1)(`__clPass`), `state.editingQuote` 에 이 현장·제목·주소(place)를 채운 newQuote, 견적 작성 탭. [📐 실측 노트] = measureNote(현장). [나중에]는 아무것도 안 바꿈. 💰·AS 방문 제외.
- 새 `tests/consultquote-v384.e2e.js` 3/3(v383 에서는 0/3). 관련 handoff-v374·asclose-v366·asvisit-v365·delay-v347·quote-edit-safety·quote-flow·measure-note·calc-safety·dayclose-v359·mwmat-v370·정적 검사 통과.

## 2026-10-12 v383 📞 새 문의 받기 · 카카오 챗봇 문의 경로 (Claude Cowork, v382 위 — PR 대기)

- 전화·방문 문의는 현장 추가(이름만) → 고객 칸 → 메모 → 일정을 따로 해야 해서 통화 중 받아 적은 내용이 종이에 남았다. 버전 핀 `hyeonjang-v383-inquiry`.
- 더보기 '고객·영업' 맨 앞 `['inquiry','📞','새 문의 받기']` → `hjInquiryView()` — 고객 이름·연락처·지역(단지 = 현장 이름)·문의 내용·문의 경로. `hjInquiryCreate(d)` 가 현장(상담, 같은 이름이면 ' 2')·📇 연락처(같은 번호 없을 때, tag 고객)·메모 '[문의 접수] 날짜 · 경로'를 만들고, `hjInquiryNext` 에서 [🗓 상담·실측 일정](다음 작업일 10:00)·[📂 현장 열기]. 같은 번호 현장이 있으면 `#inqDup` 로 한 번 알리고 다시 누르면 등록. 이름·연락처 둘 다 없거나 번호가 짧으면 막음.
- `HJ_LEAD_SRC` 에 `kakaoch`(💬 카카오톡 채널), `kakaoLeadApply` 가 만드는 현장에 `leadSrc:'kakaoch'`.
- 더보기 메뉴 계약 125 → **126** — mobile-more-tools(TARGETS `inquiry:['hjInquiryView']`)·mobile-more-sweep·mobile-office-connect·board-v351 갱신. leadsrc-v379 보기 목록에 kakaoch.
- 새 `tests/inquiry-v383.e2e.js` 4/4(v382 에서는 0/4). 관련 메뉴 계약 4개·leadsrc-v379·leadweb-v382·dates-warranty-office·정적 검사 통과.

## 2026-10-12 v382 홈페이지 상담 리드 → 문의 경로 '만물 웹' (Claude Cowork, v381 위 — PR 대기)

- 홈페이지 상담(#lead=)으로 만든 현장은 문의 경로가 분명한데 v379 [문의 경로]가 비어 '모름'으로 셌다. 버전 핀 `hyeonjang-v382-leadweb`.
- `hjLeadCreate` 가 만드는 현장에 `leadSrc:'web'` — 광고 탭 📞 문의 경로·현장 화면 [문의 경로]에 바로 '🏠 만물 웹'. 리드 메모·고객 정보는 그대로.
- 새 `tests/leadweb-v382.e2e.js` 1/1(v381 에서는 0/1). 관련 privacy·leadsrc-v379·정적 검사 통과.

## 2026-10-12 v381 💤 방치 현장 여러 곳 한꺼번에 완료 (Claude Cowork, v380 위 — PR 대기)

- 끝났는데 '상담'에 멈춘 현장이 수십 곳이라 한 곳씩 [✅ 완료로]→날짜 창을 거치기 번거롭다. 버전 핀 `hyeonjang-v381-donemany`.
- 기록 있는 줄마다 `.stpChk` [한꺼번에 완료](빈 현장엔 없음), 사진 분류에 완료·완성·준공(`HJ_STALE_DONE_RE`)이 있으면 `.stpHint` "📷 '완료' 사진 있음". `#stpDoneMany` [✅ 고른 현장 완료 N곳] → confirm(현장 — 날짜 목록) → hjSnapshot → 각 현장 완료·준공일 = 내렸던 준공일 → 마지막 활동일 → 오늘(v380 과 같은 순서), 준공 체크 창은 건너뜀 → 방치 현장 창 다시 그림.
- 새 `tests/donemany-v381.e2e.js` 2/2(v380 에서는 0/2). 관련 donedate-v380·board-v351·health-board·정적 검사 통과.

## 2026-10-12 v380 💤 방치 현장 '✅ 완료로' → 준공일 고르기 (Claude Cowork, v379 위 — PR 대기)

- 2026-10-08 자료: 사진·작업이 끝난 현장 대부분이 '상담' 단계에 멈춰 있다. 방치 현장 창의 [✅ 완료로]는 setStage 를 바로 불러 누른 날(오늘)이 준공일이 되어, 한 달 전 끝난 현장의 보증·AS·홍보 기간이 오늘부터 셌다. 버전 핀 `hyeonjang-v380-donedate`.
- `hjDoneDateView(name,suggest,back)` — 준공일 칸(기본값: 내렸던 준공일 doneAtPrev → 마지막 활동일(사진·일정) → 오늘, 오늘 뒤 막음). [✅ 이 날짜로 완료] = `__clPass` 로 준공 체크 창을 건너뛰고 setStage(완료) 뒤 doneAt 을 고른 날로, doneAtPrev 지움 → 방치 현장 창으로 돌아감. [취소]는 아무것도 안 바꿈.
- 새 `tests/donedate-v380.e2e.js` 2/2(v379 에서는 0/2). 관련 board-v351·health-board·warranty-review·adcase-v378·watchdog·정적 검사 통과.

## 2026-10-12 v379 📞 문의 경로 → 광고 탭 채널별 문의 수 (Claude Cowork, v378 위 — PR 대기)

- 홍보 채널을 늘렸지만 '어느 채널이 실제 손님을 데려오나'는 게시 기록마다 📈 문의 수를 손으로 적어야만 보였다(기록 0건). 버전 핀 `hyeonjang-v379-leadsrc`.
- 현장(고객) 하나에 문의 경로 하나 — `p.leadSrc`(`HJ_LEAD_SRC`: 당근·네이버 지도·카카오맵·인스타·만물 웹·블로그·스레드·소개·다시 맡긴 고객·관리사무소·기타, 모르면 칸 없음). 현장 화면 👤 고객 정보 `select[data-leadsrc]`(view 'change' 위임 → `hjSetLeadSrc`)와 👤 빠른 입력 창 `#cqSrc`(경로만 골라도 저장).
- 광고 탭 `hjLeadSrcHtml()` — 보관 아닌 현장의 경로별 수(많은 순)·앎/모름(`hjLeadSrcStats`). 읽기 전용. 이름 바꾸기·지우기는 현장 안 칸이라 따라간다.
- 새 `tests/leadsrc-v379.e2e.js` 3/3(v378 에서는 0/3). 관련 quickinput-v344·adlocal-v377·adcase-v378·marketing-draft·uiux·mobile-friendly-ui·정적 검사 통과.

## 2026-10-12 v378 📣 사례 홍보를 현장 상세·오늘 마감·이름 바꾸기에 잇기 (Claude Cowork, v377 위 — PR 대기)

- v377 의 홍보 현황은 광고 탭에서만 보였고, 현장 이름을 바꾸거나 지우면 홍보 기록(adPosts.project)이 옛 이름에 남아 ✓ 가 사라졌다. 버전 핀 `hyeonjang-v378-adcase`.
- `hjProjectRefWalk`·`HJ_PROJECT_REF_LABELS`('홍보 기록')·`hjProjectTombstonesOf`·`hjTombBackupEvidence` 에 `adPosts` — 이름 바꾸기는 새 이름으로, 지우기는 '(삭제됨) 이름 · 날짜' 로 남기고 선택 복원이 다시 잇는다.
- 현장 상세 🎉 준공 관리 카드 안 `hjAdCaseLine(p)` — '📣 사례 홍보 ✓ 인스타·당근' + 남은 채널 `[data-adcase][data-adproj]` 버튼(그 현장·채널 원고). 준공 전 현장엔 없음. `hjAdCaseStatus(name)` 한 곳이 광고 탭 현황과 같이 쓴다.
- 🌙 오늘 마감 `d.promo` = 2주 안 완공 현장 중 남은 채널이 있는 곳 → '📣 완공 현장 홍보 — 안 올린 채널 N개'·남은 곳, `[data-dc-ads]` → 광고 탭. 읽기 전용.
- 새 `tests/adcase-v378.e2e.js` 4/4(v377 에서는 0/4). 관련 14개(adlocal-v377·dayclose-v359·delete-due·project-rename·v328-integration·warranty-review·photo-refs 등)·정적 검사 통과.

## 2026-10-12 v377 📣 지역 채널 원고 · 🏁 완공 현장 홍보 현황 (Claude Cowork, v376 위 — PR 대기)

- 대표가 최근 사례를 인스타·당근·네이버 지도·카카오맵·만물 웹에 올리려 할 때, 광고 탭에는 스레드·인스타·메타·블로그만 있어 지역 채널 원고를 매번 손으로 썼고, 어느 현장을 어디까지 올렸는지 볼 곳이 없었다. 버전 핀 `hyeonjang-v377-adlocal`.
- `AD_CH` 에 당근(`daangn`)·네이버 지도(`naverplace`)·카카오맵(`kakaomap`) — `local:true` — 와 만물 웹(`web`)을 더함(칩 8개). `adDraftText` 지역 갈래: 짧은 '소식'(작업 전·한 일·마무리 + 상담 안내, 회사 전화, 가격·보증 기간·고객 정보 없음). 만물 웹은 사례 담당(GPT·Claude)에게 넘길 '사례 재료' 6줄.
- 광고 탭 맨 위 `hjAdCaseHtml()` — 60일 안 완공(doneAt, 보관 제외) 최근 4곳마다 다섯 채널(`HJ_AD_CASE_CH` 인스타·당근·네이버 지도·카카오맵·만물 웹) 중 올린 곳 ✓·남은 칩. 남은 칩 `[data-adcase][data-adproj]` → `adDraftOpen(ch, 현장)`. 원고 창 [게시 기록에 추가]·[＋ 게시 기록](현장 선택 `#adProj`)이 기록 안에 `project` 를 남김(최상위 키 변화 없음, 현장 안 고르면 칸 없음).
- 원고 창 사진 수는 '정리·청소' 분류 사진(`HJ_AD_SKIP_PHOTO_RE`)을 뺀다 — 대표 지시(2026-10-11, 홍보 사진에서 정리 사진 제외).
- 새 `tests/adlocal-v377.e2e.js` 4/4(v376 에서는 0/4). 관련 marketing-draft·marketing-safety·health-board·mobile-more-tools·mobile-more-sweep·office-ops-conversion·정적 검사 통과.

## 2026-10-10 v376 현장 AS 카드 줄 배치 (Claude Cowork, v375 위 — PR 대기)

- v367 패치가 PC 에 두 번 고쳐 올라가는 사이 Codex 가 앞선 판을 적용해, 현장 화면 AS 카드 줄 배치 고침이 PR 에 빠졌다(390px 폰에서 📅·✏️·상태·🗑 버튼 4개가 글 칸을 한 글자 폭으로 밀어 '욕/실/실/리…'로 꺾였다). 버전 핀 `hyeonjang-v376-ascard`.
- 카드 줄 `.asCardRow` flex-wrap, 글 칸 `flex:1 1 160px`, 버튼들을 `.asCardCtl` 한 묶음(margin-left:auto, flex-wrap) — 좁으면 버튼 묶음이 글 아래 줄로 내려간다. `tests/asview-v367.e2e.js` ② 에 글 칸 150px 이상·줄 4개 검사를 되살림. 저장 칸 변화 없음.

## 2026-10-10 v375 👷 팀원 주간 현황 (Claude Cowork, v374 위 — PR 대기)

- 일정표·달력은 날짜별이라 '이번 주 김타일은 며칠·어디, 비는 날은'을 사람 기준으로 보려면 하루씩 넘겨 봐야 했다. 버전 핀 `hyeonjang-v375-crewweek`. 저장 없음(읽기 전용).
- `hjCrewWeekData(kind)` — `hjSchShareRange('week'|'nextweek')` 월~일, 사람 = 👷 팀원 연락처(`hjTeamContacts`) + 그 주 일정 담당 이름. 사람마다 `hjSchShareDays(from,to,'',null,name)`(그날 시작하는 것 먼저, 여러 날 공정의 이어지는 날 포함, 💰·세금 자동 제외 — v356 규칙) → byDate·work(일한 날 수)·sites·empty(월~토 빈 날)·clashDates(`scheduleConflicts().crewClashes`). noCrew = 담당 없는 일정 수.
- `hjCrewWeekView(kind,back)` '👷 팀원 주간 현황' `#crewWeek`: [이번 주]/[다음 주] `.cwRange`, 사람 카드 `.cwPerson`(요약 `.cwSum`, 겹침 `.cwClash`, 7칸 `.cwCell`/`.cwJob`, 팀원 연락처 없음 표시), 일한 날이 있으면 `.cwShare` [📤 이름 일정 보내기] → `hjSchShareView({kind,crew,back})`.
- 더보기 '현장·시공' `['crewweek','👷','팀원 주간 현황']` → **메뉴 계약 124 → 125**(mobile-more-tools·mobile-more-sweep·mobile-office-connect·board-v351 갱신).
- 새 `tests/crewweek-v375.e2e.js` 3/3(v374 에서는 0/3). 메뉴 계약 4개 + 관련 6개(schshare-v356·percrew-v360·crewclash-v362·crew-v357·uiux·mobile-friendly-ui)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v374 공정 완료 → 다음 공정 담당에게 알리기 (Claude Cowork, v373 위 — PR 대기)

- 한 공정이 끝나면 다음 공정 팀에게 '끝났으니 예정대로'·전달 사항을 따로 전화·문자로 알렸다. 버전 핀 `hyeonjang-v374-handoff`. 새 최상위 키 없음 — 끝난 일정에 `handoffAt`(보낸 날)만.
- `hjHandoffNext(s)` — 같은 현장, 완료 보고 전, 세금 자동·AS 방문·`HJ_PLAN_SKIP_RE`(💰·AS 방문·상담·실측) 제외, s 뒤(날짜가 뒤거나 같은 날 더 늦은 시간) 중 가장 이른 일정. s 가 상담·실측·💰·AS 면 null. `hjHandoffText(s,n)` — 끝난 공정·다음 날짜/시간/이름·주소(`hjSchShareAddr`)·전달 사항(보고 `issue`). 고객 이름·전화 없음.
- `hjHandoffOffer(s,back)` — 보고 진행률 '완료'이고 다음 공정이 있으면 '🔨 다음 공정에 알리기' 창 `#handoff`/`#hoText`: 다음 공정 담당의 👷 팀원 번호(`hjCrewPhone`)가 있으면 [✉️ 담당에게 문자](`hjSmsGo(hjSmsUrl(phones,text))`)·[💬 카톡], 없으면 [💬 카톡]·[📋 복사](`coworkCopy`)·[나중에]. 보내면 `s.handoffAt = 오늘`. 자동 발송 없음.
- 입구: `saveReport`(→ `if(!hjAsCloseOffer(s))hjHandoffOffer(s)`) · `myWorkReport`(AS 마무리 → 다음 공정 → 내 업무 순). AS 방문 일정은 AS 마무리 창(v366)이 먼저.
- 새 `tests/handoff-v374.e2e.js` 4/4(v373 에서는 0/4). 관련 13개(asclose-v366·asvisit-v365·my-work·dayclose-v359·delay-v347·mobile-operations·watch-card·multiday-v354·matissue-v372·mwmat-v370·schedule-safety·crew-v357·v331-follow)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v373 발주 점검 (Claude Cowork, v372 위 — PR 대기)

- 자재를 쓰는 공정이 다가오는데 발주를 했는지는 기억에 맡겼다. 버전 핀 `hyeonjang-v373-matplan`. 새 최상위 키 없음 — 일정 레코드 안 `matNone`(자재 없음 표시)만.
- `HJ_MAT_TRADE_RE`(타일·도배·벽지·마루·장판·바닥재·목공·몰딩·도장·페인트·설비·욕실·주방·싱크·조명·창호·샷시·섀시·필름·방수·중문·가구·도어) · `hjMatPlanRows(project,days=7)` = 오늘~+7일에 시작하는 그런 일정 중 이은 납품(`o.schId`) 없음 — `hjMatSchOk` 밖(💰·AS·세금)·완료 보고·`matNone` 제외.
- 🚚 납품 확인 창: '📋 발주 점검' 칩(있을 때만)·칸 `.mpRow` — `.mpAdd` [🚚 납품 예정](`hjMatEdit(null,{project,schId,back})`)·`.mpNone` [자재 없음](그 일정 `matNone = true`). 🌙 오늘 마감 `d.matPlan` → `[data-dc-matplan]` 줄(납품 칸은 미입고나 발주 점검이 있을 때).
- 새 `tests/matplan-v373.e2e.js` 3/3(v372 에서는 0/3). 관련 12개(dayclose-v359·matdue-v368·matsched-v369·mwmat-v370·matask-v371·matissue-v372·my-work·schcopy-v361·uiux·mobile-friendly-ui·crewclash-v362·mobile-more-sweep)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v372 입고 문제 → 교환·추가 납품 (Claude Cowork, v371 위 — PR 대기)

- 받은 자재가 파손·부족·다른 물건이어도 '입고 ✅'로 끝나 기록이 없었고 교환 요청은 기억에 맡겼다. 버전 핀 `hyeonjang-v372-matissue`. 새 최상위 키 없음 — 납품 기록에 `issue`(문제 글)·`issueAt`·`issueDone`.
- `hjMatState` — `recvAt` 있고 `issue` 있고 `issueDone` 없으면 `{k:'issue', t:'⚠ 입고 문제 — …'}`. `HJ_MAT_RANK` late 0 · **issue 1** · today 2 · soon 3 · nodate 4 · recv 5. `hjMatAskText` issue 문안 '받은 자재에 문제가 있습니다: … / 교환·추가 납품 일정을 알려 주세요'.
- `hjMatIssueSave(id,text)`(입고 안 됐으면 오늘로 입고 + 문제, issueDone 지움) · `hjMatIssueDone(id)` · `hjMatIssueView(id,back)` '⚠ 자재 문제' 창(`#miText` — 빈 글 막음, [📷 입고 사진] = `hjMyWorkPhoto(현장,'자재 입고 거래처')`).
- 입구·표시: 📋 내 업무 받을 자재 카드 `[data-mw-matissue]` [⚠ 문제 있음] · 🚚 납품 확인 창 '⚠ 문제' 칩(있을 때만), 문제 줄 `.mdFix` [✅ 해결]·`.mdAsk`·`.mdIssue`, 해결된 입고 줄 '입고 문제 해결 날짜' · 고치기 창 `#meIssue`(받은 기록만, 글이 바뀌면 issueAt 새로·issueDone 지움, 비우면 셋 다 삭제) · 🔔 `briefExtraItems` '자재 입고 문제 N건'(action matdue) · 현장 칸 머리 '· 문제 N건', 문제 줄 `[data-matask]`·`[data-matfix]` [✅ 해결](위임 등록).
- 새 `tests/matissue-v372.e2e.js` 5/5(v371 에서는 0/5). 관련 12개(matdue-v368·matsched-v369·mwmat-v370·matask-v371·my-work·dayclose-v359·brief-actions·pjsched-v364·uiux·mobile-friendly-ui·mobile-operations·order-materials)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v371 늦은 납품 → 거래처 확인 문자·전화 (Claude Cowork, v370 위 — PR 대기)

- 납품일이 지났거나 오늘인데 안 들어오면 거래처 번호를 따로 찾아 전화·문자를 했다. 버전 핀 `hyeonjang-v371-matask`. 새 최상위 키 없음 — 납품 기록에 `askedAt`(마지막 문의일), 📇 `state.suppliers` 에 번호 기억(기존 칸).
- `hjMatAskText(p,o)` 상황별 문안(late·today·soon·nodate — 거래처·현장·주소·품목, 고객 이름·전화 없음). `hjMatAsk(id,back)` '📞 거래처 확인' 창: `#maPhone`(`hjMatSupPhone` — 📇 거래처 번호), `#maText` → [✉️ 확인 문자](`hjSendSms`)·[📞 전화](`hjTelGo` — 번호 없으면 막음)·[← 뒤로]. 누르면 그 기록 `askedAt = 오늘`, 번호가 바뀌었으면 거래처 갱신, 없던 거래처는 추가(`matSupplierUrl` 쇼핑몰 제외). 자동 발송 없음.
- 입구: 🚚 납품 확인 창 줄 `.mdAsk` 📞(입고 전만, 줄에 `.mdAsked` '📨 11/5(목) 문의') · 현장 '🚚 자재 납품' 칸 `[data-matask]`(지남·오늘 줄만, 위임 등록).
- 새 `tests/matask-v371.e2e.js` 4/4(v370 에서는 0/4). 관련 15개(matdue-v368·matsched-v369·mwmat-v370·order-materials·recv-entry·uiux·mobile-friendly-ui·pjsched-v364·dayclose-v359·brief-actions·calc-flow·calc-safety·ledger-roundtrip·materials·privacy)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v370 현장에서 자재 받기 (Claude Cowork, v369 위 — PR 대기)

- 자재는 현장에 있는 팀원이 받는데 입고 확인은 대표가 사무실 화면에서만 눌렀고, 팀 공유 글에는 그날 자재가 들어온다는 말이 없었다. 버전 핀 `hyeonjang-v370-mwmat`. 새 저장 칸 없음.
- `hjMatDueOn(projects,ymd,withLate)` — 그 현장들의 미입고 중 납품일 = ymd(withLate 면 ≤ ymd). 📋 내 업무(`myWorkView`)에 오늘 일정 현장(`hjMyWorkSchedules(today)`)의 오늘·지난 미입고를 '🚚 오늘 받을 자재 N' 카드 `[data-mw-mat]` + `[data-mw-matrecv]` [✅ 받았어요](→ `hjMatReceive(id,true)` 그 기록 recvAt 만, `myWorkView({refresh:false})`). 받을 게 없거나 오늘 일정이 없으면 칸 없음.
- 📤 팀 일정 공유 글(`hjSchShareText`) — 날마다 일정 줄 뒤에 `hjMatShareLines(day,today)` '  🚚 자재 도착 예정 — 현장: 거래처 · 품목'(그날 일정 현장의 그날 납품, 그날이 오늘이면 지난 미입고도 '(지난 납품, 아직 입고 확인 안 됨)'). 담당별·현장별 좁히기를 그대로 따른다. 고객용 글(`hjCustSchedText`)·캘린더 파일에는 넣지 않는다.
- 새 `tests/mwmat-v370.e2e.js` 4/4(v369 에서는 2/4 — 칸 없음·저장본 불변은 원래도 참). 관련 16개(my-work·schshare-v356·percrew-v360·custsched-v363·mobile-operations·dayclose-v359·matdue-v368·matsched-v369·crew-v357·multiday-v354·uiux·mobile-friendly-ui·watch-card·schcopy-v361·crewclash-v362·brief-actions)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v369 공정 일정 ↔ 자재 납품 (Claude Cowork, v368 위 — PR 대기)

- 공정 날 아침에야 '자재가 안 왔다'를 알았다. 그 일정에 쓸 자재가 아직 입고 확인 안 됐으면 일정 줄에 '🚚 미입고 N'. 버전 핀 `hyeonjang-v369-matsched`. 새 최상위 키 없음 — 납품 기록에 선택 칸 `o.schId`(공정 잇기)만 더한다.
- `hjMatForSched(s,ymd)` = 같은 현장 미입고 중 (`o.schId === s.id`) 또는 (안 이었거나 이은 일정이 지워졌고 `due ≤ max(s.date, ymd)`). 다른 일정에 이은 것·날짜 미정 제외. `hjMatSchOk` — 💰 수금·AS 방문(`hjIsAsVisitSched`)·세금 자동·현장 없는 일정은 보지 않는다. `hjMatBadge(s,ymd)` → `[data-matwarn]` '🚚 미입고 N'(title 에 거래처·품목).
- 표시: 📋 내 업무 카드 `.mwMeta`(완료 보고 전만) · 대시보드 오늘/다가오는 일정 칩(루틴 제외) · 🌙 오늘 마감 내일 일정 줄 · 현장 '🗓 이 현장 일정' 줄. 모두 읽기 전용.
- 잇기: 일정 ⋯ `schMoreView` 에 `data-act="mat"` [🚚 이 공정 자재 납품 예정](현장 일정만, 설명에 '이은 납품 N건 · 미입고 M건') → `hjMatEdit(null,{project,schId})` — 예정일 기본 = `hjMatDueFor`(공정 전 작업일, 오늘보다 앞이면 오늘). `hjMatEdit` 에 `#meSch` '어느 공정용 (선택)'(`hjMatSchOptions` — 그 현장의 보고 전·끝나는 날 오늘 이후 일정), 고르면 손대지 않은 예정일만 그 공정 전 작업일로. 비우면 `schId` 삭제. 🚚 납품 확인 창 줄에 `.mdSch` '🔨 도배 11/10(화)용'.
- 일정 ⋯ 메뉴 계약이 바뀌어 schcopy-v361·schshare-v356 의 메뉴 목록 검사에 'mat' 추가.
- 새 `tests/matsched-v369.e2e.js` 5/5(v368 에서는 1/5 — ⑤ 저장본 불변은 원래도 참). 관련 20개(dayclose-v359·my-work·matdue-v368·pjsched-v364·dash-reports·brief-actions·schcopy-v361·schshare-v356·crew-v357·crewclash-v362·schedule-safety·mobile-operations·watch-card·uiux·mobile-friendly-ui·multiday-v354·custsched-v363·asvisit-v365·mobile-more-sweep)·정적 검사 통과(별도 포트 사본).

## 2026-10-10 v368 🚚 자재 발주 → 납품 확인 (Claude Cowork, v367 위 — PR 대기)

- 발주 문자는 만들었지만 보낸 발주가 언제 들어오는지·들어왔는지 기록이 없어, 공정 날 아침에 '타일 왔나?'를 전화로 확인했다. 버전 핀 `hyeonjang-v368-matdue`. 새 최상위 키 없음 — 현장 레코드 안 `p.matOrders`(workOrders 와 같은 방식, `projectBackupSafe` 로 그대로 저장, `portalBuild` 는 고른 칸만이라 고객 페이지에 안 실림).
- 기록: `{id, sup, items:[{name,spec,qty,unit}], due 납품 예정일, at 발주일, recvAt 입고 확인일('' = 미입고), memo}`. `hjMatRecord(project,{sup,items,due,memo})` — 같은 거래처·날짜·품목의 미입고 기록이 있으면 새로 만들지 않고 `{dup:true}`. `hjMatReceive(id,on)` 입고 확인/취소(오늘 날짜). `hjMatState` → late/today/soon(D-n)/nodate/recv, `hjMatAll(project)` 그 순서로 정렬, `hjMatPending(limit)` 미입고·납품일 ≤ limit. 품목 줄 `HJ_MAT_LINE_RE`('이름 × 수량단위').
- 입구: 📦 발주 문자 화면 카드 `.moRec` [🚚 납품 확인에 올리기](현장 있는 묶음만 — 작업실 재고 발주는 버튼 없음) · 현장 화면 `[data-pjmat]` 칸(기록이 있거나 시공 단계, 기다림 4줄 + `[data-matrecv]` ✅ 입고·`[data-matadd]`·`[data-matview]`, 위임 등록) · `hjMatView(project?,back?)` 창(칩 지남/오늘/예정/미정, `.mdRecv`·`.mdUndo`·`.mdEdit`, + 추가) · `hjMatEdit(id|null,{project,back})`(고치기·🗑 삭제·추가, 거래처나 품목 없으면 저장 안 함) · 🔔 `briefExtraItems` '🚚 납품 확인 N건 · 지남 M건'(action `matdue`) · 🌙 오늘 마감 `d.mat`(내일까지 미입고) + `[data-dc-mat]` · 더보기 '현장·시공' `['matdue','🚚','납품 확인']` → **메뉴 계약 123 → 124**(mobile-more-tools·mobile-more-sweep·mobile-office-connect·board-v351 갱신). 자동 발송 없음.
- 새 `tests/matdue-v368.e2e.js` 6/6(v367 에서는 0/6). 메뉴 계약 4개 + 관련 20개(action-search·asview-v367·brief-actions·calc-safety·crewclash-v362·dayclose-v359·order-materials·recv-entry·site-bom·pjsched-v364·as-record·project-rename·apartment-units·apartment-manage·uiux·mobile-friendly-ui·completion-links·health-board·dash-reports·v219-operations)·정적 검사 통과(별도 포트 사본).
- 검사 방식 변경(대표와 합의 2026-10-10): Codex 는 버전마다 새 검사 + 관련 검사 + 정적 검사만 돌리고 push. 전체 검사는 GitHub CI(push 마다 자동)와 Claude 컨테이너가 맡고, Windows 전체 검사는 병합 직전에 한 번.

## 2026-10-09 v367 AS 방문 일정 한눈에 (Claude Cowork, v366 위 — PR 대기)

- AS 기록에는 '방문 2026-11-06' 날짜만 보여 시간·담당·보고 여부는 일정표에서 찾아야 했고, 방문을 아직 안 잡은 AS 가 묻혔다. 버전 핀 `hyeonjang-v367-asview`. 저장 없음(읽기 전용).
- `hjAsVisitSched(a)`(visitSchedId 가 지금 일정에 있을 때만)·`hjAsVisitLine(a)` → 있으면 `{kind:'set'}` '📅 11/6(금) 10:00 · 👤 김타일'(담당 없으면 '· 담당 미정', 보고 글/진행률 있으면 '· 📋 보고됨'), 없으면 완료 전 AS 만 `{kind:'none'}` '📅 방문 일정 미정'(방문일만 있으면 '11/12(목) — 시간·담당 미정'), 완료 AS 는 null. 지워진 일정을 가리키면 미정. `hjAsUnscheduled(list)`.
- 🔧 AS 관리: 줄마다 `.asmVisitLine`, 머리 칸 '방문 미정 N건'. 현장 화면 AS 카드: `.asCardVisit` + 완료 전 AS 에 `[data-asvisit]` 📅(→ `hjAsVisitPlan`, 위임 셀렉터·핸들러 등록). 카드 줄 `.asCardRow` 는 flex-wrap, 버튼들은 `.asCardCtl` 한 묶음으로 — 390px 폰에서 버튼 4개가 글 칸을 한 글자 폭으로 밀던 것을 막는다(글 칸 150px 이상 검사). 대시보드 `briefExtraItems` '미처리 AS N건 · 방문 미정 M건'. 방문 줄이 보이는 기록은 `hjAsSummary` 에서 '방문 날짜'를 빼서 두 번 쓰지 않는다(방문 줄 없는 완료 AS 는 그대로).
- 새 `tests/asview-v367.e2e.js` 4/4(v366 에서는 1/4 — ④ 저장본 불변은 원래도 참). 관련 17개(as-record·health-board·dates-warranty-office·project-rename·completion-links·warranty-link·brief-actions·dash-reports·asvisit-v365·asclose-v366·uiux·mobile-friendly-ui·pjsched-v364·custsched-v363·v331-follow·delete-guard·watch-card)·정적 검사 통과(별도 포트 사본).

## 2026-10-09 v366 AS 방문 보고 → AS 기록 마무리 (Claude Cowork, v365 위 — PR 대기)

- AS 방문 일정에 작업 보고를 저장해도 AS 기록은 '접수' 그대로라, 처리 내용·사진·완료를 🔧 AS 관리에서 다시 적고 고객 완료 안내도 따로 썼다. 버전 핀 `hyeonjang-v366-asclose`. 새 최상위 키 없음(AS 기록의 `status`·`fix`·`photos` 는 v329 칸).
- `hjAsForSched(s)` = `s.asId` 의 AS, 없으면 `visitSchedId === s.id` 인 AS(v331 옛 방문 일정). `hjAsCloseOffer(s,back)`: 그 AS 가 완료 전이고 보고에 글/진행률이 있으면 '🔧 AS 기록 마무리' 창 — `#acFix`(이미 적힌 `fix`, 없으면 보고 글)·`#acPhotos`(그날 `reportPhotos(s)` 중 아직 연결 안 된 사진을 `hjFileRef` 로, 기본 체크) → [✅ AS 완료로 저장](status done)·[처리중으로 저장](doing)·[나중에](아무것도 안 바꿈). 누르는 순간 AS 가 바뀌었으면(다른 곳에서 완료 등) 저장하지 않는다.
- 완료로 저장하면 `hjAsDoneAfter` '✅ AS 완료 — 고객 안내': `#adText`(`hjAsDoneText` — 방문 날짜·처리 내용, 고쳐서 보냄) → [✉️ 고객에게 완료 안내](`hjSendSms`, 연락처 없으면 [📋 완료 안내 글 복사])·[🔧 AS 관리]·[닫기]. 자동 발송 없음.
- 입구 두 곳: `saveReport`(일정표 📋 일일 작업 보고, 이미지/PDF 로 저장할 때는 묻지 않음)·`myWorkReport`(내 업무 ✅ 완료 보고 — 끝나면 `myWorkView` 로 돌아감).
- 새 `tests/asclose-v366.e2e.js` 5/5(v365 에서는 0/5). 관련 13개(as-record·asvisit-v365·v331-follow·dayclose-v359·delay-v347·mobile-operations·multiday-v354·my-work·watch-card·health-board·ui-feedback·delete-guard·schedule-safety)·정적 검사 통과(별도 포트 사본). ui-feedback 은 병렬 실행에서 토스트 시간 한 번 흔들림 → 단독 통과.

## 2026-10-09 v365 AS 접수 → 방문 일정·담당 한 번에 (Claude Cowork, v364 위 — PR 대기)

- AS 를 접수하고 방문일을 넣으면 '일정에도 올릴까요?'로 시간·담당 없는 일정만 생겼고, 시간·담당·고객 안내·작업지시는 각각 다른 화면에서 했다. 버전 핀 `hyeonjang-v365-asvisit`. 새 최상위 키 없음(일정 `asId`·AS `visitSchedId`·`visitAt` 은 v331 부터 있던 필드).
- AS 기록 펼침에 `.asmVisit` [📅 방문 일정 잡기/고치기 (날짜·시간·담당)] → `hjAsVisitPlan(asId)`: 이어진 일정이 있으면 `openScheduleEdit(id,null,{asId})`, 없으면 초안(방문일 또는 다음 작업일 `hjShiftWorkDays`·10:00·2시간·'🔧 AS 방문: …'·현장·'AS 접수 날짜 — 증상' 메모)으로 연다. 창 제목 '🔧 AS 방문 일정' — 담당 칩·그날 겹침(v355/v362)이 그대로 붙는다.
- `openScheduleEdit(id,draft,link)`·`saveScheduleEdit(id,isNew,link)`: link.asId 면 새 일정에 `asId`, AS 에 `visitSchedId`, 저장 뒤 `visitAt = 일정 날짜`(v331 날짜 따라가기 다음에 맞춘다). 저장 뒤 `hjAsVisitAfter` 창 '🔧 AS 방문 — 다음 할 일': `#avText`(고객 방문 안내 글 `hjAsVisitText` — 주소·담당 없음, 고쳐서 보냄) → [✉️ 고객에게 방문 안내](`hjSendSms`, 연락처 없으면 [📋 방문 안내 글 복사])·[📋 담당에게 작업지시](`openWorkOrder({schId})` — v357 담당 번호 자동)·[🔧 AS 관리]·[닫기]. 자동 발송 없음.
- `hjCascadeCands` 는 `s.asId` 인 일정을 옮겨도 뒤 공정을 밀자고 묻지 않는다(제목을 'AS 방문' 아닌 것으로 고쳐도). AS 접수 `#asmAdd` 뒤 `asManage(새 id)`로 새 기록을 펼친다.
- 새 `tests/asvisit-v365.e2e.js` 6/6(v364 에서는 0/6). 관련 26개(as-record·v331-follow·ui-feedback·contract-terms·delete-guard·delete-due·restore-delete-safety·health-board·cascade-v353·multiday-v354·dayinfo-v355·schshare-v356·crew-v357·dayclose-v359·percrew-v360·schcopy-v361·crewclash-v362·custsched-v363·pjsched-v364·schedule-safety·schedule-add-prefill·field-issue-more·mobile-more-tools·dates-warranty-office·v219-operations·v328-integration)·정적 검사 통과.

## 2026-10-09 v364 현장 화면 '🗓 이 현장 일정' 칸 (Claude Cowork, v363 위 — PR 대기)

- 현장 화면(`viewProject`)에 일정 칸이 없어, 이 현장이 언제 무엇을 하는지 보려면 일정표로 가서 찾아야 했다. 고객 카드 다음, AS 기록 앞에 `[data-pjsched]` 칸. 버전 핀 `hyeonjang-v364-pjsched`. 저장 없음(목록은 읽기만).
- 남은 일정 = 이 현장·`_taxAuto` 아님·완료 보고 없음·끝나는 날(`hjSchSpan`) 오늘 이후(💰 수금 일정은 대표용이라 포함), 날짜·시간순 8줄 `[data-pjschrow]` — '11/4(수)~11/6(금) 타일 · 2/3일째 · 👤 김타일', 줄마다 `[data-schedit]`(기존)·`[data-schcopy]`(v361 복사). 넘치면 '외 N건 — 일정표에서 보기'(`data-gosch`). 칸은 일정이 있거나 실측·시공 단계일 때만(상담·완료 단계에 일정이 없으면 숨김), 비면 안내 한 줄.
- 아래 `[data-pjschadd]`(activeProject = 이 현장 → '+ 일정 추가' 미리 채움)·`[data-custsched]`(v363)·`[data-pjshare]`(`hjSchShareView({kind:'week',project})`). 위임 셀렉터·핸들러에 `schcopy·pjschadd·pjshare` 등록.
- 새 `tests/pjsched-v364.e2e.js` 4/4(v363 에서는 1/4 — ④ 저장본 불변은 원래도 참). 관련 12개(custsched-v363·schcopy-v361·apartment-units·apartment-manage·project-rename·as-record·brief-actions·completion-links·warranty-link·mobile-friendly-ui·uiux)·정적 검사 17개 통과(별도 포트 사본).

## 2026-10-09 v363 🗓 고객 공사 일정 안내 (Claude Cowork, v362 위 — PR 대기)

- 고객이 가장 자주 묻는 "다음엔 뭐 해요, 언제 와요?" — 📤 일정 공유(v356)는 팀원용(고객 이름 빼고 담당·주소·내부 메모)이라 고객에게 그대로 보낼 수 없었다. 버전 핀 `hyeonjang-v363-custsched`. 저장 없음.
- `hjCustSchedRows(현장)` 읽기 전용: 그 현장 일정 중 `hjPrepOtherOk`(💰·세금 자동 제외)·완료 보고 없음·끝나는 날(`hjSchSpan(s).to`)이 오늘 이후, 날짜·시간순. `hjCustSchedText(p,rows)` — '○○ 공사 일정 안내', 고객 이름, '· 11/4(수)~11/6(금) 타일'(여러 날은 시작~끝, 하루짜리는 시간 포함), 15건까지, '일정이 바뀌면 바로 다시 알려드리겠습니다.' **담당 팀원·주소·메모·💰·다른 현장·'(N일차 시작)' 꼬리표는 넣지 않는다.** 남은 일정이 없으면 그렇게 말한다.
- `hjCustSchedView(현장, back)` — 글상자(고칠 수 있음) + [✉️ 고객에게 문자](`hjSendSms`, 고객 번호 있을 때만; 없으면 안내 한 줄)·[💬 카톡으로 공유]·[📋 복사]. 자동 발송 없음.
- 입구: 현장 화면 고객 카드 `[data-custsched]`(위임 셀렉터·핸들러 등록) · 📤 공유 창에서 현장을 골랐을 때 `#shCust`(‹ 뒤로 = 같은 공유 창).
- 새 `tests/custsched-v363.e2e.js` 3/3(v362 에서는 0/3). 관련 schshare-v356·percrew-v360·crew-v357·brief-actions·as-record·mobile-friendly-ui·uiux·apartment-units·project-rename·dash-cards·정적 검사 17개 통과(별도 포트 사본).

## 2026-10-09 v362 👷 담당 겹침 — 같은 팀원이 같은 시간 두 곳 (Claude Cowork, v361 위 — PR 대기)

- v357 로 담당을 적게 되자 '김타일을 타일 현장(9~17시)과 조명 현장(13시)에 동시에' 같은 이중 배정이 생길 수 있는데, 🔍 일정 점검은 사람을 모르고 시간만 봤다(다른 팀원 두 명이 같은 시간에 다른 현장에 가는 정상 배치도 '시간 겹침'). 버전 핀 `hyeonjang-v362-crewclash`. 저장 없음.
- `hjCrewClash(a,b)` — 두 일정 담당(`hjCrewList`)에 같은 사람이 있고 `schedTimeRange` 가 겹치거나 어느 한쪽에 시간이 없으면(하루짜리) 겹친 이름 배열.
- `scheduleConflicts()` 에 `crewClashes:[{date,a,b,names}]`(v355 이어지는 날 포함, `hasIssue` 에 포함). **두 일정 모두 담당이 있으면 사람 기준** — 같은 사람이면 담당 겹침, 다른 사람이면 시간이 겹쳐도 충돌 아님. 한쪽이라도 담당이 없으면 예전 '시간 겹침' 그대로(담당을 전혀 안 쓰면 결과 동일 — 검사 ④). `scheduleCheck` 에 '👷 담당 겹침 N건' 묶음(`[data-crewclash]`, 시간 없으면 '종일'), 반환값에 `담당겹침`.
- 일정 창 '그날 다른 일정'(v355 `hjSchDayInfoHTML(날,자기id,form)`) — 지금 폼의 시간·작업 시간·담당 기준으로 겹치는 줄에 '⚠ 이름 겹침'(`li[data-crewclash]`, 위로 올림), 머리에 '👷 담당 겹침 N'. 날짜·시간·작업 시간·담당 입력과 팀원 칩 클릭에서 다시 그린다.
- 🌙 오늘 마감(v359) `hjDayCloseData().clashes` = 내일 담당 겹침 → 요약 칩 '담당 겹침 N'·내일 일정 아래 `[data-dc-clash]` 줄 + `[data-dc-check]`(🔍 일정 점검).
- 새 `tests/crewclash-v362.e2e.js` 4/4(v361 에서는 0/4). 관련 8개(dayinfo-v355·dayclose-v359·crew-v357·schcopy-v361·schedule-safety·field-issue-more·my-work·multiday-v354)·정적 검사 17개 통과.

## 2026-10-09 v361 📄 일정 복사 (Claude Cowork, v360 위 — PR 대기)

- 같은 작업을 다른 날에 또 잡을 때(같은 현장·시간·인원·담당·메모) 처음부터 다시 적었다. 일정 ⋯(`schMoreView`)에 [📄 일정 복사](`data-act="copy"`, 팀에 공유 다음) → `hjScheduleCopy(id)` → `openScheduleEdit(null, hjScheduleCopyDraft(원본))` — **새 일정 창을 채워 열 뿐, 저장 전엔 아무것도 생기지 않는다**(제목 '📄 일정 복사'). 버전 핀 `hyeonjang-v361-schcopy`.
- `openScheduleEdit(id, draft)` — 둘째 인자가 있으면 그 값으로 새 일정을 채우고 '+ 일정 추가' 의 달력 날짜·보고 있던 현장 미리 채움은 건너뛴다(둘째 인자 없는 기존 호출 6곳은 예전 그대로). 복사본: 날짜 = 다음 작업일(`hjShiftWorkDays(+1)`, 일요일 건너뜀), 제목의 '(N일차 시작)' 꼬리표·공정표 기간 메모(`HJ_RANGE_MEMO_RE`+`HJ_RANGE_TAIL_RE`) 제거, 작업 보고·시작 기록·준비물·일당·캘린더/세금/분할납/AS 표시는 옮기지 않는다(저장은 기존 `saveScheduleEdit` 새 일정 경로).
- 새 `tests/schcopy-v361.e2e.js` 3/3(v360 에서는 1/3 — ③ '+ 일정 추가' 예전 그대로는 원래도 참). `schshare-v356` ④의 ⋯ 메뉴 목록 단정에 'copy' 추가. 관련 10개(schshare-v356·crew-v357·cascade-v353·dayinfo-v355·schedule-safety·schedule-add-prefill·field-issue-more·v331-follow·percrew-v360·dayclose-v359)·정적 검사 17개 통과.

## 2026-10-09 v360 📤 일정 공유 '👥 팀원별로 보내기' (Claude Cowork, v359 위 — PR 대기)

- v357 로 담당을 고를 수 있게 됐지만, 팀원 셋에게 각자 일정을 보내려면 담당을 하나씩 바꿔 가며 세 번 보내야 했다. 공유 창(담당을 고르지 않았고 일정 하나 공유가 아닐 때)에 `#shPerCrew` — 범위·현장 안 담당 이름마다 한 줄: '👤 이름 · N건', `[.shPcSms]`(팀원 연락처 번호가 있을 때, `hjSmsUrl([번호],글)`→`hjSmsGo`)·`[.shPcKakao]`(`kakaoShareText`). 글은 그 사람 담당 일정으로 새로 만든다(`hjSchShareDays(…,crew)`+`hjSchShareText`, 머리 '이번 주 · 이름') — 위 글상자에서 고친 내용은 들어가지 않는다. 담당 없는 일정 수를 한 줄로 알린다. 버전 핀 `hyeonjang-v360-percrew`. 저장 없음.
- 새 `tests/percrew-v360.e2e.js` 3/3(v359 에서는 1/3 — ③ '칸 없음·저장본 불변'은 원래도 참). 관련 schshare-v356·crew-v357·dayclose-v359·mobile-more-sweep·정적 검사 17개 통과.

## 2026-10-09 v359 🌙 오늘 마감 — 하루를 닫을 때 한 화면 (Claude Cowork, v358 위 — PR 대기)

- 같은 요청(운영 편의 계속). 하루 끝에 확인하던 것이 📋 내 업무(완료 보고)·현장 사진(미배정)·일정표(내일·담당)·🔔 알림 문자 네 화면에 흩어져 있었다. 버전 핀 `hyeonjang-v359-dayclose`. 새 저장 키 없음, 메뉴 수 123 그대로(입구는 대시보드·내 업무).
- `hjDayCloseData(오늘)` 읽기 전용: 보고할 일정 = `hjMyWorkSchedules(오늘)`(💰·세금 자동 제외, v354 이어지는 공정 포함) 중 **오늘 끝나는 것**(`hjSchSpan(s).to<=오늘`)이고 `hjSchReported` 가 아닌 것, 여러 날 공정 중간 날은 `ongoing`('내일도 계속'), 오늘 찍은 사진(`f.when` 의 로컬 날짜)·그중 현장 없음, 내일 일정(시작+이어짐), `noCrew`(팀원 연락처가 하나라도 있을 때만, 이어지는 날 제외, 담당 빈 일정), 오늘 접수된 끝나지 않은 AS(`status!=='done'`).
- `hjDayCloseView()` — 요약 칩 줄 `#dcSummary`, 버튼은 기존 화면만 연다: `[data-dc-report]`→`myWorkReport`, `[data-dc-crew]`→`openScheduleEdit`, `[data-dc-prep]`→`prepCheck`, `[data-dc-share]`→`hjSchShareView({kind:'tomorrow',back:hjDayCloseView})`, `[data-dc-notify]`→`scheduleNotify(내일)`, `[data-dc-photos]`→현장 사진 탭, `[data-dc-as]`→`asManage`. 창 자체는 아무것도 바꾸지 않는다(모달 안 버튼은 창을 연 뒤 직접 묶음).
- 입구: 대시보드 '📅 오늘 일정' 머리 `[data-dayclose]`(위임 셀렉터·핸들러 등록) · 📋 내 업무 목록 링크 `#mwClose`.
- 새 `tests/dayclose-v359.e2e.js` 5/5(v358 에서는 0/5). 관련 14개(my-work·mobile-nav-badges·mobile-todo-nav·uiux·multiday-v354·crew-v357·schshare-v356·brief-actions·mobile-operations·mobile-friendly-ui·health-board·dash-reports·dash-cards·mobile-more-sweep)·정적 검사 17개 통과.

## 2026-10-09 v358 더보기 메뉴에 📤 일정 공유 (Claude Cowork, v357 위 — PR 대기)

- v356 일정 공유가 일정 탭·일정 ⋯·알림 문자 창에서만 열려, 대시보드나 다른 탭에서 '팀에 이번 주 일정 보내기'를 찾기 어려웠다. 더보기 현장·시공에 `['schshare','📤','일정 공유']`(🕒 공정 지연 점검 다음) → `moreActionHandler` `hjSchShareView()`(오늘 범위로 열림), `MORE_HELP.schshare` 검색어. 버전 핀 `hyeonjang-v358-moreshare`.
- **행동 계약 122 → 123**: `mobile-more-tools`(TARGETS `schshare:['hjSchShareView']`)·`mobile-more-sweep`·`mobile-office-connect`·`board-v351`(메뉴 수 단정) 갱신. 네 검사 + schshare-v356·crew-v357 통과.

## 2026-10-09 v357 👷 일정 담당 팀원 + 연락처 '팀원' (Claude Cowork, v356 위 — PR 대기)

- 대표 "PC 종료하지 말고 개발 진행"(운영 편의 계속). 일정에는 인원 '수'만 있어 누가 어느 현장에 가는지 일정표에 없었고, v356 공유도 '그 사람 일정'을 골라 줄 수 없었다. 버전 핀 `hyeonjang-v357-crew`. **최상위 저장 키 41개 그대로** — 일정 항목 안 `crew`(쉼표로 나눈 이름 글자), 연락처 항목 안 `team`(true, 해제하면 키를 지움).
- 도우미 `hjCrewList`(`HJ_CREW_SPLIT_RE` 쉼표·전각 쉼표·가운뎃점·빗금, 앞뒤 공백·중복 제거, 이름 20자·10명까지)·`hjCrewText`·`hjTeamContacts`·`hjCrewPhone(이름)`(팀원 연락처에서 같은 이름의 번호).
- 연락처 수정 창 [👷 팀원] 체크박스, 목록에 '👷 팀원' 배지(`[data-conteam]`). **`saveContactEdit` 이 기존 항목에 폼 칸만 덮도록 고쳤다** — 예전엔 새 객체로 갈아 끼워 폼에 없는 칸(카카오 문의의 `tag:'고객'`·`email`)이 지워졌다(일정 수정에서 고쳤던 것과 같은 결함).
- 일정 창 '담당 팀원' `#schCrew` + 팀원 칩 `.schCrewChip`(누르면 넣고/빼고, `aria-pressed`, 44px; 팀원이 없으면 안내 한 줄). `saveScheduleEdit` 의 덮는 칸에 `crew`. 보이는 곳: 일정표 `[data-schcrew]`·대시보드 오늘 일정 `[data-dashcrew]`·📋 내 업무 카드 머리·🔔 알림 문자 작업자 글 '담당:'·`buildICS` 설명 '담당 …'·📤 공유 글 '👤 …'.
- 📤 공유 창: 범위 안 담당 이름으로 `#shCrew`(전체 팀원/👤 이름) — 고르면 그 사람 일정만(`hjSchShareDays` 다섯째 인자), 머리 '오늘 · 김타일', 범위를 바꿔도 유지, 팀원 연락처 번호가 있으면 `#shPhone` 을 채운다. 일정 하나 공유도 담당이 한 명이면 번호. 📋 작업지시 창(`openWorkOrder`)도 담당이 팀원 한 명이면 `#woPhone` 을 채운다(여럿·팀원 아님은 비움). 보내기는 언제나 사람이.
- 새 `tests/crew-v357.e2e.js` 6/6(v356 에서는 1/6 — ⑥ 저장본 불변만 원래도 참). 관련 26개(schshare-v356·dayinfo-v355·multiday-v354·cascade-v353·field-issue-more·schedule-safety·schedule-add-prefill·v331-follow·my-work·ics-save·ics-import·menu-schedule·uiux·mobile-friendly-ui·office-ops-isolation·pages-artifact·brief-actions·completion-links·file-identity·health-board·ledger-roundtrip·marketing-draft·mobile-more-tools·mobile-operations·privacy·restore-delete-safety)·정적 검사 17개 통과.

## 2026-10-09 v356 📤 일정 공유 — 팀원에게 카톡·문자·캘린더 파일로 (Claude Cowork, v355 위 — PR 대기)

- 대표 "팀원들이 일정을 확인하도록 공유 기능으로 일정을 카톡·캘린더·문자로 공유". 지금까지는 일정 하나씩 작업지시(문자)·폰 캘린더(.ics)만 됐고, 이번 주 일정을 팀 단톡방에 올리려면 손으로 옮겨 적었다. 버전 핀 `hyeonjang-v356-schshare`. 새 저장 키 없음(받는 번호도 저장 안 함), 더보기 메뉴 수 122 그대로.
- `hjSchShareView(opts)` — `{kind:'today'|'tomorrow'|'week'|'nextweek'|'day', date, project, back}` 또는 `{ids:[일정 id]}`(일정 하나: 시작일 + 이어지는 날). 범위 `hjSchShareRange`(주 = 월~일), 목록 `hjSchShareDays`(💰·세금 자동 = `hjPrepOtherOk` 제외, 현장 좁히기, v354 이어지는 공정 'N/M일째'). 글 `hjSchShareText` — 날짜별 시간·작업(여러 날이면 '타일 (3일 · ~11/6(금))')·현장, 둘째 줄 주소·👷 인원·메모(공정표 기간 메모는 뺌, 60자). **고객 이름·전화번호는 넣지 않는다.** 글은 textarea 라 보내기 전에 고칠 수 있다.
- 보내는 길(모두 사람이 마지막에 누름): [💬 카톡으로 공유] `kakaoShareText`(공유 시트, 안 되면 복사) · [📅 캘린더 파일(.ics)] `hjSchShareIcsItems` → 기존 `saveICSToPhone`(여러 날 공정은 날마다 VEVENT 하나, UID `id-dN`; 설명에 주소·메모만 — 고객·작업 보고 없음) · [📋 복사] · [✉️ 문자] 받는 번호(쉼표로 여러 명, 연락처 datalist) → `hjSmsUrl`(한 명은 기존 `hjSendSms` 꼴, 여러 명은 안드로이드 `sms:a,b?body=`·아이폰 `sms:/open?addresses=a,b&body=`) → `hjSmsGo`(검사가 가로챔). 범위에 일정이 없으면 네 길 모두 막고 알린다.
- 입구: 일정 탭 툴바 `#schShare`(위임 셀렉터·핸들러 등록; 달력에서 날을 골랐으면 그날) · 일정 ⋯ `schMoreView` 에 [📤 팀에 공유](`data-act="share"`) · 🔔 알림 문자 창 아래 [📤 팀 공유](그날, ‹ 뒤로 = 알림 문자 창).
- 새 `tests/schshare-v356.e2e.js` 6/6(v355 에서는 0/6): 범위·글 규칙(넣지 말 것 포함), 툴바 → 칩·현장 → 고친 글이 공유 시트로·44px·390px, 문자 링크 넷(빈 번호·한 명·여러 명·아이폰), ⋯ 메뉴 → 일정 하나 → .ics UID 셋·내용·고객 정보 없음, 알림 문자 창 왕복·빈 범위 차단, 저장본 불변. 관련 11개(ics-save·ics-import·menu-schedule·uiux·multiday-v354·dayinfo-v355·cascade-v353·mobile-friendly-ui·mobile-more-sweep·schedule-safety·my-work)·정적 검사 17개 통과. v355 기준 컨테이너 전체 242개 중 238(실패 4 = 늘 같은 한글 다운로드 이름 apartment-projects·document-select·document-upload·team-workboard).
- 다음 후보였던 '팀원 연락처 묶기'는 v357(연락처 [👷 팀원]·일정 담당)으로, 더보기 입구는 v358 로 했다.

## 2026-10-09 v355 일정 창 '그날 다른 일정' + 일정 점검에 이어지는 날 (Claude Cowork, v354 위 — PR 대기)

- 같은 요청(운영 편의). 1인·소규모 시공은 하루 한 팀이라, AS 방문을 넣으려다 그날 타일 2일째인 걸 모르고 겹치게 잡는 일이 잦다. 버전 핀 `hyeonjang-v355-dayinfo`. 새 저장 키 없음, 읽기 전용, 막지 않음.
- `openScheduleEdit` 날짜 줄 아래 `#schDayInfo`(aria-live) — 날짜를 바꾸면(`input`·`change`) `hjSchDayInfoHTML(날, 자기 id)`: 그날 일정(자기·💰·세금 자동 제외 = `hjPrepOtherOk`) + v354 이어지는 공정('타일 (2/3일째)'), 시간순 4개까지, 일요일이면 '일요일'. 후보 계산 `hjSchDayOthers`.
- `hjSchContDates(s)` — 이어지는 날 목록(시작일·일요일 제외, 완료 보고면 없음). 달력 막대(v354 의 반복문을 이 함수로)와 `scheduleConflicts` 가 같이 쓴다 — 🔍 일정 점검의 시간 겹침·과부하에 이어지는 날의 공정도 들어간다(예전엔 시작일만 셈).
- 새 `tests/dayinfo-v355.e2e.js` 3/3(v354 에서는 1/3 — ③ 저장본 불변만 원래도 참). 관련 11개(cascade-v353·multiday-v354·field-issue-more·schedule-add-prefill·schedule-safety·v331-follow·delay-v347·my-work·uiux·menu-schedule·mobile-more-tools)·정적 검사 17개 통과(별도 포트 사본으로 실행).

## 2026-10-09 v354 🗓 여러 날 공정 이어 보이기 (Claude Cowork, v353 위 — PR 대기)

- 같은 요청(운영 편의). 🗓 공정표는 3일짜리 타일을 '타일 (3일차 시작)' **일정 하나**(시작일)와 메모 `시작~끝 (3일)` 로 만든다 — 그래서 둘째·셋째 날에는 대시보드 '📅 오늘 일정'·📋 내 업무·달력·🔔 알림 문자 어디에도 안 보였고("오늘은 할 일이 없습니다"), 공정 진행률은 둘째 날부터 '예정', 🕒 지연 점검은 **아직 하는 중인 공정**을 시작 이틀 뒤부터 지연이라 불렀다. 버전 핀 `hyeonjang-v354-multiday`. 새 저장 키·새 일정 없음(읽기 전용).
- 기간 `hjSchSpan(s)`: 메모 첫머리 `HJ_RANGE_MEMO_RE`(v353 에서 만든 것을 이번에 `HJ_PLAN_SKIP_RE` 옆으로 옮김 — 렌더 경로가 쓰므로 앞쪽에)가 **그 일정 날짜~더 늦은 날**(60일 이하)일 때만, 아니면 하루짜리. `hjSchContOn(s,날)` — 시작 다음 날~끝, 일요일 제외, 완료 보고(`hjSchReported`)면 끝난 것 → `{day,days,from,to}`. `hjSchContinuing(날,filter)`·`hjSchContLabel` ('↳ 이어서 2/3일째 · 11/4(수)~11/6(금)').
- 붙인 곳: `dashboardTodayHTML`(운영 루틴 제외, `[data-schcont]` 줄) · `hjMyWorkSchedules`(→ 📋 내 업무; 이어지는 날 카드는 [▶ 작업 시작] 없음 — 시작 기록은 첫날 것이라 '진행 중 · 몇 시부터' 가 틀린다) · `calendarHTML`(이어지는 날 옅은 막대 `.cal-cont`, 읽기 글 '이어지는 공정 N건') · `viewSchedule`(고른 날, 안 골랐으면 오늘 묶음 끝에 붙임; 일요일 고르면 빈 상태) · `notifyDrafts`(작업자 글 '작업: 타일 (2/3일째)', 고객 글 '…작업이 이어집니다'; AI 도구 `schedule_notify` 도 같은 목록) · `hjPhaseProgress`(이어지는 날 '진행 중') · `hjPhaseDelays`(끝나는 날부터 셈, 결과에 `to`; `hjDelayView` 에 '시작~끝 예정').
- 새 `tests/multiday-v354.e2e.js` 6/6(v353 에서는 1/6 — ⑥ 저장본 불변만 원래도 참): 기간 규칙(일요일 낀 도배·완료·사람 메모), 대시보드·내 업무, 달력 막대·고른 날·일요일·390px, 알림 문안, 진행률·지연, 읽기 경로 불변. 오늘은 `localDate` 를 가로채 2026-11-05(목)로 고정. 관련 15개(board-v351·delay-v347·extraprogress-v346·uiux·vatproof-v349·ics-import·ics-save·menu-schedule·mobile-nav-badges·mobile-todo-nav·my-work·prep-check·shared-todo·cascade-v353·schedule-safety)·정적 검사 17개 통과.
- 다음 후보였던 🔍 일정 점검의 이어지는 날 셈은 v355 에서 했다.

## 2026-10-09 v353 📅 뒤 일정 같이 옮기기 (Claude Cowork, v352 위 — PR 대기)

- 대표 "회계보다 회사가 운영되는 일을 하는 부분을 발전". 비·자재·앞 공정 때문에 공정 하나가 밀리면 뒤 공정(도배·바닥·청소…)을 **일정 하나하나 열어** 날짜를 바꿔야 했다(공정 5개면 다섯 번). 버전 핀 `hyeonjang-v353-cascade`. 새 저장 키 없음(41개), 메뉴 수 122 그대로.
- `saveScheduleEdit` 끝: 기존 일정의 **날짜만** 바뀌고(현장은 그대로) 현장이 있으면 `hjCascadeCands(s,옛날짜)` 후보를 `hjCascadeOffer` 창으로 묻는다 — 같은 현장 · 옛 날짜보다 뒤 · 완료 보고 없음 · `HJ_PLAN_SKIP_RE`(💰·AS 방문·상담·실측) 아님 · `payPlan`·`_taxAuto`·`asId`·AS `visitSchedId` 연결 아님. 옮긴 일정 자체가 💰/AS 면 묻지 않는다. 후보는 체크박스(기본 체크), [📅 체크한 일정 같이 미루기/당기기]·[이 일정만].
- 작업일 셈 `hjWorkDaysBetween`·`hjShiftWorkDays` 는 🗓 공정표 `planAssignDates` 와 같다(일요일만 건너뜀, 토요일은 작업일; 10년 넘는 거리는 0 — 잘못 친 연도로 수천 번 돌지 않게). 공정표 메모 `시작~끝 (N일)`(`HJ_RANGE_MEMO_RE`)은 날짜를 따라간다 — 옮긴 일정은 사람이 메모 칸을 안 고친 저장일 때만.
- 옮긴 뒤 `hjCascadeDone` 창: 바뀐 날짜 목록, [✉️ 고객 일정 안내](`hjScheduleChangeText` — 바뀐 날짜만, 사유를 짓지 않음; 연락처 있으면 `hjSendSms` 로 문자 앱, 없으면 복사 — 자동 발송 없음), [↩ 되돌리기](같이 옮긴 것만 원래 날짜·메모로). 적용 직전 그 일정이 다른 곳에서 바뀌었으면(`o.date!==계획 시작일`) 건너뛴다.
- 새 `tests/cascade-v353.e2e.js` 4/4(v352 에서는 0/4): 후보 규칙·작업일(토→화, 월→수)·메모 따라감·고객 글, 체크 빼기·되돌리기, 이 일정만·당기기·묻지 않는 저장 다섯 경우·사람이 고친 메모 보존, 작업일 셈 = `planAssignDates`·후보 고르기 저장본 불변. 관련 6개(delay-v347·field-issue-more·schedule-add-prefill·schedule-safety·v331-follow·mobile-more-tools)와 정적 검사 17개 통과.

## 2026-10-09 v352 통장 가져오기 저장 뒤 다음 할 일 (Claude Cowork, v351 위 — PR 대기)

- v350 으로 여러 입금을 한 번에 적으면 💰 입금 기록 창이 저장마다 제안하던 '입금 확인 문자'(v205)와 v348 증빙 기록으로 가는 길이 끊겼다. 저장 뒤 `hjBankAfterSave(saved)` 창 — 줄마다 [✉️ 입금 확인 문자](연락처 없으면 '📋 입금 확인 글' — 기존 `sendPaymentReceipt(현장,{d,amt})` 그대로: 문자 앱·공유·복사, 자동 발송 없음)·[🧾 증빙 기록](`hjProofView(현장, 뒤로=이 창)`), 아래 [💰 수금 이력]. 버전 핀 `hyeonjang-v352-importfollow`. 저장 구조·메뉴 수(122) 그대로.
- `tests/bankimport-v350.e2e.js` ③에 이어 붙였다(확인 문자 → `sendPaymentReceipt` 인자, 증빙 창 왕복, 수금 이력 복귀).

## 2026-10-09 v351 현장 보드에 지연·추가공사·증빙·보수 축 + 더보기 🕒 공정 지연 점검 (Claude Cowork, v350 위 — PR 대기)

- 대표 "개발을 더 진행해줘". v345~v348 신호(보수 필요·추가공사 확인 전·공정 지연·증빙 미기록)가 대시보드 '오늘의 체크' 줄에만 있어 **맨 위 🏥 현장 보드 순위에 안 잡혔다**(v347 때 화이트리스트 계약 때문에 미뤘던 것). 버전 핀 `hyeonjang-v351-boardsignals`. 새 저장 키 없음(41개).
- `projHealthBoard` 에 축 넷 — `idx.delay/extra/proof/punch` 를 현장마다 한 번씩 **원 함수 결과로만** 만든다(`hjPhaseDelays`·`hjExtrasBill(p).pending`(stage≥2)·`hjProofPending(today,name)`·`hjPunchOpen`(stage≥2), 임계값 재계산 없음 — 검사 ①이 축 집합 = 원 함수 집합을 대조). 라벨 '공정 지연 N개 · D일'·'추가공사 확인 전 N건'·'증빙 미기록 N건 · D일'·'보수 필요 N곳'. 긴급은 `BOARD_URGENT.delayDays`(7)·`proofDays`(5, 현금영수증 발행 기한)만, 나머지 둘은 주의. 보관 현장은 루프가 건너뛴다.
- 배지가 **그 현장 화면**을 연다: reason 에 `arg`(현장 이름) → `data-boardarg` → 위임이 `fn(arg)`. `BOARD_ACTIONS` 에 `hjDelayPick·extraWork·hjProofView·punchListView` — 모두 더보기에서도 부르는 함수(health-board ⑦ `inMah` 계약 유지, `KNOWN_ACTIONS` 넷 추가). 위임 셀렉터에 `[data-boardarg]` 등록(click-delegation 검사가 잡았다).
- **더보기 현장·시공 [🕒 공정 지연 점검]**(`delaycheck` → `hjDelayPick()`): 지연 있는 시공 현장이 하나면 바로 `hjDelayView`, 여럿이면 고르기(최장 지연 순), 없으면 빈 상태 창(더보기 전수 검사는 화면이 열려야 한다). `hjDelayPick(현장)` 은 그 현장 창 — 보드 배지가 이걸 쓴다. 행동 계약 **121 → 122**(`mobile-more-tools` TARGETS `delaycheck:['hjDelayPick']`, `mobile-more-sweep`·`mobile-office-connect`). `MORE_HELP.delaycheck` 검색어.
- 검사 안정화(같은 커밋): `extraprogress-v346` ②·`delay-v347` ②·`bankimport-v350` ③의 '요청 0' 단정이 **모든 fetch** 를 세어 병렬 실행에서 부팅이 늦게 쏘는 글꼴·GIS 미리읽기에 거짓 실패했다(Codex Windows 지정 검사에서 extraprogress-v346 1회, 단독 재시도 통과). 이제 앱이 보낼 수 있는 요청(고객 페이지 `/portal/save`·릴레이·전자계약·xlsx CDN)만 센다 — 단정의 뜻은 그대로.
- 새 `tests/board-v351.e2e.js` 4/4(v350 에서는 0/4): 축 드리프트·라벨·긴급·보관/상담 제외, 배지 → 함수(현장)·화이트리스트 밖 무시, 더보기 셋 경로·메뉴 122·390px, 읽기 경로 저장본 불변. 검사 시드는 기존 여섯 축 함수를 `()=>[]` 로 비운다(방치 축이 빈 시드 현장을 전부 긴급으로 만들어 등급 단정이 안 됐다). 관련 11개(health-board 11/11·delay-v347·brief-actions·punchlist-v345·extraprogress-v346·payproof-v348·extra-work·completion-links·mobile-more-tools·mobile-office-connect·mobile-more-sweep) 통과(별도 포트 사본으로 실행).

## 2026-10-09 v350 🏦 통장 입금 내역 가져오기 (Claude Cowork, v349 위 — PR 대기)

- 대표 "개발을 더 진행해줘". 실데이터(2026-10-08) 견적 72곳에 **입금 기록 0건** — 미수·독촉·분할납·부가세·증빙(v348)이 전부 입금 기록 위에 서 있는데 그 바닥이 비어 있었다. 통장에 들어온 돈을 한 건씩 손으로 옮기는 일이 안 되고 있었으니, 은행 거래내역 파일에서 **입금 줄만 뽑아 현장을 제안하고 사람이 체크한 것만 저장**한다. 버전 핀 `hyeonjang-v350-bankimport`. 새 저장 키 없음(41개), 더보기 메뉴 수 121 그대로(💰 수금 이력 창의 [🏦 통장에서 가져오기] 버튼).
- 읽기: `hjBankReadFile(file)` — csv·txt 는 `hjBankDecode`(utf-8 실패 → euc-kr; 은행 csv 는 보통 EUC-KR) + `hjBankCsvGrid`, xlsx 는 `ensureXLSX` 뒤 시트마다. `hjBankRowsFromGrid(grid)` 가 앞 30행에서 머리글을 찾는다 — 날짜 열(`HJ_BANK_DATE_RE`) + 입금 열(`HJ_BANK_IN_RE`, 농협 '입금금액') 또는 거래금액+구분 열(카카오 '구분'·'거래금액'); 못 찾으면 `reason` 으로 어느 열이 없는지 말한다. 입금자명은 '보낸분·입금자·의뢰인·거래기록사항·적요·내용…' 순. 합계·소계 줄 제외, 출금·0원 제외. 날짜 `hjBankDate` — 2026/10/02 14:22·2026.10.03·20261004·엑셀 일련번호(UTC 날짜만, `toISOString().slice` 안 씀). 정규식은 전부 상수(토크나이저 규칙).
- 제안 `hjBankMatch(row,projects,statsOf,payLog)`: **이름이 맞을 때만 고른다** — 입금자=고객명(3)·전에 같은 입금자로 기록(3, payLog 의 `payer`)·입금자≈현장명(2). 금액(잔금과 같음·`HJ_PAY_RATIO` 비율)은 +1 이라 **금액만 맞으면 힌트로만** 보이고 고르지 않는다(같은 금액 잔금이 둘이면 틀린다). 동점이면 비우고 후보를 적는다. 보관 현장은 후보 아님. `hjBankDup` — 같은 날·같은 금액(·같은 현장)이 payLog 에 있으면 '이미 기록됨'(체크 해제, 저장 때도 다시 걸러 두 번 안 적힌다).
- 저장은 **`hjPayRecordAdd(p,rec)` 한 곳** — 💰 입금 기록 창(`recvQuickView`)의 받은 돈 누계·payLog push·5000건 캡·옛 독촉/입금확인 작업 닫기를 떼어 내 둘이 같이 쓴다(동작 동일, 검사 ④). 가져온 기록은 `{d,project,amt,payer}` — `payer`(30자)는 다음 가져오기의 '전에 같은 입금자' 근거. 증빙은 저장 뒤 v348 창에서. 확인창(confirm)에 건수·합계, 미래 날짜 줄은 막는다. 파일은 저장하지 않고 잔액·다른 사람 거래는 화면에서만 보고 버린다. 저장 뒤 `portalAutoSync`(설정 없으면 요청 0).
- 대시보드 💰 '수금 기록 없는 현장' 알림 글 끝에 가는 길을 적었다(통장 거래내역 파일이 있으면 💰 수금 이력 → 🏦 통장에서 가져오기).
- 새 `tests/bankimport-v350.e2e.js` 4/4(v349 에서는 0/4): 격자 읽기(두 은행 꼴·날짜 네 꼴·합계/출금 제외·못 읽는 이유·csv 따옴표), 제안 규칙 10가지, 화면 끝까지(EUC-KR csv 바이트 → 제안 → 현장 바꾸기 → 저장 → 같은 파일 다시 넣으면 중복 차단 → 390px·요청 0·키 41), 💰 입금 기록 창 동작 유지·읽기 경로 저장본 불변. 관련 16개(recv-entry·due-settle-all·brief-actions·quickinput-v344·payproof-v348·vatproof-v349·ledger-roundtrip·dates-warranty-office·project-rename·restore-parity·apt-orders·apt-amount·mobile-more-tools·sweep·office-connect) 16/16. 전체 결과는 아래 v349 방식으로 적는다.
- 한계(다음 후보): 입금자명이 고객명과 다르고 처음이면 제안이 비어 손으로 골라야 한다(한 번 고르면 다음부터 '전에 같은 입금자'). 분할납 💰 일정의 회차 금액과는 아직 안 맞춰 본다(계약 비율만). 한 파일에 같은 날·같은 금액 입금이 둘이면 둘째 줄은 첫째를 저장한 뒤 '이미 기록됨'으로 보인다 — 실제로 두 건이면 💰 입금 기록 창에서 손으로.

## 2026-10-08 v349 부가세 준비 ↔ 입금 증빙 연결 (Claude Cowork, v348 위 — PR 대기)

- 대표 "개발을 더 진행해줘" — v348 에서 적기 시작한 증빙을 **부가세 준비 창에서 한눈에**. 신고 기간 입금(payLog, 입금일 기준)을 현금영수증·세금계산서·카드·기타·미기록으로 센다 — 홈택스 현금영수증 발행 내역·전자세금계산서 합계와 맞춰 보는 참고 줄. **입금일 기준이라 매출(견적 기준)과 다를 수 있다**고 화면에 적는다. 버전 핀 `hyeonjang-v349-vatproof`.
- `hjProofSummary(from,to)` → `{cash,tax,card,etc,none,total:{n,sum}}`(읽기 전용) · `hjProofSummaryLine`. `vatReport` 매입 아래 '🧾 입금 증빙' 칩 줄(미기록은 붉게) + [🧾 입금 증빙 기록 열기] → `hjProofView('', 뒤로=vatReport)` · 요약 복사 글에 '입금 증빙(입금일 기준): …' 한 줄 · `vatExportXlsx` 에 **4번째 시트 '입금증빙'**(입금일·현장·금액·증빙·기록일, 기간 밖 제외; 반환 `시트:4`). 저장 구조·더보기 수(121)·매출·매입 계산은 그대로.
- 주의: `vatReport` 안의 `won` 은 `hjNum`(원 없음) 지역 변수다 — 칩 숫자는 다른 숫자처럼 '원' 없이, 복사 글은 전역 `won` 으로 '원' 붙음(기존 줄도 `won(x)+'원'`).
- **실데이터(대표 `_현장.json` 2026-10-08, 읽기 전용 dry run) 확인 후속**: 상담·완료 현장에도 옛 사진 공정으로 브리핑 칩 '2/3' 이 떴다 → 브리핑 칩·진행 보고 문안의 진행률은 **시공(stage 2) 현장만**(고객 페이지는 원래 시공 단계만). 공정 이름이 '지하실 배관 교체 및 1동 807호 806호 계량기 밸브 교체' 처럼 길어 `hjPhaseProgressLine` 은 공정 하나를 24자에서 자른다. 실데이터에서 v347 지연 알림 1건(금성백조 8/13 일정·56일)·추가공사 미청구 0·입금 증빙 0(입금 기록 0건이라 v348 은 기록을 시작해야 보인다).
- v348 기준 컨테이너 필터 없는 전체 `tests/run-all.js`: **236개 중 232 통과** — 실패 4개는 알려진 컨테이너 한글 다운로드 이름 문제(apartment-projects·document-select·document-upload·team-workboard, 단독 재시도 1건 통과). Windows(Codex) 전체는 v346 시점 234/234.
- 새 `tests/vatproof-v349.e2e.js` 4/4(v348 에서는 0/4): 집계·칩·안내·복사 글·증빙 창 왕복·390px, 엑셀 시트(XLSX 스텁), 읽기 경로 저장본 불변. 관련 6개(dash-reports·revenue-basis·sales-basis·quote-vat·quickinput-v344·payproof-v348) 통과(별도 포트 사본으로 실행).

## 2026-10-08 v348 입금 증빙(현금영수증·세금계산서) 기록 (Claude Cowork, v347 위 — PR 대기)

- 대표 "개발을 더 진행해줘" — 돈 흐름의 빈 고리: 입금은 적는데 **현금영수증·세금계산서를 발행했는지는 어디에도 못 적었다**. 실내건축 공사업은 현금영수증 의무발행 업종(건당 10만원 이상 현금·계좌이체 거래 → 입금일부터 5일 안, 미발행은 가산세 대상 — 기준은 홈택스 안내 확인, 앱은 금액을 단정하지 않는다). 버전 핀 `hyeonjang-v348-payproof`.
- 저장은 **입금 기록(`state.payLog` 항목) 안에 `proof`('cash'|'tax'|'card'|'etc')·`proofAt`** 만 더한다 — payLog 항목은 통째로 직렬화되므로 유상 왕복(paidStableJson)에 그대로 실린다. 최상위 키 41개 그대로. 옛 기록은 빈 값(=아직). 읽기 `hjProofPending(today,현장)`(10만원 이상·`HJ_PROOF_WARN_DAYS` 2일 지난 빈 기록, 배열을 만들지 않음), 쓰기 `hjProofSet(rec,kind)` 한 곳(같은 종류를 다시 누르면 지움).
- 보이는 자리: 💰 입금 기록 창(`recvQuickView`)에 '증빙' 선택(기본 '아직'), 대시보드 '오늘의 체크' 🧾 줄 + 현장 버튼 `data-proofquick` → `hjProofView(현장)`(최근 40건, 종류 버튼 44px, [📇 세금계산서 정보]=기존 `taxInvoiceInfo`), 더보기 경영·돈 **[🧾 입금 증빙 기록]**(`payproof`, 행동 계약 **120 → 121** — `mobile-more-tools` TARGETS `payproof:['hjProofView']`, `mobile-more-sweep`·`mobile-office-connect` 의 120). 발행 자체는 홈택스에서 — 앱이 대신하거나 발행했다고 짓지 않는다.
- 새 `tests/payproof-v348.e2e.js` 3/3(알림 경계·기록/지움·저장·입금 창·더보기·읽기 경로 저장본 불변). 관련 10개(mobile-more-tools·sweep·office-connect·recv-entry·brief-actions·quickinput-v344·delay-v347·extraprogress-v346·restore-parity·ledger-roundtrip) 10/10. 검사 작성 중 교훈: `serializeData().payLog` 는 **같은 객체 참조**라 '저장본' 값을 보려면 JSON 왕복으로 베껴야 한다.

## 2026-10-08 v347 공정 지연 점검 (Claude Cowork, v346 위 — PR 대기)

- 대표 "개발을 더 진행해줘" — v346 공정 진행률의 자연스러운 다음: **일정은 지났는데 사진도 완료 보고도 없는 공정**을 찾아 알린다(1인 시공은 비·자재·앞 공정으로 밀리는데, 밀린 줄 모르면 고객에게 "오늘 온다더니" 가 된다). 버전 핀 `hyeonjang-v347-delaycheck`. 새 저장 키·새 더보기 메뉴 없음(120 그대로).
- `hjPhaseDelays(p,today)` (읽기 전용) — 시공(stage 2)·보관 아닌 현장의 🗓 일정 가운데 `HJ_DELAY_MIN_DAYS`(2)일 이상 지났고, 완료 보고(`report.progress==='완료'`/`report.done`)가 없고, `hjPhaseProgress` 가 완료·진행 중으로 보지 않으며(그 공정 사진 없음), 같은 제목의 더 늦은 일정(이미 옮긴 것)이 없는 것. 제목은 v346 과 같은 `HJ_PLAN_SUFFIX_RE`/`HJ_PLAN_SKIP_RE`(💰·AS 방문·상담·실측 제외). **어제 것은 지연이 아니다**(하루 밀림은 흔하다). 상담·완료 현장은 대상이 아니다.
- 대시보드 '오늘의 체크' 🕒 줄 + 현장 버튼 `data-delayquick` → `hjDelayView(name)`: 공정마다 [✅ 완료 보고]=기존 `myWorkReport(일정 id)`, [📅 일정 옮기기]=기존 `openScheduleEdit(id)`, 아래 [✉️ 일정 안내 문자]=`hjDelayText`(공정 이름만 적고 **조정된 날짜는 '(여기에 적어 주세요)' 빈칸** — 날짜·사유를 지어내지 않는다, 연락처 있으면 `hjSendSms`, 없으면 복사, 자동 발송 없음). 현장 보드(projHealthBoard) 축은 늘리지 않았다 — `health-board` 의 openAction 화이트리스트(더보기 함수만) 계약 때문.
- 새 `tests/delay-v347.e2e.js` 3/3(v346 에서는 0/3): 판정 경계(완료 보고·사진·옮긴 일정·어제·💰/AS·시공 아닌 현장), 대시보드→창→기존 함수 연결·문자 초안에 날짜 없음·서버 요청 0·390px, 읽기 경로 저장본 불변(v345 규칙). 관련 9개(brief-actions·health-board·extraprogress-v346·punchlist-v345·quickinput-v344·schedule-safety·completion-links·my-work·mobile-operations) 9/9.

## 2026-10-08 v346 공정 진행률·추가공사 미청구 경고 (Claude Cowork, v345 위 — PR 대기)

- 대표 "더 진행" — v345 비교표의 다음 후보 둘(Houzz Pro 단계별 진행률 · 추가공사 미청구 경고). 새 입력·새 저장 키 없음(최상위 41개 그대로). 버전 핀 `hyeonjang-v346-extraprogress`.
- **공정 진행률 `hjPhaseProgress(p)` → {total,done,doing,todo,pct}** (읽기 전용). 공정 목록은 `hjPhaseNames(p)` = `p.phases`(문자열·옛 객체 둘 다), 비어 있으면 이 현장 🗓 공정표 일정 제목(`HJ_PLAN_SUFFIX_RE` 로 ' (N일차 시작)' 제거, `HJ_PLAN_SKIP_RE` 💰·AS 방문·상담·실측 제외). 판정은 두 신호만: 사진 공정 표시(`_phase`, 뒤 공정에도 사진이 있으면 앞 공정은 완료)와 일정 완료 보고(`report.progress==='완료'` 또는 `report.done`, 제목이 공정 이름이거나 '공정 이름 ' 으로 시작). **날짜가 지난 것은 완료가 아니다**(비로 밀린 공정을 고객 화면이 완료라 하면 안 된다). 오늘 일정이 잡힌 공정은 진행 중.
- 한 줄 `hjPhaseProgressLine` 을 세 곳이 같이 쓴다: `portalBuild` 시공 단계 메모(예전 '최근: '+last.title 은 공정이 문자열이라 늘 빈 글이었다 — 고친 결함), `customerProgressText`(없으면 예전 '(철거·타일 진행)' 그대로), 브리핑 진행 현장 칩 '공정 2/4'. `portalSig` 에 시공 메모를 넣어 진행률이 바뀌면 고객 페이지가 '갱신 필요'. `setPhase`·`applyBulkPhase`·`myWorkReport` 저장 뒤 `portalAutoSync`(서버 설정 없으면 요청 0 — 검사로 고정).
- **추가공사 미청구**: 대시보드 '오늘의 체크'에 시공·완료(stage≥2) 현장의 `hjExtrasBill(p).pending`(확인 전·금액 협의·금액 확인 필요) 합계 + 현장 버튼 `data-extraquick` → `extraWork(name)`(클릭 위임 목록에 등록). 준공 전 체크 `STAGE_CHECK[3]` 둘째 줄 '추가공사 확인받음·금액 적기(청구서에 반영)' `extra` — `stageChecklistItems` 가 확인받음 N건 금액·견적에 담김·`hjExtrasPendingLine` 을 셋째 칸에, `STAGE_CHECK_GO.extra` 🖊 추가공사. 실측 단계 현장은 대상 아님.
- **v345 결함 수정(이 커밋에 포함)**: `hjPunchList` 가 읽기만 하는 자리(대시보드 `hjPunchOpen`·준공 체크 줄·문안)에서도 `p.punch=[]` 를 만들어, 유상 저장 뒤 `assertPaidLiveStateExact`(저장본 == 지금 상태) 가 어긋나 **'paid exact live state conflict'** 로 저장이 실패 처리됐다(Windows 전체 검사 `apartment-projects` 에서 발견 — 컨테이너는 그 앞 다운로드 이름에서 떨어져 못 봤다). 읽기는 `hjPunchItems(p)`(배열을 만들지 않음), 쓰기(점검표 화면·기본 항목 넣기)만 `hjPunchList`. **화면을 그리는 함수는 현장 객체에 빈 배열을 붙이면 안 된다**(hjExtrasBill 주석과 같은 규칙) — 새 검사 ④가 대시보드·준공 체크·문안·고객 페이지를 전부 그린 뒤 저장본이 같은지 본다.
- 검사 계약: `completion-links` ① GO 목록 `['punch','extra','balance','warranty','zip','review']`(여섯 개). 더보기 메뉴 수 120 그대로. 새 `tests/extraprogress-v346.e2e.js` 4/4(v345 에서는 0/4). 관련 17개(brief-actions·completion-links·extra-work·extras-settle·photo-refs·punchlist·quickinput·ledger-roundtrip·mobile-more-tools·restore-parity·revenue-basis·site-rules·v328-integration·portal-key·followup-v343·estimate-photo-dup-v342·mobile-more-sweep) 17/17. 필터 없는 전체 결과는 아래 v345 와 같은 방식으로 적는다(컨테이너 알려진 실패 4개 외 0).

## 2026-10-08 v345 준공 하자점검표(punch list) (Claude Cowork, v344 위 — PR 대기)

- 대표 요청: 다른 회사 앱(Buildertrend·Houzz Pro·CoConstruct·JobNimbus·Procore·도배르만)과 비교해 없는 것을 찾아 30분 개발. 비교 결과 이 앱에 이미 있는 것: 견적·계약서 초안·추가공사(확인받음→청구)·분할납 계획·공정표 자동 생성·고객 페이지·진행 보고 문안·보증서·AS·전후 비교·사례 글. **없던 것: 인도 전 하자점검표(punch list)**. 버전 핀 `hyeonjang-v345-punchlist`.
- `punchListView(현장)` (더보기 현장·시공 [🧾 준공 하자점검표], 준공 전 체크 줄 [🧾 점검표], 대시보드 버튼). 저장은 `p.punch[]` `{id,area,text,status:''|ok|fix|done|na,photo(hjFileRef),note,at}` — 추가공사(p.extras)와 같은 자리, **최상위 저장 키 41개 그대로**. 공간별 기본 항목(`PUNCH_DEFAULT_ITEMS`, 11개 공간)은 고른 공간만, 이미 넣은 공간은 다시 안 넣는다. 사진 연결은 extraWork 와 같은 안정 참조·치유(hjFilesByRefs·hjRefHealOk).
- 준공 전 체크(STAGE_CHECK[3])에 '준공 하자점검표 작성·고객 확인' 줄 추가 — `stageChecklistItems` 가 현재 상태(점검 N곳·양호·보수 필요 남음)를 셋째 칸에 넣고, `STAGE_CHECK_GO.punch` 가 점검표를 연다. 보수 필요가 남아도 완료로 올리는 것은 막지 않는다(알려만 준다).
- 대시보드 '오늘의 체크'(v344 `acts` 버튼 틀 확장: punch·progress): 보수 필요가 남은 현장 → 점검표, **오늘 사진을 찍은 시공(stage 2) 현장 → 기존 `customerProgress`(고객 진행 보고)** — Houzz/Buildertrend 의 '일일 고객 업데이트'를 기존 문안 기능으로 잇는다.
- 고객 확인 글 `hjPunchText` (보수 예정/완료 나눠 적음, 자동 발송 없음, 연락처 있으면 `hjSendSms`). 인도 뒤 접수는 그대로 AS 관리.
- 검사 계약을 셋 올렸다: 더보기 메뉴 수 **119 → 120**(`mobile-more-tools` TARGETS 에 `punchlist:['punchListView']`, `mobile-more-sweep`·`mobile-office-connect` 의 119), `completion-links` ① 준공 전 체크 GO 버튼 목록 맨 앞에 `punch`. tap-inline(인라인 버튼 44)·sweep(체크 label 44) 규칙 때문에 상태 버튼·기본 항목 버튼·공간 칩을 44px 로 맞췄다.
- 새 `tests/punchlist-v345.e2e.js` 3/3(390px·저장 키·대시보드·문안). 필터 없는 `tests/run-all.js` 233개 중 225 통과 → 위 계약·44px 수정 뒤 관련 17개 재실행 17/17; 남은 4개(apartment-projects·document-select·document-upload·team-workboard)는 v341 때와 같은 컨테이너 한글 다운로드 이름 문제.

## 2026-10-08 v344 고객·수금 빠른 입력 (Claude Cowork, v343 위 — PR 대기)

- 기준은 v343 브랜치 `claude/v343-followups`. 대표 "더 개발 진행" — v342 목록에서 남은 '고객·수금 입력 바로가기'. 버전 핀 `hyeonjang-v344-quickinput`.
- 대시보드 '오늘의 체크'의 v342 알림(수금 기록 없음·고객 연락처 없음)에 현장 이름 버튼(`acts`)을 붙였다 — `data-recvquick`(기존 `recvQuickView` 입금 기록)·`data-custquick`(새 `hjCustQuickView`). 텍스트 브리핑(L.push)은 그대로 문장만.
- `hjCustQuickView(현장, {lead})`: 이름·연락처·주소, 명함에서 불러오기(`loadCustomerFromCard`), 빈 입력·숫자 9자리 미만 번호는 `hjFieldIssue` 로 막는다. 저장은 현장 화면 고객 칸과 같은 `setCustomer` 3번.
- 견적 '날짜 · 프로젝트' 창에서 현장을 저장한 직후 `hjCustOfferAfterAssign` — 그 현장 고객 이름·연락처가 모두 비었으면 한 번만 묻는다(`__custOffered`, 이 화면 동안 같은 현장은 다시 안 물음). 견적 파일에는 연락처가 없어 자동 채우기는 하지 않는다.
- 부가세 준비(`vatReportData`) 매입에 지출장부(`state.expenses`)의 자재·외주를 넣었다 — projStats 와 같은 택일 규칙(현장에 수기 자재/외주비가 있으면 그 항목은 수기만, 없으면 장부만), 현장 없음·보관 현장의 장부 지출은 날짜 기준. v343 외주(매입) 견적 → 외주 지출이 이제 매입세액 공제 쪽에 잡힌다. 장비·유류·식대·기타는 예전처럼 제외.
- `durableLocalMutation` 저장 왕복 뒤 파일 id 가 바뀔 수 있어 새 검사는 이름으로 다시 찾는다. 새 `tests/quickinput-v344.e2e.js` 4/4(v343 에서는 0/4·마지막 한 건은 장부 반영 전이라 실패). 필터 없는 `tests/run-all.js` 232개 중 228 통과(실패 4개는 v341 때와 같은 컨테이너 한글 다운로드 이름 문제), 부가세 반영 뒤 세무·장부·대시보드 관련 21개 재실행 21/21.

## 2026-10-08 v343 드라이브 빈 기록 예방·외주(매입) 견적·옛 호수 현장 합치기 (Claude Cowork, v342 위 — PR 대기)

- 기준은 v342 브랜치 `claude/v342-estimate-dup-fixes`(main `ce3b80e` 위 1커밋). 대표가 v342 다음 단계로 세 가지를 골랐다. 버전 핀 `hyeonjang-v343-followup`.
- 드라이브 빈 기록 예방: `applyData` 병합에서 `hjSavedDriveGhost(s)` 가 참이면 그 저장 기록을 새로 만들지 않는다(`window.__driveGhostSkipped` 로 셈). 조건은 v342 `hjDriveGhostRecords` 와 같다 — PC 원본 기록(handle·_file)이 같은 Drive ID·같은 이름을 쓰고, 저장 기록이 더 가진 정보(현장·공정·작업명·동호수·연락처·메모·장부·견적·집계 제외·원본 증빙)가 없을 때. 되돌리기(revert)와 PC 원본이 없는 기기(폰)는 예전 동작 그대로. v323 `equalSizeScanPhotoPair` 통과 규칙은 건드리지 않았다.
- 외주(매입) 견적: 견적 탭 [상세 입력 → 🏢 외주(매입)] → `hjEstTogglePurchase`. 같은 견적의 사본(엑셀·PDF)까지 `est.purchase`·`est.purchaseKey` 를 켜고 `estimateGroups` 가 건너뛴다(매출·청구·부가세 매출에서 빠짐). 현장·금액이 있으면 `expenseAdd({category:'외주', sourceKey:'estpurchase:…'})` 로 한 번만 지출 기록 → projStats 외주 원가(수기 외주비 없을 때). 되돌리면 금액·현장이 그대로인 그 지출만 지운다. 목록 배지·견적 합계 줄·정산 엑셀 '집계' 열·대시보드 '오늘의 체크'(다른 업체 이름 견적이 매출에 잡힘)에 표시. 부가세 매입(vatReportData)은 기존대로 수기 원가만 본다.
- 옛 호수 현장 합치기: 아파트 관리 탭 [🏢 옛 호수 현장 합치기] / 방치 현장 화면 → `hjAptLegacyMergeView`. 후보는 `aptNameParse` 로 읽히고 같은 `aptComplexKey` 단지 현장이 정확히 하나일 때만, 판정은 v331 `aptProjectPreview`(→ `aptProjectSourceCheck`) 그대로. 적용 `hjAptLegacyMergeApply` 는 `aptProjectApply` 와 같은 변경(사진 동·호수 이동·공정 합집합·원본 보관 aptPhotoArchive)을 한 `aptUnitMutation` 안에서 여러 곳 처리 — 안전판 1회(12곳을 하나씩 하면 안전판이 모두 밀려난다). 동 없는 이름·'704-1102'·약칭은 추정하지 않고 '직접 확인'으로만 보인다.
- 정규식은 상수(`HJ_UNITNAME_RE`·`HJ_VENDOR_RE`). 새 `tests/followup-v343.e2e.js` 3/3(v342 에서는 0/3). 필터 없는 `tests/run-all.js` 231개 중 227 통과 — 실패 4개는 v341 때와 같은 컨테이너 한글 다운로드 이름 문제이며, 다운로드 이름만 너그럽게 한 로컬 사본으로 네 검사 모두 끝까지 통과(실측 2026-10-08).

## 2026-10-08 v342 견적 이중 계상·사진 중복 도구·운영 정리 (Claude Cowork, 로컬 검증 — PR 대기)

- 기준 main `ce3b80e`(v341 #173). 대표 자료(브라우저 실데이터, 읽기만)에서 확인한 문제를 고친다: 미배정 PDF가 현장 엑셀과 따로 매출에 더해짐, `파일.xlsx - 견적서.pdf`(구글 시트 출력)·`- 복사본` 정규화 실패, 10억 오인식 금액, 견적 탭 합계만 전 현장을 한 번에 묶어 다른 숫자, 중복 사진 검사가 같은 크기 묶음 앞 50장에서 매번 멈춰 늘 0장, 같은 Drive ID 빈 기록 242개, 두 현장에 들어간 같은 사진 14장, 세금 기한 휴일 미보정, 목록 미리보기 800px.
- 견적: `hjEstNormName`(밖으로 뺀 정규화), `hjEstSkipIds`(10억 이상 미수정 금액·`hjLooseEstShadows` 미배정 사본을 `estimateGroups` 가 exSum 처럼 건너뜀 — 모든 집계가 한 곳에서 따라온다), `hjEstIssues` 목록 배지(10억·1만 미만·파일명 금액 불일치·다른 업체명·미배정 사본), 견적 탭 합계는 현장별 묶음(hjSalesEntries 와 같은 값)·배정/미지정 분리, 대시보드 '진행 현장 견적'+미지정 별도, 정산 엑셀 '집계' 열, `hjFuzzyProjectFor`(오타 1글자·단지 토큰, 기본 체크 해제, 동점이면 제안 안 함, 스캔 뒤 자동 창은 정확 일치만).
- 사진: `verifyDuplicatePhotos` 는 같은 크기 + 같은 `duplicateMetadata` 후보만 읽고 확인한 후보는 `__dupCleanSigs` 로 건너뜀([다음 묶음 검사]). `hjDriveGhostRecords`/`hjRemoveDriveGhosts`(PC 원본 기록과 Drive ID·이름이 같고 더 가진 정보 없는 빈 기록, removedIds 넘기지 않음), `hjCrossDupFind`/`hjCrossDupMerge`(크기·촬영시각 같은 두 현장 사진을 바이트로 확인 → 현장 쌍마다 남길 현장 선택, 공정·메모 이전 후 `saveVerifiedDuplicates`). `deletePhotoRecordsSafely` 는 남은 기록이 쓰는 Drive ID 를 삭제 목록에 올리지 않는다. 자동 병합(applyData·equalSizeScanPhotoPair)은 건드리지 않았다.
- 운영: 방치 현장 화면에 [완료로]·[보관]·빈 현장/60일+ 일괄 보관(안전판 뒤), 오늘의 체크에 수금 기록·고객 연락처 빈칸 알림(견적 파일에 연락처가 없어 자동 채우기는 하지 않음). `hjTaxDueDate`(토·일·고정 공휴일·2026~2029 설·추석) — 일정 id 는 법정 날짜 그대로, `_taxAuto` 이고 법정 날짜인 예전 자동 일정만 실제 기한으로 옮긴다. 목록 미리보기 `HJ_GRID_THUMB_W=320`, `relayCall` 3초 넘으면 오른쪽 아래 대기 표시(요청 자체는 그대로).
- 정규식은 상수(`HJ_HANGUL_ONLY_RE`·`HJ_YMD_RE`·`HJ_COPYISH_RE`) — office-ops-isolation 토크나이저 규칙. APP_BUILD/SW/TARGET_BUILD = `hyeonjang-v342-dupfix`.
- 목록 미리보기를 320px 로 줄였으므로 `tests/apartment-projects.e2e.js` 의 허용 썸네일 주소(가짜 Drive 썸네일 GET)도 `=w320`·`sz=w320` 으로 맞췄다. 컨테이너에서는 이 검사가 앞쪽 다운로드 이름에서 먼저 떨어져 이 단정까지 못 가므로, 다운로드 이름만 너그럽게 한 로컬 사본으로 끝까지 돌려 확인했다(apartment-projects·document-select·document-upload·team-workboard 모두 끝까지 통과).
- 새 `tests/estimate-photo-dup-v342.e2e.js` 11/11(v341 에서는 1/11 — 회귀를 실제로 잡는다). 필터 없는 `tests/run-all.js` 229개 중 224 통과 — 실패 5개 중 `photo-safety-ui` 는 이 변경의 버그였다(중복 검사 '확인 끝' 서명에 원본 출처가 없어 같은 id·크기·정보로 바이트만 바뀐 시드를 건너뜀 → 서명에 Blob/핸들 객체 id·원본 증빙 추가, 이후 통과). 나머지 4개(`apartment-projects`·`document-select`·`document-upload`·`team-workboard`)는 v341 기준에서도 같은 자리에서 떨어지는 컨테이너 한글 다운로드 이름('download') 알려진 실패. 수정 후 관련 46개 재실행 46/46. 실데이터 읽기 전용 대조: 견적 합계 72,401,700 → 69,431,700(태산그린 `xlsx - 견적서.pdf` 2,970,000 한 건). 이 세션은 GitHub 쓰기 권한이 없어 브랜치·PR 은 대표 또는 권한 있는 세션이 올린다.


## 2026-10-07 v340 불러온 사진의 개별 삭제 (배포 승인, PR 검증 대기)

- 기준 main은 `073f0e2`(v339, PR #171). 사용자 요청은 드라이브·백업 사진도 삭제 가능하게 수정하는 것이다. PC hover 추가와 최종 검증 결과를 안내한 뒤 2026-10-07 사용자가 "배포"로 수정본 업로드·PR 검증·main 병합·GitHub Pages 반영을 승인했다. 실제 사진 삭제·원본 변경·서버 배포는 포함하지 않는다.
- `photoActionTools()`를 전체 사진·현장별 보기에 공통 적용한다. 사용자 후속 요청에 따라 PC는 `_virtual` 사진도 이미지 hover 또는 키보드 focus 시 휴지통으로 바로 삭제 확인창을 연다. 모바일은 `⋯` 메뉴를 유지한다. 가상 사진의 이동·이름 변경 제한 및 실제 파일의 PC 도구는 유지한다.
- 기존 `deletePhoto()`와 강제 안전판·CAS 저장·원본 보존 경로는 변경하지 않는다. 실제 사진·Drive 자료·서버 설정을 변경하거나 삭제하지 않았다.
- APP_BUILD/SW/TARGET_BUILD는 미배포 후보 `hyeonjang-v340-photodelete`를 유지한다. 새 `photo-delete-access.e2e.js`는 8가지 UI 경로의 실제 hover·계산된 opacity·키보드 focus·확인·취소·안전판·목록/재유입 방지 저장을, 변이 검사는 전체/현장별·PC/모바일 도구 누락·hover 누락·가상 사진의 불가 동작 노출 6종을 확인한다.
- 읽기 전용 사전/수정 후 검토 완료. hover 추가 전 Windows 격리 합성 검사: 관련 6/6, 변이 4/4 탐지, 전체 228/228(실패·재시도 0, 16.2분, 종료 0). hover 추가 후 최종 결과: 관련 6/6, 변이 6/6 탐지, 필터 없는 `tests/run-all.js` 228/228(실패·재시도 0, 13.6분, 종료 0). PC hover·모바일 메뉴 스크린샷도 확인했다. 운영 사진 삭제·실계정·실기기·배포 검증을 뜻하지 않는다.

## 2026-10-05 v339 기기·서버 선택 서류 업로드 (배포 승인, PR 검증 대기)

- 최신 기준 main `f236d39`는 PR #170의 v338이다. PR 전체 226/226(실패·재시도 없음), Pages 실행 `37253994462` 성공 및 공개 18파일 해시 대조를 확인했다. 아래 v338의 PR 검증 대기 표기는 당시 기록이다.
- 사용자 확인: 서류·견적서·정산서는 스캔이 아니라 직접 업로드하며, 현재 기기에 원본을 보관·항목/프로젝트로 정리하고 회사 서버에도 저장한다. `codex/document-upload-flow-20261005`의 코드·합성 검사만 변경한다. 최종 로컬 검증 결과와 9개 파일 범위를 안내한 뒤 2026-10-05 사용자가 "배포 진행"으로 해당 브랜치 업로드·PR 검증·main 병합·GitHub Pages 공개 배포를 승인했다. 실제 업무 파일·PC/Drive 이동·Apps Script 배포·설정·계정·발송·PC 종료는 범위 밖이다.
- 파일 선택을 먼저 표시하고, 서버 원본 저장은 기본 체크 해제 상태에서 사용자가 선택한다. 최초 기기 등록은 v338의 strict 원본 보관·안전판·CAS를 유지한다. 서류 종류·프로젝트 이동은 앱 메타데이터만 바꾸며 원본 이름/폴더/금액은 보존한다. 견적 읽기는 별도 선택 동작이다.
- 기존 doc API에 맞춰 서버 원본은 PDF/XLSX/XLS/JPG/PNG와 파일당 9MiB까지다. 다른 형식·큰 파일은 기기만 보관한다(기기 25MiB/파일, 50개/100MiB). 서버명은 짧은 `hjdoc_<UUID>.<ext>`이고 공통 doc 폴더에 저장하며 원본 이름은 앱 메타데이터로 보존한다. 폴더별 실제 이동/RBAC를 제공한다고 설명하지 않는다.
- 기존 서버는 멱등 createFile 계약이 없으므로 legacy relayQueue/자동 재시도를 쓰지 않는다. origin Web Lock + IDB atomic attempted 예약을 요청 전에 보관하고, 고정된 URL/token/device 연결로만 전송한다. 응답 ID는 CAS보다 먼저 기기에 보관한다. 응답 유실은 완전 목록의 유일한 UUID명·MIME·크기·ID 후보를 전체 원본 SHA-256으로 검증하며 누락/중복/잘린 목록은 자동 재전송하지 않는다. 다른 연결로 자동 복제하지 않는다.
- 서버 응답·다운로드·기기 캐시의 원본 해시를 검사한다. 선택 복원은 현재 Blob/검증 증빙을 유지하고, 전체 안전판 복원은 실제 Drive ID를 유지한 채 IDB 전송 증빙으로 같은 ID를 수동 재검증한다. 다른 기기는 검증 다운로드 후 원본 캐시만 저장하고 명시 서버 확인에서 앱 증빙을 복구한다. 읽기 중 앱 CAS로 내려받기/견적 읽기의 신원을 바꾸지 않는다.
- 원본 bytes는 선택 파일만 전송하지만 기존 서버 `save`는 앱 전체 프로젝트·고객·견적·정산·수금·파일 분류 정보를 저장한다. 두 동의 화면에서 이 범위를 명시하고, 같은 회사 서버 인증을 가진 사용자가 원본을 볼 수 있음을 알린다. revision 충돌/네트워크/연결 전환이면 공유 완료로 표시하지 않으며 이전 성공 안내를 남기지 않는다.
- 읽기 전용 사전·수정 후 검토에서 전체 복원/공유 범위/이전 성공 안내/읽기 자기 무효화 발견을 보완했다. `tests/document-upload.e2e.js`와 보호 제거 6종·부팅 측정 변이 1종, 기존 서류 검사, 필터 없는 전체 검사 및 모바일 화면 결과는 `docs/document-upload-v339-20261005.md`에 실제 실행 후 기록한다. 기존 서류 새로고침 검사는 async IDB 뒤의 실제 GIS preload requestfailed 종료 신호를 기다린 뒤 기능 요청을 측정한다. 제어된 preload 지연과 대기 제거 변이로 경계를 입증하며 외부 요청 금지 단언·타임아웃·재시도 기준은 완화하지 않는다. 파일/공유 체크 행은 22px 체크박스와 44px 이상 label 터치 영역, 13px 이상 안내로 정돈한다. APP_BUILD/SW/TARGET_BUILD는 `hyeonjang-v339-documentupload`로 일치시키고 공개 18파일·read-only PR 권한·기존 180초/재시도 정책을 유지한다.
- 2026-10-05 최종 로컬 전체 검사: 227/227, 실패·재시도 0, 종료 코드 0(18.8분·동시 3). 새 업로드 6종·부팅 경계 1종·기존 서류 5종의 보호 제거 총 12/12 탐지, 320/390/1280 화면 및 공개 18파일 바이트 대조를 확인했다. 중단된 실행의 회수 불가 결과는 통과 증거로 사용하지 않고 동일 코드로 재실행했으며, 저장소 밖 `_artifacts/v339-final-validation-20261005-resume/`에 로그/JSON/코드 시작·종료 SHA-256을 보관했다. 이후 변경은 완료·승인 문서뿐이다. 승인 시점의 원격 main은 `f236d39`/v338로 재확인했다. PR 전체 검증 → 병합 → Pages 성공 → 공개 18파일/빌드/격리 화면 대조 전에는 공개 완료로 보고하지 않는다. 실제 배포 증거는 PR 및 저장소 밖 릴리스 기록을 따른다.

## 2026-10-05 v338 선택 서류함 (배포 승인, PR 검증 대기)

- 사용자 요청: 필요 서류 항목을 만들고 파일만 선택 등록하며 견적·정산도 선택 방식으로 사용하고 서류를 이동하여 전체 읽기를 줄인다. 새 브랜치 `codex/document-select-import-20261005`는 최신 main `6c174cf`에서 시작했다. 2026-10-05 사용자가 검증한 수정본에 "배포 진행"으로 브랜치 업로드·PR·main 병합·공개 배포를 승인했다. 실데이터·PC/Drive 원본 이동·Apps Script·계정·발송·PC 종료는 하지 않는다.
- 회사 공통 항목은 `brand.documentItems`, 개별 분류/기기 보관 원본 UUID는 `files[].documentMeta`에 보관한다. 기존 41개 최상위 계약은 유지하며 color/logo/알 수 없는 설정은 보존한다. 정산서는 kind=other이고 매출·견적 집계에 추가하지 않는다. 견적/비견적 종류 전환과 파생 견적 이동은 차단하며 작성 견적은 기존 날짜·프로젝트 기능을 쓴다.
- 새 append-only 선택 등록은 폴더 스캔·자동 OCR·섬네일/EXIF 읽기 없이 고른 원본만 IDB에 보관 후 strict readback·안전판·CAS 커밋한다. 이름·크기 충돌은 등록을 막아 확인하게 한다. 실패/커밋 후 UI 오류에도 새 원본 캐시는 삭제하지 않는다. JSON 백업/서버는 원본 Blob을 포함하지 않으므로 이 기기 보관/원본 업로드 별도를 화면에 표시한다.
- 앱 내 이동은 metadata-only이며 이름·prefix·Drive ID·금액·수금은 보존한다. 항목만 바꿀 때 각 프로젝트는 유지 가능하다. 수동 서류는 동일 Blob/Drive/SHA 또는 정확 fileKey+수정일로만 복원하며 이름 폴백 연결을 금지한다. 최종 role와 kind를 일치시키고 6개 복원/직렬화 경로를 대칭 지원한다.
- 기존 전체 OCR은 수동 항목을 건너뛴다. 새 선택 견적 읽기는 PDF/엑셀만 분석하고 수정 금액을 보존하며 외부 AI OCR·Drive 이동을 호출하지 않는다. 정산/서류 미리보기는 금액을 쓰지 않는다. Word/HWP 등은 기기 원본 내려받기로 열 수 있다.
- `tests/document-select.e2e.js`는 격리 브라우저/합성 파일로 등록·취소·오류·CAS·커밋후 실패·재스캔·복원·금액·모바일 및 Excel 연결을 검사한다(Excel 라이브러리 디코더만 합성). `document-select.mutations.js` 5종은 메모리 HTML에서 보호를 제거해 실제 회귀가 실패하는지 본다. PR 권한은 read-only 그대로이며 배포하지 않는다. 읽기 전용 사전/수정 후 검토에서 발견한 원본 이름 폴백/keepSource 분류 불일치는 보완했다.
- 최종 로컬 결과: 필터 없는 `node tests/run-all.js` 226/226, 실패 0, 재시도 없음(13.2분, 동시 3). 이후 선택 서류함 재검사 1/1(재시도 없음), 보호 제거 5/5 의도한 실패 탐지(변이 자식 종료 1, 러너 종료 0), 공개 허용목록 18파일 staging·diff check 통과. 320/390/1280px 모의 화면과 스크린샷을 확인했다. 실제 고객 파일·실기기·실계정·클라우드 원본 업로드를 검증했다는 뜻은 아니다. 승인한 7파일은 index/SW, version-sync, 선택 서류 E2E/변이 검사, read-only PR 검증 workflow, 이 문서이며 실제 CI·병합·Pages·공개 파일 대조 결과는 해당 PR 검증 기록을 따른다.

## 2026-10-03 v336 인수인계 정정·v337 테스트 안정화 (제품 변경 없음)

- 대표가 세 첨부 검토 뒤 "수정해여 배포"로 수정·브랜치 업로드·PR·main 병합·Pages 배포를 승인했다. 기준 main은 PR #167의 `df5d8e3`, 제품 빌드는 `hyeonjang-v337-customermessages`다. 테스트·문서·PR 검증만 수정하며 APP_BUILD/SW/TARGET_BUILD 3곳, 공개 18파일, 실제 계정·사진·Drive·Apps Script·발송·PC 종료는 바꾸지 않는다. 아래 과거 '미배포'는 당시 기록이다.
- 첨부 패치는 main `bea9902`/v335 기준으로, 테스트 2개는 같지만 AGENTS 절은 충돌한다. 원본 PDF/메일 패치를 덮지 않고 최신 main에 최소 변경을 재작성했다. 병합 뒤 v335로 되돌리지 않는다. 수정 안내·검증 경계는 `docs/test-stability-v337-20261003.md`.
- portal-key ⑪: 이번 applyData의 `toast()` 호출을 직접 기록하면서 원함수도 호출한다. warranty ⑤(⑦): 직전 토스트를 비우고 새 알림과 e1/e3의 정확한 공정값을 기다린다. 대기 실패를 catch로 삼키지 않는다. 최종 보안·사진 공정 단언은 유지한다.
- auto-sync의 설정 완료 신호 뒤에도 relayBoot는 IDB 대기열을 읽는다. 실제 boot/배지/online listener와 지연 합성 IDB를 사용해 기존 측정 2회(online+relayBoot), BootDone 대기 후 1회(online만)를 결정적으로 재현했다. 첨부의 '부팅 경합 가설 기각'은 일반 기각 근거가 아니므로 정정한다. eventTrigger 측정에만 실제 `__hjRelayBootDone` 대기를 넣었고 기대 `calls:2, afterOnline:1, queueFlushes:1`은 유지한다. 실패 시 합성 호출 스택을 진단으로 남긴다.
- `test-stability.unit.js`는 실제 boot/listener와 E2E 공용 probe를 검사한다. inbox coordinator·IDB만 합성이다. `test-stability.mutations.js`는 앱 파일을 고치지 않고 HTML을 메모리에서만 바꿔 보호 제거 5종을 검사한다. PR 검증은 기존 전체 회귀 뒤 이 변이를 추가한다. 180초 제한·기본 동시 수·기존 단독 재시도 1회는 변경하지 않는다. 최종 전체 종료코드 0 및 CI/Pages·공개 파일 일치 전에는 완료라고 보고하지 않는다.
- 로컬 Windows: 정적 5종·OfficeOps 서버 격리·결정적 VM 통과(종료 0). 포털 11/11·보증서 19/19·auto-sync·VM baseline 4파일 통과, 보호 제거 5/5 의도한 실패 탐지(각 종료 1, 변이 러너 종료 0). 관련 읽기 전용 사전/수정후 검토 완료. 필터 없는 전체 225파일은 PR CI에서 실행하고 실제 결과·재시도·Pages/공개 완료는 해당 PR 검증 기록을 따른다. 실계정·실기기 검증을 뜻하지 않는다.

## 2026-10-03 v337 배포 승인 및 병합 전 게이트

- 사용자가 v336 선택 첨부와 v337 고객용 문구의 배포를 승인했다. 브랜치 `codex/biz-select-send-20261002`에서 업로드·PR·전체 검증·main 병합·Pages 반영을 진행한다. 아래 '미배포/보류'는 개발 당시 기록이다. 실제 공개 완료는 PR/Pages 실행과 라이브 파일·화면 확인으로 별도 증명한다.
- main 기준은 `bea9902`로 재확인했다. 최종 제품 변경 후 선택/문구 79/79, 보호 제거 17/17, 모든 정적·단위 파일 38/38, Pages 허용목록 검사 통과(종료 0). 필터 없는 전체 `node tests/run-all.js` 224개는 병합 전 CI에서 실행하며 결과가 나오기 전 완료로 보지 않는다.
- 별도 `.github/workflows/verify-release.yml`은 main 대상 PR만 검사한다. `contents: read`, checkout 자격증명 미보존/전체 이력, Node 22·기존 Playwright 설정, 인자 없는 전체 회귀·선택 공유 변이·공개 18개 허용목록 staging만 수행한다. Pages 권한·환경·artifact 업로드·배포·비밀값 참조가 없고 기존 main Pages 게이트는 그대로다. 관련 읽기 전용 사전 보안 검토에서 차단 사유가 없음을 확인했다.
- 실제 사업자 원본·고객 발송·계정·Drive·Apps Script·사진/현장 자료는 변경하지 않는다. PC 종료도 이번 승인에 포함하지 않는다.

## 2026-10-02 고객용 문구 20종 v337 (로컬 개발, 미배포)

- 같은 `codex/biz-select-send-20261002`에서 v336 선택 첨부 기능 뒤에 고객용 초안 20종을 추가했다. `bizCustomerPresets`를 기존 추천 11종 뒤에 전개하여 종전 인덱스는 유지한다. 기본 문구는 총 36종이다. 기존 저장·수정·삭제 문구를 자동 이관/덮어쓰기하지 않고 직접 추천 선택/추가 때만 저장한다.
- 변경 작업·일정·정산은 부드럽게/명확하게 두 표현이다. 실제 금액·일시·계좌·점검 원인·책임·보상·미납/입금 완료를 단정하지 않는다. 고객용 초안 안내 한 줄을 보강했고 실제 발송·서버·Drive·자료·PC 종료는 변경하지 않는다. 기존 share/send/storage 동작은 이번 문구 추가에서 그대로다.
- 최신 빌드 3곳은 `hyeonjang-v337-customermessages`. 문구/선택 합성 검사 79/79, 보호 제거 변이 17/17, 모든 정적·단위 파일 38/38 통과(종료 0). 읽기 전용 문안 검토 완료. CUA 로컬 PC/360px에서 추천 선택·기존 첨부 유지·초안 표시, 넘침 0·버튼 44px·입력 16px 확인. 전체 브라우저 CI·실제 카톡 수신·공개 배포는 미진행이다. 문구 목록/예시/검증 경계는 `docs/customer-messages-v337-20261002.md`.

## 2026-10-02 사업자 자료 선택 공유 v336 (로컬 개발, 미배포)

- 기준 main은 `bea9902`, 공개 v335다. 사용자 요청은 상황별 문구 확대와 매번 체크한 사업자등록증·통장사본·명함·추가사진만 공유하는 기능이다. 실제 서류·Drive·서버·계정·고객 발송·공개 배포·PC 종료는 변경하지 않는다.
- `bizSelectedEntries` 한 곳이 공유와 다운로드 대상을 결정한다. 첨부 선택은 화면 세션에만 유지하며 새 열기/닫기에 해제한다. 내부 문구 변경/사진 등록에는 유지한다. 빠른 선택 버튼은 체크만 바꾸고 발송하지 않는다. 문자앱은 글만, 파일 공유 미지원/취소/실패는 자동 글 공유·다운로드·복사를 하지 않는다.
- `loadBiz`는 strict 읽기 전용이다. 기존 수정/삭제/빈 문구를 보존한다. 추천 문구 11종을 추가했고 추천 선택/명시 추가 버튼으로만 저장한다. 원본 EXIF 대신 기존 canvas JPEG 등록 경로를 유지하고, 저장된 이미지 URL은 raster data URL만 허용한다.
- `__bizEpoch`는 지연 작업의 새 창 변경을 차단하고 `bizWithEdit`는 겹치는 수정/삭제를 막는다. 선택된 추가사진 앞 항목 제거 시 같은 사진의 인덱스를 보정한다. 새 문구는 빈 `biz_text`까지 저장한다. 공유창 전달·다운로드 요청을 실제 수신/저장 완료라고 기록하지 않는다.
- 빌드 3곳은 `hyeonjang-v336-bizselect`. 신규 합성 DOM/IDB 검사 `biz-select.unit.js` 54/54, 보호 제거 `biz-select.mutations.js` 13/13 탐지, 전체 정적·단위 파일 38/38 통과. CUA 로컬 PC/360px 화면에서 넘침 0, 버튼 44px, 입력 16px를 확인했다. 실제 휴대폰/카톡 수신과 필터 없는 전체 브라우저 회귀는 미검증이며 배포 전 게이트로 남긴다. 상세 `docs/biz-select-v336-20261002.md`.

## 2026-10-02 운영 연결·동호수 업무·배정 수락 v335 (배포 후보)

- 사용자 승인 범위는 조사 후 1→2→3 구현과 브랜치 업로드·PR·main 병합·GitHub Pages 배포다. 실제 Apps Script 설치·속성·계정·Drive 자료·사진 배정 변경·문자/푸시·PC 종료는 포함하지 않는다.
- 기준 공개 main은 `6710e52`, PR #165의 v334다. v333~v334 전체 220/220 및 Pages 실행 `36964190482` 성공과 공개 18개 파일 대조를 확인했다. 아래 옛 '미배포' 표기는 당시 개발 단계의 기록이며 현재 상태는 이 절을 따른다.
- 현장 앱 대시보드/웹 접수에 「운영 연결 점검」 추가: 초기 열기는 읽기 전용이고 직원 서버 `health`는 직접 눌러야 요청한다. 설정·응답·실계정 인증·원본 존재는 구분한다. 비밀번호·토큰·폴더 ID는 표시하지 않는다. 늦은 응답은 화면/서버가 바뀌면 폐기한다.
- 「연결 JSON 만들기」는 안전판·CAS·내구 저장 경로로 프로젝트 내부 `companyProjectKey` UUID를 최초 1회 저장한다. 41개 최상위 직렬화 키는 그대로다. 아파트명·등록 동호수/공용부만 명시 내보내며 고객·메모·사진·금액은 넣지 않는다. JSON은 회사 대표에게만 전달한다.
- 직원 서버의 `project-units-v1` / `task-ack-v1` capability를 보고 새 기능을 연다. service는 `company-team-v3`, schema는 1로 유지한다. 구서버의 기존 업무 수정은 가능하고 새 기능은 업데이트 필요로 안내한다. 백엔드 소스만 변경했으며 Pages 병합으로 실제 Apps Script는 바뀌지 않는다.
- 대표만 동일 서버의 연결 JSON을 미리보고 아파트 대상을 재확인해 저장한다. UUID는 유일/불변, 사용 중인 위치는 제거·변경 금지. 사진 연결 업무의 프로젝트/위치 재귀속 금지. 서버·화면 양쪽에서 직원/외주·팀장의 위치 목록을 볼 수 있는 업무 범위로 제한한다. 이름으로 자동 병합/사진 이동하지 않는다.
- 현재 담당자만 `taskAcknowledge`로 명시 수락한다. 서버 시각·배정 버전으로 기록하며 클라이언트 위조·대리 서명을 거절한다. 담당자/현장/위치/일정/지시 변경 시 재수락, 진행 보고는 기존 수락 유지. 응답 유실은 같은 UUID, 충돌은 최신 내용을 다시 읽고 확인을 다시 체크한다. 최대 100건 이력은 지우지 않고 한도에서 멈춘다.
- 테스트: `company-links-ack.unit.js`, `company-links-ack-ui.e2e.js`, `operations-connections.e2e.js`; 보호 제거는 `node tests/company-links-ack.mutations.js`. APP_BUILD/SW/version-sync는 `hyeonjang-v335-operationslink`.
- 마지막 코드 변경 후 인자 없는 `node tests/run-all.js`는 223/223 통과, 최종 실패 0, 종료 코드 0(17.5분·동시 3)이었다. `office-ops-conversion`의 병렬 형제 탭 저장 예상값 실패는 같은 코드 단독 재시도 106.3초로 통과했고 총 재시도 1회다. 단언·180초 제한·재시도 정책은 유지했다. 보호 제거 48/48 탐지도 통과했다. 로컬 결과는 `docs/operations-links-v335-20261002.md`, 병합 후 CI·Pages·공개 파일/화면 최종 확인은 해당 PR 검증 기록을 따른다. 실서버/실계정 검증과 혼동하지 않는다.

## 2026-10-02 직원 원본 대기열 개선 v334 (PR #165로 웹 배포 완료)

- 직원 원본 대기열은 직원 ID 하나가 아닌 팀 서버 URL·인증 서버 URL·회사 ID·인증 사용자 ID·직원 ID의 결합으로 분리한다. 검증된 연결 정보가 없으면 등록/전송하지 않는다. 서버를 바꿔도 원래 회사의 기기 원본은 보존한다.
- IndexedDB `hj-team-upload` 버전 1을 유지한다. 직원 ID만 든 이전 레코드는 자동 이관·전송·삭제하지 않는다. 현재 직원 ID에 해당하는 보류 건수만 안내하고, 파일명이나 다른 직원의 자료는 화면에 노출하지 않는다.
- 대기열 불러오기·저장공간 확인·원본 읽기·동영상 조각 읽기·충돌 재조회 뒤에 연결/로그인 세대와 권한 초기화 세대를 재검사한다. 취소 후 아직 보내지 않은 사진/조각은 전송하지 않는다. 이미 접수된 서버 원본은 취소로 삭제하지 않는다.
- 직원 작업실 → 프로젝트 사진에 현장·업무명·기기 등록 시각, 현장/상태 필터, 개수 요약, 현재 필터의 일시 오류 원본만 수동 일괄 재시도를 추가했다. 일시 오류 재시도는 원본·evidence ID·requestId를 유지한다(확인된 revision 충돌의 새 요청 발급은 기존 규칙 유지). 권한/형식 오류는 일괄 재시도에서 제외하며, 동료의 기기 대기열을 공유하지 않는다. 사진 올리기 버튼은 대기열보다 위에 두고 빈 대기열의 필터는 숨긴다.
- `team-upload-scope.e2e.js`, `team-upload-queue-ui.e2e.js`와 보호 제거 변이 검사를 추가한다. APP_BUILD / SW / version-sync는 `hyeonjang-v334-staffqueue`다. 기존 41개 직렬화 키, 원본 사진, Drive, Apps Script 백엔드와 실제 직원 계정/접수 자료는 변경하지 않는다.
- 당시 개발 요청에는 원격 배포가 포함되지 않았으나 이후 사용자가 전체 묶음을 명시 승인하여 PR #165로 웹 배포했다. v333 내용도 함께 포함됐다. 실제 Apps Script·실계정 전송·PC 종료는 수행하지 않았다.
- 전체 검사에서 실제 모바일 데모 종료 버튼이 탭 변경 경고에 가리는 결함을 확인했다. 경고의 저장 차단 상태를 해제하지 않고 데모 띠를 경고 아래로 배치하며, 경고 생성/닫기/창 크기 변경 때 갱신한다. `demo-banner.e2e.js`와 보호 제거 2개 변이가 실제 클릭·리로드와 경고/차단 상태 유지를 검증한다.
- `office-ops-isolation`의 중복 계산은 불변 토큰의 구조 캐시·정확한 소스 접두사/개행 경계의 추가 토큰화·동일 후보 함수 본문 캐시로 줄였다. 다른 원본/본문/스크립트 경계는 전체 분석한다. 차가운 전체 토큰화와 캐시 결과(위치·줄바꿈 포함)를 직접 비교하며, 모든 기존 격리·결함 주입 단언과 180초 제한을 유지한다.
- 최종 코드 변경 후 인자 없는 `node tests/run-all.js`는 220/220 통과, 실패 0, 재시도 없음, 종료 코드 0(19.8분·동시 3)이었다. 보호 제거 변이 27개(기존 업로드 10·연결/비동기 보호 11·대기열 UI 4·데모 경고 2)도 모두 탐지했다. 합성 자료·모의 서버 검사이며 실계정 인증/실제 Drive 전송/실기기 검증을 대신하지 않는다.

## 2026-10-02 Claude v332 후속 안전 검토 v333 (로컬 개발, 미배포)

- 기준은 `origin/claude/recent-web-project-a1foj1`의 `3fed1d7`이다. 공개 main/Pages는 v331이며 이 후속 작업은 실계정·프로젝트·사진·Drive 자료를 변경하지 않는다.
- 전체/선택 복원은 `hjSavedFileMatches`의 일대일 매칭을 공유한다. Drive 원본 ID·확인된 SHA-256·서버 원본 ID가 다르면 같은 경로/이름/크기라도 배정을 옮기지 않는다. 애매한 후보는 추정하지 않고 저장 기록을 남긴다.
- 저장 충돌 비교는 구성된 서버의 `load`만 읽고 건수/변경 여부를 표시한다. 비교 중 기기 자료·서버 연결·revision·창이 바뀌면 결과를 폐기한다. 비교 버튼은 적용·백업·저장·자동 병합을 하지 않으며 기존 3가지 선택과 안전판 가드를 유지한다.
- `file-identity.e2e.js`, `sync-conflict-preview.e2e.js`와 보호 제거 변이 검사를 추가한다. APP_BUILD / SW / version-sync를 `hyeonjang-v333-restoreguard`로 맞췄다. 마지막 코드 변경 뒤 필터 없는 전체 회귀가 필요하다.
- 전체 검사에서 발견한 기존 테스트 실행 문제도 수정했다. `operations-review`는 Windows에서 Playwright 기본 브라우저를 쓰며, `settings-safety`는 초기 문서의 load 이벤트와 데모 종료 reload를 혼동하지 않도록 실제 navigation·부팅 완료를 기다린다. 기대값·파일당 시간 제한·재시도 횟수는 바꾸지 않는다.
- 직원 서버의 실제 설치·Google 승인·직원 인증·실기기 점검과 웹 병합/배포는 별도 승인 및 검증 대상이다. 소스 검사를 실제 운영 활성화로 보고하지 않는다.

## 2026-09-26 현장 안전 v330 (PR 후보, v329 위 — 같은 PR #162)

3차 묶음(범위 밖 결함 5건) + **발굴 검토**: 8영역(견적·일정·사진 유입·정산·보증·관리사무소·복원·v329 통합)에 발견자, 발견마다
코드 근거·운영 규칙 두 반박자 — 둘 다 인정한 39건 중 38건(1건은 3차에서 이미 고침)을 여섯 작업 트리에서 고쳤다. 반박된 12건은 결함 아님.
- **매출·청구 한 벌**: 매출은 `hjSalesEntries()` 한 곳(부가세 신고 `vatReportData`·세무 엑셀·월말 결산 `collectQuotesByMonth`), 청구는
  `hjEstBill(name,groups)` 한 곳(집계된 견적 묶음마다 최신 앱 견적 품목, 묶음이 다르면 합친다 — v328 `hjCountedEstIds` 규칙의 확장).
  `projStats` 에 `bill`(청구서 공사대금 합계)·`billVat` — **잔금 due = bill + 추가공사 − 받은 돈**(부가세 별도 견적도 청구서와 같은 값).
  미연결 앱 견적은 **수주 표시(result 'won')일 때만** 매출. 받은 돈 음수 정정은 모든 보고에 들어간다. **매출·청구를 새로 셀 때 이 두 함수를 써라.**
- **견적 편집**: ✍ 편집은 앱 견적이면 원래 견적을 `editQuote`(깊은 복사), 엑셀·PDF 견적이면 부가세 포함/별도를 사람이 고른다(`quoteSupplyForTotal` —
  나눠떨어지지 않으면 '포함'을 내놓지 않는다). 저장하면 원본 사본 묶음 전체에 exSum. AI·사진 견적 초안은 **[저장] 전에는 목록에 없다**
  (`quoteCommitEditing` 한 곳, [목록으로]는 `quoteEditDirty` 면 묻는다). [📤 보냄]은 보낸 날짜만(종결·수주 유지). 목록의 앱 견적 금액칸은 읽기 전용.
  applyData 는 원본 견적이 없는 `quote_<id>` 파생 파일을 지운다.
- **일정**: `saveScheduleEdit` 는 레코드를 **바꾸지 않고 칸만 덮는다**(report·labor·prep·asId·icsUid·payPlan 보존, 0시간 허용). 세금 일정은 안정 id
  `tax_<날짜>_<종류>` + `state.calendarImports` 의 'tax:' 표식 — 지우거나 고쳐도 되살아나지 않는다. 분할납 💰 일정은 `payPlan:'down|mid|bal'` —
  다시 저장하면 앞으로 올 옛 회차를 갈아 끼운다(지난 날짜 회차는 받은 것으로 보고 둔다), 비율 합 100% 아니면 저장·문자 막음. 인건비 장부
  [지출 반영]은 현장 전체 기간 합계.
- **사진 유입**: 이름만 같은 기록끼리 합치지 않는다(iPhone 은 늘 image.jpg) — 서버 목록 병합(`relayLoadDriveFiles`)은 빈 미배정 복구 기록만
  합치고, 연결은 크기가 하나로 맞을 때만(둘 이상이면 고르지 않고 미배정). applyData 이름 폴백은 크기·현장이 달라도 안 합친다. 전송 대기열 항목은
  `ref`('k:'+fileKey)·project 를 기억해 성공 때 그 기록에 Drive ID 를 붙인다(`relayQueueLinkUpload`). 촬영 버튼 동영상은 앱 목록에만(서버 백업은
  사진 전용, 원본은 [🎬 원본 관리]). 같은 경로를 미배정으로 저장해 둔 정리 폴더 사진은 PC 스캔이 현장을 되살리지 않는다(`_orgNullKnown`, 세션 전용).
- **날짜**: 사용자 날짜는 `localDate()`·`localStamp()`. `toISOString().slice(0,10)` 류는 `tests/local-date.check.js` 가 막는다(허용 8곳 = 파일 이름·UTC 검증,
  줄마다 이유). **보증 만료는 `hjWarranty(p).end` 한 곳**(알림·점검 문자·보증서 같은 값, 보증 시작 안 누른 현장도 36개월). 완료를 내리면 준공일은
  `doneAtPrev` 로 옮겼다가 다시 올리면 되살린다 — 준공일을 바꾸는 길은 🛡 보증 수정의 준공일 칸(doneAt 도 맞춘다). [✍️ 서명 확인] 뒤
  `warrantyLinkSignedOpen` 이 서명 든 보증서를 연다. 보증 조항 `hjWarrantyClauses(termLabel,fromLabel)`.
- **관리사무소**: 오더 사진(`aptPhotoList`)은 그 단지 안에서만·동/호 경계 일치, 📸 탭도 같은 묶음(`__aptPhotoOrderId`). 정산서 부가세 표기는 오더의
  실제 조건(모르면 표기 없음). 미입금 청구는 6개월 창 밖이어도 보인다.
- **복원·삭제**: JSON 불러오기·엑셀 이사 전 안전판(`hjSnapshot(…,true,true)` — 실패하면 멈춤, 빈 새 기기도 되게 allowEmpty). 이사 마법사 JSON 버튼 =
  파일 고르기. AS 삭제는 `hjAsDelete` 한 곳(확인·안전판·연결 방문 일정 따로 묻기). 보증 링크 같은 contractId 는 한 줄.
- **3차(범위 밖)**: 보증 링크 idem 에 내용 지문, 카톡 카드·공사 스토리에 계약 부가세·공사기간(기록 값만), 지운 현장의 수금 일정 정리,
  전체장부 엑셀에 AS 새 칸·현장 부대사항(출입번호 걸러짐), 접는 머리 44·검증 오류 칸 표시 17곳 더, 계약 특약 검토 문서
  `docs/계약-특약-검토-20260926.md`(대표가 문안을 고른다 — 법률 자문 아님).
- 대표 확인 대기(v330): ① **부가세 별도 견적의 잔금·입금 문자·고객 페이지·영수증에 부가세가 붙는다**(청구서와 같게) ② AI·사진 견적 초안은 [저장]
  전 새로고침하면 사라진다 ③ 엑셀·PDF 견적 ✍ 편집 때 부가세 포함/별도를 매번 묻는다 ④ 보증 만료 알림·무상점검 제안이 약 1년 → 가장 늦은
  항목 끝(약 3년)으로 — 마감 1년 전 점검 알림을 따로 원하는지 ⑤ 정산서에 부가세 조건 모르는 손 입력 오더는 표기 없음 ⑥ 카톡 공사 스토리
  계약 줄 '(부가세 포함) — 서명 완료 · 공사기간 …' ⑦ 계약 특약 문서의 6문항 ⑧ 분할납 수금 여부를 날짜로 판정(미리 받은 앞날짜 회차는 다시
  저장하면 새 금액으로) ⑨ 이름이 같은 옛 사진은 확신이 없으면 미배정으로 남는다(미배정이 조금 늘 수 있다).
- 남은 것: 전송 대기열 연결 실패 때도 항목을 지워 fileId 를 잃는다(low) · AS 에서 방문 일정 날짜를 바꿔도 visitAt 안 따라감 · AI set_labor 가
  '이달현장합계' 라고 보고 · 선택 복원이 같은 이름 현장이 있으면 수금 일정·'(삭제됨)' 기록을 다시 잇지 않는다.

## 2026-09-26 폰 규칙 한 벌·실무 빈 고리 v329 (PR 후보, v328 위)

v328 과 같은 PR(#162)에 얹었다. 작업 트리 6개에서 구현 → 적대적 검토 → 고침.
- **폰 전역 규칙(body.mobile-mode 와 `@media(max-width:640px)` 양쪽)**: 입력 16px(`!important` — 인라인 113곳을 이긴다, 큰 글씨 모드는 `max(16px,…)`), 체크박스·라디오 22px + 감싼 label 44, `tel:`·`sms:`·버튼형 링크 44, 버튼 44. **새 화면에 16px·44px 을 또 덧대지 마라** — 패널별 덧댐은 죽은 줄이라 지웠다. 인라인 `min-height` 44 미만 버튼은 `tap-inline.check.js` 가 막는다. `--muted` #587391(흰 바탕 4.9:1), `.footnote` = var(--muted) — 대표 승인 2026-09-26.
- **`tests/mobile-more-sweep.e2e.js`**: 더보기 119화면을 대상 함수 스텁 없이 실제로 연다 — 360 폰 모드·360 PC 모드(@media 만)·768 폰 모드(body 규칙만) 세 번. 넘침·44·16·체크박스 22·Esc 초점 복귀·대비. 허용목록 3(addproject 브라우저 prompt·opendrive 새 창·restore PC 전용). 새 더보기 기능은 여기서 자동으로 검사된다.
- **AI 비서 시트**: role=dialog·폰 뒤로가기 = 닫기(`mobileSheetHistoryOpen`)·스크롤 잠금(`body.ai-sheet-open` — `modal-open` 을 쓰면 위에서 모달이 닫힐 때 풀린다)·연 버튼으로 초점(`aiSheetOpenA11y`/`aiHide(fromHistory)`).
- **검증 오류는 칸에 `hjFieldIssue(el,msg)`**(aria-invalid·칸 아래 role=alert·입력하면 풀림, 토스트는 그대로). AS·아파트 오더·거래처·자재·수금·노하우 7화면만 붙였다 — 나머지 검증 토스트 약 50곳은 아직. `#toast` role=status, 표시 시간 2.4초+글자당 40ms(상한 6초). 자료 없는 통계(funnelView·cashFlow)는 숫자 대신 .empty — '안정적' 단정 금지.
- **대시보드 표 카드화**: `dash-cards` 클래스 + `hjDashCardLabels`(헤더 → `data-label`), 폰이면 `wrapWideTables` 가 `.tbl-scroll` 로 감싸지 않는다(`hjDashCardsPhone` = CSS 와 같은 두 조건). 아파트 오더 줄 `.apo-head/.apo-tools` 는 폰에서 줄바꿈.
- **AS 기록(asLog 레코드 안)**: visitAt(넣으면 일정 등록을 묻고 `visitSchedId` 로 기억 — 다시 바꾸면 옮긴다)·fix·fee(비우면 무상, **옛 완료 기록에 '무상'을 지어내지 않는다**)·warrantyItem(**접수일 기준** 보증 안/밖)·photos(안정 참조). 'AS 방문' 일정은 공사 기간 계산에서 뺀다. 접수·보증 목록에 보관 현장 포함(`warrantyList(withArchived)`, 알림 `warrantyDue` 는 여전히 뺌). 고객 안내 문자는 기존 `msgTemplate('as')` 복사·공유뿐.
- **준공 체크 → 기능**: `STAGE_CHECK_GO`·`stageChecklistItems(p,idx)`. 예치금(siteRules.deposit)이 있으면 '관리실 예치금 환급 확인' 행. 작업지시 주의사항은 `hjSiteText`(출입번호 걸러짐)로 미리 채운다. 계약 초안 7항에 작업시간·엘리베이터·폐기물 칸 값(새 문구 없음). 도어락 안내는 문안이 없어 버튼 없음(문안 신설은 대표 승인).
- **견적 흐름**: 「📐 실측에서 가져오기」(`#qmMeasure`, 단가 0 — 금액을 짓지 않는다, `measureRef` 로 중복 방지). 미수주 **종결 = 옛 '실패'(result:'lost') 한 개념** + `lost:{at,reason}`(`HJ_QUOTE_LOST_REASONS` 5개), 수주 분석은 `quoteStatus` 한 곳으로 센다(수주 = 현장 연결 또는 수주 표시 — 결산 수주율이 오를 수 있다). 30일 지난 진행 견적은 `quoteStaleData`(365일까지). `customerTimeline` = `hjStoryData`(고객 화면에 계약·AS·보증·추가공사도 보인다).
- **v328 통합 후속(같은 PR)**: 청구서·명세서 품목과 `hjExtrasBill` 이 같은 '집계된 견적'(`hjCountedEstIds`)을 본다. 견적에 담는 추가공사는 부가세 포함/별도 둘 다 청구 합계가 확인 금액만큼만 오르게 단가를 역산한다. 이름 변경은 `due_` 수금 일정 id·제목까지. 전체장부 엑셀 **11시트**(추가공사 시트 — '견적에 담김' 행은 들이지 않는다). 선택 복원은 같은 `officeIntakeProjectId` 쌍둥이를 만들지 않고, '(삭제됨)' 기록이 하나뿐이면 다시 잇는다(`hjProjectTombstonesOf`). 지운 portal_key 는 IDB `portal_key_dropped` 로 되살아나지 않는다. 검사 `v328-integration.e2e.js`.
- 대표 확인 대기(v329): ① 폰 폭에서 입력·버튼이 커져 긴 화면이 조금 더 길어짐, 보조 글자 색 ② 준공 체크의 보증서·리뷰 버튼은 완료일이 생긴 뒤에야 동작 ③ 견적 '실패' → '종결' 표기(엑셀 상태 열 포함) ④ 공사 스토리(고객 카톡)에 'AS 처리 — 처리 내용 30자' 줄 ⑤ 통계 빈 화면 문구·토스트 최대 6초 ⑥ 부가세 모를 때 종이 계약 초안 문구 ⑦ '견적에 담김' 추가공사는 엑셀 이사 때 기록이 안 옮겨짐.
- 남은 것(다음 묶음): 지운 현장의 `due_` 수금 일정이 제목째 남는다(hjDeleteProjectCore) · 전체장부 엑셀에 AS 새 열 없음 · 사례 zip summary 32px.

## 2026-09-26 계약·정산 정확성·데이터 안전·개인정보 v328 (PR 후보)

대표 "위 내용 진행"(2026-09-26). 작업 트리 10개에서 구현 → 적대적 검토 → 고침을 거쳐 합쳤다. 기준 main `b519e35`(v327).
- **전자계약 body(`contractSend(p,amount,terms)`)**: `vatIncluded` 는 **true/false 로 명시**, 모르면(표기 없는 엑셀·PDF·손으로 고친 금액·견적마다 다름) 확인 화면에서 사람이 고르기 전엔 서버를 부르지 않는다. 서버 `ctStandardBody_` 는 값이 없으면 '(부가세 별도)'로 찍는다. `period` 는 이 현장 일정에서(💰·상담·실측 제외), 없으면 보내지 않는다. `scope` 는 **늘 배열**(빈 문자열이면 서버가 제목을 범위 자리에 넣는다), 견적 품목 이름, 사진 전/후 공정명은 거른다. `idem` 에 내용 지문(FNV-1a) — 같은 분 안에 고쳐 보내면 옛 링크가 돌아오던 결함. 검사 `contract-body.e2e.js`(변이 27).
- **계약 조건 정본 `HJ_PAY_RATIO={down:.5,mid:.4,bal:.1}`**(manmool Pure.gs `PAYMENT_RATIO` 와 같은 값, 대표 확정). 보증 기간 문구는 `hjWarrantyPeriodText` 한 곳 — 초안·완료 문자·완료보고서·간이 계약서가 여기서 나온다. **숫자를 새로 적지 마라.** 잔금 = 총액 − 계약금 − 중도금(서버 paymentPlan 과 같은 셈). 간이 계약서의 '보증 개월' 입력칸은 없어졌다(현장 🛡 보증 항목을 따른다). 검사 `contract-terms.e2e.js` 가 '하자보수…1년' 단독 약속 재등장을 정적으로 막는다.
- **엑셀 이사 `__iwFullImport`**: v193 에서 ① 현장 시트 열 하나가 빠진 뒤 원가·완료일이 한 칸씩 밀려 읽혔다. 이제 **헤더 이름으로 열을 찾는다**(`HJ_IW_FULL_COLS`·`__iwCols`), 헤더를 일부만 찾으면 못 찾은 열은 읽지 않는다(옆 칸 값으로 채우는 것보다 빈칸이 낫다). '(보관)' → archived. v193~v327 사이에 내보낸 파일로 이사한 기기는 원가·완료일이 틀려 있을 수 있다. 검사 `ledger-roundtrip.e2e.js`.
- **추가공사 정산 `hjExtrasBill(p)` → {agreed, pending, quoted, total}**: 청구 대상은 확인받음+금액 있음+저장된 견적에 안 담긴 것. `projStats` 가 이 합계를 잔금에 더한다(est 에 섞지 않는다). [➕ 견적에 담기]는 품목에 `extraId` 를 남기고, 옛 품목은 같은 이름·같은 금액이면 담긴 것으로 본다 — **애매하면 청구서에서 뺀다**(이미 나간 문서를 두 번 청구하지 않게). 청구서·명세서·정산 요약·보증서 프리필·공사 스토리·고객 페이지 잔금이 같은 값. 확인 글(`hjExtraText`) 고객 문구는 그대로. 검사 `extras-settle.e2e.js`.
- **현장 이름 키 저장소 목록의 정본 `hjProjectRefWalk(name,visit,identity)`**: files(+_aptUnit)·schedule·notes·payLog·asLog·quotes·expenses·workLogs·trips·satisfaction·aptOrders·aiOps.queue + 이 폰 `hj_calc_log/cart`. 이름 변경은 전부 따라가고, **삭제는 기록을 지우지 않고 '(삭제됨) 이름 · 날짜' 로 옮겨** 같은 이름 재생성 때 옛 수금·AS·견적이 붙지 않게 한다. UI·AI 삭제가 같은 함수. `renameProject`·삭제는 안전판을 먼저 찍느라 async — 누르고 바로 state 를 읽는 검사는 기다려야 한다. 새 이름 키 저장소를 만들면 `hjProjectRefWalk` 에 넣어라. 검사 `project-rename.e2e.js`.
- **사진 안정 참조 `hjFileRef(f)`('d:'+Drive ID 또는 'k:'+fileKey) · `hjFilesByRefs`**: 파일 id(uid)는 부팅·복원·스캔마다 바뀐다. `casePack.photos`·`extras[].photo`·`warrantyDoc.photoIds` 는 안정 참조를 저장하고 옛 id 도 읽어 조용히 옮긴다(뒤처진 탭은 쓰지 않음). 이름·크기 짐작은 **그 현장 사진 안에서만**. 정말 없어진 사진은 '사진을 찾을 수 없음 N장' — 자동으로 목록에서 지우지 않는다. 검사 `photo-refs.e2e.js`.
- **파일 필드 복원 정본 `hjApplySavedFileFields(f,s,revert)`**: applyData 병합·되돌리기와 「선택 복원」(`restoreSelectFiles`, fileKey 매칭)이 같이 쓴다. `backupUserEdits` 는 저장 레코드 전 필드를 담는다. 원본/정리본 병합 때 원본 증빙은 옮기지 않고 합치지 않는다. Drive 형식·크기는 Drive ID 가 같거나 빌 때만 덮는다(백업 뒤 붙은 Drive 연결이 크기 0 이 되던 결함). `restore-parity` ⑤ 가 현장 레코드 전체를 merge·revert 로 왕복 비교한다 — applyData 의 `{...clean}` 전개를 명시 목록으로 바꾸면 빨간불. 검사 `restore-select.e2e.js`.
- **📤 사진 묶음**: `hjCaseJpeg` 로 다시 구워(EXIF 없음, 긴 변 1800) `사진_01.jpg` 번호 이름. 굽기 실패는 원본으로 채우지 않고 뺀다. 동영상은 기본 제외, `#pbVideo` 를 골라야 원본 그대로(이름만 번호) 들어간다. 검사 `photo-bundle-privacy.e2e.js`. 대표 확인 대기: 공유 제목·본문에 현장명(동·호수 포함 가능)이 실린다.
- **AI 출구 마스킹 `hjAiMaskOut`**: 도구 결과가 모델로 돌아가는 한 곳(aiAgentSend 의 functionResponse)에서 전화·9자리 이상 숫자열을 '···1234' 로. 날짜·쉼표 금액·'원'이 붙은 숫자·회사 번호는 그대로. 동선 조언 프롬프트 주소는 `hjAddrArea` 로 시·구·동까지. 외부 링크 `target=_blank` 는 전부 `rel="noopener noreferrer"`(`blank-rel.check.js`), `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **고객 페이지 비밀키 → IDB `portal_key`**(메모리 `__portalKey`, 부팅 읽기 `window.__hjPortalKeyDone`). `serializeData` 의 portalCfg 는 `portalCfgSafe` 로 key 를 뺀다. applyData 는 들어온 key 를 상태에 두지 않고, 이 기기에 키가 없을 때만 한 번 IDB 로 옮긴다. 입력칸은 password, 빈 값 저장 = 안 바꿈, [지우기]+확인. 검사 `portal-key.e2e.js`.
- 작업 트리 병렬 검사 도구: `/tmp/claude-0/hjtest.sh <트리> <포트> <검사…>` — 8299/8398 을 트리별 포트로 바꾼 임시 복사본을 돌린다. `dead-endpoint.check.js` 는 그 임시 복사본 자신을 잡으니 node 로 직접 돌린다.
- 대표 확인 대기: ① 서명 계약서 제4조가 '공사기간은 2026-10-05 ~ 2026-10-09.' 로 끝난다(다듬으려면 manmool 서버 수정·수동 배포) ② 부가세 표기 없는 엑셀·PDF 견적은 보낼 때마다 포함/별도를 고른다 ③ 사진 묶음 제목의 현장명 ④ 묶음 사진 화질(긴 변 1800)이 외주팀에 충분한지.

## 2026-09-25 관리사무소 작업 안내 v327 (배포됨 #161 · Pages #177)
## 2026-09-28 아파트 프로젝트·동호수 사진 정리 v331

- `aptProject*`: 아파트명을 프로젝트로, 동·호수/공용부를 `aptUnits`로 등록한다. PC/사진/아파트 관리 진입점과 미리보기·백업 다운로드 제공. 상세 `APARTMENT-PROJECTS-v331.md`.
- 기존 사진 전용 프로젝트만 명시 확인 후 연결을 옮기고 원래 프로젝트는 보관한다. 금융/고객/업무 참조·완료일·보증 기준·중복·손상 데이터는 자동 통합 금지. 원본 경로/파일/Drive/해시 유지.
- 전체 상태 비교 + `aptUnitMutation`/`durableLocalMutation` 안전판·CAS 경로 필수. 서버 전송/완료보고/보험 제출은 하지 않는다. `apartment-projects.e2e.js` 및 metadata/financial/stale 변이를 검증한다.
- v330 웹은 PR #163, main `f1d86bf`, Pages 실행 `36328490599`로 배포 확인됨. 별도 직원 서버는 소스 준비만 됐고 Google 승인·대표 계정 연결·웹앱 배포는 미완료다. 이 작업이 해당 계정을 임의로 활성화하지 않는다.

## 2026-09-27 프로젝트 사진·보험 제출 준비 v330 (웹 배포, 별도 서버 승인 대기)

- 사용자 목적: 10명 기술자의 업무 배정/진행 → 프로젝트 사진 수집 → 보험 제출 준비. `team.html`의 기술자 일정 / 프로젝트 사진 / 보험 제출 준비를 추가했다. 웹 배포와 비공개 저장소 준비는 확인됐지만 실제 직원 계정 연결·서버 활성화·보험사 제출은 미진행이다. 상세 `TEAM-PROJECT-CLAIMS-v330.md`.
- 서버 health `company-team-v3`, 신규 `TeamProjects.gs`, `TeamEvidence.gs`. 원본 JPG/PNG/WebP 12MiB, 대표 문서 PDF. 회사 JSON 및 첨부 폴더/파일의 비공개·부모 검증을 유지한다. 원본 UUID별 영속 의도+원본 재사용, revision 변경 때도 evidence UUID를 버리지 않는다.
- 10건 배정은 한 snapshot에 원자 저장, 기술자 교차팀 시간 중복 차단. 새 projectId 명시 연결, 사진이 있는 업무 재귀속 차단. 기존 자유문자 프로젝트 이름으로 자동 이관하지 않는다.
- 보험은 owner만 관리. 자료 검토 및 수동 제출 기록은 서버 fingerprint/snapshot + 클라이언트 expectedFingerprint에 묶인다. 다운로드가 제출을 기록해서는 안 된다. 과거 제출 기록은 현재/이전 자료 기준을 표시한다. 실제 보험사 API는 없다.
- 신규 `team-projects.js`, `team-packet.js`는 Pages 허용목록에만 추가하고 SW 캐시에서는 제외한다. 세션/사진/금융 데이터 localStorage 금지. 신규 unit/e2e 및 변이 뒤 최종 필터 없는 `node tests/run-all.js`가 필수다.

## 2026-09-27 직원 작업실 v329 (로컬 구현·미배포)

- 사용자 정정: 조직도 자체가 아니라 소속·역할에 따라 각자 일하는 페이지가 핵심. `team.html`의 내 업무 / 팀별 작업실 / 검수·승인 / 운영 관리가 주 동선, 직원·팀 설정과 변경 이력은 대표 보조 메뉴다. 상세 `TEAM-WORKSPACES-v329.md`.
- 경로는 `#mine`, `#teams`, `#team/<opaque ID>`, `#review`, `#operations`, `#settings`, `#audit`만. 현장명·검색어·보고는 URL이나 localStorage에 저장하지 않는다. 접근 권한 재검증, 작성 중 이동 차단, 필터 초기화·포커스 복귀를 유지한다.
- `task.history`는 서버 생성 append-only, 동일값 저장/동일 requestId 재시도에는 누적하지 않는다. legacy 최초 변경은 마지막 보고 baseline만 보존(과거 전체 복원 아님). 100건이면 새 변경 중단, 기존 이력 삭제 금지. 서버 전체 4M 문자 제한 유지. 재배정받은 직원도 해당 업무 과거 보고를 읽는 계약이다.
- 팀장은 소속 팀만, 직원·외주는 본인 배정만. 직원의 완료업무는 조회 전용. 보완 요청(review→doing)은 새 사유가 필수. 금액/사진/기존 공용 접근 권한은 이 작업실에 자동 연동하지 않는다. 실제 직원 연결과 배포는 여전히 미진행이다.

## 2026-09-27 팀별 운영 v328 (로컬 구현·미배포)

- `team.html` + `team-ui.js` + 빈 `team-config.js`: 별도 직원 업무 화면. `apps-script-team-ops/`는 별도 서버이며 기존 릴레이/관리사무소 포털에 합치지 않는다. 실제 설치·회사 신원·구성원 연결은 미진행. `TEAM-OPERATIONS-v328.md`와 서버 README를 읽고 운영 경계를 유지한다.
- 기본 팀은 대표·관리 / 누수·배관팀 / 인테리어팀 / 관리사무소 대응팀(사용자 확인). 회사 owner/lead/member/external 권한은 포털 역할과 분리. 고객 아파트 포털을 회사 신원 단지로 사용하지 않는다. 과거 APP_TOKEN 접근은 별도 승인된 전환 없이는 차단됐다고 주장하지 않는다.
- 기존 업무는 JSON 초안으로 개별 검토 이관. 자동 삭제/양방향 동기화/실계정 생성 없음. 회사 서버의 immutable snapshots + revision + requestId를 보존하며 public stage에 서버 소스/데이터를 넣지 않는다. 직원 페이지는 SW 캐시에서 제외한다.
- `operations-review.js`: 세대 `lifecycle`, 프로젝트 `costReview`만 중첩 저장. 날짜/원가 CAS·스냅샷 실패 중단. 보증서 HTML·서명 링크·직접 서명·발급 기록은 같은 날짜/기간 snapshot을 따른다. 기존 서명에 snapshot이 없으면 종전 방식이다.
- `media-safety.js` 현장별 100건 원본 일괄 점검 + 완료 영수증 IDB 원자 보관. 서버 `MediaRelay.gs` archive는 기본 OFF, 회사 전용 폴더로 명시 설정한 경우만 사용. 영수증과 과거 snapshot을 지워 중복 전송 방어를 약화하지 않는다.
- 신규 검사: `company-team.unit`, `company-team-ui.e2e`, `operations-review.e2e`, `media-batch-audit.e2e`, `media-journal-archive.unit`. 관련 환경 변수의 변이는 각 파일에서 확인한다. 배포 게이트는 여전히 필터 없는 `node tests/run-all.js` 전체 재실행이다.

## 2026-09-25 관리사무소 작업 안내 v327 (PR 후보)

대표 요청 "관리사무소에 작업 가능한 작업 리스트를 보여 줄 수 있는 창". 더보기(고객·영업) 「📋 관리사무소 작업 안내」
(`officeWorkListView`, 행동 계약 **118→119**). 담당자에게 폰으로 보여 주거나(📺 크게 보기 = 새 창 30px 글씨) 카톡으로
넘기거나(📤 글로 공유 → `hjSiteCopy` 폴백) PDF·워드로 만든다(📄 문서 → `hjDocDeliverView`, ← 뒤로가 이 창으로 돌아온다).
- **네 묶음(`HJ_OFFICE_WORKS`)의 제목·설명은 홈페이지 manmool `office.html` 「관리사무소에서 자주 필요한 보수 업무」와 글자까지
  같다.** 검사 ②가 이웃 저장소(`/home/user/manmool/office.html`)가 있으면 실제로 대조한다 — 한쪽만 고치면 앱과 홈페이지가 다른
  말을 하고 담당자가 헷갈린다. 세부 항목은 공개 사례 26건에서 뽑은 실제 작업이다. **지어낸 공정을 넣지 마라.**
- 안내 문구(`HJ_OFFICE_NOTE_DEFAULT`) 셋: 표준 패키지 상한(대표결정 2026-08-10, 지울 수 있음) · 법정 하자보증(방수 3·설비 2·마감 1) ·
  진행 순서. '무료' 는 쓰지 않는다(cost-honesty). 전화·주소·사업자번호는 `COMPANY` 에서 온다.
- **이 폰 localStorage `hj_office_works` 에만 저장**(v277 계산기 기본값과 같은 방식). 발표 자료라 백업·동기화에 싣지 않는다 —
  serializeData 최상위 키 41개 그대로, `markDirty` 안 부른다. **기본값과 다른 칸만 저장하고 전부 같으면 키를 지운다** — 안 고친
  묶음까지 저장해 두면 다음 버전에서 기본 항목을 고쳐도 그 폰에는 옛 항목이 남는다(검사 ③이 처음 잡았다). ↺ 기본값은 confirm 뒤.
- 옛 더보기 시트(`data-moreaction`)에는 officeops 항목이 없다 — webbridge 항목 뒤에 넣었고 핸들러는 이웃과 같이 중괄호 없는
  `else if(a==='officework')return officeWorkListView();` 꼴이다(검사 ①이 정규식으로 고정).
- `tests/office-worklist.e2e.js` ①~⑥ — 변이 10종 전부 검출. 360px 넘침 0·버튼 44px.

## 2026-09-25 사례 내보내기 안에서 전/후 붙이기 v326 (배포됨 #176)

「전/후 표시 필요」로 센 현장을 그 화면에서 후보로 올린다. 공정이 빈 사진 칸에 [전][후] 버튼이 뜨고, 모아 두었다가
[📌 공정 저장] 한 번에 쓴다(`hjCaseTagSave` — 장마다 안전판을 찍으면 12칸이 금방 찬다).
- **규칙은 보증서 `hjWarrantyTagPicked` 와 같다**: 공정이 빈 사진만, 정리 폴더(`organizedPrefixInfo`) 사진은 건너뛰고,
  `photoIntakePending`·`__tabStale` 이면 안 쓰고, `hjSnapshot(…,true,true)` 가 실패하면 아무것도 안 쓴다. 순수 대입 + `markDirty`.
  `p.phases` 에 올리지 않는다(계약서·카톡 카드·다음 보증서 공사 내용에 '시공 전, 완료' 가 샌다).
- **공정 이름은 `hjPhaseSideName(p,side)` 한 곳** — 현장에 '시공전' 표기가 있으면 그것을 쓴다. 보증서 코드에서 끌어내
  공용으로 만들었다. 두 곳에서 지으면 사진 탭 칩·PDF 묶음이 다른 공정으로 본다.
- 검사 `case-pack.e2e.js` ⑨ — 변이 6종 중 5 검출. 못 잡은 하나: 라벨 안 버튼의 `preventDefault` 를 빼도 체크가 안 바뀐다 —
  HTML 규격이 라벨 안 버튼 클릭을 라벨 활성화에서 제외하기 때문(v319 썸네일 버튼과 같은 자리). 그 줄은 v319 관습대로 남겼다.

## 2026-09-25 첫 화면 사례 후보 v325 (배포됨 #175)

기준 main `3a882ab` = `hyeonjang-v324-photosafety`(Pages #174). `viewDashboard` 의 「✅ 오늘 현장 업무」 카드에
`dashboardCaseSummary()` 한 줄(「📰 홈페이지 사례 후보 N곳 — 현장1 · 현장2 외 · 전/후 표시 필요 M곳」)과
[📰 사례 내보내기] 버튼(`casePackView()`, 인라인 onclick — 대시보드 버튼 관습)을 붙였다. 더보기 안에만 두면
"어느 현장을 아직 안 보냈나"를 폰에서 다시 못 본다(v254 폰 첫 화면 규칙). `dashboardOperationsRefresh` 가 줄만
갱신한다(버튼 DOM 교체 없음 — 모달 닫힌 뒤 초점 복귀). 검사 `case-pack.e2e.js` ⑧, 변이 3/4 검출 —
버튼 인라인 `min-height:44px` 를 30 으로 바꿔도 44 가 나온다(전역 버튼 규칙이 이미 44 를 보장). 인라인은 옆
버튼들과 같은 관습이라 남겼지만 그 줄이 지키는 건 없다 — 44 의 정본은 전역 CSS 다.

## 2026-09-25 프로젝트 표시·사진 우선 스캔 v323 (main 병합됨 #156 · 후속 v324 #157)

- 기준 main은 `86898e0` / v322. 별도 `codex/project-photo-sort-20260925` 브랜치에서 작업한다. 운영 배포 여부는 PR/Pages 결과로 따로 확인한다.
- PC 목록·휴대폰 현장 선택·촬영 현장 선택은 **사진 0개 먼저, 그룹 안에서는 가나다/숫자순**. `projectPhotoCounts`는 `kind=photo`만 세며 영상도 포함한다. 전체 자료 개수는 종전대로 표시한다. `state.projects` 배열·배정·현재 선택·보관 상태는 정렬로 수정하지 않는다.
- 진행/보관 구분은 유지한다. 휴대폰의 현재 현장은 배지로 표시하고, 보관함이 접혀 있어도 현재 보관 현장에는 접근할 수 있지만 사진 0개 진행 현장 앞에 고정하지 않는다.
- `photoFirstDirectoryEntries`는 각 폴더의 **현장사진 디렉터리만 안정 우선 분할**한다. 다른 폴더 상대 순서·백업 제외·접근 실패 기록은 유지한다. 스캔만으로 실제 파일을 이동/삭제하거나 Drive로 업로드하지 않는다.
- 사진 우선 읽기로 raw→정리본 순서가 달라지는 경계: 같은 이름/크기 raw와 정리본은 `loadProject` 및 경로별 수기값 복원까지 양쪽을 보존한다. 그 뒤 두 실제 파일의 SHA-256, 현장/세대/Drive/원본증빙/수동분류 충돌을 확인한 경우만 정리본 경로·핸들을 대표로 쓴다. 파일 읽기 실패·100MiB 초과·세 장 이상·충돌은 그대로 보존한다. 실제 원본 파일은 건드리지 않는다.
- `equalSizeScanPhotoPair`는 저장본 재불러오기 때 모호한 같은 크기 raw/정리본을 이름이나 같은 Drive ID만으로 다시 지우지 못하게 한다. 세션 Set만으로 보호하면 새 기기에서 무너지므로 JSON 왕복 검사를 유지한다.
- 새 검사: `node tests/run-all.js project-scan-order mobile-friendly-ui phase-folder-matching apartment-units`, 정적 서버 8299 실행 후 `node tests/project-scan-order.mutations.js`(11개 변이). 전체 게이트는 반드시 인자 없는 `node tests/run-all.js`로 실행한다.
- Windows 검사 보완: MediaRelay 변이 입력의 CRLF만 LF로 정규화했다. OfficeOps 격리 검사는 마지막 **정확히 동일한 소스** 토큰만 읽기 전용으로 재사용한다. 모든 바인딩 판정/기존 변이는 유지하며 시간 제한이나 기대값을 완화하지 않는다.
- 기존 `apt-side-badge`·`field-search-recovery`의 표시 순서 기대값은 새 사진 0개 우선/사진 개수 문구에 맞췄다. `video-files`는 GPU 녹화 대신 자체 생성한 16×16 VP8 모의 파일을 사용하며, 재생기의 실제 디코딩(`readyState`, 영상 크기)도 확인한다.

## 2026-09-24 📰 사례 내보내기 v321(배포됨 #170) · 사례 후보 v322

운영 기준선은 main `ca7b9e2` = `hyeonjang-v321-casepack`(Pages #170). 전체 회귀 **166개**(check 14 · unit 15 · e2e 137).

**왜 생겼나**: 홈페이지(manmool) 사례 글은 「사진 + 6항목」이 있어야 쓰는데, 현장 사진은 폰과 대표 Drive 에만
있고 그걸 꺼내 넘길 길이 앱에 없었다(2026-09-24 에 실제로 막혔다 — 이 세션의 Drive 연결은 다른 계정이었다).
더보기 「📰 사례 내보내기」(`casePackView`, 행동 계약 **117→118**)가 현장 하나를 zip 으로 만든다.

- **사진은 canvas 로 다시 굽는다(`hjCaseJpeg`)** — 원본 JPEG 의 EXIF(촬영 GPS·기기)가 공개 사진에 실리면 고객 집
  좌표가 새어 나간다. 긴 변 1800·JPEG 0.86(홈페이지 `assets/cases` 규격). 검사는 시드 원본에 실제 `Exif`·`GPSLatitude`
  조각을 박아 넣고 산출물에 없는 것을 본다 — 시드에 없으면 그 검사는 통과하고도 아무것도 안 지킨다.
- **파일 이름은 `01-전.jpg` 처럼 번호+전/중/후만**. 원본 파일명('김철수 1302호 완료.jpg')이 새지 않게.
- **`hjCasePii` 는 셋만 본다** — 동·호수(`\d동\d호`)·전화번호·출입 번호(`hjLooksLikeAccessCode`). 넓히지 마라, '보양비
  30000원'·'107동 앞' 이 막힌다(v284·v286). 걸리면 **적은 글은 지우지 않고** 칸 아래 경고 + 복사·ZIP 거부.
- 동네+단지 칸은 `hjCasePlaceOf(현장명)` 으로 미리 채운다(`aptNameParse` → complex, 아니면 끝의 동·호 제거).
- **6항목 텍스트 형식은 manmool `scripts/new-case-post.mjs` `parseMaterial` 이 읽는 `1. 동네+단지:` 줄** — 바꾸면 저쪽도.
- 값은 `p.casePack`({place…duration, photos:[id], consent, sentAt}) — 최상위 키 41개 그대로. 동의(consent) 없이는 안 만든다.
- 보관 현장도 목록에 넣는다(끝난 현장이 곧 사례 후보). 현장 객체는 입력마다 다시 찾는다(`live()`).
- `tests/case-pack.e2e.js` ①~⑥ — 변이 13종 전부 검출. JSZip 은 스텁(site-zip 과 같은 방식), 다운로드 앵커는 가로챈다.
- **v322 사례 후보(`hjCaseCandidates`)**: 화면 맨 위 「📋 아직 안 보낸 사례 후보 N곳」. 조건은 **전·후 사진이 둘 다 있고
  `sentAt` 이 없는 현장**(보관 현장 포함, 최근 사진 순). 전·후 중 하나라도 없으면 후보가 아니라 「전/후 표시 필요」로 따로
  센다 — 공정(`_phase`)만 붙이면 후보가 된다. 판정은 `hjPhaseHit` 한 곳(전후 갤러리·보증서와 같은 쪽으로 본다).
  ⑦ 변이 6종 — 처음엔 '전만 있어도 후보' 변이가 살아남았다: 시드에 전 사진만 있는 현장이 없었다. 시드를 보강해 잡았다.

## 2026-09-16~19 서류 내보내기·보증서 서명·동·호수 표시·간이영수증 v306~v318 (운영 배포됨)

운영 기준선은 main `8eedf70` = `hyeonjang-v319-phonetap` (2026-09-19 Pages run #168 성공). 전체 회귀는 **165개**
(check 14 · unit 15 · e2e 136 — v320 app-icons 포함). v316 #165 · v317 #166 · v318 #167 이 각각 전체 회귀를 통과하고 나갔다.
아래는 이 구간에서 생긴 **불변식과 교훈**이다. 서사가 아니라 다음 사람이 걸려 넘어질 자리를 적는다.

**전자계약 서버(manmool) 계약 — 하자보증서 링크 서명(v317 · manmool PR #199)**
- `quickSend { docKind:'warranty', title, customer:{name,phone}, body:{clauses,…} }` 로 보증서를 만든다. 보증서는 **금액 0 허용·대금 회차 없음·조항 없으면 BAD_REQUEST**.
  서버는 보증 문구를 지어내지 않는다 — 앱이 보낸 조항이 곧 고객이 읽는 것이다.
- `contract.signature { id }` (관리자 전용)가 서명 PNG 를 되돌려준다. 서명 전은 BAD_STATE. 완성본은 사진 때문에 **앱이** 만든다.
- **보증 조항의 정본은 `hjWarrantyClauses(termLabel)` 한 곳**이다. 종이(`warrantyHTML`)와 링크 본문(`hjWarrantyLinkBody`)이 여기서 나온다. 두 곳에서 지으면 '받은 보증서'와 '서명한 보증서'가 갈라진다.
- 확인자 전화번호는 서버로만 가고 `p.warrantyLinks[]` 에는 **저장하지 않는다**(검사로 고정). 서명은 `p.warrantySigs[]` 에 480×135 PNG 로 영구 보관(`via:'link'|없음`).
- 🅱 **Apps Script 배포는 대표가 손으로** 한다. 병합만으로는 서버가 바뀌지 않는다. 배포 뒤 편집기에서 `ensureSheets_()` 한 번 — `Contracts` 시트 **끝**에 `docKind` 열이 붙는다(2026-09-19 현재 미배포·대표 대기).

**현장 객체 안에 붙은 것(직렬화 최상위 키 41개 그대로)**: `p.warrantyDoc`(완료보증서 보관본, 사진은 id 만) · `p.warrantyLog[]`(실제로 PDF·워드·HTML 을 가져간 시점에만) · `p.warrantySigs[]` · `p.warrantyLinks[]`. 새 키를 최상위에 만들지 마라 — 여섯 곳을 고쳐야 하고 `serialized-keys.check.js` 가 막는다.

**문서 내보내기(v310 `hjDocDeliverView`)**: PDF 는 숨은 iframe 인쇄(`hjDocPrint`, 사진 로드 대기 3초 상한), 워드는 **MHTML**(`hjDocWordMhtml` — `data:` 이미지는 워드가 빨간 X 로 그린다; 조각 주소는 `http://hyeonjang.local/…` — `file:///` 는 Chromium 이 막는다), HTML 은 공유. `opts.onDeliver(via)` 는 실제로 가져간 때만 부른다(인쇄 취소는 '발급'이 아니다). **워드에서 사진이 실제로 보이는지는 진짜 워드로 확인된 적이 없다**(Chromium 구조 검사만) — 대표 확인 대기.

**모달 버튼은 직접 배선**: `#modalRoot` 는 `#view` 의 형제라 `#view` 클릭 위임이 닿지 않는다. `openModal` 뒤 `root.querySelector(...).onclick=` 으로 건다. `tests/modal-binding.check.js`(v309) 가 위임에만 기댄 죽은 모달 버튼을 잡는다. 반대로 `#view` 안의 새 `data-*` 버튼은 위임 셀렉터 목록(`e.target.closest('…')`)에 넣어야 한다 — v317 `[data-wlpull]`, `click-delegation.check.js`.

**현장 목록 동·호수 배지(v318 `aptUnitBadge(p,dupeNames)`)**: PC 사이드바(`render/addProjItem`)와 폰 시트(`openProjectSheet`)가 같은 함수를 쓴다. 규칙 — 등록해 둔 `aptUnits` 만 센다(`aptNameParse` 는 제안값이라 쓰지 않는다) · 공용부는 세대가 아니다 · `aptUnits` 길이 ≠ `aptUnitList` 길이면 '확인 필요'(손상을 '0곳'으로 감추지 않는다) · 이름 중복은 '이름 중복'(그 현장은 `aptUnitProject` 가 null 이라 관리 화면이 안 열린다) · `aptUnitManaged(p)` **단독으로 '있다'고 말하지 마라**(`[]`도 true). 배지는 `.proj-item` 밖 `.stage-row` 에 둔다(활성 줄 파란 배경을 안 탄다). 렌더 루프 안에서 `aptDupeNames()`·`aptUnitPhotoGroups()` 를 부르지 마라(현장²·현장×파일).

**간이영수증(v318 `payRcptHTML/payRcptDialog`, `HJ_SETTLE_DOCS.payrcpt {needsInput, openFn}`)**: 대표가 '간이세금계산서'라 불렀지만 양식은 영수증이다 — 문서에 '세금계산서'라 적지 않는다. **금액을 누계(`d.recv`)로 자동 채우지 마라**(기존 `receiptHTML` 이 그렇게 떨어진다) — 입금 기록(`state.payLog`)에서 한 건을 고르게 한다. **받은 돈을 1.1 로 나눠 부가세를 만들지 마라**. 결제방법·입금자명은 비워 손으로 쓰게 한다. `settleDocs`·`settleDocShare` 는 `needsInput` 문서를 바로 만들지 않고 `openFn` 을 연다. `[📎 서류 만들기](docHubView)` 에 '돈·정산' 묶음이 있다(예전엔 정산 문서로 가는 길이 없었다).

**유상 경로 정확일치는 `paidStableJson`**(v312): `durableLocalMutation` 의 왕복 검증은 키 순서에 무관하게 비교한다. 초안에 키를 뒤에 덧붙이면 재직렬화 순서와 달라져 'paid exact round-trip conflict' 가 났다(카톡 사진의 `sourceModifiedAt` 이 전부 걸렸다).

**견적 상세 열림 기록(v316)**: `viewEstimates()` 가 새 HTML 을 만들기 전에 **살아 있는 DOM** 에서 `__estimateOpenDetails` 를 맞춘다. toggle 이벤트로만 쌓으면 이벤트 전에 다시 그려질 때 조용히 잃는다 — 같은 단정이 v308·v315 배포를 막았고, v308 때 시더를 재운 것은 확률만 낮춘 것이었다.

**검사 도구 함정 — 세 번 겪었다, 규칙으로 못박는다**
- `office-ops-isolation.e2e.js` 의 토크나이저는 **`&&` 뒤 정규식 리터럴을 못 읽고 조용히 눈이 먼다**. 제품 코드에서 `&& /…/.test(` 꼴이 필요하면 정규식을 상수로 뺀다(`WR_DOC_THUMB_RE`·`WR_SIG_PNG_RE`). 그 검사 맨 앞에 원인을 이름으로 말하는 자가진단이 있다.
- 부팅 시더(`taxCalendarEnsure`·`coworkSchedEnsure`·`backupBootCheck`·`kakaoCheckNew`)는 시나리오 한복판에 자료를 심는다. 조회 전용 스냅샷을 단정하는 검사는 부팅 뒤 이것들을 `()=>0` 등으로 재운다.
- 릴레이 부팅의 진짜 끝은 `window.__hjRelayBootDone`(Promise). `__hjRelayConfigDone` 뒤에도 health 확인이 이어져 검사가 넣은 키를 덮었다(shared-todo 흔들림의 원인).
- **'뭔가 틀렸다'만 말하는 단정은 고칠 수 없다.** 스냅샷 비교는 어느 키가 어떻게 바뀌었는지 이름을 말하게 하라(`sameSnap()`·`changed: data.schedule` 로 원인이 즉시 나왔다). `savedAt` 은 내려받는 순간의 시각이라 비교에서 뺀다.
- 넘침은 `scrollWidth - clientWidth` 로 잰다. 블록 요소의 `getBoundingClientRect().width` 는 내용이 삐져나가도 부모 폭 그대로다. `#projList` 는 `overflow-y:auto` 라 문서·aside 만 보면 넘침을 삼킨다.
- 변이가 안 잡히는 줄은 검사의 눈이 먼 것이거나 **죽은 줄**이다. 둘 중 무엇인지 확인하고, 죽은 줄이면 지운다(v318 `min-width:0`). 시드가 사고 조건을 만들지 않으면 그 검사는 통과하고도 아무것도 지키지 않는다(v318 영수증 시드 `received:0`).

**컨테이너 환경의 알려진 실패**: 클라우드 세션의 Chromium 은 한글 blob 파일이름 다운로드에 `'download'` 를 준다 → `tests/team-workboard.e2e.js` 가 그 자리에서 떨어진다. **GitHub Actions 에서는 통과한다**(#165~#167). 검사를 완화하지 마라 — 컨테이너 문제다. 변경 전후 같은 실패인지 stash 로 대조해 보고에 적는다.

**버전 핀은 세 곳**: `sw.js` 캐시 이름 · `index.html` `APP_BUILD` · `tests/version-sync.check.js` `TARGET_BUILD`. 셋 중 하나만 올리면 정적 검사에서 멈춘다.

**스쿼시 병합 뒤 브랜치**: `claude/recent-web-project-a1foj1` 는 병합될 때마다 `origin/main` 에서 다시 시작하고(`git checkout -B … origin/main`) 트리 해시가 같은 것을 확인한 뒤 `--force-with-lease` 로 원격을 맞춘다. 스쿼시 전 옛 커밋 위에 쌓지 마라.

이 구간의 이전 릴리스(제목만 — 상세는 PR): v298~v302 #137 안 눌리던 버튼 2개·🏢 아파트 관리 탭·보증서 새 양식 / v303 #139 배포 막던 회귀·[＋ 동·호수 추가] / v304 #140 하자보증서 한 벌(서류 만들기도 관리사무소 양식) / v305 #141 못 돌던 검사 5건 복구·다운로드 앵커 7곳 / v306 #142·v307 #143 보증서 전/후 사진 장수·직접 고르기 / v308 #144 전후 갤러리 '시공 전' 버그·인쇄 버튼·관리사무소 바로 등록 / v310 #145 PDF·워드 내보내기·모달 버튼 검사 / v312 #146 paidStableJson·미배정 전체 선택·워드 MHTML / v313 #147 전/후 선택→사진 공정·발급 이력·완료보증서 사진·세대별 보증서 / v315 #148 작업명 일괄 입력·[전체 선택] 문구 버그·확인자 서명판 / v316 #149 견적 상세 열림.

**v319 폰 기능강화(2026-09-19, PR #152)** — 추측 대신 갤럭시 크기(360×740)로 v308~v318 화면을 전부 열어 잰 결과로 고쳤다.
- **모달 아래 버튼·× 는 미디어쿼리 전역에서 44px**(`.modal .mfoot button{min-height:44px;min-width:44px}`, `.modal-close` 44). 그 전에는 전역 42 + 특정 모달 4곳만 44 였다 — 새 모달마다 잊는 구조였다. 특정 모달에 44 를 또 붙일 필요 없다.
- **동·호수 관리 사진 줄에 썸네일 = [크게 보기] 버튼**(`button.apt-unit-thumb-btn[data-unit-photo]` 안에 `img.apt-unit-thumb` — `photoSrc(f,56)` · `loading=lazy decoding=async` · `alt=""` · 버튼 `aria-label="<파일명> 크게 보기"`). 글자 [보기] 버튼은 없앴다(대표 "더 강화" 승인). 줄=선택(라벨), 그림=크게 보기(버튼) — 라벨 안 버튼은 눌러도 체크가 안 바뀐다(HTML 규격 + 핸들러 preventDefault). 사진 그리드와 같은 소스 함수라 Drive 전용·HEIC 폴백을 공짜로 얻는다. `.apt-unit-row span{flex:1}` 이 모든 후손 span 에 걸리므로 자리표시는 클래스로 덮는다.
- **배정 위치 select 와 오류 줄(`#aptUnitIssue`)은 sticky 버튼줄(`.mfoot`) 안**(`.apt-unit-target-bar`, `flex:1 1 100%`) — `openModal` 뒤 DOM 을 직접 넣는다(`openModal` 은 btns 로만 footer 를 만든다). 본문 끝에 두면 사진이 많을 때 3화면 아래였다. `<label for>` 를 같이 옮겨야 `apartment-units controls()` 접근 이름 검사를 지난다. 버튼줄이 두 줄이라 `#aptUnitWork` 는 focus 때 `hjKeepAboveFooter`.
- **저장 뒤 그 호수 화면으로 튀지 않고 보던 목록에 머문다**(`aptUnitView(projectName,unitId)`), 토스트가 대상을 말한다("12장 → 107동 1302호 배정 저장"). 30장을 다섯 호수로 나눌 때 저장마다 미지정으로 되돌아오던 왕복을 없앴다. `tests/apt-unit-assign.e2e.js` 의 옛 착지 단정을 이 계약으로 바꿨다.
- **같은 위치 재배정은 쓰기 전에 막는다**(미지정 화면에서 [전체 선택] → 위치 안 고르고 [저장]하면 30장 유상 커밋이 돌고 "30장 배정 저장" 토스트가 뜨던 가짜 성공). 오류 줄이 버튼줄 안이라 늘 보이고, 편집 모달(오류 줄 없음)까지 덮으려 토스트도 띄운다.
- 검사 함정 둘 추가: **모바일 모드는 화면 폭이 아니라 설정값**(`pref_mobile`, 부팅 때 IDB 복원)이라 부팅 직후 단정하면 경쟁한다 — `__mobileMode=true;applyMobileMode()` 로 명시적으로 켜라. **변이 결과는 FAIL 줄 수가 아니라 종료코드+마지막 줄**로 판정하라 — 검사가 시작도 못 한 것이 '0건 실패'로 읽힌다.
- 전체 회귀 164개 중 163(team-workboard 는 컨테이너 알려진 실패).

**v320 앱 아이콘(2026-09-19)** — 저장소에 이미지가 **한 장도 없었다.** 아이콘은 전부 index.html 안의
`data:image/svg+xml` 이었고, 그 탓에 셋이 틀려 있었다(전부 실측으로 확인).
- **아이폰에서 '홈 화면에 추가' 하면 아이콘 대신 그 페이지 스크린샷이 박혔다** — `apple-touch-icon` 에
  실제 파일이 없으면 iOS 가 그렇게 한다. 구글 검색결과 파비콘도 `data:` 는 가져갈 주소가 없어 기본 아이콘이 뜬다.
- **maskable 안전원을 넘었다** — 글리프가 중심에서 241px(512 기준), 안드로이드 보장 영역은 171px(108dp 중 72dp).
  홈 화면에서 잘렸다.
- **`text-anchor="middle"` 은 글자의 '진행폭'을 맞추지 잉크를 맞추지 않는다** — 실제 그림이 13px 어긋나 있었다.
  잉크 경계상자로 다시 맞췄다.

그림은 그대로 두고(파란 #0b4ea2 + '현장') 자리만 바로잡았다. 글꼴에 안 기대게 글리프를 1024px 로 굽고
윤곽을 따 path 로 박았다(원본 대비 IoU 0.9973) — `<text>` 로 두면 한글 글꼴이 없는 기기에서 네모가 된다.

**루트에 `icon-192.png`·`icon-512.png`·`icon-maskable-512.png`·`apple-touch-icon.png` 네 장.**
공개 파일을 하나 더하면 **다섯 곳**을 같이 고쳐야 한다. 세 곳은 목록을 정확히 고정하는 검사라
빠뜨리면 그 자리에서 빨간불이 난다(실제로 둘 다 한 번씩 걸렸다).

| 고칠 곳 | 안 고치면 |
|---|---|
| `index.html` head·동적 manifest | 아이콘이 안 걸린다 |
| `sw.js` `SHELL_PATHS` | 비행기모드에서 아이콘이 깨진다 |
| `scripts/stage-pages.mjs` `publicFiles` | 저장소에는 있는데 Pages 에 안 올라간다 — **폰에서 설치할 때만 드러난다** |
| `tests/sw-cache.check.js` `EXPECTED_SHELL_PATHS` | 서비스워커가 캐시에 담아도 되는 것의 순서까지 고정하는 보안 경계 |
| `tests/pages-artifact.e2e.js` `expected` | Pages 에 올라가도 되는 것의 정확한 목록(`tests/`·`apps-script/`·`backup/` 유출 방지) |

뒤 두 줄은 **늘린 이유를 그 줄에 적어라** — 그게 그 검사의 쓸모다.

**동적 manifest 안의 주소는 절대주소여야 한다.** 이 manifest 는 `blob:` URL 로 붙는데 blob 에는 경로가 없어
상대주소를 풀 수 없다 — 브라우저에서 `new URL('icon-192.png', blobHref)` 가 `Invalid URL` 로 던지는 것을
직접 확인했다. `abs(p)=>new URL(p,location.href).href` 로 미리 풀어 넣는다. `start_url`·shortcuts 도 같다.
크롬은 manifest 의 SVG 를 설치 아이콘으로 쓰지 않으므로 PNG 여야 한다.

**maskable 은 안전원보다 조금 더 작게 구워라.** 정확히 171 로 맞추면 가장자리 안티앨리어싱이 172px 까지
번져 검사에 걸린다(실제로 걸렸다). 166 으로 굽는다.

**갤럭시 앱(android-galaxy)** 아이콘도 같은 그림으로 맞췄다. 예전에는 초록 바탕에 집 모양이라 웹앱과
다른 앱처럼 보였다. `drawable-anydpi-v26/ic_launcher.xml`(적응형) + `drawable/ic_launcher.xml`(API 24~25)
구조라 **AndroidManifest 는 손대지 않는다** — 안드로이드가 알아서 고른다. 다만 **APK 빌드·서명·실기기 확인은
대표 PowerShell 작업**이라 여기서는 XML 이 맞는지와 그림이 어떻게 보이는지(벡터를 SVG 로 되돌려 렌더)까지만 봤다.

검사 `tests/app-icons.check.js` 신규 — 파일 존재·선언 크기·maskable 안전원(PNG 를 직접 풀어 잰다)·head·
manifest 절대주소·오프라인 캐시·배포 허용목록. 변이 11건 전부 검출.

🅱 대표 대기(2026-09-19): ① Apps Script 보증서 배포 + `ensureSheets_()` ② 워드 보증서 사진 실제 확인 ③ 세대별로 완료일이 다른 현장이 있는지(있으면 세대별 완료일 작업) ④ v319 에서 보류한 세 가지(위) 중 원하는 것.

## 2026-09-13 원본·영상·백업 안전 v297 개발 후보

사용자가 첫 개발 범위 1~3(삭제/백업 안전, 원본 재연결, 사진·동영상 전송/재시도)을 승인했다.
`codex/media-safety-20260913`, 기준 main `b8e0690`, 후보 `hyeonjang-v297-mediasafety`.
2026-09-14 사용자가 "배포 후 4-6번도 진행"으로 v297의 브랜치 업로드·PR·main 병합·Pages 및 필요한 중계 서버 배포를 승인했다.
실제 사진 시험 업로드·계정/비밀번호·공용키 변경·PC 종료는 포함하지 않는다. 새 OAuth 동의가 필요하면 승인 화면에서 사용자에게 요청한다.
후속 요청에서 사용자가 "배포 후 pc 종료"를 승인했다. v297 배포 및 실제 반영 확인을 완료한 경우에만 일반 종료하며, 앱 강제 종료는 하지 않는다. 4~6은 설계만 정리한 후속 범위이며 이번 v297 배포에는 포함하지 않는다.
`index.html`은 root 단일 작성자, 추가 공개 셸은 `media-safety.js`, `shared-todo-backup.js`다.
보호된 서버 범위는 기존 SharedTodo 모듈의 전용 백업/복원, 새 `MediaRelay.gs`와 `README_MEDIA_RELAY.md`,
Code 인증 뒤 정확한 guarded media dispatch 한 줄, manifest external_request scope 한 줄만 추가한다.
기존 relay actions, OfficeIntake/OfficeOps/상업 서버는 변경하지 않는다. 보호 검사 BASE는 그대로 두고 정확한 추가만 검사한다.
미디어 원본은 최대100MB, Drive resumable 1MiB 청크, 서버 전송번호/사전할당 ID·해시로 멱등 확인한다.
기기에는 원본 Blob이 아니라 대기 전송 식별정보만 저장한다. 새로고침 뒤 원본 재선택이 필요할 수 있다.
개별·일괄 사진 삭제는 PC/Drive 원본을 보존하고, 스냅샷 실패·동시변경·영구저장 실패 시 중단한다.
공유 할일 복원은 이전 ID를 부활시키지 않고 새 ID로 복원하여 오래된 요청을 차단한다. 서버 인증은 기존 회사 토큰이며 개인별 권한 기능은 아니다.
실제 운영 Watchdog가 로컬과 다르므로 전체 clasp push 금지. 별도 승인 후 운영 원본 보존·최소 변경 배포와 2기기 검증이 필요하다.
최종 검사 결과·제한·배포 경계는 `docs/media-safety-v297-20260913.md`에 기록한다.
최종 전체 자동검사153/153(11.2분·동시3·실패0·재시도없음) 통과. 제품 코드9개 해시 불변 및 diff 공백 검사도 확인했다.
이 결과는 9월13일 개발 후보 기준이다. 9월14일 offset43/세션 보완 후 전체153/153(13.2분)이 통과했으나 media-intake/mobile-back이 1회 재시도되어 원인을 분리·보완했다. 선택기 참조 수명 보완 뒤20/20 및 전체8/8·변이2종, 표시 전/후 구분 보완 뒤6회10/10·변이1종 검출. 제품 수정 없이 테스트를 보완했다.
9월14일 최종 전체 재검사153/153(12.0분·동시3·종료0), 제품9파일 SHA-256 전후 동일. media-intake/mobile-back은 첫 실행 통과. shared-todo는 불필요한 legacy/AI 등 호출 금지 assertion에서 초도1회 실패 후 기존 단독 재시도로 통과했고 추가 단독2회도 통과했다. 초도 배열 실제내용과 원인은 미확정이며 재시도 이력을 숨기지 않는다. Pages CI에서도 전체 검사를 다시 수행한다.
v297 첫 후보 ba3af58 업로드와 PR136 생성 후 OAuth 승인 대기 동안 HEAD를 이전6파일로 복귀했다. 이후 사용자가 "승인완료"라고 알렸다. 9월14일09:25(한국시간) 후보7파일 재업로드와 doGet 정상 완료,09:28 Apps Script version8 생성을 확인했다.
현재 운영 서버는 version8이며,7파일 원문 일치·기존URL/접근 설정 유지가 API와 배포 관리 화면에서 확인됐다. PUT 직후 GET에 옛 버전이 잠시 보였지만 다시 배포하지 않고 읽기 확인만으로 version8 반영을 확인했다. Pages는 최종 검사 후 PR136 병합/배포한다. 최신 공개 상태는 PR136·워크플로 실행·라이브 버전으로 판단한다.
비공개 원본/후보/복귀/배포 증거는 `C:/Users/1dncj/.cache/hyeonjang-media-v297-deploy-20260914/`에 있다. 실제 자료/계정/사진 원본은 변경하지 않았다. 새 직원별 인증이나 실제 업로드 시험은 이 릴리스 완료 조건에 포함하지 않는다.
실제 계정/Drive/휴대폰 검증은 아니다. 전송 영수증 포함 서버 journal256건 상한이 있으므로 장기 운영 전 확장 검토가 필요하다.

## 2026-09-13 현장별 팀 공유 할일 v296

사용자가 같은 회사 서버·Drive 사용을 확인하고 전용 할일 API와 웹 구현·배포 계획에 “배포 진행”으로 승인했다.
기준 main `9460da4`는 v295 공개 완료 상태다. 이전 후보 기록은 당시 검증 이력이다.
이번 `codex/project-shared-todo-20260913`은 `hyeonjang-v296-sharedtodo`다.
승인 서버 변경은 `apps-script/SharedTodo.gs` 새 모듈과 Code 인증 뒤 guarded dispatch 한 줄뿐이다.
기존 relay actions·OfficeIntake·상업/관리사무소 서버·계정/권한·원본 자료는 바꾸지 않는다.
서버 task 전용 파일, revision/멱등 영수증/삭제표식, 클라이언트 연결별 IDB pending CAS를 사용한다.
기존 개인 notes는 자동 공유·삭제하지 않고 별도 목록과 선택 공유 초안 경로로 보존한다.
실제 운영 Watchdog는 로컬과 다르므로 기존 운영 원본을 보존해 최소 변경 배포한다. 폴더 전체 clasp push 금지.
증거와 승인·배포 경계는 `docs/project-shared-todo-plan-20260913.md` 및 `apps-script/README_SHARED_TODO.md`.
신규 서버 22/22·변이6, UI15/15·변이2, 최종 전체148/148(25.5분·동시2·기존3개 단독 재시도) 통과.
Apps Script 기존 배포 version7·URL/권한 보존을 배포관리 화면에서 확인. Pages/실제 기기 검증은 증거 문서에서 구분한다.
이번 요청에 PC 종료는 포함하지 않는다.

## 2026-09-13 하단 오늘 할일 v295 후보

대표 요청으로 하단 견적 자리(5번째)를 `오늘 할일`로 바꾼 로컬 `hyeonjang-v295-todonav`다.
`__todo`는 일반 탭이 아니라 기존 `todoView()`를 여는 동작이다. 배경 탭과 기존 할일 저장 구조는 유지한다.
견적 작성은 신·구 더보기 바로가기 및 검색으로 이동했다. 바로가기 5개, MORE_CATS 업무 기능 117개 계약은 그대로다.
모달의 기존 닫기·Esc·뒤로가기 및 초점 복귀를 이용하며, 실제 자료·계정·서버·Android 제품/APK는 변경하지 않는다.
신규 모바일4종 4/4 및 오류 주입2종 검출, 최종 전체146/146(11.6분, 동시2, 재시도없음) 통과.
검사 및 증거는 `docs/mobile-todo-nav-v295-20260913.md`. 공개 업로드·PR/main 병합·배포·PC 종료는 미진행.

## 2026-09-13 사용 편의 UI v294 후보

같은 `codex/galaxy-android-20260913`에서 v293 뒤의 로컬 후보 `hyeonjang-v294-friendlyui`다.
현장 선택은 긴 아파트명·동호수 줄바꿈, 현재 현장 우선/배지, 단계·자료 수 문구, 검색/닫기 고정과 목록 스크롤을 적용했다.
표시용 복사 배열만 정렬한다. 현재 보관 현장을 보여도 보관 상태·실제 자료는 바꾸지 않는다.
사진 주요 버튼은 모바일 2×2로 정돈하고 도구 열림·선택 상태 및 Enter 후 초점을 유지한다. PC 확장 도구는 유지한다.
신규 `tests/mobile-friendly-ui.e2e.js` 5가지 화면 조건, 오류 주입 3종 검출 및 최종 전체 145/145(13.0분, 동시 2, 재시도 없음) 통과.
진행 결과와 최초 실패 이력은
`docs/mobile-friendly-ui-v294-20260913.md`에 기록한다. 실제 계정/자료·Apps Script·Android 제품/APK는 변경하지 않았다.
별도 v292는 합치지 않으며, 이번 요청의 공개 업로드·PR/main 병합·배포·PC 종료는 미진행이다.

## 2026-09-13 모바일 화면 모의검사 v293 후보

같은 `codex/galaxy-android-20260913` 브랜치의 후속 로컬 작업이다. 별도 v292 후보는 합치지 않는다.
아래 APK 준비 단계의 HTML/SW 무변경 기록과 달리, 이번에는 웹 후보를 `hyeonjang-v293-mobilescreen`으로 올렸다.
모바일 작업시간 카드·삭제 확인, 토스트의 하단 메뉴 가림, 작업시간/사진 추가 확인 두 창의 본문 스크롤을 개선했다.
PC 모달·금액 계산·자료/계정·Apps Script는 변경하지 않는다. Android 제품 코드와 APK 1.0.0은 그대로다.
신규 `tests/mobile-screen-layout.e2e.js`는 가상 자료로 5개 viewport와 오류 주입 4종을 검사한다.
Android JVM 화면 측정은 기존 5개에 새 5개를 더해 10/10 통과. 실제 갤럭시/키보드/Drive 검증은 아니다.
최종 전체 회귀 144/144(13.3분, 동시 2, 재시도 없음), 오류 주입 4종 검출. 증거·초기 실패 이력은
`docs/mobile-screen-v293-20260913.md`에 기록했다. 공개 웹은 v291로 재확인. 공개 배포·PR/main 병합은 미진행.

## 2026-09-13 갤럭시 전용 연결 앱 후보

`codex/galaxy-android-20260913`은 공개 main `0f79708`(v291)에서 분리했다.
별도 로컬 v292 팀 일정 후보는 이번 APK에 묶어 배포하지 않는다.
`android-galaxy/`는 Android 7 이상 TWA/Custom Tabs 연결 앱이다. 기존 웹 HTML·SW,
자료·계정·Apps Script 설정은 변경하지 않는다. 앱 버전 1.0.0과 웹 버전은 별개다.
아이폰은 사용자 요청으로 제외. 기본 URL은 운영 HTTPS로 고정하고 외부 Intent URL을 받지 않는다.
도메인 확인 전에는 주소줄이 보이는 정상 폴백을 사용하며 WebView·검증 우회·알림 위임은 없다.
서명키·암호는 저장소 밖 Windows 사용자 전용 경로에만 보관한다.
빌드: `android-galaxy/Build-Galaxy.ps1`, 설치·검증: `docs/galaxy-android-20260913.md`.
APK 빌드 성공과 실제 갤럭시 로그인/사진 업로드 검증, 공개 배포는 각각 구분해서 보고한다.
로컬 최종 APK 1.0.0 생성·v2/v3 서명·권한/구성 요소 검사 완료. Android 5/5, 안전 변이 8종,
웹 전체 143/143(Playwright 번들 Chromium, 13.1분, 재시도 없음) 통과. 실제 갤럭시 미검증,
루트 assetlinks·공개 APK·PR/병합/스토어 미진행. 시스템 Chrome 실행 실패 이력은 검증 문서에 보존했다.

## 2026-09-13 모바일 운영 개선 v290 후보

사용자의 모바일 추가 개발·필요 시 배포 요청으로 `codex/mobile-operations-20260913`에서 진행한다.
main `159fe11` + 로컬 v289 `7115b7d` 위에 오늘 할 일 요약, 첫 화면 준비물/작업일지 연결,
통합 검색 현장 이동 수정, 30개 초과 현장 할 일 및 반복 선택 유지, 오래된 준비물 객체 쓰기 가드를 더했다.
`dashboardOperationsRefresh`는 버튼 DOM을 교체하지 않는다(모달 종료 초점 복귀). `hjTodoAdd`의 대화→할일 경로도 갱신한다.
저장 키·더보기 117개·계정·Drive/Apps Script 설정과 실제 자료는 그대로다. 영상 업로드/실패분 재시도는 별도 후속 범위.
신규 검사 `tests/mobile-operations.e2e.js`, 기능 목록과 최종 증거는 `docs/mobile-operations-20260913.md`.
최종 로컬 전체 141/141 통과(12.9분, 동시 2, 재시도 없음), 신규 12개 UI 시나리오와 변이 3종 검출.
사용자 배포 승인 범위로 PR 병합·공개 배포를 진행한다. 공개 확인 전이며 아래 v289 기록은 이전 로컬 검증 이력이다.

## 2026-09-13 사진·동영상 작업일지 로컬 후보

`codex/photo-report-media-20260913`, 최종 후보 버전 `hyeonjang-v289-reportmedia`.
처음 main `39923b2`(v284) 기준으로 개발했으며, 최종 검사 전에 Claude PR #131의
v285~v288 main `159fe11`을 로컬 병합했다. 양쪽 기능은 자동 병합됐고 버전 3곳의 충돌만
v289로 맞췄다. 원래 체크아웃의 미커밋 변경은 덮지 않는다. 배포 전에는 최신 main을 다시 확인한다.

사진 작업일지는 사진/동영상/전체 필터와 종류별 집계·영상 재생을 지원하고 동영상은 이미지 합성에서
제외한다. 영상 창은 작업일지 위에서 열려도 Tab 초점·Esc·닫기·뒤로가기로 원래 조회와 선택을 유지한다.
`mobileSheetHistoryOpen`의 `nested`는 모달 위 라이트박스에만 적용하며 기존 시트의 교체 동작은 유지한다.
일일 작업보고서는 `loadPhotoForExport`의 `{img,url}` 반환을 사용하고 본문·사진 행수에 따라 높이를 늘린다.
PDF에는 `__docExport`의 선택적 `pageBreaks`만 전달해 줄·사진 행 경계에서 비율을 유지하며 분할한다.
다른 문서의 기존 3인자 PDF 출력 경로는 그대로다. 영상 기본 컨트롤 뒤의 `lbDone`을 유지해야 native Tab이 막히지 않는다.
실제 원본·계정·서버·저장 스키마·자동 발송은 변경하지 않는다. 테스트는 격리 브라우저의 가상 자료만 사용한다.
최종 전체 회귀 140/140 통과(12.2분, 동시 2, 종료 코드 0, 재시도 없음), 신규 17/17 및 보호 변이 2종 검출.
실제 가상 PDF 2페이지를 렌더 검토했다. 검증 및 후속 통합 주의사항은
`docs/photo-report-media-20260913.md`에 기록한다. 이 후보는 공개 배포 전이다.

## 2026-09-09 레벨 3 준비도 점검과 데이터 안전 보완

대표가 현장 웹 개발 가능성과 레벨 3 도달을 요청했다. 공식적인 레벨 3 기준은
정의되어 있지 않아 범위를 확인 중이며, 기존 루프 성숙도 점수를 올려 달성으로
표시하지 않는다. 운영 기준선은 main `7971987`의 `hyeonjang-v273-officeconnect`다.
이번 로컬 후보 `hyeonjang-v274-recoveryguard`는 복구 전 안전 스냅샷 성공 강제와
동기화 대기열 읽기/쓰기 실패 시 기존 기록 보존 및 실패 안내를 보완한다.
(2026-09-09) 그 위의 로컬 후보 `hyeonjang-v275-video`: 대표 요청으로 현장 동영상(mp4·mov 등)을 사진 묶음으로
인식한다 — 첫 장면 썸네일·▶ 배지·재생기, 서버 중계(사진 전용)에는 보내지 않는다. 저장 스키마 변경 없음.
집계는 러너 마지막 줄을 믿어라(v274 129개 + video-files 1개).
(2026-09-09) `hyeonjang-v276-videotile`: 대표가 폰에서 동영상 그림이 안 보인다고 해 동영상 칸은 첫 장면 대신
🎬 + 파일 형식(MOV·MP4…)만 보이고 누르면 재생기. 동영상 썸네일은 만들지 않는다.
(2026-09-11) `hyeonjang-v277-calc`: 대표 요청으로 더보기(현장·시공)에 「🧮 자재 계산기」 — 헤베·평 환산, 타일, 도배,
페인트, 바닥 마감재, 석고보드, 필름, 목재, 레미탈, 벽돌, 콘크리트, 지붕, 칼라강판, 전기(참고) 14종. 순수 계산 `hjCalcRun`
(결과 `{rows, note, main}`)과 화면 `materialCalc` 분리. 같은 날 2차 요청("선택지가 필요하면 설정 가능하게, 더 쓰기 좋게")으로
⭐ 종류별 기본값(처음값과 다른 규격·로스만)·⚙ 기본값 화면·면적 3가지 입력(㎡·평·가로×세로)·규격/로스 칩·맨 위에 붙는 결과 상자·
🕘 작업기록 20건·📝 현장 메모로·➕ 견적에 담기·💰 예상 자재비(자재 단가가 같은 단위일 때만, 공급가 ÷1.1)를 더했다.
앱 저장 구조(serializeData)는 그대로 — 기본값·작업기록은 이 폰 localStorage `hj_calc_prefs`·`hj_calc_log`, 입력값은 세션 기억.
더보기 행동 계약은 113개(mobile-more-tools·mobile-office-connect). tests/material-calc.e2e.js ①~⑬ — 변이 71종 전부 검출.
같은 날 4관점(도메인·UX/접근성·데이터 무결성·코드) 검토에서 나온 것을 고쳤다: 견적에 담을 때 단가는 그 단가가 붙은 단위의 수량과 같이 넣고
(박스 단가를 장 수량에 곱하면 몇 배로 부푼다), 예상 자재비는 이름이 겹치면 가장 싼 것·매입가임을 밝히고, 지우는 동작(작업기록 끄기·모두 지우기·
전부 처음으로·기본값 ✕·↺)은 먼저 물어보고, 작업기록은 모았다 쓰되 화면을 떠날 때 남은 예약을 버린다(안 그러면 지운 기록이 되살아난다).
석고 피스는 보드 크기에 비례, 목재는 간격으로 뽑으면 대표 수량이 각재, 지붕 90° 이상은 계산 대신 안내, 도배는 코너 여유(벽 면수)와
'창·문 뺀 실면적' 표기, 전기는 역률 1일 때 모터 부하 안내와 75A·100A 전선 굵기 상향(25·35㎟ — 옛 16·25㎟는 허용전류에 못 미쳤다). 입력 16px·누르는 것 44px·칸마다 이름(aria)·면적 라벨이 모드를 따라간다.
장판·필름은 면적만 알면 폭 자투리가 빠진다고 알리고, 가로×세로를 넣으면 폭 수로 센다(필름은 세로를 통으로 뽑아 이음매를 만들지 않는다).
폭 수로 셀 때도 로스를 면적법과 똑같이 반영하고, 면적 모드를 오가도 넣어 둔 면적이 살아 있다(㎡→평→㎡ 왕복 반올림도 막는다).
도배 벽 면수를 넣으면 코너 여유가 맨 위 벽지·견적 수량까지 반영되고, 예상 자재비는 이름이 스쳐 맞는 남의 자재(20kg 몰탈·욕실 타일·
데코타일)를 규격·제외어로 걸러 낸다. 입력은 1e9 에서 자르고 수량이 ∞·0 이면 견적에 담지 않는다. 복사 글·작업기록에는 실제로 쓰인 값을 적는다.
(2026-09-12) `hyeonjang-v278-calcflow`: 대표가 "이렇게 개발 가능한 기능"을 물어 목록을 내고 "위 내용 진행" 지시를 받아
계산기 주변을 이었다 — 견적 화면 툴바에 「🧮 계산기」(클릭 위임 선택자 `#qmCalc` 등록 필요), 계산 종류에 「🗑 폐기물」
(철거 면적·대상·부풀림 → 부피·마대·트럭, ㎥당 단가를 넣으면 처리비 어림), 계산 결과를 「🧺 발주 담기」로 이 폰
장바구니(`hj_calc_cart`)에 모아 「🧺 발주 목록」에서 수량·거래처를 고쳐 기존 발주 문자 화면(materialOrderResult, 뒤로 갈 곳을
넘길 수 있게 4번째 인자 추가)으로 넘긴다(자동 발송 없음), 작업기록에 「실제 쓴 양」을 넣으면 내 로스율이 나오고 세 건이 쌓이면
⭐ 기본값을 제안한다(hjCalcLossOf·hjCalcLossAvg). 저장 구조·더보기 113개 계약은 그대로.
tests/calc-flow.e2e.js ①~⑥ — 변이 18종 전부 검출. 전체 회귀 132/132.
(2026-09-12) `hyeonjang-v279-measure`: 「📐 실측 노트」 — 방마다 가로·세로·천장고·창문 면적을 넣으면 바닥·벽·둘레와
합계가 나오고, 각 방의 🧮 를 누르면 계산기가 그 값을 받는다(도배는 둘레·천장고·개구부, 면적 칸이 있는 종류는 가로×세로).
값은 현장 객체(state.projects[].measure)에 붙어 저장된다 — serializeData 최상위 키는 늘지 않는다(projects 는 이미 저장 대상).
더보기 행동 계약 113→114(mobile-more-tools TARGETS·mobile-office-connect). tests/measure-note.e2e.js ①~⑥ — 변이 13종 전부 검출.
(2026-09-12) `hyeonjang-v280-receipt`: 기능 후보 조사에서 1순위로 나온 빈틈 — 영수증으로 넣은 지출에 현장이 안 붙어
현장 예산이 0원 그대로였다. 확인 화면에 현장(최근 3개 칩 + 목록·지금 보고 있는 현장 기본)과 결제 수단(카드 기본)을 넣고,
읽어만 놓고 버리던 거래처(vendor)를 지출 레코드에 저장한다 — 경비 분류(guessExpenseCategory)가 이미 e.vendor 를 읽고 있어
그동안 죽은 값이었다. 자재비를 수기로 넣어 둔 현장은 projStats 가 장부 대신 수기값을 쓰므로(이중 계산 방지) 그 사실을 화면에 알린다.
state.expenses 레코드 안의 필드만 늘고 serializeData 최상위 키는 그대로. tests/receipt-project.e2e.js ①~⑤ — 변이 7종 전부 검출.
(2026-09-12) `hyeonjang-v281-todo`: 「✅ 오늘 할일」 — 현장에서 떠오른 한 줄을 적고 체크한다. 메모(state.notes)에
`todo:true` 로 얹어 저장 키를 늘리지 않고 백업·동기화를 그대로 탄다({id,date,day,text,project,todo,done,doneAt}).
어제까지 안 끝난 것은 '밀린 할일'로 맨 위. 날짜 약속(오늘/내일)은 일부러 넣지 않았다 — 일정과 두 집 살림이 된다.
🎙 음성 회의록 목록에서는 할일을 걸러 보여 주고, 대화→할일의 막다른 길(메모 글로만 저장)에 「✅ 할일로 담기」를 뚫었다.
끝낸 일 지우기는 할일만 지운다(다른 메모가 done 을 달고 있어도 건드리지 않는다 — 검사로 고정).
더보기 행동 계약 114→115. tests/todo-list.e2e.js ①~⑦ — 변이 9종 전부 검출.
(2026-09-12) `hyeonjang-v282-prep`: 「🧰 출발 전 챙김」 — 일정 카드의 🧰 를 누르면 그 작업에 맞는 준비물이 체크박스로 뜬다.
작업 종류별 기본 목록(HJ_PREP_SETS 9종)은 그동안 일정 브리핑 안에 정규식으로 박혀 고칠 수 없던 힌트를 꺼내 한 곳에 모은 것이고,
브리핑도 같은 목록(hjPrepFor)을 쓴다. 내가 고친 목록은 이 폰(localStorage `hj_prep_sets`), 오늘 무엇을 실었는지는
그 일정(state.schedule 항목의 `prep`)에 남는다 — serializeData 최상위 키는 그대로. 재고 차감은 하지 않는다(싣는 때와 쓰는 때가 다르다).
일정 카드 버튼은 클릭 위임 선택자에 `[data-schprep]` 을 등록해야 동작한다(빠뜨리면 조용히 먹통 — 검사로 고정).
tests/prep-check.e2e.js ①~⑥ — 변이 10종 전부 검출.
(2026-09-12) `hyeonjang-v283-extrawork`: 「🖊 추가공사 확인」 — 공사 중 늘어난 작업을 그 자리에서 남긴다.
현장 객체에 `extras` 배열({id,date,text,amount,days,photo,agreed})로 붙어 serializeData 최상위 키는 그대로.
금액·공기 합계와 '확인받음' 건수를 위에 보여 주고, 사진을 연결할 수 있다. 「📋 확인 글」은 고객에게 보낼 글을 만들 뿐
자동 발송은 하지 않는다(금액을 비우면 '금액 협의'). 견적 작성 중이면 「➕ 견적에 담기」로 [추가] 품목이 된다.
더보기 행동 계약 115→116. tests/extra-work.e2e.js ①~⑦ — 변이 11종 전부 검출.
v284 「🏢 현장 부대사항」(2026-09-12): 실측 때 관리소에서 들은 규칙을 현장마다 적어 두고 시공 당일·AS·외주팀 공유에
쓴다. 칸 8개(출입·작업 시간/주차/자재 반입 동선/엘리베이터·보양/폐기물 배출-누가 치우나/공사 신고·예치금/관리실
위치·연락/그 밖). 현장 객체에 `siteRules` 로 붙어 serializeData 최상위 키는 그대로 — 이름을 `access` 로 쓰면 안 된다
(projectBackupSafe 가 출입정보로 보고 복원 때 지운다). `siteRules.at` 에 마지막으로 적은 날짜가 남고 복사 글 끝에
'※ <날짜> 현장에서 관리실에 들은 내용입니다. 그 뒤 바뀌었을 수 있으니 작업 전에 다시 확인해 주세요.' 로 기준 시점을
밝힌다(자동 발송 없음). at 은 규칙 칸이 아니라 개수에 세지 않는다.

출입 번호: 도어락 칸을 만들지 않을 뿐 아니라 다른 칸에 적어도 저장하지 않는다. `hjLooksLikeAccessCode` 는 (가) 칸 전체가
번호일 때(`#1234`, `5678*` — '-' 가 든 전화번호는 제외) (나) 출입 낱말(비번·도어락·번호키·공동현관·현관·출입…) **바로 뒤
4글자 안**의 4~8자리(뒤에 mm·원·년·대 같은 단위가 붙으면 제외)만 잡는다. 넓게 잡으면 '톤백 25000*2대', '공동현관 폭
1100mm', '보양비 30000원', '예치금 300000원' 같은 현장 메모까지 막혀 더 큰 손해가 난다. 걸려도 **이미 저장된 값을 지우지
않고** 그 입력만 저장하지 않으며, 그 칸 아래 경고를 켠다(경고 span 에 인라인 display 를 주면 [hidden] 이 져서 늘 보이므로
주지 않는다). 이미 섞여 들어온 값은 `projectBackupSafe`→`hjSiteRulesSafe` 가 백업·동기화에서 뺀다.

보이는 자리: 더보기 메뉴(행동 계약 116→117, MORE_HELP 로 '주차·엘리베이터·폐기물·관리실' 검색됨)뿐 아니라 정작 필요한
순간인 「📋 착공 전 체크」(stage 2)와 「🧰 출발 전 챙김」에 `hjSiteBrief` 한 줄로 붙는다 — 더보기 안에만 두면 '당일 아침에
기억이 안 난다'는 원래 문제를 못 푼다. 보관(archived) 현장도 목록에 「보관」으로 넣는다(AS 때가 바로 그 상황). 찾는 현장이
없으면 조용히 딴 현장을 열지 않고 알린다. 입력할 때마다 state.projects 에서 현장을 다시 찾는다(서버 자료를 불러오면 현장
객체가 통째로 교체된다). `hjSiteRules` 는 읽기만 하고 `hjSiteRulesEdit` 만 객체를 만든다. 복사·공유는 클립보드가 없으면
`coworkCopyFallback`, 공유가 거부되면 복사로 이어지고 사용자 취소(AbortError)만 조용히 넘긴다. 키보드가 올라오면
`hjKeepAboveFooter` 가 입력칸을 버튼 바 위로 올리고, `hjModalTapTargets` 가 모달 버튼·×를 44px 로 맞춘다.

곁들여 고친 것: 「선택 복원」이 현장 필드를 다섯 개만 되살려 고객·부대사항·추가공사·실측이 사라지던 것을
`projectBackupSafe(bp)` 전개로 고치고(보관 여부는 지금 운영 상태라 되돌리지 않는다), 안내문을 실제 덮어쓰는 범위로 고쳤다.
tests/materials.e2e.js ⑦ 은 openModal 이 여는 순간 거는 포커스와 경쟁해 ~30% 흔들리던 것을 대기로 고정했다(검사 내용은 그대로).
tests/site-rules.e2e.js ①~⑯ — 변이 59종 전부 검출.
남은 한계: 전체장부 엑셀 내보내기/데이터 이사 경로에는 부대사항 열이 없어 그 경로로 옮기면 규칙이 따라가지 않는다
(드라이브·JSON·백업 경로는 정상).
v285 「📦 현장별 자재 물량」(2026-09-12): 한 현장에서 타일·레미탈·도배를 따로 계산해 놓고 자재상에 전화할 때 처음부터
다시 세던 것을 없앴다. **새 화면을 만들지 않는다 — 더보기 계약 117 그대로.** v277 🕘 작업기록과 v278 🧺 발주 목록
사이의 끊긴 길을 잇는 일이다(후보 목록의 '현장 물량표'는 v278 이전 기준이라 절반이 이미 있었다).
· 작업기록·발주 목록을 `hjCalcGroupBy` 로 현장별로 묶는다(가나다, 현장 없는 것은 맨 뒤 '현장 미지정').
· 묶음 머리의 「🧺 이 현장 담기」가 그 현장 계산을 `hjCalcRun`→`hjCalcLogToItem` 으로 다시 돌려 발주 목록에 한 번에
  넣는다. 같은 현장·같은 이름·같은 단위는 `hjCartMergeAdd` 가 더한다(물량표는 '다 해서 몇 장'이라야 쓸모가 있다).
  수량이 안 나오는 계산(헤베 환산·전기 굵기)은 건너뛰고 몇 건 건너뛰었는지 말해 준다.
· 발주 목록에 현장별 예상 매입가와 전체 합계. `hjCartUnitPrice` 는 「자재 구매처·단가」에 **이름과 단위가 모두 같은**
  자재가 있을 때만 값을 붙이고(÷1.1 공급가), 단가 없는 줄이 몇 줄 빠졌는지 화면에 밝힌다 — 견적가가 아니라고 적는다.
· 작업기록 상한 20→50(`HJ_CALC_LOG_MAX`). 20이면 한 현장 몇 번 계산에 다른 현장 줄이 조용히 밀려 나갔다.
· 곁들여: 발주 목록의 수량·거래처를 고쳐도 저장되지 않아(문자 만들 때만 읽었다) 다시 열면 되돌아가고 합계도
  어긋나던 것을 고쳤다. 0·빈 수량은 받지 않고 되돌린다. **고칠 때 목록을 다시 그리면 안 된다** — change 는 blur
  처리 중에 오므로 옆 칸에 치던 값이 날아가고(기존 tests/calc-flow.e2e.js ④ 가 이 회귀를 잡았다) 손가락 밑에서
  칸이 사라진다. 저장한 뒤 `refreshSums()` 로 합계 글자(.ccSum[data-pkey]·.ccSumAll)만 제자리에서 바꾼다.
tests/site-bom.e2e.js ①~⑧ — 변이 23종 전부 검출. 저장 키는 그대로(hj_calc_log·hj_calc_cart 는 이 폰 전용).
v286 「출입번호 앞자리·확인일」(2026-09-12): v284 를 배포한 뒤 적대적 검토(45건 중 8건 생존)에서 확인된 실제 결함 둘을
고쳤다.
· **한 글자씩 치면 번호 앞자리가 남았다.** `page.fill` 은 input 을 한 번만 쏘지만 실제 키보드는 글자마다 쏜다.
  '도어락 9876' 을 폰에서 치면 '도어락 987' 까지 저장돼 백업·복원·📋 복사 글에 남았다 — 네 자리 코드의 경우의 수가
  열 가지로 줄어 앱 자신의 약속이 깨진다. `HJ_ACCESS_CODE` 의 `\d{4,8}` 를 `\d{1,8}` 로 바꿔 자릿수와 무관하게 막고,
  `HJ_ONLY_CODE` 도 네 자리 이상 제한을 뺐다. 대신 단위 목록(`HJ_ACCESS_UNIT`)을 넓혀 '현관 1층'·'출입 2명'·
  '현관 앞 3m'·'보양비 30000원' 은 그대로 저장한다. 막힌 입력은 이제 `hjSiteRulesEdit`·`markDirty` 도 부르지 않아
  빈 `siteRules:{}` 나 저장 대기 상태를 만들지 않는다. 나가는 글(`hjSiteText`)도 `hjSiteRulesSafe` 를 지난다 —
  옛 버전에서 이미 저장된 값이 외주팀 카톡으로 새면 안 된다(화면 자료를 지우지는 않는다).
· **확인일이 아무 칸이나 고칠 때마다 오늘로 덮였다.** 3월에 들은 주차·폐기물이 9월에 다른 칸 한 글자 고쳤다고
  '2026-09-12 현장에서 들은 내용' 으로 서명돼 나갔다 — hjSiteText 주석이 막겠다던 바로 그 상황이다. `siteRules.atMap`
  에 칸마다 날짜를 남기고, 복사 글은 줄마다 '(YYYY-MM-DD 확인)' 을 붙이며 머리말은 가장 옛 날짜~가장 최근 날짜의
  기간으로 적는다. atMap 은 규칙 칸이 아니라 개수에 세지 않는다.
tests/site-rules.e2e.js ⑰~⑳ 추가(실제 키보드 입력·낱말/단위 개별·칸별 확인일·자료 교체와 유출) — 변이 16종 전부 검출.
교훈: 입력 차단은 반드시 `page.keyboard.type` 으로도 검사한다. `page.fill` 만 쓰면 한 글자씩 들어오는 경로를 지나지 않는다.
v287 「현장별 발주 문자·규격·상한」(2026-09-12): v285 를 올리기 전 적대적 검토에서 네 관점이 독립적으로 같은 결함을
지목했다. v285 가 여러 현장을 한 장바구니에 담는 것을 기본으로 만들면서 터지는 것들이다.
· **발주 문자가 체크한 줄과 무관한 현장·주소로 나갔다.** `#ccMake` 가 `pj=(cart.find(x=>x.project)||{}).project`
  로 장바구니의 첫 현장을 머리에 붙였다 — 자재가 엉뚱한 주소로 간다. 이제 줄마다 `project` 를 실어 보내고
  `materialOrderResult` 가 **거래처+현장**으로 나눠 문자를 만든다(현장이 섞이면 카드 제목에 현장도 적는다).
  견적 기반 발주서는 줄에 project 가 없어 예전 그대로 동작한다.
· **규격이 다른 같은 이름 자재가 한 줄로 합쳐졌다** — 600×600 타일이 300×600 으로 둔갑했다. `hjCartMergeAdd` 의
  동일 판정에 규격(spec)을 넣었다.
· **장바구니 상한 40 에 조용히 잘렸다** — 「이 현장 담기」가 다른 현장 줄을 밀어내는데 토스트는 성공이라고 했다.
  상한 `HJ_CALC_CART_MAX` 80 으로 올리고, 넘쳐서 빠진 줄 수를 토스트에 적는다.
· **금액을 늘 전 구매처 최저가로 셌다** — 거래처 칸에 고른 곳과 값이 매겨진 곳이 달랐다. `hjCartUnitPrice` 가 줄의
  `sup` 이 있으면 그 거래처 값으로 센다(없거나 모르는 곳이면 예전처럼 최저가).
· **옛 기록을 다시 열어 고치면 그 계산이 '지금 보는 현장' 으로 끌려갔다** — 저장 때 `old.project` 를 이어받는다.
· 곁들여: 작업기록·발주 목록 묶음에서 **지금 보는 현장을 맨 위**로(오늘 쓸 것이 화면 밖이면 소용이 없다),
  줄 고르기 체크박스를 44px 로 키우고 aria-label 에 현장을 넣었다(현장이 섞이면 같은 자재가 구분되지 않았다),
  ⚙ 기본값·도움말에 남아 있던 '최근 20건' 문구를 50건으로 맞췄다.
tests/site-bom.e2e.js ⑨~⑬ 추가 — 변이 14종 전부 검출.
v288 「담기는 쌓기가 아니라 다시 만들기」(2026-09-12): v285 검토 2차(현장 실무·테스트 관점)에서 나온 것들.
· **「🧺 이 현장 담기」를 두 번 누르면 그 현장 물량이 두 배가 됐다.** 내가 v285 테스트에 '다시 담으면 더한다' 로
  고정해 둔 동작 자체가 결함이었다 — 눌렀는지 몰라 한 번 더 누르면 그대로 두 배 발주다. 이 버튼으로 만든 줄에는
  `auto:1` 표를 달고, 다시 누르면 **물어본 뒤 그 현장의 auto 줄만 지우고 지금 계산대로 다시 만든다**(손으로 담은
  줄은 건드리지 않는다). 덤으로 '공사 중간에 단가를 등록하면 이름이 바뀌어 두 줄이 되던 것' 도 같이 풀린다.
· **로스만 다른 같은 타일이 두 줄로 갈렸다** — 로스는 자재의 규격이 아니라 내 계산 가정이다. `hjCartSpecKey` 가
  규격에서 '(로스 N%)' 를 떼고 비교한다.
· **발주 문자에 단위가 없었다** — '타일 × 42' 가 42장인지 42박스인지 자재상이 알 수 없다. 줄마다 단위를 싣는다.
· **거래처 칸을 비울 수 없었다** — 지워도 다시 열면 `hjSupplierOf` 가 예전 거래처를 되살렸다. 저장된 값이 있으면
  (빈 문자열이라도) 그것을 쓴다.
· **줄 하나를 ✕ 로 빼면 꺼 둔 체크가 전부 되살아났다** — 빼 놓은 다른 현장 자재가 함께 발주된다. `hjCartOff()`
  (이 화면 동안만 사는 Set)로 꺼 둔 줄을 기억한다.
· 금액 표시에 '부가세 별도' 를 적었다 — 공급가라 실제 결제액은 10% 더 나온다.
tests/site-bom.e2e.js ③ 재작성·⑭⑮ 추가 — 변이 10종 전부 검출.
교훈: 내가 테스트로 고정한 동작이 곧 옳은 동작은 아니다. '두 번 누르면 두 배' 는 검사에 박혀 있어도 결함이다.
사진 원본·실제 자료·계정·서버·저장 스키마·SAFE_AUTO를 변경하지 않는다.
v201 원본 동기화 및 OfficeOps 활성화의 운영 검증 게이트는 계속 유지한다.
최종 전체 회귀 129/129 통과(12.9분, 동시 2, 종료 코드 0, 재시도 없음).
신규 실패 시나리오 30개 및 변이 8종을 검증했다. 초기 시험 환경 오류와
중단·실패 이력도 `docs/recoveryguard-test-report-20260909.md`에 보존한다.
운영 레벨 3 달성은 미선언이며 업로드·병합·운영 배포는 별도 승인 대상이다.

## 2026-09-08 마스터 비밀번호 확장 후보

`codex/portal-master-password-20260908`은 독립 `apps-script-office-portal/`의
마스터 비밀번호 입력 형식만 확장한다. system_admin은 기존 숫자 6자리 또는
공백 없는 8~64자 ASCII 비밀번호, 일반 직원은 숫자 6자리를 사용한다.
비밀번호를 trim하거나 원문을 로그·문서·픽스처에 넣지 않는다.
역할·단지 권한·스키마·사진 중계·PWA는 바꾸지 않는다. 실제 계정 생성과
Apps Script/Pages 배포는 로컬 코드 검증과 별개이며 별도 승인·소유자 인증이 필요하다.
공개 PWA 최신은 v273, PR #117/main `b54ac0c`, Pages `34187227939` 성공으로
확인했다. 아래 v272 운영 기준선과 v273 로컬 후보 설명은 당시의 과거 기록이다.
비밀번호 API 규약은 `apps-script-office-portal/README.md`를 먼저 읽는다.
최종 전체 회귀 127/127 통과(12.8분, 동시 2, 재시도 없음). 서버 단위검사 2파일,
보호 변이 4종과 프런트 교차 입력 828건을 확인했다. 비밀번호-only 저장 중 실패의
재시도 성공 오보고도 수정했다. 상세 근거는 `docs/portal-master-password-20260908.md`.

## 이 저장소가 무엇인가

만물인테리어(대전, 1인 시공업체, 대표 전병덕)의 **현장 운영 앱**.
`index.html` 단일 파일 PWA(약 28,000줄) + `sw.js`. **main 에 병합되는 순간
GitHub Pages 로 실제 운영 배포된다** — 사장님 폰에 바로 나간다.
실제 운영 기준선은 `hyeonjang-v319-phonetap`(main `8eedf70`, 2026-09-19 Pages #168)이다 — 맨 위 v306~v318 항목 참조.
아래 v272 기록은 당시 기준선이다: PR #116 main `46793bc`, Pages 실행 `34185653553` 성공(126/126, 5.0분, 동시 3),
공개 파일 5개 내용/버전 일치 및 비공개 파일 3개 404를 확인했다.
v271(PR #115)의 모바일 문서 폭 실패는 v272에서 보완되었으며 실패 이력을 보존한다.
이번 v273 로컬 후보는 신규 모바일 연결 검사를
포함한 127개이며 최종 집계는 러너 마지막 줄을 확인한다. 사진 동기화 로컬 후보
`hyeonjang-v201-photosyncp0`는 서버 선행 게이트 전에는 계속 병합·배포하지 않는다.
`sw.js`의 캐시 이름이 곧 버전이다.

후속 로컬 후보 `hyeonjang-v273-officeconnect`: 웹 업무 연결 센터 상단의 모바일
관리사무소 요약. 성공 조회 시각·미조회·오류·오프라인·오래된 조회를 구분하고
검토 대기/24시간 미확인/전송 대기/차단을 읽기 전용으로 표시한다. 기존 접수 검토·
아파트 오더·연결 설정과 직원 포털 로그인으로 이동한다. 기존 타이머는 요약만 갱신한다.
새 타이머·자동 재전송·접수 생성·저장 스키마·서버 변경은 없다. 신규 14개 및 변이3종
검증 뒤 v272와 통합했으며 최종 전체 127/127 통과(15.7분, 동시 2, 재시도 없음).
2026-09-08 대표가
최종 검사 통과 후 두 저장소 업로드·PR·main 병합·Pages 배포를 승인했다.
근거: `docs/웹앱_테스트결과_리포트_v273.md`.

2026-09-07 현장 검색 개선 배포: `hyeonjang-v262-searchrecovery`는 보관 현장 검색과
사진 검색 결과 없음에서의 복귀를 개선한다. 검색·화면 상태만 변경하며 사진·프로젝트
저장 구조와 서버는 바꾸지 않는다. PR #109 병합, Pages 검사 및 공개 HTML/SW 버전 일치 확인.

모바일 사진 배포본 `hyeonjang-v263-photointake`는 갤러리·촬영 뒤 현장/작업명 확인,
파일별 레코드 연결, 동명 파일의 과거 편집 승계 차단, 실제 백업/대기/실패 결과 구분을 추가한다.
`ingestFile`의 선택 옵션 `restoreEdits:false`는 새 사진 추가에만 사용하고 기존 재스캔은 편집 복구를 유지한다.
큐 저장 실패를 호출자에게 전달하지만 큐 구조·서버 계약·원본 바이트 영구 저장은 변경하지 않는다.
실제 휴대폰 카메라/갤러리와 운영 서버 업로드는 대표 실기기 확인 대상.
v263은 PR #110(main `1bd82d6`) 병합, Pages 실행 34043179701 성공(전체 118/118) 및 공개 HTML/SW 일치 확인 완료.

배포본 `hyeonjang-v264-photoguard`는 사진 추가와 앱 업데이트의 상호 보호,
기존 작업명/공정명 검색과 통합 검색 사진 결과 이동을 보완한다. 저장 구조·서버는 변경하지 않으며,
아파트 오더의 사진 연결은 작업명 검색 확장과 분리해 기존 기준을 유지한다.
PR #111(main `41edd975`) 병합, Pages 실행 34045375577 성공(전체 119/119), 공개 HTML/SW와 구현 커밋 `55fa28e` 내용 일치 확인 완료.

배포본 `hyeonjang-v265-photosource`는 사진 도구의 읽기 전용 보관 상태 화면을 추가한다.
서버 연결 기록, 현재 화면 파일, PC 파일 연결, 미리보기 기록을 구분하며 원본 백업 성공으로 단정하지 않는다.
서버/저장 구조/사진 배정은 변경하지 않는다. PR #112(main `08633ced`) 병합,
Pages 실행 34047546079 성공(전체 120/120), 공개 HTML/SW 일치 확인 완료.
로컬 최종 전체 회귀 120/120 통과(7.6분, 재시도 없음), 신규 7개 시나리오 및
분류/검색 변이 2종 검증 완료. 근거는 `docs/웹앱_테스트결과_리포트_v265.md`.

배포본 `hyeonjang-v266-aptunits`: 대표 요청의 아파트 프로젝트 내 동·호수/공용부 관리.
project.aptUnits와 파일의 선택적 aptUnit만 확장하며 기존 프로젝트/사진을 자동 병합·배정하지 않는다.
세대 등록·사진 배정은 안전 스냅샷과 원자 저장을 거친다. PR #113(main `9522283`) 병합,
Pages 실행 34060136689 성공(전체 121/121, 재시도 없음), 공개 HTML/SW 내용 일치 확인 완료.
로컬 최종 전체 회귀 121/121 통과(7.2분). `office-ops-conversion`의 병렬 저장 시각 관찰 차이는
정책대로 단독 재시도 1회 통과했다. 반복되면 해당 검사의 원자 스냅샷 읽기 조건을 점검한다.
신규 통합 10건, 재다운로드 확장 11건 및 변이 4종 검증. 상세는 `docs/웹앱_테스트결과_리포트_v266.md`.

배포본 `hyeonjang-v267-estimateinfo`: 견적서 목록의 날짜 출처 및 프로젝트 지정 화면.
견적일·앱 생성일·파일 수정일을 구분하고, 기존 자료 생성일을 추정하지 않는다.
새 앱 견적의 선택적 createdAt과 File 입력의 선택적 sourceModifiedAt만 추가한다.
작성 견적 프로젝트 지정은 quote 원본과 파생파일을 함께 원자 저장한다. 금액·수금·파일명 변경 없음.
실제 운영 데이터 수정/서버 변경은 하지 않았다. 신규 통합 9/9·변이 3종 검증,
최종 전체 회귀 122/122 통과(11.3분, 동시 3). 기존 OfficeOps 검사 2개는 정책대로
단독 재시도하여 통과했다. 재시도 원인은 미확정이며 상세 이력은 `docs/웹앱_테스트결과_리포트_v267.md`.
PR #114(main `3b337ab`) 병합, Pages 실행 34062313415 성공(122/122, 재시도 없음), 공개 HTML/SW 내용 일치 확인 완료.

후속 로컬 후보 `hyeonjang-v268-doclistui`: 서류 가로 목록 및 견적·정산 조회 UI 개선.
목록 검색·필터·정렬·상세 열림은 기기 세션의 화면 상태이며 백업에 저장하지 않는다.
금액 계산·중복 집계·수금·프로젝트 저장·서버 계약은 유지한다. 이번 UI의 배포는 별도 승인 대상.
신규 UI 통합 11/11 및 변이 2종 검증, 최종 전체 회귀 123/123 통과(7.5분, 재시도 없음).
PC/폰 6종 화면 확인, 상세 근거는 `docs/웹앱_테스트결과_리포트_v268.md`.

후속 로컬 후보 `hyeonjang-v269-mobilemore`: 폰 더보기 112개 기능의 연결 전수 점검,
바로가기 포함 검색·기기별 즐겨찾기·설명·큰 글씨·오류/포커스 처리 개선.
직접 실행 5종은 더보기에서 실행 전 확인하며, 날씨 실패 시 닫기를 보존한다.
최근 사용/즐겨찾기만 localStorage에 저장하고 업무 자료·저장 구조·서버는 변경하지 않는다.
배포는 v268과 함께 별도 승인 대상. 신규 통합 16/16 및 변이 2종 검증 완료.
최종 전체 회귀 124/124 통과(7.3분, 재시도 없음). 첫 실행의 정적 경로 검사 2개는
새 반환 형식을 정확히 검사하도록 수정 후 전체 재실행했다. 상세는 `docs/웹앱_테스트결과_리포트_v269.md`.

후속 로컬 후보 `hyeonjang-v270-photoreport`: 사진 작업일지의 기간·공정·작업명 조회,
날짜 미확인 표시, 조회 기록 글 복사 및 최대 4장 선택 이미지 미리보기 개선.
필터·선택은 화면 상태뿐이며 원본 사진·배정·업무 저장·금액·서버를 변경하지 않는다.
AI는 전송 내용 확인 후 실행하며 화면 전환/필터 변경 뒤 늦은 응답을 무시한다.
기존 진행 리포트의 사진 로더 반환 계약도 수정했다. 신규 18/18·변이 3종 검증 완료,
최종 전체 125/125 통과(9.1분, 동시 3, 재시도 없음). 첫 124/125 실패는 검사기의
논리연산자 뒤 정규식 파싱 한계로, 동일 패턴을 상수로 분리한 뒤 검사 완화 없이 전체 재검증했다.
상세는 `docs/웹앱_테스트결과_리포트_v270.md`. v268+v269와 함께 배포는 별도 승인 대상.

후속 로컬 후보 `hyeonjang-v271-reportoutput`: 사진 작업일지의 동·호수/공용부 필터,
작업명 미입력 조회 및 명시적 TXT 다운로드. 동·호수 화면에서 해당 위치 작업일지로 바로 이동한다.
기존 aptUnits 연결만 읽으며 자동 추정·배정·저장 스키마·서버·금액은 변경하지 않는다.
글에 위치가 포함됨을 알리고 고객 연락처·금액·세대 메모는 자동 첨부하지 않는다.
다운로드/사진 로딩/AI 결과에 조회 기록 변경 검사를 추가한다. 신규 14/14와 변이 3종,
최종 전체 126/126 통과(8.0분, 동시 3, 재시도 없음). 근거는
`docs/웹앱_테스트결과_리포트_v271.md`. v268~v270과 함께 로컬 후보이며 배포·업로드는 별도 승인 대상.

배포 수정 후보 `hyeonjang-v272-docwrap`: 서류 행의 `.meta`에만
`overflow-wrap:anywhere`를 적용해 긴 고객명/부가 설명이 좁은 화면에서 넘치지 않도록 한다.
기본 Windows 폰트에서 드러나지 않던 문제를 넓은 폰트·연속 영문으로 재현해 검증한다.
문자 잘라내기·스크롤 숨기기·기존 테스트 완화는 하지 않으며 사진 카드와 데이터는 변경하지 않는다.
대표의 2026-09-07 배포 진행 승인 범위에 포함된 오류 보완이다. 최종 로컬 전체 회귀는
126/126 통과(14.2분, 동시 2, 0 실패, 재시도 없음). 앞선 실행의 OfficeOps 시간 초과는
실패 이력으로 보존했다. 제품 코드·검사·180초 제한은 같고 동시 실행만 조정했다.
PR #116 병합 및 공개 배포 확인 완료. 근거는 `docs/웹앱_테스트결과_리포트_v272.md`.

자매 저장소 `01023978629/manmool`: 공개 홈페이지 + 전자계약 Apps Script 서버 소스.

## 🔴 절대 금지 — 어기면 실제 사고가 난다

1. **`apps-script/` 폴더는 검토된 `OfficeIntake` 모듈과 후속 `Code.gs` dispatch split만 수정할 수 있다.** 기존 사진 중계 서버의 모든 relay action과 동작은 보존한다. 배포는 수동으로만 한다.
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
node tests/version-sync.check.js       # 화면 버전 == sw.js 캐시 버전
node tests/serialized-keys.check.js    # 직렬화 최상위 키 목록 네 곳 일치(키를 더했으면 반드시)

# 3) 전체 회귀 — 권위 있는 집계는 tests/run-all.js 가 찍는 'N개 중 N 통과' (2026-09-19 기준 165개)
#    종료코드로 판정한다(출력 마지막 줄만 보고 성공으로 판정하지 마라).
#    러너의 파일당 180초 제한을 제거하지 마라 — 한 파일이 멈춰도 실패로 끝나야 한다.
node tests/run-all.js
#    (2026-09-04) 브라우저 검사는 min(3, CPU-1)개씩 동시에 돈다(약 9분 → 4분). HJ_TEST_JOBS=1 이면 예전처럼 순서대로.
#    병렬에서 떨어진 파일은 끝에 단독으로 한 번 더 돌고 로그에 '재시도'로 남는다 — 재시도로만 통과한 파일이
#    반복되면 그 검사의 대기 조건을 고쳐라(러너의 재시도 횟수를 늘리지 마라).

# 4) 이번 OfficeOps source-only 인수인계 브랜치에서만 실행 (일반 PWA 변경은 제외)
node tests/commercial-approval-isolation.check.js
node tests/office-ops-server-isolation.check.js
node scripts/verify-office-ops-branch-scope.mjs
```

- **새 기능 = 새 테스트.** 그리고 반드시 **변이 검증**: 보호하는 동작을 일부러
  되돌려 테스트가 실패하는 것까지 확인하라. 안 잡히면 그 테스트는 장식이다.
- **`index.html` 을 고쳤으면 `sw.js` 캐시 버전을 올려라** (`hyeonjang-v{N+1}-{짧은이름}`).
  안 올리면 사장님 폰이 옛 버전을 계속 쓴다.
  **그리고 `index.html` 의 `APP_BUILD` 도 같은 값으로 맞춰라** — 그게 설정 화면과
  푸터에 찍혀 "지금 몇 번이세요?" 의 답이 된다. 예전에는 이 상수가 규칙 밖이라
  아무도 안 고쳤고, v183 폰이 화면에 '2026-07-30' 을 띄웠다. 틀린 번호는 없는
  번호보다 나쁘다 — 그 답을 믿고 엉뚱한 데를 판다. `version-sync.check.js` 가 막는다.
- 커밋 메시지는 "무엇을" 이 아니라 **"왜"** 를 적는 것이 이 저장소의 관례다.
- **브라우저 검사의 대기는 '끝 신호'로.** 고정 `waitForTimeout` 은 느린 러너에서 경쟁 조건이 된다(2026-09-05, manmool 배포가
  이걸로 한 번 떨어졌다). 부팅 IDB 읽기 뒤에 모의값을 넣을 때는 `__hjRestoreDone`·`__hjRelayConfigDone`·`__hjOfficeOpsBootDone` 을
  기다리고, IDB 왕복 뒤에 바뀌는 상태는 값이 바뀔 때까지 폴링하고, 시트를 닫은 뒤 다음 시트를 열 때는 `__mobileSheetHistoryRetire`
  가 비기를 기다려라. **`page.waitForFunction` 에 async 함수를 주지 마라** — Promise 자체가 참으로 잡혀 기다리지 않고 바로
  통과한다(실험으로 확인). IDB 를 읽어야 하면 `page.evaluate(async () => { for (...) { ... await idbGet(...) } throw ... })` 로
  페이지 안에서 폴링하라(relay·storage-durability 가 그 예).

## 지켜야 할 불변식 (각각 테스트가 못박고 있다)

| 불변식 | 지키는 테스트 |
|---|---|
| 직렬화 최상위 키는 허용목록에만 추가 — 키 하나에 **여섯 곳**(serializeData·applyData·PAID_SERIALIZED_STATE_KEYS·유상 배열 목록·검사 허용목록 2곳) | `serialized-keys.check`(정적 대조), `health-board`, `marketing-draft`, `restore-parity`, `office-ops-conversion` |
| 키 입력칸: 빈 값 저장 = "안 바꿈", 삭제는 [지우기]+확인만 | `key-persist` |
| 요금은 조건형으로만 ("결제계정이 없을 때만 무료") | `cost-honesty.check` |
| 전자계약 버튼은 서버 자가진단 통과 전까지 잠김, 잠긴 동안 요청 0 | `contract` |
| AI 도구 추가는 5곳(AI_TOOLS·aiToolRun·aiActionLabel·aiResultBrief·AI_WRITE), 맨 앞 주석 수는 실제 배열 길이와 일치 | `apt-ai`, `ai-tools-count.check` + ai-automation-auditor 감사 |
| 쓰기 도구는 AI_WRITE(승인 게이트), SAFE_AUTO 확대는 대표 승인 | `apt-ai` |
| 아파트 오더: 통계·정산은 완료월(doneAt) 기준, 입금완료 금액 수정 금지, 입금은 정산서에서만(payLog 1회) | `apt-orders`, `apt-stats`, `apt-amount` |
| 수금 입력은 미수 알림에서 한 번에 닿는다(얼마·언제), 미래 입금일 금지, 일부 입금은 독촉을 닫지 않는다 | `recv-entry` |
| 설정 화면은 탭 구조, 키는 아코디언 1겹까지 | `settings-tabs`, `key-persist` |
| AI 중계: 서버 키 없으면 기기 키 폴백, 한도 초과는 우회 금지 | `ai-relay` |
| 서버 날짜별 백업은 성패를 기록하고 화면에 띄운다 — 실패를 삼키지 않는다 | `backup-visible` |
| 아파트 오더 전/후 카드는 그 동/호 사진만 대상(파일명 매칭), 2장 이상일 때만 | `apt-ba` |
| 클로드 요청은 승인해야 적용, 같은 id 두 번 적용 금지, 모르는 도구 실행 금지 | `claude-inbox` |
| 링크는 `#hjreq=`(쿼리 금지 — 로그·SW캐시 누수), 승인 전 안전판, 삭제·발송·반출 도구 차단 | `claude-link` |
| 수금은 **누적**이지 덮어쓰기가 아니다 — 일괄 완납도 현장마다 payLog 1건 | `due-settle-all` |
| 하자보증 기본값은 법정기간(방수 36·설비 24·마감 12) 이상 | `warranty-review` |

## 구조 지도 (함수명으로 찾아라 — 줄번호는 금방 낡는다)

- 데이터: `state` + `serializeData()/applyData()` (드라이브 백업 왕복)
- 설정 화면: `openGdriveSetup()` — 5탭(저장·백업/전자계약/OfficeOps/AI·지도 키/기타)
- 전자계약 연결: `contractCall()`, `contractSelfTest()`, `contractFeatureAvailable()`
- AI: `geminiCall()`(서버 중계 우선), `aiFC()`(도구 호출), `AI_TOOLS`/`aiToolRun()`
- 아파트 오더: `aptOrderManage()`, `aptSettle()`, `aptStats()`, `aptPhotoCount()`
- 주간·운영 보고: `weekBriefData/Text()`, `opsReportData/Text()`
- 전체 장부 엑셀: `exportFullXlsx()` (11시트 — v328 추가공사)
- `apps-script-commercial/`: separate Apps Script project인 source-only 프로젝트.
  자체 Script Properties와 수동 deployment가 필요하고 `APP_TOKEN`을 공유하지 않으며,
  Pages merge로 배포되지 않는다.
- `apps-script-office-ops/`: separate Apps Script project인 source-only 프로젝트.
  자체 Script Properties와 수동 deployment가 필요하고 `APP_TOKEN`을 공유하지 않으며,
  Pages merge로 배포되지 않는다.

## 서브에이전트

`.codex/agents/` 에 10종 정의됨(`.claude/agents/` 와 동일). 원칙:
같은 파일은 쓰기 에이전트 1명만(single-writer), 쓰기 전에 관련 리뷰어 근거 확보,
PII 원문 금지(전화 뒷 4자리만), 검증 없는 완료 보고 금지.

## 작업 분류 — 누가 할 수 있는 일인가 (2026-08-05)

에이전트(Claude·Codex)가 "못 하는 일"은 **전부 코덱스로 넘길 수 있는 게 아니다.**
대부분은 사람 손이 필요하고, 코덱스에 맡겨 두면 영영 안 끝난다. 세 칸으로 나눈다.

### 🅰 에이전트가 한다 (Claude·Codex 아무나 — 저장소 안에서 끝나는 일)

코드·테스트·문서. 위 절차(테스트 → 변이 검증 → sw 버전)만 지키면 된다.
실환경 체크리스트는 `apps-script/README_APPS_SCRIPT.md`의 배포 전 9개 gate로
정리됐다. 저장소 밖 Google 계정·실기기 확인은 아래 🅱 경계로 남는다.

*(해결됨 — 백업 0건)* `relayDailyBackup` 의 코드 경로도 서버 `makeBackup_` 도
멀쩡했다. 원인은 **모든 실패를 `catch(e){}` 로 삼켜** 매일 조용히 실패해도
알려 줄 화면이 없었던 것. v179 에서 성패를 기록해 백업 센터에 띄운다
(`backup-visible.e2e.js`). 이제 대표가 화면 색만 보고 알려 주면 된다.

### 🅱 사장님만 할 수 있다 (브라우저·본인 계정·결제 — 에이전트는 대신 못 누른다)

코덱스로 분류하면 **안 된다.** 코덱스도 똑같이 못 한다.

| 일 | 어디서 | 지금 상태 |
|---|---|---|
| Gemini API 키 발급 | `aistudio.google.com/api-keys`, 프로젝트 `Manmool Gemini No Billing` | **막힘** — "The request is suspicious" 재시도 필요 |
| 전자계약 Apps Script 배포 | 본인 구글 계정 | 배포 URL·스크립트 속성 설정됨 — 앱 자가진단과 실기기 계약 흐름 확인 필요 |
| 앱 ⚙️설정 자가진단·실기기 서명 확인 | 앱 | 대표 폰에서 최종 확인 필요 |
| 네이버·구글 소유확인 코드 | 서치어드바이저·서치콘솔 | manmool `index.html` 11~14행이 주석 처리된 자리표시자 |
| Threads 토큰 재발급 | Meta | 2026-06-19 만료 |
| 실제 문자·알림톡 발송 승인 | — | 계속 OFF 가 정상 |

### 🅲 사장님이 자료를 줘야 에이전트가 한다

실제 고객 후기(지어내기 금지), 현장 사진, 아파트 단지·관리사무소 정보.

## 지금 상태와 남은 일 (2026-09-01)

- (2026-09-04) 운영 기준선은 main 최신 `hyeonjang-v254-suggestbar`. v249~v254: 접수함 접수번호 읽기(v249)·접수함 링크(v250)·📍 사진 배정 점검(v251)·부팅 설정 읽기 완료 신호 `__hjOfficeOpsBootDone`(v252, 검사가 `__commercialApproval` 모의값을 넣기 전에 기다려야 한다)·👉 추천 배정(v253)·추천 버튼을 상단 요약 줄로(v254, 폰 첫 화면 규칙). 아래는 2026-09-01 기록: 소스 브랜치 기준선은 `hyeonjang-v243-photofirst`였다. 232~236 이력에서 v232는 관리사무소 접수의 공개 보고 수정·철회, 명시 프로젝트 사진 소유권, revision·충돌 복구를 포함했고, v233은 관리사무소 포털 선언 사진 슬롯, 승인 전 사진 attach gate, pre-accept revision 승계, semantic outbox 차단과 admin fail-closed를 추가했다. v234는 신규 접수의 사진 슬롯 선언을 필수화하고, 오프라인 승인 뒤 `photos-pending` 복구와 완료 사진 오류의 strict FIFO·상위 revision 교체 계약을 추가했다. v235는 완료 보고 수정의 합법적인 상태 전이 체인과 승인 payload 입력 오류 차단을 추가했다. 해당 범위의 마지막 버전은 승인 오더·outbox 선저장과 단일 FIFO 발송, request 단위 projection revision 재기준화, 익명 로그인 선행 캐시 제한, canonical slug·PNG 8-byte·slash 전화 마스킹 계약을 추가했다.
- OfficeOps·paid gate 작업은 이 소스 브랜치에만 있다. Task 6 최종 버전 마커·검토와 이후 대표의 명시적 병합·배포 승인이 모두 끝나기 전에는 운영 배포 상태로 보지 않는다. `apps-script-office-ops/conversion-promotion.json`의 `enabled`는 현재 `false`라 운영 OfficeOps 전환 승격도 꺼져 있다.
- 로컬 v201 사진 동기화 후보는 운영 서버 v1 멱등 계약과 대표 iPhone 실기기 확인 전까지 병합하지 않는다. v219에도 포함하지 않았다.
- 현재 전체 회귀 기준은 `tests/run-all.js`가 집계하는 파일 전부(2026-09-19 현재 163개)다. 과거의 브라우저·정적 60개 집계는
  OfficeIntake 서버·회귀 검사를 추가하기 전 기록이므로 완료 기준으로 쓰지 않는다.
- `AI_TOOLS` 실제 배열은 170종. 맨 앞 개발자 주석도 170종으로 맞췄고,
  `tests/ai-tools-count.check.js` 가 숫자가 어긋나면 실패한다.
- 전자계약 Apps Script는 배포 URL과 속성이 설정돼 있다. 완료로 확정하려면 대표 폰에서
  앱 자가진단, 계약 생성→서명→완료 PDF 실기기 확인이 필요하다. 실제 문자·알림톡은 계속 OFF.
- 고객 사례 글 재료는 `aptReviewMaterialText()` 6항목 형식으로 복사한다. 동·호수와
  고객 연락처를 공개 글에 넣지 않는다; manmool `scripts/new-case-post.mjs` 로 넘긴다.
- 네이버·구글 소유확인 코드, Threads 토큰 갱신, Gemini 키 상태 확인은 대표 계정 작업이다.
## 2026-10-03 v337 Pages 실패 후 UI 검사 측정 경계 보완

- PR #168은 전체 225/225와 안정화 변이 5/5 통과 후 `ae69c6b`로 병합됐다. main Pages `37130082023`은 전체 223/225로 실패하여 stage·upload·deploy를 건너뛰었다. 이를 배포 완료라고 기록하지 않는다. 대표의 "수정해여 배포" 범위에서 `codex/ui-test-settle-20261003`에 테스트만 추가 보완한다.
- 거래처·재고 검사는 실제 초기 모달 초점, 단가표는 마지막 50ms `matName` 초점 완료를 제출 전에 기다린다. 오류 후 `fieldCheck`의 즉시 초점·aria·안내·입력 해제 단언은 그대로이며 오류 칸에 수동 초점을 주지 않는다.
- 실제 앱 CSS의 80ms translate 전환을 합성 DOM에서 붙잡으면 CSS/offsetHeight 44인데 DOMRect 43.999969가 재현된다. 기존 CI 로그에는 정확한 실패 버튼 실측이 없었으므로 그 버튼 자체를 확정한 증거는 아니다. 검사에서는 모달 종료의 원래 버튼 초점 복귀, 예약 렌더와 대상/상위 요소 애니메이션 완료를 기다린 뒤 원래 `>=44`를 엄격히 측정한다. 허용 오차·반올림·크기 대기·실패 catch는 넣지 않는다.
- 카메라 프로젝트 검사는 실제 lexical `__mobileSheetHistoryRetire`와 첫 목록 버튼 표시를 기다린 뒤 종전 exact 순서를 비교한다. `window.__mobileSheetHistoryRetire`로 부팅/종료 상태를 확인했다고 간주하지 않는다.
- 실제 스타일을 쓰는 정지 전환 회귀와 오류 초점 제거/43px 축소 변이를 추가한다. 변이 총 7종이며 timeout/실행 오류는 탐지로 세지 않는다. 모든 원본 단언·시간 제한·재시도 정책·공개 18파일·v337 빌드 3곳·실자료/서버/계정은 유지한다. 최종 전체와 Pages/공개 결과는 후속 PR의 실제 실행 기록을 따른다.
