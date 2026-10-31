'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Crown,
  LockKeyhole,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';

type ArenaMode = 'casual' | 'ranked' | 'custom';

export function ArenaScreen() {
  const { t } = useLanguage();
  const { go, set } = useGame();
  const [mode, setMode] = useState<ArenaMode>(
    useGame.getState().mode === 'online' ? 'custom' : 'casual',
  );
  const [style, setStyle] = useState<'duel' | 'tactics'>('duel');
  const [players, setPlayers] = useState<1 | 2>(1);
  const [pets, setPets] = useState<3 | 6 | 'all'>(3);
  const tactical = style === 'tactics';
  const ranked = mode === 'ranked';
  const petLabel =
    tactical || pets === 'all' ? t('Toàn bộ', 'All') : `${pets} ${t('thú', 'companions')}`;
  const modes = [
    {
      id: 'casual' as const,
      icon: Swords,
      title: t('Đấu thường', 'Casual'),
      description: t('Tự do so tài', 'Play at your own pace'),
    },
    {
      id: 'ranked' as const,
      icon: Trophy,
      title: t('Đấu hạng', 'Ranked'),
      description: t('Chinh phục thứ hạng', 'Climb the ranks'),
    },
    {
      id: 'custom' as const,
      icon: Users,
      title: t('Phòng tuỳ chỉnh', 'Custom room'),
      description: t('Hẹn bạn vào đấu', 'Challenge your friends'),
    },
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) go('home');
      }}
      className="arena-dialog"
      title={t('Đấu trường', 'Arena')}
      description={t(
        'Hội tụ triệu hồi sư. Khẳng định đội hình của bạn.',
        'Where summoners meet. Let your team shine.',
      )}
    >
      <div
        className="arena-mode-nav"
        role="group"
        aria-label={t('Chế độ đấu trường', 'Arena mode')}
      >
        {modes.map((item) => (
          <button key={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
            <item.icon aria-hidden="true" />
            <span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            {mode === item.id && (
              <Check className="arena-mode-check" size={16} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div className="arena-content">
        <aside className={`arena-preview ${ranked ? 'is-ranked' : ''}`}>
          <div className="arena-preview-art" aria-hidden="true">
            <span className="arena-orbit" />
            {mode === 'custom' ? <Users /> : ranked ? <Trophy /> : <Swords />}
            <span className="arena-art-star">✦</span>
          </div>
          <span className="arena-eyebrow">{t('ĐẤU TRƯỜNG TRIỆU HỒI', 'SUMMONER ARENA')}</span>
          <h2>{modes.find((item) => item.id === mode)!.title}</h2>
          <p>
            {mode === 'custom'
              ? t(
                  'Tạo phòng riêng hoặc nhập mã mời. Tập hợp bạn bè và cùng so tài!',
                  'Create a private room or enter an invitation code. Bring a friend and battle!',
                )
              : ranked
                ? t(
                    'Mỗi trận đấu là một bước tiến. Phối hợp đội hình và vươn lên bảng xếp hạng.',
                    'Every battle is a step forward. Build your team and rise through the ranks.',
                  )
                : t(
                    'Thử đội hình mới, tìm chiến thuật hay và tận hưởng từng trận đấu.',
                    'Try new teams, discover strategies and enjoy every battle.',
                  )}
          </p>
          <div className="arena-rank-note">
            {ranked ? <Crown size={20} /> : <Shield size={20} />}
            <span>
              {mode === 'custom'
                ? t('Phòng riêng · PvP 1vs1', 'Private room · PvP 1v1')
                : ranked
                  ? t('Chưa xếp hạng', 'Unranked')
                  : t('Không tính điểm hạng', 'No rank points')}
              <small>
                {ranked
                  ? t('Hành trình thứ hạng sắp bắt đầu', 'Your ranked journey is coming soon')
                  : mode === 'custom'
                    ? t('Sử dụng PvP hiện tại', 'Existing PvP rooms')
                    : t(
                        'Thoải mái luyện tập cùng người chơi',
                        'Practice freely with other players',
                      )}
              </small>
            </span>
          </div>
        </aside>
        {mode === 'custom' ? (
          <section className="arena-options arena-custom">
            <span className="arena-step">
              <LockKeyhole size={18} /> {t('SÂN CHƠI CỦA BẠN', 'YOUR OWN ARENA')}
            </span>
            <h3>{t('Một lời mời, một trận so tài', 'One invitation. One great battle.')}</h3>
            <p>
              {t(
                'Chọn linh thú, thiết lập luật đấu và chia sẻ mã phòng cho bạn bè. Bạn cũng có thể tham gia bằng mã phòng có sẵn.',
                'Choose companions, set match rules and share your room code. You can also join with an existing code.',
              )}
            </p>
            <div className="arena-custom-steps">
              {[
                t('Tạo hoặc tham gia phòng', 'Create or join a room'),
                t('Chọn đội hình & luật đấu', 'Choose your team & rules'),
                t('Sẵn sàng và bắt đầu', 'Ready up and battle'),
              ].map((label, index) => (
                <div key={label}>
                  <b>0{index + 1}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="arena-help">
              {t(
                'Hiện hỗ trợ PvP 1vs1 với các luật đấu đang có.',
                'Currently supports 1v1 PvP with existing match rules.',
              )}
            </p>
            <button
              className="fantasy-frame arena-continue"
              onClick={() => {
                set({ mode: 'online', team: [], snapshot: null });
                go('online');
              }}
            >
              <Users size={19} />
              {t('Vào phòng tuỳ chỉnh', 'Enter custom room')}
              <ArrowRight size={19} />
            </button>
          </section>
        ) : (
          <section className="arena-options" aria-label={t('Tuỳ chọn trận đấu', 'Match options')}>
            <fieldset>
              <legend>
                <span>01</span>
                {t('Lối chơi', 'Battle style')}
              </legend>
              <div className="arena-style-choices">
                {[
                  {
                    id: 'duel' as const,
                    icon: Swords,
                    title: t('Đối kháng', 'Duel'),
                    text: t('So tài, làm chủ trận đấu', 'Face off and take control'),
                  },
                  {
                    id: 'tactics' as const,
                    icon: Sparkles,
                    title: t('Chiến thuật', 'Tactics'),
                    text: t('Toàn bộ thú, đa dạng đội hình', 'Full roster, more possibilities'),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={style === item.id}
                    onClick={() => setStyle(item.id)}
                  >
                    <item.icon size={23} aria-hidden="true" />
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <span>02</span>
                {t('Số người mỗi đội', 'Players per team')}
              </legend>
              <div className="arena-choice-row">
                {([1, 2] as const).map((n) => (
                  <button key={n} aria-pressed={players === n} onClick={() => setPlayers(n)}>
                    <Users size={18} aria-hidden="true" />
                    <strong>
                      {n}vs{n}
                    </strong>
                    <small>
                      {n} {t('người / đội', 'per team')}
                    </small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <span>03</span>
                {t('Thú triệu hồi mỗi người', 'Companions per player')}
              </legend>
              {tactical ? (
                <div className="arena-fixed-roster">
                  <LockKeyhole size={18} />
                  <strong>{t('Toàn bộ', 'All')}</strong>
                  <span>{t('Cố định trong chế độ Chiến thuật', 'Fixed for Tactics mode')}</span>
                </div>
              ) : (
                <div className="arena-choice-row arena-pet-choices">
                  {([3, 6, 'all'] as const).map((n) => (
                    <button key={n} aria-pressed={pets === n} onClick={() => setPets(n)}>
                      <strong>
                        {n === 'all' ? t('Toàn bộ', 'All') : `${n} ${t('thú', 'companions')}`}
                      </strong>
                      {pets === n && <Check size={16} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="arena-selection-summary" aria-live="polite">
              <span>
                {ranked ? t('Đấu hạng', 'Ranked') : t('Đấu thường', 'Casual')} ·{' '}
                {tactical ? t('Chiến thuật', 'Tactics') : t('Đối kháng', 'Duel')}
              </span>
              <strong>
                {players}vs{players} <i>·</i> {petLabel} / {t('người', 'player')}
              </strong>
            </div>
            <button className="fantasy-frame arena-continue" disabled>
              <LockKeyhole size={18} />
              {t('Tìm trận · Sắp ra mắt', 'Find match · Coming soon')}
            </button>
            <p className="arena-help">
              {t(
                'Bạn có thể chọn trước cấu hình. Tính năng ghép trận',
                'Explore your match settings. Matchmaking',
              )}
              {ranked
                ? t(
                    ' và tính điểm hạng sẽ được bổ sung sau.',
                    ' and rank scoring will be added later.',
                  )
                : t(' sẽ được bổ sung sau.', ' will be added later.')}
            </p>
          </section>
        )}
      </div>
    </Dialog>
  );
}
