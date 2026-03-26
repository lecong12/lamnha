const handleOpenDocument = (rawUrl) => {
  if (!rawUrl) return;

  // 1. Ép kiểu về String để tránh lỗi Object
  const urlStr = String(rawUrl);

  // 2. Dùng Regex để "nhặt" đúng link Cloudinary ra khỏi đống JSON rác
  const match = urlStr.match(/(https:\/\/res\.cloudinary\.com\/[^\s"'}]+)/);

  if (match && match[0]) {
    // 3. Làm sạch thêm một lần nữa (xóa dấu ngoặc, nháy thừa)
    const cleanUrl = match[0].replace(/%22/g, '').replace(/["'}]/g, '');
    window.open(cleanUrl, '_blank');
  } else {
    // Nếu không phải link Cloudinary, cứ mở bình thường (đề phòng link khác)
    window.open(urlStr, '_blank');
  }
};
