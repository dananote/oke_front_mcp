/**
 * 메타데이터 수집 스크립트
 *
 * Figma의 모든 프로젝트/버전/화면 정보를 수집하여 screen-index.json 생성
 *
 * 환경변수는 Cursor settings에서만 관리됩니다.
 * npm run collect-metadata를 실행하기 전에 환경변수를 전달해야 합니다.
 */

import { FigmaService, FigmaNode } from "../services/figma.js";
import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import { homedir } from "os";

/**
 * Cursor mcp.json에서 환경변수 로드
 */
function loadEnvFromCursorSettings(): void {
  try {
    const mcpConfigPath = path.join(homedir(), ".cursor", "mcp.json");
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));

    const okeFrontMcpConfig = mcpConfig.mcpServers?.["oke-front-mcp"];
    if (okeFrontMcpConfig?.env) {
      Object.entries(okeFrontMcpConfig.env).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value as string;
        }
      });
      console.log("✅ Cursor settings에서 환경변수를 로드했습니다.\n");
    }
  } catch (error) {
    console.warn("⚠️ Cursor settings 로드 실패. 시스템 환경변수를 사용합니다.");
  }
}

// Cursor settings에서 환경변수 로드
loadEnvFromCursorSettings();

interface ScreenMetadata {
  screenId: string;
  pageTitle: string;
  description: string; // 추가: 기획 상세 설명
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
    .replace(/[^\w가-힣\s]/g, " ")
    .toLowerCase()
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  return Array.from(new Set(words));
}

/**
 * 화면 정보 추출 (경량화 버전)
 *
 * screenId, pageTitle만 수집하고 description은 빈 값으로 초기화
 * description은 사용자가 실제로 검색할 때 지연 로딩으로 채워짐
 */
function extractScreenInfo(node: FigmaNode): Partial<ScreenMetadata> | null {
  if (node.type !== "FRAME" && node.type !== "SECTION") {
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

  const normalizeText = (value: string): string =>
    value.replace(/\s+/g, " ").trim().toLowerCase();

  /**
   * 모든 TEXT 노드를 순서대로 수집
   */
  const collectAllTextNodes = (
    parent: FigmaNode,
  ): Array<{ name: string; characters: string }> => {
    const textNodes: Array<{ name: string; characters: string }> = [];

    const traverse = (n: FigmaNode): void => {
      if (n.type === "TEXT" && n.characters) {
        textNodes.push({
          name: n.name || "",
          characters: n.characters,
        });
      }

      if (n.children) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    traverse(parent);
    return textNodes;
  };

  /**
   * 라벨 다음에 오는 값 찾기 (라벨 변형/대소문자/공백 차이 허용)
   */
  const findValueAfterLabels = (
    textNodes: Array<{ name: string; characters: string }>,
    labels: string[],
  ): string | null => {
    const labelSet = new Set(labels.map(normalizeText));
    const nonValueLabels = new Set([
      ...labels.map(normalizeText),
      "screen id",
      "description",
      "changelog",
      "page title",
      "author",
    ]);

    for (let i = 0; i < textNodes.length; i++) {
      const current = textNodes[i];
      const currentName = normalizeText(current.name || "");
      const currentText = normalizeText(current.characters || "");
      const isLabel = labelSet.has(currentName) || labelSet.has(currentText);

      if (!isLabel) continue;

      // 바로 다음 노드가 아니라도, 근처에서 첫 번째 유효 값을 찾는다.
      for (let j = i + 1; j < Math.min(i + 8, textNodes.length); j++) {
        const candidateRaw = textNodes[j].characters?.trim() || "";
        const candidate = normalizeText(candidateRaw);
        if (!candidate) continue;
        if (nonValueLabels.has(candidate)) continue;
        if (/^[A-Z]+-\d{2}_\d{2}_\d{2}$/i.test(candidateRaw)) continue;
        return candidateRaw;
      }
    }

    return null;
  };

  // 모든 TEXT 노드 수집
  const textNodes = collectAllTextNodes(node);

  // Page Title 찾기
  let pageTitle = "Unknown";
  const pageTitleValue = findValueAfterLabels(textNodes, [
    "Page Title",
    "page title",
    "Title",
    "title",
    "페이지 타이틀",
  ]);
  if (pageTitleValue) {
    pageTitle = pageTitleValue.trim();
  }

  // Author 찾기
  let author = "N/A";
  const authorValue = findValueAfterLabels(textNodes, [
    "Author",
    "author",
    "작성자",
  ]);
  if (authorValue) {
    author = authorValue.trim();
  }

  // 텍스트 라벨에서 못 찾았으면 Frame 이름에서 보조 추출
  if (pageTitle === "Unknown" && node.name) {
    const titleFromName = node.name
      .replace(screenIdPattern, "")
      .replace(/^[-:\s_]+/, "")
      .trim();
    if (titleFromName) {
      pageTitle = titleFromName;
    }
  }

  // Description은 빈 값으로 초기화 (지연 로딩)
  const description = "";

  // 키워드: screenId + pageTitle만 사용 (description 제외)
  const keywords = extractKeywords(`${screenId} ${pageTitle}`);

  return {
    screenId,
    pageTitle,
    description, // 빈 값으로 초기화
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
  projectName: string,
  collectionDepth: number,
): Promise<MetadataIndex["projects"][string] | null> {
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

    const versions: MetadataIndex["projects"][string]["versions"] = {};

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
        // depth가 너무 낮으면 Page Title을 놓칠 수 있어 환경변수로 조정 가능하게 처리
        const fileContent = await figmaService.getFileContent(
          file.key,
          undefined,
          collectionDepth,
        );

        if (!fileContent?.document) {
          console.log(`      ❌ 파일 내용 없음`);
          continue;
        }

        const screens = scanFile(fileContent.document);
        console.log(`      ✓ 화면 개수: ${screens.length}`);

        const completeScreens: ScreenMetadata[] = screens.map((s) => ({
          screenId: s.screenId!,
          pageTitle: s.pageTitle!,
          description: s.description || "",
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

        completeScreens.slice(0, 3).forEach((s) => {
          console.log(`         • ${s.screenId}: ${s.pageTitle}`);
        });
        if (completeScreens.length > 3) {
          console.log(`         ... 외 ${completeScreens.length - 3}개`);
        }
      } catch (error) {
        console.error(
          `      ❌ 오류:`,
          error instanceof Error ? error.message : error,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return { versions };
  } catch (error) {
    console.error(`❌ 프로젝트 수집 실패:`, error);
    return null;
  }
}

function createEmptyMetadataIndex(): MetadataIndex {
  return {
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    totalScreens: 0,
    projects: {},
  };
}

async function loadExistingMetadata(indexPath: string): Promise<MetadataIndex> {
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as MetadataIndex;
    if (!parsed.projects || typeof parsed.projects !== "object") {
      return createEmptyMetadataIndex();
    }
    return parsed;
  } catch {
    return createEmptyMetadataIndex();
  }
}

function calculateTotalScreens(metadataIndex: MetadataIndex): number {
  let total = 0;
  Object.values(metadataIndex.projects).forEach((projectData) => {
    Object.values(projectData.versions).forEach((versionData) => {
      total += versionData.screens.length;
    });
  });
  return total;
}

function mergeProjectData(
  existingProjectData: MetadataIndex["projects"][string] | undefined,
  newlyCollectedProjectData: MetadataIndex["projects"][string],
  allowEmptyVersionOverwrite: boolean,
): {
  merged: MetadataIndex["projects"][string];
  updatedVersions: number;
  preservedVersions: number;
} {
  const existingVersions = existingProjectData?.versions ?? {};
  const mergedVersions: MetadataIndex["projects"][string]["versions"] = {
    ...existingVersions,
  };

  let updatedVersions = 0;
  let preservedVersions = 0;

  for (const [version, collectedVersionData] of Object.entries(
    newlyCollectedProjectData.versions,
  )) {
    const existingVersionData = existingVersions[version];
    const shouldPreserveExisting =
      !allowEmptyVersionOverwrite &&
      collectedVersionData.screens.length === 0 &&
      !!existingVersionData &&
      existingVersionData.screens.length > 0;

    if (shouldPreserveExisting) {
      preservedVersions++;
      continue;
    }

    mergedVersions[version] = collectedVersionData;
    updatedVersions++;
  }

  return {
    merged: { versions: mergedVersions },
    updatedVersions,
    preservedVersions,
  };
}

/**
 * 메인 실행
 */
async function main() {
  console.log("🚀 메타데이터 수집 시작...\n");

  if (!process.env.FIGMA_TOKEN || !process.env.FIGMA_TEAM_ID) {
    console.error("❌ FIGMA_TOKEN 또는 FIGMA_TEAM_ID가 설정되지 않았습니다.");
    process.exit(1);
  }

  const figmaService = new FigmaService(
    process.env.FIGMA_TOKEN,
    process.env.FIGMA_TEAM_ID,
  );
  const collectionDepth = Number(process.env.FIGMA_COLLECTION_DEPTH || "8");
  const allowEmptyVersionOverwrite =
    process.env.FIGMA_ALLOW_EMPTY_VERSION_OVERWRITE === "true";

  const projects = (process.env.SUPPORTED_PROJECTS || "CONTRABASS")
    .split(",")
    .map((p) => p.trim());

  console.log(`📋 수집 대상 프로젝트: ${projects.join(", ")}\n`);
  console.log(`🔎 수집 depth: ${collectionDepth}\n`);
  console.log(
    `🛡️ 빈 결과 덮어쓰기: ${allowEmptyVersionOverwrite ? "허용" : "차단(기존 데이터 보존)"}\n`,
  );

  const cacheDir = path.join(process.cwd(), "data");
  await fs.mkdir(cacheDir, { recursive: true });
  const indexPath = path.join(cacheDir, "screen-index.json");

  // 기존 메타데이터를 기본값으로 로드하고 성공한 버전만 갱신한다.
  const metadataIndex = await loadExistingMetadata(indexPath);
  metadataIndex.version = "1.0";
  metadataIndex.lastUpdated = new Date().toISOString();

  let updatedProjects = 0;
  let updatedVersions = 0;
  let preservedVersions = 0;
  let failedProjects = 0;

  for (const projectName of projects) {
    const projectData = await collectProjectScreens(
      figmaService,
      projectName,
      collectionDepth,
    );

    if (!projectData) {
      failedProjects++;
      console.log(`   ⚠️ ${projectName} 수집 실패 → 기존 메타데이터 유지`);
      continue;
    }

    const existingProjectData = metadataIndex.projects[projectName];
    const mergedResult = mergeProjectData(
      existingProjectData,
      projectData,
      allowEmptyVersionOverwrite,
    );

    metadataIndex.projects[projectName] = mergedResult.merged;
    updatedProjects++;
    updatedVersions += mergedResult.updatedVersions;
    preservedVersions += mergedResult.preservedVersions;

    console.log(
      `   🔄 ${projectName} 병합 완료 (업데이트 ${mergedResult.updatedVersions}개 버전, 보존 ${mergedResult.preservedVersions}개 버전)`,
    );
  }
  metadataIndex.totalScreens = calculateTotalScreens(metadataIndex);

  // 안전 저장: 기존 파일 백업 후 임시 파일에 쓰고 교체
  const backupPath = `${indexPath}.bak`;
  const tempPath = `${indexPath}.tmp`;
  try {
    await fs.copyFile(indexPath, backupPath);
  } catch {
    // 기존 파일이 없으면 백업 생략
  }
  await fs.writeFile(tempPath, JSON.stringify(metadataIndex, null, 2), "utf-8");
  await fs.rename(tempPath, indexPath);

  console.log(`\n✅ 메타데이터 수집 완료!`);
  console.log(`\n📊 통계:`);
  console.log(`   • 프로젝트: ${Object.keys(metadataIndex.projects).length}개`);
  console.log(`   • 총 화면: ${metadataIndex.totalScreens}개`);
  console.log(`   • 갱신 프로젝트: ${updatedProjects}개`);
  console.log(`   • 갱신 버전: ${updatedVersions}개`);
  console.log(`   • 보존 버전: ${preservedVersions}개`);
  console.log(`   • 실패 프로젝트(보존 처리): ${failedProjects}개`);
  console.log(`\n💾 저장 위치: ${indexPath}`);
  console.log(`🗂️ 백업 위치: ${backupPath}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
