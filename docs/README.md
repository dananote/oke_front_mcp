# README

`oke-front-mcp`는 프론트엔드 개발에 필요한 기획(Figma)과 퍼블 코드(Publisher)를 MCP Tool로 조회하고, LLM이 프로젝트 규칙에 맞춰 코드를 반영할 수 있도록 컨텍스트를 제공하는 서버입니다.

## 현재 제공 범위

- `search_figma_spec`: Figma 기획 조회
- `search_publisher_code`: 퍼블 저장소 코드 번들 조회 + 적용 컨텍스트 제공
- `data/publisher-synonyms.json`: 한글/영문 도메인 용어 확장 규칙
- `data/publisher-taxonomy.json`: 퍼블 `views` 구조 요약(솔루션/메뉴/엔티티/페이지타입)
- `figma://screens`: 화면 목록 리소스(JSON)
- `figma://stats`: 인덱스 통계 리소스(JSON)

## 동작 원칙

- 기획 요청(예: "기획 가져와")은 `search_figma_spec`를 사용합니다.
- 퍼블 요청(예: "퍼블 가져와")은 `search_publisher_code`를 사용합니다.
- 개발 요청(예: "호스트 생성페이지 개발해줘", "현재 코드와 퍼블 차이 수정해줘")도 `search_publisher_code`를 사용합니다.
- 개발 진행 요청은 Cursor가 상황에 따라 두 Tool을 순차 호출할 수 있습니다.
- Publisher 저장소 동기화 실패 시, 가능한 경우 캐시 인덱스로 degraded 검색을 수행합니다.
- 코드 자동 반영은 MCP가 직접 수행하지 않으며, 반환 컨텍스트를 기반으로 LLM이 대상 프로젝트 규칙에 맞춰 반영합니다.
- 퍼블 검색은 단일 키워드 매칭이 아니라 `동의어 규칙 + 메뉴 힌트 + 다중 검색 프로파일`을 순차 적용합니다.
- 부분 기능 요청(예: 모달 연결)에는 `primary/related_modal/shared` 구조로 후보를 전달합니다.

## 실시간 추적

- 모든 요청/실행 로그는 단일 파일에 태그 기반으로 기록됩니다.
- 기본 경로: `~/.oke-front-mcp/mcp-debug.log`
- 실시간 확인:
  - `tail -f ~/.oke-front-mcp/mcp-debug.log`

## 문서 맵

- 검색 흐름: `docs/SEARCH_FLOW.md`
- 구현 구조: `docs/DEVELOPMENT.md`
- 장애 대응: `docs/DEBUG.md`
- 단계 계획: `docs/PLAN.md`
- 설치/운영: `docs/SETUP_GUIDE.md`
