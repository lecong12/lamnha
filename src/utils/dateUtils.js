/**
 * Chuyển đổi mọi nguồn dữ liệu thành đối tượng Date nguyên bản (Local Time)
 * Đảm bảo không bị lệch múi giờ.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "").toLowerCase();
  if (str === "null" || str === "undefined" || !str) return null;

  // 1. Định dạng VN/GB: DD/MM/YYYY (Loại bỏ $ để khớp cả chuỗi có giờ)
  const vnMatch = str.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})/);
  if (vnMatch) {
    const v1 = parseInt(vnMatch[1], 10);
    const v2 = parseInt(vnMatch[2], 10);
    const year = parseInt(vnMatch[3], 10);
    
    // THỬ DD/MM/YYYY TRƯỚC (Chuẩn Việt Nam)
    const dVN = new Date(year, v2 - 1, v1, 0, 0, 0);
    if (dVN.getFullYear() === year && dVN.getMonth() === v2 - 1 && dVN.getDate() === v1) return dVN;
    
    // DỰ PHÒNG MM/DD/YYYY (Chỉ dùng nếu DD/MM không hợp lệ)
    const dUS = new Date(year, v1 - 1, v2, 0, 0, 0);
    if (dUS.getFullYear() === year && dUS.getMonth() === v1 - 1 && dUS.getDate() === v2) return dUS;
  }

  // 2. Định dạng ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/\-. ](\d{1,2})[/\-. ](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month - 1, day, 0, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  return null;
};

/**
 * Xuất chuỗi YYYY-MM-DD cho AppSheet & HTML Input
 */
export const toInputString = (value) => {
  const d = toSafeDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Xuất chuỗi DD/MM/YYYY để hiển thị cho người dùng
 */
export const toDisplayString = (value) => {
  const d = toSafeDate(value);
  if (!d) return "---";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

export const getTodayInputString = () => toInputString(new Date());