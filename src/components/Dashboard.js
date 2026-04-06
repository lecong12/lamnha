import React from "react";
import { FiTrendingDown, FiActivity, FiCalendar, FiFileText, FiCamera, FiAlertCircle } from "react-icons/fi";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import "./Dashboard.css";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
};

const safeNumber = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

function Dashboard({ stats, data, extraData, isDarkMode }) {
  // Lấy dữ liệu đã được fetch và xử lý từ component cha (App.js)
  const stages = extraData.tienDo || [];
  const budget = extraData.nganSach || [];
  const contracts = extraData.contracts || [];
  const drawings = extraData.drawings || [];

  // Định nghĩa màu sắc theo chế độ sáng/tối
  const textColor = isDarkMode ? "#f3f4f6" : "#1f2937";
  const axisColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDarkMode ? "#1f2937" : "#ffffff";

  // 1. Tính toán hạng mục hiện tại (Sử dụng slice để tránh mutate mảng gốc)
  const currentStage = stages.slice().reverse().find(s => {
    const status = s.status?.toLowerCase().trim() || "";
    return status === 'đang thi công' || status === 'thi công' || status === 'đang thực hiện';
  }) || stages.slice().reverse().find(s => s.status?.toLowerCase().trim() === 'hoàn thành') || stages[0];

  // 2. Tính toán ngày thi công (từ ngày bắt đầu mục đầu tiên)
  const startDates = stages.map(s => s.ngayBatDau).filter(Boolean);
  const firstDate = startDates.length > 0 ? new Date(Math.min(...startDates.map(d => d.getTime()))) : null;
  const daysElapsed = firstDate ? Math.floor((new Date() - firstDate) / (1000 * 60 * 60 * 24)) + 1 : 0;

  // 3. Tính toán Ngân sách
  const totalPlanned = budget.reduce((sum, item) => sum + safeNumber(item.duKien), 0);
  const budgetAlert = stats.tongChi > totalPlanned && totalPlanned > 0;

  // 4. Tính toán số lượng Hồ sơ & Bản vẽ (Chỉ đếm các mục có dữ liệu thực tế)
  const totalContracts = contracts.length;
  const totalDrawings = drawings.length;
  const totalFiles = totalContracts + totalDrawings;

  // 5. Lấy 6 ảnh nghiệm thu mới nhất từ tất cả các giai đoạn
  const latestPhotos = stages
    .filter(s => Array.isArray(s.anhNghiemThu) && s.anhNghiemThu.length > 0)
    .sort((a, b) => (b.appSheetId || 0) - (a.appSheetId || 0))
    .flatMap(s => s.anhNghiemThu.map(url => ({ url, stageName: s.name })))
    .slice(0, 6);

  const completedStagesCount = stages.filter(s => s.status?.toLowerCase().trim() === 'hoàn thành').length;
  const completionPercentage = stages.length > 0 ? Math.round((completedStagesCount / stages.length) * 100) : 0;

  // Group data by doiTuongThuChi for pie chart
  const groupByDoiTuong = (data || []).reduce((acc, item) => {
    if (item.loaiThuChi === "Chi" && safeNumber(item.soTien) > 0) {
      const key = item.doiTuongThuChi || "Khác";
      acc[key] = (acc[key] || 0) + safeNumber(item.soTien);
    }
    return acc;
  }, {});

  const pieData = Object.entries(groupByDoiTuong)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Group data by noiDung for bar chart
  const expenseItems = (data || []).reduce((acc, item) => {
    if (item.loaiThuChi === "Chi" && safeNumber(item.soTien) > 0) {
      const key = item.noiDung || "Hạng mục khác";
      acc[key] = (acc[key] || 0) + safeNumber(item.soTien);
    }
    return acc;
  }, {});

  const barData = Object.entries(expenseItems)
    .map(([name, chi]) => ({ name: name.substring(0, 25), chi }))
    .sort((a, b) => b.chi - a.chi)
    .slice(0, 5);

  const COLORS = [
    "#2d8e2b",
    "#16a34a",
    "#22c55e",
    "#4ade80",
    "#86efac",
    "#bbf7d0",
  ];

  const formatShortCurrency = (value) => {
    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(1) + " tỷ";
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + " triệu";
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(0) + "k";
    }
    return value.toString();
  };

  return (
    <div className="dashboard">
      {/* Nhật ký hình ảnh mới nhất - ĐƯA LÊN TRÊN ĐẦU */}
      {latestPhotos.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '25px' }}>
          <h3 className="chart-title"><FiCamera /> Ảnh công trường mới nhất</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
            gap: '12px', 
            marginTop: '15px' 
          }}>
            {latestPhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <img src={photo.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {photo.stageName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {/* Tiến độ công việc */}
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6', position: 'relative' }}>
          <div className="stat-icon">
            <FiActivity color="#3b82f6" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Đang thực hiện</span>
            <span className="stat-value" style={{ 
              fontSize: '1.1rem', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              display: 'block',
              maxWidth: '100%',
              minHeight: '1.5em',
              minWidth: '0', // Cho phép flex-item co giãn để text-overflow hoạt động
              color: isDarkMode ? "#ffffff" : "inherit"
            }}>
              {currentStage?.name?.toString().replace(/^\d+\.\s*/, "") || "---"}
            </span>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${completionPercentage}%` }}></div>
            </div>
          </div>
          <span className="stat-badge" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.8rem', fontWeight: 'bold' }}>{completionPercentage}%</span>
        </div>

        {/* Thời gian */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', position: 'relative' }}>
          <div className="stat-icon">
            <FiCalendar color="#f59e0b" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Thời gian thi công</span>
            <span className="stat-value" style={{ color: isDarkMode ? "#ffffff" : "inherit" }}>Ngày thứ {daysElapsed}</span>
            <small style={{ color: 'var(--text-muted)' }}>Khởi công: {firstDate?.toLocaleDateString('vi-VN') || "---"}</small>
          </div>
        </div>

        {/* Hồ sơ */}
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6', position: 'relative' }}>
          <div className="stat-icon">
            <FiFileText color="#8b5cf6" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Hồ sơ & Bản vẽ</span>
            <span className="stat-value" style={{ color: isDarkMode ? "#ffffff" : "inherit" }}>{totalFiles || 0} tệp tin</span>
            <small style={{ color: isDarkMode ? "#cbd5e1" : "var(--text-muted)" }}>{totalContracts || 0} Hợp đồng • {totalDrawings || 0} Bản vẽ</small>
          </div>
        </div>

        {/* Tài chính - ĐƯA XUỐNG DƯỚI CÙNG TRONG GRID */}
        <div className="stat-card" style={{ borderLeft: budgetAlert ? '4px solid #ef4444' : '4px solid #16a34a', position: 'relative' }}>
          <div className="stat-icon">
            {budgetAlert ? <FiAlertCircle color="#ef4444" /> : <FiTrendingDown color="#16a34a" />}
          </div>
          <div className="stat-info">
            <span className="stat-label">Tổng Chi Phí</span>
            <span className="stat-value">{formatCurrency(stats.tongChi)}</span>
            {totalPlanned > 0 && <small style={{ color: 'var(--text-muted)' }}>Kế hoạch: {formatCurrency(totalPlanned)}</small>}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Pie Chart - Chi tiêu theo đối tượng */}
        <div className="chart-card">
          <h3 className="chart-title">Chi phí theo Hạng mục</h3>
          {pieData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="none"
                    dataKey="value"
                    label={({ name, percent }) => {
                      // Cắt bỏ phần trong ngoặc và xóa số thứ tự đầu dòng (VD: "1. " -> "")
                      const shortName = name.split("(")[0].trim().replace(/^\d+\.\s*/, "");
                      return `${shortName} ${(percent * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      background: tooltipBg,
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: textColor,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="no-data">Chưa có dữ liệu chi tiêu</div>
          )}
        </div>

        {/* Bar Chart - Thu chi theo nội dung */}
        <div className="chart-card">
          <h3 className="chart-title">Top 5 Hạng mục chi tiêu nhiều nhất</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <XAxis
                  type="number"
                  tickFormatter={formatShortCurrency}
                  tick={{ fill: axisColor, fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: textColor, fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{
                    background: tooltipBg,
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    color: textColor,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                />
                <Bar
                  dataKey="chi"
                  name="Chi"
                  fill="#dc2626"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">Chưa có dữ liệu</div>
          )}
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
