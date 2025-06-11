// src/components/templates/__tests__/TemplateSelectionModal.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TemplateSelectionModal from '../TemplateSelectionModal';
import * as templateService from '../../../services/templateService'; // Mock this
import { ProjectTemplate, Project } from '../../../types'; // Added Project
import { ProjectProvider, ProjectContextValue } from '../../../contexts/ProjectContext'; // For context
import '@testing-library/jest-dom';

jest.mock('../../../services/templateService');

const mockTemplates: ProjectTemplate[] = [
  {
    templateId: 't1',
    templateName: 'Template One',
    templateDescription: 'Desc 1',
    genre: 'Fantasy',
    title: 'The First Tale',
    description: 'An epic journey begins.',
    targetWordCount: 80000,
    content: '# Chapter 1\nOnce upon a time...',
    characters: [ { templateId: 'char-hero-t1', name: 'Hero T1', description: 'Hero of Template 1', role: 'protagonist', backstory: '', traits:[], relationships:[], notes:'' } ],
    storyArcs: [ { templateId: 'arc-main-t1', title: 'Main Arc T1', description: 'Main arc of Template 1', acts: [], type:'main', characters:[], status:'planning', notes:'' } ],
    timelineEvents: [ { templateId: 'event-start-t1', title: 'Start T1', dateType: DateType.RELATIVE, dateValue: 'Beginning' } ],
    storyPlannerData: {
      nodes: [ { templateId: 'node-intro-t1', label: 'Intro T1', type: StoryNodeType.SCENE, position: {x:0,y:0}, content:'' } ],
      edges: []
    }
  },
  {
    templateId: 't2',
    templateName: 'Template Two',
    templateDescription: 'Desc 2',
    genre: 'Sci-Fi',
    title: 'The Second Voyage',
    description: 'A journey to the stars.',
    targetWordCount: 100000,
    content: '# Prologue\nIn a galaxy far, far away...',
    characters: [ { templateId: 'char-captain-t2', name: 'Captain T2', description: 'Captain of Template 2', role: 'protagonist', backstory: '', traits:[], relationships:[], notes:'' } ],
    storyArcs: [ { templateId: 'arc-mission-t2', title: 'Mission T2', description: 'Mission of Template 2', acts: [], type:'main', characters:[], status:'planning', notes:'' } ],
    timelineEvents: [ { templateId: 'event-launch-t2', title: 'Launch T2', dateType: DateType.ABSOLUTE, dateValue: '3024-01-01' } ],
    storyPlannerData: {
      nodes: [ { templateId: 'node-briefing-t2', label: 'Briefing T2', type: StoryNodeType.PLOT_POINT, position: {x:10,y:10}, content:'' } ],
      edges: []
    }
  },
];

// Minimal mock project state for testing context
const mockProject: Project = {
  id: 'p1',
  title: 'Test Project Title',
  content:'Initial project content.',
  characters:[],
  storyArcs:[],
  timelineEvents: [],
  storyPlannerData: {nodes: [], edges: []},
  createdAt: new Date(),
  updatedAt: new Date(),
  description: 'Test project description',
  genre: 'Test Genre',
  targetWordCount: 50000,
  currentWordCount: 123
};

const mockContextValue: Partial<ProjectContextValue> = {
  state: { currentProject: mockProject, isLoading: false, isSaving: false, lastSaved: null, isDirty: false, },
  actions: {
    createNewProject: jest.fn(),
    // Add all other actions from ProjectContextValue and mock them
    setProject: jest.fn(),
    updateProject: jest.fn(),
    addCharacter: jest.fn(),
    updateCharacter: jest.fn(),
    deleteCharacter: jest.fn(),
    addStoryArc: jest.fn(),
    updateStoryArc: jest.fn(),
    deleteStoryArc: jest.fn(),
    addStoryNode: jest.fn(),
    updateStoryNode: jest.fn(),
    deleteStoryNode: jest.fn(),
    addStoryEdge: jest.fn(),
    updateStoryEdge: jest.fn(),
    deleteStoryEdge: jest.fn(),
    addTimelineEvent: jest.fn(),
    updateTimelineEvent: jest.fn(),
    deleteTimelineEvent: jest.fn(),
    saveProject: jest.fn(),
  } as ProjectContextValue['actions'], // Cast to ensure all actions are covered
};

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<ProjectContext.Provider value={mockContextValue as ProjectContextValue}>{ui}</ProjectContext.Provider>);
};


describe('TemplateSelectionModal', () => {
  const mockOnClose = jest.fn();
  const mockOnTemplateSelected = jest.fn();

  beforeEach(() => {
    (templateService.getAvailableTemplates as jest.Mock).mockReturnValue(JSON.parse(JSON.stringify(mockTemplates))); // Deep clone for safety
    mockOnClose.mockClear();
    mockOnTemplateSelected.mockClear();
    // Clear mock calls for actions if they are reused across tests
    Object.values(mockContextValue.actions).forEach(mockFn => (mockFn as jest.Mock).mockClear());
  });

  it('does not render when isOpen is false', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={false} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    expect(screen.queryByText('Select a Project Template')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true and displays templates', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    expect(screen.getByText('Select a Project Template')).toBeInTheDocument();
    expect(screen.getByText('Template One')).toBeInTheDocument();
    expect(screen.getByText('Template Two')).toBeInTheDocument();
    expect(screen.getByText('Start with a Blank Project')).toBeInTheDocument();
  });

  it('calls onTemplateSelected with undefined when "Blank Project" is selected and confirmed', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    fireEvent.click(screen.getByText('Start with a Blank Project'));
    fireEvent.click(screen.getByText('Create Project'));
    expect(mockOnTemplateSelected).toHaveBeenCalledWith(undefined);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onTemplateSelected with the template when a template is selected and confirmed', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    fireEvent.click(screen.getByText('Template One')); // Selects "Template One"
    fireEvent.click(screen.getByText('Create Project'));
    expect(mockOnTemplateSelected).toHaveBeenCalledWith(expect.objectContaining({ templateId: 't1' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel button is clicked', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('"Create Project" button is disabled initially if no default selection', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    expect(screen.getByText('Create Project')).toBeDisabled();
  });

  it('"Create Project" button is enabled when a template is selected', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    fireEvent.click(screen.getByText('Template One'));
    expect(screen.getByText('Create Project')).toBeEnabled();
  });

  it('"Create Project" button is enabled when "Blank Project" is selected', () => {
    renderWithProvider(
      <TemplateSelectionModal isOpen={true} onClose={mockOnClose} onTemplateSelected={mockOnTemplateSelected} />
    );
    fireEvent.click(screen.getByText('Start with a Blank Project'));
    expect(screen.getByText('Create Project')).toBeEnabled();
  });
});
