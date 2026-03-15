# SETUP GUIDE

## 1) 사전 준비

- Node.js 18+
- Cursor IDE
- Figma Token / Team ID
- Bitbucket SSH 권한(Publisher 사용 시)

### Publisher SSH 체크(필수)

```bash
ssh -T git@bitbucket.org
```

- 성공 메시지가 나오면 SSH 인증 준비 완료
- 실패 시:
  - `~/.ssh/id_ed25519` 키 생성 후 공개키를 Bitbucket 계정에 등록
  - SSH Agent에 키 등록(`ssh-add`)
  - 다시 `ssh -T git@bitbucket.org` 실행

## 2) 설치

```bash
cd ~/Desktop
git clone <repo-url>
cd oke-front-mcp
npm install
npm run build
```

## 3) Cursor MCP 설정

파일: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "oke-front-mcp": {
      "command": "node",
      "args": ["/Users/<username>/Desktop/oke-front-mcp/dist/index.js"],
      "env": {
        "FIGMA_TOKEN": "<token>",
        "FIGMA_TEAM_ID": "<team-id>",
        "DEFAULT_PROJECT": "CONTRABASS",
        "DEFAULT_VERSION": "3.0.6",
        "SUPPORTED_PROJECTS": "CONTRABASS,SDS+,VIOLA,Boot Factory",
        "PUBLISHER_REPO_URL": "git@bitbucket.org:okestrolab/okestro-ui.git",
        "PUBLISHER_REPO_PATH": "/Users/<username>/work/okestro-ui",
        "PUBLISHER_CACHE_PATH": "/Users/<username>/.oke-front-mcp/publisher/okestro-ui",
        "MCP_LOG_PATH": "/Users/<username>/.oke-front-mcp/mcp-debug.log"
      }
    }
  }
}
```

## 4) 도구 디스크립터 동기화

- 단일 소스: `src/mcp-tools-schema.ts`
- 생성:
  - `npm run build` 또는 `npm run sync-mcp-descriptors`
  - 생성 파일: `mcp-descriptors/search_figma_spec.json`, `mcp-descriptors/search_publisher_code.json`

### MCP를 Cursor / mcp-qa-app에 바로 동기화

**동기화 대상**: Cursor는 워크스페이스마다 다른 mcps 폴더를 씁니다. “MCP에 질문하는 쪽”은 지금 연 워크스페이스(mcp-qa-app)이므로, 동기화는 **그 워크스페이스의 Cursor 프로젝트 경로**로 가야 합니다.  
기본값을 **mcp-qa-app** 프로젝트 경로로 두었기 때문에, **oke-front-mcp**에서 `build:dev`를 실행해도 **mcp-qa-app**을 연 창에서 MCP 질의 시 최신 도구가 적용됩니다.

```bash
# oke-front-mcp 저장소에서 실행
cd /Users/taeheerho/Desktop/oke-front-mcp

# 디스크립터만 생성 후 mcp-qa-app 쪽 Cursor tools로 복사
npm run sync:cursor
```

- 기본 복사 경로: `~/.cursor/projects/Users-taeheerho-Desktop-mcp-qa-app/mcps/user-oke-front-mcp/tools/` (mcp-qa-app 워크스페이스)
- oke-front-mcp 워크스페이스로 동기화하려면: `CURSOR_MCP_PROJECT_ID=Users-taeheerho-Desktop-oke-front-mcp npm run sync:cursor`
- 경로 직접 지정: `CURSOR_MCP_TOOLS_DIR=/원하는/경로 npm run sync:cursor`

**코드까지 반영한 뒤 한 번에 동기화** (빌드 + 디스크립터 생성 + mcp-qa-app 쪽 복사):

```bash
cd /Users/taeheerho/Desktop/oke-front-mcp
npm run build:dev
```

- MCP 서버 코드를 수정했다면 `build:dev` 실행 후, **mcp-qa-app**을 연 Cursor 창에서 MCP 재연결(또는 창 새로고침)하면 해당 창에서 바로 최신 MCP로 테스트할 수 있습니다.

**언제 동기화가 필요한가?**

- **로직만 변경한 경우** (도구 이름·파라미터·설명은 그대로): `npm run build`로 `dist/`만 갱신한 뒤, 다른 워크스페이스에서 Cursor를 재시작(또는 MCP 재연결)하면 **자동으로** 새 코드가 적용됩니다. Cursor가 `mcp.json`에 적힌 `dist/index.js`를 매번 새로 실행하기 때문에, 별도 동기화 없이 재시작만 하면 됩니다.
- **도구 스키마를 변경한 경우** (이름·파라미터·설명 변경): 해당 워크스페이스의 mcps 폴더에 있는 도구 정의 JSON도 갱신해야 하므로 `npm run sync:cursor` 또는 `npm run build:dev`가 필요합니다.

수동 복사가 필요할 때:

```bash
cp mcp-descriptors/*.json ~/.cursor/projects/<project-id>/mcps/user-oke-front-mcp/tools/
```

## 5) 실시간 로그 확인

- 단일 통합 로그 파일:
  - `~/.oke-front-mcp/mcp-debug.log`
- 실시간 확인:

```bash
tail -f ~/.oke-front-mcp/mcp-debug.log
```

```bash
tail -f ~/.oke-front-mcp/mcp-debug.log | rg "mcp도구실행|figma기획확인|publisher코드확인"
```

- 주요 태그 예시:
  - `[mcp요청확인]` MCP 요청 수신
  - `[mcp도구실행]` Tool 시작/성공/실패
  - `[figma기획확인]` 기획 검색 전략/결과/학습
  - `[publisher코드확인]` 퍼블 검색/동기화/결과

## 6) 운영 팁

- 코드 변경 후: `npm run build`
- Figma 인덱스 갱신: `npm run collect-metadata`
- Publisher 재인덱싱: tool 호출 시 `refreshIndex=true`
- Publisher 구조 요약 생성: `npm run build:publisher-taxonomy`
- 개발요청형 퍼블 질의:
  - `query`: 예) "호스트 생성페이지를 개발해줘"
  - `targetSummary`(선택): 예) "contrabass 인스턴스 > 호스트 생성"
  - `currentCodeHint`(선택): 현재 코드 차이/문제 요약
  - 참고 규칙:
    - 동의어 확장 규칙: `data/publisher-synonyms.json` (네트워크/인스턴스/보안그룹/스토리지/파이프라인/모달 등)
    - 구조 요약: `data/publisher-taxonomy.json`

## 7) Step1~3 QA 실행

- QA 앱 경로: `/Users/taeheerho/Desktop/mcp-qa-app`
- QA 앱 실행:

```bash
cd /Users/taeheerho/Desktop/mcp-qa-app
npm run dev
```

- MCP 자동 QA 실행:

```bash
cd /Users/taeheerho/Desktop/oke-front-mcp
npm run qa:step1-3
```

- QA 결과 파일:
  - `data/qa-step1-3-report.json`
  - `data/qa-step1-3-log-tail.log`
