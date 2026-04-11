/**
 * Chuyển đổi mọi nguồn dữ liệu thành đối tượng Date nguyên bản (Local Time)
 * Đảm bảo không bị lệch múi giờ.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  // Làm sạch chuỗi: lấy phần ngày, loại bỏ giờ và ký tự rác
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "");
  
  // 1. Định dạng VN: DD/MM/YYYY
  const vnMatch = str.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10);
    const year = parseInt(vnMatch[3], 10);
    // KIỂM TRA CHẶT CHẼ: Nếu tháng > 12 hoặc ngày > 31, đây là định dạng sai, không được tự suy diễn
    if (month > 12 || day > 31) return null; 
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  // 2. Định dạng ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/\-. ](\d{1,2})[/\-. ](\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 0, 0, 0);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 0, 0, 0);
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