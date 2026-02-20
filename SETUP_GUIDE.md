# oke-front-mcp 설치 및 사용 가이드

**최종 업데이트**: 2026-02-20  
**소요 시간**: 약 10분

---

## 📋 목차

1. [사전 준비](#1-사전-준비)
2. [Figma Token 발급](#2-figma-token-발급)
3. [MCP 설치](#3-mcp-설치)
4. [Cursor 연동](#4-cursor-연동)
5. [메타데이터 수집](#5-메타데이터-수집)
6. [사용 방법](#6-사용-방법)
7. [문제 해결](#7-문제-해결)

---

## 1. 사전 준비

### 필수 요구사항

- ✅ **Node.js 18 이상** 설치
- ✅ **Cursor IDE** 설치
- ✅ **Figma 계정** (회사 이메일)

### Node.js 버전 확인

```bash
node --version
# v18.0.0 이상이어야 함
```

18 미만이면 [nodejs.org](https://nodejs.org)에서 최신 LTS 버전 설치

---

## 2. Figma Token 발급

### 2-1. Figma 웹사이트 접속

https://www.figma.com/ → 회사 이메일로 로그인

### 2-2. Settings 이동

우측 상단 프로필 아이콘 → **Settings** 클릭

### 2-3. Personal Access Token 생성

1. 좌측 메뉴에서 **"Personal access tokens"** 선택
2. **"Generate new token"** 클릭
3. Token 이름 입력: `MCP` (또는 원하는 이름)
4. **Scopes 선택**:
   - ✅ File content (read)
   - ✅ Read comments  
   - ✅ Read file and project info
5. **"Generate token"** 클릭

### 2-4. Token 복사

⚠️ **중요**: 생성된 토큰을 복사해서 안전한 곳에 저장하세요. (다시 볼 수 없습니다!)

```
예시: figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. MCP 설치

### 3-1. 저장소 클론

```bash
# 원하는 위치로 이동 (예: Desktop)
cd ~/Desktop

# Git 클론
git clone <repository-url>
cd oke-front-mcp
```

### 3-2. 의존성 설치

```bash
npm install
```

### 3-3. 빌드

```bash
npm run build
```

✅ `dist/` 폴더가 생성되면 성공!

---

## 4. Cursor 연동

### 4-1. Cursor MCP 설정 파일 열기

**macOS**:
```
Cmd + Shift + P → "Preferences: Open User Settings (JSON)"
```

**또는 직접 열기**:
```
~/.cursor/config.json
```

### 4-2. MCP 서버 추가

파일에 다음 내용을 추가하세요:

```json
{
  "mcpServers": {
    "oke-front-mcp": {
      "command": "node",
      "args": [
        "/Users/당신의사용자명/Desktop/oke-front-mcp/dist/index.js"
      ],
      "env": {
        "FIGMA_TOKEN": "여기에_발급받은_Figma_Token_입력",
        "FIGMA_TEAM_ID": "1498602828936104321",
        "DEFAULT_PROJECT": "CONTRABASS",
        "DEFAULT_VERSION": "3.0.6",
        "SUPPORTED_PROJECTS": "CONTRABASS,ACI,VIOLA"
      }
    }
  }
}
```

⚠️ **반드시 수정할 항목**:
1. **경로**: `/Users/당신의사용자명/Desktop/oke-front-mcp/dist/index.js`
   - `당신의사용자명`을 실제 사용자명으로 변경
   - 클론한 경로가 다르면 해당 경로로 수정

2. **FIGMA_TOKEN**: 2단계에서 발급받은 토큰으로 교체

### 4-3. Cursor 재시작

Cursor를 **완전히 종료**하고 다시 시작합니다.

```bash
# macOS
killall Cursor
open -a Cursor
```

---

## 5. 메타데이터 수집

Figma에서 모든 화면 정보를 수집합니다. (최초 1회 + 기획서 변경 시)

**✅ Phase 4: 경량화된 수집 전략**
- **수집 내용**: screenId, pageTitle만 빠르게 수집
- **수집 시간**: 5-10분 (기존 30분+ → **6배 빠름!**)
- **상세 정보**: 실제 검색 시 자동으로 수집 (지연 로딩)
- **환경변수**: Cursor settings(4-2단계)에서 자동으로 읽어옴

### 5-1. 수집 스크립트 실행

```bash
cd /Users/당신의사용자명/Desktop/oke-front-mcp
npm run collect-metadata
```

### 5-2. 진행 상황 확인

```
🚀 메타데이터 수집 시작...

📋 수집 대상 프로젝트: CONTRABASS, ACI, VIOLA

📂 프로젝트: CONTRABASS
   ✓ 프로젝트 ID: xxx
   ✓ 파일 개수: 5

   📄 파일: [Roadmap][3.0.5][3.0.6] CONTRABASS
      버전: 3.0.6
      ✓ 화면 개수: 194
         • CONT-05_04_54: 로드밸런서_상세 (모니터링)
         • CONT-05_04_01: 로드밸런서_목록
         ...

✅ 메타데이터 수집 완료! 총 3005개 화면
💾 저장 경로: data/screen-index.json
```

⏱️ **소요 시간**: 5-10분 (프로젝트 크기에 따라)

💡 **Phase 4 최적화:**
- description은 비어있는 상태로 저장됩니다
- 실제 검색 시 필요한 경우에만 자동으로 수집됩니다 (지연 로딩)
- 한 번 수집된 정보는 metadata에 저장되어 다음부터 빠르게 표시됩니다

---

## 6. 사용 방법

### ✨ 중요: MCP 서버는 자동으로 실행됩니다!

**터미널에서 `npm start`를 실행할 필요가 없습니다.**

Cursor가 `@oke-front-mcp`를 감지하면 자동으로:
1. `~/.cursor/mcp.json` 설정 읽기
2. `node dist/index.js` 백그라운드 실행
3. 환경변수 자동 주입 (FIGMA_TOKEN 등)
4. MCP 서버와 통신

---

### 일상적인 사용 시나리오

```
1. 컴퓨터 켜기 💻
2. Cursor 실행
3. 아무 프로젝트나 열기
4. Cursor 채팅창에서:
   
   "@oke-front-mcp 콘트라베이스 3.0.6 인스턴스 생성"
   
→ 끝! MCP가 자동으로 작동합니다.
```

**✅ 매번 터미널 명령어를 실행할 필요가 없습니다!**

---

### 6-1. 화면 ID로 검색 (정확한 ID를 아는 경우)

```
@oke-front-mcp CONT-05_04_54 보여줘
```

**결과**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONT-05_04_54 - 로드밸런서_상세 (모니터링)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 프로젝트: CONTRABASS
✓ 버전: 3.0.6
✓ 담당: 김가영2, 김소영
✓ Figma 파일: [Roadmap][3.0.5][3.0.6] CONTRABASS

📝 기능 설명:
   • 로드밸런서 상세 정보 추가
   • 새 탭 추가: 기본 정보 + 모니터링
   ...
```

---

### 6-2. 자연어로 검색 (ID를 모르는 경우)

```
@oke-front-mcp 콘트라베이스 3.0.6 로드밸런서 모니터링
```

**1개 결과 → 자동 확정**:
```
✅ 1개의 화면을 찾았습니다 (자동 확정)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONT-05_04_54 - 로드밸런서_상세 (모니터링)
...
```

**여러 개 결과 → 후보 제시 (프로젝트/버전별 그룹화)**:
```
🔍 "로드밸런서"로 여러 화면을 찾았습니다:

📦 프로젝트: CONTRABASS
  📌 버전: 3.0.6
    1. CONT-05_04_54 - 로드밸런서_상세 (모니터링) ⭐⭐⭐
       담당: 김가영2, 김소영
       
    2. CONT-05_04_01 - 로드밸런서_목록 ⭐⭐
       담당: 김소영
       
  📌 버전: 3.0.5
    3. CONT-05_03_12 - 로드밸런서_생성 ⭐
       담당: 박기획

💡 원하는 화면 ID로 다시 검색하세요.
```

**메타데이터에 없는 경우 → 실시간 Figma API 검색 + 자동 학습**:
```
🔍 메타데이터에 "새로운 기능" 검색 결과 없음. 
   Figma API로 실시간 검색 시도...

✅ Figma API에서 1개의 화면을 찾았습니다!
🎓 메타데이터에 자동 추가 완료

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CONT-06_01_23 - 새로운_기능_추가
...

💡 다음부터는 더 빠르게 검색됩니다!
```

---

### 6-3. 검색 팁

#### ✅ 좋은 예시
```
@oke-front-mcp 콘트라베이스 3.0.6 클라우드 뷰 인스턴스 복제
@oke-front-mcp ACI 3.0.5 호스트 그룹 생성
@oke-front-mcp CONT-05_04_54
```

#### ❌ 나쁜 예시
```
@oke-front-mcp 화면              # 너무 모호함
@oke-front-mcp 인스턴스          # 프로젝트/버전 미지정
```

---

## 7. 문제 해결

### 🔴 "Unknown tool: search_figma_spec" 오류

**원인**: MCP 서버가 시작되지 않음

**해결**:
1. Cursor 설정 파일 경로 확인
2. `FIGMA_TOKEN`이 올바르게 입력되었는지 확인
3. Cursor 재시작

```bash
# 수동으로 서버 실행하여 오류 확인
cd /Users/당신의사용자명/Desktop/oke-front-mcp
node dist/index.js
```

---

### 🔴 "메타데이터 인덱스를 찾을 수 없습니다"

**원인**: `data/screen-index.json` 파일이 없음

**해결**:
```bash
npm run collect-metadata
```

---

### 🔴 "FIGMA_TOKEN 환경변수가 설정되지 않았습니다"

**원인**: Cursor 설정에서 `FIGMA_TOKEN`이 누락되었거나 잘못됨

**해결**:
1. `~/.cursor/config.json` 파일 확인
2. `FIGMA_TOKEN` 값 확인 (따옴표 안에 토큰 입력)
3. Cursor 재시작

---

### 🔴 검색 결과가 없음

**원인**:
- 키워드가 정확하지 않음
- 프로젝트/버전이 잘못됨
- 메타데이터가 오래됨

**해결**:
1. 다른 키워드로 검색
2. 프로젝트/버전 확인
3. 메타데이터 재수집:
   ```bash
   npm run collect-metadata
   ```

---

### 🔴 Node.js 버전 오류

**원인**: Node.js 18 미만

**해결**:
```bash
node --version  # 버전 확인

# 18 미만이면 업데이트
# https://nodejs.org 에서 LTS 버전 다운로드
```

---

## 🔄 메타데이터 갱신 주기

Figma 기획서가 업데이트되면 메타데이터를 다시 수집해야 합니다.

**Phase 4 "경량화 + 지연 로딩" 적용:**
- ✅ **수집 시간 6배 빠름** (30분+ → 5-10분)
- ✅ **필수 정보만 수집** (screenId, pageTitle)
- ✅ **상세 정보는 검색 시 자동 수집** (지연 로딩)
- ✅ **자동 학습으로 점점 똑똑해짐**

**권장 갱신 주기**: 
- 📅 **주 1회** (일반적인 경우) ← 권장!
- 📅 **배포 전** (필수)
- 📅 ~~매일 아침 1회~~ (경량화 + 지연 로딩 덕분에 불필요)

```bash
npm run collect-metadata
```

💡 **Tip**: 
- 첫 수집: 5-10분 소요, 3,000+ 화면 수집
- 검색 시: 필요한 상세 정보만 자동으로 1-2초 내 조회
- 재검색: 이미 조회한 화면은 즉시 표시 (0.1초)

---

## ✅ 설치 완료 체크리스트

- [ ] Node.js 18 이상 설치 확인
- [ ] Figma Token 발급
- [ ] Git 클론 및 `npm install` 완료
- [ ] `npm run build` 성공
- [ ] Cursor 설정 파일에 MCP 서버 추가
- [ ] `FIGMA_TOKEN` 입력
- [ ] 경로 수정 (`/Users/당신의사용자명/...`)
- [ ] Cursor 재시작
- [ ] `npm run collect-metadata` 실행
- [ ] Cursor에서 `@oke-front-mcp CONT-05_04_54 보여줘` 테스트 성공

---

## 🎉 완료!

이제 Cursor에서 자연어로 Figma 기획서를 검색할 수 있습니다!

### 💻 일상적인 사용
```
1. 컴퓨터 켜기
2. Cursor 실행
3. 아무 프로젝트나 열기
4. "@oke-front-mcp 질문" 입력

→ MCP가 자동으로 작동합니다!
```

### 🎯 사용 예시
```
@oke-front-mcp 콘트라베이스 3.0.6 로드밸런서 모니터링
@oke-front-mcp CONT-05_04_54 보여줘
@oke-front-mcp 인스턴스 생성 페이지 네트워크 선택 기획
```

### ⚡ 언제 터미널을 사용하나?
```bash
# 1. 최초 설치 시 (딱 한 번)
npm install && npm run build

# 2. MCP 코드 수정 시
npm run build
# → Cursor 재시작

# 3. Figma 기획서 대량 업데이트 시 (가끔)
npm run collect-metadata
```

**✨ 일상적인 MCP 사용에는 터미널 명령어가 필요 없습니다!**

**문의사항**: 팀 채널에 문의해주세요.

---

**작성**: Okestro Frontend Team  
**버전**: 0.2.0  
**최종 업데이트**: 2026-02-20
