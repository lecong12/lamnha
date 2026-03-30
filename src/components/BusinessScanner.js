import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiUserPlus } from 'react-icons/fi';
import { extractInfoWithAI } from '../utils/aiService';
import { addRowToSheet } from '../utils/sheetsAPI';

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });
  const [debugLog, setDebugLog] = useState("");
  const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

  const callGemini = async (base64) => {
    try {
      const data = await extractInfoWithAI(`data:image/jpeg;base64,${base64}`, 'card');

      // Xử lý dữ liệu trích xuất từ AI Service
      if (data && (data.ten || data.sdt)) {
        setDebugLog(`AI ĐÃ TRÍCH XUẤT: ${data.ten || "N/A"} - ${data.sdt || "N/A"}`);
        return {
          ten: (data.ten || "").trim(),
          sdt: (data.sdt || "").trim()
        };
      }
      setDebugLog("AI không tìm thấy thông tin phù hợp.");
      return null;
    } catch (err) {
      // Xử lý lỗi JSON input tại đây
      const errorMsg = err.message.includes("Unexpected end of JSON") 
        ? "Lỗi: Server AI trả về phản hồi rỗng (Empty Response)."
        : err.message;
      setDebugLog(`Lỗi: ${errorMsg}`);
      return null;
    }
  };

  const handleSaveToContacts = async () => {
    if (!scannedData.ten) return showToast("Vui lòng nhập tên!", "warning");
    setSaving(true);
    try {
      const res = await addRowToSheet("DanhBa", scannedData, APP_ID);
      if (res.success) showToast("Đã lưu vào Danh Bạ!", "success");
      else throw new Error(res.message);
    } catch (err) {
      showToast("Lỗi lưu: " + err.message, "error");
    } finally { setSaving(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setDebugLog("Đang gửi ảnh lên Backend để xử lý AI...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280; // Tăng độ phân giải để AI đọc chữ nhỏ trên danh thiếp/hóa đơn tốt hơn
        canvas.height = (img.height / img.width) * 1280;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]; // Tăng chất lượng ảnh một chút
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
        <input placeholder="Tên..." value={scannedData.ten} onChange={(e) => setScannedData({...scannedData, ten: e.target.value})} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '10px' }} />
        <input placeholder="SĐT..." value={scannedData.sdt} onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})} style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px' }} />
        
        <button 
          onClick={handleSaveToContacts}
          disabled={saving || !scannedData.ten}
          style={{ width: '100%', marginTop: '15px', padding: '15px', borderRadius: '12px', background: '#16a34a', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' }}
        >
          {saving ? <FiLoader className="spin" /> : <FiUserPlus />} Lưu vào Danh Bạ
        </button>
      </div>

      <div style={{ marginTop: '30px', padding: '10px', background: '#000', color: '#0f0', borderRadius: '8px', fontSize: '11px', wordBreak: 'break-all' }}>
        <strong>BẢNG DEBUG (LẦN CUỐI CÙNG):</strong><br/>
        {debugLog || "Vui lòng chụp ảnh!"}
      </div>
    </div>
  );
}

export default BusinessScanner;
