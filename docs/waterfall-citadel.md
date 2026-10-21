# Waterfall Citadel

Bản đồ `ruins` dùng trực tiếp ảnh người dùng lưu tại
`apps/frontend/public/assets/ruins-map.png` (1942 × 810). File gốc được giữ nguyên.
Sân rộng 2400 đơn vị; cả hai chiều cùng nhân với 2400/1942, không kéo méo ảnh.
Ảnh chọn bản đồ cũng dùng chính PNG này. Không vẽ sân, đá hoặc tường vector đè lên ảnh.

## Căn tọa độ theo ảnh

`packages/game-data/src/ruins.ts` ghi tọa độ pixel gốc. Công thức đổi sang mô phỏng:
`x = pixelX × scale`, `depth = pixelY × scale − 520`.

| Thành phần | Vị trí trong ảnh | Xử lý |
| --- | --- | --- |
| Bệ đỏ / xanh | Tâm x = 120 / 1820, y = 395 | Hai vùng xuất hiện; đường nối vào sân đi được |
| Bốn cụm đá | Hai cụm trên, hai cụm dưới | Chặn ở vùng chân đá |
| Hai cột tròn | x ≈ 547 / 1395, chân y ≈ 425 | Chặn thân Pokémon và chiêu |
| Tường L phía trên | x ≈ 972–1073, chân y ≈ 236–293 | Hai nhánh va chạm riêng |
| Tường L phía dưới | x ≈ 878–978, chân y ≈ 532–590 | Hai nhánh va chạm riêng |
| Tường bao và nước ngoài sân | Biên sân và các góc | Chặn ra ngoài, giữ lối đi của hai bệ |
| Huy hiệu giữa sân, đất, cỏ | Phần trống trong sân | Đi được |

Các vùng chân đá/cột/tường dùng va chạm chữ nhật. Phần hình nổi được lấy từ chính
texture PNG, giới hạn theo đường viền từng vật cản và sắp lớp theo chân vật cản.
Pokémon đi phía sau bị che; đi phía trước hiển thị phía trước. Không sửa pixel ảnh gốc.
Cây, thác, cờ và lửa trong ảnh hiện là hình tĩnh.

## Di chuyển và camera

Chọn tối đa 4 Pokémon mỗi đội và “Active at once: 4” để đấu 4v4. Các vị trí xuất hiện
được giãn theo kích thước bệ trong ảnh. Vật cản chặn cả nhảy, lướt và đẩy lùi; đạn
kiểm tra toàn đoạn di chuyển, tia dừng ở vật cản đầu tiên. AI tìm đường vòng có tính
bán kính thân Pokémon. Chưa có phá tường hoặc vượt tường bằng độ cao.

Cuộn chuột hoặc bấm +/− để zoom. Bấm Pokémon sống hoặc chọn trong “Theo dõi Pokémon”.
Mặc định ảnh phủ kín màn hình, giữ tỉ lệ; các phần ngoài khung nhìn được cắt.
“Lấp đầy” trở lại chế độ này. “Toàn sân” thu nhỏ để hiển thị toàn ảnh (có thể có khoảng trống). Khi Pokémon bị hạ hoặc rời sân, camera
trở lại toàn sân. Nút camera dùng được trên điện thoại.

Kiểm thử: `tests/terrain.test.ts`, `tests/assets.test.ts`, `tests/e2e/ruins.spec.ts`.
