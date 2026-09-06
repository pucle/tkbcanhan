// /lib/mailer.js
// Gửi email bằng Gmail SMTP qua Nodemailer.
// Cần 2 biến môi trường trong Vercel Project Settings:
//   EMAIL_USER = địa chỉ Gmail của bạn, vd: banthantkb@gmail.com
//   EMAIL_PASS = "Mật khẩu ứng dụng" (App Password) của Gmail — KHÔNG phải mật khẩu Gmail thường.
//
// Cách lấy App Password (bắt buộc phải bật Xác minh 2 bước cho Gmail trước):
//   1. Vào myaccount.google.com/security
//   2. Bật "Xác minh 2 bước" nếu chưa bật
//   3. Vào myaccount.google.com/apppasswords
//   4. Tạo app password mới (chọn "Mail" / "Other"), Google sẽ cho ra 1 chuỗi 16 ký tự
//   5. Dán chuỗi đó vào EMAIL_PASS trên Vercel (không có dấu cách)

const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendTestEmail(toEmail) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"TKB Cá Nhân" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Email thử — Thông báo lịch học',
    html: `
      <div style="font-family:sans-serif;line-height:1.5;">
        <h2>✅ Cấu hình email thành công!</h2>
        <p>Đây là email thử từ ứng dụng Thời khóa biểu cá nhân.</p>
        <p>Nếu bạn nhận được email này, hệ thống thông báo lịch học hằng ngày đã sẵn sàng hoạt động.</p>
      </div>
    `,
  });
}

async function sendDailyScheduleEmail(toEmail, dateLabel, events) {
  const transporter = getTransporter();
  const rows = events.length
    ? events
        .sort((a, b) => a.start.localeCompare(b.start))
        .map(
          (e) => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.start}-${e.end}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.room || ''}</td>
          </tr>`
        )
        .join('')
    : `<tr><td style="padding:6px 10px;">Hôm nay bạn không có lịch học nào.</td></tr>`;

  await transporter.sendMail({
    from: `"TKB Cá Nhân" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Lịch học hôm nay (${dateLabel})`,
    html: `
      <div style="font-family:sans-serif;line-height:1.5;">
        <h2>📅 Lịch học ${dateLabel}</h2>
        <table style="border-collapse:collapse;width:100%;max-width:480px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Giờ</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Môn học</th>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">Phòng</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  });
}

module.exports = { sendTestEmail, sendDailyScheduleEmail };