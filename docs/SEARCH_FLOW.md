# SEARCH FLOW

`oke-front-mcp`는 Tool 실행과 Resource 조회를 분리해 동작합니다.

## 1) Tool / Resource 요청 흐름

```text
Cursor
  -> tools/list, resources/list
    -> tools/call(name, arguments) 또는 resources/read(uri)
      -> MCP handler 라우팅
        -> 결과 반환
```

- Tool 선택은 Cursor가 `name/description/inputSchema`와 사용자 질의를 보고 결정합니다.
- 서버는 전달된 `name`에 따라 해당 Tool만 실행합니다.

## 2) 기획 조회 플로우 (`search_figma_spec`)

```text
query
  -> parse(screenId/project/version/keywords)
    -> metadata 검색
      -> 필요 시 Figma API fallback
        -> 상세 보강(description) + 인덱스 학습 저장
          -> 결과 반환
```

- 기획 관련 질의는 이 Tool을 우선 사용합니다.
- 버전 미지정 시 후보 목록을 반환해 오탐 확정을 줄입니다.

## 3) 퍼블 조회 플로우 (`search_publisher_code`)

```text
query
  -> 의도 파싱(build_page/diff_fix/general)
    -> 동의어 규칙 적용(data/publisher-synonyms.json)
      -> query 확장 + 메뉴 힌트 추론
        -> 다중 검색 프로파일 순차 시도
      -> ensureRepo(SSH 우선 sync + syncIssues)
        -> index build/load(solution/menuPath/entity/pageType/isModal 메타)
          -> bundle search(primary + related_modal + shared)
            -> LLM 적용 컨텍스트(merge 규칙/근거) 반환
```

- `git pull` 실패 시 가능한 경우 기존 캐시 커밋 + 인덱스로 degraded 검색을 계속합니다.
- 저장소 접근 자체가 실패해도 캐시 인덱스가 있으면 조회를 시도합니다.
- 코드 자동 반영은 수행하지 않으며, 반환된 적용 컨텍스트를 기반으로 LLM이 현재 프로젝트 규칙에 맞게 반영합니다.
- `publisher-taxonomy.json`은 퍼블 구조 요약을 제공해 메뉴/엔티티 기반 탐색 튜닝에 사용합니다.

## 4) Resource 조회 플로우

- `figma://screens`: 실제 화면 목록(JSON)
  - 필드: `project`, `version`, `screenId`, `pageTitle`, `fileKey`, `nodeId`, `lastModified`
- `figma://stats`: 인덱스 통계(JSON)
  - 필드: `totalScreens`, `projects`, `lastUpdated`

## 5) 실시간 추적

- 모든 Tool 호출/전략 로그를 단일 태그 로그로 기록합니다.
- 기본 경로: `~/.oke-front-mcp/mcp-debug.log`
- 확인 명령:
  - `tail -f ~/.oke-front-mcp/mcp-debug.log`
- 주요 태그:
  - `[mcp요청확인]`, `[mcp도구실행]`, `[figma기획확인]`, `[publisher코드확인]`
