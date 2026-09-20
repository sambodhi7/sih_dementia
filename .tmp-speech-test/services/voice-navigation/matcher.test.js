"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const matcher_1 = require("./matcher");
const commands = [
    { intent: 'start_whos_who', phrases: ["open who's who"] },
    { intent: 'start_recipe', phrases: ['open recipe'] },
    { intent: 'go_home', phrases: ['go home'] },
];
function expectEqual(actual, expected, label) {
    if (actual !== expected)
        throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}
expectEqual((0, matcher_1.normalizeVoiceText)('  Open, RECIPE! '), 'open recipe', 'normalizes transcript');
expectEqual((0, matcher_1.matchVoiceIntent)('open recipe', commands).intent, 'start_recipe', 'matches exact command');
expectEqual((0, matcher_1.matchVoiceIntent)('open receipe', commands).intent, 'start_recipe', 'matches close transcription');
expectEqual((0, matcher_1.matchVoiceIntent)('call my daughter', commands).intent, 'unknown', 'rejects unrelated speech');
console.log('voice navigation matcher tests passed');
