import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { Project, Character, StoryArc } from '../types';
import { sqliteService } from '../services/sqliteService';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';
import { debounce } from '../utils/debounce';

interface ProjectState {
  currentProject: Project | null; // Can be null initially
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
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
  | { type: 'MARK_DIRTY' };

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
  id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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

    default:
      return state;
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, {
    currentProject: null, // Initialize with null, will be loaded from DB
    isLoading: true, // Start with loading true
    isSaving: false,
    lastSaved: null,
    isDirty: false,
  });

  const { wrapAsync } = useAsyncErrorHandler({
    component: 'ProjectProvider',
  });

  // Initialize and load project from SQLite
  useEffect(() => {
    const initializeDB = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await sqliteService.initialize();
        let project = await sqliteService.loadProject();
        if (project) {
          dispatch({ type: 'SET_PROJECT', payload: project });
        } else {
          console.log('No project found in DB, creating default project.');
          project = createDefaultProject();
          await sqliteService.saveProject(project);
          dispatch({ type: 'SET_PROJECT', payload: project });
        }
      } catch (error) {
        console.error('Failed to initialize/load project:', error);
        // Optionally, use useAsyncErrorHandler or set an error state here
        // For now, we'll just log it and potentially load a default project
        // or leave the user in an error state.
        // Fallback to a new default project if DB operations fail critically
        const defaultProject = createDefaultProject();
        dispatch({ type: 'SET_PROJECT', payload: defaultProject });
         // Consider if you want to attempt saving this default project if DB init failed
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    wrapAsync(initializeDB, { action: 'initialize-db' })();
  }, [wrapAsync]);


  // Create debounced auto-save function
  const debouncedSave = useRef(
    debounce(async (project: Project) => {
      if (!project) return;
      dispatch({ type: 'SET_SAVING', payload: true });
      try {
        await sqliteService.saveProject(project);
        dispatch({ type: 'MARK_SAVED' });
      } catch (error) {
        console.error('Error in debounced save:', error);
        dispatch({ type: 'SET_SAVING', payload: false }); // Reset saving state on error
         // Optionally, use useAsyncErrorHandler or set an error state
      }
    }, 1500) // Save after 1.5 seconds of inactivity
  );

  // Auto-save to SQLite when project changes (debounced)
  useEffect(() => {
    if (state.isDirty && state.currentProject) {
      debouncedSave.current(state.currentProject);
    }
  }, [state.currentProject, state.isDirty]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSave.current.cancel();
    };
  }, []);

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
      if (!state.currentProject) return;
      // Cancel any pending debounced save
      debouncedSave.current.cancel();

      await wrapAsync(async () => {
        dispatch({ type: 'SET_SAVING', payload: true });
        if (state.currentProject) { // Check again, state might have changed
          await sqliteService.saveProject(state.currentProject);
        }
        dispatch({ type: 'MARK_SAVED' });
      }, { action: 'save-project-explicit' })();
    }, [state.currentProject, wrapAsync]),

    createNewProject: useCallback((confirmCallback?: () => boolean) => {
      if (state.isDirty) {
        const shouldProceed = confirmCallback ? confirmCallback() : true;
        if (!shouldProceed) {
          return;
        }
      }
      
      wrapAsync(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        const newProject = createDefaultProject();
        await sqliteService.saveProject(newProject);
        dispatch({ type: 'SET_PROJECT', payload: newProject });
        dispatch({ type: 'SET_LOADING', payload: false });
      }, { action: 'create-new-project' })();
    }, [state.isDirty, wrapAsync])
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