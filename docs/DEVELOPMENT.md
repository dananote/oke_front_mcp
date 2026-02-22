# DEVELOPMENT

Step 1(Figma)와 Step 2(Publisher) 기준으로 현재 코드 구조와 핵심 설계를 정리합니다.

---

## 1) 아키텍처

- Tool Layer
  - `search_figma_spec`
  - `search_publisher_code`
- Service Layer
  - `FigmaService`
  - `SearchService`
  - `PublisherService`
- Script Layer
  - `collect-metadata`(Figma 인덱스 수집)

---

## 2) 파일 책임

- `src/index.ts`
  - MCP tool schema 등록
  - tool 호출 라우팅

- `src/tools/search-figma-spec.ts`
  - 질의 파싱
  - 버전 가드/후보 선택
  - lazy loading + 학습 저장
  - 화면 결과에 퍼블 검색 힌트 연결

- `src/tools/search-publisher-code.ts`
  - 퍼블 검색 진입점
  - repo sync -> index load/build -> bundle 검색
  - 응답 포맷 구성

- `src/services/publisher.ts`
  - 저장소 하이브리드 동기화(clone/pull + fallback)
  - 퍼블 파일 인덱싱(`publisher-index.json`)
  - component bundle 검색

- `src/services/search.ts`
  - `screen-index.json` 검색/점수화/저장

- `src/services/figma.ts`
  - Figma REST API 연동
  - 노드 파싱/description 추출/fallback 검색

---

## 3) Step2 구현 상세

## 3.1 하이브리드 저장소 동기화

- 기본 repo URL:
  - `git@bitbucket.org:okestrolab/okestro-ui.git`
- 자동 캐시 경로:
  - `~/.oke-front-mcp/publisher/okestro-ui`
- fallback:
  - `PUBLISHER_REPO_PATH`

동작:
1. 자동 경로에 repo 없으면 clone
2. 있으면 pull
3. 실패 시 fallback repo 확인 후 사용

## 3.2 퍼블 인덱스

- 파일: `data/publisher-index.json`
- 포함 확장자:
  - `.vue`, `.ts`, `.js`, `.scss`, `.sass`, `.css`
- 항목:
  - `filePath`, `project`, `fileType`, `componentName`
  - `keywords`, `styleRefs`, `sharedComponentRefs`

## 3.3 bundle 검색

기본 점수:
- componentName 매칭 > filePath 매칭 > keyword 매칭

결과:
- `mainFile`
- `relatedScripts`
- `relatedStyles`
- `sharedComponents`

## 3.4 Figma -> Publisher 핸드오프

- Figma 상세 응답 끝에 `search_publisher_code` 힌트 문자열을 포함
- 예시 질의 템플릿:
  - `{project} {version} {pageTitle} 퍼블 코드 찾아줘`
- 목적:
  - 화면 확인 후 바로 퍼블 후보 검색으로 이동
  - 사용자 입력 비용 최소화

---

## 4) 환경 변수

Figma:
- `FIGMA_TOKEN`
- `FIGMA_TEAM_ID`
- `DEFAULT_PROJECT`
- `DEFAULT_VERSION`
- `SUPPORTED_PROJECTS`

Publisher:
- `PUBLISHER_REPO_URL` (선택)
- `PUBLISHER_REPO_PATH` (fallback 경로)
- `PUBLISHER_CACHE_PATH` (자동 clone 경로 오버라이드)
- `PUBLISHER_INDEX_PATH` (인덱스 파일 경로 오버라이드)

---

## 5) 안정성 포인트

- Figma `Request too large` -> depth 재시도
- Figma 상세 학습 저장 실패 -> `addScreen` fallback
- Publisher auto sync 실패 -> fallback repo 경로 사용
- 인덱스 파일은 JSON으로 유지하여 디버깅 가시성 확보

---

## 6) 검증 체크리스트

- `npm run build` 성공
- `search_figma_spec` 기존 동작 회귀 없음
- `search_publisher_code` schema 노출 확인
- 퍼블 repo sync 성공/실패 fallback 분기 확인
- `publisher-index.json` 생성/갱신 확인

