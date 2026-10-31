'use client';
import { useEffect, useRef, useState } from 'react';
import { POKEMON } from '@arena/game-data';
import { RotateCcw, Shield, Swords, Timer, Zap } from 'lucide-react';
import type { SpeciesId } from '@arena/shared-types';
import { useCopy, useLanguage } from '@/lib/i18n';
import { useGame } from '@/lib/store';
import { advanceSkillTraining, createSkillTraining, TRAINING_HP } from '@/lib/skill-training';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { ElementBadge } from './common';

export function SkillTraining({
  species,
  skillId,
  onClose,
}: {
  species: SpeciesId;
  skillId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const c = useCopy();
  const skill = POKEMON[species].skills.find((move) => move.id === skillId)!;
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [damage, setDamage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const dummyLabel = t('Hình nộm', 'Training dummy');
  function restart() {
    setReady(false);
    setDamage(0);
    setAttempt((value) => value + 1);
  }
  useEffect(() => {
    let disposed = false;
    let game: import('phaser').Game | undefined;
    let resizeObserver: ResizeObserver | undefined;
    setReady(false);
    setError(false);
    setDamage(0);
    void Promise.all([import('phaser'), import('@/game/arena-scene')])
      .then(([Phaser, { createArenaScene }]) => {
        if (disposed || !container.current) return;
        const engine = createSkillTraining(species, skillId);
        const trainingCenter = (engine.state.fighters[0].x + engine.state.fighters[1].x) / 2;
        let lastDamage = 0;
        const Scene = createArenaScene(
          'forest',
          () => {
            if (!disposed) setReady(true);
          },
          () => {
            if (!disposed) setError(true);
          },
          () => ({
            snapshot: {
              ...engine.state,
              // The practice target has unlimited health; keep its arena health bar full.
              fighters: engine.state.fighters.map((fighter) =>
                fighter.team === 1 ? { ...fighter, hp: POKEMON.squirtle.hp } : fighter,
              ),
            },
            paused: false,
            reducedMotion: useGame.getState().reducedMotion,
            trainingDummy: { id: '1-0', label: dummyLabel },
            viewport: {
              x: trainingCenter,
              y: 435,
              width: (container.current?.clientWidth ?? 900) < 600 ? 400 : 700,
              height: (container.current?.clientWidth ?? 900) < 600 ? 180 : 300,
            },
          }),
        );
        class TrainingScene extends Scene {
          update(time: number, delta: number) {
            // Stop after the cast and its lingering effects have had time to resolve.
            if (engine.state.elapsed < 20)
              advanceSkillTraining(engine, Math.min(delta / 1000, 0.05));
            const nextDamage = Math.round(TRAINING_HP - engine.state.fighters[1].hp);
            if (nextDamage !== lastDamage) {
              lastDamage = nextDamage;
              setDamage(nextDamage);
            }
            super.update(time, delta);
          }
        }
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: container.current,
          width: container.current.clientWidth,
          height: container.current.clientHeight,
          backgroundColor: '#203b36',
          scene: TrainingScene,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          audio: { noAudio: true },
          banner: false,
        });
        resizeObserver = new ResizeObserver(([entry]) => {
          if (!disposed && entry.contentRect.width && entry.contentRect.height)
            game?.scale.resize(entry.contentRect.width, entry.contentRect.height);
        });
        resizeObserver.observe(container.current);
        game.canvas.setAttribute('role', 'img');
        game.canvas.setAttribute(
          'aria-label',
          `${POKEMON[species].name} · ${skill.name} · ${dummyLabel}`,
        );
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      game?.destroy(true);
    };
  }, [species, skillId, dummyLabel, attempt, skill.name]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="skill-training-dialog"
      focusContentOnOpen
      title={`${t('Test chiêu', 'Test move')} · ${c(skill.name)}`}
      description={`${POKEMON[species].name} → ${dummyLabel}`}
    >
      <div className="skill-training-body">
        <div className="skill-training-stage">
          <div className="skill-training-stage-label">
            <span>
              <Swords size={14} /> {t('Sân tập', 'Practice arena')}
            </span>
            <span>{t('Mục tiêu không đánh trả', 'Non-attacking target')}</span>
          </div>
          <div
            className="skill-training-arena"
            ref={container}
            data-testid="skill-training-arena"
          />
          {error ? (
            <div className="skill-training-loading" role="alert">
              <p>{t('Không tải được sân tập.', 'Could not load the practice arena.')}</p>
              <Button onClick={restart}>
                <RotateCcw size={18} /> {t('Tải lại', 'Reload')}
              </Button>
            </div>
          ) : (
            !ready && (
              <div className="skill-training-loading" role="status">
                {t('Đang tải sân tập…', 'Loading practice arena…')}
              </div>
            )
          )}
        </div>
        <div className="skill-training-info">
          <div className="skill-name-and-element">
            <strong>{c(skill.name)}</strong>
            <ElementBadge element={skill.element} />
          </div>
          <div className="skill-training-stats">
            <div>
              <Swords size={16} />
              <strong>{skill.damagePercent}%</strong>
              <span>{t('Tấn công', 'Attack')}</span>
            </div>
            <div>
              <Zap size={16} />
              <strong>{skill.energy}</strong>
              <span>{t('Năng lượng', 'Energy')}</span>
            </div>
            <div>
              <Timer size={16} />
              <strong>{skill.cooldown}s</strong>
              <span>{t('Hồi chiêu', 'Cooldown')}</span>
            </div>
          </div>
          <p className="skill-training-description">{skill.description}</p>
          {skill.behavior === 'buff' && (
            <p className="skill-training-note">
              <Shield size={16} />
              {t(
                'Chiêu hỗ trợ/phản đòn có thể không gây sát thương khi hình nộm không tấn công.',
                'Support/counter moves may deal no damage while the dummy does not attack.',
              )}
            </p>
          )}
          <details className="skill-training-details">
            <summary>
              {t('Điều kiện thử chiêu', 'Practice conditions')}
              <span>{t('Cấp 1 · Phẩm chất C', 'Level 1 · Quality C')}</span>
            </summary>
            <p>
              {t(
                'Hình nộm dùng phòng thủ cơ bản của Squirtle, không đánh trả và không áp dụng khắc hệ. Mỗi lần thử sẽ hồi phục và xóa hồi chiêu.',
                'The dummy uses Squirtle’s base defense, does not fight back, and has no elemental matchup. Each attempt restores health and resets cooldowns.',
              )}
            </p>
          </details>
        </div>
      </div>
      <div className="skill-training-actions">
        <div className="skill-training-damage" role="status" aria-live="polite" aria-atomic="true">
          <span>{t('Sát thương gây ra', 'Damage dealt')}</span>
          <strong>{damage}</strong>
        </div>
        <Button disabled={!ready || error} onClick={restart}>
          <RotateCcw size={18} /> {t('Dùng chiêu lại', 'Use move again')}
        </Button>
      </div>
    </Dialog>
  );
}
