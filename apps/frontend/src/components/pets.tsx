'use client';
import { formatSkillRange } from '@/lib/skill-range';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, PawPrint, ArrowLeft } from 'lucide-react';
import { POKEMON, calculatePetStats, experienceToNextLevel, combatPower } from '@arena/game-data';
import {
  speciesIds,
  PET_QUALITIES,
  type PetCollection,
  type OwnedPet,
  type SummonResult,
} from '@arena/shared-types';
import { useLanguage, useCopy } from '@/lib/i18n';
import { Dialog } from './ui/dialog';
import { Portrait, ElementBadge } from './common';

async function requestCollection(summon: true): Promise<SummonResult>;
async function requestCollection(summon?: false): Promise<PetCollection>;
async function requestCollection(summon = false): Promise<PetCollection | SummonResult> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${summon ? 'summon' : 'pets'}`,
    {
      method: summon ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-Arena-Request': '1' },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export function PetsDialog({ view, onClose }: { view: 'pets' | 'summon'; onClose: () => void }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState(view);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collection, setCollection] = useState<PetCollection | null>(null);
  const [result, setResult] = useState<SummonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  const load = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const data = await requestCollection();
      if (active.current) setCollection(data);
    } catch {
      if (active.current) setError(true);
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, []);
  const summon = async () => {
    if (locked.current || !collection) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    setResult(null);
    try {
      const data = await requestCollection(true);
      if (active.current) {
        setCollection(data);
        setResult(data);
      }
    } catch {
      if (active.current) {
        setError(true);
        setCollection(null);
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  const owned = collection?.pets ?? [];
  const total = owned.length;
  const selectedPet = owned.find((pet) => pet.id === selectedId);
  const speciesCount = new Set(owned.map((pet) => pet.species)).size;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="pets-dialog"
      title={
        tab === 'summon'
          ? t('Triệu Hồi Linh Thú', 'Summon Companions')
          : t('Pets của bạn', 'Your Pets')
      }
      description={t(
        'Gắn kết linh thú · Viết nên huyền thoại',
        'Befriend companions · Begin a legend',
      )}
    >
      <div className="pets-tabs">
        <button
          aria-pressed={tab === 'summon'}
          onClick={() => {
            setTab('summon');
            setSelectedId(null);
          }}
        >
          <Sparkles size={18} />
          {t('Triệu Hồi', 'Summon')}
        </button>
        <button
          aria-pressed={tab === 'pets'}
          onClick={() => {
            setTab('pets');
            setSelectedId(null);
          }}
        >
          <PawPrint size={18} />
          Pets{collection && ` (${total})`}
        </button>
      </div>
      {error && (
        <div role="alert" className="pets-error">
          <p>
            {t(
              'Không thể tải kết quả. Hãy tải lại bộ sưu tập để kiểm tra trước khi triệu hồi tiếp.',
              'Could not load the result. Reload your collection before summoning again.',
            )}
          </p>
          <button
            className="fantasy-frame fantasy-action"
            disabled={busy}
            onClick={() => void load()}
          >
            {t('Tải lại', 'Reload')}
          </button>
        </div>
      )}
      {busy && !collection && (
        <p role="status">{t('Đang tải bộ sưu tập…', 'Loading collection…')}</p>
      )}
      {collection &&
        (tab === 'summon' ? (
          <div className="summon-panel">
            <div className={`summon-orb ${busy ? 'is-summoning' : ''}`} aria-hidden="true">
              {result?.received ? (
                <Portrait id={result.received.species} />
              ) : (
                <Sparkles size={64} />
              )}
            </div>
            <div className="summon-result" role="status" aria-live="polite">
              {busy ? (
                <h3>{t('Đang triệu hồi…', 'Summoning…')}</h3>
              ) : result ? (
                <>
                  <h3>
                    {POKEMON[result.received.species].name}{' '}
                    <span className={`pet-quality quality-${result.received.quality}`}>
                      {result.received.quality}
                    </span>
                  </h3>
                  <p className="pet-level">
                    {t('Cấp', 'Level')} {result.received.level}
                  </p>
                  <p>{t('Linh thú đã vào Pets của bạn!', 'Your companion is now in Pets!')}</p>
                </>
              ) : (
                <>
                  <h3>{t('Đánh thức mối liên kết', 'Awaken your bond')}</h3>
                  <p>{t('Một người bạn mới đang chờ bạn.', 'A new companion awaits you.')}</p>
                </>
              )}
            </div>
            <div className="summon-stats">
              <span>
                {t('Đã triệu hồi', 'Attempts')} <b>{collection.attempts}</b>
              </span>
              <span>
                {t('Nhận thú', 'Companion chance')} <b>100%</b>
              </span>
            </div>
            <div className="summon-guarantees">
              {collection.guarantees.map(({ quality, remaining }) => (
                <div key={quality}>
                  <span className={`pet-quality quality-${quality}`}>{quality}+</span>
                  <strong>
                    {remaining === 1
                      ? t('Bảo đảm lượt tới!', 'Guaranteed next!')
                      : t(`Còn ${remaining} lượt`, `${remaining} summons left`)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="pets-note">
              {t(
                'Tỉ lệ phẩm chất ở lượt tiếp theo (đã tính bảo đảm)',
                'Next summon quality chances (guarantees included)',
              )}
            </p>
            <div className="summon-quality-odds">
              {PET_QUALITIES.map((quality) => (
                <div key={quality}>
                  <span className={`pet-quality quality-${quality}`}>{quality}</span>
                  <b>{Number((collection.qualityOdds[quality] / 100).toFixed(2))}%</b>
                </div>
              ))}
            </div>
            <p className="pets-note">
              {t(
                'Mỗi lượt đều nhận 1 thú cấp 1. Càng triệu hồi nhiều, cơ hội ra phẩm chất cao càng tăng (đạt tối đa sau 1.000 lượt). Bảo đảm lặp lại: mỗi 11 lượt ≥ A, 101 lượt ≥ S, 1.001 lượt SS. Ra phẩm chất cao sớm không đặt lại bộ đếm. Trùng mốc nhận bảo đảm cao nhất.',
                'Every summon grants a level 1 companion. Higher-quality chances grow with total summons (capped after 1,000). Repeating guarantees: every 11 summons ≥ A, 101 ≥ S, 1,001 SS. Early lucky rolls do not reset counters. Overlapping milestones use the highest guarantee.',
              )}
            </p>
            <button
              className="fantasy-frame fantasy-action gold"
              disabled={busy}
              onClick={() => void summon()}
            >
              <Sparkles size={20} />
              {t('Triệu hồi', 'Summon now')} · {collection.cost} {t('vàng', 'gold')}
            </button>
            <p className="pets-note">
              {t('Miễn phí trong giai đoạn hiện tại', 'Free during this phase')}
            </p>
          </div>
        ) : (
          <>
            <div className="pets-summary">
              <span>{t('Bộ sưu tập linh thú', 'Companion collection')}</span>
              <b>
                {speciesCount}/{speciesIds.length} {t('loài', 'species')} · {total} pets
              </b>
            </div>
            {selectedPet ? (
              <OwnedPetDetails
                pet={selectedPet}
                onBack={() => {
                  setSelectedId(null);
                  requestAnimationFrame(() =>
                    document.getElementById(`pet-card-${selectedPet.id}`)?.focus(),
                  );
                }}
              />
            ) : owned.length ? (
              <div className="owned-pets-grid">
                {owned.map((pet) => (
                  <button
                    type="button"
                    id={`pet-card-${pet.id}`}
                    className={`owned-pet pet-border-${pet.quality}`}
                    key={pet.id}
                    onClick={() => setSelectedId(pet.id)}
                    aria-label={t(
                      `Xem ${POKEMON[pet.species].name}, cấp ${pet.level}, phẩm chất ${pet.quality}`,
                      `View ${POKEMON[pet.species].name}, level ${pet.level}, quality ${pet.quality}`,
                    )}
                  >
                    <span className="pet-level">
                      {t('Cấp', 'Level')} {pet.level}
                    </span>
                    <Portrait id={pet.species} />
                    <h3>{POKEMON[pet.species].name}</h3>
                    <span className={`pet-quality quality-${pet.quality}`}>
                      {t('Phẩm chất', 'Quality')} {pet.quality}
                    </span>
                    <ElementBadge element={POKEMON[pet.species].element} />
                    <span className="pet-card-hint">{t('Xem thông tin', 'View details')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="pets-empty">
                <PawPrint size={48} />
                <h3>{t('Chưa có linh thú nào', 'No companions yet')}</h3>
                <p>
                  {t(
                    'Triệu hồi miễn phí để gặp người bạn đầu tiên.',
                    'Summon for free to meet your first companion.',
                  )}
                </p>
                <button
                  className="fantasy-frame fantasy-action gold"
                  onClick={() => {
                    setTab('summon');
                    setSelectedId(null);
                  }}
                >
                  {t('Triệu hồi ngay', 'Start summoning')}
                </button>
              </div>
            )}
          </>
        ))}
    </Dialog>
  );
}

function OwnedPetDetails({ pet, onBack }: { pet: OwnedPet; onBack: () => void }) {
  const { t, language } = useLanguage();
  const c = useCopy();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [pet.id]);
  const definition = POKEMON[pet.species];
  const stats = calculatePetStats(definition, pet);
  return (
    <section className="owned-pet-detail" aria-label={t('Thông tin pet', 'Pet details')}>
      <button className="pet-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {t('Về bộ sưu tập', 'Back to collection')}
      </button>
      <div className="pet-detail-hero">
        <Portrait id={pet.species} />
        <div>
          <h3 ref={heading} tabIndex={-1}>
            {definition.name}
          </h3>
          <span className="pet-level">
            {t('Cấp', 'Level')} {pet.level}
          </span>
          <span className={`pet-quality quality-${pet.quality}`}>
            {t('Phẩm chất', 'Quality')} {pet.quality}
          </span>
          <ElementBadge element={definition.element} />
          <p>{c(definition.role)}</p>
          <strong>
            {t('Lực chiến', 'Combat power')}:{' '}
            {combatPower(stats).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
          </strong>
        </div>
      </div>
      <p>
        {pet.level === 100
          ? t('Đã đạt cấp tối đa', 'Maximum level')
          : `${pet.experience ?? 0} / ${experienceToNextLevel(pet.level)} EXP`}
      </p>
      <p className="pet-description">{c(definition.description)}</p>
      <h4>{t('Chỉ số', 'Stats')}</h4>
      <dl className="pet-detail-stats">
        {[
          [t('Sinh lực', 'Health'), stats.hp],
          [t('Tấn công', 'Attack'), stats.attack],
          [t('Phòng thủ', 'Defense'), stats.defense],
          [t('Tốc độ', 'Speed'), stats.speed],
          [t('Tốc độ chạy', 'Sprint speed'), stats.sprintSpeed],
          [t('Thể lực', 'Stamina'), stats.maxStamina],
          [t('Năng lượng', 'Energy'), definition.energy],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="pets-note">
        {t(
          'Chỉ số theo cấp độ và phẩm chất hiện tại của pet.',
          'Stats reflect this pet’s current level and quality.',
        )}
      </p>
      {definition.passive && (
        <div className="pet-passive">
          <h4>
            {t('Nội tại', 'Passive')} · {definition.passive.name}
          </h4>
          <p>{definition.passive.description}</p>
        </div>
      )}
      <h4>{t('Kỹ năng', 'Skills')}</h4>
      <div className="pet-detail-skills">
        {definition.skills.map((skill) => (
          <article key={skill.id}>
            <strong>{skill.name}</strong>
            <ElementBadge element={skill.element} />
            <p>{skill.description}</p>
            <small>
              {skill.damagePercent}% {t('tấn công', 'attack')} · {skill.energy}{' '}
              {t('năng lượng', 'energy')} · {skill.cooldown}s {t('hồi chiêu', 'cooldown')}
              {' · '}
              {formatSkillRange(skill, language)}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
