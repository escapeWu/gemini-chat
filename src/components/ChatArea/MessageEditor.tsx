/**
 * 消息编辑器组件
 * 需求: 3.1, 3.4 - 消息编辑功能，空内容验证
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message } from '../../types/models';

// ============ 类型定义 ============

/**
 * 消息编辑器 Props
 */
export interface MessageEditorProps {
  /** 原始消息 */
  message: Message;
  /** 提交编辑回调 */
  onSubmit: (newContent: string) => void;
  /** 取消编辑回调 */
  onCancel: () => void;
}

// ============ 工具函数 ============

/**
 * 验证消息内容是否有效
 * 需求: 3.4 - 空消息编辑验证
 * 
 * @param content - 消息内容
 * @returns 是否有效（非空白字符串）
 */
export function validateMessageContent(content: string): boolean {
  // 去除所有空白字符后检查是否为空
  return content.trim().length > 0;
}

// ============ 主组件 ============

/**
 * 消息编辑器组件
 * 
 * 需求:
 * - 3.1: 显示可编辑的文本输入框并预填充原消息内容
 * - 3.4: 空内容验证，阻止提交并显示提示
 */
export function MessageEditor({ message, onSubmit, onCancel }: MessageEditorProps) {
  const [content, setContent] = useState(message.content);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦并选中内容
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // 处理内容变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // 清除错误提示
    if (error) {
      setError(null);
    }
  }, [error]);

  // 处理提交
  const handleSubmit = useCallback(() => {
    // 验证内容
    if (!validateMessageContent(content)) {
      setError('消息内容不能为空');
      return;
    }

    // 如果内容没有变化，直接取消
    if (content.trim() === message.content.trim()) {
      onCancel();
      return;
    }

    onSubmit(content.trim());
  }, [content, message.content, onSubmit, onCancel]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape 取消编辑
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Ctrl/Cmd + Enter 提交
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [onCancel, handleSubmit]);

  return (
    <div className="w-full">
      {/* 编辑区域 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`
            w-full px-4 py-3 rounded-xl resize-none
            bg-white dark:bg-neutral-800
            border-2 transition-colors
            ${error 
              ? 'border-red-500 dark:border-red-400' 
              : 'border-primary-500 dark:border-primary-400'
            }
            focus:outline-none focus:ring-2 focus:ring-primary-500/20
            text-neutral-900 dark:text-neutral-100
            placeholder-neutral-400 dark:placeholder-neutral-500
          `}
          placeholder="输入消息内容..."
          rows={3}
        />
        
        {/* 错误提示 */}
        {error && (
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-xs text-neutral-400 dark:text-neutral-500 mr-auto">
          Ctrl+Enter 提交 · Esc 取消
        </span>
        
        <button
          onClick={onCancel}
          className="
            px-4 py-2 rounded-lg text-sm font-medium
            text-neutral-600 dark:text-neutral-400
            hover:bg-neutral-100 dark:hover:bg-neutral-700
            transition-colors
          "
        >
          取消
        </button>
        
        <button
          onClick={handleSubmit}
          className="
            px-4 py-2 rounded-lg text-sm font-medium
            bg-primary-500 hover:bg-primary-600
            text-white
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          disabled={!validateMessageContent(content)}
        >
          保存并重新发送
        </button>
      </div>
    </div>
  );
}

export default MessageEditor;
