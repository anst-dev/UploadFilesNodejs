# Upload Files & Media Server (Node.js & Express)

Ứng dụng web hỗ trợ tải lên đa tệp tin (video, hình ảnh, tài liệu...), tự động chuyển đổi định dạng ảnh HEIC (iPhone) sang JPG, xem thư viện media và phát trực tuyến video dung lượng lớn qua mạng LAN / WiFi nội bộ.

---

## 🌟 Tính Năng Nổi Bật

- **Tải lên đa tệp & Dung lượng lớn**: Hỗ trợ tải cùng lúc hàng trăm file với dung lượng file lên đến hàng chục GB qua Multer DiskStorage.
- **Tự động chuyển đổi ảnh HEIC**: Tự động nhận diện ảnh chụp từ iPhone (`.heic`) và chuyển đổi sang `.jpg` tự động bằng script Python.
- **Mã QR & Danh sách IP mở tab nhanh**:
  - Tự động tạo mã QR quét nhanh bằng điện thoại để mở trang upload ngay lập tức.
  - Hiển thị danh sách tất cả các IP / URL của máy (mạng LAN, WiFi, Tailscale...) có nút bấm mở tab mới trực tiếp.
  - Hỗ trợ nút **Ẩn / Hiện** danh sách link giúp giao diện luôn gọn gàng.
- **Âm thanh thông báo**: Phát chuông hợp âm (Web Audio API) ngay khi hoàn tất tải file lên thành công.
- **Tab Danh sách Port**: Tab quản lý hiển thị các địa chỉ IP và cổng mạng đang hoạt động (`/ports.html`).
- **Thư viện tệp (Gallery)**: Quản lý, tìm kiếm, lọc theo loại file (Hình ảnh, Video, Khác), phân trang và xem chi tiết file.
- **Tự động dọn tiến trình cũ**: Script khởi chạy tự động quét và đóng tiến trình chiếm port `2024` trước khi khởi động, tránh lỗi `EADDRINUSE`.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- **Node.js** >= 14.x (khuyên dùng Node.js 18 hoặc 20+)
- **npm** >= 6.x
- *(Tùy chọn cho chuyển đổi HEIC)*: Python 3 và thư viện `pillow-heif` (nếu cần chuyển đổi ảnh HEIC từ iOS).

---

### 2. Khởi chạy 1 chạm (Khuyên dùng)

#### 🔹 Trên Linux:
Chạy script tự động (tự dọn port cũ, tự cài packages nếu thiếu, tự tạo thư mục `uploads/` và chạy):
```bash
./startLinux.sh
```
*Hoặc click đúp chuột vào file shortcut `run-app.desktop` trên màn hình Desktop.*

#### 🔹 Trên Windows:
Click đúp chuột vào file:
```cmd
startWindown.bat
```

---

### 3. Khởi chạy thủ công (Terminal / CMD)

1. Cài đặt các thư viện:
   ```bash
   npm install
   ```

2. Khởi động server:
   ```bash
   npm start
   ```

3. Mở trình duyệt và truy cập:
   ```
   http://localhost:2024
   ```
   *(Hoặc truy cập bằng địa chỉ IP mạng LAN do màn hình console/mã QR cung cấp)*.

---

## ⚙️ Cấu Hình Môi Trường (`.env`)

Tệp `.env` cấu hình cơ bản:
```env
PORT=2024
FILE_UPLOAD_PATH=uploads/
FILE_SIZE=10000000000
```
- `PORT`: Cổng mạng server lắng nghe (mặc định: `2024`).
- `FILE_UPLOAD_PATH`: Đường dẫn thư mục lưu trữ file tải lên (mặc định: `uploads/`).
- `FILE_SIZE`: Giới hạn dung lượng tối đa cho mỗi file.

---

## 📁 Cấu Trúc Dự Án

```
├── config/                 # Cấu hình Multer upload, dung lượng, đường dẫn đĩa
├── controllers/            # Controller xử lý upload và streaming video
├── db/                     # Lưu trữ metadata tệp đã upload
├── public/                 # Giao diện web frontend
│   ├── css/                # Style giao diện
│   ├── js/                 # Mã xử lý upload, âm thanh, QR và zoom link
│   ├── gallery.html        # Trang thư viện tệp media
│   ├── ports.html          # Trang xem danh sách địa chỉ URL & Port
│   └── video_upload_test.html # Trang chủ tải lên file & quét QR
├── routes/                 # Định tuyến Express router
├── uploads/                # Thư mục lưu trữ file sau khi tải lên
├── convert_heic.py         # Script Python chuyển đổi file ảnh HEIC sang JPG
├── server.js               # Entry point chính của Node.js Express server
├── startLinux.sh           # Script chạy 1 chạm cho Linux
├── startWindown.bat        # Script chạy 1 chạm cho Windows
└── run-app.desktop         # Shortcut Desktop khởi chạy ứng dụng
```

---

## 📜 Giấy Phép
Dự án được phân phối dưới giấy phép **ISC License**.
