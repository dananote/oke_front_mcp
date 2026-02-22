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

type CandidateScreen = {
  screenId: string;
  pageTitle: string;
  author: string;
  project: string;
  version: string;
  fileKey: string;
  fileName: string;
  nodeId: string;
  description?: string;
};

let lastCandidatePool: CandidateScreen[] = [];

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

function normalizeVersionArg(rawVersion?: string, query?: string): string | undefined {
  if (!rawVersion) return undefined;
  const trimmed = rawVersion.trim();
  if (!trimmed) return undefined;

  // "3.0.6, 3.0.5" 같이 다중 기본값이 주입되면 버전 미지정으로 본다.
  if (trimmed.includes(',')) return undefined;

  // 기본값이 자동 주입된 경우(질문에 버전이 없으면) 미지정으로 본다.
  const queryVersion = query ? detectVersion(query) : null;
  if (!queryVersion && process.env.DEFAULT_VERSION && trimmed === process.env.DEFAULT_VERSION) {
    return undefined;
  }

  return trimmed;
}

function detectSelectionIndex(query: string): number | null {
  const trimmed = query.trim();

  // 1) "1", "2번" 같은 단문 선택
  const strictMatch = trimmed.match(/^(\d+)\s*(번)?$/);
  if (strictMatch) {
    const index = Number(strictMatch[1]);
    return Number.isFinite(index) && index > 0 ? index : null;
  }

  // 2) "3 번기획 불러와줘", "2번 보여줘" 같은 문장형 선택
  //    버전(예: 3.0.6)과 구분하기 위해 정수 + '번' 패턴만 인식
  const sentenceMatch = trimmed.match(/(?:^|\s)(\d+)\s*번(?:\s|$|[^\d])/);
  if (!sentenceMatch) return null;
  const index = Number(sentenceMatch[1]);
  return Number.isFinite(index) && index > 0 ? index : null;
}

function setCandidatePool(candidates: CandidateScreen[]): void {
  lastCandidatePool = candidates;
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
    version: rawArgVersion,
    autoConfirm = true,
  } = args as SearchFigmaSpecArgs;
  const argVersion = normalizeVersionArg(rawArgVersion, query);

  try {
    const selectionIndex = detectSelectionIndex(query);
    if (selectionIndex) {
      const selected = lastCandidatePool[selectionIndex - 1];
      if (!selected) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 선택 가능한 번호가 아닙니다: ${selectionIndex}\n\n현재 후보 목록을 다시 조회해 주세요.`,
            },
          ],
        };
      }

      const description = await fetchAndLearnDescription(
        figmaService,
        searchService,
        selected,
        selected.project,
        selected.version,
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ 선택한 화면입니다 (#${selectionIndex})\n\n` +
              formatScreenResult(selected, description, selected.project, selected.version, selected.fileName),
          },
        ],
      };
    }

    console.log(
      `[search_figma_spec] raw args: ${JSON.stringify({
        query,
        argProject,
        argVersion,
        autoConfirm,
      })}`,
    );

    // 1. 화면 ID 패턴 감지
    const screenId = detectScreenId(query);

    if (screenId) {
      // 화면 ID가 명시된 경우: 직접 조회
      const project = argProject || detectProject(query) || process.env.DEFAULT_PROJECT || 'CONTRABASS';
      const version = argVersion || detectVersion(query) || undefined;
      console.log(
        `[search_figma_spec] strategy=screenId query=${screenId} project=${project} version=${version}` +
          ` (rawArgVersion=${rawArgVersion || 'none'}, normalizedArgVersion=${argVersion || 'none'}, detectedVersion=${detectVersion(query) || 'none'}, defaultVersion=${process.env.DEFAULT_VERSION || 'none'})`,
      );
      return await searchByScreenId(figmaService, searchService, screenId, project, version);
    }

    // 2. 프로젝트/버전 감지
    const detectedProject = argProject || detectProject(query);
    const detectedVersion = argVersion || detectVersion(query);
    console.log(
      `[search_figma_spec] detected project=${detectedProject || 'none'} version=${detectedVersion || 'none'}` +
        ` (argProject=${argProject || 'none'}, rawArgVersion=${rawArgVersion || 'none'}, normalizedArgVersion=${argVersion || 'none'}, defaultVersion=${process.env.DEFAULT_VERSION || 'none'})`,
    );

    const hasExplicitVersion = Boolean(argVersion || detectVersion(query));
    const autoConfirmWithVersionGuard = autoConfirm && hasExplicitVersion;

    // 3. 검색 전략 결정
    if (detectedProject && detectedVersion) {
      console.log(`[search_figma_spec] autoConfirm effective=${autoConfirmWithVersionGuard} (hasExplicitVersion=${hasExplicitVersion})`);
      console.log('[search_figma_spec] strategy=project+version');
      // 프로젝트/버전 모두 명시 → 해당 범위에서만 검색
      return await searchByNaturalLanguage(
        figmaService,
        searchService,
        query,
        detectedProject,
        detectedVersion,
        autoConfirmWithVersionGuard
      );
    } else if (detectedProject) {
      console.log(`[search_figma_spec] autoConfirm effective=${autoConfirmWithVersionGuard} (hasExplicitVersion=${hasExplicitVersion})`);
      console.log('[search_figma_spec] strategy=project-only');
      // 프로젝트만 명시 → 해당 프로젝트의 모든 버전 검색
      return await searchByProject(
        figmaService,
        searchService,
        query,
        detectedProject,
        autoConfirmWithVersionGuard
      );
    } else {
      console.log(`[search_figma_spec] autoConfirm effective=${autoConfirmWithVersionGuard} (hasExplicitVersion=${hasExplicitVersion})`);
      console.log('[search_figma_spec] strategy=all-projects-grouped');
      // 프로젝트/버전 미지정 → 전체 검색 (그룹화)
      return await searchAllProjectsGrouped(
        figmaService,
        searchService,
        query,
        autoConfirmWithVersionGuard
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
  const rawResults = await searchService.search(query, project, undefined, 100);
  const phraseFiltered = filterResultsByCorePhrase(rawResults, query);
  const results = prioritizeResultsByPhrase(phraseFiltered, query);
  console.log(
    `[search_figma_spec] searchByProject results=${results.length} project=${project} autoConfirm=${autoConfirm}`,
  );

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `❌ "${query}"에 대한 검색 결과가 없습니다. (프로젝트: ${project})\n\n다른 키워드로 다시 시도해보세요.`,
      }],
    };
  }

  // 질의와 가장 맞는 동일 타이틀 그룹이 여러 버전에 있으면 버전 선택만 우선 제공
  const bestTitleChoices = buildBestTitleVersionChoices(results, query);
  if (bestTitleChoices.length > 1) {
    setCandidatePool(bestTitleChoices);
    let text = `🔍 "${query}"와 가장 일치하는 화면이 여러 버전에 있습니다:\n\n`;
    bestTitleChoices.forEach((screen, index) => {
      text += `${index + 1}. 버전 ${screen.version} - ${screen.pageTitle}\n`;
    });
    text += `\n원하는 버전을 번호로 선택해 주세요. (예: "1" 또는 "2번")`;
    return { content: [{ type: 'text', text }] };
  }

  // 동일 화면(동일 screenId + 타이틀)이 여러 버전에 존재하면 버전 선택을 우선 제공
  const versionChoices = buildVersionChoicesFromRankedResults(results);
  if (versionChoices.length > 1) {
    setCandidatePool(versionChoices);
    let text = `🔍 "${query}"와 가장 일치하는 화면이 여러 버전에 있습니다:\n\n`;
    versionChoices.forEach((screen, index) => {
      text += `${index + 1}. 버전 ${screen.version} - ${screen.pageTitle}\n`;
    });
    text += `\n원하는 버전을 번호로 선택해 주세요. (예: "1" 또는 "2번")`;
    return { content: [{ type: 'text', text }] };
  }

  // 1개 결과만 있고 autoConfirm=true면 자동 확정
  if (results.length === 1 && autoConfirm) {
    const screen = results[0].screen;
    console.log(
      `[search_figma_spec] autoConfirm=triggered scope=project-only screenId=${screen.screenId} version=${screen.version}`,
    );
    const description = await fetchAndLearnDescription(
      figmaService,
      searchService,
      screen,
      screen.project,
      screen.version,
    );
    
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
  const candidatePool: CandidateScreen[] = [];
  
  let globalIndex = 1;
  for (const [version, versionResults] of versionMap.entries()) {
    text += `📌 버전 ${version}\n`;
    for (const result of versionResults) {
      const { screen } = result;
      candidatePool.push(screen);
      text += `   ${globalIndex}. ${screen.pageTitle}\n`;
      globalIndex++;
    }
    text += '\n';
  }

  setCandidatePool(candidatePool);
  text += '어떤 화면을 보시겠습니까? (번호로 선택)';

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
  const groupedResults = await searchService.searchGrouped(query, 100);

  if (groupedResults.length === 0) {
    console.log('[search_figma_spec] groupedResults=0 -> fallback');
    // ⭐ Fallback: Figma API 실시간 검색
    return await searchWithFallback(figmaService, searchService, query, autoConfirm);
  }

  // 전체 결과 개수 계산
  let totalCount = 0;
  const flatResults: any[] = [];
  for (const projectGroup of groupedResults) {
    for (const versionGroup of projectGroup.versions) {
      totalCount += versionGroup.screens.length;
      flatResults.push(...versionGroup.screens);
    }
  }

  // 전체 검색에서도 동일 화면의 버전 선택을 먼저 제공
  const phraseFilteredFlatResults = filterResultsByCorePhrase(flatResults, query);
  const prioritizedFlatResults = prioritizeResultsByPhrase(phraseFilteredFlatResults, query);
  const bestTitleChoices = buildBestTitleVersionChoices(prioritizedFlatResults, query);
  if (bestTitleChoices.length > 1) {
    setCandidatePool(bestTitleChoices);
    let text = `🔍 "${query}"와 가장 일치하는 화면이 여러 버전에 있습니다:\n\n`;
    bestTitleChoices.forEach((screen, index) => {
      text += `${index + 1}. ${screen.project} / 버전 ${screen.version} - ${screen.pageTitle}\n`;
    });
    text += `\n원하는 버전을 번호로 선택해 주세요. (예: "1" 또는 "2번")`;
    return { content: [{ type: 'text', text }] };
  }

  const versionChoices = buildVersionChoicesFromRankedResults(prioritizedFlatResults);
  if (versionChoices.length > 1) {
    setCandidatePool(versionChoices);
    let text = `🔍 "${query}"와 가장 일치하는 화면이 여러 버전에 있습니다:\n\n`;
    versionChoices.forEach((screen, index) => {
      text += `${index + 1}. ${screen.project} / 버전 ${screen.version} - ${screen.pageTitle}\n`;
    });
    text += `\n원하는 버전을 번호로 선택해 주세요. (예: "1" 또는 "2번")`;
    return { content: [{ type: 'text', text }] };
  }

  // 1개 결과만 있고 autoConfirm=true면 자동 확정
  if (totalCount === 1 && autoConfirm) {
    const screen = groupedResults[0].versions[0].screens[0].screen;
    console.log(
      `[search_figma_spec] autoConfirm=triggered scope=all-projects screenId=${screen.screenId} project=${screen.project} version=${screen.version}`,
    );
    const description = await fetchAndLearnDescription(
      figmaService,
      searchService,
      screen,
      screen.project,
      screen.version,
    );
    
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
  const candidatePool: CandidateScreen[] = [];
  
  let globalIndex = 1;
  for (const projectGroup of groupedResults) {
    text += `📂 ${projectGroup.project}\n`;
    
    for (const versionGroup of projectGroup.versions) {
      text += `   📌 버전 ${versionGroup.version}\n`;
      
      for (const result of versionGroup.screens) {
        const { screen } = result;
        candidatePool.push(screen);
        text += `      ${globalIndex}. ${screen.pageTitle}\n`;
        globalIndex++;
      }
      text += '\n';
    }
  }

  setCandidatePool(candidatePool);
  text += `💡 프로젝트와 버전을 명시하면 더 정확한 결과를 얻을 수 있습니다.\n`;
  text += `   예: "콘트라베이스 3.0.6 ${query}"\n`;
  text += `💡 번호만 입력해도 선택할 수 있습니다. (예: "1")`;

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
    console.log(
      `[search_figma_spec] searchByNaturalLanguage results=${results.length} project=${project} version=${version} autoConfirm=${autoConfirm}`,
    );

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
      console.log(
        `[search_figma_spec] autoConfirm=triggered scope=project+version screenId=${screen.screenId} version=${screen.version}`,
      );
      
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
      
      const description = await fetchAndLearnDescription(
        figmaService,
        searchService,
        screen,
        screen.project,
        screen.version,
      );
      
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

  setCandidatePool(results.map(result => result.screen));

  results.forEach((result, index) => {
    const { screen, score, matchedKeywords } = result;
    const star = index === 0 ? ' ⭐' : '';
    
    lines.push(`${index + 1}. ${screen.pageTitle}${star}`);
    lines.push(`   담당: ${screen.author}`);
    lines.push(`   프로젝트: ${screen.project} / 버전: ${screen.version}`);
    lines.push(`   매칭 키워드: ${matchedKeywords.join(', ')}`);
    lines.push(`   점수: ${score}`);
    lines.push('');
  });

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 번호로 선택할 수 있습니다.');
  lines.push('   예: "1" 또는 "2번"');

  return lines.join('\n');
}

/**
 * 화면 ID로 직접 검색
 */
async function searchByScreenId(
  figmaService: FigmaService,
  searchService: SearchService,
  screenId: string,
  project: string,
  version?: string
) {
  try {
    // 0. metadata 우선 검색 (정확 ID) - 버전 미지정 시 선택지 제공
    const metadataResults = await searchService.search(screenId, project, version, 50);
    const exactMatches = metadataResults.filter(
      result => result.screen.screenId.toUpperCase() === screenId.toUpperCase()
    );

    if (exactMatches.length > 1 && !version) {
      let text = `🔍 "${screenId}"가 여러 버전에서 발견되었습니다 (${project}):\n\n`;
      exactMatches.forEach((result, index) => {
        text += `${index + 1}. 버전 ${result.screen.version} - ${result.screen.pageTitle}\n`;
      });
      text += `\n어떤 버전을 보시겠습니까? (예: "${project} 3.0.6 ${screenId}")`;
      return { content: [{ type: 'text', text }] };
    }

    if (exactMatches.length >= 1) {
      const screen = exactMatches[0].screen;
      const description = await fetchAndLearnDescription(
        figmaService,
        searchService,
        screen,
        screen.project,
        screen.version,
      );

      return {
        content: [
          {
            type: 'text',
            text: formatScreenResult(screen, description, screen.project, screen.version, screen.fileName),
          },
        ],
      };
    }

    if (!version) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 화면을 찾지 못했습니다: ${screenId}\n\n버전을 함께 입력해 주세요. 예: "${project} 3.0.6 ${screenId}"`,
          },
        ],
      };
    }

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
    const description = await fetchAndLearnDescription(
      figmaService,
      searchService,
      screen,
      project,
      version,
    );

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
 * 설명 조회 + 메타데이터 학습 저장
 */
async function fetchAndLearnDescription(
  figmaService: FigmaService,
  searchService: SearchService,
  screen: {
    screenId: string;
    pageTitle?: string;
    author?: string;
    fileKey: string;
    fileName?: string;
    nodeId: string;
    description?: string;
    lastModified?: string;
  },
  project: string,
  version: string
): Promise<string> {
  // 1) description 직접 추출
  let description = await figmaService.getScreenDescription(screen.fileKey, screen.nodeId);

  // 2) description이 비어 있으면 상세 조회 fallback
  if (!description || !description.trim()) {
    const detail = await figmaService.getScreenDetail(screen.fileKey, screen.nodeId);
    if (detail.description && detail.description.trim()) {
      description = detail.description;
    }
  }

  if (description && description.trim()) {
    const updated = await searchService.updateScreenDetail(screen.screenId, project, version, { description });

    // update 실패(화면 없음) 시 addScreen으로 학습 데이터 신규 등록
    if (!updated) {
      await searchService.addScreen({
        screenId: screen.screenId,
        pageTitle: screen.pageTitle || 'Unknown',
        description,
        author: screen.author || 'N/A',
        keywords: extractLearningKeywords(`${screen.screenId} ${screen.pageTitle || ''} ${description}`),
        project,
        version,
        fileKey: screen.fileKey,
        fileName: screen.fileName || `${version} - ${screen.screenId}`,
        nodeId: screen.nodeId,
        lastModified: screen.lastModified || new Date().toISOString(),
      });
      console.log(`   🎓 화면 신규 학습 완료(addScreen): ${screen.screenId} (${project}/${version})`);
    }

    screen.description = description;
  }

  return description;
}

function extractLearningKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[^\w가-힣\s]/g, ' ')
    .toLowerCase()
    .trim();

  return Array.from(new Set(cleaned.split(/\s+/).filter((word) => word.length > 1)));
}

function normalizeTitle(value?: string): string {
  if (!value) return '';
  return value.replace(/[\s_-]+/g, '').toLowerCase();
}

function extractQueryTokens(query: string): string[] {
  const stopwords = new Set(['기획', '페이지', '화면', '찾아줘', '보여줘', '알려줘', '확인해줘']);
  return query
    .replace(/[^\w가-힣\s]/g, ' ')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 1 && !stopwords.has(token));
}

function prioritizeResultsByPhrase<T extends { screen: CandidateScreen; score?: number }>(
  results: T[],
  query: string
): T[] {
  const tokens = extractQueryTokens(query);
  if (tokens.length < 2) return results;

  const phrase = `${tokens[0]}${tokens[1]}`; // 예: "볼륨수정"

  return [...results].sort((a, b) => {
    const aPhrase = normalizeTitle(a.screen.pageTitle).includes(phrase) ? 1 : 0;
    const bPhrase = normalizeTitle(b.screen.pageTitle).includes(phrase) ? 1 : 0;
    if (aPhrase !== bPhrase) return bPhrase - aPhrase;

    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    return bScore - aScore;
  });
}

function filterResultsByCorePhrase<T extends { screen: CandidateScreen }>(
  results: T[],
  query: string
): T[] {
  const tokens = extractQueryTokens(query);
  if (tokens.length < 2) return results;

  const phrase = `${tokens[0]}${tokens[1]}`; // 예: "볼륨수정"
  const filtered = results.filter(result =>
    normalizeTitle(result.screen.pageTitle).includes(phrase)
  );

  return filtered.length > 0 ? filtered : results;
}

function buildVersionChoicesFromRankedResults(results: Array<{ screen: CandidateScreen }>): CandidateScreen[] {
  if (!results.length) return [];

  const topScreen = results[0].screen;
  const topTitle = normalizeTitle(topScreen.pageTitle);
  const targetScreenId = topScreen.screenId;

  const matched = results
    .map(result => result.screen)
    .filter(screen =>
      screen.screenId === targetScreenId &&
      normalizeTitle(screen.pageTitle) === topTitle
    );

  const dedupMap = new Map<string, CandidateScreen>();
  for (const screen of matched) {
    const key = `${screen.project}|${screen.version}|${screen.screenId}|${screen.pageTitle}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, screen);
    }
  }

  return Array.from(dedupMap.values());
}

function buildBestTitleVersionChoices(
  results: Array<{ screen: CandidateScreen; score?: number }>,
  query: string
): CandidateScreen[] {
  if (!results.length) return [];

  const tokens = extractQueryTokens(query);
  const phrase = tokens.length >= 2 ? `${tokens[0]}${tokens[1]}` : '';

  type GroupData = {
    screens: CandidateScreen[];
    titleNorm: string;
    topScore: number;
  };

  const groups = new Map<string, GroupData>();
  for (const result of results) {
    const titleNorm = normalizeTitle(result.screen.pageTitle);
    const key = `${result.screen.screenId}|${titleNorm}`;
    if (!groups.has(key)) {
      groups.set(key, { screens: [], titleNorm, topScore: 0 });
    }
    const group = groups.get(key)!;
    group.screens.push(result.screen);
    group.topScore = Math.max(group.topScore, result.score ?? 0);
  }

  const rankedGroups = Array.from(groups.values())
    .map(group => {
      const uniqueVersions = new Set(group.screens.map(screen => `${screen.project}|${screen.version}`)).size;
      const exactness =
        phrase && group.titleNorm === phrase ? 2 :
        phrase && group.titleNorm.startsWith(phrase) ? 1 : 0;
      return { ...group, uniqueVersions, exactness };
    })
    .sort((a, b) => {
      if (a.uniqueVersions !== b.uniqueVersions) return b.uniqueVersions - a.uniqueVersions;
      if (a.exactness !== b.exactness) return b.exactness - a.exactness;
      if (a.topScore !== b.topScore) return b.topScore - a.topScore;
      return a.titleNorm.length - b.titleNorm.length;
    });

  const best = rankedGroups[0];
  if (!best || best.uniqueVersions <= 1) return [];

  const dedupByVersion = new Map<string, CandidateScreen>();
  for (const screen of best.screens) {
    const key = `${screen.project}|${screen.version}`;
    if (!dedupByVersion.has(key)) {
      dedupByVersion.set(key, screen);
    }
  }

  return Array.from(dedupByVersion.values());
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
  const publisherHintQuery = `${project} ${version} ${screen.pageTitle} 퍼블 코드 찾아줘`;
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
  lines.push('🔗 연관 퍼블 코드 검색 힌트:');
  lines.push(`   search_publisher_code query="${publisherHintQuery}"`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return lines.join('\n');
}
