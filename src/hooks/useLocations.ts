import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/client';
import { locations } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => await db.select().from(locations),
  });
}

export function useSaveLocation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      if (id) {
        await db.update(locations).set({ name }).where(eq(locations.id, id));
      } else {
        await db.insert(locations).values({ id: Crypto.randomUUID(), name });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: () => {
      Alert.alert('エラー', '保存に失敗しました');
    }
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.delete(locations).where(eq(locations.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: () => {
      Alert.alert('エラー', '削除に失敗しました');
    }
  });
}
