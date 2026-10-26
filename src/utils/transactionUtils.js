export const getTransactionType = (transaction) => {
  const rawType = transaction?.loaiThuChi || transaction?.["Loại thu chi"] || "Chi";
  const normalizedType = String(rawType)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim()
    .toLowerCase();

  return normalizedType.includes("thu") && !normalizedType.includes("chi")
    ? "Thu"
    : "Chi";
};

export const sumTransactionsByType = (transactions = []) =>
  transactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction?.soTien ?? transaction?.["Số tiền"]) || 0;
      totals[getTransactionType(transaction)] += amount;
      return totals;
    },
    { Thu: 0, Chi: 0 }
  );
