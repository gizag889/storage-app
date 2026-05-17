import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../drizzle/migrations';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { Text, View, ActivityIndicator } from 'react-native';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#3182ce',
    secondary: '#2c5282',
  },
};

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red' }}>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3182ce" />
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: '在庫一覧' }} />
        <Stack.Screen name="item/add" options={{ title: 'アイテム追加', presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'アイテム詳細' }} />
        <Stack.Screen name="settings/index" options={{ title: '設定' }} />
        <Stack.Screen name="settings/locations" options={{ title: '場所管理' }} />
        <Stack.Screen name="settings/categories" options={{ title: 'カテゴリー管理' }} />
      </Stack>
    </PaperProvider>
  );
}
