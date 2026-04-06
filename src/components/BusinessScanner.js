import React, { useState, useEffect, useCallback } from 'react';
import { FiCamera, FiEye, FiLoader, FiCheck, FiX, FiPhone, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { extractInfoWithAI } from '../utils/aiService';
import { addRowToSheet, fetchTableData, deleteRowFromSheet } from '../utils/sheetsAPI';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const TABLE_NAME = "DoiTac"; // Tên bảng lưu danh bạ đối tác

function BusinessScanner({ showToast }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", mst: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);

  const loadData = useCallback(async () => {
    if (!APP_ID) return;
    setLoading(true);
    try {
      const res = await fetchTableData(TABLE_NAME, APP_ID);
      if (res.success) {
        // Sắp xếp theo dòng mới nhất lên đầu dựa vào _RowNumber
        const sorted = (res.data || []).sort((a, b) => (b._RowNumber || 0) - (a._RowNumber || 0));
        setHistory(sorted);
      }
    } catch (e) {
      console.error("Lỗi tải danh bạ:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    setMsg("Đang tải ảnh lên...");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      
      const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { 
        method: "POST", 
        body: fd 
      });
      const cloud = await resCloud.json();

      if (!cloud.secure_url) throw new Error("Lỗi upload ảnh.");

      setMsg("AI đang phân tích dữ liệu...");
      const aiData = await extractInfoWithAI(cloud.secure_url, 'card');

      setExtractedData({ 
        name: aiData.ten || "", 
        phone: aiData.sdt || "", 
        address: aiData.diaChi || "", 
        mst: aiData.mst || "",
        url: cloud.secure_url 
      });
      setShowForm(true);
    } catch (err) {
      showToast?.("Lỗi máy quét: " + err.message, "error");
    } finally {
      setScanning(false);
    }
  };

  const saveFinal = async () => {
    setLoading(true);
    try {
      const rowData = {
        id: `DT_${Date.now()}`,
        ten: extractedData.name,
        sdt: extractedData.phone,
        diaChi: extractedData.address,
        mst: extractedData.mst,
        hinhAnh: extractedData.url,
        ngay: new Date().toLocaleDateString('vi-VN')
      };

      const res = await addRowToSheet(TABLE_NAME, rowData, APP_ID);
      if (res.success) {
        setShowForm(false);
        await loadData();
        showToast?.("Đã lưu vào danh bạ thành công!", "success");
      } else {
        throw new Error(res.message);
      }
    } catch (e) { 
      showToast?.("Lỗi lưu dữ liệu: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xác nhận xóa liên hệ này khỏi danh bạ?")) {
      const res = await deleteRowFromSheet(TABLE_NAME, id, APP_ID);
      if (res.success) {
        loadData();
        showToast?.("Đã xóa liên hệ.", "success");
      }
    }
  };

  return (
    <div className="scanner-container" style={{ padding: '15px', maxWidth: '600px', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center', color: 'var(--accent-color)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <FiCamera /> MÁY QUÉT DANH THIẾP AI
      </h3>

      {!showForm ? (
        <div style={{ background: 'var(--bg-card)', padding: '40px 20px', borderRadius: '15px', textAlign: 'center', border: '2px dashed var(--border-color)', boxShadow: 'var(--shadow)' }}>
          {scanning ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <FiLoader className="spin" size={32} />
              <b style={{ color: 'var(--text-main)' }}>{msg}</b>
            </div>
          ) : (
            <label style={{ background: 'var(--accent-color)', color: '#fff', padding: '18px 30px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
               <FiCamera size={24} /> CHỤP CARD / BẢNG HIỆU
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
          <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sử dụng AI để tự động nhận diện thông tin đối tác</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '15px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ color: 'var(--accent-color)', margin: 0 }}>THÔNG TIN TRÍCH XUẤT</h4>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiX size={24}/></button>
          </div>
          <div style={{ marginBottom: '12px' }}><small style={{color: 'var(--text-muted)'}}>Tên đơn vị:</small><input style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} /></div>
          <div style={{ marginBottom: '12px' }}><small style={{color: 'var(--text-muted)'}}>Số điện thoại:</small><input style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} /></div>
          <div style={{ marginBottom: '20px' }}><small style={{color: 'var(--text-muted)'}}>Địa chỉ:</small><textarea style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} /></div>
          <button onClick={saveFinal} disabled={loading} style={{ width: '100%', padding: '15px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {loading ? <FiLoader className="spin" /> : <FiCheck size={20} />} XÁC NHẬN LƯU DANH BẠ
          </button>
        </div>
      )}

      <div className="history-list" style={{ marginTop: '30px' }}>
        <h4 style={{ color: 'var(--text-main)', borderBottom: '2px solid var(--accent-color)', paddingBottom: '10px', marginBottom: '15px' }}>DANH BẠ ĐÃ LƯU ({history.length})</h4>
        {loading && !scanning && <div style={{textAlign: 'center', padding: '20px'}}><FiLoader className="spin" /> Đang đồng bộ...</div>}
        {history.map((item) => (
          <div key={item.id || item._RowNumber} style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '10px', boxShadow: 'var(--shadow)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>{item.ten}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiPhone size={12}/> {item.sdt} &bull; <FiMapPin size={12}/> {item.ngay}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setViewUrl(item.hinhAnh)} style={{ background: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', cursor: 'pointer' }} title="Xem ảnh gốc"><FiEye /></button>
              <button onClick={() => handleDelete(item.id || item._RowNumber)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '10px', cursor: 'pointer' }} title="Xóa"><FiTrash2 /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal hiển thị ảnh phóng to */}
      {viewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewUrl(null)}>
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewUrl(null)}>
            <FiX size={24} />
          </button>
          <img src={viewUrl} alt="Original" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}

export default BusinessScanner;
