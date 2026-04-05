import React, { useState, useEffect } from 'react';
import { FiCamera, FiLoader, FiSave, FiX, FiCheck, FiUser, FiPhone, FiMapPin, FiEye } from 'react-icons/fi';
import { extractInfoWithAI } from "../utils/aiService";

function BusinessScanner() {
  const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
  const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
  const LOG_ID = "nhat_ky_du_lieu";

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);

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
    setMsg("AI đang phân tích ảnh...");

    try {
      // 1. Chuyển file ảnh sang Base64 để gửi lên API
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const base64Image = await base64Promise;

      // 2. Gọi AI Service đã được cấu hình ở backend (an toàn hơn)
      const aiData = await extractInfoWithAI(base64Image, 'card');

      // 3. Upload ảnh lên Cloudinary để lưu trữ minh chứng
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
      const cloud = await resCloud.json();

      setExtractedData({
        name: aiData.ten || "Khách hàng mới",
        phone: aiData.sdt || "",
        address: aiData.diaChi || "",
        url: cloud.secure_url
      });
      setShowForm(true);
    } catch (err) {
      alert("Không thể phân tích ảnh: " + err.message);
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
      <h3 style={{ textAlign: 'center', color: 'var(--accent-color)', marginBottom: '20px' }}>MÁY QUÉT HỒ SƠ AI</h3>

      {!showForm ? (
        <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '15px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
          {loading ? <b>{msg}</b> : (
            <label style={{ background: 'var(--accent-color)', color: '#fff', padding: '15px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
               <FiCamera size={20} /> QUÉT CARD / BẢNG HIỆU
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ color: '#16a34a', marginTop: 0 }}>AI ĐÃ TRÍCH XUẤT XONG:</h4>
          <div style={{ marginBottom: '10px' }}><small>Tên đơn vị:</small><input style={{ width: '100%', padding: '10px' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} /></div>
          <div style={{ marginBottom: '10px' }}><small>Số điện thoại:</small><input style={{ width: '100%', padding: '10px' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} /></div>
          <div style={{ marginBottom: '15px' }}><small>Địa chỉ:</small><textarea style={{ width: '100%', padding: '10px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} /></div>
          <button onClick={saveFinal} style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>XÁC NHẬN LƯU NHẬT KÝ</button>
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
