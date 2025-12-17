/**
 * 应用启动入口
 * 需求: 11.1, 2.1
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { appLogger } from './services/logger';

// 输出启动日志
// 需求: 2.1
appLogger.info('Gemini Chat 应用启动中...');

// 获取根元素
const rootElement = document.getElementById('root');

if (!rootElement) {
  appLogger.error('找不到根元素 #root');
  throw new Error('找不到根元素 #root');
}

// 创建 React 根节点并渲染应用
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

appLogger.info('应用渲染完成');
