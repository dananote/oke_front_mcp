import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

interface PublisherFileEntry {
  filePath: string;
  solution?: string;
  menuPath?: string;
  entity?: string;
  pageType?: string;
  isModal?: boolean;
}

interface PublisherIndex {
  lastIndexedAt: string;
  gitCommit: string;
  entries: PublisherFileEntry[];
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    map[item] = (map[item] || 0) + 1;
  }
  return map;
}

async function main() {
  const modulePath = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(modulePath), '..', '..');
  const indexPath = path.join(root, 'data', 'publisher-index.json');
  const taxonomyPath = path.join(root, 'data', 'publisher-taxonomy.json');

  const raw = await fs.readFile(indexPath, 'utf-8');
  const index = JSON.parse(raw) as PublisherIndex;
  const viewEntries = (index.entries || []).filter(entry => entry.filePath.startsWith('src/views/'));

  const bySolution = countBy(viewEntries.map(entry => entry.solution || 'unknown'));
  const byMenuPath = countBy(viewEntries.map(entry => entry.menuPath || 'unknown'));
  const byEntity = countBy(viewEntries.map(entry => entry.entity || 'unknown'));
  const byPageType = countBy(viewEntries.map(entry => entry.pageType || 'unknown'));
  const modalEntries = viewEntries.filter(entry => entry.isModal || /modal/i.test(entry.filePath));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      lastIndexedAt: index.lastIndexedAt,
      gitCommit: index.gitCommit,
      totalEntries: index.entries.length,
      totalViewEntries: viewEntries.length,
    },
    summary: {
      bySolution,
      byMenuPath,
      byEntity,
      byPageType,
      modalCount: modalEntries.length,
    },
    samples: {
      topMenus: Object.entries(byMenuPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40),
      modalFiles: modalEntries.slice(0, 80).map(entry => entry.filePath),
    },
  };

  await fs.writeFile(taxonomyPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Publisher taxonomy written: ${taxonomyPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
