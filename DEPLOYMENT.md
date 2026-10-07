# Deploy production

## 1. Chuẩn bị Neon

Tạo hai chuỗi kết nối PostgreSQL cho cùng một database:

- `DATABASE_URL`: pooled runtime URL, dùng bởi ứng dụng Vercel.
- `DIRECT_URL`: direct/unpooled URL, chỉ dùng khi chạy Prisma migration.

Không đưa `DIRECT_URL` vào client hoặc log. Trước lần deploy đầu tiên, từ máy có quyền truy cập database, chạy:

```powershell
npx.cmd -y pnpm@12.9.1 exec prisma migrate deploy
```

Lệnh này là bước deploy riêng; không dùng `prisma db push` cho production.

## 2. Biến môi trường trên Vercel

Thiết lập cho môi trường Production:

```text
DATABASE_URL=<pooled Neon URL>
BETTER_AUTH_URL=https://<ten-mien-cua-ban>
BETTER_AUTH_SECRET=<random secret, at least 32 characters>
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<stable random secret, at least 32 bytes>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
DEV_AUTH_BYPASS=false
LOG_LEVEL=info
```

`DIRECT_URL` không cần có ở Vercel runtime nếu migrations đã chạy riêng. Không commit `.env`.

## 3. Google OAuth

Trong Google Cloud Console, thêm Redirect URI chính xác:

```text
https://<ten-mien-cua-ban>/api/auth/callback/google
```

Thêm URI localhost riêng cho development:

```text
http://localhost:3000/api/auth/callback/google
```

## 4. Deploy và smoke test

1. Import repository vào Vercel; framework preset là Next.js.
2. Đặt Node.js 24 theo `.nvmrc` và cài dependencies với lockfile.
3. Deploy sau khi migration thành công.
4. Smoke test ở production: Google login, start/pause/resume/finish, reload timer, sửa/xóa History, thay Daily Goal, và kiểm tra một tài khoản khác không thấy dữ liệu của tài khoản đầu.

Nếu có nhiều instance hoặc rolling deploy, giữ nguyên `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` giữa các lần deploy để Server Actions đang mở có thể phục hồi bằng refresh.
