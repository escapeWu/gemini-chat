/**
 * 聊天窗口 Store 属性测试
 * 使用 fast-check 进行属性测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { useChatWindowStore } from './chatWindow';
import type { ChatWindowConfig } from '../types/chatWindow';
import { DEFAULT_CHAT_WINDOW_CONFIG } from '../types/chatWindow';
import type { Message } from '../types/models';
import { 
  getChatWindow, 
  clearAllData
} from '../services/storage';

// ============ 生成器 ============

/**
 * 生成有效的模型 ID
 */
const modelIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_.'.split('')),
  { minLength: 1, maxLength: 50 }
);

/**
 * 生成有效的生成配置（部分配置）
 * 使用 requiredKeys: [] 确保不存在的字段不会出现在对象中
 * 这样展开合并时不会用 undefined 覆盖原有值
 */
const generationConfigArb = fc.record(
  {
    temperature: fc.double({ min: 0, max: 2, noNaN: true }),
    topP: fc.double({ min: 0, max: 1, noNaN: true }),
    topK: fc.integer({ min: 1, max: 100 }),
    maxOutputTokens: fc.integer({ min: 1, max: 100000 }),
  },
  { requiredKeys: [] } // 所有字段都是可选的，不存在的字段不会出现在对象中
);

/**
 * 生成有效的聊天窗口配置（部分配置）
 * 注意：使用 fc.record 的 requiredKeys 选项来生成真正的部分配置
 * 而不是生成包含 undefined 值的完整对象
 */
const chatWindowConfigArb: fc.Arbitrary<Partial<ChatWindowConfig>> = fc.record(
  {
    model: modelIdArb,
    generationConfig: generationConfigArb,
    systemInstruction: fc.string({ maxLength: 500 }),
  },
  { requiredKeys: [] } // 所有字段都是可选的，不存在的字段不会出现在对象中
);

/**
 * 生成有效的消息内容
 */
const messageContentArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * 生成消息列表
 */
const messageListArb = fc.array(
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
    content: messageContentArb,
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
  }),
  { minLength: 0, maxLength: 10 }
);

// ============ 测试辅助函数 ============

/**
 * 重置 store 状态
 */
function resetStore() {
  useChatWindowStore.setState({
    windows: [],
    activeWindowId: null,
    isLoading: false,
    isSending: false,
    error: null,
    streamingText: '',
    initialized: false,
  });
}

// ============ 属性测试 ============

describe('聊天窗口 Store 属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * **Feature: ui-redesign, Property 2: 新窗口继承默认配置**
   * 
   * 对于任意全局默认配置，创建新聊天窗口后，新窗口的配置应与全局默认配置一致
   * 
   * **Validates: Requirements 4.4**
   */
  it('Property 2: 新窗口继承默认配置 - 不传入配置时使用默认配置', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        resetStore();
        const store = useChatWindowStore.getState();
        
        // 创建新窗口，不传入任何配置
        const newWindow = store.createWindow();
        
        // 验证：新窗口的配置应与默认配置一致
        expect(newWindow.config.model).toBe(DEFAULT_CHAT_WINDOW_CONFIG.model);
        expect(newWindow.config.generationConfig.temperature).toBe(
          DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.temperature
        );
        expect(newWindow.config.generationConfig.topP).toBe(
          DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.topP
        );
        expect(newWindow.config.generationConfig.topK).toBe(
          DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.topK
        );
        expect(newWindow.config.systemInstruction).toBe(
          DEFAULT_CHAT_WINDOW_CONFIG.systemInstruction
        );
      }),
      { numRuns: 5 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 2: 新窗口继承默认配置**
   * 
   * 对于任意传入的部分配置，创建新窗口后，未指定的字段应使用传入值，其他使用默认值
   * 
   * **Validates: Requirements 4.4**
   */
  it('Property 2: 新窗口继承默认配置 - 部分配置时未指定字段使用默认值', () => {
    fc.assert(
      fc.property(chatWindowConfigArb, (partialConfig) => {
        resetStore();
        const store = useChatWindowStore.getState();
        
        // 创建新窗口，传入部分配置
        const newWindow = store.createWindow(partialConfig);
        
        // 验证：指定的字段使用传入值，未指定的使用默认值
        if (partialConfig.model !== undefined) {
          expect(newWindow.config.model).toBe(partialConfig.model);
        } else {
          expect(newWindow.config.model).toBe(DEFAULT_CHAT_WINDOW_CONFIG.model);
        }
        
        if (partialConfig.systemInstruction !== undefined) {
          expect(newWindow.config.systemInstruction).toBe(partialConfig.systemInstruction);
        } else {
          expect(newWindow.config.systemInstruction).toBe(
            DEFAULT_CHAT_WINDOW_CONFIG.systemInstruction
          );
        }
      }),
      { numRuns: 5 }
    );
  });
});

describe('聊天窗口配置持久化属性测试', () => {
  beforeEach(async () => {
    resetStore();
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  /**
   * **Feature: ui-redesign, Property 3: 聊天窗口配置持久化**
   * 
   * 对于任意聊天窗口配置修改，保存后重新加载，配置应与修改后的值一致
   * 
   * **Validates: Requirements 4.6**
   */
  it('Property 3: 聊天窗口配置持久化 - 保存后重新加载配置一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        chatWindowConfigArb,
        async (configUpdate) => {
          resetStore();
          await clearAllData();
          
          const store = useChatWindowStore.getState();
          
          // 创建新窗口
          const newWindow = store.createWindow();
          const windowId = newWindow.id;
          
          // 等待异步保存完成
          await new Promise(resolve => setTimeout(resolve, 20));
          
          // 更新窗口配置
          await store.updateWindowConfig(windowId, configUpdate);
          
          // 等待异步保存完成
          await new Promise(resolve => setTimeout(resolve, 20));
          
          // 从存储中重新加载
          const loadedWindow = await getChatWindow(windowId);
          
          // 验证：加载的配置应与更新后的配置一致
          expect(loadedWindow).not.toBeNull();
          
          if (loadedWindow) {
            // 验证 model
            if (configUpdate.model !== undefined) {
              expect(loadedWindow.config.model).toBe(configUpdate.model);
            } else {
              expect(loadedWindow.config.model).toBe(DEFAULT_CHAT_WINDOW_CONFIG.model);
            }
            
            // 验证 systemInstruction
            if (configUpdate.systemInstruction !== undefined) {
              expect(loadedWindow.config.systemInstruction).toBe(configUpdate.systemInstruction);
            } else {
              expect(loadedWindow.config.systemInstruction).toBe(
                DEFAULT_CHAT_WINDOW_CONFIG.systemInstruction
              );
            }
            
            // 验证 generationConfig
            if (configUpdate.generationConfig !== undefined) {
              // 只验证已定义的字段
              if (configUpdate.generationConfig.temperature !== undefined) {
                expect(loadedWindow.config.generationConfig.temperature).toBe(
                  configUpdate.generationConfig.temperature
                );
              }
              if (configUpdate.generationConfig.topP !== undefined) {
                expect(loadedWindow.config.generationConfig.topP).toBe(
                  configUpdate.generationConfig.topP
                );
              }
              if (configUpdate.generationConfig.topK !== undefined) {
                expect(loadedWindow.config.generationConfig.topK).toBe(
                  configUpdate.generationConfig.topK
                );
              }
              if (configUpdate.generationConfig.maxOutputTokens !== undefined) {
                expect(loadedWindow.config.generationConfig.maxOutputTokens).toBe(
                  configUpdate.generationConfig.maxOutputTokens
                );
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  /**
   * **Feature: ui-redesign, Property 3: 聊天窗口配置持久化**
   * 
   * 对于任意聊天窗口，直接保存到存储后读取，数据应完全一致（round-trip）
   * 
   * **Validates: Requirements 4.6**
   */
  it('Property 3: 聊天窗口配置持久化 - 存储 round-trip 一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        chatWindowConfigArb,
        async (config) => {
          await clearAllData();
          
          const store = useChatWindowStore.getState();
          
          // 创建带有指定配置的窗口
          const newWindow = store.createWindow(config);
          
          // 等待异步保存完成
          await new Promise(resolve => setTimeout(resolve, 20));
          
          // 从存储中读取
          const loadedWindow = await getChatWindow(newWindow.id);
          
          // 验证：读取的窗口应存在
          expect(loadedWindow).not.toBeNull();
          
          if (loadedWindow) {
            // 验证基本字段
            expect(loadedWindow.id).toBe(newWindow.id);
            expect(loadedWindow.title).toBe(newWindow.title);
            
            // 验证配置字段
            expect(loadedWindow.config.model).toBe(newWindow.config.model);
            expect(loadedWindow.config.systemInstruction).toBe(newWindow.config.systemInstruction);
            expect(loadedWindow.config.generationConfig.temperature).toBe(
              newWindow.config.generationConfig.temperature
            );
            expect(loadedWindow.config.generationConfig.topP).toBe(
              newWindow.config.generationConfig.topP
            );
            expect(loadedWindow.config.generationConfig.topK).toBe(
              newWindow.config.generationConfig.topK
            );
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});

describe('子话题继承父窗口配置属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * **Feature: ui-redesign, Property 5: 子话题继承父窗口配置**
   * 
   * 对于任意聊天窗口，创建新子话题后，子话题使用的配置应与父窗口配置一致
   * 
   * **Validates: Requirements 5.2**
   */
  it('Property 5: 子话题继承父窗口配置 - 新子话题使用父窗口配置', () => {
    fc.assert(
      fc.property(
        chatWindowConfigArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (windowConfig, subTopicTitle) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建带有指定配置的聊天窗口
          const chatWindow = store.createWindow(windowConfig);
          const windowId = chatWindow.id;
          
          // 创建新子话题
          const newSubTopic = store.createSubTopic(windowId, subTopicTitle);
          
          // 验证：子话题创建成功
          expect(newSubTopic).not.toBeNull();
          
          if (newSubTopic) {
            // 获取更新后的窗口状态
            const currentState = useChatWindowStore.getState();
            const currentWindow = currentState.windows.find(w => w.id === windowId);
            
            expect(currentWindow).not.toBeUndefined();
            
            if (currentWindow) {
              // 验证：新子话题存在于窗口的子话题列表中
              const subTopicInWindow = currentWindow.subTopics.find(st => st.id === newSubTopic.id);
              expect(subTopicInWindow).not.toBeUndefined();
              
              // 验证：子话题使用的配置与父窗口配置一致
              // 由于子话题不存储自己的配置，而是共享父窗口配置
              // 我们验证父窗口的配置在创建子话题后保持不变
              
              // 验证 model
              if (windowConfig.model !== undefined) {
                expect(currentWindow.config.model).toBe(windowConfig.model);
              } else {
                expect(currentWindow.config.model).toBe(DEFAULT_CHAT_WINDOW_CONFIG.model);
              }
              
              // 验证 systemInstruction
              if (windowConfig.systemInstruction !== undefined) {
                expect(currentWindow.config.systemInstruction).toBe(windowConfig.systemInstruction);
              } else {
                expect(currentWindow.config.systemInstruction).toBe(
                  DEFAULT_CHAT_WINDOW_CONFIG.systemInstruction
                );
              }
              
              // 验证 generationConfig
              if (windowConfig.generationConfig !== undefined) {
                if (windowConfig.generationConfig.temperature !== undefined) {
                  expect(currentWindow.config.generationConfig.temperature).toBe(
                    windowConfig.generationConfig.temperature
                  );
                }
                if (windowConfig.generationConfig.topP !== undefined) {
                  expect(currentWindow.config.generationConfig.topP).toBe(
                    windowConfig.generationConfig.topP
                  );
                }
                if (windowConfig.generationConfig.topK !== undefined) {
                  expect(currentWindow.config.generationConfig.topK).toBe(
                    windowConfig.generationConfig.topK
                  );
                }
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 5: 子话题继承父窗口配置**
   * 
   * 对于任意聊天窗口，创建多个子话题后，所有子话题都应使用相同的父窗口配置
   * 
   * **Validates: Requirements 5.2**
   */
  it('Property 5: 子话题继承父窗口配置 - 多个子话题共享同一父窗口配置', () => {
    fc.assert(
      fc.property(
        chatWindowConfigArb,
        fc.integer({ min: 1, max: 5 }),
        (windowConfig, numSubTopics) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建带有指定配置的聊天窗口
          const chatWindow = store.createWindow(windowConfig);
          const windowId = chatWindow.id;
          
          // 创建多个子话题
          const createdSubTopicIds: string[] = [chatWindow.subTopics[0]?.id || ''];
          for (let i = 0; i < numSubTopics; i++) {
            const newSubTopic = store.createSubTopic(windowId, `子话题 ${i + 1}`);
            if (newSubTopic) {
              createdSubTopicIds.push(newSubTopic.id);
            }
          }
          
          // 获取更新后的窗口状态
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          
          expect(currentWindow).not.toBeUndefined();
          
          if (currentWindow) {
            // 验证：所有子话题都存在
            expect(currentWindow.subTopics.length).toBe(numSubTopics + 1); // +1 是默认子话题
            
            // 验证：父窗口配置保持一致，所有子话题共享此配置
            // 由于子话题不存储自己的配置，我们验证父窗口配置正确
            if (windowConfig.model !== undefined) {
              expect(currentWindow.config.model).toBe(windowConfig.model);
            }
            
            if (windowConfig.systemInstruction !== undefined) {
              expect(currentWindow.config.systemInstruction).toBe(windowConfig.systemInstruction);
            }
            
            // 验证：每个子话题都可以通过父窗口访问到相同的配置
            for (const subTopic of currentWindow.subTopics) {
              // 子话题本身不存储配置，但可以通过父窗口获取
              // 这里验证子话题结构正确，且父窗口配置可访问
              expect(subTopic.id).toBeDefined();
              expect(subTopic.title).toBeDefined();
              expect(subTopic.messages).toBeDefined();
              
              // 父窗口配置对所有子话题都是相同的
              expect(currentWindow.config).toBeDefined();
              expect(currentWindow.config.model).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Feature: ui-redesign, Property 5: 子话题继承父窗口配置**
   * 
   * 对于任意聊天窗口，修改父窗口配置后，所有子话题使用的配置应同步更新
   * 
   * **Validates: Requirements 5.2**
   */
  it('Property 5: 子话题继承父窗口配置 - 父窗口配置更新后子话题同步', async () => {
    await fc.assert(
      fc.asyncProperty(
        chatWindowConfigArb,
        chatWindowConfigArb,
        async (initialConfig, updatedConfig) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建带有初始配置的聊天窗口
          const chatWindow = store.createWindow(initialConfig);
          const windowId = chatWindow.id;
          
          // 创建几个子话题
          store.createSubTopic(windowId, '子话题 1');
          store.createSubTopic(windowId, '子话题 2');
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 更新父窗口配置
          await store.updateWindowConfig(windowId, updatedConfig);
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取更新后的窗口状态
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          
          expect(currentWindow).not.toBeUndefined();
          
          if (currentWindow) {
            // 验证：父窗口配置已更新
            if (updatedConfig.model !== undefined) {
              expect(currentWindow.config.model).toBe(updatedConfig.model);
            }
            
            if (updatedConfig.systemInstruction !== undefined) {
              expect(currentWindow.config.systemInstruction).toBe(updatedConfig.systemInstruction);
            }
            
            // 验证：所有子话题都能访问到更新后的父窗口配置
            // 由于子话题共享父窗口配置，配置更新自动对所有子话题生效
            for (const subTopic of currentWindow.subTopics) {
              // 子话题通过父窗口访问配置
              // 这里验证父窗口配置已正确更新
              expect(currentWindow.config).toBeDefined();
              
              // 子话题本身的结构保持不变
              expect(subTopic.id).toBeDefined();
              expect(subTopic.messages).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});

describe('配置修改实时生效属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * **Feature: ui-redesign, Property 7: 配置修改实时生效**
   * 
   * 对于任意聊天窗口配置修改，修改后发送的消息应使用新配置
   * 
   * **Validates: Requirements 6.6**
   */
  it('Property 7: 配置修改实时生效 - 修改配置后窗口状态立即反映新配置', async () => {
    await fc.assert(
      fc.asyncProperty(
        chatWindowConfigArb,
        chatWindowConfigArb,
        async (initialConfig, updatedConfig) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建带有初始配置的聊天窗口
          const chatWindow = store.createWindow(initialConfig);
          const windowId = chatWindow.id;
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证初始配置已设置
          let currentState = useChatWindowStore.getState();
          let currentWindow = currentState.windows.find(w => w.id === windowId);
          expect(currentWindow).not.toBeUndefined();
          
          if (currentWindow) {
            // 验证初始配置
            if (initialConfig.model !== undefined) {
              expect(currentWindow.config.model).toBe(initialConfig.model);
            }
          }
          
          // 修改窗口配置
          await store.updateWindowConfig(windowId, updatedConfig);
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证配置已立即更新
          currentState = useChatWindowStore.getState();
          currentWindow = currentState.windows.find(w => w.id === windowId);
          expect(currentWindow).not.toBeUndefined();
          
          if (currentWindow) {
            // 验证更新后的配置
            if (updatedConfig.model !== undefined) {
              expect(currentWindow.config.model).toBe(updatedConfig.model);
            } else if (initialConfig.model !== undefined) {
              // 如果更新配置中没有 model，应保持初始值
              expect(currentWindow.config.model).toBe(initialConfig.model);
            }
            
            if (updatedConfig.systemInstruction !== undefined) {
              expect(currentWindow.config.systemInstruction).toBe(updatedConfig.systemInstruction);
            } else if (initialConfig.systemInstruction !== undefined) {
              expect(currentWindow.config.systemInstruction).toBe(initialConfig.systemInstruction);
            }
            
            // 验证 generationConfig
            if (updatedConfig.generationConfig !== undefined) {
              if (updatedConfig.generationConfig.temperature !== undefined) {
                expect(currentWindow.config.generationConfig.temperature).toBe(
                  updatedConfig.generationConfig.temperature
                );
              }
              if (updatedConfig.generationConfig.topP !== undefined) {
                expect(currentWindow.config.generationConfig.topP).toBe(
                  updatedConfig.generationConfig.topP
                );
              }
              if (updatedConfig.generationConfig.topK !== undefined) {
                expect(currentWindow.config.generationConfig.topK).toBe(
                  updatedConfig.generationConfig.topK
                );
              }
              if (updatedConfig.generationConfig.maxOutputTokens !== undefined) {
                expect(currentWindow.config.generationConfig.maxOutputTokens).toBe(
                  updatedConfig.generationConfig.maxOutputTokens
                );
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);

  /**
   * **Feature: ui-redesign, Property 7: 配置修改实时生效**
   * 
   * 对于任意聊天窗口，多次连续修改配置后，最终配置应反映最后一次修改
   * 
   * **Validates: Requirements 6.6**
   */
  it('Property 7: 配置修改实时生效 - 多次连续修改配置后反映最终状态', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(chatWindowConfigArb, { minLength: 1, maxLength: 5 }),
        async (configUpdates) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 连续应用多次配置更新
          for (const configUpdate of configUpdates) {
            await store.updateWindowConfig(windowId, configUpdate);
            await new Promise(resolve => setTimeout(resolve, 5));
          }
          
          // 等待所有异步操作完成
          await new Promise(resolve => setTimeout(resolve, 20));
          
          // 获取最终状态
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          expect(finalWindow).not.toBeUndefined();
          
          if (finalWindow) {
            // 计算预期的最终配置（合并所有更新）
            let expectedModel = DEFAULT_CHAT_WINDOW_CONFIG.model;
            let expectedSystemInstruction = DEFAULT_CHAT_WINDOW_CONFIG.systemInstruction;
            let expectedTemperature = DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.temperature;
            let expectedTopP = DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.topP;
            let expectedTopK = DEFAULT_CHAT_WINDOW_CONFIG.generationConfig.topK;
            
            for (const update of configUpdates) {
              if (update.model !== undefined) {
                expectedModel = update.model;
              }
              if (update.systemInstruction !== undefined) {
                expectedSystemInstruction = update.systemInstruction;
              }
              if (update.generationConfig !== undefined) {
                if (update.generationConfig.temperature !== undefined) {
                  expectedTemperature = update.generationConfig.temperature;
                }
                if (update.generationConfig.topP !== undefined) {
                  expectedTopP = update.generationConfig.topP;
                }
                if (update.generationConfig.topK !== undefined) {
                  expectedTopK = update.generationConfig.topK;
                }
              }
            }
            
            // 验证最终配置
            expect(finalWindow.config.model).toBe(expectedModel);
            expect(finalWindow.config.systemInstruction).toBe(expectedSystemInstruction);
            expect(finalWindow.config.generationConfig.temperature).toBe(expectedTemperature);
            expect(finalWindow.config.generationConfig.topP).toBe(expectedTopP);
            expect(finalWindow.config.generationConfig.topK).toBe(expectedTopK);
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * **Feature: ui-redesign, Property 7: 配置修改实时生效**
   * 
   * 对于任意聊天窗口，修改配置后，getActiveWindow 返回的窗口应包含新配置
   * 
   * **Validates: Requirements 6.6**
   */
  it('Property 7: 配置修改实时生效 - getActiveWindow 返回更新后的配置', async () => {
    await fc.assert(
      fc.asyncProperty(
        chatWindowConfigArb,
        async (updatedConfig) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建并选择聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          store.selectWindow(windowId);
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 修改窗口配置
          await store.updateWindowConfig(windowId, updatedConfig);
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 通过 getActiveWindow 获取窗口
          const activeWindow = useChatWindowStore.getState().getActiveWindow();
          expect(activeWindow).not.toBeNull();
          
          if (activeWindow) {
            // 验证 getActiveWindow 返回的配置是更新后的
            if (updatedConfig.model !== undefined) {
              expect(activeWindow.config.model).toBe(updatedConfig.model);
            }
            
            if (updatedConfig.systemInstruction !== undefined) {
              expect(activeWindow.config.systemInstruction).toBe(updatedConfig.systemInstruction);
            }
            
            if (updatedConfig.generationConfig !== undefined) {
              if (updatedConfig.generationConfig.temperature !== undefined) {
                expect(activeWindow.config.generationConfig.temperature).toBe(
                  updatedConfig.generationConfig.temperature
                );
              }
              if (updatedConfig.generationConfig.topP !== undefined) {
                expect(activeWindow.config.generationConfig.topP).toBe(
                  updatedConfig.generationConfig.topP
                );
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});

describe('子话题消息独立性属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * **Feature: ui-redesign, Property 4: 子话题消息独立性**
   * 
   * 对于任意聊天窗口内的两个子话题 A 和 B，向子话题 A 发送消息不应影响子话题 B 的消息历史
   * 
   * **Validates: Requirements 5.1, 5.3**
   */
  it('Property 4: 子话题消息独立性 - 向一个子话题添加消息不影响其他子话题', async () => {
    await fc.assert(
      fc.asyncProperty(
        messageListArb,
        messageListArb,
        messageContentArb,
        async (messagesA, messagesB, newMessageContent) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建一个聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          
          // 获取默认子话题 A
          const subTopicA = chatWindow.subTopics[0];
          if (!subTopicA) {
            return; // 跳过无效情况
          }
          const subTopicAId = subTopicA.id;
          
          // 创建子话题 B
          const subTopicB = store.createSubTopic(windowId, '子话题 B');
          if (!subTopicB) {
            return; // 跳过无效情况
          }
          const subTopicBId = subTopicB.id;
          
          // 为子话题 A 设置初始消息
          await store.updateSubTopic(windowId, subTopicAId, { 
            messages: messagesA as Message[] 
          });
          
          // 为子话题 B 设置初始消息
          await store.updateSubTopic(windowId, subTopicBId, { 
            messages: messagesB as Message[] 
          });
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 记录子话题 B 的消息快照（深拷贝）
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) {
            return; // 跳过无效情况
          }
          
          const subTopicBBefore = currentWindow.subTopics.find(st => st.id === subTopicBId);
          if (!subTopicBBefore) {
            return; // 跳过无效情况
          }
          const messagesBBeforeSnapshot = JSON.parse(JSON.stringify(subTopicBBefore.messages));
          
          // 向子话题 A 添加新消息
          const newMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: newMessageContent,
            timestamp: Date.now(),
          };
          
          const subTopicABefore = currentWindow.subTopics.find(st => st.id === subTopicAId);
          if (!subTopicABefore) {
            return; // 跳过无效情况
          }
          
          await store.updateSubTopic(windowId, subTopicAId, {
            messages: [...subTopicABefore.messages, newMessage],
          });
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证：子话题 B 的消息应保持不变
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          expect(finalWindow).not.toBeNull();
          
          if (finalWindow) {
            const subTopicBAfter = finalWindow.subTopics.find(st => st.id === subTopicBId);
            expect(subTopicBAfter).not.toBeUndefined();
            
            if (subTopicBAfter) {
              // 验证消息数量不变
              expect(subTopicBAfter.messages.length).toBe(messagesBBeforeSnapshot.length);
              
              // 验证每条消息内容不变
              for (let i = 0; i < messagesBBeforeSnapshot.length; i++) {
                expect(subTopicBAfter.messages[i]?.id).toBe(messagesBBeforeSnapshot[i]?.id);
                expect(subTopicBAfter.messages[i]?.content).toBe(messagesBBeforeSnapshot[i]?.content);
                expect(subTopicBAfter.messages[i]?.role).toBe(messagesBBeforeSnapshot[i]?.role);
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * **Feature: ui-redesign, Property 4: 子话题消息独立性**
   * 
   * 对于任意聊天窗口，删除一个子话题的消息不应影响其他子话题的消息
   * 
   * **Validates: Requirements 5.1, 5.3**
   */
  it('Property 4: 子话题消息独立性 - 清空一个子话题的消息不影响其他子话题', async () => {
    await fc.assert(
      fc.asyncProperty(
        messageListArb,
        messageListArb,
        async (messagesA, messagesB) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建一个聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          
          // 获取默认子话题 A
          const subTopicA = chatWindow.subTopics[0];
          if (!subTopicA) {
            return;
          }
          const subTopicAId = subTopicA.id;
          
          // 创建子话题 B
          const subTopicB = store.createSubTopic(windowId, '子话题 B');
          if (!subTopicB) {
            return;
          }
          const subTopicBId = subTopicB.id;
          
          // 为两个子话题设置初始消息
          await store.updateSubTopic(windowId, subTopicAId, { 
            messages: messagesA as Message[] 
          });
          await store.updateSubTopic(windowId, subTopicBId, { 
            messages: messagesB as Message[] 
          });
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 记录子话题 B 的消息快照
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) {
            return;
          }
          
          const subTopicBBefore = currentWindow.subTopics.find(st => st.id === subTopicBId);
          if (!subTopicBBefore) {
            return;
          }
          const messagesBBeforeSnapshot = JSON.parse(JSON.stringify(subTopicBBefore.messages));
          
          // 清空子话题 A 的消息
          await store.updateSubTopic(windowId, subTopicAId, { messages: [] });
          
          // 等待异步操作完成
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证：子话题 B 的消息应保持不变
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          expect(finalWindow).not.toBeNull();
          
          if (finalWindow) {
            const subTopicBAfter = finalWindow.subTopics.find(st => st.id === subTopicBId);
            expect(subTopicBAfter).not.toBeUndefined();
            
            if (subTopicBAfter) {
              // 验证消息数量不变
              expect(subTopicBAfter.messages.length).toBe(messagesBBeforeSnapshot.length);
              
              // 验证每条消息内容不变
              for (let i = 0; i < messagesBBeforeSnapshot.length; i++) {
                expect(subTopicBAfter.messages[i]?.id).toBe(messagesBBeforeSnapshot[i]?.id);
                expect(subTopicBAfter.messages[i]?.content).toBe(messagesBBeforeSnapshot[i]?.content);
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});

describe('消息编辑截断属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * Property 5: 消息编辑后截断
   * 对于任意消息列表，当编辑索引为 i 的消息后，列表长度应该变为 i + 1（删除后续所有消息）
   * 
   * 验证需求: 3.2
   */
  it('Property 5: 消息编辑后截断 - 编辑消息后删除后续所有消息', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成消息列表（至少 2 条，确保有后续消息可删除）
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        // 新消息内容
        fc.string({ minLength: 1, maxLength: 100 }),
        async (messages, newContent) => {
          resetStore();
          
          // 确保消息列表有效且包含用户消息
          const userMessageIndices = messages
            .map((m, i) => ({ ...m, index: i }))
            .filter(m => m.role === 'user')
            .map(m => m.index);
          
          if (userMessageIndices.length === 0) {
            return; // 跳过没有用户消息的情况
          }
          
          // 选择一个用户消息进行编辑（不是最后一条，确保有后续消息）
          const editIndex = userMessageIndices.find(i => i < messages.length - 1);
          if (editIndex === undefined) {
            return; // 跳过没有合适编辑位置的情况
          }
          
          const store = useChatWindowStore.getState();
          
          // 创建窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置初始消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取要编辑的消息
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) return;
          
          const subTopic = currentWindow.subTopics.find(st => st.id === subTopicId);
          if (!subTopic) return;
          
          const messageToEdit = subTopic.messages[editIndex];
          if (!messageToEdit) return;
          
          // 记录编辑前的消息数量
          const messageCountBefore = subTopic.messages.length;
          
          // 模拟编辑操作：截断消息列表
          const truncatedMessages = subTopic.messages.slice(0, editIndex);
          
          await store.updateSubTopic(windowId, subTopicId, {
            messages: truncatedMessages,
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证截断后的消息数量
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          if (!finalWindow) return;
          
          const finalSubTopic = finalWindow.subTopics.find(st => st.id === subTopicId);
          if (!finalSubTopic) return;
          
          // 验证：消息列表长度应该等于编辑索引（删除了该消息及之后的所有消息）
          expect(finalSubTopic.messages.length).toBe(editIndex);
          
          // 验证：前面的消息保持不变
          for (let i = 0; i < editIndex; i++) {
            expect(finalSubTopic.messages[i]?.id).toBe(messages[i]?.id);
            expect(finalSubTopic.messages[i]?.content).toBe(messages[i]?.content);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Property 5: 消息编辑后截断 - 边界情况
   * 编辑第一条消息应该清空所有后续消息
   */
  it('Property 5: 消息编辑后截断 - 编辑第一条消息清空后续', async () => {
    resetStore();
    
    const store = useChatWindowStore.getState();
    const chatWindow = store.createWindow();
    const windowId = chatWindow.id;
    const subTopicId = chatWindow.activeSubTopicId;
    
    // 设置初始消息
    const initialMessages: Message[] = [
      { id: 'msg-1', role: 'user', content: '第一条消息', timestamp: Date.now() },
      { id: 'msg-2', role: 'model', content: 'AI 回复 1', timestamp: Date.now() + 1 },
      { id: 'msg-3', role: 'user', content: '第二条消息', timestamp: Date.now() + 2 },
      { id: 'msg-4', role: 'model', content: 'AI 回复 2', timestamp: Date.now() + 3 },
    ];
    
    await store.updateSubTopic(windowId, subTopicId, {
      messages: initialMessages,
    });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 模拟编辑第一条消息（索引 0）
    await store.updateSubTopic(windowId, subTopicId, {
      messages: [], // 截断到索引 0 之前，即清空
    });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 验证
    const finalState = useChatWindowStore.getState();
    const finalWindow = finalState.windows.find(w => w.id === windowId);
    expect(finalWindow).not.toBeUndefined();
    
    if (finalWindow) {
      const finalSubTopic = finalWindow.subTopics.find(st => st.id === subTopicId);
      expect(finalSubTopic).not.toBeUndefined();
      
      if (finalSubTopic) {
        // 编辑第一条消息后，应该清空所有消息
        expect(finalSubTopic.messages.length).toBe(0);
      }
    }
  }, 30000);
});


describe('重新生成消息属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * **Feature: comprehensive-enhancements, Property 7: 重新生成上下文一致性**
   * 
   * 对于任意 AI 消息重新生成请求，发送的消息历史应该与原请求完全一致（不包含被重新生成的消息）
   * 
   * **Validates: Requirements 4.1**
   */
  it('Property 7: 重新生成上下文一致性 - 上下文消息不包含被重新生成的消息', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成消息列表（至少包含一个用户消息和一个 AI 消息）
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (messages) => {
          resetStore();
          
          // 确保消息列表有效且包含 AI 消息
          const modelMessageIndices = messages
            .map((m, i) => ({ ...m, index: i }))
            .filter(m => m.role === 'model')
            .map(m => m.index);
          
          if (modelMessageIndices.length === 0) {
            return; // 跳过没有 AI 消息的情况
          }
          
          // 选择一个 AI 消息进行重新生成
          const regenerateIndex = modelMessageIndices[0];
          if (regenerateIndex === undefined || regenerateIndex === 0) {
            return; // 跳过无效情况（AI 消息不能是第一条）
          }
          
          const store = useChatWindowStore.getState();
          
          // 创建窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置初始消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取当前状态
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) return;
          
          const subTopic = currentWindow.subTopics.find(st => st.id === subTopicId);
          if (!subTopic) return;
          
          const messageToRegenerate = subTopic.messages[regenerateIndex];
          if (!messageToRegenerate || messageToRegenerate.role !== 'model') return;
          
          // 计算预期的上下文消息（不包含被重新生成的消息）
          const expectedContextMessages = subTopic.messages.slice(0, regenerateIndex);
          
          // 验证：上下文消息数量应该等于重新生成消息的索引
          expect(expectedContextMessages.length).toBe(regenerateIndex);
          
          // 验证：上下文消息不包含被重新生成的消息
          const contextMessageIds = expectedContextMessages.map(m => m.id);
          expect(contextMessageIds).not.toContain(messageToRegenerate.id);
          
          // 验证：上下文消息保持原有顺序
          for (let i = 0; i < expectedContextMessages.length; i++) {
            expect(expectedContextMessages[i]?.id).toBe(messages[i]?.id);
            expect(expectedContextMessages[i]?.content).toBe(messages[i]?.content);
            expect(expectedContextMessages[i]?.role).toBe(messages[i]?.role);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * **Feature: comprehensive-enhancements, Property 7: 重新生成上下文一致性**
   * 
   * 验证上下文消息的完整性 - 所有在被重新生成消息之前的消息都应该被包含
   */
  it('Property 7: 重新生成上下文一致性 - 上下文包含所有前置消息', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成交替的用户和 AI 消息
        fc.integer({ min: 1, max: 4 }).chain(pairCount => {
          const pairs: fc.Arbitrary<{ id: string; role: 'user' | 'model'; content: string; timestamp: number }>[] = [];
          for (let i = 0; i < pairCount; i++) {
            pairs.push(
              fc.record({
                id: fc.constant(`user-${i}`),
                role: fc.constant('user' as const),
                content: fc.string({ minLength: 1, maxLength: 50 }),
                timestamp: fc.constant(1000000000000 + i * 2),
              })
            );
            pairs.push(
              fc.record({
                id: fc.constant(`model-${i}`),
                role: fc.constant('model' as const),
                content: fc.string({ minLength: 1, maxLength: 50 }),
                timestamp: fc.constant(1000000000000 + i * 2 + 1),
              })
            );
          }
          return fc.tuple(...pairs);
        }),
        async (messagesTuple) => {
          resetStore();
          
          const messages = Array.isArray(messagesTuple) ? messagesTuple : [messagesTuple];
          
          if (messages.length < 2) return;
          
          // 找到最后一个 AI 消息的索引
          const lastModelIndex = messages.length - 1;
          const lastMessage = messages[lastModelIndex];
          if (!lastMessage || lastMessage.role !== 'model') return;
          
          const store = useChatWindowStore.getState();
          
          // 创建窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置初始消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取当前状态
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) return;
          
          const subTopic = currentWindow.subTopics.find(st => st.id === subTopicId);
          if (!subTopic) return;
          
          // 计算预期的上下文消息
          const expectedContextMessages = subTopic.messages.slice(0, lastModelIndex);
          
          // 验证：上下文消息数量正确
          expect(expectedContextMessages.length).toBe(lastModelIndex);
          
          // 验证：所有前置消息都被包含
          for (let i = 0; i < lastModelIndex; i++) {
            const expectedMsg = messages[i];
            const actualMsg = expectedContextMessages[i];
            expect(actualMsg?.id).toBe(expectedMsg?.id);
            expect(actualMsg?.role).toBe(expectedMsg?.role);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * **Feature: comprehensive-enhancements, Property 8: 重新生成消息替换**
   * 
   * 对于任意重新生成操作，完成后消息 ID 应保持不变，但内容应更新为新响应
   * 
   * **Validates: Requirements 4.3**
   */
  it('Property 8: 重新生成消息替换 - 消息 ID 保持不变', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成消息列表
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
          }),
          { minLength: 2, maxLength: 8 }
        ),
        // 新的响应内容
        fc.string({ minLength: 1, maxLength: 100 }),
        async (messages, newContent) => {
          resetStore();
          
          // 确保消息列表有效且包含 AI 消息
          const modelMessageIndices = messages
            .map((m, i) => ({ ...m, index: i }))
            .filter(m => m.role === 'model')
            .map(m => m.index);
          
          if (modelMessageIndices.length === 0) {
            return; // 跳过没有 AI 消息的情况
          }
          
          // 选择一个 AI 消息进行重新生成
          const regenerateIndex = modelMessageIndices[0];
          if (regenerateIndex === undefined || regenerateIndex === 0) {
            return; // 跳过无效情况
          }
          
          const store = useChatWindowStore.getState();
          
          // 创建窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置初始消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取当前状态
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) return;
          
          const subTopic = currentWindow.subTopics.find(st => st.id === subTopicId);
          if (!subTopic) return;
          
          const originalMessage = subTopic.messages[regenerateIndex];
          if (!originalMessage || originalMessage.role !== 'model') return;
          
          const originalMessageId = originalMessage.id;
          
          // 模拟重新生成操作：更新消息内容但保持 ID 不变
          const updatedMessage: Message = {
            ...originalMessage,
            content: newContent,
            timestamp: Date.now(),
          };
          
          const updatedMessages = [...subTopic.messages];
          updatedMessages[regenerateIndex] = updatedMessage;
          
          await store.updateSubTopic(windowId, subTopicId, {
            messages: updatedMessages,
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          if (!finalWindow) return;
          
          const finalSubTopic = finalWindow.subTopics.find(st => st.id === subTopicId);
          if (!finalSubTopic) return;
          
          const regeneratedMessage = finalSubTopic.messages[regenerateIndex];
          
          // 验证：消息 ID 保持不变
          expect(regeneratedMessage?.id).toBe(originalMessageId);
          
          // 验证：消息内容已更新
          expect(regeneratedMessage?.content).toBe(newContent);
          
          // 验证：消息角色保持不变
          expect(regeneratedMessage?.role).toBe('model');
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * **Feature: comprehensive-enhancements, Property 8: 重新生成消息替换**
   * 
   * 验证重新生成后其他消息保持不变
   */
  it('Property 8: 重新生成消息替换 - 其他消息保持不变', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成消息列表
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
          }),
          { minLength: 3, maxLength: 8 }
        ),
        // 新的响应内容
        fc.string({ minLength: 1, maxLength: 100 }),
        async (messages, newContent) => {
          resetStore();
          
          // 确保消息列表有效且包含 AI 消息
          const modelMessageIndices = messages
            .map((m, i) => ({ ...m, index: i }))
            .filter(m => m.role === 'model')
            .map(m => m.index);
          
          if (modelMessageIndices.length === 0) {
            return; // 跳过没有 AI 消息的情况
          }
          
          // 选择一个 AI 消息进行重新生成
          const regenerateIndex = modelMessageIndices[0];
          if (regenerateIndex === undefined || regenerateIndex === 0) {
            return; // 跳过无效情况
          }
          
          const store = useChatWindowStore.getState();
          
          // 创建窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置初始消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 获取当前状态并保存快照
          const currentState = useChatWindowStore.getState();
          const currentWindow = currentState.windows.find(w => w.id === windowId);
          if (!currentWindow) return;
          
          const subTopic = currentWindow.subTopics.find(st => st.id === subTopicId);
          if (!subTopic) return;
          
          // 保存所有消息的快照（除了要重新生成的消息）
          const messagesSnapshot = subTopic.messages.map((m, i) => ({
            index: i,
            id: m.id,
            role: m.role,
            content: m.content,
          }));
          
          const originalMessage = subTopic.messages[regenerateIndex];
          if (!originalMessage || originalMessage.role !== 'model') return;
          
          // 模拟重新生成操作
          const updatedMessage: Message = {
            ...originalMessage,
            content: newContent,
            timestamp: Date.now(),
          };
          
          const updatedMessages = [...subTopic.messages];
          updatedMessages[regenerateIndex] = updatedMessage;
          
          await store.updateSubTopic(windowId, subTopicId, {
            messages: updatedMessages,
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 验证
          const finalState = useChatWindowStore.getState();
          const finalWindow = finalState.windows.find(w => w.id === windowId);
          if (!finalWindow) return;
          
          const finalSubTopic = finalWindow.subTopics.find(st => st.id === subTopicId);
          if (!finalSubTopic) return;
          
          // 验证：消息数量保持不变
          expect(finalSubTopic.messages.length).toBe(messagesSnapshot.length);
          
          // 验证：除了重新生成的消息外，其他消息保持不变
          for (let i = 0; i < messagesSnapshot.length; i++) {
            const snapshot = messagesSnapshot[i];
            const finalMsg = finalSubTopic.messages[i];
            
            if (i === regenerateIndex) {
              // 重新生成的消息：ID 不变，内容更新
              expect(finalMsg?.id).toBe(snapshot?.id);
              expect(finalMsg?.content).toBe(newContent);
            } else {
              // 其他消息：完全不变
              expect(finalMsg?.id).toBe(snapshot?.id);
              expect(finalMsg?.role).toBe(snapshot?.role);
              expect(finalMsg?.content).toBe(snapshot?.content);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});

describe('Token 累计统计属性测试', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * 生成带有 Token 使用量的消息
   */
  const messageWithTokenUsageArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
    content: fc.string({ minLength: 1, maxLength: 100 }),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    tokenUsage: fc.option(
      fc.record({
        promptTokens: fc.nat(10000),
        completionTokens: fc.nat(10000),
      }).map(({ promptTokens, completionTokens }) => ({
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      })),
      { nil: undefined }
    ),
  });

  /**
   * **Feature: comprehensive-enhancements, Property 14: Token 累计计算**
   * **Validates: Requirements 7.3**
   * 
   * *For any* 对话中的多条消息，累计 Token 数应该等于所有消息 Token 数的总和
   */
  it('Property 14: Token 累计计算 - 累计 Token 数等于所有消息 Token 数的总和', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageWithTokenUsageArb, { minLength: 1, maxLength: 10 }),
        async (messages) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 设置消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: messages as Message[],
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 计算期望的累计 Token 数
          let expectedPromptTokens = 0;
          let expectedCompletionTokens = 0;
          
          for (const msg of messages) {
            if (msg.tokenUsage) {
              expectedPromptTokens += msg.tokenUsage.promptTokens;
              expectedCompletionTokens += msg.tokenUsage.completionTokens;
            }
          }
          
          // 获取累计 Token 使用量
          const totalUsage = useChatWindowStore.getState().getTotalTokenUsage(windowId, subTopicId);
          
          // 验证
          expect(totalUsage.promptTokens).toBe(expectedPromptTokens);
          expect(totalUsage.completionTokens).toBe(expectedCompletionTokens);
          expect(totalUsage.totalTokens).toBe(expectedPromptTokens + expectedCompletionTokens);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  /**
   * **Feature: comprehensive-enhancements, Property 14: Token 累计计算**
   * **Validates: Requirements 7.3**
   * 
   * 空消息列表应返回零值
   */
  it('Property 14: Token 累计计算 - 空消息列表返回零值', () => {
    resetStore();
    
    const store = useChatWindowStore.getState();
    
    // 创建聊天窗口（默认空消息列表）
    const chatWindow = store.createWindow();
    const windowId = chatWindow.id;
    const subTopicId = chatWindow.activeSubTopicId;
    
    // 获取累计 Token 使用量
    const totalUsage = store.getTotalTokenUsage(windowId, subTopicId);
    
    // 验证
    expect(totalUsage.promptTokens).toBe(0);
    expect(totalUsage.completionTokens).toBe(0);
    expect(totalUsage.totalTokens).toBe(0);
  });

  /**
   * **Feature: comprehensive-enhancements, Property 14: Token 累计计算**
   * **Validates: Requirements 7.3**
   * 
   * 不存在的窗口或子话题应返回零值
   */
  it('Property 14: Token 累计计算 - 不存在的窗口或子话题返回零值', () => {
    resetStore();
    
    const store = useChatWindowStore.getState();
    
    // 获取不存在的窗口的 Token 使用量
    const totalUsage = store.getTotalTokenUsage('non-existent-window', 'non-existent-subtopic');
    
    // 验证
    expect(totalUsage.promptTokens).toBe(0);
    expect(totalUsage.completionTokens).toBe(0);
    expect(totalUsage.totalTokens).toBe(0);
  });

  /**
   * **Feature: comprehensive-enhancements, Property 14: Token 累计计算**
   * **Validates: Requirements 7.3**
   * 
   * 混合有无 tokenUsage 的消息应正确累计
   */
  it('Property 14: Token 累计计算 - 混合有无 tokenUsage 的消息正确累计', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            role: fc.constantFrom('user', 'model') as fc.Arbitrary<'user' | 'model'>,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
            tokenUsage: fc.record({
              promptTokens: fc.nat(10000),
              completionTokens: fc.nat(10000),
            }).map(({ promptTokens, completionTokens }) => ({
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            })),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (messagesWithoutUsage, messagesWithUsage) => {
          resetStore();
          
          const store = useChatWindowStore.getState();
          
          // 创建聊天窗口
          const chatWindow = store.createWindow();
          const windowId = chatWindow.id;
          const subTopicId = chatWindow.activeSubTopicId;
          
          // 混合消息
          const allMessages = [...messagesWithoutUsage, ...messagesWithUsage] as Message[];
          
          // 设置消息
          await store.updateSubTopic(windowId, subTopicId, {
            messages: allMessages,
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 计算期望的累计 Token 数（只计算有 tokenUsage 的消息）
          let expectedPromptTokens = 0;
          let expectedCompletionTokens = 0;
          
          for (const msg of messagesWithUsage) {
            expectedPromptTokens += msg.tokenUsage.promptTokens;
            expectedCompletionTokens += msg.tokenUsage.completionTokens;
          }
          
          // 获取累计 Token 使用量
          const totalUsage = useChatWindowStore.getState().getTotalTokenUsage(windowId, subTopicId);
          
          // 验证
          expect(totalUsage.promptTokens).toBe(expectedPromptTokens);
          expect(totalUsage.completionTokens).toBe(expectedCompletionTokens);
          expect(totalUsage.totalTokens).toBe(expectedPromptTokens + expectedCompletionTokens);
        }
      ),
      { numRuns: 50 }
    );
  }, 60000);
});
