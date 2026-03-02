# DEVELOPMENT

Step 1(Figma)와 Step 2(Publisher) 기준으로 현재 코드 구조와 핵심 설계를 정리합니다.

---

## 0) MCP 서버 기동 및 핸들러 실행 시점

다른 프로젝트에서 oke-front-mcp를 사용하면 Cursor가 `node dist/index.js` 같은 식으로 프로세스를 띄웁니다.

**기동 순서**

1. **모듈 로드**  
   `dotenv.config()`로 `.env` 로드.

2. **`main()`**
   - 환경 변수 검증: `FIGMA_TOKEN`, `FIGMA_TEAM_ID` 없으면 `process.exit(1)`.
   - `new OkeFrontMCPServer()` → 생성자에서 `setupHandlers()`, `setupErrorHandling()` 호출.
   - `server.start()` → `StdioServerTransport`로 연결, stdio로 MCP 프로토콜 대기.

3. **`setupHandlers()`**  
   **핸들러 등록만** 함(콜백을 서버에 붙여 둠). 이 시점에는 사용자 요청이 없음.

4. **`setRequestHandler` 4회**
   - 즉, 이런 요청이 오면 이런 콜백을 실행해달라고 콜백을 등록만 해둔것
   - `ListToolsRequestSchema`: Cursor가 “쓸 수 있는 도구 목록”을 물을 때 실행.
   - `CallToolRequestSchema`: 사용자 질의에 따라 Cursor가 특정 도구를 **호출**할 때 실행.
   - `ListResourcesRequestSchema`: Cursor가 “쓸 수 있는 리소스 목록”을 물을 때 실행.
   - `ReadResourceRequestSchema`: Cursor가 특정 리소스(예: `figma://screens`) **내용**을 읽을 때 실행.

**유저 플로우에서의 실행 시점**

| 단계             | Cursor/클라이언트 동작         | 실행되는 핸들러                           |
| ---------------- | ------------------------------ | ----------------------------------------- |
| MCP 연결 직후    | “이 서버가 뭘 할 수 있어?”     | ListTools, ListResources (목록 조회)      |
| 사용자 질의 입력 | “기획 찾아줘” 등               | (Cursor가 도구 호출 결정 시) **CallTool** |
| 리소스 참조 시   | @ 리소스 또는 리소스 읽기 요청 | **ReadResource**                          |

즉, **등록은 서버 기동 시 1회**, **실제 핸들러 실행은 Cursor가 해당 타입의 요청을 보낼 때마다** 발생합니다.

---

## 0.1) Tools vs Resources 개념 및 Cursor 요청 흐름

### Tools와 Resources의 역할

| 구분 | 목적 | 비유 |
|------|------|------|
| **Tools** | **실행** — 우리가 정의한 로직(검색, 계산 등)을 한 번 실행하고 결과를 반환 | 함수 호출: 인자를 넘기면 한 번 실행 후 결과 반환 |
| **Resources** | **자원(데이터) 획득** — 특정 URI로 정해 둔 내용(목록, 통계 등)을 읽기 | 문서/데이터 조회: URI를 요청하면 그에 해당하는 내용 반환 |

- **Tool**: 매번 **질의·인자**를 넘기고, 그에 맞는 **액션 결과**를 받는 구조.
- **Resource**: **고정된 URI**를 두고, "이 URI의 **현재 내용**을 달라"고 요청하는 구조. 우리 서버가 그 URI에 대해 어떤 데이터를 돌려줄지 정의한다.

### Cursor가 우리 MCP에 요청하는 방식

1. Cursor는 연결 직후(또는 필요 시) **목록 요청**을 보낸다.
   - **도구 목록이 필요할 때** → `tools/list` (ListToolsRequestSchema)
   - **리소스 목록이 필요할 때** → `resources/list` (ListResourcesRequestSchema)
2. 우리 MCP는 각각 **등록해 둔 도구/리소스 목록**을 응답한다.
3. Cursor는 사용자 입력과 컨텍스트를 보고 **스스로 판단**하여, 필요할 때 다음 요청을 보낸다.
   - **도구를 실행하고 싶을 때** → `tools/call` (CallToolRequestSchema) — 도구 이름 + 인자
   - **리소스 내용을 읽고 싶을 때** → `resources/read` (ReadResourceRequestSchema) — URI

즉, **목록을 받은 뒤 Cursor가 "지금 뭐가 필요한가"에 따라 위 method로 우리 서버에 요청**하고, 우리는 해당 요청 타입에 맞는 핸들러만 실행하면 된다. 어떤 핸들러를 실행할지는 **요청 메시지의 method**로 구분되며, MCP SDK가 자동으로 라우팅한다.

### 예시: 사용자 질의 한 번에 대한 흐름

**사용자:** "볼륨 생성 페이지 기획 보여줘"

1. Cursor는 이미 `tools/list`로 `search_figma_spec`, `search_publisher_code` 목록을 받아 둔 상태.
2. Cursor가 의도를 분석해 "기획 조회"에 맞는 도구로 **search_figma_spec**을 선택.
3. Cursor → 우리 MCP에 **`tools/call`** 요청  
   - `name: "search_figma_spec"`, `arguments: { query: "볼륨 생성 페이지 기획 보여줘", ... }`
4. 우리 서버의 **CallToolRequestSchema** 핸들러만 실행 → `searchFigmaSpecTool(...)` 호출 → 기획 검색 로직 수행 후 결과 반환.

**사용자 또는 Cursor가 리소스를 참조하는 경우**

1. Cursor는 `resources/list`로 `figma://screens`, `figma://stats` 목록을 받아 둔 상태.
2. "화면 목록 전체를 컨텍스트로 쓰고 싶다"면 Cursor → 우리 MCP에 **`resources/read`** 요청  
   - `uri: "figma://screens"`
3. 우리 서버의 **ReadResourceRequestSchema** 핸들러만 실행 → `getScreenList()` 결과를 JSON으로 반환.

### oke-front-mcp에서의 대응

| Cursor가 원하는 것 | 보내는 요청(method 개념) | 우리가 등록한 핸들러 |
|-------------------|---------------------------|----------------------|
| 도구 목록 | tools/list | ListToolsRequestSchema |
| 도구 실행 | tools/call | CallToolRequestSchema |
| 리소스 목록 | resources/list | ListResourcesRequestSchema |
| 리소스 내용 읽기 | resources/read | ReadResourceRequestSchema |

### CallTool 요청 시 request에 들어가는 것

Cursor가 **tools/call**을 보낼 때, 우리 핸들러(`setRequestHandler(CallToolRequestSchema, ...)`)의 `request`에는 대략 다음이 들어 있습니다.

- **`request.params`**
  - **`name`**: Cursor가 선택한 **도구 이름** (예: `"search_figma_spec"` 또는 `"search_publisher_code"`).
  - **`arguments`**: 해당 도구의 **인자 객체**. Cursor가 우리가 준 `inputSchema`와 사용자 질의를 바탕으로 채워서 보냄.  
    예: `{ query: "볼륨 생성 기획 보여줘", project: "CONTRABASS", version: undefined }`

우리 코드에서는 `const { name, arguments: args } = request.params`로 받아서, `name`으로 switch 분기한 뒤 `args`를 해당 도구 함수에 넘깁니다. **사용자의 원문 메시지**는 request에 따로 오지 않고, Cursor가 이미 “어떤 도구 + 어떤 인자”로 바꾼 상태로 옵니다.

### "Figma vs Publisher vs 둘 다"를 누가·어디서 결정하는가

**결정하는 쪽은 우리 MCP가 아니라 Cursor(클라이언트)입니다.**

- 우리 서버는 **“지금 Figma를 쓸지 Publisher를 쓸지”를 판단하지 않습니다.**
- Cursor가 이미 **“search_figma_spec을 호출한다”** 또는 **“search_publisher_code를 호출한다”**라고 결정한 뒤, **tools/call 한 번**에 **도구 하나**만 name으로 보냅니다.
- 따라서 “Figma만 / Publisher만 / 둘 다”는 **Cursor가 tools/call을 한 번 보낼지, 여러 번 보낼지**로 결정합니다.  
  예: “기획도 보고 퍼블 코드도 봐줘”면 Cursor가 **search_figma_spec** 한 번, **search_publisher_code** 한 번, 이렇게 **두 번** tools/call을 보낼 수 있습니다.

### Cursor가 도구를 고르는 기준(자연어 → 어떤 tool 호출할지)

**판단은 Cursor 내부(AI/모델)에서 이루어지며, 우리 코드에는 그 로직이 없습니다.**

- Cursor는 **tools/list**로 받은 **name, description, inputSchema**와 **사용자 자연어 메시지**를 함께 보고, “이 메시지에는 어떤 도구가 맞는가?”를 **자체 모델**로 추론합니다.
- 즉, **자연어 기준으로 나누는 곳**은 **Cursor 쪽**이고, **우리 프로젝트 어디에도 “기획이면 Figma, 퍼블이면 Publisher” 같은 if문은 없습니다.**  
  우리는 `name`이 `"search_figma_spec"`이면 Figma 로직, `"search_publisher_code"`이면 Publisher 로직을 실행할 뿐입니다.

**우리가 할 수 있는 일:** Cursor가 더 잘 고르도록 **도구 메타데이터**를 명확히 하는 것뿐입니다.

- **name**: 도구를 구분하는 식별자.
- **description**: “기획 찾아줘 / 화면 기획 조회 시 이 도구 사용”, “퍼블 코드 찾아줘 시 사용”처럼 **언제 이 도구를 쓸지** 문장으로 적어 두면, Cursor가 사용자 말과 매칭하기 쉬워집니다.
- **inputSchema.properties.*.description**: 각 인자(query, project 등)가 뭔지 설명해 두면, Cursor가 사용자 말에서 **어떤 값을 query에 넣을지** 추론하는 데 도움이 됩니다.

정리하면, **어떤 도구를 호출할지는 Cursor가 name/description/inputSchema와 사용자 자연어를 보고 결정**하고, **request에는 그 결과인 `name`과 `arguments`만 들어옵니다.** 우리는 그걸 받아서 해당 도구만 실행합니다.

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
  - MCP tool schema 등록 (단일 소스 `mcp-tools-schema.ts` 사용)
  - tool 호출 라우팅
- `src/mcp-tools-schema.ts`
  - 도구 정의 단일 소스 (search_figma_spec, search_publisher_code). ListTools 응답과 `mcp-descriptors/*.json` 동기화에 사용.

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
