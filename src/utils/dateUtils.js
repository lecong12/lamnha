/**
 * Chuyển đổi mọi nguồn dữ liệu thành đối tượng Date nguyên bản (Local Time)
 * Ép về 12:00:00 để triệt tiêu hoàn toàn lỗi lệch ngày do múi giờ.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
  }
  
  // Làm sạch chuỗi: lấy phần ngày, loại bỏ giờ và ký tự rác
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "");

  // 1. Định dạng VN/GB: DD/MM/YYYY (Sửa Regex để không lỗi Build)
  const vnMatch = str.match(/^(\d{1,2})[/ \-. ](\d{1,2})[/ \-. ](\d{4})$/);
  if (vnMatch) {
    return new Date(
      parseInt(vnMatch[3], 10), 
      parseInt(vnMatch[2], 10) - 1, 
      parseInt(vnMatch[1], 10), 
      12, 0, 0
    );
  }

  // 2. Định dạng ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/ \-. ](\d{1,2})[/ \-. ](\d{1,2})$/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1], 10), 
      parseInt(isoMatch[2], 10) - 1, 
      parseInt(isoMatch[3], 10), 
      12, 0, 0
    );
  }

  const fallback = new Date(str);
  if (isNaN(fallback.getTime())) return null;
  
  // Fallback cũng ép về 12h trưa
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
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
  const month = String(d.getDate()).padStart(2, '0'); // Lỗi cũ: d.getDate() ở đây
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
};

export const getTodayInputString = () => toInputString(new Date());
