/**
 * 图片存储服务属性测试
 * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
 * **Validates: Requirements 2.7**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  loadImages,
  saveImage,
  getImage,
  deleteImage,
  getImagesByWindowId,
  deleteImageDatabase,
} from './imageStorage';
import type { GeneratedImage } from '../types';

// ============ 生成器定义 ============

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
  data: fc.base64String({ minLength: 10, maxLength: 200 }),
  mimeType: mimeTypeArb,
  createdAt: fc.integer({ min: 0, max: Date.now() }),
  windowId: fc.option(fc.uuid(), { nil: undefined }),
  messageId: fc.option(fc.uuid(), { nil: undefined }),
  prompt: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

// ============ 测试套件 ============

describe('图片存储 CRUD 属性测试', () => {
  // 每个测试前删除数据库确保干净状态
  beforeEach(async () => {
    await deleteImageDatabase();
  });

  // 每个测试后关闭数据库连接
  afterEach(async () => {
    await deleteImageDatabase();
  });

  /**
   * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
   * *对于任意* 生成的图片，添加到图片库后，通过 ID 查询应该能获取到相同的图片数据
   * **Validates: Requirements 2.7**
   */
  it('Property 2.1: 图片保存后通过 ID 查询应返回相同数据', async () => {
    await fc.assert(
      fc.asyncProperty(generatedImageArb, async (image) => {
        // 每次迭代前删除数据库确保干净状态
        await deleteImageDatabase();

        // 保存图片
        await saveImage(image);

        // 通过 ID 查询图片
        const retrieved = await getImage(image.id);

        // 验证往返一致性
        expect(retrieved).toEqual(image);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
   * *对于任意* 图片数据，更新后读取应返回更新后的数据
   * **Validates: Requirements 2.7**
   */
  it('Property 2.2: 图片更新后读取应返回更新后的数据', async () => {
    await fc.assert(
      fc.asyncProperty(
        generatedImageArb,
        fc.string({ maxLength: 200 }),
        async (image, newPrompt) => {
          // 每次迭代前删除数据库确保干净状态
          await deleteImageDatabase();

          // 保存原始图片
          await saveImage(image);

          // 更新图片
          const updatedImage = { ...image, prompt: newPrompt };
          await saveImage(updatedImage);

          // 读取图片
          const retrieved = await getImage(image.id);

          // 验证更新后的数据
          expect(retrieved?.prompt).toEqual(newPrompt);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
   * *对于任意* 图片数据，删除后读取应返回 null
   * **Validates: Requirements 2.7**
   */
  it('Property 2.3: 图片删除后读取应返回 null', async () => {
    await fc.assert(
      fc.asyncProperty(generatedImageArb, async (image) => {
        // 每次迭代前删除数据库确保干净状态
        await deleteImageDatabase();

        // 保存图片
        await saveImage(image);

        // 验证保存成功
        const saved = await getImage(image.id);
        expect(saved).not.toBeNull();

        // 删除图片
        await deleteImage(image.id);

        // 读取图片
        const retrieved = await getImage(image.id);

        // 验证删除后返回 null
        expect(retrieved).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
   * *对于任意* 多个图片数据，loadImages 应返回所有保存的图片
   * **Validates: Requirements 2.7**
   */
  it('Property 2.4: loadImages 应返回所有保存的图片', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generatedImageArb, { minLength: 1, maxLength: 5 }).map(images => {
          // 确保每个图片有唯一的 ID
          const uniqueIds = new Set<string>();
          return images.filter(img => {
            if (uniqueIds.has(img.id)) return false;
            uniqueIds.add(img.id);
            return true;
          });
        }),
        async (images) => {
          // 每次迭代前删除数据库确保干净状态
          await deleteImageDatabase();

          // 保存所有图片
          for (const image of images) {
            await saveImage(image);
          }

          // 获取所有图片
          const retrieved = await loadImages();

          // 验证数量一致
          expect(retrieved.length).toEqual(images.length);

          // 验证所有图片都存在
          const retrievedIds = new Set(retrieved.map(img => img.id));
          for (const image of images) {
            expect(retrievedIds.has(image.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ui-enhancements-v3, Property 2: 图片存储一致性**
   * *对于任意* 带有 windowId 的图片，getImagesByWindowId 应只返回该窗口的图片
   * **Validates: Requirements 2.7**
   */
  it('Property 2.5: getImagesByWindowId 应只返回指定窗口的图片', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(generatedImageArb, { minLength: 1, maxLength: 5 }).map(images => {
          // 确保每个图片有唯一的 ID
          const uniqueIds = new Set<string>();
          return images.filter(img => {
            if (uniqueIds.has(img.id)) return false;
            uniqueIds.add(img.id);
            return true;
          });
        }),
        async (targetWindowId, images) => {
          // 每次迭代前删除数据库确保干净状态
          await deleteImageDatabase();

          // 为部分图片设置目标 windowId
          const imagesWithWindow = images.map((img, index) => ({
            ...img,
            windowId: index % 2 === 0 ? targetWindowId : `other-${index}`,
          }));

          // 保存所有图片
          for (const image of imagesWithWindow) {
            await saveImage(image);
          }

          // 获取指定窗口的图片
          const retrieved = await getImagesByWindowId(targetWindowId);

          // 验证所有返回的图片都属于目标窗口
          for (const image of retrieved) {
            expect(image.windowId).toEqual(targetWindowId);
          }

          // 验证数量正确
          const expectedCount = imagesWithWindow.filter(img => img.windowId === targetWindowId).length;
          expect(retrieved.length).toEqual(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
