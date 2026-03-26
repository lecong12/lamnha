import React, { useState, useEffect } from 'react';
import { FiCamera, FiLoader, FiPhone, FiCheckCircle, FiClock } from 'react-icons/fi';
import { addRowToSheet, fetchTableData } from '../utils/sheetsAPI';
import './BusinessScanner.css';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '').trim();
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '').trim();

function BusinessScanner({ showToast }) {
  const [uploading, setUploading] = useState(false);
  const [latestScan, setLatestScan] = useState(null);
  const [polling, setPolling] = useState(false);
  const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

  // Hàm tự động kiểm tra xem AI đã quét xong chưa (Polling)
  useEffect(() => {
    let interval;
    if (polling && latestScan) {
      interval = setInterval(async () => {
        const res = await fetchTableData("DanhBa", APP_ID);
        if (res.success) {
          const updatedRow = res.data.find(r => r.ID === latestScan.ID);
          if (updatedRow && updatedRow.TrangThai === "Completed") {
            setLatestScan(updatedRow);
            setPolling(false);
            showToast("AI đã trích xuất xong!", "success");
          }
        }
      }, 3000); // Kiểm tra mỗi 3 giây
    }
    return () => clearInterval(interval);
  }, [polling, latestScan, APP_ID, showToast]);

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      showToast("Đang tải ảnh...", "info");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const fileData = await res.json();

      if (fileData.secure_url) {
        const rowData = {
          ID: `SCAN_${Date.now()}`,
          AnhCard: fileData.secure_url,
          TenDoanhNghiep: "Đang phân tích...", 
          SoDienThoai: "",
          NgayQuet: new Date().toLocaleString('vi-VN'),
          TrangThai: "Processing"
        };

        const sheetRes = await addRowToSheet("DanhBa", rowData, APP_ID);
        if (sheetRes.success) {
          setLatestScan(rowData);
          setPolling(true);
          showToast("Đã gửi ảnh. Vui lòng chờ AI trong giây lát.", "info");
        }
      }
    } catch (error) { showToast("Lỗi: " + error.message, "error"); }
    finally { setUploading(false); }
  };

  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h3>Quét Card AI</h3>
        
        <div className="scan-display">
          {!latestScan ? (
            <div className="empty-state">Chụp bảng hiệu hoặc card để lưu danh bạ</div>
          ) : (
            <div className="scan-result">
              <img src={latestScan.AnhCard} alt="Card" className="card-thumb" />
              <div className="scan-info">
                {polling ? (
                  <div className="status-loading"><FiClock className="spin" /> AI đang đọc dữ liệu...</div>
                ) : (
                  <div className="status-done">
                    <p className="biz-name"><strong>{latestScan.TenDoanhNghiep}</strong></p>
                    <p className="biz-phone">{latestScan.SoDienThoai}</p>
                    {latestScan.SoDienThoai && (
                      <a href={`tel:${latestScan.SoDienThoai.replace(/\D/g,'')}`} className="call-now-btn">
                        <FiPhone /> Gọi ngay
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <label className={`capture-btn ${uploading ? 'disabled' : ''}`}>
          {uploading ? <FiLoader className="spin" /> : <FiCamera />}
          <span>{uploading ? "Đang xử lý..." : "Chụp ảnh mới"}</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleCapture} hidden disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

export default BusinessScanner;
