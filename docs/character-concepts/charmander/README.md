# Thú lửa sọc đỏ — thay thế hình ảnh Charmander

Bộ đang dùng là `fire-stripe-v2/`, tạo bằng công cụ **image_gen tích hợp** theo thú triệu hồi người dùng gửi: thân cam, hai sừng nhọn, mắt xanh ngọc, bụng kem, sọc đỏ như lửa trên chân/tay/đuôi, lửa nhỏ ở má, móng trắng và đuôi lửa lớn. Giữ ID `charmander` để nhân vật và dữ liệu đã lưu tiếp tục dùng được.

## Nguồn và xem trước

- `fire-stripe-v2/movement.png`: nguồn đứng thở, chạy và tiếp đất. Hai hàng nhảy/rơi cũ có tư thế lỗi và không được dùng nữa.
- `fire-stripe-v2/jump-corrected.png`: chuỗi nhảy riêng, 3 cột × 2 hàng, chọn từ các tư thế một đuôi đã kiểm tra. Dùng thứ tự ngược cho chuỗi rơi.
- `fire-stripe-v2/combat.png`: cào, phun lửa, lướt, né lùi, cúi thấp.
- `fire-stripe-v2/reactions.png`: thủ, trúng đòn, hất lùi, kiệt sức, chiến thắng.
- `fire-stripe-v2/prompts.json`: nguyên văn bộ prompt và công cụ đã dùng.
- `fire-stripe-v2/preview.html`: mở trực tiếp để xem cả 15 động tác, tạm dừng, đổi hướng, đổi tốc độ.
- `fire-stripe-v2/preview.png`: ảnh xem trước toàn bộ.
- `fire-stripe-v2/registration.json`: vị trí và tỷ lệ đóng gói từng khung.

Ảnh AI không có lưới hoàn toàn đều. Script tìm khoảng trong suốt giữa các tư thế trước khi cắt, dùng vùng bụng làm mốc ngang và giữ một tỷ lệ cố định cho mỗi bảng nguồn. Chân đặt ở y≈149; game tự tính độ cao nhảy. Ảnh nguồn ban đầu có tư thế nhảy cuối bị nhân đôi đuôi. Hai lượt sửa bằng imagegen bị bộ lọc công cụ từ chối. Bản sửa hiện tại đóng gói lại các tư thế nguyên vẹn từ sprite đã có, bỏ tư thế tay vươn dài dễ lẫn với đuôi, giữ một đuôi gắn liền với thân và giữ khung ở đỉnh nhảy. Script bỏ hẳn hai hàng nhảy/rơi của nguồn cũ trước khi build; không lấy lại tư thế hai đuôi. Đây là ghép lại khung đã có, không phải ảnh mới do imagegen tạo thành công.

## Runtime

```bash
node scripts/build-charmander-assets.mjs
node scripts/preview-charmander.mjs
```

Script build xuất `apps/frontend/public/assets/charmander-sheet.png` (960×2400, 15 hàng × 6 khung, mỗi khung 160×160) và `charmander.png` (chân dung 160×160), đều có alpha thật. `npm run assets` cũng gọi script này. Các ảnh cũ ngoài `fire-stripe-v2/` được giữ làm lịch sử thiết kế, không dùng để build nhân vật hiện tại.

Thứ tự hàng: idle, run, jump, fall, land, attack, cast, dash, backstep, crouch, guard, hit, knockback, faint, victory.

Nhịp: idle/guard/crouch 8 fps, run/jump 12 fps, land/hit 16 fps, dash 14 fps, faint 8 fps, các hàng còn lại 10 fps. Run được tăng tốc khi sprint theo renderer hiện có. Chiêu tấn công dùng `charmanderCastFrame` để đồng bộ lấy đà → ra đòn → hồi phục với startup/active/recovery; chiêu phun kéo dài giữ miệng mở suốt active. Tạm dừng giữ khung, reduced motion dùng một tư thế tĩnh.
