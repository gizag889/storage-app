import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';

export const saveImage = async (uri: string, onChange: (uri: string) => void) => {
  try {
    const fileName = uri.split('/').pop() || `${Crypto.randomUUID()}.jpg`;
    const newPath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: newPath,
    });
    onChange(newPath);
  } catch (e) {
    console.error('Failed to save image:', e);
    Alert.alert('エラー', '画像の保存に失敗しました');
  }
};

export const pickImage = async (onChange: (uri: string) => void) => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    await saveImage(result.assets[0].uri, onChange);
  }
};

export const takePhoto = async (onChange: (uri: string) => void) => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('権限エラー', 'カメラへのアクセス許可が必要です');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    await saveImage(result.assets[0].uri, onChange);
  }
};
