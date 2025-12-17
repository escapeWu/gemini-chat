/**
 * 调试状态管理属性测试
 * 需求: 6.3, 6.5
 * 
 * **Feature: comprehensive-enhancements, Property 11: 请求记录完整性**
 * **Feature: comprehensive-enhancements, Property 12: 请求历史持久化**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useDebugStore, createRequestRecord, generateRequestId } from './debug';
import type { ApiRequestRecord } from './debug';

describe('DebugStore 属性测试', () => {
  // 每个测试前重置 store 状态
  beforeEach(() => {
    const store = useDebugStore.getState();
    store.clearHistory();
    store.setDebugEnabled(false);
  });

  /**
   * Property 11: 请求记录完整性
   * 对于任意 API 请求，记录应该包含 id、timestamp、url、method、headers、body 字段
   * 
   * **Validates: Requirements 6.3**
   */
  describe('Property 11: 请求记录完整性', () => {
    // 生成有效的 HTTP 方法
    const httpMethodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH');
    
    // 生成有效的 URL
    const urlArb = fc.webUrl();
    
    // 生成请求头
    const headersArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z-]+$/.test(s)),
      fc.string({ minLength: 1, maxLength: 100 })
    );
    
    // 生成请求体
    const bodyArb = fc.oneof(
      fc.string(),
      fc.dictionary(fc.string(), fc.string()),
      fc.array(fc.string()),
      fc.constant(null)
    );

    it('createRequestRecord 应创建包含所有必需字段的记录', () => {
      fc.assert(
        fc.property(
          urlArb,
          httpMethodArb,
          headersArb,
          bodyArb,
          (url, method, headers, body) => {
            const record = createRequestRecord(url, method, headers, body);
            
            // 验证所有必需字段存在
            expect(record).toHaveProperty('id');
            expect(record).toHaveProperty('timestamp');
            expect(record).toHaveProperty('url');
            expect(record).toHaveProperty('method');
            expect(record).toHaveProperty('headers');
            expect(record).toHaveProperty('body');
            
            // 验证字段值正确
            expect(record.url).toBe(url);
            expect(record.method).toBe(method);
            expect(record.headers).toEqual(headers);
            expect(record.body).toEqual(body);
            
            // 验证 id 格式
            expect(record.id).toMatch(/^req-\d+-[a-z0-9]+$/);
            
            // 验证 timestamp 是有效的时间戳
            expect(record.timestamp).toBeGreaterThan(0);
            expect(record.timestamp).toBeLessThanOrEqual(Date.now());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('添加的请求记录应保持完整性', () => {
      fc.assert(
        fc.property(
          urlArb,
          httpMethodArb,
          headersArb,
          bodyArb,
          (url, method, headers, body) => {
            const store = useDebugStore.getState();
            store.clearHistory();
            store.setDebugEnabled(true);
            
            const record = createRequestRecord(url, method, headers, body);
            store.addRequestRecord(record);
            
            const storedRecord = store.getRequestRecord(record.id);
            
            // 验证存储的记录包含所有必需字段
            expect(storedRecord).toBeDefined();
            expect(storedRecord!.id).toBe(record.id);
            expect(storedRecord!.timestamp).toBe(record.timestamp);
            expect(storedRecord!.url).toBe(url);
            expect(storedRecord!.method).toBe(method);
            expect(storedRecord!.headers).toEqual(headers);
            expect(storedRecord!.body).toEqual(body);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateRequestId 应生成唯一 ID', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (count) => {
            const ids = new Set<string>();
            
            for (let i = 0; i < count; i++) {
              ids.add(generateRequestId());
            }
            
            // 所有生成的 ID 应该唯一
            expect(ids.size).toBe(count);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 12: 请求历史持久化
   * 对于任意调试面板关闭操作，请求历史数组长度应该保持不变
   * 
   * **Validates: Requirements 6.5**
   */
  describe('Property 12: 请求历史持久化', () => {
    // 生成请求记录
    const requestRecordArb = fc.record({
      id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `req-${Date.now()}-${s}`),
      timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
      url: fc.webUrl(),
      method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
      headers: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string()),
      body: fc.oneof(fc.string(), fc.constant(null)),
    }) as fc.Arbitrary<ApiRequestRecord>;

    it('禁用调试模式不应清除历史记录', () => {
      fc.assert(
        fc.property(
          fc.array(requestRecordArb, { minLength: 1, maxLength: 20 }),
          (records) => {
            const store = useDebugStore.getState();
            store.clearHistory();
            store.setDebugEnabled(true);
            
            // 添加所有记录
            records.forEach(record => store.addRequestRecord(record));
            
            const historyLengthBefore = store.requestHistory.length;
            
            // 禁用调试模式（模拟关闭调试面板）
            store.setDebugEnabled(false);
            
            const historyLengthAfter = store.requestHistory.length;
            
            // 历史记录长度应保持不变
            expect(historyLengthAfter).toBe(historyLengthBefore);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('选择/取消选择请求不应影响历史记录', () => {
      fc.assert(
        fc.property(
          fc.array(requestRecordArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (records, selectIndex) => {
            const store = useDebugStore.getState();
            store.clearHistory();
            store.setDebugEnabled(true);
            
            // 添加所有记录
            records.forEach(record => store.addRequestRecord(record));
            
            const historyLengthBefore = store.requestHistory.length;
            
            // 选择一个请求
            const validIndex = selectIndex % records.length;
            const selectedId = records[validIndex]?.id;
            if (selectedId) {
              store.selectRequest(selectedId);
            }
            
            // 取消选择
            store.selectRequest(null);
            
            const historyLengthAfter = store.requestHistory.length;
            
            // 历史记录长度应保持不变
            expect(historyLengthAfter).toBe(historyLengthBefore);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('更新请求记录不应改变历史记录长度', () => {
      fc.assert(
        fc.property(
          fc.array(requestRecordArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          fc.integer({ min: 200, max: 599 }),
          fc.integer({ min: 100, max: 10000 }),
          (records, updateIndex, statusCode, duration) => {
            const store = useDebugStore.getState();
            store.clearHistory();
            store.setDebugEnabled(true);
            
            // 添加所有记录
            records.forEach(record => store.addRequestRecord(record));
            
            const historyLengthBefore = store.requestHistory.length;
            
            // 更新一个请求记录
            const validIndex = updateIndex % records.length;
            const recordToUpdate = records[validIndex];
            if (recordToUpdate) {
              store.updateRequestRecord(recordToUpdate.id, {
                statusCode,
                duration,
                response: { success: true },
              });
            }
            
            const historyLengthAfter = store.requestHistory.length;
            
            // 历史记录长度应保持不变
            expect(historyLengthAfter).toBe(historyLengthBefore);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('调试模式控制', () => {
    it('调试模式禁用时不应添加新记录', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom('GET', 'POST'),
              headers: fc.constant({}),
              body: fc.constant(null),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (recordData) => {
            // 在每次 property 执行前重置状态
            useDebugStore.setState({
              requestHistory: [],
              selectedRequestId: null,
              debugEnabled: false,
              maxHistorySize: 100,
            });
            
            const store = useDebugStore.getState();
            
            // 尝试添加记录
            recordData.forEach(data => {
              const record = createRequestRecord(data.url, data.method, data.headers, data.body);
              store.addRequestRecord(record);
            });
            
            // 历史记录应为空
            expect(useDebugStore.getState().requestHistory.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('调试模式启用时应正确添加记录', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom('GET', 'POST'),
              headers: fc.constant({}),
              body: fc.constant(null),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (recordData) => {
            // 在每次 property 执行前重置状态
            useDebugStore.setState({
              requestHistory: [],
              selectedRequestId: null,
              debugEnabled: true,
              maxHistorySize: 100,
            });
            
            const store = useDebugStore.getState();
            
            // 添加记录
            recordData.forEach(data => {
              const record = createRequestRecord(data.url, data.method, data.headers, data.body);
              store.addRequestRecord(record);
            });
            
            // 历史记录长度应等于添加的记录数
            expect(useDebugStore.getState().requestHistory.length).toBe(recordData.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('历史记录容量限制', () => {
    it('历史记录不应超过最大容量', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 1, max: 50 }),
          (maxSize, recordCount) => {
            // 在每次 property 执行前重置状态
            useDebugStore.setState({
              requestHistory: [],
              selectedRequestId: null,
              debugEnabled: true,
              maxHistorySize: maxSize,
            });
            
            const store = useDebugStore.getState();
            
            // 添加多个记录
            for (let i = 0; i < recordCount; i++) {
              const record = createRequestRecord(
                `https://example.com/api/${i}`,
                'GET',
                {},
                null
              );
              store.addRequestRecord(record);
            }
            
            // 历史记录长度不应超过最大容量
            expect(useDebugStore.getState().requestHistory.length).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('新记录应添加到历史记录开头', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          (recordCount) => {
            // 在每次 property 执行前重置状态
            useDebugStore.setState({
              requestHistory: [],
              selectedRequestId: null,
              debugEnabled: true,
              maxHistorySize: 100,
            });
            
            const store = useDebugStore.getState();
            const addedIds: string[] = [];
            
            // 添加多个记录
            for (let i = 0; i < recordCount; i++) {
              const record = createRequestRecord(
                `https://example.com/api/${i}`,
                'GET',
                {},
                null
              );
              store.addRequestRecord(record);
              addedIds.push(record.id);
            }
            
            // 最后添加的记录应在开头
            const lastAddedId = addedIds[addedIds.length - 1];
            expect(useDebugStore.getState().requestHistory[0]?.id).toBe(lastAddedId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
