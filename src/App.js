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
import { useAppData } from "./utils/useAppData"; 
import Toast from "./components/Toast"; 
import { updateRowInSheet, addRowToSheet, deleteRowFromSheet } from "./utils/sheetsAPI";
import Sidebar from "./components/Sidebar"; 
import "./App.css";
import "./DarkMode.css";

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null); 
  const [toast, setToast] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

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
    data, nganSach, tienDo, loading, fetchAllData, handleUpdateStage, handleUpdateBudget
  } = useAppData(isLoggedIn);

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleAddNew = () => {
    setEditingItem({
      ngay: new Date(), soTien: 0, loaiThuChi: "Chi", noiDung: "",
      doiTuongThuChi: "", nguoiCapNhat: "", hinhAnh: ""
    });
  };

  const handleSaveEdit = async (updatedItem) => {
    try {
      // Đơn giản hóa: Gửi trực tiếp object updatedItem, sheetsAPI sẽ tự mapping đúng cột
      const isEdit = !!(updatedItem.id || updatedItem.keyId || updatedItem.appSheetId);
      const result = isEdit 
        ? await updateRowInSheet("GiaoDich", updatedItem, APP_ID) 
        : await addRowToSheet("GiaoDich", updatedItem, APP_ID);

      if (result.success) {
        showToast("Lưu thành công!", "success");
        setEditingItem(null);
        await fetchAllData();
      } else {
        throw new Error(result.message || "Lỗi AppSheet");
      }
    } catch (error) { showToast(error.message, "error"); }
  };

  const handleUniversalUpload = async (id, tableName, columnName, file) => {
    if (!file) return;
    try {
      setUploadingId(id);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST", body: formData
      });
      const fileData = await res.json();
      if (fileData.secure_url) {
        const result = await updateRowInSheet(tableName, { id, [columnName]: fileData.secure_url }, APP_ID);
        if (result.success) { showToast("Thành công!", "success"); await fetchAllData(); }
      }
    } catch (error) { showToast(error.message, "error"); } finally { setUploadingId(null); }
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
    doiTuongThuChi: [...new Set(data.map(i => i.doiTuongThuChi).filter(Boolean))],
    nguoiCapNhat: [...new Set(data.map(i => i.nguoiCapNhat).filter(Boolean))],
  }), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (filters.loaiThuChi && item.loaiThuChi !== filters.loaiThuChi) return false;
      if (filters.nguoiCapNhat && item.nguoiCapNhat !== filters.nguoiCapNhat) return false;
      if (filters.doiTuongThuChi && item.doiTuongThuChi !== filters.doiTuongThuChi) return false;
      if (filters.searchText) {
        const t = filters.searchText.toLowerCase();
        return (item.noiDung || "").toLowerCase().includes(t) || (item.doiTuongThuChi || "").toLowerCase().includes(t);
      }
      return true;
    });
  }, [data, filters]);

  const renderContent = () => {
    const stats = { tongThu: 0, tongChi: filteredData.reduce((s, i) => s + i.soTien, 0), soGiaoDich: filteredData.length };
    const extraData = { top5: [], chartData: [], nganSach, tienDo };

    switch (activeTab) {
      case 'dashboard': return <Dashboard stats={stats} data={filteredData} extraData={extraData} isDarkMode={isDarkMode} />;
      case 'list': return (
        <>
          <FilterBar filters={filters} filterOptions={filterOptions} onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({ loaiThuChi: "", nguoiCapNhat: "", doiTuongThuChi: "", startDate: "", endDate: "", searchText: "" })} onAdd={handleAddNew} />
          <DataTable data={filteredData} onEdit={setEditingItem} onDelete={setItemToDelete} />
        </>
      );
      case 'budget': return <BudgetView budget={nganSach} onUpdateBudget={handleUpdateBudget} showToast={showToast} />;
      case 'progress_tracker': return <ProgressTracker stages={tienDo} onUpdateStage={handleUpdateStage} showToast={showToast} isDarkMode={isDarkMode} />;
      case 'gantt_chart': return <GanttChartView stages={tienDo} onUpdateStage={handleUpdateStage} isDarkMode={isDarkMode} />;
      case 'drawings': return <DesignDrawings showToast={showToast} onUploadPDF={(id, f) => handleUniversalUpload(id, "BanVe", "url", f)} uploadingId={uploadingId} />;
      case 'contracts': return <ConstructionContracts showToast={showToast} onUploadPDF={(id, f) => handleUniversalUpload(id, "HopDong", "url", f)} uploadingId={uploadingId} />;
      case 'notes': return <QuickNotes showToast={showToast} />;
      default: return <Dashboard stats={stats} data={filteredData} extraData={extraData} isDarkMode={isDarkMode} />;
    }
  };

  if (!isLoggedIn) return <Login onLogin={() => { localStorage.setItem("isLoggedIn", "true"); setIsLoggedIn(true); }} />;

  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : ''}`}>
      {isMobile && isSidebarOpen && <div className="sidebar-overlay open" onClick={() => setIsSidebarOpen(false)}></div>}
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} isMobile={isMobile} />
      <div className="app-main-wrapper" style={{ marginLeft: isMobile ? '0' : (isSidebarOpen ? '280px' : '64px'), transition: 'margin-left 0.3s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header onRefresh={fetchAllData} loading={loading} onAdd={handleAddNew} onLogout={handleLogout} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isDarkMode={isDarkMode} />
        <main className="main-content" style={{ flex: 1 }}>{loading ? <div className="loading-spinner"></div> : renderContent()}</main>
        {isMobile && !isSidebarOpen && <MobileFooter activeTab={activeTab} onTabChange={handleTabChange} />}
      </div>
      {editingItem && <EditModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleSaveEdit} showToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {itemToDelete && <ConfirmModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={async () => {
          const item = data.find(i => i.id === itemToDelete);
          if (item) {
            const result = await deleteRowFromSheet("GiaoDich", item.keyId || item.id, APP_ID);
            if (result.success) { showToast("Đã xóa!", "success"); await fetchAllData(); }
          }
          setItemToDelete(null);
      }} title="Xác nhận xóa" />}
    </div>
  );
}

export default App;
