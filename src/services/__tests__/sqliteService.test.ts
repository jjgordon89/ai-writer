import { initializeDatabase, executeQuery, closeDatabase } from '../sqliteService';
import { SQLiteHttpVFS } from 'sqlite-wasm-http';

// Mock the SQLiteHttpVFS and its methods
let mockDbInstance: any;
const mockSQLiteHttpVFS = {
  isReady: jest.fn(),
};

jest.mock('sqlite-wasm-http', () => ({
  SQLiteHttpVFS: jest.fn().mockImplementation(() => mockSQLiteHttpVFS),
}));

describe('SQLiteService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    mockDbInstance = {
      open: jest.fn().mockResolvedValue(undefined),
      exec: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.startsWith('SELECT 1')) {
          return Promise.resolve([{ columns: ['1'], rows: [[1]] }]);
        }
        if (sql.startsWith('CREATE TABLE test_table')) {
          return Promise.resolve([]);
        }
        if (sql.startsWith('INSERT INTO test_table')) {
          return Promise.resolve([]);
        }
        if (sql.startsWith('SELECT * FROM test_table')) {
            return Promise.resolve([{ columns: ['id', 'name'], rows: [['1', 'Test Name']] }]);
        }
        if (sql.includes('INVALID SQL')) {
          return Promise.reject(new Error('Invalid SQL'));
        }
        return Promise.resolve([]); // Default for other exec calls
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // @ts-ignore
    mockSQLiteHttpVFS.isReady.mockResolvedValue(function() { return mockDbInstance });
    // @ts-ignore
    SQLiteHttpVFS.mockImplementation(() => mockSQLiteHttpVFS);
  });

  afterEach(() => {
    // Ensure db is reset for other test files if any
    // This is important if the service maintains a global db instance
    return closeDatabase();
  });

  describe('initializeDatabase', () => {
    it('should initialize and open the database successfully', async () => {
      await initializeDatabase();
      expect(SQLiteHttpVFS).toHaveBeenCalledTimes(1);
      expect(mockSQLiteHttpVFS.isReady).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.open).toHaveBeenCalledWith('app_database.sqlite3');
    });

    it('should handle errors during database initialization', async () => {
      const initError = new Error('Failed to open DB');
      mockDbInstance.open.mockRejectedValueOnce(initError);

      await expect(initializeDatabase()).rejects.toThrow('Failed to open DB');
      expect(SQLiteHttpVFS).toHaveBeenCalledTimes(1);
      expect(mockSQLiteHttpVFS.isReady).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.open).toHaveBeenCalledWith('app_database.sqlite3');
    });
     it('should handle errors if VFS is not ready', async () => {
      const vfsError = new Error('VFS not ready');
      // @ts-ignore
      mockSQLiteHttpVFS.isReady.mockRejectedValueOnce(vfsError);
      await expect(initializeDatabase()).rejects.toThrow('VFS not ready');
      expect(SQLiteHttpVFS).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      // Ensure database is initialized before each query test
      await initializeDatabase();
    });

    it('should throw an error if database is not initialized', async () => {
      // First, close the DB to simulate it not being initialized
      await closeDatabase();
      // Then try to execute a query
      await expect(executeQuery('SELECT 1')).rejects.toThrow('Database not initialized. Call initializeDatabase() first.');
    });

    it('should execute a CREATE TABLE query successfully', async () => {
      await expect(executeQuery('CREATE TABLE test_table (id TEXT, name TEXT)')).resolves.not.toThrow();
      expect(mockDbInstance.exec).toHaveBeenCalledWith('CREATE TABLE test_table (id TEXT, name TEXT)', undefined);
    });

    it('should execute an INSERT query successfully', async () => {
      await expect(executeQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test'])).resolves.not.toThrow();
      expect(mockDbInstance.exec).toHaveBeenCalledWith('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test']);
    });

    it('should execute a SELECT query and return results', async () => {
      const results = await executeQuery('SELECT * FROM test_table');
      expect(mockDbInstance.exec).toHaveBeenCalledWith('SELECT * FROM test_table', undefined);
      expect(results).toEqual([{ columns: ['id', 'name'], rows: [['1', 'Test Name']] }]);
    });

    it('should handle errors for invalid SQL queries', async () => {
      await expect(executeQuery('INVALID SQL QUERY')).rejects.toThrow('Invalid SQL');
      expect(mockDbInstance.exec).toHaveBeenCalledWith('INVALID SQL QUERY', undefined);
    });

    it('should handle database errors during query execution', async () => {
      const dbError = new Error('DB query failed');
      mockDbInstance.exec.mockRejectedValueOnce(dbError);
      await expect(executeQuery('SELECT * FROM another_table')).rejects.toThrow('DB query failed');
    });
  });

  describe('closeDatabase', () => {
    it('should close the database successfully if initialized', async () => {
      await initializeDatabase(); // Ensure DB is open
      await closeDatabase();
      expect(mockDbInstance.close).toHaveBeenCalledTimes(1);
    });

    it('should not throw if closing when already closed or not initialized', async () => {
      // Call close without initializing
      await expect(closeDatabase()).resolves.not.toThrow();
      expect(mockDbInstance.close).not.toHaveBeenCalled(); // Should not be called if db was null

      // Initialize, then close, then close again
      await initializeDatabase();
      await closeDatabase();
      expect(mockDbInstance.close).toHaveBeenCalledTimes(1);
      await closeDatabase(); // Call close again
      expect(mockDbInstance.close).toHaveBeenCalledTimes(1); // Still 1, as db becomes null
    });

     it('should handle errors during database closing', async () => {
      await initializeDatabase();
      const closeError = new Error('Failed to close DB');
      mockDbInstance.close.mockRejectedValueOnce(closeError);

      await expect(closeDatabase()).rejects.toThrow('Failed to close DB');
      expect(mockDbInstance.close).toHaveBeenCalledTimes(1);
    });
  });
});
