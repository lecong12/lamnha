/**
 * src/utils/dateUtils.js
 * TIÊU CHUẨN: CHỈ DÙNG CHUỖI (STRING) - CẤM TÍNH TOÁN DATE ĐỐI VỚI INPUT
 */

// Hàm bổ trợ: Đảm bảo số có 2 chữ số
const pad = (num) => String(num).padStart(2, '0');

export const toSafeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  // Chỉ lấy phần YYYY-MM-DD hoặc DD/MM/YYYY
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "");
  
  const vnMatch = str.match(/^(\d{1,2})[/ \-. ](\d{1,2})[/ \-. ](\d{4})$/);
  if (vnMatch) return new Date(parseInt(vnMatch[3], 10), parseInt(vnMatch[2], 10) - 1, parseInt(vnMatch[1], 10), 12, 0, 0);

  const isoMatch = str.match(/^(\d{4})[/ \-. ](\d{1,2})[/ \-. ](\d{1,2})$/);
  if (isoMatch) return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10), 12, 0, 0);

  const fb = new Date(str);
  if (isNaN(fb.getTime())) return null;
  return new Date(fb.getFullYear(), fb.getMonth(), fb.getDate(), 12, 0, 0);
};

/**
 * HÀM QUAN TRỌNG NHẤT: Trả về YYYY-MM-DD chuẩn cho Input
 */
export const toInputString = (value) => {
  if (!value) return "";
  
  // Nếu là chuỗi, ta dùng Regex tách trực tiếp để không bị lệch múi giờ
  let str = String(value).trim().split(/[ T]/)[0].replace(/[\\"]/g, "");
  
  // Nếu là DD/MM/YYYY
  const vnMatch = str.match(/^(\d{1,2})[/ \-. ](\d{1,2})[/ \-. ](\d{4})$/);
  if (vnMatch) return `${vnMatch[3]}-${pad(vnMatch[2])}-${pad(vnMatch[1])}`;

  // Nếu là YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/ \-. ](\d{1,2})[/ \-. ](\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${pad(isoMatch[2])}-${pad(isoMatch[3])}`;

  // Trường hợp bất khả kháng mới dùng đối tượng Date
  const d = toSafeDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
};

/**
 * Hiển thị DD/MM/YYYY
 */
export const toDisplayString = (value) => {
  const input = toInputString(value);
  if (!input) return "---";
  const [y, m, d] = input.split("-");
  return `${d}/${m}/${y}`;
};

export const getTodayInputString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
