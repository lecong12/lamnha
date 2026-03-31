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
          // Chuẩn hóa dữ liệu đầu vào: Map các tên cột Tiếng Việt/AppSheet sang tên biến code
          const mappedNotes = (res.data || []).map(item => ({
            id: item.id || item.ID || item._RowNumber,
            ngay: item.ngay || item["Ngày"] || item.Ngay || "",
            noiDung: item.noiDung || item["Nội dung"] || item.NoiDung || "",
            _RowNumber: item._RowNumber || ""
          })).filter(n => n.noiDung); // Lọc bỏ dòng rỗng

          const sorted = mappedNotes.sort((a, b) => new Date(b.ngay || 0) - new Date(a.ngay || 0));
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
    const dateStr = now.toISOString().split('T')[0];
    const noteId = `NOTE_${Date.now()}`;

    // 1. Cấu trúc dữ liệu gửi lên API (Gửi đa dạng tên cột để đảm bảo trúng đích)
    const apiPayload = {
      "id": noteId, 
      "ngay": dateStr,
      "noiDung": newNote.trim(),
      "Ngày": dateStr,
      "Nội dung": newNote.trim()
    };

    // 2. Cấu trúc dữ liệu để hiển thị ngay trên UI (Dùng tên biến code)
    const uiNote = {
      id: noteId,
      ngay: now,
      noiDung: newNote.trim()
    };

    try {
        const res = await addRowToSheet("GhiChu", apiPayload, APP_ID);
        if (res.success) {
            setNotes(prevNotes => [uiNote, ...prevNotes]);
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
    if (window.confirm("Bạn có chắc chắn muốn xóa ghi chú này?")) {
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