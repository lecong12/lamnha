import React, { useState, useRef } from 'react';
import './BusinessScanner.css';

const BusinessScanner = () => {
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const callGeminiOCR = async (base64Image) => {
    const API_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const prompt = {
      contents: [{
        parts: [
          { text: "Trích xuất Tên doanh nghiệp và Số điện thoại từ ảnh. Trả về JSON: {\"name\": \"...\", \"phone\": \"...\"}" },
          { inline_data: { mime_type: "image/jpeg", data: base64Image.split(',')[1] } }
        ]
      }]
    };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prompt) });
      const data = await res.json();
      const cleanJson = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) { return { name: "Lỗi AI", phone: "" }; }
  };

  const startCamera = async () => {
    try {
      setScannedData(null);
      // Dừng các luồng cũ nếu có
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }

      // Cấu hình ép dùng Camera Sau (environment)
      const constraints = {
        video: { 
          facingMode: { exact: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("Không tìm thấy cam 'exact environment', thử chế độ ưu tiên...");
        // Nếu ép 'exact' lỗi (do trình duyệt cũ), thử lại với 'ideal'
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
        };
      }
    } catch (err) {
      alert("Không mở được cam sau. Anh hãy dùng Safari/Chrome và cấp quyền nhé!");
    }
  };

  const captureAndScan = async () => {
    setLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    video.srcObject.getTracks().forEach(t => t.stop());
    setCameraActive(false);

    const result = await callGeminiOCR(imageData);
    setScannedData({ ...result, img: imageData });
    setLoading(false);
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h4 style={{margin: '0 0 10px 0'}}>QUÉT CARD & BẢNG HIỆU</h4>
        <div className="scan-display" style={{background: '#000'}}>
          {cameraActive ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : scannedData ? (
            <img src={scannedData.img} className="card-thumb" alt="Card" />
          ) : (
            <div style={{color: '#94a3b8'}}>Đang chờ mở Camera Sau...</div>
          )}
        </div>

        {scannedData && (
          <div className="scan-result">
            <div style={{flex: 1}}>
              <strong>{scannedData.name}</strong><br/>
              <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>{scannedData.phone}</span>
            </div>
            {scannedData.phone && (
              <a href={`tel:${scannedData.phone.replace(/\s/g, '')}`} className="call-now-btn">GỌI</a>
            )}
          </div>
        )}

        <button className="capture-btn" onClick={cameraActive ? captureAndScan : startCamera} disabled={loading}>
          {loading ? "ĐANG ĐỌC CHỮ..." : (cameraActive ? "CHỤP & TRÍCH XUẤT" : "MỞ CAMERA SAU")}
        </button>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default BusinessScanner;
