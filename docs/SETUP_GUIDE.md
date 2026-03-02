# SETUP GUIDE

이 문서는 `oke-front-mcp` 설치와 운영 설정(Figma + Publisher Step2)을 설명합니다.

---

## 1) 사전 준비

- Node.js 18+
- Cursor IDE
- Figma Token
- Bitbucket SSH 접근 권한(Publisher Step2)

---

## 2) 설치

```bash
cd ~/Desktop
git clone <this-repo-url>
cd oke-front-mcp
npm install
npm run build
```

---

## 3) Cursor MCP 설정

파일:
- `~/.cursor/mcp.json`

예시:

```json
{
  "mcpServers": {
    "oke-front-mcp": {
      "command": "node",
      "args": ["/Users/<username>/Desktop/oke-front-mcp/dist/index.js"],
      "env": {
        "FIGMA_TOKEN": "<token>",
        "FIGMA_TEAM_ID": "1498602828936104321",
        "DEFAULT_PROJECT": "CONTRABASS",
        "DEFAULT_VERSION": "3.0.6",
        "SUPPORTED_PROJECTS": "CONTRABASS,SDS+,VIOLA,Boot Factory",
        "PUBLISHER_REPO_URL": "git@bitbucket.org:okestrolab/okestro-ui.git",
        "PUBLISHER_REPO_PATH": "/Users/<username>/work/okestro-ui",
        "PUBLISHER_CACHE_PATH": "/Users/<username>/.oke-front-mcp/publisher/okestro-ui"
      }
    }
  }
}
```

주의:
- `PUBLISHER_REPO_PATH`는 선택값이며, auto clone/pull 실패 시 fallback으로 사용됨
- SSH 권한이 없으면 auto clone이 실패할 수 있음

**MCP 요청 로그(디버깅):** Cursor가 어떤 method로·어떤 인자로 호출하는지 보고 싶다면 `env`에 `"MCP_DEBUG_LOG": "1"`을 추가하면 `~/.oke-front-mcp/mcp-request.log`에 로그가 쌓입니다. 실시간 확인은 터미널에서 `tail -f ~/.oke-front-mcp/mcp-request.log`. 자세한 방법은 `docs/DEBUG.md`의 "MCP 요청 로그로 Cursor 호출 과정 확인" 참고.

---

## 3.1) MCP 도구 디스크립터 동기화 (Cursor가 도구를 하나만 인식할 때)

도구 정의는 **단일 소스** `src/mcp-tools-schema.ts`에서 관리합니다. 서버의 tools/list 응답은 여기서 만들고, Cursor용 디스크립터 파일도 여기서 생성합니다.

- **도구 스키마 수정 시:** `src/mcp-tools-schema.ts`만 수정한 뒤 `npm run build` 실행. **빌드 시마다** `mcp-descriptors/` 가 자동으로 갱신됩니다 (별도 동기화 명령 불필요).
- **동기화 출력:** `mcp-descriptors/search_figma_spec.json`, `search_publisher_code.json`이 생성됩니다.

**Cursor가 search_figma_spec을 못 보고 search_publisher_code만 보일 때:**  
Cursor가 mcps 폴더의 디스크립터만 참고하는 경우, 우리가 생성한 디스크립터를 Cursor mcps 폴더에 복사합니다.

```bash
npm run sync-mcp-descriptors
cp mcp-descriptors/*.json ~/.cursor/projects/<프로젝트ID>/mcps/user-oke-front-mcp/tools/
```

프로젝트ID는 Cursor에서 해당 워크스페이스를 열었을 때의 경로 기반 폴더명입니다 (예: `Users-taeheerho-Desktop-oke-front-mcp`). 복사 후 Cursor를 재시작하거나 MCP를 다시 연결해 보세요.

---

## 4) 초기 데이터 준비

### 4.1 Figma 인덱스

```bash
npm run collect-metadata
```

### 4.2 Publisher 인덱스

별도 명령은 없고, 첫 `search_publisher_code` 호출 시 자동 생성됩니다.

생성 파일:
- `data/publisher-index.json`

---

## 5) 사용 예시

### Figma

```text
@oke-front-mcp 콘트라베이스 3.0.6 볼륨 수정 기획 찾아줘
```

### Publisher

```text
@oke-front-mcp 리스너 생성 퍼블 코드 찾아줘
```

### 기획/퍼블 “결과만 보고 싶을 때” 주의사항

- **결과만 보려면:** 채팅에서 **@oke-front-mcp** 를 붙이고 "볼륨 생성 기획 보여줘"처럼 요청하면 됩니다. 이때 **oke-front-mcp 프로젝트 폴더(@/경로/oke-front-mcp/)를 컨텍스트에 넣지 마세요.**
- **프로젝트 폴더를 넣으면:** AI가 이 저장소 코드를 “수정해야 할 대상”으로 인식해, MCP 도구를 호출해 주는 대신 **코드를 고치거나 스크립트를 새로 만드는** 동작을 할 수 있습니다 (예: `run-figma-search.ts` 생성).
- **정리:** 기획/퍼블 조회만 할 때는 **@oke-front-mcp (MCP 서버 참조)** 만 쓰고, **@/.../oke-front-mcp/ (프로젝트 경로)** 는 붙이지 않는 것이 좋습니다. 코드 수정이 목적일 때만 프로젝트 폴더를 컨텍스트에 넣으세요.

---

## 6) 운영 가이드

- 코드 변경 시: `npm run build` 후 Cursor 재시작
- Figma 기획 대량 변경 시: `npm run collect-metadata`
- 퍼블 repo 변경 반영:
  - tool 호출 시 자동 pull 시도
  - 필요 시 `refreshIndex=true`로 인덱스 재생성

---

## 7) 트러블슈팅

### clone/pull 실패

확인:
- SSH 키 등록 여부
- Bitbucket 접근 권한
- `PUBLISHER_REPO_PATH` fallback 존재 여부

### publisher 검색 결과 없음

확인:
- query를 화면명/기능명으로 더 구체화
- 프로젝트명을 함께 입력(`콘트라베이스`, `비올라`)
- `refreshIndex=true`로 재시도

### MCP tool 미노출

확인:
- `npm run build` 최신 여부
- Cursor 재시작
- `mcp.json` 경로/args 확인

