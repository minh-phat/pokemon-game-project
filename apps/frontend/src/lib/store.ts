'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_RULES,
  type BattleSnapshot,
  type LobbySnapshot,
  type MatchRules,
  type SpeciesId,
} from '@arena/shared-types';
type Screen =
  | 'home'
  | 'modes'
  | 'rules'
  | 'roster'
  | 'online'
  | 'lobby'
  | 'battle'
  | 'codex'
  | 'arenas';
interface GameStore {
  language: 'vi' | 'en';
  user: { id: string; email: string; name: string } | null;
  authLoading: boolean;
  accountView: 'login' | 'register' | 'profile' | null;
  screen: Screen;
  mode: 'ai' | 'online';
  rules: MatchRules;
  team: SpeciesId[];
  aiTeam: SpeciesId[];
  inspected: SpeciesId;
  name: string;
  roomCode: string;
  lobby: LobbySnapshot | null;
  sessionId: string;
  connection: 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'lost';
  snapshot: BattleSnapshot | null;
  selectedFighterId: string;
  error: string;
  notice: string;
  paused: boolean;
  settingsOpen: boolean;
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  showEvents: boolean;
  set: (patch: Partial<Omit<GameStore, 'set' | 'go' | 'togglePokemon'>>) => void;
  go: (screen: Screen) => void;
  togglePokemon: (id: SpeciesId) => void;
}
export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      language: 'vi',
      user: null,
      authLoading: true,
      accountView: null,
      screen: 'home',
      mode: 'ai',
      rules: { ...DEFAULT_RULES },
      team: [],
      aiTeam: [],
      inspected: 'pikachu',
      name: 'Trainer',
      roomCode: '',
      lobby: null,
      sessionId: '',
      connection: 'offline',
      snapshot: null,
      selectedFighterId: '',
      error: '',
      notice: '',
      paused: false,
      settingsOpen: false,
      volume: 0.35,
      muted: true,
      reducedMotion: false,
      showEvents: true,
      set: (patch) => set(patch),
      go: (screen) => set({ screen, error: '', notice: '' }),
      togglePokemon: (id) => {
        const { team, rules } = get();
        if (!rules.duplicates && team.includes(id)) set({ team: team.filter((v) => v !== id) });
        else if (team.length < rules.teamSize) set({ team: [...team, id] });
        else set({ notice: 'Your team is full. Remove a teammate to make room.' });
      },
    }),
    {
      name: 'arena-preferences',
      skipHydration: true,
      partialize: (s) => ({
        language: s.language,
        name: s.name,
        volume: s.volume,
        muted: s.muted,
        reducedMotion: s.reducedMotion,
        showEvents: s.showEvents,
      }),
    },
  ),
);
