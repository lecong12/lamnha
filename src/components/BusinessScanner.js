import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';

function App() {
  const CLOUD_NAME = "doqmshx5y";
  const UPLOAD_PRESET = "ml_default";
  const LOG_ID = "nhat_ky_du_lieu"; 

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewUrl, setViewUrl] = useState(null);

  // Form để điền thông tin sau khi quét
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", url: "" });
  const [showForm, setShowForm] = useState(false);

  const loadData = async () => {
    try {
      const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LOG_ID}.txt?v=${Date.now()}`);
      if (r.ok) {
        const text = await r.text();
        const data = text.split('\n').filter(l => l.length > 10).map(line => JSON.parse(line));
        setHistory(data.reverse()); 
      }
    } catch (e) { console.log("Chưa có dữ liệu."); }
  };

  useEffect(() => { loadData(); }, []);

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setMsg("Đang trích xuất dữ liệu...");

    try {
      // 1. OCR Đọc toàn bộ chữ
      const { data: { text } } = await Tesseract.recognize(file, 'vie');
      
      // 2. Thuật toán "nhặt" thông tin tự động
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      const phoneMatch = text.match(/(0|\+84)[0-9]{9,10}/g); // Tìm số điện thoại
      const name = lines[0] || "Khách hàng mới";
      const phone = phoneMatch ? phoneMatch[0] : "";
      const address = lines.find(l => l.toLowerCase().includes("đường") || l.toLowerCase().includes("tp") || l.toLowerCase().includes("quận")) || "";

      // 3. Đẩy ảnh lên Cloudinary lấy link trước
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      fd.append("resource_type", "auto");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
      const cloud = await res.json();

      // 4. Hiện Form để anh Công điền/sửa thông tin
      setExtractedData({ name, phone, address, url: cloud.secure_url });
      setShowForm(true);
      setMsg("");
    } catch (err) {
      setMsg("Lỗi quét: " + err.message);
    }
    setLoading(false);
  };

  const saveToCloud = async () => {
    setLoading(true);
    setMsg("Đang lưu hồ sơ...");
    try {
      const newItem = { 
        n: extractedData.name, 
        p: extractedData.phone, 
        a: extractedData.address, 
        u: extractedData.url, 
        t: new Date().toLocaleString('vi-VN') 
      };
      
      const updatedLog = [...history].reverse().concat(newItem).map(h => JSON.stringify(h)).join('\n');
      const logFile = new File([updatedLog], `${LOG_ID}.txt`, { type: 'text/plain' });
      
      const logFd = new FormData();
      logFd.append("file", logFile);
      logFd.append("upload_preset", UPLOAD_PRESET);
      logFd.append("public_id", LOG_ID);
      logFd.append("resource_type", "raw");

      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: logFd });
      
      setShowForm(false);
      loadData();
      alert("Đã lưu thông tin thành công!");
    } catch (e) { alert("Lỗi lưu trữ!"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '15px', fontFamily: 'Arial', maxWidth: '500px', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center', color: '#007bff' }}>TRÍCH XUẤT THÔNG TIN CARD</h3>

      {!showForm ? (
        <div style={{ background: '#f0f2f5', padding: '30px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #007bff' }}>
          {loading ? <b>{msg}</b> : (
            <label style={{ background: '#007bff', color: '#fff', padding: '15px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
               📸 QUÉT THẺ HOẶC CHỌN ẢNH
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <h4 style={{ marginTop: 0 }}>KIỂM TRA THÔNG TIN</h4>
          <div style={{ marginBottom: '10px' }}>
            <label>Tên/Đơn vị:</label>
            <input style={{ width: '100%', padding: '8px' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Số điện thoại:</label>
            <input style={{ width: '100%', padding: '8px' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Địa chỉ:</label>
            <textarea style={{ width: '100%', padding: '8px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} />
          </div>
          <button onClick={saveToCloud} style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
             XÁC NHẬN & LƯU LÊN MÂY
          </button>
          <button onClick={() => setShowForm(false)} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: 'red' }}>Hủy bỏ</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <b>DANH SÁCH KHÁCH HÀNG / HỒ SƠ</b>
        {history.map((item, i) => (
          <div key={i} style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{item.n}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>📞 {item.p}</div>
            </div>
            <button onClick={() => setViewUrl(item.u)} style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px' }}>XEM ẢNH</button>
          </div>
        ))}
      </div>

      {viewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zLogIndex: 99 }}>
          <button onClick={() => setViewUrl(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'red', color: '#fff' }}>ĐÓNG</button>
          <img src={viewUrl} style={{ width: '100%', marginTop: '50px' }} alt="view" />
        </div>
      )}
    </div>
  );
}

export default App;
