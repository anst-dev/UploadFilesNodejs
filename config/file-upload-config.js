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

function destinationPath(req, file, callback) {
  var stat = null;
  try {
    stat = fs.statSync(process.env.FILE_UPLOAD_PATH);
  } catch (err) {
    fs.mkdirSync(process.env.FILE_UPLOAD_PATH);
  }
   callback(null, process.env.FILE_UPLOAD_PATH);
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

// Sử dụng memory storage để tăng tốc độ
const storage = multer.memoryStorage();

const fileUploadConfig = {
  fileFilter: fileFilter,
  storage: storage,
  limits: limits
};

module.exports.fileUploadConfig = fileUploadConfig;
