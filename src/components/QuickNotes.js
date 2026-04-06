import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiExternalLink, FiFileText, FiLoader } from 'react-icons/fi';
import { fetchTableData, addRowToSheet, deleteRowFromSheet } from '../utils/sheetsAPI';
import { parseDate } from '../utils/stagesAPI';
import './QuickNotes.css';

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function QuickNotes({ showToast }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Đưa hàm loadNotes ra ngoài để có thể gọi lại từ nhiều nơi
  const loadNotes = async () => {
    setLoading(true);
    try {
      // Giả định bảng tên là "GhiChu" trong AppSheet
      const res = await fetchTableData("GhiChu", APP_ID);
      if (res.success) {
        // Chuẩn hóa dữ liệu đầu vào: Map các tên cột Tiếng Việt/AppSheet sang tên biến code
        const mappedNotes = (res.data || []).map(item => ({
          id: item.id || item.ID || item.Id || item._RowNumber,
          ngay: item.ngay || item["Ngày"] || item.Ngay || "",
          noiDung: item.noiDung || item["Nội dung"] || item.NoiDung || item["Ghi chú"] || "",
          _RowNumber: item._RowNumber || item.rowNumber || ""
        })).filter(n => n.noiDung); // Lọc bỏ dòng rỗng

        // Sắp xếp: Ưu tiên ngày mới nhất, nếu cùng ngày thì dựa vào ID (timestamp) mới nhất
        const sorted = mappedNotes.sort((a, b) => {
          const dateA = parseDate(a.ngay) || new Date(0);
          const dateB = parseDate(b.ngay) || new Date(0);
          if (dateB - dateA !== 0) {
            return dateB - dateA; // Sắp xếp theo ngày giảm dần
          }
          return String(b.id).localeCompare(String(a.id)); // Nếu cùng ngày, so sánh ID (timestamp)
        });
        setNotes(sorted);
      }
    } catch (e) {
      console.error("Lỗi đọc ghi chú:", e);
    } finally {
      setLoading(false);
    }
  };

  // Tải ghi chú từ AppSheet (Thay thế LocalStorage)
  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNote = async () => {
    if (!newNote.trim()) return;
    
    setAdding(true);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // Tính toán ID mới: Lấy số lớn nhất từ các ID hiện tại và cộng thêm 1
    const numericIds = notes.map(n => {
      const val = String(n.id).replace(/\D/g, "");
      return parseInt(val) || 0;
    });
    const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

    // 1. Cấu trúc dữ liệu gửi lên API (Gửi đa dạng tên cột để đảm bảo trúng đích)
    const apiPayload = {
      id: nextId, ngay: dateStr, noiDung: newNote.trim() };

    try {
        const res = await addRowToSheet("GhiChu", apiPayload, APP_ID);
        if (res.success) {
            setNewNote("");
            if (showToast) showToast("Đã lưu ghi chú", "success");
            // Tải lại dữ liệu thật từ server để đảm bảo đồng bộ 100%
            await loadNotes();
        } else {
            if (showToast) showToast("Lỗi lưu ghi chú: " + res.message, "error");
        }
    } catch (error) {
        if (showToast) showToast("Lỗi kết nối: " + error.message, "error");
    } finally {
        setAdding(false);
    }
  };

  const deleteNote = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa ghi chú này?")) {
        try {
            // Gửi cả ID và _RowNumber (nếu có) để AppSheet nhận diện chính xác dòng cần xóa
            const res = await deleteRowFromSheet("GhiChu", id, APP_ID); 
            
            if (res.success) {
                if (showToast) showToast("Đã xóa ghi chú thành công", "success");
                // Tải lại dữ liệu để đồng bộ
                await loadNotes();
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            console.error(error);
            if (showToast) showToast("Lỗi xóa: " + error.message, "error");
        }
    }
  };

  const openExternalApp = (url) => {
    window.open(url, '_blank');
  };

  // Helper hiển thị ngày
  const displayDate = (dateVal) => {
    if (!dateVal) return "";
    const d = parseDate(dateVal);
    if (!d) return dateVal;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <div className="quick-notes-section">
      <div className="notes-header">
        <h3 className="chart-title">Ghi chú nhanh & Liên kết</h3>
        <div className="external-links">
          <button className="ext-btn keep" onClick={() => openExternalApp('https://keep.google.com/')} title="Mở Google Keep">
             Keep <FiExternalLink />
          </button>
        </div>
      </div>

      <div className="note-input-area">
        <textarea 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Viết ghi chú nhanh (VD: Mua thêm 5 bao xi măng...)"
          rows="3"
          disabled={adding}
        />
        <button className="add-note-btn" onClick={addNote} disabled={!newNote.trim() || adding}>
          {adding ? <FiLoader className="spin" /> : <FiPlus />} Thêm
        </button>
      </div>

      <div className="notes-grid">
        {loading && <div className="loading-text">Đang đồng bộ ghi chú...</div>}
        {!loading && notes.length === 0 && <p className="no-notes"><FiFileText size={40} /><br/>Chưa có ghi chú nào.</p>}
        
        {notes.map(note => (
          <div key={note.id || note._RowNumber} className="note-card">
            <div className="note-content">{note.noiDung}</div>
            <div className="note-footer">
              <span className="note-date">
                  {displayDate(note.ngay)}
              </span>
              <button className="delete-note-btn" onClick={() => deleteNote(note.id || note._RowNumber)}><FiTrash2 /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuickNotes;