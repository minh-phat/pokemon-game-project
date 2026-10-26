# Thế giới mở

Vào **Chơi Ngay → Thế giới mở**. Đây là chế độ khám phá chơi đơn, chạy trong trình duyệt và hỗ trợ khách.

- **WASD / phím mũi tên**: di chuyển theo hướng màn hình; **Shift**: chạy.
- **Space**: nhảy; **giữ E + hướng di chuyển**: leo lên/xuống vách. Điện thoại dùng nút **Nhảy** và giữ **Leo** đồng thời với cần điều khiển.
- Chạm hoặc bấm mặt đất để tìm đường đi bộ ở gần, có xét độ cao. Điện thoại có cần điều khiển và nút chạy.
- **M**: bản đồ quần đảo; **J**: nhật ký; **Esc**: tạm dừng.
- Bản đồ lớn có các điểm dịch chuyển tới từng môi trường, kèm khoảng cách bằng km. Bản đồ nhỏ hiển thị khu vực 192 × 192 m quanh người chơi và thước 50 m.
- Nhân vật tự dùng thuyền khi xuống nước; **Về trại** đưa về điểm xuất phát.
- Đến gần Pokémon để ghi vào nhật ký. Pokémon có nhóm và cá thể đơn lẻ, di chuyển trong môi trường phù hợp.
- Màn hình tạm dừng cho phép tạo thế giới mới bằng mã số, hoặc để trống để chọn mã ngẫu nhiên. Tạo mới thay thế hành trình hiện tại.

## Pets, chiến đấu và khế ước

Đăng nhập, mở **Triệu hồi Pets**, chọn nhiều thú tùy ý hoặc **Chọn tất cả**, rồi bấm **Xong**. Các thú cùng xuất hiện trên bản đồ và đi theo bạn. Bấm lại một thú để thu hồi riêng hoặc chọn **Thu hồi tất cả** khi ngoài trận. Nếu chưa có pet, dùng **Triệu Hồi** ở trang chủ để nhận thú đầu tiên. Khách vẫn khám phá và ghi nhật ký như trước.

Thú hoang có nhãn **Lv. / phẩm chất C–SS**. Level và phẩm chất được sinh ổn định theo mã thế giới và mã cá thể; càng xa trại, cấp độ thường càng cao (1–60). Ba Pikachu tại trại luôn cấp 1/C. Các phẩm chất ngoài trại có tỉ lệ C 60%, B 25%, A 11%, S 3,8%, SS 0,2%.

Bấm từng thú hoang để chọn/bỏ chọn, hoặc kéo chuột tạo khung chữ nhật để chọn quái trong vùng. Giữ **Shift** khi kéo để thêm mục tiêu. Có thể **Bỏ chọn tất cả**; kéo chọn không làm nhân vật di chuyển. Bấm **Ra trận** để cả đội cùng chiến đấu với các quái đã chọn. Luật thế giới mở không giới hạn số lượng thú và mục tiêu. Trong trận, người chơi đứng quan sát và không dịch chuyển sang vùng khác. Có thể **Rút lui** nếu không muốn tiếp tục; rút lui không có EXP.

- **Auto**: cả pet và thú hoang dùng AI mức khó, tự chọn kỹ năng theo tầm đánh, năng lượng và hồi chiêu; né ngang khi đối thủ chuẩn bị bắn, nhảy qua đạn thấp, lướt khỏi tia/vùng sát thương và tránh vật cản địa hình. Các phản ứng phụ thuộc tình huống và thể lực.
- **Tự điều khiển**: bấm thú trong danh sách đội để điều khiển thú đó; các thú khác tiếp tục Auto. Dùng chung bộ điều khiển đấu máy/PvP: WASD/phím mũi tên hoặc cần điều khiển để di chuyển, các nút kỹ năng, nhảy, lướt, cúi, đỡ và đổi mục tiêu. Camera bám Pokémon đang điều khiển. Nút kỹ năng hiển thị năng lượng và hồi chiêu.
- Trận dùng cùng `BattleEngine` và AI với đấu máy/PvP, áp dụng level/phẩm chất riêng cho từng cá thể, kể cả hai thú cùng loài. Sprite, đòn đánh, tia năng lượng, vùng sát thương và số sát thương được vẽ trên bản đồ.
- Trận được vẽ bằng chính `ArenaScene` của đấu máy/PvP trên lớp Canvas trong suốt: dùng chung `SkillVfx`, `DashWind`, hoạt ảnh từng loài, tụ lực, đạn và vệt đạn, tia, nổ khi trúng, trạng thái, chiêu trói và âm thanh. Không còn dùng chấm đạn/đường tia thay cho hiệu ứng thật. Nhãn level/phẩm chất và thẻ hành động vẫn hiển thị trong thế giới mở.
- Lớp chiến đấu giữ nguyên trục di chuyển và tỉ lệ của đấu trường, đặt trên mặt phẳng ở cao độ mục tiêu; bản đồ vẫn hiện phía dưới. Thế giới mở giữ quyền cập nhật mô phỏng 60 Hz; lớp vẽ chỉ đọc snapshot riêng, không cập nhật thêm một lần và không dùng chung trận đang lưu trong `battleFeed`. Tải tài nguyên xong mới bắt đầu mô phỏng; lỗi tải có thông báo và người chơi có thể rút lui để thử lại. Tạm dừng dừng hoạt ảnh/âm thanh; rút lui hoặc rời bản đồ giải phóng lớp vẽ.
- Mã trận mới dùng `combatVersion: 5`; trận cũ vẫn phát lại với AI cũ để giữ nguyên kết quả khi thử lưu thưởng.
- Khi thú hoang còn **dưới 10% HP**, nó ngừng tham chiến. Khi tất cả quái chịu thua, trận dừng và cho chọn **Lập khế ước** với các quái đủ điều kiện hoặc **Thả đi**. Đòn vượt quá lượng máu còn lại chừa 1 HP. Đúng 10% chưa đủ điều kiện. Khế ước thành công chắc chắn, giữ nguyên loài, cấp và phẩm chất; mỗi cá thể trong cùng mã thế giới chỉ lập khế ước một lần với mỗi tài khoản.
- Trận tối đa 120 giây. Kết thúc do hết giờ vẫn tính EXP theo kết quả, nhưng chỉ được lập khế ước nếu thực sự thắng và thú hoang dưới 10% HP. Pet được hồi phục khi bắt đầu trận tiếp theo.

## Kinh nghiệm

Mỗi pet sở hữu đã tham chiến nhận tổng EXP của các mục tiêu; máy chủ xác minh và chỉ cộng một lần cho mỗi pet. EXP thắng mỗi mục tiêu là `round((35 + 15 × cấp thú hoang) × hệ số phẩm chất)`; thua/hòa nhận 25% (làm tròn). Hệ số C/B/A/S/SS lần lượt là 1 / 1,1 / 1,25 / 1,5 / 2. Ví dụ thắng thú cấp 1/C nhận 50 EXP.

EXP cần để lên cấp tiếp theo từ cấp `L` là `100 + 25 × (L − 1) + 5 × (L − 1)²`: cấp 1→2 cần 100, 2→3 cần 130, 3→4 cần 170, 10→11 cần 730 EXP. EXP dư được chuyển sang cấp kế tiếp, hỗ trợ lên nhiều cấp và giới hạn cấp 100. Chỉ số mới áp dụng từ trận tiếp theo. Thẻ kết quả và chi tiết Pets hiển thị EXP hiện tại.

Máy chủ xác thực quyền sở hữu, tự sinh lại mục tiêu và phát mã trận. Khi kết thúc, máy chủ phát lại các lệnh ở đúng tick bằng cùng bộ máy chiến đấu, kiểm tra thời lượng, rồi tự tính kết quả/EXP/khế ước. Không nhận HP, level, phẩm chất hay phần thưởng do trình duyệt khai báo. MongoDB lưu EXP theo ID pet, dấu nhận thưởng theo ID trận và ID cố định của thú bắt được để lần gửi lại không cộng trùng. Bản ghi phần thưởng chờ lưu trên thiết bị giúp thử lại khi mất mạng hoặc tải lại trang sau trận. Đổi tài khoản không dùng chung bộ sưu tập.

Tiến trình trận đang đánh chưa được khôi phục sau khi tải lại trang; chỉ trận đã kết thúc mới có bản ghi thử lưu lại. Thú đã bắt được ẩn khi tải bộ sưu tập; thú được thả có thể gặp lại khi mở lại thế giới. Hệ thống EXP này hiện áp dụng cho pet sở hữu tham chiến ở thế giới mở; đội hình đấu máy/PvP hiện vẫn chọn theo loài.

## Quy mô và địa hình

Bản đồ có **8.192 × 8.192 ô**, mỗi ô tương ứng **2 × 2 m**: kích thước **16,384 × 16,384 km**, diện tích **268,435456 km²**, bao gồm đất liền và biển. Đây là quy ước khoảng cách của game. Người chơi có thể đi liên tục trong toàn bộ giới hạn bản đồ; các điểm dịch chuyển giúp khám phá những vùng cách nhau nhiều km.

Thế giới gồm chín đảo chính lớn nhỏ, ngăn cách bởi các eo biển. Núi tuyết và núi lửa phân bố trên nhiều đảo, xen kẽ vùng đồi thấp; các đỉnh có độ cao khác nhau, từ núi thấp đến đỉnh cao vượt trội. Vị trí, đường bờ và độ cao thay đổi theo mã thế giới. Thuyền tự động giúp di chuyển giữa các đảo.

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
- Chỉ vẽ vật thể gần camera. Canvas vẽ theo kích thước màn hình, hỗ trợ mật độ Retina tối đa 2×. Khung nhìn logic vẫn giới hạn 960 × 600 để giữ mức zoom và lượng địa hình cần vẽ; HUD cập nhật khoảng 3 lần/giây. Sprite Pokémon giữ nguyên khung 160 × 160, không thu xuống 32 × 32 trước khi hiển thị.
- Dừng vòng lặp khi tab ẩn; giải phóng sự kiện, RAF, vùng đệm khi rời chế độ.

## Lưu hành trình

`localStorage` khóa `arena-open-world-v2` lưu mã thế giới, tọa độ, vùng đã đến và nhật ký Pokémon mỗi 5 giây và khi tạm dừng/rời trang. Vị trí tức thời của từng Pokémon không được lưu; quần thể vùng đã bị loại khỏi cache được tái tạo theo mã.

Nếu chỉ có dữ liệu v1, game giữ mã thế giới và nhật ký, đặt nhân vật tại trại mới vì hệ tọa độ đã đổi. Khóa v1 cũ vẫn được giữ. Dữ liệu hỏng được bỏ qua; nếu trình duyệt chặn lưu, HUD thông báo không lưu được.

## Kiểm tra

`tests/world-ai.test.ts` kiểm tra phản ứng với đạn, tia và vùng sát thương, giới hạn thể lực/biên đấu, mô phỏng Auto dùng kỹ năng/nhảy/lướt qua nhiều seed, tính xác định của replay và độ cao sprite. Bài kiểm tra Auto trong `tests/e2e/world-combat.spec.ts` quan sát lệnh vẽ canvas để xác nhận sprite nhảy/lướt và các tài nguyên tụ lực, Electro Ball, nổ trúng đòn từ đấu trường thực sự được vẽ và ghép lên bản đồ mà không có lệnh điều khiển thủ công.

`tests/open-world.test.ts` kiểm tra nhiều mã thế giới, đủ các môi trường, dòng chảy xuống biển, vị trí an toàn, tái tạo vùng sau khi loại khỏi cache, biên vùng, giới hạn đường đi/mô phỏng và chuyển đổi dữ liệu lưu.

`tests/open-world-motion.test.ts` kiểm tra nhảy lên bậc, giới hạn leo, chặn vách cao/cây/dung nham, rơi và tiếp đất, không nhảy trên nước và độ nổi của địa hình. `tests/e2e/open-world-climbing.spec.ts` kiểm tra phím Space/E trên vách được sinh thật, tạm dừng giữa cú nhảy, nút cảm ứng và hai ngón tay đồng thời.

`tests/world-combat.test.ts` kiểm tra EXP, chỉ số hai cá thể cùng loài, ngưỡng khế ước, đòn chí mạng, replay Auto/tự điều khiển, quyền sở hữu và tính duy nhất của thưởng/khế ước bằng database giả lập. `tests/e2e/world-combat.spec.ts` kiểm tra desktop/điện thoại với API giả lập: triệu hồi, chọn mục tiêu trực tiếp trên canvas, Đỡ/Auto, EXP lên cấp, thử lưu lại khi lỗi mạng, khôi phục phần thưởng sau tải lại trang và triệu hồi thú vừa bắt được.

`tests/e2e/open-world.spec.ts` kiểm tra chọn chế độ, bàn phím/cảm ứng, bản đồ và dịch chuyển hơn 1 km, nhật ký v1, lưu/khôi phục v2, tạo lại thế giới, bố cục điện thoại và hình ảnh các vùng. `tests/e2e/open-world-performance.spec.ts` lưu số đo khung hình thành JSON.

Đo Chrome với lựa chọn đồ họa mặc định ngày 23/10/2026 trên máy phát triển: trung vị và p95 khoảng **17 ms/khung hình (~60 FPS)** ở đồng cỏ, tuyết, núi lửa và biển; phần vẽ Canvas khoảng **1,0–1,9 ms** khi đứng tại vùng đã tải. Bài thử di chuyển qua ranh giới vùng tải cũng đạt trung vị và p95 **17 ms/khung hình** trong lượt đo này. Đây là số đo trên máy hiện tại, không bảo đảm mọi thiết bị đạt cùng FPS. Các bài thử thế giới mở bỏ tùy chọn ép SwiftShader của cấu hình đấu trường. Chưa đo trên điện thoại vật lý; vùng mới và lần tải ảnh đầu tiên có chi phí khởi tạo.

## AI chiến đấu theo địa hình

Trận mới dùng `combatVersion: 5`, hỗ trợ hai đội khác số lượng và không có biên chiến đấu cục bộ. Pokémon có thể di chuyển ra xa vị trí bắt đầu; cây, đá, vách, dung nham và biên ngoài của bản đồ vẫn có va chạm. Vé trận lưu mã thế giới, tọa độ gốc và cao độ gốc; client và máy chủ lấy các ô địa hình theo tọa độ qua cùng bộ nhớ đệm giới hạn, không cấp phát toàn bộ bản đồ. Lớp vẽ sprite/chiêu thức đi theo camera bằng một Canvas có kích thước cố định. Trận phiên bản cũ giữ nguyên vùng 33 × 33 ô để phát lại đúng kết quả khi thử nhận thưởng. Phép chiếu giữ 32 đơn vị chiến đấu cho mỗi cấp độ cao của thế giới.

AI và nhân vật chiến đấu dùng chung va chạm theo độ cao: đi lên/xuống bậc một cấp, nhảy lên bậc trong tầm sức bật của loài, leo bậc cao tối đa tám cấp khi còn thể lực, rơi và tiếp đất ở nền thực tế. Leo có thời gian, tiêu hao thể lực và bị ngắt khi trúng đòn/choáng. Nước làm chậm di chuyển; không tự leo từ nước. Dung nham, gốc cây và những vách không thể vượt buộc AI tìm đường khác. Việc giao chiến vẫn giới hạn trong vùng trận đấu quanh mục tiêu.

Tìm đường A\* giới hạn 2.400 nút và lưu lộ trình ngắn hạn. AI cân nhắc chỗ khuất đạn, đường bắn thông thoáng và vị trí cao, rồi quay lại giao chiến sau khi tránh né. Các sàn rừng, núi lửa và hồ có bục thấp/cao hiển thị được; thành cổ dùng chiều cao của đá, cột và tường có sẵn, giữ các tường biên không thể leo. Đạn, tia, bóng và vùng sát thương sử dụng cao độ chiến đấu.

`tests/terrain-traversal.test.ts` kiểm tra nhảy, leo tự động, xuống bậc, ngắt leo, vách vượt tầm, che chắn, va chạm ở bước di chuyển ngắn, cao độ âm, đối chiếu phép chiếu với thế giới và replay sau khi tuần tự hóa dữ liệu địa hình.

`tests/world-roaming.test.ts` kiểm tra đi qua cả bốn biên đấu cũ, lấy địa hình ngoài vùng ban đầu, đạn ở tọa độ xa, bộ nhớ đệm, phép ghép lớp vẽ theo camera và tính xác định của replay phiên bản 5. Kiểm thử trình duyệt kiểm tra đi bằng bàn phím/cần điều khiển ra ngoài vùng địa hình cũ rồi hoàn thành trận và nhận thưởng.
