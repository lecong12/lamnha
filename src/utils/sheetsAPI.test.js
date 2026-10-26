import { addRowToSheet, fetchTableData } from "./sheetsAPI";

const mockResponse = (body) => ({
  ok: true,
  text: async () => JSON.stringify(body),
});

const transaction = {
  id: 7,
  ngay: "2026-10-26",
  loaiThuChi: "Thu",
  noiDung: "Tiền hoàn lại",
  doiTuongThuChi: "Khác",
  soTien: 100000,
  nguoiCapNhat: "Ba",
};

describe("AppSheet transaction type columns", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("does not send a transaction type column absent from the AppSheet schema", async () => {
    global.fetch.mockResolvedValueOnce(
      mockResponse([{ ID: 1, Ngày: "2026-10-25", "Nội dung": "Chi phí" }])
    );
    await fetchTableData("GiaoDich", "app-id");

    const result = await addRowToSheet("GiaoDich", transaction, "app-id");

    expect(result.success).toBe(false);
    expect(result.message).toContain('chưa có cột Loại giao dịch');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("uses the actual AppSheet column name when adding a transaction", async () => {
    global.fetch
      .mockResolvedValueOnce(
        mockResponse([{ ID: 1, "Loại giao dịch": "Chi" }])
      )
      .mockResolvedValueOnce(mockResponse({ Rows: [{ ID: 7 }] }));
    await fetchTableData("GiaoDich", "app-id");

    const result = await addRowToSheet("GiaoDich", transaction, "app-id");
    const requestBody = JSON.parse(global.fetch.mock.calls[1][1].body);

    expect(result.success).toBe(true);
    expect(requestBody.Rows[0]["Loại giao dịch"]).toBe("Thu");
    expect(requestBody.Rows[0]).not.toHaveProperty("loaiThuChi");
  });
});
