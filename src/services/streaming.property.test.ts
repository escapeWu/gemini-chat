/**
 * 流式响应控制服务属性测试
 * **Feature: app-enhancements, Property 1: 流式设置优先级**
 * **Validates: Requirements 1.3, 1.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveStreamingEnabled } from './streaming';
import type { ChatWindowConfig } from '../types/chatWindow';
import type { AppSettings } from '../types/models';
import type { GenerationConfig, SafetySetting, HarmCategory, HarmBlockThreshold } from '../types/gemini';

// ============ 生成器定义 ============

/**
 * 生成有效的 HarmCategory
 */
const harmCategoryArb = fc.constantFrom<HarmCategory>(
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT'
);

/**
 * 生成有效的 HarmBlockThreshold
 */
const harmBlockThresholdArb = fc.constantFrom<HarmBlockThreshold>(
  'BLOCK_NONE',
  'BLOCK_LOW_AND_ABOVE',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_ONLY_HIGH'
);

/**
 * 生成有效的 SafetySetting
 */
const safetySettingArb: fc.Arbitrary<SafetySetting> = fc.record({
  category: harmCategoryArb,
  threshold: harmBlockThresholdArb,
});

/**
 * 生成有效的 GenerationConfig
 */
const generationConfigArb: fc.Arbitrary<GenerationConfig> = fc.record({
  temperature: fc.double({ min: 0, max: 2, noNaN: true }),
  topP: fc.double({ min: 0, max: 1, noNaN: true }),
  topK: fc.integer({ min: 1, max: 100 }),
  maxOutputTokens: fc.option(fc.integer({ min: 1, max: 8192 }), { nil: undefined }),
  stopSequences: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), { nil: undefined }),
});

/**
 * 生成有效的主题模式
 */
const themeModeArb = fc.constantFrom<'light' | 'dark' | 'system'>('light', 'dark', 'system');

/**
 * 生成有效的 ChatWindowConfig（streamingEnabled 为 undefined）
 */
const chatWindowConfigWithoutStreamingArb: fc.Arbitrary<ChatWindowConfig> = fc.record({
  model: fc.string({ minLength: 1, maxLength: 50 }),
  generationConfig: generationConfigArb,
  systemInstruction: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  safetySettings: fc.option(fc.array(safetySettingArb, { maxLength: 4 }), { nil: undefined }),
  // streamingEnabled 为 undefined
});

/**
 * 生成有效的 ChatWindowConfig（streamingEnabled 为 boolean）
 */
const chatWindowConfigWithStreamingArb: fc.Arbitrary<ChatWindowConfig> = fc.record({
  model: fc.string({ minLength: 1, maxLength: 50 }),
  generationConfig: generationConfigArb,
  systemInstruction: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  safetySettings: fc.option(fc.array(safetySettingArb, { maxLength: 4 }), { nil: undefined }),
  streamingEnabled: fc.boolean(),
});

/**
 * 生成有效的 AppSettings
 */
const appSettingsArb: fc.Arbitrary<AppSettings> = fc.record({
  apiEndpoint: fc.webUrl(),
  apiKey: fc.string({ minLength: 0, maxLength: 100 }),
  currentModel: fc.string({ minLength: 1, maxLength: 50 }),
  generationConfig: generationConfigArb,
  safetySettings: fc.array(safetySettingArb, { maxLength: 4 }),
  systemInstruction: fc.string({ maxLength: 1000 }),
  theme: themeModeArb,
  sidebarCollapsed: fc.boolean(),
  streamingEnabled: fc.boolean(),
});

// ============ 测试套件 ============

describe('流式设置解析属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 1: 流式设置优先级**
   * *对于任意* 对话配置和全局设置的组合，当对话配置中 streamingEnabled 不为 undefined 时，
   * 解析结果应等于对话配置的值
   * **Validates: Requirements 1.3**
   */
  it('Property 1.1: 对话设置存在时应优先使用对话设置', () => {
    fc.assert(
      fc.property(
        chatWindowConfigWithStreamingArb,
        appSettingsArb,
        (chatConfig, globalSettings) => {
          // 对话配置中 streamingEnabled 为 boolean
          const result = resolveStreamingEnabled(chatConfig, globalSettings);
          
          // 解析结果应等于对话配置的值
          expect(result).toBe(chatConfig.streamingEnabled);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: app-enhancements, Property 1: 流式设置优先级**
   * *对于任意* 对话配置和全局设置的组合，当对话配置中 streamingEnabled 为 undefined 时，
   * 解析结果应等于全局设置的值
   * **Validates: Requirements 1.4**
   */
  it('Property 1.2: 对话设置不存在时应使用全局设置', () => {
    fc.assert(
      fc.property(
        chatWindowConfigWithoutStreamingArb,
        appSettingsArb,
        (chatConfig, globalSettings) => {
          // 对话配置中 streamingEnabled 为 undefined
          const result = resolveStreamingEnabled(chatConfig, globalSettings);
          
          // 解析结果应等于全局设置的值
          expect(result).toBe(globalSettings.streamingEnabled);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: app-enhancements, Property 1: 流式设置优先级**
   * *对于任意* 对话配置和全局设置的组合，解析结果应始终为 boolean 类型
   * **Validates: Requirements 1.3, 1.4**
   */
  it('Property 1.3: 解析结果应始终为 boolean 类型', () => {
    // 测试有对话设置的情况
    fc.assert(
      fc.property(
        chatWindowConfigWithStreamingArb,
        appSettingsArb,
        (chatConfig, globalSettings) => {
          const result = resolveStreamingEnabled(chatConfig, globalSettings);
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );

    // 测试无对话设置的情况
    fc.assert(
      fc.property(
        chatWindowConfigWithoutStreamingArb,
        appSettingsArb,
        (chatConfig, globalSettings) => {
          const result = resolveStreamingEnabled(chatConfig, globalSettings);
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
