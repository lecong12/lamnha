import React, { useState, useEffect } from 'react';
import { FiCamera, FiLoader, FiPhone, FiCheckCircle, FiClock } from 'react-icons/fi';
import { addRowToSheet, fetchTableData } from '../utils/sheetsAPI'; // Removed unused updateRowInSheet
import './BusinessScanner.css';

const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '').trim();
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '').trim();

// Helper to normalize scanned data from AppSheet
const normalizeScanData = (rowData) => {
  if (!rowData) return null;

  const normalized = {
    id: rowData.ID || rowData.id || rowData._RowNumber, // Use 'id' for internal tracking
    ID: rowData.ID || rowData.id || rowData._RowNumber, // Keep original ID for tracking
    TenDoanhNghiep: "Chưa xác định", // camelCase for JSX display
    SoDienThoai: "Không tìm thấy", // camelCase for JSX display
    TrangThai: "Processing", // camelCase for JSX display
    AnhCard: "", // camelCase for JSX display
    // Explicit Vietnamese keys for AppSheet interaction
    "Tên Doanh Nghiệp": "Chưa xác định", 
    "Số Điện Thoại": "Không tìm thấy", 
    "Trạng Thái": "Processing", 
    "Ảnh Card": "", 
    "Ngày Quét": "",
    ...rowData // Keep all other original properties, but prioritize explicit normalized keys
  };

  // Normalize Company Name
  const companyKeys = ['Tên Doanh Nghiệp', 'Ten Doanh Nghiep', 'Company Name', 'Company'];
  for (const key of companyKeys) {
    if (rowData[key]) { normalized["Tên Doanh Nghiệp"] = rowData[key]; normalized.TenDoanhNghiep = rowData[key]; break; } // Assign to both
  }

  // Normalize Phone Number
  const phoneKeys = ['Số Điện Thoại', 'So Dien Thoai', 'Phone Number', 'Phone', 'SDT'];
  for (const key of phoneKeys) {
    if (rowData[key]) { normalized["Số Điện Thoại"] = rowData[key]; normalized.SoDienThoai = rowData[key]; break; } // Assign to both
  }

  // Normalize Status
  const statusKeys = ['Trạng Thái', 'Trang Thai', 'Status'];
  for (const key of statusKeys) {
    if (rowData[key]) { normalized["Trạng Thái"] = rowData[key]; normalized.TrangThai = rowData[key]; break; } // Assign to both
  }

  // Normalize Image URL
  const imageKeys = ['Ảnh Card', 'Anh Card', 'Image URL', 'Image'];
  for (const key of imageKeys) {
    if (rowData[key]) { normalized["Ảnh Card"] = rowData[key]; normalized.AnhCard = rowData[key]; break; } // Assign to both
  }

  // Normalize Ngay Quet
  const dateKeys = ['Ngày Quét', 'Ngay Quet', 'Scan Date', 'Date'];
  for (const key of dateKeys) {
    if (rowData[key]) { normalized["Ngày Quét"] = rowData[key]; normalized.NgayQuet = rowData[key]; break; } // Assign to both
  }
  return normalized;
};

function BusinessScanner({ showToast }) {
  const [uploading, setUploading] = useState(false);
  const [latestScan, setLatestScan] = useState(null);
  const [polling, setPolling] = useState(false);
  const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

  // Hàm tự động kiểm tra xem AI đã quét xong chưa (Polling)
  useEffect(() => {
    let interval;
    if (polling && latestScan) {
      // Use a more robust polling mechanism: fetch only the specific row if possible,
      // or filter more carefully. For now, fetching all and filtering is okay.
      interval = setInterval(async () => {
        const res = await fetchTableData("DanhBa", APP_ID); // Fetch all data from "DanhBa"
        if (res.success && res.data) {
          // Find the specific row that was just added by its ID
          // Note: AppSheet might return different casing for ID, so normalize
          // Also, latestScan.ID is the ID we generated (e.g., SCAN_12345)
          const updatedRow = res.data.find(r => 
            (r.ID && r.ID === latestScan.ID) || 
            (r.id && r.id === latestScan.ID) ||
            (r._RowNumber && r._RowNumber === latestScan._RowNumber) || // Fallback to _RowNumber if ID isn't reliable
            (r.ID && r.ID === latestScan.id) // Check against normalized 'id'
          );

          const normalizedUpdatedRow = normalizeScanData(updatedRow);
          if (normalizedUpdatedRow && normalizedUpdatedRow.TrangThai === "Completed") { // Use camelCase key for status check
            setLatestScan(normalizedUpdatedRow); // <--- This is where latestScan is updated
            setPolling(false);
            showToast("AI đã trích xuất xong!", "success"); //
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
          "ID": `SCAN_${Date.now()}`, // Explicit column name
          "Ảnh Card": fileData.secure_url, // Explicit column name
          "Tên Doanh Nghiệp": "Đang phân tích...", // Explicit column name
          "Số Điện Thoại": "", // Explicit column name
          "Ngày Quét": new Date().toLocaleString('vi-VN'), // Explicit column name
          "Trạng Thái": "Processing" // Explicit column name
        };

        const sheetRes = await addRowToSheet("DanhBa", rowData, APP_ID);
        if (sheetRes.success) {
          setLatestScan(normalizeScanData(rowData)); // Normalize initial data as well
          setPolling(true);
          showToast("Đã gửi ảnh. Vui lòng chờ AI trong giây lát.", "info");
        } else {
          // Log the error message from AppSheet API
          showToast(`Lỗi lưu vào Sheet: ${sheetRes.message}`, "error");
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
            <div className="scan-result-container"> {/* New container for image + info */}
              <img src={latestScan.AnhCard} alt="Card" className="card-thumb" /> {/* Use camelCase key */}
              
                {polling ? (
                  <div className="status-loading"><FiClock className="spin" /> AI đang đọc dữ liệu...</div>
                ) : (
                  <div className="result-card">
                    <p className="result-title">Thông tin tìm thấy:</p>
                    
                    <div className="info-row">
                      <p className="label">Doanh nghiệp:</p>
                      <p className="value">{latestScan.TenDoanhNghiep || "Chưa xác định"}</p> {/* Use camelCase key */}
                    </div>

                    <div className="info-row">
                      <p className="label">Số điện thoại:</p>
                      <p className="value">{latestScan.SoDienThoai || "Không tìm thấy"}</p> {/* Use camelCase key */}
                    </div>

                    <div className="button-group">
                      {latestScan.SoDienThoai && latestScan.SoDienThoai !== "Không tìm thấy" && (
                        <a 
                          href={`tel:${latestScan.SoDienThoai.replace(/\D/g,'')}`} 
                          className="call-button"
                        >
                          📞 Gọi ngay
                        </a>
                      )}
                      <button 
                        className="reset-button" 
                        onClick={() => { 
                          setLatestScan(null); 
                          setPolling(false); 
                        }}
                      >
                        Quét lại
                      </a>
                    </div>
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
