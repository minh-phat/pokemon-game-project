# Thú điện đuôi sao — thay ngoại hình Pikachu

Tạo bằng công cụ imagegen tích hợp, ngày 2026-10-30, theo ảnh người dùng: tai vàng rất lớn chóp nâu, lông kem, mắt hổ phách, má sét vàng, bờm ngực có hình thoi và đuôi sọc nâu kết thúc bằng ngôi sao bốn cánh. Giữ ID `pikachu`, chỉ số, kỹ năng và dữ liệu lưu hiện có.

## Tài nguyên

- `movement.png`: 8 hàng × 6 tư thế, dùng cho idle, run, jump, fall, land, attack, cast và crouch.
- `hops.png`: 2 hàng × 6 tư thế cho dash và backstep, không có vệt sáng làm dính ô.
- `actions.png`: nguồn trạng thái phòng thủ, trúng đòn, hất lùi, kiệt sức và chiến thắng. Ảnh nguồn có một hàng chiến thắng dư; chỉ dùng hàng đầu.
- `registration.json`: nguồn và vùng cắt của từng ô, tỷ lệ căn khung.
- `../../directions-v1/pikachu.png`: 24 tư thế chạy ở góc bắc, đông bắc, đông nam, nam. Hai hướng phía tây và hai đường chéo phía tây dùng lật ngang theo quy ước engine.
- `preview.html`: xem 15 trạng thái, dừng/phát, lật hướng, đổi tốc độ; dùng trực tiếp PNG runtime.
- `../../../directional-animation-preview.html`: xem bộ di chuyển 8 hướng cùng các thú khác.

Ảnh nguồn giữ alpha do imagegen tạo. Script chỉ cắt, đổi kích thước và đóng gói, không tự vẽ thay thế nhân vật. Tất cả ô được căn chân y=150; độ cao khi nhảy do engine điều khiển.

## Tạo lại và kiểm tra

```sh
node scripts/build-pikachu-assets.mjs
node scripts/build-direction-assets.mjs pikachu
npx vitest run tests/pikachu-animation.test.ts tests/directional-animation.test.ts
node scripts/preview-pikachu.mjs
```

Đầu ra: `apps/frontend/public/assets/pikachu.png` (160×160), `pikachu-sheet.png` (960×2400, 90 ô), `pikachu-directions.png` (960×960, 36 ô gồm idle/run ngang cùng 24 tư thế mới). Manifest đăng ký bộ hướng cho cả đấu trường và thế giới mở. `npm run assets` tạo lại cả hai sheet.

## Bộ prompt đã dùng

Công cụ: imagegen tích hợp; không dùng API/CLI. Ảnh người dùng là tham chiếu nhận diện ban đầu; các lượt sau dùng sprite đã tạo để giữ thiết kế.

- Actions: “Create a production 2D game animation sprite atlas using the USER ATTACHED character reference: cute golden yellow summoned creature, enormous fennec ears with dark brown tips and cream inner fluff, cream face belly and chest ruff with golden diamond emblem, golden lightning cheek markings, round amber eyes, long curved yellow and brown striped slender tail ending in a faceted FOUR POINT GOLD STAR.” Bố cục yêu cầu 6×15, 15 hành động theo thứ tự engine, hướng phải, nền trong suốt, không dùng má xanh hoặc đuôi xù của mẫu cũ.
- Directions: “Use this golden star-tail fennec summoned creature sprite sheet as IDENTITY reference. Generate supplementary game locomotion atlas, true transparent background. EXACTLY 6 columns and 4 rows, 24 separate full body poses, no text no borders no shadow.” Các hàng NORTH nhìn từ sau, NORTHEAST, SOUTHEAST, SOUTH; chạy sáu nhịp mỗi hàng, giữ toàn bộ tai/đuôi trong ô.
- Hops: “A transparent game sprite sheet of this cute golden fennec creature with huge ears, cream chest and star tipped striped tail. 6 columns, 2 rows. Each of 12 isolated characters entirely within own cell with generous empty space. Face right. Top row six consecutive quick forward hopping poses. Bottom row six consecutive playful backward hopping poses while facing right. No effects, no ground, no text, no background. Consistent polished 2D anime art and character proportions. Wide 3:1 canvas.”
- Movement: “Game sprite atlas of this SAME golden fennec star-tail creature. Exactly SIX columns by EIGHT rows, 48 small complete full-body isolated poses. Canvas portrait 3:4 ratio. Each character must be SMALL, centered within its cell occupying only 65 percent of the cell, with generous transparent padding on ALL sides, especially ears and tail. True transparent background, NO glow, NO shadows, NO trails, NO text. All face RIGHT.” Các hàng idle, run, jump, fall, land, attack, cast không hiệu ứng và crouch; giữ tai chóp nâu, lông kem, mắt hổ phách, má vàng, đuôi sọc mảnh chóp sao.

Đây là sprite được AI vẽ lại từ ảnh tham chiếu. Xem trang preview để đánh giá mỹ thuật và độ mượt của chuyển động.
