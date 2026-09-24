import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { difficultyLabel, difficultyLevel } from '../services/adaptive/difficulty';
import type { ControllerState } from '../services/adaptive/types';
import { readCompletedPractice } from '../storage/caregiverProgress';
import type { CompletedPractice } from '../storage/caregiverProgress';
import { readControllerState } from '../storage/controllerState';
import type { RoutineItem } from '../storage/routines';
import { theme } from '../theme';
import { ActionButton, Notice } from './ui';
import { activityDays, gameNames, samplePractice, scoredRounds, trackedGames } from './caregiverCharts';
import type { TrackedGame } from './caregiverCharts';
import { MemberReportExport } from './MemberReportExport';

function TodayCard({ routine, now, onManageRoutine }: { routine: RoutineItem[]; now: number; onManageRoutine: () => void }) {
  const currentMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const sorted = [...routine].sort((a, b) => a.time.localeCompare(b.time));
  const next = sorted.find((item) => {
    const [hour, minute] = item.time.split(':').map(Number);
    return hour * 60 + minute >= currentMinutes;
  });
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>TODAY'S CARE PLAN</Text>
    <Text style={styles.title}>{next ? `Next: ${next.title}` : sorted.length ? 'All planned times have passed' : 'Plan today together'}</Text>
    <Text style={styles.body}>These are scheduled reminders. Saathi does not record whether medicine was taken.</Text>
    {sorted.length === 0 ? <Text style={styles.body}>No reminders have been added yet.</Text> : sorted.map((item) => {
      const [hour, minute] = item.time.split(':').map(Number);
      const earlier = hour * 60 + minute < currentMinutes;
      return <View key={item.id} style={styles.routineRow}>
        <Text style={styles.routineTime}>{item.time}</Text>
        <View style={styles.routineCopy}><Text style={styles.routineTitle}>{item.title}</Text><Text style={styles.caption}>{item.kind === 'medication' ? 'Medicine reminder' : 'Daily activity'} · {earlier ? 'Earlier today' : 'Upcoming'}</Text></View>
      </View>;
    })}
    <ActionButton label="Manage reminders" onPress={onManageRoutine} variant="secondary" />
  </View>;
}

function ActivityChart({ practice, now, locale, sample }: { practice: CompletedPractice[]; now: number; locale: string; sample: boolean }) {
  const days = activityDays(practice, now, locale);
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>{sample ? 'SAMPLE · LAST 7 DAYS' : 'LAST 7 DAYS'}</Text>
    <Text style={styles.title}>Completed activities</Text>
    <Text style={styles.body}>{total === 0 ? 'No completed activities this week yet.' : `${sample ? 'Example: ' : ''}${total} completed ${total === 1 ? 'activity' : 'activities'} this week.`}</Text>
    <View style={styles.chart} accessible accessibilityLabel={`${sample ? 'Sample chart. ' : ''}Completed activities over seven days: ${days.map((day) => `${day.label} ${day.count}`).join(', ')}`}>
      {days.map((day) => <View key={day.key} style={styles.chartColumn} accessible={false}>
        <Text style={styles.chartNumber}>{day.count}</Text>
        <View style={styles.chartTrack}><View style={[styles.chartBar, { height: day.count === 0 ? 0 : Math.max(8, day.count / max * 88) }]} /></View>
        <Text style={styles.chartLabel}>{day.label}</Text>
      </View>)}
    </View>
    <Text style={styles.caption}>Completed Day's Plan and Who's Who activities. Recipe is not scored here.</Text>
  </View>;
}

function ProgressChart({ practice, gameId, sample }: { practice: CompletedPractice[]; gameId: TrackedGame; sample: boolean }) {
  const rounds = scoredRounds(practice, gameId);
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>{gameNames[gameId].toUpperCase()}{sample ? ' · SAMPLE' : ''}</Text>
    <Text style={styles.title}>Independent responses</Text>
    {rounds.length === 0 ? <Text style={styles.body}>A progress graph appears after a scored round.</Text> : <>
      <Text style={styles.body}>Last {rounds.length} scored {rounds.length === 1 ? 'round' : 'rounds'}, oldest to newest.</Text>
      <View style={styles.chart} accessible accessibilityLabel={`${sample ? 'Sample chart. ' : ''}${gameNames[gameId]} independent responses: ${rounds.map((entry) => `${Math.round(entry.independentPercent ?? 0)} percent`).join(', ')}`}>
        {rounds.map((entry, index) => <View key={`${entry.endedAt}-${index}`} style={styles.chartColumn} accessible={false}>
          <Text style={styles.chartNumber}>{Math.round(entry.independentPercent ?? 0)}%</Text>
          <View style={styles.chartTrack}><View style={[styles.chartBar, { height: Math.max(4, (entry.independentPercent ?? 0) / 100 * 88) }]} /></View>
          <Text style={styles.chartLabel}>{index + 1}</Text>
        </View>)}
      </View>
      <Text style={styles.caption}>Based on scored responses completed without hints or replay.</Text>
    </>}
  </View>;
}

function AdaptationCard({ controllers, onOpenMember }: { controllers: Array<{ gameId: TrackedGame; state: ControllerState | null }>; onOpenMember: () => void }) {
  const active = [...controllers].filter((entry) => entry.state && entry.state.sessionsObserved > 0).sort((a, b) => (b.state?.updatedAt ?? 0) - (a.state?.updatedAt ?? 0))[0];
  const state = active?.state;
  return <View style={[styles.card, styles.adaptationCard]}>
    <Text style={styles.eyebrow}>ADAPTIVE PRACTICE</Text>
    <Text style={styles.title}>{state ? `${gameNames[active.gameId]}: ${difficultyLabel(state.difficulty)}` : 'Ready for a first activity'}</Text>
    <Text style={styles.body}>{state ? `Saathi currently offers ${difficultyLevel(state.difficulty)} practice and brings in hints after about ${Math.round(state.hintTimeSeconds)} seconds. It updates this setting from completed practice.` : 'After a completed activity, Saathi can adjust the level and hint timing for the next round.'}</Text>
    <ActionButton label="Open member games" onPress={onOpenMember} />
  </View>;
}

export function CaregiverOverview({ patientId, patientName, locale, routine, onManageRoutine, onOpenMember }: { patientId: string; patientName: string; locale: string; routine: RoutineItem[]; onManageRoutine: () => void; onOpenMember: () => void }) {
  const [practice, setPractice] = useState<CompletedPractice[]>([]);
  const [controllers, setControllers] = useState<Array<{ gameId: TrackedGame; state: ControllerState | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const [completed, states] = await Promise.all([
        readCompletedPractice(patientId),
        Promise.all(trackedGames.map(async (gameId) => ({ gameId, state: await readControllerState(patientId, gameId) }))),
      ]);
      setPractice(completed); setControllers(states); setNow(Date.now());
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, [patientId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const showingSample = practice.length === 0;
  const graphPractice = showingSample ? samplePractice(now) : practice;
  return <View style={styles.stack}>
    <View style={styles.intro}><Text style={styles.eyebrow}>LOCAL CAREGIVER OVERVIEW</Text><Text style={styles.heading}>Today and recent practice.</Text><Text style={styles.body}>These patterns describe practice and support. They are not a diagnosis.</Text><MemberReportExport patientId={patientId} patientName={patientName} locale={locale} routine={routine} /></View>
    <TodayCard routine={routine} now={now} onManageRoutine={onManageRoutine} />
    {loading && controllers.length === 0 ? <View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.body}>Reading local activity...</Text></View> : failed ? <Notice tone="support">Progress could not be read. Saved activity remains on this device.</Notice> : <>
      <ActivityChart practice={graphPractice} now={now} locale={locale} sample={showingSample} />
      {trackedGames.map((gameId) => <ProgressChart key={gameId} practice={graphPractice} gameId={gameId} sample={showingSample} />)}
      <AdaptationCard controllers={controllers} onOpenMember={onOpenMember} />
    </>}
    <ActionButton label="Refresh overview" onPress={() => void refresh()} variant="secondary" disabled={loading} />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.gap },
  intro: { gap: 8 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  eyebrow: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: 0.7 },
  heading: { color: theme.colors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  title: { color: theme.colors.ink, fontSize: theme.type.guardian, lineHeight: 26, fontWeight: '700' },
  body: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 25 },
  caption: { color: theme.colors.mutedInk, fontSize: theme.type.meta, lineHeight: 22 },
  card: { gap: 14, padding: 18, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  adaptationCard: { backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf },
  routineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: theme.colors.border },
  routineTime: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800', minWidth: 54 },
  routineCopy: { flex: 1, gap: 2 },
  routineTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, minHeight: 126 },
  chartColumn: { flex: 1, alignItems: 'center', gap: 4, minWidth: 0 },
  chartNumber: { color: theme.colors.ink, fontSize: theme.type.meta, fontWeight: '700' },
  chartTrack: { height: 88, width: '100%', justifyContent: 'flex-end', borderBottomWidth: 1, borderColor: theme.colors.border },
  chartBar: { width: '100%', backgroundColor: theme.colors.leaf, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartLabel: { color: theme.colors.mutedInk, fontSize: theme.type.meta },
});
