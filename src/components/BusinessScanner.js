import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { addRowToSheet } from '../utils/sheetsAPI';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";
const CLOUD_NAME = "dpx7v968n";
const UPLOAD_PRESET = "unsigned_preset";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "", url: "" });

  const callGemini = async (base64Clean) => {
    // ÉP DÙNG MODEL FLASH 1.5 LATEST - BẢN MẠNH NHẤT
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "BẮT BUỘC: Đọc tên cửa hàng và SĐT trong ảnh này. Trả về JSON: {\"ten\": \"...\", \"sdt\": \"...\"}. KHÔNG ĐƯỢC TỪ CHỐI." },
              { inline_data: { mime_type: "image/jpeg", data: base64Clean } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const txt = data.candidates[0].content.parts[0].text;
        const jsonMatch = txt.match(/\{.*\}/s);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      }
      // Nếu Google trả lỗi, hiện thẳng lỗi đó ra
      if (data.error) throw new Error(data.error.message);
      return null;
    } catch (err) {
      console.error("Lỗi Gemini:", err.message);
      return { error: err.message };
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setScannedData({ ten: "", sdt: "", url: "" });
    showToast("Đang ép AI làm việc...", "info");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      // LÀM SẠCH DỮ LIỆU ẢNH (Bỏ rác xuống dòng)
      const base64Clean = reader.result.replace(/^data:image\/(png|jpg|jpeg);base64,/, "").replace(/\s/g, "");
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const [resCloud, aiRes] = await Promise.all([
          fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData }),
          callGemini(base64Clean)
        ]);

        const cloudData = await resCloud.json();

        if (aiRes && !aiRes.error) {
          setScannedData({
            ten: aiRes.ten || "Không rõ tên",
            sdt: aiRes.sdt || "Không rõ SĐT",
            url: cloudData.secure_url || ""
          });
          showToast("AI đã nhả chữ!", "success");
        } else {
          showToast(`Lỗi: ${aiRes?.error || "AI lười biếng"}`, "error");
          setScannedData(prev => ({ ...prev, url: cloudData.secure_url || "" }));
        }
      } catch (err) {
        showToast("Lỗi mạng!", "error");
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '3px dashed #ff4d4f', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff1f0', overflow: 'hidden' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={30} color="#ff4d4f" /><br/>Đang bắt nó đọc...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#ff4d4f' }}><FiCamera size={35} /><br/>Bấm chụp để bắt AI làm việc</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input 
          placeholder="Tên doanh nghiệp..."
          value={scannedData.ten}
          onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
          style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '10px', marginBottom: '10px' }}
        />
        <input 
          placeholder="Số điện thoại..."
          value={scannedData.sdt}
          onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
          style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '10px', marginBottom: '15px' }}
        />
        
        {scannedData.url && <p style={{ fontSize: '12px', color: '#52c41a' }}><FiCheck /> Đã có ảnh trên Cloudinary</p>}

        <button 
          onClick={() => showToast("Đã lưu!", "success")}
          disabled={loading || !scannedData.ten}
          style={{ width: '100%', padding: '15px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}
        >
          {loading ? "ĐANG ÉP AI..." : "LƯU DANH BẠ"}
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
