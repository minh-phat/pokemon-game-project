'use client';
import { useEffect, useRef, useState } from 'react';
import { PawPrint, X } from 'lucide-react';
import {
  ASSETS,
  POKEMON,
  SKILL_BY_ID,
  experienceToNextLevel,
  fighterDefinition,
} from '@arena/game-data';
import {
  speciesIds,
  type OwnedPet,
  type PetCollection,
  type WorldEncounterTicket,
  type WorldBattleAction,
  type WorldBattleReward,
} from '@arena/shared-types';
import type { OpenWorldEngine, WorldStatus } from '@/game/open-world-engine';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${path}`,
    {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-Arena-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(typeof data.message === 'string' ? data.message : 'Không thể kết nối máy chủ.');
  return data;
}
type Pending = {
  ticket: WorldEncounterTicket;
  actions: WorldBattleAction[];
  ticks: number;
  capturable: boolean;
};

export function WorldCompanions({
  engine,
  status,
  onPanelChange,
}: {
  engine: OpenWorldEngine | null;
  status: WorldStatus | null;
  onPanelChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const user = useGame((s) => s.user);
  const [open, setOpen] = useState(false);
  const [controlledId, setControlledId] = useState('0-0');
  const [pets, setPets] = useState<OwnedPet[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [reward, setReward] = useState<WorldBattleReward | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const collectionRevision = useRef(0);
  const key = user ? `arena-world-reward:${user.id}` : '';
  const toggle = (value: boolean) => {
    setOpen(value);
    onPanelChange(value);
  };
  async function load() {
    const revision = collectionRevision.current;
    const version = generation.current;
    setLoading(true);
    setError('');
    try {
      const data = await request<PetCollection>('pets');
      if (version === generation.current && revision === collectionRevision.current)
        setPets(data.pets);
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  async function settle(value: Pending, capture: boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const version = generation.current;
    try {
      const data = await request<WorldBattleReward>('world/finish', {
        id: value.ticket.id,
        ticks: value.ticks,
        actions: value.actions,
        capture,
      });
      if (version !== generation.current) return;
      collectionRevision.current++;
      setReward(data);
      engine?.updatePets(data.pets ?? [data.pet]);
      setPets((current) => {
        const updates = [
          ...(data.pets ?? [data.pet]),
          ...(data.capturedPets ?? (data.captured ? [data.captured] : [])),
        ];
        return [...new Map([...current, ...updates].map((p) => [p.id, p])).values()];
      });
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    generation.current++;
    locked.current = false;
    setBusy(false);
    setPending(null);
    setReward(null);
    setPets([]);
    setError('');
    if (!user) return;
    void load();
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Pending | null;
      if (
        saved?.ticket?.id &&
        speciesIds.includes(saved.ticket.pet.species) &&
        speciesIds.includes(saved.ticket.wild.species) &&
        Array.isArray(saved.actions) &&
        Number.isInteger(saved.ticks)
      ) {
        setPending(saved);
        void settle(saved, false);
      }
    } catch {
      /* A corrupt local recovery record cannot change server rewards. */
    }
    return () => {
      generation.current++;
    };
  }, [user?.id]);
  useEffect(() => {
    if (!engine) return;
    engine.endEncounter();
    engine.summon(null);
    engine.onNeedPet = () => {
      toggle(true);
    };
    engine.onEngage = async (wild) => {
      if (!user || !engine.companion) {
        engine.endEncounter();
        toggle(true);
        return;
      }
      const version = generation.current;
      setBusy(true);
      setError('');
      try {
        const ticket = await request<WorldEncounterTicket>('world/start', {
          petIds: engine.companions.map((p) => p.id),
          seed: engine.world.seed,
          wildIds: engine.selectedTargets.map((p) => p.id),
        });
        if (version === generation.current) engine.beginEncounter(ticket);
      } catch (e) {
        if (version === generation.current) {
          setError((e as Error).message);
          engine.endEncounter();
        }
      } finally {
        if (version === generation.current) setBusy(false);
      }
    };
    engine.onBattleFinished = (ticket, actions, ticks, capturable) => {
      const value: Pending = { ticket, actions, ticks, capturable };
      engine.rewardPending = true;
      setPending(value);
      setReward(null);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Server still persists rewards. */
      }
      void settle(value, false);
    };
    return () => {
      engine.onNeedPet = undefined;
      engine.onEngage = undefined;
      engine.onBattleFinished = undefined;
    };
  }, [engine, user?.id]);
  useEffect(() => {
    if (engine) engine.rewardPending = Boolean(pending);
  }, [engine, pending]);
  useEffect(() => {
    if (!engine || !user) return;
    const prefix = `wild:${user.id}:${engine.world.seed}:`;
    engine.hideCaptured(
      pets.filter((p) => p.id.startsWith(prefix)).map((p) => Number(p.id.slice(prefix.length))),
    );
  }, [engine, pets, user?.id]);
  const combat = status?.combat;
  const allies = combat?.fighters.filter((f) => f.team === 0) ?? [];
  const enemies = combat?.fighters.filter((f) => f.team === 1) ?? [];
  const fighter = allies.find((f) => f.id === controlledId) ?? allies[0];
  const wildFighter = enemies[0];
  const manual = combat?.manualTeams[0] ?? false;
  const companion = reward?.pet ?? status?.companion;
  const target = status?.target ?? pending?.ticket.wild;
  const inBattle = combat?.phase === 'battle';
  function closeResult(discard = false) {
    if ((!reward && !discard) || busy) return;
    engine?.endEncounter(true, reward?.pet);
    setPending(null);
    setReward(null);
    setError('');
    try {
      localStorage.removeItem(key);
    } catch {
      /* Optional recovery storage. */
    }
  }
  return (
    <>
      <button
        className="world-pets-toggle"
        onClick={() => toggle(true)}
        disabled={Boolean(target) || Boolean(pending)}
      >
        <PawPrint size={17} />{' '}
        {companion
          ? t(
              `Đội ra trận · ${status?.companions.length ?? 0} thú`,
              `Deployed · ${status?.companions.length ?? 0} pets`,
            )
          : t('Triệu hồi Pets', 'Summon Pets')}
      </button>
      {!target && Boolean(status?.selectedTargets.length) && (
        <aside className="world-combat" aria-label={t('Mục tiêu đã chọn', 'Selected targets')}>
          <strong>
            {t(
              `Đã chọn ${status!.selectedTargets.length} quái`,
              `${status!.selectedTargets.length} targets selected`,
            )}
          </strong>
          <p>
            {t(
              'Bấm quái để chọn/bỏ chọn. Giữ Shift và kéo để chọn thêm.',
              'Click to toggle targets. Shift-drag to add more.',
            )}
          </p>
          <button onClick={() => engine?.engageSelected()}>{t('Ra trận', 'Fight')}</button>
          <button onClick={() => engine?.clearTargets()}>
            {t('Bỏ chọn tất cả', 'Clear selection')}
          </button>
        </aside>
      )}
      {(target || error || pending) && (
        <aside
          className="world-combat"
          aria-label={t('Chiến đấu thế giới mở', 'Open world battle')}
        >
          {combat && !status?.combatVisualReady && !status?.combatVisualError && (
            <small>{t('Đang tải hiệu ứng chiến đấu…', 'Loading battle effects…')}</small>
          )}
          {status?.combatVisualError && <p role="alert">{status.combatVisualError}</p>}
          {combat && (allies.length > 1 || enemies.length > 1) && (
            <div className="world-rosters">
              <strong>
                {t(
                  `Đội bạn: ${allies.length} · Quái: ${enemies.length}`,
                  `Your team: ${allies.length} · Wild: ${enemies.length}`,
                )}
              </strong>
              {allies.map((ally) => (
                <button
                  key={ally.id}
                  aria-pressed={fighter?.id === ally.id}
                  onClick={() => {
                    setControlledId(ally.id);
                    engine?.battleAction({ type: 'control', fighterId: ally.id });
                  }}
                >
                  {POKEMON[ally.species].name} · {Math.ceil(ally.hp)} HP
                </button>
              ))}
              {enemies.map((enemy) => (
                <small key={enemy.id}>
                  {POKEMON[enemy.species].name} · {Math.ceil(enemy.hp)} HP
                </small>
              ))}
            </div>
          )}
          {target && (
            <>
              <strong>
                {POKEMON[target.species].name} · Lv.{target.level}{' '}
                <span className={`pet-quality quality-${target.quality}`}>{target.quality}</span>
              </strong>
              {wildFighter && (
                <>
                  <progress
                    aria-label={t('Máu thú hoang', 'Wild HP')}
                    value={wildFighter.hp}
                    max={fighterDefinition(wildFighter).hp}
                  />
                  <small>
                    {Math.ceil(wildFighter.hp)} / {fighterDefinition(wildFighter).hp} HP
                  </small>
                </>
              )}
              {companion && (
                <p>
                  {POKEMON[companion.species].name} · Lv.{companion.level} · {companion.quality}
                </p>
              )}
              {fighter && (
                <>
                  <progress
                    className="ally"
                    aria-label={t('Máu pet', 'Pet HP')}
                    value={fighter.hp}
                    max={fighterDefinition(fighter).hp}
                  />
                  <small>
                    {Math.ceil(fighter.hp)} HP · {Math.floor(fighter.energy)}{' '}
                    {t('năng lượng', 'energy')}
                  </small>
                </>
              )}
            </>
          )}
          {status?.approaching && (
            <p role="status">
              {busy
                ? t('Đang bắt đầu trận…', 'Starting battle…')
                : t('Pet đang tới mục tiêu…', 'Your pet is approaching…')}
            </p>
          )}
          {inBattle && (
            <>
              {fighter && (
                <small data-testid="world-combat-action">
                  {fighter.cast
                    ? SKILL_BY_ID[fighter.cast.skillId].name
                    : fighter.state === 'Jump' || fighter.y > 1
                      ? t('Đang nhảy né', 'Jumping')
                      : fighter.state === 'Dodge'
                        ? t('Đang lướt né', 'Dodging')
                        : fighter.guarded
                          ? t('Đang đỡ đòn', 'Guarding')
                          : fighter.state === 'Retreat'
                            ? t('Rút khỏi tầm đánh', 'Retreating')
                            : fighter.state === 'Chase'
                              ? t('Tiếp cận mục tiêu', 'Closing in')
                              : t('Di chuyển tìm góc đánh', 'Repositioning')}
                </small>
              )}
              <div className="world-combat-actions">
                <button
                  aria-pressed={!manual}
                  onClick={() => engine?.battleAction({ type: 'mode', manual: false })}
                >
                  Auto
                </button>
                <button
                  aria-pressed={manual}
                  onClick={() => {
                    engine?.battleAction({ type: 'mode', manual: true });
                    if (fighter) engine?.battleAction({ type: 'control', fighterId: fighter.id });
                  }}
                >
                  {t('Tự điều khiển', 'Manual')}
                </button>
              </div>
              {manual && fighter && (
                <>
                  <small>
                    {t(
                      'Pet tự di chuyển và đánh thường. Chọn kỹ năng để ra lệnh.',
                      'Your pet moves and uses basic attacks. Choose a skill to command it.',
                    )}
                  </small>
                  <div className="world-skill-grid">
                    {POKEMON[fighter.species].skills.map((skill) => (
                      <button
                        key={skill.id}
                        disabled={
                          Boolean(fighter.cast) ||
                          (fighter.cooldowns[skill.id] ?? 0) > 0 ||
                          fighter.energy < skill.energy
                        }
                        onClick={() =>
                          engine?.battleAction({
                            type: 'command',
                            command: { type: 'skill', fighterId: fighter.id, skillId: skill.id },
                          })
                        }
                      >
                        {skill.name}
                        <small>
                          {(fighter.cooldowns[skill.id] ?? 0) > 0
                            ? `${fighter.cooldowns[skill.id].toFixed(1)}s`
                            : `${skill.energy} EN`}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="world-combat-actions">
                    <button
                      aria-pressed={fighter.guarded}
                      onClick={() =>
                        engine?.battleAction({
                          type: 'command',
                          command: {
                            type: 'guard',
                            fighterId: fighter.id,
                            active: !fighter.guarded,
                          },
                        })
                      }
                    >
                      {t('Đỡ', 'Guard')}
                    </button>
                    <button
                      disabled={fighter.dodgeCooldown > 0}
                      onClick={() =>
                        engine?.battleAction({
                          type: 'command',
                          command: {
                            type: 'dodge',
                            fighterId: fighter.id,
                            mode: 'dash',
                            direction: -fighter.facing,
                          },
                        })
                      }
                    >
                      {t('Né', 'Dodge')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {pending && (
            <div className="world-battle-result" role="status">
              <strong>
                {pending.capturable
                  ? t('Thú hoang đã chịu thua!', 'The wild Pokémon yields!')
                  : t('Trận đấu kết thúc', 'Battle finished')}
              </strong>
              {reward ? (
                <>
                  <p>
                    +{reward.experience} EXP / {t('thú', 'pet')} · {t('Cấp', 'Level')}{' '}
                    {reward.pet.level}
                    {reward.pet.level > pending.ticket.pet.level
                      ? ` ↑ +${reward.pet.level - pending.ticket.pet.level}`
                      : ''}
                  </p>
                  <small>
                    {reward.pet.level === 100
                      ? t('Đã đạt cấp tối đa', 'Maximum level')
                      : `${reward.pet.experience ?? 0} / ${experienceToNextLevel(reward.pet.level)} EXP`}
                  </small>
                  {reward.captured ? (
                    <p>
                      {t(
                        'Đã lập khế ước! Thú đã vào Pets của bạn.',
                        'Contract complete! Added to your Pets.',
                      )}
                    </p>
                  ) : (
                    pending.capturable && (
                      <button disabled={busy} onClick={() => void settle(pending, true)}>
                        {t(
                          'Lập khế ước với các quái dưới 10% HP',
                          'Capture wild Pokémon below 10% HP',
                        )}
                      </button>
                    )
                  )}
                  <button disabled={busy} onClick={() => closeResult()}>
                    {reward.captured || !pending.capturable
                      ? t('Tiếp tục', 'Continue')
                      : t('Thả đi', 'Release')}
                  </button>
                </>
              ) : (
                <p>{t('Đang lưu kinh nghiệm…', 'Saving experience…')}</p>
              )}
            </div>
          )}
          {error && (
            <div role="alert">
              <p>{error}</p>
              {pending ? (
                <>
                  <button disabled={busy} onClick={() => void settle(pending, false)}>
                    {t('Thử lưu lại', 'Retry saving')}
                  </button>
                  {!reward && (
                    <button disabled={busy} onClick={() => closeResult(true)}>
                      {t('Bỏ kết quả chưa lưu', 'Discard unsaved result')}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={() => setError('')}>
                  <X size={14} />
                  {t('Đóng', 'Close')}
                </button>
              )}
            </div>
          )}
          {target && !pending && (
            <button
              disabled={busy}
              onClick={() => {
                engine?.endEncounter();
                setError('');
              }}
            >
              {t('Rút lui · không nhận EXP', 'Retreat · no EXP')}
            </button>
          )}
        </aside>
      )}
      <Dialog
        open={open}
        onOpenChange={toggle}
        className="world-dialog"
        title={t('Chọn đội thú ra trận', 'Choose your companions')}
        description={t(
          'Chọn bao nhiêu thú tùy ý. Kéo chuột trên bản đồ để chọn quái, rồi bấm Ra trận.',
          'Choose any number of pets. Drag a box on the map to select enemies, then press Fight.',
        )}
      >
        {!user ? (
          <>
            <p>
              {t(
                'Đăng nhập để dùng Pets và lưu EXP, khế ước vào tài khoản.',
                'Sign in to use your Pets and save experience and contracts.',
              )}
            </p>
            <button
              onClick={() => {
                toggle(false);
                useGame.getState().set({ accountView: 'login' });
              }}
            >
              {t('Đăng nhập', 'Sign in')}
            </button>
          </>
        ) : (
          <>
            {loading && <p role="status">{t('Đang tải Pets…', 'Loading Pets…')}</p>}
            {error && <p role="alert">{error}</p>}
            {!loading && !pets.length && (
              <p>
                {t(
                  'Bạn chưa có pet. Hãy mở Triệu Hồi ở trang chủ để nhận thú đầu tiên.',
                  'No pets yet. Use Summon on the home screen to get your first companion.',
                )}
              </p>
            )}
            <div className="world-combat-actions">
              <button
                disabled={loading || !pets.length}
                onClick={() => {
                  for (const pet of pets)
                    if (!engine?.companions.some((p) => p.id === pet.id)) engine?.summon(pet);
                }}
              >
                {t('Chọn tất cả', 'Deploy all')}
              </button>
              <button onClick={() => toggle(false)}>
                {t(
                  `Xong · ${status?.companions.length ?? 0} thú`,
                  `Done · ${status?.companions.length ?? 0} pets`,
                )}
              </button>
            </div>
            <div className="world-pet-list">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  aria-pressed={status?.companions.some((p) => p.id === pet.id)}
                  onClick={() => {
                    engine?.summon(pet);
                  }}
                >
                  <img src={ASSETS.portraits[pet.species]} alt="" />
                  <span>
                    <strong>{POKEMON[pet.species].name}</strong>
                    <small>
                      Lv.{pet.level} · {pet.quality} ·{' '}
                      {pet.level === 100
                        ? 'MAX'
                        : `${pet.experience ?? 0}/${experienceToNextLevel(pet.level)} EXP`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className="world-combat-actions">
              <button disabled={loading} onClick={() => void load()}>
                {t('Tải lại Pets', 'Reload Pets')}
              </button>
              {status?.companion && (
                <button
                  onClick={() => {
                    engine?.summon(null);
                    toggle(false);
                  }}
                >
                  {t('Thu hồi tất cả', 'Recall all')}
                </button>
              )}
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
