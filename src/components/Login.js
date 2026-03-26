import React, { useState } from "react";
import { FiLock, FiHome, FiEye, FiEyeOff } from "react-icons/fi";
import "./Login.css";

// THAY ĐỔI MẬT KHẨU CỦA BẠN TẠI ĐÂY
const PASSCODE = "081212";

function Login({ onLogin }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (passcode === PASSCODE) {
      localStorage.setItem("isLoggedIn", "true");
      onLogin();
    } else {
      setError("Mật mã không đúng!");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPasscode("");
    }
  };

  const handleChange = (e) => {
    setPasscode(e.target.value);
    if (error) setError("");
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <FiHome />
          </div>
          <h1 className="login-title">Quản lý thu chi & tiến độ</h1>
          <p className="login-subtitle">Dự án xây nhà</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`login-form ${isShaking ? "shake" : ""}`}
        >
          <div className="input-group">
            <label className="input-label">
              <FiLock />
              <span>Nhập mật mã để tiếp tục</span>
            </label>
            <div className="input-wrapper">
              <input
                type={showPasscode ? "text" : "password"}
                value={passcode}
                onChange={handleChange}
                placeholder="••••••"
                className={`passcode-input ${error ? "error" : ""}`}
                autoFocus
                maxLength={10}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPasscode(!showPasscode)}
              >
                {showPasscode ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="login-btn">
            Đăng nhập
          </button>
        </form>

        <p className="login-footer">© 2025 Quản Lý Thu Chi Xây Nhà</p>
      </div>
    </div>
  );
}

export default Login;
