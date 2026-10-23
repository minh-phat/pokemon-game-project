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
import { Home, LanguagePicker } from './home';
import { useLanguage } from '@/lib/i18n';
import { Account } from './account';
import { ArenasScreen, ModeSelection, OnlineAccess, RulesScreen, Toggle } from './setup';
import { RosterScreen } from './roster';
import { LobbyScreen } from './lobby';
import { BattleScreen } from './battle-screen';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

export function GameShell() {
  const state = useGame();
  const { language, t } = useLanguage();
  const isHome = state.screen === 'home' || state.screen === 'modes';
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
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
        notice: t(
          'Trình duyệt này không hỗ trợ toàn màn hình. Hãy thêm trò chơi vào màn hình chính.',
          'Fullscreen is unavailable in this browser. Try adding the game to your home screen.',
        ),
      });
    }
  }
  function navigate(screen: 'home' | 'codex' | 'arenas') {
    if (state.sessionId) leaveRoom();
    else battleFeed.clear();
    state.go(screen);
  }
  return (
    <div
      className={`app-shell fantasy-app ${isHome ? 'home-shell' : ''} ${state.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <a href="#main-content" className="skip-link">
        {t('Đến nội dung chính', 'Skip to content')}
      </a>
      {!isHome && (
        <header className="site-header">
          <button
            className="brand"
            aria-label={t('Trang chủ Triệu Hồi Sư', 'Summoner home')}
            onClick={() => navigate('home')}
          >
            <span className="brand-ball">
              <i />
            </span>
            <span>
              {t('Triệu Hồi Sư', 'Summoner')}
              <span className="brand-sub">ARENA</span>
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
              {t('Chơi', 'Play')}
            </button>
            <button
              className={state.screen === 'codex' ? 'active' : ''}
              onClick={() => navigate('codex')}
            >
              <BookOpen size={16} />
              {t('Thư viện', 'Library')}
            </button>
            <button
              className={state.screen === 'arenas' ? 'active' : ''}
              onClick={() => navigate('arenas')}
            >
              <Compass size={16} />
              {t('Đấu trường', 'Arenas')}
            </button>
          </nav>
          <div className="header-actions">
            <LanguagePicker />
            <Button
              variant="outline"
              size="sm"
              disabled={state.authLoading}
              onClick={() => state.set({ accountView: state.user ? 'profile' : 'login' })}
            >
              {state.user?.name ?? t('Đăng Nhập', 'Log In')}
            </Button>
            <span className="local-status">
              <i />
              {t('SẴN SÀNG', 'READY TO PLAY')}
            </span>
            {!isAppMode && (
              <Button
                variant="outline"
                size="icon"
                aria-label={
                  isFullscreen
                    ? t('Thoát toàn màn hình', 'Exit fullscreen')
                    : t('Toàn màn hình', 'Enter fullscreen')
                }
                title={
                  isFullscreen
                    ? t('Thoát toàn màn hình', 'Exit fullscreen')
                    : t('Toàn màn hình', 'Enter fullscreen')
                }
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                state.muted ? t('Bật âm thanh', 'Enable audio') : t('Tắt âm thanh', 'Mute audio')
              }
              onClick={() => state.set({ muted: !state.muted })}
            >
              {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('Cài đặt', 'Open settings')}
              onClick={() => state.set({ settingsOpen: true })}
            >
              <Settings2 size={18} />
            </Button>
          </div>
        </header>
      )}
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
              aria-label={t('Đóng thông báo', 'Dismiss notification')}
              onClick={() => state.set({ error: '', notice: '' })}
            >
              <X size={16} />
            </Button>
          </div>
        )}
        {isHome && <Home isAppMode={isAppMode} onEnterFullscreen={() => void toggleFullscreen()} />}
        {state.screen === 'modes' && <ModeSelection />}
        {state.screen === 'rules' && <RulesScreen />}
        {state.screen === 'roster' && <RosterScreen />}
        {state.screen === 'codex' && <RosterScreen inspectOnly />}
        {state.screen === 'online' && <OnlineAccess />}
        {state.screen === 'lobby' && <LobbyScreen />}
        {state.screen === 'battle' && <BattleScreen />}
        {state.screen === 'arenas' && <ArenasScreen />}
      </main>
      {!isHome && (
        <footer className="site-footer">
          <span>
            {t(
              'Một đội hình nhỏ. Một hành trình huyền thoại.',
              'A little team. A legendary adventure.',
            )}
          </span>
          <span>
            UNOFFICIAL FAN PROJECT <i /> LOCAL EDITION 01
          </span>
        </footer>
      )}
      <Account />
      <Dialog
        open={state.settingsOpen}
        onOpenChange={(settingsOpen) => state.set({ settingsOpen })}
        title={t('Cài đặt', 'Settings')}
        description={t('Tùy chỉnh trải nghiệm của bạn.', 'Make the arena feel right for you.')}
      >
        <div className="settings-form">
          <div className="settings-language">
            <span>{t('Ngôn ngữ', 'Language')}</span>
            <LanguagePicker />
          </div>
          <Toggle
            label={t('Âm thanh chiến đấu', 'Battle audio')}
            description={t(
              'Âm thanh môi trường và hiệu ứng kỹ năng.',
              'Ambient sounds and Pokémon skill effects.',
            )}
            checked={!state.muted}
            onChange={(value) => state.set({ muted: !value })}
          />
          <label className="volume-control">
            {t('Âm lượng', 'Volume')} <span>{Math.round(state.volume * 100)}%</span>
            <input
              type="range"
              aria-label={t('Âm lượng', 'Audio volume')}
              min={0}
              max={1}
              step={0.05}
              value={state.volume}
              onChange={(e) => state.set({ volume: +e.target.value })}
            />
          </label>
          <Toggle
            label={t('Giảm chuyển động', 'Reduce motion')}
            description={t(
              'Giảm hiệu ứng môi trường và chuyển động menu.',
              'Fewer ambient effects and menu animations.',
            )}
            checked={state.reducedMotion}
            onChange={(reducedMotion) => state.set({ reducedMotion })}
          />
          <Toggle
            label={t('Nhật ký trận đấu', 'Battle event feed')}
            description={t(
              'Hiện kỹ năng, né tránh và diễn biến trận đấu.',
              'Show recent skills, dodges, and battle events.',
            )}
            checked={state.showEvents}
            onChange={(showEvents) => state.set({ showEvents })}
          />
          <p className="hint">
            {t('Tùy chọn được lưu trên thiết bị này.', 'Preferences are saved on this device.')}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
