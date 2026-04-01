import { useState, useEffect, useCallback } from 'react';
import { fetchStages } from "./stagesAPI";
import { fetchTableData, updateRowInSheet } from "./sheetsAPI";

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Lấy tên bảng từ biến môi trường hoặc dùng giá trị mặc định
const TABLE_GIAODICH = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
const TABLE_NGANSACH = process.env.REACT_APP_APPSHEET_TABLE_NGANSACH || "NganSach";

const normalizeKey = (str) => {
    if (!str) return '';
    // Nếu key đã đúng chuẩn camelCase từ sheetsAPI rồi thì giữ nguyên
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    
    if (s.includes("row number")) return "rowNumber";
    if (s.includes("rownumber")) return "rowNumber"; // Bắt trường hợp _RowNumber từ AppSheet
    if (s.includes("ngay bat dau")) return "ngayBatDau";
    if (s.includes("ngay ket thuc")) return "ngayKetThuc";
    if (s.includes("anh nghiem thu")) return "anhNghiemThu";
    if (s.includes("ten cong viec") || s.includes("giai doan")) return "name";
    if (s.includes("trang thai")) return "status";
    if (s.includes("hang muc")) return "doiTuongThuChi"; // Map đúng về biến doiTuongThuChi
    if (s.includes("du kien")) return "duKien";
    if (s.includes("thuc te")) return "thucTe";
    if (s.includes("con lai")) return "conLai";
    if (s.includes("tinh trang")) return "tinhTrang";
    if (s.includes("loai thu chi")) return "loaiThuChi";
    if (s.includes("doi tuong thu chi")) return "doiTuongThuChi";
    if (s.includes("so tien")) return "soTien";
    if (s.includes("noi dung")) return "noiDung";
    if (s.includes("hinh anh") || s.includes("minh chung") || s.includes("chung tu")) return "hinhAnh";
    if (s.includes("nguoi cap nhat") || s.includes("nguoi thuc hien")) return "nguoiCapNhat";
    // Fallback for single words like 'id', 'ngay'
    return s.replace(/\s+/g, '');
};

export const useAppData = (isLoggedIn) => {
    const [data, setData] = useState([]);
    const [nganSach, setNganSach] = useState([]);
    const [tienDo, setTienDo] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAllData = useCallback(async () => {
        if (!isLoggedIn || !APP_ID || !ACCESS_KEY) return;
        setLoading(true);
        setError(null);

        try {
            // Tải dữ liệu song song
            const [resGDResult, resNSResult, resTDResult] = await Promise.all([
                fetchTableData(TABLE_GIAODICH, APP_ID, ACCESS_KEY),
                fetchTableData(TABLE_NGANSACH, APP_ID, ACCESS_KEY),
                fetchStages(APP_ID) // Dùng API riêng cho Tiến độ để lấy đúng cột
            ]);

            const resGD = resGDResult.success ? resGDResult.data : [];
            const resNS = resNSResult.success ? resNSResult.data : [];
            const resTD = resTDResult.success ? resTDResult.data : [];

            // 1. Xử lý GiaoDich
            const cleanGD = resGD.map((row, index) => {
                const c = {};
                Object.keys(row).forEach(k => { c[normalizeKey(k)] = row[k]; });
                return {
                    id: row._RowNumber || `gd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: c.id || row.id || row.ID, // Đảm bảo lấy được key ID
                    ngay: c.ngay ? new Date(c.ngay) : new Date(),
                    soTien: Number(String(c.soTien || 0).replace(/\D/g, "")),
                    loaiThuChi: c.loaiThuChi || "Chi",
                    noiDung: c.noiDung || "",
                    doiTuongThuChi: c.doiTuongThuChi || "Khác",
                    hinhAnh: c.hinhAnh || "",
                    nguoiCapNhat: c.nguoiCapNhat || "",
                };
            });
            setData(cleanGD.sort((a, b) => b.ngay - a.ngay));

            // 2. Xử lý Ngân Sách
            const cleanNS = resNS.map(row => {
                const c = {};
                Object.keys(row).forEach(k => { c[normalizeKey(k)] = row[k]; });
                return {
                    id: row._RowNumber, // Lưu RowNumber để update
                    keyId: c.hangMuc || c.doiTuongThuChi, // Key là Hạng mục
                    hangMuc: c.hangMuc || c.doiTuongThuChi || "Hạng mục",
                    duKien: Number(String(c.duKien || 0).replace(/\D/g, "")),
                    thucTe: Number(String(c.thucTe || 0).replace(/\D/g, "")),
                    conLai: c.conLai,
                    tinhTrang: c.tinhTrang || ""
                };
            });
            setNganSach(cleanNS);

            // 3. Xử lý Tiến Độ
            // Dữ liệu từ fetchStages đã được chuẩn hóa, chỉ cần gán trực tiếp
            setTienDo(resTD);

        } catch (err) {
            setError("Lỗi nạp dữ liệu. Hãy kiểm tra tên bảng và App ID.");
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleUpdateStage = async (stageId, updates) => {
        const originalTienDo = [...tienDo];
        const stageToUpdate = tienDo.find(s => s.id === stageId);
        if (!stageToUpdate) return { success: false, message: "Không tìm thấy giai đoạn" };

        const updatedStage = { ...stageToUpdate, ...updates };
        const newTienDo = tienDo.map((s) => s.id === stageId ? updatedStage : s);
        setTienDo(newTienDo);
        
        // Chuẩn bị payload gửi lên AppSheet
        const payload = {
            id: stageToUpdate.keyId, // Sử dụng keyId để xác định dòng cần sửa
            ...updates // Gửi trực tiếp các trường cần cập nhật
        };

        // Gọi API updateRowInSheet mới (Dynamic)
        // Sử dụng TABLE_TIENDO (mặc định "TienDo")
        const result = await updateRowInSheet("TienDo", payload, APP_ID);

        if (!result.success) {
            setTienDo(originalTienDo); // Revert on failure
        }
        return result;
    };

    const handleUpdateBudget = async (item, newDuKien) => {
        const originalNganSach = [...nganSach];
        const updatedItem = { ...item, duKien: newDuKien, conLai: newDuKien - item.thucTe };
        
        // Optimistic Update: Cập nhật giao diện ngay
        setNganSach(prev => prev.map(i => i.id === item.id ? updatedItem : i));

        const payload = {
            id: item.keyId, // Assuming 'Hạng mục' is the key column in AppSheet for NganSach
            "Hạng mục": item.keyId, // Also send the actual column name
            "Dự kiến (VNĐ)": newDuKien // Ensure this matches the column name in AppSheet
        };

        const result = await updateRowInSheet(TABLE_NGANSACH, payload, APP_ID);

        if (!result.success) {
            setNganSach(originalNganSach); // Revert nếu lỗi
        }
        return result;
    };

    return { data, setData, nganSach, tienDo, loading, error, fetchAllData, handleUpdateStage, handleUpdateBudget };
};