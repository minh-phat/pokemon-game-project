'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Swords } from 'lucide-react';
import { POKEMON, calculatePetStats, combatPower } from '@arena/game-data';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { leaveRoom, readyMatchPets, selectMatchPets } from '@/lib/network';
import { Button } from './ui/button';
import { Portrait } from './common';

export function MatchSelectionScreen() {
  const { t, language } = useLanguage();
  const state = useGame();
  const selection = state.matchSelection;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const pets = useMemo(
    () =>
      (selection?.pets ?? [])
        .map((pet) => ({
          pet,
          power: combatPower(calculatePetStats(POKEMON[pet.species], pet)),
        }))
        .sort((a, b) => b.power - a.power || a.pet.id.localeCompare(b.pet.id)),
    [selection?.pets],
  );
  if (!selection)
    return (
      <div className="page-wrap narrow">
        <p>{t('Đang chuẩn bị chọn đội hình…', 'Preparing team selection…')}</p>
      </div>
    );
  const seconds = Math.max(0, Math.ceil((selection.deadline - now) / 1000));
  const locked = selection.ready || seconds === 0 || state.connection !== 'connected';
  const opponent = state.lobby?.players.find((player) => player.id !== state.sessionId);
  function toggle(id: string) {
    const current = useGame.getState().matchSelection;
    if (!current || locked) return;
    const selected = current.selected.includes(id)
      ? current.selected.filter((item) => item !== id)
      : current.selected.length < current.size
        ? [...current.selected, id]
        : current.selected;
    if (selected === current.selected) return;
    state.set({ matchSelection: { ...current, selected, revision: current.revision + 1 } });
    selectMatchPets(selected);
  }
  return (
    <div className="page-wrap match-selection">
      <div className="match-selection-heading">
        <div>
          <span className="eyebrow">{t('ĐÃ TÌM THẤY ĐỐI THỦ', 'OPPONENT FOUND')}</span>
          <h1>{t('Chọn đội hình ra trận', 'Choose your team')}</h1>
          <p>
            {t(
              'Chọn thú bạn sở hữu. Các ô còn trống sẽ được tự động điền bằng thú mạnh nhất.',
              'Choose your companions. Empty slots will be filled with your strongest remaining companions.',
            )}
          </p>
        </div>
        <div className="match-selection-timer" aria-live="polite">
          <Clock3 size={20} /> <strong>{seconds}s</strong>
        </div>
      </div>
      <div className="match-selection-status panel">
        <span>
          <Swords size={18} /> {t('Đối thủ', 'Opponent')}:{' '}
          <strong>{opponent?.name ?? '...'}</strong>
        </span>
        <span>
          {selection.opponentReady
            ? t('Đối thủ đã sẵn sàng', 'Opponent is ready')
            : t('Đối thủ đang chọn', 'Opponent is choosing')}
        </span>
        <strong>
          {selection.selected.length} / {selection.size}
        </strong>
      </div>
      <div
        className="match-selection-grid"
        role="group"
        aria-label={t('Thú của bạn', 'Your companions')}
      >
        {pets.map(({ pet, power }) => {
          const index = selection.selected.indexOf(pet.id);
          return (
            <button
              type="button"
              key={pet.id}
              className={`match-selection-pet ${index >= 0 ? 'is-selected' : ''}`}
              aria-pressed={index >= 0}
              disabled={locked || (index < 0 && selection.selected.length >= selection.size)}
              onClick={() => toggle(pet.id)}
            >
              <span className="match-selection-portrait">
                <Portrait id={pet.species} />
              </span>
              <strong>{POKEMON[pet.species].name}</strong>
              <span>
                Lv.{pet.level} · {pet.quality}
              </span>
              <small>
                {t('Chiến lực', 'Power')}{' '}
                {power.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
              </small>
              {index >= 0 && (
                <b className="match-selection-number">
                  <Check size={13} /> {index + 1}
                </b>
              )}
            </button>
          );
        })}
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      <div className="match-selection-actions">
        <Button variant="outline" onClick={leaveRoom}>
          {t('Rời trận', 'Leave match')}
        </Button>
        <span>
          {t(
            'Rời trận sau khi ghép được tính là thua.',
            'Leaving after matching counts as a loss.',
          )}
        </span>
        <Button disabled={locked} onClick={readyMatchPets}>
          {selection.ready ? t('Đã sẵn sàng', 'Ready') : t('Xác nhận đội hình', 'Confirm team')}
        </Button>
      </div>
    </div>
  );
}
