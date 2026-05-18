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

  // モックの「アイテム」データ挿入
  await db.insert(items).values([
    {
      id: generateUUID(),
      name: 'トイレットペーパー',
      quantity: 5,
      location_id: location3Id,
      category_id: category1Id,
      memo: '12ロール入り',
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'ティッシュペーパー',
      quantity: 3,
      location_id: location2Id,
      category_id: category1Id,
      memo: '5箱パック',
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: '醤油',
      quantity: 1,
      location_id: location1Id,
      category_id: category2Id,
      memo: '濃口',
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: '食器用洗剤',
      quantity: 2,
      location_id: location1Id,
      category_id: category3Id,
      memo: '詰め替え用大容量',
      updated_at: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: 'お風呂の洗剤',
      quantity: 0,
      location_id: location3Id,
      category_id: category3Id,
      memo: '早めに買う！',
      updated_at: new Date().toISOString(),
    }
  ]);
}
