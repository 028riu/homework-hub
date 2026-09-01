# Homework Hub

Mô hình: GitHub Pages + Firebase Authentication + Cloud Firestore.

## Tính năng

- Trang xem bài `/`
- Đăng nhập Google để lưu Streak, XP, Points, tiến độ và Pet theo UID
- Admin `/admin/`
- Admin quản lý môn học, bài tập và người dùng
- Mỗi bài có thể có nhiều link, mỗi link là một ô riêng
- Trang View có Xem trước, Mở link và Download cho từng link
- Firestore realtime + fallback refresh
- Dark/Light + màu chủ đạo + background
- Điều hướng Home / Bài / Pet / Profile
- Flamey có cảm xúc, năng lượng, thân thiết và kho trang bị
- Click món Pet đã mở để trang bị; skin hiện tại được lưu theo tài khoản
- Lịch quản trị và cài đặt XP/Points/thông báo

## Firebase

1. Bật Authentication → Google.
2. Đặt Web config trong `js/firebase-config.js`.
3. Tạo Firestore.
4. Publish `firebase/firestore.rules`.
5. Authorized Domains cần có domain GitHub Pages của bạn.

## Lưu ý

Firebase Storage không được dùng trong phiên bản này. File upload đã được bỏ để giữ kiến trúc miễn phí; bài tập dùng link URL.
