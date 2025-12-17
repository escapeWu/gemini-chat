/**
 * API 端点规范化属性测试
 * **Feature: api-model-display-improvements**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeApiEndpoint } from './gemini';
import { OFFICIAL_API_ENDPOINT } from '../types/models';

// ============ 生成器定义 ============

/**
 * 生成空字符串或仅包含空白字符的字符串
 */
const emptyOrWhitespaceArb = fc.oneof(
  fc.constant(''),
  fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 })
);

/**
 * 生成有效的 URL 基础部分（不含 /v1beta 后缀）
 */
const validUrlWithoutV1betaArb = fc.webUrl().filter(url => {
  // 排除已经以 /v1beta 结尾的 URL
  return !url.endsWith('/v1beta') && !url.endsWith('/v1beta/');
});

/**
 * 生成已包含 /v1beta 后缀的有效 URL
 */
const validUrlWithV1betaArb = fc.webUrl().map(url => {
  // 移除末尾斜杠后添加 /v1beta
  const base = url.replace(/\/+$/, '');
  return `${base}/v1beta`;
});

// ============ 测试套件 ============

describe('API 端点规范化属性测试', () => {
  /**
   * **Feature: api-model-display-improvements, Property 1: 空端点返回官方地址**
   * *对于任意* 空字符串或仅包含空白字符的端点输入，规范化后的端点应等于官方 API 地址
   * **Validates: Requirements 1.1**
   */
  it('Property 1: 空端点返回官方地址', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        (endpoint) => {
          const result = normalizeApiEndpoint(endpoint);
          
          // 规范化后的端点应等于官方 API 地址
          expect(result).toBe(OFFICIAL_API_ENDPOINT);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: api-model-display-improvements, Property 2: 自动添加 v1beta 后缀**
   * *对于任意* 非空且不以 /v1beta 结尾的有效 URL 端点，规范化后的端点应以 /v1beta 结尾
   * **Validates: Requirements 1.3, 1.4**
   */
  it('Property 2: 自动添加 v1beta 后缀', () => {
    fc.assert(
      fc.property(
        validUrlWithoutV1betaArb,
        (endpoint) => {
          const result = normalizeApiEndpoint(endpoint);
          
          // 规范化后的端点应以 /v1beta 结尾
          expect(result.endsWith('/v1beta')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: api-model-display-improvements, Property 2: 自动添加 v1beta 后缀**
   * *对于任意* 已包含 /v1beta 后缀的有效 URL，规范化后不应重复添加后缀
   * **Validates: Requirements 1.4**
   */
  it('Property 2.1: 已有 v1beta 后缀时不重复添加', () => {
    fc.assert(
      fc.property(
        validUrlWithV1betaArb,
        (endpoint) => {
          const result = normalizeApiEndpoint(endpoint);
          
          // 规范化后的端点应以 /v1beta 结尾（只有一个）
          expect(result.endsWith('/v1beta')).toBe(true);
          // 不应包含重复的 /v1beta/v1beta
          expect(result.includes('/v1beta/v1beta')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
