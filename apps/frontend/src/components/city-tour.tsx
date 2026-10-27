'use client';
import { Check, Footprints, Sun } from 'lucide-react';
import { CITY_TOUR } from '@/game/binh-minh-tour';
import { useLanguage } from '@/lib/i18n';

export function CityTour({
  visited,
  onWalk,
  error,
}: {
  visited: string[];
  onWalk: (stop: (typeof CITY_TOUR)[number]) => void;
  error: string;
}) {
  const { language, t } = useLanguage();
  const locale = language === 'vi' ? 0 : 1;
  return (
    <div className="city-tour">
      <div className="city-tour-intro">
        <Sun size={38} strokeWidth={1} />
        <div>
          <span>BÌNH MINH · CITY WALK</span>
          <h3>{t('Đi chậm. Nhìn gần hơn.', 'Slow down. Look closer.')}</h3>
          <p>
            {t(
              'Bốn góc nhỏ để làm quen với thành phố. Đi đến gần để ghi dấu trong lần dạo này.',
              'Four little corners to get to know the city. Approach each one to mark this walk.',
            )}
          </p>
        </div>
      </div>
      <div className="city-tour-progress">
        <span>{t('Dấu chân của bạn', 'Your footsteps')}</span>
        <strong>
          {visited.length} / {CITY_TOUR.length}
        </strong>
      </div>
      <progress
        aria-label={t('Tiến độ dạo phố', 'City walk progress')}
        value={visited.length}
        max={CITY_TOUR.length}
      />
      {error && <p role="alert">{error}</p>}
      <div className="city-tour-stops">
        {CITY_TOUR.map((stop, i) => {
          const seen = visited.includes(stop.id);
          return (
            <article key={stop.id}>
              <div className="city-tour-number" style={{ color: stop.color }}>
                {seen ? <Check size={21} /> : `0${i + 1}`}
              </div>
              <div>
                <small>{stop.subtitle[locale]}</small>
                <h4>{stop.title[locale]}</h4>
                <p>{stop.story[locale]}</p>
                <button onClick={() => onWalk(stop)}>
                  <Footprints size={14} />
                  {t('Đi bộ đến đây', 'Walk here')}
                  {seen && <span> · {t('Đã ghé', 'Visited')}</span>}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="city-tour-note">
        {t(
          'Nhấn hướng di chuyển để tự đi tiếp bất cứ lúc nào.',
          'Use the movement controls to take over at any time.',
        )}
      </p>
    </div>
  );
}
