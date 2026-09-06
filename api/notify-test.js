// /api/notify-test.js
// Serverless function (Vercel) — gửi 1 email thử tới địa chỉ người dùng nhập trong modal "Thông báo".
// Frontend gọi: POST /api/notify-test  { email }  kèm header Authorization: Bearer <token>
// Cần biến môi trường: JWT_SECRET (đã có), EMAIL_USER, EMAIL_PASS (xem hướng dẫn trong lib/mailer.js)

const jwt = require('jsonwebtoken');
const { sendTestEmail } = require('../lib/mailer');

function getUserId(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId;
  } catch {
    return null; // token sai, giả mạo, hoặc đã hết hạn
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server chưa cấu hình JWT_SECRET' });
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ error: 'Server chưa cấu hình EMAIL_USER / EMAIL_PASS' });
  }

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email } = body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Địa chỉ email không hợp lệ' });
    }

    await sendTestEmail(email);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    // Lỗi hay gặp nhất: EMAIL_USER/EMAIL_PASS sai, hoặc chưa bật App Password đúng cách
    return res.status(500).json({ error: 'Gửi email thất bại: ' + (err.message || 'lỗi không xác định') });
  }
};