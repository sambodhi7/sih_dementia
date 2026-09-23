import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { touchFeedback } from '../lib/haptics';
import { speakText, stopSpeaking } from '../speech/runtime';
import { theme } from '../theme';

export function ListenButton({ text, languageCode = 'en', label = 'Listen', stopLabel = 'Stop' }: { text: string; languageCode?: string; label?: string; stopLabel?: string }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => { void stopSpeaking(); }, []);

  const toggle = async () => {
    touchFeedback();
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speakText(text, { languageCode });
    setSpeaking(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? stopLabel : label}
      accessibilityState={{ busy: speaking }}
      onPress={() => { void toggle(); }}
      style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}
    >
      <Text accessible={false} style={styles.speakerIcon}>{speaking ? '■' : '🔊'}</Text>
      <Text style={styles.listenLabel}>{speaking ? stopLabel : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listenButton: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.leaf,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.white,
  },
  speakerIcon: { color: theme.colors.leaf, fontSize: 22, fontWeight: '800' },
  listenLabel: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
