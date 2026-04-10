import React, { useState } from 'react';
import { FiCamera, FiLoader, FiSave, FiX } from 'react-icons/fi';

// Cấu hình Cloudinary
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');

function ProgressTracker({ stages = [], onUpdateStage, showToast }) {
  const [uploadingStageId, setUploadingStageId] = useState(null);
  const [pendingFiles, setPendingFiles] = useState({});

  const handleUpdateStatus = async (stageId, newStatus) => {
    await onUpdateStage(stageId, { status: newStatus });
  };

  const handleFileSelect = (e, stageId) => {
    const file = e.target.files[0];
    const stage = stages.find(s => s.id === stageId);
    const currentCount = Array.isArray(stage?.anhNghiemThu) ? stage.anhNghiemThu.length : 0;

    if (!file || currentCount >= 6) {
      if (currentCount >= 6) alert("Đã đạt giới hạn 6 ảnh cho giai đoạn này.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chỉ chọn file ảnh.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File ảnh quá lớn ( > 10MB). Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingFiles(prev => ({ ...prev, [stageId]: { file, preview } }));
    e.target.value = null;
  };

  const handleCancelUpload = (stageId) => {
    setPendingFiles(prev => {
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

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: data });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }

      const fileData = text ? JSON.parse(text) : {};

      if (fileData.secure_url) {
        const stage = stages.find(s => s.id === stageId);
        const currentImages = Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu : [];
        // Thêm ảnh mới vào mảng hiện có và giới hạn 6
        const newImages = [...currentImages, fileData.secure_url].slice(0, 6);
        
        const result = await onUpdateStage(stageId, { [stage.imgColumn || "Ảnh nghiệm thu"]: newImages.join(',') });
        if (result && result.success) {
          showToast?.("Đã thêm ảnh thành công!", "success");
          handleCancelUpload(stageId);
        } else {
          throw new Error(result.message || "Không thể lưu link ảnh.");
        }
      } else {
        throw new Error(fileData.error?.message || "Lỗi upload Cloudinary.");
      }
    } catch (error) {
      showToast?.("Lỗi upload: " + error.message, "error");
    } finally {
      setUploadingStageId(null);
    }
  };

  return (
    <div className="progress-tracker-section chart-card">
      <h3 className="chart-title">Theo dõi tiến độ thi công</h3>
      <div className="stages-grid" style={{ maxHeight: "80vh", overflowY: "auto", paddingRight: "10px" }}>
        {stages.map((stage) => (
          <div key={stage.id} className="stage-card">
            <span className="stage-name">{stage.name.replace(/^\d+\.\s*/, "")}</span>
            <select
              value={stage.status}
              onChange={(e) => handleUpdateStatus(stage.id, e.target.value)}
              className={`status-select status-${stage.status.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <option value="Chưa bắt đầu">Chưa bắt đầu</option>
              <option value="Đang thi công">Đang thi công</option>
              <option value="Hoàn thành">Hoàn thành</option>
            </select>
            
            <div className="stage-image-container" style={{ marginTop: '10px', position: 'relative' }}>
              {pendingFiles[stage.id] ? (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={pendingFiles[stage.id].preview} 
                    alt="Preview" 
                    style={{ width: '100%', borderRadius: '4px', objectFit: 'cover', maxHeight: '150px', display: 'block', border: '2px solid #3b82f6' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 5, right: 5, display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={() => handleConfirmUpload(stage.id)} 
                      disabled={uploadingStageId === stage.id}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    >
                      {uploadingStageId === stage.id ? <FiLoader className="spin" /> : <FiSave />} 
                      Lưu
                    </button>
                    <button 
                      onClick={() => handleCancelUpload(stage.id)}
                      disabled={uploadingStageId === stage.id}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    >
                      <FiX /> Hủy
                    </button>
                  </div>
                </div>
              ) : stage.anhNghiemThu ? (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={stage.anhNghiemThu} 
                    alt="Ảnh nghiệm thu" 
                    style={{ width: '100%', borderRadius: '4px', objectFit: 'cover', maxHeight: '150px', display: 'block' }} 
                  />
                  <label className="upload-btn-overlay" style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiCamera /> 
                    <span>Sửa</span>
                    <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, stage.id)} disabled={uploadingStageId === stage.id} />
                  </label>
                </div>
              ) : (
                <label className="upload-placeholder" style={{ border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '13px' }}>
                  <FiCamera size={20} />
                  <span style={{ marginTop: '5px' }}>Thêm ảnh nghiệm thu</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, stage.id)} disabled={uploadingStageId === stage.id} />
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