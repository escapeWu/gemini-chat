/**
 * 消息编辑器属性测试
 * 需求: 3.4 - 空消息编辑验证
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateMessageContent } from './MessageEditor';

describe('MessageEditor 属性测试', () => {
  /**
   * Property 6: 空消息编辑验证
   * 对于任意纯空白字符串（空格、制表符、换行符的任意组合），
   * 编辑提交应该被拒绝
   * 
   * 验证需求: 3.4
   */
  describe('Property 6: 空消息编辑验证', () => {
    it('纯空白字符串应被拒绝', () => {
      fc.assert(
        fc.property(
          // 生成纯空白字符串
          fc.stringOf(
            fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
            { minLength: 0, maxLength: 100 }
          ),
          (whitespaceOnly) => {
            const isValid = validateMessageContent(whitespaceOnly);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空字符串应被拒绝', () => {
      expect(validateMessageContent('')).toBe(false);
    });

    it('包含非空白字符的字符串应被接受', () => {
      fc.assert(
        fc.property(
          // 生成至少包含一个非空白字符的字符串
          fc.tuple(
            fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 }),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 })
          ),
          ([prefix, content, suffix]) => {
            const fullContent = prefix + content + suffix;
            const isValid = validateMessageContent(fullContent);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('单个非空白字符应被接受', () => {
      fc.assert(
        fc.property(
          // 生成单个非空白字符
          fc.char().filter(c => c.trim().length > 0),
          (char) => {
            const isValid = validateMessageContent(char);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('前后有空白的有效内容应被接受', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (content) => {
            // 添加前后空白
            const withWhitespace = `  \t\n${content}\n\t  `;
            const isValid = validateMessageContent(withWhitespace);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('边界情况', () => {
    it('只有空格的字符串应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (count) => {
            const spaces = ' '.repeat(count);
            expect(validateMessageContent(spaces)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('只有制表符的字符串应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            const tabs = '\t'.repeat(count);
            expect(validateMessageContent(tabs)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('只有换行符的字符串应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            const newlines = '\n'.repeat(count);
            expect(validateMessageContent(newlines)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('混合空白字符应被拒绝', () => {
      const mixedWhitespace = [
        ' \t\n',
        '\n\t ',
        '   \t\t\t   ',
        '\n\n\n',
        '\r\n\r\n',
        ' \t \n \t ',
      ];

      for (const ws of mixedWhitespace) {
        expect(validateMessageContent(ws)).toBe(false);
      }
    });
  });
});
