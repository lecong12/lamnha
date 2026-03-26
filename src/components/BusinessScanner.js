import React, { useState, useRef } from 'react';
import './BusinessScanner.css';

const BusinessScanner = () => {
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // --- HÀM GỌI GEMINI AI VỚI KEY CỦA ANH ---
  const callGeminiOCR = async (base64Image) => {
    const API_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const prompt = {
      contents: [{
        parts: [
          { text: "Bạn là trợ lý trích xuất dữ liệu. Hãy nhìn vào ảnh Card/Bảng hiệu này và tìm: 1. Tên doanh nghiệp/Cửa hàng. 2. Số điện thoại liên hệ chính. Chỉ trả về kết quả duy nhất dưới dạng JSON: {\"name\": \"...\", \"phone\": \"...\"}. Nếu không thấy thông tin, hãy để giá trị là 'Đang cập nhật'." },
          { inline_data: { mime_type: "image/jpeg", data: base64Image.split(',')[1] } }
        ]
      }]
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt)
      });
      const data = await res.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      
      // Làm sạch chuỗi JSON (loại bỏ ký tự lạ nếu Gemini trả về markdown)
      const cleanJson = textResponse.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("Lỗi trích xuất Gemini:", error);
      return { name: "Lỗi kết nối AI", phone: "" };
    }
  };

  const startCamera = async () => {
    try {
      setScannedData(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
        };
      }
    } catch (err) {
      alert("Lỗi mở Cam: " + err.message);
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current) return;
    setLoading(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Tắt cam ngay để rảnh máy
      const tracks = video.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      setCameraActive(false);

      // Gọi Gemini xử lý ảnh vừa chụp
      const result = await callGeminiOCR(imageData);
      
      setScannedData({ ...result, img: imageData });
    } catch (error) {
      alert("Lỗi xử lý: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h4 style={{margin: '0 0 10px 0', color: '#1e293b'}}>QUÉT CARD & BẢNG HIỆU</h4>
        
        <div className="scan-display">
          {cameraActive ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : scannedData ? (
            <img src={scannedData.img} className="card-thumb" alt="Card" />
          ) : (
            <div style={{color: '#94a3b8', fontSize: '14px'}}>Sẵn sàng soi Card...</div>
          )}
        </div>

        {scannedData && (
          <div className="scan-result">
            <div style={{flex: 1, overflow: 'hidden'}}>
              <strong style={{fontSize: '15px', color: '#111827'}}>{scannedData.name}</strong><br/>
              <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>{scannedData.phone}</span>
            </div>
            {scannedData.phone && scannedData.phone !== 'Đang cập nhật' && (
              <a href={`tel:${scannedData.phone.replace(/\s/g, '')}`} className="call-now-btn">
                GỌI
              </a>
            )}
          </div>
        )}

        <button 
          className="capture-btn" 
          onClick={cameraActive ? captureAndScan : startCamera} 
          disabled={loading}
          style={{marginTop: '10px'}}
        >
          {loading ? "ĐANG PHÂN TÍCH..." : (cameraActive ? "CHỤP & TRÍCH XUẤT" : "MỞ CAMERA SOI")}
        </button>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default BusinessScanner;
