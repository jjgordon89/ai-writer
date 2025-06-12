/**
 * Database service using Prisma ORM for SQLite
 * Provides comprehensive CRUD operations with error handling and connection management
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Project, Character, StoryArc, TimelineEvent, StoryNode, StoryEdge } from '../types';
import { ErrorSanitizer } from '../utils/errorSanitization';

// Type definitions for database operations
export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy';
  details: string;
  latency?: number;
}

export interface ProjectStats {
  totalProjects: number;
  totalCharacters: number;
  totalWordCount: number;
  averageProjectSize: number;
}

// Prisma return types for proper typing
type PrismaProjectWithRelations = {
  id: string;
  title: string;
  description: string | null;
  genre: string | null;
  targetWordCount: number;
  currentWordCount: number;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  characters: PrismaCharacter[];
  storyArcs: PrismaStoryArc[];
  timelineEvents: PrismaTimelineEvent[];
  storyNodes: PrismaStoryNode[];
  storyEdges: PrismaStoryEdge[];
};

type PrismaCharacter = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  age: number | null;
  description: string | null;
  backstory: string | null;
  traits: string | null;
  relationships: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaStoryArc = {
  id: string;
  projectId: string;
  title: string;
  type: string;
  description: string | null;
  acts: string | null;
  characters: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaTimelineEvent = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dateType: string;
  dateValue: string;
  endDateValue: string | null;
  linkedCharacterIds: string | null;
  linkedStoryArcIds: string | null;
  tags: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaStoryNode = {
  id: string;
  projectId: string;
  type: string;
  label: string;
  content: string | null;
  positionX: number;
  positionY: number;
  color: string | null;
  linkedCharacterId: string | null;
  linkedStoryArcId: string | null;
  createdAt: Date;
  updatedAt: Date;
  linkedCharacter?: PrismaCharacter | null;
  linkedStoryArc?: PrismaStoryArc | null;
};

type PrismaStoryEdge = {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
  sourceNode?: PrismaStoryNode | null;
  targetNode?: PrismaStoryNode | null;
};

export class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private isInitialized = false;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });

    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await this.disconnect();
    });
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connection
      await this.prisma.$connect();
      
      // Verify database schema
      await this.prisma.$queryRaw`SELECT 1`;
      
      this.isInitialized = true;
      console.log('✅ Database service initialized successfully');
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'DatabaseService',
        action: 'initialize'
      });
      
      console.error('❌ Database initialization failed:', sanitizedError.message);
      throw new Error(`Database initialization failed: ${sanitizedError.message}`);
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isInitialized = false;
      console.log('🔌 Database disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<DatabaseHealthStatus> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1 as health_check`;
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        details: 'Database connection successful',
        latency
      };
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'DatabaseService',
        action: 'healthCheck'
      });

      return {
        status: 'unhealthy',
        details: `Database connection failed: ${sanitizedError.message}`
      };
    }
  }

  // PROJECT OPERATIONS

  /**
   * Create a new project
   */
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    try {
      const project = await this.prisma.project.create({
        data: {
          title: projectData.title,
          description: projectData.description || null,
          genre: projectData.genre || null,
          targetWordCount: projectData.targetWordCount || 80000,
          currentWordCount: projectData.currentWordCount || 0,
          content: projectData.content || null,
        },
        include: {
          characters: true,
          storyArcs: true,
          timelineEvents: true,
          storyNodes: {
            include: {
              linkedCharacter: true,
              linkedStoryArc: true,
            }
          },
          storyEdges: {
            include: {
              sourceNode: true,
              targetNode: true,
            }
          }
        }
      });

      return this.mapPrismaProjectToProject(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new Error(`Failed to create project: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get project by ID with all related data
   */
  async getProject(id: string): Promise<Project | null> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id },
        include: {
          characters: true,
          storyArcs: true,
          timelineEvents: true,
          storyNodes: {
            include: {
              linkedCharacter: true,
              linkedStoryArc: true,
            }
          },
          storyEdges: {
            include: {
              sourceNode: true,
              targetNode: true,
            }
          }
        }
      });

      return project ? this.mapPrismaProjectToProject(project) : null;
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'DatabaseService',
        action: 'getProject',
        metadata: { projectId: id }
      });
      throw new Error(`Failed to get project: ${sanitizedError.message}`);
    }
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          ...(updates.title && { title: updates.title }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.genre !== undefined && { genre: updates.genre }),
          ...(updates.targetWordCount && { targetWordCount: updates.targetWordCount }),
          ...(updates.currentWordCount !== undefined && { currentWordCount: updates.currentWordCount }),
          ...(updates.content !== undefined && { content: updates.content }),
        },
        include: {
          characters: true,
          storyArcs: true,
          timelineEvents: true,
          storyNodes: {
            include: {
              linkedCharacter: true,
              linkedStoryArc: true,
            }
          },
          storyEdges: {
            include: {
              sourceNode: true,
              targetNode: true,
            }
          }
        }
      });

      return this.mapPrismaProjectToProject(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return null; // Project not found
        }
      }
      throw new Error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete project and all related data
   */
  async deleteProject(id: string): Promise<boolean> {
    try {
      await this.prisma.project.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return false; // Project not found
        }
      }
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all projects with basic info
   */
  async listProjects(): Promise<Project[]> {
    try {
      const projects = await this.prisma.project.findMany({
        include: {
          characters: true,
          storyArcs: true,
          timelineEvents: true,
          storyNodes: {
            include: {
              linkedCharacter: true,
              linkedStoryArc: true,
            }
          },
          storyEdges: {
            include: {
              sourceNode: true,
              targetNode: true,
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      return projects.map(project => this.mapPrismaProjectToProject(project));
    } catch (error) {
      throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // CHARACTER OPERATIONS

  /**
   * Create a new character
   */
  async createCharacter(projectId: string, characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    try {
      const character = await this.prisma.character.create({
        data: {
          projectId,
          name: characterData.name,
          role: characterData.role,
          age: characterData.age || null,
          description: characterData.description || null,
          backstory: characterData.backstory || null,
          traits: characterData.traits ? JSON.stringify(characterData.traits) : null,
          relationships: characterData.relationships ? JSON.stringify(characterData.relationships) : null,
          notes: characterData.notes || null,
        }
      });

      return this.mapPrismaCharacterToCharacter(character);
    } catch (error) {
      throw new Error(`Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update character
   */
  async updateCharacter(id: string, updates: Partial<Character>): Promise<Character | null> {
    try {
      const character = await this.prisma.character.update({
        where: { id },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.role && { role: updates.role }),
          ...(updates.age !== undefined && { age: updates.age }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.backstory !== undefined && { backstory: updates.backstory }),
          ...(updates.traits && { traits: JSON.stringify(updates.traits) }),
          ...(updates.relationships && { relationships: JSON.stringify(updates.relationships) }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
        }
      });

      return this.mapPrismaCharacterToCharacter(character);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return null; // Character not found
        }
      }
      throw new Error(`Failed to update character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete character
   */
  async deleteCharacter(id: string): Promise<boolean> {
    try {
      await this.prisma.character.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return false; // Character not found
        }
      }
      throw new Error(`Failed to delete character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ANALYTICS AND STATISTICS

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<ProjectStats> {
    try {
      const [projectCount, characterCount, wordCountResult] = await Promise.all([
        this.prisma.project.count(),
        this.prisma.character.count(),
        this.prisma.project.aggregate({
          _sum: {
            currentWordCount: true
          },
          _avg: {
            currentWordCount: true
          }
        })
      ]);

      return {
        totalProjects: projectCount,
        totalCharacters: characterCount,
        totalWordCount: wordCountResult._sum.currentWordCount || 0,
        averageProjectSize: Math.round(wordCountResult._avg.currentWordCount || 0)
      };
    } catch (error) {
      throw new Error(`Failed to get project stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Backup database to JSON
   */
  async exportToJSON(): Promise<string> {
    try {
      const [projects, characters, storyArcs, timelineEvents, storyNodes, storyEdges] = await Promise.all([
        this.prisma.project.findMany(),
        this.prisma.character.findMany(),
        this.prisma.storyArc.findMany(),
        this.prisma.timelineEvent.findMany(),
        this.prisma.storyNode.findMany(),
        this.prisma.storyEdge.findMany()
      ]);

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          projects,
          characters,
          storyArcs,
          timelineEvents,
          storyNodes,
          storyEdges
        }
      };

      return JSON.stringify(backup, null, 2);
    } catch (error) {
      throw new Error(`Failed to export database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // PRIVATE MAPPING METHODS

  private mapPrismaProjectToProject(prismaProject: PrismaProjectWithRelations): Project {
    return {
      id: prismaProject.id,
      title: prismaProject.title,
      description: prismaProject.description || '',
      genre: prismaProject.genre || '',
      targetWordCount: prismaProject.targetWordCount,
      currentWordCount: prismaProject.currentWordCount,
      content: prismaProject.content || '',
      characters: prismaProject.characters?.map((char: PrismaCharacter) => this.mapPrismaCharacterToCharacter(char)) || [],
      storyArcs: prismaProject.storyArcs?.map((arc: PrismaStoryArc) => this.mapPrismaStoryArcToStoryArc(arc)) || [],
      timelineEvents: prismaProject.timelineEvents?.map((event: PrismaTimelineEvent) => this.mapPrismaTimelineEventToTimelineEvent(event)) || [],
      storyPlannerData: {
        nodes: prismaProject.storyNodes?.map((node: PrismaStoryNode) => this.mapPrismaStoryNodeToStoryNode(node)) || [],
        edges: prismaProject.storyEdges?.map((edge: PrismaStoryEdge) => this.mapPrismaStoryEdgeToStoryEdge(edge)) || []
      },
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt
    };
  }

  private mapPrismaCharacterToCharacter(prismaCharacter: PrismaCharacter): Character {
    return {
      id: prismaCharacter.id,
      name: prismaCharacter.name,
      role: prismaCharacter.role as Character['role'],
      age: prismaCharacter.age || 0,
      description: prismaCharacter.description || '',
      backstory: prismaCharacter.backstory || '',
      traits: prismaCharacter.traits ? JSON.parse(prismaCharacter.traits) : [],
      relationships: prismaCharacter.relationships ? JSON.parse(prismaCharacter.relationships) : [],
      notes: prismaCharacter.notes || '',
      createdAt: prismaCharacter.createdAt,
      updatedAt: prismaCharacter.updatedAt
    };
  }

  private mapPrismaStoryArcToStoryArc(prismaStoryArc: PrismaStoryArc): StoryArc {
    return {
      id: prismaStoryArc.id,
      title: prismaStoryArc.title,
      type: prismaStoryArc.type as StoryArc['type'],
      description: prismaStoryArc.description || '',
      acts: prismaStoryArc.acts ? JSON.parse(prismaStoryArc.acts) : [],
      characters: prismaStoryArc.characters ? JSON.parse(prismaStoryArc.characters) : [],
      status: prismaStoryArc.status as StoryArc['status'],
      notes: prismaStoryArc.notes || '',
      createdAt: prismaStoryArc.createdAt,
      updatedAt: prismaStoryArc.updatedAt
    };
  }

  private mapPrismaTimelineEventToTimelineEvent(prismaEvent: PrismaTimelineEvent): TimelineEvent {
    return {
      id: prismaEvent.id,
      title: prismaEvent.title,
      description: prismaEvent.description || '',
      dateType: prismaEvent.dateType as TimelineEvent['dateType'],
      dateValue: prismaEvent.dateValue,
      endDateValue: prismaEvent.endDateValue || '',
      linkedCharacterIds: prismaEvent.linkedCharacterIds ? JSON.parse(prismaEvent.linkedCharacterIds) : [],
      linkedStoryArcIds: prismaEvent.linkedStoryArcIds ? JSON.parse(prismaEvent.linkedStoryArcIds) : [],
      tags: prismaEvent.tags ? JSON.parse(prismaEvent.tags) : [],
      color: prismaEvent.color || '#1976d2',
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt
    };
  }

  private mapPrismaStoryNodeToStoryNode(prismaNode: PrismaStoryNode): StoryNode {
    return {
      id: prismaNode.id,
      type: prismaNode.type as StoryNode['type'],
      label: prismaNode.label,
      content: prismaNode.content || '',
      position: {
        x: prismaNode.positionX,
        y: prismaNode.positionY
      },
      color: prismaNode.color || '#1976d2',
      linkedCharacterId: prismaNode.linkedCharacterId || '',
      linkedStoryArcId: prismaNode.linkedStoryArcId || '',
      createdAt: prismaNode.createdAt,
      updatedAt: prismaNode.updatedAt
    };
  }

  private mapPrismaStoryEdgeToStoryEdge(prismaEdge: PrismaStoryEdge): StoryEdge {
    return {
      id: prismaEdge.id,
      sourceNodeId: prismaEdge.sourceNodeId,
      targetNodeId: prismaEdge.targetNodeId,
      label: prismaEdge.label || '',
      createdAt: prismaEdge.createdAt,
      updatedAt: prismaEdge.updatedAt
    };
  }
}

// Singleton instance
export const databaseService = DatabaseService.getInstance();