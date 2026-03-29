import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiCheck } from 'react-icons/fi';
import { addRowToSheet } from '../utils/sheetsAPI';

// CẤU HÌNH (Anh kiểm tra kỹ các biến môi trường này trên Vercel nhé)
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "dpx7v968n").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "unsigned_preset").replace(/['"]/g, '');
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "", url: "" });

  // 1. HÀM UPLOAD CLOUDINARY (Lấy link ảnh trước)
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      console.error("Lỗi Upload Cloudinary:", err);
      return null;
    }
  };

  // 2. HÀM GỌI GEMINI (Đọc thông tin từ ảnh)
  const callGemini = async (base64) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh danh thiếp/bảng hiệu. Trả về JSON: { 'ten': 'tên cửa hàng', 'sdt': 'số điện thoại' }. Chỉ trả về JSON." },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{.*\}/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      console.error("Lỗi Gemini:", err);
      return null;
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    showToast("Đang tải ảnh và phân tích...", "info");

    try {
      // BƯỚC A: Chuyển Base64 để gửi AI đọc ngay
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        
        // Chạy song song: Vừa upload Cloudinary vừa gọi AI để tiết kiệm thời gian
        const [imageUrl, aiRes] = await Promise.all([
          uploadToCloudinary(file),
          callGemini(base64)
        ]);

        if (aiRes || imageUrl) {
          setScannedData({
            ten: aiRes?.ten || "",
            sdt: aiRes?.sdt || "",
            url: imageUrl || ""
          });
          showToast(imageUrl ? "Đã upload và đọc xong!" : "Đã đọc xong (Lỗi upload)", imageUrl ? "success" : "warning");
        }
        setLoading(false);
      };
    } catch (err) {
      showToast("Có lỗi xảy ra!", "error");
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!scannedData.ten) return showToast("Vui lòng nhập tên cửa hàng!", "warning");
    setLoading(true);
    try {
      const payload = {
        "ID": `DB_${Date.now()}`,
        "TenDoanhNghiep": scannedData.ten,
        "SoDienThoai": scannedData.sdt,
        "AnhCard": scannedData.url,
        "NgayQuet": new Date().toLocaleString('vi-VN')
      };
      const res = await addRowToSheet("DanhBa", payload, APP_ID);
      if (res.success) {
        showToast("Đã lưu vào AppSheet!", "success");
        setImage(null);
        setScannedData({ ten: "", sdt: "", url: "" });
      }
    } catch (e) {
      showToast("Lỗi lưu dữ liệu!", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '2px dashed #007bff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f8fbff', overflow: 'hidden' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={30} color="#007bff" /><br/>Đang xử lý...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#666' }}><FiCamera size={30} /><br/>Chụp ảnh hoặc Chọn file</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '15px' }}>
        <input 
          placeholder="Tên cửa hàng..."
          value={scannedData.ten}
          onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
          style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        <input 
          placeholder="Số điện thoại..."
          value={scannedData.sdt}
          onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
          style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        
        {scannedData.url && <p style={{ fontSize: '11px', color: 'green', marginBottom: '10px' }}><FiCheck /> Ảnh đã tải lên máy chủ</p>}

        <button 
          onClick={handleSave}
          disabled={loading || !scannedData.ten}
          style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
        >
          {loading ? <FiLoader className="spin" /> : <FiSave />} LƯU DANH BẠ
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
