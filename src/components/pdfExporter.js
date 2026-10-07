import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { robotoFont } from './robotoFont.js';

const exportToPDF = (data, title = "Báo cáo chi tiêu xây nhà") => {
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

    // 2. Thêm tiêu đề và thông tin ngày xuất
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleDateString("vi-VN");
    doc.text(`Ngày lập báo cáo: ${dateStr}  |  Tổng số giao dịch: ${data.length}`, 14, 21);

    const tableColumn = ["STT", "Ngày", "Hạng mục", "Nội dung chi tiết", "Người chi", "Số tiền (VNĐ)"];
    const tableRows = [];
    let totalChi = 0;

    // 3. Chuẩn bị dữ liệu cho bảng
    data.forEach((item, index) => {
      const amount = Number(item.soTien || item["Số tiền"]) || 0;
      totalChi += amount;

      const dateDisplay = item.date || (item.ngay instanceof Date ? item.ngay.toLocaleDateString("vi-VN") : String(item.ngay || "---"));
      const hangMuc = item.doiTuongThuChi || item["Hạng mục"] || "-";
      const noiDung = item.noiDung || item["Nội dung"] || "-";
      const nguoiChi = item.nguoiCapNhat || item["Người chi"] || item["Người cập nhật"] || "-";

      tableRows.push([
        index + 1,
        dateDisplay,
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
      foot: [["", "", "", "Tổng cộng chi tiêu:", "", `${new Intl.NumberFormat('vi-VN').format(totalChi)} VNĐ`]],
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
        fontStyle: 'normal', 
        fillColor: [45, 142, 43], 
        textColor: [255, 255, 255],
        halign: 'left',
      },
      footStyles: {
        font: fontName,
        fontStyle: 'normal',
        fillColor: [243, 244, 246],
        textColor: [220, 38, 38],
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22 },
        5: { halign: 'right', cellWidth: 32 },
      }
    });

    // 5. Tải file PDF về máy
    doc.save(`bao_cao_chi_tieu_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error("Lỗi khi tạo PDF:", error);
    alert("Đã xảy ra lỗi khi tạo file PDF: " + error.message);
  }
};

export default exportToPDF;