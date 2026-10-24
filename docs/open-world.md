# Thế giới mở

Vào **Chơi Ngay → Thế giới mở**. Đây là chế độ khám phá chơi đơn, chạy trong trình duyệt và hỗ trợ khách.

- **WASD / phím mũi tên**: di chuyển theo hướng màn hình; **Shift**: chạy.
- **Space**: nhảy; **giữ E + hướng di chuyển**: leo lên/xuống vách. Điện thoại dùng nút **Nhảy** và giữ **Leo** đồng thời với cần điều khiển.
- Chạm hoặc bấm mặt đất để tìm đường đi bộ ở gần, có xét độ cao. Điện thoại có cần điều khiển và nút chạy.
- **M**: bản đồ lục địa; **J**: nhật ký; **Esc**: tạm dừng.
- Bản đồ lớn có các điểm dịch chuyển tới từng môi trường, kèm khoảng cách bằng km. Bản đồ nhỏ hiển thị khu vực 192 × 192 m quanh người chơi và thước 50 m.
- Nhân vật tự dùng thuyền khi xuống nước; **Về trại** đưa về điểm xuất phát.
- Đến gần Pokémon để ghi vào nhật ký. Pokémon có nhóm và cá thể đơn lẻ, di chuyển trong môi trường phù hợp.
- Màn hình tạm dừng cho phép tạo thế giới mới bằng mã số, hoặc để trống để chọn mã ngẫu nhiên. Tạo mới thay thế hành trình hiện tại.

## Quy mô và địa hình

Bản đồ có **8.192 × 8.192 ô**, mỗi ô tương ứng **2 × 2 m**: kích thước **16,384 × 16,384 km**, diện tích **268,435456 km²**, bao gồm đất liền và biển. Đây là quy ước khoảng cách của game. Người chơi có thể đi liên tục trong toàn bộ giới hạn bản đồ; các điểm dịch chuyển giúp khám phá những vùng cách nhau nhiều km.

Lớp địa lý tổng quát 256 × 256 xác định cao độ, độ ẩm, lưu vực, núi, tuyết và núi lửa. Thuật toán priority flood xử lý vùng trũng, nối dòng chảy xuống biển và tích lũy lưu lượng để suối hợp thành sông. Lớp chi tiết nội suy địa hình, nối các nhánh sông qua biên vùng, thay đổi bề rộng theo lưu lượng và thêm bờ sông, cây, hoa, đá bằng tọa độ tuyệt đối. Vì vậy vùng đã rời khỏi bộ nhớ sẽ xuất hiện giống nhau khi quay lại với cùng mã thế giới. Tuyết ở cao độ lớn; dung nham trong vùng núi lửa.

## Đồi núi, thung lũng và di chuyển theo độ cao

Lớp địa hình cục bộ tạo sườn đồi, bậc đá, sống núi và thung lũng hạ thấp theo mạng sông. Độ cao thay đổi ngay trong khung hình; trại có một khoảng nền phẳng. Các dải dốc thoải xen giữa vách tạo đường vòng để đi bộ. Tọa độ tuyệt đối giữ các bậc nối liền nhau qua biên vùng tải.

Nhân vật bước qua chênh lệch tối đa 1 m. Nhảy có trọng lực, độ cao cực đại khoảng 3,3 m; không nhảy thêm giữa không trung. Giữ Leo và di chuyển vào vách để leo lên hoặc xuống bậc tối đa 8 m. Vách quá cao cần tìm đường khác. Khi rời mép bằng cú nhảy, nhân vật rơi xuống nền bên dưới. Trò chơi hiện chưa có sát thương do ngã hoặc thanh thể lực. Không nhảy/leo từ thuyền, không đi xuyên cây hoặc dung nham.

HUD hiển thị cao độ trong game và dạng địa hình. Bản đồ nhỏ có bóng cao độ giúp nhìn thấy bậc đá. Bàn chân khi nhảy được vẽ theo độ cao riêng, bóng nằm trên mặt đất; động tác leo diễn ra liên tục. Tạm dừng giữ nguyên tiến trình nhảy/leo, về trại hoặc dịch chuyển đặt nhân vật về mặt đất. Dữ liệu v2 giữ tọa độ và nhật ký; khi tải lại, nhân vật đứng trên nền mới tại vị trí đã lưu.

## Đồ họa pixel

Đã dùng skill **imagegen**, chế độ công cụ **image_gen tích hợp**, tạo hai ảnh nguồn riêng cho cây cối và bề mặt địa hình. Tài nguyên được lưu trong `apps/frontend/public/assets/world-v2/`, không tải từ dịch vụ ngoài khi chơi:

- `props-source.png` và `terrain-source.png`: ảnh nguồn đã tạo.
- `props.png`: atlas 384 × 448, gồm 16 loại cây, đá, hoa, cỏ và cây ven sông; giữ alpha trong suốt.
- `terrain.png`: atlas 512 × 512 với 16 bề mặt: cỏ, rừng, cát, đá, tuyết, dung nham và nước.
- `manifest.json`: kích thước ô và điểm neo của sprite.

Chạy `npm run assets:world` để dựng lại atlas từ ảnh nguồn. Prompt đầy đủ ở [world-art/prompts.md](world-art/prompts.md). Đã bổ sung atlas vách đá bằng công cụ imagegen tích hợp: `apps/frontend/public/assets/world-v3/cliffs-source.png` và bản dùng trong game `cliffs.png` (512 × 512). Bốn chất liệu là sa thạch phủ rêu, granite, vách băng và bazan; ảnh được chiếu lên các mặt đứng thực tế của địa hình. Prompt ở [world-art/cliffs-prompt.md](world-art/cliffs-prompt.md). Lệnh dựng tài nguyên ở trên cũng dựng lại atlas này. Ba atlas được tải vào game; các ảnh nguồn phục vụ chỉnh sửa tài nguyên.

Canvas vẽ isometric với cao độ, mặt vách, bóng đổ và sắp xếp vật thể theo chiều sâu. Cây che nhân vật được làm mờ. Tán lá, cỏ, hoa, dòng nước, sóng bờ, tuyết, dung nham và lửa trại có chuyển động; tùy chọn giảm chuyển động được áp dụng. Pokémon sử dụng sprite có sẵn.

## Giới hạn bộ nhớ và mô phỏng

Không tạo sẵn hơn 67 triệu ô. Địa hình chi tiết được sinh từng vùng 32 × 32 ô, tương ứng 64 × 64 m:

- Tối đa **64 vùng địa hình** trong bộ nhớ LRU, tức 65.536 ô chi tiết.
- Hình mặt vách được tái sử dụng, giữ tối đa **192 mẫu**; các phần nền che nhân vật được vẽ theo thứ tự chiều sâu.
- Nền đã vẽ có tối đa **48 vùng đệm** 256 × 256 pixel (~12 MiB dữ liệu pixel).
- Quần thể Pokémon tạo theo vùng quanh người chơi, giữ tối đa **25 vùng**; tối đa **80 Pokémon gần nhất** được mô phỏng ở **10 Hz**.
- Tìm đường giới hạn 96 ô và tối đa 6.000 nút, không cấp phát mảng theo diện tích thế giới.
- Chỉ vẽ vật thể gần camera. Canvas tối đa 960 × 600 pixel, HUD cập nhật khoảng 3 lần/giây.
- Dừng vòng lặp khi tab ẩn; giải phóng sự kiện, RAF, vùng đệm khi rời chế độ.

## Lưu hành trình

`localStorage` khóa `arena-open-world-v2` lưu mã thế giới, tọa độ, vùng đã đến và nhật ký Pokémon mỗi 5 giây và khi tạm dừng/rời trang. Vị trí tức thời của từng Pokémon không được lưu; quần thể vùng đã bị loại khỏi cache được tái tạo theo mã.

Nếu chỉ có dữ liệu v1, game giữ mã thế giới và nhật ký, đặt nhân vật tại trại mới vì hệ tọa độ đã đổi. Khóa v1 cũ vẫn được giữ. Dữ liệu hỏng được bỏ qua; nếu trình duyệt chặn lưu, HUD thông báo không lưu được.

## Kiểm tra

`tests/open-world.test.ts` kiểm tra nhiều mã thế giới, đủ các môi trường, dòng chảy xuống biển, vị trí an toàn, tái tạo vùng sau khi loại khỏi cache, biên vùng, giới hạn đường đi/mô phỏng và chuyển đổi dữ liệu lưu.

`tests/open-world-motion.test.ts` kiểm tra nhảy lên bậc, giới hạn leo, chặn vách cao/cây/dung nham, rơi và tiếp đất, không nhảy trên nước và độ nổi của địa hình. `tests/e2e/open-world-climbing.spec.ts` kiểm tra phím Space/E trên vách được sinh thật, tạm dừng giữa cú nhảy, nút cảm ứng và hai ngón tay đồng thời.

`tests/e2e/open-world.spec.ts` kiểm tra chọn chế độ, bàn phím/cảm ứng, bản đồ và dịch chuyển hơn 1 km, nhật ký v1, lưu/khôi phục v2, tạo lại thế giới, bố cục điện thoại và hình ảnh các vùng. `tests/e2e/open-world-performance.spec.ts` lưu số đo khung hình thành JSON.

Đo Chrome với lựa chọn đồ họa mặc định ngày 23/10/2026 trên máy phát triển: trung vị và p95 khoảng **17 ms/khung hình (~60 FPS)** ở đồng cỏ, tuyết, núi lửa và biển; phần vẽ Canvas khoảng **1,0–1,9 ms** khi đứng tại vùng đã tải. Bài thử di chuyển qua ranh giới vùng tải cũng đạt trung vị và p95 **17 ms/khung hình** trong lượt đo này. Đây là số đo trên máy hiện tại, không bảo đảm mọi thiết bị đạt cùng FPS. Các bài thử thế giới mở bỏ tùy chọn ép SwiftShader của cấu hình đấu trường. Chưa đo trên điện thoại vật lý; vùng mới và lần tải ảnh đầu tiên có chi phí khởi tạo.
