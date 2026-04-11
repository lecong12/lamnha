import React, { useState, useEffect, useRef } from "react";
import { FiX, FiSave, FiCamera, FiImage, FiLoader, FiFileText } from "react-icons/fi";
import { extractInfoWithAI } from "../utils/aiService";
import { toInputString, getTodayInputString } from "../utils/dateUtils";
import "./EditModal.css";

const BUDGET_CATEGORIES = ['Chuẩn bị', 'Thiết kế', 'Giám sát', 'Phần thô', 'Nhân công', 'Hoàn thiện', 'Điện nước', 'Nội thất', 'Phát sinh', 'Khác'];
const UPDATER_OPTIONS = ['Ba', 'Mẹ'];
const SUGGESTION_MAP = {
  'Nhân công': [{ label: 'Công thợ nề', amount: 600000 }, { label: 'Công phụ hồ', amount: 400000 }],
  'Phần thô': [{ label: 'Xi măng' }, { label: 'Cát xây' }, { label: 'Sắt thép' }],
  'Điện nước': [{ label: 'Ống nước' }, { label: 'Dây điện' }],
  'Khác': [{ label: 'Mua nước uống' }, { label: 'Tiền xăng' }]
};

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '').trim();
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '').trim();

function EditModal({ item, onClose, onSave, showToast }) {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    ngay: getTodayInputString(),
    noiDung: "",
    doiTuongThuChi: "",
    nguoiCapNhat: "Ba",
    soTien: "",
    hinhAnh: "",
    loaiThuChi: "Chi",
  });
  
  const [uploading, setUploading] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [preview, setPreview] = useState("");
  const [isPdfPreview, setIsPdfPreview] = useState(false);

  useEffect(() => {
    if (item && (item.id || item._id || item.appSheetId)) {
      const rawDate = item.ngay || item["Ngày"];
      const dateStr = toInputString(rawDate) || getTodayInputString();
      const rawAmount = item.soTien || item["Số tiền"];

      setFormData({
        ngay: dateStr,
        noiDung: item.noiDung || item["Nội dung"] || "",
        doiTuongThuChi: item.doiTuongThuChi || item["Hạng mục"] || "",
        nguoiCapNhat: item.nguoiCapNhat || item["Người cập nhật"] || "Ba",
        soTien: (rawAmount !== undefined && rawAmount !== null) ? new Intl.NumberFormat('vi-VN').format(rawAmount) : "",
        hinhAnh: item.hinhAnh || item["Chứng từ"] || "",
        loaiThuChi: item.loaiThuChi || "Chi",
      });
      const imgUrl = item.hinhAnh || item["Chứng từ"] || "";
      setPreview(imgUrl);
      setIsPdfPreview(imgUrl?.toLowerCase().endsWith('.pdf') || false);
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "soTien") {
      const rawValue = value.replace(/\D/g, "");
      const formattedValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      const isPdf = file.type === "application/pdf";
      setIsPdfPreview(isPdf);

      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isPdf ? "raw" : "image"}/upload`, { 
        method: "POST", body: data 
      });
      const fileData = await res.json();
      if (fileData.secure_url) {
        setFormData(prev => ({ ...prev, hinhAnh: fileData.secure_url }));
        if (!isPdf) await handleOCR(fileData.secure_url);
      }
    } catch (error) {
      showToast?.("Lỗi upload", "error");
    } finally { setUploading(false); }
  };

  const handleOCR = async (url) => {
    const ocrSource = url || formData.hinhAnh;
    if (!ocrSource || ocrSource.startsWith('blob:')) return;
    setOcrScanning(true);
    showToast?.("AI đang đọc ảnh...", "info");
    try {
      const data = await extractInfoWithAI(ocrSource);
      if (data && !data.error) {
        setFormData(prev => ({
          ...prev,
          ngay: data.ngay ? toInputString(data.ngay) : prev.ngay,
          soTien: data.soTien ? new Intl.NumberFormat('vi-VN').format(String(data.soTien).replace(/\D/g, "")) : prev.soTien,
          noiDung: [data.ten, data.noiDung].filter(Boolean).join(" - ")
        }));
        showToast?.("Xong!", "success");
      }
    } catch (error) { showToast?.("Lỗi OCR", "error"); }
    finally { setOcrScanning(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanAmount = parseInt(formData.soTien.replace(/\./g, "")) || 0;
    
    // CHUẨN HÓA NGÀY GỬI: Ép về DD/MM/YYYY để AppSheet không từ chối
    let dateToSend = formData.ngay;
    if (dateToSend.includes("-")) {
      const [y, m, d] = dateToSend.split("-");
      dateToSend = `${d}/${m}/${y}`;
    }

    const finalData = {
      ...item,
      ...formData,
      soTien: cleanAmount,
      ngay: dateToSend,
      loaiThuChi: formData.loaiThuChi || "Chi"
    };

    console.log("Final Data to Save:", finalData);
    onSave(finalData);
  };

  const activeSuggestions = SUGGESTION_MAP[formData.doiTuongThuChi] || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{(item?.appSheetId || item?.id) ? "Sửa" : "Thêm"} giao dịch</h2>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <div className="image-upload-section">
          <div className="image-preview" onClick={() => !uploading && fileInputRef.current.click()}>
            {preview ? (
              <div className="preview-container">
                {isPdfPreview ? <FiFileText size={40} /> : <img src={preview} alt="Bill" />}
                {uploading && <div className="upload-overlay"><FiLoader className="spin" /></div>}
              </div>
            ) : (
              <div className="upload-placeholder">
                <FiCamera size={32} /> <span>{uploading ? "Đang tải..." : "Thêm ảnh/PDF"}</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Ngày</label>
              <input type="date" name="ngay" value={formData.ngay} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Số tiền (VNĐ)</label>
              <input type="text" name="soTien" value={formData.soTien} onChange={handleChange} required placeholder="0" />
            </div>
            <div className="form-group">
              <label>Hạng mục</label>
              <select name="doiTuongThuChi" value={formData.doiTuongThuChi} onChange={handleChange} required>
                <option value="">-- Chọn --</option>
                {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Người cập nhật</label>
              <select name="nguoiCapNhat" value={formData.nguoiCapNhat} onChange={handleChange}>
                {UPDATER_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group full-width">
              <label>Nội dung</label>
              <input type="text" name="noiDung" value={formData.noiDung} onChange={handleChange} required />
              <div className="suggestion-list" style={{display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'5px'}}>
                {activeSuggestions.map(s => (
                  <button key={s.label} type="button" className="sugg-btn" onClick={() => setFormData(p => ({...p, noiDung: s.label, soTien: s.amount ? new Intl.NumberFormat('vi-VN').format(s.amount) : p.soTien}))} style={{fontSize:'11px', padding:'2px 8px', borderRadius:'10px', border:'1px solid #ddd', cursor:'pointer'}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ocr" onClick={() => handleOCR()} disabled={ocrScanning || uploading}>
              {ocrScanning ? <FiLoader className="spin" /> : <FiImage />} AI
            </button>
            <div className="spacer"></div>
            <button type="submit" className="btn-save" disabled={uploading}><FiSave /> Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditModal;
