import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { FAB, List, Searchbar, Chip, Text, useTheme } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { db } from '../src/db/client';
import { items, locations, categories } from '../src/db/schema';
import { eq, desc, like } from 'drizzle-orm';
import { QuantityCounter } from '../src/components/QuantityCounter';

type ItemWithRelations = {
  id: string;
  name: string;
  quantity: number;
  locationName: string | null;
  categoryName: string | null;
  memo: string | null;
  updatedAt: string;
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
  const [data, setData] = useState<ItemWithRelations[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();

  const loadData = async () => {
    let query = db.select({
      id: items.id,
      name: items.name,
      quantity: items.quantity,
      locationName: locations.name,
      categoryName: categories.name,
      memo: items.memo,
      updatedAt: items.updated_at,
    }).from(items)
      .leftJoin(locations, eq(items.location_id, locations.id))
      .leftJoin(categories, eq(items.category_id, categories.id));

    const result = await query;
    // Client-side filtering for simplicity given Drizzle SQLite limitations with complex dynamic wheres
    const filtered = result.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.locationName && item.locationName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setData(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [searchQuery])
  );

  const handleQuantityChange = async (id: string, newQuantity: number) => {
    // Update local state immediately for snappy UI
    setData(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
    
    // Update DB
    await db.update(items)
      .set({ 
        quantity: newQuantity, 
        updated_at: new Date().toISOString() 
      })
      .where(eq(items.id, id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="アイテム名、場所、カテゴリーで検索"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

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
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchbar: { elevation: 0, backgroundColor: '#f0f0f0' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
