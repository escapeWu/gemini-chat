/**
 * 鉴权守卫组件
 * 未登录时显示登录页面
 * Requirements: 5.1, 5.7
 */

import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/auth';
import { LoginPage } from './LoginPage';
import { PasswordResetModal } from './PasswordResetModal';

export interface AuthGuardProps {
  /** 子组件 */
  children: React.ReactNode;
}

/**
 * 鉴权守卫
 * 包裹需要保护的路由/组件
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { 
    isAuthenticated, 
    needsPasswordReset, 
    initialized, 
    isLoading,
    initialize 
  } = useAuthStore();

  // 初始化鉴权状态
  useEffect(() => {
    if (!initialized && !isLoading) {
      initialize();
    }
  }, [initialized, isLoading, initialize]);

  // 显示加载状态
  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          <p className="text-neutral-500 dark:text-neutral-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录时显示登录页面
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 已登录但需要重置密码
  return (
    <>
      {children}
      <PasswordResetModal isOpen={needsPasswordReset} />
    </>
  );
}

// ============================================
// 图标组件
// ============================================

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

export default AuthGuard;
