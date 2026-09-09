import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AudioCapture, AudioReplay } from '../../components/audio';
import { ActionButton, Notice } from '../../components/ui';
import { touchFeedback } from '../../lib/haptics';
import type { SkillTransmissionItem } from '../../storage/types';
import { theme } from '../../theme';
import { SkillIllustration } from './SkillIllustration';

type Labels = {
  voicePrompt: string;
  enable: string;
  disable: string;
  recordToEnable: string;
  hearAgain: string;
  interactionComingSoon: string;
  audio: { working: string; stopAndSave: string; recordAgain: string; record: string; saved: string; permission: string; failed: string };
};

export function SkillManagerCard({ item, title, prompt, labels, available, onAudioCaptured, onToggle, onProblem }: {
  item: SkillTransmissionItem;
  title: string;
  prompt: string;
  labels: Labels;
  available: boolean;
  onAudioCaptured: (uri: string) => Promise<void>;
  onToggle: () => Promise<void>;
  onProblem: (message: string) => void;
}) {
  return <View style={[styles.managerCard, item.enabled && styles.enabledCard]}>
    <View style={styles.managerHead}>
      <SkillIllustration skill={item.catalogKey} label={title} size={92} />
      <View style={styles.managerCopy}><Text style={styles.managerTitle}>{title}</Text><Text style={styles.prompt}>{prompt}</Text></View>
    </View>
    <AudioCapture label={labels.voicePrompt} uri={item.promptAudioUri} onCaptured={onAudioCaptured} onProblem={onProblem} labels={labels.audio} />
    {item.promptAudioUri ? <AudioReplay uri={item.promptAudioUri} label={labels.hearAgain} /> : <Notice>{labels.recordToEnable}</Notice>}
    {!available ? <Notice>{labels.interactionComingSoon}</Notice> : null}
    <ActionButton label={item.enabled ? labels.disable : labels.enable} onPress={() => { void onToggle(); }} variant={item.enabled ? 'quiet' : 'secondary'} disabled={(!item.promptAudioUri || !available) && !item.enabled} />
  </View>;
}

export function PatientSkillCard({ item, title, prompt, onPress }: { item: SkillTransmissionItem; title: string; prompt: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${prompt}`} onPress={() => { touchFeedback(); onPress(); }} style={({ pressed }) => [styles.patientCard, pressed && styles.pressed]}>
    <SkillIllustration skill={item.catalogKey} label={title} size={142} />
    <View style={styles.patientCopy}><Text style={styles.patientTitle}>{title}</Text><Text style={styles.patientPrompt}>{prompt}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  managerCard: { padding: 16, gap: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.media, backgroundColor: theme.colors.white },
  enabledCard: { borderColor: theme.colors.leaf, borderWidth: 2 },
  managerHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  managerCopy: { flex: 1, gap: 5 },
  managerTitle: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' },
  prompt: { color: theme.colors.mutedInk, fontSize: theme.type.meta, lineHeight: 22 },
  patientCard: { minHeight: 170, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderWidth: 2, borderColor: theme.colors.leaf, borderRadius: theme.radius.media, backgroundColor: theme.colors.white },
  patientCopy: { flex: 1, gap: 8 },
  patientTitle: { color: theme.colors.ink, fontSize: theme.type.patient, lineHeight: 32, fontWeight: '800' },
  patientPrompt: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall, lineHeight: 28 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
