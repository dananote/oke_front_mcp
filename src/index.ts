#!/usr/bin/env node

/**
 * oke-front-mcp
 * 프론트엔드 개발 통합 MCP 서버
 * 
 * Figma, 퍼블리셔 레포, Confluence, Ant Vue를 통합하여
 * Cursor AI가 자연어로 개발 리소스를 조회할 수 있게 합니다.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { FigmaService } from './services/figma.js';
import { PublisherService } from './services/publisher.js';
import { SearchService } from './services/search.js';
import { searchFigmaSpecTool } from './tools/search-figma-spec.js';
import { searchPublisherCodeTool } from './tools/search-publisher-code.js';
import { logMcpRequest } from './utils/mcp-request-logger.js';
import { MCP_TOOLS_SCHEMA } from './mcp-tools-schema.js';

// 환경변수 로드
dotenv.config();

/** ListTools 응답용: 스키마에서 도구 목록 생성 (project 기본값은 env 반영) */
function buildToolsList(): { name: string; description: string; inputSchema: object }[] {
  const defaultProject = process.env.DEFAULT_PROJECT || 'CONTRABASS';
  return MCP_TOOLS_SCHEMA.map((t) => {
    const inputSchema = JSON.parse(JSON.stringify(t.inputSchema)) as typeof t.inputSchema;
    if (inputSchema.properties?.project && typeof inputSchema.properties.project === 'object') {
      inputSchema.properties.project = { ...inputSchema.properties.project, default: defaultProject };
    }
    return { name: t.name, description: t.description, inputSchema };
  });
}

/**
 * MCP 서버 초기화
 */
class OkeFrontMCPServer {
  private server: Server;
  private figmaService: FigmaService;
  private publisherService: PublisherService;
  private searchService: SearchService;

  constructor() {
    this.server = new Server(
      {
        name: 'oke-front-mcp',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // 서비스 초기화
    this.figmaService = new FigmaService(
      process.env.FIGMA_TOKEN || '',
      process.env.FIGMA_TEAM_ID || ''
    );
    this.publisherService = new PublisherService();
    this.searchService = new SearchService();

    this.setupHandlers();
    this.setupErrorHandling();
  }

  /**
   * MCP 요청 핸들러 설정
   */
  private setupHandlers(): void {
    // Tools 목록 제공 (단일 소스: mcp-tools-schema.ts)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logMcpRequest('ListToolsRequestSchema (tools/list)', 'Cursor가 도구 목록 요청');
      return { tools: buildToolsList() };
    });

    // Tool 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logMcpRequest('CallToolRequestSchema (tools/call)', `Cursor가 도구 실행 요청 → name="${name}"`, { name, arguments: args });

      try {
        switch (name) {
          case 'search_figma_spec':
            return await searchFigmaSpecTool(this.figmaService, this.searchService, args);
          case 'search_publisher_code':
            return await searchPublisherCodeTool(this.publisherService, args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `❌ 오류 발생: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Resources 목록 제공
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logMcpRequest('ListResourcesRequestSchema (resources/list)', 'Cursor가 리소스 목록 요청');
      return {
      resources: [
        {
          uri: 'figma://screens',
          name: 'Figma 화면 목록',
          description: '프로젝트의 모든 화면 메타데이터',
          mimeType: 'application/json',
        },
        {
          uri: 'figma://stats',
          name: 'Figma 통계',
          description: '인덱스 통계 정보',
          mimeType: 'application/json',
        },
      ],
    };
    });

    // Resource 읽기
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logMcpRequest('ReadResourceRequestSchema (resources/read)', `Cursor가 리소스 내용 요청 → uri="${uri}"`, { uri });

      if (uri === 'figma://screens') {
        try {
          const stats = await this.searchService.getStats();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  error: '메타데이터 인덱스를 찾을 수 없습니다.',
                  message: 'collect-metadata 스크립트를 먼저 실행해주세요.',
                }),
              },
            ],
          };
        }
      }

      if (uri === 'figma://stats') {
        try {
          const stats = await this.searchService.getStats();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: 'Not available' }),
              },
            ],
          };
        }
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  /**
   * 에러 핸들링 설정
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 oke-front-mcp 서버 시작됨');
  }
}

/**
 * 메인 실행
 */
async function main() {
  // 환경변수 검증
  if (!process.env.FIGMA_TOKEN) {
    console.error('❌ FIGMA_TOKEN 환경변수가 설정되지 않았습니다.');
    console.error('📖 env.template 파일을 참고하여 .env 파일을 생성해주세요.');
    process.exit(1);
  }

  if (!process.env.FIGMA_TEAM_ID) {
    console.error('❌ FIGMA_TEAM_ID 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const server = new OkeFrontMCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
