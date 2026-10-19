import React, { useState } from "react";
import { FiLock, FiUser, FiHome, FiEye, FiEyeOff } from "react-icons/fi";
import { authService } from "../utils/authService";
import "./Login.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = authService.login(username, password);

    if (result.success) {
      if (onLogin) onLogin(result.user);
    } else {
      setError(result.message || "Tên tài khoản hoặc mật khẩu không đúng!");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <FiHome />
          </div>
          <h1 className="login-title">Sổ Tay Làm Nhà</h1>
          <p className="login-subtitle">Đăng nhập hệ thống quản lý</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`login-form ${isShaking ? "shake" : ""}`}
        >
          {/* Tên tài khoản */}
          <div className="input-group">
            <label className="input-label">
              <FiUser />
              <span>Tên tài khoản</span>
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                name="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nhập tên tài khoản (mặc định: admin)"
                className={`login-input ${error ? "error" : ""}`}
                autoFocus
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div className="input-group">
            <label className="input-label">
              <FiLock />
              <span>Mật khẩu</span>
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nhập mật khẩu (mặc định: 123)"
                className={`login-input password-input ${error ? "error" : ""}`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {error && <span className="error-message">{error}</span>}
          </div>

          <button type="submit" className="login-btn">
            Đăng nhập
          </button>
        </form>

        <p className="login-footer">© Sổ Tay Làm Nhà</p>
      </div>
    </div>
  );
}

export default Login;
