import type { ControllerState, GameEvent, SessionOutcome } from '../services/adaptive/types';

export type ReviewResult = 'independent' | 'supported' | 'incorrect' | 'distress';

export type SkillCatalogKey = 'tie_shoes' | 'tie_knot' | 'tie_necktie' | 'fold_gamosa' | 'plant_seed' | 'button_shirt' | 'braid_hair' | 'brush_teeth';
export type DashboardActivityId = 'skill-transmission';

export type SkillTransmissionItem = {
  id: string;
  patientId: string;
  catalogKey: SkillCatalogKey;
  promptAudioUri: string | null;
  enabled: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ActivitySession = {
  id: string;
  patientId: string;
  activityId: DashboardActivityId;
  itemId: string;
  startedAt: number;
  endedAt: number | null;
  interrupted: boolean;
  companionPresent: true;
};

export type EngagementEvent =
  | { type: 'activity_opened'; itemId: string; at: number }
  | { type: 'prompt_played'; itemId: string; replayed: boolean; at: number }
  | { type: 'activity_started'; itemId: string; at: number }
  | { type: 'activity_completed'; itemId: string; durationMs: number; at: number }
  | { type: 'completion_photo_captured'; itemId: string; at: number }
  | { type: 'interrupted'; itemId: string; at: number };

export type SkillCompletion = {
  id: string;
  sessionId: string;
  itemId: string;
  completedAt: number;
  durationMs: number;
  photoUri: string | null;
};

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
  gameId: 'whos_who' | 'recipe';
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
  skillTransmissionItems: SkillTransmissionItem[];
  activitySessions: ActivitySession[];
  activityEvents: Array<{ id: string; sessionId: string; seq: number; event: EngagementEvent }>;
  skillCompletions: SkillCompletion[];
};
