/**
 * 密码重置对话框组件
 * Requirements: 5.2, 5.3, 5.4
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../stores/auth';
import { passwordsMatch } from '../../services/auth';

export interface PasswordResetModalProps {
  /** 是否打开 */
  isOpen: boolean;
}

/**
 * 密码重置对话框
 * 包含新密码、确认密码输入框
 */
export function PasswordResetModal({ isOpen }: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { resetPassword, isLoading, error: storeError } = useAuthStore();

  // 合并错误信息
  const error = localError || storeError;

  // 处理新密码输入
  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
    setLocalError(null);
  }, []);

  // 处理确认密码输入
  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setLocalError(null);
  }, []);

  // 处理提交
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证密码长度
    if (newPassword.length < 6) {
      setLocalError('密码长度至少为 6 位');
      return;
    }

    // 验证密码匹配
    if (!passwordsMatch(newPassword, confirmPassword)) {
      setLocalError('两次输入的密码不一致');
      return;
    }

    await resetPassword(newPassword, confirmPassword);
  }, [newPassword, confirmPassword, resetPassword]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="w-full max-w-md p-4">
        {/* 对话框卡片 */}
        <div className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-white/20 dark:border-neutral-700/50">
          {/* 标题 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 mb-4">
              <WarningIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              重置密码
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
              您正在使用默认密码，请设置新密码以保护您的数据
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 新密码 */}
            <div>
              <label 
                htmlFor="newPassword" 
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                新密码
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                placeholder="请输入新密码（至少 6 位）"
                disabled={isLoading}
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="请再次输入新密码"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <ErrorIcon className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPassword}
              className={`
                w-full py-3 px-4 rounded-lg font-medium transition-all mt-6
                flex items-center justify-center gap-2
                ${isLoading || !newPassword || !confirmPassword
                  ? 'bg-neutral-300 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
                }
              `}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="w-5 h-5" />
                  <span>保存中...</span>
                </>
              ) : (
                <span>设置新密码</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ============================================
// 图标组件
// ============================================

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default PasswordResetModal;
