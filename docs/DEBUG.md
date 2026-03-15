# DEBUG

운영 중 자주 발생하는 이슈와 점검 절차를 정리합니다.

## 1) 기획 조회 요청인데 Figma Tool이 호출되지 않음

- 증상: "기획 가져와" 요청에서 `search_figma_spec` 호출이 보이지 않음
- 점검:
  - `tools/list` 응답에 `search_figma_spec`가 포함되는지 확인
  - `mcp-descriptors/search_figma_spec.json` 존재 여부 확인
  - Cursor mcps tools 폴더 동기화 상태 확인
- 조치:
  - `npm run build` 실행
  - 필요 시 `npm run sync-mcp-descriptors` 후 tools 폴더 복사

## 2) Publisher 검색에서 git pull 실패

- 증상: auto repo 동기화 실패
- 현재 동작:
  - 기존 auto repo 커밋이 있으면 degraded 모드로 검색 지속
  - fallback/cached index가 있으면 조회 지속
- 점검:
  - SSH 권한/네트워크
  - `PUBLISHER_REPO_URL`, `PUBLISHER_REPO_PATH`
  - 캐시 인덱스(`data/publisher-index.json`) 존재 여부
- 추가 확인:
  - 응답의 `sync issues` 코드 확인 (`ssh_auth`, `network`, `repo_url`, `permission`, `path`, `policy`)
  - 각 issue별 조치 가이드에 따라 즉시 수정

## 3) Publisher 검색 결과가 0건

- 점검:
  - 질의를 기능명/메뉴명까지 구체화
  - `targetSummary`에 솔루션/메뉴 정보를 같이 전달
  - `currentCodeHint`로 현재 코드 차이 힌트 제공(차이 수정 요청 시)
  - `refreshIndex=true`로 재시도
  - 약어/한글 키워드(`LB`, `로드밸런서`)가 확장되었는지 로그에서 확인
  - 로그의 `시도한 검색 프로파일` 항목으로 어떤 질의 변형까지 시도했는지 확인
  - 로그의 `synonym rules` 항목으로 어떤 동의어 규칙이 발동했는지 확인
  - `publisher-synonyms.json`에 해당 도메인 규칙(메뉴/행위/엔티티)이 존재하는지 확인 후 필요 시 규칙 추가

## 4) 실시간 호출 추적

- 통합 로그: `~/.oke-front-mcp/mcp-debug.log`
- 확인:
  - `tail -f ~/.oke-front-mcp/mcp-debug.log`
- 태그:
  - `[mcp요청확인]`
  - `[mcp도구실행]`
  - `[figma기획확인]`
  - `[publisher코드확인]`

## 5) 로그에 민감정보 노출 우려

- 마스킹 대상 키: `token`, `authorization`, `secret`, `password`, `key`
- 점검 명령:
  - `rg "FIGMA_TOKEN|X-Figma-Token|authorization|secret|password" ~/.oke-front-mcp/mcp-*.log`

## 6) Step1~3 QA 자동 실행 결과 (2026-03-15)

- 실행 명령: `npm run qa:step1-3`
- 결과 파일:
  - `data/qa-step1-3-report.json`
  - `data/qa-step1-3-log-tail.log`
- 확인된 사항:
  - `search_figma_spec`, `search_publisher_code` 모두 `tools/call`로 실행됨
  - Figma: 자연어/ID/번호선택 시나리오 정상 응답
  - Publisher: 기본 질의/`LB` 질의/개발요청형 질의/차이수정형 질의 정상 응답
  - Publisher degraded: 동기화 실패 유도 시 캐시 인덱스로 결과 반환
  - 로그 태그(`mcp요청확인`, `mcp도구실행`, `figma기획확인`, `publisher코드확인`) 모두 출력
  - 마스킹: `apiKey` 인자 `***` 처리 확인

## 7) Publisher 구조 매핑 점검

- 명령:
  - `npm run build:publisher-taxonomy`
- 결과 파일:
  - `data/publisher-taxonomy.json`
- 확인 포인트:
  - `summary.bySolution/byMenuPath/byEntity/byPageType`
  - `samples.modalFiles`
  - 특정 요청이 실패하면 taxonomy에 해당 메뉴/엔티티가 존재하는지 먼저 확인
