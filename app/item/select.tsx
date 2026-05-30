import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { List, Text, Chip, useTheme, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useItemsByBarcode, useUpdateItemQuantity } from '../../src/hooks/useItems';
import { ItemWithRelations } from '../../src/types';

export default function SelectItemScreen() {
  const { barcode, mode } = useLocalSearchParams<{ barcode: string; mode: 'add' | 'remove' }>();
  const theme = useTheme();

  const { data, isPending, isError } = useItemsByBarcode(barcode || '');
  const mutation = useUpdateItemQuantity();

  const handleSelectItem = (item: ItemWithRelations) => {
    if (!mode) return;
    const newQuantity = mode === 'add' ? item.quantity + 1 : Math.max(0, item.quantity - 1);
    mutation.mutate({ item, newQuantity }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    });
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
