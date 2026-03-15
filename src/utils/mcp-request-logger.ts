/**
 * MCP 요청 디버그 로그
 * - Cursor가 어떤 method로 요청했는지, request 내용을 실시간으로 확인할 수 있게 함.
 * - stdout은 MCP 프로토콜용이므로 stderr와 파일로만 출력.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_LOG_FILE = path.join(os.homedir(), '.oke-front-mcp', 'mcp-debug.log');
const LOG_FILE = resolveLogFile();

const SENSITIVE_KEY_PATTERN =
  /(^|_|-)(token|authorization|secret|password|api[_-]?key|private[_-]?key)($|_|-)|^(apiKey|privateKey)$/i;

function resolveLogFile(): string | null {
  const logPath = process.env.MCP_LOG_PATH?.trim();
  if (logPath) {
    if (logPath === '1' || logPath === 'true') return DEFAULT_LOG_FILE;
    return logPath;
  }

  // 하위 호환: 기존 환경변수 유지
  const legacyAuditPath = process.env.MCP_AUDIT_LOG?.trim();
  if (legacyAuditPath) return legacyAuditPath;

  const legacyDebugPath = process.env.MCP_DEBUG_LOG?.trim();
  if (!legacyDebugPath) return null;
  if (legacyDebugPath === '1' || legacyDebugPath === 'true') return DEFAULT_LOG_FILE;
  return legacyDebugPath;
}

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

function maskSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveValue);
  }

  if (value && typeof value === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        masked[key] = '***';
      } else {
        masked[key] = maskSensitiveValue(nestedValue);
      }
    }
    return masked;
  }

  if (typeof value === 'string' && value.length > 400) {
    return `${value.slice(0, 400)}...(+${value.length - 400} chars)`;
  }

  return value;
}

function summarizeContentCount(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  return content.length;
}

function summarizeResultPreview(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) return '';

  const first = content[0] as { text?: unknown };
  const firstText = typeof first?.text === 'string' ? first.text : '';
  if (!firstText) return '';

  const compact = firstText.replace(/\s+/g, ' ').trim();
  if (compact.length <= 160) return compact;
  return `${compact.slice(0, 160)}...`;
}

function formatLine(tag: string, message: string, payload?: unknown): string {
  const ts = timestamp();
  if (payload === undefined) {
    return `[${ts}] [${tag}] ${message}`;
  }
  return `[${ts}] [${tag}] ${message} ${JSON.stringify(maskSensitiveValue(payload))}`;
}

function writeLogLine(line: string): void {
  console.error(line);
  writeToFile(line);
}

export interface ToolTracePayload {
  requestId: string;
  tool: string;
  event: 'tool_call_start' | 'tool_call_success' | 'tool_call_error';
  args?: unknown;
  result?: unknown;
  durationMs?: number;
  error?: string;
}

/**
 * MCP 요청 발생 시 호출. handler 이름, 요청 파라미터(있는 경우)를 남김.
 */
export function logMcpRequest(handler: string, detail?: string, params?: unknown): void {
  const detailText = detail ? `${handler} ${detail}` : handler;
  writeLogLine(formatLine('mcp요청확인', detailText, params));
}

export function logToolTrace(payload: ToolTracePayload): void {
  const event: Record<string, unknown> = {
    ts: timestamp(),
    requestId: payload.requestId,
    tool: payload.tool,
    event: payload.event,
  };

  if (payload.args !== undefined) {
    event.argsMasked = maskSensitiveValue(payload.args);
  }
  if (payload.durationMs !== undefined) {
    event.durationMs = payload.durationMs;
  }
  if (payload.result !== undefined) {
    const contentCount = summarizeContentCount(payload.result);
    event.resultSummary = {
      isError: Boolean((payload.result as { isError?: boolean })?.isError),
      contentCount: contentCount ?? 0,
      preview: summarizeResultPreview(payload.result),
    };
    event.resultMasked = maskSensitiveValue(payload.result);
  }
  if (payload.error) {
    event.error = payload.error;
  }

  const eventLabelMap: Record<ToolTracePayload['event'], string> = {
    tool_call_start: '도구 실행 시작',
    tool_call_success: '도구 실행 성공',
    tool_call_error: '도구 실행 실패',
  };

  writeLogLine(
    formatLine(
      'mcp도구실행',
      `${eventLabelMap[payload.event]} tool=${payload.tool} requestId=${payload.requestId}`,
      event,
    ),
  );
}

export function logFigmaTrace(step: string, message: string, payload?: unknown): void {
  writeLogLine(formatLine('figma기획확인', `${step} ${message}`, payload));
}

export function logPublisherTrace(step: string, message: string, payload?: unknown): void {
  writeLogLine(formatLine('publisher코드확인', `${step} ${message}`, payload));
}
