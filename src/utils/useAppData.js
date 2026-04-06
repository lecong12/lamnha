import { useState, useEffect, useCallback } from 'react';
import { fetchStages, updateStageInSheet, parseDate } from "./stagesAPI";
import { fetchTableData, updateRowInSheet, addRowToSheet, fetchFileData } from "./sheetsAPI";

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Lấy tên bảng từ biến môi trường hoặc dùng giá trị mặc định
const TABLE_GIAODICH = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
const TABLE_NGANSACH = process.env.REACT_APP_APPSHEET_TABLE_NGANSACH || "NganSach";
const TABLE_HOPDONG = process.env.REACT_APP_APPSHEET_TABLE_HOPDONG || "HopDong";
const TABLE_BANVE = process.env.REACT_APP_APPSHEET_TABLE_BANVE || "BanVe";

const normalizeKey = (str) => {
    if (!str) return '';
    // Thống nhất danh sách knownKeys với sheetsAPI
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name', 'ghiChu', '_RowNumber', 'category', 'url', 'size', 'ten', 'sdt', 'diaChi', 'mst'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    
    if (s === 'id' || s === 'tt' || s === 'stt' || s === 'ma' || s === 'ma gd' || s.includes('key') || s.startsWith('id')) return 'id';
    if (s.includes('ngay bat dau')) return 'ngayBatDau';
    if (s.includes('ngay ket thuc')) return 'ngayKetThuc';
    if (s.includes('ngay') || s.includes('date') || s.includes('thoi gian')) return 'ngay';
    if (s.includes('noi dung') || s.includes('description')) return 'noiDung';
    if (s.includes('so tien') || s.includes('amount') || s.includes('gia tri')) return 'soTien';
    if (s.includes('loai thu chi') || s.includes('loai') || s.includes('type')) return 'loaiThuChi';
    if (s.includes('hang muc') || s.includes('doi tuong') || s.includes('muc chi')) return 'doiTuongThuChi';
    if (s.includes('phan loai') || s.includes('category')) return 'category';
    // Đồng bộ logic với sheetsAPI
    if (s === 'url' || s === 'link' || s === 'file' || s.includes('duong dan') || s.includes('lien ket')) return 'url';
    if (s.includes('hinh anh') || s.includes('minh chung') || s.includes('chung tu') || s.includes('anh')) return 'hinhAnh';
    if (s.includes('nguoi') || s.includes('user')) return 'nguoiCapNhat';
    if (s.includes('ghi chu') || s.includes('note') || s.includes('luu y')) return 'ghiChu';
    if (s.includes('ten') || s.includes('name') || s.includes('giai doan') || s.includes('hop dong') || s.includes('ban ve') || s.includes('noi dung')) return 'name';
    if (s.includes('trang thai') || s.includes('status')) return 'status';
    if (s.includes('dung luong') || s.includes('size')) return 'size';
    // Fallback for single words like 'id', 'ngay'
    return s.replace(/\s+/g, '');
};

export const useAppData = (isLoggedIn) => {
    const [data, setData] = useState([]);
    const [nganSach, setNganSach] = useState([]);
    const [tienDo, setTienDo] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAllData = useCallback(async () => {
        if (!isLoggedIn || !APP_ID || !ACCESS_KEY) return;
        setLoading(true);
        setError(null);

        try {
            // Tải tất cả dữ liệu song song
            const [resGDResult, resNSResult, resTDResult, resHopDongResult, resBanVeResult] = await Promise.all([
                fetchTableData(TABLE_GIAODICH, APP_ID),
                fetchTableData(TABLE_NGANSACH, APP_ID),
                fetchStages(APP_ID), // Dùng API riêng cho Tiến độ để lấy đúng cột
                fetchFileData(TABLE_HOPDONG, APP_ID), // Dùng fetchFileData để làm sạch link
                fetchFileData(TABLE_BANVE, APP_ID),
            ]);

            const resGD = resGDResult.success ? resGDResult.data : [];
            const resNS = resNSResult.success ? resNSResult.data : [];
            const resTD = resTDResult.success ? resTDResult.data : [];

            // 1. Xử lý GiaoDich
            const cleanGD = resGD.map((row, index) => {
                const c = {};
                Object.keys(row).forEach(k => { c[normalizeKey(k)] = row[k]; });
                return {
                    id: row._RowNumber || c.id || `gd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: c.id || row.id || row.ID || row._RowNumber,
                    ngay: parseDate(c.ngay) || new Date(),
                    loaiThuChi: c.loaiThuChi || "Chi",
                    noiDung: c.noiDung || "",
                    doiTuongThuChi: c.doiTuongThuChi || "",
                    soTien: Number(String(c.soTien || 0).replace(/\D/g, "")),
                    hinhAnh: c.hinhAnh || "",
                    nguoiCapNhat: c.nguoiCapNhat || "",
                    ghiChu: c.ghiChu || ""
                };
            });
            setData(cleanGD.sort((a, b) => b.ngay - a.ngay));

            // 2. Xử lý Ngân Sách
            const cleanNS = resNS.map((row, index) => {
                const c = {};
                Object.keys(row).forEach(k => { c[normalizeKey(k)] = row[k]; });
                return {
                    id: row._RowNumber || row.id || `ns_${index}`, // Lưu RowNumber để update
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

            // 4. Xử lý Hợp Đồng
            const resHopDong = resHopDongResult.success ? resHopDongResult.data : [];
            const cleanHopDong = resHopDong.map((row, index) => {
                return {
                    id: row._RowNumber || row.id || `hd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: row.id || row.keyId || row._RowNumber,
                    name: row.name || row.ten || row.noiDung || row["Tên hợp đồng"] || row["Tên Hợp đồng"] || `Hợp đồng ${index + 1}`,
                    url: row.url || "",
                    // QUAN TRỌNG: Chuyển Date về String để tránh trắng màn hình React
                    date: parseDate(row.date || row.ngay)?.toLocaleDateString('vi-VN') || row.date || row.ngay || "",
                    size: Number(row.size || 0),
                    category: row.category || row.doiTuongThuChi || "Khác"
                };
            });
            setContracts(cleanHopDong.sort((a, b) => (b.appSheetId || 0) - (a.appSheetId || 0)));

            // 5. Xử lý Bản Vẽ
            const resBanVe = resBanVeResult.success ? resBanVeResult.data : [];
            const cleanBanVe = resBanVe.map((row, index) => {
                return {
                    id: row._RowNumber || row.id || `bv_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: row.id || row.keyId || row._RowNumber,
                    name: row.name || row.ten || row.noiDung || row["Tên bản vẽ"] || row["Tên Bản vẽ"] || `Bản vẽ ${index + 1}`,
                    url: row.url || "",
                    date: parseDate(row.date || row.ngay)?.toLocaleDateString('vi-VN') || row.date || row.ngay || "",
                    size: Number(row.size || 0),
                    category: row.category || row.doiTuongThuChi || "Khác"
                };
            });
            setDrawings(cleanBanVe.sort((a, b) => (b.appSheetId || 0) - (a.appSheetId || 0)));

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
        
        // Sử dụng hàm update chuyên biệt cho Tiến Độ để đảm bảo đúng tên cột
        const result = await updateStageInSheet(updatedStage, APP_ID);

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

    /**
     * Xử lý lưu giao dịch (Tự động nhận diện Thêm mới hoặc Cập nhật)
     */
    const handleSaveTransaction = async (transactionData) => {
        setLoading(true);
        try {
            let result;
            // CHỐT: Nếu có appSheetId (_RowNumber) thì chắc chắn là bản ghi cũ -> Edit
            const isExisting = !!transactionData.appSheetId;

            if (isExisting) {
                result = await updateRowInSheet(TABLE_GIAODICH, transactionData, APP_ID);
            } else {
                // Thêm mới: Tạo ID tạm và ép kiểu Chi
                const newPayload = { ...transactionData, id: `GD_${Date.now()}`, loaiThuChi: "Chi" };
                result = await addRowToSheet(TABLE_GIAODICH, newPayload, APP_ID);
            }

            if (result.success) {
                await fetchAllData(); // Tải lại dữ liệu sau khi lưu
            }
            return result;
        } finally {
            setLoading(false);
        }
    };

    return { data, nganSach, tienDo, contracts, drawings, loading, error, fetchAllData, handleUpdateStage, handleUpdateBudget, handleSaveTransaction };
};