# Homework Hub V3

Mô hình: 1 GitHub + 1 Netlify + 1 Firebase.

## Tính năng
- Trang xem bài `/`
- Mọi người có thể đăng nhập Google ở trang xem bài để dùng chuỗi; không đăng nhập vẫn xem bình thường
- Admin `/admin/` đăng nhập bằng Google
- Admin tạo/sửa/xóa môn học (tab)
- Admin tạo/sửa/xóa bài tập
- Ghim/quan trọng + hạn nộp
- Firestore realtime
- Cảnh báo nếu hôm nay chưa có bài mới: hiển thị tối đa 1 lần/ngày trên mỗi trình duyệt
- Hiển thị ngày hiện tại
- Chuỗi truy cập hằng ngày (lưu trên trình duyệt, không cần tài khoản)
- Tìm kiếm, lọc theo môn
- Dark/light mode
- Responsive cho điện thoại/tablet/PC

## Firebase
1. Bật Authentication → Sign-in method → Google.
2. Dán Web config vào `js/firebase-config.js`.
3. Tạo Firestore (Standard, Production).
4. Trong `firebase/firestore.rules`, thay `YOUR_GOOGLE_EMAIL` bằng email Google Admin của bạn rồi publish Rules.
5. Authentication → Settings → Authorized domains: sau này thêm domain Netlify của bạn.

## Lưu ý về chuỗi
Chuỗi chỉ hiển thị cho người đã đăng nhập Google. Hiện chuỗi được lưu theo trình duyệt/thiết bị bằng localStorage; nếu xóa dữ liệu trình duyệt hoặc đổi thiết bị, chuỗi sẽ reset. Có thể nâng cấp sang lưu streak theo UID trên Firestore.
