import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { FAB, List, Searchbar, Chip, Text, useTheme, Snackbar } from 'react-native-paper';
import { QuickScanModal } from '../src/components/QuickScanModal';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seedDatabase } from '../src/db/seed';
import * as Crypto from 'expo-crypto';
import { db } from '../src/db/client';
import { items, locations, categories, logs } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { QuantityCounter } from '../src/components/QuantityCounter';

type ItemWithRelations = {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  locationName: string | null;
  categoryName: string | null;
  memo: string | null;
  updatedAt: string;
  alarmAt: string | null;
  barcode: string | null;
};

const formatDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hr = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hr}:${min}`;
  } catch {
    return isoString;
  }
};

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [quickScanVisible, setQuickScanVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      let query = db.select({
        id: items.id,
        name: items.name,
        quantity: items.quantity,
        minQuantity: items.min_quantity,
        locationName: locations.name,
        categoryName: categories.name,
        memo: items.memo,
        updatedAt: items.updated_at,
        alarmAt: items.alarm_at,
        barcode: items.barcode,
      }).from(items)
        .leftJoin(locations, eq(items.location_id, locations.id))
        .leftJoin(categories, eq(items.category_id, categories.id));

      return await query;
    },
    //TanStack Query の select オプションを利用して、「データベースから取得した全データの中から、ユーザーが入力した検索ワードに合致するアイテムだけを抽出（フィルタリング）する」
    select: (result) => {
       // 1. 検索ワード（searchQuery）が空の場合は、加工せずそのまま全データを返す
      if (!searchQuery) return result;
      // 2. 検索ワードがある場合、全データ（result）から条件に合うものだけを絞り込む
      return result.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.locationName && item.locationName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.barcode && item.barcode.includes(searchQuery))
      );
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ item, newQuantity }: { item: ItemWithRelations, newQuantity: number }) => {
      await db.update(items)
        .set({ 
          quantity: newQuantity, 
          updated_at: new Date().toISOString() 
        })
        .where(eq(items.id, item.id));

      if (item.quantity >= item.minQuantity && newQuantity < item.minQuantity) {
        await db.insert(logs).values({
          id: Crypto.randomUUID(),
          item_id: item.id,
          log_type: 'low_stock',
          message: `${item.name} の在庫が最低数（${item.minQuantity}）を下回りました。現在数: ${newQuantity}`,
          created_at: new Date().toISOString(),
        });
      }
    },
    onMutate: async ({ item, newQuantity }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousItems = queryClient.getQueryData<ItemWithRelations[]>(['items']);
      
      if (previousItems) {
        queryClient.setQueryData<ItemWithRelations[]>(['items'], old => 
          old ? old.map(i => i.id === item.id ? { ...i, quantity: newQuantity } : i) : []
        );
      }
      return { previousItems };
    },
    //context.previousItems をキャッシュに戻すことで、画面を「変更前の正しい状態」へと自動的に戻す。
    onError: (err, newTodo, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems);
      }
    },
    //更新処理（Mutation）が成功・失敗どちらで終わったとしても、最終的に最新の正しいデータをデータベースから再取得して、UIの状態を完全に同期する
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const handleQuantityChange = (item: ItemWithRelations, newQuantity: number) => {
    mutation.mutate({ item, newQuantity });
  };

  const handleQuickScan = (barcode: string, mode: 'add' | 'remove') => {
    const matchedItems = data?.filter(i => i.barcode === barcode) || [];
    
    if (matchedItems.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setQuickScanVisible(false);
      router.push(`/item/add?barcode=${barcode}`);
    } else if (matchedItems.length === 1) {
      const item = matchedItems[0];
      const newQuantity = mode === 'add' ? item.quantity + 1 : Math.max(0, item.quantity - 1);
      handleQuantityChange(item, newQuantity);
      setSnackbarMessage(`${item.name}の在庫を${mode === 'add' ? '+1' : '-1'}しました。`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setQuickScanVisible(false);
      setSnackbarVisible(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setQuickScanVisible(false);
      router.push(`/item/select?barcode=${barcode}&mode=${mode}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="アイテム名、場所、カテゴリー、バーコードで検索"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        {isFetching && !isPending && (
          <ActivityIndicator 
            size="small" 
            color={theme.colors.primary} 
            style={styles.fetchingIndicator} 
          />
        )}
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: 'red' }}>データの読み込みに失敗しました</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              description={() => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {item.categoryName && (
                    <Chip compact style={{ marginRight: 8, marginBottom: 4 }} icon="shape">{item.categoryName}</Chip>
                  )}
                  {item.locationName && (
                    <Chip compact style={{ marginRight: 8, marginBottom: 4 }} icon="map-marker">{item.locationName}</Chip>
                  )}
                  {item.memo && (
                    <Text variant="bodySmall" numberOfLines={1} style={{ color: 'gray', marginRight: 8, marginBottom: 4 }}>
                      {item.memo}
                    </Text>
                  )}
                  {item.alarmAt && (
                    <Chip compact style={{ marginRight: 8, marginBottom: 4, backgroundColor: '#fff3e0' }} icon="bell">
                      {formatDate(item.alarmAt)}
                    </Chip>
                  )}
                  {item.barcode && (
                    <Chip compact style={{ marginRight: 8, marginBottom: 4 }} icon="barcode">
                      {item.barcode}
                    </Chip>
                  )}
                  <Text variant="bodySmall" style={{ color: 'gray', fontSize: 11, marginBottom: 4 }}>
                    更新: {formatDate(item.updatedAt)}
                  </Text>
                </View>
              )}
              right={() => (
                <QuantityCounter 
                  value={item.quantity} 
                  onChange={(val) => handleQuantityChange(item, val)} 
                  isAlert={item.quantity < item.minQuantity}
                  targetValue={item.minQuantity}
                />
              )}
              onPress={() => router.push(`/item/${item.id}`)}
              style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
            />
          )}
        />
      )}

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'menu'}
        actions={[
          { icon: 'history', label: 'ログを確認', onPress: () => router.push('/log') },
          { icon: 'cog', label: '設定', onPress: () => router.push('/settings') },
          { icon: 'plus', label: 'アイテム追加', onPress: () => router.push('/item/add') },
          { icon: 'barcode-scan', label: 'クイックスキャン', onPress: () => setQuickScanVisible(true) },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        onPress={() => {
          if (fabOpen) {
            // do something if the speed dial is open
          }
        }}
      />
      
      <QuickScanModal
        visible={quickScanVisible}
        onDismiss={() => setQuickScanVisible(false)}
        onScan={handleQuickScan}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ bottom: 80 }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', position: 'relative' },
  searchbar: { elevation: 0, backgroundColor: '#f0f0f0' },
  fetchingIndicator: { position: 'absolute', right: 28, top: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
