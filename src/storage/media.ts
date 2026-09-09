import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const mediaRoot = FileSystem.documentDirectory ?? '';

async function persistPickedPhoto(itemId: string, folderName: string, aspect: [number, number]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.82,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    if (asset.base64) return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
    return asset.uri;
  }
  const folder = `${mediaRoot}${folderName}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const destination = `${folder}${itemId}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}

export async function pickAndPersistPhoto(itemId: string) {
  return persistPickedPhoto(itemId, 'whos-who-images', [1, 1]);
}

export async function pickAndPersistSkillCompletionPhoto(sessionId: string) {
  return persistPickedPhoto(sessionId, 'skill-transmission-photos', [4, 3]);
}

export async function persistSkillPromptAudio(skillId: string, sourceUri: string) {
  if (Platform.OS === 'web' || !mediaRoot) return sourceUri;
  const folder = `${mediaRoot}skill-transmission-audio/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const extension = sourceUri.split('.').pop()?.split('?')[0] || 'm4a';
  const destination = `${folder}${encodeURIComponent(skillId)}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}
