import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { Project, Character, StoryArc, StoryNode, StoryEdge, StoryPlannerData, StoryNodeType, TimelineEvent, DateType, ProjectTemplate, TemplateSubEntity, TemplateStoryEdge } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';
import { debounce } from '../utils/debounce';

interface ProjectState {
  currentProject: Project;
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
  | { type: 'ADD_STORY_NODE'; payload: Omit<StoryNode, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_STORY_NODE'; payload: { id: string; updates: Partial<StoryNode> } }
  | { type: 'DELETE_STORY_NODE'; payload: string }
  | { type: 'ADD_STORY_EDGE'; payload: Omit<StoryEdge, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_STORY_EDGE'; payload: { id: string; updates: Partial<StoryEdge> } }
  | { type: 'DELETE_STORY_EDGE'; payload: string }
  | { type: 'ADD_TIMELINE_EVENT'; payload: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TIMELINE_EVENT'; payload: { id: string; updates: Partial<TimelineEvent> } }
  | { type: 'DELETE_TIMELINE_EVENT'; payload: string }
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
    addStoryNode: (node: Omit<StoryNode, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateStoryNode: (id: string, updates: Partial<StoryNode>) => void;
    deleteStoryNode: (id: string) => void;
    addStoryEdge: (edge: Omit<StoryEdge, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateStoryEdge: (id: string, updates: Partial<StoryEdge>) => void;
    deleteStoryEdge: (id: string) => void;
    addTimelineEvent: (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateTimelineEvent: (id: string, updates: Partial<TimelineEvent>) => void;
    deleteTimelineEvent: (id: string) => void;
    saveProject: () => Promise<void>;
    createNewProject: (confirmCallback?: () => boolean, template?: ProjectTemplate) => void;
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
  storyPlannerData: { nodes: [], edges: [] },
  timelineEvents: [],
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

    case 'ADD_STORY_NODE': {
      const newNode: StoryNode = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            nodes: [...state.currentProject.storyPlannerData!.nodes, newNode],
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'UPDATE_STORY_NODE': {
      const updatedNodes = state.currentProject.storyPlannerData!.nodes.map(node =>
        node.id === action.payload.id
          ? { ...node, ...action.payload.updates, updatedAt: new Date() }
          : node
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            nodes: updatedNodes,
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'DELETE_STORY_NODE': {
      const filteredNodes = state.currentProject.storyPlannerData!.nodes.filter(
        node => node.id !== action.payload
      );
      const filteredEdges = state.currentProject.storyPlannerData!.edges.filter(
        edge => edge.sourceNodeId !== action.payload && edge.targetNodeId !== action.payload
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            nodes: filteredNodes,
            edges: filteredEdges,
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'ADD_STORY_EDGE': {
      const newEdge: StoryEdge = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            edges: [...state.currentProject.storyPlannerData!.edges, newEdge],
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'UPDATE_STORY_EDGE': {
      const updatedEdges = state.currentProject.storyPlannerData!.edges.map(edge =>
        edge.id === action.payload.id
          ? { ...edge, ...action.payload.updates, updatedAt: new Date() }
          : edge
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            edges: updatedEdges,
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'DELETE_STORY_EDGE': {
      const filteredEdges = state.currentProject.storyPlannerData!.edges.filter(
        edge => edge.id !== action.payload
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          storyPlannerData: {
            ...state.currentProject.storyPlannerData!,
            edges: filteredEdges,
          },
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'ADD_TIMELINE_EVENT': {
      const newEvent: TimelineEvent = {
        ...action.payload,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          timelineEvents: [...(state.currentProject.timelineEvents || []), newEvent],
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'UPDATE_TIMELINE_EVENT': {
      const updatedEvents = (state.currentProject.timelineEvents || []).map(event =>
        event.id === action.payload.id
          ? { ...event, ...action.payload.updates, updatedAt: new Date() }
          : event
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          timelineEvents: updatedEvents,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    case 'DELETE_TIMELINE_EVENT': {
      const filteredEvents = (state.currentProject.timelineEvents || []).filter(
        event => event.id !== action.payload
      );
      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          timelineEvents: filteredEvents,
          updatedAt: new Date()
        },
        isDirty: true
      };
    }

    default:
      return state;
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [storedProject, setStoredProject] = useLocalStorage<Project>(
    'currentProject',
    createDefaultProject()
  );

  const [state, dispatch] = useReducer(projectReducer, {
    currentProject: storedProject,
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    isDirty: false
  });

  const { wrapAsync } = useAsyncErrorHandler({
    component: 'ProjectProvider'
  });

  // Create debounced auto-save function
  const debouncedSave = useRef(
    debounce((project: Project) => {
      setStoredProject(project);
    }, 1000) // Save after 1 second of inactivity
  );

  // Auto-save to localStorage when project changes (debounced)
  useEffect(() => {
    if (state.isDirty) {
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

    addStoryNode: useCallback((node: Omit<StoryNode, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_STORY_NODE', payload: node });
    }, []),

    updateStoryNode: useCallback((id: string, updates: Partial<StoryNode>) => {
      dispatch({ type: 'UPDATE_STORY_NODE', payload: { id, updates } });
    }, []),

    deleteStoryNode: useCallback((id: string) => {
      dispatch({ type: 'DELETE_STORY_NODE', payload: id });
    }, []),

    addStoryEdge: useCallback((edge: Omit<StoryEdge, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_STORY_EDGE', payload: edge });
    }, []),

    updateStoryEdge: useCallback((id: string, updates: Partial<StoryEdge>) => {
      dispatch({ type: 'UPDATE_STORY_EDGE', payload: { id, updates } });
    }, []),

    deleteStoryEdge: useCallback((id: string) => {
      dispatch({ type: 'DELETE_STORY_EDGE', payload: id });
    }, []),

    addTimelineEvent: useCallback((event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_TIMELINE_EVENT', payload: event });
    }, []),

    updateTimelineEvent: useCallback((id: string, updates: Partial<TimelineEvent>) => {
      dispatch({ type: 'UPDATE_TIMELINE_EVENT', payload: { id, updates } });
    }, []),

    deleteTimelineEvent: useCallback((id: string) => {
      dispatch({ type: 'DELETE_TIMELINE_EVENT', payload: id });
    }, []),

    saveProject: useCallback(async () => {
      await wrapAsync(async () => {
        dispatch({ type: 'SET_SAVING', payload: true });
        
        // Simulate save delay for user feedback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Save to localStorage (already handled by useEffect)
        setStoredProject(state.currentProject);
        
        dispatch({ type: 'MARK_SAVED' });
      }, { action: 'save-project' });
    }, [state.currentProject, setStoredProject, wrapAsync]),

    createNewProject: useCallback((confirmCallback?: () => boolean, template?: ProjectTemplate) => {
      if (state.isDirty) {
        const shouldProceed = confirmCallback ? confirmCallback() : window.confirm("You have unsaved changes. Are you sure you want to create a new project? Your current changes will be lost.");
        if (!shouldProceed) {
          return;
        }
      }

      if (template) {
        const newProjectBase = createDefaultProject(); // Get all default fields
        const newProject: Project = {
          ...newProjectBase,
          id: crypto.randomUUID(), // Always new ID
          createdAt: new Date(),    // Always new date
          updatedAt: new Date(),    // Always new date

          // Overwrite with template fields if they exist
          title: template.title || newProjectBase.title,
          description: template.description || newProjectBase.description,
          genre: template.genre || newProjectBase.genre,
          targetWordCount: template.targetWordCount || newProjectBase.targetWordCount,
          content: template.content || newProjectBase.content,

          characters: [],
          storyArcs: [],
          timelineEvents: [],
          storyPlannerData: { nodes: [], edges: [] },
        };

        const characterIdMap = new Map<string, string>();
        if (template.characters) {
          newProject.characters = template.characters.map(tc => {
            const newCharId = crypto.randomUUID();
            if (tc.templateId) characterIdMap.set(tc.templateId, newCharId);
            // Ensure all required fields are present
            return {
              role: 'supporting', // Default role if not in template
              backstory: '',
              traits: [],
              relationships: [],
              notes: '',
              ...tc,
              id: newCharId,
              createdAt: newProject.createdAt,
              updatedAt: newProject.updatedAt,
            } as Character;
          });
        }

        const storyArcIdMap = new Map<string, string>();
        if (template.storyArcs) {
          newProject.storyArcs = template.storyArcs.map(tsa => {
            const newArcId = crypto.randomUUID();
            if (tsa.templateId) storyArcIdMap.set(tsa.templateId, newArcId);
            const updatedLinkedCharIds = (tsa.characters || []).map(charTemplateId => characterIdMap.get(charTemplateId) || charTemplateId);
            return {
              type: 'main', // Default type
              acts: [],
              status: 'planning', // Default status
              notes: '',
              ...tsa,
              id: newArcId,
              characters: updatedLinkedCharIds,
              createdAt: newProject.createdAt,
              updatedAt: newProject.updatedAt,
            } as StoryArc;
          });
        }

        if (template.timelineEvents) {
          newProject.timelineEvents = template.timelineEvents.map(tte => {
            const newEventId = crypto.randomUUID();
            return {
              description: '', // Default if not in template
              tags: [],
              linkedCharacterIds: (tte.linkedCharacterIds || []).map(charTemplateId => characterIdMap.get(charTemplateId) || charTemplateId),
              linkedStoryArcIds: (tte.linkedStoryArcIds || []).map(arcTemplateId => storyArcIdMap.get(arcTemplateId) || arcTemplateId),
              ...tte,
              id: newEventId,
              createdAt: newProject.createdAt,
              updatedAt: newProject.updatedAt,
            } as TimelineEvent;
          });
        }

        if (template.storyPlannerData) {
          const nodeIdMap = new Map<string, string>();
          if (template.storyPlannerData.nodes) {
            newProject.storyPlannerData.nodes = template.storyPlannerData.nodes.map(tn => {
              const newNodeId = crypto.randomUUID();
              if (tn.templateId) nodeIdMap.set(tn.templateId, newNodeId);
              return {
                content: '', // Default content if not in template
                color: undefined,
                linkedCharacterId: tn.linkedCharacterId ? (characterIdMap.get(tn.linkedCharacterId) || tn.linkedCharacterId) : undefined,
                linkedStoryArcId: tn.linkedStoryArcId ? (storyArcIdMap.get(tn.linkedStoryArcId) || tn.linkedStoryArcId) : undefined,
                ...tn,
                id: newNodeId,
                createdAt: newProject.createdAt,
                updatedAt: newProject.updatedAt,
              } as StoryNode;
            });
          }
          if (template.storyPlannerData.edges) {
            newProject.storyPlannerData.edges = template.storyPlannerData.edges.map(te => {
              return {
                label: '', // Default label if not in template
                ...te,
                id: crypto.randomUUID(),
                sourceNodeId: nodeIdMap.get(te.sourceNodeTemplateId) || te.sourceNodeTemplateId,
                targetNodeId: nodeIdMap.get(te.targetNodeTemplateId) || te.targetNodeTemplateId,
                createdAt: newProject.createdAt,
                updatedAt: newProject.updatedAt,
              } as StoryEdge;
            });
          }
        }
        dispatch({ type: 'SET_PROJECT', payload: newProject });

      } else {
        // Original logic for blank project
        const newBlankProject = createDefaultProject();
        dispatch({ type: 'SET_PROJECT', payload: newBlankProject });
      }
    }, [state.isDirty])
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