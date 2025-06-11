import { SQLiteHttpVFS } from 'sqlite-wasm-http';

let db: any = null; // TODO: Add proper typing for the database instance

const DATABASE_FILE = 'app_database.sqlite3';

export async function initializeDatabase(): Promise<void> {
  try {
    const httpVFS = new SQLiteHttpVFS(DATABASE_FILE, {
      sqliteWasmPath: '/sqlite.wasm', // Adjust this path if necessary
    });
    // @ts-ignore TODO: Fix this ignore
    db = new (await httpVFS.isReady)(); // TODO: Add proper typing for the database instance
    await db.open(DATABASE_FILE);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export async function executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  try {
    const results = await db.exec(query, params);
    return results as T[];
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (!db) {
    return; // Database not open, nothing to close
  }
  try {
    await db.close();
    console.log('Database closed successfully');
    db = null;
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
}
