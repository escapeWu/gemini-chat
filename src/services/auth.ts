/**
 * 鉴权服务
 * 提供密码哈希、验证等功能
 * Requirements: 5.4, 5.5, 5.6
 */

import { AuthConfig, DEFAULT_PASSWORD, AUTH_CONFIG_KEY } from '../types/auth';
import { authLogger as logger } from './logger';

/**
 * 简单的密码哈希函数
 * 使用 SHA-256 算法对密码进行哈希
 * 注意：这是一个简化实现，生产环境应使用更安全的方案如 bcrypt
 * 
 * @param password - 原始密码
 * @returns 哈希后的密码字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 验证密码是否匹配
 * 
 * @param inputPassword - 用户输入的密码
 * @param storedHash - 存储的密码哈希
 * @returns 密码是否匹配
 */
export async function verifyPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(inputPassword);
  return inputHash === storedHash;
}

/**
 * 检查两个密码是否匹配
 * 用于密码重置时验证新密码和确认密码
 * 
 * @param password - 新密码
 * @param confirmPassword - 确认密码
 * @returns 两个密码是否相等
 */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}


/**
 * 获取存储的鉴权配置
 * 
 * @returns 鉴权配置，如果不存在则返回 null
 */
export function getAuthConfig(): AuthConfig | null {
  try {
    const stored = localStorage.getItem(AUTH_CONFIG_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as AuthConfig;
  } catch (error) {
    logger.error('读取鉴权配置失败', error);
    return null;
  }
}

/**
 * 保存鉴权配置
 * 
 * @param config - 鉴权配置
 */
export function saveAuthConfig(config: AuthConfig): void {
  try {
    localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify(config));
    logger.info('鉴权配置已保存');
  } catch (error) {
    logger.error('保存鉴权配置失败', error);
  }
}

/**
 * 初始化鉴权配置
 * 如果没有配置，则使用默认密码创建配置
 * 
 * @returns 鉴权配置
 */
export async function initAuthConfig(): Promise<AuthConfig> {
  let config = getAuthConfig();
  
  if (!config) {
    // 首次使用，创建默认配置
    const defaultHash = await hashPassword(DEFAULT_PASSWORD);
    config = {
      passwordHash: defaultHash,
      isDefaultPassword: true,
    };
    saveAuthConfig(config);
    logger.info('已创建默认鉴权配置');
  }
  
  return config;
}

/**
 * 更新密码
 * 
 * @param newPassword - 新密码
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const newHash = await hashPassword(newPassword);
  const config: AuthConfig = {
    passwordHash: newHash,
    isDefaultPassword: false,
  };
  saveAuthConfig(config);
  logger.info('密码已更新');
}
