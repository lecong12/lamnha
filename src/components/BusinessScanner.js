import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiCheckCircle } from 'react-icons/fi';

// CHỖ NÀY ANH TỰ DÁN KEY MỚI CỦA ANH VÀO NHÉ - ĐỪNG GỬI LÊN ĐÂY
const GEMINI_KEY = "AIzaSyDfyd86965EGsNgwhcNCuZQ1SZN3xzWty0"; 

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");

  const callGemini = async (base64) => {
    // Dùng v1beta với model flash-latest là ổn định nhất hiện nay
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và trả về JSON: {\"ten\": \"...\", \"sdt\": \"...\"}. Chỉ trả về JSON." },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`Lỗi Google: ${data.error.message}`);
        return null;
      }

      const txt = data.candidates[0].content.parts[0].text;
      setDebugLog(`AI ĐÃ CHỊU ĐỌC: ${txt}`);

      const tenMatch = txt.match(/"ten":\s*"([^"]+)"/);
      const sdtMatch = txt.match(/"sdt":\s*"([^"]+)"/);
      
      return {
        ten: tenMatch ? tenMatch[1] : "",
        sdt: sdtMatch ? sdtMatch[1] : ""
      };
    } catch (err) {
      setDebugLog(`Lỗi mạng: ${err.message}`);
      return null;
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setDebugLog("Đang ép AI làm việc với Key mới...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = 800 / img.width;
        canvas.width = 800;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        const res = await callGemini(base64);
        if (res) {
          setScannedData({ ten: res.ten, sdt: res.sdt });
          showToast("Xong rồi anh Công ơi!", "success");
        }
        setLoading(false);
      };
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '3px solid #28a745', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', cursor: 'pointer' }}
      >
        {loading ? <FiLoader className="spin" size={40} color="#28a745" /> : image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : "CHỤP CARD (DÙNG KEY MỚI)"}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input placeholder="Tên..." value={scannedData.ten} style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '2px solid #ddd', borderRadius: '10px' }} />
        <input placeholder="SĐT..." value={scannedData.sdt} style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '10px' }} />
      </div>

      <div style={{ marginTop: '30px', padding: '10px', background: '#000', color: '#0f0', borderRadius: '8px', fontSize: '11px' }}>
        <strong>TRẠNG THÁI:</strong><br/>
        {debugLog || "Vui lòng dùng Key mới và không để lộ!"}
      </div>
    </div>
  );
}

export default BusinessScanner;