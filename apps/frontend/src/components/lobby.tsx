'use client';
import { useCopy } from '@/lib/i18n';
import { Check, Copy, Crown, Link, LoaderCircle, Settings2, Users, WifiOff } from 'lucide-react';
import { useGame } from '@/lib/store';
import { leaveRoom, sendRoom } from '@/lib/network';
import { ARENAS, POKEMON } from '@arena/game-data';
import { Button } from './ui/button';
import { PageTitle, Portrait } from './common';
import { MatchSelectionScreen } from './match-selection';
export function LobbyScreen() {
  const c = useCopy();
  const state = useGame();
  const lobby = state.lobby;
  if (!lobby)
    return (
      <div className="page-wrap narrow">
        <PageTitle
          eyebrow={state.matchmade ? 'TÌM TRẬN 1VS1' : 'ONLINE 1V1'}
          title={state.connection === 'lost' ? c('Room unavailable') : c('Finding your arena…')}
          description={
            state.connection === 'lost'
              ? c('Return home to create or join a new room.')
              : state.matchmade
                ? 'Đang tìm đối thủ phù hợp. Nếu chưa tìm được người chơi, bạn sẽ đấu với máy.'
                : c('Connecting to the game server.')
          }
        />
        {state.error && <p role="alert">{state.error}</p>}
        <Button onClick={leaveRoom}>{state.matchmade ? 'Hủy tìm trận' : c('Return home')}</Button>
      </div>
    );
  if (state.matchmade) return <MatchSelectionScreen />;
  const me = lobby.players.find((p) => p.id === state.sessionId),
    host = lobby.hostId === state.sessionId;
  const arena = ARENAS.find((a) => a.id === lobby.rules.arena)!;
  async function copy(link = false) {
    try {
      await navigator.clipboard.writeText(
        link ? `${location.origin}/?room=${lobby!.code}` : lobby!.code,
      );
      state.set({ notice: link ? c('Invitation link copied.') : c('Room code copied.') });
    } catch {
      state.set({ notice: `Copy this invitation code: ${lobby!.code}` });
    }
  }
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow={c('YOUR OWN LITTLE ARENA')}
        title={c('Good battles need good company.')}
        description={c('Choose your team, invite a friend, and ready up.')}
        back={leaveRoom}
      />
      <div className="lobby-layout">
        <div>
          <div className="invite-bar panel">
            <span className="icon-circle">
              <Users size={22} />
            </span>
            <div>
              <span className="eyebrow">{c('PRIVATE ROOM CODE')}</span>
              <strong data-testid="room-code">{lobby.code}</strong>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={c('Copy room code')}
              onClick={() => void copy()}
            >
              <Copy size={19} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copy(true)}>
              <Link size={16} />
              {c('Copy invite')}{' '}
            </Button>
          </div>
          <div className="lobby-players">
            {[0, 1].map((i) => {
              const player = lobby.players[i];
              return (
                <div key={i} className={`panel lobby-player ${player?.ready ? 'is-ready' : ''}`}>
                  <div className="player-heading">
                    <span className="avatar">
                      {player ? player.name[0].toUpperCase() : <Users size={20} />}
                    </span>
                    <div>
                      <h3>
                        {player ? player.name : c('Waiting for a friend…')}
                        {player?.id === state.sessionId && <small>{c('YOU')}</small>}
                      </h3>
                      <span className="muted small">
                        {player?.id === lobby.hostId ? (
                          <>
                            <Crown size={12} /> {c('Room host')}{' '}
                          </>
                        ) : player ? (
                          c('Challenger')
                        ) : (
                          c('Share your invitation to get started')
                        )}
                      </span>
                    </div>
                    {player && (
                      <span className={player.ready ? 'ready-label' : 'muted small'}>
                        {!player.connected ? (
                          <WifiOff size={16} />
                        ) : player.ready ? (
                          <>
                            <Check size={14} />
                            {c('Ready')}{' '}
                          </>
                        ) : (
                          c('Choosing team')
                        )}
                      </span>
                    )}
                  </div>
                  <div className="lobby-team">
                    {Array.from({ length: lobby.rules.teamSize }, (_, slot) => (
                      <div key={slot} className={player?.team[slot] ? 'filled' : ''}>
                        {player?.team[slot] ? (
                          <>
                            <Portrait id={player.team[slot]} />
                            <strong>{POKEMON[player.team[slot]].name}</strong>
                          </>
                        ) : (
                          <span className="slot-ball">?</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {player?.id === state.sessionId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        state.set({ team: [...player.team] });
                        state.go('roster');
                      }}
                    >
                      {player.team.length ? c('Edit your team') : c('Choose your Pokémon')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="panel lobby-rules">
          <img src={arena.thumbnail ?? `/assets/${arena.id}.svg`} alt={arena.name} />
          <h3>{arena.name}</h3>
          <dl>
            <div>
              <dt>{c('Team size')}</dt>
              <dd>
                {lobby.rules.teamSize} {c('Pokémon')}
              </dd>
            </div>
            <div>
              <dt>{c('Active at once')}</dt>
              <dd>
                {lobby.rules.activeSize} {c('per side')}
              </dd>
            </div>
            <div>
              <dt>{c('Time limit')}</dt>
              <dd>
                {lobby.rules.duration ? `${lobby.rules.duration} ${c('seconds')}` : c('Unlimited')}
              </dd>
            </div>
            <div>
              <dt>{c('Elemental matchups')}</dt>
              <dd>{lobby.rules.elements ? c('On') : c('Off')}</dd>
            </div>
            <div>
              <dt>{c('Duplicates')}</dt>
              <dd>{lobby.rules.duplicates ? c('Allowed') : c('Off')}</dd>
            </div>
            <div>
              <dt>{c('Switching')}</dt>
              <dd>{lobby.rules.switching ? c('On') : c('Off')}</dd>
            </div>
          </dl>
          {host && (
            <Button variant="ghost" size="sm" onClick={() => state.go('rules')}>
              <Settings2 size={15} />
              {c('Edit match rules')}{' '}
            </Button>
          )}
          <p className="hint">
            {c('The battle starts automatically when both trainers are ready.')}
          </p>
          <Button
            disabled={!me?.team.length || state.connection !== 'connected'}
            onClick={() => sendRoom('ready', !me?.ready)}
          >
            {me?.ready ? (
              <>
                <Check size={17} />
                {c('Ready · cancel')}{' '}
              </>
            ) : (
              <>
                {c('Ready for battle')} <Check size={17} />
              </>
            )}
          </Button>
        </aside>
      </div>
    </div>
  );
}
