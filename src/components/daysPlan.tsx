import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Field, Notice } from './ui';
import { theme } from '../theme';
import type { DaysPlanItem } from '../storage/types';
import type { GameEvent } from '../services/adaptive/types';
import { daysPlanOptionCount } from '../services/adaptive/difficulty';
import type { ControllerState } from '../services/adaptive/types';

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
};

export function DaysPlanActivity({ items, patientName, onExit, onPhaseStart, onEvent, onComplete, onAbandon, controllerState = null }: DaysPlanActivityProps) {
  const [mode, setMode] = useState<PlanMode>('choose');
  const [selectedMode, setSelectedMode] = useState<Exclude<PlanMode, 'choose'>>('morning');
  const [activeIndex, setActiveIndex] = useState(0);
  const [supportShown, setSupportShown] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);

  const activeItem = items[activeIndex];
  const eveningChoices = activeItem ? [activeItem, ...items.filter((item) => item.id !== activeItem.id)].slice(0, daysPlanOptionCount(controllerState, items.length)) : [];
  const advance = async (recordTap = true) => {
    if (!activeItem) return;
    if (recordTap) await onEvent({ type: 'tap', itemId: activeItem.id, correct: true, at: Date.now(), x: 0, y: 0, hintLevelAtTap: supportShown ? 1 : 0, solvedUnassisted: mode === 'evening' && !supportShown });
    setSupportShown(false);
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
    setCompleted(false);
    setStarted(true);
  };
  const reset = () => {
    setMode('choose');
    setActiveIndex(0);
    setSupportShown(false);
    setCompleted(false);
    setStarted(false);
  };
  const leave = async () => {
    if (started) await onAbandon();
    onExit();
  };

  if (mode === 'choose') {
    return (
      <View style={styles.screen}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>DAY'S PLAN</Text>
          <Text style={styles.title}>A gentle plan for today</Text>
          <Text style={styles.body}>{patientName ? `Let’s take today together, ${patientName}.` : 'Let’s take today together.'}</Text>
        </View>
        <View style={styles.modePanel} accessibilityRole="summary">
          <Text style={styles.panelTitle}>Choose a moment</Text>
          <Text style={styles.body}>The morning helps us get ready. The evening helps us remember.</Text>
          <Text style={styles.switchLabel}>Demo phase</Text>
          <View style={styles.phaseSwitch} accessibilityRole="radiogroup" accessibilityLabel="Choose demo phase">
            {(['morning', 'evening'] as const).map((phase) => (
              <Pressable key={phase} accessibilityRole="radio" accessibilityState={{ selected: selectedMode === phase }} onPress={() => setSelectedMode(phase)} style={[styles.phaseOption, selectedMode === phase && styles.phaseOptionSelected]}>
                <Text style={[styles.phaseOptionText, selectedMode === phase && styles.phaseOptionTextSelected]}>{phase === 'morning' ? 'Morning' : 'Evening'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.stack}>
            <ActionButton label={selectedMode === 'morning' ? 'Begin morning plan' : 'Begin evening plan'} onPress={() => start(selectedMode)} disabled={!items.length} />
          </View>
        </View>
        <ActionButton label="Home" onPress={leave} variant="quiet" />
      </View>
    );
  }

  if (completed) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>{mode === 'morning' ? 'MORNING PLAN' : 'EVENING PLAN'}</Text>
          <Text style={styles.title}>{mode === 'morning' ? 'You are ready for today' : 'That was a lovely moment'}</Text>
          <Text style={styles.body}>{mode === 'morning' ? 'Your plan is here whenever you need it.' : 'Thank you for taking this time together.'}</Text>
        </View>
        <Notice>{mode === 'morning' ? 'Your day can unfold one familiar step at a time.' : 'You can come back again whenever it feels right.'}</Notice>
        <ActionButton label="Choose another moment" onPress={reset} />
        <ActionButton label="Home" onPress={leave} variant="quiet" />
      </View>
    );
  }

  if (!activeItem) {
    return <View style={styles.screen}><Notice>No plan items have been added yet.</Notice><ActionButton label="Home" onPress={leave} variant="quiet" /></View>;
  }

  const isEvening = mode === 'evening';

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>{isEvening ? 'EVENING PLAN' : 'MORNING PLAN'}</Text>
        <Text style={styles.title}>{isEvening ? 'What happened today?' : 'Here is today’s plan'}</Text>
        <Text style={styles.progress}>{`Part ${activeIndex + 1} of ${items.length}`}</Text>
      </View>

      <View style={styles.planCard} accessibilityRole="summary">
        <Text style={styles.time}>{activeItem.time}</Text>
        <Text style={styles.cardTitle}>{activeItem.title}</Text>
        <Text style={styles.cardDetail}>{activeItem.detail}</Text>
      </View>

      {isEvening ? (
        <View style={styles.stack}>
          <Text style={styles.question}>Which moment happened today?</Text>
          {eveningChoices.map((choice) => <ActionButton key={choice.id} label={choice.title} onPress={() => answerEvening(choice.id)} variant={supportShown && choice.id === activeItem.id ? 'secondary' : 'primary'} />)}
        </View>
      ) : (
        <ActionButton label="I’m ready" onPress={() => advance()} />
      )}

      {supportShown ? (
        <Notice tone="support">{`That’s all right. This was ${activeItem.title.toLowerCase()}. Choose the green button when you are ready.`}</Notice>
      ) : null}
      <ActionButton label="Show a gentle clue" onPress={async () => { if (!supportShown) { await onEvent({ type: 'hint_shown', itemId: activeItem.id, level: 1, at: Date.now() }); setSupportShown(true); } }} variant="quiet" disabled={supportShown} />
      <ActionButton label="Home" onPress={leave} variant="quiet" />
    </View>
  );
}

type DaysPlanEditorProps = {
  items: DaysPlanItem[];
  onSave: (items: DaysPlanItem[]) => void;
  onCancel: () => void;
};

export function DaysPlanEditor({ items, onSave, onCancel }: DaysPlanEditorProps) {
  const [draftItems, setDraftItems] = useState(items);
  const updateItem = (index: number, changes: Partial<DaysPlanItem>) => {
    setDraftItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  };
  const addItem = () => {
    if (draftItems.length >= 4) return;
    setDraftItems((current) => [...current, { id: `plan-custom-${Date.now()}`, patientId: items[0]?.patientId ?? '', time: '', title: '', detail: '', archivedAt: null, updatedAt: Date.now() }]);
  };
  const removeItem = (id: string) => setDraftItems((current) => current.filter((item) => item.id !== id));

  return (
    <View style={styles.editor}>
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>DAY'S PLAN</Text>
        <Text style={styles.title}>Prepare today’s familiar moments</Text>
        <Text style={styles.body}>Add up to four simple things that may happen today. These details stay on this device for now.</Text>
      </View>
      {draftItems.map((item, index) => (
        <View key={item.id} style={styles.editCard}>
          <Text style={styles.cardNumber}>{`Moment ${index + 1}`}</Text>
          <View style={styles.editorFields}>
            <Field label="Time or part of day" value={item.time} onChangeText={(time) => updateItem(index, { time })} placeholder="This morning" />
            <Field label="What is happening?" value={item.title} onChangeText={(title) => updateItem(index, { title })} placeholder="Have tea together" />
            <Field label="A familiar detail" value={item.detail} onChangeText={(detail) => updateItem(index, { detail })} placeholder="A warm cup at home" multiline />
          </View>
          <ActionButton label="Remove this moment" onPress={() => removeItem(item.id)} variant="quiet" compact />
        </View>
      ))}
      <ActionButton label="Add another moment" onPress={addItem} variant="secondary" disabled={draftItems.length >= 4} />
      <ActionButton label="Save today’s plan" onPress={() => onSave(draftItems.filter((item) => item.time.trim() && item.title.trim()))} />
      <ActionButton label="Cancel" onPress={onCancel} variant="quiet" />
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
  question: { color: theme.colors.ink, fontSize: theme.type.patient, lineHeight: 32, fontWeight: '800' },
  stack: { gap: 14 },
  editCard: { gap: 16, padding: 20, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white },
  cardNumber: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800' },
  editorFields: { gap: 16 },
});
