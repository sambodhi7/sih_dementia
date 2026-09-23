import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { speakText, stopSpeaking } from './runtime';

type SpeechGuideValue = {
  enabled: boolean;
  languageCode: string;
  setEnabled: (enabled: boolean) => void;
  setLanguageCode: (languageCode: string) => void;
  speak: (text: string) => Promise<void>;
  speakAction: (text: string) => void;
};

const SpeechGuideContext = createContext<SpeechGuideValue>({
  enabled: false,
  languageCode: 'en',
  setEnabled: () => undefined,
  setLanguageCode: () => undefined,
  speak: async () => undefined,
  speakAction: () => undefined,
});

export function SpeechGuideProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [languageCode, setLanguageCode] = useState('en');
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    await stopSpeaking();
    await speakText(text, { languageCode, rate: 0.84 });
  }, [languageCode]);
  const speakAction = useCallback((text: string) => {
    if (enabled) void speak(text);
  }, [enabled, speak]);
  const value = useMemo(() => ({ enabled, languageCode, setEnabled, setLanguageCode, speak, speakAction }), [enabled, languageCode, speak, speakAction]);
  return <SpeechGuideContext.Provider value={value}>{children}</SpeechGuideContext.Provider>;
}

export function useSpeechGuide() {
  return useContext(SpeechGuideContext);
}

export function useAutoReadText(text: string, key: string) {
  const { enabled, speak } = useSpeechGuide();
  useEffect(() => {
    if (!enabled || !text.trim()) return;
    void speak(text);
  }, [enabled, key, speak, text]);
}
