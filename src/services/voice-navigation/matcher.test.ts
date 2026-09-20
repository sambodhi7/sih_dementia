import { matchVoiceIntent, normalizeVoiceText } from './matcher';

const commands = [
  { intent: 'start_whos_who', phrases: ["open who's who"] },
  { intent: 'start_recipe', phrases: ['open recipe'] },
  { intent: 'go_home', phrases: ['go home'] },
];

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

expectEqual(normalizeVoiceText('  Open, RECIPE! '), 'open recipe', 'normalizes transcript');
expectEqual(matchVoiceIntent('open recipe', commands).intent, 'start_recipe', 'matches exact command');
expectEqual(matchVoiceIntent('open receipe', commands).intent, 'start_recipe', 'matches close transcription');
expectEqual(matchVoiceIntent('call my daughter', commands).intent, 'unknown', 'rejects unrelated speech');

console.log('voice navigation matcher tests passed');
