import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Android 13+ uses the system photo picker — no READ_MEDIA_* permission required.
 * iOS still needs library access before `launchImageLibraryAsync`.
 */
export async function ensurePhotoLibraryAccessForPicker(): Promise<boolean> {
  if (Platform.OS === 'android') return true;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}

export function launchImageLibraryAsync(
  options: ImagePicker.ImagePickerOptions,
) {
  return ImagePicker.launchImageLibraryAsync(options);
}
