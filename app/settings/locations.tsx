import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { List, FAB, Dialog, Portal, Button, TextInput, IconButton, useTheme } from 'react-native-paper';
import { useLocations, useSaveLocation, useDeleteLocation } from '../../src/hooks/useLocations';

export default function LocationsScreen() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // --- Queries ---
  const { data: locationsData = [], isPending } = useLocations();

  // --- Mutations ---
  const saveMutation = useSaveLocation(() => hideDialog());
  const deleteMutation = useDeleteLocation();

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
