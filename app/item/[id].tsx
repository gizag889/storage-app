import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, Menu, TouchableRipple, IconButton, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { QuantityCounter } from '../../src/components/QuantityCounter';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocations } from '../../src/hooks/useLocations';
import { useCategories } from '../../src/hooks/useCategories';
import { useItem, useUpdateItem, useDeleteItem } from '../../src/hooks/useItems';
import { useForm, Controller } from 'react-hook-form';
import { BarcodeScannerModal } from '../../src/components/BarcodeScannerModal';
import { Image } from 'expo-image';
import { pickImage, takePhoto } from '../../src/utils/image';
import { formatDate } from '../../src/utils/date';
import { ItemFormData as FormData } from '../../src/types';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  
  // --- Queries ---
  const { data: locs = [] } = useLocations();
  const { data: cats = [] } = useCategories();
  const { data: itemData, isPending, isError } = useItem(id || '');

  const { control, handleSubmit, watch, setValue } = useForm<FormData>({
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
      imageUri: null,
    },
    values: itemData ? {
      name: itemData.name,
      quantity: itemData.quantity,
      minQuantity: itemData.min_quantity,
      memo: itemData.memo || '',
      locationId: itemData.location_id,
      categoryId: itemData.category_id,
      alarmAt: itemData.alarm_at ? new Date(itemData.alarm_at) : null,
      alarmMessage: itemData.alarm_message || '',
      barcode: itemData.barcode,
      imageUri: itemData.image_uri || null,
    } : undefined
  });

  const [scannerVisible, setScannerVisible] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  
  const [locMenuVisible, setLocMenuVisible] = useState(false);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  // Handle item not found error
  useEffect(() => {
    if (isError) {
      Alert.alert('エラー', 'アイテムが見つかりません');
      router.back();
    }
  }, [isError]);


  // --- Mutations ---
  const saveMutation = useUpdateItem(id || '');
  const deleteMutation = useDeleteItem(id || '', itemData?.notification_id);

  const handleSave = (data: FormData) => {
    if (!data.name.trim()) {
      Alert.alert('エラー', 'アイテム名を入力してください');
      return;
    }
    saveMutation.mutate(data, {
      onSuccess: () => {
        router.back();
      },
      onError: (error: Error) => {
        Alert.alert('エラー', error.message || '保存に失敗しました');
      }
    });
  };

  const handleDelete = () => {
    Alert.alert('確認', 'このアイテムを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { 
        text: '削除', 
        style: 'destructive',
        onPress: () => deleteMutation.mutate(undefined, {
          onSuccess: () => {
            router.back();
          }
        })
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
          name="imageUri"
          render={({ field: { onChange, value } }) => (
            <View style={styles.imageSection}>
              {value ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: value }} style={styles.previewImage} contentFit="cover" />
                  <IconButton 
                    icon="close-circle" 
                    size={24} 
                    iconColor="white"
                    style={styles.removeImageBtn} 
                    onPress={() => onChange(null)} 
                  />
                </View>
              ) : (
                <View style={styles.imageButtons}>
                  <Button icon="camera" mode="outlined" onPress={() => takePhoto(onChange)} style={styles.imgBtn}>
                    写真を撮る
                  </Button>
                  <Button icon="image" mode="outlined" onPress={() => pickImage(onChange)} style={styles.imgBtn}>
                    ライブラリ
                  </Button>
                </View>
              )}
            </View>
          )}
        />

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
  imageSection: { marginBottom: 16, alignItems: 'center' },
  imageButtons: { flexDirection: 'row', gap: 16 },
  imgBtn: { flex: 1 },
  imagePreviewContainer: { position: 'relative', width: 200, height: 200, borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', margin: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  input: { marginBottom: 16 },
  label: { marginBottom: 8 },
  dropdownContainer: { marginBottom: 16 },
  counterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingVertical: 8 },
  button: { marginTop: 16, marginBottom: 40, paddingVertical: 8 },
  updatedAtText: { color: 'gray', fontSize: 13, marginBottom: 16, textAlign: 'right' },
});
