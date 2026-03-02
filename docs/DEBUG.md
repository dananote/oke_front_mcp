# DEBUG

운영 중 발생한 주요 이슈와 해결 방법을 기록합니다.

---

## 1) 버전 미지정인데 특정 버전으로 자동 확정

- 증상: 버전 질문 없이 3.0.6 등으로 즉시 확정
- 원인: 기본 버전 주입 + autoConfirm 경로 우선
- 해결: 버전 미명시 시 autoConfirm 제한, 버전 선택 질문 강제

---

## 2) 번호 선택 결과가 의도와 다름

- 증상: `3번` 선택 시 다른 화면 확정
- 원인: 후보 풀 구성/정렬 불안정
- 해결: 후보 풀 유지 + 문장형 숫자 파싱 + 동일 제목군 버전 우선 제시

---

## 3) description 표시는 되는데 인덱스 저장 안 됨

- 증상: 응답은 나오지만 `screen-index.json` 미갱신
- 원인: 저장 호출 누락 또는 경로 불일치
- 해결: `updateScreenDetail` + `addScreen` fallback 통합, 인덱스 경로 안정화

---

## 4) Figma `Request too large`

- 증상: 특정 파일/노드 조회 실패(400)
- 원인: depth 과다
- 해결: depth 축소 재시도

---

## 5) Step2 Publisher: auto clone/pull 실패

- 증상: `search_publisher_code` 호출 시 저장소 동기화 실패
- 원인:
  - SSH 권한 부재
  - 네트워크/권한 이슈
  - repo URL 오입력
- 해결:
  - `PUBLISHER_REPO_PATH` fallback 사용
  - SSH 키/권한 확인
  - `PUBLISHER_REPO_URL` 재검증

---

## 6) Cursor가 search_figma_spec을 인식하지 못하고 CallTool을 안 보냄

- 증상: "기획 찾아줘" 요청 시 로그에 ListTools/ListResources만 있고 CallTool(search_figma_spec)이 없음. 또는 Cursor 답변에서 "oke-front-mcp에는 search_figma_spec 도구가 없다"고 함.
- 원인(추정): Cursor가 도구 목록을 **mcps 폴더 디스크립터**로만 참고하는 경우, 해당 폴더에 search_publisher_code.json만 있고 search_figma_spec.json이 없을 수 있음.
- 해결: **도구 정의 단일 소스**는 `src/mcp-tools-schema.ts`. `npm run build` 시 `mcp-descriptors/*.json`이 자동 생성되므로, 해당 파일들을 Cursor mcps 폴더(`~/.cursor/projects/<project>/mcps/user-oke-front-mcp/tools/`)에 복사. 자세한 절차는 `docs/SETUP_GUIDE.md` "3.1) MCP 도구 디스크립터 동기화" 참고.

---

## 7) Step2 Publisher: 검색 결과가 비어 있음

- 증상: 번들 검색 결과 0건
- 원인:
  - query가 너무 포괄적
  - 프로젝트 범위 불일치
  - 인덱스가 오래됨
- 해결:
  - query 구체화(화면/기능명)
  - 프로젝트 힌트 포함
  - `refreshIndex=true`로 인덱스 재생성

---

## MCP 요청 로그로 Cursor 호출 과정 확인

Cursor가 **어떤 method(tools/list, tools/call, resources/list, resources/read)** 로, **어떤 인자**로 우리 MCP를 호출하는지** 실행 과정을 한 줄씩 보고 싶을 때** 아래 로그를 사용합니다.

### 로그에 찍히는 내용

- **ListToolsRequestSchema (tools/list)** — Cursor가 도구 목록을 요청했을 때
- **CallToolRequestSchema (tools/call)** — Cursor가 도구 실행을 요청했을 때
  - `name`: 선택된 도구 (`search_figma_spec` / `search_publisher_code`)
  - `arguments`: Cursor가 채워서 보낸 인자 (query, project, version 등)
- **ListResourcesRequestSchema (resources/list)** — Cursor가 리소스 목록 요청
- **ReadResourceRequestSchema (resources/read)** — Cursor가 특정 URI 내용 요청
  - `uri`: 예) `figma://screens`, `figma://stats`

### 로그가 나가는 곳

- **항상:** `stderr` (표준 에러). MCP 프로토콜은 stdout을 쓰므로 로그는 stderr로만 출력합니다.
- **선택:** 환경 변수 `MCP_DEBUG_LOG`를 설정하면 **파일**에도 같은 내용이 추가됩니다.

### 실시간으로 로그 확인하는 방법

#### 방법 1: Cursor Output 패널에서 보기 (stderr)

1. Cursor에서 **View → Output** (또는 `Cmd+Shift+U` / `Ctrl+Shift+U`) 로 Output 패널을 연다.
2. 오른쪽 드롭다운에서 **"MCP"** 또는 **"oke-front-mcp"** 등 MCP 서버 관련 채널을 선택한다.
3. 다른 프로젝트에서 oke-front-mcp를 사용하는 채팅을 열고 질문을 입력한다.
4. Output 패널에 위에서 설명한 형식의 로그가 실시간으로 찍힌다.  
   (채널 이름은 Cursor 버전에 따라 다를 수 있음. "Extension Host", "MCP", "Log" 등을 순서대로 확인해 보면 된다.)

#### 방법 2: 파일 로그로 실시간 보기 (권장)

Cursor가 MCP 서버를 띄울 때 **같은 환경 변수**를 넘기면, 서버가 로그를 파일에도 쓴다. 그 파일을 터미널에서 `tail -f`로 보면 Cursor에서 질문할 때마다 로그가 실시간으로 쌓인다.

1. **MCP 서버에 환경 변수 넘기기**  
   `~/.cursor/mcp.json`에서 oke-front-mcp 서버 설정의 **`env`** 에 다음을 추가한다.

   ```json
   "env": {
     "MCP_DEBUG_LOG": "1",
     ...
   }
   ```

   - `"1"` 이면 기본 경로 `~/.oke-front-mcp/mcp-request.log` 에 쓴다.
   - 다른 경로를 쓰려면 `"MCP_DEBUG_LOG": "/원하는/경로/mcp-request.log"` 처럼 절대 경로를 준다.

2. **Cursor 재시작** (MCP 설정 변경 반영).

3. **터미널에서 실시간 확인**
   ```bash
   tail -f ~/.oke-front-mcp/mcp-request.log
   ```
4. Cursor 채팅에서 oke-front-mcp로 질문(예: "볼륨 생성 기획 보여줘", "퍼블 코드 찾아줘")을 입력하면, 위 터미널에 요청이 들어온 순서대로 로그가 찍힌다.

#### 방법 3: 터미널에서 MCP 서버만 직접 실행

서버를 Cursor가 아닌 **직접 터미널에서** 띄우면, 그 터미널에 stderr가 그대로 출력된다. (이때는 Cursor와는 연결되지 않으므로, “실제 Cursor 호출”을 보려면 방법 1 또는 2가 맞다.)

```bash
cd /path/to/oke-front-mcp
node dist/index.js
# 또는 MCP_DEBUG_LOG 파일 로그까지 쓰려면:
MCP_DEBUG_LOG=1 node dist/index.js
```

- 이렇게 띄운 프로세스에는 Cursor가 요청을 보내지 않으므로, **Cursor에서 질문했을 때의 호출 순서**를 보려면 **방법 1(Output)** 또는 **방법 2(파일 + tail -f)** 를 쓰는 것이 좋다.

### 테스트 시나리오 예시

1. **방법 2**로 `tail -f ~/.oke-front-mcp/mcp-request.log` 를 켜 둔 뒤,
2. Cursor에서 **새 채팅**을 열고
   - "oke-front-mcp로 볼륨 생성 기획 보여줘"  
     처럼 질문한다.
3. 로그에서 예상되는 순서:
   - (연결 직후) `ListToolsRequestSchema (tools/list)` — 도구 목록 요청
   - (필요 시) `ListResourcesRequestSchema (resources/list)` — 리소스 목록 요청
   - `CallToolRequestSchema (tools/call)` — `name: "search_figma_spec"`, `arguments: { query: "볼륨 생성 기획 보여줘", ... }`
4. "퍼블 코드 찾아줘"로 질문하면
   - `CallToolRequestSchema (tools/call)` — `name: "search_publisher_code"`, `arguments: { query: "..." }`  
     가 찍히는지 확인하면, Cursor가 질문에 따라 어떤 도구를 골라 호출하는지 검증할 수 있다.

---

## 공통 점검 체크리스트

1. `npm run build` 최신 상태인가
2. Cursor를 재시작했는가
3. Figma/Publisher 환경변수가 설정되었는가
4. 인덱스 파일(`screen-index.json`, `publisher-index.json`)이 갱신되는가
5. fallback 경로(`PUBLISHER_REPO_PATH`)가 실제 repo인가
