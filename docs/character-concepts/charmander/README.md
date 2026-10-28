# Charmander (Thiết kế lại từ hình ảnh gốc của người dùng)

Nhân vật Charmander được thiết kế lại hoàn toàn dựa trên hình ảnh nguyên bản do người dùng cung cấp: thân khủng long màu cam ấm áp, bụng và mặt dưới đuôi màu vàng kem nhạt dịu mắt, đôi mắt to tròn màu xanh ngọc lam (turquoise) sáng ngời, nụ cười tươi khoe các răng nanh nhỏ màu trắng, tay ngắn 4 ngón đáng yêu, hai chân vững chắc với 3 móng vuốt sắc nhọn màu trắng, và ngọn lửa sống động luôn bùng cháy rực rỡ ở chóp đuôi.

## Tài nguyên & Kiến trúc Pipeline

- Ảnh gốc người dùng: `reference.png`
- Ảnh đã tách nền giữ nguyên răng nanh trắng và móng vuốt: `charmander-isolated.png`
- Bảng nguồn chuyển động (`movement-source.jpg`): 5 hàng các tư thế đứng thở/chớp mắt/lửa bập bùng, chu kỳ nhảy/tiếp đất, thế phòng thủ giơ vuốt thủ trước ngực, và chuỗi ngã gục kiệt sức nằm sấp với mắt nhắm.
- Bảng nguồn bước đi mượt mà (`walk-source-v4.jpg`): Chu kỳ đi/chạy 2 chân 6 khung hình hoàn chỉnh, tiếp đất vững vàng (grounded), luân phiên chân trái - chân phải nhịp nhàng, độ cao đầu và mắt ổn định tuyệt đối, không bị nảy giật hay bay nhảy đột ngột.
- Bảng nguồn chiến đấu (`combat-source.jpg`): 5 hàng các tư thế đòn cào cắn vật lý (Scratch / Slash) với vệt chém móng vuốt, tụ khí và phun luồng lửa / quả cầu lửa (Ember / Flamethrower), lướt nhanh Flame Charge bao bọc luồng lửa rực cháy, bước lùi né đòn và cúi thấp, trúng đòn choáng váng, và nhảy tưng bừng reo hò chiến thắng với hai tay giơ cao.
- Các khung hình đã tách nền sạch sẽ với antialiasing khử viền trắng: `extracted/`.

## Lệnh tạo Sprite

Chạy lệnh sau để build tự động (hoặc thông qua `npm run assets`):

```bash
node scripts/build-charmander-assets.mjs
```

Lệnh sinh ra 2 asset runtime vào `apps/frontend/public/assets/`:

1. `charmander.png`: Chân dung 2D sắc nét 160 × 160 px, nền trong suốt (alpha), đúng tỷ lệ và căn chỉnh trọng tâm sàn.
2. `charmander-sheet.png`: Bảng sprite 960 × 2400 px, gồm chuẩn 15 hàng × 6 cột khung hình 160 × 160 px.

## Cấu trúc 15 hàng Animation

1. `idle`: Đứng thở nhịp nhàng, chớp mắt tự nhiên, ngọn lửa đuôi bập bùng sống động.
2. `run`: Chu kỳ di chuyển 2 chân tiếp đất trơn tru 6 khung hình (`frameRate: 9` trong `packages/game-data` mang lại nhịp bước tự nhiên ~0.67s/vòng lặp, khi sprint tăng tốc mượt mà):
   - Frame 0: Chân trái bước vươn tới trước, chân phải chống sau.
   - Frame 1: Chuyển trọng tâm qua chân phải, thân thẳng nhịp nhàng.
   - Frame 2: Chân phải bước gót chạm đất, chân trái đẩy lùi sau.
   - Frame 3: Chân phải chạm đất trọn vẹn, chân trái thu về sau.
   - Frame 4: Chuyển trọng tâm qua chân trái, thân thẳng nhịp nhàng.
   - Frame 5: Chân trái bước gót vươn tới trước khép vòng lặp hoàn hảo.
3. `jump`: Nhún người lấy đà → phóng người vút lên không trung → lơ lửng đỉnh điểm.
4. `fall`: Thả rơi tự do trong không trung, quán tính chúc xuống.
5. `land`: Tiếp đất nhún chân giảm chấn và đứng thẳng dậy.
6. `attack`: Đòn tấn công vật lý (Scratch / Slash): lấy đà, lao tới vung vuốt cào sắc bén với vệt chém vuốt cong, thu hồi thế đứng.
7. `cast`: Phóng hỏa Ember / Flamethrower: hít sâu tích tụ năng lượng nhiệt, mở to miệng phun quả cầu lửa và luồng lửa rực cháy về phía trước.
8. `dash`: Lướt nhanh Flame Charge: bứt tốc độ cao với luồng lửa cam bao quanh toàn thân rồi trượt phanh dừng lại.
9. `backstep`: Nhảy lùi né đòn nhanh thoăn thoắt.
10. `crouch`: Cúi thấp sát đất né tránh đòn tầm cao.
11. `guard`: Đưa hai tay và móng vuốt thủ trước ngực che chắn bảo vệ cơ thể.
12. `hit`: Giật mình nhăn mặt ngửa người ra sau khi trúng sát thương.
13. `knockback`: Bị hất văng trượt lùi trên mặt đất rồi gượng dậy lấy lại thăng bằng.
14. `faint`: Choáng váng loạng choạng ngã gục xuống sàn, nằm sấp bất tỉnh, mắt nhắm nghiền và ngọn lửa đuôi thu nhỏ lại.
15. `victory`: Reo hò chiến thắng, nhảy tưng bừng với hai tay giơ cao, nụ cười rạng rỡ và ngọn lửa đuôi bốc cao rực rỡ!
