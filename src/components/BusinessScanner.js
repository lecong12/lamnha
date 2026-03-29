import React, { useState } from 'react';
import { FiSearch, FiZap, FiAlertTriangle } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyA_3frlz1WTohsAXGAniuCjiOgT3zvdAQQ"; 

function BusinessScanner() {
  const [debugLog, setDebugLog] = useState("");
  const [loading, setLoading] = useState(false);

  // CHIÊU CUỐI: ĐIỀU TRA XEM GOOGLE CHO PHÉP MODEL NÀO
  const checkAvailableModels = async () => {
    setLoading(true);
    setDebugLog("Đang tra khảo Google...");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
      const data = await response.json();
      
      if (data.models) {
        // Lọc ra những model có thể đọc được ảnh (Vision/Flash)
        const names = data.models
          .map(m => m.name.replace("models/", ""))
          .filter(name => name.includes("flash") || name.includes("vision") || name.includes("pro"));
        
        setDebugLog("MODEL ANH ĐƯỢC DÙNG LÀ:\n" + names.join("\n"));
      } else {
        setDebugLog("Google báo: " + JSON.stringify(data.error));
      }
    } catch (err) {
      setDebugLog("Lỗi kết nối: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto', textAlign: 'center' }}>
      <h2 style={{ color: '#f5222d' }}>ĐIỀU TRA MODEL</h2>
      <p style={{ fontSize: '13px', color: '#666' }}>Bấm nút dưới để xem Google "cấp" cho anh model tên là gì!</p>
      
      <button 
        onClick={checkAvailableModels}
        disabled={loading}
        style={{ 
          width: '100%', padding: '20px', background: '#f5222d', 
          color: '#fff', border: 'none', borderRadius: '15px', 
          fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' 
        }}
      >
        {loading ? "ĐANG TRA KHẢO..." : "BẮT THÓP GOOGLE"}
      </button>

      <div style={{ 
        marginTop: '30px', padding: '15px', background: '#000', 
        color: '#0f0', borderRadius: '10px', fontSize: '14px', 
        textAlign: 'left', whiteSpace: 'pre-wrap', border: '2px solid #333' 
      }}>
        <strong>KẾT QUẢ TRA KHẢO:</strong><br/>
        {debugLog || "Chưa có dữ liệu. Bấm nút phía trên!"}
      </div>
    </div>
  );
}

export default BusinessScanner;
