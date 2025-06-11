import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Project, Character, StoryArc } from '../types';
// import { useLocalStorage } from '../hooks/useLocalStorage'; // Removed
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';
import {
  initializeDatabase,
  executeQuery,
  closeDatabase
} from '../services/sqliteService';

interface ProjectState {
  currentProject: Project;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  dbInitialized: boolean; // To track DB status
}

type ProjectAction =
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> }
  | { type: 'ADD_CHARACTER'; payload: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CHARACTER'; payload: { id: string; updates: Partial<Character> } }
  | { type: 'DELETE_CHARACTER'; payload: string }
  | { type: 'ADD_STORY_ARC'; payload: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_STORY_ARC'; payload: { id: string; updates: Partial<StoryArc> } }
  | { type: 'DELETE_STORY_ARC'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' }
  | { type: 'DB_INITIALIZED' };

interface ProjectContextValue {
  state: ProjectState;
  actions: {
    setProject: (project: Project) => void;
    updateProject: (updates: Partial<Project>) => void;
    addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateCharacter: (id: string, updates: Partial<Character>) => void;
    deleteCharacter: (id: string) => void;
    addStoryArc: (arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateStoryArc: (id: string, updates: Partial<StoryArc>) => void;
    deleteStoryArc: (id: string) => void;
    saveProject: () => Promise<void>;
    createNewProject: () => void;
  };
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const createDefaultProject = (): Project => ({
  id: Date.now().toString(),
  title: 'Untitled Novel',
  description: '',
  genre: '',
  targetWordCount: 80000,
  currentWordCount: 0,
  content: '',
  characters: [],
  storyArcs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT':
      return {
        ...state,
        currentProject: action.payload,
        isDirty: false
      };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          ...action.payload,
          updatedAt: new Date()
        },
        isDirty: true
      };

    case 'ADD_CHARACTER': {
      const newCharacter: Character = {
        ...action.payload,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          characters: [...state.currentProject.characters, newCharacter],
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'UPDATE_CHARACTER': {
      const updatedCharacters = state.currentProject.characters.map(char =>
        char.id === action.payload.id 
          ? { ...char, ...action.payload.updates, updatedAt: new Date() } 
          : char
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          characters: updatedCharacters,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'DELETE_CHARACTER': {
      const filteredCharacters = state.currentProject.characters.filter(
        char => char.id !== action.payload
      );
      
      // Remove character references from story arcs
      const updatedStoryArcs = state.currentProject.storyArcs.map(arc => ({
        ...arc,
        characters: arc.characters.filter(charId => charId !== action.payload),
        acts: arc.acts.map(act => ({
          ...act,
          scenes: act.scenes.map(scene => ({
            ...scene,
            characters: scene.characters.filter(charId => charId !== action.payload)
          }))
        }))
      }));

      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          characters: filteredCharacters,
          storyArcs: updatedStoryArcs,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'ADD_STORY_ARC': {
      const newArc: StoryArc = {
        ...action.payload,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyArcs: [...state.currentProject.storyArcs, newArc],
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'UPDATE_STORY_ARC': {
      const updatedArcs = state.currentProject.storyArcs.map(arc =>
        arc.id === action.payload.id 
          ? { ...arc, ...action.payload.updates, updatedAt: new Date() } 
          : arc
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyArcs: updatedArcs,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'DELETE_STORY_ARC': {
      const filteredArcs = state.currentProject.storyArcs.filter(
        arc => arc.id !== action.payload
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyArcs: filteredArcs,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'MARK_SAVED':
      return { 
        ...state, 
        isSaving: false, 
        isDirty: false, 
        lastSaved: new Date() 
      };

    case 'MARK_DIRTY':
      return { ...state, isDirty: true };

    case 'DB_INITIALIZED':
      return { ...state, dbInitialized: true, isLoading: false };

    default:
      return state;
  }
}

const PROJECTS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    genre TEXT,
    targetWordCount INTEGER,
    currentWordCount INTEGER,
    content TEXT, -- Consider storing large content separately if needed
    createdAt TEXT,
    updatedAt TEXT,
    lastActive INTEGER DEFAULT 0 -- Boolean (0 or 1) or Timestamp
  );
`;

const CHARACTERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    name TEXT,
    description TEXT,
    bio TEXT,
    notes TEXT,
    profileImage TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );
`;

const STORY_ARCS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS story_arcs (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    title TEXT,
    description TEXT,
    plotPoints TEXT, -- JSON string for plot points
    characters TEXT, -- JSON string for character IDs
    status TEXT,
    order INTEGER,
    acts TEXT, -- JSON string for acts, scenes, etc.
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );
`;


export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // const [storedProject, setStoredProject] = useLocalStorage<Project>( // Removed
  //   'currentProject',
  //   createDefaultProject()
  // );

  const [state, dispatch] = useReducer(projectReducer, {
    currentProject: createDefaultProject(), // Initialize with a default project first
    isLoading: true, // Start with loading true until DB is checked
    isSaving: false,
    lastSaved: null,
    isDirty: false,
    dbInitialized: false,
  });

  const { reportError, wrapAsync } = useAsyncErrorHandler({ 
    component: 'ProjectProvider' 
  });

  // Initialize database and load project
  useEffect(() => {
    const initDbAndLoad = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await initializeDatabase();
        await executeQuery(PROJECTS_TABLE_SCHEMA);
        await executeQuery(CHARACTERS_TABLE_SCHEMA);
        await executeQuery(STORY_ARCS_TABLE_SCHEMA);

        // Attempt to load the last active project
        const lastActiveProjectQuery = `
          SELECT * FROM projects ORDER BY lastActive DESC LIMIT 1;
        `;
        const projectsResult = await executeQuery<any[]>(lastActiveProjectQuery);

        if (projectsResult.length > 0 && projectsResult[0].rows && projectsResult[0].rows.length > 0) {
          const projectData = projectsResult[0].rows[0];

          const charactersQuery = `SELECT * FROM characters WHERE projectId = ?;`;
          const charactersResult = await executeQuery<any[]>(charactersQuery, [projectData.id]);
          const projectCharacters = charactersResult.length > 0 && charactersResult[0].rows ? charactersResult[0].rows.map((char: any) => ({
            ...char,
            createdAt: new Date(char.createdAt),
            updatedAt: new Date(char.updatedAt),
          })) : [];

          const storyArcsQuery = `SELECT * FROM story_arcs WHERE projectId = ?;`;
          const storyArcsResult = await executeQuery<any[]>(storyArcsQuery, [projectData.id]);
          const projectStoryArcs = storyArcsResult.length > 0 && storyArcsResult[0].rows ? storyArcsResult[0].rows.map((arc: any) => ({
            ...arc,
            plotPoints: JSON.parse(arc.plotPoints || '[]'),
            characters: JSON.parse(arc.characters || '[]'),
            acts: JSON.parse(arc.acts || '[]'),
            createdAt: new Date(arc.createdAt),
            updatedAt: new Date(arc.updatedAt),
          })) : [];

          const loadedProject: Project = {
            ...projectData,
            characters: projectCharacters,
            storyArcs: projectStoryArcs,
            createdAt: new Date(projectData.createdAt),
            updatedAt: new Date(projectData.updatedAt),
            targetWordCount: projectData.targetWordCount || 0,
            currentWordCount: projectData.currentWordCount || 0,
          };
          dispatch({ type: 'SET_PROJECT', payload: loadedProject });
        } else {
          // No project found, use default
          dispatch({ type: 'SET_PROJECT', payload: createDefaultProject() });
        }
        dispatch({ type: 'DB_INITIALIZED' }); // Also sets isLoading to false
      } catch (error) {
        reportError(error, 'db-initialization-or-load');
        // Fallback to default project if DB init or load fails
        dispatch({ type: 'SET_PROJECT', payload: createDefaultProject() });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initDbAndLoad();

    return () => {
      closeDatabase().catch(err => reportError(err, 'db-close'));
    };
  }, [reportError]);


  // Auto-save to localStorage when project changes -- Will be replaced by SQLite save
  // useEffect(() => {
  //   if (state.isDirty) {
  //     setStoredProject(state.currentProject);
  //   }
  // }, [state.currentProject, state.isDirty, setStoredProject]);

  const actions = {
    setProject: useCallback((project: Project) => {
      dispatch({ type: 'SET_PROJECT', payload: project });
    }, []),

    updateProject: useCallback((updates: Partial<Project>) => {
      dispatch({ type: 'UPDATE_PROJECT', payload: updates });
    }, []),

    addCharacter: useCallback((character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_CHARACTER', payload: character });
    }, []),

    updateCharacter: useCallback((id: string, updates: Partial<Character>) => {
      dispatch({ type: 'UPDATE_CHARACTER', payload: { id, updates } });
    }, []),

    deleteCharacter: useCallback((id: string) => {
      dispatch({ type: 'DELETE_CHARACTER', payload: id });
    }, []),

    addStoryArc: useCallback((arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_STORY_ARC', payload: arc });
    }, []),

    updateStoryArc: useCallback((id: string, updates: Partial<StoryArc>) => {
      dispatch({ type: 'UPDATE_STORY_ARC', payload: { id, updates } });
    }, []),

    deleteStoryArc: useCallback((id: string) => {
      dispatch({ type: 'DELETE_STORY_ARC', payload: id });
    }, []),

    saveProject: useCallback(async () => {
      if (!state.dbInitialized) {
        reportError(new Error("Database not initialized. Cannot save."), 'save-project-db-not-init');
        return;
      }
      await wrapAsync(async () => {
        dispatch({ type: 'SET_SAVING', payload: true });
        const project = state.currentProject;

        // Save project details
        const projectQuery = `
          INSERT OR REPLACE INTO projects
            (id, title, description, genre, targetWordCount, currentWordCount, content, createdAt, updatedAt, lastActive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        await executeQuery(projectQuery, [
          project.id,
          project.title,
          project.description,
          project.genre,
          project.targetWordCount,
          project.currentWordCount,
          project.content,
          project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
          new Date().toISOString(), // Always update updatedAt on save
          Date.now() // Mark as last active
        ]);

        // Save characters: Delete existing for this project then insert all current ones
        await executeQuery('DELETE FROM characters WHERE projectId = ?;', [project.id]);
        for (const char of project.characters) {
          const charQuery = `
            INSERT INTO characters
              (id, projectId, name, description, bio, notes, profileImage, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
          await executeQuery(charQuery, [
            char.id,
            project.id,
            char.name,
            char.description,
            char.bio,
            char.notes,
            char.profileImage,
            char.createdAt instanceof Date ? char.createdAt.toISOString() : char.createdAt,
            char.updatedAt instanceof Date ? char.updatedAt.toISOString() : char.updatedAt,
          ]);
        }

        // Save story arcs: Delete existing for this project then insert all current ones
        await executeQuery('DELETE FROM story_arcs WHERE projectId = ?;', [project.id]);
        for (const arc of project.storyArcs) {
          const arcQuery = `
            INSERT INTO story_arcs
              (id, projectId, title, description, plotPoints, characters, status, "order", acts, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
          await executeQuery(arcQuery, [
            arc.id,
            project.id,
            arc.title,
            arc.description,
            JSON.stringify(arc.plotPoints),
            JSON.stringify(arc.characters),
            arc.status,
            arc.order,
            JSON.stringify(arc.acts),
            arc.createdAt instanceof Date ? arc.createdAt.toISOString() : arc.createdAt,
            arc.updatedAt instanceof Date ? arc.updatedAt.toISOString() : arc.updatedAt,
          ]);
        }
        
        dispatch({ type: 'MARK_SAVED' });
      }, { action: 'save-project' });
    }, [state.currentProject, state.dbInitialized, wrapAsync, reportError]),

    createNewProject: useCallback(async () => {
      if (!state.dbInitialized) {
        reportError(new Error("Database not initialized. Cannot create new project."), 'create-project-db-not-init');
        return;
      }
      if (state.isDirty && !confirm('Create a new project? Unsaved changes will be lost for the current project.')) {
        return;
      }

      const oldProjectId = state.currentProject.id;

      // Mark the old project as not last active
      // This is optimistic. If creating the new project state fails, this has already run.
      // Consider if this needs to be part of a larger transaction if SQLite supported it easily here.
      try {
        if (oldProjectId && oldProjectId !== createDefaultProject().id) { // Avoid issues if current is already a fresh default
           await executeQuery('UPDATE projects SET lastActive = 0 WHERE id = ?;', [oldProjectId]);
        }
      } catch(err) {
        reportError(err, 'update-old-project-lastActive-failed');
        // Not necessarily a fatal error for creating a new project, but log it.
      }
      
      const newProject = createDefaultProject();
      dispatch({ type: 'SET_PROJECT', payload: newProject });
      // The new project will be marked as lastActive upon its first save.
      // If the user immediately saves, it will be fine.
      // If they don't, and reload, the old project (now lastActive=0) won't load,
      // and a new default might be created or the next most recent. This seems acceptable.

    }, [state.isDirty, state.dbInitialized, state.currentProject.id, reportError])
  };

  return (
    <ProjectContext.Provider value={{ state, actions }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}