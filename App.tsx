import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Field, MemberRow, Notice, Portrait } from './src/components/ui';
import { seed } from './src/data/seed';
import { theme } from './src/theme';

type Screen = 'language' | 'onboarding' | 'login' | 'guardianDashboard' | 'manageWhosWho' | 'memberEditor' | 'patientHome' | 'whosLearning' | 'whosRecall';
type Member = typeof seed.whosWho.members[number];

const copy = seed.app.copy;

export default function App() {
  const [screen, setScreen] = useState<Screen>('language');
  const [languageId, setLanguageId] = useState(seed.languagePacks[0].id);
  const [members, setMembers] = useState<Member[]>(seed.whosWho.members);
  const [activeMemberId, setActiveMemberId] = useState(seed.whosWho.members[0].id);
  const [notice, setNotice] = useState('');
  const [setup, setSetup] = useState({ guardianName: seed.guardian.name, relationship: seed.guardian.relationship, patientName: seed.patient.name });
  const [login, setLogin] = useState({ email: seed.guardian.email, password: '' });
  const [editor, setEditor] = useState({ id: '', name: '', relationship: '', personalNote: '', imageUri: seed.whosWho.photoChoices[0], learningOnly: false });
  const [answerState, setAnswerState] = useState<'idle' | 'support' | 'correct'>('idle');
  const [archivedMember, setArchivedMember] = useState<Member | null>(null);

  const activeLanguage = useMemo(() => seed.languagePacks.find((pack) => pack.id === languageId) ?? seed.languagePacks[0], [languageId]);
  const activeMember = useMemo(() => members.find((member) => member.id === activeMemberId) ?? members[0], [members, activeMemberId]);
  const recallChoices = useMemo(() => [activeMember, ...members.filter((member) => member.id !== activeMember?.id)].slice(0, 3), [activeMember, members]);

  const openEditor = (member?: Member) => {
    setNotice('');
    setEditor(member ? { ...member } : { id: '', name: '', relationship: '', personalNote: '', imageUri: seed.whosWho.photoChoices[0], learningOnly: false });
    setScreen('memberEditor');
  };

  const saveMember = () => {
    if (!editor.name.trim() || !editor.relationship.trim()) {
      setNotice(copy.requiredNotice);
      return;
    }
    const member = { ...editor, id: editor.id || `demo-member-${Date.now()}`, nameAudioLabel: editor.name, noteAudioLabel: editor.personalNote || seed.whosWho.defaultPersonalNote };
    setMembers((current) => editor.id ? current.map((item) => item.id === editor.id ? member : item) : [...current, member]);
    setActiveMemberId(member.id);
    setNotice(copy.addedNotice);
    setScreen('manageWhosWho');
  };

  const archiveMember = (id: string) => {
    const memberToArchive = members.find((member) => member.id === id);
    if (!memberToArchive) return;
    setArchivedMember(memberToArchive);
    setMembers((current) => current.filter((member) => member.id !== id));
    setActiveMemberId((current) => current === id ? members.find((member) => member.id !== id)?.id ?? '' : current);
    setNotice(copy.archiveNotice);
  };

  const restoreArchivedMember = () => {
    if (!archivedMember) return;
    setMembers((current) => [...current, archivedMember]);
    setActiveMemberId(archivedMember.id);
    setArchivedMember(null);
    setNotice(copy.addedNotice);
  };

  const handleAnswer = (memberId: string) => {
    if (memberId === activeMember?.id) {
      setAnswerState('correct');
      return;
    }
    setAnswerState('support');
  };

  const renderHeader = (title: string, eyebrow?: string, showHome = false) => (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
        <Text style={styles.brandName}>{seed.app.name}</Text>
      </View>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{title}</Text>
      {showHome && <ActionButton label={copy.home} onPress={() => setScreen('patientHome')} variant="quiet" compact />}
    </View>
  );

  const renderLanguage = () => (
    <ScreenLayout key={screen}>
      {renderHeader(copy.chooseLanguage, seed.app.tagline)}
      <Text style={styles.bodyLead}>{copy.chooseLanguageHint}</Text>
      <View style={styles.languageList}>
        {seed.languagePacks.map((pack) => (
          <ActionButton key={pack.id} label={`${pack.nativeLabel} · ${pack.label}`} onPress={() => setLanguageId(pack.id)} variant={languageId === pack.id ? 'primary' : 'secondary'} />
        ))}
      </View>
      <Notice>{`${activeLanguage.label} is selected. ${activeLanguage.voicePromptPack} voice prompts will be available offline.`}</Notice>
      <View style={styles.footerActions}>
        <ActionButton label={copy.continue} onPress={() => setScreen('onboarding')} />
        <ActionButton label={copy.guardianSignIn} onPress={() => setScreen('login')} variant="quiet" />
        <ActionButton label={copy.patientMode} onPress={() => setScreen('patientHome')} variant="quiet" />
      </View>
    </ScreenLayout>
  );

  const renderOnboarding = () => (
    <ScreenLayout key={screen}>
      {renderHeader(copy.guardianSetup, 'Step 1 of 2')}
      <Text style={styles.bodyLead}>{copy.guardianSetupHint}</Text>
      <View style={styles.formStack}>
        <Field label={copy.guardianName} value={setup.guardianName} onChangeText={(guardianName) => setSetup({ ...setup, guardianName })} />
        <Field label={copy.relationship} value={setup.relationship} onChangeText={(relationship) => setSetup({ ...setup, relationship })} />
        <Field label={copy.patientName} value={setup.patientName} onChangeText={(patientName) => setSetup({ ...setup, patientName })} />
      </View>
      <Notice>{`Language pack: ${activeLanguage.nativeLabel}. You can change this safely later.`}</Notice>
      <ActionButton label={copy.continue} onPress={() => setScreen('login')} />
    </ScreenLayout>
  );

  const renderLogin = () => (
    <ScreenLayout key={screen}>
      {renderHeader(copy.signInTitle, seed.app.name)}
      <Text style={styles.bodyLead}>{copy.signInHint}</Text>
      <View style={styles.formStack}>
        <Field label={copy.email} value={login.email} onChangeText={(email) => setLogin({ ...login, email })} placeholder="name@example.com" />
        <Field label={copy.password} value={login.password} onChangeText={(password) => setLogin({ ...login, password })} secureTextEntry placeholder="••••••••" />
      </View>
      <ActionButton label={copy.signIn} onPress={() => setScreen('guardianDashboard')} />
      <ActionButton label={copy.patientMode} onPress={() => setScreen('patientHome')} variant="quiet" />
    </ScreenLayout>
  );

  const renderGuardianDashboard = () => (
    <ScreenLayout key={screen}>
      {renderHeader(copy.dashboardTitle, `${setup.guardianName} · ${setup.relationship}`)}
      <Notice>{copy.dashboardHint}</Notice>
      <View style={styles.dashboardPanel}>
        <Text style={styles.panelOverline}>MEMORY LIBRARY</Text>
        <Text style={styles.panelTitle}>{copy.whosWhoTitle}</Text>
        <Text style={styles.panelBody}>{`${members.length} familiar memories are ready for gentle learning.`}</Text>
        <ActionButton label={copy.manageWhosWho} onPress={() => setScreen('manageWhosWho')} />
      </View>
      <ActionButton label={copy.patientMode} onPress={() => setScreen('patientHome')} variant="quiet" />
    </ScreenLayout>
  );

  const renderManager = () => (
    <ScreenLayout key={screen}>
      {renderHeader(copy.whosWhoTitle, copy.dashboardTitle)}
      <Text style={styles.bodyLead}>{copy.whosWhoHint}</Text>
      {notice ? <Notice tone="support">{notice}</Notice> : null}
      {archivedMember ? <ActionButton label={copy.restore} onPress={restoreArchivedMember} variant="secondary" /> : null}
      <ActionButton label={copy.addPerson} onPress={() => openEditor()} />
      <View style={styles.memberList}>
        {members.map((member) => <MemberRow key={member.id} member={member} onEdit={() => openEditor(member)} onArchive={() => archiveMember(member.id)} labels={{ edit: copy.editPerson, archive: copy.archive, learningOnly: copy.learningOnly }} />)}
      </View>
      <ActionButton label={copy.dashboardTitle} onPress={() => setScreen('guardianDashboard')} variant="quiet" />
    </ScreenLayout>
  );

  const renderMemberEditor = () => (
    <ScreenLayout key={screen}>
      {renderHeader(editor.id ? copy.editPerson : copy.addPerson, copy.whosWhoTitle)}
      {notice ? <Notice tone="support">{notice}</Notice> : null}
      <View style={styles.photoPicker}>
        <Portrait uri={editor.imageUri} name={editor.name || copy.photo} size={120} />
        <Text style={styles.fieldLabel}>{copy.demoPhoto}</Text>
        <View style={styles.photoChoiceRow}>
          {seed.whosWho.photoChoices.map((photoUri, index) => <ActionButton key={photoUri} label={`${copy.choosePhoto} ${index + 1}`} onPress={() => setEditor({ ...editor, imageUri: photoUri })} variant={editor.imageUri === photoUri ? 'primary' : 'quiet'} compact />)}
        </View>
      </View>
      <View style={styles.formStack}>
        <Field label={copy.name} value={editor.name} onChangeText={(name) => setEditor({ ...editor, name })} />
        <Field label={copy.memberRelationship} value={editor.relationship} onChangeText={(relationship) => setEditor({ ...editor, relationship })} />
        <Field label={copy.personalNote} value={editor.personalNote} onChangeText={(personalNote) => setEditor({ ...editor, personalNote })} multiline />
      </View>
      <View style={styles.audioRow}>
        <Notice>{`${copy.nameAudio}: ${editor.name || copy.unavailable}`}</Notice>
        <Notice>{`${copy.noteAudio}: ${editor.personalNote ? copy.ready : copy.optional}`}</Notice>
      </View>
      <ActionButton label={editor.learningOnly ? copy.learningOnly : `${copy.learningOnly}: off`} onPress={() => setEditor({ ...editor, learningOnly: !editor.learningOnly })} variant="secondary" />
      <ActionButton label={copy.saveMemory} onPress={saveMember} />
      <ActionButton label={copy.cancel} onPress={() => setScreen('manageWhosWho')} variant="quiet" />
    </ScreenLayout>
  );

  const renderPatientHome = () => (
    <ScreenLayout key={screen} patient>
      <View style={styles.patientHeader}>
        <View><Text style={styles.patientGreeting}>{`${copy.patientGreeting},`}</Text><Text style={styles.patientName}>{seed.patient.greetingName}</Text></View>
        <Portrait uri={seed.patient.photoUri} name={seed.patient.name} size={72} />
      </View>
      <View style={styles.reminderCard}>
        <Text style={styles.panelOverline}>{copy.today}</Text>
        <Text style={styles.reminderTitle}>{seed.patient.reminder.title}</Text>
        <Text style={styles.reminderText}>{`${seed.patient.reminder.time} · ${seed.patient.reminder.detail}`}</Text>
      </View>
      <Text style={styles.patientSectionTitle}>{copy.nextActivity}</Text>
      <View style={styles.gameList}>
        {seed.games.map((game) => (
          <View key={game.id} style={[styles.gameCard, game.id === 'whos-who' && styles.gameCardReady]}>
            <Text style={styles.gameBadge}>{game.badge}</Text>
            <Text style={styles.gameTitle}>{game.title}</Text>
            <Text style={styles.gameSubtitle}>{game.subtitle}</Text>
            <ActionButton label={game.id === 'whos-who' ? copy.continue : copy.openActivity} onPress={() => game.id === 'whos-who' ? setScreen('whosLearning') : setNotice(copy.comingSoon)} variant={game.id === 'whos-who' ? 'primary' : 'secondary'} />
          </View>
        ))}
      </View>
      {notice ? <Notice>{notice}</Notice> : null}
      <ActionButton label={copy.caregiverArea} onPress={() => setScreen('login')} variant="quiet" />
    </ScreenLayout>
  );

  const renderLearning = () => activeMember ? (
    <ScreenLayout key={screen} patient>
      {renderHeader(`${copy.meet} ${activeMember.name}`, copy.whosWhoTitle, true)}
      <View style={styles.familiarFrame}>
        <Portrait uri={activeMember.imageUri} name={activeMember.name} size={260} />
        <Text style={styles.frameName}>{activeMember.name}</Text>
        <Text style={styles.frameRelationship}>{activeMember.relationship}</Text>
        <Text style={styles.frameNote}>{activeMember.personalNote}</Text>
      </View>
      <Notice>{`${copy.nameAudio}: “${activeMember.nameAudioLabel}”`}</Notice>
      <ActionButton label={copy.hearAgain} onPress={() => setNotice(`${copy.nameAudio}: ${activeMember.nameAudioLabel}`)} variant="secondary" />
      <ActionButton label={copy.practiceNow} onPress={() => { setAnswerState('idle'); setScreen('whosRecall'); }} />
    </ScreenLayout>
  ) : renderPatientHome();

  const renderRecall = () => activeMember ? (
    <ScreenLayout key={screen} patient>
      {renderHeader(copy.chooseName, copy.whosWhoTitle, true)}
      <View style={styles.recallPhoto}><Portrait uri={activeMember.imageUri} name={activeMember.name} size={230} /></View>
      <ActionButton label={copy.hearAgain} onPress={() => setNotice(`${copy.nameAudio}: ${activeMember.nameAudioLabel}`)} variant="secondary" />
      <View style={styles.answerList}>
        {recallChoices.map((member) => <ActionButton key={member.id} label={`🔊  ${member.name}`} onPress={() => handleAnswer(member.id)} variant={answerState === 'support' && member.id === activeMember.id ? 'secondary' : 'primary'} />)}
      </View>
      {answerState === 'support' && <Notice tone="support">{`${copy.calmHint} ${activeMember.name}.`}</Notice>}
      {answerState === 'correct' && <Notice>{copy.gentleConfirm}</Notice>}
      {answerState !== 'idle' && <ActionButton label={copy.backToActivity} onPress={() => setScreen('patientHome')} />}
    </ScreenLayout>
  ) : renderPatientHome();

  if (screen === 'language') return renderLanguage();
  if (screen === 'onboarding') return renderOnboarding();
  if (screen === 'login') return renderLogin();
  if (screen === 'guardianDashboard') return renderGuardianDashboard();
  if (screen === 'manageWhosWho') return renderManager();
  if (screen === 'memberEditor') return renderMemberEditor();
  if (screen === 'whosLearning') return renderLearning();
  if (screen === 'whosRecall') return renderRecall();
  return renderPatientHome();
}

function ScreenLayout({ children, patient = false }: { children: React.ReactNode; patient?: boolean }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.canvas} />
      <ScrollView contentContainerStyle={[styles.scroll, patient && styles.patientScroll]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  scroll: { padding: theme.spacing.page, gap: theme.spacing.gap, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' },
  patientScroll: { paddingBottom: 48 },
  header: { gap: 10, marginBottom: 4 },
  brandRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.leaf, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: theme.colors.white, fontWeight: '800', fontSize: 18 },
  brandName: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  eyebrow: { color: theme.colors.mutedInk, fontSize: theme.type.meta, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: theme.colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '800' },
  bodyLead: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 27 },
  languageList: { gap: 12 },
  footerActions: { gap: 10, marginTop: 'auto' },
  formStack: { gap: 16 },
  fieldLabel: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' },
  dashboardPanel: { padding: 22, gap: 12, backgroundColor: theme.colors.leafSoft, borderWidth: 1, borderColor: theme.colors.leaf, borderRadius: theme.radius.media },
  panelOverline: { color: theme.colors.leaf, fontSize: 13, fontWeight: '800', letterSpacing: 0.7 },
  panelTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' },
  panelBody: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 26 },
  memberList: { gap: 12 },
  photoPicker: { alignItems: 'center', padding: 18, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media, gap: 12 },
  photoChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  audioRow: { gap: 10 },
  patientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  patientGreeting: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall },
  patientName: { color: theme.colors.ink, fontSize: theme.type.display, lineHeight: 46, fontWeight: '800' },
  reminderCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.media, padding: 20, gap: 8 },
  reminderTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' },
  reminderText: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 25 },
  patientSectionTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800', marginTop: 4 },
  gameList: { gap: 14 },
  gameCard: { backgroundColor: theme.colors.white, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.border, padding: 20, gap: 10 },
  gameCardReady: { borderColor: theme.colors.leaf, borderWidth: 2 },
  gameBadge: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800', alignSelf: 'flex-start' },
  gameTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: '800' },
  gameSubtitle: { color: theme.colors.mutedInk, fontSize: theme.type.guardian },
  familiarFrame: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.media, padding: 22, gap: 10 },
  frameName: { color: theme.colors.ink, fontSize: theme.type.display, fontWeight: '800', textAlign: 'center' },
  frameRelationship: { color: theme.colors.leaf, fontSize: theme.type.patient, fontWeight: '700' },
  frameNote: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 26, textAlign: 'center' },
  recallPhoto: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.media, padding: 22, borderWidth: 1, borderColor: theme.colors.border },
  answerList: { gap: 12 },
});
