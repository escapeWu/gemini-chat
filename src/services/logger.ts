/**
 * 日志服务
 * 提供统一的日志输出功能，支持不同级别和模块标识
 */

// 日志级别类型
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志级别优先级（数字越大优先级越高）
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 日志级别显示名称
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

// 日志配置
interface LoggerConfig {
  /** 最小日志级别，低于此级别的日志不会输出 */
  minLevel: LogLevel;
  /** 是否启用日志 */
  enabled: boolean;
}

// 默认配置
const defaultConfig: LoggerConfig = {
  minLevel: 'debug',
  enabled: true,
};

// 当前配置
let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * 格式化当前时间
 * 格式：YYYY-MM-DD HH:mm:ss
 */
function formatTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化日志消息
 * 格式：[时间] [级别] [模块] 消息
 */
function formatMessage(level: LogLevel, module: string, message: string): string {
  return `[${formatTime()}] [${LOG_LEVEL_NAMES[level]}] [${module}] ${message}`;
}

/**
 * 检查是否应该输出该级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  if (!currentConfig.enabled) return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentConfig.minLevel];
}

/**
 * 输出日志
 */
function log(level: LogLevel, module: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const formattedMessage = formatMessage(level, module, message);
  
  switch (level) {
    case 'debug':
      if (data !== undefined) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
      break;
    case 'info':
      if (data !== undefined) {
        console.info(formattedMessage, data);
      } else {
        console.info(formattedMessage);
      }
      break;
    case 'warn':
      if (data !== undefined) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case 'error':
      if (data !== undefined) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
      break;
  }
}

/**
 * 日志服务接口
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * 创建指定模块的日志记录器
 * @param module 模块名称
 * @returns 日志记录器实例
 */
export function createLogger(module: string): Logger {
  return {
    debug: (message: string, data?: unknown) => log('debug', module, message, data),
    info: (message: string, data?: unknown) => log('info', module, message, data),
    warn: (message: string, data?: unknown) => log('warn', module, message, data),
    error: (message: string, data?: unknown) => log('error', module, message, data),
  };
}

/**
 * 配置日志服务
 * @param config 部分配置项
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 重置日志配置为默认值
 */
export function resetLoggerConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * 获取当前日志配置
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...currentConfig };
}

// 预定义的模块日志记录器
export const appLogger = createLogger('App');
export const apiLogger = createLogger('API');
export const storeLogger = createLogger('Store');
export const storageLogger = createLogger('Storage');
export const authLogger = createLogger('Auth');
