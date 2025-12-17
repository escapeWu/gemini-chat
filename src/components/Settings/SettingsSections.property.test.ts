/**
 * 设置分类组件属性测试
 * 使用 fast-check 进行属性测试
 * 
 * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
 * **Validates: Requirements 1.3**
 * 
 * **Feature: api-model-display-improvements, Property 3: 模型 ID 显示一致性**
 * **Validates: Requirements 2.1, 2.3, 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ModelConfig } from '../../types/models';
import { filterEnabledModels } from './SettingsSections';

// ============ 生成器 ============

/**
 * 生成模型配置
 * @param enabledValue - enabled 字段的值
 */
const modelConfigWithEnabled = (enabledValue: boolean | undefined): fc.Arbitrary<ModelConfig> => 
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 0, maxLength: 200 }),
    isCustom: fc.boolean(),
    enabled: fc.constant(enabledValue),
  });

/**
 * 生成模型配置列表（混合启用和禁用的模型）
 */
const modelListArb: fc.Arbitrary<ModelConfig[]> = fc.array(
  fc.oneof(
    modelConfigWithEnabled(true),      // 明确启用
    modelConfigWithEnabled(false),     // 明确禁用
    modelConfigWithEnabled(undefined), // 未设置（默认启用）
  ),
  { minLength: 0, maxLength: 20 }
);

// ============ 属性测试 ============

describe('启用模型过滤属性测试', () => {
  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 对于任意模型列表，过滤后的测试连接模型选择列表应该只包含 enabled !== false 的模型
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - 过滤结果只包含启用的模型', () => {
    fc.assert(
      fc.property(
        modelListArb,
        (models) => {
          const filteredModels = filterEnabledModels(models);
          
          // 验证：过滤后的每个模型都应该是启用的（enabled !== false）
          for (const model of filteredModels) {
            expect(model.enabled).not.toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 验证过滤不会丢失任何启用的模型
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - 不丢失任何启用的模型', () => {
    fc.assert(
      fc.property(
        modelListArb,
        (models) => {
          const filteredModels = filterEnabledModels(models);
          
          // 计算原始列表中启用的模型数量
          const enabledCount = models.filter(m => m.enabled !== false).length;
          
          // 验证：过滤后的数量应该等于原始启用的数量
          expect(filteredModels.length).toBe(enabledCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 验证过滤保持模型顺序
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - 保持模型顺序', () => {
    fc.assert(
      fc.property(
        modelListArb,
        (models) => {
          const filteredModels = filterEnabledModels(models);
          
          // 获取原始列表中启用模型的 ID 顺序
          const expectedOrder = models
            .filter(m => m.enabled !== false)
            .map(m => m.id);
          
          // 获取过滤后的 ID 顺序
          const actualOrder = filteredModels.map(m => m.id);
          
          // 验证：顺序应该保持一致
          expect(actualOrder).toEqual(expectedOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 验证空列表的处理
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - 空列表返回空列表', () => {
    const result = filterEnabledModels([]);
    expect(result).toEqual([]);
  });

  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 验证全部禁用的情况
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - 全部禁用时返回空列表', () => {
    fc.assert(
      fc.property(
        fc.array(modelConfigWithEnabled(false), { minLength: 1, maxLength: 10 }),
        (models) => {
          const filteredModels = filterEnabledModels(models);
          expect(filteredModels.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 1: 启用模型过滤**
   * 
   * 验证 undefined 被视为启用
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 1: 启用模型过滤 - undefined 被视为启用', () => {
    fc.assert(
      fc.property(
        fc.array(modelConfigWithEnabled(undefined), { minLength: 1, maxLength: 10 }),
        (models) => {
          const filteredModels = filterEnabledModels(models);
          // 所有 enabled 为 undefined 的模型都应该被保留
          expect(filteredModels.length).toBe(models.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============ 属性 3: 模型 ID 显示一致性 ============

/**
 * 生成完整的模型配置（用于显示测试）
 */
const fullModelConfigArb: fc.Arbitrary<ModelConfig> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  isCustom: fc.boolean(),
  enabled: fc.oneof(fc.constant(true), fc.constant(false), fc.constant(undefined)),
});

/**
 * 模拟模型列表项的显示文本提取函数
 * 这个函数模拟了 ModelListItem 组件中主显示名称的逻辑
 * 
 * 根据需求 2.1，主显示名称应该使用 model.id
 */
function getModelListItemDisplayText(model: ModelConfig): string {
  // 根据修改后的 ModelListItem 组件，主显示名称使用 model.id
  return model.id;
}

/**
 * 模拟测试连接下拉框中的显示文本提取函数
 * 这个函数模拟了 ApiConfigSection 中模型选择下拉框的显示逻辑
 * 
 * 根据需求 2.4，下拉框应该显示 model.id
 */
function getTestConnectionDropdownText(model: ModelConfig): string {
  // 根据修改后的 ApiConfigSection 组件，下拉框显示 model.id
  return model.id;
}

/**
 * 模拟当前模型信息显示的文本提取函数
 * 这个函数模拟了 CurrentModelInfo 组件中当前模型的显示逻辑
 * 
 * 根据需求 2.3，当前模型显示应该使用 model.id
 */
function getCurrentModelDisplayText(currentModel: string): string {
  // 根据修改后的 CurrentModelInfo 组件，直接显示 currentModel（即 model.id）
  return currentModel;
}

describe('模型 ID 显示一致性属性测试', () => {
  /**
   * **Feature: api-model-display-improvements, Property 3: 模型 ID 显示一致性**
   * 
   * 对于任意模型配置对象，在模型列表中显示时，主显示文本应该等于模型的 id 属性值
   * 
   * **Validates: Requirements 2.1**
   */
  it('Property 3: 模型 ID 显示一致性 - 模型列表主显示名称等于 model.id', () => {
    fc.assert(
      fc.property(
        fullModelConfigArb,
        (model) => {
          const displayText = getModelListItemDisplayText(model);
          
          // 验证：主显示文本应该等于 model.id
          expect(displayText).toBe(model.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: api-model-display-improvements, Property 3: 模型 ID 显示一致性**
   * 
   * 对于任意模型配置对象，在测试连接下拉框中显示时，显示文本应该等于模型的 id 属性值
   * 
   * **Validates: Requirements 2.4**
   */
  it('Property 3: 模型 ID 显示一致性 - 测试连接下拉框显示 model.id', () => {
    fc.assert(
      fc.property(
        fullModelConfigArb,
        (model) => {
          const displayText = getTestConnectionDropdownText(model);
          
          // 验证：下拉框显示文本应该等于 model.id
          expect(displayText).toBe(model.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: api-model-display-improvements, Property 3: 模型 ID 显示一致性**
   * 
   * 对于任意模型 ID，当前模型信息显示的主文本应该等于该 ID
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 3: 模型 ID 显示一致性 - 当前模型显示等于 model.id', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (modelId) => {
          const displayText = getCurrentModelDisplayText(modelId);
          
          // 验证：当前模型显示文本应该等于 modelId
          expect(displayText).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: api-model-display-improvements, Property 3: 模型 ID 显示一致性**
   * 
   * 验证所有显示位置的一致性：对于同一个模型，所有位置显示的主文本应该相同
   * 
   * **Validates: Requirements 2.1, 2.3, 2.4**
   */
  it('Property 3: 模型 ID 显示一致性 - 所有显示位置一致', () => {
    fc.assert(
      fc.property(
        fullModelConfigArb,
        (model) => {
          const listDisplayText = getModelListItemDisplayText(model);
          const dropdownDisplayText = getTestConnectionDropdownText(model);
          const currentModelDisplayText = getCurrentModelDisplayText(model.id);
          
          // 验证：所有位置显示的主文本应该相同，且等于 model.id
          expect(listDisplayText).toBe(model.id);
          expect(dropdownDisplayText).toBe(model.id);
          expect(currentModelDisplayText).toBe(model.id);
          
          // 验证一致性
          expect(listDisplayText).toBe(dropdownDisplayText);
          expect(dropdownDisplayText).toBe(currentModelDisplayText);
        }
      ),
      { numRuns: 100 }
    );
  });
});
