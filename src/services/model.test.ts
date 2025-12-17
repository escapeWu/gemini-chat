/**
 * 模型管理服务测试
 * 属性测试验证模型管理功能
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { detectApiProvider, detectModelCapabilities, MODEL_CAPABILITIES, mergeModels, getEffectiveConfig, resolveRedirectChain, getEnabledModels, sortModels, setNewModelsDisabled } from './model';
import type { ModelConfig, ModelAdvancedConfig } from '../types/models';

// ============ API 提供商检测属性测试 ============

describe('模型管理服务属性测试', () => {
  /**
   * **Feature: model-management, Property 1: API 提供商检测一致性**
   * *对于任意* API 端点 URL，detectApiProvider 函数应该根据 URL 特征返回正确的提供商类型：
   * 包含 generativelanguage.googleapis.com 的返回 'gemini'，其他返回 'openai'。
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Property 1: API 提供商检测一致性', () => {
    // 生成包含 Gemini API 特征的 URL
    const geminiUrlArbitrary = fc.tuple(
      fc.constantFrom('http://', 'https://'),
      fc.constantFrom('', 'api.', 'proxy.', 'custom.'),
      fc.constant('generativelanguage.googleapis.com'),
      fc.constantFrom('', '/v1', '/v1beta', '/v1beta2', '/v1beta3'),
    ).map(([protocol, prefix, domain, path]) => `${protocol}${prefix}${domain}${path}`);

    // 生成不包含 Gemini API 特征的 URL（OpenAI 兼容）
    const openaiUrlArbitrary = fc.tuple(
      fc.constantFrom('http://', 'https://'),
      fc.constantFrom(
        'api.openai.com',
        'api.anthropic.com',
        'localhost:8080',
        'my-proxy.example.com',
        'openrouter.ai',
        'api.together.xyz',
        'api.groq.com',
        'custom-llm-server.local',
      ),
      fc.constantFrom('', '/v1', '/api', '/chat'),
    ).map(([protocol, domain, path]) => `${protocol}${domain}${path}`);

    it('包含 generativelanguage.googleapis.com 的 URL 应该返回 gemini', () => {
      fc.assert(
        fc.property(geminiUrlArbitrary, (url) => {
          const result = detectApiProvider(url);
          return result === 'gemini';
        }),
        { numRuns: 100 }
      );
    });

    it('不包含 generativelanguage.googleapis.com 的 URL 应该返回 openai', () => {
      fc.assert(
        fc.property(openaiUrlArbitrary, (url) => {
          const result = detectApiProvider(url);
          return result === 'openai';
        }),
        { numRuns: 100 }
      );
    });

    it('检测应该不区分大小写', () => {
      // 生成各种大小写组合的 Gemini URL
      const mixedCaseGeminiUrlArbitrary = fc.tuple(
        fc.constantFrom('http://', 'https://', 'HTTP://', 'HTTPS://'),
        fc.constantFrom(
          'generativelanguage.googleapis.com',
          'GENERATIVELANGUAGE.GOOGLEAPIS.COM',
          'GenerativeLanguage.GoogleApis.Com',
          'generativelanguage.GOOGLEAPIS.com',
        ),
      ).map(([protocol, domain]) => `${protocol}${domain}`);

      fc.assert(
        fc.property(mixedCaseGeminiUrlArbitrary, (url) => {
          const result = detectApiProvider(url);
          return result === 'gemini';
        }),
        { numRuns: 100 }
      );
    });

    it('空字符串或无效输入应该返回 openai 作为默认值', () => {
      const invalidInputArbitrary = fc.constantFrom('', ' ', null, undefined);

      fc.assert(
        fc.property(invalidInputArbitrary, (input) => {
          const result = detectApiProvider(input as string);
          return result === 'openai';
        }),
        { numRuns: 10 }
      );
    });

    it('返回值应该始终是 gemini 或 openai', () => {
      // 生成任意字符串
      const anyStringArbitrary = fc.string({ maxLength: 200 });

      fc.assert(
        fc.property(anyStringArbitrary, (url) => {
          const result = detectApiProvider(url);
          return result === 'gemini' || result === 'openai';
        }),
        { numRuns: 100 }
      );
    });

    it('相同输入应该始终返回相同结果（确定性）', () => {
      const urlArbitrary = fc.oneof(geminiUrlArbitrary, openaiUrlArbitrary);

      fc.assert(
        fc.property(urlArbitrary, (url) => {
          const result1 = detectApiProvider(url);
          const result2 = detectApiProvider(url);
          const result3 = detectApiProvider(url);
          return result1 === result2 && result2 === result3;
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 模型能力检测属性测试 ============

describe('模型能力检测属性测试', () => {
  /**
   * **Feature: model-management, Property 5: 模型能力检测正确性**
   * *对于任意* 模型 ID，detectModelCapabilities 应该根据模型 ID 前缀正确识别其支持的能力
   * （Gemini 3 系列和 2.5 系列支持 thinking，支持图像的模型支持 media_resolution）。
   * **Validates: Requirements 4.1, 4.2, 4.5**
   */
  describe('Property 5: 模型能力检测正确性', () => {
    // 生成 Gemini 3 系列模型 ID
    const gemini3ModelArbitrary = fc.tuple(
      fc.constant('gemini-3'),
      fc.constantFrom('-pro', '-flash', '-ultra'),
      fc.constantFrom('', '-preview', '-latest'),
    ).map(([prefix, variant, suffix]) => `${prefix}${variant}${suffix}`);

    // 生成 Gemini 2.5 系列模型 ID（非 lite）
    const gemini25ModelArbitrary = fc.tuple(
      fc.constant('gemini-2.5'),
      fc.constantFrom('-pro', '-flash'),
      fc.constantFrom('', '-preview', '-latest'),
    ).map(([prefix, variant, suffix]) => `${prefix}${variant}${suffix}`);

    // 生成 Gemini 2.5 lite 系列模型 ID
    const gemini25LiteModelArbitrary = fc.tuple(
      fc.constant('gemini-2.5'),
      fc.constantFrom('-flash-lite', '-pro-lite'),
      fc.constantFrom('', '-preview'),
    ).map(([prefix, variant, suffix]) => `${prefix}${variant}${suffix}`);

    // 生成 Gemini 2.0 系列模型 ID
    const gemini20ModelArbitrary = fc.tuple(
      fc.constant('gemini-2.0'),
      fc.constantFrom('-flash', '-flash-lite', '-pro'),
      fc.constantFrom('', '-preview', '-latest'),
    ).map(([prefix, variant, suffix]) => `${prefix}${variant}${suffix}`);

    // 生成带 -image 后缀的模型 ID
    const imageModelArbitrary = fc.tuple(
      fc.constantFrom('gemini-3', 'gemini-2.5'),
      fc.constantFrom('-pro', '-flash'),
      fc.constant('-image'),
      fc.constantFrom('', '-preview'),
    ).map(([prefix, variant, image, suffix]) => `${prefix}${variant}${image}${suffix}`);

    // 生成非 Gemini 模型 ID
    const nonGeminiModelArbitrary = fc.constantFrom(
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'llama-2-70b',
      'mistral-7b',
      'custom-model',
    );

    it('Gemini 3 系列模型应该支持 thinking', () => {
      fc.assert(
        fc.property(gemini3ModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsThinking === true;
        }),
        { numRuns: 100 }
      );
    });

    it('Gemini 2.5 系列模型（非 lite）应该支持 thinking', () => {
      fc.assert(
        fc.property(gemini25ModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsThinking === true;
        }),
        { numRuns: 100 }
      );
    });

    it('Gemini 2.5 lite 系列模型不应该支持 thinking', () => {
      fc.assert(
        fc.property(gemini25LiteModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsThinking === false || capabilities.supportsThinking === undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('Gemini 2.0 系列模型不应该支持 thinking', () => {
      fc.assert(
        fc.property(gemini20ModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsThinking === false;
        }),
        { numRuns: 100 }
      );
    });

    it('Gemini 3 和 2.5 系列模型（非图片生成）应该支持 media_resolution', () => {
      // 排除图片生成模型，因为它们不支持 media_resolution
      const geminiAdvancedModelArbitrary = fc.oneof(gemini3ModelArbitrary, gemini25ModelArbitrary)
        .filter(modelId => !modelId.includes('-image'));

      fc.assert(
        fc.property(geminiAdvancedModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsMediaResolution === true;
        }),
        { numRuns: 100 }
      );
    });

    it('带 -image 后缀的模型应该支持图像生成', () => {
      fc.assert(
        fc.property(imageModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsImageGeneration === true;
        }),
        { numRuns: 100 }
      );
    });

    it('非 Gemini 模型应该返回空能力或不支持 thinking', () => {
      fc.assert(
        fc.property(nonGeminiModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          return capabilities.supportsThinking === undefined || capabilities.supportsThinking === false;
        }),
        { numRuns: 100 }
      );
    });

    it('空字符串或无效输入应该返回空能力对象', () => {
      const invalidInputArbitrary = fc.constantFrom('', ' ', null, undefined);

      fc.assert(
        fc.property(invalidInputArbitrary, (input) => {
          const capabilities = detectModelCapabilities(input as string);
          return Object.keys(capabilities).length === 0;
        }),
        { numRuns: 10 }
      );
    });

    it('预设模型应该返回正确的能力配置', () => {
      const presetModelArbitrary = fc.constantFrom(...Object.keys(MODEL_CAPABILITIES));

      fc.assert(
        fc.property(presetModelArbitrary, (modelId) => {
          const capabilities = detectModelCapabilities(modelId);
          const expected = MODEL_CAPABILITIES[modelId];
          
          // 验证关键能力匹配
          if (!expected) {
            return false;
          }
          return (
            capabilities.supportsThinking === expected.supportsThinking &&
            capabilities.supportsMediaResolution === expected.supportsMediaResolution
          );
        }),
        { numRuns: 100 }
      );
    });

    it('相同输入应该始终返回相同结果（确定性）', () => {
      const modelIdArbitrary = fc.oneof(
        gemini3ModelArbitrary,
        gemini25ModelArbitrary,
        gemini20ModelArbitrary,
        nonGeminiModelArbitrary
      );

      fc.assert(
        fc.property(modelIdArbitrary, (modelId) => {
          const result1 = detectModelCapabilities(modelId);
          const result2 = detectModelCapabilities(modelId);
          return JSON.stringify(result1) === JSON.stringify(result2);
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 模型合并属性测试 ============

describe('模型合并属性测试', () => {
  /**
   * **Feature: model-management, Property 2: 模型合并保持唯一性**
   * *对于任意* 远程模型列表和本地模型列表，合并后的列表中每个模型 ID 应该唯一，
   * 且本地自定义配置优先于远程配置。
   * **Validates: Requirements 1.4, 5.3**
   */
  describe('Property 2: 模型合并保持唯一性', () => {
    // 生成模型配置
    const modelConfigArbitrary: fc.Arbitrary<ModelConfig> = fc.record({
      id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 3, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ maxLength: 100 }),
      isCustom: fc.option(fc.boolean(), { nil: undefined }),
      redirectTo: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
      provider: fc.option(fc.constantFrom('gemini', 'openai') as fc.Arbitrary<'gemini' | 'openai'>, { nil: undefined }),
    });

    // 生成模型列表（可能有重复 ID）
    const modelListArbitrary = fc.array(modelConfigArbitrary, { minLength: 0, maxLength: 10 });

    it('合并后的列表中每个模型 ID 应该唯一', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelListArbitrary, (remote, local) => {
          const merged = mergeModels(remote, local);
          const ids = merged.map(m => m.id);
          const uniqueIds = new Set(ids);
          return ids.length === uniqueIds.size;
        }),
        { numRuns: 100 }
      );
    });

    it('合并后的列表应该包含所有唯一的模型 ID', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelListArbitrary, (remote, local) => {
          const merged = mergeModels(remote, local);
          const mergedIds = new Set(merged.map(m => m.id));
          
          // 所有远程模型 ID 都应该在结果中
          for (const model of remote) {
            if (!mergedIds.has(model.id)) {
              return false;
            }
          }
          
          // 所有本地模型 ID 都应该在结果中
          for (const model of local) {
            if (!mergedIds.has(model.id)) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('当 ID 冲突时，本地配置应该优先', () => {
      // 生成有重叠 ID 的模型列表
      const sharedId = 'shared-model-id';
      
      const remoteWithSharedId: fc.Arbitrary<ModelConfig[]> = fc.tuple(
        fc.record({
          id: fc.constant(sharedId),
          name: fc.constant('Remote Model'),
          description: fc.constant('Remote description'),
          provider: fc.constant('gemini') as fc.Arbitrary<'gemini'>,
        }),
        modelListArbitrary
      ).map(([shared, others]) => [shared, ...others]);

      const localWithSharedId: fc.Arbitrary<ModelConfig[]> = fc.tuple(
        fc.record({
          id: fc.constant(sharedId),
          name: fc.constant('Local Model'),
          description: fc.constant('Local description'),
          isCustom: fc.constant(true),
          redirectTo: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
        }),
        modelListArbitrary
      ).map(([shared, others]) => [shared, ...others]);

      fc.assert(
        fc.property(remoteWithSharedId, localWithSharedId, (remote, local) => {
          const merged = mergeModels(remote, local);
          const sharedModel = merged.find(m => m.id === sharedId);
          
          if (!sharedModel) {
            return false;
          }
          
          // 本地配置应该优先
          return sharedModel.name === 'Local Model' && 
                 sharedModel.description === 'Local description' &&
                 sharedModel.isCustom === true;
        }),
        { numRuns: 100 }
      );
    });

    it('本地独有的模型应该保留在合并结果中', () => {
      const localOnlyId = 'local-only-model';
      
      const remoteWithoutLocalOnly = modelListArbitrary.filter(
        models => !models.some(m => m.id === localOnlyId)
      );

      const localWithLocalOnly: fc.Arbitrary<ModelConfig[]> = fc.tuple(
        fc.record({
          id: fc.constant(localOnlyId),
          name: fc.constant('Local Only Model'),
          description: fc.constant('This model only exists locally'),
          isCustom: fc.constant(true),
        }),
        modelListArbitrary
      ).map(([localOnly, others]) => [localOnly, ...others]);

      fc.assert(
        fc.property(remoteWithoutLocalOnly, localWithLocalOnly, (remote, local) => {
          const merged = mergeModels(remote, local);
          const localOnlyModel = merged.find(m => m.id === localOnlyId);
          
          return localOnlyModel !== undefined && 
                 localOnlyModel.name === 'Local Only Model' &&
                 localOnlyModel.isCustom === true;
        }),
        { numRuns: 100 }
      );
    });

    it('空列表合并应该正确处理', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          // 空远程 + 本地 = 本地
          const merged1 = mergeModels([], models);
          const localIds = new Set(models.map(m => m.id));
          const merged1Ids = new Set(merged1.map(m => m.id));
          
          // 远程 + 空本地 = 远程
          const merged2 = mergeModels(models, []);
          const remoteIds = new Set(models.map(m => m.id));
          const merged2Ids = new Set(merged2.map(m => m.id));
          
          // 空 + 空 = 空
          const merged3 = mergeModels([], []);
          
          return (
            // 验证 ID 集合相等
            localIds.size === merged1Ids.size &&
            [...localIds].every(id => merged1Ids.has(id)) &&
            remoteIds.size === merged2Ids.size &&
            [...remoteIds].every(id => merged2Ids.has(id)) &&
            merged3.length === 0
          );
        }),
        { numRuns: 100 }
      );
    });

    it('合并操作应该是确定性的', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelListArbitrary, (remote, local) => {
          const merged1 = mergeModels(remote, local);
          const merged2 = mergeModels(remote, local);
          
          // 结果应该相同
          if (merged1.length !== merged2.length) {
            return false;
          }
          
          for (let i = 0; i < merged1.length; i++) {
            const m1 = merged1[i];
            const m2 = merged2[i];
            if (!m1 || !m2 || m1.id !== m2.id) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 重定向参数解析属性测试 ============

describe('重定向参数解析属性测试', () => {
  /**
   * **Feature: model-management, Property 4: 重定向参数解析正确性**
   * *对于任意* 设置了重定向的模型，getEffectiveConfig 应该返回目标模型的参数配置；
   * 清除重定向后应该返回模型自身的配置。
   * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
   */
  describe('Property 4: 重定向参数解析正确性', () => {
    // 生成有效的模型 ID
    const modelIdArbitrary = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 3, maxLength: 15 }
    );

    // 生成高级参数配置
    const advancedConfigArbitrary: fc.Arbitrary<ModelAdvancedConfig> = fc.record({
      thinkingLevel: fc.option(fc.constantFrom('low', 'high') as fc.Arbitrary<'low' | 'high'>, { nil: undefined }),
      mediaResolution: fc.option(
        fc.constantFrom(
          'media_resolution_low',
          'media_resolution_medium',
          'media_resolution_high',
          'media_resolution_ultra_high'
        ) as fc.Arbitrary<'media_resolution_low' | 'media_resolution_medium' | 'media_resolution_high' | 'media_resolution_ultra_high'>,
        { nil: undefined }
      ),
    });

    it('没有重定向的模型应该返回自身的配置', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          advancedConfigArbitrary,
          (modelId, advancedConfig) => {
            const models: ModelConfig[] = [{
              id: modelId,
              name: 'Test Model',
              description: 'Test',
              advancedConfig,
            }];

            const result = getEffectiveConfig(modelId, models);
            
            // 应该返回模型自身的配置
            return JSON.stringify(result) === JSON.stringify(advancedConfig);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('设置了重定向的模型应该返回目标模型的配置', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          modelIdArbitrary.filter(id => id.length >= 3),
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          (sourceId, targetId, sourceConfig, targetConfig) => {
            // 确保源和目标 ID 不同
            if (sourceId === targetId) {
              return true; // 跳过相同 ID 的情况
            }

            const models: ModelConfig[] = [
              {
                id: sourceId,
                name: 'Source Model',
                description: 'Source',
                redirectTo: targetId,
                advancedConfig: sourceConfig,
              },
              {
                id: targetId,
                name: 'Target Model',
                description: 'Target',
                advancedConfig: targetConfig,
              },
            ];

            const result = getEffectiveConfig(sourceId, models);
            
            // 应该返回目标模型的配置
            return JSON.stringify(result) === JSON.stringify(targetConfig);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('重定向链应该正确解析到最终目标', () => {
      fc.assert(
        fc.property(
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          (configA, configB, configC) => {
            // 创建重定向链: A -> B -> C
            const models: ModelConfig[] = [
              {
                id: 'model-a',
                name: 'Model A',
                description: 'A',
                redirectTo: 'model-b',
                advancedConfig: configA,
              },
              {
                id: 'model-b',
                name: 'Model B',
                description: 'B',
                redirectTo: 'model-c',
                advancedConfig: configB,
              },
              {
                id: 'model-c',
                name: 'Model C',
                description: 'C',
                advancedConfig: configC,
              },
            ];

            const result = getEffectiveConfig('model-a', models);
            
            // 应该返回链末端模型 C 的配置
            return JSON.stringify(result) === JSON.stringify(configC);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('循环重定向应该被检测并返回空配置', () => {
      fc.assert(
        fc.property(
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          (configA, configB) => {
            // 创建循环重定向: A -> B -> A
            const models: ModelConfig[] = [
              {
                id: 'model-a',
                name: 'Model A',
                description: 'A',
                redirectTo: 'model-b',
                advancedConfig: configA,
              },
              {
                id: 'model-b',
                name: 'Model B',
                description: 'B',
                redirectTo: 'model-a',
                advancedConfig: configB,
              },
            ];

            const result = resolveRedirectChain('model-a', models);
            
            // 应该检测到循环
            return result.hasCircularRedirect === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('自引用重定向应该被检测为循环', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          advancedConfigArbitrary,
          (modelId, config) => {
            // 创建自引用: A -> A
            const models: ModelConfig[] = [
              {
                id: modelId,
                name: 'Self Redirect Model',
                description: 'Self',
                redirectTo: modelId,
                advancedConfig: config,
              },
            ];

            const result = resolveRedirectChain(modelId, models);
            
            // 应该检测到循环
            return result.hasCircularRedirect === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('重定向到不存在的模型应该返回源模型自身的配置', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          advancedConfigArbitrary,
          (modelId, config) => {
            const models: ModelConfig[] = [
              {
                id: modelId,
                name: 'Source Model',
                description: 'Source',
                redirectTo: 'non-existent-model',
                advancedConfig: config,
              },
            ];

            const result = getEffectiveConfig(modelId, models);
            
            // 重定向目标不存在时，应该返回源模型自身的配置（降级处理）
            return JSON.stringify(result) === JSON.stringify(config);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('清除重定向后应该返回模型自身的配置', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          modelIdArbitrary.filter(id => id.length >= 3),
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          (sourceId, targetId, sourceConfig, targetConfig) => {
            if (sourceId === targetId) {
              return true;
            }

            // 先创建有重定向的模型
            const modelsWithRedirect: ModelConfig[] = [
              {
                id: sourceId,
                name: 'Source Model',
                description: 'Source',
                redirectTo: targetId,
                advancedConfig: sourceConfig,
              },
              {
                id: targetId,
                name: 'Target Model',
                description: 'Target',
                advancedConfig: targetConfig,
              },
            ];

            // 然后创建清除重定向后的模型（redirectTo 为 undefined）
            const modelsWithoutRedirect: ModelConfig[] = [
              {
                id: sourceId,
                name: 'Source Model',
                description: 'Source',
                redirectTo: undefined,
                advancedConfig: sourceConfig,
              },
              {
                id: targetId,
                name: 'Target Model',
                description: 'Target',
                advancedConfig: targetConfig,
              },
            ];

            const resultWithRedirect = getEffectiveConfig(sourceId, modelsWithRedirect);
            const resultWithoutRedirect = getEffectiveConfig(sourceId, modelsWithoutRedirect);
            
            // 有重定向时返回目标配置，清除后返回自身配置
            return JSON.stringify(resultWithRedirect) === JSON.stringify(targetConfig) &&
                   JSON.stringify(resultWithoutRedirect) === JSON.stringify(sourceConfig);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空模型列表应该返回空配置', () => {
      fc.assert(
        fc.property(modelIdArbitrary, (modelId) => {
          const result = getEffectiveConfig(modelId, []);
          return Object.keys(result).length === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('模型不存在时应该返回空配置', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          modelIdArbitrary.filter(id => id.length >= 3),
          advancedConfigArbitrary,
          (queryId, existingId, config) => {
            if (queryId === existingId) {
              return true;
            }

            const models: ModelConfig[] = [
              {
                id: existingId,
                name: 'Existing Model',
                description: 'Exists',
                advancedConfig: config,
              },
            ];

            const result = getEffectiveConfig(queryId, models);
            return Object.keys(result).length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('重定向链路径应该正确记录', () => {
      fc.assert(
        fc.property(
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          advancedConfigArbitrary,
          () => {
            // 创建重定向链: A -> B -> C
            const models: ModelConfig[] = [
              {
                id: 'model-a',
                name: 'Model A',
                description: 'A',
                redirectTo: 'model-b',
              },
              {
                id: 'model-b',
                name: 'Model B',
                description: 'B',
                redirectTo: 'model-c',
              },
              {
                id: 'model-c',
                name: 'Model C',
                description: 'C',
              },
            ];

            const result = resolveRedirectChain('model-a', models);
            
            // 链路径应该包含所有经过的模型
            return result.redirectChain.length === 3 &&
                   result.redirectChain[0] === 'model-a' &&
                   result.redirectChain[1] === 'model-b' &&
                   result.redirectChain[2] === 'model-c' &&
                   result.hasCircularRedirect === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('相同输入应该始终返回相同结果（确定性）', () => {
      fc.assert(
        fc.property(
          modelIdArbitrary,
          fc.array(
            fc.record({
              id: modelIdArbitrary,
              name: fc.string({ minLength: 1, maxLength: 20 }),
              description: fc.string({ maxLength: 30 }),
              redirectTo: fc.option(modelIdArbitrary, { nil: undefined }),
              advancedConfig: fc.option(advancedConfigArbitrary, { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (queryId, models) => {
            const result1 = getEffectiveConfig(queryId, models);
            const result2 = getEffectiveConfig(queryId, models);
            const result3 = getEffectiveConfig(queryId, models);
            
            return JSON.stringify(result1) === JSON.stringify(result2) &&
                   JSON.stringify(result2) === JSON.stringify(result3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 模型过滤属性测试 ============

describe('模型过滤属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 2: 模型过滤一致性**
   * *对于任意* 模型列表，过滤后的可用模型列表应只包含 `enabled !== false` 的模型。
   * **Validates: Requirements 4.2**
   */
  describe('Property 2: 模型过滤一致性', () => {

    // 生成具有唯一 ID 的模型配置
    const uniqueModelConfigArbitrary = (index: number): fc.Arbitrary<ModelConfig> => fc.record({
      id: fc.constant(`model-${index}`),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ maxLength: 100 }),
      enabled: fc.option(fc.boolean(), { nil: undefined }),
    });

    // 生成具有唯一 ID 的模型列表
    const modelListArbitrary = fc.integer({ min: 0, max: 20 }).chain(length =>
      length === 0 
        ? fc.constant([]) 
        : fc.tuple(...Array.from({ length }, (_, i) => uniqueModelConfigArbitrary(i)))
    );

    it('过滤后的列表应只包含 enabled !== false 的模型', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered = getEnabledModels(models);
          
          // 验证所有过滤后的模型都满足 enabled !== false
          return filtered.every((model: ModelConfig) => model.enabled !== false);
        }),
        { numRuns: 100 }
      );
    });

    it('enabled 为 true 的模型应该被保留', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered = getEnabledModels(models);
          const filteredIds = new Set(filtered.map((m: ModelConfig) => m.id));
          
          // 所有 enabled 为 true 的模型都应该在结果中
          for (const model of models) {
            if (model.enabled === true && !filteredIds.has(model.id)) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('enabled 为 undefined 的模型应该被保留', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered = getEnabledModels(models);
          const filteredIds = new Set(filtered.map((m: ModelConfig) => m.id));
          
          // 所有 enabled 为 undefined 的模型都应该在结果中
          for (const model of models) {
            if (model.enabled === undefined && !filteredIds.has(model.id)) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('enabled 为 false 的模型应该被过滤掉', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered = getEnabledModels(models);
          const filteredIds = new Set(filtered.map((m: ModelConfig) => m.id));
          
          // 所有 enabled 为 false 的模型都不应该在结果中
          for (const model of models) {
            if (model.enabled === false && filteredIds.has(model.id)) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('过滤后的列表长度应该等于 enabled !== false 的模型数量', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered = getEnabledModels(models);
          const expectedCount = models.filter(m => m.enabled !== false).length;
          
          return filtered.length === expectedCount;
        }),
        { numRuns: 100 }
      );
    });

    it('空列表过滤后应该返回空列表', () => {
      const filtered = getEnabledModels([]);
      return filtered.length === 0;
    });

    it('过滤操作应该是确定性的', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const filtered1 = getEnabledModels(models);
          const filtered2 = getEnabledModels(models);
          
          if (filtered1.length !== filtered2.length) {
            return false;
          }
          
          for (let i = 0; i < filtered1.length; i++) {
            if (filtered1[i].id !== filtered2[i].id) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 模型排序属性测试 ============

describe('模型排序属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 4: 模型列表排序**
   * *对于任意* 模型列表，排序后启用的模型应全部位于禁用模型之前。
   * **Validates: Requirements 4.6**
   */
  describe('Property 4: 模型列表排序', () => {
    // 生成模型配置
    const modelConfigArbitrary: fc.Arbitrary<ModelConfig> = fc.record({
      id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 3, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ maxLength: 100 }),
      enabled: fc.option(fc.boolean(), { nil: undefined }),
    });

    // 生成模型列表
    const modelListArbitrary = fc.array(modelConfigArbitrary, { minLength: 0, maxLength: 20 });

    it('排序后启用的模型应全部位于禁用模型之前', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          
          // 找到第一个禁用模型的索引
          let firstDisabledIndex = -1;
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].enabled === false) {
              firstDisabledIndex = i;
              break;
            }
          }
          
          // 如果没有禁用模型，测试通过
          if (firstDisabledIndex === -1) {
            return true;
          }
          
          // 验证第一个禁用模型之后的所有模型都是禁用的
          for (let i = firstDisabledIndex; i < sorted.length; i++) {
            if (sorted[i].enabled !== false) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('排序后所有启用的模型（enabled !== false）应该在前面', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          
          // 找到最后一个启用模型的索引
          let lastEnabledIndex = -1;
          for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i].enabled !== false) {
              lastEnabledIndex = i;
              break;
            }
          }
          
          // 如果没有启用模型，测试通过
          if (lastEnabledIndex === -1) {
            return true;
          }
          
          // 验证最后一个启用模型之前的所有模型都是启用的
          for (let i = 0; i <= lastEnabledIndex; i++) {
            if (sorted[i].enabled === false) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('排序后的列表长度应该与原列表相同', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          return sorted.length === models.length;
        }),
        { numRuns: 100 }
      );
    });

    it('排序后的列表应该包含原列表的所有模型', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          const originalIds = new Set(models.map(m => m.id));
          const sortedIds = new Set(sorted.map(m => m.id));
          
          // 验证 ID 集合相等
          if (originalIds.size !== sortedIds.size) {
            return false;
          }
          
          for (const id of originalIds) {
            if (!sortedIds.has(id)) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('排序不应该修改原列表', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const originalCopy = JSON.stringify(models);
          sortModels(models);
          const afterSort = JSON.stringify(models);
          
          return originalCopy === afterSort;
        }),
        { numRuns: 100 }
      );
    });

    it('空列表排序后应该返回空列表', () => {
      const sorted = sortModels([]);
      return sorted.length === 0;
    });

    it('排序操作应该是确定性的', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted1 = sortModels(models);
          const sorted2 = sortModels(models);
          
          if (sorted1.length !== sorted2.length) {
            return false;
          }
          
          for (let i = 0; i < sorted1.length; i++) {
            if (sorted1[i].id !== sorted2[i].id) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('启用模型数量应该与排序前相同', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          const originalEnabledCount = models.filter(m => m.enabled !== false).length;
          const sortedEnabledCount = sorted.filter(m => m.enabled !== false).length;
          
          return originalEnabledCount === sortedEnabledCount;
        }),
        { numRuns: 100 }
      );
    });

    it('禁用模型数量应该与排序前相同', () => {
      fc.assert(
        fc.property(modelListArbitrary, (models) => {
          const sorted = sortModels(models);
          const originalDisabledCount = models.filter(m => m.enabled === false).length;
          const sortedDisabledCount = sorted.filter(m => m.enabled === false).length;
          
          return originalDisabledCount === sortedDisabledCount;
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============ 新模型默认禁用属性测试 ============

describe('新模型默认禁用属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 3: 新模型默认禁用**
   * *对于任意* 新获取的模型，其 `enabled` 属性应默认为 `false`。
   * **Validates: Requirements 4.4**
   */
  describe('Property 3: 新模型默认禁用', () => {
    // 生成模型配置
    const modelConfigArbitrary: fc.Arbitrary<ModelConfig> = fc.record({
      id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 3, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ maxLength: 100 }),
    });

    // 生成模型列表
    const modelListArbitrary = fc.array(modelConfigArbitrary, { minLength: 0, maxLength: 10 });

    // 生成模型 ID 集合
    const modelIdSetArbitrary = fc.array(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 3, maxLength: 20 }),
      { minLength: 0, maxLength: 10 }
    ).map(ids => new Set(ids));

    it('新模型（不在现有列表中）应该被设置为 enabled: false', () => {
      fc.assert(
        fc.property(modelListArbitrary, (remoteModels) => {
          // 使用空集合，所有模型都是新的
          const existingIds = new Set<string>();
          const result = setNewModelsDisabled(remoteModels, existingIds);
          
          // 所有模型都应该被设置为 enabled: false
          return result.every(model => model.enabled === false);
        }),
        { numRuns: 100 }
      );
    });

    it('已存在的模型应该保持 enabled 为 undefined', () => {
      fc.assert(
        fc.property(modelListArbitrary, (remoteModels) => {
          // 所有远程模型都在现有列表中
          const existingIds = new Set(remoteModels.map(m => m.id));
          const result = setNewModelsDisabled(remoteModels, existingIds);
          
          // 所有模型都应该保持 enabled: undefined
          return result.every(model => model.enabled === undefined);
        }),
        { numRuns: 100 }
      );
    });

    it('混合情况：新模型禁用，已存在模型保持 undefined', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelIdSetArbitrary, (remoteModels, existingIds) => {
          const result = setNewModelsDisabled(remoteModels, existingIds);
          
          for (let i = 0; i < remoteModels.length; i++) {
            const originalModel = remoteModels[i];
            const resultModel = result[i];
            
            if (existingIds.has(originalModel.id)) {
              // 已存在的模型应该保持 enabled: undefined
              if (resultModel.enabled !== undefined) {
                return false;
              }
            } else {
              // 新模型应该被设置为 enabled: false
              if (resultModel.enabled !== false) {
                return false;
              }
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('处理后的列表长度应该与原列表相同', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelIdSetArbitrary, (remoteModels, existingIds) => {
          const result = setNewModelsDisabled(remoteModels, existingIds);
          return result.length === remoteModels.length;
        }),
        { numRuns: 100 }
      );
    });

    it('处理后的模型应该保留原有的其他属性', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelIdSetArbitrary, (remoteModels, existingIds) => {
          const result = setNewModelsDisabled(remoteModels, existingIds);
          
          for (let i = 0; i < remoteModels.length; i++) {
            const original = remoteModels[i];
            const processed = result[i];
            
            // 验证其他属性保持不变
            if (processed.id !== original.id ||
                processed.name !== original.name ||
                processed.description !== original.description) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('空列表处理后应该返回空列表', () => {
      const result = setNewModelsDisabled([], new Set());
      return result.length === 0;
    });

    it('处理操作应该是确定性的', () => {
      fc.assert(
        fc.property(modelListArbitrary, modelIdSetArbitrary, (remoteModels, existingIds) => {
          const result1 = setNewModelsDisabled(remoteModels, existingIds);
          const result2 = setNewModelsDisabled(remoteModels, existingIds);
          
          if (result1.length !== result2.length) {
            return false;
          }
          
          for (let i = 0; i < result1.length; i++) {
            if (result1[i].id !== result2[i].id ||
                result1[i].enabled !== result2[i].enabled) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
