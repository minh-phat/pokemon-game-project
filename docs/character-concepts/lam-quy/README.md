# Lam Quy

Nhân vật thay thế Squirtle, dựa trên ảnh người dùng cung cấp: da xanh lam,
hai tai xoắn, mắt đỏ đen, bụng vảy màu bạc hà, mai xanh và đuôi cuộn.
Tên hiển thị là **Lam Quy**. ID lưu trữ `squirtle` được giữ để đội hình,
thú đã triệu hồi và dữ liệu thế giới cũ tiếp tục hoạt động.

Ảnh được tạo bằng công cụ imagegen tích hợp. Hai bảng nguồn có alpha:

- `combat-source.png`: năm tư thế cho mỗi hành động lao tới, phun nước,
  cuộn mai, né lùi và cúi thấp. Cột nhãn bên trái được bỏ khi đóng gói.
- `movement-source.png`: sáu tư thế cho mỗi hành động đứng/chớp mắt,
  chạy, nhảy, phòng thủ và ngồi xuống rồi nằm nghỉ.

Chạy `node scripts/build-lam-quy-assets.mjs` hoặc `npm run assets` để tạo:

- `apps/frontend/public/assets/lam-quy.png`: chân dung 160 × 160.
- `apps/frontend/public/assets/lam-quy-sheet.png`: sprite 960 × 2400,
  gồm 15 hàng × 6 khung, mỗi khung 160 × 160.

Thứ tự hàng: idle, run, jump, fall, land, attack, cast, dash, backstep,
crouch, guard, hit, knockback, faint, victory. Các hành động năm tư thế
giữ khung hồi phục cuối thêm một nhịp. Fall/land dùng lại tư thế nhảy
và cúi; hit/knockback dùng tư thế ngả lùi; victory dùng tư thế nhảy giơ tay.
Faint kết thúc bằng hai tư thế nằm nhắm mắt.

Prompt tạo ảnh cuối (built-in imagegen):

> Use the exact turtle character from this board, same identity and flat colors,
> to draw a NEW animation board. BIPED standing upright on two feet, two equal
> small spiral ears on either side of the head, big reddish black eyes,
> turquoise blue skin, pale blue scalloped belly, dark blue spiral shell and
> blue curled tail. Preserve its face and anatomy. SIX columns and FIVE rows
> on transparent background, no text, labels or grid. Row 1 six standing
> breathing blink poses. Row 2 six running steps on TWO legs. Row 3 six jumping
> poses on TWO legs. Row 4 six arms raised guarding poses. Row 5 six sleepy
> sitting then lying down poses. Each character fully isolated.
> Match the source drawing style exactly.

Prompt bảng chiến đấu: giữ nhận dạng nhân vật từ ảnh người dùng, tạo
chuỗi lấy đà → lao vai → thu về, gom nước → phun nước → hồi phục,
thu mình → lăn mai → đứng dậy, bật lùi, và cúi thấp. Dùng nền trong suốt,
nét viền tối và màu phẳng đồng nhất.
