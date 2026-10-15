# Báo cáo triển khai giao diện Pomodoro

Ngày hoàn thành: 15/10/2026

## Phạm vi thực hiện

- Chuyển giao diện HTML/Tailwind xuất từ Stitch thành JSX tương thích Next.js 16 App Router.
- Giữ nguyên sidebar hiện có của dự án; không thay thế sidebar bằng phiên bản nằm trong HTML Stitch.
- Giữ lại hệ màu Matcha & Sage, kích thước, khoảng cách, bento grid, responsive layout và trạng thái tương tác của thiết kế.
- Thay Material Symbols bằng các biểu tượng tương ứng từ `lucide-react`, đúng với thư viện icon dự án đang sử dụng.

## Cấu trúc Server/Client Component

### Server Component

`src/app/(protected)/pomodoro/page.tsx`

- Xác thực người dùng bằng `getCurrentUser()`.
- Chuyển hướng về `/login` khi chưa đăng nhập.
- Tải phiên học đang hoạt động bằng `getActiveSession()`.
- Tải mục tiêu và tổng thời gian học hôm nay bằng `getTimerSummary()`.
- Chuyển dữ liệu đã serialize sang Client Component.
- Khai báo metadata riêng cho trang Pomodoro.
- Sử dụng `force-dynamic` để dữ liệu phiên học luôn được lấy theo request.

### Client Component

`src/components/pomodoro-workspace.tsx`

- Quản lý đồng hồ đếm ngược và bốn chế độ: học tập, nghỉ ngắn, nghỉ dài, tùy biến.
- Hiển thị vòng tiến trình SVG và tiến độ chu kỳ Pomodoro.
- Quản lý checklist nhiệm vụ, nhiệm vụ đang tập trung và trạng thái hoàn thành.
- Quản lý cấu hình thời lượng, chu kỳ nghỉ dài và tự động chuyển giai đoạn.
- Quản lý lựa chọn soundscape, âm lượng và loại chuông báo.
- Hỗ trợ phím tắt Space, N và R.
- Hỗ trợ Zen mode thông qua shared app shell.
- Hỗ trợ Document Picture-in-Picture khi trình duyệt cung cấp API.
- Tách các phần lặp thành `CycleProgress`, `TaskPanel`, `RangeSetting` và `SoundPanel`.

## Server Actions đã tích hợp

Các action hiện có trong `src/app/actions/timer.ts` được tái sử dụng trực tiếp:

- `startSession`: bắt đầu phiên Pomodoro và lưu tên nhiệm vụ vào ghi chú phiên.
- `pauseSession`: tạm dừng phiên đang chạy.
- `resumeSession`: tiếp tục phiên đã tạm dừng.
- `finishSession`: hoàn thành và lưu phiên học.
- `cancelSession`: hủy phiên chưa muốn lưu.
- `saveSessionNote`: đổi nhiệm vụ của phiên đang hoạt động.

Sau khi hoàn thành phiên, action timer hiện revalidate thêm `/pomodoro` để dữ liệu trang, dashboard, lịch sử và danh mục đồng bộ với nhau.

## State và lưu trữ

- Phiên học và thời gian học thực tế được lưu qua database bằng Server Actions hiện có.
- Tên nhiệm vụ đang tập trung được lưu trong trường `note` của phiên học.
- Nhiệm vụ, số Pomodoro hoàn thành, cấu hình và lựa chọn âm thanh được lưu theo tài khoản trong database bằng `PomodoroTask`, `PomodoroFocus` và `PomodoroPreferences`.
- Phiên Pomodoro dùng chung cơ chế phiên học hiện có; bắt đầu phiên và ghi metadata Pomodoro được thực hiện trong cùng transaction. Chỉ lượt đạt thời lượng mục tiêu mới tăng số Pomodoro hoàn thành.
- Trạng thái giờ nghỉ không ảnh hưởng dữ liệu học tập và chỉ lưu tạm trên trình duyệt, với khóa riêng cho từng tài khoản và thời điểm kết thúc tuyệt đối để tránh lệch giờ khi tab ngủ.
- Âm thanh nền và chuông được tổng hợp bằng Web Audio API, không tải tài nguyên bên ngoài. Trình duyệt cần một tương tác của người dùng trước khi phát âm thanh.
- Migration `20261015000000_pomodoro` chỉ tạo bảng mới. Migration đã được áp dụng lên Neon `neondb` trong `.env` ngày 15/10/2026 và `prisma migrate status` xác nhận schema mới nhất. Nếu triển khai với database khác, cần áp dụng migration trên database đó. Không tự nhập nhiệm vụ từ localStorage cũ vì dữ liệu đó chưa có thông tin chủ sở hữu tài khoản.

## Tailwind và theme

`src/app/globals.css` được bổ sung các semantic token còn thiếu từ thiết kế Stitch:

- Màu `on-primary`, `on-primary-container`, `on-secondary-container`, `tertiary`, `outline`.
- Font token `headline-md`, `label-sm`, `body-lg`.
- Cỡ chữ và line-height tương ứng cho `headline-md` và `label-sm`.

Không dùng Tailwind CDN và không nhúng Google Fonts từ HTML Stitch. Trang sử dụng pipeline Tailwind và font variables có sẵn của dự án.

## Thay đổi app shell

- Cho phép Zen mode hoạt động tại cả `/` và `/pomodoro`.
- Khi Zen mode được bật ở Pomodoro, shared sidebar/header được ẩn bằng logic shell hiện có.
- Không thay đổi class giao diện hoặc cấu trúc hiển thị của sidebar.

## Kiểm thử

Đã thêm `src/components/pomodoro-workspace.test.tsx` để kiểm tra:

- Tạo nhiệm vụ qua Server Action và gửi ID nhiệm vụ vào phiên Pomodoro.
- Tạm dừng phiên Pomodoro qua `pauseSession`.
- Phục hồi giờ nghỉ theo thời điểm kết thúc, tách trạng thái giờ nghỉ giữa các tài khoản và bảo vệ nội dung cửa sổ nổi khỏi HTML injection.

Kết quả xác minh cuối cùng:

- ESLint: đạt.
- TypeScript/Next type generation: đạt.
- Vitest: 13 test files, 49 tests đều đạt ở lần kiểm tra gần nhất, gồm kiểm tra từ chối lượt chưa đủ giờ, cộng lượt cho nhiệm vụ đúng một lần và tính thời lượng nhiệm vụ theo cấu hình.
- Production build: đạt; route `/pomodoro` được build thành dynamic route.
- `git diff --check`: đạt, không có lỗi whitespace.
- Neon smoke test: đọc ba bảng mới và tạo/đọc dữ liệu thử trong transaction thành công; transaction được rollback, không còn dữ liệu thử.

## Ghi chú QA

Môi trường thực thi không cung cấp kết nối Computer Use tới cửa sổ Windows, nên không thể thực hiện screenshot comparison hoặc thử trực tiếp trên phiên đăng nhập trong trình duyệt. Production compilation, responsive Tailwind classes và các luồng tương tác chính đã được kiểm tra bằng lint, typecheck, test tự động và database smoke test rollback. Vẫn cần QA thủ công trên tài khoản thật: tạo nhiệm vụ, bắt đầu/tạm dừng/tiếp tục/hoàn thành phiên, tải lại trang, kiểm tra dashboard và tài khoản thứ hai.

## Đồng bộ Timer/Pomodoro (15/10/2026)

- Service kiểm tra đúng loại phiên (`timer` hoặc `pomodoro`) cho pause, resume, finish, note, cancel và đổi danh mục. Timer bị khóa khi Pomodoro đang hoạt động và ngược lại.
- Pomodoro có action pause/resume/cancel/kết thúc sớm riêng. Kết thúc sớm vẫn lưu thời gian học nhưng không đặt `PomodoroFocus.completedAt`.
- `PomodoroTask` có `plannedDate`, `categoryId` tùy chọn và `archivedAt`; xóa nhiệm vụ là lưu trữ mềm. Các migration `20261016000000_pomodoro_task_planning` và `20261017000000_backfill_pomodoro_planned_dates` đã được áp dụng vào Neon và database báo up-to-date.
- Tiến độ nhiệm vụ được suy ra từ các `PomodoroFocus` đã hoàn thành theo ngày đang chọn; không có nhiệm vụ sẽ hiển thị “Chưa lập kế hoạch” thay vì mục tiêu giả `0/5`. Tổng phút học vẫn dùng chung Timer + Pomodoro.
- Chỉnh sửa lịch sử sẽ đồng bộ trạng thái hoàn thành Pomodoro, và các trang liên quan được revalidate sau mutation.
