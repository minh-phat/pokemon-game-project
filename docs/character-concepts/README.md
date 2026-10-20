# Runedrake — nguồn hình hành động

Các bảng này là thiết kế tư thế dựa trên nhân vật người dùng cung cấp. Đọc từng bảng từ trái sang phải, hàng trên rồi hàng dưới.

| Bảng                                | Vị trí | Hành động trong game | Ý đồ hình dáng                         |
| ----------------------------------- | ------ | -------------------- | -------------------------------------- |
| `rune-dragon-movement-concept.png`  | 1      | `idle`               | Lượn nhẹ, thân cong chữ S              |
|                                     | 2      | `run`                | Thân duỗi dài, uốn sóng tiến tới       |
|                                     | 3      | `jump`               | Đầu ngẩng, thân vút lên                |
|                                     | 4      | `fall`               | Đầu hạ xuống, đuôi theo sau            |
|                                     | 5      | `land`               | Thân nén thấp khi chạm đất             |
|                                     | 6      | `dash`               | Duỗi thẳng, tạo dáng lao nhanh         |
|                                     | 7      | `backstep`           | Co thân, lùi khỏi đối thủ              |
| `rune-dragon-reactions-concept.png` | 1      | `crouch`             | Cuộn mình sát đất                      |
|                                     | 2      | `guard`              | Nâng vòng thân che đầu                 |
|                                     | 3      | `hit`                | Thân gập khi trúng đòn                 |
|                                     | 4      | `knockback`          | Bật lùi, thân kéo dài                  |
|                                     | 5      | `faint`              | Gục xuống, lửa yếu đi                  |
|                                     | 6      | `victory`            | Vươn đầu lên, lửa sáng hơn             |
| `rune-dragon-tail-whip-concept.png` | 1–6    | `attack`             | Cuộn đuôi, lấy đà, quất tới rồi thu về |

Hai bảng đầu lưu lại thiết kế gốc. Bảng `rune-dragon-tail-whip-concept.png` được tạo bằng imagegen từ hình gốc để có sáu tư thế quất đuôi cùng phong cách pixel art. `rune-dragon-reactions-cutout.png` là bản tách nền dùng để dựng sprite. Chạy `node scripts/build-runedrake-assets.mjs` để tạo `runedrake.png` và `runedrake-sheet.png` trong thư mục asset của game. Sprite sheet có 15 hàng × 6 khung, mỗi khung 320 × 160 px để đuôi có chỗ vươn tới tầm trung. Hàng `attack` dùng trực tiếp sáu tư thế riêng, thể hiện đuôi gắn liền với thân vòng xuống rồi quất tới trước, không dùng hiệu ứng đuôi rời. Đòn thường Tail Whip có tầm trung 160 đơn vị. Hàng `cast` dùng chuyển động thân chung cho các chiêu lửa.

Trong trận, Runedrake bay cao 44 px so với mặt sàn và lơ lửng nhẹ ở mọi hành động thông thường. Khi ngất hoặc bị choáng, hình hạ dần xuống đất; khi hết choáng, hình bay lên lại. Đây là độ cao hiển thị, không đổi vùng va chạm hay cân bằng chiến đấu.
