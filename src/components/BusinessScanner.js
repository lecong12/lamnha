import React, { useState, useRef } from 'react';
import './BusinessScanner.css';

const BusinessScanner = () => {
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Hàm mở luồng soi Camera
  const startCamera = async () => {
    try {
      setScannedData(null); 
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Ưu tiên camera sau
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ép video phải Play thì mới hiện hình soi
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
        };
      }
    } catch (err) {
      alert("Lỗi mở Cam: " + err.message + ". Anh hãy dùng Chrome/Safari và cấp quyền nhé!");
    }
  };

  // Hàm chụp đứng khung hình và trích xuất
  const captureCard = async () => {
    if (!videoRef.current) return;
    setLoading(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // --- PHẦN GỬI ĐI QUÉT (OCR) ---
      // Anh thay phần mock này bằng logic gọi Gemini của anh
      const result = {
        name: "Vật Liệu Xây Dựng Số 1",
        phone: "0905556677",
        img: imageData
      };

      setScannedData(result);

      // Tắt camera để rảnh tay
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);

    } catch (error) {
      alert("Lỗi khi chụp: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h3 style={{color: '#1e293b'}}>QUÉT CARD & BẢNG HIỆU</h3>

        <div className="scan-display">
          {cameraActive ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : scannedData ? (
            <img src={scannedData.img} className="card-thumb" alt="Card đã chụp" />
          ) : (
            <div style={{ color: '#94a3b8', padding: '20px' }}>
              <i className="fas fa-camera fa-2x"></i>
              <p>Bấm Mở Camera để soi Card</p>
            </div>
          )}
        </div>

        {scannedData && (
          <div className="scan-result">
            <div style={{ flex: 1 }}>
              <p className="biz-name">{scannedData.name}</p>
              <p className="biz-phone">{scannedData.phone}</p>
            </div>
            <a href={`tel:${scannedData.phone}`} className="call-now-btn">
              <i className="fas fa-phone"></i> Gọi ngay
            </a>
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          {cameraActive ? (
            <button className={`capture-btn ${loading ? 'disabled' : ''}`} onClick={captureCard} disabled={loading}>
              {loading ? <i className="fas fa-spinner spin"></i> : <i className="fas fa-camera"></i>}
              {loading ? " Đang trích xuất..." : " Chụp & Lưu Sheet"}
            </button>
          ) : (
            <button className="capture-btn" onClick={startCamera}>
              <i className="fas fa-video"></i> {scannedData ? "Chụp lại cái khác" : "Mở Camera Soi"}
            </button>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default BusinessScanner;
