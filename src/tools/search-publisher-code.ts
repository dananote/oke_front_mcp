import { PublisherService } from '../services/publisher.js';
import type { PublisherBundle } from '../services/publisher.js';
import type { RepoStatus } from '../services/publisher.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logPublisherTrace } from '../utils/mcp-request-logger.js';

interface SearchPublisherCodeArgs {
  query: string;
  project?: string;
  maxResults?: number;
  refreshIndex?: boolean;
  targetSummary?: string;
  currentCodeHint?: string;
}

interface PublisherBundleState {
  query: string;
  intentType: SearchIntentType;
  repoPath: string;
  gitCommit: string;
  bundles: PublisherBundle[];
}

type SearchIntentType = 'build_page' | 'diff_fix' | 'general_search';
interface SynonymRule {
  id: string;
  keywords: string[];
  tokens: string[];
  menuHints?: string[];
}

let lastPublisherBundleState: PublisherBundleState | null = null;
let cachedSynonymRules: SynonymRule[] | null = null;
const SYNONYM_RULES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'publisher-synonyms.json');

function normalizeLooseText(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function hasLooseKeyword(source: string, keyword: string): boolean {
  return normalizeLooseText(source).includes(normalizeLooseText(keyword));
}

async function getSynonymRules(): Promise<SynonymRule[]> {
  if (cachedSynonymRules) return cachedSynonymRules;
  try {
    const raw = await fs.readFile(SYNONYM_RULES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { rules?: SynonymRule[] };
    cachedSynonymRules = Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    cachedSynonymRules = [];
  }
  return cachedSynonymRules;
}

async function expandPublisherQuery(
  query: string,
  synonymRules: SynonymRule[]
): Promise<{ normalizedQuery: string; expandedTokens: string[]; matchedRules: string[] }> {
  const expansions: Array<{ pattern: RegExp; token: string }> = [
    { pattern: /\bLB\b/gi, token: 'loadbalancer' },
    { pattern: /로드밸런서/gi, token: 'loadbalancer' },
    { pattern: /로드 밸런서/gi, token: 'loadbalancer' },
    { pattern: /리스너/gi, token: 'listener' },
    { pattern: /볼륨/gi, token: 'volume' },
    { pattern: /볼륨\s*생성|생성\s*볼륨/gi, token: 'volume create' },
    { pattern: /인스턴스/gi, token: 'instance' },
    { pattern: /호스트/gi, token: 'host' },
    { pattern: /오브젝트\s*스토리지/gi, token: 'object storage ceph' },
    { pattern: /스토리지/gi, token: 'storage' },
    { pattern: /생성페이지|생성\s*페이지|create page/gi, token: 'create page' },
    { pattern: /생성해줘|만들어줘|개발해줘|적용해줘/gi, token: 'create implement' },
    { pattern: /수정해줘|고쳐줘|차이|비교/gi, token: 'diff fix update' },
    { pattern: /콘트라베이스|컨트라베이스/gi, token: 'contrabass' },
    { pattern: /비올라/gi, token: 'viola' },
    { pattern: /부트팩토리|부트\s*팩토리/gi, token: 'bootfactory' },
  ];
  let normalized = query;
  const expandedTokens = new Set<string>();
  const matchedRules = new Set<string>();

  for (const expansion of expansions) {
    if (expansion.pattern.test(query)) {
      expandedTokens.add(expansion.token);
      normalized = `${normalized} ${expansion.token}`;
    }
  }

  for (const rule of synonymRules) {
    const matched = rule.keywords.some(keyword => hasLooseKeyword(query, keyword));
    if (!matched) continue;
    matchedRules.add(rule.id);
    for (const token of rule.tokens) {
      expandedTokens.add(token);
      normalized = `${normalized} ${token}`;
    }
  }

  return {
    normalizedQuery: normalized.trim(),
    expandedTokens: Array.from(expandedTokens),
    matchedRules: Array.from(matchedRules),
  };
}

function buildSearchCandidates(
  normalizedQuery: string,
  expandedTokens: string[],
  menuHints: string[],
  intentType: SearchIntentType,
  targetSummary?: string,
  currentCodeHint?: string
): string[] {
  const candidates: string[] = [];
  const base = normalizedQuery.trim();
  if (base) candidates.push(base);

  const hintQuery = [base, ...menuHints].filter(Boolean).join(' ').trim();
  if (hintQuery && !candidates.includes(hintQuery)) candidates.push(hintQuery);

  if (intentType === 'build_page') {
    const createBias = [base, 'create', 'page', ...menuHints].join(' ').trim();
    if (createBias && !candidates.includes(createBias)) candidates.push(createBias);
  }

  if (intentType === 'diff_fix') {
    const diffBias = [base, 'diff', 'fix', 'update', ...menuHints].join(' ').trim();
    if (diffBias && !candidates.includes(diffBias)) candidates.push(diffBias);
  }

  const contextBias = [base, targetSummary, currentCodeHint, ...expandedTokens].filter(Boolean).join(' ').trim();
  if (contextBias && !candidates.includes(contextBias)) candidates.push(contextBias);

  return candidates.slice(0, 5);
}

function detectProject(query: string): string | undefined {
  const lower = query.toLowerCase();
  if (lower.includes('콘트라베이스') || lower.includes('contrabass') || lower.includes('cont')) return 'CONTRABASS';
  if (lower.includes('비올라') || lower.includes('viola')) return 'VIOLA';
  if (lower.includes('ceph') || lower.includes('sds') || lower.includes('오브젝트 스토리지') || lower.includes('스토리지')) return 'SDS+';
  if (lower.includes('부트') || lower.includes('boot')) return 'Boot Factory';
  return undefined;
}

function detectIntent(query: string): SearchIntentType {
  const lower = query.toLowerCase();
  if (
    lower.includes('차이') ||
    lower.includes('비교') ||
    lower.includes('수정해줘') ||
    lower.includes('고쳐줘') ||
    lower.includes('diff')
  ) {
    return 'diff_fix';
  }
  if (
    lower.includes('개발해줘') ||
    lower.includes('만들어줘') ||
    lower.includes('적용해줘') ||
    lower.includes('생성페이지')
  ) {
    return 'build_page';
  }
  return 'general_search';
}

function detectMenuHints(query: string, targetSummary?: string, synonymRules: SynonymRule[] = []): string[] {
  const source = `${query} ${targetSummary || ''}`.toLowerCase();
  const hints: string[] = [];
  if (source.includes('인스턴스') || source.includes('instance')) hints.push('instance');
  if (source.includes('볼륨') || source.includes('volume')) hints.push('volume');
  if (source.includes('vpc')) hints.push('vpc');
  if (source.includes('호스트') || source.includes('host')) hints.push('host');
  if (source.includes('로드밸런서') || source.includes('loadbalancer')) hints.push('loadbalancer');
  if (source.includes('리스너') || source.includes('listener')) hints.push('listener');
  if (source.includes('오브젝트 스토리지') || source.includes('object storage') || source.includes('ceph')) hints.push('ceph');
  for (const rule of synonymRules) {
    const matched = rule.keywords.some(keyword => hasLooseKeyword(source, keyword));
    if (!matched) continue;
    (rule.menuHints || []).forEach(hint => hints.push(hint));
  }
  return Array.from(new Set(hints));
}

function detectSelectionIndex(query: string): number | null {
  const trimmed = query.trim();
  const strictMatch = trimmed.match(/^(\d+)\s*(번)?$/);
  if (strictMatch) {
    const value = Number(strictMatch[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const sentenceMatch = trimmed.match(/(?:^|\s)(\d+)\s*번(?:\s|$|[^\d])/);
  if (!sentenceMatch) return null;
  const value = Number(sentenceMatch[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatList(items: string[], emptyText: string): string {
  if (!items.length) return `   - ${emptyText}`;
  return items.map(item => `   - ${item}`).join('\n');
}

function toAbsolutePath(repoPath: string, relativePath: string): string {
  return path.join(repoPath, ...relativePath.split('/'));
}

function formatSnippetBlock(title: string, filePath: string, snippet: string): string {
  if (!snippet.trim()) {
    return `${title}\n- file: ${filePath}\n- snippet: (내용 없음)\n`;
  }
  return `${title}\n- file: ${filePath}\n\`\`\`\n${snippet}\n\`\`\`\n`;
}

async function readSnippetFromFile(absPath: string, hintKeywords: string[], maxLines: number): Promise<string> {
  try {
    const raw = await fs.readFile(absPath, 'utf-8');
    const lines = raw.split(/\r?\n/);

    let start = 0;
    if (hintKeywords.length) {
      const lowerKeywords = hintKeywords.map(token => token.toLowerCase());
      const hitIndex = lines.findIndex(line =>
        lowerKeywords.some(token => line.toLowerCase().includes(token))
      );
      if (hitIndex >= 0) {
        start = Math.max(0, hitIndex - 6);
      }
    }

    return lines.slice(start, start + maxLines).join('\n');
  } catch {
    return '';
  }
}

async function formatBundleDetail(
  state: PublisherBundleState,
  bundle: PublisherBundle,
  selectedIndex: number
): Promise<string> {
  const keywords = state.query
    .replace(/[^\w가-힣\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 1);

  const lines: string[] = [];
  lines.push(`✅ 퍼블 코드 후보 #${selectedIndex} 상세`);
  lines.push('');
  lines.push(`- query: ${state.query}`);
  lines.push(`- intent: ${state.intentType}`);
  lines.push(`- project: ${bundle.project}`);
  lines.push(`- solution: ${bundle.solution}`);
  lines.push(`- menu path: ${bundle.menuPath}`);
  lines.push(`- component: ${bundle.componentName}`);
  lines.push(`- pageType/entity: ${bundle.pageType} / ${bundle.entity}`);
  lines.push(`- score: ${bundle.score}`);
  lines.push(`- git commit: ${state.gitCommit}`);
  lines.push('');

  const mainAbsPath = toAbsolutePath(state.repoPath, bundle.mainFile);
  const mainSnippet = await readSnippetFromFile(mainAbsPath, keywords, 80);
  lines.push(formatSnippetBlock('1) Main Vue', bundle.mainFile, mainSnippet));

  if (bundle.relatedScripts.length > 0) {
    const scriptPath = bundle.relatedScripts[0];
    const scriptAbsPath = toAbsolutePath(state.repoPath, scriptPath);
    const scriptSnippet = await readSnippetFromFile(scriptAbsPath, keywords, 60);
    lines.push(formatSnippetBlock('2) Related Script', scriptPath, scriptSnippet));
  } else {
    lines.push('2) Related Script\n- (연관 script 없음)\n');
  }

  if (bundle.relatedStyles.length > 0) {
    const stylePath = bundle.relatedStyles[0];
    const styleAbsPath = toAbsolutePath(state.repoPath, stylePath);
    const styleSnippet = await readSnippetFromFile(styleAbsPath, keywords, 60);
    lines.push(formatSnippetBlock('3) Related Style', stylePath, styleSnippet));
  } else {
    lines.push('3) Related Style\n- (연관 style 없음)\n');
  }

  lines.push('4) Shared Components');
  lines.push(formatList(bundle.sharedComponents, '연관 shared component 없음'));
  lines.push('');
  lines.push('5) Related Modals');
  lines.push(formatList(bundle.relatedModals, '연관 modal 없음'));
  lines.push('');
  lines.push('다음 액션:');
  lines.push('- main vue를 기준으로 현재 프로젝트 규칙에 맞게 구조/네이밍을 조정');
  lines.push('- script/style는 필요한 부분만 선택 반영하고 기존 로직과 충돌 여부를 먼저 확인');

  return lines.join('\n');
}

function buildSyncIssueLines(syncWarnings: string[], syncIssues: Array<{ code: string; action: string }>): string[] {
  const lines: string[] = [];
  if (syncWarnings.length) {
    lines.push(`- warning: ${syncWarnings.join(' / ')}`);
  }
  if (syncIssues.length) {
    lines.push(`- sync issues: ${syncIssues.map(issue => issue.code).join(', ')}`);
    syncIssues.forEach(issue => {
      lines.push(`  - [${issue.code}] 조치: ${issue.action}`);
    });
  }
  return lines;
}

function buildApplyGuide(intentType: SearchIntentType, currentCodeHint?: string): string[] {
  const lines: string[] = [];
  lines.push('LLM 적용 가이드:');
  lines.push('- preserve: 현재 파일의 도메인 규칙, 네이밍, 상태관리 패턴은 유지');
  lines.push('- replace: 화면 구조/마크업은 퍼블 후보를 기준으로 필요한 블록만 교체');
  lines.push('- manual-check: API 연동/권한/라우팅/타입 정의는 최종 수동 검토');
  if (intentType === 'diff_fix') {
    lines.push('- diff-fix: 현재 코드와 퍼블 후보의 차이를 먼저 요약한 뒤 최소 변경으로 수정');
  }
  if (currentCodeHint?.trim()) {
    lines.push(`- current-code-hint: ${currentCodeHint.trim().slice(0, 240)}`);
  }
  return lines;
}

export async function searchPublisherCodeTool(
  publisherService: PublisherService,
  args: unknown
) {
  const {
    query,
    project: argProject,
    maxResults = 3,
    refreshIndex = false,
    targetSummary,
    currentCodeHint,
  } = args as SearchPublisherCodeArgs;
  const synonymRules = await getSynonymRules();
  logPublisherTrace('입력', 'search_publisher_code args', {
    query,
    project: argProject,
    maxResults,
    refreshIndex,
    targetSummary,
    hasCurrentCodeHint: Boolean(currentCodeHint),
  });

  if (!query || !query.trim()) {
    return {
      content: [{ type: 'text', text: '❌ query가 비어 있습니다. 검색어를 입력해주세요.' }],
      isError: true,
    };
  }

  try {
    const intentType = detectIntent(query);
    const selectionIndex = detectSelectionIndex(query);
    if (selectionIndex) {
      if (!lastPublisherBundleState) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 선택할 후보 목록이 없습니다.\n\n먼저 퍼블 코드 검색을 실행한 뒤 번호를 입력해주세요.`,
            },
          ],
        };
      }

      const selectedBundle = lastPublisherBundleState.bundles[selectionIndex - 1];
      if (!selectedBundle) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 선택 가능한 번호가 아닙니다: ${selectionIndex}\n\n다시 검색하거나 유효한 번호를 입력해주세요.`,
            },
          ],
        };
      }

      const detailText = await formatBundleDetail(lastPublisherBundleState, selectedBundle, selectionIndex);
      return { content: [{ type: 'text', text: detailText }] };
    }

    const mergedQueryForSearch = [query, targetSummary, currentCodeHint].filter(Boolean).join(' ');
    const { normalizedQuery, expandedTokens, matchedRules } = await expandPublisherQuery(mergedQueryForSearch, synonymRules);
    const project = argProject || detectProject(normalizedQuery);
    const menuHints = detectMenuHints(query, targetSummary, synonymRules);
    logPublisherTrace('질의확장', 'normalized query prepared', {
      normalizedQuery,
      expandedTokens,
      project,
      intentType,
      menuHints,
      matchedRules,
    });

    let syncWarnings: string[] = [];
    let repoStatus: RepoStatus;
    try {
      repoStatus = await publisherService.ensureRepo({
        repoUrl: process.env.PUBLISHER_REPO_URL,
        fallbackPath: process.env.PUBLISHER_REPO_PATH,
      });
    } catch (repoError) {
      const cachedIndex = await publisherService.loadCachedIndex();
      if (!cachedIndex) {
        throw repoError;
      }
      const reason = repoError instanceof Error ? repoError.message : String(repoError);
      syncWarnings.push(`저장소 동기화 실패로 기존 캐시 인덱스 사용: ${reason}`);
      logPublisherTrace('동기화', 'repo sync failed, fallback to cached index', {
        reason,
      });
      repoStatus = {
        repoPath: cachedIndex.repoPath,
        gitCommit: cachedIndex.gitCommit,
        source: 'fallback' as const,
        degraded: true,
        syncMessage: '저장소 동기화 실패로 기존 캐시 인덱스를 사용했습니다.',
        syncIssues: [],
      };
    }

    try {
      await publisherService.buildOrLoadIndex(repoStatus.repoPath, repoStatus.gitCommit, Boolean(refreshIndex));
    } catch (buildError) {
      const cachedIndex = await publisherService.loadCachedIndex();
      if (!cachedIndex) {
        throw buildError;
      }
      repoStatus = {
        repoPath: cachedIndex.repoPath,
        gitCommit: cachedIndex.gitCommit,
        source: repoStatus.source,
        degraded: true,
        syncMessage: `${repoStatus.syncMessage} (인덱스 재생성 실패로 기존 캐시 인덱스 사용)`,
        syncIssues: repoStatus.syncIssues,
      };
      syncWarnings.push('인덱스 재생성에 실패하여 기존 캐시 인덱스로 검색했습니다.');
      logPublisherTrace('인덱스', 'index build failed, using cached index', {
        error: buildError instanceof Error ? buildError.message : String(buildError),
      });
    }

    const searchCandidates = buildSearchCandidates(
      normalizedQuery,
      expandedTokens,
      menuHints,
      intentType,
      targetSummary,
      currentCodeHint
    );
    let bundles: PublisherBundle[] = [];
    let matchedCandidate = searchCandidates[0] || normalizedQuery;
    for (const candidateQuery of searchCandidates) {
      bundles = publisherService.searchBundles(candidateQuery, { project, maxResults });
      if (bundles.length > 0) {
        matchedCandidate = candidateQuery;
        break;
      }
    }
    logPublisherTrace('검색결과', 'bundle search finished', {
      count: bundles.length,
      degraded: repoStatus.degraded,
      syncMessage: repoStatus.syncMessage,
      syncIssueCodes: repoStatus.syncIssues.map(issue => issue.code),
      searchCandidates,
      matchedCandidate,
    });

    if (!bundles.length) {
      const lines = [
        `❌ "${query}"에 대한 퍼블 코드 번들을 찾지 못했습니다.`,
        '',
        '확인해볼 내용:',
        '- 프로젝트/메뉴명을 더 구체적으로 입력해보세요.',
        '- 퍼블 저장소 구조가 최근에 크게 변경됐다면 refreshIndex=true로 재시도하세요.',
        expandedTokens.length
          ? `- 동의어 확장 토큰: ${expandedTokens.join(', ')}`
          : '- 동의어 확장 토큰: (없음)',
        menuHints.length ? `- 메뉴 추론 힌트: ${menuHints.join(', ')}` : '- 메뉴 추론 힌트: (없음)',
        `- 시도한 검색 프로파일: ${searchCandidates.join(' || ')}`,
        `- 동기화 상태: ${repoStatus.syncMessage}`,
      ];
      lines.push(...buildSyncIssueLines(syncWarnings, repoStatus.syncIssues));
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    lastPublisherBundleState = {
      query,
      intentType,
      repoPath: repoStatus.repoPath,
      gitCommit: repoStatus.gitCommit,
      bundles,
    };

    const lines: string[] = [];
    lines.push('📦 퍼블 코드 번들 검색 결과');
    lines.push('');
    lines.push(`- query: ${query}`);
    lines.push(`- intent: ${intentType}`);
    if (targetSummary?.trim()) lines.push(`- target summary: ${targetSummary.trim()}`);
    if (menuHints.length) lines.push(`- inferred menus: ${menuHints.join(', ')}`);
    lines.push(`- repo source: ${repoStatus.source}`);
    lines.push(`- repo path: ${repoStatus.repoPath}`);
    lines.push(`- git commit: ${repoStatus.gitCommit}`);
    lines.push(`- sync mode: ${repoStatus.degraded ? 'degraded' : 'normal'}`);
    lines.push(`- sync message: ${repoStatus.syncMessage}`);
    lines.push(`- matched query profile: ${matchedCandidate}`);
    if (expandedTokens.length) {
      lines.push(`- query expansion: ${expandedTokens.join(', ')}`);
    }
    if (matchedRules.length) {
      lines.push(`- synonym rules: ${matchedRules.join(', ')}`);
    }
    lines.push(...buildSyncIssueLines(syncWarnings, repoStatus.syncIssues));
    lines.push('');

    bundles.forEach((bundle, index) => {
      lines.push(`${index + 1}. ${bundle.componentName} (${bundle.project})`);
      lines.push(`   - score: ${bundle.score}`);
      lines.push(`   - solution/menu: ${bundle.solution} / ${bundle.menuPath}`);
      lines.push(`   - pageType/entity: ${bundle.pageType} / ${bundle.entity}`);
      lines.push(`   - main: ${bundle.mainFile}`);
      lines.push('   - related_modals:');
      lines.push(formatList(bundle.relatedModals, '연관 modal 없음'));
      lines.push('   - scripts:');
      lines.push(formatList(bundle.relatedScripts, '연관 script 없음'));
      lines.push('   - styles:');
      lines.push(formatList(bundle.relatedStyles, '연관 style 없음'));
      lines.push('   - shared components:');
      lines.push(formatList(bundle.sharedComponents, '연관 shared component 없음'));
      lines.push('');
    });

    const primary = bundles[0];
    if (primary) {
      lines.push('구조화 요약(primary/related_modal/shared):');
      lines.push(`- primary: ${primary.mainFile}`);
      lines.push(`- related_modal: ${primary.relatedModals.join(', ') || '(없음)'}`);
      lines.push(`- shared: ${primary.sharedComponents.join(', ') || '(없음)'}`);
      lines.push('');
    }

    lines.push(...buildApplyGuide(intentType, currentCodeHint));
    lines.push('');
    lines.push('다음 액션:');
    lines.push('- 번호를 입력하면 상세 스니펫을 보여줍니다. (예: "1", "2번")');
    lines.push('- 이 결과를 근거로 LLM에게 현재 프로젝트 규칙에 맞춘 반영을 요청하세요.');
    lines.push('- 필요하면 같은 query로 maxResults를 늘려 더 많은 번들을 확인할 수 있습니다.');

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text:
            `❌ 퍼블 코드 검색 실패: ${message}\n\n` +
            '확인해볼 내용:\n' +
            '- SSH 키로 Bitbucket 접근이 가능한지 (`ssh -T git@bitbucket.org`)\n' +
            '- PUBLISHER_REPO_PATH fallback 경로가 설정되어 있는지\n' +
            '- git clone/pull 권한이 있는지',
        },
      ],
      isError: true,
    };
  }
}

