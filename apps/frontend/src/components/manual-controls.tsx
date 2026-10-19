'use client';
import { useEffect, useRef } from 'react';
import { POKEMON } from '@arena/game-data';
import { STAMINA_RULES, type BattleSnapshot, type ManualBattleCommand } from '@arena/shared-types';
import { Portrait } from './common';
import { Button } from './ui/button';

type ManualInput = ManualBattleCommand extends infer T
  ? T extends ManualBattleCommand
    ? Omit<T, 'fighterId'>
    : never
  : never;

const directionCodes = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
]);
function dodgeDirection(keys: Set<string>) {
  return {
    direction:
      Number(keys.has('KeyD') || keys.has('ArrowRight')) -
      Number(keys.has('KeyA') || keys.has('ArrowLeft')),
    depthDirection:
      Number(keys.has('KeyS') || keys.has('ArrowDown')) -
      Number(keys.has('KeyW') || keys.has('ArrowUp')),
  };
}
function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]'))
  );
}

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
  const heldDirections = useRef(new Set<string>());
  const shiftUsed = useRef(false);
  const controlHeld = useRef(false);
  const controlUsed = useRef(false);
  const active = snapshot.fighters.filter((f) => f.team === team && f.active && f.hp > 0);
  const enemies = snapshot.fighters.filter((f) => f.team !== team && f.active && f.hp > 0);
  const selected =
    active.find((f) => f.id === selectedId) ??
    active.find((f) => f.id === snapshot.controlledFighterIds[team]) ??
    active[0];
  const target = snapshot.fighters.find(
    (f) => f.id === selected?.targetId && f.active && f.hp > 0 && f.team !== team,
  );
  useEffect(() => {
    if (selected && selected.id !== selectedId) onSelect(selected.id);
  }, [selected?.id, selectedId, onSelect]);
  const fighterId = selected?.id;
  const send = (value: ManualInput) => {
    if (fighterId && !disabled) command({ ...value, fighterId } as ManualBattleCommand);
  };
  const switchTarget = () => {
    if (!selected || disabled || enemies.length < 2) return;
    const index = enemies.findIndex((f) => f.id === selected.targetId);
    send({ type: 'target', targetId: enemies[(index + 1) % enemies.length].id });
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
      const code = event.code;
      if (code === 'ControlLeft' || code === 'ControlRight') {
        if (!event.repeat) {
          controlHeld.current = true;
          controlUsed.current =
            isTypingTarget(event.target) || event.altKey || event.metaKey || event.shiftKey;
        }
        return;
      }
      if (event.ctrlKey && controlHeld.current) controlUsed.current = true;
      if (!selected || disabled || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      if (directionCodes.has(code)) {
        if (code.startsWith('Arrow')) event.preventDefault();
        heldDirections.current.add(code);
        if (event.shiftKey) {
          event.preventDefault();
          shiftUsed.current = true;
          if (!event.repeat && canDodge)
            send({ type: 'dodge', mode: 'dash', ...dodgeDirection(heldDirections.current) });
        }
        return;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        event.preventDefault();
        if (event.repeat) return;
        const direction = dodgeDirection(heldDirections.current);
        shiftUsed.current = direction.direction !== 0 || direction.depthDirection !== 0;
        if (shiftUsed.current && canDodge) send({ type: 'dodge', mode: 'dash', ...direction });
        return;
      }
      if (event.repeat) return;
      if (code === 'KeyT') {
        event.preventDefault();
        switchTarget();
        return;
      }
      const dodgeMode = code === 'Space' ? 'jump' : code === 'KeyC' ? 'crouch' : null;
      if (dodgeMode) {
        event.preventDefault();
        if (canDodge) send({ type: 'dodge', mode: dodgeMode });
        return;
      }
      if (event.shiftKey) {
        shiftUsed.current = true;
        return;
      }
      if (code === 'KeyG') {
        event.preventDefault();
        if (canAct || selected.guarded) send({ type: 'guard', active: !selected.guarded });
        return;
      }
      const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
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
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
        const switchFighter =
          controlHeld.current &&
          !controlUsed.current &&
          !disabled &&
          !!selected &&
          active.length > 1 &&
          !isTypingTarget(event.target);
        controlHeld.current = false;
        controlUsed.current = false;
        if (switchFighter) {
          const index = active.findIndex((fighter) => fighter.id === selected.id);
          onSelect(active[(index + 1) % active.length].id);
        }
        return;
      }
      if (directionCodes.has(event.code)) heldDirections.current.delete(event.code);
      if (event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') return;
      const wasUsed = shiftUsed.current;
      shiftUsed.current = false;
      if (!wasUsed && canDodge && selected && !disabled && !isTypingTarget(event.target))
        send({ type: 'dodge', mode: 'dash' });
    };
    const onBlur = () => {
      heldDirections.current.clear();
      shiftUsed.current = true;
      controlHeld.current = false;
      controlUsed.current = true;
    };
    const onPointerDown = () => {
      if (controlHeld.current) controlUsed.current = true;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [active, enemies, selected, disabled, canAct, canDodge, command, onSelect]);
  if (!selected) return null;
  return (
    <section className="manual-controls panel" aria-label="Manual battle controls">
      <span className="manual-target" aria-live="polite">
        Target: <strong>{target ? POKEMON[target.species].name : 'None'}</strong>
      </span>
      {enemies.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          type="button"
          title="Switch to the next opponent · T"
          disabled={disabled}
          onClick={switchTarget}
        >
          Switch target <kbd aria-hidden="true">T</kbd>
        </Button>
      )}
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
        {active.length > 1 && (
          <kbd className="manual-switch-hint" title="Press Ctrl to control the next Pokémon">
            Ctrl
          </kbd>
        )}
      </div>
      <div className="manual-actions">
        <div className="manual-defense" role="group" aria-label="Defense controls">
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label="Dash · 15"
            title="Dash · 15 stamina · Shift + WASD or arrow keys to choose a direction"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'dash' })}
          >
            Dash <kbd aria-hidden="true">Shift+WASD/↑↓←→</kbd>
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
