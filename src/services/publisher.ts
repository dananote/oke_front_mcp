import { execFile } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type RepoSource = 'auto' | 'fallback';
type RepoIssueCode = 'ssh_auth' | 'network' | 'repo_url' | 'permission' | 'path' | 'policy' | 'unknown';
type SolutionKey = 'contrabass' | 'viola' | 'ceph' | 'bootfactory' | 'sds' | 'shared' | 'unknown';

export interface RepoSyncIssue {
  code: RepoIssueCode;
  message: string;
  action: string;
}

export interface RepoStatus {
  repoPath: string;
  source: RepoSource;
  gitCommit: string;
  syncMessage: string;
  degraded: boolean;
  syncIssues: RepoSyncIssue[];
}

export interface PublisherFileEntry {
  id: string;
  filePath: string;
  project: string;
  solution: SolutionKey;
  menuPath: string;
  entity: string;
  pageType: 'list' | 'create' | 'detail' | 'edit' | 'modal' | 'component' | 'unknown';
  isModal: boolean;
  fileType: 'vue' | 'script' | 'style' | 'other';
  componentName: string;
  keywords: string[];
  styleRefs: string[];
  sharedComponentRefs: string[];
  localVueRefs: string[];
  modalRefs: string[];
  directoryPath: string;
}

export interface PublisherBundle {
  project: string;
  solution: SolutionKey;
  menuPath: string;
  entity: string;
  pageType: PublisherFileEntry['pageType'];
  score: number;
  mainFile: string;
  componentName: string;
  relatedScripts: string[];
  relatedStyles: string[];
  sharedComponents: string[];
  relatedModals: string[];
}

interface PublisherIndex {
  version: string;
  lastIndexedAt: string;
  repoPath: string;
  gitCommit: string;
  entries: PublisherFileEntry[];
}

interface EnsureRepoOptions {
  repoUrl?: string;
  fallbackPath?: string;
}

interface SearchBundleOptions {
  project?: string;
  maxResults?: number;
}

export class PublisherService {
  private indexPath: string;
  private index: PublisherIndex | null = null;

  constructor(indexPath?: string) {
    this.indexPath = this.resolveIndexPath(indexPath);
  }

  private resolveIndexPath(indexPath?: string): string {
    if (indexPath) return indexPath;
    if (process.env.PUBLISHER_INDEX_PATH) return process.env.PUBLISHER_INDEX_PATH;

    const modulePath = fileURLToPath(import.meta.url);
    return path.resolve(path.dirname(modulePath), '..', '..', 'data', 'publisher-index.json');
  }

  private getAutoRepoPath(): string {
    if (process.env.PUBLISHER_CACHE_PATH?.trim()) {
      return process.env.PUBLISHER_CACHE_PATH.trim();
    }
    return path.join(os.homedir(), '.oke-front-mcp', 'publisher', 'okestro-ui');
  }

  private async runGit(args: string[], workingDirectory?: string): Promise<string> {
    const gitArgs = workingDirectory ? ['-C', workingDirectory, ...args] : args;
    try {
      const { stdout } = await execFileAsync('git', gitArgs, {
        timeout: 120000,
        maxBuffer: 5 * 1024 * 1024,
      });
      return stdout.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`git command failed: git ${gitArgs.join(' ')}\n${message}`);
    }
  }

  private async getGitCommit(repoPath: string): Promise<string> {
    return this.runGit(['rev-parse', 'HEAD'], repoPath);
  }

  private classifyRepoError(rawMessage: string): RepoSyncIssue {
    const lower = rawMessage.toLowerCase();
    if (
      lower.includes('permission denied (publickey)') ||
      lower.includes('could not read from remote repository') ||
      lower.includes('authentication failed')
    ) {
      return {
        code: 'ssh_auth',
        message: rawMessage,
        action: 'SSH 키를 등록하고 `ssh -T git@bitbucket.org`로 접속을 확인하세요.',
      };
    }
    if (
      lower.includes('could not resolve host') ||
      lower.includes('operation timed out') ||
      lower.includes('connection timed out') ||
      lower.includes('network is unreachable')
    ) {
      return {
        code: 'network',
        message: rawMessage,
        action: '네트워크/VPN 상태를 확인하고 Bitbucket 도메인 접근 가능 여부를 점검하세요.',
      };
    }
    if (lower.includes('repository not found') || lower.includes('not found')) {
      return {
        code: 'repo_url',
        message: rawMessage,
        action: 'PUBLISHER_REPO_URL 값을 확인하고 저장소 접근 권한이 있는지 점검하세요.',
      };
    }
    if (lower.includes('not a git repository') || lower.includes('no such file or directory')) {
      return {
        code: 'path',
        message: rawMessage,
        action: 'PUBLISHER_CACHE_PATH/PUBLISHER_REPO_PATH 경로가 올바른지 확인하세요.',
      };
    }
    if (lower.includes('access denied') || lower.includes('permission denied')) {
      return {
        code: 'permission',
        message: rawMessage,
        action: '저장소 또는 로컬 경로 권한을 확인하세요.',
      };
    }
    return {
      code: 'unknown',
      message: rawMessage,
      action: '오류 메시지를 확인한 뒤 SSH/경로/권한 설정을 순서대로 점검하세요.',
    };
  }

  private toProjectLabel(solution: SolutionKey): string {
    switch (solution) {
      case 'contrabass':
        return 'CONTRABASS';
      case 'viola':
        return 'VIOLA';
      case 'ceph':
      case 'sds':
        return 'SDS+';
      case 'bootfactory':
        return 'Boot Factory';
      case 'shared':
        return 'shared';
      default:
        return 'unknown';
    }
  }

  private deriveSolutionAndMenu(relativePath: string): { solution: SolutionKey; menuPath: string } {
    const normalized = this.toPosix(relativePath).replace(/^\/+/, '');
    const segments = normalized.split('/');
    const rootIndex = segments.findIndex(
      segment => segment === 'views' || segment === 'router' || segment.startsWith('publishing-')
    );
    const fromRoot = rootIndex >= 0 ? segments.slice(rootIndex) : segments;
    const publishingIndex = fromRoot.findIndex(segment => segment.startsWith('publishing-'));
    if (publishingIndex < 0) {
      if (normalized.includes('/components/')) {
        return { solution: 'shared', menuPath: 'shared/components' };
      }
      return { solution: 'unknown', menuPath: 'unknown' };
    }

    const publishingSegment = fromRoot[publishingIndex].toLowerCase();
    let solution: SolutionKey = 'unknown';
    if (publishingSegment.includes('contrbass') || publishingSegment.includes('contrabass')) solution = 'contrabass';
    else if (publishingSegment.includes('viola')) solution = 'viola';
    else if (publishingSegment.includes('ceph')) solution = 'ceph';
    else if (publishingSegment.includes('bootfactory') || publishingSegment.includes('publishing-boot')) solution = 'bootfactory';
    else if (publishingSegment.includes('sds')) solution = 'sds';

    const menuSegments = fromRoot.slice(publishingIndex + 1, -1);
    const menuPath =
      menuSegments
        .filter(Boolean)
        .join('/')
        .toLowerCase() || 'root';
    return { solution, menuPath };
  }

  private deriveEntityAndPageType(relativePath: string, componentName: string): {
    entity: string;
    pageType: PublisherFileEntry['pageType'];
    isModal: boolean;
  } {
    const lowerPath = relativePath.toLowerCase();
    const lowerName = componentName.toLowerCase();
    const nameTokens = this.tokenize(componentName);
    const semanticTokens = nameTokens.filter(token =>
      !['storage', 'compute', 'management', 'monitoring', 'setting', 'workflow', 'catalog', 'access'].includes(token)
    );
    const entity = semanticTokens[0] || 'unknown';

    const isModal = lowerName.includes('modal') || lowerPath.includes('/modal/');
    if (isModal) return { entity, pageType: 'modal', isModal: true };
    if (lowerName.endsWith('create') || lowerPath.includes('create')) return { entity, pageType: 'create', isModal: false };
    if (lowerName.endsWith('detail') || lowerPath.includes('detail')) return { entity, pageType: 'detail', isModal: false };
    if (lowerName.endsWith('edit') || lowerPath.includes('edit')) return { entity, pageType: 'edit', isModal: false };
    if (lowerPath.includes('/components/')) return { entity, pageType: 'component', isModal: false };
    if (lowerName.endsWith('list') || lowerPath.includes('/list')) return { entity, pageType: 'list', isModal: false };
    return { entity, pageType: 'unknown', isModal: false };
  }

  private async syncRepo(repoPath: string): Promise<string> {
    await this.runGit(['pull', '--ff-only'], repoPath);
    return 'git pull --ff-only 완료';
  }

  private async cloneRepo(repoPath: string, repoUrl: string): Promise<string> {
    await fs.mkdir(path.dirname(repoPath), { recursive: true });
    await this.runGit(['clone', repoUrl, repoPath]);
    return 'git clone 완료';
  }

  async ensureRepo(options?: EnsureRepoOptions): Promise<RepoStatus> {
    const repoUrl = options?.repoUrl || process.env.PUBLISHER_REPO_URL || 'git@bitbucket.org:okestrolab/okestro-ui.git';
    const fallbackPath = options?.fallbackPath || process.env.PUBLISHER_REPO_PATH;
    const autoRepoPath = this.getAutoRepoPath();

    let autoError: string | null = null;
    const syncIssues: RepoSyncIssue[] = [];
    if (!repoUrl.startsWith('git@')) {
      syncIssues.push({
        code: 'policy',
        message: `SSH 우선 정책 위반: ${repoUrl}`,
        action: 'PUBLISHER_REPO_URL을 SSH 형식(git@bitbucket.org:org/repo.git)으로 설정하세요.',
      });
    }

    try {
      let syncMessage = '';
      if (existsSync(path.join(autoRepoPath, '.git'))) {
        try {
          syncMessage = await this.syncRepo(autoRepoPath);
        } catch (error) {
          const syncError = error instanceof Error ? error.message : String(error);
          syncIssues.push(this.classifyRepoError(syncError));
          const gitCommit = await this.getGitCommit(autoRepoPath);
          return {
            repoPath: autoRepoPath,
            source: 'auto',
            gitCommit,
            syncMessage: `git pull 실패로 기존 캐시 사용: ${syncError}`,
            degraded: true,
            syncIssues,
          };
        }
      } else {
        if (!repoUrl.startsWith('git@')) {
          throw new Error(`SSH 우선 정책으로 clone 중단: ${repoUrl}`);
        }
        syncMessage = await this.cloneRepo(autoRepoPath, repoUrl);
      }

      const gitCommit = await this.getGitCommit(autoRepoPath);
      return { repoPath: autoRepoPath, source: 'auto', gitCommit, syncMessage, degraded: false, syncIssues };
    } catch (error) {
      autoError = error instanceof Error ? error.message : String(error);
      syncIssues.push(this.classifyRepoError(autoError));
    }

    if (fallbackPath && existsSync(path.join(fallbackPath, '.git'))) {
      const gitCommit = await this.getGitCommit(fallbackPath);
      return {
        repoPath: fallbackPath,
        source: 'fallback',
        gitCommit,
        syncMessage: `자동 동기화 실패로 fallback 경로 사용 (${fallbackPath})`,
        degraded: true,
        syncIssues,
      };
    }

    throw new Error(
      `퍼블 저장소 동기화에 실패했습니다.\n` +
        `- auto path: ${autoRepoPath}\n` +
        `- auto error: ${autoError || 'unknown'}\n` +
        `- fallback path: ${fallbackPath || '(미설정)'}`
    );
  }

  private async loadIndex(): Promise<void> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as PublisherIndex;
      parsed.entries = parsed.entries.map((entry) => {
        const taxonomy = this.deriveSolutionAndMenu(entry.filePath);
        const semantic = this.deriveEntityAndPageType(entry.filePath, entry.componentName);
        const normalizedProject =
          !entry.project || entry.project === 'unknown'
            ? this.toProjectLabel(taxonomy.solution)
            : entry.project;
        return {
          ...entry,
          solution: entry.solution || taxonomy.solution,
          menuPath: entry.menuPath || taxonomy.menuPath,
          entity: entry.entity || semantic.entity,
          pageType: entry.pageType || semantic.pageType,
          isModal: typeof entry.isModal === 'boolean' ? entry.isModal : semantic.isModal,
          localVueRefs: entry.localVueRefs || [],
          modalRefs: entry.modalRefs || [],
          project: normalizedProject,
        };
      });
      this.index = parsed;
    } catch {
      this.index = null;
    }
  }

  private async saveIndex(index: PublisherIndex): Promise<void> {
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    this.index = index;
  }

  private toPosix(relativePath: string): string {
    return relativePath.split(path.sep).join('/');
  }

  private detectFileType(filePath: string): PublisherFileEntry['fileType'] {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.vue') return 'vue';
    if (ext === '.ts' || ext === '.js') return 'script';
    if (ext === '.scss' || ext === '.sass' || ext === '.css') return 'style';
    return 'other';
  }

  private tokenize(text: string): string[] {
    return Array.from(
      new Set(
        text
          .replace(/[^\w가-힣/.-]/g, ' ')
          .replace(/[_./-]/g, ' ')
          .toLowerCase()
          .split(/\s+/)
          .filter(token => token.length > 1)
      )
    );
  }

  private extractImportRefs(content: string, currentDir: string): {
    styleRefs: string[];
    sharedRefs: string[];
    localVueRefs: string[];
    modalRefs: string[];
  } {
    const importRegex = /from\s+['"]([^'"]+)['"]|@import\s+['"]([^'"]+)['"]/g;
    const styleRefs: string[] = [];
    const sharedRefs: string[] = [];
    const localVueRefs: string[] = [];
    const modalRefs: string[] = [];
    const seenStyle = new Set<string>();
    const seenShared = new Set<string>();
    const seenLocalVue = new Set<string>();
    const seenModal = new Set<string>();

    let match = importRegex.exec(content);
    while (match) {
      const rawRef = (match[1] || match[2] || '').trim();
      if (rawRef) {
        if (rawRef.endsWith('.scss') || rawRef.endsWith('.sass') || rawRef.endsWith('.css')) {
          const resolved = rawRef.startsWith('.')
            ? this.toPosix(path.normalize(path.join(currentDir, rawRef)))
            : rawRef;
          if (!seenStyle.has(resolved)) {
            seenStyle.add(resolved);
            styleRefs.push(resolved);
          }
        }

        if (rawRef.includes('/components/') || rawRef.startsWith('@/components/')) {
          if (!seenShared.has(rawRef)) {
            seenShared.add(rawRef);
            sharedRefs.push(rawRef);
          }
        }

        if (rawRef.endsWith('.vue')) {
          const resolved = rawRef.startsWith('.')
            ? this.toPosix(path.normalize(path.join(currentDir, rawRef)))
            : rawRef.startsWith('@/')
              ? this.toPosix(path.normalize(path.join('src', rawRef.slice(2))))
              : rawRef;
          if (!seenLocalVue.has(resolved)) {
            seenLocalVue.add(resolved);
            localVueRefs.push(resolved);
          }
          if ((/modal/i.test(rawRef) || /modal/i.test(resolved)) && !seenModal.has(resolved)) {
            seenModal.add(resolved);
            modalRefs.push(resolved);
          }
        }
      }
      match = importRegex.exec(content);
    }

    return { styleRefs, sharedRefs, localVueRefs, modalRefs };
  }

  private async walkFiles(directoryPath: string): Promise<string[]> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const collected: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.walkFiles(fullPath);
        collected.push(...nested);
        continue;
      }
      collected.push(fullPath);
    }
    return collected;
  }

  private async buildIndex(repoPath: string, gitCommit: string): Promise<PublisherIndex> {
    const srcPath = path.join(repoPath, 'src');
    if (!existsSync(srcPath)) {
      throw new Error(`퍼블 저장소 src 경로를 찾을 수 없습니다: ${srcPath}`);
    }

    const allFiles = await this.walkFiles(srcPath);
    const allowedExt = new Set(['.vue', '.ts', '.js', '.scss', '.sass', '.css']);

    const entries: PublisherFileEntry[] = [];
    for (const absolutePath of allFiles) {
      const ext = path.extname(absolutePath).toLowerCase();
      if (!allowedExt.has(ext)) continue;

      const relative = this.toPosix(path.relative(repoPath, absolutePath));
      const componentName = path.basename(relative, ext);
      const directoryPath = this.toPosix(path.dirname(relative));
      const fileType = this.detectFileType(relative);
      const keywords = this.tokenize(`${relative} ${componentName}`);
      const taxonomy = this.deriveSolutionAndMenu(relative);
      const semantic = this.deriveEntityAndPageType(relative, componentName);

      let styleRefs: string[] = [];
      let sharedComponentRefs: string[] = [];
      let localVueRefs: string[] = [];
      let modalRefs: string[] = [];
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const refs = this.extractImportRefs(content, directoryPath);
        styleRefs = refs.styleRefs;
        sharedComponentRefs = refs.sharedRefs;
        localVueRefs = refs.localVueRefs;
        modalRefs = refs.modalRefs;
      } catch {
        // ignore parsing failures for binary/encoding edge cases
      }

      entries.push({
        id: relative,
        filePath: relative,
        project: this.toProjectLabel(taxonomy.solution),
        solution: taxonomy.solution,
        menuPath: taxonomy.menuPath,
        entity: semantic.entity,
        pageType: semantic.pageType,
        isModal: semantic.isModal,
        fileType,
        componentName,
        keywords,
        styleRefs,
        sharedComponentRefs,
        localVueRefs,
        modalRefs,
        directoryPath,
      });
    }

    return {
      version: '1.0',
      lastIndexedAt: new Date().toISOString(),
      repoPath,
      gitCommit,
      entries,
    };
  }

  async buildOrLoadIndex(repoPath: string, gitCommit: string, forceRebuild: boolean = false): Promise<PublisherIndex> {
    await this.loadIndex();

    if (
      !forceRebuild &&
      this.index &&
      this.index.repoPath === repoPath &&
      this.index.gitCommit === gitCommit &&
      this.index.entries.length > 0
    ) {
      return this.index;
    }

    const rebuilt = await this.buildIndex(repoPath, gitCommit);
    await this.saveIndex(rebuilt);
    return rebuilt;
  }

  async loadCachedIndex(): Promise<PublisherIndex | null> {
    await this.loadIndex();
    return this.index;
  }

  private detectProjectFromQuery(query: string): string | undefined {
    const lower = query.toLowerCase();
    if (lower.includes('콘트라베이스') || lower.includes('contrabass') || lower.includes('cont')) return 'CONTRABASS';
    if (lower.includes('비올라') || lower.includes('viola')) return 'VIOLA';
    if (lower.includes('ceph') || lower.includes('스토리지') || lower.includes('sds')) return 'SDS+';
    if (lower.includes('부트') || lower.includes('boot')) return 'Boot Factory';
    return undefined;
  }

  private matchScore(entry: PublisherFileEntry, tokens: string[]): number {
    const pathText = entry.filePath.toLowerCase();
    const componentText = entry.componentName.toLowerCase();
    const menuText = entry.menuPath.toLowerCase();
    const entityText = entry.entity.toLowerCase();
    let score = 0;
    let matched = false;

    for (const token of tokens) {
      if (componentText.includes(token)) {
        score += 4;
        matched = true;
      }
      if (pathText.includes(token)) {
        score += 2;
        matched = true;
      }
      if (entry.keywords.includes(token)) {
        score += 1;
        matched = true;
      }
      if (menuText.includes(token)) {
        score += 3;
        matched = true;
      }
      if (entityText.includes(token)) {
        score += 3;
        matched = true;
      }
    }

    if (!matched) {
      return 0;
    }

    if (entry.fileType === 'vue') score += 1;
    if (entry.project === 'shared') score -= 1;
    if (tokens.includes('create') && (componentText.includes('create') || pathText.includes('create'))) {
      score += 5;
    }
    if (tokens.includes('volume') && (menuText.includes('volume') || pathText.includes('/volume/'))) {
      score += 4;
    }
    if (tokens.includes('storage') && menuText.includes('storage')) {
      score += 2;
    }
    if (tokens.includes('modal') && entry.isModal) {
      score += 5;
    }
    if (tokens.includes('detail') && entry.pageType === 'detail') {
      score += 3;
    }
    return Math.max(score, 0);
  }

  searchBundles(query: string, options?: SearchBundleOptions): PublisherBundle[] {
    if (!this.index) {
      throw new Error('publisher index가 로드되지 않았습니다.');
    }
    const index = this.index;

    const tokens = this.tokenize(query);
    const project = options?.project || this.detectProjectFromQuery(query);
    const requestedSolution = (() => {
      if (!project) return undefined;
      if (project === 'CONTRABASS') return 'contrabass';
      if (project === 'VIOLA') return 'viola';
      if (project === 'Boot Factory') return 'bootfactory';
      if (project === 'SDS+') return 'sds';
      return undefined;
    })();
    const maxResults = options?.maxResults ?? 3;

    const scopedEntries = index.entries.filter(entry => {
      const byProject = !project || entry.project === project || entry.project === 'shared';
      if (!requestedSolution) return byProject;
      if (requestedSolution === 'sds') {
        return byProject && (entry.solution === 'sds' || entry.solution === 'ceph' || entry.solution === 'shared');
      }
      return byProject && (entry.solution === requestedSolution || entry.solution === 'shared');
    });

    const rankedVueEntries = scopedEntries
      .filter(entry => entry.fileType === 'vue')
      .map(entry => ({ entry, score: this.matchScore(entry, tokens) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(maxResults, 1));

    const entriesByPath = new Map(index.entries.map(entry => [entry.filePath, entry]));

    return rankedVueEntries.map(item => {
      const main = item.entry;
      const sameDirEntries = scopedEntries.filter(entry => entry.directoryPath === main.directoryPath && entry.filePath !== main.filePath);

      const relatedScripts = sameDirEntries
        .filter(entry => entry.fileType === 'script')
        .map(entry => entry.filePath)
        .slice(0, 5);

      const modalSet = new Set<string>();
      for (const ref of main.modalRefs) {
        modalSet.add(ref);
      }
      for (const ref of main.localVueRefs) {
        if (/modal/i.test(ref)) modalSet.add(ref);
      }
      for (const entry of sameDirEntries.filter(entry => entry.isModal)) {
        modalSet.add(entry.filePath);
      }
      for (const entry of scopedEntries.filter(entry => entry.isModal)) {
        if (entry.entity === main.entity && entry.menuPath.includes(main.menuPath.split('/')[0] || '')) {
          modalSet.add(entry.filePath);
        }
      }

      const styleSet = new Set<string>();
      for (const sameDirStyle of sameDirEntries.filter(entry => entry.fileType === 'style')) {
        styleSet.add(sameDirStyle.filePath);
      }
      for (const ref of main.styleRefs) {
        if (entriesByPath.has(ref)) {
          styleSet.add(ref);
        } else if (ref.includes('src/')) {
          styleSet.add(ref);
        }
      }

      const sharedSet = new Set<string>();
      for (const ref of main.sharedComponentRefs) {
        sharedSet.add(ref);
      }
      for (const sharedEntry of index.entries.filter(entry => entry.project === 'shared')) {
        const sharedScore = this.matchScore(sharedEntry, tokens);
        if (sharedScore > 2) {
          sharedSet.add(sharedEntry.filePath);
        }
      }

      return {
        project: main.project,
        solution: main.solution,
        menuPath: main.menuPath,
        entity: main.entity,
        pageType: main.pageType,
        score: item.score,
        mainFile: main.filePath,
        componentName: main.componentName,
        relatedScripts,
        relatedStyles: Array.from(styleSet).slice(0, 8),
        sharedComponents: Array.from(sharedSet).slice(0, 8),
        relatedModals: Array.from(modalSet).slice(0, 8),
      };
    });
  }
}

