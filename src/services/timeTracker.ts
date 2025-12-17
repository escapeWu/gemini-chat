/**
 * 请求耗时追踪服务
 * 需求: 8.1, 8.2, 8.3
 */

// ============ 类型定义 ============

/**
 * 时间追踪数据
 * 需求: 8.1, 8.2, 8.3
 */
export interface TimeTrackingData {
  /** 请求开始时间戳 */
  startTime: number;
  /** 首字节时间戳（可选） */
  firstByteTime?: number;
  /** 请求结束时间戳（可选） */
  endTime?: number;
}

/**
 * 耗时计算结果
 * 需求: 8.2, 8.3
 */
export interface TimingResult {
  /** 总耗时（毫秒） */
  duration: number;
  /** 首字节时间（毫秒，可选） */
  ttfb?: number;
}

// ============ TimeTracker 类 ============

/**
 * 请求耗时追踪器
 * 需求: 8.1, 8.2, 8.3
 * 
 * 用于追踪 API 请求的开始时间、首字节时间和结束时间
 */
export class TimeTracker {
  /** 请求开始时间戳 */
  private startTime: number;
  /** 首字节时间戳 */
  private firstByteTime?: number;
  /** 请求结束时间戳 */
  private endTime?: number;

  /**
   * 创建 TimeTracker 实例
   * 需求: 8.1
   * 
   * @param startTime - 可选的开始时间，默认为当前时间
   */
  constructor(startTime?: number) {
    this.startTime = startTime ?? Date.now();
  }

  /**
   * 记录请求开始时间
   * 需求: 8.1
   * 
   * @returns 开始时间戳
   */
  start(): number {
    this.startTime = Date.now();
    this.firstByteTime = undefined;
    this.endTime = undefined;
    return this.startTime;
  }

  /**
   * 记录首字节时间
   * 需求: 8.3
   * 
   * @returns 首字节时间戳
   */
  markFirstByte(): number {
    this.firstByteTime = Date.now();
    return this.firstByteTime;
  }

  /**
   * 记录请求结束时间
   * 需求: 8.2
   * 
   * @returns 结束时间戳
   */
  end(): number {
    this.endTime = Date.now();
    return this.endTime;
  }

  /**
   * 获取开始时间
   * 需求: 8.1
   * 
   * @returns 开始时间戳
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * 获取首字节时间戳
   * 需求: 8.3
   * 
   * @returns 首字节时间戳，如果未记录则返回 undefined
   */
  getFirstByteTime(): number | undefined {
    return this.firstByteTime;
  }

  /**
   * 获取结束时间戳
   * 需求: 8.2
   * 
   * @returns 结束时间戳，如果未记录则返回 undefined
   */
  getEndTime(): number | undefined {
    return this.endTime;
  }

  /**
   * 计算总耗时
   * 需求: 8.2
   * 
   * @returns 总耗时（毫秒），如果请求未结束则返回当前已用时间
   */
  getDuration(): number {
    const end = this.endTime ?? Date.now();
    return end - this.startTime;
  }

  /**
   * 计算首字节时间（TTFB）
   * 需求: 8.3
   * 
   * @returns 首字节时间（毫秒），如果未记录首字节时间则返回 undefined
   */
  getTTFB(): number | undefined {
    if (this.firstByteTime === undefined) {
      return undefined;
    }
    return this.firstByteTime - this.startTime;
  }

  /**
   * 获取完整的耗时结果
   * 需求: 8.2, 8.3
   * 
   * @returns 包含 duration 和 ttfb 的耗时结果
   */
  getTimingResult(): TimingResult {
    return {
      duration: this.getDuration(),
      ttfb: this.getTTFB(),
    };
  }

  /**
   * 获取完整的时间追踪数据
   * 需求: 8.1, 8.2, 8.3
   * 
   * @returns 包含所有时间戳的追踪数据
   */
  getTrackingData(): TimeTrackingData {
    return {
      startTime: this.startTime,
      firstByteTime: this.firstByteTime,
      endTime: this.endTime,
    };
  }

  /**
   * 检查请求是否已完成
   * 
   * @returns 如果已记录结束时间则返回 true
   */
  isCompleted(): boolean {
    return this.endTime !== undefined;
  }

  /**
   * 检查是否已收到首字节
   * 需求: 8.3
   * 
   * @returns 如果已记录首字节时间则返回 true
   */
  hasFirstByte(): boolean {
    return this.firstByteTime !== undefined;
  }
}

// ============ 辅助函数 ============

/**
 * 创建新的 TimeTracker 实例
 * 需求: 8.1
 * 
 * @returns 新的 TimeTracker 实例
 */
export function createTimeTracker(): TimeTracker {
  return new TimeTracker();
}

/**
 * 从时间戳计算耗时
 * 需求: 8.2
 * 
 * @param startTime - 开始时间戳
 * @param endTime - 结束时间戳
 * @returns 耗时（毫秒）
 */
export function calculateDuration(startTime: number, endTime: number): number {
  return endTime - startTime;
}

/**
 * 从时间戳计算首字节时间
 * 需求: 8.3
 * 
 * @param startTime - 开始时间戳
 * @param firstByteTime - 首字节时间戳
 * @returns 首字节时间（毫秒）
 */
export function calculateTTFB(startTime: number, firstByteTime: number): number {
  return firstByteTime - startTime;
}

/**
 * 验证耗时数据的有效性
 * 需求: 8.2, 8.3
 * 
 * Property 16: 流式响应时间追踪
 * ttfb（首字节时间）应该小于等于 duration（总耗时）
 * 
 * @param duration - 总耗时
 * @param ttfb - 首字节时间（可选）
 * @returns 如果数据有效则返回 true
 */
export function isValidTimingData(duration: number, ttfb?: number): boolean {
  // 耗时必须为非负数
  if (duration < 0) {
    return false;
  }
  
  // 如果有 ttfb，它必须小于等于 duration
  if (ttfb !== undefined) {
    if (ttfb < 0 || ttfb > duration) {
      return false;
    }
  }
  
  return true;
}

/**
 * 格式化耗时显示
 * 
 * @param duration - 耗时（毫秒）
 * @returns 格式化的耗时字符串
 */
export function formatDuration(duration: number): string {
  if (duration < 1000) {
    return `${duration}ms`;
  }
  
  const seconds = duration / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}
