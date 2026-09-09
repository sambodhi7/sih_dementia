import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ControllerState, PatientProfileMetrics } from '../adaptive/types';
import { readControllerState } from '../storage/controllerState';
import { readPatientProfileMetrics } from '../storage/patientMetrics';
import { theme } from '../theme';
import { ActionButton, Notice } from './ui';

type Props = { patientId: string; locale: string };
type Snapshot = { metrics: PatientProfileMetrics; controller: ControllerState | null };

const percent = (value: number | null) => value === null ? 'Not enough practice yet' : `${Math.round(value)}%`;
const seconds = (value: number | null) => value === null ? 'Not enough independent responses yet' : `${value.toFixed(1)} seconds`;

function trendCopy(metrics: PatientProfileMetrics) {
  if (metrics.trend.direction === 'improving') return 'Recent practice needed less support than the first completed round.';
  if (metrics.trend.direction === 'changing') return 'Support needs have changed across completed rounds.';
  if (metrics.trend.direction === 'stable') return 'Support needs have stayed similar across completed rounds.';
  return 'Complete two or more practice rounds to see a personal change pattern.';
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.detail}>{detail}</Text></View>;
}

export function WhosWhoMetrics({ patientId, locale }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const [metrics, controller] = await Promise.all([
        readPatientProfileMetrics(patientId, 'whos_who'),
        readControllerState(patientId, 'whos_who'),
      ]);
      setSnapshot({ metrics, controller });
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [patientId]);
  useEffect(() => { void refresh(); }, [refresh]);

  if (loading && !snapshot) return <View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.detail}>Reading practice saved on this device…</Text></View>;
  if (failed || !snapshot) return <View style={styles.stack}><Notice tone="support">Practice insights could not be read yet. The saved activity remains on this device.</Notice><ActionButton label="Try again" onPress={() => void refresh()} /></View>;
  const { metrics, controller } = snapshot;
  const lastUpdated = controller ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(controller.updatedAt) : null;
  return <View style={styles.stack}>
    <View style={styles.intro}><Text style={styles.eyebrow}>LOCAL PRACTICE SUMMARY</Text><Text style={styles.heading}>A gentle view of support during familiar-memory practice.</Text><Text style={styles.detail}>{trendCopy(metrics)}</Text></View>
    <View style={styles.grid}>
      <MetricCard label="Independent responses" value={percent(metrics.independentPerformancePercent)} detail="Correct first responses without replay or a visible hint." />
      <MetricCard label="Support needed" value={percent(metrics.supportNeededPercent)} detail="Responses that used a replay, cue, reveal, or another try." />
      <MetricCard label="Typical response time" value={seconds(metrics.medianResponseLatencySeconds)} detail="Independent responses only. Assisted-session timing is excluded." />
      <MetricCard label="Completed practice rounds" value={String(metrics.activity.completedSessions)} detail={`${metrics.activity.activeDays} active day${metrics.activity.activeDays === 1 ? '' : 's'} · ${metrics.activity.abandonedSessions} stopped round${metrics.activity.abandonedSessions === 1 ? '' : 's'}`} />
    </View>
    <View style={styles.controller}><Text style={styles.label}>Current practice support</Text><Text style={styles.controllerText}>{controller ? `${controller.sessionsObserved < 5 ? 'Learning the pace' : 'Personalized'} · hints after about ${Math.round(controller.hintTimeSeconds)} seconds · ${controller.difficulty < 0.34 ? 'two' : controller.difficulty < 0.67 ? 'three' : 'four'} photo choices` : 'The first completed recall round will set a personal starting point.'}</Text>{lastUpdated ? <Text style={styles.updated}>Updated {lastUpdated}</Text> : null}</View>
    <Notice>These are non-diagnostic support signals from Who’s Who practice. They do not assess, diagnose, or predict a medical condition.</Notice>
    <ActionButton label="Refresh practice insights" onPress={() => void refresh()} variant="secondary" disabled={loading} />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.gap }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 16 },
  intro: { gap: 8, paddingVertical: 4 }, eyebrow: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: 0.7 },
  heading: { color: theme.colors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 }, detail: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { flexGrow: 1, flexBasis: 260, gap: 8, padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  label: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800' }, value: { color: theme.colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 38 },
  controller: { gap: 8, padding: 18, borderWidth: 1, borderColor: theme.colors.leaf, borderRadius: theme.radius.control, backgroundColor: theme.colors.leafSoft },
  controllerText: { color: theme.colors.ink, fontSize: theme.type.guardian, lineHeight: 26 }, updated: { color: theme.colors.mutedInk, fontSize: theme.type.meta },
});
