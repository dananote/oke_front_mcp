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

## 6) Step2 Publisher: 검색 결과가 비어 있음

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

## 공통 점검 체크리스트

1. `npm run build` 최신 상태인가
2. Cursor를 재시작했는가
3. Figma/Publisher 환경변수가 설정되었는가
4. 인덱스 파일(`screen-index.json`, `publisher-index.json`)이 갱신되는가
5. fallback 경로(`PUBLISHER_REPO_PATH`)가 실제 repo인가

