/**
 * LanceDB Vector Database Service for Semantic Search
 * Provides AI-powered content discovery, character similarity analysis, and thematic search
 */

import lancedb from 'lancedb';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { Project, Character, StoryArc } from '../types';
import { ErrorSanitizer } from '../utils/errorSanitization';

// Vector database record interfaces
export interface DocumentEmbedding {
  id: string;
  projectId: string;
  documentType: 'manuscript' | 'chapter' | 'scene' | 'note' | 'character' | 'story_arc';
  title: string;
  content: string;
  metadata: Record<string, any>;
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterEmbedding {
  id: string;
  characterId: string;
  projectId: string;
  name: string;
  description: string;
  traits: string[];
  role: string;
  combinedText: string;
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeEmbedding {
  id: string;
  projectId: string;
  theme: string;
  description: string;
  examples: string[];
  relatedContent: string[];
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult<T = any> {
  item: T;
  score: number;
  distance: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface VectorDatabaseConfig {
  dbPath: string;
  openaiApiKey?: string;
  embeddingModel: string;
  maxRetries: number;
  batchSize: number;
}

export class VectorDatabaseService {
  private static instance: VectorDatabaseService;
  private db: lancedb.Lancedb | null = null;
  private openai: OpenAI | null = null;
  private config: VectorDatabaseConfig;
  
  // Table references
  private documentsTable: Table<DocumentEmbedding> | null = null;
  private charactersTable: Table<CharacterEmbedding> | null = null;
  private themesTable: Table<ThemeEmbedding> | null = null;
  
  private isInitialized = false;

  private constructor() {
    this.config = {
      dbPath: './data/vector-db',
      embeddingModel: 'text-embedding-ada-002',
      maxRetries: 3,
      batchSize: 100
    };
  }

  static getInstance(): VectorDatabaseService {
    if (!VectorDatabaseService.instance) {
      VectorDatabaseService.instance = new VectorDatabaseService();
    }
    return VectorDatabaseService.instance;
  }

  /**
   * Initialize vector database and embedding service
   */
  async initialize(config?: Partial<VectorDatabaseConfig>): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Update configuration
      this.config = { ...this.config, ...config };

      // Initialize OpenAI client
      if (this.config.openaiApiKey) {
        this.openai = new OpenAI({
          apiKey: this.config.openaiApiKey,
          dangerouslyAllowBrowser: true // Note: In production, use server-side
        });
      }

      // Connect to LanceDB
      this.connection = await connect(this.config.dbPath);
      
      // Initialize tables
      await this.initializeTables(this.db);
      
      this.isInitialized = true;
      console.log('✅ Vector database service initialized successfully');
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'VectorDatabaseService',
        action: 'initialize'
      });
      console.error('❌ Vector database initialization failed:', sanitizedError.message);
      throw new Error(`Vector database initialization failed: ${sanitizedError.message}`);
    }
  }

  /**
   * Set OpenAI API key for embeddings
   */
  setOpenAIKey(apiKey: string): void {
    this.config.openaiApiKey = apiKey;
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return this.isInitialized && this.openai !== null;
  }

  // DOCUMENT OPERATIONS

  /**
   * Add or update document embeddings
   */
  async addDocument(
    projectId: string,
    documentType: DocumentEmbedding['documentType'],
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      const id = uuidv4();
      const vector = await this.generateEmbedding(content);
      
      const document: DocumentEmbedding = {
        id,
        projectId,
        documentType,
        title,
        content: this.truncateContent(content, 8000), // Limit content size
        metadata,
        vector,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.documentsTable!.add([document]);
      return id;
    } catch (error) {
      throw new Error(`Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for similar documents
   */
  async searchDocuments(
    query: string,
    projectId?: string,
    limit: number = 10,
    documentType?: DocumentEmbedding['documentType']
  ): Promise<SearchResult<DocumentEmbedding>[]> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      const queryVector = await this.generateEmbedding(query);
      
      let searchQuery = this.documentsTable!
        .search(queryVector)
        .limit(limit);

      if (projectId) {
        searchQuery = searchQuery.where(`projectId = '${projectId}'`);
      }

      if (documentType) {
        searchQuery = searchQuery.where(`documentType = '${documentType}'`);
      }

      const results = await searchQuery.toArray();
      
      return results.map(result => ({
        item: result,
        score: this.calculateRelevanceScore(result._distance),
        distance: result._distance,
        relevance: this.categorizeRelevance(result._distance)
      }));
    } catch (error) {
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing document
   */
  async updateDocument(
    id: string,
    updates: Partial<Pick<DocumentEmbedding, 'title' | 'content' | 'metadata'>>
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      // Delete existing record
      await this.documentsTable!.delete(`id = '${id}'`);

      // Get the existing document to preserve other fields
      const existing = await this.documentsTable!
        .search([])
        .where(`id = '${id}'`)
        .limit(1)
        .toArray();

      if (existing.length > 0) {
        const doc = existing[0];
        const newContent = updates.content || doc.content;
        const vector = updates.content ? await this.generateEmbedding(newContent) : doc.vector;

        const updatedDocument: DocumentEmbedding = {
          ...doc,
          ...updates,
          content: newContent,
          vector,
          updatedAt: new Date()
        };

        await this.documentsTable!.add([updatedDocument]);
      }
    } catch (error) {
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // CHARACTER OPERATIONS

  /**
   * Add character embedding
   */
  async addCharacter(character: Character, projectId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      const id = uuidv4();
      const combinedText = this.createCharacterText(character);
      const vector = await this.generateEmbedding(combinedText);

      const characterEmbedding: CharacterEmbedding = {
        id,
        characterId: character.id,
        projectId,
        name: character.name,
        description: character.description,
        traits: character.traits,
        role: character.role,
        combinedText,
        vector,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.charactersTable!.add([characterEmbedding]);
      return id;
    } catch (error) {
      throw new Error(`Failed to add character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find similar characters
   */
  async findSimilarCharacters(
    characterDescription: string,
    projectId?: string,
    limit: number = 5,
    excludeCharacterId?: string
  ): Promise<SearchResult<CharacterEmbedding>[]> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      const queryVector = await this.generateEmbedding(characterDescription);
      
      let searchQuery = this.charactersTable!
        .search(queryVector)
        .limit(limit + (excludeCharacterId ? 1 : 0)); // Get extra if excluding one

      if (projectId) {
        searchQuery = searchQuery.where(`projectId = '${projectId}'`);
      }

      const results = await searchQuery.toArray();
      
      // Filter out excluded character
      const filteredResults = excludeCharacterId 
        ? results.filter(r => r.characterId !== excludeCharacterId)
        : results;

      return filteredResults.slice(0, limit).map(result => ({
        item: result,
        score: this.calculateRelevanceScore(result._distance),
        distance: result._distance,
        relevance: this.categorizeRelevance(result._distance)
      }));
    } catch (error) {
      throw new Error(`Character search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // THEME ANALYSIS

  /**
   * Analyze and extract themes from project content
   */
  async analyzeThemes(project: Project): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      // Combine project content for theme analysis
      const combinedContent = [
        project.content,
        project.description,
        ...project.characters.map(c => `${c.description} ${c.backstory}`),
        ...project.storyArcs.map(a => `${a.title} ${a.description}`)
      ].filter(Boolean).join('\n\n');

      // Use OpenAI to extract themes
      if (!this.openai) {
        throw new Error('OpenAI client not available');
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a literary analyst. Extract 5-10 key themes from the provided text. Return only a JSON array of theme names.'
          },
          {
            role: 'user',
            content: `Analyze the themes in this fiction project:\n\n${combinedContent.slice(0, 4000)}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      try {
        return JSON.parse(content);
      } catch {
        // If JSON parsing fails, extract themes manually
        return content.split('\n')
          .map(line => line.replace(/^[-*•]\s*/, '').trim())
          .filter(theme => theme.length > 0)
          .slice(0, 10);
      }
    } catch (error) {
      console.warn('Theme analysis failed:', error);
      return [];
    }
  }

  /**
   * Store theme embeddings
   */
  async storeTheme(
    projectId: string,
    theme: string,
    description: string,
    examples: string[] = [],
    relatedContent: string[] = []
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      const id = uuidv4();
      const combinedText = `${theme} ${description} ${examples.join(' ')}`;
      const vector = await this.generateEmbedding(combinedText);

      const themeEmbedding: ThemeEmbedding = {
        id,
        projectId,
        theme,
        description,
        examples,
        relatedContent,
        vector,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.themesTable!.add([themeEmbedding]);
      return id;
    } catch (error) {
      throw new Error(`Failed to store theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // CONTENT SUGGESTIONS

  /**
   * Get content suggestions based on current writing
   */
  async getContentSuggestions(
    currentText: string,
    projectId: string,
    suggestionType: 'continuation' | 'inspiration' | 'related' = 'related',
    limit: number = 5
  ): Promise<SearchResult<DocumentEmbedding>[]> {
    if (!this.isConfigured()) {
      throw new Error('Vector database not properly configured');
    }

    try {
      let queryText = currentText;
      
      // Enhance query based on suggestion type
      if (suggestionType === 'continuation') {
        queryText = `continue this story: ${currentText}`;
      } else if (suggestionType === 'inspiration') {
        queryText = `similar themes and style: ${currentText}`;
      }

      return await this.searchDocuments(queryText, projectId, limit);
    } catch (error) {
      throw new Error(`Content suggestions failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // UTILITY METHODS

  /**
   * Delete all embeddings for a project
   */
  async deleteProjectEmbeddings(projectId: string): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await Promise.all([
        this.documentsTable?.delete(`projectId = '${projectId}'`),
        this.charactersTable?.delete(`projectId = '${projectId}'`),
        this.themesTable?.delete(`projectId = '${projectId}'`)
      ]);
    } catch (error) {
      console.warn('Failed to delete project embeddings:', error);
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    documents: number;
    characters: number;
    themes: number;
    totalVectors: number;
  }> {
    if (!this.isInitialized) {
      return { documents: 0, characters: 0, themes: 0, totalVectors: 0 };
    }

    try {
      const [documents, characters, themes] = await Promise.all([
        this.documentsTable?.countRows() || 0,
        this.charactersTable?.countRows() || 0,
        this.themesTable?.countRows() || 0
      ]);

      return {
        documents,
        characters,
        themes,
        totalVectors: documents + characters + themes
      };
    } catch (error) {
      console.warn('Failed to get statistics:', error);
      return { documents: 0, characters: 0, themes: 0, totalVectors: 0 };
    }
  }

  /**
   * Health check for vector database
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string; latency?: number }> {
    if (!this.isInitialized) {
      return { status: 'unhealthy', details: 'Vector database not initialized' };
    }

    try {
      const startTime = Date.now();
      await this.getStatistics();
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        details: 'Vector database operational',
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Vector database error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // PRIVATE METHODS

  private async initializeTables(db: lancedb.Lancedb): Promise<void> {
    try {
      // Try to open existing tables or create new ones
      try {
        this.documentsTable = await db.openTable('documents');
      } catch {
        this.documentsTable = await db.createTable('documents', []);
      }

      try {
        this.charactersTable = await db.openTable('characters');
      } catch {
        this.charactersTable = await db.createTable('characters', []);
      }

      try {
        this.themesTable = await db.openTable('themes');
      } catch {
        this.themesTable = await db.createTable('themes', []);
      }
    } catch (error) {
      throw new Error(`Failed to initialize tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not available');
    }

    const cleanText = this.cleanTextForEmbedding(text);
    
    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: cleanText
    });

    return response.data[0].embedding;
  }

  private cleanTextForEmbedding(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:()"'-]/g, '') // Remove special characters
      .trim()
      .slice(0, 8191); // OpenAI token limit
  }

  private truncateContent(content: string, maxLength: number): string {
    return content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
  }

  private createCharacterText(character: Character): string {
    return [
      character.name,
      character.description,
      character.backstory,
      character.traits.join(' '),
      character.role,
      character.notes
    ].filter(Boolean).join(' ');
  }

  private calculateRelevanceScore(distance: number): number {
    // Convert distance to a 0-100 score (lower distance = higher score)
    return Math.max(0, Math.min(100, (1 - distance) * 100));
  }

  private categorizeRelevance(distance: number): 'high' | 'medium' | 'low' {
    if (distance < 0.3) return 'high';
    if (distance < 0.7) return 'medium';
    return 'low';
  }
}

// Singleton instance
export const vectorDatabaseService = VectorDatabaseService.getInstance();