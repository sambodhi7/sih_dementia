import type { CompletedPractice } from '../storage/caregiverProgress';

export type TrackedGame = CompletedPractice['gameId'];
export const trackedGames: TrackedGame[] = ['days_plan', 'whos_who'];
export const gameNames: Record<TrackedGame, string> = { days_plan: "Day's Plan", whos_who: "Who's Who" };

export function samplePractice(now: number): CompletedPractice[] {
  const examples: Array<[number, TrackedGame, number]> = [
    [6, 'whos_who', 40], [5, 'days_plan', 50], [4, 'whos_who', 55],
    [3, 'days_plan', 60], [2, 'whos_who', 70], [2, 'days_plan', 65],
    [1, 'whos_who', 75], [0, 'days_plan', 80],
  ];
  return examples.map(([daysAgo, gameId, independentPercent], index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - daysAgo);
    return { gameId, endedAt: day.getTime() + index * 60_000, independentPercent };
  });
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function activityDays(practice: CompletedPractice[], now: number, locale: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: localDayKey(date.getTime()),
      label: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
      count: practice.filter((entry) => localDayKey(entry.endedAt) === localDayKey(date.getTime())).length,
    };
  });
}

export function scoredRounds(practice: CompletedPractice[], gameId: TrackedGame) {
  return practice.filter((entry) => entry.gameId === gameId && entry.independentPercent !== null).slice(-6);
}
