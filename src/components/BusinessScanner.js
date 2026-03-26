import React, { useState, useRef } from 'react';
// Nếu file CSS của anh tên khác, hãy đổi tên import ở đây
import './App.css'; 

const BusinessScanner = () => {
  // --- STATE QUẢN LÝ ---
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [result, setResult] = useState(null); // Lưu kết quả quét hóa đơn (OCR)

  // --- STATE MỚI CHO ALBUM ẢNH TIẾN ĐỘ ---
  const [selectedFiles, setSelectedFiles] = useState([]); // Lưu file tạm
  const [previews, setPreviews] = useState([]);       // Lưu link preview (blob)

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); // Ref để kích hoạt input file ẩn

  // ==========================================
  // PHẦN 1: LOGIC CAMERA & QUÉT HÓA ĐƠN (GIỮ NGUYÊN)
  // ==========================================
  
  const startCamera = async () => {
    try {
      setResult(null); // Xóa kết quả cũ
      setPreviews([]);   // Xóa ảnh preview cũ
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" } // Ưu tiên camera sau
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      alert("Không thể mở Camera. Anh hãy kiểm tra quyền truy cập!");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // Hàm chụp ảnh từ Video và gửi đi quét (Logic OCR của anh)
  const captureAndScan = async () => {
    if (!cameraActive) return;
    setLoading(true);
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      // 1. Lấy ảnh Base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // 2. Tự động hiển thị ảnh vừa chụp vào ô Preview (để thợ biết đã chụp)
      setPreviews([imageData]); 

      // 3. Gửi sang Cloudinary & Gemini/AppSheet (Logic của anh)
      // Giả sử anh có hàm: const ocrResult = await ocrService.scan(imageData);
      // setResult(ocrResult); 
      
      console.log("Đã chụp ảnh và sẵn sàng gửi đi quét OCR...");
      stopCamera(); // Tắt camera sau khi chụp
    } catch (error) {
      alert("Lỗi khi chụp hoặc quét: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // PHẦN 2: LOGIC CHỌN NHIỀU ẢNH CHO NHẬT KÝ (MỚI)
  // ==========================================

  const handleFileChange = (e) => {
    stopCamera(); // Tắt camera nếu đang mở
    setResult(null); // Xóa kết quả OCR cũ
    
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(files);

    // Tạo link preview để hiển thị dạng Album
    const urlPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(urlPreviews);
    
    console.log(`Đã chọn ${files.length} ảnh cho Nhật ký.`);
  };

  // Hàm "Quyết định": Gửi toàn bộ ảnh lên Cloudinary và lưu vào Sheet
  const handleFinalSave = async () => {
    if (previews.length === 0) return alert("Anh chưa có ảnh nào để lưu!");
    setLoading(true);
    try {
      // 1. Upload mảng ảnh lên Cloudinary (Dùng Promise.all)
      // const allUrls = await uploadMultipleImages(selectedFiles);
      // const stringUrls = allUrls.join(","); 

      // 2. Gửi dữ liệu sang Sheet (Dùng API của anh)
      // await saveToNhatKySheet(stringUrls);

      console.log("Đã upload và lưu thành công album ảnh!");
      alert("Đã lưu Nhật ký thành công!");
      
      // Reset form
      setPreviews([]);
      setSelectedFiles([]);
    } catch (error) {
      alert("Lỗi khi lưu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // PHẦN 3: GIAO DIỆN JSX (SỬ DỤNG CSS CỦA ANH)
  // ==========================================
  
  return (
    <div className="scanner-wrapper">
      <div className="scanner-main-card">
        <h3 style={{ margin: '0 0 15px 0', color: '#111827' }}>Nhật Ký & Hóa Đơn</h3>

        {/* 1. Khu vực hiển thị: Camera hoặc Album Ảnh */}
        <div className="scan-display">
          {cameraActive ? (
            // Hiển thị Camera đang mở
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} 
            />
          ) : previews.length > 0 ? (
            // Hiển thị Album Ảnh Preview (Dùng CSS .card-thumb của anh)
            previews.map((src, index) => (
              <img 
                key={index} 
                src={src} 
                className="card-thumb" 
                alt={`preview-${index}`} 
              />
            ))
          ) : (
            // Trạng thái trống
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
              <i className="fas fa-camera fa-2x" style={{ marginBottom: '10px' }}></i>
              <p style={{ margin: 0, fontSize: '14px' }}>Bấm nút dưới để mở camera hoặc chọn ảnh</p>
            </div>
          )}
        </div>

        {/* 2. Hiển thị Kết quả Quét hóa đơn (OCR) (Nếu có) */}
        {result && (
          <div className="scan-result" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <p className="biz-name">✅ {result.name || "Đã đọc hóa đơn"}</p>
              <p className="biz-phone">{result.phone || "Không có sđt"}</p>
              {result.total && <p style={{ fontWeight: 'bold', color: '#10b981', margin: '5px 0 0 0' }}>{result.total} VNĐ</p>}
            </div>
            {result.phone && (
              <a href={`tel:${result.phone}`} className="call-now-btn">
                <i className="fas fa-phone"></i> Gọi
              </a>
            )}
          </div>
        )}

        {/* 3. Khu vực các nút bấm hành động */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          
          {/* Nút 1: Mở Camera / Chụp */}
          {cameraActive ? (
            <button className={`capture-btn ${loading ? 'disabled' : ''}`} onClick={captureAndScan} disabled={loading}>
              {loading ? <i className="fas fa-spinner spin"></i> : <i className="fas fa-dot-circle"></i>}
              {loading ? "Đang quét..." : "Chụp & Quét"}
            </button>
          ) : (
            <button className="capture-btn" onClick={startCamera}>
              <i className="fas fa-camera"></i> Mở Camera
            </button>
          )}

          {/* Nút 2: Chọn Ảnh từ máy / Lưu Nhật Ký */}
          {previews.length > 0 && !cameraActive ? (
            // Nếu đã có ảnh, đổi thành nút "Lưu" (Màu xanh lá call-now-btn)
            <button className="call-now-btn" style={{ justifyContent: 'center', width: '100%', margin: 0, padding: '15px', borderRadius: '10px' }} onClick={handleFinalSave} disabled={loading}>
              {loading ? <i className="fas fa-spinner spin"></i> : <i className="fas fa-save"></i>}
              {loading ? "Đang lưu..." : "Lưu Nhật Ký"}
            </button>
          ) : (
            // Nếu chưa có ảnh, hiện nút "Chọn Ảnh" (Màu xám/dương nhẹ)
            <button className="capture-btn" style={{ background: '#6b7280' }} onClick={() => fileInputRef.current.click()}>
              <i className="fas fa-images"></i> Chọn Ảnh
            </button>
          )}
        </div>

        {/* Input File ẩn để chọn nhiều ảnh */}
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          accept="image/*" 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default BusinessScanner;
