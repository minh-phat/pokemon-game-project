'use client';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import type { Element, SpeciesId } from '@arena/shared-types';
import { ASSETS, ELEMENTS, POKEMON } from '@arena/game-data';
import { Button } from './ui/button';
import { useGame } from '@/lib/store';
export function ElementBadge({ element }: { element: Element }) {
  const e = ELEMENTS[element];
  return (
    <span className={`element-badge element-${element}`}>
      <span aria-hidden="true">{e.symbol}</span>
      {e.label}
    </span>
  );
}
export function Portrait({
  id,
  className = '',
  animated = false,
}: {
  id: SpeciesId;
  className?: string;
  animated?: boolean;
}) {
  return animated ? (
    <div
      role="img"
      aria-label={`${POKEMON[id].name} animated preview`}
      className={`sprite-preview ${className}`}
      style={{ backgroundImage: `url(${ASSETS.sprites[id]})` }}
    />
  ) : (
    <img
      className={className}
      src={ASSETS.portraits[id]}
      alt={POKEMON[id].name}
      width={160}
      height={160}
    />
  );
}
export function Steps({ step }: { step: number }) {
  return (
    <div className="steps" aria-label={`Setup step ${step} of 3`}>
      {['Battle mode', 'Match rules', 'Your team'].map((label, i) => (
        <span key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'complete' : ''}>
          <b>{step > i + 1 ? <Check size={12} /> : `0${i + 1}`}</b>
          {label}
          {i < 2 && <ChevronRight size={14} />}
        </span>
      ))}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  back,
}: {
  eyebrow: string;
  title: string;
  description: string;
  back?: () => void;
}) {
  return (
    <div className="page-heading">
      {back && (
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft size={15} /> Back
        </Button>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
  );
}
export function TeamSlots({ compact = false }: { compact?: boolean }) {
  const { team, rules, set } = useGame();
  return (
    <div className={`team-slots ${compact ? 'compact' : ''}`}>
      {Array.from({ length: rules.teamSize }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`team-slot ${team[i] ? 'filled' : ''}`}
          disabled={!team[i]}
          onClick={() => set({ team: team.filter((_, j) => j !== i) })}
          aria-label={
            team[i]
              ? `Remove ${POKEMON[team[i]].name} from slot ${i + 1}`
              : `Empty team slot ${i + 1}`
          }
        >
          {team[i] ? (
            <>
              <Portrait id={team[i]} />
              <span>{POKEMON[team[i]].name}</span>
              <small>×</small>
            </>
          ) : (
            <>
              <span className="slot-ball">+</span>
              <span>Slot {i + 1}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
