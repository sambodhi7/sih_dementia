import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ControllerState, GameId, PatientProfileMetrics } from '../services/adaptive/types';
import { difficultyLabel, difficultyLevel } from '../services/adaptive/difficulty';
import { readControllerState } from '../storage/controllerState';
import { readPatientProfileMetrics } from '../storage/patientMetrics';
import { theme } from '../theme';
import { ActionButton, Notice } from './ui';

type GameSnapshot = { gameId: GameId; metrics: PatientProfileMetrics; controller: ControllerState | null };
const games: Array<{ id: GameId; title: string; description: string }> = [
  { id: 'days_plan', title: "Day's Plan", description: 'Daily routine orientation and evening recall.' },
  { id: 'whos_who', title: "Who's Who", description: 'Familiar faces, names, and relationships.' },
];
const percent = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`;
const seconds = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} sec`;

function trendCopy(direction: PatientProfileMetrics['trend']['direction']) {
  if (direction === 'improving') return 'Correct responses increased from the first to the latest scored round.';
  if (direction === 'changing') return 'Correct responses decreased from the first to the latest scored round.';
  if (direction === 'stable') return 'Correct responses are similar in the first and latest scored rounds.';
  return 'More completed sessions are needed to show a personal pattern.';
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function GameCard({ snapshot }: { snapshot: GameSnapshot }) {
  const game = games.find((entry) => entry.id === snapshot.gameId)!;
  const level = snapshot.controller ? difficultyLabel(snapshot.controller.difficulty) : 'Starting level';
  return <View style={styles.card}>
    <Text style={styles.cardEyebrow}>{game.title.toUpperCase()}</Text>
    <Text style={styles.cardTitle}>{game.description}</Text>
    <View style={styles.metricGrid}>
      <Metric label="Independent" value={percent(snapshot.metrics.independentPerformancePercent)} />
      <Metric label="Support needed" value={percent(snapshot.metrics.supportNeededPercent)} />
      <Metric label="Typical time" value={seconds(snapshot.metrics.medianResponseLatencySeconds)} />
      <Metric label="Sessions" value={String(snapshot.metrics.activity.completedSessions)} />
    </View>
    <View style={styles.level}><Text style={styles.levelLabel}>Current level</Text><Text style={styles.levelValue}>{level}</Text><Text style={styles.levelDetail}>{snapshot.controller ? `${difficultyLevel(snapshot.controller.difficulty)} · hints after about ${Math.round(snapshot.controller.hintTimeSeconds)} seconds` : 'The first completed session will set the starting level.'}</Text></View>
    <Text style={styles.detail}>{trendCopy(snapshot.metrics.trend.direction)}</Text>
  </View>;
}

export function CaregiverMetrics({ patientId, locale }: { patientId: string; locale: string }) {
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const next = await Promise.all(games.map(async (game) => {
        const [metrics, controller] = await Promise.all([readPatientProfileMetrics(patientId, game.id), readControllerState(patientId, game.id)]);
        return { gameId: game.id, metrics, controller };
      }));
      setSnapshots(next);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [patientId]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading && snapshots.length === 0) return <View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.detail}>Reading local practice insights...</Text></View>;
  if (failed) return <View style={styles.stack}><Notice tone="support">Practice insights could not be read yet. Saved activity remains on this device.</Notice><ActionButton label="Try again" onPress={() => void refresh()} /></View>;
  const updated = snapshots.map((snapshot) => snapshot.controller?.updatedAt ?? 0).reduce((latest, value) => Math.max(latest, value), 0);
  const hasCompletedPractice = snapshots.some((snapshot) => snapshot.metrics.activity.completedSessions > 0);
  return <View style={styles.stack}>
    <View style={styles.intro}><Text style={styles.eyebrow}>LOCAL PRACTICE SUMMARY</Text><Text style={styles.heading}>Support signals across adaptive activities.</Text><Text style={styles.detail}>These measures describe how much support was needed during practice. They are not a diagnosis.</Text></View>
    {!hasCompletedPractice ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing to review yet</Text><Text style={styles.detail}>Insights appear after a member completes an activity.</Text><View style={styles.emptyList}>{games.map((game) => <View key={game.id} style={styles.emptyRow}><Text style={styles.emptyLabel}>{game.title}</Text><Text style={styles.emptyValue}>—</Text></View>)}</View></View> : snapshots.map((snapshot) => <GameCard key={snapshot.gameId} snapshot={snapshot} />)}
    {updated ? <Text style={styles.updated}>Updated {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(updated)}</Text> : null}
    <Text style={styles.detail}>Recipe is a shared activity and is not scored in these insights.</Text>
    <Notice>Use these signals to choose a calm next activity and discuss changes with a qualified caregiver or clinician when needed.</Notice>
    <ActionButton label="Refresh practice insights" onPress={() => void refresh()} variant="secondary" disabled={loading} />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.gap }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 16 }, intro: { gap: 8 }, eyebrow: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: 0.7 }, heading: { color: theme.colors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 }, detail: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 25 }, emptyCard: { gap: 14, padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white }, emptyTitle: { color: theme.colors.ink, fontSize: 22, fontWeight: '800' }, emptyList: { borderTopWidth: 1, borderTopColor: theme.colors.border }, emptyRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border }, emptyLabel: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' }, emptyValue: { color: theme.colors.mutedInk, fontSize: 22, fontWeight: '700' }, card: { gap: 14, padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white }, cardEyebrow: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: 0.7 }, cardTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, lineHeight: 26, fontWeight: '700' }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { flexGrow: 1, flexBasis: 130, gap: 4 }, metricLabel: { color: theme.colors.mutedInk, fontSize: theme.type.meta }, metricValue: { color: theme.colors.ink, fontSize: 22, fontWeight: '800' }, level: { gap: 4, padding: 14, borderWidth: 1, borderColor: theme.colors.leaf, borderRadius: theme.radius.control, backgroundColor: theme.colors.leafSoft }, levelLabel: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800' }, levelValue: { color: theme.colors.ink, fontSize: 22, fontWeight: '800' }, levelDetail: { color: theme.colors.mutedInk, fontSize: theme.type.meta }, updated: { color: theme.colors.mutedInk, fontSize: theme.type.meta },
});
