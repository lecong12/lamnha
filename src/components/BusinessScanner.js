import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader } from 'react-icons/fi';

// KEY MỚI CỦA ANH CÔNG
const GEMINI_KEY = "AIzaSyDfyd86965EGsNgwhcNCuZQ1SZN3xzWty0";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");

  const callGemini = async (base64) => {
    // gemini-pro-vision đã bị khai tử, phải chuyển sang gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và tìm: Tên cửa hàng, Số điện thoại. Trả về đúng định dạng: Tên: [tên], SĐT: [số]" },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`Lỗi Google (Pro Vision): ${data.error.message}`);
        return null;
      }

      if (data.candidates && data.candidates[0].content) {
        const txt = data.candidates[0].content.parts[0].text;
        setDebugLog(`AI ĐÃ CHỊU ĐỌC: ${txt}`);
        
        const tenMatch = txt.match(/Tên:\s*(.*)/i);
        const sdtMatch = txt.match(/SĐT:\s*([\d\s.-]+)/i);
        
        return {
          ten: tenMatch ? tenMatch[1].trim() : "",
          sdt: sdtMatch ? sdtMatch[1].trim() : ""
        };
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
    setDebugLog("Đang thử model Pro Vision...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 600; // Nén cực nhỏ để ép nó nhận diện nhanh
        canvas.height = (img.height / img.width) * 600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        const res = await callGemini(base64);
        
        if (res) {
          setScannedData({ ten: res.ten, sdt: res.sdt });
          showToast("AI ĐÃ KHUẤT PHỤC!", "success");
        }
        setLoading(false);
      };
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '3px dashed #ff4d4f', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff1f0', cursor: 'pointer' }}
      >
        {loading ? <FiLoader className="spin" size={40} color="#ff4d4f" /> : image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : "CHỤP PHONG BÌ TECHCOMBANK"}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input placeholder="Tên..." value={scannedData.ten} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '10px' }} />
        <input placeholder="SĐT..." value={scannedData.sdt} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px' }} />
      </div>

      <div style={{ marginTop: '30px', padding: '10px', background: '#000', color: '#0f0', borderRadius: '8px', fontSize: '11px', wordBreak: 'break-all' }}>
        <strong>BẢNG DEBUG (LẦN CUỐI CÙNG):</strong><br/>
        {debugLog || "Vui lòng chụp ảnh!"}
      </div>
    </div>
  );
}

export default BusinessScanner;
