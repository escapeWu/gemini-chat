/**
 * 请求取消功能属性测试
 * **Feature: comprehensive-enhancements**
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  GeminiRequestCancelledError,
  GeminiRequestCancelledWithThoughtsError,
} from './gemini';

// ============ 生成器定义 ============

/**
 * 生成有效的部分响应文本
 */
const partialResponseArb = fc.string({ minLength: 0, maxLength: 1000 });

/**
 * 生成有效的部分思维链文本
 */
const partialThoughtArb = fc.string({ minLength: 0, maxLength: 500 });

/**
 * 生成有效的图片数据
 */
const imageDataArb = fc.record({
  mimeType: fc.constantFrom('image/png', 'image/jpeg', 'image/gif', 'image/webp'),
  data: fc.base64String({ minLength: 10, maxLength: 100 }),
});

/**
 * 生成图片数组
 */
const imagesArb = fc.array(imageDataArb, { minLength: 0, maxLength: 5 });

// ============ 测试套件 ============

describe('请求取消属性测试', () => {
  /**
   * **Feature: comprehensive-enhancements, Property 9: 请求取消信号传递**
   * *对于任意* 取消操作，AbortController.abort() 应该被调用，且 signal.aborted 应该为 true
   * **Validates: Requirements 5.2**
   */
  describe('Property 9: 请求取消信号传递', () => {
    it('AbortController.abort() 调用后 signal.aborted 应为 true', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1000 }), // 随机延迟时间
          (_delay) => {
            // 创建 AbortController
            const controller = new AbortController();
            const signal = controller.signal;
            
            // 初始状态应为 false
            expect(signal.aborted).toBe(false);
            
            // 调用 abort()
            controller.abort();
            
            // 调用后应为 true
            expect(signal.aborted).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('abort() 调用后 signal 应触发 abort 事件', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }), // 随机取消原因
          (reason) => {
            const controller = new AbortController();
            const signal = controller.signal;
            
            let eventFired = false;
            signal.addEventListener('abort', () => {
              eventFired = true;
            });
            
            // 调用 abort()
            controller.abort(reason);
            
            // 事件应被触发
            expect(eventFired).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('GeminiRequestCancelledError 应正确保存部分响应', () => {
      fc.assert(
        fc.property(
          partialResponseArb,
          (partialResponse) => {
            const error = new GeminiRequestCancelledError('请求已取消', partialResponse);
            
            // 验证错误属性
            expect(error.name).toBe('GeminiRequestCancelledError');
            expect(error.message).toBe('请求已取消');
            expect(error.partialResponse).toBe(partialResponse);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: comprehensive-enhancements, Property 10: 部分响应保留**
   * *对于任意* 被取消的流式响应，已接收的文本内容应该被保存到消息中
   * **Validates: Requirements 5.3, 5.4**
   */
  describe('Property 10: 部分响应保留', () => {
    it('GeminiRequestCancelledWithThoughtsError 应保留所有部分数据', () => {
      fc.assert(
        fc.property(
          partialResponseArb,
          partialThoughtArb,
          imagesArb,
          (partialResponse, partialThought, partialImages) => {
            const error = new GeminiRequestCancelledWithThoughtsError(
              '请求已取消',
              partialResponse,
              partialThought,
              partialImages
            );
            
            // 验证错误属性
            expect(error.name).toBe('GeminiRequestCancelledWithThoughtsError');
            expect(error.message).toBe('请求已取消');
            expect(error.partialResponse).toBe(partialResponse);
            expect(error.partialThought).toBe(partialThought);
            expect(error.partialImages).toEqual(partialImages);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('部分响应长度应保持不变', () => {
      fc.assert(
        fc.property(
          partialResponseArb,
          (partialResponse) => {
            const error = new GeminiRequestCancelledError('请求已取消', partialResponse);
            
            // 部分响应长度应与输入一致
            expect(error.partialResponse.length).toBe(partialResponse.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空部分响应应正确处理', () => {
      fc.assert(
        fc.property(
          fc.constant(''), // 空字符串
          (emptyResponse) => {
            const error = new GeminiRequestCancelledError('请求已取消', emptyResponse);
            
            // 空响应应正确保存
            expect(error.partialResponse).toBe('');
            expect(error.partialResponse.length).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('默认值应正确初始化', () => {
      // 测试不传递部分响应参数的情况
      const error1 = new GeminiRequestCancelledError('请求已取消');
      expect(error1.partialResponse).toBe('');
      
      const error2 = new GeminiRequestCancelledWithThoughtsError('请求已取消');
      expect(error2.partialResponse).toBe('');
      expect(error2.partialThought).toBe('');
      expect(error2.partialImages).toEqual([]);
    });
  });
});
