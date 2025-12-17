/**
 * 耗时显示组件
 * 需求: 8.3, 8.4
 * 
 * 显示请求耗时和首字节时间，支持流式响应实时显示
 */

import { useState, useEffect } from 'react';
import { formatDuration, isValidTimingData } from '../../services/timeTracker';

// ============ 类型定义 ============

interface TimingDisplayProps {
  /** 总耗时（毫秒） */
  duration?: number;
  /** 首字节时间（毫秒） */
  ttfb?: number;
  /** 是否正在进行中（用于实时显示） */
  isStreaming?: boolean;
  /** 开始时间戳（用于实时计算） */
  startTime?: number;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============ 主组件 ============

/**
 * 耗时显示
 * 需求: 8.3, 8.4
 */
export function TimingDisplay({
  duration,
  ttfb,
  isStreaming = false,
  startTime,
  compact = false,
  className = '',
}: TimingDisplayProps) {
  // 实时计算耗时
  const [liveElapsed, setLiveElapsed] = useState<number>(0);

  // 流式响应时实时更新
  useEffect(() => {
    if (!isStreaming || !startTime) {
      return;
    }

    const updateElapsed = () => {
      setLiveElapsed(Date.now() - startTime);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 100);

    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  // 确定显示的耗时值
  const displayDuration = isStreaming ? liveElapsed : duration;

  // 无数据时不显示
  if (displayDuration === undefined && ttfb === undefined) {
    return null;
  }

  // 验证数据有效性
  if (displayDuration !== undefined && !isValidTimingData(displayDuration, ttfb)) {
    return null;
  }

  // 紧凑模式
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <ClockIcon />
        <span className="text-neutral-600 dark:text-neutral-400">
          {displayDuration !== undefined ? formatDuration(displayDuration) : '-'}
          {ttfb !== undefined && (
            <span className="text-neutral-400 dark:text-neutral-500 ml-1">
              (TTFB: {formatDuration(ttfb)})
            </span>
          )}
        </span>
        {isStreaming && <StreamingIndicator />}
      </div>
    );
  }

  // 完整模式
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <ClockIcon />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          请求耗时
        </span>
        {isStreaming && <StreamingIndicator />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 首字节时间 */}
        <TimingStatItem
          label="首字节时间 (TTFB)"
          value={ttfb}
          color="text-blue-600 dark:text-blue-400"
        />

        {/* 总耗时 */}
        <TimingStatItem
          label="总耗时"
          value={displayDuration}
          color="text-primary-600 dark:text-primary-400"
          highlight
        />
      </div>
    </div>
  );
}

// ============ 流式响应实时显示组件 ============

interface StreamingTimingProps {
  /** 开始时间戳 */
  startTime: number;
  /** 首字节时间戳（可选） */
  firstByteTime?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 流式响应实时耗时显示
 * 需求: 8.3
 */
export function StreamingTiming({
  startTime,
  firstByteTime,
  className = '',
}: StreamingTimingProps) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    const updateElapsed = () => {
      setElapsed(Date.now() - startTime);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  const ttfb = firstByteTime ? firstByteTime - startTime : undefined;

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      <StreamingIndicator />
      <span className="text-neutral-600 dark:text-neutral-400">
        已用时: {formatDuration(elapsed)}
      </span>
      {ttfb !== undefined && (
        <span className="text-neutral-500 dark:text-neutral-500">
          TTFB: {formatDuration(ttfb)}
        </span>
      )}
    </div>
  );
}

// ============ 耗时统计项组件 ============

interface TimingStatItemProps {
  label: string;
  value?: number;
  color: string;
  highlight?: boolean;
}

function TimingStatItem({ label, value, color, highlight }: TimingStatItemProps) {
  return (
    <div className={`text-center p-2 rounded ${highlight ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>
        {value !== undefined ? formatDuration(value) : '-'}
      </p>
    </div>
  );
}

// ============ 流式指示器组件 ============

function StreamingIndicator() {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      <span className="text-xs text-green-600 dark:text-green-400">进行中</span>
    </span>
  );
}

// ============ 图标组件 ============

function ClockIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default TimingDisplay;
