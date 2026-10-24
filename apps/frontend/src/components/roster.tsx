'use client';
import { useState } from 'react';
import { useCopy } from '@/lib/i18n';
import { ArrowRight, Check, Heart, Plus, Shield, Swords, Zap } from 'lucide-react';
import { POKEMON, ROSTER, combatPower } from '@arena/game-data';
import { useGame } from '@/lib/store';
import { connectRoom, sendRoom } from '@/lib/network';
import { Button } from './ui/button';
import { ElementBadge, PageTitle, Portrait, Steps, TeamSlots } from './common';
export function RosterScreen({ inspectOnly = false }: { inspectOnly?: boolean }) {
  const c = useCopy();
  const formatPower = (value: number) =>
    value.toLocaleString(state.language === 'vi' ? 'vi-VN' : 'en-US');
  const state = useGame();
  const [side, setSide] = useState<'team' | 'aiTeam'>('team');
  const choosingAI = !inspectOnly && state.mode === 'ai' && side === 'aiTeam';
  const team = choosingAI ? state.aiTeam : state.team;
  function togglePokemon(id: typeof state.inspected) {
    if (!state.rules.duplicates && team.includes(id)) {
      state.set({ [choosingAI ? 'aiTeam' : 'team']: team.filter((value) => value !== id) });
    } else if (team.length < state.rules.teamSize) {
      state.set({ [choosingAI ? 'aiTeam' : 'team']: [...team, id] });
    }
  }
  const selected = POKEMON[state.inspected];
  const busy = state.connection === 'connecting';
  async function confirm() {
    if (state.team.length !== state.rules.teamSize) return;
    if (state.mode === 'online') {
      if (state.sessionId) {
        sendRoom('team', state.team);
        state.go('lobby');
      } else await connectRoom('create');
    } else if (state.aiTeam.length === state.rules.teamSize) state.go('battle');
    else setSide('aiTeam');
  }
  return (
    <div className="page-wrap roster-page">
      {!inspectOnly && <Steps step={3} />}
      <PageTitle
        eyebrow={inspectOnly ? c('THE POKÉMON') : c('YOUR ADVENTURE. YOUR TEAM.')}
        title={inspectOnly ? c('Little legends.') : c('Choose your companions.')}
        description={
          inspectOnly
            ? c('Find your kind of fighter.')
            : c('Pick {count} Pokémon. Their instincts will take it from here.').replace(
                '{count}',
                String(state.rules.teamSize),
              )
        }
        back={() => state.go(inspectOnly ? 'home' : state.sessionId ? 'lobby' : 'rules')}
      />
      {!inspectOnly && state.mode === 'ai' && (
        <div className="flow-footer" role="group" aria-label={c('Choose a team')}>
          <Button
            variant={choosingAI ? 'outline' : 'secondary'}
            aria-pressed={!choosingAI}
            onClick={() => setSide('team')}
          >
            {c('Your team')} · {state.team.length}/{state.rules.teamSize}
          </Button>
          <Button
            variant={choosingAI ? 'secondary' : 'outline'}
            aria-pressed={choosingAI}
            onClick={() => setSide('aiTeam')}
          >
            {c('AI team')} · {state.aiTeam.length}/{state.rules.teamSize}
          </Button>
        </div>
      )}
      <div className="roster-layout">
        <div>
          <div className="roster-grid">
            {ROSTER.map((p) => {
              const count = team.filter((id) => id === p.id).length;
              return (
                <article
                  className={`roster-card ${p.element} ${selected.id === p.id ? 'inspecting' : ''} ${count ? 'chosen' : ''}`}
                  key={p.id}
                >
                  <button
                    className="roster-inspect"
                    onClick={() => state.set({ inspected: p.id, notice: '' })}
                    aria-label={`${c('Inspect')} ${p.name}`}
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
                    <span className="combat-power-badge">
                      <Swords size={15} aria-hidden="true" />
                      {c('Combat power')} <strong>{formatPower(combatPower(p))}</strong>
                    </span>
                  </button>
                  {!inspectOnly && (
                    <Button
                      variant={count ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={
                        ((!state.rules.duplicates && !count) || state.rules.duplicates) &&
                        team.length >= state.rules.teamSize
                      }
                      onClick={() => togglePokemon(p.id)}
                    >
                      {count && !state.rules.duplicates ? (
                        <>
                          <Check size={14} />
                          {c('Selected · remove')}{' '}
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          {c('Add')} {p.name}
                        </>
                      )}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="hint roster-hint">
            {c('Select a card to explore its skills and battle style.')}
          </p>
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
          <div className="combat-power-panel">
            <span>
              <Swords size={18} aria-hidden="true" />
              {c('Total combat power')}
            </span>
            <strong>{formatPower(combatPower(selected))}</strong>
            <details>
              <summary>{c('How is it calculated?')}</summary>
              <p>{c('HP + Attack × 5 + Defense × 5 + Speed + Sprint speed + Stamina.')}</p>
              <p>{c('Based on base stats. Skills and elemental matchups are not included.')}</p>
            </details>
          </div>
          <p className="detail-description">{selected.description}</p>
          {selected.passive && (
            <div className="skill-row" style={{ marginBottom: 16 }}>
              <span className={`skill-number element-${selected.element}`}>✦</span>
              <div>
                <strong>
                  {c('Passive')} · {selected.passive.name}
                </strong>
                <p>{selected.passive.description}</p>
              </div>
            </div>
          )}
          <div className="stats-grid">
            {[
              { label: c('Health'), value: selected.hp, max: 240, Icon: Heart },
              { label: c('Attack'), value: selected.attack, max: 40, Icon: Swords },
              { label: c('Defense'), value: selected.defense, max: 45, Icon: Shield },
              { label: c('Speed'), value: selected.speed, max: 250, Icon: Zap },
              { label: c('Sprint speed'), value: selected.sprintSpeed, max: 330, Icon: Zap },
              {
                label: c('Stamina'),
                value: selected.maxStamina,
                max: Math.max(100, selected.maxStamina),
                Icon: Heart,
              },
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
            <h4>{c('Move set')}</h4>
            <span>{c('100 energy · regenerates in battle')}</span>
          </div>
          <div className="skill-list">
            {selected.skills.map((s, i) => (
              <div className="skill-row" key={s.id}>
                <span className={`skill-number element-${s.element}`}>0{i + 1}</span>
                <div>
                  <strong>{s.name}</strong>
                  <p>{s.description}</p>
                  <small>
                    {s.damagePercent}% {c('Attack')} · {s.energy} {c('energy')} · {s.cooldown}s{' '}
                    {c('cooldown')}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {inspectOnly ? (
        <div className="flow-footer">
          <span>{c('Ready to see them in action?')}</span>
          <Button onClick={() => state.go('modes')}>
            {c('Build a team')} <ArrowRight size={18} />
          </Button>
        </div>
      ) : (
        <div className="team-builder panel">
          <div>
            <p className="eyebrow">{choosingAI ? c('AI team') : c('YOUR TEAM')}</p>
            <h3>
              {c('{count} of {total} ready')
                .replace('{count}', String(team.length))
                .replace('{total}', String(state.rules.teamSize))}
            </h3>
          </div>
          <TeamSlots compact ai={choosingAI} />
          <Button
            disabled={
              team.length !== state.rules.teamSize ||
              state.team.length !== state.rules.teamSize ||
              busy
            }
            onClick={() => void confirm()}
          >
            {busy
              ? c('Creating room…')
              : state.mode === 'ai'
                ? state.aiTeam.length === state.rules.teamSize
                  ? c('Enter the arena')
                  : c('Choose AI Pokémon')
                : c('Confirm team')}
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
