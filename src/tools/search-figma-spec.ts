/**
 * search_figma_spec Tool
 * 
 * Figma 기획서를 검색하는 MCP Tool (Phase 2: 자연어 검색 지원)
 */

import { FigmaService } from '../services/figma.js';
import { SearchService } from '../services/search.js';

interface SearchFigmaSpecArgs {
  query: string;
  project?: string;
  version?: string;
  autoConfirm?: boolean;
}

/**
 * 화면 ID 패턴 감지 (CONT-05_04_54, ACI-01_02_03 등)
 */
function detectScreenId(query: string): string | null {
  const pattern = /([A-Z]+)-(\d{2})_(\d{2})_(\d{2})/;
  const match = query.match(pattern);
  return match ? match[0] : null;
}

/**
 * 프로젝트명 감지 (자연어 → 프로젝트 코드)
 */
function detectProject(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  const projectMap: { [key: string]: string } = {
    '콘트라베이스': 'CONTRABASS',
    'contrabass': 'CONTRABASS',
    'cont': 'CONTRABASS',
    'sds': 'SDS+',
    'sds플러스': 'SDS+',
    'viola': 'VIOLA',
    '비올라': 'VIOLA',
    'boot': 'Boot Factory',
    '부트': 'Boot Factory',
    'bootfactory': 'Boot Factory',
  };
  
  for (const [keyword, project] of Object.entries(projectMap)) {
    if (lowerQuery.includes(keyword)) {
      return project;
    }
  }
  
  return null;
}

/**
 * 버전 감지 (X.X.X 패턴)
 */
function detectVersion(query: string): string | null {
  const pattern = /(\d+\.\d+\.\d+)/;
  const match = query.match(pattern);
  return match ? match[1] : null;
}

/**
 * search_figma_spec Tool 실행
 */
export async function searchFigmaSpecTool(
  figmaService: FigmaService,
  searchService: SearchService,
  args: any
) {
  const {
    query,
    project: argProject,
    version: argVersion,
    autoConfirm = true,
  } = args as SearchFigmaSpecArgs;

  try {
    // 1. 화면 ID 패턴 감지
    const screenId = detectScreenId(query);

    if (screenId) {
      // 화면 ID가 명시된 경우: 직접 조회
      const project = argProject || detectProject(query) || process.env.DEFAULT_PROJECT || 'CONTRABASS';
      const version = argVersion || detectVersion(query) || process.env.DEFAULT_VERSION || '3.0.6';
      return await searchByScreenId(figmaService, screenId, project, version);
    }

    // 2. 프로젝트/버전 감지
    const detectedProject = argProject || detectProject(query);
    const detectedVersion = argVersion || detectVersion(query);

    // 3. 검색 전략 결정
    if (detectedProject && detectedVersion) {
      // 프로젝트/버전 모두 명시 → 해당 범위에서만 검색
      return await searchByNaturalLanguage(
        figmaService,
        searchService,
        query,
        detectedProject,
        detectedVersion,
        autoConfirm
      );
    } else if (detectedProject) {
      // 프로젝트만 명시 → 해당 프로젝트의 모든 버전 검색
      return await searchByProject(
        figmaService,
        searchService,
        query,
        detectedProject,
        autoConfirm
      );
    } else {
      // 프로젝트/버전 미지정 → 전체 검색 (그룹화)
      return await searchAllProjectsGrouped(
        figmaService,
        searchService,
        query,
        autoConfirm
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `❌ 검색 실패: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * 프로젝트 내 모든 버전 검색
 */
async function searchByProject(
  figmaService: FigmaService,
  searchService: SearchService,
  query: string,
  project: string,
  autoConfirm: boolean
) {
  const results = await searchService.search(query, project, undefined);

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `❌ "${query}"에 대한 검색 결과가 없습니다. (프로젝트: ${project})\n\n다른 키워드로 다시 시도해보세요.`,
      }],
    };
  }

  // 1개 결과만 있고 autoConfirm=true면 자동 확정
  if (results.length === 1 && autoConfirm) {
    const screen = results[0].screen;
    const description = await figmaService.getScreenDescription(screen.fileKey, screen.nodeId);
    
    return {
      content: [{
        type: 'text',
        text: `✅ 1개의 화면을 찾았습니다 (자동 확정)\n\n` +
              formatScreenResult(screen, description, screen.project, screen.version, screen.fileName),
      }],
    };
  }

  // 버전별로 그룹화
  const versionMap = new Map<string, any[]>();
  for (const result of results) {
    const version = result.screen.version;
    if (!versionMap.has(version)) {
      versionMap.set(version, []);
    }
    versionMap.get(version)!.push(result);
  }

  // 포맷팅
  let text = `🔍 "${query}"로 ${results.length}개의 화면을 찾았습니다 (${project}):\n\n`;
  
  let globalIndex = 1;
  for (const [version, versionResults] of versionMap.entries()) {
    text += `📌 버전 ${version}\n`;
    for (const result of versionResults) {
      const { screen } = result;
      text += `   ${globalIndex}. ${screen.screenId} - ${screen.pageTitle}\n`;
      globalIndex++;
    }
    text += '\n';
  }

  text += '어떤 화면을 보시겠습니까? (화면 ID 또는 번호로 선택)';

  return { content: [{ type: 'text', text }] };
}

/**
 * 전체 프로젝트 검색 (그룹화)
 */
async function searchAllProjectsGrouped(
  figmaService: FigmaService,
  searchService: SearchService,
  query: string,
  autoConfirm: boolean
) {
  const groupedResults = await searchService.searchGrouped(query);

  if (groupedResults.length === 0) {
    // ⭐ Fallback: Figma API 실시간 검색
    return await searchWithFallback(figmaService, searchService, query, autoConfirm);
  }

  // 전체 결과 개수 계산
  let totalCount = 0;
  for (const projectGroup of groupedResults) {
    for (const versionGroup of projectGroup.versions) {
      totalCount += versionGroup.screens.length;
    }
  }

  // 1개 결과만 있고 autoConfirm=true면 자동 확정
  if (totalCount === 1 && autoConfirm) {
    const screen = groupedResults[0].versions[0].screens[0].screen;
    const description = await figmaService.getScreenDescription(screen.fileKey, screen.nodeId);
    
    return {
      content: [{
        type: 'text',
        text: `✅ 1개의 화면을 찾았습니다 (자동 확정)\n\n` +
              formatScreenResult(screen, description, screen.project, screen.version, screen.fileName),
      }],
    };
  }

  // 그룹화된 결과 포맷팅
  let text = `🔍 "${query}"로 ${totalCount}개의 화면을 찾았습니다:\n\n`;
  
  let globalIndex = 1;
  for (const projectGroup of groupedResults) {
    text += `📂 ${projectGroup.project}\n`;
    
    for (const versionGroup of projectGroup.versions) {
      text += `   📌 버전 ${versionGroup.version}\n`;
      
      for (const result of versionGroup.screens) {
        const { screen } = result;
        text += `      ${globalIndex}. ${screen.screenId} - ${screen.pageTitle}\n`;
        globalIndex++;
      }
      text += '\n';
    }
  }

  text += `💡 프로젝트와 버전을 명시하면 더 정확한 결과를 얻을 수 있습니다.\n`;
  text += `   예: "콘트라베이스 3.0.6 ${query}"`;

  return { content: [{ type: 'text', text }] };
}

/**
 * Figma API Fallback 검색 + 자동 학습
 */
async function searchWithFallback(
  figmaService: FigmaService,
  searchService: SearchService,
  query: string,
  autoConfirm: boolean
) {
  // 키워드 추출
  const keywords = query
    .replace(/[^\w가-힣\s]/g, ' ')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1);

  // 프로젝트/버전 감지
  const project = detectProject(query);
  const version = detectVersion(query);

  try {
    // 🔍 Figma API 실시간 검색
    const realtimeResults = await figmaService.searchScreensInRealtime(
      keywords,
      project || undefined,
      version || undefined,
      5
    );

    if (realtimeResults.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ "${query}"에 대한 검색 결과가 없습니다.\n\n` +
                `📝 확인 사항:\n` +
                `- 검색어를 다르게 입력해보세요\n` +
                `- 화면 ID로 직접 검색해보세요 (예: CONT-05_04_54)\n` +
                `- metadata를 업데이트해보세요: npm run collect-metadata`,
        }],
      };
    }

    // 🎓 학습: 찾은 화면들을 metadata에 추가
    for (const screen of realtimeResults) {
      try {
        const fileName = `${screen.version} - ${screen.screenId}`;
        
        await searchService.addScreen({
          screenId: screen.screenId,
          pageTitle: screen.pageTitle,
          description: screen.description,
          author: screen.author,
          keywords: keywords,
          project: project || 'Unknown',
          version: screen.version,
          fileKey: screen.fileKey,
          fileName: fileName,
          nodeId: screen.nodeId,
          lastModified: new Date().toISOString(),
        });
      } catch (error) {
        console.error('화면 저장 실패:', error);
      }
    }

    // 결과 포맷팅
    if (realtimeResults.length === 1 && autoConfirm) {
      const screen = realtimeResults[0];
      
      let text = `✅ 1개의 화면을 찾았습니다 (Figma API 검색)\n\n`;
      text += `🎓 이 화면이 metadata에 추가되었습니다.\n\n`;
      text += formatScreenResult(
        screen,
        screen.description,
        screen.version || 'unknown',
        screen.version || 'unknown',
        screen.fileKey
      );

      return { content: [{ type: 'text', text }] };
    }

    // 여러 개 결과
    let text = `🔍 Figma API에서 ${realtimeResults.length}개의 화면을 찾았습니다:\n\n`;
    text += `🎓 찾은 화면들이 metadata에 추가되었습니다.\n\n`;

    realtimeResults.forEach((screen, index) => {
      text += `${index + 1}. ${screen.screenId} - ${screen.pageTitle}\n`;
      text += `   프로젝트: unknown / 버전: ${screen.version}\n\n`;
    });

    text += `💡 다음번에는 더 빠르게 검색할 수 있습니다.`;

    return { content: [{ type: 'text', text }] };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `⚠️ Figma API 검색 실패: ${errorMessage}\n\n` +
              `metadata를 업데이트해주세요: npm run collect-metadata`,
      }],
    };
  }
}

/**
 * 자연어로 검색
 */
async function searchByNaturalLanguage(
  figmaService: FigmaService,
  searchService: SearchService,
  query: string,
  project: string,
  version: string,
  autoConfirm: boolean
) {
  try {
    // 검색 실행
    const results = await searchService.search(query, project, version);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ "${query}"에 대한 검색 결과가 없습니다.

확인 사항:
- 프로젝트: ${project}
- 버전: ${version}
- 검색어를 다르게 입력해보세요
- 또는 화면 ID로 직접 검색해보세요 (예: CONT-05_04_54)`,
          },
        ],
      };
    }

    // 1개 결과만 있고 autoConfirm=true면 자동 확정
    if (results.length === 1 && autoConfirm) {
      const screen = results[0].screen;
      
      // 지연 로딩: description이 비어있으면 상세 정보 조회
      if (!screen.description || screen.description === '') {
        console.log(`🔄 화면 상세 정보를 불러오는 중... (${screen.screenId})`);
        const details = await figmaService.getScreenDetail(screen.fileKey, screen.nodeId);
        
        // metadata 업데이트
        await searchService.updateScreenDetail(
          screen.screenId,
          screen.project,
          screen.version,
          details
        );
        
        // 현재 화면 객체도 업데이트
        screen.pageTitle = details.pageTitle;
        screen.author = details.author;
        screen.description = details.description;
      }
      
      const description = await figmaService.getScreenDescription(screen.fileKey, screen.nodeId);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ 1개의 화면을 찾았습니다 (자동 확정)\n\n` +
                  formatScreenResult(screen, description, screen.project, screen.version, screen.fileName),
          },
        ],
      };
    }

    // 2개 이상: 후보 제시
    return {
      content: [
        {
          type: 'text',
          text: formatCandidates(results, query),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 후보 목록 포맷팅
 */
function formatCandidates(results: any[], query: string): string {
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🔍 "${query}"로 ${results.length}개의 화면을 찾았습니다:`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  results.forEach((result, index) => {
    const { screen, score, matchedKeywords } = result;
    const star = index === 0 ? ' ⭐' : '';
    
    lines.push(`${index + 1}. ${screen.screenId} - ${screen.pageTitle}${star}`);
    lines.push(`   담당: ${screen.author}`);
    lines.push(`   프로젝트: ${screen.project} / 버전: ${screen.version}`);
    lines.push(`   매칭 키워드: ${matchedKeywords.join(', ')}`);
    lines.push(`   점수: ${score}`);
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 특정 화면을 보려면 화면 ID로 다시 검색하세요.');
  lines.push('   예: "CONT-05_04_54 보여줘"');

  return lines.join('\n');
}

/**
 * 화면 ID로 직접 검색
 */
async function searchByScreenId(
  figmaService: FigmaService,
  screenId: string,
  project: string,
  version: string
) {
  try {
    // 1. 프로젝트 찾기
    const projectData = await figmaService.findProjectByName(project);
    if (!projectData) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 프로젝트를 찾을 수 없습니다: ${project}`,
          },
        ],
      };
    }

    // 2. 버전 파일 찾기
    const file = await figmaService.findFileByVersion(projectData.id, version);
    if (!file) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 버전 파일을 찾을 수 없습니다: ${version}`,
          },
        ],
      };
    }

    // 3. 화면 검색
    const screen = await figmaService.findScreenById(file.key, screenId);
    if (!screen) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 화면을 찾을 수 없습니다: ${screenId}

확인 사항:
- 화면 ID가 정확한지 확인해주세요
- 프로젝트: ${project}
- 버전: ${version}
- 파일: ${file.name}`,
          },
        ],
      };
    }

    // 4. 상세 설명 가져오기
    const description = await figmaService.getScreenDescription(file.key, screen.nodeId);

    // 5. 결과 반환
    return {
      content: [
        {
          type: 'text',
          text: formatScreenResult(screen, description, project, version, file.name),
        },
      ],
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 화면 결과 포맷팅
 */
function formatScreenResult(
  screen: any,
  description: string,
  project: string,
  version: string,
  fileName: string
): string {
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `📋 ${screen.screenId} - ${screen.pageTitle}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `✓ 프로젝트: ${project}`,
    `✓ 버전: ${version}`,
    `✓ 담당: ${screen.author}`,
    `✓ Figma 파일: ${fileName}`,
    `✓ Node ID: ${screen.nodeId}`,
    '',
    '📝 기능 설명:',
    '',
  ];

  if (description) {
    const descLines = description.split('\n').filter(line => line.trim());
    descLines.forEach(line => {
      lines.push(`   • ${line}`);
    });
  } else {
    lines.push('   (설명 없음)');
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}
