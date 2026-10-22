'use client';
import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Home as HomeIcon,
  Maximize,
  Settings,
  Smartphone,
  Swords,
  UserRound,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';

export function LanguagePicker() {
  const { language } = useLanguage();
  return (
    <div className="language-picker" role="group" aria-label="Ngôn ngữ / Language">
      <button
        aria-pressed={language === 'vi'}
        onClick={() => useGame.getState().set({ language: 'vi' })}
        lang="vi"
      >
        VI
      </button>
      <span aria-hidden="true">/</span>
      <button
        aria-pressed={language === 'en'}
        onClick={() => useGame.getState().set({ language: 'en' })}
        lang="en"
      >
        EN
      </button>
    </div>
  );
}

const emblemCells: Record<string, number> = {
  '🪙': 0,
  '💎': 1,
  '⚡': 2,
  '👑': 3,
  '🗓️': 4,
  '🏆': 5,
  '📖': 6,
  '⚔️': 7,
  '🎒': 8,
  '🏪': 9,
  '📜': 10,
  '🌀': 11,
  '👥': 12,
  '⬆️': 13,
  '💬': 14,
  '✉️': 15,
};
function Emblem({ children }: { children: ReactNode }) {
  const cell = typeof children === 'string' ? emblemCells[children] : undefined;
  return (
    <span
      className={`fantasy-emblem ${cell !== undefined ? 'sprite-emblem' : ''}`}
      aria-hidden="true"
      style={
        cell !== undefined
          ? {
              backgroundPosition: `${((cell % 4) * 100) / 3}% ${(Math.floor(cell / 4) * 100) / 3}%`,
            }
          : undefined
      }
    >
      {cell === undefined ? children : null}
    </span>
  );
}

export function Home({
  isAppMode,
  onEnterFullscreen,
}: {
  isAppMode: boolean;
  onEnterFullscreen: () => void;
}) {
  const { user, authLoading, go, set } = useGame();
  const { t } = useLanguage();
  const [info, setInfo] = useState<'about' | 'features' | null>(null);
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const unavailable = (feature: string) =>
    set({
      notice: t(
        `${feature}: Chưa khả dụng. Hãy quay lại sau nhé!`,
        `${feature}: Not available yet. Check back soon!`,
      ),
    });
  const play = () => go('modes');
  const community = () => unavailable(t('Cộng đồng', 'Community'));
  const utilities = (
    <div className="fantasy-utilities">
      <LanguagePicker />
      {!isAppMode && (
        <button
          className="fantasy-icon-button"
          aria-label={t('Toàn màn hình', 'Fullscreen')}
          onClick={onEnterFullscreen}
        >
          <Maximize />
        </button>
      )}
    </div>
  );
  return (
    <div className={`fantasy-home ${user ? 'player-home' : 'landing-home'}`}>
      <div className="fantasy-scene" aria-hidden="true" />
      {!user ? (
        <>
          <header className="landing-header">
            <nav
              className="fantasy-frame landing-nav"
              aria-label={t('Điều hướng chính', 'Main navigation')}
            >
              <button className="active" aria-current="page" onClick={() => go('home')}>
                <HomeIcon />
                <span>{t('Trang Chủ', 'Home')}</span>
              </button>
              <button onClick={() => setInfo('about')}>
                <BookOpen />
                <span>{t('Giới Thiệu', 'About')}</span>
              </button>
              <button onClick={() => setInfo('features')}>
                <Compass />
                <span>{t('Tính Năng', 'Features')}</span>
              </button>
              <button onClick={community}>
                <Users />
                <span>{t('Cộng Đồng', 'Community')}</span>
              </button>
            </nav>
            {utilities}
          </header>
          <section className="summoner-hero" aria-labelledby="summoner-title">
            <div className="summoner-crest" aria-hidden="true">
              <span>✧</span>
              <Compass />
            </div>
            <h1 id="summoner-title">{t('Triệu Hồi Sư', 'Summoner')}</h1>
            <p>
              {t(
                'Bước vào thế giới triệu hồi, thu phục linh thú',
                'Enter a world of summoning, befriend magical pets',
              )}
              <br />
              {t(
                'và chiến đấu trong những trận chiến huyền ảo.',
                'and fight in extraordinary battles.',
              )}
            </p>
            <div className="fantasy-divider" aria-hidden="true">
              ◇ ◆ ◇
            </div>
            <div className="landing-actions">
              <button
                className="fantasy-frame fantasy-action"
                onClick={() => set({ accountView: 'login' })}
                disabled={authLoading}
              >
                <UserRound />
                {t('Đăng Nhập', 'Log In')}
              </button>
              <button
                className="fantasy-frame fantasy-action blue"
                onClick={() => set({ accountView: 'register' })}
                disabled={authLoading}
              >
                <UserRoundPlus />
                {t('Đăng Ký', 'Sign Up')}
              </button>
              <button className="fantasy-frame fantasy-action gold" onClick={play}>
                <Swords />
                {t('Chơi Ngay', 'Play Now')}
              </button>
            </div>
          </section>
          <button
            className="fantasy-frame moon-event"
            onClick={() => unavailable(t('Lễ Hội Ánh Trăng', 'Moonlight Festival'))}
          >
            <span className="event-ribbon">✦ {t('Sự kiện', 'Event')}</span>
            <strong>{t('Lễ Hội Ánh Trăng', 'Moonlight Festival')}</strong>
            <span>
              {t('Những linh thú kỳ diệu đang chờ bạn!', 'A magical world of companions awaits!')}
            </span>
            <small>{t('Sắp ra mắt', 'Coming soon')}</small>
            <ChevronRight />
          </button>
          <nav className="landing-features" aria-label={t('Khám phá trò chơi', 'Explore the game')}>
            {[
              {
                icon: '🐾',
                title: t('Thu Phục Pets', 'Collect Pets'),
                description: t(
                  'Khám phá những linh thú đáng yêu và mạnh mẽ.',
                  'Discover adorable and powerful companions.',
                ),
                action: () => go('codex'),
                art: 'pets',
              },
              {
                icon: '⚔️',
                title: t('Chiến Đấu Chiến Thuật', 'Strategic Battles'),
                description: t(
                  'Xây dựng đội hình, kết hợp kỹ năng và chiến thuật riêng.',
                  'Build your team, combine skills and find your strategy.',
                ),
                action: play,
                art: 'battle',
              },
              {
                icon: '⬆️',
                title: t('Nâng Cấp Đội Hình', 'Upgrade Your Team'),
                description: t(
                  'Tiến hóa, nâng cấp và thức tỉnh sức mạnh của linh thú.',
                  'Evolve, upgrade and awaken your companions’ power.',
                ),
                action: () => unavailable(t('Nâng cấp', 'Upgrades')),
                art: 'upgrade',
              },
              {
                icon: '🧭',
                title: t('Khám Phá Thế Giới', 'Explore the World'),
                description: t(
                  'Du hành qua những vùng đất huyền bí và đấu trường kỳ ảo.',
                  'Journey through mysterious lands and magical arenas.',
                ),
                action: () => go('arenas'),
                art: 'world',
              },
            ].map((feature) => (
              <button
                key={feature.art}
                className={`fantasy-frame feature-tile feature-${feature.art}`}
                onClick={feature.action}
              >
                <strong>
                  <Emblem>{feature.icon}</Emblem>
                  {feature.title}
                </strong>
                <p>{feature.description}</p>
                <ChevronRight className="feature-arrow" />
              </button>
            ))}
          </nav>
        </>
      ) : (
        <>
          <header className="player-header">
            <button
              className="fantasy-frame player-profile"
              onClick={() => set({ accountView: 'profile' })}
              aria-label={t('Tài khoản của bạn', 'Your account')}
            >
              <span className="player-avatar" aria-hidden="true" />
              <span>
                <strong>{user.name}</strong>
                <small>
                  {t('Nhà triệu hồi', 'Summoner')} <b>Lv. —</b>
                </small>
                <span className="player-level" />
              </span>
            </button>
            <div className="player-resources">
              {[
                { icon: '🪙', label: t('Vàng', 'Gold') },
                { icon: '💎', label: t('Kim cương', 'Gems') },
                { icon: '⚡', label: t('Năng lượng', 'Energy') },
              ].map((resource) => (
                <button
                  key={resource.icon}
                  className="fantasy-frame resource-pill"
                  aria-label={resource.label}
                  onClick={() => unavailable(resource.label)}
                >
                  <Emblem>{resource.icon}</Emblem>
                  <strong>—</strong>
                  <span className="resource-add" aria-hidden="true">
                    +
                  </span>
                </button>
              ))}
            </div>
            <div className="player-tools">
              {utilities}
              <button
                className="fantasy-frame tool-button"
                aria-label={t('Hộp thư', 'Mailbox')}
                onClick={() => unavailable(t('Hộp thư', 'Mailbox'))}
              >
                <Emblem>✉️</Emblem>
              </button>
              <button
                className="fantasy-frame tool-button"
                aria-label={t('Bạn bè', 'Friends')}
                onClick={() => unavailable(t('Bạn bè', 'Friends'))}
              >
                <Users />
              </button>
              <button
                className="fantasy-frame tool-button"
                aria-label={t('Cài đặt', 'Settings')}
                onClick={() => set({ settingsOpen: true })}
              >
                <Settings />
              </button>
            </div>
          </header>
          <nav className="fantasy-frame player-side-nav" aria-label={t('Hoạt động', 'Activities')}>
            {[
              ['👑', t('Sự Kiện', 'Events')],
              ['🗓️', t('Điểm Danh', 'Check In')],
              ['🏆', t('Bảng Xếp Hạng', 'Rankings')],
              ['📖', t('Thành Tựu', 'Achievements')],
            ].map(([icon, label]) => (
              <button key={icon} onClick={() => unavailable(label)}>
                <Emblem>{icon}</Emblem>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <nav className="player-main-menu" aria-label={t('Menu người chơi', 'Player menu')}>
            <button className="fantasy-frame player-menu-card play-card" onClick={play}>
              <Emblem>⚔️</Emblem>
              <span>
                <strong>{t('Chơi', 'Play')}</strong>
                <small>
                  {t('Bắt đầu hành trình triệu hồi!', 'Begin your summoning adventure!')}
                </small>
              </span>
              <ChevronRight />
            </button>
            <button
              className="fantasy-frame player-menu-card pets-card"
              onClick={() => go('codex')}
            >
              <span className="menu-pet" aria-hidden="true" />
              <span>
                <strong>Pets</strong>
                <small>
                  {t(
                    'Khám phá kỹ năng những người bạn đồng hành!',
                    'Discover your companions and their skills!',
                  )}
                </small>
              </span>
              <ChevronRight />
            </button>
            <button
              className="fantasy-frame player-menu-card bag-card"
              onClick={() => unavailable(t('Túi Đồ', 'Inventory'))}
            >
              <Emblem>🎒</Emblem>
              <span>
                <strong>{t('Túi Đồ', 'Inventory')}</strong>
                <small>
                  {t(
                    'Quản lý vật phẩm, trang bị và tài nguyên.',
                    'Manage items, equipment and resources.',
                  )}
                </small>
              </span>
              <ChevronRight />
            </button>
            <div className="player-small-menu">
              <button className="fantasy-frame" onClick={() => unavailable(t('Cửa Hàng', 'Shop'))}>
                <Emblem>🏪</Emblem>
                <strong>{t('Cửa Hàng', 'Shop')}</strong>
                <ChevronRight />
              </button>
              <button
                className="fantasy-frame"
                onClick={() => unavailable(t('Nhiệm Vụ', 'Quests'))}
              >
                <Emblem>📜</Emblem>
                <strong>{t('Nhiệm Vụ', 'Quests')}</strong>
                <ChevronRight />
              </button>
            </div>
            <button
              className="fantasy-frame dragon-event"
              onClick={() => unavailable(t('Rồng Băng Vĩnh Cửu', 'Eternal Frost Dragon'))}
            >
              <img src="/assets/runedrake.png" alt="" />
              <span>
                <strong>{t('Rồng Băng Vĩnh Cửu', 'Eternal Frost Dragon')}</strong>
                <small>{t('Sự kiện đặc biệt', 'Special event')}</small>
                <b>{t('Sắp ra mắt!', 'Coming soon!')}</b>
                <span className="event-dots" aria-hidden="true">
                  ◆ ◇ ◇
                </span>
              </span>
            </button>
          </nav>
          <nav
            className="player-bottom-nav"
            aria-label={t('Linh thú và đội hình', 'Companions and team')}
          >
            {[
              {
                icon: '🌀',
                label: t('Triệu Hồi', 'Summon'),
                action: () => unavailable(t('Triệu Hồi', 'Summon')),
              },
              {
                icon: '👥',
                label: t('Đội Hình', 'Team'),
                action: () => {
                  set({ mode: 'ai', snapshot: null });
                  go('roster');
                },
              },
              {
                icon: '⬆️',
                label: t('Nâng Cấp', 'Upgrade'),
                action: () => unavailable(t('Nâng Cấp', 'Upgrade')),
              },
              { icon: '📖', label: t('Thư Viện', 'Library'), action: () => go('codex') },
              { icon: '💬', label: t('Cộng Đồng', 'Community'), action: community },
            ].map((item) => (
              <button className="fantasy-frame" key={item.icon} onClick={item.action}>
                <Emblem>{item.icon}</Emblem>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      {!rotateDismissed && (
        <div className="rotate-hint" role="status">
          <Smartphone />
          <span>
            {t(
              'Xoay ngang điện thoại để có trải nghiệm tốt nhất',
              'Rotate your phone for the best experience',
            )}
          </span>
          <button
            onClick={() => setRotateDismissed(true)}
            aria-label={t('Đóng gợi ý', 'Dismiss hint')}
          >
            <X />
          </button>
        </div>
      )}
      <Dialog
        open={info !== null}
        onOpenChange={(open) => {
          if (!open) setInfo(null);
        }}
        title={
          info === 'about'
            ? t('Thế giới Triệu Hồi Sư', 'The world of Summoner')
            : t('Khám phá tính năng', 'Explore the features')
        }
        description={t(
          'Một đội hình nhỏ. Một hành trình huyền thoại.',
          'A little team. A legendary adventure.',
        )}
      >
        <div className="home-info">
          <p>
            {info === 'about'
              ? t(
                  'Gặp gỡ những linh thú, tìm hiểu kỹ năng và tạo nên đội hình của riêng bạn. Chiến đấu với máy hoặc mời bạn bè cùng tham gia đấu trường.',
                  'Meet magical companions, discover their skills and create your own team. Battle the AI or invite a friend to the arena.',
                )
              : t(
                  'Hiện có: đấu với máy ở 3 độ khó, phòng đấu online 1v1, chọn 1–4 nhân vật, điều khiển chiến đấu và khám phá đấu trường. Các tính năng sưu tầm, nâng cấp và sự kiện sẽ được bổ sung sau.',
                  'Available now: three AI difficulty levels, private online 1v1 rooms, teams of 1–4 characters, battle controls and arena selection. Collecting, upgrades and events are coming later.',
                )}
          </p>
          <button
            className="fantasy-frame fantasy-action gold"
            onClick={() => {
              setInfo(null);
              play();
            }}
          >
            <Swords />
            {t('Chơi Ngay', 'Play Now')}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
