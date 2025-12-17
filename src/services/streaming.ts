/**
 * 流式响应控制服务
 * 需求: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { ChatWindowConfig } from '../types/chatWindow';
import type { AppSettings } from '../types/models';

/**
 * 解析流式响应设置
 * 实现对话设置优先逻辑：
 * - 当对话配置中 streamingEnabled 不为 undefined 时，使用对话级别的设置
 * - 否则使用全局设置中的流式响应配置
 * 
 * @param chatConfig 对话窗口配置
 * @param globalSettings 全局应用设置
 * @returns 解析后的流式响应开关状态
 * 
 * 需求: 1.3, 1.4
 */
export function resolveStreamingEnabled(
  chatConfig: ChatWindowConfig,
  globalSettings: AppSettings
): boolean {
  // 对话设置优先
  if (chatConfig.streamingEnabled !== undefined) {
    return chatConfig.streamingEnabled;
  }
  // 回退到全局设置
  return globalSettings.streamingEnabled;
}
