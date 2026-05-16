function onSubmit(e) {
  e.preventDefault();
  var customMessage = document.getElementById("message");
  if (customMessage) {
    customMessage.style.display = 'block';
  }
  if (validateForm(customMessage)) {
    uploadVideo(customMessage);
  }
}

// Truy vấn thông tin địa chỉ giao diện và mã QR
fetch("/api/interface-address")
  .then((response) => response.json())
  .then((data) => {
    var interfaceAddress = data.interfaceAddress;
    var qrImage = data.QR;
    var ipElement = document.getElementById("ip-address");
    var qrElement = document.getElementById("qr-image");
    if (ipElement) {
      ipElement.innerHTML = interfaceAddress;
    }
    if (qrElement) {
      qrElement.src = qrImage;
    }
  })
  .catch((error) => {
    console.error("Lỗi khi lấy địa chỉ giao diện:", error);
  });

function validateForm(customMessage) {
  const fileInput = document.getElementById("file-input") ||
                    (document.getElementById("video-upload") && document.getElementById("video-upload").elements[0]);

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (customMessage) {
      customMessage.innerHTML = "Vui lòng chọn ít nhất một tệp để tải lên";
      customMessage.className = "error";
    }
    return false;
  }

  const fileLimit = 104857600000000000;

  for (let i = 0; i < fileInput.files.length; i++) {
    const file = fileInput.files[i];
    if (file.size > fileLimit) {
      if (customMessage) {
        customMessage.innerHTML = `Tệp "${file.name}" vượt quá kích thước tối đa cho phép: 100MB`;
        customMessage.className = "error";
      }
      return false;
    }
  }

  return true;
}

function uploadVideo(customMessage) {
  try {
    const submitButton = document.getElementById("submit");
    if (submitButton) {
      submitButton.disabled = true;
    }

    if (customMessage) {
      customMessage.innerHTML = "Đang chuẩn bị tải lên...";
    }

    const progressContainer = document.getElementById("progress-container");
    if (progressContainer) {
      progressContainer.style.display = "block";
    }

    const formElement = document.getElementById("upload-form") || document.getElementById("video-upload");
    const fileInput = document.getElementById("file-input") ||
                    (document.getElementById("video-upload") && document.getElementById("video-upload").elements[0]);

    if (!formElement || !fileInput || !fileInput.files || fileInput.files.length === 0) {
      throw new Error("Không tìm thấy form hoặc file để upload");
    }

    lastLoaded = 0;
    lastTime = Date.now();

    var request = new XMLHttpRequest();
    request.open("POST", "/", true);

    request.onerror = function(error) {
      console.error("Lỗi khi upload:", error);
      if (customMessage) {
        customMessage.innerHTML = "Có lỗi xảy ra khi tải lên";
        customMessage.className = "error";
      }
      if (submitButton) {
        submitButton.disabled = false;
      }
    };

    request.onload = onComplete;
    request.upload.onprogress = fileUploadPercentage;

    const data = new FormData(formElement);
    request.send(data);

  } catch (error) {
    console.error("Lỗi trong quá trình upload:", error);
    if (customMessage) {
      customMessage.innerHTML = error.message || "Có lỗi xảy ra khi tải lên";
      customMessage.className = "error";
    }
    const submitButton = document.getElementById("submit");
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function playSuccessSound() {
  try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach(function (freq, i) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        audioCtx.currentTime + i * 0.15 + 0.3
      );
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
  } catch (e) {
    // Trình duyệt không hỗ trợ Web Audio API
  }
}

function onComplete(event) {
  var customMessage = document.getElementById("message");
  var progressBar = document.getElementById("progress-bar");

  try {
    const response = JSON.parse(event.currentTarget.response);
    if (response.success) {
      playSuccessSound();
      if (progressBar) {
        progressBar.style.width = "100%";
        progressBar.style.backgroundColor = "#2ecc71";
      }
      if (customMessage) {
        customMessage.innerHTML = "&#10004; Tải lên thành công!";
        customMessage.className = "success";

        setTimeout(function () {
          const mainDiv = document.getElementById("main-div");
          if (mainDiv) {
            customMessage.innerHTML =
              '&#10004; Tải lên thành công! <a href="/gallery.html" style="color:#fffffe;text-decoration:underline;font-weight:bold;">Nhấn vào đây</a> để xem thư viện.';
          } else {
            customMessage.innerHTML =
              '&#10004; Tải lên thành công! <a href="/gallery.html">Nhấn vào đây</a> để xem thư viện.';
          }
        }, 2000);
      }
    } else {
      if (progressBar) {
        progressBar.style.width = "100%";
        progressBar.style.backgroundColor = "#e16162";
      }
      if (customMessage) {
        customMessage.innerHTML = response.error || "Có lỗi xảy ra khi tải lên tệp";
        customMessage.className = "error";
      }
    }
  } catch (error) {
    if (customMessage) {
      customMessage.innerHTML = "Có lỗi xảy ra khi tải lên tệp";
      customMessage.className = "error";
    }
  }

  const submitButton = document.getElementById("submit");
  if (submitButton) {
    submitButton.disabled = false;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateFileInfo() {
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById("file-input"));
  const fileSizeDiv = document.getElementById("file-size");

  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const fileSize = fileInput.files[0].size;
    fileSizeDiv.innerHTML = `Dung lượng file: ${formatFileSize(fileSize)}`;
  } else {
    fileSizeDiv.innerHTML = '';
  }
}

let lastLoaded = 0;
let lastTime = Date.now();

function calculateSpeed(loaded) {
  const now = Date.now();
  const timeDiff = (now - lastTime) / 1000;
  const bytesDiff = loaded - lastLoaded;
  const speedBps = bytesDiff / timeDiff;

  lastLoaded = loaded;
  lastTime = now;

  return formatFileSize(speedBps) + '/s';
}

function fileUploadPercentage(e) {
  if (e.lengthComputable) {
    var customMessage = document.getElementById("message");
    var progressBar = document.getElementById("progress-bar");
    var progressText = document.getElementById("progress-text");
    var percentage = Math.round((e.loaded / e.total) * 100);

    const speed = calculateSpeed(e.loaded);

    if (progressBar) {
      progressBar.style.width = percentage + "%";
    }
    if (progressText) {
      progressText.textContent = percentage + "%";
    }
    if (customMessage) {
      if (percentage === 100) {
        customMessage.innerHTML = "Đang xử lý...";
      } else {
        customMessage.innerHTML = `Đang tải lên: ${formatFileSize(e.loaded)} / ${formatFileSize(e.total)} (${percentage}%) - Tốc độ: ${speed}`;
      }
      customMessage.className = percentage === 100 ? "success" : "";
    }
  }
}
