import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { List, FAB, Dialog, Portal, Button, TextInput, IconButton, useTheme } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../src/db/client';
import { categories } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

export default function CategoriesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // --- Queries ---
  const { data: categoriesData = [], isPending } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => await db.select().from(categories),
  });

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      if (id) {
        await db.update(categories).set({ name }).where(eq(categories.id, id));
      } else {
        await db.insert(categories).values({ id: Crypto.randomUUID(), name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      hideDialog();
    },
    onError: () => {
      Alert.alert('エラー', '保存に失敗しました');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.delete(categories).where(eq(categories.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => {
      Alert.alert('エラー', '削除に失敗しました');
    }
  });

  const showDialog = (id?: string, currentName?: string) => {
    if (id) {
      setEditId(id);
      setName(currentName || '');
    } else {
      setEditId(null);
      setName('');
    }
    setVisible(true);
  };

  const hideDialog = () => {
    setVisible(false);
    setName('');
    setEditId(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    saveMutation.mutate({ id: editId, name });
  };

  const handleDelete = (id: string) => {
    Alert.alert('確認', 'このカテゴリーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id)
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={categoriesData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              left={props => <List.Icon {...props} icon="shape" />}
              right={props => (
                <View style={{ flexDirection: 'row' }}>
                  <IconButton 
                    icon="pencil" 
                    onPress={() => showDialog(item.id, item.name)} 
                    disabled={deleteMutation.isPending || saveMutation.isPending}
                  />
                  <IconButton 
                    icon="delete" 
                    iconColor="red" 
                    onPress={() => handleDelete(item.id)} 
                    disabled={deleteMutation.isPending || saveMutation.isPending}
                  />
                </View>
              )}
            />
          )}
        />
      )}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => showDialog()}
        disabled={deleteMutation.isPending || saveMutation.isPending}
      />
      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog}>
          <Dialog.Title>{editId ? 'カテゴリーを編集' : 'カテゴリーを追加'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="カテゴリー名"
              value={name}
              onChangeText={setName}
              mode="outlined"
              autoFocus
              disabled={saveMutation.isPending}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDialog} disabled={saveMutation.isPending}>キャンセル</Button>
            <Button onPress={handleSave} loading={saveMutation.isPending} disabled={saveMutation.isPending}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
