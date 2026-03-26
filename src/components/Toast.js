import React, { useEffect } from "react";
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiX } from "react-icons/fi";
import "./Toast.css";

function Toast({ message, type = "success", onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <FiCheckCircle />,
    error: <FiXCircle />,
    warning: <FiAlertCircle />,
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{icons[type]}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose}>
        <FiX />
      </button>
    </div>
  );
}

export default Toast;
