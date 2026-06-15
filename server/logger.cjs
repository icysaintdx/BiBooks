/**
 * 服务器版日志工具
 * 从 Electron 的 logger.cjs 简化而来，适配独立 Node.js 环境
 */

const path = require('node:path');
const fs = require('node:fs');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');

fs.mkdirSync(LOG_DIR, { recursive: true });

function formatTime() {
  return new Date().toISOString();
}

function log(level, module, message) {
  const line = `[${formatTime()}] [${level}] [${module}] ${message}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch {}
}

function logInfo(module, message) { log('INFO', module, message); }
function logError(module, error) {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error?.stack ? `\n${error.stack.slice(0, 500)}` : '';
  log('ERROR', module, `${msg}${stack}`);
}
function logWarn(module, message) { log('WARN', module, message); }

module.exports = { logInfo, logError, logWarn };
