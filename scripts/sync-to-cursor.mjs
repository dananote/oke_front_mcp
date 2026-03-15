#!/usr/bin/env node
/**
 * MCP 디스크립터를 "MCP를 쓰는 워크스페이스"의 Cursor mcps tools 폴더로 동기화.
 * - 기본 대상: mcp-qa-app 워크스페이스 (여기서 MCP 질의 시 최신 도구 적용)
 * - oke-front-mcp에서 build:dev 하면 mcp-qa-app에서 바로 최신 MCP 테스트 가능
 * - 사용: npm run sync:cursor  또는  npm run build:dev (빌드 후 동기화)
 */
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// 기본값: MCP를 실제로 쓰는 워크스페이스(mcp-qa-app)의 Cursor 프로젝트 경로
const projectId = process.env.CURSOR_MCP_PROJECT_ID || "Users-taeheerho-Desktop-mcp-qa-app";
const defaultToolsDir = path.join(
  os.homedir(),
  ".cursor",
  "projects",
  projectId,
  "mcps",
  "user-oke-front-mcp",
  "tools"
);

const cursorToolsDir = process.env.CURSOR_MCP_TOOLS_DIR?.trim() || defaultToolsDir;

console.log("Cursor tools 대상 경로:", cursorToolsDir);

const result = spawnSync(
  "npx",
  ["tsx", "src/scripts/sync-mcp-descriptors.ts"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, CURSOR_MCP_TOOLS_DIR: cursorToolsDir },
  }
);

process.exit(result.status ?? 1);
