import React from "react";
import { FiHome, FiList, FiFileText, FiVideo } from "react-icons/fi";
import "./MobileFooter.css";

function MobileFooter({ activeTab, onTabChange }) {
  const tabs = [
    { id: "dashboard", icon: FiHome, label: "Tổng quan" },
    { id: "list", icon: FiList, label: "Giao dịch" },
    { id: "camera", icon: FiVideo, label: "Camera" },
    { id: "notes", icon: FiFileText, label: "Ghi chú" },
  ];

  const openZalo = () => {
    window.open("https://zalo.me/g/djtbg9s1hexaliont5hh", "_blank");
  };

  return (
    <footer className="mobile-footer" style={{ height: '40px', minHeight: '40px' }}>
      <nav className="footer-nav" style={{ padding: '0 2px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="nav-icon" style={{ fontSize: '14px' }} />
              <span className="nav-label" style={{ fontSize: '7.5px', marginTop: '0px' }}>{tab.label}</span>
              {activeTab === tab.id && <span className="nav-indicator"></span>}
            </button>
          );
        })}
        <button className="nav-item zalo-btn" onClick={openZalo} style={{ padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="https://img.icons8.com/?size=100&id=0m71tmRjlxEe&format=png&color=000000"
            alt="Zalo"
            className="zalo-icon" 
            style={{ width: '14px', height: '14px' }}
          />
          <span className="nav-label" style={{ fontSize: '7.5px', marginTop: '0px' }}>Zalo</span>
        </button>
      </nav>
    </footer>
  );
}

export default MobileFooter;
