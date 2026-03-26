import React, { useState, useMemo } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiUser,
  FiInfo,
  FiEdit2,
  FiTrash2,
  FiImage,
  FiDownload,
} from "react-icons/fi";
import "./DataTable.css";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date) => {
  if (!date || !(date instanceof Date)) return "-";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatStageName = (name) => {
  if (!name) return "-";
  // Cắt bỏ phần trong ngoặc và xóa số thứ tự đầu dòng (VD: "1. Chuẩn bị (GPXD)" -> "Chuẩn bị")
  return name.split("(")[0].trim().replace(/^\d+\.\s*/, "");
};

function DataTable({ data, onEdit, onDelete }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "ngay", direction: "desc" }); // Mặc định sắp xếp theo ngày giảm dần
  const itemsPerPage = 10;

  // Logic sắp xếp dữ liệu
  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Xử lý an toàn null/undefined
        if (aValue === null || aValue === undefined) aValue = "";
        if (bValue === null || bValue === undefined) bValue = "";

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedRow(null);
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const pageTotalChi = currentData
    .filter((item) => item.loaiThuChi === "Chi")
    .reduce((sum, item) => sum + item.soTien, 0);

  const chiList = currentData; // Tất cả dữ liệu giờ là chi phí

  if (data.length === 0) {
    return (
      <div className="data-table-container">
        <div className="no-data-message">
          <FiInfo size={48} />
          <p>Không có dữ liệu phù hợp với bộ lọc</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table-container">

      {/* Bảng Chi Phí */}
      {chiList.length > 0 && (
        <div className="section-container">
          <div className="section-header">
            <h4 className="section-title chi-title">Bảng Chi Phí</h4>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span className="summary-item chi">
                Tổng Chi: {formatCurrency(pageTotalChi)}
              </span>
            </div>
          </div>
          <div className="table-wrapper desktop-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort("ngay")} style={{cursor: 'pointer', userSelect: 'none'}} title="Click để sắp xếp">
                    Ngày {sortConfig.key === "ngay" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th onClick={() => requestSort("doiTuongThuChi")} style={{cursor: 'pointer', userSelect: 'none'}} title="Click để sắp xếp">
                    Hạng mục {sortConfig.key === "doiTuongThuChi" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Nội dung giao dịch</th>
                  <th 
                    onClick={() => requestSort("soTien")} 
                    style={{cursor: 'pointer', userSelect: 'none', textAlign: 'right'}} 
                    title="Click để sắp xếp"
                  >
                    Số tiền {sortConfig.key === "soTien" && (sortConfig.direction === "asc" ? "▲" : "▼")}
                  </th>
                  <th>Người cập nhật</th>
                  <th>Chứng từ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {chiList.map((item) => (
                  <tr key={item.id} className="row-chi">
                    <td style={{whiteSpace: 'nowrap'}}>{formatDate(item.ngay)}</td>
                    <td>{formatStageName(item.doiTuongThuChi)}</td>
                    <td className="content-cell">{item.noiDung || "-"}</td>
                    <td className="amount-cell chi" style={{ textAlign: 'right' }}>
                      {formatCurrency(item.soTien)}
                    </td>
                    <td>{item.nguoiCapNhat || "-"}</td>
                    <td className="center-cell">
                      {item.hinhAnh ? (
                        <a href={item.hinhAnh} target="_blank" rel="noreferrer" className="view-image-link" title="Xem ảnh">
                          <img 
                            src={item.hinhAnh} 
                            alt="Chứng từ" 
                            style={{ 
                              width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' 
                            }} 
                            onError={(e) => {e.target.onerror = null; e.target.src = "https://via.placeholder.com/40?text=Err"}}
                          />
                        </a>
                      ) : (
                        <span className="no-image">-</span>
                      )}
                    </td>
                    <td className="action-cell">
                      <button
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards cho Chi */}
          <div className="mobile-cards">
            {chiList.map((item) => (
              <div
                key={item.id}
                className={`transaction-card chi ${
                  expandedRow === item.id ? "expanded" : ""
                }`}
                onClick={() => toggleRow(item.id)}
              >
                <div className="card-main">
                  <div className="card-left">
                    <div className="card-content">
                      <span className="card-title">
                        {item.noiDung || "Không có nội dung"}
                      </span>
                      <span className="card-subtitle">
                        <FiCalendar size={12} />
                        {formatDate(item.ngay)} &bull;{" "}
                        {formatStageName(item.doiTuongThuChi)}
                      </span>
                    </div>
                  </div>
                  <div className="card-amount chi">
                    -{formatCurrency(item.soTien)}
                  </div>
                </div>

                {expandedRow === item.id && (
                  <div className="card-details">
                    {item.hinhAnh && (
                      <div className="detail-item" style={{ alignItems: 'flex-start' }}>
                        <FiImage size={14} style={{ marginTop: '4px' }} />
                        <span className="detail-label" style={{ marginTop: '2px' }}>Chứng từ:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <a href={item.hinhAnh} target="_blank" rel="noreferrer" className="detail-link">Xem link gốc</a>
                          <img 
                            src={item.hinhAnh} 
                            alt="Chứng từ" 
                            style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                            onError={(e) => {e.target.onerror = null; e.target.src = "https://via.placeholder.com/100?text=Error"}}
                          />
                        </div>
                      </div>
                    )}
                    <div className="detail-item">
                      <FiUser size={14} />
                      <span className="detail-label">Người cập nhật:</span>
                      <span className="detail-value">{item.nguoiCapNhat || "-"}</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                      >
                        <FiEdit2 /> Sửa
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                      >
                        <FiTrash2 /> Xóa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <FiChevronLeft />
          </button>

          <div className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`page-num ${
                    pageNum === currentPage ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <FiChevronRight />
          </button>

          <span className="page-info">
            {startIndex + 1}-{Math.min(endIndex, data.length)} / {data.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default DataTable;
