import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { FAB, List, Searchbar, Chip, Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../src/db/client';
import { items, locations, categories } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { QuantityCounter } from '../src/components/QuantityCounter';

type ItemWithRelations = {
  id: string;
  name: string;
  quantity: number;
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

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      let query = db.select({
        id: items.id,
        name: items.name,
        quantity: items.quantity,
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
    mutationFn: async ({ id, newQuantity }: { id: string, newQuantity: number }) => {
      await db.update(items)
        .set({ 
          quantity: newQuantity, 
          updated_at: new Date().toISOString() 
        })
        .where(eq(items.id, id));
    },
    onMutate: async ({ id, newQuantity }) => {
      //楽観的アップデート（Optimistic Updates）**を実現するために、進行中の（またはフェッチ待ちの）クエリをキャンセルする
      await queryClient.cancelQueries({ queryKey: ['items'] });
      //通信エラーやサーバー処理の失敗時に、UIの表示を元の正しい状態にロールバック（復元）するため、previousItemに保存
      const previousItems = queryClient.getQueryData<ItemWithRelations[]>(['items']);
      
      if (previousItems) {
        queryClient.setQueryData<ItemWithRelations[]>(['items'], old => 
          //外側の条件分岐:old ? (存在する場合の処理) : [] キャッシュデータ（old）が存在するかどうか
          //内側の条件分岐:item.id === id ? (変更する) : (そのまま) ループ中のアイテムが**「今回数量を変更した対象のアイテムか」
          old ? old.map(item => item.id === id ? { ...item, quantity: newQuantity } : item) : []
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

  const handleQuantityChange = (id: string, newQuantity: number) => {
    mutation.mutate({ id, newQuantity });
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
                  onChange={(val) => handleQuantityChange(item.id, val)} 
                />
              )}
              onPress={() => router.push(`/item/${item.id}`)}
              style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
            />
          )}
        />
      )}

      <FAB
        style={[styles.fab, { bottom: 80, right: 16 }]}
        icon="cog"
        onPress={() => router.push('/settings')}
        variant="surface"
        size="small"
      />
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => router.push('/item/add')}
      />
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
