# Homework Hub — Tài liệu tổng hợp dự án

> Cập nhật theo mã nguồn nhánh `main` ngày 24/10/2026. Đây là tài liệu chính thức duy nhất thay thế README cũ và bốn tệp TXT hướng dẫn/bản cập nhật. Mô tả **tính năng có mã nguồn**; không đồng nghĩa mọi chức năng đã được kiểm thử đầu cuối hoặc Firebase Rules trên Console đã được Publish.

## Thông báo nâng cấp 24/10/2026 — phát một lần

Phiên bản này có **một thông báo tổng hợp duy nhất chỉ trên trang học sinh `index.html`**, không hiển thị trên Admin, bảng tin hoặc View BME và không phát lại mỗi khi chuyển trang hoặc tải lại. Mã thông báo `hh_upgrade_20261024` được lưu trong `localStorage` sau khi người dùng đóng/xác nhận; nếu trình duyệt chặn lưu trữ thì có thể hiện lại. Không ghi trạng thái vào Firebase, không gửi thông báo đẩy, không phát lặp theo ngày. Triển khai: `js/upgrade-announcement.js`, `css/upgrade-announcement.css` chỉ được nạp bởi trang học sinh `index.html`; các trang Admin, bảng tin và View BME không nạp thông báo.

**Nội dung nâng cấp:**

- Thiết kế thống nhất cho bốn trang qua `css/site-refresh.css`; thanh điều hướng mới trên trang học sinh qua `css/navigation-2026.css`, có menu điện thoại và đồng bộ tab.
- Hồ sơ và Flamey: giao diện đáp ứng màn hình nhỏ, hộp thoại có vùng cuộn riêng, thống kê/thành tựu và tủ trang bị hiển thị đầy đủ (`css/profile-pet-2026.css`). Đã sửa lỗi biến `s` khiến Hồ sơ không mở.
- Bảng tin: hỗ trợ nội dung HTML hợp lệ, tìm kiếm/lọc sự kiện, hiển thị thông báo và link an toàn; View BME có giao diện đọc nội dung rõ hơn.
- Offline-first: `js/offline-db.js` bật bộ nhớ đệm Firestore IndexedDB đa tab cho các trang đọc dữ liệu; `sw.js` lưu vỏ website và tài nguyên đã tải, `js/offline-shell.js` hiển thị trạng thái mất mạng. Khi có kết nối, trình duyệt yêu cầu dữ liệu/tài nguyên mới và listener Firestore đồng bộ trở lại. Cần truy cập online trước để có dữ liệu lưu; ngoại tuyến không bảo đảm mọi thao tác ghi, xác thực mới, tài nguyên bên ngoài hoặc trang chưa từng tải.
- Service Worker chuyển từ cache-first cũ sang ưu tiên mạng, fallback cache khi mất kết nối; tăng phiên bản URL của tài nguyên thay đổi.
- Giữ nguyên Firebase project và dữ liệu; không khôi phục tính năng chat đã bỏ.

**Kiểm tra sau triển khai:** mở mỗi trang khi online để cache tài nguyên và dữ liệu, thử ngắt mạng rồi tải lại và đọc bản đã lưu, nối mạng để kiểm tra đồng bộ; kiểm tra đăng nhập, Hồ sơ/Pet, Admin, BME, bảng tin và quyền Firestore. Các thay đổi đã được đẩy lên Git, không đồng nghĩa đã kiểm thử đầu cuối trên mọi trình duyệt.

## 1. Truy cập và kiến trúc

- Repository: https://github.com/028riu/homework-hub
- Trang học sinh: https://028riu.github.io/homework-hub/
- Admin: https://028riu.github.io/homework-hub/admin/
- Bảng tin lớp: https://028riu.github.io/homework-hub/schedule.html
- View BME: https://028riu.github.io/homework-hub/view-bme/
- Frontend: HTML/CSS/JavaScript ES modules, GitHub Pages; Firebase JS SDK 12.1.0; Google Authentication; Cloud Firestore. `sw.js` cung cấp offline shell và cache tài nguyên; `manifest.json` và icon nằm ở gốc.
- Firebase project: `homeworkhuba5`. Cấu hình frontend tại `js/firebase-config.js`; còn `firebase-config.js` ở gốc là bản khác cùng dự án. Firebase Web API key không phải mật khẩu; không đưa service-account/private key vào Git.
- Không cần Netlify cho bản frontend GitHub Pages hiện tại. Tài liệu cũ nhắc Netlify/ZIP chỉ là lịch sử.

## 2. Trang học sinh (`index.html`, `js/viewer.js`)

- Xem danh sách bài tập cập nhật realtime, tìm kiếm, lọc theo môn/tab, hiển thị hạn nộp, ghim và mức quan trọng.
- Bài tập có nội dung HTML định dạng được lọc an toàn bởi `js/rich-content.js`; hỗ trợ kiểu màu thẻ và hiệu ứng rainbow cho bài quan trọng.
- Google login, hồ sơ theo UID, theo dõi hoàn thành bài tập, XP, level, Points, Streak, thành tích/phần thưởng và Pet; các dữ liệu người dùng cần quyền Firestore tương ứng.
- Bảng xếp hạng Streak (`js/leaderboard.js`), hiện diện/online (`presence`), giao diện cài đặt cá nhân, dark/light, accent/background, bật/tắt Pet, tìm nhanh/Ctrl+K (`js/ui-elements.js`).
- Cảnh báo bài tập chưa cập nhật, thông báo trực tiếp do Admin phát và thu hồi; cấu hình ở `settings`.
- Thanh điều hướng có mục **Sự kiện**. Banner **Sự kiện & thông báo lớp** được đặt ngay đầu nội dung trang chủ, dẫn tới `schedule.html`.
- `js/class-schedule.js` vẫn còn được nạp để hiển thị khối nội dung lớp kiểu thời khóa biểu cũ trên trang chủ; cần phân biệt với bảng tin sự kiện mới.

## 3. Bảng tin sự kiện (`schedule.html`)

- Giao diện sáng, bố cục thẻ kiểu bảng ghim/Padlet, tương thích màn hình nhỏ; dành cho học sinh đọc, không cho học sinh sửa.
- Các loại: Thông báo, Sự kiện, Dặn dò; tìm kiếm, lọc, ghim thông báo quan trọng lên đầu.
- Thẻ hỗ trợ tiêu đề, nội dung định dạng, ngày giờ sự kiện, địa điểm, link tài liệu, trạng thái xuất bản.
- Tiêu đề hero có 15 cặp câu luân phiên sau mỗi 30 giây.
- `js/class-board.js` chỉ hiển thị bản ghi `class_schedule` có `kind: "class_event"` và `published !== false`. Các bản ghi thời khóa biểu cũ không bị xóa khỏi Firestore chỉ vì trang này đã đổi chức năng.

## 4. Admin Control Center (`admin/index.html`)

Đăng nhập Google và kiểm tra danh sách email Admin ở `js/admin.js`; **bảo vệ dữ liệu thật sự phải do Firebase Rules thực thi**, không chỉ dựa vào giao diện.

Các khu vực đang có trong giao diện:
- **Tổng quan:** thống kê người dùng, bài tập, hoạt động, XP, bài đã hoàn thành, Points; bài gần đây và xếp hạng.
- **Người dùng:** tìm/lọc/sắp xếp, xem và chỉnh hồ sơ, tên, Streak, XP, Points, Pet, inventory và các trường tiến độ; thao tác thưởng/quản lý.
- **Bài tập:** tạo, sửa, xóa, chọn nhiều, ghim/bỏ ghim, tiêu đề, môn (có thể không chọn), hạn nộp, màu thẻ, mức quan trọng, nội dung định dạng và nhiều đường dẫn.
- **Môn học:** tạo/sửa/xóa tab/môn.
- **View BME:** quản lý bài tập dành riêng cho phụ huynh, độc lập collection `bme_homework`; tiêu đề, môn, nội dung, hạn và nhiều link.
- **Nội dung lớp:** tạo/sửa/xóa thông báo/sự kiện/dặn dò; thời gian, địa điểm, link, ghim quan trọng, xuất bản hoặc lưu nháp. Đồng bộ bảng tin học sinh.
- **Lịch:** duyệt theo tháng, xem bài tập theo ngày.
- **Công cụ:** thống kê, bảng xếp hạng, xuất Users CSV và Homework CSV.
- **Cài đặt:** cấu hình website trong `settings/site`; thông báo trực tiếp qua `settings/directNotification`, có nút phát và thu hồi.
- **Nâng cao / Admin Studio:** nhật ký thao tác, thùng rác, bản nháp, phân tích, thông báo, mẫu bài, nhân bản, quá hạn, lọc nâng cao, sao lưu (`js/admin-advanced.js`). Một số công cụ phụ thuộc quyền collection tương ứng.

Admin giữ giao diện tối; bảng tin học sinh giữ giao diện sáng. Các lớp CSS bổ sung ở `css/admin-dark-fix.css`, `css/class-board.css`, `css/events-home.css`.

### Trình soạn thảo

- Bài tập học sinh có trình soạn thảo riêng trong `js/admin.js` và `css/rich-editor.css`.
- Thông báo sự kiện và bài BME dùng trình soạn thảo chung `js/shared-editor.js` + `css/shared-editor.css`.
- Các thao tác gồm in đậm, in nghiêng, gạch chân/gạch ngang, danh sách, tiêu đề, bảng, xóa định dạng, undo/redo; HTML được lọc theo allowlist trong `js/rich-content.js` khi lưu/hiển thị.
- Bản ghi cũ dạng text được xử lý riêng bằng cờ `bodyFormat`/`contentFormat` khi có. Không coi HTML thô là nội dung an toàn.

## 5. View BME (`view-bme/`)

Trang riêng dành cho phụ huynh, đọc `bme_homework` và `subjects`; tìm kiếm, lọc nội dung, hiển thị môn, hạn nộp, nội dung định dạng an toàn, nhiều link với thao tác xem trước/mở liên kết. Có mã tương thích hiển thị thời khóa biểu lớp cũ. Không đồng nhất dữ liệu BME với bài tập học sinh.

## 6. Dữ liệu Firestore và quyền

| Collection / document | Vai trò |
|---|---|
| `users/{uid}` và các subcollection | Hồ sơ, tiến độ, thành tích, inventory, settings cá nhân |
| `presence/{uid}` | Hiện diện trực tuyến |
| `subjects/{id}` | Môn học/tab |
| `homework/{id}` | Bài tập học sinh |
| `bme_homework/{id}` | Bài tập phụ huynh |
| `class_schedule/{id}` | Dữ liệu lớp; bảng tin mới phân biệt bằng `kind: class_event` |
| `settings/site` | Cài đặt chung |
| `settings/directNotification` | Thông báo trực tiếp |
| `admin_audit/{id}` | Nhật ký Admin |
| `admin_trash/{id}` | Thùng rác |
| `admin_drafts/{id}` | Bản nháp công cụ nâng cao |
| `admin_templates/{id}` | Mẫu |
| `admin_notices/{id}` | Thông báo công cụ nâng cao |
| `achievements`, `items`, `pets`, `themes` | Danh mục tính năng gamification |

Nguồn rules trong Git: `firebase/firestore.rules` và `firebase/storage.rules` (nếu sử dụng Storage). Quy tắc hiện có cho các collection nội dung: đọc công khai, ghi bởi Admin; dữ liệu người dùng yêu cầu xác thực và kiểm tra UID/Admin. **Đẩy rules lên GitHub KHÔNG tự động triển khai sang Firebase**: phải kiểm tra và Publish tại Firebase Console. Không mở `allow write: if true` để chữa lỗi permission. Các rules lịch sử khác có thể vẫn nằm trong file; không có nghĩa giao diện tương ứng đang được sử dụng.

## 7. File quan trọng và trách nhiệm

| Đường dẫn | Chức năng |
|---|---|
| `index.html`, `js/viewer.js` | Trang học sinh |
| `admin/index.html`, `js/admin.js` | Admin chính |
| `js/admin-advanced.js`, `js/admin-tools.js`, `js/admin-control.js` | Công cụ quản trị |
| `js/notification-admin.js`, `js/direct-notice-revoke-fix.js` | Phát/thu hồi thông báo |
| `schedule.html`, `js/class-board.js`, `js/schedule-admin.js` | Bảng tin sự kiện và phần đăng bài |
| `js/class-schedule.js`, `js/schedule-page.js`, `css/class-schedule.css` | Mã thời khóa biểu cũ/tương thích; chưa tự ý xóa |
| `view-bme/index.html`, `view-bme/view-bme.js` | Trang phụ huynh |
| `js/rich-content.js`, `js/shared-editor.js` | Làm sạch HTML và trình soạn thảo dùng chung |
| `js/leaderboard.js`, `js/ui-elements.js` | Xếp hạng và tiện ích UI |
| `css/style.css`, các tệp `css/*.css` | Giao diện nền và lớp mở rộng |
| `sw.js`, `js/offline-db.js`, `js/offline-shell.js` | Offline shell, IndexedDB persistence và trạng thái kết nối |
| `firebase/firestore.rules` | Mẫu rules Firestore cần Publish riêng |

**Lưu ý:** còn `admin.js` ở thư mục gốc là bản lịch sử; trang `admin/index.html` thực tế nạp `../js/admin.js`. Không chỉnh nhầm file. Tương tự, không xóa các file JS/CSS cũ chỉ vì tên gọi cũ: trước hết phải rà soát tham chiếu và phụ thuộc.

## 8. Tệp đính kèm và lịch sử cập nhật

Các tài liệu TXT cũ từng mô tả việc chọn/upload file tối đa 50 MB qua Firebase Storage, lưu `attachments[]`, hỗ trợ trường legacy `linkUrl/fileUrl/fileName/fileType`, xem trước và tải xuống. Đây là **mô tả của bản cập nhật lịch sử**, không phải cam kết chức năng upload hiện đang hoạt động trong `js/admin.js` của trang Admin hiện tại: mã Admin đang nạp chủ yếu quản lý nhiều link. Không xóa Storage rules/dữ liệu chỉ dựa trên việc UI hiện tại không dùng tính năng đó. Nếu khôi phục upload, cần kiểm tra code, Storage bucket, Storage Rules, giới hạn file và hành vi xem trước.

Lịch sử sửa lỗi: đã có cập nhật đăng nhập Google/Admin allowlist, BME riêng, thông báo, bảng tin lớp, trình soạn thảo, giao diện tối Admin và nút Sự kiện trên đầu trang chủ. Lịch sử chi tiết vẫn được Git lưu trong các commit.

## 9. Cài đặt, triển khai và bảo trì

1. GitHub Pages xuất bản từ repository/nhánh đã cấu hình; frontend chạy trực tiếp trên Pages, không cần build framework.
2. Bật Google Authentication và thêm domain GitHub Pages vào Authorized domains của Firebase Auth.
3. Đối chiếu `js/firebase-config.js` với Firebase project.
4. Đối chiếu allowlist Admin trong frontend với `firebase/firestore.rules` và (nếu có upload) `firebase/storage.rules`; Publish rules trong Console.
5. Khi sửa JS/CSS, cập nhật version query trên HTML và kiểm tra service worker/cache. Nếu trang cũ còn lưu, thử Ctrl+Shift+R.
6. Kiểm thử trên máy tính và điện thoại: login/logout, xem/tạo/sửa/xóa bài, phân quyền Admin, BME, đăng/ẩn/xóa sự kiện, HTML định dạng, thông báo trực tiếp, Firestore permission, PWA/cache.
7. Lỗi `Missing or insufficient permissions` cần kiểm tra Rules thực tế trên Console, email/UID và collection; HTTP 200 của Firestore transport không chứng minh thao tác ghi thành công.

## 10. Quy tắc phát triển tiếp

- Giữ nguyên dữ liệu người dùng và chức năng đang hoạt động; thay đổi nhỏ, có kiểm tra tương thích.
- Không đưa chức năng đã ngừng sử dụng trở lại giao diện nếu chưa có yêu cầu.
- Dùng `js/rich-content.js` để lọc HTML do người dùng nhập.
- Không tin kiểm tra quyền chỉ bằng JavaScript frontend.
- README này là tài liệu duy nhất; khi thêm/sửa tính năng, cập nhật trực tiếp mục liên quan thay vì tạo thêm TXT ghi đè hoặc README trùng lặp.
