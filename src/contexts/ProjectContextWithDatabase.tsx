import React, { createContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { Project, Character, StoryArc, TimelineEvent } from '../types';
import { hybridDataService } from '../services/hybridDataService';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';
import { ErrorSanitizer } from '../utils/errorSanitization';

// State interface
interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  error: string | null;
  isInitialized: boolean;
}

// Action types
type ProjectAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<Project> } }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_SAVED' };

// Reducer
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload, isDirty: false };
    
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    
    case 'ADD_PROJECT':
      return { 
        ...state, 
        projects: [action.payload, ...state.projects],
        currentProject: action.payload,
        isDirty: false 
      };
    
    case 'UPDATE_PROJECT': {
      const updatedProjects = state.projects.map(project =>
        project.id === action.payload.id
          ? { ...project, ...action.payload.updates, updatedAt: new Date() }
          : project
      );
      
      const updatedCurrentProject = state.currentProject?.id === action.payload.id
        ? { ...state.currentProject, ...action.payload.updates, updatedAt: new Date() }
        : state.currentProject;
      
      return {
        ...state,
        projects: updatedProjects,
        currentProject: updatedCurrentProject,
        isDirty: false
      };
    }
    
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        currentProject: state.currentProject?.id === action.payload ? null : state.currentProject
      };
    
    case 'MARK_DIRTY':
      return { ...state, isDirty: true };
    
    case 'MARK_SAVED':
      return { ...state, isDirty: false, isSaving: false, lastSaved: new Date() };
    
    default:
      return state;
  }
}

// Initial state
const initialState: ProjectState = {
  currentProject: null,
  projects: [],
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  isDirty: false,
  error: null,
  isInitialized: false
};

// Context value interface
interface ProjectContextValue {
  state: ProjectState;
  actions: {
    // Core project operations
    createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    loadProject: (id: string) => Promise<void>;
    saveProject: () => Promise<void>;
    updateProject: (updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    listProjects: () => Promise<void>;
    
    // Character operations
    addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>;
    deleteCharacter: (id: string) => Promise<void>;
    
    // Story arc operations
    addStoryArc: (storyArc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateStoryArc: (id: string, updates: Partial<StoryArc>) => Promise<void>;
    deleteStoryArc: (id: string) => Promise<void>;
    
    // Timeline operations
    addTimelineEvent: (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateTimelineEvent: (id: string, updates: Partial<TimelineEvent>) => Promise<void>;
    deleteTimelineEvent: (id: string) => Promise<void>;
    
    // Utility operations
    clearError: () => void;
    markDirty: () => void;
    initialize: () => Promise<void>;
  };
}

// Create context
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);


// Provider component
interface ProjectProviderProps {
  children: React.ReactNode;
}

export function ProjectProviderWithDatabase({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const { wrapAsync } = useAsyncErrorHandler({ component: 'ProjectProvider' });
  
  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize the hybrid data service
  const initializeService = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await hybridDataService.initialize();
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      
      // Load existing projects
      const projects = await hybridDataService.listProjects();
      dispatch({ type: 'SET_PROJECTS', payload: projects });
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'ProjectProvider',
        action: 'initialize'
      });
      dispatch({ type: 'SET_ERROR', payload: sanitizedError.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => {
    initializeService();
  }, [initializeService]);

  // Auto-save effect
  const saveProject = useCallback(async () => {
    if (!state.currentProject || state.isSaving) return;

    await wrapAsync(async () => {
      dispatch({ type: 'SET_SAVING', payload: true });
      
      const updatedProject = await hybridDataService.updateProject(
        state.currentProject!.id,
        state.currentProject!
      );
      
      if (updatedProject) {
        dispatch({ type: 'UPDATE_PROJECT', payload: {
          id: state.currentProject!.id,
          updates: updatedProject
        }});
      }
      
      dispatch({ type: 'MARK_SAVED' });
    });
  }, [state.currentProject, state.isSaving, wrapAsync]);

  useEffect(() => {
    if (state.isDirty && state.currentProject && !state.isSaving) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer for 2 seconds
      autoSaveTimerRef.current = setTimeout(() => {
        saveProject();
      }, 2000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.isDirty, state.currentProject, state.isSaving, saveProject]);

  // Create memoized action functions to avoid circular dependencies
  const updateProjectAction = useCallback(async (updates: Partial<Project>) => {
    if (!state.currentProject) return;

    await wrapAsync(async () => {
      dispatch({ type: 'SET_SAVING', payload: true });
      
      const updatedProject = await hybridDataService.updateProject(
        state.currentProject!.id,
        { ...state.currentProject!, ...updates }
      );
      
      if (updatedProject) {
        dispatch({ type: 'UPDATE_PROJECT', payload: {
          id: state.currentProject!.id,
          updates: updatedProject
        }});
      }
      
      dispatch({ type: 'MARK_SAVED' });
    });
  }, [state.currentProject, wrapAsync]);

  // Action implementations
  const actions: ProjectContextValue['actions'] = {
    initialize: useCallback(async () => {
      await initializeService();
    }, [initializeService]),

    createProject: useCallback(async (projectData) => {
      await wrapAsync(async () => {
        dispatch({ type: 'SET_SAVING', payload: true });
        const project = await hybridDataService.createProject(projectData);
        dispatch({ type: 'ADD_PROJECT', payload: project });
        dispatch({ type: 'MARK_SAVED' });
      });
    }, [wrapAsync]),

    loadProject: useCallback(async (id: string) => {
      await wrapAsync(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        const project = await hybridDataService.getProject(id);
        
        if (project) {
          dispatch({ type: 'SET_CURRENT_PROJECT', payload: project });
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Project not found' });
        }
        
        dispatch({ type: 'SET_LOADING', payload: false });
      });
    }, [wrapAsync]),

    saveProject,

    updateProject: updateProjectAction,

    deleteProject: useCallback(async (id: string) => {
      await wrapAsync(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const success = await hybridDataService.deleteProject(id);
        
        if (success) {
          dispatch({ type: 'REMOVE_PROJECT', payload: id });
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Failed to delete project' });
        }
        
        dispatch({ type: 'SET_LOADING', payload: false });
      });
    }, [wrapAsync]),

    listProjects: useCallback(async () => {
      await wrapAsync(async () => {
        const projects = await hybridDataService.listProjects();
        dispatch({ type: 'SET_PROJECTS', payload: projects });
      });
    }, [wrapAsync]),

    // Character operations
    addCharacter: useCallback(async (characterData) => {
      if (!state.currentProject) return;

      const character: Character = {
        id: crypto.randomUUID(),
        ...characterData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedProject = {
        ...state.currentProject,
        characters: [...state.currentProject.characters, character],
        updatedAt: new Date()
      };

      await updateProjectAction(updatedProject);
    }, [state.currentProject, updateProjectAction]),

    updateCharacter: useCallback(async (id: string, updates) => {
      if (!state.currentProject) return;

      const updatedCharacters = state.currentProject.characters.map(char =>
        char.id === id ? { ...char, ...updates, updatedAt: new Date() } : char
      );

      await updateProjectAction({
        characters: updatedCharacters,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    deleteCharacter: useCallback(async (id: string) => {
      if (!state.currentProject) return;

      const updatedCharacters = state.currentProject.characters.filter(char => char.id !== id);

      await updateProjectAction({
        characters: updatedCharacters,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    // Story arc operations
    addStoryArc: useCallback(async (storyArcData) => {
      if (!state.currentProject) return;

      const storyArc: StoryArc = {
        id: crypto.randomUUID(),
        ...storyArcData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedProject = {
        ...state.currentProject,
        storyArcs: [...state.currentProject.storyArcs, storyArc],
        updatedAt: new Date()
      };

      await updateProjectAction(updatedProject);
    }, [state.currentProject, updateProjectAction]),

    updateStoryArc: useCallback(async (id: string, updates) => {
      if (!state.currentProject) return;

      const updatedStoryArcs = state.currentProject.storyArcs.map(arc =>
        arc.id === id ? { ...arc, ...updates, updatedAt: new Date() } : arc
      );

      await updateProjectAction({
        storyArcs: updatedStoryArcs,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    deleteStoryArc: useCallback(async (id: string) => {
      if (!state.currentProject) return;

      const updatedStoryArcs = state.currentProject.storyArcs.filter(arc => arc.id !== id);

      await updateProjectAction({
        storyArcs: updatedStoryArcs,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    // Timeline operations
    addTimelineEvent: useCallback(async (eventData) => {
      if (!state.currentProject) return;

      const event: TimelineEvent = {
        id: crypto.randomUUID(),
        ...eventData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedProject = {
        ...state.currentProject,
        timelineEvents: [...(state.currentProject.timelineEvents || []), event],
        updatedAt: new Date()
      };

      await updateProjectAction(updatedProject);
    }, [state.currentProject, updateProjectAction]),

    updateTimelineEvent: useCallback(async (id: string, updates) => {
      if (!state.currentProject) return;

      const updatedEvents = (state.currentProject.timelineEvents || []).map(event =>
        event.id === id ? { ...event, ...updates, updatedAt: new Date() } : event
      );

      await updateProjectAction({
        timelineEvents: updatedEvents,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    deleteTimelineEvent: useCallback(async (id: string) => {
      if (!state.currentProject) return;

      const updatedEvents = (state.currentProject.timelineEvents || []).filter(event => event.id !== id);

      await updateProjectAction({
        timelineEvents: updatedEvents,
        updatedAt: new Date()
      });
    }, [state.currentProject, updateProjectAction]),

    // Utility operations
    clearError: useCallback(() => {
      dispatch({ type: 'SET_ERROR', payload: null });
    }, []),

    markDirty: useCallback(() => {
      dispatch({ type: 'MARK_DIRTY' });
    }, [])
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const contextValue: ProjectContextValue = {
    state,
    actions
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// Export the original context for backward compatibility
export { ProjectContext };