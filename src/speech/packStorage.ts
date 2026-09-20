import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { speechPackFileUrl } from './catalog';
import type { DownloadableSpeechPack, SpeechPackStatus } from './types';

const root = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}speech-packs/` : null;

export function languagePackDirectory(languageCode: string): string | null {
  return root ? `${root}${languageCode}/` : null;
}

export async function ensureLanguagePackDirectory(languageCode: string): Promise<string | null> {
  const directory = languagePackDirectory(languageCode);
  if (!directory) return null;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export type SpeechPackDownloadProgress = {
  bytesDownloaded: number;
  totalBytes: number;
  fraction: number;
};

async function fileIsReady(uri: string, bytes: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory && info.size === bytes;
}

function nativeFilePath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export async function getLanguagePackStatus(pack: DownloadableSpeechPack): Promise<SpeechPackStatus> {
  const directory = languagePackDirectory(pack.languageCode);
  if (!directory) return 'not-installed';
  const results = await Promise.all(pack.files.map((file) => fileIsReady(`${directory}${file.relativePath}`, file.bytes)));
  if (results.every(Boolean)) return 'ready';
  return results.some(Boolean) ? 'incomplete' : 'not-installed';
}

export async function downloadLanguagePack(pack: DownloadableSpeechPack, onProgress: (progress: SpeechPackDownloadProgress) => void): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Offline speech packs are available in Android and iOS builds.');
  const directory = await ensureLanguagePackDirectory(pack.languageCode);
  if (!directory) throw new Error('This device does not provide an app document directory.');

  const { hash } = await import('@dr.pogodin/react-native-fs');
  let completedBytes = 0;
  for (const file of pack.files) {
    const destination = `${directory}${file.relativePath}`;
    const destinationDirectory = destination.slice(0, destination.lastIndexOf('/') + 1);
    await FileSystem.makeDirectoryAsync(destinationDirectory, { intermediates: true });

    if (await fileIsReady(destination, file.bytes)) {
      const existingHash = await hash(nativeFilePath(destination), 'sha256');
      if (existingHash.toLowerCase() === file.sha256) {
        completedBytes += file.bytes;
        onProgress({ bytesDownloaded: completedBytes, totalBytes: pack.totalBytes, fraction: completedBytes / pack.totalBytes });
        continue;
      }
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }

    const temporary = `${destination}.part`;
    await FileSystem.deleteAsync(temporary, { idempotent: true });
    const download = FileSystem.createDownloadResumable(
      speechPackFileUrl(pack, file.remotePath),
      temporary,
      {},
      ({ totalBytesWritten }) => {
        const bytesDownloaded = Math.min(pack.totalBytes, completedBytes + totalBytesWritten);
        onProgress({ bytesDownloaded, totalBytes: pack.totalBytes, fraction: bytesDownloaded / pack.totalBytes });
      },
    );
    const result = await download.downloadAsync();
    if (!result?.uri) throw new Error(`The ${pack.displayName} speech pack download stopped before it finished.`);
    const info = await FileSystem.getInfoAsync(temporary);
    if (!info.exists || info.isDirectory || info.size !== file.bytes) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw new Error('A downloaded speech file was incomplete. Please try again.');
    }
    const downloadedHash = await hash(nativeFilePath(temporary), 'sha256');
    if (downloadedHash.toLowerCase() !== file.sha256) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw new Error('A downloaded speech file could not be verified. Please try again.');
    }
    await FileSystem.moveAsync({ from: temporary, to: destination });
    completedBytes += file.bytes;
    onProgress({ bytesDownloaded: completedBytes, totalBytes: pack.totalBytes, fraction: completedBytes / pack.totalBytes });
  }
  return directory;
}
