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

// Helper để tối ưu ảnh từ Cloudinary giúp load cực nhanh
export const optimizeCloudinary = (url) => {
    // Theo yêu cầu của người dùng, không thêm các tham số tối ưu hóa vào URL.
    return url; // Trả về URL gốc.
};

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
                // fetchTableData đã normalizeKey nên row.ngay chứa dữ liệu thô
                const rawValue = row.ngay || row["Ngày"] || "";
                if (index < 3) {
                    console.log(`[Debug Date] Dòng ${index + 1} gốc: "${rawValue}"`);
                }
                const d = toSafeDate(rawValue);
                
                return {
                    id: row.id || row.ID || row._RowNumber || `gd_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: row.id || row._RowNumber,
                    ngay: d, 
                    date: toDisplayString(d), 
                    noiDung: row.noiDung || "",
                    doiTuongThuChi: row.doiTuongThuChi || "",
                    soTien: Number(String(row.soTien || 0).replace(/\D/g, "")),
                    hinhAnh: optimizeCloudinary(row.hinhAnh || ""),
                    nguoiCapNhat: row.nguoiCapNhat || ""
                };
            });
            // SẮP XẾP: Ngày mới nhất lên đầu. Nếu cùng ngày, ưu tiên dòng có RowNumber lớn hơn (vừa mới thêm vào sheet)
            setData(cleanGD.sort((a, b) => {
                const t1 = a.ngay instanceof Date ? a.ngay.getTime() : 0;
                const t2 = b.ngay instanceof Date ? b.ngay.getTime() : 0;
                if (t2 !== t1) return t2 - t1;
                
                const r1 = Number(a.appSheetId || 0);
                const r2 = Number(b.appSheetId || 0);
                return r2 - r1;
            }));

            // 2. Xử lý Ngân Sách
            const cleanNS = resNS.map((row, index) => {
                const c = {};
                Object.keys(row).forEach(k => { c[normalizeKey(k)] = row[k]; });
                return {
                    id: row._RowNumber || row.id || `ns_${index}`, // Lưu RowNumber để update
                    keyId: c.hangMuc || c.doiTuongThuChi, // Key là Hạng mục
                    hangMuc: c.hangMuc || c.doiTuongThuChi || "Hạng mục",
                    duKien: Number(String(c.duKien || 0).replace(/[^0-9]/g, "")),
                    thucTe: Number(String(c.thucTe || 0).replace(/[^0-9]/g, "")),
                    conLai: Number(String(c.conLai || 0).replace(/[^-0-9]/g, "")),
                    tinhTrang: c.tinhTrang || ""
                };
            });
            setNganSach(cleanNS);

            // 3. Xử lý Tiến Độ
            // Dữ liệu từ fetchStages đã được chuẩn hóa, chỉ cần gán trực tiếp
            const cleanTD = resTD.map(stage => {
                const dS = toSafeDate(stage.ngayBatDau);
                const dE = toSafeDate(stage.ngayKetThuc);
                return {
                    ...stage,
                    ngayBatDau: dS,
                    ngayKetThuc: dE,
                    displayNgayBatDau: toDisplayString(dS),
                    displayNgayKetThuc: toDisplayString(dE),
                    // Tối ưu toàn bộ danh sách ảnh nghiệm thu trong phần Tiến độ
                    anhNghiemThu: (stage.anhNghiemThu || []).map(img => optimizeCloudinary(img))
                };
            });
            setTienDo(cleanTD);

            // 4. Xử lý Hợp Đồng
            const resHopDong = resHopDongResult.success ? resHopDongResult.data : [];
            const cleanHopDong = resHopDong.map((row, index) => {
                const d = toSafeDate(row.date || row.ngay);
                return {
                    ...row, // Đã chứa name, url từ fetchFileData
                    id: row._RowNumber || row.id || `hd_${index}`,
                    name: row.name || `Hợp đồng ${index + 1}`,
                    date: toDisplayString(d),
                    ngay: d,
                };
            });
            setContracts(cleanHopDong.sort((a, b) => (b.appSheetId || 0) - (a.appSheetId || 0)));

            // 5. Xử lý Bản Vẽ
            const resBanVe = resBanVeResult.success ? resBanVeResult.data : [];
            const cleanBanVe = resBanVe.map((row, index) => {
                const d = toSafeDate(row.date || row.ngay);
                return {
                    ...row,
                    id: row._RowNumber || row.id || `bv_${index}`,
                    appSheetId: row._RowNumber,
                    keyId: row.id || row.keyId || row._RowNumber,
                    name: row.name || `Bản vẽ ${index + 1}`,
                    url: row.url || row.hinhAnh || "",
                    date: toDisplayString(d),
                    ngay: d,
                    size: Number(row.size || 0),
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
                // Thêm mới: Tạo ID tạm dạng Số (timestamp)
                const newPayload = { ...transactionData, id: Date.now() };
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