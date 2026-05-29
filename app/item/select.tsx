import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { List, Text, Chip, useTheme, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { db } from '../../src/db/client';
import { items, locations, categories, logs } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';

type ItemWithRelations = {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  locationName: string | null;
  categoryName: string | null;
  memo: string | null;
  barcode: string | null;
};

export default function SelectItemScreen() {
  const { barcode, mode } = useLocalSearchParams<{ barcode: string; mode: 'add' | 'remove' }>();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['items', 'barcode', barcode],
    queryFn: async () => {
      if (!barcode) return [];
      
      let query = db.select({
        id: items.id,
        name: items.name,
        quantity: items.quantity,
        minQuantity: items.min_quantity,
        locationName: locations.name,
        categoryName: categories.name,
        memo: items.memo,
        barcode: items.barcode,
      }).from(items)
        .leftJoin(locations, eq(items.location_id, locations.id))
        .leftJoin(categories, eq(items.category_id, categories.id))
        .where(eq(items.barcode, barcode));

      return await query;
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  });

  const handleSelectItem = (item: ItemWithRelations) => {
    if (!mode) return;
    const newQuantity = mode === 'add' ? item.quantity + 1 : Math.max(0, item.quantity - 1);
    mutation.mutate({ item, newQuantity });
  };

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>データの読み込みに失敗しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>どのアイテムを{mode === 'add' ? '入庫(+1)' : '出庫(-1)'}しますか？</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={() => (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <Chip 
                  compact 
                  style={{ marginRight: 8, marginBottom: 4 }} 
                  icon="package"
                >
                  <Text>数量: </Text>
                  <Text style={item.quantity < item.minQuantity ? { color: theme.colors.error } : undefined}>
                    {item.quantity}
                  </Text>
                  <Text> / {item.minQuantity}</Text>
                </Chip>
                {item.locationName && (
                  <Chip compact style={{ marginRight: 8, marginBottom: 4 }} icon="map-marker">
                    {item.locationName}
                  </Chip>
                )}
                {item.categoryName && (
                  <Chip compact style={{ marginRight: 8, marginBottom: 4 }} icon="shape">
                    {item.categoryName}
                  </Chip>
                )}
              </View>
            )}
            onPress={() => handleSelectItem(item)}
            style={styles.listItem}
            right={props => <List.Icon {...props} icon="chevron-right" />}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    margin: 16,
    color: '#333',
  },
  listItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});
