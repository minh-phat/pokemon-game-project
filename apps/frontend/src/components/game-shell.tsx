'use client';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Maximize,
  Minimize,
  Settings2,
  Swords,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useGame } from '@/lib/store';
import { leaveRoom, restoreRoom } from '@/lib/network';
import { battleFeed } from '@/lib/battle-feed';
import { Home } from './home';
import { Account } from './account';
import {
  ArenaPicker,
  ArenasScreen,
  ModeSelection,
  OnlineAccess,
  RulesScreen,
  Toggle,
} from './setup';
import { RosterScreen } from './roster';
import { LobbyScreen } from './lobby';
import { BattleScreen } from './battle-screen';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

export function GameShell() {
  const state = useGame();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAppMode, setIsAppMode] = useState(false);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    setIsAppMode(
      matchMedia('(display-mode: fullscreen)').matches ||
        matchMedia('(display-mode: standalone)').matches,
    );
    void useGame.persist.rehydrate();
    const query = new URLSearchParams(location.search);
    const code = query.get('room');
    const savedRoom = sessionStorage.getItem('arena-reconnect')?.split(':')[0];
    // An invitation remains in the URL after joining. Reloading that invitation
    // must reclaim the existing seat rather than attempt to join a full room.
    if (savedRoom && (!code || code === savedRoom)) void restoreRoom();
    else if (code) useGame.getState().set({ mode: 'online', screen: 'online', roomCode: code });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches)
      useGame.getState().set({ reducedMotion: true });
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  async function toggleFullscreen() {
    if (isAppMode) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen is unavailable');
    } catch {
      useGame.getState().set({
        notice:
          'Fullscreen is unavailable in this browser. Try adding the game to your home screen.',
      });
    }
  }
  function navigate(screen: 'home' | 'codex' | 'arenas') {
    if (state.sessionId) leaveRoom();
    else battleFeed.clear();
    state.go(screen);
  }
  return (
    <div className={`app-shell ${state.reducedMotion ? 'reduce-motion' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <button className="brand" aria-label="Pokémon Arena home" onClick={() => navigate('home')}>
          <span className="brand-ball">
            <i />
          </span>
          <span>
            pokémon<span className="brand-sub">ARENA</span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={
              ['home', 'modes', 'rules', 'roster', 'online', 'lobby', 'battle'].includes(
                state.screen,
              )
                ? 'active'
                : ''
            }
            onClick={() => navigate('home')}
          >
            <Swords size={16} />
            Play
          </button>
          <button
            className={state.screen === 'codex' ? 'active' : ''}
            onClick={() => navigate('codex')}
          >
            <BookOpen size={16} />
            Pokédex
          </button>
          <button
            className={state.screen === 'arenas' ? 'active' : ''}
            onClick={() => navigate('arenas')}
          >
            <Compass size={16} />
            Arenas
          </button>
        </nav>
        <div className="header-actions">
          <Account />
          <span className="local-status">
            <i />
            READY TO PLAY
          </span>
          {!isAppMode && (
            <Button
              variant="outline"
              size="icon"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={state.muted ? 'Enable audio' : 'Mute audio'}
            onClick={() => state.set({ muted: !state.muted })}
          >
            {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open settings"
            onClick={() => state.set({ settingsOpen: true })}
          >
            <Settings2 size={18} />
          </Button>
        </div>
      </header>
      <main id="main-content">
        {(state.error || state.notice) && (
          <div
            className={`notification ${state.error ? 'error' : ''}`}
            role={state.error ? 'alert' : 'status'}
          >
            <span>{state.error || state.notice}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss notification"
              onClick={() => state.set({ error: '', notice: '' })}
            >
              <X size={16} />
            </Button>
          </div>
        )}
        {state.screen === 'home' && (
          <Home isAppMode={isAppMode} onEnterFullscreen={() => void toggleFullscreen()} />
        )}
        {state.screen === 'modes' && <ModeSelection />}
        {state.screen === 'rules' && <RulesScreen />}
        {state.screen === 'roster' && <RosterScreen />}
        {state.screen === 'codex' && <RosterScreen inspectOnly />}
        {state.screen === 'online' && <OnlineAccess />}
        {state.screen === 'lobby' && <LobbyScreen />}
        {state.screen === 'battle' && <BattleScreen />}
        {state.screen === 'arenas' && <ArenasScreen />}
      </main>
      <footer className="site-footer">
        <span>Made for the love of a good adventure.</span>
        <span>
          UNOFFICIAL FAN PROJECT <i /> LOCAL EDITION 01
        </span>
      </footer>
      <Dialog
        open={state.settingsOpen}
        onOpenChange={(settingsOpen) => state.set({ settingsOpen })}
        title="A little fine-tuning."
        description="Make the arena feel right for you."
      >
        <div className="settings-form">
          <Toggle
            label="Battle audio"
            description="Ambient sounds and Pokémon skill effects."
            checked={!state.muted}
            onChange={(value) => state.set({ muted: !value })}
          />
          <label className="volume-control">
            Volume <span>{Math.round(state.volume * 100)}%</span>
            <input
              type="range"
              aria-label="Audio volume"
              min={0}
              max={1}
              step={0.05}
              value={state.volume}
              onChange={(e) => state.set({ volume: +e.target.value })}
            />
          </label>
          <Toggle
            label="Reduce motion"
            description="Fewer ambient effects and menu animations."
            checked={state.reducedMotion}
            onChange={(reducedMotion) => state.set({ reducedMotion })}
          />
          <Toggle
            label="Battle event feed"
            description="Show recent skills, dodges, and battle events."
            checked={state.showEvents}
            onChange={(showEvents) => state.set({ showEvents })}
          />
          <p className="hint">
            Preferences are saved on this device. Battles remain automatic; no attack controls are
            needed.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
