import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import type { LocalSnapshot } from './types';
import { migrate } from './migrations';

const DATABASE_NAME = 'saathi-local.db';
const WEB_KEY = 'saathi.local.v1';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let webSnapshot: LocalSnapshot | null = null;
let writeTail: Promise<void> = Promise.resolve();

export const reviewIntervals = [30_000, 60_000, 120_000, 240_000, 480_000, 86_400_000, 259_200_000, 604_800_000, 1_209_600_000];

export const emptySnapshot = (): LocalSnapshot => ({ items: [], daysPlanItems: [], sessions: [], events: [], outcomes: [], controllerStates: [], controllerStateChanges: [], settings: {}, skillTransmissionItems: [], activitySessions: [], activityEvents: [], skillCompletions: [] });
export const makeId = () => Crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const asBool = (value: unknown) => Boolean(value);

export async function getDb() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return databasePromise;
}

export async function loadWeb() {
  if (!webSnapshot) {
    try {
      const storage = await import('@react-native-async-storage/async-storage');
      webSnapshot = { ...emptySnapshot(), ...JSON.parse((await storage.default.getItem(WEB_KEY)) ?? '') } as LocalSnapshot;
      webSnapshot.controllerStates ??= [];
      webSnapshot.controllerStateChanges ??= [];
      webSnapshot.daysPlanItems ??= [];
      webSnapshot.skillTransmissionItems ??= [];
      webSnapshot.activitySessions ??= [];
      webSnapshot.activityEvents ??= [];
      webSnapshot.skillCompletions ??= [];
    } catch { webSnapshot = emptySnapshot(); }
  }
  return webSnapshot;
}

export async function saveWeb() {
  const storage = await import('@react-native-async-storage/async-storage');
  await storage.default.setItem(WEB_KEY, JSON.stringify(webSnapshot ?? emptySnapshot()));
}

export function queuedWrite(work: () => Promise<void>) {
  const operation = writeTail.then(work);
  // Keep the queue usable after failure, but let callers stop gameplay when
  // persistence fails instead of reporting an unsaved action as successful.
  writeTail = operation.catch(() => undefined);
  return operation;
}

export { Platform };
