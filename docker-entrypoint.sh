#!/bin/sh

# 替换配置文件中的占位符
CONFIG_FILE="/usr/share/nginx/html/config.js"

if [ -n "$VITE_AUTH_PASSWORD" ]; then
  sed -i "s/__AUTH_PASSWORD__/$VITE_AUTH_PASSWORD/g" $CONFIG_FILE
fi

# 启动 nginx
exec nginx -g 'daemon off;'
