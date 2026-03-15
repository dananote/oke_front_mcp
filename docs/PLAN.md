# PLAN

## STEP 1 - Figma 기획 조회

- [x] 화면 ID/자연어 검색
- [x] 버전 미지정 후보 제시
- [x] fallback 검색 + 학습 저장
- [x] `figma://screens` 실제 화면 목록 제공
- [ ] 의도 추론 품질(동의어/문맥) 고도화

## STEP 2 - Publisher 코드 조회

- [x] `search_publisher_code` 구현
- [x] 하이브리드 repo sync(auto + fallback)
- [x] bundle 응답(main/script/style/shared)
- [x] sync 실패 degraded 모드(캐시 커밋/캐시 인덱스)
- [x] 경로 분류 확장(`views/router` 포함)
- [x] 질의 확장(`LB`, `로드밸런서` 등)
- [x] 솔루션/메뉴 축 분류(`solution`, `menuPath`) 추가
- [x] 엔티티/페이지타입/모달 분류(`entity`, `pageType`, `isModal`) 추가
- [x] SSH 우선 동기화 진단(원인 코드 + 조치 가이드) 추가
- [x] 개발요청형 질의 의도 파싱(`개발해줘`, `차이 수정`) 추가
- [x] LLM 적용 친화 응답(merge 규칙/적용 가이드) 제공
- [x] 동의어 규칙 파일(`publisher-synonyms.json`) 기반 질의 확장
- [x] `primary/related_modal/shared` 구조 응답 제공
- [x] 퍼블 구조 요약 파일(`publisher-taxonomy.json`) 생성 스크립트 추가
- [ ] 매핑 정확도 고도화(케이스 기반 정밀 튜닝)

## STEP 3 - 전구간 관측성

- [x] 공통 requestId 기반 Tool 추적(start/success/error)
- [x] 단일 통합 로그(`~/.oke-front-mcp/mcp-debug.log`)
- [x] 인자/결과/에러/소요시간 기록 + 민감정보 마스킹
- [x] Step1~3 통합 QA 자동 검증(`npm run qa:step1-3`)
- [ ] 리소스/외부 API 레벨 세부 추적 옵션 고도화

## STEP 4 - Design 연동

- [ ] 디자인 정책 데이터 소스 확정(Confluence/API)
- [ ] 정책 검색 Tool 설계
- [ ] 기획/퍼블/디자인 통합 응답 포맷 확정

## STEP 5 - smithery 에 mcp 서버 등록

- [ ] smithery에 mcp 서버 등록

## 현재 우선순위

1. Design 연동 스펙 확정
2. Publisher 매핑 품질 고도화(실서비스 케이스 튜닝)
3. 리소스/API 세부 추적 확장
