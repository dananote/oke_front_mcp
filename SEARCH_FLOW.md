# 자연어 검색 플로우

## 📅 최종 업데이트
2026-02-20 (Phase 4: 경량화 + 지연 로딩 추가)

---

## 🚀 Phase 4 업데이트: 경량화 + 지연 로딩

### 💡 핵심 개념
```
collect-metadata: 필수 정보만 빠르게 수집 (depth=3)
  ├─ screenId ✅
  ├─ pageTitle ✅
  ├─ author ✅
  └─ description = "" (빈 값)
  
  ⏱️ 수집 시간: 5-10분 (기존 30분+ → 6배 빠름!)

실제 검색 시: 지연 로딩 (Lazy Loading)
  사용자가 화면 검색
  └─ description 없음? → 실시간 조회
      ├─ figmaService.getScreenDetail() 호출
      ├─ description 수집 (해당 화면만)
      ├─ searchService.updateScreenDetail() 저장
      └─ 다음번엔 빠르게 표시 ⚡
```

### 📊 성능 비교
| 항목 | 기존 방식 | 새로운 방식 |
|------|----------|------------|
| 수집 시간 | 30분+ | 5-10분 |
| depth | 10 | 3 |
| description | 모두 수집 | 빈 값 |
| 첫 검색 속도 | 빠름 | 빠름 |
| 상세 정보 조회 | 즉시 | 1-2초 (첫 1회만) |
| 두 번째 검색 | 즉시 | 즉시 |

### ✨ 장점
- ✅ **메타데이터 수집 6배 빠름**
- ✅ **API 호출 최소화** (Rate limit 걱정 ↓)
- ✅ **사용하는 화면만 상세 조회** (효율적)
- ✅ **자동 학습** (한 번 조회한 화면은 저장)
- ✅ **메타데이터 파일 크기 축소**

---

## 🎯 목표

사용자가 **불완전한 정보**로 질문해도 적절한 선택지를 제공하여 원하는 화면을 찾을 수 있도록 지원

---

## 🔍 검색 시나리오

### 시나리오 1: 화면 ID 직접 입력 (정확한 검색)
```
입력: "CONT-03_01_16 보여줘"
```

**플로우:**
```
1. detectScreenId() → "CONT-03_01_16" 추출
2. screen-index.json에서 해당 ID 검색
3. 즉시 결과 반환 (Figma 링크 + 기획 내용)
```

**결과:**
```
✅ CONT-03_01_16
제목: 인스턴스_생성_4 (보안)
프로젝트: CONTRABASS / 버전: 3.0.6
...
```

---

### 시나리오 2: 프로젝트/버전 명시 + 자연어 (범위 제한 검색)
```
입력: "콘트라베이스 3.0.6 인스턴스 생성 보안"
```

**플로우:**
```
1. detectScreenId() → null (화면 ID 없음)
2. 프로젝트/버전 파싱
   - 프로젝트: "CONTRABASS" (콘트라베이스 매칭)
   - 버전: "3.0.6"
3. SearchService.search(query, "CONTRABASS", "3.0.6")
4. CONTRABASS 3.0.6에서만 검색
5. 키워드: ["인스턴스", "생성", "보안"]
6. 매칭 스코어 계산 → 결과 반환
7. 🔄 지연 로딩 (Phase 4)
   - description이 비어있으면?
   → figmaService.getScreenDetail(fileKey, nodeId)
   → searchService.updateScreenDetail(...) 저장
   → 다음번엔 빠르게 표시
```

**결과:**
```
🔄 화면 상세 정보를 불러오는 중... (CONT-03_01_16)
   ✓ 상세 정보 조회 완료: 인스턴스_생성_4 (보안)
   🎓 화면 상세 정보 업데이트 완료: CONT-03_01_16

✅ 1개의 화면을 찾았습니다
CONT-03_01_16 - 인스턴스_생성_4 (보안)
...
```

---

### 시나리오 3: 자연어만 입력 (불완전한 정보) ⭐ **NEW**
```
입력: "인스턴스 생성 페이지 기획 찾아줘"
```

**문제:**
- 프로젝트가 무엇인지? (CONTRABASS? SDS+? VIOLA?)
- 어떤 버전인지? (3.0.4? 3.0.5? 3.0.6?)
- 인스턴스 생성 관련 화면이 여러 개일 수 있음

**플로우:**
```
1. detectScreenId() → null
2. 프로젝트/버전 미지정 감지
3. SearchService.searchAllProjects(query)
   - 모든 프로젝트/버전에서 검색
4. 결과를 프로젝트/버전별로 그룹화
5. 선택지 제공
```

**결과:**
```
🔍 "인스턴스 생성"으로 여러 화면을 찾았습니다:

📂 CONTRABASS
   📌 3.0.6
      1. CONT-03_01_10 - 인스턴스_생성_3 (세그먼트)
      2. CONT-03_01_16 - 인스턴스_생성_4 (보안)
   📌 3.0.5
      3. CONT-03_01_10 - 인스턴스_생성_2 (기본정보)
      
📂 SDS+
   📌 3.0.6
      4. SDS-02_01_05 - 인스턴스 생성 마법사
      
어떤 화면을 보시겠습니까? (번호 또는 "CONTRABASS 3.0.6" 등으로 범위 지정)
```

---

### 시나리오 4: 부분 정보 입력 (프로젝트만 명시) ⭐ **NEW**
```
입력: "콘트라베이스 인스턴스 생성 네트워크 선택"
```

**플로우:**
```
1. detectScreenId() → null
2. 프로젝트 파싱: "CONTRABASS"
3. 버전 미지정 → CONTRABASS의 모든 버전 검색
4. SearchService.searchProject("CONTRABASS", query)
5. 버전별로 그룹화하여 선택지 제공
```

**결과:**
```
🔍 "인스턴스 생성 네트워크 선택" (CONTRABASS):

📌 3.0.6
   1. CONT-03_01_10 - 인스턴스_생성_3 (세그먼트)
      "...네트워크 선택... 세그먼트 선택..."
      
📌 3.0.5
   2. CONT-03_01_09 - 인스턴스_생성_3 (네트워크)
      
어떤 버전을 보시겠습니까?
```

---

### 시나리오 5: metadata 없음 → Figma API Fallback ⭐ **NEW**
```
입력: "새로운 화면 기획 찾아줘"
(방금 추가된 화면으로 metadata에 아직 없음)
```

**문제:**
- metadata에 해당 화면 정보가 없음
- collect-metadata를 아직 실행하지 않음

**플로우:**
```
1. detectScreenId() → null
2. SearchService.searchGrouped(query)
3. 결과 0개 ← metadata에 없음!
4. 🔍 Figma API 실시간 검색 시작 (Fallback)
5. FigmaService.searchScreensInRealtime(keywords)
   - 모든 프로젝트/파일 순회
   - depth=10으로 전체 구조 가져오기
   - 키워드 매칭 수행
6. 결과 발견 → 사용자에게 표시
7. 🎓 자동 학습: metadata에 저장
8. 다음번에는 metadata에서 즉시 조회 가능
```

**결과:**
```
🔍 Figma API에서 2개의 화면을 찾았습니다:

🎓 찾은 화면들이 metadata에 추가되었습니다.

1. CONT-08_01_05 - 새로운 화면 기획
   프로젝트: Unknown / 버전: 3.0.7

2. CONT-08_01_06 - 새로운 화면 상세
   프로젝트: Unknown / 버전: 3.0.7

💡 다음번에는 더 빠르게 검색할 수 있습니다.
```

**다음 검색 시:**
```
입력: "새로운 화면 기획"
→ metadata에서 즉시 조회 (학습 완료) ✅
→ 검색 속도: 10초 → 0.1초 (100배 빠름!)
```

**Fallback의 장점:**
1. metadata 갱신 없이도 최신 화면 찾기 가능
2. 찾은 화면은 자동으로 학습 (다음부터 빠름)
3. 사용자는 collect-metadata 실행 불필요

**Fallback의 단점:**
1. 느림 (첫 검색 시 약 10-30초 소요)
2. Figma API rate limit 소진
3. 네트워크 필요

---

## 🏗️ 기술 구조

### 1. 쿼리 파싱
```typescript
function parseQuery(query: string) {
  return {
    screenId: detectScreenId(query),      // "CONT-XX_YY_ZZ" 패턴
    project: detectProject(query),        // "콘트라베이스" → "CONTRABASS"
    version: detectVersion(query),        // "3.0.6"
    keywords: extractKeywords(query)      // ["인스턴스", "생성", ...]
  };
}
```

### 2. 검색 전략 결정
```typescript
if (screenId) {
  // 화면 ID 직접 검색
  return searchByScreenId(screenId);
  
} else if (project && version) {
  // 프로젝트/버전 특정 검색
  return searchService.search(query, project, version);
  
} else if (project) {
  // 프로젝트 내 모든 버전 검색
  return searchService.searchProject(project, query);
  
} else {
  // 전체 검색 (모든 프로젝트/버전)
  return searchService.searchAllProjects(query);
}
```

### 3. 결과 그룹화
```typescript
interface GroupedResult {
  project: string;
  versions: {
    version: string;
    screens: ScreenMatch[];
  }[];
}
```

### 4. 선택지 제공
```typescript
// autoConfirm 로직
if (results.length === 1 && autoConfirm) {
  return showScreen(results[0]);  // 즉시 표시
} else {
  return showCandidates(results); // 선택지 제공
}
```

---

## 📊 검색 매칭 알고리즘

### 키워드 매칭
```typescript
function calculateMatchScore(screen: ScreenMetadata, keywords: string[]) {
  let score = 0;
  
  const searchText = `
    ${screen.screenId}
    ${screen.pageTitle}
    ${screen.description}
  `.toLowerCase();
  
  keywords.forEach(keyword => {
    if (searchText.includes(keyword)) {
      // pageTitle에 있으면 높은 점수
      if (screen.pageTitle.toLowerCase().includes(keyword)) {
        score += 10;
      }
      // description에 있으면 중간 점수
      else if (screen.description.toLowerCase().includes(keyword)) {
        score += 5;
      }
      // keywords 배열에 있으면 낮은 점수
      else {
        score += 1;
      }
    }
  });
  
  return score;
}
```

### 우선순위
1. **화면 ID 매칭** (최우선)
2. **pageTitle 매칭** (높은 점수)
3. **description 매칭** (중간 점수)
4. **keywords 매칭** (낮은 점수)

---

## 🔄 개선 히스토리

### v0.1.0 (2026-02-20 초기)
- 화면 ID 직접 검색
- 단일 프로젝트/버전 검색

### v0.2.0 (2026-02-20) ⭐ **현재**
- **Description 필드 추가**
  - 필드 상세 내용 저장
  - "네트워크 선택", "사용 유형" 등 필드명으로 검색 가능
  
- **전체 프로젝트 검색 지원**
  - 프로젝트/버전 미지정 시 모든 프로젝트 검색
  - 결과를 프로젝트/버전별로 그룹화하여 제시
  
- **선택지 제공 UI 개선**
  - 프로젝트 → 버전 → 화면 계층 구조로 표시
  - 사용자가 범위를 좁혀갈 수 있도록 안내

### v0.3.0 (2026-02-20) ⭐ **NEW - Figma API Fallback**
- **실시간 Figma 검색**
  - metadata에 없는 화면을 Figma API에서 직접 검색
  - 최대 5개 결과 반환
  
- **자동 학습 (Auto-learning)**
  - 검색된 화면을 자동으로 metadata에 추가
  - 다음번에는 더 빠르게 검색 가능
  
- **Fallback 플로우**
  ```
  1. metadata 검색 → 결과 0개
  2. Figma API 실시간 검색
  3. 결과 발견 → 사용자에게 표시
  4. metadata에 자동 저장 (학습)
  5. 다음 검색부터는 metadata에서 즉시 조회
  ```

---

## 🚀 향후 개선 계획

### ✅ Phase 3 (완료)
- ✅ **Figma API Fallback + 자동 학습**
  - metadata에 없는 화면은 실시간 Figma API 검색
  - 검색 결과를 metadata에 자동 추가 (자동 학습)
  - 다음 검색부터 빠른 응답 보장

### 📋 Phase 4 (예정)
- **대화형 검색**
  - "프로젝트를 선택하세요" → 사용자 입력 → 버전 선택 → 화면 선택
  
- **검색 히스토리**
  - 최근 검색한 화면 저장
  - "최근에 본 화면 다시 보기"

- **관련 화면 추천**
  - "이 화면과 관련된 다른 화면: ..."
  - 같은 메뉴/기능의 다른 스텝 자동 추천

- **Confluence 및 퍼블리셔 레포 통합**
  - Figma 외 다른 소스에서도 검색 가능하도록 확장

---

## 📝 예제 질의 패턴

### ✅ 지원되는 패턴
```
1. "CONT-03_01_16 보여줘"
2. "콘트라베이스 3.0.6 인스턴스 생성"
3. "인스턴스 생성 페이지 기획 찾아줘"
4. "콘트라베이스 인스턴스 생성 네트워크 선택"
5. "3.0.6 로드밸런서 모니터링"
```

### ⚠️ 주의사항
- 너무 일반적인 키워드는 많은 결과 반환
  - 예: "버튼" → 거의 모든 화면에 버튼이 있음
  - 해결: 더 구체적인 키워드 요청 ("취소 버튼" → "버튼")

---

## 🔧 디버깅

### 검색 결과가 없을 때
```
1. metadata 확인
   - pageTitle이 "Unknown"인지 확인
   - description이 비어있는지 확인
   
2. 키워드 확인
   - 오타가 있는지 (예: "인스탄스" → "인스턴스")
   - 동의어 처리 필요 (예: "VM" ↔ "인스턴스")
   
3. metadata 재수집
   npm run collect-metadata
```

### 너무 많은 결과가 나올 때
```
1. 프로젝트/버전 명시 요청
2. 더 구체적인 키워드 요청
3. 화면 ID 제공 요청
```

---

## 📚 관련 파일

- `src/tools/search-figma-spec.ts` - 검색 진입점
- `src/services/search.ts` - 검색 로직
- `src/scripts/collect-metadata.ts` - 메타데이터 수집
- `data/screen-index.json` - 검색 대상 데이터
