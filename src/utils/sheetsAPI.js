// AppSheet API Configuration
import { toInputString } from './dateUtils';
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;
const TABLE_GIAODICH_ENV = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
// Helper để chuẩn hóa key từ AppSheet về chuẩn code (ngay, noiDung, id...)
const normalizeKey = (str) => {
    if (!str) return '';
    // Nếu key đã thuộc danh sách chuẩn thì giữ nguyên
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name', '_RowNumber', 'category', 'url', 'size', 'ten', 'sdt', 'diaChi', 'mst'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
    
    // Nhận diện linh hoạt dựa trên từ khóa phổ biến
    if (s === 'id' || s === 'tt' || s === 'stt' || s === 'ma' || s === 'ma gd' || s === 'key' || s.startsWith('id')) return 'id';
    if (s.includes('ngay bat dau')) return 'ngayBatDau';
    if (s.includes('ngay ket thuc')) return 'ngayKetThuc';
    if (s.includes('ngay') || s.includes('date') || s.includes('thoi gian')) return 'ngay';
    if (s === 'noi dung' || s.includes('description')) return 'noiDung';
    if (s.includes('so tien') || s.includes('amount') || s.includes('gia tri')) return 'soTien';
    if (s.includes('loai thu chi') || s.includes('loai') || s.includes('type')) return 'loaiThuChi';
    if (s.includes('hang muc') || s.includes('doi tuong') || s.includes('muc chi')) return 'doiTuongThuChi';
    if (s.includes('phan loai') || s.includes('category')) return 'category';
    // Chỉ map các từ khóa thực sự là đường dẫn về 'url'
    if (s === 'url' || s === 'link' || s === 'file' || s.includes('duong dan') || s.includes('lien ket')) return 'url';
    if (s.includes('hinh anh') || s.includes('minh chung') || s.includes('chung tu') || s.includes('anh') || s.includes('chung tu')) return 'hinhAnh';
    if (s.includes('nguoi') || s.includes('user')) return 'nguoiCapNhat';
    // Nhận diện tên hạng mục, bản vẽ, hợp đồng
    if (s.includes('ten') || s.includes('name') || s.includes('giai doan') || s.includes('hop dong') || s.includes('ban ve')) return 'name';
    if (s.includes('dung luong') || s.includes('size')) return 'size';
    
    return s.replace(/\s+/g, '');
};

// Biến lưu trữ mapping tên cột thực tế từ AppSheet
const columnMapping = {
  [TABLE_GIAODICH_ENV]: {},
  "GhiChu": {},
  "BanVe": {},
  "HopDong": {}
};

// Helper để lấy tên cột AppSheet thực tế hoặc danh sách fallback
const getAppSheetColumnNames = (tableName, normalizedKey, defaultNames) => {
    const mapping = columnMapping[tableName] || {};
    if (mapping[normalizedKey]) {
        return [mapping[normalizedKey]]; // If mapped, return the exact mapped name in an array
    }
    // If not mapped, return all provided default names as fallbacks
    return Array.isArray(defaultNames) ? defaultNames : [defaultNames];
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
          Locale: "en-US", // Dùng en-US để API trao đổi ngày tháng dạng ISO YYYY-MM-DD
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
        const parsed = JSON.parse(responseText);
        // AppSheet trả về { "Rows": [...] } hoặc [...]
        rawData = Array.isArray(parsed) ? parsed : (parsed.Rows || []);
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
        // Vì normalizeKey đã đưa tất cả link/url/file về 'url', ta chỉ cần lấy row.url
        const rawUrl = row.url || row.hinhAnh || "";
        return {
          ...row,
          url: rawUrl ? getCleanLink(rawUrl) : ""
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
/**
 * Cập nhật dòng linh hoạt cho MỌI bảng
 */
export const updateRowInSheet = async (tableName, payload, appId) => {
  try {
    const targetTable = String(tableName).trim().toLowerCase();
    let formattedPayload = {};
    
    if (payload.appSheetId) {
        formattedPayload["_RowNumber"] = payload.appSheetId;
    }

    const finalKey = payload.keyId !== undefined ? payload.keyId : payload.id;
    getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT']).forEach(colName => {
        formattedPayload[colName] = finalKey;
    });

    const formattedDate = toInputString(payload.ngay);
    getAppSheetColumnNames(tableName, 'ngay', ['Ngày', 'ngay']).forEach(colName => {
        formattedPayload[colName] = formattedDate;
    });

    if (targetTable === "ghichu") {
        getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'Ghi chú', 'noiDung']).forEach(colName => {
            formattedPayload[colName] = payload.noiDung;
        });
    } else if (targetTable === "giaodich" || tableName === TABLE_GIAODICH_ENV) {
      // Ưu tiên lấy soTien, nếu không thấy thì thử lấy từ "Số tiền" (phòng hờ)
      const rawAmount = payload.soTien !== undefined ? payload.soTien : (payload["Số tiền"] || 0);
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;
      
      getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'noiDung']).forEach(colName => {
          formattedPayload[colName] = payload.noiDung;
      });
      getAppSheetColumnNames(tableName, 'soTien', ['Số tiền', 'soTien', 'Amount']).forEach(colName => {
          formattedPayload[colName] = cleanAmount;
      });
      getAppSheetColumnNames(tableName, 'doiTuongThuChi', ['Hạng mục', 'doiTuongThuChi', 'Category', 'Phân loại']).forEach(colName => {
          formattedPayload[colName] = payload.doiTuongThuChi;
      });
      getAppSheetColumnNames(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh', 'Chứng từ', 'Minh chứng']).forEach(colName => {
          formattedPayload[colName] = payload.hinhAnh;
      });
      getAppSheetColumnNames(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat', 'User']).forEach(colName => {
          formattedPayload[colName] = payload.nguoiCapNhat;
      });
    } else {
      formattedPayload = { ...formattedPayload, ...payload };
    }

    Object.keys(formattedPayload).forEach(key => 
      (formattedPayload[key] === undefined || formattedPayload[key] === null || key === 'undefined') && delete formattedPayload[key]
    );

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
          Locale: "en-US", 
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
    const targetTable = String(tableName).trim().toLowerCase();
    let formattedPayload = {};

    const finalKey = payload.id !== undefined ? payload.id : payload.keyId;
    getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT']).forEach(colName => {
        formattedPayload[colName] = finalKey;
    });

    const formattedDate = toInputString(payload.ngay);
    getAppSheetColumnNames(tableName, 'ngay', ['Ngày', 'ngay']).forEach(colName => {
        formattedPayload[colName] = formattedDate;
    });

    if (targetTable === "ghichu") {
        getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'Ghi chú', 'noiDung']).forEach(colName => {
            formattedPayload[colName] = payload.noiDung;
        });
    } else if (targetTable === "giaodich" || tableName === TABLE_GIAODICH_ENV) {
      const rawAmount = payload.soTien !== undefined ? payload.soTien : (payload["Số tiền"] || 0);
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;

      getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'noiDung']).forEach(colName => {
          formattedPayload[colName] = payload.noiDung;
      });
      getAppSheetColumnNames(tableName, 'soTien', ['Số tiền', 'soTien', 'Amount']).forEach(colName => {
          formattedPayload[colName] = cleanAmount;
      });
      getAppSheetColumnNames(tableName, 'doiTuongThuChi', ['Hạng mục', 'doiTuongThuChi', 'Category', 'Phân loại']).forEach(colName => {
          formattedPayload[colName] = payload.doiTuongThuChi;
      });
      getAppSheetColumnNames(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh', 'Chứng từ', 'Minh chứng']).forEach(colName => {
          formattedPayload[colName] = payload.hinhAnh;
      });
      getAppSheetColumnNames(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat', 'User']).forEach(colName => {
          formattedPayload[colName] = payload.nguoiCapNhat;
      });
    } else {
      formattedPayload = { ...formattedPayload, ...payload };
    }

    console.log(`[sheetsAPI] Payload gửi lên ${tableName}:`, formattedPayload);

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
          Locale: "en-US",
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
        console.warn("Không thể parse JSON phản hồi thêm mới:", e);
      }
    }
    
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
    const keyCol = mapping['id'] || getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT'])[0]; // Lấy tên cột Key (ID/id/TT/STT...)

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
