import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { FAB, List, Searchbar, Chip, Text, useTheme, Snackbar } from 'react-native-paper';
import { QuickScanModal } from '../src/components/QuickScanModal';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { seedDatabase } from '../src/db/seed';
import { QuantityCounter } from '../src/components/QuantityCounter';
import { Image } from 'expo-image';
import { formatDate } from '../src/utils/date';
import { ItemWithRelations } from '../src/types';
import { useItems, useUpdateItemQuantity } from '../src/hooks/useItems';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();
  const [quickScanVisible, setQuickScanVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  const { data, isPending, isError, isFetching } = useItems(searchQuery);
  const mutation = useUpdateItemQuantity();


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
              left={() => (
                <View style={styles.listItemImageContainer}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.listItemImage} contentFit="cover" />
                  ) : (
                    <View style={styles.listItemNoImage}>
                      <Text style={{color: '#999', fontSize: 10}}>No Image</Text>
                    </View>
                  )}
                </View>
              )}
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
  listItemImageContainer: { width: 60, height: 60, borderRadius: 8, overflow: 'hidden', marginRight: 8, marginLeft: 8, alignSelf: 'center', backgroundColor: '#f0f0f0' },
  listItemImage: { width: '100%', height: '100%' },
  listItemNoImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
});
