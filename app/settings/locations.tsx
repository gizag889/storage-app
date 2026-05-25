import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { List, FAB, Dialog, Portal, Button, TextInput, IconButton, useTheme } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../src/db/client';
import { locations } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export default function LocationsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // --- Queries ---
  const { data: locationsData = [], isPending } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => await db.select().from(locations),
  });

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      if (id) {
        await db.update(locations).set({ name }).where(eq(locations.id, id));
      } else {
        await db.insert(locations).values({ id: uuidv4(), name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      hideDialog();
    },
    onError: () => {
      Alert.alert('エラー', '保存に失敗しました');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.delete(locations).where(eq(locations.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
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
    Alert.alert('確認', 'この場所を削除しますか？', [
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
          data={locationsData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              left={props => <List.Icon {...props} icon="map-marker" />}
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
          <Dialog.Title>{editId ? '場所を編集' : '場所を追加'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="場所の名前"
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
