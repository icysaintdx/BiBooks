const fs = require('node:fs');
const path = require('node:path');
const { dialog, ipcMain, shell } = require('electron');
const { ensureFontsDir, importFontFiles, installBundledFonts, listBundledFonts } = require('../services/fontConfig.cjs');

function registerConfigIpc({ configStore, aiService }) {
  ipcMain.handle('config:load', () => configStore.load());
  ipcMain.handle('config:save', (_event, config) => configStore.save(config));
  ipcMain.handle('config:list-models', (_event, config) => aiService.listModels(config));
  ipcMain.handle('config:open-config-folder', async () => {
    const configFolder = path.dirname(configStore.getConfigFilePath());
    fs.mkdirSync(configFolder, { recursive: true });
    const errorMessage = await shell.openPath(configFolder);

    if (errorMessage) {
      throw new Error(`打开配置文件夹失败：${errorMessage}`);
    }

    return { success: true, path: configFolder };
  });
  ipcMain.handle('config:list-fonts', () => ({
    success: true,
    fontsDir: ensureFontsDir(),
    fonts: listBundledFonts(),
  }));
  ipcMain.handle('config:open-fonts-folder', async () => {
    const fontsDir = ensureFontsDir();
    const errorMessage = await shell.openPath(fontsDir);
    if (errorMessage) {
      throw new Error(`打开字体文件夹失败：${errorMessage}`);
    }
    return { success: true, path: fontsDir };
  });
  ipcMain.handle('config:import-fonts', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择要导入的字体文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '字体文件', extensions: ['ttf', 'otf', 'ttc', 'woff', 'woff2'] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true, fontsDir: ensureFontsDir(), imported: [], skipped: [], fonts: listBundledFonts() };
    }
    return importFontFiles(result.filePaths);
  });
  ipcMain.handle('config:install-fonts', () => installBundledFonts());
}

module.exports = {
  registerConfigIpc,
};
