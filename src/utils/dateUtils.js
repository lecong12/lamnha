/**
 * Chuyển đổi mọi nguồn dữ liệu thành đối tượng Date nguyên bản (Local Time)
 * Đảm bảo không bị lệch múi giờ.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  // 1. Làm sạch chuỗi: bỏ ngoặc, bỏ phần giờ
  const cleanStr = String(value).trim().replace(/[\\"]/g, "").split(/[ T]/)[0];
  if (!cleanStr || ["null", "undefined", "", "---", "invalid"].includes(cleanStr.toLowerCase())) return null;
  const str = cleanStr.toLowerCase();

  // 2. TRƯỜNG HỢP 1: Năm đứng đầu (ISO: YYYY-MM-DD) - Đây là chuẩn code gửi lên
  const isoMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(v => parseInt(v, 10));
    const date = new Date(y, m - 1, d, 0, 0, 0);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }

  // 3. TRƯỜNG HỢP 2: Năm đứng cuối (X/Y/YYYY) - Đây là chuẩn AppSheet trả về
  const partsMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (partsMatch) {
    const n1 = parseInt(partsMatch[1], 10);
    const n2 = parseInt(partsMatch[2], 10);
    const year = parseInt(partsMatch[3], 10);

    // THỬ KIỂU MỸ TRƯỚC (MM/DD/YYYY) vì AppSheet thường gửi kiểu này qua API
    let d = new Date(year, n1 - 1, n2, 0, 0, 0);
    if (d.getFullYear() === year && d.getMonth() === n1 - 1 && d.getDate() === n2) return d;

    // NẾU MỸ SAI (ví dụ n1 > 12), THỬ KIỂU VN (DD/MM/YYYY)
    d = new Date(year, n2 - 1, n1, 0, 0, 0);
    if (d.getFullYear() === year && d.getMonth() === n2 - 1 && d.getDate() === n1) return d;
  }

  // 4. Không dùng fallback new Date(str) để tránh trình duyệt tự đoán sai
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