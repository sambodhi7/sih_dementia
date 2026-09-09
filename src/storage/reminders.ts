import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getLocalSetting, setLocalSetting } from './localStore';

const reminderKey = 'whos-who-reminder-id';

export async function scheduleWhosWhoReminder(dueAt: number) {
  if (Platform.OS === 'web') return;
  // Expo Go no longer ships the Android notification module used by SDK 53+.
  // Do not load it there; real installable builds retain local reminders.
  if (Constants.executionEnvironment === 'storeClient') return;
  try {
    const Notifications = await import('expo-notifications');
    const previous = await getLocalSetting(reminderKey);
    if (previous) await Notifications.cancelScheduledNotificationAsync(previous);
    const permissions = await Notifications.getPermissionsAsync();
    const status = permissions.granted ? permissions : await Notifications.requestPermissionsAsync();
    if (!status.granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('whos-who', { name: 'Who’s Who reminders', importance: Notifications.AndroidImportance.DEFAULT });
    const identifier = await Notifications.scheduleNotificationAsync({
      content: { title: 'A familiar face is waiting', body: 'A gentle Who’s Who moment is ready.', data: { activity: 'whos_who' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Math.max(dueAt, Date.now() + 5_000)), ...(Platform.OS === 'android' ? { channelId: 'whos-who' } : {}) },
    });
    await setLocalSetting(reminderKey, identifier);
  } catch {
    // Reminders are optional. Local learning data remains usable without them.
  }
}
