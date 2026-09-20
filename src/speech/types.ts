export type SpeechLanguageCode = 'en' | 'as' | 'bn' | 'hi' | 'brx' | 'mni' | 'ne';

export type SpeechPageId = 'member.games' | 'member.routine' | 'member.settings';

export type SpeechUtteranceKind = 'heading' | 'description' | 'action';

export type SpeechUtterance = {
  id: string;
  groupId: string;
  kind: SpeechUtteranceKind;
  text: string;
};

export type SpeechPage = {
  schemaVersion: 1;
  pageId: SpeechPageId;
  languageCode: SpeechLanguageCode;
  title: string;
  summary: string;
  utterances: SpeechUtterance[];
};

export type SpeechModelFiles = {
  engine: 'sherpa-onnx-vits' | 'sherpa-onnx-ctc';
  model: string;
  tokens: string;
};

export type SpeechCommand = {
  intent: string;
  phrases: string[];
};

export type SpeechPackManifest = {
  schemaVersion: 1;
  id: string;
  languageCode: SpeechLanguageCode;
  displayName: string;
  models: {
    tts: SpeechModelFiles;
    stt: SpeechModelFiles;
  };
  pages: SpeechPageId[];
  commands: SpeechCommand[];
};

export type SpeechPackStatus = 'not-installed' | 'incomplete' | 'ready';

export type SpeechPackFile = {
  relativePath: string;
  remotePath: string;
  bytes: number;
  sha256: string;
};

export type DownloadableSpeechPack = {
  appLanguageId: 'assamese' | 'bengali';
  languageCode: 'as' | 'bn';
  displayName: string;
  revision: string;
  totalBytes: number;
  files: SpeechPackFile[];
};
