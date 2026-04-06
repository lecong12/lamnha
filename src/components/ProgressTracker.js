import React, { useState } from 'react';
import { FiCamera, FiLoader, FiSave, FiX, FiTrash2 } from 'react-icons/fi';

// Cấu hình Cloudinary
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');

function ProgressTracker({ stages = [], onUpdateStage, showToast }) {
  const [uploadingStageId, setUploadingStageId] = useState(null);
  const [pendingFiles, setPendingFiles] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  const handleUpdateStatus = async (stageId, newStatus) => {
    await onUpdateStage(stageId, { status: newStatus });
  };

  const handleDeleteImage = async (stage, index) => {
    if (!window.confirm("Xóa ảnh này?")) return;
    
    const newImages = [...stage.anhNghiemThu];
    newImages.splice(index, 1);
    
    await onUpdateStage(stage.id, { anhNghiemThu: newImages });
  };

  const handleFileSelect = (e, stageId) => {
    const file = e.target.files[0];
    if (!file) return;
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

  const handleConfirmUpload = async (stage) => {
    const stageId = stage.id;
    const { file } = pendingFiles[stageId] || {};
    if (!file) return;

    const notify = (message, type = "info") => {
      if (showToast) showToast(message, type);
      else alert(message);
    };

    try {
      setUploadingStageId(stageId);
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);
      notify("Đang upload ảnh...", "info");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { 
        method: "POST", 
        body: data, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Lỗi HTTP ${res.status}`);
      }

      const fileData = text ? JSON.parse(text) : {};

      if (fileData.secure_url) {
        // Thêm ảnh mới vào danh sách hiện có (Tối đa 6 ảnh)
        const currentImages = Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu : [];
        const updatedImages = [...currentImages, fileData.secure_url].slice(-6);

        const result = await onUpdateStage(stageId, { anhNghiemThu: updatedImages });
        if (result && result.success) {
          notify("Lưu thành công!", "success");
          handleCancelUpload(stageId);
        } else {
          throw new Error(result.message || "Không thể lưu link ảnh.");
        }
      } else {
        throw new Error(fileData.error?.message || "Lỗi upload Cloudinary.");
      }
    } catch (error) {
      let msg = "Lỗi upload: " + error.message;
      if (error.name === 'AbortError') {
        msg = "Upload thất bại: Quá thời gian chờ (Timeout).";
      }
      notify(msg, "error");
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
              {/* Danh sách ảnh đã lưu */}
              {Array.isArray(stage.anhNghiemThu) && stage.anhNghiemThu.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', aspectRatio: '1/1' }}>
                  <img 
                    src={url} 
                    alt={`Nghiệm thu ${idx}`} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }} 
                    onClick={() => setSelectedImage(url)}
                  />
                  <button 
                    onClick={() => handleDeleteImage(stage, idx)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.8)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}

              {/* Ảnh đang chờ upload */}
              {pendingFiles[stage.id] && (
                <div style={{ position: 'relative', aspectRatio: '1/1', border: '2px solid #3b82f6', borderRadius: '6px', overflow: 'hidden' }}>
                  <img 
                    src={pendingFiles[stage.id].preview} 
                    alt="Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, cursor: 'pointer' }} 
                    onClick={() => setSelectedImage(pendingFiles[stage.id].preview)}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)' }}>
                    {uploadingStageId === stage.id ? (
                      <FiLoader className="spin" color="white" />
                    ) : (
                      <>
                        <button onClick={() => handleConfirmUpload(stage)} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}><FiSave /> Lưu</button>
                        <button onClick={() => handleCancelUpload(stage.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}><FiX /> Hủy</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Nút thêm ảnh mới (chỉ hiện nếu chưa có file chờ và chưa quá 6 ảnh) */}
              {!pendingFiles[stage.id] && (!stage.anhNghiemThu || stage.anhNghiemThu.length < 6) && (
                <label style={{ 
                  aspectRatio: '1/1', 
                  border: '1px dashed #cbd5e1', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '11px'
                }}>
                  <FiCamera size={20} />
                  <span style={{ marginTop: '4px' }}>Thêm ảnh</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e, stage.id)} disabled={uploadingStageId === stage.id} />
                </label>
              )}
            </div>

            {/* Hiển thị số lượng */}
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'right' }}>
              Dung lượng: {Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu.length : 0}/6 ảnh
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox hiển thị ảnh phóng to */}
      {selectedImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
          onClick={() => setSelectedImage(null)}
        >
          <button 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--accent-color, #2d8e2b)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            onClick={() => setSelectedImage(null)}
          >
            <FiX size={24} />
          </button>
          <img src={selectedImage} alt="Phóng to" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;