import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStages, updateStageInSheet } from "./stagesAPI";
import { fetchTableData, updateRowInSheet, addRowToSheet, fetchFileData, normalizeKey } from "./sheetsAPI";
import { toSafeDate, toDisplayString } from "./dateUtils";

const APP_ID = process.env.REACT_APP_APPSHEET_APP_ID;
const ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Lấy tên bảng từ biến môi trường hoặc dùng giá trị mặc định
const TABLE_GIAODICH = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
const TABLE_NGANSACH = process.env.REACT_APP_APPSHEET_TABLE_NGANSACH || "NganSach";
const TABLE_HOPDONG = process.env.REACT_APP_APPSHEET_TABLE_HOPDONG || "HopDong";
const TABLE_BANVE = process.env.REACT_APP_APPSHEET_TABLE_BANVE || "BanVe";

export const useAppData = (isLoggedIn) => {
    const [data, setData] = useState([]);
    const [nganSach, setNganSach] = useState([]);
    const [tienDo, setTienDo] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Dùng Ref để luôn giữ bản mới nhất của tienDo cho các hàm async tránh lỗi stale closure
    const tienDoRef = useRef(tienDo);
    useEffect(() => {
        tienDoRef.current = tienDo;
    }, [tienDo]);

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
                const d = toSafeDate(c.ngay || row["Ngày"]) || new Date();
                return {
                    id: row._RowNumber || c.id || `gd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: c.id || row.id || row.ID || row._RowNumber,
                    ngay: d, // Đối tượng Date để sắp xếp
                    date: toDisplayString(d), // Chuỗi định dạng VN (DD/MM/YYYY) để hiển thị
                    loaiThuChi: c.loaiThuChi || "Chi",
                    noiDung: c.noiDung || "",
                    doiTuongThuChi: c.doiTuongThuChi || "",
                    soTien: Number(String(c.soTien || 0).replace(/\D/g, "")),
                    hinhAnh: c.hinhAnh || "",
                    nguoiCapNhat: c.nguoiCapNhat || ""
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
            const cleanTD = resTD.map(stage => ({
                ...stage,
                displayNgayBatDau: toDisplayString(stage.ngayBatDau),
                displayNgayKetThuc: toDisplayString(stage.ngayKetThuc)
            }));
            setTienDo(cleanTD);

            // 4. Xử lý Hợp Đồng
            const resHopDong = resHopDongResult.success ? resHopDongResult.data : [];
            const cleanHopDong = resHopDong.map((row, index) => {
                return {
                    id: row._RowNumber || row.id || `hd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: row.id || row.keyId || row._RowNumber,
                    name: row.name || row.ten || row.noiDung || row["Tên hợp đồng"] || row["Tên Hợp đồng"] || `Hợp đồng ${index + 1}`,
                    url: row.url || "",
                    // Sử dụng toDisplayString để dứt điểm lỗi ngược ngày tháng
                    date: toDisplayString(row.date || row.ngay),
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
                    // Sử dụng toDisplayString để dứt điểm lỗi ngược ngày tháng
                    date: toDisplayString(row.date || row.ngay),
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

    const handleUpdateStage = useCallback(async (stageId, updates) => {
        const stageToUpdate = tienDoRef.current.find(s => String(s.id) === String(stageId));
        if (!stageToUpdate) return { success: false, message: "Không tìm thấy giai đoạn" };

        // 1. Tính toán danh sách ảnh mới (Gộp link mới hoặc dùng mảng mảng đã xử lý từ UI)
        let nextImages = updates.anhNghiemThu 
            ? [...updates.anhNghiemThu] 
            : [...(stageToUpdate.anhNghiemThu || [])];
        
        if (updates.hinhAnh) {
            const newUrl = String(updates.hinhAnh).trim();
            if (newUrl && !nextImages.includes(newUrl)) {
                nextImages.push(newUrl);
            }
        }

        // Lọc trùng và làm sạch
        nextImages = [...new Set(nextImages)].filter(img => img && String(img).length > 10).slice(0, 6);

        const updatedStage = { ...stageToUpdate, ...updates, anhNghiemThu: nextImages };

        // 2. Cập nhật State ngay lập tức (Optimistic Update)
        setTienDo(prev => prev.map(s => String(s.id) === String(stageId) ? updatedStage : s));
        
        // 3. Gửi lên AppSheet
        const result = await updateStageInSheet(updatedStage, APP_ID);
        if (!result.success) {
            // Hoàn tác nếu lỗi
            setTienDo(prev => prev.map(s => String(s.id) === String(stageId) ? stageToUpdate : s));
        }
        return result;
    }, []);

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