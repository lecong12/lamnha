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

    try {
      setUploading(true);
      
      // 1. Tạo link xem trước cục bộ để hiển thị và quét OCR ngay lập tức
      const localUrl = URL.createObjectURL(file);
      setImage(localUrl);

      const isPdf = file.type === "application/pdf";
      // Nếu là ảnh thì quét OCR song song luôn, không đợi upload
      if (!isPdf) {
        handleOCR(file);
      }

      // 2. Tiến hành upload lên Cloudinary đồng thời
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const resourceType = isPdf ? "raw" : "image";
      formData.append("resource_type", resourceType);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || `Lỗi Cloudinary: ${res.status}`);
      }

      const fileData = await res.json();
      if (fileData.secure_url) {
        const cleanUrl = getCleanUrl(fileData.secure_url);
        setScannedData(prev => ({ ...prev, hinhAnh: cleanUrl }));
        showToast("Tải ảnh chứng từ thành công!", "success");
      }
    } catch (error) {
      showToast("Lỗi upload: " + error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // Xử lý quét văn bản (OCR) - Chấp nhận cả URL hoặc File object
  const handleOCR = async (source) => {
    if (!source) return;
    setScanning(true);
    if (!uploading) showToast("Đang phân tích hình ảnh...", "info");
    
    try {
      const { data: { text } } = await Tesseract.recognize(source, 'vie');

      // Sử dụng functional update để tránh stale state (dữ liệu cũ ghi đè dữ liệu mới)
      setScannedData(prev => {
        const extracted = { ...prev };
        
        // 1. Tìm số điện thoại (Regex VN cải tiến)
        const phoneRegex = /(0[35789][0-9\s\.]{8,12}|02[0-9\s\.]{9,13})/g;
        const cleanTextForPhone = text.replace(/[^\d]/g, ''); // Chỉ giữ lại số để tìm SĐT
        const phoneMatch = cleanTextForPhone.match(/(03|05|07|08|09|02)\d{8,9}/);
        if (phoneMatch) extracted.soDienThoai = phoneMatch[0];

        // 2. Tìm tên doanh nghiệp (Logic trích xuất tiếng Việt)
        const businessKeywords = [
          'công ty', 'cửa hàng', 'đại lý', 'vật tư', 'xây dựng', 'văn phòng', 
          'showroom', 'doanh nghiệp', 'hộ kinh doanh', 'tiệm', 'cơ sở', 
          'nhà thầu', 'vật liệu', 'trang trí', 'nội thất', 'điện nước'
        ];
        
        const cleanLines = text.split('\n')
          .map(l => l.trim()
            .replace(/[|\\\[\]{}()_*~^]/g, '') // Xóa ký tự nhiễu OCR
            .replace(/^[^\w\sÀ-ỹ0-9]+|[^\w\sÀ-ỹ0-9]+$/g, '') // Xóa rác đầu/cuối
          )
          .filter(l => l.length > 2 && !/^\d+$/.test(l)); // Bỏ dòng chỉ toàn số

        if (cleanLines.length > 0) {
          let nameLine = cleanLines.find(l => 
            businessKeywords.some(kw => l.toLowerCase().includes(kw))
          );

          if (!nameLine) {
            nameLine = cleanLines.find(l => {
              const upperCount = (l.match(/[A-ZÀ-Ỹ]/g) || []).length;
              const letterCount = (l.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
              return letterCount > 5 && (upperCount / letterCount) > 0.5;
            });
          }

          if (!nameLine) {
            nameLine = cleanLines.find(l => {
              const hasFewNumbers = (l.match(/\d/g) || []).length < 5;
              const notAddress = !/(số|đường|phường|quận|tp|huyện|tỉnh|địa chỉ|đ\/c|đc|hotline|tel|fax|mst|email|website|web)/i.test(l);
              const notEmail = !/@/.test(l) && !/\.com|\.vn/.test(l);
              return hasFewNumbers && notAddress && notEmail;
            });
          }
          
          let finalName = (nameLine || cleanLines[0]).trim();
          // Làm sạch lần cuối: Xóa các nhãn thông tin nếu còn sót
          finalName = finalName.replace(/^(Tên|Cửa hàng|Cty|Công ty|Đ\/c|Địa chỉ|ĐC)[:\s\-]*/i, '');
          extracted.tenDoanhNghiep = finalName;
        }

        return extracted;
      });

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
              <button className="btn-primary" onClick={handleSave} disabled={saving || !scannedData.hinhAnh}>
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
