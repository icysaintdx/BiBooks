'use strict';
/**
 * envCheckIpc.cjs
 * 环境检测与依赖安装 IPC 处理器
 */

const { ipcMain } = require('electron');
const path = require('node:path');
const { detectPythonCmd, checkPythonPackage, installRequirements, detectJavaVersion } = require('../services/pythonParserService.cjs');

const REQUIREMENTS_PATH = path.join(__dirname, '../../..', 'requirements.txt');

function registerEnvCheckIpc(mainWindow) {
  // 检测环境状态
  ipcMain.handle('env:check', async () => {
    const pythonCmd = await detectPythonCmd();
    const javaVersion = await detectJavaVersion();

    const result = {
      python: { available: Boolean(pythonCmd), cmd: pythonCmd || null },
      java: { available: javaVersion !== null && javaVersion >= 11, version: javaVersion },
      packages: {
        opendataloader_pdf: false,
        mineru: false,
        pdfplumber: false,
      },
    };

    if (pythonCmd) {
      const [odl, mineruOk, pdfplumber] = await Promise.all([
        checkPythonPackage(pythonCmd, 'opendataloader_pdf'),
        checkPythonPackage(pythonCmd, 'mineru'),
        checkPythonPackage(pythonCmd, 'pdfplumber'),
      ]);
      result.packages.opendataloader_pdf = odl;
      result.packages.mineru = mineruOk;
      result.packages.pdfplumber = pdfplumber;
    }

    return result;
  });

  // 安装 requirements.txt（带进度推送）
  ipcMain.handle('env:install', async () => {
    const pythonCmd = await detectPythonCmd();
    if (!pythonCmd) {
      return { success: false, message: '未检测到 Python，请先安装 Python 3.10+' };
    }

    try {
      await installRequirements(pythonCmd, REQUIREMENTS_PATH, (msg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('env:install-progress', { message: msg });
        }
      });
      return { success: true, message: '依赖安装完成' };
    } catch (error) {
      return { success: false, message: error.message || '安装失败' };
    }
  });
}

module.exports = { registerEnvCheckIpc };
