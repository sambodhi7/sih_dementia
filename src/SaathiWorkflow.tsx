import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RecipeGame } from './games/recipe/RecipeGame';
import { getRecipeCopy } from './games/recipe/copy';
import { ActivityIndicator, BackHandler, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import type { ControllerState, GameEvent, SessionOutcome } from './services/adaptive/types';
import { whosWhoChoiceIds, whosWhoOptionCount } from './services/adaptive/whosWhoPresentation';
import { AudioCapture, AudioReplay } from './components/audio';
import { ListenButton } from './components/speech';
import { VoiceGameLauncher } from './components/VoiceGameLauncher';
import { LanguagePackDownload } from './components/LanguagePackDownload';
import { CaregiverMetrics } from './components/CaregiverMetrics';
import { DaysPlanActivity, DaysPlanEditor } from './components/daysPlan';
import { ActionButton, Field, MemberRow, Notice, Portrait } from './components/ui';
import { seed } from './data/seed';
import { translations } from './data/translations';
import { supabase } from './lib/supabase';
import { pickAndPersistPhoto } from './storage/media';
import { readRoutine, removeRoutineItem, saveRoutine } from './storage/routines';
import type { RoutineItem } from './storage/routines';
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
import { getBundledSpeechPage, speechLanguageCodeFromAppId, speechTextFor } from './speech/packRegistry';
import { formatPackMegabytes, speechPackForAppLanguage } from './speech/catalog';
import { downloadLanguagePack, getLanguagePackStatus, languagePackDirectory } from './speech/packStorage';
import { configureSpeechRuntime } from './speech/nativeRuntime';
import { resolveOfflineVoiceNavigation } from './speech/recognition';
import { voiceCommandsFor } from './speech/voiceCommands';
import type { DownloadableSpeechPack, SpeechPackManifest, SpeechPackStatus } from './speech/types';
import type { VoiceNavigationResponse } from './services/voice-navigation/types';
import { isVoiceNavigationConfigured, resolveVoiceNavigation } from './services/voice-navigation/client';
import { matchVoiceIntent } from './services/voice-navigation/matcher';
import { SpeechGuideProvider, useAutoReadText, useSpeechGuide } from './speech/guide';
import { stopSpeaking } from './speech/runtime';

type Screen = 'recipes' | 'language' | 'onboarding' | 'login' | 'dashboard' | 'manager' | 'editor' | 'daysPlanEditor' | 'daysPlan' | 'patient' | 'learning' | 'recall' | 'waiting' | 'skills-manager' | 'skills-home' | 'skill-invitation' | 'skill-active' | 'skill-complete' | 'metrics' | 'routineManager';
type MemberTab = 'home' | 'routine' | 'settings';
type CaregiverTab = 'games' | 'insights' | 'settings';
type Editor = WhosWhoDraft & { id?: string };
type RecallMode = 'photo-to-name' | 'name-to-photo' | 'clue-to-photo';
type CareProfile = { guardianName: string; relationship: string; patientName: string };
type ExitPromptControls = { showExitPrompt: () => void };
const ExitPromptContext = createContext<ExitPromptControls>({ showExitPrompt: () => undefined });
type DashboardScreen = 'dashboard' | 'patient';
const copy = seed.app.copy;
const recallModes: RecallMode[] = ['photo-to-name', 'name-to-photo', 'clue-to-photo'];
const gameCovers = {
  whosWho: require('../assets/images/game-covers/whos-who-cover.png'),
  recipe: require('../assets/images/game-covers/recipe-cover.png'),
  daysPlan: require('../assets/images/game-covers/days-plan-cover.png'),
  familySkills: require('../assets/images/game-covers/family-skills-cover.png'),
};
const appIcon = require('../assets/images/branding/saathi-app-icon.png');
const emptyEditor = (): Editor => ({ name: '', relationship: '', personalNote: '', photoUri: null, nameAudioUri: null, noteAudioUri: null, learningOnly: false });
const localInviteCode = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(-6);
};
const timeFromValue = (value: string) => { const [hour = 8, minute = 0] = value.split(':').map(Number); const date = new Date(); date.setHours(hour, minute, 0, 0); return date; };
const timeValue = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function authProblemMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  if (normalized.includes('invalid login credentials')) return 'That email and password do not match an account. You can create a guardian account if this is your first time.';
  if (normalized.includes('email not confirmed')) return 'Please confirm the email link first, then sign in again.';
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Saathi could not reach the account service. Check the phone internet connection and try again.';
  return copy.accountProblem;
}

function PhotoAnswer({ item, onPress, label }: { item: WhosWhoItem; onPress: (event: GestureResponderEvent) => void; label?: string }) {
  const { speakAction } = useSpeechGuide();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Photo option: ${item.name}`} onPress={(event) => { touchFeedback(); speakAction(item.name); onPress(event); }} style={({ pressed }) => [styles.photoAnswer, pressed && styles.pressed]}><Portrait uri={item.photoUri ?? undefined} name={item.name} size={132} /><Text style={styles.photoAnswerText}>{label ?? copy.chooseThisPhoto}</Text></Pressable>;
}

function LeafMark({ size = 34 }: { size?: number }) {
  const leafSize = Math.round(size * 0.66);
  const leafHeight = Math.round(leafSize * 1.28);
  const leafLeft = Math.round((size - leafSize) / 2);
  const leafTop = Math.round((size - leafHeight) / 2);
  return <View accessible={false} style={[styles.leafMark, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.leafBlade, { width: leafSize, height: leafHeight, borderRadius: leafSize, left: leafLeft, top: leafTop }]} />
    <View style={[styles.leafVein, { height: Math.round(leafSize * 0.86), left: Math.round(size / 2) - 1, top: Math.round(size * 0.2) }]} />
  </View>;
}

function AppMark({ size = 64 }: { size?: number }) {
  return <Image accessibilityLabel="Saathi" source={appIcon} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

function Header({ title, eyebrow, onBack, copy }: { title: string; eyebrow?: string; onBack?: () => void; copy?: any }) {
  const { speakAction } = useSpeechGuide();
  const backLabel = copy?.back ?? 'Back';
  useAutoReadText([eyebrow, title].filter(Boolean).join('. '), `header:${eyebrow ?? ''}:${title}`);
  return <View style={styles.header}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={8} onPress={() => { touchFeedback(); speakAction(backLabel); onBack(); }} style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}><Text style={styles.backText}>{`‹ ${backLabel}`}</Text></Pressable> : null}{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>;
}

function GameCover({ source, label }: { source: number; label: string }) {
  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={styles.gameCoverFrame}>
      <Image source={source} accessible={false} resizeMode="cover" style={styles.gameCover} />
    </View>
  );
}

function Layout({ children, patient = false, footer, dashboard = false, floating }: { children: React.ReactNode; patient?: boolean; footer?: React.ReactNode; dashboard?: boolean; floating?: ReactNode; onBack?: () => void; backLabel?: string }) {
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={theme.colors.canvas} /><ScrollView contentContainerStyle={[styles.scroll, styles.scrollCompact, dashboard && styles.dashboardScroll, patient && styles.patientScroll, footer ? styles.scrollWithFooter : null]} keyboardShouldPersistTaps="handled">{children}</ScrollView>{floating ? <View style={styles.floatingVoice}>{floating}</View> : null}{footer ? <View style={styles.fixedFooter}>{footer}</View> : null}</SafeAreaView>;
}

function DashboardBottomNav({ active, onChange, tabs }: { active: string; onChange: (tab: string) => void; tabs: ReadonlyArray<readonly [string, string]> }) {
  const { speakAction } = useSpeechGuide();
  return <View style={styles.memberNav} accessibilityRole="tablist">
    {tabs.map(([id, label]) => <Pressable key={id} hitSlop={4} accessibilityRole="tab" accessibilityState={{ selected: active === id }} onPress={() => { touchFeedback(); speakAction(label); onChange(id); }} style={({ pressed }) => [styles.memberNavItem, active === id && styles.memberNavItemActive, pressed && styles.pressed]}><Text style={[styles.memberNavText, active === id && styles.memberNavTextActive]}>{label}</Text></Pressable>)}
  </View>;
}

function SpeechPackProgress({ pack, status, busy, problem, progress, copy }: { pack: DownloadableSpeechPack | null; status: SpeechPackStatus; busy: boolean; problem: boolean; progress: number; copy: any }) {
  if (!pack || status === 'ready') return null;
  return <LanguagePackDownload state={busy ? 'downloading' : problem ? 'error' : Platform.OS === 'web' ? 'unavailable' : status} progress={progress} size={formatPackMegabytes(pack.totalBytes)} copy={{ title: copy.speechPackTitle, description: copy.speechPackDescription, ready: copy.speechPackReady, system: copy.systemVoice, unavailable: copy.speechPackUnavailable, downloading: copy.downloadingPack, failed: copy.downloadFailed }} />;
}

function MemberDashboard({ tab, setTab, languageId, copy, routine, playableMemories, onOpenActivity, onOpenRecipes = () => undefined, onChangeLanguage, onSignOut, onOpenDaysPlan, onOpenSkills, skillsAvailable, notice, onTabChange, speechProgressCard, voiceLauncher }: { tab: MemberTab; setTab: (tab: MemberTab) => void; languageId: string; copy: any; routine: RoutineItem[]; playableMemories: number; onOpenActivity: () => void; onOpenRecipes?: () => void; onChangeLanguage: () => void; onSignOut: () => void; onOpenDaysPlan: () => void; onOpenSkills: () => void; skillsAvailable: boolean; notice: string; onTabChange: (title: string) => void; speechProgressCard?: ReactNode; voiceLauncher?: ReactNode }) {
  const upcoming = [...routine].sort((a, b) => a.time.localeCompare(b.time));
  const speechLanguageCode = speechLanguageCodeFromAppId(languageId);
  const speechPageId = tab === 'home' ? 'member.games' : tab === 'routine' ? 'member.routine' : 'member.settings';
  const speechPage = speechLanguageCode ? getBundledSpeechPage(speechLanguageCode, speechPageId) : null;
  const pageSpeechText = speechPage ? speechTextFor(speechPage) : '';
  useAutoReadText(pageSpeechText, `member:${speechPageId}:${languageId}`);
  useEffect(() => { onTabChange(tab === 'home' ? copy.gamesTab : tab === 'routine' ? copy.routineTab : copy.settingsTab); }, [copy.gamesTab, copy.routineTab, copy.settingsTab, onTabChange, tab]);
  const listenCard = (groupId: string) => speechPage ? <ListenButton text={speechTextFor(speechPage, groupId)} languageCode={speechPage.languageCode} label={copy.listenCard} stopLabel={copy.stopListening} /> : null;
  return <Layout patient dashboard floating={voiceLauncher} footer={<DashboardBottomNav active={tab} onChange={(nextTab) => setTab(nextTab as MemberTab)} tabs={[['home', copy.gamesTab], ['routine', copy.routineTab], ['settings', copy.settingsTab]]} />}>
    {speechProgressCard}
    {notice ? <Notice>{notice}</Notice> : null}
    {tab === 'home' ? <>
      <Text style={styles.body}>{copy.chooseActivityToday}</Text>
      <View style={[styles.game, styles.gameCardReady]}><GameCover source={gameCovers.whosWho} label={copy.whosDescription} /><Text style={styles.overline}>{copy.memoryActivity}</Text><Text style={styles.panelTitle}>Who's Who</Text><Text style={styles.body}>{playableMemories ? copy.whosDescription : copy.caregiverAddDescription}</Text>{listenCard('whos-who')}<ActionButton label={copy.openWhosWho} onPress={onOpenActivity} disabled={!playableMemories} /></View>
      <View style={styles.game}><GameCover source={gameCovers.recipe} label={copy.recipeDescription} /><Text style={styles.overline}>{copy.familiarActivity}</Text><Text style={styles.panelTitle}>Recipe</Text><Text style={styles.body}>{copy.recipeDescription}</Text>{listenCard('recipe')}<ActionButton label={copy.openRecipe} onPress={onOpenRecipes} /></View>
      <View style={styles.game}><GameCover source={gameCovers.daysPlan} label={copy.daysPlanDescription} /><Text style={styles.overline}>{copy.todayLabel}</Text><Text style={styles.panelTitle}>Day's Plan</Text><Text style={styles.body}>{copy.daysPlanDescription}</Text>{listenCard('days-plan')}<ActionButton label={copy.openDaysPlan} onPress={onOpenDaysPlan} /></View>
      {skillsAvailable ? <View style={styles.game}><GameCover source={gameCovers.familySkills} label={copy.skillsDescription} /><Text style={styles.overline}>{copy.familySkillsLabel}</Text><Text style={styles.panelTitle}>Learn Together</Text><Text style={styles.body}>{copy.skillsDescription}</Text>{listenCard('skills')}<ActionButton label={copy.chooseSkill} onPress={onOpenSkills} /></View> : null}
      <Text style={styles.patientSectionTitle}>{copy.upNext}</Text>{upcoming.slice(0, 2).map((item) => <View key={item.id} style={styles.routineRow}><Text style={styles.routineTime}>{item.time}</Text><View style={styles.routineCopy}><Text style={styles.routineTitle}>{item.title}</Text><Text style={styles.routineDetail}>{item.detail}</Text></View></View>)}
    </> : null}
    {tab === 'routine' ? <><Notice>{copy.routineIntro}</Notice><View style={styles.stack}>{upcoming.map((item) => <View key={item.id} style={[styles.routineRow, item.kind === 'medication' && styles.medicationRow]}><Text style={styles.routineTime}>{item.time}</Text><View style={styles.routineCopy}><Text style={styles.routineTitle}>{item.title}</Text><Text style={styles.routineDetail}>{item.detail}</Text>{item.kind === 'medication' ? <Text style={styles.medicationLabel}>{copy.medicationReminder}</Text> : null}</View></View>)}</View></> : null}
    {tab === 'settings' ? <><View style={styles.memberSettingsPanel}><Text style={styles.panelTitle}>{copy.comfortAccess}</Text><Text style={styles.body}>{copy.comfortDescription}</Text><ActionButton label={copy.changeLanguage} onPress={onChangeLanguage} variant="secondary" /></View><View style={styles.memberSettingsPanel}><Text style={styles.settingsLabel}>{copy.aboutSaathi}</Text><Text style={styles.settingsValue}>{copy.privateLocal}</Text><Text style={styles.body}>{copy.privacyDescription}</Text></View><View style={styles.signOutAction}><ActionButton label={copy.signOut} onPress={onSignOut} variant="danger" /></View></> : null}
  </Layout>;
}

function hintMessage(item: WhosWhoItem, level: number): string | null {
  if (level === 1) return copy.hintTakeTime;
  if (level === 2) return `${copy.hintThinkOf} ${item.relationship}.`;
  if (level === 3) return item.personalNote || copy.hintListenTogether;
  if (level >= 4) return `${copy.hintReveal} ${item.name}. ${copy.hintTapWhenReady}`;
  return null;
}

function SaathiWorkflowContent({ roleTarget, onRoleTargetHandled, onDashboardChange }: { roleTarget: DashboardScreen | null; onRoleTargetHandled: () => void; onDashboardChange: (screen: DashboardScreen | null, title?: string) => void }) {
  const { showExitPrompt } = useContext(ExitPromptContext);
  const { setLanguageCode } = useSpeechGuide();
  const [screenStack, setScreenStack] = useState<Screen[]>(['language']);
  const screen = screenStack[screenStack.length - 1];
  const setScreen = useCallback((next: Screen) => {
    setScreenStack((current) => {
      if (next === 'login') return ['login'];
      if (current[current.length - 1] === next) return current;
      const existingIndex = current.lastIndexOf(next);
      return existingIndex >= 0 ? current.slice(0, existingIndex + 1) : [...current, next];
    });
  }, []);
  const replaceScreen = useCallback((next: Screen) => {
    setScreenStack((current) => [...current.slice(0, -1), next]);
  }, []);
  const resetScreen = useCallback((next: Screen) => setScreenStack([next]), []);
  const returnToScreen = useCallback((next: Screen) => {
    setScreenStack((current) => {
      const destinationIndex = current.lastIndexOf(next);
      return destinationIndex >= 0 ? current.slice(0, destinationIndex + 1) : [next];
    });
  }, []);
  const [languageReturnScreen, setLanguageReturnScreen] = useState<Screen>('login');
  const [ready, setReady] = useState(false);
  const [languageId, setLanguageId] = useState(seed.languagePacks[0].id);
  const [items, setItems] = useState<WhosWhoItem[]>([]);
  const [patientId, setPatientId] = useState(seed.patient.id);
  const [setup, setSetup] = useState<CareProfile>({ guardianName: seed.guardian.name, relationship: seed.guardian.relationship, patientName: seed.patient.name });
  const inviteCode = setup.patientName.trim() ? localInviteCode(patientId) : '—';
  const [login, setLogin] = useState({ email: 'demo@saathi.local', password: 'saathi-demo' });
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [loginRole, setLoginRole] = useState<'caretaker' | 'patient'>('patient');
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
  const [memberTab, setMemberTab] = useState<MemberTab>('home');
  const [caregiverTab, setCaregiverTab] = useState<CaregiverTab>('games');
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [routineDraft, setRoutineDraft] = useState({ title: '', detail: '', time: '08:00', kind: 'medication' as RoutineItem['kind'] });
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [speechPackStatus, setSpeechPackStatus] = useState<SpeechPackStatus>('not-installed');
  const [speechPackProgress, setSpeechPackProgress] = useState(0);
  const [speechPackBusy, setSpeechPackBusy] = useState(false);
  const [speechPackProblem, setSpeechPackProblem] = useState(false);
  const [recipeBackRequest, setRecipeBackRequest] = useState(0);
  const voiceBackRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    if (!roleTarget) return;
    setNotice('');
    resetScreen(roleTarget);
    onRoleTargetHandled();
  }, [onRoleTargetHandled, resetScreen, roleTarget]);

  useEffect(() => {
    const title = screen === 'dashboard'
      ? caregiverTab === 'games' ? 'Games' : caregiverTab === 'insights' ? 'Insights' : 'Settings'
      : screen === 'patient'
        ? memberTab === 'home' ? 'Games' : memberTab === 'routine' ? 'Routine' : 'Settings'
        : undefined;
    onDashboardChange(screen === 'dashboard' || screen === 'patient' ? screen : null, title);
  }, [caregiverTab, memberTab, onDashboardChange, screen]);

  useEffect(() => {
    if (notice !== 'Signed in.') return;
    const timeout = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const language = useMemo(() => seed.languagePacks.find((item) => item.id === languageId) ?? seed.languagePacks[0], [languageId]);
  // The restored language packs predate the newer activities. Keep their
  // localized strings while falling back to the current game copy for any
  // activity labels they do not yet translate.
  const copy = useMemo<any>(() => ({ ...seed.app.copy, ...(translations[languageId] ?? translations.english) }), [languageId]);
  useEffect(() => { setLanguageCode(speechLanguageCodeFromAppId(languageId) ?? 'en'); }, [languageId, setLanguageCode]);
  const selectedSpeechPack = useMemo(() => speechPackForAppLanguage(languageId), [languageId]);
  const caregiverSpeech = useMemo(() => {
    if (screen !== 'dashboard') return '';
    if (caregiverTab === 'games') return `${copy.gamesTab}. ${copy.prepareActivities}. ${copy.prepareActivitiesHint}. ${copy.manageWhosWho}. ${copy.prepareTodayPlan}. ${copy.manageSkills}.`;
    if (caregiverTab === 'insights') return `${copy.practiceInsights}. ${copy.insightsNotice}`;
    return `${copy.settingsTab}. ${copy.assignedMember}. ${setup.patientName || copy.noMemberAssigned}. ${copy.inviteId}. ${inviteCode === '—' ? copy.invitePending : copy.inviteInfo}.`;
  }, [caregiverTab, copy, inviteCode, screen, setup.patientName]);
  useAutoReadText(caregiverSpeech, `caregiver:${caregiverTab}:${languageId}`);
  useEffect(() => {
    let active = true;
    setSpeechPackProblem(false);
    setSpeechPackProgress(0);
    if (!selectedSpeechPack) { setSpeechPackStatus('not-installed'); return () => { active = false; }; }
    void getLanguagePackStatus(selectedSpeechPack).then((status) => { if (active) setSpeechPackStatus(status); });
    return () => { active = false; };
  }, [selectedSpeechPack]);
  useEffect(() => { void configureSpeechRuntime(languageId); }, [languageId]);
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
    const storedLanguageId = await getLocalSetting('language-id');
    if (seed.languagePacks.some((pack) => pack.id === storedLanguageId)) {
      setLanguageId(storedLanguageId!);
      resetScreen('login');
    }
    const stored = await getLocalSetting('patient-id'); const localPatientId = stored ?? patientId; if (stored) setPatientId(stored);
    const storedProfile = await getLocalSetting('care-profile');
    if (storedProfile) { try { setSetup(JSON.parse(storedProfile) as CareProfile); } catch { /* Ignore malformed local profile data. */ } }
    await initializeSkillTransmission(localPatientId); await loadDaysPlan(localPatientId); await refresh(localPatientId); setRoutine(await readRoutine()); setReady(true);
  })(); }, []);

  const updateRoutine = async (next: RoutineItem[]) => setRoutine(await saveRoutine(next));
  const addRoutineItem = async () => {
    if (!routineDraft.title.trim()) { setNotice('Add a clear reminder name first.'); return; }
    await updateRoutine([...routine, { id: `routine-${Date.now()}`, title: routineDraft.title.trim(), detail: routineDraft.detail.trim(), time: routineDraft.time, kind: routineDraft.kind }]);
    setRoutineDraft({ title: '', detail: '', time: '08:00', kind: 'medication' });
    setNotice('This reminder is saved on this device.');
  };

  const persistCareProfile = async (profile = setup) => setLocalSetting('care-profile', JSON.stringify(profile));
  const saveLanguage = async () => { await setLocalSetting('language-id', languageId); await configureSpeechRuntime(languageId); returnToScreen(languageReturnScreen); };
  const startSpeechPackDownload = async (pack: DownloadableSpeechPack) => {
    if (speechPackBusy || Platform.OS === 'web') return;
    setSpeechPackBusy(true);
    setSpeechPackProblem(false);
    try {
      await downloadLanguagePack(pack, ({ fraction }) => setSpeechPackProgress(fraction));
      setSpeechPackStatus('ready');
      await configureSpeechRuntime(pack.appLanguageId);
    } catch {
      setSpeechPackProblem(true);
    } finally {
      setSpeechPackBusy(false);
    }
  };
  const prepareSelectedLanguage = async () => {
    const packToDownload = selectedSpeechPack;
    await saveLanguage();
    if (packToDownload && speechPackStatus !== 'ready') void startSpeechPackDownload(packToDownload);
  };
  const openVoiceIntent = async (result: VoiceNavigationResponse): Promise<string> => {
    if (result.intent === 'start_whos_who') { void openActivity(); return `${copy.voiceOpening} Who's Who`; }
    if (result.intent === 'start_recipe') { setScreen('recipes'); return `${copy.voiceOpening} Recipe`; }
    if (result.intent === 'start_days_plan') { setScreen('daysPlan'); return `${copy.voiceOpening} Day's Plan`; }
    if (result.intent === 'start_skills') { setScreen('skills-home'); return `${copy.voiceOpening} Learn Together`; }
    if (result.intent === 'go_home') {
      if (screen === 'recipes') setRecipeBackRequest((request) => request + 1);
      else voiceBackRef.current();
      return languageId === 'hindi' ? 'वापस जा रहे हैं' : languageId === 'bengali' ? 'ফিরে যাচ্ছি' : 'Going back';
    }
    return copy.voiceProblem;
  };
  const openVoiceTranscript = async (transcript: string): Promise<string> => {
    const languageCode = speechLanguageCodeFromAppId(languageId) ?? 'en';
    return openVoiceIntent(matchVoiceIntent(transcript, voiceCommandsFor(languageCode), 0.62));
  };
  const openVoiceSelectedGame = async (audioUri: string): Promise<string> => {
    const pack = selectedSpeechPack;
    const languageCode = speechLanguageCodeFromAppId(languageId) ?? 'en';
    const directory = pack ? languagePackDirectory(pack.languageCode) : null;
    if ((!pack || !directory || speechPackStatus !== 'ready') && isVoiceNavigationConfigured) {
      const result = await resolveVoiceNavigation({ clientThreadId: `saathi-${patientId}`, clientMessageId: `voice-${Date.now()}`, patientId, languageCode, audioUri });
      const resolved = result.intent === 'unknown' && result.transcript ? matchVoiceIntent(result.transcript, voiceCommandsFor(languageCode), 0.62) : result;
      return openVoiceIntent(resolved);
    }
    if (!pack || !directory || speechPackStatus !== 'ready') return copy.voiceProblem;
    const manifest: SpeechPackManifest = {
      schemaVersion: 1,
      id: `saathi-${languageCode}-voice-v1`,
      languageCode,
      displayName: pack.displayName,
      models: {
        tts: { engine: 'sherpa-onnx-vits', model: 'models/tts/model.onnx', tokens: 'models/tts/tokens.txt' },
        stt: { engine: 'sherpa-onnx-ctc', model: 'models/stt/model.int8.onnx', tokens: 'models/stt/tokens.txt' },
      },
      pages: ['member.games', 'member.routine', 'member.settings'],
      commands: voiceCommandsFor(languageCode),
    };
    const nativeSttDirectory = `${decodeURIComponent(directory.replace(/^file:\/\//, ''))}models/stt`;
    const result = await resolveOfflineVoiceNavigation(audioUri, nativeSttDirectory, manifest);
    return openVoiceIntent(result);
  };
  const openLanguageSettings = (returnScreen: Screen) => { setLanguageReturnScreen(returnScreen); setNotice(''); setScreen('language'); };

  const createCareCircle = async () => {
    if (!supabase) { setNotice(copy.authUnavailable); return false; }
    const { data, error } = await supabase.functions.invoke<{ patientId: string }>('create-care-circle', { body: { patientDisplayName: setup.patientName.trim(), relationshipToPatient: setup.relationship.trim(), preferredLanguageCode: language.id, patientTimezone: 'Asia/Kolkata' } });
    if (error || !data?.patientId) { setNotice(copy.accountProblem); return false; }
    setPatientId(data.patientId); await setLocalSetting('patient-id', data.patientId); await persistCareProfile(); await initializeSkillTransmission(data.patientId); await loadDaysPlan(data.patientId); await refresh(data.patientId); return true;
  };

  const authenticate = async () => {
    setBusy(true); setNotice('');
    try {
      setNotice('Signed in.');
      resetScreen(loginRole === 'patient' ? 'patient' : 'dashboard');
    } finally { setBusy(false); }
  };

  const saveMemory = async () => {
    if (!editor.name.trim() || !editor.relationship.trim()) { setNotice(copy.requiredNotice); return; }
    await saveWhosWhoItem(patientId, editor, editor.id); await refresh(); setNotice(editor.id ? 'Memory changes saved on this device.' : copy.addedNotice); returnToScreen('manager');
  };
  const selectPhoto = async () => { try { const uri = await pickAndPersistPhoto(editor.id ?? `draft-${Date.now()}`); if (uri) setEditor((value) => ({ ...value, photoUri: uri })); } catch { setNotice('The photo could not be saved. Please try again.'); } };
  const openEditor = (item?: WhosWhoItem) => { setNotice(''); setEditor(item ? { id: item.id, name: item.name, relationship: item.relationship, personalNote: item.personalNote, photoUri: item.photoUri, nameAudioUri: item.nameAudioUri, noteAudioUri: item.noteAudioUri, learningOnly: item.learningOnly } : emptyEditor()); setScreen('editor'); };
  const archive = async () => { if (!archiveCandidate) return; await archiveWhosWhoItem(archiveCandidate.id); setArchiveCandidate(null); await refresh(); setNotice('This memory is now hidden from patient activities.'); };
  const saveDaysPlan = async (nextItems: DaysPlanItem[]) => { setDaysPlanItems(await saveDaysPlanItems(patientId, nextItems)); setNotice('Today’s plan is saved on this device.'); returnToScreen('dashboard'); };
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
    setSkillStartedAt(startedAt); replaceScreen('skill-active');
  };
  const markSkillComplete = async () => {
    if (!activitySession || !activeSkill || !skillStartedAt) return;
    const durationMs = Math.max(0, Date.now() - skillStartedAt);
    await persistEngagementEvent(activitySession.id, { type: 'activity_completed', itemId: activeSkill.id, durationMs, at: Date.now() });
    setSkillDurationMs(durationMs); replaceScreen('skill-complete');
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
    setActivitySession(null); setSkillStartedAt(null); setSkillDurationMs(0); setCompletionPhotoUri(null); setActiveSkillId(null); setNotice(''); returnToScreen(destination);
  };
  const leaveSkillSession = async (destination: 'patient' | 'skills-home' = 'patient') => {
    if (activitySession) await interruptSkillTransmissionSession(activitySession);
    setActivitySession(null); setSkillStartedAt(null); setSkillDurationMs(0); setCompletionPhotoUri(null); setActiveSkillId(null); setNotice(''); returnToScreen(destination);
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
  const beginRecall = async (item: WhosWhoItem, requestedMode?: RecallMode, forceNewSession = false, replaceCurrent = false) => {
    // A practice round is one session. This gives the controller a meaningful
    // batch of mixed prompts instead of treating each card as a full session.
    const started = forceNewSession ? await startWhosWhoSession(patientId, item.id) : session ?? await startWhosWhoSession(patientId, item.id);
    await persistGameEvent(started.id, { type: 'prompt_shown', itemId: item.id, at: Date.now() });
    // New memories start with the familiar photo. Later reviews rotate name and
    // relationship/personal-note prompts without changing the per-item schedule.
    const nextMode = requestedMode ?? (item.reviewStep < 0 ? 'photo-to-name' : item.reviewStep % 3 === 0 ? 'name-to-photo' : item.reviewStep % 3 === 1 ? 'clue-to-photo' : 'photo-to-name');
    if (!session || forceNewSession) setControllerState(await readControllerState(patientId, 'whos_who'));
    setSession(started); setMode(nextMode); setAnswerState('idle'); setHintLevel(0); (replaceCurrent ? replaceScreen : setScreen)('recall');
  };
  const practice = async () => { if (!activeItem) return; await markLearningExposure(activeItem.id); await refresh(); await beginRecall(activeItem, pendingRecallMode, false, true); };
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
      if (!nextRoundPrompt) { returnToScreen('patient'); return; }
      setCompletedPromptKeys([]); setActiveItemId(nextRoundPrompt.item.id); setPendingRecallMode(nextRoundPrompt.recallMode); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setHintLevel(0); setAttempts(0);
      if (!nextRoundPrompt.item.learnedAt) replaceScreen('learning'); else await beginRecall(nextRoundPrompt.item, nextRoundPrompt.recallMode, true, true);
      return;
    }
    setActiveItemId(nextPrompt.item.id); setPendingRecallMode(nextPrompt.recallMode); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setHintLevel(0); setAttempts(0);
    if (!nextPrompt.item.learnedAt) replaceScreen('learning'); else await beginRecall(nextPrompt.item, nextPrompt.recallMode, false, true);
  };
  const leaveActivity = async () => { if (session) await abandonWhosWhoSession(session); setSession(null); setAnswerState('idle'); returnToScreen('patient'); await refresh(); };
  const goBack = useCallback(() => {
    if (screen === 'recall' || screen === 'learning') { void leaveActivity(); return true; }
    if (screen === 'skill-invitation' || screen === 'skill-active') { void leaveSkillSession('skills-home'); return true; }
    if (screen === 'skill-complete') { void finishSkillSession('skills-home'); return true; }
    if (screen === 'daysPlan') {
      void (async () => { await abandonDaysPlan(); returnToScreen('patient'); })();
      return true;
    }
    if (screenStack.length <= 1) { showExitPrompt(); return true; }
    setArchiveCandidate(null); setNotice('');
    setScreenStack((current) => current.length > 1 ? current.slice(0, -1) : current);
    return true;
  }, [screen, screenStack.length, session, activeItem, activitySession, activeSkill, skillDurationMs, completionPhotoUri, daysPlanSession, returnToScreen, showExitPrompt]);
  voiceBackRef.current = goBack;
  useEffect(() => {
    if (screen === 'recipes') return undefined;
    const listener = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => listener.remove();
  }, [goBack, screen]);
  const handleMemberTabChange = useCallback((title: string) => onDashboardChange('patient', title), [onDashboardChange]);
  const currentHint = activeItem ? hintMessage(activeItem, hintLevel) : null;
  const voiceLanguageCode = speechLanguageCodeFromAppId(languageId) ?? 'en';
  const voiceAvailable = ['en', 'hi', 'bn'].includes(voiceLanguageCode) && (Platform.OS === 'web' || isVoiceNavigationConfigured || speechPackStatus === 'ready');
  const voiceLauncher = voiceAvailable ? <VoiceGameLauncher languageCode={voiceLanguageCode} copy={{ ask: copy.voiceAsk, example: copy.voiceExample, start: copy.voiceStart, listening: copy.voiceListening, stop: copy.voiceStop, processing: copy.voiceProcessing, permission: copy.voicePermission, problem: copy.voiceProblem, close: copy.voiceClose }} onAudio={openVoiceSelectedGame} onTranscript={openVoiceTranscript} /> : undefined;
  if (!ready) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.body}>{copy.preparingLibrary}</Text></View></SafeAreaView>;
  if (screen === 'metrics') return <Layout><Header copy={copy} title={copy.practiceInsights} eyebrow={copy.dashboardTitle} onBack={goBack} /><CaregiverMetrics patientId={patientId} locale={language.dateFormatter} /></Layout>;
  if (screen === 'language') return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.canvas} />
      <Image source={require('../assets/images/ne_pattern_top.png')} style={styles.bgTop} />
      <Image source={require('../assets/images/ne_pattern_bottom.png')} style={styles.bgBottom} />
      <ScrollView contentContainerStyle={[styles.scroll, { zIndex: 1 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.languageHeader}>
          <AppMark />
          <Text style={styles.appName}>Saathi</Text>
          <Text style={styles.languageTitle}>{copy.languageHeading}</Text>
        </View>
        <View style={styles.stack}>
          {seed.languagePacks.map((pack) => (
            <Pressable
              key={pack.id}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => { if (!speechPackBusy) setLanguageId(pack.id); }}
              disabled={speechPackBusy}
              accessibilityState={{ selected: languageId === pack.id, disabled: speechPackBusy }}
              style={({ pressed }) => [
                styles.languageOption,
                languageId === pack.id && styles.languageOptionSelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.languageOptionText, languageId === pack.id && styles.languageOptionTextSelected]}>
                {`${pack.nativeLabel} · ${pack.label}`}
              </Text>
            </Pressable>
          ))}
        </View>
        <LanguagePackDownload
          state={speechPackBusy ? 'downloading' : speechPackProblem ? 'error' : selectedSpeechPack ? Platform.OS === 'web' ? 'unavailable' : speechPackStatus : 'system'}
          progress={speechPackProgress}
          size={selectedSpeechPack ? formatPackMegabytes(selectedSpeechPack.totalBytes) : undefined}
          copy={{ title: copy.speechPackTitle, description: copy.speechPackDescription, ready: copy.speechPackReady, system: copy.systemVoice, unavailable: copy.speechPackUnavailable, downloading: copy.downloadingPack, failed: copy.downloadFailed }}
        />
        <View style={[styles.stack, { marginTop: 24 }]}>
          <ActionButton
            label={copy.continue}
            onPress={() => { setAuthMode('signIn'); setNotice(''); void prepareSelectedLanguage(); }}
            disabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  if (screen === 'onboarding') return <Layout backLabel={copy.back} onBack={goBack}><Header copy={copy} title={copy.guardianSetup} onBack={goBack} /><Text style={styles.body}>{copy.setupCareCircleHint}</Text><View style={styles.stack}><Field label={copy.guardianName} value={setup.guardianName} onChangeText={(guardianName) => setSetup({ ...setup, guardianName })} /><Field label={copy.relationship} value={setup.relationship} onChangeText={(relationship) => setSetup({ ...setup, relationship })} /><Field label={copy.patientName} value={setup.patientName} onChangeText={(patientName) => setSetup({ ...setup, patientName })} /></View>{notice ? <Notice tone="support">{notice}</Notice> : null}<ActionButton label={busy ? copy.settingUp : copy.continue} onPress={async () => { const { data } = await supabase?.auth.getUser() ?? { data: null }; if (!data?.user) { setAuthMode('signUp'); setScreen('login'); } else if (await createCareCircle()) setScreen('dashboard'); }} disabled={busy} /></Layout>;
  if (screen === 'login') return (
    <Layout backLabel="Back" onBack={goBack}>
      <View style={styles.loginBrand}>
        <AppMark />
        <Text style={styles.appName}>Saathi</Text>
      </View>
      <Header copy={copy} title={authMode === 'signIn' ? copy.signInTitle : copy.createAccountTitle} />
      <View style={styles.toggleContainer}>
        <Pressable onPress={() => setLoginRole('patient')} style={[styles.toggleOption, loginRole === 'patient' && styles.toggleOptionActive]} accessibilityRole="button">
          <Text style={[styles.toggleText, loginRole === 'patient' && styles.toggleTextActive]}>{copy.memberRole}</Text>
        </Pressable>
        <Pressable onPress={() => setLoginRole('caretaker')} style={[styles.toggleOption, loginRole === 'caretaker' && styles.toggleOptionActive]} accessibilityRole="button">
          <Text style={[styles.toggleText, loginRole === 'caretaker' && styles.toggleTextActive]}>{copy.caregiverRole}</Text>
        </Pressable>
      </View>
      <View style={styles.stack}>
        <Field label={copy.email} value={login.email} onChangeText={(email) => setLogin({ ...login, email })} placeholder="name@example.com" />
        <Field label={copy.password} value={login.password} onChangeText={(password) => setLogin({ ...login, password })} secureTextEntry placeholder={copy.passwordHint} />
      </View>
      {notice ? <Notice tone="support">{notice}</Notice> : null}
      <ActionButton
        label={busy ? (authMode === 'signIn' ? copy.signingIn : copy.creatingAccount) : authMode === 'signIn' ? copy.signIn : copy.createAccount}
        onPress={() => { void authenticate(); }}
        disabled={busy}
      />
      <ActionButton label={authMode === 'signIn' ? copy.needAccount : copy.alreadyHaveAccount} onPress={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setNotice(''); }} variant="quiet" />
    </Layout>
  );
  if (screen === 'routineManager') return <Layout><Header copy={copy} title="Daily routine and reminders" eyebrow="Caregiver Area" onBack={goBack} /><Text style={styles.body}>Medication reminders are saved and scheduled on this device. Check each medicine name and dose with the prescription before saving.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.stack}>{routine.map((item) => <View key={item.id} style={[styles.routineRow, item.kind === 'medication' && styles.medicationRow]}><Text style={styles.routineTime}>{item.time}</Text><View style={styles.routineCopy}><Text style={styles.routineTitle}>{item.title}</Text><Text style={styles.routineDetail}>{item.detail || 'No extra note.'}</Text><Text style={styles.medicationLabel}>{item.kind === 'medication' ? 'Medication alarm' : 'Routine reminder'}</Text></View><ActionButton label="Remove" onPress={async () => { setRoutine(await removeRoutineItem(routine, item.id)); }} variant="quiet" compact /></View>)}</View><View style={styles.settingsPanel}><Text style={styles.panelTitle}>Add a reminder</Text><Field label="Reminder name" value={routineDraft.title} onChangeText={(title) => setRoutineDraft((value) => ({ ...value, title }))} placeholder="For example, morning medicine" /><Field label="Instructions" value={routineDraft.detail} onChangeText={(detail) => setRoutineDraft((value) => ({ ...value, detail }))} placeholder="For example, take after breakfast" multiline /><Text style={styles.fieldLabel}>Reminder time</Text><ActionButton label={`Choose time: ${routineDraft.time}`} onPress={() => setTimePickerVisible(true)} variant="secondary" />{timePickerVisible ? <DateTimePicker value={timeFromValue(routineDraft.time)} mode="time" display="default" onChange={(_event, selectedTime) => { setTimePickerVisible(false); if (selectedTime) setRoutineDraft((value) => ({ ...value, time: timeValue(selectedTime) })); }} /> : null}<ActionButton label={routineDraft.kind === 'medication' ? 'Type: medication' : 'Type: routine'} onPress={() => setRoutineDraft((value) => ({ ...value, kind: value.kind === 'medication' ? 'activity' : 'medication' }))} variant="secondary" /><ActionButton label="Save local reminder" onPress={() => { void addRoutineItem(); }} /></View></Layout>;
  if (screen === 'dashboard') return <Layout dashboard footer={<DashboardBottomNav active={caregiverTab} onChange={(nextTab) => setCaregiverTab(nextTab as CaregiverTab)} tabs={[['games', copy.gamesTab], ['insights', copy.practiceInsights], ['settings', copy.settingsTab]]} />}>
    <SpeechPackProgress pack={selectedSpeechPack} status={speechPackStatus} busy={speechPackBusy} problem={speechPackProblem} progress={speechPackProgress} copy={copy} />
    {caregiverTab === 'games' ? <>
      <View style={styles.caregiverIntro}><Text style={styles.overline}>{copy.careDashboard}</Text><Text style={styles.panelTitle}>{copy.prepareActivities}</Text><Text style={styles.body}>{copy.prepareActivitiesHint}</Text></View>
      <View style={styles.caregiverGameRow}><View style={styles.caregiverGameCopy}><Text style={styles.overline}>{copy.memoryLibrary}</Text><Text style={styles.caregiverGameTitle}>{copy.whosWhoTitle}</Text><Text style={styles.body}>{items.length ? `${items.length} ${copy.memoriesReady}` : copy.noMemories}</Text></View><ActionButton label={copy.manageWhosWho} onPress={() => setScreen('manager')} variant="secondary" /></View>
      <View style={styles.caregiverGameRow}><View style={styles.caregiverGameCopy}><Text style={styles.overline}>{copy.dailyRoutineLabel}</Text><Text style={styles.caregiverGameTitle}>Day’s Plan</Text><Text style={styles.body}>{copy.prepareMoments}</Text></View><ActionButton label={copy.prepareTodayPlan} onPress={() => setScreen('daysPlanEditor')} variant="secondary" /></View>
      <View style={styles.caregiverGameRow}><View style={styles.caregiverGameCopy}><Text style={styles.overline}>{copy.familySkillsLabel}</Text><Text style={styles.caregiverGameTitle}>{copy.skillTransmissionTitle}</Text><Text style={styles.body}>{skills.filter((item) => item.enabled && isPlayableSkill(item.catalogKey)).length ? `${skills.filter((item) => item.enabled && isPlayableSkill(item.catalogKey)).length} ${copy.activitiesReady}` : copy.noActivities}</Text></View><ActionButton label={copy.manageSkills} onPress={() => { setNotice(''); setScreen('skills-manager'); }} variant="secondary" /></View>
    </> : null}
    {caregiverTab === 'insights' ? <><Notice>{copy.insightsNotice}</Notice><CaregiverMetrics patientId={patientId} locale={language.dateFormatter} /></> : null}
    {caregiverTab === 'settings' ? <><View style={styles.settingsPanel}><Text style={styles.panelTitle}>{copy.assignedMember}</Text><Text style={styles.body}>{copy.assignedFor}</Text><Text style={styles.settingsValue}>{setup.patientName || copy.noMemberAssigned}</Text></View><View style={styles.settingsPanel}><Text style={styles.panelTitle}>{copy.inviteId}</Text><Text style={styles.body}>{inviteCode === '—' ? copy.invitePending : copy.inviteInfo}</Text><Text selectable style={[styles.inviteId, inviteCode === '—' && styles.inviteIdUnavailable]}>{inviteCode}</Text></View><ActionButton label={copy.changeLanguage} onPress={() => openLanguageSettings('dashboard')} variant="secondary" /><ActionButton label={copy.dailyRoutineSettings} onPress={() => { setNotice(''); setScreen('routineManager'); }} variant="secondary" /><ActionButton label={copy.signOut} onPress={() => { setNotice(''); setScreen('login'); }} variant="danger" /></> : null}
  </Layout>;
  if (screen === 'daysPlanEditor') return <Layout><Header title="Prepare today’s plan" eyebrow={copy.dashboardTitle} onBack={goBack} /><DaysPlanEditor items={daysPlanItems} onSave={saveDaysPlan} onCancel={() => setScreen('dashboard')} languageId={languageId} /></Layout>;
  if (screen === 'daysPlan') return <Layout patient floating={voiceLauncher}><Header title="Today’s plan" eyebrow="Saathi" onBack={goBack} /><DaysPlanActivity items={daysPlanItems} patientName={patientDisplayName} controllerState={daysPlanController} onExit={() => setScreen('patient')} onPhaseStart={beginDaysPlan} onEvent={recordDaysPlanEvent} onComplete={finishDaysPlan} onAbandon={abandonDaysPlan} languageId={languageId} /></Layout>;
  if (screen === 'skills-manager') return <Layout><Header title={copy.skillTransmissionTitle} eyebrow={copy.dashboardTitle} onBack={goBack} /><Text style={styles.body}>{copy.skillsManagerHint}</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.stack}>{skills.map((item) => <SkillManagerCard key={item.id} item={item} title={skillTitle(item)} prompt={skillPrompt(item)} available={isPlayableSkill(item.catalogKey)} labels={{ voicePrompt: copy.voicePrompt, enable: copy.enableSkill, disable: copy.disableSkill, recordToEnable: copy.recordToEnable, hearAgain: copy.hearAgain, interactionComingSoon: copy.interactionComingSoon, audio: audioCaptureLabels }} onAudioCaptured={(uri) => captureSkillPrompt(item, uri)} onToggle={() => toggleSkill(item)} onProblem={setNotice} />)}</View><View style={styles.sharedMoments}><Text style={styles.overline}>{copy.sharedMoments}</Text>{skillCompletions.some((entry) => entry.photoUri) ? <View style={styles.momentGrid}>{skillCompletions.filter((entry) => entry.photoUri).map((entry) => { const item = skills.find((skill) => skill.id === entry.itemId); return <View key={entry.id} style={styles.momentCard}><Image source={{ uri: entry.photoUri ?? undefined }} accessibilityLabel={item ? skillTitle(item) : copy.sharedMoments} style={styles.momentPhoto} /><Text style={styles.momentTitle}>{item ? skillTitle(item) : copy.sharedMoments}</Text><Text style={styles.momentDate}>{`${copy.sharedOn} ${new Date(entry.completedAt).toLocaleDateString()}`}</Text></View>; })}</View> : <Text style={styles.body}>{copy.noSharedMoments}</Text>}</View><ActionButton label={copy.dashboardTitle} onPress={() => setScreen('dashboard')} variant="quiet" /></Layout>;
  if (screen === 'skills-home') return <Layout patient><Header title={copy.chooseSkill} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><View style={styles.stack}>{skills.filter((item) => item.enabled && item.promptAudioUri && isPlayableSkill(item.catalogKey)).map((item) => <PatientSkillCard key={item.id} item={item} title={skillTitle(item)} prompt={skillPrompt(item)} onPress={() => { void openSkill(item); }} />)}</View><View style={styles.sharedMoments}><Text style={styles.overline}>{copy.sharedMoments}</Text>{skillCompletions.some((entry) => entry.photoUri) ? <View style={styles.momentGrid}>{skillCompletions.filter((entry) => entry.photoUri).map((entry) => { const item = skills.find((skill) => skill.id === entry.itemId); return <View key={entry.id} style={styles.momentCard}><Image source={{ uri: entry.photoUri ?? undefined }} accessibilityLabel={item ? skillTitle(item) : copy.sharedMoments} style={styles.momentPhoto} /><Text style={styles.momentTitle}>{item ? skillTitle(item) : copy.sharedMoments}</Text><Text style={styles.momentDate}>{`${copy.sharedOn} ${new Date(entry.completedAt).toLocaleDateString()}`}</Text></View>; })}</View> : <Text style={styles.body}>{copy.noSharedMoments}</Text>}</View><ActionButton label={copy.home} onPress={() => setScreen('patient')} variant="quiet" /></Layout>;
  if (screen === 'skill-invitation' && activeSkill) return <Layout patient><Header copy={copy} title={copy.skillInvitation} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><View style={styles.skillFrame}><SkillIllustration skill={activeSkill.catalogKey} label={skillTitle(activeSkill)} size={250} /><Text style={styles.frameName}>{skillTitle(activeSkill)}</Text><Text style={styles.note}>{skillPrompt(activeSkill)}</Text></View><AudioReplay uri={activeSkill.promptAudioUri} label={copy.hearAgain} onReplay={replaySkillPrompt} /><ActionButton label={copy.letsBegin} onPress={() => { void beginSkillActivity(); }} /><ActionButton label={copy.home} onPress={() => { void leaveSkillSession(); }} variant="quiet" /></Layout>;
  if (screen === 'skill-active' && activeSkill) return <Layout patient><Header title={copy.doingTogether} eyebrow={copy.skillTransmissionTitle} onBack={goBack} /><Text style={styles.frameName}>{skillTitle(activeSkill)}</Text><Text style={styles.note}>{copy.elderLeads}</Text><SkillInteraction key={`${activitySession?.id}:${activeSkill.id}`} skill={activeSkill.catalogKey} labels={{ laceInstruction: copy.laceInstruction, laceLeft: copy.laceLeft, laceRight: copy.laceRight, makeBow: copy.makeBow, foldLeft: copy.foldLeft, foldRight: copy.foldRight, foldAgain: copy.foldAgain, buttonInstruction: copy.buttonInstruction, buttonLabel: copy.buttonLabel, dragHint: copy.dragHint, swipeHint: copy.swipeHint, brushWash: copy.brushWash, brushCap: copy.brushCap, brushPaste: copy.brushPaste, brushClean: copy.brushClean, brushRinse: copy.brushRinse, toothbrush: copy.toothbrush, toothpasteCap: copy.toothpasteCap, toothpaste: copy.toothpaste }} onComplete={() => { void markSkillComplete(); }} /><AudioReplay uri={activeSkill.promptAudioUri} label={copy.hearAgain} onReplay={replaySkillPrompt} /><ActionButton label={copy.home} onPress={() => { void leaveSkillSession(); }} variant="quiet" /></Layout>;
  if (screen === 'skill-complete' && activeSkill) return <Layout patient onBack={goBack} backLabel={copy.back}><Header title={copy.sharedTogether} eyebrow={copy.skillTransmissionTitle} /><View style={styles.skillFrame}><SkillIllustration skill={activeSkill.catalogKey} label={skillTitle(activeSkill)} size={220} completed /><Text style={styles.frameName}>{copy.sharedTogether}</Text>{completionPhotoUri ? <Image source={{ uri: completionPhotoUri }} accessibilityLabel={copy.photoSaved} style={styles.completionPhoto} /> : <Text style={styles.note}>{copy.photoOptional}</Text>}</View>{notice ? <Notice>{notice}</Notice> : null}{!completionPhotoUri ? <ActionButton label={copy.addCompletionPhoto} onPress={() => { void captureCompletionPhoto(); }} variant="secondary" /> : null}<ActionButton label={copy.chooseAnotherSkill} onPress={() => { void finishSkillSession('skills-home'); }} /><ActionButton label={copy.returnHome} onPress={() => { void finishSkillSession('patient'); }} variant="quiet" /></Layout>;
  if (screen === 'manager') return <Layout backLabel={copy.back} onBack={goBack}><Header copy={copy} title={copy.whosWhoTitle} eyebrow={copy.dashboardTitle} onBack={goBack} /><Text style={styles.body}>New memories always begin with Learning before any recall question.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}{archiveCandidate ? <View style={styles.archive}><Text style={styles.panelTitle}>Archive {archiveCandidate.name}?</Text><Text style={styles.body}>This is reversible. The memory will be hidden from member activities.</Text><ActionButton label="Archive memory" onPress={archive} variant="secondary" /><ActionButton label="Keep memory" onPress={() => setArchiveCandidate(null)} variant="quiet" /></View> : null}<ActionButton label={copy.addPerson} onPress={() => openEditor()} />{items.length ? <View style={styles.stack}>{items.map((item) => <MemberRow key={item.id} member={item} onEdit={() => openEditor(item)} onArchive={() => setArchiveCandidate(item)} labels={{ edit: copy.editPerson, archive: copy.archive, learningOnly: copy.learningOnly }} />)}</View> : <Notice>Add a familiar person, place, or object to begin.</Notice>}<ActionButton label={copy.dashboardTitle} onPress={() => setScreen('dashboard')} variant="quiet" /></Layout>;
  if (screen === 'editor') return <Layout backLabel={copy.back} onBack={goBack}><Header copy={copy} title={editor.id ? copy.editPerson : copy.addPerson} eyebrow={copy.whosWhoTitle} onBack={goBack} /><Text style={styles.body}>Choose a photo and record the name and optional personal note in a familiar voice.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.photo}><Portrait uri={editor.photoUri ?? undefined} name={editor.name || copy.photo} size={150} /><ActionButton label={editor.photoUri ? 'Choose another photo' : 'Choose a photo'} onPress={selectPhoto} variant="secondary" /></View><View style={styles.stack}><Field label={copy.name} value={editor.name} onChangeText={(name) => setEditor((value) => ({ ...value, name }))} /><Field label={copy.memberRelationship} value={editor.relationship} onChangeText={(relationship) => setEditor((value) => ({ ...value, relationship }))} /><Field label={copy.personalNote} value={editor.personalNote} onChangeText={(personalNote) => setEditor((value) => ({ ...value, personalNote }))} multiline /></View><View style={styles.stack}><AudioCapture label={copy.nameAudio} uri={editor.nameAudioUri} onCaptured={(nameAudioUri) => setEditor((value) => ({ ...value, nameAudioUri }))} onProblem={setNotice} /><AudioCapture label={copy.noteAudio} uri={editor.noteAudioUri} onCaptured={(noteAudioUri) => setEditor((value) => ({ ...value, noteAudioUri }))} onProblem={setNotice} /></View><ActionButton label={editor.learningOnly ? 'Learning only: on' : 'Learning only: off'} onPress={() => setEditor((value) => ({ ...value, learningOnly: !value.learningOnly }))} variant="secondary" /><ActionButton label={copy.saveMemory} onPress={saveMemory} /><ActionButton label={copy.cancel} onPress={() => setScreen('manager')} variant="quiet" /></Layout>;
  if (screen === 'learning' && activeItem) return <Layout patient backLabel={copy.back} onBack={goBack}><Header copy={copy} title={`${copy.meet} ${activeItem.name}`} eyebrow={copy.whosWhoTitle} /><View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={250} /><Text style={styles.frameName}>{activeItem.name}</Text><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View><AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} /><ActionButton label={copy.practiceNow} onPress={practice} /><ActionButton label={copy.home} onPress={leaveActivity} variant="quiet" /></Layout>;
  if (screen === 'recall' && activeItem) return <Layout patient backLabel={copy.back} onBack={goBack}><Header copy={copy} title={mode === 'photo-to-name' ? copy.chooseName : mode === 'name-to-photo' ? copy.choosePhotoForName : copy.choosePhotoForClue} eyebrow={copy.whosWhoTitle} />{mode === 'photo-to-name' ? <View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={230} /></View> : mode === 'name-to-photo' ? <View style={styles.prompt}><Text style={styles.frameName}>{activeItem.name}</Text></View> : <View style={styles.prompt}><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View>}<AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} onReplay={replay} /><View style={mode === 'photo-to-name' ? styles.stack : styles.photoChoices}>{choices.map((item) => mode === 'photo-to-name' ? <ActionButton key={item.id} label={item.name} onPress={(event) => answer(item.id, event)} variant={answerState === 'support' && item.id === activeItem.id ? 'secondary' : 'primary'} /> : <PhotoAnswer key={item.id} item={item} onPress={(event) => answer(item.id, event)} label={copy.chooseThisPhoto} />)}</View>{hintLevel < 4 ? <ActionButton label={copy.showClue} onPress={() => { void showHint(); }} variant="secondary" /> : null}{answerState === 'support' && currentHint ? <View style={styles.hint}><Notice tone="support">{currentHint}</Notice>{hintLevel >= 3 ? <AudioReplay uri={activeItem.noteAudioUri ?? activeItem.nameAudioUri} label={copy.hearThisMemory} onReplay={replay} /> : null}</View> : null}{answerState === 'complete' ? <Notice>{copy.gentleConfirm}</Notice> : null}<ActionButton label={answerState === 'complete' ? copy.backToActivity : copy.home} onPress={leaveActivity} variant={answerState === 'complete' ? 'primary' : 'quiet'} /></Layout>;
  if (screen === 'waiting') return <Layout patient backLabel={copy.back} onBack={goBack}><Header copy={copy} title={copy.waitingTitle} eyebrow={copy.whosWhoTitle} onBack={goBack} /><View style={styles.waiting}><Text style={styles.panelTitle}>{copy.waitingTitle}</Text><Text style={styles.body}>{copy.waitingHint}</Text>{waitingUntil ? <Text style={styles.relationship}>{copy.nextReview}: {new Date(waitingUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : null}</View><ActionButton label={copy.returnHome} onPress={() => { setWaitingUntil(null); setScreen('patient'); }} /></Layout>;
  const playableMemories = items.filter((item) => !item.learningOnly).length;
  const enabledSkills = skills.filter((item) => item.enabled && item.promptAudioUri && isPlayableSkill(item.catalogKey));
  if (screen === 'recipes') return <RecipeGame patientId={patientId} language={languageId} onHome={() => returnToScreen('patient')} voiceLauncher={voiceLauncher} backRequest={recipeBackRequest} />;
  if (screen === 'patient') {
    return <MemberDashboard tab={memberTab} setTab={setMemberTab} languageId={languageId} copy={copy} routine={routine} playableMemories={playableMemories} onOpenActivity={() => { void openActivity(); }} onOpenRecipes={() => setScreen('recipes')} onChangeLanguage={() => openLanguageSettings('patient')} onSignOut={() => { setNotice(''); setScreen('login'); }} onOpenDaysPlan={() => setScreen('daysPlan')} onOpenSkills={() => setScreen('skills-home')} skillsAvailable={enabledSkills.length > 0} notice={notice} onTabChange={handleMemberTabChange} speechProgressCard={<SpeechPackProgress pack={selectedSpeechPack} status={speechPackStatus} busy={speechPackBusy} problem={speechPackProblem} progress={speechPackProgress} copy={copy} />} voiceLauncher={voiceLauncher} />;
  }
  return null;
}

function AutoReadToggle() {
  const { enabled, setEnabled, speak, languageCode } = useSpeechGuide();
  const copy = languageCode === 'hi'
    ? { on: 'ऑटो सुनना चालू', off: 'ऑटो सुनना बंद', enabled: 'हर पेज अपने आप पढ़ा जाएगा।', visibleOn: 'ऑटो', visibleOff: 'सुनें' }
    : languageCode === 'bn'
      ? { on: 'অটো শোনা চালু', off: 'অটো শোনা বন্ধ', enabled: 'প্রতিটি পৃষ্ঠা স্বয়ংক্রিয়ভাবে পড়া হবে।', visibleOn: 'অটো', visibleOff: 'শুনুন' }
      : { on: 'Auto-read on', off: 'Auto-read off', enabled: 'Every page will now be read aloud.', visibleOn: 'Auto', visibleOff: 'Read' };
  const label = enabled ? copy.on : copy.off;
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} accessibilityLabel={label} onPress={() => { touchFeedback(); const next = !enabled; setEnabled(next); if (next) void speak(copy.enabled); else void stopSpeaking(); }} style={({ pressed }) => [styles.autoReadToggle, enabled && styles.autoReadToggleActive, pressed && styles.pressed]}><Text accessible={false} style={styles.autoReadIcon}>{enabled ? '🔊' : '🔈'}</Text><Text style={[styles.autoReadText, enabled && styles.autoReadTextActive]}>{enabled ? copy.visibleOn : copy.visibleOff}</Text></Pressable>;
}

function SaathiWorkflowShell() {
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const [roleTarget, setRoleTarget] = useState<DashboardScreen | null>(null);
  const [activeDashboard, setActiveDashboard] = useState<DashboardScreen>('dashboard');
  const [showRoleSwitch, setShowRoleSwitch] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('Games');
  const { speakAction } = useSpeechGuide();
  const handleDashboardChange = useCallback((screen: DashboardScreen | null, title?: string) => {
    if (screen) { setActiveDashboard(screen); setDashboardTitle(title ?? 'Dashboard'); setShowRoleSwitch(true); }
    else setShowRoleSwitch(false);
  }, []);
  return <ExitPromptContext.Provider value={{ showExitPrompt: () => setExitPromptVisible(true) }}>
    <View style={styles.appRoot}>
      {showRoleSwitch ? <SafeAreaView style={styles.dashboardHeaderSafe}><View style={styles.dashboardBar}><Text style={styles.dashboardBarTitle}>{dashboardTitle}</Text><View style={styles.dashboardTools}><AutoReadToggle /><Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${activeDashboard === 'patient' ? 'Caregiver' : 'Member'} dashboard`} onPress={() => { const target = activeDashboard === 'patient' ? 'Caregiver' : 'Member'; speakAction(target); setRoleTarget(activeDashboard === 'patient' ? 'dashboard' : 'patient'); }} style={({ pressed }) => [styles.dashboardRoleSwitch, pressed && styles.pressed]}><Text style={styles.roleSwitchText}>{activeDashboard === 'patient' ? 'Caregiver' : 'Member'}</Text></Pressable></View></View></SafeAreaView> : null}
      <SaathiWorkflowContent roleTarget={roleTarget} onRoleTargetHandled={() => setRoleTarget(null)} onDashboardChange={handleDashboardChange} />
    </View>
    <Modal transparent visible={exitPromptVisible} animationType="fade" onRequestClose={() => setExitPromptVisible(false)}>
      <View style={styles.exitScrim}>
        <View accessibilityViewIsModal style={styles.exitDialog}>
          <Text style={styles.overline}>SAATHI</Text>
          <Text style={styles.panelTitle}>Leave Saathi?</Text>
          <Text style={styles.body}>Your local changes stay safely on this device.</Text>
          <View style={styles.stack}>
            <ActionButton label="Leave app" onPress={() => BackHandler.exitApp()} />
            <ActionButton label="Stay here" onPress={() => setExitPromptVisible(false)} variant="secondary" />
          </View>
        </View>
      </View>
    </Modal>
  </ExitPromptContext.Provider>;
}

export default function SaathiWorkflow() {
  return <SpeechGuideProvider><SaathiWorkflowShell /></SpeechGuideProvider>;
}

const styles = StyleSheet.create({
  photoChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }, hint: { gap: 10 },
  photoAnswer: { alignItems: 'center', width: 156, minHeight: 198, padding: 12, gap: 10, borderRadius: theme.radius.media, borderWidth: 2, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white },
  photoAnswerText: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800', textAlign: 'center' }, waiting: { alignItems: 'center', gap: 16, padding: 28, backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf, borderWidth: 1, borderRadius: theme.radius.media }, skillFrame: { alignItems: 'center', gap: 16, padding: 22, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, completionPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft }, sharedMoments: { gap: 14, padding: 18, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, momentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' }, momentCard: { width: '47%', gap: 6 }, momentPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.control, backgroundColor: theme.colors.leafSoft }, momentTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' }, momentDate: { color: theme.colors.mutedInk, fontSize: theme.type.meta },
  pressed: { opacity: .82, transform: [{ scale: .99 }] },
  scrollCompact: { paddingTop: theme.spacing.page }, dashboardScroll: { paddingTop: theme.spacing.page },
  backButton: { position: 'absolute', top: 12, left: theme.spacing.page, zIndex: 2, minHeight: 64, justifyContent: 'center', paddingHorizontal: 8 },
  headerBackButton: { alignSelf: 'flex-start', minHeight: 64, justifyContent: 'center', paddingHorizontal: 8, marginLeft: -8 },
  backText: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  safe: { flex: 1, backgroundColor: theme.colors.canvas }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }, scroll: { padding: theme.spacing.page, paddingTop: 96, gap: theme.spacing.gap, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' }, scrollWithoutBack: { paddingTop: theme.spacing.page }, patientScroll: { paddingBottom: 48 }, stack: { gap: 14 }, header: { gap: 10 }, headerContainer: { gap: 12 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, leafMark: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.leaf, borderWidth: 2, borderColor: theme.colors.focus }, leafBlade: { position: 'absolute', backgroundColor: theme.colors.white, transform: [{ rotate: '-38deg' }] }, leafVein: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: theme.colors.leaf, transform: [{ rotate: '-38deg' }] }, brandText: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' }, eyebrow: { color: theme.colors.mutedInk, fontSize: theme.type.meta, fontWeight: '700', letterSpacing: .4 }, title: { color: theme.colors.ink, fontSize: 32, fontWeight: '800', lineHeight: 40 }, body: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 27 }, panel: { padding: 22, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft, borderWidth: 1, borderColor: theme.colors.leaf }, archive: { padding: 18, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.amberSoft, borderWidth: 1, borderColor: theme.colors.amber }, overline: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: .7 }, panelTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' }, photo: { alignItems: 'center', padding: 18, gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media }, patientHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, people: { flexDirection: 'row', gap: 8 }, greeting: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall }, patientName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', lineHeight: 46 }, reminder: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 20, gap: 8 }, reminderTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, section: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, game: { backgroundColor: theme.colors.white, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, paddingHorizontal: 20, paddingVertical: 16, gap: 8 }, frame: { alignItems: 'center', gap: 10, padding: 22, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, frameName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', textAlign: 'center' }, relationship: { color: theme.colors.leaf, fontSize: theme.type.patient, fontWeight: '700' }, note: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 26, textAlign: 'center' }, prompt: { alignItems: 'center', padding: 28, gap: 8, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media },
  languageHeader: { alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 18 },
  loginBrand: { alignItems: 'center', gap: 8, marginTop: 32 },
  scrollWithFooter: { paddingBottom: 124 },
  fixedFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.page, paddingTop: 6, paddingBottom: 8, backgroundColor: theme.colors.canvas },
  floatingVoice: { position: 'absolute', right: theme.spacing.page, bottom: 82, zIndex: 2 },
  memberNav: { flexDirection: 'row', gap: 8 },
  memberNavItem: { flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.white, paddingHorizontal: 6 },
  memberNavItemActive: { backgroundColor: theme.colors.leaf, borderColor: theme.colors.leaf },
  memberNavText: { color: theme.colors.ink, fontSize: theme.type.meta, fontWeight: '800', textAlign: 'center' },
  memberNavTextActive: { color: theme.colors.white },
  settingsPanel: { gap: 12, padding: 20, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  memberSettingsPanel: { gap: 10, padding: 16, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  settingsLabel: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: .7 },
  signOutAction: { marginTop: 8 },
  settingsValue: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800' },
  inviteId: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800', letterSpacing: 1.4 },
  inviteIdUnavailable: { color: theme.colors.mutedInk, letterSpacing: 0 },
  caregiverIntro: { gap: 8, paddingBottom: 4 },
  caregiverGameRow: { gap: 14, padding: 18, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.white },
  caregiverGameCopy: { gap: 6 },
  caregiverGameTitle: { color: theme.colors.ink, fontSize: 22, fontWeight: '800' },
  routineRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 18, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.white },
  medicationRow: { borderColor: theme.colors.amber, backgroundColor: theme.colors.amberSoft },
  routineTime: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800', minWidth: 52 },
  routineCopy: { flex: 1, gap: 4 },
  routineTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' },
  routineDetail: { color: theme.colors.mutedInk, fontSize: theme.type.meta, lineHeight: 22 },
  medicationLabel: { color: theme.colors.ink, fontSize: theme.type.meta, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' },
  gameCardReady: { borderColor: theme.colors.leaf, borderWidth: 2 },
  gameCoverFrame: {
    width: '100%',
    height: 144,
    borderRadius: theme.radius.control,
    overflow: 'hidden',
    backgroundColor: theme.colors.leafSoft,
  },
  gameCover: {
    width: '100%',
    height: '100%',
  },
  patientSectionTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800', marginTop: 4 },
  appName: { color: theme.colors.leaf, fontSize: 24, fontWeight: '800' },
  languageTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: 1.5, marginTop: 12 },
  bgTop: { position: 'absolute', top: 0, left: 0, width: '100%', height: 200, opacity: 0.28, resizeMode: 'cover' },
  bgBottom: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 200, opacity: 0.28, resizeMode: 'cover' },
  languageOption: { minHeight: 56, paddingHorizontal: 20, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.white },
  languageOptionSelected: { backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf },
  languageOptionText: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '700' },
  languageOptionTextSelected: { color: theme.colors.ink },
  toggleContainer: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.control, padding: 4, gap: 4, borderWidth: 1, borderColor: theme.colors.border },
  toggleOption: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.control - 2, alignItems: 'center', justifyContent: 'center' },
  toggleOptionActive: { backgroundColor: theme.colors.leaf },
  toggleText: { fontSize: theme.type.guardian, fontWeight: '700', color: theme.colors.mutedInk },
  toggleTextActive: { color: theme.colors.white },
  appRoot: { flex: 1 },
  dashboardHeaderSafe: { backgroundColor: theme.colors.canvas },
  dashboardBar: { minHeight: 64, paddingHorizontal: theme.spacing.page, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.canvas },
  dashboardBarTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: '800' },
  dashboardTools: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoReadToggle: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.white },
  autoReadToggleActive: { backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf },
  autoReadIcon: { fontSize: 16 },
  autoReadText: { color: theme.colors.mutedInk, fontSize: 14, fontWeight: '800' },
  autoReadTextActive: { color: theme.colors.leaf },
  dashboardRoleSwitch: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white },
  roleSwitchText: { color: theme.colors.leaf, fontSize: 15, fontWeight: '800' },
  exitScrim: { flex: 1, justifyContent: 'center', padding: theme.spacing.page, backgroundColor: 'rgba(36, 49, 41, 0.48)' },
  exitDialog: { gap: 14, padding: 24, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.canvas },
});
