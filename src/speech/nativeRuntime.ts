import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { speechPackForAppLanguage } from './catalog';
import { getLanguagePackStatus, languagePackDirectory } from './packStorage';
import { clearSpeechRecognitionAdapter, registerSpeechRecognitionAdapter } from './recognition';
import { registerSpeechSynthesisAdapter, systemSpeechAdapter, useSystemSpeechAdapter } from './runtime';
import type { SpeechSynthesisAdapter } from './runtime';

type StreamingEngine = Awaited<ReturnType<typeof import('react-native-sherpa-onnx/tts')['createStreamingTTS']>>;
type StreamController = Awaited<ReturnType<StreamingEngine['generateSpeechStream']>>;

let engine: StreamingEngine | null = null;
let controller: StreamController | null = null;
let activeDirectory: string | null = null;
type SttEngine = Awaited<ReturnType<typeof import('react-native-sherpa-onnx/stt')['createSTT']>>;
let sttEngine: SttEngine | null = null;
let activeSttDirectory: string | null = null;

async function destroyEngine() {
  if (controller) {
    await controller.cancel().catch(() => undefined);
    controller.unsubscribe();
    controller = null;
  }
  if (engine) {
    await engine.stopPcmPlayer().catch(() => undefined);
    await engine.destroy().catch(() => undefined);
    engine = null;
  }
  activeDirectory = null;
}

async function destroySttEngine() {
  if (sttEngine) await sttEngine.destroy().catch(() => undefined);
  sttEngine = null;
  activeSttDirectory = null;
}

async function getSttEngine(modelDirectory: string): Promise<SttEngine> {
  if (sttEngine && activeSttDirectory === modelDirectory) return sttEngine;
  await destroySttEngine();
  const { createSTT } = await import('react-native-sherpa-onnx/stt');
  sttEngine = await createSTT({ modelPath: { type: 'file', path: modelDirectory }, modelType: 'nemo_ctc', preferInt8: true, numThreads: 2 });
  activeSttDirectory = modelDirectory;
  return sttEngine;
}

function makeRecognitionAdapter() {
  return {
    async transcribe(audioUri: string, options: { modelDirectory: string }) {
      const { convertAudioToWav16k } = await import('react-native-sherpa-onnx/audio');
      const inputPath = decodeURIComponent(audioUri.replace(/^file:\/\//, ''));
      const wavUri = `${FileSystem.cacheDirectory}saathi-voice-${Date.now()}.wav`;
      const wavPath = decodeURIComponent(wavUri.replace(/^file:\/\//, ''));
      try {
        await convertAudioToWav16k(inputPath, wavPath);
        const recognizer = await getSttEngine(options.modelDirectory);
        return (await recognizer.transcribeFile(wavPath)).text;
      } finally {
        await FileSystem.deleteAsync(wavUri, { idempotent: true }).catch(() => undefined);
      }
    },
  };
}

async function getEngine(modelDirectory: string): Promise<StreamingEngine> {
  if (engine && activeDirectory === modelDirectory) return engine;
  await destroyEngine();
  const { createStreamingTTS } = await import('react-native-sherpa-onnx/tts');
  engine = await createStreamingTTS({
    modelPath: { type: 'file', path: modelDirectory },
    modelType: 'vits',
    numThreads: 2,
    maxNumSentences: 1,
    modelOptions: { vits: { lengthScale: 1.12 } },
  });
  activeDirectory = modelDirectory;
  return engine;
}

function makeNativeAdapter(modelDirectory: string): SpeechSynthesisAdapter {
  return {
    async speak(text, options) {
      try {
        const current = await getEngine(modelDirectory);
        if (controller) {
          await controller.cancel().catch(() => undefined);
          controller.unsubscribe();
          controller = null;
        }
        const sampleRate = await current.getSampleRate();
        await current.startPcmPlayer(sampleRate, 1);
        await new Promise<void>(async (resolve, reject) => {
          try {
            controller = await current.generateSpeechStream(
              text,
              { speed: options.rate ?? 0.88 },
              {
                onChunk: (chunk) => { if (chunk.samples.length) void current.writePcmChunk(chunk.samples); },
                onEnd: () => { void current.stopPcmPlayer().finally(resolve); },
                onError: (event) => { void current.stopPcmPlayer().finally(() => reject(new Error(event.message))); },
              },
            );
          } catch (error) {
            reject(error);
          }
        });
      } catch {
        await systemSpeechAdapter.speak(text, options);
      }
    },
    async stop() {
      if (controller) {
        await controller.cancel().catch(() => undefined);
        controller.unsubscribe();
        controller = null;
      }
      if (engine) await engine.stopPcmPlayer().catch(() => undefined);
    },
  };
}

export async function configureSpeechRuntime(languageId: string): Promise<'offline-model' | 'system'> {
  const pack = speechPackForAppLanguage(languageId);
  if (Platform.OS === 'web' || !pack || await getLanguagePackStatus(pack) !== 'ready') {
    await destroyEngine();
    await destroySttEngine();
    clearSpeechRecognitionAdapter();
    useSystemSpeechAdapter();
    return 'system';
  }
  const directory = languagePackDirectory(pack.languageCode);
  if (!directory) {
    clearSpeechRecognitionAdapter();
    useSystemSpeechAdapter();
    return 'system';
  }
  const nativeDirectory = decodeURIComponent(directory.replace(/^file:\/\//, ''));
  registerSpeechSynthesisAdapter(makeNativeAdapter(`${nativeDirectory}models/tts`));
  registerSpeechRecognitionAdapter(makeRecognitionAdapter());
  return 'offline-model';
}
