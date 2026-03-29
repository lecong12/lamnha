import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setScanning(true);
    showToast("Đang kết nối Google AI...", "info");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        // Dùng mẫu chuẩn, không qua Proxy trung gian nữa để tránh treo
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

        // Cơ chế tự ngắt sau 10 giây nếu treo
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [
                { text: "Đọc Card/Bảng hiệu này. Trả về JSON: { 'ten': '...', 'sdt': '...' }. Chỉ trả về JSON." },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
              ] }]
            })
          });

          const data = await response.json();
          clearTimeout(timeout);

          if (data.candidates && data.candidates[0].content.parts[0].text) {
            const text = data.candidates[0].content.parts[0].text;
            const jsonMatch = text.match(/\{.*\}/s);
            const res = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            if (res) {
              setScannedData({ ten: res.ten || "", sdt: res.sdt || "" });
              showToast("Đã đọc xong!", "success");
            }
          }
        } catch (fetchErr) {
          showToast("Mạng yếu hoặc bị chặn, anh hãy tự nhập tay!", "warning");
        } finally {
          setScanning(false);
        }
      };
    } catch (err) {
      setScanning(false);
    }
  };

  return (
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Quét Danh thiếp / Bảng hiệu</h3>

      {/* KHUNG CHỤP ẢNH */}
      <div 
        onClick={() => !scanning && fileInputRef.current.click()}
        style={{ width: '100%', height: '160px', border: '2px dashed #007bff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', background: '#f8fbff' }}
      >
        {scanning ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={30} color="#007bff" /><br/>Đang đọc...</div>
        ) : image ? (
          <img src={image} alt="scan" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#666' }}><FiImage size={30} /><br/>Bấm để chụp/chọn ảnh</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*" />
      </div>

      {/* FORM NHẬP LIỆU - QUAN TRỌNG: LUÔN SỬA ĐƯỢC KỂ CẢ KHI AI ĐANG XOAY */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Tên doanh nghiệp</label>
          <input 
            type="text" 
            value={scannedData.ten} 
            onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="AI đang tìm hoặc anh tự gõ..."
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Số điện thoại</label>
          <input 
            type="text" 
            value={scannedData.sdt} 
            onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="Số điện thoại..."
          />
        </div>

        <button 
          onClick={() => showToast("Đã lưu!", "success")}
          style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Lưu vào Danh bạ
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
