import React, { useState } from 'react';
import { FiCamera, FiLoader, FiSave, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// Cấu hình Cloudinary
const CLOUD_NAME = (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").replace(/['"]/g, '');
const UPLOAD_PRESET = (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").replace(/['"]/g, '');

function ProgressTracker({ stages = [], onUpdateStage, showToast }) {
  const [uploadingStageId, setUploadingStageId] = useState(null);
  const [pendingFiles, setPendingFiles] = useState({});
  // gallery: { images: string[], index: number }
  const [gallery, setGallery] = useState(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handlePrevImage = (e) => {
    if (e) e.stopPropagation();
    if (!gallery) return;
    setGallery(prev => ({
      ...prev,
      index: (prev.index - 1 + prev.images.length) % prev.list.length // Dùng length của mảng ảnh
    }));
    // Thực tế mảng ảnh nằm trong prev.images
    setGallery(prev => {
      const newIdx = (prev.index - 1 + prev.images.length) % prev.images.length;
      return { ...prev, index: newIdx };
    });
  };

  const handleNextImage = (e) => {
    if (e) e.stopPropagation();
    if (!gallery) return;
    setGallery(prev => {
      const newIdx = (prev.index + 1) % prev.images.length;
      return { ...prev, index: newIdx };
    });
  };

  const handleSwipeEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 70) handleNextImage(); // Lướt sang trái -> Xem ảnh tiếp
    if (distance < -70) handlePrevImage(); // Lướt sang phải -> Xem ảnh trước
    setTouchStart(0);
    setTouchEnd(0);
  };

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
        {/* Sắp xếp: Ưu tiên hạng mục "Đang thi công" lên đầu, sau đó đến hạng mục có ảnh (mới nhất lên trên), cuối cùng là các hạng mục còn lại (cũ nhất lên trên) */}
        {[...stages].sort((a, b) => {
          const aIsInProgress = a.status === 'Đang thi công';
          const bIsInProgress = b.status === 'Đang thi công';

          // 1. Ưu tiên "Đang thi công" lên đầu
          if (aIsInProgress && !bIsInProgress) return -1; // a lên trước b
          if (!aIsInProgress && bIsInProgress) return 1;  // b lên trước a

          // Nếu cùng trạng thái "Đang thi công" (hoặc cùng không phải "Đang thi công"):
          const aHasImages = Array.isArray(a.anhNghiemThu) && a.anhNghiemThu.length > 0;
          const bHasImages = Array.isArray(b.anhNghiemThu) && b.anhNghiemThu.length > 0;

          // 2. Ưu tiên hạng mục có ảnh lên trước
          if (aHasImages && !bHasImages) return -1; // a lên trước b
          if (!aHasImages && bHasImages) return 1;  // b lên trước a

          // Nếu cùng trạng thái "Đang thi công" VÀ cùng trạng thái "có ảnh" (hoặc cùng không có ảnh):
          // 3. Sắp xếp theo appSheetId (mới nhất lên trên nếu có ảnh, cũ nhất lên trên nếu không có ảnh)
          if (aHasImages && bHasImages) {
            return (b.appSheetId || 0) - (a.appSheetId || 0); // Mới nhất lên trên
          } else {
            return (a.appSheetId || 0) - (b.appSheetId || 0); // Cũ nhất lên trên (duy trì thứ tự ban đầu)
          }
        }).map((stage) => (
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
              {Array.isArray(stage.anhNghiemThu) && [...stage.anhNghiemThu].reverse().map((url, revIdx) => {
                // Tính toán lại index gốc để xử lý xóa ảnh chính xác
                const originalIdx = stage.anhNghiemThu.length - 1 - revIdx;
                return (
                <div key={originalIdx} style={{ position: 'relative', aspectRatio: '1/1' }}>
                  <img 
                    src={url} 
                    alt={`Nghiệm thu ${originalIdx}`} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }} 
                    onClick={() => setGallery({ images: [...stage.anhNghiemThu].reverse(), index: revIdx })}
                  />
                  <button
                    onClick={() => handleDeleteImage(stage, originalIdx)}
                    style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      background: 'none', // Bỏ nền đỏ
                      color: '#ef4444', // Chữ X màu đỏ
                      border: 'none', // Bỏ viền trắng
                      padding: '3px', // Tạo vùng đệm nhỏ để dễ bấm nhưng không lộ
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 2,
                      lineHeight: 0
                    }}
                    title="Xóa ảnh"
                  >
                    <FiX size={11} />
                  </button>
                </div>
              )})}

              {/* Ảnh đang chờ upload */}
              {pendingFiles[stage.id] && (
                <div style={{ position: 'relative', aspectRatio: '1/1', border: '2px solid #3b82f6', borderRadius: '6px', overflow: 'hidden' }}>
                  <img 
                    src={pendingFiles[stage.id].preview} 
                    alt="Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, cursor: 'pointer' }} 
                    onClick={() => setGallery({ images: [pendingFiles[stage.id].preview], index: 0 })}
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
              Số ảnh: {Array.isArray(stage.anhNghiemThu) ? stage.anhNghiemThu.length : 0}/6 ảnh
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox hiển thị ảnh phóng to */}
      {gallery && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
          onClick={() => setGallery(null)}
          onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
          onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
          onTouchEnd={handleSwipeEnd}
        >
          <button 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }} 
            onClick={() => setGallery(null)}
          >
            <FiX size={24} />
          </button>

          {gallery.images.length > 1 && (
            <>
              <button 
                onClick={handlePrevImage}
                style={{ position: 'absolute', left: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '10px' }}
              >
                <FiChevronLeft size={40} />
              </button>
              <button 
                onClick={handleNextImage}
                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '10px' }}
              >
                <FiChevronRight size={40} />
              </button>
              <div style={{ position: 'absolute', bottom: '30px', color: 'white', fontSize: '14px', background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px' }}>
                {gallery.index + 1} / {gallery.images.length}
              </div>
            </>
          )}

          <img 
            src={gallery.images[gallery.index]} 
            alt="Phóng to" 
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', transition: 'transform 0.3s ease' }} 
          />
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;