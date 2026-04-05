import React, { useState, useMemo, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import ProgressTracker from "./components/ProgressTracker";
import BudgetView from "./components/BudgetView";
import GanttChartView from "./components/GanttChartView";
import DesignDrawings from "./components/DesignDrawings";
import ConstructionContracts from "./components/ConstructionContracts";
import QuickNotes from "./components/QuickNotes";
import DataTable from "./components/DataTable";
import MobileFooter from "./components/MobileFooter";
import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import Login from "./components/Login";
import EditModal from "./components/EditModal";
import ConfirmModal from "./components/ConfirmModal"; 
import BusinessScanner from "./components/BusinessScanner"; 
import { useAppData } from "./utils/useAppData"; 
import Toast from "./components/Toast"; 
import { updateRowInSheet, addRowToSheet, deleteRowFromSheet } from "./utils/sheetsAPI";
import Sidebar from "./components/Sidebar"; 
import "./App.css";
import "./DarkMode.css";

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const TABLE_GIAODICH = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null); 
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width > 768) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const { 
    data, nganSach, tienDo, contracts, drawings, loading, fetchAllData, handleUpdateStage, handleUpdateBudget
  } = useAppData(isLoggedIn);

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleGeminiResult = (result, mode) => {
    if (mode === 'BILL') {
      setEditingItem({
        ngay: result.ngay || new Date().toISOString().split("T")[0],
        soTien: result.soTien || 0,
        loaiThuChi: "Chi",
        noiDung: result.noiDung || "",
        doiTuongThuChi: result.ten || "",
        nguoiCapNhat: "Gemini AI Scanner",
        hinhAnh: result.image_url || ""
      });
    } else {
      const info = [result.ten, result.sdt].filter(Boolean).join(" - ");
      showToast(`Đã trích xuất: ${info || "Không tìm thấy thông tin"}`, info ? "success" : "warning");
    }
  };

  const handleAddNew = () => {
    setEditingItem({
      ngay: new Date().toISOString().split("T")[0], 
      soTien: 0, 
      loaiThuChi: "Chi", 
      noiDung: "",
      doiTuongThuChi: "", 
      nguoiCapNhat: "Ba", 
      hinhAnh: ""
    });
  };

  // --- PHẦN SỬA LỖI TRỌNG TÂM: ĐÃ KHỚP TÊN CỘT GOOGLE SHEET ---
  const handleSaveEdit = async (updatedItem) => {
    try {
      // 1. Kiểm tra chế độ Sửa hay Thêm
      const isEdit = !!(updatedItem.id || updatedItem.keyId || updatedItem.appSheetId);
      showToast(isEdit ? "Đang cập nhật..." : "Đang thêm mới...", "info");

      // 2. Chuẩn hóa ID
      const finalId = isEdit 
        ? (updatedItem.id || updatedItem.keyId || updatedItem.appSheetId) 
        : String(Date.now());

      // 3. Chuẩn hóa Số tiền (Xử lý dấu chấm từ Modal nếu có)
      const cleanAmount = parseInt(String(updatedItem.soTien || "0").replace(/\D/g, "")) || 0;

      // 4. Chuẩn hóa Ngày (YYYY-MM-DD)
      let cleanDateStr = "";
      try {
        const d = new Date(updatedItem.ngay);
        cleanDateStr = d.toISOString().split('T')[0];
      } catch (e) {
        cleanDateStr = String(updatedItem.ngay).split('T')[0];
      }

      // 5. PAYLOAD: Phải khớp 100% với tên tiêu đề cột trên Google Sheet
      const payload = {
        "id": String(finalId),
        "Ngày": cleanDateStr,
        "Hạng mục": updatedItem.doiTuongThuChi || "Khác",
        "Nội dung": updatedItem.noiDung?.trim() || "",
        "Số tiền": cleanAmount,
        "Người cập nhật": updatedItem.nguoiCapNhat || "Ba",
        "Chứng từ": updatedItem.hinhAnh || ""
      };

      console.log("Payload gửi đi AppSheet:", payload);

      const result = isEdit 
        ? await updateRowInSheet(TABLE_GIAODICH, payload, APP_ID) 
        : await addRowToSheet(TABLE_GIAODICH, payload, APP_ID);

      if (result && result.success) {
        showToast(isEdit ? "Cập nhật thành công!" : "Thêm mới thành công!", "success");
        setEditingItem(null);
        await fetchAllData(); 
      } else {
        throw new Error(result?.message || "AppSheet từ chối ghi dữ liệu.");
      }
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      showToast(`Lỗi: ${error.message}`, "error");
    }
  };

  const handleTabChange = (tabId) => {
    if (tabId === 'zalo') { window.open("https://zalo.me/g/kphczy388", "_blank"); return; }
    setActiveTab(tabId);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
  };

  const [filters, setFilters] = useState({ loaiThuChi: "", nguoiCapNhat: "", doiTuongThuChi: "", startDate: "", endDate: "", searchText: "" });

  const filterOptions = useMemo(() => ({
    doiTuongThuChi: [...new Set(data.map(i => i.doiTuongThuChi || i["Hạng mục"]).filter(Boolean))],
    nguoiCapNhat: [...new Set(data.map(i => i.nguoiCapNhat || i["Người cập nhật"]).filter(Boolean))],
  }), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Hỗ trợ cả tên biến cũ và tên cột mới từ Sheet
      const hangMuc = item.doiTuongThuChi || item["Hạng mục"];
      const nguoiCap = item.nguoiCapNhat || item["Người cập nhật"];
      const noiDung = item.noiDung || item["Nội dung"];

      if (filters.nguoiCapNhat && nguoiCap !== filters.nguoiCapNhat) return false;
      if (filters.doiTuongThuChi && hangMuc !== filters.doiTuongThuChi) return false;
      if (filters.searchText) {
        const t = filters.searchText.toLowerCase();
        return (noiDung || "").toLowerCase().includes(t) || (hangMuc || "").toLowerCase().includes(t);
      }
      return true;
    });
  }, [data, filters]);

  const renderContent = () => {
    // Thống kê tổng chi từ cột "Số tiền" hoặc "soTien"
    const stats = { 
      tongThu: 0, 
      tongChi: filteredData.reduce((s, i) => s + (Number(i.soTien || i["Số tiền"]) || 0), 0), 
      soGiaoDich: filteredData.length 
    };
    const extraData = { top5: [], chartData: [], nganSach, tienDo };

    switch (activeTab) {
      case 'dashboard': return <Dashboard stats={stats} data={filteredData} extraData={extraData} isDarkMode={isDarkMode} />;
      case 'scanner': return <BusinessScanner showToast={showToast} onScanSuccess={handleGeminiResult} />; 
      case 'list': return (
        <>
          <FilterBar filters={filters} filterOptions={filterOptions} onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({ loaiThuChi: "", nguoiCapNhat: "", doiTuongThuChi: "", startDate: "", endDate: "", searchText: "" })} onAdd={handleAddNew} />
          <DataTable data={filteredData} onEdit={setEditingItem} onDelete={setItemToDelete} />
        </>
      );
      case 'budget': return <BudgetView budget={nganSach} onUpdateBudget={handleUpdateBudget} showToast={showToast} />;
      case 'progress_tracker': return <ProgressTracker stages={tienDo} onUpdateStage={handleUpdateStage} showToast={showToast} isDarkMode={isDarkMode} />;
      case 'gantt_chart': return <GanttChartView stages={tienDo} onUpdateStage={handleUpdateStage} isDarkMode={isDarkMode} />;
      case 'drawings': return <DesignDrawings showToast={showToast} drawings={drawings} loading={loading} fetchAllData={fetchAllData} />;
      case 'contracts': return <ConstructionContracts showToast={showToast} contracts={contracts} loading={loading} fetchAllData={fetchAllData} />;
      case 'notes': return <QuickNotes showToast={showToast} />;
      default: return <Dashboard stats={stats} data={filteredData} extraData={extraData} isDarkMode={isDarkMode} />;
    }
  };

  if (!isLoggedIn) return <Login onLogin={() => { localStorage.setItem("isLoggedIn", "true"); setIsLoggedIn(true); }} />;

  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : ''}`}>
      {isMobile && isSidebarOpen && <div className="sidebar-overlay open" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        onLogout={handleLogout} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
        isMobile={isMobile} 
      />

      <div className="app-main-wrapper" style={{ 
        marginLeft: isMobile ? '0' : (isSidebarOpen ? '280px' : '64px'), 
        transition: 'margin-left 0.3s ease', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <Header 
          onRefresh={fetchAllData} 
          loading={loading} 
          onAdd={handleAddNew} 
          onLogout={handleLogout} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          isDarkMode={isDarkMode} 
        />
        
        <main className="main-content" style={{ flex: 1 }}>
          {loading ? <div className="loading-spinner"></div> : renderContent()}
        </main>

        {isMobile && !isSidebarOpen && <MobileFooter activeTab={activeTab} onTabChange={handleTabChange} />}
      </div>

      {editingItem && (
        <EditModal 
          item={editingItem} 
          onClose={() => setEditingItem(null)} 
          onSave={handleSaveEdit} 
          showToast={showToast} 
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {itemToDelete && (
        <ConfirmModal 
          isOpen={!!itemToDelete} 
          onClose={() => setItemToDelete(null)} 
          onConfirm={async () => {
            const item = data.find(i => i.id === itemToDelete || i.keyId === itemToDelete || i.appSheetId === itemToDelete);
            if (item) {
              const key = item.keyId || item.id || item.appSheetId;
              const result = await deleteRowFromSheet(TABLE_GIAODICH, key, APP_ID);
              if (result.success) { 
                showToast("Đã xóa giao dịch!", "success"); 
                await fetchAllData(); 
              }
            }
            setItemToDelete(null);
          }} 
          title="Xác nhận xóa giao dịch này?" 
        />
      )}
    </div>
  );
}

export default App;