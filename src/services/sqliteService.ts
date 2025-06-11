import initSqlJs, { type Database } from 'sql.js';
import type { Project } from '../types';

class SQLiteService {
  private db: Database | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const SQL = await initSqlJs();
    this.db = new SQL.Database();

    // Migration logic
    const migrationDone = localStorage.getItem('migrationToSqliteDone');
    if (!migrationDone) {
      console.log('Checking for data to migrate from localStorage...');
      const storedProjectJson = localStorage.getItem('currentProject');
      if (storedProjectJson) {
        try {
          const projectFromLocalStorage: Project = JSON.parse(storedProjectJson);
          // Ensure dates are correctly parsed if they are strings
          if (typeof projectFromLocalStorage.createdAt === 'string') {
            projectFromLocalStorage.createdAt = new Date(projectFromLocalStorage.createdAt);
          }
          if (typeof projectFromLocalStorage.updatedAt === 'string') {
            projectFromLocalStorage.updatedAt = new Date(projectFromLocalStorage.updatedAt);
          }

          console.log('Project found in localStorage:', projectFromLocalStorage);

          // Create tables first before attempting to load or save
          await this.createTables(); // Ensure tables exist

          // Check if DB is empty or has default project before migrating
          const existingProject = await this.loadProject(false); // Pass a flag to avoid recursive initialization/migration

          // Define what a "default" or "empty" project means.
          // For example, if loadProject returns null or a project with a well-known default ID/title.
          // Here, we assume if loadProject returns null, DB is considered empty enough for migration.
          // If you have a specific default project ID, you might check against that.
          let shouldMigrate = true;
          if (existingProject) {
            // Example: if existing project has a specific default ID, don't migrate
            // if (existingProject.id === "default-project-id-placeholder") {
            //   shouldMigrate = true;
            // } else {
            //   shouldMigrate = false;
            //   console.log('SQLite already has a non-default project. Skipping migration.');
            // }
            // For simplicity, if any project exists, we are cautious and skip migration.
            // Adjust this logic if you want to overwrite e.g. a default placeholder project.
            shouldMigrate = false;
            console.log('SQLite already contains a project. Skipping migration from localStorage.');
          }

          if (shouldMigrate) {
            console.log('Migrating project from localStorage to SQLite...');
            await this.saveProject(projectFromLocalStorage, false); // Pass flag to avoid recursive init
            localStorage.setItem('migrationToSqliteDone', 'true');
            console.log('Migration from localStorage to SQLite successful.');
          } else {
            // If we skipped migration because a project already exists,
            // we might want to mark migration as done anyway to avoid re-checking.
            // Or, keep the flag unset to allow potential future migration if the DB is cleared.
            // For this implementation, we'll set it to done to avoid repeated checks.
            localStorage.setItem('migrationToSqliteDone', 'true');
             console.log('Migration flag set to done, even though no data was migrated in this run.');
          }
        } catch (error) {
          console.error('Error during migration from localStorage:', error);
          // If migration fails, do not set the flag, so it can be retried.
          // Or, handle more gracefully depending on requirements.
        }
      } else {
        console.log('No project data found in localStorage to migrate.');
        // No data to migrate, so mark as done.
        localStorage.setItem('migrationToSqliteDone', 'true');
      }
    } else {
      console.log('Migration to SQLite already done.');
    }

    // Ensure tables are created if not already done during migration check
    await this.createTables();
    this.isInitialized = true;
    console.log('SQLiteService initialized.');
  }

  private async createTables(): Promise<void> {
    console.log('Attempting to create tables...');
    if (!this.db) {
      console.error('Database not initialized before creating tables.');
      throw new Error('Database not initialized.');
    }
    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS Projects (
          id TEXT PRIMARY KEY,
          title TEXT,
          description TEXT,
          genre TEXT,
          targetWordCount INTEGER,
          currentWordCount INTEGER,
          content TEXT,
          characters TEXT,
          storyArcs TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
      `);
      // Add more table creations for characters, story_arcs, etc. here
      // For example:
      // this.db.run(`
      //   CREATE TABLE IF NOT EXISTS Characters (
      //     id TEXT PRIMARY KEY,
      //     projectId TEXT,
      //     name TEXT,
      //     description TEXT,
      //     FOREIGN KEY (projectId) REFERENCES Projects(id)
      //   );
      // `);
      // this.db.run(`
      //   CREATE TABLE IF NOT EXISTS StoryArcs (
      //     id TEXT PRIMARY KEY,
      //     projectId TEXT,
      //     title TEXT,
      //     description TEXT,
      //     FOREIGN KEY (projectId) REFERENCES Projects(id)
      //   );
      // `);
      console.log('Tables created successfully (or already exist).');
    } catch (error) {
      console.error('Error creating tables:', error);
      // Depending on the desired behavior, you might want to re-throw the error
      // or handle it in a way that allows the application to continue (if possible).
      throw new Error(`Failed to create tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadProject(isExternalCall = true): Promise<Project | null> {
    if (isExternalCall && !this.isInitialized) {
      // This check is a bit redundant if initialize is always called first from ProjectContext,
      // but good for safety if loadProject could be called independently.
      console.warn('loadProject called before initialize. Attempting to initialize...');
      await this.initialize();
    }
    console.log('Loading project from SQLite DB...');
    if (!this.db) {
      console.error('Database not initialized before loading project.');
      throw new Error('Database not initialized.');
    }
    try {
      const res = this.db.exec("SELECT id, title, description, genre, targetWordCount, currentWordCount, content, characters, storyArcs, createdAt, updatedAt FROM Projects LIMIT 1");
      if (res.length > 0 && res[0].values.length > 0) {
        const row = res[0].values[0];
        // Ensure data types are correct, especially for JSON strings and dates
        const project: Project = {
          id: row[0] as string,
          title: row[1] as string,
          description: row[2] as string,
          genre: row[3] as string,
          targetWordCount: Number(row[4]),
          currentWordCount: Number(row[5]),
          content: typeof row[6] === 'string' ? JSON.parse(row[6]) : row[6],
          characters: typeof row[7] === 'string' ? JSON.parse(row[7]) : row[7],
          storyArcs: typeof row[8] === 'string' ? JSON.parse(row[8]) : row[8],
          createdAt: new Date(row[9] as string),
          updatedAt: new Date(row[10] as string),
        };
        console.log('Project loaded from SQLite:', project);
        return project;
      }
      console.log('No project found in SQLite.');
      return null;
    } catch (error) {
      console.error('Error loading project from SQLite:', error);
      throw new Error(`Failed to load project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveProject(project: Project, isExternalCall = true): Promise<void> {
    if (isExternalCall && !this.isInitialized) {
       // Similar to loadProject, ensure initialization if called externally.
      console.warn('saveProject called before initialize. Attempting to initialize...');
      await this.initialize();
    }
    console.log('Saving project to SQLite DB:', project);
    if (!this.db) {
      console.error('Database not initialized before saving project.');
      throw new Error('Database not initialized.');
    }
    try {
      const charactersString = JSON.stringify(project.characters);
      const storyArcsString = JSON.stringify(project.storyArcs);
      const contentString = JSON.stringify(project.content);

      this.db.run(
        `REPLACE INTO Projects (id, title, description, genre, targetWordCount, currentWordCount, content, characters, storyArcs, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          project.title,
          project.description,
          project.genre,
          project.targetWordCount,
          project.currentWordCount,
          contentString,
          charactersString,
          storyArcsString,
          project.createdAt.toISOString(),
          project.updatedAt.toISOString(),
        ]
      );
      console.log('Project saved.');
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error(`Failed to save project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Placeholder CRUD operations (can be expanded later)

  // Project specific
  async getProject(id: string): Promise<Project | null> {
    console.log(`Getting project with id: ${id}`);
    // Stub
    return null;
  }

  async updateProject(project: Project): Promise<void> {
    console.log('Updating project:', project);
    // Stub
  }

  // Character specific (examples)
  // async getCharacter(id: string): Promise<Character | null> {
  //   console.log(`Getting character with id: ${id}`);
  //   // Stub
  //   return null;
  // }

  // async saveCharacter(character: Character): Promise<void> {
  //   console.log('Saving character:', character);
  //   // Stub
  // }

  // StoryArc specific (examples)
  // async getStoryArc(id: string): Promise<StoryArc | null> {
  //   console.log(`Getting story arc with id: ${id}`);
  //   // Stub
  //   return null;
  // }

  // async saveStoryArc(storyArc: StoryArc): Promise<void> {
  //   console.log('Saving story arc:', storyArc);
  //   // Stub
  // }
}

export const sqliteService = new SQLiteService();
