import React from "react";
import { FiTrendingDown, FiActivity, FiCalendar, FiFileText, FiCamera, FiAlertCircle } from "react-icons/fi";
import { toDisplayString } from "../utils/dateUtils";
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
  const stages = extraData.tienDo || [];
  const budget = extraData.nganSach || [];
  const contracts = extraData.contracts || [];
  const drawings = extraData.drawings || [];

  const textColor = isDarkMode ? "#f3f4f6" : "#1f2937";
  const axisColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDarkMode ? "#1f2937" : "#ffffff";

  const currentStage = stages.slice().reverse().find(s => {
    const status = s.status?.toLowerCase().trim() || "";
    return status === 'đang thi công' || status === 'thi công' || status === 'đang thực hiện';
  }) || stages.slice().reverse().find(s => s.status?.toLowerCase().trim() === 'hoàn thành') || stages[0];

  // --- SỬA LỖI TẠI ĐÂY: Chỉ khai báo validStages 1 lần duy nhất ---
  const validStages = stages.filter(s => s.name && s.ngayBatDau);
  const startStage = validStages.find(s => s.name?.toLowerCase().includes("khởi công")) || validStages[0];
  const firstDate = startStage?.ngayBatDau || null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysElapsed = firstDate ? Math.floor((today - firstDate) / (1000 * 60 * 60 * 24)) + 1 : 0;

  const totalPlanned = budget.reduce((sum, item) => sum + safeNumber(item.duKien), 0);
  const budgetAlert = stats.tongChi > totalPlanned && totalPlanned > 0;

  const totalFiles = (contracts.length || 0) + (drawings.length || 0);

  const latestPhotos = stages
    .filter(s => Array.isArray(s.anhNghiemThu) && s.anhNghiemThu.length > 0)
    .sort((a, b) => (b.appSheetId || 0) - (a.appSheetId || 0))
    .flatMap(s => s.anhNghiemThu.map(url => ({ url, stageName: s.name })))
    .slice(0, 6);

  const completedStagesCount = stages.filter(s => s.status?.toLowerCase().trim() === 'hoàn thành').length;
  const completionPercentage = stages.length > 0 ? Math.round((completedStagesCount / stages.length) * 100) : 0;

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

  const COLORS = ["#2d8e2b", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0"];

  const formatShortCurrency = (value) => {
    if (value >= 1000000000) return (value / 1000000000).toFixed(1) + " tỷ";
    if (value >= 1000000) return (value / 1000000).toFixed(1) + " triệu";
    return value >= 1000 ? (value / 1000).toFixed(0) + "k" : value.toString();
  };

  return (
    <div className="dashboard">
      {latestPhotos.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '25px' }}>
          <h3 className="chart-title"><FiCamera /> Ảnh công trường mới nhất</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginTop: '15px' }}>
            {latestPhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <img src={photo.url} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 8px', fontSize: '10px' }}>{photo.stageName}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon"><FiActivity color="#3b82f6" /></div>
          <div className="stat-info">
            <span className="stat-label">Đang thực hiện</span>
            <span className="stat-value">{currentStage?.name?.toString().replace(/^\d+\.\s*/, "") || "---"}</span>
            <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${completionPercentage}%` }}></div></div>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon"><FiCalendar color="#f59e0b" /></div>
          <div className="stat-info">
            <span className="stat-label">Thời gian thi công</span>
            <span className="stat-value">{daysElapsed >= 1 ? `Ngày thứ ${daysElapsed}` : 'Sắp khởi công'}</span>
            <small>Khởi công: {toDisplayString(firstDate)}</small>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-icon"><FiFileText color="#8b5cf6" /></div>
          <div className="stat-info">
            <span className="stat-label">Hồ sơ & Bản vẽ</span>
            <span className="stat-value">{totalFiles || 0} tệp tin</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: budgetAlert ? '4px solid #ef4444' : '4px solid #16a34a' }}>
          <div className="stat-icon">{budgetAlert ? <FiAlertCircle color="#ef4444" /> : <FiTrendingDown color="#16a34a" />}</div>
          <div className="stat-info">
            <span className="stat-label">Tổng Chi Phí</span>
            <span className="stat-value">{formatCurrency(stats.tongChi)}</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Chi phí theo Hạng mục</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name.split("(")[0].trim().substring(0,10)} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="no-data">Chưa có dữ liệu</div>}
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Top 5 chi tiêu</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" tickFormatter={formatShortCurrency} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="chi" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="no-data">Chưa có dữ liệu</div>}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
