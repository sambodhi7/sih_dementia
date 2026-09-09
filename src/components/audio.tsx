import { useState } from 'react';
import { Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { theme } from '../theme';
import { ActionButton, Notice } from './ui';

export function AudioCapture({ label, uri, onCaptured, onProblem }: { label: string; uri: string | null; onCaptured: (uri: string) => void; onProblem: (message: string) => void }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  const toggleRecording = async () => {
    setBusy(true);
    try {
      if (state.isRecording) {
        await recorder.stop();
        if (recorder.uri) onCaptured(recorder.uri);
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) { onProblem('Microphone access is needed to record a family voice note.'); return; }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch {
      onProblem('The recording could not be saved. Please try again.');
    } finally { setBusy(false); }
  };

  return <View style={{ gap: 8 }}>
    <Text style={{ color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' }}>{label}</Text>
    <ActionButton label={busy ? 'Working…' : state.isRecording ? 'Stop and save recording' : uri ? 'Record again' : 'Record voice note'} onPress={toggleRecording} variant={state.isRecording ? 'secondary' : 'quiet'} disabled={busy} />
    {uri ? <Notice>Family recording saved on this device.</Notice> : null}
  </View>;
}

export function AudioReplay({ uri, label, onReplay }: { uri: string | null; label: string; onReplay?: () => void }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const play = () => { if (!uri) return; player.seekTo(0); player.play(); onReplay?.(); };
  return <ActionButton label={uri ? `🔊  ${label}` : `${label} unavailable`} onPress={play} variant="secondary" disabled={!uri} />;
}
