/**
 * Hybrid Data Service - Works with both localStorage and SQLite database
 * Provides seamless migration from localStorage to database persistence
 */

import { Project } from '../types';
import { ErrorSanitizer } from '../utils/errorSanitization';
import { DatabaseService } from './database';

export interface DataServiceConfig {
  useDatabase: boolean;
  fallbackToLocalStorage: boolean;
  migrationMode: boolean;
}

export interface DataMigrationStatus {
  totalProjects: number;
  migratedProjects: number;
  errors: string[];
  isComplete: boolean;
}

export class HybridDataService {
  private static instance: HybridDataService;
  private config: DataServiceConfig;
  private databaseService: DatabaseService | null = null; // Will be loaded dynamically
  
  private constructor() {
    this.config = {
      useDatabase: false, // Start with localStorage
      fallbackToLocalStorage: true,
      migrationMode: false
    };
  }

  static getInstance(): HybridDataService {
    if (!HybridDataService.instance) {
      HybridDataService.instance = new HybridDataService();
    }
    return HybridDataService.instance;
  }

  /**
   * Initialize the hybrid service
   */
  async initialize(): Promise<void> {
    try {
      // Try to load database service
      const { databaseService } = await import('./database');
      await databaseService.initialize();
      this.databaseService = databaseService;
      
      // Check if we should use database
      const hasExistingData = await this.hasLocalStorageData();
      if (!hasExistingData) {
        this.config.useDatabase = true;
      }
      
      console.log('✅ Hybrid data service initialized', {
        useDatabase: this.config.useDatabase,
        hasLocalData: hasExistingData
      });
    } catch {
      console.warn('⚠️ Database not available, using localStorage only');
      this.config.useDatabase = false;
      this.config.fallbackToLocalStorage = true;
    }
  }

  /**
   * Set configuration for data service
   */
  setConfig(newConfig: Partial<DataServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DataServiceConfig {
    return { ...this.config };
  }

  // PROJECT OPERATIONS

  /**
   * Create a new project
   */
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project | null> {
    if (this.config.useDatabase && this.databaseService) {
      try {
        return await this.databaseService.createProject(projectData);
      } catch (error) {
        if (this.config.fallbackToLocalStorage) {
          console.warn('Database create failed, falling back to localStorage:', error);
          return this.createProjectInLocalStorage(projectData);
        }
        throw error;
      }
    }
    
    return this.createProjectInLocalStorage(projectData);
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    if (this.config.useDatabase && this.databaseService) {
      try {
        const project = await this.databaseService.getProject(id);
        if (project) return project;
      } catch (error) {
        console.warn('Database get failed, trying localStorage:', error);
      }
    }
    
    // Fallback to localStorage
    return this.getProjectFromLocalStorage(id);
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    if (this.config.useDatabase && this.databaseService) {
      try {
        const result = await this.databaseService.updateProject(id, updates);
        if (result) return result;
      } catch (error) {
        console.warn('Database update failed, falling back to localStorage:', error);
      }
    }
    
    // Fallback to localStorage
    return this.updateProjectInLocalStorage(id, updates);
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<boolean> {
    let dbDeleted = false;
    let localDeleted = false;

    // Try database first
    if (this.config.useDatabase && this.databaseService) {
      try {
        dbDeleted = await this.databaseService.deleteProject(id);
      } catch (error) {
        console.warn('Database delete failed:', error);
      }
    }

    // Try localStorage
    localDeleted = this.deleteProjectFromLocalStorage(id);

    return dbDeleted || localDeleted;
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    let projects: Project[] = [];

    // Get from database if available
    if (this.config.useDatabase && this.databaseService) {
      try {
        projects = await this.databaseService.listProjects();
        if (projects.length > 0) return projects;
      } catch (error) {
        console.warn('Database list failed, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    return this.listProjectsFromLocalStorage();
  }

  // MIGRATION OPERATIONS

  /**
   * Migrate data from localStorage to database
   */
  async migrateToDatabase(): Promise<DataMigrationStatus> {
    if (!this.databaseService) {
      throw new Error('Database service not available for migration');
    }

    const status: DataMigrationStatus = {
      totalProjects: 0,
      migratedProjects: 0,
      errors: [],
      isComplete: false
    };

    try {
      this.config.migrationMode = true;
      
      // Get all projects from localStorage
      const localProjects = this.listProjectsFromLocalStorage();
      status.totalProjects = localProjects.length;

      if (localProjects.length === 0) {
        status.isComplete = true;
        return status;
      }

      // Migrate each project
      for (const project of localProjects) {
        try {
          await this.databaseService.createProject({
            ...project,
            characters: project.characters || [],
            storyArcs: project.storyArcs || [],
            timelineEvents: project.timelineEvents || [],
            storyPlannerData: project.storyPlannerData || { nodes: [], edges: [] },
          });

          // TODO: Migrate related data (characters, story arcs, etc.)
          
          status.migratedProjects++;
        } catch (error) {
          const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
            component: 'HybridDataService',
            action: 'migrateProject',
            metadata: { projectId: project.id }
          });
          status.errors.push(`Project "${project.title}": ${sanitizedError.message}`);
        }
      }

      // If migration successful, switch to database mode
      if (status.errors.length === 0) {
        this.config.useDatabase = true;
        this.config.migrationMode = false;
        status.isComplete = true;
        console.log('✅ Migration completed successfully');
      } else {
        console.warn('⚠️ Migration completed with errors:', status.errors);
      }

    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'HybridDataService',
        action: 'migrateToDatabase'
      });
      status.errors.push(`Migration failed: ${sanitizedError.message}`);
    }

    this.config.migrationMode = false;
    return status;
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{ canMigrate: boolean; hasLocalData: boolean; hasDatabaseData: boolean }> {
    const hasLocalData = await this.hasLocalStorageData();
    let hasDatabaseData = false;

    if (this.databaseService) {
      try {
        const projects = await this.databaseService.listProjects();
        hasDatabaseData = projects.length > 0;
      } catch (error) {
        console.warn('Could not check database data:', error);
      }
    }

    return {
      canMigrate: hasLocalData && this.databaseService !== null,
      hasLocalData,
      hasDatabaseData
    };
  }

  // PRIVATE LOCALSTORAGE METHODS

  private createProjectInLocalStorage(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const project: Project = {
      id: crypto.randomUUID(),
      ...projectData,
      characters: [],
      storyArcs: [],
      timelineEvents: [],
      storyPlannerData: { nodes: [], edges: [] },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const projects = this.getProjectsFromStorage();
    projects.push(project);
    localStorage.setItem('projects', JSON.stringify(projects));
    
    return project;
  }

  private getProjectFromLocalStorage(id: string): Project | null {
    const projects = this.getProjectsFromStorage();
    return projects.find(p => p.id === id) || null;
  }

  private updateProjectInLocalStorage(id: string, updates: Partial<Project>): Project | null {
    const projects = this.getProjectsFromStorage();
    const index = projects.findIndex(p => p.id === id);
    
    if (index === -1) return null;
    const project = projects[index];
    if (!project) return null;
    
    projects[index] = {
      ...project,
      ...updates,
      updatedAt: new Date(),
      characters: project.characters || [],
      storyArcs: project.storyArcs || [],
      timelineEvents: project.timelineEvents || [],
      storyPlannerData: project.storyPlannerData || { nodes: [], edges: [] },
    };
    
    localStorage.setItem('projects', JSON.stringify(projects));
    return projects[index];
  }

  private deleteProjectFromLocalStorage(id: string): boolean {
    const projects = this.getProjectsFromStorage();
    const index = projects.findIndex(p => p.id === id);
    
    if (index === -1) return false;
    
    projects.splice(index, 1);
    localStorage.setItem('projects', JSON.stringify(projects));
    return true;
  }

  private listProjectsFromLocalStorage(): Project[] {
    return this.getProjectsFromStorage();
  }

  private getProjectsFromStorage(): Project[] {
    try {
      const stored = localStorage.getItem('projects');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing projects from localStorage:', error);
      return [];
    }
  }

  private async hasLocalStorageData(): Promise<boolean> {
    const projects = this.getProjectsFromStorage();
    return projects.length > 0;
  }

  // HEALTH CHECK

  /**
   * Check health of both storage systems
   */
  async healthCheck(): Promise<{
    localStorage: { status: 'healthy' | 'unhealthy'; details: string };
    database: { status: 'healthy' | 'unhealthy' | 'unavailable'; details: string };
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    // Check localStorage
    let localStorageHealth: { status: 'healthy' | 'unhealthy'; details: string };
    try {
      const testKey = 'health-check-test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      localStorageHealth = { status: 'healthy', details: 'localStorage accessible' };
    } catch (error) {
      localStorageHealth = { status: 'unhealthy', details: 'localStorage not accessible' };
    }

    // Check database
    let databaseHealth: { status: 'healthy' | 'unhealthy' | 'unavailable'; details: string };
    if (this.databaseService) {
      try {
        const dbStatus = await this.databaseService.healthCheck();
        databaseHealth = {
          status: dbStatus.status,
          details: dbStatus.details
        };
      } catch {
        databaseHealth = { status: 'unhealthy', details: 'Database connection failed' };
      }
    } else {
      databaseHealth = { status: 'unavailable', details: 'Database service not initialized' };
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (localStorageHealth.status === 'healthy' && databaseHealth.status === 'healthy') {
      overall = 'healthy';
    } else if (localStorageHealth.status === 'healthy' || databaseHealth.status === 'healthy') {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      localStorage: localStorageHealth,
      database: databaseHealth,
      overall
    };
  }
}

// Singleton instance
export const hybridDataService = HybridDataService.getInstance();