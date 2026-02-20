# oke-front-mcp 개발 문서

**프로젝트**: oke-front-mcp  
**최종 업데이트**: 2026-02-20  
**현재 버전**: 0.2.0

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [개발 진행 상황](#개발-진행-상황)
3. [기술 스택](#기술-스택)
4. [프로젝트 구조](#프로젝트-구조)
5. [Phase별 개발 내역](#phase별-개발-내역)
6. [다음 단계](#다음-단계)
7. [수집된 정보](#수집된-정보)

---

## 프로젝트 개요

### 목적
사내 프론트엔드 개발자들이 Cursor에서 자연어로 질문하면 필요한 모든 정보를 통합 제공받을 수 있는 MCP 서버 구축

### 해결하는 문제
- 📱 Figma 기획서 찾기 (웹 접속 불필요)
- 📂 퍼블리셔 HTML/CSS 코드 찾기
- 📚 Confluence 디자인 가이드 확인
- 🎨 Ant Vue 컴포넌트 API 조회

### 목표 효과
- ⏱️ 개발 준비 시간 **90% 단축** (10분 → 1분)
- 🔍 자연어 검색으로 직관적 사용
- 🚀 Cursor IDE 내에서 모든 작업 완료

---

## 개발 진행 상황

### ✅ Phase 1: Figma 연동 (완료)

**목표**: "CONT-05_04_54 보여줘" 명령 작동

**완료 내용**:
- ✅ MCP 서버 기본 구조
- ✅ Figma API 연동
- ✅ 화면 ID 직접 조회
- ✅ Cursor 연동 테스트
- ✅ 기본 문서화

**주요 파일**:
- `src/index.ts` - MCP 서버 진입점 (164줄)
- `src/services/figma.ts` - Figma API 서비스 (279줄)
- `src/tools/search-figma-spec.ts` - Figma 검색 도구 (158줄)

**완료일**: 2026-02-20

---

### ✅ Phase 2: 메타데이터 인덱싱 및 자연어 검색 (완료)

**목표**: "콘트라베이스 3.0.6 로드밸런서 모니터링" 자연어 검색 작동

**완료 내용**:
- ✅ 메타데이터 수집 스크립트 (`collect-metadata.ts`)
- ✅ 키워드 검색 알고리즘
- ✅ 자연어 검색 기능
- ✅ 후보 제시 기능
- ✅ 자동 확정 옵션
- ✅ MCP Resources 구현 (`figma://stats`, `figma://screens`)

**주요 파일**:
- `src/scripts/collect-metadata.ts` - 메타데이터 수집 (290줄)
- `src/services/search.ts` - 검색 서비스 (172줄)
- `data/screen-index.json` - 메타데이터 인덱스

**검색 알고리즘**:
```typescript
// 점수 계산
- 완전 일치: +10점
- 부분 일치: +5점
- Screen ID 포함: +8점
- Page Title 포함: +7점

// 검색 흐름
사용자 입력 → 키워드 추출 → 프로젝트/버전 필터 → 점수 계산 → 정렬 → 결과 반환
```

**완료일**: 2026-02-20

---

### 🔜 Phase 3: 퍼블리셔 레포 연동 (예정)

**목표**: "모달 퍼블 코드 찾아줘" 명령 작동

**주요 작업**:
- [ ] Git 레포 연동 (`git@bitbucket.org:okestrolab/okestro-ui.git`)
- [ ] HTML/CSS 파일 검색
- [ ] 코드 스니펫 반환
- [ ] `search_publisher_code` Tool 구현

**필요 정보**:
- SSH Key 접근 테스트
- 퍼블 레포 폴더 구조
- 화면 ID ↔ 파일 매핑 규칙

---

### 🔜 Phase 4: Confluence + Ant Vue 연동 (예정)

**목표**: "버튼 디자인 가이드" 조회 가능

**주요 작업**:

#### A. Confluence
- [ ] Confluence API 연동 (또는 Export 파일 사용)
- [ ] 디자인 시스템 문서 검색
- [ ] `get_design_guide` Tool 구현

**필요 정보**:
- Confluence Space Key
- API Token (현재 403 오류 - 권한 필요)

#### B. Ant Vue
- [ ] 공식 문서 크롤링
- [ ] 컴포넌트 API 파싱
- [ ] `search_ant_vue` Tool 구현

---

### 🔜 Phase 5: 컴포넌트 템플릿 생성 (예정)

**목표**: "CONT-05_04_54 컴포넌트 생성해줘" 명령으로 .vue 파일 생성

**주요 작업**:
- [ ] 4개 소스 통합 로직 (Figma + 퍼블 + Confluence + Ant Vue)
- [ ] Vue SFC 템플릿 생성
- [ ] `generate_component` Tool 구현

---

### 🔜 Phase 6: 최적화 및 팀 배포 (예정)

**주요 작업**:
- [ ] 자동 재인덱싱
- [ ] 캐싱 최적화
- [ ] 에러 핸들링 개선
- [ ] 팀 배포 가이드 작성
- [ ] CI/CD 파이프라인 구축 (선택)

---

## 기술 스택

### 코어
- **Node.js** 18+
- **TypeScript** 5.7+
- **MCP SDK** (@modelcontextprotocol/sdk)

### 라이브러리
- **axios** - HTTP 요청 (Figma API)
- **dotenv** - 환경변수 관리
- **tsx** - TypeScript 실행 (개발)

### 향후 추가 예정 (Phase 3-6)
- **simple-git** - Git 레포 조작
- **fast-glob** - 파일 검색
- **cheerio** - HTML 파싱

---

## 프로젝트 구조

```
oke-front-mcp/
├── src/
│   ├── index.ts                      # MCP 서버 진입점
│   ├── services/
│   │   ├── figma.ts                  # Figma API 서비스
│   │   └── search.ts                 # 검색 서비스 (Phase 2)
│   ├── tools/
│   │   └── search-figma-spec.ts      # Figma 검색 도구
│   └── scripts/
│       └── collect-metadata.ts       # 메타데이터 수집 (Phase 2)
├── data/
│   └── screen-index.json             # 메타데이터 인덱스
├── dist/                             # 빌드 결과물
├── package.json
├── tsconfig.json
├── README.md                         # 프로젝트 소개
├── SETUP_GUIDE.md                    # 설치 및 사용 가이드
└── DEVELOPMENT.md                    # 이 파일
```

---

## Phase별 개발 내역

### Phase 1 통계
- **TypeScript 파일**: 3개
- **총 코드**: 601줄
- **문서**: 8개 파일

### Phase 2 통계
- **추가 파일**: 2개
- **추가 코드**: +492줄
- **전체 코드**: 1,093줄

### 의존성
- **프로덕션**: 4개 패키지
- **개발**: 3개 패키지

---

## 다음 단계

### 즉시 진행 가능
- ✅ Phase 1-2 완료 (Figma 기반 기능)
- ✅ Ant Vue 크롤링 (공개 문서, 권한 불필요)

### 사전 확인 필요
- ⚠️ 퍼블리셔 레포 SSH Key 접근 테스트
- ⚠️ Confluence API 권한 확보 (또는 Export 파일 사용)

### 권장 진행 순서
```
Week 1-2: Phase 1-2 ✅ 완료
Week 3: Phase 3 (퍼블 레포)
Week 4: Phase 4 (Ant Vue + Confluence)
Week 5-7: Phase 5-6 (통합 및 최적화)
```

---

## 수집된 정보

### Figma
```
✓ Personal Access Token: 발급 완료
✓ Team ID: 1498602828936104321
✓ 지원 프로젝트: CONTRABASS, ACI, VIOLA
✓ 기본 프로젝트: CONTRABASS
✓ 기본 버전: 3.0.6
✓ API 테스트: 성공
```

### 퍼블리셔 레포
```
✓ Git URL: git@bitbucket.org:okestrolab/okestro-ui.git
✓ 호스팅: Bitbucket
⚠️ 접근 테스트: 필요 (SSH Key 확인)
```

### Confluence
```
✓ URL: https://okestro.atlassian.net/wiki
✓ API Token: 발급 완료
✓ 사용자: taeheerho@okestro.com
❌ API 접근: 실패 (403 Forbidden) - 권한 필요
→ 임시 해결: Export 파일 사용 가능
```

### Ant Design Vue
```
✓ 공식 문서: https://antdv.com
✓ 권한: 불필요 (공개 문서 크롤링)
```

---

## 예상 효과

### 정량적 효과

| 항목 | Before | After (Phase 2) | 개선 |
|------|--------|----------------|------|
| 화면 ID 알고 있을 때 | 2-3분 | 30초 | **83% 단축** |
| 화면 ID 모를 때 | 5-10분 | 1분 | **90% 단축** |
| 검색 정확도 | - | 80-90% | - |

### 정성적 효과
- ✅ Figma 웹 접속 불필요
- ✅ 화면 ID를 몰라도 검색 가능
- ✅ 자연스러운 질문으로 검색
- ✅ Cursor 내에서 모든 작업 완료
- ✅ 개발 흐름 중단 최소화

---

## 개발 명령어

```bash
# 개발 모드 (watch)
npm run dev

# 빌드
npm run build

# 서버 실행
npm start

# 메타데이터 수집
npm run collect-metadata

# 검색 테스트 (개발용)
npx tsx src/scripts/test-search.ts
```

---

## 환경 변수

Cursor 설정 파일(`~/.cursor/config.json`)에서 관리:

```json
{
  "env": {
    "FIGMA_TOKEN": "figd_...",
    "FIGMA_TEAM_ID": "1498602828936104321",
    "DEFAULT_PROJECT": "CONTRABASS",
    "DEFAULT_VERSION": "3.0.6",
    "SUPPORTED_PROJECTS": "CONTRABASS,ACI,VIOLA"
  }
}
```

⚠️ **중요**: `.env` 파일은 **사용하지 않습니다**. Cursor 설정에서만 관리.

---

## 하이브리드 검색 전략

### 화면 ID 패턴 감지
```typescript
detectScreenId(query: string): string | null
// "CONT-05_04_54" → 직접 조회
// "로드밸런서 모니터링" → 자연어 검색
```

### 자연어 검색 흐름
1. **키워드 추출**: 특수문자 제거, 소문자 변환, 공백 분리
2. **프로젝트/버전 필터**: 지정된 프로젝트/버전만 검색
3. **점수 계산**: 키워드 매칭 점수 합산
4. **정렬 및 반환**: 점수 내림차순 정렬 후 상위 N개 반환

### 자동 확정
- **1개 결과**: 자동으로 상세 정보 표시
- **2개 이상**: 후보 목록 제시

---

## 메타데이터 구조

### screen-index.json

```json
{
  "lastUpdated": "2026-02-20T08:00:00.000Z",
  "screens": [
    {
      "id": "CONT-05_04_54",
      "name": "로드밸런서_상세 (모니터링)",
      "nodeId": "8931:181979",
      "type": "FRAME",
      "author": "김가영2, 김소영",
      "fileKey": "omx45nAEmc94lMhq5SpAqs",
      "fileName": "[Roadmap][3.0.5][3.0.6] CONTRABASS",
      "project": "CONTRABASS",
      "version": "3.0.6",
      "keywords": ["cont", "05", "04", "54", "로드밸런서", "상세", "모니터링"]
    }
  ]
}
```

---

## 문제 해결 이력

### Figma API "Request too large" 오류
**문제**: 전체 파일 내용 조회 시 데이터 크기 초과  
**해결**: `depth` 파라미터 사용 (기본값: 5 → 8)

### 화면 ID 찾기 실패
**문제**: Figma 노드 트리 깊이 부족  
**해결**: `getFileContent`에서 `depth` 증가

### 메타데이터 수집 시 일부 파일 403 오류
**문제**: 일부 Figma 파일이 "File not exportable"  
**현재 상태**: 접근 가능한 파일만 수집 (오류 로그 출력)

---

## 팀 배포 체크리스트 (Phase 6)

### 배포 전 준비
- [ ] 전체 프로젝트 메타데이터 수집 완료
- [ ] 에러 핸들링 완성
- [ ] 팀 공용 Git 저장소 설정
- [ ] 팀원별 Figma Token 발급 가이드
- [ ] Cursor 설정 템플릿 제공

### 배포 후 지원
- [ ] 팀원 설치 지원
- [ ] 사용 교육
- [ ] 피드백 수집
- [ ] 버그 수정

---

## 참고 자료

### Figma API
- 공식 문서: https://www.figma.com/developers/api
- 인증: Personal Access Token
- Rate Limit: 알 수 없음 (테스트 중)

### MCP 프로토콜
- 공식 문서: https://modelcontextprotocol.io
- SDK: @modelcontextprotocol/sdk

---

**작성**: Okestro Frontend Team  
**버전**: 0.2.0  
**최종 업데이트**: 2026-02-20  
**상태**: Phase 2 완료, Phase 3 준비 중
