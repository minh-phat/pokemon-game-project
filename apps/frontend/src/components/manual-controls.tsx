'use client';
import { useEffect } from 'react';
import { POKEMON } from '@arena/game-data';
import { STAMINA_RULES, type BattleSnapshot, type ManualBattleCommand } from '@arena/shared-types';
import { Portrait } from './common';
import { Button } from './ui/button';

type ManualInput = ManualBattleCommand extends infer T
  ? T extends ManualBattleCommand
    ? Omit<T, 'fighterId'>
    : never
  : never;

export function ManualControls({
  snapshot,
  team,
  disabled,
  command,
  selectedId,
  onSelect,
}: {
  snapshot: BattleSnapshot;
  team: number;
  disabled: boolean;
  command: (value: ManualBattleCommand) => void;
  selectedId: string;
  onSelect: (fighterId: string) => void;
}) {
  const active = snapshot.fighters.filter((f) => f.team === team && f.active && f.hp > 0);
  const selected = active.find((f) => f.id === selectedId) ?? active[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) onSelect(selected.id);
  }, [selected?.id, selectedId, onSelect]);
  const fighterId = selected?.id;
  const send = (value: ManualInput) => {
    if (fighterId && !disabled) command({ ...value, fighterId } as ManualBattleCommand);
  };
  const canAct =
    !disabled &&
    !!selected &&
    !selected.cast &&
    selected.actionTime === 0 &&
    !selected.effects.some((e) => e.kind === 'stun');
  const canDodge =
    !disabled &&
    !!selected &&
    (!selected.cast || selected.cast.autoBasic) &&
    selected.actionTime === 0 &&
    !selected.effects.some((e) => e.kind === 'stun') &&
    selected.y <= 1 &&
    selected.stamina >= STAMINA_RULES.dodgeCost;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || disabled || event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]'))
      )
        return;
      const code = event.code;
      const dodgeMode =
        code === 'Space'
          ? 'jump'
          : code === 'ShiftLeft' || code === 'ShiftRight'
            ? 'dash'
            : code === 'KeyC'
              ? 'crouch'
              : null;
      if (dodgeMode) {
        event.preventDefault();
        if (canDodge) send({ type: 'dodge', mode: dodgeMode });
        return;
      }
      if (event.shiftKey) return;
      if (code === 'KeyG') {
        event.preventDefault();
        if (canAct || selected.guarded) send({ type: 'guard', active: !selected.guarded });
        return;
      }
      const match = /^(?:Digit|Numpad)([1-4])$/.exec(code);
      if (!match) return;
      event.preventDefault();
      const skill = POKEMON[selected.species].skills[Number(match[1]) - 1];
      if (
        canAct &&
        skill &&
        selected.energy >= skill.energy &&
        (selected.cooldowns[skill.id] ?? 0) <= 0
      )
        send({ type: 'skill', skillId: skill.id });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, disabled, canAct, canDodge, command]);
  if (!selected) return null;
  return (
    <section className="manual-controls panel" aria-label="Manual battle controls">
      <div className="manual-picker" role="group" aria-label="Choose active Pokémon">
        {active.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`manual-pokemon ${f.id === selected.id ? 'selected' : ''}`}
            aria-pressed={f.id === selected.id}
            aria-label={`${POKEMON[f.species].name} ${Math.ceil(f.hp)} HP`}
            title={`${POKEMON[f.species].name} · ${Math.ceil(f.hp)} HP`}
            onClick={() => onSelect(f.id)}
            disabled={disabled}
          >
            <span aria-hidden="true">
              <Portrait id={f.species} />
            </span>
          </button>
        ))}
      </div>
      <div className="manual-actions">
        <div className="manual-defense" role="group" aria-label="Defense controls">
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label="Dash · 15"
            title="Dash · 15 stamina · Shift"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'dash' })}
          >
            Dash <kbd aria-hidden="true">Shift</kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label="Jump · 15"
            title="Jump · 15 stamina · Space"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'jump' })}
          >
            Jump <kbd aria-hidden="true">Space</kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label="Crouch · 15"
            title="Crouch · 15 stamina · C"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'crouch' })}
          >
            Crouch <kbd aria-hidden="true">C</kbd>
          </Button>
          <Button
            variant={selected.guarded ? 'default' : 'outline'}
            size="sm"
            type="button"
            aria-pressed={selected.guarded}
            aria-label={selected.guarded ? 'Release guard' : 'Guard · −20%'}
            title="Guard · reduces damage by 20% · G"
            disabled={disabled || (!canAct && !selected.guarded)}
            onClick={() => send({ type: 'guard', active: !selected.guarded })}
          >
            {selected.guarded ? 'Release' : 'Guard'} <kbd aria-hidden="true">G</kbd>
          </Button>
        </div>
        <div className="manual-skills" role="group" aria-label="Skill controls">
          {POKEMON[selected.species].skills.map((skill, index) => {
            const remaining = selected.cooldowns[skill.id] ?? 0;
            return (
              <Button
                key={skill.id}
                variant="outline"
                size="sm"
                type="button"
                aria-label={`${skill.name} ${remaining > 0 ? `${remaining.toFixed(1)}s` : `${skill.energy} EN`}`}
                disabled={!canAct || selected.energy < skill.energy || remaining > 0}
                title={`${skill.name}: ${skill.energy} energy · ${skill.cooldown}s cooldown · ${index + 1}`}
                onClick={() => send({ type: 'skill', skillId: skill.id })}
              >
                <span>{skill.name}</span>
                {remaining > 0 && <small>{remaining.toFixed(1)}s</small>}
                <kbd aria-hidden="true">{index + 1}</kbd>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
