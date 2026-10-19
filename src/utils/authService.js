/**
 * authService.js
 * Module xử lý xác thực đăng nhập, đăng xuất và quản lý phiên làm việc.
 */

const DEFAULT_USERNAME = process.env.REACT_APP_AUTH_USERNAME || "admin";
const DEFAULT_PASSWORD = process.env.REACT_APP_AUTH_PASSWORD || "123";

export const authService = {
  /**
   * Đăng nhập với tài khoản và mật khẩu
   * @param {string} username - Tên tài khoản
   * @param {string} password - Mật khẩu
   * @returns {{ success: boolean, message?: string, user?: object }}
   */
  login: (username, password) => {
    const cleanUser = String(username || "").trim().toLowerCase();
    const cleanPass = String(password || "").trim();

    if (!cleanUser || !cleanPass) {
      return {
        success: false,
        message: "Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!",
      };
    }

    if (
      cleanUser === DEFAULT_USERNAME.toLowerCase() &&
      cleanPass === DEFAULT_PASSWORD
    ) {
      const user = {
        username: DEFAULT_USERNAME,
        role: "admin",
        loggedInAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("currentUser", JSON.stringify(user));
      } catch (err) {
        console.error("Lỗi khi lưu phiên đăng nhập:", err);
      }
      return { success: true, user };
    }

    return {
      success: false,
      message: "Tên tài khoản hoặc mật khẩu không chính xác!",
    };
  },

  /**
   * Đăng xuất và xóa phiên làm việc
   */
  logout: () => {
    try {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("currentUser");
    } catch (err) {
      console.error("Lỗi khi xóa phiên đăng nhập:", err);
    }
    return { success: true };
  },

  /**
   * Kiểm tra người dùng đã đăng nhập chưa
   * @returns {boolean}
   */
  isAuthenticated: () => {
    try {
      return localStorage.getItem("isLoggedIn") === "true";
    } catch {
      return false;
    }
  },

  /**
   * Lấy thông tin người dùng hiện tại
   * @returns {object|null}
   */
  getCurrentUser: () => {
    try {
      if (localStorage.getItem("isLoggedIn") !== "true") return null;
      const saved = localStorage.getItem("currentUser");
      return saved ? JSON.parse(saved) : { username: DEFAULT_USERNAME };
    } catch {
      return null;
    }
  },
};

export default authService;

