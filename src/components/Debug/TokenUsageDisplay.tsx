/**
 * Token 使用量显示组件
 * 需求: 7.2, 7.3
 * 
 * 显示单条消息的 Token 使用量和对话累计 Token 使用量
 */


import type { TokenUsage } from '../../stores/debug';
import { formatTokenCount, isValidTokenUsage } from '../../services/tokenUsage';

// ============ 类型定义 ============

interface TokenUsageDisplayProps {
  /** Token 使用量数据 */
  tokenUsage: TokenUsage | null | undefined;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface TokenUsageSummaryProps {
  /** 累计 Token 使用量 */
  totalUsage: TokenUsage;
  /** 自定义类名 */
  className?: string;
}

// ============ 单条消息 Token 显示 ============

/**
 * Token 使用量显示
 * 需求: 7.2
 */
export function TokenUsageDisplay({
  tokenUsage,
  compact = false,
  className = '',
}: TokenUsageDisplayProps) {
  // 数据不可用时显示提示
  if (!tokenUsage || !isValidTokenUsage(tokenUsage)) {
    if (compact) {
      return null;
    }
    return (
      <div className={`text-sm text-neutral-500 dark:text-neutral-400 ${className}`}>
        Token 数据不可用
      </div>
    );
  }

  // 紧凑模式
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <TokenIcon />
        <span className="text-neutral-600 dark:text-neutral-400">
          {formatTokenCount(tokenUsage.totalTokens)} tokens
        </span>
      </div>
    );
  }

  // 完整模式
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <TokenIcon />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Token 使用量
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TokenStatItem
          label="输入"
          value={tokenUsage.promptTokens}
          color="text-blue-600 dark:text-blue-400"
        />
        <TokenStatItem
          label="输出"
          value={tokenUsage.completionTokens}
          color="text-green-600 dark:text-green-400"
        />
        <TokenStatItem
          label="总计"
          value={tokenUsage.totalTokens}
          color="text-primary-600 dark:text-primary-400"
          highlight
        />
      </div>
    </div>
  );
}

// ============ 对话累计 Token 显示 ============

/**
 * 对话累计 Token 使用量显示
 * 需求: 7.3
 */
export function TokenUsageSummary({
  totalUsage,
  className = '',
}: TokenUsageSummaryProps) {
  if (!isValidTokenUsage(totalUsage)) {
    return null;
  }

  return (
    <div className={`p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <TokenIcon />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          对话累计 Token
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">输入</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {formatTokenCount(totalUsage.promptTokens)}
            </p>
          </div>
          <div className="text-neutral-300 dark:text-neutral-600">+</div>
          <div className="text-center">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">输出</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatTokenCount(totalUsage.completionTokens)}
            </p>
          </div>
          <div className="text-neutral-300 dark:text-neutral-600">=</div>
          <div className="text-center">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">总计</p>
            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {formatTokenCount(totalUsage.totalTokens)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Token 统计项组件 ============

interface TokenStatItemProps {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}

function TokenStatItem({ label, value, color, highlight }: TokenStatItemProps) {
  return (
    <div className={`text-center p-2 rounded ${highlight ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>
        {formatTokenCount(value)}
      </p>
    </div>
  );
}

// ============ 图标组件 ============

function TokenIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

export default TokenUsageDisplay;
