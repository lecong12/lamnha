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
          ten: item.TenDoanhNghiep || item.ten || "Không tên", // Map đúng tên cột
          sdt: item.SoDienThoai || item.sdt || "Không có số" // Map đúng tên cột
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

    // 1. HIỂN THỊ ẢNH THẬT NGAY LẬP TỨC (Local Preview)
    const localUrl = URL.createObjectURL(file);
    setImage(localUrl);

    // Reset form để bắt đầu tiến trình mới
    setScannedData({ tenDoanhNghiep: "", soDienThoai: "", hinhAnh: "" });
    setUploading(true);
    setScanning(true);
    showToast("Bắt đầu xử lý ảnh...", "info");

    const isPdf = file.type === "application/pdf";
    const resourceType = isPdf ? "raw" : "image";

    // TÁC VỤ 1: QUÉT OCR (Chạy độc lập, dùng file cục bộ cho tốc độ tối đa)
    if (!isPdf) {
      ocrTask(file).then(extractedInfo => {
        setScannedData(prev => ({
          ...prev,
          tenDoanhNghiep: extractedInfo.ten,
          soDienThoai: extractedInfo.sdt
        }));
        setScanning(false);
        showToast("Đã trích xuất thông tin từ ảnh!", "success");
      }).catch(err => {
        setScanning(false);
        console.error("OCR Error:", err);
        showToast("Lỗi trích xuất thông tin.", "error");
      });
    } else {
      setScanning(false);
    }

    // TÁC VỤ 2: UPLOAD LÊN CLOUDINARY (Chạy ngầm)
    uploadTask(file, resourceType)
      .then(cloudinaryUrl => {
        setScannedData(prev => ({ ...prev, hinhAnh: cloudinaryUrl }));
        setUploading(false);
        showToast("Đã đồng bộ ảnh!", "success");
      })
      .catch(err => {
        setUploading(false);
        showToast("Lỗi tải ảnh: " + err.message, "error");
        console.error("Upload error:", err);
      });
  };

  // Hàm hỗ trợ Upload tách rời
  const uploadTask = async (file, resourceType) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("resource_type", resourceType);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
      method: "POST", body: formData
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || "Cloudinary rejected");
    }
    const data = await res.json();
    return getCleanUrl(data.secure_url);
  };

  // Hàm hỗ trợ OCR tách rời
  const ocrTask = async (file) => {
    const { data: { text } } = await Tesseract.recognize(file, 'vie');
    
    // 1. Trích xuất SĐT (Stricter Regex)
    // Chỉ bắt các chuỗi bắt đầu bằng 0, +84, hoặc 84 và có cấu trúc giống SĐT
    const phoneRegex = /((?:\+84|84|0)(?:[235789])[0-9\s.]{7,12})/g;
    const phoneMatches = text.match(phoneRegex);
    let sdt = "";
    if (phoneMatches) {
      // Lọc kết quả: Phải có độ dài chữ số từ 9-11 và mật độ số phải > 70% (tránh bắt nhầm text rác)
      const validPhone = phoneMatches.map(p => p.trim()).find(p => {
        const clean = p.replace(/[^\d]/g, '');
        const digitRatio = clean.length / p.length;
        return clean.length >= 9 && clean.length <= 11 && digitRatio > 0.7;
      });

      if (validPhone) {
        sdt = validPhone.replace(/[^\d\+]/g, '');
      }
    }

    // 2. Trích xuất Tên Doanh nghiệp
    const businessKeywords = ['công ty', 'cửa hàng', 'đại lý', 'vật tư', 'xây dựng', 'nhà thầu', 'nội thất', 'thiết kế', 'kiến trúc', 'điện nước', 'tiệm', 'doanh nghiệp', 'văn phòng', 'showroom', 'gara'];
    
    const rawLines = text.split('\n')
      .map(l => {
        return l.trim()
          .replace(/[|\\\[\]{}()_*~^"']/g, '') // Xóa ký tự nhiễu OCR
          .replace(/^[^a-zA-ZÀ-ỹđĐ0-9]+|[^a-zA-ZÀ-ỹđĐ0-9]+$/g, ''); // Làm sạch đầu cuối
      })
      .filter(l => l.length > 3);

    // Lọc bỏ các dòng chắc chắn là thông tin phụ
    const filteredLines = rawLines.filter(l => {
      const lower = l.toLowerCase();
      // Loại bỏ dòng liên hệ
      if (/^(fb|zalo|web|mst|stk|id|đc|add|tel|hotline|email|www|http|phone|mobile|fax|website|địa chỉ|dc:)/i.test(lower)) return false;
      // Loại bỏ dòng có mật độ số cao (thường là MST hoặc địa chỉ)
      const digits = l.match(/\d/g) || [];
      if (digits.length > l.length * 0.25) return false;
      // Loại bỏ dòng chứa từ khóa địa chỉ đặc trưng VN
      if (/\b(phường|quận|thành phố|tỉnh|huyện|xã|ấp|số|ngõ|ngách|đường)\b/i.test(lower)) return false;
      return true;
    });

    let ten = "";
    if (filteredLines.length > 0) {
      // Ưu tiên dòng chứa từ khóa ngành nghề
      let nameLine = filteredLines.find(l => businessKeywords.some(kw => l.toLowerCase().includes(kw)));
      
      if (!nameLine) {
        // Ưu tiên dòng có tỷ lệ chữ hoa cao nhất (thường là Brand Name)
        const uppercaseHeuristic = filteredLines.map(l => {
          const upperCount = (l.match(/[A-ZÀ-ỸĐ]/g) || []).length;
          return { text: l, ratio: upperCount / l.length };
        }).filter(item => item.ratio > 0.4 && item.text.length > 5);
        
        if (uppercaseHeuristic.length > 0) {
          nameLine = uppercaseHeuristic.sort((a, b) => b.ratio - a.ratio)[0].text;
        }
      }
      
      // Nếu vẫn không thấy, lấy dòng đầu tiên không phải số
      const rawName = (nameLine || filteredLines[0] || "").trim();
      // Làm sạch tiền tố rác
      ten = rawName.replace(/^(Tên|Cửa hàng|Cty|Công ty|Đ\/c|Địa chỉ|ĐC|SĐT|Tel|MST|Zalo|FB|Facebook|Add|VPGD|Showroom)[:\s\-]*/i, '').trim();
    }
    return { ten, sdt };
  };

  // Hàm xử lý OCR khi bấm nút "Quét lại ảnh"
  const handleOCR = async (source) => {
    const ocrSource = source || image;
    if (!ocrSource) return;

    setScanning(true);
    try {
      const extractedInfo = await ocrTask(ocrSource);
      setScannedData(prev => ({
        ...prev,
        tenDoanhNghiep: extractedInfo.ten,
        soDienThoai: extractedInfo.sdt
      }));
      showToast("Đã nhận diện thông tin!", "success");
    } catch (error) {
      console.error("OCR Error:", error);
      showToast("Lỗi khi quét ảnh.", "error");
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
        "ID": `DB_${Date.now()}`, // Tạo ID dạng chuỗi để AppSheet không nhầm lẫn
        "AnhCard": scannedData.hinhAnh, // Khớp với tên cột của bạn
        "TenDoanhNghiep": scannedData.tenDoanhNghiep,
        "SoDienThoai": scannedData.soDienThoai,
        "NgayQuet": new Date().toLocaleString('vi-VN'),
        "TrangThai": "Hoàn thành"
      };

      const res = await addRowToSheet("DanhBa", payload, APP_ID);
      if (res.success) {
        showToast("Đã lưu vào Danh bạ!", "success");
        setImage(null); // Xóa preview
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
                <a href={`tel:${String(scannedData.soDienThoai || '').replace(/\D/g,'')}`} className="btn-call">
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
                      <a href={`tel:${String(contact.sdt || '').replace(/\D/g,'')}`} className="mini-call-btn" title="Gọi ngay">
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
