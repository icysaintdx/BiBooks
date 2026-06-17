import type { RepairTaskSourceModule, RepairTaskTargetType } from '../types/ipc';

export const REPAIR_TASKS_CHANGED_EVENT = 'bibooks:repair-tasks-changed';

export function notifyRepairTasksChanged() {
  window.dispatchEvent(new CustomEvent(REPAIR_TASKS_CHANGED_EVENT));
}

interface MarkRepairTasksForReviewOptions {
  sourceModule: RepairTaskSourceModule | string;
  targetType?: RepairTaskTargetType | string;
  targetId?: string;
  sourceRecordId?: string;
  decision?: string;
}

export async function markRepairTasksForReview({
  sourceModule,
  targetType,
  targetId,
  sourceRecordId,
  decision = '源页面已保存修复，等待交付检查复核',
}: MarkRepairTasksForReviewOptions) {
  const api = window.yibiao?.repairTasks;
  if (!api?.list || !api?.bulkUpdateStatus) return;

  const tasks = await api.list({ sourceModule });
  const taskIds = tasks
    .filter((task) => task.status === 'open' || task.status === 'in_progress' || task.status === 'needs_review')
    .filter((task) => !targetType || task.targetType === targetType)
    .filter((task) => !targetId || task.targetId === targetId)
    .filter((task) => !sourceRecordId || task.sourceRecordId === sourceRecordId)
    .map((task) => task.id);

  if (!taskIds.length) return;
  await api.bulkUpdateStatus(taskIds, 'needs_review', decision);
  notifyRepairTasksChanged();
}
