/**
 * src/utils/dateUtils.js
 * Tiêu chuẩn xử lý ngày tháng thống nhất cho toàn bộ ứng dụng.
 */

/**
 * Chuyển đổi mọi nguồn dữ liệu (String, Date, ISO) thành đối tượng Date an toàn.
 * Sử dụng mốc 12:00:00 trưa để tránh việc lệch múi giờ làm nhảy ngày.
 */
export const toSafeDate = (value) => {
  if (!value) return null;
  
  // Nếu đã là đối tượng Date
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
  }
  
  // Làm sạch chuỗi: lấy phần ngày YYYY-MM-DD hoặc DD/MM/YYYY, bỏ qua giờ phút giây
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "");

  // 1. Định dạng Việt Nam: DD/MM/YYYY hoặc DD-MM-YYYY
  const vnMatch = str.match(/^(\d{1,2})[/ \-. ](\d{1,2})[/ \-. ](\d{4})$/);
  if (vnMatch) {
    return new Date(
      parseInt(vnMatch[3], 10),      // Năm
      parseInt(vnMatch[2], 10) - 1,  // Tháng (0-11)
      parseInt(vnMatch[1], 10),      // Ngày
      12, 0, 0                       // Ép về 12h trưa
    );
  }

  // 2. Định dạng chuẩn ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/ \-. ](\d{1,2})[/ \-. ](\d{1,2})$/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1], 10),     // Năm
      parseInt(isoMatch[2], 10) - 1, // Tháng
      parseInt(isoMatch[3], 10),     // Ngày
      12, 0, 0                       // Ép về 12h trưa
    );
  }

  // Dự phòng (Fallback) cho các định dạng khác
  const fallback = new Date(str);
  if (isNaN(fallback.getTime())) return null;
  
  return new Date(
    fallback.getFullYear(), 
    fallback.getMonth(), 
    fallback.getDate(), 
    12, 0, 0
  );
};

/**
 * Xuất chuỗi YYYY-MM-DD (Định dạng AppSheet và HTML Input Date cần)
 * @param {any} value - Giá trị ngày tháng đầu vào
 * @returns {string} - "2026-04-10"
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
 * Xuất chuỗi DD/MM/YYYY để hiển thị trên giao diện người dùng
 * @param {any} value - Giá trị ngày tháng đầu vào
 * @returns {string} - "10/04/2026"
 */
export const toDisplayString = (value) => {
  const d = toSafeDate(value);
  if (!d) return "---";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

/**
 * Lấy ngày hôm nay dưới dạng chuỗi chuẩn để lưu vào AppSheet
 * @returns {string} - "2026-04-10"
 */
export const getTodayInputString = () => toInputString(new Date());

/**
 * Tính toán số ngày giữa hai mốc thời gian (Dùng cho Gantt Chart)
 */
export const getDayDiff = (d1, d2) => {
  const date1 = toSafeDate(d1);
  const date2 = toSafeDate(d2);
  if (!date1 || !date2) return 0;

  // Sử dụng UTC để tính toán khoảng cách chính xác tuyệt đối
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());

  return Math.floor((utc2 - utc1) / 86400000);
};
