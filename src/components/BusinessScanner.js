import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiCheckCircle } from 'react-icons/fi';

// KEY MỚI CỦA ANH CÔNG
const GEMINI_KEY = "AIzaSyA_3frlz1WTohsAXGAniuCjiOgT3zvdAQQ"; 

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");

  const callGemini = async (base64) => {
    // SỬA THÀNH V1 (STABLE) - BỎ BETA ĐỂ TRÁNH LỖI NOT FOUND
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và trả về JSON: {\"ten\": \"...\", \"sdt\": \"...\"}. Chỉ trả về JSON, không nói gì thêm." },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json" // Ép AI phải nhả ra định dạng JSON
          }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`Lỗi Google (v1): ${data.error.message}`);
        return null;
      }

      if (data.candidates && data.candidates[0].content) {
        const txt = data.candidates[0].content.parts[0].text;
        setDebugLog(`AI NHẢ CHỮ: ${txt}`);
        
        // Chuyển đổi từ text sang object
        try {
            const result = JSON.parse(txt);
            return {
              ten: result.ten || "Không rõ tên",
              sdt: result.sdt || "Không rõ SĐT"
            };
        } catch (e) {
            // Nếu parse lỗi, dùng Regex dự phòng
            const tenMatch = txt.match(/"ten":\s*"([^"]+)"/);
            const sdtMatch = txt.match(/"sdt":\s*"([^"]+)"/);
            return { ten: tenMatch ? tenMatch[1] : "", sdt: sdtMatch ? sdtMatch[1] : "" };
        }
      }
      return null;
    } catch (err) {
      setDebugLog(`Lỗi kết nối: ${err.message}`);
      return null;
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setDebugLog("Đang nén ảnh 3MB...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        // Nén xuống 700px - Kích thước vàng để AI đọc chuẩn và nhanh
        const scale = 700 / img.width;
        canvas.width = 700;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        setDebugLog("Đang ép AI (v1 Stable) làm việc...");
        
        const res = await callGemini(base64);
        if (res) {
          setScannedData({ ten: res.ten, sdt: res.sdt });
          showToast("AI ĐÃ CHỊU LÀM VIỆC!", "success");
        }
        setLoading(false);
      };
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '200px', border: '3px dashed #1890ff', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e6f7ff', cursor: 'pointer', overflow: 'hidden' }}
      >
        {loading ? <FiLoader className="spin" size={40} color="#1890ff" /> : image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : "CHỤP CARD NGAY"}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input placeholder="Tên..." value={scannedData.ten} onChange={(e) => setScannedData({...scannedData, ten: e.target.value})} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '10px' }} />
        <input placeholder="SĐT..." value={scannedData.sdt} onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px' }} />
      </div>

      <div style={{ marginTop: '30px', padding: '12px', background: '#000', color: '#0f0', borderRadius: '10px', fontSize: '11px', wordBreak: 'break-all' }}>
        <strong>TRẠNG THÁI (DEBUG):</strong><br/>
        {debugLog || "Sẵn sàng!"}
      </div>
    </div>
  );
}

export default BusinessScanner;
