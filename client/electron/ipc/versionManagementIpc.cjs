const { ipcMain } = require('electron');

function registerVersionManagementIpc({ versionManagementStore, technicalPlanStore }) {
  ipcMain.handle('versions:list', () => {
    return versionManagementStore.listVersions();
  });

  ipcMain.handle('versions:save', (_event, payload) => {
    const technicalPlan = technicalPlanStore.loadTechnicalPlan();
    return versionManagementStore.saveVersion({
      name: payload?.name,
      description: payload?.description,
      technicalPlan,
    });
  });

  ipcMain.handle('versions:load', (_event, id) => {
    return versionManagementStore.loadVersion(id);
  });

  ipcMain.handle('versions:restore', (_event, id) => {
    const version = versionManagementStore.loadVersion(id);
    if (!version) {
      throw new Error('版本不存在');
    }

    const snapshot = version.snapshot;
    technicalPlanStore.updateTechnicalPlan({
      step: snapshot.step,
      outlineData: snapshot.outlineData,
      globalFacts: snapshot.globalFacts || [],
      scoringAnalysis: snapshot.scoringAnalysis,
      contentGenerationSections: snapshot.contentGenerationSections || {},
      contentGenerationPlans: snapshot.contentGenerationPlans || {},
    });

    return { success: true, name: version.name };
  });

  ipcMain.handle('versions:delete', (_event, id) => {
    return versionManagementStore.deleteVersion(id);
  });

  ipcMain.handle('versions:update', (_event, payload) => {
    return versionManagementStore.updateVersionMeta(payload?.id, {
      name: payload?.name,
      description: payload?.description,
    });
  });

  ipcMain.handle('versions:compare', (_event, payload) => {
    return versionManagementStore.compareVersions(payload?.versionId1, payload?.versionId2);
  });

  ipcMain.handle('versions:count', () => {
    return versionManagementStore.getVersionCount();
  });
}

module.exports = { registerVersionManagementIpc };
