'use client';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Leaf,
  Maximize,
  Shield,
  Sparkles,
  Swords,
  Users,
  Zap,
} from 'lucide-react';
import { ARENAS, ROSTER } from '@arena/game-data';
import { useGame } from '@/lib/store';
import { Button } from './ui/button';
import { ElementBadge, Portrait } from './common';
export function Home({
  isAppMode,
  onEnterFullscreen,
}: {
  isAppMode: boolean;
  onEnterFullscreen: () => void;
}) {
  const { go, set } = useGame();
  return (
    <div className="home-content">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orb" />
          <img className="hero-bulbasaur" src="/assets/bulbasaur.svg" alt="" />
          <img className="hero-charmander" src="/assets/charmander.svg" alt="" />
          <img className="hero-pikachu" src="/assets/pikachu.svg" alt="" />
          <span className="spark spark-one">✧</span>
          <span className="spark spark-two">✧</span>
          <span className="hero-ground-label">
            <span /> ENCHANTED FOREST
          </span>
        </div>
        <div className="hero-copy">
          <span className="edition">
            <span /> THE AUTO-BATTLE ADVENTURE
          </span>
          <h1>
            A little team.
            <br />A <em>legendary</em>
            <br />
            battle.
          </h1>
          <p>
            Choose your Pokémon. Find your strategy.
            <br />
            Watch a world of possibilities come to life.
          </p>
          <div className="hero-buttons">
            <Button
              onClick={() => {
                onEnterFullscreen();
                go('modes');
              }}
            >
              Let’s battle <ArrowRight size={19} />
            </Button>
            {!isAppMode && (
              <Button variant="outline" onClick={onEnterFullscreen}>
                Fullscreen <Maximize size={16} />
              </Button>
            )}
            <Button variant="ghost" onClick={() => go('codex')}>
              Meet the Pokémon <ArrowUpRight size={16} />
            </Button>
          </div>
          <div className="hero-detail">
            <span>
              <Swords size={14} /> Fully automatic combat
            </span>
            <span>
              <Users size={14} /> Solo or with a friend
            </span>
          </div>
        </div>
        <div className="hero-tag">
          <span className="tag-icon">
            <Zap size={21} />
          </span>
          <div>
            <strong>A spark of something great.</strong>
            <small>Your next adventure starts here.</small>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PICK YOUR ADVENTURE</p>
          <h2>Good company. Great battles.</h2>
        </div>
        <span className="muted small">Your team. Their instincts.</span>
      </div>
      <div className="mode-home-grid">
        <button
          className="mode-home ai-home"
          onClick={() => {
            set({ mode: 'ai', team: [] });
            go('rules');
          }}
        >
          <span className="mode-icon">
            <Bot size={27} />
          </span>
          <div>
            <div className="mode-title">
              <h3>VS AI</h3>
              <span className="tiny-badge">PLAY SOLO</span>
            </div>
            <p>Practice your strategy against a worthy opponent.</p>
            <span className="mode-link">
              Find your rhythm <ArrowRight size={15} />
            </span>
          </div>
          <div className="mode-doodle">
            <Swords size={72} strokeWidth={1} />
          </div>
        </button>
        <button
          className="mode-home online-home"
          onClick={() => {
            set({ mode: 'online', team: [] });
            go('online');
          }}
        >
          <span className="mode-icon">
            <Users size={27} />
          </span>
          <div>
            <div className="mode-title">
              <h3>Online 1v1</h3>
              <span className="tiny-badge">PLAY TOGETHER</span>
            </div>
            <p>A friendly rivalry is only an invitation away.</p>
            <span className="mode-link">
              Challenge a friend <ArrowRight size={15} />
            </span>
          </div>
          <div className="mode-doodle">
            <Sparkles size={72} strokeWidth={1} />
          </div>
        </button>
      </div>
      <section className="meet-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SMALL BUT MIGHTY</p>
            <h2>Meet your next teammates.</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => go('codex')}>
            Explore the Pokédex <ArrowRight size={16} />
          </Button>
        </div>
        <div className="home-roster">
          {ROSTER.map((p) => (
            <button
              key={p.id}
              className={`home-pokemon ${p.element}`}
              onClick={() => {
                set({ inspected: p.id });
                go('codex');
              }}
            >
              <span className="dex-number">#{p.number}</span>
              <div className="portrait-halo">
                <Portrait id={p.id} />
              </div>
              <div className="home-pokemon-label">
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.role}</p>
                </div>
                <ElementBadge element={p.element} />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="arena-strip">
        <div>
          <span className="icon-circle">
            <Leaf size={19} />
          </span>
          <div>
            <p className="eyebrow">A WORLD WORTH EXPLORING</p>
            <h3>Four arenas. Endless possibilities.</h3>
            <p className="muted small">From emerald forests to shores of crystal blue.</p>
          </div>
        </div>
        <div className="arena-thumbnails">
          {ARENAS.map((a) => (
            <button
              key={a.id}
              aria-label={`Explore ${a.name}`}
              onClick={() => {
                set({ rules: { ...useGame.getState().rules, arena: a.id } });
                go('arenas');
              }}
            >
              <img src={a.thumbnail ?? `/assets/${a.id}.svg`} alt={a.name} />
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Explore arenas"
          onClick={() => go('arenas')}
        >
          <ChevronRight size={20} />
        </Button>
      </section>
      <div className="home-note">
        <Shield size={14} />
        <span>Play as a guest or sign in. Your next battle awaits.</span>
      </div>
    </div>
  );
}
