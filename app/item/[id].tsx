import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton } from 'react-native-paper';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { db } from '../../src/db/client';
import { items, locations, categories } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { QuantityCounter } from '../../src/components/QuantityCounter';

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

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [memo, setMemo] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  
  const [locationId, setLocationId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  
  const [locMenuVisible, setLocMenuVisible] = useState(false);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const locData = await db.select().from(locations);
      const catData = await db.select().from(categories);
      setLocs(locData);
      setCats(catData);
      
      const itemData = await db.select().from(items).where(eq(items.id, id));
      if (itemData.length > 0) {
        const item = itemData[0];
        setName(item.name);
        setQuantity(item.quantity);
        setMemo(item.memo || '');
        setLocationId(item.location_id);
        setCategoryId(item.category_id);
        setUpdatedAt(item.updated_at);
      } else {
        Alert.alert('エラー', 'アイテムが見つかりません');
        router.back();
      }
    };
    loadData();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    
    await db.update(items).set({
      name,
      quantity,
      location_id: locationId,
      category_id: categoryId,
      memo,
      updated_at: new Date().toISOString()
    }).where(eq(items.id, id));
    
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('確認', 'このアイテムを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: async () => {
          await db.delete(items).where(eq(items.id, id));
          router.back();
        }
      }
    ]);
  };

  const selectedLoc = locs.find(l => l.id === locationId)?.name || '選択してください';
  const selectedCat = cats.find(c => c.id === categoryId)?.name || '選択してください';

  return (
    <>
      <Stack.Screen 
        options={{
          headerRight: () => (
            <IconButton icon="delete" iconColor="red" onPress={handleDelete} />
          )
        }} 
      />
      <ScrollView style={styles.container}>
        <TextInput
          label="アイテム名 (必須)"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
        />
        
        <View style={styles.counterContainer}>
          <Text variant="titleMedium">数量</Text>
          <QuantityCounter value={quantity} onChange={setQuantity} min={0} />
        </View>
        
        <View style={styles.dropdownContainer}>
          <Text variant="titleMedium" style={styles.label}>保管場所</Text>
          <Menu
            visible={locMenuVisible}
            onDismiss={() => setLocMenuVisible(false)}
            anchor={
              <TouchableRipple onPress={() => setLocMenuVisible(true)}>
                <TextInput value={selectedLoc} editable={false} mode="outlined" right={<TextInput.Icon icon="menu-down" />} />
              </TouchableRipple>
            }
          >
            <Menu.Item onPress={() => { setLocationId(null); setLocMenuVisible(false); }} title="未選択" />
            {locs.map(l => (
              <Menu.Item key={l.id} onPress={() => { setLocationId(l.id); setLocMenuVisible(false); }} title={l.name} />
            ))}
          </Menu>
        </View>
        
        <View style={styles.dropdownContainer}>
          <Text variant="titleMedium" style={styles.label}>カテゴリー</Text>
          <Menu
            visible={catMenuVisible}
            onDismiss={() => setCatMenuVisible(false)}
            anchor={
              <TouchableRipple onPress={() => setCatMenuVisible(true)}>
                <TextInput value={selectedCat} editable={false} mode="outlined" right={<TextInput.Icon icon="menu-down" />} />
              </TouchableRipple>
            }
          >
            <Menu.Item onPress={() => { setCategoryId(null); setCatMenuVisible(false); }} title="未選択" />
            {cats.map(c => (
              <Menu.Item key={c.id} onPress={() => { setCategoryId(c.id); setCatMenuVisible(false); }} title={c.name} />
            ))}
          </Menu>
        </View>

        <TextInput
          label="メモ"
          value={memo}
          onChangeText={setMemo}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={styles.input}
        />
        
        {updatedAt ? (
          <Text style={styles.updatedAtText}>
            最終更新日時: {formatDate(updatedAt)}
          </Text>
        ) : null}
        
        <Button mode="contained" onPress={handleSave} style={styles.button}>
          保存する
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  input: { marginBottom: 16 },
  label: { marginBottom: 8 },
  dropdownContainer: { marginBottom: 16 },
  counterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  button: { marginTop: 16, marginBottom: 40, paddingVertical: 8 },
  updatedAtText: { color: 'gray', fontSize: 13, marginBottom: 16, textAlign: 'right' },
});
