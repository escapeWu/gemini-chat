/**
 * 聊天窗口状态管理
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 2.2, 2.4
 */

import { create } from 'zustand';
import type { 
  ChatWindow, 
  ChatWindowConfig, 
  SubTopic 
} from '../types/chatWindow';
import type { Message, Attachment, ApiConfig, ModelAdvancedConfig } from '../types/models';
import type { GeminiContent, GeminiPart } from '../types/gemini';
import { 
  DEFAULT_CHAT_WINDOW_CONFIG, 
  createDefaultChatWindow, 
  createDefaultSubTopic 
} from '../types/chatWindow';
import {
  saveChatWindow,
  getAllChatWindows,
  deleteChatWindow as deleteChatWindowFromStorage,
} from '../services/storage';
import { 
  sendMessageNonStreaming as sendGeminiMessageNonStreaming, 
  sendMessageWithThoughts, 
  GeminiApiError, 
  GeminiRequestCancelledWithThoughtsError,
  type ImageExtractionResult 
} from '../services/gemini';
import { useModelStore } from './model';
import { storeLogger } from '../services/logger';

// ============ 工具函数 ============

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 将消息转换为 Gemini API 格式
 */
function messageToGeminiContent(message: Message): GeminiContent {
  const parts: GeminiPart[] = [];

  // 添加文本内容
  if (message.content) {
    parts.push({ text: message.content });
  }

  // 添加附件
  if (message.attachments && message.attachments.length > 0) {
    for (const attachment of message.attachments) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      });
    }
  }

  return {
    role: message.role,
    parts,
  };
}

/**
 * 将消息历史转换为 Gemini API 格式
 */
function messagesToGeminiContents(messages: Message[]): GeminiContent[] {
  return messages.map(messageToGeminiContent);
}

// ============ Store 状态接口 ============

/**
 * 聊天窗口 Store 状态
 */
interface ChatWindowState {
  /** 所有聊天窗口 */
  windows: ChatWindow[];
  /** 当前活动窗口 ID */
  activeWindowId: string | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在发送消息 */
  isSending: boolean;
  /** 错误信息 */
  error: string | null;
  /** 流式响应文本 */
  streamingText: string;
  /** 是否已初始化 */
  initialized: boolean;
  /** 当前请求的 AbortController - 需求: 5.1, 5.2 */
  currentRequestController: AbortController | null;
}

// ============ Store 操作接口 ============

/**
 * 聊天窗口 Store 操作
 */
interface ChatWindowActions {
  // 窗口操作
  /** 从存储加载所有窗口 */
  loadWindows: () => Promise<void>;
  /** 创建新窗口 */
  createWindow: (config?: Partial<ChatWindowConfig>) => ChatWindow;
  /** 更新窗口 */
  updateWindow: (id: string, updates: Partial<ChatWindow>) => Promise<void>;
  /** 删除窗口 */
  deleteWindow: (id: string) => Promise<void>;
  /** 选择窗口 */
  selectWindow: (id: string) => void;
  
  // 配置操作
  /** 更新窗口配置 */
  updateWindowConfig: (id: string, config: Partial<ChatWindowConfig>) => Promise<void>;
  /** 更新窗口高级配置（思考程度、图片配置等） */
  updateAdvancedConfig: (id: string, advancedConfig: Partial<ModelAdvancedConfig>) => Promise<void>;
  
  // 子话题操作
  /** 创建子话题 */
  createSubTopic: (windowId: string, title?: string) => SubTopic | null;
  /** 更新子话题 */
  updateSubTopic: (windowId: string, subTopicId: string, updates: Partial<SubTopic>) => Promise<void>;
  /** 删除子话题 */
  deleteSubTopic: (windowId: string, subTopicId: string) => Promise<void>;
  /** 选择子话题 */
  selectSubTopic: (windowId: string, subTopicId: string) => void;
  
  // 消息操作
  /** 发送消息 */
  sendMessage: (
    windowId: string,
    subTopicId: string,
    content: string,
    attachments?: Attachment[],
    apiConfig?: ApiConfig,
    advancedConfig?: ModelAdvancedConfig
  ) => Promise<void>;
  
  // 工具方法
  /** 获取当前活动窗口 */
  getActiveWindow: () => ChatWindow | null;
  /** 获取当前活动子话题 */
  getActiveSubTopic: () => SubTopic | null;
  /** 清除错误 */
  clearError: () => void;
  /** 清除流式文本 */
  clearStreamingText: () => void;
  
  // 排序操作
  /** 重新排序窗口列表 */
  reorderWindows: (windows: ChatWindow[]) => Promise<void>;
  
  // 请求取消操作
  // 需求: 5.1, 5.2, 5.3, 5.4
  /** 取消当前请求 */
  cancelRequest: () => void;
  
  // 消息编辑和重新生成操作
  // 需求: 3.2, 4.1, 4.3
  /** 编辑消息（删除后续消息并重新发送） */
  editMessage: (
    windowId: string,
    subTopicId: string,
    messageId: string,
    newContent: string
  ) => Promise<void>;
  /** 重新生成 AI 消息 */
  regenerateMessage: (
    windowId: string,
    subTopicId: string,
    messageId: string
  ) => Promise<void>;
  
  // Token 统计操作
  // 需求: 7.3
  /** 获取当前对话的累计 Token 使用量 */
  getTotalTokenUsage: (windowId: string, subTopicId: string) => import('../types/models').MessageTokenUsage;
}

// ============ Store 类型 ============

export type ChatWindowStore = ChatWindowState & ChatWindowActions;

// ============ Store 创建 ============

/**
 * 创建聊天窗口 Store
 */
export const useChatWindowStore = create<ChatWindowStore>((set, get) => ({
  // 初始状态
  windows: [],
  activeWindowId: null,
  isLoading: false,
  isSending: false,
  error: null,
  streamingText: '',
  initialized: false,
  currentRequestController: null,

  // 从存储加载所有窗口
  // 需求: 4.6
  loadWindows: async () => {
    storeLogger.info('开始加载聊天窗口');
    set({ isLoading: true, error: null });
    try {
      const windows = await getAllChatWindows();
      storeLogger.info('聊天窗口加载完成', { count: windows.length });
      set({
        windows,
        initialized: true,
        isLoading: false,
      });
    } catch (error) {
      // 需求: 2.4 - 输出错误日志
      storeLogger.error('加载聊天窗口失败', { error: error instanceof Error ? error.message : '未知错误' });
      set({
        error: error instanceof Error ? error.message : '加载聊天窗口失败',
        initialized: true,
        isLoading: false,
      });
    }
  },

  // 创建新窗口
  // 需求: 4.4 - 新窗口继承全局默认配置
  createWindow: (config?: Partial<ChatWindowConfig>) => {
    const windowId = generateId();
    const subTopicId = generateId();
    
    // 合并默认配置和传入的配置
    const windowConfig: ChatWindowConfig = {
      ...DEFAULT_CHAT_WINDOW_CONFIG,
      ...config,
    };
    
    const newWindow = createDefaultChatWindow(
      windowId,
      '新对话',
      windowConfig,
      subTopicId
    );

    set((state) => ({
      windows: [newWindow, ...state.windows],
      activeWindowId: newWindow.id,
    }));

    // 异步保存到存储
    saveChatWindow(newWindow).catch(console.error);

    return newWindow;
  },

  // 更新窗口
  // 需求: 4.5
  updateWindow: async (id: string, updates: Partial<ChatWindow>) => {
    const state = get();
    const window = state.windows.find((w) => w.id === id);
    
    if (!window) {
      return;
    }

    const updatedWindow: ChatWindow = {
      ...window,
      ...updates,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    try {
      await saveChatWindow(updatedWindow);
    } catch (error) {
      console.error('更新聊天窗口失败:', error);
    }
  },

  // 删除窗口
  deleteWindow: async (id: string) => {
    const state = get();
    
    // 从列表中移除
    const newWindows = state.windows.filter((w) => w.id !== id);
    
    // 如果删除的是当前窗口，切换到第一个窗口或清空
    let newActiveId = state.activeWindowId;
    if (state.activeWindowId === id) {
      const firstWindow = newWindows[0];
      newActiveId = firstWindow ? firstWindow.id : null;
    }

    set({
      windows: newWindows,
      activeWindowId: newActiveId,
    });

    // 异步从存储删除
    try {
      await deleteChatWindowFromStorage(id);
    } catch (error) {
      console.error('删除聊天窗口失败:', error);
    }
  },

  // 选择窗口
  selectWindow: (id: string) => {
    const state = get();
    const window = state.windows.find((w) => w.id === id);
    if (window) {
      set({ activeWindowId: id, error: null });
    }
  },

  // 更新窗口配置
  // 需求: 4.1, 4.2, 4.3, 4.5, 4.6, 1.6, 2.6
  updateWindowConfig: async (id: string, config: Partial<ChatWindowConfig>) => {
    const state = get();
    const window = state.windows.find((w) => w.id === id);
    
    if (!window) {
      return;
    }

    // 深度合并 advancedConfig，确保思考程度和图片配置正确持久化
    // 需求: 1.6, 2.6
    const mergedAdvancedConfig: ModelAdvancedConfig | undefined = config.advancedConfig !== undefined
      ? {
          ...window.config.advancedConfig,
          ...config.advancedConfig,
          // 深度合并 imageConfig
          imageConfig: config.advancedConfig?.imageConfig !== undefined
            ? {
                ...window.config.advancedConfig?.imageConfig,
                ...config.advancedConfig.imageConfig,
              }
            : window.config.advancedConfig?.imageConfig,
        }
      : window.config.advancedConfig;

    const updatedWindow: ChatWindow = {
      ...window,
      config: {
        ...window.config,
        ...config,
        generationConfig: {
          ...window.config.generationConfig,
          ...(config.generationConfig || {}),
        },
        advancedConfig: mergedAdvancedConfig,
      },
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    // 需求: 4.6 - 配置持久化
    try {
      await saveChatWindow(updatedWindow);
    } catch (error) {
      console.error('更新窗口配置失败:', error);
    }
  },

  // 更新窗口高级配置
  // 需求: 1.6, 2.6, 4.5 - 思考程度和图片配置持久化
  updateAdvancedConfig: async (id: string, advancedConfig: Partial<ModelAdvancedConfig>) => {
    const state = get();
    const window = state.windows.find((w) => w.id === id);
    
    if (!window) {
      return;
    }

    // 深度合并 advancedConfig
    const mergedAdvancedConfig: ModelAdvancedConfig = {
      ...window.config.advancedConfig,
      ...advancedConfig,
      // 深度合并 imageConfig
      imageConfig: advancedConfig.imageConfig !== undefined
        ? {
            ...window.config.advancedConfig?.imageConfig,
            ...advancedConfig.imageConfig,
          }
        : window.config.advancedConfig?.imageConfig,
    };

    const updatedWindow: ChatWindow = {
      ...window,
      config: {
        ...window.config,
        advancedConfig: mergedAdvancedConfig,
      },
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? updatedWindow : w
      ),
    }));

    // 异步保存到存储，实时保存配置修改
    // 需求: 4.5 - 实时保存并应用
    try {
      await saveChatWindow(updatedWindow);
    } catch (error) {
      console.error('更新高级配置失败:', error);
    }
  },

  // 创建子话题
  // 需求: 5.1, 5.2
  createSubTopic: (windowId: string, title?: string) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      return null;
    }

    const subTopicId = generateId();
    const newSubTopic = createDefaultSubTopic(subTopicId, title || `话题 ${window.subTopics.length + 1}`);

    const updatedWindow: ChatWindow = {
      ...window,
      subTopics: [...window.subTopics, newSubTopic],
      activeSubTopicId: newSubTopic.id,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    saveChatWindow(updatedWindow).catch(console.error);

    return newSubTopic;
  },

  // 更新子话题
  // 需求: 5.3
  updateSubTopic: async (windowId: string, subTopicId: string, updates: Partial<SubTopic>) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      return;
    }

    const subTopicIndex = window.subTopics.findIndex((st) => st.id === subTopicId);
    if (subTopicIndex === -1) {
      return;
    }

    const existingSubTopic = window.subTopics[subTopicIndex];
    if (!existingSubTopic) {
      return;
    }

    const updatedSubTopic: SubTopic = {
      ...existingSubTopic,
      ...updates,
      updatedAt: Date.now(),
    };

    const updatedSubTopics = [...window.subTopics];
    updatedSubTopics[subTopicIndex] = updatedSubTopic;

    const updatedWindow: ChatWindow = {
      ...window,
      subTopics: updatedSubTopics,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    try {
      await saveChatWindow(updatedWindow);
    } catch (error) {
      console.error('更新子话题失败:', error);
    }
  },

  // 删除子话题
  deleteSubTopic: async (windowId: string, subTopicId: string) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      return;
    }

    // 不能删除最后一个子话题
    if (window.subTopics.length <= 1) {
      set({ error: '至少需要保留一个子话题' });
      return;
    }

    const newSubTopics = window.subTopics.filter((st) => st.id !== subTopicId);
    
    // 如果删除的是当前活动子话题，切换到第一个
    let newActiveSubTopicId = window.activeSubTopicId;
    if (window.activeSubTopicId === subTopicId) {
      const firstSubTopic = newSubTopics[0];
      newActiveSubTopicId = firstSubTopic ? firstSubTopic.id : '';
    }

    const updatedWindow: ChatWindow = {
      ...window,
      subTopics: newSubTopics,
      activeSubTopicId: newActiveSubTopicId,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    try {
      await saveChatWindow(updatedWindow);
    } catch (error) {
      console.error('删除子话题失败:', error);
    }
  },

  // 选择子话题
  selectSubTopic: (windowId: string, subTopicId: string) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      return;
    }

    const subTopic = window.subTopics.find((st) => st.id === subTopicId);
    if (!subTopic) {
      return;
    }

    const updatedWindow: ChatWindow = {
      ...window,
      activeSubTopicId: subTopicId,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
    }));

    // 异步保存到存储
    saveChatWindow(updatedWindow).catch(console.error);
  },

  // 发送消息
  // 需求: 5.1, 5.2, 5.3, 6.6
  sendMessage: async (
    windowId: string,
    subTopicId: string,
    content: string,
    attachments?: Attachment[],
    apiConfig?: ApiConfig,
    advancedConfig?: ModelAdvancedConfig
  ) => {
    const state = get();
    let window = state.windows.find((w) => w.id === windowId);
    
    // 如果没有指定窗口，创建一个新的
    if (!window) {
      window = get().createWindow();
      windowId = window.id;
      subTopicId = window.activeSubTopicId;
    }

    const subTopic = window.subTopics.find((st) => st.id === subTopicId);
    if (!subTopic) {
      set({ error: '子话题不存在' });
      return;
    }

    // 创建用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      attachments,
      timestamp: Date.now(),
    };

    // 添加用户消息到子话题
    const messagesWithUser = [...subTopic.messages, userMessage];
    const updatedSubTopic: SubTopic = {
      ...subTopic,
      messages: messagesWithUser,
      updatedAt: Date.now(),
    };

    // 更新窗口标题（如果是第一条消息）
    let windowTitle = window.title;
    if (subTopic.messages.length === 0 && window.subTopics.length === 1) {
      windowTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    const updatedSubTopics = window.subTopics.map((st) =>
      st.id === subTopicId ? updatedSubTopic : st
    );

    const updatedWindow: ChatWindow = {
      ...window,
      title: windowTitle,
      subTopics: updatedSubTopics,
      updatedAt: Date.now(),
    };

    // 创建 AbortController 用于取消请求 - 需求: 5.1, 5.2
    const abortController = new AbortController();

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
      isSending: true,
      error: null,
      streamingText: '',
      currentRequestController: abortController,
    }));

    // 保存窗口
    await saveChatWindow(updatedWindow);

    try {
      // 使用窗口配置构建 API 配置
      // 需求: 6.6 - 配置修改实时生效
      const effectiveApiConfig: ApiConfig = apiConfig || {
        endpoint: '', // 将从 settings store 获取
        apiKey: '',   // 将从 settings store 获取
        model: window.config.model,
      };

      // 如果没有提供完整的 API 配置，从 settings 获取
      // 同时获取流式设置
      // 需求: 10.3, 10.4, 1.3, 1.4
      const { useSettingsStore } = await import('./settings');
      const settingsState = useSettingsStore.getState();
      
      if (!effectiveApiConfig.endpoint || !effectiveApiConfig.apiKey) {
        effectiveApiConfig.endpoint = settingsState.apiEndpoint;
        effectiveApiConfig.apiKey = settingsState.apiKey;
      }
      
      // 使用流式设置解析函数，实现对话设置优先逻辑
      // 需求: 1.3 - 对话设置优先
      // 需求: 1.4 - 回退到全局设置
      const { resolveStreamingEnabled } = await import('../services/streaming');
      const streamingEnabled = resolveStreamingEnabled(window.config, settingsState.getFullSettings());

      // 获取模型的有效高级参数配置
      const effectiveAdvancedConfig = advancedConfig || useModelStore.getState().getEffectiveConfig(window.config.model);

      // 转换消息为 Gemini API 格式
      const geminiContents = messagesToGeminiContents(messagesWithUser);

      // 根据流式设置选择 API 调用方式
      // 需求: 10.3 - 流式输出逐字逐句实时显示
      // 需求: 10.4 - 非流式输出完整生成后一次性显示
      // 需求: 4.3 - 解析并保存思维链内容
      let fullResponse = '';
      let thoughtSummary: string | undefined;
      let generatedImages: ImageExtractionResult[] | undefined;
      // 需求: 8.2, 8.3, 8.4 - 耗时数据
      let duration: number | undefined;
      let ttfb: number | undefined;
      
      if (streamingEnabled) {
        // 流式响应（支持思维链提取）
        // 需求: 5.2 - 传递 AbortSignal 用于取消请求
        const result = await sendMessageWithThoughts(
          geminiContents,
          effectiveApiConfig,
          window.config.generationConfig,
          window.config.safetySettings,
          window.config.systemInstruction,
          (chunk) => {
            fullResponse += chunk;
            set({ streamingText: fullResponse });
          },
          effectiveAdvancedConfig,
          abortController.signal
        );
        fullResponse = result.text;
        thoughtSummary = result.thoughtSummary;
        generatedImages = result.images;
        // 需求: 8.4 - 保存耗时数据
        duration = result.duration;
        ttfb = result.ttfb;
      } else {
        // 非流式响应
        fullResponse = await sendGeminiMessageNonStreaming(
          geminiContents,
          effectiveApiConfig,
          window.config.generationConfig,
          window.config.safetySettings,
          window.config.systemInstruction,
          effectiveAdvancedConfig
        );
      }
      
      // 保存生成的图片到图片库 - 需求: 2.7
      if (generatedImages && generatedImages.length > 0) {
        const { useImageStore } = await import('./image');
        const { createGeneratedImage } = await import('../types');
        const imageStore = useImageStore.getState();
        
        for (const imageData of generatedImages) {
          const image = createGeneratedImage(imageData.data, imageData.mimeType, {
            windowId,
            messageId: generateId(), // 将在下面创建的 AI 消息 ID
            prompt: content, // 用户的提示词
          });
          await imageStore.addImage(image);
        }
      }

      // 创建 AI 响应消息（包含思维链摘要和耗时数据）
      // 需求: 4.3, 8.4
      const aiMessage: Message = {
        id: generateId(),
        role: 'model',
        content: fullResponse,
        timestamp: Date.now(),
        thoughtSummary,
        // 需求: 8.4 - 保存耗时数据
        duration,
        ttfb,
      };

      // 更新子话题消息
      const finalSubTopic: SubTopic = {
        ...updatedSubTopic,
        messages: [...messagesWithUser, aiMessage],
        updatedAt: Date.now(),
      };

      const finalSubTopics = updatedWindow.subTopics.map((st) =>
        st.id === subTopicId ? finalSubTopic : st
      );

      const finalWindow: ChatWindow = {
        ...updatedWindow,
        subTopics: finalSubTopics,
        updatedAt: Date.now(),
      };

      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === windowId ? finalWindow : w
        ),
        isSending: false,
        streamingText: '',
        currentRequestController: null,
      }));

      // 保存窗口
      await saveChatWindow(finalWindow);
    } catch (error) {
      // 需求: 5.3, 5.4 - 处理请求取消，保留部分响应
      if (error instanceof GeminiRequestCancelledWithThoughtsError) {
        storeLogger.info('请求已取消，保存部分响应', {
          partialResponseLength: error.partialResponse.length,
          windowId,
          subTopicId,
        });

        // 如果有部分响应，保存为消息
        if (error.partialResponse.length > 0) {
          const partialAiMessage: Message = {
            id: generateId(),
            role: 'model',
            content: error.partialResponse,
            timestamp: Date.now(),
            thoughtSummary: error.partialThought || undefined,
          };

          const cancelledSubTopic: SubTopic = {
            ...updatedSubTopic,
            messages: [...messagesWithUser, partialAiMessage],
            updatedAt: Date.now(),
          };

          const cancelledSubTopics = updatedWindow.subTopics.map((st) =>
            st.id === subTopicId ? cancelledSubTopic : st
          );

          const cancelledWindow: ChatWindow = {
            ...updatedWindow,
            subTopics: cancelledSubTopics,
            updatedAt: Date.now(),
          };

          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? cancelledWindow : w
            ),
            isSending: false,
            streamingText: '',
            currentRequestController: null,
          }));

          await saveChatWindow(cancelledWindow);
        } else {
          set({
            isSending: false,
            streamingText: '',
            currentRequestController: null,
          });
        }
        return;
      }

      // 需求: 2.4 - 输出错误日志
      storeLogger.error('发送消息失败', { 
        error: error instanceof Error ? error.message : '未知错误',
        windowId,
        subTopicId,
      });
      
      let errorMessage = '发送消息失败';
      if (error instanceof GeminiApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        isSending: false,
        error: errorMessage,
        streamingText: '',
        currentRequestController: null,
      });
    }
  },

  // 获取当前活动窗口
  getActiveWindow: () => {
    const state = get();
    if (!state.activeWindowId) {
      return null;
    }
    return state.windows.find((w) => w.id === state.activeWindowId) || null;
  },

  // 获取当前活动子话题
  getActiveSubTopic: () => {
    const state = get();
    const window = state.getActiveWindow();
    if (!window) {
      return null;
    }
    return window.subTopics.find((st) => st.id === window.activeSubTopicId) || null;
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 清除流式文本
  clearStreamingText: () => {
    set({ streamingText: '' });
  },

  // 重新排序窗口列表
  // 需求: 7.5
  reorderWindows: async (windows: ChatWindow[]) => {
    set({ windows });
    
    // 异步保存所有窗口到存储
    try {
      const { saveAllChatWindows } = await import('../services/storage');
      await saveAllChatWindows(windows);
    } catch (error) {
      console.error('保存窗口排序失败:', error);
    }
  },

  // 取消当前请求
  // 需求: 5.1, 5.2 - 取消正在进行的 API 请求
  cancelRequest: () => {
    const state = get();
    if (state.currentRequestController) {
      storeLogger.info('取消当前请求');
      state.currentRequestController.abort();
      // 注意：不在这里清除 controller，让 sendMessage 的 catch 块处理
    }
  },

  // 编辑消息
  // 需求: 3.2 - 编辑后删除后续消息并重新发送
  editMessage: async (
    windowId: string,
    subTopicId: string,
    messageId: string,
    newContent: string
  ) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      set({ error: '窗口不存在' });
      return;
    }

    const subTopic = window.subTopics.find((st) => st.id === subTopicId);
    if (!subTopic) {
      set({ error: '子话题不存在' });
      return;
    }

    // 找到要编辑的消息索引
    const messageIndex = subTopic.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      set({ error: '消息不存在' });
      return;
    }

    const originalMessage = subTopic.messages[messageIndex];
    if (!originalMessage || originalMessage.role !== 'user') {
      set({ error: '只能编辑用户消息' });
      return;
    }

    // 截断消息列表，删除该消息之后的所有消息
    // 需求: 3.2 - Property 5: 消息编辑后截断
    const truncatedMessages = subTopic.messages.slice(0, messageIndex);

    // 更新子话题
    const updatedSubTopic: SubTopic = {
      ...subTopic,
      messages: truncatedMessages,
      updatedAt: Date.now(),
    };

    const updatedSubTopics = window.subTopics.map((st) =>
      st.id === subTopicId ? updatedSubTopic : st
    );

    const updatedWindow: ChatWindow = {
      ...window,
      subTopics: updatedSubTopics,
      updatedAt: Date.now(),
    };

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? updatedWindow : w
      ),
    }));

    // 保存窗口
    await saveChatWindow(updatedWindow);

    // 重新发送编辑后的消息
    const { useSettingsStore } = await import('./settings');
    const settingsState = useSettingsStore.getState();
    
    await get().sendMessage(
      windowId,
      subTopicId,
      newContent,
      originalMessage.attachments,
      {
        endpoint: settingsState.apiEndpoint,
        apiKey: settingsState.apiKey,
        model: window.config.model,
      }
    );
  },

  // 重新生成 AI 消息
  // 需求: 4.1, 4.3 - 使用相同上下文重新请求，保持消息 ID 不变
  regenerateMessage: async (
    windowId: string,
    subTopicId: string,
    messageId: string
  ) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    if (!window) {
      set({ error: '窗口不存在' });
      return;
    }

    const subTopic = window.subTopics.find((st) => st.id === subTopicId);
    if (!subTopic) {
      set({ error: '子话题不存在' });
      return;
    }

    // 找到要重新生成的消息索引
    const messageIndex = subTopic.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      set({ error: '消息不存在' });
      return;
    }

    const originalMessage = subTopic.messages[messageIndex];
    if (!originalMessage || originalMessage.role !== 'model') {
      set({ error: '只能重新生成 AI 消息' });
      return;
    }

    // 获取该消息之前的所有消息作为上下文
    // 需求: 4.1 - Property 7: 重新生成上下文一致性
    const contextMessages = subTopic.messages.slice(0, messageIndex);

    // 创建 AbortController 用于取消请求 - 需求: 5.1, 5.2
    const abortController = new AbortController();

    set({ isSending: true, error: null, streamingText: '', currentRequestController: abortController });

    try {
      // 获取 API 配置
      const { useSettingsStore } = await import('./settings');
      const settingsState = useSettingsStore.getState();
      
      const effectiveApiConfig: ApiConfig = {
        endpoint: settingsState.apiEndpoint,
        apiKey: settingsState.apiKey,
        model: window.config.model,
      };

      // 获取流式设置
      const { resolveStreamingEnabled } = await import('../services/streaming');
      const streamingEnabled = resolveStreamingEnabled(window.config, settingsState.getFullSettings());

      // 获取模型的有效高级参数配置
      const effectiveAdvancedConfig = useModelStore.getState().getEffectiveConfig(window.config.model);

      // 转换消息为 Gemini API 格式
      const geminiContents = messagesToGeminiContents(contextMessages);

      let fullResponse = '';
      let thoughtSummary: string | undefined;
      // 需求: 8.2, 8.3, 8.4 - 耗时数据
      let duration: number | undefined;
      let ttfb: number | undefined;

      if (streamingEnabled) {
        // 需求: 5.2 - 传递 AbortSignal 用于取消请求
        const result = await sendMessageWithThoughts(
          geminiContents,
          effectiveApiConfig,
          window.config.generationConfig,
          window.config.safetySettings,
          window.config.systemInstruction,
          (chunk) => {
            fullResponse += chunk;
            set({ streamingText: fullResponse });
          },
          effectiveAdvancedConfig,
          abortController.signal
        );
        fullResponse = result.text;
        thoughtSummary = result.thoughtSummary;
        // 需求: 8.4 - 保存耗时数据
        duration = result.duration;
        ttfb = result.ttfb;
      } else {
        fullResponse = await sendGeminiMessageNonStreaming(
          geminiContents,
          effectiveApiConfig,
          window.config.generationConfig,
          window.config.safetySettings,
          window.config.systemInstruction,
          effectiveAdvancedConfig
        );
      }

      // 更新消息内容，保持 ID 不变
      // 需求: 4.3, 8.4 - Property 8: 重新生成消息替换
      const updatedMessage: Message = {
        ...originalMessage,
        content: fullResponse,
        timestamp: Date.now(),
        thoughtSummary,
        // 需求: 8.4 - 保存耗时数据
        duration,
        ttfb,
      };

      const updatedMessages = [...subTopic.messages];
      updatedMessages[messageIndex] = updatedMessage;

      const finalSubTopic: SubTopic = {
        ...subTopic,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      const finalSubTopics = window.subTopics.map((st) =>
        st.id === subTopicId ? finalSubTopic : st
      );

      const finalWindow: ChatWindow = {
        ...window,
        subTopics: finalSubTopics,
        updatedAt: Date.now(),
      };

      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === windowId ? finalWindow : w
        ),
        isSending: false,
        streamingText: '',
        currentRequestController: null,
      }));

      await saveChatWindow(finalWindow);
    } catch (error) {
      // 需求: 5.3, 5.4 - 处理请求取消，保留部分响应
      if (error instanceof GeminiRequestCancelledWithThoughtsError) {
        storeLogger.info('重新生成请求已取消，保存部分响应', {
          partialResponseLength: error.partialResponse.length,
          windowId,
          subTopicId,
          messageId,
        });

        // 如果有部分响应，更新消息内容
        if (error.partialResponse.length > 0) {
          const partialUpdatedMessage: Message = {
            ...originalMessage,
            content: error.partialResponse,
            timestamp: Date.now(),
            thoughtSummary: error.partialThought || undefined,
          };

          const partialUpdatedMessages = [...subTopic.messages];
          partialUpdatedMessages[messageIndex] = partialUpdatedMessage;

          const partialFinalSubTopic: SubTopic = {
            ...subTopic,
            messages: partialUpdatedMessages,
            updatedAt: Date.now(),
          };

          const partialFinalSubTopics = window.subTopics.map((st) =>
            st.id === subTopicId ? partialFinalSubTopic : st
          );

          const partialFinalWindow: ChatWindow = {
            ...window,
            subTopics: partialFinalSubTopics,
            updatedAt: Date.now(),
          };

          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? partialFinalWindow : w
            ),
            isSending: false,
            streamingText: '',
            currentRequestController: null,
          }));

          await saveChatWindow(partialFinalWindow);
        } else {
          // 没有部分响应，保留原消息
          set({
            isSending: false,
            streamingText: '',
            currentRequestController: null,
          });
        }
        return;
      }

      storeLogger.error('重新生成消息失败', {
        error: error instanceof Error ? error.message : '未知错误',
        windowId,
        subTopicId,
        messageId,
      });

      let errorMessage = '重新生成失败';
      if (error instanceof GeminiApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // 需求: 4.4 - 重新生成失败时保留原消息
      set({
        isSending: false,
        error: errorMessage,
        streamingText: '',
        currentRequestController: null,
      });
    }
  },

  // 获取当前对话的累计 Token 使用量
  // 需求: 7.3 - Property 14: Token 累计计算
  getTotalTokenUsage: (windowId: string, subTopicId: string) => {
    const state = get();
    const window = state.windows.find((w) => w.id === windowId);
    
    // 默认返回零值
    const defaultUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    
    if (!window) {
      return defaultUsage;
    }

    const subTopic = window.subTopics.find((st) => st.id === subTopicId);
    if (!subTopic) {
      return defaultUsage;
    }

    // 累计所有消息的 Token 使用量
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const message of subTopic.messages) {
      if (message.tokenUsage) {
        totalPromptTokens += message.tokenUsage.promptTokens || 0;
        totalCompletionTokens += message.tokenUsage.completionTokens || 0;
      }
    }

    return {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    };
  },
}));
