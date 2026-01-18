# Figma Personal Access Token 발급 방법

## 1. Figma 웹사이트 접속
https://www.figma.com/

## 2. 로그인
회사 이메일 계정으로 로그인

## 3. Settings 이동
우측 상단 프로필 → Settings

## 4. Personal Access Tokens 섹션
좌측 메뉴에서 "Personal access tokens" 선택

## 5. Token 생성
- "Generate new token" 클릭
- Token 이름: "MCP Test" (원하는 이름)
- Scopes 필요:
  - ✅ File content (read)
  - ✅ Read comments
  - ✅ Read file and project info
  
## 6. Token 복사
생성된 토큰을 안전한 곳에 복사 (다시 볼 수 없음!)

## 7. 환경변수에 저장
```bash
export FIGMA_TOKEN="figd_여기에_토큰_붙여넣기"
```

또는 `.env` 파일에:
```
FIGMA_TOKEN=figd_여기에_토큰_붙여넣기
```

## 참고
- Token은 한 번만 표시되므로 반드시 저장하세요
- 권한: 읽기 전용이므로 안전합니다
- 만료: 기본적으로 만료되지 않지만, 언제든 삭제 가능
