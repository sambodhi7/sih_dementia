import { matchVoiceIntent, normalizeVoiceText } from './matcher';
import { voiceCommandsFor } from '../../speech/voiceCommands';

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
expectEqual(matchVoiceIntent('go back', voiceCommandsFor('en')).intent, 'go_home', 'matches English back command');
expectEqual(matchVoiceIntent('वापस जाएं', voiceCommandsFor('hi')).intent, 'go_home', 'matches Hindi back command');
expectEqual(matchVoiceIntent('ফিরে যান', voiceCommandsFor('bn')).intent, 'go_home', 'matches Bengali back command');

console.log('voice navigation matcher tests passed');
