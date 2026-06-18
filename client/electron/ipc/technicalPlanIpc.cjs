const { ipcMain } = require('electron');

function registerTechnicalPlanIpc({ technicalPlanStore, sourceAnnotationStore }) {
  ipcMain.handle('technical-plan:load-state', () => technicalPlanStore.loadTechnicalPlan());
  ipcMain.handle('technical-plan:import-tender-document', (_event, options) => technicalPlanStore.importTenderDocument(options));
  ipcMain.handle('technical-plan:read-tender-markdown', () => technicalPlanStore.readTenderMarkdown());
  ipcMain.handle('technical-plan:update-step', (_event, step) => technicalPlanStore.updateStep(step));
  ipcMain.handle('technical-plan:save-outline-config', (_event, payload) => technicalPlanStore.saveOutlineConfig(payload));
  ipcMain.handle('technical-plan:save-outline', (_event, outlineData) => technicalPlanStore.saveOutline(outlineData));
  ipcMain.handle('technical-plan:save-global-facts', (_event, globalFacts) => technicalPlanStore.saveGlobalFacts(globalFacts));
  ipcMain.handle('technical-plan:save-content-generation-options', (_event, options) => technicalPlanStore.saveContentGenerationOptions(options));
  ipcMain.handle('technical-plan:save-chapter-content', (_event, payload) => technicalPlanStore.saveChapterContent(payload));
  if (sourceAnnotationStore) {
    ipcMain.handle('technical-plan:list-source-annotations', (_event, filter) => sourceAnnotationStore.list(filter));
    ipcMain.handle('technical-plan:save-source-annotation', (_event, annotation) => sourceAnnotationStore.save(annotation));
    ipcMain.handle('technical-plan:approve-source-annotation', (_event, annotationId, approvedBy) => sourceAnnotationStore.approve(annotationId, approvedBy));
    ipcMain.handle('technical-plan:reject-source-annotation', (_event, annotationId, approvedBy) => sourceAnnotationStore.reject(annotationId, approvedBy));
    ipcMain.handle('technical-plan:delete-source-annotation', (_event, annotationId) => sourceAnnotationStore.remove(annotationId));
  }
  ipcMain.handle('technical-plan:clear', () => technicalPlanStore.clearTechnicalPlan());
}

module.exports = {
  registerTechnicalPlanIpc,
};
