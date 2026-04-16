/**
 * Chuyển đổi mọi nguồn dữ liệu thành đối tượng Date nguyên bản (Local Time)
 * Đảm bảo không bị lệch múi giờ.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  // 1. Làm sạch chuỗi triệt để: bỏ ngoặc, bỏ khoảng trắng thừa, bỏ phần giờ
  const rawStr = String(value).trim().replace(/[\\"]/g, "").replace(/\s+/g, " ");
  const cleanStr = rawStr.split(" ")[0].split("T")[0];
  
  if (!cleanStr || ["null", "undefined", "", "---", "invalid"].includes(cleanStr.toLowerCase())) return null;
  const str = cleanStr.toLowerCase();

  // 2. Ưu tiên ISO YYYY-MM-DD trước (vì đây là định dạng chuẩn code gửi lên)
  const isoMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month - 1, day, 0, 0, 0);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return d;
    }
  }

  // 3. ÉP BUỘC định dạng VN/GB: DD/MM/YYYY
  const vnMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10);
    let year = parseInt(vnMatch[3], 10);
    if (year < 100) year += 2000;

    const d = new Date(year, month - 1, day, 0, 0, 0);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
  }

  // 4. Tuyệt đối KHÔNG dùng fallback new Date(str) để tránh trình duyệt tự ý đảo ngày/tháng
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