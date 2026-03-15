# DEVELOPMENT

현재 구현은 Figma 기획 조회 + Publisher 코드 조회를 중심으로 구성됩니다.

## 1) 주요 구성

- `src/index.ts`
  - MCP 핸들러 등록
  - Tool 라우팅
  - Resource 라우팅
  - 공통 실행 추적(requestId/duration/start/success/error)
- `src/mcp-tools-schema.ts`
  - Tool 스키마 단일 소스
- `src/services/search.ts`
  - `screen-index.json` 기반 검색/통계/화면 목록
- `src/services/publisher.ts`
  - repo 동기화 및 `publisher-index.json` 구축/검색
  - `solution/menuPath/entity/pageType/isModal` 분류 메타데이터 생성
  - SSH 우선 정책 기반 동기화 오류 분류(`syncIssues`)
- `src/tools/search-figma-spec.ts`
  - 기획 질의 파싱/검색/후보 선택
- `src/tools/search-publisher-code.ts`
  - 퍼블 질의 전처리/의도 파싱/번들 응답
  - LLM 코드 반영용 가이드(merge 규칙) 포함
  - 동의어 규칙(`publisher-synonyms.json`) + 다중 검색 프로파일 순차 시도로 폴더 구조 매칭 강화
  - 한글 중심 실무 질의(네트워크/인스턴스/보안그룹/파이프라인/모달 등) 확장 규칙 반영

## 2) Tool 라우팅 설계

- `search_figma_spec`: 기획 조회 전용
- `search_publisher_code`: 퍼블 코드 조회 전용
- `buildToolsList()`는 `project` 기본값을 Figma Tool에만 주입합니다.
  - 의도: Publisher 검색 범위를 의도치 않게 축소하지 않도록 방지

## 3) Resource 설계

- `figma://screens`는 통계가 아니라 실제 화면 목록을 반환합니다.
- `figma://stats`는 인덱스 통계를 반환합니다.

## 4) Publisher 안정화 설계

- auto 경로에 repo가 있으면 `git pull --ff-only` 시도
- pull 실패 시:
  - 기존 커밋을 읽어 degraded 모드로 계속 사용
  - 또는 fallback 경로/캐시 인덱스로 조회 유지
- 인덱스 재생성 실패 시에도 캐시 인덱스로 검색을 계속합니다.
- 경로 인식은 `publishing-*`뿐 아니라 `views/router` 경로까지 확장했습니다.
- 동기화 상태에는 `syncIssues`(오류 코드/메시지/즉시 조치)가 포함됩니다.

## 5) Publisher 인덱스 모델

- 인덱스 파일: `data/publisher-index.json`
- 보조 분석 파일: `data/publisher-taxonomy.json`
- 목적:
  - 원본 퍼블 레포 전체 스캔 비용을 줄이는 검색 캐시
  - 커밋 단위(`gitCommit`)로 어떤 기준 코드에서 추출했는지 추적
- 주요 필드:
  - `project`: 표시용 프로젝트 라벨
  - `solution`: 솔루션 식별자(`contrabass|viola|ceph|bootfactory|sds|shared|unknown`)
  - `menuPath`: 솔루션 하위 메뉴 경로(예: `instance/create`)
  - `entity`: 페이지 도메인 엔티티(예: `floatingip`, `segment`)
  - `pageType`: `create|detail|edit|modal|list|component|unknown`
  - `isModal`: 모달 파일 여부
  - `styleRefs/sharedComponentRefs`: 적용 시 함께 검토할 연관 파일
  - `localVueRefs/modalRefs`: import 기반 연관 Vue/모달 참조
- 검색 스코어링:
  - `menuPath` 매칭 가중치 반영
  - `create`, `volume`, `storage`, `modal`, `detail` 등 의도 토큰에 대해 페이지 타입/경로 가중치 강화
  - 부분 기능 요청 시 `primary/related_modal/shared` 구조로 전달

## 6) 공통 추적(Observability)

- 파일: `src/utils/mcp-request-logger.ts`
- 태그:
  - `mcp요청확인`, `mcp도구실행`, `figma기획확인`, `publisher코드확인`
- 공통 필드:
  - `ts`, `requestId`, `tool`, `event`, `argsMasked`, `resultSummary`, `resultMasked`, `durationMs`, `error`
- 민감정보(`token|authorization|secret|password|key`)는 마스킹합니다.
- 단일 로그 파일: `~/.oke-front-mcp/mcp-debug.log`

## 7) 디스크립터 동기화

- 스크립트: `src/scripts/sync-mcp-descriptors.ts`
- 생성물: `mcp-descriptors/search_figma_spec.json`, `mcp-descriptors/search_publisher_code.json`
- 생성 후 필수 디스크립터 누락 여부를 검증합니다.
- `CURSOR_MCP_TOOLS_DIR`가 설정되어 있으면 해당 경로로 자동 복사합니다.

### Cursor / mcp-qa-app 바로 동기화

- 동기화 대상은 **MCP를 쓰는 워크스페이스**의 mcps 폴더입니다. 워크스페이스마다 Cursor 프로젝트 경로가 다릅니다.
- 기본값: `CURSOR_MCP_PROJECT_ID=Users-taeheerho-Desktop-mcp-qa-app` → mcp-qa-app을 연 창에서 MCP 질의 시 최신 도구 적용.
- `npm run sync:cursor`: 디스크립터 생성 후 위 경로(또는 `CURSOR_MCP_TOOLS_DIR`)로 복사.
- `npm run build:dev`: `npm run build` 후 `sync:cursor` 실행. oke-front-mcp에서 실행해도 mcp-qa-app 쪽으로 동기화됩니다.

**로직 vs 스키마 반영**: 로직만 변경한 경우 `npm run build` 후 Cursor 재시작만 하면 새 코드가 적용된다. 도구 이름·파라미터·설명을 바꾼 경우에는 mcps 쪽 JSON 갱신이 필요하므로 `sync:cursor` 또는 `build:dev`를 실행해야 한다.

- `npm run build:publisher-taxonomy`: 현재 `publisher-index.json` 기준 구조 요약 파일 생성
