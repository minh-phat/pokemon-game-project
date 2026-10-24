'use client';
import { useState } from 'react';
import { useCopy } from '@/lib/i18n';
import { ArrowRight, Check, Heart, Plus, Search, Shield, Swords, Zap } from 'lucide-react';
import {
  ELEMENTS,
  POKEMON,
  ROSTER,
  combatPower,
  calculatePetStats,
  MIN_PET_LEVEL,
  MAX_PET_LEVEL,
  PET_QUALITIES,
  PET_QUALITY_MULTIPLIERS,
  PET_STAT_GROWTH,
  type PetQuality,
} from '@arena/game-data';
import { useGame } from '@/lib/store';
import { connectRoom, sendRoom } from '@/lib/network';
import { Button } from './ui/button';
import { ElementBadge, PageTitle, Portrait, Steps, TeamSlots } from './common';
export function RosterScreen({ inspectOnly = false }: { inspectOnly?: boolean }) {
  const c = useCopy();
  const formatPower = (value: number) =>
    value.toLocaleString(state.language === 'vi' ? 'vi-VN' : 'en-US');
  const state = useGame();
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('all');
  const [level, setLevel] = useState(1);
  const [levelInput, setLevelInput] = useState('1');
  const [quality, setQuality] = useState<PetQuality>('C');
  const validLevel =
    levelInput.trim() !== '' &&
    Number.isInteger(Number(levelInput)) &&
    Number(levelInput) >= MIN_PET_LEVEL &&
    Number(levelInput) <= MAX_PET_LEVEL;
  const visibleRoster = ROSTER.filter(
    (pet) =>
      (!inspectOnly || element === 'all' || pet.element === element) &&
      (!inspectOnly ||
        `${pet.name} ${pet.number}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
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
  const progression = { level, quality };
  const preview = inspectOnly ? calculatePetStats(selected, progression) : selected;
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
    <div className={`page-wrap roster-page ${inspectOnly ? 'pet-library' : ''}`}>
      {!inspectOnly && <Steps step={3} />}
      <PageTitle
        eyebrow={inspectOnly ? c('THE SUMMONER’S ARCHIVE') : c('YOUR ADVENTURE. YOUR TEAM.')}
        title={inspectOnly ? c('Pet library') : c('Choose your companions.')}
        description={
          inspectOnly
            ? c('Discover your companions, their powers and the stories behind every battle.')
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
      {inspectOnly && (
        <section className="library-toolbar fantasy-frame" aria-label={c('Explore pets')}>
          <label className="library-search">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label={c('Search pets')}
              placeholder={c('Search by name or number…')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="library-filters" role="group" aria-label={c('Filter by element')}>
            <button aria-pressed={element === 'all'} onClick={() => setElement('all')}>
              {c('All elements')}
            </button>
            {Object.entries(ELEMENTS).map(([key, info]) => (
              <button key={key} aria-pressed={element === key} onClick={() => setElement(key)}>
                <span aria-hidden="true">{info.symbol}</span> {c(info.label)}
              </button>
            ))}
          </div>
          <span className="library-count" role="status">
            {visibleRoster.length} / {ROSTER.length} pets
          </span>
        </section>
      )}
      <div className="roster-layout">
        <div>
          <div className="roster-grid">
            {visibleRoster.map((p) => {
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
                      {c('Combat power')}{' '}
                      <strong>
                        {formatPower(
                          combatPower(inspectOnly ? calculatePetStats(p, progression) : p),
                        )}
                      </strong>
                      {inspectOnly && (
                        <small>
                          Lv. {level} · {quality}
                        </small>
                      )}
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
          {inspectOnly && visibleRoster.length === 0 && (
            <div className="library-empty fantasy-frame">
              <Search size={28} aria-hidden="true" />
              <h3>{c('No companions found')}</h3>
              <p>{c('Try another name or element.')}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setElement('all');
                }}
              >
                {c('Reset filters')}
              </Button>
            </div>
          )}
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
          {inspectOnly && (
            <section className="pet-progression" aria-label={c('Stat preview')}>
              <h3>{c('Stat preview')}</h3>
              <div className="pet-progression-controls">
                <label>
                  {c('Level')}
                  <input
                    type="number"
                    min={MIN_PET_LEVEL}
                    max={MAX_PET_LEVEL}
                    step={1}
                    value={levelInput}
                    aria-invalid={!validLevel}
                    aria-describedby={!validLevel ? 'pet-level-error' : undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLevelInput(value);
                      const next = Number(value);
                      if (
                        value.trim() &&
                        Number.isInteger(next) &&
                        next >= MIN_PET_LEVEL &&
                        next <= MAX_PET_LEVEL
                      )
                        setLevel(next);
                    }}
                  />
                </label>
                <label>
                  {c('Quality')}
                  <select
                    aria-label={c('Quality')}
                    value={quality}
                    onChange={(event) => setQuality(event.target.value as PetQuality)}
                  >
                    {PET_QUALITIES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade} · ×{PET_QUALITY_MULTIPLIERS[grade]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!validLevel && (
                <p id="pet-level-error" role="alert">
                  {c('Enter a whole level from 1 to 100. The preview keeps the last valid level.')}
                </p>
              )}
              <div className="pet-progression-actions">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLevel(10);
                    setLevelInput('10');
                  }}
                >
                  {c('Try level 10')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLevel(1);
                    setLevelInput('1');
                    setQuality('C');
                  }}
                >
                  {c('Reset to base')}
                </Button>
              </div>
              <p role="status">
                {selected.name} · {c('Level')} {level} · {c('Quality')} {quality}
              </p>
              <p>{c('Preview only. Battle stats currently use level 1 / C.')}</p>
              <details>
                <summary>{c('Level and quality formula')}</summary>
                <p>{c('Stat = base × (1 + (level − 1) × growth) × quality multiplier.')}</p>
                <p>
                  {c('Growth per level')}: {c('Health')} +{PET_STAT_GROWTH.hp * 100}%; {c('Attack')}{' '}
                  / {c('Defense')} +{PET_STAT_GROWTH.attack * 100}%; {c('Speed')} /{' '}
                  {c('Sprint speed')} +{PET_STAT_GROWTH.speed * 100}%; {c('Stamina')} +
                  {PET_STAT_GROWTH.maxStamina * 100}%.
                </p>
                <p>
                  {c(
                    'Speed is rounded to one decimal; other stats to whole numbers. Energy and skill costs stay fixed.',
                  )}
                </p>
              </details>
            </section>
          )}
          <div className="combat-power-panel">
            <span>
              <Swords size={18} aria-hidden="true" />
              {c('Total combat power')}
            </span>
            <strong>{formatPower(combatPower(preview))}</strong>
            <details>
              <summary>{c('How is it calculated?')}</summary>
              <p>{c('HP + Attack × 5 + Defense × 5 + Speed + Sprint speed + Stamina.')}</p>
              <p>
                {c(
                  inspectOnly
                    ? 'Based on the selected level and quality. Skills and elemental matchups are not included.'
                    : 'Based on base stats. Skills and elemental matchups are not included.',
                )}
              </p>
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
              { label: c('Health'), value: preview.hp, base: selected.hp, max: 240, Icon: Heart },
              {
                label: c('Attack'),
                value: preview.attack,
                base: selected.attack,
                max: 40,
                Icon: Swords,
              },
              {
                label: c('Defense'),
                value: preview.defense,
                base: selected.defense,
                max: 45,
                Icon: Shield,
              },
              {
                label: c('Speed'),
                value: preview.speed,
                base: selected.speed,
                max: 250,
                Icon: Zap,
              },
              {
                label: c('Sprint speed'),
                value: preview.sprintSpeed,
                base: selected.sprintSpeed,
                max: 330,
                Icon: Zap,
              },
              {
                label: c('Stamina'),
                value: preview.maxStamina,
                base: selected.maxStamina,
                max: Math.max(100, selected.maxStamina),
                Icon: Heart,
              },
            ].map(({ label, value, base, max, Icon }) => (
              <div className="stat" key={label}>
                <span>
                  <Icon size={13} />
                  {label}
                  <b>{formatPower(value)}</b>
                </span>
                <div className="stat-track">
                  <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
                </div>
                {inspectOnly && (
                  <small className="stat-growth">
                    {c('Base')}: {formatPower(base)} · +
                    {formatPower(Math.round((value - base) * 10) / 10)}
                  </small>
                )}
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
