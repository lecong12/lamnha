// AppSheet API Configuration
import { toSafeDate, toInputString } from './dateUtils';

const TABLE_BANVE = process.env.REACT_APP_APPSHEET_TABLE_BANVE || "BanVe";
const TABLE_HOPDONG = process.env.REACT_APP_APPSHEET_TABLE_HOPDONG || "HopDong";
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;

// Helper để chuẩn hóa ID: loại bỏ tiền tố (GC_, GD_) và chuyển thành số nếu có thể
const formatRowId = (id) => {
  if (id === null || id === undefined) return "";
  return String(id); // Giữ nguyên ID dạng chuỗi để bảo toàn prefix và khớp với định dạng Key của AppSheet
};

// Helper để so sánh tên bảng không dấu, không khoảng trắng
const normalizeTableName = (str) => {
  if (!str) return "";
  return String(str).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[\s_]+/g, "");
};

const TABLE_GIAODICH_ENV = process.env.REACT_APP_APPSHEET_TABLE_GIAODICH || "GiaoDich";
// Helper để chuẩn hóa key từ AppSheet về chuẩn code (ngay, noiDung, id...)
export const normalizeKey = (str) => {
    if (!str) return '';
    // Nếu key đã thuộc danh sách chuẩn thì giữ nguyên
    const knownKeys = ['hinhAnh', 'nguoiCapNhat', 'doiTuongThuChi', 'soTien', 'noiDung', 'ngay', 'loaiThuChi', 'keyId', 'appSheetId', 'id', 'anhNghiemThu', 'ngayBatDau', 'ngayKetThuc', 'status', 'name', '_RowNumber', 'category', 'url', 'size', 'ten', 'sdt', 'diaChi', 'mst', 'duKien', 'thucTe', 'conLai', 'tinhTrang'];
    if (knownKeys.includes(str)) return str;

    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").trim();
    const sClean = s.replace(/[\s_]+/g, "");
    
    // Nhận diện linh hoạt dựa trên từ khóa phổ biến
    if (['id', 'tt', 'stt', 'ma', 'magd', 'key'].includes(sClean)) return 'id';
    if (sClean === 'ngay' || sClean === 'date' || sClean === 'ngaythang') return 'ngay';
    
    // Ưu tiên nhận diện Tên/Nội dung trước để tránh trùng lặp với URL
    if (sClean === 'ten' || sClean === 'name' || sClean === 'tieude' || (sClean.includes('ten') && !sClean.includes('file'))) return 'name';
    if (sClean === 'noidung' || sClean === 'ghichu' || sClean === 'description') return 'noiDung';

    if (sClean.includes('batdau') || sClean.includes('start')) return 'ngayBatDau';
    if (sClean.includes('ketthuc') || sClean.includes('end')) return 'ngayKetThuc';
    
    if (sClean === 'dukien' || sClean === 'kehoach' || sClean === 'dutoan') return 'duKien';
    if (sClean === 'thucte' || sClean === 'thucchi' || sClean === 'dachi') return 'thucTe';
    if (sClean.includes('conlai')) return 'conLai';
    if (sClean.includes('tinhtrang')) return 'tinhTrang';

    if (sClean === 'sotien' || sClean === 'amount' || sClean === 'thanhtien') return 'soTien';
    if (sClean.includes('loaithuchi') || sClean.includes('loai') || sClean.includes('type')) return 'loaiThuChi';
    if (sClean.includes('hangmuc') || sClean.includes('doituong') || sClean.includes('mucchi') || sClean.includes('phanloai') || sClean.includes('category')) return 'doiTuongThuChi';
    
    // Ưu tiên map các cột chứa File/Link vào 'url'
    if (sClean === 'url' || sClean === 'link' || sClean === 'file' || sClean.includes('banve') || sClean.includes('hopdong') || sClean.includes('tailieu')) return 'url';
    if (sClean.includes('hinhanh') || sClean.includes('minhchung') || sClean.includes('anh') || sClean.includes('chungtu')) return 'hinhAnh';
    if (sClean.includes('nguoi') || sClean.includes('user')) return 'nguoiCapNhat';
    
    return s.replace(/\s+/g, '');
};

// Biến lưu trữ mapping tên cột thực tế từ AppSheet
const columnMapping = {
  "GhiChu": {},
  "GiaoDich": {},
  "BanVe": {},
  "HopDong": {},
  "NganSach": {}
};

// Helper để lấy tên cột AppSheet thực tế hoặc danh sách fallback
const getBestColumnName = (tableName, normalizedKey, defaultNames) => {
  const mapping = columnMapping[tableName] || {};
  if (mapping[normalizedKey]) return mapping[normalizedKey];
  
  // Nếu không có mapping, trả về giá trị fallback phù hợp nhất
  if (Array.isArray(defaultNames)) return defaultNames[0];
  
  // Fallback thông minh dựa trên normalizedKey cho các bảng BanVe, HopDong
  const smartFallbacks = {
    'id': 'id',
    'url': 'url',
    'name': 'name',
    'size': 'size',
    'category': 'category',
    'ngay': 'date'
  };
  return smartFallbacks[normalizedKey] || defaultNames;
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
          Locale: "en-US", // Đồng bộ US để nhận MM/DD/YYYY ổn định
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
    const rows = Array.isArray(rawData) ? rawData : [];
    const data = rows.map(row => {
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
    console.log(`[Mapping] Bảng ${tableName}:`, currentMapping);

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
    const normTableName = normalizeTableName(tableName);
    const normGiaoDichEnv = normalizeTableName(TABLE_GIAODICH_ENV);
    let formattedPayload = {};
    
    // 1. Đồng bộ Key dứt điểm (Bắt buộc để Edit)
    const finalKey = formatRowId(payload.keyId || payload.id || payload._RowNumber);
    const idCol = getBestColumnName(tableName, 'id', ['id', 'ID', 'Mã GD', 'MaGD', 'TT', 'STT', 'Mã']);
    formattedPayload[idCol] = finalKey;

    if (payload.appSheetId || payload._RowNumber) {
        formattedPayload["_RowNumber"] = payload.appSheetId || payload._RowNumber;
    }

    // 2. Map Ngày
    const dateObj = toSafeDate(payload.ngay) || new Date();
    // Gửi định dạng ISO YYYY-MM-DD để AppSheet nhận diện chính xác tuyệt đối
    const formattedDate = toInputString(dateObj);
    formattedPayload[getBestColumnName(tableName, 'ngay', ['date', 'Ngày', 'ngay', 'Date'])] = formattedDate;

    // 3. Map các trường dữ liệu quan trọng khác (Hỗ trợ BanVe, HopDong, GiaoDich)
    const nameCol = getBestColumnName(tableName, 'name', ['name', 'Tên', 'Tên bản vẽ', 'Tên hợp đồng']);
    if (nameCol && payload.name) formattedPayload[nameCol] = payload.name;

    const urlCol = getBestColumnName(tableName, 'url', ['url', 'Đường dẫn', 'URL', 'Link']);
    if (urlCol && payload.url) formattedPayload[urlCol] = payload.url;

    const sizeCol = getBestColumnName(tableName, 'size', ['size', 'Dung lượng', 'Size']);
    if (sizeCol && payload.size !== undefined) formattedPayload[sizeCol] = payload.size;

    const categoryCol = getBestColumnName(tableName, 'category', ['category', 'Phân loại', 'Category']);
    if (categoryCol && payload.category) formattedPayload[categoryCol] = payload.category;

    const noiDungVal = payload.noiDung || "";
    formattedPayload[getBestColumnName(tableName, 'noiDung', ['Nội dung', 'noiDung'])] = noiDungVal;

    // 4. Map động toàn bộ các trường còn lại trong payload
    Object.keys(payload).forEach(key => {
      const normKey = normalizeKey(key);
      // Bỏ qua các trường đã xử lý thủ công ở trên
      if (['id', 'keyId', 'appSheetId', 'ngay', 'date', 'noiDung', '_RowNumber', 'name', 'url', 'size', 'category'].includes(normKey)) return;
      
      const realCol = getBestColumnName(tableName, normKey, key);
      if (realCol) {
        formattedPayload[realCol] = payload[key];
      }
    });

    if (normTableName === "giaodich" || normTableName === normGiaoDichEnv) {
      const rawAmount = payload.soTien !== undefined ? payload.soTien : 0;
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;
      
      formattedPayload[getBestColumnName(tableName, 'soTien', ['Số tiền', 'Số tiền (VNĐ)', 'soTien', 'Thành tiền'])] = cleanAmount;
      
      const catVal = payload.doiTuongThuChi || payload.hangMuc || "";
      formattedPayload[getBestColumnName(tableName, 'doiTuongThuChi', ['Hạng mục', 'Phân loại', 'doiTuongThuChi'])] = catVal;
      
      formattedPayload[getBestColumnName(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh'])] = payload.hinhAnh || "";
      formattedPayload[getBestColumnName(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat'])] = payload.nguoiCapNhat || "Ba";
    }

    // Làm sạch: Chỉ giữ lại các cột đã map thành công
    Object.keys(formattedPayload).forEach(key => (formattedPayload[key] === undefined || key === 'undefined') && delete formattedPayload[key]);

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
    const normTableName = normalizeTableName(tableName);
    const normGiaoDichEnv = normalizeTableName(TABLE_GIAODICH_ENV);
    let formattedPayload = {};
    
    // 1. Map ID/Key: AppSheet yêu cầu Number cho cột ID chính, nên ta cần đảm bảo gửi số.
    const rawId = payload.id || payload.keyId;
    let finalKey;

    // For BanVe and HopDong, or if the rawId is not a valid number, use Date.now() for the primary ID.
    if (normTableName === normalizeTableName(TABLE_BANVE) || normTableName === normalizeTableName(TABLE_HOPDONG)) {
        finalKey = Date.now(); 
    } else if (!isNaN(Number(rawId))) { // If rawId is a number (e.g., from GiaoDich)
        finalKey = Number(rawId);
    } else { // Fallback for other cases, use Date.now()
        finalKey = Date.now();
    }
    
    formattedPayload[getBestColumnName(tableName, 'id', ['id', 'ID', 'Mã GD', 'MaGD', 'TT', 'STT', 'Mã'])] = finalKey;
    
    // 2. Map Ngày
    const dateObj = toSafeDate(payload.ngay) || new Date();
    // Gửi định dạng ISO YYYY-MM-DD
    const formattedDate = toInputString(dateObj);
    formattedPayload[getBestColumnName(tableName, 'ngay', ['date', 'Ngày', 'ngay', 'Date'])] = formattedDate;

    // 3. Map các trường dữ liệu quan trọng khác (Hỗ trợ BanVe, HopDong)
    const nameCol = getBestColumnName(tableName, 'name', ['name', 'Tên', 'Tên bản vẽ', 'Tên hợp đồng']);
    if (nameCol && payload.name) formattedPayload[nameCol] = payload.name;

    const urlCol = getBestColumnName(tableName, 'url', ['url', 'Đường dẫn', 'URL', 'Link']);
    if (urlCol && payload.url) formattedPayload[urlCol] = payload.url;

    const sizeCol = getBestColumnName(tableName, 'size', ['size', 'Dung lượng', 'Size']);
    if (sizeCol && payload.size !== undefined) formattedPayload[sizeCol] = payload.size;

    const categoryCol = getBestColumnName(tableName, 'category', ['category', 'Phân loại', 'Category']);
    if (categoryCol && payload.category) formattedPayload[categoryCol] = payload.category;

    const noiDungCol = getBestColumnName(tableName, 'noiDung', ['Nội dung', 'noiDung', 'Description']);
    if (noiDungCol && (payload.noiDung || normTableName === "ghichu" || normTableName === "giaodich")) {
      formattedPayload[noiDungCol] = payload.noiDung || "";
    }

    // 4. Map động toàn bộ các trường còn lại trong payload (Quan trọng cho BanVe, HopDong)
    Object.keys(payload).forEach(key => {
      const normKey = normalizeKey(key);
      // Bỏ qua các trường đã xử lý thủ công ở trên
      if (['id', 'keyId', 'appSheetId', 'ngay', 'date', 'noiDung', '_RowNumber', 'name', 'url', 'size', 'category'].includes(normKey)) return;
      
      const realCol = getBestColumnName(tableName, normKey, key);
      if (realCol) {
        formattedPayload[realCol] = payload[key];
      }
    });

    if (normTableName === "giaodich" || normTableName === normGiaoDichEnv) {
      const rawAmount = payload.soTien !== undefined ? payload.soTien : 0;
      const cleanAmount = parseInt(String(rawAmount).replace(/\D/g, "")) || 0;

      formattedPayload[getBestColumnName(tableName, 'soTien', ['Số tiền', 'Số tiền (VNĐ)', 'soTien', 'Thành tiền'])] = cleanAmount;
      formattedPayload[getBestColumnName(tableName, 'doiTuongThuChi', ['Hạng mục', 'Phân loại', 'doiTuongThuChi'])] = payload.doiTuongThuChi || payload.hangMuc || "";
      formattedPayload[getBestColumnName(tableName, 'hinhAnh', ['Hình ảnh', 'hinhAnh', 'Chứng từ'])] = payload.hinhAnh || "";
      formattedPayload[getBestColumnName(tableName, 'nguoiCapNhat', ['Người cập nhật', 'nguoiCapNhat', 'User'])] = payload.nguoiCapNhat || "Ba";
    }
    
    // Làm sạch: Loại bỏ các cột không được định nghĩa rõ ràng
    Object.keys(formattedPayload).forEach(key => (formattedPayload[key] === undefined || key === 'undefined') && delete formattedPayload[key]);

    // Log để debug khi cần
    console.log(`[AppSheet API] Sending Add to ${tableName}:`, JSON.stringify(formattedPayload));

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
          Locale: "en-US", // Đồng bộ en-US toàn hệ thống để giữ ổn định định dạng ngày
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
    const keyCol = getBestColumnName(tableName, 'id', ['ID', 'id', 'TT', 'STT', 'Mã', 'Ma']);

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
        Properties: {
          Locale: "en-US", // Đồng bộ en-US toàn hệ thống
          Timezone: "Asia/Ho_Chi_Minh" 
        },
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
