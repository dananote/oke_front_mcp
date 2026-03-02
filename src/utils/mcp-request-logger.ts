/**
 * MCP 요청 디버그 로그
 * - Cursor가 어떤 method로 요청했는지, request 내용을 실시간으로 확인할 수 있게 함.
 * - stdout은 MCP 프로토콜용이므로 stderr와 파일로만 출력.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_ENV = process.env.MCP_DEBUG_LOG;
const LOG_FILE =
  LOG_ENV === '1' || LOG_ENV === 'true'
    ? path.join(os.homedir(), '.oke-front-mcp', 'mcp-request.log')
    : LOG_ENV && LOG_ENV.length > 1
      ? LOG_ENV
      : null;

function timestamp(): string {
  return new Date().toISOString();
}

function writeToFile(line: string): void {
  if (!LOG_FILE) return;
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  } catch {
    // ignore
  }
}

/**
 * MCP 요청 발생 시 호출. handler 이름, 요청 파라미터(있는 경우)를 남김.
 */
export function logMcpRequest(handler: string, detail?: string, params?: unknown): void {
  const ts = timestamp();
  const detailStr = detail ? ` ${detail}` : '';
  const paramsStr = params !== undefined ? `\n  params: ${JSON.stringify(params, null, 2)}` : '';
  const line = `[${ts}] [MCP] ${handler}${detailStr}${paramsStr}`;

  console.error(line);
  writeToFile(line);
}
