import React from 'react';
import { FiVideo, FiAlertCircle, FiMaximize } from 'react-icons/fi';
import './CameraMonitor.css';

const CAMERA_URL = process.env.REACT_APP_CAMERA_STREAM_URL;

function CameraMonitor() {
  if (!CAMERA_URL) {
    return (
      <div className="camera-container empty">
        <div className="empty-state">
          <FiAlertCircle size={48} />
          <p>Chưa cấu hình link stream camera.</p>
          <small>Vui lòng thêm <strong>REACT_APP_CAMERA_STREAM_URL</strong> vào file .env</small>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-container">
      <h2 className="page-title"><FiVideo /> Giám sát công trình trực tuyến</h2>
      
      <div className="camera-card">
        <div className="camera-header">
          <div className="status-indicator">
            <span className="dot"></span> Trực tiếp
          </div>
          <span className="camera-name">Yoosee Cam #1</span>
        </div>
        <div className="camera-wrapper">
          <iframe
            src={CAMERA_URL}
            title="Công trường trực tiếp"
            allowFullScreen
            allow="autoplay; encrypted-media"
            className="camera-frame"
          ></iframe>
        </div>
      </div>
      
      <div className="camera-instructions chart-card">
        <h4 className="chart-title" style={{ fontSize: '14px', marginBottom: '10px' }}>
          <FiMaximize /> Hướng dẫn & Lưu ý
        </h4>
        <ul style={{ fontSize: '13px', color: 'var(--text-muted)', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Nhấn vào biểu tượng <strong>Full Screen</strong> trên khung hình để xem rõ hơn.</li>
          <li>Hình ảnh phụ thuộc vào tốc độ mạng tại công trình và thiết bị của bạn.</li>
          <li>Nên sử dụng link Iframe từ <strong>Angelcam</strong> để có độ trễ thấp và độ ổn định cao nhất.</li>
        </ul>
      </div>
    </div>
  );
}

export default CameraMonitor;