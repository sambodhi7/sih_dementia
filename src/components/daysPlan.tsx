import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Field, Notice } from './ui';
import { AudioCapture, AudioReplay } from './audio';
import { theme } from '../theme';
import type { DaysPlanItem } from '../storage/types';
import type { GameEvent } from '../services/adaptive/types';
import { daysPlanOptionCount } from '../services/adaptive/difficulty';
import type { ControllerState } from '../services/adaptive/types';
import { pickAndPersistPhoto } from '../storage/media';
import { getDaysPlanCopy } from '../data/daysPlanCopy';
import { useSpeechGuide } from '../speech/guide';

export type { DaysPlanItem } from '../storage/types';

type PlanMode = 'choose' | 'morning' | 'evening';

type DaysPlanActivityProps = {
  items: DaysPlanItem[];
  patientName?: string;
  onExit: () => void;
  onPhaseStart: (phase: 'morning' | 'evening') => Promise<void>;
  onEvent: (event: GameEvent) => Promise<void>;
  onComplete: () => Promise<void>;
  onAbandon: () => Promise<void>;
  controllerState?: ControllerState | null;
  languageId: string;
};

export function DaysPlanActivity({ items, patientName, onExit, onPhaseStart, onEvent, onComplete, onAbandon, controllerState = null, languageId }: DaysPlanActivityProps) {
  const copy = getDaysPlanCopy(languageId);
  const { speakAction } = useSpeechGuide();
  const [mode, setMode] = useState<PlanMode>('choose');
  const [selectedMode, setSelectedMode] = useState<Exclude<PlanMode, 'choose'>>('morning');
  const [activeIndex, setActiveIndex] = useState(0);
  const [supportShown, setSupportShown] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);
  const [mediaHintShown, setMediaHintShown] = useState(false);

  const activeItem = items[activeIndex];
  const eveningChoices = activeItem ? [activeItem, ...items.filter((item) => item.id !== activeItem.id)].slice(0, daysPlanOptionCount(controllerState, items.length)) : [];
  const advance = async (recordTap = true) => {
    if (!activeItem) return;
    if (recordTap) await onEvent({ type: 'tap', itemId: activeItem.id, correct: true, at: Date.now(), x: 0, y: 0, hintLevelAtTap: supportShown ? 1 : 0, solvedUnassisted: mode === 'evening' && !supportShown });
    setSupportShown(false);
    setMediaHintShown(false);
    if (activeIndex >= items.length - 1) {
      setCompleted(true);
      setStarted(false);
      await onComplete();
      return;
    }
    setActiveIndex((index) => index + 1);
    await onEvent({ type: 'prompt_shown', itemId: items[activeIndex + 1].id, at: Date.now() });
  };
  const answerEvening = async (itemId: string) => {
    if (!activeItem) return;
    const correct = itemId === activeItem.id;
    await onEvent({ type: 'tap', itemId: activeItem.id, correct, at: Date.now(), x: 0, y: 0, hintLevelAtTap: supportShown ? 1 : 0, solvedUnassisted: correct && !supportShown });
    if (!correct) {
      if (!supportShown) await onEvent({ type: 'hint_shown', itemId: activeItem.id, level: 1, at: Date.now() });
      setSupportShown(true);
      return;
    }
    await advance(false);
  };
  const start = async (nextMode: Exclude<PlanMode, 'choose'>) => {
    await onPhaseStart(nextMode);
    setMode(nextMode);
    setActiveIndex(0);
    setSupportShown(false);
    setMediaHintShown(false);
    setCompleted(false);
    setStarted(true);
  };
  const reset = () => {
    setMode('choose');
    setActiveIndex(0);
    setSupportShown(false);
    setMediaHintShown(false);
    setCompleted(false);
    setStarted(false);
  };
  const leave = async () => {
    if (started) await onAbandon();
    onExit();
  };
  const replayReminder = async () => {
    if (activeItem?.audioUri) await onEvent({ type: 'audio_replayed', itemId: activeItem.id, at: Date.now() });
  };

  if (mode === 'choose') {
    return (
      <View style={styles.screen}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>DAY'S PLAN</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.greeting(patientName)}</Text>
        </View>
        <View style={styles.modePanel} accessibilityRole="summary">
          <Text style={styles.panelTitle}>{copy.chooseMoment}</Text>
          <Text style={styles.body}>{copy.phaseHelp}</Text>
          <Text style={styles.switchLabel}>{copy.demoPhase}</Text>
          <View style={styles.phaseSwitch} accessibilityRole="radiogroup" accessibilityLabel={copy.choosePhase}>
            {(['morning', 'evening'] as const).map((phase) => (
              <Pressable key={phase} accessibilityRole="radio" accessibilityState={{ selected: selectedMode === phase }} onPress={() => { const optionLabel = phase === 'morning' ? copy.morning : copy.evening; speakAction(optionLabel); setSelectedMode(phase); }} style={[styles.phaseOption, selectedMode === phase && styles.phaseOptionSelected]}>
                <Text style={[styles.phaseOptionText, selectedMode === phase && styles.phaseOptionTextSelected]}>{phase === 'morning' ? copy.morning : copy.evening}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.stack}>
            <ActionButton label={selectedMode === 'morning' ? copy.beginMorning : copy.beginEvening} onPress={() => start(selectedMode)} disabled={!items.length} />
          </View>
        </View>
        <ActionButton label={copy.home} onPress={leave} variant="quiet" />
      </View>
    );
  }

  if (completed) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>{mode === 'morning' ? copy.morningPlan : copy.eveningPlan}</Text>
          <Text style={styles.title}>{mode === 'morning' ? copy.morningDone : copy.eveningDone}</Text>
          <Text style={styles.body}>{mode === 'morning' ? copy.morningDoneDetail : copy.eveningDoneDetail}</Text>
        </View>
        <Notice>{mode === 'morning' ? copy.morningNotice : copy.eveningNotice}</Notice>
        <ActionButton label={copy.another} onPress={reset} />
        <ActionButton label={copy.home} onPress={leave} variant="quiet" />
      </View>
    );
  }

  if (!activeItem) {
    return <View style={styles.screen}><Notice>{copy.empty}</Notice><ActionButton label={copy.home} onPress={leave} variant="quiet" /></View>;
  }

  const isEvening = mode === 'evening';

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>{isEvening ? copy.eveningPlan : copy.morningPlan}</Text>
        <Text style={styles.title}>{isEvening ? copy.eveningPrompt : copy.morningPrompt}</Text>
        <Text style={styles.progress}>{copy.part(activeIndex + 1, items.length)}</Text>
      </View>

      <View style={styles.planCard} accessibilityRole="summary">
        <Text style={styles.time}>{activeItem.time}</Text>
        <Text style={styles.cardTitle}>{activeItem.title}</Text>
        <Text style={styles.cardDetail}>{activeItem.detail}</Text>
        {!isEvening || mediaHintShown ? <View style={styles.mediaStack}>
          {activeItem.imageUri ? <Image source={{ uri: activeItem.imageUri }} accessibilityLabel={copy.reminderImage(activeItem.title)} style={styles.reminderImage} /> : null}
          {activeItem.audioUri ? <AudioReplay uri={activeItem.audioUri} label={copy.hearReminder} onReplay={() => { void replayReminder(); }} /> : null}
        </View> : null}
      </View>

      {isEvening ? (
        <View style={styles.stack}>
          <Text style={styles.question}>{copy.eveningQuestion}</Text>
          {eveningChoices.map((choice) => <ActionButton key={choice.id} label={choice.title} onPress={() => answerEvening(choice.id)} variant={supportShown && choice.id === activeItem.id ? 'secondary' : 'primary'} />)}
        </View>
      ) : (
        <ActionButton label={copy.ready} onPress={() => advance()} />
      )}

      {supportShown ? (
        <Notice tone="support">{copy.support(activeItem.title)}</Notice>
      ) : null}
      {isEvening ? <ActionButton label={copy.showReminder} onPress={async () => { if (!mediaHintShown) { await onEvent({ type: 'hint_shown', itemId: activeItem.id, level: 2, at: Date.now() }); setMediaHintShown(true); setSupportShown(true); } }} variant="quiet" disabled={mediaHintShown} /> : null}
      <ActionButton label={copy.home} onPress={leave} variant="quiet" />
    </View>
  );
}

type DaysPlanEditorProps = {
  items: DaysPlanItem[];
  onSave: (items: DaysPlanItem[]) => void;
  onCancel: () => void;
  languageId: string;
};

export function DaysPlanEditor({ items, onSave, onCancel, languageId }: DaysPlanEditorProps) {
  const copy = getDaysPlanCopy(languageId);
  const [draftItems, setDraftItems] = useState(items);
  const updateItem = (index: number, changes: Partial<DaysPlanItem>) => {
    setDraftItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  };
  const addItem = () => {
    if (draftItems.length >= 4) return;
    setDraftItems((current) => [...current, { id: `plan-custom-${Date.now()}`, patientId: items[0]?.patientId ?? '', time: '', title: '', detail: '', imageUri: null, audioUri: null, archivedAt: null, updatedAt: Date.now() }]);
  };
  const removeItem = (id: string) => setDraftItems((current) => current.filter((item) => item.id !== id));
  const chooseImage = async (index: number) => {
    try {
      const uri = await pickAndPersistPhoto(`days-plan-${draftItems[index].id}`);
      if (uri) updateItem(index, { imageUri: uri });
    } catch {
      // The editor remains usable when photo permission or selection fails.
    }
  };

  return (
    <View style={styles.editor}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>DAY'S PLAN</Text>
        <Text style={styles.title}>{copy.editorTitle}</Text>
        <Text style={styles.body}>{copy.editorHelp}</Text>
      </View>
      {draftItems.map((item, index) => (
        <View key={item.id} style={styles.editCard}>
          <Text style={styles.cardNumber}>{copy.moment(index + 1)}</Text>
          <View style={styles.editorFields}>
            <Field label={copy.timeLabel} value={item.time} onChangeText={(time) => updateItem(index, { time })} placeholder={copy.timePlaceholder} />
            <Field label={copy.eventLabel} value={item.title} onChangeText={(title) => updateItem(index, { title })} placeholder={copy.eventPlaceholder} />
            <Field label={copy.detailLabel} value={item.detail} onChangeText={(detail) => updateItem(index, { detail })} placeholder={copy.detailPlaceholder} multiline />
            <View style={styles.mediaEditor}>
              {item.imageUri ? <Image source={{ uri: item.imageUri }} accessibilityLabel={copy.selectedImage(item.title)} style={styles.editorImage} /> : null}
              <ActionButton label={item.imageUri ? copy.changeImage : copy.addImage} onPress={() => { void chooseImage(index); }} variant="secondary" />
              <AudioCapture label={copy.reminderAudio} uri={item.audioUri} onCaptured={(audioUri) => updateItem(index, { audioUri })} onProblem={() => undefined} />
            </View>
          </View>
          <ActionButton label={copy.removeMoment} onPress={() => removeItem(item.id)} variant="quiet" compact />
        </View>
      ))}
      <ActionButton label={copy.addMoment} onPress={addItem} variant="secondary" disabled={draftItems.length >= 4} />
      <ActionButton label={copy.save} onPress={() => onSave(draftItems.filter((item) => item.time.trim() && item.title.trim()))} />
      <ActionButton label={copy.cancel} onPress={onCancel} variant="quiet" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: theme.spacing.gap },
  editor: { gap: theme.spacing.gap },
  headerBlock: { gap: 10 },
  eyebrow: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: theme.colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '800' },
  body: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall, lineHeight: 29 },
  progress: { color: theme.colors.mutedInk, fontSize: theme.type.patientSmall, fontWeight: '700' },
  modePanel: { gap: 14, padding: 22, borderWidth: 1, borderColor: theme.colors.leaf, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft },
  panelTitle: { color: theme.colors.ink, fontSize: theme.type.patient, fontWeight: '800' },
  switchLabel: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' },
  phaseSwitch: { flexDirection: 'row', gap: 10 },
  phaseOption: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  phaseOptionSelected: { borderColor: theme.colors.leaf, backgroundColor: theme.colors.leaf },
  phaseOptionText: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' },
  phaseOptionTextSelected: { color: theme.colors.white },
  planCard: { minHeight: 220, justifyContent: 'center', gap: 12, padding: 24, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.media, backgroundColor: theme.colors.surface },
  time: { color: theme.colors.leaf, fontSize: theme.type.patientSmall, fontWeight: '800' },
  cardTitle: { color: theme.colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '800' },
  cardDetail: { color: theme.colors.mutedInk, fontSize: theme.type.patient, lineHeight: 34 },
  mediaStack: { gap: 12, alignItems: 'center' },
  reminderImage: { width: '100%', maxWidth: 280, height: 150, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft },
  question: { color: theme.colors.ink, fontSize: theme.type.patient, lineHeight: 32, fontWeight: '800' },
  stack: { gap: 14 },
  editCard: { gap: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  cardNumber: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  editorFields: { gap: 16 },
  mediaEditor: { gap: 12 },
  editorImage: { width: '100%', height: 160, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft },
});
