# ForcusLearn — Learning Time Tracker

Ứng dụng web theo dõi thời gian học cá nhân. ForcusLearn giúp bạn bắt đầu nhanh một phiên tập trung, tạm dừng khi cần, phân loại nội dung học và xem lại tiến độ theo ngày hoặc tuần.

## Tính năng MVP

- Timer: bắt đầu, tạm dừng, tiếp tục, hoàn thành và hủy phiên.
- Lưu từng khoảng tập trung (`SessionInterval`) để thời gian pause không bị tính vào duration.
- Khôi phục timer đang chạy/tạm dừng sau khi reload trang.
- Danh mục: tạo, đổi tên, xóa; hỗ trợ **Chưa phân loại**.
- History: lọc, phân trang, sửa thời gian/danh mục và xóa session hoàn thành.
- Dashboard: tổng hôm nay, tuần hiện tại, Daily Goal, phân bổ theo category và 5 session gần nhất.
- Timezone IANA, xử lý session qua nửa đêm và DST.
- Google OAuth với Better Auth; mỗi người dùng chỉ thấy dữ liệu của chính mình.
- Giao diện dark mode responsive, trạng thái loading/error/empty và keyboard-friendly controls.

## Tech stack

| Nhóm | Công nghệ |
| --- | --- |
| App | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, CSS tùy chỉnh, Inter + Playfair Display |
| Database | PostgreSQL trên Neon |
| ORM | Prisma 7 với PostgreSQL driver adapter |
| Authentication | Better Auth + Google OAuth |
| Date/time | Luxon |
| Runtime | Node.js 24 LTS |
| Package manager | pnpm 12.9.1 |

## Yêu cầu trước khi chạy

- Node.js `24.x` (xem [`.nvmrc`](./.nvmrc)).
- Một PostgreSQL database, khuyến nghị Neon.
- pnpm được chạy qua `npx.cmd` nếu máy chưa cài global pnpm.

## Khởi chạy local

### 1. Cài dependencies

```powershell
npx.cmd -y pnpm@12.9.1 install --frozen-lockfile
```

### 2. Tạo file môi trường

Tạo `.env` từ [`.env.example`](./.env.example), sau đó điền connection string PostgreSQL:

```powershell
Copy-Item .env.example .env
```

Cho local development, có thể dùng cùng một direct connection string cho `DATABASE_URL` và `DIRECT_URL`. Với Neon production:

- `DATABASE_URL`: pooled URL cho ứng dụng runtime.
- `DIRECT_URL`: direct/unpooled URL chỉ dùng cho Prisma migrations.

Không commit `.env` hoặc chia sẻ các giá trị secret.

### 3. Tạo schema và development user

```powershell
npx.cmd -y pnpm@12.9.1 run db:deploy
npx.cmd -y pnpm@12.9.1 run db:seed
```

Seed tạo user `dev-user` và vài category mẫu. Khi `DEV_AUTH_BYPASS=true`, ứng dụng dùng user này để phát triển mà chưa cần Google OAuth.

### 4. Chạy ứng dụng

```powershell
npx.cmd -y pnpm@12.9.1 run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Đăng nhập Google

Google OAuth chưa cần thiết để phát triển timer. Khi muốn kiểm thử login thật, đặt các biến sau trong `.env`:

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
BETTER_AUTH_SECRET="chuoi-ngau-nhien-toi-thieu-32-ky-tu"
BETTER_AUTH_URL="http://localhost:3000"
DEV_AUTH_BYPASS="false"
```

Thêm Redirect URI trong Google Cloud Console:

```text
http://localhost:3000/api/auth/callback/google
```

Restart development server sau khi thay đổi `.env`.

## Các lệnh thường dùng

| Lệnh | Mục đích |
| --- | --- |
| `npx.cmd -y pnpm@12.9.1 run dev` | Chạy development server |
| `npx.cmd -y pnpm@12.9.1 run build` | Production build |
| `npx.cmd -y pnpm@12.9.1 run start` | Chạy production build local |
| `npx.cmd -y pnpm@12.9.1 run lint` | Kiểm tra ESLint |
| `npx.cmd -y pnpm@12.9.1 run typecheck` | Kiểm tra TypeScript |
| `npx.cmd -y pnpm@12.9.1 run test` | Chạy unit tests |
| `npx.cmd -y pnpm@12.9.1 run db:generate` | Generate Prisma Client |
| `npx.cmd -y pnpm@12.9.1 run db:migrate` | Tạo/chạy migration cho local development |
| `npx.cmd -y pnpm@12.9.1 run db:deploy` | Áp dụng migration đã commit |
| `npx.cmd -y pnpm@12.9.1 run db:seed` | Seed development user và category |

## Data model tóm tắt

```text
User
 ├── UserSettings       (timezone, daily goal)
 ├── Category           (danh mục riêng theo user)
 └── LearningSession
      └── SessionInterval (mỗi khoảng timer thực sự chạy)
```

Các database constraints quan trọng:

- Mỗi user chỉ có tối đa một session `RUNNING` hoặc `PAUSED`.
- Mỗi session chỉ có tối đa một interval chưa đóng.
- Xóa category đặt `categoryId` của session thành `NULL`, không xóa lịch sử học.
- Daily Goal luôn trong khoảng 1–1.440 phút.

## Cấu trúc chính

```text
src/app/
  actions/                Server Actions cho timer, category, history, settings
  api/auth/[...all]/      Better Auth Route Handler
  categories/             Trang danh mục
  dashboard/              Dashboard và Daily Goal
  history/                Lịch sử học
  page.tsx                Timer chính
src/lib/
  timer-service.ts        Business logic timer và transaction
  history-service.ts      Chỉnh sửa/xóa session hoàn thành
  dashboard-service.ts    Thống kê timezone-aware
prisma/
  schema.prisma           Prisma schema
  migrations/             Migrations SQL đã commit
```

## Kiểm tra chất lượng

Trước khi commit hoặc deploy, chạy:

```powershell
npx.cmd -y pnpm@12.9.1 run typecheck
npx.cmd -y pnpm@12.9.1 run lint
npx.cmd -y pnpm@12.9.1 run test
npx.cmd -y pnpm@12.9.1 run build
```

## Deploy

Production dùng Vercel + Neon. Quy trình và biến môi trường được mô tả tại [DEPLOYMENT.md](./DEPLOYMENT.md).

Các điểm bắt buộc trước khi public:

1. Chạy `db:deploy` với `DIRECT_URL` trên database production.
2. Cấu hình `DATABASE_URL`, `BETTER_AUTH_URL`, Google OAuth secrets và `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` trên Vercel.
3. Đặt `DEV_AUTH_BYPASS=false`.
4. Thêm Google OAuth callback URL của domain production.
5. Smoke test login, timer, reload, History, Dashboard và cô lập dữ liệu giữa hai tài khoản.

## Tài liệu bổ sung

- [PROJECT_REPORT.md](./PROJECT_REPORT.md): báo cáo chi tiết về các phase và tính năng đã triển khai.
- [DEPLOYMENT.md](./DEPLOYMENT.md): checklist deploy Neon, Vercel và Google OAuth.
