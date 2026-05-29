import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import { items, logs } from '../src/db/schema';
import { eq, lte, isNotNull, and } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import migrations from '../drizzle/migrations';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { Text, View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { seedDatabase } from '../src/db/seed';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#3182ce',
    secondary: '#2c5282',
  },
};

export default function RootLayout() {
  //アプリ起動時にデータベースのテーブル作成・構造変更（マイグレーション）を自動的に実行し、その進捗状況を管理する」**役割
  //success  マイグレーションがすべて無事に完了すると true になります。実行中は false  データベースの準備（テーブル作成など）ができる前にデータを読み込もうとするとアプリがクラッシュしてしまいます。そのため、この success が true になるまでは、
//72-78行目で「ローディング中（くるくる）」画面を表示してアプリの起動を待機させています
  //error マイグレーション処理が失敗した場合にエラー内容が格納される
  const { success, error } = useMigrations(db, migrations);
  const [isSeeded, setIsSeeded] = useState(false);

  //JavaScriptの async 関数は、呼び出されると自動的に Promise オブジェクトを返します。 しかし、React の useEffect は**「クリーンアップ用の関数（または何も返さない undefined）」**が返ってくることを想定しています。Promise が返ってきてしまうと、React がクリーンアップ処理（アンマウント時の処理）を正しく実行できなくなるため、エラーになります。
  //この制限を避けるために、以下のように「同期関数の内部で非同期関数を定義し、それを即座に実行する」という手順をとっています

  useEffect(() => {
    async function setupNotifications() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
      }
    }
    setupNotifications();
  }, []);

  useEffect(() => {
    if (success) {
      seedDatabase()
        .then(() => setIsSeeded(true))
        .catch((err) => {
          console.error('Failed to seed database:', err);
          // Even if seeding fails, we might want to let the app load, but logging is good.
          setIsSeeded(true);
        });
    }
  }, [success]);

  useEffect(() => {
    if (!success || !isSeeded) return;

    const checkPastAlarms = async () => {
      try {
        const now = new Date().toISOString();
        const pastAlarms = await db.select().from(items).where(and(isNotNull(items.alarm_at), lte(items.alarm_at, now)));
        
        for (const item of pastAlarms) {
          const message = item.alarm_message || `${item.name} のアラーム時間です`;
          await db.insert(logs).values({
            id: Crypto.randomUUID(),
            item_id: item.id,
            log_type: 'alarm',
            message: `アラーム: ${message}`,
            created_at: new Date().toISOString(),
          });
          
          await db.update(items).set({
            alarm_at: null,
            alarm_message: null,
            notification_id: null,
          }).where(eq(items.id, item.id));
        }
      } catch (err) {
        console.error('Failed to check past alarms:', err);
      }
    };

    checkPastAlarms();

    const subscription = Notifications.addNotificationReceivedListener(() => {
      checkPastAlarms();
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
      checkPastAlarms();
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [success, isSeeded]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red' }}>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success || !isSeeded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3182ce" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <Stack>
          <Stack.Screen name="index" options={{ title: '在庫一覧' }} />
          <Stack.Screen name="item/add" options={{ title: 'アイテム追加', presentation: 'modal' }} />
          <Stack.Screen name="item/[id]" options={{ title: 'アイテム詳細' }} />
          <Stack.Screen name="item/select" options={{ title: 'アイテムを選択', presentation: 'modal' }} />
          <Stack.Screen name="settings/index" options={{ title: '設定' }} />
          <Stack.Screen name="settings/locations" options={{ title: '場所管理' }} />
          <Stack.Screen name="settings/categories" options={{ title: 'カテゴリー管理' }} />
          <Stack.Screen name="log/index" options={{ title: 'ログ履歴' }} />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
