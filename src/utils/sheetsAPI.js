// AppSheet API Configuration
import { toInputString } from './dateUtils';
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Helper để chuẩn hóa ID: loại bỏ tiền tố (GC_, GD_) và chuyển thành số nếu có thể
const formatRowId = (id) => {
  if (id === null || id === undefined) return "";
  return String(id); // Giữ nguyên ID dạng chuỗi để bảo toàn prefix và khớp với định dạng Key của AppSheet
};
const TABLE_GIAODICH_ENV = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
// Helper để chuẩn hóa key từ AppSheet về chuẩn code (ngay, noiDung, id...)
export const normalizeKey = (str) => {
    if (!str) return '';
    // Nếu key đã thuộc danh sách chuẩn thì giữ nguyên
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name', '_RowNumber', 'category', 'url', 'size', 'ten', 'sdt', 'diaChi', 'mst'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").trim();
    const sClean = s.replace(/[\s_]+/g, "");
    
    // Nhận diện linh hoạt dựa trên từ khóa phổ biến
    if (['id', 'tt', 'stt', 'ma', 'magd', 'key'].includes(sClean) || sClean.startsWith('id')) return 'id';
    if (s.includes('ngay bat dau')) return 'ngayBatDau';
    if (s.includes('ngay ket thuc')) return 'ngayKetThuc';
    if (s.includes('ngay') || s.includes('date') || s.includes('thoigian')) return 'ngay';
    if (s === 'noi dung' || s.includes('noidung') || s.includes('ghi chu') || s.includes('description')) return 'noiDung';
    if (sClean.includes('sotien') || s.includes('amount') || s.includes('giatri')) return 'soTien';
    if (sClean.includes('loaithuchi') || s.includes('loai') || s.includes('type')) return 'loaiThuChi';
    if (s.includes('hang muc') || s.includes('doi tuong') || s.includes('muc chi') || s.includes('phan loai') || s.includes('category')) return 'doiTuongThuChi';
    // Chỉ map các từ khóa thực sự là đường dẫn về 'url'
    if (s === 'url' || s === 'link' || s === 'file' || s.includes('duong dan') || s.includes('lien ket') || s.includes('ban ve') || s.includes('hop dong')) return 'url';
    if (s.includes('hinh anh') || s.includes('minh chung') || s.includes('chung tu') || s.includes('anh')) return 'hinhAnh';
    if (s.includes('nguoi') || s.includes('user')) return 'nguoiCapNhat';
    
    return s.replace(/\s+/g, '');
};

// Biến lưu trữ mapping tên cột thực tế từ AppSheet
const columnMapping = {
  "GhiChu": {},
  "GiaoDich": {}
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
          Locale: "vi-VN", // Thống nhất dùng vi-VN để đồng bộ với định dạng Google Sheet (DD/MM/YYYY)
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

    // Log để kiểm tra mapping thực tế từ AppSheet
    if (data.length > 0) {
      console.log(`[Mapping] Bảng ${tableName}:`, currentMapping);
    }

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
export const updateRowInSheet = async (tableName, payload, appId) => {
  try {
    const rawTable = String(tableName).trim();
    const targetTable = rawTable.toLowerCase().replace(/\s+/g, "");
    let formattedPayload = {};
    
    // 1. Đồng bộ Key dứt điểm (Bắt buộc để Edit)
    const finalKey = formatRowId(payload.keyId || payload.id || payload._RowNumber);
    const idCols = getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT', 'Mã GD', 'Mã']);
    idCols.forEach(col => { formattedPayload[col] = finalKey; });

    if (payload.appSheetId || payload._RowNumber) {
        formattedPayload["_RowNumber"] = payload.appSheetId || payload._RowNumber;
    }

    // 2. Map Ngày
    const formattedDate = toInputString(payload.ngay);
    if (formattedDate) {
      getAppSheetColumnNames(tableName, 'ngay', ['Ngày', 'ngay', 'Date']).forEach(col => {
        formattedPayload[col] = formattedDate;
      });
    }

    // 3. Map Nội dung & Số tiền
    const noiDungVal = payload.noiDung || "";
    getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'noiDung', 'Ghi chú']).forEach(col => {
      formattedPayload[col] = noiDungVal;
    });

    if (targetTable === "giaodich" || rawTable === TABLE_GIAODICH_ENV) {
      const rawAmount = payload.soTien !== undefined ? payload.soTien : 0;
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;
      
      getAppSheetColumnNames(tableName, 'soTien', ['Số tiền', 'soTien', 'Amount']).forEach(col => {
        formattedPayload[col] = cleanAmount;
      });
      
      const catVal = payload.doiTuongThuChi || payload.hangMuc || "";
      getAppSheetColumnNames(tableName, 'doiTuongThuChi', ['Hạng mục', 'doiTuongThuChi', 'Category', 'Phân loại']).forEach(col => {
        formattedPayload[col] = catVal;
      });
      
      getAppSheetColumnNames(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh', 'Chứng từ']).forEach(col => {
        formattedPayload[col] = payload.hinhAnh || "";
      });

      getAppSheetColumnNames(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat', 'User']).forEach(col => {
        formattedPayload[col] = payload.nguoiCapNhat || "Ba";
      });

      getAppSheetColumnNames(tableName, 'loaiThuChi', ['Loại Thu/Chi', 'loaiThuChi', 'Type']).forEach(col => {
        formattedPayload[col] = payload.loaiThuChi || "Chi";
      });
    }

    // Giữ lại các cột khác từ payload nếu chúng không trùng với các key logic đã xử lý
    Object.keys(payload).forEach(key => {
      const normKey = normalizeKey(key);
      const reserved = ['id', 'keyId', 'ngay', 'noiDung', 'soTien', 'doiTuongThuChi', 'hinhAnh', 'nguoiCapNhat', 'appSheetId'];
      if (!reserved.includes(normKey) && formattedPayload[key] === undefined) {
        formattedPayload[key] = payload[key];
      }
    });

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
          Locale: "vi-VN",
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
    const rawTable = String(tableName).trim();
    const targetTable = rawTable.toLowerCase().replace(/\s+/g, "");
    let formattedPayload = {};
    
    // 1. Map ID/Key (Dùng fallback rộng để trúng Key Column)
    const finalKey = formatRowId(payload.id || payload.keyId || `GC_${Date.now()}`);
    const idCols = getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT', 'Mã GD', 'Mã']);
    idCols.forEach(col => { formattedPayload[col] = finalKey; });
    
    // 2. Map Ngày
    const formattedDate = toInputString(payload.ngay || new Date());
    getAppSheetColumnNames(tableName, 'ngay', ['Ngày', 'ngay', 'Date']).forEach(col => {
      formattedPayload[col] = formattedDate;
    });

    // 3. Map Nội dung & Dữ liệu đặc thù
    const noiDungVal = payload.noiDung || "";
    getAppSheetColumnNames(tableName, 'noiDung', ['Nội dung', 'noiDung', 'Ghi chú']).forEach(col => {
      formattedPayload[col] = noiDungVal;
    });

    if (targetTable === "giaodich" || rawTable === TABLE_GIAODICH_ENV) {
      const rawAmount = payload.soTien !== undefined ? payload.soTien : 0;
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;
      
      getAppSheetColumnNames(tableName, 'soTien', ['Số tiền', 'soTien', 'Amount']).forEach(col => {
        formattedPayload[col] = cleanAmount;
      });

      const catVal = payload.doiTuongThuChi || payload.hangMuc || "";
      getAppSheetColumnNames(tableName, 'doiTuongThuChi', ['Hạng mục', 'doiTuongThuChi', 'Category', 'Phân loại']).forEach(col => {
        formattedPayload[col] = catVal;
      });

      getAppSheetColumnNames(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh', 'Chứng từ']).forEach(col => {
        formattedPayload[col] = payload.hinhAnh || "";
      });

      getAppSheetColumnNames(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat', 'User']).forEach(col => {
        formattedPayload[col] = payload.nguoiCapNhat || "Ba";
      });

      getAppSheetColumnNames(tableName, 'loaiThuChi', ['Loại Thu/Chi', 'loaiThuChi']).forEach(col => {
        formattedPayload[col] = payload.loaiThuChi || "Chi";
      });
    }
    
    // 4. Merge các trường khác
    Object.keys(payload).forEach(key => {
      const normKey = normalizeKey(key);
      const reserved = ['id', 'keyId', 'ngay', 'noiDung', 'soTien', 'doiTuongThuChi', 'hinhAnh', 'loaiThuChi'];
      if (!reserved.includes(normKey) && formattedPayload[key] === undefined) {
        formattedPayload[key] = payload[key];
      }
    });

    // Làm sạch dữ liệu rác
    Object.keys(formattedPayload).forEach(key => {
      if (formattedPayload[key] === undefined || formattedPayload[key] === null || key === 'undefined') {
        delete formattedPayload[key];
      }
    });

    // Log để debug khi cần
    console.log(`Đang gửi Action:Add tới bảng ${tableName}:`, formattedPayload);

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
    
    // Chỉ báo thành công nếu AppSheet trả về ít nhất một dòng đã được thêm
    if (!result || !result.Rows || result.Rows.length === 0) {
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
    const keyCol = mapping['id'] || getAppSheetColumnNames(tableName, 'id', ['ID', 'id', 'TT', 'STT', 'Mã', 'Ma'])[0]; // Lấy tên cột Key (ID/id/TT/STT...)

    const deleteRow = { [keyCol]: formatRowId(payloadId) };

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
