/**
 * Service dùng chung để gọi Gemini AI trích xuất thông tin từ ảnh
 * @param {string} source - URL ảnh (Cloudinary) hoặc chuỗi Base64
 */
export const extractInfoWithAI = async (source) => {
  try {
    const response = await fetch('/api/gemini-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: source })
    });

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Không nhận được phản hồi từ AI server.");
    }

    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    console.error(`AI Service Error:`, error);
    throw error;
  }
};