/**
 * 任务重试服务测试脚本
 */

const {
  createTaskRetryService,
  withRetry,
  isRetryableError,
  calculateRetryDelay,
  TaskQueue,
  ProgressTracker,
  TASK_STATUS,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CONCURRENCY_CONFIG,
} = require('../client/electron/services/taskRetryService.cjs');

console.log('=== 任务重试服务测试 ===\n');

// 测试 1: 查看默认配置
console.log('【测试 1】默认重试配置');
console.log(`  最大重试次数: ${DEFAULT_RETRY_CONFIG.maxRetries}`);
console.log(`  基础延迟: ${DEFAULT_RETRY_CONFIG.baseDelay}ms`);
console.log(`  最大延迟: ${DEFAULT_RETRY_CONFIG.maxDelay}ms`);
console.log(`  退避倍数: ${DEFAULT_RETRY_CONFIG.backoffMultiplier}`);
console.log('');

// 测试 2: 查看并发配置
console.log('【测试 2】并发控制配置');
console.log(`  最大并发数: ${DEFAULT_CONCURRENCY_CONFIG.maxConcurrent}`);
console.log(`  队列最大长度: ${DEFAULT_CONCURRENCY_CONFIG.queueMaxSize}`);
console.log(`  超时时间: ${DEFAULT_CONCURRENCY_CONFIG.timeout}ms`);
console.log('');

// 测试 3: 判断可重试错误
console.log('【测试 3】判断可重试错误');
const testErrors = [
  { error: { code: 'ECONNRESET' }, expected: true },
  { error: { code: 'ETIMEDOUT' }, expected: true },
  { error: { message: '网络连接失败' }, expected: true },
  { error: { message: '请求超时' }, expected: true },
  { error: { message: '语法错误' }, expected: false },
  { error: { code: 'ENOENT' }, expected: false },
];
testErrors.forEach(({ error, expected }) => {
  const result = isRetryableError(error);
  const status = result === expected ? '✓' : '✗';
  console.log(`  ${status} ${error.code || error.message}: ${result}`);
});
console.log('');

// 测试 4: 计算重试延迟
console.log('【测试 4】计算重试延迟（指数退避）');
for (let attempt = 0; attempt < 5; attempt++) {
  const delay = calculateRetryDelay(attempt);
  console.log(`  第 ${attempt} 次重试: ${delay}ms`);
}
console.log('');

// 测试 5: 成功的重试
console.log('【测试 5】成功的重试（首次成功）');
let attemptCount = 0;
withRetry(
  async (attempt) => {
    attemptCount++;
    console.log(`  执行第 ${attempt} 次尝试`);
    return 'success';
  },
  { maxRetries: 3 }
).then((result) => {
  console.log(`  结果: ${result}`);
  console.log(`  总尝试次数: ${attemptCount}`);
  console.log('');
}).catch((err) => {
  console.error('  错误:', err.message);
});

// 测试 6: 重试后成功
console.log('【测试 6】重试后成功（第2次成功）');
let retryAttemptCount = 0;
withRetry(
  async (attempt) => {
    retryAttemptCount++;
    console.log(`  执行第 ${attempt} 次尝试`);
    if (attempt === 0) {
      throw { code: 'ECONNRESET', message: '连接重置' };
    }
    return 'success after retry';
  },
  { maxRetries: 3, baseDelay: 100 }
).then((result) => {
  console.log(`  结果: ${result}`);
  console.log(`  总尝试次数: ${retryAttemptCount}`);
  console.log('');
}).catch((err) => {
  console.error('  错误:', err.message);
});

// 测试 7: 任务队列
console.log('【测试 7】任务队列');
const queue = new TaskQueue({ maxConcurrent: 2, queueMaxSize: 5, timeout: 5000 });
console.log(`  初始状态:`, queue.getStatus());

// 添加任务
const tasks = [];
for (let i = 0; i < 3; i++) {
  tasks.push(
    queue.add(async (taskId) => {
      console.log(`  任务 ${taskId} 开始执行`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`  任务 ${taskId} 执行完成`);
      return `result_${taskId}`;
    })
  );
}

Promise.all(tasks).then((results) => {
  console.log(`  所有任务完成:`, results);
  console.log(`  最终状态:`, queue.getStatus());
  console.log('');
}).catch((err) => {
  console.error('  错误:', err.message);
});

// 测试 8: 进度追踪器
console.log('【测试 8】进度追踪器');
const tracker = new ProgressTracker();
const unsubscribe = tracker.addListener((data) => {
  console.log(`  进度更新: ${data.progress}% (${data.logs.length} 条日志)`);
});

tracker.update(20, '开始处理');
tracker.update(50, '处理中');
tracker.update(80, '即将完成');
tracker.update(100, '完成');

const report = tracker.getReport();
console.log(`  最终进度: ${report.progress}%`);
console.log(`  日志数量: ${report.logCount}`);
console.log(`  耗时: ${report.duration}ms`);
unsubscribe();
console.log('');

// 测试 9: 任务状态
console.log('【测试 9】任务状态定义');
Object.values(TASK_STATUS).forEach((status) => {
  console.log(`  - ${status}`);
});
console.log('');

console.log('=== 任务重试服务测试完成 ===');
