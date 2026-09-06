// /api/schedule.js
// Serverless function (chạy trên Vercel) — đọc/ghi dữ liệu thời khóa biểu vào Neon Postgres.
// Thay vì "mã đồng bộ" dùng chung, mỗi request phải kèm JWT trong header
// Authorization: Bearer <token> (nhận được từ /api/auth/login hoặc /api/auth/register).
// Connection string lấy từ biến môi trường DATABASE_URL, JWT ký/xác minh bằng JWT_SECRET —
// cả hai đặt trong Vercel Project Settings, KHÔNG bao giờ nhúng vào code hay gửi về trình duyệt.

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

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
    await sql`
      CREATE TABLE IF NOT EXISTS schedule_data (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM schedule_data WHERE user_id = ${userId}`;
      if (rows.length === 0) return res.status(200).json({ data: null });
      return res.status(200).json({ data: rows[0].data });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { data } = body || {};
      if (!data) return res.status(400).json({ error: 'Thiếu data' });

      await sql`
        INSERT INTO schedule_data (user_id, data, updated_at)
        VALUES (${userId}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (user_id) DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi truy vấn database' });
  }
};