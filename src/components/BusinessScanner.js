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
    setScannedData(null);
    setCameraActive(false);

    try {
      // 1. Dừng các luồng cũ
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
      }

      // 2. Lấy danh sách tất cả các camera trên máy
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // 3. Tìm camera có nhãn "back" hoặc "rear" hoặc "environment"
      let backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('sau')
      );

      // Nếu không tìm thấy bằng nhãn, lấy cái cuối cùng trong danh sách (thường là cam sau)
      const targetDeviceId = backCamera ? backCamera.deviceId : (videoDevices.length > 0 ? videoDevices[videoDevices.length - 1].deviceId : null);

      const constraints = targetDeviceId 
        ? { video: { deviceId: { exact: targetDeviceId } } }
        : { video: { facingMode: "environment" } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        window.localStream = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => setCameraActive(true));
        };
      }
    } catch (err) {
      console.error("Lỗi mở cam:", err);
      // Phương án cuối cùng nếu lọc ID thất bại
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoRef.current.srcObject = fallbackStream;
        setCameraActive(true);
      } catch (e) {
        alert("Không thể mở camera sau. Anh hãy kiểm tra quyền truy cập của trình duyệt.");
      }
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !cameraActive) return;
    setLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    if (window.localStream) window.localStream.getTracks().forEach(t => t.stop());
    setCameraActive(false);

    const result = await callGeminiOCR(imageData);
    setScannedData({ ...result, img: imageData });
    setLoading(false);
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h4 style={{margin: '0 0 10px 0'}}>QUÉT CARD & BẢNG HIỆU</h4>
        <div className="scan-display" style={{ background: '#000' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} 
          />
          {scannedData && !cameraActive && <img src={scannedData.img} className="card-thumb" alt="Card" />}
          {!cameraActive && !scannedData && <div style={{color: '#94a3b8'}}>Đang tìm Camera Sau...</div>}
        </div>

        {scannedData && (
          <div className="scan-result">
            <div style={{flex: 1}}>
              <strong>{scannedData.name}</strong><br/>
              <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>{scannedData.phone}</span>
            </div>
            {scannedData.phone && <a href={`tel:${scannedData.phone.replace(/\s/g, '')}`} className="call-now-btn">GỌI</a>}
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
