/**
 * Vector Database Seeding Script
 * Populates vector database with sample project data for semantic search
 */

import { vectorDatabaseService } from '../src/services/vectorDatabase';
import { databaseService } from '../src/services/database';

async function seedVectorDatabase() {
  console.log('🌱 Seeding Vector Database with project data...');

  try {
    // Initialize services
    await databaseService.initialize();
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found. Please set it in your .env file');
    }

    await vectorDatabaseService.initialize({
      dbPath: './data/vector-db',
      openaiApiKey,
      embeddingModel: 'text-embedding-ada-002',
      maxRetries: 3,
      batchSize: 10
    });

    // Get all projects from database
    const projects = await databaseService.listProjects();
    console.log(`📚 Found ${projects.length} projects to process`);

    let totalDocuments = 0;
    let totalCharacters = 0;
    let totalThemes = 0;

    for (const project of projects) {
      console.log(`\n📖 Processing project: "${project.title}"`);
      
      // Add main project content
      if (project.content && project.content.trim()) {
        await vectorDatabaseService.addDocument(
          project.id,
          'manuscript',
          project.title,
          project.content,
          {
            description: project.description,
            genre: project.genre,
            wordCount: project.currentWordCount
          }
        );
        totalDocuments++;
        console.log(`   ✅ Added manuscript content (${project.content.length} chars)`);
      }

      // Add project description as a document
      if (project.description && project.description.trim()) {
        await vectorDatabaseService.addDocument(
          project.id,
          'note',
          `${project.title} - Description`,
          project.description,
          {
            type: 'project_description',
            genre: project.genre
          }
        );
        totalDocuments++;
        console.log(`   ✅ Added project description`);
      }

      // Add characters
      for (const character of project.characters) {
        await vectorDatabaseService.addCharacter(character, project.id);
        totalCharacters++;
        console.log(`   👤 Added character: ${character.name}`);

        // Add character as a document for content search
        const characterText = `${character.name}: ${character.description} ${character.backstory} Role: ${character.role}`;
        await vectorDatabaseService.addDocument(
          project.id,
          'character',
          `Character: ${character.name}`,
          characterText,
          {
            characterId: character.id,
            role: character.role,
            traits: character.traits
          }
        );
        totalDocuments++;
      }

      // Add story arcs as documents
      for (const storyArc of project.storyArcs) {
        const storyArcText = `${storyArc.title}: ${storyArc.description || ''} Type: ${storyArc.type} Status: ${storyArc.status}`;
        await vectorDatabaseService.addDocument(
          project.id,
          'story_arc',
          `Story Arc: ${storyArc.title}`,
          storyArcText,
          {
            storyArcId: storyArc.id,
            type: storyArc.type,
            status: storyArc.status,
            characterIds: storyArc.characters
          }
        );
        totalDocuments++;
        console.log(`   📚 Added story arc: ${storyArc.title}`);
      }

      // Add timeline events as documents
      if (project.timelineEvents) {
        for (const event of project.timelineEvents) {
          const eventText = `${event.title}: ${event.description || ''} Date: ${event.dateValue}`;
          await vectorDatabaseService.addDocument(
            project.id,
            'note',
            `Timeline: ${event.title}`,
            eventText,
            {
              timelineEventId: event.id,
              dateType: event.dateType,
              dateValue: event.dateValue,
              tags: event.tags
            }
          );
          totalDocuments++;
          console.log(`   📅 Added timeline event: ${event.title}`);
        }
      }

      // Analyze and store themes for the project
      try {
        console.log(`   🎭 Analyzing themes for "${project.title}"...`);
        const themes = await vectorDatabaseService.analyzeThemes(project);
        
        for (const theme of themes) {
          await vectorDatabaseService.storeTheme(
            project.id,
            theme,
            `Theme identified in ${project.title}`,
            [], // Examples would be populated by more sophisticated analysis
            [] // Related content would be populated by cross-referencing
          );
          totalThemes++;
        }
        
        if (themes.length > 0) {
          console.log(`   ✅ Added ${themes.length} themes: ${themes.join(', ')}`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Theme analysis failed for "${project.title}":`, error);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   📄 Documents: ${totalDocuments}`);
    console.log(`   👥 Characters: ${totalCharacters}`);
    console.log(`   🎭 Themes: ${totalThemes}`);

    // Verify seeding by getting statistics
    const stats = await vectorDatabaseService.getStatistics();
    console.log('\n📈 Final Vector Database Statistics:');
    console.log(`   Documents: ${stats.documents}`);
    console.log(`   Characters: ${stats.characters}`);
    console.log(`   Themes: ${stats.themes}`);
    console.log(`   Total Vectors: ${stats.totalVectors}`);

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    
    if (projects.length > 0) {
      const testQuery = 'artificial intelligence consciousness';
      const searchResults = await vectorDatabaseService.searchDocuments(testQuery, undefined, 3);
      
      console.log(`   Query: "${testQuery}"`);
      console.log(`   Results: ${searchResults.length}`);
      
      for (const result of searchResults.slice(0, 2)) {
        console.log(`     - "${result.item.title}" (${result.relevance}, ${Math.round(result.score)}% match)`);
      }
    }

    console.log('\n✨ Vector database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Vector database seeding failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedVectorDatabase();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedVectorDatabase };