# oke-front-mcp

사내 프론트엔드 개발자가 Cursor 채팅에서 자연어로 질의하면, Figma 기획 정보를 빠르게 찾아주고, 조회 결과를 로컬 메타데이터에 학습 저장하는 MCP 서버입니다.

---

## 프로젝트 배경

기존에는 화면 개발을 위해 아래 소스를 각각 열어 확인해야 했습니다.

- Figma 기획서
- 퍼블리셔 산출물/저장소
- 디자인 시스템 문서
- UI 컴포넌트 문서

이 구조는 "정보 탐색 시간"을 크게 만들고, 같은 질문을 반복하게 만듭니다.  
`oke-front-mcp`는 질문 중심 개발 흐름으로 이 문제를 줄이는 것을 목표로 합니다.

---

## 핵심 목표

1. 분산된 개발 자료(Figma, 퍼블 코드, 디자인 정책)의 탐색 비용 감소
2. 자연어로 기획 검색
3. 모호한 질의는 후보/버전 선택으로 안전하게 처리
4. 한 번 찾은 정보는 자동 학습하여 다음 질의 속도 향상
5. 재수집 실패에도 기존 데이터가 보존되는 운영 안정성 확보

---

## 현재 구현 범위 (Step 1: Figma)

현재는 Figma 단계를 중심으로 아래가 구현되어 있습니다.

- 화면 ID 직접 조회(`CONT-XX_YY_ZZ`)
- 자연어 검색(프로젝트/버전/기능 키워드)
- 버전 미지정 시 재질문(자동확정 방지)
- 후보 제시 + 번호 선택(`1`, `2번`, `3 번기획`)
- description lazy loading
- 로컬 미스 시 Figma fallback 검색
- 조회 결과 자동 학습 저장
- 안전 재수집(merge + backup + 원자적 저장)

## Step 2 (Publisher) 1차 구현 완료

- `search_publisher_code` tool 추가
- 하이브리드 저장소 동기화
  - 자동 clone/pull 우선
  - 실패 시 `PUBLISHER_REPO_PATH` fallback
- 퍼블 코드 인덱스(`data/publisher-index.json`) 생성/갱신
- 화면/기능 키워드 기반 component bundle 응답
  - main vue
  - related scripts
  - related styles(sass/scss/css)
  - shared components(`src/components`)

---

## 어떻게 동작하는가

기본 흐름:

1. 질의 파싱(screenId/project/version/keywords)
2. 로컬 인덱스(`data/screen-index.json`) 검색
3. 단건이면 확정, 복수면 후보 제시
4. 상세 정보 필요 시 Figma 조회(lazy loading)
5. 결과를 인덱스에 저장(학습)
6. 로컬 미스면 Figma fallback 후 다시 저장

핵심은 "빠른 로컬 검색 + 누락 시 실시간 보완 + 보완 결과 학습"입니다.

---

## 주요 파일

- `src/index.ts`
  - MCP tool 등록/라우팅
- `src/tools/search-figma-spec.ts`
  - Figma 질의 처리 오케스트레이션
- `src/tools/search-publisher-code.ts`
  - Publisher 질의 처리 및 번들 응답
- `src/services/search.ts`
  - Figma 메타데이터 검색/저장
- `src/services/figma.ts`
  - Figma API 연동
- `src/services/publisher.ts`
  - 퍼블 저장소 동기화/인덱싱/번들 검색

---

## 버전별(Phase) 구현 요약

### Phase 1

- Figma API 연결
- 화면 ID 직접 조회

### Phase 2

- 메타데이터 인덱싱
- 자연어 검색 도입

### Phase 2.5

- 후보 선택 UX 강화
- 버전 재질문 및 번호 선택 안정화

### Phase 3

- fallback 검색 + 자동 학습

### Phase 4

- 경량 수집 + lazy loading
- 저장 경로/재수집 안정성 강화

---

## 기술 스택

- Node.js
- TypeScript
- `@modelcontextprotocol/sdk`
- `axios`
- Node `fs/path` 모듈(로컬 인덱스 운영)

선택 이유:

- MCP 표준 구조를 따르면서, 검색/저장 로직을 타입 안정적으로 유지하기 위해 TypeScript + MCP SDK 조합을 사용했습니다.

---

## 디렉토리/문서 체계

코드:

- `src/index.ts`: MCP 서버 진입점
- `src/tools/search-figma-spec.ts`: 질의 처리 오케스트레이션
- `src/services/search.ts`: 로컬 검색/저장
- `src/services/figma.ts`: Figma API
- `src/scripts/collect-metadata.ts`: 수집 스크립트

문서(고정 5개):

- `docs/SEARCH_FLOW.md`
- `docs/DEVELOPMENT.md`
- `docs/DEBUG.md`
- `docs/PLAN.md`
- `docs/SETUP_GUIDE.md`

---

## 빠른 시작

```bash
npm install
npm run build
npm run collect-metadata
```

Cursor 질의 예시:

```text
@oke-front-mcp 콘트라베이스 3.0.6 볼륨 수정 기획 찾아줘
@oke-front-mcp 리스너 생성 퍼블 코드 찾아줘
```

---

## 현재 상태와 다음 단계

현재:

- Step 1(Figma) 고도화 진행 중
- 검색 정합성/학습 안정성 개선 완료

다음:

- Step 2(Publisher 연동)
- Step 3(Design System/Confluence/컴포넌트 가이드 연동)

# oke-front-mcp
