/**
 * Token 使用量解析属性测试
 * 需求: 7.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseTokenUsage,
  isValidTokenUsage,
  accumulateTokenUsage,
  formatTokenCount,
  formatTokenUsage,
} from './tokenUsage';
import type { TokenUsage } from '../stores/debug';

describe('TokenUsage 解析服务', () => {
  /**
   * **Feature: comprehensive-enhancements, Property 13: Token 数据解析**
   * **Validates: Requirements 7.1**
   * 
   * *For any* 包含 usageMetadata 的 API 响应，解析后的 TokenUsage 应该包含
   * promptTokens、completionTokens、totalTokens，且 totalTokens = promptTokens + completionTokens
   */
  describe('Property 13: Token 数据解析', () => {
    it('解析后的 TokenUsage 应满足 totalTokens = promptTokens + completionTokens', () => {
      fc.assert(
        fc.property(
          fc.nat(1000000), // promptTokenCount
          fc.nat(1000000), // candidatesTokenCount
          (promptTokenCount, candidatesTokenCount) => {
            const usageMetadata = {
              promptTokenCount,
              candidatesTokenCount,
              totalTokenCount: promptTokenCount + candidatesTokenCount,
            };

            const result = parseTokenUsage(usageMetadata);

            // 结果不应为 null
            expect(result).not.toBeNull();
            
            if (result) {
              // 验证字段存在
              expect(typeof result.promptTokens).toBe('number');
              expect(typeof result.completionTokens).toBe('number');
              expect(typeof result.totalTokens).toBe('number');
              
              // 验证 totalTokens = promptTokens + completionTokens
              expect(result.totalTokens).toBe(result.promptTokens + result.completionTokens);
              
              // 验证值正确映射
              expect(result.promptTokens).toBe(promptTokenCount);
              expect(result.completionTokens).toBe(candidatesTokenCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于 null 或 undefined 输入应返回 null', () => {
      expect(parseTokenUsage(null)).toBeNull();
      expect(parseTokenUsage(undefined)).toBeNull();
    });

    it('对于空对象应返回默认值', () => {
      const result = parseTokenUsage({});
      expect(result).not.toBeNull();
      if (result) {
        expect(result.promptTokens).toBe(0);
        expect(result.completionTokens).toBe(0);
        expect(result.totalTokens).toBe(0);
      }
    });
  });

  describe('isValidTokenUsage 验证', () => {
    it('有效的 TokenUsage 应通过验证', () => {
      fc.assert(
        fc.property(
          fc.nat(1000000),
          fc.nat(1000000),
          (promptTokens, completionTokens) => {
            const tokenUsage: TokenUsage = {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            };

            expect(isValidTokenUsage(tokenUsage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('totalTokens 不等于 promptTokens + completionTokens 时应返回 false', () => {
      fc.assert(
        fc.property(
          fc.nat(1000000),
          fc.nat(1000000),
          fc.integer({ min: 1, max: 1000 }), // 偏移量
          (promptTokens, completionTokens, offset) => {
            const tokenUsage: TokenUsage = {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens + offset, // 故意不一致
            };

            expect(isValidTokenUsage(tokenUsage)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null 或 undefined 应返回 false', () => {
      expect(isValidTokenUsage(null)).toBe(false);
      expect(isValidTokenUsage(undefined)).toBe(false);
    });
  });

  describe('accumulateTokenUsage 累计计算', () => {
    it('累计多个 TokenUsage 应正确计算总和', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              promptTokens: fc.nat(100000),
              completionTokens: fc.nat(100000),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (usageInputs) => {
            const usages: TokenUsage[] = usageInputs.map(u => ({
              ...u,
              totalTokens: u.promptTokens + u.completionTokens,
            }));

            const result = accumulateTokenUsage(usages);

            // 计算期望的总和
            const expectedPrompt = usages.reduce((sum, u) => sum + u.promptTokens, 0);
            const expectedCompletion = usages.reduce((sum, u) => sum + u.completionTokens, 0);

            expect(result.promptTokens).toBe(expectedPrompt);
            expect(result.completionTokens).toBe(expectedCompletion);
            expect(result.totalTokens).toBe(expectedPrompt + expectedCompletion);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空数组应返回零值', () => {
      const result = accumulateTokenUsage([]);
      expect(result.promptTokens).toBe(0);
      expect(result.completionTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
    });

    it('应忽略 null 和 undefined 值', () => {
      const validUsage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      const result = accumulateTokenUsage([null, validUsage, undefined, validUsage]);

      expect(result.promptTokens).toBe(200);
      expect(result.completionTokens).toBe(100);
      expect(result.totalTokens).toBe(300);
    });
  });

  describe('formatTokenCount 格式化', () => {
    it('小于 1000 的数字应直接显示', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (count) => {
            expect(formatTokenCount(count)).toBe(count.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('1000-999999 的数字应显示为 K 格式', () => {
      expect(formatTokenCount(1000)).toBe('1.0K');
      expect(formatTokenCount(1500)).toBe('1.5K');
      expect(formatTokenCount(999999)).toBe('1000.0K');
    });

    it('大于等于 1000000 的数字应显示为 M 格式', () => {
      expect(formatTokenCount(1000000)).toBe('1.00M');
      expect(formatTokenCount(1500000)).toBe('1.50M');
    });
  });

  describe('formatTokenUsage 格式化', () => {
    it('有效的 TokenUsage 应格式化为可读字符串', () => {
      const tokenUsage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      const result = formatTokenUsage(tokenUsage);
      expect(result).toContain('输入');
      expect(result).toContain('输出');
      expect(result).toContain('总计');
    });

    it('null 或 undefined 应返回 "数据不可用"', () => {
      expect(formatTokenUsage(null)).toBe('数据不可用');
      expect(formatTokenUsage(undefined)).toBe('数据不可用');
    });

    it('无效的 TokenUsage 应返回 "数据不可用"', () => {
      const invalidUsage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 200, // 不等于 100 + 50
      };

      expect(formatTokenUsage(invalidUsage)).toBe('数据不可用');
    });
  });
});
