import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActDetailView } from './StoryArcsPanel'; // Assuming ActDetailView is exported
import { StoryArc, StoryAct, Character, Scene } from '../../types';
import { useAI } from '../../contexts/AIContext';

// Mock the useAI hook
jest.mock('../../contexts/AIContext', () => ({
  useAI: jest.fn(),
}));

const mockGenerateContent = jest.fn();
const mockOnUpdateArc = jest.fn();
const mockOnBack = jest.fn();

const mockAct: StoryAct = {
  id: 'act1',
  title: 'The First Act',
  description: 'This is where it all begins.',
  scenes: [],
  order: 0,
};

const mockArc: StoryArc = {
  id: 'arc1',
  title: 'The Grand Arc',
  description: 'A major storyline.',
  type: 'main',
  status: 'active',
  acts: [mockAct],
  characters: ['char1'],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCharacters: Character[] = [
    { id: 'char1', name: 'Hero', role: 'protagonist', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
];

const defaultProps = {
  arc: mockArc,
  act: mockAct,
  characters: mockCharacters,
  onUpdateArc: mockOnUpdateArc,
  onBack: mockOnBack,
};

// Mock window.alert for tests that might trigger it (e.g., parsing errors if not caught differently)
let mockAlert: jest.SpyInstance;

describe('ActDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAI as jest.Mock).mockReturnValue({
      generateContent: mockGenerateContent,
    });
    mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    mockAlert.mockRestore();
  });

  describe('Part A: Act Editing (Title/Description)', () => {
    test('"Edit Act Details" button toggles the edit form', () => {
      render(<ActDetailView {...defaultProps} />);
      const editButton = screen.getByText('Edit Act Details');
      expect(editButton).toBeInTheDocument();

      fireEvent.click(editButton);
      expect(screen.getByLabelText('Title')).toBeInTheDocument(); // Now editing title
      expect(screen.getByLabelText('Description')).toBeInTheDocument(); // Now editing description
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const getEditFieldButtons = (label: RegExp) => {
        const fieldLabel = screen.getByLabelText(label);
        const parentDiv = fieldLabel.closest('div');
        const suggestButton = parentDiv?.querySelector('button[title*="Suggest"]');
        const undoButton = Array.from(parentDiv?.querySelectorAll('button[type="button"]') || []).find(btn => btn.textContent === 'Undo');
        return { suggestButton, undoButton };
    };

    test('AI Suggestions & Undo for Act Title in edit mode', async () => {
      render(<ActDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Act Details')); // Enter edit mode

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const initialTitle = defaultProps.act.title;
      expect(titleInput).toHaveValue(initialTitle);

      const { suggestButton } = getEditFieldButtons(/Title/);
      expect(suggestButton).toBeInTheDocument();

      const aiTitle = 'New AI Act Title';
      mockGenerateContent.mockResolvedValue(aiTitle);
      if (suggestButton) fireEvent.click(suggestButton);

      await waitFor(() => expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining('act title')));
      expect(titleInput).toHaveValue(aiTitle);

      let { undoButton: undoBtn } = getEditFieldButtons(/Title/);
      expect(undoBtn).toBeInTheDocument();
      if (undoBtn) fireEvent.click(undoBtn);
      expect(titleInput).toHaveValue(initialTitle);

      undoBtn = getEditFieldButtons(/Title/).undoButton;
      expect(undoBtn).not.toBeInTheDocument();
    });

    test('Save/Cancel for Act Edit Form', async () => {
      render(<ActDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Act Details'));

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      const newTitle = "Updated Act Title";
      fireEvent.change(titleInput, { target: { value: newTitle } });

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockOnUpdateArc).toHaveBeenCalledWith(
          mockArc.id,
          expect.objectContaining({
            acts: expect.arrayContaining([
              expect.objectContaining({ id: mockAct.id, title: newTitle }),
            ]),
          })
        );
      });
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument(); // Form is closed

      // Test Cancel
      fireEvent.click(screen.getByText('Edit Act Details')); // Re-open
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: "Another Change" } });
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument(); // Form is closed
      // Title should revert to what it was before this edit session (newTitle, as save was called)
      // but since we don't re-render with new props in test, it'll be the initial prop value.
      // A more complex test would involve prop updates.
    });
  });

  describe('Part B: Suggest Scene Ideas', () => {
    test('renders "Suggest Scene Ideas with AI" button', () => {
      render(<ActDetailView {...defaultProps} />);
      expect(screen.getByText('Suggest Ideas')).toBeInTheDocument();
    });

    test('AI Scene Idea Suggestion Flow (Valid JSON)', async () => {
      const sceneIdeas = [{ idea: 'A hero emerges.' }, { idea: 'A villain plots.' }];
      mockGenerateContent.mockResolvedValue(JSON.stringify(sceneIdeas));
      render(<ActDetailView {...defaultProps} />);

      fireEvent.click(screen.getByText('Suggest Ideas'));
      expect(screen.getByText('Loading scene ideas...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Suggested Scene Ideas')).toBeInTheDocument();
        expect(screen.getByText('A hero emerges.')).toBeInTheDocument();
        expect(screen.getAllByText('Add as New Scene')).toHaveLength(sceneIdeas.length);
      });
    });

    test('displays error on invalid JSON for scene ideas', async () => {
        mockGenerateContent.mockResolvedValue("Not JSON");
        render(<ActDetailView {...defaultProps} />);
        fireEvent.click(screen.getByText('Suggest Ideas'));
        await waitFor(() => {
            expect(screen.getByText('Failed to parse AI suggestions for scene ideas. The format was unexpected.')).toBeInTheDocument();
        });
    });

    test('Adding a suggested scene idea calls onUpdateArc', async () => {
      const sceneIdeas = [{ idea: 'A crucial decision is made.' }];
      mockGenerateContent.mockResolvedValue(JSON.stringify(sceneIdeas));
      render(<ActDetailView {...defaultProps} act={{...mockAct, scenes: []}} />); // Ensure no initial scenes

      fireEvent.click(screen.getByText('Suggest Ideas'));
      await waitFor(() => expect(screen.getByText('A crucial decision is made.')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Add as New Scene'));

      expect(mockOnUpdateArc).toHaveBeenCalledWith(
        mockArc.id,
        expect.objectContaining({
          acts: expect.arrayContaining([
            expect.objectContaining({
              id: mockAct.id,
              scenes: expect.arrayContaining([
                expect.objectContaining({
                  title: expect.stringContaining('A crucial decision is made.'), // Title might be truncated
                  description: 'A crucial decision is made.',
                  notes: 'AI Suggested Idea',
                }),
              ]),
            }),
          ]),
        })
      );
      const updatedActs = mockOnUpdateArc.mock.calls[0][1].acts;
      const updatedTargetAct = updatedActs.find((a: StoryAct) => a.id === mockAct.id);
      expect(updatedTargetAct.scenes[0].id).toBeDefined();
      expect(updatedTargetAct.scenes[0].order).toBe(0);
    });

    test('Dismiss/Clear buttons for scene ideas work', async () => {
      mockGenerateContent.mockResolvedValue(JSON.stringify([{ idea: 'Idea 1' }]));
      render(<ActDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Suggest Ideas'));
      await waitFor(() => expect(screen.getByText('Suggested Scene Ideas')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Clear Ideas'));
      expect(screen.queryByText('Suggested Scene Ideas')).not.toBeInTheDocument();

      mockGenerateContent.mockRejectedValue(new Error("Scene Idea Fetch Error"));
      fireEvent.click(screen.getByText('Suggest Ideas'));
      await waitFor(() => expect(screen.getByText('An error occurred while fetching AI suggestions for scene ideas.')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Dismiss'));
      expect(screen.queryByText('An error occurred while fetching AI suggestions for scene ideas.')).not.toBeInTheDocument();
    });
  });
});
