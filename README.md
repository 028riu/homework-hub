# Homework Hub — rebuilt

## Có gì trong bản này
- Google Login + Firebase realtime.
- Tick bài tập: cộng XP + Points; bỏ tick hoàn tác phần thưởng của chính bài đó.
- Daily bonus khi hoàn thành toàn bộ bài được tạo trong ngày.
- Streak/Level/XP/Points.
- Pet nổi có thể kéo thả; chạm/click Pet để mở tủ đồ.
- Shop Pet: mua phụ kiện bằng Points, mua một lần và mặc lại miễn phí.
- Settings gọn hơn: Dark/Light/System, 6 accent, 4 background, bật/tắt Floating Pet.
- Avatar trên header dùng kích thước nhỏ, không còn phóng đại.
- Admin: overview, users, homework, subjects, calendar, settings.
- Firestore rules có kiểm tra admin và giới hạn các field user được tự sửa.

## Deploy GitHub Pages
Repository dùng thư mục gốc làm source. Với repo `homework-hub`, URL mặc định là:
`https://028riu.github.io/homework-hub/`

## Firebase
- Authentication → Sign-in method → bật Google.
- Authentication → Settings → Authorized domains: thêm `028riu.github.io` và domain riêng nếu có.
- Firestore → Rules: dùng `firebase/firestore.rules`.
- Firestore → tạo `settings/site` nếu muốn thay giá trị mặc định.
- Firestore → `items` có thể thêm item với: `name`, `description`, `price`, `emoji`, `petSkin`.

## Kiểm thử
Trước khi đóng gói, các file JavaScript được kiểm tra syntax bằng Node.js. Sau đó kiểm tra cấu trúc HTML, đường dẫn script/css, Firestore rules và các handler chính trong viewer/admin.

Lưu ý: vì đây là frontend Firebase thuần, mọi phần thưởng kinh tế phía client vẫn cần Cloud Functions/App Check nếu muốn chống gian lận ở mức sản phẩm production.
