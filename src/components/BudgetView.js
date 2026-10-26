import React, { useState } from 'react';
import { FiEdit2, FiSave, FiX, FiLoader } from 'react-icons/fi';
import './Dashboard.css';

const safeNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(safeNumber(value));
};

function BudgetView({ budget = [], onUpdateBudget, showToast }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.duKien);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (item) => {
    const newVal = Number(String(editValue).replace(/\D/g, ""));
    if (newVal === item.duKien) {
      cancelEdit();
      return;
    }
    
    setIsSaving(true);
    const result = await onUpdateBudget(item, newVal);
    setIsSaving(false);
    if (result.success) {
      if(showToast) showToast("Cập nhật ngân sách thành công!", "success");
      cancelEdit();
    } else {
      if(showToast) showToast("Lỗi cập nhật: " + result.message, "error");
    }
  };

  const totalDuKien = budget.reduce((sum, item) => sum + safeNumber(item.duKien), 0);
  const totalThucTe = budget.reduce((sum, item) => sum + safeNumber(item.thucTe), 0);
  const totalConLai = budget.reduce((sum, item) => sum + safeNumber(item.conLai), 0);

  return (
    <div className="budget-section chart-card">
      <h3 className="chart-title budget-table-title">Đối chiếu Ngân sách</h3>
      <div className="budget-table-wrapper">
        <table className="budget-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: '180px' }}>Hạng mục</th>
              <th style={{ textAlign: 'right', width: '150px' }}>Dự kiến</th>
              <th style={{ textAlign: 'right', width: '150px' }}>Thực tế chi</th>
              <th style={{ textAlign: 'right', width: '150px' }}>Còn lại</th>
              <th style={{ textAlign: 'center', width: '180px' }}>Tình trạng</th>
              <th style={{ textAlign: 'center', width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {budget.length > 0 ? (
              budget.map((item) => (
                <tr key={item.id || item.hangMuc}>
                  <td className="item-name" style={{ textAlign: 'left' }}>{item.hangMuc}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === item.id ? (
                      <input 
                        type="text" 
                        value={new Intl.NumberFormat('vi-VN').format(String(editValue).replace(/\D/g, ""))}
                        onChange={(e) => {
                          // Giữ lại input thô để xử lý, hiển thị format
                          const val = e.target.value.replace(/\./g, "");
                          if (!isNaN(val)) setEditValue(val);
                        }}
                        autoFocus
                        style={{ 
                          width: '100%', 
                          padding: '4px 8px', 
                          border: '1px solid #3b82f6', 
                          borderRadius: '4px',
                          textAlign: 'right',
                          outline: 'none',
                          fontWeight: '600'
                        }}
                      />
                    ) : (
                      formatCurrency(safeNumber(item.duKien))
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(safeNumber(item.thucTe))}</td>
                  <td className={safeNumber(item.conLai) < 0 ? 'negative-val' : 'positive-val'} style={{ textAlign: 'right', fontWeight: '600' }}>
                    {formatCurrency(safeNumber(item.conLai))}
                  </td>
                  <td className="status-cell" style={{ textAlign: 'center' }}>
                    <span className={`status-badge ${safeNumber(item.conLai) < 0 ? 'over' : 'ok'}`}>
                      {item.tinhTrang || (safeNumber(item.conLai) < 0 ? 'Vượt định mức' : 'Ổn định')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {editingId === item.id ? (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => saveEdit(item)} 
                          disabled={isSaving}
                          style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: '4px' }}
                          title="Lưu"
                        >
                          {isSaving ? <FiLoader className="spin" /> : <FiSave size={16} />}
                        </button>
                        <button 
                          onClick={cancelEdit} 
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Hủy"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => startEdit(item)} 
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }}
                        title="Sửa ngân sách dự kiến"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Chưa có dữ liệu ngân sách
                </td>
              </tr>
            )}
          </tbody>
          {budget.length > 0 && (
            <tfoot>
              <tr className="budget-total-row">
                <td style={{ textAlign: 'left', fontWeight: '700' }}>TỔNG CỘNG</td>
                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatCurrency(totalDuKien)}</td>
                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatCurrency(totalThucTe)}</td>
                <td 
                  className={totalConLai < 0 ? 'negative-val' : 'positive-val'} 
                  style={{ textAlign: 'right', fontWeight: '700' }}
                >
                  {formatCurrency(totalConLai)}
                </td>
                <td className="status-cell" style={{ textAlign: 'center' }}>
                  <span className={`status-badge ${totalConLai < 0 ? 'over' : 'ok'}`}>
                    {totalConLai < 0 ? 'Vượt định mức' : 'Trong định mức'}
                  </span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default BudgetView;
