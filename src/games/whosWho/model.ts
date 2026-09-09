import type { ControllerState, GameEvent } from '../../adaptive/types';
import type { WhosWhoItem } from '../../storage/types';

export const ROUND_PROMPTS = 6;
export function optionCount(difficulty: number) { return difficulty < 0.34 ? 2 : difficulty < 0.67 ? 3 : 4; }
export function recallEligible(item: WhosWhoItem, patientId: string) {
  return item.patientId === patientId && !item.archivedAt && !item.paused && !item.learningOnly && !!item.learnedAt && !!item.photoUri && !!item.nameAudioUri;
}
export function shuffled<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function answerChoices(target: WhosWhoItem, items: WhosWhoItem[], state: ControllerState, random = Math.random) {
  return shuffled([target, ...shuffled(items.filter((item) => item.id !== target.id && recallEligible(item, target.patientId)), random).slice(0, optionCount(state.difficulty) - 1)], random);
}

// Holds only current interaction state. Events go straight to persistence.
export class RecallInput {
  hint: 0 | 1 | 2 | 3 | 4 = 0;
  attempts = 0;
  replayed = false;
  solved = false;
  constructor(readonly itemId: string, private emit: (event: GameEvent) => Promise<void>, private now = Date.now) {}
  async show() { await this.emit({ type: 'prompt_shown', itemId: this.itemId, at: this.now() }); }
  async replay() { await this.emit({ type: 'audio_replayed', itemId: this.itemId, at: this.now() }); this.replayed = true; }
  async help() {
    if (this.solved || this.hint === 4) return;
    const level = (this.hint + 1) as 1 | 2 | 3 | 4;
    await this.emit({ type: 'hint_shown', itemId: this.itemId, level, at: this.now() }); this.hint = level;
  }
  async tap(chosenId: string, x: number, y: number) {
    if (this.solved) return null;
    const correct = chosenId === this.itemId;
    const independent = correct && this.attempts === 0 && this.hint === 0 && !this.replayed;
    await this.emit({ type: 'tap', itemId: this.itemId, correct, at: this.now(), x, y, hintLevelAtTap: this.hint, solvedUnassisted: independent });
    this.attempts++; this.solved = correct;
    return { correct, independent };
  }
}
