import React from "react";
import { FiHome, FiList } from "react-icons/fi";
import "./MobileFooter.css";

function MobileFooter({ activeTab, onTabChange }) {
  const tabs = [
    { id: "dashboard", icon: FiHome, label: "Tổng quan" },
    { id: "list", icon: FiList, label: "Danh sách" },
  ];

  const openZalo = () => {
    window.open("https://zalo.me/g/YOUR_GROUP_ID", "_blank");
  };

  return (
    <footer className="mobile-footer">
      <nav className="footer-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="nav-icon" />
              <span className="nav-label">{tab.label}</span>
              {activeTab === tab.id && <span className="nav-indicator"></span>}
            </button>
          );
        })}
        <button className="nav-item zalo-btn" onClick={openZalo}>
          <img
            src="https://img.icons8.com/?size=100&id=0m71tmRjlxEe&format=png&color=000000"
            alt="Zalo"
            className="zalo-icon"
          />
          <span className="nav-label">Zalo</span>
        </button>
      </nav>
    </footer>
  );
}

export default MobileFooter;
