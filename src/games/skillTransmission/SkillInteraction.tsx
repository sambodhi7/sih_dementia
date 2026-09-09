import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { touchFeedback } from '../../lib/haptics';
import type { SkillCatalogKey } from '../../storage/types';
import { theme } from '../../theme';

export const PLAYABLE_SKILLS: readonly SkillCatalogKey[] = ['tie_shoes', 'fold_gamosa', 'button_shirt', 'brush_teeth'];

export function isPlayableSkill(skill: SkillCatalogKey): boolean {
  return PLAYABLE_SKILLS.includes(skill);
}

export type SkillInteractionLabels = {
  laceInstruction: string;
  laceLeft: string;
  laceRight: string;
  makeBow: string;
  foldLeft: string;
  foldRight: string;
  foldAgain: string;
  buttonInstruction: string;
  buttonLabel: string;
  dragHint: string;
  swipeHint: string;
  brushWash: string;
  brushCap: string;
  brushPaste: string;
  brushClean: string;
  brushRinse: string;
  toothbrush: string;
  toothpasteCap: string;
  toothpaste: string;
};

type Point = { x: number; y: number };

function DraggablePiece({
  start,
  target,
  label,
  hint,
  done,
  tapToComplete = true,
  dropTolerance = 82,
  acceptHorizontalSwipe = false,
  onDone,
  children,
}: {
  start: Point;
  target: Point;
  label: string;
  hint: string;
  done: boolean;
  tapToComplete?: boolean;
  dropTolerance?: number;
  acceptHorizontalSwipe?: boolean;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const offset = useRef(new Animated.ValueXY()).current;
  const completedRef = useRef(done);
  if (done) completedRef.current = true;
  const destination = useMemo(() => ({ x: target.x - start.x, y: target.y - start.y }), [start.x, start.y, target.x, target.y]);

  const settle = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    touchFeedback('support');
    Animated.spring(offset, { toValue: destination, useNativeDriver: false, speed: 18, bounciness: 4 }).start(onDone);
  };

  const responder = useMemo(() => PanResponder.create({
    // Claim the grip as soon as it is touched. This prevents the surrounding
    // ScrollView or the accessibility Pressable from swallowing a short drag.
    onStartShouldSetPanResponder: () => !completedRef.current,
    onStartShouldSetPanResponderCapture: () => !completedRef.current,
    onMoveShouldSetPanResponder: (_, gesture) => !completedRef.current && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
    onMoveShouldSetPanResponderCapture: (_, gesture) => !completedRef.current && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      if (!completedRef.current) offset.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      // Squeezing is deliberately forgiving: the elder may naturally push or
      // pull the back of the tube. A clear horizontal gesture still animates
      // the grip forward toward the nozzle.
      const closeEnough = acceptHorizontalSwipe
        ? Math.abs(gesture.dx) > 24 && Math.abs(gesture.dy) < 90
        : Math.hypot(gesture.dx - destination.x, gesture.dy - destination.y) < dropTolerance;
      if (closeEnough) settle();
      else Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 20, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => {
      if (!completedRef.current) Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  }), [acceptHorizontalSwipe, destination.x, destination.y, dropTolerance, offset]);

  return <Animated.View {...responder.panHandlers} style={[styles.dragPiece, { left: start.x, top: start.y, transform: offset.getTranslateTransform() }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={tapToComplete ? settle : undefined} onAccessibilityTap={settle} style={({ pressed }) => [styles.dragPressable, pressed && styles.pressed]}>
      {children}
    </Pressable>
  </Animated.View>;
}

function useFinishWhen(complete: boolean, onComplete: () => void) {
  const finished = useRef(false);
  useEffect(() => {
    if (!complete || finished.current) return;
    finished.current = true;
    const timeout = setTimeout(onComplete, 520);
    return () => clearTimeout(timeout);
  }, [complete, onComplete]);
}

function ShoelaceGame({ labels, onComplete }: { labels: SkillInteractionLabels; onComplete: () => void }) {
  const [leftDone, setLeftDone] = useState(false);
  const [rightDone, setRightDone] = useState(false);
  const [bowDone, setBowDone] = useState(false);
  useFinishWhen(bowDone, onComplete);

  const leftStart = useMemo(() => ({ x: 22, y: 232 }), []);
  const rightStart = useMemo(() => ({ x: 228, y: 232 }), []);
  const leftTarget = useMemo(() => ({ x: 111, y: 118 }), []);
  const rightTarget = useMemo(() => ({ x: 151, y: 118 }), []);

  return <View style={styles.interactionWrap}>
    <Text accessibilityLiveRegion="polite" style={styles.instruction}>{leftDone && rightDone ? labels.makeBow : labels.laceInstruction}</Text>
    <View style={styles.canvas}>
      <Svg width="304" height="330" viewBox="0 0 304 330" style={StyleSheet.absoluteFill}>
        <Path d="M76 188 L125 160 L174 160 L228 188 L248 285 Q150 309 54 285 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" />
        <Path d="M55 285 Q151 306 248 285" fill="none" stroke={theme.colors.ink} strokeWidth="8" strokeLinecap="round" />
        {[190, 220, 250].map((y) => <Line key={y} x1="112" y1={y} x2="193" y2={y} stroke={theme.colors.white} strokeWidth="13" strokeLinecap="round" />)}
        <Line x1="118" y1="190" x2="49" y2="259" stroke={theme.colors.amber} strokeWidth="7" strokeLinecap="round" />
        <Line x1="187" y1="190" x2="255" y2="259" stroke={theme.colors.amber} strokeWidth="7" strokeLinecap="round" />
        <Circle cx="138" cy="145" r="31" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="3" strokeDasharray="6 6" />
        <Circle cx="178" cy="145" r="31" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="3" strokeDasharray="6 6" />
      </Svg>
      <DraggablePiece start={leftStart} target={leftTarget} label={labels.laceLeft} hint={labels.dragHint} done={leftDone} onDone={() => setLeftDone(true)}>
        <View style={styles.laceEnd}><View style={styles.laceLine} /></View>
      </DraggablePiece>
      <DraggablePiece start={rightStart} target={rightTarget} label={labels.laceRight} hint={labels.dragHint} done={rightDone} onDone={() => setRightDone(true)}>
        <View style={styles.laceEnd}><View style={styles.laceLine} /></View>
      </DraggablePiece>
      {leftDone && rightDone ? <Pressable accessibilityRole="button" accessibilityLabel={labels.makeBow} onPress={() => { touchFeedback('support'); setBowDone(true); }} style={({ pressed }) => [styles.bowButton, bowDone && styles.successTarget, pressed && styles.pressed]}>
        <View style={styles.bowLoop} /><View style={[styles.bowLoop, styles.bowLoopRight]} /><View style={styles.bowKnot} />
      </Pressable> : null}
    </View>
  </View>;
}

function GamosaGame({ labels, onComplete }: { labels: SkillInteractionLabels; onComplete: () => void }) {
  const [stage, setStage] = useState(0);
  const leftFold = useRef(new Animated.Value(0)).current;
  const rightFold = useRef(new Animated.Value(0)).current;
  const finalFold = useRef(new Animated.Value(0)).current;
  const swipeOffset = useRef(new Animated.ValueXY()).current;
  const moving = useRef(false);
  useFinishWhen(stage === 3, onComplete);

  const advance = () => {
    if (moving.current || stage >= 3) return;
    moving.current = true;
    touchFeedback('support');
    const finishStage = (nextStage: number) => {
      swipeOffset.setValue({ x: 0, y: 0 });
      moving.current = false;
      setStage(nextStage);
    };
    if (stage === 0) Animated.timing(leftFold, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => finishStage(1));
    else if (stage === 1) Animated.timing(rightFold, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => finishStage(2));
    else if (stage === 2) Animated.timing(finalFold, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => finishStage(3));
  };
  const instruction = stage === 0 ? labels.foldLeft : stage === 1 ? labels.foldRight : labels.foldAgain;
  const swipeResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !moving.current && stage === 2,
    onMoveShouldSetPanResponder: (_, gesture) => !moving.current && stage < 3 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
    onMoveShouldSetPanResponderCapture: (_, gesture) => !moving.current && stage < 3 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      if (moving.current) return;
      if (stage === 0) swipeOffset.setValue({ x: Math.max(0, Math.min(96, gesture.dx)), y: 0 });
      else if (stage === 1) swipeOffset.setValue({ x: Math.min(0, Math.max(-96, gesture.dx)), y: 0 });
      else swipeOffset.setValue({ x: 0, y: Math.min(0, Math.max(-110, gesture.dy)) });
    },
    onPanResponderRelease: (_, gesture) => {
      const correctDirection = stage === 0
        ? gesture.dx > 52 && Math.abs(gesture.dy) < 90
        : stage === 1
          ? gesture.dx < -52 && Math.abs(gesture.dy) < 90
          : gesture.dy < -52 && Math.abs(gesture.dx) < 90;
      if (correctDirection) advance();
      else Animated.spring(swipeOffset, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 20, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(swipeOffset, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(),
  });

  return <View style={styles.interactionWrap}>
    <Text accessibilityLiveRegion="polite" style={styles.instruction}>{instruction}</Text>
    <View style={styles.canvas}>
      <View style={styles.clothShadow} />
      <Animated.View style={[styles.foldedCloth, { transform: [{ scaleY: finalFold.interpolate({ inputRange: [0, 1], outputRange: [1, 0.52] }) }, { translateY: finalFold.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }) }] }]}>
        <View style={styles.clothCenter}><View style={styles.gamosaStripe} /><View style={[styles.gamosaStripe, styles.stripeBottom]} /></View>
        <Animated.View style={[styles.clothPanel, styles.clothLeft, { transform: [{ translateX: leftFold.interpolate({ inputRange: [0, 1], outputRange: [0, 76] }) }, { scaleX: leftFold.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }] }]} />
        <Animated.View style={[styles.clothPanel, styles.clothRight, { transform: [{ translateX: rightFold.interpolate({ inputRange: [0, 1], outputRange: [0, -76] }) }, { scaleX: rightFold.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }] }]} />
      </Animated.View>
      {stage < 3 ? <Animated.View
        {...swipeResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={instruction}
        accessibilityHint={labels.swipeHint}
        onAccessibilityTap={advance}
        style={[styles.foldSwipeZone, stage === 0 ? styles.foldSwipeLeft : stage === 1 ? styles.foldSwipeRight : styles.foldSwipeCenter]}
      >
        <Animated.View style={[styles.foldSwipeHandle, { transform: swipeOffset.getTranslateTransform() }]}>
          <Text style={styles.foldArrow}>{stage === 0 ? '→' : stage === 1 ? '←' : '↑'}</Text>
        </Animated.View>
      </Animated.View> : null}
    </View>
  </View>;
}

function ShirtGame({ labels, onComplete }: { labels: SkillInteractionLabels; onComplete: () => void }) {
  const [buttonIndex, setButtonIndex] = useState(0);
  const closure = useRef(new Animated.Value(0)).current;
  useFinishWhen(buttonIndex === 3, onComplete);

  const finishButton = () => {
    const nextIndex = buttonIndex + 1;
    Animated.timing(closure, { toValue: nextIndex, duration: 440, useNativeDriver: true }).start(() => setButtonIndex(nextIndex));
  };

  const leftShift = closure.interpolate({ inputRange: [0, 3], outputRange: [0, 15] });
  const rightShift = closure.interpolate({ inputRange: [0, 3], outputRange: [0, -15] });
  const rowY = [65, 150, 235];

  return <View style={styles.interactionWrap}>
    <Text accessibilityLiveRegion="polite" style={styles.instruction}>{labels.buttonInstruction}</Text>
    <View style={styles.canvas}>
      <Animated.View style={[styles.shirtHalf, styles.shirtLeftHalf, { transform: [{ translateX: leftShift }] }]}>
        <Svg width="132" height="314" viewBox="0 0 132 314">
          <Path d="M4 35 L50 7 L94 34 L128 62 L120 310 H16 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" strokeLinejoin="round" />
          <Path d="M94 34 L128 62 L128 310" fill="none" stroke={theme.colors.white} strokeWidth="9" />
          {rowY.map((y, index) => index >= buttonIndex ? <Circle key={y} cx="113" cy={y + 24} r="22" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="3" opacity={index === buttonIndex ? 0.22 : 0.85} /> : null)}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.shirtHalf, styles.shirtRightHalf, { transform: [{ translateX: rightShift }] }]}>
        <Svg width="132" height="314" viewBox="0 0 132 314">
          <Path d="M4 62 L38 34 L82 7 L128 35 L116 310 H4 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" strokeLinejoin="round" />
          <Path d="M4 62 L4 310" fill="none" stroke={theme.colors.white} strokeWidth="9" />
          {rowY.map((y, index) => index >= buttonIndex ? <Rect key={y} x="2" y={y + 5} width="13" height="39" rx="7" fill={theme.colors.white} stroke={theme.colors.amber} strokeWidth="3" /> : null)}
        </Svg>
      </Animated.View>
      {rowY.map((y, index) => index < buttonIndex ? <View key={y} style={[styles.fastenedButton, { top: y }]}><View style={styles.buttonHoles}><View style={styles.buttonHole} /><View style={styles.buttonHole} /><View style={styles.buttonHole} /><View style={styles.buttonHole} /></View></View> : null)}
      {buttonIndex < 3 ? <DraggablePiece
        key={buttonIndex}
        start={{ x: 98 + buttonIndex * 5, y: rowY[buttonIndex] }}
        target={{ x: 139 - buttonIndex * 5, y: rowY[buttonIndex] }}
        label={`${labels.buttonLabel} ${buttonIndex + 1}`}
        hint={labels.dragHint}
        done={false}
        tapToComplete={false}
        dropTolerance={25}
        onDone={finishButton}
      >
        <View style={styles.shirtButton}><View style={styles.buttonHoles}><View style={styles.buttonHole} /><View style={styles.buttonHole} /><View style={styles.buttonHole} /><View style={styles.buttonHole} /></View></View>
      </DraggablePiece> : null}
    </View>
  </View>;
}

function BrushPiece({ type }: { type: 'brush' | 'cap' | 'squeeze' }) {
  if (type === 'cap') return <View style={styles.pasteCap}><View style={styles.capRidges} /></View>;
  if (type === 'squeeze') return <View style={styles.squeezeGrip}><Text style={styles.squeezeArrow}>→</Text></View>;
  return <Svg width="86" height="46" viewBox="0 0 86 46"><Path d="M8 27 H62" fill="none" stroke={theme.colors.leaf} strokeWidth="13" strokeLinecap="round" /><Rect x="58" y="7" width="25" height="30" rx="5" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="4" />{[0, 1, 2, 3, 4].map((index) => <Line key={index} x1={63 + index * 4} y1="11" x2={63 + index * 4} y2="33" stroke="#5C9EAD" strokeWidth="2" strokeLinecap="round" />)}</Svg>;
}

function BrushTeethGame({ labels, onComplete }: { labels: SkillInteractionLabels; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [pasteApplied, setPasteApplied] = useState(false);
  useFinishWhen(step === 5, onComplete);
  const steps = [
    { instruction: labels.brushWash, label: labels.toothbrush, type: 'brush' as const, start: { x: 208, y: 230 }, target: { x: 70, y: 160 }, tolerance: 55 },
    { instruction: labels.brushCap, label: labels.toothpasteCap, type: 'cap' as const, start: { x: 168, y: 132 }, target: { x: 224, y: 58 }, tolerance: 35 },
    { instruction: labels.brushPaste, label: labels.toothpaste, type: 'squeeze' as const, start: { x: 29, y: 146 }, target: { x: 96, y: 146 }, tolerance: 24 },
    { instruction: labels.brushClean, label: labels.toothbrush, type: 'brush' as const, start: { x: 36, y: 170 }, target: { x: 199, y: 170 }, tolerance: 45 },
    { instruction: labels.brushRinse, label: labels.toothbrush, type: 'brush' as const, start: { x: 208, y: 230 }, target: { x: 70, y: 160 }, tolerance: 55 },
  ];
  const current = steps[Math.min(step, steps.length - 1)];

  return <View style={styles.interactionWrap}>
    <Text accessibilityLiveRegion="polite" style={styles.instruction}>{current.instruction}</Text>
    <View style={styles.canvas}>
      <Svg width="304" height="330" viewBox="0 0 304 330" style={StyleSheet.absoluteFill}>
        {(step === 0 || step === 4) ? <>
          <Path d="M48 64 H156 V105 H122 V127" fill="none" stroke={theme.colors.ink} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M47 246 Q65 215 108 215 H190 Q230 215 253 246 V282 H47 Z" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="5" />
          {[0, 1, 2, 3].map((index) => <Line key={index} x1={104 + index * 12} y1="130" x2={104 + index * 12} y2="181" stroke="#5C9EAD" strokeWidth="6" strokeLinecap="round" />)}
          <Path d="M137 143 V160 M128 151 L137 160 L146 151" fill="none" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="68" y="172" width="104" height="30" rx="15" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" strokeDasharray="7 7" />
          <Rect x="146" y="166" width="28" height="42" rx="7" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="4" strokeDasharray="5 5" />
        </> : null}
        {step === 1 ? <>
          <Path d="M60 132 Q52 170 60 206 H193 Q206 170 193 132 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" strokeLinejoin="round" />
          <Rect x="184" y="144" width="42" height="50" rx="8" fill={theme.colors.white} stroke={theme.colors.amber} strokeWidth="5" />
          <Path d="M76 151 H170" stroke={theme.colors.white} strokeWidth="9" strokeLinecap="round" />
          <Path d="M76 181 H144" stroke={theme.colors.amber} strokeWidth="9" strokeLinecap="round" />
          <Circle cx="255" cy="90" r="28" fill={theme.colors.amberSoft} fillOpacity="0.45" stroke={theme.colors.amber} strokeWidth="4" strokeDasharray="7 7" />
          <Path d="M218 132 C238 120 249 110 252 104 M244 102 L252 104 L250 113" fill="none" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
        {step === 2 ? <>
          <Path d="M48 133 Q40 169 48 205 H150 Q160 169 150 133 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" strokeLinejoin="round" />
          <Path d="M64 153 H136" stroke={theme.colors.white} strokeWidth="10" strokeLinecap="round" />
          <Path d="M65 183 H119" stroke={theme.colors.amber} strokeWidth="9" strokeLinecap="round" />
          <Rect x="148" y="149" width="31" height="40" rx="7" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="5" />
          <Path d="M179 169 H190" stroke={theme.colors.amber} strokeWidth="7" strokeLinecap="round" />
          <Rect x="188" y="150" width="29" height="39" rx="6" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="5" />
          {[0, 1, 2, 3, 4].map((index) => <Line key={index} x1={194 + index * 4} y1="155" x2={194 + index * 4} y2="184" stroke="#5C9EAD" strokeWidth="2" strokeLinecap="round" />)}
          <Path d="M216 170 H282" stroke={theme.colors.leaf} strokeWidth="14" strokeLinecap="round" />
          {pasteApplied ? <Path d="M203 170 H225" stroke={theme.colors.amber} strokeWidth="9" strokeLinecap="round" /> : null}
          <Path d="M89 119 H132 M123 110 L132 119 L123 128" fill="none" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
        {step === 3 ? <>
          <Circle cx="153" cy="151" r="92" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="5" />
          <Path d="M95 174 Q153 233 211 174" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="5" />
          {[111, 132, 153, 174, 195].map((x) => <Line key={x} x1={x} y1="178" x2={x + 5} y2="205" stroke={theme.colors.border} strokeWidth="4" />)}
          <Path d="M112 152 H191 M181 143 L191 152 L181 161" fill="none" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
      </Svg>
      {step < 5 ? <DraggablePiece key={step} start={current.start} target={current.target} label={current.label} hint={labels.dragHint} done={false} tapToComplete={false} dropTolerance={current.tolerance} acceptHorizontalSwipe={step === 2} onDone={() => {
        if (step !== 2) { setStep((value) => value + 1); return; }
        // Keep the applied paste visible briefly so the squeezing outcome is
        // clear before moving on to the brushing action.
        setPasteApplied(true);
        setTimeout(() => setStep(3), 520);
      }}><BrushPiece type={current.type} /></DraggablePiece> : null}
    </View>
  </View>;
}

export function SkillInteraction({ skill, labels, onComplete }: { skill: SkillCatalogKey; labels: SkillInteractionLabels; onComplete: () => void }) {
  if (skill === 'tie_shoes') return <ShoelaceGame labels={labels} onComplete={onComplete} />;
  if (skill === 'fold_gamosa') return <GamosaGame labels={labels} onComplete={onComplete} />;
  if (skill === 'button_shirt') return <ShirtGame labels={labels} onComplete={onComplete} />;
  if (skill === 'brush_teeth') return <BrushTeethGame labels={labels} onComplete={onComplete} />;
  return null;
}

const styles = StyleSheet.create({
  interactionWrap: { alignItems: 'center', gap: 14 },
  instruction: { minHeight: 64, color: theme.colors.ink, fontSize: theme.type.patient, lineHeight: 31, fontWeight: '800', textAlign: 'center' },
  canvas: { width: 304, height: 330, position: 'relative', overflow: 'hidden', borderRadius: theme.radius.media, backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.border },
  dragPiece: { position: 'absolute', width: 64, height: 64, zIndex: 5 },
  dragPressable: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  laceEnd: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.amberSoft, borderWidth: 3, borderColor: theme.colors.amber },
  laceLine: { width: 28, height: 8, borderRadius: 4, backgroundColor: theme.colors.amber, transform: [{ rotate: '-38deg' }] },
  bowButton: { position: 'absolute', left: 105, top: 72, width: 94, height: 94, zIndex: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 47, backgroundColor: theme.colors.amberSoft, borderWidth: 3, borderColor: theme.colors.amber },
  successTarget: { backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf },
  bowLoop: { position: 'absolute', left: 13, width: 37, height: 28, borderRadius: 18, borderWidth: 7, borderColor: theme.colors.amber, transform: [{ rotate: '-20deg' }] },
  bowLoopRight: { left: 45, transform: [{ rotate: '20deg' }] },
  bowKnot: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.amber },
  clothShadow: { position: 'absolute', left: 38, top: 54, width: 228, height: 242, borderRadius: 12, backgroundColor: theme.colors.border, opacity: 0.35 },
  foldedCloth: { position: 'absolute', left: 22, top: 35, width: 260, height: 248 },
  clothCenter: { position: 'absolute', left: 0, top: 0, width: 260, height: 248, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.white, borderWidth: 4, borderColor: theme.colors.leaf },
  gamosaStripe: { position: 'absolute', left: 0, right: 0, top: 28, height: 18, backgroundColor: theme.colors.amber },
  stripeBottom: { top: 202 },
  clothPanel: { position: 'absolute', top: 4, width: 82, height: 240, backgroundColor: theme.colors.amberSoft, borderWidth: 2, borderColor: theme.colors.amber, opacity: 0.92 },
  clothLeft: { left: 4 },
  clothRight: { right: 4 },
  foldSwipeZone: { position: 'absolute', zIndex: 6, width: 142, height: 142, alignItems: 'center', justifyContent: 'center' },
  foldSwipeLeft: { left: 0, top: 94 },
  foldSwipeRight: { right: 0, top: 94 },
  foldSwipeCenter: { left: 81, top: 150 },
  foldSwipeHandle: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 41, backgroundColor: theme.colors.white, borderWidth: 3, borderColor: theme.colors.leaf },
  foldArrow: { color: theme.colors.leaf, fontSize: 42, lineHeight: 48, fontWeight: '800' },
  shirtButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.amberSoft, borderWidth: 4, borderColor: theme.colors.amber },
  shirtHalf: { position: 'absolute', top: 8, width: 132, height: 314 },
  shirtLeftHalf: { left: 8 },
  shirtRightHalf: { right: 8 },
  fastenedButton: { position: 'absolute', left: 124, zIndex: 4, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.white, borderWidth: 4, borderColor: theme.colors.leaf },
  pasteCap: { width: 46, height: 34, borderRadius: 8, backgroundColor: theme.colors.white, borderWidth: 4, borderColor: theme.colors.amber, justifyContent: 'center', overflow: 'hidden' },
  capRidges: { height: 12, backgroundColor: theme.colors.amberSoft, borderTopWidth: 3, borderBottomWidth: 3, borderColor: theme.colors.amber },
  pasteTube: { width: 58, height: 38, borderRadius: 14, backgroundColor: theme.colors.leafSoft, borderWidth: 4, borderColor: theme.colors.leaf, justifyContent: 'center', overflow: 'visible' },
  pasteStripe: { height: 8, backgroundColor: theme.colors.amber, marginHorizontal: 6, borderRadius: 4 },
  pasteNozzle: { position: 'absolute', right: -12, width: 14, height: 18, borderRadius: 4, backgroundColor: theme.colors.white, borderWidth: 3, borderColor: theme.colors.leaf },
  squeezeGrip: { width: 42, height: 62, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.amberSoft, borderWidth: 4, borderColor: theme.colors.amber },
  squeezeArrow: { color: theme.colors.amber, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  buttonHoles: { width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  buttonHole: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.ink },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
