# Báo cáo triển khai — Learning Time Tracker

Ngày cập nhật: 07/10/2026

## 1. Mục tiêu đã thực hiện

Learning Time Tracker là ứng dụng web theo dõi thời gian học cá nhân. Người dùng có thể bắt đầu một phiên học, tạm dừng, tiếp tục, hoàn thành và xem lại thời gian tập trung theo danh mục.

Toàn bộ Phase 0 đến Phase 5 của MVP đã được triển khai trong codebase. Dự án đã qua TypeScript, ESLint, 8 unit test và production build của Next.js.

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Frontend / Backend | Next.js 16 App Router, React 19, TypeScript | Giao diện, Server Components, Server Actions và API Route |
| Giao diện | Tailwind CSS, CSS tùy chỉnh, Lucide | Responsive UI và icon |
| Database | PostgreSQL (Neon) | Lưu tài khoản, session học, category và settings |
| ORM | Prisma 7 với PostgreSQL driver adapter | Schema, migrations và truy vấn database |
| Authentication | Better Auth + Google OAuth | Đăng nhập Google, session database |
| Date / timezone | Luxon | Tính tổng thời lượng theo timezone, qua nửa đêm và DST |
| Package manager | pnpm 12.9.1 | Quản lý dependencies |
| Runtime mục tiêu | Node.js 24 LTS | Môi trường production |

## 3. Các tính năng đang có

### 3.1. Timer học

- **Học ngay** tạo một phiên học mới, có thể bắt đầu mà không chọn danh mục.
- **Tạm dừng** đóng interval đang chạy; khoảng thời gian pause không được tính.
- **Tiếp tục** tạo một interval mới cho cùng session.
- **Kết thúc** đóng interval mở, cộng tổng thời lượng thực học và lưu session ở trạng thái hoàn thành.
- **Hủy** xóa session đang hoạt động sau khi người dùng xác nhận.
- Timer dùng timestamp từ server và khôi phục chính xác sau reload trang.
- Phiên chạy quá 8 giờ hiển thị cảnh báo, nhưng không tự động kết thúc.
- Database chặn một người dùng có nhiều hơn một session active hoặc một session có nhiều interval mở, kể cả khi click nhanh/gửi request đồng thời.

### 3.2. Danh mục học

- Tạo, đổi tên và xóa danh mục.
- Tên được trim, chuẩn hóa khoảng trắng, giới hạn 1–50 ký tự và không được trùng trong cùng tài khoản.
- Có thể chọn category trước khi start hoặc đổi category trong khi timer đang chạy/tạm dừng.
- Session không có category được hiển thị là **Chưa phân loại**.
- Xóa category không xóa session cũ; các session đó tự chuyển sang **Chưa phân loại**.

### 3.3. Lịch sử học

- Hiển thị session hoàn thành mới nhất trước.
- Lọc theo ngày bắt đầu và danh mục.
- Phân trang khi có nhiều session.
- Sửa thời điểm bắt đầu, kết thúc và danh mục của session hoàn thành.
- Khi đổi thời gian, hệ thống chỉ dịch đầu interval đầu tiên và cuối interval cuối cùng, nhờ vậy vẫn giữ nguyên các khoảng pause ở giữa.
- Chặn thời gian ở tương lai, khoảng không hợp lệ, session không thuộc tài khoản hiện tại và session bị chồng thời gian với session khác.
- Xóa session có hộp xác nhận.

### 3.4. Dashboard và Daily Goal

- Tổng thời gian đã hoàn thành trong hôm nay.
- Tổng thời gian đã hoàn thành từ thứ Hai đến hiện tại.
- Daily Goal mặc định 120 phút; người dùng có thể đặt từ 1 đến 1.440 phút.
- Thanh tiến độ dừng ở 100%, đồng thời vẫn hiển thị tổng thời gian thực tế khi vượt mục tiêu.
- Phân bổ thời lượng tuần hiện tại theo category, bao gồm nhóm **Chưa phân loại**.
- Danh sách 5 session hoàn thành gần nhất.
- Người dùng có thể đặt IANA timezone, ví dụ `Asia/Bangkok`, `Asia/Ho_Chi_Minh` hoặc `America/New_York`.
- Interval qua nửa đêm được chia vào đúng ngày địa phương. Logic được kiểm thử cho cả midnight và DST.

### 3.5. Đăng nhập và cô lập dữ liệu

- Better Auth được chuẩn bị với Google OAuth và database session.
- Các Server Actions tự lấy user từ session server-side; client không được truyền `userId`.
- Mọi truy vấn session/category kiểm tra ownership theo user hiện tại.
- Trong development, `DEV_AUTH_BYPASS=true` dùng `dev-user` từ seed để phát triển nhanh.
- Trong production, bypass tự bị vô hiệu hóa và hệ thống fail closed nếu Google Auth chưa được cấu hình.

## 4. Dữ liệu và tính đúng đắn

Các bảng chính:

| Bảng | Nội dung |
| --- | --- |
| `users`, `sessions`, `accounts`, `verifications` | Do Better Auth sử dụng |
| `user_settings` | Timezone và Daily Goal |
| `categories` | Danh mục riêng của mỗi user |
| `learning_sessions` | Phiên học, trạng thái và tổng duration |
| `session_intervals` | Các khoảng timer thực sự chạy |

Các ràng buộc quan trọng đã có trong migration:

- Partial unique index: tối đa một session `RUNNING` hoặc `PAUSED` cho mỗi user.
- Partial unique index: tối đa một interval chưa đóng cho mỗi session.
- Foreign key `ON DELETE SET NULL` từ session đến category.
- Check constraint cho duration dương, thứ tự timestamp và Daily Goal 1–1.440 phút.
- Những mutation timer nhạy cảm chạy trong serializable transaction có retry giới hạn khi database xảy ra write conflict.

## 5. Trải nghiệm và hardening

- Responsive cho mobile và desktop.
- Nút mutation bị khóa trong lúc request đang chạy.
- Có trạng thái loading, empty state, lỗi nghiệp vụ tiếng Việt và retry cho lỗi render không mong muốn.
- Có trang 404 và global error fallback.
- Hỗ trợ keyboard navigation bằng native controls, focus state và giảm animation khi người dùng bật `prefers-reduced-motion`.
- Có headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Logging server có cấu trúc; các key nhạy cảm như cookie, token, secret và connection string được che trước khi log.

## 6. Cấu trúc thư mục quan trọng

```text
src/app/
  actions/              Server Actions: timer, category, history, settings
  api/auth/[...all]/    Route Handler của Better Auth
  categories/           Trang quản lý danh mục
  dashboard/            Trang dashboard
  history/              Trang lịch sử học
  page.tsx              Trang timer chính
src/lib/
  timer-service.ts      Nghiệp vụ timer và transaction
  history-service.ts    Nghiệp vụ History/edit/delete
  dashboard-service.ts  Thống kê timezone-aware
  auth.ts               Better Auth + Google OAuth
prisma/
  schema.prisma         Prisma schema
  migrations/           SQL migrations đã commit
```

## 7. Cách chạy local

1. Cài Node.js 24 LTS (xem `.nvmrc`) và cài dependencies:

   ```powershell
   npx.cmd -y pnpm@12.9.1 install --frozen-lockfile
   ```

2. Tạo `.env` từ `.env.example`, sau đó điền `DATABASE_URL` và `DIRECT_URL`.

3. Chạy migrations và seed development user:

   ```powershell
   npx.cmd -y pnpm@12.9.1 exec prisma migrate deploy
   npx.cmd -y pnpm@12.9.1 run db:seed
   ```

4. Chạy ứng dụng:

   ```powershell
   npx.cmd -y pnpm@12.9.1 dev
   ```

5. Mở `http://localhost:3000`.

## 8. Kiểm tra chất lượng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma schema validation | Đạt |
| TypeScript | Đạt |
| ESLint | Đạt |
| Unit tests | 8/8 đạt |
| Next.js production build | Đạt |

Vitest hiện chỉ phát cảnh báo cấu hình ESM/CommonJS trong `vitest.config.ts`; không có test nào thất bại.

## 9. Những bước cần làm trước khi public

Code đã sẵn sàng để deploy, nhưng các thao tác sau cần quyền vào tài khoản của chủ dự án:

1. Tạo Google OAuth Client và thêm callback production.
2. Thêm Google credentials, Better Auth secret, runtime pooled `DATABASE_URL` và `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` trên Vercel.
3. Đặt `DEV_AUTH_BYPASS=false` ở Vercel.
4. Chạy migration bằng direct Neon URL trước deploy.
5. Deploy Vercel và thực hiện smoke test Google login, timer, reload, History, Dashboard, timezone và kiểm tra cô lập dữ liệu giữa hai tài khoản.

Hướng dẫn đầy đủ có trong [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## 10. Ngoài phạm vi MVP

Các tính năng sau chưa được triển khai theo đúng phạm vi đã chốt:

- Pomodoro, Calendar và Streak.
- Tạo session thủ công.
- Biểu đồ/analytics nâng cao.
- Email/password login.
- Notifications, đa ngôn ngữ và lịch sử thay đổi Daily Goal.

