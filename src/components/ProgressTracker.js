import React, { useState } from 'react';
import { FiCamera, FiLoader, FiSave, FiX, FiTrash2 } from 'react-icons/fi';

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
    const stage = stages.find(s => String(s.id) === String(stageId));
    const currentCount = Array.isArray(stage?.anhNghiemThu) ? stage.anhNghiemThu.length : 0;

    if (!file) return;
    if (currentCount >= 6) {
      alert("Đã đạt giới hạn 6 ảnh cho giai đoạn này.");
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

  const handleDeleteImage = async (stageId, index) => {
    if (!window.confirm("Bạn muốn xóa ảnh này?")) return;
    const stage = stages.find(s => String(s.id) === String(stageId));
    const currentImages = Array.isArray(stage?.anhNghiemThu) ? stage.anhNghiemThu : [];
    const newImages = currentImages.filter((_, i) => i !== index);
    
    const imgCol = stage?.imgColumn || "Ảnh nghiệm thu";
    await onUpdateStage(stageId, { [imgCol]: newImages.join(',') });
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
        const stage = stages.find(s => String(s.id) === String(stageId));
        const currentImages = Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu : [];
        // Thêm ảnh mới vào mảng hiện có và giới hạn 6
        const newImages = [...currentImages, fileData.secure_url].slice(0, 6);
        
        const result = await onUpdateStage(stageId, { [stage?.imgColumn || "Ảnh nghiệm thu"]: newImages.join(',') });
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
            
            <div className="stage-images-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '8px', 
              marginTop: '12px' 
            }}>
              {/* Ảnh đã có */}
              {Array.isArray(stage.anhNghiemThu) && stage.anhNghiemThu.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', aspectRatio: '1/1' }}>
                  <img src={url} alt="Nghiệm thu" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                  <button 
                    onClick={() => handleDeleteImage(stage.id, idx)}
                    style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer', display: 'flex' }}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}

              {/* Ảnh đang chờ upload */}
              {pendingFiles[stage.id] && (
                <div style={{ position: 'relative', aspectRatio: '1/1', border: '2px solid #3b82f6', borderRadius: '4px' }}>
                  <img src={pendingFiles[stage.id].preview} alt="Pending" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <button onClick={() => handleConfirmUpload(stage.id)} disabled={uploadingStageId === stage.id} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '4px' }}>
                      {uploadingStageId === stage.id ? <FiLoader className="spin" /> : <FiSave size={14} />}
                    </button>
                    <button onClick={() => handleCancelUpload(stage.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px' }}>
                      <FiX size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Nút thêm ảnh (chỉ hiện nếu < 6 ảnh và chưa có file pending) */}
              {!pendingFiles[stage.id] && (Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu.length : 0) < 6 && (
                <label style={{ 
                  aspectRatio: '1/1', 
                  border: '1px dashed #cbd5e1', 
                  borderRadius: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  color: '#64748b' 
                }}>
                  <FiCamera size={20} />
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