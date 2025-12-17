/**
 * 图片库工具函数属性测试
 * **Feature: ui-fixes-gallery**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatImageDate,
  getDateKey,
  sortImagesByDate,
  groupImagesByDate,
} from './galleryUtils';
import type { GeneratedImage } from '../types';

// ============ 生成器定义 ============

/**
 * 生成有效的时间戳（过去一年内）
 */
const timestampArb = fc.integer({
  min: Date.now() - 365 * 24 * 60 * 60 * 1000, // 一年前
  max: Date.now(),
});

/**
 * 生成有效的 MIME 类型
 */
const mimeTypeArb = fc.constantFrom(
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
);

/**
 * 生成有效的 GeneratedImage
 */
const generatedImageArb: fc.Arbitrary<GeneratedImage> = fc.record({
  id: fc.uuid(),
  data: fc.base64String({ minLength: 10, maxLength: 100 }),
  mimeType: mimeTypeArb,
  createdAt: timestampArb,
  windowId: fc.option(fc.uuid(), { nil: undefined }),
  messageId: fc.option(fc.uuid(), { nil: undefined }),
  prompt: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
});

/**
 * 生成唯一 ID 的图片列表
 */
const uniqueImagesArb = fc
  .array(generatedImageArb, { minLength: 0, maxLength: 20 })
  .map((images) => {
    const uniqueIds = new Set<string>();
    return images.filter((img) => {
      if (uniqueIds.has(img.id)) return false;
      uniqueIds.add(img.id);
      return true;
    });
  });

// ============ 日期格式化属性测试 ============

describe('日期格式化属性测试', () => {
  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 时间戳，格式化函数应返回易读的日期格式（"今天"、"昨天"或具体日期）
   * **Validates: Requirements 4.2**
   */
  it('Property 5.1: 格式化函数应返回非空字符串', () => {
    fc.assert(
      fc.property(timestampArb, (timestamp) => {
        const result = formatImageDate(timestamp);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 今天的时间戳，格式化函数应返回"今天"
   * **Validates: Requirements 4.2**
   */
  it('Property 5.2: 今天的时间戳应返回"今天"', () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    fc.assert(
      fc.property(
        fc.integer({ min: todayStart, max: Math.min(todayEnd, Date.now()) }),
        (timestamp) => {
          const result = formatImageDate(timestamp);
          expect(result).toBe('今天');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 昨天的时间戳，格式化函数应返回"昨天"
   * **Validates: Requirements 4.2**
   */
  it('Property 5.3: 昨天的时间戳应返回"昨天"', () => {
    const now = new Date();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const yesterdayEnd = yesterdayStart + 24 * 60 * 60 * 1000 - 1;

    fc.assert(
      fc.property(
        fc.integer({ min: yesterdayStart, max: yesterdayEnd }),
        (timestamp) => {
          const result = formatImageDate(timestamp);
          expect(result).toBe('昨天');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 更早的时间戳，格式化函数应返回包含"月"和"日"的字符串
   * **Validates: Requirements 4.2**
   */
  it('Property 5.4: 更早的时间戳应返回具体日期格式', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).getTime();
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    fc.assert(
      fc.property(
        fc.integer({ min: oneYearAgo, max: twoDaysAgo }),
        (timestamp) => {
          const result = formatImageDate(timestamp);
          // 应该包含"月"和"日"
          expect(result).toMatch(/月.*日/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 时间戳，getDateKey 应返回 YYYY-MM-DD 格式
   * **Validates: Requirements 4.2**
   */
  it('Property 5.5: getDateKey 应返回 YYYY-MM-DD 格式', () => {
    fc.assert(
      fc.property(timestampArb, (timestamp) => {
        const result = getDateKey(timestamp);
        // 验证格式为 YYYY-MM-DD
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 5: 日期格式化一致性**
   * *对于任意* 同一天的两个时间戳，getDateKey 应返回相同的值
   * **Validates: Requirements 4.2**
   */
  it('Property 5.6: 同一天的时间戳应返回相同的 dateKey', () => {
    fc.assert(
      fc.property(timestampArb, (baseTimestamp) => {
        const date = new Date(baseTimestamp);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

        // 生成同一天内的另一个时间戳
        const otherTimestamp = dayStart + Math.floor(Math.random() * (dayEnd - dayStart));

        const key1 = getDateKey(baseTimestamp);
        const key2 = getDateKey(otherTimestamp);

        expect(key1).toBe(key2);
      }),
      { numRuns: 100 }
    );
  });
});

// ============ 图片排序属性测试 ============

describe('图片排序属性测试', () => {
  /**
   * **Feature: ui-fixes-gallery, Property 6: 图片排序正确性**
   * *对于任意* 图片列表，排序后的列表应按创建时间降序排列（最新在前）
   * **Validates: Requirements 4.3**
   */
  it('Property 6.1: 排序后应按创建时间降序排列', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const sorted = sortImagesByDate(images);

        // 验证降序排列
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          if (prev && curr) {
            expect(prev.createdAt).toBeGreaterThanOrEqual(curr.createdAt);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 6: 图片排序正确性**
   * *对于任意* 图片列表，排序后的列表长度应与原列表相同
   * **Validates: Requirements 4.3**
   */
  it('Property 6.2: 排序后列表长度应保持不变', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const sorted = sortImagesByDate(images);
        expect(sorted.length).toBe(images.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 6: 图片排序正确性**
   * *对于任意* 图片列表，排序后应包含所有原始图片
   * **Validates: Requirements 4.3**
   */
  it('Property 6.3: 排序后应包含所有原始图片', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const sorted = sortImagesByDate(images);
        const sortedIds = new Set(sorted.map((img) => img.id));

        for (const image of images) {
          expect(sortedIds.has(image.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 6: 图片排序正确性**
   * *对于任意* 图片列表，排序不应修改原数组
   * **Validates: Requirements 4.3**
   */
  it('Property 6.4: 排序不应修改原数组', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const originalIds = images.map((img) => img.id);
        sortImagesByDate(images);
        const afterIds = images.map((img) => img.id);

        expect(afterIds).toEqual(originalIds);
      }),
      { numRuns: 100 }
    );
  });
});

// ============ 图片分组属性测试 ============

describe('图片分组属性测试', () => {
  /**
   * **Feature: ui-fixes-gallery, Property 7: 图片分组正确性**
   * *对于任意* 图片列表，分组后同一组内的所有图片应具有相同的日期
   * **Validates: Requirements 4.4**
   */
  it('Property 7.1: 同一组内的图片应具有相同的日期键', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const groups = groupImagesByDate(images);

        for (const group of groups) {
          for (const image of group.images) {
            const imageKey = getDateKey(image.createdAt);
            expect(imageKey).toBe(group.dateKey);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 7: 图片分组正确性**
   * *对于任意* 图片列表，分组后所有图片的总数应与原列表相同
   * **Validates: Requirements 4.4**
   */
  it('Property 7.2: 分组后图片总数应保持不变', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const groups = groupImagesByDate(images);
        const totalImages = groups.reduce((sum, group) => sum + group.images.length, 0);

        expect(totalImages).toBe(images.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 7: 图片分组正确性**
   * *对于任意* 图片列表，分组后应包含所有原始图片
   * **Validates: Requirements 4.4**
   */
  it('Property 7.3: 分组后应包含所有原始图片', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const groups = groupImagesByDate(images);
        const allGroupedIds = new Set(
          groups.flatMap((group) => group.images.map((img) => img.id))
        );

        for (const image of images) {
          expect(allGroupedIds.has(image.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 7: 图片分组正确性**
   * *对于任意* 图片列表，分组后每个组的 date 属性应为非空字符串
   * **Validates: Requirements 4.4**
   */
  it('Property 7.4: 每个组的 date 属性应为非空字符串', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const groups = groupImagesByDate(images);

        for (const group of groups) {
          expect(typeof group.date).toBe('string');
          expect(group.date.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-fixes-gallery, Property 7: 图片分组正确性**
   * *对于任意* 图片列表，分组后组内图片应按时间降序排列
   * **Validates: Requirements 4.4**
   */
  it('Property 7.5: 组内图片应按时间降序排列', () => {
    fc.assert(
      fc.property(uniqueImagesArb, (images) => {
        const groups = groupImagesByDate(images);

        for (const group of groups) {
          for (let i = 1; i < group.images.length; i++) {
            const prev = group.images[i - 1];
            const curr = group.images[i];
            if (prev && curr) {
              expect(prev.createdAt).toBeGreaterThanOrEqual(curr.createdAt);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============ 空状态属性测试 ============

describe('空状态属性测试', () => {
  /**
   * **Feature: ui-fixes-gallery, Property 8: 空状态显示**
   * *对于任意* 空图片列表，分组函数应返回空数组
   * **Validates: Requirements 5.3**
   */
  it('Property 8.1: 空列表分组应返回空数组', () => {
    const groups = groupImagesByDate([]);
    expect(groups).toEqual([]);
  });

  /**
   * **Feature: ui-fixes-gallery, Property 8: 空状态显示**
   * *对于任意* 空图片列表，排序函数应返回空数组
   * **Validates: Requirements 5.3**
   */
  it('Property 8.2: 空列表排序应返回空数组', () => {
    const sorted = sortImagesByDate([]);
    expect(sorted).toEqual([]);
  });
});
