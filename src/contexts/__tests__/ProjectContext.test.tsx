import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ProjectProvider, useProject, ProjectState } from '../ProjectContext'; // Assuming ProjectState is exported
import { Project, DateType, TimelineEvent } from '../../types'; // Added DateType, TimelineEvent

// Helper function to create a default project (if not already available from context file directly)
// This should mirror your actual createDefaultProject structure
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


const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
);

describe('ProjectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should provide default project state', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    expect(result.current.state.currentProject.title).toBe('Untitled Novel');
    expect(result.current.state.currentProject.characters).toEqual([]);
    expect(result.current.state.currentProject.storyArcs).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.isSaving).toBe(false);
  });

  it('should update project', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    act(() => {
      result.current.actions.updateProject({ title: 'New Title' });
    });

    expect(result.current.state.currentProject.title).toBe('New Title');
    expect(result.current.state.isDirty).toBe(true);
  });

  it('should add character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    const newCharacter = {
      name: 'Test Character',
      role: 'protagonist' as const,
      description: 'A test character',
      backstory: 'Test backstory',
      traits: ['brave'],
      relationships: [],
      notes: 'Test notes',
    };

    act(() => {
      result.current.actions.addCharacter(newCharacter);
    });

    expect(result.current.state.currentProject.characters).toHaveLength(1);
    expect(result.current.state.currentProject.characters[0]?.name).toBe('Test Character');
    expect(result.current.state.isDirty).toBe(true);
  });

  it('should update character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // First add a character
    act(() => {
      result.current.actions.addCharacter({
        name: 'Test Character',
        role: 'protagonist',
        description: 'A test character',
        backstory: 'Test backstory',
        traits: ['brave'],
        relationships: [],
        notes: 'Test notes',
      });
    });

    const characterId = result.current.state.currentProject.characters[0]?.id;

    act(() => {
      result.current.actions.updateCharacter(characterId!, { name: 'Updated Character' });
    });

    expect(result.current.state.currentProject.characters[0]?.name).toBe('Updated Character');
  });

  it('should delete character', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // First add a character
    act(() => {
      result.current.actions.addCharacter({
        name: 'Test Character',
        role: 'protagonist',
        description: 'A test character',
        backstory: 'Test backstory',
        traits: ['brave'],
        relationships: [],
        notes: 'Test notes',
      });
    });

    const characterId = result.current.state.currentProject.characters[0]?.id;

    act(() => {
      result.current.actions.deleteCharacter(characterId!);
    });

    expect(result.current.state.currentProject.characters).toHaveLength(0);
  });

  it('should handle saving project', async () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    await act(async () => {
      await result.current.actions.saveProject();
    });

    expect(result.current.state.isSaving).toBe(false);
    expect(result.current.state.isDirty).toBe(false);
    expect(result.current.state.lastSaved).toBeTruthy();
  });

  it('should create new project', () => {
    const { result } = renderHook(() => useProject(), { wrapper });

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.actions.updateProject({ title: 'Modified' });
    });

    expect(result.current.state.isDirty).toBe(true);

    act(() => {
      result.current.actions.createNewProject();
    });

    expect(result.current.state.currentProject.title).toBe('Untitled Novel');
    expect(result.current.state.isDirty).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useProject());
    }).toThrow('useProject must be used within a ProjectProvider');
  });
});

describe('Project Reducer - Timeline Events (via Context)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure localStorage is reset or set to a state that doesn't interfere
    // For these specific reducer tests, we often want a fresh default state
    const defaultProject = createDefaultProject();
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(defaultProject));
  });

  it('should handle ADD_TIMELINE_EVENT', () => {
    const { result } = renderHook(() => useProject(), { wrapper });
    const initialProject = result.current.state.currentProject;

    const newEventPayload = {
      title: 'New Event',
      dateType: DateType.ABSOLUTE,
      dateValue: '2024-01-01',
      description: 'A new event'
    };

    act(() => {
      result.current.actions.addTimelineEvent(newEventPayload);
    });

    const currentTimelineEvents = result.current.state.currentProject.timelineEvents || [];
    expect(currentTimelineEvents).toHaveLength(1);
    expect(currentTimelineEvents[0].title).toBe('New Event');
    expect(currentTimelineEvents[0].id).toBeDefined();
    expect(result.current.state.isDirty).toBe(true);
    expect(result.current.state.currentProject.updatedAt).not.toEqual(initialProject.updatedAt);
  });

  it('should handle UPDATE_TIMELINE_EVENT', () => {
    const { result } = renderHook(() => useProject(), { wrapper });
    const eventId = 'event-to-update';
    const initialEvent: TimelineEvent = {
      id: eventId,
      title: 'Old Title',
      dateType: DateType.ABSOLUTE,
      dateValue: '2023-12-01',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const otherEvent: TimelineEvent = {
      id: 'other-event',
      title: 'Other Event',
      dateType: DateType.RELATIVE,
      dateValue: 'Beginning',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Setup initial state with some timeline events
    act(() => {
      result.current.actions.setProject({
        ...result.current.state.currentProject,
        timelineEvents: [initialEvent, otherEvent]
      });
    });
     act(() => { // Mark as not dirty after setup
      result.current.actions.markAsSaved(); // You'd need a markAsSaved or similar action
    });


    const updates = { title: 'Updated Title', description: 'Now with description' };
    act(() => {
      result.current.actions.updateTimelineEvent(eventId, updates);
    });

    const currentTimelineEvents = result.current.state.currentProject.timelineEvents || [];
    const updatedEvent = currentTimelineEvents.find(e => e.id === eventId);
    expect(updatedEvent?.title).toBe('Updated Title');
    expect(updatedEvent?.description).toBe('Now with description');
    expect(currentTimelineEvents.find(e => e.id === 'other-event')?.title).toBe('Other Event');
    expect(result.current.state.isDirty).toBe(true);
  });

  it('should handle DELETE_TIMELINE_EVENT', () => {
    const { result } = renderHook(() => useProject(), { wrapper });
    const eventIdToDelete = 'event-to-delete';
    const event1: TimelineEvent = {
      id: 'event1',
      title: 'Event 1',
      dateType: DateType.ABSOLUTE,
      dateValue: '2024-01-01',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const eventToDelete: TimelineEvent = {
      id: eventIdToDelete,
      title: 'Event To Delete',
      dateType: DateType.ABSOLUTE,
      dateValue: '2024-02-01',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    act(() => {
      result.current.actions.setProject({
        ...result.current.state.currentProject,
        timelineEvents: [event1, eventToDelete]
      });
    });
    act(() => { // Mark as not dirty after setup
       result.current.actions.markAsSaved();
    });

    act(() => {
      result.current.actions.deleteTimelineEvent(eventIdToDelete);
    });

    const currentTimelineEvents = result.current.state.currentProject.timelineEvents || [];
    expect(currentTimelineEvents).toHaveLength(1);
    expect(currentTimelineEvents.find(e => e.id === eventIdToDelete)).toBeUndefined();
    expect(currentTimelineEvents[0]?.id).toBe('event1');
    expect(result.current.state.isDirty).toBe(true);
  });

  // Test case for ADD_TIMELINE_EVENT when timelineEvents is initially undefined in a loaded project
  it('should handle ADD_TIMELINE_EVENT when timelineEvents is undefined in loaded project', () => {
    const projectWithoutTimeline: Project = {
      ...createDefaultProject(),
      id: 'project-no-timeline',
      timelineEvents: undefined // Explicitly undefined
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectWithoutTimeline)); // Simulate loading this project

    const { result } = renderHook(() => useProject(), { wrapper });
     expect(result.current.state.currentProject.timelineEvents).toBeUndefined();


    const newEventPayload = {
      title: 'First Event',
      dateType: DateType.ABSOLUTE,
      dateValue: '2024-03-01'
    };
    act(() => {
      result.current.actions.addTimelineEvent(newEventPayload);
    });

    const currentTimelineEvents = result.current.state.currentProject.timelineEvents;
    expect(currentTimelineEvents).toBeDefined();
    expect(currentTimelineEvents).toHaveLength(1);
    expect(currentTimelineEvents![0].title).toBe('First Event');
    expect(result.current.state.isDirty).toBe(true);
  });
});