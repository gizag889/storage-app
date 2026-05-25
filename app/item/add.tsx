import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../src/db/client';
import { items, locations, categories } from '../../src/db/schema';
import { QuantityCounter } from '../../src/components/QuantityCounter';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const formatDateTime = (date: Date) => {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

type FormData = {
  name: string;
  quantity: number;
  memo: string;
  locationId: string | null;
  categoryId: string | null;
  alarmAt: Date | null;
};

export default function AddItemScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { control, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      name: '',
      quantity: 0,
      memo: '',
      locationId: null,
      categoryId: null,
      alarmAt: null,
    }
  });

  //日付や時間を選ぶためのカレンダー/時計画面（ダイアログ）を画面に表示するか、非表示にするかを管理するフラグ
  const [showPicker, setShowPicker] = useState(false);
  //今開いているピッカーが**「日付を選ぶ画面（カレンダー）」なのか、「時間を選ぶ画面（時計）」なのか**を区別
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  
  const [locMenuVisible, setLocMenuVisible] = useState(false);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  // --- Queries ---
  const { data: locs = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => await db.select().from(locations),
  });

  const { data: cats = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => await db.select().from(categories),
  });

  // --- Mutation ---
  const addMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let notificationId: string | null = null;
      if (data.alarmAt) {
        if (data.alarmAt.getTime() <= Date.now()) {
          throw new Error('アラーム日時は未来の時間を指定してください');
        }
        try {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'リマインダー',
              body: `${data.name} のアラーム時間です`,
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: data.alarmAt },
          });
        } catch (e) {
          console.error('Failed to schedule notification', e);
          throw new Error('通知の設定に失敗しました');
        }
      }

      await db.insert(items).values({
        id: generateUUID(),
        name: data.name,
        quantity: data.quantity,
        location_id: data.locationId,
        category_id: data.categoryId,
        memo: data.memo,
        updated_at: new Date().toISOString(),
        alarm_at: data.alarmAt ? data.alarmAt.toISOString() : null,
        notification_id: notificationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('エラー', error.message || '追加に失敗しました');
    }
  });

  const handleSave = (data: FormData) => {
    if (!data.name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    addMutation.mutate(data);
  };

  const alarmAtValue = watch('alarmAt');
  const locationIdValue = watch('locationId');
  const categoryIdValue = watch('categoryId');

  const selectedLoc = locs.find(l => l.id === locationIdValue)?.name || '選択してください';
  const selectedCat = cats.find(c => c.id === categoryIdValue)?.name || '選択してください';

  return (
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
                  {value ? formatDateTime(value) : '日時を設定'}
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
      
      <Button 
        mode="contained" 
        onPress={handleSubmit(handleSave)} 
        style={styles.button}
        loading={addMutation.isPending}
        disabled={addMutation.isPending}
      >
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
