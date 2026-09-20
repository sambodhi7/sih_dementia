import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { touchFeedback } from '../../lib/haptics';
import { speechLanguageCodeFromAppId } from '../../speech/packRegistry';
import { speakText, stopSpeaking } from '../../speech/runtime';
import { startWhosWhoSession, persistGameEvent } from '../../storage/sessions';
import { closeRecipeSession } from './storage';
import { setLocalSetting } from '../../storage/items';
import type { StoredSession } from '../../storage/types';
import { getRecipeCopy } from './copy';
import { choiceFits, pantry, recipes, remainingIngredients, nextRecipeStep } from './model';
import type { Ingredient, RecipeId } from './model';
import { IngredientArt, RecipeArt } from './RecipeArt';

function Button({ text, onPress, disabled = false, secondary = false }: { text: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} hitSlop={8} pressRetentionOffset={16} onPressIn={() => touchFeedback()} onPress={onPress} style={({pressed}) => [s.button, secondary && s.secondary, (pressed || disabled) && s.pressed]}><Text style={[s.buttonText, secondary && {color: theme.colors.ink}]}>{text}</Text></Pressable>;
}

export function RecipeGame({ patientId, language, onHome }: { patientId: string; language: string; onHome: () => void }) {
  const copy = getRecipeCopy(language);
  const [recipe, setRecipe] = useState<RecipeId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [used, setUsed] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [pending, setPending] = useState<Ingredient | null>(null);
  const [hint, setHint] = useState(false);
  const [spread, setSpread] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [progress, setProgress] = useState(0);
  const session = useRef<StoredSession | null>(null);
  const lock = useRef(false);
  const assisted = useRef(false);
  const reducedMotion = useRef(false);
  const animation = useRef(new Animated.Value(0)).current;
  const scroll = useRef<ScrollView>(null);
  const step = recipe ? recipes[recipe][stepIndex] : null;
  const itemId = recipe && step ? `recipe:${recipe}:${step.id}` : '';
  const spoken = selected ? `${copy.add}: ${copy.ingredients[selected]}` : done ? copy.thanks : step?.action ? copy.actions[step.action] : copy.next;
  const speechLanguageCode = speechLanguageCodeFromAppId(language) ?? 'en';

  useEffect(() => {
    const motionListener = animation.addListener(({value}) => setProgress(value));
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { reducedMotion.current = value; });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reducedMotion.current = value; });
    return () => { sub.remove(); animation.removeListener(motionListener); animation.stopAnimation(); void stopSpeaking().catch(() => undefined); };
  }, [animation]);
  const say = async (text: string) => {
    try {
      await stopSpeaking();
      await speakText(text, { languageCode: speechLanguageCode, rate: .85 });
    } catch { setProblem(copy.audioProblem); }
  };
  useEffect(() => { if (recipe) void say(spoken); }, [recipe, stepIndex, selected, done]);

  // No event queue in component state: persist before accepting another action.
  const perform = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setProblem('');
    try { await work(); } catch { setProblem(copy.problem); }
    finally { lock.current = false; setBusy(false); }
  };
  const leave = () => { void perform(async () => {
    // Unavailable speech must never prevent returning home.
    await stopSpeaking().catch(() => undefined);
    if (session.current) await closeRecipeSession(session.current, !done);
    session.current = null; onHome();
  }); };
  const leaveRef = useRef(leave); leaveRef.current = leave;
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { leaveRef.current(); return true; }); return () => sub.remove(); }, []);
  const open = (id: RecipeId) => { void perform(async () => {
    const nextSession = await startWhosWhoSession(patientId, `recipe:${id}`, false, 'recipe');
    session.current = nextSession;
    await persistGameEvent(nextSession.id, {type: 'prompt_shown', itemId: `recipe:${id}:${recipes[id][0].id}`, at: Date.now()});
    setRecipe(id); setUsed([]); setStepIndex(0); setSelected(null); setPending(null); setHint(false); setDone(false); setSpread(false); setRolled(false); assisted.current = false;
    scroll.current?.scrollTo({y: 0, animated: false});
  }); };
  const advance = async (ingredients: Ingredient[]) => {
    if (!recipe || !step || !session.current) return;
    const next = nextRecipeStep(recipe, stepIndex, ingredients);
    if (next === stepIndex) return;
    if (next >= recipes[recipe].length) {
      await closeRecipeSession(session.current, false); session.current = null; setDone(true);
    } else {
      await persistGameEvent(session.current.id, { type: 'prompt_shown', itemId: `recipe:${recipe}:${recipes[recipe][next].id}`, at: Date.now() });
      setStepIndex(next);
    }
    setHint(false); setPending(null); assisted.current = false; setProgress(0);
    scroll.current?.scrollTo({y: 0, animated: false});
  };
  const choose = (ingredient: Ingredient) => { void perform(async () => {
    if (!step || !session.current) return;
    // Household order is not a clinical error. Offer a remembered family variation.
    if (!choiceFits(step, ingredient)) {
      setPending(ingredient);
      await persistGameEvent(session.current.id, {type: 'tap', itemId, correct: false, at: Date.now(), x: 0, y: 0, hintLevelAtTap: hint ? 3 : 0, solvedUnassisted: false, sequenceViolation: true});
      return;
    }
    await persistGameEvent(session.current.id, {type: 'tap', itemId, correct: true, at: Date.now(), x: 0, y: 0, hintLevelAtTap: hint ? 3 : 0, solvedUnassisted: false, sequenceViolation: false});
    animation.setValue(0); setProgress(0); setSelected(ingredient); setPending(null);
  }); };
  const animate = () => new Promise<void>(resolve => {
    animation.setValue(0);
    Animated.timing(animation, {toValue: 1, duration: reducedMotion.current ? 0 : 400, useNativeDriver: true}).start(() => resolve());
  });
  const finishAction = () => { void perform(async () => {
    if (!recipe || !step || !session.current) return;
    // Guided manipulation is always assisted, never an independent recall score.
    await persistGameEvent(session.current.id, {type: 'tap', itemId, correct: true, at: Date.now(), x: 0, y: 0, hintLevelAtTap: hint ? 3 : 0, solvedUnassisted: false, sequenceViolation: false});
    touchFeedback();
    await animate();
    const nextUsed = selected ? [...used, selected] : used;
    await setLocalSetting(`recipe:${patientId}:${recipe}:ingredients`, JSON.stringify(nextUsed));
    // Keep the current action retryable until the next prompt/session close is saved.
    await advance(nextUsed);
    setUsed(nextUsed); setSelected(null);
    if (step.action === 'spread') setSpread(true);
    if (step.action === 'roll') setRolled(true);
  }); };
  const actionRef = useRef(finishAction); actionRef.current = finishAction;
  const canMove = !done && Boolean(selected || step?.action);
  const canMoveRef = useRef(canMove); canMoveRef.current = canMove && !busy && !done;
  const progressRef = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => canMoveRef.current,
    onMoveShouldSetPanResponder: () => canMoveRef.current,
    onPanResponderGrant: () => { progressRef.current = 0; setProgress(0); },
    onPanResponderMove: (_, gesture) => { const value = Math.min(1, Math.hypot(gesture.dx, gesture.dy) / 80); progressRef.current = value; setProgress(value); },
    onPanResponderRelease: () => { if (progressRef.current >= .65) actionRef.current(); else setProgress(0); },
    onPanResponderTerminate: () => setProgress(0), onPanResponderTerminationRequest: () => false,
  })).current;
  const replay = () => { void perform(async () => { if (session.current) { await persistGameEvent(session.current.id, {type: 'audio_replayed', itemId, at: Date.now()}); assisted.current = true; } await say(spoken); }); };
  const reveal = () => { void perform(async () => {
    if (session.current) await persistGameEvent(session.current.id, {type: 'hint_shown', itemId, level: 3, at: Date.now()});
    assisted.current = true; setHint(true);
    if (step?.choices) await say(step.choices.filter(i => !used.includes(i)).map(i => copy.ingredients[i]).join(', '));
  }); };
  return <ScrollView ref={scroll} contentContainerStyle={s.page}>
    <View style={s.intro}><Text style={s.eyebrow}>{copy.title}</Text>
    {!recipe ? <><Text style={s.title}>{copy.choose}</Text><Text style={s.body}>{copy.invitation}</Text>{(Object.keys(recipes) as RecipeId[]).map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={copy.names[id]} disabled={busy} hitSlop={6} pressRetentionOffset={16} onPressIn={() => touchFeedback()} onPress={() => open(id)} style={({pressed}) => [s.card, (pressed || busy) && s.pressed]}><View pointerEvents="none" style={{height: 150}}><RecipeArt recipe={id} ingredients={pantry[id]} spread rolled served /></View><Text pointerEvents="none" style={s.heading}>{copy.names[id]}</Text><Text pointerEvents="none" style={s.body}>{copy.descriptions[id]}</Text></Pressable>)}<Text style={s.body}>{copy.symbolic}</Text></>
    : <><Text style={s.title}>{done ? copy.finish : copy.names[recipe]}</Text><Text accessibilityLiveRegion="polite" style={s.heading}>{spoken}</Text>
      {pending ? <View accessibilityLiveRegion="polite" style={s.familyNote}><Text style={s.heading}>{copy.variant}</Text><Text style={s.body}>{copy.family}</Text><Button text={`${copy.continue}: ${copy.ingredients[pending]}`} onPress={() => { animation.setValue(0); setSelected(pending); setPending(null); assisted.current = true; }} secondary/><Button text={copy.hint} onPress={() => { setPending(null); reveal(); }} secondary/></View> : null}
      <View {...pan.panHandlers} accessible={canMove} accessibilityRole={canMove ? 'button' : 'image'} accessibilityLabel={canMove ? spoken : copy.names[recipe]} accessibilityActions={canMove ? [{name: 'activate', label: spoken}] : []} onAccessibilityAction={() => { if (canMove) finishAction(); }} style={s.scene}>
        <Animated.View style={{flex: 1, transform: [{translateX: step?.action === 'roll' ? progress * 24 : 0}, {scale: step?.action === 'serve' ? 1 + progress * .06 : 1}]}}><RecipeArt recipe={recipe} ingredients={used} spread={spread} rolled={rolled || (step?.action === 'roll' && progress > .6)} served={done} progress={progress} stirring={step?.action === 'stir'} /></Animated.View>
        {selected && <Animated.View pointerEvents="none" style={[s.floating, { opacity: animation.interpolate({inputRange:[0,1],outputRange:[1,0]}), transform:[{translateY: animation.interpolate({inputRange:[0,1],outputRange:[0,90]})},{rotate: `${progress*35}deg`}] }]}><IngredientArt ingredient={selected}/></Animated.View>}
        {canMove && !done && <Text pointerEvents="none" style={s.arrow}>↔</Text>}
      </View>
      {done ? <><Button text={copy.another} onPress={() => {setRecipe(null); setDone(false);}} /><Text style={s.body}>{copy.family}</Text></> : <>
        {canMove ? <><Text style={s.body}>{copy.gesture}</Text><Button text={selected ? `${copy.add}: ${copy.ingredients[selected]}` : copy.actions[step!.action!]} disabled={busy} onPress={finishAction}/></> : <View style={s.choices}>{remainingIngredients(recipe, used).map(ingredient => <Pressable key={ingredient} accessibilityRole="button" accessibilityLabel={copy.ingredients[ingredient]} disabled={busy} hitSlop={6} pressRetentionOffset={16} onPressIn={() => touchFeedback()} onPress={() => choose(ingredient)} style={({pressed}) => [s.ingredient, hint && step?.choices?.includes(ingredient) && s.highlight, (pressed || busy) && s.pressed]}><View pointerEvents="none" style={{width: 96}}><IngredientArt ingredient={ingredient}/></View><Text pointerEvents="none" style={s.label}>{copy.ingredients[ingredient]}</Text></Pressable>)}</View>}
        <Button text={copy.again} onPress={replay} disabled={busy} secondary/>
        {!canMove && <Button text={copy.hint} onPress={reveal} disabled={busy} secondary/>}
      </>}
    </>}
    </View>{busy ? <Text accessibilityLiveRegion="polite" style={s.status}>{copy.saving}</Text> : null}
    {problem ? <Text accessibilityLiveRegion="polite" style={s.problem}>{problem}</Text> : null}
    <Button text={copy.home} onPress={leave} disabled={busy} secondary/>
  </ScrollView>;
}
const s = StyleSheet.create({
  page: {padding: theme.spacing.page, paddingTop: 32, paddingBottom: 40, gap: 20, backgroundColor: theme.colors.canvas, flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center'},
  intro: {gap: 20}, eyebrow: {fontSize: 14, color: theme.colors.leaf, fontWeight: '800', letterSpacing: .7}, title: {fontSize: 36, color: theme.colors.ink, fontWeight: '700'}, heading: {fontSize: 26, color: theme.colors.ink, fontWeight: '700'}, body: {fontSize: 22, lineHeight: 31, color: theme.colors.mutedInk},
  card: {padding: 18, borderRadius: theme.radius.media, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border, gap: 14},
  scene: {height: 260, backgroundColor: theme.colors.surface, borderRadius: theme.radius.media, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border}, floating: {position: 'absolute', top: 10, left: '30%', width: '40%'}, arrow: {position: 'absolute', bottom: 6, alignSelf: 'center', color: theme.colors.amber, fontSize: 34},
  choices: {gap: 14}, ingredient: {minHeight: 104, flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 2, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white},
  label: {fontSize: 24, color: theme.colors.ink, flex: 1, fontWeight: '700'}, highlight: {borderColor: theme.colors.amber, backgroundColor: theme.colors.amberSoft},
  familyNote: {padding: 16, gap: 12, borderRadius: theme.radius.control, backgroundColor: theme.colors.amberSoft, borderWidth: 1.5, borderColor: theme.colors.amber},
  status: {fontSize: 20, color: theme.colors.leaf, fontWeight: '700', textAlign: 'center'}, problem: {fontSize: 20, lineHeight: 28, color: theme.colors.ink, backgroundColor: theme.colors.amberSoft, borderRadius: theme.radius.control, padding: 16},
  pressed: {opacity: .62, transform: [{scale: .985}]}, button: {minHeight: 68, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, backgroundColor: theme.colors.leaf, borderColor: theme.colors.leaf, borderWidth: 1.5}, secondary: {backgroundColor: theme.colors.canvas}, buttonText: {fontSize: 24, fontWeight: '700', color: theme.colors.white, textAlign: 'center'},
});
