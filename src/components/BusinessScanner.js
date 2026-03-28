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

  const toggleMode = (mode) => {
    setScanMode(mode);
    setScannedData({ tenDoanhNghiep: "", soDienThoai: "", soTien: 0, hinhAnh: "" });
    setImage(null);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setScanning(true);
    showToast("AI đang kết nối trực tiếp...", "info");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
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
            showToast("Đã xong! Anh có thể sửa lại thông tin.", "success");
            
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
    if (!scannedData.tenDoanhNghiep) return showToast("Vui lòng điền tên cửa hàng!", "warning");
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
    } catch (e) { showToast("Lỗi lưu!", "error"); } finally { setSaving(false); }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        {/* Nút gạt chế độ đã fix */}
        <div className="scan-mode-switcher" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            type="button"
            style={{ flex: 1, padding: '10px', backgroundColor: scanMode === 'BILL' ? '#007bff' : '#eee', color: scanMode === 'BILL' ? '#fff' : '#000', border: 'none', borderRadius: '5px' }}
            onClick={() => toggleMode('BILL')}
          >
            <FiFileText /> Hóa đơn
          </button>
          <button 
            type="button"
            style={{ flex: 1, padding: '10px', backgroundColor: scanMode === 'CARD' ? '#007bff' : '#eee', color: scanMode === 'CARD' ? '#fff' : '#000', border: 'none', borderRadius: '5px' }}
            onClick={() => toggleMode('CARD')}
          >
            <FiUser /> Danh thiếp
          </button>
        </div>

        <div className="scanner-body">
          <div className="scan-preview-zone" style={{ border: '2px dashed #ccc', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }} onClick={() => !scanning && fileInputRef.current.click()}>
            {scanning ? (
              <div className="scan-overlay"><FiLoader className="spin" /> <span>Đang đọc...</span></div>
            ) : image ? (
              <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="scan-placeholder" style={{ textAlign: 'center' }}><FiImage size={35} /><br/><span>Bấm để chụp ảnh</span></div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*" />
          </div>

          <div className="scan-result-form" style={{ marginTop: '20px' }}>
            <div className="input-group" style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontWeight: 'bold' }}>Tên Doanh nghiệp / Cửa hàng</label>
              <input 
                type="text" 
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                value={scannedData.tenDoanhNghiep} 
                onChange={(e) => setScannedData({...scannedData, tenDoanhNghiep: e.target.value})} 
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontWeight: 'bold' }}>{scanMode === 'BILL' ? "Số tiền (VNĐ)" : "Số điện thoại"}</label>
              <input 
                type="text" 
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                value={scanMode === 'BILL' ? scannedData.soTien : scannedData.soDienThoai} 
                onChange={(e) => setScannedData({...scannedData, [scanMode === 'BILL' ? 'soTien' : 'soDienThoai']: e.target.value})} 
              />
            </div>

            {scanMode === 'CARD' && (
              <button 
                type="button"
                style={{ width: '100%', padding: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                onClick={handleSaveContact} 
                disabled={saving || !image}
              >
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
