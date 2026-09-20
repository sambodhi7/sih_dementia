import type { DownloadableSpeechPack } from './types';

const repository = 'https://huggingface.co/Gaykar/Speech-onnx-models/resolve';
const revision = '39b1bac3efc6244bfd98d4341dc4f4ddc443ce2e';

const ttsFiles = [
  { relativePath: 'models/tts/model.onnx', remotePath: 'tts/model.onnx', bytes: 123338635, sha256: '4473f8d0b6f738196c1626bbf337cda99b34749b638bb7234c4cb8e1992bf804' },
  { relativePath: 'models/tts/tokens.txt', remotePath: 'tts/tokens.txt', bytes: 9556, sha256: '32ad56b2533484ccd61f8c783cc32b1f90ae06e65469476548c2f832eb6d3a9c' },
] as const;

function makePack(appLanguageId: 'assamese' | 'bengali', languageCode: 'as' | 'bn', displayName: string, modelBytes: number, modelSha256: string): DownloadableSpeechPack {
  const sttFiles = [
    { relativePath: 'models/stt/model.int8.onnx', remotePath: `stt/${languageCode}/${languageCode}_model.int8.onnx`, bytes: modelBytes, sha256: modelSha256 },
    { relativePath: 'models/stt/tokens.txt', remotePath: `stt/${languageCode}/tokens.txt`, bytes: 67605, sha256: 'ee60967630213f31951817ac8b402b92ec18cce80718a24a49b388e56672dfb2' },
  ];
  const files = [...sttFiles, ...ttsFiles];
  return { appLanguageId, languageCode, displayName, revision, files, totalBytes: files.reduce((total, file) => total + file.bytes, 0) };
}

export const downloadableSpeechPacks: ReadonlyArray<DownloadableSpeechPack> = [
  makePack('assamese', 'as', 'অসমীয়া', 197595509, 'b8c027e8ab6c9f64417a879b85c61254aefc3557b1875bf793fb5a33abb20426'),
  makePack('bengali', 'bn', 'বাংলা', 197595578, 'e9120a534f69df065314be468bf15579f1b92a4cd8c07ad119b80b69244718a8'),
];

export function speechPackForAppLanguage(languageId: string): DownloadableSpeechPack | null {
  return downloadableSpeechPacks.find((pack) => pack.appLanguageId === languageId) ?? null;
}

export function speechPackFileUrl(pack: DownloadableSpeechPack, remotePath: string): string {
  return `${repository}/${pack.revision}/${remotePath}?download=true`;
}

export function formatPackMegabytes(bytes: number): string {
  return `${Math.ceil(bytes / 1_000_000)} MB`;
}
