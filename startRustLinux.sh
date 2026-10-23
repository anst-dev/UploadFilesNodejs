#!/usr/bin/env bash

# Chuyển về đúng thư mục chứa script
cd "$(dirname "$0")"

PORT=2024
if [ -f .env ]; then
  ENV_PORT=$(grep -E '^PORT=' .env | cut -d '=' -f2 | tr -d '\r')
  if [ -n "$ENV_PORT" ]; then
    PORT=$ENV_PORT
  fi
fi

echo "=============================================="
echo "[1/3] Đóng tiến trình cũ đang chiếm port $PORT..."
echo "=============================================="

# Đóng tiến trình chiếm cổng PORT nếu có
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1
elif command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti tcp:"$PORT")
  if [ -n "$PID" ]; then
    kill -9 $PID >/dev/null 2>&1
  fi
fi

# Đóng tiến trình node hoặc binary cũ nếu còn chạy
pkill -f "upload_files_linux" >/dev/null 2>&1
pkill -f "node.*server.js" >/dev/null 2>&1

echo "[2/3] Kiểm tra file binary Linux..."
if [ ! -f "./upload_files_linux" ]; then
  echo "Chưa thấy file binary, đang build bằng cargo..."
  cargo build --release
  cp target/release/upload_files_rust ./upload_files_linux
  chmod +x ./upload_files_linux
fi

if [ ! -d "uploads" ]; then
  mkdir -p uploads
fi

echo "[3/3] Khởi chạy Upload Files Server (Rust Version)..."
./upload_files_linux
