# Bộ đang sử dụng

Pikachu hiện dùng thiết kế má xanh, đuôi xù theo ảnh mới. Xem [nguồn, prompt và cách build](electric-fluff/README.md). Các tài nguyên bên dưới được giữ làm tư liệu thiết kế cũ.

# Pikachu (Thiết kế lại từ mô hình gốc của người dùng)

Nhân vật Pikachu được thiết kế lại dựa trên ảnh mô hình 3D nguyên bản do người dùng cung cấp: thân vàng tròn trịa, đôi tai dài vút nhọn viền đen ở chóp, hai đốm má đỏ tròn tích điện, mắt đen sáng ngời, miệng cười tươi, chân tay ngắn đáng yêu và chiếc đuôi sấm sét đặc trưng.

## Tài nguyên & Kiến trúc Pipeline

- Ảnh gốc người dùng: `reference.png`
- Bảng nguồn chuyển động (`movement-source.jpg`): 5 hàng các tư thế đứng thở/chớp mắt, chạy bước nhanh, nhảy lấy đà và tiếp đất, thế phòng thủ giơ tay/cuộn đuôi, và tư thế kiệt sức nằm gục.
- Bảng nguồn chiến đấu (`combat-source.jpg`): 5 hàng các tư thế đòn đánh vật lý lao người/quất đuôi sét, tích điện phát sáng ở má và phóng tia sét Thunderbolt, lướt nhanh Volt Tackle với vệt tốc độ, bước lùi né đòn, cúi thấp, trúng đòn choáng váng và tư thế nhảy mừng chiến thắng giơ hai tay.
- Các khung hình đã tách nền sạch sẽ và khử viền trắng: `extracted/`.

## Lệnh tạo Sprite

Chạy lệnh sau để build tự động (hoặc thông qua `npm run assets`):

```bash
node scripts/build-pikachu-assets.mjs
```

Lệnh sinh ra 2 asset runtime vào `apps/frontend/public/assets/`:

1. `pikachu.png`: Chân dung độ phân giải cao 160 × 160 px, nền trong suốt (alpha), căn chỉnh đúng trọng tâm.
2. `pikachu-sheet.png`: Bảng sprite 960 × 2400 px, gồm chuẩn 15 hàng × 6 cột khung hình 160 × 160 px.

## Cấu trúc 15 hàng Animation

1. `idle`: Đứng thở nhịp nhàng, chớp mắt tự nhiên.
2. `run`: Chu kỳ chạy 6 khung hình linh hoạt, tai vẫy đuôi lắc.
3. `jump`: Nhún người lấy đà → bay vút lên đỉnh điểm.
4. `fall`: Thả rơi tự do, quán tính hướng xuống.
5. `land`: Tiếp đất nhún chân giảm chấn và đứng dậy.
6. `attack`: Đòn tấn công vật lý (Quick Attack / Iron Tail) lao tới, xoay đuôi quất mạnh rồi thu về.
7. `cast`: Phóng điện Thunderbolt / Electro Ball: tích điện má đỏ, tụ năng lượng và phóng bộc phát tia sét vàng rực.
8. `dash`: Lướt nhanh Volt Tackle: bứt tốc độ cao với vệt điện quang rồi trượt dừng lại.
9. `backstep`: Nhảy lùi né đòn nhanh nhẹn.
10. `crouch`: Hạ thấp trọng tâm né tránh đòn tầm cao.
11. `guard`: Đưa hai tay thủ trước ngực, vểnh đuôi chắn đỡ.
12. `hit`: Giật mình ngửa ra sau khi trúng sát thương.
13. `knockback`: Bị hất văng trượt lùi trên mặt đất rồi gượng dậy.
14. `faint`: Loạng choạng ngã gục xuống sàn, mắt nhắm lại bất tỉnh.
15. `victory`: Reo hò chiến thắng, nhảy tưng bừng với hai tay giơ cao và nụ cười rạng rỡ.
