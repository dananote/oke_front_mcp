import { PublisherService } from '../services/publisher.js';
import type { PublisherBundle } from '../services/publisher.js';
import fs from 'fs/promises';
import path from 'path';

interface SearchPublisherCodeArgs {
  query: string;
  project?: string;
  maxResults?: number;
  refreshIndex?: boolean;
}

interface PublisherBundleState {
  query: string;
  repoPath: string;
  gitCommit: string;
  bundles: PublisherBundle[];
}

let lastPublisherBundleState: PublisherBundleState | null = null;

function detectProject(query: string): string | undefined {
  const lower = query.toLowerCase();
  if (lower.includes('콘트라베이스') || lower.includes('contrabass') || lower.includes('cont')) return 'CONTRABASS';
  if (lower.includes('비올라') || lower.includes('viola')) return 'VIOLA';
  if (lower.includes('sds')) return 'SDS+';
  if (lower.includes('부트') || lower.includes('boot')) return 'Boot Factory';
  return undefined;
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
  lines.push(`- project: ${bundle.project}`);
  lines.push(`- component: ${bundle.componentName}`);
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
  lines.push('다음 액션:');
  lines.push('- main vue를 기준으로 필요한 마크업/바인딩만 복사');
  lines.push('- script/style는 필요한 부분만 프로젝트 코드에 맞게 조정');

  return lines.join('\n');
}

export async function searchPublisherCodeTool(
  publisherService: PublisherService,
  args: unknown
) {
  const { query, project: argProject, maxResults = 3, refreshIndex = false } = args as SearchPublisherCodeArgs;

  if (!query || !query.trim()) {
    return {
      content: [{ type: 'text', text: '❌ query가 비어 있습니다. 검색어를 입력해주세요.' }],
      isError: true,
    };
  }

  try {
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

    const repoStatus = await publisherService.ensureRepo({
      repoUrl: process.env.PUBLISHER_REPO_URL,
      fallbackPath: process.env.PUBLISHER_REPO_PATH,
    });

    await publisherService.buildOrLoadIndex(repoStatus.repoPath, repoStatus.gitCommit, Boolean(refreshIndex));

    const project = argProject || detectProject(query);
    const bundles = publisherService.searchBundles(query, { project, maxResults });

    if (!bundles.length) {
      const lines = [
        `❌ "${query}"에 대한 퍼블 코드 번들을 찾지 못했습니다.`,
        '',
        '확인해볼 내용:',
        '- 프로젝트/메뉴명을 더 구체적으로 입력해보세요.',
        '- 퍼블 저장소 구조가 최근에 크게 변경됐다면 refreshIndex=true로 재시도하세요.',
        `- 동기화 상태: ${repoStatus.syncMessage}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    lastPublisherBundleState = {
      query,
      repoPath: repoStatus.repoPath,
      gitCommit: repoStatus.gitCommit,
      bundles,
    };

    const lines: string[] = [];
    lines.push('📦 퍼블 코드 번들 검색 결과');
    lines.push('');
    lines.push(`- query: ${query}`);
    lines.push(`- repo source: ${repoStatus.source}`);
    lines.push(`- repo path: ${repoStatus.repoPath}`);
    lines.push(`- git commit: ${repoStatus.gitCommit}`);
    lines.push('');

    bundles.forEach((bundle, index) => {
      lines.push(`${index + 1}. ${bundle.componentName} (${bundle.project})`);
      lines.push(`   - score: ${bundle.score}`);
      lines.push(`   - main: ${bundle.mainFile}`);
      lines.push('   - scripts:');
      lines.push(formatList(bundle.relatedScripts, '연관 script 없음'));
      lines.push('   - styles:');
      lines.push(formatList(bundle.relatedStyles, '연관 style 없음'));
      lines.push('   - shared components:');
      lines.push(formatList(bundle.sharedComponents, '연관 shared component 없음'));
      lines.push('');
    });

    lines.push('다음 액션:');
    lines.push('- 번호를 입력하면 상세 스니펫을 보여줍니다. (예: "1", "2번")');
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
            '- SSH 키로 Bitbucket 접근이 가능한지\n' +
            '- PUBLISHER_REPO_PATH fallback 경로가 설정되어 있는지\n' +
            '- git clone/pull 권한이 있는지',
        },
      ],
      isError: true,
    };
  }
}

