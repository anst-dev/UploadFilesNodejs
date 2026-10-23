const multer = require('multer');
const fs = require('fs');

function fileFilter (req, file, callback) {
  var errorMessage = '';
  if (!file) {
    errorMessage = 'Wrong file type \"' + file.originalname.split('.').pop() + '\" found. Only mp4 video files are allowed!';
  }
  if(errorMessage) {
    return callback({errorMessage: errorMessage, code: 'LIMIT_FILE_TYPE'}, false);
  }
  callback(null, true);
}

// Đảm bảo thư mục upload tồn tại mặc định
const uploadDir = process.env.FILE_UPLOAD_PATH || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function destinationPath(req, file, callback) {
  const dir = process.env.FILE_UPLOAD_PATH || 'uploads/';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  callback(null, dir);
}

function fileNameConvention(req, file, callback) {
  callback(null, Date.now() + '-' + file.originalname.replace(/ /g, '_'));
}

// Tăng giới hạn tối đa cho upload
const limits = {
  fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size
  fieldSize: 10 * 1024 * 1024 * 1024, // 10GB field size
  files: 100, // Số lượng file tối đa
  parts: 10000, // Số phần tối đa trong multipart
  headerPairs: 2000 // Số cặp header tối đa
}

// Sử dụng diskStorage để lưu file vào thư mục upload
const storage = multer.diskStorage({
  destination: destinationPath,
  filename: fileNameConvention
});

const fileUploadConfig = {
  fileFilter: fileFilter,
  storage: storage,
  limits: limits
};

module.exports.fileUploadConfig = fileUploadConfig;
