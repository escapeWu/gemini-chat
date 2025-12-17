/**
 * 消息输入组件
 * 现代化设计，支持自动高度调整和丰富的交互反馈
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Attachment } from '../types/models';
import { validateFile, fileToBase64, getFileMimeType, isImageFile, formatFileSize } from '../services/file';
import { useReducedMotion } from './motion';
import { durationValues, easings, touchTargets } from '../design/tokens';

interface MessageInputProps {
  /** 发送消息回调 */
  onSend: (content: string, attachments?: Attachment[]) => void;
  /** 取消请求回调 - 需求: 5.1 */
  onCancel?: () => void;
  /** 是否正在发送 */
  isSending?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示扩展工具栏 */
  showExtendedToolbar?: boolean;
}

// 输入框高度限制常量（用于属性测试）
export const INPUT_MIN_ROWS = 1;
export const INPUT_MAX_ROWS = 6;
export const LINE_HEIGHT_PX = 24; // 每行高度（像素）

/**
 * 计算输入框应有的高度
 * 用于属性测试验证
 */
export function calculateInputHeight(content: string): number {
  const lineCount = content.split('\n').length;
  const clampedLines = Math.max(INPUT_MIN_ROWS, Math.min(lineCount, INPUT_MAX_ROWS));
  return clampedLines * LINE_HEIGHT_PX;
}

/**
 * 消息输入组件
 * 支持多行文本输入、图片和文件上传、拖拽上传
 * 
 * Requirements:
 * - 9.1: 圆角设计，微妙边框和阴影
 * - 9.2: 焦点高亮边框动画
 * - 9.3: 自动调整高度（1-6行）
 * - 9.4: 发送按钮图标设计，悬停和点击动画
 * - 9.5: 发送时显示加载动画
 * - 9.6: 附件预览网格布局
 */
export function MessageInput({
  onSend,
  onCancel,
  isSending = false,
  disabled = false,
  placeholder = '输入消息...',
  showExtendedToolbar = true,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // 自动调整文本框高度 - Requirements: 9.3
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = INPUT_MAX_ROWS * LINE_HEIGHT_PX;
      const minHeight = INPUT_MIN_ROWS * LINE_HEIGHT_PX;
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, Math.min(scrollHeight, maxHeight))}px`;
    }
  }, [content]);

  // 清除错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);



  // 处理文件选择
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newAttachments: Attachment[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || '文件验证失败');
        continue;
      }

      try {
        const mimeType = getFileMimeType(file);
        const base64Data = await fileToBase64(file);
        
        const attachment: Attachment = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: isImageFile(mimeType) ? 'image' : 'file',
          name: file.name,
          mimeType,
          data: base64Data,
          size: file.size,
        };
        
        newAttachments.push(attachment);
      } catch (err) {
        console.error('文件处理失败:', err);
        setError(`文件处理失败: ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  }, []);

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleSend = () => {
    const trimmedContent = content.trim();
    
    if (!trimmedContent && attachments.length === 0) {
      return;
    }

    onSend(trimmedContent, attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachments([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && !disabled) {
        handleSend();
      }
    }
  };

  const isDisabled = disabled || isSending;
  const canSend = (content.trim() || attachments.length > 0) && !isDisabled;

  const transitionStyle = reducedMotion
    ? {}
    : { transition: `all ${durationValues.fast}ms ${easings.easeOut}` };

  return (
    <div
      ref={containerRef}
      className={`
        relative border-t border-neutral-200 dark:border-neutral-700 
        bg-white dark:bg-neutral-900 px-3 py-2 pb-1
        ${isDragging ? 'ring-2 ring-primary-500 ring-inset' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 错误提示 */}
      {error && (
        <div className="
          mb-2 px-3 py-2 rounded-xl
          bg-error-light/10 dark:bg-error-dark/10 
          border border-error-light/20 dark:border-error-dark/20 
          text-sm text-error-light dark:text-error-dark
        ">
          {error}
        </div>
      )}

      {/* 附件预览区域 - Requirements: 9.6 网格布局 */}
      {attachments.length > 0 && (
        <div className="mb-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              onRemove={() => handleRemoveAttachment(attachment.id)}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      )}

      {/* 拖拽提示 - Requirements: 9.6 */}
      {isDragging && (
        <div className="
          absolute inset-2 flex items-center justify-center 
          bg-primary-500/10 border-2 border-dashed border-primary-500 
          rounded-2xl z-10 backdrop-blur-sm
        ">
          <div className="text-center">
            <UploadIcon className="w-10 h-10 mx-auto mb-2 text-primary-500" />
            <p className="text-primary-600 dark:text-primary-400 font-medium">
              释放以上传文件
            </p>
          </div>
        </div>
      )}

      {/* 输入区域 - Requirements: 7.1, 7.2, 7.3, 7.4 */}
      <div className="flex items-end gap-2">
        {/* 快捷上传按钮（工具栏隐藏时显示） */}
        {!showExtendedToolbar && (
          <div className="flex gap-1 flex-shrink-0">
            <IconButton
              onClick={handleImageClick}
              disabled={isDisabled}
              title="上传图片"
              reducedMotion={reducedMotion}
            >
              <ImageIcon className="w-5 h-5" />
            </IconButton>
            
            <IconButton
              onClick={handleFileClick}
              disabled={isDisabled}
              title="上传文件"
              className="hidden sm:flex"
              reducedMotion={reducedMotion}
            >
              <PaperclipIcon className="w-5 h-5" />
            </IconButton>
          </div>
        )}

        {/* 文本输入框 - Requirements: 9.1, 9.2 */}
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className={`
              w-full resize-none rounded-2xl px-4 py-3
              bg-neutral-50 dark:bg-neutral-800
              text-neutral-900 dark:text-neutral-100 
              placeholder-neutral-400 dark:placeholder-neutral-500
              disabled:opacity-50 disabled:cursor-not-allowed
              text-base leading-6
              border-2 outline-none
              ${isFocused
                ? 'border-primary-500 shadow-lg shadow-primary-500/10'
                : 'border-neutral-200 dark:border-neutral-700 shadow-sm'
              }
            `}
            style={{
              ...transitionStyle,
              minHeight: `${INPUT_MIN_ROWS * LINE_HEIGHT_PX + 24}px`,
            }}
          />
        </div>

        {/* 发送/取消按钮 - Requirements: 9.4, 5.1 */}
        {isSending && onCancel ? (
          // 取消按钮 - 需求: 5.1 在发送状态时显示取消按钮
          <button
            type="button"
            onClick={onCancel}
            className="
              p-3 rounded-2xl flex-shrink-0 touch-manipulation
              flex items-center justify-center
              bg-error-light hover:bg-red-600 active:scale-95 
              text-white shadow-md shadow-error-light/30 
              hover:shadow-lg hover:shadow-error-light/40
            "
            style={{ ...transitionStyle, minWidth: touchTargets.minimum, minHeight: touchTargets.minimum }}
            title="取消请求"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        ) : (
          // 发送按钮 - Requirements: 9.4 主题色
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`
              p-3 rounded-2xl flex-shrink-0 touch-manipulation
              flex items-center justify-center
              ${canSend
                ? 'bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-md shadow-primary-500/30 hover:shadow-lg hover:shadow-primary-500/40'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              }
            `}
            style={{ ...transitionStyle, minWidth: touchTargets.minimum, minHeight: touchTargets.minimum }}
            title="发送消息"
          >
            {isSending ? (
              <LoadingSpinner className="w-5 h-5" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* 工具栏 - 移到输入框下方 - Requirements: 7.2, 7.3 */}
      {showExtendedToolbar && (
        <div className="flex items-center gap-1 mt-2 pt-1">
          {/* 附件按钮 */}
          <ToolbarButton
            onClick={handleImageClick}
            disabled={isDisabled}
            title="上传图片"
            reducedMotion={reducedMotion}
          >
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={handleFileClick}
            disabled={isDisabled}
            title="上传文件"
            reducedMotion={reducedMotion}
          >
            <PaperclipIcon className="w-4 h-4" />
          </ToolbarButton>

          <div className="flex-1" />

          {/* 提示文字 */}
          <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:inline">
            Enter 发送 · Shift+Enter 换行
          </span>
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.js,.ts,.jsx,.tsx,.py,.java,.css,.html,.json,.xml,.md"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}

/**
 * 工具栏按钮组件 - Requirements: 9.2
 */
interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  reducedMotion: boolean;
}

function ToolbarButton({ onClick, disabled, title, children, active = false, reducedMotion }: ToolbarButtonProps) {
  const transitionStyle = reducedMotion
    ? {}
    : { transition: `all ${durationValues.fast}ms ${easings.easeOut}` };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        p-2 rounded-lg flex items-center justify-center touch-manipulation
        ${active
          ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        }
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      style={transitionStyle}
      title={title}
    >
      {children}
    </button>
  );
}

/**
 * 图标按钮组件
 */
interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
  reducedMotion: boolean;
}

function IconButton({ onClick, disabled, title, children, className = '', reducedMotion }: IconButtonProps) {
  const transitionStyle = reducedMotion
    ? {}
    : { transition: `all ${durationValues.fast}ms ${easings.easeOut}` };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        p-2 rounded-xl flex items-center justify-center touch-manipulation
        text-neutral-500 dark:text-neutral-400
        hover:text-neutral-700 dark:hover:text-neutral-200
        hover:bg-neutral-100 dark:hover:bg-neutral-800
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      style={{ ...transitionStyle, minWidth: touchTargets.minimum, minHeight: touchTargets.minimum }}
      title={title}
    >
      {children}
    </button>
  );
}

/**
 * 附件预览组件
 */
interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: () => void;
  reducedMotion: boolean;
}

function AttachmentPreview({ attachment, onRemove, reducedMotion }: AttachmentPreviewProps) {
  const transitionStyle = reducedMotion
    ? {}
    : { transition: `all ${durationValues.fast}ms ${easings.easeOut}` };

  if (attachment.type === 'image') {
    return (
      <div className="relative group aspect-square">
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="w-full h-full object-cover rounded-xl"
        />
        <button
          onClick={onRemove}
          className="
            absolute -top-2 -right-2 
            bg-error-light hover:bg-red-600 
            text-white rounded-full 
            flex items-center justify-center 
            opacity-0 group-hover:opacity-100
            shadow-md touch-manipulation
          "
          style={{ ...transitionStyle, minWidth: '28px', minHeight: '28px' }}
          title="删除"
        >
          <XIcon className="w-3 h-3" />
        </button>
        <div className="
          absolute bottom-0 left-0 right-0 
          bg-black/60 text-white text-xs px-1.5 py-0.5 
          rounded-b-xl truncate
          backdrop-blur-sm
        ">
          {attachment.name}
        </div>
      </div>
    );
  }

  return (
    <div className="
      relative group col-span-2
      flex items-center gap-2 
      bg-neutral-100 dark:bg-neutral-700 
      rounded-xl px-3 py-2
    ">
      <FileIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
          {attachment.name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="
          p-2 text-neutral-400 hover:text-error-light touch-manipulation
          dark:hover:text-error-dark
        "
        style={{ ...transitionStyle, minWidth: touchTargets.minimum, minHeight: touchTargets.minimum }}
        title="删除"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============ 图标组件 ============

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

/**
 * 停止图标 - 需求: 5.1
 */
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default MessageInput;
