'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Clock3, GripVertical, Swords } from 'lucide-react';
import { POKEMON, calculatePetStats, combatPower } from '@arena/game-data';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { leaveRoom, readyMatchPets, selectMatchPets, selectMatchSource } from '@/lib/network';
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
  const limit = selection.size === 'all' ? selection.pets.length : selection.size;
  const editing = selection.source === 'new' && !locked;
  function update(selected: string[]) {
    const current = useGame.getState().matchSelection;
    if (!current || !editing) return;
    state.set({
      matchSelection: { ...current, selected, source: 'new', revision: current.revision + 1 },
    });
    selectMatchPets(selected);
  }
  function move(id: string, target: string) {
    const selected = [...selection!.selected];
    const from = selected.indexOf(id);
    const to = selected.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    selected.splice(from, 1);
    selected.splice(to, 0, id);
    update(selected);
  }
  function toggle(id: string) {
    const current = useGame.getState().matchSelection;
    if (!current || locked) return;
    const selected = current.selected.includes(id)
      ? current.selected.filter((item) => item !== id)
      : current.selected.length < limit
        ? [...current.selected, id]
        : current.selected;
    if (selected === current.selected) return;
    update(selected);
  }
  return (
    <div className="page-wrap match-selection">
      <div className="match-selection-heading">
        <div>
          <span className="eyebrow">{t('ĐÃ TÌM THẤY ĐỐI THỦ', 'OPPONENT FOUND')}</span>
          <h1>{t('Chọn đội hình ra trận', 'Choose your team')}</h1>
          <p>
            {t(
              'Bạn có 30 giây để chọn từ đội hình đã lưu hoặc chọn mới cho trận này.',
              'You have 30 seconds to use your saved formation or choose a new team for this match.',
            )}
          </p>
        </div>
        <div
          className="match-selection-timer"
          role="timer"
          aria-label={t('Thời gian chọn đội hình', 'Team selection time')}
        >
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
          {selection.selected.length} /{' '}
          {selection.size === 'all' ? t('Toàn bộ', 'All') : selection.size}
        </strong>
      </div>
      <div
        className="formation-choices"
        role="group"
        aria-label={t('Cách chọn đội hình', 'Team selection source')}
      >
        <Button
          variant={selection.source === 'saved' ? 'default' : 'outline'}
          aria-pressed={selection.source === 'saved'}
          disabled={locked}
          onClick={() => selectMatchSource('saved')}
        >
          {t('Chọn từ đội hình', 'Use saved formation')}
        </Button>
        <Button
          variant={selection.source === 'new' ? 'default' : 'outline'}
          aria-pressed={selection.source === 'new'}
          disabled={locked}
          onClick={() => selectMatchSource('new')}
        >
          {t('Chọn mới', 'Choose new')}
        </Button>
      </div>
      <p className="hint">
        {selection.source === 'saved'
          ? selection.formation.length
            ? t(
                'Sử dụng đội hình đã lưu và thứ tự ra trận bên dưới. Bạn vẫn có thể chọn mới trước khi xác nhận hoặc hết giờ.',
                'Using your saved formation and summon order below. You can choose a new team before confirming or time runs out.',
              )
            : t(
                'Chưa có đội hình đã lưu. Bạn có thể chọn mới; nếu không, hệ thống dùng cách chọn thú hiện tại.',
                'No saved formation. Choose a new team or keep the existing automatic selection.',
              )
          : t(
              'Chọn thú và kéo thả hoặc dùng mũi tên để sắp xếp thứ tự. Lựa chọn này chỉ dùng cho trận này.',
              'Choose companions and drag or use arrows to reorder. These choices apply to this match only.',
            )}
      </p>
      <ol className="formation-order" aria-label={t('Thứ tự ra trận', 'Summon order')}>
        {selection.selected.map((id, index) => {
          const pet = selection.pets.find((pet) => pet.id === id)!;
          const name = POKEMON[pet.species].name;
          return (
            <li
              key={id}
              data-formation-id={id}
              draggable={editing}
              onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
              onDragOver={(event) => {
                if (editing) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (editing) move(event.dataTransfer.getData('text/plain'), id);
              }}
            >
              {editing && (
                <button
                  className="formation-grip"
                  aria-label={`${t('Di chuyển', 'Move')} ${name}`}
                  onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                  onPointerUp={(event) => {
                    const target = document
                      .elementFromPoint(event.clientX, event.clientY)
                      ?.closest<HTMLElement>('[data-formation-id]');
                    if (target?.dataset.formationId) move(id, target.dataset.formationId);
                  }}
                >
                  <GripVertical size={18} />
                </button>
              )}
              <b>{index + 1}</b>
              <Portrait id={pet.species} />
              <span>
                <strong>{name}</strong>
                <small>
                  Lv.{pet.level} · {pet.quality}
                </small>
              </span>
              {editing && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    aria-label={`${t('Lên', 'Move up')} ${name}`}
                    onClick={() => move(id, selection.selected[index - 1])}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === selection.selected.length - 1}
                    aria-label={`${t('Xuống', 'Move down')} ${name}`}
                    onClick={() => move(id, selection.selected[index + 1])}
                  >
                    <ArrowDown size={16} />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ol>
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
              disabled={!editing || (index < 0 && selection.selected.length >= limit)}
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
