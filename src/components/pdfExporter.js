import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { robotoFont } from './robotoFont.js';
import { getTransactionType, sumTransactionsByType } from "../utils/transactionUtils";

const exportToPDF = (data, title = "Báo cáo thu chi xây nhà") => {
  try {
    if (!data || data.length === 0) {
      alert("Không có dữ liệu để xuất file PDF.");
      return;
    }

    const doc = new jsPDF();
    const fontName = "Roboto";

    // 1. Nhúng font Roboto Unicode hỗ trợ đầy đủ tiếng Việt có dấu
    if (robotoFont) {
      doc.addFileToVFS('Roboto-Regular.ttf', robotoFont);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto', 'normal');
    }

    // 2. Thêm tiêu đề (in đậm, canh giữa) và thông tin ngày xuất
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(title, pageWidth / 2, 15, { align: 'center' });

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleDateString("vi-VN");
    doc.text(`Ngày lập báo cáo: ${dateStr}  |  Tổng số giao dịch: ${data.length}`, pageWidth / 2, 21, { align: 'center' });

    // Khai báo rõ ràng từng ô tiêu đề cột canh giữa và in đậm
    const tableColumn = [
      { content: "STT", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Ngày", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Loại", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Hạng mục", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Nội dung chi tiết", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Người chi", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Số tiền (VNĐ)", styles: { halign: "center", fontStyle: "bold" } },
    ];

    const tableRows = [];
    const totals = sumTransactionsByType(data);

    // 3. Chuẩn bị dữ liệu cho bảng
    data.forEach((item, index) => {
      const amount = Number(item.soTien || item["Số tiền"]) || 0;
      const dateDisplay = item.date || (item.ngay instanceof Date ? item.ngay.toLocaleDateString("vi-VN") : String(item.ngay || "---"));
      const isIncome = getTransactionType(item) === "Thu";
      const hangMuc = isIncome ? "-" : item.doiTuongThuChi || item["Hạng mục"] || "-";
      const noiDung = item.noiDung || item["Nội dung"] || "-";
      const nguoiChi = isIncome ? "-" : item.nguoiCapNhat || item["Người chi"] || item["Người cập nhật"] || "-";

      tableRows.push([
        index + 1,
        dateDisplay,
        getTransactionType(item),
        hangMuc,
        noiDung,
        nguoiChi,
        new Intl.NumberFormat('vi-VN').format(amount),
      ]);
    });

    // 4. Định dạng bảng với font Unicode và màu sắc chuẩn
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [
        ["", "", "", "", "Tổng thu:", "", `${new Intl.NumberFormat('vi-VN').format(totals.Thu)} VNĐ`],
        ["", "", "", "", "Tổng chi:", "", `${new Intl.NumberFormat('vi-VN').format(totals.Chi)} VNĐ`],
      ],
      showFoot: 'lastPage',
      startY: 26,
      styles: { 
        font: fontName, 
        fontStyle: 'normal',
        fontSize: 9,
        cellPadding: 3,
        textColor: [31, 41, 55],
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: { 
        font: fontName, 
        fontStyle: 'bold', 
        fillColor: [45, 142, 43], 
        textColor: [255, 255, 255],
        halign: 'center',
      },
      footStyles: {
        font: fontName,
        fontStyle: 'normal',
        fillColor: [243, 244, 246],
        textColor: [220, 38, 38],
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 24 },
        2: { cellWidth: 18 },
        3: { cellWidth: 28 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 22 },
        6: { cellWidth: 32 },
      },
      didParseCell: (hookData) => {
        // Đảm bảo tuyệt đối 100% tất cả tiêu đề cột ở hàng head đều canh giữa và in đậm
        if (hookData.section === 'head') {
          hookData.cell.styles.halign = 'center';
          hookData.cell.styles.fontStyle = 'bold';
        } else if (hookData.section === 'foot' && hookData.row.index === 0) {
          hookData.cell.styles.textColor = [22, 163, 74];
        } else if (hookData.section === 'body') {
          if (hookData.column.index === 0) {
            hookData.cell.styles.halign = 'center';
          } else if (hookData.column.index === 6) {
            hookData.cell.styles.halign = 'right';
          }
        }
      }
    });

    // 5. Tải file PDF về máy
    doc.save(`bao_cao_thu_chi_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error("Lỗi khi tạo PDF:", error);
    alert("Đã xảy ra lỗi khi tạo file PDF: " + error.message);
  }
};

export default exportToPDF;