import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton } from 'react-native-paper';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { db } from '../../src/db/client';
import { items, locations, categories } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { QuantityCounter } from '../../src/components/QuantityCounter';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';

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

type FormData = {
  name: string;
  quantity: number;
  memo: string;
  locationId: string | null;
  categoryId: string | null;
  alarmAt: Date | null;
};

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { control, handleSubmit, reset, watch } = useForm<FormData>({
    defaultValues: {
      name: '',
      quantity: 0,
      memo: '',
      locationId: null,
      categoryId: null,
      alarmAt: null,
    }
  });

  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [notificationId, setNotificationId] = useState<string | null>(null);
  
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  
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
        reset({
          name: item.name,
          quantity: item.quantity,
          memo: item.memo || '',
          locationId: item.location_id,
          categoryId: item.category_id,
          alarmAt: item.alarm_at ? new Date(item.alarm_at) : null,
        });
        setUpdatedAt(item.updated_at);
        setNotificationId(item.notification_id || null);
      } else {
        Alert.alert('エラー', 'アイテムが見つかりません');
        router.back();
      }
    };
    loadData();
  }, [id, reset]);

  const handleSave = async (data: FormData) => {
    if (!data.name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    
    let newNotificationId = notificationId;
    
    // 古い通知があればキャンセル
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        newNotificationId = null;
      } catch (e) {
        console.error('Failed to cancel old notification', e);
      }
    }
    
    // 新しいアラームが設定されていればスケジュール登録
    if (data.alarmAt) {
      if (data.alarmAt.getTime() <= Date.now()) {
        Alert.alert('エラー', 'アラーム日時は未来の時間を指定してください');
        return;
      }
      try {
        newNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'リマインダー',
            body: `${data.name} のアラーム時間です`,
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: data.alarmAt },
        });
      } catch (e) {
        console.error('Failed to schedule notification', e);
        Alert.alert('エラー', '通知の設定に失敗しました');
      }
    }
    
    await db.update(items).set({
      name: data.name,
      quantity: data.quantity,
      location_id: data.locationId,
      category_id: data.categoryId,
      memo: data.memo,
      updated_at: new Date().toISOString(),
      alarm_at: data.alarmAt ? data.alarmAt.toISOString() : null,
      notification_id: newNotificationId,
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
          if (notificationId) {
            try {
              await Notifications.cancelScheduledNotificationAsync(notificationId);
            } catch (e) {
              console.error(e);
            }
          }
          await db.delete(items).where(eq(items.id, id));
          router.back();
        }
      }
    ]);
  };

  const alarmAtValue = watch('alarmAt');
  const locationIdValue = watch('locationId');
  const categoryIdValue = watch('categoryId');

  const selectedLoc = locs.find(l => l.id === locationIdValue)?.name || '選択してください';
  const selectedCat = cats.find(c => c.id === categoryIdValue)?.name || '選択してください';

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
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="アイテム名 (必須)"
              value={value}
              onChangeText={onChange}
              mode="outlined"
              style={styles.input}
            />
          )}
        />
        
        <View style={styles.counterContainer}>
          <Text variant="titleMedium">数量</Text>
          <Controller
            control={control}
            name="quantity"
            render={({ field: { onChange, value } }) => (
              <QuantityCounter value={value} onChange={onChange} min={0} />
            )}
          />
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
            <Controller
              control={control}
              name="locationId"
              render={({ field: { onChange } }) => (
                <>
                  <Menu.Item onPress={() => { onChange(null); setLocMenuVisible(false); }} title="未選択" />
                  {locs.map(l => (
                    <Menu.Item key={l.id} onPress={() => { onChange(l.id); setLocMenuVisible(false); }} title={l.name} />
                  ))}
                </>
              )}
            />
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
            <Controller
              control={control}
              name="categoryId"
              render={({ field: { onChange } }) => (
                <>
                  <Menu.Item onPress={() => { onChange(null); setCatMenuVisible(false); }} title="未選択" />
                  {cats.map(c => (
                    <Menu.Item key={c.id} onPress={() => { onChange(c.id); setCatMenuVisible(false); }} title={c.name} />
                  ))}
                </>
              )}
            />
          </Menu>
        </View>
        
        <View style={styles.dropdownContainer}>
          <Text variant="titleMedium" style={styles.label}>アラーム（通知）</Text>
          <Controller
            control={control}
            name="alarmAt"
            render={({ field: { onChange, value } }) => (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Button 
                    mode="outlined" 
                    onPress={() => { setPickerMode('date'); setShowPicker(true); }}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    {value ? formatDate(value.toISOString()) : '日時を設定'}
                  </Button>
                  {value && (
                    <IconButton icon="close" onPress={() => onChange(null)} />
                  )}
                </View>
                
                {showPicker && (
                  <DateTimePicker
                    value={value || new Date(Date.now() + 60 * 60 * 1000)}
                    mode={pickerMode}
                    is24Hour={true}
                    display="default"
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowPicker(false);
                      }
                      if (event.type === 'set' && selectedDate) {
                        onChange(selectedDate);
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
              </>
            )}
          />
        </View>

        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="メモ"
              value={value}
              onChangeText={onChange}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
            />
          )}
        />
        
        {updatedAt ? (
          <Text style={styles.updatedAtText}>
            最終更新日時: {formatDate(updatedAt)}
          </Text>
        ) : null}
        
        <Button mode="contained" onPress={handleSubmit(handleSave)} style={styles.button}>
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
