import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const logPath = process.env.MCP_LOG_PATH || path.join(os.homedir(), ".oke-front-mcp", "mcp-debug.log");
const serverPath = path.resolve("dist/index.js");

async function readCursorMcpEnv() {
  const mcpConfigPath = path.join(os.homedir(), ".cursor", "mcp.json");
  try {
    const raw = await fs.readFile(mcpConfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed?.mcpServers?.["oke-front-mcp"]?.env || {};
  } catch {
    return {};
  }
}

function pickText(result) {
  const first = result?.content?.[0];
  return typeof first?.text === "string" ? first.text : JSON.stringify(result);
}

async function callSet(baseEnv, envOverrides = {}) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env, ...baseEnv, ...envOverrides },
  });
  const client = new Client({ name: "qa-runner", version: "0.0.1" }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport };
}

async function runNormalFlow(baseEnv) {
  const { client, transport } = await callSet(baseEnv);
  const report = {};
  try {
    report.tools = await client.listTools();
    report.resources = await client.listResources();

    report.step1_natural = await client.callTool({
      name: "search_figma_spec",
      arguments: { query: "볼륨 생성 기획" },
    });
    report.step1_id = await client.callTool({
      name: "search_figma_spec",
      arguments: { query: "CONT-04_01_03" },
    });
    report.step1_select = await client.callTool({
      name: "search_figma_spec",
      arguments: { query: "1번" },
    });

    report.step2_base = await client.callTool({
      name: "search_publisher_code",
      arguments: { query: "로드밸런서 생성 퍼블 코드", maxResults: 3 },
    });
    report.step2_lb = await client.callTool({
      name: "search_publisher_code",
      arguments: { query: "LB", maxResults: 3 },
    });
    report.step2_apply_context = await client.callTool({
      name: "search_publisher_code",
      arguments: {
        query: "호스트 생성페이지를 개발해줘",
        targetSummary: "contrabass 인스턴스 > 호스트 생성",
        maxResults: 3,
      },
    });
    report.step2_diff_fix = await client.callTool({
      name: "search_publisher_code",
      arguments: {
        query: "현재 오브젝트 스토리지 상세 페이지와 퍼블 차이를 수정해줘",
        targetSummary: "ceph object storage detail",
        currentCodeHint: "현재 페이지는 탭 구조와 상세 헤더 정보가 퍼블과 다릅니다.",
        maxResults: 3,
      },
    });

    report.masking_probe = await client.callTool({
      name: "search_publisher_code",
      arguments: { query: "masking check", apiKey: "very-secret-key" },
    });
  } finally {
    await transport.close();
  }
  return report;
}

async function runDegradedFlow(baseEnv) {
  const { client, transport } = await callSet(baseEnv, {
    PUBLISHER_REPO_URL: "git@bitbucket.org:invalid/invalid.git",
    PUBLISHER_CACHE_PATH: "/tmp/mcp-qa-nonexistent-cache",
    PUBLISHER_REPO_PATH: "",
  });
  const report = {};
  try {
    report.step2_degraded = await client.callTool({
      name: "search_publisher_code",
      arguments: { query: "로드밸런서", maxResults: 2, refreshIndex: true },
    });
  } finally {
    await transport.close();
  }
  return report;
}

async function main() {
  const baseEnv = await readCursorMcpEnv();
  const normal = await runNormalFlow(baseEnv);
  const degraded = await runDegradedFlow(baseEnv);

  const report = {
    executedAt: new Date().toISOString(),
    tools: normal.tools?.tools?.map((t) => t.name) || [],
    resources: normal.resources?.resources?.map((r) => r.uri) || [],
    step1: {
      natural: pickText(normal.step1_natural),
      id: pickText(normal.step1_id),
      select: pickText(normal.step1_select),
    },
    step2: {
      base: pickText(normal.step2_base),
      lb: pickText(normal.step2_lb),
      applyContext: pickText(normal.step2_apply_context),
      diffFix: pickText(normal.step2_diff_fix),
      degraded: pickText(degraded.step2_degraded),
    },
  };

  await fs.mkdir(path.resolve("data"), { recursive: true });
  await fs.writeFile(path.resolve("data", "qa-step1-3-report.json"), JSON.stringify(report, null, 2), "utf-8");

  let logSnapshot = "";
  try {
    logSnapshot = await fs.readFile(logPath, "utf-8");
  } catch {
    logSnapshot = "";
  }
  const logLines = logSnapshot.split(/\r?\n/).filter(Boolean);
  const tail = logLines.slice(Math.max(0, logLines.length - 300));
  await fs.writeFile(path.resolve("data", "qa-step1-3-log-tail.log"), tail.join("\n"), "utf-8");

  console.log("QA report written:", path.resolve("data", "qa-step1-3-report.json"));
  console.log("QA log tail written:", path.resolve("data", "qa-step1-3-log-tail.log"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
