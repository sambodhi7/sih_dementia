import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { theme } from '../theme';
import { touchFeedback } from '../lib/haptics';
import { useSpeechGuide } from '../speech/guide';

type ActionButtonProps = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  compact?: boolean;
  textScale?: number;
};

export function ActionButton({ label, onPress, variant = 'primary', disabled = false, compact = false, textScale = 1 }: ActionButtonProps) {
  const { speakAction } = useSpeechGuide();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={compact ? undefined : 4}
      onPress={(event) => { touchFeedback(); speakAction(label); onPress(event); }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'primary' && styles.primaryText, variant === 'danger' && styles.primaryText, { fontSize: theme.type.guardian * textScale }]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, tone = 'neutral', textScale = 1 }: { children: string; tone?: 'neutral' | 'support'; textScale?: number }) {
  return (
    <View style={[styles.notice, tone === 'support' && styles.noticeSupport]} accessibilityLiveRegion="polite">
      <Text style={[styles.noticeText, { fontSize: theme.type.guardian * textScale, lineHeight: 25 * textScale }]}>{children}</Text>
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, multiline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedInk}
          secureTextEntry={secureTextEntry && !showSecret}
          multiline={multiline}
          style={[styles.field, secureTextEntry && styles.secretField, multiline && styles.multiline]}
        />
        {secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel={showSecret ? 'Hide password' : 'Show password'} onPress={() => { touchFeedback(); setShowSecret((visible) => !visible); }} style={styles.secretToggle}><Text style={styles.secretToggleText}>{showSecret ? 'Hide' : 'Show'}</Text></Pressable> : null}
      </View>
    </View>
  );
}

export function Portrait({ uri, name, size = 88 }: { uri?: string; name: string; size?: number }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  if (!uri) {
    return <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: Math.min(size / 2, theme.radius.media) }]}><Text style={styles.avatarText}>{initials}</Text></View>;
  }
  return <Image source={{ uri }} accessibilityLabel={name} style={{ width: size, height: size, borderRadius: theme.radius.media, backgroundColor: theme.colors.leafSoft }} />;
}

export function MemberRow({ member, onEdit, onArchive, labels }: {
  member: { name: string; relationship: string; imageUri?: string; photoUri?: string | null; learningOnly?: boolean };
  onEdit: () => void;
  onArchive: () => void;
  labels: { edit: string; archive: string; learningOnly: string };
}) {
  return (
    <View style={styles.memberRow}>
      <Portrait uri={member.photoUri ?? member.imageUri} name={member.name} size={66} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRelation}>{member.relationship}</Text>
        {member.learningOnly && <Text style={styles.learningOnly}>{labels.learningOnly}</Text>}
      </View>
      <View style={styles.memberActions}>
        <ActionButton label={labels.edit} onPress={onEdit} variant="quiet" compact />
        <ActionButton label={labels.archive} onPress={onArchive} variant="quiet" compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, paddingHorizontal: 20, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.colors.leaf },
  compactButton: { minHeight: 40, paddingHorizontal: 12 },
  primary: { backgroundColor: theme.colors.leaf },
  secondary: { backgroundColor: theme.colors.white, borderColor: theme.colors.leaf },
  quiet: { borderColor: theme.colors.border, backgroundColor: 'transparent' },
  danger: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  buttonText: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700', textAlign: 'center' },
  primaryText: { color: theme.colors.white },
  notice: { borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 16 },
  noticeSupport: { backgroundColor: theme.colors.amberSoft, borderColor: theme.colors.amber },
  noticeText: { color: theme.colors.ink, fontSize: theme.type.guardian, lineHeight: 25 },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' },
  field: { borderColor: theme.colors.border, borderWidth: 1.5, borderRadius: theme.radius.control, minHeight: 56, paddingHorizontal: 16, color: theme.colors.ink, backgroundColor: theme.colors.white, fontSize: theme.type.guardian },
  secretField: { paddingRight: 78 },
  secretToggle: { position: 'absolute', right: 6, top: 6, minWidth: 58, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control },
  secretToggleText: { color: theme.colors.leaf, fontSize: theme.type.meta, fontWeight: '800' },
  multiline: { minHeight: 116, paddingTop: 14, textAlignVertical: 'top' },
  avatarFallback: { backgroundColor: theme.colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.leaf, fontWeight: '800', fontSize: theme.type.guardian },
  memberRow: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, backgroundColor: theme.colors.white, padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: theme.type.guardian, color: theme.colors.ink, fontWeight: '800' },
  memberRelation: { fontSize: theme.type.meta, color: theme.colors.mutedInk },
  learningOnly: { color: theme.colors.amber, fontSize: theme.type.meta, fontWeight: '700' },
  memberActions: { gap: 6 },
});
