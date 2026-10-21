'use client';
import { Check, Copy, Crown, Link, LoaderCircle, Settings2, Users, WifiOff } from 'lucide-react';
import { useGame } from '@/lib/store';
import { leaveRoom, sendRoom } from '@/lib/network';
import { ARENAS, POKEMON } from '@arena/game-data';
import { Button } from './ui/button';
import { PageTitle, Portrait } from './common';
export function LobbyScreen() {
  const state = useGame();
  const lobby = state.lobby;
  if (!lobby)
    return (
      <div className="page-wrap narrow">
        <PageTitle
          eyebrow="ONLINE 1V1"
          title={state.connection === 'lost' ? 'Room unavailable' : 'Finding your arena…'}
          description={
            state.connection === 'lost'
              ? 'Return home to create or join a new room.'
              : 'Connecting to the game server.'
          }
        />
        <Button onClick={leaveRoom}>Return home</Button>
      </div>
    );
  const me = lobby.players.find((p) => p.id === state.sessionId),
    host = lobby.hostId === state.sessionId;
  const arena = ARENAS.find((a) => a.id === lobby.rules.arena)!;
  async function copy(link = false) {
    try {
      await navigator.clipboard.writeText(
        link ? `${location.origin}/?room=${lobby!.code}` : lobby!.code,
      );
      state.set({ notice: link ? 'Invitation link copied.' : 'Room code copied.' });
    } catch {
      state.set({ notice: `Copy this invitation code: ${lobby!.code}` });
    }
  }
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow="YOUR OWN LITTLE ARENA"
        title="Good battles need good company."
        description="Choose your team, invite a friend, and ready up."
        back={leaveRoom}
      />
      <div className="lobby-layout">
        <div>
          <div className="invite-bar panel">
            <span className="icon-circle">
              <Users size={22} />
            </span>
            <div>
              <span className="eyebrow">PRIVATE ROOM CODE</span>
              <strong data-testid="room-code">{lobby.code}</strong>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Copy room code"
              onClick={() => void copy()}
            >
              <Copy size={19} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copy(true)}>
              <Link size={16} />
              Copy invite
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
                        {player ? player.name : 'Waiting for a friend…'}
                        {player?.id === state.sessionId && <small>YOU</small>}
                      </h3>
                      <span className="muted small">
                        {player?.id === lobby.hostId ? (
                          <>
                            <Crown size={12} /> Room host
                          </>
                        ) : player ? (
                          'Challenger'
                        ) : (
                          'Share your invitation to get started'
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
                            Ready
                          </>
                        ) : (
                          'Choosing team'
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
                      {player.team.length ? 'Edit your team' : 'Choose your Pokémon'}
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
              <dt>Team size</dt>
              <dd>{lobby.rules.teamSize} Pokémon</dd>
            </div>
            <div>
              <dt>Active at once</dt>
              <dd>{lobby.rules.activeSize} per side</dd>
            </div>
            <div>
              <dt>Time limit</dt>
              <dd>{lobby.rules.duration ? `${lobby.rules.duration} seconds` : 'Unlimited'}</dd>
            </div>
            <div>
              <dt>Elemental matchups</dt>
              <dd>{lobby.rules.elements ? 'On' : 'Off'}</dd>
            </div>
            <div>
              <dt>Duplicates</dt>
              <dd>{lobby.rules.duplicates ? 'Allowed' : 'Off'}</dd>
            </div>
            <div>
              <dt>Switching</dt>
              <dd>{lobby.rules.switching ? 'On' : 'Off'}</dd>
            </div>
          </dl>
          {host && (
            <Button variant="ghost" size="sm" onClick={() => state.go('rules')}>
              <Settings2 size={15} />
              Edit match rules
            </Button>
          )}
          <p className="hint">The battle starts automatically when both trainers are ready.</p>
          <Button
            disabled={!me?.team.length || state.connection !== 'connected'}
            onClick={() => sendRoom('ready', !me?.ready)}
          >
            {me?.ready ? (
              <>
                <Check size={17} />
                Ready · cancel
              </>
            ) : (
              <>
                Ready for battle <Check size={17} />
              </>
            )}
          </Button>
        </aside>
      </div>
    </div>
  );
}
