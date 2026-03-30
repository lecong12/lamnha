/**
 * Service dùng chung để gọi Gemini AI trích xuất thông tin từ ảnh
 * @param {string} source - URL ảnh (Cloudinary) hoặc chuỗi Base64
 * @param {string} type - 'invoice' (Hóa đơn) hoặc 'card' (Danh thiếp)
 */
export const extractInfoWithAI = async (source, type = 'invoice') => {
  try {
    const response = await fetch('/api/gemini-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: source, type })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    console.error(`AI Service Error [${type}]:`, error);
    throw error;
  }
};