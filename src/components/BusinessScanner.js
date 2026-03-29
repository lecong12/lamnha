import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

// ĐÃ CẬP NHẬT KEY MỚI CỦA ANH CÔNG
const GEMINI_KEY = "AIzaSyA_3frlz1WTohsAXGAniuCjiOgT3zvdAQQ"; 

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");

  const callGemini = async (base64) => {
    // Dùng v1beta + gemini-1.5-flash (Model mạnh nhất cho đọc ảnh)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và trả về JSON duy nhất: {\"ten\": \"...\", \"sdt\": \"...\"}. Nếu là ngân hàng, hãy ghi rõ chi nhánh." },
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
      setDebugLog(`AI ĐÃ CHỊU NHẢ CHỮ: ${txt}`);

      // Bóc tách JSON bằng Regex cho an toàn
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
    setDebugLog("Đang nén ảnh 3MB và ép AI làm việc...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        // Nén về 800px để AI đọc rõ nhất mà file lại nhẹ
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Xuất base64 chất lượng 60%
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        const res = await callGemini(base64);
        if (res && (res.ten || res.sdt)) {
          setScannedData({ ten: res.ten, sdt: res.sdt });
          showToast("AI đã bị khuất phục!", "success");
        } else {
          showToast("Vẫn chưa lấy được chữ, anh xem Debug nhé!", "warning");
        }
        setLoading(false);
      };
    };
  };

  return (
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ 
          width: '100%', height: '200px', border: '3px dashed #52c41a', 
          borderRadius: '15px', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', background: '#f6ffed', cursor: 'pointer',
          overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <FiLoader className="spin" size={40} color="#52c41a" />
            <p style={{ marginTop: '10px', color: '#52c41a', fontWeight: 'bold' }}>ĐANG TRỊ AI...</p>
          </div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#52c41a' }}>
            <FiCamera size={45} /><br/>
            <strong style={{fontSize: '14px'}}>Bấm chụp phong bì Techcombank</strong>
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>TÊN DOANH NGHIỆP</label>
          <input 
            value={scannedData.ten} 
            onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
            style={{ width: '100%', padding: '14px', border: '2px solid #ddd', borderRadius: '12px', marginTop: '5px' }} 
            placeholder="AI sẽ điền..."
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>SỐ ĐIỆN THOẠI</label>
          <input 
            value={scannedData.sdt} 
            onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
            style={{ width: '100%', padding: '14px', border: '2px solid #ddd', borderRadius: '12px', marginTop: '5px' }} 
            placeholder="AI sẽ tìm..."
          />
        </div>

        <button 
          style={{ width: '100%', padding: '16px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}
          onClick={() => showToast("Lưu danh bạ ngon lành!", "success")}
        >
          LƯU VÀO DANH BẠ
        </button>
      </div>

      <div style={{ marginTop: '30px', padding: '12px', background: '#222', color: '#0f0', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
        <strong>TRẠNG THÁI (DEBUG LOG):</strong><br/>
        {debugLog || "Sẵn sàng chiến đấu!"}
      </div>
    </div>
  );
}

export default BusinessScanner;
