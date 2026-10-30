'use client';
import { useEffect, useRef, useState } from 'react';
import { POKEMON } from '@arena/game-data';
import type { SpeciesId } from '@arena/shared-types';
import { useCopy, useLanguage } from '@/lib/i18n';
import { useGame } from '@/lib/store';
import { advanceSkillTraining, createSkillTraining, TRAINING_HP } from '@/lib/skill-training';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

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
    setReady(false);
    setError(false);
    setDamage(0);
    void Promise.all([import('phaser'), import('@/game/arena-scene')])
      .then(([Phaser, { createArenaScene }]) => {
        if (disposed || !container.current) return;
        const engine = createSkillTraining(species, skillId);
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
            viewport: { x: 540, y: 435, width: 700, height: 300 },
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
          width: 900,
          height: 460,
          backgroundColor: '#203b36',
          scene: TrainingScene,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          audio: { noAudio: true },
          banner: false,
        });
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
      title={`${t('Test chiêu', 'Test move')} · ${c(skill.name)}`}
      description={`${POKEMON[species].name} → ${dummyLabel}`}
    >
      <p>{skill.description}</p>
      {skill.behavior === 'buff' && (
        <p className="muted">
          {t(
            'Chiêu hỗ trợ/phản đòn có thể không gây sát thương khi hình nộm không tấn công.',
            'Support/counter moves may deal no damage while the dummy does not attack.',
          )}
        </p>
      )}
      <div className="skill-training-arena" ref={container} data-testid="skill-training-arena" />
      {error ? (
        <p role="alert">
          {t('Không tải được sân tập.', 'Could not load the practice arena.')}{' '}
          <Button onClick={restart}>{t('Tải lại', 'Reload')}</Button>
        </p>
      ) : (
        !ready && <p role="status">{t('Đang tải sân tập…', 'Loading practice arena…')}</p>
      )}
      <div className="skill-training-actions">
        <span role="status">
          {t('Sát thương gây ra', 'Damage dealt')}: <strong>{damage}</strong>
        </span>
        <Button disabled={!ready || error} onClick={restart}>
          {t('Dùng chiêu lại', 'Use move again')}
        </Button>
      </div>
      <p className="muted">
        {t(
          'Cấp 1 · phẩm chất C. Hình nộm dùng phòng thủ cơ bản của Squirtle, không đánh trả và không áp dụng khắc hệ. Mỗi lần thử sẽ hồi phục và xóa hồi chiêu.',
          'Level 1 · quality C. The dummy uses Squirtle’s base defense, does not fight back, and has no elemental matchup. Each attempt restores health and resets cooldowns.',
        )}
      </p>
    </Dialog>
  );
}
