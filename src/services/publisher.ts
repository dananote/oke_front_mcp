import { execFile } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type RepoSource = 'auto' | 'fallback';

export interface RepoStatus {
  repoPath: string;
  source: RepoSource;
  gitCommit: string;
  syncMessage: string;
}

export interface PublisherFileEntry {
  id: string;
  filePath: string;
  project: string;
  fileType: 'vue' | 'script' | 'style' | 'other';
  componentName: string;
  keywords: string[];
  styleRefs: string[];
  sharedComponentRefs: string[];
  directoryPath: string;
}

export interface PublisherBundle {
  project: string;
  score: number;
  mainFile: string;
  componentName: string;
  relatedScripts: string[];
  relatedStyles: string[];
  sharedComponents: string[];
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

    try {
      let syncMessage = '';
      if (existsSync(path.join(autoRepoPath, '.git'))) {
        syncMessage = await this.syncRepo(autoRepoPath);
      } else {
        syncMessage = await this.cloneRepo(autoRepoPath, repoUrl);
      }

      const gitCommit = await this.getGitCommit(autoRepoPath);
      return { repoPath: autoRepoPath, source: 'auto', gitCommit, syncMessage };
    } catch (error) {
      autoError = error instanceof Error ? error.message : String(error);
    }

    if (fallbackPath && existsSync(path.join(fallbackPath, '.git'))) {
      const gitCommit = await this.getGitCommit(fallbackPath);
      return {
        repoPath: fallbackPath,
        source: 'fallback',
        gitCommit,
        syncMessage: `자동 동기화 실패로 fallback 경로 사용 (${fallbackPath})`,
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
      this.index = JSON.parse(raw) as PublisherIndex;
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

  private extractProjectFromPath(relativePath: string): string {
    const lower = relativePath.toLowerCase();
    if (lower.includes('/src/publishing-contrbass/')) return 'CONTRABASS';
    if (lower.includes('/src/publishing-viola/')) return 'VIOLA';
    if (lower.includes('/src/publishing-sds/')) return 'SDS+';
    if (lower.includes('/src/publishing-boot/')) return 'Boot Factory';
    if (lower.includes('/src/components/')) return 'shared';
    return 'unknown';
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

  private extractImportRefs(content: string, currentDir: string): { styleRefs: string[]; sharedRefs: string[] } {
    const importRegex = /from\s+['"]([^'"]+)['"]|@import\s+['"]([^'"]+)['"]/g;
    const styleRefs: string[] = [];
    const sharedRefs: string[] = [];
    const seenStyle = new Set<string>();
    const seenShared = new Set<string>();

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
      }
      match = importRegex.exec(content);
    }

    return { styleRefs, sharedRefs };
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

      let styleRefs: string[] = [];
      let sharedComponentRefs: string[] = [];
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const refs = this.extractImportRefs(content, directoryPath);
        styleRefs = refs.styleRefs;
        sharedComponentRefs = refs.sharedRefs;
      } catch {
        // ignore parsing failures for binary/encoding edge cases
      }

      entries.push({
        id: relative,
        filePath: relative,
        project: this.extractProjectFromPath(`/${relative}`),
        fileType,
        componentName,
        keywords,
        styleRefs,
        sharedComponentRefs,
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

  private detectProjectFromQuery(query: string): string | undefined {
    const lower = query.toLowerCase();
    if (lower.includes('콘트라베이스') || lower.includes('contrabass') || lower.includes('cont')) return 'CONTRABASS';
    if (lower.includes('비올라') || lower.includes('viola')) return 'VIOLA';
    if (lower.includes('sds')) return 'SDS+';
    if (lower.includes('부트') || lower.includes('boot')) return 'Boot Factory';
    return undefined;
  }

  private matchScore(entry: PublisherFileEntry, tokens: string[]): number {
    const pathText = entry.filePath.toLowerCase();
    const componentText = entry.componentName.toLowerCase();
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
    }

    if (!matched) {
      return 0;
    }

    if (entry.fileType === 'vue') score += 1;
    if (entry.project === 'shared') score -= 1;
    return Math.max(score, 0);
  }

  searchBundles(query: string, options?: SearchBundleOptions): PublisherBundle[] {
    if (!this.index) {
      throw new Error('publisher index가 로드되지 않았습니다.');
    }
    const index = this.index;

    const tokens = this.tokenize(query);
    const project = options?.project || this.detectProjectFromQuery(query);
    const maxResults = options?.maxResults ?? 3;

    const scopedEntries = index.entries.filter(entry => {
      if (!project) return true;
      return entry.project === project || entry.project === 'shared';
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
        score: item.score,
        mainFile: main.filePath,
        componentName: main.componentName,
        relatedScripts,
        relatedStyles: Array.from(styleSet).slice(0, 8),
        sharedComponents: Array.from(sharedSet).slice(0, 8),
      };
    });
  }
}

