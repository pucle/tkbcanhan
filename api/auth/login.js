// /api/auth/login.js
// Serverless function (chạy trên Vercel) — đăng nhập bằng username + mật khẩu.

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
    const rows = await sql`SELECT id, username, password_hash FROM users WHERE username = ${uname}`;

    // Cố tình trả cùng một thông báo dù sai username hay sai mật khẩu,
    // để tránh lộ thông tin username nào tồn tại trong hệ thống.
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    return res.status(200).json({ token, username: user.username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
  }
};