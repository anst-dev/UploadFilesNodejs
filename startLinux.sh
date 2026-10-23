#!/usr/bin/env bash

# Chuyển về đúng thư mục chứa script
cd "$(dirname "$0")"

PORT=2024
# Lấy PORT từ .env nếu có
if [ -f .env ]; then
  ENV_PORT=$(grep -E '^PORT=' .env | cut -d '=' -f2 | tr -d '\r')
  if [ -n "$ENV_PORT" ]; then
    PORT=$ENV_PORT
  fi
fi

echo "=============================================="
echo "[1/3] Đóng tiến trình cũ đang chiếm port $PORT hoặc node..."
echo "=============================================="

# Đóng tiến trình chiếm cổng PORT nếu có (fuser hoặc lsof hoặc ss)
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1
elif command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti tcp:"$PORT")
  if [ -n "$PID" ]; then
    kill -9 $PID >/dev/null 2>&1
  fi
fi

# Đóng các tiến trình server.js cũ nếu còn chạy
pkill -f "node.*server.js" >/dev/null 2>&1

echo "[2/3] Kiểm tra dependencies & thư mục uploads..."
if [ ! -d "node_modules" ]; then
  echo "Chưa có node_modules, tiến hành cài đặt..."
  npm i
fi

if [ ! -d "uploads" ]; then
  mkdir -p uploads
fi

echo "[3/3] Khởi chạy ứng dụng..."
npm start
