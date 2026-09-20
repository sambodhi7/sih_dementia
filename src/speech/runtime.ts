import * as Speech from 'expo-speech';

export type SpeakOptions = {
  languageCode: string;
  rate?: number;
};

export interface SpeechSynthesisAdapter {
  speak(text: string, options: SpeakOptions): Promise<void>;
  stop(): Promise<void>;
}

export const systemSpeechAdapter: SpeechSynthesisAdapter = {
  async speak(text, options) {
    await Speech.stop();
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: options.languageCode,
        rate: options.rate ?? 0.84,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      });
    });
  },
  stop: () => Speech.stop(),
};

let speechAdapter: SpeechSynthesisAdapter = systemSpeechAdapter;

export function registerSpeechSynthesisAdapter(adapter: SpeechSynthesisAdapter) {
  speechAdapter = adapter;
}

export function useSystemSpeechAdapter() {
  speechAdapter = systemSpeechAdapter;
}

export function speakText(text: string, options: SpeakOptions) {
  return speechAdapter.speak(text, options);
}

export function stopSpeaking() {
  return speechAdapter.stop();
}
