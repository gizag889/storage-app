import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { db } from '../../src/db/client';
import { items, locations, categories } from '../../src/db/schema';
import { QuantityCounter } from '../../src/components/QuantityCounter';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function AddItemScreen() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [memo, setMemo] = useState('');
  
  const [alarmAt, setAlarmAt] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  
  const [locationId, setLocationId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  
  const [locMenuVisible, setLocMenuVisible] = useState(false);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  useEffect(() => {
    const loadMasters = async () => {
      const locData = await db.select().from(locations);
      const catData = await db.select().from(categories);
      setLocs(locData);
      setCats(catData);
    };
    loadMasters();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    
    let notificationId: string | null = null;
    if (alarmAt) {
      if (alarmAt.getTime() <= Date.now()) {
        Alert.alert('エラー', 'アラーム日時は未来の時間を指定してください');
        return;
      }
      try {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'リマインダー',
            body: `${name} のアラーム時間です`,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alarmAt },
        });
      } catch (e) {
        console.error('Failed to schedule notification', e);
        Alert.alert('エラー', '通知の設定に失敗しました');
      }
    }
    
    await db.insert(items).values({
      id: generateUUID(),
      name,
      quantity,
      location_id: locationId,
      category_id: categoryId,
      memo,
      updated_at: new Date().toISOString(),
      alarm_at: alarmAt ? alarmAt.toISOString() : null,
      notification_id: notificationId,
    });
    
    router.back();
  };

  const formatDateTime = (date: Date) => {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const selectedLoc = locs.find(l => l.id === locationId)?.name || '選択してください';
  const selectedCat = cats.find(c => c.id === categoryId)?.name || '選択してください';

  return (
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

      <View style={styles.dropdownContainer}>
        <Text variant="titleMedium" style={styles.label}>アラーム（通知）</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button 
            mode="outlined" 
            onPress={() => { setPickerMode('date'); setShowPicker(true); }}
            style={{ flex: 1, marginRight: 8 }}
          >
            {alarmAt ? formatDateTime(alarmAt) : '日時を設定'}
          </Button>
          {alarmAt && (
            <IconButton icon="close" onPress={() => setAlarmAt(null)} />
          )}
        </View>
        
        {showPicker && (
          <DateTimePicker
            value={alarmAt || new Date(Date.now() + 60 * 60 * 1000)}
            mode={pickerMode}
            is24Hour={true}
            display="default"
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') {
                setShowPicker(false);
              }
              if (event.type === 'set' && selectedDate) {
                setAlarmAt(selectedDate);
                if (pickerMode === 'date' && Platform.OS === 'android') {
                  setPickerMode('time');
                  setShowPicker(true);
                }
              } else if (event.type === 'dismissed') {
                setShowPicker(false);
              }
            }}
          />
        )}
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
      
      <Button mode="contained" onPress={handleSave} style={styles.button}>
        保存する
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  input: { marginBottom: 16 },
  label: { marginBottom: 8 },
  dropdownContainer: { marginBottom: 16 },
  counterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  button: { marginTop: 16, marginBottom: 40, paddingVertical: 8 },
});
