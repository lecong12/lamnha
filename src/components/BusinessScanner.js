import React, { useState, useRef } from 'react';
import './BusinessScanner.css';

const BusinessScanner = () => {
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      setScannedData(null);
      setCameraActive(false);

      // Cấu hình ép dùng camera sau với độ phân giải cao để trích xuất chuẩn
      const constraints = {
        video: { 
          facingMode: { exact: "environment" }, // Ép buộc dùng cam sau
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      // Nếu ép cam sau bị lỗi (một số máy Android đời cũ), thử lại với chế độ ưu tiên
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.log("Thử lại với chế độ ưu tiên cam sau...");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Quan trọng: Đợi video sẵn sàng mới hiển thị
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => setCameraActive(true))
            .catch(err => alert("Lỗi phát hình: " + err.message));
        };
      }
    } catch (err) {
      alert("Không tìm thấy cam sau hoặc chưa cấp quyền. Anh thử mở bằng Chrome/Safari nhé!");
      console.error(err);
    }
  };

  const captureCard = async () => {
    if (!videoRef.current || !cameraActive) return;
    setLoading(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Giả lập kết quả trích xuất
      setScannedData({
        name: "Đang phân tích...",
        phone: "Đang lấy số...",
        img: imageData
      });

      // Tắt cam để tiết kiệm pin
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);

    } catch (error) {
      alert("Lỗi chụp: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h3>QUÉT CARD & BẢNG HIỆU</h3>

        <div className="scan-display" style={{ background: '#000' }}>
          {/* Luôn giữ thẻ video trong DOM nhưng chỉ hiện khi active */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ display: cameraActive ? 'block' : 'none', width: '100%', height: '100%' }}
          />
          
          {scannedData && !cameraActive && (
            <img src={scannedData.img} className="card-thumb" alt="Card" />
          )}

          {!cameraActive && !scannedData && (
            <div style={{ color: '#fff' }}>Màn hình đang chờ soi...</div>
          )}
        </div>

        {scannedData && (
          <div className="scan-result">
            <div style={{ flex: 1 }}>
              <p className="biz-name">{scannedData.name}</p>
              <p className="biz-phone">{scannedData.phone}</p>
            </div>
            <a href={`tel:${scannedData.phone}`} className="call-now-btn">Gọi ngay</a>
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          {cameraActive ? (
            <button className="capture-btn" onClick={captureCard} disabled={loading}>
              {loading ? "Đang xử lý..." : "Chụp & Lưu"}
            </button>
          ) : (
            <button className="capture-btn" onClick={startCamera}>
              {scannedData ? "Chụp lại" : "Mở Cam Sau"}
            </button>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default BusinessScanner;
