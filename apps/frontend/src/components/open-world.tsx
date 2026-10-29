'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Compass,
  Footprints,
  Map,
  Mountain,
  Pause,
  Play,
  Tent,
  Waves,
  Sun,
  X,
} from 'lucide-react';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { OpenWorldEngine, type WorldStatus } from '@/game/open-world-engine';
import {
  BIOMES,
  SAVE_KEY,
  MAIN_WORLD_SEED,
  LEGACY_SAVE_KEY,
  METERS_PER_TILE,
  WORLD_KM,
  WORLD_SIZE,
  WORLD_AREA_KM2,
  biomeColors,
  biomeNames,
  parseWorldSave,
  type WorldSave,
} from '@/game/open-world-world';
import { Dialog } from './ui/dialog';
import { WorldCompanions } from './world-companions';
import { CityTour } from './city-tour';
import { CITY_TOUR } from '@/game/binh-minh-tour';

const names = {
  pikachu: 'Pikachu',
  bulbasaur: 'Bulbasaur',
  squirtle: 'Squirtle',
  charmander: 'Charmander',
  eevee: 'Eevee',
};
export default function OpenWorld() {
  const { language, t } = useLanguage();
  const reducedMotion = useGame((s) => s.reducedMotion);
  const surface = useRef<HTMLCanvasElement>(null),
    minimap = useRef<HTMLCanvasElement>(null);
  const engine = useRef<OpenWorldEngine | null>(null);
  const pendingCityWalk = useRef<{ x: number; y: number } | null>(null);
  const [expedition, setExpedition] = useState<{ seed: number; saved: WorldSave | null } | null>(
    null,
  );
  const [status, setStatus] = useState<WorldStatus | null>(null);
  const [panel, setPanel] = useState<'pause' | 'journal' | 'city' | null>(null);
  const [cityVisits, setCityVisits] = useState<string[]>([]);
  const [cityWalkError, setCityWalkError] = useState('');
  const [petPanelOpen, setPetPanelOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false),
    [error, setError] = useState('');
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);
  const [climbHeld, setClimbHeld] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: '', y: '' });
  const [travelError, setTravelError] = useState('');
  useEffect(() => {
    let saved: WorldSave | null = null;
    try {
      saved =
        parseWorldSave(localStorage.getItem(SAVE_KEY)) ??
        parseWorldSave(localStorage.getItem(LEGACY_SAVE_KEY));
    } catch {
      /* Storage can be disabled. */
    }
    if (saved && saved.seed !== MAIN_WORLD_SEED) {
      saved = { ...saved, seed: MAIN_WORLD_SEED, player: { x: -1, y: -1 } };
    }
    setExpedition({ seed: MAIN_WORLD_SEED, saved });
  }, []);
  useEffect(() => {
    if (!expedition || !surface.current || !minimap.current) return;
    try {
      const instance = new OpenWorldEngine(
        surface.current,
        minimap.current,
        expedition.seed,
        expedition.saved,
        setStatus,
      );
      engine.current = instance;
      return () => {
        instance.destroy();
        engine.current = null;
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Canvas unavailable');
    }
  }, [expedition]);
  useEffect(() => {
    if (engine.current) {
      engine.current.input.mapOverview = mapOpen;
      engine.current.setPaused(panel !== null || mapOpen || petPanelOpen);
      engine.current.input.reducedMotion = reducedMotion;
      engine.current.input.sprint = running;
      engine.current.input.x = 0;
      engine.current.input.y = 0;
      engine.current.input.climb = false;
      if (panel === null && pendingCityWalk.current) {
        engine.current.walkTo(pendingCityWalk.current);
        pendingCityWalk.current = null;
      }
    }
    setStick({ x: 0, y: 0 });
    setClimbHeld(false);
  }, [panel, mapOpen, petPanelOpen, reducedMotion, running, expedition]);
  const inCombat = Boolean(status?.target || status?.combat);
  useEffect(() => {
    if (!status?.city || !engine.current || inCombat) return;
    const { spawn } = engine.current.world;
    const nearby = CITY_TOUR.filter(
      (stop) => Math.hypot(status.x - spawn.x - stop.x, status.y - spawn.y - stop.y) < 3.5,
    );
    if (nearby.length)
      setCityVisits((current) => {
        const next = [...new Set([...current, ...nearby.map((stop) => stop.id)])];
        return next.length === current.length ? current : next;
      });
  }, [status, inCombat]);
  useEffect(() => {
    if (inCombat) setMapOpen(false);
  }, [inCombat]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, select, [role="dialog"]')
      )
        return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mapOpen) setMapOpen(false);
        else setPanel((p) => (p === 'pause' ? null : 'pause'));
      }
      if (!inCombat && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMapOpen((v) => !v);
      }
      if (!inCombat && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setPanel((p) => (p === 'journal' ? null : 'journal'));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mapOpen, inCombat]);
  function joystick(e: PointerEvent<HTMLDivElement>) {
    if (e.type === 'pointermove' && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / 32,
      y = (e.clientY - r.top - r.height / 2) / 32;
    const length = Math.max(1, Math.hypot(x, y));
    const vector = { x: x / length, y: y / length };
    setStick(vector);
    if (engine.current) {
      engine.current.input.x = vector.x;
      engine.current.input.y = vector.y;
    }
  }
  function releaseStick() {
    setStick({ x: 0, y: 0 });
    if (engine.current) {
      engine.current.input.x = 0;
      engine.current.input.y = 0;
    }
  }
  const label = (biome: keyof typeof biomeNames) => biomeNames[biome][language === 'vi' ? 0 : 1];
  return (
    <section
      className={`open-world ${status?.city ? 'world-in-city' : ''} ${inCombat ? 'world-in-combat' : ''}`}
      aria-label={t('Khám phá thế giới mở', 'Open world exploration')}
    >
      <canvas
        ref={surface}
        className="world-surface"
        data-testid="world-canvas"
        tabIndex={0}
        aria-label={t(
          'Thế giới pixel. WASD để đi, Space để nhảy, giữ E và hướng di chuyển để leo.',
          'Pixel world. WASD to move, Space to jump, hold E and a direction to climb.',
        )}
      />
      <div className="world-vignette" aria-hidden="true" />
      {(!status || error) && (
        <div className="world-loading" role={error ? 'alert' : 'status'}>
          <Compass size={32} />
          <strong>
            {error
              ? t('Không thể mở thế giới', 'Unable to open world')
              : t('Đang vẽ một hành trình mới…', 'Drawing a new adventure…')}
          </strong>
          {error && (
            <>
              <span>{error}</span>
              <button onClick={() => useGame.getState().go('modes')}>
                {t('Quay lại', 'Go back')}
              </button>
            </>
          )}
        </div>
      )}
      <header className="world-header">
        <button
          className="world-icon"
          aria-label={t('Về menu chơi', 'Back to play menu')}
          onClick={() => useGame.getState().go('modes')}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="world-brand">
          <span>POKÉMON · WILDLANDS</span>
          <h1>{t('Miền đất tự do', 'The wildlands')}</h1>
        </div>
        <span className="world-expedition">
          <i />
          {t('CHUYẾN THÁM HIỂM', 'FIELD EXPEDITION')}
          <small>
            {WORLD_AREA_KM2.toFixed(1)} km² · #
            {expedition?.seed.toString(16).toUpperCase().padStart(8, '0') ?? '…'}
          </small>
        </span>
        <button
          className="world-icon world-pause"
          aria-label={t('Tạm dừng khám phá', 'Pause exploration')}
          onClick={() => setPanel('pause')}
        >
          <Pause size={19} />
        </button>
      </header>
      <aside className="world-location">
        <span className="world-eyebrow">
          <span className="world-dot" />
          {t('BẠN ĐANG Ở', 'YOU ARE HERE')}
        </span>
        <h2>
          {status
            ? status.city
              ? t('Thành phố Bình Minh', 'Bình Minh City')
              : label(status.biome)
            : '…'}
        </h2>
        <p>
          <Compass size={12} />{' '}
          {status
            ? `${((status.x * METERS_PER_TILE) / 1000).toFixed(2)} km E / ${((status.y * METERS_PER_TILE) / 1000).toFixed(2)} km S`
            : '—'}
          <span>·</span>
          {status?.water
            ? t('Đang chèo thuyền', 'Sailing')
            : status?.city
              ? t('Vùng bảo hộ lực trường', 'Force-field sanctuary')
              : t('Tự do khám phá', 'Free to wander')}
        </p>
      </aside>
      {status?.city && !inCombat && (
        <button
          className="city-tour-toggle"
          onClick={() => {
            setCityWalkError('');
            setPanel('city');
          }}
        >
          <Sun size={17} />
          <span>{t('Dạo phố Bình Minh', 'Bình Minh city walk')}</span>
          <small>{cityVisits.length}/4</small>
        </button>
      )}
      <div className="world-elevation" data-testid="world-elevation">
        <Mountain size={15} />
        <strong>{status?.elevation ?? 0} m</strong>
        <span>
          {status?.landform === 'ridge'
            ? t('Sườn núi', 'Mountain ridge')
            : status?.landform === 'hill'
              ? t('Đồi bậc thang', 'Terraced hills')
              : status?.landform === 'valley'
                ? t('Thung lũng', 'Valley')
                : t('Đồng bằng', 'Lowlands')}
        </span>
      </div>
      <aside
        className={`world-map ${mapOpen ? 'expanded' : ''}`}
        aria-label={t('Bản đồ thế giới', 'World map')}
      >
        <div className="world-map-heading">
          <span>
            <Map size={13} />
            {mapOpen ? t('LỤC ĐỊA & QUẦN ĐẢO', 'CONTINENTS & ISLANDS') : t('XUNG QUANH', 'NEARBY')}
          </span>
          <button
            aria-label={
              mapOpen ? t('Thu nhỏ bản đồ', 'Collapse map') : t('Mở bản đồ', 'Expand map')
            }
            onClick={() => setMapOpen((v) => !v)}
          >
            {mapOpen ? <X size={16} /> : <span>⛶</span>}
          </button>
        </div>
        <div className="world-map-art">
          <canvas ref={minimap} width={256} height={256} />
          <span className="world-map-north">N</span>
        </div>
        <div className="world-map-caption">
          <span>
            <i />
            {t('Bạn', 'You')}
          </span>
          <span>
            <i />
            {t('Bình Minh', 'Bình Minh')}
          </span>
          <small>
            {status?.visited.length ?? 0}/8 {t('vùng', 'regions')}
          </small>
        </div>
        {mapOpen && (
          <>
            <p className="world-map-note">
              {t(
                'Chọn một cổng dịch chuyển để khám phá miền đất mới.',
                'Choose a waygate to explore a new region.',
              )}
            </p>
            <form
              className="world-coordinate-travel"
              aria-label={t('Dịch chuyển theo tọa độ', 'Travel to coordinates')}
              onSubmit={(event) => {
                event.preventDefault();
                const x = Number(coordinates.x.trim());
                const y = Number(coordinates.y.trim());
                if (
                  !coordinates.x.trim() ||
                  !coordinates.y.trim() ||
                  !Number.isFinite(x) ||
                  !Number.isFinite(y) ||
                  x <= 1 ||
                  y <= 1 ||
                  x >= WORLD_SIZE - 2 ||
                  y >= WORLD_SIZE - 2
                ) {
                  setTravelError(
                    t(
                      `Nhập X và Y lớn hơn 1, nhỏ hơn ${WORLD_SIZE - 2}.`,
                      `Enter X and Y greater than 1 and less than ${WORLD_SIZE - 2}.`,
                    ),
                  );
                  return;
                }
                if (!engine.current?.travelTo({ x, y })) {
                  setTravelError(
                    t(
                      'Không thể đến vị trí này. Hãy tránh công trình, tường lực trường, cây, đá và dung nham.',
                      'Cannot travel here. Avoid buildings, force fields, trees, rocks and lava.',
                    ),
                  );
                  return;
                }
                setTravelError('');
                setMapOpen(false);
                surface.current?.focus();
              }}
            >
              <strong>{t('Dịch chuyển theo tọa độ', 'Travel to coordinates')}</strong>
              <p id="world-coordinate-hint">
                {t(
                  'Tọa độ ô bản đồ · X hướng Đông, Y hướng Nam · 1 ô = 2 m.',
                  'Map tile coordinates · X east, Y south · 1 tile = 2 m.',
                )}{' '}
                {t('Hiện tại:', 'Current:')} X {status?.x.toFixed(2) ?? '—'}, Y{' '}
                {status?.y.toFixed(2) ?? '—'}
              </p>
              <div className="world-coordinate-fields">
                {(['x', 'y'] as const).map((axis) => (
                  <label key={axis}>
                    {t('Tọa độ', 'Coordinate')} {axis.toUpperCase()}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      value={coordinates[axis]}
                      placeholder={status?.[axis].toFixed(2)}
                      aria-describedby="world-coordinate-hint world-coordinate-error"
                      aria-invalid={Boolean(travelError)}
                      onChange={(event) => {
                        setCoordinates((previous) => ({ ...previous, [axis]: event.target.value }));
                        setTravelError('');
                      }}
                    />
                  </label>
                ))}
              </div>
              <p id="world-coordinate-error" role="alert">
                {travelError}
              </p>
              <button type="submit" disabled={!status || inCombat}>
                <Compass size={16} />
                {t('Dịch chuyển', 'Teleport')}
              </button>
            </form>
            <div className="world-map-legend">
              {status?.landmarks.map((landmark) => (
                <button
                  key={landmark.biome}
                  aria-label={`${t('Dịch chuyển đến', 'Travel to')} ${label(landmark.biome)}`}
                  onClick={() => {
                    engine.current?.travelTo(landmark);
                    setMapOpen(false);
                  }}
                >
                  <i style={{ background: biomeColors[landmark.biome] }} />
                  <span>
                    {label(landmark.biome)}
                    <small>
                      {(
                        (Math.hypot(landmark.x - status.x, landmark.y - status.y) *
                          METERS_PER_TILE) /
                        1000
                      ).toFixed(2)}{' '}
                      km
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className="world-map-scale">
              <strong>{WORLD_AREA_KM2.toFixed(1)} km²</strong>
              <span>
                {WORLD_KM.toFixed(3)} × {WORLD_KM.toFixed(3)} km
              </span>
            </div>
            <details className="world-city-guide">
              <summary>{t('Khám phá thành phố Bình Minh', 'Discover Bình Minh City')}</summary>
              <img
                src="/assets/binh-minh/concept.png"
                alt={t(
                  'Phối cảnh thành phố Bình Minh với bốn cổng và tường lực trường',
                  'Bình Minh city concept with four gates and a protective force field',
                )}
              />
              <p>
                {t(
                  'Cổng triệu hồi ở quảng trường trung tâm. Bốn đại lộ dẫn tới cổng Bắc, Đông, Nam, Tây. Bệnh viện, học viện, công viên, đấu trường, cửa tiệm và bảo tàng nằm trong vành đai bảo vệ.',
                  'The summoning portal stands in the central plaza. Four avenues lead to the north, east, south and west gates. Hospitals, an academy, parks, an arena, shops and a museum sit within the protective perimeter.',
                )}
              </p>
            </details>
          </>
        )}
      </aside>
      <WorldCompanions
        engine={engine.current}
        status={status}
        onPanelChange={setPetPanelOpen}
        paused={panel !== null || mapOpen || petPanelOpen}
      />
      {!status?.target && (
        <aside className="world-discovery" aria-live="polite">
          {status?.nearby ? (
            <>
              <img
                src={`/assets/${status.nearby.species}.${status.nearby.species === 'eevee' ? 'png' : 'svg'}`}
                alt=""
              />
              <div>
                <span className="world-eyebrow">
                  {t('BẠN ĐỒNG HÀNH HOANG DÃ', 'A WILD NEIGHBOR')}
                </span>
                <strong>
                  {names[status.nearby.species]} · Lv.{status.nearby.level} ·{' '}
                  {status.nearby.quality}
                </strong>
                <button onClick={() => engine.current?.selectWild(status.nearby!.id)}>
                  {t('Chọn mục tiêu', 'Select target')}
                </button>
                <p>
                  {status.nearby.count > 1
                    ? t(
                        `Đang đi theo bầy · ${status.nearby.count} con`,
                        `Roaming in a herd · ${status.nearby.count} Pokémon`,
                      )
                    : t('Một mình dạo chơi', 'A solitary wanderer')}
                </p>
              </div>
            </>
          ) : (
            <>
              <Footprints size={24} />
              <div>
                <span className="world-eyebrow">
                  {t('ĐI CHẬM VÀ QUAN SÁT', 'TAKE THE SCENIC ROUTE')}
                </span>
                <strong>{t('Thiên nhiên đang chờ', 'The wild is waiting')}</strong>
                <p>
                  {t(
                    'Đến gần Pokémon để ghi vào nhật ký.',
                    'Approach Pokémon to add them to your journal.',
                  )}
                </p>
              </div>
            </>
          )}
        </aside>
      )}
      <div
        className="world-touch-stick"
        role="group"
        aria-label={t('Cần điều khiển di chuyển', 'Movement joystick')}
        onPointerDown={joystick}
        onPointerMove={joystick}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onLostPointerCapture={releaseStick}
      >
        <span className="world-stick-cross">✣</span>
        <span
          className="world-stick-knob"
          style={{ transform: `translate(${stick.x * 26}px, ${stick.y * 26}px)` }}
        />
      </div>
      <footer className="world-toolbar">
        <div className="world-control-hint">
          <span>
            <kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> {t('Di chuyển', 'Move')}
          </span>
          <span>
            <kbd>Shift</kbd> {t('Chạy', 'Run')}
            <i />
            {t(
              'Bấm đất để đi · Kéo chuột để chọn quái',
              'Click ground to walk · Drag to select enemies',
            )}
          </span>
          <span>
            <kbd>Space</kbd> {t('Nhảy', 'Jump')} <kbd>E</kbd>{' '}
            {t('Giữ + hướng đi để leo', 'Hold + direction to climb')}
          </span>
        </div>
        <nav aria-label={t('Công cụ thám hiểm', 'Exploration tools')}>
          <button aria-label={t('Nhật ký', 'Journal')} onClick={() => setPanel('journal')}>
            <BookOpen size={19} />
            <span>{t('Nhật ký', 'Journal')}</span>
            <b>{status?.seen.length ?? 0}/5</b>
          </button>
          <button
            aria-label={t('Bản đồ', 'Map')}
            onClick={() => setMapOpen((v) => !v)}
            aria-pressed={mapOpen}
          >
            <Map size={19} />
            <span>{t('Bản đồ', 'Map')}</span>
            <kbd>M</kbd>
          </button>
          <button
            aria-label={t('Về Bình Minh', 'Bình Minh')}
            onClick={() => engine.current?.returnToCamp()}
          >
            <Tent size={19} />
            <span>{t('Về Bình Minh', 'Bình Minh')}</span>
          </button>
          <button
            className="world-run"
            aria-label={t('Chạy', 'Run')}
            aria-pressed={running}
            onClick={() => setRunning((v) => !v)}
          >
            <Footprints size={19} />
            <span>{t('Chạy', 'Run')}</span>
          </button>
        </nav>
        <span className={`world-save ${status && !status.saving ? 'failed' : ''}`}>
          <i />
          {status && !status.saving
            ? t('Không lưu được trên máy', 'Device save unavailable')
            : t('Tự động lưu trên máy', 'Autosaves on this device')}
        </span>
      </footer>
      <div className="world-traversal" aria-label={t('Nhảy và leo trèo', 'Jump and climb')}>
        <p role="status">
          {status?.action === 'climb'
            ? t('Đang leo vách…', 'Climbing…')
            : status?.action === 'jump' || status?.action === 'fall'
              ? t('Đang trên không', 'Airborne')
              : status?.action === 'blocked'
                ? t(
                    'Giữ Leo + hướng đi · Tìm lối vòng nếu vách quá cao',
                    'Hold Climb + direction · Go around tall cliffs',
                  )
                : t(
                    'Bước thấp: đi · Bậc cao: nhảy / leo',
                    'Low steps: walk · High ledges: jump / climb',
                  )}
        </p>
        <button
          aria-label={t('Nhảy', 'Jump')}
          disabled={status?.water || !status || mapOpen || panel !== null}
          onClick={() => engine.current?.requestJump()}
        >
          <ArrowUp size={21} />
          <span>{t('Nhảy', 'Jump')}</span>
          <kbd>Space</kbd>
        </button>
        <button
          aria-label={t('Giữ để leo', 'Hold to climb')}
          aria-pressed={climbHeld}
          disabled={status?.water || !status || mapOpen || panel !== null}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setClimbHeld(true);
            if (engine.current) engine.current.input.climb = true;
          }}
          onPointerUp={() => {
            setClimbHeld(false);
            if (engine.current) engine.current.input.climb = false;
          }}
          onPointerCancel={() => {
            setClimbHeld(false);
            if (engine.current) engine.current.input.climb = false;
          }}
          onLostPointerCapture={() => {
            setClimbHeld(false);
            if (engine.current) engine.current.input.climb = false;
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setClimbHeld(true);
              if (engine.current) engine.current.input.climb = true;
            }
          }}
          onKeyUp={() => {
            setClimbHeld(false);
            if (engine.current) engine.current.input.climb = false;
          }}
          onBlur={() => {
            setClimbHeld(false);
            if (engine.current) engine.current.input.climb = false;
          }}
        >
          <Mountain size={21} />
          <span>{t('Giữ Leo', 'Hold Climb')}</span>
          <kbd>E</kbd>
        </button>
      </div>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        className="world-dialog"
        title={
          panel === 'city'
            ? t('Sổ dạo phố Bình Minh', 'Bình Minh walking journal')
            : panel === 'journal'
              ? t('Nhật ký thám hiểm', 'Field journal')
              : t('Nghỉ chân một chút', 'A moment to rest')
        }
        description={t(
          'Hành trình đã tạm dừng. Những miền đất mới vẫn đang chờ bạn.',
          'Your journey is paused. New horizons will be waiting.',
        )}
      >
        {panel === 'city' ? (
          <CityTour
            visited={cityVisits}
            error={cityWalkError}
            onWalk={(stop) => {
              const instance = engine.current;
              if (!instance) return;
              const destination = {
                x: instance.world.spawn.x + stop.x,
                y: instance.world.spawn.y + stop.y,
              };
              if (
                Math.hypot(instance.player.x - destination.x, instance.player.y - destination.y) <
                  1.5 ||
                instance.walkTo(destination)
              ) {
                setCityWalkError('');
                pendingCityWalk.current = destination;
                setPanel(null);
              } else
                setCityWalkError(
                  t(
                    'Chưa tìm được lối đi. Hãy ra đại lộ rồi thử lại.',
                    'No route found. Step onto the avenue and try again.',
                  ),
                );
            }}
          />
        ) : panel === 'journal' ? (
          <>
            <div className="world-journal-pokemon">
              {Object.entries(names).map(([id, name]) => {
                const discovered = status?.seen.includes(id as keyof typeof names);
                return (
                  <div key={id} className={discovered ? 'discovered' : ''}>
                    <img src={`/assets/${id}.${id === 'eevee' ? 'png' : 'svg'}`} alt="" />
                    <strong>{discovered ? name : '???'}</strong>
                    <small>
                      {discovered ? t('Đã gặp', 'Observed') : t('Chưa gặp', 'Undiscovered')}
                    </small>
                  </div>
                );
              })}
            </div>
            <div className="world-journal-biomes">
              {BIOMES.map((b) => (
                <div key={b}>
                  <i style={{ background: biomeColors[b] }} />
                  <span>{label(b)}</span>
                  <small>{status?.visited.includes(b) ? t('Đã đến', 'Visited') : '—'}</small>
                </div>
              ))}
            </div>
            <p className="world-dialog-hint">
              {t(
                'Pokémon được ghi nhận khi bạn đến gần. Hãy tìm bên sông, trong rừng và trên sườn núi.',
                'Pokémon are recorded when you get close. Look along rivers, in forests and on mountain slopes.',
              )}
            </p>
          </>
        ) : (
          <>
            <div className="world-pause-actions">
              <button className="primary" onClick={() => setPanel(null)}>
                <Play size={17} />
                {t('Tiếp tục khám phá', 'Continue exploring')}
              </button>
              <button
                onClick={() => {
                  engine.current?.returnToCamp();
                  setPanel(null);
                }}
              >
                <Tent size={17} />
                {t('Trở về Bình Minh', 'Return to Bình Minh')}
              </button>
            </div>
            <div className="world-performance">
              <Waves size={14} />
              <span>{t('Hiệu năng hiện tại', 'Current performance')}</span>
              <b>{status?.fps ?? '—'} FPS</b>
              <small>
                {status?.active ?? 0} {t('Pokémon hoạt động', 'active Pokémon')} ·{' '}
                {status?.chunks ?? 0}/48 {t('vùng đệm', 'cached regions')}
                {' · '}
                {status?.terrainChunks ?? 0}/64 {t('vùng địa hình', 'terrain chunks')}
              </small>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
