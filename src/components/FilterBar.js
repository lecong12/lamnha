import React from "react";
import {
  FiFilter,
  FiSearch,
  FiX,
  FiDownload,
  FiFileText, // Thêm icon cho PDF
  FiPlus, // Thêm icon cho nút Thêm
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import "./FilterBar.css";

function FilterBar({ filters, filterOptions, onFilterChange, onReset, isExpanded, onToggleExpand, onAdd, onExport, onExportPDF }) {
  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="filter-bar">
      <div className="filter-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="filter-title">
            <FiFilter />
            <span>Lọc và Tìm</span>
            {hasActiveFilters && <span className="filter-badge">Đang lọc</span>}
          </div>
          <button
            className="toggle-btn"
            onClick={onToggleExpand}
          >
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
            <span className="toggle-text">
              {isExpanded ? "Thu gọn" : "Mở rộng"}
            </span>
          </button>
        </div>

        <div className="filter-actions">
          <button className="toggle-btn add-btn" onClick={onAdd} title="Thêm giao dịch mới">
            <FiPlus />
            <span className="toggle-text">Thêm mới</span>
          </button>
          {hasActiveFilters && (
            <button className="reset-btn" onClick={onReset}>
              <FiX />
              <span>Xóa lọc</span>
            </button>
          )}
          <button className="toggle-btn" onClick={onExportPDF} title="Xuất PDF">
            <FiFileText />
            <span className="toggle-text">PDF</span>
          </button>
          <button className="toggle-btn" onClick={onExport} title="Xuất Excel">
            <FiDownload />
            <span className="toggle-text">Excel</span>
          </button>
        </div>
      </div>

      {/* Search bar - always visible */}
      <div className="search-container">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Tìm hạng mục, vật tư..."
          value={filters.searchText}
          onChange={(e) => onFilterChange("searchText", e.target.value)}
          className="search-input"
        />
        {filters.searchText && (
          <button
            className="clear-search"
            onClick={() => onFilterChange("searchText", "")}
          >
            <FiX />
          </button>
        )}
      </div>

      {/* Expanded filters */}
      <div className={`filter-content ${isExpanded ? "expanded" : ""}`}>
        <div className="filter-grid">
          {/* Đối tượng thu chi */}
          <div className="filter-group">
            <label className="filter-label">Hạng mục</label>
            <select
              value={filters.doiTuongThuChi}
              onChange={(e) => onFilterChange("doiTuongThuChi", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả</option>
              {filterOptions.doiTuongThuChi.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Người cập nhật - Bổ sung */}
          <div className="filter-group">
            <label className="filter-label">Người cập nhật</label>
            <select
              value={filters.nguoiCapNhat}
              onChange={(e) => onFilterChange("nguoiCapNhat", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả</option>
              {filterOptions.nguoiCapNhat.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Ngày bắt đầu */}
          <div className="filter-group">
            <label className="filter-label">Từ ngày</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange("startDate", e.target.value)}
              className="filter-input"
            />
          </div>

          {/* Ngày kết thúc */}
          <div className="filter-group">
            <label className="filter-label">Đến ngày</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange("endDate", e.target.value)}
              className="filter-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;
