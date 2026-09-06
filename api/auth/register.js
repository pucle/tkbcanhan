// /api/auth/register.js
// Serverless function (chạy trên Vercel) — đăng ký tài khoản bằng username + mật khẩu.
// Mật khẩu được băm bằng bcrypt trước khi lưu vào Neon — KHÔNG BAO GIỜ lưu plaintext.
// Cần biến môi trường: DATABASE_URL, JWT_SECRET (đặt trong Vercel Project Settings, không nhúng vào code).

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server chưa cấu hình DATABASE_URL' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server chưa cấu hình JWT_SECRET' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Tạo bảng nếu chưa có (chạy an toàn nhiều lần)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { username, password } = body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });
    }

    const uname = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,32}$/.test(uname)) {
      return res.status(400).json({ error: 'Tên đăng nhập 3-32 ký tự, chỉ gồm chữ thường, số, dấu . hoặc _' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const existing = await sql`SELECT id FROM users WHERE username = ${uname}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    }

    // 10 salt rounds là mức hợp lý cho serverless (cân bằng bảo mật / thời gian chờ)
    const passwordHash = await bcrypt.hash(password, 10);

    const rows = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${uname}, ${passwordHash})
      RETURNING id, username
    `;
    const user = rows[0];

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    return res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
  }
};