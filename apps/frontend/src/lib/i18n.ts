'use client';
import { useGame } from './store';
import { translateCopy } from './ui-copy';

/** Vietnamese is the default; only the preference, never the session, is persisted. */
export function useLanguage() {
  const language = useGame((state) => state.language);
  return { language, t: (vi: string, en: string) => (language === 'vi' ? vi : en) };
}

export function useCopy() {
  const { language } = useLanguage();
  return (english: string) => translateCopy(english, language);
}
