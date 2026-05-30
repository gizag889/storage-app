import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/client';
import { items, locations, categories, logs } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { scheduleAlarm, cancelAlarm } from '../utils/notification';
import { ItemFormData, ItemWithRelations } from '../types';

// すべてのアイテムをRelation付きで取得
export function useItems(searchQuery?: string) {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const query = db.select({
        id: items.id,
        name: items.name,
        quantity: items.quantity,
        minQuantity: items.min_quantity,
        locationName: locations.name,
        categoryName: categories.name,
        memo: items.memo,
        updatedAt: items.updated_at,
        alarmAt: items.alarm_at,
        barcode: items.barcode,
        imageUri: items.image_uri,
      }).from(items)
        .leftJoin(locations, eq(items.location_id, locations.id))
        .leftJoin(categories, eq(items.category_id, categories.id));

      return await query;
    },
    select: (result) => {
      if (!searchQuery) return result;
      return result.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.locationName && item.locationName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.barcode && item.barcode.includes(searchQuery))
      );
    }
  });
}

// バーコードでアイテムをRelation付きで取得
export function useItemsByBarcode(barcode: string) {
  return useQuery({
    queryKey: ['items', 'barcode', barcode],
    queryFn: async () => {
      if (!barcode) return [];
      
      const query = db.select({
        id: items.id,
        name: items.name,
        quantity: items.quantity,
        minQuantity: items.min_quantity,
        locationName: locations.name,
        categoryName: categories.name,
        memo: items.memo,
        updatedAt: items.updated_at,
        alarmAt: items.alarm_at,
        barcode: items.barcode,
        imageUri: items.image_uri,
      }).from(items)
        .leftJoin(locations, eq(items.location_id, locations.id))
        .leftJoin(categories, eq(items.category_id, categories.id))
        .where(eq(items.barcode, barcode));

      return await query;
    },
  });
}

// 特定のアイテムを取得
export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const result = await db.select().from(items).where(eq(items.id, id));
      if (result.length === 0) {
        throw new Error('Item not found');
      }
      return result[0];
    },
  });
}

// アイテムの追加
export function useAddItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ItemFormData) => {
      let notificationId: string | null = null;
      if (data.alarmAt) {
        notificationId = await scheduleAlarm(data.alarmAt, data.alarmMessage, data.name);
      }

      await db.insert(items).values({
        id: Crypto.randomUUID(),
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
        notification_id: notificationId,
        image_uri: data.imageUri,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// アイテムの更新
export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ItemFormData) => {
      const results = await db.select().from(items).where(eq(items.id, id));
      const currentItem = results[0];
      
      let newNotificationId = currentItem?.notification_id || null;
      
      if (currentItem?.notification_id) {
        await cancelAlarm(currentItem.notification_id);
        newNotificationId = null;
      }
      
      if (data.alarmAt) {
        newNotificationId = await scheduleAlarm(data.alarmAt, data.alarmMessage, data.name);
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
        image_uri: data.imageUri,
      }).where(eq(items.id, id));

      if (currentItem && currentItem.quantity >= currentItem.min_quantity && data.quantity < data.minQuantity) {
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
    },
  });
}

// アイテムの削除
export function useDeleteItem(id: string, currentNotificationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      let notificationId = currentNotificationId;
      if (notificationId === undefined) {
        const results = await db.select().from(items).where(eq(items.id, id));
        notificationId = results[0]?.notification_id;
      }
      if (notificationId) {
        await cancelAlarm(notificationId);
      }
      await db.delete(items).where(eq(items.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// アイテム数量の更新（楽観的更新付き）
export function useUpdateItemQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, newQuantity }: { item: ItemWithRelations; newQuantity: number }) => {
      await db.update(items)
        .set({ 
          quantity: newQuantity, 
          updated_at: new Date().toISOString() 
        })
        .where(eq(items.id, item.id));

      if (item.quantity >= item.minQuantity && newQuantity < item.minQuantity) {
        await db.insert(logs).values({
          id: Crypto.randomUUID(),
          item_id: item.id,
          log_type: 'low_stock',
          message: `${item.name} の在庫が最低数（${item.minQuantity}）を下回りました。現在数: ${newQuantity}`,
          created_at: new Date().toISOString(),
        });
      }
    },
    onMutate: async ({ item, newQuantity }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousItems = queryClient.getQueryData<ItemWithRelations[]>(['items']);
      
      if (previousItems) {
        queryClient.setQueryData<ItemWithRelations[]>(['items'], old => 
          old ? old.map(i => i.id === item.id ? { ...i, quantity: newQuantity } : i) : []
        );
      }
      return { previousItems };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
