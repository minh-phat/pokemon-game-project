# Bulbasaur — thú rừng dây leo

Bộ `thorn-grove-v1/` thay Bulbasaur SVG bằng nhân vật bốn chân xanh ngọc theo ảnh người dùng: mắt xanh, tai nhọn, đốm xanh đậm, nanh/móng trắng, bụi cây và lá lớn trên lưng, dây leo cong. Dùng lại năm bảng **imagegen tích hợp** đã tạo thành công cho cùng mẫu trong hội thoại; đóng gói và nối vào đúng ID `bulbasaur`. Hai lượt tạo bổ sung đòn quất dây leo và guard bị công cụ từ chối; không có ảnh mới thành công từ hai lượt này.

## Tài nguyên

- `thorn-grove-v1/combat.png`: chiến đấu, 6×5.
- `thorn-grove-v1/run.png`: chạy bốn chân, 3×2.
- `thorn-grove-v1/jump.png`: nhảy, 3×2.
- `thorn-grove-v1/reactions.png`: phản ứng và nằm nghỉ, 3×4.
- `thorn-grove-v1/idle-victory.png`: đứng thở và ăn mừng, 3×4.
- `thorn-grove-v1/prompts.json`: bộ prompt gốc và các lượt bổ sung không thành công.
- `thorn-grove-v1/registration.json`: nguồn tư thế, tỷ lệ và vị trí từng khung.
- `thorn-grove-v1/preview.html`: xem 15 động tác, đổi hướng/tốc độ và tạm dừng.
- `thorn-grove-v1/preview.png`: ảnh xem trước.

## Build và kiểm tra

```bash
node scripts/build-bulbasaur-assets.mjs
node scripts/preview-bulbasaur.mjs
```

`npm run assets` cũng gọi builder. Đầu ra runtime:

- `apps/frontend/public/assets/bulbasaur-sheet.png`: 960×2400, 15 hàng × 6 ô, mỗi ô 160×160, alpha thật.
- `apps/frontend/public/assets/bulbasaur.png`: chân dung 160×160, alpha thật.

`ASSETS` dùng hai file PNG này cho chọn nhân vật, đấu trường và thế giới mở. Các SVG cũ chỉ là nguồn legacy. Bộ ảnh và builder của Charmander vẫn độc lập.

Thứ tự hàng: idle, run, jump, fall, land, attack, cast, dash, backstep, crouch, guard, hit, knockback, faint, victory. 90 ô không có nghĩa là 90 hình vẽ độc lập: một số tư thế được giữ hoặc dùng chung cho guard/crouch và hit/knockback. Ba tư thế combat bị dây leo tràn ô được loại khỏi đóng gói; đánh thường dùng lấy đà, húc thân và thu về nguyên vẹn, còn dây leo vươn ra dùng VFX của Vine Whip hiện có.

Builder dò khoảng trong suốt giữa các tư thế, giữ tỷ lệ cố định theo mỗi bảng và căn độ rộng thân xanh ngọc giữa các nguồn có độ phân giải khác nhau. Điểm đặt chân y≈149, có lề để lá/chân không chạm ranh giới ô. Độ cao nhảy do physics điều khiển. Idle/guard/crouch/faint 8 fps, chạy/nhảy 12 fps, tiếp đất 16 fps, các hàng khác 10 fps; sprint và mệt dùng time scale hiện có.

`bulbasaurCastFrame` giữ lấy đà đến hết startup rồi mới ra đòn. Solar Beam không trở về thế đứng trước khi tích lực xong. Pause giữ khung; reduced motion chọn một tư thế tĩnh. Giữ nguyên hệ, chỉ số, bộ chiêu và ID đã lưu của Bulbasaur.

Kiểm tra tự động xác nhận manifest PNG, kích thước/alpha, đủ pixel trong 90 ô, lề và baseline; kiểm tra startup/active/recovery của các chiêu. Script trình duyệt kiểm tra 15 trạng thái, quay trái/phải, pause, nhịp chạy, reduced motion và Solar Beam; chụp từng khung nhảy/rơi hai hướng vào `test-results/bulbasaur/` để kiểm tra hình thể bằng mắt.
