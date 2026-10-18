'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Heart,
  LoaderCircle,
  Pause,
  Play,
  Settings2,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';
import { initializeBattle, seededRandom } from '@arena/game-core';
import { ARENAS, POKEMON, ROSTER } from '@arena/game-data';
import type { Fighter, SpeciesId } from '@arena/shared-types';
import { useGame } from '@/lib/store';
import { battleFeed } from '@/lib/battle-feed';
import { leaveRoom } from '@/lib/network';
import { Button } from './ui/button';
import { Portrait } from './common';
import { BattleCanvas } from './battle-canvas';
import { BattleResultOverlay } from './battle-result';
function FighterStatus({ fighter }: { fighter: Fighter }) {
  const def = POKEMON[fighter.species];
  return (
    <div className={`fighter-status ${fighter.hp <= 0 ? 'fainted' : ''}`}>
      <Portrait id={fighter.species} />
      <div>
        <div className="fighter-status-name">
          <strong>{def.name}</strong>
          <span>
            {fighter.hp <= 0
              ? 'Fainted'
              : fighter.active
                ? fighter.state.replace(/([a-z])([A-Z])/g, '$1 $2')
                : 'Reserve'}
          </span>
        </div>
        <div className="health-track">
          <i style={{ width: `${(fighter.hp / def.hp) * 100}%` }} />
        </div>
        <div className="fighter-numbers">
          <span>
            <Heart size={10} />
            {Math.ceil(fighter.hp)} / {def.hp}
          </span>
          <span>
            <Zap size={10} />
            {Math.floor(fighter.energy)}
          </span>
        </div>
        {fighter.active && fighter.hp > 0 && (
          <div className="cooldowns">
            {def.skills.map((s) => (
              <span
                key={s.id}
                className={fighter.cooldowns[s.id] > 0 ? 'on-cooldown' : ''}
                title={`${s.name}: ${fighter.cooldowns[s.id] > 0 ? `${fighter.cooldowns[s.id].toFixed(1)}s remaining` : 'ready'} · ${s.energy} energy`}
              >
                <i
                  style={{
                    width: `${Math.min(1, (fighter.cooldowns[s.id] ?? 0) / s.cooldown) * 100}%`,
                  }}
                />
                {s.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
                <small>
                  {fighter.cooldowns[s.id] > 0 ? Math.ceil(fighter.cooldowns[s.id]) : '✓'}
                </small>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export function BattleScreen() {
  const state = useGame();
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [loadError, setLoadError] = useState('');
  const online = state.mode === 'online';
  const snapshot = state.snapshot;
  const arena = ARENAS.find((a) => a.id === state.rules.arena)!;
  useEffect(() => {
    if (online) return;
    battleFeed.clear();
    const current = useGame.getState();
    if (current.team.length !== current.rules.teamSize) {
      current.go('roster');
      return;
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0],
      random = seededRandom(seed);
    const pool = ROSTER.map((p) => p.id);
    const opponents: SpeciesId[] = [];
    for (let i = 0; i < current.rules.teamSize; i++) {
      const index = Math.floor(random() * pool.length);
      opponents.push(pool[index]);
      if (!current.rules.duplicates) pool.splice(index, 1);
    }
    const engine = initializeBattle(
      {
        rules: current.rules,
        players: ['you', 'ai'],
        teams: [current.team, opponents],
        aiTeams: [1],
      },
      seed,
    );
    engine.startBattle();
    battleFeed.engine = engine;
    battleFeed.push(engine.getBattleSnapshot());
    return () => {
      battleFeed.clear();
    };
  }, [online]);
  useEffect(() => {
    if (online || !ready) return;
    const timer = setInterval(
      () =>
        setCountdown((value) => {
          if (value <= 1) {
            battleFeed.running = true;
            clearInterval(timer);
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [ready, online]);
  const myTeam = online
    ? Math.max(0, state.lobby?.players.findIndex((p) => p.id === state.sessionId) ?? 0)
    : 0;
  const names = online
    ? (state.lobby?.players.map((p) => p.name) ?? ['You', 'Opponent'])
    : [
        state.name || 'Your team',
        `${state.rules.difficulty[0].toUpperCase() + state.rules.difficulty.slice(1)} AI`,
      ];
  const finished = snapshot?.phase === 'finished';
  const disconnected =
    online && (state.connection !== 'connected' || state.lobby?.players.some((p) => !p.connected));
  const remaining = state.rules.duration
    ? Math.max(0, state.rules.duration - (snapshot?.elapsed ?? 0))
    : (snapshot?.elapsed ?? 0);
  const time = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(remaining % 60)
    .toString()
    .padStart(2, '0')}`;
  const displayCountdown =
    online && state.lobby?.phase === 'countdown'
      ? Math.ceil(state.lobby.countdown)
      : online
        ? 0
        : countdown;
  return (
    <div className="battle-page">
      <div className="battle-heading">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (online) leaveRoom();
            else state.go('roster');
          }}
        >
          <ArrowLeft size={15} />
          {online ? 'Leave room' : 'Change team'}
        </Button>
        <span className="eyebrow">
          {arena.name.toUpperCase()} <i /> {online ? 'ONLINE 1V1' : 'VS AI'}
        </span>
        <div>
          {!online && (
            <Button
              variant="outline"
              size="sm"
              disabled={!ready || countdown > 0 || finished}
              onClick={() => state.set({ paused: !state.paused })}
            >
              {state.paused ? <Play size={14} /> : <Pause size={14} />}{' '}
              {state.paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Battle settings"
            onClick={() => state.set({ settingsOpen: true })}
          >
            <Settings2 size={18} />
          </Button>
        </div>
      </div>
      <section className="arena-frame">
        <div className="arena-hud">
          <div className="hud-team">
            <span className="team-color" />
            <div>
              <small>TEAM 01</small>
              <h3>{names[0]}</h3>
            </div>
            <span className="hud-survivors">
              {snapshot?.fighters.filter((f) => f.team === 0 && f.hp > 0).length ??
                state.rules.teamSize}{' '}
              <Users size={14} />
            </span>
          </div>
          <div className="timer">
            <span>
              {finished
                ? 'FINISHED'
                : displayCountdown
                  ? 'GET READY'
                  : state.paused
                    ? 'PAUSED'
                    : 'AUTO BATTLE'}
            </span>
            <strong data-testid="match-timer">{time}</strong>
          </div>
          <div className="hud-team team-two">
            <span className="hud-survivors">
              <Users size={14} />
              {snapshot?.fighters.filter((f) => f.team === 1 && f.hp > 0).length ??
                state.rules.teamSize}
            </span>
            <div>
              <small>TEAM 02</small>
              <h3>{names[1] ?? 'Opponent'}</h3>
            </div>
            <span className="team-color" />
          </div>
        </div>
        <BattleCanvas arena={arena.id} onReady={() => setReady(true)} onError={setLoadError} />
        {!ready && (
          <div className="arena-overlay">
            <LoaderCircle className="spin" size={28} />
            <h2>{loadError ? 'The arena needs a moment.' : 'Getting the arena ready…'}</h2>
            <p>{loadError || 'Gathering your companions and loading their world.'}</p>
            {loadError && <Button onClick={() => location.reload()}>Reload arena</Button>}
          </div>
        )}
        {ready && displayCountdown > 0 && !finished && (
          <div className="arena-overlay countdown-overlay">
            <span className="eyebrow">YOUR COMPANIONS ARE READY</span>
            <strong data-testid="countdown">{displayCountdown}</strong>
            <p>Let their instincts take over.</p>
          </div>
        )}
        {state.paused && !finished && (
          <div className="arena-overlay">
            <Pause size={28} />
            <h2>A little breather.</h2>
            <p>Your battle will be right here.</p>
            <Button onClick={() => state.set({ paused: false })}>
              <Play size={17} />
              Resume battle
            </Button>
          </div>
        )}
        {disconnected && !finished && (
          <div className="arena-overlay">
            <WifiOff size={26} />
            <h2>
              {state.connection === 'lost' ? 'Room unavailable' : 'Waiting for a connection…'}
            </h2>
            <p>
              {state.connection === 'lost'
                ? 'The room or reconnection window has expired.'
                : 'The battle is paused while a trainer reconnects. The grace period is 30 seconds.'}
            </p>
            <Button variant="outline" onClick={leaveRoom}>
              Return home
            </Button>
          </div>
        )}
        {finished && snapshot && (
          <BattleResultOverlay snapshot={snapshot} names={names} myTeam={myTeam} />
        )}
      </section>
      <div className="battle-bottom">
        <div className="team-status panel">
          <div className="panel-title">
            <span className="team-dot" />
            <h3>{names[0]}</h3>
            <span className="muted small">TEAM 01</span>
          </div>
          {snapshot?.fighters
            .filter((f) => f.team === 0)
            .map((f) => (
              <FighterStatus key={f.id} fighter={f} />
            ))}
        </div>
        <div className="battle-feed panel">
          <div className="panel-title">
            <Zap size={15} />
            <h3>Battle moments</h3>
            <span className="live-dot" />
          </div>
          {state.showEvents ? (
            <ol>
              {snapshot?.events
                .slice(-5)
                .reverse()
                .map((event) => (
                  <li key={event.id}>
                    <time>{Math.floor(event.tick / 60)}s</time>
                    <span>
                      {event.kind === 'damage'
                        ? `${POKEMON[snapshot.fighters.find((f) => f.id === event.fighterId)!.species].name} takes ${event.value} · ${event.text}`
                        : event.text}
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="hint">Event feed hidden in settings.</p>
          )}
          <p className="battle-tip">
            {online
              ? 'Both teams are controlled by AI. Enjoy the show.'
              : 'A good team is more than the sum of its Pokémon.'}
          </p>
        </div>
        <div className="team-status panel enemy-status">
          <div className="panel-title">
            <span className="team-dot" />
            <h3>{names[1] ?? 'Opponent'}</h3>
            <span className="muted small">TEAM 02</span>
          </div>
          {snapshot?.fighters
            .filter((f) => f.team === 1)
            .map((f) => (
              <FighterStatus key={f.id} fighter={f} />
            ))}
        </div>
      </div>
    </div>
  );
}
