'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { POKEMON } from '@arena/game-data';
import type { OwnedPet, PetCollection } from '@arena/shared-types';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Portrait } from './common';
import { FormationPetFilters, FormationPetStats, useFormationPets } from './formation-pet-browser';

type FormationKey = 'duel-3' | 'duel-6' | 'duel-all' | 'tactics-all';
export function FormationDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [style, setStyle] = useState<'duel' | 'tactics'>('duel');
  const [size, setSize] = useState<3 | 6 | 'all'>(3);
  const [draft, setDraft] = useState<Partial<Record<FormationKey, string[]>>>(
    () => useGame.getState().formations[userId] ?? {},
  );
  const [pets, setPets] = useState<OwnedPet[] | null>(null);
  const browser = useFormationPets(pets);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/pets`, {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const collection: PetCollection = await response.json();
        if (!controller.signal.aborted) setPets(collection.pets);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            t('Không thể tải thú. Vui lòng thử lại.', 'Could not load companions. Please retry.'),
          );
      });
    return () => controller.abort();
  }, [attempt, language]);
  const key: FormationKey = style === 'tactics' ? 'tactics-all' : `duel-${size}`;
  const owned = new Map((pets ?? []).map((pet) => [pet.id, pet]));
  const selected = (draft[key] ?? []).filter((id) => owned.has(id));
  const limit = style === 'tactics' || size === 'all' ? Infinity : size;
  function update(ids: string[]) {
    setDraft((current) => ({ ...current, [key]: ids }));
  }
  function move(id: string, targetId: string) {
    const from = selected.indexOf(id);
    const to = selected.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...selected];
    next.splice(from, 1);
    next.splice(to, 0, id);
    update(next);
  }
  const clean = Object.fromEntries(
    Object.entries(draft).map(([name, ids]) => [name, ids.filter((id) => owned.has(id))]),
  );
  const valid = ['duel-3', 'duel-6'].every(
    (name) => !clean[name]?.length || clean[name].length === (name === 'duel-3' ? 3 : 6),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="formation-dialog"
      title={t('Đội hình ra trận', 'Battle formations')}
      description={t(
        'Chọn thú sở hữu và sắp xếp thứ tự triệu hồi. Đội hình trống sẽ dùng cách vào trận hiện tại.',
        'Choose owned companions and their summon order. Empty formations use the existing battle selection.',
      )}
    >
      <div className="formation-toolbar">
        <div className="formation-choices" role="group" aria-label={t('Lối chơi', 'Battle style')}>
          {(['duel', 'tactics'] as const).map((value) => (
            <Button
              key={value}
              variant={style === value ? 'default' : 'outline'}
              aria-pressed={style === value}
              onClick={() => setStyle(value)}
            >
              {value === 'duel' ? t('Đối kháng', 'Duel') : t('Chiến thuật', 'Tactics')}
            </Button>
          ))}
        </div>
        {style === 'duel' && (
          <div
            className="formation-choices"
            role="group"
            aria-label={t('Quy mô đội hình', 'Formation size')}
          >
            {([3, 6, 'all'] as const).map((value) => (
              <Button
                key={value}
                variant={size === value ? 'default' : 'outline'}
                aria-pressed={size === value}
                onClick={() => setSize(value)}
              >
                {value === 'all' ? t('Toàn trận', 'Full roster') : `${value} vs ${value}`}
              </Button>
            ))}
          </div>
        )}
      </div>
      {style === 'tactics' && (
        <p className="hint">
          {t(
            'Đội hình toàn trận cho Chiến thuật. Chế độ này hiện chưa mở.',
            'Full roster formation for Tactics. This mode is not available yet.',
          )}
        </p>
      )}
      <div className="formation-workspace">
        <section className="formation-selected">
          <div className="formation-summary">
            <strong>
              {t('Thứ tự ra trận', 'Summon order')} · {selected.length}
              {limit !== Infinity && ` / ${limit}`}
            </strong>
            <Button size="sm" variant="outline" onClick={() => update([])}>
              {t('Bỏ chọn tất cả', 'Clear selection')}
            </Button>
          </div>
          <p className="hint">
            {t(
              'Kéo thả bằng tay nắm ⋮ hoặc dùng nút mũi tên để đổi thứ tự.',
              'Drag the ⋮ handle or use the arrow buttons to reorder.',
            )}
          </p>
          <details className="formation-roster" open>
            <summary>
              {t('Đội hình đã chọn', 'Selected team')} · {selected.length}
              {limit !== Infinity && ` / ${limit}`}
            </summary>
            {selected.length === 0 && (
              <p className="hint">
                {t(
                  'Chọn thú từ kho để thêm vào đội hình.',
                  'Choose companions from the collection to add them.',
                )}
              </p>
            )}
            <ol className="formation-order" aria-label={t('Thứ tự ra trận', 'Summon order')}>
              {selected.map((id, index) => {
                const pet = owned.get(id)!;
                const name = POKEMON[pet.species].name;
                return (
                  <li
                    key={id}
                    data-formation-id={id}
                    className={dragging === id ? 'is-dragging' : ''}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', id);
                      setDragging(id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      move(event.dataTransfer.getData('text/plain'), id);
                      setDragging(null);
                    }}
                  >
                    <button
                      className="formation-grip"
                      aria-label={`${t('Di chuyển', 'Move')} ${name}`}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDragging(id);
                      }}
                      onPointerUp={(event) => {
                        const target = document
                          .elementFromPoint(event.clientX, event.clientY)
                          ?.closest<HTMLElement>('[data-formation-id]');
                        if (target?.dataset.formationId) move(id, target.dataset.formationId);
                        setDragging(null);
                      }}
                      onPointerCancel={() => setDragging(null)}
                    >
                      <GripVertical size={18} />
                    </button>
                    <b>{index + 1}</b>
                    <Portrait id={pet.species} quality={pet.quality} />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        Lv.{pet.level} · {pet.quality}
                      </small>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      aria-label={`${t('Lên', 'Move up')} ${name}`}
                      onClick={() => move(id, selected[index - 1])}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === selected.length - 1}
                      aria-label={`${t('Xuống', 'Move down')} ${name}`}
                      onClick={() => move(id, selected[index + 1])}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('Bỏ chọn', 'Remove')} ${name}`}
                      onClick={() => update(selected.filter((item) => item !== id))}
                    >
                      <X size={16} />
                    </Button>
                  </li>
                );
              })}
            </ol>
          </details>
        </section>
        <section className="formation-collection" aria-label={t('Kho thú', 'Collection')}>
          {pets === null && !error && (
            <p role="status">{t('Đang tải thú…', 'Loading companions…')}</p>
          )}
          {error && (
            <p role="alert">
              {error}{' '}
              <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                {t('Thử lại', 'Retry')}
              </Button>
            </p>
          )}
          {pets?.length === 0 && (
            <p>
              {t(
                'Bạn chưa có thú. Hãy triệu hồi thú trước.',
                'You have no companions. Summon some first.',
              )}
            </p>
          )}
          {pets && pets.length > 0 && <FormationPetFilters browser={browser} />}
          <div
            className="match-selection-grid formation-pets"
            role="group"
            aria-label={t('Thú của bạn', 'Your companions')}
          >
            {browser.visible.map(({ pet, power }) => {
              const index = selected.indexOf(pet.id);
              return (
                <button
                  key={pet.id}
                  className={`match-selection-pet ${index >= 0 ? 'is-selected' : ''}`}
                  aria-pressed={index >= 0}
                  disabled={index < 0 && selected.length >= limit}
                  onClick={() =>
                    update(
                      index >= 0 ? selected.filter((id) => id !== pet.id) : [...selected, pet.id],
                    )
                  }
                >
                  <span className="match-selection-portrait">
                    <Portrait id={pet.species} quality={pet.quality} />
                  </span>
                  <strong>{POKEMON[pet.species].name}</strong>
                  <FormationPetStats pet={pet} power={power} />
                  {index >= 0 && <b className="match-selection-number">{index + 1}</b>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      {!valid && (
        <p role="status">
          {t(
            'Đội hình 3 vs 3 cần đủ 3 thú; 6 vs 6 cần đủ 6 thú. Hoặc bỏ chọn tất cả để dùng cách vào trận hiện tại.',
            'Choose exactly 3 or 6 companions for each sized formation, or clear it to use existing selection.',
          )}
        </p>
      )}
      <div className="formation-actions">
        <span className="hint">
          {t('Lưu theo tài khoản trên thiết bị này.', 'Saved per account on this device.')}
        </span>
        <Button variant="outline" onClick={onClose}>
          {t('Hủy', 'Cancel')}
        </Button>
        <Button
          disabled={!pets || !valid}
          onClick={() => {
            const state = useGame.getState();
            if (state.user?.id !== userId) return;
            state.set({ formations: { ...state.formations, [userId]: clean } });
            onClose();
          }}
        >
          {t('Lưu đội hình', 'Save formations')}
        </Button>
      </div>
    </Dialog>
  );
}
