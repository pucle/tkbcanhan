# Thời khóa biểu cá nhân — bản đồng bộ nhiều thiết bị (Vercel + Neon)

## ⚠️ Việc cần làm trước tiên
Bạn đã dán connection string Neon (kèm mật khẩu) vào một cuộc trò chuyện. Hãy vào Neon Console
→ chọn project → **Reset password** để đổi mật khẩu database, rồi dùng connection string MỚI
cho bước bên dưới. Không commit connection string vào Git dưới bất kỳ hình thức nào.

## Cấu trúc project
```
tkb-app/
├── index.html        (giao diện thời khóa biểu)
├── api/
│   └── schedule.js    (serverless function đọc/ghi dữ liệu vào Neon)
├── package.json
└── README.md
```

## Cách deploy lên Vercel

### Cách 1 — dùng Vercel CLI
```bash
npm i -g vercel
cd tkb-app
vercel
```
Làm theo hướng dẫn trên terminal để tạo project mới.

### Cách 2 — qua GitHub (khuyên dùng)
1. Tạo repo GitHub mới, đẩy toàn bộ thư mục `tkb-app/` lên.
2. Vào https://vercel.com → **Add New Project** → chọn repo vừa tạo.
3. **Trước khi bấm Deploy**, vào mục **Environment Variables**, thêm:
   - Key: `DATABASE_URL`
   - Value: connection string Neon (bản MỚI, sau khi đã reset password)
4. Bấm **Deploy**.

Sau khi deploy xong, bảng `schedule_data` trong Postgres sẽ được tự tạo ngay lần gọi API đầu tiên
(bạn không cần chạy SQL thủ công).

## Cách dùng khi đã deploy
1. Mở trang web trên máy tính lần đầu → sẽ hiện hộp thoại **"Mã đồng bộ thiết bị"**.
2. Nhập một mã bất kỳ (ví dụ `nguyenvana-2026`) hoặc bấm **"Tạo mã ngẫu nhiên"**.
3. Mở trang web trên điện thoại → nhập **đúng mã đó** vào hộp thoại tương tự (bấm nút 🔗 trên
   thanh công cụ nếu muốn đổi/nhập lại mã).
4. Từ đó, thêm/sửa/xóa buổi học trên thiết bị nào cũng sẽ lưu vào Neon và thiết bị kia tải lại
   trang là thấy ngay.

Lưu ý: mã đồng bộ hoạt động như mật khẩu — ai biết mã đều xem/sửa được lịch này, vì bản này
chưa có xác thực đăng nhập. Nếu cần bảo mật chặt hơn (đăng nhập tài khoản), đó sẽ là bước
nâng cấp tiếp theo.
