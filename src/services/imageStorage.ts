/**
 * 图片存储服务
 * 使用 IndexedDB 存储生成的图片历史记录
 * 需求: 2.7
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { GeneratedImage } from '../types';

// ============ 数据库 Schema 定义 ============

/**
 * 图片数据库 Schema 接口
 */
interface ImageDB extends DBSchema {
  images: {
    key: string;
    value: GeneratedImage;
    indexes: {
      'by-createdAt': number;
      'by-windowId': string;
    };
  };
}

// ============ 常量定义 ============

/** 数据库名称 */
const DB_NAME = 'gemini-chat-images-db';

/** 数据库版本 */
const DB_VERSION = 1;

// ============ 数据库初始化 ============

/** 数据库实例缓存 */
let dbInstance: IDBPDatabase<ImageDB> | null = null;

/**
 * 获取数据库实例
 * 使用单例模式确保只创建一个数据库连接
 */
async function getDB(): Promise<IDBPDatabase<ImageDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ImageDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 创建图片存储
      if (!db.objectStoreNames.contains('images')) {
        const imageStore = db.createObjectStore('images', {
          keyPath: 'id',
        });
        // 创建按创建时间排序的索引
        imageStore.createIndex('by-createdAt', 'createdAt');
        // 创建按窗口 ID 查询的索引
        imageStore.createIndex('by-windowId', 'windowId');
      }
    },
  });

  return dbInstance;
}

// ============ 图片操作 ============

/**
 * 加载所有图片
 * 需求: 2.2, 2.7
 * @returns 按创建时间降序排列的图片列表
 */
export async function loadImages(): Promise<GeneratedImage[]> {
  const db = await getDB();
  const images = await db.getAllFromIndex('images', 'by-createdAt');
  // 按创建时间降序排列（最新的在前）
  return images.reverse();
}

/**
 * 保存图片
 * 需求: 2.7
 * @param image 要保存的图片
 */
export async function saveImage(image: GeneratedImage): Promise<void> {
  const db = await getDB();
  await db.put('images', image);
}

/**
 * 获取单个图片
 * 需求: 2.7
 * @param id 图片 ID
 * @returns 图片对象，如果不存在则返回 null
 */
export async function getImage(id: string): Promise<GeneratedImage | null> {
  const db = await getDB();
  const image = await db.get('images', id);
  return image ?? null;
}

/**
 * 删除图片
 * 需求: 2.7
 * @param id 要删除的图片 ID
 */
export async function deleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('images', id);
}

/**
 * 根据窗口 ID 获取图片列表
 * 需求: 2.2, 2.7
 * @param windowId 聊天窗口 ID
 * @returns 该窗口关联的图片列表
 */
export async function getImagesByWindowId(windowId: string): Promise<GeneratedImage[]> {
  const db = await getDB();
  const images = await db.getAllFromIndex('images', 'by-windowId', windowId);
  // 按创建时间降序排列
  return images.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 批量删除图片
 * 需求: 2.7
 * @param ids 要删除的图片 ID 列表
 */
export async function deleteImages(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('images', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

/**
 * 清除所有图片
 * 需求: 2.7
 */
export async function clearAllImages(): Promise<void> {
  const db = await getDB();
  await db.clear('images');
}

// ============ 工具函数 ============

/**
 * 关闭数据库连接（用于测试清理）
 */
export function closeImageDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * 删除整个数据库（用于测试清理）
 */
export async function deleteImageDatabase(): Promise<void> {
  closeImageDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
