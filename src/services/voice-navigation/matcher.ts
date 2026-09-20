import type { SpeechCommand } from '../../speech/types';
import type { VoiceIntent, VoiceNavigationResponse } from './types';

const supportedIntents = new Set<VoiceIntent>([
  'start_whos_who',
  'start_recipe',
  'start_days_plan',
  'start_skills',
  'repeat',
  'go_home',
  'caregiver_area',
  'stop',
  'unknown',
]);

export function normalizeVoiceText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function similarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - editDistance(left, right) / longest;
}

export function matchVoiceIntent(transcript: string, commands: SpeechCommand[], minimumConfidence = 0.78): VoiceNavigationResponse {
  const normalizedTranscript = normalizeVoiceText(transcript);
  if (!normalizedTranscript) return { intent: 'unknown', confidence: 0, transcript };

  let best: { intent: VoiceIntent; confidence: number } = { intent: 'unknown', confidence: 0 };
  for (const command of commands) {
    if (!supportedIntents.has(command.intent as VoiceIntent)) continue;
    for (const phrase of command.phrases) {
      const normalizedPhrase = normalizeVoiceText(phrase);
      const confidence = normalizedPhrase === normalizedTranscript ? 1 : similarity(normalizedTranscript, normalizedPhrase);
      if (confidence > best.confidence) best = { intent: command.intent as VoiceIntent, confidence };
    }
  }

  return best.confidence >= minimumConfidence
    ? { ...best, transcript }
    : { intent: 'unknown', confidence: best.confidence, transcript };
}
