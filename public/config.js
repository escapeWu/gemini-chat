// 运行时配置注入
// Docker 启动时会替换这个文件中的占位符
window.__APP_CONFIG__ = {
  AUTH_PASSWORD: '__AUTH_PASSWORD__'
};

// 如果是占位符，则设为 undefined
if (window.__APP_CONFIG__.AUTH_PASSWORD === '__AUTH_PASSWORD__') {
  window.__APP_CONFIG__.AUTH_PASSWORD = undefined;
}
