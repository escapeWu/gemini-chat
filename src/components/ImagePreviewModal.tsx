/**
 * 图片预览模态框组件
 * 显示图片放大视图，提供下载和复制功能
 * 需求: 2.3, 2.4, 2.5, 2.6
 */

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedImage } from '../types';

interface ImagePreviewModalProps {
  /** 要预览的图片 */
  image: GeneratedImage | null;
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 图片预览模态框
 * 需求: 2.3, 2.4, 2.5, 2.6
 */
export function ImagePreviewModal({ image, isOpen, onClose }: ImagePreviewModalProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 处理 ESC 键关闭
  // 需求: 2.6
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 锁定背景滚动
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 处理下载
  // 需求: 2.4
  const handleDownload = useCallback(() => {
    if (!image) return;

    try {
      // 创建下载链接
      const link = document.createElement('a');
      link.href = `data:${image.mimeType};base64,${image.data}`;
      
      // 生成文件名
      const extension = image.mimeType.split('/')[1] || 'png';
      const timestamp = new Date(image.createdAt).toISOString().slice(0, 10);
      link.download = `image_${timestamp}_${image.id.slice(0, 8)}.${extension}`;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadStatus('success');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    } catch (error) {
      console.error('下载失败:', error);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    }
  }, [image]);

  // 处理复制到剪贴板
  // 需求: 2.5
  const handleCopy = useCallback(async () => {
    if (!image) return;

    try {
      // 将 base64 转换为 Blob
      const byteCharacters = atob(image.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: image.mimeType });

      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({
          [image.mimeType]: blob,
        }),
      ]);

      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [image]);

  // 处理遮罩点击
  // 需求: 2.6
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen || !image) {
    return null;
  }

  // 构建图片 URL
  const imageUrl = `data:${image.mimeType};base64,${image.data}`;

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
      >
        {/* 头部工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            {/* 下载按钮 */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title="下载图片"
            >
              <DownloadIcon className="h-4 w-4" />
              {downloadStatus === 'success' ? '已下载' : downloadStatus === 'error' ? '下载失败' : '下载'}
            </button>
            {/* 复制按钮 */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title="复制到剪贴板"
            >
              <CopyIcon className="h-4 w-4" />
              {copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制'}
            </button>
          </div>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 图片显示区域 */}
        <div className="flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950 min-h-[300px] max-h-[calc(90vh-120px)] overflow-auto">
          <img
            src={imageUrl}
            alt={image.prompt || '生成的图片'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* 底部信息 */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
            <span>生成时间: {formatTime(image.createdAt)}</span>
            {image.prompt && (
              <span className="truncate max-w-[50%]" title={image.prompt}>
                提示词: {image.prompt}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

/**
 * 下载图标
 */
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

/**
 * 复制图标
 */
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

/**
 * 关闭图标
 */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default ImagePreviewModal;
