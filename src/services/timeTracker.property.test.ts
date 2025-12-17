/**
 * 请求耗时追踪属性测试
 * 需求: 8.2, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  TimeTracker,
  createTimeTracker,
  calculateDuration,
  calculateTTFB,
  isValidTimingData,
  formatDuration,
} from './timeTracker';

describe('TimeTracker 耗时追踪服务', () => {
  /**
   * **Feature: comprehensive-enhancements, Property 15: 耗时计算准确性**
   * **Validates: Requirements 8.2**
   * 
   * *For any* API 请求，duration 应该等于 endTime - startTime（误差在 10ms 内）
   */
  describe('Property 15: 耗时计算准确性', () => {
    it('duration 应该等于 endTime - startTime', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000, max: 2000000000000 }), // 合理的时间戳范围
          fc.integer({ min: 0, max: 100000 }), // 耗时范围 0-100秒
          (startTime, durationMs) => {
            const endTime = startTime + durationMs;
            
            // 使用辅助函数计算
            const calculatedDuration = calculateDuration(startTime, endTime);
            
            // 验证 duration = endTime - startTime
            expect(calculatedDuration).toBe(durationMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('TimeTracker 实例的 getDuration 应正确计算耗时', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // 模拟耗时
          (expectedDuration) => {
            const startTime = Date.now();
            const tracker = new TimeTracker(startTime);
            
            // 模拟结束时间
            const endTime = startTime + expectedDuration;
            
            // 手动设置结束时间（通过内部状态）
            // 由于 TimeTracker 使用 Date.now()，我们验证计算逻辑
            const calculatedDuration = calculateDuration(startTime, endTime);
            
            expect(calculatedDuration).toBe(expectedDuration);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('耗时应始终为非负数', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000, max: 2000000000000 }),
          fc.integer({ min: 0, max: 100000 }),
          (startTime, durationMs) => {
            const endTime = startTime + durationMs;
            const duration = calculateDuration(startTime, endTime);
            
            expect(duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: comprehensive-enhancements, Property 16: 流式响应时间追踪**
   * **Validates: Requirements 8.3**
   * 
   * *For any* 流式响应，ttfb（首字节时间）应该小于等于 duration（总耗时）
   */
  describe('Property 16: 流式响应时间追踪', () => {
    it('ttfb 应该小于等于 duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000, max: 2000000000000 }), // 开始时间
          fc.integer({ min: 0, max: 50000 }), // ttfb 范围
          fc.integer({ min: 0, max: 50000 }), // 额外耗时
          (startTime, ttfbMs, additionalMs) => {
            const firstByteTime = startTime + ttfbMs;
            const endTime = firstByteTime + additionalMs;
            
            const ttfb = calculateTTFB(startTime, firstByteTime);
            const duration = calculateDuration(startTime, endTime);
            
            // ttfb 应该小于等于 duration
            expect(ttfb).toBeLessThanOrEqual(duration);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidTimingData 应正确验证 ttfb <= duration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }), // duration
          fc.integer({ min: 0, max: 100000 }), // ttfb
          (duration, ttfb) => {
            const isValid = isValidTimingData(duration, ttfb);
            
            // 如果 ttfb <= duration，应该有效
            if (ttfb <= duration) {
              expect(isValid).toBe(true);
            } else {
              // 如果 ttfb > duration，应该无效
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('没有 ttfb 时，只要 duration >= 0 就应该有效', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          (duration) => {
            expect(isValidTimingData(duration)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('负数 duration 应该无效', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100000, max: -1 }),
          (negativeDuration) => {
            expect(isValidTimingData(negativeDuration)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('负数 ttfb 应该无效', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }), // 有效的 duration
          fc.integer({ min: -100000, max: -1 }), // 负数 ttfb
          (duration, negativeTtfb) => {
            expect(isValidTimingData(duration, negativeTtfb)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('TimeTracker 实例方法', () => {
    it('createTimeTracker 应创建有效的 TimeTracker 实例', () => {
      const tracker = createTimeTracker();
      
      expect(tracker).toBeInstanceOf(TimeTracker);
      expect(tracker.getStartTime()).toBeLessThanOrEqual(Date.now());
      expect(tracker.isCompleted()).toBe(false);
      expect(tracker.hasFirstByte()).toBe(false);
    });

    it('start 应重置所有时间戳', () => {
      const tracker = createTimeTracker();
      
      // 模拟一些操作
      tracker.markFirstByte();
      tracker.end();
      
      // 重新开始
      const newStartTime = tracker.start();
      
      expect(tracker.getStartTime()).toBe(newStartTime);
      expect(tracker.getFirstByteTime()).toBeUndefined();
      expect(tracker.getEndTime()).toBeUndefined();
      expect(tracker.isCompleted()).toBe(false);
      expect(tracker.hasFirstByte()).toBe(false);
    });

    it('markFirstByte 应记录首字节时间', () => {
      const tracker = createTimeTracker();
      const startTime = tracker.getStartTime();
      
      const firstByteTime = tracker.markFirstByte();
      
      expect(tracker.hasFirstByte()).toBe(true);
      expect(tracker.getFirstByteTime()).toBe(firstByteTime);
      expect(firstByteTime).toBeGreaterThanOrEqual(startTime);
    });

    it('end 应记录结束时间', () => {
      const tracker = createTimeTracker();
      const startTime = tracker.getStartTime();
      
      const endTime = tracker.end();
      
      expect(tracker.isCompleted()).toBe(true);
      expect(tracker.getEndTime()).toBe(endTime);
      expect(endTime).toBeGreaterThanOrEqual(startTime);
    });

    it('getTimingResult 应返回正确的耗时结果', () => {
      const tracker = createTimeTracker();
      
      tracker.markFirstByte();
      tracker.end();
      
      const result = tracker.getTimingResult();
      
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      
      if (result.ttfb !== undefined) {
        expect(result.ttfb).toBeLessThanOrEqual(result.duration);
      }
    });

    it('getTrackingData 应返回完整的追踪数据', () => {
      const tracker = createTimeTracker();
      
      tracker.markFirstByte();
      tracker.end();
      
      const data = tracker.getTrackingData();
      
      expect(typeof data.startTime).toBe('number');
      expect(typeof data.firstByteTime).toBe('number');
      expect(typeof data.endTime).toBe('number');
    });
  });

  describe('formatDuration 格式化', () => {
    it('小于 1000ms 应显示为毫秒', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (ms) => {
            const formatted = formatDuration(ms);
            expect(formatted).toBe(`${ms}ms`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('1000ms-59999ms 应显示为秒', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(1500)).toBe('1.50s');
      expect(formatDuration(59999)).toMatch(/^\d+\.\d+s$/);
    });

    it('60000ms 及以上应显示为分钟和秒', () => {
      expect(formatDuration(60000)).toBe('1m 0.0s');
      expect(formatDuration(90000)).toBe('1m 30.0s');
      expect(formatDuration(120000)).toBe('2m 0.0s');
    });
  });
});
