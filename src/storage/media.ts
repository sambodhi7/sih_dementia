import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const imageFolder = `${FileSystem.documentDirectory ?? ''}whos-who-images/`;

export async function pickAndPersistPhoto(itemId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.82,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    if (asset.base64) return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
    return asset.uri;
  }
  await FileSystem.makeDirectoryAsync(imageFolder, { intermediates: true });
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const destination = `${imageFolder}${itemId}.${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}
