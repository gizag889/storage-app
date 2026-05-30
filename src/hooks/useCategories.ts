import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/client';
import { categories } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => await db.select().from(categories),
  });
}

export function useSaveCategory(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      if (id) {
        await db.update(categories).set({ name }).where(eq(categories.id, id));
      } else {
        await db.insert(categories).values({ id: Crypto.randomUUID(), name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: () => {
      Alert.alert('エラー', '保存に失敗しました');
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.delete(categories).where(eq(categories.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => {
      Alert.alert('エラー', '削除に失敗しました');
    }
  });
}
