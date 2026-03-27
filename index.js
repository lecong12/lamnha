const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config(); // Tải các biến môi trường từ file .env

const { google } = require('googleapis');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();

// Cho phép nhận JSON từ client
app.use(express.json());

// Cấu hình CORS thủ công (Cho phép Frontend gọi API)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Trong thực tế nên để http://localhost:3000
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// API trích xuất thông tin bằng AI
app.post('/api/gemini-extract', async (req, res) => {
  try {
    const { imageUrl, type } = req.body; // type: 'card' hoặc 'invoice'

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
    }

    if (!imageUrl) return res.status(400).json({ error: 'Thiếu link ảnh' });

    // Cấu hình Model với hướng dẫn hệ thống nghiêm ngặt
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    // Tải ảnh từ Cloudinary để gửi cho Gemini
    const imageResp = await fetch(imageUrl).then(response => response.arrayBuffer());
    
    let prompt = "";
    if (type === 'card') {
      prompt = `Bạn là một chuyên gia OCR tài liệu chính xác tuyệt đối. Hãy phân tích ảnh Card Visit hoặc Bảng hiệu này để trích xuất thông tin.
      Yêu cầu:
      1. "ten": Trích xuất tên doanh nghiệp hoặc tên cửa hàng rõ ràng nhất.
      2. "sdt": Tìm số điện thoại liên hệ. Quy tắc nhận diện nghiêm ngặt:
         - Ưu tiên tìm các dãy số đứng sau từ khóa: "Điện thoại:", "Tel:", "Telephone:", "Liên hệ:", "SĐT:", "Mobile:", "Hotline:".
         - Định dạng: Số điện thoại thường có 10 chữ số (không tính các dấu chấm "." phân cách).
         - Quy tắc bắt đầu: Phải bắt đầu bằng số 0 (đầu số Việt Nam) hoặc dấu "+" (quốc tế).
         - Làm sạch dữ liệu: Chỉ lấy chữ số và dấu "+". Loại bỏ hoàn toàn dấu chấm (.), dấu gạch ngang (-) và khoảng trắng.
         - Tuyệt đối không được ghép các cụm số nằm ở các dòng khác nhau hoặc vị trí cách xa nhau.
      Lưu ý đặc biệt: Nếu không tìm thấy dãy số nào khớp với quy chuẩn thực tế hoặc số bị mờ không đọc rõ, hãy để giá trị là "". Tuyệt đối không tự bịa số.
      Trả về JSON: {"ten": "...", "sdt": "..."}`;
    } else {
      prompt = `Bạn là một kế toán chuyên nghiệp. Hãy phân tích hóa đơn/biên lai vật tư xây dựng này.
      Yêu cầu:
      1. "ngay": Tìm ngày giao dịch. Nếu định dạng là dd/mm/yyyy, hãy chuyển về YYYY-MM-DD. Nếu không thấy năm, hãy giả định là 2024 hoặc 2025.
      2. "soTien": Tìm "Tổng cộng" hoặc "Thành tiền" cuối cùng. Chỉ lấy giá trị số nguyên, bỏ qua ký hiệu tiền tệ.
      3. "noiDung": Tóm tắt ngắn gọn các mặt hàng (Ví dụ: "Xi măng Hà Tiên", "Cát xây tô").
      Lưu ý: Ưu tiên độ chính xác hơn là số lượng. Nếu chữ quá mờ không đọc được, để giá trị "".
      Trả về JSON: {"ngay": "...", "soTien": 0, "noiDung": "..."}`;
    }

    const result = await model.generateContent([
      {
        inlineData: {
          data: Buffer.from(imageResp).toString("base64"),
          mimeType: "image/jpeg"
        }
      },
      prompt
    ]);

    const response = await result.response;
    const data = JSON.parse(response.text());
    res.json(data);
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
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}