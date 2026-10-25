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
      setPets((current) => {
        const updated = current.map((p) => (p.id === data.pet.id ? data.pet : p));
        return data.captured && !updated.some((p) => p.id === data.captured!.id)
          ? [data.captured, ...updated]
          : updated;
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
          petId: engine.companion.id,
          seed: engine.world.seed,
          wildId: wild.id,
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
  const fighter = combat?.fighters[0];
  const wildFighter = combat?.fighters[1];
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
          ? `${POKEMON[companion.species].name} · Lv.${companion.level}`
          : t('Triệu hồi Pets', 'Summon Pets')}
      </button>
      {(target || error || pending) && (
        <aside
          className="world-combat"
          aria-label={t('Chiến đấu thế giới mở', 'Open world battle')}
        >
          {combat && !status?.combatVisualReady && !status?.combatVisualError && (
            <small>{t('Đang tải hiệu ứng chiến đấu…', 'Loading battle effects…')}</small>
          )}
          {status?.combatVisualError && <p role="alert">{status.combatVisualError}</p>}
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
                  onClick={() => engine?.battleAction({ type: 'mode', manual: true })}
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
                    +{reward.experience} EXP · {t('Cấp', 'Level')} {reward.pet.level}
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
                        {t('Lập khế ước · dưới 10% HP', 'Form contract · below 10% HP')}
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
        title={t('Triệu hồi pet đồng hành', 'Summon a companion')}
        description={t(
          'Chọn pet sở hữu, sau đó bấm vào thú hoang trên bản đồ để chiến đấu.',
          'Choose an owned pet, then select a wild Pokémon on the map to battle.',
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
            <div className="world-pet-list">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  aria-pressed={status?.companion?.id === pet.id}
                  onClick={() => {
                    engine?.summon(pet);
                    toggle(false);
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
                  {t('Thu hồi pet', 'Recall pet')}
                </button>
              )}
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
