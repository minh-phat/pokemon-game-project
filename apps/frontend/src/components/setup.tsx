'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Flame,
  Globe2,
  Leaf,
  Mountain,
  Swords,
  Users,
  Waves,
} from 'lucide-react';
import { ARENAS } from '@arena/game-data';
import { PlayerNameSchema, RulesSchema, type MatchRules } from '@arena/shared-types';
import { useGame } from '@/lib/store';
import { connectRoom, sendRoom } from '@/lib/network';
import { Button } from './ui/button';
import { PageTitle, Steps } from './common';

export function ModeSelection() {
  const { set, go } = useGame();
  return (
    <div className="page-wrap">
      <Steps step={1} />
      <PageTitle
        eyebrow="EVERY GREAT BATTLE STARTS HERE"
        title="How will you play?"
        description="A moment to yourself, or a little friendly competition."
        back={() => go('home')}
      />
      <div className="mode-selection">
        {[
          {
            mode: 'ai' as const,
            title: 'VS AI',
            text: 'Find your perfect team. Try new combinations against three levels of AI.',
            icon: Bot,
            features: [
              '1–4 Pokémon per team',
              'Three difficulty levels',
              'Pause whenever you like',
            ],
            tag: 'YOUR PACE. YOUR ADVENTURE.',
          },
          {
            mode: 'online' as const,
            title: 'Online 1v1',
            text: 'Invite a friend, choose your teammates, and let their instincts do the talking.',
            icon: Users,
            features: [
              'Private invitation rooms',
              'Both players build a team',
              'Live, synchronized battles',
            ],
            tag: 'BETTER WITH A FRIEND.',
          },
        ].map((m) => (
          <button
            key={m.mode}
            className="mode-choice"
            onClick={() => {
              set({ mode: m.mode, team: [], snapshot: null });
              go(m.mode === 'ai' ? 'rules' : 'online');
            }}
          >
            <m.icon size={38} />
            <span className="eyebrow">{m.tag}</span>
            <h2>{m.title}</h2>
            <p className="muted">{m.text}</p>
            <ul>
              {m.features.map((f) => (
                <li key={f}>
                  <Check size={15} />
                  {f}
                </li>
              ))}
            </ul>
            <span className="button button-primary">
              Choose {m.title}
              <ArrowRight size={17} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArenaPicker({
  value,
  onChange,
}: {
  value: MatchRules['arena'];
  onChange: (id: MatchRules['arena']) => void;
}) {
  return (
    <div className="arena-picker">
      {ARENAS.map((a) => (
        <button
          key={a.id}
          aria-pressed={value === a.id}
          className={value === a.id ? 'selected' : ''}
          onClick={() => onChange(a.id)}
        >
          <img src={a.thumbnail ?? `/assets/${a.id}.svg`} alt="" />
          <span>
            <strong>{a.name}</strong>
            <small>{a.subtitle}</small>
          </span>
          {value === a.id && (
            <b>
              <Check size={15} />
            </b>
          )}
        </button>
      ))}
    </div>
  );
}
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}
export { Toggle };
export function RulesScreen() {
  const state = useGame();
  const [draft, setDraft] = useState<MatchRules>({ ...state.rules });
  const update = (patch: Partial<MatchRules>) => setDraft((v) => ({ ...v, ...patch }));
  function next() {
    const parsed = RulesSchema.safeParse(draft);
    if (!parsed.success) {
      state.set({ error: parsed.error.issues[0].message });
      return;
    }
    state.set({ rules: parsed.data, team: [], error: '' });
    if (state.mode === 'online' && state.sessionId) sendRoom('rules', parsed.data);
    state.go('roster');
  }
  return (
    <div className="page-wrap">
      <Steps step={2} />
      <PageTitle
        eyebrow={state.mode === 'ai' ? 'VS AI · MAKE IT YOURS' : 'ONLINE 1V1 · HOST SETTINGS'}
        title="Set the stage."
        description="A few little choices. A whole different battle."
        back={() => state.go(state.sessionId ? 'lobby' : 'modes')}
      />
      <div className="rules-layout">
        <div className="panel rules-panel">
          <div className="panel-title">
            <Swords size={18} />
            <h3>Battle rules</h3>
          </div>
          <div className="form-grid">
            <label>
              Pokémon per team
              <select
                aria-label="Pokémon per team"
                value={draft.teamSize}
                onChange={(e) =>
                  update({
                    teamSize: +e.target.value,
                    activeSize: Math.min(+e.target.value, draft.activeSize),
                  })
                }
              >
                {[1, 2, 3, 4].map((v) => (
                  <option key={v} value={v}>
                    {v} Pokémon
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active at once
              <select
                aria-label="Active at once"
                value={draft.activeSize}
                onChange={(e) => update({ activeSize: +e.target.value })}
              >
                {Array.from({ length: draft.teamSize }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    {v} per side
                  </option>
                ))}
              </select>
            </label>
            <label>
              Battle duration
              <select
                aria-label="Battle duration"
                value={draft.duration}
                onChange={(e) => update({ duration: +e.target.value as MatchRules['duration'] })}
              >
                <option value={60}>60 seconds</option>
                <option value={120}>120 seconds</option>
                <option value={180}>180 seconds</option>
                <option value={0}>Unlimited</option>
              </select>
            </label>
            {state.mode === 'ai' && (
              <label>
                AI difficulty
                <select
                  aria-label="AI difficulty"
                  value={draft.difficulty}
                  onChange={(e) =>
                    update({ difficulty: e.target.value as MatchRules['difficulty'] })
                  }
                >
                  <option value="easy">Easy · Find your feet</option>
                  <option value="normal">Normal · A fair challenge</option>
                  <option value="hard">Hard · Bring your best</option>
                </select>
              </label>
            )}
          </div>
          <div className="form-divider" />
          <Toggle
            label="Elemental matchups"
            description="Fire, water, grass, electric, and poison types affect damage."
            checked={draft.elements}
            onChange={(elements) => update({ elements })}
          />
          <Toggle
            label="Duplicate Pokémon"
            description="Choose the same Pokémon more than once."
            checked={draft.duplicates}
            onChange={(duplicates) => update({ duplicates })}
          />
          <Toggle
            label="Strategic switching"
            description="Low-health fighters may swap with a healthy reserve."
            checked={draft.switching}
            onChange={(switching) => update({ switching })}
          />
          <p className="hint">
            Reserves always enter when an active teammate faints. At the time limit, total remaining
            health percentage wins; surviving units break ties.
          </p>
        </div>
        <div>
          <div className="panel-title">
            <Mountain size={19} />
            <h3>Choose your arena</h3>
          </div>
          <ArenaPicker value={draft.arena} onChange={(arena) => update({ arena })} />
        </div>
      </div>
      <div className="flow-footer">
        <span>
          <Clock3 size={16} /> {draft.teamSize} vs {draft.teamSize} · {draft.activeSize} active ·{' '}
          {draft.duration ? `${draft.duration} seconds` : 'No time limit'}
        </span>
        <Button onClick={next}>
          Choose your Pokémon <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

export function OnlineAccess() {
  const state = useGame();
  const busy = state.connection === 'connecting';
  function valid() {
    const parsed = PlayerNameSchema.safeParse(state.name);
    if (!parsed.success) {
      state.set({ error: parsed.error.issues[0].message });
      return false;
    }
    state.set({ name: parsed.data, error: '' });
    return true;
  }
  return (
    <div className="page-wrap narrow">
      <Steps step={1} />
      <PageTitle
        eyebrow="A LITTLE FRIENDLY COMPETITION"
        title="Better together."
        description="Create your own arena, or join a friend's invitation."
        back={() => state.go('modes')}
      />
      <div className="panel online-entry">
        <Globe2 size={32} className="accent" />
        <label>
          Your trainer name
          <input
            maxLength={24}
            value={state.name}
            onChange={(e) => state.set({ name: e.target.value })}
            placeholder="Trainer name"
            autoComplete="nickname"
          />
        </label>
        <Button
          disabled={busy}
          onClick={() => {
            if (valid()) {
              state.set({ mode: 'online', team: [] });
              state.go('rules');
            }
          }}
        >
          Create a private room <ArrowRight size={17} />
        </Button>
        <div className="or-divider">
          <span />
          or join a friend
          <span />
        </div>
        <label>
          Invitation code
          <input
            value={state.roomCode}
            onChange={(e) => state.set({ roomCode: e.target.value.trim() })}
            placeholder="Paste your room code"
            spellCheck={false}
            autoCapitalize="off"
            maxLength={12}
          />
        </label>
        <Button
          variant="outline"
          disabled={busy || !state.roomCode.trim()}
          onClick={() => {
            if (valid()) void connectRoom('join');
          }}
        >
          {busy ? 'Connecting…' : 'Join room'}
          <Users size={17} />
        </Button>
        <p className="hint">
          Your room is private. Share the code with one friend. No account needed.
        </p>
      </div>
    </div>
  );
}

export function ArenasScreen() {
  const state = useGame();
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow="A WORLD WORTH EXPLORING"
        title="Find your battleground."
        description="Same fair footing. Three very different atmospheres."
        back={() => state.go('home')}
      />
      <div className="arena-explore">
        {ARENAS.map((a, i) => {
          const Icon = [Leaf, Flame, Waves][i];
          return (
            <article className="panel" key={a.id}>
              <img src={a.thumbnail ?? `/assets/${a.id}.svg`} alt={a.name} />
              <div>
                <Icon size={22} />
                <h2>{a.name}</h2>
                <p className="muted">
                  {a.subtitle}. A level arena with clear boundaries and safe starting positions.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    state.set({ mode: 'ai', rules: { ...state.rules, arena: a.id } });
                    state.go('rules');
                  }}
                >
                  Battle here <ArrowRight size={17} />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
