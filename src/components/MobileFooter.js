import React from "react";
import { FiHome, FiList } from "react-icons/fi";
import "./MobileFooter.css";

function MobileFooter({ activeTab, onTabChange }) {
  const tabs = [
    { id: "dashboard", icon: FiHome, label: "Tổng quan" },
    { id: "list", icon: FiList, label: "Danh sách" },
  ];

  const openZalo = () => {
    window.open("https://zalo.me/g/djtbg9s1hexaliont5hh", "_blank");
  };

  return (
    <footer className="mobile-footer" style={{ height: '50px', minHeight: '50px' }}>
      <nav className="footer-nav" style={{ padding: '0 5px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="nav-icon" style={{ fontSize: '16px' }} />
              <span className="nav-label" style={{ fontSize: '9px', marginTop: '1px' }}>{tab.label}</span>
              {activeTab === tab.id && <span className="nav-indicator"></span>}
            </button>
          );
        })}
        <button className="nav-item zalo-btn" onClick={openZalo} style={{ padding: '2px 0' }}>
          <img
            src="https://img.icons8.com/?size=100&id=0m71tmRjlxEe&format=png&color=000000"
            alt="Zalo"
            className="zalo-icon" 
            style={{ width: '18px', height: '18px' }}
          />
          <span className="nav-label" style={{ fontSize: '9px', marginTop: '1px' }}>Zalo</span>
        </button>
      </nav>
    </footer>
  );
}

export default MobileFooter;
