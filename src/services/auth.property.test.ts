/**
 * 鉴权服务属性测试
 * **Feature: app-enhancements, Property 5 & 6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { passwordsMatch, hashPassword } from './auth';

// ============ 生成器定义 ============

/**
 * 生成有效的密码字符串
 * 密码可以包含任意可打印字符
 */
const passwordArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * 生成两个不同的密码字符串
 */
const differentPasswordsArb = fc.tuple(passwordArb, passwordArb).filter(
  ([a, b]) => a !== b
);

// ============ 测试套件 ============

describe('密码匹配验证属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 5: 密码匹配验证**
   * *对于任意* 两个密码字符串，当且仅当它们完全相等时，匹配验证应返回 true
   * **Validates: Requirements 5.4**
   */
  it('Property 5.1: 相同密码应返回 true', () => {
    fc.assert(
      fc.property(
        passwordArb,
        (password) => {
          // 相同的密码应该匹配
          const result = passwordsMatch(password, password);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: app-enhancements, Property 5: 密码匹配验证**
   * *对于任意* 两个不同的密码字符串，匹配验证应返回 false
   * **Validates: Requirements 5.4**
   */
  it('Property 5.2: 不同密码应返回 false', () => {
    fc.assert(
      fc.property(
        differentPasswordsArb,
        ([password, confirmPassword]) => {
          // 不同的密码不应该匹配
          const result = passwordsMatch(password, confirmPassword);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('密码哈希一致性属性测试', () => {
  /**
   * **Feature: app-enhancements, Property 6: 密码哈希一致性**
   * *对于任意* 密码字符串，对同一密码进行哈希应产生相同的结果（确定性）
   * **Validates: Requirements 5.5**
   */
  it('Property 6.1: 相同密码哈希结果应相同', async () => {
    await fc.assert(
      fc.asyncProperty(
        passwordArb,
        async (password) => {
          // 对同一密码进行两次哈希
          const hash1 = await hashPassword(password);
          const hash2 = await hashPassword(password);
          
          // 哈希结果应该相同
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: app-enhancements, Property 6: 密码哈希一致性**
   * *对于任意* 两个不同的密码字符串，哈希结果应不同
   * **Validates: Requirements 5.5**
   */
  it('Property 6.2: 不同密码哈希结果应不同', async () => {
    await fc.assert(
      fc.asyncProperty(
        differentPasswordsArb,
        async ([password1, password2]) => {
          // 对两个不同密码进行哈希
          const hash1 = await hashPassword(password1);
          const hash2 = await hashPassword(password2);
          
          // 哈希结果应该不同
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: app-enhancements, Property 6: 密码哈希一致性**
   * *对于任意* 密码字符串，哈希结果应为 64 字符的十六进制字符串（SHA-256）
   * **Validates: Requirements 5.5**
   */
  it('Property 6.3: 哈希结果应为有效的 SHA-256 格式', async () => {
    await fc.assert(
      fc.asyncProperty(
        passwordArb,
        async (password) => {
          const hash = await hashPassword(password);
          
          // SHA-256 哈希应为 64 字符的十六进制字符串
          expect(hash).toHaveLength(64);
          expect(hash).toMatch(/^[0-9a-f]{64}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
