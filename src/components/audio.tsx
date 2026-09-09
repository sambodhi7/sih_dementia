import { useState } from 'react';
import { Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { theme } from '../theme';
import { ActionButton, Notice } from './ui';

type AudioCaptureLabels = { working: string; stopAndSave: string; recordAgain: string; record: string; saved: string; permission: string; failed: string };

const defaultLabels: AudioCaptureLabels = { working: 'Working…', stopAndSave: 'Stop and save recording', recordAgain: 'Record again', record: 'Record voice note', saved: 'Family recording saved on this device.', permission: 'Microphone access is needed to record a family voice note.', failed: 'The recording could not be saved. Please try again.' };

export function AudioCapture({ label, uri, onCaptured, onProblem, labels = defaultLabels }: { label: string; uri: string | null; onCaptured: (uri: string) => void | Promise<void>; onProblem: (message: string) => void; labels?: AudioCaptureLabels }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  const toggleRecording = async () => {
    setBusy(true);
    try {
      if (state.isRecording) {
        await recorder.stop();
        if (recorder.uri) await onCaptured(recorder.uri);
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) { onProblem(labels.permission); return; }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch {
      onProblem(labels.failed);
    } finally { setBusy(false); }
  };

  return <View style={{ gap: 8 }}>
    <Text style={{ color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '700' }}>{label}</Text>
    <ActionButton label={busy ? labels.working : state.isRecording ? labels.stopAndSave : uri ? labels.recordAgain : labels.record} onPress={toggleRecording} variant={state.isRecording ? 'secondary' : 'quiet'} disabled={busy} />
    {uri ? <Notice>{labels.saved}</Notice> : null}
  </View>;
}

export function AudioReplay({ uri, label, onReplay }: { uri: string | null; label: string; onReplay?: () => void }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const play = () => { if (!uri) return; player.seekTo(0); player.play(); onReplay?.(); };
  return <ActionButton label={uri ? `🔊  ${label}` : `${label} unavailable`} onPress={play} variant="secondary" disabled={!uri} />;
}
