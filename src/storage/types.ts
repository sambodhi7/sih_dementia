import type { ControllerState, GameEvent, SessionOutcome } from '../services/adaptive/types';

export type ReviewResult = 'independent' | 'supported' | 'incorrect' | 'distress';

export type WhosWhoItem = {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  personalNote: string;
  photoUri: string | null;
  nameAudioUri: string | null;
  noteAudioUri: string | null;
  learningOnly: boolean;
  archivedAt: number | null;
  learnedAt: number | null;
  reviewStep: number;
  dueAt: number;
  consecutiveSupport: number;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
};

export type WhosWhoDraft = Omit<WhosWhoItem, 'id' | 'patientId' | 'archivedAt' | 'learnedAt' | 'reviewStep' | 'dueAt' | 'consecutiveSupport' | 'paused' | 'createdAt' | 'updatedAt'>;

export type DaysPlanItem = {
  id: string;
  patientId: string;
  time: string;
  title: string;
  detail: string;
  imageUri: string | null;
  audioUri: string | null;
  archivedAt: number | null;
  updatedAt: number;
};

export type StoredSession = {
  id: string;
  patientId: string;
  gameId: 'whos_who';
  itemId: string;
  startedAt: number;
  endedAt: number | null;
  abandoned: boolean;
  companionPresent: boolean;
};

export type StoredDaysPlanSession = {
  id: string;
  patientId: string;
  gameId: 'days_plan';
  phase: 'morning' | 'evening';
  startedAt: number;
  endedAt: number | null;
  abandoned: boolean;
  companionPresent: boolean;
};

export type LocalSnapshot = {
  items: WhosWhoItem[];
  daysPlanItems: DaysPlanItem[];
  sessions: Array<StoredSession | StoredDaysPlanSession>;
  events: Array<{ id: string; sessionId: string; seq: number; event: GameEvent }>;
  outcomes: Array<{ sessionId: string; outcome: SessionOutcome }>;
  controllerStates: ControllerState[];
  controllerStateChanges: Array<{ id: string; state: ControllerState; sessionId: string; source: 'calibration' | 'tracking' | 'frozen'; at: number }>;
  settings: Record<string, string>;
};
