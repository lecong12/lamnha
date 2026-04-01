import React from "react";
import { FiTrendingDown, FiActivity } from "react-icons/fi";
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

  // Định nghĩa màu sắc theo chế độ sáng/tối
  const textColor = isDarkMode ? "#f3f4f6" : "#1f2937";
  const axisColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDarkMode ? "#1f2937" : "#ffffff";

  // Tính toán tiến độ hoàn thành
  const completedStagesCount = stages.filter(s => s.status === 'Hoàn thành').length;
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
      {/* Stats Cards */}
      <div className="stats-grid-simplified">
        <div className="stat-card chi">
          <div className="stat-icon">
            <FiTrendingDown />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tổng Chi Phí</span>
            <span className="stat-value" style={{ color: 'var(--text-primary, inherit)' }}>{formatCurrency(stats.tongChi)}</span>
          </div>
        </div>

        <div className="stat-card giao-dich">
          <div className="stat-icon">
            <FiActivity />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tiến độ hoàn thành</span>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${completionPercentage}%` }}></div>
            </div>
            <span className="stat-value" style={{ color: 'var(--text-primary, inherit)' }}>{completionPercentage}%</span>
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
              <div className="chart-legend">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="legend-item">
                    <span
                      className="legend-color"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></span>
                    <span className="legend-label">{entry.name}</span>
                    <span className="legend-value">
                      {formatShortCurrency(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
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
