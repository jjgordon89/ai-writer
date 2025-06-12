/**
 * Vector Database Initialization Script
 * Sets up LanceDB tables and initial configuration
 */

import { vectorDatabaseService } from '../src/services/vectorDatabase';

async function initializeVectorDatabase() {
  console.log('🚀 Initializing Vector Database...');

  try {
    // Get OpenAI API key from environment or prompt
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.warn('⚠️  OPENAI_API_KEY not found in environment variables');
      console.log('Please set OPENAI_API_KEY in your .env file to enable vector search features');
      console.log('Example: OPENAI_API_KEY=sk-...');
      return;
    }

    // Initialize vector database service
    await vectorDatabaseService.initialize({
      dbPath: './data/vector-db',
      openaiApiKey,
      embeddingModel: 'text-embedding-ada-002',
      maxRetries: 3,
      batchSize: 100
    });

    console.log('✅ Vector database initialized successfully');

    // Check health
    const health = await vectorDatabaseService.healthCheck();
    console.log(`📊 Vector database health: ${health.status}`);
    console.log(`📋 Details: ${health.details}`);

    if (health.latency) {
      console.log(`⏱️  Latency: ${health.latency}ms`);
    }

    // Get statistics
    const stats = await vectorDatabaseService.getStatistics();
    console.log('📈 Vector Database Statistics:');
    console.log(`   Documents: ${stats.documents}`);
    console.log(`   Characters: ${stats.characters}`);
    console.log(`   Themes: ${stats.themes}`);
    console.log(`   Total Vectors: ${stats.totalVectors}`);

    console.log('\n✨ Vector database is ready for semantic search!');

  } catch (error) {
    console.error('❌ Vector database initialization failed:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    await initializeVectorDatabase();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { initializeVectorDatabase };