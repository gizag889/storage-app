import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

// Open synchronous SQLite database
const expoDb = SQLite.openDatabaseSync('my-storage.db', { enableChangeListener: true });

// Pass it to drizzle
export const db = drizzle(expoDb);
