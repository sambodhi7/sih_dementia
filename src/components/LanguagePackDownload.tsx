import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type PackViewState = 'system' | 'unavailable' | 'not-installed' | 'incomplete' | 'ready' | 'downloading' | 'error';

export function LanguagePackDownload({ state, progress, size, copy }: {
  state: PackViewState;
  progress: number;
  size?: string;
  copy: {
    title: string;
    description: string;
    ready: string;
    system: string;
    unavailable: string;
    downloading: string;
    failed: string;
  };
}) {
  const status = state === 'ready'
    ? copy.ready
    : state === 'system'
      ? copy.system
      : state === 'unavailable'
        ? copy.unavailable
        : state === 'downloading'
          ? `${copy.downloading} · ${Math.round(progress * 100)}%`
          : state === 'error'
            ? copy.failed
            : size
              ? `${size} · ${copy.description}`
              : copy.description;

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.headingRow}>
        <Text style={styles.title}>{copy.title}</Text>
        {size && state !== 'system' && state !== 'unavailable' ? <Text style={styles.size}>{size}</Text> : null}
      </View>
      <Text style={styles.status}>{status}</Text>
      {state === 'downloading' ? (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.surface },
  headingRow: { flexDirection: 'row', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' },
  title: { flex: 1, color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800' },
  size: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800' },
  status: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 25 },
  track: { height: 12, overflow: 'hidden', borderRadius: 6, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border },
  fill: { height: '100%', borderRadius: 6, backgroundColor: theme.colors.leaf },
});
