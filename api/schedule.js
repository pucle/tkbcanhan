// /api/schedule.js
// Serverless function (chạy trên Vercel) — đọc/ghi dữ liệu thời khóa biểu vào Neon Postgres.
// Connection string được lấy từ biến môi trường DATABASE_URL (đặt trong Vercel Project Settings),
// KHÔNG bao giờ được nhúng trực tiếp vào code hay gửi về trình duyệt.

const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server chưa cấu hình DATABASE_URL' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Tạo bảng nếu chưa có (chạy an toàn nhiều lần)
    await sql`
      CREATE TABLE IF NOT EXISTS schedule_data (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    if (req.method === 'GET') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Thiếu mã đồng bộ (id)' });

      const rows = await sql`SELECT data FROM schedule_data WHERE id = ${id}`;
      if (rows.length === 0) return res.status(200).json({ data: null });
      return res.status(200).json({ data: rows[0].data });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, data } = body || {};
      if (!id || !data) return res.status(400).json({ error: 'Thiếu id hoặc data' });

      await sql`
        INSERT INTO schedule_data (id, data, updated_at)
        VALUES (${id}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi truy vấn database' });
  }
};
