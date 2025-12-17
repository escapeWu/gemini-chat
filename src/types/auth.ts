/**
 * 鉴权相关类型定义
 * Requirements: 5.1
 */

/**
 * 鉴权状态
 * 用于管理用户的登录状态和密码重置状态
 */
export interface AuthState {
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 是否需要重置密码（使用默认密码时） */
  needsPasswordReset: boolean;
}

/**
 * 鉴权配置
 * 存储在 LocalStorage 中的密码配置
 */
export interface AuthConfig {
  /** 密码哈希值 */
  passwordHash: string;
  /** 是否为默认密码 */
  isDefaultPassword: boolean;
}

/**
 * 默认密码
 */
export const DEFAULT_PASSWORD = 'adminiadmin';

/**
 * LocalStorage 中存储鉴权配置的键名
 */
export const AUTH_CONFIG_KEY = 'gemini-chat-auth-config';
