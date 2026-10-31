'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Flag, RotateCcw, Trophy } from 'lucide-react';
import type { BattleSnapshot } from '@arena/shared-types';
import { useGame } from '@/lib/store';
import { leaveRoom, sendRoom } from '@/lib/network';
import { Button } from './ui/button';

export function BattleResultOverlay({
  snapshot,
  names,
  myTeam,
}: {
  snapshot: BattleSnapshot;
  names: string[];
  myTeam: number;
}) {
  const state = useGame();
  const online = state.mode === 'online';
  const winner = snapshot.result?.winner;
  const victory = winner === myTeam;
  return (
    <DialogPrimitive.Root open={true}>
      <DialogPrimitive.Content
        className="arena-overlay result-overlay"
        aria-label="Battle result"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <span className="result-medal">
          {winner === 'draw' ? <Flag size={32} /> : <Trophy size={33} />}
        </span>
        <span className="eyebrow">
          {winner === 'draw'
            ? 'AN EVEN MATCH'
            : victory
              ? 'A LITTLE TEAM. A BIG MOMENT.'
              : 'EVERY BATTLE IS A NEW BEGINNING.'}
        </span>
        <DialogPrimitive.Title asChild>
          <h2 data-testid="battle-result">
            {winner === 'draw'
              ? 'A worthy draw.'
              : victory
                ? 'Victory is yours!'
                : 'A valiant effort.'}
          </h2>
        </DialogPrimitive.Title>
        <DialogPrimitive.Description asChild>
          <p>
            {snapshot.result?.reason === 'disconnect'
              ? 'Your opponent left the match.'
              : snapshot.result?.reason === 'time'
                ? 'The timer ended. Remaining team health decided the match.'
                : winner === 'draw'
                  ? 'Both teams gave it everything.'
                  : `${names[typeof winner === 'number' ? winner : 0]} won the arena.`}
          </p>
        </DialogPrimitive.Description>
        <div className="result-stats">
          <span>
            <strong>{Math.floor(snapshot.elapsed)}s</strong>Battle time
          </span>
          <span>
            <strong>
              {snapshot.fighters
                .filter((f) => f.team === myTeam)
                .reduce((s, f) => s + f.damageDealt, 0)}
            </strong>
            Damage dealt
          </span>
          <span>
            <strong>{snapshot.fighters.filter((f) => f.team === myTeam && f.hp > 0).length}</strong>
            Still standing
          </span>
        </div>
        <div className="result-buttons">
          {!state.matchmade && (
            <Button
              onClick={() => {
                if (online) sendRoom('rematch', true);
                else state.go('roster');
              }}
              disabled={
                online && !!state.lobby?.players.find((p) => p.id === state.sessionId)?.rematch
              }
            >
              <RotateCcw size={17} />
              {online
                ? state.lobby?.players.find((p) => p.id === state.sessionId)?.rematch
                  ? 'Waiting for opponent…'
                  : 'Request rematch'
                : 'Play again'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (online) leaveRoom();
              else state.go('home');
            }}
          >
            Return home
          </Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
