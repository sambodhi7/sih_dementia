import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import type { ControllerState } from '../../adaptive/types';
import { createInitialState, REGISTRY } from '../../services/adaptive';
import { ActionButton, Notice, Portrait } from '../../components/ui';
import { readControllerState } from '../../storage/controllerState';
import { applyReviewResult, listWhosWhoItems, markLearningExposure } from '../../storage/items';
import { abandonWhosWhoSession, finishWhosWhoSession, persistGameEvent, startWhosWhoSession } from '../../storage/sessions';
import type { StoredSession, WhosWhoItem } from '../../storage/types';
import { seed } from '../../data/seed';
import { theme } from '../../theme';
import { answerChoices, recallEligible, RecallInput, ROUND_PROMPTS } from './model';

const copy = seed.app.copy;
type Props = { patientId: string; companionPresent: boolean; onHome: () => void };

export function WhosWhoGame({ patientId, companionPresent, onHome }: Props) {
  const [library, setLibrary] = useState<WhosWhoItem[]>([]);
  const [queue, setQueue] = useState<WhosWhoItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'learning' | 'recall' | 'done' | 'paused'>('loading');
  const [config, setConfig] = useState<ControllerState>(createInitialState(patientId, REGISTRY.whos_who));
  const [choices, setChoices] = useState<WhosWhoItem[]>([]);
  const [hint, setHint] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const [doneReason, setDoneReason] = useState<'later' | 'more'>('later');
  const session = useRef<StoredSession | null>(null);
  const input = useRef<RecallInput | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const interrupted = useRef(false);
  const item = queue[index];
  const player = useAudioPlayer(item?.nameAudioUri ? { uri: item.nameAudioUri } : null);
  const cuePlayer = useAudioPlayer(item?.noteAudioUri ? { uri: item.noteAudioUri } : null);

  const playName = async () => { cuePlayer.pause(); await player.seekTo(0); player.play(); };
  const run = async (work: () => Promise<void>) => {
    if (lock.current || interrupted.current) return;
    lock.current = true; setBusy(true);
    try { await work(); }
    catch { setProblem(true); setReady(false); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const [items, saved] = await Promise.all([listWhosWhoItems(), readControllerState(patientId, 'whos_who')]);
        if (!mounted.current) return;
        const own = items.filter((entry) => entry.patientId === patientId && !entry.archivedAt && !entry.paused);
        setLibrary(own); if (saved) setConfig(saved);
        const learning = own.filter((entry) => (!entry.learnedAt || entry.learningOnly) && entry.photoUri && entry.nameAudioUri).slice(0, ROUND_PROMPTS);
        if (learning.length) { setQueue(learning); setPhase('learning'); }
        else startRecall(own);
      } catch { if (mounted.current) setProblem(true); }
    })();
    return () => { mounted.current = false; };
  }, [patientId]);

  const startRecall = (items: WhosWhoItem[]) => {
    const eligible = items.filter((entry) => recallEligible(entry, patientId));
    // Due items only; a learned association is never immediately tested again.
    const due = eligible.filter((entry) => entry.dueAt <= Date.now()).sort((a, b) => a.dueAt - b.dueAt).slice(0, ROUND_PROMPTS);
    if (eligible.length < 2) { setDoneReason('more'); setPhase('done'); return; }
    if (!due.length) { setDoneReason('later'); setPhase('done'); return; }
    setLibrary(items); setQueue(due); setIndex(0); setPhase('recall');
  };

  useEffect(() => {
    setReady(false); setHint(0); setAnswered(false); input.current = null;
    if (phase === 'recall' && item) setChoices(answerChoices(item, library, config));
    if (phase === 'learning' && item) void playName().catch(() => setProblem(true));
  }, [item?.id, phase, library, config]);

  // Layout marks the first visible prompt, rather than a navigation button tap.
  const showPrompt = () => {
    if (phase !== 'recall' || !item || input.current || problem) return;
    void run(async () => {
      const active = session.current ?? await startWhosWhoSession(patientId, item.id, companionPresent);
      session.current = active;
      if (interrupted.current) return;
      const next = new RecallInput(item.id, (event) => persistGameEvent(active.id, event));
      await next.show(); input.current = next;
      await playName(); setReady(true);
    });
  };
  const help = async () => {
    const current = input.current;
    if (!current || current.solved || current.hint === 4) return;
    const nextHint = current.hint + 1;
    await current.help(); setHint(current.hint);
    if (nextHint === 3 && item?.noteAudioUri) { player.pause(); await cuePlayer.seekTo(0); cuePlayer.play(); }
    else if (nextHint === 1 || nextHint === 4) await playName();
  };
  useEffect(() => {
    if (phase !== 'recall' || !ready || answered || busy || hint === 4 || problem) return;
    const timer = setTimeout(() => { void run(help); }, config.hintTimeSeconds * 1000);
    return () => clearTimeout(timer);
  }, [phase, ready, answered, busy, hint, config.hintTimeSeconds, problem]);

  const answer = (chosenId: string, event: GestureResponderEvent) => {
    if (!ready || problem) return;
    const { pageX, pageY } = event.nativeEvent;
    void run(async () => {
      const result = await input.current?.tap(chosenId, pageX, pageY);
      if (!result) return;
      if (!result.correct) { await help(); return; }
      setAnswered(true); player.pause(); cuePlayer.pause();
      await applyReviewResult(item.id, result.independent ? 'independent' : 'supported');
      if (index === queue.length - 1 && session.current) {
        await finishWhosWhoSession(session.current); session.current = null;
      }
    });
  };
  const leave = () => void run(async () => {
    player.pause(); cuePlayer.pause();
    if (session.current) { await abandonWhosWhoSession(session.current); session.current = null; }
    onHome();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        interrupted.current = true; player.pause(); cuePlayer.pause(); setReady(false); setPhase('paused');
        // Leave the durable session open and unscored. No invented abandonment.
      }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (interrupted.current || problem) onHome(); else leave(); return true; });
    return () => { subscription.remove(); back.remove(); };
  }, [player, cuePlayer, problem]);

  if (problem) return <View style={styles.stack}><Notice tone="support">{copy.practiceSaveProblem}</Notice><ActionButton label={copy.home} onPress={onHome} /></View>;
  if (phase === 'paused') return <View style={styles.stack}><Notice>{copy.practicePaused}</Notice><ActionButton label={copy.home} onPress={onHome} /></View>;
  if (phase === 'loading') return <Notice>{copy.practiceLoading}</Notice>;
  if (phase === 'done' || !item) return <View style={styles.stack}><Notice>{doneReason === 'more' ? copy.practiceNeedMoreMemories : copy.practiceDone}</Notice><ActionButton label={copy.home} onPress={onHome} /></View>;
  return <View style={styles.stack}>
    <Text accessibilityRole="header" style={styles.title}>{phase === 'learning' ? `${copy.meet} ${item.name}` : copy.choosePhotoForName}</Text>
    {phase === 'learning' ? <View style={styles.frame}><Portrait uri={item.photoUri ?? undefined} name={item.name} size={200} /><Text style={styles.name}>{item.name}</Text><Text style={styles.body}>{item.relationship}</Text>{item.personalNote ? <Text style={styles.body}>{item.personalNote}</Text> : null}</View> : <View key={item.id} onLayout={showPrompt} style={styles.frame}><Text style={styles.name}>{item.name}</Text></View>}
    <ActionButton label={copy.hearAgain} disabled={busy || (phase === 'recall' && (!ready || answered))} variant="secondary" onPress={() => void run(async () => { if (phase === 'recall') await input.current?.replay(); await playName(); })} />
    {phase === 'recall' ? <>
      <View style={styles.stack}>{choices.map((choice, position) => <Pressable key={choice.id} accessibilityRole="button" accessibilityLabel={`${copy.photoOption} ${position + 1}`} accessibilityState={{ disabled: busy || !ready || answered }} disabled={busy || !ready || answered} onPress={(event) => answer(choice.id, event)} style={({ pressed }) => [styles.choice, hint >= 2 && choice.id !== item.id && position === choices.findIndex((candidate) => candidate.id !== item.id) && styles.dimmed, hint === 4 && choice.id === item.id && styles.reveal, pressed && styles.pressed]}><Portrait uri={choice.photoUri ?? undefined} name="" size={120} />{hint === 4 && choice.id === item.id ? <Text style={styles.body}>{item.name}</Text> : null}</Pressable>)}</View>
      <View style={styles.feedback}>{answered ? <Notice>{copy.practiceThanks}</Notice> : hint > 0 ? <Notice tone="support">{hint === 4 ? `${copy.meet} ${item.name}` : hint === 3 ? item.relationship : copy.calmHint}</Notice> : null}</View>
      {answered ? <ActionButton label={copy.continue} disabled={busy} onPress={() => { if (index === queue.length - 1) setPhase('done'); else { setReady(false); setIndex((value) => value + 1); } }} /> : null}
    </> : <ActionButton label={copy.continue} disabled={busy} onPress={() => void run(async () => {
      await markLearningExposure(item.id);
      if (index + 1 < queue.length) setIndex((value) => value + 1);
      else {
        const refreshed = await listWhosWhoItems();
        setLibrary(refreshed);
        startRecall(refreshed);
      }
    })} />}
    <ActionButton label={copy.home} onPress={leave} disabled={busy} variant="quiet" />
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.gap }, title: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '700' },
  frame: { alignItems: 'center', gap: theme.spacing.gap, padding: theme.spacing.page, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media },
  name: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '700', textAlign: 'center' },
  body: { color: theme.colors.ink, fontSize: theme.type.patient, textAlign: 'center' },
  choice: { minHeight: 144, alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 2, borderColor: theme.colors.leaf, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  dimmed: { opacity: 0.4 }, reveal: { backgroundColor: theme.colors.amberSoft, borderColor: theme.colors.amber }, pressed: { opacity: 0.8 }, feedback: { minHeight: 100 },
});
