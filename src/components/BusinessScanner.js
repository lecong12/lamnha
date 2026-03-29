import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiZap } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");

  const callGemini = async (base64) => {
    // ĐÂY LÀ ĐƯỜNG DẪN CHUẨN NHẤT: v1 + gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và trả về JSON: {\"ten\": \"...\", \"sdt\": \"...\"}" },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setDebugLog(`Lỗi Google (v1): ${data.error.message}`);
        return null;
      }

      if (data.candidates && data.candidates[0].content) {
        const txt = data.candidates[0].content.parts[0].text;
        setDebugLog(`AI nhả chữ: ${txt}`);

        // Dùng Regex bóc tách cho chắc ăn
        const tenMatch = txt.match(/"ten":\s*"([^"]+)"/);
        const sdtMatch = txt.match(/"sdt":\s*"([^"]+)"/);
        
        return {
          ten: tenMatch ? tenMatch[1] : "Không tìm thấy tên",
          sdt: sdtMatch ? sdtMatch[1] : "Không tìm thấy SĐT"
        };
      }
      setDebugLog("AI không trả về nội dung");
      return null;
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
    setDebugLog("Đang nén ảnh...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        // Ép về 800px để AI đọc nhanh nhất
        const scale = 800 / img.width;
        canvas.width = 800;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        setDebugLog("Đang gọi AI (v1)...");
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
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '200px', border: '3px dashed #28a745', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6ffed', cursor: 'pointer', overflow: 'hidden' }}
      >
        {loading ? <FiLoader className="spin" size={40} color="#28a745" /> : image ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{textAlign:'center'}}><FiZap size={40} color="#28a745"/><br/>Chụp Card</div>}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input placeholder="Tên doanh nghiệp..." value={scannedData.ten} onChange={(e) => setScannedData({...scannedData, ten: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '10px' }} />
        <input placeholder="Số điện thoại..." value={scannedData.sdt} onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px' }} />
      </div>

      <div style={{ marginTop: '20px', padding: '10px', background: '#333', color: '#0f0', borderRadius: '8px', fontSize: '11px', wordBreak: 'break-all' }}>
        <strong>BẢNG DEBUG:</strong><br/>
        {debugLog || "Chờ lệnh..."}
      </div>
    </div>
  );
}

export default BusinessScanner;
