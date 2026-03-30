import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiExternalLink, FiFileText, FiLoader } from 'react-icons/fi';
import { fetchTableData, addRowToSheet, deleteRowFromSheet } from '../utils/sheetsAPI';
import './QuickNotes.css';

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;

function QuickNotes({ showToast }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Tải ghi chú từ AppSheet (Thay thế LocalStorage)
  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      try {
        // Giả định bảng tên là "GhiChu" trong AppSheet
        const res = await fetchTableData("GhiChu", APP_ID);
        if (res.success) {
          // Sắp xếp theo ngày mới nhất
          const sorted = (res.data || []).sort((a, b) => new Date(b.ngay) - new Date(a.ngay));
          setNotes(sorted);
        }
      } catch (e) {
        console.error("Lỗi đọc ghi chú:", e);
      } finally {
        setLoading(false);
      }
    };
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNote = async () => {
    if (!newNote.trim()) return;
    
    setAdding(true);
    const now = new Date();
    // Cấu trúc dữ liệu gửi lên Sheet
    const noteData = {
      id: `NOTE_${Date.now()}`,
      ngay: now, // sheetsAPI sẽ tự format thành YYYY-MM-DD
      noiDung: newNote
    };

    try {
        const res = await addRowToSheet("GhiChu", noteData, APP_ID);
        if (res.success) {
            setNotes([noteData, ...notes]);
            setNewNote("");
            if (showToast) showToast("Đã lưu ghi chú", "success");
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
    if (window.confirm("Bạn có chắc muốn xóa ghi chú này?")) {
        try {
            const res = await deleteRowFromSheet("GhiChu", id, APP_ID);
            if (res.success) {
                setNotes(notes.filter(n => n.id !== id));
                if (showToast) showToast("Đã xóa", "success");
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
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? dateVal : d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="quick-notes-section">
      <div className="notes-header">
        <h3 className="chart-title">Ghi chú nhanh & Liên kết</h3>
        <div className="external-links">
          <button className="ext-btn notion" onClick={() => openExternalApp('https://www.notion.so/')} title="Mở Notion">
             Notion <FiExternalLink />
          </button>
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