// AppSheet API Configuration
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;
const formatRowId = (id) => {
  // Giữ nguyên ID gốc để tránh lỗi không khớp Key trong AppSheet (Ví dụ: NOTE_123 không được biến thành 123)
  return id;
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

    const data = await response.json();
    // AppSheet trả về mảng object hoặc object rỗng nếu lỗi/không có dữ liệu
    return { success: true, data: Array.isArray(data) ? data : [] };
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

    // Đảm bảo ID được định dạng là số nếu AppSheet yêu cầu (loại bỏ GD_, CT_, BV_...)
    const formattedPayload = { 
      ...payload, 
      id: formatRowId(payload.id) 
    };

    // AppSheet cần ID để biết dòng nào cần sửa, và các trường khác để cập nhật
    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return { success: true, message: "Cập nhật thành công" };
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
    // Đảm bảo ID được định dạng chuẩn số trước khi thêm mới
    const formattedPayload = { 
      ...payload, 
      id: formatRowId(payload.id) 
    };

    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return { success: true, message: "Thêm mới thành công" };
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
    const response = await fetch(getApiUrl(appId, tableName), {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Action: "Delete",
        Properties: { Locale: "vi-VN" },
        Rows: [{ id: formatRowId(payloadId) }], // Chỉ cần gửi ID của dòng cần xóa
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
