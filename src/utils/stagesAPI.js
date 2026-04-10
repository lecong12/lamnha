import { toSafeDate as baseToSafeDate } from './dateUtils';
import { getCleanLink } from './sheetsAPI';
const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;
const STAGES_TABLE_NAME = process.env.REACT_APP_APPSHEET_TABLE_TIENDO || "TienDo"; // Tên bảng chứa dữ liệu tiến độ

const getApiUrl = (appId) => `https://www.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(STAGES_TABLE_NAME)}/Action`;

// Alias để đảm bảo các file cũ import 'parseDate' không bị lỗi build
export const toSafeDate = baseToSafeDate;
export const parseDate = baseToSafeDate;

/**
 * Lấy danh sách các giai đoạn từ bảng data_tien_do
 */
export const fetchStages = async (appId) => {
  try {
    if (!appId) throw new Error("Thiếu App ID.");
    const apiUrl = getApiUrl(appId);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        Action: "Find", 
        Properties: { 
          Locale: "en-GB", // Nhận ngày dạng DD/MM/YYYY để khớp với parser VN
          Timezone: "Asia/Ho_Chi_Minh"
        },
        Rows: [] 
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Lỗi 404: Không tìm thấy bảng "${STAGES_TABLE_NAME}". Hãy tạo bảng này trong Google Sheet và AppSheet.`);
      }
      throw new Error(`Lỗi kết nối AppSheet (Mã lỗi: ${response.status}) khi tải tiến độ.`);
    }

    const responseText = await response.text();
    let rawData = [];
    
    if (responseText && responseText.trim()) {
      try {
        const parsed = JSON.parse(responseText);
        // AppSheet trả về { "Rows": [...] } hoặc [...]
        rawData = Array.isArray(parsed) ? parsed : (parsed.Rows || []);
      } catch (parseError) {
        console.error("Lỗi parse JSON Tiến độ:", parseError);
        return { success: false, message: "Dữ liệu AppSheet trả về không hợp lệ.", data: [] };
      }
    }

    if (!rawData || rawData.length === 0) {
      return { success: true, data: [] };
    }

    const transformedData = rawData.map((row, index) => {
      // 1. Tìm tên cột Key và Ảnh chính xác (bất kể hoa thường)
      const rowKeys = Object.keys(row);
      
      // Ưu tiên tìm cột 'id', nếu không có thì tìm 'tt', 'stt', cuối cùng fallback về 'id'
      const idKey = rowKeys.find(k => k.trim().toLowerCase() === 'id') || 
                    rowKeys.find(k => k.trim().toLowerCase() === 'tt') || 
                    rowKeys.find(k => k.trim().toLowerCase() === 'stt') || 'id';
                    
      const imgKey = rowKeys.find(k => {
        const key = k.trim().toLowerCase();
        return key.includes('ảnh') || key.includes('anh') || 
               key.includes('hình') || key.includes('hinh') ||
               key.includes('chứng từ') || key.includes('chung tu') ||
               key.includes('minh chứng') || key.includes('minh chung');
      });
      
      // Fallback imgKey nếu không tìm thấy
      const finalImgKey = imgKey || rowKeys.find(k => k.includes('Ảnh')) || "Ảnh nghiệm thu";

      // 3. Tìm cột Tên (Name) để hiển thị tiêu đề
      const nameKey = rowKeys.find(k => {
        const key = k.trim().toLowerCase();
        return key === 'name' ||
               key.includes('tên công việc') || key.includes('ten cong viec') ||
               key.includes('hạng mục') || key.includes('hang muc') ||
               key.includes('nội dung') || key.includes('noi dung') ||
               key.includes('công việc') || key.includes('cong viec') ||
               key.includes('giai đoạn');
      });

      // 4. Tìm cột Ngày bắt đầu / Kết thúc (chấp nhận cả tiếng Việt có dấu)
      const startKey = rowKeys.find(k => {
        const key = k.trim().toLowerCase().replace(/_/g, "");
        return key === 'ngaybatdau' || key.includes('bat dau') || key.includes('bắt đầu') || key.includes('start') || key.includes('ngày bđ') || key.includes('ngay bd');
      });

      const endKey = rowKeys.find(k => {
        const key = k.trim().toLowerCase().replace(/_/g, "");
        return key === 'ngayketthuc' || key.includes('ket thuc') || key.includes('kết thúc') || key.includes('end') || key.includes('hoan thanh') || key.includes('ngày kt') || key.includes('ngay kt');
      });

      // 5. Tìm cột Trạng thái
      const statusKey = rowKeys.find(k => {
        const key = k.trim().toLowerCase();
        return key === 'status' || key.includes('trạng thái') || key.includes('trang thai') || key.includes('tình trạng') || key.includes('tinh trang');
      }) || 'status';

      // 2. Tạo ID duy nhất cho Frontend (QUAN TRỌNG: Sửa lỗi hiển thị ảnh ở tất cả các ô)
      // Ưu tiên dùng giá trị từ cột Key tìm được
      const uniqueId = row[idKey] || row._RowNumber || `stage_idx_${index}`;

      return {
        id: uniqueId, 
        appSheetId: row._RowNumber, 
        keyId: row[idKey], // Giá trị Key thực sự để gửi API (Cột id)
        keyColumn: idKey, // Lưu lại tên cột Key tìm được để dùng lúc Update
        imgColumn: finalImgKey, // Lưu lại tên cột Ảnh tìm được để dùng lúc Update
        statusColumn: statusKey, // Lưu lại tên cột Trạng thái để dùng lúc Update
        name: row[nameKey] || row.name || row["Tên công việc"] || row["Hạng mục"] || `Giai đoạn ${index + 1}`, // Fallback nếu không tìm thấy tên
        status: row[statusKey] || row.status || "Chưa bắt đầu",
        ngayBatDau: toSafeDate(row[startKey] || row.ngayBatDau), 
        ngayKetThuc: toSafeDate(row[endKey] || row.ngayKetThuc),
        // Chuyển chuỗi URL (ngăn cách bởi dấu phẩy) thành mảng, làm sạch từng link để hiển thị
        anhNghiemThu: typeof row[finalImgKey] === 'string' 
          ? row[finalImgKey].split(',').map(url => getCleanLink(url.trim())).filter(Boolean).slice(0, 6)
          : (row[finalImgKey] ? [getCleanLink(String(row[finalImgKey]))] : []),
      };
    })
    .sort((a, b) => {
      // Ưu tiên sắp xếp theo thứ tự dòng thực tế trong Google Sheet (_RowNumber)
      // Điều này đảm bảo danh sách hiển thị đúng trình tự kế hoạch xây dựng đã lập trong bảng tính
      return (a.appSheetId || 0) - (b.appSheetId || 0);
    });

    return { success: true, data: transformedData };
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu tiến độ:", error);
    return { success: false, message: error.message, data: [] };
  }
};

/**
 * Cập nhật trạng thái của một giai đoạn
 */
export const updateStageInSheet = async (stage, appId) => {
  try {
    // Kiểm tra Key bắt buộc
    if (stage.keyId === undefined || stage.keyId === null || stage.keyId === "") {
      throw new Error("Dữ liệu dòng này bị thiếu Key (id/TT). Vui lòng kiểm tra lại Google Sheet.");
    }

    // Sử dụng tên cột Key đã tìm thấy lúc Fetch, mặc định là 'id' nếu không có
    const keyColumnName = stage.keyColumn || 'id';
    // Sử dụng tên cột Ảnh đã tìm thấy lúc Fetch, mặc định là 'Ảnh nghiệm thu' nếu không có
    const imgColumnName = stage.imgColumn || 'Ảnh nghiệm thu';
    // Sử dụng tên cột Trạng thái đã tìm thấy lúc Fetch
    const statusColumnName = stage.statusColumn || 'status';

    // Logic xử lý ảnh: Kết hợp ảnh cũ đã có và ảnh mới vừa upload (hinhAnh)
    // Lấy danh sách hiện tại (đã được parse thành mảng ở bước fetch)
    let images = Array.isArray(stage.anhNghiemThu) ? [...stage.anhNghiemThu] : [];
    
    // Nếu có ảnh mới từ Cloudinary, thêm vào danh sách
    if (stage.hinhAnh && typeof stage.hinhAnh === 'string') {
      images.push(stage.hinhAnh);
    }

    // Làm sạch các link (loại bỏ domain rác) và giới hạn tối đa 6 ảnh để tránh cell quá nặng
    const cleanedImages = images.map(url => getCleanLink(url)).filter(Boolean).slice(0, 6).join(',');

    const editData = [{
      [keyColumnName]: String(stage.keyId), // Dùng đúng tên cột Key tìm được (id, ID, TT...)
      [statusColumnName]: stage.status,
      [imgColumnName]: cleanedImages,
    }];

    // Luôn gửi kèm _RowNumber nếu có để AppSheet xác định dòng chính xác tuyệt đối
    if (stage.appSheetId) {
      editData[0]["_RowNumber"] = stage.appSheetId;
    }

    // Log dữ liệu gửi đi để kiểm tra xem có link ảnh chưa
    console.log("Đang gửi cập nhật tiến độ lên AppSheet:", JSON.stringify(editData, null, 2));

    const apiUrl = getApiUrl(appId);

    console.log("Update Stage API URL:", apiUrl);

    // Thêm timeout 20s cho AppSheet request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        Action: "Edit", 
        Properties: {
          Locale: "en-GB", // Thống nhất en-GB (DD/MM) để khớp với Find action ở fetchStages
          Timezone: "Asia/Ho_Chi_Minh",
        }, 
        Rows: editData 
      }), 
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    // Đọc text trước để tránh lỗi "Unexpected end of JSON input" nếu body rỗng
    const responseText = await response.text();
    let responseData = {};
    
    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
        // Kiểm tra xem AppSheet có thực sự cập nhật dòng nào không (nếu API có trả về Rows)
        if (responseData.Rows && responseData.Rows.length === 0) {
          console.error(`Lỗi cập nhật: AppSheet không tìm thấy dòng với Key '${stage.keyId}'.`);
          return { success: false, message: "Không tìm thấy dòng để cập nhật trên AppSheet." };
        }
      } catch (error) {
        console.warn("Lỗi parse JSON từ AppSheet (nhưng request có thể đã thành công):", error);
      }
    }
    return { success: true, message: "Cập nhật trạng thái thành công!" };
  } catch (error) {
    console.error("Lỗi khi cập nhật tiến độ:", error);
    return { success: false, message: error.message };
  }
};