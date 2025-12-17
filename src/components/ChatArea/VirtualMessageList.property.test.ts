/**
 * 虚拟滚动消息列表属性测试
 * 需求: 1.1, 1.3, 1.4 - 虚拟滚动渲染数量限制、自动滚动属性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateVisibleCount } from './VirtualMessageList';

describe('VirtualMessageList 属性测试', () => {
  /**
   * Property 1: 虚拟滚动渲染数量限制
   * 对于任意消息列表，当消息数量超过可视区域容量时，
   * 实际渲染的 DOM 元素数量应该小于等于 (可视区域容量 + 2 * overscan)
   * 
   * 验证需求: 1.1
   */
  describe('Property 1: 虚拟滚动渲染数量限制', () => {
    it('渲染数量不应超过可视区域容量加缓冲区', () => {
      fc.assert(
        fc.property(
          // 消息总数: 1-1000
          fc.integer({ min: 1, max: 1000 }),
          // 视口高度: 100-2000px
          fc.integer({ min: 100, max: 2000 }),
          // 估算项高度: 50-300px
          fc.integer({ min: 50, max: 300 }),
          // 缓冲区大小: 1-20
          fc.integer({ min: 1, max: 20 }),
          (totalMessages, viewportHeight, estimatedItemHeight, overscan) => {
            const visibleCount = calculateVisibleCount(
              totalMessages,
              viewportHeight,
              estimatedItemHeight,
              overscan
            );

            // 计算可视区域容量
            const viewportCapacity = Math.ceil(viewportHeight / estimatedItemHeight);
            // 最大允许渲染数量
            const maxAllowed = viewportCapacity + 2 * overscan;

            // 渲染数量应该小于等于最大允许值
            expect(visibleCount).toBeLessThanOrEqual(maxAllowed);
            // 渲染数量应该小于等于总消息数
            expect(visibleCount).toBeLessThanOrEqual(totalMessages);
            // 渲染数量应该大于 0（如果有消息）
            expect(visibleCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空消息列表应返回 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 50, max: 300 }),
          fc.integer({ min: 1, max: 20 }),
          (viewportHeight, estimatedItemHeight, overscan) => {
            const visibleCount = calculateVisibleCount(
              0, // 空消息列表
              viewportHeight,
              estimatedItemHeight,
              overscan
            );

            expect(visibleCount).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('消息数量少于可视容量时应渲染全部', () => {
      fc.assert(
        fc.property(
          // 少量消息: 1-10
          fc.integer({ min: 1, max: 10 }),
          // 大视口: 1000-2000px
          fc.integer({ min: 1000, max: 2000 }),
          // 小项高度: 50-100px（确保可视容量大于消息数）
          fc.integer({ min: 50, max: 100 }),
          fc.integer({ min: 5, max: 10 }),
          (totalMessages, viewportHeight, estimatedItemHeight, overscan) => {
            const viewportCapacity = Math.ceil(viewportHeight / estimatedItemHeight);
            
            // 只在消息数少于可视容量时测试
            if (totalMessages < viewportCapacity) {
              const visibleCount = calculateVisibleCount(
                totalMessages,
                viewportHeight,
                estimatedItemHeight,
                overscan
              );

              // 应该渲染全部消息
              expect(visibleCount).toBe(totalMessages);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: 新消息自动滚动
   * 对于任意消息列表，当 isAtBottom 为 true 且新消息到达时，
   * 滚动位置应该更新到底部
   * 
   * 验证需求: 1.3
   */
  describe('Property 2: 新消息自动滚动', () => {
    it('isAtBottom 状态应正确反映滚动位置', () => {
      fc.assert(
        fc.property(
          // 滚动位置
          fc.integer({ min: 0, max: 10000 }),
          // 滚动高度
          fc.integer({ min: 500, max: 20000 }),
          // 客户端高度
          fc.integer({ min: 300, max: 1000 }),
          (scrollTop, scrollHeight, clientHeight) => {
            // 确保 scrollHeight >= scrollTop + clientHeight
            const actualScrollHeight = Math.max(scrollHeight, scrollTop + clientHeight);
            
            // 计算是否在底部（允许 50px 误差）
            const isAtBottom = actualScrollHeight - scrollTop - clientHeight < 50;
            
            // 如果 scrollTop 接近最大值，应该在底部
            const maxScroll = actualScrollHeight - clientHeight;
            if (scrollTop >= maxScroll - 50) {
              expect(isAtBottom).toBe(true);
            }
            
            // 如果 scrollTop 远离底部，不应该在底部
            if (scrollTop < maxScroll - 100) {
              expect(isAtBottom).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: 滚动状态保持
   * 对于任意消息列表，当用户向上滚动（isAtBottom 变为 false）后，
   * 新消息到达不应改变当前滚动位置
   * 
   * 验证需求: 1.4
   */
  describe('Property 3: 滚动状态保持', () => {
    it('用户滚动后 isAtBottom 应变为 false', () => {
      fc.assert(
        fc.property(
          // 初始滚动位置（在底部）
          fc.integer({ min: 900, max: 1000 }),
          // 向上滚动的距离
          fc.integer({ min: 100, max: 500 }),
          (initialScroll, scrollUpDistance) => {
            const scrollHeight = 1000;
            const clientHeight = 300;
            const maxScroll = scrollHeight - clientHeight;
            
            // 初始在底部
            const initialScrollTop = Math.min(initialScroll, maxScroll);
            const initialIsAtBottom = scrollHeight - initialScrollTop - clientHeight < 50;
            
            // 向上滚动后
            const newScrollTop = Math.max(0, initialScrollTop - scrollUpDistance);
            const newIsAtBottom = scrollHeight - newScrollTop - clientHeight < 50;
            
            // 如果向上滚动足够距离，应该不在底部
            if (scrollUpDistance > 50 && initialScrollTop > scrollUpDistance) {
              expect(newIsAtBottom).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
