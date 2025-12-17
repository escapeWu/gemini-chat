/**
 * 侧边栏拖拽排序属性测试
 * 使用 fast-check 进行属性测试
 * 
 * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
 * **Validates: Requirements 7.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { reorderList } from './DragDropList';

// ============ 生成器 ============

/**
 * 生成简单的列表项
 */
const itemArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  title: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * 生成非空列表
 */
const nonEmptyListArb = fc.array(itemArb, { minLength: 1, maxLength: 20 });

/**
 * 生成具有唯一 ID 的列表项
 * 用于需要通过 ID 区分元素的测试
 */
const uniqueIdItemArb = (index: number) => fc.record({
  id: fc.constant(`item-${index}`),
  title: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * 生成具有唯一 ID 的非空列表
 */
const uniqueIdListArb = fc.integer({ min: 3, max: 20 }).chain(length =>
  fc.tuple(...Array.from({ length }, (_, i) => uniqueIdItemArb(i)))
);

// ============ 属性测试 ============

describe('侧边栏拖拽排序属性测试', () => {
  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，操作后聊天窗口的顺序应反映拖拽结果
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 拖拽后元素位于目标位置', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        (list) => {
          // 生成有效的索引对
          const fromIndex = Math.floor(Math.random() * list.length);
          const toIndex = Math.floor(Math.random() * list.length);
          
          // 记录被拖拽的元素
          const draggedItem = list[fromIndex];
          
          // 执行重新排序
          const reorderedList = reorderList(list, fromIndex, toIndex);
          
          // 验证：被拖拽的元素应位于目标位置
          expect(reorderedList[toIndex]).toEqual(draggedItem);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，操作后列表长度应保持不变
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 排序后列表长度不变', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (list, fromIndex, toIndex) => {
          // 限制索引在有效范围内
          const validFromIndex = fromIndex % list.length;
          const validToIndex = toIndex % list.length;
          
          // 执行重新排序
          const reorderedList = reorderList(list, validFromIndex, validToIndex);
          
          // 验证：列表长度不变
          expect(reorderedList.length).toBe(list.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，操作后列表应包含所有原始元素
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 排序后包含所有原始元素', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (list, fromIndex, toIndex) => {
          // 限制索引在有效范围内
          const validFromIndex = fromIndex % list.length;
          const validToIndex = toIndex % list.length;
          
          // 执行重新排序
          const reorderedList = reorderList(list, validFromIndex, validToIndex);
          
          // 验证：所有原始元素都存在于重新排序后的列表中
          const originalIds = list.map(item => item.id).sort();
          const reorderedIds = reorderedList.map(item => item.id).sort();
          
          expect(reorderedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，如果 fromIndex === toIndex，列表应保持不变
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 相同位置拖拽不改变列表', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        fc.integer({ min: 0, max: 100 }),
        (list, index) => {
          // 限制索引在有效范围内
          const validIndex = index % list.length;
          
          // 执行重新排序（从同一位置到同一位置）
          const reorderedList = reorderList(list, validIndex, validIndex);
          
          // 验证：列表保持不变
          expect(reorderedList).toEqual(list);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，无效索引应返回原列表
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 无效索引返回原列表', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        fc.integer({ min: -100, max: -1 }),
        fc.integer({ min: 0, max: 100 }),
        (list, invalidFromIndex, toIndex) => {
          // 执行重新排序（使用无效的 fromIndex）
          const reorderedList = reorderList(list, invalidFromIndex, toIndex % list.length);
          
          // 验证：返回原列表
          expect(reorderedList).toEqual(list);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，超出范围的索引应返回原列表
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 超出范围的索引返回原列表', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        (list) => {
          // 使用超出范围的索引
          const outOfRangeIndex = list.length + 10;
          
          // 执行重新排序
          const reorderedList1 = reorderList(list, outOfRangeIndex, 0);
          const reorderedList2 = reorderList(list, 0, outOfRangeIndex);
          
          // 验证：返回原列表
          expect(reorderedList1).toEqual(list);
          expect(reorderedList2).toEqual(list);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，不应修改原列表（不可变性）
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 不修改原列表（不可变性）', () => {
    fc.assert(
      fc.property(
        nonEmptyListArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (list, fromIndex, toIndex) => {
          // 深拷贝原列表
          const originalList = JSON.parse(JSON.stringify(list));
          
          // 限制索引在有效范围内
          const validFromIndex = fromIndex % list.length;
          const validToIndex = toIndex % list.length;
          
          // 执行重新排序
          reorderList(list, validFromIndex, validToIndex);
          
          // 验证：原列表未被修改
          expect(list).toEqual(originalList);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 对于任意拖拽排序操作，其他元素的相对顺序应保持不变
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 其他元素相对顺序保持不变', () => {
    fc.assert(
      fc.property(
        uniqueIdListArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (list, fromIndex, toIndex) => {
          // 限制索引在有效范围内
          const validFromIndex = fromIndex % list.length;
          const validToIndex = toIndex % list.length;
          
          // 如果索引相同，跳过测试
          if (validFromIndex === validToIndex) {
            return;
          }
          
          // 执行重新排序
          const reorderedList = reorderList(list, validFromIndex, validToIndex);
          
          // 获取被移动元素的 ID
          const movedItemId = list[validFromIndex]?.id;
          
          // 获取原列表中除被移动元素外的其他元素（保持原顺序）
          const otherItemsOriginal = list
            .filter((_, index) => index !== validFromIndex)
            .map(item => item.id);
          
          // 获取重新排序后列表中除被移动元素外的其他元素（保持新顺序）
          const otherItemsReordered = reorderedList
            .filter(item => item.id !== movedItemId)
            .map(item => item.id);
          
          // 验证：其他元素的相对顺序保持不变
          expect(otherItemsReordered).toEqual(otherItemsOriginal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 9: 侧边栏拖拽排序**
   * 
   * 空列表的拖拽排序应返回空列表
   * 
   * **Validates: Requirements 7.5**
   */
  it('Property 9: 侧边栏拖拽排序 - 空列表返回空列表', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (fromIndex, toIndex) => {
          const emptyList: { id: string; title: string }[] = [];
          
          // 执行重新排序
          const reorderedList = reorderList(emptyList, fromIndex, toIndex);
          
          // 验证：返回空列表
          expect(reorderedList).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
