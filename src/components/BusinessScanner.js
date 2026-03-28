import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiFileText, FiUser } from 'react-icons/fi';
import { addRowToSheet } from '../utils/sheetsAPI';
import './BusinessScanner.css';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 

function BusinessScanner({ showToast, onScanSuccess }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState('BILL'); 

  const [scannedData, setScannedData] = useState({
    tenDoanhNghiep: "",
    soDienThoai: "",
    soTien: 0,
    hinhAnh: ""
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setScanning(true);
    showToast("AI đang đọc dữ liệu qua cầu nối ưu tiên...", "info");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        // SỬ DỤNG PROXY ĐỂ CHỐNG TREO/XOAY TRÊN VERCEL
        const proxyUrl = "https://corsproxy.io/?"; 
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

        const prompt = scanMode === 'BILL' 
          ? "Đọc hóa đơn. Trả về JSON: { 'don_vi': 'Tên cửa hàng', 'so_tien': 100000 }. Chỉ trả về JSON."
          : "Đọc Card. Trả về JSON: { 'ten': 'Tên đơn vị', 'sdt': 'SĐT' }. Chỉ trả về JSON.";

        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }]
          })
        });

        const data = await response.json();
        
        // Upload Cloudinary để lưu ảnh cho AppSheet
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const cloudData = await resCloud.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
          const text = data.candidates[0].content.parts[0].text;
          const jsonMatch = text.match(/\{.*\}/s);
          const aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

          if (aiResult) {
            setScannedData({
              tenDoanhNghiep: aiResult.don_vi || aiResult.ten || "",
              soDienThoai: aiResult.sdt || "",
              soTien: aiResult.so_tien || 0,
              hinhAnh: cloudData.secure_url
            });
            showToast("Đã xong! Anh có thể sửa lại nếu cần.", "success");
            
            if (scanMode === 'BILL' && onScanSuccess) {
              onScanSuccess({ ...aiResult, image_url: cloudData.secure_url }, 'BILL');
            }
          }
        }
        setScanning(false);
      };
    } catch (err) {
      showToast("Lỗi kết nối AI", "error");
      setScanning(false);
    }
  };

  const handleSaveContact = async () => {
    if (!scannedData.tenDoanhNghiep) return showToast("Vui lòng nhập tên!", "warning");
    setSaving(true);
    try {
      const payload = {
        "ID": `DB_${Date.now()}`,
        "AnhCard": scannedData.hinhAnh,
        "TenDoanhNghiep": scannedData.tenDoanhNghiep,
        "SoDienThoai": scannedData.soDienThoai,
        "NgayQuet": new Date().toLocaleString('vi-VN'),
      };
      const res = await addRowToSheet("DanhBa", payload, APP_ID);
      if (res.success) {
        showToast("Đã lưu vào danh bạ!", "success");
        setScannedData({ tenDoanhNghiep: "", soDienThoai: "", soTien: 0, hinhAnh: "" });
        setImage(null);
      }
    } catch (e) { showToast("Lỗi lưu dữ liệu!", "error"); } finally { setSaving(false); }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        <div className="scanner-header">
          <h3><FiCamera /> Máy quét AI Công trình</h3>
          <div className="scan-mode-tabs">
            <button 
              className={scanMode === 'BILL' ? 'active' : ''} 
              onClick={() => { setScanMode('BILL'); setScannedData({...scannedData, tenDoanhNghiep: "", soTien: 0}); }}
            >
              <FiFileText /> Hóa đơn
            </button>
            <button 
              className={scanMode === 'CARD' ? 'active' : ''} 
              onClick={() => { setScanMode('CARD'); setScannedData({...scannedData, tenDoanhNghiep: "", soDienThoai: ""}); }}
            >
              <FiUser /> Card
            </button>
          </div>
        </div>

        <div className="scanner-body">
          <div className={`scan-preview-zone ${image ? 'has-img' : ''}`} onClick={() => !scanning && fileInputRef.current.click()}>
            {scanning ? (
              <div className="scan-overlay"><FiLoader className="spin" /> <span>Đang đọc...</span></div>
            ) : image ? (
              <img src={image} alt="preview" className="img-preview" />
            ) : (
              <div className="scan-placeholder">
                <FiImage size={35} />
                <span>Chụp ảnh hóa đơn Kim Long</span>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*" />
          </div>

          <div className="scan-result-form">
            <div className="field">
              <label>Tên Doanh nghiệp / Cửa hàng</label>
              <input 
                type="text" 
                value={scannedData.tenDoanhNghiep} 
                placeholder="Nhập tên..." 
                onChange={(e) => setScannedData({...scannedData, tenDoanhNghiep: e.target.value})} 
              />
            </div>
            
            <div className="field">
              <label>{scanMode === 'BILL' ? "Số tiền (VNĐ)" : "Số điện thoại"}</label>
              <input 
                type="text" 
                value={scanMode === 'BILL' ? scannedData.soTien : scannedData.soDienThoai} 
                placeholder={scanMode === 'BILL' ? "0" : "Nhập SĐT..."}
                onChange={(e) => setScannedData({...scannedData, [scanMode === 'BILL' ? 'soTien' : 'soDienThoai']: e.target.value})} 
              />
            </div>

            {scanMode === 'CARD' && (
              <button className="btn-save" onClick={handleSaveContact} disabled={saving || !image}>
                {saving ? <FiLoader className="spin" /> : <FiSave />} Lưu vào Danh bạ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessScanner;
