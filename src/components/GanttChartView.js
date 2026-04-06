import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const dayDiff = (date1, date2) => {
  if (!date1 || !date2) return 0;
  const d1 = new Date(date1);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
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
    const validStages = stages.filter(s => {
      const d1 = new Date(s.ngayBatDau);
      const d2 = new Date(s.ngayKetThuc);
      return s.ngayBatDau && s.ngayKetThuc && !isNaN(d1.getTime()) && !isNaN(d2.getTime());
    }).sort((a, b) => {
      // Ưu tiên sắp xếp theo thứ tự hạng mục trong Sheet (appSheetId) để đúng quy trình thi công
      return (a.appSheetId || 0) - (b.appSheetId || 0);
    });

    if (validStages.length === 0) return [];

    const projectStartDate = new Date(Math.min(...validStages.map(s => new Date(s.ngayBatDau).getTime())));

    return validStages.map(stage => {
      const dStart = new Date(stage.ngayBatDau);
      const dEnd = new Date(stage.ngayKetThuc);
      
      const startDay = dayDiff(projectStartDate, dStart);
      const duration = dayDiff(dStart, dEnd) + 1;
      const name = stage.name.replace(/^\d+\.\s*/, "");

      let color = "#a8a29e";
      if (stage.status === 'Đang thi công') color = '#3b82f6';
      if (stage.status === 'Hoàn thành') color = '#16a34a';

      const dateRange = `${dStart.toLocaleDateString('vi-VN')} - ${dEnd.toLocaleDateString('vi-VN')}`;

      return { id: stage.id, name, dateRange, startDay, duration, color, status: stage.status };
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
              domain={['dataMin', 'dataMax + 5']} 
              tickFormatter={(tick) => tick >= 0 ? `Ngày ${tick}` : ''} 
              tick={{ fill: isDarkMode ? 'var(--text-muted)' : '#6b7280', fontSize: 11 }} 
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={150} 
              tick={{ fill: isDarkMode ? 'var(--text-main)' : '#374151', fontSize: 12 }} 
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