function onSubmit(e) {
  e.preventDefault();
  var customMessage = document.getElementById("message");
  if (validateForm(customMessage)) {
    uploadVideo(customMessage);
  }
}

//truyền giá trị này vào thẻ h3

fetch("/api/interface-address")
  .then((response) => response.json())
  .then((data) => {
    var interfaceAddress = data.interfaceAddress;
    var qrImage = data.QR;
    document.getElementById("ip-address").innerHTML = interfaceAddress;
    document.getElementById("qr-image").src = qrImage;
    console.log(interfaceAddress);
  });

function validateForm(customMessage) {
  const uploadedFile =
    document.getElementById("video-upload").elements[0].files[0];
  if (!uploadedFile) {
    customMessage.innerHTML = "Please select a video to upload";
    return false;
  }
  const fileLimit = 104857600000000;
  if (uploadedFile.size > fileLimit) {
    customMessage.innerHTML = "Maximum video size allowed: 100MB";
    return false;
  }
  return true;
}

function uploadVideo(customMessage) {
  document.getElementById("submit").disabled = true;
  customMessage.innerHTML = "Đang tải lên...";
  var progressContainer = document.getElementById("progress-container");
  if (progressContainer) progressContainer.style.display = "block";
  var formElement = document.getElementById("video-upload");
  var request = new XMLHttpRequest();
  request.open("POST", "/", true);
  request.onload = onComplete;
  request.upload.onprogress = fileUploadPercentage;
  const data = new FormData(formElement);
  request.send(data);
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
  const response = JSON.parse(event.currentTarget.response);
  var progressBar = document.getElementById("progress-bar");
  var progressContainer = document.getElementById("progress-container");
  if (response.success) {
    playSuccessSound();
    if (progressBar) {
      progressBar.style.width = "100%";
      progressBar.style.backgroundColor = "#2ecc71";
    }
    customMessage.innerHTML = "&#10004; Tải lên thành công!";
    customMessage.className = "success";
    setTimeout(function () {
      var mainDiv = document.getElementById("main-div");
      if (mainDiv) mainDiv.style.display = "none";
      customMessage.innerHTML =
        '&#10004; Tải lên thành công! <a href="/gallery.html" style="color:#fffffe;text-decoration:underline;">Nhấn vào đây</a> để xem thư viện.';
    }, 2000);
  } else {
    if (progressBar) {
      progressBar.style.width = "100%";
      progressBar.style.backgroundColor = "#e16162";
    }
    customMessage.innerHTML = response.error;
    customMessage.className = "error";
  }
  document.getElementById("submit").disabled = false;
}

function fileUploadPercentage(e) {
  if (e.lengthComputable) {
    var customMessage = document.getElementById("message");
    var progressBar = document.getElementById("progress-bar");
    var progressText = document.getElementById("progress-text");
    var percentage = Math.round((e.loaded / e.total) * 100);
    customMessage.innerHTML = "Đang tải lên: " + percentage + "%";
    customMessage.className = percentage === 100 ? "success" : "";
    if (progressBar) {
      progressBar.style.width = percentage + "%";
    }
    if (progressText) {
      progressText.textContent = percentage + "%";
    }
  }
}
