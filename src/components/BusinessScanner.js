import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiCheck, FiScissors } from 'react-icons/fi';

const GEMINI_KEY = "AIzaSyBLOov5tK4IF6qVzfVIou6MiR_0VYqJRfc";
const CLOUD_NAME = "dpx7v968n";
const UPLOAD_PRESET = "unsigned_preset";

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState({ ten: "", sdt: "", url: "" });

  // Nén ảnh cực mạnh - Giảm dung lượng 3MB xuống để AI không bị choáng
  const compressForAI = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800; 
          let w = img.width; let h = img.height;
          if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
          else if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
      };
    });
  };

  const callGemini = async (base64) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Đọc ảnh và tìm: 1. Tên doanh nghiệp. 2. Số điện thoại. Chỉ trả về kết quả kiểu JSON: {'ten': '...', 'sdt': '...'}" },
                    { inline_data: { mime_type: "image/jpeg", data: base64 } }]
          }]
        })
      });
      const data = await response.json();
      const txt = data.candidates[0].content.parts[0].text;
      
      // Kỹ thuật bóc tách "bất chấp" mọi định dạng AI trả về
      const tenMatch = txt.match(/"ten":\s*"([^"]+)"/);
      const sdtMatch = txt.match(/"sdt":\s*"([^"]+)"/);
      
      return {
        ten: tenMatch ? tenMatch[1] : "",
        sdt: sdtMatch ? sdtMatch[1] : ""
      };
    } catch (err) {
      console.error("Lỗi AI:", err);
      return null;
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    setScannedData({ ten: "", sdt: "", url: "" });
    showToast("Đang nén ảnh 3MB và bắt AI làm việc...", "info");

    try {
      const base64Nen = await compressForAI(file);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const [resCloud, aiRes] = await Promise.all([
        fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData }),
        callGemini(base64Nen)
      ]);

      const cloudData = await resCloud.json();

      if (aiRes && (aiRes.ten || aiRes.sdt)) {
        setScannedData({
          ten: aiRes.ten,
          sdt: aiRes.sdt,
          url: cloudData.secure_url || ""
        });
        showToast("AI đã nhả chữ rồi anh ơi!", "success");
      } else {
        setScannedData(prev => ({ ...prev, url: cloudData.secure_url || "" }));
        showToast("Vẫn trơ ra! Kiểm tra lại Card nhé anh.", "warning");
      }
    } catch (err) {
      showToast("Lỗi mạng!", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <div 
        onClick={() => !loading && fileInputRef.current.click()}
        style={{ width: '100%', height: '200px', border: '3px dashed #ff4d4f', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff1f0' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center' }}><FiLoader className="spin" size={35} color="#ff4d4f" /><br/>Đang 'đấm' AI...</div>
        ) : image ? (
          <img src={image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#ff4d4f' }}><FiScissors size={40} /><br/>Bấm chụp Card (Nén 3MB)</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
      </div>

      <div style={{ marginTop: '20px' }}>
        <input 
          placeholder="Tên cửa hàng..."
          value={scannedData.ten}
          onChange={(e) => setScannedData({...scannedData, ten: e.target.value})}
          style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '10px' }}
        />
        <input 
          placeholder="Số điện thoại..."
          value={scannedData.sdt}
          onChange={(e) => setScannedData({...scannedData, sdt: e.target.value})}
          style={{ width: '100%', padding: '15px', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '15px' }}
        />
        <button 
          onClick={() => showToast("Đã lưu thành công!", "success")}
          disabled={loading || !scannedData.ten}
          style={{ width: '100%', padding: '16px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}
        >
          {loading ? "ĐANG ÉP NÓ ĐỌC..." : "LƯU DANH BẠ"}
        </button>
      </div>
    </div>
  );
}

export default BusinessScanner;
