/**
 * MCP 도구 정의 단일 소스
 * - index.ts의 ListToolsRequestSchema 응답
 * - mcp-descriptors/*.json (Cursor mcps 폴더 동기화용)
 * 에서 공통 사용.
 */

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; default?: string | number | boolean }>;
    required: string[];
  };
}

export const MCP_TOOLS_SCHEMA: McpToolSchema[] = [
  {
    name: 'search_figma_spec',
    description:
      'Figma 기획(화면 상세·스펙) 조회. "기획 찾아줘", "화면 기획 조회" 시 이 도구 사용. 화면 ID(예: CONT-05_04_54) 또는 자연어(예: 볼륨 생성)로 검색. 버전 미지정 시 후보 목록 반환.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색어: 화면 ID 또는 자연어 키워드 (예: 볼륨 생성 기획)',
        },
        project: {
          type: 'string',
          description: '프로젝트명 (기본값: CONTRABASS)',
          default: 'CONTRABASS',
        },
        version: {
          type: 'string',
          description: '버전 (예: 3.0.6). 미지정 시 후보 목록 반환',
        },
        autoConfirm: {
          type: 'boolean',
          description: '1개 결과만 매칭 시 자동 확정 (기본값: true)',
          default: true,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_publisher_code',
    description:
      '퍼블리셔 저장소(Vue/Sass)에서 화면·기능별 퍼블 코드 번들 검색. "퍼블 코드 찾아줘" 요청 시 사용. 기획 조회가 아님.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색어: 화면명/메뉴명/기능명 (예: "볼륨 수정", "리스너 생성")',
        },
        project: {
          type: 'string',
          description: '프로젝트명 (예: CONTRABASS, VIOLA)',
        },
        maxResults: {
          type: 'number',
          description: '최대 결과 개수 (기본값: 3)',
          default: 3,
        },
        refreshIndex: {
          type: 'boolean',
          description: 'publisher index를 강제로 재생성할지 여부',
          default: false,
        },
      },
      required: ['query'],
    },
  },
];
