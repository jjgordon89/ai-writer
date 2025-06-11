import * as lancedb from '@lancedb/lancedb';

let db: lancedb.Connection | null = null;
const DB_NAME = 'ai-fiction-writer-lancedb';

export async function initializeLanceDB(): Promise<lancedb.Connection> {
  try {
    // In a browser environment, lancedb automatically uses IndexedDB.
    // For Node.js, you might specify a file path, e.g., lancedb.connect('data/lancedb')
    db = await lancedb.connect(DB_NAME);
    console.log('LanceDB initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing LanceDB:', error);
    throw error;
  }
}

export async function createTable(tableName: string, schema: lancedb.Schema): Promise<lancedb.Table | null> {
  if (!db) {
    throw new Error('LanceDB not initialized. Call initializeLanceDB() first.');
  }
  try {
    // Check if table already exists
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName)) {
      console.log(`Table "${tableName}" already exists.`);
      return await db.openTable(tableName);
    }
    // Create a new table if it doesn't exist
    const table = await db.createTable(tableName, [{ vector: [0], text: 'dummy' }], { schema }); // Create with dummy data to define schema
    console.log(`Table "${tableName}" created successfully.`);
    return table;
  } catch (error) {
    console.error(`Error creating table "${tableName}":`, error);
    throw error;
  }
}

// TODO: Define a proper interface for the data
interface DataItem {
  vector: number[];
  text: string;
  // Add other metadata fields as needed
  [key: string]: any;
}

export async function addData(tableName: string, data: DataItem[]): Promise<void> {
  if (!db) {
    throw new Error('LanceDB not initialized. Call initializeLanceDB() first.');
  }
  try {
    const table = await db.openTable(tableName);
    await table.add(data);
    console.log(`Data added to table "${tableName}" successfully.`);
  } catch (error) {
    console.error(`Error adding data to table "${tableName}":`, error);
    throw error;
  }
}

export async function searchTable(
  tableName: string,
  queryVector: number[],
  limit: number = 10
): Promise<lancedb.Query> { // Adjust return type as needed based on how you process results
  if (!db) {
    throw new Error('LanceDB not initialized. Call initializeLanceDB() first.');
  }
  try {
    const table = await db.openTable(tableName);
    const query = table.search(queryVector).limit(limit);
    // const results = await query.execute(); // Or execute directly and return results
    console.log(`Search performed on table "${tableName}".`);
    return query; // Returning the query builder for further chaining if needed
  } catch (error) {
    console.error(`Error searching table "${tableName}":`, error);
    throw error;
  }
}

export async function closeLanceDB(): Promise<void> {
  if (!db) {
    return; // Database not open, nothing to close
  }
  try {
    // LanceDB connection doesn't have an explicit close method in the same way as some traditional DBs.
    // Connections are typically managed by the lifecycle of the application.
    // For IndexedDB, the browser handles it. For file-based, it might involve releasing file handles if applicable.
    // For now, we'll just nullify the db instance.
    console.log('LanceDB connection resources are typically managed by the environment.');
    db = null;
  } catch (error) {
    console.error('Error closing LanceDB (or rather, nullifying instance):', error);
    // No specific close operation to throw error for in this context, but good practice.
  }
}
