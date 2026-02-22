/**
 * 검색 서비스
 *
 * 메타데이터 인덱스를 기반으로 자연어 검색 수행
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

interface ScreenMetadata {
  screenId: string;
  pageTitle: string;
  description?: string; // 추가
  author: string;
  keywords: string[];
  project: string;
  version: string;
  fileKey: string;
  fileName: string;
  nodeId: string;
  lastModified: string;
}

interface SearchResult {
  screen: ScreenMetadata;
  score: number;
  matchedKeywords: string[];
}

// 그룹화된 검색 결과 (신규)
interface GroupedSearchResult {
  project: string;
  versions: {
    version: string;
    screens: SearchResult[];
  }[];
}

export type { ScreenMetadata, SearchResult, GroupedSearchResult };

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

export class SearchService {
  private index: MetadataIndex | null = null;
  private indexPath: string;

  constructor(indexPath?: string) {
    this.indexPath = this.resolveIndexPath(indexPath);
  }

  private resolveIndexPath(indexPath?: string): string {
    if (indexPath) {
      return indexPath;
    }

    if (process.env.SCREEN_INDEX_PATH) {
      return process.env.SCREEN_INDEX_PATH;
    }

    const cwdPath = path.join(process.cwd(), "data", "screen-index.json");
    if (existsSync(cwdPath)) {
      return cwdPath;
    }

    // dist/services/search.js 또는 src/services/search.ts 기준으로 항상 프로젝트 루트의 data 경로를 계산
    const modulePath = fileURLToPath(import.meta.url);
    const moduleRelativePath = path.resolve(
      path.dirname(modulePath),
      "..",
      "..",
      "data",
      "screen-index.json",
    );
    return moduleRelativePath;
  }

  /**
   * 인덱스 로드
   */
  async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, "utf-8");
      this.index = JSON.parse(data);
    } catch (error) {
      throw new Error(
        "메타데이터 인덱스를 찾을 수 없습니다. collect-metadata 스크립트를 먼저 실행해주세요.",
      );
    }
  }

  /**
   * 검색어에서 키워드 추출
   */
  private extractSearchKeywords(query: string): string[] {
    const cleaned = query
      .replace(/[^\w가-힣\s]/g, " ")
      .toLowerCase()
      .trim();

    return cleaned.split(/\s+/).filter((w) => w.length > 1);
  }

  /**
   * 키워드 매칭 점수 계산 (description 포함)
   */
  private calculateScore(
    screen: ScreenMetadata,
    searchKeywords: string[],
  ): { score: number; matchedKeywords: string[] } {
    let score = 0;
    const matchedKeywords: string[] = [];

    for (const searchKeyword of searchKeywords) {
      // Screen ID에 포함 (최고 점수)
      if (screen.screenId.toLowerCase().includes(searchKeyword)) {
        score += 10;
        matchedKeywords.push(searchKeyword);
      }

      // Page Title에 포함 (높은 점수)
      if (screen.pageTitle.toLowerCase().includes(searchKeyword)) {
        score += 8;
        matchedKeywords.push(searchKeyword);
      }

      // Description에 포함 (중간 점수)
      if (
        screen.description &&
        screen.description.toLowerCase().includes(searchKeyword)
      ) {
        score += 5;
        matchedKeywords.push(searchKeyword);
      }

      // Keywords 배열에 포함 (기본 점수)
      for (const screenKeyword of screen.keywords) {
        // 완전 일치
        if (screenKeyword === searchKeyword) {
          score += 3;
          matchedKeywords.push(searchKeyword);
        }
        // 부분 일치
        else if (
          screenKeyword.includes(searchKeyword) ||
          searchKeyword.includes(screenKeyword)
        ) {
          score += 1;
          matchedKeywords.push(searchKeyword);
        }
      }
    }

    return { score, matchedKeywords: Array.from(new Set(matchedKeywords)) };
  }

  /**
   * 자연어 검색
   */
  async search(
    query: string,
    project?: string,
    version?: string,
    maxResults: number = 5,
  ): Promise<SearchResult[]> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      return [];
    }

    const searchKeywords = this.extractSearchKeywords(query);
    const results: SearchResult[] = [];

    // 프로젝트 필터
    const projectsToSearch = project
      ? [project]
      : Object.keys(this.index.projects);

    for (const projectName of projectsToSearch) {
      const projectData = this.index.projects[projectName];
      if (!projectData) continue;

      // 버전 필터
      const versionsToSearch = version
        ? [version]
        : Object.keys(projectData.versions);

      for (const versionName of versionsToSearch) {
        const versionData = projectData.versions[versionName];
        if (!versionData) continue;

        // 각 화면에 대해 점수 계산
        for (const screen of versionData.screens) {
          const { score, matchedKeywords } = this.calculateScore(
            screen,
            searchKeywords,
          );

          if (score > 0) {
            results.push({
              screen,
              score,
              matchedKeywords,
            });
          }
        }
      }
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.score - a.score);

    // 상위 N개 반환
    return results.slice(0, maxResults);
  }

  /**
   * 자연어 검색 (그룹화된 결과 반환)
   */
  async searchGrouped(
    query: string,
    maxResults: number = 20,
  ): Promise<GroupedSearchResult[]> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      return [];
    }

    const searchKeywords = this.extractSearchKeywords(query);
    const allResults: SearchResult[] = [];

    // 모든 프로젝트/버전 검색
    for (const projectName of Object.keys(this.index.projects)) {
      const projectData = this.index.projects[projectName];

      for (const versionName of Object.keys(projectData.versions)) {
        const versionData = projectData.versions[versionName];

        for (const screen of versionData.screens) {
          const { score, matchedKeywords } = this.calculateScore(
            screen,
            searchKeywords,
          );

          if (score > 0) {
            allResults.push({
              screen,
              score,
              matchedKeywords,
            });
          }
        }
      }
    }

    // 점수 내림차순 정렬
    allResults.sort((a, b) => b.score - a.score);

    // 상위 N개만 선택
    const topResults = allResults.slice(0, maxResults);

    // 프로젝트/버전별로 그룹화
    const grouped: Map<string, Map<string, SearchResult[]>> = new Map();

    for (const result of topResults) {
      const project = result.screen.project;
      const version = result.screen.version;

      if (!grouped.has(project)) {
        grouped.set(project, new Map());
      }

      const projectMap = grouped.get(project)!;
      if (!projectMap.has(version)) {
        projectMap.set(version, []);
      }

      projectMap.get(version)!.push(result);
    }

    // Map을 배열로 변환
    const groupedResults: GroupedSearchResult[] = [];
    for (const [project, versionMap] of grouped.entries()) {
      const versions = [];
      for (const [version, screens] of versionMap.entries()) {
        versions.push({ version, screens });
      }
      groupedResults.push({ project, versions });
    }

    return groupedResults;
  }

  /**
   * 인덱스 통계
   */
  async getStats(): Promise<{
    totalScreens: number;
    projects: string[];
    lastUpdated: string;
  } | null> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      return null;
    }

    return {
      totalScreens: this.index.totalScreens,
      projects: Object.keys(this.index.projects),
      lastUpdated: this.index.lastUpdated,
    };
  }

  /**
   * 새로운 화면을 metadata에 추가 (학습)
   */
  async addScreen(screen: ScreenMetadata): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error("메타데이터 인덱스를 로드할 수 없습니다.");
    }

    // 프로젝트가 없으면 생성
    if (!this.index.projects[screen.project]) {
      this.index.projects[screen.project] = { versions: {} };
    }

    // 버전이 없으면 생성
    if (!this.index.projects[screen.project].versions[screen.version]) {
      this.index.projects[screen.project].versions[screen.version] = {
        fileKey: screen.fileKey,
        fileName: screen.fileName,
        screens: [],
      };
    }

    // 중복 확인
    const versionData =
      this.index.projects[screen.project].versions[screen.version];
    const exists = versionData.screens.some(
      (s) => s.screenId === screen.screenId,
    );

    if (!exists) {
      versionData.screens.push(screen);
      this.index.totalScreens++;
      this.index.lastUpdated = new Date().toISOString();

      // 파일에 저장
      await this.saveIndex();
    }
  }

  /**
   * 기존 화면의 상세 정보 업데이트 (지연 로딩)
   *
   * @param screenId 화면 ID
   * @param project 프로젝트명
   * @param version 버전
   * @param details 업데이트할 상세 정보
   */
  async updateScreenDetail(
    screenId: string,
    project: string,
    version: string,
    details: {
      pageTitle?: string;
      author?: string;
      description?: string;
    },
  ): Promise<boolean> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      return false;
    }

    // 화면 찾기
    const projectData = this.index.projects[project];
    if (!projectData) return false;

    const versionData = projectData.versions[version];
    if (!versionData) return false;

    const screen = versionData.screens.find((s) => s.screenId === screenId);
    if (!screen) return false;

    // 상세 정보 업데이트
    let updated = false;

    if (details.pageTitle && details.pageTitle !== "Unknown") {
      screen.pageTitle = details.pageTitle;
      updated = true;
    }

    if (details.author && details.author !== "N/A") {
      screen.author = details.author;
      updated = true;
    }

    if (details.description !== undefined && details.description !== "") {
      screen.description = details.description;
      updated = true;
    }

    // 키워드 재생성 (업데이트된 정보 반영)
    if (updated) {
      screen.keywords = this.extractSearchKeywords(
        `${screen.screenId} ${screen.pageTitle} ${screen.description}`,
      );
      screen.lastModified = new Date().toISOString();
      this.index.lastUpdated = new Date().toISOString();

      // 파일에 저장
      await this.saveIndex();
      console.log(`   🎓 화면 상세 정보 업데이트 완료: ${screenId}`);
    }

    return updated;
  }

  /**
   * 인덱스 저장
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    try {
      const fs = await import("fs/promises");
      await fs.writeFile(
        this.indexPath,
        JSON.stringify(this.index, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("메타데이터 저장 실패:", error);
    }
  }
}
