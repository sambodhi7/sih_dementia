import type { ControllerState, GameId } from './types';

export type DifficultyLevel = 'gentle' | 'steady' | 'stretch';

export function difficultyLevel(value: number): DifficultyLevel {
  if (value < 0.34) return 'gentle';
  if (value < 0.67) return 'steady';
  return 'stretch';
}

export function difficultyLabel(value: number): string {
  const level = difficultyLevel(value);
  return level === 'gentle' ? 'Gentle support' : level === 'steady' ? 'Steady practice' : 'Stretching practice';
}

export function gameDifficulty(state: ControllerState | null, gameId: GameId): DifficultyLevel {
  return state?.gameId === gameId ? difficultyLevel(state.difficulty) : 'steady';
}

export function daysPlanOptionCount(state: ControllerState | null, availableItems: number): number {
  const requested = gameDifficulty(state, 'days_plan') === 'gentle' ? 2 : gameDifficulty(state, 'days_plan') === 'steady' ? 3 : 4;
  return Math.min(Math.max(1, availableItems), requested);
}

export function recipeIngredientCount(state: ControllerState | null): number {
  return gameDifficulty(state, 'recipe') === 'gentle' ? 4 : gameDifficulty(state, 'recipe') === 'steady' ? 5 : 6;
}
