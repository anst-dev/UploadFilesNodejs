const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const fileUploadConfig = require('../config/file-upload-config').fileUploadConfig;
const handleDb = require('../db/handle-db');
const multer  = require('multer');

function convertHeicFile(filePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'convert_heic.py');
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    execFile('python', [scriptPath, '--delete', '--file', fileName], { cwd: fileDir }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      const jpgPath = filePath.replace(/\.(heic|HEIC)$/i, '.jpg');
      resolve(jpgPath);
    });
  });
}

module.exports.initUploadPage = function(req, res) {
  res.sendFile(path.resolve(__dirname + '/../public/video_upload_test.html'));
}

module.exports.uploadFile = function(req, res) {
  var upload = multer(fileUploadConfig).array('user-file',1000);
  let links = [];
  upload(req, res, async function(uploadError) {
    if(uploadError) {
      var errorMessage;
      if(uploadError.code === 'LIMIT_FILE_TYPE') {
        errorMessage = uploadError.errorMessage;
      } else if(uploadError.code === 'LIMIT_FILE_SIZE'){
        errorMessage = 'Maximum file size allowed is ' + process.env.FILE_SIZE + 'MB';
      }
      return res.json({
        error: errorMessage
      });
    }

    for (const file of req.files) {
      let filePath = file.path;
      let originalName = file.originalname;
      const isHeic = /\.(heic|HEIC)$/i.test(originalName);

      if (isHeic) {
        try {
          const jpgPath = await convertHeicFile(filePath);
          filePath = jpgPath;
          originalName = originalName.replace(/\.(heic|HEIC)$/i, '.jpg');
          file.size = fs.statSync(jpgPath).size;
        } catch (err) {
          console.error('Loi chuyen doi HEIC:', err);
        }
      }

      const fileId = path.basename(filePath, path.extname(filePath)).split('-')[0];
      const link = 'http://' + req.hostname + ':' + process.env.PORT + '/video/' + fileId;
      links.push(link);
      const attributesToBeSaved = {
        id: fileId,
        name: originalName,
        size: file.size,
        path: filePath,
        encoding: file.encoding,
        details: req.body.details ? req.body.details : ''
      };
      handleDb.saveToDB(attributesToBeSaved);
    }

    res.json({
      success: true,
      link: links
    });
  });
}
