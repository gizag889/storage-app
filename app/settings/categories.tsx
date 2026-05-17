import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { List, FAB, Dialog, Portal, Button, TextInput, IconButton } from 'react-native-paper';
import { db } from '../../src/db/client';
import { categories } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export default function CategoriesScreen() {
  const [data, setData] = useState<{ id: string; name: string }[]>([]);
  const [visible, setVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const loadData = async () => {
    const result = await db.select().from(categories);
    setData(result);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleSave = async () => {
    if (!name.trim()) return;
    
    if (editId) {
      await db.update(categories).set({ name }).where(eq(categories.id, editId));
    } else {
      await db.insert(categories).values({ id: uuidv4(), name });
    }
    
    hideDialog();
    loadData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('確認', 'このカテゴリーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: async () => {
          await db.delete(categories).where(eq(categories.id, id));
          loadData();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            left={props => <List.Icon {...props} icon="shape" />}
            right={props => (
              <View style={{ flexDirection: 'row' }}>
                <IconButton icon="pencil" onPress={() => showDialog(item.id, item.name)} />
                <IconButton icon="delete" iconColor="red" onPress={() => handleDelete(item.id)} />
              </View>
            )}
          />
        )}
      />
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => showDialog()}
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
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDialog}>キャンセル</Button>
            <Button onPress={handleSave}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
