# SEARCH FLOW

`oke-front-mcp`는 아래 두 검색 흐름을 제공합니다.

- `search_figma_spec`: 기획(화면) 검색
- `search_publisher_code`: 퍼블 코드 번들 검색

---

## 1) Figma 검색 흐름

```text
query
  -> parse(screenId/project/version/selectionIndex/keywords)
    -> strategy 선택
      -> 결과 0/1/N 처리
        -> lazy loading(필요 시 description 보강)
          -> 학습 저장(update -> add fallback)
```

### 1.1 전략 선택 규칙

1. `screenId` 포함: ID 직접 검색
2. `project + version` 포함: 범위 제한 검색
3. `project`만 포함: 프로젝트 내 전버전 검색
4. 둘 다 미포함: 전체 그룹 검색

### 1.2 핵심 정책

- 버전 미명시 시 자동확정 제한
- 다중 버전은 후보 제시 후 선택
- 번호 선택 입력 지원(`1`, `2번`, `3 번기획`)
- 인덱스 미스 시 Figma fallback 검색

---

## 2) Publisher 검색 흐름

```text
query
  -> ensureRepo(hybrid sync)
    -> buildOrLoad publisher index
      -> bundle search(main/script/style/shared)
        -> 후보 목록 반환
          -> 번호 선택 시 상세 스니펫 반환
```

### 2.1 하이브리드 동기화

1. 자동 경로에 repo 없으면 clone
2. 있으면 pull
3. 자동 실패 시 `PUBLISHER_REPO_PATH` fallback

### 2.2 인덱스 규칙

- 인덱스 파일: `data/publisher-index.json`
- 파일 범위: `src/**/*.vue|ts|js|scss|sass|css`
- 프로젝트 식별:
  - `src/publishing-contrbass` -> `CONTRABASS`
  - `src/publishing-viola` -> `VIOLA`
  - `src/components` -> `shared`

### 2.3 Component Bundle 규칙

- 1차 응답: 후보 목록(요약)
  - main vue
  - related scripts
  - related styles
  - shared components
- 2차 응답: 번호 선택 상세
  - main/related 파일 스니펫
  - 후속 복사/수정 가이드

---

## 3) Figma -> Publisher 핸드오프

Figma 상세 응답 하단에 퍼블 검색으로 넘어갈 수 있는 힌트를 제공합니다.

예시:

```text
🔗 연관 퍼블 코드 검색 힌트:
   search_publisher_code query="CONTRABASS 3.0.6 볼륨_수정 퍼블 코드 찾아줘"
```

의도:

- 기획 확인 후 곧바로 퍼블 코드 탐색
- 사용자 입력 비용 최소화

---

## 4) 사용자 시나리오

### 시나리오 A: 버전 모호(Figma)

```text
@oke-front-mcp 볼륨 수정 기획 찾아줘
```

- 버전 후보 목록 반환
- 번호 선택 후 화면 확정

### 시나리오 B: 명시 질의(Figma)

```text
@oke-front-mcp 콘트라베이스 3.0.6 볼륨 수정 기획
```

- 범위 제한 검색 후 상세 반환

### 시나리오 C: 퍼블 코드 조회(Publisher)

```text
@oke-front-mcp 리스너 생성 퍼블 코드 찾아줘
```

- 번들 후보 목록 반환
- 예: `2번` 입력 시 해당 후보 상세 스니펫 반환

---

## 5) 장애 시 분기

### Figma

- 인덱스 0건 -> Figma API fallback
- fallback 성공 시 인덱스 자동 학습 저장

### Publisher

- auto clone/pull 실패 -> fallback 경로 시도
- fallback도 실패하면 SSH/경로/권한 가이드 반환

---

## 6) 관련 코드

- `src/tools/search-figma-spec.ts`
- `src/tools/search-publisher-code.ts`
- `src/services/search.ts`
- `src/services/figma.ts`
- `src/services/publisher.ts`

# SEARCH FLOW

현재 `oke-front-mcp`는 두 검색 흐름으로 동작합니다.

- `search_figma_spec`: 기획(화면) 검색
- `search_publisher_code`: 퍼블 코드 번들 검색

---

## 1) Figma 검색 흐름

```text
query
  -> parse(screenId/project/version/selection/keywords)
    -> strategy 선택
      -> 결과 0/1/N 처리
        -> 필요 시 lazy loading
          -> 학습 저장(update -> add fallback)
```

### 전략 선택

1. `screenId` 포함: ID 직접 검색
2. `project + version` 포함: 범위 제한 검색
3. `project`만 포함: 프로젝트 내 전버전 검색
4. 둘 다 미포함: 전체 그룹 검색

### 핵심 정책

- 버전 미명시 시 자동확정 제한
- 다중 버전은 후보 제시 후 번호 선택
- 번호 입력(`1`, `2번`, `3 번기획`) 지원
- 인덱스 미스 시 Figma fallback 검색

---

## 2) Publisher 검색 흐름

```text
query
  -> ensureRepo(hybrid sync)
    -> buildOrLoad publisher index
      -> bundle search(main/script/style/shared)
        -> 결과 반환
```

### 하이브리드 동기화

1. 자동 경로에 repo 없으면 clone
2. 있으면 pull
3. 실패 시 `PUBLISHER_REPO_PATH` fallback

### 인덱스

- 파일: `data/publisher-index.json`
- 범위: `src/**/*.vue|ts|js|scss|sass|css`
- 프로젝트 식별:
  - `publishing-contrbass` -> `CONTRABASS`
  - `publishing-viola` -> `VIOLA`
  - `src/components` -> `shared`

---

## 3) Figma -> Publisher 연결

Figma 상세 결과를 반환할 때, 퍼블 검색으로 바로 이어질 수 있도록 힌트를 함께 제공합니다.

예시:

```text
🔗 연관 퍼블 코드 검색 힌트:
   search_publisher_code query="CONTRABASS 3.0.6 볼륨_수정 퍼블 코드 찾아줘"
```

의도:

- 사용자가 다시 검색어를 고민하지 않고 다음 단계로 이동
- 기획 확인 -> 퍼블 코드 복사/수정 흐름 단축

---

## 4) 사용자 시나리오

### 시나리오 A: 버전 모호

```text
@oke-front-mcp 볼륨 수정 기획 찾아줘
```

- 결과: 버전 후보 목록 제시
- 사용자가 번호 선택 후 확정

### 시나리오 B: 명시 질의

```text
@oke-front-mcp 콘트라베이스 3.0.6 볼륨 수정 기획
```

- 결과: 범위 제한 검색 후 상세 반환

### 시나리오 C: 퍼블 코드 조회

```text
@oke-front-mcp 리스너 생성 퍼블 코드 찾아줘
```

- 결과: main/related/shared bundle 반환

---

## 5) 장애 시 분기

### Figma

- 인덱스 0건 -> Figma API fallback
- 탐색 성공 시 인덱스 자동 저장

### Publisher

- auto clone/pull 실패 -> fallback 경로 시도
- fallback도 실패하면 권한/SSH/경로 가이드 반환

---

## 6) 관련 코드

- `src/tools/search-figma-spec.ts`
- `src/tools/search-publisher-code.ts`
- `src/services/search.ts`
- `src/services/figma.ts`
- `src/services/publisher.ts`

# SEARCH FLOW

`oke-front-mcp`의 질의 처리는 현재 2개 tool로 분리되어 있습니다.

- `search_figma_spec`: 기획 검색
- `search_publisher_code`: 퍼블 코드 번들 검색

---

## 1) Figma 검색 플로우

```text
query
  -> parse(screenId/project/version/selectionIndex/keywords)
    -> strategy 선택
      -> 결과 0/1/N 판단
        -> 상세 보강(lazy loading)
          -> 학습 저장(update -> add fallback)
```

### 핵심 규칙

- 버전 미명시 시 자동확정 제한
- 다중 버전은 후보 제시 후 선택
- 번호 선택 입력 지원(`1`, `2번`, `3 번기획`)
- 로컬 미스 시 Figma fallback 검색

---

## 2) Publisher 검색 플로우

```text
query
  -> search_publisher_code
    -> ensureRepo(hybrid sync)
      -> buildOrLoad publisher index
        -> bundle search
          -> main/related/shared 묶음 응답
```

### 2.1 hybrid sync 규칙

1. 자동 경로에 저장소가 없으면 clone
2. 있으면 `git pull --ff-only`
3. 자동 동기화 실패 시 `PUBLISHER_REPO_PATH` fallback

### 2.2 인덱스 규칙

- 인덱스 파일: `data/publisher-index.json`
- 파일 범위: `src/**/*.vue|ts|js|scss|sass|css`
- 프로젝트 식별:
  - `src/publishing-contrbass` -> `CONTRABASS`
  - `src/publishing-viola` -> `VIOLA`
  - `src/components` -> `shared`

### 2.3 bundle 응답 규칙

- main candidate(`.vue`) 중심으로 구성
- 같은 디렉토리의 script/style 연관 파일 포함
- import 분석으로 style/shared component 참조 포함

---

## 3) 사용자 시나리오

### Figma

```text
@oke-front-mcp 볼륨 수정 기획 찾아줘
```

- 버전 모호 시 후보 목록
- 번호 선택 후 화면 확정

### Publisher

```text
@oke-front-mcp 리스너 생성 퍼블 코드 찾아줘
```

- 퍼블 저장소 동기화
- 번들 후보 1~N개 반환
- 각 후보에 main/script/style/shared 정보 제공

---

## 4) 장애 시 fallback

### Figma

- 인덱스 미스 -> Figma API 실시간 탐색
- 탐색 성공 시 인덱스 학습 저장

### Publisher

- 자동 clone/pull 실패 -> fallback 경로 시도
- fallback도 실패하면 원인(SSH/경로/권한) 가이드 반환

---

## 5) 관련 코드

- `src/tools/search-figma-spec.ts`
- `src/tools/search-publisher-code.ts`
- `src/services/search.ts`
- `src/services/figma.ts`
- `src/services/publisher.ts`

# SEARCH FLOW

사용자 질의가 MCP 내부에서 어떤 순서로 처리되는지,  
왜 특정 질문에서는 재질문/후보선택이 발생하는지, 그리고 조회 결과가 어떻게 학습 저장되는지 설명합니다.

---

## 1) 전체 처리 흐름

```text
사용자 질의
  -> search_figma_spec 호출
    -> query 파싱(screenId/project/version/selection/keywords)
      -> 전략 선택
        -> 결과 판단(0/1/N)
          -> 상세 보강(lazy loading)
            -> 학습 저장(update/add)
              -> 응답 반환
```

---

## 2) 질의 파싱 단계

파싱 항목:

- `screenId`: `CONT-XX_YY_ZZ` 패턴
- `project`: 별칭 -> 표준 프로젝트명 매핑
- `version`: `X.Y.Z` 패턴
- `selectionIndex`: 번호 선택 입력(`1`, `2번`, `3 번기획`)
- `keywords`: 검색 토큰

핵심:

- screenId가 있으면 우선 경로가 매우 명확해집니다.
- project/version이 빠지면 "후보 제시 + 선택" 경로로 전개됩니다.

---

## 3) 전략 선택 규칙

## A. screenId 검색

조건:

- screenId 감지됨

동작:

- 동일 ID 조회
- 다중 버전이면 버전 질문

## B. project + version 검색

조건:

- 둘 다 감지됨

동작:

- 해당 범위 내 점수 검색
- 결과 단건이면 확정

## C. project만 검색

조건:

- project만 감지

동작:

- 프로젝트 내 전버전 검색
- 버전별 후보 제시

## D. 전체 검색

조건:

- project/version 미감지

동작:

- 전체 프로젝트 대상 검색
- 핵심 구문 중심 후보 정제

---

## 4) 자동확정과 버전 재질문 정책

정책:

- 버전이 질의에 명시되지 않으면 자동확정 제한
- 다중 버전 후보에서는 반드시 선택 질문
- `DEFAULT_VERSION`이 존재해도 "질의에 버전 없음"이면 강제 확정하지 않음

이 정책은 "항상 특정 버전으로 고정되는 문제"를 막기 위한 핵심 가드입니다.

---

## 5) 후보 제시와 번호 선택 UX

노출 원칙:

- 사용자에게는 `버전 + 제목` 중심으로 보여줌
- 내부적으로는 후보 풀을 보존하여 번호 입력으로 정확히 매핑

지원 입력:

- `1`
- `2번`
- `3 번기획 불러와줘`

이전 후보 풀이 없으면:

- 번호 선택 입력은 무효 처리하고 재질문 유도

---

## 6) 점수화/정렬 규칙

우선순위:

1. screenId 매칭
2. pageTitle 매칭
3. description 매칭
4. keywords 매칭

추가 보정:

- 핵심 구문(예: "볼륨 수정")이 제목에 포함된 후보 우대
- 같은 화면의 다중 버전은 우선 묶어서 선택 노이즈 감소

---

## 7) 상세 조회와 학습 저장

기본 인덱스는 경량 수집이므로 description이 비어 있을 수 있습니다.

확정 시 처리:

1. description 확인
2. 비어있으면 `getScreenDescription`
3. 부족하면 `getScreenDetail`
4. `updateScreenDetail` 저장 시도
5. 실패 시 `addScreen` fallback

핵심:

- 조회만 하고 끝내지 않고 반드시 저장 경로를 타도록 보장

---

## 8) Fallback 검색

로컬 인덱스 결과가 0건이면:

1. Figma API 실시간 검색
2. 결과가 있으면 사용자에게 반환
3. 동시에 인덱스에 학습 저장

의미:

- 재수집 전에도 최신 기획을 찾을 수 있음
- 다음 질의는 로컬 검색으로 빨라짐

---

## 9) 수집(collect-metadata) 운영 플로우

현재 수집 원칙:

- 경량 중심 수집
- 기존 데이터 병합
- 실패 버전/프로젝트 데이터 보존
- `.bak` 백업 + 안전 저장
- 대형 요청 실패 시 depth 축소 재시도

---

## 10) 대표 시나리오

### 시나리오 1

질의:

```text
볼륨 수정 기획 찾아줘
```

처리:

- 버전 미지정 -> 후보 제시 -> 번호 선택 대기

### 시나리오 2

질의:

```text
콘트라베이스 3.0.6 볼륨 수정 기획
```

처리:

- 범위 제한 검색 -> 상세 또는 후보 반환

### 시나리오 3

질의:

```text
3 번기획 불러와줘
```

처리:

- 직전 후보 풀에서 3번 확정

### 시나리오 4

질의:

```text
CONT-04_01_05 보여줘
```

처리:

- ID 직접 검색 -> 다중 버전 시 버전 선택

---

## 11) 운영 시 주의점

- 모호 질의에서 자동확정을 늘리면 오답이 급증할 수 있음
- 후보 포맷 변경 시 번호 선택 파서와 같이 검증 필요
- 저장 경로 정책이 바뀌면 학습 반영 이슈가 재발할 수 있음

---

## 12) 관련 코드

- `src/tools/search-figma-spec.ts`
- `src/services/search.ts`
- `src/services/figma.ts`
- `src/scripts/collect-metadata.ts`

# SEARCH FLOW

사용자 질의를 MCP가 어떻게 해석하고 답을 찾는지 정리한 문서입니다.

## 1) 런타임 전체 흐름

```text
User Query
  -> search_figma_spec tool 호출
    -> query 파싱(screenId/project/version/keywords)
      -> 검색 전략 결정
        -> 후보 목록 또는 상세 결과 반환
          -> description 학습 저장(update -> add fallback)
```

## 2) 질의 파싱

- `screenId`: `CONT-XX_YY_ZZ` 패턴
- `project`: 자연어 별칭 매핑 (예: 콘트라베이스 -> CONTRABASS)
- `version`: `X.Y.Z` 패턴
- `keywords`: 정제/토큰화

## 3) 전략 결정 규칙

- `screenId` 포함
  - ID 우선 검색
  - 버전 미지정이면 동일 ID 버전 선택 먼저 제시
- `project + version` 포함
  - 해당 범위 제한 검색
- `project`만 포함
  - 프로젝트 내 다중 버전 검색
- 둘 다 미포함
  - 전체 프로젝트 그룹 검색

## 4) 자동확정/버전 질문 규칙

- 버전이 명시되지 않으면 `autoConfirm` 비활성화
- 따라서 버전 선택 질문/목록을 우선 제공합니다
- `DEFAULT_VERSION`이 있어도 질의에 명시 버전이 없으면 강제 고정하지 않도록 보정합니다

## 5) 후보 선택 UX (채팅형)

- 화면 ID를 모르는 사용자를 위해 `버전 + 타이틀` 중심으로 노출
- 내부에 마지막 후보 풀을 저장하고 번호 응답으로 선택 처리
- 지원 입력 예시:
  - `1`
  - `2번`
  - `3 번기획 불러와줘`

## 6) 버전 정합성 강화 규칙

- 동일 화면(`screenId + title`)이 여러 버전에 있으면 버전 목록을 먼저 제시
- 질의 핵심 구문(예: `볼륨수정`) 기반으로 후보 우선순위를 조정
- 버전 선택 판단 시 검색 결과 창을 넓게 가져와(상위 100) 누락을 줄임

## 7) 상세 조회와 학습 저장

```text
상세 조회 요청
  -> getScreenDescription 시도
    -> 비어있으면 getScreenDetail fallback
      -> updateScreenDetail 시도
        -> 실패 시 addScreen fallback
          -> data/screen-index.json 저장
```

핵심 원칙:

- 조회만 하고 끝내지 않고 반드시 저장 경로를 태움
- 같은 화면 재질의 시 더 빠르게/정확하게 응답

## 8) Figma fallback 검색

- metadata에서 결과가 없으면 Figma API 실시간 검색 수행
- 찾은 결과는 metadata에 추가(자동 학습)
- 이후 동일 질의는 metadata 우선으로 처리

## 9) 수집(collect-metadata) 운영 플로우

- 핵심 필드 중심 경량 수집
- merge 업데이트 (기존 데이터 보존)
- 실패 버전/프로젝트는 보존
- `screen-index.json.bak` 백업 + 안전 저장
- `Request too large` 시 depth 자동 축소 재시도

## 10) 대표 질의 시나리오

- `볼륨 수정 기획 찾아줘`
  - 버전 미지정 -> 버전 후보 제시 -> 번호 선택
- `콘트라베이스 3.0.6 볼륨 수정 기획`
  - 범위 제한 검색 -> 후보 또는 상세
- `CONT-04_01_05 보여줘`
  - ID 직접 조회
- `3 번기획 불러와줘`
  - 직전 후보 풀에서 3번 선택
