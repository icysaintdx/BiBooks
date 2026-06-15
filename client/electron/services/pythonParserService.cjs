'use strict';
/**
 * pythonParserService.cjs
 * 调用本地 Python 脚本完成 opendataloader-pdf / MinerU 本地解析
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SCRIPT_PATH = path.join(__dirname, 'python_parser.py');
const TIMEOUT_MS = 300000; // 5 分钟

/**
 * 检测 Python 命令是否可用，返回可用的命令名，否则 null
 */
async function detectPythonCmd() {
  for (const cmd of ['python3', 'python']) {
    try {
      await runCmd(cmd, ['--version'], 5000);
      return cmd;
    } catch {
      // 继续尝试
    }
  }
  return null;
}

function runCmd(cmd, args, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('超时')); }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout || stderr);
      else reject(new Error(stderr || `退出码 ${code}`));
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * 检测某个 Python 包是否已安装
 * @param {string} pythonCmd
 * @param {string} packageName  import 名（如 opendataloader_pdf）
 */
async function checkPythonPackage(pythonCmd, packageName) {
  try {
    await runCmd(pythonCmd, ['-c', `import ${packageName}`], 10000);
    return true;
  } catch {
    return false;
  }
}

/**
 * 用 pip 安装 requirements.txt
 * @param {string} pythonCmd
 * @param {string} requirementsPath
 * @param {function} onProgress  (message: string) => void
 */
async function installRequirements(pythonCmd, requirementsPath, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsPath, '--progress-bar', 'off'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => { onProgress?.(d.toString().trim()); });
    proc.stderr.on('data', (d) => { onProgress?.(d.toString().trim()); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('安装超时（超过10分钟）')); }, 600000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`pip 安装失败，退出码 ${code}`));
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * 检测 Java 版本（opendataloader-pdf 需要 Java 11+）
 */
async function detectJavaVersion() {
  try {
    const output = await runCmd('java', ['-version'], 5000).catch(async () => {
      // java -version 输出到 stderr
      return new Promise((resolve, reject) => {
        const proc = spawn('java', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => { code === 0 ? resolve(stderr) : reject(new Error(stderr)); });
        proc.on('error', reject);
        setTimeout(() => { proc.kill(); reject(new Error('超时')); }, 5000);
      });
    });
    const match = (output || '').match(/version "(\d+)/);
    if (match) return parseInt(match[1], 10);
    return null;
  } catch {
    return null;
  }
}

/**
 * 使用 Python 脚本解析文件
 * @param {string} provider  'opendataloader' | 'mineru-local'
 * @param {string} filePath
 * @returns {Promise<string>} markdown 内容
 */
async function parseWithPython(provider, filePath) {
  const pythonCmd = await detectPythonCmd();
  if (!pythonCmd) throw new Error('未检测到 Python，请安装 Python 3.10+');
  if (!fs.existsSync(SCRIPT_PATH)) throw new Error(`解析脚本不存在: ${SCRIPT_PATH}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [SCRIPT_PATH, provider, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (d) => { chunks.push(d); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('解析超时（超过5分钟）')); }, TIMEOUT_MS);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      } else {
        reject(new Error(stderr.trim() || `Python 解析失败，退出码 ${code}`));
      }
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

module.exports = {
  detectPythonCmd,
  checkPythonPackage,
  installRequirements,
  detectJavaVersion,
  parseWithPython,
};
