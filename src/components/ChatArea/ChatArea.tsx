/**
 * 聊天区域主组件
 * 集成顶部工具栏、子话题标签、消息列表和输入
 * 
 * Requirements: 4.1, 5.1, 5.2, 5.3, 5.4, 6.1, 7.5
 */

import { useState, useCallback } from 'react';
import { useChatWindowStore } from '../../stores/chatWindow';
import { useSettingsStore } from '../../stores/settings';
import { ChatHeader } from './ChatHeader';
import { SubTopicTabs } from './SubTopicTabs';
import { ChatConfigPanel } from './ChatConfigPanel';
import { VirtualMessageList } from './VirtualMessageList';
import { MessageInput } from '../MessageInput';
import { MarkdownRenderer } from '../MarkdownRenderer';
import type { ChatWindowConfig } from '../../types/chatWindow';
import type { Attachment } from '../../types/models';

// ============ 类型定义 ============

export interface ChatAreaProps {
  /** 聊天窗口 ID（可选，默认使用当前活动窗口） */
  windowId?: string;
}

// ============ 主组件 ============

/**
 * 聊天区域主组件
 * 
 * Requirements:
 * - 4.1: 聊天窗口独立配置
 * - 5.1: 子话题对话管理
 * - 6.1: 聊天窗口内置配置面板
 * - 7.5: 移除 ModelParamsBar 组件
 */
export function ChatArea({ windowId: propWindowId }: ChatAreaProps) {
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  // 从 store 获取状态
  const {
    windows,
    activeWindowId,
    isSending,
    streamingText,
    sendMessage,
    cancelRequest,
    createSubTopic,
    deleteSubTopic,
    selectSubTopic,
    updateSubTopic,
    updateWindowConfig,
  } = useChatWindowStore();

  const { apiEndpoint, apiKey } = useSettingsStore();

  // 确定当前窗口 ID
  const currentWindowId = propWindowId || activeWindowId;
  
  // 获取当前窗口
  const currentWindow = currentWindowId
    ? windows.find((w) => w.id === currentWindowId)
    : null;

  // 获取当前子话题
  const currentSubTopic = currentWindow
    ? currentWindow.subTopics.find((st) => st.id === currentWindow.activeSubTopicId)
    : null;

  // 处理发送消息
  const handleSendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      if (!currentWindowId || !currentWindow) return;

      const subTopicId = currentWindow.activeSubTopicId;
      
      await sendMessage(
        currentWindowId,
        subTopicId,
        content,
        attachments,
        {
          endpoint: apiEndpoint,
          apiKey: apiKey,
          model: currentWindow.config.model,
        }
      );
    },
    [currentWindowId, currentWindow, sendMessage, apiEndpoint, apiKey]
  );

  // 处理创建子话题
  const handleCreateSubTopic = useCallback(() => {
    if (!currentWindowId) return;
    createSubTopic(currentWindowId);
  }, [currentWindowId, createSubTopic]);

  // 处理删除子话题
  const handleDeleteSubTopic = useCallback(
    (subTopicId: string) => {
      if (!currentWindowId) return;
      deleteSubTopic(currentWindowId, subTopicId);
    },
    [currentWindowId, deleteSubTopic]
  );

  // 处理选择子话题
  const handleSelectSubTopic = useCallback(
    (subTopicId: string) => {
      if (!currentWindowId) return;
      selectSubTopic(currentWindowId, subTopicId);
    },
    [currentWindowId, selectSubTopic]
  );

  // 处理重命名子话题
  const handleRenameSubTopic = useCallback(
    (subTopicId: string, newTitle: string) => {
      if (!currentWindowId) return;
      updateSubTopic(currentWindowId, subTopicId, { title: newTitle });
    },
    [currentWindowId, updateSubTopic]
  );

  // 处理配置更新
  const handleConfigChange = useCallback(
    (config: Partial<ChatWindowConfig>) => {
      if (!currentWindowId) return;
      updateWindowConfig(currentWindowId, config);
    },
    [currentWindowId, updateWindowConfig]
  );

  // 打开配置面板
  const handleOpenConfig = useCallback(() => {
    setIsConfigPanelOpen(true);
  }, []);

  // 关闭配置面板
  const handleCloseConfig = useCallback(() => {
    setIsConfigPanelOpen(false);
  }, []);

  // 渲染 Markdown 内容
  const renderContent = useCallback((content: string) => {
    return <MarkdownRenderer content={content} />;
  }, []);

  // 如果没有选中窗口，显示空状态（居中显示）
  if (!currentWindow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-neutral-900">
        <EmptyWindowState />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden">
      {/* 顶部工具栏（简化版） - Requirements: 6.1, 6.2, 6.3 */}
      <ChatHeader
        windowId={currentWindow.id}
        title={currentWindow.title}
        onOpenConfig={handleOpenConfig}
      />

      {/* 子话题标签栏 - Requirements: 5.1 */}
      <SubTopicTabs
        windowId={currentWindow.id}
        subTopics={currentWindow.subTopics}
        activeSubTopicId={currentWindow.activeSubTopicId}
        onSelect={handleSelectSubTopic}
        onCreate={handleCreateSubTopic}
        onDelete={handleDeleteSubTopic}
        onRename={handleRenameSubTopic}
      />

      {/* 虚拟滚动消息列表 - Requirements: 1.1, 5.2, 5.3 */}
      <VirtualMessageList
        messages={currentSubTopic?.messages || []}
        isSending={isSending}
        streamingText={streamingText}
        renderContent={renderContent}
      />

      {/* 消息输入 - Requirements: 5.1, 5.4 */}
      {/* 注意：已移除 ModelParamsBar 组件 - Requirements: 7.5 */}
      <MessageInput
        onSend={handleSendMessage}
        onCancel={cancelRequest}
        isSending={isSending}
        disabled={!apiKey}
        placeholder={
          !apiKey
            ? '请先在设置中配置 API 密钥'
            : '输入消息... (Enter 发送, Shift+Enter 换行)'
        }
      />

      {/* 毛玻璃配置面板 - Requirements: 6.4, 6.5 */}
      <ChatConfigPanel
        isOpen={isConfigPanelOpen}
        onClose={handleCloseConfig}
        config={currentWindow.config}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}

/**
 * 空窗口状态组件 - 居中显示
 */
function EmptyWindowState() {
  const { createWindow } = useChatWindowStore();

  const handleCreateWindow = () => {
    createWindow();
  };

  return (
    <div className="text-center px-4">
      {/* Gemini 图标 - 使用主题色 */}
      <div className="
        w-20 h-20 mx-auto mb-6 rounded-2xl
        bg-gradient-to-br from-primary-400 to-primary-600
        flex items-center justify-center
        shadow-lg shadow-primary-500/30
      ">
        <GeminiIcon className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        开始新程序
      </h2>
      
      <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm mx-auto">
        选择一个现有的程序，或创建一个新的程序开始与 AI 交流
      </p>
      
      <button
        onClick={handleCreateWindow}
        className="
          inline-flex items-center gap-2 px-6 py-3
          bg-primary-500 hover:bg-primary-600 
          text-white font-medium rounded-xl
          shadow-md shadow-primary-500/30
          transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/40
          active:scale-95
        "
      >
        <PlusIcon className="w-5 h-5" />
        新建程序
      </button>
    </div>
  );
}

// ============ 图标组件 ============

/**
 * Gemini 官方星形图标
 * 使用 SVG 格式的四角星形图标，与主题色协调
 * Requirements: 8.1, 8.2, 8.3
 */
function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      {/* Gemini 官方四角星形图标 */}
      <path
        d="M14 0C14 7.732 7.732 14 0 14C7.732 14 14 20.268 14 28C14 20.268 20.268 14 28 14C20.268 14 14 7.732 14 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

export default ChatArea;
