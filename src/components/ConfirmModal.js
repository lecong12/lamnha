import React from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import './ConfirmModal.css';

function ConfirmModal({ isOpen, onClose, onConfirm, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="confirm-title">
            <FiAlertTriangle /> {title || 'Xác nhận hành động'}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="modal-body">
          {children || <p>Bạn có chắc chắn muốn thực hiện hành động này?</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn-confirm-delete" onClick={onConfirm}>
            Xác nhận Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;