// AppSheet API Configuration
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Helper: Đảm bảo ngày tháng luôn có định dạng YYYY-MM-DD an toàn cho AppSheet API
const formatAppSheetDate = (val) => {
  if (!val) return new Date().toISOString().split('T')[0]; // Mặc định là hôm nay nếu thiếu
  if (val instanceof Date) return val.toISOString().split('T')[0];
  
  const s = String(val).trim();
  if (!s) return new Date().toISOString().split('T')[0];
  
  if (s.includes('T')) return s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
};

// Helper để chuẩn hóa key từ AppSheet về chuẩn code (ngay, noiDung, id...)
const normalizeKey = (key) => {
  const k = key.toLowerCase().trim();
  if (k === 'ngày' || k === 'ngay' || k === 'date') return 'ngay';
  if (k === 'nội dung' || k === 'noi dung' || k === 'description') return 'noiDung';
  if (k === 'id' || k === 'tt' || k === 'stt') return 'id';
  return key;
};

// Hàm giải mã và làm sạch link từ AppSheet (Xử lý dứt điểm lỗi link bị bọc JSON hoặc dính Domain Vercel)
export const getCleanLink = (rawLink) => {
  if (!rawLink) return "";
  let current = String(rawLink).trim();

  try {
    // 1. Giải mã JSON lồng nhau với cơ chế bảo vệ vòng lặp
    let iterations = 0;
    while ((current.startsWith('{') || current.includes('{"Url"')) && iterations < 5) {
      const last = current;
      const parsed = JSON.parse(current);
      current = (parsed.Url || parsed.LinkText || current).trim();
      if (current === last) break; 
      iterations++;
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
    const match = cleanUrl.match(/\.(pdf|jpg|jpeg|png|webp|heic|heif)/i);
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
    const data = (Array.isArray(rawData) ? rawData : []).map(row => {
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        normalizedRow[normalizeKey(key)] = row[key];
      });
      return normalizedRow;
    });

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
    const rowId = payload.keyId || payload.id;
    if (!rowId) {
        throw new Error("Thiếu 'id' để cập nhật dòng.");
    }

    // Khôi phục logic mapping ổn định: Chuyển từ camelCase sang tên cột thực tế của Sheet
    let formattedPayload = { ...payload };
    const dateStr = formatAppSheetDate(payload.ngay);
    const isGiaoDich = tableName.toLowerCase().includes("giaodich") || tableName === process.env.REACT_APP_APPSHEET_TABLE_GIAODICH;
    
    if (tableName === "GhiChu") {
      formattedPayload = {
        "_RowNumber": payload.appSheetId || payload._RowNumber, // Không dùng ID làm RowNumber nếu không phải số
        "ID": payload.id || payload.keyId,
        "Ngày": dateStr,
        "Nội dung": payload.noiDung
      };
    } else if (isGiaoDich) {
      // Đảm bảo số tiền luôn là số nguyên, không được là NaN
      const cleanAmount = parseInt(String(payload.soTien || 0).replace(/\D/g, "")) || 0;

      formattedPayload = {
        "_RowNumber": payload.appSheetId || payload._RowNumber,
        "ID": rowId,
        "Ngày": dateStr,
        "Nội dung": payload.noiDung || "",
        "Số tiền": cleanAmount,
        "Hạng mục": payload.doiTuongThuChi || "",
        "Chứng từ": payload.hinhAnh || "",
        "Người cập nhật": payload.nguoiCapNhat
      };
    }

    // Xóa _RowNumber nếu nó không phải là số hợp lệ (tránh lỗi 400 cho system column)
    if (formattedPayload._RowNumber && isNaN(formattedPayload._RowNumber)) {
      delete formattedPayload._RowNumber;
    }

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
          Locale: "en-US", // Dùng en-US để dứt điểm lỗi định dạng ngày YYYY-MM-DD
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
    // Mapping cho bảng GhiChu để đảm bảo dữ liệu vào đúng cột tiếng Việt
    let formattedPayload = { ...payload };
    const dateStr = formatAppSheetDate(payload.ngay);
    const isGiaoDich = tableName.toLowerCase().includes("giaodich") || tableName === process.env.REACT_APP_APPSHEET_TABLE_GIAODICH;

    if (tableName === "GhiChu") {
      formattedPayload = {
        "ID": payload.id || `GC_${Date.now()}`,
        "Ngày": dateStr,
        "Nội dung": payload.noiDung
      };
    } else if (isGiaoDich) {
      // Đảm bảo số tiền luôn là số nguyên
      const cleanAmount = parseInt(String(payload.soTien || 0).replace(/\D/g, "")) || 0;
      // Tạo ID thuần số để khớp với công thức MAX + 1 và định dạng Number của AppSheet
      const numericId = payload.id || payload.keyId || Date.now();

      formattedPayload = {
        "ID": numericId,
        "Ngày": dateStr,
        "Nội dung": payload.noiDung || "",
        "Số tiền": cleanAmount,
        "Hạng mục": payload.doiTuongThuChi || "",
        "Chứng từ": payload.hinhAnh || "",
        "Người cập nhật": payload.nguoiCapNhat
      };
    }

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
          Locale: "en-US",
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
    // Đảm bảo gửi đúng cột khóa (Key Column) cho từng bảng
    let deleteRow = {};
    if (tableName === "GhiChu") {
      deleteRow = { "ID": payloadId };
    } else if (tableName === "GiaoDich") {
      deleteRow = { "ID": payloadId };
    } else {
      // Mặc định cho các bảng khác, gửi cả ID và id để tăng khả năng tương thích
      deleteRow = { "ID": payloadId, "id": payloadId };
      if (!isNaN(payloadId)) deleteRow["_RowNumber"] = payloadId;
    }

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
