import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { db } from '../../src/db/client';
import { items, locations, categories, logs } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { QuantityCounter } from '../../src/components/QuantityCounter';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';

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
  minQuantity: number;
  memo: string;
  locationId: string | null;
  categoryId: string | null;
  alarmAt: Date | null;
  alarmMessage: string;
  barcode: string | null;
};

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const { control, handleSubmit, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: '',
      quantity: 0,
      minQuantity: 0,
      memo: '',
      locationId: null,
      categoryId: null,
      alarmAt: null,
      alarmMessage: '',
      barcode: null,
    }
  });

  const [scannerVisible, setScannerVisible] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
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

  const { data: itemData, isPending, isError } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const result = await db.select().from(items).where(eq(items.id, id));
      if (result.length === 0) {
        throw new Error('Item not found');
      }
      return result[0];
    },
  });

  // Load data into form when itemData is fetched
  useEffect(() => {
    if (itemData) {
      //reset は React Hook Form の useForm から提供される関数
      reset({
        name: itemData.name,
        quantity: itemData.quantity,
        minQuantity: itemData.min_quantity,
        memo: itemData.memo || '',
        locationId: itemData.location_id,
        categoryId: itemData.category_id,
        alarmAt: itemData.alarm_at ? new Date(itemData.alarm_at) : null,
        alarmMessage: itemData.alarm_message || '',
        barcode: itemData.barcode,
      });
    }
  }, [itemData, reset]);

  // Handle item not found error
  useEffect(() => {
    if (isError) {
      Alert.alert('エラー', 'アイテムが見つかりません');
      router.back();
    }
  }, [isError]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let newNotificationId = itemData?.notification_id || null;
      
      // 古い通知があればキャンセル
      if (itemData?.notification_id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(itemData.notification_id);
          newNotificationId = null;
        } catch (e) {
          console.error('Failed to cancel old notification', e);
        }
      }
      
      // 新しいアラームが設定されていればスケジュール登録
      if (data.alarmAt) {
        if (data.alarmAt.getTime() <= Date.now()) {
          throw new Error('アラーム日時は未来の時間を指定してください');
        }
        try {
          const messageBody = data.alarmMessage.trim() || `${data.name} のアラーム時間です`;
          newNotificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'リマインダー',
              body: messageBody,
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: data.alarmAt },
          });
        } catch (e) {
          console.error('Failed to schedule notification', e);
          throw new Error('通知の設定に失敗しました');
        }
      }
      
      await db.update(items).set({
        name: data.name,
        quantity: data.quantity,
        min_quantity: data.minQuantity,
        location_id: data.locationId,
        category_id: data.categoryId,
        memo: data.memo,
        barcode: data.barcode,
        updated_at: new Date().toISOString(),
        alarm_at: data.alarmAt ? data.alarmAt.toISOString() : null,
        alarm_message: data.alarmMessage.trim() || null,
        notification_id: newNotificationId,
      }).where(eq(items.id, id));

      if (itemData && itemData.quantity >= itemData.min_quantity && data.quantity < data.minQuantity) {
        await db.insert(logs).values({
          id: Crypto.randomUUID(),
          item_id: id,
          log_type: 'low_stock',
          message: `${data.name} の在庫が最低数（${data.minQuantity}）を下回りました。現在数: ${data.quantity}`,
          created_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item', id] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('エラー', error.message || '保存に失敗しました');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (itemData?.notification_id) {
        try {
          await Notifications.cancelScheduledNotificationAsync(itemData.notification_id);
        } catch (e) {
          console.error('Failed to cancel notification on delete', e);
        }
      }
      await db.delete(items).where(eq(items.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      router.back();
    }
  });

  const handleSave = (data: FormData) => {
    if (!data.name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    saveMutation.mutate(data);
  };

  const handleDelete = () => {
    Alert.alert('確認', 'このアイテムを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: () => deleteMutation.mutate()
      }
    ]);
  };

  const alarmAtValue = watch('alarmAt');
  const locationIdValue = watch('locationId');
  const categoryIdValue = watch('categoryId');

  const selectedLoc = locs.find(l => l.id === locationIdValue)?.name || '選択してください';
  const selectedCat = cats.find(c => c.id === categoryIdValue)?.name || '選択してください';

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerRight: () => (
            <IconButton 
              icon="delete" 
              iconColor="red" 
              onPress={handleDelete} 
              disabled={deleteMutation.isPending}
            />
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
        
        <Controller
          control={control}
          name="barcode"
          render={({ field: { onChange, value } }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <TextInput
                label="バーコード"
                value={value || ''}
                onChangeText={onChange}
                mode="outlined"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button mode="contained-tonal" onPress={() => setScannerVisible(true)} icon="barcode-scan">
                スキャン
              </Button>
            </View>
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

        <View style={styles.counterContainer}>
          <Text variant="titleMedium">最低在庫数 (警告のしきい値)</Text>
          <Controller
            control={control}
            name="minQuantity"
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

        {alarmAtValue && (
          <Controller
            control={control}
            name="alarmMessage"
            render={({ field: { onChange, value } }) => (
              <TextInput
                label="アラームのメッセージ (任意)"
                value={value}
                onChangeText={onChange}
                mode="outlined"
                style={styles.input}
              />
            )}
          />
        )}

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
        
        {itemData?.updated_at ? (
          <Text style={styles.updatedAtText}>
            最終更新日時: {formatDate(itemData.updated_at)}
          </Text>
        ) : null}
        
        <Button 
          mode="contained" 
          onPress={handleSubmit(handleSave)} 
          style={styles.button}
          loading={saveMutation.isPending}
          disabled={saveMutation.isPending}
        >
          保存する
        </Button>

        <BarcodeScannerModal
          visible={scannerVisible}
          onDismiss={() => setScannerVisible(false)}
          onScan={(code) => {
            setValue('barcode', code);
          }}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  input: { marginBottom: 16 },
  label: { marginBottom: 8 },
  dropdownContainer: { marginBottom: 16 },
  counterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  button: { marginTop: 16, marginBottom: 40, paddingVertical: 8 },
  updatedAtText: { color: 'gray', fontSize: 13, marginBottom: 16, textAlign: 'right' },
});
