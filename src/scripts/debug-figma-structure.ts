/**
 * Figma 파일 구조 디버깅 스크립트
 * 
 * 실제 파일 구조를 출력하여 화면 ID가 어디에 있는지 확인
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
 * 노드 구조를 재귀적으로 출력
 */
function printNodeStructure(node: FigmaNode, depth: number = 0): void {
  const indent = '  '.repeat(depth);
  const name = node.name || 'Unnamed';
  const type = node.type;
  const id = node.id?.substring(0, 10) || 'no-id';
  
  console.log(`${indent}[${type}] ${name} (${id}...)`);
  
  // Description이 있으면 출력
  if ('description' in node && node.description && typeof node.description === 'string') {
    const desc = node.description.substring(0, 100);
    console.log(`${indent}  📝 Description: ${desc}${node.description.length > 100 ? '...' : ''}`);
  }
  
  // 자식 노드 재귀 출력 (깊이 제한)
  if (depth < 4 && 'children' in node && Array.isArray(node.children)) {
    (node.children as FigmaNode[]).forEach(child => {
      printNodeStructure(child, depth + 1);
    });
  } else if (depth === 4 && 'children' in node && Array.isArray(node.children)) {
    const childCount = (node.children as FigmaNode[]).length;
    console.log(`${indent}  ... (${childCount} children, depth limit reached)`);
  }
}

async function main() {
  console.log('🔍 Figma 파일 구조 디버깅\n');

  if (!process.env.FIGMA_TOKEN || !process.env.FIGMA_TEAM_ID) {
    console.error('❌ FIGMA_TOKEN 또는 FIGMA_TEAM_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  const figmaService = new FigmaService(
    process.env.FIGMA_TOKEN,
    process.env.FIGMA_TEAM_ID
  );

  const projectName = process.env.DEFAULT_PROJECT || 'CONTRABASS';
  console.log(`📂 프로젝트: ${projectName}\n`);

  try {
    // 프로젝트 찾기
    const project = await figmaService.findProjectByName(projectName);
    if (!project) {
      console.error(`❌ 프로젝트 "${projectName}"를 찾을 수 없습니다.`);
      process.exit(1);
    }

    console.log(`✓ 프로젝트 ID: ${project.id}\n`);

    // 파일 목록 가져오기
    const files = await figmaService.getProjectFiles(project.id);
    console.log(`✓ 파일 개수: ${files.length}\n`);

    // 첫 번째 접근 가능한 파일 찾기
    for (const file of files) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 파일: ${file.name}`);
      console.log(`   Key: ${file.key}`);
      console.log(`${'='.repeat(80)}\n`);

      try {
        // 파일 내용 가져오기 (depth=5)
        const fileContent = await figmaService.getFileContent(file.key, undefined, 5);
        
        if (!fileContent?.document) {
          console.log('❌ 파일 내용 없음\n');
          continue;
        }

        console.log('✅ 파일 접근 성공!\n');
        console.log('📊 파일 구조:\n');
        
        // 구조 출력
        printNodeStructure(fileContent.document);
        
        console.log('\n✅ 첫 번째 접근 가능한 파일을 출력했습니다.');
        console.log('\n💡 화면 ID (예: CONT-05_04_54)가 어디에 있는지 확인하세요:');
        console.log('   - Page 이름에?');
        console.log('   - Frame 이름에?');
        console.log('   - Description에?');
        
        break; // 첫 번째 성공한 파일만 출력

      } catch (error) {
        console.error(`❌ 오류: ${error instanceof Error ? error.message : error}\n`);
        continue;
      }
    }

  } catch (error) {
    console.error('❌ 실행 오류:', error);
    process.exit(1);
  }
}

main().catch(console.error);
