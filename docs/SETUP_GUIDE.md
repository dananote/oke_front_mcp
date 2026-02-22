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

