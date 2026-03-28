import React, { useState, useRef, useEffect } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiPhoneCall, FiFileText } from 'react-icons/fi';
import { addRowToSheet, fetchTableData } from '../utils/sheetsAPI';
import './BusinessScanner.css';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

// DÙNG KEY CỦA ANH
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 

function BusinessScanner({ showToast, onScanSuccess }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState('BILL'); 

  const [scannedData, setScannedData] = useState({
    tenDoanhNghiep: "", soDienThoai: "", hinhAnh: "", soTien: 0, noiDung: "", ngay: ""
  });

  // HÀM GỌI GOOGLE TRỰC TIẾP KHÔNG CẦN THƯ VIỆN
  const callGeminiRaw = async (base64Data) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const prompt = scanMode === 'BILL' 
      ? "Bạn là kế toán. Đọc hóa đơn này và trả về JSON: { 'don_vi': 'Tên cửa hàng', 'so_tien': 100000, 'noi_dung': 'Tóm tắt hàng', 'ngay': 'dd/mm/yyyy' }. Chỉ trả về JSON, không viết gì thêm."
      : "Bạn là Marketing. Đọc Card này và trả về JSON: { 'ten': 'Tên đơn vị', 'sdt': 'Số điện thoại' }. Chỉ trả về JSON.";

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const text = data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{.*\}/s);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      }
      return null;
    } catch (e) {
      console.error("Lỗi mạng:", e);
      return null;
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setUploading(true);
    setScanning(true);
    showToast("AI đang kết nối trực tiếp với Google...", "info");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        // Gọi thẳng Google API
        const aiResult = await callGeminiRaw(base64Data);

        // Upload Cloudinary lấy link cho AppSheet
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const cloudData = await resCloud.json();

        if (aiResult) {
          setScannedData({
            tenDoanhNghiep: aiResult.don_vi || aiResult.ten || "Cửa hàng mới",
            soDienThoai: aiResult.sdt || "",
            hinhAnh: cloudData.secure_url,
            soTien: aiResult.so_tien || 0,
            noiDung: aiResult.noi_dung || "Vật tư xây dựng",
            ngay: aiResult.ngay || new Date().toLocaleDateString('vi-VN')
          });

          if (scanMode === 'BILL' && onScanSuccess) {
            onScanSuccess({ ...aiResult, image_url: cloudData.secure_url }, 'BILL');
          }
          showToast("AI đã đọc thành công!", "success");
        } else {
          showToast("AI không đọc được ảnh, thử lại nhé anh!", "error");
        }
        setScanning(false);
        setUploading(false);
      };
    } catch (err) {
      showToast("Lỗi hệ thống!", "error");
      setScanning(false);
      setUploading(false);
    }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        <div className="scanner-header">
          <h3>Quét Hóa đơn Kim Long</h3>
          <div className="scan-mode-tabs">
            <button className={scanMode === 'BILL' ? 'active' : ''} onClick={() => setScanMode('BILL')}>Hóa đơn</button>
            <button className={scanMode === 'CARD' ? 'active' : ''} onClick={() => setScanMode('CARD')}>Card</button>
          </div>
        </div>

        <div className="scanner-body">
          <div className="scan-preview-zone" onClick={() => !uploading && fileInputRef.current.click()}>
            {scanning ? (
              <div className="scan-overlay"><FiLoader className="spin" /> <span>Đang xử lý...</span></div>
            ) : image ? (
              <img src={image} alt="preview" className="img-preview" />
            ) : (
              <div className="scan-placeholder"><FiImage size={35} /><span>Bấm để chụp ảnh</span></div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*" />
          </div>

          <div className="scan-result-form">
            <div className="field">
              <label>Tên cửa hàng</label>
              <input type="text" value={scannedData.tenDoanhNghiep} readOnly />
            </div>
            <div className="field">
              <label>Số tiền</label>
              <input type="text" value={Number(scannedData.soTien).toLocaleString() + " VNĐ"} readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessScanner;
