/**
 * 虚拟滚动消息列表组件
 * 需求: 1.1, 1.3, 1.4, 1.5 - 虚拟滚动、自动滚动、动态高度支持
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message, Attachment } from '../../types/models';
import { useReducedMotion } from '../motion';
import { ThoughtSummaryCard } from './ThoughtSummaryCard';

// ============ 类型定义 ============

/**
 * 虚拟滚动配置接口
 */
export interface VirtualScrollConfig {
  /** 预渲染缓冲区大小（上下各多渲染的项数） */
  overscan: number;
  /** 估算的单项高度（用于初始计算） */
  estimatedItemHeight: number;
}

/**
 * 虚拟消息列表 Props
 */
export interface VirtualMessageListProps {
  /** 消息列表 */
  messages: Message[];
  /** 是否正在发送 */
  isSending?: boolean;
  /** 流式响应文本 */
  streamingText?: string;
  /** 渲染消息内容的函数 */
  renderContent?: (content: string) => React.ReactNode;
  /** 消息编辑回调 */
  onEditMessage?: (messageId: string, newContent: string) => void;
  /** 消息重新生成回调 */
  onRegenerateMessage?: (messageId: string) => void;
  /** 虚拟滚动配置 */
  config?: Partial<VirtualScrollConfig>;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: VirtualScrollConfig = {
  overscan: 5,
  estimatedItemHeight: 120,
};

// ============ 主组件 ============

/**
 * 虚拟滚动消息列表组件
 * 
 * 需求:
 * - 1.1: 使用虚拟滚动技术只渲染可视区域内的消息项
 * - 1.3: 新消息到达时自动滚动到底部
 * - 1.4: 用户向上滚动时暂停自动滚动
 * - 1.5: 正确计算并渲染动态高度的消息项
 */
export function VirtualMessageList({
  messages,
  isSending = false,
  streamingText = '',
  renderContent,
  onEditMessage,
  onRegenerateMessage,
  config: userConfig,
}: VirtualMessageListProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const parentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  
  // 是否在底部状态（用于自动滚动控制）
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 上一次消息数量（用于检测新消息）
  const prevMessageCountRef = useRef(messages.length);


  // 计算总项数（消息 + 流式响应 + 加载指示器）
  const totalCount = messages.length + (isSending ? 1 : 0);

  // 虚拟化器配置
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => config.estimatedItemHeight,
    overscan: config.overscan,
    // 启用动态高度测量
    measureElement: (element) => {
      return element.getBoundingClientRect().height;
    },
  });

  // 检测滚动位置，判断是否在底部
  const handleScroll = useCallback(() => {
    const container = parentRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // 允许 50px 的误差范围
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    if (!parentRef.current) return;
    
    const container = parentRef.current;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reducedMotion || !smooth ? 'auto' : 'smooth',
    });
  }, [reducedMotion]);

  // 新消息到达时自动滚动（仅当在底部时）
  // 需求: 1.3, 1.4
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    // 检测到新消息
    if (currentCount > prevCount) {
      if (isAtBottom) {
        // 在底部时自动滚动
        requestAnimationFrame(() => scrollToBottom(true));
      }
    }
    
    prevMessageCountRef.current = currentCount;
  }, [messages.length, isAtBottom, scrollToBottom]);

  // 流式响应时持续滚动到底部
  useEffect(() => {
    if (isSending && streamingText && isAtBottom) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [streamingText, isSending, isAtBottom, scrollToBottom]);

  // 渲染内容（默认直接显示文本）
  const renderMessageContent = useCallback((content: string) => {
    if (renderContent) {
      return renderContent(content);
    }
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }, [renderContent]);

  // 获取虚拟项
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
      onScroll={handleScroll}
    >
      {/* 空状态 */}
      {messages.length === 0 && !isSending && (
        <EmptyState />
      )}

      {/* 虚拟滚动容器 */}
      {totalCount > 0 && (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const index = virtualItem.index;
            const isStreamingItem = index === messages.length && isSending;
            const message = isStreamingItem ? null : messages[index];

            return (
              <div
                key={virtualItem.key}
                data-index={index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="pb-4"
              >
                {isStreamingItem ? (
                  // 流式响应或加载指示器
                  <StreamingMessage
                    streamingText={streamingText}
                    renderContent={renderMessageContent}
                  />
                ) : message ? (
                  // 普通消息
                  <MessageItem
                    message={message}
                    renderContent={renderMessageContent}
                    isLast={index === messages.length - 1}
                    reducedMotion={reducedMotion}
                    onEdit={onEditMessage}
                    onRegenerate={onRegenerateMessage}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ============ 子组件 ============

/**
 * 流式响应消息组件
 */
interface StreamingMessageProps {
  streamingText: string;
  renderContent: (content: string) => React.ReactNode;
}

function StreamingMessage({ streamingText, renderContent }: StreamingMessageProps) {
  return (
    <div className="flex gap-3 animate-fadeIn">
      <Avatar role="model" />
      <div className="flex-1 min-w-0 max-w-[85%]">
        <MessageBubble isUser={false}>
          {streamingText ? (
            <>
              {renderContent(streamingText)}
              <TypingCursor />
            </>
          ) : (
            <TypingIndicator />
          )}
        </MessageBubble>
      </div>
    </div>
  );
}

/**
 * 消息气泡组件
 */
interface MessageBubbleProps {
  isUser: boolean;
  children: React.ReactNode;
}

function MessageBubble({ isUser, children }: MessageBubbleProps) {
  return (
    <div
      className={`
        px-4 py-3 rounded-2xl
        ${isUser
          ? 'message-user rounded-br-md shadow-md shadow-green-500/20 dark:shadow-green-400/10'
          : 'message-ai rounded-bl-md shadow-sm shadow-neutral-200/50 dark:shadow-neutral-900/50'
        }
      `}
    >
      {children}
    </div>
  );
}

/**
 * 单条消息组件
 */
interface MessageItemProps {
  message: Message;
  renderContent: (content: string) => React.ReactNode;
  isLast: boolean;
  reducedMotion: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: (messageId: string) => void;
}

function MessageItem({ 
  message, 
  renderContent, 
  isLast, 
  reducedMotion,
  onEdit,
  onRegenerate,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const [showTimestamp, setShowTimestamp] = useState(false);

  const transitionStyle = reducedMotion
    ? {}
    : { transition: 'all 150ms ease-out' };

  return (
    <div 
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <Avatar role={message.role} />
      <div className={`flex-1 min-w-0 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* 附件预览 */}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentList attachments={message.attachments} isUser={isUser} />
        )}
        
        {/* 思维链卡片 */}
        {!isUser && message.thoughtSummary && (
          <ThoughtSummaryCard content={message.thoughtSummary} defaultExpanded={true} />
        )}
        
        {/* 消息内容 */}
        {message.content && (
          <MessageBubble isUser={isUser}>
            {renderContent(message.content)}
          </MessageBubble>
        )}

        {/* 时间戳 - 悬停显示 */}
        <div
          className={`
            text-xs text-neutral-400 dark:text-neutral-500 mt-1 px-1
            ${isUser ? 'text-right' : 'text-left'}
          `}
          style={{
            ...transitionStyle,
            opacity: showTimestamp || isLast ? 1 : 0,
            transform: showTimestamp || isLast ? 'translateY(0)' : 'translateY(-4px)',
          }}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

/**
 * 头像组件
 */
function Avatar({ role }: { role: 'user' | 'model' }) {
  const isUser = role === 'user';

  return (
    <div
      className={`
        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm
        ${isUser
          ? 'bg-brand text-white'
          : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
        }
      `}
    >
      {isUser ? (
        <UserIcon className="w-5 h-5" />
      ) : (
        <BotIcon className="w-5 h-5" />
      )}
    </div>
  );
}

/**
 * 附件列表组件
 */
interface AttachmentListProps {
  attachments: Attachment[];
  isUser: boolean;
}

function AttachmentList({ attachments, isUser }: AttachmentListProps) {
  return (
    <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
      {attachments.map((attachment) => (
        <AttachmentPreview key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

/**
 * 附件预览组件
 */
function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <div className="relative group">
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="
            max-w-[200px] max-h-[200px] rounded-xl object-cover 
            cursor-pointer hover:opacity-90 transition-opacity
            shadow-md
          "
          onClick={() => {
            const win = window.open();
            if (win) {
              win.document.write(`
                <html>
                  <head><title>${attachment.name}</title></head>
                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                    <img src="data:${attachment.mimeType};base64,${attachment.data}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                  </body>
                </html>
              `);
            }
          }}
        />
        <div className="
          absolute bottom-1 left-1 right-1 
          bg-black/60 text-white text-xs px-2 py-1 rounded-lg 
          truncate opacity-0 group-hover:opacity-100 transition-opacity
          backdrop-blur-sm
        ">
          {attachment.name}
        </div>
      </div>
    );
  }

  return (
    <div className="
      flex items-center gap-2 
      bg-neutral-100 dark:bg-neutral-700 
      rounded-xl px-3 py-2 shadow-sm
    ">
      <FileIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[150px]">
          {attachment.name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatFileSize(attachment.size)}
        </p>
      </div>
    </div>
  );
}


/**
 * 空状态组件
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center pt-24 pb-12">
      <div className="
        w-16 h-16 rounded-2xl 
        bg-gradient-to-br from-green-500 to-emerald-600 
        flex items-center justify-center mb-4
        shadow-lg shadow-green-500/30
      ">
        <BotIcon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        开始新对话
      </h3>
      <p className="text-neutral-500 dark:text-neutral-400 max-w-sm">
        在下方输入消息，开始与 Gemini AI 对话。支持发送图片和文件。
      </p>
    </div>
  );
}

/**
 * 打字指示器动画组件
 */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span 
        className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" 
        style={{ animationDelay: '0ms', animationDuration: '600ms' }} 
      />
      <span 
        className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" 
        style={{ animationDelay: '150ms', animationDuration: '600ms' }} 
      />
      <span 
        className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" 
        style={{ animationDelay: '300ms', animationDuration: '600ms' }} 
      />
    </div>
  );
}

/**
 * 打字光标组件
 */
function TypingCursor() {
  return (
    <span className="
      inline-block w-0.5 h-4 ml-0.5 
      bg-brand
      animate-pulse
    " />
  );
}

// ============ 图标组件 ============

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

// ============ 工具函数 ============

/**
 * 格式化时间戳
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============ 导出工具函数（用于测试） ============

/**
 * 计算虚拟滚动渲染数量
 * 用于属性测试验证
 */
export function calculateVisibleCount(
  totalMessages: number,
  viewportHeight: number,
  estimatedItemHeight: number,
  overscan: number
): number {
  if (totalMessages === 0) return 0;
  
  // 可视区域内的项数
  const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight);
  // 加上缓冲区
  const totalVisible = visibleCount + 2 * overscan;
  // 不能超过总数
  return Math.min(totalVisible, totalMessages);
}

export default VirtualMessageList;
