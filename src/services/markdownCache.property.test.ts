/**
 * Markdown 缓存服务属性测试
 * 需求: 2.1 - 缓存命中属性验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createMarkdownCache } from './markdownCache';
import React from 'react';

describe('MarkdownCache 属性测试', () => {
  /**
   * Property 4: Markdown 缓存命中
   * 对于任意 Markdown 内容，连续两次渲染相同内容时，
   * 第二次应该返回缓存的结果（引用相等）
   * 
   * 验证需求: 2.1
   */
  describe('Property 4: Markdown 缓存命中', () => {
    it('相同内容应返回缓存结果', () => {
      fc.assert(
        fc.property(
          // 生成随机 Markdown 内容
          fc.string({ minLength: 1, maxLength: 1000 }),
          (content) => {
            const cache = createMarkdownCache({ maxEntries: 100, ttl: 60000 });
            
            // 创建一个模拟的 ReactNode
            const rendered = React.createElement('div', null, content);
            
            // 第一次设置缓存
            cache.set(content, rendered);
            
            // 第二次获取应该命中缓存
            const cached = cache.get(content);
            
            // 应该返回相同的引用
            expect(cached).toBe(rendered);
            
            // 清理
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不同内容应返回不同结果', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (content1, content2) => {
            // 确保两个内容不同
            if (content1 === content2) return;
            
            const cache = createMarkdownCache({ maxEntries: 100, ttl: 60000 });
            
            const rendered1 = React.createElement('div', null, content1);
            const rendered2 = React.createElement('div', null, content2);
            
            cache.set(content1, rendered1);
            cache.set(content2, rendered2);
            
            const cached1 = cache.get(content1);
            const cached2 = cache.get(content2);
            
            // 不同内容应返回不同结果
            expect(cached1).toBe(rendered1);
            expect(cached2).toBe(rendered2);
            expect(cached1).not.toBe(cached2);
            
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('未缓存的内容应返回 null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (content) => {
            const cache = createMarkdownCache({ maxEntries: 100, ttl: 60000 });
            
            // 未设置缓存，应返回 null
            const cached = cache.get(content);
            expect(cached).toBeNull();
            
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('LRU 淘汰策略', () => {
    it('超过最大容量时应淘汰最久未使用的条目', () => {
      fc.assert(
        fc.property(
          // 生成多个不同的内容
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 5, maxLength: 10 }),
          (contents) => {
            // 去重
            const uniqueContents = [...new Set(contents)];
            if (uniqueContents.length < 3) return;
            
            // 创建容量为 3 的缓存
            const cache = createMarkdownCache({ maxEntries: 3, ttl: 60000 });
            
            // 添加前 3 个内容
            for (let i = 0; i < Math.min(3, uniqueContents.length); i++) {
              const rendered = React.createElement('div', null, uniqueContents[i]);
              cache.set(uniqueContents[i]!, rendered);
            }
            
            // 缓存大小应该是 3
            expect(cache.getStats().size).toBeLessThanOrEqual(3);
            
            // 如果有第 4 个内容，添加后第一个应该被淘汰
            if (uniqueContents.length >= 4) {
              const rendered4 = React.createElement('div', null, uniqueContents[3]);
              cache.set(uniqueContents[3]!, rendered4);
              
              // 第一个内容应该被淘汰
              const cached1 = cache.get(uniqueContents[0]!);
              expect(cached1).toBeNull();
              
              // 第四个内容应该存在
              const cached4 = cache.get(uniqueContents[3]!);
              expect(cached4).toBe(rendered4);
            }
            
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('访问条目应更新其使用时间', () => {
      const cache = createMarkdownCache({ maxEntries: 3, ttl: 60000 });
      
      // 添加 3 个条目
      const contents = ['content1', 'content2', 'content3'];
      const rendereds = contents.map(c => React.createElement('div', null, c));
      
      contents.forEach((c, i) => cache.set(c, rendereds[i]!));
      
      // 访问第一个条目，使其成为最近使用
      cache.get('content1');
      
      // 添加第四个条目
      const rendered4 = React.createElement('div', null, 'content4');
      cache.set('content4', rendered4);
      
      // 第一个条目应该还在（因为刚被访问）
      expect(cache.get('content1')).toBe(rendereds[0]);
      
      // 第二个条目应该被淘汰（最久未使用）
      expect(cache.get('content2')).toBeNull();
      
      cache.destroy();
    });
  });

  describe('缓存统计', () => {
    it('统计信息应正确反映缓存状态', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          (contents) => {
            const uniqueContents = [...new Set(contents)];
            const maxEntries = 10;
            const cache = createMarkdownCache({ maxEntries, ttl: 60000 });
            
            // 添加所有内容
            uniqueContents.forEach(c => {
              const rendered = React.createElement('div', null, c);
              cache.set(c, rendered);
            });
            
            const stats = cache.getStats();
            
            // 大小不应超过最大容量
            expect(stats.size).toBeLessThanOrEqual(maxEntries);
            // 大小不应超过实际添加的数量
            expect(stats.size).toBeLessThanOrEqual(uniqueContents.length);
            // 最大容量应该正确
            expect(stats.maxSize).toBe(maxEntries);
            
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('清空缓存', () => {
    it('清空后所有内容应返回 null', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (contents) => {
            const cache = createMarkdownCache({ maxEntries: 100, ttl: 60000 });
            
            // 添加所有内容
            contents.forEach(c => {
              const rendered = React.createElement('div', null, c);
              cache.set(c, rendered);
            });
            
            // 清空缓存
            cache.clear();
            
            // 所有内容应返回 null
            contents.forEach(c => {
              expect(cache.get(c)).toBeNull();
            });
            
            // 大小应为 0
            expect(cache.getStats().size).toBe(0);
            
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
