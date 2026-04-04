// AppSheet API Configuration
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;
const TABLE_GIAODICH_ENV = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
// Helper để chuẩn hóa key từ AppSheet về chuẩn code (ngay, noiDung, id...)
const normalizeKey = (str) => {
    if (!str) return '';
    // Nếu key đã là camelCase chuẩn thì giữ nguyên
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name', 'ghiChu', '_RowNumber'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    
    // Sử dụng .includes() thay vì === để bắt được các biến thể như "Hạng mục chi", "Số tiền (VND)"
    if (s === 'id' || s === 'tt' || s === 'stt' || s === 'ma' || s === 'ma gd' || s.includes('key')) return 'id';
    if (s.includes('ngay') || s.includes('date') || s.includes('thoi gian')) return 'ngay';
    if (s.includes('noi dung') || s.includes('description')) return 'noiDung';
    if (s.includes('so tien') || s.includes('amount')) return 'soTien';
    if (s.includes('loai thu chi') || s.includes('loai') || s.includes('type')) return 'loaiThuChi';
    if (s.includes('hang muc') || s.includes('doi tuong') || s.includes('category')) return 'doiTuongThuChi';
    if (s.includes('hinh anh') || s.includes('minh chung') || s.includes('chung tu') || s.includes('anh')) return 'hinhAnh';
    if (s.includes('nguoi cap nhat') || s.includes('nguoi thuc hien') || s.includes('user')) return 'nguoiCapNhat';
    if (s.includes('ghi chu') || s.includes('note')) return 'ghiChu';
    
    return s.replace(/\s+/g, '');
};

// Biến lưu trữ mapping tên cột thực tế từ AppSheet
const columnMapping = {
  [TABLE_GIAODICH_ENV]: {},
  "GhiChu": {},
  "BanVe": {},
  "HopDong": {}
};

// Hàm giải mã và làm sạch link từ AppSheet (Xử lý dứt điểm lỗi link bị bọc JSON hoặc dính Domain Vercel)
const getCleanLink = (rawLink) => {
  if (!rawLink) return "";
  let current = String(rawLink).trim();

  try {
    // 1. Giải mã JSON lồng nhau (AppSheet đôi khi bọc link trong JSON {"Url": "...", "LinkText": "..."})
    while (current.startsWith('{') || current.includes('{"Url"')) {
      const parsed = JSON.parse(current);
      current = (parsed.Url || parsed.LinkText || current).trim();
    }
  } catch (e) {
    // Nếu không parse được JSON, cứ tiếp tục để tìm marker Cloudinary bên dưới
  }

  // 2. Tìm vị trí của link Cloudinary thật (loại bỏ domain Vercel thừa nếu có)
  const cloudinaryMarker = "https://res.cloudinary.com";
  const startIndex = current.indexOf(cloudinaryMarker);
  
  if (startIndex !== -1) {
    let cleanUrl = current.substring(startIndex);
    
    // 3. Sửa lỗi thiếu dấu gạch chéo (https:/ thay vì https://) thường gặp khi parse JSON lỗi
    if (cleanUrl.startsWith("https:/res.cloudinary.com") && !cleanUrl.startsWith("https://res.cloudinary.com")) {
      cleanUrl = cleanUrl.replace("https:/", "https://");
    }

    // 4. Cắt bỏ các ký tự rác ở cuối (như %22, dấu ngoặc, hoặc text dư thừa sau phần mở rộng file)
    const match = cleanUrl.match(/\.(pdf|jpg|jpeg|png|webp)/i);
    if (match) {
      const extensionIndex = cleanUrl.indexOf(match[0]);
      return cleanUrl.substring(0, extensionIndex + match[0].length);
    }
    
    return cleanUrl;
  }
  return current;
};

// Sử dụng endpoint chuẩn của AppSheet, có thể thay đổi tên bảng linh hoạt
const getApiUrl = (appId, tableName) => 
  `https://www.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;

/**
 * Hàm lấy dữ liệu chung cho bất kỳ bảng nào từ AppSheet
 */
export const fetchTableData = async (tableName, appId) => {
  try {
    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Action: "Find",
        Properties: {
          Locale: "en-US", // Dùng en-US khi đọc để ngày tháng có định dạng chuẩn YYYY-MM-DD dễ xử lý
          Timezone: "Asia/Ho_Chi_Minh",
        },
        Rows: [], // Lấy toàn bộ dòng
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${text}`);
    }

    // Đọc text trước để tránh lỗi "Unexpected end of JSON input" nếu body rỗng
    const responseText = await response.text();
    let rawData = [];
    if (responseText && responseText.trim()) {
      try {
        rawData = JSON.parse(responseText);
      } catch (e) {
        console.error("Lỗi parse JSON từ AppSheet:", e);
      }
    }

    // Chuẩn hóa dữ liệu trả về để các thành phần như QuickNotes có thể đọc được ngay, noiDung
    const currentMapping = {};
    const data = (Array.isArray(rawData) ? rawData : []).map(row => {
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        const normKey = normalizeKey(key);
        normalizedRow[normKey] = row[key];
        currentMapping[normKey] = key; // Lưu lại: normalized -> original name
      });
      return normalizedRow;
    });
    
    // Cập nhật mapping cột cho bảng này
    columnMapping[tableName] = currentMapping;

    // AppSheet trả về mảng object hoặc object rỗng nếu lỗi/không có dữ liệu
    return { success: true, data };
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return { success: false, message: error.message };
  }
};

// Helper function to fetch data with specific column mapping for files (Contracts, Drawings)
export const fetchFileData = async (tableName, appId) => {
  try {
    const { success, data, message } = await fetchTableData(tableName, appId);
    if (!success) return { success, data, message };

    return {
      success: true,
      data: data.map(row => {
        const rawUrl = row.url || row.URL || row.Link || row['Link PDF'] || row['File URL'] || row.file || '';
        return {
          ...row,
          url: getCleanLink(rawUrl)
        };
      })
    };
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return { success: false, message: error.message };
  }
};

/**
 * Cập nhật dòng linh hoạt cho MỌI bảng
 */
export const updateRowInSheet = async (tableName, payload, appId) => {
  try {
    // AppSheet cần ID để biết dòng nào cần sửa
    if (!payload.id) {
        throw new Error("Thiếu 'id' để cập nhật dòng.");
    }

    // Lấy tên cột thực tế đã mapping lúc fetch
    const mapping = columnMapping[tableName] || {};
    const getCol = (norm, def) => mapping[norm] || def;

    let formattedPayload = {};
    
    if (tableName === "GhiChu") {
      formattedPayload = {
        "_RowNumber": payload._RowNumber || payload.id,
        [getCol('id', 'ID')]: payload.id,
        [getCol('ngay', 'Ngày')]: payload.ngay instanceof Date ? payload.ngay.toISOString().split('T')[0] : String(payload.ngay || "").split('T')[0],
        [getCol('noiDung', 'Nội dung')]: payload.noiDung
      };
    } else if (tableName === "GiaoDich" || tableName === TABLE_GIAODICH_ENV) {
      const cleanAmount = parseInt(String(payload.soTien || 0).replace(/\D/g, "")) || 0;
      const finalKey = String(payload.keyId || payload.id);
      
      formattedPayload = {
        "_RowNumber": payload.appSheetId || payload._RowNumber || payload.id,
        [getCol('id', 'ID')]: finalKey,
        [getCol('ngay', 'Ngày')]: payload.ngay instanceof Date ? payload.ngay.toISOString().split('T')[0] : String(payload.ngay || "").split('T')[0],
        [getCol('loaiThuChi', 'Loại Thu Chi')]: payload.loaiThuChi,
        [getCol('noiDung', 'Nội dung')]: payload.noiDung,
        [getCol('soTien', 'Số tiền')]: cleanAmount,
        [getCol('doiTuongThuChi', 'Hạng mục')]: payload.doiTuongThuChi,
        [getCol('hinhAnh', 'Hình ảnh')]: payload.hinhAnh,
        [getCol('nguoiCapNhat', 'Người cập nhật')]: payload.nguoiCapNhat,
        [getCol('ghiChu', 'Ghi chú')]: payload.ghiChu
      };
    } else {
      formattedPayload = { ...payload };
    }

    // Xóa các trường rác
    Object.keys(formattedPayload).forEach(key => 
      (formattedPayload[key] === undefined || formattedPayload[key] === null || key === 'undefined') && delete formattedPayload[key]
    );

    // Thêm Timeout để tránh lỗi khi upload ảnh nặng
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 giây

    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Action: "Edit",
        Properties: {
          Locale: "vi-VN", // Dùng vi-VN khi ghi để tương thích số liệu/ngày tháng tiếng Việt
          Timezone: "Asia/Ho_Chi_Minh",
        },
        Rows: [formattedPayload],
      }),
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(responseText || `Lỗi HTTP ${response.status}`);
    }

    let result = null;
    if (responseText && responseText.trim()) {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.warn("Không thể parse JSON phản hồi cập nhật:", e);
      }
    }
    
    // AppSheet trả về Rows rỗng nếu không tìm thấy ID để sửa hoặc có lỗi logic
    if (result && result.Rows && result.Rows.length === 0) {
      throw new Error("AppSheet không tìm thấy dòng để cập nhật. Hãy kiểm tra ID.");
    }

    return { success: true, message: "Cập nhật thành công", data: result };
  } catch (error) {
    console.error(`Error updating ${tableName}:`, error);
    return { success: false, message: error.message };
  }
};

/**
 * Thêm dòng mới linh hoạt
 */
export const addRowToSheet = async (tableName, payload, appId) => {
  try {
    const mapping = columnMapping[tableName] || {};
    const getCol = (norm, def) => mapping[norm] || def;

    let formattedPayload = {};

    if (tableName === "GhiChu") {
      formattedPayload = {
        [getCol('id', 'ID')]: payload.id,
        [getCol('ngay', 'Ngày')]: payload.ngay instanceof Date ? payload.ngay.toISOString().split('T')[0] : String(payload.ngay || "").split('T')[0],
        [getCol('noiDung', 'Nội dung')]: payload.noiDung
      };
    } else if (tableName === "GiaoDich" || tableName === TABLE_GIAODICH_ENV) {
      const cleanAmount = parseInt(String(payload.soTien || 0).replace(/\D/g, "")) || 0;
      const finalKey = String(payload.id || payload.keyId);

      formattedPayload = {
        [getCol('id', 'ID')]: finalKey,
        [getCol('ngay', 'Ngày')]: payload.ngay instanceof Date ? payload.ngay.toISOString().split('T')[0] : String(payload.ngay || "").split('T')[0],
        [getCol('loaiThuChi', 'Loại Thu Chi')]: payload.loaiThuChi,
        [getCol('noiDung', 'Nội dung')]: payload.noiDung,
        [getCol('soTien', 'Số tiền')]: cleanAmount,
        [getCol('doiTuongThuChi', 'Hạng mục')]: payload.doiTuongThuChi,
        [getCol('hinhAnh', 'Hình ảnh')]: payload.hinhAnh,
        [getCol('nguoiCapNhat', 'Người cập nhật')]: payload.nguoiCapNhat,
        [getCol('ghiChu', 'Ghi chú')]: payload.ghiChu
      };
    } else {
      formattedPayload = { ...payload };
    }

    Object.keys(formattedPayload).forEach(key => 
      (formattedPayload[key] === undefined || formattedPayload[key] === null || key === 'undefined') && delete formattedPayload[key]
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Action: "Add",
        Properties: {
          Locale: "vi-VN",
          Timezone: "Asia/Ho_Chi_Minh",
        },
        Rows: [formattedPayload], // Gửi payload đã chuẩn hóa
      }),
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(responseText || `Lỗi HTTP ${response.status}`);
    }

    let result = null;
    if (responseText && responseText.trim()) {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.warn("Không thể parse JSON phản hồi thêm mới:", e);
      }
    }
    
    // Kiểm tra nếu AppSheet báo lỗi trong body (thường nằm trong kết quả trả về)
    if (result && result.Rows && result.Rows.length === 0) {
      throw new Error("AppSheet xác nhận thành công nhưng không có dòng nào được tạo.");
    }

    return { success: true, message: "Thêm mới thành công", data: result };
  } catch (error) {
    console.error(`Error adding to ${tableName}:`, error);
    return { success: false, message: error.message };
  }
};

/**
 * Xóa dòng khỏi bất kỳ bảng nào
 */
export const deleteRowFromSheet = async (tableName, payloadId, appId) => {
  try {
    // Lấy tên cột khóa thực tế từ mapping đã lưu lúc Fetch
    const mapping = columnMapping[tableName] || {};
    const keyCol = mapping['id'] || "ID"; // Tự động lấy tên cột Key (ID/id/TT/STT...)

    const deleteRow = { [keyCol]: String(payloadId) };

    console.log(`Đang thực hiện xóa tại bảng ${tableName}, Cột: ${keyCol}, Giá trị: ${payloadId}`);

    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Action: "Delete",
        Properties: { Locale: "vi-VN" },
        Rows: [deleteRow], 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return { success: true, message: "Xóa thành công" };
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    return { success: false, message: error.message };
  }
};
