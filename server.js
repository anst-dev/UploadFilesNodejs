const express = require("express");
const fs = require('fs');
const path = require("path");
const app = express();
const multer = require("multer");

// Tăng giới hạn cho express
app.use(express.json({limit: '10gb'}));
app.use(express.urlencoded({extended: true, limit: '10gb'}));

// Cấu hình multer với giới hạn cao
const includeMulter = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
    fieldSize: 10 * 1024 * 1024 * 1024 // 10GB cho mỗi field
  }
}).any();
const routes = require("./routes/");
require("./util/readenv").config();
let open;

var QRCode = require('qrcode')
const os = require("os");
const networkInterfaces = os.networkInterfaces();

for (let interface in networkInterfaces) {
  for (let interfaceInfo of networkInterfaces[interface]) {
    if (interfaceInfo.family === "IPv4" && !interfaceInfo.internal) {
      var ip = "http://" + interfaceInfo.address + ":" + process.env.PORT;
      console.log(ip);
    }
  }
}
// app.use(multer().any());
function shouldParseRequest(req) {
  const currentMethod = req.method;
  const currentRoute = req.originalUrl;

  const restrictedRoutes = [
    {
      method: "POST",
      originalUrl: "/",
    },
  ];

  for (var i = 0; i < restrictedRoutes.length; i++) {
    if (
      restrictedRoutes[i].method == currentMethod &&
      restrictedRoutes[i].originalUrl == currentRoute
    ) {
      return false;
    }
  }
  return true;
}

app.use(function (req, res, next) {
  shouldParseRequest(req) ? includeMulter(req, res, next) : next();
});

// Tối ưu static serving
app.use(express.static("public", {
  maxAge: '1d', // Cache trong 1 ngày
  etag: false, // Tắt etag để giảm overhead
  lastModified: false // Tắt lastModified để giảm overhead
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/get-uploads', function (req, res) {
  fs.readdir(path.join(__dirname, 'uploads'), function (err, files) {
    if (err) {
      res.status(500).send('Error reading files');
    } else {
      // Lấy thông tin chi tiết của từng file bao gồm kích thước
      const fileDetailsPromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const filePath = path.join(__dirname, 'uploads', file);
          fs.stat(filePath, (err, stats) => {
            if (err) {
              resolve({
                name: file,
                size: 0,
                error: 'Error reading file stats'
              });
            } else {
              resolve({
                name: file,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile()
              });
            }
          });
        });
      });

      Promise.all(fileDetailsPromises)
        .then(fileDetails => {
          res.json(fileDetails);
        })
        .catch(error => {
          console.error('Error getting file details:', error);
          res.status(500).send('Error processing files');
        });
    }
  });
});

app.get('/api/interface-address', function (req, res) {
  QRCode.toDataURL(ip, function (err, url) {
    res.json({ interfaceAddress: ip, QR: url });
   // console.log(url)
  })
});

app.use("/", routes);

app.listen(process.env.PORT, async function () {
  // redirect tới ip
  const module = await import('open');
  open = module.default;
  open(ip);
  console.log("Server is listening at the port", process.env.PORT);
});

module.exports.app = app;
