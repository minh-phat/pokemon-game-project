'use client';
import { useCopy, useLanguage } from '@/lib/i18n';
import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  LockKeyhole,
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
import { Dialog } from './ui/dialog';
import { PageTitle, Steps } from './common';

export function ModeSelection() {
  const { t } = useLanguage();
  const { set, go } = useGame();
  const modes = [
    {
      mode: 'ai' as const,
      title: t('Đấu với máy', 'VS AI'),
      text: t(
        'Rèn luyện kỹ năng, thử đội hình và chinh phục đấu trường theo cách của bạn.',
        'Hone your skills, try new teams and conquer the arena at your own pace.',
      ),
      icon: Swords,
      tag: t('HÀNH TRÌNH CỦA RIÊNG BẠN', 'YOUR PACE. YOUR ADVENTURE.'),
      detail: t('1–4 linh thú · 3 độ khó', '1–4 companions · 3 difficulty levels'),
      action: t('Vào luyện tập', 'Start training'),
    },
    {
      mode: 'online' as const,
      title: t('Đấu PvP', 'Online 1v1'),
      text: t(
        'Mời bạn bè, tập hợp linh thú và cùng so tài trong những trận đấu trực tuyến.',
        'Invite a friend, gather your companions and face off in live online battles.',
      ),
      icon: Users,
      tag: t('SO TÀI CÙNG BẠN BÈ', 'BETTER WITH A FRIEND.'),
      detail: t('Online 1v1 · Phòng riêng', 'Online 1v1 · Private rooms'),
      action: t('Vào đấu trường', 'Enter PvP'),
    },
    {
      mode: 'story' as const,
      title: t('Cốt truyện', 'Story mode'),
      text: t(
        'Băng qua những vùng đất bí ẩn, gặp gỡ linh thú và viết nên huyền thoại của bạn.',
        'Journey through mysterious lands, meet magical companions and write your own legend.',
      ),
      icon: BookOpen,
      tag: t('MỘT HUYỀN THOẠI ĐANG CHỜ', 'A LEGEND AWAITS.'),
      detail: t('Hành trình mới đang được viết…', 'A new adventure is being written…'),
      action: t('Sắp ra mắt', 'Coming soon'),
    },
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) go('home');
      }}
      className="play-mode-dialog"
      title={t('Bạn muốn chơi thế nào?', 'How will you play?')}
      description={t(
        'Chọn hành trình của bạn. Đấu trường đang chờ!',
        'Choose your adventure. The arena awaits!',
      )}
    >
      <div className="mode-dialog-ornament" aria-hidden="true">
        ✦
      </div>
      <div className="mode-dialog-divider" aria-hidden="true">
        <span>◆</span>
      </div>
      <div className="play-mode-grid">
        {modes.map((m, index) => (
          <button
            key={m.mode}
            className={`fantasy-frame play-mode-card play-mode-${m.mode}`}
            disabled={m.mode === 'story'}
            onClick={() => {
              if (m.mode === 'story') return;
              set({ mode: m.mode, team: [], snapshot: null });
              go(m.mode === 'ai' ? 'rules' : 'online');
            }}
          >
            <span className="mode-card-art" aria-hidden="true">
              <span className="mode-card-number">0{index + 1}</span>
              {m.mode === 'story' ? (
                <span className="mode-coming-soon">
                  <LockKeyhole size={12} />
                  {m.action}
                </span>
              ) : null}
              <span className="mode-card-emblem">
                <m.icon size={32} />
              </span>
              <span className="mode-art-spark spark-one">✦</span>
              <span className="mode-art-spark spark-two">✧</span>
            </span>
            <span className="mode-card-body">
              <span className="mode-card-tag">{m.tag}</span>
              <span className="mode-card-title">{m.title}</span>
              <span className="mode-card-description">{m.text}</span>
              <span className="mode-card-detail">{m.detail}</span>
              <span className="mode-card-action">
                {m.mode === 'story' ? <LockKeyhole size={15} /> : <Swords size={16} />}
                {m.action}
                {m.mode !== 'story' && <ArrowRight size={16} />}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mode-dialog-footer">
        <span aria-hidden="true">✧</span>
        {t(
          'Mỗi đội hình, một câu chuyện. Mỗi trận đấu, một huyền thoại.',
          'Every team has a story. Every battle builds a legend.',
        )}
      </p>
    </Dialog>
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
  const c = useCopy();
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
        eyebrow={state.mode === 'ai' ? c('VS AI · MAKE IT YOURS') : c('ONLINE 1V1 · HOST SETTINGS')}
        title={c('Set the stage.')}
        description={c('A few little choices. A whole different battle.')}
        back={() => state.go(state.sessionId ? 'lobby' : 'modes')}
      />
      <div className="rules-layout">
        <div className="panel rules-panel">
          <div className="panel-title">
            <Swords size={18} />
            <h3>{c('Battle rules')}</h3>
          </div>
          <div className="form-grid">
            <label>
              {c('Pokémon per team')}{' '}
              <select
                aria-label={c('Pokémon per team')}
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
                    {v} {c('Pokémon')}{' '}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c('Active at once')}{' '}
              <select
                aria-label={c('Active at once')}
                value={draft.activeSize}
                onChange={(e) => update({ activeSize: +e.target.value })}
              >
                {Array.from({ length: draft.teamSize }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    {v} {c('per side')}{' '}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c('Battle duration')}{' '}
              <select
                aria-label={c('Battle duration')}
                value={draft.duration}
                onChange={(e) => update({ duration: +e.target.value as MatchRules['duration'] })}
              >
                <option value={60}>{c('60 seconds')}</option>
                <option value={120}>{c('120 seconds')}</option>
                <option value={180}>{c('180 seconds')}</option>
                <option value={0}>{c('Unlimited')}</option>
              </select>
            </label>
            {state.mode === 'ai' && (
              <label>
                {c('AI difficulty')}{' '}
                <select
                  aria-label={c('AI difficulty')}
                  value={draft.difficulty}
                  onChange={(e) =>
                    update({ difficulty: e.target.value as MatchRules['difficulty'] })
                  }
                >
                  <option value="easy">{c('Easy · Find your feet')}</option>
                  <option value="normal">{c('Normal · A fair challenge')}</option>
                  <option value="hard">{c('Hard · Bring your best')}</option>
                </select>
              </label>
            )}
          </div>
          <div className="form-divider" />
          <Toggle
            label={c('Elemental matchups')}
            description={c('Fire, water, grass, electric, and poison types affect damage.')}
            checked={draft.elements}
            onChange={(elements) => update({ elements })}
          />
          <Toggle
            label={c('Duplicate Pokémon')}
            description={c('Choose the same Pokémon more than once.')}
            checked={draft.duplicates}
            onChange={(duplicates) => update({ duplicates })}
          />
          <Toggle
            label={c('Strategic switching')}
            description={c('Low-health fighters may swap with a healthy reserve.')}
            checked={draft.switching}
            onChange={(switching) => update({ switching })}
          />
          <p className="hint">
            {c(
              'Reserves always enter when an active teammate faints. At the time limit, total remaining health percentage wins; surviving units break ties.',
            )}{' '}
          </p>
        </div>
        <div>
          <div className="panel-title">
            <Mountain size={19} />
            <h3>{c('Choose your arena')}</h3>
          </div>
          <ArenaPicker value={draft.arena} onChange={(arena) => update({ arena })} />
        </div>
      </div>
      <div className="flow-footer">
        <span>
          <Clock3 size={16} /> {draft.teamSize} vs {draft.teamSize} · {draft.activeSize}{' '}
          {c('active')} ·{' '}
          {draft.duration ? `${draft.duration} ${c('seconds')}` : c('No time limit')}
        </span>
        <Button onClick={next}>
          {c('Choose your Pokémon')} <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

export function OnlineAccess() {
  const c = useCopy();
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
        eyebrow={c('A LITTLE FRIENDLY COMPETITION')}
        title={c('Better together.')}
        description={c("Create your own arena, or join a friend's invitation.")}
        back={() => state.go('modes')}
      />
      <div className="panel online-entry">
        <Globe2 size={32} className="accent" />
        <label>
          {c('Your trainer name')}{' '}
          <input
            maxLength={24}
            value={state.name}
            onChange={(e) => state.set({ name: e.target.value })}
            placeholder={c('Trainer name')}
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
          {c('Create a private room')} <ArrowRight size={17} />
        </Button>
        <div className="or-divider">
          <span />
          {c('or join a friend')} <span />
        </div>
        <label>
          {c('Invitation code')}{' '}
          <input
            value={state.roomCode}
            onChange={(e) => state.set({ roomCode: e.target.value.trim() })}
            placeholder={c('Paste your room code')}
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
          {busy ? c('Connecting…') : c('Join room')}
          <Users size={17} />
        </Button>
        <p className="hint">
          {c('Your room is private. Share the code with one friend. No account needed.')}{' '}
        </p>
      </div>
    </div>
  );
}

export function ArenasScreen() {
  const c = useCopy();
  const state = useGame();
  return (
    <div className="page-wrap">
      <PageTitle
        eyebrow={c('A WORLD WORTH EXPLORING')}
        title={c('Find your battleground.')}
        description={c('Same fair footing. Three very different atmospheres.')}
        back={() => state.go('home')}
      />
      <div className="arena-explore">
        {ARENAS.map((a) => {
          const Icon =
            { forest: Leaf, volcano: Flame, lake: Waves, ruins: Mountain }[a.id] ?? Mountain;
          return (
            <article className="panel" key={a.id}>
              <img src={a.thumbnail ?? `/assets/${a.id}.svg`} alt={a.name} />
              <div>
                <Icon size={22} />
                <h2>{a.name}</h2>
                <p className="muted">
                  {a.subtitle}
                  {c('. A level arena with clear boundaries and safe starting positions.')}{' '}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    state.set({ mode: 'ai', rules: { ...state.rules, arena: a.id } });
                    state.go('rules');
                  }}
                >
                  {c('Battle here')} <ArrowRight size={17} />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
