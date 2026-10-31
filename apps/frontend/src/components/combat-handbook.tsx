'use client';

import { useState } from 'react';
import { EFFECTIVENESS, ELEMENTS, ROSTER } from '@arena/game-data';
import { calculateDamage } from '@arena/game-core';
import { BASIC_GUARD_REDUCTION, type Element } from '@arena/shared-types';
import { useLanguage } from '@/lib/i18n';
import { Dialog } from './ui/dialog';

const elements = Object.keys(ELEMENTS) as Element[];
const vietnamese: Record<Element, string> = {
  normal: 'Thường',
  electric: 'Điện',
  fire: 'Lửa',
  water: 'Nước',
  grass: 'Cỏ',
  poison: 'Độc',
};
const multiplier = (attack: Element, defense: Element) => EFFECTIVENESS[attack]?.[defense] ?? 1;
const multiplierClass = (value: number) =>
  value > 1 ? 'advantage' : value < 1 ? 'resisted' : 'neutral';

export function CombatHandbook({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('types');
  const [element, setElement] = useState<Element>('fire');
  const [direction, setDirection] = useState('attack');
  const [attackElement, setAttackElement] = useState<Element>('fire');
  const [targetElement, setTargetElement] = useState<Element>('grass');
  const [attack, setAttack] = useState(100);
  const [defense, setDefense] = useState(50);
  const [power, setPower] = useState(100);
  const [guard, setGuard] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [adaptive, setAdaptive] = useState(false);
  const name = (value: Element) => t(vietnamese[value], ELEMENTS[value].label);
  const badge = (value: Element) => (
    <span className="handbook-element" style={{ color: ELEMENTS[value].color }}>
      <span aria-hidden="true">{ELEMENTS[value].symbol}</span> {name(value)}
    </span>
  );
  const baseDamage = calculateDamage(
    power,
    attack,
    defense,
    attackElement,
    targetElement,
    enabled,
    guard,
  );
  const damage = Math.round(baseDamage * (adaptive ? 1.15 : 1));
  const factor = enabled ? multiplier(attackElement, targetElement) : 1;
  const tabs = [
    ['types', t('Khắc hệ', 'Type matchups')],
    ['damage', t('Cách tính sát thương', 'Damage guide')],
    ['calculator', t('Thử sát thương', 'Damage calculator')],
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('Cơ chế chiến đấu', 'Combat Handbook')}
      description={t(
        'Hiểu từng hệ · Nắm từng đòn · Làm chủ trận đấu',
        'Know every type · Understand every hit · Master the battle',
      )}
      className="combat-handbook"
      focusContentOnOpen
    >
      <nav className="handbook-tabs" aria-label={t('Mục sổ tay', 'Handbook sections')}>
        {tabs.map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="handbook-body" key={tab}>
        {tab === 'types' && (
          <>
            <p className="handbook-note">
              {t(
                '6 hệ hiện có trong game. Hệ của kỹ năng đánh vào hệ của mục tiêu; các cặp không có khắc chế nhận ×1.',
                'The game currently has 6 types. A skill’s type is matched against the target’s type; unlisted matchups use ×1.',
              )}
            </p>
            <div className="handbook-legend">
              <span className="advantage">×1.4 · {t('Tăng 40%', '+40%')}</span>
              <span className="neutral">×1 · {t('Bình thường', 'Normal')}</span>
              <span className="resisted">×0.75 · {t('Giảm 25%', '−25%')}</span>
            </div>
            <h3>{t('Chọn một hệ để tra cứu', 'Choose a type to explore')}</h3>
            <div className="handbook-types">
              {elements.map((value) => (
                <button
                  key={value}
                  aria-pressed={element === value}
                  onClick={() => setElement(value)}
                >
                  {badge(value)}
                </button>
              ))}
            </div>
            <div className="handbook-direction">
              <button aria-pressed={direction === 'attack'} onClick={() => setDirection('attack')}>
                {t('Khi tấn công →', 'When attacking →')}
              </button>
              <button aria-pressed={direction === 'defend'} onClick={() => setDirection('defend')}>
                {t('← Khi phòng thủ', '← When defending')}
              </button>
            </div>
            <p>
              {direction === 'attack'
                ? t(
                    `Kỹ năng hệ ${vietnamese[element]} gây sát thương lên:`,
                    `${name(element)} skills deal damage to:`,
                  )
                : t(
                    `Mục tiêu hệ ${vietnamese[element]} nhận sát thương từ:`,
                    `${name(element)} targets take damage from:`,
                  )}
            </p>
            <div className="handbook-matchups">
              {elements.map((other) => {
                const value =
                  direction === 'attack' ? multiplier(element, other) : multiplier(other, element);
                return (
                  <div key={other}>
                    {badge(other)}
                    <strong className={multiplierClass(value)}>×{value}</strong>
                  </div>
                );
              })}
            </div>
            <details className="handbook-details">
              <summary>{t('Bảng khắc hệ đầy đủ', 'Full type chart')}</summary>
              <p>
                {t(
                  'Hàng = hệ kỹ năng tấn công. Cột = hệ mục tiêu. Vuốt ngang nếu bảng rộng hơn màn hình.',
                  'Rows = attacking skill type. Columns = target type. Swipe horizontally to see the whole chart.',
                )}
              </p>
              <div
                className="handbook-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={t('Bảng hệ có thể cuộn', 'Scrollable type chart')}
              >
                <table>
                  <caption>
                    {t('Hệ tấn công ↓ / Hệ mục tiêu →', 'Attacking type ↓ / Target type →')}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('Hệ', 'Type')}</th>
                      {elements.map((value) => (
                        <th scope="col" key={value}>
                          {name(value)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {elements.map((row) => (
                      <tr key={row}>
                        <th scope="row">{badge(row)}</th>
                        {elements.map((col) => (
                          <td key={col} className={multiplierClass(multiplier(row, col))}>
                            ×{multiplier(row, col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="handbook-note">
              {t(
                'Khắc hệ có hướng: Điện → Nước ×1.4, nhưng Nước → Điện ×1. Không có miễn nhiễm hệ hay hệ kép trong cơ chế hiện tại. Khi luật “Khắc hệ” tắt, mọi cặp đều ×1.',
                'Matchups are directional: Electric → Water is ×1.4, but Water → Electric is ×1. The current system has no type immunities or dual types. Turning elemental matchups off makes every pair ×1.',
              )}
            </div>
          </>
        )}
        {tab === 'damage' && (
          <>
            <div className="handbook-formula">
              {t('Sát thương một đòn trúng', 'Damage per hit')}
              <strong>ATK × (% / 100) × 100 / (100 + DEF) × H × (1 − G)</strong>
            </div>
            <dl className="handbook-definitions">
              <div>
                <dt>ATK</dt>
                <dd>
                  {t(
                    'Chỉ số tấn công hiện tại của người ra đòn, đã tính cấp và phẩm chất nếu chế độ áp dụng tiến trình pet.',
                    'The attacker’s current Attack, including level and quality in modes that apply pet progression.',
                  )}
                </dd>
              </div>
              <div>
                <dt>%</dt>
                <dd>
                  {t(
                    'Hệ số sát thương của kỹ năng. 120% ATK nghĩa là ATK ×1.2, không phải gây 120 HP cố định.',
                    'The skill’s damage percentage. 120% ATK means ATK ×1.2, not a fixed 120 HP.',
                  )}
                </dd>
              </div>
              <div>
                <dt>DEF</dt>
                <dd>
                  {t(
                    'Phòng thủ của mục tiêu. DEF 50 giữ lại 66.67% sát thương; DEF 100 giữ lại 50%; DEF 200 giữ lại 33.33%.',
                    'The target’s Defense. DEF 50 retains 66.67% damage; DEF 100 retains 50%; DEF 200 retains 33.33%.',
                  )}
                </dd>
              </div>
              <div>
                <dt>H</dt>
                <dd>
                  {t(
                    'Hệ số khắc hệ ×1.4 / ×1 / ×0.75. Dùng hệ kỹ năng, không lấy hệ người ra đòn. Mọi hệ dùng chung công thức.',
                    'The type multiplier: ×1.4 / ×1 / ×0.75. Uses the skill’s type, not the attacker’s. All types share this formula.',
                  )}
                </dd>
              </div>
              <div>
                <dt>G</dt>
                <dd>
                  {t(
                    'Tỷ lệ giảm sát thương. Đỡ thường 20%; phản đòn Counter Pounce 70% khi kích hoạt. Khi có nhiều khiên hoặc đỡ, lấy mức mạnh nhất, không cộng các mức giảm.',
                    'Damage reduction. Basic guard reduces 20%; triggered Counter Pounce reduces 70%. Multiple shields and guards use the strongest reduction, without adding them together.',
                  )}
                </dd>
              </div>
            </dl>
            <h3>{t('Ví dụ từng bước', 'Worked example')}</h3>
            <p>
              {t(
                'ATK 100 · kỹ năng Lửa 120% · mục tiêu Cỏ, DEF 50 · đỡ 20%.',
                'ATK 100 · Fire skill 120% · Grass target, DEF 50 · guard 20%.',
              )}
            </p>
            <div className="handbook-formula">
              <strong>100 × 1.2 × (100 / 150) × 1.4 × 0.8 = 89.6 → 90 HP</strong>
            </div>
            <h3>{t('Làm tròn và ngoại lệ', 'Rounding and special cases')}</h3>
            <ul className="handbook-rules">
              <li>
                {t(
                  'Làm tròn đến số nguyên gần nhất sau khi nhân các hệ số. ATK hoặc % bằng 0 thì gây 0; đòn có sát thương hợp lệ tối thiểu 1 HP.',
                  'Round to the nearest integer after multiplying the factors. Zero ATK or zero power deals 0; a valid damaging hit deals at least 1 HP.',
                )}
              </li>
              <li>
                {t(
                  'Eevee né thành công nhận cường hóa trong 2 giây: đòn trúng kế tiếp được nhân ×1.15 sau lần làm tròn cơ bản, rồi làm tròn lần nữa và tiêu thụ cường hóa.',
                  'A successful Eevee dodge grants a 2-second charge: the next hit multiplies the rounded base damage by ×1.15, rounds again, and consumes the charge.',
                )}
              </li>
              <li>
                {t(
                  'Bỏng và Hạt Ký Sinh: mỗi nhịp 1 giây tính ATK nguồn × (% hiệu ứng / 100), giảm 20% nếu đang đỡ, rồi làm tròn. Nhịp này không dùng DEF, khắc hệ hoặc khiên. Hạt Ký Sinh hồi cho nguồn còn sống bằng HP thực tế đã rút, tối đa tới HP đầy.',
                  'Burn and Leech Seed tick every second: source ATK × (effect strength / 100), reduced by 20% when guarding, then rounded. These ticks ignore DEF, type and shields. Leech heals a living source by the actual HP drained, up to full HP.',
                )}
              </li>
              <li>
                {t(
                  'Vũng độc dùng công thức sát thương thường cho mỗi nhịp: 16% ATK mỗi 0.5 giây, tồn tại 5 giây. Không nhân thêm hệ số Độc cho phần sát thương đã tính.',
                  'Poison pools use the normal formula per tick: 16% ATK every 0.5 seconds for 5 seconds. Do not apply the Poison multiplier a second time.',
                )}
              </li>
              <li>
                {t(
                  'Kỹ năng nhiều đòn tính theo từng lần trúng; hụt đòn, ra ngoài tầm, vật cản hoặc đang bất tử khi né có thể khiến sát thương thực tế thấp hơn. Tổng % trên mô tả không bảo đảm mọi đòn đều trúng.',
                  'Multi-hit moves calculate each hit separately. Misses, range, obstacles and dodge invulnerability can lower actual damage. A listed total percentage does not guarantee every hit lands.',
                )}
              </li>
              <li>
                {t(
                  'Hiện chưa có hệ số chí mạng ngẫu nhiên hay thưởng cùng hệ (STAB) trong công thức. “Vật lý” và “đặc biệt” đều dùng ATK và DEF chung.',
                  'The current formula has no random critical multiplier or same-type bonus (STAB). Physical and special moves both use the shared ATK and DEF stats.',
                )}
              </li>
            </ul>
            <button className="handbook-link" onClick={() => setTab('calculator')}>
              {t('Thử công thức với chỉ số của bạn →', 'Try the formula with your own stats →')}
            </button>
          </>
        )}
        {tab === 'calculator' && (
          <>
            <p className="handbook-note">
              {t(
                'Ước tính một lần trúng trực tiếp. Nhập ATK/DEF hiện tại; không phải tổng sát thương cả kỹ năng nhiều đòn hay sát thương theo thời gian.',
                'Estimate one direct hit using current ATK/DEF. This is not the total for a multi-hit move or damage-over-time effect.',
              )}
            </p>
            <div className="handbook-fields">
              <label>
                {t('Hệ kỹ năng', 'Skill type')}
                <select
                  value={attackElement}
                  onChange={(e) => setAttackElement(e.target.value as Element)}
                >
                  {elements.map((value) => (
                    <option key={value} value={value}>
                      {name(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Hệ mục tiêu', 'Target type')}
                <select
                  value={targetElement}
                  onChange={(e) => setTargetElement(e.target.value as Element)}
                >
                  {elements.map((value) => (
                    <option key={value} value={value}>
                      {name(value)}
                    </option>
                  ))}
                </select>
              </label>
              {[
                [t('Tấn công (ATK)', 'Attack (ATK)'), attack, setAttack],
                [t('Phòng thủ (DEF)', 'Defense (DEF)'), defense, setDefense],
                [t('Hệ số kỹ năng (% ATK)', 'Skill power (% ATK)'), power, setPower],
              ].map(([label, value, setter]) => (
                <label key={String(label)}>
                  {String(label)}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000000"
                    value={value as number}
                    onChange={(e) =>
                      (setter as (value: number) => void)(
                        Math.min(1000000, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                  />
                </label>
              ))}
              <label>
                {t('Giảm sát thương mạnh nhất', 'Strongest damage reduction')}
                <select value={guard} onChange={(e) => setGuard(Number(e.target.value))}>
                  <option value={0}>{t('Không giảm · 0%', 'None · 0%')}</option>
                  <option value={BASIC_GUARD_REDUCTION}>
                    {t('Đỡ thường · 20%', 'Basic guard · 20%')}
                  </option>
                  <option value={0.55}>{t('Khiên · 55%', 'Shield · 55%')}</option>
                  <option value={0.65}>{t('Khiên · 65%', 'Shield · 65%')}</option>
                  <option value={0.7}>{t('Phản đòn · 70%', 'Counter · 70%')}</option>
                </select>
              </label>
            </div>
            <label className="handbook-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              {t('Bật khắc hệ', 'Enable elemental matchups')}
            </label>
            <label className="handbook-check">
              <input
                type="checkbox"
                checked={adaptive}
                onChange={(e) => setAdaptive(e.target.checked)}
              />
              {t(
                'Đòn cường hóa sau né của Eevee · ×1.15',
                'Eevee’s charged hit after dodging · ×1.15',
              )}
            </label>
            <div className="handbook-result" role="status" aria-live="polite">
              <span>{t('Sát thương dự tính', 'Estimated damage')}</span>
              <strong>{damage.toLocaleString()} HP</strong>
              <p>
                {attack} × {power / 100} × (100 / {100 + defense}) × {factor} × {1 - guard}
                {adaptive ? ` → ${baseDamage} × 1.15` : ''}
              </p>
              <small>
                {t(
                  'Đã làm tròn theo công thức game. HP mục tiêu không giảm xuống dưới 0.',
                  'Rounded using the game formula. Target HP cannot drop below 0.',
                )}
              </small>
            </div>
            <details className="handbook-details">
              <summary>
                {t('Tham khảo ATK / DEF gốc của pet', 'Pet base ATK / DEF reference')}
              </summary>
              <p>
                {t(
                  'Cấp 1, phẩm chất C; dùng chỉ số thực tế nếu pet đã phát triển.',
                  'Level 1, quality C; use current stats for progressed pets.',
                )}
              </p>
              <div className="handbook-matchups">
                {ROSTER.map((pet) => (
                  <div key={pet.id}>
                    <span>
                      {pet.name} · {name(pet.element)}
                    </span>
                    <strong>
                      {pet.attack} / {pet.defense}
                    </strong>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </Dialog>
  );
}
