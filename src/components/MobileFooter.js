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
    <footer className="mobile-footer" style={{ height: '55px', minHeight: '55px' }}>
      <nav className="footer-nav" style={{ padding: '0 10px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="nav-icon" style={{ fontSize: '18px' }} />
              <span className="nav-label" style={{ fontSize: '10px', marginTop: '2px' }}>{tab.label}</span>
              {activeTab === tab.id && <span className="nav-indicator"></span>}
            </button>
          );
        })}
        <button className="nav-item zalo-btn" onClick={openZalo} style={{ padding: '4px 0' }}>
          <img
            src="https://img.icons8.com/?size=100&id=0m71tmRjlxEe&format=png&color=000000"
            alt="Zalo"
            className="zalo-icon" 
            style={{ width: '20px', height: '20px' }}
          />
          <span className="nav-label" style={{ fontSize: '10px', marginTop: '2px' }}>Zalo</span>
        </button>
      </nav>
    </footer>
  );
}

export default MobileFooter;
