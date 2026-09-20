import type { VoiceNavigationResponse } from '../services/voice-navigation/types';
import { matchVoiceIntent } from '../services/voice-navigation/matcher';
import type { SpeechPackManifest } from './types';

export type SpeechRecognitionOptions = {
  languageCode: string;
  modelDirectory: string;
};

export interface SpeechRecognitionAdapter {
  transcribe(audioUri: string, options: SpeechRecognitionOptions): Promise<string>;
}

let recognitionAdapter: SpeechRecognitionAdapter | null = null;

export function registerSpeechRecognitionAdapter(adapter: SpeechRecognitionAdapter) {
  recognitionAdapter = adapter;
}

export function clearSpeechRecognitionAdapter() {
  recognitionAdapter = null;
}

export function isSpeechRecognitionReady(): boolean {
  return recognitionAdapter !== null;
}

export async function resolveOfflineVoiceNavigation(audioUri: string, modelDirectory: string, manifest: SpeechPackManifest): Promise<VoiceNavigationResponse> {
  if (!recognitionAdapter) throw new Error('The speech recognition adapter is not connected.');
  const transcript = await recognitionAdapter.transcribe(audioUri, { languageCode: manifest.languageCode, modelDirectory });
  return matchVoiceIntent(transcript, manifest.commands);
}
