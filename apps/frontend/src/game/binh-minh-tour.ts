/** Walkable viewpoints, rather than building centres, for the city walking tour. */
export const CITY_TOUR = [
  {
    id: 'sunrise',
    x: 0,
    y: 3,
    title: ['Quảng trường ban mai', 'Sunrise plaza'],
    subtitle: ['Nơi mọi hành trình bắt đầu', 'Where every journey begins'],
    story: [
      'Những tia nắng trên nền đá chỉ về bốn cổng thành. Hãy tìm lá cờ mang biểu tượng mặt trời bên cổng triệu hồi.',
      'The stone sun points toward the four city gates. Look for the sunrise banners beside the summoning portal.',
    ],
    color: '#d9ad6c',
  },
  {
    id: 'market',
    x: -25,
    y: 13,
    title: ['Phiên chợ nắng sớm', 'Morning market'],
    subtitle: ['Mái bạt sọc & giỏ quả mọng', 'Striped awnings & berry baskets'],
    story: [
      'Đi dọc những quầy hàng nhỏ phía sau phố thương mại. Mái bạt màu đất nung và giỏ quả mọng làm nên góc phố ấm áp nhất Bình Minh.',
      'Walk past the little stalls behind the market hall. Terracotta awnings and berry baskets bring warmth to this corner of the city.',
    ],
    color: '#ce8b70',
  },
  {
    id: 'academy',
    x: 9,
    y: -4.5,
    title: ['Bậc thềm học viện', 'Academy steps'],
    subtitle: ['Dưới viên pha lê xanh', 'Beneath the blue crystal'],
    story: [
      'Từ bậc thềm, nhìn qua quảng trường để thấy đấu trường ở phía đối diện. Những khu vườn trên mái nối màu xanh của học viện với thành phố.',
      'Look across the plaza toward the arena. Rooftop gardens carry the academy’s green accents into the city.',
    ],
    color: '#83b7b2',
  },
  {
    id: 'garden',
    x: -8,
    y: -24,
    title: ['Vườn ánh sáng', 'Garden of light'],
    subtitle: ['Một khoảng nghỉ giữa thành phố', 'A quiet corner of the city'],
    story: [
      'Rời đại lộ để tìm khoảng xanh bên vành đai phía bắc. Đây là góc dừng chân trước khi tiếp tục ra những miền đất mới.',
      'Leave the avenue for the gardens beside the northern ring road. Take a quiet pause before heading into the wildlands.',
    ],
    color: '#9bb58a',
  },
] as const;
