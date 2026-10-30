# Pikachu — thú điện đuôi xù

Bộ sprite thay thế theo ảnh người dùng gửi: thân vàng, bụng kem, tai dài viền nâu, má xanh có gai sét và đuôi vàng xù lớn. Tạo bằng công cụ imagegen tích hợp, ngày 2026-10-30.

`source.png` là ảnh nguồn có alpha. Script `scripts/build-pikachu-assets.mjs` tách các hàng/cột theo khoảng trong suốt, căn chân tại y=150 và đảo hướng sang phải theo quy ước engine. Không thay đổi chỉ số hay kỹ năng Pikachu.

Chạy `node scripts/build-pikachu-assets.mjs` để tạo lại:
- `apps/frontend/public/assets/pikachu-sheet.png`: 960 × 2400, 15 trạng thái × 6 khung hình.
- `apps/frontend/public/assets/pikachu.png`: chân dung 160 × 160.

Thứ tự hàng: idle, run, jump, fall, land, attack, cast, dash, backstep, crouch, guard, hit, knockback, faint, victory.

Đây là các tư thế được AI vẽ lại theo ảnh tham chiếu, không phải biến dạng trực tiếp ảnh gốc. Các hiệu ứng điện quanh viền là một phần ảnh nguồn; animation chưa được duyệt trực tiếp trong trận đấu.

## Prompt tạo ảnh

Use case: identity-preserve. Input image 1 is the character identity reference. Create a production game sprite sheet of exactly this cute golden electric creature, keeping its large brown-lined pointed ears, round golden body, cream belly, cyan glowing cheeks with dark blue lightning spikes, and enormous fluffy golden lightning tail. Clean 2D hand-drawn game art matching the reference. True transparent background. Exact regular grid: 6 columns and 15 rows, every cell square, canvas aspect ratio 2:5 (ideally 960x2400). Each cell contains one complete character, consistent scale and foot baseline, generous transparent padding, no cell borders, no text. Character faces left in three-quarter side view for side-scroller, tail to the right. Six consecutive animation frames in each row. Row order top to bottom: 1 idle breathing and blink; 2 running cycle; 3 jump takeoff to airborne; 4 falling; 5 landing squash and recovery; 6 melee attack lunge and tail strike; 7 electric cast charge and discharge with cyan sparks; 8 dash forward; 9 backstep dodge; 10 crouching; 11 guarding with paws; 12 hit flinch; 13 knockback tumble; 14 faint collapse ending lying down eyes closed; 15 victory happy bounce. Preserve identity in every cell. All 90 distinct full-body poses must fit entirely within their cells, no overlaps. No ground shadows or background. This will replace an existing Pikachu animation sheet.
