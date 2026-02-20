/**
 * 메타데이터 수집 스크립트
 * 
 * Figma의 모든 프로젝트/버전/화면 정보를 수집하여 screen-index.json 생성
 * 
 * 환경변수는 Cursor settings에서만 관리됩니다.
 * npm run collect-metadata를 실행하기 전에 환경변수를 전달해야 합니다.
 */

import { FigmaService, FigmaNode } from '../services/figma.js';
import fs from 'fs/promises';
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

// Cursor settings에서 환경변수 로드
loadEnvFromCursorSettings();

interface ScreenMetadata {
  screenId: string;
  pageTitle: string;
  description: string;  // 추가: 기획 상세 설명
  author: string;
  keywords: string[];
  project: string;
  version: string;
  fileKey: string;
  fileName: string;
  nodeId: string;
  lastModified: string;
}

interface MetadataIndex {
  version: string;
  lastUpdated: string;
  totalScreens: number;
  projects: {
    [projectName: string]: {
      versions: {
        [version: string]: {
          fileKey: string;
          fileName: string;
          screens: ScreenMetadata[];
        };
      };
    };
  };
}

/**
 * 텍스트에서 키워드 추출
 */
function extractKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[^\w가-힣\s]/g, ' ')
    .toLowerCase()
    .trim();
  
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  return Array.from(new Set(words));
}

/**
 * 화면 정보 추출 (경량화 버전)
 * 
 * screenId, pageTitle만 수집하고 description은 빈 값으로 초기화
 * description은 사용자가 실제로 검색할 때 지연 로딩으로 채워짐
 */
function extractScreenInfo(node: FigmaNode): Partial<ScreenMetadata> | null {
  if (node.type !== 'FRAME' && node.type !== 'SECTION') {
    return null;
  }

  // Frame 이름에서 화면 ID 패턴 찾기
  const screenIdPattern = /^([A-Z]+-\d{2}_\d{2}_\d{2})/;
  const match = node.name?.match(screenIdPattern);
  
  if (!match) {
    return null;
  }
  
  const screenId = match[1];

  if (!node.children) {
    return null;
  }

  /**
   * 특정 이름의 TEXT 노드 다음에 오는 내용을 찾는 함수
   */
  const findNextTextNode = (parent: FigmaNode, afterName: string): string | null => {
    let foundLabel = false;
    let foundContent = '';
    
    const traverse = (n: FigmaNode): void => {
      if (foundContent) return; // 이미 찾았으면 중단
      
      if (n.type === 'TEXT' && n.characters) {
        // 라벨을 찾았으면 플래그 설정
        if (n.name === afterName || n.characters === afterName) {
          foundLabel = true;
          return;
        }
        
        // 라벨 이후의 TEXT 노드면 내용 저장
        if (foundLabel && n.characters !== afterName) {
          foundContent = n.characters;
          return;
        }
      }
      
      // 자식 노드 재귀 탐색
      if (n.children) {
        for (const child of n.children) {
          if (foundContent) break; // 이미 찾았으면 중단
          traverse(child);
        }
      }
    };
    
    traverse(parent);
    return foundContent || null;
  };

  // Page Title 찾기 (간단하게)
  let pageTitle = 'Unknown';
  const pageTitleValue = findNextTextNode(node, 'Page Title');
  if (pageTitleValue && pageTitleValue !== 'Page Title') {
    pageTitle = pageTitleValue.trim();
  }

  // Author 찾기 (간단하게)
  let author = 'N/A';
  const authorValue = findNextTextNode(node, 'Author');
  if (authorValue && authorValue !== 'Author') {
    author = authorValue.trim();
  }

  // Description은 빈 값으로 초기화 (지연 로딩)
  const description = '';

  // 키워드: screenId + pageTitle만 사용 (description 제외)
  const keywords = extractKeywords(`${screenId} ${pageTitle}`);

  return {
    screenId,
    pageTitle,
    description,  // 빈 값으로 초기화
    author,
    keywords,
    nodeId: node.id,
  };
}

/**
 * 파일의 모든 화면 스캔
 */
function scanFile(document: FigmaNode): Partial<ScreenMetadata>[] {
  const screens: Partial<ScreenMetadata>[] = [];

  const traverse = (node: FigmaNode): void => {
    const screenInfo = extractScreenInfo(node);
    if (screenInfo) {
      screens.push(screenInfo);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(document);
  return screens;
}

/**
 * 프로젝트의 모든 화면 수집
 */
async function collectProjectScreens(
  figmaService: FigmaService,
  projectName: string
): Promise<MetadataIndex['projects'][string] | null> {
  try {
    console.log(`\n📂 프로젝트: ${projectName}`);
    
    const project = await figmaService.findProjectByName(projectName);
    if (!project) {
      console.log(`   ❌ 프로젝트를 찾을 수 없습니다.`);
      return null;
    }

    console.log(`   ✓ 프로젝트 ID: ${project.id}`);

    const files = await figmaService.getProjectFiles(project.id);
    console.log(`   ✓ 파일 개수: ${files.length}`);

    const versions: MetadataIndex['projects'][string]['versions'] = {};

    for (const file of files) {
      const versionMatch = file.name.match(/(\d+\.\d+\.\d+)/);
      if (!versionMatch) {
        console.log(`   ⊘ 버전 추출 실패: ${file.name}`);
        continue;
      }

      const version = versionMatch[1];
      console.log(`\n   📄 파일: ${file.name}`);
      console.log(`      버전: ${version}`);

      try {
        // depth를 3으로 낮춤 (경량화: screenId, pageTitle만 수집)
        const fileContent = await figmaService.getFileContent(file.key, undefined, 3);
        
        if (!fileContent?.document) {
          console.log(`      ❌ 파일 내용 없음`);
          continue;
        }

        const screens = scanFile(fileContent.document);
        console.log(`      ✓ 화면 개수: ${screens.length}`);

        const completeScreens: ScreenMetadata[] = screens.map(s => ({
          screenId: s.screenId!,
          pageTitle: s.pageTitle!,
          description: s.description || '',
          author: s.author!,
          keywords: s.keywords!,
          project: projectName,
          version,
          fileKey: file.key,
          fileName: file.name,
          nodeId: s.nodeId!,
          lastModified: file.lastModified,
        }));

        versions[version] = {
          fileKey: file.key,
          fileName: file.name,
          screens: completeScreens,
        };

        completeScreens.slice(0, 3).forEach(s => {
          console.log(`         • ${s.screenId}: ${s.pageTitle}`);
        });
        if (completeScreens.length > 3) {
          console.log(`         ... 외 ${completeScreens.length - 3}개`);
        }

      } catch (error) {
        console.error(`      ❌ 오류:`, error instanceof Error ? error.message : error);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { versions };

  } catch (error) {
    console.error(`❌ 프로젝트 수집 실패:`, error);
    return null;
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 메타데이터 수집 시작...\n');

  if (!process.env.FIGMA_TOKEN || !process.env.FIGMA_TEAM_ID) {
    console.error('❌ FIGMA_TOKEN 또는 FIGMA_TEAM_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  const figmaService = new FigmaService(
    process.env.FIGMA_TOKEN,
    process.env.FIGMA_TEAM_ID
  );

  const projects = (process.env.SUPPORTED_PROJECTS || 'CONTRABASS')
    .split(',')
    .map(p => p.trim());

  console.log(`📋 수집 대상 프로젝트: ${projects.join(', ')}\n`);

  const metadataIndex: MetadataIndex = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    totalScreens: 0,
    projects: {},
  };

  for (const projectName of projects) {
    const projectData = await collectProjectScreens(figmaService, projectName);
    
    if (projectData) {
      metadataIndex.projects[projectName] = projectData;
      
      Object.values(projectData.versions).forEach(versionData => {
        metadataIndex.totalScreens += versionData.screens.length;
      });
    }
  }

  const cacheDir = path.join(process.cwd(), 'data');
  await fs.mkdir(cacheDir, { recursive: true });

  const indexPath = path.join(cacheDir, 'screen-index.json');
  await fs.writeFile(indexPath, JSON.stringify(metadataIndex, null, 2), 'utf-8');

  console.log(`\n✅ 메타데이터 수집 완료!`);
  console.log(`\n📊 통계:`);
  console.log(`   • 프로젝트: ${Object.keys(metadataIndex.projects).length}개`);
  console.log(`   • 총 화면: ${metadataIndex.totalScreens}개`);
  console.log(`\n💾 저장 위치: ${indexPath}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
