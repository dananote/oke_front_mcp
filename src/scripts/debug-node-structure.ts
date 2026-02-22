/**
 * Figma 노드 구조 디버깅 스크립트
 * 
 * 특정 화면의 전체 노드 트리를 출력하여 Page Title이 어디에 있는지 확인
 */

import { FigmaService, FigmaNode } from '../services/figma.js';
import { readFileSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

/**
 * Cursor mcp.json에서 환경변수 로드
 */
function loadEnvFromCursorSettings(): void {
  try {
    const mcpConfigPath = path.join(homedir(), '.cursor', 'mcp.json');
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
    
    const okeFrontMcpConfig = mcpConfig.mcpServers?.['oke-front-mcp'];
    if (okeFrontMcpConfig?.env) {
      Object.entries(okeFrontMcpConfig.env).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value as string;
        }
      });
      console.log('✅ Cursor settings에서 환경변수를 로드했습니다.\n');
    }
  } catch (error) {
    console.warn('⚠️ Cursor settings 로드 실패. 시스템 환경변수를 사용합니다.');
  }
}

loadEnvFromCursorSettings();

/**
 * 노드 트리 출력 (들여쓰기 포함)
 */
function printNodeTree(node: FigmaNode, indent: number = 0): void {
  const prefix = '  '.repeat(indent);
  
  // 노드 기본 정보
  console.log(`${prefix}├─ [${node.type}] ${node.name || '(unnamed)'}`);
  
  // TEXT 노드면 내용도 출력
  if (node.type === 'TEXT' && node.characters) {
    const preview = node.characters.length > 50 
      ? node.characters.substring(0, 50) + '...'
      : node.characters;
    console.log(`${prefix}   └─ 내용: "${preview}"`);
  }
  
  // 자식 노드 재귀 출력
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      printNodeTree(child, indent + 1);
    }
  }
}

/**
 * 화면 ID가 포함된 프레임 찾기
 */
function findScreenFrame(node: FigmaNode, screenId: string): FigmaNode | null {
  const screenIdPattern = /^([A-Z]+-\d{2}_\d{2}_\d{2})/;
  const match = node.name?.match(screenIdPattern);
  
  if (match && match[1] === screenId) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const found = findScreenFrame(child, screenId);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * 메인 실행
 */
async function main() {
  const screenId = process.argv[2] || 'CONT-01_01_02';
  
  console.log(`🔍 화면 ID: ${screenId} 노드 구조 분석...\n`);

  if (!process.env.FIGMA_TOKEN || !process.env.FIGMA_TEAM_ID) {
    console.error('❌ FIGMA_TOKEN 또는 FIGMA_TEAM_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  const figmaService = new FigmaService(
    process.env.FIGMA_TOKEN,
    process.env.FIGMA_TEAM_ID
  );

  try {
    // CONTRABASS 프로젝트 찾기
    const project = await figmaService.findProjectByName('CONTRABASS');
    if (!project) {
      console.error('❌ CONTRABASS 프로젝트를 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log(`✓ 프로젝트 ID: ${project.id}`);

    // 3.0.6 버전 파일 찾기
    const files = await figmaService.getProjectFiles(project.id);
    const targetFile = files.find(f => f.name.includes('3.0.6'));
    
    if (!targetFile) {
      console.error('❌ 3.0.6 버전 파일을 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log(`✓ 파일: ${targetFile.name}`);
    console.log(`✓ 파일 키: ${targetFile.key}`);
    console.log('\n⏳ 파일 내용 로딩 중... (depth=5로 상세 분석)\n');

    // depth를 5로 높여서 더 깊게 분석
    const fileContent = await figmaService.getFileContent(targetFile.key, undefined, 5);
    
    if (!fileContent?.document) {
      console.error('❌ 파일 내용 없음');
      process.exit(1);
    }

    // 해당 화면 프레임 찾기
    const screenFrame = findScreenFrame(fileContent.document, screenId);
    
    if (!screenFrame) {
      console.error(`❌ 화면 ID "${screenId}"를 찾을 수 없습니다.`);
      process.exit(1);
    }

    console.log(`✅ 화면 프레임 발견!`);
    console.log(`   Frame ID: ${screenFrame.id}`);
    console.log(`   Frame 이름: ${screenFrame.name}\n`);
    console.log('📊 노드 트리 구조:\n');
    
    printNodeTree(screenFrame);

    console.log('\n\n🔍 TEXT 노드 목록 (순서대로):\n');
    
    const textNodes: Array<{name: string; characters: string}> = [];
    const collectTextNodes = (node: FigmaNode): void => {
      if (node.type === 'TEXT' && node.characters) {
        textNodes.push({
          name: node.name || '(unnamed)',
          characters: node.characters
        });
      }
      if (node.children) {
        for (const child of node.children) {
          collectTextNodes(child);
        }
      }
    };
    
    collectTextNodes(screenFrame);
    
    textNodes.forEach((tn, idx) => {
      const preview = tn.characters.length > 100 
        ? tn.characters.substring(0, 100) + '...'
        : tn.characters;
      console.log(`${idx + 1}. [${tn.name}]: "${preview}"`);
    });

  } catch (error) {
    console.error('❌ 오류:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
