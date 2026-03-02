/**
 * MCP 도구 스키마 단일 소스에서 Cursor용 디스크립터 JSON 생성
 * - 출력: mcp-descriptors/search_figma_spec.json, search_publisher_code.json
 * - Cursor mcps 폴더에 search_figma_spec이 안 보일 때 이 폴더 내용을 복사해 동기화
 *
 * 사용: npm run sync-mcp-descriptors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCP_TOOLS_SCHEMA } from '../mcp-tools-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'mcp-descriptors');

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const tool of MCP_TOOLS_SCHEMA) {
    const descriptor = {
      name: tool.name,
      description: tool.description,
      arguments: tool.inputSchema,
    };
    const filePath = path.join(outDir, `${tool.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(descriptor, null, 2), 'utf-8');
    console.log(`  ✓ ${tool.name}.json`);
  }

  console.log('');
  console.log(`mcp-descriptors/ 에 디스크립터를 생성했습니다.`);
  console.log(`Cursor가 도구를 하나만 인식할 때: 위 폴더 내용을 Cursor mcps 폴더에 복사하세요.`);
  console.log(`  예: cp mcp-descriptors/*.json ~/.cursor/projects/<프로젝트>/mcps/user-oke-front-mcp/tools/`);
}

main();
