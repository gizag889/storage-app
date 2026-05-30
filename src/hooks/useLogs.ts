import { useQuery } from '@tanstack/react-query';
import { db } from '../db/client';
import { logs, items } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

export function useLogs() {
  return useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      return await db.select({
        id: logs.id,
        log_type: logs.log_type,
        message: logs.message,
        created_at: logs.created_at,
        itemName: items.name,
      })
      .from(logs)
      .leftJoin(items, eq(logs.item_id, items.id))
      .orderBy(desc(logs.created_at));
    },
  });
}
