import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import type { SessionOutcome } from './adaptive/types';
import { AudioCapture, AudioReplay } from './components/audio';
import { ActionButton, Field, MemberRow, Notice, Portrait } from './components/ui';
import { seed } from './data/seed';
import { supabase } from './lib/supabase';
import { pickAndPersistPhoto } from './storage/media';
import { scheduleWhosWhoReminder } from './storage/reminders';
import { abandonWhosWhoSession, applyReviewResult, archiveWhosWhoItem, chooseNextWhosWhoItem, finishWhosWhoSession, getLocalSetting, initializeLocalStore, listWhosWhoItems, markLearningExposure, persistGameEvent, saveWhosWhoItem, setLocalSetting, startWhosWhoSession } from './storage/localStore';
import type { StoredSession, WhosWhoDraft, WhosWhoItem } from './storage/types';
import { theme } from './theme';

type Screen = 'language' | 'onboarding' | 'login' | 'dashboard' | 'manager' | 'editor' | 'patient' | 'learning' | 'recall';
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

function PhotoAnswer({ item, onPress }: { item: WhosWhoItem; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Photo option: ${item.name}`} onPress={onPress} style={({ pressed }) => [styles.photoAnswer, pressed && styles.pressed]}><Portrait uri={item.photoUri ?? undefined} name={item.name} size={132} /><Text style={styles.photoAnswerText}>{copy.chooseThisPhoto}</Text></Pressable>;
}

function Header({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return <View style={styles.header}><View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>S</Text></View><Text style={styles.brandText}>Saathi</Text></View>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>;
}

function Layout({ children, patient = false }: { children: React.ReactNode; patient?: boolean }) {
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={theme.colors.canvas} /><ScrollView contentContainerStyle={[styles.scroll, patient && styles.patientScroll]} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
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
  const [attempts, setAttempts] = useState(0);
  const [completedPromptKeys, setCompletedPromptKeys] = useState<string[]>([]);
  const [pendingRecallMode, setPendingRecallMode] = useState<RecallMode>('photo-to-name');

  const language = useMemo(() => seed.languagePacks.find((item) => item.id === languageId) ?? seed.languagePacks[0], [languageId]);
  const patientDisplayName = setup.patientName.trim();
  const activeItem = useMemo(() => items.find((item) => item.id === activeItemId) ?? null, [items, activeItemId]);
  const choices = useMemo(() => activeItem ? [activeItem, ...items.filter((item) => item.id !== activeItem.id && !item.learningOnly).slice(0, 2)].sort((a, b) => a.id === activeItem.id ? -1 : b.id === activeItem.id ? 1 : a.name.localeCompare(b.name)) : [], [activeItem, items]);
  const refresh = async () => setItems(await listWhosWhoItems());

  useEffect(() => { void (async () => {
    await initializeLocalStore();
    const stored = await getLocalSetting('patient-id'); if (stored) setPatientId(stored);
    const storedProfile = await getLocalSetting('care-profile');
    if (storedProfile) { try { setSetup(JSON.parse(storedProfile) as CareProfile); } catch { /* Ignore malformed local profile data. */ } }
    await refresh(); setReady(true);
  })(); }, []);

  const persistCareProfile = async (profile = setup) => setLocalSetting('care-profile', JSON.stringify(profile));

  const createCareCircle = async () => {
    if (!supabase) { setNotice(copy.authUnavailable); return false; }
    const { data, error } = await supabase.functions.invoke<{ patientId: string }>('create-care-circle', { body: { patientDisplayName: setup.patientName.trim(), relationshipToPatient: setup.relationship.trim(), preferredLanguageCode: language.id, patientTimezone: 'Asia/Kolkata' } });
    if (error || !data?.patientId) { setNotice(copy.accountProblem); return false; }
    setPatientId(data.patientId); await setLocalSetting('patient-id', data.patientId); await persistCareProfile(); return true;
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
          if (links?.[0]?.patient_id) { setPatientId(links[0].patient_id); await setLocalSetting('patient-id', links[0].patient_id); setScreen('dashboard'); }
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

  const openActivity = async () => {
    const next = await chooseNextWhosWhoItem();
    if (!next) { setNotice('There are no active memories yet. A caregiver can add one in Caregiver Area.'); return; }
    setCompletedPromptKeys([]); setPendingRecallMode('photo-to-name'); setActiveItemId(next.id); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setAttempts(0);
    if (!next.learnedAt) setScreen('learning'); else await beginRecall(next, 'photo-to-name');
  };
  const beginRecall = async (item: WhosWhoItem, requestedMode?: RecallMode) => {
    const started = await startWhosWhoSession(patientId, item.id);
    await persistGameEvent(started.id, { type: 'prompt_shown', itemId: item.id, at: Date.now() });
    // New memories start with the familiar photo. Later reviews rotate name and
    // relationship/personal-note prompts without changing the per-item schedule.
    const nextMode = requestedMode ?? (item.reviewStep < 0 ? 'photo-to-name' : item.reviewStep % 3 === 0 ? 'name-to-photo' : item.reviewStep % 3 === 1 ? 'clue-to-photo' : 'photo-to-name');
    setSession(started); setMode(nextMode); setAnswerState('idle'); setScreen('recall');
  };
  const practice = async () => { if (!activeItem) return; await markLearningExposure(activeItem.id); await refresh(); await beginRecall(activeItem, pendingRecallMode); };
  const replay = async () => { if (activeItem && session) await persistGameEvent(session.id, { type: 'audio_replayed', itemId: activeItem.id, at: Date.now() }); setUsedHelp(true); };
  const answer = async (itemId: string) => {
    if (!activeItem || !session || answerState === 'complete') return;
    const correct = itemId === activeItem.id; const now = Date.now(); const nextAttempts = attempts + 1;
    await persistGameEvent(session.id, { type: 'tap', itemId: activeItem.id, correct, at: now, x: 0, y: 0, hintLevelAtTap: correct && !hadWrong && !usedHelp ? 0 : 4, solvedUnassisted: correct && !hadWrong && !usedHelp && attempts === 0 }); setAttempts(nextAttempts);
    if (!correct) { await persistGameEvent(session.id, { type: 'hint_shown', itemId: activeItem.id, level: 4, at: Date.now() }); setHadWrong(true); setUsedHelp(true); setAnswerState('support'); return; }
    const result = hadWrong ? 'incorrect' : usedHelp ? 'supported' : 'independent'; const review = await applyReviewResult(activeItem.id, result); if (review) await scheduleWhosWhoReminder(review.dueAt);
    const latency = Math.max(0, (now - session.startedAt) / 1000);
    const outcome: SessionOutcome = { scoredActions: nextAttempts, successRate: 1 / nextAttempts, unassistedRate: result === 'independent' ? 1 : 0, medianLatencySeconds: result === 'independent' ? latency : null, wasAbandoned: false, unassistedLatencies: result === 'independent' ? [latency] : [], successfulScoredActions: 1, unassistedScoredActions: result === 'independent' ? 1 : 0 };
    await finishWhosWhoSession(session, outcome);
    setSession(null);
    await refresh();
    const completed = [...completedPromptKeys, `${activeItem.id}:${mode}`];
    setCompletedPromptKeys(completed);
    // A round is every active familiar memory in each of the three recall forms.
    // Prefer a different memory and a different prompt form so one person is
    // never presented three times in a row when the library has alternatives.
    const remainingPrompts = (await listWhosWhoItems()).filter((item) => !item.paused).flatMap((item) => recallModes.map((recallMode) => ({ item, recallMode }))).filter(({ item, recallMode }) => !completed.includes(`${item.id}:${recallMode}`));
    const nextPrompt = remainingPrompts.find(({ item, recallMode }) => item.id !== activeItem.id && recallMode !== mode) ?? remainingPrompts.find(({ item }) => item.id !== activeItem.id) ?? remainingPrompts[0];
    if (!nextPrompt) { setNotice('That is enough for now. Come again later for another familiar moment.'); setScreen('patient'); return; }
    setActiveItemId(nextPrompt.item.id); setPendingRecallMode(nextPrompt.recallMode); setAnswerState('idle'); setHadWrong(false); setUsedHelp(false); setAttempts(0);
    if (!nextPrompt.item.learnedAt) setScreen('learning'); else await beginRecall(nextPrompt.item, nextPrompt.recallMode);
  };
  const leaveActivity = async () => { if (session && activeItem) { await abandonWhosWhoSession(session); const review = await applyReviewResult(activeItem.id, 'distress'); if (review) await scheduleWhosWhoReminder(review.dueAt); } setSession(null); setAnswerState('idle'); setScreen('patient'); await refresh(); };
  if (!ready) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={theme.colors.leaf} /><Text style={styles.body}>Preparing your local memory library…</Text></View></SafeAreaView>;
  if (screen === 'language') return <Layout><Header title={copy.chooseLanguage} eyebrow={seed.app.tagline} /><Text style={styles.body}>{copy.chooseLanguageHint}</Text><View style={styles.stack}>{seed.languagePacks.map((pack) => <ActionButton key={pack.id} label={`${pack.nativeLabel} · ${pack.label}`} onPress={() => setLanguageId(pack.id)} variant={languageId === pack.id ? 'primary' : 'secondary'} />)}</View><Notice>{`${language.label} voice prompts can be used offline.`}</Notice><View style={styles.stack}><ActionButton label={copy.continue} onPress={() => setScreen('onboarding')} /><ActionButton label={copy.guardianSignIn} onPress={() => { setAuthMode('signIn'); setNotice(''); setScreen('login'); }} variant="quiet" /><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /></View></Layout>;
  if (screen === 'onboarding') return <Layout><Header title={copy.guardianSetup} eyebrow="Step 1 of 2" /><Text style={styles.body}>Set up the care circle. Family media stays on this device.</Text><View style={styles.stack}><Field label={copy.guardianName} value={setup.guardianName} onChangeText={(guardianName) => setSetup({ ...setup, guardianName })} /><Field label={copy.relationship} value={setup.relationship} onChangeText={(relationship) => setSetup({ ...setup, relationship })} /><Field label={copy.patientName} value={setup.patientName} onChangeText={(patientName) => setSetup({ ...setup, patientName })} /></View>{notice ? <Notice tone="support">{notice}</Notice> : null}<ActionButton label={busy ? 'Setting up…' : copy.continue} onPress={async () => { const { data } = await supabase?.auth.getUser() ?? { data: null }; if (!data?.user) { setAuthMode('signUp'); setScreen('login'); } else if (await createCareCircle()) setScreen('dashboard'); }} disabled={busy} /></Layout>;
  if (screen === 'login') return <Layout><Header title={authMode === 'signIn' ? copy.signInTitle : copy.createAccountTitle} /><Text style={styles.body}>{authMode === 'signIn' ? copy.signInHint : copy.createAccountHint}</Text><View style={styles.stack}><Field label={copy.email} value={login.email} onChangeText={(email) => setLogin({ ...login, email })} placeholder="name@example.com" /><Field label={copy.password} value={login.password} onChangeText={(password) => setLogin({ ...login, password })} secureTextEntry placeholder="At least 8 characters" /></View>{notice ? <Notice tone="support">{notice}</Notice> : null}<ActionButton label={busy ? (authMode === 'signIn' ? copy.signingIn : copy.creatingAccount) : authMode === 'signIn' ? copy.signIn : copy.createAccount} onPress={authenticate} disabled={busy} /><ActionButton label={authMode === 'signIn' ? copy.needAccount : copy.alreadyHaveAccount} onPress={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setNotice(''); }} variant="quiet" /><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /></Layout>;
  if (screen === 'dashboard') return <Layout><Header title={copy.dashboardTitle} eyebrow={`${setup.guardianName} · ${setup.relationship}`} /><Notice>Photos, voice notes, learning history, and review schedules are stored locally first.</Notice><View style={styles.panel}><Text style={styles.overline}>MEMORY LIBRARY</Text><Text style={styles.panelTitle}>{copy.whosWhoTitle}</Text><Text style={styles.body}>{`${items.length} active familiar memories are ready for gentle practice.`}</Text><ActionButton label={copy.manageWhosWho} onPress={() => setScreen('manager')} /></View><ActionButton label={copy.patientMode} onPress={() => setScreen('patient')} variant="quiet" /><ActionButton label={copy.signOut} onPress={async () => { await supabase?.auth.signOut(); setScreen('language'); }} variant="quiet" /></Layout>;
  if (screen === 'manager') return <Layout><Header title={copy.whosWhoTitle} eyebrow={copy.dashboardTitle} /><Text style={styles.body}>New memories always begin with Learning before any recall question.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}{archiveCandidate ? <View style={styles.archive}><Text style={styles.panelTitle}>Archive {archiveCandidate.name}?</Text><Text style={styles.body}>This is reversible. The memory will be hidden from patient activities.</Text><ActionButton label="Archive memory" onPress={archive} variant="secondary" /><ActionButton label="Keep memory" onPress={() => setArchiveCandidate(null)} variant="quiet" /></View> : null}<ActionButton label={copy.addPerson} onPress={() => openEditor()} />{items.length ? <View style={styles.stack}>{items.map((item) => <MemberRow key={item.id} member={item} onEdit={() => openEditor(item)} onArchive={() => setArchiveCandidate(item)} labels={{ edit: copy.editPerson, archive: copy.archive, learningOnly: copy.learningOnly }} />)}</View> : <Notice>Add a familiar person, place, or object to begin.</Notice>}<ActionButton label={copy.dashboardTitle} onPress={() => setScreen('dashboard')} variant="quiet" /></Layout>;
  if (screen === 'editor') return <Layout><Header title={editor.id ? copy.editPerson : copy.addPerson} eyebrow={copy.whosWhoTitle} /><Text style={styles.body}>Choose a photo and record the name and optional personal note in a familiar voice.</Text>{notice ? <Notice tone="support">{notice}</Notice> : null}<View style={styles.photo}><Portrait uri={editor.photoUri ?? undefined} name={editor.name || copy.photo} size={150} /><ActionButton label={editor.photoUri ? 'Choose another photo' : 'Choose a photo'} onPress={selectPhoto} variant="secondary" /></View><View style={styles.stack}><Field label={copy.name} value={editor.name} onChangeText={(name) => setEditor((value) => ({ ...value, name }))} /><Field label={copy.memberRelationship} value={editor.relationship} onChangeText={(relationship) => setEditor((value) => ({ ...value, relationship }))} /><Field label={copy.personalNote} value={editor.personalNote} onChangeText={(personalNote) => setEditor((value) => ({ ...value, personalNote }))} multiline /></View><View style={styles.stack}><AudioCapture label={copy.nameAudio} uri={editor.nameAudioUri} onCaptured={(nameAudioUri) => setEditor((value) => ({ ...value, nameAudioUri }))} onProblem={setNotice} /><AudioCapture label={copy.noteAudio} uri={editor.noteAudioUri} onCaptured={(noteAudioUri) => setEditor((value) => ({ ...value, noteAudioUri }))} onProblem={setNotice} /></View><ActionButton label={editor.learningOnly ? 'Learning only: on' : 'Learning only: off'} onPress={() => setEditor((value) => ({ ...value, learningOnly: !value.learningOnly }))} variant="secondary" /><ActionButton label={copy.saveMemory} onPress={saveMemory} /><ActionButton label={copy.cancel} onPress={() => setScreen('manager')} variant="quiet" /></Layout>;
  if (screen === 'learning' && activeItem) return <Layout patient><Header title={`${copy.meet} ${activeItem.name}`} eyebrow={copy.whosWhoTitle} /><View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={250} /><Text style={styles.frameName}>{activeItem.name}</Text><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View><AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} /><ActionButton label={copy.practiceNow} onPress={practice} /><ActionButton label={copy.home} onPress={leaveActivity} variant="quiet" /></Layout>;
  if (screen === 'recall' && activeItem) return <Layout patient><Header title={mode === 'photo-to-name' ? copy.chooseName : mode === 'name-to-photo' ? copy.choosePhotoForName : copy.choosePhotoForClue} eyebrow={copy.whosWhoTitle} />{mode === 'photo-to-name' ? <View style={styles.frame}><Portrait uri={activeItem.photoUri ?? undefined} name={activeItem.name} size={230} /></View> : mode === 'name-to-photo' ? <View style={styles.prompt}><Text style={styles.frameName}>{activeItem.name}</Text></View> : <View style={styles.prompt}><Text style={styles.relationship}>{activeItem.relationship}</Text>{activeItem.personalNote ? <Text style={styles.note}>{activeItem.personalNote}</Text> : null}</View>}<AudioReplay uri={activeItem.nameAudioUri} label={copy.hearAgain} onReplay={replay} /><View style={mode === 'photo-to-name' ? styles.stack : styles.photoChoices}>{choices.map((item) => mode === 'photo-to-name' ? <ActionButton key={item.id} label={`🔊  ${item.name}`} onPress={() => answer(item.id)} variant={answerState === 'support' && item.id === activeItem.id ? 'secondary' : 'primary'} /> : <PhotoAnswer key={item.id} item={item} onPress={() => answer(item.id)} />)}</View>{answerState === 'support' ? <Notice tone="support">{`${copy.calmHint} ${activeItem.name}. Please tap ${activeItem.name} when you are ready.`}</Notice> : null}{answerState === 'complete' ? <Notice>{copy.gentleConfirm}</Notice> : null}<ActionButton label={answerState === 'complete' ? copy.backToActivity : copy.home} onPress={leaveActivity} variant={answerState === 'complete' ? 'primary' : 'quiet'} /></Layout>;
  return <Layout patient><View style={styles.patientHead}><View><Text style={styles.greeting}>{copy.patientGreeting}{patientDisplayName ? ',' : ''}</Text>{patientDisplayName ? <Text style={styles.patientName}>{patientDisplayName}</Text> : null}</View><View style={styles.people}><Portrait name={patientDisplayName || 'Patient'} size={68} /><Portrait name={setup.guardianName || 'Caregiver'} size={68} /></View></View><Text style={styles.section}>Choose an activity</Text><View style={styles.stack}><View style={styles.game}><Text style={styles.overline}>{copy.ready}</Text><Text style={styles.panelTitle}>{copy.whosWhoTitle}</Text><Text style={styles.body}>{items.length ? 'Familiar faces, names, and gentle reminders.' : 'A caregiver can add familiar memories when you are ready.'}</Text><ActionButton label={copy.continue} onPress={openActivity} disabled={!items.length} /></View></View>{notice ? <Notice>{notice}</Notice> : null}<ActionButton label={copy.caregiverArea} onPress={() => { setAuthMode('signIn'); setNotice(''); setScreen('login'); }} variant="quiet" /></Layout>;
}

const styles = StyleSheet.create({
  photoChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  photoAnswer: { alignItems: 'center', width: 156, minHeight: 198, padding: 12, gap: 10, borderRadius: theme.radius.media, borderWidth: 2, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white },
  photoAnswerText: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: .82, transform: [{ scale: .99 }] },
  safe: { flex: 1, backgroundColor: theme.colors.canvas }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }, scroll: { padding: theme.spacing.page, gap: theme.spacing.gap, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' }, patientScroll: { paddingBottom: 48 }, stack: { gap: 14 }, header: { gap: 10 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.leaf }, markText: { color: theme.colors.white, fontWeight: '800', fontSize: 18 }, brandText: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' }, eyebrow: { color: theme.colors.mutedInk, fontSize: theme.type.meta, fontWeight: '700', letterSpacing: .4 }, title: { color: theme.colors.ink, fontSize: 32, fontWeight: '800', lineHeight: 40 }, body: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 27 }, panel: { padding: 22, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft, borderWidth: 1, borderColor: theme.colors.leaf }, archive: { padding: 18, gap: 12, borderRadius: theme.radius.media, backgroundColor: theme.colors.amberSoft, borderWidth: 1, borderColor: theme.colors.amber }, overline: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: .7 }, panelTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' }, photo: { alignItems: 'center', padding: 18, gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media }, patientHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, people: { flexDirection: 'row', gap: 8 }, greeting: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall }, patientName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', lineHeight: 46 }, reminder: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 20, gap: 8 }, reminderTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, section: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' }, game: { backgroundColor: theme.colors.white, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 20, gap: 10 }, frame: { alignItems: 'center', gap: 10, padding: 22, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media }, frameName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', textAlign: 'center' }, relationship: { color: theme.colors.leaf, fontSize: theme.type.patient, fontWeight: '700' }, note: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 26, textAlign: 'center' }, prompt: { alignItems: 'center', padding: 28, gap: 8, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media },
});
