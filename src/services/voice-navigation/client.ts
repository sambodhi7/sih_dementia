import type { VoiceNavigationRequest, VoiceNavigationResponse } from './types';

const endpoint = process.env.EXPO_PUBLIC_VOICE_NAVIGATION_API_URL;

export const isVoiceNavigationConfigured = Boolean(endpoint);

export async function resolveVoiceNavigation(request: VoiceNavigationRequest, accessToken?: string): Promise<VoiceNavigationResponse> {
  if (!endpoint) throw new Error('Voice navigation is not configured.');
  const body = new FormData();
  body.append('client_thread_id', request.clientThreadId);
  body.append('client_msg_id', request.clientMessageId);
  body.append('patient_id', request.patientId);
  body.append('language_code', request.languageCode);
  body.append('audio', { uri: request.audioUri, name: `${request.clientMessageId}.m4a`, type: 'audio/m4a' } as never);
  const response = await fetch(endpoint, { method: 'POST', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, body });
  if (!response.ok) throw new Error(`Voice navigation request failed (${response.status}).`);
  const result = await response.json() as VoiceNavigationResponse;
  if (!['start_whos_who', 'start_recipe', 'start_days_plan', 'start_skills', 'repeat', 'go_home', 'caregiver_area', 'stop', 'unknown'].includes(result.intent)) throw new Error('Voice navigation returned an unsupported intent.');
  return result;
}
