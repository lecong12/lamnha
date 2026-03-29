import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiFileText, FiUser } from 'react-icons/fi';
import { addRowToSheet } from '../utils/sheetsAPI';

// KEY CỦA ANH CÔNG
const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc"; 
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function BusinessScanner({ showToast, onScanSuccess }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState('BILL'); // 'BILL' hoặc 'CARD'

  const [scannedData, setScannedData] = useState({
    tenDoanhNghiep: "", soDienThoai: "", soTien: "", hinhAnh: ""
  });

  // HÀM GỌI AI TRỰC TIẾP
  const callAI = async (base64Data) => {
    const proxyUrl = "https://corsproxy.io/?"; 
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const prompt = scanMode === 'BILL' 
      ? "Đọc hóa đơn. Trả về JSON: { 'don_vi': 'Tên cửa hàng', 'so_tien': '100000' }. Chỉ trả về JSON."
      : "Đọc Card. Trả về JSON: { 'ten': 'Tên đơn vị', 'sdt': 'SĐT' }. Chỉ trả về JSON.";

    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }]
      })
    });
    return await response.json();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setScanning(true);
    showToast("AI đang đọc ảnh...", "info");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        const data = await callAI(base64Data);

        if (data.candidates && data.candidates[0].content.parts[0].text) {
          const text = data.candidates[0].content.parts[0].text;
          const jsonMatch = text.match(/\{.*\}/s);
          const res = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

          if (res) {
            const finalData = {
              tenDoanhNghiep: res.don_vi || res.ten || "",
              soDienThoai: res.sdt || "",
              soTien: res.so_tien || "",
            };
            setScannedData(finalData);
            
            // ĐỒNG BỘ QUICKNOTE: Gửi dữ liệu về App.js
            if (onScanSuccess) {
              onScanSuccess(finalData, scanMode);
            }
            showToast("Quét xong! Dữ liệu đã chuyển sang Ghi chú.", "success");
          }
        }
        setScanning(false);
      };
    } catch (err) {
      showToast("Lỗi kết nối AI", "error");
      setScanning(false);
    }
  };

  return (
    <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '15px', maxWidth: '400px', margin: 'auto' }}>
      {/* NÚT GẠT CHẾ ĐỘ - ĐÃ FIX CHẮC CHẮN HOẠT ĐỘNG */}
      <div style={{ display: 'flex', background: '#eee', borderRadius: '10px', padding: '5px', marginBottom: '15px' }}>
        <button 
          onClick={() => setScanMode('BILL')}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: scanMode === 'BILL' ? '#007bff' : 'transparent', color: scanMode === 'BILL' ? '#fff' : '#555', transition: '0.3s' }}
        >
          <FiFileText /> Hóa đơn
        </button>
        <button 
          onClick={() => setScanMode('CARD')}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: scanMode === 'CARD' ? '#007bff' : 'transparent', color: scanMode === 'CARD' ? '#fff' : '#555', transition: '0.3s' }}
        >
          <FiUser /> Danh thiếp
        </button>
      </div>

      {/* KHUNG CHỤP ẢNH */}
      <div 
        onClick={() => !scanning && fileInputRef.current.click()}
        style={{ width: '100%', height: '180px', border: '2px dashed #007bff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#fff' }}
      >
        {scanning ? (
          <div style={{ textAlign: 'center', color: '#007bff' }}><FiLoader className="spin" size={30} /><br/>AI đang đọc...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#666' }}><FiImage size={35} /><br/>Bấm để chụp ảnh</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*" />
      </div>

      {/* CÁC Ô NHẬP LIỆU - CHO PHÉP SỬA TAY */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Tên Doanh nghiệp / Cửa hàng</label>
          <input 
            type="text" 
            value={scannedData.tenDoanhNghiep} 
            onChange={(e) => setScannedData({...scannedData, tenDoanhNghiep: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>{scanMode === 'BILL' ? "Số tiền (VNĐ)" : "Số điện thoại"}</label>
          <input 
            type="text" 
            value={scanMode === 'BILL' ? scannedData.soTien : scannedData.soDienThoai} 
            onChange={(e) => setScannedData({...scannedData, [scanMode === 'BILL' ? 'soTien' : 'soDienThoai']: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
          />
        </div>

        {scanMode === 'CARD' && (
          <button 
            onClick={() => showToast("Đang lưu danh bạ...", "info")} 
            style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
          >
            <FiSave /> Lưu vào Danh bạ
          </button>
        )}
      </div>
    </div>
  );
}

export default BusinessScanner;
