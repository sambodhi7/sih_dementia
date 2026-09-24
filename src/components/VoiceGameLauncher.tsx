import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { touchFeedback } from '../lib/haptics';
import { stopSpeaking } from '../speech/runtime';
import { theme } from '../theme';

type VoiceCopy = {
  ask: string;
  example: string;
  start: string;
  listening: string;
  stop: string;
  processing: string;
  permission: string;
  problem: string;
  close: string;
  inputLabel: string;
  send: string;
  ready: string;
  inputTitle: string;
};

export function VoiceGameLauncher({ languageCode, copy, onAudio, onTranscript, canRecord }: { languageCode: string; copy: VoiceCopy; onAudio: (uri: string) => Promise<string | void>; onTranscript?: (transcript: string) => Promise<string | void>; canRecord: boolean }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'cache' });
  const recording = useAudioRecorderState(recorder);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [browserListening, setBrowserListening] = useState(false);
  const [commandText, setCommandText] = useState('');
  const browserRecognition = useRef<any>(null);
  const browser = globalThis as any;
  const microphoneAvailable = Platform.OS === 'web' ? Boolean(browser.SpeechRecognition ?? browser.webkitSpeechRecognition) : canRecord;

  const beginBrowserRecognition = () => {
    const browser = globalThis as any;
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition || !onTranscript) { setMessage(copy.problem); return false; }
    const recognition = new Recognition();
    recognition.lang = languageCode === 'hi' ? 'hi-IN' : languageCode === 'bn' ? 'bn-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let heardText = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results ?? []).map((result: any) => result[0]?.transcript ?? '').join(' ').trim();
      if (transcript) { heardText = true; setCommandText(transcript); }
      if (event.results?.[event.resultIndex]?.isFinal) { setBrowserListening(false); setMessage(copy.ready); }
    };
    recognition.onerror = (event: { error?: string }) => { setBrowserListening(false); setMessage(event.error === 'not-allowed' ? copy.permission : copy.problem); };
    recognition.onend = () => { setBrowserListening(false); setMessage(heardText ? copy.ready : copy.problem); };
    browserRecognition.current = recognition;
    recognition.start();
    setBrowserListening(true);
    return true;
  };

  const begin = async () => {
    setOpen(true);
    setBusy(true);
    setMessage(copy.ask);
    setCommandText('');
    try {
      if (Platform.OS === 'web') { void stopSpeaking().catch(() => undefined); beginBrowserRecognition(); return; }
      await stopSpeaking();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setMessage(copy.permission); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setMessage(copy.problem);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (browserListening) {
      browserRecognition.current?.stop?.();
      setBrowserListening(false);
      return;
    }
    setBusy(true);
    setMessage(copy.processing);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('No recording was created.');
      setMessage((await onAudio(recorder.uri)) ?? '');
    } catch {
      setMessage(copy.problem);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const transcript = commandText.trim();
    if (!transcript || busy || browserListening || recording.isRecording || !onTranscript) return;
    setBusy(true);
    setMessage(copy.processing);
    try { setMessage((await onTranscript(transcript)) ?? ''); }
    catch { setMessage(copy.problem); }
    finally { setBusy(false); }
  };

  return <View pointerEvents="box-none" style={styles.wrap}>
    {open ? <View accessibilityLiveRegion="polite" style={styles.tray}>
      <Text style={styles.trayTitle}>{recording.isRecording || browserListening ? copy.listening : message || copy.example}</Text>
      {!recording.isRecording && !browserListening && !busy ? <Text style={styles.example}>{copy.example}</Text> : null}
      {microphoneAvailable && !recording.isRecording && !browserListening && !busy ? <Pressable accessibilityRole="button" accessibilityLabel={copy.start} onPress={() => { touchFeedback(); void begin(); }} style={styles.stop}><Text style={styles.stopText}>🎙 {copy.start}</Text></Pressable> : null}
      {recording.isRecording || browserListening ? <Pressable accessibilityRole="button" accessibilityLabel={copy.stop} onPress={() => { touchFeedback(); void stop(); }} style={styles.stop}><Text style={styles.stopText}>■ {copy.stop}</Text></Pressable> : null}
      {!recording.isRecording && !browserListening && !busy ? <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setOpen(false)}><Text style={styles.close}>{copy.close}</Text></Pressable> : null}
      <View style={styles.commandRow}>
        <TextInput accessibilityLabel={copy.inputLabel} placeholder={copy.inputLabel} placeholderTextColor={theme.colors.mutedInk} value={commandText} onChangeText={setCommandText} editable={!busy && !browserListening && !recording.isRecording} style={styles.commandInput} />
        <Pressable accessibilityRole="button" accessibilityLabel={copy.send} accessibilityState={{ disabled: !commandText.trim() || busy || browserListening || recording.isRecording }} disabled={!commandText.trim() || busy || browserListening || recording.isRecording} onPress={() => { touchFeedback(); void send(); }} style={[styles.sendButton, (!commandText.trim() || busy || browserListening || recording.isRecording) && styles.sendDisabled]}><Text style={styles.sendText}>{copy.send}</Text></Pressable>
      </View>
    </View> : null}
    {!open ? <Pressable accessibilityRole="button" accessibilityLabel={copy.inputTitle} onPress={() => { touchFeedback(); setMessage(copy.example); setOpen(true); }} style={styles.fab}><Text style={styles.fabIcon}>⌨</Text><Text style={styles.fabLabel}>{copy.inputTitle}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  fab: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 32, backgroundColor: theme.colors.leaf, borderWidth: 2, borderColor: theme.colors.white },
  fabIcon: { fontSize: 22 },
  fabLabel: { color: theme.colors.white, fontSize: theme.type.guardian, fontWeight: '800' },
  tray: { width: 300, gap: 10, padding: 16, borderRadius: theme.radius.media, borderWidth: 1, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white },
  trayTitle: { color: theme.colors.ink, fontSize: theme.type.patientSmall, fontWeight: '800' },
  example: { color: theme.colors.mutedInk, fontSize: theme.type.guardian, lineHeight: 24 },
  stop: { minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, backgroundColor: theme.colors.leafSoft, borderWidth: 1, borderColor: theme.colors.leaf },
  stopText: { color: theme.colors.ink, fontSize: theme.type.guardian, fontWeight: '800' },
  close: { color: theme.colors.leaf, fontSize: theme.type.guardian, fontWeight: '800', textAlign: 'center', paddingVertical: 8 },
  commandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commandInput: { flex: 1, minWidth: 0, minHeight: 64, paddingHorizontal: 12, borderRadius: theme.radius.control, borderWidth: 1.5, borderColor: theme.colors.leaf, backgroundColor: theme.colors.white, color: theme.colors.ink, fontSize: theme.type.patientSmall },
  sendButton: { minHeight: 64, minWidth: 64, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.control, backgroundColor: theme.colors.leaf },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: theme.colors.white, fontSize: theme.type.guardian, fontWeight: '800' },
});
