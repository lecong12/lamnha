import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { addRowToSheet } from '../utils/sheetsAPI';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "dpx7v968n").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "unsigned_preset").replace(/['"]/g, '');
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; // Key trực tiếp của anh
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "", url: "" });

  // 1. GỌI GEMINI VỚI PROMPT CƯỜNG ĐỘ CAO
  const callGemini = async (base64) => {
    // Sử dụng v1beta để hỗ trợ inline_data tốt nhất
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Bạn là chuyên gia đọc bảng hiệu và danh thiếp Việt Nam. Hãy tìm tên cửa hàng/doanh nghiệp và số điện thoại trong ảnh. TRẢ VỀ DUY NHẤT JSON định dạng: {\"ten\": \"...\", \"sdt\": \"...\"}. Không giải thích gì thêm." },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      // Kiểm tra nếu API trả lỗi (hết hạn, sai key...)
      if (data.error) {
        console.error("Lỗi API Gemini:", data.error.message);
        return { error: data.error.message };
      }

      const text = data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{.*\}/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      console.error("Lỗi kết nối Gemini:", err);
      return null;
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setScannedData({ ten: "", sdt: "", url: "" });
    showToast("Đang tải ảnh và trích xuất thông tin...", "info");

    // Đọc file sang Base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      
      try {
        // GỌI ĐỒNG THỜI
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const [resCloud, aiRes] = await Promise.all([
          fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData }),
          callGemini(base64)
        ]);

        const cloudData = await resCloud.json();

        if (aiRes && !aiRes.error) {
          setScannedData({
            ten: aiRes.ten || "",
            sdt: aiRes.sdt || "",
            url: cloudData.secure_url || ""
          });
          showToast("AI đã đọc thông tin thành công!", "success");
        } else if (aiRes?.error) {
          showToast(`Lỗi AI: ${aiRes.error}`, "error");
          setScannedData(prev => ({ ...prev, url: cloudData.secure_url || "" }));
        } else {
          showToast("AI không thấy thông tin, anh hãy tự nhập tay.", "warning");
          setScannedData(prev => ({ ...prev, url: cloudData.secure_url || "" }));
        }
      } catch (err) {
        showToast("Lỗi hệ thống, vui lòng thử lại.", "error");
      } finally {
        setLoading(false);
      }
    };
  };

  const handleSave = async () => {
    if (!scannedData.ten) return showToast("Vui lòng nhập tên doanh nghiệp!", "warning");
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
        showToast("Đã lưu vào danh bạ thành công!", "success");
        setImage(null);
        setScannedData({ ten: "", sdt: "", url: "" });
      }
    } catch (e) {
      showToast("Lỗi khi gửi dữ liệu lên AppSheet", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', maxWidth: '400px', margin: 'auto', background: '#fff', borderRadius: '15px', border: '1px solid #eee' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '2px dashed #007bff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f0f7ff', overflow: 'hidden' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={30} color="#007bff" /><br/>Đang xử lý...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#666' }}><FiCamera size={35} /><br/>Bấm để quét Card</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: '#999' }}>TÊN DOANH NGHIỆP</label>
          <input 
            value={scannedData.ten}
            onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="Tên cửa hàng..."
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: '#999' }}>SỐ ĐIỆN THOẠI</label>
          <input 
            value={scannedData.sdt}
            onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="Số điện thoại..."
          />
        </div>
        
        {scannedData.url ? (
          <p style={{ fontSize: '12px', color: '#28a745', marginBottom: '15px' }}><FiCheck /> Ảnh đã lưu trên máy chủ</p>
        ) : (
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}><FiAlertCircle /> Chưa có ảnh</p>
        )}

        <button 
          onClick={handleSave}
          disabled={loading || !scannedData.ten}
          style={{ width: '100%', padding: '15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? <FiLoader className="spin" /> : <FiSave />} LƯU DANH BẠ
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
