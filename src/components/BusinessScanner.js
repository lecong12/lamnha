import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiImage, FiFileText } from 'react-icons/fi';
import './BusinessScanner.css';

// KEY CỦA ANH CÔNG
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 

function BusinessScanner({ showToast, onScanSuccess }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState('BILL'); 
  const [scannedData, setScannedData] = useState({ tenDoanhNghiep: "", soTien: 0 });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setScanning(true);
    showToast("Đang kết nối AI qua đường truyền ưu tiên...", "info");

    try {
      // 1. Chuyển ảnh sang Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        // 2. SỬ DỤNG PROXY ĐỂ VƯỢT LỖI CHẶN KẾT NỐI (CORS)
        // Đây là "cầu nối" giúp lệnh của anh không bị xoay tròn
        const proxyUrl = "https://corsproxy.io/?"; 
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

        const prompt = scanMode === 'BILL' 
          ? "Đọc hóa đơn này. Trả về JSON: { 'don_vi': 'Tên cửa hàng', 'so_tien': 100000 }. Chỉ trả về JSON, không viết gì thêm."
          : "Đọc Card này. Trả về JSON: { 'ten': 'Tên đơn vị', 'sdt': 'SĐT' }. Chỉ trả về JSON.";

        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }]
          })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
          const text = data.candidates[0].content.parts[0].text;
          const jsonMatch = text.match(/\{.*\}/s);
          const aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

          if (aiResult) {
            setScannedData({
              tenDoanhNghiep: aiResult.don_vi || aiResult.ten || "Cửa hàng mới",
              soTien: aiResult.so_tien || 0
            });
            showToast("AI đã đọc xong hóa đơn!", "success");
            
            // Tự động báo về App.js nếu cần xử lý tiếp
            if (onScanSuccess) {
              onScanSuccess({ ...aiResult }, 'BILL');
            }
          }
        } else {
          showToast("AI không trả về kết quả, hãy thử lại!", "error");
        }
        setScanning(false);
      };
    } catch (err) {
      console.error("Lỗi:", err);
      showToast("Lỗi đường truyền, đang thử lại...", "error");
      setScanning(false);
    }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        <div className="scanner-header">
          <h3>Trợ lý AI - Quét Hóa đơn</h3>
          <div className="scan-mode-tabs">
            <button className={scanMode === 'BILL' ? 'active' : ''} onClick={() => setScanMode('BILL')}>Hóa đơn</button>
            <button className={scanMode === 'CARD' ? 'active' : ''} onClick={() => setScanMode('CARD')}>Danh thiếp</button>
          </div>
        </div>

        <div className="scanner-body">
          <div className="scan-preview-zone" onClick={() => !scanning && fileInputRef.current.click()}>
            {scanning ? (
              <div className="scan-overlay">
                <FiLoader className="spin" /> 
                <span>Đang xử lý dữ liệu...</span>
              </div>
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
              <label>Tên Đơn vị</label>
              <input type="text" value={scannedData.tenDoanhNghiep} placeholder="Đang chờ..." readOnly />
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
