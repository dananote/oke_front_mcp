# MCP 개발 계획서

**프로젝트**: oke-front-mcp  
**목표**: 프론트엔드 개발 통합 MCP 서버  
**최종 업데이트**: 2026-02-20

---

## 🎯 프로젝트 개요

### 목적
사내 프론트엔드 개발자들이 Cursor에서 자연어로 질문하면 필요한 모든 정보를 통합 제공받을 수 있는 MCP 서버

### 통합 대상
1. **Figma** - 기획서 및 화면 정의
2. **퍼블리셔 레포** - HTML/CSS 목업 코드
3. **Confluence** - 디자인 시스템 문서
4. **Ant Vue** - UI 컴포넌트 API

### 기대 효과
- ⏱️ 개발 준비 시간 **90% 단축** (10분 → 1분)
- 🔍 자연어 검색으로 직관적 사용
- 🚀 Cursor IDE 내에서 모든 작업 완료

---

## 📅 개발 로드맵

### ✅ Phase 1: Figma 연동 (완료)
**기간**: Week 1  
**목표**: "CONT-05_04_54 보여줘" 명령 작동

**완료 내용**:
- MCP 서버 기본 구조
- Figma API 연동
- 화면 ID 직접 조회
- Cursor 연동

---

### ✅ Phase 2: 메타데이터 인덱싱 (완료)
**기간**: Week 2  
**목표**: "콘트라베이스 3.0.6 로드밸런서 모니터링" 자연어 검색 작동

**완료 내용**:
- 메타데이터 수집 스크립트
- 키워드 검색 알고리즘
- 자연어 검색 기능
- 후보 제시 기능

---

### 🔜 Phase 3: 퍼블리셔 레포 연동
**기간**: Week 3  
**목표**: "모달 퍼블 코드 찾아줘" 명령 작동

**주요 작업**:
- Git 레포 연동 (`git@bitbucket.org:okestrolab/okestro-ui.git`)
- HTML/CSS 파일 검색
- 코드 스니펫 반환
- `search_publisher_code` Tool 구현

**사전 요구사항**:
- SSH Key 접근 테스트
- 퍼블 레포 폴더 구조 파악

---

### 🔜 Phase 4: Confluence + Ant Vue 연동
**기간**: Week 4  
**목표**: "버튼 디자인 가이드" 조회 가능

**주요 작업**:

#### A. Confluence
- Confluence API 연동 (또는 Export 파일)
- 디자인 시스템 문서 검색
- `get_design_guide` Tool 구현

#### B. Ant Vue
- 공식 문서 크롤링
- 컴포넌트 API 파싱
- `search_ant_vue` Tool 구현

---

### 🔜 Phase 5: 컴포넌트 템플릿 생성
**기간**: Week 5  
**목표**: "CONT-05_04_54 컴포넌트 생성해줘" 명령으로 .vue 파일 생성

**주요 작업**:
- 4개 소스 통합 (Figma + 퍼블 + Confluence + Ant Vue)
- Vue SFC 템플릿 생성
- `generate_component` Tool 구현

---

### 🔜 Phase 6: 최적화 및 팀 배포
**기간**: Week 6-7  
**목표**: 팀원 전체 배포

**주요 작업**:
- 자동 재인덱싱
- 캐싱 최적화
- 에러 핸들링 개선
- 팀 배포 가이드
- CI/CD 파이프라인 (선택)

---

## 🛠️ 기술 스택

### 코어
- Node.js 18+
- TypeScript 5.7+
- MCP SDK (@modelcontextprotocol/sdk)

### 현재 사용 중
- axios (HTTP 요청)
- dotenv (환경변수)
- tsx (TypeScript 실행)

### 향후 추가 예정
- simple-git (Git 레포)
- fast-glob (파일 검색)
- cheerio (HTML 파싱)

---

## 🎯 주요 기능

### 현재 지원 (Phase 1-2)

#### 1. 화면 ID 직접 조회
```
@oke-front-mcp CONT-05_04_54 보여줘
```

#### 2. 자연어 검색
```
@oke-front-mcp 콘트라베이스 3.0.6 로드밸런서 모니터링
```

#### 3. 자동 후보 제시
- 1개 결과: 자동 확정
- 2개 이상: 후보 목록 제시

---

### 향후 지원 (Phase 3-6)

#### 4. 퍼블 코드 검색 (Phase 3)
```
@oke-front-mcp 모달 퍼블 코드 찾아줘
```

#### 5. 디자인 가이드 조회 (Phase 4)
```
@oke-front-mcp 버튼 디자인 가이드
```

#### 6. Ant Vue 컴포넌트 API (Phase 4)
```
@oke-front-mcp Table 컴포넌트 사용법
```

#### 7. 컴포넌트 자동 생성 (Phase 5)
```
@oke-front-mcp CONT-05_04_54 컴포넌트 생성해줘
```

---

## 📊 예상 효과

### 정량적 효과

| 작업 | 현재 | MCP 사용 후 | 개선율 |
|------|------|------------|--------|
| Figma 기획서 찾기 | 2-3분 | 30초 | 83% ↓ |
| 자연어로 화면 찾기 | 5-10분 | 1분 | 90% ↓ |
| 퍼블 코드 찾기 | 3-5분 | 1분 | 80% ↓ |
| 디자인 가이드 확인 | 2-3분 | 30초 | 83% ↓ |
| **전체 준비 시간** | **15-25분** | **3-5분** | **80-85% ↓** |

### 정성적 효과
- ✅ 개발 흐름 중단 최소화
- ✅ 정보 접근성 향상
- ✅ 신규 팀원 온보딩 단축
- ✅ 일관된 개발 프로세스

---

## 🔍 검색 전략

### 하이브리드 검색
1. **화면 ID 패턴 감지**: CONT-XX_YY_ZZ → 직접 조회
2. **자연어 검색**: 키워드 추출 → 점수 계산 → 정렬

### 점수 계산 알고리즘
```
- 완전 일치: +10점
- 부분 일치: +5점
- Screen ID 포함: +8점
- Page Title 포함: +7점
```

### 자동 확정
- 1개 결과: 즉시 상세 정보 표시
- 2개 이상: 후보 목록 제시 (점수순)

---

## 🚀 배포 전략

### 개발 환경
- 로컬 개발 및 테스트
- Git 저장소 관리

### 팀 배포 (Phase 6)
1. **중앙 저장소**: 팀 공용 Git 레포
2. **설치 가이드**: `SETUP_GUIDE.md`
3. **개인 설정**: 각자 Figma Token 발급
4. **메타데이터 공유**: 선택 사항 (로컬 수집 권장)

### 업데이트 전략
- Git pull로 최신 버전 업데이트
- 메타데이터는 개별 수집 (기획서 변경 시)

---

## 🔄 메타데이터 갱신 주기

### Figma 메타데이터
- **권장 주기**: 매일 1회 또는 배포 전
- **수집 명령**: `npm run collect-metadata`
- **소요 시간**: 5-10분 (프로젝트 크기에 따라)

### 퍼블리셔 레포 (Phase 3)
- Git pull로 자동 동기화
- 캐싱 후 변경 감지

### Confluence (Phase 4)
- API 실시간 조회 또는 Export 파일
- 업데이트 빈도에 따라 전략 결정

---

## 📋 필요 정보 및 권한

### ✅ 확보 완료
- Figma Personal Access Token
- Figma Team ID: 1498602828936104321
- 퍼블리셔 Git URL: git@bitbucket.org:okestrolab/okestro-ui.git
- Confluence URL: https://okestro.atlassian.net/wiki
- Confluence API Token

### ⚠️ 확인 필요
- 퍼블리셔 레포 SSH Key 접근 테스트
- Confluence API 권한 (현재 403 오류)

---

## 🎉 현재 상태

### ✅ 완료
- Phase 1: Figma 연동
- Phase 2: 자연어 검색

### 🚀 다음 단계
- Phase 3: 퍼블리셔 레포 연동

---

**작성**: Okestro Frontend Team  
**버전**: 0.2.0  
**최종 업데이트**: 2026-02-20
