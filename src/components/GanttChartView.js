import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseDate } from '../utils/stagesAPI';

const dayDiff = (date1, date2) => {
  if (!date1 || !date2) return 0;
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (!d1 || !d2) return 0;

  // So sánh dựa trên mốc UTC để đảm bảo khoảng cách ngày luôn là số nguyên, không lệch múi giờ
  const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((t2 - t1) / (86400000));
};

const formatDateVN = (date) => {
  if (!date || !(date instanceof Date)) return "";
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const GanttTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{`${data.name}`}</p>
        <p className="tooltip-desc">{`Thời gian: ${data.duration} ngày (${data.dateRange})`}</p>
      </div>
    );
  }
  return null;
};

function GanttChartView({ stages = [], onUpdateStage, isDarkMode }) {
  const [activeBar, setActiveBar] = useState(null);

  const ganttData = useMemo(() => {
    // BƯỚC 1: Sắp xếp theo RowNumber thực tế của Google Sheet
    const sortedStages = [...stages].sort((a, b) => (parseInt(a.appSheetId) || 0) - (parseInt(b.appSheetId) || 0));

    if (sortedStages.length === 0) return [];

    // BƯỚC 2: Tìm ngày bắt đầu thực tế của dự án (Lọc bỏ các ngày rác/null)
    const startTimes = sortedStages
      .map(s => parseDate(s.ngayBatDau)?.getTime())
      .filter(t => t && t > 946684800000); 
    
    // Chuẩn hóa projectStartDate về đúng 00:00:00
    const minTime = startTimes.length > 0 ? Math.min(...startTimes) : Date.now();
    const dMin = new Date(minTime);
    const projectStartDate = new Date(dMin.getFullYear(), dMin.getMonth(), dMin.getDate(), 0, 0, 0);

    // BƯỚC 3: Map TOÀN BỘ 33 hạng mục (Không lọc bỏ)
    return sortedStages.map(stage => {
      const dS = parseDate(stage.ngayBatDau);
      const dE = parseDate(stage.ngayKetThuc);
      
      // Nếu thiếu ngày, đặt duration là 0 để chỉ hiện tên trên trục Y mà không vẽ thanh Bar
      const hasValidDates = dS && dE && !isNaN(dS.getTime()) && !isNaN(dE.getTime());
      const startDay = hasValidDates ? Math.max(0, dayDiff(projectStartDate, dS)) : 0;
      const duration = hasValidDates ? Math.max(0, dayDiff(dS, dE) + 1) : 0;
      
      const displayName = stage.name?.replace(/^\d+\.\s*/, "") || "Không tên";

      let color = "#a8a29e";
      if (stage.status === 'Đang thi công') color = '#3b82f6';
      if (stage.status === 'Hoàn thành') color = '#16a34a';

      const dateRange = hasValidDates ? `${formatDateVN(dS)} - ${formatDateVN(dE)}` : "Chưa nhập ngày";

      return { 
        id: stage.id, 
        displayName, // Dùng để hiển thị nhãn
        dateRange, 
        startDay, 
        duration, 
        color, 
        status: stage.status 
      };
    });
  }, [stages]);

  // Tính chiều cao động: 50px cho mỗi dòng, tối thiểu 450px
  const dynamicHeight = Math.max(450, ganttData.length * 50);

  const handleBarClick = (data) => {
    if (activeBar && activeBar.id === data.id) {
      setActiveBar(null); // Đóng nếu click lại
    } else {
      setActiveBar(data);
    }
  };

  const handleStatusChange = (stageId, newStatus) => {
    if (onUpdateStage) {
      onUpdateStage(stageId, { status: newStatus });
    }
    setActiveBar(null); // Đóng menu sau khi chọn
  };

  return (
    <div className="chart-card">
      <h3 className="chart-title">Biểu đồ tiến độ (Gantt)</h3>
      {ganttData.length > 0 ? (
        <ResponsiveContainer width="100%" height={dynamicHeight}>
          <BarChart data={ganttData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              type="number" 
              domain={[0, 'dataMax + 5']} 
              tickFormatter={(tick) => tick >= 0 ? `Ngày ${tick}` : ''} 
              tick={{ fill: isDarkMode ? 'var(--text-muted)' : '#6b7280', fontSize: 11 }} 
            />
            <YAxis 
              type="category" 
              dataKey="id" 
              width={150} 
              tick={{ fill: isDarkMode ? 'var(--text-main)' : '#374151', fontSize: 12 }} 
              tickFormatter={(id) => ganttData.find(d => d.id === id)?.displayName || ""}
              interval={0} 
            />
            <Tooltip cursor={{fill: 'rgba(239, 246, 255, 0.5)'}} content={<GanttTooltip />} allowEscapeViewBox={{ x: true, y: true }} />
            <Bar dataKey="startDay" stackId="a" fill="transparent" />
            <Bar dataKey="duration" stackId="a" radius={[4, 4, 4, 4]} onClick={handleBarClick}>
              {ganttData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} style={{cursor: 'pointer'}} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="no-data">Chưa có dữ liệu ngày bắt đầu/kết thúc để vẽ biểu đồ.</div>
      )}

      {/* Menu nhỏ để đổi trạng thái */}
      {activeBar && (
        <div className="gantt-status-menu" style={{ position: 'absolute', top: '100px', left: '50%', transform: 'translateX(-50%)', background: isDarkMode ? 'var(--bg-card)' : 'white', padding: '10px', borderRadius: '8px', boxShadow: isDarkMode ? 'var(--shadow)' : '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100 }}>
          <p style={{margin: 0, marginBottom: '10px', fontWeight: 600, fontSize: '14px'}}>{activeBar.name}</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <button onClick={() => handleStatusChange(activeBar.id, 'Chưa bắt đầu')} disabled={activeBar.status === 'Chưa bắt đầu'}>Chưa bắt đầu</button>
            <button onClick={() => handleStatusChange(activeBar.id, 'Đang thi công')} disabled={activeBar.status === 'Đang thi công'}>Đang thi công</button>
            <button onClick={() => handleStatusChange(activeBar.id, 'Hoàn thành')} disabled={activeBar.status === 'Hoàn thành'}>Hoàn thành</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GanttChartView;