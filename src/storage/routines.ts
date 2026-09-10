import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getLocalSetting, setLocalSetting } from './items';

const routineKey = 'member-routine-v1';

export type RoutineItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  kind: 'medication' | 'activity';
  notificationId?: string;
};

const defaultRoutine: RoutineItem[] = [
  { id: 'morning-welcome', title: 'A quiet morning', detail: 'Wash, dress, and enjoy a glass of water.', time: '08:00', kind: 'activity' },
  { id: 'lunch-medicine', title: 'Medicine time', detail: 'Take the medicine prepared by your caregiver.', time: '13:00', kind: 'medication' },
  { id: 'evening-memory', title: 'A familiar moment', detail: 'Spend a few minutes with Who’s Who.', time: '17:30', kind: 'activity' },
];

let foregroundHandlerConfigured = false;

async function configureForegroundReminderDisplay(Notifications: typeof import('expo-notifications')) {
  if (foregroundHandlerConfigured) return;
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  foregroundHandlerConfigured = true;
}

export async function readRoutine(): Promise<RoutineItem[]> {
  const saved = await getLocalSetting(routineKey);
  if (!saved) return defaultRoutine;
  try {
    const routine = JSON.parse(saved) as RoutineItem[];
    return Array.isArray(routine) ? routine : defaultRoutine;
  } catch {
    return defaultRoutine;
  }
}

async function scheduleMedication(item: RoutineItem) {
  if (item.kind !== 'medication' || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return item;
  try {
    const Notifications = await import('expo-notifications');
    await configureForegroundReminderDisplay(Notifications);
    if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId);
    const permissions = await Notifications.getPermissionsAsync();
    const status = permissions.granted ? permissions : await Notifications.requestPermissionsAsync();
    if (!status.granted) return { ...item, notificationId: undefined };
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('medication-reminders', { name: 'Medication reminders', importance: Notifications.AndroidImportance.HIGH });
    const [hour, minute] = item.time.split(':').map(Number);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Medication reminder', body: item.detail || `It is time for ${item.title}.`, sound: true, data: { routineId: item.id, kind: 'medication' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...(Platform.OS === 'android' ? { channelId: 'medication-reminders' } : {}) },
    });
    return { ...item, notificationId };
  } catch {
    return { ...item, notificationId: undefined };
  }
}

export async function saveRoutine(routine: RoutineItem[]) {
  const scheduled = await Promise.all(routine.map(scheduleMedication));
  await setLocalSetting(routineKey, JSON.stringify(scheduled));
  return scheduled;
}

export async function removeRoutineItem(routine: RoutineItem[], id: string) {
  const existing = routine.find((item) => item.id === id);
  if (existing?.notificationId && Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient') {
    try { const Notifications = await import('expo-notifications'); await Notifications.cancelScheduledNotificationAsync(existing.notificationId); } catch { /* Local plan remains available. */ }
  }
  return saveRoutine(routine.filter((item) => item.id !== id));
}
