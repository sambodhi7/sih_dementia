import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

/** Short, calm tactile confirmation for a deliberate tap. */
export function touchFeedback(strength: 'light' | 'support' = 'light'): void {
  if (Platform.OS === 'web') return;
  // Expo's impact API uses the device haptic actuator and works more
  // consistently than the generic Android vibration API in Expo Go.
  void Haptics.impactAsync(strength === 'support' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    .catch(() => Vibration.vibrate(strength === 'support' ? 18 : 10));
}
