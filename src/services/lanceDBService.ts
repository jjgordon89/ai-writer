import * as lancedb from '@lancedb/lancedb';
import { AIService } from './aiProviders';

interface TextChunk {
  id: string;
  text: string;
  vector: number[];
  source: string; // e.g., document name, chapter, etc.
  createdAt: Date;
}

export class LanceDBService {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private aiService: AIService;
  private readonly embeddingDimension: number;
  private tableName: string = 'style_tone_analysis';
  private isInitialized: boolean = false;

  constructor(aiService: AIService, embeddingDimension: number) {
    this.aiService = aiService;
    this.embeddingDimension = embeddingDimension;
    if (embeddingDimension <= 0) {
      throw new Error("Embedding dimension must be a positive number.");
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('LanceDBService already initialized.');
      return;
    }

    try {
      // In a browser environment, lancedb.connect usually uses an in-memory or browser-storage-backed DB.
      // For Node.js, it might be different, e.g., lancedb.connect('data/lancedb')
      // For now, let's assume a simple URI suitable for browser or basic Node.js setup.
      this.db = await lancedb.connect('lancedb'); // Or a more specific URI if needed
      console.log('Connected to LanceDB.');

      // Attempt to open the table, or create it if it doesn't exist.
      // This requires a schema or example data to infer the schema.
      // We'll define a schema based on TextChunk, focusing on the vector.
      // The actual dimension of the vector depends on the embedding model used.
      // This needs to be determined (e.g., OpenAI's text-embedding-ada-002 is 1536).
      // Use the passed embedding dimension.
      const exampleDataForSchema = [{
        id: 'dummy',
        text: 'dummy text',
        vector: Array(this.embeddingDimension).fill(0.1),
        source: 'dummy_source',
        createdAt: new Date().toISOString() // Storing as ISO string
      }];

      try {
        this.table = await this.db.openTable(this.tableName);
        console.log(`Table '${this.tableName}' opened successfully.`);
      } catch (e) {
        console.log(`Table '${this.tableName}' not found, creating it...`);
        // Create table with example data to infer schema
        this.table = await this.db.createTable(this.tableName, exampleDataForSchema);
        console.log(`Table '${this.tableName}' created successfully.`);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize LanceDBService:', error);
      throw new Error('LanceDB initialization failed.');
    }
  }

  async addText(text: string, source: string, id?: string): Promise<void> {
    if (!this.isInitialized || !this.table) {
      throw new Error('LanceDBService not initialized or table not available.');
    }

    // 1. Get embedding for the text using AIService
    // Pass a specific model name if needed, or let AIService use its default.
    // e.g., 'text-embedding-3-small'
    const embeddings = await this.aiService.getEmbeddings([text]);
    if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
      throw new Error('Failed to generate embeddings for the text.');
    }
    const vector = embeddings[0];

    if (vector.length !== this.embeddingDimension) {
      const message = `Generated embedding dimension (${vector.length}) does not match expected dimension (${this.embeddingDimension}). Ensure AI Service is configured with the correct model.`;
      console.warn(message);
      throw new Error(`Embedding dimension mismatch. Expected ${this.embeddingDimension}, got ${vector.length}`);
    }

    const chunk: TextChunk = {
      id: id || crypto.randomUUID(),
      text,
      vector,
      source,
      createdAt: new Date(),
    };

    try {
      // LanceDB's add method expects an array of objects
      await this.table.add([ { ...chunk, createdAt: chunk.createdAt.toISOString() } ]);
      console.log(`Text chunk added to LanceDB table '${this.tableName}'.`);
    } catch (error) {
      console.error('Failed to add text chunk to LanceDB:', error);
      throw error;
    }
  }

  // Placeholder for search method
  async searchSimilarTexts(queryText: string, limit: number = 5): Promise<TextChunk[]> {
    if (!this.isInitialized || !this.table) {
      throw new Error('LanceDBService not initialized or table not available.');
    }

    // 1. Get embedding for the queryText using AIService
    // Pass a specific model name if needed, or let AIService use its default.
    const embeddings = await this.aiService.getEmbeddings([queryText]);
    if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
      throw new Error('Failed to generate embeddings for the query text.');
    }
    const queryVector = embeddings[0];

    if (queryVector.length !== this.embeddingDimension) {
      const message = `Generated query embedding dimension (${queryVector.length}) does not match expected dimension (${this.embeddingDimension}). Ensure AI Service is configured with the correct model.`;
      console.warn(message);
      throw new Error(`Query embedding dimension mismatch. Expected ${this.embeddingDimension}, got ${queryVector.length}`);
    }

    try {
      const results = await this.table
        .search(queryVector)
        .limit(limit)
        .execute<TextChunk>(); // Execute and cast to TextChunk

      console.log(`Found ${results.length} similar texts.`);
      return results.map(r => ({
        ...r,
        // Ensure createdAt is a Date object if it's stored as string/number
        createdAt: new Date(r.createdAt)
      }));
    } catch (error) {
      console.error('Failed to search similar texts in LanceDB:', error);
      throw error;
    }
  }

  async getTableSchema(): Promise<any> {
     if (!this.isInitialized || !this.table) {
      throw new Error('LanceDBService not initialized or table not available.');
    }
    return await this.table.schema();
  }
}

// Optional: Singleton instance
// export const lanceDBService = new LanceDBService(aiServiceInstance); // Requires aiServiceInstance
