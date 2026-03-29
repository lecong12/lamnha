import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "" });

  // Hàm gọi API tách biệt hoàn toàn
  const callGeminiAI = async (base64) => {
    console.log("3. Đang gửi dữ liệu lên Google Gemini...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Đọc ảnh và trả về JSON: { 'ten': 'tên doanh nghiệp', 'sdt': 'số điện thoại' }. Chỉ trả về JSON." },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      });

      const data = await response.json();
      console.log("4. Kết quả từ AI:", data);

      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const text = data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{.*\}/s);
        const res = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (res) {
          setScannedData({ ten: res.ten || "", sdt: res.sdt || "" });
          showToast("Đã quét xong!", "success");
        }
      }
    } catch (err) {
      console.error("Lỗi API:", err);
      showToast("Không kết nối được AI", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log("X. Không có file nào được chọn.");
      return;
    }

    console.log("1. Đã chọn file:", file.name);
    setImage(URL.createObjectURL(file));
    setScanning(true);

    const reader = new FileReader();
    reader.onload = () => {
      console.log("2. Đã chuyển file sang Base64 xong.");
      const base64Data = reader.result.split(',')[1];
      callGeminiAI(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const triggerSelectFile = () => {
    console.log("0. Đang mở trình chọn file...");
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '450px', margin: 'auto' }}>
      <h3 style={{ fontSize: '18px', textAlign: 'center', marginBottom: '15px' }}>Máy quét Doanh nghiệp</h3>
      
      {/* VÙNG BẤM CHỌN FILE - ĐÃ FIX LỖI KHÔNG ĂN */}
      <button 
        type="button"
        onClick={triggerSelectFile}
        style={{ 
          width: '100%', height: '180px', border: '2px dashed #007bff', 
          borderRadius: '12px', background: '#f8fbff', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', outline: 'none'
        }}
      >
        {scanning ? (
          <>
            <FiLoader className="spin" size={30} color="#007bff" />
            <p style={{ marginTop: '10px', color: '#007bff' }}>Đang đọc dữ liệu...</p>
          </>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <>
            <FiCamera size={40} color="#666" />
            <p style={{ marginTop: '10px', color: '#666' }}>Bấm để chụp hoặc chọn ảnh</p>
          </>
        )}
      </button>

      {/* Input tàng hình - Bỏ capture để chọn được Gallery */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        accept="image/*" 
      />

      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>TÊN DOANH NGHIỆP</label>
          <input 
            type="text" 
            value={scannedData.ten}
            onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="AI sẽ điền hoặc anh tự nhập..."
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>SỐ ĐIỆN THOẠI</label>
          <input 
            type="text" 
            value={scannedData.sdt}
            onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
            style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '5px' }}
            placeholder="Số điện thoại..."
          />
        </div>

        <button 
          onClick={() => showToast("Đã lưu danh bạ!", "success")}
          style={{ 
            width: '100%', padding: '15px', background: '#28a745', color: '#fff', 
            border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          <FiSave /> LƯU DANH BẠ
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
