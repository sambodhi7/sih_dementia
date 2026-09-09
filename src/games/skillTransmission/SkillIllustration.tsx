import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { SkillCatalogKey } from '../../storage/types';
import { theme } from '../../theme';

type Props = { skill: SkillCatalogKey; label: string; size?: number; completed?: boolean };

function TyingIllustration({ variant }: { variant: 'shoes' | 'knot' | 'necktie' }) {
  return <>
    <Path d="M34 93 C48 80 61 80 76 94" fill="none" stroke={theme.colors.ink} strokeWidth="7" strokeLinecap="round" />
    <Path d="M126 94 C140 80 153 80 168 93" fill="none" stroke={theme.colors.ink} strokeWidth="7" strokeLinecap="round" />
    {variant === 'shoes' ? <>
      <Path d="M62 94 L92 78 L111 103 L74 119 Q55 119 62 94" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" />
      <Line x1="82" y1="88" x2="105" y2="99" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" />
      <Line x1="87" y1="82" x2="101" y2="105" stroke={theme.colors.amber} strokeWidth="4" strokeLinecap="round" />
    </> : variant === 'knot' ? <>
      <Path d="M49 105 C72 68 90 129 108 91 C126 54 146 119 159 88" fill="none" stroke={theme.colors.amber} strokeWidth="8" strokeLinecap="round" />
      <Circle cx="104" cy="96" r="13" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="4" />
    </> : <>
      <Path d="M91 46 L111 46 L119 71 L101 90 L83 71 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" />
      <Path d="M101 89 L122 145 L101 165 L80 145 Z" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="4" />
    </>}
  </>;
}

function SkillArt({ skill }: { skill: SkillCatalogKey }) {
  if (skill === 'tie_shoes') return <TyingIllustration variant="shoes" />;
  if (skill === 'tie_knot') return <TyingIllustration variant="knot" />;
  if (skill === 'tie_necktie') return <TyingIllustration variant="necktie" />;
  if (skill === 'fold_gamosa') return <>
    <Rect x="49" y="48" width="102" height="112" rx="8" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="4" />
    <Path d="M49 75 H151 M49 132 H151" stroke={theme.colors.amber} strokeWidth="8" />
    <Path d="M75 48 V160 M126 48 V160" stroke={theme.colors.leafSoft} strokeWidth="4" strokeDasharray="7 7" />
  </>;
  if (skill === 'plant_seed') return <>
    <Path d="M47 151 Q100 123 153 151" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="4" />
    <Path d="M101 139 V91" stroke={theme.colors.leaf} strokeWidth="6" strokeLinecap="round" />
    <Path d="M101 106 Q72 81 69 111 Q88 120 101 106" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" />
    <Path d="M101 92 Q127 66 139 94 Q122 109 101 92" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" />
    <Ellipse cx="101" cy="151" rx="12" ry="6" fill={theme.colors.amber} />
  </>;
  if (skill === 'button_shirt') return <>
    <Path d="M57 55 L83 39 L101 56 L119 39 L145 55 L133 160 H69 Z" fill={theme.colors.leafSoft} stroke={theme.colors.leaf} strokeWidth="4" strokeLinejoin="round" />
    <Line x1="101" y1="57" x2="101" y2="155" stroke={theme.colors.white} strokeWidth="5" />
    {[80, 105, 130].map((y) => <Circle key={y} cx="101" cy={y} r="7" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="3" />)}
  </>;
  if (skill === 'brush_teeth') return <>
    <Path d="M31 112 H126" fill="none" stroke={theme.colors.leaf} strokeWidth="17" strokeLinecap="round" />
    <Rect x="119" y="82" width="48" height="58" rx="8" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="6" />
    {[0, 1, 2, 3, 4].map((index) => <Line key={index} x1={128 + index * 8} y1="91" x2={128 + index * 8} y2="131" stroke="#5C9EAD" strokeWidth="4" strokeLinecap="round" />)}
    <Path d="M65 151 Q100 184 137 151" fill={theme.colors.white} stroke={theme.colors.leaf} strokeWidth="4" />
    {[79, 94, 109, 124].map((x) => <Line key={x} x1={x} y1="153" x2={x + 4} y2="171" stroke={theme.colors.border} strokeWidth="3" />)}
  </>;
  return <>
    <Circle cx="101" cy="60" r="25" fill={theme.colors.amberSoft} stroke={theme.colors.amber} strokeWidth="4" />
    <Path d="M76 61 Q56 94 78 151 M88 69 Q73 105 96 157 M101 72 Q91 111 112 158 M114 69 Q109 106 128 151" fill="none" stroke={theme.colors.ink} strokeWidth="7" strokeLinecap="round" />
    <Path d="M78 89 L112 145 M94 88 L128 141" stroke={theme.colors.leaf} strokeWidth="5" strokeLinecap="round" />
  </>;
}

export function SkillIllustration({ skill, label, size = 210, completed = false }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) { opacity.setValue(1); translateY.setValue(0); return; }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    });
    return () => { mounted = false; };
  }, [opacity, skill, translateY]);

  return <Animated.View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.frame, completed && styles.completed, { width: size, height: size, opacity, transform: [{ translateY }] }]}>
    <Svg width="100%" height="100%" viewBox="0 0 200 200"><G><SkillArt skill={skill} /></G></Svg>
  </Animated.View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.media, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  completed: { backgroundColor: theme.colors.leafSoft, borderColor: theme.colors.leaf, borderWidth: 2 },
});
