export type VoiceIntent = 'start_whos_who' | 'repeat' | 'go_home' | 'caregiver_area' | 'stop' | 'unknown';

export type VoiceNavigationRequest = {
  clientThreadId: string;
  clientMessageId: string;
  patientId: string;
  languageCode: string;
  audioUri: string;
};

export type VoiceNavigationResponse = {
  intent: VoiceIntent;
  confidence: number;
  transcript?: string;
};
