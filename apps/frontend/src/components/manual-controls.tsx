'use client';
import { isConcealed } from '@arena/shared-types';
import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDownToLine,
  ArrowUp,
  Bomb,
  CircleDot,
  Crosshair,
  Droplets,
  Flame,
  Footprints,
  Leaf,
  Orbit,
  PawPrint,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Swords,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ELEMENTS, POKEMON } from '@arena/game-data';
import { STAMINA_RULES, type BattleSnapshot, type ManualBattleCommand } from '@arena/shared-types';
import { Portrait } from './common';
import { Button, type ButtonProps } from './ui/button';

const skillControls: Record<string, { icon: LucideIcon; label: string }> = {
  'quick-attack': { icon: Swords, label: 'Quick' },
  thunderbolt: { icon: Zap, label: 'Bolt' },
  'electro-ball': { icon: CircleDot, label: 'Orb' },
  'thunder-wave': { icon: Waves, label: 'Wave' },
  'volt-tackle': { icon: Footprints, label: 'Volt' },
  scratch: { icon: Swords, label: 'Scratch' },
  ember: { icon: Flame, label: 'Ember' },
  'ember-glyph': { icon: Flame, label: 'Ember Glyph' },
  flamethrower: { icon: Wind, label: 'Flame' },
  'flame-burst': { icon: Bomb, label: 'Burst' },
  'inferno-stream': { icon: Flame, label: 'Inferno' },
  'dragon-laser': { icon: Flame, label: 'Dragon Laser' },
  tackle: { icon: Swords, label: 'Tackle' },
  'water-gun': { icon: Droplets, label: 'Water' },
  'bubble-beam': { icon: Waves, label: 'Bubble' },
  'rapid-spin': { icon: Orbit, label: 'Spin' },
  'vine-whip': { icon: Leaf, label: 'Vine' },
  'razor-leaf': { icon: Leaf, label: 'Razor' },
  'leech-seed': { icon: Sparkles, label: 'Seed' },
  'solar-beam': { icon: Sun, label: 'Solar' },
  'sludge-bomb': { icon: Bomb, label: 'Sludge' },
  'eevee-strike': { icon: PawPrint, label: 'Paw' },
  swift: { icon: Star, label: 'Swift' },
  'shadow-step': { icon: Footprints, label: 'Step' },
  'counter-pounce': { icon: ShieldCheck, label: 'Counter' },
  'starfall-rush': { icon: Sparkles, label: 'Starfall' },
};

// Fire on contact so a second finger can act while the first holds the joystick.
function ControlButton({ onClick, ...props }: ButtonProps) {
  const touchedAt = useRef(-Infinity);
  return (
    <Button
      {...props}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' || props.disabled) return;
        event.preventDefault();
        touchedAt.current = performance.now();
        onClick?.(event);
      }}
      onClick={(event) => {
        if (event.detail === 0 || performance.now() - touchedAt.current > 750) onClick?.(event);
      }}
    />
  );
}

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
  const stick = useRef({ direction: 0, depthDirection: 0 });
  const stickKnob = useRef<HTMLSpanElement>(null);
  const stickPointerId = useRef<number | null>(null);
  const lastMovementSent = useRef(-Infinity);
  const commandRef = useRef(command);
  commandRef.current = command;
  const updateStick = (direction: number, depthDirection: number) => {
    stick.current = { direction, depthDirection };
    if (stickKnob.current)
      stickKnob.current.style.transform = `translate(${direction * 30}px, ${depthDirection * 30}px)`;
  };
  const active = snapshot.fighters.filter((f) => f.team === team && f.active && f.hp > 0);
  const enemies = snapshot.fighters.filter(
    (f) => f.team !== team && f.active && f.hp > 0 && !isConcealed(f),
  );
  const selected =
    active.find((f) => f.id === selectedId) ??
    active.find((f) => f.id === snapshot.controlledFighterIds[team]) ??
    active[0];
  const target = snapshot.fighters.find(
    (f) =>
      f.id === selected?.targetId && f.active && f.hp > 0 && f.team !== team && !isConcealed(f),
  );
  useEffect(() => {
    if (selected && selected.id !== selectedId) onSelect(selected.id);
  }, [selected?.id, selectedId, onSelect]);
  const fighterId = selected?.id;
  const send = (value: ManualInput) => {
    if (fighterId && !disabled) commandRef.current({ ...value, fighterId } as ManualBattleCommand);
  };
  const movementDirection = () =>
    Math.hypot(stick.current.direction, stick.current.depthDirection) > 0.08
      ? stick.current
      : dodgeDirection(heldDirections.current);
  const sendMovement = (force = false) => {
    const now = performance.now();
    if (!force && now - lastMovementSent.current < 90) return;
    lastMovementSent.current = now;
    send({ type: 'move', ...movementDirection() });
  };
  const moveStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width / 2;
    const x = (event.clientX - bounds.left - radius) / radius;
    const y = (event.clientY - bounds.top - radius) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    updateStick(x / length, y / length);
  };
  const releaseStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== event.pointerId) return;
    stickPointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    updateStick(0, 0);
    sendMovement(true);
  };
  useEffect(() => {
    if (disabled) return;
    const timer = window.setInterval(() => {
      const direction = movementDirection();
      if (Math.hypot(direction.direction, direction.depthDirection) > 0.08) sendMovement();
    }, 100);
    return () => window.clearInterval(timer);
  }, [disabled, fighterId]);
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
        if (!event.repeat) sendMovement(true);
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
      if (directionCodes.has(event.code)) {
        heldDirections.current.delete(event.code);
        sendMovement(true);
      }
      if (event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') return;
      const wasUsed = shiftUsed.current;
      shiftUsed.current = false;
      if (!wasUsed && canDodge && selected && !disabled && !isTypingTarget(event.target))
        send({ type: 'dodge', mode: 'dash' });
    };
    const onBlur = () => {
      heldDirections.current.clear();
      stickPointerId.current = null;
      updateStick(0, 0);
      sendMovement(true);
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
      <span className="manual-move-hint">Move: WASD / arrow keys</span>
      <span className="manual-target" aria-live="polite">
        Target: <strong>{target ? POKEMON[target.species].name : 'None'}</strong>
      </span>
      {enemies.length > 1 && (
        <ControlButton
          className="manual-target-switch"
          aria-label="Switch target"
          variant="outline"
          size="sm"
          type="button"
          title="Switch to the next opponent · T"
          disabled={disabled}
          onClick={switchTarget}
        >
          <Crosshair className="manual-touch-icon" aria-hidden="true" />
          <span className="manual-desktop-label">Switch target</span>
          <span className="manual-touch-label" aria-hidden="true">
            Target
          </span>
          <kbd aria-hidden="true">T</kbd>
        </ControlButton>
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
        <div className="manual-joystick" role="group" aria-label="Movement joystick">
          <div
            className="manual-stick-area"
            role="img"
            aria-label="Drag to move; hold a direction and tap Dash to dodge that way"
            onPointerDown={(event) => {
              if (disabled || stickPointerId.current !== null) return;
              stickPointerId.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              moveStick(event);
              sendMovement(true);
            }}
            onPointerMove={(event) => {
              if (stickPointerId.current === event.pointerId) moveStick(event);
            }}
            onPointerUp={releaseStick}
            onPointerCancel={releaseStick}
            onLostPointerCapture={releaseStick}
          >
            <span ref={stickKnob} className="manual-stick-knob" />
          </div>
          <span>Move + Dash</span>
        </div>
        <div className="manual-defense" role="group" aria-label="Defense controls">
          <ControlButton
            className="manual-dash"
            variant="outline"
            size="sm"
            type="button"
            aria-label="Dash · 15"
            title="Dash · 15 stamina · Shift + WASD or arrow keys to choose a direction"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'dash', ...stick.current })}
          >
            <Wind className="manual-touch-icon" aria-hidden="true" />
            <span>Dash</span> <kbd aria-hidden="true">Shift+WASD/↑↓←→</kbd>
          </ControlButton>
          <ControlButton
            className="manual-jump"
            variant="outline"
            size="sm"
            type="button"
            aria-label="Jump · 15"
            title="Jump · 15 stamina · Space"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'jump' })}
          >
            <ArrowUp className="manual-touch-icon" aria-hidden="true" />
            <span>Jump</span> <kbd aria-hidden="true">Space</kbd>
          </ControlButton>
          <ControlButton
            className="manual-crouch"
            variant="outline"
            size="sm"
            type="button"
            aria-label="Crouch · 15"
            title="Crouch · 15 stamina · C"
            disabled={!canDodge}
            onClick={() => send({ type: 'dodge', mode: 'crouch' })}
          >
            <ArrowDownToLine className="manual-touch-icon" aria-hidden="true" />
            <span>Crouch</span> <kbd aria-hidden="true">C</kbd>
          </ControlButton>
          <ControlButton
            className="manual-guard"
            variant={selected.guarded ? 'default' : 'outline'}
            size="sm"
            type="button"
            aria-pressed={selected.guarded}
            aria-label={selected.guarded ? 'Release guard' : 'Guard · −20%'}
            title="Guard · reduces damage by 20% · G"
            disabled={disabled || (!canAct && !selected.guarded)}
            onClick={() => send({ type: 'guard', active: !selected.guarded })}
          >
            <Shield className="manual-touch-icon" aria-hidden="true" />
            <span>{selected.guarded ? 'Release' : 'Guard'}</span> <kbd aria-hidden="true">G</kbd>
          </ControlButton>
        </div>
        <div className="manual-skills" role="group" aria-label="Skill controls">
          {POKEMON[selected.species].skills.map((skill, index) => {
            const remaining = selected.cooldowns[skill.id] ?? 0;
            const control = skillControls[skill.id] ?? { icon: Sparkles, label: skill.name };
            const Icon = control.icon;
            return (
              <ControlButton
                className={`manual-skill manual-skill-${index + 1} ${remaining > 0 ? 'is-cooling' : ''}`}
                style={
                  {
                    '--skill-color': ELEMENTS[skill.element].color,
                    '--cooldown-angle': `${Math.min(1, remaining / skill.cooldown) * 360}deg`,
                  } as CSSProperties
                }
                key={skill.id}
                variant="outline"
                size="sm"
                type="button"
                aria-label={`${skill.name} ${remaining > 0 ? `${remaining.toFixed(1)}s` : `${skill.energy} EN`}`}
                disabled={!canAct || selected.energy < skill.energy || remaining > 0}
                title={`${skill.name}: ${skill.energy} energy · ${skill.cooldown}s cooldown · ${index + 1}`}
                onClick={() => send({ type: 'skill', skillId: skill.id })}
              >
                <Icon className="manual-touch-icon" aria-hidden="true" />
                <span className="manual-desktop-label">{skill.name}</span>
                <span className="manual-touch-label" aria-hidden="true">
                  {control.label}
                </span>
                {remaining > 0 && (
                  <small className="manual-cooldown">{remaining.toFixed(1)}s</small>
                )}
                <kbd aria-hidden="true">{index + 1}</kbd>
              </ControlButton>
            );
          })}
        </div>
      </div>
    </section>
  );
}
