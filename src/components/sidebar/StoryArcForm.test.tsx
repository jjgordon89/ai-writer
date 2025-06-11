import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StoryArcForm } from './StoryArcsPanel'; // Assuming StoryArcForm is exported
import { StoryArc, Character } from '../../types'; // Import Character type
import { useAI } from '../../contexts/AIContext';

// Mock the useAI hook
jest.mock('../../contexts/AIContext', () => ({
  useAI: jest.fn(),
}));

const mockGenerateContent = jest.fn();
const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockCharacters: Character[] = [
  { id: 'char1', name: 'Hero', role: 'protagonist', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
  { id: 'char2', name: 'Sidekick', role: 'supporting', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
];

const defaultProps = {
  storyArc: null,
  characters: mockCharacters, // Pass mock characters
  onSave: mockOnSave,
  onCancel: mockOnCancel,
  onDelete: undefined, // Optional prop
};

describe('StoryArcForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAI as jest.Mock).mockReturnValue({
      generateContent: mockGenerateContent,
    });
  });

  // Helper to get AI and Undo buttons for a field
  const getFieldButtons = (label: RegExp) => {
    const fieldLabel = screen.getByLabelText(label);
    const parentDiv = fieldLabel.closest('div');
    const suggestButton = parentDiv?.querySelector('button[title*="Suggest"]');
    const undoButton = Array.from(parentDiv?.querySelectorAll('button') || []).find(btn => btn.textContent === 'Undo');
    return { suggestButton, undoButton };
  };


  describe('Button Rendering', () => {
    test('renders "Suggest with AI" and "Undo" placeholders (initially hidden) for Title, Description, Notes', () => {
      render(<StoryArcForm {...defaultProps} />);

      const titleField = screen.getByLabelText(/title/i);
      expect(titleField).toBeInTheDocument();
      const titleButtons = getFieldButtons(/title/i);
      expect(titleButtons.suggestButton).toBeInTheDocument();
      expect(titleButtons.undoButton).not.toBeInTheDocument(); // Undo initially hidden

      const descriptionField = screen.getByLabelText(/description/i);
      expect(descriptionField).toBeInTheDocument();
      const descriptionButtons = getFieldButtons(/description/i);
      expect(descriptionButtons.suggestButton).toBeInTheDocument();
      expect(descriptionButtons.undoButton).not.toBeInTheDocument();

      const notesField = screen.getByLabelText(/notes/i);
      expect(notesField).toBeInTheDocument();
      const notesButtons = getFieldButtons(/notes/i);
      expect(notesButtons.suggestButton).toBeInTheDocument();
      expect(notesButtons.undoButton).not.toBeInTheDocument();
    });
  });

  describe('AI Suggestions and Undo', () => {
    const testFieldAI = async (
      fieldName: 'title' | 'description' | 'notes',
      label: RegExp,
      initialValue: string,
      aiSuggestion: string
    ) => {
      render(<StoryArcForm {...defaultProps} />);
      const inputElement = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
      fireEvent.change(inputElement, { target: { value: initialValue } });

      const { suggestButton } = getFieldButtons(label);
      expect(suggestButton).toBeInTheDocument();

      mockGenerateContent.mockResolvedValue(aiSuggestion);
      if (suggestButton) fireEvent.click(suggestButton);

      await waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining(fieldName === 'title' ? 'story arc title' : fieldName));
      });
      expect(inputElement).toHaveValue(aiSuggestion);

      const { undoButton: undoButtonAfterSuggest } = getFieldButtons(label);
      expect(undoButtonAfterSuggest).toBeInTheDocument(); // Undo button visible

      // Test Undo
      if (undoButtonAfterSuggest) fireEvent.click(undoButtonAfterSuggest);
      await waitFor(() => expect(inputElement).toHaveValue(initialValue));
      const { undoButton: undoButtonAfterUndo } = getFieldButtons(label);
      expect(undoButtonAfterUndo).not.toBeInTheDocument(); // Undo button hidden

      // Test typing hides Undo
      if (suggestButton) fireEvent.click(suggestButton); // Suggest again
      await waitFor(() => expect(inputElement).toHaveValue(aiSuggestion));
      const { undoButton: undoButtonBeforeTyping } = getFieldButtons(label);
      expect(undoButtonBeforeTyping).toBeInTheDocument();

      fireEvent.change(inputElement, { target: { value: 'User typing...' } });
      const { undoButton: undoButtonAfterTyping } = getFieldButtons(label);
      expect(undoButtonAfterTyping).not.toBeInTheDocument();
    };

    test('works for Title field', async () => {
      await testFieldAI('title', /title/i, 'Old Title', 'New AI Title');
    });
    test('works for Description field', async () => {
      await testFieldAI('description', /description/i, 'Old Description', 'New AI Description');
    });
    test('works for Notes field', async () => {
      await testFieldAI('notes', /notes/i, 'Old Notes', 'New AI Notes');
    });
  });

  describe('onSave Interaction', () => {
    test('onSave is called with AI-modified data', async () => {
      render(<StoryArcForm {...defaultProps} />);
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Original Title' } });

      const { suggestButton } = getFieldButtons(/title/i);
      mockGenerateContent.mockResolvedValue('AI Title');
      if (suggestButton) fireEvent.click(suggestButton);
      await waitFor(() => expect(screen.getByLabelText(/title/i)).toHaveValue('AI Title'));

      fireEvent.click(screen.getByText('Save Story Arc'));
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Title' }));
    });

    test('onSave is called with original data if undone', async () => {
      render(<StoryArcForm {...defaultProps} />);
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Original Title' } });

      const { suggestButton, undoButton: initialUndoButton } = getFieldButtons(/title/i);
      expect(initialUndoButton).not.toBeInTheDocument();

      mockGenerateContent.mockResolvedValue('AI Title');
      if (suggestButton) fireEvent.click(suggestButton);
      await waitFor(() => expect(screen.getByLabelText(/title/i)).toHaveValue('AI Title'));

      const { undoButton: undoButtonAfterSuggest } = getFieldButtons(/title/i);
      if (undoButtonAfterSuggest) fireEvent.click(undoButtonAfterSuggest);
      await waitFor(() => expect(screen.getByLabelText(/title/i)).toHaveValue('Original Title'));

      fireEvent.click(screen.getByText('Save Story Arc'));
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Original Title' }));
    });
  });
});
