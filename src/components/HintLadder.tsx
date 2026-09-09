import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Notice } from './ui';
import { theme } from '../theme';

export type HintLadderProps = {
  level: 0 | 1 | 2 | 3 | 4;
  message: string | null;
  helpLabel: string;
  onHelp: () => void;
  audioUri?: string | null;
  audioLabel?: string;
  onReplay?: () => void;
};

export function HintLadder({ level, message, helpLabel, onHelp, audioUri, audioLabel, onReplay }: HintLadderProps) {
  return (
    <View style={styles.stack} accessibilityLiveRegion="polite">
      {level < 4 ? <ActionButton label={helpLabel} onPress={onHelp} variant="secondary" /> : null}
      {message ? <Notice tone="support">{message}</Notice> : null}
      {level >= 3 && audioUri && audioLabel && onReplay ? <ActionButton label={audioLabel} onPress={() => onReplay()} variant="quiet" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.gap },
});
