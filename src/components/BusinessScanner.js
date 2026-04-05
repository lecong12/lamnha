import React, { useState, useEffect, useCallback } from 'react';
import { FiCamera, FiEye, FiLoader, FiCheck, FiX } from 'react-icons/fi';
import Tesseract from 'tesseract.js';

// Chuyển các hằng số cấu hình ra ngoài component để tránh việc khởi tạo lại mỗi lần render
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
const LOG_ID = "nhat_ky_du_lieu";

// Hàm bổ trợ trích xuất thông tin bằng Regex từ text thuần (Dành cho Tesseract)
const parseOcrText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  
  // Tìm số điện thoại Việt Nam
  const phoneRegex = /(0[3|5|7|8|9][0-9]{8}|02[0-9]{8,9})/g;
  const phones = text.match(phoneRegex);
  
  return {
    name: lines[0] || "Khách hàng mới",
    phone: phones ? phones[0] : "",
    address: lines.find(l => l.toLowerCase().includes("địa chỉ") || l.toLowerCase().includes("đ/c") || l.toLowerCase().includes("số")) || ""
  };
};

function BusinessScanner() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);

  // Dùng useCallback để hàm loadData không bị thay đổi định danh giữa các lần render
  const loadData = useCallback(async () => {
    try {
      const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LOG_ID}.txt?v=${Date.now()}`);
      if (r.ok) {
        const text = await r.text();
        const data = text.split('\n').filter(l => l.length > 10).map(line => JSON.parse(line));
        setHistory(data.reverse());
      }
    } catch (e) { console.log("Chưa có dữ liệu."); }
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setMsg("Đang khởi tạo máy quét...");

    try {
      // 1. Nhận diện văn bản trực tiếp bằng Tesseract (Client-side)
      const { data: { text } } = await Tesseract.recognize(file, 'vie+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setMsg(`Đang quét: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const parsedData = parseOcrText(text);

      // 2. Upload ảnh lên Cloudinary để lưu trữ làm minh chứng
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
      const cloud = await resCloud.json();

      setExtractedData({ 
        name: parsedData.name, 
        phone: parsedData.phone, 
        address: parsedData.address, 
        url: cloud.secure_url 
      });
      setShowForm(true);
    } catch (err) {
      alert("Lỗi máy quét: " + err.message);
    }
    setLoading(false);
  };

  const saveFinal = async () => {
    setLoading(true);
    try {
      const newItem = { 
        n: extractedData.name, p: extractedData.phone, a: extractedData.address, 
        u: extractedData.url, t: new Date().toLocaleString('vi-VN') 
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
      alert("Đã lưu!");
    } catch (e) { alert("Lỗi mạng!"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '15px', maxWidth: '500px', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center', color: 'var(--accent-color)', marginBottom: '20px' }}>MÁY QUÉT CARD TESSERACT</h3>

      {!showForm ? (
        <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '15px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <FiLoader className="spin" size={30} />
              <b>{msg}</b>
            </div>
          ) : (
            <label style={{ background: 'var(--accent-color)', color: '#fff', padding: '15px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
               <FiCamera size={20} /> QUÉT CARD / BẢNG HIỆU
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ color: '#16a34a', margin: 0 }}>KẾT QUẢ QUÉT:</h4>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}><FiX size={20}/></button>
          </div>
          <div style={{ marginBottom: '10px' }}><small>Tên đơn vị:</small><input style={{ width: '100%', padding: '10px' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} /></div>
          <div style={{ marginBottom: '10px' }}><small>Số điện thoại:</small><input style={{ width: '100%', padding: '10px' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} /></div>
          <div style={{ marginBottom: '15px' }}><small>Địa chỉ:</small><textarea style={{ width: '100%', padding: '10px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} /></div>
          <button onClick={saveFinal} style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <FiCheck /> XÁC NHẬN LƯU
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {history.map((item, i) => (
          <div key={i} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '8px', marginBottom: '8px' }}>
            <div><b style={{ color: 'var(--text-main)' }}>{item.n}</b><br/><small style={{ color: 'var(--text-muted)' }}>{item.p} - {item.t}</small></div>
            <button onClick={() => setViewUrl(item.u)} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '5px', padding: '8px 12px', cursor: 'pointer' }}><FiEye /></button>
          </div>
        ))}
      </div>

      {viewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 100 }}>
          <button onClick={() => setViewUrl(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'red', color: '#fff', padding: '10px' }}>ĐÓNG</button>
          <img src={viewUrl} style={{ width: '100%', marginTop: '60px' }} alt="origin" />
        </div>
      )}
    </div>
  );
}

export default BusinessScanner;
