/**
 * Gemini API 服务测试
 * 属性测试验证 URL 验证和构建功能
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { validateApiEndpoint, buildRequestUrl } from './gemini';
import type { ApiConfig } from '../types/models';

// ============ 属性测试 ============

describe('Gemini API 服务属性测试', () => {
  /**
   * **Feature: gemini-chat, Property 2: API 端点 URL 格式验证**
   * *对于任意* URL 字符串，验证函数应该正确识别有效的 HTTP/HTTPS URL 格式，拒绝无效格式。
   * **验证: 需求 1.2**
   */
  describe('Property 2: API 端点 URL 格式验证', () => {
    // 生成有效的主机名（只包含字母、数字、点和连字符）
    const validHostnameArbitrary = fc.tuple(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
      fc.constantFrom('.com', '.org', '.net', '.io', '.dev', '.local', ''),
    ).map(([name, tld]) => name + tld);

    it('应该接受所有有效的 HTTP/HTTPS URL', () => {
      // 生成有效的 URL
      const validUrlArbitrary = fc.tuple(
        fc.constantFrom('http://', 'https://'),
        validHostnameArbitrary,
        fc.option(fc.nat({ max: 65535 }), { nil: undefined }), // 端口
        fc.array(fc.webSegment(), { maxLength: 5 }), // 路径段
      ).map(([protocol, host, port, pathSegments]) => {
        const portPart = port !== undefined ? `:${port}` : '';
        const pathPart = pathSegments.length > 0 ? '/' + pathSegments.join('/') : '';
        return `${protocol}${host}${portPart}${pathPart}`;
      });

      fc.assert(
        fc.property(validUrlArbitrary, (url) => {
          const result = validateApiEndpoint(url);
          return result.valid === true;
        }),
        { numRuns: 100 }
      );
    });

    it('应该拒绝所有非 HTTP/HTTPS 协议的 URL', () => {
      const invalidProtocols = fc.constantFrom(
        'ftp://', 'file://', 'mailto:', 'javascript:', 'data:', 'ws://', 'wss://'
      );
      
      const invalidUrlArbitrary = fc.tuple(
        invalidProtocols,
        fc.webSegment().filter(s => s.length > 0),
      ).map(([protocol, host]) => `${protocol}${host}`);

      fc.assert(
        fc.property(invalidUrlArbitrary, (url) => {
          const result = validateApiEndpoint(url);
          return result.valid === false;
        }),
        { numRuns: 100 }
      );
    });

    it('应该接受空字符串和纯空白字符串（需求 1.1: 空端点使用官方地址）', () => {
      const emptyOrWhitespaceArbitrary = fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t\n  ');

      fc.assert(
        fc.property(emptyOrWhitespaceArbitrary, (url) => {
          const result = validateApiEndpoint(url);
          // 需求 1.1: 空字符串或仅包含空白字符是有效的（将使用官方默认地址）
          return result.valid === true;
        }),
        { numRuns: 10 }
      );
    });

    it('应该拒绝不以协议开头的非空字符串', () => {
      const noProtocolArbitrary = fc.stringOf(
        fc.char().filter(c => c !== ':' && c !== '/')
      ).filter(s => s.trim().length > 0 && !s.startsWith('http'));

      fc.assert(
        fc.property(noProtocolArbitrary, (url) => {
          const result = validateApiEndpoint(url);
          return result.valid === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: gemini-chat, Property 13: API URL 构建正确性**
   * *对于任意* API 配置（端点、模型名称），构建的请求 URL 应该包含正确的模型名称和端点路径。
   * **验证: 需求 8.5**
   */
  describe('Property 13: API URL 构建正确性', () => {
    // 生成有效的 API 配置
    const validApiConfigArbitrary = fc.record({
      endpoint: fc.tuple(
        fc.constantFrom('http://', 'https://'),
        fc.webSegment().filter(s => s.length > 0),
        fc.array(fc.webSegment(), { maxLength: 3 }),
      ).map(([protocol, host, pathSegments]) => {
        const pathPart = pathSegments.length > 0 ? '/' + pathSegments.join('/') : '';
        return `${protocol}${host}${pathPart}`;
      }),
      apiKey: fc.hexaString({ minLength: 10, maxLength: 40 }),
      model: fc.constantFrom(
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b'
      ),
    }) as fc.Arbitrary<ApiConfig>;

    it('构建的 URL 应该包含模型名称', () => {
      fc.assert(
        fc.property(validApiConfigArbitrary, fc.boolean(), (config, stream) => {
          const url = buildRequestUrl(config, stream);
          return url.includes(`models/${config.model}`);
        }),
        { numRuns: 100 }
      );
    });

    it('构建的 URL 应该包含 API 密钥', () => {
      fc.assert(
        fc.property(validApiConfigArbitrary, fc.boolean(), (config, stream) => {
          const url = buildRequestUrl(config, stream);
          return url.includes(`key=${config.apiKey}`);
        }),
        { numRuns: 100 }
      );
    });

    it('流式请求应该使用 streamGenerateContent 方法并包含 alt=sse', () => {
      fc.assert(
        fc.property(validApiConfigArbitrary, (config) => {
          const url = buildRequestUrl(config, true);
          return url.includes('streamGenerateContent') && url.includes('alt=sse');
        }),
        { numRuns: 100 }
      );
    });

    it('非流式请求应该使用 generateContent 方法且不包含 alt=sse', () => {
      fc.assert(
        fc.property(validApiConfigArbitrary, (config) => {
          const url = buildRequestUrl(config, false);
          return url.includes('generateContent') && 
                 !url.includes('streamGenerateContent') && 
                 !url.includes('alt=sse');
        }),
        { numRuns: 100 }
      );
    });

    it('构建的 URL 应该以端点开头（移除末尾斜杠）', () => {
      // 测试带末尾斜杠的端点
      const configWithTrailingSlash = fc.record({
        endpoint: fc.tuple(
          fc.constantFrom('http://', 'https://'),
          fc.webSegment().filter(s => s.length > 0),
        ).map(([protocol, host]) => `${protocol}${host}/`),
        apiKey: fc.hexaString({ minLength: 10, maxLength: 40 }),
        model: fc.constant('gemini-2.0-flash'),
      }) as fc.Arbitrary<ApiConfig>;

      fc.assert(
        fc.property(configWithTrailingSlash, (config) => {
          const url = buildRequestUrl(config, true);
          const expectedStart = config.endpoint.replace(/\/+$/, '');
          return url.startsWith(expectedStart);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 请求体构建属性测试 ============

import { buildRequestBody } from './gemini';
import type { GeminiContent, GenerationConfig, SafetySetting, HarmCategory, HarmBlockThreshold } from '../types';

describe('请求体构建属性测试', () => {
  // 生成有效的 GeminiContent
  const geminiContentArbitrary: fc.Arbitrary<GeminiContent> = fc.record({
    role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
    parts: fc.array(
      fc.record({ text: fc.string({ minLength: 1, maxLength: 100 }) }),
      { minLength: 1, maxLength: 3 }
    ),
  });

  // 生成有效的 GenerationConfig
  const generationConfigArbitrary: fc.Arbitrary<GenerationConfig> = fc.record({
    temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
    topP: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    topK: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
    maxOutputTokens: fc.option(fc.nat({ max: 8192 }), { nil: undefined }),
    stopSequences: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }), { nil: undefined }),
  });

  // 生成有效的 SafetySetting
  const harmCategoryArbitrary: fc.Arbitrary<HarmCategory> = fc.constantFrom(
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT'
  );

  const harmBlockThresholdArbitrary: fc.Arbitrary<HarmBlockThreshold> = fc.constantFrom(
    'BLOCK_NONE',
    'BLOCK_LOW_AND_ABOVE',
    'BLOCK_MEDIUM_AND_ABOVE',
    'BLOCK_ONLY_HIGH'
  );

  const safetySettingArbitrary: fc.Arbitrary<SafetySetting> = fc.record({
    category: harmCategoryArbitrary,
    threshold: harmBlockThresholdArbitrary,
  });

  /**
   * **Feature: gemini-chat, Property 3: Gemini 请求体构建正确性**
   * *对于任意* 有效的消息内容、生成配置、安全设置和系统指令组合，
   * 构建的请求体应该符合 Gemini API 格式规范，包含所有必要字段。
   * **验证: 需求 2.4, 3.2, 5.6, 12.3**
   */
  describe('Property 3: Gemini 请求体构建正确性', () => {
    it('请求体应该始终包含 contents 字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 5 }),
          fc.option(generationConfigArbitrary, { nil: undefined }),
          fc.option(fc.array(safetySettingArbitrary, { maxLength: 4 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          (contents, genConfig, safetySettings, systemInstruction) => {
            const result = buildRequestBody(contents, genConfig, safetySettings ?? undefined, systemInstruction ?? undefined);
            return result.contents === contents;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当提供有效的 generationConfig 时，请求体应该包含该字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          fc.record({
            temperature: fc.double({ min: 0, max: 2, noNaN: true }),
          }),
          (contents, genConfig) => {
            const result = buildRequestBody(contents, genConfig, undefined, undefined);
            return result.generationConfig !== undefined && 
                   result.generationConfig.temperature === genConfig.temperature;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当提供非空 safetySettings 时，请求体应该包含该字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(safetySettingArbitrary, { minLength: 1, maxLength: 4 }),
          (contents, safetySettings) => {
            const result = buildRequestBody(contents, undefined, safetySettings, undefined);
            return result.safetySettings !== undefined && 
                   result.safetySettings.length === safetySettings.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当提供非空 systemInstruction 时，请求体应该包含该字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          (contents, systemInstruction) => {
            const result = buildRequestBody(contents, undefined, undefined, systemInstruction);
            return result.systemInstruction !== undefined &&
                   result.systemInstruction.parts.length > 0 &&
                   (result.systemInstruction.parts[0] as { text: string }).text === systemInstruction;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当 systemInstruction 为空或纯空白时，请求体不应该包含该字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          fc.constantFrom('', ' ', '  ', '\t', '\n'),
          (contents, systemInstruction) => {
            const result = buildRequestBody(contents, undefined, undefined, systemInstruction);
            return result.systemInstruction === undefined;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('当 safetySettings 为空数组时，请求体不应该包含该字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          (contents) => {
            const result = buildRequestBody(contents, undefined, [], undefined);
            return result.safetySettings === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 高级参数请求构建属性测试 ============

import { buildThinkingConfig, applyMediaResolution } from './gemini';
import type { ModelAdvancedConfig, MediaResolution, ThinkingLevel } from '../types/models';

describe('高级参数请求构建属性测试', () => {
  // 生成有效的 GeminiContent
  const geminiContentArbitrary: fc.Arbitrary<GeminiContent> = fc.record({
    role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
    parts: fc.array(
      fc.record({ text: fc.string({ minLength: 1, maxLength: 100 }) }),
      { minLength: 1, maxLength: 3 }
    ),
  });

  // 生成包含内联数据的 GeminiContent（模拟图片/视频）
  const geminiContentWithMediaArbitrary: fc.Arbitrary<GeminiContent> = fc.record({
    role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
    parts: fc.array(
      fc.oneof(
        fc.record({ text: fc.string({ minLength: 1, maxLength: 50 }) }),
        fc.record({
          inlineData: fc.record({
            mimeType: fc.constantFrom('image/jpeg', 'image/png', 'video/mp4'),
            data: fc.base64String({ minLength: 10, maxLength: 100 }),
          }),
        })
      ),
      { minLength: 1, maxLength: 3 }
    ),
  });

  // 生成有效的 ThinkingLevel
  const thinkingLevelArbitrary: fc.Arbitrary<ThinkingLevel> = fc.constantFrom('low', 'high');

  // 生成有效的 MediaResolution
  const mediaResolutionArbitrary: fc.Arbitrary<MediaResolution> = fc.constantFrom(
    'media_resolution_low',
    'media_resolution_medium',
    'media_resolution_high',
    'media_resolution_ultra_high'
  );

  /**
   * **Feature: model-management, Property 6: 高级参数请求构建正确性**
   * *对于任意* 包含 thinkingLevel 或 mediaResolution 的配置，
   * 构建的请求体应该包含正确格式的 thinkingConfig 或 mediaResolution 字段。
   * **Validates: Requirements 4.3, 4.4**
   */
  describe('Property 6: 高级参数请求构建正确性', () => {
    it('当提供 thinkingLevel 时，请求体应该包含正确格式的 thinkingConfig', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          thinkingLevelArbitrary,
          (contents, thinkingLevel) => {
            const advancedConfig: ModelAdvancedConfig = { thinkingLevel };
            const result = buildRequestBody(contents, undefined, undefined, undefined, advancedConfig);
            
            // 验证 thinkingConfig 存在且格式正确
            // 需求 1.3, 1.4: 使用 thinkingLevel 字段
            return result.thinkingConfig !== undefined &&
                   result.thinkingConfig.thinkingLevel === thinkingLevel;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当未提供 thinkingLevel 时，请求体不应该包含 thinkingConfig', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          (contents) => {
            const advancedConfig: ModelAdvancedConfig = {};
            const result = buildRequestBody(contents, undefined, undefined, undefined, advancedConfig);
            
            return result.thinkingConfig === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当提供 mediaResolution 时，内联数据应该包含 mediaResolution 字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentWithMediaArbitrary, { minLength: 1, maxLength: 3 }),
          mediaResolutionArbitrary,
          (contents, mediaResolution) => {
            const advancedConfig: ModelAdvancedConfig = { mediaResolution };
            const result = buildRequestBody(contents, undefined, undefined, undefined, advancedConfig);
            
            // 检查所有包含 inlineData 的部分是否都有 mediaResolution
            for (const content of result.contents) {
              for (const part of content.parts) {
                if ('inlineData' in part) {
                  // 验证 mediaResolution 被添加到 inlineData 中
                  const inlineData = part.inlineData as { mimeType: string; data: string; mediaResolution?: MediaResolution };
                  if (inlineData.mediaResolution !== mediaResolution) {
                    return false;
                  }
                }
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当未提供 mediaResolution 时，内联数据不应该包含 mediaResolution 字段', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentWithMediaArbitrary, { minLength: 1, maxLength: 3 }),
          (contents) => {
            const result = buildRequestBody(contents, undefined, undefined, undefined, undefined);
            
            // 检查所有包含 inlineData 的部分是否都没有 mediaResolution
            for (const content of result.contents) {
              for (const part of content.parts) {
                if ('inlineData' in part) {
                  const inlineData = part.inlineData as { mimeType: string; data: string; mediaResolution?: MediaResolution };
                  if (inlineData.mediaResolution !== undefined) {
                    return false;
                  }
                }
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('buildThinkingConfig 应该返回正确格式的思考配置', () => {
      fc.assert(
        fc.property(
          thinkingLevelArbitrary,
          (thinkingLevel) => {
            const config = buildThinkingConfig(thinkingLevel);
            // 需求 1.3, 1.4: 使用 thinkingLevel 字段
            return config.thinkingLevel === thinkingLevel;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('applyMediaResolution 应该保持文本部分不变', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentArbitrary, { minLength: 1, maxLength: 3 }),
          mediaResolutionArbitrary,
          (contents, mediaResolution) => {
            const result = applyMediaResolution(contents, mediaResolution);
            
            // 验证文本部分保持不变
            for (let i = 0; i < contents.length; i++) {
              const contentItem = contents[i];
              const resultItem = result[i];
              if (!contentItem || !resultItem) continue;
              for (let j = 0; j < contentItem.parts.length; j++) {
                const originalPart = contentItem.parts[j];
                const resultPart = resultItem.parts[j];
                if (!originalPart || !resultPart) continue;
                if ('text' in originalPart && 'text' in resultPart) {
                  if (originalPart.text !== resultPart.text) {
                    return false;
                  }
                }
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('applyMediaResolution 不传入 mediaResolution 时应该返回原内容', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentWithMediaArbitrary, { minLength: 1, maxLength: 3 }),
          (contents) => {
            const result = applyMediaResolution(contents, undefined);
            
            // 验证返回的是原内容（引用相同）
            return result === contents;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('同时提供 thinkingLevel 和 mediaResolution 时，请求体应该同时包含两者', () => {
      fc.assert(
        fc.property(
          fc.array(geminiContentWithMediaArbitrary, { minLength: 1, maxLength: 3 }),
          thinkingLevelArbitrary,
          mediaResolutionArbitrary,
          (contents, thinkingLevel, mediaResolution) => {
            const advancedConfig: ModelAdvancedConfig = { thinkingLevel, mediaResolution };
            const result = buildRequestBody(contents, undefined, undefined, undefined, advancedConfig);
            
            // 验证 thinkingConfig 存在
            // 需求 1.3, 1.4: 使用 thinkingLevel 字段
            const hasThinkingConfig = result.thinkingConfig !== undefined &&
                                      result.thinkingConfig.thinkingLevel === thinkingLevel;
            
            // 验证 mediaResolution 被应用到内联数据
            let mediaResolutionApplied = true;
            for (const content of result.contents) {
              for (const part of content.parts) {
                if ('inlineData' in part) {
                  const inlineData = part.inlineData as { mimeType: string; data: string; mediaResolution?: MediaResolution };
                  if (inlineData.mediaResolution !== mediaResolution) {
                    mediaResolutionApplied = false;
                    break;
                  }
                }
              }
            }
            
            return hasThinkingConfig && mediaResolutionApplied;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
