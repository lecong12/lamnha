import React, { useState, useEffect, useRef } from "react";
import { FiX, FiSave, FiCamera, FiImage, FiLoader, FiFileText } from "react-icons/fi";
import Tesseract from 'tesseract.js';
import "./EditModal.css";

// Danh sách hạng mục ngân sách, đồng bộ với Sheet 'NganSach'
const BUDGET_CATEGORIES = [
  'Chuẩn bị',
  'Thiết kế',
  'Giám sát',
  'Phần thô', 
  'Nhân công', 
  'Hoàn thiện', 
  'Điện nước', 
  'Nội thất', 
  'Phát sinh',
  'Khác'
];

const UPDATER_OPTIONS = [
  'Ba',
  'Mẹ'
  ];

// Danh sách gợi ý nội dung theo hạng mục
const SUGGESTION_MAP = {
  'Nhân công': [
    { label: 'Công thợ nề', amount: 600000 },
    { label: 'Công phụ hồ', amount: 400000 },
    { label: 'Tiền cơm thợ', amount: 30000 },
    { label: 'Thưởng thợ', amount: 50000 }
  ],
  'Phần thô': [
    { label: 'Xi măng' }, { label: 'Cát xây' }, { label: 'Cát bê tông' }, 
    { label: 'Đá 1x2' }, { label: 'Gạch ống' }, { label: 'Sắt thép' }, { label: 'Đinh kẽm' }
  ],
  'Điện nước': [
    { label: 'Ống nước Bình Minh' }, { label: 'Dây điện Cadivi' }, { label: 'Co/Lơi/Nối' }, { label: 'Keo dán ống' }
  ],
  'Khác': [
    { label: 'Mua nước uống' }, { label: 'Tiền xăng' }
  ]
};

// Cấu hình Cloudinary (Lấy từ biến môi trường)
// Loại bỏ dấu ngoặc kép nếu người dùng lỡ nhập trong file .env (ví dụ: "myname" -> myname)
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');

console.log("Cloudinary Config Loaded:", { cloudName: CLOUD_NAME ? "OK" : "MISSING", preset: UPLOAD_PRESET ? "OK" : "MISSING" });

function EditModal({ item, onClose, onSave, showToast }) {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    ngay: "",
    noiDung: "",
    doiTuongThuChi: "",
    nguoiCapNhat: "", // Bổ sung trường người cập nhật
    soTien: "",
    hinhAnh: "", // Thêm trường hình ảnh
  });
  const [uploading, setUploading] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);

  useEffect(() => {
    if (item) {
      // Nếu là item mới (chưa có ngày), dùng ngày hiện tại
      const dateVal = item.ngay ? new Date(item.ngay) : new Date();
      setFormData({
        ngay: dateVal.toISOString().split('T')[0],
        noiDung: item.noiDung || "",
        doiTuongThuChi: item.doiTuongThuChi || "",
        nguoiCapNhat: item.nguoiCapNhat || "Ba", // Mặc định là Ba nếu chưa có
        // Format số tiền khi load dữ liệu (VD: 1000000 => 1.000.000)
        soTien: item.soTien ? new Intl.NumberFormat('vi-VN').format(item.soTien) : "",
        hinhAnh: item.hinhAnh || "",
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "soTien") {
      // Xóa tất cả ký tự không phải số
      const rawValue = value.replace(/\D/g, "");
      // Thêm dấu chấm phân cách hàng nghìn
      const formattedValue = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Xử lý upload ảnh lên Cloudinary
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng file ảnh hoặc PDF
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("Vui lòng chỉ chọn file ảnh hoặc PDF.");
      return;
    }

    // Kiểm tra dung lượng file (Giới hạn 10MB của gói Free Cloudinary)
    if (file.size > 10 * 1024 * 1024) {
      alert("File ảnh quá lớn ( > 10MB). Vui lòng chọn ảnh nhỏ hơn để upload.");
      return;
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      console.error("Thiếu cấu hình Cloudinary:", { CLOUD_NAME, UPLOAD_PRESET });
      alert(`Lỗi cấu hình Cloudinary!\n\n- Cloud Name: ${CLOUD_NAME || "TRỐNG"}\n- Upload Preset: ${UPLOAD_PRESET || "TRỐNG"}\n\nCách khắc phục:\n1. Kiểm tra file .env có dòng: REACT_APP_CLOUDINARY_UPLOAD_PRESET=...\n2. Nếu chạy Local: Tắt server rồi npm start lại.\n3. Nếu trên Vercel: Vào Settings -> Environment Variables thêm biến, sau đó Redeploy.`);
      return;
    }

    try {
      setUploading(true);
      
      // Tạo preview cục bộ
      const localUrl = URL.createObjectURL(file);
      const isPdf = file.type === "application/pdf";
      
      // Tự động quét OCR ngay khi chọn ảnh (không áp dụng cho PDF)
      if (!isPdf) handleOCR(file);

      const resourceType = isPdf ? "raw" : "image";

      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);
      data.append("resource_type", resourceType); 

      // Thêm Timeout 20 giây
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: data, signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const fileData = await res.json();
      
      if (fileData.secure_url) {
        console.log("Upload thành công:", fileData.secure_url);
        setFormData((prev) => ({ ...prev, hinhAnh: fileData.secure_url }));
      } else {
        throw new Error(fileData.error?.message || "Lỗi không xác định");
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (error.name === 'AbortError') {
        alert("Upload thất bại: Mạng quá chậm hoặc mất kết nối.");
      } else {
        alert("Lỗi upload: " + error.message);
      }
    } finally {
      setUploading(false);
    }
  };

  // Xử lý OCR (Quét hóa đơn) - Hỗ trợ cả File và URL
  const handleOCR = async (source) => {
    // Nếu gọi từ nút bấm mà không truyền source, lấy từ state
    const ocrSource = source || formData.hinhAnh;
    if (!ocrSource) {
      if (!source) alert("Vui lòng tải ảnh lên trước khi quét.");
      return;
    }

    setOcrScanning(true);
    showToast("Đang quét nội dung hóa đơn...", "info");

    try {
      const result = await Tesseract.recognize(
        ocrSource,
        'vie', // Sử dụng ngôn ngữ tiếng Việt
        { logger: m => console.log(m) } // Log tiến độ ra console
      );

      const text = result.data.text;
      console.log("Kết quả OCR:", text);

      const parsedData = { noiDung: formData.noiDung, soTien: formData.soTien, ngay: formData.ngay };
      let foundSomething = false;

      // 1. Tìm Ngày tháng (dd/mm/yyyy hoặc dd-mm-yyyy)
      const dateRegex = /(\d{1,2})[\s\/\-\.]+(\d{1,2})[\s\/\-\.]+(\d{4})/g;
      const dateMatches = [...text.matchAll(dateRegex)];
      
      if (dateMatches.length > 0) {
        const currentYear = new Date().getFullYear();
        
        // Chuyển đổi và sửa lỗi OCR (ví dụ: Tesseract hay đọc nhầm 202x thành 201x)
        const validDates = dateMatches.map(m => {
          const day = m[1].padStart(2, '0');
          const month = m[2].padStart(2, '0');
          let year = m[3];
          
          // Logic sửa lỗi: Nếu năm đọc ra là 201x nhưng thực tế là 202x
          if (year.startsWith("201") && currentYear >= 2024) {
            year = year.replace("201", "202");
          }
          
          return { day, month, year, full: `${year}-${month}-${day}` };
        }).filter(d => {
          const y = parseInt(d.year);
          return y >= currentYear - 1 && y <= currentYear + 1;
        });

        if (validDates.length > 0) {
          const bestDate = validDates[validDates.length - 1];
          parsedData.ngay = bestDate.full;
          foundSomething = true;
        } else {
          // Nếu không có ngày nào trong dải năm hợp lý, lấy ngày đầu tiên tìm được
          parsedData.ngay = `${dateMatches[0][3]}-${dateMatches[0][2].padStart(2, '0')}-${dateMatches[0][1].padStart(2, '0')}`;
        }
      }

      // 2. Tìm Số tiền (Lấy số lớn nhất tìm thấy trong văn bản)
      // Regex tìm các chuỗi số (VD: 1.000.000 hoặc 1,000,000)
      const numbers = text.match(/\d{1,3}(?:[.,]\d{3})*(?:,\d+)?/g);
      if (numbers) {
        let maxVal = 0;
        numbers.forEach(numStr => {
          const cleanNum = parseFloat(numStr.replace(/[.,]/g, ''));
          if (!isNaN(cleanNum) && cleanNum > 1000 && cleanNum < 10000000000) { // Giảm ngưỡng xuống 1.000
            if (cleanNum > maxVal) maxVal = cleanNum;
          }
        });
        if (maxVal > 0) {
          parsedData.soTien = maxVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          foundSomething = true;
        }
      }

      // 3. Tìm Nội dung (Tìm các từ khóa vật tư phổ biến)
      const keywords = ['xi măng', 'cát', 'đá', 'gạch', 'sắt', 'thép', 'ống nước', 'dây điện'];
      const lines = text.split('\n');
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (keywords.some(kw => lowerLine.includes(kw))) {
          parsedData.noiDung = line.trim();
          foundSomething = true;
          break; // Lấy dòng đầu tiên tìm thấy
        }
      }

      setFormData(prev => ({ ...prev, ...parsedData }));
      if (foundSomething) {
        showToast("Đã nhận diện được thông tin từ ảnh!", "success");
      } else {
        showToast("Không nhận diện được thông tin rõ ràng, vui lòng nhập thủ công.", "warning");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      showToast("Lỗi khi quét OCR: " + error.message, "error");
    } finally {
      setOcrScanning(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 1. Validation: Kiểm tra Hạng mục
    if (!formData.doiTuongThuChi) {
      alert("Vui lòng chọn Hạng mục chi tiêu!");
      return;
    }

    // Xử lý số tiền an toàn hơn
    const rawSoTien = formData.soTien ? formData.soTien.toString().replace(/[^0-9]/g, "") : "0";
    const parsedSoTien = parseFloat(rawSoTien);

    // 2. Validation: Kiểm tra Số tiền
    if (parsedSoTien <= 0) {
      alert("Vui lòng nhập Số tiền hợp lệ (lớn hơn 0)!");
      return;
    }

    const finalData = {
      ...item,
      ...formData,
      ngay: new Date(formData.ngay),
      soTien: isNaN(parsedSoTien) ? 0 : parsedSoTien
    };

    onSave(finalData);
  };

  // Hàm focus chọn toàn bộ text khi click vào ô số tiền
  const handleFocus = (e) => {
    e.target.select();
  };

  // Lấy danh sách gợi ý dựa trên hạng mục đang chọn
  const activeSuggestions = SUGGESTION_MAP[formData.doiTuongThuChi] || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item && (item.id || item.appSheetId) ? "Chỉnh sửa giao dịch" : "Thêm mới giao dịch"}</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        {/* Khu vực Upload & Preview Ảnh */}
        <div className="image-upload-section">
          <div className="image-preview">
            {formData.hinhAnh ? (
              <div style={{ width: '100%', textAlign: 'center' }} className="preview-wrapper">
                {formData.hinhAnh.toLowerCase().endsWith('.pdf') ? (
                  <a href={formData.hinhAnh} target="_blank" rel="noreferrer" className="pdf-preview-placeholder">
                    <FiFileText size={40} />
                    <span>File PDF đã tải lên</span>
                  </a>
                ) : (
                  <div className="preview-container" onClick={() => !uploading && fileInputRef.current.click()}>
                    <img src={formData.hinhAnh} alt="Chứng từ" />
                    {uploading && <div className="upload-overlay"><FiLoader className="spin" /></div>}
                    <button 
                      type="button" 
                      className="remove-image-btn" 
                      onClick={(e) => { e.stopPropagation(); setFormData(prev => ({...prev, hinhAnh: ""})) }}
                    >
                      <FiX />
                    </button>
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '4px', wordBreak: 'break-all' }}>
                  ✓ Đã có link: {formData.hinhAnh.substring(0, 30)}...
                </div>
              </div>
            ) : (
              <div className="upload-placeholder" onClick={() => fileInputRef.current.click()}>
                {uploading ? <FiLoader className="spin" /> : <FiCamera size={32} />}
                <span>{uploading ? "Đang tải lên..." : "Thêm Ảnh/PDF Chứng từ"}</span>
              </div>
            )}
          </div>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*,application/pdf" 
            key={formData.hinhAnh || "new"} // Reset input khi ảnh thay đổi để cho phép chọn lại file cũ nếu cần
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-grid">
            {/* Hàng 1: Ngày và Số tiền */}
            <div className="form-group">
              <label>Ngày giao dịch</label>
              <input
                type="date"
                name="ngay"
                value={formData.ngay}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Số tiền (VNĐ)</label>
              <input
                type="text"
                inputMode="numeric"
                name="soTien"
                value={formData.soTien}
                onChange={handleChange}
                onFocus={handleFocus}
                required
                placeholder="0"
              />
            </div>

            {/* Hàng 2: Hạng mục và Người cập nhật */}
            <div className="form-group">
              <label>Hạng mục</label>
              <select
                name="doiTuongThuChi"
                value={formData.doiTuongThuChi}
                onChange={handleChange}
                required
              >
                <option value="">Chọn hạng mục</option>
                {BUDGET_CATEGORIES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Người cập nhật</label>
              <select
                name="nguoiCapNhat"
                value={formData.nguoiCapNhat}
                onChange={handleChange}
              >
                {UPDATER_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Hàng 3: Nội dung */}
            <div className="form-group full-width">
              <label>Nội dung chi tiết (Vật tư/Nhân công)</label>
              <input
                type="text"
                name="noiDung"
                value={formData.noiDung}
                onChange={handleChange}
                required
                placeholder='VD: Xi măng, Cát, Công thợ...'
              />
              {/* Hiển thị gợi ý nếu có */}
              {activeSuggestions.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {activeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        noiDung: suggestion.label,
                        // Nếu gợi ý có số tiền mặc định thì điền luôn, format định dạng 1.000.000
                        soTien: suggestion.amount ? new Intl.NumberFormat('vi-VN').format(suggestion.amount) : prev.soTien
                      }))}
                      style={{
                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px',
                        padding: '4px 10px', fontSize: '0.8rem', color: '#1e40af', cursor: 'pointer'
                      }}
                      title="Chọn nhanh nội dung này"
                    >
                      {suggestion.label}
                      {suggestion.amount ? ` (${new Intl.NumberFormat('vi-VN').format(suggestion.amount)})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hidden Input cho Link Ảnh */}
            <input type="hidden" name="hinhAnh" value={formData.hinhAnh} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ocr" onClick={handleOCR} disabled={ocrScanning || uploading}>
              {ocrScanning ? <FiLoader className="spin" /> : <FiImage />} 
              {ocrScanning ? " Đang xử lý..." : " Quét OCR"}
            </button>
            <div className="spacer"></div>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-save" disabled={uploading}>
              <FiSave /> Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditModal;
