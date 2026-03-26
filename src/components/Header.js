import React from "react";
import { FiRefreshCw, FiLogOut, FiMenu, FiHome, FiPlus } from "react-icons/fi";
import "./Header.css";

function Header({ onRefresh, loading, onLogout, onToggleSidebar, onAdd }) {
  return (
    <header className="header" style={{ height: '60px', minHeight: '60px' }}>
      <div className="header-content">
        <div className="header-left">
          <button className="menu-btn" onClick={onToggleSidebar}>
            <FiMenu size={24} />
          </button>
          <div className="logo">
            <FiHome className="logo-icon" />
            <span className="logo-text">Sổ Tay Làm Nhà</span>
          </div>
        </div>

        <div className="header-right">
          {onAdd && (
            <button className="add-btn" onClick={onAdd} title="Thêm mới">
              <FiPlus />
              <span>Thêm mới</span>
            </button>
          )}
          <button
            className={`refresh-btn ${loading ? "loading" : ""}`}
            onClick={onRefresh}
            disabled={loading}
            title="Làm mới dữ liệu"
          >
            <FiRefreshCw />
            <span>Làm mới</span>
          </button>
          {onLogout && (
            <button className="logout-btn" onClick={onLogout} title="Đăng xuất">
              <FiLogOut />
              <span>Thoát</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
