import React, { useState } from "react";
import { FiCamera, FiLoader, FiSave, FiX, FiCheckCircle, FiClock, FiAlertCircle } from "react-icons/fi";
import './ProgressTracker.css';

// Cấu hình Cloudinary từ môi trường
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, "");
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, "");

function ProgressTracker({ stages = [], onUpdateStage, showToast, isDarkMode }) {
  const [pendingFiles, setPendingFiles] = useState({});
  const [uploadingStageId, setUploadingStageId] = useState(null);

  const handleUpdateStatus = async (stageId, newStatus) => {
    try {
      if (onUpdateStage) {
        await onUpdateStage(stageId, { status: newStatus });
      }
    } catch (error) {
      showToast("Lỗi cập nhật trạng thái", "error");
    }
  };

  const handleFileSelect = (e, stageId) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Vui lòng chỉ chọn file ảnh.", "warning");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("File ảnh quá lớn (> 10MB).", "warning");
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingFiles((prev) => ({ ...prev, [stageId]: { file, preview } }));
    e.target.value = null;
  };

  const handleCancelUpload = (stageId) => {
    setPendingFiles((prev) => {
      const newState = { ...prev };
      if (newState[stageId]?.preview) URL.revokeObjectURL(newState[stageId].preview);
      delete newState[stageId];
      return newState;
    });
  };

  const handleConfirmUpload = async (stageId) => {
    const { file } = pendingFiles[stageId] || {};
    if (!file) return;

    try {
      setUploadingStageId(stageId);
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);
      data.append("resource_type", "auto"); // Sử dụng auto để Cloudinary tự nhận diện
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { 
        method: "POST", 
        body: data 
      });

      const fileData = await res.json();
      
      if (fileData.secure_url) {
        const result = await onUpdateStage(stageId, {
          "Ảnh nghiệm thu": fileData.secure_url,
        });
        if (result && result.success) {
          showToast("Lưu ảnh thành công!", "success");
          handleCancelUpload(stageId);
        } else {
          throw new Error(result.message || "Không thể lưu link ảnh.");
        }
      } else {
        throw new Error(fileData.error?.message || "Lỗi Cloudinary.");
      }
    } catch (error) {
      showToast("Lỗi upload: " + error.message, "error");
    } finally {
      setUploadingStageId(null);
    }
  };

  if (!stages || stages.length === 0) {
    return <div className="no-data"><FiAlertCircle /> Chưa có dữ liệu tiến độ.</div>;
  }

  return (
    <div className="progress-tracker-section">
      <div className="stages-grid">
        {stages.map((stage) => (
          <div key={stage.id} className="stage-card" style={{ color: isDarkMode ? '#ffffff' : 'inherit' }}>
            <div className="stage-info">
              <div className="stage-header-row">
                {stage.status === 'Hoàn thành' ? <FiCheckCircle color="#22c55e" /> : <FiClock color="#64748b" />}
                <span className="stage-name-text">{stage.name || stage.ten_hang_muc}</span>
              </div>
              <p className="stage-date-text">
                {stage.ngayBatDau && stage.ngayKetThuc
                  ? `${stage.ngayBatDau.toLocaleDateString('vi-VN')} - ${stage.ngayKetThuc.toLocaleDateString('vi-VN')}`
                  : "Chưa xác định ngày"}
              </p>
            </div>

            <select
              value={stage.status}
              onChange={(e) => handleUpdateStatus(stage.id, e.target.value)}
              className={`status-select-box status-${stage.status?.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <option value="Chưa bắt đầu">Chưa bắt đầu</option>
              <option value="Đang thi công">Đang thi công</option>
              <option value="Hoàn thành">Hoàn thành</option>
            </select>
            
            <div className="image-upload-zone">
              {pendingFiles[stage.id] ? (
                <div className="preview-container">
                  <img src={pendingFiles[stage.id].preview} alt="Preview" className="img-preview" />
                  <div className="upload-actions">
                    <button onClick={() => handleConfirmUpload(stage.id)} disabled={uploadingStageId === stage.id} className="btn-confirm">
                      {uploadingStageId === stage.id ? <FiLoader className="spin" /> : <FiSave />} Lưu
                    </button>
                    <button onClick={() => handleCancelUpload(stage.id)} disabled={uploadingStageId === stage.id} className="btn-cancel">
                      <FiX /> Hủy
                    </button>
                  </div>
                </div>
              ) : (stage.anhNghiemThu || stage["Ảnh nghiệm thu"]) ? (
                <div className="current-image">
                  <img src={stage.anhNghiemThu || stage["Ảnh nghiệm thu"]} alt="Nghiệm thu" className="img-done" />
                  <label className="edit-image-label">
                    <FiCamera /> Sửa
                    <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, stage.id)} />
                  </label>
                </div>
              ) : (
                <label className="upload-placeholder-box">
                  <FiCamera size={24} />
                  <span>Thêm ảnh nghiệm thu</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, stage.id)} />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProgressTracker;
