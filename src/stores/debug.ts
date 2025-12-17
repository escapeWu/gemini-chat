/**
 * 调试状态管理
 * 需求: 6.1, 6.3, 6.5
 */

import { create } from 'zustand';

// ============ 类型定义 ============

/**
 * Token 使用量
 * 需求: 7.1
 */
export interface TokenUsage {
  /** 输入 Token 数 */
  promptTokens: number;
  /** 输出 Token 数 */
  completionTokens: number;
  /** 总 Token 数 */
  totalTokens: number;
}

/**
 * API 请求记录
 * 需求: 6.3
 */
export interface ApiRequestRecord {
  /** 请求唯一 ID */
  id: string;
  /** 请求时间戳 */
  timestamp: number;
  /** 请求 URL */
  url: string;
  /** 请求方法 */
  method: string;
  /** 请求头 */
  headers: Record<string, string>;
  /** 请求体 */
  body: unknown;
  /** 响应状态码 */
  statusCode?: number;
  /** 响应内容 */
  response?: unknown;
  /** 错误信息 */
  error?: string;
  /** 请求耗时（毫秒） */
  duration?: number;
  /** 首字节时间（毫秒） */
  ttfb?: number;
  /** Token 使用量 */
  tokenUsage?: TokenUsage;
}

// ============ Store 状态接口 ============

/**
 * 调试 Store 状态
 * 需求: 6.1, 6.5
 */
interface DebugState {
  /** 请求历史记录 */
  requestHistory: ApiRequestRecord[];
  /** 当前选中的请求 ID */
  selectedRequestId: string | null;
  /** 是否启用调试模式 */
  debugEnabled: boolean;
  /** 最大历史记录数量 */
  maxHistorySize: number;
}

// ============ Store 操作接口 ============

/**
 * 调试 Store 操作
 */
interface DebugActions {
  /** 启用/禁用调试模式 */
  setDebugEnabled: (enabled: boolean) => void;
  /** 添加请求记录 */
  addRequestRecord: (record: ApiRequestRecord) => void;
  /** 更新请求记录（用于添加响应数据） */
  updateRequestRecord: (id: string, updates: Partial<ApiRequestRecord>) => void;
  /** 选择请求记录 */
  selectRequest: (id: string | null) => void;
  /** 清除所有历史记录 */
  clearHistory: () => void;
  /** 获取请求记录 */
  getRequestRecord: (id: string) => ApiRequestRecord | undefined;
  /** 设置最大历史记录数量 */
  setMaxHistorySize: (size: number) => void;
}

// ============ Store 类型 ============

export type DebugStore = DebugState & DebugActions;

// ============ 常量 ============

/** 默认最大历史记录数量 */
const DEFAULT_MAX_HISTORY_SIZE = 100;

// ============ 辅助函数 ============

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Store 创建 ============

/**
 * 创建调试 Store
 * 需求: 6.1, 6.5
 */
export const useDebugStore = create<DebugStore>((set, get) => ({
  // 初始状态
  requestHistory: [],
  selectedRequestId: null,
  debugEnabled: false,
  maxHistorySize: DEFAULT_MAX_HISTORY_SIZE,

  // 启用/禁用调试模式
  // 需求: 6.1
  setDebugEnabled: (enabled: boolean) => {
    set({ debugEnabled: enabled });
  },

  // 添加请求记录
  // 需求: 6.3
  addRequestRecord: (record: ApiRequestRecord) => {
    const state = get();
    
    // 如果调试模式未启用，不记录
    if (!state.debugEnabled) {
      return;
    }

    // 添加新记录到开头，并限制历史记录数量
    const newHistory = [record, ...state.requestHistory].slice(0, state.maxHistorySize);
    
    set({ requestHistory: newHistory });
  },

  // 更新请求记录
  // 需求: 6.3
  updateRequestRecord: (id: string, updates: Partial<ApiRequestRecord>) => {
    const state = get();
    
    const updatedHistory = state.requestHistory.map((record) =>
      record.id === id ? { ...record, ...updates } : record
    );
    
    set({ requestHistory: updatedHistory });
  },

  // 选择请求记录
  // 需求: 6.2
  selectRequest: (id: string | null) => {
    set({ selectedRequestId: id });
  },

  // 清除所有历史记录
  clearHistory: () => {
    set({ requestHistory: [], selectedRequestId: null });
  },

  // 获取请求记录
  getRequestRecord: (id: string) => {
    const state = get();
    return state.requestHistory.find((record) => record.id === id);
  },

  // 设置最大历史记录数量
  setMaxHistorySize: (size: number) => {
    const state = get();
    const newHistory = state.requestHistory.slice(0, size);
    set({ maxHistorySize: size, requestHistory: newHistory });
  },
}));

/**
 * 创建请求记录的辅助函数
 * 需求: 6.3 - Property 11: 请求记录完整性
 */
export function createRequestRecord(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: unknown
): ApiRequestRecord {
  return {
    id: generateRequestId(),
    timestamp: Date.now(),
    url,
    method,
    headers,
    body,
  };
}
