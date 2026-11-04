'use client';
import { useMemo, useState } from 'react';
import { POKEMON, ELEMENTS, calculatePetStats, combatPower } from '@arena/game-data';
import { PET_QUALITIES, type OwnedPet } from '@arena/shared-types';
import { useCopy, useLanguage } from '@/lib/i18n';
import { ElementBadge } from './common';

type Sort = 'power' | 'quality' | 'time';

export function useFormationPets(pets: OwnedPet[] | null | undefined) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('power');
  const [quality, setQuality] = useState('all');
  const [element, setElement] = useState('all');
  const visible = useMemo(
    () =>
      (pets ?? [])
        .filter(
          (pet) =>
            POKEMON[pet.species].name
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()) &&
            (quality === 'all' || pet.quality === quality) &&
            (element === 'all' || POKEMON[pet.species].element === element),
        )
        .map((pet) => ({ pet, power: combatPower(calculatePetStats(POKEMON[pet.species], pet)) }))
        .sort((a, b) => {
          const difference =
            sort === 'power'
              ? b.power - a.power
              : sort === 'quality'
                ? PET_QUALITIES.indexOf(b.pet.quality) - PET_QUALITIES.indexOf(a.pet.quality)
                : Date.parse(b.pet.acquiredAt) - Date.parse(a.pet.acquiredAt);
          return (
            difference ||
            Date.parse(b.pet.acquiredAt) - Date.parse(a.pet.acquiredAt) ||
            a.pet.id.localeCompare(b.pet.id)
          );
        }),
    [pets, sort, quality, element, search],
  );
  return {
    visible,
    search,
    setSearch,
    sort,
    setSort,
    quality,
    setQuality,
    element,
    setElement,
    total: pets?.length ?? 0,
  };
}

export function FormationPetFilters({ browser }: { browser: ReturnType<typeof useFormationPets> }) {
  const { t } = useLanguage();
  const c = useCopy();
  return (
    <>
      <div className="formation-pet-filters">
        <label className="formation-search">
          {t('Tìm thú', 'Find companions')}
          <input
            type="search"
            placeholder={t('Tìm theo tên…', 'Search by name…')}
            value={browser.search}
            onChange={(event) => browser.setSearch(event.target.value)}
          />
        </label>
        <label>
          {t('Sắp xếp theo', 'Sort by')}
          <select
            aria-label={t('Sắp xếp theo', 'Sort by')}
            value={browser.sort}
            onChange={(event) => browser.setSort(event.target.value as Sort)}
          >
            <option value="power">{t('Chiến lực', 'Combat power')}</option>
            <option value="quality">{t('Phẩm chất', 'Quality')}</option>
            <option value="time">{t('Thời gian', 'Time acquired')}</option>
          </select>
        </label>
        <label>
          {t('Phẩm chất', 'Quality')}
          <select
            aria-label={t('Phẩm chất', 'Quality')}
            value={browser.quality}
            onChange={(event) => browser.setQuality(event.target.value)}
          >
            <option value="all">{t('Tất cả', 'All')}</option>
            {PET_QUALITIES.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Hệ', 'Element')}
          <select
            aria-label={t('Hệ', 'Element')}
            value={browser.element}
            onChange={(event) => browser.setElement(event.target.value)}
          >
            <option value="all">{t('Tất cả', 'All')}</option>
            {Object.entries(ELEMENTS).map(([element, definition]) => (
              <option key={element} value={element}>
                {c(definition.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" role="status">
        {t(
          `Hiển thị ${browser.visible.length} / ${browser.total} pet`,
          `Showing ${browser.visible.length} / ${browser.total} pets`,
        )}
      </p>
      {browser.total > 0 && browser.visible.length === 0 && (
        <p>{t('Không có pet phù hợp với bộ lọc.', 'No pets match these filters.')}</p>
      )}
    </>
  );
}

export function FormationPetStats({ pet, power }: { pet: OwnedPet; power: number }) {
  const { t, language } = useLanguage();
  return (
    <>
      <span>Lv.{pet.level}</span>
      <span className={`pet-quality quality-${pet.quality}`}>
        <span className="formation-sr-only">{t('Phẩm chất', 'Quality')} </span>
        {pet.quality}
      </span>
      <ElementBadge element={POKEMON[pet.species].element} />
      <small>
        {t('Lực chiến', 'Combat power')}{' '}
        {power.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
      </small>
    </>
  );
}
