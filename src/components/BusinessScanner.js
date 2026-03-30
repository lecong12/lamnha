import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';

function App() {
  const CLOUD_NAME = "doqmshx5y";
  const UPLOAD_PRESET = "ml_default";
  const LOG_ID = "nhat_ky_du_lieu"; // Tên file lưu danh sách trên Cloudinary

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewPdf, setViewPdf] = useState(null);

  // 1. Tải danh sách từ Cloudinary - Chống lỗi Parse và Pattern
  const loadData = async () => {
    try {
      const timestamp = new Date().getTime();
      const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LOG_ID}.txt?v=${timestamp}`);
      
      if (r.ok) {
        const text = await r.text();
        // Tách dòng và kiểm tra tính hợp lệ của JSON để tránh lỗi crash app
        const lines = text.split('\n').filter(l => l.trim().length > 10);
        const data = lines.map(line => {
          try { return JSON.parse(line); } catch(e) { return null; }
        }).filter(item => item !== null);
        
        setHistory(data.reverse()); // Hiện cái mới nhất lên đầu
      }
    } catch (e) {
      console.log("Hệ thống chưa có dữ liệu hoặc lỗi kết nối mạng.");
    }
  };

  // Tự động tải dữ liệu khi mở app và mỗi 30 giây
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = async (file) => {
    if (!file) return;
    setLoading(true);
    setMsg("Đang đọc chữ...");

    try {
      // OCR trích xuất thông tin
      const { data: { text } } = await Tesseract.recognize(file, 'vie');
      const lines = text.split('\n').filter(l => l.trim().length > 2);
      const rawTitle = lines[0] || "Khach_Hang";

      // SỬA LỖI PATTERN: Loại bỏ hoàn toàn dấu tiếng Việt và ký tự lạ
      const cleanName = rawTitle.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);

      setMsg("Đang gửi lên Cloudinary...");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      fd.append("public_id", `scan_${cleanName}_${Date.now()}`);
      fd.append("resource_type", "auto"); // Tự động nhận diện ảnh/pdf

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { 
        method: "POST", 
        body: fd 
      });
      const cloud = await res.json();

      if (res.ok) {
        setMsg("Đang đồng bộ nhật ký...");
        
        // Tạo mục mới
        const newItem = { 
          n: cleanName, 
          u: cloud.secure_url, 
          t: new Date().toLocaleString('vi-VN') 
        };

        // Kết hợp dữ liệu cũ và mới (Dùng reverse để giữ đúng thứ tự file cũ)
        const oldData = [...history].reverse();
        const updatedLog = [...oldData, newItem].map(h => JSON.stringify(h)).join('\n');
        
        // SỬA LỖI BLOB TRÊN ĐIỆN THOẠI: Dùng File thay vì Blob nếu cần
        const logFile = new File([updatedLog], `${LOG_ID}.txt`, { type: 'text/plain' });

        const logFd = new FormData();
        logFd.append("file", logFile);
        logFd.append("upload_preset", UPLOAD_PRESET);
        logFd.append("public_id", LOG_ID);
        logFd.append("resource_type", "raw");

        await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { 
          method: "POST", 
          body: logFd 
        });
        
        setMsg("Thành công!");
        setTimeout(() => {
          setMsg("");
          loadData();
        }, 1500);
      }
    } catch (err) {
      setMsg("Lỗi: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h3 style={{ color: '#2c3e50', textAlign: 'center', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
        QUẢN LÝ HỒ SƠ - LÊ CÔNG
      </h3>
      
      <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #3498db', marginBottom: '20px' }}>
        {loading ? (
          <div style={{ color: '#e67e22', fontWeight: 'bold' }}>{msg}</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              capture="environment" 
              onChange={e => handleScan(e.target.files[0])} 
              id="file-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" style={{ background: '#3498db', color: '#fff', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              📸 QUÉT THẺ / TẢI HỒ SƠ
            </label>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ color: '#7f8c8d' }}>DANH SÁCH ĐỒNG BỘ</b>
        <button onClick={loadData} style={{ border: 'none', background: 'none', color: '#3498db', fontSize: '12px' }}>🔄 Làm mới</button>
      </div>

      <div style={{ marginTop: '15px', maxHeight: '400px', overflowY: 'auto' }}>
        {history.length === 0 && <p style={{ textAlign: 'center', color: '#bdc3c7' }}>Chưa có file nào trên mây.</p>}
        {history.map((item, i) => (
          <div key={i} style={{ padding: '12px', borderBottom: '1px solid #ecf0f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2c3e50' }}>{item.n}</div>
              <div style={{ fontSize: '11px', color: '#95a5a6' }}>{item.t}</div>
            </div>
            <button 
              onClick={() => setViewPdf(item.u)} 
              style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', fontSize: '12px' }}
            >
              XEM
            </button>
          </div>
        ))}
      </div>

      {viewPdf && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 999 }}>
          <div style={{ height: '50px', display: 'flex', justifyContent: 'flex-end', padding: '10px' }}>
            <button onClick={() => setViewPdf(null)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 20px', borderRadius: '5px', fontWeight: 'bold' }}>ĐÓNG</button>
          </div>
          <div style={{ height: 'calc(100% - 70px)', overflow: 'auto', textAlign: 'center' }}>
             {viewPdf.toLowerCase().endsWith('.pdf') ? (
               <iframe src={viewPdf} style={{ width: '100%', height: '100%', border: 'none' }} title="view" />
             ) : (
               <img src={viewPdf} style={{ maxWidth: '100%' }} alt="view" />
             )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
