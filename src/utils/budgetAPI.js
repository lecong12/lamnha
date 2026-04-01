const APPSHEET_ACCESS_KEY = process.env.REACT_APP_APPSHEET_ACCESS_KEY;
const BUDGET_TABLE_NAME = "NganSach";

const getApiUrl = (appId) => `https://www.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(BUDGET_TABLE_NAME)}/Action`;

export const fetchBudget = async (appId) => {
  try {
    if (!appId) throw new Error("Thiếu App ID.");
    const apiUrl = getApiUrl(appId);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "ApplicationAccessKey": APPSHEET_ACCESS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Action: "Find", Properties: { Locale: "en-US" }, Rows: [] }),
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối AppSheet (Mã lỗi: ${response.status}) khi tải ngân sách.`);
    }

    const responseText = await response.text();
    let rawData = [];
    
    if (responseText && responseText.trim()) {
      try {
        rawData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Lỗi parse JSON Ngân sách:", parseError);
        return { success: false, message: "Dữ liệu Ngân sách rỗng hoặc sai định dạng.", data: [] };
      }
    }

    const transformedData = rawData.map(row => ({
      hangMuc: row['Hạng mục'],
      duKien: parseFloat(String(row['Dự kiến (VNĐ)'] || "0").replace(/[.,]/g, "")) || 0,
      thucTe: parseFloat(String(row['Thực tế chi'] || "0").replace(/[.,]/g, "")) || 0,
      conLai: parseFloat(String(row['Còn lại'] || "0").replace(/[.,]/g, "")) || 0,
      tinhTrang: row['Tình trạng'],
    }));

    return { success: true, data: transformedData };
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu ngân sách:", error);
    return { success: false, message: error.message, data: [] };
  }
};