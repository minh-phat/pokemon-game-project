'use client';
import { ArrowRight, Check, Heart, Plus, Shield, Swords, Zap } from 'lucide-react';
import { POKEMON, ROSTER } from '@arena/game-data';
import { useGame } from '@/lib/store';
import { connectRoom, sendRoom } from '@/lib/network';
import { Button } from './ui/button';
import { ElementBadge, PageTitle, Portrait, Steps, TeamSlots } from './common';
export function RosterScreen({ inspectOnly = false }: { inspectOnly?: boolean }) {
  const state = useGame();
  const selected = POKEMON[state.inspected];
  const busy = state.connection === 'connecting';
  async function confirm() {
    if (state.team.length !== state.rules.teamSize) return;
    if (state.mode === 'online') {
      if (state.sessionId) {
        sendRoom('team', state.team);
        state.go('lobby');
      } else await connectRoom('create');
    } else state.go('battle');
  }
  return (
    <div className="page-wrap roster-page">
      {!inspectOnly && <Steps step={3} />}
      <PageTitle
        eyebrow={inspectOnly ? 'THE ORIGINAL FOUR' : 'YOUR ADVENTURE. YOUR TEAM.'}
        title={inspectOnly ? 'Little legends.' : 'Choose your companions.'}
        description={
          inspectOnly
            ? 'Four personalities. Four elements. Find your kind of fighter.'
            : `Pick ${state.rules.teamSize} Pokémon. Their instincts will take it from here.`
        }
        back={() => state.go(inspectOnly ? 'home' : state.sessionId ? 'lobby' : 'rules')}
      />
      <div className="roster-layout">
        <div>
          <div className="roster-grid">
            {ROSTER.map((p) => {
              const count = state.team.filter((id) => id === p.id).length;
              return (
                <article
                  className={`roster-card ${p.element} ${selected.id === p.id ? 'inspecting' : ''} ${count ? 'chosen' : ''}`}
                  key={p.id}
                >
                  <button
                    className="roster-inspect"
                    onClick={() => state.set({ inspected: p.id, notice: '' })}
                    aria-label={`Inspect ${p.name}`}
                    aria-pressed={selected.id === p.id}
                  >
                    <span className="dex-number">#{p.number}</span>
                    {count > 0 && !inspectOnly && (
                      <span className="selected-mark">
                        <Check size={14} />
                        {count > 1 && count}
                      </span>
                    )}
                    <div className="portrait-halo">
                      <Portrait id={p.id} />
                    </div>
                    <div className="roster-card-name">
                      <h3>{p.name}</h3>
                      <ElementBadge element={p.element} />
                    </div>
                    <p>{p.role}</p>
                  </button>
                  {!inspectOnly && (
                    <Button
                      variant={count ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={
                        ((!state.rules.duplicates && !count) || state.rules.duplicates) &&
                        state.team.length >= state.rules.teamSize
                      }
                      onClick={() => state.togglePokemon(p.id)}
                    >
                      {count && !state.rules.duplicates ? (
                        <>
                          <Check size={14} />
                          Selected · remove
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          Add {p.name}
                        </>
                      )}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="hint roster-hint">Select a card to explore its skills and battle style.</p>
        </div>
        <aside className={`panel pokemon-detail ${selected.element}`}>
          <div className="detail-topline">
            <span className="eyebrow">POKÉDEX / #{selected.number}</span>
            <ElementBadge element={selected.element} />
          </div>
          <div className="detail-preview">
            <div className="preview-ring" />
            <Portrait id={selected.id} animated />
          </div>
          <h2>{selected.name}</h2>
          <span className="detail-role">{selected.role}</span>
          <p className="detail-description">{selected.description}</p>
          <div className="stats-grid">
            {[
              { label: 'Health', value: selected.hp, max: 240, Icon: Heart },
              { label: 'Attack', value: selected.attack, max: 40, Icon: Swords },
              { label: 'Defense', value: selected.defense, max: 45, Icon: Shield },
              { label: 'Speed', value: selected.speed, max: 220, Icon: Zap },
            ].map(({ label, value, max, Icon }) => (
              <div className="stat" key={label}>
                <span>
                  <Icon size={13} />
                  {label}
                  <b>{value}</b>
                </span>
                <div className="stat-track">
                  <i style={{ width: `${(value / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="skill-heading">
            <h4>Move set</h4>
            <span>100 energy · regenerates in battle</span>
          </div>
          <div className="skill-list">
            {selected.skills.map((s, i) => (
              <div className="skill-row" key={s.id}>
                <span className={`skill-number element-${s.element}`}>0{i + 1}</span>
                <div>
                  <strong>{s.name}</strong>
                  <p>{s.description}</p>
                  <small>
                    {s.damage} power · {s.energy} energy · {s.cooldown}s cooldown
                  </small>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {inspectOnly ? (
        <div className="flow-footer">
          <span>Ready to see them in action?</span>
          <Button onClick={() => state.go('modes')}>
            Build a team <ArrowRight size={18} />
          </Button>
        </div>
      ) : (
        <div className="team-builder panel">
          <div>
            <p className="eyebrow">YOUR TEAM</p>
            <h3>
              {state.team.length} of {state.rules.teamSize} ready
            </h3>
          </div>
          <TeamSlots compact />
          <Button
            disabled={state.team.length !== state.rules.teamSize || busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Creating room…' : state.mode === 'ai' ? 'Enter the arena' : 'Confirm team'}
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
