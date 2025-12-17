/**
 * 消息操作按钮组件
 * 需求: 3.1, 4.1, 7.2, 8.4 - 编辑、复制、重新生成、查看详情按钮
 */

import { useState, useCallback } from 'react';
import type { Message } from '../../types/models';
import { MessageDetailModal } from './MessageDetailModal';

// ============ 类型定义 ============

/**
 * 消息操作按钮 Props
 */
export interface MessageActionsProps {
  /** 消息对象 */
  message: Message;
  /** 是否为用户消息 */
  isUserMessage: boolean;
  /** 编辑回调（仅用户消息） */
  onEdit?: () => void;
  /** 重新生成回调（仅 AI 消息） */
  onRegenerate?: () => void;
  /** 复制回调 */
  onCopy?: () => void;
  /** 是否正在重新生成 */
  isRegenerating?: boolean;
  /** 是否显示（用于悬停显示） */
  visible?: boolean;
}

// ============ 主组件 ============

/**
 * 消息操作按钮组件
 * 
 * 需求:
 * - 3.1: 用户消息显示编辑按钮
 * - 4.1: AI 消息显示重新生成按钮
 * - 7.2, 8.4: 查看详情按钮显示 Token 使用量和耗时
 */
export function MessageActions({
  message,
  isUserMessage,
  onEdit,
  onRegenerate,
  onCopy,
  isRegenerating = false,
  visible = true,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // 处理复制
  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [message.content, onCopy]);

  // 打开详情弹窗
  const handleShowDetail = useCallback(() => {
    setShowDetail(true);
  }, []);

  // 关闭详情弹窗
  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
  }, []);

  // 如果不可见，返回空
  if (!visible) {
    return null;
  }

  return (
    <>
      <div className={`
        flex items-center gap-1 mt-1
        ${isUserMessage ? 'justify-end' : 'justify-start'}
      `}>
        {/* 复制按钮 */}
        <ActionButton
          onClick={handleCopy}
          title={copied ? '已复制' : '复制'}
          disabled={!message.content}
        >
          {copied ? (
            <CheckIcon className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </ActionButton>

        {/* 用户消息：编辑按钮 */}
        {isUserMessage && onEdit && (
          <ActionButton onClick={onEdit} title="编辑消息">
            <EditIcon className="w-3.5 h-3.5" />
          </ActionButton>
        )}

        {/* AI 消息：重新生成按钮 */}
        {!isUserMessage && onRegenerate && (
          <ActionButton 
            onClick={onRegenerate} 
            title="重新生成"
            disabled={isRegenerating}
          >
            <RegenerateIcon className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          </ActionButton>
        )}

        {/* 查看详情按钮 - 需求: 7.2, 8.4 */}
        <ActionButton onClick={handleShowDetail} title="查看详情">
          <InfoIcon className="w-3.5 h-3.5" />
        </ActionButton>
      </div>

      {/* 消息详情弹窗 */}
      <MessageDetailModal
        message={message}
        isOpen={showDetail}
        onClose={handleCloseDetail}
      />
    </>
  );
}

// ============ 子组件 ============

/**
 * 操作按钮基础组件
 */
interface ActionButtonProps {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ActionButton({ onClick, title, disabled = false, children }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="
        p-1.5 rounded-md
        text-neutral-400 hover:text-neutral-600
        dark:text-neutral-500 dark:hover:text-neutral-300
        hover:bg-neutral-100 dark:hover:bg-neutral-700
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {children}
    </button>
  );
}

// ============ 图标组件 ============

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function RegenerateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default MessageActions;
