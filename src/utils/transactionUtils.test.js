import { getTransactionType, sumTransactionsByType } from "./transactionUtils";

describe("transaction type utilities", () => {
  test("recognizes income and defaults legacy records to expenses", () => {
    expect(getTransactionType({ loaiThuChi: "Thu" })).toBe("Thu");
    expect(getTransactionType({ "Loại thu chi": "Thu vào" })).toBe("Thu");
    expect(getTransactionType({ loaiThuChi: "Chi" })).toBe("Chi");
    expect(getTransactionType({})).toBe("Chi");
  });

  test("totals income and expenses separately", () => {
    expect(
      sumTransactionsByType([
        { loaiThuChi: "Thu", soTien: 1000 },
        { loaiThuChi: "Chi", soTien: 250 },
        { soTien: 50 },
      ])
    ).toEqual({ Thu: 1000, Chi: 300 });
  });
});
