'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, PawPrint } from 'lucide-react';
import { POKEMON } from '@arena/game-data';
import {
  speciesIds,
  PET_QUALITIES,
  type PetCollection,
  type SummonResult,
} from '@arena/shared-types';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';
import { Portrait, ElementBadge } from './common';

async function requestCollection(summon = false): Promise<SummonResult> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${summon ? 'summon' : 'pets'}`,
    {
      method: summon ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-Arena-Request': '1' },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export function PetsDialog({ view, onClose }: { view: 'pets' | 'summon'; onClose: () => void }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(view);
  const [collection, setCollection] = useState<PetCollection | null>(null);
  const [result, setResult] = useState<SummonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  const load = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const data = await requestCollection();
      if (active.current) setCollection(data);
    } catch {
      if (active.current) setError(true);
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, []);
  const summon = async () => {
    if (locked.current || !collection) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    setResult(null);
    try {
      const data = await requestCollection(true);
      if (active.current) {
        setCollection(data);
        setResult(data);
      }
    } catch {
      if (active.current) {
        setError(true);
        setCollection(null);
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  const owned = collection?.pets ?? [];
  const total = owned.reduce((sum, pet) => sum + pet.count, 0);
  const speciesCount = new Set(owned.map((pet) => pet.species)).size;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="pets-dialog"
      title={
        tab === 'summon'
          ? t('Triệu Hồi Linh Thú', 'Summon Companions')
          : t('Pets của bạn', 'Your Pets')
      }
      description={t(
        'Gắn kết linh thú · Viết nên huyền thoại',
        'Befriend companions · Begin a legend',
      )}
    >
      <div className="pets-tabs">
        <button aria-pressed={tab === 'summon'} onClick={() => setTab('summon')}>
          <Sparkles size={18} />
          {t('Triệu Hồi', 'Summon')}
        </button>
        <button aria-pressed={tab === 'pets'} onClick={() => setTab('pets')}>
          <PawPrint size={18} />
          Pets{collection && ` (${total})`}
        </button>
      </div>
      {error && (
        <div role="alert" className="pets-error">
          <p>
            {t(
              'Không thể tải kết quả. Hãy tải lại bộ sưu tập để kiểm tra trước khi triệu hồi tiếp.',
              'Could not load the result. Reload your collection before summoning again.',
            )}
          </p>
          <button
            className="fantasy-frame fantasy-action"
            disabled={busy}
            onClick={() => void load()}
          >
            {t('Tải lại', 'Reload')}
          </button>
        </div>
      )}
      {busy && !collection && (
        <p role="status">{t('Đang tải bộ sưu tập…', 'Loading collection…')}</p>
      )}
      {collection &&
        (tab === 'summon' ? (
          <div className="summon-panel">
            <div className={`summon-orb ${busy ? 'is-summoning' : ''}`} aria-hidden="true">
              {result?.received ? (
                <Portrait id={result.received.species} />
              ) : (
                <Sparkles size={64} />
              )}
            </div>
            <div className="summon-result" role="status" aria-live="polite">
              {busy ? (
                <h3>{t('Đang triệu hồi…', 'Summoning…')}</h3>
              ) : result ? (
                <>
                  <h3>
                    {POKEMON[result.received.species].name}{' '}
                    <span className={`pet-quality quality-${result.received.quality}`}>
                      {result.received.quality}
                    </span>
                  </h3>
                  <p>{t('Linh thú đã vào Pets của bạn!', 'Your companion is now in Pets!')}</p>
                </>
              ) : (
                <>
                  <h3>{t('Đánh thức mối liên kết', 'Awaken your bond')}</h3>
                  <p>{t('Một người bạn mới đang chờ bạn.', 'A new companion awaits you.')}</p>
                </>
              )}
            </div>
            <div className="summon-stats">
              <span>
                {t('Đã triệu hồi', 'Attempts')} <b>{collection.attempts}</b>
              </span>
              <span>
                {t('Nhận thú', 'Companion chance')} <b>100%</b>
              </span>
            </div>
            <div className="summon-guarantees">
              {collection.guarantees.map(({ quality, remaining }) => (
                <div key={quality}>
                  <span className={`pet-quality quality-${quality}`}>{quality}+</span>
                  <strong>
                    {remaining === 1
                      ? t('Bảo đảm lượt tới!', 'Guaranteed next!')
                      : t(`Còn ${remaining} lượt`, `${remaining} summons left`)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="pets-note">
              {t(
                'Tỉ lệ phẩm chất ở lượt tiếp theo (đã tính bảo đảm)',
                'Next summon quality chances (guarantees included)',
              )}
            </p>
            <div className="summon-quality-odds">
              {PET_QUALITIES.map((quality) => (
                <div key={quality}>
                  <span className={`pet-quality quality-${quality}`}>{quality}</span>
                  <b>{Number((collection.qualityOdds[quality] / 100).toFixed(2))}%</b>
                </div>
              ))}
            </div>
            <p className="pets-note">
              {t(
                'Mỗi lượt đều nhận 1 thú. Càng triệu hồi nhiều, cơ hội ra phẩm chất cao càng tăng (đạt tối đa sau 1.000 lượt). Bảo đảm lặp lại: mỗi 11 lượt ≥ A, 101 lượt ≥ S, 1.001 lượt SS. Ra phẩm chất cao sớm không đặt lại bộ đếm. Trùng mốc nhận bảo đảm cao nhất.',
                'Every summon grants a companion. Higher-quality chances grow with total summons (capped after 1,000). Repeating guarantees: every 11 summons ≥ A, 101 ≥ S, 1,001 SS. Early lucky rolls do not reset counters. Overlapping milestones use the highest guarantee.',
              )}
            </p>
            <button
              className="fantasy-frame fantasy-action gold"
              disabled={busy}
              onClick={() => void summon()}
            >
              <Sparkles size={20} />
              {t('Triệu hồi', 'Summon now')} · {collection.cost} {t('vàng', 'gold')}
            </button>
            <p className="pets-note">
              {t('Miễn phí trong giai đoạn hiện tại', 'Free during this phase')}
            </p>
          </div>
        ) : (
          <>
            <div className="pets-summary">
              <span>{t('Bộ sưu tập linh thú', 'Companion collection')}</span>
              <b>
                {speciesCount}/{speciesIds.length} {t('loài', 'species')} · {total} pets
              </b>
            </div>
            {owned.length ? (
              <div className="owned-pets-grid">
                {owned.map(({ species: id, quality, count }) => (
                  <article className={`owned-pet pet-border-${quality}`} key={`${id}-${quality}`}>
                    <span className="owned-pet-count">×{count}</span>
                    <Portrait id={id} />
                    <h3>{POKEMON[id].name}</h3>
                    <span className={`pet-quality quality-${quality}`}>
                      {t('Phẩm chất', 'Quality')} {quality}
                    </span>
                    <ElementBadge element={POKEMON[id].element} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="pets-empty">
                <PawPrint size={48} />
                <h3>{t('Chưa có linh thú nào', 'No companions yet')}</h3>
                <p>
                  {t(
                    'Triệu hồi miễn phí để gặp người bạn đầu tiên.',
                    'Summon for free to meet your first companion.',
                  )}
                </p>
                <button
                  className="fantasy-frame fantasy-action gold"
                  onClick={() => setTab('summon')}
                >
                  {t('Triệu hồi ngay', 'Start summoning')}
                </button>
              </div>
            )}
          </>
        ))}
    </Dialog>
  );
}
