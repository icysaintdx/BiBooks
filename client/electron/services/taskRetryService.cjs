/**
 * 任务重试服务
 * 为异步任务提供重试逻辑、错误恢复、并发控制
 * 参考: Autobid 异步任务管理模式
 */

// 默认重试配置
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 30000, // 30秒
  backoffMultiplier: 1.5,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    '网络连接失败',
    '请求超时',
    'API调用失败',
    '模型返回格式无效',
  ],
};

// 任务状态常量
const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSING: 'pausing',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying',
};

// 并发控制配置
const DEFAULT_CONCURRENCY_CONFIG = {
  maxConcurrent: 3, // 最大并发任务数
  queueMaxSize: 10, // 队列最大长度
  timeout: 300000, // 5分钟超时
};

/**
 * 判断错误是否可重试
 * @param {Error} error - 错误对象
 * @param {Array<string>} retryableErrors - 可重试错误列表
 * @returns {boolean} 是否可重试
 */
function isRetryableError(error, retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors) {
  if (!error) return false;

  const errorMessage = error.message || String(error);
  const errorCode = error.code || '';

  return retryableErrors.some((retryable) =>
    errorMessage.includes(retryable) || errorCode.includes(retryable)
  );
}

/**
 * 计算重试延迟（指数退避）
 * @param {number} attempt - 当前尝试次数
 * @param {Object} config - 重试配置
 * @returns {number} 延迟时间（毫秒）
 */
function calculateRetryDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 重试选项
 * @returns {Promise<*>} 执行结果
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  const { maxRetries, retryableErrors, onRetry, onError } = config;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // 检查是否可重试
      if (!isRetryableError(error, retryableErrors) || attempt >= maxRetries) {
        if (onError) {
          onError(error, attempt);
        }
        throw error;
      }

      // 计算延迟并等待
      const delay = calculateRetryDelay(attempt, config);
      console.warn(`[task-retry] 第 ${attempt + 1} 次重试，延迟 ${delay}ms:`, error.message);

      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 任务队列管理器
 */
class TaskQueue {
  constructor(config = DEFAULT_CONCURRENCY_CONFIG) {
    this.config = config;
    this.queue = [];
    this.running = new Map();
    this.taskIdCounter = 0;
  }

  /**
   * 添加任务到队列
   * @param {Function} taskFn - 任务函数
   * @param {Object} options - 任务选项
   * @returns {Promise<*>} 任务结果
   */
  async add(taskFn, options = {}) {
    const taskId = ++this.taskIdCounter;
    const task = {
      id: taskId,
      fn: taskFn,
      options,
      status: TASK_STATUS.PENDING,
      createdAt: Date.now(),
    };

    // 检查队列是否已满
    if (this.queue.length >= this.config.queueMaxSize) {
      throw new Error(`任务队列已满（${this.config.queueMaxSize}），无法添加新任务`);
    }

    return new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
      this.queue.push(task);
      this._processQueue();
    });
  }

  /**
   * 处理队列
   */
  async _processQueue() {
    // 检查是否可以启动新任务
    if (this.running.size >= this.config.maxConcurrent) {
      return;
    }

    // 从队列中取出任务
    const task = this.queue.shift();
    if (!task) {
      return;
    }

    // 启动任务
    this.running.set(task.id, task);
    task.status = TASK_STATUS.RUNNING;

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`任务 ${task.id} 执行超时（${this.config.timeout}ms）`));
        }, this.config.timeout);
      });

      // 执行任务
      const result = await Promise.race([
        task.fn(task.id),
        timeoutPromise,
      ]);

      task.status = TASK_STATUS.SUCCESS;
      task.resolve(result);
    } catch (error) {
      task.status = TASK_STATUS.ERROR;
      task.reject(error);
    } finally {
      this.running.delete(task.id);
      this._processQueue();
    }
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      runningCount: this.running.size,
      maxConcurrent: this.config.maxConcurrent,
      tasks: Array.from(this.running.values()).map((task) => ({
        id: task.id,
        status: task.status,
        createdAt: task.createdAt,
        duration: Date.now() - task.createdAt,
      })),
    };
  }

  /**
   * 取消所有任务
   */
  cancelAll() {
    for (const task of this.queue) {
      task.status = TASK_STATUS.CANCELLED;
      task.reject(new Error('任务被取消'));
    }
    this.queue = [];
  }
}

/**
 * 进度追踪器
 */
class ProgressTracker {
  constructor() {
    this.progress = 0;
    this.logs = [];
    this.startTime = Date.now();
    this.listeners = new Set();
  }

  /**
   * 更新进度
   * @param {number} progress - 进度百分比（0-100）
   * @param {string} message - 进度消息
   */
  update(progress, message) {
    this.progress = Math.max(this.progress, Math.min(progress, 100));
    if (message) {
      this.logs.push({
        timestamp: Date.now(),
        progress: this.progress,
        message,
      });
    }
    this._notify();
  }

  /**
   * 添加进度监听器
   * @param {Function} listener - 监听器函数
   * @returns {Function} 取消监听的函数
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知监听器
   */
  _notify() {
    const data = {
      progress: this.progress,
      logs: this.logs,
      duration: Date.now() - this.startTime,
    };
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('[progress-tracker] 监听器执行失败:', error);
      }
    }
  }

  /**
   * 获取进度报告
   * @returns {Object} 进度报告
   */
  getReport() {
    return {
      progress: this.progress,
      logs: this.logs,
      duration: Date.now() - this.startTime,
      logCount: this.logs.length,
    };
  }
}

/**
 * 创建任务重试服务实例
 */
function createTaskRetryService() {
  const taskQueue = new TaskQueue();

  return {
    withRetry,
    isRetryableError,
    calculateRetryDelay,
    sleep,
    taskQueue,
    ProgressTracker,
    TASK_STATUS,
    DEFAULT_RETRY_CONFIG,
    DEFAULT_CONCURRENCY_CONFIG,
  };
}

module.exports = {
  createTaskRetryService,
  withRetry,
  isRetryableError,
  calculateRetryDelay,
  sleep,
  TaskQueue,
  ProgressTracker,
  TASK_STATUS,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CONCURRENCY_CONFIG,
};
