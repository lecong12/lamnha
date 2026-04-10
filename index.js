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
    const { imageUrl } = req.body;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }

    if (!imageUrl) return res.status(400).json({ error: 'Thiếu link ảnh' });

    // Cấu hình Model với hướng dẫn hệ thống nghiêm ngặt
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.1, // Giảm độ sáng tạo để trích xuất chính xác hơn
        responseMimeType: "application/json",
      },
      systemInstruction: "Bạn là một chuyên gia OCR hóa đơn xây dựng tại Việt Nam. Phải luôn trả về JSON đúng định dạng. Nếu không tìm thấy số tiền, hãy để là 0. Nếu không thấy ngày, hãy để null."
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
    
    const prompt = `Trích xuất thông tin từ hóa đơn/phiếu thu vật tư xây dựng này. Chỉ lấy thông tin của BÊN BÁN:
    {
      "ten": "Tên cửa hàng/doanh nghiệp bán",
      "sdt": "Số điện thoại người bán (bắt đầu bằng 0)",
      "ngay": "Ngày mua hàng (Định dạng YYYY-MM-DD)",
      "soTien": 0,
      "noiDung": "Tóm tắt vật tư (Ví dụ: 50 bao xi măng Hà Tiên, 2 khối cát)"
    }
    Lưu ý: soTien phải là số nguyên (ví dụ: 500000). KHÔNG lấy thông tin người mua.`;

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
    
    try {
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        text = text.substring(startIdx, endIdx + 1);
      }
      return res.json(JSON.parse(text));
    } catch (parseError) {
      console.error("Lỗi parse JSON từ Gemini:", text);
      return res.status(500).json({ error: 'AI trả về dữ liệu không đúng định dạng JSON' });
    }
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
    const range = 'GiaoDich!A:H'; // Mở rộng tới cột H để chứa Ghi chú

    if (!spreadsheetId) {
      return res.status(500).json({ error: 'SPREADSHEET_ID chưa được cấu hình trên server.' });
    }

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values || [];
    res.header('Content-Type', 'application/json');
    
    // Log để kiểm tra số cột thực tế từ Sheet
    console.log(`Đã tải ${values.length} dòng từ Sheet.`);
    
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
    const range = 'GiaoDich!A:H'; // Cập nhật range A:H

    const { values } = req.body;

    if (!values || !Array.isArray(values)) {
      console.error('Dữ liệu không hợp lệ:', req.body);
      return res.status(400).json({ error: 'Dữ liệu "values" phải là một mảng (Array).' });
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