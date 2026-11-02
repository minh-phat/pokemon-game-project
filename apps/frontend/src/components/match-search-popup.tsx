'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { cancelMatchSearch } from '@/lib/network';

export function MatchSearchPopup() {
  const startedAt = useGame((state) => state.matchSearchStartedAt);
  const connection = useGame((state) => state.connection);
  const { t } = useLanguage();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (startedAt === null) return null;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <aside className="match-search-popup" aria-label={t('Tìm trận', 'Match search')}>
      <LoaderCircle size={23} aria-hidden="true" />
      <div>
        <strong role="status">
          {connection === 'reconnecting'
            ? t('Đang kết nối lại…', 'Reconnecting…')
            : t('Đang tìm trận…', 'Finding a match…')}
        </strong>
        <span role="timer" aria-label={t('Thời gian tìm trận', 'Search elapsed time')}>
          {Math.floor(elapsed / 60)
            .toString()
            .padStart(2, '0')}
          :{(elapsed % 60).toString().padStart(2, '0')}
        </span>
        <small>
          {t(
            'Gặp AI sau 30 giây nếu chưa có đối thủ.',
            'AI opponent after 30 seconds without a match.',
          )}
        </small>
      </div>
      <button
        type="button"
        onClick={cancelMatchSearch}
        aria-label={t('Hủy tìm trận', 'Cancel search')}
      >
        <X size={19} />
      </button>
    </aside>
  );
}
