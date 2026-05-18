import { db } from './client';
import { locations, categories, items } from './schema';

// ネイティブモジュールのエラーを避けるため、ピュアJSの簡易UUIDジェネレーターを使用します
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function seedDatabase() {
  // 既にデータが存在するか確認
  const existingLocations = await db.select().from(locations);
  if (existingLocations.length > 0) {
    return; // 既にデータがある場合はシードをスキップ
  }

  // モックの「場所」データ挿入
  const location1Id = generateUUID();
  const location2Id = generateUUID();
  const location3Id = generateUUID();
  
  await db.insert(locations).values([
    { id: location1Id, name: 'キッチン' },
    { id: location2Id, name: 'リビング' },
    { id: location3Id, name: '洗面所' },
  ]);

  // モックの「カテゴリー」データ挿入
  const category1Id = generateUUID();
  const category2Id = generateUUID();
  const category3Id = generateUUID();
  
  await db.insert(categories).values([
    { id: category1Id, name: '日用品' },
    { id: category2Id, name: '食料品' },
    { id: category3Id, name: '掃除用具' },
  ]);

  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // モックの「アイテム」データ挿入
  await db.insert(items).values([
    {
      id: generateUUID(),
      name: 'トイレットペーパー',
      quantity: 5,
      location_id: location3Id,
      category_id: category1Id,
      memo: '12ロール入り',
      updated_at: fiveMinAgo,
    },
    {
      id: generateUUID(),
      name: 'ティッシュペーパー',
      quantity: 3,
      location_id: location2Id,
      category_id: category1Id,
      memo: '5箱パック',
      updated_at: oneHourAgo,
    },
    {
      id: generateUUID(),
      name: '醤油',
      quantity: 1,
      location_id: location1Id,
      category_id: category2Id,
      memo: '濃口',
      updated_at: yesterday,
    },
    {
      id: generateUUID(),
      name: '食器用洗剤',
      quantity: 2,
      location_id: location1Id,
      category_id: category3Id,
      memo: '詰め替え用大容量',
      updated_at: threeDaysAgo,
    },
    {
      id: generateUUID(),
      name: 'お風呂の洗剤',
      quantity: 0,
      location_id: location3Id,
      category_id: category3Id,
      memo: '早めに買う！',
      updated_at: oneWeekAgo,
    }
  ]);
}
