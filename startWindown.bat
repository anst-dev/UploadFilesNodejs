@echo off
chcp 65001 >nul
echo ==============================================
echo [1/3] Đang đóng tiến trình Node.js / Port 2024 cu...
echo ==============================================

:: Đóng tiến trình chiếm cổng 2024 nếu có
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2024') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Đóng các tiến trình node đang chạy ứng dụng (nếu có)
taskkill /F /IM node.exe >nul 2>&1

echo [2/3] Kiem tra va cai dat dependencies neu can...
if not exist "node_modules" (
    call npm i
)

:: Tự động tạo thư mục uploads nếu chưa có
if not exist "uploads" (
    mkdir uploads
)

echo [3/3] Dang khoi chay ung dung...
call npm start
pause