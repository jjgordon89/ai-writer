import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectProvider, ProjectContextValue } from '../../../contexts/ProjectContext'; // Adjust path
import TimelineView from '../TimelineView';
import { Project, DateType, TimelineEvent } from '../../../types'; // Adjust path
import '@testing-library/jest-dom';


// Minimal mock project state for testing
const mockProject: Project = {
  id: 'test-proj',
  title: 'Test Novel',
  content: '',
  characters: [],
  storyArcs: [],
  timelineEvents: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  // Add other required Project fields if any (genre, description, etc.)
  description: '',
  genre: '',
  targetWordCount: 0,
  currentWordCount: 0,
};

const mockContextValue: Partial<ProjectContextValue> = {
  state: {
    currentProject: mockProject,
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    isDirty: false,
  },
  actions: { // Mock actions as needed, or use jest.fn()
    addTimelineEvent: jest.fn(),
    updateTimelineEvent: jest.fn(),
    deleteTimelineEvent: jest.fn(),
    // Add other required actions or ensure they are optional in your context type
    setProject: jest.fn(),
    updateProject: jest.fn(),
    addCharacter: jest.fn(),
    updateCharacter: jest.fn(),
    deleteCharacter: jest.fn(),
    addStoryArc: jest.fn(),
    updateStoryArc: jest.fn(),
    deleteStoryArc: jest.fn(),
    saveProject: jest.fn(),
    createNewProject: jest.fn(),
    addStoryNode: jest.fn(),
    updateStoryNode: jest.fn(),
    deleteStoryNode: jest.fn(),
    addStoryEdge: jest.fn(),
    updateStoryEdge: jest.fn(),
    deleteStoryEdge: jest.fn(),
  }
};

// Helper to wrap component in ProjectProvider
const renderWithProvider = (
  ui: React.ReactElement,
  providerProps?: Partial<ProjectContextValue>
) => {
  return render(
    <ProjectContext.Provider value={{ ...mockContextValue, ...providerProps } as ProjectContextValue}>
      {ui}
    </ProjectContext.Provider>
  );
};

describe('TimelineView', () => {
  it('renders the main title', () => {
    renderWithProvider(<TimelineView />);
    expect(screen.getByText('Interactive Story Timeline')).toBeInTheDocument();
  });

  it('shows "No timeline events..." message when events array is empty', () => {
    renderWithProvider(<TimelineView />);
    expect(screen.getByText(/No timeline events match the current filters/i)).toBeInTheDocument();
  });

  it('renders events when provided', () => {
    const events: TimelineEvent[] = [
      { id: 'ev1', title: 'Event One', dateType: DateType.ABSOLUTE, dateValue: '2024-01-01', createdAt: new Date(), updatedAt: new Date() },
      { id: 'ev2', title: 'Event Two', dateType: DateType.RELATIVE, dateValue: 'Later', createdAt: new Date(), updatedAt: new Date() },
    ];
    const projectWithEvents = { ...mockProject, timelineEvents: events };
    renderWithProvider(<TimelineView />, { state: { ...mockContextValue.state!, currentProject: projectWithEvents } });

    expect(screen.getByText('Event One')).toBeInTheDocument();
    expect(screen.getByText('Event Two')).toBeInTheDocument();
  });
});
