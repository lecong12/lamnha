import React, { useState, useRef } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiSearch, FiPhoneCall } from 'react-icons/fi';
import Tesseract from 'tesseract.js';
import { addRowToSheet } from '../utils/sheetsAPI';
import './BusinessScanner.css';

// Cấu hình lấy từ môi trường
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');
const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function BusinessScanner({ showToast }) {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [scannedData, setScannedData] = useState({
    tenDoanhNghiep: "",
    soDienThoai: "",
    hinhAnh: ""
  });

  // Helper: Làm sạch link Cloudinary từ chuỗi rác
  const getCleanUrl = (rawUrl) => {
    if (!rawUrl) return "";
    const match = String(rawUrl).match(/(https:\/\/res\.cloudinary\.com\/[^\s"'}]+)/);
    return match ? match[0].replace(/%22/g, '').replace(/["'}]/g, '') : rawUrl;
  };

  // Xử lý chọn file và upload
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      // Sử dụng endpoint /auto/upload để Cloudinary tự nhận diện loại file
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Không thể upload lên Cloudinary. Kiểm tra lại .env");

      const fileData = await res.json();
      if (fileData.secure_url) {
        const cleanUrl = getCleanUrl(fileData.secure_url);
        const isPdf = file.type === "application/pdf";
        setImage(cleanUrl);
        setScannedData(prev => ({ ...prev, hinhAnh: cleanUrl }));
        showToast("Tải ảnh chứng từ thành công!", "success");
        
        // Nếu là ảnh thì tự động kích hoạt OCR
        if (!isPdf) handleOCR(cleanUrl);
      }
    } catch (error) {
      showToast("Lỗi upload: " + error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // Xử lý quét văn bản (OCR)
  const handleOCR = async (url) => {
    if (!url) return;
    setScanning(true);
    showToast("Đang phân tích hình ảnh...", "info");
    
    try {
      const { data: { text } } = await Tesseract.recognize(url, 'vie');
      const extracted = { ...scannedData };
      
      // 1. Tìm số điện thoại (Regex VN: hỗ trợ cả dấu chấm, dấu cách giữa các số)
      const phoneRegex = /(0[35789][0-9]{1}[\s\.]?[0-9]{3}[\s\.]?[0-9]{4}|02[0-9]{1,2}[\s\.]?[0-9]{3,4}[\s\.]?[0-9]{4})/g;
      const phoneMatches = text.match(phoneRegex);
      if (phoneMatches) {
        // Làm sạch số điện thoại (xóa dấu cách, dấu chấm)
        extracted.soDienThoai = phoneMatches[0].replace(/[\s\.]/g, '');
      }

      // 2. Tìm tên doanh nghiệp (Thường là dòng đầu tiên hoặc dòng có chữ in hoa)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      if (lines.length > 0) {
        // Ưu tiên dòng không chứa quá nhiều số
        const nameLine = lines.find(l => !/\d{5,}/.test(l)) || lines[0];
        extracted.tenDoanhNghiep = nameLine;
      }

      setScannedData(extracted);
      showToast("Đã nhận diện thông tin liên hệ!", "success");
    } catch (error) {
      console.error("OCR Error:", error);
      showToast("Không thể tự động đọc văn bản.", "warning");
    } finally {
      setScanning(false);
    }
  };

  // Lưu vào AppSheet
  const handleSave = async () => {
    if (!scannedData.tenDoanhNghiep) {
      showToast("Vui lòng nhập Tên doanh nghiệp.", "warning");
      return;
    }

    setSaving(true);
    try {
      const currentUrl = image || scannedData.hinhAnh;
      const payload = {
        "id": Date.now(), // AppSheet thường dùng Numeric ID hoặc String
        "Tên": scannedData.tenDoanhNghiep,
        "SĐT": scannedData.soDienThoai,
        "Ảnh": currentUrl,
        "Ngày lưu": new Date().toLocaleDateString('vi-VN')
      };

      const res = await addRowToSheet("DanhBa", payload, APP_ID);
      if (res.success) {
        showToast("Đã lưu vào Danh bạ!", "success");
        // Reset form
        setImage(null);
        setScannedData({ 
          tenDoanhNghiep: "", soDienThoai: "", hinhAnh: "" 
        });
      }
    } catch (error) {
      showToast("Lỗi lưu AppSheet: " + error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scanner-container">
      <div className="scanner-card">
        <div className="scanner-header">
          <h3><FiCamera /> Quét Card & Bảng hiệu</h3>
          <p>Lưu nhanh thông tin nhà thầu, cửa hàng</p>
        </div>

        <div className="scanner-body">
          {/* Khu vực xem trước / Upload */}
          <div className={`scan-preview-zone ${image ? 'has-img' : ''}`} onClick={() => !uploading && fileInputRef.current.click()}>
            {uploading ? (
              <div className="scan-overlay"><FiLoader className="spin" /> <span>Đang tải lên...</span></div>
            ) : image ? (
              <img src={image} alt="Preview" className="img-preview" />
            ) : (
              <div className="scan-placeholder">
                <FiImage size={40} />
                <span>Chạm để chụp hoặc chọn ảnh</span>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden accept="image/*,application/pdf" />
          </div>

          {/* Form kết quả quét */}
          <div className="scan-result-form">
            <div className="scan-input-group">
              <label>Tên Doanh nghiệp / Chủ thợ</label>
              <input type="text" value={scannedData.tenDoanhNghiep} placeholder="Tên đơn vị..." onChange={e => setScannedData({...scannedData, tenDoanhNghiep: e.target.value})} />
            </div>
            
            <div className="scan-input-group">
              <label>Số điện thoại</label>
              <div className="input-icon-wrapper">
                <input type="tel" value={scannedData.soDienThoai} placeholder="090..." onChange={e => setScannedData({...scannedData, soDienThoai: e.target.value})} />
                {scanning && <FiLoader className="spin icon-inside" />}
              </div>
            </div>

            {scannedData.soDienThoai && (
              <div className="quick-call-zone">
                <a href={`tel:${scannedData.soDienThoai}`} className="btn-call">
                  <FiPhoneCall /> Gọi ngay: {scannedData.soDienThoai}
                </a>
              </div>
            )}

            <div className="scan-actions">
              <button className="btn-secondary" onClick={() => handleOCR(image)} disabled={!image || scanning}>
                <FiSearch /> {scanning ? "Đang quét..." : "Quét lại ảnh"}
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !image}>
                {saving ? <FiLoader className="spin" /> : <FiSave />} Lưu Danh bạ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BusinessScanner;
