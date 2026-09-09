import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import type { ControllerState, GameEvent, SessionOutcome } from './services/adaptive/types';
import { whosWhoChoiceIds, whosWhoOptionCount } from './services/adaptive/whosWhoPresentation';
import { AudioCapture, AudioReplay } from './components/audio';
import { CaregiverMetrics } from './components/CaregiverMetrics';
import { DaysPlanActivity, DaysPlanEditor } from './components/daysPlan';
import { ActionButton, Field, MemberRow, Notice, Portrait } from './components/ui';
import { seed } from './data/seed';
import { supabase } from './lib/supabase';
import { pickAndPersistPhoto } from './storage/media';
import { readControllerState } from './storage/controllerState';
import { listDaysPlanItems, makeDaysPlanItems, saveDaysPlanItems } from './storage/daysPlan';
import { archiveWhosWhoItem, chooseNextWhosWhoItem, getLocalSetting, initializeItems, listWhosWhoItems, markLearningExposure, saveWhosWhoItem, setLocalSetting } from './storage/items';
import { abandonDaysPlanSession, abandonWhosWhoSession, finishDaysPlanSession, finishWhosWhoSession, persistGameEvent, startDaysPlanSession, startWhosWhoSession } from './storage/sessions';
import type { DaysPlanItem, StoredDaysPlanSession, StoredSession, WhosWhoDraft, WhosWhoItem } from './storage/types';
import { theme } from './theme';
import { touchFeedback } from './lib/haptics';
import { PatientSkillCard, SkillManagerCard } from './games/skillTransmission/SkillCards';
import { SkillIllustration } from './games/skillTransmission/SkillIllustration';
import { isPlayableSkill, SkillInteraction } from './games/skillTransmission/SkillInteraction';
import { completeSkillTransmissionSession, interruptSkillTransmissionSession, persistEngagementEvent, startSkillTransmissionSession } from './storage/activitySessions';
import { pickAndPersistSkillCompletionPhoto, persistSkillPromptAudio } from './storage/media';
import { initializeSkillTransmission, listSkillCompletions, listSkillTransmissionItems, saveSkillPromptAudio, setSkillEnabled } from './storage/skillTransmission';
import type { ActivitySession, SkillCompletion, SkillTransmissionItem } from './storage/types';

type Screen = 'language' | 'onboarding' | 'login' | 'dashboard' | 'manager' | 'editor' | 'daysPlanEditor' | 'daysPlan' | 'patient' | 'learning' | 'recall' | 'waiting' | 'skills-manager' | 'skills-home' | 'skill-invitation' | 'skill-active' | 'skill-complete' | 'metrics';
type Editor = WhosWhoDraft & { id?: string };
type RecallMode = 'photo-to-name' | 'name-to-photo' | 'clue-to-photo';
type CareProfile = { guardianName: string; relationship: string; patientName: string };
const copy = seed.app.copy;
const recallModes: RecallMode[] = ['photo-to-name', 'name-to-photo', 'clue-to-photo'];
const emptyEditor = (): Editor => ({ name: '', relationship: '', personalNote: '', photoUri: null, nameAudioUri: null, noteAudioUri: null, learningOnly: false });

function authProblemMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  if (normalized.includes('invalid login credentials')) return 'That email and password do not match an account. You can create a guardian account if this is your first time.';
  if (normalized.includes('email not confirmed')) return 'Please confirm the email link first, then sign in again.';
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Saathi could not reach the account service. Check the phone internet connection and try again.';
  return copy.accountProblem;
}

function PhotoAnswer({ item, onPress }: { item: WhosWhoItem; onPress: (event: GestureResponderEvent) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Photo option: ${item.name}`} onPress={(event) => { touchFeedback(); onPress(event); }} style={({ pressed }) => [styles.photoAnswer, pressed && styles.pressed]}><Portrait uri={item.photoUri ?? undefined} name={item.name} size={132} /><Text style={styles.photoAnswerText}>{copy.chooseThisPhoto}</Text></Pressable>;
}

function Header({ title, eyebrow, onBack }: { title: string; eyebrow?: string; onBack?: () => void }) {
  return <View style={styles.header}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => { touchFeedback(); onBack(); }} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>← {copy.back}</Text></Pressable> : null}<View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>S</Text></View><Text style={styles.brandText}>Saathi</Text></View>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>;
}

function Layout({ children, patient = false }: { children: React.ReactNode; patient?: boolean }) {
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={theme.colors.canvas} /><ScrollView contentContainerStyle={[styles.scroll, patient && styles.patientScroll]} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
}

function hintMessage(item: WhosWhoItem, level: number): string | null {
  if (level === 1) return copy.hintTakeTime;
  if (level === 2) return `${copy.hintThinkOf} ${item.relationship}.`;
  if (level === 3) return item.personalNote || copy.hintListenTogether;
  if (level >= 4) return `${copy.hintReveal} ${item.name}. ${copy.hintTapWhenReady}`;
  return null;
}

export default function SaathiWorkflow() {
  const [screen, setScreen] = useState<Screen>('language');
  const [ready, setReady] = useState(false);
  const [languageId, setLanguageId] = useState(seed.languagePacks[0].id);
  const [items, setItems] = useState<WhosWhoItem[]>([]);
  const [patientId, setPatientId] = useState(seed.patient.id);
  const [setup, setSetup] = useState<CareProfile>({ guardianName: seed.guardian.name, relationship: seed.guardian.relationship, patientName: seed.patient.name });
  const [login, setLogin] = useState({ email: '', password: '' });
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor>(emptyEditor());
  const [archiveCandidate, setArchiveCandidate] = useState<WhosWhoItem | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [mode, setMode] = useState<RecallMode>('photo-to-name');
  const [answerState, setAnswerState] = useState<'idle' | 'support' | 'complete'>('idle');
  const [hadWrong, setHadWrong] = useState(false);
  const [usedHelp, setUsedHelp] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [completedPromptKeys, setCompletedPromptKeys] = useState<string[]>([]);
  const [pendingRecallMode, setPendingRecallMode] = useState<RecallMode>('photo-to-name');
  const [controllerState, setControllerState] = useState<ControllerState | null>(null);
  const [waitingUntil, setWaitingUntil] = useState<number | null>(null);
  const [skills, setSkills] = useState<SkillTransmissionItem[]>([]);
  const [skillCompletions, setSkillCompletions] = useState<SkillCompletion[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [activitySession, setActivitySession] = useState<ActivitySession | null>(null);
  const [skillStartedAt, setSkillStartedAt] = useState<number | null>(null);
  const [skillDurationMs, setSkillDurationMs] = useState(0);
  const [completionPhotoUri, setCompletionPhotoUri] = useState<string | null>(null);
  const [daysPlanItems, setDaysPlanItems] = useState<DaysPlanItem[]>(() => makeDaysPlanItems(seed.daysPlan.items, seed.patient.id));
  const [daysPlanSession, setDaysPlanSession] = useState<StoredDaysPlanSession | null>(null);
  const [daysPlanController, setDaysPlanController] = useState<ControllerState | null>(null);
  const [companionPresent, setCompanionPresent] = useState(false);

  const language = useMemo(() => seed.languagePacks.find((item) => item.id === languageId) ?? seed.languagePacks[0], [languageId]);
  const patientDisplayName = setup.patientName.trim();
  const activeItem = useMemo(() => items.find((item) => item.id === activeItemId) ?? null, [items, activeItemId]);
  const activeSkill = useMemo(() => skills.find((item) => item.id === activeSkillId) ?? null, [activeSkillId, skills]);
  const choices = useMemo(() => {
    if (!activeItem) return [];
    // Prototype mode: every non-learning-only memory stays available. Review
    // schedules and pause state are retained locally but never block a prompt.
    const candidates = items.filter((item) => !item.learningOnly);
    const optionCount = whosWhoOptionCount(controllerState, candidates.length);
    const ids = whosWhoChoiceIds(activeItem.id, candidates.map((item) => item.id), optionCount, `${session?.id ?? 'preview'}:${mode}`);
    return ids.map((id) => candidates.find((item) => item.id === id)).filter((item): item is WhosWhoItem => Boolean(item));
  }, [activeItem, controllerState, items, mode, session?.id]);
  const refresh = async (targetPatientId = patientId) => {
    const [nextItems, nextSkills, nextCompletions] = await Promise.all([listWhosWhoItems(), listSkillTransmissionItems(targetPatientId), listSkillCompletions(targetPatientId)]);
    setItems(nextItems); setSkills(nextSkills); setSkillCompletions(nextCompletions);
  };
  const loadDaysPlan = async (targetPatientId: string) => {
    const stored = await listDaysPlanItems(targetPatientId);
    setDaysPlanItems(stored.length ? stored : await saveDaysPlanItems(targetPatientId, makeDaysPlanItems(seed.daysPlan.items, targetPatientId)));
  };

  useEffect(() => { void (async () => {
    await initializeItems();
    const stored = await getLocalSetting('patient-id'); const localPatientId = stored ?? patientId; if (stored) setPatientId(stored);
    const storedProfile = await getLocalSetting('care-profile');
    if (storedProfile) { try { setSetup(JSON.parse(storedProfile) as CareProfile); } catch { /* Ignore malformed local profile data. */ } }
    await initializeSkillTransmission(localPatientId); await loadDaysPlan(localPatientId); await refresh(localPatientId); setReady(true);
  })(); }, []);

  const persistCareProfile = async (profile = setup) => setLocalSetting('care-profile', JSON.stringify(profile));

  const createCareCircle = async () => {
    if (!supabase) { setNotice(copy.authUnavailable); return false; }
    const { data, error } = await supabase.functions.invoke<{ patientId: string }>('create-care-circle', { body: { patientDisplayName: setup.patientName.trim(), relationshipToPatient: setup.relationship.trim(), preferredLanguageCode: language.id, patientTimezone: 'Asia/Kolkata' } });
    if (error || !data?.patientId) { setNotice(copy.accountProblem); return false; }
    setPatientId(data.patientId); await setLocalSetting('patient-id', data.patientId); await persistCareProfile(); await initializeSkillTransmission(data.patientId); await loadDaysPlan(data.patientId); await refresh(data.patientId); return true;
  };

  const authenticate = async () => {
    if (!supabase) { setNotice(copy.authUnavailable); return; }
    if (!login.email.trim() || login.password.length < 8) { setNotice('Use an email address and a password with at least 8 characters.'); return; }
    setBusy(true); setNotice('');
    try {
      if (authMode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({ email: login.email.trim(), password: login.password, options: { data: { display_name: setup.guardianName, preferred_language_code: language.id } } });
        if (error) setNotice(authProblemMessage(error.message));
        else if (!data.session) setNotice(copy.checkEmail);
        else if (await createCareCircle()) setScreen('dashboard');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: login.email.trim(), password: login.password });
        if (error || !data.user) setNotice(authProblemMessage(error?.message));
        else {
          const { data: links } = await supabase.from('patient_guardians').select('patient_id').eq('guardian_id', data.user.id).eq('status', 'active').limit(1);
          if (links?.[0]?.patient_id) { const linkedPatientId = links[0].patient_id; setPatientId(linkedPatientId); await setLocalSetting('patient-id', linkedPatientId); await initializeSkillTransmission(linkedPatientId); await loadDaysPlan(linkedPatientId); await refresh(linkedPatientId); setScreen('dashboard'); }
          else setScreen('onboarding');
        }
      }
    } catch (error) { setNotice(authProblemMessage(error instanceof Error ? error.message : undefined)); } finally { setBusy(false); }
  };

  const saveMemory = async () => {
    if (!editor.name.trim() || !editor.relationship.trim()) { setNotice(copy.requiredNotice); return; }
    await saveWhosWhoItem(patientId, editor, editor.id); await refresh(); setNotice(editor.id ? 'Memory changes saved on this device.' : copy.addedNotice); setScreen('manager');
  };
  const selectPhoto = async () => { try { const uri = await pickAndPersistPhoto(editor.id ?? `draft-${Date.now()}`); if (uri) setEditor((value) => ({ ...value, photoUri: uri })); } catch { setNotice('The photo could not be saved. Please try again.'); } };
  const openEditor = (item?: WhosWhoItem) => { setNotice(''); setEditor(item ? { id: item.id, name: item.name, relationship: item.relationship, personalNote: item.personalNote, photoUri: item.photoUri, nameAudioUri: item.nameAudioUri, noteAudioUri: item.noteAudioUri, learningOnly: item.learningOnly } : emptyEditor()); setScreen('editor'); };
  const archive = async () => { if (!archiveCandidate) return; await archiveWhosWhoItem(archiveCandidate.id); setArchiveCandidate(null); await refresh(); setNotice('This memory is now hidden from patient activities.'); };
  const saveDaysPlan = async (nextItems: DaysPlanItem[]) => { setDaysPlanItems(await saveDaysPlanItems(patientId, nextItems)); setNotice('Today’s plan is saved on this device.'); setScreen('dashboard'); };
  const beginDaysPlan = async (phase: 'morning' | 'evening') => { const started = await startDaysPlanSession(patientId, phase, companionPresent); setDaysPlanController(await readControllerState(patientId, 'days_plan')); setDaysPlanSession(started); await persistGameEvent(started.id, { type: 'prompt_shown', itemId: daysPlanItems[0]?.id ?? `${phase}-plan`, at: Date.now() }); };
  const recordDaysPlanEvent = async (event: GameEvent) => { if (daysPlanSession) await persistGameEvent(daysPlanSession.id, event); };
  const finishDaysPlan = async () => { if (daysPlanSession) await finishDaysPlanSession(daysPlanSession); setDaysPlanSession(null); };
  const abandonDaysPlan = async () => { if (daysPlanSession) await abandonDaysPlanSession(daysPlanSession); setDaysPlanSession(null); };

  const skillTitle = (item: SkillTransmissionItem) => copy.skillTitles[item.catalogKey];
  const skillPrompt = (item: SkillTransmissionItem) => copy.skillPrompts[item.catalogKey];
  const audioCaptureLabels = { working: copy.audioWorking, stopAndSave: copy.stopAndSaveRecording, recordAgain: copy.recordAgain, record: copy.recordVoicePrompt, saved: copy.promptSaved, permission: copy.microphoneNeeded, failed: copy.recordingFailed };

  const captureSkillPrompt = async (item: SkillTransmissionItem, sourceUri: string) => {
    try {
      const uri = await persistSkillPromptAudio(item.id, sourceUri);
      await saveSkillPromptAudio(item.id, uri);
      await refresh(); setNotice(copy.promptSaved);
    } catch { setNotice(copy.recordingFailed); }
  };
  const toggleSkill = async (item: SkillTransmissionItem) => {
    if (!isPlayableSkill(item.catalogKey) && !item.enabled) { setNotice(copy.interactionComingSoon); return; }
    if (!item.promptAudioUri && !item.enabled) { setNotice(copy.recordToEnable); return; }
    await setSkillEnabled(item.id, !item.enabled); await refresh(); setNotice('');
  };
  const openSkill = async (item: SkillTransmissionItem) => {
    const started = await startSkillTransmissionSession(patientId, item.id);
    await persistEngagementEvent(started.id, { type: 'activity_opened', itemId: item.id, at: Date.now() });
    setActiveSkillId(item.id); setActivitySession(started); setSkillStartedAt(null); setSkillDurationMs(0); setCompletionPhotoUri(null); setNotice(''); setScreen('skill-invitation');
  };
  const replaySkillPrompt = async () => {
    if (!activitySession || !activeSkill) return;
    await persistEngagementEvent(activitySession.id, { type: 'prompt_played', itemId: activeSkill.id, replayed: true, at: Date.now() });
  };
  const beginSkillActivity = async () => {
    if (!activitySession || !activeSkill) return;
    const startedAt = Date.now();
    await persistEngagementEvent(activitySession.id, { type: 'activity_started', itemId: activeSkill.id, at: startedAt });
    setSkillStartedAt(startedAt); setScreen('skill-active');
  };
  const markSkillComplete = async () => {
    if (!activitySession || !activeSkill || !skillStartedAt) return;
    const durationMs = Math.max(0, Date.now() - skillStartedAt);
    await persistEngagementEvent(activitySession.id, { type: 'activity_completed', itemId: activeSkill.id, durationMs, at: Date.now() });
    setSkillDurationMs(durationMs); setScreen('skill-complete');
  };
  const captureCompletionPhoto = async () => {
    if (!activitySession || !activeSkill) return;
    try {
      const uri = await pickAndPersistSkillCompletionPhoto(activitySession.id);
      if (!uri) return;
      await persistEngagementEvent(activitySession.id, { type: 'completion_photo_captured', itemId: activeSkill.id, at: Date.now() });
      setCompletionPhotoUri(uri); setNotice(copy.photoSaved);
    } catch { setNotice(copy.photoProblem); }
  };
  const finishSkillSession = async (destination: 'patient' | 'skills-home') => {
    if (activitySession && activeSkill) await completeSkillTransmissionSession(activitySession, skillDurationMs, completionPhotoUri);
    await refresh();
    setActivitySession(null); setSkillStartedAt(null); setSkillDurationMs(0); setCompletionPhotoUri(null); setActiveSkillId(null); setNotice(''); setScreen(destination);
  };
  const leaveSkillSession = async () => {
    if (activitySession) await interruptSkillTransmissionSession(activitySession);
    setActivitySession(null); setSkillStartedAt(null); setSkillDurationMs(0); setCompletionPhotoUri(null); setActiveSkillId(null); setNotice(''); setScreen('patient');
  };

  const openActivity = async () => {
    setNotice('');
    setWaitingUntil(null);
    const availableMemories = (await listWhosWhoItems()).filter((item) => !item.learningOnly);
    if (!availableMemories.length) { setNotice(copy.caregiverAddMemory); return; }
    const next = await chooseNextWhosWhoItem();
    if (!next) { setNotice(copy.noActiveMemories); return; }
    setCompletedPromptKeys([]); setPendingRecallMode('photo-to-name'); setActiveItemId(next.id); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setHintLevel(0); setAttempts(0);
    if (!next.learnedAt) setScreen('learning'); else await beginRecall(next, 'photo-to-name');
  };
  const beginRecall = async (item: WhosWhoItem, requestedMode?: RecallMode, forceNewSession = false) => {
    // A practice round is one session. This gives the controller a meaningful
    // batch of mixed prompts instead of treating each card as a full session.
    const started = forceNewSession ? await startWhosWhoSession(patientId, item.id) : session ?? await startWhosWhoSession(patientId, item.id);
    await persistGameEvent(started.id, { type: 'prompt_shown', itemId: item.id, at: Date.now() });
    // New memories start with the familiar photo. Later reviews rotate name and
    // relationship/personal-note prompts without changing the per-item schedule.
    const nextMode = requestedMode ?? (item.reviewStep < 0 ? 'photo-to-name' : item.reviewStep % 3 === 0 ? 'name-to-photo' : item.reviewStep % 3 === 1 ? 'clue-to-photo' : 'photo-to-name');
    if (!session || forceNewSession) setControllerState(await readControllerState(patientId, 'whos_who'));
    setSession(started); setMode(nextMode); setAnswerState('idle'); setHintLevel(0); setScreen('recall');
  };
  const practice = async () => { if (!activeItem) return; await markLearningExposure(activeItem.id); await refresh(); await beginRecall(activeItem, pendingRecallMode); };
  const replay = async () => { if (activeItem && session) await persistGameEvent(session.id, { type: 'audio_replayed', itemId: activeItem.id, at: Date.now() }); setUsedHelp(true); };
  const showHint = useCallback(async () => {
    if (!activeItem || !session || hintLevel >= 4) return;
    const nextHintLevel = Math.min(4, hintLevel + 1);
    await persistGameEvent(session.id, { type: 'hint_shown', itemId: activeItem.id, level: nextHintLevel, at: Date.now() });
    setHintLevel(nextHintLevel); setUsedHelp(true); setAnswerState('support');
  }, [activeItem, hintLevel, session]);
  useEffect(() => {
    if (screen !== 'recall' || !session || !activeItem || hintLevel !== 0) return;
    const delay = Math.max(4_000, (controllerState?.hintTimeSeconds ?? 10) * 1_000);
    const timer = setTimeout(() => { void showHint(); }, delay);
    return () => clearTimeout(timer);
  }, [activeItem, controllerState?.hintTimeSeconds, hintLevel, screen, session, showHint]);
  const answer = async (itemId: string, event?: GestureResponderEvent) => {
    if (!activeItem || !session || answerState === 'complete') return;
    const correct = itemId === activeItem.id; const now = Date.now(); const nextAttempts = attempts + 1;
    const x = event?.nativeEvent.pageX ?? 0;
    const y = event?.nativeEvent.pageY ?? 0;
    await persistGameEvent(session.id, { type: 'tap', itemId: activeItem.id, correct, at: now, x, y, hintLevelAtTap: hintLevel as 0 | 1 | 2 | 3 | 4, solvedUnassisted: correct && !hadWrong && !usedHelp && attempts === 0 }); setAttempts(nextAttempts);
    if (!correct) { setHadWrong(true); await showHint(); return; }
    const result = hadWrong ? 'incorrect' : usedHelp ? 'supported' : 'independent';
    const latency = Math.max(0, (now - session.startedAt) / 1000);
    const outcome: SessionOutcome = { scoredActions: nextAttempts, successRate: 1 / nextAttempts, unassistedRate: result === 'independent' ? 1 : 0, medianLatencySeconds: result === 'independent' ? latency : null, wasAbandoned: false, unassistedLatencies: result === 'independent' ? [latency] : [], successfulScoredActions: 1, unassistedScoredActions: result === 'independent' ? 1 : 0 };
    await refresh();
    const completed = [...completedPromptKeys, `${activeItem.id}:${mode}`];
    setCompletedPromptKeys(completed);
    // A round is every active familiar memory in each of the three recall forms.
    // Prefer a different memory and a different prompt form so one person is
    // never presented three times in a row when the library has alternatives.
    const remainingPrompts = (await listWhosWhoItems()).filter((item) => !item.learningOnly).flatMap((item) => recallModes.map((recallMode) => ({ item, recallMode }))).filter(({ item, recallMode }) => !completed.includes(`${item.id}:${recallMode}`));
    const nextPrompt = remainingPrompts.find(({ item, recallMode }) => item.id !== activeItem.id && recallMode !== mode) ?? remainingPrompts.find(({ item }) => item.id !== activeItem.id) ?? remainingPrompts[0];
    if (!nextPrompt) {
      await finishWhosWhoSession(session, outcome);
      setSession(null);
      // There is no spacing gate in the prototype. Start a fresh, mixed round
      // immediately, while still keeping the existing review fields untouched.
      const nextRoundPrompts = (await listWhosWhoItems()).filter((item) => !item.learningOnly).flatMap((item) => recallModes.map((recallMode) => ({ item, recallMode })));
      const nextRoundPrompt = nextRoundPrompts.find(({ item, recallMode }) => item.id !== activeItem.id && recallMode !== mode) ?? nextRoundPrompts.find(({ item }) => item.id !== activeItem.id) ?? nextRoundPrompts[0];
      if (!nextRoundPrompt) { setScreen('patient'); return; }
      setCompletedPromptKeys([]); setActiveItemId(nextRoundPrompt.item.id); setPendingRecallMode(nextRoundPrompt.recallMode); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setHintLevel(0); setAttempts(0);
      if (!nextRoundPrompt.item.learnedAt) setScreen('learning'); else await beginRecall(nextRoundPrompt.item, nextRoundPrompt.recallMode, true);
      return;
    }
    setActiveItemId(nextPrompt.item.id); setPendingRecallMode(nextPrompt.recallMode); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setHintLevel(0); setAttempts(0);
    if (!nextPrompt.item.learnedAt) setScreen('learning'); else await beginRecall(nextPrompt.item, nextPrompt.recallMode);
  };
  const leaveActivity = async () => { if (session) await abandonWhosWhoSession(session); setSession(null); setAnswerState('idle'); setScreen('patient'); await refresh(); };
  const goBack = useCallback(() => {
    if (screen === 'recall' || screen === 'learning') { void leaveActivity(); return true; }
    if (screen === 'skill-invitation' || screen === 'skill-active') { void leaveSkillSession(); return true; }
    if (screen === 'skill-complete') { void finishSkillSession('patient'); return true; }
    const destinations: Partial<Record<Screen, Screen>> = { onboarding: 'language', login: 'language', dashboard: 'language', manager: 'dashboard', editor: 'manager', daysPlanEditor: 'dashboard', daysPlan: 'patient', patient: 'language', waiting: 'patient', metrics: 'dashboard', 'skills-manager': 'dashboard', 'skills-home': 'patient' };
    const destination = destinations[screen];
    if (!destination) return false;
    setArchiveCandidate(null); setNotice(''); setScreen(destination);
    return true;
  }, [screen, session, activeItem, activitySession, activeSkill, skillDurationMs, completionPhotoUri]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => listener.remove();
  }, [goBack]);
  const currentHint = activeItem ? hintMessage(activeItem, hintLevel) : null;
  if (!ready) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.body}>Preparing your local memory library…</Text></View></SafeAreaView>;
  if (screen === 'language') return <Layout><Header title={copy.chooseLanguage} eyebrow={seed.app.tagline} /><Text style={styles.body}>{copy.chooseLanguageHint}</Text><View style={styles.stack}>{seed.languagePacks.map((pack) => <ActionButton key={pack.id} label={`${pack.nativeLabel} · ${pack.label}`} onPress={() => setLanguageId(pack.id)} variant={languageId === pack.id ? 'primary' : 'secondary'} />)}</View><Notice>{`${language.label} voice prompts can be used offline.`}</Notice><View style={styles.stack}><ActionButton label={copy.continue} onPress={() => setScreen('onboarding')} /><ActionButton label={copy.guardianSignIn} onPress={() => { setAuthMode('signIn'); setNotice(''); setScreen('login'); }} variant="quiet" /><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /></View></Layout>;
  if (screen === 'onboarding') return <Layout><Header title={copy.guardianSetup} eyebrow="Step 1 of 2" onBack={goBack} /><Text style={styles.body}>Set up the care circle. Family media stays on this device.</Text><View style={styles.stack}><Field label={copy.guardianName} value={setup.guardianName} onChangeText={(guardianName) => setSetup({ ...setup, guardianName })} /><Field label={copy.relationship} value={setup.relationship} onChangeText={(relationship) => setSetup({ ...setup, relationship })} /><Field label={copy.patientName} value={setup.patientName} onChangeText={(patientName) => setSetup({ ...setup, patientName })} /></View>{notice ? <Notice tone="support">{notice}</Notice> : null}<ActionButton label={busy ? 'Setting up…' : copy.continue} onPress={async () => { const { data } = await supabase?.auth.getUser() ?? { data: null }; if (!data?.user) { setAuthMode('signUp'); setScreen('login'); } else if (await createCareCircle()) setScreen('dashboard'); }} disabled={busy} /></Layout>;
  if (screen === 'login') return <Layout><Header title={authMode === 'signIn' ? copy.signInTitle : copy.createAccountTitle} onBack={goBack} /><Text style={styles.body}>{authMode === 'signIn' ? copy.signInHint : copy.createAccountHint}</Text><View style={styles.stack}><Field label={copy.email} value={login.email} onChangeText={(email) => setLogin({ ...login, email })} placeholder="name@example.com" /><Field label={copy.password} value={login.password} onChangeText={(password) => setLogin({ ...login, password })} secureTextEntry placeholder="At least 8 characters" /></View>{notice ? <Notice tone="support">{notice}</Notice> : null}<ActionButton label={busy ? (authMode === 'signIn' ? copy.signingIn : copy.creatingAccount) : authMode === 'signIn' ? copy.signIn : copy.createAccount} onPress={authenticate} disabled={busy} /><ActionButton label={authMode === 'signIn' ? copy.needAccount : copy.alreadyHaveAccount} onPress={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setNotice(''); }} variant="quiet" /><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /></Layout>;
  if (screen === 'metrics') return <Layout><Header title="Who’s Who insights" eyebrow={copy.dashboardTitle} onBack={goBack} /><CaregiverMetrics patientId={patientId} locale={language.label} /></Layout>;
  if (screen === 'daysPlanEditor') return <Layout><Header title="Prepare today’s plan" eyebrow={copy.dashboardTitle} onBack={goBack} /><DaysPlanEditor items={daysPlanItems} onSave={saveDaysPlan} onCancel={() => setScreen('dashboard')} /></Layout>;
  if (screen === 'daysPlan') return <Layout patient><Header title="Today’s plan" eyebrow="Saathi" onBack={goBack} /><DaysPlanActivity items={daysPlanItems} patientName={patientDisplayName} controllerState={daysPlanController} onExit={() => setScreen('patient')} onPhaseStart={beginDaysPlan} onEvent={recordDaysPlanEvent} onComplete={finishDaysPlan} onAbandon={abandonDaysPlan} /></Layout>;
  if (screen === 'dashboard') return <Layout><Header title={copy.dashboardTitle} eyebrow={`${setup.guardianName} · ${setup.relationship}`} onBack={goBack} /><Notice>Photos, voice notes, learning history, and review schedules are stored locally first.</Notice><View style={styles.panel}><Text style={styles.overline}>MEMORY LIBRARY</Text><Text style={styles.panelTitle}>{copy.whosWhoTitle}</Text><Text style={styles.body}>{`${items.length} active familiar memories are ready for gentle practice.`}</Text><ActionButton label="Who’s Who insights" onPress={() => setScreen('metrics')} variant="secondary" /><ActionButton label={copy.manageWhosWho} onPress={() => setScreen('manager')} /></View><View style={styles.panel}><Text style={styles.overline}>TODAY</Text><Text style={styles.panelTitle}>Day’s Plan</Text><Text style={styles.body}>Prepare familiar moments for the patient’s morning and evening.</Text><ActionButton label="Prepare today’s plan" onPress={() => setScreen('daysPlanEditor')} variant="secondary" /></View><View style={styles.panel}><Text style={styles.overline}>FAMILY SKILLS</Text><Text style={styles.panelTitle}>{copy.skillTransmissionTitle}</Text><Text style={styles.body}>{`${skills.filter((item) => item.enabled && isPlayableSkill(item.catalogKey)).length} ${copy.skillReadyCount}`}</Text><ActionButton label={copy.manageSkills} onPress={() => { setNotice(''); setScreen('skills-manager'); }} /></View><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /><ActionButton label={copy.signOut} onPress={async () => { await supabase?.auth.signOut(); setScreen('language'); }} variant="quiet" /></Layout>;
  if (screen === 'skills-manager') return <Layout><Header title={copy.skillTransmissionTitle} eyebrow={copy.dashboardTitle} onBack={goBack} /><Text style={styles.body}>{copy.skillsManagerHint}</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.stack}>{skills.map((item) => <SkillManagerCard key={item.id} item={item} title={skillTitle(item)} prompt={skillPrompt(item)} available={isPlayableSkill(item.catalogKey)} labels={{ voicePrompt: copy.voicePrompt, enable: copy.enableSkill, disable: copy.disableSkill, recordToEnable: copy.recordToEnable, hearAgain: copy.hearAgain, interactionComingSoon: copy.interactionComingSoon, audio: audioCaptureLabels }} onAudioCaptured={(uri) => captureSkillPrompt(item, uri)} onToggle={() => toggleSkill(item)} onProblem={setNotice} />)}</View><View style={styles.sharedMoments}><Text style={styles.overline}>{copy.sharedMoments}</Text>{skillCompletions.some((entry) => entry.photoUri) ? <View style={styles.momentGrid}>{skillCompletions.filter((entry) => entry.photoUri).map((entry) => { const item = skills.find((skill) => skill.id === entry.itemId); return <View key={entry.id} style={styles.momentCard}><Image source={{ uri: entry.photoUri ?? undefined }} accessibilityLabel={item ? skillTitle(item) : copy.sharedMoments} style={styles.momentPhoto} /><Text style={styles.momentTitle}>{item ? skillTitle(item) : copy.sharedMoments}</Text><Text style={styles.momentDate}>{`${copy.sharedOn} ${new Date(entry.completedAt).toLocaleDateString()}`}</Text></View>; })}</View> : <Text style={styles.body}>{copy.noSharedMoments}</Text>}</View><ActionButton label={copy.dashboardTitle} onPress={() => setScreen('dashboard')} variant="quiet" /></Layout>;
  if (screen === 'manager') return <Layout><Header title={copy.whosWhoTitle} eyebrow={copy.dashboardTitle} onBack={goBack} /><Text style={styles.body}>New memories always begin with Learning before any recall question.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}{archiveCandidate ? <View style={styles.archive}><Text style={styles.panelTitle}>Archive {archiveCandidate.name}?</Text><Text style={styles.body}>This is reversible. The memory will be hidden from patient activities.</Text><ActionButton label="Archive memory" onPress={archive} variant="secondary" /><ActionButton label="Keep memory" onPress={() => setArchiveCandidate(null)} variant="quiet" /></View> : null}<ActionButton label={copy.addPerson} onPress={() => openEditor()} />{items.length ? <View style={styles.stack}>{items.map((item) => <MemberRow key={item.id} member={item} onEdit={() => openEditor(item)} onArchive={() => setArchiveCandidate(item)} labels={{ edit: copy.editPerson, archive: copy.archive, learningOnly: copy.learningOnly }} />)}</View> : <Notice>Add a familiar person, place, or object to begin.</Notice>}<ActionButton label={copy.dashboardTitle} onPress={() => setScreen('dashboard')} variant="quiet" /></Layout>;
  if (screen === 'editor') return <Layout><Header title={editor.id ? copy.editPerson : copy.addPerson} eyebrow={copy.whosWhoTitle} onBack={goBack} /><Text style={styles.body}>Choose a photo and record the name and optional personal note in a familiar voice.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.photo}><Portrait uri={editor.photoUri ?? undefined} name={editor.name || copy.photo} size={150} /><ActionButton label={editor.photoUri ? 'Choose another photo' : 'Choose a photo'} onPress={selectPhoto} variant="secondary" /></View><View style={styles.stack}><Field label={copy.name} value={editor.name} onChangeText={(name) => setEditor((value) => ({ ...value, name }))} /><Field label={copy.memberRelationship} value={editor.relationship} onChangeText={(relationship) => setEditor((value) => ({ ...value, relationship }))} /><Field label={copy.personalNote} value={editor.personalNote} onChangeText={(personalNote) => setEditor((value) => ({ ...value, personalNote }))} multiline /></View><View style={styles.stack}><AudioCapture label={copy.nameAudio} uri={editor.nameAudioUri} onCaptured={(nameAudioUri) => setEditor((value) => ({ ...value, nameAudioUri }))} onProblem={setNotice} /><AudioCapture label={copy.noteAudio} uri={editor.noteAudioUri} onCaptured={(noteAudioUri) => setEditor((value) => ({ ...value, noteAudioUri }))} onProblem={setNotice} /></View><ActionButton label={editor.learningOnly ? 'Learning only: on' : 'Learning only: off'} onPress={() => setEditor((value) => ({ ...value, learningOnly: !value.learningOnly }))} variant="secondary" /><ActionButton label={copy.saveMemory} onPress={saveMemory} /><ActionButton label={copy.cancel} onPress={() => setScreen('manager')} variant="quiet" /></Layout>;
  if (screen === 'learning' && activeItem) return <Layout patient><Header title={`${copy.meet} ${activeItem.name}`} eyebrow={copy.whosWhoTitle} /><View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={250} /><Text style={styles.frameName}>{activeItem.name}</Text><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View><AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} /><ActionButton label={copy.practiceNow} onPress={practice} /><ActionButton label={copy.home} onPress={leaveActivity} variant="quiet" /></Layout>;
  if (screen === 'recall' && activeItem) return <Layout patient><Header title={mode === 'photo-to-name' ? copy.chooseName : mode === 'name-to-photo' ? copy.choosePhotoForName : copy.choosePhotoForClue} eyebrow={copy.whosWhoTitle} />{mode === 'photo-to-name' ? <View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={230} /></View> : mode === 'name-to-photo' ? <View style={styles.prompt}><Text style={styles.frameName}>{activeItem.name}</Text></View> : <View style={styles.prompt}><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View>}<AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} onReplay={replay} /><View style={mode === 'photo-to-name' ? styles.stack : styles.photoChoices}>{choices.map((item) => mode === 'photo-to-name' ? <ActionButton key={item.id} label={item.name} onPress={(event) => answer(item.id, event)} variant={answerState === 'support' && item.id === activeItem.id ? 'secondary' : 'primary'} /> : <PhotoAnswer key={item.id} item={item} onPress={(event) => answer(item.id, event)} />)}</View>{hintLevel < 4 ? <ActionButton label={copy.showClue} onPress={() => { void showHint(); }} variant="secondary" /> : null}{answerState === 'support' && currentHint ? <View style={styles.hint}><Notice tone="support">{currentHint}</Notice>{hintLevel >= 3 ? <AudioReplay uri={activeItem.noteAudioUri ?? activeItem.nameAudioUri} label={copy.hearThisMemory} onReplay={replay} /> : null}</View> : null}{answerState === 'complete' ? <Notice>{copy.gentleConfirm}</Notice> : null}<ActionButton label={answerState === 'complete' ? copy.backToActivity : copy.home} onPress={leaveActivity} variant={answerState === 'complete' ? 'primary' : 'quiet'} /></Layout>;
  if (screen === 'waiting') return <Layout patient><Header title={copy.waitingTitle} eyebrow={copy.whosWhoTitle} onBack={goBack} /><View style={styles.waiting}><Text style={styles.panelTitle}>{copy.waitingTitle}</Text><Text style={styles.body}>{copy.waitingHint}</Text>{waitingUntil ? <Text style={styles.relationship}>{copy.nextReview}: {new Date(waitingUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : null}</View><ActionButton label={copy.returnHome} onPress={() => { setWaitingUntil(null); setScreen('patient'); }} /></Layout>;
  if (screen === 'skills-home') return <Layout patient><Header title={copy.chooseSkill} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><View style={styles.stack}>{skills.filter((item) => item.enabled && item.promptAudioUri && isPlayableSkill(item.catalogKey)).map((item) => <PatientSkillCard key={item.id} item={item} title={skillTitle(item)} prompt={skillPrompt(item)} onPress={() => { void openSkill(item); }} />)}</View><View style={styles.sharedMoments}><Text style={styles.overline}>{copy.sharedMoments}</Text>{skillCompletions.some((entry) => entry.photoUri) ? <View style={styles.momentGrid}>{skillCompletions.filter((entry) => entry.photoUri).map((entry) => { const item = skills.find((skill) => skill.id === entry.itemId); return <View key={entry.id} style={styles.momentCard}><Image source={{ uri: entry.photoUri ?? undefined }} accessibilityLabel={item ? skillTitle(item) : copy.sharedMoments} style={styles.momentPhoto} /><Text style={styles.momentTitle}>{item ? skillTitle(item) : copy.sharedMoments}</Text><Text style={styles.momentDate}>{`${copy.sharedOn} ${new Date(entry.completedAt).toLocaleDateString()}`}</Text></View>; })}</View> : <Text style={styles.body}>{copy.noSharedMoments}</Text>}</View><ActionButton label={copy.home} onPress={() => setScreen('patient')} variant="quiet" /></Layout>;
  if (screen === 'skill-invitation' && activeSkill) return <Layout patient><Header title={copy.skillInvitation} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><View style={styles.skillFrame}><SkillIllustration skill={activeSkill.catalogKey} label={skillTitle(activeSkill)} size={250} /><Text style={styles.frameName}>{skillTitle(activeSkill)}</Text><Text style={styles.note}>{skillPrompt(activeSkill)}</Text></View><AudioReplay uri={activeSkill.promptAudioUri} label={copy.hearAgain} onReplay={replaySkillPrompt} /><ActionButton label={copy.letsBegin} onPress={() => { void beginSkillActivity(); }} /><ActionButton label={copy.home} onPress={() => { void leaveSkillSession(); }} variant="quiet" /></Layout>;
  if (screen === 'skill-active' && activeSkill) return <Layout patient><Header title={copy.doingTogether} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><Text style={styles.frameName}>{skillTitle(activeSkill)}</Text><Text style={styles.note}>{copy.elderLeads}</Text><SkillInteraction key={`${activitySession?.id}:${activeSkill.id}`} skill={activeSkill.catalogKey} labels={{ laceInstruction: copy.laceInstruction, laceLeft: copy.laceLeft, laceRight: copy.laceRight, makeBow: copy.makeBow, foldLeft: copy.foldLeft, foldRight: copy.foldRight, foldAgain: copy.foldAgain, buttonInstruction: copy.buttonInstruction, buttonLabel: copy.buttonLabel, dragHint: copy.dragHint, swipeHint: copy.swipeHint, brushWash: copy.brushWash, brushCap: copy.brushCap, brushPaste: copy.brushPaste, brushClean: copy.brushClean, brushRinse: copy.brushRinse, toothbrush: copy.toothbrush, toothpasteCap: copy.toothpasteCap, toothpaste: copy.toothpaste }} onComplete={() => { void markSkillComplete(); }} /><AudioReplay uri={activeSkill.promptAudioUri} label={copy.hearAgain} onReplay={replaySkillPrompt} /><ActionButton label={copy.home} onPress={() => { void leaveSkillSession(); }} variant="quiet" /></Layout>;
  if (screen === 'skill-complete' && activeSkill) return <Layout patient><Header title={copy.sharedTogether} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><View style={styles.skillFrame}><SkillIllustration skill={activeSkill.catalogKey} label={skillTitle(activeSkill)} size={220} completed /><Text style={styles.frameName}>{copy.sharedTogether}</Text>{completionPhotoUri ? <Image source={{ uri: completionPhotoUri }} accessibilityLabel={copy.photoSaved} style={styles.completionPhoto} /> : <Text style={styles.note}>{copy.photoOptional}</Text>}</View>{notice ? <Notice>{notice}</Notice> : null}{!completionPhotoUri ? <ActionButton label={copy.addCompletionPhoto} onPress={() => { void captureCompletionPhoto(); }} variant="secondary" /> : null}<ActionButton label={copy.chooseAnotherSkill} onPress={() => { void finishSkillSession('skills-home'); }} /><ActionButton label={copy.returnHome} onPress={() => { void finishSkillSession('patient'); }} variant="quiet" /></Layout>;
  // Prototype mode: review pause state must not hide the activity from the
  // patient home screen. Only guardian-marked learning-only memories stay out.
  const playableMemories = items.filter((item) => !item.learningOnly).length;
  const enabledSkills = skills.filter((item) => item.enabled && item.promptAudioUri && isPlayableSkill(item.catalogKey));
  return <Layout patient><View style={styles.patientHead}><View><Text style={styles.greeting}>{copy.patientGreeting}{patientDisplayName ? ',' : ''}</Text>{patientDisplayName ? <Text style={styles.patientName}>{patientDisplayName}</Text> : null}</View><View style={styles.people}><Portrait name={patientDisplayName || 'Patient'} size={68} /><Portrait name={setup.guardianName || 'Caregiver'} size={68} /></View></View><Text style={styles.section}>Choose an activity</Text><View style={styles.stack}><View style={styles.game}><Text style={styles.overline}>{copy.ready}</Text><Text style={styles.panelTitle}>Day’s Plan</Text><Text style={styles.body}>A calm look at the familiar moments in your day.</Text><ActionButton label="Open today’s plan" onPress={() => setScreen('daysPlan')} /></View><View style={styles.game}><Text style={styles.overline}>{copy.ready}</Text><Text style={styles.panelTitle}>{copy.whosWhoTitle}</Text><Text style={styles.body}>{playableMemories >= 2 ? copy.familiarMemoriesReady : playableMemories === 1 ? copy.oneMemoryReady : copy.caregiverAddMemory}</Text><ActionButton label={copy.continue} onPress={openActivity} disabled={playableMemories < 1} /></View>{enabledSkills.length ? <View style={styles.game}><Text style={styles.overline}>{copy.ready}</Text><Text style={styles.panelTitle}>{copy.skillTransmissionTitle}</Text><Text style={styles.body}>{enabledSkills.length === 1 ? copy.skillReadyOne : `${enabledSkills.length} ${copy.skillReadyCount}`}</Text><ActionButton label={copy.continue} onPress={() => setScreen('skills-home')} /></View> : null}</View>{notice ? <Notice>{notice}</Notice> : null}<ActionButton label={copy.caregiverArea} onPress={() => { setAuthMode('signIn'); setNotice(''); setScreen('login'); }} variant="quiet" /></Layout>;
}

const styles = StyleSheet.create({
  photoChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }, hint: { gap: 10 }, backButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }, backText: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  photoAnswer: { alignItems: 'center', width: 156, minHeight: 198, padding: 12, gap: 10, borderRadius: theme.radius.media, borderWidth: 2, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white },
  photoAnswerText: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800', textAlign: 'center' }, waiting: { alignItems: 'center', gap: 16, padding: 28, backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf, borderWidth: 1, borderRadius: theme.radius.media }, skillFrame: { alignItems: 'center', gap: 16, padding: 22, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, completionPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft }, sharedMoments: { gap: 14, padding: 18, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, momentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' }, momentCard: { width: '47%', gap: 6 }, momentPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.control, backgroundColor: theme.colors.leafSoft }, momentTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' }, momentDate: { color: theme.colors.mutedInk, fontSize: theme.type.meta },
  pressed: { opacity: .82, transform: [{ scale: .99 }] },
  safe: { flex: 1, backgroundColor: theme.colors.canvas }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }, scroll: { padding: theme.spacing.page, gap: theme.spacing.gap, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' }, patientScroll: { paddingBottom: 48 }, stack: { gap: 14 }, header: { gap: 10 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.leaf }, markText: { color: theme.colors.white, fontWeight: '800', fontSize: 18 }, brandText: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' }, eyebrow: { color: theme.colors.mutedInk, fontSize: theme.type.meta, fontWeight: '700', letterSpacing: .4 }, title: { color: theme.colors.ink, fontSize: 32, fontWeight: '800', lineHeight: 40 }, body: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 27 }, panel: { padding: 22, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft, borderWidth: 1, borderColor: theme.colors.leaf }, archive: { padding: 18, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.amberSoft, borderWidth: 1, borderColor: theme.colors.amber }, overline: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: .7 }, panelTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' }, photo: { alignItems: 'center', padding: 18, gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media }, patientHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, people: { flexDirection: 'row', gap: 8 }, greeting: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall }, patientName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', lineHeight: 46 }, reminder: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 20, gap: 8 }, reminderTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, section: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, game: { backgroundColor: theme.colors.white, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 20, gap: 10 }, frame: { alignItems: 'center', gap: 10, padding: 22, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, frameName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', textAlign: 'center' }, relationship: { color: theme.colors.leaf, fontSize: theme.type.patient, fontWeight: '700' }, note: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 26, textAlign: 'center' }, prompt: { alignItems: 'center', padding: 28, gap: 8, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media },
});
