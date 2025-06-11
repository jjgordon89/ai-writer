import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineEventComponent from '../TimelineEventComponent';
import { TimelineEvent, DateType, Project } from '../../../types'; // Adjust path
import { ProjectProvider, ProjectContextValue } from '../../../contexts/ProjectContext'; // Adjust path
import '@testing-library/jest-dom';

const mockEvent: TimelineEvent = {
  id: 'test-event-1',
  title: 'Test Event Title',
  description: 'This is a test description.',
  dateType: DateType.ABSOLUTE,
  dateValue: '2024-07-15',
  endDateValue: '2024-07-16',
  linkedCharacterIds: ['char1'],
  linkedStoryArcIds: ['arc1'],
  tags: ['tag1', 'tag2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProjectData: Project = { // For context to resolve linked IDs
  id: 'proj1', title: 'Test Proj', content: '', createdAt: new Date(), updatedAt: new Date(),
  characters: [{
    id: 'char1',
    name: 'Character Alpha',
    description: 'Mock character',
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'protagonist',
    backstory: 'A mysterious past.',
    traits: ['Brave', 'Curious'],
    relationships: [],
    notes: 'Some notes about Alpha.'
  }],
  storyArcs: [{
    id: 'arc1',
    title: 'Arc Alpha',
    description: 'The first story arc.',
    acts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    type: 'main',
    characters: ['char1'],
    status: 'planning',
    notes: 'Notes for Arc Alpha.'
  }],
  timelineEvents: [mockEvent],
  description: '', genre: '', targetWordCount: 0, currentWordCount: 0,
};

const mockContextValue: Partial<ProjectContextValue> = {
  state: {
    currentProject: mockProjectData,
    isLoading: false, isSaving: false, lastSaved: null, isDirty: false,
  },
  actions: { /* mock all required actions */ } as any, // Cast to any for brevity or fill all
};

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


describe('TimelineEventComponent', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
  });

  it('renders event details correctly', () => {
    renderWithProvider(
      <TimelineEventComponent event={mockEvent} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    expect(screen.getByText('Test Event Title')).toBeInTheDocument();
    expect(screen.getByText(/Jul 15, 2024/)).toBeInTheDocument(); // Formatted date
    expect(screen.getByText('This is a test description.')).toBeInTheDocument();
    expect(screen.getByText(/Character Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Arc Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/tag1, tag2/)).toBeInTheDocument();
  });

  it('calls onEdit when Edit button is clicked', () => {
    renderWithProvider(
      <TimelineEventComponent event={mockEvent} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(mockEvent.id);
  });

  it('calls onDelete when Delete button is clicked', () => {
    renderWithProvider(
      <TimelineEventComponent event={mockEvent} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalledWith(mockEvent.id);
  });
});
