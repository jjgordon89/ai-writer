import { LanceDBService, TextChunk } from '../lanceDBService'; // Assuming TextChunk is exported
import { EnhancedSecureAIService } from '../enhancedAIProviders';

// Mock EnhancedSecureAIService
const mockAIServiceInstance = {
  getEmbeddings: jest.fn(),
  getActiveEmbeddingModelDimension: jest.fn(),
} as unknown as EnhancedSecureAIService;

// Mock @lancedb/lancedb module
const mockLanceTable = {
  add: jest.fn(),
  search: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  execute: jest.fn(),
  schema: jest.fn(),
};
const mockLanceDBConnection = {
  openTable: jest.fn(),
  createTable: jest.fn().mockResolvedValue(mockLanceTable),
  tableNames: jest.fn().mockResolvedValue([]),
};
jest.mock('@lancedb/lancedb', () => ({
  connect: jest.fn().mockResolvedValue(mockLanceDBConnection),
}));


describe('LanceDBService', () => {
  let lanceDBService: LanceDBService;
  const testEmbeddingDimension = 1536;

  beforeEach(() => {
    jest.clearAllMocks();
    lanceDBService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension);
  });

  describe('initialize', () => {
    it('should connect to lancedb and create a new table if it does not exist', async () => {
      (mockLanceDBConnection.openTable as jest.Mock).mockRejectedValueOnce(new Error('Table not found'));
      (mockLanceDBConnection.createTable as jest.Mock).mockResolvedValueOnce(mockLanceTable);

      await lanceDBService.initialize();

      expect(require('@lancedb/lancedb').connect).toHaveBeenCalledWith('lancedb');
      expect(mockLanceDBConnection.openTable).toHaveBeenCalledWith('style_tone_analysis');
      expect(mockLanceDBConnection.createTable).toHaveBeenCalledWith(
        'style_tone_analysis',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'dummy',
            text: 'dummy text',
            vector: expect.any(Array),
            source: 'dummy_source',
            createdAt: expect.any(String),
          }),
        ])
      );
      const createTableCallArgs = (mockLanceDBConnection.createTable as jest.Mock).mock.calls[0];
      const exampleDataForSchema = createTableCallArgs[1];
      expect(exampleDataForSchema[0].vector.length).toBe(testEmbeddingDimension);

      // @ts-ignore
      expect(lanceDBService.isInitialized).toBe(true);
      // @ts-ignore
      expect(lanceDBService.table).toBe(mockLanceTable);
    });

    it('should connect to lancedb and open an existing table', async () => {
      (mockLanceDBConnection.openTable as jest.Mock).mockResolvedValueOnce(mockLanceTable);

      await lanceDBService.initialize();

      expect(require('@lancedb/lancedb').connect).toHaveBeenCalledWith('lancedb');
      expect(mockLanceDBConnection.openTable).toHaveBeenCalledWith('style_tone_analysis');
      expect(mockLanceDBConnection.createTable).not.toHaveBeenCalled();

      // @ts-ignore
      expect(lanceDBService.isInitialized).toBe(true);
      // @ts-ignore
      expect(lanceDBService.table).toBe(mockLanceTable);
    });

    it('should throw an error if lancedb.connect fails', async () => {
      (require('@lancedb/lancedb').connect as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await expect(lanceDBService.initialize()).rejects.toThrow('LanceDB initialization failed.');
      // @ts-ignore
      expect(lanceDBService.isInitialized).toBe(false);
    });

    it('should throw an error if opening and creating a table fails', async () => {
      (mockLanceDBConnection.openTable as jest.Mock).mockRejectedValueOnce(new Error('Open failed'));
      (mockLanceDBConnection.createTable as jest.Mock).mockRejectedValueOnce(new Error('Create failed'));

      await expect(lanceDBService.initialize()).rejects.toThrow('LanceDB initialization failed.');
       // @ts-ignore
      expect(lanceDBService.isInitialized).toBe(false);
    });

    it('should not re-initialize if already initialized', async () => {
        (mockLanceDBConnection.openTable as jest.Mock).mockResolvedValueOnce(mockLanceTable);
        await lanceDBService.initialize();

        jest.clearAllMocks(); // Clear mocks for lancedb.connect as well
        // Manually clear connect mock as it's module level
        (require('@lancedb/lancedb').connect as jest.Mock).mockClear();
        (mockLanceDBConnection.openTable as jest.Mock).mockClear();
        (mockLanceDBConnection.createTable as jest.Mock).mockClear();

        await lanceDBService.initialize();

        expect(require('@lancedb/lancedb').connect).not.toHaveBeenCalled();
        expect(mockLanceDBConnection.openTable).not.toHaveBeenCalled();
        expect(mockLanceDBConnection.createTable).not.toHaveBeenCalled();
    });
  });

  // Helper to ensure service is initialized for tests that need it
  async function ensureInitialized(serviceInstance: LanceDBService) {
    // @ts-ignore Access private member for check
    if (!serviceInstance.isInitialized) {
      (mockLanceDBConnection.openTable as jest.Mock).mockResolvedValue(mockLanceTable); // Assume table exists for simplicity
      await serviceInstance.initialize();
      // Clear mocks that initialize might have called if we only care about test-specific calls
      (mockLanceDBConnection.openTable as jest.Mock).mockClear();
      (require('@lancedb/lancedb').connect as jest.Mock).mockClear();
      (mockLanceDBConnection.createTable as jest.Mock).mockClear(); // Also clear createTable
    }
  }

  describe('addText', () => {
    const testText = 'This is a test text.';
    const testSource = 'test-document';
    const mockEmbedding = Array(testEmbeddingDimension).fill(0.5);

    beforeEach(async () => {
      // Reset AIService mocks for each test
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockReset();
      (mockLanceTable.add as jest.Mock).mockReset();
      // Ensure service is initialized before each test in this suite
      lanceDBService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension); // Re-instantiate
      await ensureInitialized(lanceDBService);
    });

    it('should successfully add text with valid embedding', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([mockEmbedding]);
      (mockLanceTable.add as jest.Mock).mockResolvedValueOnce(undefined); // Simulate successful add

      await lanceDBService.addText(testText, testSource);

      expect(mockAIServiceInstance.getEmbeddings).toHaveBeenCalledWith([testText]);
      expect(mockLanceTable.add).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            text: testText,
            vector: mockEmbedding,
            source: testSource,
            // In LanceDBService, `createdAt` in the TextChunk is a Date object.
            // It's converted to ISO string only when passed to table.add()
            // So, the object created inside addText will have a Date object.
            // However, the actual call to table.add receives an ISOString.
            // The mock for table.add should check the object it *receives*.
            createdAt: expect.any(String),
          }),
        ])
      );
      // To be more precise about what table.add receives:
      const argsToTableAdd = (mockLanceTable.add as jest.Mock).mock.calls[0][0];
      expect(argsToTableAdd[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should throw if not initialized', async () => {
      const uninitializedService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension);
      await expect(uninitializedService.addText(testText, testSource))
        .rejects.toThrow('LanceDBService not initialized or table not available.');
    });

    it('should throw if getEmbeddings fails', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockRejectedValueOnce(new Error('Embedding failed'));
      await expect(lanceDBService.addText(testText, testSource))
        .rejects.toThrow('Embedding failed');
    });

    it('should throw if getEmbeddings returns no embeddings', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([]);
      await expect(lanceDBService.addText(testText, testSource))
        .rejects.toThrow('Failed to generate embeddings for the text.');
    });

    it('should throw if getEmbeddings returns an embedding with incorrect dimension', async () => {
      const wrongDimensionEmbedding = Array(testEmbeddingDimension - 1).fill(0.1);
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([wrongDimensionEmbedding]);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // This test assumes LanceDBService itself throws an error for dimension mismatch.
      // The current implementation only logs a warning.
      // To make this test pass, LanceDBService.addText needs to be updated to throw an error.
      // For now, let's expect the warning and that it *doesn't* throw for this specific case,
      // unless we decide to change the service's behavior.
      // Or, we can assert that it throws a specific error if we modify the service.
      // Given the prompt's text: "This test expects a specific error"
      // I'll assume the service *will* be modified to throw this error.
      await expect(lanceDBService.addText(testText, testSource))
        .rejects.toThrow(`Embedding dimension mismatch. Expected ${testEmbeddingDimension}, got ${wrongDimensionEmbedding.length}`);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Generated embedding dimension (${wrongDimensionEmbedding.length}) does not match expected dimension (${testEmbeddingDimension})`));
      consoleWarnSpy.mockRestore();
    });

    it('should throw if table.add fails', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([mockEmbedding]);
      (mockLanceTable.add as jest.Mock).mockRejectedValueOnce(new Error('Table add failed'));
      await expect(lanceDBService.addText(testText, testSource))
        .rejects.toThrow('Table add failed');
    });
  });

  describe('searchSimilarTexts', () => {
    const queryText = 'Search query';
    const mockQueryEmbedding = Array(testEmbeddingDimension).fill(0.3);
    const mockSearchResults = [
      { id: '1', text: 'result1', vector: [], source: 's1', createdAt: new Date().toISOString(), score: 0.9, _score: 0.9 }, // lancedb adds _score
      { id: '2', text: 'result2', vector: [], source: 's2', createdAt: new Date().toISOString(), score: 0.8, _score: 0.8 },
    ];

    beforeEach(async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockReset();
      (mockLanceTable.search as jest.Mock).mockClear();
      (mockLanceTable.limit as jest.Mock).mockClear();
      (mockLanceTable.execute as jest.Mock).mockClear();

      lanceDBService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension);
      await ensureInitialized(lanceDBService);

      (mockLanceTable.execute as jest.Mock).mockResolvedValue(mockSearchResults.map(r => ({...r, vector: expect.any(Array) }))); // ensure vector is present
    });

    it('should successfully search for similar texts', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([mockQueryEmbedding]);

      const results = await lanceDBService.searchSimilarTexts(queryText, 2);

      expect(mockAIServiceInstance.getEmbeddings).toHaveBeenCalledWith([queryText]);
      expect(mockLanceTable.search).toHaveBeenCalledWith(mockQueryEmbedding);
      expect(mockLanceTable.limit).toHaveBeenCalledWith(2);
      expect(mockLanceTable.execute).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(2);
      expect(results[0].text).toBe('result1');
      expect(results[0].createdAt).toBeInstanceOf(Date);
    });

    it('should throw if not initialized', async () => {
      const uninitializedService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension);
      await expect(uninitializedService.searchSimilarTexts(queryText))
        .rejects.toThrow('LanceDBService not initialized or table not available.');
    });

    it('should throw if getEmbeddings for query fails', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockRejectedValueOnce(new Error('Query embedding failed'));
      await expect(lanceDBService.searchSimilarTexts(queryText))
        .rejects.toThrow('Query embedding failed');
    });

    it('should throw if getEmbeddings for query returns an embedding with incorrect dimension', async () => {
      const wrongDimensionEmbedding = Array(testEmbeddingDimension + 10).fill(0.1);
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([wrongDimensionEmbedding]);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Assuming service will be updated to throw this error
      await expect(lanceDBService.searchSimilarTexts(queryText))
        .rejects.toThrow(`Query embedding dimension mismatch. Expected ${testEmbeddingDimension}, got ${wrongDimensionEmbedding.length}`);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Generated query embedding dimension (${wrongDimensionEmbedding.length}) does not match expected dimension (${testEmbeddingDimension})`));
      consoleWarnSpy.mockRestore();
    });

    it('should throw if table.search fails', async () => {
      (mockAIServiceInstance.getEmbeddings as jest.Mock).mockResolvedValueOnce([mockQueryEmbedding]);
      (mockLanceTable.search as jest.Mock).mockImplementationOnce(() => { throw new Error('Table search failed'); });

      await expect(lanceDBService.searchSimilarTexts(queryText))
        .rejects.toThrow('Table search failed');
    });
  });

  describe('getTableSchema', () => {
    beforeEach(async () => {
        (mockLanceTable.schema as jest.Mock).mockReset();
        lanceDBService = new LanceDBService(mockAIServiceInstance, testEmbeddingDimension);
    });

    it('should return table schema if initialized', async () => {
        await ensureInitialized(lanceDBService);
        const mockSchema = { fields: [{ name: 'vector', type: `Vector(${testEmbeddingDimension})`}] }; // Use testEmbeddingDimension
        (mockLanceTable.schema as jest.Mock).mockResolvedValue(mockSchema);

        const schema = await lanceDBService.getTableSchema();

        expect(mockLanceTable.schema).toHaveBeenCalled();
        expect(schema).toEqual(mockSchema);
    });

    it('should throw if not initialized', async () => {
        await expect(lanceDBService.getTableSchema())
            .rejects.toThrow('LanceDBService not initialized or table not available.');
    });
  });
});
