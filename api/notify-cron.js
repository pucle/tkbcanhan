// /api/notify-cron.js
// Serverless function (Vercel) — được Vercel Cron gọi tự động mỗi ngày (cấu hình trong vercel.json).
// Quét tất cả user có settings.notify.enabled = true, kiểm tra hôm nay có lịch học không,
// rồi gửi email tóm tắt tới địa chỉ họ đã lưu.
//
// LƯU Ý: Vercel Cron chỉ gọi được 1 lần/ngày ở giờ cố định trên gói Hobby (free).
// Vì mỗi user có thể chọn giờ gửi khác nhau (n_time trong modal), cron này nên chạy mỗi giờ
// (hoặc gần nhất có thể) và chỉ gửi cho user nào có "giờ gửi" khớp với giờ hiện tại.
// Trên gói Hobby free, Vercel Cron tối đa 1 lần/ngày — nếu cần chạy nhiều lần/giờ,
// cần nâng lên gói Pro, hoặc dùng dịch vụ cron ngoài (vd cron-job.org) gọi vào URL này mỗi giờ.

const { neon } = require('@neondatabase/serverless');
const { sendDailyScheduleEmail } = require('../lib/mailer');

const TIMEZONE = 'Asia/Bangkok';
const DAY_LABELS_VI = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

function nowInTZ() {
  const s = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  return new Date(s);
}
function currentHHMM(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// Thứ trong tuần theo quy ước app: 2=Thứ2 ... 7=Thứ7 (JS: 0=CN,1=T2,...6=T7)
function weekdayCode(d) {
  const jsDay = d.getDay();
  return jsDay === 0 ? 8 : jsDay + 1; // Chủ nhật (0) -> 8, không có lịch học nên sẽ không khớp gì
}

module.exports = async (req, res) => {
  // Bảo vệ endpoint: chỉ Vercel Cron (hoặc bạn tự gọi kèm secret) mới chạy được,
  // tránh người lạ gọi URL này để spam gửi email hàng loạt.
  const authHeader = req.headers.authorization || '';
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Không có quyền chạy cron này' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server chưa cấu hình DATABASE_URL' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const now = nowInTZ();
  const nowHHMM = currentHHMM(now);
  const todayCode = weekdayCode(now);
  const dateLabel = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const rows = await sql`SELECT user_id, data FROM schedule_data`;

    let sentCount = 0;
    const errors = [];

    for (const row of rows) {
      const data = row.data || {};
      const notify = (data.settings && data.settings.notify) || {};
      if (!notify.enabled || !notify.email) continue;

      // Chỉ gửi khi giờ hiện tại (làm tròn phút) khớp giờ user đã chọn.
      // Vì cron chạy theo lịch cố định (vd mỗi giờ), so khớp theo "giờ:phút" đơn giản này
      // chỉ chính xác nếu cron được gọi đúng phút đó — xem ghi chú vercel.json bên dưới.
      if (notify.time !== nowHHMM) continue;

      // Tìm buổi học hôm nay: cần tính đúng "tuần thứ mấy" theo weekOneDate đã lưu.
      // Đơn giản hoá: duyệt qua customEvents + overrides, coi các buổi học đã lưu
      // là nguồn dữ liệu, lọc theo day trùng todayCode và có mặt trong danh sách weeks
      // của tuần hiện tại (tính lại từ settings.weekOneDate).
      const weekOneDate = notify_weekOneDate(data.settings);
      const weekNum = weekOneDate ? currentWeekNumber(weekOneDate, now) : null;

      const allEvents = [...(data.customEvents || [])];
      // overrides: { [builtinId]: eventObjOrNull } — vì app không còn dữ liệu mẫu mặc định
      // (EVENTS = []), override chỉ còn ý nghĩa nếu bạn tự thêm dữ liệu mẫu sau này.
      const subjects = data.customSubjects || {};

      const todaysEvents = allEvents
        .filter((e) => e.day === todayCode && (weekNum === null || (e.weeks || []).includes(weekNum)))
        .map((e) => ({
          start: e.start,
          end: e.end,
          room: e.room,
          name: (subjects[e.hp] && subjects[e.hp].name) || e.hp,
        }));

      if (notify.onlyIfClasses !== false && todaysEvents.length === 0) continue;

      try {
        await sendDailyScheduleEmail(notify.email, dateLabel, todaysEvents);
        sentCount++;
      } catch (err) {
        errors.push({ userId: row.user_id, error: err.message });
      }
    }

    return res.status(200).json({ ok: true, sentCount, errors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi chạy cron: ' + err.message });
  }
};

function notify_weekOneDate(settings) {
  if (!settings || !settings.weekOneDate) return null;
  const [y, m, d] = settings.weekOneDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function currentWeekNumber(weekOneDate, now) {
  const a = new Date(weekOneDate.getFullYear(), weekOneDate.getMonth(), weekOneDate.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((b - a) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}