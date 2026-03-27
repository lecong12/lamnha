import React, { useState, useRef, useEffect } from 'react';
import { FiCamera, FiLoader, FiSave, FiImage, FiSearch, FiPhoneCall, FiUser, FiExternalLink } from 'react-icons/fi';
import Tesseract from 'tesseract.js';
import { addRowToSheet, fetchTableData } from '../utils/sheetsAPI';
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
  const [recentContacts, setRecentContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  
  const [scannedData, setScannedData] = useState({
    tenDoanhNghiep: "",
    soDienThoai: "",
    hinhAnh: ""
  });

  // Tải danh sách liên hệ đã lưu khi mở trang
  useEffect(() => {
    loadRecentContacts();
  }, []);

  const loadRecentContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetchTableData("DanhBa", APP_ID);
      if (res.success && res.data) {
        // Lấy 10 bản ghi mới nhất (đảo ngược mảng)
        setRecentContacts(res.data.slice().reverse().slice(0, 10).map(item => ({
          id: item.ID || item.id,
          ten: item.TenDoanhNghiep || item.ten || "Không tên",
          sdt: item.SoDienThoai || item.sdt || "Không có số"
        })));
      }
    } catch (e) {
      console.error("Lỗi tải danh bạ:", e);
    } finally {
      setLoadingContacts(false);
    }
  };

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

    // 1. HIỂN THỊ ẢNH XEM TRƯỚC TỨC THÌ (Local Preview)
    const localUrl = URL.createObjectURL(file);
    setImage(localUrl);

    // Reset form để bắt đầu tiến trình mới
    setScannedData({ tenDoanhNghiep: "", soDienThoai: "", hinhAnh: "" });
    setUploading(true);
    setScanning(true);
    showToast("Bắt đầu xử lý...", "info");

    const isPdf = file.type === "application/pdf";
    const resourceType = isPdf ? "raw" : "image";

    // TÁC VỤ 1: QUÉT OCR (Chạy đồng thời, dùng file cục bộ cho tốc độ tối đa)
    if (!isPdf) {
      handleOCR(file); // Quét trực tiếp file object
    } else {
      setScanning(false);
    }

    // TÁC VỤ 2: UPLOAD LÊN CLOUDINARY (Chạy ngầm)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("resource_type", resourceType);

    fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
      method: "POST",
      body: formData
    })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Lỗi server Cloudinary");
      }
      return res.json();
    })
    .then((fileData) => {
      if (fileData.secure_url) {
        const cleanUrl = getCleanUrl(fileData.secure_url);
        setScannedData(prev => ({ ...prev, hinhAnh: cleanUrl }));
        setUploading(false);
        showToast("Ảnh đã tải lên, có thể lưu!", "success");
      }
    })
    .catch((error) => {
      console.error("Upload error:", error);
      setUploading(false);
      showToast("Lỗi upload ngầm: " + error.message, "error");
    });
  };

  const handleOCR = async (source) => {
    const ocrSource = source || image;
    if (!ocrSource) return;

    setScanning(true);
    try {
      const { data: { text } } = await Tesseract.recognize(ocrSource, 'vie');

      setScannedData(prev => {
        const extracted = { ...prev };
        
        // 1. Trích xuất SĐT (Hỗ trợ dấu + quốc tế và các định dạng có dấu cách/chấm)
        const phoneRegex = /(\+[\d\s.]{7,15}|(?:03|05|07|08|09|02)[\d\s.]{8,12})/g;
        const phoneMatches = text.match(phoneRegex);
        if (phoneMatches) {
          const rawPhone = phoneMatches[0].trim();
          const digits = rawPhone.replace(/[^\d]/g, '');
          // Giữ lại dấu + ở đầu nếu là số quốc tế
          extracted.soDienThoai = rawPhone.startsWith('+') ? `+${digits}` : digits;
        }

        // Trích xuất Tên Doanh nghiệp
        const businessKeywords = ['công ty', 'cửa hàng', 'đại lý', 'vật tư', 'xây dựng', 'nhà thầu', 'nội thất', 'thiết kế', 'kiến trúc', 'điện nước'];
        const cleanLines = text.split('\n')
          .map(l => l.trim().replace(/[|\\\[\]{}()_*~^]/g, '').replace(/^[^a-zA-ZÀ-ỹ0-9]+|[^a-zA-ZÀ-ỹ0-9]+$/g, ''))
          .filter(l => {
            // Bỏ qua rác từ logo/icon: quá ngắn hoặc chứa từ khóa liên hệ (thường đi kèm icon)
            if (l.length < 4) return false;
            if (/^(fb|zalo|web|mst|stk|id|đc|add|tel|hotline|email|www|http)/i.test(l)) return false;
            return !/^[\d\s.,\-:/]+$/.test(l); // Bỏ dòng chỉ toàn số/phân cách
          });

        if (cleanLines.length > 0) {
          let nameLine = cleanLines.find(l => businessKeywords.some(kw => l.toLowerCase().includes(kw)));
          if (!nameLine) {
            nameLine = cleanLines.find(l => {
              const upperCount = (l.match(/[A-ZÀ-ỸĐ]/g) || []).length; // Thêm Đ vào danh sách chữ hoa
              // Chỉ lấy nếu đủ dài và tỉ lệ chữ hoa cao (thường là tên thương hiệu lớn trên biển hiệu)
              return l.length > 6 && (upperCount / l.length) > 0.5;
            });
          }
          // Logic loại bỏ tiền tố nhưng giữ nguyên dấu tiếng Việt phía sau
          const ten = (nameLine || cleanLines[0] || "").replace(/^(Tên|Cửa hàng|Cty|Công ty|Đ\/c|Địa chỉ|ĐC|SĐT|Tel|MST|Zalo|FB|Facebook)[:\s\-]*/i, '').trim();
          extracted.tenDoanhNghiep = ten;
        }
        return extracted;
      });
      showToast("Đã nhận diện thông tin!", "success");
    } catch (error) {
      console.error("OCR Error:", error);
    } finally {
      setScanning(false);
    }
  };

  // Lưu vào AppSheet
  const handleSave = async () => {
    if (!scannedData.tenDoanhNghiep && !scannedData.soDienThoai) {
      showToast("Vui lòng nhập Tên hoặc Số điện thoại.", "warning");
      return;
    }

    if (uploading) {
      showToast("Vui lòng chờ ảnh tải lên xong...", "warning");
      return;
    }

    setSaving(true);
    try {
      // Chỉ sử dụng scannedData.hinhAnh (Cloudinary URL), không dùng link blob preview
      const payload = {
        "ID": `DB_${Date.now()}`,
        "AnhCard": scannedData.hinhAnh,
        "TenDoanhNghiep": scannedData.tenDoanhNghiep,
        "SoDienThoai": scannedData.soDienThoai,
        "NgayQuet": new Date().toLocaleString('vi-VN'),
        "TrangThai": "Hoàn thành"
      };

      const res = await addRowToSheet("DanhBa", payload, APP_ID);
      if (res.success) {
        showToast("Đã lưu vào Danh bạ!", "success");
        setImage(null);
        setScannedData({ 
          tenDoanhNghiep: "", soDienThoai: "", hinhAnh: "" 
        });
        loadRecentContacts(); // Tải lại danh sách sau khi lưu
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
            {image ? (
              <>
                <img src={image} alt="Preview" className="img-preview" />
                {uploading && (
                  <div className="scan-overlay">
                    <FiLoader className="spin" /> 
                    <span>Đang tải lên Cloudinary...</span>
                  </div>
                )}
              </>
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
              <label>Số điện thoại {uploading && <small>(Đang tải ảnh...)</small>}</label>
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
              <button className="btn-primary" onClick={handleSave} disabled={saving || uploading || !scannedData.hinhAnh}>
                {saving ? <FiLoader className="spin" /> : <FiSave />} Lưu Danh bạ
              </button>
            </div>
          </div>
        </div>

        {/* MỚI: Khu vực hiển thị danh bạ vừa lưu */}
        <div className="recent-contacts-section">
          <div className="section-divider">
            <span>Danh bạ đã lưu gần đây</span>
          </div>
          
          {loadingContacts ? (
            <div className="loading-inline"><FiLoader className="spin" /> Đang tải dữ liệu...</div>
          ) : recentContacts.length > 0 ? (
            <div className="contacts-mini-list">
              {recentContacts.map((contact, idx) => (
                <div key={contact.id || idx} className="contact-mini-item">
                  <div className="contact-mini-info">
                    <div className="contact-name">{contact.ten}</div>
                    <div className="contact-phone">{contact.sdt}</div>
                  </div>
                  <div className="contact-mini-actions">
                    {contact.sdt !== "Không có số" && (
                      <a href={`tel:${contact.sdt.replace(/\D/g,'')}`} className="mini-call-btn" title="Gọi ngay">
                        <FiPhoneCall size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-contacts-text">Chưa có liên hệ nào trong danh bạ.</div>
          )}
          <p className="storage-hint">Dữ liệu được lưu tại Google Sheet: <strong>DanhBa</strong></p>
        </div>
      </div>
    </div>
  );
}

export default BusinessScanner;
