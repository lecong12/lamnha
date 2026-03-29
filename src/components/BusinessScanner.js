import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiAlertCircle } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });

  const callGeminiAI = async (base64) => {
    // Dùng v1beta để có quyền can thiệp vào bộ lọc Safety
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Đọc ảnh và trả về JSON: {'ten': '...', 'sdt': '...'}. Chỉ trả về JSON." },
                    { inline_data: { mime_type: "image/jpeg", data: base64 } }]
          }],
          // TẮT BỘ LỌC ĐỂ AI KHÔNG TỰ Ý CHẶN ẢNH
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{.*\}/s);
      const res = jsonMatch ? JSON.parse(jsonMatch[0].replace(/\\n/g, "")) : null;
      
      if (res) {
        setScannedData({ ten: res.ten || "", sdt: res.sdt || "" });
        showToast("AI đã đọc được rồi!", "success");
      } else {
        showToast("AI trả về định dạng lạ, mời nhập tay.", "warning");
      }
    } catch (err) {
      console.error(err);
      showToast(`Lỗi: ${err.message}`, "error"); // Hiện lỗi gốc để kiểm tra
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      // Làm sạch chuỗi Base64
      const base64 = reader.result.split(',')[1];
      callGeminiAI(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '15px' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '200px', border: '2px dashed #007bff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fbff', cursor: 'pointer', overflow: 'hidden' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={35} color="#007bff" /><br/>Đang đọc...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center' }}><FiCamera size={40} color="#666" /><br/>Chụp Card / Bảng hiệu</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFile} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input 
          placeholder="Tên doanh nghiệp"
          value={scannedData.ten}
          onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
          style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        <input 
          placeholder="Số điện thoại"
          value={scannedData.sdt}
          onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
          style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        <button 
          style={{ width: '100%', padding: '15px', marginTop: '20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}
          onClick={() => showToast("Đã lưu!", "success")}
        >
          LƯU DANH BẠ
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
