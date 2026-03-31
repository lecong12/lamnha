const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config(); // Tải các biến môi trường từ file .env

const { google } = require('googleapis');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();

// Cho phép nhận JSON từ client
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cấu hình CORS thủ công (Cho phép Frontend gọi API)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Trong thực tế nên để http://localhost:3000
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  // Xử lý Preflight request
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Cấu hình xác thực Google Sheets
// LƯU Ý: Các biến môi trường này phải được cài đặt trên Vercel
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Xử lý lỗi xuống dòng trong Private Key khi lưu trên Vercel
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Cấu hình Gemini
const apiKey = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// API trích xuất thông tin bằng AI
app.post('/api/gemini-extract', async (req, res) => {
  try {
    const { imageUrl, type } = req.body; // type: 'card' hoặc 'invoice'

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }

    if (!imageUrl) return res.status(400).json({ error: 'Thiếu link ảnh' });

    // Cấu hình Model với hướng dẫn hệ thống nghiêm ngặt
    // Dùng gemini-1.5-flash vì nó hỗ trợ JSON mode cực tốt và miễn phí/rẻ hơn
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.1, // Giảm độ sáng tạo để trích xuất chính xác hơn
        responseMimeType: "application/json",
      }
    });
    
    let imageData;
    let mimeType = "image/jpeg";

    // Xử lý nếu imageUrl là chuỗi Base64 từ BusinessScanner gửi lên
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      imageData = base64Data;
      mimeType = imageUrl.split(";")[0].split(":")[1];
    } else {
      // Nếu là URL (Cloudinary), tải về an toàn hơn
      const imageResp = await fetch(imageUrl);
      if (!imageResp.ok) throw new Error("Không thể tải ảnh từ Cloudinary");
      
      const arrayBuffer = await imageResp.arrayBuffer();
      imageData = Buffer.from(arrayBuffer).toString("base64");

      const urlLower = imageUrl.toLowerCase();
      if (urlLower.includes(".png")) mimeType = "image/png";
      else if (urlLower.includes(".pdf")) mimeType = "application/pdf";
      else if (urlLower.includes(".webp")) mimeType = "image/webp";
    }
    
    let prompt = "";
    if (type === 'card') {
      prompt = `Hãy đóng vai một máy quét OCR chuyên nghiệp. Phân tích ảnh danh thiếp (business card) hoặc biển hiệu cửa hàng (signage) Việt Nam này và trả về JSON:
      {
        "ten": "Tên công ty/cửa hàng/đơn vị (thường là chữ to nhất)",
        "sdt": "Số điện thoại liên hệ (Chỉ lấy các chữ số, bắt đầu bằng số 0, dài 10-11 ký tự)",
        "diaChi": "Địa chỉ đầy đủ",
        "mst": "Mã số thuế (nếu có)"
      }
      Lưu ý: Tìm kỹ các từ khóa 'ĐT', 'Tel', 'Hotline', 'Zalo'. Nếu không thấy thông tin nào, hãy để "". Trả về JSON thuần túy.`;
    } else {
      prompt = `Phân tích ảnh hóa đơn/phiếu thu này. Chỉ tập trung vào thông tin của BÊN BÁN (NGƯỜI BÁN):
      {
        "ten": "Tên cửa hàng hoặc doanh nghiệp bán vật tư (Ví dụ: VLXD A)",
        "sdt": "Số điện thoại của người bán (Tìm gần địa chỉ hoặc tên cửa hàng, bắt đầu bằng 0)",
        "ngay": "Ngày mua hàng (Định dạng YYYY-MM-DD)",
        "soTien": 0,
        "noiDung": "Tóm tắt các mặt hàng chính đã mua (Ví dụ: Gạch ống, Xi măng Hà Tiên)"
      }
      Lưu ý: KHÔNG lấy thông tin người mua. Nếu không thấy SĐT, hãy để "". Trả về JSON thuần túy.`;
    }

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      },
      prompt
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Làm sạch dữ liệu trả về để đảm bảo JSON.parse không lỗi
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    res.json(JSON.parse(text));
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'AI không thể phân tích ảnh lúc này' });
  }
});

// Route kiểm tra server sống hay chết
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running!' });
});

// --- ROUTE API QUAN TRỌNG: Lấy dữ liệu cho Frontend ---
// Route này phục vụ request GET /api/data từ App.js
app.get('/api/data', async (req, res) => {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'GiaoDich!A:G'; // Cập nhật range A:G theo cấu trúc mới

    if (!spreadsheetId) {
      return res.status(500).json({ error: 'SPREADSHEET_ID chưa được cấu hình trên server.' });
    }

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values || [];
    res.header('Content-Type', 'application/json');
    res.json({ data: values });
  } catch (error) {
    console.error('Lỗi khi đọc Google Sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route để thêm dữ liệu mới vào Sheet
app.post('/api/data', async (req, res) => {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'GiaoDich!A:G'; // Cập nhật range A:G

    // Dữ liệu gửi từ client, ví dụ: { values: ["2024-05-20", "Vật tư", "Xi măng", 500000, "Đợt 1"] }
     const { values } = req.body;

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Dữ liệu "values" không hợp lệ, phải là một mảng.' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED', // Giúp Google Sheets tự định dạng (ngày, số)
       resource: { values: [values] }, // Dữ liệu phải là một mảng 2 chiều
    });

    res.header('Content-Type', 'application/json');
    res.status(201).json({ message: 'Thêm dữ liệu thành công!' });
  } catch (error) {
    console.error('Lỗi khi ghi vào Google Sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- CẤU HÌNH PHỤC VỤ FRONTEND (REACT) ---
// Express sẽ phục vụ các file tĩnh trong thư mục 'build' (được tạo ra khi chạy 'npm run build')
app.use(express.static(path.join(__dirname, 'build')));

// Mọi request không khớp với API sẽ trả về file index.html của React (để React Router xử lý)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Xuất app để Vercel biến nó thành Serverless Function
module.exports = app;

// Khởi động server nếu chạy trực tiếp (Localhost)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  
  // Kiểm tra cấu hình biến môi trường khi khởi động
  console.log("=== KIỂM TRA CẤU HÌNH HỆ THỐNG ===");
  console.log("PORT:", PORT);
  console.log("GEMINI_API_KEY:", apiKey ? "✅ Đã cài đặt" : "❌ THIẾU");
  console.log("GOOGLE_SHEETS_AUTH:", (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ? "✅ Đã cài đặt" : "❌ THIẾU");
  console.log("SPREADSHEET_ID:", process.env.SPREADSHEET_ID ? "✅ Đã cài đặt" : "❌ THIẾU");
  console.log("==================================");

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}