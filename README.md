# oke-front-mcp

**프론트엔드 개발 통합 MCP 서버**

Figma 기획서를 Cursor에서 자연어로 검색하는 MCP 서버입니다.

---

## 🎯 주요 기능

- ✅ **화면 ID 직접 조회**: `CONT-05_04_54 보여줘`
- ✅ **자연어 검색**: `콘트라베이스 3.0.6 로드밸런서 모니터링`
- ✅ **자동 후보 제시**: 여러 결과가 있을 때 후보 목록 표시 (프로젝트/버전별 그룹화)
- ✅ **경량화된 메타데이터 수집**: 5-10분 만에 3,000+ 화면 수집 (기존 30분+)
- ✅ **지연 로딩 (Lazy Loading)**: 검색 시 필요한 상세 정보만 조회
- ✅ **Figma API Fallback**: 메타데이터에 없는 최신 화면도 실시간 검색
- ✅ **자동 학습**: 한 번 찾은 화면은 다음부터 빠르게 검색

---

## 🚀 빠른 시작

### 1. 설치

```bash
# 저장소 클론
git clone <repository-url>
cd oke-front-mcp

# 의존성 설치 및 빌드
npm install
npm run build
```

### 2. Figma Token 발급

1. https://www.figma.com/ 로그인
2. Settings → Personal access tokens
3. "Generate new token" (Scopes: File content, Read comments, Read file/project info)
4. 토큰 복사

### 3. Cursor 연동

`~/.cursor/mcp.json` 파일에 추가:

**✅ 모든 환경변수는 Cursor settings에서만 관리합니다.**  
**❌ `.env` 파일은 사용하지 않습니다!**

```json
{
  "mcpServers": {
    "oke-front-mcp": {
      "command": "node",
      "args": ["/Users/당신의사용자명/Desktop/oke-front-mcp/dist/index.js"],
      "env": {
        "FIGMA_TOKEN": "여기에_발급받은_토큰",
        "FIGMA_TEAM_ID": "1498602828936104321",
        "DEFAULT_PROJECT": "CONTRABASS",
        "DEFAULT_VERSION": "3.0.6",
        "SUPPORTED_PROJECTS": "CONTRABASS,ACI,VIOLA"
      }
    }
  }
}
```

⚠️ **반드시 수정**:
- 경로: 실제 클론한 위치로 변경
- `FIGMA_TOKEN`: 발급받은 토큰으로 교체

### 4. 메타데이터 수집

**경량화된 수집 (Phase 4):**
- screenId, pageTitle만 빠르게 수집
- 상세 정보(description)는 실제 검색 시 자동 수집 (지연 로딩)
- 수집 시간: 5-10분 (기존 30분+ → 6배 빠름!)

```bash
npm run collect-metadata
```

### 4. Cursor 재시작 후 사용

**✨ Cursor가 MCP 서버를 자동으로 실행합니다!**

터미널에서 `npm start`를 실행할 필요가 없습니다. 그냥 Cursor에서 바로 사용하세요:

```
@oke-front-mcp CONT-05_04_54 보여줘
@oke-front-mcp 콘트라베이스 3.0.6 로드밸런서 모니터링
```

---

## 💡 사용 시나리오

### 일반적인 사용 (매일)
```
1. 컴퓨터 켜기
2. Cursor IDE 실행
3. 아무 프로젝트나 열기
4. "@oke-front-mcp 질문" 입력
   
→ 끝! 터미널 명령어 필요 없음
```

### 언제 터미널을 사용하나?
```bash
# 1. 최초 설치 시 (딱 한 번)
npm install
npm run build

# 2. MCP 코드를 수정했을 때
npm run build
# → Cursor 재시작

# 3. Figma 기획서가 업데이트되었을 때
npm run collect-metadata
```

---

## 📖 문서

- **[설치 및 사용 가이드](./SETUP_GUIDE.md)** - 자세한 설치 방법 및 사용법
- **[개발 문서](./DEVELOPMENT.md)** - 개발 진행 상황 및 기술 세부사항

---

## 🛠️ 명령어

### 일상적인 사용 (항상)
```
@oke-front-mcp 질문 입력
```
**✨ MCP 서버는 Cursor가 자동으로 실행합니다!**  
**터미널에서 별도로 서버를 실행할 필요가 없습니다.**

### 필요한 경우에만
```bash
# 최초 설치 시 (딱 1번)
npm install
npm run build

# 코드 수정 시
npm run build

# Figma 기획서 업데이트 시 (가끔)
npm run collect-metadata
```

### 개발자용
```bash
# 개발 모드 (watch) - MCP 개발 시에만
npm run dev

# 수동 서버 실행 - 디버깅용
npm start
```

---

## 📊 현재 상태

- ✅ **Phase 1**: Figma 연동 (화면 ID 직접 조회)
- ✅ **Phase 2**: 자연어 검색 (메타데이터 인덱싱)
- ✅ **Phase 2.5**: 그룹화된 검색 결과 (프로젝트/버전별)
- ✅ **Phase 3**: Figma API Fallback + 자동 학습
- ✅ **Phase 4**: 경량화된 수집 + 지연 로딩
- 🔜 **Phase 5**: 퍼블리셔 레포 연동
- 🔜 **Phase 6**: Confluence + Ant Vue 연동

---

## 🎯 사용 예시

### 화면 ID로 검색

```
@oke-front-mcp CONT-05_04_54 보여줘
```

**결과**:
```
📋 CONT-05_04_54 - 로드밸런서_상세 (모니터링)

✓ 프로젝트: CONTRABASS
✓ 버전: 3.0.6
✓ 담당: 김가영2, 김소영

📝 기능 설명:
   • 로드밸런서 상세 정보 추가
   • 새 탭 추가: 기본 정보 + 모니터링
   ...
```

### 자연어로 검색

```
@oke-front-mcp 콘트라베이스 3.0.6 로드밸런서 모니터링
```

**1개 결과 시**:
- 자동으로 상세 정보 표시

**여러 개 결과 시**:
- 후보 목록 제시 (점수 순 정렬)

---

## 🔄 메타데이터 갱신

Figma 기획서가 변경되면 메타데이터를 다시 수집하세요:

```bash
npm run collect-metadata
```

**Phase 4 경량화 적용:**
- **수집 시간**: 5-10분 (기존 30분+ → 6배 빠름!)
- **수집 내용**: screenId, pageTitle만 수집
- **상세 정보**: 실제 검색 시 자동으로 수집 (지연 로딩)

**권장 주기**: 주 1회 또는 배포 전

💡 **Tip**: 자동 학습 + 지연 로딩 덕분에 자주 수집하지 않아도 괜찮습니다!

---

## ❓ 문제 해결

### MCP가 작동하지 않음

1. Node.js 버전 확인 (18 이상 필요)
   ```bash
   node --version
   ```

2. 빌드 확인
   ```bash
   npm run build
   ```

3. Cursor 설정 파일 확인
   - 경로가 정확한지
   - `FIGMA_TOKEN`이 입력되었는지

4. Cursor 완전 재시작
   ```bash
   killall Cursor && open -a Cursor
   ```

### 검색 결과가 없음

1. 메타데이터 수집 여부 확인
   ```bash
   ls -la data/screen-index.json
   ```

2. 메타데이터 재수집
   ```bash
   npm run collect-metadata
   ```

3. 다른 키워드로 재검색

---

## 🤝 기여

### 버그 제보
팀 채널에 문의하거나 이슈를 생성해주세요.

---

## 📄 라이선스

MIT License

---

## 👥 팀

**Okestro Frontend Team**

- 기획: Figma
- 퍼블: Bitbucket (okestrolab/okestro-ui)
- 디자인 시스템: Confluence
- UI 컴포넌트: Ant Design Vue

---

**버전**: 0.3.0  
**최종 업데이트**: 2026-02-20  
**상태**: Phase 4 완료 (경량화된 수집 + 지연 로딩)
